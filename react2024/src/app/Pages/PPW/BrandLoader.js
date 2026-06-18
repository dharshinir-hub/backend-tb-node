import React from 'react';
import { Box, Typography } from '@mui/material';
import spinner from '../../../assets/spinner.gif';

// Branded loading screen — uses the same spinning gear symbol the other Yantra
// dashboards use, centered on a light background to match the app theme.
const BrandLoader = ({ height = '60vh', label = 'Loading…' }) => (
  <Box
    sx={{
      height,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1.25,
      bgcolor: '#ffffff',
    }}
  >
    <img src={spinner} alt="Loading" style={{ width: 84, height: 84 }} />
    {label && <Typography sx={{ fontSize: 13, color: '#94a3b8', letterSpacing: 0.4 }}>{label}</Typography>}
  </Box>
);

export default BrandLoader;
