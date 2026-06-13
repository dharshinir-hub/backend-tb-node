// zumenservice.js
// ZUMEN foundation data-layer. Reuses the existing ThingsBoard REST API
// (same zumenApi + X-Authorization Bearer token used by the rest of the app).
//
// Mapping (see ZUMEN_FEATURE_MAP.md / memory):
//   Drawing / part        -> TB Asset  (asset profile "Drawing"), metadata in SERVER_SCOPE attributes
//   BOM / assembly tree    -> TB relations  ("Contains", typeGroup COMMON) parent -> child asset
//   Client / company       -> TB Customer
//   Auth / users           -> TB JWT (already wired in core/axiosconfig.js)
//
// This module is intentionally backend-free: no zumen_backend Express mock is used.

import axios from 'axios';

// ---- dedicated tenant-authenticated TB client ------------------------------
// ZUMEN uses its OWN tenant token (env ZUMEN_TB_USER/PASS) against ZUMEN_TB_URL,
// so asset/relation operations have tenant permission regardless of the customer
// user logged into the rest of the app.

export const zBase = () =>
  (window._env_.ZUMEN_TB_URL || window._env_.SERVER_URL).replace(/\/$/, '');

export const zumenApi = axios.create();
let _tenantToken = null;

const tenantLogin = async () => {
  const { data } = await axios.post(`${zBase()}/api/auth/login`, {
    username: window._env_.ZUMEN_TB_USER || window._env_.TENANT_GMAIL,
    password: window._env_.ZUMEN_TB_PASS || window._env_.TENANT_PASSWORD,
  });
  _tenantToken = data.token;
  return _tenantToken;
};

// Raw tenant token (for fetch calls that need the X-Authorization header, e.g.
// downloading resource blobs for previews).
export const getTenantToken = async () => {
  if (!_tenantToken) await tenantLogin();
  return _tenantToken;
};

// Attach the tenant token; obtain one on first use.
zumenApi.interceptors.request.use(async (config) => {
  if (!_tenantToken) await tenantLogin();
  config.headers['X-Authorization'] = `Bearer ${_tenantToken}`;
  return config;
});

// On 401, re-login once and retry the original request.
zumenApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config || {};
    if (error.response && error.response.status === 401 && !cfg._retried) {
      cfg._retried = true;
      _tenantToken = null;
      await tenantLogin();
      cfg.headers['X-Authorization'] = `Bearer ${_tenantToken}`;
      return zumenApi(cfg);
    }
    return Promise.reject(error);
  }
);

// ---- constants -------------------------------------------------------------

export const DRAWING_ASSET_PROFILE = 'Drawing';
export const BOM_RELATION_TYPE = 'Contains';
export const BOM_RELATION_GROUP = 'COMMON';

// Server-scope attribute keys we store on each Drawing asset.
export const DRAWING_ATTR_KEYS = [
  'drawingNumber',
  'productName',
  'clientId',
  'clientName',
  'revision',
  'status',
  'material',
  'processType',
  'thumbnailUrl',
  'thumbnailResourceId',
  'notes',
  // ZUMEN metadata-form fields
  'qualityCheckNo',
  'inspectionSheet',
  'ecNo',
  'excelSheet',
  'inventory',
  'project',
  'assemblyNo',
  'deliveryDate',
];


// ---- asset profile bootstrap ----------------------------------------------

let _drawingProfileIdCache = null;

