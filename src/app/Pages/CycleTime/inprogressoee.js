import React, { useEffect, useState, useMemo } from "react";
import {
    Box,
    Typography,
    Button,
    Grid,
    TableBody,
    Table,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from "@mui/material";

import {
    customerbaseddevices,
    customerbasedshift,
    telemetrykeydata,
} from "../../Services/app/companyservice";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarPanel } from "../../Pages/AnalyticsSidepanel/analyticslayout";

const PartCycleTime = () => {
    const [partNumber, setPartNumber] = useState("");
    const [reportType, setReportType] = useState("Part Time vs Expected");
    const [machineGroup, setMachineGroup] = useState("CNC Group ");
    const [shifts, setShifts] = useState([]);
    const [devices, setDevices] = useState([]);
    const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
    const [selectedDashboard, setSelectedDashboard] = useState("summary");

    const [partData, setPartData] = useState({}); // object keyed by deviceName
    const [selectedPartNumber, setSelectedPartNumber] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();
    const { from, to } = location.state || {
        from: dayjs().subtract(6, "day").startOf("day").valueOf(),
        to: dayjs().endOf("day").valueOf(),
    };

    const baseUrl = window._env_.SERVER_URL;
    const newToken = localStorage.getItem("newToken");

    const {
        previousScreen,
        componentName,
        deviceName,
        start_time,
        end_time,
        code,
        selectedDevice,
        highcode,
    } = location.state || {};

    console.log('From', start_time, 'to', end_time, 'Component', componentName, 'deviceName', deviceName, 'code', code)

    const Id = localStorage.getItem("CustomerID");
    let customerId = decodeURIComponent(Id || "").replace(/^"|"$/g, "");

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
    }, []);

    const deviceId = Object.keys(deviceNameIdJson).find(
        (key) => deviceNameIdJson[key] === deviceName
    );

    const parseTelemetryValues = (data, key) => {
        const values = data?.[key] || [];
        return values
            .map((point) => {
                try {
                    const parsed =
                        typeof point.value === "string" ? JSON.parse(point.value) : point.value;
                    return parsed && typeof parsed === "object"
                        ? { ts: point.ts, ...parsed }
                        : null;
                } catch {
                    return null;
                }
            })
            .filter((v) => v !== null);
    };

    useEffect(() => {
        const fetchPartData = async () => {
            if (!start_time || !end_time || !deviceId) return;

            try {
                const deviceIds = Array.isArray(deviceId) ? deviceId : [deviceId];

                const allDataArray = await Promise.all(
                    deviceIds.map(async (deviceId) => {
                        const deviceName = deviceNameIdJson[deviceId] || "Unknown Device";

                        const data = await telemetrykeydata(
                            deviceId,
                            "DEVICE",
                            "part_data",
                            start_time,
                            end_time
                        );

                        const parsedData = parseTelemetryValues(data, "part_data");
                        return { deviceName, parsedData };
                    })
                );

                const allDataObject = allDataArray.reduce((acc, curr) => {
                    acc[curr.deviceName] = curr.parsedData;
                    return acc;
                }, {});

                setPartData(allDataObject);
            } catch (error) {
                console.error("Error fetching part_data:", error);
                setPartData({});
            }
        };

        fetchPartData();
    }, [deviceId, start_time, end_time, deviceNameIdJson]);

    // Extract unique part numbers across all devices
    const uniquePartNumbers = useMemo(() => {
        const parts = new Set();
        Object.values(partData).forEach((deviceParts) => {
            deviceParts.forEach((part) => {
                if (part.partnumber) parts.add(part.partnumber);
            });
        });

        const sortedParts = Array.from(parts).sort((a, b) => {
            const numA = Number(a);
            const numB = Number(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        if (sortedParts.length > 0 && selectedPartNumber === null) {
            setSelectedPartNumber(sortedParts[0]);
        }

        return sortedParts;
    }, [partData, selectedPartNumber]);

    console.log('Part Data', partData);

    // Data for selected part number
    const getSelectedPartData = useMemo(() => {
        if (!selectedPartNumber) return [];

        const allFilteredData = [];
        Object.keys(partData).forEach((deviceName) => {
            const deviceParts = partData[deviceName] || [];
            const partsForSelectedNumber = deviceParts
                .filter((part) => part.partnumber === selectedPartNumber)
                .map((part) => ({ ...part, deviceName }));
            allFilteredData.push(...partsForSelectedNumber);
        });

        return allFilteredData.sort((a, b) => Number(a.ts) - Number(b.ts));
    }, [partData, selectedPartNumber]);

    function formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", s > 0 ? `${s}s` : ""]
            .filter(Boolean)
            .join(" ");
    }

    function formatEpoch(epoch) {
        if (epoch.toString().length === 10) epoch *= 1000;
        const date = new Date(epoch);
        const pad = (n) => n.toString().padStart(2, "0");
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        const strHours = hours.toString().padStart(2, "0");
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${strHours}:${minutes}:${seconds} ${ampm}`;
    }

    const secondsToHhMmSs = (totalSeconds) => {
        if (!totalSeconds) return "00:00:00";
        const seconds = Math.floor(totalSeconds);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (num) => String(num).padStart(2, "0");
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    // Border color for outer box
    const getOuterBorderColor = () => {
        if (!selectedPartNumber) return "#e0e0e0";
        const allParts = Object.values(partData).flat();
        const part = allParts.find((p) => p.partnumber === selectedPartNumber);
        if (!part) return "#e0e0e0";
        return Number(part.referenceTime) > Number(part.actualTime) ? "green" : "red";
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
                highestcomponent={highcode}
            />

            {/* Right side content */}
            <Box flex={1} p={3} overflow="auto">
                {/* Header */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h5" fontWeight="bold">
                        {componentName || code ? `${componentName} (${code})` : "Component Details"}
                        <Typography
                            variant="subtitle2"
                            display="block"
                            fontWeight="bold"
                            sx={{ fontSize: "18px" }}
                        >
                            {deviceName || code ? `${deviceName}` : "Device"}
                        </Typography>
                    </Typography>

                    {/* Back Button */}
                    <Button
                        variant="contained"
                        onClick={() => navigate(previousScreen, { state: { selectedDevice, componentName, code } })}
                        color="warning"
                        sx={{
                            backgroundColor: "#626262",
                            "&:hover": { backgroundColor: "#4d4d4d" },
                        }}
                    >
                        Back
                    </Button>
                </Box>

                {/* Time Range */}
                {start_time && end_time && (
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                        {formatEpoch(Number(start_time))} → {formatEpoch(Number(end_time))}
                    </Typography>
                )}


            </Box>
        </Box>
    );
};

export default PartCycleTime;
