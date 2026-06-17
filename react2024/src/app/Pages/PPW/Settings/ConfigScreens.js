import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, Switch, IconButton, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import SendIcon from '@mui/icons-material/Send';
import { getSetting, setSetting } from '../../../Services/app/zumensettings';
import { getCustomerUsers } from '../../../Services/app/operatorservice';
import { sendNotification } from '../../../Services/app/zumennotify';
import { ROLES } from '../../../Shared/constants/role';
import { alertSaved, alertError, alertWarning } from '../ppwAlerts';

const oSwitch = { '& .Mui-checked': { color: '#ec6e17' }, '& .Mui-checked+.MuiSwitch-track': { bgcolor: '#ec6e17' } };
const thStyle = { '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' } };
const PALETTE = ['#3b82f6', '#0ea5e9', '#16a34a', '#84cc16', '#eab308', '#f59e0b', '#ec6e17', '#ef4444', '#a855f7', '#8b5cf6', '#64748b'];

const useSetting = (key, def) => {
  const [val, setVal] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => { let s = null; try { s = await getSetting(key); } catch (e) { /* default */ } if (alive) setVal(s || def); })();
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setSaving(true);
    try { await setSetting(key, val); alertSaved('Settings saved.'); }
    catch (e) { alertError(e.message); }
    finally { setSaving(false); }
  };
  return [val, setVal, save, saving];
};

const Loading = () => <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;