// Find (or create) the "Drawing" asset profile and return its id.
// TB 3.4+/4.0 require an assetProfileId when creating assets.
export const getDrawingProfileId = async () => {
  if (_drawingProfileIdCache) return _drawingProfileIdCache;
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/assetProfiles?pageSize=200&page=0`
    );
    const found = (data?.data || []).find(
      (p) => p.name === DRAWING_ASSET_PROFILE
    );
    if (found) {
      _drawingProfileIdCache = found.id.id;
      return _drawingProfileIdCache;
    }
    // Not present yet -> create it.
    const { data: created } = await zumenApi.post(`${zBase()}/api/assetProfile`, {
      name: DRAWING_ASSET_PROFILE,
      description: 'ZUMEN drawing / part record',
      default: false,
    });
    _drawingProfileIdCache = created.id.id;
    return _drawingProfileIdCache;
  } catch (error) {
    console.error('getDrawingProfileId failed:', error?.response?.data || error.message);
    throw error;
  }
};

// ---- drawings (assets) -----------------------------------------------------

// List drawings for the tenant, paginated, with optional free-text search.
// Returns the raw TB page payload: { data, totalElements, totalPages, hasNext }.
export const getDrawings = async ({
  pageSize = 24,
  page = 0,
  textSearch = '',
  sortProperty = 'createdTime',
  sortOrder = 'DESC',
} = {}) => {
  try {
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      page: String(page),
      type: DRAWING_ASSET_PROFILE,
      sortProperty,
      sortOrder,
    });
    if (textSearch) params.set('textSearch', textSearch);
    const { data } = await zumenApi.get(
      `${zBase()}/api/tenant/assets?${params.toString()}`
    );
    return data;
  } catch (error) {
    console.error('getDrawings failed:', error?.response?.data || error.message);
    return { data: [], totalElements: 0, totalPages: 0, hasNext: false };
  }
};

export const getDrawingById = async (assetId) => {
  const { data } = await zumenApi.get(`${zBase()}/api/asset/${assetId}`);
  return data;
};

// Read SERVER_SCOPE attributes for a drawing and flatten to a plain object.
export const getDrawingAttributes = async (assetId) => {
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${assetId}/values/attributes/SERVER_SCOPE`
    );
    return (data || []).reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
  } catch (error) {
    console.error('getDrawingAttributes failed:', error?.response?.data || error.message);
    return {};
  }
};

// Convenience: a drawing asset + its attributes merged into one object.
export const getDrawingDetail = async (assetId) => {
  const [asset, attrs] = await Promise.all([
    getDrawingById(assetId),
    getDrawingAttributes(assetId),
  ]);
  return { ...asset, attributes: attrs };
};

// Create a new drawing. `meta` holds the ZUMEN fields (drawingNumber, productName, ...).
// The TB asset name must be unique per tenant -> we use drawingNumber as the name.
export const createDrawing = async (meta = {}) => {
  const profileId = await getDrawingProfileId();
  const name = (meta.drawingNumber || meta.productName || `DRW-${Date.now()}`).trim();

  const { data: asset } = await zumenApi.post(`${zBase()}/api/asset`, {
    name,
    label: meta.productName || '',
    assetProfileId: { entityType: 'ASSET_PROFILE', id: profileId },
  });

  await saveDrawingAttributes(asset.id.id, meta);
  return asset;
};

// Upsert SERVER_SCOPE attributes for a drawing. Only known keys are written.
export const saveDrawingAttributes = async (assetId, meta = {}) => {
  const payload = {};
  DRAWING_ATTR_KEYS.forEach((k) => {
    if (meta[k] !== undefined && meta[k] !== null) payload[k] = meta[k];
  });
  if (Object.keys(payload).length === 0) return;
  await zumenApi.post(
    `${zBase()}/api/plugins/telemetry/ASSET/${assetId}/attributes/SERVER_SCOPE`,
    payload
  );
};

export const deleteDrawing = async (assetId) => {
  await zumenApi.delete(`${zBase()}/api/asset/${assetId}`);
};

// ---- drawing revision / version control ------------------------------------
// Each revision is recorded as a telemetry datapoint (full history kept) and the
// current revision is mirrored to the SERVER_SCOPE "revision" attribute.
export const saveRevision = async (assetId, revision, note = '', by = 'Current User') => {
  await zumenApi.post(
    `${zBase()}/api/plugins/telemetry/ASSET/${assetId}/timeseries/ANY`,
    { revision: JSON.stringify({ revision, note, by, at: new Date().toISOString() }) }
  );
  await saveDrawingAttributes(assetId, { revision });
};

