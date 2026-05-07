import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import {
    Box, Typography, Tab, Tabs, FormControl, InputLabel, Select,
    MenuItem, Checkbox, ListItemText, Button, CircularProgress, Tooltip, Skeleton
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';
import { useUserRole } from '../../Shared/hooks/useUserRole';
import { customerbasedshift, cleanCustomerId, telemetrykeydata } from '../../Services/app/operatorservice';
import { fetchPartsCountStatusSummary } from '../../Shared/utils/partsdata';
import { getAlarmByPeriod, getAlarmByPeriodTop, getMetricByPeriod, getPartsAnalytics, getIdleByPeriod, getIdleReasonByPeriod } from '../../Services/app/analyticsservice';
import './AnalyticsV2.css';

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);

const ALL_TABS = [
    { value: 'utilization', label: 'Utilization' },
    { value: 'oee', label: 'OEE' },
    { value: 'parts', label: 'Parts' },
    { value: 'parts_summary', label: 'Parts Summary', restrictedToCustomer: true },
    { value: 'cycle_time', label: 'Cycle Time', restrictedToCustomer: true },
    { value: 'downtime', label: 'Downtime' },
    { value: 'alarm', label: 'Alarm' },
];

const VIEW_OPTS = [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }];
const PERIOD_OPTS = [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }];
const TOP_N_OPTS = [5, 10, 15, 20];

const BAR_COLORS = [
    '#e53935', '#1e88e5', '#43a047', '#8e24aa', '#e64a19',
    '#6d9eeb', '#f4b942', '#e91e63', '#00897b', '#5c6bc0',
    '#ff7043', '#26a69a', '#ab47bc', '#42a5f5', '#ef5350',
    '#66bb6a', '#ffa726', '#26c6da', '#ec407a', '#7e57c2',
];

const BLUECARD_COLORS = [
    '#ff6b35', '#7b2d8b', '#00b4d8', '#2dc653', '#ffbe0b',
    '#fb5607', '#3a86ff', '#8338ec', '#06d6a0', '#ef233c',
    '#f72585', '#4cc9f0', '#4361ee', '#7209b7', '#f3722c',
];

const chartToolbar = (filename) => ({
    show: true,
    tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false },
    export: {
        csv: { filename },
        svg: { filename },
        png: { filename },
    },
});

const AUTO_LOAD_TABS = ['utilization', 'oee', 'parts', 'parts_summary', 'cycle_time', 'downtime', 'alarm'];

const secsToHours = s => +(s / 3600).toFixed(2);
const formatH = s => {
    const h = s / 3600;
    if (h >= 1) return `${h.toFixed(2)} h`;
    const m = s / 60;
    if (m >= 1) return `${m.toFixed(0)}m ${s % 60}s`;
    return `${s}s`;
};

