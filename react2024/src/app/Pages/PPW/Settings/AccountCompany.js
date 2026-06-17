import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Chip, TextField, InputAdornment, Tabs, Tab, IconButton, Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { getTenant, getSetting, setSetting } from '../../../Services/app/zumensettings';
import { getCustomerUsers } from '../../../Services/app/operatorservice';
import { ROLE_HIERARCHY } from '../../../Shared/constants/role';
import { decryptText } from '../../../Shared/utils/cryptoUtils';
import { alertSaved, alertError } from '../ppwAlerts';

const ROLE_TABS = ['All', ...[...ROLE_HIERARCHY].reverse()];

const parse = (v) => { try { return JSON.parse(v); } catch (e) { return v; } };
const lsUser = () => {
  let ud = {};
  try { ud = JSON.parse(localStorage.getItem('userDetails')) || {}; } catch (e) { ud = {}; }
  return {
    email: localStorage.getItem('email') || '',
    firstName: parse(localStorage.getItem('firstName')) || '',
    lastName: parse(localStorage.getItem('lastName')) || '',
    mode: ud.mode || '',
    pageList: ud.pageList || [],
    userId: ud.userId || ud.id || '',
    password: ud.password || '',
  };
};
const customerId = () => localStorage.getItem('CustomerID');

const Field = ({ label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: '1px solid #eef2f7' }}>
    <Typography sx={{ width: 220, color: '#64748b', fontSize: 14 }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, color: '#111827' }}>{value || '—'}</Typography>
  </Box>
);

const initials = (name, email) => {
  const src = (name && name.trim()) || (email || '');
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
};
const roleColor = (m) => ({
  'Super Admin': '#16a34a', Admin: '#0ea5e9', Manager: '#8b5cf6', Quality: '#a855f7',
  Maintenance: '#f59e0b', Supervisor: '#ec6e17', Operator: '#64748b',
}[m] || '#64748b');

// Paperless Factory page access (scoped to this module — not the whole app).
const isAdminMode = (m) => ['Admin', 'Super Admin'].includes(m);
const pfAccess = (mode) => ['Drawings', 'Projects / Orders', ...(isAdminMode(mode) ? ['Settings'] : [])];
const PageAccess = ({ list }) => {
  if (!list || !list.length) return <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>No access</Typography>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {list.map((v) => <Chip key={v} size="small" label={v} sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontSize: 11, fontWeight: 600 }} />)}
    </Box>
  );
};