const Header = ({ title, note, onSave, saving }) => (
  <Box sx={{ mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: note ? 0.5 : 0 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 700, flexGrow: 1 }}>{title}</Typography>
      {onSave && (
        <Button variant="contained" disabled={saving} onClick={onSave} sx={{ textTransform: 'none', bgcolor: '#ec6e17', px: 3 }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}
    </Box>
    {note && <Typography sx={{ color: '#64748b', fontSize: 13 }}>{note}</Typography>}
  </Box>
);

const Row = ({ label, hint, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', py: 1.25, borderBottom: '1px solid #eef2f7' }}>
    <Box sx={{ width: 240 }}>
      <Typography sx={{ color: '#334155', fontSize: 14 }}>{label}</Typography>
      {hint && <Typography sx={{ color: '#94a3b8', fontSize: 12 }}>{hint}</Typography>}
    </Box>
    {children}
  </Box>
);

const FieldConfig = ({ title, note, storeKey, base }) => {
  const def = base.map((f) => ({ key: f.key, label: f.label, required: false, visible: true }));
  const [rows, setRows, save, saving] = useSetting(storeKey, def);
  if (!rows) return <Loading />;
  const set = (i, patch) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const exampleOf = (k) => (base.find((b) => b.key === k) || {}).example;
  return (
    <Box>
      <Header title={title} note={note} onSave={save} saving={saving} />
      <Table size="small" sx={{ maxWidth: 860 }}>
        <TableHead><TableRow sx={thStyle}>
          <TableCell>Field</TableCell><TableCell>Example value</TableCell><TableCell align="center">Required</TableCell><TableCell align="center">Visible</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.key} hover>
              <TableCell><TextField size="small" value={r.label} onChange={(e) => set(i, { label: e.target.value })} sx={{ minWidth: 240 }} /></TableCell>
              <TableCell sx={{ color: '#64748b', fontSize: 13 }}>{exampleOf(r.key) || '—'}</TableCell>
              <TableCell align="center"><Switch checked={!!r.required} onChange={(e) => set(i, { required: e.target.checked })} sx={oSwitch} /></TableCell>
              <TableCell align="center"><Switch checked={r.visible !== false} onChange={(e) => set(i, { visible: e.target.checked })} sx={oSwitch} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

const INFO_FIELDS = [
  { key: 'drawingNumber', label: 'Drawing number', example: 'CNC-2026-9114' },
  { key: 'productName', label: 'Product name', example: 'CNC Milled Flange' },
  { key: 'clientName', label: 'Client name', example: 'Surin Automotive' },
  { key: 'revision', label: 'Revision', example: 'A' },
  { key: 'status', label: 'Status', example: 'In Production' },
  { key: 'material', label: 'Material', example: 'AL 6061-T6' },
  { key: 'processType', label: 'Process type', example: 'CNC Milling' },
];
export const DrawingInfoSettings = () => (
  <FieldConfig title="Drawing info settings" storeKey="zumenDrawingInfoFields" base={INFO_FIELDS}
    note="Choose which fields appear on a drawing’s main info panel, rename them, and mark required ones." />
);

const DETAIL_FIELDS = [
  { key: 'qualityCheckNo', label: 'Quality Check No.', example: 'QC-2026-001' },
  { key: 'inspectionSheet', label: 'Inspection report spread sheet', example: 'INS-2026-014.xlsx' },
  { key: 'ecNo', label: 'EC NO.', example: 'EC-2026-017' },
  { key: 'excelSheet', label: 'Excel Spread sheet', example: 'BOM-9114.xlsx' },
  { key: 'inventory', label: 'Inventory / 在庫', example: '120 pcs' },
  { key: 'project', label: 'Project', example: '20260331' },
  { key: 'assemblyNo', label: 'Assembly No.', example: 'ASM-2026-44' },
  { key: 'deliveryDate', label: 'Delivery date', example: '2026-08-11' },
];
export const DrawingDetailSettings = () => (
  <FieldConfig title="Drawing detail info" storeKey="zumenDrawingDetailFields" base={DETAIL_FIELDS}
    note="Configure the secondary detail fields shown on a drawing." />
);

export const StampSettings = () => {
  const def = [
    { name: 'Approved', color: '#16a34a', enabled: true },
    { name: 'Checked', color: '#2563eb', enabled: true },
    { name: 'Drawn', color: '#ec6e17', enabled: true },
    { name: 'Reviewed', color: '#a855f7', enabled: true },
    { name: 'Released', color: '#0ea5e9', enabled: true },
    { name: 'Rejected', color: '#ef4444', enabled: false },
  ];
  const [rows, setRows, save, saving] = useSetting('zumenStamps', def);
  if (!rows) return <Loading />;
  const set = (i, p) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  return (
    <Box>
      <Header title="Stamp Settings" note="Approval / sign-off stamps applied when reviewing drawings and documents." onSave={save} saving={saving} />
      <Table size="small" sx={{ maxWidth: 720 }}>
        <TableHead><TableRow sx={thStyle}>
          <TableCell>Stamp name</TableCell><TableCell align="center">Preview</TableCell><TableCell align="center">Colour</TableCell><TableCell align="center">Enabled</TableCell><TableCell />
        </TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} hover>
              <TableCell><TextField size="small" value={r.name} onChange={(e) => set(i, { name: e.target.value })} /></TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-block', border: `2px solid ${r.color}`, color: r.color, borderRadius: 1, px: 1, py: 0.25, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, transform: 'rotate(-4deg)', opacity: r.enabled ? 1 : 0.35 }}>
                  {r.name || 'STAMP'}
                </Box>
              </TableCell>
              <TableCell align="center">
                <input type="color" value={r.color} onChange={(e) => set(i, { color: e.target.value })}
                  style={{ width: 34, height: 24, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', background: 'none' }} />
              </TableCell>
              <TableCell align="center"><Switch checked={r.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} sx={oSwitch} /></TableCell>
              <TableCell><IconButton size="small" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button startIcon={<AddIcon />} onClick={() => setRows([...rows, { name: 'New stamp', color: '#64748b', enabled: true }])}
        sx={{ mt: 1, textTransform: 'none', color: '#ec6e17' }}>Add stamp</Button>
    </Box>
  );
};

export const AssemblySettings = () => {
  const def = { relationType: 'Contains', maxDepth: 5, autoNumber: true, showQuantity: true, showThumbnails: true };
  const [v, setV, save, saving] = useSetting('zumenAssemblySettings', def);
  if (!v) return <Loading />;
  const set = (p) => setV({ ...v, ...p });
  return (
    <Box>
      <Header title="Assembly drawing settings" note="Defaults for how assembly (BOM) trees are built and displayed." onSave={save} saving={saving} />
      <Box sx={{ maxWidth: 560 }}>
        <Row label="Child relation type" hint="ThingsBoard relation linking parent → child parts"><TextField size="small" value={v.relationType} onChange={(e) => set({ relationType: e.target.value })} /></Row>
        <Row label="Max tree depth" hint="How many assembly levels to expand"><TextField size="small" type="number" value={v.maxDepth} onChange={(e) => set({ maxDepth: Number(e.target.value) })} sx={{ width: 120 }} /></Row>
        <Row label="Auto-number child parts" hint="Assign 1, 1.1, 1.2 … automatically"><Switch checked={v.autoNumber} onChange={(e) => set({ autoNumber: e.target.checked })} sx={oSwitch} /></Row>
        <Row label="Show quantity column"><Switch checked={v.showQuantity} onChange={(e) => set({ showQuantity: e.target.checked })} sx={oSwitch} /></Row>
        <Row label="Show child thumbnails"><Switch checked={v.showThumbnails} onChange={(e) => set({ showThumbnails: e.target.checked })} sx={oSwitch} /></Row>
      </Box>
    </Box>
  );
};

export const NewDrawingSettings = () => {
  const def = { prefix: 'ZU-', numberDigits: 5, defaultStatus: 'Draft', defaultRevision: 'A', requireProduct: true, requireClient: false, requireMaterial: false };
  const [v, setV, save, saving] = useSetting('zumenNewDrawingDefaults', def);
  if (!v) return <Loading />;
  const set = (p) => setV({ ...v, ...p });
  return (
    <Box>
      <Header title="New drawing registration settings" note="Defaults applied when a new drawing is registered." onSave={save} saving={saving} />
      <Box sx={{ maxWidth: 560 }}>
        <Row label="Drawing number prefix" hint={`e.g. ${v.prefix}00001`}><TextField size="small" value={v.prefix} onChange={(e) => set({ prefix: e.target.value })} sx={{ width: 160 }} /></Row>
        <Row label="Auto-number digits"><TextField size="small" type="number" value={v.numberDigits} onChange={(e) => set({ numberDigits: Number(e.target.value) })} sx={{ width: 120 }} /></Row>
        <Row label="Default status"><TextField size="small" value={v.defaultStatus} onChange={(e) => set({ defaultStatus: e.target.value })} /></Row>
        <Row label="Default revision"><TextField size="small" value={v.defaultRevision} onChange={(e) => set({ defaultRevision: e.target.value })} sx={{ width: 120 }} /></Row>
        <Row label="Require product name"><Switch checked={v.requireProduct} onChange={(e) => set({ requireProduct: e.target.checked })} sx={oSwitch} /></Row>
        <Row label="Require client"><Switch checked={v.requireClient} onChange={(e) => set({ requireClient: e.target.checked })} sx={oSwitch} /></Row>
        <Row label="Require material"><Switch checked={v.requireMaterial} onChange={(e) => set({ requireMaterial: e.target.checked })} sx={oSwitch} /></Row>
      </Box>
    </Box>
  );
};

export const ProjectInfo = () => {
  const def = ['Prototype', 'Pre Quotation', 'Post Quotation', 'Under check by commercial', 'PO received',
    'Payment received', 'In Production', 'Inspection', 'In stock', 'Delivered', 'Lost'];
  const [rows, setRows, save, saving] = useSetting('zumenProjectStages', def);
  if (!rows) return <Loading />;
  const color = (i) => PALETTE[i % PALETTE.length];
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; const c = [...rows]; [c[i], c[j]] = [c[j], c[i]]; setRows(c); };
  return (
    <Box>
      <Header title="Project info" note="The order-pipeline stages used in Projects / Orders. Rename, reorder, add, or remove stages." onSave={save} saving={saving} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 2 }}>
        {rows.map((r, i) => (
          <Box key={i} sx={{ px: 1.25, py: 0.5, borderRadius: 5, bgcolor: `${color(i)}1f`, color: color(i), fontSize: 12, fontWeight: 700 }}>{i + 1}. {r}</Box>
        ))}
      </Box>
      <Box sx={{ maxWidth: 620 }}>
        {rows.map((r, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color(i), flexShrink: 0 }} />
            <TextField size="small" value={r} onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? e.target.value : x)))} sx={{ flexGrow: 1 }} />
            <IconButton size="small" onClick={() => move(i, -1)}><KeyboardArrowUpIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => move(i, 1)}><KeyboardArrowDownIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} onClick={() => setRows([...rows, 'New stage'])} sx={{ mt: 1, textTransform: 'none', color: '#ec6e17' }}>Add stage</Button>
      </Box>
    </Box>
  );
};

