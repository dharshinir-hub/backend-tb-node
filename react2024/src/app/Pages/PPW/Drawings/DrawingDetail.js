import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, CircularProgress, Tabs, Tab, IconButton,
  Tooltip, TextField, MenuItem, Menu, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CropFreeIcon from '@mui/icons-material/CropFree';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import {
  getDrawingDetail, saveDrawingAttributes, getClients,
  saveRevision, getRevisionHistory, nextRevision,
} from '../../../Services/app/zumenservice';
import HistoryIcon from '@mui/icons-material/History';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import {
  DOCUMENT_TYPES, getDocuments, uploadDocument, deleteDocument, updateDocument,
  getDocumentHistory, getDocUrl, useDocPreview, AuthImg, replaceDocumentFile,
} from '../../../Services/app/zumendocservice';
import DocumentPreview, { kindOf } from './DocumentPreview';
import { alertCreated, alertUpdated, alertSaved, alertDeleted, confirmDelete, alertError, alertWarning } from '../ppwAlerts';
import { getSetting, getConfig } from '../../../Services/app/zumensettings';
import BrandLoader from '../BrandLoader';

const Model3DViewer = React.lazy(() => import('./Model3DViewer'));
const MarkupEditor = React.lazy(() => import('./MarkupEditor'));
const SheetPreview = React.lazy(() => import('./SheetPreview'));
const WordEditor = React.lazy(() => import('./WordEditor'));
const AssemblyTree = React.lazy(() => import('./AssemblyTree'));

const STATUS_COLORS = {
  'New Model': '#3b82f6', 'In Production': '#10b981', Approved: '#10b981',
  Cancelled: '#ef4444', Hold: '#f59e0b',
};
const statusColor = (s) => STATUS_COLORS[s] || '#6b7280';

// Document types that offer "Create" (Excel / Word document) authoring.
const CREATE_TABS = ['customer-list', 'quotation', 'purchase-order', 'inspection-report', 'packing-std', 'defect-report', 'program', 'tools'];
const SHEET6 = ['customer-list', 'quotation', 'purchase-order', 'inspection-report', 'packing-std', 'defect-report'];
const SHEET_FORMATS = ['xlsx', 'xls', 'csv', 'pdf', 'png', 'jpg', 'jpeg', 'docx', 'doc'];

// Allowed upload formats per document type (the tab decides what's accepted).
const DEFAULT_FORMATS = ['png', 'jpg', 'jpeg', 'pdf'];
const FORMATS_BY_TYPE = {
  'work-instruction-video': ['mp4', 'mov', 'webm', 'ogg', 'mkv'],
  video: ['mp4', 'mov', 'webm', 'ogg', 'mkv'],
  '3d-cad': ['step', 'stp', 'stl', 'iges', 'igs', 'brep', 'png', 'jpg', 'jpeg', 'pdf'],
  '2d-cad': ['pdf', 'dwg', 'dxf', 'png', 'jpg', 'jpeg'],
  program: ['nc', 'gcode', 'tap', 'cnc', 'txt', 'png', 'jpg', 'jpeg', 'pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv'],
  ...SHEET6.reduce((a, k) => ({ ...a, [k]: SHEET_FORMATS }), {}),
};
const extOf = (name) => (name.split('.').pop() || '').toLowerCase();
const formatsFor = (typeKey) => FORMATS_BY_TYPE[typeKey] || DEFAULT_FORMATS;
const acceptAttrFor = (typeKey) => formatsFor(typeKey).map((e) => `.${e}`).join(',');
const formatsLabel = (typeKey) => formatsFor(typeKey).map((e) => e.toUpperCase()).join(', ');
const isAcceptedFor = (typeKey, name) => formatsFor(typeKey).includes(extOf(name));

// Read a File's first bytes to tell if it's really an image (handles files saved
// with the wrong extension, e.g. a WebP named *.pdf).
const fileIsImage = (file) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => {
    const b = new Uint8Array(r.result);
    const hex = [...b.slice(0, 4)].map((x) => x.toString(16).padStart(2, '0')).join('');
    const webp = b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; // 'WEBP'
    resolve(
      hex === '89504e47' ||          // PNG
      hex.startsWith('ffd8ff') ||    // JPG
      hex === '47494638' ||          // GIF
      (hex === '52494646' && webp)   // RIFF+WEBP
    );
  };
  r.onerror = () => resolve(false);
  r.readAsArrayBuffer(file.slice(0, 16));
});

// Registry of every field the right-hand info panel can show, and HOW to render it.
// Which of these appear (and their labels / required flags) is driven by the
// "Drawing info settings" + "Drawing detail info" Settings screens.
const PANEL_FIELDS = {
  drawingNumber: { label: 'Drawing number', kind: 'readonly' },
  productName: { label: 'Product name', kind: 'text' },
  clientName: { label: 'Client name', kind: 'client' },
  revision: { label: 'Revision', kind: 'text' },
  status: { label: 'Status', kind: 'status' },
  material: { label: 'Material', kind: 'text' },
  processType: { label: 'Process type', kind: 'text' },
  inventory: { label: 'Inventory / 在庫', kind: 'text' },
  project: { label: 'Project', kind: 'text' },
  assemblyNo: { label: 'Assembly No.', kind: 'text' },
  deliveryDate: { label: 'Delivery date', kind: 'text' },
};
// Fallbacks when the Settings screens haven't been saved yet (mirror their defaults).
const DEFAULT_INFO_FIELDS = ['drawingNumber', 'productName', 'clientName', 'revision', 'status', 'material', 'processType']
  .map((key) => ({ key, label: PANEL_FIELDS[key].label, visible: true, required: false }));
