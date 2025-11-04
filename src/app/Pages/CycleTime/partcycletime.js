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
import "./partcycletime.css";
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
        codeWiseSummary
    } = location.state || {};

    console.log('From', start_time, 'to', end_time, 'Component', componentName, 'deviceName', deviceName, 'code', code, 'codeWiseSummary', codeWiseSummary,'selectedDevice',selectedDevice)

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

const deviceNames = deviceName
  ? deviceName.split(",").map((n) => n.trim()) // ✅ convert to array and trim
  : [];

const deviceId = deviceNames
  .map(
    (name) =>
      Object.keys(deviceNameIdJson).find(
        (key) => deviceNameIdJson[key] === name
      ) || ""
  )
  .filter(Boolean)
  .join(", ");


    console.log('device Name Id',deviceId)

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
    
    const [liveReasonData, setLiveReasonData] = useState({});


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
    }, [deviceId, start_time, end_time]);

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
        if (epoch == null || isNaN(epoch)) return "-"; // guard

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
        if (!totalSeconds) return "00:00";

        const seconds = Math.floor(totalSeconds);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (num) => String(num).padStart(2, "0");

        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        } else {
            return `${pad(m)}:${pad(s)}`;
        }
    };


    // Border color for outer box
    const getOuterBorderColor = () => {
        if (!selectedPartNumber) return "#e0e0e0";
        const allParts = Object.values(partData).flat();
        const part = allParts.find((p) => p.partnumber === selectedPartNumber);
        if (!part) return "#e0e0e0";
        return Number(part.referenceTime) > Number(part.actualTime) ? "green" : "red";
    };
const referenceTimes = Object.fromEntries(
  Object.entries(partData || {}).map(([machine, runs]) => [
    machine,
    runs?.[1]?.referenceTime || "00:00:00"
  ])
);


    console.log(referenceTimes);


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
                    <Box display="flex" alignItems="center" gap={2}>

                        {/* Cycle Time Display Box */}
                        <div className="cycletime-box">
                            {Object.entries(referenceTimes || {}).map(([machine, ref]) => (
                                <span key={machine}>
                                    Cycle Time: {secondsToHhMmSs(ref)}
                                </span>
                            ))}
                        </div>



                        {/* Back Button */}
                        <Button
                            variant="contained"
                            onClick={() =>
                                navigate(previousScreen, {
                                    state: { selectedDevice, componentName, code, codeWiseSummary },
                                })
                            }
                            color="warning"
                            sx={{
                                backgroundColor: "#626262",
                                "&:hover": { backgroundColor: "#4d4d4d" },
                            }}
                        >
                            Back
                        </Button>
                    </Box>
                </Box>

                {/* Time Range */}
                {start_time && end_time && (
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                        {formatEpoch(Number(start_time))} → {formatEpoch(Number(end_time))}
                    </Typography>
                )}

                {/* --- NEW SECTION: Part Number Buttons --- */}
                <Box
                    p={3}
                    mb={1}
                    mt={1}
                    sx={{
                        // border: `1px solid #aaa7a7ff`,
                        borderRadius: "12px",
                        // backgroundColor: "#ffffff",
                        minHeight: "200px",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "15px",
                            maxHeight: "196px",
                            overflowY: "auto",
                            paddingRight: "6px",
                        }}
                    >
                        {uniquePartNumbers.length > 0 ? (
                            uniquePartNumbers.map((partNo) => {
                                const allParts = Object.values(partData).flat();
                                const part = allParts.find((p) => p.partnumber === partNo);

                                // 🟢 Medium green / 🟥 Medium red
                                const borderColor =
                                    part && Number(part.referenceTime) > Number(part.actualTime)
                                        ? "#4CAF50"
                                        : "#F44336";

                                const isSelected = selectedPartNumber === partNo;

                                // 🩵 Light tint for selected background
                                const tintedBg =
                                    borderColor === "#4CAF50"
                                        ? "rgba(76, 175, 80, 0.15)"
                                        : "rgba(244, 67, 54, 0.15)";

                                return (
                                    <Box
                                        key={partNo}
                                        sx={{
                                            background:
                                                "linear-gradient(to bottom, rgba(210,210,210,0.4), transparent)",
                                            p: "4px",
                                            borderRadius: "16px",
                                            flex: "0 0 auto",
                                        }}
                                    >
                                        <Button
                                            onClick={() => setSelectedPartNumber(partNo)}
                                            sx={{
                                                p: "4px",
                                                borderRadius: "12px",
                                                background:
                                                    "linear-gradient(to bottom, #ffffff, rgba(230,230,230,0.4))",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                                transition: "all 0.15s ease-in-out",
                                                textTransform: "none",
                                                "&:active": {
                                                    boxShadow: "0 0 1px rgba(0,0,0,0.5)",
                                                    transform: "scale(0.995)",
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    background: isSelected
                                                        ? tintedBg
                                                        : "linear-gradient(to bottom, rgba(230,230,230,0.4), rgba(255,255,255,0.8))",
                                                    borderLeft: `6px solid ${borderColor}`, // 🔹 colored left border
                                                    borderRadius: "8px",
                                                    px: 2,
                                                    py: 1,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "flex-start",
                                                    gap: "4px",
                                                    minWidth: "150px",
                                                }}
                                            >
                                                <Typography
                                                    variant="subtitle1"
                                                    fontWeight="bold"
                                                    sx={{ color: "#000" }}
                                                >
                                                    Part {partNo}
                                                </Typography>

                                                <Typography variant="body2" color="textSecondary">
                                                    Run Time: {formatDuration(part?.actualTime || 0)}
                                                </Typography>
                                            </Box>
                                        </Button>
                                    </Box>
                                );
                            })
                        ) : (
                            <Typography variant="body2" color="textSecondary">
                                No part data available for the selected period.
                            </Typography>
                        )}
                    </Box>
                </Box>



                {/* --- DETAILED LOG TABLE (UNCHANGED) --- */}
                <Box
                    p={1}
                    sx={{
                        border: "1px solid #bab5b5ff",
                        borderRadius: "8px",
                        maxHeight: "60vh",
                        overflow: "auto",
                        backgroundColor: "#ffffff"
                    }}
                >
                    <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ p: 1 }}>
                        Detailed Log for Part: {selectedPartNumber || "N/A"}
                    </Typography>

                    {selectedPartNumber && (
                        <Box mt={2} mb={2}>
                            {(() => {
                                // 🔹 Find the selected part in your data array
                                const selectedPart = getSelectedPartData.find(
                                    (p) =>
                                        p.partnumber === selectedPartNumber ||
                                        p.name === selectedPartNumber
                                );

                                if (!selectedPart) {
                                    return (
                                        <Typography variant="body2" color="textSecondary" sx={{ p: 1 }}>
                                            No time range found for Part {selectedPartNumber}.
                                        </Typography>
                                    );
                                }

                                const partStart = selectedPart.start_time || start_time;
                                const partEnd = selectedPart.end_time || end_time;


                                return (
                                    <iframe
                                        title="Main Dashboard"
                                        width="100%"
                                        height="180px"
                                        src={`http://192.168.0.224:3000/yantra/d/f39bad0f-9771-4c10-a0c3-3c6935073647/summary-2?orgId=1&var-from=${partStart}&var-to=${partEnd}&var-device_id=${deviceId}&var-device_name=${deviceName}&var-token=${newToken}&var-url=${baseUrl}&theme=light&kiosk`}
                                        frameBorder="0"
                                    ></iframe>
                                );
                            })()}
                        </Box>
                    )}

