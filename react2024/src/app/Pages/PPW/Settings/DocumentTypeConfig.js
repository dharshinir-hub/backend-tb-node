import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Switch, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Chip,
} from '@mui/material';
import { DOCUMENT_TYPES } from '../../../Services/app/zumendocservice';
import { getConfig, saveConfig } from '../../../Services/app/zumensettings';
import { alertSaved, alertError } from '../ppwAlerts';

const CATEGORY = {
  drawing: 'CAD / Drawing', 'assembly-drawing': 'CAD / Drawing', '2d-cad': 'CAD / Drawing', '3d-cad': 'CAD / Drawing',
  'work-instruction-video': 'Video', video: 'Video', 'work-instruction-details': 'Document',
  'customer-list': 'Spreadsheet', quotation: 'Spreadsheet', 'purchase-order': 'Spreadsheet',
  'inspection-report': 'Spreadsheet', 'defect-report': 'Spreadsheet', 'packing-std': 'Spreadsheet',
  tools: 'Reference', 'product-sample': 'Reference', program: 'Program',
};
const catColor = (c) => ({ 'CAD / Drawing': '#ec6e17', Video: '#ef4444', Document: '#3b82f6', Spreadsheet: '#16a34a', Reference: '#8b5cf6', Program: '#0ea5e9' }[c] || '#64748b');

const DocumentTypeConfig = () => {
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      let cfg = null;
      try { cfg = await getConfig(); } catch (e) { /* defaults */ }
      const saved = cfg && Array.isArray(cfg.docTypes) ? cfg.docTypes : null;
      setRows(DOCUMENT_TYPES.map((t) => {
        const ov = saved ? saved.find((s) => s.key === t.key) : null;
        return { key: t.key, label: (ov && ov.label) || t.label, visible: !(ov && ov.visible === false) };
      }));
    })();
  }, []);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try { await saveConfig({ docTypes: rows }); alertSaved('Document type settings saved.'); }
    catch (e) { alertError(e.message); }
    finally { setSaving(false); }
  };

  if (!rows) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, flexGrow: 1 }}>Document type</Typography>
        <Button variant="contained" disabled={saving} onClick={save} sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
      <Typography sx={{ color: '#64748b', fontSize: 13, mb: 2 }}>
        Rename a document tab or hide it from drawings. Saved to ThingsBoard (live hide/show wiring into the drawing tabs is a follow-up).
      </Typography>
      <Table size="small" sx={{ maxWidth: 820 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' } }}>
            <TableCell>Document type</TableCell><TableCell>Category</TableCell><TableCell>Key</TableCell><TableCell align="center">Visible</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.key} hover>
              <TableCell>
                <TextField size="small" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} sx={{ minWidth: 240 }} />
              </TableCell>
              <TableCell>
                <Chip size="small" label={CATEGORY[r.key] || 'Other'} sx={{ bgcolor: `${catColor(CATEGORY[r.key])}18`, color: catColor(CATEGORY[r.key]), fontWeight: 600, fontSize: 11 }} />
              </TableCell>
              <TableCell sx={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>{r.key}</TableCell>
              <TableCell align="center">
                <Switch checked={r.visible} onChange={(e) => setRow(i, { visible: e.target.checked })}
                  sx={{ '& .Mui-checked': { color: '#ec6e17' }, '& .Mui-checked+.MuiSwitch-track': { bgcolor: '#ec6e17' } }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default DocumentTypeConfig;
