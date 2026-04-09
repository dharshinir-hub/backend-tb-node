import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress,
    Switch,
    FormControlLabel,
    Checkbox,
    ListItemText,
    OutlinedInput,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    Settings as SettingsIcon,
    Sort as SortIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';
import {
    customerbasedshift
} from '../../Services/app/operatorservice';
import { createTbWebSocket } from '../../Services/app/tbWebSocketService';
import './MachineStatusDashboard.css';

const STATUS_OPTIONS = ['Running', 'Idle', 'Alarm', 'Disconnected'];

const MachineStatusDashboard = () => {
    const customerId = localStorage.getItem('CustomerID');
    const navigate = useNavigate();
    const {
        machineGroups,
        selectedGroups,
        handleGroupChange,
        getDeviceObjectsForMachines,
        loading: groupsLoading
    } = useMachineGroups(customerId);

    const [machineData, setMachineData] = useState({});
    const [shifts, setShifts] = useState([]);
    const [currentShift, setCurrentShift] = useState(null);
    const [customerTitle, setCustomerTitle] = useState(localStorage.getItem('customerTitle') || 'MACHINE DASHBOARD');
    const [autoScroll, setAutoScroll] = useState(true);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [selectedStatuses, setSelectedStatuses] = useState(STATUS_OPTIONS);
    const [statusPriority, setStatusPriority] = useState(() => {
        const saved = localStorage.getItem('dashboard_status_priority');
        return saved ? JSON.parse(saved) : ['Alarm', 'Idle', 'Running', 'Disconnected'];
    });
    const [utilSort, setUtilSort] = useState(() => {
        return localStorage.getItem('dashboard_util_sort') || 'None';
    });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
    const contentRef = useRef(null);
    const dashboardRef = useRef(null);
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);

    // --- WebSocket message handler: merges status/utilization updates into machineData ---
    const handleWsMessage = useCallback((msg, cmdIdToDeviceId) => {
        const deviceId = cmdIdToDeviceId[msg.subscriptionId];
        if (!deviceId || !msg.data) return;

        const update = msg.data;
        const getVal = (arr) => (arr && arr.length > 0) ? arr[0][1] : null;
        const getTs  = (arr) => (arr && arr.length > 0) ? arr[0][0] : null;

        setMachineData(prev => {
            const existing = prev[deviceId] || { status: 'No Data', utilization: 0, ts: null };
            const updated = { ...existing };

            if (update.machine_status !== undefined) {
                const rawS = getVal(update.machine_status);
                if (rawS !== null) {
                    const code = Number(rawS);
                    let statusText = 'No Data';
                    if ([0, 1, 2].includes(code)) statusText = 'Idle';
                    else if (code === 3) statusText = 'Running';
                    else if ([4, 5].includes(code)) statusText = 'Alarm';
                    else if (code === 100) statusText = 'Disconnected';
                    updated.status = statusText;
                    updated.ts = getTs(update.machine_status);
                }
            }
            if (update.utilization !== undefined) {
                const v = getVal(update.utilization);
                if (v !== null) updated.utilization = Number(v);
            }

            return { ...prev, [deviceId]: updated };
        });
    }, []);

    // --- Start WebSocket subscription ---
    const startWs = useCallback((deviceIds) => {
        const token = localStorage.getItem('token');
        if (!token || !deviceIds.length) return;

        const base = (window._env_.SERVER_URL || '').replace(/\/$/, '');
        const wsUrl = base.replace(/^http/, 'ws') + '/api/ws/plugins/telemetry?token=' + token;

        if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; }

        const ws = createTbWebSocket({
            url: wsUrl,
            onOpen: () => {
                setWsConnected(true);
                ws.subscribe(deviceIds);
            },
            onMessage: (msg, map) => handleWsMessage(msg, map),
            onClose: () => setWsConnected(false),
            onError: () => setWsConnected(false),
        });
        ws.connect();
        wsRef.current = ws;
    }, [handleWsMessage]);

    // Live Clock for timers
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Shift Logic
    const convertShiftToEpoch = (date, start, end) => {
        let startTime = dayjs(`${date.format("YYYY-MM-DD")} ${start}`);
        let endTime = dayjs(`${date.format("YYYY-MM-DD")} ${end}`);
        if (endTime.isBefore(startTime)) endTime = endTime.add(1, "day");
        return { from: startTime.valueOf(), to: endTime.valueOf() };
    };

    const getCurrentShiftInfo = (shiftList) => {
        const now = dayjs();
        for (const s of shiftList) {
            let { from, to } = convertShiftToEpoch(now, s.start_time, s.end_time);
            if (now.valueOf() >= from && now.valueOf() < to) return { ...s, from, to };
            let { from: fromY, to: toY } = convertShiftToEpoch(now.subtract(1, "day"), s.start_time, s.end_time);
            if (now.valueOf() >= fromY && now.valueOf() < toY) return { ...s, from: fromY, to: toY };
        }
        return null;
    };

    const fetchShifts = async () => {
        try {
            const result = await customerbasedshift(customerId, "allShift");
            const shiftList = result[0]?.value || [];
            if (Array.isArray(shiftList)) {
                setShifts(shiftList);
                setCurrentShift(getCurrentShiftInfo(shiftList));
            }
        } catch (err) {
            console.error("Failed to fetch shifts", err);
        }
    };

    useEffect(() => {
        if (customerId) fetchShifts();
    }, [customerId]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (shifts.length > 0) {
                const updated = getCurrentShiftInfo(shifts);
                if (updated && (!currentShift || updated.from !== currentShift.from)) {
                    setCurrentShift(updated);
                }
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [shifts, currentShift]);

    const formatDuration = (ms) => {
        if (!ms || ms < 0) return "00:00:00";
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const allMachineDevices = useMemo(() => {
        return getDeviceObjectsForMachines(
            machineGroups
                .filter(g => selectedGroups.includes(g.name))
                .flatMap(g => g.machines || [])
        );
    }, [selectedGroups, machineGroups]);

    const currentDevices = useMemo(() => {
        const filtered = allMachineDevices.filter(d => {
            const data = machineData[d.id?.id];
            if (!data) return true; // Show loading
            return selectedStatuses.includes(data.status);
        });

        // Sorting Priority Logic (Full Sequence)
        const getPriority = (status) => {
            const index = statusPriority.indexOf(status);
            return index === -1 ? 99 : index + 1;
        };

        return [...filtered].sort((a, b) => {
            const statusA = machineData[a.id?.id]?.status;
            const statusB = machineData[b.id?.id]?.status;
            const priorityA = getPriority(statusA);
            const priorityB = getPriority(statusB);

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // Tie-breaker: Utilization (if status is Running and utilSort is active)
            if (statusA === 'Running' && utilSort !== 'None') {
                const utilA = machineData[a.id?.id]?.utilization || 0;
                const utilB = machineData[b.id?.id]?.utilization || 0;
                return utilSort === 'DESC' ? utilB - utilA : utilA - utilB;
            }

            // Fallback: Name
            return a.name.localeCompare(b.name);
        });
    }, [allMachineDevices, selectedStatuses, machineData, statusPriority, utilSort]);

    const statusCounts = useMemo(() => {
        const counts = { Total: allMachineDevices.length, Running: 0, Idle: 0, Alarm: 0, Disconnected: 0 };
        allMachineDevices.forEach(d => {
            const data = machineData[d.id?.id];
            if (data && counts[data.status] !== undefined) {
                counts[data.status]++;
            }
        });
        return counts;
    }, [allMachineDevices, machineData]);

    useEffect(() => {
        const allDevices = getDeviceObjectsForMachines(machineGroups.flatMap(g => g.machines || []));
        if (allDevices.length > 0) {
            const deviceIds = allDevices.map(d => d.id?.id).filter(Boolean);
            startWs(deviceIds);
        }

        return () => {
            if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; setWsConnected(false); }
        };
    }, [machineGroups]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!contentRef.current || !autoScroll) return;
        const container = contentRef.current;
        const scrollInterval = setInterval(() => {
            const maxScroll = container.scrollHeight - container.clientHeight;
            if (container.scrollTop >= maxScroll - 10) container.scrollTo({ top: 0, behavior: "smooth" });
            else container.scrollBy({ top: 200, behavior: "smooth" });
        }, 15000);
        return () => clearInterval(scrollInterval);
    }, [autoScroll]);

    const getStatusStyles = (status) => {
        switch (status) {
            case 'Running': return { color: '#ffffff', background: '#2e7d32', shadow: 'rgba(46, 125, 50, 0.4)' };
            case 'Idle': return { color: '#ffffff', background: '#f1a014', shadow: 'rgba(241, 160, 20, 0.4)' };
            case 'Alarm': return { color: '#ffffff', background: '#d32f2f', shadow: 'rgba(211, 47, 47, 0.4)' };
            case 'Disconnected': return { color: '#ffffff', background: '#757575', shadow: 'rgba(117, 117, 117, 0.4)' };
            default: return { color: '#000000', background: '#f5f5f5', shadow: 'rgba(0, 0, 0, 0.1)' };
        }
    };

    const handleGroupFilterChange = (event) => {
        const { value } = event.target;
        if (value.includes("all")) {
            if (selectedGroups.length === machineGroups.length) {
                handleGroupChange([]);
            } else {
                handleGroupChange(machineGroups.map(g => g.name));
            }
            return;
        }
        handleGroupChange(typeof value === 'string' ? value.split(',') : value);
    };

    const handleStatusFilterChange = (event) => {
        const { value } = event.target;
        if (value.includes("all")) {
            if (selectedStatuses.length === STATUS_OPTIONS.length) {
                setSelectedStatuses([]);
            } else {
                setSelectedStatuses(STATUS_OPTIONS);
            }
            return;
        }
        setSelectedStatuses(typeof value === 'string' ? value.split(',') : value);
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (dashboardRef.current) {
                dashboardRef.current.requestFullscreen().catch((err) => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            }
        } else {
            document.exitFullscreen();
        }
    };

    const handleStatusPriorityChange = (index, direction) => {
        const newPriority = [...statusPriority];
        const targetIndex = index + direction;
        if (targetIndex >= 0 && targetIndex < newPriority.length) {
            [newPriority[index], newPriority[targetIndex]] = [newPriority[targetIndex], newPriority[index]];
            setStatusPriority(newPriority);
            localStorage.setItem('dashboard_status_priority', JSON.stringify(newPriority));
        }
    };

    const handleUtilSortChange = (value) => {
        setUtilSort(value);
        localStorage.setItem('dashboard_util_sort', value);
    };

    if (groupsLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="machine-status-dashboard" ref={dashboardRef}>
                    {/* ======= PREMIUM COMPACT HEADER (Aligned with NewDeviceOee) ======= */}
                    <header className="dashboard-header-premium">
                        {/* ==== LEFT SIDE: Date + Shift + Live badge ==== */}
                        <div className="header-left-premium">
                            <div className="header-date-premium">
                                Date: <span>{dayjs().format("MMM D, YYYY")}</span>
                            </div>
                            {currentShift && (
                                <div className="header-shift-premium">
                                    Shift {currentShift.shift_no}: {dayjs(currentShift.from).format("h:mm A")} – {dayjs(currentShift.to).format("h:mm A")}
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: wsConnected ? '#4caf50' : '#f1a014', display: 'inline-block', boxShadow: wsConnected ? '0 0 6px #4caf50' : 'none' }} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: wsConnected ? '#4caf50' : '#f1a014' }}>
                                    {wsConnected ? 'Live' : 'Connecting…'}
                                </span>
                            </div>
                        </div>

                        {/* ==== CENTER: Title ==== */}
                        <div className="header-center-premium">
                            <Typography className="customer-title-premium">{customerTitle}</Typography>
                        </div>

                        {/* ==== RIGHT SIDE: Filters + Switch ==== */}
                        <div className="header-right-premium">
                            <FormControl variant="outlined" size="small" className="filter-select-premium">
                                <InputLabel>Group</InputLabel>
                                <Select
                                    multiple
                                    value={selectedGroups}
                                    onChange={handleGroupFilterChange}
                                    input={<OutlinedInput label="Group" />}
                                    renderValue={(selected) => selected.length === machineGroups.length ? "All Groups" : selected.join(", ")}
                                    MenuProps={{ container: dashboardRef.current }}
                                >
                                    <MenuItem value="all">
                                        <Checkbox checked={selectedGroups.length === machineGroups.length} />
                                        <ListItemText primary="All Groups" />
                                    </MenuItem>
                                    {machineGroups.map((g) => (
                                        <MenuItem key={g.name} value={g.name}>
                                            <Checkbox checked={selectedGroups.indexOf(g.name) > -1} />
                                            <ListItemText primary={g.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl variant="outlined" size="small" className="filter-select-premium">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    multiple
                                    value={selectedStatuses}
                                    onChange={handleStatusFilterChange}
                                    input={<OutlinedInput label="Status" />}
                                    renderValue={(selected) => selected.length === STATUS_OPTIONS.length ? "All Statuses" : selected.join(", ")}
                                    MenuProps={{ container: dashboardRef.current }}
                                >
                                    <MenuItem value="all">
                                        <Checkbox checked={selectedStatuses.length === STATUS_OPTIONS.length} />
                                        <ListItemText primary="All Statuses" />
                                    </MenuItem>
                                    {STATUS_OPTIONS.map((status) => (
                                        <MenuItem key={status} value={status}>
                                            <Checkbox checked={selectedStatuses.indexOf(status) > -1} />
                                            <ListItemText primary={status} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                                <IconButton
                                    onClick={toggleFullscreen}
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        background: "#fff",
                                        borderRadius: "10px",
                                        border: "1px solid rgba(0,0,0,0.1)",
                                        color: "#222",
                                        "&:hover": { borderColor: "#FFA500", background: "rgba(255, 165, 0, 0.05)", color: "#FFA500" }
                                    }}
                                >
                                    {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Layout Settings">
                                <IconButton
                                    onClick={() => setPriorityDialogOpen(true)}
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        background: "#fff",
                                        borderRadius: "10px",
                                        border: "1px solid rgba(0,0,0,0.1)",
                                        color: "#222",
                                        "&:hover": { borderColor: "#FFA500", background: "rgba(255, 165, 0, 0.05)", color: "#FFA500" }
                                    }}
                                >
                                    <SettingsIcon />
                                </IconButton>
                            </Tooltip>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={autoScroll}
                                        onChange={(e) => setAutoScroll(e.target.checked)}
                                        sx={{
                                            "& .MuiSwitch-track": { backgroundColor: "#ccc" },
                                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#FFA500" },
                                            "& .MuiSwitch-thumb": { backgroundColor: "#fff", border: "1px solid #888" }
                                        }}
                                    />
                                }
                                label="Auto Scroll"
                                labelPlacement="start"
                                slotProps={{
                                    typography: { sx: { fontSize: "13px", fontWeight: 600, color: "#111" } }
                                }}
                            />
                        </div>
                    </header>

                    <div className="dashboard-content" ref={contentRef}>
                        {/* Overall Status Summary */}
                        <Box sx={{ p: 2, pb: 0 }}>
                            <Paper elevation={0} className="status-summary-bar">
                                <Box className="summary-item">
                                    <Typography className="summary-label">Total</Typography>
                                    <Typography className="summary-value">{statusCounts.Total}</Typography>
                                </Box>
                                <Box className="summary-item running">
                                    <Typography className="summary-label">Running</Typography>
                                    <Typography className="summary-value">{statusCounts.Running}</Typography>
                                </Box>
                                <Box className="summary-item idle">
                                    <Typography className="summary-label">Idle</Typography>
                                    <Typography className="summary-value">{statusCounts.Idle}</Typography>
                                </Box>
                                <Box className="summary-item alarm">
                                    <Typography className="summary-label">Alarm</Typography>
                                    <Typography className="summary-value">{statusCounts.Alarm}</Typography>
                                </Box>
                                <Box className="summary-item disconnect">
                                    <Typography className="summary-label">Disconnected</Typography>
                                    <Typography className="summary-value">{statusCounts.Disconnected}</Typography>
                                </Box>
                            </Paper>
                        </Box>

                        <Grid container spacing={2} sx={{ p: 2 }}>
                            {currentDevices.length === 0 ? (
                                <Grid item xs={12}><Typography align="center" variant="h6" color="textSecondary">No machines match the selected filters.</Typography></Grid>
                            ) : (
                                currentDevices.map((device) => {
                                    const data = machineData[device.id?.id] || { status: 'Loading...', utilization: 0, ts: null };
                                    const styles = getStatusStyles(data.status);
                                    const isRunning = data.status === 'Running';
                                    const durationMs = (data.ts && !isRunning) ? (currentTime - data.ts) : 0;

                                    return (
                                        <Grid item xs={12} sm={6} md={3} lg={2} key={device.id?.id}>
                                            <Card
                                                className={`machine-card-minimal ${data.status === 'Alarm' ? 'alarm-blink-bg' : ''}`}
                                                sx={{
                                                    backgroundColor: styles.background,
                                                    color: styles.color,
                                                    boxShadow: `0 8px 32px ${styles.shadow}`
                                                }}
                                            >
                                                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: '16px !important' }}>
                                                    <Typography variant="h6" className="machine-name-minimal-centered">
                                                        {device.name}
                                                    </Typography>

                                                    <Box mt={1}>
                                                        <Typography variant="h2" className="center-value">
                                                            {isRunning ? `${data.utilization}%` : formatDuration(durationMs)}
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    );
                                })
                            )}
                        </Grid>
                    </div>

                    {/* Dashboard Layout Configuration Dialog */}
                    <Dialog 
                        open={priorityDialogOpen} 
                        onClose={() => setPriorityDialogOpen(false)} 
                        maxWidth="xs" 
                        fullWidth
                        container={dashboardRef.current}
                    >
                        <DialogTitle sx={{ fontWeight: 800 }}>Dashboard Layout Settings</DialogTitle>
                        <DialogContent dividers>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#FFA500' }}>
                                1. Status Priority (Sort Order)
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Move statuses up or down to set the primary grid order.
                            </Typography>
                            <List sx={{ mb: 3 }}>
                                {statusPriority.map((status, index) => (
                                    <ListItem
                                        key={status}
                                        sx={{
                                            mb: 1,
                                            borderRadius: '8px',
                                            bgcolor: 'rgba(0,0,0,0.03)',
                                            borderLeft: `5px solid ${getStatusStyles(status).background}`
                                        }}
                                        secondaryAction={
                                            <Box>
                                                <IconButton
                                                    size="small"
                                                    disabled={index === 0}
                                                    onClick={() => handleStatusPriorityChange(index, -1)}
                                                >
                                                    <ArrowUpIcon />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    disabled={index === statusPriority.length - 1}
                                                    onClick={() => handleStatusPriorityChange(index, 1)}
                                                >
                                                    <ArrowDownIcon />
                                                </IconButton>
                                            </Box>
                                        }
                                    >
                                        <ListItemText
                                            primary={status}
                                            primaryTypographyProps={{ fontWeight: 700 }}
                                        />
                                    </ListItem>
                                ))}
                            </List>

                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#FFA500' }}>
                                2. Running Utilization Sort
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Set how running machines should be ordered.
                            </Typography>
                            <FormControl fullWidth size="small">
                                <Select
                                    value={utilSort}
                                    onChange={(e) => handleUtilSortChange(e.target.value)}
                                    sx={{ fontWeight: 600 }}
                                    MenuProps={{ container: dashboardRef.current }}
                                >
                                    <MenuItem value="None">Default / Alphabetical</MenuItem>
                                    <MenuItem value="DESC">Higher Utilization First</MenuItem>
                                    <MenuItem value="ASC">Lower Utilization First</MenuItem>
                                </Select>
                            </FormControl>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setPriorityDialogOpen(false)} variant="contained" sx={{ bgcolor: '#FFA500', '&:hover': { bgcolor: '#e69500' }, fontWeight: 700 }}>
                                Save Layout
                            </Button>
                        </DialogActions>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default MachineStatusDashboard;
