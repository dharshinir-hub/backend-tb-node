import React, { useEffect, useState } from 'react';
import {
  Box, Typography, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import { listClients } from '../../../Services/app/zumensettings';

const ClientInfo = () => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => { try { setRows(await listClients()); } catch (e) { setRows([]); } })();
  }, []);

  if (!rows) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 700, mb: 2 }}>
        Client info {rows.length ? `(${rows.length})` : ''}
      </Typography>
      <Table size="small" sx={{ maxWidth: 960 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' } }}>
            <TableCell>Client / Customer</TableCell><TableCell>Email</TableCell><TableCell>Country</TableCell><TableCell>City</TableCell><TableCell>Phone</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={(c.id && c.id.id) || c.title} hover>
              <TableCell>{c.title || c.name || '—'}</TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>{c.country}</TableCell>
              <TableCell>{c.city}</TableCell>
              <TableCell>{c.phone}</TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow><TableCell colSpan={5} sx={{ color: '#94a3b8' }}>No clients found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default ClientInfo;
