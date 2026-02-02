import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Button,
    Checkbox,
    ListItemText
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

export default function OnePageDashboard() {
    const customerId = localStorage.getItem('CustomerID');
    const token = localStorage.getItem('token1') || '';

    const [devices, setDevices] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('all');
    const [selectedShift, setSelectedShift] = useState(null);
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [mainGrafanaUrl, setMainGrafanaUrl] = useState('');
    const isInitialLoad = useRef(true);
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

    // Consolidated state for all data
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
        }
    });

    // Memoized current shift calculation
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
                (fromMinutes > toMinutes &&
                    (currentMinutes >= fromMinutes || currentMinutes < toMinutes))
            ) {
                return String(s.shift_no);
            }
        }
        return "allshift";
    }, []);

    // Memoized shift times calculation
    const getShiftTimes = useCallback((shifts, shiftNo, date) => {
        if (!Array.isArray(shifts) || shifts.length === 0 || !date) {
            return { from: null, to: null };
        }

        const selectedDateStr = dayjs(date).format("YYYY-MM-DD");
        const getDateByDayOffset = (baseDate, dayValue) => {
            const offset = Number(dayValue) - 1;
            return dayjs(baseDate).add(offset, "day").format("YYYY-MM-DD");
        };

        if (shiftNo === "allshift" || shiftNo === "all shift") {
            const sortedShifts = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
            const firstShift = sortedShifts[0];
            const lastShift = sortedShifts[sortedShifts.length - 1];
            if (!firstShift || !lastShift) return { from: null, to: null };

            const fromStr = `${getDateByDayOffset(selectedDateStr, firstShift.start_day)}T${firstShift.start_time}`;
            const toStr = `${getDateByDayOffset(selectedDateStr, lastShift.end_day)}T${lastShift.end_time}`;
            return { from: new Date(fromStr).getTime(), to: new Date(toStr).getTime() };
        }

        const shiftData = shifts.find((s) => String(s.shift_no) === String(shiftNo));
        if (!shiftData) return { from: null, to: null };

        const { start_time, end_time, start_day, end_day } = shiftData;
        const fromStr = `${getDateByDayOffset(selectedDateStr, start_day)}T${start_time}`;
        const toStr = `${getDateByDayOffset(selectedDateStr, end_day)}T${end_time}`;
        return { from: new Date(fromStr).getTime(), to: new Date(toStr).getTime() };
    }, []);

    // Helper function to get all shift time ranges
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

    // Memoized fetch functions
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

    // Generic telemetry data fetcher
    const fetchTelemetryData = useCallback(async (entityId, entityType, keys, from, to) => {
        try {
            return await telemetrykeydata(entityId, entityType, keys, from, to);
        } catch (error) {
            console.error(`Error fetching telemetry data for ${entityType}:${entityId}`, error);
            return null;
        }
    }, []);

    // Helper to get latest data point
    const getLatestDataPoint = useCallback((dataArray) => {
        if (!Array.isArray(dataArray) || dataArray.length === 0) return null;
        return dataArray.reduce((latest, point) =>
            new Date(point.ts) > new Date(latest.ts) ? point : latest
        );
    }, []);

    // Consolidated data fetching
    const fetchAllDashboardData = useCallback(async () => {
        if (!shifts.length || selectedShift === null || !customerId) return;

        const shiftTimes = getShiftTimes(shifts, selectedShift, selectedDate);
        const from = shiftTimes.from || Date.now() - 24 * 60 * 60 * 1000;
        const to = shiftTimes.to || Date.now();
        if (!from || !to) return;

        const shiftTimeRanges = getShiftTimeRanges(shifts, selectedShift, selectedDate);
        const cleanedCustomerId = cleanCustomerId(customerId);
        const promises = [];

        console.log(deviceNameID, "device name list");
        console.log(selectedMachines, "calling apis for");

        const telemetryCache = new Map();
        const telemetryKeys = [
            "oee",
            "availability",
            "performance",
            "total_duration",
            "targetparts",
            "totalparts",
            "machine_status"
        ];

        async function getTelemetryCached(deviceId, from, to) {
            const cacheKey = `${deviceId}_${from}_${to}`;
            if (telemetryCache.has(cacheKey)) {
                return telemetryCache.get(cacheKey);
            }
            const data = await fetchTelemetryData(deviceId, "DEVICE", telemetryKeys, from, to);
            telemetryCache.set(cacheKey, data);
            return data;
        }

        const selectedDeviceIds = deviceNameID
            .filter((d) => selectedMachines.includes(d.name))
            .map((d) => d.id);

        /* ------------------------------------------------------------------ */
        /* 1. Metrics Data (OEE, Availability, Performance)                   */
        /* ------------------------------------------------------------------ */
        promises.push(
            (async () => {
                const metrics = { oee: 0, availability: 0, performance: 0 };
                const allDeviceResults = [];

                for (const deviceId of selectedDeviceIds) {
                    const values = { oee: [], availability: [], performance: [] };

                    for (const shiftRange of shiftTimeRanges) {
                        const data = await getTelemetryCached(deviceId, shiftRange.from, shiftRange.to);
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


        /* ------------------------------------------------------------------ */
        /* 2. Duration Data (Total Run/Idle/Alarm/Disconnect)                 */
        /* ------------------------------------------------------------------ */
        promises.push(
            (async () => {
                const totalDurations = {
                    total_run_duration: 0,
                    total_idle_duration: 0,
                    total_alarm_duration: 0,
                    total_disconnect_duration: 0,
                    total_settings_duration: 0
                };

                for (const deviceId of selectedDeviceIds) {
                    for (const shiftRange of shiftTimeRanges) {
                        const data = await getTelemetryCached(deviceId, shiftRange.from, shiftRange.to);
                        const raw = data?.total_duration?.[0]?.value;
                        if (!raw) continue;

                        try {
                            const parsed = JSON.parse(raw);
                            Object.keys(totalDurations).forEach((key) => {
                                totalDurations[key] += parsed[key] || 0;
                            });
                        } catch (err) {
                            console.error(`Error parsing total_duration for ${deviceId}`, err);
                        }
                    }
                }

                console.log("✅ Combined Durations:", totalDurations);
                return { durations: totalDurations };
            })()
        );

        /* ------------------------------------------------------------------ */
        /* 3. Machine Performance (Individual OEE Ranking)                    */
        /* ------------------------------------------------------------------ */
        promises.push(
            (async () => {
                const keys = ["oee"];
                const selectedMachinesObj = getDeviceObjectsForMachines(selectedMachines);
                const machinePromises = selectedMachinesObj.map(async (machine) => {
                    const oeeValues = [];

                    for (const shiftRange of shiftTimeRanges) {
                        const data = await getTelemetryCached(machine.id.id, shiftRange.from, shiftRange.to);
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

                return {
                    machinePerformance: {
                        allMachines: sorted,
                        bestMachines: sorted.filter((m) => m.oee === sorted[0]?.oee),
                        worstMachines: sorted.filter((m) => m.oee === sorted.at(-1)?.oee),
                        highestOee: sorted[0]?.oee || 0,
                        lowestOee: sorted.at(-1)?.oee || 0
                    }
                };
            })()
        );

        /* ------------------------------------------------------------------ */
        /* 4. Parts Data (Target & Total Parts Summed)                        */
        /* ------------------------------------------------------------------ */
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

                    for (const shiftRange of shiftTimeRanges) {
                        const data = await getTelemetryCached(deviceId, shiftRange.from, shiftRange.to);

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

                console.log("✅ Final Parts Data:", result);
                return { parts: result };
            })()
        );
        /* ------------------------------------------------------------------ */
        /* 5. Machine Status Summary (Run / Idle / Alarm / Disconnect)        */
        /* ------------------------------------------------------------------ */
        promises.push(
            (async () => {
                const statusSummary = {
                    run: 0,
                    idle: 0,
                    alarm: 0,
                    disconnect: 0,
                    total: selectedDeviceIds.length // ✅ simpler & consistent
                };

                for (const deviceId of selectedDeviceIds) {
                    const data = await getTelemetryCached(deviceId, from, to);
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




        /* ------------------------------------------------------------------ */
        /* Execute all sections in parallel                                   */
        /* ------------------------------------------------------------------ */
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
        selectedDate,
        customerId,
        selectedDevice,
        devices,
        fetchTelemetryData,
        getShiftTimes,
        getShiftTimeRanges,
        selectedMachines
    ]);


    // Memoized Grafana URL generation
    const generateGrafanaUrls = useCallback((data) => {
        if (!customerId || !selectedShift) return { mainUrl: '' };
        const machineParam = selectedMachines.join(",");
        const cleanedId = cleanCustomerId(customerId);
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

        const shiftTimes = getShiftTimes(shifts, selectedShift, selectedDate);
        const from = shiftTimes.from || Date.now() - 24 * 60 * 60 * 1000;
        const to = shiftTimes.to || Date.now();
        const durationInSeconds = Math.floor((to - from) / 1000);
        const adjustedDuration =
            durationInSeconds * selectedMachines.length;
        const baseUrl = window._env_?.SERVER_URL || '';
        const GRAFANA_URL = window._env_?.GRAFANA_URL || '';

        const grafanaData = {
            oee: oeeVar,
            availability: availabilityVar,
            performance: performanceVar,
            duration: data.durations,
            machineStatus: data.machineStatus,
            targetParts: data.parts.targetParts || 0,
            totalParts: data.parts.totalParts || { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0, ts: 0 },
            machinePerformance: data.machinePerformance
        };

        console.log(grafanaData, 'overallShiftData');
        const fromDateStr = dayjs(selectedDate).format("YYYY-MM-DD");
        const toDateStr = dayjs(selectedDate).format("YYYY-MM-DD");
        const shiftParam =
            selectedShift && selectedShift !== "allshift"
                ? selectedShift
                : shifts.map(s => s.shift_no).join(",");
        const encodedData = encodeURIComponent(JSON.stringify(grafanaData));
        const reporturl = `${window._env_.SERVER_URL2}report/idle_report/${machineParam}/${shiftParam}/${fromDateStr}/${toDateStr}/1/10000000000000`;
        console.log(reporturl, 'reporturl');
        const mainUrl = `${GRAFANA_URL}d/cfa1esd5995a8b/one-page-dashboard-main-2?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&from=${from}&to=${to}&var-duration=${adjustedDuration}&var-url=${baseUrl}&var-idleReasonReportUrl=${reporturl}&var-isAllMachinesSelected=${isAllMachinesSelected}&var-grafanaurl=${GRAFANA_URL}&var-shifts=${shiftVar}&var-data=${encodedData}&var-selectedMachines=${encodeURIComponent(machineParam)}&kiosk&theme=light&refresh=20s`;

        return { mainUrl };
    }, [customerId, token, selectedDevice, selectedShift, shifts, selectedDate, devices, getShiftTimes, selectedMachines]);

    // Initial data fetching
    useEffect(() => {
        if (customerId) {
            Promise.all([fetchShifts(), fetchDevices()]);
        }
    }, [customerId, fetchShifts, fetchDevices]);

    useEffect(() => {
        if (shifts.length > 0 && selectedShift === null) {
            setSelectedShift(getCurrentShift(shifts));
        }
    }, [shifts, selectedShift, getCurrentShift]);

    // Handle submit with all data fetching
    const handleSubmit = useCallback(async () => {
        const data = await fetchAllDashboardData();
        if (data) {
            const { mainUrl } = generateGrafanaUrls(data);
            setMainGrafanaUrl(mainUrl);
        }
    }, [fetchAllDashboardData, generateGrafanaUrls]);

    useEffect(() => {
        const currentShift = getCurrentShift(shifts);
        const isCurrentShift = currentShift === selectedShift;
        const isToday = selectedDate.isSame(dayjs(), "day");
        let intervalId = null;
        if ((isToday && isCurrentShift) || (isToday && selectedShift === "allshift")) {
            intervalId = setInterval(() => {
                if (document.visibilityState === "visible") handleSubmit();
            }, 60 * 5000);
        }
        return () => clearInterval(intervalId);
    }, [handleSubmit, selectedShift, selectedDate, shifts]);

    useEffect(() => {
        const readyToFetch =
            customerId &&
            selectedShift !== null &&
            shifts.length > 0 &&
            selectedMachines.length > 0 &&
            deviceNameID.length > 0 &&
            devices.length > 0;

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
        selectedDate,
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

    // Memoized shift options
    const shiftOptions = useMemo(() => [
        <MenuItem key="allshift" value="allshift">All Shifts</MenuItem>,
        ...shifts.map((shift) => (
            <MenuItem key={shift.shift_no} value={String(shift.shift_no)}>
                {shift.shift_no}
            </MenuItem>
        ))
    ], [shifts]);

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
                                label="Select Date"
                                value={selectedDate}
                                onChange={setSelectedDate}
                                format="DD-MM-YYYY"
                                maxDate={dayjs()}
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
                            sx={{
                                minWidth: 120,
                                height: 40,
                                background: '#f47803ff',
                                '&:hover': { background: '#e06d00ff' },
                                textTransform: 'none',
                                fontWeight: 'bold'
                            }}
                        >
                            Submit
                        </Button>
                    </div>
                </div>
            </div>

            <div style={{
                flex: 1,
                overflow: 'hidden',
                background: '#fff',
            }}>
                {mainGrafanaUrl ? (
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
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f8f9fa',
                        color: '#6c757d',
                        fontSize: '14px'
                    }}>
                        Loading main dashboard...
                    </div>
                )}
            </div>
        </div>
    );
}