// view: 'account' | 'company' | 'users'
const AccountCompany = ({ view = 'account' }) => {
  const [tenant, setTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(view !== 'account');
  const [q, setQ] = useState('');
  const [activeRole, setActiveRole] = useState('All');
  const [showPwd, setShowPwd] = useState(false);
  const [company, setCompany] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (view === 'company') {
          const [tn, saved] = await Promise.all([getTenant(), getSetting('zumenCompany').catch(() => null)]);
          setTenant(tn);
          const s = saved || {};
          setCompany({
            company: s.company || (tn && tn.title) || localStorage.getItem('customerTitle') || '',
            email: s.email || (tn && tn.email) || '',
            country: s.country || (tn && tn.country) || '',
            state: s.state || (tn && tn.state) || '',
            city: s.city || (tn && tn.city) || '',
            address: s.address || (tn && tn.address) || '',
            phone: s.phone || (tn && tn.phone) || '',
          });
        }
        else if (view === 'users') {
          const res = await getCustomerUsers(customerId());
          const list = (res && res.data) || [];
          setUsers(list.map((u) => {
            let d = {};
            try { d = u.additionalInfo && u.additionalInfo.description ? JSON.parse(u.additionalInfo.description) : {}; } catch (e) { d = {}; }
            return { ...u, ud: d || {} };
          }));
        }
      } catch (e) { /* show what loaded */ }
      finally { setLoading(false); }
    })();
  }, [view]);

  const roleCounts = useMemo(() => {
    const m = {}; users.forEach((u) => { const r = u.ud.mode || '—'; m[r] = (m[r] || 0) + 1; }); return m;
  }, [users]);
  const filteredUsers = useMemo(() => {
    let base = activeRole === 'All' ? users : users.filter((u) => (u.ud.mode || '') === activeRole);
    const s = q.trim().toLowerCase();
    if (s) base = base.filter((u) => `${u.firstName || ''} ${u.email || ''} ${u.ud.mode || ''}`.toLowerCase().includes(s));
    return base;
  }, [users, q, activeRole]);

  if (view === 'account') {
    const u = lsUser();
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.email ? u.email.split('@')[0] : '—');
    const pwd = (() => { try { return u.password ? decryptText(u.password) : ''; } catch (e) { return ''; } })();
    return (
      <Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700, mb: 2 }}>My account</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, mb: 3, bgcolor: '#fff', border: '1px solid #e8edf3', borderRadius: 3, maxWidth: 820 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: roleColor(u.mode), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0 }}>
            {initials(name === '—' ? '' : name, u.email)}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>{name}</Typography>
            <Typography sx={{ fontSize: 13.5, color: '#64748b' }}>{u.email}</Typography>
          </Box>
          <Chip label={u.mode || 'User'} sx={{ bgcolor: `${roleColor(u.mode)}18`, color: roleColor(u.mode), fontWeight: 700 }} />
        </Box>
        <Box sx={{ maxWidth: 820 }}>
          <Field label="Full name" value={name} />
          <Field label="Email address (login ID)" value={u.email} />
          <Field label="Role" value={u.mode} />
          <Field label="User ID" value={u.userId} />
          <Box sx={{ display: 'flex', alignItems: 'flex-start', py: 1.5, borderBottom: '1px solid #eef2f7' }}>
            <Typography sx={{ width: 220, color: '#64748b', fontSize: 14, pt: 0.5 }}>Page access</Typography>
            <PageAccess list={pfAccess(u.mode)} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: '1px solid #eef2f7' }}>
            <Typography sx={{ width: 220, color: '#64748b', fontSize: 14 }}>Password</Typography>
            <Typography sx={{ fontSize: 14, color: (showPwd && !pwd) ? '#94a3b8' : '#111827', fontFamily: (showPwd && pwd) ? 'monospace' : 'inherit', letterSpacing: (showPwd && pwd) ? 0 : 2 }}>
              {showPwd ? (pwd || '(not set)') : '••••••••'}
            </Typography>
            <IconButton size="small" onClick={() => setShowPwd((s) => !s)} sx={{ ml: 1, color: '#94a3b8' }}>
              {showPwd ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
      </Box>
    );
  }

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;

  if (view === 'company') {
    const c = company || {};
    const FIELDS = [
      ['company', 'Company'], ['email', 'Email'], ['country', 'Country'],
      ['state', 'State'], ['city', 'City'], ['address', 'Address'], ['phone', 'Phone'],
    ];
    const startEdit = () => { setForm({ ...c }); setEditing(true); };
    const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const save = async () => {
      setSaving(true);
      try {
        await setSetting('zumenCompany', form);
        setCompany({ ...form });
        setEditing(false);
        alertSaved('Company info saved.');
      } catch (e) { alertError((e && e.message) || 'Could not save company info.'); }
      finally { setSaving(false); }
    };
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, flexGrow: 1 }}>Company info</Typography>
          {!editing ? (
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={startEdit}
              sx={{ textTransform: 'none', borderColor: '#ec6e17', color: '#ec6e17', '&:hover': { borderColor: '#d65f0e', bgcolor: '#fff7ed' } }}
            >
              Edit
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => setEditing(false)} disabled={saving} sx={{ textTransform: 'none', color: '#64748b' }}>Cancel</Button>
              <Button
                variant="contained"
                onClick={save}
                disabled={saving}
                sx={{ textTransform: 'none', bgcolor: '#ec6e17', '&:hover': { bgcolor: '#d65f0e' } }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          )}
        </Box>
        <Box sx={{ maxWidth: 760 }}>
          {editing
            ? FIELDS.map(([k, label]) => (
                <Box key={k} sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #eef2f7' }}>
                  <Typography sx={{ width: 220, color: '#64748b', fontSize: 14 }}>{label}</Typography>
                  <TextField size="small" value={form[k] || ''} onChange={setF(k)} sx={{ flexGrow: 1, maxWidth: 380 }} />
                </Box>
              ))
            : FIELDS.map(([k, label]) => <Field key={k} label={label} value={c[k]} />)}
        </Box>
      </Box>
    );
  }

  // 'users' roster (this customer's users)
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, flexGrow: 1 }}>
          Account management {users.length ? `(${users.length} users)` : ''}
        </Typography>
        <TextField size="small" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} /></InputAdornment> }} sx={{ width: 260 }} />
      </Box>
      <Tabs value={activeRole} onChange={(_, v) => setActiveRole(v)} variant="scrollable" scrollButtons="auto"
        sx={{ mb: 2, minHeight: 40, borderBottom: '1px solid #eef2f7',
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
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredUsers.map((u) => {
            const nm = u.firstName || '—';
            const role = u.ud.mode || '—';
            return (
              <TableRow key={(u.id && u.id.id) || u.email} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: `${roleColor(role)}22`, color: roleColor(role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                      {initials(nm === '—' ? '' : nm, u.email)}
                    </Box>
                    {nm}
                  </Box>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Chip size="small" label={role} sx={{ bgcolor: `${roleColor(role)}18`, color: roleColor(role), fontWeight: 600 }} /></TableCell>
                <TableCell sx={{ color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{u.ud.userId || '—'}</TableCell>
              </TableRow>
            );
          })}
          {!filteredUsers.length && (
            <TableRow><TableCell colSpan={4} sx={{ color: '#94a3b8' }}>No users match.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default AccountCompany;
