import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, CircularProgress, Tabs, Tab, TextField,
  MenuItem, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import {
  ORDER_STAGES, STAGE_COLORS, getOrders, createOrder,
} from '../../../Services/app/zumenorderservice';
import { getDrawings, getClients } from '../../../Services/app/zumenservice';
import { alertCreated, alertWarning, alertError } from '../ppwAlerts';
import { useT, LangToggle } from '../../../Shared/i18n/zumeni18n';

const stageColor = (s) => STAGE_COLORS[s] || '#6b7280';
const fmtDate = (v) => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString(); };
const txt = (v) => (v != null && String(v).trim() !== '' ? v : '—');
const num = (v) => (v != null && String(v).trim() !== '' ? Number(v).toLocaleString() : '—');

// Column registry — each stage shows its own relevant columns (mirrors demo Zumen).
const COLUMNS = {
  status: { label: 'Status', render: (o) => <Chip size="small" label={o.status} sx={{ bgcolor: stageColor(o.status), color: '#fff', fontWeight: 600 }} /> },
  client: { label: 'Client name', render: (o) => txt(o.clientName) },
  drawing: { label: 'Drawing number', render: (o) => txt(o.drawingNumber) },
  product: { label: 'Product name', render: (o) => txt(o.productName || o.label) },
  delivery: { label: 'Delivery date', render: (o) => fmtDate(o.deliveryDate) },
  quotationNo: { label: 'Quotation Number', render: (o) => txt(o.quotationNumber || o.name) },
  volume: { label: 'Quotation Volume', align: 'right', render: (o) => txt(o.quotationVolume) },
  unit: { label: 'Unit', render: (o) => txt(o.unit) },
  unitPrice: { label: 'Quot. unit price', align: 'right', render: (o) => num(o.unitPrice) },
  po: { label: 'Purchase Order', render: (o) => txt(o.poNumber) },
  poNumber: { label: 'PO number', render: (o) => txt(o.poNumber) },
  remarks: { label: 'Quotation remarks', render: (o) => txt(o.notes) },
  ordQty: { label: 'Ord. Qty.', align: 'right', render: (o) => txt(o.quotationVolume) },
};
const DEFAULT_COLS = ['status', 'client', 'drawing', 'delivery', 'quotationNo', 'volume', 'unit', 'unitPrice'];
const STAGE_COLS = {
  'Pre Quotation': ['status', 'client', 'drawing', 'po', 'product'],
  'Post Quotation': ['status', 'client', 'drawing', 'quotationNo', 'volume', 'unit', 'unitPrice', 'remarks'],
  'In Production': ['status', 'client', 'drawing', 'remarks', 'po', 'delivery', 'product', 'poNumber'],
  Delivered: ['status', 'client', 'drawing', 'delivery', 'remarks', 'po', 'product', 'ordQty'],
  Lost: ['status', 'client', 'drawing', 'quotationNo', 'volume', 'unit', 'unitPrice', 'po'],
};
const colsFor = (stage) => STAGE_COLS[stage] || DEFAULT_COLS;

const EMPTY_FORM = {
  quotationNumber: '', clientId: '', clientName: '', drawingId: '', drawingNumber: '',
  productName: '', status: 'Prototype', deliveryDate: '', quotationVolume: '', unit: 'pcs',
  unitPrice: '', poNumber: '', notes: '',
};

