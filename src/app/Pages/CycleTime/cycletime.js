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
  Grid,CircularProgress
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


const Cycletime = () => {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [component, setComponent] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState("all");
  const [loadingTimeoutReached, setLoadingTimeoutReached] = useState(false);

  const [loader, setLoader] = useState(false);

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

  // Get selected device from location state (optional)
  const {selectedDevice,codeWiseSummary} = location.state || null;

  console.log('From', from, 'to', to, 'Selected Device', selectedDevice,'codeWiseSummary',codeWiseSummary)

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
    fetchComponent();
    console.log('fetching devices ---------------------')
  }, []);


  const fetchComponent = async () => {
    try {
      const result = await customerbasedshift(customerId, "component");
      setComponent(result[0]?.value || []);
    } catch (err) {
      console.error("Failed to fetch Component", err);
    }
  };


  console.log("Customer Component", component);

  const componentNames = component.map(c => c.component_name);

  console.log(componentNames);



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




  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""].filter(Boolean).join(" ");
  }


  const [firstOperationsItem, setFirstOperationsItem] = useState([]);

const [loading, setLoading] = useState(false);
const [loadingStage, setLoadingStage] = useState("");

useEffect(() => {
  const fetchOperationsData = async () => {
    if (!from || !to || !selectedDevice) return;

    try {
      setLoading(true);
      setLoadingStage("Fetching data from all devices...");

      const deviceIds = Array.isArray(selectedDevice)
        ? selectedDevice
        : [selectedDevice];

      // 1️⃣ Fetch all devices in parallel
      const allDataArray = await Promise.all(
        deviceIds.map(async (deviceId) => {
          const data = await telemetrykeydata(
            deviceId,
            "DEVICE",
            "operations",
            from,
            to
          );
          return parseTelemetryValues(data, "operations");
        })
      );

      // 2️⃣ Combine all results
      setLoadingStage("Processing data...");
      const combinedData = allDataArray.flat();
      console.log("Total operations data :", combinedData);

      // 3️⃣ Process / group data
      const groupedData = combinedData.reduce((acc, item) => {
        const key = `${item.start_time}_${item.end_time}_${item.code}_${item.name}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});
      console.log("Grouped operations data:", groupedData);

      const firstItems = Object.values(groupedData).map(group => group[0]);
      console.log("First item from each group (stored in state):", firstItems);

      setFirstOperationsItem(firstItems);

    } catch (error) {
      console.error("Error fetching operations data:", error);
      setFirstOperationsItem([]);
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  fetchOperationsData();
}, [selectedDevice, from, to, devices, shifts, deviceNameIdJson]);



  let cycletimeslower = [];
  let cycletimefaster = [];

  firstOperationsItem.forEach(item => {
    const expectedRun = item.expected_run ?? 0;
    const totalRunDuration = item.total_duration?.total_run_duration ?? 0;

    if (expectedRun > totalRunDuration) {
      cycletimefaster.push(item);
    } else {
      cycletimeslower.push(item);
    }
  });

  // Apply selectedComponent filter
  if (selectedComponent !== "all") {
    cycletimeslower = cycletimeslower.filter(item => item.operation_name === selectedComponent);
    cycletimefaster = cycletimefaster.filter(item => item.operation_name === selectedComponent);
  }

  // Remove "No operations"
  cycletimeslower = cycletimeslower.filter(item => item.operation_name !== "No Operations");
  cycletimefaster = cycletimefaster.filter(item => item.operation_name !== "No Operations");

  console.log("cycletimeslower:", cycletimeslower);
  console.log("cycletimefaster:", cycletimefaster);


  let cycletimeslowerbaseline = [];
  let cycletimefasterbaseline = [];

  firstOperationsItem.forEach(item => {
    const totalRunDuration = item.total_duration?.total_run_duration ?? 0;
    const cycleBaseline = item.cycletime_baseline ?? 0;

    if (totalRunDuration > cycleBaseline) {
      cycletimeslowerbaseline.push(item);
    } else {
      cycletimefasterbaseline.push(item);
    }
  });

  // Apply selectedComponent filter
  if (selectedComponent !== "all") {
    cycletimeslowerbaseline = cycletimeslowerbaseline.filter(item => item.operation_name === selectedComponent);
    cycletimefasterbaseline = cycletimefasterbaseline.filter(item => item.operation_name === selectedComponent);
  }

  // Remove "No operations"
  cycletimeslowerbaseline = cycletimeslowerbaseline.filter(item => item.operation_name !== "No Operations");
  cycletimefasterbaseline = cycletimefasterbaseline.filter(item => item.operation_name !== "No Operations");

  console.log("cycletimeslowerbaseline:", cycletimeslowerbaseline);
  console.log("cycletimefasterbaseline:", cycletimefasterbaseline);





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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h5" fontWeight="bold">
            Production Summary
          </Typography>

          <Box display="flex" alignItems="center" gap={2}>
            <Select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              displayEmpty
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">
                All Component
              </MenuItem>
              {componentNames.map((name, index) => (
                <MenuItem key={index} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>

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
          <Typography variant="subtitle2" color="textSecondary" gutterBottom >
            {new Date(from).toLocaleString()} → {new Date(to).toLocaleString()}
          </Typography>
        )}

        <Typography variant="h6" fontWeight="bold" gutterBottom mt={1} mb={2} fontSize="16px">
          Analyzed {
            (cycletimeslower?.length || 0) +
            (cycletimefaster?.length || 0) +
            (cycletimeslowerbaseline?.length || 0) +
            (cycletimefasterbaseline?.length || 0)
          } Runs
        </Typography>


        {/* ================= First Row: Expected ================= */}
        <Grid container spacing={3}>
          {/* Slower Than Expected */}
<Grid item xs={12} md={6}>
  {/* 🔹 Header Above Box */}
  <Typography
    fontWeight="bold"
    sx={{
      mb: 1.5,
      textAlign: "left",
      color: "#080808ff",
      fontSize: "20px",
    }}
  >
    Cycle Time Slower Than Expected
  </Typography>

  <Card
    variant="outlined"
    sx={{
      p: 2,
      height: "400px",
      display: "flex",
      flexDirection: "column",
      borderRadius: 3,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      backgroundColor: "#fff",
    }}
  >
    <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading slower cycle time data...</Typography>
          </Box>):
      cycletimeslower.length > 0 ? (
        cycletimeslower.map((item, index) => {
          const formatSeconds = (sec) => {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
          };

          const actual = Number(item.total_duration?.total_run_duration ?? 0);
          const expected = Math.max(0, Number(item.expected_run));
          const diff = actual - expected;

          return (
            <Card
              key={index}
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                borderRadius: 2,
                backgroundColor: "#fafafa",
                transition: "0.3s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                "&:hover": { boxShadow: "0 4px 10px rgba(0,0,0,0.15)" },
              }}
              onClick={() =>
                navigate("/partwise-cycletime", {
                  state: {
                    selectedDevice: selectedDevice,
                    previousScreen: location.pathname,
                    componentName: item.operation_name,
                    code: item.code || "N/A",
                    deviceName: item.name,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    codeWiseSummary,
                  },
                })
              }
            >
              <Grid
                item
                xs={12}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                {/* 🔹 Left column */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    justifyContent: "flex-start",
                  }}
                >
                  <Box>
                    <Typography fontSize="16px" fontWeight="bold" color="#333">
                      {item.operation_name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {new Date(Number(item.start_time)).toLocaleString()}
                    </Typography>
                  </Box>

                  <Typography variant="body2" fontWeight="bold" color="#555">
                    {item.name}
                  </Typography>
                </Box>

                {/* 🔹 Right column */}
                <Box
                  textAlign="right"
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography fontSize="16px" fontWeight="bold" color="#333">
                      {item.code || "N/A"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {new Date(Number(item.end_time)).toLocaleString()}
                    </Typography>
                  </Box>

                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-end"
                    justifyContent="flex-end"
                  >
                    <Typography
                      sx={{
                        fontSize: "0.8rem",
                        fontWeight: "500",
                        color: "#000",
                      }}
                    >
                      Expected Cycle Time: {formatSeconds(expected)}
                    </Typography>
                  </Box>

                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="flex-end"
                  >
                    <Typography
                      sx={{
                        fontSize: "1.1rem",
                        fontWeight: "bold",
                        color: "error.main",
                      }}
                    >
                      {formatSeconds(actual)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "error.main",
                        fontWeight: "bold",
                        ml: 1,
                      }}
                    >
                      ↑ {formatSeconds(Math.abs(diff))}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Card>
          );
        })
      ) : (
        <Typography variant="body2" color="textSecondary">
          No data available
        </Typography>
      )}
    </Box>
  </Card>
</Grid>



          {/* Faster Than Expected */}
          <Grid item xs={12} md={6}>
            {/* 🔹 Header Above Box */}
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{
                mb: 1.5,
                textAlign: "left",
                color: "#060000ff",
                fontSize: "20px"
              }}
            >
              Cycle Time Faster Than Expected
            </Typography>

            <Card
              variant="outlined"
              sx={{
                p: 2,
                height: "400px",
                display: "flex",
                flexDirection: "column",
                borderRadius: 3,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                backgroundColor: "#fff",
              }}
            >
              <Box sx={{ flex: 1, overflowY: "auto", pr: 1, }}>
                       {loading ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading faster cycle time data...</Typography>
          </Box>):
                cycletimefaster.length > 0 ? (
                  cycletimefaster.map((item, index) => {
                    const formatSeconds = (sec) => {
                      const h = Math.floor(sec / 3600);
                      const m = Math.floor((sec % 3600) / 60);
                      const s = Math.floor(sec % 60);
                      return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                    };

                    const actual = Number(item.total_duration?.total_run_duration ?? 0);
                    const expected = Math.max(0, Number(item.expected_run));
                    const diff = actual - expected;

                    return (
                      <Card
                        key={index}
                        variant="outlined"
                        sx={{
                          p: 2,
                          mb: 2,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          borderRadius: 2,
                          backgroundColor: "#fafafa",
                          transition: "0.3s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                          "&:hover": { boxShadow: "0 4px 10px rgba(0,0,0,0.15)",  },
                          
                        }}
                        onClick={() =>
                          navigate("/partwise-cycletime", {
                            state: {
                              selectedDevice: selectedDevice,
                              previousScreen: location.pathname,
                              componentName: item.operation_name,
                              code: item.code || "N/A",
                              deviceName: item.name,
                              start_time: item.start_time,
                              end_time: item.end_time,
                              codeWiseSummary
                            },
                          })
                        }
                      >
                        <Grid item xs={12} sx={{ display: "flex", justifyContent: "space-between" }}>
                          {/* Left column */}
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                              justifyContent: "flex-start",
                            }}
                          >
                            <Box>
                              <Typography fontSize="16px" fontWeight="bold" color="#333">
                                {item.operation_name}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" display="block">
                                {new Date(Number(item.start_time)).toLocaleString()}
                              </Typography>
                            </Box>

                            <Typography variant="body2" fontWeight="bold" color="#555">
                              {item.name}
                            </Typography>
                          </Box>

                          {/* Right column */}
                          <Box
                            textAlign="right"
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: 1,
                            }}
                          >
                            <Box>
                              <Typography fontSize="16px" fontWeight="bold" color="#333">
                                {item.code || "N/A"}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                {new Date(Number(item.end_time)).toLocaleString()}
                              </Typography>
                            </Box>

                            <Box
                              display="flex"
                              flexDirection="column"
                              alignItems="flex-end"
                              justifyContent="flex-end"
                            >
                              <Typography
                                sx={{
                                  fontSize: "0.8rem",
                                  fontWeight: "500",
                                  color: "#000",
                                }}
                              >
                                Expected Cycle Time: {formatSeconds(expected)}
                              </Typography>

                              <Typography
                                sx={{
                                  fontSize: "1.2rem",
                                  fontWeight: "500",
                                  color: "#000",
                                  lineHeight: 1,
                                }}
                              >

                              </Typography>
                            </Box>

                            <Box
                              display="flex"
                              alignItems="center"
                              justifyContent="flex-end"
                            >
                              <Typography
                                sx={{
                                  fontSize: "1.1rem",
                                  fontWeight: "bold",
                                  color: "green",
                                }}
                              >
                                {formatSeconds(actual)}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "green",
                                  fontWeight: "bold",
                                  ml: 1,
                                }}
                              >

                                ↓ {formatSeconds(Math.abs(diff))}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      </Card>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No data available
                  </Typography>
                )}
              </Box>
            </Card>
          </Grid>
        </Grid>



        {/* ================= Second Row: Baseline ================= */}
        <Grid container spacing={3} mt={1}>
          {/* Slower than Baseline */}
          <Grid item xs={12} md={6}>
            {/* 🔹 Header Above Box */}
            <Typography
              fontWeight="bold"
              sx={{
                mb: 1.5,
                textAlign: "left",
                color: "#080808ff",
                fontSize: "20px",
              }}
            >
              Cycle Time Slower Than Baseline
            </Typography>

            <Card
              variant="outlined"
              sx={{
                p: 2,
                height: "400px",
                display: "flex",
                flexDirection: "column",
                borderRadius: 3,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                backgroundColor: "#fff",
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  pr: 1,
                  "&::-webkit-scrollbar": { width: "6px" },
                  "&::-webkit-scrollbar-thumb": {
                    backgroundColor: "#ccc",
                    borderRadius: "3px",
                  },
                }}
              >
                  {loading ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading slower than baseline data...</Typography>
          </Box>):
                cycletimeslowerbaseline.length > 0 ? (
                  cycletimeslowerbaseline.map((item, index) => {
                    const formatSeconds = (sec) => {
                      const h = Math.floor(sec / 3600);
                      const m = Math.floor((sec % 3600) / 60);
                      const s = Math.floor(sec % 60);
                      return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                    };

                    const actual = Number(item.total_duration?.total_run_duration ?? 0);
                    const expected = Math.max(0, Number(item.cycletime_baseline));
                    const diff = actual - expected;

                    return (
                      <Card
                        key={index}
                        variant="outlined"
                        sx={{
                          p: 2,
                          mb: 2,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderRadius: 2,
                          backgroundColor: "#fafafa",
                          transition: "0.3s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                          cursor: "pointer",
                          "&:hover": {
                            boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                            backgroundColor: "#fff",
                          },
                        }}
                        onClick={() =>
                          navigate("/partwise-cycletime", {
                            state: {
                              selectedDevice: selectedDevice,
                              previousScreen: location.pathname,
                              componentName: item.operation_name,
                              code: item.code || "N/A",
                              deviceName: item.name,
                              start_time: item.start_time,
                              end_time: item.end_time,
                              codeWiseSummary
                            },
                          })
                        }
                      >
                        <Grid item xs={12} sx={{ display: "flex", justifyContent: "space-between" }}>
                          {/* Left column */}
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                              justifyContent: "flex-start",
                            }}
                          >
                            <Box>
                              <Typography fontSize="16px" fontWeight="bold" color="#333">
                                {item.operation_name}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" display="block">
                                {new Date(Number(item.start_time)).toLocaleString()}
                              </Typography>
                            </Box>

                            <Typography variant="body2" fontWeight="bold" color="#555">
                              {item.name}
                            </Typography>
                          </Box>

                          {/* Right column */}
                          <Box
                            textAlign="right"
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: 1,
                            }}
                          >
                            <Box>
                              <Typography fontSize="16px" fontWeight="bold" color="#333">
                                {item.code || "N/A"}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                {new Date(Number(item.end_time)).toLocaleString()}
                              </Typography>
                            </Box>

                            <Box
                              display="flex"
                              flexDirection="column"
                              alignItems="flex-end"
                              justifyContent="flex-end"
                            >
                              <Typography
                                sx={{
                                  fontSize: "0.8rem",
                                  fontWeight: "500",
                                  color: "#000",
                                }}
                              >
                                Expected Cycle Time: {formatSeconds(expected)}
                              </Typography>

                              <Typography
                                sx={{
                                  fontSize: "1.2rem",
                                  fontWeight: "500",
                                  color: "#000",
                                  lineHeight: 1,
                                }}
                              >
                              </Typography>
                            </Box>

                            <Box
                              display="flex"
                              alignItems="center"
                              justifyContent="flex-end"
                            >
                              <Typography
                                sx={{
                                  fontSize: "1.1rem",
                                  fontWeight: "bold",
                                  color: "error.main",
                                }}
                              >
                                {formatSeconds(actual)}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "error.main",
                                  fontWeight: "bold",
                                  ml: 1,
                                }}
                              >

                                ↑ {formatSeconds(Math.abs(diff))}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      </Card>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No data available
                  </Typography>
                )}
              </Box>
            </Card>
          </Grid>

          {/* Faster than Baseline */}
<Grid item xs={12} md={6}>
  <Typography
    fontWeight="bold"
    sx={{
      mb: 1.5,
      textAlign: "left",
      color: "#060000ff",
      fontSize: "20px",
    }}
  >
    Cycle Time Faster Than Baseline
  </Typography>

  <Card
    variant="outlined"
    sx={{
      p: 2,
      height: "400px",
      display: "flex",
      flexDirection: "column",
      borderRadius: 3,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      backgroundColor: "#fff",
    }}
  >
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        pr: 1,
        "&::-webkit-scrollbar": { width: "6px" },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "#ccc",
          borderRadius: "3px",
        },
      }}
    >
      {/* Conditional render */}
        {loading ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading faster than baseline data...</Typography>
          </Box>):
    cycletimefasterbaseline && cycletimefasterbaseline.length > 0 ? (
  cycletimefasterbaseline.map((item, index) => {
    const formatSeconds = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
    };

    const actual = Number(item.total_duration?.total_run_duration ?? 0);
    const expected = Math.max(0, Number(item.cycletime_baseline));
    const diff = actual - expected;

    return (
      <Card
        key={index}
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderRadius: 2,
          backgroundColor: "#fafafa",
          transition: "0.3s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          cursor: "pointer",
          "&:hover": {
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
            backgroundColor: "#fff",
          },
        }}
        onClick={() =>
          navigate("/partwise-cycletime", {
            state: {
              selectedDevice,
              previousScreen: location.pathname,
              componentName: item.operation_name,
              code: item.code || "N/A",
              deviceName: item.name,
              start_time: item.start_time,
              end_time: item.end_time,
              codeWiseSummary,
            },
          })
        }
      >
        <Grid
          item
          xs={12}
          sx={{
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {/* Left column */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              justifyContent: "flex-start",
            }}
          >
            <Box>
              <Typography fontSize="16px" fontWeight="bold" color="#333">
                {item.operation_name}
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
              >
                {new Date(Number(item.start_time)).toLocaleString()}
              </Typography>
            </Box>

            <Typography variant="body2" fontWeight="bold" color="#555">
              {item.name}
            </Typography>
          </Box>

          {/* Right column */}
          <Box
            textAlign="right"
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box>
              <Typography fontSize="16px" fontWeight="bold" color="#333">
                {item.code || "N/A"}
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
              >
                {new Date(Number(item.end_time)).toLocaleString()}
              </Typography>
            </Box>

            <Box
              display="flex"
              flexDirection="column"
              alignItems="flex-end"
              justifyContent="flex-end"
            >
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: "500",
                  color: "#000",
                }}
              >
                Expected Cycle Time: {formatSeconds(expected)}
              </Typography>
            </Box>

            <Box
              display="flex"
              alignItems="center"
              justifyContent="flex-end"
            >
              <Typography
                sx={{
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  color: "green",
                }}
              >
                {formatSeconds(actual)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "success.main",
                  fontWeight: "bold",
                  ml: 1,
                }}
              >
                ↓ {formatSeconds(Math.abs(diff))}
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Card>
    );
  })
) : (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "300px",
    }}
  >
    <Typography variant="h6" color="textSecondary">
      No Data Available
    </Typography>
  </Box>
)}

    </Box>
  </Card>
</Grid>


        </Grid>

      </Box>

    </Box>
  );

}
export default Cycletime;