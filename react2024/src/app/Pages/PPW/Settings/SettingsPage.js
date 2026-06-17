import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Drawer, IconButton, InputBase } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

import { DOCUMENT_TYPES } from '../../../Services/app/zumendocservice';
import { listClients, getAssetCount } from '../../../Services/app/zumensettings';
import { getCustomerUsers } from '../../../Services/app/operatorservice';
import AccountCompany from './AccountCompany';
import OperationLogs from './OperationLogs';
import DocumentTypeConfig from './DocumentTypeConfig';
import AuthorityManagement from './AuthorityManagement';
import ClientInfo from './ClientInfo';
import {
  DrawingInfoSettings, DrawingDetailSettings, StampSettings, AssemblySettings, NewDrawingSettings,
  ProjectInfo, FormTemplateSettings, IpAddressSettings, NotificationSettings,
} from './ConfigScreens';

const isAdminUser = () => {
  try { return ['Admin', 'Super Admin'].includes((JSON.parse(localStorage.getItem('userDetails')) || {}).mode); }
  catch (e) { return false; }
};

const SCREENS = {
  'my-account': () => <AccountCompany view="account" />,
  'account-mgmt': () => <AuthorityManagement />,
  'company-info': () => <AccountCompany view="company" />,
  'operation-logs': () => <OperationLogs />,
  'drawing-info': () => <DrawingInfoSettings />,
  'drawing-detail': () => <DrawingDetailSettings />,
  'document-type': () => <DocumentTypeConfig />,
  'stamp': () => <StampSettings />,
  'assembly-settings': () => <AssemblySettings />,
  'new-drawing-reg': () => <NewDrawingSettings />,
  'project-info': () => <ProjectInfo />,
  'form-template': () => <FormTemplateSettings />,
  'ip-address': () => <IpAddressSettings />,
  'notifications': () => <NotificationSettings />,
  'client-info': () => <ClientInfo />,
};

const ico = (I) => <I sx={{ fontSize: 18 }} />;

const GROUPS = [
  {
    group: 'Accounts', color: '#3b82f6',
    cards: [
      { key: 'my-account', title: 'My account', desc: 'Your profile & login', icon: PersonOutlineIcon },
      { key: 'account-mgmt', title: 'User management', desc: 'Users, roles & page access', icon: PeopleAltOutlinedIcon },
      { key: 'operation-logs', title: 'Operation logs', desc: 'Full audit trail of activity', icon: HistoryIcon },
    ],
  },
  {
    group: 'Drawing', color: '#ec6e17',
    cards: [
      { key: 'drawing-info', title: 'Drawing info settings', desc: 'Main info-panel fields', icon: DescriptionOutlinedIcon },
      { key: 'drawing-detail', title: 'Drawing detail info', desc: 'Secondary detail fields', icon: ArticleOutlinedIcon },
      { key: 'document-type', title: 'Document type', desc: 'The 16 document tabs', icon: LayersOutlinedIcon },
      { key: 'stamp', title: 'Stamp Settings', desc: 'Approval & sign-off stamps', icon: VerifiedOutlinedIcon },
      { key: 'assembly-settings', title: 'Assembly drawing settings', desc: 'BOM tree behaviour', icon: AccountTreeOutlinedIcon },
      { key: 'new-drawing-reg', title: 'New drawing registration', desc: 'Defaults for new drawings', icon: SettingsOutlinedIcon },
    ],
  },
  {
    group: 'Projects', color: '#16a34a',
    cards: [
      { key: 'project-info', title: 'Project info', desc: 'Order-pipeline stages', icon: AccountTreeOutlinedIcon },
    ],
  },
  {
    group: 'Form', color: '#8b5cf6',
    cards: [
      { key: 'form-template', title: 'Form template settings', desc: 'Reusable document templates', icon: ArticleOutlinedIcon },
    ],
  },
  {
    group: 'Others', color: '#0ea5e9',
    cards: [
      { key: 'ip-address', title: 'Applicable IP address', desc: 'Access allow-list', icon: VpnKeyOutlinedIcon },
      { key: 'notifications', title: 'Notification Settings', desc: 'Event notifications', icon: NotificationsNoneIcon },
      { key: 'company-info', title: 'Company info', desc: 'Tenant details', icon: BusinessOutlinedIcon },
      { key: 'client-info', title: 'Client info', desc: 'Customer directory', icon: ContactsOutlinedIcon },
    ],
  },
];

const ALL_CARDS = GROUPS.flatMap((g) => g.cards.map((c) => ({ ...c, color: g.color })));

const Kpi = ({ icon: Icon, label, value, color }) => (
  <Box sx={{ flex: '1 1 0', minWidth: 156, bgcolor: '#fff', border: '1px solid #e8edf3', borderRadius: 2.5, p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon sx={{ color, fontSize: 22 }} />
    </Box>
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.4 }}>{label}</Typography>
    </Box>
  </Box>
);

