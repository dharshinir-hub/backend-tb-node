import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Button,
    CircularProgress,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Drawer,
    Divider,
    TablePagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
    customerbaseddevices,
    customerbasedshift,
} from '../../Services/app/companyservice';
import { shiftadd } from '../../Services/app/masterservice';
import { telemetrykeydata } from '../../Services/app/operatorservice';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';
import {
    TWENTY_HOURS_SECONDS,
    timeToSeconds,
    getShiftTimes,
    buildShiftTimeRanges,
    filterByShift,
    getLatestDataPoint,
    isAutoHoliday,
} from '../../Shared/utils/holidaycalculation';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtHours(secs) {
    const totalSecs = Math.round(secs);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h}h ${m}m ${s}s`;
}

function fmtPct(val) {
    return val.toFixed(1) + '%';
}

const STATUS = {
    production: {
        label: 'Production Day',
        bg: '#e6f4ea',
        color: '#1e7e34',
        border: '#b7dfc3',
    },
    holiday: {
        label: 'Holiday',
        bg: '#fff3e0',
        color: '#e55812',
        border: '#ffcc80',
    },
};

function StatusPill({ status }) {
    const s = STATUS[status];
    return (
        <span style={{
            background: s.bg,
            color: s.color,
            border: `1px solid ${s.border}`,
            fontWeight: 700,
            borderRadius: 20,
            padding: '3px 14px',
            fontSize: 12,
            display: 'inline-block',
            whiteSpace: 'nowrap',
        }}>
            {s.label}
        </span>
    );
}

export default function HolidayList() {
    const customerId = localStorage.getItem('CustomerID');

    const [devices, setDevices] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [startDate, setStartDate] = useState(dayjs().startOf('month'));
    const [endDate, setEndDate] = useState(dayjs());
    const [isLoading, setIsLoading] = useState(false);

    const [dateRows, setDateRows] = useState([]);

    const [viewMode, setViewMode] = useState('all');
    const [sortKey, setSortKey] = useState('date');
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // ── Manual overrides 
    const [manualHolidays, setManualHolidays] = useState(new Set());
    const [manualProductionDays, setManualProductionDays] = useState(new Set());
    const [shiftManualHolidays, setShiftManualHolidays] = useState(new Map());
    const [shiftManualProductionDays, setShiftManualProductionDays] = useState(new Map());
    const overridesRef = useRef({
        manualHolidays, manualProductionDays, shiftManualHolidays, shiftManualProductionDays,
    });
    const persistTimer = useRef(null);

    const mapToObj = (m) => {
        const o = {};
        for (const [k, set] of m) {
            const arr = Array.from(set);
            if (arr.length) o[k] = arr;
        }
        return o;
    };

    // Fetch manual_holiday data from customer telemetry attributes and
    // hydrate local override state.
    const fetchManualOverrides = useCallback(async () => {
        if (!customerId) return;
        // { [shiftNo]: date[] } → Map<shiftNo, Set<date>>
        const objToMap = (obj) => {
            const m = new Map();
            if (obj && typeof obj === 'object') {
                for (const k of Object.keys(obj)) m.set(String(k), new Set(obj[k] || []));
            }
            return m;
        };
        let loaded;
        try {
            const res = await customerbasedshift(customerId, 'manual_holiday');
            const val = res[0]?.value || {};
            loaded = {
                manualHolidays: new Set(val.manualHolidays || []),
                manualProductionDays: new Set(val.manualProductionDays || []),
                shiftManualHolidays: objToMap(val.shiftManualHolidays),
                shiftManualProductionDays: objToMap(val.shiftManualProductionDays),
            };
        } catch {
            loaded = {
                manualHolidays: new Set(),
                manualProductionDays: new Set(),
                shiftManualHolidays: new Map(),
                shiftManualProductionDays: new Map(),
            };
        }
        overridesRef.current = loaded;
        setManualHolidays(loaded.manualHolidays);
        setManualProductionDays(loaded.manualProductionDays);
        setShiftManualHolidays(loaded.shiftManualHolidays);
        setShiftManualProductionDays(loaded.shiftManualProductionDays);
    }, [customerId]);

    const persistManualOverrides = useCallback(async () => {
        if (!customerId) return;
        const cur = overridesRef.current;
        try {
            const formData = {
                manual_holiday: {
                    manualHolidays: Array.from(cur.manualHolidays),
                    manualProductionDays: Array.from(cur.manualProductionDays),
                    shiftManualHolidays: mapToObj(cur.shiftManualHolidays),
                    shiftManualProductionDays: mapToObj(cur.shiftManualProductionDays),
                    lastUpdateTs: Date.now(),
                },
            };
            await shiftadd(formData, customerId, 'SERVER_SCOPE');
            // Re-fetch from customer telemetry so local state reflects what
            // was actually persisted on the server.
            await fetchManualOverrides();
        } catch (error) {
            console.error('Failed to save manual holiday overrides:', error);
        }
    }, [customerId, fetchManualOverrides]);

    const schedulePersist = useCallback(() => {
        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(() => {
            persistTimer.current = null;
            persistManualOverrides();
        }, 400);
    }, [persistManualOverrides]);
    useEffect(() => () => { if (persistTimer.current) clearTimeout(persistTimer.current); }, []);

    // Apply a manual override for a given date/type. `activeShifts` is the set of
    // shift numbers that should be marked; an empty set clears the override, a full
    // set is stored as a whole-day override.
    const commitOverride = (date, type, activeShifts) => {
        const totalShifts = shifts.length;
        const isAll = totalShifts > 0 && activeShifts.size >= totalShifts;

        const wholeKey    = type === 'holiday' ? 'manualHolidays'        : 'manualProductionDays';
        const oppWholeKey = type === 'holiday' ? 'manualProductionDays'  : 'manualHolidays';
        const shiftKey    = type === 'holiday' ? 'shiftManualHolidays'   : 'shiftManualProductionDays';
        const oppShiftKey = type === 'holiday' ? 'shiftManualProductionDays' : 'shiftManualHolidays';

        const cur = overridesRef.current;

        const stripDate = (map) => {
            const next = new Map();
            for (const [n, set] of map) {
                const ns = new Set(set);
                ns.delete(date);
                if (ns.size) next.set(n, ns);
            }
            return next;
        };

        const whole = new Set(cur[wholeKey]); whole.delete(date);
        const shiftMap = stripDate(cur[shiftKey]);

        const oppWhole = new Set(cur[oppWholeKey]);
        let oppShiftMap = cur[oppShiftKey];
        if (activeShifts.size > 0) {
            oppWhole.delete(date);
            oppShiftMap = stripDate(cur[oppShiftKey]);
        } else {
            oppShiftMap = new Map(cur[oppShiftKey]);
        }

        if (isAll) {
            whole.add(date);
        } else if (activeShifts.size > 0) {
            for (const n of activeShifts) {
                const ns = new Set(shiftMap.get(n) || []);
                ns.add(date);
                shiftMap.set(n, ns);
            }
        }

        cur[wholeKey] = whole;
        cur[oppWholeKey] = oppWhole;
        cur[shiftKey] = shiftMap;
        cur[oppShiftKey] = oppShiftMap;

        setManualHolidays(cur.manualHolidays);
        setManualProductionDays(cur.manualProductionDays);
        setShiftManualHolidays(cur.shiftManualHolidays);
        setShiftManualProductionDays(cur.shiftManualProductionDays);
        schedulePersist();
    };

    const [aiOpen, setAiOpen] = useState(false);
    const [aiText, setAiText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const aiScrollRef = useRef(null);

    const {
        deviceNameID,
        machineGroups,
        availableMachines,
        selectedMachines,
        selectedGroups,
        showMachineGroupsDropdown,
        isAllMachinesSelected,
        handleGroupChange,
        handleMachineChange,
    } = useMachineGroups(customerId);


    // Live summary — recomputes whenever dateRows or any override changes
    const summary = React.useMemo(() => {
        if (!dateRows.length) return null;

        let extraExcludedSecs = 0;
        let restoredSecs = 0;

        for (const row of dateRows) {
            for (const s of shifts) {
                const sNo = String(s.shift_no);
                const isShiftHol = shiftManualHolidays.get(sNo)?.has(row.date) ?? false;
                const isShiftProd = shiftManualProductionDays.get(sNo)?.has(row.date) ?? false;
                const t = getShiftTimes(shifts, sNo, dayjs(row.date));
                if (!t.from || !t.to) continue;
                const raw = Math.floor((t.to - t.from) / 1000);
                const sd = shifts.find(x => String(x.shift_no) === sNo);
                const brk = sd ? timeToSeconds(sd.break_time || '00:00:00') : 0;
                const netSecs = Math.max(0, raw - brk) * selectedMachines.length;

                if (row.targetExcluded && isShiftProd && !isShiftHol) {
                    restoredSecs += netSecs;
                } else if (!row.targetExcluded && isShiftHol && !isShiftProd) {
                    extraExcludedSecs += netSecs;
                }
            }
        }

        // Production rows: whole-day holiday → excluded; whole-day manual production → included
        const productionRows = dateRows.filter(row => {
            if (manualProductionDays.has(row.date)) return true;
            return !row.targetExcluded;
        });

        // For each production row, subtract exact run seconds of any shifts manually marked as holiday
        let adjustedProductionRunSecs = 0;
        let adjustedRunPctSum = 0;

        for (const row of productionRows) {
            let excludedShiftRunSecs = 0;
            let excludedShiftExpectedSecs = 0;

            for (const s of shifts) {
                const sNo = String(s.shift_no);
                const isShiftExcluded =
                    (shiftManualHolidays.get(sNo)?.has(row.date) ?? false) &&
                    !(shiftManualProductionDays.get(sNo)?.has(row.date) ?? false);
                if (!isShiftExcluded) continue;
                excludedShiftRunSecs += (row.shiftRunSecs?.[sNo] || 0);
                const t = getShiftTimes(shifts, sNo, dayjs(row.date));
                if (t.from && t.to) {
                    const raw = Math.floor((t.to - t.from) / 1000);
                    const sd = shifts.find(x => String(x.shift_no) === sNo);
                    const brk = sd ? timeToSeconds(sd.break_time || '00:00:00') : 0;
                    excludedShiftExpectedSecs += Math.max(0, raw - brk) * selectedMachines.length;
                }
            }

            const adjRunSecs = Math.max(0, row.runSecs - excludedShiftRunSecs);
            const adjExpectedSecs = Math.max(0, row.expectedSecs - excludedShiftExpectedSecs);
            const adjRunPct = adjExpectedSecs > 0 ? (adjRunSecs / adjExpectedSecs) * 100 : row.runPct;

            adjustedProductionRunSecs += adjRunSecs;
            adjustedRunPctSum += adjRunPct;
        }

        const holidayDays = dateRows.length - productionRows.length;
        const productionDays = productionRows.length;
        const totalExpectedSecs = dateRows.reduce((s, r) => s + r.expectedSecs, 0);
        const wholeDayExcludedSecs = dateRows.filter(r => r.targetExcluded).reduce((s, r) => s + r.expectedSecs, 0);
        const adjustedExcludedSecs = Math.max(0, wholeDayExcludedSecs + extraExcludedSecs - restoredSecs);

        return {
            totalDays: dateRows.length,
            productionDays,
            holidayDays,
            totalRunHours: dateRows.reduce((s, r) => s + r.runSecs, 0),
            avgRunPct: dateRows.length ? dateRows.reduce((s, r) => s + r.runPct, 0) / dateRows.length : 0,
            productionRunHours: adjustedProductionRunSecs,
            productionAvgRunPct: productionRows.length ? adjustedRunPctSum / productionRows.length : 0,
            totalExpectedSecs,
            actualTotalSecs: totalExpectedSecs - adjustedExcludedSecs,
            excludedSecs: adjustedExcludedSecs,
        };
    }, [dateRows, shifts, shiftManualHolidays, shiftManualProductionDays, manualHolidays, manualProductionDays, selectedMachines]);


    const fetchShifts = useCallback(async () => {
        if (!customerId) return;
        try {
            const res = await customerbasedshift(customerId, 'allShift');
            setShifts(res[0]?.value || []);
        } catch { setShifts([]); }
    }, [customerId]);

    const fetchDevices = useCallback(async () => {
        if (!customerId) return;
        try {
            const res = await customerbaseddevices(customerId, 100, 0);
            setDevices(res.data || []);
        } catch { setDevices([]); }
    }, [customerId]);

    const fetchTelemetry = useCallback(async (id, keys, from, to) => {
        try { return await telemetrykeydata(id, 'DEVICE', keys, from, to); }
        catch { return null; }
    }, []);

    // ── main analysis 

    const runAnalysis = useCallback(async () => {
        if (!shifts.length || !customerId || !startDate || !endDate) return;
        if (selectedMachines.length === 0) return;

        const analysisRanges = buildShiftTimeRanges(shifts, 'allshift', startDate, endDate);
        if (!analysisRanges.length) return;

        const overallFrom = analysisRanges[0].from;
        const overallTo = analysisRanges[analysisRanges.length - 1].to;

        const selectedDeviceIds = deviceNameID
            .filter(dv => selectedMachines.includes(dv.name))
            .map(dv => dv.id);
        if (!selectedDeviceIds.length) return;

        const machineData = new Map();
        await Promise.all(selectedDeviceIds.map(async id => {
            const data = await fetchTelemetry(id, ['total_duration'], overallFrom, overallTo);
            machineData.set(id, data);
        }));

        const allDates = new Set(analysisRanges.map(r => r.date));

        // Per-device, per-date and per-device, per-date-shift: accumulate run / alarm / idle / disconnect
        const byDateRun = new Map();
        const byDateAlarm = new Map();
        const byDateIdle = new Map();
        const byDateDisc = new Map();
        const byShiftDateRun = new Map(); // key: `${deviceId}-${date}-${shiftNo}`

        for (const deviceId of selectedDeviceIds) {
            const rawData = machineData.get(deviceId);
            for (const r of analysisRanges) {
                const data = filterByShift(rawData, r.from, r.to);
                const latest = getLatestDataPoint(data?.total_duration);
                if (!latest?.value) continue;
                try {
                    const parsed = JSON.parse(latest.value);
                    const key = `${deviceId}-${r.date}`;
                    byDateRun.set(key, (byDateRun.get(key) || 0) + (parsed.total_run_duration || 0));
                    byDateAlarm.set(key, (byDateAlarm.get(key) || 0) + (parsed.total_alarm_duration || 0));
                    byDateIdle.set(key, (byDateIdle.get(key) || 0) + (parsed.total_idle_duration || 0));
                    byDateDisc.set(key, (byDateDisc.get(key) || 0) + (parsed.total_disconnect_duration || 0));
                    const shiftKey = `${deviceId}-${r.date}-${r.shiftNo}`;
                    byShiftDateRun.set(shiftKey, (byShiftDateRun.get(shiftKey) || 0) + (parsed.total_run_duration || 0));
                } catch { /* skip */ }
            }
        }

        // Total per date across selected machines
        const totalRunByDate = new Map();
        const totalAlarmByDate = new Map();
        const totalIdleByDate = new Map();
        const totalDiscByDate = new Map();
        // Total run per date-shift across selected machines
        const totalRunByShiftDate = new Map(); // key: `${date}-${shiftNo}`

        for (const date of allDates) {
            let run = 0, alarm = 0, idle = 0, disc = 0;
            for (const id of selectedDeviceIds) {
                const key = `${id}-${date}`;
                run += byDateRun.get(key) || 0;
                alarm += byDateAlarm.get(key) || 0;
                idle += byDateIdle.get(key) || 0;
                disc += byDateDisc.get(key) || 0;
            }
            totalRunByDate.set(date, run);
            totalAlarmByDate.set(date, alarm);
            totalIdleByDate.set(date, idle);
            totalDiscByDate.set(date, disc);
        }
        for (const r of analysisRanges) {
            const sdKey = `${r.date}-${r.shiftNo}`;
            let shiftRun = 0;
            for (const id of selectedDeviceIds) {
                shiftRun += byShiftDateRun.get(`${id}-${r.date}-${r.shiftNo}`) || 0;
            }
            totalRunByShiftDate.set(sdKey, (totalRunByShiftDate.get(sdKey) || 0) + shiftRun);
        }

        const todayDateStr = dayjs().format('YYYY-MM-DD');
        const nowMs = Date.now();

        const expectedForClassification = new Map();
        const expectedByDate = new Map();
        for (const r of analysisRanges) {
            const rawSecs = Math.floor((r.to - r.from) / 1000);
            const sd = shifts.find(s => String(s.shift_no) === String(r.shiftNo));
            const breakSecs = sd ? timeToSeconds(sd.break_time || '00:00:00') : 0;
            const net = Math.max(0, rawSecs - breakSecs);

            expectedByDate.set(r.date, (expectedByDate.get(r.date) || 0) + net * selectedDeviceIds.length);
            if (r.date === todayDateStr && r.from > nowMs) continue;
            expectedForClassification.set(r.date, (expectedForClassification.get(r.date) || 0) + net * selectedDeviceIds.length);
        }

        // Classify each date using whole-day (all-shift) condition
        const rows = [];
        for (const date of Array.from(allDates).sort()) {
            const run = totalRunByDate.get(date) || 0;
            const expectedClassify = expectedForClassification.get(date) || 1;
            const expectedFull = expectedByDate.get(date) || expectedClassify;
            const alarm = totalAlarmByDate.get(date) || 0;
            const idle = totalIdleByDate.get(date) || 0;
            const disc = totalDiscByDate.get(date) || 0;
            const downtime = alarm + idle + disc;
            const runPct = (run / expectedClassify) * 100;
            const autoHoliday = isAutoHoliday(run, downtime, runPct);

            const isHoliday = (autoHoliday || manualHolidays.has(date)) && !manualProductionDays.has(date);
            const isManualOverride = !autoHoliday && manualHolidays.has(date) && !manualProductionDays.has(date);

            const dayObj = dayjs(date);
            // Per-shift run seconds for exact subtraction when a single shift is overridden
            const shiftRunSecs = {};
            for (const s of shifts) {
                shiftRunSecs[String(s.shift_no)] = totalRunByShiftDate.get(`${date}-${String(s.shift_no)}`) || 0;
            }
            rows.push({
                date,
                dayName: DAY_NAMES[dayObj.day()],
                dayOfMonth: dayObj.date(),
                targetExcluded: isHoliday,
                isManualOverride,
                month: dayObj.format('MMM YYYY'),
                runSecs: run,
                shiftRunSecs,
                expectedSecs: expectedFull,
                runPct,
                alarmSecs: alarm,
                idleSecs: idle,
                discSecs: disc,
                downtimeSecs: downtime,
                autoStatus: autoHoliday ? 'holiday' : 'production',
                status: isHoliday ? 'holiday' : 'production',
            });
        }

        setDateRows(rows);
    }, [shifts, customerId, startDate, endDate, deviceNameID, selectedMachines,
        fetchTelemetry, manualHolidays, manualProductionDays]);

    const handleSubmit = useCallback(async () => {
        setIsLoading(true);
        try { await runAnalysis(); }
        finally { setIsLoading(false); }
    }, [runAnalysis]);

    const fetchAiSuggestions = useCallback(async () => {
        if (!dateRows.length) return;
        setAiOpen(true);
        setAiText('');
        setAiLoading(true);

        const holidayDays = dateRows.filter(r => r.status === 'holiday');
        const productionDays = dateRows.filter(r => r.status === 'production');

        const prompt = `You are an industrial production efficiency expert. Analyse the following factory production data and give clear, actionable suggestions to improve production utilisation and reduce unplanned downtime.

