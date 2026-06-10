import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Button,
    Checkbox,
    ListItemText,
    CircularProgress,
    Switch,
    Tooltip
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
    cleanCustomerId,
    customerbaseddevices,
    customerbasedshift
} from '../../Services/app/companyservice';
import { telemetrykeydata } from '../../Services/app/operatorservice';
import { useMachineGroups } from '../../Shared/hooks/useMachineGroups';
import { useNavigate } from 'react-router-dom';
import {
    timeToSeconds,
    getShiftTimes as getShiftTimesUtil,
    filterByShift,
    getLatestDataPoint as getLatestDataPointUtil,
    getBreakWindowsForShift,
    computeBreakDurations,
    makeShiftExclusionChecker,
    parseManualHolidayAttr,
    buildMergedHolidaySetFromAttr,
} from '../../Shared/utils/holidaycalculation';

export default function OnePageDashboard() {
    const customerId = localStorage.getItem('CustomerID');
    const token = localStorage.getItem('token1') || '';

    const [devices, setDevices] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('all');
    const [selectedShift, setSelectedShift] = useState(null);
    const [startDate, setStartDate] = useState(dayjs());
    const [endDate, setEndDate] = useState(dayjs());
    const [mainGrafanaUrl, setMainGrafanaUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBeforeFirstShift, setIsBeforeFirstShift] = useState(false);
    const isInitialLoad = useRef(true);

    const manualOverridesRef = useRef(parseManualHolidayAttr(null));
    const fetchManualOverrides = useCallback(async () => {
        if (!customerId) return manualOverridesRef.current;
        try {
            const res = await customerbasedshift(customerId, 'manual_holiday');
            manualOverridesRef.current = parseManualHolidayAttr(res[0]?.value);
        } catch {
            /* keep last known overrides on failure */
        }
        return manualOverridesRef.current;
    }, [customerId]);
    const {
        // devices,
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
    const navigate = useNavigate();

    useEffect(() => {
        const handler = (event) => {
            if (event.data?.type === "NAVIGATE") {
                const params = new URLSearchParams();
                const status = event.data.status;
                const machines = event.data.machines;
                if (status && status !== "All") params.set("status", status);
                if (Array.isArray(machines) && machines.length > 0) params.set("machines", machines.join(","));
                const query = params.toString();
                navigate(query ? `${event.data.path}?${query}` : event.data.path);
            }
        };

        window.addEventListener("message", handler);

        return () => window.removeEventListener("message", handler);
    }, [navigate]);

    const [dashboardData, setDashboardData] = useState({
        metrics: { oee: 0, availability: 0, performance: 0 },
        durations: {
            total_run_duration: 0,
            total_idle_duration: 0,
            total_alarm_duration: 0,
            total_disconnect_duration: 0,
            total_settings_duration: 0
        },
        machinePerformance: {
            bestMachines: [],
            worstMachines: [],
            allMachines: [],
            highestOee: 0,
            lowestOee: 0
        },
        parts: {
            targetParts: 0,
            totalParts: { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0, ts: 0 }
        },
        machinesWithZeroRunDuration: []
    });

    const getCurrentShift = useCallback((shifts) => {
        if (!Array.isArray(shifts) || shifts.length === 0) return "allshift";
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        for (const s of shifts) {
            const [fromH, fromM] = s.start_time.split(":").map(Number);
            const [toH, toM] = s.end_time.split(":").map(Number);
            const fromMinutes = fromH * 60 + fromM;
            const toMinutes = toH * 60 + toM;
            if (
                (fromMinutes <= currentMinutes && currentMinutes < toMinutes) ||
                (fromMinutes > toMinutes && (currentMinutes >= fromMinutes || currentMinutes < toMinutes))
            ) {
                return String(s.shift_no);
            }
        }
        return "allshift";
    }, []);

    const getShiftTimes = useCallback(
        (shiftList, shiftNo, date) => getShiftTimesUtil(shiftList, shiftNo, date),
        []
    );    // Memoized shift times calculation (delegates to shared holiday util)


    const getShiftTimeRanges = useCallback((shifts, shiftNo, date) => {
        if (shiftNo === "allshift") {
            return shifts.map(shift => ({
                shiftNo: String(shift.shift_no),
                ...getShiftTimes(shifts, String(shift.shift_no), date)
            }));
        }
        return [{
            shiftNo: String(shiftNo),
            ...getShiftTimes(shifts, String(shiftNo), date)
        }];
    }, [getShiftTimes]);

    const fetchShifts = useCallback(async () => {
        if (!customerId) return;

        try {
            const result = await customerbasedshift(customerId, 'allShift');
            const shiftList = result[0]?.value || [];
            setShifts(shiftList);
        } catch (err) {
            console.error('Failed to fetch shifts', err);
            setShifts([]);
        }
    }, [customerId]);

    const fetchDevices = useCallback(async () => {
        if (!customerId) return;

        try {
            const result = await customerbaseddevices(customerId, 100, 0);
            setDevices(result.data || []);
        } catch (err) {
            console.error("Failed to fetch devices", err);
            setDevices([]);
        }
    }, [customerId]);

    const fetchTelemetryData = useCallback(async (entityId, entityType, keys, from, to) => {
        try {
            return await telemetrykeydata(entityId, entityType, keys, from, to);
        } catch (error) {
            console.error(`Error fetching telemetry data for ${entityType}:${entityId}`, error);
            return null;
        }
    }, []);

    const getLatestDataPoint = useCallback((dataArray) => getLatestDataPointUtil(dataArray), []);

    const fetchAllDashboardData = useCallback(async () => {
        if (!shifts.length || selectedShift === null || !customerId || !startDate || !endDate) return;

        // Build all (day × shift) time ranges across the date range
        const allRanges = [];
        let currentDay = startDate.startOf('day');
        const lastDay = endDate.startOf('day');
        while (!currentDay.isAfter(lastDay)) {
            const dayRanges = getShiftTimeRanges(shifts, selectedShift, currentDay);
            allRanges.push(...dayRanges.filter(r => r.from && r.to));
            currentDay = currentDay.add(1, 'day');
        }
        if (allRanges.length === 0) return;

        // Build full-day ranges (all shifts) for holiday detection — always needed regardless of selectedShift
        const allRangesAllShiftsForFetch = [];
        {
            let d = startDate.startOf('day');
            const last = endDate.startOf('day');
            while (!d.isAfter(last)) {
                const dayRanges = getShiftTimeRanges(shifts, "allshift", d);
                allRangesAllShiftsForFetch.push(...dayRanges.filter(r => r.from && r.to));
                d = d.add(1, 'day');
            }
        }

        const overallFrom = allRangesAllShiftsForFetch.length > 0
            ? allRangesAllShiftsForFetch[0].from
            : allRanges[0].from;
        const overallTo = allRangesAllShiftsForFetch.length > 0
            ? allRangesAllShiftsForFetch[allRangesAllShiftsForFetch.length - 1].to
            : allRanges[allRanges.length - 1].to;

        const telemetryKeys = [
            "oee",
            "availability",
            "performance",
            "total_duration",
            "targetparts",
            "totalparts",
            "machine_status"
        ];

        const selectedDeviceIds = deviceNameID
            .filter((d) => selectedMachines.includes(d.name))
            .map((d) => d.id);

        // All machine IDs in the system — used for holiday detection
        const allDeviceIds = deviceNameID.map((d) => d.id);

        console.log(deviceNameID, "device name list");
        console.log(selectedMachines, "calling apis for");

        const machineDataMap = new Map();
        const allMachineDataMap = new Map();

        await Promise.all([
            ...selectedDeviceIds.map(async (deviceId) => {
                const data = await fetchTelemetryData(deviceId, "DEVICE", telemetryKeys, overallFrom, overallTo);
                machineDataMap.set(deviceId, data);
                allMachineDataMap.set(deviceId, data); // reuse, already fetched
            }),
            ...allDeviceIds
                .filter((id) => !selectedDeviceIds.includes(id))
                .map(async (deviceId) => {
                    const data = await fetchTelemetryData(deviceId, "DEVICE", ["total_duration"], overallFrom, overallTo);
                    allMachineDataMap.set(deviceId, data);
                })
        ]);

        const promises = [];

        promises.push(
            (async () => {
                const metrics = { oee: 0, availability: 0, performance: 0 };
                const allDeviceResults = [];

                for (const deviceId of selectedDeviceIds) {
                    const values = { oee: [], availability: [], performance: [] };
                    const rawData = machineDataMap.get(deviceId);

                    for (const shiftRange of allRanges) {
                        const data = filterByShift(rawData, shiftRange.from, shiftRange.to);
                        ["oee", "availability", "performance"].forEach((key) => {
                            const latest = getLatestDataPoint(data?.[key]);
                            if (latest) {
                                const val = parseFloat(latest.value);
                                if (!isNaN(val) && (key !== "oee" || val > 0)) {
                                    values[key].push(val);
                                }
                            }
                        });
                    }

                    const deviceMetrics = {};
                    Object.keys(values).forEach((key) => {
                        deviceMetrics[key] =
                            values[key].length > 0
                                ? Math.round(values[key].reduce((a, b) => a + b, 0) / values[key].length)
                                : 0;
                    });
                    allDeviceResults.push(deviceMetrics);
                }

                if (allDeviceResults.length > 0) {
                    const validDevices = allDeviceResults.filter((m) => m.oee > 0);
                    if (validDevices.length > 0) {
                        const sum = validDevices.reduce(
                            (acc, m) => ({
                                oee: acc.oee + m.oee,
                                availability: acc.availability + m.availability,
                                performance: acc.performance + m.performance
                            }),
                            { oee: 0, availability: 0, performance: 0 }
                        );
                        metrics.oee = Math.round(sum.oee / validDevices.length);
                        metrics.availability = Math.round(sum.availability / validDevices.length);
                        metrics.performance = Math.round(sum.performance / validDevices.length);
                    }
                }

                console.log("✅ Final averaged metrics:", metrics);
                return { metrics };
            })()
        );

        promises.push(
            (async () => {
                const totalDurations = {
                    total_run_duration: 0,
                    total_idle_duration: 0,
                    total_alarm_duration: 0,
                    total_disconnect_duration: 0,
                    total_settings_duration: 0
                };

                const machineTotalRunDuration = new Map();
                const machineShiftZeroRuntimes = new Map(); // Track machine-shift combos with zero runtime
                const machineAlarmIdleDurations = new Map(); // Track machine-date alarm/idle durations

                for (const deviceId of selectedDeviceIds) {
                    let totalRunForMachine = 0;
                    const rawData = machineDataMap.get(deviceId);
                    const shiftZeros = [];
                    const dateAlarmIdleMap = new Map(); // { date: { alarmSum, idleSum } }

                    for (const shiftRange of allRanges) {
                        const data = filterByShift(rawData, shiftRange.from, shiftRange.to);

                        // Get latest data point for this shift-date range
                        const latestDataPoint = getLatestDataPoint(data?.total_duration);
                        const shiftDate = new Date(shiftRange.from).toISOString().split('T')[0];

                        try {
                            const parsed = JSON.parse(latestDataPoint.value);
                            Object.keys(totalDurations).forEach((key) => {
                                totalDurations[key] += parsed[key] || 0;
                            });

                            const runDur = parsed.total_run_duration;
                            const alarmDur = parsed.total_alarm_duration || 0;
                            const idleDur = parsed.total_idle_duration || 0;
                            const disconnectDur = parsed.total_disconnect_duration || 0;

                            totalRunForMachine += runDur || 0;

                            // Track alarm, idle, and disconnect durations by date
                            if (!dateAlarmIdleMap.has(shiftDate)) {
                                dateAlarmIdleMap.set(shiftDate, { alarmSum: 0, idleSum: 0, disconnectSum: 0 });
                            }
                            const dateData = dateAlarmIdleMap.get(shiftDate);
                            dateData.alarmSum += alarmDur;
                            dateData.idleSum += idleDur;
                            dateData.disconnectSum += disconnectDur;


                        } catch (err) {
                            console.error(`Error parsing total_duration for ${deviceId}`, err);
                        }
                    }

                    machineTotalRunDuration.set(deviceId, totalRunForMachine);
                    machineShiftZeroRuntimes.set(deviceId, shiftZeros);
                    machineAlarmIdleDurations.set(deviceId, dateAlarmIdleMap);
                    console.log(`📊 Device: ${deviceId}, Total Run Duration: ${totalRunForMachine}`);
                }

                // Track per-date run duration for each machine
                const machineRunByDate = new Map();      // `${deviceId}-${date}` → secs
                const machineRunByShiftDate = new Map(); // `${deviceId}-${shiftNo}-${date}` → secs

                for (const deviceId of selectedDeviceIds) {
                    const rawData = machineDataMap.get(deviceId);
                    for (const shiftRange of allRanges) {
                        const data = filterByShift(rawData, shiftRange.from, shiftRange.to);
                        const latestDataPoint = getLatestDataPoint(data?.total_duration);
                        const shiftDate = new Date(shiftRange.from).toISOString().split('T')[0];

                        if (latestDataPoint?.value) {
                            try {
                                const parsed = JSON.parse(latestDataPoint.value);
                                const runDur = parsed.total_run_duration || 0;
                                const dayKey = `${deviceId}-${shiftDate}`;
                                const shiftKey = `${deviceId}-${shiftRange.shiftNo}-${shiftDate}`;
                                machineRunByDate.set(dayKey, (machineRunByDate.get(dayKey) || 0) + runDur);
                                machineRunByShiftDate.set(shiftKey, (machineRunByShiftDate.get(shiftKey) || 0) + runDur);
                            } catch (err) { /* ignore */ }
                        }
                    }
                }

                const TWENTY_HOURS_SECONDS = 20 * 3600; // 72000 seconds
                const machinesWithZeroRunDuration = [];
                const dateRunExceeded = new Map(); // Track machines excluded for specific dates

                // Use the pre-built full-day ranges (all shifts) for holiday detection
                const allRangesAllShifts = allRangesAllShiftsForFetch;

                // Step 1: Collect all unique dates from full-day ranges
                const allDatesInRange = new Set();
                for (const shiftRange of allRangesAllShifts) {
                    const shiftDate = new Date(shiftRange.from).toISOString().split('T')[0];
                    allDatesInRange.add(shiftDate);
                }

                // Build full-day run/alarm/idle maps using ALL machines + ALL shifts for holiday detection
                const fullDayRunByDate = new Map(); // { deviceId-date: runDuration }
                const fullDayAlarmIdleByDevice = new Map(); // { deviceId: Map<date, {alarmSum,idleSum,disconnectSum}> }

                for (const deviceId of allDeviceIds) {
                    const rawData = allMachineDataMap.get(deviceId);
                    const dateAlarmIdleMap = new Map();

                    for (const shiftRange of allRangesAllShifts) {
                        const data = filterByShift(rawData, shiftRange.from, shiftRange.to);
                        const latestDataPoint = getLatestDataPoint(data?.total_duration);
                        const shiftDate = new Date(shiftRange.from).toISOString().split('T')[0];

                        if (latestDataPoint?.value) {
                            try {
                                const parsed = JSON.parse(latestDataPoint.value);
                                const runDur = parsed.total_run_duration || 0;
                                const alarmDur = parsed.total_alarm_duration || 0;
                                const idleDur = parsed.total_idle_duration || 0;
                                const disconnectDur = parsed.total_disconnect_duration || 0;

                                const runKey = `${deviceId}-${shiftDate}`;
                                fullDayRunByDate.set(runKey, (fullDayRunByDate.get(runKey) || 0) + runDur);

                                if (!dateAlarmIdleMap.has(shiftDate)) {
                                    dateAlarmIdleMap.set(shiftDate, { alarmSum: 0, idleSum: 0, disconnectSum: 0 });
                                }
                                const dd = dateAlarmIdleMap.get(shiftDate);
                                dd.alarmSum += alarmDur;
                                dd.idleSum += idleDur;
                                dd.disconnectSum += disconnectDur;
                            } catch (err) { /* ignore parse errors */ }
                        }
                    }
                    fullDayAlarmIdleByDevice.set(deviceId, dateAlarmIdleMap);
                }

                // Step 1: Calculate TOTAL run duration per date across ALL machines (full day)
                const totalRunDurationByDate = new Map();
                for (const date of allDatesInRange) {
                    let totalRun = 0;
                    for (const deviceId of allDeviceIds) {
                        const runKey = `${deviceId}-${date}`;
                        totalRun += fullDayRunByDate.get(runKey) || 0;
                    }
                    // Always record the date (even if 0) so zero-data days are included in condition check
                    totalRunDurationByDate.set(date, totalRun);
                }

                // Step 1b: Calculate TOTAL expected shift time per date using ALL shifts × ALL machines.
                // For today: only count shifts from the first shift start up to the current shift end
                // (skip future shifts that haven't started yet) so a partially-elapsed day isn't
                const todayDateStr = new Date().toISOString().split('T')[0];
                const nowMs = Date.now();

                const expectedShiftTimeByDate = new Map();
                for (const shiftRange of allRangesAllShifts) {
                    const shiftDate = new Date(shiftRange.from).toISOString().split('T')[0];

                    // For today: skip any shift whose start time is still in the future
                    if (shiftDate === todayDateStr && shiftRange.from > nowMs) continue;

                    const rawShiftDurationSecs = Math.floor((shiftRange.to - shiftRange.from) / 1000);

                    const shiftNo = shiftRange.shiftNo;
                    const shiftData = shifts.find(s => String(s.shift_no) === String(shiftNo));
                    const breakTimeSecs = shiftData ? Math.floor(timeToSeconds(shiftData.break_time || "00:00:00")) : 0;
                    const shiftDurationWithoutBreak = Math.max(0, rawShiftDurationSecs - breakTimeSecs);

                    if (!expectedShiftTimeByDate.has(shiftDate)) {
                        expectedShiftTimeByDate.set(shiftDate, 0);
                    }
                    expectedShiftTimeByDate.set(
                        shiftDate,
                        expectedShiftTimeByDate.get(shiftDate) + (shiftDurationWithoutBreak * allDeviceIds.length)
                    );
                }

                const totalAlarmByDate = new Map();
                const totalIdleByDate = new Map();
                const totalDisconnectByDate = new Map();

                for (const deviceId of allDeviceIds) {
                    const dateAlarmIdle = fullDayAlarmIdleByDevice.get(deviceId);
                    if (!dateAlarmIdle) continue;

                    for (const [date, { alarmSum, idleSum, disconnectSum }] of dateAlarmIdle) {
                        if (!totalAlarmByDate.has(date)) totalAlarmByDate.set(date, 0);
                        totalAlarmByDate.set(date, totalAlarmByDate.get(date) + alarmSum);

                        if (!totalIdleByDate.has(date)) totalIdleByDate.set(date, 0);
                        totalIdleByDate.set(date, totalIdleByDate.get(date) + idleSum);

                        if (!totalDisconnectByDate.has(date)) totalDisconnectByDate.set(date, 0);
                        totalDisconnectByDate.set(date, totalDisconnectByDate.get(date) + disconnectSum);
                    }
                }

                // Step 3: Check condition for each date
                // Condition: run % <= 20% AND (alarm + idle + disconnect) > 20h
                // Always check every date in the selected range — including days where
                // all telemetry values are 0 or null (no data = no production = exclude).
                const datesToCheck = new Set(allDatesInRange);

                const conditionCheckResults = [];
                const datesExcluded = [];
                const sortedDates = Array.from(datesToCheck).sort();

                for (const date of sortedDates) {
                    const totalRunForDate = totalRunDurationByDate.get(date) || 0;
                    const expectedTimeForDate = expectedShiftTimeByDate.get(date) || 1;
                    const totalAlarm = totalAlarmByDate.get(date) || 0;
                    const totalIdle = totalIdleByDate.get(date) || 0;
                    const totalDisconnect = totalDisconnectByDate.get(date) || 0;

                    const runPercentage = (totalRunForDate / expectedTimeForDate) * 100;

                    const runConditionMet = runPercentage <= 20;
                    const summedAlarmIdleDisconnect = totalAlarm + totalIdle + totalDisconnect;
                    const alarmConditionMet = summedAlarmIdleDisconnect > TWENTY_HOURS_SECONDS;

                    const bothAreZero = totalRunForDate === 0 && summedAlarmIdleDisconnect === 0;
                    const conditionMet = (runConditionMet && alarmConditionMet) || bothAreZero;

                    conditionCheckResults.push({
                        Date: date,
                        'Run %': runPercentage.toFixed(2),
                        'Run Hrs': (totalRunForDate / 3600).toFixed(2),
                        'Alarm Hrs': (totalAlarm / 3600).toFixed(2),
                        'Idle Hrs': (totalIdle / 3600).toFixed(2),
                        'Disc Hrs': (totalDisconnect / 3600).toFixed(2),
                        'Sum Hrs': (summedAlarmIdleDisconnect / 3600).toFixed(2),
                        'Result': conditionMet ? '🔴 EXCLUDED' : '✅ INCLUDED'
                    });

                    if (conditionMet) {
                        datesExcluded.push(date);
                        for (const deviceId of selectedDeviceIds) {
                            if (!dateRunExceeded.has(deviceId)) {
                                dateRunExceeded.set(deviceId, []);
                            }
                            if (!dateRunExceeded.get(deviceId).includes(date)) {
                                dateRunExceeded.get(deviceId).push(date);
                            }
                        }
                    }
                }

                const fullyExcludedMachines = [];
                machinesWithZeroRunDuration.push(...fullyExcludedMachines);

                // Merge manually-marked holidays from HolidayList (stored server-side
                // in the `manual_holiday` customer attribute).
                const manualOverrides = manualOverridesRef.current;
                const manualHolidaySet = buildMergedHolidaySetFromAttr(manualOverrides, customerId, selectedShift);
                for (const d of manualHolidaySet) {
                    if (!datesExcluded.includes(d)) datesExcluded.push(d);
                }

                const perShiftHolMap = manualOverrides.perShiftHol;
                const perShiftProdMap = manualOverrides.perShiftProd;

                const excludedDatesSet = new Set(datesExcluded);

                const wholeDayProductionSet = manualOverrides.manualProductionDays;

                const isShiftDateExcluded = makeShiftExclusionChecker({
                    perShiftHol: perShiftHolMap,
                    perShiftProd: perShiftProdMap,
                    wholeDayProd: wholeDayProductionSet,
                    wholeDayHol: excludedDatesSet,
                });

                let runDurationForExcludedDates = 0;
                for (const date of datesExcluded) {
                    // Whole-day manual production override: keep its run duration
                    // (do not subtract), so it stays counted in new_total_run_duration.
                    if (wholeDayProductionSet.has(date)) continue;
                    for (const deviceId of selectedDeviceIds) {
                        // Subtract whole-day run, but add back any shifts with production override
                        const dayRun = machineRunByDate.get(`${deviceId}-${date}`) || 0;
                        let addBack = 0;
                        for (const s of shifts) {
                            const sNo = String(s.shift_no);
                            if (perShiftProdMap.get(sNo)?.has(date)) {
                                addBack += machineRunByShiftDate.get(`${deviceId}-${sNo}-${date}`) || 0;
                            }
                        }
                        runDurationForExcludedDates += Math.max(0, dayRun - addBack);
                    }
                }
                // Also subtract run for shifts individually marked as holiday (not already in datesExcluded)
                for (const s of shifts) {
                    const sNo = String(s.shift_no);
                    for (const date of (perShiftHolMap.get(sNo) || [])) {
                        if (excludedDatesSet.has(date)) continue; // already counted above
                        if (perShiftProdMap.get(sNo)?.has(date)) continue;
                        for (const deviceId of selectedDeviceIds) {
                            runDurationForExcludedDates += machineRunByShiftDate.get(`${deviceId}-${sNo}-${date}`) || 0;
                        }
                    }
                }
                const new_total_run_duration = Math.max(0, totalDurations.total_run_duration - runDurationForExcludedDates);

                // Compute new_total_idle/alarm/disconnect by subtracting holiday dates' values
                // Production-day overrides (whole-day or per-shift) must NOT be subtracted.
                let holidayIdleSum = 0, holidayAlarmSum = 0, holidayDisconnectSum = 0;
                for (const date of datesExcluded) {

                    // Skip whole-day production override
                    if (wholeDayProductionSet.has(date)) continue;

                    // Skip per-shift production override when a single shift is selected
                    if (selectedShift && selectedShift !== 'allshift' &&
                        perShiftProdMap.get(String(selectedShift))?.has(date)) continue;

                    for (const deviceId of selectedDeviceIds) {
                        const dateAlarmIdleMap = machineAlarmIdleDurations.get(deviceId);
                        if (!dateAlarmIdleMap) continue;
                        const dd = dateAlarmIdleMap.get(date);
                        if (!dd) continue;
                        holidayIdleSum += dd.idleSum;
                        holidayAlarmSum += dd.alarmSum;
                        holidayDisconnectSum += dd.disconnectSum;
                    }
                }
                // Also subtract per-shift holiday dates (not already in datesExcluded) for single-shift selection
                if (selectedShift && selectedShift !== 'allshift') {
                    const sNo = String(selectedShift);
                    for (const date of (perShiftHolMap.get(sNo) || [])) {
                        if (excludedDatesSet.has(date)) continue; // already counted above
                        if (perShiftProdMap.get(sNo)?.has(date)) continue;
                        if (wholeDayProductionSet.has(date)) continue;
                        for (const deviceId of selectedDeviceIds) {
                            const dateAlarmIdleMap = machineAlarmIdleDurations.get(deviceId);
                            if (!dateAlarmIdleMap) continue;
                            const dd = dateAlarmIdleMap.get(date);
                            if (!dd) continue;
                            holidayIdleSum += dd.idleSum;
                            holidayAlarmSum += dd.alarmSum;
                            holidayDisconnectSum += dd.disconnectSum;
                        }
                    }
                }
                const new_total_idle_duration = Math.max(0, totalDurations.total_idle_duration - holidayIdleSum);
                const new_total_alarm_duration = Math.max(0, totalDurations.total_alarm_duration - holidayAlarmSum);
                const new_total_disconnect_duration = Math.max(0, totalDurations.total_disconnect_duration - holidayDisconnectSum);

                // Compute new_targetparts and new_totalparts with per-shift awareness
                let new_targetparts = 0;
                const new_totalparts_acc = { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0 };

                for (const deviceId of selectedDeviceIds) {
                    const rawData = machineDataMap.get(deviceId);
                    for (const shiftRange of allRanges) {
                        const shiftDate = new Date(shiftRange.from).toISOString().split('T')[0];
                        if (isShiftDateExcluded(shiftRange.shiftNo, shiftDate)) continue;

                        const data = filterByShift(rawData, shiftRange.from, shiftRange.to);

                        const latestTarget = getLatestDataPoint(data?.targetparts);
                        if (latestTarget) {
                            const val = parseFloat(latestTarget.value);
                            if (!isNaN(val)) new_targetparts += val;
                        }

                        const latestTotal = getLatestDataPoint(data?.totalparts);
                        if (latestTotal?.value) {
                            try {
                                const parsed = JSON.parse(latestTotal.value);
                                Object.keys(new_totalparts_acc).forEach((key) => {
                                    new_totalparts_acc[key] += parsed[key] || 0;
                                });
                            } catch (err) {
                                console.error(`Error parsing totalparts for new_totalparts ${deviceId}`, err);
                            }
                        }
                    }
                }

                const new_totalparts = { ...new_totalparts_acc, ts: new Date().toISOString() };
                console.log('✅ new_targetparts:', Math.round(new_targetparts), '| new_totalparts:', new_totalparts);

                /* --------------------------------------------------------- */
                /* Break-time durations: the run/idle/alarm/disconnect that   */
                /* occurred inside each shift's break windows, summed across   */
                /* every selected machine, shift and date.                     */
                /* --------------------------------------------------------- */
                const breakDurations = { break_run: 0, break_idle: 0, break_alarm: 0, break_disconnect: 0 };
                for (const deviceId of selectedDeviceIds) {
                    const rawData = machineDataMap.get(deviceId);
                    for (const shiftRange of allRanges) {
                        // Skip holiday-excluded shift-dates (same priority rule as parts/new_total_*)
                        const shiftDate = new Date(shiftRange.from).toISOString().split('T')[0];
                        if (isShiftDateExcluded(shiftRange.shiftNo, shiftDate)) continue;

                        const shiftData = shifts.find((s) => String(s.shift_no) === String(shiftRange.shiftNo));
                        if (!shiftData) continue;
                        const breakWindows = getBreakWindowsForShift(shiftData, shiftRange.from, shiftRange.to);
                        if (!breakWindows.length) continue;
                        const dvBreaks = computeBreakDurations(rawData, shiftRange.from, breakWindows);
                        breakDurations.break_run += dvBreaks.break_run;
                        breakDurations.break_idle += dvBreaks.break_idle;
                        breakDurations.break_alarm += dvBreaks.break_alarm;
                        breakDurations.break_disconnect += dvBreaks.break_disconnect;
                    }
                }
                // Round to whole seconds (values accumulate from ms → seconds conversion)
                breakDurations.break_run = Math.round(breakDurations.break_run);
                breakDurations.break_idle = Math.round(breakDurations.break_idle);
                breakDurations.break_alarm = Math.round(breakDurations.break_alarm);
                breakDurations.break_disconnect = Math.round(breakDurations.break_disconnect);
                console.log('✅ Break-time durations:', breakDurations);

                return {
                    durations: { ...totalDurations, new_total_run_duration, new_total_idle_duration, new_total_alarm_duration, new_total_disconnect_duration, ...breakDurations },
                    machinesWithZeroRunDuration,
                    machineShiftZeroRuntimes,
                    machineAlarmIdleDurations,
                    dateRunExceeded,
                    machineRunByDate,
                    new_targetparts: Math.round(new_targetparts),
                    new_totalparts
                };
            })()
        );

        promises.push(
            (async () => {
                const selectedMachinesObj = getDeviceObjectsForMachines(selectedMachines);
                const machinePromises = selectedMachinesObj.map(async (machine) => {
                    const oeeValues = [];
                    const rawData = machineDataMap.get(machine.id.id);

                    for (const shiftRange of allRanges) {
                        const data = filterByShift(rawData, shiftRange.from, shiftRange.to);
                        const latest = getLatestDataPoint(data?.oee);
                        if (latest) {
                            const val = parseFloat(latest.value);
                            if (!isNaN(val) && val > 0) oeeValues.push(val);
                        }
                    }

                    const machineOee =
                        oeeValues.length > 0
                            ? Math.round(oeeValues.reduce((a, b) => a + b, 0) / oeeValues.length)
                            : 0;

                    return { machineId: machine.id.id, machineName: machine.name, oee: machineOee };
                });

                const allMachineData = await Promise.all(machinePromises);
                const validMachines = allMachineData.filter((m) => m.oee > 0);
                const sorted = [...validMachines].sort((a, b) => b.oee - a.oee);

                let bestMachines, worstMachines;

                if (validMachines.length === 1) {
                    bestMachines = sorted;
                    const machineWithoutData = allMachineData.find((m) => m.oee === 0);
                    worstMachines = machineWithoutData ? [{ ...machineWithoutData, oee: 0 }] : [{ ...sorted[0], oee: 0 }];
                } else {
                    bestMachines = sorted.filter((m) => m.oee === sorted[0]?.oee);
                    worstMachines = sorted.filter((m) => m.oee === sorted.at(-1)?.oee);
                }

                return {
                    machinePerformance: {
                        allMachines: sorted,
                        bestMachines,
                        worstMachines,
                        highestOee: sorted[0]?.oee || 0,
                        lowestOee: sorted.at(-1)?.oee || 0
                    }
                };
            })()
        );

        promises.push(
            (async () => {
                const result = {
                    targetParts: 0,
                    totalParts: { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0, ts: new Date().toISOString() }
                };

                let totalTarget = 0;
                const totalPartsAccumulator = { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0 };

                for (const deviceId of selectedDeviceIds) {
                    let deviceTarget = 0;
                    const deviceParts = { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0 };
                    const rawData = machineDataMap.get(deviceId);

                    for (const shiftRange of allRanges) {
                        const data = filterByShift(rawData, shiftRange.from, shiftRange.to);

                        const latestTarget = getLatestDataPoint(data?.targetparts);
                        if (latestTarget) {
                            const val = parseFloat(latestTarget.value);
                            if (!isNaN(val)) deviceTarget += val;
                        }

                        const latestTotal = getLatestDataPoint(data?.totalparts);
                        if (latestTotal?.value) {
                            try {
                                const parsed = JSON.parse(latestTotal.value);
                                Object.keys(deviceParts).forEach((key) => {
                                    deviceParts[key] += parsed[key] || 0;
                                });
                            } catch (err) {
                                console.error(`Error parsing totalparts for ${deviceId}`, err);
                            }
                        }
                    }

                    totalTarget += deviceTarget;
                    Object.keys(totalPartsAccumulator).forEach(
                        (key) => (totalPartsAccumulator[key] += deviceParts[key])
                    );
                }

                result.targetParts = Math.round(totalTarget);
                result.totalParts = { ...totalPartsAccumulator, ts: new Date().toISOString() };

                return { parts: result };
            })()
        );

        promises.push(
            (async () => {
                const statusSummary = {
                    run: 0,
                    idle: 0,
                    alarm: 0,
                    disconnect: 0,
                    total: selectedDeviceIds.length
                };

                for (const deviceId of selectedDeviceIds) {
                    const data = machineDataMap.get(deviceId);
                    const statusData = data?.machine_status;

                    if (Array.isArray(statusData) && statusData.length > 0) {
                        const first = parseInt(statusData[0]?.value);
                        if (!isNaN(first)) {
                            if ([0, 1, 2].includes(first)) statusSummary.idle += 1;
                            else if ([4, 5].includes(first)) statusSummary.alarm += 1;
                            else if (first === 100) statusSummary.disconnect += 1;
                            else if (first === 3) statusSummary.run += 1;
                        }
                    }
                }

                console.log("✅ Machine Status Summary:", statusSummary);
                return { machineStatus: statusSummary };
            })()
        );


        try {
            const results = await Promise.all(promises);
            const combined = results.reduce((acc, r) => ({ ...acc, ...r }), {});

            setDashboardData((prev) => ({ ...prev, ...combined }));
            return combined;
        } catch (err) {
            console.error("Error fetching dashboard data", err);
            return null;
        }
    }, [
        shifts,
        selectedShift,
        startDate,
        endDate,
        customerId,
        selectedDevice,
        devices,
        fetchTelemetryData,
        getShiftTimes,
        getShiftTimeRanges,
        selectedMachines
    ]);


    const generateGrafanaUrls = useCallback((data) => {
        if (!customerId || !selectedShift) return { mainUrl: '' };
        const machineParam = selectedMachines.join(",");
        const cleanedId = cleanCustomerId(customerId);

        const manualOverrides = manualOverridesRef.current;
        const manualHolidaySet = buildMergedHolidaySetFromAttr(manualOverrides, customerId, selectedShift);
        const manualProductionSet = manualOverrides.manualProductionDays;

        // Per-shift manual overrides for duration calculation
        const gPerShiftHol = manualOverrides.perShiftHol;
        const gPerShiftProd = manualOverrides.perShiftProd;

        // Priority: per-shift production > whole-day production > per-shift holiday > whole-day holiday
        const isShiftExcludedForDuration = makeShiftExclusionChecker({
            perShiftHol: gPerShiftHol,
            perShiftProd: gPerShiftProd,
            wholeDayProd: manualProductionSet,
            wholeDayHol: manualHolidaySet,
        });

        const bearerToken = encodeURIComponent(`Bearer+${token}`);
        const entityType = 'CUSTOMER';
        const isAllMachinesSelected = selectedDevice === 'all';
        const entityId = cleanedId;

        const shiftArray = selectedShift === "allshift"
            ? shifts.map(s => String(s.shift_no))
            : [String(selectedShift)];

        const shiftVar = `[${shiftArray.join(',')}]`;

        const oeeVar = data.metrics.oee || 0;
        const availabilityVar = data.metrics.availability || 0;
        const performanceVar = data.metrics.performance || 0;

        const from = startDate.startOf('day').valueOf();
        const to = endDate.endOf('day').valueOf();

        let adjustedDuration = 0;
        let newadjustedDuration = 0;
        // (recompile-touch)
        // True when the selected range contains ONLY holiday/excluded dates (no production
        // left after exclusions). Set inside the duration branches below, alongside the
        // existing newadjustedDuration fallback. Drives whether we send full vs reduced data.
        let isOnlyHolidayRange = false;

        const machineCountWithRunDuration = selectedMachines.length - data.machinesWithZeroRunDuration.length;

        // Create a set of machine-shift combos with zero runtime for quick lookup
        const zeroRuntimeSet = new Set();
        const selectedDeviceIds = deviceNameID
            .filter((d) => selectedMachines.includes(d.name))
            .map((d) => d.id);

        if (data.machineShiftZeroRuntimes) {
            for (const [deviceId, shifts] of data.machineShiftZeroRuntimes.entries()) {
                for (const { date, shift } of shifts) {
                    zeroRuntimeSet.add(`${deviceId}-${date}-${shift}`);
                }
            }
        }

        // Helper to check if a specific date should be excluded for a machine

        const isDateExceededFor20Hours = (deviceId, dateStr) => {
            // Production-day override always wins — never exclude a manually-set production day
            if (manualProductionSet.has(dateStr)) return false;
            if (data.dateRunExceeded && data.dateRunExceeded.has(deviceId)) {
                const excludedDates = data.dateRunExceeded.get(deviceId);
                return excludedDates.includes(dateStr);
            }
            return false;
        };

        // Helper: check if machine has zero run duration for a specific date
        const hasZeroRunForDate = (deviceId, dateStr) => {
            const key = `${deviceId}-${dateStr}`;
            const runDuration = data.machineRunByDate ? data.machineRunByDate.get(key) : undefined;
            return runDuration === 0;
        };

        if (cleanCustomerId(customerId) === window._env_.CUSTOMER_ID || cleanCustomerId(customerId) === window._env_.SMC_CUSTOMER_ID) {
            // Calculate duration1 and duration2 with breaktime removed across date range
            let duration1Adjusted = 0;
            let duration2Adjusted = 0;
            let duration2RemovedDueToCap = 0;
            let currentDay = startDate.startOf('day');
            const lastDay = endDate.startOf('day');

            const shiftsToProcess = selectedShift === "allshift"
                ? shifts.map(s => String(s.shift_no))
                : [String(selectedShift)];

            const dateWiseBreakdown = new Map(); // { date: { totalHours, removedHours, actualHours, excludedMachines } }

            while (!currentDay.isAfter(lastDay)) {
                const currentDateStr = currentDay.format('YYYY-MM-DD');

                const isManualHoliday = manualHolidaySet.has(currentDateStr);
                const isManualProduction = manualProductionSet.has(currentDateStr);

                if (!dateWiseBreakdown.has(currentDateStr)) {
                    dateWiseBreakdown.set(currentDateStr, {
                        totalHours: 0,
                        removedHours: 0,
                        actualHours: 0,
                        excludedMachines: []
                    });
                }
                const dateData = dateWiseBreakdown.get(currentDateStr);

                // Check if this date exceeds 20 hours for any selected machine
                const isDateExceededForAnyMachine = selectedDeviceIds.some(
                    deviceId => isDateExceededFor20Hours(deviceId, currentDateStr)
                );

                for (const shiftNo of shiftsToProcess) {
                    const shiftData = shifts.find(s => String(s.shift_no) === shiftNo);
                    if (!shiftData) continue;

                    const shiftTimes = getShiftTimes(shifts, shiftNo, currentDay);
                    const rawSecs = shiftTimes.from && shiftTimes.to
                        ? Math.floor((shiftTimes.to - shiftTimes.from) / 1000)
                        : 0;
                    const shiftSecsMinusBreak = Math.max(0, rawSecs - timeToSeconds(shiftData.break_time || "00:00:00"));

                    // Per-shift aware holiday exclusion from newadjustedDuration
                    if (isShiftExcludedForDuration(shiftNo, currentDateStr)) {
                        duration1Adjusted += shiftSecsMinusBreak * selectedDeviceIds.length;
                        continue;
                    }

                    // Count machines with non-zero runtime (excluding machines with zero run duration globally)
                    let machinesWithRuntimeCount = 0;
                    let machinesRemovedCount = 0;
                    let machineNamesIncluded = [];
                    let machineNamesRemoved = [];

                    for (const deviceId of selectedDeviceIds) {
                        const key = `${deviceId}-${currentDateStr}-${shiftNo}`;
                        const deviceName = deviceNameID.find(d => d.id === deviceId)?.name || deviceId;

                        // Production-override: always count all machines regardless of telemetry
                        if (isManualProduction || gPerShiftProd.get(shiftNo)?.has(currentDateStr)) {
                            machinesWithRuntimeCount++;
                            machineNamesIncluded.push(deviceName);
                            continue;
                        }

                        // Check if this machine is excluded for this date (regardless of runtime for this specific shift)
                        const isExcludedForDate = isDateExceededFor20Hours(deviceId, currentDateStr);

                        if (!zeroRuntimeSet.has(key)) {
                            // Machine has non-zero runtime for this shift
                            if (!isExcludedForDate) {
                                machinesWithRuntimeCount++;
                                machineNamesIncluded.push(deviceName);
                            } else {
                                // Machine has runtime but is excluded for this date - REMOVE IT
                                machinesRemovedCount++;
                                machineNamesRemoved.push(deviceName);
                            }
                        } else if (isExcludedForDate) {
                            // Machine has zero runtime for this shift BUT is excluded for this date - REMOVE IT
                            machinesRemovedCount++;
                            machineNamesRemoved.push(deviceName);
                        }
                    }

                    // Per-shift or whole-day production override → no machines excluded for this shift
                    const machinesExcludedForThisDate = (isManualProduction || gPerShiftProd.get(shiftNo)?.has(currentDateStr))
                        ? 0
                        : selectedDeviceIds.filter(id => isDateExceededFor20Hours(id, currentDateStr)).length;
                    const shiftRemovedDueToThreshold = shiftSecsMinusBreak * machinesExcludedForThisDate;
                    const shiftDuration2Actual = shiftSecsMinusBreak * machinesWithRuntimeCount;
                    const shiftRemoved = shiftRemovedDueToThreshold;

                    // duration1: include all selected machines
                    const shiftDuration1 = shiftSecsMinusBreak * selectedDeviceIds.length;
                    duration1Adjusted += shiftDuration1;
                    dateData.totalHours += shiftDuration1;

                    // duration2: only include machines with non-zero runtime and not excluded by date threshold
                    duration2Adjusted += shiftDuration2Actual;
                    dateData.actualHours += shiftDuration2Actual;
                    duration2RemovedDueToCap += shiftRemoved;
                    dateData.removedHours += shiftRemoved;

                    if (machinesRemovedCount > 0) {
                        dateData.excludedMachines.push({
                            shift: shiftNo,
                            removedMachines: machineNamesRemoved,
                            includedMachines: machineNamesIncluded,
                            shiftHoursRemoved: (shiftRemoved / 3600).toFixed(2)
                        });
                    }
                }

                currentDay = currentDay.add(1, 'day');
            }

            adjustedDuration = duration1Adjusted;
            newadjustedDuration = duration2Adjusted;

            // Show excluded dates and their impact
            const excludedDatesList = [];
            dateWiseBreakdown.forEach((data, date) => {
                if (data.removedHours > 0) {
                    const removedHrs = parseFloat((data.removedHours / 3600).toFixed(2));
                    excludedDatesList.push({
                        'Excluded Date': date,
                        'Hours Removed': removedHrs.toFixed(2),
                        'From newadjustedDuration': removedHrs.toFixed(2) + ' hrs'
                    });
                }
            });
            if (excludedDatesList.length > 0) {
                const totalRemovedFromDuration = excludedDatesList.reduce((sum, item) => sum + parseFloat(item['Hours Removed']), 0);
            } else {
                console.log("No dates excluded - all target hours are included");
            }

            // Create table data
            const tableData = [];
            // Accumulate raw seconds to avoid rounding drift from .toFixed(2) per date
            let grandTotalSeconds1 = 0, grandRemovedSeconds1 = 0, grandActualSeconds1 = 0;

            // Get machines excluded for this date
            const getMachinesExcludedForDate = (dateStr) => {
                const excluded = [];
                for (const deviceId of selectedDeviceIds) {
                    if (isDateExceededFor20Hours(deviceId, dateStr)) {
                        excluded.push(deviceId);
                    }
                }
                return excluded;
            };

            dateWiseBreakdown.forEach((data, date) => {
                const totalHrs = parseFloat((data.totalHours / 3600).toFixed(2));
                const totalRemoved = parseFloat((data.removedHours / 3600).toFixed(2));
                const actualHrs = parseFloat((totalHrs - totalRemoved).toFixed(2));

                tableData.push({
                    Date: date,
                    'Total Hours': totalHrs.toFixed(2),
                    'Removed Hours': totalRemoved.toFixed(2),
                    'Actual Hours': actualHrs.toFixed(2),
                    'Formula': `${totalHrs.toFixed(2)} - ${totalRemoved.toFixed(2)} = ${actualHrs.toFixed(2)}`
                });

                grandTotalSeconds1 += data.totalHours;
                grandRemovedSeconds1 += data.removedHours;
                grandActualSeconds1 += (data.totalHours - data.removedHours);
            });

            const grandTotalHours = grandTotalSeconds1 / 3600;
            const grandRemovedHours = grandRemovedSeconds1 / 3600;
            const grandActualHours = grandActualSeconds1 / 3600;

            // Add total row to table
            tableData.push({
                Date: '🔵 TOTAL',
                'Total Hours': grandTotalHours.toFixed(2),
                'Removed Hours': grandRemovedHours.toFixed(2),
                'Actual Hours': grandActualHours.toFixed(2),
                'Formula': `${grandTotalHours.toFixed(2)} - ${grandRemovedHours.toFixed(2)} = ${grandActualHours.toFixed(2)}`
            });

            console.table(tableData);

            // Date-wise TARGET, REMOVED, ACTUAL breakdown
            const dateWiseDetailedBreakdown = [];
            dateWiseBreakdown.forEach((data, date) => {
                const targetHours = parseFloat((data.totalHours / 3600).toFixed(2));
                const removedHours = parseFloat((data.removedHours / 3600).toFixed(2));
                const actualHours = parseFloat(((data.totalHours - data.removedHours) / 3600).toFixed(2));
                const targetMinusRemoved = parseFloat((targetHours - removedHours).toFixed(2));

                dateWiseDetailedBreakdown.push({
                    'Date': date,
                    'Target': targetHours.toFixed(2),
                    'Removed': removedHours.toFixed(2),
                    'Actual': actualHours.toFixed(2),
                    'Formula': `${targetHours.toFixed(2)} - ${removedHours.toFixed(2)} = ${actualHours.toFixed(2)}`,
                    'Target - Removed': targetMinusRemoved.toFixed(2)
                });
            });

            // Add total row
            dateWiseDetailedBreakdown.push({
                'Date': '🔵 TOTAL',
                'Target': grandTotalHours.toFixed(2),
                'Removed': grandRemovedHours.toFixed(2),
                'Actual': grandActualHours.toFixed(2),
                'Formula': `${grandTotalHours.toFixed(2)} - ${grandRemovedHours.toFixed(2)} = ${grandActualHours.toFixed(2)}`,
                'Target - Removed': (grandTotalHours - grandRemovedHours).toFixed(2)
            });

            console.table(dateWiseDetailedBreakdown);

            // Use raw accumulated seconds — no rounding drift
            const beforeExclusionDuration = duration2Adjusted / 3600;
            newadjustedDuration = grandActualSeconds1;
            // When all selected dates are holidays newadjustedDuration would be 0 — fall back to full duration
            if (newadjustedDuration === 0 && adjustedDuration > 0) {
                newadjustedDuration = adjustedDuration;
                isOnlyHolidayRange = true;
            }
            const afterExclusionDuration = grandActualSeconds1 / 3600;
            const totalHoursRemovedFromDuration = beforeExclusionDuration - afterExclusionDuration;

            // Summary breakdown of removed hours by category
            const removedHoursSummary = new Map();
            dateWiseBreakdown.forEach((data, date) => {
                // data.removedHours already includes all removed hours
                const key = (data.removedHours / 3600).toFixed(2);
                removedHoursSummary.set(key, (removedHoursSummary.get(key) || 0) + 1);
            });

            const sortedSummary = Array.from(removedHoursSummary.entries()).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
            if (sortedSummary.length === 0 || (sortedSummary.length === 1 && sortedSummary[0][0] === '0.00')) {
                console.log(`%c  No machines removed (condition not met)`, "color: #4CAF50; font-weight: bold;");
            } else {
                sortedSummary.forEach(([hours, count]) => {
                    if (hours !== '0.00') {
                        console.log(`  %c${hours} hrs removed: ${count} date(s)`, "color: #FF5722; font-weight: bold;");
                    }
                });
            }

            // Detailed excluded machines by date with table format
            if (dateWiseBreakdown.size > 0) {
                const hasExclusions = Array.from(dateWiseBreakdown.values()).some(d => d.excludedMachines.length > 0);
                if (hasExclusions) {

                    // Build table data for removed shifts - show all shifts for excluded dates
                    const removedShiftsTable = [];

                    // Determine all shifts to show based on selection
                    const allShiftsToShow = selectedShift === "allshift"
                        ? shifts.map(s => String(s.shift_no))
                        : [String(selectedShift)];

                    // For each excluded date, show ALL shifts with all machines removed
                    dateWiseBreakdown.forEach((data, date) => {
                        if (data.removedHours > 0) {
                            const machineNames = selectedMachines.join(", ");
                            const hoursPerShift = (data.totalHours / allShiftsToShow.length / 3600).toFixed(2);

                            // Show ALL shifts for this date
                            allShiftsToShow.forEach(shiftNo => {
                                removedShiftsTable.push({
                                    'Date': date,
                                    'Shift': shiftNo,
                                    'Removed Machines': machineNames,
                                    'Included Machines': '—',
                                    'Hours Removed': hoursPerShift,
                                    'Reason': 'All machines excluded (Run <= 20% AND (Alarm+Idle+Disconnect > 20h))'
                                });
                            });
                        }
                    });

                    if (removedShiftsTable.length > 0) {

                        const dateWiseSummary = [];
                        dateWiseBreakdown.forEach((data, date) => {
                            if (data.excludedMachines.length > 0) {
                                const allRemovedPerDate = [];
                                const shiftsAffected = [];
                                data.excludedMachines.forEach(exc => {
                                    shiftsAffected.push(exc.shift);
                                    allRemovedPerDate.push(...exc.removedMachines);
                                });
                                const uniqueRemoved = [...new Set(allRemovedPerDate)];
                                dateWiseSummary.push({
                                    'Date': date,
                                    'Shifts': shiftsAffected.join(", "),
                                    'Removed': uniqueRemoved.join(", "),
                                    'All Machines': selectedMachines.join(", "),
                                    'Count': `${uniqueRemoved.length}/${selectedMachines.length}`
                                });
                            }
                        });
                        if (dateWiseSummary.length > 0) {
                            console.table(dateWiseSummary);
                        }


                        const masterTable = [];
                        dateWiseBreakdown.forEach((data, date) => {
                            if (data.excludedMachines.length > 0) {
                                data.excludedMachines.forEach((exc, idx) => {
                                    masterTable.push({
                                        'Date': date,
                                        'Shift': exc.shift,
                                        'Removed Machines': exc.removedMachines.join(", "),
                                        'Included Machines': exc.includedMachines?.length > 0 ? exc.includedMachines.join(", ") : '—',
                                        'Hours Removed': `${exc.shiftHoursRemoved} hrs`,
                                        'Reason': 'Run <= 20% & (Alarm + Idle + Disconnect > 20h)'
                                    });
                                });
                            }
                        });
                        if (masterTable.length > 0) {
                            console.table(masterTable);
                        }
                    }
                } else {
                    console.log("\n");
                    console.log("%c✅ NO MACHINES EXCLUDED (All machines meet the condition criteria)", "color: #4CAF50; font-weight: bold; font-size: 12px;");
                }
            }

        } else {
            // Calculate duration1 and duration2 without breaktime removal across date range
            let duration1Adjusted = 0;
            let duration2Adjusted = 0;
            let duration2RemovedDueToCap = 0;
            let currentDay = startDate.startOf('day');
            const lastDay = endDate.startOf('day');

            const shiftsToProcess = selectedShift === "allshift"
                ? shifts.map(s => String(s.shift_no))
                : [String(selectedShift)];

            const dateWiseBreakdown = new Map(); // { date: { totalHours, removedHours, actualHours, excludedMachines } }

            while (!currentDay.isAfter(lastDay)) {
                const currentDateStr = currentDay.format('YYYY-MM-DD');

                const isManualHoliday = manualHolidaySet.has(currentDateStr);
                const isManualProduction = manualProductionSet.has(currentDateStr);

                // Initialize date entry (needed even on holiday dates)
                if (!dateWiseBreakdown.has(currentDateStr)) {
                    dateWiseBreakdown.set(currentDateStr, {
                        totalHours: 0,
                        removedHours: 0,
                        actualHours: 0,
                        excludedMachines: []
                    });
                }
                const dateData = dateWiseBreakdown.get(currentDateStr);

                for (const shiftNo of shiftsToProcess) {
                    const shiftTimes = getShiftTimes(shifts, shiftNo, currentDay);
                    const shiftSecs = shiftTimes.from && shiftTimes.to
                        ? Math.floor((shiftTimes.to - shiftTimes.from) / 1000)
                        : 0;

                    // Per-shift aware holiday exclusion from newadjustedDuration
                    if (isShiftExcludedForDuration(shiftNo, currentDateStr)) {
                        duration1Adjusted += shiftSecs * selectedDeviceIds.length;
                        continue;
                    }

                    // Count machines with non-zero runtime (excluding machines with zero run duration globally)
                    let machinesWithRuntimeCount = 0;
                    let machinesRemovedCount = 0;
                    let machineNamesIncluded = [];
                    let machineNamesRemoved = [];

                    for (const deviceId of selectedDeviceIds) {
                        const key = `${deviceId}-${currentDateStr}-${shiftNo}`;
                        const deviceName = deviceNameID.find(d => d.id === deviceId)?.name || deviceId;

                        // Production-override: always count all machines regardless of telemetry
                        if (isManualProduction || gPerShiftProd.get(shiftNo)?.has(currentDateStr)) {
                            machinesWithRuntimeCount++;
                            machineNamesIncluded.push(deviceName);
                        } else if (!zeroRuntimeSet.has(key) &&
                            !isDateExceededFor20Hours(deviceId, currentDateStr)) {
                            machinesWithRuntimeCount++;
                            machineNamesIncluded.push(deviceName);
                        } else if (!zeroRuntimeSet.has(key) &&
                            isDateExceededFor20Hours(deviceId, currentDateStr)) {
                            machinesRemovedCount++;
                            machineNamesRemoved.push(deviceName);
                        }
                    }

                    // Per-shift or whole-day production override → no machines excluded for this shift
                    const machinesExcludedForThisDate = (isManualProduction || gPerShiftProd.get(shiftNo)?.has(currentDateStr))
                        ? 0
                        : selectedDeviceIds.filter(id => isDateExceededFor20Hours(id, currentDateStr)).length;
                    const shiftDuration2WithoutRemoval = shiftSecs * (selectedDeviceIds.length - machinesExcludedForThisDate);
                    const shiftDuration2Actual = shiftSecs * machinesWithRuntimeCount;
                    const shiftRemoved = shiftDuration2WithoutRemoval - shiftDuration2Actual;

                    // duration1: include all selected machines
                    const shiftDuration1 = shiftSecs * selectedDeviceIds.length;
                    duration1Adjusted += shiftDuration1;
                    dateData.totalHours += shiftDuration1;

                    // duration2: only include machines with non-zero runtime and not excluded by date threshold
                    duration2Adjusted += shiftDuration2Actual;
                    dateData.actualHours += shiftDuration2Actual;
                    duration2RemovedDueToCap += shiftRemoved;
                    dateData.removedHours += shiftRemoved;

                    if (machinesRemovedCount > 0) {
                        dateData.excludedMachines.push({
                            shift: shiftNo,
                            removedMachines: machineNamesRemoved,
                            includedMachines: machineNamesIncluded,
                            shiftHoursRemoved: (shiftRemoved / 3600).toFixed(2)
                        });
                    }
                }

                currentDay = currentDay.add(1, 'day');
            }

            adjustedDuration = duration1Adjusted;
            newadjustedDuration = duration2Adjusted;

            // Create table data
            const tableData = [];
            // Accumulate raw seconds to avoid rounding drift from .toFixed(2) per date
            let grandTotalSeconds = 0, grandRemovedSeconds = 0, grandActualSeconds = 0;

            // Get machines excluded for this date
            const getMachinesExcludedForDate = (dateStr) => {
                const excluded = [];
                for (const deviceId of selectedDeviceIds) {
                    if (isDateExceededFor20Hours(deviceId, dateStr)) {
                        excluded.push(deviceId);
                    }
                }
                return excluded;
            };

            dateWiseBreakdown.forEach((data, date) => {
                const totalHrs = parseFloat((data.totalHours / 3600).toFixed(2));
                const actualHrs = parseFloat((data.actualHours / 3600).toFixed(2));
                const totalRemoved = parseFloat(((data.totalHours - data.actualHours) / 3600).toFixed(2));

                tableData.push({
                    Date: date,
                    'Total Hours': totalHrs.toFixed(2),
                    'Removed Hours': totalRemoved.toFixed(2),
                    'Actual Hours': actualHrs.toFixed(2),
                    'Formula': `${totalHrs.toFixed(2)} - ${totalRemoved.toFixed(2)} = ${actualHrs.toFixed(2)}`
                });

                // Accumulate raw seconds (not rounded hours) to preserve precision
                grandTotalSeconds += data.totalHours;
                grandRemovedSeconds += (data.totalHours - data.actualHours);
                grandActualSeconds += data.actualHours;
            });

            // Derive display-only hour values from the raw second totals
            const grandTotalHours = grandTotalSeconds / 3600;
            const grandRemovedHours = grandRemovedSeconds / 3600;
            const grandActualHours = grandActualSeconds / 3600;

            // Add total row to table
            tableData.push({
                Date: '🔵 TOTAL',
                'Total Hours': grandTotalHours.toFixed(2),
                'Removed Hours': grandRemovedHours.toFixed(2),
                'Actual Hours': grandActualHours.toFixed(2),
                'Formula': `${grandTotalHours.toFixed(2)} - ${grandRemovedHours.toFixed(2)} = ${grandActualHours.toFixed(2)}`
            });

            // Date-wise TARGET, REMOVED, ACTUAL breakdown
            const dateWiseDetailedBreakdown = [];
            dateWiseBreakdown.forEach((data, date) => {
                const targetHours = parseFloat((data.totalHours / 3600).toFixed(2));
                const removedHours = parseFloat(((data.totalHours - data.actualHours) / 3600).toFixed(2));
                const actualHours = parseFloat((data.actualHours / 3600).toFixed(2));
                const machinesExcluded = (data.dateRunExceeded?.has(date)) ? 'YES' : 'NO';

                dateWiseDetailedBreakdown.push({
                    'Date': date,
                    'Target Hours': targetHours.toFixed(2),
                    'Removed Hours': removedHours.toFixed(2),
                    'Actual Hours': actualHours.toFixed(2),
                    'Excluded': machinesExcluded,
                    'Percentage Used': removedHours > 0 ? ((actualHours / targetHours) * 100).toFixed(1) + '%' : '100%'
                });
            });

            // Use raw accumulated seconds — no rounding drift
            newadjustedDuration = grandActualSeconds;
            // When all selected dates are holidays newadjustedDuration would be 0 — fall back to full duration
            if (newadjustedDuration === 0 && adjustedDuration > 0) {
                newadjustedDuration = adjustedDuration;
                isOnlyHolidayRange = true;
            }

            // Summary breakdown of removed hours by category
            const removedHoursSummary = new Map();
            dateWiseBreakdown.forEach((data, date) => {
                // data.totalHours - data.actualHours gives total removed (both zero-runtime and AND condition)
                const key = ((data.totalHours - data.actualHours) / 3600).toFixed(2);
                removedHoursSummary.set(key, (removedHoursSummary.get(key) || 0) + 1);
            });

            const sortedSummary = Array.from(removedHoursSummary.entries()).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
            sortedSummary.forEach(([hours, count]) => {
                console.log(`  ${hours} hrs removed: ${count} date(s)`);
            });

            // Detailed excluded machines by date with table format
            if (dateWiseBreakdown.size > 0) {
                const hasExclusions = Array.from(dateWiseBreakdown.values()).some(d => d.excludedMachines.length > 0);
                if (hasExclusions) {

                    // Build table data for removed shifts - show all shifts for excluded dates
                    const removedShiftsTable = [];

                    // Determine all shifts to show based on selection
                    const allShiftsToShow = selectedShift === "allshift"
                        ? shifts.map(s => String(s.shift_no))
                        : [String(selectedShift)];


                    // For each excluded date, show ALL shifts with all machines removed
                    dateWiseBreakdown.forEach((data, date) => {
                        if (data.removedHours > 0) {
                            const machineNames = selectedMachines.join(", ");
                            const hoursPerShift = (data.totalHours / allShiftsToShow.length / 3600).toFixed(2);

                            // Show ALL shifts for this date
                            allShiftsToShow.forEach(shiftNo => {
                                removedShiftsTable.push({
                                    'Date': date,
                                    'Shift': shiftNo,
                                    'Removed Machines': machineNames,
                                    'Included Machines': '—',
                                    'Hours Removed': hoursPerShift,
                                    'Reason': 'All machines excluded (Run <= 20% AND (Alarm+Idle+Disconnect > 20h))'
                                });
                            });
                        }
                    });

                    if (removedShiftsTable.length > 0) {

                        const dateWiseSummary = [];
                        dateWiseBreakdown.forEach((data, date) => {
                            if (data.excludedMachines.length > 0) {
                                const allRemovedPerDate = [];
                                const shiftsAffected = [];
                                data.excludedMachines.forEach(exc => {
                                    shiftsAffected.push(exc.shift);
                                    allRemovedPerDate.push(...exc.removedMachines);
                                });
                                const uniqueRemoved = [...new Set(allRemovedPerDate)];
                                dateWiseSummary.push({
                                    'Date': date,
                                    'Shifts': shiftsAffected.join(", "),
                                    'Removed': uniqueRemoved.join(", "),
                                    'All Machines': selectedMachines.join(", "),
                                    'Count': `${uniqueRemoved.length}/${selectedMachines.length}`
                                });
                            }
                        });
                        if (dateWiseSummary.length > 0) {
                            console.table(dateWiseSummary);
                        }
                        // Master consolidated table with all details
                        const masterTable = [];
                        dateWiseBreakdown.forEach((data, date) => {
                            if (data.excludedMachines.length > 0) {
                                data.excludedMachines.forEach((exc, idx) => {
                                    masterTable.push({
                                        'Date': date,
                                        'Shift': exc.shift,
                                        'Removed Machines': exc.removedMachines.join(", "),
                                        'Included Machines': exc.includedMachines?.length > 0 ? exc.includedMachines.join(", ") : '—',
                                        'Hours Removed': `${exc.shiftHoursRemoved} hrs`,
                                        'Reason': 'Run <= 20% & (Alarm + Idle + Disconnect > 20h)'
                                    });
                                });
                            }
                        });
                        if (masterTable.length > 0) {
                            console.table(masterTable);
                        }
                    }

                } else {
                    console.log("\n");
                    console.log("%c✅ NO MACHINES EXCLUDED (All machines meet the condition criteria)", "color: #4CAF50; font-weight: bold; font-size: 12px;");
                }
            }
        }

        const baseUrl = window._env_?.SERVER_URL || '';
        const GRAFANA_URL = window._env_?.GRAFANA_URL || '';

        // Always use the actual targetParts regardless of excluded dates
        const adjustedTargetParts = data.parts.targetParts || 0;

        // Calculate total days in range minus manual holidays
        const totalDaysInRange = endDate.startOf('day').diff(startDate.startOf('day'), 'day') + 1;
        const manualHolidayCount = manualHolidaySet.size;
        const effectiveDays = Math.max(0, totalDaysInRange - manualHolidayCount);

        // isOnlyHolidayRange was determined above (alongside the newadjustedDuration fallback):
        // - Only holiday/excluded dates → send full (unreduced) data, since reducing zeros everything.
        // - Holiday + production        → keep the reduced new_total_* values (holiday data subtracted).
        // When the range is entirely holidays, fall back to the raw totals so the
        // dashboard still shows the holiday-day data instead of zeros.
        const effectiveDurations = isOnlyHolidayRange
            ? {
                ...data.durations,
                new_total_run_duration: data.durations.total_run_duration,
                new_total_idle_duration: data.durations.total_idle_duration,
                new_total_alarm_duration: data.durations.total_alarm_duration,
                new_total_disconnect_duration: data.durations.total_disconnect_duration,
            }
            : data.durations;

        const fallbackTotalParts = data.parts.totalParts || { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0, ts: 0 };
        const effectiveNewTargetParts = isOnlyHolidayRange
            ? adjustedTargetParts
            : (data.new_targetparts ?? adjustedTargetParts);
        const effectiveNewTotalParts = isOnlyHolidayRange
            ? fallbackTotalParts
            : (data.new_totalparts ?? fallbackTotalParts);

        const grafanaData = {
            oee: oeeVar,
            availability: availabilityVar,
            performance: performanceVar,
            duration: {
                ...effectiveDurations,
                // Break-window run/idle/alarm/disconnect (seconds), grouped together
                total_duration: {
                    break_run: data.durations?.break_run || 0,
                    break_idle: data.durations?.break_idle || 0,
                    break_alarm: data.durations?.break_alarm || 0,
                    break_disconnect: data.durations?.break_disconnect || 0,
                },
            },
            machineStatus: data.machineStatus,
            targetParts: adjustedTargetParts,
            totalParts: fallbackTotalParts,
            new_targetparts: effectiveNewTargetParts,
            new_totalparts: effectiveNewTotalParts,
            machinePerformance: data.machinePerformance,
            manualHolidayDays: manualHolidayCount,
            effectiveDays,
        };


        if (newadjustedDuration < adjustedDuration) {
            const diff = (adjustedDuration - newadjustedDuration) / 3600;
        }
        const fromDateStr = startDate.format("YYYY-MM-DD");
        const toDateStr = endDate.format("YYYY-MM-DD");
        const shiftParam =
            selectedShift && selectedShift !== "allshift"
                ? selectedShift
                : shifts.map(s => s.shift_no).join(",");
        const encodedData = encodeURIComponent(JSON.stringify(grafanaData));
        const reporturl = `${window._env_.SERVER_URL2}report/idle_report/${machineParam}/${shiftParam}/${fromDateStr}/${toDateStr}/1/10000000000000`;
        console.log(reporturl, 'reporturl');
        // Round to nearest minute to eliminate sub-minute drift from break_time seconds accumulation
        const roundedAdjustedDuration = Math.round(adjustedDuration / 60) * 60;
        const roundedNewadjustedDuration = Math.round(newadjustedDuration / 60) * 60;
        const mainUrl = `${GRAFANA_URL}d/cfa1esd5995a8b/one-page-dashboard-main-2?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&from=${from}&to=${to}&var-duration=${roundedAdjustedDuration}&var-duration1=${roundedNewadjustedDuration}&var-url=${baseUrl}&var-idleReasonReportUrl=${reporturl}&var-isAllMachinesSelected=${isAllMachinesSelected}&var-grafanaurl=${GRAFANA_URL}&var-shifts=${shiftVar}&var-data=${encodedData}&var-selectedMachines=${encodeURIComponent(machineParam)}&kiosk&theme=light&refresh=20s`;

        return { mainUrl };
    }, [customerId, token, selectedDevice, selectedShift, shifts, startDate, endDate, devices, getShiftTimes, selectedMachines]);

    // Initial data fetching
    useEffect(() => {
        if (customerId) {
            Promise.all([fetchShifts(), fetchDevices()]);
        }
    }, [customerId, fetchShifts, fetchDevices]);


    useEffect(() => {
        if (shifts.length === 0 || selectedShift !== null) return;

        setSelectedShift(getCurrentShift(shifts));

        // If the current time is before the first shift of the day starts,
        // default both date pickers to yesterday so the user sees real data
        const firstShift = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no))[0];
        if (firstShift) {
            const [h, m] = firstShift.start_time.split(':').map(Number);
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const firstShiftMinutes = h * 60 + m;
            if (currentMinutes < firstShiftMinutes) {
                const yesterday = dayjs().subtract(1, 'day');
                setStartDate(yesterday);
                setEndDate(yesterday);
            }
        }
    }, [shifts, selectedShift, getCurrentShift]);

    // If the currently selected shift is a future shift (e.g. user switched date to today),
    // auto-reset to the current shift to avoid a blank screen.
    useEffect(() => {
        if (!shifts.length || !selectedShift || selectedShift === 'allshift') return;
        const isToday = startDate.isSame(dayjs(), 'day');
        if (!isToday) return;
        const times = getShiftTimes(shifts, selectedShift, startDate);
        if (times.from !== null && times.from > Date.now()) {
            setSelectedShift(getCurrentShift(shifts));
        }
    }, [startDate, shifts, selectedShift, getShiftTimes, getCurrentShift]);

    // Handle submit with all data fetching
    const handleSubmit = useCallback(async () => {
        setIsLoading(true);
        try {
            // Refresh manual holiday/production overrides before computing.
            await fetchManualOverrides();
            const data = await fetchAllDashboardData();
            if (data) {
                const { mainUrl } = generateGrafanaUrls(data);
                setMainGrafanaUrl(mainUrl);
            }
        } finally {
            setIsLoading(false);
        }
    }, [fetchManualOverrides, fetchAllDashboardData, generateGrafanaUrls]);

    useEffect(() => {
        const currentShift = getCurrentShift(shifts);
        const isCurrentShift = currentShift === selectedShift;
        const isEndDateToday = endDate.isSame(dayjs(), "day");
        let intervalId = null;
        if (isEndDateToday && (isCurrentShift || selectedShift === "allshift")) {
            intervalId = setInterval(() => {
                if (document.visibilityState === "visible") handleSubmit();
            }, 60 * 5000);
        }
        return () => clearInterval(intervalId);
    }, [handleSubmit, selectedShift, endDate, shifts, getCurrentShift]);

    useEffect(() => {
        const readyToFetch =
            customerId &&
            selectedShift !== null &&
            shifts.length > 0 &&
            selectedMachines.length > 0 &&
            deviceNameID.length > 0 &&
            devices.length > 0 &&
            startDate &&
            endDate;

        if (readyToFetch && isInitialLoad.current) {
            handleSubmit();
            isInitialLoad.current = false;
        }
    }, [
        customerId,
        selectedShift,
        shifts,
        selectedMachines,
        deviceNameID,
        devices,
        startDate,
        endDate,
        handleSubmit
    ]);


    // Memoized device options
    const deviceOptions = useMemo(() => [
        <MenuItem key="all" value="all">All Machines</MenuItem>,
        ...devices.map((d) => (
            <MenuItem key={d.id.id} value={d.id.id}>
                {d.name}
            </MenuItem>
        ))
    ], [devices]);

    // Drive isBeforeFirstShift state: set it on shift load and schedule a timeout
    // that fires the exact moment the first shift starts — no page refresh needed.
    useEffect(() => {
        if (!shifts.length) return;
        const firstShift = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no))[0];
        if (!firstShift) return;

        const [h, m] = firstShift.start_time.split(':').map(Number);
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const firstShiftMinutes = h * 60 + m;

        if (currentMinutes < firstShiftMinutes) {
            setIsBeforeFirstShift(true);

            // ms remaining until first shift starts (account for seconds/ms already elapsed)
            const msUntilStart =
                ((firstShiftMinutes - currentMinutes) * 60 - now.getSeconds()) * 1000
                - now.getMilliseconds();

            const timer = setTimeout(() => {
                setIsBeforeFirstShift(false);
                setStartDate(dayjs());
                setEndDate(dayjs());
                setSelectedShift(String(firstShift.shift_no));
            }, msUntilStart);

            return () => clearTimeout(timer);
        } else {
            setIsBeforeFirstShift(false);
        }
    }, [shifts]);

    // Memoized shift options — disable shifts that haven't started yet (only on today's date)
    const shiftOptions = useMemo(() => {
        const now = Date.now();
        const isToday = startDate.isSame(dayjs(), 'day');

        return [
            <MenuItem key="allshift" value="allshift">All Shifts</MenuItem>,
            ...shifts.map((shift) => {
                const isFuture = isToday && (() => {
                    const times = getShiftTimes(shifts, String(shift.shift_no), startDate);
                    return times.from !== null && times.from > now;
                })();
                return (
                    <MenuItem key={shift.shift_no} value={String(shift.shift_no)} disabled={isFuture}>
                        {shift.shift_no}{isFuture ? ' (upcoming)' : ''}
                    </MenuItem>
                );
            })
        ];
    }, [shifts, startDate, getShiftTimes]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 65px)',
            background: '#fefcfcff',
            boxSizing: 'border-box',
        }}>
            <div style={{
                padding: '20px 30px',
                borderBottom: '1px solid #e0e0e0',
                background: '#ffffff',
                flexShrink: 0,
                marginTop: '30px'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <h4 style={{ margin: 0 }}><b>KPI Dashboard</b></h4>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '16px',
                        alignItems: 'center'
                    }}>
                        {showMachineGroupsDropdown && (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel sx={{ fontSize: '13px', color: '#86868b' }}>Machine Group</InputLabel>
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

                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel sx={{ fontSize: '13px', color: '#86868b' }}>Machines</InputLabel>
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
                            <InputLabel>Shift *</InputLabel>
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
                                    // Clamp end date: must not exceed 1 month from new start or today
                                    const maxAllowed = val.add(1, 'month').isAfter(dayjs()) ? dayjs() : val.add(1, 'month');
                                    if (endDate.isAfter(maxAllowed)) {
                                        setEndDate(maxAllowed);
                                    }
                                }}
                                format="DD-MM-YYYY"
                                maxDate={dayjs()}
                                shouldDisableDate={(date) => isBeforeFirstShift && date.isSame(dayjs(), 'day')}
                                slotProps={{
                                    textField: {
                                        size: "small",
                                        sx: { minWidth: 160 }
                                    }
                                }}
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
                                shouldDisableDate={(date) => isBeforeFirstShift && date.isSame(dayjs(), 'day')}
                                slotProps={{
                                    textField: {
                                        size: "small",
                                        sx: { minWidth: 160 }
                                    }
                                }}
                            />
                        </LocalizationProvider>


                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={isLoading || selectedMachines.length === 0}
                            sx={{
                                minWidth: 120,
                                height: 40,
                                background: '#f47803ff',
                                '&:hover': { background: '#e06d00ff' },
                                '&.Mui-disabled': { background: '#f4780380' },
                                textTransform: 'none',
                                fontWeight: 'bold',
                                gap: '8px'
                            }}
                        >
                            {isLoading && <CircularProgress size={16} sx={{ color: '#fff' }} />}
                            {isLoading ? 'Loading...' : 'Submit'}
                        </Button>
                    </div>
                </div>
            </div>

            <div style={{
                flex: 1,
                overflow: 'hidden',
                background: '#fff',
                position: 'relative',
            }}>
                {isLoading ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px',
                        background: '#f8f9fa',
                    }}>
                        <CircularProgress size={48} sx={{ color: '#f47803' }} />
                        <span style={{ fontSize: '14px', color: '#6c757d', fontWeight: 500 }}>
                            Fetching dashboard data...
                        </span>
                    </div>
                ) : mainGrafanaUrl ? (
                    <>
                        <iframe
                            src={mainGrafanaUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                display: 'block'
                            }}
                            title="Grafana KPI Dashboard - Main"
                            allowFullScreen
                        />
                        <div
                            style={{
                                position: 'absolute',
                                top: 2,
                                right: 14,
                                width: 80,
                                height: "100%",
                                backgroundColor: 'transparent',
                                zIndex: 10
                            }}
                        />
                        <div //oee %
                            style={{
                                position: 'absolute',
                                top: 0,
                                width: "100%",
                                height: 40,
                                backgroundColor: 'transparent',
                                zIndex: 10,
                            }}
                        />
                        <div //oee %
                            style={{
                                position: 'absolute',
                                top: 100,
                                width: "100%",
                                height: 40,
                                backgroundColor: 'transparent',
                                zIndex: 10,
                            }}
                        />
                        <div //oee %
                            style={{
                                position: 'absolute',
                                top: 400,
                                width: "100%",
                                height: 40,
                                backgroundColor: 'transparent',
                                zIndex: 10,
                            }}
                        />
                    </>
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        background: '#f8f9fa',
                        color: '#6c757d',
                        fontSize: '14px'
                    }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                        </svg>
                        Select filters and click Submit to load the dashboard
                    </div>
                )}
            </div>
        </div>
    );
}