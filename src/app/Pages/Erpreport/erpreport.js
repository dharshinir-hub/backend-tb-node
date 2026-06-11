import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    MenuItem, Select, FormControl, InputLabel, Button,
    Checkbox, ListItemText, CircularProgress,
    Table, TableBody, TableCell, TableHead, TableRow,
    TablePagination, Card, CardContent, CardActions, Box,
    Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { customerbasedshift } from '../../Services/app/companyservice';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';
import { getPlanDetails, getErpJson, getReportToken } from '../../Services/app/reportservice';
import ErpPlannerDialog from './erpplanner';
import Swal from 'sweetalert2';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (val) => (val ? dayjs(val).format('DD-MM-YYYY') : '—');
const fmtCycleTime = (ct) => {
    if (!ct) return '—';
    const pad = (n) => String(n ?? 0).padStart(2, '0');
    return `${pad(ct.Hours)}:${pad(ct.Minutes)}:${pad(ct.Seconds)}`;
};
const safe = (x) => (x === null || x === undefined || x === '') ? '—' : x;
const wrapWords = (text) => {
    if (!text || text === '—') return text;
    const words = text.split(' ');
    if (words.length <= 1) return text;
    const mid = Math.ceil(words.length / 2);
    return words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' ');
};

// ── Column headers ────────────────────────────────────────────────────────────
const HEADERS = [
    { label: 'S.No',           level: 'machine' },
    { label: 'Machine',        level: 'machine' },
    { label: 'Plan No',        level: 'plan'    },
    { label: 'Plan Date',      level: 'plan'    },
    { label: 'Shift',          level: 'plan'    },
    { label: 'Type',           level: 'plan'    },
    { label: 'Line',           level: 'detail'  },
    { label: 'Cavity',         level: 'detail'  },
    { label: 'Cycle Time',     level: 'detail'  },
    { label: 'Item',           level: 'item'    },
    { label: 'Plan Qty',       level: 'item'    },
    { label: 'Prod. Order No', level: 'item'    },
    { label: 'JSON View',      level: 'action'  },
];

const headerBg = (label) => {
    if (label === 'Cycle Time') return '#207A24';
    return '#999999';
};

const CELL = {
    fontSize: '14px',
    verticalAlign: 'middle',
    border: '1px solid #e0e0e0',
    whiteSpace: 'pre-line',
};

// ── Parse a detail into structured rows (one per line item) ──────────────────
function parseDetailMeta(detail) {
    const apiItems = Array.isArray(detail.Item) ? detail.Item : [];
    const proc     = Array.isArray(detail.Process) ? detail.Process[0] : null;
    const cycleTime = apiItems.length > 0
        ? fmtCycleTime(detail.CycleTime)
        : fmtCycleTime(proc?.CycleTime);
    const lineItems = apiItems.length > 0
        ? [{
            item:        `(${apiItems.map((i) => safe(i.Item)).join(' & ')}) - (${apiItems.map((i) => safe(i.ItemDesc)).join(' & ')})`,
            planQty:     apiItems.map((i) => safe(i.PlanQty)).join(' & '),
            prodOrderNo: apiItems.map((i) => safe(i.ProductionOrderNo)).join(' & '),
          }]
        : [{
            item:        `(${safe(detail.Item)}) - (${safe(detail.ItemDesc)})`,
            planQty:     safe(detail.PlanQty),
            prodOrderNo: safe(detail.ProductionOrderNo),
          }];
    const cavity = apiItems.length > 0
        ? apiItems.map((i) => safe(i.Cavity)).join(' & ')
        : safe(detail.Cavity);

    return {
        machineName:  safe(detail.MachineDesc),
        lineNo:       safe(detail.line),
        cavity,
        cycleTime,
        lineItems,
    };
}