DATA SUMMARY (${startDate.format('DD-MM-YYYY')} to ${endDate.format('DD-MM-YYYY')}):
- Total days analysed: ${dateRows.length}
- Production days: ${productionDays.length}
- Holiday days (target excluded): ${holidayDays.length}
- Total expected hours: ${fmtHours(summary?.totalExpectedSecs || 0)} hrs
- Actual total hours: ${fmtHours(summary?.actualTotalSecs || 0)} hrs
- Excluded hours (holidays): ${fmtHours(summary?.excludedSecs || 0)} hrs
- Average run %: ${fmtPct(summary?.avgRunPct || 0)}

HOLIDAY / EXCLUDED DATES (Run% ≤ 20% AND Alarm+Idle+Disconnect > 20 hrs):
${holidayDays.map(r =>
    `  • ${r.date} (${r.dayName}): Run ${fmtPct(r.runPct)}, Alarm ${fmtHours(r.alarmSecs)}h, Idle ${fmtHours(r.idleSecs)}h, Disconnect ${fmtHours(r.discSecs)}h, Downtime ${fmtHours(r.downtimeSecs)}h`
).join('\n') || '  None'}

LOW PRODUCTION DAYS (Run% < 50%):
${productionDays.filter(r => r.runPct < 50).map(r =>
    `  • ${r.date} (${r.dayName}): Run ${fmtPct(r.runPct)}, Alarm ${fmtHours(r.alarmSecs)}h, Idle ${fmtHours(r.idleSecs)}h`
).join('\n') || '  None'}

