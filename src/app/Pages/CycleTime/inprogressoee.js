import React, { useEffect, useState } from "react";
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
import "./inprogressoee.css";

const InprogressOee = () => {
    const [shifts, setShifts] = useState([]);
    const [devices, setDevices] = useState([]);
    const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
    const [oeeData, setOeeData] = useState({});
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const [selectedMachine, setSelectedMachine] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();

    const baseUrl = window._env_.SERVER_URL;
    const newToken = localStorage.getItem("newToken");

    const {
        previousScreen,
        componentName,
        deviceName,
        code,
        selectedDevice,
        highcode,
    } = location.state || {};

    console.log("From", from, "to", to, "Component", componentName, "deviceName", deviceName, "code", code, "selectedDevice", selectedDevice);

    const Id = localStorage.getItem("CustomerID");
    const customerId = decodeURIComponent(Id || "").replace(/^"|"$/g, "");

    // -------------------------------
    // Fetch Shifts and determine active shift time
    // -------------------------------
    const fetchShifts = async () => {
        try {
            const result = await customerbasedshift(customerId, "allShift");
            const dataShifts = result?.[0]?.value ?? [];
            setShifts(dataShifts);

            if (!Array.isArray(dataShifts) || dataShifts.length === 0) return;

            const now = Date.now();

            const toEpoch = (timeStr, addDay = false) => {
                if (!timeStr) return null;
                const [h, m, s] = timeStr.split(":").map(Number);
                const d = new Date();
                d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
                if (addDay) d.setDate(d.getDate() + 1);
                return d.getTime();
            };

            const currentShift = dataShifts.find((shift) => {
                if (!shift.start_time || !shift.end_time) return false;
                const startEpoch = toEpoch(shift.start_time);
                const endEpoch = toEpoch(shift.end_time, shift.end_time < shift.start_time);
                return now >= startEpoch && now <= endEpoch;
            });

            if (currentShift) {
                setFrom(toEpoch(currentShift.start_time));
                setTo(toEpoch(currentShift.end_time, currentShift.end_time < currentShift.start_time));
            } else {
                const firstShift = dataShifts[0];
                setFrom(toEpoch(firstShift.start_time));
                setTo(toEpoch(firstShift.end_time, firstShift.end_time < firstShift.start_time));
            }
        } catch (err) {
            console.error("Failed to fetch shifts", err);
        }
    };

    // -------------------------------
    // Fetch Devices
    // -------------------------------
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


    useEffect(() => {
        if (!from || !to || !selectedDevice) return;

        const fetchAllData = async () => {
            try {
                const deviceIds = Array.isArray(selectedDevice)
                    ? selectedDevice
                    : [selectedDevice];

                const allDataArray = await Promise.all(
                    deviceIds.map(async (deviceId) => {
                        const deviceName =
                            deviceNameIdJson?.[deviceId] ||
                            deviceNameIdJson?.[deviceId.toUpperCase()] ||
                            deviceNameIdJson?.[deviceId.toLowerCase()] ||
                            deviceId;

                        const response = await telemetrykeydata(
                            deviceId,
                            "DEVICE",
                            ["oee", "historicalbaseline", "machine_Status", "operations"],
                            from,
                            to
                        );

                        const latestOee =
                            Array.isArray(response?.oee) && response.oee.length > 0
                                ? parseInt(response.oee[0].value) || 0
                                : 0;

                        let baselineData = {};
                        if (
                            Array.isArray(response?.historicalbaseline) &&
                            response.historicalbaseline.length > 0
                        ) {
                            try {
                                baselineData = JSON.parse(
                                    response.historicalbaseline[0].value || "{}"
                                );
                            } catch {
                                baselineData =
                                    response.historicalbaseline[0].value || {};
                            }
                        }

                        const machineStatus =
                            Array.isArray(response?.machine_Status) &&
                                response.machine_Status.length > 0
                                ? response.machine_Status[0].value
                                : "Unknown";

                        let operationsData = {};
                        if (
                            Array.isArray(response?.operations) &&
                            response.operations.length > 0
                        ) {
                            try {
                                operationsData = JSON.parse(
                                    response.operations[0].value || "{}"
                                );
                            } catch {
                                operationsData = response.operations[0].value || {};
                            }
                        }

                        return {
                            deviceId,
                            deviceName,
                            oee: latestOee,
                            historicalbaseline: baselineData,
                            machine_Status: machineStatus,
                            operations: operationsData,
                        };
                    })
                );

                const machineWiseData = {};
                allDataArray.forEach((d) => {
                    machineWiseData[d.deviceName] = {
                        deviceId: d.deviceId,
                        deviceName: d.deviceName,
                        oee: d.oee,
                        historicalbaseline: d.historicalbaseline,
                        machine_Status: d.machine_Status,
                        operations: d.operations,
                    };
                });

                setOeeData(machineWiseData);
                console.table(allDataArray);
            } catch (error) {
                console.error("❌ Error fetching telemetry data:", error);
                setOeeData({});
            }
        };

        // 🔹 Initial fetch
        fetchAllData();

        // 🔁 Repeat every 10 seconds
        const interval = setInterval(fetchAllData, 10000);

        // 🧹 Cleanup on unmount or when dependencies change
        return () => clearInterval(interval);
    }, [from, to, selectedDevice]);


    console.log('Oee Data', oeeData);


    useEffect(() => {
        const entries = Object.entries(oeeData || {});
        if (entries.length > 0 && !selectedMachine) {
            const [_, firstMachineData] = entries[0];
            setSelectedMachine({
                id: firstMachineData.deviceId,
                name: firstMachineData.deviceName,
            });
        }
    }, [oeeData, selectedMachine]);

    console.log("Selected Machine", selectedMachine);


    return (
        <div>
            <div className="header-container">
                <div className="heading">Inprogress OEE</div>

                <Button
                    variant="contained"
                    onClick={() => navigate("/production-analysis")}
                    color="warning"
                    sx={{
                        backgroundColor: "#626262",
                        "&:hover": { backgroundColor: "#4d4d4d" },
                    }}
                >
                    Back
                </Button>
            </div>

            <div className="oee-dashboard">
                {Object.entries(oeeData).map(([machineID, data], index) => {
                    const { deviceName, oee, machine_Status, operations, deviceId } = data;

                    let tileClass = "";
                    switch ((machine_Status || "").toLowerCase()) {
                        case "running":
                            tileClass = "tile-running";
                            break;
                        case "idle":
                            tileClass = "tile-idle";
                            break;
                        case "alarm":
                            tileClass = "tile-alarm";
                            break;
                        case "disconnect":
                            tileClass = "tile-disconnect";
                            break;
                        default:
                            tileClass = "tile-running";
                            break;
                    }

                    const isSelected = selectedMachine?.id === deviceId;
                    const cycleText = machine_Status === "Running" ? "IN - CYCLE" : machine_Status || "";

                    return (
                        <div
                            key={machineID || index}
                            className={`oee-tile ${tileClass} ${isSelected ? "selected-tile" : ""}`}
                            onClick={() =>
                                setSelectedMachine({ id: deviceId, name: deviceName })
                            }
                            style={{ cursor: "pointer" }}
                        >
                            <div className="machine-name">{deviceName || 'Machine'}</div>
                            <div className="status-text">{machine_Status || "Unknown"}</div>
                            <div className="oee-value">{oee ?? 0}%</div>
                            <div className="cycle-status">{cycleText}</div>
                            {operations?.part && (
                                <div className="program-number">Program: {operations.part}</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedMachine && oeeData && (
                <div>
                    <div className="iframe-header">
                        <div className="iframe-title">
                            Hour Wise OEE Details - {selectedMachine.name}
                        </div>
                        <div className="operation-name">
                            Component: {oeeData[selectedMachine.name]?.operations?.operation_name || "N/A"}
                        </div>
                    </div>

                    <iframe
                        title="Inprogress OEE Dashboard"
                        width="100%"
                        height="600"
                        src={`http://192.168.0.224:3000/yantra/d/e370a560-3c93-47af-add1-21af2ad33ee1/inprogressoee-dashboard?orgId=1&var-token=${newToken}&var-from=${from}&var-to=${to}&var-url=${baseUrl}&var-device_id=${selectedMachine.id}&var-device_name=${encodeURIComponent(
                            selectedMachine.name
                        )}&theme=light&kiosk`}
                        frameBorder="0"
                        style={{ borderRadius: "8px" }}
                    ></iframe>
                </div>
            )}



        </div>
    );
};

export default InprogressOee;
