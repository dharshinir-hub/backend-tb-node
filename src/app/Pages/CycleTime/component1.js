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
import Tooltip from "@mui/material/Tooltip";

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


const Component1 = () => {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const navigate = useNavigate();

  const location = useLocation();
  const { componentName, code, previousScreen, codeWiseSummary } = location.state
  const storedStart = localStorage.getItem("analyticsStartDate");
  const from = storedStart
    ? Number(storedStart)
    : dayjs().subtract(6, "day").startOf("day").valueOf();

  // Get end date from localStorage or default to today
  const storedEnd = localStorage.getItem("analyticsEndDate");
  const to = storedEnd
    ? Number(storedEnd)
    : dayjs().endOf("day").valueOf();

  // Get selected device from location state (optional)
  const selectedDevice = location.state?.selectedDevice || null;


  console.log('From', from, 'to', to, 'Selected Device', selectedDevice, 'Component', componentName, 'Code', code)

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
  }, [selectedDevice, from, to, devices, shifts, deviceNameIdJson]);

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




  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""].filter(Boolean).join(" ");
  }

  function formatEpoch(epoch) {

    // If epoch is in seconds, convert to milliseconds
    if (epoch.toString().length === 10) {
      epoch *= 1000;
    }

    const date = new Date(epoch);

    const pad = (n) => n.toString().padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // months are 0-based
    const day = pad(date.getDate());

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const strHours = hours.toString().padStart(2, "0");

    return `${day}/${month}/${year} ${strHours}:${minutes}:${seconds} ${ampm}`;
  }




  // Assuming you have componentName (e.g., from props or state)
  const getSelectedComponentData = (componentName, liveComponent) => {
    if (!componentName || !liveComponent) return {};

    // Filter liveComponent per device
    const filteredData = Object.entries(liveComponent).reduce((acc, [deviceName, dataArray]) => {
      // Get only records matching componentName
      const componentRecords = dataArray.filter(item => item.name === componentName);
      if (componentRecords.length > 0) {
        acc[deviceName] = componentRecords; // store device-wise
      }
      return acc;
    }, {});

    return filteredData;
  };



  // Usage example inside your component1 page:
  const filteredComponentData = getSelectedComponentData(componentName, liveComponent);
  console.log("Filtered Component Data:", filteredComponentData);

  const handleBoxClick = (item, deviceName) => {
    navigate("/summary", {
      state: {
        selectedDevice: selectedDevice,
        previousScreen: location.pathname,
        componentName: item.name || 'Component',
        start_time: item.start_time,
        end_time: item.end_time,
        deviceName: deviceName,
        code: item.code,
        highcode:codeWiseSummary

      },
    });
  };



  return (
    <Box display="flex" height="100vh" pt={2}>

      {/* Sidebar */}
      <SidebarPanel
        partNumber={partNumber}
        setPartNumber={setPartNumber}
        reportType={reportType}
        setReportType={setReportType}
        formatDuration={formatDuration}
        from={from}
        to={to}
        highestcomponent={codeWiseSummary}

      />


      {/* Right side content */}
      <Box flex={1} p={3} overflow="auto">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>

          <Typography variant="h5" fontWeight="bold">
            {componentName || code ? `${componentName} (${code})` : "Component Details"}      </Typography>

          {/* Back Button */}
          <Button
            variant="contained"
            onClick={() => navigate("/component", {
              state: { selectedDevice, componentName, code }
            })}
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
            {formatEpoch(from)} → {formatEpoch(to)}
          </Typography>
        )}

        <Typography variant="h6" fontWeight="bold" gutterBottom mt={3}>
          Analyzed {
            Object.values(filteredComponentData).reduce((total, arr) => total + arr.length, 0)
          } Runs
        </Typography>



        {/* Component Boxes in 2 columns */}
        <Grid container spacing={2} mt={2}>
          {Object.entries(filteredComponentData).map(([deviceName, records]) =>
            records.map((item, index) => {
              // Calculate duration in hh:mm:ss
              const durationSeconds = (item.end_time - item.start_time) / 1000;
              function formatSmartDuration(durationSeconds) {
                const hours = Math.floor(durationSeconds / 3600);
                const minutes = Math.floor((durationSeconds % 3600) / 60);
                const seconds = Math.floor(durationSeconds % 60);

                const parts = [];
                if (hours > 0) parts.push(`${hours}h`);
                if (minutes > 0) parts.push(`${minutes}m`);
                if (seconds > 0) parts.push(`${seconds}s`);

                return parts.join(' ') || '0s'; // fallback if duration is 0
              }
              const formatHMS = (timeStr) => {
                if (!timeStr) return "N/A";
                const [h, m, s] = timeStr.split(":").map(Number);
                const parts = [];
                if (h) parts.push(`${h}h`);
                if (m) parts.push(`${m}m`);
                if (s) parts.push(`${s}s`);
                return parts.join(" ");
              };


              return (
                <Grid item xs={12} sm={6} key={`${deviceName}-${index}`}>
                  <Tooltip
                    title={
                      <Box>
                        <Typography variant="body2"><strong>Cycle Time:</strong> {formatHMS(item.cycle_time)}</Typography>
                        <Typography variant="body2"><strong>Handling Time:</strong> {formatHMS(item.handling_time)}</Typography>
                        <Typography variant="body2"><strong>Setup Time:</strong> {formatHMS(item.setup_time)}</Typography>
                      </Box>
                    }
                    placement="bottom"
                    arrow
                    followCursor
                    PopperProps={{
                      modifiers: [
                        {
                          name: 'offset',
                          options: { offset: [10, 10] },
                        },
                      ],
                    }}
                    slotProps={{
                      tooltip: {
                        sx: {
                          backgroundColor: '#cfd7d3ff',
                          color: '#0f172a',
                          fontSize: '13px',
                          borderRadius: '8px',
                          boxShadow: 3,
                          p: 2,
                        },
                      },

                      arrow: {
                        sx: {
                          color: '#1e293b',
                        },
                      },
                    }}
                  >



                    <Box
                      p={2}
                      sx={{
                        border: '1px solid #ccc',
                        borderRadius: 2,
                        boxShadow: 1,
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'scale(1.03)' },

                      }}
                      onClick={() => handleBoxClick(item, deviceName)}
                    >
                      {/* Machine Name */}
                      <Typography variant="subtitle2" fontWeight="bold" mb={1} fontSize="1.1rem">
                        {item.machine_name || deviceName}
                      </Typography>

                      {/* Start & End Time */}
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="textSecondary" fontSize="0.85rem">
                          {formatEpoch(item.start_time)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" fontSize="0.85rem">
                          {formatEpoch(item.end_time)}
                        </Typography>
                      </Box>

                      {/* Duration */}
                      <Box display="flex" justifyContent="end" mb={0.5}>
                        <Typography variant="body2" color="black" fontSize="1.5rem">
                          {formatSmartDuration(durationSeconds)}
                        </Typography>
                      </Box>
                    </Box>
                  </Tooltip>
                </Grid>

              );
            })
          )}
        </Grid>





      </Box>

    </Box>
  );

}

export default Component1;