Please provide:
1. Key observations about the holiday/downtime patterns
2. Root cause analysis based on alarm, idle, and disconnect hours
3. Specific actionable recommendations to reduce unplanned downtime
4. Suggestions to improve run% on low-production days
5. Preventive maintenance or scheduling suggestions

Be concise, practical, and structured with clear headings.`;

        try {
            const apiKey = window._env_?.CLAUDE_API_KEY || '';
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    stream: true,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                setAiText(`Error: ${response.status} — ${err}`);
                setAiLoading(false);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed?.delta?.text || '';
                        if (delta) {
                            accumulated += delta;
                            setAiText(accumulated);
                            if (aiScrollRef.current) {
                                aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
                            }
                        }
                    } catch { /* skip non-JSON lines */ }
                }
            }
        } catch (err) {
            setAiText(`Failed to reach Claude API: ${err.message}`);
        } finally {
            setAiLoading(false);
        }
    }, [dateRows, summary, startDate, endDate]);

    // ── effects 

    useEffect(() => {
        if (customerId) Promise.all([fetchShifts(), fetchDevices(), fetchManualOverrides()]);
    }, [customerId, fetchShifts, fetchDevices, fetchManualOverrides]);

    // Auto-submit once on initial load when shifts and machines are ready
    const autoSubmittedRef = useRef(false);
    useEffect(() => {
        if (autoSubmittedRef.current) return;
        if (shifts.length && selectedMachines.length) {
            autoSubmittedRef.current = true;
            handleSubmit();
        }
    }, [shifts, selectedMachines, handleSubmit]);

    const filteredRows = viewMode === 'all' ? dateRows
        : dateRows.filter(r => r.status === viewMode);

    const sortedRows = [...filteredRows].sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
        setPage(0);
    };

    const exportCSV = () => {
        const headers = ['Date', 'Day', 'Status', 'Run %', 'Run Hrs', 'Alarm Hrs', 'Idle Hrs', 'Disconnect Hrs', 'Downtime Hrs', 'Expected Hrs', 'Excluded Hrs'];
        const dataRows = sortedRows.map(r => [
            r.date,
            r.dayName,
            r.status === 'holiday' ? 'Holiday' : 'Production Day',
            fmtPct(r.runPct),
            fmtHours(r.runSecs),
            fmtHours(r.alarmSecs),
            fmtHours(r.idleSecs),
            fmtHours(r.discSecs),
            fmtHours(r.downtimeSecs),
            fmtHours(r.expectedSecs),
            r.targetExcluded ? fmtHours(r.expectedSecs) : '—',
        ]);
        const totalsRow = [
            `TOTAL (${sortedRows.length} days)`, '',
            `${sortedRows.filter(r => r.status === 'production').length}P / ${sortedRows.filter(r => r.status === 'holiday').length}H`,
            fmtPct(sortedRows.reduce((s, r) => s + r.runPct, 0) / (sortedRows.length || 1)),
            fmtHours(sortedRows.reduce((s, r) => s + r.runSecs, 0)),
            fmtHours(sortedRows.reduce((s, r) => s + r.alarmSecs, 0)),
            fmtHours(sortedRows.reduce((s, r) => s + r.idleSecs, 0)),
            fmtHours(sortedRows.reduce((s, r) => s + r.discSecs, 0)),
            fmtHours(sortedRows.reduce((s, r) => s + r.downtimeSecs, 0)),
            fmtHours(sortedRows.reduce((s, r) => s + r.expectedSecs, 0)),
            fmtHours(sortedRows.filter(r => r.targetExcluded).reduce((s, r) => s + r.expectedSecs, 0)),
        ];
        const csv = [headers, ...dataRows, totalsRow]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `holiday-list-${startDate.format('DDMMYYYY')}-${endDate.format('DDMMYYYY')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });

        loadScript('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js')
            .then(() => loadScript('https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'))
            .then(() => {
                const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
                if (!jsPDF) { alert('PDF library failed to load. Check your internet connection and try again.'); return; }
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const pw = doc.internal.pageSize.getWidth();
                const ph = doc.internal.pageSize.getHeight();
                const ml = 12, mr = 12;
                const uw = pw - ml - mr;
                let y = 14;

                // ── Title
                doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(33, 33, 33);
                doc.text('Production & Holiday Calendar', ml, y);
                y += 6;
                doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
                doc.text(`Holiday = Run% <= 20% AND (Alarm + Idle + Disconnect) > 20 hrs  |  ${startDate.format('DD-MM-YYYY')} to ${endDate.format('DD-MM-YYYY')}`, ml, y);
                y += 9;

                // ── Summary cards
                const cards = [
                    { label: 'Total Days',          value: String(summary.totalDays),              color: [33, 150, 243] },
                    { label: 'Production Days',     value: String(summary.productionDays),          color: [76, 175, 80]  },
                    { label: 'Holiday Days',value: String(summary.holidayDays),             color: [244, 67, 54]  },
                    { label: 'Total Run Hours',     value: fmtHours(summary.totalRunHours),         color: [156, 39, 176] },
                    { label: 'Avg Run %',           value: fmtPct(summary.avgRunPct),               color: [255, 152, 0]  },
                ];
                const cardW = (uw - 4 * 3) / 5;
                const cardH = 20;
                cards.forEach((card, i) => {
                    const cx = ml + i * (cardW + 3);
                    doc.setFillColor(250, 250, 250);
                    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
                    doc.setFillColor(...card.color);
                    doc.rect(cx, y, cardW, 1.5, 'F');
                    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...card.color);
                    doc.text(card.value, cx + cardW / 2, y + 10, { align: 'center' });
                    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130);
                    doc.text(card.label, cx + cardW / 2, y + 16, { align: 'center' });
                });
                y += cardH + 6;

                // ── Legend row
                doc.setFillColor(249, 249, 249);
                doc.roundedRect(ml, y, uw, 10, 2, 2, 'F');
                let lx = ml + 4;
                const ly = y + 6.5;

                const drawPill = (label, bg, textCol, borderCol, width) => {
                    doc.setFillColor(...bg); doc.roundedRect(lx, y + 2, width, 6, 3, 3, 'F');
                    doc.setDrawColor(...borderCol); doc.roundedRect(lx, y + 2, width, 6, 3, 3, 'S');
                    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textCol);
                    doc.text(label, lx + width / 2, ly, { align: 'center' });
                    lx += width + 4;
                };
                drawPill('Production Day',  [230,244,234], [30,126,52],  [183,223,195], 28);
                drawPill('Holiday', [255,243,224], [216,67,21],  [255,204,128], 26);

                doc.setDrawColor(220, 220, 220); doc.line(lx, y + 2, lx, y + 8); lx += 4;

                const infoItems = [
                    { label: 'Expected:', value: fmtHours(summary.totalExpectedSecs), col: [33,150,243] },
                    { label: 'Actual:',   value: fmtHours(summary.actualTotalSecs),   col: [76,175,80]  },
                    ...(summary.excludedSecs > 0 ? [{ label: 'Excluded:', value: fmtHours(summary.excludedSecs), col: [216,67,21] }] : []),
                ];
                infoItems.forEach(item => {
                    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150,150,150);
                    doc.text(item.label, lx, ly);
                    lx += doc.getTextWidth(item.label) + 1;
                    doc.setFont('helvetica', 'bold'); doc.setTextColor(...item.col);
                    doc.text(item.value, lx, ly);
                    lx += doc.getTextWidth(item.value) + 6;
                });
                y += 16;

                // ── Calendar strips
                const tileSize = 7, tileGap = 1.5;
                const monthGroupsForPDF = sortedRows.reduce((acc, row) => {
                    if (!acc[row.month]) acc[row.month] = [];
                    acc[row.month].push(row);
                    return acc;
                }, {});

                Object.entries(monthGroupsForPDF).forEach(([month, rows]) => {
                    const rowsNeeded = Math.ceil(rows.length / Math.floor(uw / (tileSize + tileGap)));
                    const neededH = 8 + rowsNeeded * (tileSize + tileGap) + 4;
                    if (y + neededH > ph - 20) { doc.addPage(); y = 14; }

                    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(85, 85, 85);
                    doc.text(month, ml, y + 4);
                    doc.setFont('helvetica', 'normal'); doc.setTextColor(170, 170, 170); doc.setFontSize(7);
                    const prodC = rows.filter(r => r.status === 'production').length;
                    const holC  = rows.filter(r => r.status === 'holiday').length;
                    doc.text(`${prodC} production  ·  ${holC} holiday`, ml + doc.getTextWidth(month) + 3, y + 4);
                    y += 7;

                    let tx = ml;
                    rows.forEach(row => {
                        const isHol = row.status === 'holiday';
                        doc.setFillColor(...(isHol ? [255,243,224] : [230,244,234]));
                        doc.roundedRect(tx, y, tileSize, tileSize, 1, 1, 'F');
                        doc.setDrawColor(...(isHol ? [255,204,128] : [183,223,195]));
                        doc.roundedRect(tx, y, tileSize, tileSize, 1, 1, 'S');
                        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
                        doc.setTextColor(...(isHol ? [216,67,21] : [30,126,52]));
                        doc.text(String(row.dayOfMonth), tx + tileSize / 2, y + 4.2, { align: 'center' });
                        doc.setFontSize(5); doc.setFont('helvetica', 'normal');
                        doc.text(row.dayName, tx + tileSize / 2, y + 6.3, { align: 'center' });
                        tx += tileSize + tileGap;
                        if (tx + tileSize > ml + uw) { tx = ml; y += tileSize + tileGap; }
                    });
                    y += tileSize + 5;
                });

                // ── Table heading
                if (y + 30 > ph - 10) { doc.addPage(); y = 14; }
                doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(68, 68, 68);
                doc.text(`Detailed Breakdown — ${sortedRows.length} day${sortedRows.length !== 1 ? 's' : ''}`, ml, y);
                y += 4;

                // ── autoTable
                const tableBody = sortedRows.map(row => [
                    row.date, row.dayName,
                    row.status === 'holiday' ? 'Holiday' : 'Production',
                    fmtPct(row.runPct),
                    fmtHours(row.runSecs), fmtHours(row.alarmSecs), fmtHours(row.idleSecs),
                    fmtHours(row.discSecs), fmtHours(row.downtimeSecs),
                    fmtHours(row.expectedSecs),
                    row.targetExcluded ? fmtHours(row.expectedSecs) : '—',
                ]);
                tableBody.push([
                    `TOTAL (${sortedRows.length}d)`, '',
                    `${sortedRows.filter(r=>r.status==='production').length}P/${sortedRows.filter(r=>r.status==='holiday').length}H`,
                    fmtPct(sortedRows.reduce((s,r)=>s+r.runPct,0)/(sortedRows.length||1)),
                    fmtHours(sortedRows.reduce((s,r)=>s+r.runSecs,0)),
                    fmtHours(sortedRows.reduce((s,r)=>s+r.alarmSecs,0)),
                    fmtHours(sortedRows.reduce((s,r)=>s+r.idleSecs,0)),
                    fmtHours(sortedRows.reduce((s,r)=>s+r.discSecs,0)),
                    fmtHours(sortedRows.reduce((s,r)=>s+r.downtimeSecs,0)),
                    fmtHours(sortedRows.reduce((s,r)=>s+r.expectedSecs,0)),
                    fmtHours(sortedRows.filter(r=>r.targetExcluded).reduce((s,r)=>s+r.expectedSecs,0)),
                ]);

                doc.autoTable({
                    startY: y,
                    margin: { left: ml, right: mr },
                    styles: { fontSize: 7, cellPadding: 2, lineColor: [240,240,240], lineWidth: 0.2 },
                    headStyles: { fillColor: [245,247,250], textColor: [85,85,85], fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [252,252,252] },
                    head: [['Date','Day','Status','Run %','Run Hrs','Alarm Hrs','Idle Hrs','Disc Hrs','Downtime Hrs','Expected Hrs','Excluded Hrs']],
                    body: tableBody,
                    columnStyles: {
                        0:{halign:'left'}, 1:{halign:'left'}, 2:{halign:'center'},
                        3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'},
                        6:{halign:'right'}, 7:{halign:'right'}, 8:{halign:'right'},
                        9:{halign:'right'}, 10:{halign:'right'},
                    },
                    didParseCell: (data) => {
                        const row = sortedRows[data.row.index];
                        if (data.section === 'body' && row) {
                            if (data.column.index === 3) data.cell.styles.textColor = row.runPct <= 20 ? [216,67,21] : [30,126,52];
                            if (data.column.index === 5 && row.alarmSecs > 0) data.cell.styles.textColor = [216,67,21];
                            if (data.column.index === 8 && row.downtimeSecs > TWENTY_HOURS_SECONDS) data.cell.styles.textColor = [216,67,21];
                            if (data.column.index === 10 && row.targetExcluded) data.cell.styles.textColor = [216,67,21];
                        }
                        if (data.row.index === sortedRows.length) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [245,247,250];
                        }
                    },
                });

                doc.save(`holiday-list-${startDate.format('DDMMYYYY')}-${endDate.format('DDMMYYYY')}.pdf`);
            })
            .catch(() => alert('Failed to load PDF library. Check your internet connection.'));
    };

    const monthGroups = sortedRows.reduce((acc, row) => {
        if (!acc[row.month]) acc[row.month] = [];
        acc[row.month].push(row);
        return acc;
    }, {});

    const COLUMNS = [
        { key: 'date', label: 'Date' },
        { key: 'dayName', label: 'Day' },
        { key: 'status', label: 'Status', align: 'center' },
        { key: 'manualHoliday', label: 'Override', align: 'center' },
    ];

    return (
        <>
        <div id="holiday-print-area" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 65px)', background: '#f4f6f8' }}>
            <div style={{
                padding: '20px 28px',
                borderBottom: '1px solid #e0e0e0',
                background: '#fff',
                marginTop: 30,
                flexShrink: 0,
            }}>
                {/* Primary row: title + date pickers + submit */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <h4 style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Production & Holiday Calendar</h4>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#999' }}>
                            Holiday = Run% ≤ 20% <b>AND</b> (Alarm + Idle + Disconnect) &gt; 20 hrs · based on all machines, all shifts
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                        {/* Groups dropdown */}
                        {/* {showMachineGroupsDropdown && (
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel sx={{ fontSize: 13 }}>Machine Group</InputLabel>
                                <Select
                                    multiple
                                    value={selectedGroups}
                                    onChange={e => handleGroupChange(e.target.value)}
                                    label="Machine Group"
                                    renderValue={selected => {
                                        if (selected.length === machineGroups.length) return 'All Groups';
                                        if (selected.length === 0) return 'Select Groups';
                                        return selected.slice(0, 2).join(', ') + (selected.length > 2 ? '…' : '');
                                    }}
                                    sx={{ fontSize: 14 }}
                                >
                                    <MenuItem value="all">
                                        <Checkbox checked={selectedGroups.length === machineGroups.length} />
                                        <ListItemText primary="All Groups" />
                                    </MenuItem>
                                    {machineGroups.map(g => (
                                        <MenuItem key={g.name} value={g.name}>
                                            <Checkbox checked={selectedGroups.includes(g.name)} />
                                            <ListItemText primary={g.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )} */}

                        {/* Machines dropdown */}
                        {/* <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Machines</InputLabel>
                            <Select
                                multiple
                                value={selectedMachines}
                                onChange={e => handleMachineChange(e.target.value)}
                                label="Machines"
                                renderValue={selected =>
                                    isAllMachinesSelected ? 'All Machines' :
                                        selected.slice(0, 2).join(', ') + (selected.length > 2 ? '…' : '')
                                }
                                sx={{ fontSize: 14 }}
                            >
                                <MenuItem value="all">
                                    <Checkbox checked={isAllMachinesSelected} />
                                    <ListItemText primary="All Machines" />
                                </MenuItem>
                                {availableMachines.map(machine => (
                                    <MenuItem key={machine} value={machine}>
                                        <Checkbox checked={selectedMachines.includes(machine)} />
                                        <ListItemText primary={machine} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl> */}

                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="From Date"
                                value={startDate}
                                onChange={val => {
                                    setStartDate(val);
                                    const max = val.add(3, 'month').subtract(1, 'day').isAfter(dayjs()) ? dayjs() : val.add(3, 'month').subtract(1, 'day');
                                    if (endDate.isAfter(max)) setEndDate(max);
                                }}
                                format="DD-MM-YYYY"
                                maxDate={dayjs()}
                                slotProps={{ textField: { size: 'small', sx: { minWidth: 155 } } }}
                            />
                        </LocalizationProvider>

                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="To Date"
                                value={endDate}
                                onChange={val => setEndDate(val)}
                                format="DD-MM-YYYY"
                                minDate={startDate}
                                maxDate={startDate.add(3, 'month').subtract(1, 'day').isAfter(dayjs()) ? dayjs() : startDate.add(3, 'month').subtract(1, 'day')}
                                slotProps={{ textField: { size: 'small', sx: { minWidth: 155 } } }}
                            />
                        </LocalizationProvider>

                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={isLoading || selectedMachines.length === 0 || !shifts.length}
                            sx={{
                                height: 40,
                                minWidth: 110,
                                background: '#f47803',
                                '&:hover': { background: '#e06d00' },
                                '&.Mui-disabled': { background: '#f4780350' },
                                textTransform: 'none',
                                fontWeight: 700,
                                gap: 1,
                            }}
                        >
                            {isLoading && <CircularProgress size={15} sx={{ color: '#fff' }} />}
                            {isLoading ? 'Loading…' : 'Analyse'}
                        </Button>

                        {/* {summary && (
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={exportCSV}
                                    sx={{
                                        height: 40,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        borderColor: '#4CAF50',
                                        color: '#4CAF50',
                                        '&:hover': { borderColor: '#388E3C', background: '#f1fff3', color: '#388E3C' },
                                    }}
                                >
                                    ⬇ CSV
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={exportPDF}
                                    sx={{
                                        height: 40,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        borderColor: '#e53935',
                                        color: '#e53935',
                                        '&:hover': { borderColor: '#b71c1c', background: '#fff5f5', color: '#b71c1c' },
                                    }}
                                >
                                    ⬇ PDF
                                </Button>
                            </>
                        )} */}
                    </div>
                </div>
            </div>

            {/* ── Body */}
            <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

                {isLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
                        <CircularProgress size={48} sx={{ color: '#f47803' }} />
                        <span style={{ color: '#888', fontSize: 14 }}>Analysing date range…</span>
                    </div>
                )}

                {!isLoading && !summary && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#bbb' }}>
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span style={{ fontSize: 14 }}>Select a date range and click <b>Analyse</b></span>
                    </div>
                )}

                {!isLoading && summary && (
                    <>
                        {/* ── Summary Cards */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
                            {[
                                { label: 'Total Days', value: summary.totalDays, color: '#2196F3', icon: '📅' },
                                { label: 'Production Days', value: summary.productionDays, color: '#4CAF50', icon: '🏭' },
                                { label: 'Holiday Days', value: summary.holidayDays, color: '#f44336', icon: '🔴' },
                                { label: 'Total Run Hours', value: fmtHours(summary.productionRunHours), color: '#9C27B0', icon: '⏱️' },
                                { label: 'Avg Run %', value: fmtPct(summary.productionAvgRunPct), color: '#FF9800', icon: '📊' },
                            ].map(card => (
                                <div key={card.label} style={{
                                    background: '#fff',
                                    borderRadius: 14,
                                    padding: '16px 22px',
                                    minWidth: 155,
                                    flex: '1 1 140px',
                                    boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
                                    borderTop: `4px solid ${card.color}`,
                                }}>
                                    <div style={{ fontSize: 22, marginBottom: 4 }}>{card.icon}</div>
                                    <div style={{ fontSize: card.label === 'Total Run Hours' ? 20 : 24, fontWeight: 700, color: card.color }}>{card.value}</div>
                                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{card.label}</div>
                                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>excl. holidays</div>
                                </div>
                            ))}
                        </div>

                        {/* ── Legend + View Toggle  */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <StatusPill status="production" />
                                <StatusPill status="holiday" />
                            </div>

                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <ToggleButtonGroup
                                    value={viewMode}
                                    exclusive
                                    onChange={(_, v) => { if (v) setViewMode(v); }}
                                    size="small"
                                    sx={{ background: '#fff', borderRadius: 2 }}
                                >
                                    <ToggleButton value="all" sx={{ textTransform: 'none', fontSize: 12 }}>All Days</ToggleButton>
                                    <ToggleButton value="production" sx={{ textTransform: 'none', fontSize: 12, color: '#1e7e34' }}>Production Only</ToggleButton>
                                    <ToggleButton value="holiday" sx={{ textTransform: 'none', fontSize: 12, color: '#d84315' }}>Holidays Only</ToggleButton>
                                </ToggleButtonGroup>
                            </div>
                        </div>

                        {/* ── Calendar strip  */}
                        {Object.entries(monthGroups).map(([month, rows]) => (
                            <div key={month} style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', padding: '4px 0 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span>{month}</span>
                                    <span style={{ fontSize: 11, fontWeight: 400, color: '#aaa' }}>
                                        {rows.filter(r => r.status === 'production').length} production &nbsp;·&nbsp;
                                        {rows.filter(r => r.status === 'holiday').length} holiday
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {rows.map(row => {
                                        const s = STATUS[row.status];
                                        return (
                                            <Tooltip
                                                key={row.date}
                                                arrow
                                                title={
                                                    <span style={{ lineHeight: 1.7, fontSize: 12 }}>
                                                        <b>{row.date} ({row.dayName})</b><br />
                                                        Status: <b>{s.label}</b>
                                                        {row.isManualOverride && <span style={{ color: '#ffcc80' }}> (Manual Override)</span>}<br />
                                                        Run: {fmtPct(row.runPct)} ({fmtHours(row.runSecs)} hrs){row.isManualOverride ? ' — zeroed' : ''}<br />
                                                        Alarm: {fmtHours(row.alarmSecs)} hrs<br />
                                                        Idle: {fmtHours(row.idleSecs)} hrs<br />
                                                        Disconnect: {fmtHours(row.discSecs)} hrs<br />
                                                        Downtime: {fmtHours(row.downtimeSecs)} hrs
                                                    </span>
                                                }
                                            >
                                                <div style={{
                                                    width: 42, height: 42,
                                                    borderRadius: 8,
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 13, fontWeight: 700,
                                                    cursor: 'default',
                                                    background: s.bg,
                                                    color: s.color,
                                                    border: `2px solid ${s.border}`,
                                                }}>
                                                    <span>{row.dayOfMonth}</span>
                                                    <span style={{ fontSize: 9, fontWeight: 400, lineHeight: 1 }}>{row.dayName}</span>
                                                </div>
                                            </Tooltip>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* ── Detail Table */}
                        <div style={{ marginTop: 28 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#444' }}>
                                    Detailed Breakdown — {sortedRows.length} day{sortedRows.length !== 1 ? 's' : ''}
                                </div>
                                {manualHolidays.size > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: '6px 14px' }}>
                                        <span style={{ fontSize: 12, color: '#d84315', fontWeight: 600 }}>
                                            🔴 {manualHolidays.size} whole-day holiday override{manualHolidays.size !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}
                                {manualProductionDays.size > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#e6f4ea', border: '1px solid #b7dfc3', borderRadius: 8, padding: '6px 14px' }}>
                                        <span style={{ fontSize: 12, color: '#1e7e34', fontWeight: 600 }}>
                                            🟢 {manualProductionDays.size} whole-day production override{manualProductionDays.size !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
                                <Table size="small" stickyHeader sx={{ minWidth: 900 }}>
                                    <TableHead>
                                        <TableRow sx={{ '& th': { background: '#f5f7fa', fontWeight: 700, fontSize: 12, color: '#555', whiteSpace: 'nowrap' } }}>
                                            {COLUMNS.map((col, idx) => (
                                                <TableCell
                                                    key={col.key}
                                                    align={col.align || 'left'}
                                                    sortDirection={sortKey === col.key ? sortDir : false}
                                                    sx={idx === 0 ? { position: 'sticky', left: 0, zIndex: 3, background: '#f5f7fa' } : {}}
                                                >
                                                    <TableSortLabel
                                                        active={sortKey === col.key}
                                                        direction={sortKey === col.key ? sortDir : 'asc'}
                                                        onClick={() => handleSort(col.key)}
                                                    >
                                                        {col.label}
                                                    </TableSortLabel>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, i) => {
                                            // Effective status: accounts for whole-day AND per-shift manual overrides
                                            const anyShiftHoliday = shifts.some(s => {
                                                const sNo = String(s.shift_no);
                                                return shiftManualHolidays.get(sNo)?.has(row.date) && !shiftManualProductionDays.get(sNo)?.has(row.date);
                                            });
                                            const anyShiftProduction = shifts.some(s => {
                                                const sNo = String(s.shift_no);
                                                return shiftManualProductionDays.get(sNo)?.has(row.date);
                                            });
                                            const effectiveStatus = (() => {
                                                if (manualProductionDays.has(row.date)) return 'production';
                                                if (row.targetExcluded) return 'holiday';
                                                if (anyShiftHoliday && !anyShiftProduction) return 'holiday';
                                                return row.status;
                                            })();
                                            return (
                                            <TableRow
                                                key={row.date}
                                                sx={{
                                                    background: effectiveStatus === 'holiday' ? '#fff8f5' : i % 2 === 0 ? '#fff' : '#fafafa',
                                                    '&:hover': { background: '#f0f4ff' },
                                                }}
                                            >
                                                <TableCell sx={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: 'inherit' }}>
                                                    {row.date}
                                                    {/* Whole-day manual badges */}
                                                    {manualHolidays.has(row.date) && (
                                                        <span style={{ marginLeft: 6, fontSize: 10, background: '#d84315', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, verticalAlign: 'middle' }}>
                                                            Holiday
                                                        </span>
                                                    )}
                                                    {manualProductionDays.has(row.date) && (
                                                        <span style={{ marginLeft: 6, fontSize: 10, background: '#4caf50', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, verticalAlign: 'middle' }}>
                                                            Production
                                                        </span>
                                                    )}
                                                    {/* Per-shift manual badges */}
                                                    {shifts.map(s => {
                                                        const sNo = String(s.shift_no);
                                                        const isShiftHol = shiftManualHolidays.get(sNo)?.has(row.date);
                                                        const isShiftProd = shiftManualProductionDays.get(sNo)?.has(row.date);
                                                        if (!isShiftHol && !isShiftProd) return null;
                                                        return (
                                                            <span key={sNo} style={{ marginLeft: 4, fontSize: 10, background: isShiftProd ? '#4caf50' : '#d84315', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, verticalAlign: 'middle' }}>
                                                                S{sNo}
                                                            </span>
                                                        );
                                                    })}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{DAY_FULL_NAMES[dayjs(row.date).day()]}</TableCell>
                                                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}><StatusPill status={row.autoStatus} /></TableCell>
                                                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                                                    {(() => {
                                                        // For auto-holiday rows: chips toggle "mark as production"
                                                        // For auto-production rows: chips toggle "mark as holiday"
                                                        const isHolRow = row.autoStatus === 'holiday';
                                                        const activeColor = isHolRow ? '#4caf50' : '#e8440a';
                                                        const activeBg   = isHolRow ? '#f2faf4'  : '#fff3e0';

                                                        const chipStyle = (active) => ({
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: '3px 8px',
                                                            borderRadius: 12,
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            border: `1.5px solid ${active ? activeColor : '#ddd'}`,
                                                            background: active ? activeBg : '#f9f9f9',
                                                            color: active ? activeColor : '#bbb',
                                                            transition: 'all 0.15s',
                                                            userSelect: 'none',
                                                        });

                                                        // Override type this row's chips apply.
                                                        const overrideType = isHolRow ? 'production' : 'holiday';
                                                        const shiftSetForType = isHolRow ? shiftManualProductionDays : shiftManualHolidays;
                                                        const wholeDayActive = isHolRow
                                                            ? manualProductionDays.has(row.date)
                                                            : manualHolidays.has(row.date);
                                                       
                                                        const isShiftActive = (sNo) =>
                                                            wholeDayActive || (shiftSetForType.get(sNo)?.has(row.date) ?? false);

                                                        const allActive = wholeDayActive;

                                                        const effectiveActiveShifts = () => {
                                                            const set = new Set();
                                                            for (const s of shifts) {
                                                                const sNo = String(s.shift_no);
                                                                if (isShiftActive(sNo)) set.add(sNo);
                                                            }
                                                            return set;
                                                        };

                                                        // Clicking All → select every shift (→ stored whole-day) or clear all.
                                                        const onClickAll = () => {
                                                            const next = allActive
                                                                ? new Set()
                                                                : new Set(shifts.map(s => String(s.shift_no)));
                                                            commitOverride(row.date, overrideType, next);
                                                        };

                                                        return (
                                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                                <Tooltip arrow title={isHolRow
                                                                    ? (allActive ? 'Revert whole day → Holiday' : 'Mark whole day as Production')
                                                                    : (allActive ? 'Revert whole day → Production' : 'Mark whole day as Holiday')}>
                                                                    <span style={chipStyle(allActive)} onClick={onClickAll}>
                                                                        All
                                                                    </span>
                                                                </Tooltip>
                                                                {shifts.map(s => {
                                                                    const sNo = String(s.shift_no);
                                                                    const shiftActive = isShiftActive(sNo);

                                                                    const onClickShift = () => {
                                                                        const next = effectiveActiveShifts();
                                                                        if (next.has(sNo)) next.delete(sNo); else next.add(sNo);
                                                                        commitOverride(row.date, overrideType, next);
                                                                    };
                                                                    return (
                                                                        <Tooltip key={sNo} arrow title={isHolRow
                                                                            ? (shiftActive ? `Revert Shift ${sNo}` : `Mark Shift ${sNo} as Production`)
                                                                            : (shiftActive ? `Revert Shift ${sNo}` : `Mark Shift ${sNo} as Holiday`)}>
                                                                            <span style={chipStyle(shiftActive)} onClick={onClickShift}>
                                                                                S{sNo}
                                                                            </span>
                                                                        </Tooltip>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}
                                                </TableCell>
                                            </TableRow>
                                            );
                                        })}

                                        {/* Totals row */}
                                        {sortedRows.length > 0 && (
                                            <TableRow sx={{ background: '#f5f7fa', '& td': { fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' } }}>
                                                <TableCell colSpan={2} sx={{ position: 'sticky', left: 0, zIndex: 1, background: '#f5f7fa' }}>TOTAL ({sortedRows.length} days)</TableCell>
                                                <TableCell align="center" sx={{ fontSize: 11 }}>
                                                    {sortedRows.filter(r => r.status === 'production').length}P &nbsp;/&nbsp;
                                                    {sortedRows.filter(r => r.status === 'holiday').length}H
                                                </TableCell>
                                                <TableCell align="center" sx={{ fontSize: 11 }}>—</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                                <TablePagination
                                    component="div"
                                    count={sortedRows.length}
                                    page={page}
                                    onPageChange={(_, newPage) => setPage(newPage)}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                                    rowsPerPageOptions={[10, 30, 50]}
                                />
                            </TableContainer>
                        </div>
                    </>
                )}
            </div>
        </div>
        </>
    );
}
