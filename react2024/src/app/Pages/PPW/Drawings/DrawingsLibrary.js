import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Grid, Card, CardActionArea, Typography, TextField, Button, MenuItem,
  ToggleButton, ToggleButtonGroup, Chip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Pagination, Divider, InputAdornment, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FiberNewOutlinedIcon from '@mui/icons-material/FiberNewOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { AuthImg } from '../../../Services/app/zumendocservice';
import {
  getDrawings, getDrawingAttributes, createDrawing, getClients,
  deleteDrawing, saveDrawingAttributes,
} from '../../../Services/app/zumenservice';
import { alertCreated, alertUpdated, alertDeleted, confirmDelete, alertError, alertWarning } from '../ppwAlerts';
import { useT } from '../../../Shared/i18n/zumeni18n';

const PAGE_SIZE = 24;
const STATUS_COLORS = {
  'New Model': '#3b82f6', 'In Production': '#10b981', Approved: '#0ea5e9',
  Cancelled: '#ef4444', Hold: '#f59e0b',
};
const statusColor = (s) => STATUS_COLORS[s] || '#6b7280';
const isNew = (d) => d.status === 'New Model' || (d.createdTime && Date.now() - d.createdTime < 7 * 864e5);
const STATUS_TABS = ['All', 'New Model', 'In Production', 'Approved', 'Hold', 'Cancelled'];

const EMPTY_FORM = {
  drawingNumber: '', productName: '', clientId: '', clientName: '',
  status: 'New Model', material: '', processType: '', notes: '',
};

