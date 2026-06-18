import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, IconButton, Tooltip, CircularProgress, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Card, CardActions, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import classNames from 'classnames';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LaunchIcon from '@mui/icons-material/Launch';
import { getDrawingDetail, getOperations, saveOperations, createOperationAsset, removeBomLink, deleteDrawing } from '../../../Services/app/zumenservice';
import BrandLoader from '../BrandLoader';
import { alertCreated, alertUpdated, alertDeleted, confirmDelete, alertError, alertWarning } from '../ppwAlerts';
import '../../Componentregistration/componentreg.css'; // reuse the shared registration-page styles

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `op${Date.now()}${Math.floor(Math.random() * 1e6)}`);

// Common operation names for the quick-pick datalist.
const COMMON_OPS = ['Turning', 'Milling', 'Drilling', 'Boring', 'Grinding', 'Tapping', 'Reaming', 'Hobbing', 'Heat treatment', 'Deburring', 'Welding', 'Assembly', 'Inspection', 'Packing'];

// ---- hh:mm:ss helpers (times are stored as "hh:mm:ss" strings) ----
const secToHms = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const normHms = (v) => {
  if (!v) return '';
  const p = String(v).split(':');
  while (p.length < 3) p.push('00');
  return p.slice(0, 3).map((x) => String(parseInt(x, 10) || 0).padStart(2, '0')).join(':');
};

const blankForm = (no = '') => ({ no, name: '', cycle: '', handling: '', setup: '', remarks: '' });

