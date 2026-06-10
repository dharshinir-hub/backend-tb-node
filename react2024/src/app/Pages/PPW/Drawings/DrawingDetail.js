import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, CircularProgress, Tabs, Tab, Badge, IconButton,
  Tooltip, TextField, MenuItem, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import LinkIcon from '@mui/icons-material/Link';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import {
  getDrawingDetail, saveDrawingAttributes, getClients,
} from '../../../Services/app/zumenservice';
import {
  DOCUMENT_TYPES, getDocuments, uploadDocument, deleteDocument, updateDocument, fileUrl,
} from '../../../Services/app/zumendocservice';
import { kindOf } from './DocumentPreview';

const Model3DViewer = React.lazy(() => import('./Model3DViewer'));
const MarkupEditor = React.lazy(() => import('./MarkupEditor'));

const STATUS_COLORS = {
  'New Model': '#3b82f6', 'In Production': '#10b981', Approved: '#10b981',
  Cancelled: '#ef4444', Hold: '#f59e0b',
};
const statusColor = (s) => STATUS_COLORS[s] || '#6b7280';

// Right-hand metadata form fields (mirrors demo.zume-n.com side panel).
const META_FIELDS = [
  { key: 'qualityCheckNo', label: 'Quality Check No.' },
  { key: 'inspectionSheet', label: 'Inspection report spread sheet' },
  { key: 'ecNo', label: 'EC NO.' },
  { key: 'excelSheet', label: 'Excel Spread sheet' },
  { key: 'inventory', label: 'Inventory / 在庫' },
  { key: 'project', label: 'Project' },
  { key: 'assemblyNo', label: 'Assembly No.' },
  { key: 'deliveryDate', label: 'Delivery date' },
];

// Center preview for the selected file (inline; no modal).
const InlinePreview = ({ doc, rotation = 0 }) => {
  const [text, setText] = useState(null);
  const url = doc ? fileUrl(doc) : '';
  const kind = doc ? kindOf(doc.name) : null;
  const rot = { transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' };

  useEffect(() => {
    if (!doc || kind !== 'text') { setText(null); return undefined; }
    let alive = true;
    fetch(url).then((r) => r.text())
      .then((t) => { if (alive) setText(t.slice(0, 200000)); })
      .catch(() => { if (alive) setText('(could not load file)'); });
    return () => { alive = false; };
  }, [doc, url, kind]);

  if (!doc) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <InsertDriveFileIcon sx={{ fontSize: 64, mb: 1 }} />
        <Typography>Select or upload a file to preview it here.</Typography>
      </Box>
    );
  }
  if (kind === 'image') {
    return <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1 }}>
      <img src={url} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', ...rot }} />
    </Box>;
  }
  if (kind === 'pdf') {
    return <iframe title={doc.name} src={url} style={{ width: '100%', height: '100%', border: 'none', ...rot }} />;
  }
  if (kind === '3d') {
    return (
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
        <Model3DViewer url={url} name={doc.name} />
      </Suspense>
    );
  }
  if (kind === 'video') {
    return <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <video src={url} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </Box>;
  }
  if (kind === 'text') {
    return <Box component="pre" sx={{
      m: 0, p: 2, height: '100%', overflow: 'auto', bgcolor: '#0b1020', color: '#e2e8f0',
      fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>{text ?? 'Loading…'}</Box>;
  }
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
      <InsertDriveFileIcon sx={{ fontSize: 56, mb: 1 }} />
      <Typography>No in-app preview for .{doc.name.split('.').pop()} files.</Typography>
      <Button variant="contained" startIcon={<DownloadIcon />} component="a" href={url} target="_blank"
        rel="noreferrer" sx={{ mt: 1, textTransform: 'none' }}>Download to open</Button>
    </Box>
  );
};

const DrawingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [drawing, setDrawing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [counts, setCounts] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState({});
  const [savingMeta, setSavingMeta] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarksText, setRemarksText] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [writeOpen, setWriteOpen] = useState(false);
  const [snack, setSnack] = useState('');
  const notify = (msg) => setSnack(msg);

  const activeType = DOCUMENT_TYPES[activeTab];
  const tabDocs = documents.filter((d) => d.docType === activeType.key);
  const selectedDoc = tabDocs.find((d) => d.id === selectedDocId) || tabDocs[0] || null;

  const loadDocs = useCallback(async () => {
    const { documents: docs, counts: c } = await getDocuments(id);
    setDocuments(docs);
    setCounts(c);
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [detail, cl] = await Promise.all([getDrawingDetail(id), getClients(), loadDocs()]);
        if (!alive) return;
        setDrawing(detail);
        setMeta({ productName: detail.label || detail.attributes?.productName || '', ...detail.attributes });
        setClients(cl);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, loadDocs]);

  // Reset selected file when switching tabs.
  useEffect(() => { setSelectedDocId(null); }, [activeTab]);
  // Reset rotation when the previewed file changes.
  useEffect(() => { setRotation(0); }, [selectedDocId, activeTab]);

  const openRename = (doc) => { setRenameText(doc.name); setRenameOpen(true); };
  const doRename = async () => {
    const name = renameText.trim();
    setRenameOpen(false);
    if (!name || name === selectedDoc.name) return;
    await updateDocument(selectedDoc.id, { name });
    await loadDocs();
  };

  const doDelete = async () => {
    const docId = deleteTarget;
    setDeleteTarget(null);
    if (!docId) return;
    await deleteDocument(docId);
    if (selectedDocId === docId) setSelectedDocId(null);
    await loadDocs();
  };

  const openRemarks = (doc) => { setRemarksText(doc.remarks || ''); setRemarksOpen(true); };
  const saveRemarks = async () => {
    await updateDocument(selectedDoc.id, { remarks: remarksText });
    setRemarksOpen(false);
    await loadDocs();
  };

  // Force a real download (the file is cross-origin, so a plain <a download> is
  // ignored by the browser — fetch it as a blob and download that instead).
  const downloadFile = async (doc) => {
    try {
      const res = await fetch(fileUrl(doc));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      notify('Download failed: ' + err.message);
    }
  };

  // Print via a same-origin blob iframe (cross-origin iframes can't be printed).
  const printFile = async (doc) => {
    try {
      const res = await fetch(fileUrl(doc));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      iframe.src = url;
      iframe.onload = () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { notify('Could not print this file'); }
        setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url); }, 60000);
      };
      document.body.appendChild(iframe);
    } catch (err) {
      notify('Print failed: ' + err.message);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const doc = await uploadDocument(id, activeType.key, file);
      if (kindOf(doc.name) === 'image' && !meta.thumbnailUrl) {
        const thumb = fileUrl(doc);
        await saveDrawingAttributes(id, { thumbnailUrl: thumb });
        setMeta((m) => ({ ...m, thumbnailUrl: thumb }));
      }
      await loadDocs();
      setSelectedDocId(doc.id);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await saveDrawingAttributes(id, meta);
    } finally {
      setSavingMeta(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!drawing) {
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/paperless-factory/drawings')}>Back</Button>
        <Typography sx={{ mt: 2 }}>Drawing not found.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 3, px: 2 }}>
      {/* Breadcrumb */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/paperless-factory/drawings')}
          sx={{ textTransform: 'none', color: '#475569' }}>Drawings</Button>
        <ChevronRightIcon sx={{ fontSize: 16, color: '#cbd5e1' }} />
        <Typography sx={{ fontWeight: 700 }}>{drawing.name}</Typography>
        {meta.status && <Chip size="small" label={meta.status} sx={{ bgcolor: statusColor(meta.status), color: '#fff' }} />}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" startIcon={<AccountTreeIcon />}
          onClick={() => navigate(`/paperless-factory/drawings/${id}/assembly`)} sx={{ textTransform: 'none' }}>
          Assembly hierarchy
        </Button>
      </Box>

      {/* Document-type tabs */}
      <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 1 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 44 }}>
          {DOCUMENT_TYPES.map((t) => (
            <Tab key={t.key} sx={{ textTransform: 'none', minHeight: 44, py: 0 }}
              label={(
                <Badge color="primary" badgeContent={counts[t.key] || 0} showZero={false}
                  sx={{ '& .MuiBadge-badge': { right: -12, top: 6 } }}>
                  {t.label}
                </Badge>
              )} />
          ))}
        </Tabs>

        {/* 3-column workspace */}
        <Box sx={{ display: 'flex', height: 'calc(100vh - 230px)', minHeight: 480 }}>
          {/* LEFT: file strip */}
          <Box sx={{ width: 150, flexShrink: 0, borderRight: '1px solid #e5e7eb', p: 1, overflowY: 'auto' }}>
            <Button component="label" fullWidth variant="outlined" size="small" startIcon={<AddIcon />}
              disabled={uploading} sx={{ textTransform: 'none', mb: 1 }}>
              {uploading ? '…' : 'Add new files'}
              <input type="file" hidden onChange={handleUpload} />
            </Button>
            {tabDocs.map((d) => {
              const sel = selectedDoc && d.id === selectedDoc.id;
              const img = kindOf(d.name) === 'image';
              return (
                <Box key={d.id} onClick={() => setSelectedDocId(d.id)}
                  sx={{
                    border: '1px solid', borderColor: sel ? '#ec6e17' : '#e5e7eb', borderRadius: 1,
                    p: 0.5, mb: 1, cursor: 'pointer', bgcolor: sel ? '#eff6ff' : '#fff',
                  }}>
                  <Box sx={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: '#f8fafc' }}>
                    {img
                      ? <img src={fileUrl(d)} alt={d.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                      : <InsertDriveFileIcon sx={{ fontSize: 32, color: '#cbd5e1' }} />}
                  </Box>
                  <Typography sx={{ fontSize: 10, mt: 0.5, color: '#64748b' }} noWrap>{d.name}</Typography>
                  <Typography sx={{ fontSize: 9, color: '#94a3b8' }}>
                    {new Date(d.uploadedAt).toLocaleDateString()}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* CENTER: preview */}
          <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* File toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderBottom: '1px solid #e5e7eb', minHeight: 40, flexWrap: 'wrap' }}>
              {selectedDoc ? (
                <>
                  <Typography sx={{ fontSize: 12, color: '#94a3b8', mr: 0.5 }}>
                    {new Date(selectedDoc.uploadedAt).toLocaleDateString()}
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>{selectedDoc.name}</Typography>
                  <Tooltip title="Rename"><IconButton size="small" onClick={() => openRename(selectedDoc)}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                  <Button size="small" startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />}
                    onClick={() => openRemarks(selectedDoc)} sx={{ textTransform: 'none', color: '#475569' }}>
                    Remarks{selectedDoc.remarks ? ' (1)' : ''}
                  </Button>
                  <Button size="small" startIcon={<Rotate90DegreesCwIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setRotation((r) => (r + 90) % 360)} sx={{ textTransform: 'none', color: '#475569' }}>
                    Rotate
                  </Button>
                  <Button size="small" startIcon={<FindInPageOutlinedIcon sx={{ fontSize: 16 }} />}
                    onClick={() => navigate(`/paperless-factory/drawings?product=${encodeURIComponent(meta.productName || drawing.label || '')}`)}
                    sx={{ textTransform: 'none', color: '#475569' }}>
                    Similar drawings
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button size="small" startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
                    onClick={() => notify('Project linking — coming soon')} sx={{ textTransform: 'none', color: '#475569' }}>
                    Project for this file
                  </Button>
                  <Button size="small" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setDeleteTarget(selectedDoc.id)} sx={{ textTransform: 'none' }}>
                    Delete
                  </Button>
                </>
              ) : (
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{activeType.label}</Typography>
              )}
            </Box>

            {/* Preview */}
            <Box sx={{ flexGrow: 1, minHeight: 0, bgcolor: '#f8fafc' }}>
              <InlinePreview doc={selectedDoc} rotation={rotation} />
            </Box>

            {/* Bottom action bar */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 1.5, py: 0.75, borderTop: '1px solid #e5e7eb', bgcolor: '#fff' }}>
              <Button size="small" startIcon={<BorderColorOutlinedIcon sx={{ fontSize: 16 }} />}
                disabled={!selectedDoc || kindOf(selectedDoc.name) !== 'image'}
                onClick={() => setWriteOpen(true)}
                sx={{ textTransform: 'none' }}>Write</Button>
              <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 16 }} />}
                disabled={!selectedDoc} onClick={() => printFile(selectedDoc)} sx={{ textTransform: 'none' }}>Print</Button>
              <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />} disabled={!selectedDoc}
                onClick={() => selectedDoc && downloadFile(selectedDoc)}
                sx={{ textTransform: 'none' }}>Download</Button>
              <Button size="small" variant="contained" startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />}
                disabled={!selectedDoc} onClick={() => selectedDoc && window.open(fileUrl(selectedDoc), '_blank')}
                sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}>View PDF</Button>
            </Box>
          </Box>

          {/* RIGHT: metadata form */}
          <Box sx={{ width: 300, flexShrink: 0, borderLeft: '1px solid #e5e7eb', p: 2, overflowY: 'auto' }}>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Drawing number</Typography>
            <TextField fullWidth size="small" value={drawing.name} disabled sx={{ mb: 1.5 }} />

            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Product name</Typography>
            <TextField fullWidth size="small" value={meta.productName || ''} sx={{ mb: 1.5 }}
              onChange={(e) => setMeta({ ...meta, productName: e.target.value })} />

            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Client name</Typography>
            <TextField select fullWidth size="small" value={meta.clientId || ''} sx={{ mb: 1.5 }}
              onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value);
                setMeta({ ...meta, clientId: e.target.value, clientName: c ? c.title : meta.clientName });
              }}>
              {clients.map((c) => (<MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>))}
            </TextField>

            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Status</Typography>
            <TextField select fullWidth size="small" value={meta.status || ''} sx={{ mb: 1.5 }}
              onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
              {Object.keys(STATUS_COLORS).map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
            </TextField>

            {META_FIELDS.map((f) => (
              <Box key={f.key} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: '#64748b' }}>{f.label}</Typography>
                <TextField fullWidth size="small" value={meta[f.key] || ''}
                  onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })} />
              </Box>
            ))}

            <Divider sx={{ my: 1.5 }} />
            <Button fullWidth variant="contained" onClick={saveMeta} disabled={savingMeta}
              sx={{ bgcolor: '#ec6e17', textTransform: 'none' }}>
              {savingMeta ? 'Saving…' : 'Save changes'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Rename file</DialogTitle>
        <DialogContent>
          <TextField fullWidth autoFocus size="small" value={renameText} sx={{ mt: 1 }}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doRename(); }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: '#ec6e17' }} onClick={doRename}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Delete file?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            This will permanently remove the file. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={doDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Markup editor (Write) */}
      {writeOpen && selectedDoc && (
        <Suspense fallback={null}>
          <MarkupEditor
            doc={selectedDoc}
            imageUrl={fileUrl(selectedDoc)}
            onClose={() => setWriteOpen(false)}
            onSaved={async () => { setWriteOpen(false); await loadDocs(); }}
            uploadAnnotated={async (blob, name) => {
              const f = new File([blob], name, { type: 'image/png' });
              return uploadDocument(id, activeType.key, f);
            }}
          />
        </Suspense>
      )}

      {/* Remarks dialog */}
      <Dialog open={remarksOpen} onClose={() => setRemarksOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Remarks — {selectedDoc?.name}</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={4} placeholder="Add a remark for this file"
            value={remarksText} onChange={(e) => setRemarksText(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemarksOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: '#ec6e17' }} onClick={saveRemarks}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default DrawingDetail;
