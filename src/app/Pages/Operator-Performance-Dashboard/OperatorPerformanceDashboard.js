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
    Popover,
    Divider,
} from '@mui/material';
import {
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    Settings as SettingsIcon,
    Inventory2 as ProducedIcon,
    TrackChanges as TargetIcon,
    TrendingUp as ProjectedIcon,
} from '@mui/icons-material';
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
        const defaults = { thresholds: { bad: 60, normal: 75 }, sortOrder: 'name', showMetrics: true, showStatusBar: true, gridColumns: 3 };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });

    // Destructure for easy access
    const { thresholds, sortOrder, showMetrics, showStatusBar, gridColumns } = settings;

    // Persist settings on every change
    const updateSettings = (patch) => {
        setSettings(prev => {
            const next = { ...prev, ...patch };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };


    const [isFullscreen, setIsFullscreen] = useState(false);
    const dashboardRef = useRef(null);

    // Dynamic grid layout calculation based on viewport width
    const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

    useEffect(() => {
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-scroll
    const [autoScroll, setAutoScroll] = useState(() => {
        const saved = localStorage.getItem('opd_autoScroll');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [scrollDelay, setScrollDelay] = useState(15000);
    const contentRef = useRef(null);
    const firstLoad = useRef(true);

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
    const [settingsAnchor, setSettingsAnchor] = useState(null);
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

    // Persist auto-scroll preference
    useEffect(() => {
        localStorage.setItem('opd_autoScroll', JSON.stringify(autoScroll));
    }, [autoScroll]);

    // Fetch scroll delay from server config
    useEffect(() => {
        const fetchDelay = async () => {
            try {
                const res = await customerbasedshift(customerId, 'oeeScrollDuration');
                const val = Number(res[0]?.value);
                if (!isNaN(val) && val > 0) setScrollDelay(val * 1000);
            } catch (e) {}
        };
        if (customerId) fetchDelay();
    }, [customerId]);

    // Main auto-scroll
    useEffect(() => {
        if (!contentRef.current || !autoScroll) return;
        const container = contentRef.current;
        const step = 445;
        let scrollInterval;
        const startScrolling = () => {
            scrollInterval = setInterval(() => {
                if (!container) return;
                const maxScrollTop = container.scrollHeight - container.clientHeight;
                if (container.scrollTop >= maxScrollTop - 5) {
                    container.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (maxScrollTop - container.scrollTop < step) {
                    container.scrollTo({ top: maxScrollTop, behavior: 'smooth' });
                } else {
                    container.scrollBy({ top: step, behavior: 'smooth' });
                }
            }, scrollDelay);
        };
        let delayTimer;
        if (firstLoad.current) {
            delayTimer = setTimeout(() => { startScrolling(); firstLoad.current = false; }, 15000);
        } else {
            startScrolling();
        }
        return () => { clearTimeout(delayTimer); clearInterval(scrollInterval); };
    }, [autoScroll, scrollDelay]);

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

    // Sorting by Performance Ratio
    const filteredAndSortedData = useMemo(() => {
        return [...dashboardData].sort((a, b) => {
            if (sortOrder === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            const perfA = getAchievement(a.actual, a.target);
            const perfB = getAchievement(b.actual, b.target);
            return sortOrder === 'asc' ? perfA - perfB : perfB - perfA;
        });
    }, [dashboardData, sortOrder]);

    const colsCount = useMemo(() => {
        const dataLength = filteredAndSortedData.length || 1;
        let cols = 5; // fallback
        if (gridColumns === 'auto') {
            const availableWidth = viewportWidth - 60; // subtract padding/margins
            cols = Math.max(1, Math.floor(availableWidth / 330));
            cols = Math.min(cols, dataLength); // prevent too many empty cols for small count
        } else {
            cols = Number(gridColumns);
        }
        return cols;
    }, [filteredAndSortedData.length, gridColumns, viewportWidth]);

    // Shift elapsed fraction (break-aware), updates every second via tick
    const shiftFraction = useMemo(() => {
        if (viewMode !== 'Current' || !currentShiftInfo || !shifts.length) return 1;
        const dateStr = dayjs(currentShiftInfo.date).format("YYYY-MM-DD");
        const s = shifts.find(s => String(s.shift_no) === String(currentShiftInfo.shiftNo));
        if (!s) return 1;
        const from = dayjs(`${dateStr}T${s.start_time}`).add((Number(s.start_day) || 1) - 1, 'day').valueOf();
        const to   = dayjs(`${dateStr}T${s.end_time}`).add((Number(s.end_day)   || 1) - 1, 'day').valueOf();
        const now  = Date.now();
        const breaks = (s.break_details || []).map(b => {
            let bStart = dayjs(`${dateStr}T${b.start_time}`).add((Number(s.start_day) || 1) - 1, 'day');
            let bEnd   = dayjs(`${dateStr}T${b.end_time}`).add((Number(s.start_day)   || 1) - 1, 'day');
            if (bStart.valueOf() < from) { bStart = bStart.add(1, 'day'); bEnd = bEnd.add(1, 'day'); }
            return { start: bStart.valueOf(), end: bEnd.valueOf() };
        });
        const totalBreakMs  = breaks.reduce((sum, b) => sum + (b.end - b.start), 0);
        const netDuration   = (to - from) - totalBreakMs;
        const clockElapsed  = Math.max(0, now - from);
        const elapsedBreakMs = breaks.reduce((sum, b) => {
            if (now <= b.start) return sum;
            if (now >= b.end)   return sum + (b.end - b.start);
            return sum + (now - b.start);
        }, 0);
        const netElapsed = clockElapsed - elapsedBreakMs;
        return netDuration > 0 ? Math.min(netElapsed / netDuration, 1) : 0;
    }, [viewMode, currentShiftInfo, shifts, tick]); // eslint-disable-line react-hooks/exhaustive-deps

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
                component: '',
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

        const POLL_KEYS = 'machine_status,oee,targetparts,totalparts,live_operator,live_component';

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

                    const compV = getV('live_component');
                    if (compV !== null) {
                        try {
                            const comp = JSON.parse(compV);
                            updated.component = comp.name || comp.component || '';
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
    const RenderMachineCard = useCallback(({ m }) => {
        // Current time target: proportional to elapsed shift fraction (mirrors operator.js logic)
        const currentTimeTarget = viewMode === 'Current' && m.target > 0 && shiftFraction > 0
            ? Math.min(m.target, Math.round(shiftFraction * m.target))
            : m.target;

        const achievement = getAchievement(m.actual, currentTimeTarget);
        const statusColor = COLORS[m.status.toUpperCase()] || COLORS.DISCONNECTED;
        const performanceColor = getPerformanceColor(achievement);

        return (
            <Card sx={{
                borderRadius: 0, overflow: 'hidden',
                display: 'flex', flexDirection: 'column', height: '100%',
                backgroundColor: performanceColor,
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                border: 'none',
            }}>

                {/* ── Header: status color bg — machine name + idle timer ── */}
                <Box sx={{ backgroundColor: statusColor, px: 'clamp(8px, 1.1vw, 16px)', pt: 'clamp(8px, 1.1vw, 14px)', pb: 'clamp(6px, 0.9vw, 10px)', flexShrink: 0, borderBottom: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Tooltip title={m.name} arrow placement="top" disableHoverListener={m.name.length <= 14}>
                        <Typography sx={{ fontWeight: 900, fontSize: 'clamp(1.1rem, 1.9vw, 2.1rem)', color: '#fff', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.5px', flex: 1, minWidth: 0 }}>
                            {m.name}
                        </Typography>
                    </Tooltip>
                    {m.status.toUpperCase() !== 'RUNNING' && m.statusTs && formatElapsed(m.statusTs) && (
                        <Typography sx={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.5rem)', fontWeight: 800, color: 'rgba(255,255,255,0.95)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            ⏱ {formatElapsed(m.statusTs)}
                        </Typography>
                    )}
                </Box>

                {/* ── Body: Performance hero (left) + Metrics (right) ── */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>

                    {/* LEFT — Circular Performance Progress */}
                    {(() => {
                        const r = 46, sw = 7, cx = 56, cy = 56;
                        const norm = 2 * Math.PI * r;
                        const dash = (Math.min(achievement, 100) / 100) * norm;
                        const angle = -Math.PI / 2 + (Math.min(achievement, 100) / 100) * 2 * Math.PI;
                        const dotX = cx + r * Math.cos(angle);
                        const dotY = cy + r * Math.sin(angle);
                        return (
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', py: 'clamp(6px, 1.5vw, 16px)', px: 'clamp(6px, 1vw, 12px)', backgroundColor: '#ffffff' }}>
                                <Tooltip title={m.operator} arrow placement="top" disableHoverListener={m.operator.length <= 24}>
                                    <Typography sx={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.4rem)', fontWeight: 700, color: COLORS.TEXT_MAIN, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', mb: 0.5, textAlign: 'center' }}>
                                        {m.operator || '—'}
                                    </Typography>
                                </Tooltip>
                                <Box sx={{ position: 'relative', width: 'clamp(95px, 12.5vw, 160px)', height: 'clamp(95px, 12.5vw, 160px)', maxHeight: '100%', aspectRatio: '1/1' }}>
                                    <svg viewBox="0 0 112 112" style={{ width: '100%', height: '100%' }}>
                                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={sw} />
                                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={performanceColor} strokeWidth={sw}
                                            strokeDasharray={`${dash} ${norm}`} strokeLinecap="round"
                                            transform={`rotate(-90 ${cx} ${cy})`} />
                                        <circle cx={dotX} cy={dotY} r={4.5} fill={performanceColor} stroke="#fff" strokeWidth={1.5} />
                                    </svg>
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                                        <Typography sx={{ fontWeight: 900, fontSize: 'clamp(1.4rem, 2.3vw, 2.8rem)', color: performanceColor, lineHeight: 1, letterSpacing: '-1px' }}>
                                            {achievement}<span style={{ fontSize: 'clamp(0.75rem, 1.1vw, 1.4rem)', fontWeight: 800 }}>%</span>
                                        </Typography>
                                        <Typography sx={{ fontSize: 'clamp(0.42rem, 0.55vw, 0.7rem)', fontWeight: 900, color: COLORS.TEXT_SUB, letterSpacing: '1px', mt: 0.2, textTransform: 'uppercase' }}>
                                            Performance
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })()}

                    {/* RIGHT — Actual / Cur.Tgt / OEE stacked */}
                    <Box sx={{ borderLeft: '1px solid rgba(0,0,0,0.1)', backgroundColor: 'rgba(255,255,255,0.92)', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', px: 'clamp(8px, 1.1vw, 14px)', py: 'clamp(4px, 0.8vw, 10px)', minWidth: 'clamp(70px, 9vw, 110px)', flexShrink: 0 }}>
                        {[
                            { label: 'Actual',  value: m.actual,           color: COLORS.TEXT_MAIN },
                            { label: 'Target', value: currentTimeTarget,  color: viewMode === 'Current' && currentTimeTarget > 0 ? (m.actual >= currentTimeTarget ? '#2e7d32' : '#c62828') : COLORS.TEXT_MAIN },
                            { label: 'OEE',     value: `${m.currentOee}%`, color: COLORS.TEXT_MAIN },
                        ].map(({ label, value, color }) => (
                            <Box key={label}>
                                <Typography sx={{ fontSize: 'clamp(0.5rem, 0.65vw, 0.8rem)', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>
                                    {label}
                                </Typography>
                                <Typography sx={{ fontSize: 'clamp(1.1rem, 1.8vw, 2.2rem)', fontWeight: 900, color, lineHeight: 1.15, mt: 0.15 }}>
                                    {value}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* ── Footer: Live Component ── */}
                <Box sx={{ backgroundColor: 'rgba(0,0,0,0.18)', borderTop: '1px solid rgba(255,255,255,0.12)', px: 'clamp(8px, 1.1vw, 16px)', pt: 'clamp(8px, 1.1vw, 14px)', pb: 'clamp(6px, 0.9vw, 10px)', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 'clamp(0.5rem, 0.65vw, 0.78rem)', fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>
                        Component
                    </Typography>
                    <Typography sx={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.5rem)', fontWeight: 800, color: m.component ? '#fff' : 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.3, lineHeight: 1.1 }}>
                        {m.component || 'Not Assigned'}
                    </Typography>
                </Box>
            </Card>
        );
    }, [getPerformanceColor, viewMode, tick, formatElapsed, shiftFraction]);

    return (
        <Box ref={dashboardRef} sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', backgroundColor: COLORS.BG, overflow: 'hidden'}}>
            {/* ── Main Header ── */}
            <Box sx={{
                px: 3, py: 1.4,
                borderBottom: '2px solid #e8e8e8',
                backgroundColor: '#fff',
                marginTop: isFullscreen ? '0px' : '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                {/* LEFT: live + shift + updated time */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 320 }}>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 900, color: wsConnected ? COLORS.RUNNING : COLORS.TEXT_SUB }}>
                        {viewMode === 'Current' ? (wsConnected ? '● Live' : '⏱ Connecting…') : '📋 Prev Shift'}
                    </Typography>
                    <Typography sx={{ fontSize: '1.05rem', color: '#ccc', fontWeight: 700 }}>|</Typography>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 900, color: COLORS.PRIMARY }}>
                        Shift {viewMode === 'Current' ? (currentShiftInfo?.shiftNo ?? '–') : (prevShiftInfo?.shiftNo ?? '–')}
                    </Typography>
                    <>
                        <Typography sx={{ fontSize: '1.05rem', color: '#ccc', fontWeight: 700 }}>|</Typography>
                        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: COLORS.TEXT_SUB, fontVariantNumeric: 'tabular-nums' }}>
                            {dayjs().format('DD MMM HH:mm:ss')}
                        </Typography>
                    </>
                </Box>

                {/* CENTER: Title */}
                <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.7rem', color: COLORS.TEXT_MAIN, lineHeight: 1.1, letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
                        Operator Performance
                    </Typography>
                </Box>

                {/* RIGHT: Controls with labels above */}
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                    {/* Shift dropdown */}
                    <Box>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.4, ml: 0.5 }}>Shift</Typography>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <Select
                                value={viewMode}
                                onChange={(e) => setViewMode(e.target.value)}
                                sx={{ height: 38, fontSize: '0.9rem', fontWeight: 700, backgroundColor: '#fff', borderRadius: '8px' }}
                                MenuProps={{ container: dashboardRef.current }}
                            >
                                <MenuItem value="Current" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Current Shift</MenuItem>
                                <MenuItem value="Previous" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Previous Shift</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    {/* Group dropdown */}
                    {showMachineGroupsDropdown && (
                        <Box>
                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.4, ml: 0.5 }}>Group</Typography>
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                <Select
                                    multiple
                                    value={selectedGroups}
                                    onChange={(e) => handleGroupChange(e.target.value)}
                                    sx={{ height: 38, fontSize: '0.9rem', fontWeight: 700, backgroundColor: '#fff', borderRadius: '8px' }}
                                    renderValue={(sel) => sel.length === machineGroups.length ? 'All Groups' : sel.join(', ')}
                                    MenuProps={{ container: dashboardRef.current }}
                                >
                                    <MenuItem value="all"><Checkbox checked={selectedGroups.length === machineGroups.length} size="small" /><ListItemText primary="All" /></MenuItem>
                                    {machineGroups.map((g) => (
                                        <MenuItem key={g.name} value={g.name}><Checkbox checked={selectedGroups.includes(g.name)} size="small" /><ListItemText primary={g.name} /></MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    )}

                    {/* Settings */}
                    <Tooltip title="Sort & Thresholds">
                        <IconButton onClick={(e) => setSettingsAnchor(e.currentTarget)}
                            sx={{ border: `1px solid ${settingsAnchor ? COLORS.PRIMARY : '#e0e0e0'}`, borderRadius: '8px', backgroundColor: settingsAnchor ? `${COLORS.PRIMARY}12` : '#fff', width: 38, height: 38, transition: 'all 0.15s' }}>
                            <SettingsIcon sx={{ fontSize: '1.3rem', color: settingsAnchor ? COLORS.PRIMARY : COLORS.TEXT_SUB }} />
                        </IconButton>
                    </Tooltip>

                    {/* Fullscreen */}
                    <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                        <IconButton onClick={toggleFullscreen} sx={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#fff', width: 38, height: 38 }}>
                            {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: '1.3rem' }} /> : <FullscreenIcon sx={{ fontSize: '1.3rem' }} />}
                        </IconButton>
                    </Tooltip>

                    {isLoading && <CircularProgress size={22} sx={{ color: COLORS.PRIMARY }} />}
                </Box>
            </Box>

            {/* ── Row 2: Metrics Subheader — stretched equally across full width ── */}
            {showMetrics && <Box sx={{ display: 'flex', alignItems: 'stretch', backgroundColor: '#fff', borderBottom: '2px solid #e8e8e8', overflowX: 'auto' }}>

                {/* OEE – Current Shift */}
                {(() => {
                    const val = summaryMetrics.currentShiftOee;
                    const color = getPerformanceColor(val);
                    const r = 28, sw = 6, cx = 32, cy = 32, norm = 2 * Math.PI * r;
                    const dash = (val / 100) * norm;
                    return (
                        <Box sx={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.2, borderRight: '1px solid #e8e8e8' }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.3 }}>Shift OEE</Typography>
                                <Typography sx={{ fontSize: '2rem', fontWeight: 900, color, lineHeight: 1 }}>{val}<span style={{ fontSize: '1rem' }}>%</span></Typography>
                            </Box>
                            <svg width={64} height={64} style={{ flexShrink: 0 }}>
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8e8e8" strokeWidth={sw} />
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
                                    strokeDasharray={`${dash} ${norm}`} strokeLinecap="round"
                                    transform={`rotate(-90 ${cx} ${cy})`} />
                            </svg>
                        </Box>
                    );
                })()}

                {/* OEE – Prev Shift */}
                {summaryMetrics.prevShiftOee > 0 && (() => {
                    const val = summaryMetrics.prevShiftOee;
                    const color = getPerformanceColor(val);
                    const diff = summaryMetrics.currentShiftOee - val;
                    const r = 28, sw = 6, cx = 32, cy = 32, norm = 2 * Math.PI * r;
                    const dash = (val / 100) * norm;
                    return (
                        <Box sx={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.2, borderRight: '1px solid #e8e8e8' }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.3 }}>Prev Shift OEE</Typography>
                                <Typography sx={{ fontSize: '2rem', fontWeight: 900, color, lineHeight: 1 }}>{val}<span style={{ fontSize: '1rem' }}>%</span></Typography>
                                {diff !== 0 && (
                                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: diff > 0 ? COLORS.RUNNING : COLORS.ALARM, mt: 0.2 }}>
                                        {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}% vs prev
                                    </Typography>
                                )}
                            </Box>
                            <svg width={64} height={64} style={{ flexShrink: 0 }}>
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8e8e8" strokeWidth={sw} />
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
                                    strokeDasharray={`${dash} ${norm}`} strokeLinecap="round"
                                    transform={`rotate(-90 ${cx} ${cy})`} />
                            </svg>
                        </Box>
                    );
                })()}

                {/* Produced */}
                <Box sx={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.2, borderRight: '1px solid #e8e8e8' }}>
                    <Box>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.3 }}>Produced</Typography>
                        <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: COLORS.TEXT_MAIN, lineHeight: 1 }}>{headerMetrics.totalProduced.toLocaleString()}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: COLORS.TEXT_SUB, mt: 0.2 }}>PCS</Typography>
                    </Box>
                    <ProducedIcon sx={{ fontSize: '2.4rem', color: '#b0bec5' }} />
                </Box>

                {/* Shift Target */}
                <Box sx={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.2, borderRight: '1px solid #e8e8e8' }}>
                    <Box>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.3 }}>Shift Target</Typography>
                        <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: COLORS.TEXT_MAIN, lineHeight: 1 }}>{headerMetrics.totalTarget.toLocaleString()}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: COLORS.TEXT_SUB, mt: 0.2 }}>PCS</Typography>
                    </Box>
                    <TargetIcon sx={{ fontSize: '2.4rem', color: '#b0bec5' }} />
                </Box>

                {/* Projected */}
                {headerMetrics.projected !== null && viewMode === 'Current' && (
                    <Box sx={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.2, backgroundColor: headerMetrics.willMissTarget ? '#fffde7' : 'transparent' }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.3 }}>Projected</Typography>
                            <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: headerMetrics.willMissTarget ? COLORS.IDLE : COLORS.RUNNING, lineHeight: 1 }}>{headerMetrics.projected.toLocaleString()}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: COLORS.TEXT_SUB, mt: 0.2 }}>PCS {headerMetrics.willMissTarget && <span style={{ color: COLORS.IDLE }}>⚠ Miss</span>}</Typography>
                        </Box>
                        <ProjectedIcon sx={{ fontSize: '2.4rem', color: headerMetrics.willMissTarget ? COLORS.IDLE : '#b0bec5' }} />
                    </Box>
                )}
            </Box>}

            {/* Settings Popover */}
            <Popover
                open={Boolean(settingsAnchor)}
                anchorEl={settingsAnchor}
                onClose={() => setSettingsAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                container={dashboardRef.current}
                PaperProps={{ sx: { borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', p: 2.5, minWidth: 300 } }}
            >
                <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: COLORS.TEXT_MAIN, mb: 1.8 }}>⚙ Display Settings</Typography>

                {/* Visibility Toggles */}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 0.8 }}>Visible Sections</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 2 }}>
                    {[
                        { key: 'showMetrics',   label: 'Metrics Bar',                          value: showMetrics,   onToggle: () => updateSettings({ showMetrics: !showMetrics }) },
                        { key: 'showStatusBar', label: 'Status Bar',                           value: showStatusBar, onToggle: () => updateSettings({ showStatusBar: !showStatusBar }) },
                        { key: 'autoScroll', label: 'Auto Scroll', value: autoScroll, onToggle: () => setAutoScroll(v => !v) },
                    ].map(({ key, label, value, onToggle }) => (
                        <Box key={key} onClick={onToggle}
                            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.9, borderRadius: '8px', border: '1px solid #e0e0e0', cursor: 'pointer', backgroundColor: value ? '#fff8f0' : '#fafafa', '&:hover': { backgroundColor: value ? '#fff3e0' : '#f0f0f0' } }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.TEXT_MAIN }}>{label}</Typography>
                            <Box sx={{ width: 36, height: 20, borderRadius: '10px', backgroundColor: value ? COLORS.PRIMARY : '#ccc', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                                <Box sx={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
                            </Box>
                        </Box>
                    ))}

                    {/* Scroll delay input — visible only when auto scroll is on */}
                    {autoScroll && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.9, borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}
                            onClick={e => e.stopPropagation()}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.TEXT_MAIN }}>Scroll Interval</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <input
                                    type="number"
                                    min={5} max={120}
                                    value={scrollDelay / 1000}
                                    onChange={e => {
                                        const v = Math.max(5, Math.min(120, Number(e.target.value)));
                                        if (!isNaN(v)) setScrollDelay(v * 1000);
                                    }}
                                    style={{ width: 52, border: `1px solid ${COLORS.PRIMARY}55`, borderRadius: 6, background: '#fff', fontSize: '0.9rem', fontWeight: 900, color: COLORS.PRIMARY, outline: 'none', textAlign: 'center', padding: '4px' }}
                                />
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.TEXT_SUB }}>sec</Typography>
                            </Box>
                        </Box>
                    )}
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Grid Columns Layout */}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 0.8 }}>Grid Columns Layout</Typography>
                <Box sx={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', mb: 2 }}>
                    {[
                        { val: 'auto', label: 'Auto' },
                        { val: 3, label: '3 Cols' },
                        { val: 4, label: '4 Cols' },
                        { val: 5, label: '5 Cols' }
                    ].map(opt => (
                        <Box key={opt.val} onClick={() => updateSettings({ gridColumns: opt.val })}
                            sx={{ flex: 1, textAlign: 'center', px: 0.5, py: 1, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', backgroundColor: gridColumns === opt.val ? COLORS.PRIMARY : '#fafafa', color: gridColumns === opt.val ? '#fff' : COLORS.TEXT_SUB, borderRight: opt.val !== 5 ? '1px solid #e0e0e0' : 'none', transition: 'all 0.15s', '&:hover': { backgroundColor: gridColumns === opt.val ? COLORS.PRIMARY : '#f0f0f0' } }}
                        >{opt.label}</Box>
                    ))}
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Sort */}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 0.8 }}>Sort Order</Typography>
                <Box sx={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', mb: 2 }}>
                    {[{ val: 'name', label: 'A→Z Name' }, { val: 'asc', label: '↑ Low → High' }, { val: 'desc', label: '↓ High → Low' }].map(opt => (
                        <Box key={opt.val} onClick={() => updateSettings({ sortOrder: opt.val })}
                            sx={{ flex: 1, textAlign: 'center', px: 1.5, py: 1, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', backgroundColor: sortOrder === opt.val ? COLORS.PRIMARY : '#fafafa', color: sortOrder === opt.val ? '#fff' : COLORS.TEXT_SUB, transition: 'all 0.15s', '&:hover': { backgroundColor: sortOrder === opt.val ? COLORS.PRIMARY : '#f0f0f0' } }}
                        >{opt.label}</Box>
                    ))}
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Thresholds */}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1 }}>Performance Thresholds</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fdecea', border: '1px solid #f4433633', borderRadius: '8px', px: 1.5, py: 0.8 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS.ALARM }} />
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.ALARM }}>Red below</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <input type="number" value={thresholds.bad}
                                onChange={(e) => updateSettings({ thresholds: { ...thresholds, bad: Number(e.target.value) } })}
                                style={{ width: 52, border: '1px solid #f4433655', borderRadius: 6, background: '#fff', fontSize: '0.9rem', fontWeight: 900, color: COLORS.ALARM, outline: 'none', textAlign: 'center', padding: '4px' }} />
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.ALARM }}>%</Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff8e1', border: '1px solid #f1a01433', borderRadius: '8px', px: 1.5, py: 0.8 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS.IDLE }} />
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.IDLE }}>Yellow below</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <input type="number" value={thresholds.normal}
                                onChange={(e) => updateSettings({ thresholds: { ...thresholds, normal: Number(e.target.value) } })}
                                style={{ width: 52, border: '1px solid #f1a01455', borderRadius: 6, background: '#fff', fontSize: '0.9rem', fontWeight: 900, color: COLORS.IDLE, outline: 'none', textAlign: 'center', padding: '4px' }} />
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: COLORS.IDLE }}>%</Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Legend */}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    {[
                        { color: COLORS.ALARM,   label: `< ${thresholds.bad}% Bad` },
                        { color: COLORS.IDLE,    label: `${thresholds.bad}–${thresholds.normal}% Normal` },
                        { color: COLORS.RUNNING, label: `≥ ${thresholds.normal}% Good` },
                    ].map(l => (
                        <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '3px', backgroundColor: l.color }} />
                            <Typography sx={{ fontSize: '0.75rem', color: COLORS.TEXT_SUB, fontWeight: 600 }}>{l.label}</Typography>
                        </Box>
                    ))}
                </Box>
            </Popover>

            {/* ── Row 3: Fleet Status Bar — 5 equal columns, display only ── */}
            {showStatusBar && (() => {
                const counts = dashboardData.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {});
                const total = dashboardData.length;
                const cols = [
                    { label: 'Total',        count: total,                  color: COLORS.PRIMARY },
                    { label: 'Running',      count: counts['Running']      || 0, color: COLORS.RUNNING },
                    { label: 'Idle',         count: counts['Idle']         || 0, color: COLORS.IDLE },
                    { label: 'Alarm',        count: counts['Alarm']        || 0, color: COLORS.ALARM },
                    { label: 'Disconnected', count: counts['Disconnected'] || 0, color: COLORS.DISCONNECTED },
                ];
                return (
                    <Box sx={{ backgroundColor: '#fff', borderBottom: '2px solid #e8e8e8', display: 'flex', alignItems: 'stretch' }}>
                        {cols.map((c, i) => (
                            <Box key={c.label} sx={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2,
                                py: 0.9,
                                borderRight: i < cols.length - 1 ? '1px solid #e8e8e8' : 'none',
                                borderBottom: `3px solid ${c.color}`,
                            }}>
                                <Box sx={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: c.color, flexShrink: 0 }} />
                                <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: COLORS.TEXT_MAIN, lineHeight: 1 }}>{c.count}</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: COLORS.TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{c.label}</Typography>
                            </Box>
                        ))}
                    </Box>
                );
            })()}

            {/* ── Main Content: Machine Grid — 5 columns ── */}

            <Box ref={contentRef} sx={{ 
                flex: 1, 
                padding: '14px', 
                overflowY: 'auto'
            }}>
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${colsCount}, 1fr)`,
                    gridAutoRows: 'clamp(300px, 42vh, 520px)',
                    gap: '12px'
                }}>
                    {filteredAndSortedData.map((m) => (
                        <RenderMachineCard key={m.id} m={m} />
                    ))}
                </Box>
            </Box>
        </Box>
    );
}
