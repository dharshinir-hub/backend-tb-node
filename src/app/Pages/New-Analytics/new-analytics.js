import {
    Box, FormControl, InputLabel, Select, MenuItem,
    Checkbox,
    ListItemText, Button, Tooltip,
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TablePagination,
    Paper, CircularProgress, IconButton,
    Stack, Typography, AppBar, Toolbar,
    alpha
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import "./new-analytics.css";
import {
    cleanCustomerId,
    customerbasedshift, telemetrykeydata
} from "../../Services/app/operatorservice";
import { getAverageOEEForRange, fetchAlarmDowntimeData } from "../../Shared/utils/oeeCalculations";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";
import DownloadIcon from '@mui/icons-material/Download';
import GridViewIcon from '@mui/icons-material/GridView';
import TableChartIcon from '@mui/icons-material/TableChart';
import FilterListIcon from '@mui/icons-material/FilterList';
import { saveAs } from 'file-saver';
import { getAverageUtilizationForRange } from "../../Shared/utils/utilizationCalculations";
import { CUSTOMER_IDS } from "../../Shared/constants/ids";
import { getPartsReport, fetchPartsShiftWiseByDate, getSummaryStats } from "../../Shared/utils/oeepartsdata";

// Constants
const ANALYSIS_TYPES = {
    LIVE_ALARM: "live_alarm",
    LIVE_REASON: "live_reason",
    OEE: "oee",
    UTILIZATION: "utilization",
    PARTS: "Parts"
};

const OEE_VIEW_TYPES = {
    FISCAL: "fiscal",
    DAYS: "days",
    MONTH: "month"
};

const UTILIZATION_VIEW_TYPES = {
    FISCAL: "fiscal",
    DAYS: "days",
    MONTH: "month"
};

// Move column definitions outside component to prevent recreation
const COLUMN_DEFINITIONS = {
    [ANALYSIS_TYPES.LIVE_ALARM]: [
        { field: 'date', headerName: 'Date', width: 100 },
        { field: 'machine_name', headerName: 'Machine', width: 130 },
        { field: 'operator_name', headerName: 'Operator', width: 130 },
        { field: 'operator_code', headerName: 'Op Code', width: 90 },
        { field: 'component_name', headerName: 'Component', width: 130 },
        { field: 'component_code', headerName: 'Comp Code', width: 90 },
        { field: 'alarm_number', headerName: 'Alarm #', width: 90 },
        { field: 'alarm_type', headerName: 'Type', width: 90 },
        { field: 'alarm_message', headerName: 'Message', width: 180 },
        { field: 'duration', headerName: 'Duration (s)', width: 110 },
        { field: 'start_time', headerName: 'Start', width: 140 },
        { field: 'end_time', headerName: 'End', width: 140 },
        { field: 'shift_number', headerName: 'Shift', width: 70 },
    ],
    [ANALYSIS_TYPES.LIVE_REASON]: [
        { field: 'date', headerName: 'Date', width: 100 },
        { field: 'machine_name', headerName: 'Machine', width: 130 },
        { field: 'operator_name', headerName: 'Operator', width: 130 },
        { field: 'operator_code', headerName: 'Op Code', width: 90 },
        { field: 'component_name', headerName: 'Component', width: 130 },
        { field: 'component_code', headerName: 'Comp Code', width: 90 },
        { field: 'code', headerName: 'Code', width: 70 },
        { field: 'mode', headerName: 'Mode', width: 70 },
        { field: 'category', headerName: 'Category', width: 110 },
        { field: 'name', headerName: 'Name', width: 130 },
        // { field: 'locked_duration', headerName: 'Locked (s)', width: 110 },
        { field: 'duration', headerName: 'Duration (s)', width: 110 },
        { field: 'start_time', headerName: 'Start', width: 140 },
        { field: 'end_time', headerName: 'End', width: 140 },
        { field: 'shift_number', headerName: 'Shift', width: 70 },
    ],
    [ANALYSIS_TYPES.OEE]: [
        { field: 'date', headerName: 'Date', width: 100 },
        { field: 'machine_name', headerName: 'Machine', width: 130 },
        { field: 'oee_value', headerName: 'OEE', width: 90 },
        { field: 'shift_number', headerName: 'Shift', width: 70 },
        { field: 'operator_name', headerName: 'Operator', width: 130 },
        { field: 'operator_code', headerName: 'Op Code', width: 90 },
        { field: 'component_name', headerName: 'Component', width: 130 },
        { field: 'component_code', headerName: 'Comp Code', width: 90 },
        { field: 'timestamp', headerName: 'Time', width: 140 },
        { field: 'shift_start_time', headerName: 'Shift Start', width: 110 },
        { field: 'shift_end_time', headerName: 'Shift End', width: 110 },
    ],
    [ANALYSIS_TYPES.UTILIZATION]: [
        { field: 'date', headerName: 'Date', width: 100 },
        { field: 'machine_name', headerName: 'Machine', width: 130 },
        { field: 'utilization_value', headerName: 'Utilization', width: 90 },
        { field: 'shift_number', headerName: 'Shift', width: 70 },
        { field: 'operator_name', headerName: 'Operator', width: 130 },
        { field: 'operator_code', headerName: 'Op Code', width: 90 },
        { field: 'component_name', headerName: 'Component', width: 130 },
        { field: 'component_code', headerName: 'Comp Code', width: 90 },
        { field: 'timestamp', headerName: 'Time', width: 140 },
        { field: 'shift_start_time', headerName: 'Shift Start', width: 110 },
        { field: 'shift_end_time', headerName: 'Shift End', width: 110 },
    ],
    [ANALYSIS_TYPES.PARTS]: [
        { field: 'date', headerName: 'Date', width: 110 },
        { field: 'target', headerName: 'Target Parts', width: 130 },
        { field: 'total', headerName: 'Actual Parts', width: 130 },
        { field: 'difference', headerName: 'Difference', width: 110 },
        { field: 'performance', headerName: 'Performance (%)', width: 140 },
    ]
};

// Memoized Table Row Component
const TableRowMemo = ({ row, columns, index }) => (
    <TableRow
        sx={{
            backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa',
            '&:hover': {
                backgroundColor: alpha('#1976d2', 0.04),
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            },
            borderBottom: '1px solid #f0f0f0',
        }}
    >
        {columns.map((column) => (
            <TableCell
                key={`${row.id || row.machine_name}_${column.field}`}
                sx={{
                    padding: '12px 16px',
                    borderRight: 'none',
                    fontSize: '13px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',
                    color: '#1d1d1f',
                    '&:first-of-type': {
                        borderLeft: 'none',
                        paddingLeft: '24px',
                    },
                    '&:last-child': {
                        paddingRight: '24px',
                    }
                }}
            >
                {row[column.field] || '-'}
            </TableCell>
        ))}
    </TableRow>
);

// Table Header Component
const TableHeader = ({ columns }) => (
    <TableHead>
        <TableRow>
            {columns.map((column) => (
                <TableCell
                    key={column.field}
                    sx={{
                        fontWeight: 600,
                        backgroundColor: '#ffffff',
                        color: '#1d1d1f',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        padding: '14px 16px',
                        borderBottom: '2px solid #f0f0f0',
                        fontSize: '13px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',
                        letterSpacing: '-0.01em',
                        '&:first-of-type': { paddingLeft: '24px' },
                        '&:last-child': { paddingRight: '24px' },
                    }}
                >
                    {column.headerName}
                </TableCell>
            ))}
        </TableRow>
    </TableHead>
);

// Data Mapping Functions (outside component to prevent recreation)
const mapDataToOperator = (data, type, shifts) => {
    const now = Date.now();
    return Object.values(
        Object.fromEntries(
            Object.keys(data).map(machineId => {
                const machine = data[machineId];
                const operatorValues = machine.operatorValues || [];
                const componentValues = machine.componentValues || [];
                const lockedStatusValues = machine.lockedStatusValues || [];
                const mapped = machine.result.map(item => {
                    const value = item.value;
                    const start = Number(value[type === "alarm" ? "alarm_start" : "idle_start"]);
                    const end = Number(value[type === "alarm" ? "alarm_end" : "idle_end"]);
                    const durationSec = Number(value[type === "alarm" ? "alarm_duration" : "idle_duration"]);
                    const dateObj = new Date(start);
                    const day = String(dateObj.getDate()).padStart(2, "0");
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const year = dateObj.getFullYear();
                    const date = `${day}-${month}-${year}`;
                    let shiftEndTime = null;
                    if (shifts?.length > 0) {
                        const eventDate = new Date(start);
                        const eventMinutes = eventDate.getHours() * 60 + eventDate.getMinutes();
                        shifts.forEach(shift => {
                            const [sH, sM] = shift.start_time.split(":").map(Number);
                            const [eH, eM] = shift.end_time.split(":").map(Number);
                            const startMins = sH * 60 + sM;
                            const endMins = eH * 60 + eM;
                            if (endMins < startMins) {
                                if (eventMinutes >= startMins || eventMinutes < endMins) {
                                    const shiftDate = new Date(start);
                                    if (eventMinutes >= startMins) {
                                        shiftDate.setHours(eH, eM, 0, 0);
                                        shiftDate.setDate(shiftDate.getDate() + 1);
                                    } else {
                                        shiftDate.setHours(eH, eM, 0, 0);
                                    }
                                    shiftEndTime = shiftDate.getTime();
                                }
                            } else if (eventMinutes >= startMins && eventMinutes < endMins) {
                                const shiftDate = new Date(start);
                                shiftDate.setHours(eH, eM, 0, 0);
                                shiftEndTime = shiftDate.getTime();
                            }
                        });
                    }
                    const operator = operatorValues.find(op => {
                        const opStart = Number(op.value?.start_time);
                        let opEnd = Number(op.value?.end_time);
                        if (!opEnd || opEnd === 0 || isNaN(opEnd)) {
                            if (shiftEndTime) {
                                opEnd = Math.min(now, shiftEndTime);
                            } else {
                                opEnd = now;
                            }
                        }
                        return start < opEnd && end > opStart;
                    });

                    let bestComponent = null;
                    let maxOverlap = 0;
                    componentValues.forEach(cmp => {
                        const cmpStart = Number(cmp.value?.start_time);
                        const cmpEnd = Number(cmp.value?.end_time);
                        const overlapStart = Math.max(start, cmpStart);
                        const overlapEnd = Math.min(end, cmpEnd);
                        const overlap = Math.max(0, overlapEnd - overlapStart);
                        if (overlap > maxOverlap) {
                            maxOverlap = overlap;
                            bestComponent = cmp;
                        }
                    });
                    let lockedStart = null;
                    let lockedDuration = 0;
                    if (lockedStatusValues.length > 0) {
                        const sortedLockedEvents = [...lockedStatusValues]
                            .filter(event => event.value === "locked" || event.value === "unlocked" || event.value.startsWith("Interrupted"))
                            .sort((a, b) => a.ts - b.ts);
                        for (let i = 0; i < sortedLockedEvents.length; i++) {
                            const event = sortedLockedEvents[i];
                            const eventTime = Number(event.ts);
                            const eventValue = event.value;
                            if (eventTime >= start && eventTime <= end) {
                                if (eventValue === "locked") {
                                    lockedStart = eventTime;
                                    const lockedEndTime = end;
                                    lockedDuration = Math.round((lockedEndTime - lockedStart) / 1000);
                                    break;
                                }
                            }
                            if (i < sortedLockedEvents.length - 1) {
                                const currentEvent = sortedLockedEvents[i];
                                const nextEvent = sortedLockedEvents[i + 1];
                                if (currentEvent.value === "locked" &&
                                    (nextEvent.value === "unlocked" || nextEvent.value.startsWith("Interrupted"))) {
                                    const lockTime = Number(currentEvent.ts);
                                    const unlockTime = Number(nextEvent.ts);
                                    if (unlockTime > start && lockTime < end) {
                                        const effectiveLockStart = Math.max(lockTime, start);
                                        const effectiveLockEndTime = end;
                                        lockedStart = effectiveLockStart;
                                        lockedDuration = Math.round((effectiveLockEndTime - effectiveLockStart) / 1000);
                                        break;
                                    }
                                }
                            }
                        }
                        let lastLockBeforeIdle = null;
                        for (let i = sortedLockedEvents.length - 1; i >= 0; i--) {
                            const event = sortedLockedEvents[i];
                            const eventTime = Number(event.ts);
                            const eventValue = event.value;
                            if (eventTime < start) {
                                if (eventValue === "locked") {
                                    lastLockBeforeIdle = event;
                                    break;
                                } else if (eventValue === "unlocked" || eventValue.startsWith("Interrupted")) {
                                    break;
                                }
                            }
                        }
                        if (lastLockBeforeIdle && lockedStart === null) {
                            const lockIndex = sortedLockedEvents.findIndex(e => e.ts === lastLockBeforeIdle.ts);
                            if (lockIndex !== -1) {
                                for (let i = lockIndex + 1; i < sortedLockedEvents.length; i++) {
                                    const nextEvent = sortedLockedEvents[i];
                                    const nextEventValue = nextEvent.value;
                                    if (nextEventValue === "unlocked" || nextEventValue.startsWith("Interrupted")) {
                                        const unlockTime = Number(nextEvent.ts);
                                        if (unlockTime > start) {
                                            lockedStart = start;
                                            const effectiveLockEndTime = end;
                                            lockedDuration = Math.round((effectiveLockEndTime - start) / 1000);
                                        }
                                        break;
                                    }
                                }
                                if (lockedStart === null) {
                                    lockedStart = start;
                                    lockedDuration = durationSec;
                                }
                            }
                        }
                    }

                    let shiftNumber = "Unknown";
                    if (shifts?.length > 0) {
                        const alarmDate = new Date(start);
                        const alarmMinutes = alarmDate.getHours() * 60 + alarmDate.getMinutes();

                        shifts.forEach(shift => {
                            const [sH, sM] = shift.start_time.split(":").map(Number);
                            const [eH, eM] = shift.end_time.split(":").map(Number);
                            const startMins = sH * 60 + sM;
                            const endMins = eH * 60 + eM;

                            if (endMins < startMins) {
                                if (alarmMinutes >= startMins || alarmMinutes < endMins) {
                                    shiftNumber = shift.shift_no;
                                }
                            } else if (alarmMinutes >= startMins && alarmMinutes < endMins) {
                                shiftNumber = shift.shift_no;
                            }
                        });
                    }

                    const result = {
                        date,
                        machine_name: machine.machineName,
                        operator_name: operator ? operator.value?.name : "-",
                        operator_code: operator ? operator.value?.code : "-",
                        component_name: bestComponent ? bestComponent.value?.name || "-" : "-",
                        component_code: bestComponent ? bestComponent.value?.code || "-" : "-",
                        ...(type === "alarm"
                            ? {
                                alarm_number: value.alarm_number,
                                alarm_type: value.alarm_type,
                                alarm_message: value.alarm_message,
                            }
                            : {
                                code: value.code,
                                mode: value.mode,
                                category: value.category,
                                name: value.name,
                                locked_start: lockedStart !== null && !isNaN(lockedStart)
                                    ? lockedStart
                                    : start,
                                // locked_duration: lockedStart !== null && !isNaN(lockedStart)
                                //     ? lockedDuration
                                //     : durationSec,
                            }),
                        duration: durationSec,
                        start_time: new Date(start).toLocaleString(),
                        end_time: new Date(end).toLocaleString(),
                        shift_number: shiftNumber,
                    };
                    return result;
                });

                return [machineId, mapped];
            })
        )
    ).flat();
};

// Separate OEE data processing functions for Fiscal and Days
const mapDataToOeeFiscal = (data) => {
    const results = [];

    Object.keys(data).forEach(machineId => {
        const machine = data[machineId];
        const oeeValues = machine.oeeValues || [];

        if (!Array.isArray(oeeValues) || oeeValues.length === 0) return;

        // For fiscal view, we want aggregated data
        const sortedOee = [...oeeValues].sort((a, b) => Number(a.ts) - Number(b.ts));

        // Group by date
        const groupedByDate = {};
        sortedOee.forEach(oee => {
            const dateObj = new Date(Number(oee.ts));
            const date = `${String(dateObj.getDate()).padStart(2, "0")}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${dateObj.getFullYear()}`;

            if (!groupedByDate[date]) {
                groupedByDate[date] = {
                    values: [],
                    sum: 0,
                    count: 0
                };
            }

            groupedByDate[date].values.push(Number(oee.value));
            groupedByDate[date].sum += Number(oee.value);
            groupedByDate[date].count++;
        });

        // Calculate averages for each date
        Object.keys(groupedByDate).forEach(date => {
            const dataForDate = groupedByDate[date];
            const avgOee = dataForDate.count > 0 ? dataForDate.sum / dataForDate.count : 0;

            results.push({
                date,
                machine_name: machine.machineName || machineId,
                oee_value: Math.round(avgOee * 100) / 100, // Round to 2 decimal places
                shift_number: "All",
                operator_name: "-",
                operator_code: "-",
                component_name: "-",
                component_code: "-",
                timestamp: date,
                shift_start_time: "-",
                shift_end_time: "-"
            });
        });
    });

    return results;
};

const mapDataToOeeDays = (data, shifts, fromDate, toDate) => {
    const now = Date.now();
    const results = [];
    const parsedShifts = shifts.map(shift => {
        const [sH, sM] = shift.start_time.split(":").map(Number);
        const [eH, eM] = shift.end_time.split(":").map(Number);
        const startMinutes = sH * 60 + sM;
        const endMinutes = eH * 60 + eM;
        return {
            ...shift,
            startMinutes,
            endMinutes,
            isOvernight: endMinutes <= startMinutes
        };
    });

    Object.keys(data).forEach(machineId => {
        const machine = data[machineId];
        const operatorValues = machine.operatorValues || [];
        const componentValues = machine.componentValues || [];
        const oeeValues = machine.oeeValues || [];
        if (!Array.isArray(oeeValues) || oeeValues.length === 0) return;
        const sortedOee = [...oeeValues].sort((a, b) => Number(a.ts) - Number(b.ts));

        const startDateObj = dayjs(fromDate).startOf('day');
        const endDateObj = dayjs(toDate).endOf('day');
        let currentDate = startDateObj;

        while (currentDate <= endDateObj) {
            const dateString = currentDate.format("DD-MM-YYYY");
            parsedShifts.forEach(shift => {
                const [sH, sM] = shift.start_time.split(":").map(Number);
                const [eH, eM] = shift.end_time.split(":").map(Number);
                let shiftStart = dayjs(currentDate).hour(sH).minute(sM).second(0).millisecond(0);
                let shiftEnd = dayjs(currentDate).hour(eH).minute(eM).second(0).millisecond(0);
                if (shift.isOvernight) {
                    shiftEnd = shiftEnd.add(1, 'day');
                }
                const adjustedShiftEnd = shiftEnd.subtract(1, 'millisecond');
                const shiftOeeValues = sortedOee.filter(oee => {
                    const ts = Number(oee.ts);
                    return ts >= shiftStart.valueOf() && ts <= adjustedShiftEnd.valueOf();
                });
                if (shiftOeeValues.length === 0) return;
                const lastOee = shiftOeeValues[shiftOeeValues.length - 1];
                const ts = Number(lastOee.ts);
                const oeeValue = lastOee.value;
                const operator = operatorValues.find(op => {
                    const opStart = Number(op.value?.start_time);
                    let opEnd = Number(op.value?.end_time);
                    if (!opEnd || isNaN(opEnd) || opEnd === 0) opEnd = now;
                    return ts >= opStart && ts <= opEnd;
                });
                const component = componentValues.find(cmp => {
                    const cmpStart = Number(cmp.value?.start_time);
                    let cmpEnd = Number(cmp.value?.end_time);
                    if (!cmpEnd || isNaN(cmpEnd) || cmpEnd === 0) cmpEnd = now;
                    return ts >= cmpStart && ts <= cmpEnd;
                });
                results.push({
                    date: dateString,
                    machine_name: machine.machineName || machineId,
                    oee_value: Number(oeeValue),
                    shift_number: shift.shift_no,
                    operator_name: operator?.value?.name || "NO OPERATOR",
                    operator_code: operator?.value?.code || "-",
                    component_name: component?.value?.name || "NO ROUTECARD",
                    component_code: component?.value?.code || "-",
                    timestamp: new Date(ts).toLocaleString(),
                    shift_start_time: shift.start_time,
                    shift_end_time: shift.end_time
                });
            });
            currentDate = currentDate.add(1, 'day');
        }
    });
    return results;
};

const mapDataToUtilizationFiscal = (data) => {
    const results = [];

    Object.keys(data).forEach(machineId => {
        const machine = data[machineId];
        const utilizationValues = machine.utilizationValues || [];

        if (!Array.isArray(utilizationValues) || utilizationValues.length === 0) return;

        const groupedByDate = {};
        utilizationValues.forEach(util => {
            const dateObj = new Date(Number(util.ts));
            const date = `${String(dateObj.getDate()).padStart(2, "0")}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${dateObj.getFullYear()}`;

            if (!groupedByDate[date]) {
                groupedByDate[date] = {
                    values: [],
                    sum: 0,
                    count: 0,
                };
            }

            const utilData = util.value ? JSON.parse(util.value) : { utilization: 0, runningTime: 0, availableTime: 0 };
            groupedByDate[date].values.push(Number(utilData.utilization || 0));
            groupedByDate[date].sum += Number(utilData.utilization || 0);
            groupedByDate[date].count++;
        });

        Object.keys(groupedByDate).forEach(date => {
            const dataForDate = groupedByDate[date];
            const avgUtilization = dataForDate.count > 0 ? dataForDate.sum / dataForDate.count : 0;

            results.push({
                date,
                machine_name: machine.machineName || machineId,
                utilization_value: Math.round(avgUtilization * 100) / 100,
                shift_number: "All",
                operator_name: "-",
                operator_code: "-",
                component_name: "-",
                component_code: "-",
                timestamp: date,
                shift_start_time: "-",
                shift_end_time: "-",
            });
        });
    });

    return results;
};

const mapDataToUtilizationDays = (data, shifts, fromDate, toDate) => {
    console.log(data, shifts, fromDate, toDate, 'info')
    const now = Date.now();
    const results = [];
    const parsedShifts = shifts.map(shift => {
        const [sH, sM] = shift.start_time.split(":").map(Number);
        const [eH, eM] = shift.end_time.split(":").map(Number);
        const startMinutes = sH * 60 + sM;
        const endMinutes = eH * 60 + eM;
        return {
            ...shift,
            startMinutes,
            endMinutes,
            isOvernight: endMinutes <= startMinutes
        };
    });

    Object.keys(data).forEach(machineId => {
        const machine = data[machineId];
        const operatorValues = machine.operatorValues || [];
        const componentValues = machine.componentValues || [];
        const utilizationValues = machine.utilizationValues || [];
        console.log(utilizationValues, 'utlization')
        if (!Array.isArray(utilizationValues) || utilizationValues.length === 0) return;

        const sortedUtilization = [...utilizationValues].sort((a, b) => Number(a.ts) - Number(b.ts));

        const startDateObj = dayjs(fromDate).startOf('day');
        const endDateObj = dayjs(toDate).endOf('day');
        let currentDate = startDateObj;

        while (currentDate <= endDateObj) {
            const dateString = currentDate.format("DD-MM-YYYY");
            parsedShifts.forEach(shift => {
                const [sH, sM] = shift.start_time.split(":").map(Number);
                const [eH, eM] = shift.end_time.split(":").map(Number);
                let shiftStart = dayjs(currentDate).hour(sH).minute(sM).second(0).millisecond(0);
                let shiftEnd = dayjs(currentDate).hour(eH).minute(eM).second(0).millisecond(0);

                if (shift.isOvernight) {
                    shiftEnd = shiftEnd.add(1, 'day');
                }
                const adjustedShiftEnd = shiftEnd.subtract(1, 'millisecond');
                const shiftUtilizationValues = sortedUtilization.filter(util => {
                    return util.ts >= shiftStart.valueOf() && util.ts <= adjustedShiftEnd.valueOf();
                });

                if (shiftUtilizationValues.length === 0) return;

                // Get the latest utilization value for the shift
                const lastUtilization = shiftUtilizationValues[shiftUtilizationValues.length - 1];
                const ts = Number(lastUtilization.ts);
                const utilData = lastUtilization.value || null;
                const operator = operatorValues.find(op => {
                    const opStart = Number(op.value?.start_time);
                    let opEnd = Number(op.value?.end_time);
                    if (!opEnd || isNaN(opEnd) || opEnd === 0) opEnd = now;
                    return ts >= opStart && ts <= opEnd;
                });

                const component = componentValues.find(cmp => {
                    const cmpStart = Number(cmp.value?.start_time);
                    let cmpEnd = Number(cmp.value?.end_time);
                    if (!cmpEnd || isNaN(cmpEnd) || cmpEnd === 0) cmpEnd = now;
                    return ts >= cmpStart && ts <= cmpEnd;
                });

                results.push({
                    date: dateString,
                    machine_name: machine.machineName || machineId,
                    utilization_value: Number(utilData || 0),
                    shift_number: shift.shift_no,
                    operator_name: operator?.value?.name || "NO OPERATOR",
                    operator_code: operator?.value?.code || "-",
                    component_name: component?.value?.name || "NO ROUTECARD",
                    component_code: component?.value?.code || "-",
                    timestamp: new Date(ts).toLocaleString(),
                    shift_start_time: shift.start_time,
                    shift_end_time: shift.end_time,
                });
            });
            currentDate = currentDate.add(1, 'day');
        }
    });
    return results;
};

const mapDataToOeeMonth = (data) => {
    const results = [];
    Object.keys(data).forEach(machineId => {
        const machine = data[machineId];
        const oeeValues = machine.oeeValues || [];
        if (!Array.isArray(oeeValues) || oeeValues.length === 0) return;

        const groupedByMonth = {};
        oeeValues.forEach(oee => {
            const dateObj = new Date(Number(oee.ts));
            const monthKey = `${String(dateObj.getMonth() + 1).padStart(2, "0")}-${dateObj.getFullYear()}`;
            if (!groupedByMonth[monthKey]) {
                groupedByMonth[monthKey] = { sum: 0, count: 0 };
            }
            groupedByMonth[monthKey].sum += Number(oee.value);
            groupedByMonth[monthKey].count++;
        });

        Object.keys(groupedByMonth).forEach(monthKey => {
            const d = groupedByMonth[monthKey];
            const avgOee = d.count > 0 ? d.sum / d.count : 0;
            results.push({
                date: monthKey,
                machine_name: machine.machineName || machineId,
                oee_value: Math.round(avgOee * 100) / 100,
                shift_number: "All",
                operator_name: "-",
                operator_code: "-",
                component_name: "-",
                component_code: "-",
                timestamp: monthKey,
                shift_start_time: "-",
                shift_end_time: "-"
            });
        });
    });
    return results;
};

const mapDataToUtilizationMonth = (data) => {
    const results = [];
    Object.keys(data).forEach(machineId => {
        const machine = data[machineId];
        const utilizationValues = machine.utilizationValues || [];
        if (!Array.isArray(utilizationValues) || utilizationValues.length === 0) return;

        const groupedByMonth = {};
        utilizationValues.forEach(util => {
            const dateObj = new Date(Number(util.ts));
            const monthKey = `${String(dateObj.getMonth() + 1).padStart(2, "0")}-${dateObj.getFullYear()}`;
            if (!groupedByMonth[monthKey]) {
                groupedByMonth[monthKey] = { sum: 0, count: 0 };
            }
            const utilData = util.value ? JSON.parse(util.value) : { utilization: 0 };
            groupedByMonth[monthKey].sum += Number(utilData.utilization || 0);
            groupedByMonth[monthKey].count++;
        });

        Object.keys(groupedByMonth).forEach(monthKey => {
            const d = groupedByMonth[monthKey];
            const avgUtil = d.count > 0 ? d.sum / d.count : 0;
            results.push({
                date: monthKey,
                machine_name: machine.machineName || machineId,
                utilization_value: Math.round(avgUtil * 100) / 100,
                shift_number: "All",
                operator_name: "-",
                operator_code: "-",
                component_name: "-",
                component_code: "-",
                timestamp: monthKey,
                shift_start_time: "-",
                shift_end_time: "-"
            });
        });
    });
    return results;
};

// Parts aggregation helpers for utilization view
const aggregatePartsByDay = (partsData) => {
    const byDay = {};
    (partsData || []).forEach(d => {
        if (!byDay[d.date]) byDay[d.date] = { totalshots: 0, target: 0 };
        byDay[d.date].totalshots += d.totalshots || 0;
        byDay[d.date].target += d.target || 0;
    });
    return byDay;
};

const aggregatePartsByWeek = (partsData) => {
    const byWeek = {};
    (partsData || []).forEach(d => {
        const date = dayjs(d.date);
        const dow = date.day(); // 0=Sun, 1=Mon
        const monday = date.subtract(dow === 0 ? 6 : dow - 1, 'day');
        const weekKey = monday.format('YYYY-MM-DD');
        if (!byWeek[weekKey]) byWeek[weekKey] = { totalshots: 0, target: 0 };
        byWeek[weekKey].totalshots += d.totalshots || 0;
        byWeek[weekKey].target += d.target || 0;
    });
    return byWeek;
};

const aggregatePartsByMonth = (partsData) => {
    const byMonth = {};
    (partsData || []).forEach(d => {
        const monthKey = dayjs(d.date).format('YYYY-MM');
        if (!byMonth[monthKey]) byMonth[monthKey] = { totalshots: 0, target: 0 };
        byMonth[monthKey].totalshots += d.totalshots || 0;
        byMonth[monthKey].target += d.target || 0;
    });
    return byMonth;
};

// Main Component
export default function NewAnalytics() {
    const customerId = localStorage.getItem("CustomerID");
    const newToken = localStorage.getItem("token");

    // Custom hooks
    const {
        devices,
        deviceNameID,
        machineGroups,
        availableMachines,
        selectedMachines,
        selectedGroups,
        showMachineGroupsDropdown,
        isAllMachinesSelected,
        handleGroupChange,
        handleMachineChange,
        getDeviceObjectsForMachines
    } = useMachineGroups(customerId);

    // State
    const [shifts, setShifts] = useState([]);
    const [fromDate, setFromDate] = useState(dayjs().subtract(7, 'day'));
    const [toDate, setToDate] = useState(dayjs());
    const isGPLAST = cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST;
    const [analysisType, setAnalysisType] = useState(
        cleanCustomerId(customerId) === window._env_.SMC_CUSTOMER_ID
            ? ANALYSIS_TYPES.PARTS
            : ANALYSIS_TYPES.UTILIZATION
    );
    const [grafanaUrl, setGrafanaUrl] = useState("");
    const [selectedShift, setSelectedShift] = useState("all");
    const [fromTime, setFromTime] = useState(null);
    const [toTime, setToTime] = useState(null);
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [tableData, setTableData] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [viewType, setViewType] = useState("grafana"); // Default to Grafana view
    const [hasGeneratedData, setHasGeneratedData] = useState(false);
    const [avgOeeData, setAvgOeeData] = useState({});
    const [oeeFiscalUrl, setOeeFiscalUrl] = useState("");
    const [oeeDaysUrl, setOeeDaysUrl] = useState("");
    const [oeeMonthUrl, setOeeMonthUrl] = useState("");
    const [oeeGrafanaUrl, setOeeGrafanaUrl] = useState("");
    const [oeeViewType, setOeeViewType] = useState(OEE_VIEW_TYPES.FISCAL);
    const [oeeDaysTableData, setOeeDaysTableData] = useState([]);
    const [oeeDaysPage, setOeeDaysPage] = useState(0);
    const [oeeDaysRowsPerPage, setOeeDaysRowsPerPage] = useState(25);
    const [avgUtilizationData, setAvgUtilizationData] = useState({});
    const [utilizationFiscalUrl, setUtilizationFiscalUrl] = useState("");
    const [utilizationDaysUrl, setUtilizationDaysUrl] = useState("");
    const [utilizationMonthUrl, setUtilizationMonthUrl] = useState("");
    const [utilizationGrafanaUrl, setUtilizationGrafanaUrl] = useState("");
    const [utilizationViewType, setUtilizationViewType] = useState(UTILIZATION_VIEW_TYPES.FISCAL);
    const [utilizationDaysTableData, setUtilizationDaysTableData] = useState([]);
    const [utilizationDaysPage, setUtilizationDaysPage] = useState(0);
    const [utilizationDaysRowsPerPage, setUtilizationDaysRowsPerPage] = useState(25);
    const [oeeMonthTableData, setOeeMonthTableData] = useState([]);
    const [oeeMonthPage, setOeeMonthPage] = useState(0);
    const [oeeMonthRowsPerPage, setOeeMonthRowsPerPage] = useState(25);
    const [utilizationMonthTableData, setUtilizationMonthTableData] = useState([]);
    const [utilizationMonthPage, setUtilizationMonthPage] = useState(0);
    const [utilizationMonthRowsPerPage, setUtilizationMonthRowsPerPage] = useState(25);
    const [selectedYear, setSelectedYear] = useState(dayjs().year());
    const [data, setData] = useState({
        summary: null,
        dayWise: null,
        monthWise: null,
        ShiftData: null
    });
    const [avgPerformance, setAvgPerformance] = useState([]);
    const [iframeUrl, setIframeUrl] = useState("");
    const [todayData, setTodayData] = useState(null);
    const [todayFrom, setTodayFrom] = useState(null);
    const [todayTo, setTodayTo] = useState(null);
    const minYear = 2025;
    const maxYear = dayjs().year();
    const [partsViewType, setPartsViewType] = useState("day");
    const [downtimePeriod, setDowntimePeriod] = useState("day"); // "day" | "week" | "month"
    const [downtimeTopCount, setDowntimeTopCount] = useState(3); // 3 or 4

    // Memoized values
    const isShiftDisabled = useMemo(() =>
        !fromDate || !toDate ? true : !fromDate.isSame(toDate, "day"),
        [fromDate, toDate]
    );

    const isRunDisabled = useMemo(() =>
        isLoading || selectedMachines.length === 0,
        [isLoading, selectedMachines.length]
    );

    const currentColumns = useMemo(() =>
        COLUMN_DEFINITIONS[analysisType] || [],
        [analysisType]
    );

    // Pagination for all view types
    const paginatedData = useMemo(() => {
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.DAYS) {
            return oeeDaysTableData.slice(oeeDaysPage * oeeDaysRowsPerPage, oeeDaysPage * oeeDaysRowsPerPage + oeeDaysRowsPerPage);
        }
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.MONTH) {
            return oeeMonthTableData.slice(oeeMonthPage * oeeMonthRowsPerPage, oeeMonthPage * oeeMonthRowsPerPage + oeeMonthRowsPerPage);
        }
        if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) {
            return utilizationDaysTableData.slice(utilizationDaysPage * utilizationDaysRowsPerPage, utilizationDaysPage * utilizationDaysRowsPerPage + utilizationDaysRowsPerPage);
        }
        if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH) {
            return utilizationMonthTableData.slice(utilizationMonthPage * utilizationMonthRowsPerPage, utilizationMonthPage * utilizationMonthRowsPerPage + utilizationMonthRowsPerPage);
        }
        return tableData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [
        analysisType, oeeViewType, utilizationViewType,
        tableData, oeeDaysTableData, oeeMonthTableData, utilizationDaysTableData, utilizationMonthTableData,
        page, rowsPerPage,
        oeeDaysPage, oeeDaysRowsPerPage,
        oeeMonthPage, oeeMonthRowsPerPage,
        utilizationDaysPage, utilizationDaysRowsPerPage,
        utilizationMonthPage, utilizationMonthRowsPerPage
    ]);

    const currentPage = useMemo(() => {
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.DAYS) return oeeDaysPage;
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.MONTH) return oeeMonthPage;
        if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) return utilizationDaysPage;
        if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH) return utilizationMonthPage;
        return page;
    }, [analysisType, oeeViewType, utilizationViewType, oeeDaysPage, oeeMonthPage, utilizationDaysPage, utilizationMonthPage, page]);

    const currentRowsPerPage = useMemo(() => {
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.DAYS) return oeeDaysRowsPerPage;
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.MONTH) return oeeMonthRowsPerPage;
        if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) return utilizationDaysRowsPerPage;
        if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH) return utilizationMonthRowsPerPage;
        return rowsPerPage;
    }, [analysisType, oeeViewType, utilizationViewType, oeeDaysRowsPerPage, oeeMonthRowsPerPage, utilizationDaysRowsPerPage, utilizationMonthRowsPerPage, rowsPerPage]);

    const currentDataLength = useMemo(() => {
        if (analysisType === ANALYSIS_TYPES.OEE) {
            if (oeeViewType === OEE_VIEW_TYPES.DAYS) return oeeDaysTableData.length;
            if (oeeViewType === OEE_VIEW_TYPES.MONTH) return oeeMonthTableData.length;
            return tableData.length;
        }
        if (analysisType === ANALYSIS_TYPES.UTILIZATION) {
            if (utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) return utilizationDaysTableData.length;
            if (utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH) return utilizationMonthTableData.length;
            return tableData.length;
        }
        return tableData.length;
    }, [analysisType, oeeViewType, utilizationViewType, tableData, oeeDaysTableData, oeeMonthTableData, utilizationDaysTableData, utilizationMonthTableData]);

    const hasData = useMemo(() => {
        if (analysisType === ANALYSIS_TYPES.OEE) {
            if (oeeViewType === OEE_VIEW_TYPES.DAYS) return oeeDaysTableData.length > 0;
            if (oeeViewType === OEE_VIEW_TYPES.MONTH) return oeeMonthTableData.length > 0;
            return tableData.length > 0;
        }
        if (analysisType === ANALYSIS_TYPES.UTILIZATION) {
            if (utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) return utilizationDaysTableData.length > 0;
            if (utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH) return utilizationMonthTableData.length > 0;
            return tableData.length > 0;
        }
        return tableData.length > 0;
    }, [analysisType, oeeViewType, utilizationViewType, tableData, oeeDaysTableData, oeeMonthTableData, utilizationDaysTableData, utilizationMonthTableData]);

    const getReportTitle = useMemo(() => {
        switch (analysisType) {
            case ANALYSIS_TYPES.LIVE_ALARM: return 'Alarm Report';
            case ANALYSIS_TYPES.LIVE_REASON: return 'Downtime Report';
            case ANALYSIS_TYPES.OEE: return 'OEE Analysis';
            case ANALYSIS_TYPES.UTILIZATION: return 'Utilization Analysis';
            case ANALYSIS_TYPES.PARTS: return 'TargetVsActual Analysis';
            default: return 'Analytics Report';
        }
    }, [analysisType]);

    // Fetch shifts on mount
    useEffect(() => {
        if (customerId) {
            fetchShifts();
        }
    }, [customerId]);

    // Handle date/shift changes
    useEffect(() => {
        if (analysisType === "Parts") return;
        if (!fromDate || !toDate || shifts.length === 0) return;

        if (!fromDate.isSame(toDate, "day") || selectedShift === "all") {
            setSelectedShift("all");
            handleAllShiftsTimeRange();
        } else {
            handleSingleShiftTimeRange();
        }
    }, [fromDate, toDate, selectedShift, shifts]);

    // Initial data load
    useEffect(() => {
        if (isInitialLoad && shifts.length > 0 && from && to && selectedMachines.length > 0) {
            handleGenerateReport();
            setIsInitialLoad(false);
        }
    }, [isInitialLoad, shifts, from, to, selectedMachines]);

    // Reset view types when switching analysis types
    useEffect(() => {
        if (analysisType !== ANALYSIS_TYPES.OEE) {
            setOeeViewType(OEE_VIEW_TYPES.FISCAL);
        }
        if (analysisType !== ANALYSIS_TYPES.UTILIZATION) {
            setUtilizationViewType(UTILIZATION_VIEW_TYPES.FISCAL);
        }
    }, [analysisType]);

    // Helper functions
    const fetchShifts = async () => {
        try {
            const result = await customerbasedshift(customerId, "allShift");
            const shiftList = result?.[0]?.value || [];
            setShifts(shiftList);
        } catch (err) {
            console.error("Failed to fetch shifts", err);
        }
    };

    const getShiftTimes = useCallback((shifts, shiftNo, date) => {
        if (!shifts.length || !date) return { from: null, to: null };

        const base = dayjs(date).format("YYYY-MM-DD");
        const dayOffset = (d) => dayjs(base).add(Number(d) - 1, "day").format("YYYY-MM-DD");

        if (shiftNo === "allshift") {
            const sorted = [...shifts].sort((a, b) => a.shift_no - b.shift_no);
            return {
                from: new Date(`${dayOffset(sorted[0].start_day)}T${sorted[0].start_time}`).getTime(),
                to: new Date(`${dayOffset(sorted.at(-1).end_day)}T${sorted.at(-1).end_time}`).getTime()
            };
        }

        const s = shifts.find((x) => String(x.shift_no) === String(shiftNo));
        if (!s) return { from: null, to: null };

        return {
            from: new Date(`${dayOffset(s.start_day)}T${s.start_time}`).getTime(),
            to: new Date(`${dayOffset(s.end_day)}T${s.end_time}`).getTime()
        };
    }, []);

    const handleAllShiftsTimeRange = () => {
        const firstShift = shifts[0];
        const lastShift = shifts[shifts.length - 1];
        const fromDT = dayjs(fromDate)
            .hour(Number(firstShift.start_time.split(":")[0]))
            .minute(Number(firstShift.start_time.split(":")[1]))
            .second(0)
            .millisecond(0);

        let lastShiftEndDT = dayjs(toDate)
            .hour(Number(lastShift.end_time.split(":")[0]))
            .minute(Number(lastShift.end_time.split(":")[1]))
            .second(0)
            .millisecond(0);

        const [endH, endM] = lastShift.end_time.split(":").map(Number);
        const [startH, startM] = lastShift.start_time.split(":").map(Number);
        if (endH < startH || (endH === startH && endM <= startM)) {
            lastShiftEndDT = lastShiftEndDT.add(1, "day");
        }
        setFromTime(firstShift.start_time);
        setToTime(lastShift.end_time);
        setFrom(fromDT.valueOf());
        setTo(lastShiftEndDT.valueOf());
    };

    const handleSingleShiftTimeRange = () => {
        const shift = shifts.find((s) => String(s.shift_no) === String(selectedShift)) || shifts[0];
        const startH = Number(shift.start_time.split(":")[0]);
        const startM = Number(shift.start_time.split(":")[1]);
        const endH = Number(shift.end_time.split(":")[0]);
        const endM = Number(shift.end_time.split(":")[1]);

        const fromDT = dayjs(fromDate).hour(startH).minute(startM).second(0).millisecond(0);
        let toDT = dayjs(fromDate).hour(endH).minute(endM).second(0).millisecond(0);
        if (endH < startH || (endH === startH && endM <= startM)) {
            toDT = toDT.add(1, "day");
        }
        setFromTime(shift.start_time);
        setToTime(shift.end_time);
        setFrom(fromDT.valueOf());
        setTo(toDT.valueOf());
    };

    const handlePartsYearTimeRange = () => {
        if (!shifts?.length || !selectedYear) return;

        const now = dayjs();
        const currentYear = now.year();

        const firstShift = shifts[0];
        const lastShift = shifts[shifts.length - 1];

        // ---------- FROM ----------
        const yearStart = dayjs(`${selectedYear}-01-01`);
        const [fsH, fsM] = firstShift.start_time.split(":").map(Number);

        const fromDT = yearStart
            .hour(fsH)
            .minute(fsM)
            .second(0)
            .millisecond(0);

        let toDT;
        let todayFromDT = null;
        let todayToDT = null;

        // ---------- CURRENT YEAR ----------
        if (Number(selectedYear) === currentYear) {
            let currentShift = shifts[0];

            for (const shift of shifts) {
                const [sh, sm] = shift.start_time.split(":").map(Number);
                const [eh, em] = shift.end_time.split(":").map(Number);

                let start = dayjs().hour(sh).minute(sm).second(0);
                let end = dayjs().hour(eh).minute(em).second(0);

                if (eh < sh || (eh === sh && em <= sm)) {
                    end = end.add(1, "day");
                }

                if (now.isAfter(start) && now.isBefore(end)) {
                    currentShift = shift;
                    break;
                }
            }

            const [endH, endM] = currentShift.end_time.split(":").map(Number);
            const [startH, startM] =
                currentShift.start_time.split(":").map(Number);

            toDT = dayjs().hour(endH).minute(endM).second(0);

            if (endH < startH || (endH === startH && endM <= startM)) {
                toDT = toDT.add(1, "day");
            }
        }

        // ---------- PAST YEAR ----------
        else {
            const yearEnd = dayjs(`${selectedYear}-12-31`);

            const [endH, endM] = lastShift.end_time.split(":").map(Number);
            const [startH, startM] =
                lastShift.start_time.split(":").map(Number);

            toDT = yearEnd.hour(endH).minute(endM).second(0);

            if (endH < startH || (endH === startH && endM <= startM)) {
                toDT = toDT.add(1, "day");
            }

            // todayFrom = current week start shift
            const [curFsH, curFsM] =
                firstShift.start_time.split(":").map(Number);

            const weekStart = dayjs().startOf("week").add(1, "day");

            todayFromDT = weekStart
                .hour(curFsH)
                .minute(curFsM)
                .second(0)
                .millisecond(0);

            // todayTo = current shift end
            let currentShift = shifts[0];

            for (const shift of shifts) {
                const [sh, sm] = shift.start_time.split(":").map(Number);
                const [eh, em] = shift.end_time.split(":").map(Number);

                let start = dayjs().hour(sh).minute(sm).second(0);
                let end = dayjs().hour(eh).minute(em).second(0);

                if (eh < sh || (eh === sh && em <= sm)) {
                    end = end.add(1, "day");
                }

                if (now.isAfter(start) && now.isBefore(end)) {
                    currentShift = shift;
                    break;
                }
            }

            const [curEndH, curEndM] =
                currentShift.end_time.split(":").map(Number);
            const [curStartH, curStartM] =
                currentShift.start_time.split(":").map(Number);

            todayToDT = dayjs()
                .hour(curEndH)
                .minute(curEndM)
                .second(0);

            if (
                curEndH < curStartH ||
                (curEndH === curStartH && curEndM <= curStartM)
            ) {
                todayToDT = todayToDT.add(1, "day");
            }
        }

        // ---------- STATE UPDATE ----------
        setFrom(fromDT?.valueOf() ?? null);
        setTo(toDT?.valueOf() ?? null);

        if (todayFromDT) setTodayFrom(todayFromDT.valueOf());
        if (todayToDT) setTodayTo(todayToDT.valueOf());
    };
    console.log('setfrom', todayFrom, 'setto', todayTo)

    useEffect(() => {
        if (analysisType === "Parts" && shifts.length) {
            handlePartsYearTimeRange();
        }
    }, [analysisType, selectedYear, shifts]);



    const selectedMachineIds = deviceNameID
        .filter(device => selectedMachines.includes(device.name))
        .map(device => device.id);
    const generatePartsReport = async () => {
        if (!selectedMachineIds.length || !from || !to) return;

        setIframeUrl(""); // clear old iframe

        try {
            // ---------- YEAR DATA ----------
            const resYear = await getPartsReport({
                machineIds: selectedMachineIds,
                shifts,
                fromEpoch: from,
                toEpoch: to,
                getShiftTimes
            });

            const newData = {
                ShiftData: resYear.shiftData,
                summary: resYear.summary,
                dayWise: resYear.dayWise,
                monthWise: resYear.monthWise
            };

            setData(newData);

            // ---------- CURRENT PERIOD DATA ----------
            let todaySummary = null;

            if (todayFrom && todayTo) {
                const resToday = await getPartsReport({
                    machineIds: selectedMachineIds,
                    shifts,
                    fromEpoch: todayFrom,
                    toEpoch: todayTo,
                    getShiftTimes
                });

                todaySummary = resToday.summary;
                setTodayData(todaySummary);
            }

            // ---------- PERFORMANCE ----------
            const perf = [
                {
                    today:
                        todaySummary?.today?.performance ??
                        newData.summary?.today?.performance ??
                        0
                },
                {
                    yesterday:
                        todaySummary?.yesterday?.performance ??
                        newData.summary?.yesterday?.performance ??
                        0
                }
            ];

            setAvgPerformance(perf);

            // ---------- DASHBOARD URL ----------
            const url =
                `${window._env_.GRAFANA_URL}d/dfcaxb6r91jwgc/analytics-production-metrics-db?orgId=1&theme=light&kiosk=true` +
                `&var-efficiency=${encodeURIComponent(JSON.stringify(perf))}` +
                `&var-p_data=${encodeURIComponent(JSON.stringify(todaySummary || newData.summary))}` +
                `&var-monthdata=${encodeURIComponent(JSON.stringify(newData.monthWise))}`;

            setIframeUrl(url);

        } catch (error) {
            console.error("Parts report failed:", error);
        }
    };


    console.log('data', data, 'todaydata', todayData, 'avgperformance', avgPerformance)
    // Data processing functions
    const processAlarmData = useCallback(async () => {
        const devicesToProcess = getDeviceObjectsForMachines(selectedMachines);
        if (!from || !to) return [];

        const dataTypes = analysisType === ANALYSIS_TYPES.LIVE_ALARM
            ? ["live_alarm", "live_operator", "live_component", "lock_status"]
            : ["live_reason", "live_operator", "live_component", "lock_status"];

        const result = await fetchAlarmDowntimeData(devicesToProcess, from, to, dataTypes);
        return mapDataToOperator(result, analysisType === ANALYSIS_TYPES.LIVE_ALARM ? "alarm" : "reason", shifts);
    }, [analysisType, from, to, selectedMachines, shifts, getDeviceObjectsForMachines]);

    const processOeeData = useCallback(async () => {
        const machinesForUrl = selectedMachines;
        const devicesToProcessFromMachines = getDeviceObjectsForMachines(machinesForUrl);

        if (devicesToProcessFromMachines.length === 0) {
            console.log("No devices to process for OEE data");
            return { avgData: {}, oeeData: {}, fiscalTableData: [], daysTableData: [] };
        }

        const { avgData, oeeData } = await getAverageOEEForRange(
            devicesToProcessFromMachines,
            shifts,
            from,
            to
        );

        const idToNameMap = Object.fromEntries(
            deviceNameID.map(d => [d.id, d.name])
        );
        const renamedData = Object.fromEntries(
            Object.entries(avgData).map(([id, value]) => [
                idToNameMap[id] || id,
                value
            ])
        );

        const fiscalTableData = mapDataToOeeFiscal(oeeData);
        const daysTableData = mapDataToOeeDays(oeeData, shifts, fromDate, toDate);
        const monthTableData = mapDataToOeeMonth(oeeData);

        return { avgData: renamedData, oeeData, fiscalTableData, daysTableData, monthTableData };
    }, [selectedMachines, shifts, from, to, fromDate, toDate, deviceNameID, getDeviceObjectsForMachines]);

    const processUtilizationData = useCallback(async () => {
        const machinesForUrl = selectedMachines;
        const devicesToProcessFromMachines = getDeviceObjectsForMachines(machinesForUrl);

        if (devicesToProcessFromMachines.length === 0) {
            console.log("No devices to process for Utilization data");
            return { avgData: {}, utilData: {}, fiscalTableData: [], daysTableData: [] };
        }

        const { avgData, utilData } = await getAverageUtilizationForRange(
            devicesToProcessFromMachines,
            shifts,
            from,
            to
        );
        console.log('util data', utilData)
        const idToNameMap = Object.fromEntries(
            deviceNameID.map(d => [d.id, d.name])
        );
        const renamedData = Object.fromEntries(
            Object.entries(avgData).map(([id, value]) => [
                idToNameMap[id] || id,
                value
            ])
        );

        const fiscalTableData = mapDataToUtilizationFiscal(utilData);
        const daysTableData = mapDataToUtilizationDays(utilData, shifts, fromDate, toDate);
        const monthTableData = mapDataToUtilizationMonth(utilData);

        return { avgData: renamedData, utilData, fiscalTableData, daysTableData, monthTableData };
    }, [selectedMachines, shifts, from, to, fromDate, toDate, deviceNameID, getDeviceObjectsForMachines]);
    const updateGrafanaURL = useCallback((type = analysisType, machines = selectedMachines) => {
        if (type === ANALYSIS_TYPES.OEE || type === ANALYSIS_TYPES.UTILIZATION) return;

        try {
            const machineParam = machines.join(",");
            const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
            const cleanedId = cleanCustomerId(customerId);
            const baseUrl = window._env_.SERVER_URL;
            const GRAFANA_URL = window._env_.GRAFANA_URL;
            const entityType = "CUSTOMER";
            const fromDateStr = dayjs(fromDate).format("YYYY-MM-DD");
            const toDateStr = dayjs(toDate).format("YYYY-MM-DD");
            const shiftParam =
                selectedShift && selectedShift !== "all"
                    ? selectedShift
                    : shifts.map(s => s.shift_no).join(",");
            const topNums = Array.from({ length: downtimeTopCount }, (_, i) => `top${i + 1}`);
            const topParams = topNums.map(t => `var-top=${t}`).join("&");
            const reporturl = `${window._env_.SERVER_URL2}report/idle_report/${machineParam}/${shiftParam}/${fromDateStr}/${toDateStr}/1/10000000000000`;

            const url = type === 'live_reason'
                ? (cleanedId !== CUSTOMER_IDS.PMI
                    ? `${GRAFANA_URL}d/afbprll75uwaoa/analytics-downtime-report-based?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-keys=${type}&var-grafanaurl=${GRAFANA_URL}&var-machines=${encodeURIComponent(machineParam)}&var-idleReasonReportUrl=${reporturl}&var-period=${downtimePeriod}&${topParams}&kiosk&theme=light&refresh=20s`
                    : `${GRAFANA_URL}d/affv6yl9skjk0a/analytics-downtime-top?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-keys=${type}&var-grafanaurl=${GRAFANA_URL}&var-machines=${encodeURIComponent(machineParam)}&var-idleReasonReportUrl=${reporturl}&var-period=${downtimePeriod}&${topParams}&kiosk&theme=light&refresh=20s`)
                : `${GRAFANA_URL}d/af88lwhpkj08wd/analytics-downtime-alarm?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-keys=${type}&var-grafanaurl=${GRAFANA_URL}&var-machines=${encodeURIComponent(machineParam)}&kiosk&theme=light&refresh=20s`;
            setGrafanaUrl(url);
        } catch (error) {
            console.error("Error updating Grafana URL:", error);
        }
    }, [analysisType, selectedMachines, newToken, customerId, fromTime, toTime, from, to, downtimePeriod, downtimeTopCount]);

    const generateOeeGrafanaUrls = useCallback(async (avgOeeData, partsData = null) => {
        const machinesParam = selectedMachines.join(",");
        const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
        const cleanedId = cleanCustomerId(customerId);
        const entityType = "CUSTOMER";
        const baseUrl = window._env_.SERVER_URL;
        const GRAFANA_URL = window._env_.GRAFANA_URL;

        const deviceWiseData = Object.fromEntries(
            Object.entries(avgOeeData).map(([deviceId, deviceData]) => {
                const formatted = Object.entries(deviceData).map(([date, value]) => ({
                    date,
                    value,
                }));
                return [deviceId, formatted];
            })
        );

        const avgOeeJson = encodeURIComponent(JSON.stringify(deviceWiseData));

        const totalshots = partsData ? partsData.reduce((sum, s) => sum + (s.totalshots || 0), 0) : 0;
        const targetparts = partsData ? partsData.reduce((sum, s) => sum + (s.target || 0), 0) : 0;
        const partsParams = `&var-totalshots=${totalshots}&var-ttotalshots=${totalshots}&var-targetparts=${targetparts}`;

        const fiscalUrl = `${GRAFANA_URL}d/bf4e1lg78zmdcf/analytics-dashboard-oee?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-avgOee=${avgOeeJson}&var-machines=${encodeURIComponent(machinesParam)}&var-type=OEE${partsParams}&kiosk&theme=light&refresh=20s`;

        const daysUrl = `${GRAFANA_URL}d/af88m3yq4cu80e/analytics-dashboard-oee-day-wise-2?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-avgOee=${avgOeeJson}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-machines=${encodeURIComponent(machinesParam)}&var-type=OEE${partsParams}&kiosk&theme=light&refresh=20s`;

        const MonthUrl = `${GRAFANA_URL}d/dfe31si9uqrk0e/analytics-dashboard-oee-monthwise?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-avgOee=${avgOeeJson}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-machines=${encodeURIComponent(machinesParam)}&var-type=OEE${partsParams}&kiosk&theme=light&refresh=20s`;

        setOeeFiscalUrl(fiscalUrl);
        setOeeDaysUrl(daysUrl);
        setOeeMonthUrl(MonthUrl);
        const urlMap = {
            [OEE_VIEW_TYPES.FISCAL]: fiscalUrl,
            [OEE_VIEW_TYPES.DAYS]: daysUrl,
            [OEE_VIEW_TYPES.MONTH]: MonthUrl,
        };

        setOeeGrafanaUrl(urlMap[oeeViewType] || daysUrl);
    }, [selectedMachines, newToken, customerId, from, to, oeeViewType]);

    const generateUtilizationGrafanaUrls = useCallback(async (avgUtilizationData, partsData = null) => {
        const machinesParam = selectedMachines.join(",");
        const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
        const cleanedId = cleanCustomerId(customerId);
        const entityType = "CUSTOMER";
        const baseUrl = window._env_.SERVER_URL;
        const GRAFANA_URL = window._env_.GRAFANA_URL;

        // Aggregate parts by each view granularity
        const partsByWeek = aggregatePartsByWeek(partsData);
        const partsByDay = aggregatePartsByDay(partsData);
        const partsByMonth = aggregatePartsByMonth(partsData);

        // Build device-wise data with totalparts/targetparts for a given lookup function
        const buildDeviceWiseData = (getPartsForDate) =>
            Object.fromEntries(
                Object.entries(avgUtilizationData).map(([deviceId, deviceData]) => {
                    const formatted = Object.entries(deviceData).map(([date, value]) => {
                        const { totalparts, targetparts } = getPartsForDate(date);
                        return { date, value, totalparts, targetparts };
                    });
                    return [deviceId, formatted];
                })
            );

        // Fiscal = week-wise
        const fiscalDeviceData = buildDeviceWiseData((date) => {
            const d = dayjs(date);
            const dow = d.day();
            const monday = d.subtract(dow === 0 ? 6 : dow - 1, 'day');
            const w = partsByWeek[monday.format('YYYY-MM-DD')] || {};
            return { totalparts: w.totalshots || 0, targetparts: w.target || 0 };
        });

        // Day-wise
        const daysDeviceData = buildDeviceWiseData((date) => {
            const d = partsByDay[date] || {};
            return { totalparts: d.totalshots || 0, targetparts: d.target || 0 };
        });

        // Month-wise
        const monthDeviceData = buildDeviceWiseData((date) => {
            const d = partsByMonth[dayjs(date).format('YYYY-MM')] || {};
            return { totalparts: d.totalshots || 0, targetparts: d.target || 0 };
        });

        const fiscalJson = encodeURIComponent(JSON.stringify(fiscalDeviceData));
        const daysJson = encodeURIComponent(JSON.stringify(daysDeviceData));
        const monthJson = encodeURIComponent(JSON.stringify(monthDeviceData));

        // Total parts for URL params (sum across entire period)
        const totalshots = partsData ? partsData.reduce((sum, s) => sum + (s.totalshots || 0), 0) : 0;
        const targetparts = partsData ? partsData.reduce((sum, s) => sum + (s.target || 0), 0) : 0;
        const partsParams = `&var-totalshots=${totalshots}&var-ttotalshots=${totalshots}&var-targetparts=${targetparts}`;

        const fiscalUrl = `${GRAFANA_URL}d/bf4e1lg78zmdcf/analytics-dashboard-oee?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-avgOee=${fiscalJson}&var-machines=${encodeURIComponent(machinesParam)}&var-type=Utilization${partsParams}&kiosk&theme=light&refresh=20s`;

        const daysUrl = `${GRAFANA_URL}d/af88m3yq4cu80e/analytics-dashboard-oee-day-wise-2?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-avgOee=${daysJson}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-machines=${encodeURIComponent(machinesParam)}&var-type=Utilization${partsParams}&kiosk&theme=light&refresh=20s`;

        const monthUrl = `${GRAFANA_URL}d/dfe31si9uqrk0e/analytics-dashboard-oee-monthwise?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-avgOee=${monthJson}&var-machines=${encodeURIComponent(machinesParam)}&var-type=Utilization${partsParams}&kiosk&theme=light&refresh=20s`;

        setUtilizationFiscalUrl(fiscalUrl);
        setUtilizationDaysUrl(daysUrl);
        setUtilizationMonthUrl(monthUrl);
        setUtilizationGrafanaUrl(
            utilizationViewType === UTILIZATION_VIEW_TYPES.FISCAL ? fiscalUrl :
                utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS ? daysUrl : monthUrl
        );
    }, [selectedMachines, newToken, customerId, from, to, utilizationViewType]);

    const partsTableData = useMemo(() => {
        if (analysisType !== ANALYSIS_TYPES.PARTS) return [];

        return partsViewType === "day"
            ? data?.dayWise || []
            : data?.monthWise || [];
    }, [analysisType, partsViewType, data]);




    const handleGenerateReport = async () => {
        setIsLoading(true);
        try {
            if (analysisType === ANALYSIS_TYPES.OEE) {
                const { avgData, fiscalTableData, daysTableData, monthTableData } = await processOeeData();
                setAvgOeeData(avgData);
                setTableData(fiscalTableData);
                setOeeDaysTableData(daysTableData);
                setOeeMonthTableData(monthTableData);
                setPage(0);
                setOeeDaysPage(0);
                setOeeMonthPage(0);

                // Fetch parts data (totalshots, targetparts) for URL params
                let partsData = null;
                if (selectedMachineIds.length && from && to) {
                    partsData = await fetchPartsShiftWiseByDate({
                        machineIds: selectedMachineIds,
                        shifts,
                        fromEpoch: from,
                        toEpoch: to,
                        getShiftTimes
                    });
                }

                if (viewType === "grafana") {
                    await generateOeeGrafanaUrls(avgData, partsData);
                }
            } else if (analysisType === ANALYSIS_TYPES.UTILIZATION) {
                const { avgData, fiscalTableData, daysTableData, monthTableData } = await processUtilizationData();
                setAvgUtilizationData(avgData);
                setTableData(fiscalTableData);
                setUtilizationDaysTableData(daysTableData);
                setUtilizationMonthTableData(monthTableData);
                setPage(0);
                setUtilizationDaysPage(0);
                setUtilizationMonthPage(0);

                // Fetch parts data (totalshots, targetparts) for URL params
                let partsData = null;
                if (selectedMachineIds.length && from && to) {
                    partsData = await fetchPartsShiftWiseByDate({
                        machineIds: selectedMachineIds,
                        shifts,
                        fromEpoch: from,
                        toEpoch: to,
                        getShiftTimes
                    });
                }

                if (viewType === "grafana") {
                    await generateUtilizationGrafanaUrls(avgData, partsData);
                }
            } else if (analysisType === "Parts") {
                await generatePartsReport();
            } else {
                const tableDataResults = await processAlarmData();
                setTableData(tableDataResults);
                setOeeDaysTableData([]);
                setUtilizationDaysTableData([]);
                setPage(0);

                // Generate Grafana URL only if in Grafana view
                if (viewType === "grafana") {
                    updateGrafanaURL();
                }
            }

            // Set flag that data has been generated
            setHasGeneratedData(true);
        } catch (error) {
            console.error("Error generating report:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Export function
    const exportToCSV = () => {
        let dataToExport;
        let typeName;

        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.DAYS) {
            dataToExport = oeeDaysTableData;
            typeName = 'OEE_Days';
        } else if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) {
            dataToExport = utilizationDaysTableData;
            typeName = 'Utilization_Days';
        } else {
            dataToExport = tableData;
            const typeMap = {
                [ANALYSIS_TYPES.LIVE_ALARM]: 'Alarm',
                [ANALYSIS_TYPES.LIVE_REASON]: 'Downtime',
                [ANALYSIS_TYPES.OEE]: 'OEE_Fiscal',
                [ANALYSIS_TYPES.UTILIZATION]: 'Utilization_Fiscal'
            };
            typeName = typeMap[analysisType] || 'Report';
        }

        const headers = currentColumns.map(col => col.headerName);
        const csvRows = [headers.join(',')];

        dataToExport.forEach(row => {
            const values = currentColumns.map(col => {
                const value = row[col.field] || '';
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            });
            csvRows.push(values.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `${typeName}_Report_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`;
        saveAs(blob, filename);
    };

    // View switch handler
    const handleViewSwitch = (newViewType) => {
        setViewType(newViewType);

        // Only generate Grafana URL if switching to Grafana view and we have table data
        if (newViewType === "grafana" && hasData) {
            if (analysisType === ANALYSIS_TYPES.OEE) {
                generateOeeGrafanaUrls(avgOeeData);
            } else if (analysisType === ANALYSIS_TYPES.UTILIZATION) {
                generateUtilizationGrafanaUrls(avgUtilizationData);
            } else {
                updateGrafanaURL();
            }
        }
    };

    // Event handlers
    const handleAnalysisTypeChange = (e) => {
        const newType = e.target.value;
        setAnalysisType(newType);
        setPage(0);
        setOeeDaysPage(0);
        setOeeMonthPage(0);
        setUtilizationDaysPage(0);
        setUtilizationMonthPage(0);
    };

    const handleChangePage = (event, newPage) => {
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.DAYS) {
            setOeeDaysPage(newPage);
        } else if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.MONTH) {
            setOeeMonthPage(newPage);
        } else if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) {
            setUtilizationDaysPage(newPage);
        } else if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH) {
            setUtilizationMonthPage(newPage);
        } else {
            setPage(newPage);
        }
    };

    const handleChangeRowsPerPage = (event) => {
        const newRowsPerPage = parseInt(event.target.value, 10);
        if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.DAYS) {
            setOeeDaysRowsPerPage(newRowsPerPage);
            setOeeDaysPage(0);
        } else if (analysisType === ANALYSIS_TYPES.OEE && oeeViewType === OEE_VIEW_TYPES.MONTH) {
            setOeeMonthRowsPerPage(newRowsPerPage);
            setOeeMonthPage(0);
        } else if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.DAYS) {
            setUtilizationDaysRowsPerPage(newRowsPerPage);
            setUtilizationDaysPage(0);
        } else if (analysisType === ANALYSIS_TYPES.UTILIZATION && utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH) {
            setUtilizationMonthRowsPerPage(newRowsPerPage);
            setUtilizationMonthPage(0);
        } else {
            setRowsPerPage(newRowsPerPage);
            setPage(0);
        }
    };

    // Get current iframe URL
    const getCurrentIframeUrl = () => {
        if (analysisType === ANALYSIS_TYPES.OEE) {
            return oeeGrafanaUrl;
        } else if (analysisType === ANALYSIS_TYPES.UTILIZATION) {
            return utilizationGrafanaUrl;
        } else if (analysisType === ANALYSIS_TYPES.PARTS) {
            return iframeUrl;
        }
        return grafanaUrl;
    };

    // Handle OEE view type change
    const handleOeeViewTypeChange = (type) => {
        setOeeViewType(type);
        if (type === OEE_VIEW_TYPES.DAYS) {
            setOeeDaysPage(0);
        } else if (type === OEE_VIEW_TYPES.MONTH) {
            setOeeMonthPage(0);
        } else {
            setPage(0);
        }
        if (type === OEE_VIEW_TYPES.FISCAL && oeeFiscalUrl) {
            setOeeGrafanaUrl(oeeFiscalUrl);
        } else if (type === OEE_VIEW_TYPES.DAYS && oeeDaysUrl) {
            setOeeGrafanaUrl(oeeDaysUrl);
        } else if (type === OEE_VIEW_TYPES.MONTH && oeeMonthUrl) {
            setOeeGrafanaUrl(oeeMonthUrl);
        }
    };

    // Handle Utilization view type change
    const handleUtilizationViewTypeChange = (type) => {
        setUtilizationViewType(type);
        if (type === UTILIZATION_VIEW_TYPES.DAYS) {
            setUtilizationDaysPage(0);
        } else if (type === UTILIZATION_VIEW_TYPES.MONTH) {
            setUtilizationMonthPage(0);
        } else {
            setPage(0);
        }
        if (type === UTILIZATION_VIEW_TYPES.FISCAL && utilizationFiscalUrl) {
            setUtilizationGrafanaUrl(utilizationFiscalUrl);
        } else if (type === UTILIZATION_VIEW_TYPES.DAYS && utilizationDaysUrl) {
            setUtilizationGrafanaUrl(utilizationDaysUrl);
        } else if (type === UTILIZATION_VIEW_TYPES.MONTH && utilizationMonthUrl) {
            setUtilizationGrafanaUrl(utilizationMonthUrl);
        }
    };


    console.log(selectedMachineIds);
    console.log('analysistype', analysisType)
    console.log('from', from, 'to', to, fromTime, toTime)

    return (
        <Box
            display="flex"
            flexDirection="column"
            height="calc(100vh - 2.6rem)"
            sx={{
                backgroundColor: '#f5f5f7',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',
            }}
        >
            {/* App Bar with minimalist design - All filters in single row */}
            <AppBar
                position="static"
                elevation={0}
                sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                    px: 3,
                    py: 1.5,
                    mt: 2
                }}
            >
                <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: '48px !important' }}>


                    {/* Right side: OEE/Utilization View Toggle and View Toggle (only show when data has been generated) */}

                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="nowrap">
                        {/* Machine Groups Dropdown */}
                        {showMachineGroupsDropdown && (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>Machine Group</InputLabel>
                                <Select
                                    multiple
                                    value={selectedGroups}
                                    onChange={(e) => handleGroupChange(e.target.value)}
                                    label="Machine Group"
                                    renderValue={(selected) => {
                                        if (selected.length === machineGroups.length) return "All Groups";
                                        if (selected.length === 0) return "Select Groups";
                                        return selected.slice(0, 2).join(", ") + (selected.length > 2 ? "..." : "");
                                    }}
                                    sx={{
                                        fontSize: '14px',
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '10px',
                                            border: '1px solid rgba(0, 0, 0, 0.12)',
                                            '&:hover': {
                                                borderColor: '#007AFF',
                                            },
                                            '&.Mui-focused': {
                                                borderColor: '#007AFF',
                                                boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                                            }
                                        }
                                    }}
                                >
                                    <MenuItem value="all">
                                        <Checkbox checked={selectedGroups.length === machineGroups.length} />
                                        <ListItemText primary="All" />
                                    </MenuItem>
                                    {machineGroups.map((g) => (
                                        <MenuItem key={g.name} value={g.name}>
                                            <Checkbox checked={selectedGroups.includes(g.name)} />
                                            <ListItemText primary={g.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {/* Machines Dropdown */}
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>Machines</InputLabel>
                            <Select
                                multiple
                                value={selectedMachines}
                                onChange={(e) => handleMachineChange(e.target.value)}
                                label="Machines"
                                renderValue={(selected) =>
                                    isAllMachinesSelected ? "All Machines" :
                                        selected.slice(0, 2).join(", ") + (selected.length > 2 ? "..." : "")
                                }
                                sx={{
                                    fontSize: '14px',
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '10px',
                                        border: '1px solid rgba(0, 0, 0, 0.12)',
                                        '&:hover': {
                                            borderColor: '#007AFF',
                                        },
                                        '&.Mui-focused': {
                                            borderColor: '#007AFF',
                                            boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                                        }
                                    }
                                }}
                            >
                                <MenuItem value="all">
                                    <Checkbox checked={isAllMachinesSelected} />
                                    <ListItemText primary="All Machines" />
                                </MenuItem>
                                {availableMachines.map((machine) => (
                                    <MenuItem key={machine} value={machine}>
                                        <Checkbox checked={selectedMachines.includes(machine)} />
                                        <ListItemText primary={machine} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>Analysis Type</InputLabel>
                            <Select
                                value={analysisType}
                                onChange={handleAnalysisTypeChange}
                                label="Analysis Type"
                                sx={{
                                    fontSize: '14px',
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '10px',
                                        border: '1px solid rgba(0, 0, 0, 0.12)',
                                        '&:hover': {
                                            borderColor: '#007AFF',
                                        },
                                        '&.Mui-focused': {
                                            borderColor: '#007AFF',
                                            boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                                        }
                                    }
                                }}
                            >
                                {cleanCustomerId(customerId) != window._env_.SMC_CUSTOMER_ID && (
                                    <MenuItem value={ANALYSIS_TYPES.UTILIZATION}>Utilization</MenuItem>
                                )}
                                <MenuItem value={ANALYSIS_TYPES.PARTS}>Parts</MenuItem>
                                {cleanCustomerId(customerId) != CUSTOMER_IDS.GPLAST && (
                                    <MenuItem value={ANALYSIS_TYPES.LIVE_ALARM}>Alarm</MenuItem>
                                )}
                                <MenuItem value={ANALYSIS_TYPES.LIVE_REASON}>Downtime</MenuItem>
                                <MenuItem value={ANALYSIS_TYPES.OEE}>OEE</MenuItem>

                            </Select>
                        </FormControl>

                        {/* Downtime-specific filters: Period and Top N */}
                        {(analysisType === ANALYSIS_TYPES.LIVE_REASON && cleanCustomerId(customerId) === CUSTOMER_IDS.PMI) && (
                            <>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>Period</InputLabel>
                                    <Select
                                        value={downtimePeriod}
                                        label="Period"
                                        onChange={(e) => setDowntimePeriod(e.target.value)}
                                        sx={{ fontSize: '13px', height: 36 }}
                                    >
                                        <MenuItem value="day">Day</MenuItem>
                                        <MenuItem value="week">Week</MenuItem>
                                        <MenuItem value="month">Month</MenuItem>
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>Top Filter</InputLabel>
                                    <Select
                                        value={downtimeTopCount}
                                        label="Top Filter"
                                        onChange={(e) => setDowntimeTopCount(e.target.value)}
                                        sx={{ fontSize: '13px', height: 36 }}
                                    >
                                        <MenuItem value={1}>Top 1</MenuItem>
                                        <MenuItem value={2}>Top 2</MenuItem>
                                        <MenuItem value={3}>Top 3</MenuItem>
                                        <MenuItem value={4}>Top 4</MenuItem>
                                        <MenuItem value={4}>Top 5</MenuItem>
                                    </Select>
                                </FormControl>
                            </>
                        )}

                        {analysisType === ANALYSIS_TYPES.OEE && (
                            <FormControl size="small" sx={{ minWidth: 130 }}>
                                <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>OEE View</InputLabel>
                                <Select
                                    value={oeeViewType}
                                    label="OEE View"
                                    onChange={(e) => handleOeeViewTypeChange(e.target.value)}
                                    sx={{ fontSize: '13px', height: 36, }}
                                >
                                    <MenuItem value={OEE_VIEW_TYPES.FISCAL}>Fiscal</MenuItem>
                                    <MenuItem value={OEE_VIEW_TYPES.DAYS}>Day</MenuItem>
                                    <MenuItem value={OEE_VIEW_TYPES.MONTH}>Month</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        {analysisType === ANALYSIS_TYPES.UTILIZATION && (
                            <FormControl size="small" sx={{ minWidth: 150 }}>
                                <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>Utilization View</InputLabel>
                                <Select
                                    value={utilizationViewType}
                                    label="Utilization View"
                                    onChange={(e) => handleUtilizationViewTypeChange(e.target.value)}
                                    sx={{ fontSize: '13px', height: 36, }}
                                >
                                    <MenuItem value={UTILIZATION_VIEW_TYPES.FISCAL}>Fiscal</MenuItem>
                                    <MenuItem value={UTILIZATION_VIEW_TYPES.DAYS}>Day</MenuItem>
                                    <MenuItem value={UTILIZATION_VIEW_TYPES.MONTH}>Month</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        {/* Show Year dropdown when analysisType is Parts */}
                        {analysisType === "Parts" ? (
                            <FormControl size="small" sx={{ minWidth: 150 }}>
                                <InputLabel>Year</InputLabel>
                                <Select
                                    value={selectedYear}
                                    label="Year"
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    {Array.from(
                                        { length: maxYear - minYear + 1 },
                                        (_, i) => maxYear - i
                                    ).map((year) => (
                                        <MenuItem key={year} value={year}>
                                            {year}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : (
                            <>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <DatePicker
                                        label="From"
                                        value={fromDate}
                                        onChange={setFromDate}
                                        format="DD-MM-YYYY"
                                        slotProps={{
                                            textField: {
                                                size: "small",
                                                sx: { minWidth: 150 }
                                            },
                                        }}
                                    />
                                </LocalizationProvider>

                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <DatePicker
                                        label="To"
                                        value={toDate}
                                        minDate={fromDate}
                                        onChange={setToDate}
                                        format="DD-MM-YYYY"
                                        slotProps={{
                                            textField: {
                                                size: "small",
                                                sx: { minWidth: 150 }
                                            },
                                        }}
                                    />
                                </LocalizationProvider>

                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <InputLabel sx={{ fontSize: '14px', color: '#86868b' }}>
                                        Shifts
                                    </InputLabel>
                                    <Select
                                        value={selectedShift}
                                        onChange={(e) => setSelectedShift(e.target.value)}
                                        disabled={isShiftDisabled}
                                        label="Shifts"
                                    >
                                        <MenuItem value="all">All Shifts</MenuItem>
                                        {shifts.map((s) => (
                                            <MenuItem key={s.shift_no} value={s.shift_no}>
                                                Shift {s.shift_no}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </>
                        )}


                        <Tooltip title={isRunDisabled ? "Please select at least one machine" : ""}>
                            <span>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleGenerateReport}
                                    disabled={isRunDisabled}
                                    sx={{
                                        minWidth: 140,
                                        height: 36,
                                        borderRadius: '20px',
                                        backgroundColor: '#007AFF',
                                        textTransform: 'none',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        letterSpacing: '-0.01em',
                                        '&:hover': {
                                            backgroundColor: '#0056CC',
                                        },
                                        '&:disabled': {
                                            backgroundColor: '#E5E5EA',
                                            color: '#8E8E93',
                                        }
                                    }}
                                >
                                    {isLoading ? (
                                        <>
                                            <CircularProgress size={18} sx={{ mr: 1, color: 'white' }} />
                                            Analysing...
                                        </>
                                    ) : "Run Analysis"}
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Loading State */}
            {isLoading && (
                <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
                    <Stack alignItems="center" spacing={2}>
                        <CircularProgress size={48} sx={{ color: '#007AFF' }} />
                        <Typography variant="h6" color="#86868b" sx={{ fontWeight: 400 }}>
                            Loading data...
                        </Typography>
                    </Stack>
                </Box>
            )}

            {/* Content Area */}
            {!isLoading && (
                <Box flexGrow={1} display="flex" flexDirection="column">
                    {/* Grafana View (Default) */}
                    {viewType === "grafana" && getCurrentIframeUrl() && (
                        <Box
                            flexGrow={1}
                            position="relative"
                            px={3}
                            pt={2}
                            pb={2}
                        >
                            <Box
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(0, 0, 0, 0.08)',
                                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
                                    backgroundColor: '#ffffff',
                                }}
                            >
                                <iframe
                                    src={getCurrentIframeUrl()}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        border: "0",
                                    }}
                                    title="Analytics Dashboard"
                                />
                            </Box>
                        </Box>
                    )}

                    {/* Table View */}
                    {viewType === "table" && hasData && (
                        <Box px={3} pt={2} pb={3} flexGrow={1}>
                            <Paper
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0, 0, 0, 0.08)',
                                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
                                    overflow: 'hidden',
                                    height: '100%',
                                }}
                            >
                                {/* Table Header with minimalist design */}
                                <Box
                                    sx={{
                                        p: 3,
                                        backgroundColor: '#ffffff',
                                        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Stack spacing={0.5}>
                                        <Typography variant="h6" fontWeight={600} color="#1d1d1f">
                                            {getReportTitle}
                                            {analysisType === ANALYSIS_TYPES.OEE && (
                                                <Typography
                                                    component="span"
                                                    variant="body2"
                                                    color="#86868b"
                                                    sx={{
                                                        fontSize: '14px',
                                                        ml: 2,
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    ({oeeViewType === OEE_VIEW_TYPES.FISCAL ? 'Fiscal View' : oeeViewType === OEE_VIEW_TYPES.MONTH ? 'Month View' : 'Day View'})
                                                </Typography>
                                            )}
                                            {analysisType === ANALYSIS_TYPES.UTILIZATION && (
                                                <Typography
                                                    component="span"
                                                    variant="body2"
                                                    color="#86868b"
                                                    sx={{
                                                        fontSize: '14px',
                                                        ml: 2,
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    ({utilizationViewType === UTILIZATION_VIEW_TYPES.FISCAL ? 'Fiscal View' : utilizationViewType === UTILIZATION_VIEW_TYPES.MONTH ? 'Month View' : 'Day View'})
                                                </Typography>
                                            )}
                                        </Typography>
                                        <Typography variant="body2" color="#86868b" sx={{ fontSize: '13px' }}>
                                            {currentDataLength} records • Page {currentPage + 1} of {Math.ceil(currentDataLength / currentRowsPerPage)}
                                        </Typography>
                                    </Stack>

                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={exportToCSV}
                                        sx={{
                                            borderRadius: '20px',
                                            borderColor: 'rgba(0, 0, 0, 0.12)',
                                            color: '#1d1d1f',
                                            textTransform: 'none',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            letterSpacing: '-0.01em',
                                            height: 32,
                                            '&:hover': {
                                                borderColor: '#007AFF',
                                                backgroundColor: alpha('#007AFF', 0.04),
                                            }
                                        }}
                                    >
                                        Export CSV
                                    </Button>
                                </Box>

                                <TableContainer sx={{ flexGrow: 1 }}>
                                    <Table stickyHeader size="small">
                                        <TableHeader columns={currentColumns} />
                                        <TableBody>
                                            {paginatedData.map((row, index) => (
                                                <TableRowMemo
                                                    key={`${row.machine_name}_${row.date}_${row.shift_number || ''}_${index}_${analysisType}_${oeeViewType || utilizationViewType}`}
                                                    row={row}
                                                    columns={currentColumns}
                                                    index={index}
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                <TablePagination
                                    rowsPerPageOptions={[10, 25, 50, 100]}
                                    component="div"
                                    count={currentDataLength}
                                    rowsPerPage={currentRowsPerPage}
                                    page={currentPage}
                                    onPageChange={handleChangePage}
                                    onRowsPerPageChange={handleChangeRowsPerPage}
                                    labelRowsPerPage="Rows per page:"
                                    labelDisplayedRows={({ from, to, count }) =>
                                        `${from}-${to} of ${count}`
                                    }
                                    sx={{
                                        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                                        backgroundColor: '#ffffff',
                                        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                                            fontSize: '13px',
                                            color: '#86868b',
                                        },
                                        '& .MuiSelect-select': {
                                            fontSize: '13px',
                                        }
                                    }}
                                />
                            </Paper>
                        </Box>
                    )}

                    {/* Empty States - Apple-style */}
                    {viewType === "grafana" && !getCurrentIframeUrl() && !hasGeneratedData && (
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            flexGrow={1}
                            px={3}
                        >
                            <Paper sx={{
                                p: 6,
                                textAlign: 'center',
                                borderRadius: '12px',
                                border: '1px solid rgba(0, 0, 0, 0.08)',
                                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
                                maxWidth: 480,
                                backgroundColor: '#ffffff',
                            }}>
                                <GridViewIcon sx={{ fontSize: 64, color: '#C7C7CC', mb: 2, opacity: 0.5 }} />
                                <Typography variant="h6" color="#1d1d1f" gutterBottom sx={{ fontWeight: 600 }}>
                                    Analytics Dashboard
                                </Typography>
                                <Typography variant="body2" color="#86868b" paragraph sx={{ fontSize: '15px', lineHeight: 1.5 }}>
                                    Configure your filters and run analysis to view interactive dashboards.
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                    {viewType === "table" && !hasData && hasGeneratedData && (
                        <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            flexGrow={1}
                            px={3}
                        >
                            <Paper sx={{
                                p: 6,
                                textAlign: 'center',
                                borderRadius: '12px',
                                border: '1px solid rgba(0, 0, 0, 0.08)',
                                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
                                maxWidth: 480,
                                backgroundColor: '#ffffff',
                            }}>
                                <TableChartIcon sx={{ fontSize: 64, color: '#C7C7CC', mb: 2, opacity: 0.5 }} />
                                <Typography variant="h6" color="#1d1d1f" gutterBottom sx={{ fontWeight: 600 }}>
                                    Data Table
                                </Typography>
                                <Typography variant="body2" color="#86868b" paragraph sx={{ fontSize: '15px', lineHeight: 1.5 }}>
                                    No data available for the selected criteria.
                                </Typography>
                            </Paper>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}