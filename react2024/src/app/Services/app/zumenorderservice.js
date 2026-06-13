// zumenorderservice.js
// ZUMEN Projects / Orders module, stored ENTIRELY in ThingsBoard (reuses the same
// tenant-authenticated client as zumenservice.js):
//   - each order  -> TB Asset (asset profile "Order")
//   - order fields -> the asset's SERVER_SCOPE attributes
//   - link to drawing -> "OrderOf" relation Order -> Drawing asset (optional)
// No external backend / disk is used.

import { zumenApi, zBase } from './zumenservice';

export const ORDER_ASSET_PROFILE = 'Order';
export const ORDER_RELATION_TYPE = 'OrderOf';

// The 11-stage order-to-delivery pipeline (matches the real ZUMEN filter tabs).
export const ORDER_STAGES = [
  'Prototype',
  'Pre Quotation',
  'Post Quotation',
  'Under check by commercial',
  'PO received',
  'Payment received',
  'In Production',
  'Inspection',
  'In stock',
  'Delivered',
  'Lost',
];

// Colour per stage (used for chips / pipeline tabs).
export const STAGE_COLORS = {
  Prototype: '#6366f1',
  'Pre Quotation': '#0ea5e9',
  'Post Quotation': '#06b6d4',
  'Under check by commercial': '#f59e0b',
  'PO received': '#8b5cf6',
  'Payment received': '#10b981',
  'In Production': '#3b82f6',
  Inspection: '#eab308',
  'In stock': '#14b8a6',
  Delivered: '#22c55e',
  Lost: '#ef4444',
};

// SERVER_SCOPE attribute keys stored on each Order asset.
export const ORDER_ATTR_KEYS = [
  'status',
  'clientId',
  'clientName',
  'drawingId',
  'drawingNumber',
  'productName',
  'deliveryDate',
  'quotationNumber',
  'quotationVolume',
  'unit',
  'unitPrice',
  'poNumber',
  'notes',
  'createdDate',
];

let _orderProfileIdCache = null;

// Find (or create) the "Order" asset profile and return its id.
export const getOrderProfileId = async () => {
  if (_orderProfileIdCache) return _orderProfileIdCache;
  try {
    const { data } = await zumenApi.get(`${zBase()}/api/assetProfiles?pageSize=200&page=0`);
    const found = (data?.data || []).find((p) => p.name === ORDER_ASSET_PROFILE);
    if (found) { _orderProfileIdCache = found.id.id; return _orderProfileIdCache; }
    const { data: created } = await zumenApi.post(`${zBase()}/api/assetProfile`, {
      name: ORDER_ASSET_PROFILE,
      description: 'ZUMEN project / order record',
      default: false,
    });
    _orderProfileIdCache = created.id.id;
    return _orderProfileIdCache;
  } catch (error) {
    console.error('getOrderProfileId failed:', error?.response?.data || error.message);
    throw error;
  }
};

// Read SERVER_SCOPE attributes for an order, flattened to a plain object.
const readOrderAttrs = async (assetId) => {
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${assetId}/values/attributes/SERVER_SCOPE`
    );
    return (data || []).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {});
  } catch (e) {
    console.error('readOrderAttrs failed:', e?.response?.data || e.message);
    return {};
  }
};

// List all orders for the tenant (asset + merged attributes). Newest first.
export const getOrders = async ({ pageSize = 200, page = 0, textSearch = '' } = {}) => {
  try {
    const params = new URLSearchParams({
      pageSize: String(pageSize), page: String(page),
      type: ORDER_ASSET_PROFILE, sortProperty: 'createdTime', sortOrder: 'DESC',
    });
    if (textSearch) params.set('textSearch', textSearch);
    const { data } = await zumenApi.get(`${zBase()}/api/tenant/assets?${params.toString()}`);
    const assets = data?.data || [];
    const orders = await Promise.all(assets.map(async (a) => {
      const attrs = await readOrderAttrs(a.id.id);
      return {
        id: a.id.id,
        name: a.name,
        label: a.label,
        createdTime: a.createdTime,
        status: attrs.status || 'Prototype',
        ...attrs,
      };
    }));
    return orders;
  } catch (error) {
    console.error('getOrders failed:', error?.response?.data || error.message);
    return [];
  }
};

export const getOrderById = async (assetId) => {
  const { data: asset } = await zumenApi.get(`${zBase()}/api/asset/${assetId}`);
  const attrs = await readOrderAttrs(assetId);
  return { id: asset.id.id, name: asset.name, label: asset.label, createdTime: asset.createdTime, status: attrs.status || 'Prototype', ...attrs };
};

// Upsert SERVER_SCOPE attributes for an order. Only known keys are written.
export const saveOrderAttributes = async (assetId, meta = {}) => {
  const payload = {};
  ORDER_ATTR_KEYS.forEach((k) => { if (meta[k] !== undefined && meta[k] !== null) payload[k] = meta[k]; });
  if (Object.keys(payload).length === 0) return;
  await zumenApi.post(
    `${zBase()}/api/plugins/telemetry/ASSET/${assetId}/attributes/SERVER_SCOPE`, payload
  );
};

// Create a new order. The TB asset name must be unique -> use quotationNumber or a stamp.
export const createOrder = async (meta = {}) => {
  const profileId = await getOrderProfileId();
  const name = (meta.quotationNumber || `ORD-${Date.now()}`).trim();
  const { data: asset } = await zumenApi.post(`${zBase()}/api/asset`, {
    name,
    label: meta.productName || meta.drawingNumber || '',
    assetProfileId: { entityType: 'ASSET_PROFILE', id: profileId },
  });
  await saveOrderAttributes(asset.id.id, {
    status: meta.status || 'Prototype',
    createdDate: new Date().toISOString(),
    ...meta,
  });
  // Optional link to a drawing asset.
  if (meta.drawingId) {
    try {
      await zumenApi.post(`${zBase()}/api/relation`, {
        from: { id: asset.id.id, entityType: 'ASSET' },
        to: { id: meta.drawingId, entityType: 'ASSET' },
        type: ORDER_RELATION_TYPE, typeGroup: 'COMMON',
      });
    } catch (e) { /* relation optional */ }
  }
  return asset;
};

// Move an order to a new stage (single attribute write).
export const updateOrderStatus = async (assetId, status) => {
  await saveOrderAttributes(assetId, { status });
};

export const deleteOrder = async (assetId) => {
  await zumenApi.delete(`${zBase()}/api/asset/${assetId}`);
};
