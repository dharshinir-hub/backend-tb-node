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
    Chip,
    Divider,
    Tooltip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    RadioGroup,
    FormControlLabel,
    Radio,
    OutlinedInput,
    Stack
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import {
    customerbasedshift,
    telemetrykeydata
} from '../../Services/app/companyservice';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';

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

const STATUS_OPTIONS = ['Running', 'Idle', 'Alarm', 'Disconnected'];

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
        const defaults = {
            thresholds: { bad: 60, normal: 75 },
            sortOrder: 'asc',
            selectedStatuses: STATUS_OPTIONS
        };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });

    // Destructure for easy access
    const { thresholds, sortOrder, selectedStatuses } = settings;

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const dashboardRef = useRef(null);

    const [shifts, setShifts] = useState([]);
    const [currentShiftInfo, setCurrentShiftInfo] = useState(null);
    const [prevShiftInfo, setPrevShiftInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState([]);
    const [summaryMetrics, setSummaryMetrics] = useState({ currentShiftOee: 0, prevShiftOee: 0 });

    const getAchievement = (actual, target) => {
        if (!target || target === 0) return 0;
        return Math.round((actual / target) * 100);
    };

    const getPerformanceColor = (percent) => {
        if (percent < thresholds.bad) return COLORS.ALARM;
        if (percent < thresholds.normal) return COLORS.IDLE;
        return COLORS.RUNNING;
    };

    // --- Business Logic for Top Performers (Top 3) ---
    const topPerformers = useMemo(() => {
        if (dashboardData.length === 0) return [];
        
        // Use Actual vs Target Ratio (Achievement%) as the ranking metric
        return [...dashboardData]
            .filter(m => m.actual > 0 && m.target > 0)
            .map(m => {
                const achievement = Math.round((m.actual / m.target) * 100);
                return { ...m, achievement };
            })
            .sort((a, b) => b.achievement - a.achievement || b.currentOee - a.currentOee)
            .slice(0, 3);
            
        /* Weighted scoring logic (Paused)
        const maxActual = Math.max(...valid.map(m => m.actual), 1);
        return [...valid].map(m => {
            const efficiency = m.target > 0 ? Math.min(m.actual / m.target, 1) : 0;
            const workload = m.actual / maxActual;
            const score = (efficiency * 0.6) + (workload * 0.4);
            return { ...m, score };
        })
        .sort((a, b) => b.score - a.score || b.currentOee - a.currentOee)
        .slice(0, 3);
        */
    }, [dashboardData]);

    // Sorting by Performance Ratio (Dynamic Order & Status Filter)
    const filteredAndSortedData = useMemo(() => {
        return [...dashboardData]
            .filter(m => selectedStatuses.includes(m.status))
            .filter(m => !topPerformers.some(tp => tp.id === m.id)) // Exclude Top 3 from main grid
            .sort((a, b) => {
                const perfA = getAchievement(a.actual, a.target);
                const perfB = getAchievement(b.actual, b.target);
                return sortOrder === 'asc' ? perfA - perfB : perfB - perfA;
            });
    }, [dashboardData, sortOrder, selectedStatuses, topPerformers]);

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

    const handleSettingsSave = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        setIsSettingsOpen(false);
    };

    const handleReset = () => {
        const defaults = {
            thresholds: { bad: 60, normal: 75 },
            sortOrder: 'asc',
            selectedStatuses: STATUS_OPTIONS
        };
        setSettings(defaults);
        localStorage.removeItem(STORAGE_KEY);
        setIsSettingsOpen(false); // Close dialog on reset
    };

    const handleStatusFilterChange = (status) => {
        const newStatuses = selectedStatuses.includes(status)
            ? selectedStatuses.filter(s => s !== status)
            : [...selectedStatuses, status];
        setSettings({ ...settings, selectedStatuses: newStatuses });
    };

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
    const prevOeeCache = useRef({});

    const fetchData = useCallback(async (isInitial = false) => {
        if (!shifts.length || !currentShiftInfo || !customerId || !selectedMachines.length) return;
        
        setIsLoading(true);
        try {
            const currT = getShiftTimes(shifts, currentShiftInfo.shiftNo, currentShiftInfo.date);
            const prevT = prevShiftInfo ? getShiftTimes(shifts, prevShiftInfo.shiftNo, prevShiftInfo.date) : null;
            const keys = ["oee","totalparts","targetparts","machine_status","live_operator"].join(',');
            const ids = deviceNameID.filter((d) => selectedMachines.includes(d.name)).map((d) => d.id);

            // 1. One-time fetch for Previous Shift OEE (Static data)
            if (isInitial || Object.keys(prevOeeCache.current).length === 0) {
                if (prevT) {
                    await Promise.all(ids.map(async (devId) => {
                        const pData = await telemetrykeydata(devId, "DEVICE", "oee", prevT.from, prevT.to);
                        const val = (pData?.oee && pData.oee.length > 0) ? pData.oee[pData.oee.length - 1].value : 0;
                        prevOeeCache.current[devId] = Math.round(parseFloat(val) || 0);
                    }));
                } else {
                    prevOeeCache.current = {};
                }
            }

            // 2. Continuous fetch for Current Shift Live Data
            const results = await Promise.all(ids.map(async (devId) => {
                const currData = await telemetrykeydata(devId, "DEVICE", keys, currT.from, currT.to);
                const getLatest = (arr) => (arr && arr.length > 0) ? arr[arr.length - 1] : null;

                // Operator Logic
                const rawOps = currData?.live_operator || [];
                let opString = 'No Operator';
                if (rawOps.length > 0) {
                    const parsedOps = rawOps.map(r => {
                        try { return { ...JSON.parse(r.value), ts: r.ts }; } catch(e) { return null; }
                    }).filter(Boolean).sort((a, b) => b.ts - a.ts);

                    if (parsedOps.length > 0) {
                        const latest = parsedOps[0];
                        const pName = latest.name || latest.operator || 'Unknown';
                        const pCode = latest.code || '';
                        const pDisp = pCode ? `${pName} (${pCode})` : pName;
                        const others = parsedOps.slice(1).filter(p => Number(p.duration) >= 1800).map(p => {
                            const n = p.name || p.operator;
                            const c = p.code || '';
                            return c ? `${n} (${c})` : n;
                        }).filter(n => n && n !== pDisp);
                        opString = others.length > 0 ? `${pDisp}, ${[...new Set(others)].join(', ')}` : pDisp;
                    }
                }

                // Machine Status Logic
                const statusMap = { 0:'Idle', 1:'Idle', 2:'Idle', 3:'Running', 4:'Alarm', 5:'Alarm', 6:'Locked', 7:'Setting', 100:'Disconnected' };
                const rawS = getLatest(currData?.machine_status)?.value;
                const status = statusMap[parseInt(rawS)] || statusMap[rawS] || 'Disconnected';
                
                // Parts Logic
                let parts = { goodparts: 0 }; try { if (getLatest(currData?.totalparts)?.value) parts = JSON.parse(getLatest(currData?.totalparts).value); } catch(e) {}

                return {
                    id: devId,
                    name: deviceNameID.find(d => d.id === devId)?.name || 'Unknown',
                    operator: opString,
                    status: status,
                    currentOee: Math.round(parseFloat(getLatest(currData?.oee)?.value) || 0),
                    prevOee: prevOeeCache.current[devId] || 0, // Merged from Cache
                    target: Math.round(parseFloat(getLatest(currData?.targetparts)?.value) || 0),
                    actual: parts.goodparts || 0,
                };
            }));

            setDashboardData(results);
            const validC = results.filter(m => m.currentOee > 0);
            const validP = Object.values(prevOeeCache.current).filter(v => v > 0);
            setSummaryMetrics({
                currentShiftOee: validC.length > 0 ? Math.round(validC.reduce((a, b) => a + b.currentOee, 0) / validC.length) : 0,
                prevShiftOee: validP.length > 0 ? Math.round(validP.reduce((a, b) => a + Number(b), 0) / validP.length) : 0
            });
        } catch (error) { console.error("Fetch Data Error:", error); } finally { setIsLoading(false); }
    }, [shifts, currentShiftInfo, prevShiftInfo, customerId, selectedMachines, deviceNameID, getShiftTimes]);

    useEffect(() => {
        const fetchShiftList = async () => {
            const res = await customerbasedshift(customerId, 'allShift');
            const list = res[0]?.value || [];
            if (list.length > 0) { setShifts(list); detectShifts(list); }
        };
        if (customerId) fetchShiftList();
    }, [customerId, detectShifts]);

    useEffect(() => {
        if (shifts.length > 0 && selectedMachines.length > 0 && currentShiftInfo) {
            // Initial call fetches BOTH Prev and Current
            prevOeeCache.current = {}; 
            fetchData(true);

            // Interval call re-checks shift timing AND fetches Current metrics
            const timer = setInterval(() => {
                detectShifts(shifts);
                fetchData(false);
            }, 30000);
            return () => clearInterval(timer);
        }
    }, [shifts, selectedMachines, currentShiftInfo, fetchData, detectShifts]);

    // Common Card Component to ensure visual consistency
    const RenderMachineCard = useCallback(({ m, rank }) => {
        const achievement = getAchievement(m.actual, m.target);
        const perfColor = getPerformanceColor(achievement);
        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

        return (
            <Card sx={{
                padding: '16px', borderRadius: '12px', 
                display: 'flex', flexDirection: 'column', gap: 1, height: '100%',
                position: 'relative',
                backgroundColor: '#fff',
                transition: 'all 0.3s ease',
                
                // --- Border Logic ---
                border: `2px solid ${perfColor}`, // Unified 2px border on all sides
                
                boxShadow: rank === 1 
                    ? `0 0 25px ${COLORS.GOLD}66` // Subtle gold glow for the champion
                    : '0 4px 12px rgba(0,0,0,0.06)', 
                
                borderStyle: 'solid',
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {rank && <Typography sx={{ fontSize: '1.2rem' }}>{medals[rank]}</Typography>}
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: COLORS.TEXT_MAIN, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</Typography>
                    </Box>
                    <Box sx={{ backgroundColor: COLORS[m.status.toUpperCase()] || COLORS.ALARM, color: '#fff', px: 1, py: 0.2, borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>{m.status}</Box>
                </Box>
                <Tooltip title={m.operator} arrow placement="top">
                    <Typography sx={{ fontSize: '0.8rem', color: COLORS.TEXT_SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Op: <strong>{m.operator}</strong>
                    </Typography>
                </Tooltip>
                
                <Box sx={{ mt: 'auto', py: 1 }}>
                    <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: COLORS.TEXT_MAIN }}>{achievement}%</Typography>
                    <LinearProgress variant="determinate" value={Math.min(achievement, 100)} sx={{ height: 6, borderRadius: 3, mt: 1, backgroundColor: '#f0f0f0', '& .MuiLinearProgress-bar': { backgroundColor: perfColor } }} />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: COLORS.TEXT_SUB }}>T:{m.target} | A:{m.actual}</Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: COLORS.TEXT_MAIN }}>OEE: {m.currentOee}%</Typography>
                </Box>
            </Card>
        );
    }, [getPerformanceColor]);

    return (
        <Box ref={dashboardRef} sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', backgroundColor: COLORS.BG, overflow: 'hidden'}}>
            <Box sx={{ 
                padding: '12px 24px', 
                borderBottom: '1px solid #e0e0e0', 
                backgroundColor: COLORS.HEADER_BG, 
                marginTop: isFullscreen ? '0px' : '35px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                position: 'relative', // For centering analytics
                minHeight: '65px'
            }}>
                {/* --- Left Side: Title --- */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: COLORS.TEXT_MAIN, letterSpacing: '-0.5px' }}>
                        Operator Performance
                    </Typography>
                </Box>

                {/* --- Center: Performance Analytics (Absolute Centering) --- */}
                <Box sx={{ 
                    position: 'absolute', 
                    left: '50%', 
                    top: '50%', 
                    transform: 'translate(-50%, -50%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 3 
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography sx={{ color: COLORS.TEXT_SUB, fontWeight: 800, fontSize: '0.85rem' }}>PREV OEE:</Typography>
                        <Chip 
                            label={`${summaryMetrics.prevShiftOee}%`} 
                            size="medium" 
                            sx={{ backgroundColor: getPerformanceColor(summaryMetrics.prevShiftOee), color: '#fff', fontWeight: 900, fontSize: '0.9rem', height: 28 }} 
                        />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography sx={{ color: COLORS.TEXT_SUB, fontWeight: 800, fontSize: '0.85rem' }}>CURRENT OEE:</Typography>
                        <Chip 
                            label={`${summaryMetrics.currentShiftOee}%`} 
                            size="medium" 
                            sx={{ backgroundColor: getPerformanceColor(summaryMetrics.currentShiftOee), color: '#fff', fontWeight: 900, fontSize: '0.9rem', height: 28 }} 
                        />
                        {summaryMetrics.currentShiftOee !== summaryMetrics.prevShiftOee && (
                            <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                                {summaryMetrics.currentShiftOee > summaryMetrics.prevShiftOee ? (
                                    <Typography sx={{ color: 'green', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center' }}>
                                        <ArrowUpIcon sx={{ fontSize: '1.2rem' }} /> {summaryMetrics.currentShiftOee - summaryMetrics.prevShiftOee}%
                                    </Typography>
                                ) : (
                                    <Typography sx={{ color: 'red', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center' }}>
                                        <ArrowDownIcon sx={{ fontSize: '1.2rem' }} /> {summaryMetrics.prevShiftOee - summaryMetrics.currentShiftOee}%
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                </Box>
                
                {/* --- Right Side: Shift Info + Controls --- */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {currentShiftInfo && (
                        <Typography sx={{ color: COLORS.TEXT_SUB, fontWeight: 700, fontSize: '0.95rem', mr: 2 }}>
                            Shift {currentShiftInfo.shiftNo} | {currentShiftInfo.date.format('DD MMM')}
                        </Typography>
                    )}

                    {showMachineGroupsDropdown && (
                        <FormControl size="small" sx={{ minWidth: 200 }}>
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
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Dashboard Settings">
                            <IconButton onClick={() => setIsSettingsOpen(true)} size="small" sx={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#fff' }}>
                                <SettingsIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                            <IconButton onClick={toggleFullscreen} size="small" sx={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#fff' }}>
                                {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {isLoading && <CircularProgress size={20} sx={{ color: COLORS.PRIMARY, ml: 1 }} />}
                </Box>
            </Box>

            {/* --- Main Content with Sidebar Partition --- */}
            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left side: Main Fleet Grid */}
                <Box sx={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                    <Grid container spacing={2}>
                        {filteredAndSortedData.map((m) => (
                            <Grid item xs={12} sm={6} md={4} lg={4} xl={3} key={m.id}>
                                <RenderMachineCard m={m} rank={null} />
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Right side Partition: Top 3 Performers */}
                <Box sx={{ 
                    width: 340, 
                    backgroundColor: '#fff', 
                    borderLeft: '1px solid #e0e0e0', 
                    display: 'flex', 
                    flexDirection: 'column',
                    p: 2,
                    overflowY: 'auto'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, pb: 1, borderBottom: '2px solid #f8f9fa' }}>
                        <TrophyIcon sx={{ color: COLORS.GOLD }} />
                        <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.TEXT_MAIN, fontSize: '1rem' }}>Top 3 Performers</Typography>
                    </Box>
                    <Stack spacing={2}>
                        {topPerformers.length > 0 ? (
                            topPerformers.map((m, index) => (
                                <Box key={m.id}>
                                    <RenderMachineCard m={m} rank={index + 1} />
                                </Box>
                            ))
                        ) : (
                            <Typography sx={{ textAlign: 'center', color: COLORS.TEXT_SUB, mt: 4, fontStyle: 'italic' }}>Calculating rankings...</Typography>
                        )}
                    </Stack>
                </Box>
            </Box>

            {/* --- Settings Dialog --- */}
            <Dialog 
                open={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                maxWidth="xs" 
                fullWidth
                container={dashboardRef.current}
            >
                <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid #eee' }}>Dashboard Preferences</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Performance Thresholds (%)</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                        <TextField 
                            label="Bad (Red < )" 
                            type="number" 
                            size="small" 
                            value={thresholds.bad} 
                            onChange={(e) => setSettings({...settings, thresholds: {...thresholds, bad: Number(e.target.value)}})}
                        />
                        <TextField 
                            label="Normal (Yellow < )" 
                            type="number" 
                            size="small" 
                            value={thresholds.normal} 
                            onChange={(e) => setSettings({...settings, thresholds: {...thresholds, normal: Number(e.target.value)}})}
                        />
                    </Box>

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Grid Sorting Order</Typography>
                    <RadioGroup 
                        value={sortOrder} 
                        onChange={(e) => setSettings({...settings, sortOrder: e.target.value})}
                    >
                        <FormControlLabel value="asc" control={<Radio size="small" />} label="Lowest Performance First (Ascending)" />
                        <FormControlLabel value="desc" control={<Radio size="small" />} label="Highest Performance First (Descending)" />
                    </RadioGroup>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Status Filters</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {STATUS_OPTIONS.map(status => (
                            <FormControlLabel
                                key={status}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={selectedStatuses.includes(status)}
                                        onChange={() => handleStatusFilterChange(status)}
                                    />
                                }
                                label={status}
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid #eee', justifyContent: 'space-between' }}>
                    <Button onClick={handleReset} sx={{ color: COLORS.ALARM, fontWeight: 700 }}>Reset Defaults</Button>
                    <Box>
                        <Button onClick={() => setIsSettingsOpen(false)} sx={{ color: COLORS.TEXT_SUB }}>Cancel</Button>
                        <Button onClick={handleSettingsSave} variant="contained" sx={{ backgroundColor: COLORS.PRIMARY, '&:hover': { backgroundColor: '#d16602' }, ml: 1 }}>Save Changes</Button>
                    </Box>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