export default function AnalyticsV2() {
    const customerId = localStorage.getItem('CustomerID');
    const { isSuperAdmin } = useUserRole();
    const TABS = ALL_TABS.filter(t => !t.restrictedToCustomer || isSuperAdmin);

    const {
        deviceNameID, machineGroups, availableMachines, selectedMachines, selectedGroups,
        showMachineGroupsDropdown, isAllMachinesSelected,
        handleGroupChange, handleMachineChange, setSelectedMachines,
    } = useMachineGroups(customerId);

    const [tab, setTab] = useState(() => TABS[0]?.value || 'utilization');
    const [shifts, setShifts] = useState([]);
    const [selectedShift, setSelectedShift] = useState([]);
    const [fromDate, setFromDate] = useState(dayjs().subtract(7, 'day'));
    const [toDate, setToDate] = useState(dayjs());

    const [oeeView, setOeeView] = useState('day');
    const [utilView, setUtilView] = useState('day');

    const [partsFromDate, setPartsFromDate] = useState(dayjs().startOf('year'));
    const [partsToDate, setPartsToDate] = useState(dayjs());

    const [summaryDate, setSummaryDate] = useState(dayjs());
    const [summaryShift, setSummaryShift] = useState('');

    const [cycleDate, setCycleDate] = useState(dayjs());
    const [cycleShift, setCycleShift] = useState('');
    const [cycleMachine, setCycleMachine] = useState('');
    const [cycleComponent, setCycleComponent] = useState('all');
    const [availableComponents, setAvailableComponents] = useState([]);

    const [period, setPeriod] = useState('day');
    const [topBars, setTopBars] = useState(20);
    const [topCount, setTopCount] = useState(3);

    const [isLoading, setIsLoading] = useState(false);
    const [chartData, setChartData] = useState(null);
    const [iframeUrl, setIframeUrl] = useState('');
    const [expandedOthers, setExpandedOthers] = useState(false);
    const [selectedReason, setSelectedReason] = useState(null);

    const needsAutoLoadRef = useRef(true);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!customerId) return;
        customerbasedshift(customerId, 'allShift').then(res => {
            const list = res?.[0]?.value || [];
            setShifts(list);
            if (list.length > 0) {
                setSummaryShift(list[0].shift_no);
                setCycleShift(list[0].shift_no);
                setSelectedShift(list.map(s => s.shift_no));
            }
        }).catch(console.error);
    }, [customerId]);

    useEffect(() => {
        if (tab === 'cycle_time' && availableMachines.length > 0 && !cycleMachine)
            setCycleMachine(availableMachines[0]);
    }, [tab, availableMachines, cycleMachine]);

    // Fetch available components for cycle time whenever machine/date/shift changes
    useEffect(() => {
        if (tab !== 'cycle_time' || !cycleMachine || !cycleDate || !cycleShift || shifts.length === 0) return;
        const deviceId = deviceNameID.find(d => d.name === cycleMachine)?.id;
        if (!deviceId) return;
        const shiftObj = shifts.find(s => String(s.shift_no) === String(cycleShift)) || shifts[0];
        if (!shiftObj) return;
        const [startH, startM] = shiftObj.start_time.split(':').map(Number);
        const [endH, endM] = shiftObj.end_time.split(':').map(Number);
        const fromDT = cycleDate.hour(startH).minute(startM).second(0).millisecond(0);
        let toDT = cycleDate.hour(endH).minute(endM).second(0).millisecond(0);
        if (endH < startH || (endH === startH && endM <= startM)) toDT = toDT.add(1, 'day');
        telemetrykeydata(deviceId, 'DEVICE', 'live_component', fromDT.valueOf(), toDT.valueOf())
            .then(res => {
                const compSet = new Set();
                const comps = [];
                (res?.live_component || []).forEach(item => {
                    try {
                        const p = JSON.parse(item.value);
                        if (p?.name && p?.code) {
                            const key = `${p.name}-${p.code}`;
                            if (!compSet.has(key)) { compSet.add(key); comps.push({ name: p.name, code: p.code }); }
                        }
                    } catch { }
                });
                setAvailableComponents(comps);
                setCycleComponent('all');
            })
            .catch(() => setAvailableComponents([]));
    }, [tab, cycleMachine, cycleDate, cycleShift, shifts, deviceNameID]); // eslint-disable-line react-hooks/exhaustive-deps

    // Mark that a fresh auto-load is needed whenever the tab changes
    useEffect(() => { needsAutoLoadRef.current = true; }, [tab]);

    // Execute auto-load once machines + shifts (+ cycleMachine for cycle_time) are ready
    useEffect(() => {
        if (!needsAutoLoadRef.current) return;
        if (!AUTO_LOAD_TABS.includes(tab)) return;
        if (selectedMachines.length === 0 || shifts.length === 0) return;
        if (tab === 'cycle_time' && !cycleMachine) return; // wait until cycleMachine is set
        needsAutoLoadRef.current = false;
        handleRunAnalysis(); // eslint-disable-line react-hooks/exhaustive-deps
    }, [tab, selectedMachines, shifts, cycleMachine]); // eslint-disable-line react-hooks/exhaustive-deps

    const isShiftDisabled = useMemo(() => {
        if (['parts_summary', 'cycle_time', 'parts', 'downtime', 'alarm', 'oee', 'utilization'].includes(tab)) return false;
        return !fromDate || !toDate ? true : !fromDate.isSame(toDate, 'day');
    }, [tab, fromDate, toDate]);

    const isRunDisabled = useMemo(() => {
        if (tab === 'cycle_time') return !cycleMachine || !cycleDate || !cycleShift;
        return selectedMachines.length === 0;
    }, [tab, selectedMachines, cycleMachine, cycleDate, cycleShift]);

    const isAllShiftsSelected = shifts.length > 0 && selectedShift.length === shifts.length;

    const handleTabChange = (_, newTab) => { setTab(newTab); setSelectedShift(shifts.map(s => s.shift_no)); setChartData(null); setIframeUrl(''); setExpandedOthers(false); setSelectedReason(null); };

    const handleRunAnalysis = async () => {
        const reqId = ++requestIdRef.current;

        const machines = selectedMachines.join(',');
        const shiftParam = (selectedShift.length === 0 || selectedShift.length === shifts.length)
            ? shifts.map(s => s.shift_no).join(',')
            : selectedShift.join(',');
        const from = fromDate.format('YYYY-MM-DD');
        const to = toDate.format('YYYY-MM-DD');
        const allShifts = shifts.map(s => s.shift_no).join(',');

        setIsLoading(true);
        setChartData(null);
        setIframeUrl('');
        setExpandedOthers(false);
        setSelectedReason(null);
        try {
            let res;
            if (tab === 'parts_summary') {
                const machineNames = selectedMachines.length ? [selectedMachines[0]] : [];
                const deviceIds = machineNames.map(n => deviceNameID.find(d => d.name === n)?.id).filter(Boolean);
                const shiftObj = shifts.find(s => String(s.shift_no) === String(summaryShift)) || shifts[0];
                if (deviceIds.length && shiftObj) {
                    const [sH, sM] = shiftObj.start_time.split(':').map(Number);
                    const [eH, eM] = shiftObj.end_time.split(':').map(Number);
                    const fromDT = summaryDate.hour(sH).minute(sM).second(0).millisecond(0);
                    let toDT = summaryDate.hour(eH).minute(eM).second(0).millisecond(0);
                    if (eH < sH || (eH === sH && eM <= sM)) toDT = toDT.add(1, 'day');
                    const psData = await fetchPartsCountStatusSummary({ deviceIds, fromEpoch: fromDT.valueOf(), toEpoch: toDT.valueOf() });
                    if (reqId !== requestIdRef.current) return;
                    const psBase = `${window._env_.GRAFANA_URL}d/cfhyiqoqbsc8we/analytics-parts-summary-chart?orgId=1&kiosk&theme=light`;
                    setIframeUrl(`${psBase}&var-partsummary=${encodeURIComponent(JSON.stringify(psData))}`);
                    // res stays undefined — iframeUrl drives the render
                }
            } else if (tab === 'cycle_time') {
                const deviceId = deviceNameID.find(d => d.name === cycleMachine)?.id;
                const shiftObj = shifts.find(s => String(s.shift_no) === String(cycleShift)) || shifts[0];
                if (deviceId && shiftObj) {
                    const [sH, sM] = shiftObj.start_time.split(':').map(Number);
                    const [eH, eM] = shiftObj.end_time.split(':').map(Number);
                    const fromDT = cycleDate.hour(sH).minute(sM).second(0).millisecond(0);
                    let toDT = cycleDate.hour(eH).minute(eM).second(0).millisecond(0);
                    if (eH < sH || (eH === sH && eM <= sM)) toDT = toDT.add(1, 'day');
                    const ctData = await fetchPartsCountStatusSummary({ deviceIds: [deviceId], fromEpoch: fromDT.valueOf(), toEpoch: toDT.valueOf() });
                    if (reqId !== requestIdRef.current) return;
                    const ctBase = `${window._env_.GRAFANA_URL}d/afi212e1xb7k0b/analytics-cycle-comparison-chart?orgId=1&kiosk&theme=light`;
                    const compValue = cycleComponent === 'all'
                        ? availableComponents.map(c => c.name).join(',')
                        : cycleComponent;
                    const compParam = compValue ? `&var-component=${encodeURIComponent(compValue)}` : '';
                    setIframeUrl(`${ctBase}&var-partsummary=${encodeURIComponent(JSON.stringify(ctData))}${compParam}`);
                }
            } else if (tab === 'downtime') {
                // Step 1: all idle reasons summary
                const summary = await getIdleByPeriod(machines, shiftParam, from, to);
                const sorted = (summary.idleReasonWithPercentage || [])
                    .map(r => ({ ...r, name: r.name || '' }))
                    .sort((a, b) => b.total_idle_duration - a.total_idle_duration);
                const totalSecs = summary.total_idle_duration || 0;
                let cumSum = 0;
                const reasons = sorted.map(r => {
                    cumSum += r.total_idle_duration;
                    return { name: r.name, total_duration_seconds: r.total_idle_duration, cumPct: totalSecs > 0 ? +((cumSum / totalSecs) * 100).toFixed(2) : 0 };
                });
                // Step 2: period breakdown for top N reasons (parallel)
                const topReasons = sorted.slice(0, topCount);
                const breakdowns = await Promise.all(topReasons.map((r, idx) =>
                    getIdleReasonByPeriod(machines, shiftParam, from, to, period, r.name)
                        .then(bRes => ({
                            name: r.name, rank: idx + 1, total_duration_seconds: r.total_idle_duration,
                            data: (bRes.data || [])
                                .sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
                                .map(d => ({ period: dayjs(d.period_start).format('DD-MM-YYYY'), duration_seconds: d.total_idle_duration })),
                        }))
                        .catch(() => ({ name: r.name, rank: idx + 1, total_duration_seconds: r.total_idle_duration, data: [] }))
                ));
                res = { reasons, total_duration_seconds: totalSecs, breakdown: breakdowns, bluecard: [] };
            } else if (tab === 'alarm') {
                const alarmSummary = await getAlarmByPeriod(machines, shiftParam, from, to);
                const alarmSorted = (alarmSummary.alarmWithPercentage || [])
                    .map(r => ({ ...r, name: r.alarm_message?.trim() || '' }))
                    .sort((a, b) => b.total_alarm_duration - a.total_alarm_duration);
                const alarmTotal = alarmSummary.total_alarm_duration || 0;
                let alarmCum = 0;
                const alarmReasons = alarmSorted.map(r => {
                    alarmCum += r.total_alarm_duration;
                    return { name: r.name, total_duration_seconds: r.total_alarm_duration, cumPct: alarmTotal > 0 ? +((alarmCum / alarmTotal) * 100).toFixed(2) : 0 };
                });
                const alarmTop = alarmSorted.slice(0, topCount);
                const alarmBreakdowns = await Promise.all(alarmTop.map((r, idx) =>
                    getAlarmByPeriodTop(machines, shiftParam, from, to, period, r.name)
                        .then(bRes => ({
                            name: r.name, rank: idx + 1, total_duration_seconds: r.total_alarm_duration,
                            data: (bRes.data || [])
                                .sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
                                .map(d => ({ period: dayjs(d.period_start).format('DD-MM-YYYY'), duration_seconds: d.total_alarm_duration })),
                        }))
                        .catch(() => ({ name: r.name, rank: idx + 1, total_duration_seconds: r.total_alarm_duration, data: [] }))
                ));
                res = { reasons: alarmReasons, total_duration_seconds: alarmTotal, breakdown: alarmBreakdowns, bluecard: [] };
            } else if (tab === 'parts') {
                res = await getPartsAnalytics(machines, allShifts, partsFromDate.format('YYYY-MM-DD'), partsToDate.format('YYYY-MM-DD'));
            } else if (tab === 'utilization') {
                res = await getMetricByPeriod(machines, shiftParam, from, to, utilView, 'run');
            } else if (tab === 'oee') {
                res = await getMetricByPeriod(machines, shiftParam, from, to, oeeView, 'oee');
            }
            if (reqId !== requestIdRef.current) return; // newer call superseded this one
            if (res !== undefined) setChartData(res);
        } catch (err) {
            if (reqId === requestIdRef.current) console.error('[AnalyticsV2] fetch error:', err);
        } finally {
            if (reqId === requestIdRef.current) setIsLoading(false);
        }
    };

    // ── Filter helpers ───────────────────────────────────────────────────────

    const renderGroupFilter = () => showMachineGroupsDropdown && (
        <FormControl size="small" className="av2-filter">
            <InputLabel>Machine Group</InputLabel>
            <Select multiple value={selectedGroups} onChange={e => handleGroupChange(e.target.value)} label="Machine Group"
                renderValue={sel => sel.length === machineGroups.length ? 'All Groups' : sel.length === 0 ? 'Select Group' : sel.join(', ')}>
                <MenuItem value="all"><Checkbox checked={selectedGroups.length === machineGroups.length} sx={{ '&.Mui-checked': { color: '#f47803' } }} /><ListItemText primary="All" /></MenuItem>
                {machineGroups.map(g => (
                    <MenuItem key={g.name} value={g.name}><Checkbox checked={selectedGroups.includes(g.name)} sx={{ '&.Mui-checked': { color: '#f47803' } }} /><ListItemText primary={g.name} /></MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    const renderMachineFilter = (single = false) => (
        <FormControl size="small" className="av2-filter">
            <InputLabel>Machine *</InputLabel>
            {single ? (
                <Select value={tab === 'cycle_time' ? cycleMachine : (selectedMachines[0] || '')}
                    onChange={e => tab === 'cycle_time' ? setCycleMachine(e.target.value) : setSelectedMachines(e.target.value ? [e.target.value] : [])}
                    label="Machine *">
                    {availableMachines.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
            ) : (
                <Select multiple value={selectedMachines} onChange={e => handleMachineChange(e.target.value)} label="Machine *"
                    renderValue={sel => isAllMachinesSelected ? 'All Machines' : sel.length === 0 ? 'Select' : sel.slice(0, 2).join(', ') + (sel.length > 2 ? '...' : '')}>
                    <MenuItem value="all"><Checkbox checked={isAllMachinesSelected} sx={{ '&.Mui-checked': { color: '#f47803' } }} /><ListItemText primary="All Machines" /></MenuItem>
                    {availableMachines.map(m => (
                        <MenuItem key={m} value={m}><Checkbox checked={selectedMachines.includes(m)} sx={{ '&.Mui-checked': { color: '#f47803' } }} /><ListItemText primary={m} /></MenuItem>
                    ))}
                </Select>
            )}
        </FormControl>
    );

    const renderDateRange = () => (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker label="From" value={fromDate} onChange={setFromDate} format="DD-MM-YYYY" disableFuture
                slotProps={{ textField: { size: 'small', className: 'av2-filter' } }} />
            <DatePicker label="To" value={toDate} onChange={setToDate} format="DD-MM-YYYY" disableFuture minDate={fromDate}
                slotProps={{ textField: { size: 'small', className: 'av2-filter' } }} />
        </LocalizationProvider>
    );

    const renderShiftFilter = (value, onChange, disabled = false, single = false) => (
        <FormControl size="small" className="av2-filter" disabled={disabled}>
            <InputLabel>Shift</InputLabel>
            {single ? (
                <Select value={value} onChange={e => onChange(e.target.value)} label="Shift">
                    {shifts.map(s => <MenuItem key={s.shift_no} value={s.shift_no}>Shift {s.shift_no}</MenuItem>)}
                </Select>
            ) : (
                <Select multiple value={value} label="Shift"
                    onChange={e => {
                        const v = e.target.value;
                        if (v.includes('all')) {
                            onChange(isAllShiftsSelected ? [] : shifts.map(s => s.shift_no));
                        } else {
                            onChange(v);
                        }
                    }}
                    renderValue={sel => isAllShiftsSelected ? 'All Shifts' : sel.length === 0 ? 'Select Shift' : sel.map(v => `Shift ${v}`).join(', ')}>
                    <MenuItem value="all"><Checkbox checked={isAllShiftsSelected} sx={{ '&.Mui-checked': { color: '#f47803' } }} /><ListItemText primary="All Shifts" /></MenuItem>
                    {shifts.map(s => (
                        <MenuItem key={s.shift_no} value={s.shift_no}>
                            <Checkbox checked={value.includes(s.shift_no)} sx={{ '&.Mui-checked': { color: '#f47803' } }} />
                            <ListItemText primary={`Shift ${s.shift_no}`} />
                        </MenuItem>
                    ))}
                </Select>
            )}
        </FormControl>
    );

    const clearChart = () => setChartData(null);

    const renderParetoFilters = () => <>
        <FormControl size="small" className="av2-filter">
            <InputLabel>Period</InputLabel>
            <Select value={period} onChange={e => { setPeriod(e.target.value); clearChart(); }} label="Period">
                {PERIOD_OPTS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
        </FormControl>
        <FormControl size="small" className="av2-filter">
            <InputLabel>Top N</InputLabel>
            <Select value={topBars} onChange={e => { setTopBars(e.target.value); clearChart(); }} label="Top N">
                {TOP_N_OPTS.map(n => <MenuItem key={n} value={n}>Top {n}</MenuItem>)}
            </Select>
        </FormControl>
        <FormControl size="small" className="av2-filter">
            <InputLabel>Mini Charts</InputLabel>
            <Select value={topCount} onChange={e => { setTopCount(e.target.value); clearChart(); }} label="Mini Charts">
                {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={n}>Top {n}</MenuItem>)}
            </Select>
        </FormControl>
    </>;

    const renderFilters = () => {
        switch (tab) {
            case 'oee':
                return <>{renderGroupFilter()}{renderMachineFilter()}{renderDateRange()}{renderShiftFilter(selectedShift, setSelectedShift, false)}
                    <FormControl size="small" className="av2-filter"><InputLabel>Period</InputLabel>
                        <Select value={oeeView} onChange={e => { setOeeView(e.target.value); clearChart(); }} label="Period">
                            {VIEW_OPTS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                    </FormControl></>;
            case 'utilization':
                return <>{renderGroupFilter()}{renderMachineFilter()}{renderDateRange()}{renderShiftFilter(selectedShift, setSelectedShift, false)}
                    <FormControl size="small" className="av2-filter"><InputLabel>Period</InputLabel>
                        <Select value={utilView} onChange={e => { setUtilView(e.target.value); clearChart(); }} label="Period">
                            {VIEW_OPTS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                    </FormControl></>;
            case 'parts':
                return <>{renderGroupFilter()}{renderMachineFilter()}
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker label="From" value={partsFromDate} onChange={v => { setPartsFromDate(v); clearChart(); }} format="DD-MM-YYYY" disableFuture
                            slotProps={{ textField: { size: 'small', className: 'av2-filter' } }} />
                        <DatePicker label="To" value={partsToDate} onChange={v => { setPartsToDate(v); clearChart(); }} format="DD-MM-YYYY" disableFuture minDate={partsFromDate}
                            slotProps={{ textField: { size: 'small', className: 'av2-filter' } }} />
                    </LocalizationProvider></>;
            case 'parts_summary':
                return <>{renderGroupFilter()}{renderMachineFilter(true)}
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker label="Date" value={summaryDate} onChange={setSummaryDate} format="DD-MM-YYYY" disableFuture
                            slotProps={{ textField: { size: 'small', className: 'av2-filter' } }} />
                    </LocalizationProvider>
                    {renderShiftFilter(summaryShift, setSummaryShift, false, true)}</>;
            case 'cycle_time':
                return <>{renderGroupFilter()}{renderMachineFilter(true)}
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker label="Date" value={cycleDate} onChange={setCycleDate} format="DD-MM-YYYY" disableFuture
                            slotProps={{ textField: { size: 'small', className: 'av2-filter' } }} />
                    </LocalizationProvider>
                    {renderShiftFilter(cycleShift, setCycleShift, false, true)}
                    <FormControl size="small" className="av2-filter"><InputLabel>Component</InputLabel>
                        <Select value={cycleComponent} onChange={e => setCycleComponent(e.target.value)} label="Component">
                            <MenuItem value="all">All Components</MenuItem>
                            {availableComponents.map(c => <MenuItem key={c.name} value={c.name}>{c.name} ({c.code})</MenuItem>)}
                        </Select>
                    </FormControl></>;
            case 'downtime':
            case 'alarm':
                return <>{renderGroupFilter()}{renderMachineFilter()}{renderDateRange()}{renderShiftFilter(selectedShift, setSelectedShift, isShiftDisabled)}{renderParetoFilters()}</>;
            default:
                return null;
        }
    };

    // ── Chart builders ───────────────────────────────────────────────────────

    const buildParetoChart = (data, isExpanded, onOthersClick, onReasonClick, label) => {
        const allReasons = data.reasons || [];
        const totalSecs = allReasons.reduce((s, r) => s + r.total_duration_seconds, 0);

        // Build display list: top N + "Others" OR all when expanded
        let displayReasons;
        if (isExpanded) {
            let cum = 0;
            displayReasons = allReasons.map(r => {
                cum += r.total_duration_seconds;
                return { ...r, cumPct: totalSecs > 0 ? +((cum / totalSecs) * 100).toFixed(2) : 0, isOthers: false };
            });
        } else {
            const topItems = allReasons.slice(0, topBars);
            const restItems = allReasons.slice(topBars);
            let cum = 0;
            displayReasons = topItems.map(r => {
                cum += r.total_duration_seconds;
                return { ...r, cumPct: totalSecs > 0 ? +((cum / totalSecs) * 100).toFixed(2) : 0, isOthers: false };
            });
            if (restItems.length > 0) {
                const othersSecs = restItems.reduce((s, r) => s + r.total_duration_seconds, 0);
                displayReasons.push({
                    name: 'Others',
                    total_duration_seconds: othersSecs,
                    cumPct: 100,
                    isOthers: true,
                });
            }
        }

        const barColors = displayReasons.map((r, i) => r.isOthers ? '#9e9e9e' : BAR_COLORS[i % BAR_COLORS.length]);
        // Both series use {x, y} objects so handleFormatXY never receives undefined x
        const barData = displayReasons.map((r, i) => ({
            x: String(r.name ?? ''),
            y: secsToHours(r.total_duration_seconds),
            fillColor: barColors[i],
        }));
        const lineData = displayReasons.map(r => ({
            x: String(r.name ?? ''),
            y: r.cumPct,
        }));
        const secondsData = displayReasons.map(r => ({
            x: String(r.name ?? ''),
            y: r.total_duration_seconds,
        }));
        const hours = barData.map(d => d.y);
        const cumPct = lineData.map(d => d.y);

        const truncLabel = v => v && v.length > 14 ? v.slice(0, 13) + '…' : (v || '');

        const options = {
            chart: {
                type: 'line',
                height: 460,
                width: '100%',
                toolbar: chartToolbar(`${label || 'Pareto'} Analysis`),
                fontFamily: 'inherit',
                animations: { enabled: true, speed: 600 },
                zoom: { enabled: false },
                selection: { enabled: false },
                redrawOnWindowResize: true,
                redrawOnParentResize: true,
                events: {
                    mouseMove: (event, chartCtx, config) => {
                        let idx = config.dataPointIndex;
                        if (idx < 0) {
                            const tx = chartCtx?.w?.globals?.translateX ?? 0;
                            const gridW = chartCtx?.w?.globals?.gridWidth ?? 0;
                            const relX = (event.offsetX || 0) - tx;
                            if (gridW > 0 && relX >= 0 && relX <= gridW)
                                idx = Math.floor((relX / gridW) * displayReasons.length);
                        }
                        const hovered = displayReasons[idx];
                        const clickable = hovered?.isOthers || hovered?.name?.trim().toLowerCase() === 'b/c correction';
                        const el = chartCtx?.el;
                        if (el) el.style.cursor = clickable ? 'pointer' : 'default';
                    },
                    click: (event, chartCtx, config) => {
                        let idx = config.dataPointIndex;
                        // If not clicking on a bar (tiny bar, empty area, or x-axis label), calculate from x position
                        if (idx < 0) {
                            const tx = chartCtx?.w?.globals?.translateX ?? 0;
                            const gridW = chartCtx?.w?.globals?.gridWidth ?? 0;
                            const numCats = displayReasons.length;
                            const relX = (event.offsetX || 0) - tx;
                            if (gridW > 0 && relX >= 0 && relX <= gridW)
                                idx = Math.floor((relX / gridW) * numCats);
                        }
                        if (idx < 0 || idx >= displayReasons.length) return;
                        const clicked = displayReasons[idx];
                        if (!clicked) return;
                        if (clicked.isOthers) {
                            onOthersClick();
                        } else if (clicked.name.trim().toLowerCase() === 'b/c correction') {
                            onReasonClick();
                        }
                    },
                },
            },
            plotOptions: {
                bar: { borderRadius: 4, columnWidth: '65%', distributed: false },
            },
            colors: ['#e0e0e0', '#27ae60', 'transparent'],
            stroke: { width: [0, 2.5, 0], curve: 'smooth' },
            markers: {
                size: [0, 5, 0],
                strokeColors: '#fff',
                strokeWidth: 2,
                hover: { size: 7 },
            },
            dataLabels: {
                enabled: true,
                enabledOnSeries: [0],
                formatter: v => `${v} h`,
                style: { fontSize: '10px', fontWeight: 700, colors: ['#333'] },
                offsetY: -16,
                background: { enabled: false },
            },
            xaxis: {
                type: 'category',
                labels: {
                    rotate: -40,
                    rotateAlways: true,
                    style: { fontSize: '11px', colors: '#555' },
                    formatter: truncLabel,
                    hideOverlappingLabels: false,
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
                tooltip: { enabled: false },
            },
            yaxis: [
                {
                    seriesName: 'Duration',
                    title: { text: 'Duration (h)', style: { fontSize: '11px', color: '#888' } },
                    labels: { formatter: v => `${v} h`, style: { fontSize: '11px' } },
                    axisBorder: { show: false },
                },
                {
                    seriesName: 'Cumulative %',
                    opposite: true,
                    min: 0,
                    max: 100,
                    tickAmount: 5,
                    labels: { formatter: v => `${v}%`, style: { fontSize: '11px' } },
                    axisBorder: { show: false },
                },
                {
                    seriesName: 'Duration (s)',
                    show: false,
                    labels: { show: false },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                },
            ],
            legend: { show: false },
            grid: {
                borderColor: '#f0f0f0',
                strokeDashArray: 4,
                xaxis: { lines: { show: false } },
                padding: { top: 32, right: 20, bottom: 0, left: 20 },
            },
            tooltip: {
                shared: true,
                intersect: false,
                custom: ({ dataPointIndex }) => {
                    const item = displayReasons[dataPointIndex] || {};
                    const name = item.name || '';
                    const duration = hours[dataPointIndex] ?? 0;
                    const cum = cumPct[dataPointIndex] ?? 0;
                    const color = barColors[dataPointIndex] || '#999';
                    const hint = item.isOthers ? `<div style="color:#888;font-size:11px;margin-top:4px;padding-top:4px;border-top:1px solid #f0f0f0">Click to expand all reasons</div>` : '';
                    return `<div style="padding:10px 14px;font-size:12px;line-height:1.8;background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:160px">
                        <div style="font-weight:700;color:#1a202c;margin-bottom:4px;border-bottom:1px solid #f0f0f0;padding-bottom:4px">${name}</div>
                        <div style="display:flex;align-items:center;gap:6px">
                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
                            <span style="color:#555">Duration:</span>
                            <b style="color:#1a202c">${duration} h</b>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px">
                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#27ae60"></span>
                            <span style="color:#555">Cumulative:</span>
                            <b style="color:#27ae60">${cum}%</b>
                        </div>
                        ${hint}
                    </div>`;
                },
            },
        };

        const series = [
            { name: 'Duration', type: 'bar', data: barData },
            { name: 'Cumulative %', type: 'line', data: lineData },
            { name: 'Duration (s)', type: 'line', data: secondsData },
        ];

        return { options, series };
    };

    const buildMiniChart = (item, color) => {
        const pts = item.data || [];
        const labels = pts.map(d => d.period);
        const hours = pts.map(d => secsToHours(d.duration_seconds));

        return {
            options: {
                chart: {
                    type: 'line',
                    height: 220,
                    toolbar: chartToolbar(item.name || 'Mini Chart'),
                    fontFamily: 'inherit',
                    animations: { enabled: true, speed: 500 },
                    zoom: { enabled: false },
                },
                stroke: { width: 2.5, curve: 'straight' },
                colors: [color || '#f4a72a'],
                markers: {
                    size: 5,
                    colors: [color || '#f4a72a'],
                    strokeColors: '#fff',
                    strokeWidth: 2,
                    hover: { size: 7 },
                },
                dataLabels: {
                    enabled: true,
                    formatter: v => v > 0 ? `${v} h` : '',
                    style: { fontSize: '10px', fontWeight: 700, colors: ['#444'] },
                    offsetY: -10,
                    offsetX: 0,
                    background: { enabled: false },
                },
                xaxis: {
                    type: 'category',
                    categories: labels,
                    labels: { rotate: -30, style: { fontSize: '10px', colors: '#888' } },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    tooltip: { enabled: false },
                },
                yaxis: {
                    min: 0,
                    labels: { formatter: v => `${v} h`, style: { fontSize: '10px', colors: '#888' } },
                    title: { text: 'Duration', style: { fontSize: '10px', color: '#aaa' } },
                    axisBorder: { show: false },
                },
                grid: {
                    borderColor: '#f5f5f5',
                    strokeDashArray: 4,
                    xaxis: { lines: { show: false } },
                    padding: { top: 24, right: 16, bottom: 0, left: 25 },
                },
                tooltip: {
                    custom: ({ dataPointIndex }) => {
                        const label = labels[dataPointIndex] || '';
                        const duration = hours[dataPointIndex] ?? 0;
                        return `<div style="padding:8px 12px;font-size:12px;line-height:1.8;background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:140px">
                            <div style="font-weight:700;color:#1a202c;margin-bottom:3px;border-bottom:1px solid #f0f0f0;padding-bottom:3px">${label}</div>
                            <div style="display:flex;align-items:center;gap:6px">
                                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
                                <span style="color:#555">Duration:</span>
                                <b style="color:#1a202c">${duration} h</b>
                            </div>
                        </div>`;
                    },
                },
            },
            series: [{ name: 'Duration', data: hours }],
        };
    };

    const buildBluecardChart = (bluecard) => {
        const labels = bluecard.map(b => b.reason_name);
        const hours = bluecard.map(b => secsToHours(b.total_duration_seconds));
        const colors = bluecard.map((_, i) => BLUECARD_COLORS[i % BLUECARD_COLORS.length]);
        const truncLabel = v => v && v.length > 16 ? v.slice(0, 15) + '…' : (v || '');

        return {
            options: {
                chart: {
                    type: 'bar',
                    height: 380,
                    toolbar: chartToolbar('BC Correction Sub Reasons'),
                    fontFamily: 'inherit',
                    animations: { enabled: true, speed: 500 },
                    zoom: { enabled: false },
                },
                plotOptions: { bar: { borderRadius: 5, columnWidth: '40%', distributed: true, dataLabels: { position: 'top' } } },
                colors,
                dataLabels: {
                    enabled: true,
                    formatter: (v, { dataPointIndex }) => {
                        const occ = bluecard[dataPointIndex]?.occurrence ?? 0;
                        return [`${occ}`, `${v} h`];
                    },
                    style: { fontSize: '11px', fontWeight: 700, colors: ['#333'] },
                    offsetY: -45,
                    background: { enabled: false },
                },
                xaxis: {
                    type: 'category',
                    categories: labels,
                    labels: {
                        rotate: -30,
                        style: { fontSize: '11px', colors: '#555' },
                        formatter: truncLabel,
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    tooltip: { enabled: false },
                },
                yaxis: {
                    labels: { formatter: v => `${v} h`, style: { fontSize: '11px' } },
                    axisBorder: { show: false },
                },
                legend: { show: false },
                grid: {
                    borderColor: '#f0f0f0',
                    strokeDashArray: 4,
                    padding: { top: 48, right: 16, bottom: 0, left: 16 },
                },
                tooltip: {
                    custom: ({ dataPointIndex }) => {
                        const b = bluecard[dataPointIndex] || {};
                        const color = colors[dataPointIndex] || '#999';
                        return `<div style="padding:10px 14px;font-size:12px;line-height:1.8;background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:150px">
                            <div style="font-weight:700;color:#1a202c;margin-bottom:4px;border-bottom:1px solid #f0f0f0;padding-bottom:4px">${b.reason_name || ''}</div>
                            <div style="display:flex;align-items:center;gap:6px">
                                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
                                <span style="color:#555">Duration:</span>
                                <b>${secsToHours(b.total_duration_seconds ?? 0)} h</b>
                            </div>
                            <div style="display:flex;align-items:center;gap:6px">
                                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#1e88e5"></span>
                                <span style="color:#555">Occurrences:</span>
                                <b style="color:#1e88e5">${b.occurrence ?? 0}</b>
                            </div>
                        </div>`;
                    },
                },
            },
            series: [{ name: 'Duration', data: hours }],
        };
    };


    const buildMachineLineChart = (data, label, period, metricField) => {
        const periodLabel = period === 'week' ? 'Week wise' : period === 'month' ? 'Month wise' : 'Day wise';
        const raw = (data.data || []).slice().sort((a, b) => new Date(a.period_start) - new Date(b.period_start));
        const field = metricField || (raw[0] ? Object.keys(raw[0]).find(k => k !== 'period_start') : 'value');

        const fmtLabel = (iso) => {
            const d = dayjs(iso); // auto-converts UTC to local time
            if (period === 'week') return `FW-${String(d.isoWeek()).padStart(2, '0')}`;
            if (period === 'month') return d.format('MMM YYYY');
            return d.format('DD-MM-YYYY');
        };

        const seriesData = raw.map(d => ({
            x: fmtLabel(d.period_start),
            y: +(parseFloat(d[field] ?? 0)).toFixed(1),
        }));

        const series = [{ name: label, data: seriesData }];
        const colors = ['#f47803'];

        const options = {
            chart: {
                type: 'line',
                height: 520,
                toolbar: chartToolbar(`${label} - ${periodLabel}`),
                fontFamily: 'inherit',
                animations: { enabled: true, speed: 500 },
                zoom: { enabled: false },
            },
            stroke: { width: 3, curve: 'smooth' },
            colors,
            markers: { size: 6, strokeColors: '#fff', strokeWidth: 2, hover: { size: 8 } },
            dataLabels: {
                enabled: true,
                formatter: v => `${v}%`,
                style: { fontSize: '11px', fontWeight: 700, colors: ['#333'] },
                offsetY: -15,
                background: { enabled: false },
            },
            xaxis: {
                type: 'category',
                labels: { rotate: -30, style: { fontSize: '11px', colors: '#555' } },
                axisBorder: { show: false },
                axisTicks: { show: false },
                tooltip: { enabled: false },
            },
            yaxis: {
                min: 0,
                max: 100,
                tickAmount: 5,
                labels: {
                    formatter: v => `${v}%`,
                    style: { fontSize: '11px' },
                    minWidth: 48,
                },
                title: { text: label, style: { fontSize: '12px', color: '#888' } },
                axisBorder: { show: false },
            },
            legend: {
                show: true,
                position: 'bottom',
                fontSize: '12px',
                markers: { width: 10, height: 10, radius: 5 },
            },
            grid: {
                borderColor: '#f0f0f0',
                strokeDashArray: 4,
                padding: { top: 36, right: 24, bottom: 0, left: 60 },
            },
            title: {
                text: `${label} — ${periodLabel}`,
                align: 'center',
                style: { fontSize: '14px', fontWeight: 700, color: '#1a202c' },
            },
            tooltip: {
                shared: true,
                intersect: false,
                y: { formatter: v => `${v}%` },
            },
        };

        return { options, series };
    };

    const buildPartsMonthlyChart = (monthly, metricKey, chartTitle, metricLabel) => {
        const rows = (monthly || [])
            .slice()
            .sort((a, b) => new Date(a.month_start) - new Date(b.month_start))
            .map(mo => ({
                label: dayjs(mo.month_start).add(1, 'day').format("MMM 'YY"),
                actual: mo.actual || 0,
                target: mo.tar || 0,
                metric: +(parseFloat(mo[metricKey] ?? 0)).toFixed(1),
            }));

        const totalActual = rows.reduce((s, r) => s + r.actual, 0);
        const totalTarget = rows.reduce((s, r) => s + r.target, 0);
        const totalMetric = totalTarget > 0
            ? +(rows.reduce((s, r) => s + r.metric * r.target, 0) / totalTarget).toFixed(1)
            : 0;
        rows.push({ label: 'Total', actual: totalActual, target: totalTarget, metric: totalMetric });

        const maxBarVal = Math.max(...rows.map(r => Math.max(r.target, r.actual)), 0);

        const firstLabel = rows.length > 1 ? rows[0].label : '';
        const lastLabel = rows.length > 1 ? rows[rows.length - 2].label : '';
        const subtitle = `Actual Vs Target Output (${firstLabel} - ${lastLabel} + Total)`;

        const options = {
            chart: {
                type: 'line', height: 340,
                toolbar: chartToolbar(chartTitle), fontFamily: 'inherit',
                animations: { enabled: true, speed: 500 }, zoom: { enabled: false },
            },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
            colors: ['#3f51b5', '#4caf50', '#e53935'],
            stroke: { width: [0, 0, 2.5], curve: 'smooth' },
            markers: { size: [0, 0, 5], strokeColors: '#fff', strokeWidth: 2, hover: { size: 7 } },
            dataLabels: {
                enabled: true,
                enabledOnSeries: [0, 1, 2],
                formatter: (v, { seriesIndex }) => seriesIndex === 2 ? `${v}%` : `${v}`,
                style: { fontSize: '10px', fontWeight: 700, colors: ['#283593', '#1b5e20', '#c62828'] },
                offsetY: -16,
                background: { enabled: false },
            },
            xaxis: {
                type: 'category',
                labels: { style: { fontSize: '11px', colors: '#555' } },
                axisBorder: { show: false }, axisTicks: { show: false },
                tooltip: { enabled: false },
            },
            yaxis: [
                {
                    seriesName: 'Target',
                    min: 0, max: maxBarVal,
                    title: { text: 'Units', style: { fontSize: '11px', color: '#888' } },
                    labels: { style: { fontSize: '11px' } },
                    axisBorder: { show: false },
                },
                { seriesName: 'Actual', show: false, min: 0, max: maxBarVal },
                {
                    seriesName: metricLabel,
                    opposite: true,
                    min: 0,
                    title: { text: `${metricLabel} %`, style: { fontSize: '11px', color: '#888' } },
                    labels: { formatter: v => `${v}%`, style: { fontSize: '11px' } },
                    axisBorder: { show: false },
                },
            ],
            legend: { show: true, position: 'bottom', fontSize: '12px', markers: { width: 10, height: 10, radius: 5 } },
            grid: { borderColor: '#f0f0f0', strokeDashArray: 4, padding: { top: 44, right: 20, bottom: 0, left: 16 } },
            title: { text: chartTitle, align: 'left', style: { fontSize: '13px', fontWeight: 700, color: '#1a202c' } },
            subtitle: { text: subtitle, align: 'left', style: { fontSize: '11px', color: '#888' } },
            tooltip: {
                shared: true, intersect: false,
                y: [{ formatter: v => `${v}` }, { formatter: v => `${v}` }, { formatter: v => `${v}%` }],
            },
        };

        return {
            options,
            series: [
                { name: 'Target', type: 'bar', data: rows.map(r => ({ x: r.label, y: r.target })) },
                { name: 'Actual', type: 'bar', data: rows.map(r => ({ x: r.label, y: r.actual })) },
                { name: metricLabel, type: 'line', data: rows.map(r => ({ x: r.label, y: r.metric })) },
            ],
        };
    };

    const renderPartsContent = (data) => {
        const calcPeriod = ({ tar, actual } = {}) => {
            const a = actual || 0, t = tar || 0;
            return { actual: a, target: t, difference: a - t, performance: t > 0 ? +((a / t) * 100).toFixed(1) : 0 };
        };

        const today = calcPeriod(data.today);
        const yesterday = calcPeriod(data.yesterday);
        const week = calcPeriod(data.thisWeek);
        const todayPct = today.performance;
        const diff = +(todayPct - yesterday.performance).toFixed(1);

        const utilChart = buildPartsMonthlyChart(data.monthlyUtilization, 'utilization', 'Monthly Utilization Trend', 'Utilization');
        const perfChart = buildPartsMonthlyChart(data.monthlyEfficiency, 'efficiency', 'Monthly Performance Trend', 'Efficiency');

        const tableRows = [
            { label: 'Today', ...today },
            { label: 'Yesterday', ...yesterday },
            { label: 'This Week', ...week },
        ];

        return (
            <Box sx={{ width: '100%' }}>
                {/* Gauge + Production table */}
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'stretch' }}>
                    <Box className="av2-chart-card" sx={{ p: 2, minWidth: 190, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.8rem', color: '#888', mb: 1.5 }}>Today Efficiency</Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 120, textAlign: 'right' }}>
                                {[100, 80, 60, 40, 20, 0].map(v => (
                                    <Typography key={v} sx={{ fontSize: '9px', color: '#aaa', lineHeight: 1 }}>{v}</Typography>
                                ))}
                            </Box>
                            <Box sx={{ width: 20, height: 120, border: '1.5px solid #ddd', borderRadius: '10px', overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'flex-end' }}>
                                <Box sx={{ width: '100%', height: `${Math.min(100, Math.max(0, todayPct))}%`, background: 'linear-gradient(to top, #b71c1c, #e53935)', borderRadius: '8px', transition: 'height 0.6s ease' }} />
                            </Box>
                        </Box>
                        <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#e53935', mt: 1.5, lineHeight: 1 }}>{todayPct}%</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: diff >= 0 ? '#43a047' : '#e53935', mt: 0.5 }}>
                            {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} vs Yesterday
                        </Typography>
                    </Box>

                    <Box className="av2-chart-card" sx={{ flex: 1, p: 2 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1.5, color: '#1a202c', ml: 1.5 }}>Production Data</Typography>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr>
                                    {['METRIC', 'ACTUAL', 'TARGET', 'DIFFERENCE', 'PERFORMANCE'].map(h => (
                                        <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: '#888', fontWeight: 600, fontSize: '11px', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                        <td style={{ padding: '10px 12px', color: '#555', fontWeight: 500 }}>{r.label}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a202c' }}>{r.actual}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a202c' }}>{r.target}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 700, color: r.difference < 0 ? '#e53935' : '#43a047' }}>{r.difference}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a202c' }}>{r.performance}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Box>
                </Box>

                {/* Monthly charts */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box className="av2-chart-card">
                        <ReactApexChart options={utilChart.options} series={utilChart.series} type="line" height={340} width="100%" />
                    </Box>
                    <Box className="av2-chart-card">
                        <ReactApexChart options={perfChart.options} series={perfChart.series} type="line" height={340} width="100%" />
                    </Box>
                </Box>
            </Box>
        );
    };

    // ── HH:MM:SS → seconds ───────────────────────────────────────────────────
    const parseHMS = (hms) => {
        if (!hms || typeof hms !== 'string') return 0;
        const [h = 0, m = 0, s = 0] = hms.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    };

    const fmtSec = (sec) => {
        const s = Math.round(sec);
        if (s >= 3600) {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const rem = s % 60;
            return `${h} hr ${m} min ${rem} s`;
        }
        if (s >= 60) return `${Math.floor(s / 60)} min ${s % 60} s`;
        return `${s} s`;
    };

    // ── Parts Summary chart (Runtime vs Idle Time per part) ──────────────────
    const buildPartsSummaryChart = (rawData) => {
        const fmtTs = ts => ts ? dayjs(ts).format('hh:mm:ss A') : '-';
        const data = Array.isArray(rawData) ? rawData : [];

        // Flatten every individual segment in chronological order
        const allSegments = [];
        data.forEach(d => {
            (d.runtime || []).forEach(s => allSegments.push({ ...s, segType: 'runtime', component: d.component_name, partscount: d.partscount }));
            (d.idletime || []).forEach(s => allSegments.push({ ...s, segType: 'idle', component: d.component_name, partscount: d.partscount }));
        });
        allSegments.sort((a, b) => a.start_time - b.start_time);

        // Use sequential index so bars never merge; label formatter shows partscount
        const runtimeData = allSegments.map((s, i) => ({ x: i, y: s.segType === 'runtime' ? +(s.duration / 1000).toFixed(1) : null }));
        const idleData = allSegments.map((s, i) => ({ x: i, y: s.segType === 'idle' ? +(s.duration / 1000).toFixed(1) : null }));

        return {
            segments: allSegments,
            series: [
                { name: 'Runtime', data: runtimeData },
                { name: 'Idle Time', data: idleData },
            ],
            options: {
                chart: { type: 'bar', height: 420, toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }, export: chartToolbar('Part Wise Summary').export }, fontFamily: 'inherit', zoom: { enabled: true, type: 'x' }, selection: { enabled: true, type: 'x' }, animations: { enabled: false } },
                plotOptions: { bar: { borderRadius: 2, columnWidth: '80%', distributed: false } },
                colors: ['#4caf50', '#f4b942'],
                dataLabels: { enabled: false },
                legend: { show: true, position: 'top', fontSize: '12px', markers: { width: 10, height: 10, radius: 5 } },
                xaxis: {
                    type: 'numeric',
                    title: { text: 'Parts Count', style: { fontSize: '12px', color: '#888' } },
                    labels: { formatter: v => String(allSegments[Math.round(v)]?.partscount ?? Math.round(v)), style: { fontSize: '10px' } },
                    axisBorder: { show: false }, axisTicks: { show: false },
                    tooltip: { enabled: false },
                },
                yaxis: {
                    title: { text: 'Time', style: { fontSize: '12px', color: '#888' } },
                    labels: { formatter: v => v >= 60 ? `${Math.floor(v / 60)} min` : `${v} sec`, style: { fontSize: '11px' } },
                    axisBorder: { show: false },
                },
                grid: { borderColor: '#f0f0f0', strokeDashArray: 4, padding: { top: 16, right: 16, bottom: 0, left: 16 } },
                tooltip: {
                    custom: ({ dataPointIndex }) => {
                        const s = allSegments[dataPointIndex] || {};
                        const color = s.segType === 'runtime' ? '#4caf50' : '#f4b942';
                        const label = s.segType === 'runtime' ? 'Runtime' : 'Idle Time';
                        return `<div style="padding:10px 14px;font-size:12px;line-height:1.9;background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:220px">
                            <div style="font-weight:700;color:${color};margin-bottom:6px">● ${label}</div>
                            ${s.component ? `<div><span style="color:#888">Component:</span> <b>${s.component}</b></div>` : ''}
                            <div><span style="color:#888">Parts Count:</span> <b>${s.partscount ?? 0}</b></div>
                            <div><span style="color:#888">Start:</span> <b>${fmtTs(s.start_time)}</b></div>
                            <div><span style="color:#888">End:</span> <b>${fmtTs(s.end_time)}</b></div>
                            <div><span style="color:#888">Duration:</span> <b>${fmtSec(s.duration / 1000)}</b></div>
                        </div>`;
                    },
                },
            },
        };
    };

    // ── Cycle Time Analysis chart ─────────────────────────────────────────────
    const buildCycleTimeChart = (rawData) => {
        const data = [...rawData].sort((a, b) => (a.partscount_start_time || 0) - (b.partscount_start_time || 0));
        const total = data.length;

        // Group consecutive entries by component name, then merge same-named groups
        // separated only by null/empty gaps
        const rawGroups = [];
        data.forEach((d, i) => {
            const last = rawGroups[rawGroups.length - 1];
            if (!last || last.name !== d.component_name) {
                rawGroups.push({
                    name: d.component_name || '', start: i, end: i,
                    cycleTime: d.component_cycle_time, handlingTime: d.component_handling_time
                });
            } else {
                last.end = i;
            }
        });
        // Merge same-name groups across null gaps so one component doesn't show multiple boxes
        const groups = [];
        rawGroups.forEach(g => {
            if (!g.name) return; // skip null-component gaps
            const last = groups[groups.length - 1];
            if (last && last.name === g.name) {
                last.end = g.end; // extend range
            } else {
                groups.push({ ...g });
            }
        });

        // Per-entry std for stats and exceeds
        const getStd = d => d.component_cycle_time ? parseHMS(d.component_cycle_time) : null;
        const getStdH = d => d.component_handling_time ? parseHMS(d.component_handling_time) : null;

        const fastCycle = data.filter(d => { const s = getStd(d); return s && d.totalrunduration / 1000 < s; }).length;
        const slowCycle = data.filter(d => { const s = getStd(d); return s && d.totalrunduration / 1000 > s; }).length;
        const fastHandle = data.filter(d => { const s = getStdH(d); return s && d.totalidleduration / 1000 < s; }).length;
        const slowHandle = data.filter(d => { const s = getStdH(d); return s && d.totalidleduration / 1000 > s; }).length;

        const cycleVals = data.map(d => +(d.totalrunduration / 1000).toFixed(1));
        const handleVals = data.map(d => +(d.totalidleduration / 1000).toFixed(1));

        const series = [
            { name: 'Cycle Time', type: 'bar', data: data.map((d, i) => ({ x: i, y: cycleVals[i] })) },
            { name: 'Handling Time', type: 'bar', data: data.map((d, i) => ({ x: i, y: handleVals[i] })) },
        ];

        // One std cycle + std handling annotation per unique component group
        const seenStd = new Set();
        const yAnnotations = [];
        groups.forEach(g => {
            const sc = g.cycleTime ? parseHMS(g.cycleTime) : null;
            const sh = g.handlingTime ? parseHMS(g.handlingTime) : null;
            if (sc && !seenStd.has(`c${sc}`)) {
                seenStd.add(`c${sc}`);
                yAnnotations.push({ y: sc, borderColor: '#4caf50', strokeDashArray: 6, borderWidth: 2, label: { text: 'Std Cycle', position: 'right', style: { background: 'transparent', color: '#4caf50', fontSize: '10px' } } });
            }
            if (sh && !seenStd.has(`h${sh}`)) {
                seenStd.add(`h${sh}`);
                yAnnotations.push({ y: sh, borderColor: '#f4b942', strokeDashArray: 6, borderWidth: 2, label: { text: 'Std Handling', position: 'right', style: { background: 'transparent', color: '#f4b942', fontSize: '10px' } } });
            }
        });

        // Exceeds markers — per-entry std
        const pointAnnotations = data.map((d, i) => {
            const s = getStd(d);
            return (s && d.totalrunduration / 1000 > s) ? {
                x: i, y: cycleVals[i],
                marker: { size: 7, fillColor: '#e53935', strokeColor: '#b71c1c', strokeWidth: 1, shape: 'triangle', offsetY: -4 },
            } : null;
        }).filter(Boolean);

        const options = {
            chart: { type: 'bar', height: 420, toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }, export: chartToolbar('Cycle Time Analysis').export }, fontFamily: 'inherit', zoom: { enabled: true, type: 'x' }, selection: { enabled: true, type: 'x' }, animations: { enabled: false } },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '65%', distributed: false } },
            colors: ['#4caf50', '#f4b942'],
            stroke: { show: false },
            dataLabels: { enabled: false },
            xaxis: {
                type: 'numeric',
                title: { text: 'Part Count', style: { fontSize: '12px', color: '#888' } },
                labels: { formatter: v => String(data[Math.round(v)]?.partscount ?? Math.round(v)), style: { fontSize: '10px' } },
                axisBorder: { show: false }, axisTicks: { show: false },
                tooltip: { enabled: false },
            },
            yaxis: {
                title: { text: 'Time', style: { fontSize: '12px', color: '#888' } },
                labels: { formatter: v => v >= 60 ? `${Math.floor(v / 60)} min` : `${v} s`, style: { fontSize: '11px' } },
                axisBorder: { show: false },
            },
            annotations: {
                yaxis: yAnnotations,
                points: pointAnnotations,
                xaxis: groups.length > 1 ? groups.map(g => ({
                    x: g.start - 0.5,
                    x2: g.end + 0.5,
                    fillColor: 'transparent',
                    borderColor: '#bbb',
                    strokeDashArray: 5,
                    borderWidth: 1.5,
                    opacity: 1,
                })) : [],
            },
            legend: { show: false },
            grid: { borderColor: '#f0f0f0', strokeDashArray: 4, padding: { top: 56, right: 16, bottom: 0, left: 16 } },
            tooltip: {
                shared: true, intersect: false,
                custom: ({ dataPointIndex }) => {
                    const d = data[dataPointIndex] || {};
                    const ct = fmtSec(d.totalrunduration / 1000);
                    const ht = fmtSec(d.totalidleduration / 1000);
                    const stdC = getStd(d);
                    const exceeds = stdC && d.totalrunduration / 1000 > stdC;
                    return `<div style="padding:10px 14px;font-size:12px;line-height:1.8;background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:180px">
                        ${d.component_name ? `<div style="font-weight:700;border-bottom:1px solid #f0f0f0;padding-bottom:4px;margin-bottom:6px">${d.component_name}</div>` : ''}
                        <div><span style="color:#888">Parts Count:</span> <b>${d.partscount ?? 0}</b></div>
                        <div><span style="color:#4caf50">●</span> Cycle Time: <b>${ct}</b>${exceeds ? ' <span style="color:#e53935">▲</span>' : ''}</div>
                        <div><span style="color:#f4b942">●</span> Handling Time: <b>${ht}</b></div>
                        ${d.component_cycle_time ? `<div style="color:#888;font-size:11px;margin-top:4px">M: ${d.component_cycle_time}</div>` : ''}
                        ${d.component_handling_time ? `<div style="color:#888;font-size:11px">H: ${d.component_handling_time}</div>` : ''}
                    </div>`;
                },
            },
        };

        return { series, options, stats: { total, fastCycle, slowCycle, fastHandle, slowHandle }, groups, total };
    };

    const buildIdleReasonChart = (data) => {
        const reasons = (data.idleReasonWithPercentage || []).slice().sort((a, b) => b.total_idle_duration - a.total_idle_duration);
        const labels = reasons.map(r => r.name?.trim() || 'Unknown');
        const durs = reasons.map(r => +(r.total_idle_duration / 60).toFixed(1)); // seconds → minutes
        const counts = reasons.map(r => r.count || 0);
        const pcts = reasons.map(r => +(parseFloat(r.percentage)).toFixed(1));
        const colors = reasons.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]);
        const truncL = v => v && v.length > 16 ? v.slice(0, 15) + '…' : (v || '');

        return {
            series: [{ name: 'Idle Duration (min)', data: durs.map((y, i) => ({ x: String(labels[i]), y, fillColor: colors[i] })) }],
            options: {
                chart: { type: 'bar', height: 460, toolbar: chartToolbar('Idle Reason Report'), fontFamily: 'inherit', zoom: { enabled: false }, animations: { enabled: true, speed: 500 } },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '60%', distributed: true, dataLabels: { position: 'top' } } },
                colors,
                dataLabels: { enabled: true, formatter: v => `${v} m`, style: { fontSize: '10px', fontWeight: 700, colors: ['#333'] }, offsetY: -14, background: { enabled: false } },
                xaxis: { type: 'category', labels: { rotate: -35, formatter: truncL, style: { fontSize: '11px', colors: '#555' } }, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } },
                yaxis: { title: { text: 'Duration (min)', style: { fontSize: '11px', color: '#888' } }, labels: { formatter: v => `${v} m`, style: { fontSize: '11px' } }, axisBorder: { show: false } },
                legend: { show: false },
                grid: { borderColor: '#f0f0f0', strokeDashArray: 4, padding: { top: 28, right: 16, bottom: 0, left: 16 } },
                tooltip: {
                    custom: ({ dataPointIndex }) => {
                        const r = reasons[dataPointIndex] || {};
                        const color = colors[dataPointIndex] || '#999';
                        return `<div style="padding:10px 14px;font-size:12px;line-height:1.8;background:#fff;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:180px">
                            <div style="font-weight:700;color:#1a202c;border-bottom:1px solid #f0f0f0;padding-bottom:4px;margin-bottom:4px">${r.name?.trim()}</div>
                            <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px"></span>Duration: <b>${fmtSec(r.total_idle_duration)}</b></div>
                            <div style="color:#555">Count: <b>${r.count}</b></div>
                            <div style="color:#555">Percentage: <b>${r.percentage}%</b></div>
                        </div>`;
                    },
                },
            },
        };
    };

    const renderChartArea = () => {
        if (isLoading) {
            const ChartSkeleton = ({ height = 520 }) => (
                <Box className="av2-chart-card" sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Skeleton variant="text" width={200} height={22} animation="wave" />
                        <Skeleton variant="circular" width={26} height={26} animation="wave" />
                    </Box>
                    <Skeleton variant="rounded" width="100%" height={height} animation="wave" sx={{ borderRadius: 2 }} />
                    <Skeleton variant="text" width="40%" height={18} animation="wave" sx={{ mx: 'auto', mt: 1.5 }} />
                </Box>
            );
            return (
                <Box sx={{ width: '100%' }}>
                    {tab === 'parts' ? (
                        <>
                            <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                                <Skeleton variant="rounded" width={220} height={220} animation="wave" sx={{ borderRadius: 3 }} />
                                <Skeleton variant="rounded" sx={{ flex: 1, height: 220, borderRadius: 3 }} animation="wave" />
                            </Box>
                            <Box sx={{ mb: 2 }}><ChartSkeleton height={280} /></Box>
                            <ChartSkeleton height={280} />
                        </>
                    ) : (
                        <ChartSkeleton />
                    )}
                </Box>
            );
        }

        if (iframeUrl && ['parts_summary', 'cycle_time'].includes(tab)) {
            return (
                <Box sx={{ width: '100%', height: '70vh' }}>
                    <iframe src={iframeUrl} title={tab} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }} />
                </Box>
            );
        }

        if (chartData && tab === 'parts') return renderPartsContent(chartData);

        if (!chartData && ['downtime', 'alarm'].includes(tab)) return (
            <Typography sx={{ color: '#aaa', fontSize: '0.95rem' }}>
                Select filters and click <b>Run Analysis</b> to load the <b>{TABS.find(t => t.value === tab)?.label}</b> chart.
            </Typography>
        );

        if (chartData && ['downtime', 'alarm'].includes(tab)) {
            const label = tab === 'downtime' ? 'Downtime' : 'Alarm';
            const onReasonClick = () => setSelectedReason(prev => prev === 'bluecard' ? null : 'bluecard');
            const pareto = buildParetoChart(chartData, expandedOthers, () => setExpandedOthers(true), onReasonClick, label);
            const breakdown = (chartData.breakdown || []).slice(0, topCount);
            const totalHours = secsToHours(chartData.total_duration_seconds || 0);

            return (
                <Box sx={{ width: '100%' }}>
                    {/* Total header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1a202c', letterSpacing: 0.2 }}>
                            Total {label} Duration:{' '}
                            <Box component="span" sx={{ color: '#e53935', fontWeight: 800 }}>{totalHours} hours</Box>
                        </Typography>
                        {expandedOthers && (
                            <Button size="small" variant="outlined"
                                onClick={() => setExpandedOthers(false)}
                                sx={{
                                    textTransform: 'none', fontSize: '0.78rem', borderColor: '#bbb', color: '#555',
                                    '&:hover': { borderColor: '#f47803', color: '#f47803' }
                                }}>
                                ▲ Show Top {topBars}
                            </Button>
                        )}
                    </Box>

                    {/* Main chart OR Bluecard chart (only this area swaps) */}
                    <Box sx={{ mb: 3 }}>
                        {selectedReason === 'bluecard' && chartData.bluecard?.length > 0 ? (() => {
                            const bc = buildBluecardChart(chartData.bluecard);
                            return (
                                <Box>
                                    {/* Blue header */}
                                    <Box sx={{
                                        background: 'linear-gradient(135deg,#1565c0 0%,#1e88e5 100%)',
                                        borderRadius: '12px 12px 0 0', px: 3, py: 1.5,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                                            B/C Correction — Sub Reasons
                                        </Typography>
                                        <Button size="small" onClick={() => setSelectedReason(null)}
                                            sx={{
                                                color: 'rgba(255,255,255,0.8)', textTransform: 'none', fontSize: '0.78rem',
                                                minWidth: 0, '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.12)' }
                                            }}>
                                            ← Back
                                        </Button>
                                    </Box>
                                    <Box className="av2-chart-card" sx={{ borderRadius: '0 0 12px 12px', pt: 0 }}>
                                        <ReactApexChart
                                            options={bc.options}
                                            series={bc.series}
                                            type="bar"
                                            height={380}
                                            width="100%"
                                        />
                                    </Box>
                                </Box>
                            );
                        })() : (
                            <Box className="av2-chart-card">
                                <ReactApexChart
                                    options={pareto.options}
                                    series={pareto.series}
                                    type="line"
                                    height={460}
                                    width="100%"
                                />
                            </Box>
                        )}
                    </Box>

                    {/* Mini Line Charts — always visible */}
                    {breakdown.length > 0 && (
                        <Box className="av2-mini-grid">
                            {breakdown.map((item, i) => {
                                const color = BAR_COLORS[i % BAR_COLORS.length];
                                const mini = buildMiniChart(item, color);
                                return (
                                    <Box key={i} className="av2-chart-card">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1, pt: 1 }}>
                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1a202c' }}>
                                                TOP {item.rank} — {item.name}
                                            </Typography>
                                            <Box sx={{ ml: 'auto', fontSize: '0.78rem', fontWeight: 600, color, background: `${color}18`, px: 1, py: 0.3, borderRadius: 1 }}>
                                                {formatH(item.total_duration_seconds)}
                                            </Box>
                                        </Box>
                                        <ReactApexChart
                                            options={mini.options}
                                            series={mini.series}
                                            type="line"
                                            height={220}
                                            width="100%"
                                        />
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </Box>
            );
        }

        if (chartData && tab === 'oee') {
            const chart = buildMachineLineChart(chartData, 'OEE', oeeView, 'oee');
            return (
                <Box sx={{ width: '100%' }}>
                    <Box className="av2-chart-card">
                        <ReactApexChart options={chart.options} series={chart.series} type="line" height={520} width="100%" />
                    </Box>
                </Box>
            );
        }

        if (chartData && tab === 'utilization') {
            const chart = buildMachineLineChart(chartData, 'Utilization', utilView, 'run');
            return (
                <Box sx={{ width: '100%' }}>
                    <Box className="av2-chart-card">
                        <ReactApexChart options={chart.options} series={chart.series} type="line" height={520} width="100%" />
                    </Box>
                </Box>
            );
        }

        return (
            <Typography sx={{ color: '#aaa', fontSize: '0.95rem' }}>
                Select filters and click <b>Run Analysis</b> to load the <b>{TABS.find(t => t.value === tab)?.label}</b> chart.
            </Typography>
        );
    };

    return (
        <Box className="av2-root">
            <Box className="av2-tabs-bar">
                <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto"
                    TabIndicatorProps={{ sx: { backgroundColor: '#f47803', height: 3 } }}
                    sx={{
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', minWidth: 110 },
                        '& .Mui-selected': { color: '#f47803 !important' }
                    }}>
                    {TABS.map(t => <Tab key={t.value} label={t.label} value={t.value} />)}
                </Tabs>
            </Box>

            <Box className="av2-filter-bar">
                {renderFilters()}
                <Tooltip title={isRunDisabled && !isLoading ? 'Select at least one machine' : ''}>
                    <span>
                        <Button variant="contained" onClick={handleRunAnalysis} disabled={isRunDisabled} className="av2-run-btn">
                            {isLoading ? <><CircularProgress size={16} sx={{ mr: 1, color: '#fff' }} />Analysing...</> : 'Run Analysis'}
                        </Button>
                    </span>
                </Tooltip>
            </Box>

            <Box className="av2-chart-area">
                {renderChartArea()}
            </Box>
        </Box>
    );
}
