import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Checkbox,
    ListItemText,
    CircularProgress,
    Grid,
    Card,
    Typography,
    Box,
    LinearProgress,
    Tooltip,
    IconButton,
    Stack
} from '@mui/material';
import {
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { Tabs, Tab, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import dayjs from 'dayjs';
import {
    customerbasedshift,
    telemetrykeydata,
} from '../../Services/app/companyservice';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';
import { createTbWebSocket } from '../../Services/app/tbWebSocketService';

// Color Palette based on machinemm.js
const COLORS = {
    RUNNING: '#4caf50',
    IDLE: '#f1a014',
    ALARM: '#f44336',
    DISCONNECTED: '#9e9e9e',
    SETTING: '#81c8f5ff',
    LOCKED: 'rgb(243, 44, 130)',
    BG: '#f8f9fa',
    HEADER_BG: '#ffffff',
    TEXT_MAIN: '#1d1d1f',
    TEXT_SUB: '#86868b',
    PRIMARY: '#f47803',
    GOLD: '#FFD700'
};


export default function OperatorPerformanceDashboard() {
    const customerId = localStorage.getItem('CustomerID');
    const {
        deviceNameID,
        machineGroups,
        availableMachines,
        selectedMachines, 
        selectedGroups,
        showMachineGroupsDropdown,
        handleGroupChange
    } = useMachineGroups(customerId);

    const STORAGE_KEY = 'operator_performance_dashboard';

    // --- Persistent Settings ---
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const defaults = { thresholds: { bad: 60, normal: 75 }, sortOrder: 'asc' };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });

    // Destructure for easy access
    const { thresholds, sortOrder } = settings;

    // Persist settings on every change
    const updateSettings = (patch) => {
        setSettings(prev => {
            const next = { ...prev, ...patch };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    // Status filter — 'All' or a specific status string
    const [statusFilter, setStatusFilter] = useState('All');

    const [isFullscreen, setIsFullscreen] = useState(false);
    const dashboardRef = useRef(null);

    const [viewMode, setViewMode] = useState('Current'); // 'Current' or 'Previous'
    const [shifts, setShifts] = useState([]);
    const [currentShiftInfo, setCurrentShiftInfo] = useState(null);
    const [prevShiftInfo, setPrevShiftInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState([]);
    const [prevShiftOee, setPrevShiftOee] = useState(0);
    const [currentShiftOee, setCurrentShiftOee] = useState(0);

    // Keep currentShiftOee in sync only when viewing Current shift
    useEffect(() => {
        if (viewMode !== 'Current') return;
        const valid = dashboardData.filter(m => m.currentOee > 0);
        const oee = valid.length > 0 ? Math.round(valid.reduce((a, m) => a + m.currentOee, 0) / valid.length) : 0;
        setCurrentShiftOee(oee);
    }, [dashboardData, viewMode]);

    const summaryMetrics = useMemo(() => ({
        currentShiftOee,
        prevShiftOee,
    }), [currentShiftOee, prevShiftOee]);
    const [tick, setTick] = useState(0);
    const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
    const [activeTab, setActiveTab] = useState('machines');
    const getAchievement = (actual, target) => {
        if (!target || target === 0) return 0;
        const percent = Math.round((actual / target) * 100);
        return Math.min(percent, 100); // Cap at 100%
    };

    const getPerformanceColor = (percent) => {
        if (percent < thresholds.bad) return COLORS.ALARM;
        if (percent < thresholds.normal) return COLORS.IDLE;
        return COLORS.RUNNING;
    };

    // Tick every second to drive live status timers (only in Current shift view)
    useEffect(() => {
        if (viewMode !== 'Current') return;
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [viewMode]);

    const formatElapsed = useCallback((tsMs) => {
        if (!tsMs) return null;
        const elapsed = Date.now() - tsMs;
        if (elapsed < 0) return null;
        const totalSecs = Math.floor(elapsed / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, [tick]);

    // --- Business Logic for Top Performers (Top 3) ---
    const topPerformers = useMemo(() => {
        if (dashboardData.length === 0) return [];
        return [...dashboardData]
            .filter(m => m.actual > 0 && m.target > 0)
            .map(m => {
                const achievement = getAchievement(m.actual, m.target);
                return { ...m, achievement };
            })
            .sort((a, b) => b.achievement - a.achievement || b.currentOee - a.currentOee)
            .slice(0, 3);
    }, [dashboardData]);

    // Sorting by Performance Ratio (Dynamic Order & Status Filter)
    const filteredAndSortedData = useMemo(() => {
        return [...dashboardData]
            .filter(m => statusFilter === 'All' || m.status === statusFilter)
            .sort((a, b) => {
                const perfA = getAchievement(a.actual, a.target);
                const perfB = getAchievement(b.actual, b.target);
                return sortOrder === 'asc' ? perfA - perfB : perfB - perfA;
            });
    }, [dashboardData, sortOrder, statusFilter]);

    // Aggregated header metrics
    const headerMetrics = useMemo(() => {
        const totalTarget = dashboardData.reduce((s, m) => s + (m.target || 0), 0);
        const totalProduced = dashboardData.reduce((s, m) => s + (m.actual || 0), 0);
        const achievement = totalTarget > 0 ? Math.round((totalProduced / totalTarget) * 100) : 0;

        // Projected: scale produced by net working fraction (shift duration minus breaks)
        let projected = null;
        let willMissTarget = false;
        if (currentShiftInfo && shifts.length > 0) {
            const { from, to, shiftObj } = (() => {
                const dateStr = dayjs(currentShiftInfo.date).format("YYYY-MM-DD");
                const s = shifts.find(s => String(s.shift_no) === String(currentShiftInfo.shiftNo));
                if (!s) return { from: null, to: null, shiftObj: null };
                const start = dayjs(`${dateStr}T${s.start_time}`).add((Number(s.start_day) || 1) - 1, 'day');
                const end = dayjs(`${dateStr}T${s.end_time}`).add((Number(s.end_day) || 1) - 1, 'day');
                return { from: start.valueOf(), to: end.valueOf(), shiftObj: s };
            })();
            if (from && to) {
                const now = Date.now();

                // Calculate break intervals as absolute timestamps
                const breaks = (shiftObj?.break_details || []).map(b => {
                    let bStart = dayjs(`${dayjs(currentShiftInfo.date).format("YYYY-MM-DD")}T${b.start_time}`)
                        .add((Number(shiftObj.start_day) || 1) - 1, 'day');
                    let bEnd = dayjs(`${dayjs(currentShiftInfo.date).format("YYYY-MM-DD")}T${b.end_time}`)
                        .add((Number(shiftObj.start_day) || 1) - 1, 'day');
                    // If break falls before shift start (overnight shift), push to next day
                    if (bStart.valueOf() < from) { bStart = bStart.add(1, 'day'); bEnd = bEnd.add(1, 'day'); }
                    return { start: bStart.valueOf(), end: bEnd.valueOf() };
                });

                // Net shift duration = total clock time minus all break durations
                const totalBreakMs = breaks.reduce((sum, b) => sum + (b.end - b.start), 0);
                const netDuration = (to - from) - totalBreakMs;

                // Net elapsed = clock elapsed minus break time already spent
                const clockElapsed = Math.max(0, now - from);
                const elapsedBreakMs = breaks.reduce((sum, b) => {
                    if (now <= b.start) return sum;                        // break hasn't started
                    if (now >= b.end) return sum + (b.end - b.start);     // break fully passed
                    return sum + (now - b.start);                          // currently in break
                }, 0);
                const netElapsed = clockElapsed - elapsedBreakMs;

                const fraction = netDuration > 0 ? Math.min(netElapsed / netDuration, 1) : 0;
                if (fraction > 0.01 && totalProduced > 0) {
                    projected = Math.round(totalProduced / fraction);
                    willMissTarget = totalTarget > 0 && projected < totalTarget;
                }
            }
        }
        return { totalTarget, totalProduced, achievement, projected, willMissTarget };
    }, [dashboardData, currentShiftInfo, shifts]);


    // Status distribution bar
    const statusDistribution = useMemo(() => {
        const total = dashboardData.length;
        if (!total) return [];
        const counts = dashboardData.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {});
        return [
            { label: 'Running', count: counts['Running'] || 0, color: COLORS.RUNNING },
            { label: 'Idle',    count: counts['Idle'] || 0,    color: COLORS.IDLE },
            { label: 'Alarm',   count: counts['Alarm'] || 0,   color: COLORS.ALARM },
            { label: 'Disconnected', count: counts['Disconnected'] || 0, color: COLORS.DISCONNECTED },
        ].filter(s => s.count > 0).map(s => ({ ...s, pct: Math.round((s.count / total) * 100) }));
    }, [dashboardData]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            dashboardRef.current.requestFullscreen()?.catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFS = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFS);
        return () => document.removeEventListener('fullscreenchange', handleFS);
    }, []);

    // --- Shift and Data Logic ---
    const getShiftTimes = useCallback((shiftList, shiftNo, date) => {
        if (!Array.isArray(shiftList) || !date) return { from: null, to: null };
        const dateStr = dayjs(date).format("YYYY-MM-DD");
        const s = shiftList.find((s) => String(s.shift_no) === String(shiftNo));
        if (!s) return { from: null, to: null };
        const start = dayjs(`${dateStr}T${s.start_time}`).add((Number(s.start_day)||1)-1, 'day');
        const end = dayjs(`${dateStr}T${s.end_time}`).add((Number(s.end_day)||1)-1, 'day');
        return { from: start.valueOf(), to: end.valueOf() };
    }, []);

    const detectShifts = useCallback((shiftList) => {
        if (!shiftList.length) return;
        const now = dayjs();
        const mins = now.hour() * 60 + now.minute();
        const sorted = [...shiftList].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
        const first = sorted[0];
        const [h, m] = (first.start_time || "0:0").split(":").map(Number);
        
        let newCurrent, newPrev;

        if (mins < (h * 60 + m)) {
            newCurrent = { shiftNo: sorted[sorted.length-1].shift_no, date: dayjs().subtract(1, 'day') };
            newPrev = { shiftNo: sorted.length>1 ? sorted[sorted.length-2].shift_no : sorted[0].shift_no, date: dayjs().subtract(1, 'day') };
        } else {
            let idx = -1;
            for (let i = 0; i < sorted.length; i++) {
                const s = sorted[i];
                const [fH, fM] = s.start_time.split(":").map(Number);
                const [tH, tM] = s.end_time.split(":").map(Number);
                const fMins = fH * 60 + fM;
                const tMins = tH * 60 + tM;
                if ((fMins <= mins && mins < tMins) || (fMins > tMins && (mins >= fMins || mins < tMins))) {
                    newCurrent = { shiftNo: s.shift_no, date: dayjs() };
                    idx = i; break;
                }
            }
            if (idx !== -1) {
                if (idx === 0) newPrev = { shiftNo: sorted[sorted.length-1].shift_no, date: dayjs().subtract(1, 'day') };
                else newPrev = { shiftNo: sorted[idx-1].shift_no, date: dayjs() };
            } else {
                newCurrent = { shiftNo: sorted[sorted.length-1].shift_no, date: dayjs() };
                newPrev = { shiftNo: sorted[sorted.length-2].shift_no || sorted[0].shift_no, date: dayjs() };
            }
        }

        // Only update state if shift info actually changed to prevent redundant re-renders
        setCurrentShiftInfo(prev => {
            if (!prev || prev.shiftNo !== newCurrent.shiftNo || !prev.date.isSame(newCurrent.date, 'day')) return newCurrent;
            return prev;
        });
        setPrevShiftInfo(prev => {
            if (!prev || prev.shiftNo !== newPrev.shiftNo || !prev.date.isSame(newPrev.date, 'day')) return newPrev;
            return prev;
        });
    }, []);

    // --- API Data Fetching ---
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);

    // WS is kept only to drive the ● Live / Connecting… indicator.
    // All telemetry data is fetched by the 30s poll (handles same-timestamp rewrites that WS skips).
    const handleWsMessage = useCallback(() => {}, []);

    // --- Start WebSocket subscription for Current Shift ---
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

    // fetchData is only used for Previous shift — Current shift is fully driven by WS LATEST_TELEMETRY.
    const fetchData = useCallback(async () => {
        if (!shifts.length || !prevShiftInfo || !customerId || !selectedMachines.length) return;

        setIsLoading(true);
        try {
            const ids = deviceNameID.filter(d => selectedMachines.includes(d.name)).map(d => d.id);

            const parseOperator = (rawOps) => {
                if (!rawOps || rawOps.length === 0) return 'No Operator Assigned';
                const parsedOps = rawOps.map(r => {
                    try { return { ...JSON.parse(r.value), ts: r.ts }; } catch(e) { return null; }
                }).filter(Boolean).sort((a, b) => b.ts - a.ts);
                if (parsedOps.length === 0) return 'No Operator Assigned';
                const latest = parsedOps[0];
                const pName = latest.name || latest.operator || 'Unknown';
                const pCode = latest.code || '';
                return pCode ? `${pName} (${pCode})` : pName;
            };

            const prevT = getShiftTimes(shifts, prevShiftInfo.shiftNo, prevShiftInfo.date);
            if (!prevT?.from) return;

            const allKeys = "oee,totalparts,targetparts,machine_status,live_operator";
            const results = await Promise.all(ids.map(async (devId) => {
                const data = await telemetrykeydata(devId, "DEVICE", allKeys, prevT.from, prevT.to);
                const getLatest = (arr) => (arr && arr.length > 0) ? arr[0] : null;

                const statusMap = { 0:'Idle', 1:'Idle', 2:'Idle', 3:'Running', 4:'Alarm', 5:'Alarm', 6:'Locked', 7:'Setting', 100:'Disconnected' };
                const rawS = getLatest(data?.machine_status)?.value;
                const status = statusMap[parseInt(rawS)] || statusMap[rawS] || 'Disconnected';
                const statusTs = getLatest(data?.machine_status)?.ts || null;

                let parts = { goodparts: 0 };
                try { if (getLatest(data?.totalparts)?.value) parts = JSON.parse(getLatest(data.totalparts).value); } catch(e) {}

                return {
                    id: devId,
                    name: deviceNameID.find(d => d.id === devId)?.name || 'Unknown',
                    operator: parseOperator(data?.live_operator),
                    status,
                    statusTs,
                    currentOee: Math.round(parseFloat(getLatest(data?.oee)?.value) || 0),
                    prevOee: 0,
                    target: Math.round(parseFloat(getLatest(data?.targetparts)?.value) || 0),
                    actual: parts.goodparts || 0,
                };
            }));
            setDashboardData(results);
            setLastUpdatedTime(dayjs().format('DD MMM HH:mm:ss'));
        } catch (error) { console.error("Fetch Data Error:", error); } finally { setIsLoading(false); }
    }, [shifts, prevShiftInfo, customerId, selectedMachines, deviceNameID, getShiftTimes]);

    useEffect(() => {
        const fetchShiftList = async () => {
            const res = await customerbasedshift(customerId, 'allShift');
            const list = res[0]?.value || [];
            if (list.length > 0) { setShifts(list); detectShifts(list); }
        };
        if (customerId) fetchShiftList();
    }, [customerId, detectShifts]);

    // Periodic shift detection — runs every 60s to auto-advance when shift boundary is crossed.
    // When currentShiftInfo changes the main useEffect will disconnect the WS, re-fetch and reconnect.
    useEffect(() => {
        if (!shifts.length) return;
        const interval = setInterval(() => detectShifts(shifts), 60000);
        return () => clearInterval(interval);
    }, [shifts, detectShifts]);

    // Fetch previous shift OEE once for header comparison (runs when prevShiftInfo or machines change)
    useEffect(() => {
        if (!shifts.length || !prevShiftInfo || !selectedMachines.length || !deviceNameID.length) return;
        const prevT = getShiftTimes(shifts, prevShiftInfo.shiftNo, prevShiftInfo.date);
        if (!prevT?.from) return;
        const ids = deviceNameID.filter(d => selectedMachines.includes(d.name)).map(d => d.id);
        Promise.all(ids.map(devId =>
            telemetrykeydata(devId, "DEVICE", "oee", prevT.from, prevT.to)
                .then(data => (data?.oee?.[0]?.value ? Math.round(parseFloat(data.oee[0].value)) : 0))
                .catch(() => 0)
        )).then(values => {
            const valid = values.filter(v => v > 0);
            setPrevShiftOee(valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0);
        });
    }, [shifts, prevShiftInfo, selectedMachines, deviceNameID]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!shifts.length || !selectedMachines.length || !currentShiftInfo) return;

        if (viewMode === 'Current') {
            const ids = deviceNameID.filter(d => selectedMachines.includes(d.name)).map(d => d.id);

            // Seed rows so WS handler can find devices by id on first burst.
            // All values (including live_operator) come from WS LATEST_TELEMETRY — no REST needed.
            setDashboardData(ids.map(devId => ({
                id: devId,
                name: deviceNameID.find(d => d.id === devId)?.name || 'Unknown',
                operator: 'No Operator Assigned',
                status: 'Disconnected',
                statusTs: null,
                currentOee: 0,
                prevOee: 0, target: 0, actual: 0,
            })));

            // Defer WS start to next tick so React flushes the seed before the
            // first LATEST_TELEMETRY burst arrives — prevents idx === -1 dropping all updates.
            setTimeout(() => startWs(ids), 0);
        } else {
            // Previous Shift: close WS, fetch everything from REST
            if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; setWsConnected(false); }
            fetchData();
        }

        return () => {
            if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; setWsConnected(false); }
        };
    }, [shifts, selectedMachines, currentShiftInfo, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Poll latest telemetry every 30s for Current shift.
    // WS is unreliable for same-timestamp rewrites; polling gives consistent state for all keys.
    useEffect(() => {
        if (viewMode !== 'Current' || !selectedMachines.length || !deviceNameID.length || !currentShiftInfo || !shifts.length) return;

        const POLL_KEYS = 'machine_status,oee,targetparts,totalparts,live_operator';

        const poll = async () => {
            const ids = deviceNameID.filter(d => selectedMachines.includes(d.name)).map(d => d.id);
            const currentT = getShiftTimes(shifts, currentShiftInfo.shiftNo, currentShiftInfo.date);
            if (!currentT?.from) return;
            const results = await Promise.all(ids.map(async (devId) => {
                try {
                    return { devId, data: await telemetrykeydata(devId, 'DEVICE', POLL_KEYS, currentT.from, currentT.to) };
                } catch(e) { return null; }
            }));

            setDashboardData(prev => {
                let changed = false;
                const next = prev.map(d => {
                    const r = results.find(r => r?.devId === d.id);
                    if (!r) return d;
                    const data = r.data;
                    const getV = (key) => data?.[key]?.[0]?.value ?? null;

                    const updated = { ...d };

                    const statusV = getV('machine_status');
                    if (statusV !== null) {
                        const statusMap = { 0:'Idle',1:'Idle',2:'Idle',3:'Running',4:'Alarm',5:'Alarm',6:'Locked',7:'Setting',100:'Disconnected' };
                        const mapped = statusMap[parseInt(statusV)] || 'Disconnected';
                        if (mapped !== updated.status) {
                            updated.status = mapped;
                            updated.statusTs = data?.machine_status?.[0]?.ts || null;
                        }
                    }

                    const oeeV = getV('oee');
                    if (oeeV !== null) updated.currentOee = Math.round(parseFloat(oeeV) || 0);

                    const targetV = getV('targetparts');
                    if (targetV !== null) updated.target = Math.round(parseFloat(targetV) || 0);

                    const totalV = getV('totalparts');
                    if (totalV !== null) {
                        try { updated.actual = JSON.parse(totalV).goodparts || 0; } catch(e) {
                            const n = parseFloat(totalV);
                            if (!isNaN(n)) updated.actual = Math.round(n);
                        }
                    }

                    const opV = getV('live_operator');
                    if (opV !== null) {
                        try {
                            const op = JSON.parse(opV);
                            const n = op.name || op.operator || 'Unknown';
                            const c = op.code || '';
                            updated.operator = c ? `${n} (${c})` : n;
                        } catch(e) {}
                    }

                    changed = true;
                    return updated;
                });
                return changed ? next : prev;
            });

            setLastUpdatedTime(dayjs().format('DD MMM HH:mm:ss'));
        };

        poll(); // run immediately on mount
        const interval = setInterval(poll, 30000);
        return () => clearInterval(interval);
    }, [viewMode, selectedMachines, deviceNameID, currentShiftInfo, shifts, getShiftTimes]); // eslint-disable-line react-hooks/exhaustive-deps

    // Common Card Component
    const RenderMachineCard = useCallback(({ m, rank }) => {
        const achievement = getAchievement(m.actual, m.target);
        const perfColor = getPerformanceColor(achievement);
        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
        const statusColor = COLORS[m.status.toUpperCase()] || COLORS.DISCONNECTED;
        const rawGap = m.target - m.actual;
        const isOnTarget = rawGap === 0;
        const isAhead = rawGap < 0;
        const gapLabel = isOnTarget ? '=' : isAhead ? `+${Math.abs(rawGap)}` : `-${rawGap}`;
        const gapColor = isAhead ? COLORS.RUNNING : isOnTarget ? COLORS.TEXT_SUB : COLORS.ALARM;
        const gapTitle = isOnTarget ? 'On Target' : isAhead ? 'Ahead' : 'Gap';
        const elapsedLabel = viewMode === 'Current' && m.statusTs ? formatElapsed(m.statusTs) : null;

        const oeeColor = getPerformanceColor(m.currentOee);
        return (
            <Card sx={{
                borderRadius: '10px', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', height: '100%',
                backgroundColor: '#fff',
                border: `2px solid ${perfColor}`,
                boxShadow: rank === 1 ? `0 0 18px ${COLORS.GOLD}44` : '0 1px 6px rgba(0,0,0,0.08)',
            }}>
                {/* Top accent bar */}
                <Box sx={{ height: 4, backgroundColor: perfColor, flexShrink: 0 }} />

                <Box sx={{ p: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* Row 1: Machine name + Status */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden', flex: 1, mr: 1 }}>
                            {rank && <Typography sx={{ fontSize: '1rem', flexShrink: 0 }}>{medals[rank]}</Typography>}
                            <Tooltip title={m.name} arrow placement="top" disableHoverListener={m.name.length <= 20}>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: COLORS.TEXT_MAIN, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</Typography>
                            </Tooltip>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            {elapsedLabel && m.status !== 'Running' && (
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor, fontVariantNumeric: 'tabular-nums' }}>{elapsedLabel}</Typography>
                            )}
                            <Box sx={{ backgroundColor: statusColor, color: '#fff', px: 1, py: 0.3, borderRadius: '5px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{m.status}</Box>
                        </Box>
                    </Box>

                    {/* Row 2: Operator name */}
                    <Tooltip title={m.operator} arrow placement="top" disableHoverListener={m.operator.length <= 34}>
                        <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 1, cursor: 'default', pb: 0.7, borderBottom: '1px dashed #e0e0e0' }}>{m.operator}</Typography>
                    </Tooltip>

                    {/* Row 3: Achievement % + progress bar */}
                    <Typography sx={{ fontWeight: 900, fontSize: '2rem', lineHeight: 1, color: perfColor, mb: 0.5 }}>{achievement}%</Typography>
                    <LinearProgress
                        variant="determinate"
                        value={Math.min(achievement, 100)}
                        sx={{ height: 8, borderRadius: 4, backgroundColor: `${perfColor}22`, mb: 1.2, '& .MuiLinearProgress-bar': { backgroundColor: perfColor, borderRadius: 4 } }}
                    />

                    {/* Row 4: Target | Actual | Gap | OEE */}
                    <Box sx={{ display: 'flex', mt: 'auto', border: '1px solid #ebebeb', borderRadius: '8px', overflow: 'hidden' }}>
                        {[
                            { label: 'Target', value: m.target,           color: COLORS.TEXT_MAIN },
                            { label: 'Actual', value: m.actual,           color: COLORS.TEXT_MAIN },
                            { label: gapTitle, value: gapLabel,           color: gapColor },
                            { label: 'OEE',    value: `${m.currentOee}%`, color: oeeColor, bg: `${oeeColor}12` },
                        ].map((stat, i) => (
                            <Box key={stat.label} sx={{ flex: 1, textAlign: 'center', py: 0.7, backgroundColor: stat.bg || 'transparent', borderRight: i < 3 ? '1px solid #ebebeb' : 'none' }}>
                                <Typography sx={{ fontSize: '0.65rem', color: i === 2 ? gapColor : i === 3 ? oeeColor : COLORS.TEXT_SUB, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.3 }}>{stat.label}</Typography>
                                <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: stat.color, lineHeight: 1.2 }}>{stat.value}</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Card>
        );
    }, [getPerformanceColor, viewMode, tick, formatElapsed]);

    return (
        <Box ref={dashboardRef} sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', backgroundColor: COLORS.BG, overflow: 'hidden'}}>
            <Box sx={{
                padding: '8px 20px',
                borderBottom: '1px solid #e0e0e0',
                backgroundColor: COLORS.HEADER_BG,
                marginTop: isFullscreen ? '0px' : '35px',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            }}>
                {/* --- LEFT: Live status / shift info --- */}
                <Box sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0, minWidth: 200 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: wsConnected ? COLORS.RUNNING : COLORS.TEXT_SUB, fontWeight: 700, lineHeight: 1.3 }}>
                        {viewMode === 'Current'
                            ? (wsConnected ? '● Live' : '⏱ Connecting…')
                            : '📋 Previous Shift'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: COLORS.TEXT_SUB, fontWeight: 600 }}>
                        {viewMode === 'Current'
                            ? `Shift ${currentShiftInfo?.shiftNo ?? ''} · Updated ${lastUpdatedTime || '–'}`
                            : `Shift ${prevShiftInfo?.shiftNo ?? ''}${lastUpdatedTime ? ` · ${lastUpdatedTime}` : ''}`}
                    </Typography>
                </Box>

                {/* --- CENTER: Title --- */}
                <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: COLORS.TEXT_MAIN, letterSpacing: '-0.3px' }}>
                        Operator Performance
                    </Typography>
                </Box>

                {/* --- RIGHT: Controls --- */}
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0, minWidth: 200, justifyContent: 'flex-end' }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel sx={{ fontSize: '0.8rem', fontWeight: 600 }}>View Shift</InputLabel>
                        <Select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value)}
                            label="View Shift"
                            sx={{ height: 38, fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#fff' }}
                            MenuProps={{ container: dashboardRef.current }}
                        >
                            <MenuItem value="Current">Current Shift</MenuItem>
                            <MenuItem value="Previous">Previous Shift</MenuItem>
                        </Select>
                    </FormControl>

                    {showMachineGroupsDropdown && (
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Machine Group</InputLabel>
                            <Select
                                multiple
                                value={selectedGroups}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                label="Machine Group"
                                sx={{ height: 38, fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#fff' }}
                                renderValue={(sel) => sel.length === machineGroups.length ? "All Groups" : sel.join(", ")}
                                MenuProps={{ container: dashboardRef.current }}
                            >
                                <MenuItem value="all"><Checkbox checked={selectedGroups.length === machineGroups.length} size="small" /><ListItemText primary="All" /></MenuItem>
                                {machineGroups.map((g) => (<MenuItem key={g.name} value={g.name}><Checkbox checked={selectedGroups.includes(g.name)} size="small" /><ListItemText primary={g.name} /></MenuItem>))}
                            </Select>
                        </FormControl>
                    )}

                    <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        <IconButton onClick={toggleFullscreen} size="small" sx={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#fff' }}>
                            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>

                    {isLoading && <CircularProgress size={20} sx={{ color: COLORS.PRIMARY }} />}
                </Box>
            </Box>

            {/* --- Row 2: Metrics Badges (moved from header) --- */}
            <Box sx={{ px: 2, py: 0.8, backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'stretch', gap: 1, flexWrap: 'wrap' }}>
                {/* OEE Current */}
                {(() => {
                    const val = summaryMetrics.currentShiftOee;
                    const color = getPerformanceColor(val);
                    const r = 26, sw = 5, cx = 32, cy = 32, norm = 2 * Math.PI * r;
                    const dash = (val / 100) * norm;
                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', px: 1.5, py: 0.6 }}>
                            <svg width={64} height={64} style={{ flexShrink: 0 }}>
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8e8e8" strokeWidth={sw} />
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
                                    strokeDasharray={`${dash} ${norm}`} strokeLinecap="round"
                                    transform={`rotate(-90 ${cx} ${cy})`} />
                                <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={color}>{val}%</text>
                            </svg>
                            <Typography sx={{ fontSize: '0.8rem', color: COLORS.TEXT_SUB, fontWeight: 700 }}>OEE – Current Shift</Typography>
                        </Box>
                    );
                })()}

                {/* OEE Previous Shift */}
                {summaryMetrics.prevShiftOee > 0 && (() => {
                    const val = summaryMetrics.prevShiftOee;
                    const color = getPerformanceColor(val);
                    const r = 26, sw = 5, cx = 32, cy = 32, norm = 2 * Math.PI * r;
                    const dash = (val / 100) * norm;
                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', px: 1.5, py: 0.6 }}>
                            <svg width={64} height={64} style={{ flexShrink: 0 }}>
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8e8e8" strokeWidth={sw} />
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
                                    strokeDasharray={`${dash} ${norm}`} strokeLinecap="round"
                                    transform={`rotate(-90 ${cx} ${cy})`} />
                                <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={color}>{val}%</text>
                            </svg>
                            <Typography sx={{ fontSize: '0.8rem', color: COLORS.TEXT_SUB, fontWeight: 700 }}>OEE – Prev Shift</Typography>
                        </Box>
                    );
                })()}

                {/* vs Prev Shift diff */}
                {summaryMetrics.prevShiftOee > 0 && summaryMetrics.currentShiftOee !== summaryMetrics.prevShiftOee && (
                    <Box sx={{ display: 'flex', alignItems: 'center', backgroundColor: summaryMetrics.currentShiftOee > summaryMetrics.prevShiftOee ? '#e8f5e9' : '#fdecea', border: `1px solid ${summaryMetrics.currentShiftOee > summaryMetrics.prevShiftOee ? '#66bb6a' : COLORS.ALARM}`, borderRadius: '10px', px: 1.5, py: 0.5 }}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: summaryMetrics.currentShiftOee > summaryMetrics.prevShiftOee ? '#2e7d32' : COLORS.ALARM, display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                {summaryMetrics.currentShiftOee > summaryMetrics.prevShiftOee ? '▲' : '▼'}
                                {Math.abs(summaryMetrics.currentShiftOee - summaryMetrics.prevShiftOee)}%
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: COLORS.TEXT_SUB, fontWeight: 700 }}>vs Prev Shift</Typography>
                        </Box>
                    </Box>
                )}

                <Box sx={{ width: '1px', backgroundColor: '#e0e0e0', mx: 0.5, alignSelf: 'stretch' }} />

                {/* Shift Target */}
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', px: 1.5, py: 0.5, minWidth: 80 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: COLORS.TEXT_SUB, fontWeight: 700 }}>Shift Target</Typography>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: COLORS.TEXT_MAIN }}>{headerMetrics.totalTarget.toLocaleString()}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: COLORS.TEXT_SUB, fontWeight: 600 }}>pcs</Typography>
                </Box>

                {/* Produced */}
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', px: 1.5, py: 0.5, minWidth: 80 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: COLORS.TEXT_SUB, fontWeight: 700 }}>Produced</Typography>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: COLORS.TEXT_MAIN }}>{headerMetrics.totalProduced.toLocaleString()}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: COLORS.TEXT_SUB, fontWeight: 600 }}>pcs</Typography>
                </Box>

                {/* Achievement */}
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', px: 1.5, py: 0.5, minWidth: 80 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: COLORS.TEXT_SUB, fontWeight: 700 }}>Achievement</Typography>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: getPerformanceColor(headerMetrics.achievement) }}>{headerMetrics.achievement}%</Typography>
                </Box>

                {/* Projected */}
                {headerMetrics.projected !== null && viewMode === 'Current' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: headerMetrics.willMissTarget ? '#fff8e1' : '#f8f9fa', border: `1px solid ${headerMetrics.willMissTarget ? '#f1a014' : '#e0e0e0'}`, borderRadius: '10px', px: 1.5, py: 0.5, minWidth: 80 }}>
                        <Typography sx={{ fontSize: '0.72rem', color: COLORS.TEXT_SUB, fontWeight: 700 }}>Projected</Typography>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: headerMetrics.willMissTarget ? COLORS.IDLE : COLORS.RUNNING }}>{headerMetrics.projected.toLocaleString()}</Typography>
                        {headerMetrics.willMissTarget && <Typography sx={{ fontSize: '0.72rem', color: COLORS.IDLE, fontWeight: 800 }}>⚠ Will Miss Target</Typography>}
                    </Box>
                )}

                {/* Spacer */}
                <Box sx={{ flex: 1 }} />

                {/* Sort + Threshold Controls (moved here from fleet row) */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, flexWrap: 'wrap' }}>
                    {/* Sort */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: COLORS.TEXT_SUB }}>Sort by Achievement</Typography>
                        <Box sx={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                            {[{ val: 'asc', label: '↑ Low→High' }, { val: 'desc', label: '↓ High→Low' }].map(opt => (
                                <Box key={opt.val} onClick={() => updateSettings({ sortOrder: opt.val })}
                                    sx={{ px: 1.2, py: 0.5, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', backgroundColor: sortOrder === opt.val ? COLORS.PRIMARY : '#fafafa', color: sortOrder === opt.val ? '#fff' : COLORS.TEXT_SUB, transition: 'all 0.15s', '&:hover': { backgroundColor: sortOrder === opt.val ? COLORS.PRIMARY : '#f0f0f0' } }}
                                >{opt.label}</Box>
                            ))}
                        </Box>
                    </Box>

                    {/* Thresholds */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: COLORS.TEXT_SUB }}>Thresholds (%)</Typography>
                        <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, backgroundColor: '#fdecea', border: '1px solid #f4433633', borderRadius: '6px', px: 1, py: 0.4 }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: COLORS.ALARM, flexShrink: 0 }} />
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: COLORS.ALARM, whiteSpace: 'nowrap' }}>Red &lt;</Typography>
                                <input type="number" value={thresholds.bad}
                                    onChange={(e) => updateSettings({ thresholds: { ...thresholds, bad: Number(e.target.value) } })}
                                    style={{ width: 38, border: 'none', background: 'transparent', fontSize: '0.78rem', fontWeight: 800, color: COLORS.ALARM, outline: 'none', textAlign: 'center' }} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, backgroundColor: '#fff8e1', border: '1px solid #f1a01433', borderRadius: '6px', px: 1, py: 0.4 }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: COLORS.IDLE, flexShrink: 0 }} />
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: COLORS.IDLE, whiteSpace: 'nowrap' }}>Yellow &lt;</Typography>
                                <input type="number" value={thresholds.normal}
                                    onChange={(e) => updateSettings({ thresholds: { ...thresholds, normal: Number(e.target.value) } })}
                                    style={{ width: 38, border: 'none', background: 'transparent', fontSize: '0.78rem', fontWeight: 800, color: COLORS.IDLE, outline: 'none', textAlign: 'center' }} />
                            </Box>
                            {/* Threshold legend */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pl: 0.5, borderLeft: '1px solid #e0e0e0', ml: 0.3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: COLORS.ALARM }} />
                                    <Typography sx={{ fontSize: '0.67rem', color: COLORS.TEXT_SUB, fontWeight: 600 }}>Bad &lt; {thresholds.bad}%</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: COLORS.IDLE }} />
                                    <Typography sx={{ fontSize: '0.67rem', color: COLORS.TEXT_SUB, fontWeight: 600 }}>{thresholds.bad}–{thresholds.normal}% Normal</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: COLORS.RUNNING }} />
                                    <Typography sx={{ fontSize: '0.67rem', color: COLORS.TEXT_SUB, fontWeight: 600 }}>≥ {thresholds.normal}% Good</Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* --- Row 3: Fleet Status Cards + Machines/Line Tabs (combined) --- */}
            {(() => {
                const counts = dashboardData.length > 0
                    ? dashboardData.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {})
                    : {};
                const cards = [
                    { key: 'All',          label: 'Total',      count: dashboardData.length,         color: '#1565c0', bg: '#e3f2fd', icon: '🖥' },
                    { key: 'Running',      label: 'Running',    count: counts['Running'] || 0,        color: '#2e7d32', bg: '#e8f5e9', icon: '📈' },
                    { key: 'Idle',         label: 'Idle',       count: counts['Idle'] || 0,           color: '#bf360c', bg: '#fff3e0', icon: '⚙' },
                    { key: 'Alarm',        label: 'Alarm',      count: counts['Alarm'] || 0,          color: '#b71c1c', bg: '#fdecea', icon: '⚠' },
                    { key: 'Disconnected', label: 'Disconnect', count: counts['Disconnected'] || 0,   color: '#424242', bg: '#f5f5f5', icon: '🚫' },
                ];
                return (
                    <Box sx={{ px: 2, backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Tabs — LEFT */}
                        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, fontSize: '0.8rem', fontWeight: 700, textTransform: 'none', py: 0 }, '& .MuiTabs-indicator': { backgroundColor: COLORS.PRIMARY } }}>
                            <Tab value="machines" label="Machines" />
                            <Tab value="line" label="Line View" />
                        </Tabs>

                        {/* Divider */}
                        <Box sx={{ width: '1px', height: 36, backgroundColor: '#e0e0e0', mx: 0.5, flexShrink: 0 }} />

                        {/* Fleet status clickable chips — RIGHT */}
                        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', py: 0.5 }}>
                            {cards.map(c => {
                                const isActive = statusFilter === c.key;
                                return (
                                    <Box key={c.key}
                                        onClick={() => setStatusFilter(isActive && c.key !== 'All' ? 'All' : c.key)}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 0.8,
                                            backgroundColor: isActive ? c.color : '#fafafa',
                                            border: `2px solid ${isActive ? c.color : '#e0e0e0'}`,
                                            borderRadius: '10px', px: 1.2, py: 0.5,
                                            cursor: 'pointer',
                                            transition: 'all 0.18s ease',
                                            boxShadow: isActive ? `0 3px 10px ${c.color}44` : 'none',
                                            '&:hover': { border: `2px solid ${c.color}`, backgroundColor: isActive ? c.color : c.bg, transform: 'translateY(-1px)' },
                                        }}
                                    >
                                        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1 }}>{c.icon}</Typography>
                                        <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: isActive ? '#fff' : c.color, lineHeight: 1 }}>{c.count}</Typography>
                                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: isActive ? 'rgba(255,255,255,0.85)' : c.color }}>{c.label}</Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                );
            })()}

            {/* --- Main Content --- */}
            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Machine Grid or Line View */}
                <Box sx={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                    {activeTab === 'machines' && (
                        <Grid container spacing={1.5}>
                            {filteredAndSortedData.map((m) => (
                                <Grid item xs={12} sm={6} md={4} lg={4} xl={3} key={m.id}>
                                    <RenderMachineCard m={m} rank={null} />
                                </Grid>
                            ))}
                        </Grid>
                    )}
                    {activeTab === 'line' && (
                        <Box sx={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ '& th': { backgroundColor: '#f8f9fa', fontWeight: 800, fontSize: '0.88rem', color: COLORS.TEXT_SUB, borderBottom: '2px solid #e0e0e0', py: 1.2 } }}>
                                        <TableCell>Machine</TableCell>
                                        <TableCell>Operator</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="center">Target</TableCell>
                                        <TableCell align="center">Actual</TableCell>
                                        <TableCell align="center">Gap / Ahead</TableCell>
                                        <TableCell align="center">Achievement</TableCell>
                                        <TableCell align="center">OEE</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredAndSortedData.map((m) => {
                                        const ach = getAchievement(m.actual, m.target);
                                        const rawGapLv = m.target - m.actual;
                                        const isAheadLv = rawGapLv <= 0;
                                        const gapLabelLv = isAheadLv ? `+${Math.abs(rawGapLv)}` : `-${rawGapLv}`;
                                        const gapColorLv = isAheadLv ? COLORS.RUNNING : COLORS.ALARM;
                                        const statusColor = COLORS[m.status.toUpperCase()] || COLORS.DISCONNECTED;
                                        const elapsed = viewMode === 'Current' && m.statusTs ? formatElapsed(m.statusTs) : null;
                                        return (
                                            <TableRow key={m.id} sx={{ '&:hover': { backgroundColor: '#fafafa' }, '& td': { fontSize: '0.9rem', borderBottom: '1px solid #f0f0f0', py: 1.2 } }}>
                                                <TableCell><Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: COLORS.TEXT_MAIN }}>{m.name}</Typography></TableCell>
                                                <TableCell>
                                                    <Tooltip title={m.operator} arrow placement="top">
                                                        <Typography sx={{ fontSize: '0.88rem', color: COLORS.TEXT_SUB, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}>{m.operator}</Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                                        <Box sx={{ backgroundColor: statusColor, color: '#fff', px: 1, py: 0.3, borderRadius: '5px', fontSize: '0.75rem', fontWeight: 800 }}>{m.status}</Box>
                                                        {elapsed && m.status !== 'Running' && (
                                                            <Tooltip title={`${m.status} for ${elapsed}`} arrow>
                                                                <Typography sx={{ fontSize: '0.78rem', color: statusColor, fontWeight: 700, cursor: 'default', fontVariantNumeric: 'tabular-nums' }}>{elapsed}</Typography>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="center"><Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.target}</Typography></TableCell>
                                                <TableCell align="center"><Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.actual}</Typography></TableCell>
                                                <TableCell align="center">
                                                    <Typography sx={{ fontWeight: 800, color: gapColorLv, fontSize: '0.9rem' }}>{isAheadLv ? 'Ahead ' : 'Gap '}{gapLabelLv}</Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                                        <LinearProgress variant="determinate" value={Math.min(ach, 100)} sx={{ width: 64, height: 7, borderRadius: 3, backgroundColor: '#f0f0f0', '& .MuiLinearProgress-bar': { backgroundColor: getPerformanceColor(ach) } }} />
                                                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: getPerformanceColor(ach) }}>{ach}%</Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="center"><Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: getPerformanceColor(m.currentOee) }}>{m.currentOee}%</Typography></TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                </Box>

                {/* Right Sidebar — Top Performers */}
                <Box sx={{ width: 300, backgroundColor: '#fff', borderLeft: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
                    <Box sx={{ p: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.2 }}>
                            <TrophyIcon sx={{ color: COLORS.GOLD, fontSize: '1.1rem' }} />
                            <Typography sx={{ fontWeight: 800, color: COLORS.TEXT_MAIN, fontSize: '0.95rem' }}>
                                Top Performers
                                <Typography component="span" sx={{ fontSize: '0.78rem', color: COLORS.TEXT_SUB, fontWeight: 600, ml: 0.5 }}>(This Shift)</Typography>
                            </Typography>
                        </Box>
                        <Stack spacing={1.2}>
                            {topPerformers.length > 0 ? topPerformers.map((m, idx) => {
                                const ach = getAchievement(m.actual, m.target);
                                const rankColors = [
                                    { bg: 'linear-gradient(135deg, #FFD700, #FFA000)', text: '#7a4f00', shadow: '#FFD70088' },
                                    { bg: 'linear-gradient(135deg, #b0bec5, #78909c)', text: '#fff', shadow: '#90a4ae66' },
                                    { bg: 'linear-gradient(135deg, #cd7f32, #a0522d)', text: '#fff', shadow: '#cd7f3266' },
                                ];
                                const rankStyle = rankColors[idx];
                                const perfColor = getPerformanceColor(ach);
                                const rawGapSb = m.target - m.actual;
                                const isAheadSb = rawGapSb <= 0;
                                const gapLabelSb = isAheadSb ? `+${Math.abs(rawGapSb)}` : `-${rawGapSb}`;
                                const gapColorSb = isAheadSb ? COLORS.RUNNING : COLORS.ALARM;
                                const gapTitleSb = isAheadSb ? 'Ahead' : 'Gap';
                                const oeeColorSb = getPerformanceColor(m.currentOee);
                                const elapsedSb = viewMode === 'Current' && m.statusTs ? formatElapsed(m.statusTs) : null;
                                const statusColorSb = COLORS[m.status.toUpperCase()] || COLORS.DISCONNECTED;
                                return (
                                    <Box key={m.id} sx={{
                                        borderRadius: '10px', overflow: 'hidden',
                                        border: `2px solid ${perfColor}`,
                                        boxShadow: idx === 0 ? `0 0 16px ${rankStyle.shadow}` : '0 1px 4px rgba(0,0,0,0.07)',
                                        backgroundColor: '#fff',
                                    }}>
                                        {/* Accent bar */}
                                        <Box sx={{ height: 4, backgroundColor: perfColor }} />
                                        <Box sx={{ p: '10px 12px' }}>
                                            {/* Row 1: Rank badge + name + status */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, overflow: 'hidden', flex: 1, mr: 0.5 }}>
                                                    {/* Custom rank badge */}
                                                    <Box sx={{
                                                        flexShrink: 0,
                                                        width: 26, height: 26, borderRadius: '7px',
                                                        background: rankStyle.bg,
                                                        boxShadow: `0 2px 6px ${rankStyle.shadow}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: rankStyle.text, lineHeight: 1 }}>#{idx + 1}</Typography>
                                                    </Box>
                                                    <Tooltip title={m.name} arrow placement="top" disableHoverListener={m.name.length <= 18}>
                                                        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: COLORS.TEXT_MAIN, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</Typography>
                                                    </Tooltip>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0 }}>
                                                    {elapsedSb && m.status !== 'Running' && (
                                                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: statusColorSb, fontVariantNumeric: 'tabular-nums' }}>{elapsedSb}</Typography>
                                                    )}
                                                    <Box sx={{ backgroundColor: statusColorSb, color: '#fff', px: 0.8, py: 0.2, borderRadius: '5px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>{m.status}</Box>
                                                </Box>
                                            </Box>
                                            {/* Row 2: Operator */}
                                            <Tooltip title={m.operator} arrow placement="top" disableHoverListener={m.operator.length <= 28}>
                                                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 0.8, pb: 0.6, borderBottom: '1px dashed #e0e0e0', cursor: 'default' }}>{m.operator}</Typography>
                                            </Tooltip>
                                            {/* Row 3: Achievement % + progress bar */}
                                            <Typography sx={{ fontWeight: 900, fontSize: '1.8rem', lineHeight: 1, color: perfColor, mb: 0.4 }}>{ach}%</Typography>
                                            <LinearProgress variant="determinate" value={Math.min(ach, 100)} sx={{ height: 7, borderRadius: 4, backgroundColor: `${perfColor}22`, mb: 1, '& .MuiLinearProgress-bar': { backgroundColor: perfColor, borderRadius: 4 } }} />
                                            {/* Row 4: Target | Actual | Gap | OEE */}
                                            <Box sx={{ display: 'flex', border: '1px solid #ebebeb', borderRadius: '7px', overflow: 'hidden' }}>
                                                {[
                                                    { label: 'Target', value: m.target, color: COLORS.TEXT_MAIN },
                                                    { label: 'Actual', value: m.actual, color: COLORS.TEXT_MAIN },
                                                    { label: gapTitleSb, value: gapLabelSb, color: gapColorSb },
                                                    { label: 'OEE', value: `${m.currentOee}%`, color: oeeColorSb, bg: `${oeeColorSb}12` },
                                                ].map((stat, i) => (
                                                    <Box key={stat.label} sx={{ flex: 1, textAlign: 'center', py: 0.6, backgroundColor: stat.bg || 'transparent', borderRight: i < 3 ? '1px solid #ebebeb' : 'none' }}>
                                                        <Typography sx={{ fontSize: '0.62rem', color: i === 2 ? gapColorSb : i === 3 ? oeeColorSb : COLORS.TEXT_SUB, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.3 }}>{stat.label}</Typography>
                                                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: stat.color, lineHeight: 1.2 }}>{stat.value}</Typography>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            }) : (
                                <Typography sx={{ textAlign: 'center', color: COLORS.TEXT_SUB, mt: 2, fontStyle: 'italic', fontSize: '0.78rem' }}>Calculating rankings...</Typography>
                            )}
                        </Stack>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