const Card = ({ c, onClick }) => {
  const Icon = c.icon;
  return (
    <Box onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fff', border: '1px solid #e8edf3',
        borderRadius: 2.5, p: 2, cursor: 'pointer', transition: 'all .15s',
        '&:hover': { borderColor: c.color, boxShadow: '0 8px 24px rgba(15,23,42,0.09)', transform: 'translateY(-2px)' },
      }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${c.color}14`, flexShrink: 0 }}>
        <Icon sx={{ color: c.color, fontSize: 24 }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: '#94a3b8' }}>{c.desc}</Typography>
      </Box>
      <ChevronRightIcon sx={{ color: '#cbd5e1' }} />
    </Box>
  );
};

const SettingsPage = () => {
  const admin = isAdminUser();
  const [openKey, setOpenKey] = useState(null);
  const [query, setQuery] = useState('');
  const [kpi, setKpi] = useState({ users: '—', clients: '—', drawings: '—', orders: '—' });

  useEffect(() => {
    (async () => {
      let cid = null;
      try { cid = JSON.parse(localStorage.getItem('CustomerID')); } catch (e) { cid = null; }
      try {
        const [u, c, d, o] = await Promise.all([
          getCustomerUsers(cid).catch(() => ({ data: [] })),
          listClients(), getAssetCount('Drawing'), getAssetCount('Order'),
        ]);
        setKpi({
          users: ((u && u.data) || []).length, clients: (c || []).length,
          drawings: d == null ? '—' : d, orders: o == null ? '—' : o,
        });
      } catch (e) { /* leave dashes */ }
    })();
  }, []);

  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return GROUPS;
    return GROUPS
      .map((g) => ({ ...g, cards: g.cards.filter((c) => (`${c.title} ${c.desc}`).toLowerCase().includes(q)) }))
      .filter((g) => g.cards.length);
  }, [q]);

  const openCard = openKey ? ALL_CARDS.find((c) => c.key === openKey) : null;

  if (!admin) {
    return (
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#f6f8fb', p: 4, textAlign: 'center' }}>
        <SecurityOutlinedIcon sx={{ fontSize: 56, color: '#cbd5e1', mb: 1 }} />
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Settings is restricted</Typography>
        <Typography sx={{ color: '#64748b', mt: 1, maxWidth: 460 }}>
          Only <b>Admin</b> and <b>Super Admin</b> users can open Settings. An administrator decides who can access which pages.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', overflowY: 'auto', bgcolor: '#f6f8fb', p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <SettingsOutlinedIcon sx={{ color: '#ec6e17', fontSize: 30 }} />
          <Box>
            <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>Settings</Typography>
            <Typography sx={{ color: '#64748b', fontSize: 13.5 }}>Configure your ZUMEN workspace — everything in one place.</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, px: 1.5, py: 0.75, width: { xs: '100%', sm: 320 } }}>
          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
          <InputBase placeholder="Search settings…" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ fontSize: 14, flexGrow: 1 }} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, my: 3 }}>
        <Kpi icon={PeopleAltOutlinedIcon} label="Users" value={kpi.users} color="#3b82f6" />
        <Kpi icon={ContactsOutlinedIcon} label="Clients" value={kpi.clients} color="#0ea5e9" />
        <Kpi icon={FolderOpenOutlinedIcon} label="Drawings" value={kpi.drawings} color="#ec6e17" />
        <Kpi icon={Inventory2OutlinedIcon} label="Orders" value={kpi.orders} color="#16a34a" />
        <Kpi icon={LayersOutlinedIcon} label="Document types" value={DOCUMENT_TYPES.length} color="#8b5cf6" />
        <Kpi icon={SecurityOutlinedIcon} label="Roles" value={4} color="#64748b" />
      </Box>

      {filteredGroups.map((g) => (
        <Box key={g.group} sx={{ mb: 3.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: g.color }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>{g.group}</Typography>
            <Typography sx={{ fontSize: 12, color: '#cbd5e1' }}>· {g.cards.length}</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 2 }}>
            {g.cards.map((c) => <Card key={c.key} c={{ ...c, color: g.color }} onClick={() => setOpenKey(c.key)} />)}
          </Box>
        </Box>
      ))}
      {!filteredGroups.length && (
        <Typography sx={{ color: '#94a3b8', mt: 4 }}>No settings match “{query}”.</Typography>
      )}

      <Drawer anchor="right" open={!!openKey} onClose={() => setOpenKey(null)}
        sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 600, md: 820 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, borderBottom: '1px solid #e5e7eb', bgcolor: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
          {openCard && (<>
            <Box sx={{ width: 30, height: 30, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${openCard.color}14` }}>
              <openCard.icon sx={{ color: openCard.color, fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, color: '#334155', flexGrow: 1 }}>{openCard.title}</Typography>
          </>)}
          <IconButton size="small" onClick={() => setOpenKey(null)}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ p: 3, overflowY: 'auto' }}>
          {openKey && SCREENS[openKey] && SCREENS[openKey]()}
        </Box>
      </Drawer>
    </Box>
  );
};

export default SettingsPage;
