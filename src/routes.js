// src/Routes.js
import React, { useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
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




// Import other components for your routes

const AppRoutes = () => {
  const { userDetails } = useContext(UserDetailsContext);
  const [pageList, setPageList] = useState([]);

  useEffect(() => {
    const usersDetailsData = typeof userDetails === 'string' ? JSON.parse(userDetails) : userDetails
    setPageList(usersDetailsData.pageList || []);
  }, [userDetails]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV" element={<Operator />} />
      <Route path="/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp" element={< Oee />} />
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
        {pageList.map((page) => {
          const Component = COMPONENT_REGISTRY[page];
          return (
            <Route
              key={page}
              path={`/${page}`}
              element={
                <ProtectedRoute allowed={pageList.includes(page)}>
                  <Component />
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
          </>
        )}
      </Route>

      {/* <Route path="/" element={<Layout />}>
      <Route path="andon-dashboard" element={<Andondashboard />} />
      <Route path="/shift" element={<Shift />} />
      <Route path="/machine-card" element={<MachineCard />} />
      <Route path="/shift-registration" element={<ShiftRegistration />} />
      <Route path="/component-registration" element={<ComponentRegistration />} />
      <Route path="/operator-registration" element={<OperatorRegistration />} />
      <Route path="/user-registration" element={<UserRegistration />} />
      <Route path="/reason-registration" element={<ReasonRegistration />} />
      <Route path="/machines" element={<MachineList />} />
      <Route path="/company" element={<Company />} />
      <Route path="/CurrentShift" element={<CurrentShift />} />
      <Route path="/analytics" element={<NewAnalytics />} />
      <Route path="/allocation" element={<Allocation />} />
      <Route path="/operator-details" element={<OperatorDetails />} />
      <Route path="/machinemm" element={<GrafanaEmbed />} />
      <Route path="/report" element={<MachineReport />} />
      <Route path="/machineutilization" element={<MachineUtilization />} />
      <Route path="/deviceoee" element={
          <NewDeviceOee />
      } />
    </Route> */}
      <Route path="*" element={<Navigate to={'/'} replace />} />
    </Routes>
  )
}
//       <Route path="/production-analysis" element={<Analytics />} />
//       <Route path="/cycletime" element={<Cycletime />} />
//       <Route path="/production-summary" element={<Component />} />
//       <Route path="/production-runs" element={<Component1 />} />
//       <Route path="/summary" element={<Summary />} />
//       <Route path="/inprogresscycle" element={<Inprogress />} />
//       <Route path="/analyticoee" element={<AnalyticOee />} />

//     </Route>
//   </Routes>
// );

export default AppRoutes;

