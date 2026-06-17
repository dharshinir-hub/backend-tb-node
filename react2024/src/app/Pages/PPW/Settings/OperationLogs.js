import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import { getAuditLogs } from '../../../Services/app/zumensettings';

const fmt = (ms) => { try { return new Date(ms).toLocaleString(); } catch (e) { return String(ms); } };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toMs = (s, end) => { if (!s) return undefined; const t = new Date(`${s}T${end ? '23:59:59' : '00:00:00'}`); return t.getTime(); };

const OperationLogs = () => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const [from, setFrom] = useState(ymd(weekAgo));
  const [to, setTo] = useState(ymd(now));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setRows(await getAuditLogs({ pageSize: 50, startTime: toMs(from), endTime: toMs(to, true) })); }
    catch (e) {
      setRows([]);
      const code = e && e.response && e.response.status;
      setErr(code === 403 ? 'Operation logs need additional permissions on this account.' : (e.message || 'Could not load operation logs'));
    }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 700, mb: 2 }}>Operation logs</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="contained" onClick={load} sx={{ textTransform: 'none', bgcolor: '#ec6e17' }}>Apply</Button>
      </Box>
      {err && <Typography sx={{ color: '#dc2626', fontSize: 13, mb: 1 }}>{err}</Typography>}
      {loading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' } }}>
              <TableCell>Date and time</TableCell><TableCell>User ID</TableCell><TableCell>Screen</TableCell><TableCell>Object</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id && r.id.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmt(r.createdTime)}</TableCell>
                <TableCell>{r.userName}</TableCell>
                <TableCell sx={{ color: '#2563eb' }}>{String(r.actionType || '').replace(/_/g, ' ')} · {r.entityType}</TableCell>
                <TableCell>{r.entityName || (r.entityId && r.entityId.id) || '—'}</TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow><TableCell colSpan={4} sx={{ color: '#94a3b8' }}>No operation logs in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default OperationLogs;
