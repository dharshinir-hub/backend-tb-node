import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import {
    Box, Typography, Tab, Tabs, FormControl, InputLabel, Select,
    MenuItem, Checkbox, ListItemText, Button, CircularProgress, Tooltip
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';
import { customerbasedshift, cleanCustomerId } from '../../Services/app/operatorservice';
import { getDowntimeAnalytics, getAlarmAnalytics, getMetricByPeriod, getPartsAnalytics } from '../../Services/app/analyticsservice';
import './AnalyticsV2.css';

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);

const TABS = [
    { value: 'utilization', label: 'Utilization' },
    { value: 'oee', label: 'OEE' },
    { value: 'parts', label: 'Parts' },
    // { value: 'parts_summary', label: 'Parts Summary' },
    // { value: 'cycle_time', label: 'Cycle Time' },
    // { value: 'downtime', label: 'Downtime' },
    // { value: 'alarm', label: 'Alarm' },
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

const AUTO_LOAD_TABS = ['utilization', 'oee', 'parts', 'downtime', 'alarm'];

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

    const {
        machineGroups, availableMachines, selectedMachines, selectedGroups,
        showMachineGroupsDropdown, isAllMachinesSelected,
        handleGroupChange, handleMachineChange, setSelectedMachines,
    } = useMachineGroups(customerId);

    const [tab, setTab] = useState('utilization');
    const [shifts, setShifts] = useState([]);
    const [selectedShift, setSelectedShift] = useState('all');
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
    const [availableComponents] = useState([]);

    const [period, setPeriod] = useState('day');
    const [topBars, setTopBars] = useState(20);
    const [topCount, setTopCount] = useState(3);

    const [isLoading, setIsLoading] = useState(false);
    const [chartData, setChartData] = useState(null);
    const [expandedOthers, setExpandedOthers] = useState(false);
    const [selectedReason, setSelectedReason] = useState(null);

    const needsAutoLoadRef = useRef(true);
    const requestIdRef     = useRef(0);

    useEffect(() => {
        if (!customerId) return;
        customerbasedshift(customerId, 'allShift').then(res => {
            const list = res?.[0]?.value || [];
            setShifts(list);
            if (list.length > 0) { setSummaryShift(list[0].shift_no); setCycleShift(list[0].shift_no); }
        }).catch(console.error);
    }, [customerId]);

    useEffect(() => {
        if (tab === 'cycle_time' && availableMachines.length > 0 && !cycleMachine)
            setCycleMachine(availableMachines[0]);
    }, [tab, availableMachines, cycleMachine]);

    // Mark that a fresh auto-load is needed whenever the tab changes
    useEffect(() => { needsAutoLoadRef.current = true; }, [tab]);

    // Execute auto-load once machines + shifts are ready
    useEffect(() => {
        if (!needsAutoLoadRef.current) return;
        if (!AUTO_LOAD_TABS.includes(tab)) return;
        if (selectedMachines.length === 0 || shifts.length === 0) return;
        needsAutoLoadRef.current = false;
        handleRunAnalysis(); // eslint-disable-line react-hooks/exhaustive-deps
    }, [tab, selectedMachines, shifts]); // eslint-disable-line react-hooks/exhaustive-deps

    const isShiftDisabled = useMemo(() => {
        if (['parts_summary', 'cycle_time', 'parts', 'downtime', 'alarm', 'oee', 'utilization'].includes(tab)) return false;
        return !fromDate || !toDate ? true : !fromDate.isSame(toDate, 'day');
    }, [tab, fromDate, toDate]);

    const isRunDisabled = useMemo(() => {
        if (tab === 'cycle_time') return !cycleMachine || !cycleDate || !cycleShift;
        return selectedMachines.length === 0;
    }, [tab, selectedMachines, cycleMachine, cycleDate, cycleShift]);

    const handleTabChange = (_, newTab) => { setTab(newTab); setSelectedShift('all'); setChartData(null); setExpandedOthers(false); setSelectedReason(null); };

    const handleRunAnalysis = async () => {
        const reqId = ++requestIdRef.current;

        const machines   = selectedMachines.join(',');
        const shiftParam = selectedShift === 'all' ? shifts.map(s => s.shift_no).join(',') : selectedShift;
        const from       = fromDate.format('YYYY-MM-DD');
        const to         = toDate.format('YYYY-MM-DD');
        const allShifts  = shifts.map(s => s.shift_no).join(',');

        setIsLoading(true);
        setChartData(null);
        setExpandedOthers(false);
        setSelectedReason(null);
        try {
            let res;
            if (tab === 'downtime') {
                res = await getDowntimeAnalytics(machines, shiftParam, from, to, topCount, period);
            } else if (tab === 'alarm') {
                res = await getAlarmAnalytics(machines, shiftParam, from, to, topCount, period);
            } else if (tab === 'parts') {
                res = await getPartsAnalytics(machines, allShifts, partsFromDate.format('YYYY-MM-DD'), partsToDate.format('YYYY-MM-DD'));
            } else if (tab === 'utilization') {
                res = await getMetricByPeriod(machines, shiftParam, from, to, utilView, 'availability');
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
                <Select value={value} onChange={e => onChange(e.target.value)} label="Shift">
                    <MenuItem value="all">All Shifts</MenuItem>
                    {shifts.map(s => <MenuItem key={s.shift_no} value={s.shift_no}>Shift {s.shift_no}</MenuItem>)}
                </Select>
            )}
        </FormControl>
    );

    const renderParetoFilters = () => <>
        <FormControl size="small" className="av2-filter">
            <InputLabel>Period</InputLabel>
            <Select value={period} onChange={e => setPeriod(e.target.value)} label="Period">
                {PERIOD_OPTS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
        </FormControl>
        <FormControl size="small" className="av2-filter">
            <InputLabel>Top N</InputLabel>
            <Select value={topBars} onChange={e => setTopBars(e.target.value)} label="Top N">
                {TOP_N_OPTS.map(n => <MenuItem key={n} value={n}>Top {n}</MenuItem>)}
            </Select>
        </FormControl>
        <FormControl size="small" className="av2-filter">
            <InputLabel>Mini Charts</InputLabel>
            <Select value={topCount} onChange={e => setTopCount(e.target.value)} label="Mini Charts">
                {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={n}>Top {n}</MenuItem>)}
            </Select>
        </FormControl>
    </>;

    const renderFilters = () => {
        switch (tab) {
            case 'oee':
                return <>{renderGroupFilter()}{renderMachineFilter()}{renderDateRange()}{renderShiftFilter(selectedShift, setSelectedShift, false)}
                    <FormControl size="small" className="av2-filter"><InputLabel>Period</InputLabel>
                        <Select value={oeeView} onChange={e => setOeeView(e.target.value)} label="Period">
                            {VIEW_OPTS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                    </FormControl></>;
            case 'utilization':
                return <>{renderGroupFilter()}{renderMachineFilter()}{renderDateRange()}{renderShiftFilter(selectedShift, setSelectedShift, false)}
                    <FormControl size="small" className="av2-filter"><InputLabel>Period</InputLabel>
                        <Select value={utilView} onChange={e => setUtilView(e.target.value)} label="Period">
                            {VIEW_OPTS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </Select>
                    </FormControl></>;
            case 'parts':
                return <>{renderGroupFilter()}{renderMachineFilter()}
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker label="From" value={partsFromDate} onChange={setPartsFromDate} format="DD-MM-YYYY" disableFuture
                            slotProps={{ textField: { size: 'small', className: 'av2-filter' } }} />
                        <DatePicker label="To" value={partsToDate} onChange={setPartsToDate} format="DD-MM-YYYY" disableFuture minDate={partsFromDate}
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
            colors: ['#e0e0e0', '#27ae60'],
            stroke: { width: [0, 2.5], curve: 'smooth' },
            markers: {
                size: [0, 5],
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
        const totalMetric = totalTarget > 0 ? +((totalActual / totalTarget) * 100).toFixed(1) : 0;
        rows.push({ label: 'Total', actual: totalActual, target: totalTarget, metric: totalMetric });

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
                    min: 0,
                    title: { text: 'Units', style: { fontSize: '11px', color: '#888' } },
                    labels: { style: { fontSize: '11px' } },
                    axisBorder: { show: false },
                },
                { seriesName: 'Actual', show: false },
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

    const renderChartArea = () => {
        if (isLoading) return (
            <Box className="av2-loading">
                <CircularProgress size={40} sx={{ color: '#f47803' }} />
                <Typography sx={{ mt: 2, color: '#888' }}>Loading data...</Typography>
            </Box>
        );

        if (chartData && tab === 'parts') return renderPartsContent(chartData);

        if (!chartData && ['downtime', 'alarm'].includes(tab)) return (
            <Typography sx={{ color: '#aaa', fontSize: '0.95rem' }}>
                Select filters and click <b>Run Analysis</b> to load the <b>{TABS.find(t => t.value === tab)?.label}</b> chart.
            </Typography>
        );

        if (chartData && ['downtime', 'alarm'].includes(tab)) {
            const onReasonClick = () => setSelectedReason(prev => prev === 'bluecard' ? null : 'bluecard');
            const pareto = buildParetoChart(chartData, expandedOthers, () => setExpandedOthers(true), onReasonClick, label);
            const breakdown = (chartData.breakdown || []).slice(0, topCount);
            const totalHours = secsToHours(chartData.total_duration_seconds || 0);
            const label = tab === 'downtime' ? 'Downtime' : 'Alarm';

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
            const chart = buildMachineLineChart(chartData, 'Utilization', utilView, 'availability');
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
