import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Card,
  Grid
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata
} from '../../Services/app/companyservice';
import dayjs from "dayjs";
import { useLocation } from "react-router-dom";
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { SidebarPanel } from "../../Pages/AnalyticsSidepanel/analyticslayout";


const Component = () =>  {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const navigate = useNavigate();

  const location = useLocation();
  const { from, to , selectedDevice} = location.state || {
    from: dayjs().subtract(6, "day").startOf("day").valueOf(),
    to: dayjs().endOf("day").valueOf()
  };

  console.log('From', from, 'to', to, 'Selected Device', selectedDevice)

  const Id = localStorage.getItem("CustomerID");
  let customerId = decodeURIComponent(Id || "").replace(/^"|"$/g, "");
  const newToken = localStorage.getItem("newToken");

  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, "allShift");
      setShifts(result[0]?.value || []);
    } catch (err) {
      console.error("Failed to fetch shifts", err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
      const nameIdMap = devicesList.reduce((acc, device) => {
       acc[device.id.id] = device.name;
        return acc;
      }, {});
      setDeviceNameIdJson(nameIdMap);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };
  

  useEffect(() => {
      fetchShifts();
      fetchDevices();
      console.log('fetching devices ---------------------')
  }, []);


  const [cycleTimeSlower, setCycleTimeSlower] = useState([]);
const [cycleTimeFaster, setCycleTimeFaster] = useState([]);
const [cycleTimeBaselineSlower, setCycleTimeBaselineSlower] = useState([]);
const [cycleTimeBaselineFaster, setCycleTimeBaselineFaster] = useState([]);

// Helper function to parse telemetry data
const parseTelemetryValues = (data, key) => {
  const values = data?.[key] || [];
  return values
    .map(point => {
      try {
        const parsed = typeof point.value === "string" ? JSON.parse(point.value) : point.value;
        // Ensure parsed is an object
        return parsed && typeof parsed === "object" ? { ts: point.ts, ...parsed } : null;
      } catch {
        return null;
      }
    })
    .filter(v => v !== null);
};

  const [liveComponent, setLiveComponent] = useState([]);

useEffect(() => {
  const fetchCycleTimeFaster = async () => {
    if (!from || !to || !selectedDevice) return;

    try {
      const deviceIds = Array.isArray(selectedDevice) ? selectedDevice : [selectedDevice];

      // Fetch data for all devices in parallel
      const allDataArray = await Promise.all(
        deviceIds.map(async (deviceId) => {
          const deviceName = deviceNameIdJson[deviceId] || "Unknown Device";
          const data = await telemetrykeydata(
            deviceId,
            "DEVICE",
            "live_component",
            from,
            to
          );
          const parsedData = parseTelemetryValues(data, "live_component");

          return { deviceName, parsedData };
        })
      );

      // Convert array to object: { devicename: data }
      const allDataObject = allDataArray.reduce((acc, curr) => {
        acc[curr.deviceName] = curr.parsedData;
        return acc;
      }, {});

      console.log("Mapped live component values:", allDataObject);
      setLiveComponent(allDataObject);
    } catch (error) {
      console.error("Error fetching live_component:", error);
      setLiveComponent({});
    }
  };


  fetchCycleTimeFaster();
}, [selectedDevice, from, to,devices,shifts,deviceNameIdJson]);

console.log('Component List', liveComponent);


const getComponentMachineArray = (liveComponent) => {
  const componentMap = {};

  // Loop through each machine and its data
  Object.entries(liveComponent).forEach(([machineName, dataArray]) => {
    dataArray.forEach(item => {
      if (!componentMap[item.code]) {
        // First time seeing this component
        componentMap[item.code] = {
          code: item.code,
          name: item.name,
          machines: [machineName]
        };
      } else {
        // Add machine if not already present
        if (!componentMap[item.code].machines.includes(machineName)) {
          componentMap[item.code].machines.push(machineName);
        }
      }
    });
  });

  // Convert map to array
  return Object.values(componentMap);
};

const componentMachineArray = getComponentMachineArray(liveComponent);
console.log("Unique component array with machines:", componentMachineArray);

  const [operationsData, setOperationsData] = useState([]);

useEffect(() => {
  const fetchOperationsData = async () => {
    if (!from || !to || !selectedDevice) return;

    try {
      // Ensure selectedDevice is an array
      const deviceIds = Array.isArray(selectedDevice) ? selectedDevice : [selectedDevice];

      // Fetch operations data for all devices in parallel
      const allDataArray = await Promise.all(
        deviceIds.map(async (deviceId) => {
          const deviceName = deviceNameIdJson[deviceId] || "Unknown Device";

          const data = await telemetrykeydata(
            deviceId,
            "DEVICE",
            "operations", // key changed to operations
            from,
            to
          );

          const parsedData = parseTelemetryValues(data, "operations");

          return { deviceName, parsedData };
        })
      );

      // Convert array to object: { deviceName: parsedData }
      const allDataObject = allDataArray.reduce((acc, curr) => {
        acc[curr.deviceName] = curr.parsedData;
        return acc;
      }, {});

      setOperationsData(allDataObject); // Store in state
    } catch (error) {
      console.error("Error fetching operations data:", error);
      setOperationsData({});
    }
  };

  fetchOperationsData();
}, [selectedDevice, from, to, devices, shifts, deviceNameIdJson]);


console.log('Operations Data', operationsData);

  const [groupedoperations, setGroupedOperations] = useState([]);


useEffect(() => {
  if (!operationsData || Object.keys(operationsData).length === 0) return;

  // Group data per machine by code
  const groupedData = Object.entries(operationsData).reduce((acc, [machineName, dataArray]) => {
    // dataArray = array of telemetry objects for that machine
    const groupedByCode = dataArray.reduce((codeAcc, item) => {
      const code = item.code || "Unknown Code";
      if (!codeAcc[code]) codeAcc[code] = [];
      codeAcc[code].push(item);
      return codeAcc;
    }, {});

    acc[machineName] = groupedByCode;
    return acc;
  }, {});

  console.log("✅ Grouped operations by code per machine:", groupedData);
  setGroupedOperations(groupedData);
}, [operationsData]);


  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""].filter(Boolean).join(" ");
  }

  return (
  <Box display="flex" height="100vh" pt={2}>
    
    {/* Sidebar */}
      <SidebarPanel
        partNumber={partNumber}
        setPartNumber={setPartNumber}
        reportType={reportType}
        setReportType={setReportType}
        formatDuration={formatDuration}
        from = {from}
        to = {to}
      />


    {/* Right side content */}
  <Box flex={1} p={3} overflow="auto">
  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
    {/* Heading */}
    <Typography variant="h5" fontWeight="bold">
      Production Summary
    </Typography>

    {/* Back Button */}
    <Button
      variant="contained"
      onClick={() => navigate('/componentanalysis')}
      color="warning"
      sx={{
        backgroundColor: '#626262',
        '&:hover': { backgroundColor: '#4d4d4d' }
      }}
    >
      Back
    </Button>
  </Box>



  {from && to && (
    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
      {new Date(from).toLocaleString()} → {new Date(to).toLocaleString()}
    </Typography>
  )}

<Typography variant="h6" fontWeight="bold" gutterBottom mt={3}>
  Analyzed { 
    (componentMachineArray?.length || 0)
  } Runs
</Typography>

  {/* Component Boxes in 2 columns */}
  <Grid container spacing={2} mt={2}>
    {componentMachineArray.map((item, index) => (
      <Grid item xs={12} sm={6} key={index}>
        <Box
          p={2} 
          sx={{
            border: '1px solid #ccc',
            borderRadius: 2,
            boxShadow: 1,
            backgroundColor: '#fff'
          }}
        >
          {/* Component Name and Parts count */}
          <Typography variant="subtitle1" fontWeight="bold">
            {item.name} (0 parts)
          </Typography>

          {/* Machines list */}
          <Typography variant="body2" color="textSecondary" mt={1}>
            Machines: {item.machines.join(', ')}
          </Typography>
        </Box>
      </Grid>
    ))}
  </Grid>
  
</Box>

  </Box> 
);

}

export default Component;