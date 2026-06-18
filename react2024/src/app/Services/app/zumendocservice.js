// zumendocservice.js
// Per-drawing documents stored ENTIRELY in ThingsBoard, split by mutability:
//   - file bytes        -> TB resource library (/api/resource, base64 in TB Postgres)
//   - IMMUTABLE metadata -> the drawing asset's SERVER_SCOPE "documents" attribute
//        (id, docType, originalName, size, resourceId, uploadedBy, uploadedAt) — set
//        once at upload, never overwritten.
//   - MUTABLE state      -> TB telemetry (time-series), one JSON snapshot per doc per
//        change under key `doc_<id>`: { name, status, remarks, changedBy, changedAt }.
//        Because telemetry keeps every datapoint, each edit is preserved and the full
//        change history is viewable (see getDocumentHistory).
// No external file server is used, so files are reachable from any machine that
// can reach the TB the app points at (ZUMEN_TB_URL). TB resource downloads need
// the auth header, so previews/thumbnails fetch the bytes -> blob object URL.

import React, { useState, useEffect } from 'react';
import { zumenApi, zBase, getTenantToken } from './zumenservice';

// The 16 ZUMEN document types (order matches the product's tab strip).
export const DOCUMENT_TYPES = [
  { key: 'drawing', label: 'Drawing' },
  { key: 'assembly-drawing', label: 'Assembly drawing' },
  { key: 'work-instruction-video', label: 'Work Instruction video' },
  { key: 'work-instruction-details', label: 'Work instruction details' },
  { key: '2d-cad', label: '2D CAD' },
  { key: '3d-cad', label: '3D CAD' },
  { key: 'customer-list', label: 'Customer List' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'purchase-order', label: 'Purchase order' },
  { key: 'inspection-report', label: 'Inspection report' },
  { key: 'tools', label: 'Tools' },
  { key: 'product-sample', label: 'Product sample' },
  { key: 'defect-report', label: 'Defect report' },
  { key: 'program', label: 'Program' },
  { key: 'packing-std', label: 'Packing Std.' },
];

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `d${Date.now()}${Math.floor(Math.random() * 1e6)}`;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]); // strip "data:...;base64,"
  r.onerror = reject;
  r.readAsDataURL(file);
});

// ---- per-type document attributes on the component asset ----
// Each docType is its OWN SERVER_SCOPE attribute key (e.g. "drawing", "assembly-drawing",
// "2d-cad", "3d-cad", ...), holding an ARRAY of that type's immutable doc records.
const TYPE_KEYS = DOCUMENT_TYPES.map((t) => t.key);
const LEGACY_KEY = 'documents'; // old flat-array attribute, auto-migrated below.

const parseAttrVal = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : (p ? [p] : []); } catch (e) { return []; } }
  return v ? [v] : [];
};

// Read all per-type document arrays for an asset -> { [docType]: [immutable docs] }.
// One-time: if the old flat "documents" attribute exists, redistribute it into the
// per-type keys and remove the legacy key.
const readTypeAttrs = async (drawingId) => {
  const out = {};
  TYPE_KEYS.forEach((k) => { out[k] = []; });
  let legacy = [];
  try {
    const keys = [...TYPE_KEYS, LEGACY_KEY].join(',');
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/values/attributes/SERVER_SCOPE?keys=${encodeURIComponent(keys)}`
    );
    (data || []).forEach((a) => {
      if (a.key === LEGACY_KEY) legacy = parseAttrVal(a.value);
      else if (out[a.key] !== undefined) out[a.key] = parseAttrVal(a.value);
    });
  } catch (e) {
    console.error('readTypeAttrs failed:', e?.response?.data || e.message);
    return out;
  }
  if (legacy.length) {
    const touched = new Set();
    legacy.forEach((d) => {
      const t = d.docType && out[d.docType] !== undefined ? d.docType : null;
      if (t && !out[t].some((x) => x.id === d.id)) { out[t].push(d); touched.add(t); }
    });
    try {
      for (const t of touched) await saveTypeAttr(drawingId, t, out[t]);
      await zumenApi.delete(
        `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/SERVER_SCOPE?keys=${LEGACY_KEY}`
      );
    } catch (e) { console.error('legacy migrate failed:', e?.response?.data || e.message); }
  }
  return out;
};

// Save one type's array back to its SERVER_SCOPE attribute (key = docType).
const saveTypeAttr = async (drawingId, docType, arr) => {
  await zumenApi.post(
    `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/attributes/SERVER_SCOPE`,
    { [docType]: JSON.stringify(arr) }
  );
};

// ---- mutable state in telemetry (one JSON snapshot per doc, keyed doc_<id>) ----
// The fields that can change after upload and whose history we keep.
export const MUTABLE_FIELDS = ['name', 'status', 'remarks'];
const DEFAULT_STATUS = 'New Model';
const tsKey = (docId) => `doc_${docId}`;

// Post a new mutable snapshot for one doc; TB appends it as a new time-series point.
const postSnapshot = async (drawingId, docId, snapshot) => {
  await zumenApi.post(
    `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/timeseries/ANY`,
    { [tsKey(docId)]: JSON.stringify(snapshot) }
  );
};

// Latest snapshot for each docId -> { [docId]: { name, status, remarks, changedBy, changedAt } }.
const readLatestSnapshots = async (drawingId, docIds) => {
  if (!docIds.length) return {};
  const keys = docIds.map(tsKey).join(',');
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/values/timeseries?keys=${encodeURIComponent(keys)}`
    );
    const out = {};
    docIds.forEach((id) => {
      const pt = data && data[tsKey(id)] && data[tsKey(id)][0];
      if (pt) { try { out[id] = JSON.parse(pt.value); } catch (e) { out[id] = {}; } }
    });
    return out;
  } catch (e) {
    console.error('readLatestSnapshots failed:', e?.response?.data || e.message);
    return {};
  }
};

