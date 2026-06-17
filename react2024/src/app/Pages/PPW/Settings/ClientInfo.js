import React, { useEffect, useState } from 'react';
import {
  Box, Typography, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { listClients, createClient } from '../../../Services/app/zumensettings';
import { alertCreated, alertWarning, alertError } from '../ppwAlerts';

const EMPTY = { name: '', company: '', email: '', address: '', city: '', phone: '' };

const getCustomerId = () => {
  try { return JSON.parse(localStorage.getItem('CustomerID')); }
  catch (e) { return localStorage.getItem('CustomerID') || null; }
};

const ClientInfo = () => {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const cid = getCustomerId();

  const load = async () => { try { setRows(await listClients(cid)); } catch (e) { setRows([]); } };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!cid) { alertWarning('No customer', 'Could not determine your customer account.'); return; }
    if (!form.name.trim()) { alertWarning('Name required', 'Enter a client name.'); return; }
    setSaving(true);
    try {
      await createClient(cid, form);
      setOpen(false);
      setForm(EMPTY);
      await load();
      alertCreated('Client added successfully!');
    } catch (e) {
      alertError((e && e.response && e.response.data && e.response.data.message) || (e && e.message) || 'Could not add client.');
    } finally { setSaving(false); }
  };

  if (!rows) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, flexGrow: 1 }}>
          Client info {rows.length ? `(${rows.length})` : ''}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setForm(EMPTY); setOpen(true); }}
          sx={{ textTransform: 'none', bgcolor: '#ec6e17', '&:hover': { bgcolor: '#d65f0e' } }}
        >
          Add client
        </Button>
      </Box>

      <Table size="small" sx={{ maxWidth: 1100 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' } }}>
            <TableCell>Client name</TableCell><TableCell>Company</TableCell><TableCell>Email</TableCell><TableCell>Address</TableCell><TableCell>City</TableCell><TableCell>Phone</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id || c.name || c.title} hover>
              <TableCell>{c.name || c.title || '—'}</TableCell>
              <TableCell>{c.company}</TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>{c.address || c.country}</TableCell>
              <TableCell>{c.city}</TableCell>
              <TableCell>{c.phone}</TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow><TableCell colSpan={6} sx={{ color: '#94a3b8' }}>No clients found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add client</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Client name" required value={form.name} onChange={set('name')} size="small" autoFocus fullWidth />
          <TextField label="Company" value={form.company} onChange={set('company')} size="small" fullWidth />
          <TextField label="Email" value={form.email} onChange={set('email')} size="small" fullWidth />
          <TextField label="Address" value={form.address} onChange={set('address')} size="small" fullWidth />
          <TextField label="City" value={form.city} onChange={set('city')} size="small" fullWidth />
          <TextField label="Phone" value={form.phone} onChange={set('phone')} size="small" fullWidth />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={saving} sx={{ textTransform: 'none', color: '#64748b' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={saving}
            sx={{ textTransform: 'none', bgcolor: '#ec6e17', '&:hover': { bgcolor: '#d65f0e' } }}
          >
            {saving ? 'Adding…' : 'Add client'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientInfo;