const DEFAULT_DETAIL_FIELDS = ['inventory', 'project', 'assemblyNo', 'deliveryDate']
  .map((key) => ({ key, label: PANEL_FIELDS[key].label, visible: true, required: false }));

// Center preview for the selected file (inline; no modal).
const InlinePreview = ({ doc, rotation = 0 }) => {
  const [text, setText] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fitOverride, setFitOverride] = useState(null); // null = default, else 'contain' | 'cover'
  const [natural, setNatural] = useState(null); // { w, h } natural image size — for the "over the sheet" hit test
  const dragRef = useRef(null);
  const { url, kind: detectedKind } = useDocPreview(doc);
  // Prefer the REAL content type (magic-byte sniff); fall back to the extension.
  const kind = doc ? (detectedKind || kindOf(doc.name)) : null;
  const rot = { transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' };

  // Default to "contain" (unfilled) so the whole image/sheet is always shown
  // without cropping. The Fit/Fill toggle below lets the user fill the box on
  // demand (which crops the edges).
  const fit = fitOverride || 'contain';

  // Reset zoom/pan and fit whenever the previewed file changes.
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setFitOverride(null); setNatural(null); }, [doc]);
  // Scroll the mouse wheel to zoom toward the cursor — but ONLY when the cursor is
  // over the sheet itself. Over the grey margins around it, nothing happens (and the
  // page behind never scrolls).
  const onWheel = (e) => {
    if (kind !== 'image') return;
    e.preventDefault(); // never let the page behind scroll from inside the preview
    const r = e.currentTarget.getBoundingClientRect();
    // Rendered (object-fit: contain) image rectangle, centred and including the
    // current zoom/pan, so we can tell "over the sheet" from "over the margin".
    let dispW = r.width;
    let dispH = r.height;
    if (natural && natural.w && natural.h) {
      const rot = Math.abs(rotation % 360);
      const swap = rot === 90 || rot === 270;
      const nw = swap ? natural.h : natural.w;
      const nh = swap ? natural.w : natural.h;
      const a = nw / nh;
      if (a > r.width / r.height) { dispW = r.width; dispH = r.width / a; }
      else { dispH = r.height; dispW = r.height * a; }
    }
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const cx0 = r.width / 2 + pan.x;
    const cy0 = r.height / 2 + pan.y;
    const halfW = (dispW * zoom) / 2;
    const halfH = (dispH * zoom) / 2;
    const overSheet = px >= cx0 - halfW && px <= cx0 + halfW && py >= cy0 - halfH && py <= cy0 + halfH;
    if (!overSheet) return; // outside the sheet → do nothing
    const cx = e.clientX - r.left - r.width / 2;
    const cy = e.clientY - r.top - r.height / 2;
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom((z) => {
      const nz = Math.min(8, Math.max(0.25, z * f));
      setPan((p) => (nz <= 1 ? { x: 0, y: 0 } : { x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }));
      return nz;
    });
  };
  const onDown = (e) => { if (zoom > 1) { dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; } };
  const onMove = (e) => { if (dragRef.current) setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y }); };
  const endDrag = () => { dragRef.current = null; };
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    if (!doc || kind !== 'text' || !url) { setText(null); return undefined; }
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
  if (!url) {
    return <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress /></Box>;
  }
  if (kind === 'image') {
    // Fill mode = fit the image to the box WIDTH and scroll vertically, so the
    // hidden top/bottom can be viewed (instead of being permanently cropped).
    const filled = fit === 'cover';
    return <Box sx={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Scroll/zoom viewport */}
      <Box
        onWheel={filled ? undefined : onWheel}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={endDrag} onMouseLeave={endDrag}
        onDoubleClick={filled ? undefined : resetZoom}
        sx={{
          height: '100%', width: '100%',
          overflowX: 'hidden', overflowY: filled ? 'auto' : 'hidden',
          cursor: !filled && zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'default',
        }}>
        <img src={url} alt={doc.name} draggable={false}
          onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          style={filled
            ? { display: 'block', width: '100%', height: 'auto', transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }
            : {
              width: '100%', height: '100%', objectFit: 'contain',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: dragRef.current ? 'none' : 'transform 0.12s', transformOrigin: 'center center',
            }} />
      </Box>
      {/* Fit / Fill toggle — Fit shows the whole image (no crop); Fill fits it to
          the width so you can scroll vertically through the hidden top/bottom.
          Kept outside the scroll viewport so it never scrolls out of reach. */}
      <Tooltip title={filled ? 'Filled to width — scroll to see hidden top/bottom; click to fit whole image' : 'Showing whole image — click to fill the width'}>
        <Button size="small" onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setZoom(1); setPan({ x: 0, y: 0 }); setFitOverride(filled ? 'contain' : 'cover'); }}
          startIcon={filled ? <FitScreenIcon sx={{ fontSize: 15 }} /> : <CropFreeIcon sx={{ fontSize: 15 }} />}
          sx={{ position: 'absolute', top: 8, right: 8, minWidth: 0, textTransform: 'none', fontSize: 11, zIndex: 2,
            bgcolor: 'rgba(255,255,255,0.9)', color: '#475569', px: 1, py: 0.25, '&:hover': { bgcolor: '#fff' } }}>
          {filled ? 'Fit' : 'Fill'}
        </Button>
      </Tooltip>
      {!filled && zoom > 1 && <Box sx={{ position: 'absolute', bottom: 8, right: 12, bgcolor: 'rgba(15,23,42,0.78)', color: '#fff', fontSize: 11, px: 1, py: 0.25, borderRadius: 1, pointerEvents: 'none' }}>
        {Math.round(zoom * 100)}% · scroll to zoom · drag to pan · double-click reset
      </Box>}
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
  if (kind === 'sheet') {
    return (
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
        <SheetPreview doc={doc} editable={false} />
      </Suspense>
    );
  }
  if (kind === 'word') {
    return (
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
        <WordEditor doc={doc} editable={false} />
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
      m: 0, p: 2, height: '100%', overflow: 'auto', bgcolor: '#ffffff', color: '#1e293b',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
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
  const location = useLocation();

  const [drawing, setDrawing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [counts, setCounts] = useState({});
  const [searchParams, setSearchParams] = useSearchParams();
  // When opened from an operation (?op=1), this asset is an operation, not the
  // assembly — hide the "Assembly drawing" tab (an operation has no sub-assembly).
  const isOperation = searchParams.get('op') === '1';
  // Document tabs honour the "Document type" Settings screen (hide / rename).
  const [docTypeCfg, setDocTypeCfg] = useState(null);
  const visibleTypes = useMemo(() => {
    let types = DOCUMENT_TYPES.map((t) => {
      const ov = docTypeCfg ? docTypeCfg.find((c) => c.key === t.key) : null;
      return ov ? { ...t, label: ov.label || t.label, _hide: ov.visible === false } : t;
    }).filter((t) => !t._hide);
    if (isOperation) types = types.filter((t) => t.key !== 'assembly-drawing');
    // Never end up with zero tabs (e.g. everything hidden) — fall back to all.
    return types.length ? types : (isOperation ? DOCUMENT_TYPES.filter((t) => t.key !== 'assembly-drawing') : DOCUMENT_TYPES);
  }, [docTypeCfg, isOperation]);
  // Back: for an operation, return to its parent's Operations page (the parent id
  // is carried in the URL so it survives a refresh and never falls back to home).
  const opParent = searchParams.get('parent');
  const backTarget = (isOperation && opParent)
    ? `/paperless-factory/drawings/${opParent}/operations`
    : ((location.state && location.state.from) || '/paperless-factory/drawings');
  const initialTab = Math.max(0, visibleTypes.findIndex((t) => t.key === searchParams.get('tab')));
  const [activeTab, setActiveTab] = useState(initialTab);
  const changeTab = (v) => { setActiveTab(v); setSearchParams((p) => { p.set('tab', visibleTypes[v].key); return p; }, { replace: true }); };
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState({});
  const [savingMeta, setSavingMeta] = useState(false);
  // Info-panel field config from the Settings screens (null until loaded → defaults).
  const [infoFieldCfg, setInfoFieldCfg] = useState(null);
  const [detailFieldCfg, setDetailFieldCfg] = useState(null);
  // Reusable form templates (Settings → Form templates) shown in the Create menu.
  const [formTemplates, setFormTemplates] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarksText, setRemarksText] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeImageUrl, setWriteImageUrl] = useState(null);
  const [sheetEditOpen, setSheetEditOpen] = useState(false);
  const [sheetEditDoc, setSheetEditDoc] = useState(null);
  const [wordEditOpen, setWordEditOpen] = useState(false);
  const [wordEditDoc, setWordEditDoc] = useState(null);
  const [createAnchor, setCreateAnchor] = useState(null);
  const [viewDoc, setViewDoc] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [revRows, setRevRows] = useState([]);
  const [revNote, setRevNote] = useState('');
  const [bumpingRev, setBumpingRev] = useState(false);
  const [snack, setSnack] = useState('');
  const notify = (msg) => setSnack(msg);

  const activeType = visibleTypes[activeTab] || visibleTypes[0];
  const tabDocs = documents.filter((d) => d.docType === activeType.key);
  const selectedDoc = tabDocs.find((d) => d.id === selectedDocId) || tabDocs[0] || null;
  // Real (sniffed) content kind of the selected file — drives the Write button so
  // an image saved with the wrong extension is still markable.
  const { kind: selectedKind } = useDocPreview(selectedDoc);
  const effKind = selectedKind || (selectedDoc && kindOf(selectedDoc.name));
  const selectedIsImage = effKind === 'image';
  const selectedIsSheet = effKind === 'sheet';
  const selectedIsWord = effKind === 'word';

  // Component details encoded into the QR. Kept VERY COMPACT on purpose: a dense QR
  // (lots of text) won't scan from a screen once it's scaled down on the drawing and
  // re-saved. These few core fields keep it a low-density v5 (~37x37) that scans.
  const qrInfo = useMemo(() => {
    if (!drawing) return '';
    const m = meta || {};
    const parts = [
      drawing.name,
      m.productName,
      m.clientName,
      `${m.status || '-'} | Rev ${m.revision || 'A'}`,
      [m.inventory, m.project].filter(Boolean).join(' · '),
    ].filter(Boolean);
    return parts.join('\n');
  }, [drawing, meta]);

  // Which fields the info panel shows (+ labels / required) — driven by Settings.
  const visibleFields = useMemo(() => {
    const info = infoFieldCfg || DEFAULT_INFO_FIELDS;
    const detail = detailFieldCfg || DEFAULT_DETAIL_FIELDS;
    return [...info, ...detail]
      .filter((f) => PANEL_FIELDS[f.key] && f.visible !== false);
  }, [infoFieldCfg, detailFieldCfg]);

  const loadDocs = useCallback(async () => {
    const { documents: docs, counts: c } = await getDocuments(id);
    setDocuments(docs);
    setCounts(c);
  }, [id]);

  // Load the panel field config + form templates from the Settings screens.
  useEffect(() => {
    getSetting('zumenDrawingInfoFields').then((s) => { if (Array.isArray(s)) setInfoFieldCfg(s); }).catch(() => {});
    getSetting('zumenDrawingDetailFields').then((s) => { if (Array.isArray(s)) setDetailFieldCfg(s); }).catch(() => {});
    getSetting('zumenFormTemplates').then((s) => { if (Array.isArray(s)) setFormTemplates(s); }).catch(() => {});
    getConfig().then((c) => { if (c && Array.isArray(c.docTypes)) setDocTypeCfg(c.docTypes); }).catch(() => {});
  }, []);

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
      } catch (e) {
        // Drawing/asset doesn't exist (e.g. a stale URL after it was deleted) →
        // show the friendly "Drawing not found" screen instead of crashing.
        if (alive) setDrawing(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, loadDocs]);

  // Stop the browser from navigating/opening a file dropped anywhere on the page
  // (so a near-miss drop doesn't open the PDF/image in a new tab).
  useEffect(() => {
    const prevent = (e) => { e.preventDefault(); };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  // Auto-set the card thumbnail if this drawing has an image but none saved yet
  // (heals drawings whose image was uploaded with a non-image extension).
  // Skipped when the user has explicitly pinned a file (thumbnailPinned = true).
  useEffect(() => {
    if (selectedIsImage && selectedDoc?.resourceId && !meta.thumbnailResourceId && !meta.thumbnailPinned) {
      saveDrawingAttributes(id, { thumbnailResourceId: selectedDoc.resourceId })
        .then(() => setMeta((m) => ({ ...m, thumbnailResourceId: selectedDoc.resourceId })))
        .catch(() => {});
    }
  }, [selectedIsImage, selectedDoc, meta.thumbnailResourceId, meta.thumbnailPinned, id]);

  // Pin a specific file as the fixed cover image for the Drawings library card.
  const pinThumbnail = async (doc) => {
    try {
      await saveDrawingAttributes(id, { thumbnailResourceId: doc.resourceId, thumbnailPinned: true });
      setMeta((m) => ({ ...m, thumbnailResourceId: doc.resourceId, thumbnailPinned: true }));
    } catch (e) { alertError('Could not pin thumbnail'); }
  };

  // Reset selected file when switching tabs.
  useEffect(() => { setSelectedDocId(null); }, [activeTab]);
  // Reset rotation when the previewed file changes.
  useEffect(() => { setRotation(0); }, [selectedDocId, activeTab]);

  const openRename = (doc) => { setRenameText(doc.name); setRenameOpen(true); };
  const doRename = async () => {
    const name = renameText.trim();
    setRenameOpen(false);
    if (!name || name === selectedDoc.name) return;
    try {
      await updateDocument(id, selectedDoc.id, { name });
      await loadDocs();
      alertUpdated('Renamed successfully!');
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
  };

  // Confirm with the standard popup, then delete.
  const doDelete = async (docId) => {
    if (!docId) return;
    if (!(await confirmDelete())) return;
    try {
      await deleteDocument(id, docId);
      if (selectedDocId === docId) setSelectedDocId(null);
      await loadDocs();
      alertDeleted('File deleted successfully.');
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
  };

  const openRemarks = (doc) => { setRemarksText(doc.remarks || ''); setRemarksOpen(true); };
  const saveRemarks = async () => {
    try {
      await updateDocument(id, selectedDoc.id, { remarks: remarksText });
      setRemarksOpen(false);
      await loadDocs();
      alertUpdated('Remarks saved!');
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
  };

  // Show the full change history (every name/status/remarks edit) for a document.
  const openHistory = async (doc) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryRows([]);
    try {
      const rows = await getDocumentHistory(id, doc.id);
      setHistoryRows(rows);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Download the authed TB-resource blob (object URLs are same-origin).
  const downloadFile = async (doc) => {
    const url = await getDocUrl(doc);
    if (!url) { notify('Could not load file'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Print via a same-origin blob iframe.
  const printFile = async (doc) => {
    const url = await getDocUrl(doc);
    if (!url) { notify('Could not load file'); return; }
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.src = url;
    iframe.onload = () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { notify('Could not print this file'); }
      setTimeout(() => iframe.remove(), 60000);
    };
    document.body.appendChild(iframe);
  };

  // Upload one or many files (used by the picker AND the drag-drop zone).
  const uploadFiles = async (fileList) => {
    let files = Array.from(fileList || []);
    if (!files.length) return;
    // Accept only the formats allowed for the active tab.
    const rejected = files.filter((f) => !isAcceptedFor(activeType.key, f.name));
    files = files.filter((f) => isAcceptedFor(activeType.key, f.name));
    if (rejected.length) {
      notify(`${activeType.label} accepts ${formatsLabel(activeType.key)} — skipped: ${rejected.map((f) => f.name).join(', ')}`);
    }
    if (!files.length) return;
    setUploading(true);
    let lastId = null;
    let firstImageResource = null;
    try {
      for (const file of files) {
        try {
          const reallyImage = await fileIsImage(file);
          const doc = await uploadDocument(id, activeType.key, file);
          lastId = doc.id;
          if (!firstImageResource && reallyImage && !meta.thumbnailResourceId) {
            firstImageResource = doc.resourceId;
          }
        } catch (err) {
          alertError(`${file.name}: ${err.message}`);
        }
      }
      if (firstImageResource) {
        await saveDrawingAttributes(id, { thumbnailResourceId: firstImageResource });
        setMeta((m) => ({ ...m, thumbnailResourceId: firstImageResource }));
      }
      await loadDocs();
      if (lastId) setSelectedDocId(lastId);
      if (lastId) alertCreated(files.length > 1 ? `Uploaded ${files.length} files successfully!` : 'File uploaded successfully!');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e) => {
    // Copy the FileList to an array BEFORE resetting the input — setting value=''
    // empties the live FileList, which would drop the picked files.
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await uploadFiles(files);
  };

  const onDropFiles = async (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) await uploadFiles(e.dataTransfer.files);
  };

  // Value currently held for a panel field (used by both render and validation).
  const fieldValue = (key) => {
    if (key === 'drawingNumber') return drawing?.name || '';
    if (key === 'clientName') return meta.clientName || (meta.clientId ? 'set' : '');
    return meta[key] || '';
  };

  const saveMeta = async () => {
    // Enforce fields the Settings screens marked Required.
    const missing = visibleFields
      .filter((f) => f.required)
      .filter((f) => !String(fieldValue(f.key)).trim())
      .map((f) => f.label || PANEL_FIELDS[f.key].label);
    if (missing.length) {
      alertWarning('Required fields', `Please fill: ${missing.join(', ')}`);
      return;
    }
    setSavingMeta(true);
    try {
      await saveDrawingAttributes(id, meta);
      alertSaved('Details saved successfully!');
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
    finally {
      setSavingMeta(false);
    }
  };

  // Render one info-panel field according to the registry + its Settings config.
  const renderPanelField = (f) => {
    const reg = PANEL_FIELDS[f.key];
    if (!reg) return null;
    const lbl = (
      <Typography sx={{ fontSize: 12, color: '#64748b' }}>
        {f.label || reg.label}{f.required && <Box component="span" sx={{ color: '#ef4444' }}> *</Box>}
      </Typography>
    );
    if (reg.kind === 'readonly') {
      return <Box key={f.key} sx={{ mb: 1.5 }}>{lbl}<TextField fullWidth size="small" value={drawing.name} disabled /></Box>;
    }
    if (reg.kind === 'client') {
      return (
        <Box key={f.key} sx={{ mb: 1.5 }}>{lbl}
          <TextField select fullWidth size="small" value={meta.clientId || ''}
            onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setMeta({ ...meta, clientId: e.target.value, clientName: c ? c.title : meta.clientName }); }}>
            {clients.map((c) => (<MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>))}
          </TextField>
        </Box>
      );
    }
    if (reg.kind === 'status') {
      return (
        <Box key={f.key} sx={{ mb: 1.5 }}>{lbl}
          <TextField select fullWidth size="small" value={meta.status || ''}
            onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
            {Object.keys(STATUS_COLORS).map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
          </TextField>
        </Box>
      );
    }
    return (
      <Box key={f.key} sx={{ mb: 1.5 }}>{lbl}
        <TextField fullWidth size="small" value={meta[f.key] || ''}
          onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })} />
      </Box>
    );
  };

  // ---- revision / version control ----
  const openRevisions = async () => {
    setRevOpen(true);
    setRevRows(await getRevisionHistory(id));
  };
  const bumpRevision = async () => {
    if (bumpingRev) return; // ignore double-clicks
    setBumpingRev(true);
    try {
      // Base the next label on the LATEST recorded revision (not the possibly-stale
      // header value), then refuse to create a label that already exists.
      const latest = (revRows[0] && revRows[0].revision) || meta.revision || '';
      const next = nextRevision(latest);
      if (revRows.some((r) => r.revision === next)) { notify(`Revision ${next} already exists`); return; }
      await saveRevision(id, next, revNote.trim());
      setMeta((m) => ({ ...m, revision: next }));
      setRevNote('');
      setRevRows(await getRevisionHistory(id));
      notify(`Revision ${next} created`);
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
    finally { setBumpingRev(false); }
  };

  // Record a revision from a markup-save note. Best-effort: a failure here must
  // never block the actual file save. Bases the next label on the freshest history.
  const recordMarkupRevision = async (note) => {
    if (!note || !note.trim()) return;
    try {
      const history = await getRevisionHistory(id);
      const latest = (history[0] && history[0].revision) || meta.revision || '';
      const next = nextRevision(latest);
      if (history.some((r) => r.revision === next)) return;
      await saveRevision(id, next, note.trim());
      setMeta((m) => ({ ...m, revision: next }));
      setRevRows(await getRevisionHistory(id));
    } catch (e) { /* revision logging is non-critical */ }
  };

  if (loading) return <BrandLoader height="calc(100vh - 96px)" />;
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
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(backTarget)}
          sx={{ textTransform: 'none', color: '#475569' }}>{isOperation ? 'Back to operations' : (location.state && location.state.from ? 'Back to assembly' : 'Drawings')}</Button>
        <ChevronRightIcon sx={{ fontSize: 16, color: '#cbd5e1' }} />
        <Typography sx={{ fontWeight: 700 }}>{drawing.name}</Typography>
        {meta.status && <Chip size="small" label={meta.status} sx={{ bgcolor: statusColor(meta.status), color: '#fff' }} />}
        <Chip size="small" variant="outlined" label={`Rev ${meta.revision || 'A'}`} onClick={openRevisions}
          sx={{ cursor: 'pointer', borderColor: '#cbd5e1' }} />
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={openRevisions}
          sx={{ textTransform: 'none' }}>Revisions</Button>
        {!isOperation && (
          <Button size="small" variant="outlined" startIcon={<FormatListNumberedIcon />}
            onClick={() => navigate(`/paperless-factory/drawings/${id}/operations`)} sx={{ textTransform: 'none' }}>
            Operations
          </Button>
        )}
      </Box>

      {/* Document-type tabs */}
      <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 1 }}>
        <Tabs value={activeTab} onChange={(e, v) => changeTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 44 }}>
          {visibleTypes.map((t) => {
            const c = counts[t.key] || 0;
            return (
              <Tab key={t.key} sx={{ textTransform: 'none', minHeight: 44, py: 0, fontWeight: 500 }}
                label={c > 0
                  ? <span>{t.label} <span style={{ color: '#94a3b8', fontWeight: 600 }}>({c})</span></span>
                  : t.label} />
            );
          })}
        </Tabs>

        {activeType.key === 'assembly-drawing' ? (
          <Box sx={{ height: 'calc(100vh - 230px)', minHeight: 480, p: 1.5 }}>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
              <AssemblyTree embedded drawingId={id} />
            </Suspense>
          </Box>
        ) : (
        /* 3-column workspace (whole area is a drag-drop zone) */
        <Box
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
          onDrop={onDropFiles}
          sx={{ display: 'flex', height: 'calc(100vh - 230px)', minHeight: 480, position: 'relative',
            outline: dragOver ? '2px dashed #ec6e17' : 'none', outlineOffset: -4,
            bgcolor: dragOver ? '#fff7ed' : 'transparent' }}>
          {dragOver && (
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center',
              justifyContent: 'center', bgcolor: 'rgba(255,247,237,0.85)', pointerEvents: 'none',
              fontWeight: 700, color: '#ec6e17', fontSize: 18 }}>
              Drop to upload to “{activeType.label}” ({formatsLabel(activeType.key)})
            </Box>
          )}
          {/* LEFT: file strip */}
          <Box
            sx={{ width: 150, flexShrink: 0, borderRight: '1px solid #e5e7eb', p: 1, overflowY: 'auto' }}>
            <Button component="label" fullWidth variant="outlined" size="small" startIcon={<AddIcon />}
              disabled={uploading} sx={{ textTransform: 'none', mb: 0.5 }}>
              {uploading ? '…' : 'Add new files'}
              <input type="file" hidden multiple accept={acceptAttrFor(activeType.key)} onChange={handleUpload} />
            </Button>
            {CREATE_TABS.includes(activeType.key) && (
              <Button fullWidth variant="outlined" size="small" startIcon={<AddIcon />}
                onClick={(e) => setCreateAnchor(e.currentTarget)}
                sx={{ textTransform: 'none', mb: 0.5 }}>
                Create file
              </Button>
            )}
            <Menu anchorEl={createAnchor} open={!!createAnchor} onClose={() => setCreateAnchor(null)}>
              <MenuItem onClick={() => { setCreateAnchor(null); setSheetEditDoc({ drawingId: id, docType: activeType.key, name: 'New Sheet.xlsx', isNew: true }); setSheetEditOpen(true); }}>
                📊 Excel document
              </MenuItem>
              <MenuItem onClick={() => { setCreateAnchor(null); setWordEditDoc({ drawingId: id, docType: activeType.key, name: 'New Document.docx', isNew: true }); setWordEditOpen(true); }}>
                📝 Word document
              </MenuItem>
              {/* Enabled form templates (Settings → Form templates) for this tab. */}
              {formTemplates.some((tpl) => tpl.enabled && tpl.docType === activeType.key) && <Divider />}
              {formTemplates.filter((tpl) => tpl.enabled && tpl.docType === activeType.key).map((tpl) => (
                <MenuItem key={tpl.name}
                  onClick={() => { setCreateAnchor(null); setSheetEditDoc({ drawingId: id, docType: activeType.key, name: `${tpl.name}.xlsx`, isNew: true }); setSheetEditOpen(true); }}>
                  📄 {tpl.name}
                </MenuItem>
              ))}
            </Menu>
            <Typography sx={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', mb: 1 }}>{formatsLabel(activeType.key)} · drag &amp; drop</Typography>
            {tabDocs.map((d) => {
              const sel = selectedDoc && d.id === selectedDoc.id;
              // Try to render a thumbnail for image- or pdf-named files (AuthImg
              // falls back to the icon if the bytes aren't a real image).
              const img = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'pdf'].includes(extOf(d.name));
              const isPinned = !!(meta.thumbnailResourceId && d.resourceId && meta.thumbnailResourceId === d.resourceId);
              return (
                <Box key={d.id} onClick={() => setSelectedDocId(d.id)}
                  sx={{
                    border: '1px solid', borderColor: sel ? '#ec6e17' : '#e5e7eb', borderRadius: 1,
                    p: 0.5, mb: 1, cursor: 'pointer', bgcolor: sel ? '#eff6ff' : '#fff',
                  }}>
                  <Box sx={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: '#f8fafc', position: 'relative' }}>
                    {img
                      ? <AuthImg doc={d} alt={d.name}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          fallback={<InsertDriveFileIcon sx={{ fontSize: 32, color: '#cbd5e1' }} />} />
                      : <InsertDriveFileIcon sx={{ fontSize: 32, color: '#cbd5e1' }} />}
                    {img && d.resourceId && (
                      <Tooltip title={isPinned ? 'Cover image (pinned)' : 'Set as cover image'}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); pinThumbnail(d); }}
                          sx={{ position: 'absolute', top: 1, right: 1, padding: '2px', bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: '#fff7ed' } }}>
                          {isPinned
                            ? <StarIcon sx={{ fontSize: 13, color: '#ec6e17' }} />
                            : <StarBorderIcon sx={{ fontSize: 13, color: '#94a3b8' }} />}
                        </IconButton>
                      </Tooltip>
                    )}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderBottom: '1px solid #e5e7eb', minHeight: 40, flexWrap: 'wrap', flexShrink: 0 }}>
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
                  <Button size="small" startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
                    onClick={() => openHistory(selectedDoc)} sx={{ textTransform: 'none', color: '#475569' }}>
                    History
                  </Button>
                  <TextField select size="small" value={selectedDoc.status || 'New Model'}
                    onChange={async (e) => { await updateDocument(id, selectedDoc.id, { status: e.target.value }); await loadDocs(); notify('Status updated'); }}
                    sx={{ ml: 0.5, minWidth: 130, '& .MuiInputBase-input': { py: 0.4, fontSize: 12 } }}>
                    {Object.keys(STATUS_COLORS).map((s) => (<MenuItem key={s} value={s} sx={{ fontSize: 12 }}>{s}</MenuItem>))}
                  </TextField>
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
                  <Button size="small" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                    onClick={() => doDelete(selectedDoc.id)} sx={{ textTransform: 'none' }}>
                    Delete
                  </Button>
                </>
              ) : (
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{activeType.label}</Typography>
              )}
            </Box>

            {/* Preview */}
            <Box sx={{ flexGrow: 1, minHeight: 0, bgcolor: '#f8fafc', overflow: 'hidden' }}>
              <InlinePreview doc={selectedDoc} rotation={rotation} />
            </Box>

            {/* Bottom action bar */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 1.5, py: 0.75, borderTop: '1px solid #e5e7eb', bgcolor: '#fff', flexShrink: 0, flexWrap: 'wrap' }}>
              <Button size="small" startIcon={<BorderColorOutlinedIcon sx={{ fontSize: 16 }} />}
                disabled={!selectedDoc || !(selectedIsImage || selectedIsSheet || selectedIsWord)}
                onClick={async () => {
                  if (selectedIsSheet) { setSheetEditDoc(selectedDoc); setSheetEditOpen(true); return; }
                  if (selectedIsWord) { setWordEditDoc(selectedDoc); setWordEditOpen(true); return; }
                  const u = await getDocUrl(selectedDoc);
                  if (u) { setWriteImageUrl(u); setWriteOpen(true); } else notify('Could not load image');
                }}
                sx={{ textTransform: 'none' }}>Write</Button>
              <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 16 }} />}
                disabled={!selectedDoc} onClick={() => printFile(selectedDoc)} sx={{ textTransform: 'none' }}>Print</Button>
              <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />} disabled={!selectedDoc}
                onClick={() => selectedDoc && downloadFile(selectedDoc)}
                sx={{ textTransform: 'none' }}>Download</Button>
              <Button size="small" variant="contained" startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />}
                disabled={!selectedDoc} onClick={() => setViewDoc(selectedDoc)}
                sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}>View full</Button>
            </Box>
          </Box>

          {/* RIGHT: metadata form — only on the Drawing tab */}
          {activeType.key === 'drawing' && (
          <Box sx={{ width: 300, flexShrink: 0, borderLeft: '1px solid #e5e7eb', p: 2, overflowY: 'auto' }}>
            {visibleFields.map(renderPanelField)}
            <Divider sx={{ my: 1.5 }} />
            <Button fullWidth variant="contained" onClick={saveMeta} disabled={savingMeta}
              sx={{ bgcolor: '#ec6e17', textTransform: 'none' }}>
              {savingMeta ? 'Saving…' : 'Save changes'}
            </Button>
          </Box>
          )}
        </Box>
        )}
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

      {/* Markup editor (Write) */}
      {writeOpen && selectedDoc && writeImageUrl && (
        <Suspense fallback={null}>
          <MarkupEditor
            doc={selectedDoc}
            imageUrl={writeImageUrl}
            qrData={qrInfo}
            onClose={() => setWriteOpen(false)}
            onSaved={async () => { setWriteOpen(false); await loadDocs(); }}
            uploadAnnotated={async (blob, name, summary, note) => {
              // "Save to existing file": replace the current file in place so its
              // history stays continuous, logging what was added (stamp / QR / …).
              await replaceDocumentFile(id, selectedDoc.id, blob, name, `Markup edited: ${summary}${note ? ` — ${note}` : ''}`);
              await recordMarkupRevision(note);
              await loadDocs();
            }}
            saveAnnotatedAsNew={async (blob, name, summary, note) => {
              // "Save as new file": add a separate file in the same document tab,
              // leaving the original untouched.
              const file = new File([blob], name, { type: 'image/png' });
              await uploadDocument(id, selectedDoc.docType || activeType?.key, file, name, `Markup (new file): ${summary}${note ? ` — ${note}` : ''}`);
              await recordMarkupRevision(note);
              await loadDocs();
            }}
          />
        </Suspense>
      )}

      {/* Spreadsheet editor (Write on a sheet, or Create a new file) */}
      <Dialog open={sheetEditOpen} onClose={() => { setSheetEditOpen(false); setSheetEditDoc(null); loadDocs(); }} fullScreen>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 1 }}>
          {sheetEditDoc?.isNew ? (
            <TextField variant="standard" autoFocus size="small" placeholder="File name"
              value={sheetEditDoc.name}
              onChange={(e) => setSheetEditDoc((d) => ({ ...d, name: e.target.value }))}
              sx={{ flexGrow: 1, maxWidth: 420, '& input': { fontWeight: 700, fontSize: 17 } }}
              InputProps={{ endAdornment: <EditOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} /> }} />
          ) : (
            <Typography sx={{ fontWeight: 700, fontSize: 17 }} noWrap>{sheetEditDoc?.name}</Typography>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {sheetEditOpen && sheetEditDoc && (
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}>
              <SheetPreview doc={sheetEditDoc} editable
                onClose={() => { setSheetEditOpen(false); setSheetEditDoc(null); loadDocs(); }}
                onCreated={async (newDoc) => { await loadDocs(); setSelectedDocId(newDoc.id); setSheetEditDoc(newDoc); notify('File created'); }} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      {/* Word document editor (Create / Write on a .docx) */}
      <Dialog open={wordEditOpen} onClose={() => { setWordEditOpen(false); setWordEditDoc(null); loadDocs(); }} fullScreen>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 1 }}>
          {wordEditDoc?.isNew ? (
            <TextField variant="standard" autoFocus size="small" placeholder="File name"
              value={wordEditDoc.name}
              onChange={(e) => setWordEditDoc((d) => ({ ...d, name: e.target.value }))}
              sx={{ flexGrow: 1, maxWidth: 420, '& input': { fontWeight: 700, fontSize: 17 } }}
              InputProps={{ endAdornment: <EditOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} /> }} />
          ) : (
            <Typography sx={{ fontWeight: 700, fontSize: 17 }} noWrap>{wordEditDoc?.name}</Typography>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {wordEditOpen && wordEditDoc && (
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}>
              <WordEditor doc={wordEditDoc} editable
                onClose={() => { setWordEditOpen(false); setWordEditDoc(null); loadDocs(); }}
                onCreated={async (newDoc) => { await loadDocs(); setSelectedDocId(newDoc.id); setWordEditDoc(newDoc); notify('File created'); }} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Change-history dialog (reads the doc's telemetry snapshots) */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Change history — {selectedDoc?.name}</DialogTitle>
        <DialogContent dividers>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
          ) : historyRows.length === 0 ? (
            <Typography sx={{ color: '#94a3b8', py: 2 }}>No change history yet.</Typography>
          ) : (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <Box component="thead">
                <Box component="tr" sx={{ '& th': { textAlign: 'left', py: 0.75, px: 1, borderBottom: '2px solid #e5e7eb', color: '#64748b', fontWeight: 600 } }}>
                  <th>When</th><th>Action</th><th>Status</th><th>Remarks</th><th>By</th>
                </Box>
              </Box>
              <Box component="tbody">
                {historyRows.map((r, i) => {
                  // Last row in the list (oldest) is the original upload.
                  const action = r.action || (i === historyRows.length - 1 ? 'Uploaded' : 'Edited');
                  return (
                  <Box component="tr" key={r.ts || i} sx={{ '& td': { py: 0.75, px: 1, borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' } }}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.ts ? new Date(r.ts).toLocaleString() : '—'}{i === 0 && <Chip size="small" label="current" sx={{ ml: 0.5, height: 18, fontSize: 10, bgcolor: '#10b981', color: '#fff' }} />}</td>
                    <td style={{ fontWeight: 600, color: '#1f2937' }}>{action}</td>
                    <td>{r.status ? <Chip size="small" label={r.status} sx={{ height: 20, bgcolor: statusColor(r.status), color: '#fff' }} /> : '—'}</td>
                    <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{r.remarks || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.changedBy || '—'}</td>
                  </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Revision / version control dialog */}
      <Dialog open={revOpen} onClose={() => setRevOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Revisions — current Rev {meta.revision || 'A'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField size="small" fullWidth placeholder="Note for the new revision (optional)"
              value={revNote} onChange={(e) => setRevNote(e.target.value)} />
            <Button variant="contained" disabled={bumpingRev} sx={{ bgcolor: '#ec6e17', whiteSpace: 'nowrap' }} onClick={bumpRevision}>
              {bumpingRev ? 'Saving…' : `New Rev ${nextRevision((revRows[0] && revRows[0].revision) || meta.revision || '')}`}
            </Button>
          </Box>
          {revRows.length === 0 ? (
            <Typography sx={{ color: '#94a3b8' }}>No revisions recorded yet.</Typography>
          ) : (
            // Keep only ONE revision on view — the current/latest.
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <Box component="tbody">
                <Box component="tr" sx={{ '& td': { py: 0.75, px: 1 } }}>
                  <td><Chip size="small" label={`Rev ${revRows[0].revision || '—'}`} sx={{ bgcolor: '#10b981', color: '#fff' }} /></td>
                  <td>{revRows[0].note || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{revRows[0].by || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: '#94a3b8' }}>{revRows[0].ts ? new Date(revRows[0].ts).toLocaleString() : ''}</td>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* In-app full-screen viewer (no new browser tab) */}
      <DocumentPreview doc={viewDoc} onClose={() => setViewDoc(null)} />

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default DrawingDetail;
