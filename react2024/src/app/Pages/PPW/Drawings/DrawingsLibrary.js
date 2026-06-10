import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Grid, Card, CardActionArea, Typography, TextField, Button, MenuItem,
  ToggleButton, ToggleButtonGroup, Chip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Pagination, Divider, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TagIcon from '@mui/icons-material/Tag';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import {
  getDrawings, getDrawingAttributes, createDrawing, getClients,
} from '../../../Services/app/zumenservice';

const PAGE_SIZE = 24;
const STATUS_COLORS = {
  'New Model': '#3b82f6', 'In Production': '#10b981', Approved: '#10b981',
  Cancelled: '#ef4444', Hold: '#f59e0b',
};
const statusColor = (s) => STATUS_COLORS[s] || '#6b7280';
const isNew = (d) => d.status === 'New Model' ||
  (d.createdTime && Date.now() - d.createdTime < 7 * 864e5);

// Faceted fields shown on the left rail (mirrors demo.zume-n.com).
const FACET_FIELDS = [
  { key: 'drawingNumber', label: 'Drawing number', icon: <TagIcon sx={{ fontSize: 16, color: '#94a3b8' }} /> },
  { key: 'productName', label: 'Product name', icon: <LocalOfferOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} /> },
  { key: 'clientName', label: 'Client name', icon: <BusinessOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} /> },
  { key: 'qualityCheckNo', label: 'Quality Check No.' },
  { key: 'ecNo', label: 'EC NO.' },
  { key: 'project', label: 'Project' },
  { key: 'assemblyNo', label: 'Assembly No.' },
  { key: 'material', label: 'Material' },
];
const emptyFacets = FACET_FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {});