export const FormTemplateSettings = () => {
  const def = [
    { name: 'Quotation', docType: 'quotation', enabled: true },
    { name: 'Inspection Report', docType: 'inspection-report', enabled: true },
    { name: 'Purchase Order', docType: 'purchase-order', enabled: true },
    { name: 'Work Instruction', docType: 'work-instruction-details', enabled: true },
    { name: 'Packing Std.', docType: 'packing-std', enabled: true },
    { name: 'Defect Report', docType: 'defect-report', enabled: false },
  ];
  const [rows, setRows, save, saving] = useSetting('zumenFormTemplates', def);
  if (!rows) return <Loading />;
  const set = (i, p) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  return (
    <Box>
      <Header title="Form template settings" note="Reusable document templates used by ‘Generate documents’ and manual document creation." onSave={save} saving={saving} />
      <Table size="small" sx={{ maxWidth: 760 }}>
        <TableHead><TableRow sx={thStyle}>
          <TableCell>Template name</TableCell><TableCell>Document type</TableCell><TableCell align="center">Enabled</TableCell><TableCell />
        </TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} hover>
              <TableCell><TextField size="small" value={r.name} onChange={(e) => set(i, { name: e.target.value })} /></TableCell>
              <TableCell><Chip size="small" label={r.docType} sx={{ bgcolor: '#f1f5f9', color: '#475569', fontFamily: 'monospace', fontSize: 11 }} /></TableCell>
              <TableCell align="center"><Switch checked={r.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} sx={oSwitch} /></TableCell>
              <TableCell><IconButton size="small" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button startIcon={<AddIcon />} onClick={() => setRows([...rows, { name: 'New template', docType: 'quotation', enabled: true }])}
        sx={{ mt: 1, textTransform: 'none', color: '#ec6e17' }}>Add template</Button>
    </Box>
  );
};