const OperationSequence = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ops, setOps] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [opening, setOpening] = useState(null); // op id whose document page is being opened

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, list] = await Promise.all([getDrawingDetail(id), getOperations(id)]);
      setName(detail.name || '');
      const norm = (o, i) => ({
        id: o.id || uid(),
        no: o.no != null ? String(o.no) : String((i + 1) * 10),
        name: o.name || '',
        cycle: o.cycle || (o.cycleTime ? secToHms((Number(o.cycleTime) || 0) * 60) : ''),
        handling: o.handling || '',
        setup: o.setup || (o.setupTime ? secToHms((Number(o.setupTime) || 0) * 60) : ''),
        remarks: o.remarks || '',
        assetId: o.assetId || null,
      });
      setOps((Array.isArray(list) ? list : []).map(norm));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const persist = async (newOps) => {
    setOps(newOps);
    try { await saveOperations(id, newOps); return true; }
    catch (e) { alertError(e?.response?.data?.message || e.message); return false; }
  };

  const openAdd = () => { setEditingId(null); setForm(blankForm()); setDialogOpen(true); };
  const openEdit = (op) => { setEditingId(op.id); setForm({ no: op.no, name: op.name, cycle: op.cycle, handling: op.handling, setup: op.setup, remarks: op.remarks }); setDialogOpen(true); };

  const saveDialog = async () => {
    if (!String(form.no).trim() || !form.name.trim()) { alertWarning('Missing fields', 'Operation number and name are required.'); return; }
    const existing = editingId ? ops.find((o) => o.id === editingId) : null;
    const op = {
      id: editingId || uid(),
      no: String(form.no).trim(),
      name: form.name.trim(),
      cycle: normHms(form.cycle),
      handling: normHms(form.handling),
      setup: normHms(form.setup),
      remarks: form.remarks.trim(),
      assetId: existing ? (existing.assetId || null) : null,
    };
    const wasEdit = !!editingId;
    // New operation → create its backing child asset + link it under this drawing,
    // so it shows as a connected node in the main drawing's Assembly drawing.
    // Non-fatal: if it fails, the asset is created lazily when its documents open.
    if (!wasEdit) {
      try { op.assetId = await createOperationAsset(id, { no: op.no, name: op.name, parentName: name }); }
      catch (e) { /* lazy-create on first open */ }
    }
    const newOps = editingId ? ops.map((o) => (o.id === editingId ? op : o)) : [...ops, op];
    setDialogOpen(false);
    const ok = await persist(newOps);
    if (ok) { if (wasEdit) alertUpdated(); else alertCreated('Operation added successfully!'); }
  };
  const removeOp = async (opId) => {
    if (!(await confirmDelete())) return;
    const op = ops.find((o) => o.id === opId);
    const ok = await persist(ops.filter((o) => o.id !== opId));
    if (ok) {
      if (op && op.assetId) { try { await removeBomLink(id, op.assetId); await deleteDrawing(op.assetId); } catch (e) { /* best-effort cleanup */ } }
      alertDeleted('Operation deleted successfully.');
    }
  };

  // Redirect to this operation's own document page (all tabs except Assembly
  // drawing). Lazily creates + links the backing asset if it doesn't exist yet.
  const openDocs = async (op) => {
    let assetId = op.assetId;
    if (!assetId) {
      setOpening(op.id);
      try {
        assetId = await createOperationAsset(id, { no: op.no, name: op.name, parentName: name });
        await persist(ops.map((o) => (o.id === op.id ? { ...o, assetId } : o)));
      } catch (e) { alertError(e?.response?.data?.message || e.message); setOpening(null); return; }
      setOpening(null);
    }
    navigate(`/paperless-factory/drawings/${assetId}?op=1&parent=${id}`, { state: { from: `/paperless-factory/drawings/${id}/operations` } });
  };

  const sorted = [...ops].sort((a, b) => (parseFloat(a.no) || 0) - (parseFloat(b.no) || 0));
  const filtered = sorted.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (o.name || '').toLowerCase().includes(q) || String(o.no || '').toLowerCase().includes(q);
  });
  const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const curPage = Math.min(page, maxPage);
  const paged = filtered.slice(curPage * rowsPerPage, curPage * rowsPerPage + rowsPerPage);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const zebra = (i) => classNames({ 'odd-row': i % 2 !== 0, 'even-row': i % 2 === 0 });

  return (
    <div className="pages" style={{ paddingLeft: '10px' }}>
      <div className="pagecontents">
        <div className="left-labels" style={{ alignItems: 'center' }}>
          <div className="shift-content" style={{ alignItems: 'center', margin: 0 }}>
            <IconButton size="small" onClick={() => navigate(`/paperless-factory/drawings/${id}`)}><ArrowBackIcon /></IconButton>
            <h5 style={{ margin: 0, fontSize: 20, fontWeight: 600, fontFamily: 'Mulish, sans-serif' }}>Operations / Routing — {name}</h5>
            <div className="add_new">
              <Tooltip title="Add operation">
                <IconButton className="circle" onClick={openAdd}><AddIcon /></IconButton>
              </Tooltip>
            </div>
            <span style={{ color: '#6b7280', fontSize: 14, whiteSpace: 'nowrap' }}>{ops.length} step(s)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TextField
              label="Search operation name or number"
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              InputLabelProps={{ sx: { color: 'black', '&.Mui-focused': { color: 'orange' } } }}
              sx={{ minWidth: 300 }}
            />
          </div>
        </div>

        <Card className="card_sec">
          <div className="example-container">
            <Table stickyHeader aria-label="operations table">
              <TableHead>
                <TableRow>
                  <TableCell>Op. No.</TableCell>
                  <TableCell>Operation</TableCell>
                  <TableCell>Cycle Time</TableCell>
                  <TableCell>Handling Time</TableCell>
                  <TableCell>Setup Time</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" style={{ padding: 0 }}><BrandLoader height={260} label="Loading operations…" /></TableCell>
                  </TableRow>
                ) : paged.length > 0 ? (
                  paged.map((o, index) => (
                    <TableRow key={o.id}>
                      <TableCell className={zebra(index)}>{o.no || '---'}</TableCell>
                      <TableCell className={zebra(index)}>{o.name || '---'}</TableCell>
                      <TableCell className={zebra(index)}>{o.cycle || '---'}</TableCell>
                      <TableCell className={zebra(index)}>{o.handling || '---'}</TableCell>
                      <TableCell className={zebra(index)}>{o.setup || '---'}</TableCell>
                      <TableCell className={zebra(index)}>{o.remarks || '---'}</TableCell>
                      <TableCell className={zebra(index)}>
                        <Tooltip title="Open documents (drawing, work instructions, CAD…)">
                          <span><IconButton onClick={() => openDocs(o)} disabled={opening === o.id}>
                            {opening === o.id ? <CircularProgress size={18} /> : <LaunchIcon sx={{ color: '#ec6e17' }} />}
                          </IconButton></span>
                        </Tooltip>
                        <Tooltip title="Edit"><IconButton onClick={() => openEdit(o)}><EditIcon sx={{ color: 'black' }} /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton onClick={() => removeOp(o.id)}><DeleteIcon sx={{ color: 'black' }} /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" style={{ padding: '20px', background: '#EDEDED', fontSize: '1rem', letterSpacing: '0.02rem' }}>
                      {query ? 'No Results found' : 'No operations yet. Click the + to build the routing.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <CardActions sx={{ px: 2, justifyContent: 'end', background: '#dddddd' }}>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filtered.length}
              rowsPerPage={rowsPerPage}
              page={curPage}
              onPageChange={(e, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="Items per page"
            />
          </CardActions>
        </Card>
      </div>

      {/* Add / Edit operation dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId ? 'Edit operation' : 'Add operation'}</DialogTitle>
        <DialogContent>
          <datalist id="op-names">{COMMON_OPS.map((o) => <option key={o} value={o} />)}</datalist>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 1 }}>
            <TextField label="Operation Number" required value={form.no} onChange={set('no')} placeholder="e.g. 10" />
            <TextField label="Operation Name" required value={form.name} onChange={set('name')}
              placeholder="e.g. Turning" inputProps={{ list: 'op-names' }} sx={{ gridColumn: 'span 2' }} />
            <TextField label="Cycle Time" type="time" value={form.cycle} onChange={set('cycle')}
              InputLabelProps={{ shrink: true }} inputProps={{ step: 1 }} />
            <TextField label="Handling Time" type="time" value={form.handling} onChange={set('handling')}
              InputLabelProps={{ shrink: true }} inputProps={{ step: 1 }} />
            <TextField label="Setup Time" type="time" value={form.setup} onChange={set('setup')}
              InputLabelProps={{ shrink: true }} inputProps={{ step: 1 }} />
            <TextField label="Remarks" value={form.remarks} onChange={set('remarks')}
              multiline minRows={2} sx={{ gridColumn: '1 / -1' }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', color: '#475569' }}>Cancel</Button>
          <Button variant="contained" onClick={saveDialog} sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}>Save</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default OperationSequence;
