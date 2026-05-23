import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Button,
    CircularProgress,
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
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
    customerbaseddevices,
    customerbasedshift,
} from '../../Services/app/companyservice';
import { telemetrykeydata } from '../../Services/app/operatorservice';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';

const TWENTY_HOURS_SECONDS = 20 * 3600;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeToSeconds(timeStr = '00:00:00') {
    const [h = 0, m = 0, s = 0] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

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
        label: 'Holiday / Leave',
        bg: '#fff3e0',
        color: '#d84315',
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
    const [selectedShift, setSelectedShift] = useState(null);
    const [startDate, setStartDate] = useState(dayjs().subtract(1, 'month'));
    const [endDate, setEndDate] = useState(dayjs());
    const [isLoading, setIsLoading] = useState(false);

    const [dateRows, setDateRows] = useState([]);
    const [summary, setSummary] = useState(null);

    const [viewMode, setViewMode] = useState('all');
    const [sortKey, setSortKey] = useState('date');
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // AI suggestions
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

    // ── helpers ──────────────────────────────────────────────────────────────

    const getCurrentShift = useCallback((shiftList) => {
        if (!Array.isArray(shiftList) || shiftList.length === 0) return 'allshift';
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        for (const s of shiftList) {
            const [fh, fm] = s.start_time.split(':').map(Number);
            const [th, tm] = s.end_time.split(':').map(Number);
            const from = fh * 60 + fm;
            const to = th * 60 + tm;
            if ((from <= cur && cur < to) || (from > to && (cur >= from || cur < to))) {
                return String(s.shift_no);
            }
        }
        return 'allshift';
    }, []);

    const getShiftTimes = useCallback((shiftList, shiftNo, date) => {
        if (!Array.isArray(shiftList) || shiftList.length === 0 || !date) return { from: null, to: null };
        const baseDate = dayjs(date).format('YYYY-MM-DD');
        const byOffset = (base, dayVal) =>
            dayjs(base).add(Number(dayVal) - 1, 'day').format('YYYY-MM-DD');

        if (shiftNo === 'allshift') {
            const sorted = [...shiftList].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
            const first = sorted[0], last = sorted[sorted.length - 1];
            if (!first || !last) return { from: null, to: null };
            return {
                from: new Date(`${byOffset(baseDate, first.start_day)}T${first.start_time}`).getTime(),
                to: new Date(`${byOffset(baseDate, last.end_day)}T${last.end_time}`).getTime(),
            };
        }
        const sd = shiftList.find(s => String(s.shift_no) === String(shiftNo));
        if (!sd) return { from: null, to: null };
        return {
            from: new Date(`${byOffset(baseDate, sd.start_day)}T${sd.start_time}`).getTime(),
            to: new Date(`${byOffset(baseDate, sd.end_day)}T${sd.end_time}`).getTime(),
        };
    }, []);

    function filterByShift(data, from, to) {
        if (!data) return null;
        const result = {};
        for (const key of Object.keys(data)) {
            result[key] = Array.isArray(data[key])
                ? data[key].filter(p => { const ts = Number(p.ts); return ts >= from && ts <= to - 1; })
                : data[key];
        }
        return result;
    }

    function getLatest(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return arr.reduce((a, b) => (Number(b.ts) > Number(a.ts) ? b : a));
    }

    // ── fetchers ──────────────────────────────────────────────────────────────

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

    // ── main analysis — mirrors OnePageDashboard holiday detection exactly ──

    const runAnalysis = useCallback(async () => {
        if (!shifts.length || selectedShift === null || !customerId || !startDate || !endDate) return;

        // Build all-shift ranges per day across the full date range
        const allRangesAllShifts = [];
        let d = startDate.startOf('day');
        const lastDay = endDate.startOf('day');
        while (!d.isAfter(lastDay)) {
            for (const s of shifts) {
                const r = getShiftTimes(shifts, String(s.shift_no), d);
                if (r.from && r.to) allRangesAllShifts.push({ shiftNo: String(s.shift_no), date: d.format('YYYY-MM-DD'), ...r });
            }
            d = d.add(1, 'day');
        }
        if (!allRangesAllShifts.length) return;

        const overallFrom = allRangesAllShifts[0].from;
        const overallTo = allRangesAllShifts[allRangesAllShifts.length - 1].to;
        const allDeviceIds = deviceNameID.map(dv => dv.id);

        // Fetch total_duration for ALL machines over the full range
        const allMachineData = new Map();
        await Promise.all(allDeviceIds.map(async id => {
            const data = await fetchTelemetry(id, ['total_duration'], overallFrom, overallTo);
            allMachineData.set(id, data);
        }));

        // Collect unique dates
        const allDates = new Set(allRangesAllShifts.map(r => r.date));

        // Per-device, per-date: accumulate run / alarm / idle / disconnect across ALL shifts
        const fullDayRunByDate = new Map();          // `${deviceId}-${date}` → secs
        const fullDayAlarmByDate = new Map();        // `${deviceId}-${date}` → secs
        const fullDayIdleByDate = new Map();
        const fullDayDiscByDate = new Map();

        for (const deviceId of allDeviceIds) {
            const rawData = allMachineData.get(deviceId);
            for (const r of allRangesAllShifts) {
                const data = filterByShift(rawData, r.from, r.to);
                const latest = getLatest(data?.total_duration);
                if (!latest?.value) continue;
                try {
                    const parsed = JSON.parse(latest.value);
                    const key = `${deviceId}-${r.date}`;
                    fullDayRunByDate.set(key, (fullDayRunByDate.get(key) || 0) + (parsed.total_run_duration || 0));
                    fullDayAlarmByDate.set(key, (fullDayAlarmByDate.get(key) || 0) + (parsed.total_alarm_duration || 0));
                    fullDayIdleByDate.set(key, (fullDayIdleByDate.get(key) || 0) + (parsed.total_idle_duration || 0));
                    fullDayDiscByDate.set(key, (fullDayDiscByDate.get(key) || 0) + (parsed.total_disconnect_duration || 0));
                } catch { /* skip */ }
            }
        }

        // Build per-date totals across ALL machines
        const totalRunByDate = new Map();
        const totalAlarmByDate = new Map();
        const totalIdleByDate = new Map();
        const totalDiscByDate = new Map();

        for (const date of allDates) {
            let run = 0, alarm = 0, idle = 0, disc = 0;
            for (const id of allDeviceIds) {
                const key = `${id}-${date}`;
                run += fullDayRunByDate.get(key) || 0;
                alarm += fullDayAlarmByDate.get(key) || 0;
                idle += fullDayIdleByDate.get(key) || 0;
                disc += fullDayDiscByDate.get(key) || 0;
            }
            totalRunByDate.set(date, run);
            totalAlarmByDate.set(date, alarm);
            totalIdleByDate.set(date, idle);
            totalDiscByDate.set(date, disc);
        }

        // Expected shift time per date (break time removed, across ALL machines × ALL shifts)
        const expectedByDate = new Map();
        for (const r of allRangesAllShifts) {
            const rawSecs = Math.floor((r.to - r.from) / 1000);
            const sd = shifts.find(s => String(s.shift_no) === String(r.shiftNo));
            const breakSecs = sd ? timeToSeconds(sd.break_time || '00:00:00') : 0;
            const net = Math.max(0, rawSecs - breakSecs);
            expectedByDate.set(r.date, (expectedByDate.get(r.date) || 0) + net * allDeviceIds.length);
        }

        // Classify each date — same condition as OnePageDashboard
        const rows = [];
        for (const date of Array.from(allDates).sort()) {
            const run = totalRunByDate.get(date) || 0;
            const expected = expectedByDate.get(date) || 1;
            const alarm = totalAlarmByDate.get(date) || 0;
            const idle = totalIdleByDate.get(date) || 0;
            const disc = totalDiscByDate.get(date) || 0;
            const downtime = alarm + idle + disc;
            const runPct = (run / expected) * 100;
            const isHoliday = runPct <= 20 && downtime > TWENTY_HOURS_SECONDS;

            const dayObj = dayjs(date);
            rows.push({
                date,
                dayName: DAY_NAMES[dayObj.day()],
                dayOfMonth: dayObj.date(),
                targetExcluded: isHoliday,
                month: dayObj.format('MMM YYYY'),
                runSecs: run,
                expectedSecs: expected,
                runPct,
                alarmSecs: alarm,
                idleSecs: idle,
                discSecs: disc,
                downtimeSecs: downtime,
                status: isHoliday ? 'holiday' : 'production',
            });
        }

        setDateRows(rows);

        const holidayDays = rows.filter(r => r.status === 'holiday').length;
        const productionDays = rows.length - holidayDays;
        const totalExpectedSecs = rows.reduce((s, r) => s + r.expectedSecs, 0);
        const excludedSecs = rows.filter(r => r.targetExcluded).reduce((s, r) => s + r.expectedSecs, 0);
        setSummary({
            totalDays: rows.length,
            productionDays,
            holidayDays,
            totalRunHours: rows.reduce((s, r) => s + r.runSecs, 0),
            avgRunPct: rows.length ? rows.reduce((s, r) => s + r.runPct, 0) / rows.length : 0,
            totalExpectedSecs,
            actualTotalSecs: totalExpectedSecs - excludedSecs,
            excludedSecs,
        });
    }, [shifts, selectedShift, customerId, startDate, endDate, deviceNameID, fetchTelemetry, getShiftTimes]);

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
- Holiday / Leave days (target excluded): ${holidayDays.length}
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

    // ── effects ───────────────────────────────────────────────────────────────

    useEffect(() => {
        if (customerId) Promise.all([fetchShifts(), fetchDevices()]);
    }, [customerId, fetchShifts, fetchDevices]);

    useEffect(() => {
        if (shifts.length === 0 || selectedShift !== null) return;
        setSelectedShift(getCurrentShift(shifts));
    }, [shifts, selectedShift, getCurrentShift]);

    // ── derived ───────────────────────────────────────────────────────────────

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
            r.status === 'holiday' ? 'Holiday / Leave' : 'Production Day',
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
                    { label: 'Holiday / Leave Days',value: String(summary.holidayDays),             color: [244, 67, 54]  },
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
                drawPill('Holiday / Leave', [255,243,224], [216,67,21],  [255,204,128], 26);

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
        { key: 'runPct', label: 'Run %', align: 'right' },
        { key: 'runSecs', label: 'Run Hrs', align: 'right' },
        { key: 'alarmSecs', label: 'Alarm Hrs', align: 'right' },
        { key: 'idleSecs', label: 'Idle Hrs', align: 'right' },
        { key: 'discSecs', label: 'Disconnect Hrs', align: 'right' },
        { key: 'downtimeSecs', label: 'Downtime Hrs', align: 'right' },
        { key: 'expectedSecs', label: 'Expected Hrs', align: 'right' },
        { key: 'targetExcluded', label: 'Excluded Hrs', align: 'right' },
    ];

    return (
        <>
        <div id="holiday-print-area" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 65px)', background: '#f4f6f8' }}>

            {/* ── Header ───────────────────────────────────────────────── */}
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
                            disabled={isLoading || selectedMachines.length === 0}
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

                        {summary && (
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
                        )}
                    </div>
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────────── */}
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
                        {/* ── Summary Cards ─────────────────────────────── */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
                            {[
                                { label: 'Total Days', value: summary.totalDays, color: '#2196F3', icon: '📅' },
                                { label: 'Production Days', value: summary.productionDays, color: '#4CAF50', icon: '🏭' },
                                { label: 'Holiday / Leave Days', value: summary.holidayDays, color: '#f44336', icon: '🔴' },
                                { label: 'Total Run Hours', value: fmtHours(summary.totalRunHours), color: '#9C27B0', icon: '⏱️' },
                                { label: 'Avg Run %', value: fmtPct(summary.avgRunPct), color: '#FF9800', icon: '📊' },
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
                                </div>
                            ))}
                        </div>

                        {/* ── Legend + View Toggle ───────────────────────── */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <StatusPill status="production" />
                                <StatusPill status="holiday" />

                                <div style={{ display: 'flex', gap: 20, marginLeft: 8, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                                        <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500 }}>Expected Total Hrs</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: '#2196F3' }}>
                                            {fmtHours(summary.totalExpectedSecs)}
                                        </span>
                                    </div>
                                    <div style={{ width: 1, background: '#e0e0e0', alignSelf: 'stretch' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                                        <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500 }}>Actual Total Hrs</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: '#4CAF50' }}>
                                            {fmtHours(summary.actualTotalSecs)}
                                        </span>
                                    </div>
                                    {summary.excludedSecs > 0 && (
                                        <>
                                            <div style={{ width: 1, background: '#e0e0e0', alignSelf: 'stretch' }} />
                                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                                                <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500 }}>Excluded Hrs</span>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: '#d84315' }}>
                                                    {fmtHours(summary.excludedSecs)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
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

                                {/* AI Suggestions button — temporarily hidden until API key is configured
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={fetchAiSuggestions}
                                    sx={{
                                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                        '&:hover': { background: 'linear-gradient(135deg, #6d28d9, #4338ca)' },
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        height: 36,
                                        px: 2,
                                        gap: 1,
                                        borderRadius: 2,
                                        boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
                                    }}
                                >
                                    ✨ AI Suggestions
                                </Button>
                                */}
                            </div>
                        </div>

                        {/* ── Calendar strip ────────────────────────────── */}
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
                                                        Status: <b>{s.label}</b><br />
                                                        Run: {fmtPct(row.runPct)} ({fmtHours(row.runSecs)} hrs)<br />
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

                        {/* ── Detail Table ──────────────────────────────── */}
                        <div style={{ marginTop: 28 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#444', marginBottom: 12 }}>
                                Detailed Breakdown — {sortedRows.length} day{sortedRows.length !== 1 ? 's' : ''}
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
                                        {sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, i) => (
                                            <TableRow
                                                key={row.date}
                                                sx={{
                                                    background: row.status === 'holiday' ? '#fff8f5' : i % 2 === 0 ? '#fff' : '#fafafa',
                                                    '&:hover': { background: '#f0f4ff' },
                                                }}
                                            >
                                                <TableCell sx={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: 'inherit' }}>{row.date}</TableCell>
                                                <TableCell sx={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{row.dayName}</TableCell>
                                                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}><StatusPill status={row.status} /></TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: row.runPct <= 20 ? '#d84315' : '#1e7e34' }}>
                                                    {fmtPct(row.runPct)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtHours(row.runSecs)}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, whiteSpace: 'nowrap', color: row.alarmSecs > 0 ? '#d84315' : '#aaa' }}>{fmtHours(row.alarmSecs)}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtHours(row.idleSecs)}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtHours(row.discSecs)}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: row.downtimeSecs > TWENTY_HOURS_SECONDS ? '#d84315' : '#555' }}>
                                                    {fmtHours(row.downtimeSecs)}
                                                    {row.downtimeSecs > TWENTY_HOURS_SECONDS && (
                                                        <span style={{ marginLeft: 4, fontSize: 10, color: '#d84315' }}>⚠ &gt;20h</span>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, whiteSpace: 'nowrap', color: '#888' }}>{fmtHours(row.expectedSecs)}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: row.targetExcluded ? '#d84315' : '#aaa' }}>
                                                    {row.targetExcluded ? fmtHours(row.expectedSecs) : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}

                                        {/* Totals row */}
                                        {sortedRows.length > 0 && (
                                            <TableRow sx={{ background: '#f5f7fa', '& td': { fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' } }}>
                                                <TableCell colSpan={2} sx={{ position: 'sticky', left: 0, zIndex: 1, background: '#f5f7fa' }}>TOTAL ({sortedRows.length} days)</TableCell>
                                                <TableCell align="center" sx={{ fontSize: 11 }}>
                                                    {sortedRows.filter(r => r.status === 'production').length}P &nbsp;/&nbsp;
                                                    {sortedRows.filter(r => r.status === 'holiday').length}H
                                                </TableCell>
                                                <TableCell align="right">{fmtPct(sortedRows.reduce((s, r) => s + r.runPct, 0) / (sortedRows.length || 1))}</TableCell>
                                                <TableCell align="right">{fmtHours(sortedRows.reduce((s, r) => s + r.runSecs, 0))}</TableCell>
                                                <TableCell align="right">{fmtHours(sortedRows.reduce((s, r) => s + r.alarmSecs, 0))}</TableCell>
                                                <TableCell align="right">{fmtHours(sortedRows.reduce((s, r) => s + r.idleSecs, 0))}</TableCell>
                                                <TableCell align="right">{fmtHours(sortedRows.reduce((s, r) => s + r.discSecs, 0))}</TableCell>
                                                <TableCell align="right">{fmtHours(sortedRows.reduce((s, r) => s + r.downtimeSecs, 0))}</TableCell>
                                                <TableCell align="right">{fmtHours(sortedRows.reduce((s, r) => s + r.expectedSecs, 0))}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: '#d84315' }}>
                                                    {fmtHours(sortedRows.filter(r => r.targetExcluded).reduce((s, r) => s + r.expectedSecs, 0))}
                                                </TableCell>
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

        {/* ── AI Suggestions Drawer ────────────────────────── */}
        <Drawer
            anchor="right"
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            PaperProps={{
                sx: {
                    width: { xs: '100vw', sm: 480 },
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0f0f1a',
                    color: '#e8e8f0',
                }
            }}
        >
            {/* Drawer header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 20px',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>✨ AI Suggestions</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                        Claude — production improvement analysis
                    </div>
                </div>
                <button
                    onClick={() => setAiOpen(false)}
                    style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: 18,
                        width: 34, height: 34,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Context chips */}
            <div style={{ padding: '12px 20px', background: '#16162a', borderBottom: '1px solid #2a2a40', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                        `${startDate.format('DD MMM')} – ${endDate.format('DD MMM YYYY')}`,
                        `${dateRows.length} days`,
                        `${dateRows.filter(r => r.status === 'holiday').length} holidays`,
                        `Avg run ${fmtPct(summary?.avgRunPct || 0)}`,
                    ].map(chip => (
                        <span key={chip} style={{
                            background: '#2a2a40', color: '#a5b4fc',
                            borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                        }}>
                            {chip}
                        </span>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div
                ref={aiScrollRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    fontFamily: 'system-ui, sans-serif',
                    lineHeight: 1.75,
                    fontSize: 14,
                }}
            >
                {aiLoading && !aiText && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#a5b4fc' }}>
                        <CircularProgress size={18} sx={{ color: '#a5b4fc' }} />
                        <span>Analysing your production data…</span>
                    </div>
                )}

                {aiText && (
                    <div style={{ whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
                        {aiText.split('\n').map((line, i) => {
                            if (/^#{1,3}\s/.test(line)) {
                                const text = line.replace(/^#+\s/, '');
                                return (
                                    <div key={i} style={{ fontWeight: 700, fontSize: 15, color: '#c4b5fd', margin: '18px 0 6px' }}>
                                        {text}
                                    </div>
                                );
                            }
                            if (/^\*\*(.+)\*\*$/.test(line)) {
                                return (
                                    <div key={i} style={{ fontWeight: 700, color: '#f0abfc', margin: '10px 0 4px' }}>
                                        {line.replace(/\*\*/g, '')}
                                    </div>
                                );
                            }
                            if (/^[-•]\s/.test(line)) {
                                return (
                                    <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0', paddingLeft: 4 }}>
                                        <span style={{ color: '#7c3aed', flexShrink: 0, marginTop: 2 }}>▸</span>
                                        <span>{line.replace(/^[-•]\s/, '')}</span>
                                    </div>
                                );
                            }
                            if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
                            return <div key={i}>{line}</div>;
                        })}
                        {aiLoading && (
                            <span style={{
                                display: 'inline-block', width: 8, height: 14,
                                background: '#a5b4fc', borderRadius: 2,
                                animation: 'blink 1s step-end infinite',
                                verticalAlign: 'text-bottom', marginLeft: 2,
                            }} />
                        )}
                    </div>
                )}
            </div>

            {/* Footer — re-generate */}
            {!aiLoading && aiText && (
                <>
                    <Divider sx={{ borderColor: '#2a2a40' }} />
                    <div style={{ padding: '14px 20px', flexShrink: 0 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={fetchAiSuggestions}
                            sx={{
                                borderColor: '#4f46e5',
                                color: '#a5b4fc',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { borderColor: '#7c3aed', background: 'rgba(124,58,237,0.1)' },
                            }}
                        >
                            ↻ Regenerate
                        </Button>
                    </div>
                </>
            )}

            <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

        </Drawer>
        </>
    );
}
