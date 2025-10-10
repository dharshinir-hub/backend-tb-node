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



                {from && to && (
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                        {new Date(from).toLocaleString()} → {new Date(to).toLocaleString()}
                    </Typography>
                )}

                <Typography variant="h6" fontWeight="bold" gutterBottom mt={3}>
                    Analyzed {
                        (oeeSlower?.length || 0) +
                        (oeeFaster?.length || 0) +
                        (oeeBaselineSlower?.length || 0) +
                        (oeeBaselineFaster?.length || 0)
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
                                {oeeBaselineSlower.length > 0 ? (
                                    oeeBaselineSlower.map((item, index) => {
                                        const formatSeconds = (sec) => {
                                            const h = Math.floor(sec / 3600);
                                            const m = Math.floor((sec % 3600) / 60);
                                            const s = sec % 60;
                                            return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                                        };

                                        const actual = Number(item.actual_baseline);
                                        const expected = Number(item.exp_baseline);
                                        const diff = actual - expected; // slower → positive diff

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

                    {/* Faster than Baseline */}
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined" sx={{ p: 2, height: "400px", overflow: "hidden" }}>
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Oee Faster Than Baseline
                            </Typography>

                            <Box
                                display="flex"
                                flexDirection="column"
                                gap={2}
                                sx={{ overflowY: "auto", maxHeight: "340px", pr: 1 }}
                            >
                                {oeeBaselineFaster.length > 0 ? (
                                    oeeBaselineFaster.map((item, index) => {
                                        const formatSeconds = (sec) => {
                                            const h = Math.floor(sec / 3600);
                                            const m = Math.floor((sec % 3600) / 60);
                                            const s = sec % 60;
                                            return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
                                        };

                                        const actual = Number(item.actual_baseline);
                                        const expected = Number(item.exp_baseline);
                                        const diff = actual - expected; // faster → actual < expected → negative diff

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
            </Box>

        </Box>
    );

}
export default AnalyticOee;