// Merge the immutable record with its latest mutable snapshot (falls back to any
// legacy mutable fields still living on the attribute, for pre-telemetry docs).
const mergeDoc = (immutable, snap) => ({
  ...immutable,
  name: (snap && snap.name) != null ? snap.name : (immutable.name || immutable.originalName),
  status: (snap && snap.status) != null ? snap.status : (immutable.status || DEFAULT_STATUS),
  remarks: (snap && snap.remarks) != null ? snap.remarks : (immutable.remarks || ''),
  changedAt: snap && snap.changedAt,
  changedBy: snap && snap.changedBy,
});

// All documents for a component + per-type counts: { documents, counts }.
// Immutable fields come from the per-type attributes; current name/status/remarks
// from telemetry. Also returns documentsByType (the raw per-type grouping).
export const getDocuments = async (drawingId) => {
  const byType = await readTypeAttrs(drawingId);
  const flat = [];
  TYPE_KEYS.forEach((k) => {
    byType[k].forEach((d) => flat.push({ ...d, docType: d.docType || k }));
  });
  const snaps = await readLatestSnapshots(drawingId, flat.map((d) => d.id));
  const merged = flat.map((d) => mergeDoc(d, snaps[d.id]));
  const counts = {};
  const documentsByType = {};
  TYPE_KEYS.forEach((k) => { counts[k] = 0; documentsByType[k] = []; });
  merged.forEach((d) => { counts[d.docType] = (counts[d.docType] || 0) + 1; documentsByType[d.docType].push(d); });
  return { documents: merged, documentsByType, counts };
};

// Full change history for one document (newest first): [{ ts, name, status, remarks, changedBy }].
export const getDocumentHistory = async (drawingId, docId, limit = 500) => {
  const endTs = Date.now();
  const startTs = endTs - 1000 * 60 * 60 * 24 * 366 * 10; // up to 10 years back
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/values/timeseries` +
      `?keys=${tsKey(docId)}&startTs=${startTs}&endTs=${endTs}&limit=${limit}&orderBy=DESC`
    );
    const arr = (data && data[tsKey(docId)]) || [];
    return arr.map((pt) => {
      let v = {};
      try { v = JSON.parse(pt.value); } catch (e) { /* keep empty */ }
      return { ts: pt.ts, ...v };
    });
  } catch (e) {
    console.error('getDocumentHistory failed:', e?.response?.data || e.message);
    return [];
  }
};

// ---- rich-text sidecar (in-app Word/Excel editors) ----
// mammoth strips run-level formatting (text colour, font, size, highlight) when it
// reads a .docx back to HTML. So for documents authored/edited IN the app we also
// stash the exact editor HTML in telemetry (keyed dochtml_<id>); the editor loads
// from this when present (perfect round-trip) and only falls back to mammoth for
// files uploaded from outside. The .docx itself still holds everything for Word.
const htmlKey = (docId) => `dochtml_${docId}`;
export const saveDocHtml = async (drawingId, docId, html) => {
  if (!drawingId || !docId) return;
  try {
    await zumenApi.post(
      `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/timeseries/ANY`,
      { [htmlKey(docId)]: html == null ? '' : String(html) }
    );
  } catch (e) { console.error('saveDocHtml failed:', e?.response?.data || e.message); }
};
export const getDocHtml = async (drawingId, docId) => {
  if (!drawingId || !docId) return null;
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/values/timeseries?keys=${htmlKey(docId)}`
    );
    const pt = data && data[htmlKey(docId)] && data[htmlKey(docId)][0];
    return pt && pt.value ? pt.value : null;
  } catch (e) { return null; }
};