{selectedPartNumber && getSelectedPartData.length > 0 ? (
  <>
    {/* ================= Table Section ================= */}
    <TableContainer component={Paper} sx={{ boxShadow: "none", border: "none" }}>
      <Table stickyHeader size="small" aria-label="part cycle time details">
        <TableHead>
          <TableRow sx={{ backgroundColor: "#e3f2fd" }}>
            <TableCell sx={{ fontWeight: "bold", minWidth: 100 }}>Device</TableCell>
            <TableCell sx={{ fontWeight: "bold", minWidth: 150 }}>Start Time</TableCell>
            <TableCell sx={{ fontWeight: "bold", minWidth: 150 }}>End Time</TableCell>
            <TableCell align="right" sx={{ fontWeight: "bold", minWidth: 100 }}>Cycle Time</TableCell>
            <TableCell align="right" sx={{ fontWeight: "bold", minWidth: 80 }}>Part Time</TableCell>
            <TableCell align="right" sx={{ fontWeight: "bold", minWidth: 100 }}>Active Time</TableCell>
            <TableCell align="right" sx={{ fontWeight: "bold", minWidth: 100 }}>Idle Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {getSelectedPartData.map((part, index) => (
            <TableRow
              key={index}
              sx={{
                "&:last-child td, &:last-child th": { border: 0 },
                backgroundColor: index % 2 === 0 ? "#fafafa" : "#ffffff",
              }}
            >
              <TableCell component="th" scope="row">{part.deviceName}</TableCell>
              <TableCell>{formatEpoch(Number(part.start_time))}</TableCell>
              <TableCell>{formatEpoch(Number(part.end_time))}</TableCell>
              <TableCell align="right">{secondsToHhMmSs(part.referenceTime)}</TableCell>
              <TableCell align="right" sx={{ color: "#00796b", fontWeight: "bold" }}>
                {secondsToHhMmSs(Math.round(part.actualTime))}
              </TableCell>
              <TableCell align="right">{secondsToHhMmSs(part.run_duration)}</TableCell>
              <TableCell align="right">
                {secondsToHhMmSs(Math.round(part.idle_duration))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    {/* ================= Iframe Section Below ================= */}
    <Box mt={3}>
      {(() => {
        const selectedPart = getSelectedPartData.find(
          (p) =>
            p.partnumber === selectedPartNumber ||
            p.name === selectedPartNumber
        );
        if (!selectedPart) return null;

        const partStart = selectedPart.start_time;
        const partEnd = selectedPart.end_time;

        return (
          <iframe
            title="Part Cycle Time Downtime"
            width="100%"
            height="400px"
            src={`http://192.168.0.224:3000/yantra/d/eda07cde-4f19-4606-bab7-bf4ca1718237/part-cyclet-time-downtime?orgId=1&var-token=${newToken}&var-device_name=${deviceName}&var-from=${partStart}&var-to=${partEnd}&var-device_id=${deviceId}&var-url=${baseUrl}&theme=light&kiosk`}
            frameBorder="0"
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              backgroundColor: "#fff",
            }}
          ></iframe>
        );
      })()}
    </Box>
  </>
) : (
  selectedPartNumber && (
    <Typography variant="body2" color="textSecondary" sx={{ p: 1 }}>
      No data entries found for Part **{selectedPartNumber}** in this time range.
    </Typography>
  )
)}

                </Box>
            </Box>
        </Box>
    );
};

export default PartCycleTime;
