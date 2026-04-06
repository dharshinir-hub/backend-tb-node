import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './sidebar'; // Ensure correct import path

const Layout = () => {
  const location = useLocation();
  const showSidebar = location.pathname === '/andon-dashboard' ||
    location.pathname === '/shift' ||
    location.pathname === '/machine-card' ||
    location.pathname === '/shift-registration' ||
    location.pathname === '/component-registration' ||
    location.pathname === '/reason-registration' ||
    // location.pathname === '/company' ||
    location.pathname === '/CurrentShift' ||
    location.pathname === '/analytics' ||
    location.pathname === '/machines' ||
    location.pathname === '/operator-registration' ||
    location.pathname === '/operator-details' ||
    location.pathname === '/allocation' ||
    location.pathname === '/machinemm' ||
    location.pathname === '/reports' ||
    location.pathname === '/deviceoee' ||
    location.pathname === '/user-registration' ||
    location.pathname === '/machineutilization' ||
    location.pathname === '/production-analysis' ||
    location.pathname === '/deviceoee' ||
    location.pathname === '/machineutilization' ||
    location.pathname === '/cycletime' ||
    location.pathname === '/inprogresscycle' ||
    location.pathname === '/production-summary' ||
    location.pathname === '/production-runs' ||
    location.pathname === '/summary' ||
    location.pathname === '/analyticoee' ||
    location.pathname === '/inprogressoee' ||
    location.pathname === '/partwise-cycletime' ||
    location.pathname === '/machines-group' ||
    location.pathname === '/operator-leaderboard' ||
    location.pathname === '/notification-center' ||
    location.pathname === '/kpi-dashboard' ||
    location.pathname === '/group' ||
    location.pathname === '/production-overview' ||
    location.pathname === '/settings' ||
    location.pathname === '/production-metrics' ||
    location.pathname === '/bluecard' ||
    location.pathname === '/bluecarddetails' ||
    location.pathname === '/bluecardreport' ||
    location.pathname === '/quality' || 
    location.pathname === '/machine-status' ||
    location.pathname === '/operator-performance';

  return (
    <>
      {showSidebar && <Sidebar />} {/* Conditionally render the Sidebar */}
    </>
  );
};

export default Layout;
