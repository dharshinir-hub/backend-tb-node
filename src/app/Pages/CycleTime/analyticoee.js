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

      const selectedDevice = location.state?.selectedDevice || null;


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


    const [operationsData, setOperationsData] = useState([]);

    useEffect(() => {
        let isMounted = true; // ✅ Prevent state updates if component unmounts

        const fetchOperationsData = async () => {
            if (!from || !to) return;

            try {
                const data = await telemetrykeydata(
                    customerId,
                    "CUSTOMER",
                    "operations",
                    from,
                    to
                );

                if (!data) {
                    console.warn("No data received for operations");
                    if (isMounted) setOperationsData([]);
                    return;
                }

                const parsedValues = parseTelemetryValues(data, "operations");
                console.log("Final operations values:", parsedValues);

                if (isMounted) setOperationsData(parsedValues);
            } catch (error) {
                console.error("Error fetching operations data:", error);
                if (isMounted) setOperationsData([]);
            }
        };

        fetchOperationsData();

        return () => {
            isMounted = false;
        };
    }, [customerId, from, to]);

    console.log('operations key data', operationsData)


    const [oeeSlower, setOeeTimeSlower] = useState([]);
    const [oeeFaster, setOeeTimeFaster] = useState([]);
    const [oeeBaselineSlower, setOeeBaselineSlower] = useState([]);
    const [oeeBaselineFaster, setOeeBaselineFaster] = useState([]);

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

    // 1️⃣ oee_slower
    useEffect(() => {
        const fetchOeeSlower = async () => {
            if (!from || !to) return;

            try {
                const data = await telemetrykeydata(customerId, "CUSTOMER", "oee_slower", from, to);
                const parsedValues = parseTelemetryValues(data, "oee_slower");
                console.log("Final oee_slower values:", parsedValues);
                setOeeTimeSlower(parsedValues);
            } catch (error) {
                console.error("Error fetching oee_slower:", error);
                setOeeTimeSlower([]);
            }
        };

        fetchOeeSlower();
    }, [customerId, from, to]);

    // 2️⃣ oee_faster
    useEffect(() => {
        const fetchOeeFaster = async () => {
            if (!from || !to) return;

            try {
                const data = await telemetrykeydata(
                    customerId,
                    "CUSTOMER",
                    "oee_faster",
                    from,
                    to
                );

                if (!data) {
                    console.warn("No data received for oee_faster");
                    setOeeTimeFaster([]);
                    return;
                }

                const parsedValues = parseTelemetryValues(data, "oee_faster");
                console.log("Final oee_faster values:", parsedValues);

                setOeeTimeFaster(parsedValues);
            } catch (error) {
                console.error("Error fetching oee_faster:", error);
                setOeeTimeFaster([]);
            }
        };

        fetchOeeFaster();
    }, [customerId, from, to]);


    // 3️⃣ oee_Baseline_slower
    useEffect(() => {
        let isMounted = true; // ✅ Prevent state updates if component unmounts

        const fetchOeeBaselineSlower = async () => {
            if (!from || !to) return;

            try {
                const data = await telemetrykeydata(
                    customerId,
                    "CUSTOMER",
                    "oee_Baseline_slower",
                    from,
                    to
                );

                if (!data) {
                    console.warn("No data received for oee_Baseline_slower");
                    if (isMounted) setOeeBaselineSlower([]);
                    return;
                }

                const parsedValues = parseTelemetryValues(
                    data,
                    "oee_Baseline_slower"
                );
                console.log("Final oee_Baseline_slower values:", parsedValues);

                if (isMounted) setOeeBaselineSlower(parsedValues);
            } catch (error) {
                console.error("Error fetching oee_Baseline_slower:", error);
                if (isMounted) setOeeBaselineSlower([]);
            }
        };

        fetchOeeBaselineSlower();

        return () => {
            isMounted = false; // ✅ Cleanup on unmount
        };
    }, [customerId, from, to]);

    // 4️⃣ oee_Baseline_faster
    useEffect(() => {
        const fetchOeeBaselineFaster = async () => {
            if (!from || !to) return;

            try {
                const data = await telemetrykeydata(
                    customerId,
                    "CUSTOMER",
                    "oee_Baseline_faster",
                    from,
                    to
                );

                if (!data) {
                    console.warn("No data received for oee_Baseline_faster");
                    setOeeBaselineFaster([]);
                    return;
                }

                const parsedValues = parseTelemetryValues(
                    data,
                    "oee_Baseline_faster"
                );
                console.log("Final oee_Baseline_faster values:", parsedValues);

                setOeeBaselineFaster(parsedValues);
            } catch (error) {
                console.error("Error fetching oee_Baseline_faster:", error);
                setOeeBaselineFaster([]);
            }
        };

        fetchOeeBaselineFaster();
    }, [customerId, from, to]);


    const [firstOperationsItem, setFirstOperationsItem] = useState([]);

    useEffect(() => {
        const fetchOperationsData = async () => {
            if (!from || !to || !selectedDevice) return;

            try {
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
            }
        };

        fetchOperationsData();
    }, [selectedDevice, from, to, devices, shifts, deviceNameIdJson]);

    // Assuming your array is called `dataArray`
    const oeebaselineGreater = [];
    const oeebaselineLower = [];

    firstOperationsItem.forEach(item => {
        const itemOEE = item.oee ?? 0; // fallback to 0 if undefined
        const baselineOEE = item.baseline?.oee ?? 0; // fallback to 0 if undefined

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
                        (oeeSlower?.length || 0) +
                        (oeeFaster?.length || 0) +
                        (oeebaselineLower?.length || 0) +
                        (oeebaselineGreater?.length || 0)
                    } Runs
                </Typography>

                {/* ================= First Row: Expected ================= */}
                <Grid container spacing={3}>
                    {/* Slower than Expected */}
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined" sx={{ p: 2, height: "400px", overflow: "hidden" }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Oee Slower Than Expected
                            </Typography>

                            <Box
                                display="flex"
                                flexDirection="column"
                                gap={2}
                                sx={{ overflowY: "auto", maxHeight: "340px", pr: 1 }}
                            >
                                {oeeSlower.length > 0 ? (
                                    oeeSlower.map((item, index) => {
                                        const formatSeconds = (sec) => {
                                            const h = Math.floor(sec / 3600);
                                            const m = Math.floor((sec % 3600) / 60);
                                            const s = sec % 60;
                                            return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                                        };

                                        const actual = Number(item.actual_cycle);
                                        const expected = Number(item.exp_cycle);
                                        const diff = actual - expected; // slower → actual > expected

                                        return (
                                            <Card
                                                key={index}
                                                variant="outlined"
                                                sx={{
                                                    p: 2,
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                }}
                                            >
                                                {/* Left column */}
                                                <Box>
                                                    <Typography fontSize="20px" fontWeight="bold">
                                                        {item.component_name}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="textSecondary"
                                                        display="block"
                                                        mt={0}
                                                    >
                                                        {new Date(Number(item.start_time)).toLocaleString()}
                                                    </Typography>
                                                    <Typography variant="body2" mt={2} fontWeight="bold">
                                                        {item.device_name}
                                                    </Typography>
                                                </Box>

                                                {/* Right column */}
                                                <Box display="flex" flexDirection="column" alignItems="flex-end">
                                                    <Box sx={{ height: "20px" }} />
                                                    <Typography
                                                        variant="caption"
                                                        color="textSecondary"
                                                        display="block"
                                                        mt={1.1}
                                                    >
                                                        {new Date(Number(item.end_time)).toLocaleString()}
                                                    </Typography>
                                                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                                                        <Typography variant="h6">{formatSeconds(actual)}</Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: "error.main", fontWeight: "bold", marginTop: "4px" }}
                                                        >
                                                            ↓ {formatSeconds(Math.abs(diff))}
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

                    {/* Faster than Expected */}
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined" sx={{ p: 2, height: "400px", overflow: "hidden" }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Oee Faster Than Expected
                            </Typography>

                            <Box
                                display="flex"
                                flexDirection="column"
                                gap={2}
                                sx={{
                                    overflowY: "auto",
                                    maxHeight: "340px",
                                    pr: 1,
                                    "&::-webkit-scrollbar": {
                                        width: "6px",
                                    },
                                    "&::-webkit-scrollbar-thumb": {
                                        backgroundColor: "#ccc",
                                        borderRadius: "3px",
                                    },
                                }}
                            >
                                {oeeFaster.length > 0 ? (
                                    oeeFaster.map((item, index) => {
                                        const formatSeconds = (sec) => {
                                            const h = Math.floor(sec / 3600);
                                            const m = Math.floor((sec % 3600) / 60);
                                            const s = sec % 60;
                                            return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                                        };

                                        const actual = Number(item.actual_cycle);
                                        const expected = Number(item.exp_cycle);
                                        const diff = actual - expected; // faster → diff negative

                                        return (
                                            <Card
                                                key={index}
                                                variant="outlined"
                                                sx={{
                                                    p: 2,
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                }}
                                            >
                                                {/* Left column */}
                                                <Box>
                                                    <Typography fontSize="20px" fontWeight="bold">
                                                        {item.component_name}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="textSecondary"
                                                        display="block"
                                                        mt={0}
                                                    >
                                                        {new Date(Number(item.start_time)).toLocaleString()}
                                                    </Typography>
                                                    <Typography variant="body2" mt={2} fontWeight="bold">
                                                        {item.device_name}
                                                    </Typography>
                                                </Box>

                                                {/* Right column */}
                                                <Box display="flex" flexDirection="column" alignItems="flex-end">
                                                    <Box sx={{ height: "20px" }} />
                                                    <Typography
                                                        variant="caption"
                                                        color="textSecondary"
                                                        display="block"
                                                        mt={1.1}
                                                    >
                                                        {new Date(Number(item.end_time)).toLocaleString()}
                                                    </Typography>
                                                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                                                        <Typography variant="h6">{formatSeconds(actual)}</Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: "success.main", fontWeight: "bold", marginTop: "4px" }}
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
                </Grid>

                {/* ================= Second Row: Baseline ================= */}
                <Grid container spacing={3} mt={1}>
                    {/* Slower than Baseline */}
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined" sx={{ p: 2, height: "400px", overflow: "hidden" }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Oee Slower Than Baseline
                            </Typography>
              <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
                {oeebaselineLower.length > 0 ? (
                  oeebaselineLower.map((item, index) => {
                    const formatSeconds = (sec) => {
                      const h = Math.floor(sec / 3600);
                      const m = Math.floor((sec % 3600) / 60);
                      const s = Math.floor(sec % 60);
                      return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                    };

                    const actual = Number(item.oee);
                    const expected = Number(item.baseline.oee);
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
                          cursor: "pointer"
                        }}
                        onClick={() =>
                          navigate("/summary", {
                            state: {
                                 selectedDevice: selectedDevice,
                                  previousScreen: location.pathname,
                              componentName: item.operation_name,
                              code: item.code || "N/A",
                              deviceName: item.name,
                              start_time: item.start_time,
                              end_time: item.end_time
                            }
                          })
                        }
                      >
                        {/* Left column */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column', gap: 1 }} >
                          <Box>
                            <Typography fontSize="16px" fontWeight="bold">
                              {item.operation_name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" display="block">
                              {new Date(Number(item.start_time)).toLocaleString()}
                            </Typography>
                          </Box>

                          <Typography variant="body2" fontWeight="bold">
                            {item.name}
                          </Typography>
                        </Box>

                        {/* Right column */}
                        <Box textAlign="right" sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1 }}>
                          <Box>
                            <Typography fontSize="16px" fontWeight="bold">
                              {item.code || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" display="block">
                              {new Date(Number(item.end_time)).toLocaleString()}
                            </Typography>
                          </Box>

                          <Box display="flex" alignItems="center" justifyContent="flex-end">
                            <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>{actual}</p>
                            <Typography
                              variant="caption"
                              sx={{ color: "success.main", fontWeight: "bold", ml: 1 }}
                            >
                              ↑ {diff}
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

                    {/* Faster than Baseline */}
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined" sx={{ p: 2, height: "400px", display: "flex", flexDirection: "column" }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Oee Faster Than Baseline
                            </Typography>

              <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
                {oeebaselineGreater.length > 0 ? (
                  oeebaselineGreater.map((item, index) => {
                    const formatSeconds = (sec) => {
                      const h = Math.floor(sec / 3600);
                      const m = Math.floor((sec % 3600) / 60);
                      const s = Math.floor(sec % 60);
                      return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                    };

                    const actual = Number(item.oee);
                    const expected = Number(item.baseline.oee);
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
                          cursor: "pointer"
                        }}
                        onClick={() =>
                          navigate("/summary", {
                            state: {
                                 selectedDevice: selectedDevice,
                                  previousScreen: location.pathname,
                              componentName: item.operation_name,
                              code: item.code || "N/A",
                              deviceName: item.name,
                              start_time: item.start_time,
                              end_time: item.end_time
                            }
                          })
                        }
                      >
                        {/* Left column */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column', gap: 1 }} >
                          <Box>
                            <Typography fontSize="16px" fontWeight="bold">
                              {item.operation_name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" display="block">
                              {new Date(Number(item.start_time)).toLocaleString()}
                            </Typography>
                          </Box>

                          <Typography variant="body2" fontWeight="bold">
                            {item.name}
                          </Typography>
                        </Box>

                        {/* Right column */}
                        <Box textAlign="right" sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1 }}>
                          <Box>
                            <Typography fontSize="16px" fontWeight="bold">
                              {item.code || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" display="block">
                              {new Date(Number(item.end_time)).toLocaleString()}
                            </Typography>
                          </Box>

                          <Box display="flex" alignItems="center" justifyContent="flex-end">
                            <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>{actual}</p>
                            <Typography
                              variant="caption"
                              sx={{ color: "success.main", fontWeight: "bold", ml: 1 }}
                            >
                              ↑ {diff}
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
