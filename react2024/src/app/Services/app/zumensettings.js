// zumensettings.js — data layer for the ZUMEN Settings module.
// Reuses the tenant-authenticated zumenApi (ThingsBoard). No separate backend.
import { zumenApi, zBase } from './zumenservice';

let _tenantId = null;

export const getCurrentUser = async () => {
  const { data } = await zumenApi.get(`${zBase()}/api/auth/user`);
  return data;
};

const tenantId = async () => {
  if (_tenantId) return _tenantId;
  const u = await getCurrentUser();
  _tenantId = u && u.tenantId && u.tenantId.id;
  return _tenantId;
};

export const getTenant = async () => {
  const tid = await tenantId();
  if (!tid) return null;
  try { const { data } = await zumenApi.get(`${zBase()}/api/tenant/${tid}`); return data; }
  catch (e) { return null; }
};

export const listUsers = async () => {
  for (const path of ['/api/tenant/users?pageSize=200&page=0', '/api/users?pageSize=200&page=0']) {
    try { const { data } = await zumenApi.get(`${zBase()}${path}`); if (data && data.data) return data.data; }
    catch (e) { /* try next */ }
  }
  return [];
};

export const getAssetCount = async (type) => {
  try {
    const { data } = await zumenApi.get(`${zBase()}/api/tenant/assets?type=${encodeURIComponent(type)}&pageSize=1&page=0`);
    if (data && typeof data.totalElements === 'number') return data.totalElements;
    return ((data && data.data) || []).length;
  } catch (e) { return null; }
};

export const listClients = async () => {
  try { const { data } = await zumenApi.get(`${zBase()}/api/customers?pageSize=200&page=0`); return (data && data.data) || []; }
  catch (e) { return []; }
};

export const getAuditLogs = async ({ pageSize = 100, page = 0, startTime, endTime } = {}) => {
  let url = `${zBase()}/api/audit/logs?pageSize=${pageSize}&page=${page}&sortProperty=createdTime&sortOrder=DESC`;
  if (startTime) url += `&startTime=${startTime}`;
  if (endTime) url += `&endTime=${endTime}`;
  const { data } = await zumenApi.get(url);
  return (data && data.data) || [];
};

// ---- config stored on a singleton tenant ASSET (TENANT attributes are 403 for
// the ZUMEN token; creating/writing assets is allowed). ----
const parseJson = (v) => {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return null; }
};

const CFG_NAME = 'ZUMEN_SETTINGS';
const CFG_TYPE = 'ZumenConfig';
let _cfgId = null;
const cfgAssetId = async () => {
  if (_cfgId) return _cfgId;
  try {
    const { data } = await zumenApi.get(`${zBase()}/api/tenant/assets?pageSize=50&page=0&type=${CFG_TYPE}`);
    const found = ((data && data.data) || []).find((a) => a.name === CFG_NAME);
    if (found) { _cfgId = found.id.id; return _cfgId; }
  } catch (e) { /* fall through to create */ }
  const { data: created } = await zumenApi.post(`${zBase()}/api/asset`, { name: CFG_NAME, type: CFG_TYPE });
  _cfgId = created.id.id;
  return _cfgId;
};
const readAttrs = async (keys) => {
  const id = await cfgAssetId();
  const q = keys ? `?keys=${encodeURIComponent(keys)}` : '';
  const { data } = await zumenApi.get(`${zBase()}/api/plugins/telemetry/ASSET/${id}/values/attributes/SERVER_SCOPE${q}`);
  const map = {}; (data || []).forEach((a) => { map[a.key] = a.value; });
  return map;
};
const writeAttrs = async (body) => {
  const id = await cfgAssetId();
  await zumenApi.post(`${zBase()}/api/plugins/telemetry/ASSET/${id}/SERVER_SCOPE`, body);
};

export const getConfig = async () => {
  try { const m = await readAttrs('zumenPermissions,zumenDocTypes'); return { permissions: parseJson(m.zumenPermissions), docTypes: parseJson(m.zumenDocTypes) }; }
  catch (e) { return { permissions: null, docTypes: null }; }
};
export const saveConfig = async (patch) => {
  const body = {};
  if (patch.permissions) body.zumenPermissions = JSON.stringify(patch.permissions);
  if (patch.docTypes) body.zumenDocTypes = JSON.stringify(patch.docTypes);
  await writeAttrs(body);
};
export const getSetting = async (key) => {
  try { const m = await readAttrs(key); return parseJson(m[key]); } catch (e) { return null; }
};
export const setSetting = async (key, value) => {
  await writeAttrs({ [key]: JSON.stringify(value) });
};
