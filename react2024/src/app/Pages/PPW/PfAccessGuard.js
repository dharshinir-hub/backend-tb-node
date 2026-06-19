import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import { isPfPageAllowed } from '../../Services/app/zumensettings';

// Gates a Paperless Factory page by the per-user access set in "User management".
// While checking it shows a brief loader; if denied it shows a restricted screen;
// otherwise it renders the page. Safe defaults live in isPfPageAllowed().
const PfAccessGuard = ({ pageKey, label, children }) => {
  const [state, setState] = useState('checking'); // checking | allowed | denied
  useEffect(() => {
    let alive = true;
    isPfPageAllowed(pageKey).then((ok) => { if (alive) setState(ok ? 'allowed' : 'denied'); });
    return () => { alive = false; };
  }, [pageKey]);

  if (state === 'checking') {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress sx={{ color: '#ec6e17' }} /></Box>;
  }
  if (state === 'denied') {
    return (
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#f6f8fb', p: 4, textAlign: 'center' }}>
        <SecurityOutlinedIcon sx={{ fontSize: 56, color: '#cbd5e1', mb: 1 }} />
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{label || 'This page'} is restricted</Typography>
        <Typography sx={{ color: '#64748b', mt: 1, maxWidth: 460 }}>
          Your account doesn’t have access to {label || 'this page'}. Ask an administrator to grant it in
          {' '}Settings → User management.
        </Typography>
      </Box>
    );
  }
  return children;
};

export default PfAccessGuard;
