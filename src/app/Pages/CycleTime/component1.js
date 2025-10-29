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
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
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


  console.log('From', from, 'to', to, 'Selected Device', selectedDevice, 'Component', componentName, 'Code', code, 'codeWiseSummary',codeWiseSummary )

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
  console.log('Shifts', shifts);

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

  const removeFutureTsValues = (filteredComponentData) => {
  const now = Date.now(); // current timestamp in ms

  const validData = Object.entries(filteredComponentData).reduce((acc, [deviceName, records]) => {
    // Filter out future timestamps
    const pastRecords = records.filter(item => item.ts <= now);
    if (pastRecords.length > 0) {
      acc[deviceName] = pastRecords;
    }
    return acc;
  }, {});

  return validData;
};

// Usage:
const filteredComponentData1 = removeFutureTsValues(filteredComponentData);

console.log("Filtered Component Data (No Future TS):", filteredComponentData1);

function addShiftToData(filteredComponentData1, shifts) {
  const updated = {};

  Object.entries(filteredComponentData1).forEach(([machineName, records]) => {
    if (!Array.isArray(records)) return;

    const processed = records.map((item) => {
      const itemStart = Number(item.start_time);
      const itemEnd = Number(item.end_time);
      const itemDate = new Date(itemStart);
      const baseDate = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

      let matchedShift = shifts.find((shift) => {
        const [startH, startM, startS] = shift.start_time.split(":").map(Number);
        const [endH, endM, endS] = shift.end_time.split(":").map(Number);

        // Try current day
        const shiftStart = new Date(baseDate);
        shiftStart.setHours(startH, startM, startS, 0);

        let shiftEnd = new Date(baseDate);
        shiftEnd.setHours(endH, endM, endS, 0);

        // Handle overnight shift
        if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

        if (
          (itemStart >= shiftStart.getTime() && itemStart < shiftEnd.getTime()) ||
          (itemEnd > shiftStart.getTime() && itemEnd <= shiftEnd.getTime())
        ) {
          return true;
        }

        // 🔹 Try previous day (to catch after-midnight part of overnight shift)
        const prevShiftStart = new Date(shiftStart);
        prevShiftStart.setDate(prevShiftStart.getDate() - 1);
        const prevShiftEnd = new Date(shiftEnd);
        prevShiftEnd.setDate(prevShiftEnd.getDate() - 1);

        return (
          (itemStart >= prevShiftStart.getTime() && itemStart < prevShiftEnd.getTime()) ||
          (itemEnd > prevShiftStart.getTime() && itemEnd <= prevShiftEnd.getTime())
        );
      });

      return {
        ...item,
        shift_no: matchedShift ? matchedShift.shift_no : "Unknown"
      };
    });

    processed.sort((a, b) => b.start_time - a.start_time);
    updated[machineName] = processed;
  });

  return updated;
}

// ✅ Example usage
const updatedfilteredData = addShiftToData(filteredComponentData1, shifts);
console.log("✅ Shift added filteredData:", updatedfilteredData);


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
        codeWiseSummary:codeWiseSummary

      },
    });
  };


 const formatSmartDuration = (durationSeconds) => {
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = Math.floor(durationSeconds % 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours} hours`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.join(" ") || "0s";
  };

  const formatEpochTime = (epoch) => {
    if (!epoch) return "N/A";
    return new Date(epoch).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (epoch) => {
    if (!epoch) return "N/A";
    const date = new Date(epoch);
    return date.toLocaleDateString("en-GB"); // e.g. 25/10/2025
  };

  // 🔹 Group records by date
  const groupByDate = (records) => {
    const grouped = {};
    records.forEach((item) => {
      const dateKey = formatDate(item.start_time);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });
    return grouped;
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
            onClick={() => navigate("/production-summary", {
              state: { selectedDevice, componentName, code, codeWiseSummary }
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
  {Object.keys(updatedfilteredData).length === 0 ? (
    <Grid
      item
      xs={12}
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="200px"
    >
      <CircularProgress size={24} />
      <Typography mt={1}>Loading data...</Typography>
    </Grid>
  ) : (
    Object.entries(updatedfilteredData).map(([deviceName, records]) => {
      const groupedData = groupByDate(records);

      return (
        <Grid item xs={12} key={deviceName}>
          <TableContainer
            component={Paper}
            sx={{
              mb: 3,
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            <Table size="medium" sx={{ "& td, & th": { padding: "12px 16px" } }}>
              {/* Machine Header */}
              <TableHead>
                <TableRow sx={{ backgroundColor: "#1e3a8a" }}>
                  <TableCell
                    colSpan={5}
                    sx={{
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "1rem",
                      py: 1.5,
                      border: "1px solid #ccc",
                    }}
                  >
                    Machine: {deviceName}
                  </TableCell>
                </TableRow>

                {/* Column Headers */}
                <TableRow sx={{ backgroundColor: "#e2e8f0" }}>
                  <TableCell sx={{ fontWeight: "bold", fontSize: "0.95rem", border: "1px solid #ccc" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold", fontSize: "0.95rem", border: "1px solid #ccc" }}>Shift</TableCell>
                  <TableCell sx={{ fontWeight: "bold", fontSize: "0.95rem", border: "1px solid #ccc" }}>Start Time</TableCell>
                  <TableCell sx={{ fontWeight: "bold", fontSize: "0.95rem", border: "1px solid #ccc" }}>End Time</TableCell>
                  <TableCell sx={{ fontWeight: "bold", fontSize: "0.95rem", border: "1px solid #ccc" }}>Duration</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {Object.entries(groupedData).map(([date, dateRecords]) => {
                  return dateRecords.map((item, index) => {
                    const durationSeconds = (item.end_time - item.start_time) / 1000;

                    return (
                      <TableRow
                        key={`${date}-${index}`}
                        hover
                        sx={{
                          height: "55px",
                          cursor: "pointer", // 🔹 row clickable
                          "&:hover": { backgroundColor: "#f8fafc" },
                        }}
                        onClick={() => handleBoxClick(item, deviceName)} // 🔹 added here
                      >
                        {index === 0 ? (
                          <TableCell
                            rowSpan={dateRecords.length}
                            sx={{
                              fontWeight: "bold",
                              verticalAlign: "middle",
                              fontSize: "0.95rem",
                              border: "1px solid #ccc",
                            }}
                          >
                            {date}
                          </TableCell>
                        ) : null}
                          <TableCell sx={{ fontSize: "0.95rem", border: "1px solid #ccc" }}>
                          Shift {item.shift_no}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.95rem", border: "1px solid #ccc" }}>
                          {formatEpochTime(item.start_time)}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.95rem", border: "1px solid #ccc" }}>
                          {formatEpochTime(item.end_time)}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.95rem", border: "1px solid #ccc" }}>
                          {formatSmartDuration(durationSeconds)}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          </TableContainer>
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