// Upload a file: store bytes as a TB resource, append metadata to the asset.
// `action` labels the first history entry (default "Uploaded").
export const uploadDocument = async (drawingId, docTypeKey, file, name, action = 'Uploaded') => {
  const base64 = await fileToBase64(file);
  let res;
  try {
    const r = await zumenApi.post(`${zBase()}/api/resource`, {
      resourceType: 'JS_MODULE',
      title: name || file.name,
      fileName: `${Date.now()}-${file.name}`,
      data: base64,
    });
    res = r.data;
  } catch (e) {
    const msg = e?.response?.data?.message || e.message;
    throw new Error(`Upload failed (ThingsBoard): ${msg}`);
  }
  const docId = uid();
  const uploadedAt = new Date().toISOString();
  // IMMUTABLE record -> attribute (no name/status/remarks here; those live in telemetry).
  const immutable = {
    id: docId,
    drawingId,
    docType: docTypeKey,
    originalName: file.name,
    size: file.size,
    sizeLabel: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    resourceId: res.id.id,
    uploadedBy: 'Current User',
    uploadedAt,
  };
  // Append to THIS type's attribute array (key = docType).
  const byType = await readTypeAttrs(drawingId);
  const arr = byType[docTypeKey] || [];
  arr.push(immutable);
  await saveTypeAttr(drawingId, docTypeKey, arr);
  // Seed the first MUTABLE snapshot in telemetry.
  const snapshot = {
    name: name || file.name,
    status: DEFAULT_STATUS,
    remarks: '',
    action,
    changedBy: 'Current User',
    changedAt: uploadedAt,
  };
  await postSnapshot(drawingId, docId, snapshot);
  return mergeDoc(immutable, snapshot);
};

// Describe what changed between the current doc and a patch (for the history log).
const describeChange = (cur, patch) => {
  const parts = [];
  if (patch.name != null && patch.name !== cur.name) parts.push(`Renamed to “${patch.name}”`);
  if (patch.status != null && patch.status !== cur.status) parts.push(`Status → ${patch.status}`);
  if (patch.remarks != null && patch.remarks !== cur.remarks) {
    parts.push(cur.remarks ? 'Remarks updated' : 'Remarks added');
  }
  return parts.join(', ') || 'Edited';
};

// Edit a mutable field: post a NEW telemetry snapshot (history preserved); the
// immutable attribute is untouched. `patch.action` overrides the auto description.
export const updateDocument = async (drawingId, docId, patch) => {
  const { documents } = await getDocuments(drawingId);
  const cur = documents.find((d) => d.id === docId);
  if (!cur) throw new Error('Document not found');
  const snapshot = {
    name: patch.name != null ? patch.name : cur.name,
    status: patch.status != null ? patch.status : cur.status,
    remarks: patch.remarks != null ? patch.remarks : cur.remarks,
    action: patch.action || describeChange(cur, patch),
    changedBy: patch.changedBy || 'Current User',
    changedAt: new Date().toISOString(),
  };
  await postSnapshot(drawingId, docId, snapshot);
  return { ...cur, ...snapshot };
};

// Replace a document's file bytes in place (e.g. saving a markup edit) and log it
// in history — keeps the SAME doc id so its history is continuous.
export const replaceDocumentFile = async (drawingId, docId, blob, fileName, action = 'Markup edited') => {
  const base64 = await fileToBase64(blob);
  const { data: res } = await zumenApi.post(`${zBase()}/api/resource`, {
    resourceType: 'JS_MODULE',
    title: fileName,
    fileName: `${Date.now()}-${fileName}`,
    data: base64,
  });
  // Swap the resourceId on the immutable record, drop the old resource.
  const byType = await readTypeAttrs(drawingId);
  let oldResourceId = null;
  let type = null;
  for (const k of TYPE_KEYS) {
    const d = byType[k].find((x) => x.id === docId);
    if (d) { oldResourceId = d.resourceId; d.resourceId = res.id.id; d.size = blob.size; type = k; break; }
  }
  if (!type) throw new Error('Document not found');
  await saveTypeAttr(drawingId, type, byType[type]);
  if (oldResourceId) { try { await zumenApi.delete(`${zBase()}/api/resource/${oldResourceId}`); } catch (e) { /* ignore */ } }
  // Log the edit in history (carry current mutable fields forward).
  const { documents } = await getDocuments(drawingId);
  const cur = documents.find((d) => d.id === docId) || {};
  await postSnapshot(drawingId, docId, {
    name: cur.name, status: cur.status, remarks: cur.remarks,
    action, changedBy: 'Current User', changedAt: new Date().toISOString(),
  });
  return res.id.id;
};

