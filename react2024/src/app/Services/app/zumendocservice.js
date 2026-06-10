// zumendocservice.js
// Per-drawing documents stored ENTIRELY in ThingsBoard:
//   - file bytes  -> TB resource library (/api/resource, base64 in TB Postgres)
//   - metadata    -> the drawing asset's SERVER_SCOPE "documents" attribute (JSON array)
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
  { key: 'video', label: 'Video' },
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

// ---- documents attribute (metadata) on the drawing asset ----
const readDocsAttr = async (drawingId) => {
  try {
    const { data } = await zumenApi.get(
      `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/values/attributes/SERVER_SCOPE?keys=documents`
    );
    const entry = (data || []).find((a) => a.key === 'documents');
    if (!entry) return [];
    const v = entry.value;
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v) || []; } catch (e) { return []; }
  } catch (e) {
    console.error('readDocsAttr failed:', e?.response?.data || e.message);
    return [];
  }
};

const saveDocsAttr = async (drawingId, docs) => {
  await zumenApi.post(
    `${zBase()}/api/plugins/telemetry/ASSET/${drawingId}/attributes/SERVER_SCOPE`,
    { documents: JSON.stringify(docs) }
  );
};

// All documents for a drawing + per-type counts: { documents, counts }.
export const getDocuments = async (drawingId) => {
  const docs = await readDocsAttr(drawingId);
  const counts = {};
  DOCUMENT_TYPES.forEach((t) => { counts[t.key] = 0; });
  docs.forEach((d) => { counts[d.docType] = (counts[d.docType] || 0) + 1; });
  return { documents: docs, counts };
};

// Upload a file: store bytes as a TB resource, append metadata to the asset.
export const uploadDocument = async (drawingId, docTypeKey, file, name) => {
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
  const doc = {
    id: uid(),
    drawingId,
    docType: docTypeKey,
    name: name || file.name,
    size: file.size,
    sizeLabel: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    resourceId: res.id.id,
    uploadedAt: new Date().toISOString(),
  };
  const docs = await readDocsAttr(drawingId);
  docs.push(doc);
  await saveDocsAttr(drawingId, docs);
  return doc;
};

export const updateDocument = async (drawingId, docId, patch) => {
  const docs = await readDocsAttr(drawingId);
  const i = docs.findIndex((d) => d.id === docId);
  if (i === -1) throw new Error('Document not found');
  docs[i] = { ...docs[i], ...patch };
  await saveDocsAttr(drawingId, docs);
  return docs[i];
};

export const deleteDocument = async (drawingId, docId) => {
  const docs = await readDocsAttr(drawingId);
  const doc = docs.find((d) => d.id === docId);
  await saveDocsAttr(drawingId, docs.filter((d) => d.id !== docId));
  if (doc && doc.resourceId) {
    try { await zumenApi.delete(`${zBase()}/api/resource/${doc.resourceId}`); } catch (e) { /* ignore */ }
  }
  return doc;
};

// ---- authed blob URL for a resource (for <img>/<iframe>/download) ----
const blobCache = new Map(); // resourceId -> object URL

export const getDocUrl = async (doc) => {
  if (!doc || !doc.resourceId) return null;
  if (blobCache.has(doc.resourceId)) return blobCache.get(doc.resourceId);
  try {
    const token = await getTenantToken();
    const res = await fetch(`${zBase()}/api/resource/${doc.resourceId}/download`, {
      headers: { 'X-Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    blobCache.set(doc.resourceId, url);
    return url;
  } catch (e) {
    console.error('getDocUrl failed:', e.message);
    return null;
  }
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

// <img> that loads an authed TB resource (for thumbnails / image cells).
export const AuthImg = ({ doc, alt, style, fallback = null }) => {
  const url = useDocUrl(doc);
  if (!url) return fallback;
  return <img src={url} alt={alt || ''} style={style} />;
};
