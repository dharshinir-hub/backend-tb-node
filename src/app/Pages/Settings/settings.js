import { useState, useEffect } from "react";
import {
    Box,
    Tabs,
    Tab,
    Typography,
    Card,
    CardContent,
    CardActionArea,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    Divider,
    Tooltip,
    IconButton,
    Paper
} from "@mui/material";
import { LocalizationProvider, TimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import Swal from "sweetalert2";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SaveIcon from "@mui/icons-material/Save";

import { customerbasedshift, customerbaseddevices, Deviceattributeget, cleanCustomerId } from "../../Services/app/operatorservice";
import { Downtimeadd } from "../../Services/app/masterservice";
import "../../Pages/Machines/machine.css";
import EmailConfig from "../EmailConfiguration/emailconfig";

const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index}>
        {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
);

const Settings = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [machineGroups, setMachineGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [notifications, setNotifications] = useState({});
    const [openTimeDialog, setOpenTimeDialog] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [selectedType, setSelectedType] = useState(null);
    const [notificationTimeValue, setNotificationTimeValue] = useState(dayjs("00:00:00", "HH:mm:ss"));
    const [timeError, setTimeError] = useState(""); // ✅ error handling
    const [deviceMap, setDeviceMap] = useState({});
    const [allDevices, setAllDevices] = useState([]);
    const [ungroupedDevices, setUngroupedDevices] = useState([]); // ✅ non-grouped
    const customerId = localStorage.getItem("CustomerID");
    const isGplastCustomer = cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID;
    

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: devices = [] } = await customerbaseddevices(customerId, 100, 0);
            setAllDevices(devices);

            const map = {};
            devices.forEach(d => (map[d.name] = d.id?.id || d.id));
            setDeviceMap(map);

            const key = "machinegroups";
            const groupData = await customerbasedshift(customerId, key);
            const groups = groupData[0]?.value || [];
            setMachineGroups(groups);

            // ✅ find non-grouped devices
            const groupedNames = groups.flatMap(g => g.machines);
            const nonGrouped = devices
                .map(d => d.name)
                .filter(name => !groupedNames.includes(name));
            setUngroupedDevices(nonGrouped);

            const defaults = {};
            devices.forEach(d => {
                const deviceId = d.id?.id || d.id;
                defaults[deviceId] = {
                    idle: { time: dayjs("00:00:00", "HH:mm:ss"), enabled: false },
                    disconnect: { time: dayjs("00:00:00", "HH:mm:ss"), enabled: false },
                    alarm: { time: dayjs("00:00:00", "HH:mm:ss"), enabled: false },
                };
            });
            setNotifications(defaults);

            await Promise.all(devices.map(d => loadDeviceThresholds(d.id?.id || d.id)));
        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    const loadDeviceThresholds = async (deviceId) => {
        try {
            const response = await Deviceattributeget(deviceId, "idle_threshold,disconnect_threshold,alarm_threshold");
            const newNotif = {};

            ["idle", "disconnect", "alarm"].forEach(type => {
                const keyName = `${type}_threshold`;
                const attr = response?.find(r => r.key === keyName);

                if (attr) {
                    const thresholdSeconds = Number(attr.value?.threshold) || 0;
                    const enabled = attr.value?.mode === "enabled";
                    newNotif[type] = {
                        time: dayjs().startOf("day").add(thresholdSeconds, "second"),
                        enabled
                    };
                } else {
                    newNotif[type] = { time: dayjs("00:00:00", "HH:mm:ss"), enabled: false };
                }
            });

            setNotifications(prev => ({ ...prev, [deviceId]: newNotif }));
        } catch (err) {
            console.error(`Error fetching thresholds for device ${deviceId}:`, err);
        }
    };

    const updateNotification = (deviceId, type, field, value) => {
        setNotifications(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [type]: { ...prev[deviceId][type], [field]: value }
            }
        }));
    };

    const openTimePicker = (deviceId, type) => {
        setSelectedDeviceId(deviceId);
        setSelectedType(type);
        const currentTime = notifications[deviceId]?.[type]?.time || dayjs("00:00:00", "HH:mm:ss");
        setNotificationTimeValue(currentTime);
        setTimeError("");
        setOpenTimeDialog(true);
    };

    // ✅ time validation logic
    const handleTimeChange = (newValue) => {
        setNotificationTimeValue(newValue);
        if (!newValue || !newValue.isValid()) {
            setTimeError("Invalid time format");
        } else {
            setTimeError("");
        }
    };

    const saveTime = () => {
        if (!selectedDeviceId || !selectedType) return;
        if (timeError) return;
        updateNotification(selectedDeviceId, selectedType, "time", notificationTimeValue);
        setOpenTimeDialog(false);
    };

    const backToGroups = () => setSelectedGroup(null);

    const saveMachineThresholds = async (deviceId) => {
        try {
            const machineNotif = notifications[deviceId];
            if (!machineNotif) return;

            const payload = {};
            ["idle", "disconnect", "alarm"].forEach(type => {
                const notif = machineNotif[type];
                const totalSeconds = notif.time.diff(dayjs().startOf("day"), "second");
                payload[`${type}_threshold`] = { mode: notif.enabled ? "enabled" : "disabled", threshold: totalSeconds };
            });

            await Downtimeadd("DEVICE", deviceId, "SERVER_SCOPE", payload);
             Swal.fire({
            icon: "success",
            title: "Success",
            text: "Changes saved successfully",
            showConfirmButton: false,
            timer: 1500,
        });
        } catch (err) {
            console.error(err);
            Swal.fire("Error", `Failed to save changes`, "error");
        }
    };

    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="left-labels">
                    <div className="shift-content"><h5>Settings</h5></div>
                </div>

                <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 2 }}>
                    <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} textColor="inherit" TabIndicatorProps={{ sx: { backgroundColor: "orange" } }}>
                        <Tab label="Notification" />
                        {isGplastCustomer && <Tab label="Email Configuration" />}
                    </Tabs>
                </Box>

                <TabPanel value={activeTab} index={0}>
                    <p style={{
                        color: "#666",
                        fontSize: "0.85rem",
                        marginBottom: "0.3rem",
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        boxSizing: "border-box"
                    }}>
                        Configure notification alerts for each machine (Idle, Disconnect, Alarm).
                    </p>

                    {!selectedGroup && (
                        <Grid container spacing={1.5}>
                            {/* ✅ Only show Non-grouped Machines if exists */}
                            {ungroupedDevices.length > 0 && (
                                <Grid item xs={12} sm={6} md={4}>
                                    <Card
                                        sx={{
                                            background: "#fafafa",
                                            border: "1px solid #ddd",
                                            borderRadius: "8px",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                                            cursor: "pointer",
                                            "&:hover": { boxShadow: "0 3px 8px rgba(0,0,0,0.12)" },
                                        }}
                                    >
                                        <CardActionArea
                                            onClick={() => {
                                                setSelectedGroup({
                                                    name: "Non-grouped Machines",
                                                    machines: ungroupedDevices
                                                });
                                            }}
                                        >
                                            <CardContent sx={{ p: 1.5 }}>
                                                <Typography variant="h6" sx={{ color: "orange", fontWeight: 600 }}>
                                                    Non-grouped Machines
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: "#555", fontSize: "0.8rem" }}>
                                                    {ungroupedDevices.length} Machines
                                                </Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            )}

                            {/* Normal group cards */}
                            {machineGroups.map(group => (
                                <Grid item xs={12} sm={6} md={4} key={group.id}>
                                    <Card
                                        sx={{
                                            background: "#fafafa",
                                            border: "1px solid #ddd",
                                            borderRadius: "8px",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                                            cursor: "pointer",
                                            "&:hover": { boxShadow: "0 3px 8px rgba(0,0,0,0.12)" },
                                        }}
                                    >
                                        <CardActionArea onClick={() => setSelectedGroup(group)}>
                                            <CardContent sx={{ p: 1.5 }}>
                                                <Typography variant="h6" sx={{ color: "orange", fontWeight: 600 }}>
                                                    {group.name}
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: "#555", fontSize: "0.8rem" }}>
                                                    {group.machines.length} Machines
                                                </Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}

                    {selectedGroup && (
                        <div>
                            <Button
                                variant="outlined"
                                sx={{ mb: 1.5, borderColor: "orange", color: "orange", textTransform: "none", fontSize: "0.85rem", p: "2px 10px" }}
                                onClick={backToGroups}
                            >
                                ← Back to Cells
                            </Button>
                            <Typography variant="h6" sx={{ mb: 1.5, color: "#333", fontSize: "1rem" }}>
                                {selectedGroup.name} Machines
                            </Typography>

                            <Grid container spacing={1}>
                                {selectedGroup.machines.map(machineName => {
                                    const deviceId = deviceMap[machineName] || machineName;
                                    return (
                                        <Grid item xs={12} sm={6} md={4} lg={3} key={deviceId}>
                                            <Card
                                                sx={{
                                                    height: "100%",
                                                    border: "1px solid #e0e0e0",
                                                    borderRadius: "12px",
                                                    background: "#fff",
                                                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                                                    transition: "all 0.2s ease",
                                                    "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }
                                                }}
                                            >
                                                <CardContent sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%" }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#000", fontSize: "1rem", mb: 1 }}>
                                                        {machineName}
                                                    </Typography>
                                                    <Divider sx={{ mb: 2 }} />

                                                    <Box sx={{ flexGrow: 1, mb: 2 }}>
                                                        {["idle", "disconnect", "alarm"].map(type => {
                                                            const notif = notifications[deviceId]?.[type] || {
                                                                time: dayjs("00:00:00", "HH:mm:ss"),
                                                                enabled: false
                                                            };
                                                            const colorMap = {
                                                                idle: "#F2CC0D",
                                                                disconnect: "#808080",
                                                                alarm: "#AD0317"
                                                            };
                                                            const iconMap = {
                                                                idle: "⏱️",
                                                                disconnect: "🔌",
                                                                alarm: "🚨"
                                                            };
                                                            return (
                                                                <Paper
                                                                    key={type}
                                                                    elevation={0}
                                                                    onClick={() => updateNotification(deviceId, type, "enabled", !notif.enabled)} // ✅ make paper clickable
                                                                    sx={{
                                                                        p: 1.5,
                                                                        mb: 1,
                                                                        borderRadius: "8px",
                                                                        border: "1px solid",
                                                                        borderColor: notif.enabled ? colorMap[type] : "#e0e0e0",
                                                                        backgroundColor: notif.enabled ? `${colorMap[type]}10` : "#fafafa",
                                                                        transition: "all 0.2s ease",
                                                                        cursor: "pointer"
                                                                    }}
                                                                >
                                                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                                                            <Box sx={{
                                                                                width: 32,
                                                                                height: 32,
                                                                                borderRadius: "8px",
                                                                                backgroundColor: notif.enabled ? colorMap[type] : "#e0e0e0",
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                                justifyContent: "center",
                                                                                color: notif.enabled ? "white" : "#999",
                                                                                fontSize: "1rem"
                                                                            }}>
                                                                                {iconMap[type]}
                                                                            </Box>
                                                                            <Box>
                                                                                <Typography sx={{ fontWeight: 600, textTransform: "capitalize", fontSize: "0.85rem", color: notif.enabled ? colorMap[type] : "#666" }}>
                                                                                    {type}
                                                                                </Typography>
                                                                                <Typography sx={{ color: notif.enabled ? colorMap[type] : "#888", fontSize: "0.75rem", fontWeight: 500 }}>
                                                                                    <AccessTimeIcon sx={{ fontSize: 12 }} /> {notif.time?.format("HH:mm:ss") || "00:00:00"}
                                                                                </Typography>
                                                                            </Box>
                                                                        </Box>
                                                                        <Tooltip title="Edit time threshold">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation(); // prevent toggle
                                                                                    openTimePicker(deviceId, type);
                                                                                }}
                                                                                sx={{ backgroundColor: "rgba(255,152,0,0.1)", "&:hover": { backgroundColor: "rgba(255,152,0,0.2)" } }}
                                                                            >
                                                                                <AccessTimeIcon sx={{ fontSize: 16, color: "orange" }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Box>
                                                                </Paper>
                                                            );
                                                        })}
                                                    </Box>

                                                    <Box sx={{ mt: "auto", display: "flex", justifyContent: "center" }}>
                                                        <Button
                                                            startIcon={<SaveIcon />}
                                                            variant="contained"
                                                            color="warning"
                                                            size="small"
                                                            onClick={() => saveMachineThresholds(deviceId)}
                                                            sx={{
                                                                borderRadius: "20px",
                                                                textTransform: "none",
                                                                fontWeight: 600,
                                                                px: 3,
                                                                boxShadow: "0 2px 8px rgba(255,152,0,0.3)",
                                                                "&:hover": { boxShadow: "0 4px 12px rgba(255,152,0,0.4)" }
                                                            }}
                                                        >
                                                            Save Settings
                                                        </Button>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </div>
                    )}
                </TabPanel>

                {isGplastCustomer && (
                    <TabPanel value={activeTab} index={1}>
                        <EmailConfig />
                    </TabPanel>
                )}

                {/* ✅ Time Dialog with validation */}
                <Dialog open={openTimeDialog} onClose={() => setOpenTimeDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>
                        Edit {selectedType ? selectedType.charAt(0).toUpperCase() + selectedType.slice(1) : ""} Time
                    </DialogTitle>
                    <DialogContent>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <TimePicker
                                value={notificationTimeValue}
                                onChange={handleTimeChange}
                                views={["hours", "minutes", "seconds"]}
                                format="HH:mm:ss"
                                ampm={false}
                                sx={{
                                    width: "100%",
                                    "& .MuiOutlinedInput-root": {
                                        "& fieldset": { borderColor: timeError ? "red" : "orange" },
                                        "&:hover fieldset": { borderColor: "orange" },
                                        "&.Mui-focused fieldset": { borderColor: "orange" },
                                    },
                                }}
                            />
                        </LocalizationProvider>
                        {timeError && (
                            <Typography variant="caption" sx={{ color: "red", mt: 1 }}>
                                {timeError}
                            </Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenTimeDialog(false)}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="warning"
                            size="small"
                            onClick={saveTime}
                            disabled={!!timeError}
                        >
                            Ok
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        </div>
    );
};

export default Settings;