const ProjectsOrders = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('All');
  const [q, setQ] = useState('');
  const [snack, setSnack] = useState('');

  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clients, setClients] = useState([]);
  const [drawings, setDrawings] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders(await getOrders()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Counts per stage for the filter-tab badges.
  const counts = ORDER_STAGES.reduce((a, s) => ({ ...a, [s]: 0 }), {});
  orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });

  const visible = orders.filter((o) => {
    if (stage !== 'All' && o.status !== stage) return false;
    if (!q) return true;
    const hay = `${o.quotationNumber} ${o.clientName} ${o.drawingNumber} ${o.productName} ${o.poNumber}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const openDialog = async () => {
    setOpenCreate(true);
    if (!clients.length) setClients(await getClients());
    if (!drawings.length) {
      const res = await getDrawings({ pageSize: 200 });
      setDrawings((res.data || []).map((a) => ({ id: a.id.id, number: a.name, product: a.label || '' })));
    }
  };

  const handleCreate = async () => {
    if (!form.quotationNumber && !form.drawingNumber) { alertWarning('Missing fields', 'Enter a quotation number or pick a drawing.'); return; }
    setSaving(true);
    try {
      await createOrder(form);
      setOpenCreate(false);
      setForm(EMPTY_FORM);
      await load();
      alertCreated('Project created successfully!');
    } catch (e) {
      alertError(e?.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Box sx={{ pt: 3, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1f2937' }}>{t('orders.title')}</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 13, mb: 2 }}>{t('orders.subtitle')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <LangToggle />
          <Button variant="outlined" startIcon={<DescriptionOutlinedIcon />} sx={{ textTransform: 'none' }}
            onClick={() => setSnack(`${orders.length} order(s) — report export coming soon`)}>
            {t('orders.reportList')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}
            onClick={openDialog}>
            {t('orders.new')}
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <TextField size="small" placeholder="Search quotation / client / drawing / PO"
        value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1, width: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }} />

      {/* Stage pipeline tabs */}
      <Tabs value={stage} onChange={(_, v) => setStage(v)} variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: 13 } }}>
        <Tab value="All" label={`All (${orders.length})`} />
        {ORDER_STAGES.map((s) => (
          <Tab key={s} value={s} label={`${s} (${counts[s] || 0})`} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (() => {
        const cols = colsFor(stage);
        const totalValue = visible.reduce((s, o) => s + (Number(o.quotationVolume || 0) * Number(o.unitPrice || 0)), 0);
        return (
          <>
            {/* Stats strip */}
            <Box sx={{ display: 'flex', gap: 1.5, my: 1.5, flexWrap: 'wrap' }}>
              {[
                { label: stage === 'All' ? 'Total projects' : `${stage}`, value: visible.length },
                { label: 'Quotation value', value: totalValue ? `₹ ${totalValue.toLocaleString()}` : '—' },
                { label: 'Clients', value: new Set(visible.map((o) => o.clientName).filter(Boolean)).size },
              ].map((s) => (
                <Paper key={s.label} variant="outlined" sx={{ px: 2, py: 1, minWidth: 150, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>{s.value}</Typography>
                </Paper>
              ))}
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, boxShadow: 'none' }}>
              <Table size="small" sx={{ '& td, & th': { borderColor: '#eef1f4' } }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc', whiteSpace: 'nowrap', py: 1.2 } }}>
                    {cols.map((k) => (<TableCell key={k} align={COLUMNS[k].align || 'left'}>{COLUMNS[k].label}</TableCell>))}
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow><TableCell colSpan={cols.length + 1} align="center" sx={{ color: '#94a3b8', py: 5 }}>No orders in this stage.</TableCell></TableRow>
                  ) : visible.map((o) => (
                    <TableRow key={o.id} hover sx={{ cursor: 'pointer', '&:nth-of-type(even)': { bgcolor: '#fcfdfe' } }}
                      onClick={() => navigate(`/paperless-factory/orders/${o.id}`)}>
                      {cols.map((k) => (<TableCell key={k} align={COLUMNS[k].align || 'left'} sx={{ whiteSpace: 'nowrap' }}>{COLUMNS[k].render(o)}</TableCell>))}
                      <TableCell align="right">
                        <Button size="small" sx={{ textTransform: 'none' }} onClick={(e) => { e.stopPropagation(); navigate(`/paperless-factory/orders/${o.id}`); }}>Detail</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        );
      })()}

      {/* New project dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>New project / order</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
            <TextField label="Quotation No." size="small" value={form.quotationNumber} onChange={set('quotationNumber')} />
            <TextField label="PO Number" size="small" value={form.poNumber} onChange={set('poNumber')} />
            <TextField select label="Client" size="small" value={form.clientId}
              onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, clientId: e.target.value, clientName: c?.title || '' })); }}>
              {clients.map((c) => (<MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>))}
            </TextField>
            <TextField select label="Drawing" size="small" value={form.drawingId}
              onChange={(e) => { const d = drawings.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, drawingId: e.target.value, drawingNumber: d?.number || '', productName: d?.product || '' })); }}>
              {drawings.map((d) => (<MenuItem key={d.id} value={d.id}>{d.number} — {d.product}</MenuItem>))}
            </TextField>
            <TextField select label="Status" size="small" value={form.status} onChange={set('status')}>
              {ORDER_STAGES.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
            </TextField>
            <TextField label="Delivery date" type="date" size="small" InputLabelProps={{ shrink: true }} value={form.deliveryDate} onChange={set('deliveryDate')} />
            <TextField label="Volume (qty)" type="number" size="small" value={form.quotationVolume} onChange={set('quotationVolume')} />
            <TextField select label="Unit (measure)" size="small" value={form.unit} onChange={set('unit')}>
              {['pcs', 'nos', 'set', 'kg', 'g', 'ton', 'box', 'lot', 'sheet', 'm', 'cm', 'mm', 'L'].map((u) => (
                <MenuItem key={u} value={u}>{u}</MenuItem>
              ))}
            </TextField>
            <TextField label="Unit price" type="number" size="small" value={form.unitPrice} onChange={set('unitPrice')} />
          </Box>
          <TextField label="Notes" size="small" fullWidth multiline rows={2} sx={{ mt: 1.5 }} value={form.notes} onChange={set('notes')} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: '#ec6e17' }} disabled={saving} onClick={handleCreate}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default ProjectsOrders;
