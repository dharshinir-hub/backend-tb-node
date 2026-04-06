import React, { useState } from 'react';
import { Tabs, Tab, Box, Typography } from '@mui/material';
import MachineGroup from '../Machinegroup/machinegroup';
import ReasonGroup from '../Reasongroup/reasongroup';
import ProcessGroup from '../Processgroup/processgroup';
import { cleanCustomerId } from '../../Services/app/operatorservice';

const GroupRegistration = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  const customerId = localStorage.getItem('CustomerID');

  return (
    <div className="pages">
      <div className="pagecontents">
        {/* --- Tabs Header --- */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            textColor="inherit"
            TabIndicatorProps={{ sx: { backgroundColor: '#f47803' } }} aria-label="group registration tabs"
          >
            <Tab label="Machine Group" />
            <Tab label="Reason Group" />
            {cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID && (

              <Tab label="Process Group" />)}
          </Tabs>
        </Box>

        {/* --- Tab Panels --- */}
        <TabPanel value={tabValue} index={0}>
          <MachineGroup IsInGroupReg />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ReasonGroup IsInGroupReg />
        </TabPanel>
        {cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID && (

          <TabPanel value={tabValue} index={2}>
            <ProcessGroup IsInGroupReg />
          </TabPanel>)}
      </div>
    </div>
  );
};

/** Helper Component for Tab Panels **/
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 1 }}>
          <Typography component="div">{children}</Typography>
        </Box>
      )}
    </div>
  );
}

export default GroupRegistration;
