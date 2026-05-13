// src/Routes.js
import React, { useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import Layout from './app/Nav/layout';
import Login from './app/Pages/Login/login';
import Andondashboard from './app/Pages/Andon-Dashboard/andondashboard';
import Shift from './app/Pages/Shift/shift';
import MachineCard from '../src/app/Pages/Machinecard/machinecard';
import ShiftRegistration from './app/Pages/Shiftregistration/shiftreg';
import ComponentRegistration from './app/Pages/Componentregistration/componentreg';
import OperatorRegistration from './app/Pages/Operatorregistration/operatorreg';
import ReasonRegistration from './app/Pages/Reasonregistration/reasonreg';
import MachineList from './app/Pages/Machines/machine';
import Company from './app/Pages/Company/company';
import CurrentShift from './app/Pages/CurrentShift/CurrentShift';
import Analytics from './app/Pages/Analytics/analytics';
import Allocation from './app/Pages/Allocations/allocation';
import OperatorDetails from './app/Pages/Operatordetails/operatordeatil'
import GrafanaEmbed from './app/Pages/MachinesMM/machinemm';
import MachineReport from './app/Pages/Reports/report';
import MachineUtilization from './app/Pages/Machineutilization/machineutilization';
import Operator from './app/Pages/Operator/operator';
import OeeDashboard from './app/Pages/Devices/deviceoee';
import Oee from './app/Pages/Oee/oee';
import NewAnalytics from './app/Pages/New-Analytics/new-analytics';
import { Box } from '@mui/material';
import NewDeviceOee from './app/Pages/NewDeviceOee/newdeviceoee';
import UserRegistration from './app/Pages/Userregistration/userreg';
import { COMPONENT_REGISTRY } from './app/Shared/constants/ComponentRegistry';
import ProtectedRoute from './app/Shared/gaurds/ProtectedRoute';
import { UserDetailsContext } from './app/Shared/context/UserDetailsContext';
import Cycletime from "./app/Pages/CycleTime/cycletime";
import AnalyticOee from "./app/Pages/CycleTime/analyticoee";
import Inprogress from "./app/Pages/CycleTime/inprogresscycle";
import Component from "./app/Pages/CycleTime/component";
import Component1 from "./app/Pages/CycleTime/component1";
import Summary from "./app/Pages/CycleTime/summary";
import PartCycleTime from './app/Pages/CycleTime/partcycletime';
import InprogressOee from './app/Pages/CycleTime/inprogressoee';
import MachineGroup from './app/Pages/Machinegroup/machinegroup';
import OeeTv from './app/Pages/Oee-tv/oeetv';
import BluecardDetails from './app/Pages/BlueCardScreen/bluecarddetails';
import OperatorPerformanceDashboard from './app/Pages/Operator-Performance-Dashboard/OperatorPerformanceDashboard';


// Import other components for your routes

const AppRoutes = () => {
  const { userDetails } = useContext(UserDetailsContext);
  const [pageList, setPageList] = useState([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const usersDetailsData = typeof userDetails === 'string' ? JSON.parse(userDetails) : userDetails
    setPageList(usersDetailsData.pageList || []);
    setInitialized(true);
  }, [userDetails]);

  if (!initialized) return null;

  function PageErrorFallback({ error, resetError }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', color: '#fff',
      fontFamily: 'sans-serif', gap: '12px', textAlign: 'center', padding: '24px'
    }}>
      <h3 style={{ margin: 0 }}>This page ran into an error</h3>
      <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{error?.message}</p>
      <button onClick={resetError} style={{
        padding: '7px 18px', background: '#3b82f6', color: '#fff',
        border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
      }}>
        Retry
      </button>
    </div>
  );
}
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV" element={<Operator />} />
      <Route path="/smc_operator_bf9tz" element={<Operator />} />
      <Route path="/atech_operator_atc67" element={<Operator />} />
      <Route path="/marks_operator_ch8st" element={<Operator />} />
      <Route path="/makino_operator_av5tc" element={<Operator />} />
      <Route path="/gplast_operator_awe6tc" element={<Operator />} />
      <Route path="/demo_operator_av3tc" element={<Operator />} />
      <Route path="/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp" element={< Oee />} />
      <Route path="/Ze9R2tLmN7wQvB2cF4kH2oPjU1yE0aDgT4sK2qWl~3rMnOp" element={< Oee />} />
      <Route path="/pmi-oee-dashboard" element={< OeeTv />} />
      <Route path="/o" element={< Oee />} />
      <Route
        path="/operator"
        element={
          <ProtectedRoute allowed={pageList.includes('operator')}>
            <Operator />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Layout />}>
        <Route path="/operator-performance" element={<OperatorPerformanceDashboard />} />
        {pageList.map((page) => {

          const Component = COMPONENT_REGISTRY[page];
          return (
            <Route
              key={page}
              path={`/${page}`}
              element={
                <ProtectedRoute allowed={pageList.includes(page)}>
                  <Sentry.ErrorBoundary fallback={({ error, resetError }) => (
                    <PageErrorFallback error={error} resetError={resetError} />
                  )}>
                    <Component />
                  </Sentry.ErrorBoundary>
                </ProtectedRoute>
              }
            />
          );
        })}

        {pageList.includes("production-analysis") && (
          <>
            <Route path="/cycletime" element={<Cycletime />} />
            <Route path="/production-summary" element={<Component />} />
            <Route path="/production-runs" element={<Component1 />} />
            <Route path="/summary" element={<Summary />} />
            <Route path="/inprogresscycle" element={<Inprogress />} />
            <Route path="/analyticoee" element={<AnalyticOee />} />
            <Route path="/partwise-cycletime" element={<PartCycleTime />} />
            <Route path="/inprogressoee" element={<InprogressOee />} />
          </>
        )}

        {pageList.includes("bluecard") && (
          <>
            <Route path="/bluecarddetails" element={<BluecardDetails />} />
          </>
        )}

      </Route>
      <Route path="*" element={<Navigate to={'/'} replace />} />
    </Routes>
  )
}

export default AppRoutes;