function groupDetailsByMachine(parsedDetails) {
    const groups = [];
    for (const d of parsedDetails) {
        const last = groups[groups.length - 1];
        if (last && last.machineName === d.machineName) {
            last.details.push(d);
        } else {
            groups.push({ machineName: d.machineName, details: [d] });
        }
    }
    return groups;
}

export default function ErpReport() {
    const customerId = localStorage.getItem('CustomerID');

    const [shifts,             setShifts]             = useState([]);
    const [selectedShift,      setSelectedShift]      = useState(null);
    const [startDate,          setStartDate]          = useState(dayjs());
    const [endDate,            setEndDate]            = useState(dayjs());
    const [isLoading,          setIsLoading]          = useState(false);
    const [isBeforeFirstShift, setIsBeforeFirstShift] = useState(false);
    const isInitialLoad = useRef(true);

    const [reportData,  setReportData]  = useState([]);
    const [page,        setPage]        = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount,  setTotalCount]  = useState(0);
    const [plannerDialogOpen, setPlannerDialogOpen] = useState(false);
    const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
    const [jsonData, setJsonData] = useState(null);
    const [jsonLoading, setJsonLoading] = useState(false);

    const {
        machineGroups,
        availableMachines,
        selectedMachines: groupedMachines,
        selectedGroups,
        showMachineGroupsDropdown,
        handleGroupChange,
        handleMachineChange,
        isAllMachinesSelected,
    } = useMachineGroups(customerId);

    // ── Shift helpers ─────────────────────────────────────────────────────────
    const getCurrentShift = useCallback((list) => {
        if (!Array.isArray(list) || list.length === 0) return 'allshift';
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        for (const s of list) {
            const [fh, fm] = s.start_time.split(':').map(Number);
            const [th, tm] = s.end_time.split(':').map(Number);
            const from = fh * 60 + fm, to = th * 60 + tm;
            if ((from <= cur && cur < to) || (from > to && (cur >= from || cur < to)))
                return String(s.shift_no);
        }
        return 'allshift';
    }, []);

    const getShiftTimes = useCallback((list, shiftNo, date) => {
        if (!Array.isArray(list) || !date) return { from: null, to: null };
        const base = dayjs(date).format('YYYY-MM-DD');
        const off  = (d, n) => dayjs(d).add(Number(n) - 1, 'day').format('YYYY-MM-DD');
        if (shiftNo === 'allshift' || shiftNo === 'all shift') {
            const sorted = [...list].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
            return {
                from: new Date(`${off(base, sorted[0].start_day)}T${sorted[0].start_time}`).getTime(),
                to:   new Date(`${off(base, sorted.at(-1).end_day)}T${sorted.at(-1).end_time}`).getTime(),
            };
        }
        const s = list.find((x) => String(x.shift_no) === String(shiftNo));
        if (!s) return { from: null, to: null };
        return {
            from: new Date(`${off(base, s.start_day)}T${s.start_time}`).getTime(),
            to:   new Date(`${off(base, s.end_day)}T${s.end_time}`).getTime(),
        };
    }, []);

    const fetchShifts = useCallback(async () => {
        if (!customerId) return;
        try {
            const res = await customerbasedshift(customerId, 'allShift');
            setShifts(res[0]?.value || []);
        } catch { setShifts([]); }
    }, [customerId]);

    useEffect(() => { if (customerId) fetchShifts(); }, [customerId, fetchShifts]);

    useEffect(() => { getReportToken('gd', 'gd'); }, []);

    useEffect(() => {
        if (shifts.length === 0 || selectedShift !== null) return;
        setSelectedShift(getCurrentShift(shifts));
        const first = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no))[0];
        if (first) {
            const [h, m] = first.start_time.split(':').map(Number);
            const now = new Date();
            if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) {
                const y = dayjs().subtract(1, 'day');
                setStartDate(y); setEndDate(y);
            }
        }
    }, [shifts, selectedShift, getCurrentShift]);

    useEffect(() => {
        if (!shifts.length) return;
        const first = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no))[0];
        if (!first) return;
        const [h, m] = first.start_time.split(':').map(Number);
        const now = new Date();
        if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) {
            setIsBeforeFirstShift(true);
            const ms =
                ((h * 60 + m - (now.getHours() * 60 + now.getMinutes())) * 60 - now.getSeconds()) * 1000
                - now.getMilliseconds();
            const t = setTimeout(() => {
                setIsBeforeFirstShift(false);
                setStartDate(dayjs()); setEndDate(dayjs());
                setSelectedShift(String(first.shift_no));
            }, ms);
            return () => clearTimeout(t);
        } else {
            setIsBeforeFirstShift(false);
        }
    }, [shifts]);

    // ── JSON Dialog handler ───────────────────────────────────────────────────
    const handleViewJson = useCallback(async (planNo) => {
        setJsonLoading(true);
        try {
            const data = await getErpJson(planNo);
            setJsonData(data);
            setJsonDialogOpen(true);
        } catch (err) {
            console.error('Failed to fetch ERP JSON', err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load JSON data'
            });
        } finally {
            setJsonLoading(false);
        }
    }, []);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchReport = useCallback(async (pageNum = 0, limit = 10) => {
        if (!selectedShift || groupedMachines.length === 0) return;
        setIsLoading(true);
        const machineName = groupedMachines.join(',');
        try {
            const start = dayjs(startDate).format('YYYY-MM-DD');
            const end   = dayjs(endDate).format('YYYY-MM-DD');
            const shiftParam = selectedShift === 'allshift'
                ? shifts.map((s) => s.shift_no).join(',')
                : selectedShift;
            const res   = await getPlanDetails(machineName, shiftParam, start, end);

            // handle { planDetails: [] } or plain array
            const raw = Array.isArray(res?.planDetails) ? res.planDetails
                      : Array.isArray(res)              ? res
                      : Array.isArray(res?.data)        ? res.data
                      : res ? [res] : [];

            const total = res?.total ?? raw.length;
            setTotalCount(total);
            setReportData(res?.total !== undefined ? raw : raw.slice(pageNum * limit, pageNum * limit + limit));
        } catch (err) {
            console.error('Failed to fetch plan details', err);
            setReportData([]); setTotalCount(0);
        } finally {
            setIsLoading(false);
        }
    }, [selectedShift, groupedMachines, startDate, endDate]);

    const handleSubmit = useCallback(async () => {
        setPage(0); setTotalCount(0);
        await fetchReport(0, rowsPerPage);
    }, [fetchReport, rowsPerPage]);

    const handleChangePage = async (_, newPage) => {
        setPage(newPage);
        await fetchReport(newPage, rowsPerPage);
    };

    const handleChangeRowsPerPage = async (e) => {
        const limit = parseInt(e.target.value, 10);
        setRowsPerPage(limit); setPage(0); setTotalCount(0);
        await fetchReport(0, limit);
    };

    useEffect(() => {
        const ready = customerId && selectedShift !== null && shifts.length > 0
            && groupedMachines.length > 0 && startDate && endDate;
        if (ready && isInitialLoad.current) {
            fetchReport(0, rowsPerPage);
            isInitialLoad.current = false;
        }
    }, [customerId, selectedShift, shifts, groupedMachines, startDate, endDate, fetchReport, rowsPerPage]);

    const shiftOptions = useMemo(() => {
        const now = Date.now();
        const isToday = startDate.isSame(dayjs(), 'day');
        return [
            <MenuItem key="allshift" value="allshift">All Shifts</MenuItem>,
            ...shifts.map((s) => {
                const isFuture = isToday && (() => {
                    const t = getShiftTimes(shifts, String(s.shift_no), startDate);
                    return t.from !== null && t.from > now;
                })();
                return (
                    <MenuItem key={s.shift_no} value={String(s.shift_no)} disabled={isFuture}>
                        {s.shift_no}{isFuture ? ' (upcoming)' : ''}
                    </MenuItem>
                );
            }),
        ];
    }, [shifts, startDate, getShiftTimes]);

    // ── Build flat rows (no rowSpan merging) ─────────────────────────────────
    const tableRows = useMemo(() => {
        if (reportData.length === 0) return null;

        // Collect all flat entries across all plans
        const allEntries = [];
        reportData.forEach((plan) => {
            const planInfo   = { plan_no: plan.plan_no, plan_date: plan.plan_date, shift_id: plan.shift_id, type: plan.type };
            const rawDetails = Array.isArray(plan.details) ? plan.details : [];

            if (rawDetails.length === 0) {
                allEntries.push({ planInfo, machineName: '—', lineNo: '—', cavity: '—', cycleTime: '—', line: { item: '—', planQty: '—', prodOrderNo: '—' } });
            } else {
                rawDetails.forEach((detail) => {
                    const parsed = parseDetailMeta(detail);
                    parsed.lineItems.forEach((line) => {
                        allEntries.push({
                            planInfo,
                            machineName: parsed.machineName,
                            lineNo:      parsed.lineNo,
                            cavity:      parsed.cavity,
                            cycleTime:   parsed.cycleTime,
                            line,
                        });
                    });
                });
            }
        });

        // Sort by machine name alphabetically
        allEntries.sort((a, b) => a.machineName.localeCompare(b.machineName));

        const rows = [];
        let sno = page * rowsPerPage + 1;

        allEntries.forEach((entry, idx) => {
            const planInfo = entry.planInfo;
            const bg = (sno - 1) % 2 === 0 ? '#efefef' : '#f8f8f8';
                rows.push(
                    <TableRow key={`plan-${planInfo.plan_no}-${idx}`}>
                        <TableCell align="center" style={{ background: bg }} sx={CELL}>{sno}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={{ ...CELL, whiteSpace: 'nowrap' }}>{entry.machineName}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={CELL}>{safe(planInfo.plan_no)}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={{ ...CELL, whiteSpace: 'nowrap' }}>{fmtDate(planInfo.plan_date)}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={CELL}>{safe(planInfo.shift_id)}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={{ ...CELL, whiteSpace: 'nowrap' }}>{safe(planInfo.type)}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={CELL}>{entry.lineNo}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={CELL}>{entry.cavity}</TableCell>
                        <TableCell align="center" style={{ background: bg, color: '#207A24', fontWeight: 600 }} sx={CELL}>{entry.cycleTime}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={{ ...CELL, whiteSpace: 'pre-line', maxWidth: 250, minWidth: 220, wordBreak: 'break-word', fontSize: '12px' }}>{wrapWords(entry.line.item)}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={{ ...CELL, whiteSpace: 'nowrap' }}>{entry.line.planQty}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={{ ...CELL, whiteSpace: 'nowrap' }}>{entry.line.prodOrderNo}</TableCell>
                        <TableCell align="center" style={{ background: bg }} sx={CELL}>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VisibilityIcon />}
                                onClick={() => handleViewJson(planInfo.plan_no)}
                                disabled={jsonLoading}
                                sx={{
                                    textTransform: 'none',
                                    fontSize: '12px',
                                    color: '#f47803',
                                    borderColor: '#f47803',
                                    '&:hover': {
                                        borderColor: '#e06d00',
                                        backgroundColor: 'rgba(244, 120, 3, 0.04)',
                                    },
                                    '&.Mui-disabled': {
                                        color: '#f4780380',
                                        borderColor: '#f4780380',
                                    },
                                }}
                            >
                                View
                            </Button>
                        </TableCell>
                    </TableRow>
                );
            sno++;
        });

        return rows.length > 0 ? rows : null;
    }, [reportData, page, rowsPerPage, jsonLoading, handleViewJson]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Box sx={{
            p: 2,
            background: '#fefcfcff',
            height: 'calc(100vh - 65px)',
            paddingTop: '50px',
            overflow: 'auto',
            boxSizing: 'border-box',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
        }}>
            {/* ── Filters ── */}
            <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 18px 0' }}><b>Erp Planner</b></h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>

                    {showMachineGroupsDropdown && (
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ fontSize: '15px', color: '#000', background: '#fff' }}>Machine Group</InputLabel>
                            <Select
                                multiple
                                value={selectedGroups}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                label="Machine Group"
                                renderValue={(sel) => {
                                    if (sel.length === machineGroups.length) return 'All Groups';
                                    if (sel.length === 0) return 'Select Groups';
                                    return sel.slice(0, 2).join(', ') + (sel.length > 2 ? '...' : '');
                                }}
                                sx={{ fontSize: '14px' }}
                            >
                                <MenuItem value="all">
                                    <Checkbox checked={selectedGroups.length === machineGroups.length} sx={{ '&.Mui-checked': { color: '#f47803' } }} />
                                    <ListItemText primary="All" />
                                </MenuItem>
                                {machineGroups.map((g) => (
                                    <MenuItem key={g.name} value={g.name}>
                                        <Checkbox checked={selectedGroups.includes(g.name)} sx={{ '&.Mui-checked': { color: '#f47803' } }} />
                                        <ListItemText primary={g.name} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel sx={{ fontSize: '15px', color: '#000', background: '#fff' }}>Machine</InputLabel>
                        <Select
                            multiple
                            value={groupedMachines}
                            onChange={(e) => handleMachineChange(e.target.value)}
                            label="Machine"
                            sx={{ fontSize: '14px' }}
                            renderValue={(selected) => {
                                if (isAllMachinesSelected) return 'All Machines';
                                if (selected.length === 0) return 'Select Machines';
                                return selected.join(', ');
                            }}
                        >
                            <MenuItem value="all">
                                <Checkbox checked={isAllMachinesSelected} sx={{ '&.Mui-checked': { color: '#f47803' } }} />
                                <ListItemText primary="All" />
                            </MenuItem>
                            {availableMachines.map((m) => (
                                <MenuItem key={m} value={m}>
                                    <Checkbox checked={groupedMachines.includes(m)} sx={{ '&.Mui-checked': { color: '#f47803' } }} />
                                    <ListItemText primary={m} />
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Shift</InputLabel>
                        <Select
                            value={selectedShift || ''}
                            onChange={(e) => setSelectedShift(e.target.value)}
                            label="Shift"
                            disabled={shifts.length === 0}
                        >
                            {shiftOptions}
                        </Select>
                    </FormControl>

                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            label="Start Date"
                            value={startDate}
                            onChange={(val) => {
                                setStartDate(val);
                                const max = val.add(1, 'month').isAfter(dayjs()) ? dayjs() : val.add(1, 'month');
                                if (endDate.isAfter(max)) setEndDate(max);
                            }}
                            format="DD-MM-YYYY"
                            maxDate={dayjs()}
                            shouldDisableDate={(d) => isBeforeFirstShift && d.isSame(dayjs(), 'day')}
                            slotProps={{ textField: { size: 'small', sx: { minWidth: 160 } } }}
                        />
                    </LocalizationProvider>

                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            label="End Date"
                            value={endDate}
                            onChange={(val) => setEndDate(val)}
                            format="DD-MM-YYYY"
                            minDate={startDate}
                            maxDate={startDate.add(1, 'month').isAfter(dayjs()) ? dayjs() : startDate.add(1, 'month')}
                            shouldDisableDate={(d) => isBeforeFirstShift && d.isSame(dayjs(), 'day')}
                            slotProps={{ textField: { size: 'small', sx: { minWidth: 160 } } }}
                        />
                    </LocalizationProvider>

                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={isLoading || groupedMachines.length === 0}
                        sx={{
                            minWidth: 120, height: 40,
                            background: '#f47803ff',
                            '&:hover': { background: '#e06d00ff' },
                            '&.Mui-disabled': { background: '#f4780380' },
                            textTransform: 'none', fontWeight: 'bold', gap: '8px',
                        }}
                    >
                        {isLoading && <CircularProgress size={16} sx={{ color: '#fff' }} />}
                        {isLoading ? 'Loading...' : 'Submit'}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => setPlannerDialogOpen(true)}
                        startIcon={<AddIcon />}
                        sx={{
                            minWidth: 160, height: 40,
                            background: '#f47803ff',
                            '&:hover': { background: '#e06d00ff' },
                            '&.Mui-disabled': { background: '#f4780380' },
                            textTransform: 'none', fontWeight: 'bold', gap: '8px',
                        }}
                    >
                        Create New Plan
                    </Button>
                </div>
            </div>

            {/* ── Table ── */}
            <Card sx={{ overflow: 'auto', padding: 0 }}>
                <CardContent sx={{ padding: '0 !important' }}>
                    <div style={{ height: 'calc(100vh - 280px)', overflowY: 'auto', overflowX: 'auto', scrollbarWidth: 'thin' }}>
                        <Table stickyHeader aria-label="erp plan table" sx={{ tableLayout: 'auto', width: '100%', borderCollapse: 'collapse' }}>
                            <TableHead>
                                <TableRow>
                                    {HEADERS.map((h, i) => (
                                        <TableCell
                                            key={i}
                                            align="center"
                                            sx={{
                                                minWidth: h.label === 'Items' ? 200 : 100,
                                                fontSize: '14px !important',
                                                color: '#fff !important',
                                                backgroundColor: `${headerBg(h.label)} !important`,
                                                border: 'none',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {h.label}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tableRows}
                                {(!tableRows || reportData.length === 0) && (
                                    <TableRow>
                                        <TableCell
                                            align="center"
                                            colSpan={HEADERS.length}
                                            style={{
                                                backgroundColor: '#f7f7f7',
                                                color: '#555',
                                                padding: '30px',
                                                fontWeight: 500,
                                                fontSize: '1rem',
                                            }}
                                        >
                                            {isLoading ? 'Loading...' : 'NO DATA FOUND'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardActions sx={{ px: 2, justifyContent: 'end', background: '#dddddd' }}>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="Items per page"
                        sx={{ '& .MuiTablePagination-toolbar': { alignItems: 'baseline' } }}
                    />
                </CardActions>
            </Card>

            {/* Create Plan Dialog */}
            <ErpPlannerDialog
                open={plannerDialogOpen}
                onClose={() => setPlannerDialogOpen(false)}
                onSave={() => {
                    setPlannerDialogOpen(false);
                    if (selectedShift && groupedMachines.length > 0) {
                        handleSubmit();
                    }
                }}
            />

            {/* JSON View Dialog */}
            <Dialog
                open={jsonDialogOpen}
                onClose={() => setJsonDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '80vh',
                        overflow: 'auto',
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 'bold', fontSize: '16px', color: '#f47803' }}>
                    ERP JSON Data
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {jsonData?.message?.toLowerCase().includes('no data') ? (
                        <p style={{ textAlign: 'center', color: '#888', fontWeight: 500 }}>No Json Data</p>
                    ) : jsonData ? (
                        <pre style={{
                            background: '#f5f5f5',
                            padding: '16px',
                            borderRadius: '4px',
                            overflow: 'auto',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            maxHeight: '60vh',
                            margin: 0,
                        }}>
                            {JSON.stringify(jsonData, null, 2)}
                        </pre>
                    ) : (
                        <p>No data available</p>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={() => setJsonDialogOpen(false)}
                        variant="contained"
                        sx={{
                            background: '#f47803',
                            '&:hover': {
                                background: '#e06d00',
                            },
                        }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