export const deleteDocument = async (drawingId, docId) => {
  const byType = await readTypeAttrs(drawingId);
  let doc = null;
  let type = null;
  for (const k of TYPE_KEYS) {
    const found = byType[k].find((d) => d.id === docId);
    if (found) { doc = found; type = k; break; }
  }
  if (!doc) return null;
  await saveTypeAttr(drawingId, type, byType[type].filter((d) => d.id !== docId));
  if (doc.resourceId) {
    try { await zumenApi.delete(`${zBase()}/api/resource/${doc.resourceId}`); } catch (e) { /* ignore */ }
  }
  return doc;
};

// ---- authed blob URL for a resource (for <img>/<iframe>/download) ----
const blobCache = new Map(); // resourceId -> { url, kind, mime }

// TB stores resources as JS_MODULE, so the download response has the wrong
// content-type. We detect the REAL type from the file's magic bytes (so a file
// mislabeled with the wrong extension still previews correctly) and re-type the
// blob, falling back to the extension when the bytes are inconclusive.
const MIME_BY_EXT = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain',
};
const mimeOf = (name) => MIME_BY_EXT[(name || '').split('.').pop().toLowerCase()] || '';
const kindOfMime = (mime) => {
  if (!mime) return null;
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/')) return 'text';
  return null;
};

// Detect the real content type from the first bytes of the file.
const sniffMime = (buf) => {
  const b = new Uint8Array(buf);
  const hex = [...b.slice(0, 4)].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (hex === '25504446') return 'application/pdf';           // %PDF
  if (hex === '89504e47') return 'image/png';                 // PNG
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';          // JPG
  if (hex === '47494638') return 'image/gif';                 // GIF8
  if (hex === '52494646') {                                   // RIFF -> WEBP at offset 8
    const w = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (w === 'WEBP') return 'image/webp';
  }
  if (b[0] === 0x3c) return 'image/svg+xml';                  // '<' (svg/xml)
  return '';
};

// Fetch a resource, detect its real type, cache { url, kind, mime }.
const loadBlob = async (doc) => {
  if (!doc || !doc.resourceId) return null;
  if (blobCache.has(doc.resourceId)) return blobCache.get(doc.resourceId);
  const token = await getTenantToken();
  const res = await fetch(`${zBase()}/api/resource/${doc.resourceId}/download`, {
    headers: { 'X-Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return null;
  let blob = await res.blob();
  let mime = '';
  try { mime = sniffMime(await blob.slice(0, 16).arrayBuffer()); } catch (e) { /* ignore */ }
  if (!mime) mime = mimeOf(doc.name);          // fall back to extension
  if (mime && blob.type !== mime) blob = new Blob([blob], { type: mime });
  const entry = { url: URL.createObjectURL(blob), kind: kindOfMime(mime), mime };
  blobCache.set(doc.resourceId, entry);
  return entry;
};

export const getDocUrl = async (doc) => {
  try { const e = await loadBlob(doc); return e ? e.url : null; }
  catch (err) { console.error('getDocUrl failed:', err.message); return null; }
};

// React hook: returns the blob object URL for a doc (null while loading).
export const useDocUrl = (doc) => {
  const [url, setUrl] = useState(null);
  const key = doc && doc.resourceId;
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (doc) getDocUrl(doc).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
};

// React hook for previews: returns { url, kind } where kind is the REAL detected
// type (image/pdf/video/...) — falls back to null so callers can use the extension.
export const useDocPreview = (doc) => {
  const [state, setState] = useState({ url: null, kind: null });
  const key = doc && doc.resourceId;
  useEffect(() => {
    let alive = true;
    setState({ url: null, kind: null });
    if (doc) loadBlob(doc).then((e) => { if (alive && e) setState({ url: e.url, kind: e.kind }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
};

// <img> that loads an authed TB resource (for thumbnails / image cells).
// Falls back if the resource can't be loaded OR the bytes aren't a renderable
// image (e.g. a real PDF), so it's safe to use for any document type.
export const AuthImg = ({ doc, alt, style, fallback = null }) => {
  const url = useDocUrl(doc);
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [url]);
  if (!url || err) return fallback;
  return <img src={url} alt={alt || ''} style={style} onError={() => setErr(true)} />;
};
