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


const AnalyticOee = () => {
  const [partNumber, setPartNumber] = useState("");
  const [reportType, setReportType] = useState("Part Time vs Expected");
  const [machineGroup, setMachineGroup] = useState("CNC Group ");
  const [shifts, setShifts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
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





  const [oeeSlower, setOeeTimeSlower] = useState([]);
  const [oeeFaster, setOeeTimeFaster] = useState([]);
  const [oeeBaselineSlower, setOeeBaselineSlower] = useState([]);
  const [oeeBaselineFaster, setOeeBaselineFaster] = useState([]);

  const parseTelemetryValues = (data, key) => {
    const values = data?.[key] || [];
    return values
      .map(point => {
        try {
          const parsed = typeof point.value === "string" ? JSON.parse(point.value) : point.value;
          return parsed && typeof parsed === "object" ? { ts: point.ts, ...parsed } : null;
        } catch {
          return null;
        }
      })
      .filter(v => v !== null);
  };



  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [firstOperationsItem, setFirstOperationsItem] = useState([]);

  useEffect(() => {
    const fetchOperationsData = async () => {
      if (!from || !to || !selectedDevice) return;

      try {
        setLoading(true);
        setLoadingStage("Fetching data from all devices...");
        const deviceIds = Array.isArray(selectedDevice) ? selectedDevice : [selectedDevice];

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
        setLoadingStage("Processing data...");

        const combinedData = allDataArray.flat();
        console.log("Total operations data :", combinedData);

        const groupedData = combinedData.reduce((acc, item) => {
          const key = `${item.start_time}_${item.end_time}_${item.code}_${item.code}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});
        console.log("Grouped operations data:", groupedData);

        const firstItems = Object.values(groupedData).map(group => group[0]);
        setFirstOperationsItem(firstItems);
        console.log("First item from each group (stored in state):", firstItems);

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

  const oeebaselineGreater = [];
  const oeebaselineLower = [];

  const filteredOperations = firstOperationsItem.filter(
    (item) => item.operation_name !== "No Operations"
  );

  filteredOperations.forEach((item) => {
    const itemOEE = item?.oee ?? 0;
    const baselineOEE = item?.baseline?.oee ?? 0;

    if (itemOEE > baselineOEE) {
      oeebaselineGreater.push(item);
    } else {
      oeebaselineLower.push(item);
    }
  });

  console.log("OEE greater than baseline:", oeebaselineGreater);
  console.log("OEE lower than or equal to baseline:", oeebaselineLower);



  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""].filter(Boolean).join(" ");
  }


  const formatSeconds = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${h > 0 ? `${h}h ` : ""}${m > 0 ? `${m}m ` : ""}${s}s`;
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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h5" fontWeight="bold">
            Production Summary
          </Typography>

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



        {from && to && (
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            {new Date(from).toLocaleString()} → {new Date(to).toLocaleString()}
          </Typography>
        )}

        <Typography variant="h6" fontWeight="bold" gutterBottom mt={1} mb={2} fontSize="16px">
          Analyzed {
            (oeeSlower?.length || 0) +
            (oeeFaster?.length || 0) +
            (oeebaselineLower?.length || 0) +
            (oeebaselineGreater?.length || 0)
          } Runs
        </Typography>

        {/* ================= First Row: Expected ================= */}
        {/* <Grid container spacing={3}>

          <Grid item xs={12} md={6}>
            <Typography
              fontWeight="bold"
              sx={{
                mb: 1.5,
                textAlign: "left",
                color: "#080808ff",
                fontSize: "20px",
              }}
            >
              OEE Slower Than Expected
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
                  // 🔹 Loader Section
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
                    <Typography sx={{ mt: 2 }}>Loading slower OEE data...</Typography>
                  </Box>
                ) : oeeSlower.length > 0 ? (
                  oeeSlower.map((item, index) => {
                    const formatSeconds = (sec) => {
                      const h = Math.floor(sec / 3600);
                      const m = Math.floor((sec % 3600) / 60);
                      const s = Math.floor(sec % 60);
                      return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                    };

                    const actual = Number(item?.actual_cycle ?? 0);
                    const expected = Math.max(0, Number(item?.exp_cycle ?? 0));
                    const diff = actual - expected; // slower → actual > expected

                    return (
                      <Card
                        key={item?.component_name || index}
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
                          navigate("/partwise-oee", {
                            state: {
                              selectedDevice: selectedDevice,
                              previousScreen: location.pathname,
                              componentName: item?.component_name,
                              deviceName: item?.device_name,
                              start_time: item?.start_time,
                              end_time: item?.end_time,
                              actual,
                              expected,
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
                                {item?.component_name ?? "Unknown Component"}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                {new Date(Number(item?.start_time)).toLocaleString()}
                              </Typography>
                            </Box>

                            <Typography variant="body2" fontWeight="bold" color="#555">
                              {item?.device_name ?? "Unknown Device"}
                            </Typography>
                          </Box>

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
                              <Typography
                                fontSize="16px"
                                fontWeight="bold"
                                color="#333"
                              >
                                OEE
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                display="block"
                              >
                                {new Date(Number(item?.end_time)).toLocaleString()}
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
                                Expected: {formatSeconds(expected)}
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
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    height="100%"
                  >
                    <Typography variant="body2" color="textSecondary">
                      No data available
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>
          </Grid>



          <Grid item xs={12} md={6}>
            <Typography
              fontWeight="bold"
              sx={{
                mb: 1.5,
                textAlign: "left",
                color: "#080808ff",
                fontSize: "20px",
              }}
            >
              OEE Faster Than Expected
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
                    <Typography sx={{ mt: 2 }}>Loading faster OEE data...</Typography>
                  </Box>
                ) : oeeFaster.length > 0 ? (
                  oeeFaster.map((item, index) => {
                    const formatSeconds = (sec) => {
                      const h = Math.floor(sec / 3600);
                      const m = Math.floor((sec % 3600) / 60);
                      const s = Math.floor(sec % 60);
                      return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                    };

                    const actual = Number(item.actual_cycle);
                    const expected = Number(item.exp_cycle);
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
                              selectedDevice,
                              previousScreen: location.pathname,
                              componentName: item.component_name,
                              code: item.code || "N/A",
                              deviceName: item.device_name,
                              start_time: item.start_time,
                              end_time: item.end_time,
                            },
                          })
                        }
                      >
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Typography fontSize="16px" fontWeight="bold" color="#333">
                            {item.component_name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            display="block"
                          >
                            {new Date(Number(item.start_time)).toLocaleString()}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold" color="#555">
                            {item.device_name}
                          </Typography>
                        </Box>

                        <Box
                          textAlign="right"
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            display="block"
                          >
                            {new Date(Number(item.end_time)).toLocaleString()}
                          </Typography>

                          <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="flex-end"
                          >
                            <Typography
                              sx={{
                                fontSize: "1.1rem",
                                fontWeight: "bold",
                                color: "#000",
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
                              ↑ {formatSeconds(Math.abs(diff))}
                            </Typography>
                          </Box>
                        </Box>
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

        </Grid> */}

        {/* <Grid container spacing={3} mt={1}>
  <OEESpeedSection
    title="OEE Slower Than Baseline"
    data={oeebaselineLower}
    color="error"
    loading={loading}
    navigate={navigate}
    location={location}
    selectedDevice={selectedDevice}
  />

  <OEESpeedSection
    title="OEE Faster Than Baseline"
    data={oeebaselineGreater}
    color="success"
    loading={loading}
    navigate={navigate}
    location={location}
    selectedDevice={selectedDevice}
  />
</Grid> */}


        {/* ================= Second Row: Baseline ================= */}
        <Grid container spacing={3} mt={1}>
          {/* 🔹 OEE Slower Than Baseline */}
          <Grid item xs={12} md={6}>
            <Typography
              fontWeight="bold"
              sx={{
                mb: 1.5,
                textAlign: "left",
                color: "#080808ff",
                fontSize: "20px",
              }}
            >
              OEE Slower Than Baseline
            </Typography>

            <Card
              variant="outlined"
              sx={{
                p: 2,
                height: "500px",
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
                    <Typography sx={{ mt: 2 }}>
                      Loading slower OEE data...
                    </Typography>
                  </Box>
                ) : oeebaselineLower.length > 0 ? (
                  oeebaselineLower.map((item, index) => {
                    const actual = Number(item?.oee || 0);
                    const expected = Number(item?.baseline?.oee || 0);
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
                          navigate("/summary", {
                            state: {
                              selectedDevice,
                              previousScreen: location.pathname,
                              componentName: item.operation_name,
                              code: item.code || "N/A",
                              deviceName: item.name,
                              start_time: item.start_time,
                              end_time: item.end_time,
                            },
                          })
                        }
                      >
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
                              {actual.toFixed(2)}%
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "error.main",
                                fontWeight: "bold",
                                ml: 1,
                              }}
                            >
                              ↓ {Math.abs(diff).toFixed(2)}%
                            </Typography>
                          </Box>
                        </Box>
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

          <Grid item xs={12} md={6}>
            <Typography
              fontWeight="bold"
              sx={{
                mb: 1.5,
                textAlign: "left",
                color: "#080808ff",
                fontSize: "20px",
              }}
            >
              OEE Faster Than Baseline
            </Typography>

            <Card
              variant="outlined"
              sx={{
                p: 2,
                height: "500px",
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
                    <Typography sx={{ mt: 2 }}>
                      Loading faster OEE data...
                    </Typography>
                  </Box>
                ) : oeebaselineGreater.length > 0 ? (
                  oeebaselineGreater.map((item, index) => {
                    const actual = Number(item?.oee || 0);
                    const expected = Number(item?.baseline?.oee || 0);
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
                          navigate("/summary", {
                            state: {
                              selectedDevice,
                              previousScreen: location.pathname,
                              componentName: item.operation_name,
                              code: item.code || "N/A",
                              deviceName: item.name,
                              start_time: item.start_time,
                              end_time: item.end_time,
                            },
                          })
                        }
                      >
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
                            alignItems="center"
                            justifyContent="flex-end"
                          >
                            <Typography
                              sx={{
                                fontSize: "1.1rem",
                                fontWeight: "bold",
                                color: "success.main",
                              }}
                            >
                              {actual.toFixed(2)}%
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "success.main",
                                fontWeight: "bold",
                                ml: 1,
                              }}
                            >
                              ↑ {Math.abs(diff).toFixed(2)}%
                            </Typography>
                          </Box>
                        </Box>
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

      </Box>

    </Box>
  );

}
export default AnalyticOee;
