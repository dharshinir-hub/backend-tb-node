import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, CircularProgress, Stepper, Step, StepLabel,
  StepButton, TextField, Divider, Snackbar, IconButton, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  ORDER_STAGES, STAGE_COLORS, getOrderById, saveOrderAttributes,
  updateOrderStatus, deleteOrder,
} from '../../../Services/app/zumenorderservice';
import { alertUpdated, alertSaved, alertDeleted, confirmDelete, alertError } from '../ppwAlerts';

const stageColor = (s) => STAGE_COLORS[s] || '#6b7280';

const FIELDS = [
  { key: 'clientName', label: 'Client name' },
  { key: 'drawingNumber', label: 'Drawing number' },
  { key: 'productName', label: 'Product' },
  { key: 'poNumber', label: 'PO number' },
  { key: 'quotationNumber', label: 'Quotation No.' },
  { key: 'quotationVolume', label: 'Volume' },
  { key: 'unit', label: 'Unit' },
  { key: 'unitPrice', label: 'Unit price' },
  { key: 'deliveryDate', label: 'Delivery date', type: 'date' },
];

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [snack, setSnack] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const o = await getOrderById(id); setOrder(o); setForm(o); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const activeStep = order ? ORDER_STAGES.indexOf(order.status) : -1;

  const moveStage = async (s) => {
    try {
      await updateOrderStatus(id, s);
      setOrder((o) => ({ ...o, status: s }));
      alertUpdated(`Moved to “${s}”`);
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
  };

  const saveFields = async () => {
    setSaving(true);
    try { await saveOrderAttributes(id, form); setOrder((o) => ({ ...o, ...form })); alertSaved('Saved successfully!'); }
    catch (e) { alertError(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const removeOrder = async () => {
    if (!(await confirmDelete())) return;
    try {
      await deleteOrder(id);
      await alertDeleted('Order deleted successfully.');
      navigate('/paperless-factory/orders');
    } catch (e) { alertError(e?.response?.data?.message || e.message); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!order) return <Box sx={{ p: 3 }}>Order not found.</Box>;

  return (
    <Box sx={{ pt: 2, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton size="small" onClick={() => navigate('/paperless-factory/orders')}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{order.quotationNumber || order.name}</Typography>
        <Chip size="small" label={order.status} sx={{ bgcolor: stageColor(order.status), color: '#fff' }} />
        <Box sx={{ flexGrow: 1 }} />
        {order.drawingId && (
          <Tooltip title="Open linked drawing">
            <IconButton size="small" onClick={() => navigate(`/paperless-factory/drawings/${order.drawingId}`)}><OpenInNewIcon /></IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete order"><IconButton size="small" color="error" onClick={removeOrder}><DeleteOutlineIcon /></IconButton></Tooltip>
      </Box>

      {/* Lifecycle stepper — click any stage to move the order there */}
      <Box sx={{ overflowX: 'auto', py: 2, border: '1px solid #e5e7eb', borderRadius: 1, mb: 2 }}>
        <Stepper nonLinear activeStep={activeStep} alternativeLabel sx={{ minWidth: 1100 }}>
          {ORDER_STAGES.map((s, i) => (
            <Step key={s} completed={i < activeStep}>
              <StepButton onClick={() => moveStage(s)}>
                <StepLabel>{s}</StepLabel>
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Editable order fields */}
      <Typography sx={{ fontWeight: 600, mb: 1 }}>Order details</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, maxWidth: 800 }}>
        {FIELDS.map((f) => (
          <TextField key={f.key} label={f.label} size="small" type={f.type || 'text'}
            InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
            value={form[f.key] || ''} onChange={set(f.key)} />
        ))}
      </Box>
      <TextField label="Notes" size="small" fullWidth multiline rows={3} sx={{ mt: 1.5, maxWidth: 800 }}
        value={form.notes || ''} onChange={set('notes')} />
      <Divider sx={{ my: 2 }} />
      <Button variant="contained" sx={{ bgcolor: '#ec6e17' }} disabled={saving} onClick={saveFields}>
        {saving ? 'Saving…' : 'Save details'}
      </Button>

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default OrderDetail;