const DrawingsLibrary = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openDrawing = (id) => navigate(`/paperless-factory/drawings/${id}`);

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [facet, setFacet] = useState(() => {
    const p = searchParams.get('product');
    return p ? { ...emptyFacets, productName: p } : emptyFacets;
  });
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');

  const [openCreate, setOpenCreate] = useState(false);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    drawingNumber: '', productName: '', clientId: '', clientName: '',
    status: 'New Model', material: '', processType: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDrawings({ pageSize: PAGE_SIZE, page, textSearch: q });
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
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  const visible = drawings.filter((d) =>
    FACET_FIELDS.every((f) => {
      const v = facet[f.key];
      return !v || (d[f.key] || '').toLowerCase().includes(v.toLowerCase());
    })
  );

  const openCreateDialog = async () => {
    setOpenCreate(true);
    if (clients.length === 0) setClients(await getClients());
  };

  const handleCreate = async () => {
    if (!form.drawingNumber && !form.productName) return;
    setSaving(true);
    try {
      await createDrawing(form);
      setOpenCreate(false);
      setForm({
        drawingNumber: '', productName: '', clientId: '', clientName: '',
        status: 'New Model', material: '', processType: '', notes: '',
      });
      setPage(0);
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Failed to create drawing: ' + (e?.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ pt: 3, px: 2 }}>
      {/* Page header */}
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1f2937' }}>Paperless Factory</Typography>
      <Typography sx={{ color: '#64748b', fontSize: 13, mb: 2 }}>Drawing &amp; document management</Typography>

      {/* Full-width toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Drawings</Typography>
        <Typography sx={{ color: '#64748b', fontSize: 13 }}>
          {totalElements} item(s) &nbsp; {totalPages || 1}page(s)
        </Typography>
        {q && <Chip size="small" label={`search: ${q}`} onDelete={() => { setQ(''); setSearchInput(''); setPage(0); }} />}
        <Box sx={{ flexGrow: 1 }} />
        <TextField size="small" placeholder="Free word search" value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setQ(searchInput.trim()); setPage(0); } }}
          sx={{ width: 240 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} /></InputAdornment> }} />
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(e, v) => v && setView(v)}>
          <ToggleButton value="grid"><ViewModuleIcon fontSize="small" />&nbsp;Preview</ToggleButton>
          <ToggleButton value="list"><ViewListIcon fontSize="small" />&nbsp;List</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="outlined" size="small" sx={{ textTransform: 'none' }}>Bulk Operations</Button>
        <Button variant="contained" size="small" sx={{ bgcolor: '#ec6e17', textTransform: 'none' }}
          onClick={openCreateDialog}>+ Add new drawings</Button>
        <MoreVertIcon sx={{ color: '#94a3b8', cursor: 'pointer' }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Faceted search rail */}
      <Box sx={{ width: 230, flexShrink: 0 }}>
        <Card variant="outlined" sx={{ position: 'sticky', top: 68, p: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Search</Typography>
            <Typography onClick={() => setFacet(emptyFacets)}
              sx={{ fontSize: 12, color: '#ec6e17', cursor: 'pointer' }}>Clear all</Typography>
          </Box>
          {FACET_FIELDS.map((f) => (
            <TextField key={f.key} fullWidth size="small" placeholder={f.label} sx={{ mb: 1 }}
              value={facet[f.key]}
              onChange={(e) => setFacet({ ...facet, [f.key]: e.target.value })}
              InputProps={f.icon ? {
                startAdornment: <InputAdornment position="start">{f.icon}</InputAdornment>,
              } : undefined} />
          ))}
        </Card>
      </Box>

      {/* Main column */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : visible.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: '#64748b' }}>
            <Typography>No drawings found. Click “+ Add new drawings” to create one.</Typography>
          </Box>
        ) : view === 'grid' ? (
          <Grid container spacing={2}>
            {visible.map((d) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={d.id}>
                <Card variant="outlined" sx={{ position: 'relative', '&:hover': { boxShadow: 3 } }}>
                  {isNew(d) && (
                    <Chip label="NEW" size="small" sx={{
                      position: 'absolute', top: 8, right: 8, zIndex: 1, height: 18, fontSize: 10,
                      fontWeight: 700, bgcolor: '#ec6e17', color: '#fff',
                    }} />
                  )}
                  <CardActionArea onClick={() => openDrawing(d.id)}>
                    <Box sx={{
                      height: 190, bgcolor: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'hidden', borderBottom: '1px solid #eef1f4',
                    }}>
                      {d.thumbnailUrl
                        ? <img src={d.thumbnailUrl} alt={d.drawingNumber} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                        : <InsertDriveFileIcon sx={{ fontSize: 64, color: '#dbe2ea' }} />}
                    </Box>
                    <Box sx={{ p: 1.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{d.drawingNumber}</Typography>
                      <Typography sx={{ fontSize: 14, color: '#334155' }}>{d.productName || '—'}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#94a3b8', mt: 0.5 }}>{d.clientName || ''}</Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Drawing number</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Product name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((d) => (
                  <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDrawing(d.id)}>
                    <TableCell sx={{ fontWeight: 600 }}>{d.drawingNumber}</TableCell>
                    <TableCell>{d.productName || '—'}</TableCell>
                    <TableCell>{d.clientName || ''}</TableCell>
                    <TableCell>
                      {d.status && <Chip size="small" label={d.status} sx={{ bgcolor: statusColor(d.status), color: '#fff' }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination count={totalPages} page={page + 1} onChange={(e, p) => setPage(p - 1)} />
          </Box>
        )}
      </Box>

      </Box>

      {/* Create dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Add new drawing</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Drawing number" required
                value={form.drawingNumber} onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Product name"
                value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Client" value={form.clientId}
                onChange={(e) => {
                  const c = clients.find((x) => x.id === e.target.value);
                  setForm({ ...form, clientId: e.target.value, clientName: c ? c.title : '' });
                }}>
                {clients.map((c) => (<MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.keys(STATUS_COLORS).map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Material"
                value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField select fullWidth size="small" label="Process type" value={form.processType}
                onChange={(e) => setForm({ ...form, processType: e.target.value })}>
                {['', 'CNC', 'IMM', 'ASM', 'SPM'].map((p) => (<MenuItem key={p} value={p}>{p || '—'}</MenuItem>))}
              </TextField>
            </Grid>
          </Grid>
          <Divider sx={{ mt: 2 }} />
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Stored in ThingsBoard as a “Drawing” asset with SERVER_SCOPE attributes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={saving || (!form.drawingNumber && !form.productName)}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DrawingsLibrary;
