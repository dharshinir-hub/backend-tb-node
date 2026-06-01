import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Card,
  Grid, CircularProgress
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


const Component = () => {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const hasStartedRef = useRef(false);
  const hasStartedRef1 = useRef(false);
const [searchText, setSearchText] = useState("");


  const navigate = useNavigate();

  const location = useLocation();
  const storedStart = localStorage.getItem("analyticsStartDate");
  const from = storedStart
    ? Number(storedStart)
    : dayjs().subtract(6, "day").startOf("day").valueOf();

  // Get end date from localStorage or default to today
  const storedEnd = localStorage.getItem("analyticsEndDate");
  const to = storedEnd
    ? Number(storedEnd)
    : dayjs().endOf("day").valueOf();

  const { selectedDevice, codeWiseSummary } = location.state || null;

  console.log('From', from, 'to', to, 'Selected Device', selectedDevice, 'codeWiseSummary', codeWiseSummary)

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
  console.log('deviceNameIdJson', deviceNameIdJson);
  console.log(devices, 'devices---------------------')


  useEffect(() => {
    if (hasStartedRef1.current) return;
    hasStartedRef1.current = true;
    fetchShifts();
    fetchDevices();
    console.log('fetching devices ---------------------')
    console.log('devvicenameidjson', '-------------------------------')

    // intervalRef2.current = setInterval(fetchAllMachineData, 5000);
    return () => {
      // clearInterval(intervalRef2.current);
      hasStartedRef1.current = false;
    };
  }, []);




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
  const [operationsData, setOperationsData] = useState([]);


  useEffect(() => {

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    fetchTelemetryData();

    // intervalRef2.current = setInterval(fetchAllMachineData, 5000);
    return () => {
      // clearInterval(intervalRef2.current);
      hasStartedRef.current = false;
    };
  }, [selectedDevice, from, to, devices]);

  const fetchTelemetryData = async () => {
    if (!from || !to || !selectedDevice) return;

    try {
      const deviceIds = Array.isArray(selectedDevice)
        ? selectedDevice
        : [selectedDevice];

      const allDataArray = await Promise.all(
        deviceIds.map(async (deviceId) => {
          const deviceName = deviceNameIdJson[deviceId] || "Unknown Device";

          // ✅ Fetch both keys together
          const data = await telemetrykeydata(
            deviceId,
            "DEVICE",
            ["operations", "live_component"],
            from,
            to
          );

          // Parse both keys separately
          const operations = parseTelemetryValues(data, "operations");
          const liveComponent = parseTelemetryValues(data, "live_component");

          return { deviceName, operations, liveComponent };
        })
      );

      // Build the two separate state objects
      const operationsObject = {};
      const liveComponentObject = {};

      allDataArray.forEach((item) => {
        operationsObject[item.deviceName] = item.operations;
        liveComponentObject[item.deviceName] = item.liveComponent;
      });

      // Update both states
      setOperationsData(operationsObject);
      setLiveComponent(liveComponentObject);
    } catch (error) {
      console.error("Error fetching telemetry:", error);
      setOperationsData({});
      setLiveComponent({});
    }
  };


  console.log('Component List', liveComponent);
  console.log('Operations Data', operationsData);


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


  const [groupedOperations, setGroupedOperations] = useState([]);
  const [finalGroup, setFinalGroup] = useState([]); // ✅ now an array

  useEffect(() => {
    if (!operationsData || Object.keys(operationsData).length === 0) return;

    const groupedData = Object.entries(operationsData).reduce((acc, [machineName, dataArray]) => {
      // Group by code
      const groupedByCode = dataArray.reduce((codeAcc, item) => {
        const code = item.code || "Unknown Code";
        if (!codeAcc[code]) codeAcc[code] = [];
        codeAcc[code].push(item);
        return codeAcc;
      }, {});

      // Group by start_time + end_time within each code
      const finalGroupForMachine = Object.entries(groupedByCode).flatMap(([code, items]) => {
        const groupedByTime = items.reduce((timeAcc, item) => {
          const start = item.start_time || "Unknown Start";
          const end = item.end_time || "Unknown End";
          const key = `${start}_${end}`;
          if (!timeAcc[key]) timeAcc[key] = [];
          timeAcc[key].push(item);
          return timeAcc;
        }, {});

        // ✅ Convert the grouped object into array format
        return Object.entries(groupedByTime).map(([key, timeItems]) => {
          const [start_time, end_time] = key.split("_");
          return { code, start_time, end_time, items: timeItems };
        });
      });

      acc[machineName] = finalGroupForMachine;
      return acc;
    }, {});

    // ✅ Flatten all machine data into one array (optional)
    const allFinalGroups = Object.values(groupedData).flat();

    setGroupedOperations(groupedData);
    setFinalGroup(allFinalGroups); // ✅ now array-based
  }, [operationsData]);

  console.log("✅ Grouped by code + time per machine:", groupedOperations);
  console.log("✅ Final group data (array format):", finalGroup);

  const getFirstItemsFromGroups = (finalGroupArray) => {
    if (!finalGroupArray || finalGroupArray.length === 0) return [];

    return finalGroupArray
      .map(group => group.items[0]) // pick first item of each group
      .filter(Boolean); // remove undefined/nulls if any
  };

  // Usage:
  const firstItems = getFirstItemsFromGroups(finalGroup);

  console.log("✅ First item from each group:", firstItems);

  // firstItems: array of items, each with a "code" property

  const sortItemsByCodeFrequencyDesc = (items) => {
    if (!items || items.length === 0) return [];

    // 1️⃣ Count occurrences of each code
    const codeCount = items.reduce((acc, item) => {
      const code = item.code || "Unknown";
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    // 2️⃣ Sort items by the frequency of their code (descending)
    return [...items].sort((a, b) => {
      const countA = codeCount[a.code] || 0;
      const countB = codeCount[b.code] || 0;
      return countB - countA; // descending
    });
  };

  // Usage:
  const sortedFirstItems = sortItemsByCodeFrequencyDesc(firstItems);

  console.log("✅ First items sorted by code frequency (desc):", sortedFirstItems);



  const groupedDataObject = {};

  for (const item of sortedFirstItems) {
    const { code, operation_name, goodvsexp, name } = item;

    if (!code || operation_name === "No Operations") continue;

    // Split numerator & denominator → "5/10"
    const [numStr, denStr] = goodvsexp?.split('/') ?? ["0", "0"];
    const numerator = parseInt(numStr, 10) || 0;
    const denominator = parseInt(denStr, 10) || 0;

    const machineName = name ?? "Unknown";

    if (!groupedDataObject[code]) {
      groupedDataObject[code] = {
        code,
        operation_name,
        machines: new Set(),
        numeratorTotal: 0,
        denominatorTotal: 0,
      };
    }

    groupedDataObject[code].machines.add(machineName);

    // Add values
    groupedDataObject[code].numeratorTotal += numerator;
    groupedDataObject[code].denominatorTotal += denominator;
  }

  // Convert to finalReport
  const finalReport = Object.values(groupedDataObject).map(group => ({
    code: group.code,
    operation_name: group.operation_name,
    machines: Array.from(group.machines).join(', '),
    // Store combined like "471/100"
    parts: `${group.numeratorTotal}/${group.denominatorTotal}`,
    numerator: group.numeratorTotal,
    denominator: group.denominatorTotal
  }));

  console.log('final report', finalReport);

  // Map back to componentMachineArray
  const updatedComponentMachineArray = componentMachineArray.map(machineItem => {
    const match = finalReport.find(r => r.code === machineItem.code);

    return {
      ...machineItem,
      parts: match ? match.parts : "0/0",         // "471/100"
      numerator: match ? match.numerator : 0,
      denominator: match ? match.denominator : 0
    };
  });

  console.log("Updated Unique Component Data", updatedComponentMachineArray);

  const filteredComponents = updatedComponentMachineArray.filter(item =>
  item.name.toLowerCase().includes(searchText.toLowerCase()) ||
  item.code.toLowerCase().includes(searchText.toLowerCase())
);
  console.log("Filtered Components:", filteredComponents);

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
        from={from}
        to={to}
        highestcomponent={codeWiseSummary}
      />


      {/* Right side content */}
      <Box flex={1} p={3} overflow="auto">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          {/* Heading */}
          <Typography variant="h5" fontWeight="bold">
            Production Summary
          </Typography>

           <Box display="flex" alignItems="center" gap={2}>
    <TextField
      size="small"
      placeholder="Search component or code..."
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      sx={{ width: 250 }}
    />

          {/* Back Button */}
          <Button
            variant="contained"
            onClick={() => navigate('/production-analysis')}
            color="warning"
            sx={{
              backgroundColor: '#626262',
              '&:hover': { backgroundColor: '#4d4d4d' }
            }}
          >
            Back
          </Button>
        </Box>

</Box>


        {from && to && (
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            {new Date(from).toLocaleString()} → {new Date(to).toLocaleString()}
          </Typography>
        )}

        <Typography variant="h6" fontWeight="bold" gutterBottom mt={3}>
          Analyzed {
            (updatedComponentMachineArray?.length || 0)
          } Runs
        </Typography>

        {/* Component Boxes in 2 columns */}
        <Grid container spacing={2} mt={2}>
          {updatedComponentMachineArray.length === 0 ? (
            <Grid
              item
              xs={12}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress size={20} />
              <Typography>Loading data...</Typography>

            </Grid>
          ) : (
            filteredComponents.map((item, index) => (
              <Grid item xs={12} sm={6} key={index}>
                <Box
                  p={2}
                  sx={{
                    position: "relative", // ✅ needed for absolute positioning
                    border: "1px solid #151b48ff",
                    borderRadius: 2,
                    boxShadow: 1,
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    transition: "0.2s",
                    "&:hover": { transform: "scale(1.03)" },
                  }}
                  onClick={() =>
                    navigate("/production-runs", {
                      state: {
                        selectedDevice,
                        previousScreen: location.pathname,
                        componentName: item.name,
                        code: item.code,
                        from,
                        to,
                        codeWiseSummary,
                      },
                    })
                  }
                >
                  {/* ✅ Top-right corner parts label */}
                  <Typography
                    variant="body2"
                    sx={{
                      position: "absolute",
                      top: 20,
                      right: 12,
                      fontWeight: "bold",
                      background: "#e6eff2ff",
                      px: 1,
                      py: 0.2,
                      borderRadius: 1,
                      color: "#093d71ff",
                      cursor: "pointer",
                      "&:hover": { background: "#d0e1e8ff" },
                    }}
                    // onClick={(e) => {
                    //   e.stopPropagation();
                    //   navigate("/partwise-cycletime", {
                    //     state: {
                    //       previousScreen: location.pathname,
                    //       componentName: item.name,
                    //       code: item.code,
                    //       start_time: from,
                    //       end_time: to,
                    //       to,
                    //       deviceName: item.machines.join(","),
                    //       selectedDevice,
                    //       machineId: item.machineIds,
                    //       codeWiseSummary
                    //     },
                    //   });
                    // }}
                  >
                    Parts: {item.parts}
                  </Typography>


                  <Typography variant="subtitle1" fontWeight="bold">
                    {item.name} ({item.code})
                  </Typography>

                  <Typography variant="body2" color="textSecondary" mt={1}>
                    Machines: {item.machines.join(", ")}
                  </Typography>
                </Box>
              </Grid>

            ))
          )}
        </Grid>


      </Box>

    </Box>
  );

}

export default Component;