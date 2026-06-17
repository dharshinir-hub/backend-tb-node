import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Tabs, Tab, Checkbox, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getCustomerUsers } from '../../../Services/app/operatorservice';
import { getSetting, setSetting } from '../../../Services/app/zumensettings';
import { ROLE_HIERARCHY } from '../../../Shared/constants/role';
import { alertSaved, alertError } from '../ppwAlerts';

const ROLE_TABS = ['All', ...[...ROLE_HIERARCHY].reverse()];
const roleColor = (m) => ({
  'Super Admin': '#16a34a', Admin: '#0ea5e9', Manager: '#8b5cf6', Quality: '#a855f7',
  Maintenance: '#f59e0b', Supervisor: '#ec6e17', Operator: '#64748b',
}[m] || '#64748b');
const isAdminMode = (m) => ['Admin', 'Super Admin'].includes(m);
const customerId = () => localStorage.getItem('CustomerID');
const cbSx = { color: '#cbd5e1', '&.Mui-checked': { color: '#ec6e17' } };

// Paperless Factory pages this screen controls — NOT the whole app.
const PF_PAGES = [
  { key: 'drawings', label: 'Drawings' },
  { key: 'projects', label: 'Projects / Orders' },
  { key: 'settings', label: 'Settings' },
];

const AuthorityManagement = () => {
  const [users, setUsers] = useState([]);
  const [access, setAccess] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [res, saved] = await Promise.all([
          getCustomerUsers(customerId()).catch(() => ({ data: [] })),
          getSetting('zumenUserPfAccess').catch(() => null),
        ]);
        const list = (res && res.data) || [];
        const parsed = list.map((u) => {
          let d = {};
          try { d = u.additionalInfo && u.additionalInfo.description ? JSON.parse(u.additionalInfo.description) : {}; } catch (e) { d = {}; }
          return { ...u, mode: (d && d.mode) || '', userId: (d && d.userId) || '' };
        });
        setUsers(parsed);
        const map = {};
        parsed.forEach((u) => {
          const s = saved && saved[u.email];
          map[u.email] = s || { drawings: true, projects: true, settings: isAdminMode(u.mode) };
        });
        setAccess(map);
      } catch (e) { /* show what loaded */ }
      finally { setLoading(false); }
    })();
  }, []);

  const roleCounts = useMemo(() => {
    const m = {}; users.forEach((u) => { const r = u.mode || '—'; m[r] = (m[r] || 0) + 1; }); return m;
  }, [users]);
  const shown = useMemo(() => {
    let base = activeRole === 'All' ? users : users.filter((u) => (u.mode || '') === activeRole);
    const s = q.trim().toLowerCase();
    if (s) base = base.filter((u) => `${u.firstName || ''} ${u.email || ''} ${u.mode || ''}`.toLowerCase().includes(s));
    return base;
  }, [users, activeRole, q]);

  const toggle = (email, key) => setAccess((a) => ({ ...a, [email]: { ...(a[email] || {}), [key]: !(a[email] && a[email][key]) } }));
  const save = async () => {
    setSaving(true);
    try { await setSetting('zumenUserPfAccess', access); alertSaved('Page access saved.'); }
    catch (e) { alertError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 0.5 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, flexGrow: 1 }}>User management</Typography>
        <TextField size="small" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} /></InputAdornment> }} sx={{ width: 240 }} />
        <Button variant="contained" disabled={saving} onClick={save} sx={{ textTransform: 'none', bgcolor: '#ec6e17', px: 3 }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
      <Typography sx={{ color: '#64748b', fontSize: 13, mb: 1 }}>
        Your workspace users, their roles, and their Paperless Factory access (Drawings, Projects, Settings). Admins decide who sees what.
      </Typography>

      <Tabs value={activeRole} onChange={(_, v) => setActiveRole(v)} variant="scrollable" scrollButtons="auto"
        sx={{ mb: 1.5, minHeight: 40, borderBottom: '1px solid #eef2f7',
          '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600, fontSize: 13.5 },
          '& .Mui-selected': { color: '#ec6e17' }, '& .MuiTabs-indicator': { bgcolor: '#ec6e17' } }}>
        {ROLE_TABS.map((t) => {
          const n = t === 'All' ? users.length : (roleCounts[t] || 0);
          return <Tab key={t} value={t} label={`${t === 'All' ? 'All users' : t} (${n})`} />;
        })}
      </Tabs>

      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' } }}>
            <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>User ID</TableCell>
            {PF_PAGES.map((p) => <TableCell key={p.key} align="center">{p.label}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((u) => {
            const a = access[u.email] || {};
            return (
              <TableRow key={(u.id && u.id.id) || u.email} hover>
                <TableCell>{u.firstName || '—'}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Chip size="small" label={u.mode || '—'} sx={{ bgcolor: `${roleColor(u.mode)}18`, color: roleColor(u.mode), fontWeight: 600 }} /></TableCell>
                <TableCell sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{u.userId || '—'}</TableCell>
                {PF_PAGES.map((p) => (
                  <TableCell key={p.key} align="center">
                    <Checkbox size="small" checked={!!a[p.key]} onChange={() => toggle(u.email, p.key)} sx={cbSx} />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {!shown.length && (
            <TableRow><TableCell colSpan={4 + PF_PAGES.length} sx={{ color: '#94a3b8' }}>No users.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default AuthorityManagement;
