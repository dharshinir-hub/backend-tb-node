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


const Inprogress = () => {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const navigate = useNavigate();

  const location = useLocation();
  const { from, to } = location.state || {
    from: dayjs().subtract(6, "day").startOf("day").valueOf(),
    to: dayjs().endOf("day").valueOf()
  };

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

   console.log('Shifts', shifts)

 let startEpoch = null;
let endEpoch = null;

// Helper function to convert "HH:mm:ss" to epoch
function timeToEpoch(timeStr, addDay = false) {
  if (!timeStr) return null;
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
  if (addDay) date.setDate(date.getDate() + 1);
  return date.getTime();
}

// Only assign if shifts exist
if (Array.isArray(shifts) && shifts.length > 0) {
  // First shift start
  startEpoch = timeToEpoch(shifts[0]?.start_time);

  // Last shift end
  const lastShift = shifts[shifts.length - 1];
  endEpoch = timeToEpoch(lastShift?.end_time, lastShift?.end_time < lastShift?.start_time);
}


  console.log("First Shift Start Time:", startEpoch);
  console.log("Last Shift End Time:", endEpoch);

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.name] = device.id.id;
        return acc;
      }, {});
      setDeviceNameIdJson(nameIdMap);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  useEffect(() => {
    if (customerId && newToken) {
      fetchShifts();
      fetchDevices();
    }
  }, [customerId, newToken]);


  const [liveComponent, setLiveComponent] = useState([]);


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



// 2️⃣ cycletime_faster
useEffect(() => {
  const fetchCycleTimeFaster = async () => {
    if (!startEpoch || !endEpoch) return;

    try {
      const data = await telemetrykeydata(
        customerId,
        "CUSTOMER",
        "live_component",
        startEpoch,
        endEpoch
      );

      if (!data) {
        console.warn("No data received for component");
        setLiveComponent([]);
        return;
      }

      const parsedValues = parseTelemetryValues(data, "live_component");
      console.log("Final live component values:", parsedValues);

      setLiveComponent(parsedValues);
    } catch (error) {
      console.error("Error fetching live_component:", error);
      setLiveComponent([]);
    }
  };

  fetchCycleTimeFaster();
}, [customerId, startEpoch, endEpoch]);


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
      onClick={() => navigate('/analytics')}
      color="warning"
      sx={{
        backgroundColor: '#626262',
        '&:hover': { backgroundColor: '#4d4d4d' }
      }}
    >
      Back
    </Button>
  </Box>



  {startEpoch && endEpoch && (
    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
      {new Date(startEpoch).toLocaleString()} → {new Date(endEpoch).toLocaleString()}
    </Typography>
  )}

{/* <Typography variant="h6" fontWeight="bold" gutterBottom mt={3}>
  Analyzed { 
    (cycleTimeSlower?.length || 0) + 
    (cycleTimeFaster?.length || 0) + 
    (cycleTimeBaselineSlower?.length || 0) + 
    (cycleTimeBaselineFaster?.length || 0)
  } Runs
</Typography> */}

 
</Box>

  </Box> 
);

}
 export default Inprogress;