export const IpAddressSettings = () => {
  const def = [
    { name: 'Head office', ranges: '203.0.113.0/24', enabled: true },
    { name: 'Sales', ranges: '198.51.100.10-198.51.100.20', enabled: true },
    { name: 'Factory floor', ranges: '192.168.0.0/24', enabled: true },
    { name: 'Remote / VPN', ranges: '10.8.0.0/16', enabled: false },
  ];
  const [rows, setRows, save, saving] = useSetting('zumenIpGroups', def);
  if (!rows) return <Loading />;
  const set = (i, p) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  return (
    <Box>
      <Header title="Settings for applicable IP address" note="Restrict Paperless Factory access to allow-listed IP address groups (e.g. head office, sales)." onSave={save} saving={saving} />
      <Table size="small" sx={{ maxWidth: 820 }}>
        <TableHead><TableRow sx={thStyle}>
          <TableCell>Group name</TableCell><TableCell>Allowed IPs / CIDR</TableCell><TableCell align="center">Active</TableCell><TableCell />
        </TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} hover>
              <TableCell><TextField size="small" value={r.name} onChange={(e) => set(i, { name: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" value={r.ranges} onChange={(e) => set(i, { ranges: e.target.value })} sx={{ minWidth: 320, fontFamily: 'monospace' }} /></TableCell>
              <TableCell align="center"><Switch checked={r.enabled !== false} onChange={(e) => set(i, { enabled: e.target.checked })} sx={oSwitch} /></TableCell>
              <TableCell><IconButton size="small" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button startIcon={<AddIcon />} onClick={() => setRows([...rows, { name: 'New group', ranges: '', enabled: true }])}
        sx={{ mt: 1, textTransform: 'none', color: '#ec6e17' }}>Add IP group</Button>
    </Box>
  );
};

export const NotificationSettings = () => {
  const EVENTS = [
    { key: 'newDrawing', label: 'New drawing registered', hint: 'A drawing is added to the library' },
    { key: 'revision', label: 'Drawing revised', hint: 'A new revision is bumped' },
    { key: 'approvalRequested', label: 'Approval requested', hint: 'A drawing/document is sent for sign-off' },
    { key: 'orderStage', label: 'Order stage changed', hint: 'An order moves along the pipeline' },
    { key: 'poReceived', label: 'PO received', hint: 'A purchase order is logged' },
    { key: 'defect', label: 'Defect reported', hint: 'A defect is recorded in inspection' },
    { key: 'stockLow', label: 'Stock low', hint: 'Inventory drops below threshold' },
    { key: 'delivery', label: 'Delivery due', hint: 'An order nears its delivery date' },
  ];
  const def = EVENTS.reduce((a, e) => ({ ...a, [e.key]: { inApp: true, roles: [] } }), {});
  const [v, setV, save, saving] = useSetting('zumenNotifications', def);
  const [users, setUsers] = useState([]);   // { id, name, email, mode }
  const [dlg, setDlg] = useState(null);      // event key whose dialog is open
  const [testing, setTesting] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await getCustomerUsers(localStorage.getItem('CustomerID'));
        const list = (res && res.data) || [];
        setUsers(list.map((u) => {
          let d = {};
          try { d = u.additionalInfo && u.additionalInfo.description ? JSON.parse(u.additionalInfo.description) : {}; } catch (e) { d = {}; }
          return {
            id: u.id && u.id.id,
            name: [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.email || '').split('@')[0],
            email: u.email,
            mode: (d && d.mode) || '',
          };
        }).filter((u) => u.id));
      } catch (e) { /* keep empty */ }
    })();
  }, []);

  if (!v) return <Loading />;
  const ev = (k) => v[k] || { inApp: true, roles: [] };
  const set = (k, p) => setV({ ...v, [k]: { ...ev(k), ...p } });

  const sameRole = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  const usersInRole = (role) => users.filter((u) => sameRole(u.mode, role));
  const countInRole = (role) => usersInRole(role).length;
  const idsForRoles = (roles) => {
    const out = new Set();
    (roles || []).forEach((role) => usersInRole(role).forEach((u) => out.add(u.id)));
    return Array.from(out);
  };
  const toggleRole = (k, role) => {
    const r = ev(k).roles || [];
    set(k, { roles: r.includes(role) ? r.filter((x) => x !== role) : [...r, role] });
  };

  const sendTest = async (e) => {
    const roles = ev(e.key).roles || [];
    if (!roles.length) { alertWarning('No recipients', 'Click “Recipients” and choose at least one role.'); return; }
    const ids = idsForRoles(roles);
    if (!ids.length) { alertWarning('No users in those roles', 'The selected role(s) have no users yet.'); return; }
    setTesting(e.key);
    try {
      await sendNotification(ids, `Paperless Factory · ${e.label}`, e.hint);
      alertSaved(`Notification sent to ${ids.length} user${ids.length === 1 ? '' : 's'} — check the bell 🔔`);
    } catch (err) {
      alertError((err && err.response && err.response.status === 403)
        ? 'Not allowed to send (403). The tenant token needs notification permission.'
        : (err && err.message) || 'Could not send notification.');
    } finally { setTesting(''); }
  };

  const openEv = dlg ? ev(dlg) : null;
  const dlgEvent = dlg ? EVENTS.find((e) => e.key === dlg) : null;

  return (
    <Box>
      <Header
        title="Notification Settings"
        note="Pick which events notify, then choose which roles receive each one. Everyone whose account role matches is notified in-app on the bell — tick your own role to notify yourself."
        onSave={save}
        saving={saving}
      />
      <Table size="small" sx={{ maxWidth: 920 }}>
        <TableHead><TableRow sx={thStyle}>
          <TableCell>Event</TableCell>
          <TableCell align="center">In-app</TableCell>
          <TableCell>Recipients (by role)</TableCell>
          <TableCell align="center">Test</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {EVENTS.map((e) => {
            const row = ev(e.key);
            const roles = row.roles || [];
            return (
              <TableRow key={e.key} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{e.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>{e.hint}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Switch checked={!!row.inApp} onChange={(x) => set(e.key, { inApp: x.target.checked })} sx={oSwitch} />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', opacity: row.inApp ? 1 : 0.4 }}>
                    {roles.map((r) => (
                      <Chip key={r} size="small" label={`${r} · ${countInRole(r)}`} sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontSize: 11, fontWeight: 600 }} />
                    ))}
                    {!roles.length && <Typography sx={{ color: '#cbd5e1', fontSize: 12 }}>no one yet</Typography>}
                    <Button
                      size="small"
                      startIcon={<PersonAddAltIcon sx={{ fontSize: 16 }} />}
                      disabled={!row.inApp}
                      onClick={() => setDlg(e.key)}
                      sx={{ textTransform: 'none', color: '#ec6e17', minWidth: 0 }}
                    >
                      Recipients
                    </Button>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Button
                    size="small"
                    startIcon={<SendIcon sx={{ fontSize: 15 }} />}
                    disabled={!row.inApp || testing === e.key}
                    onClick={() => sendTest(e)}
                    sx={{ textTransform: 'none', color: '#0f766e' }}
                  >
                    {testing === e.key ? 'Sending…' : 'Send'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!dlg} onClose={() => setDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>
          Choose recipients
          {dlgEvent && <Typography sx={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>{dlgEvent.label}</Typography>}
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 12.5, color: '#64748b', mb: 1.5 }}>
            Tick the roles that should be notified. Everyone whose account role matches a ticked role receives it.
          </Typography>
          {ROLES.map((role) => {
            const cnt = countInRole(role.value);
            const checked = !!openEv && (openEv.roles || []).includes(role.value);
            return (
              <Box
                key={role.value}
                onClick={() => dlg && toggleRole(dlg, role.value)}
                sx={{ display: 'flex', alignItems: 'center', py: 0.25, px: 0.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
              >
                <Checkbox size="small" checked={checked} sx={{ p: 0.5, mr: 1, '&.Mui-checked': { color: '#ec6e17' } }} />
                <Typography sx={{ flexGrow: 1, fontSize: 14, fontWeight: 600, color: '#334155' }}>{role.label}</Typography>
                <Chip
                  size="small"
                  label={`${cnt} user${cnt === 1 ? '' : 's'}`}
                  sx={{ bgcolor: cnt ? '#ecfdf5' : '#f1f5f9', color: cnt ? '#047857' : '#94a3b8', fontSize: 11 }}
                />
              </Box>
            );
          })}
          {openEv && idsForRoles(openEv.roles).length > 0 && (
            <Typography sx={{ mt: 1.5, fontSize: 12.5, color: '#0f766e', fontWeight: 600 }}>
              {idsForRoles(openEv.roles).length} user{idsForRoles(openEv.roles).length === 1 ? '' : 's'} will be notified.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(null)} sx={{ textTransform: 'none', color: '#ec6e17', fontWeight: 600 }}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