const DrawingsLibrary = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const openDrawing = (id) => navigate(`/paperless-factory/drawings/${id}`);

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch] = useState(searchParams.get('product') || '');
  const [statusTab, setStatusTab] = useState('All');

  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDrawings({ pageSize: PAGE_SIZE, page });
      const assets = res.data || [];
      const enriched = await Promise.all(assets.map(async (a) => {
        const attrs = await getDrawingAttributes(a.id.id);
        return {
          id: a.id.id, drawingNumber: a.name, productName: a.label || attrs.productName || '',
          createdTime: a.createdTime, ...attrs,
        };
      }));
      setDrawings(enriched);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || enriched.length);
    } finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  // KPI tiles (computed from the loaded page; total uses the server count).
  const stats = useMemo(() => {
    const by = (s) => drawings.filter((d) => d.status === s).length;
    return {
      total: totalElements,
      inProduction: by('In Production'),
      approved: by('Approved'),
      newModel: by('New Model'),
      hold: by('Hold'),
      clients: new Set(drawings.map((d) => d.clientName).filter(Boolean)).size,
    };
  }, [drawings, totalElements]);
  const KPIS = [
    { label: 'Total drawings', value: stats.total, color: '#6366f1', icon: <FolderOpenOutlinedIcon /> },
    { label: 'In production', value: stats.inProduction, color: '#10b981', icon: <PrecisionManufacturingOutlinedIcon /> },
    { label: 'Approved', value: stats.approved, color: '#0ea5e9', icon: <CheckCircleOutlineIcon /> },
    { label: 'New model', value: stats.newModel, color: '#3b82f6', icon: <FiberNewOutlinedIcon /> },
    { label: 'On hold', value: stats.hold, color: '#f59e0b', icon: <PauseCircleOutlineIcon /> },
    { label: 'Clients', value: stats.clients, color: '#a855f7', icon: <GroupsOutlinedIcon /> },
  ];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drawings.filter((d) => {
      if (statusTab !== 'All' && d.status !== statusTab) return false;
      if (!q) return true;
      return ['drawingNumber', 'productName', 'clientName', 'project', 'material', 'assemblyNo']
        .some((k) => (d[k] || '').toLowerCase().includes(q));
    });
  }, [drawings, search, statusTab]);

  // ---- bulk ----
  const toggleBulk = () => { setBulkMode((m) => !m); setSelected(new Set()); };
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = visible.length > 0 && visible.every((d) => selected.has(d.id));
  const toggleSelectAll = () => setSelected(() => allVisibleSelected ? new Set() : new Set(visible.map((d) => d.id)));

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!(await confirmDelete(`This will permanently delete ${selected.size} drawing(s).`))) return;
    setBulkBusy(true);
    try {
      for (const id of selected) { try { await deleteDrawing(id); } catch (e) { /* skip */ } }
      setSelected(new Set()); setBulkMode(false);
      await load();
      alertDeleted(`${selected.size} drawing(s) deleted.`);
    } finally { setBulkBusy(false); }
  };
  const bulkSetStatus = async (status) => {
    if (!status || !selected.size) return;
    setBulkBusy(true);
    try {
      for (const id of selected) { try { await saveDrawingAttributes(id, { status }); } catch (e) { /* skip */ } }
      await load();
      alertUpdated(`Status “${status}” applied to ${selected.size} drawing(s).`);
    } finally { setBulkBusy(false); }
  };

  // ---- create ----
  const openCreateDialog = async () => {
    setOpenCreate(true);
    if (clients.length === 0) setClients(await getClients());
  };
  const handleCreate = async () => {
    if (!form.drawingNumber && !form.productName) { alertWarning('Missing fields', 'Enter a drawing number or product name.'); return; }
    setSaving(true);
    try {
      await createDrawing(form);
      setOpenCreate(false);
      setForm(EMPTY_FORM);
      setPage(0);
      await load();
      alertCreated('Drawing created successfully!');
    } catch (e) {
      alertError(e?.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f6f7f9', minHeight: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', rowGap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>{t('ppw.title')}</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 13 }}>{t('ppw.subtitle')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}
            sx={{ bgcolor: '#ec6e17', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#d65f0e' } }}>
            Add new drawings
          </Button>
        </Box>
      </Box>

      {/* KPI cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {KPIS.map((k) => (
          <Grid item xs={6} sm={4} md={2} key={k.label}>
            <Card variant="outlined" sx={{ borderRadius: 2.5, p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, height: '100%' }}>
              <Avatar variant="rounded" sx={{ bgcolor: `${k.color}1a`, color: k.color, width: 44, height: 44 }}>{k.icon}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{k.value}</Typography>
                <Typography sx={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{k.label}</Typography>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Toolbar */}
      <Card variant="outlined" sx={{ borderRadius: 2.5, p: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{t('drawings')}</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>{visible.length} of {totalElements}</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <TextField size="small" placeholder="Search number, product, client…" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ width: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} /></InputAdornment> }} />
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(e, v) => v && setView(v)}>
            <ToggleButton value="grid" sx={{ textTransform: 'none' }}><ViewModuleIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="list" sx={{ textTransform: 'none' }}><ViewListIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
          <Button variant={bulkMode ? 'contained' : 'outlined'} size="small"
            sx={{ textTransform: 'none', ...(bulkMode && { bgcolor: '#475569' }) }} onClick={toggleBulk}>
            {bulkMode ? t('bulk.done') : t('bulk.ops')}
          </Button>
        </Box>

        {/* Status quick-filters */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5, flexWrap: 'wrap' }}>
          {STATUS_TABS.map((s) => {
            const active = statusTab === s;
            const c = s === 'All' ? '#475569' : statusColor(s);
            return (
              <Chip key={s} label={s} size="small" onClick={() => setStatusTab(s)}
                sx={{ fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? c : '#e2e8f0'}`,
                  bgcolor: active ? c : '#fff', color: active ? '#fff' : '#475569',
                  '&:hover': { bgcolor: active ? c : '#f1f5f9' } }} />
            );
          })}
        </Box>
      </Card>

      {/* Bulk action bar */}
      {bulkMode && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, p: 1, px: 1.5, bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2 }}>
          <Checkbox size="small" checked={allVisibleSelected} indeterminate={selected.size > 0 && !allVisibleSelected} onChange={toggleSelectAll} />
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <TextField select size="small" label="Set status" sx={{ minWidth: 160 }} value=""
            disabled={!selected.size || bulkBusy} onChange={(e) => bulkSetStatus(e.target.value)}>
            {Object.keys(STATUS_COLORS).map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
          </TextField>
          <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineIcon />}
            disabled={!selected.size || bulkBusy} onClick={bulkDelete} sx={{ textTransform: 'none' }}>Delete</Button>
        </Box>
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>
      ) : visible.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 2.5, textAlign: 'center', py: 8, color: '#64748b' }}>
          <FolderOpenOutlinedIcon sx={{ fontSize: 54, color: '#cbd5e1' }} />
          <Typography sx={{ mt: 1 }}>No drawings found{search || statusTab !== 'All' ? ' for this filter.' : '. Click “Add new drawings” to create one.'}</Typography>
        </Card>
      ) : view === 'grid' ? (
        <Grid container spacing={2}>
          {visible.map((d) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={d.id}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, position: 'relative', overflow: 'hidden', transition: 'box-shadow .15s, transform .15s',
                '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                ...(bulkMode && selected.has(d.id) && { outline: '2px solid #ec6e17' }) }}>
                {bulkMode && (
                  <Checkbox size="small" checked={selected.has(d.id)} onChange={() => toggleSel(d.id)}
                    sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2, bgcolor: '#fff', borderRadius: 1, p: 0.25 }} />
                )}
                {isNew(d) && (
                  <Chip label="NEW" size="small" sx={{ position: 'absolute', top: 8, left: bulkMode ? 40 : 8, zIndex: 1, height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#ec6e17', color: '#fff' }} />
                )}
                {d.status && (
                  <Chip label={d.status} size="small" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, height: 20, fontSize: 10, fontWeight: 700, bgcolor: statusColor(d.status), color: '#fff' }} />
                )}
                <CardActionArea onClick={() => bulkMode ? toggleSel(d.id) : openDrawing(d.id)}>
                  <Box sx={{ height: 180, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderBottom: '1px solid #eef1f4' }}>
                    {d.thumbnailResourceId
                      ? <AuthImg doc={{ resourceId: d.thumbnailResourceId }} alt={d.drawingNumber}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          fallback={<InsertDriveFileIcon sx={{ fontSize: 60, color: '#dbe2ea' }} />} />
                      : <InsertDriveFileIcon sx={{ fontSize: 60, color: '#dbe2ea' }} />}
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }} noWrap>{d.drawingNumber}</Typography>
                    <Typography sx={{ fontSize: 13.5, color: '#334155' }} noWrap>{d.productName || '—'}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
                      <Typography sx={{ fontSize: 12, color: '#94a3b8' }} noWrap>{d.clientName || '—'}</Typography>
                      {d.revision && <Chip label={`Rev ${d.revision}`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                    </Box>
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5 }}>
          <Table size="small" sx={{ '& tbody td': { py: 1.25 } }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow sx={{ '& th': { fontWeight: 700, color: '#334155' } }}>
                {bulkMode && (
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={allVisibleSelected} indeterminate={selected.size > 0 && !allVisibleSelected} onChange={toggleSelectAll} />
                  </TableCell>
                )}
                <TableCell>Drawing number</TableCell>
                <TableCell>Product name</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Material</TableCell>
                <TableCell>Rev</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((d) => (
                <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} selected={bulkMode && selected.has(d.id)}
                  onClick={() => bulkMode ? toggleSel(d.id) : openDrawing(d.id)}>
                  {bulkMode && (
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.has(d.id)} onChange={() => toggleSel(d.id)} />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{d.drawingNumber}</TableCell>
                  <TableCell>{d.productName || '—'}</TableCell>
                  <TableCell>{d.clientName || '—'}</TableCell>
                  <TableCell sx={{ color: d.material ? 'inherit' : '#cbd5e1' }}>{d.material || '—'}</TableCell>
                  <TableCell>{d.revision || 'A'}</TableCell>
                  <TableCell>{d.status && <Chip size="small" label={d.status} sx={{ bgcolor: statusColor(d.status), color: '#fff', fontWeight: 600 }} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={totalPages} page={page + 1} onChange={(e, p) => setPage(p - 1)} shape="rounded" />
        </Box>
      )}

      {/* Create dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add new drawing</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={6}><TextField fullWidth size="small" label="Drawing number" required value={form.drawingNumber} onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Product name" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Client" value={form.clientId}
                onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setForm({ ...form, clientId: e.target.value, clientName: c ? c.title : '' }); }}>
                {clients.map((c) => (<MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.keys(STATUS_COLORS).map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Material" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Process type" value={form.processType} onChange={(e) => setForm({ ...form, processType: e.target.value })}>
                {['', 'CNC', 'IMM', 'ASM', 'SPM'].map((p) => (<MenuItem key={p} value={p}>{p || '—'}</MenuItem>))}
              </TextField>
            </Grid>
          </Grid>
          <Divider sx={{ mt: 2 }} />
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>Stored in ThingsBoard as a “Drawing” asset with SERVER_SCOPE attributes.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || (!form.drawingNumber && !form.productName)}
            sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}>{saving ? 'Saving…' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DrawingsLibrary;