export const getRevisionHistory = async (assetId, limit = 200) => {
  const endTs = Date.now();
  const startTs = endTs - 1000 * 60 * 60 * 24 * 366 * 10;
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${assetId}/values/timeseries` +
      `?keys=revision&startTs=${startTs}&endTs=${endTs}&limit=${limit}&orderBy=DESC`
    );
    const arr = (data && data.revision) || [];
    // TB returns newest-first; keep only the latest entry per revision label so
    // accidental duplicates (e.g. a double-clicked "New Rev") collapse to one.
    const seen = new Set();
    const out = [];
    arr.forEach((pt) => {
      let v = {};
      try { v = JSON.parse(pt.value); } catch (e) { v = { revision: pt.value }; }
      const label = v.revision;
      if (label && seen.has(label)) return;
      if (label) seen.add(label);
      out.push({ ts: pt.ts, ...v });
    });
    return out;
  } catch (e) {
    console.error('getRevisionHistory failed:', e?.response?.data || e.message);
    return [];
  }
};

// Next revision label: A->B->...->Z->AA, or numeric "1"->"2" if it's a number.
export const nextRevision = (cur) => {
  if (!cur) return 'A';
  if (/^\d+$/.test(cur)) return String(parseInt(cur, 10) + 1);
  const s = cur.toUpperCase();
  let i = s.length - 1;
  const arr = s.split('');
  while (i >= 0) {
    if (arr[i] === 'Z') { arr[i] = 'A'; i--; } else { arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1); return arr.join(''); }
  }
  return 'A' + arr.join('');
};

// ---- BOM / assembly hierarchy (relations) ---------------------------------

// Direct child parts of a drawing (one level down the assembly tree).
export const getBomChildren = async (parentAssetId) => {
  const { data } = await zumenApi.get(
    `${zBase()}/api/relations/info?fromId=${parentAssetId}&fromType=ASSET`
  );
  return (data || []).filter((r) => r.type === BOM_RELATION_TYPE && r.to.entityType === 'ASSET');
};

// Direct parents of a drawing (one level up).
export const getBomParents = async (childAssetId) => {
  const { data } = await zumenApi.get(
    `${zBase()}/api/relations/info?toId=${childAssetId}&toType=ASSET`
  );
  return (data || []).filter((r) => r.type === BOM_RELATION_TYPE && r.from.entityType === 'ASSET');
};

export const addBomLink = async (parentAssetId, childAssetId) => {
  await zumenApi.post(`${zBase()}/api/relation`, {
    from: { id: parentAssetId, entityType: 'ASSET' },
    to: { id: childAssetId, entityType: 'ASSET' },
    type: BOM_RELATION_TYPE,
    typeGroup: BOM_RELATION_GROUP,
  });
};

export const removeBomLink = async (parentAssetId, childAssetId) => {
  await zumenApi.delete(
    `${zBase()}/api/relation?fromId=${parentAssetId}&fromType=ASSET` +
      `&relationType=${BOM_RELATION_TYPE}&relationTypeGroup=${BOM_RELATION_GROUP}` +
      `&toId=${childAssetId}&toType=ASSET`
  );
};

// Build the full assembly tree under a root drawing: a nested structure
// { id, name, label, status, children:[...] }. Cycle-safe and depth-capped.
export const getAssemblyTree = async (rootId, maxDepth = 8, _depth = 0, _seen = new Set()) => {
  if (_seen.has(rootId) || _depth > maxDepth) {
    return { id: rootId, name: '', label: '', status: '', children: [], repeated: _seen.has(rootId) };
  }
  _seen.add(rootId);
  const detail = await getDrawingDetail(rootId);
  const rels = await getBomChildren(rootId);
  const children = [];
  for (const r of rels) {
    children.push(await getAssemblyTree(r.to.id, maxDepth, _depth + 1, _seen));
  }
  return {
    id: rootId,
    name: detail.name,
    label: detail.label || detail.attributes?.productName || '',
    status: detail.attributes?.status || '',
    material: detail.attributes?.material || '',
    inventory: detail.attributes?.inventory || '',
    thumbnailResourceId: detail.attributes?.thumbnailResourceId || '',
    children,
  };
};

// ---- operation sequence / process routing (per drawing) --------------------
// Ordered manufacturing steps for a part, stored as the drawing asset's
// SERVER_SCOPE "operations" attribute (JSON array). Each op: { id, name,
// machine, cycleTime, setupTime, remarks } — sequence is the array order.
export const getOperations = async (drawingId) => {
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/values/attributes/SERVER_SCOPE?keys=operations`
    );
    const entry = (data || []).find((a) => a.key === 'operations');
    if (!entry) return [];
    const v = entry.value;
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v) || []; } catch (e) { return []; }
  } catch (error) {
    console.error('getOperations failed:', error?.response?.data || error.message);
    return [];
  }
};

export const saveOperations = async (drawingId, ops) => {
  await zumenApi.post(
    `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/attributes/SERVER_SCOPE`,
    { operations: JSON.stringify(ops) }
  );
};

// ---- clients (customers) ---------------------------------------------------

// Tenant customers = ZUMEN clients. Returns [{ id, title }].
export const getClients = async ({ pageSize = 200, page = 0, textSearch = '' } = {}) => {
  try {
    const params = new URLSearchParams({ pageSize: String(pageSize), page: String(page) });
    if (textSearch) params.set('textSearch', textSearch);
    const { data } = await zumenApi.get(
      `${zBase()}/api/customers?${params.toString()}`
    );
    return (data?.data || []).map((c) => ({ id: c.id.id, title: c.title }));
  } catch (error) {
    console.error('getClients failed:', error?.response?.data || error.message);
    return [];
  }
};
