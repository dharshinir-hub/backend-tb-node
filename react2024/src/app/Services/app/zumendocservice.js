// zumendocservice.js
// Per-drawing document store. Files live in zumen_backend (blobs that TB can't
// hold); the drawing entity + metadata live in ThingsBoard (see zumenservice.js).

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

const docBase = () =>
  (window._env_.ZUMEN_DOC_URL || 'http://localhost:5000/').replace(/\/$/, '');

// Absolute URL to a stored file (fileUrl is a relative /uploads/... path).
export const fileUrl = (doc) => `${docBase()}${doc.fileUrl}`;

// All documents for a drawing + per-type counts: { documents, counts }.
export const getDocuments = async (drawingId) => {
  try {
    const res = await fetch(`${docBase()}/api/zumen/documents/${drawingId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('getDocuments failed:', error.message);
    return { documents: [], counts: {} };
  }
};

export const uploadDocument = async (drawingId, docTypeKey, file, name) => {
  const form = new FormData();
  form.append('file', file);
  if (name) form.append('name', name);
  const res = await fetch(
    `${docBase()}/api/zumen/documents/${drawingId}/${docTypeKey}`,
    { method: 'POST', body: form }
  );
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `Upload failed (HTTP ${res.status})`);
  }
  return res.json();
};

export const updateDocument = async (docId, patch) => {
  const res = await fetch(`${docBase()}/api/zumen/documents/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update failed (HTTP ${res.status})`);
  return res.json();
};

export const deleteDocument = async (docId) => {
  const res = await fetch(`${docBase()}/api/zumen/documents/${docId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
  return res.json();
};
