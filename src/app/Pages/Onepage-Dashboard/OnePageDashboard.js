import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Button
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

export default function OnePageDashboard() {
    const customerId = localStorage.getItem('CustomerID');
    const token = localStorage.getItem('token1') || '';

    const [devices, setDevices] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('all');
    const [selectedShift, setSelectedShift] = useState(null);
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [mainGrafanaUrl, setMainGrafanaUrl] = useState('');
    const [isInitialLoad, setIsInitialLoad] = useState(true);

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

        // Prepare all fetch promises
        const promises = [];

        // 1. Metrics data (OEE, Availability, Performance)
        promises.push((async () => {
            const keys = ["oee", "availability", "performance"];
            const entityId = selectedDevice === 'all' ? cleanedCustomerId : selectedDevice;
            const entityType = selectedDevice === 'all' ? "CUSTOMER" : "DEVICE";
            
            const metrics = { oee: 0, availability: 0, performance: 0 };
            const values = { oee: [], availability: [], performance: [] };

            for (const shiftRange of shiftTimeRanges) {
                const data = await fetchTelemetryData(
                    entityId, 
                    entityType, 
                    keys, 
                    shiftRange.from, 
                    shiftRange.to
                );
                
                if (data) {
                    keys.forEach(key => {
                        const latest = getLatestDataPoint(data[key]);
                        if (latest) {
                            const val = parseFloat(latest.value);
                            if (!isNaN(val) && (key !== 'oee' || val > 0)) {
                                values[key].push(val);
                            }
                        }
                    });
                }
            }

            Object.keys(values).forEach(key => {
                if (values[key].length > 0) {
                    metrics[key] = Math.round(
                        values[key].reduce((sum, val) => sum + val, 0) / values[key].length
                    );
                }
            });

            return { metrics };
        })());

        // 2. Duration data
        promises.push((async () => {
            const keys = ["total_duration"];
            const durations = {
                total_run_duration: 0,
                total_idle_duration: 0,
                total_alarm_duration: 0,
                total_disconnect_duration: 0,
                total_settings_duration: 0
            };

            if (selectedDevice === 'all') {
                const devicePromises = devices.map(async (machine) => {
                    for (const shiftRange of shiftTimeRanges) {
                        const data = await fetchTelemetryData(
                            machine.id.id, 
                            "DEVICE", 
                            keys, 
                            shiftRange.from, 
                            shiftRange.to
                        );
                        
                        if (data?.total_duration?.[0]?.value) {
                            try {
                                const parsed = JSON.parse(data.total_duration[0].value);
                                Object.keys(durations).forEach(key => {
                                    durations[key] += parsed[key] || 0;
                                });
                            } catch (error) {
                                console.error(`Error parsing duration for ${machine.name}`, error);
                            }
                        }
                    }
                });
                await Promise.all(devicePromises);
            } else {
                const machine = devices.find(d => d.id.id === selectedDevice);
                if (machine) {
                    for (const shiftRange of shiftTimeRanges) {
                        const data = await fetchTelemetryData(
                            machine.id.id, 
                            "DEVICE", 
                            keys, 
                            shiftRange.from, 
                            shiftRange.to
                        );
                        
                        if (data?.total_duration?.[0]?.value) {
                            try {
                                const parsed = JSON.parse(data.total_duration[0].value);
                                Object.keys(durations).forEach(key => {
                                    durations[key] += parsed[key] || 0;
                                });
                            } catch (error) {
                                console.error(`Error parsing duration for ${machine.name}`, error);
                            }
                        }
                    }
                }
            }

            return { durations };
        })());

        // 3. Machine performance data
        promises.push((async () => {
            const keys = ["oee"];
            const machinePromises = devices.map(async (machine) => {
                const oeeValues = [];
                
                for (const shiftRange of shiftTimeRanges) {
                    const data = await fetchTelemetryData(
                        machine.id.id, 
                        "DEVICE", 
                        keys, 
                        shiftRange.from, 
                        shiftRange.to
                    );
                    
                    const latest = getLatestDataPoint(data?.oee);
                    if (latest) {
                        const oeeVal = parseFloat(latest.value);
                        if (!isNaN(oeeVal) && oeeVal > 0) {
                            oeeValues.push(oeeVal);
                        }
                    }
                }
                
                const machineOee = oeeValues.length > 0
                    ? Math.round(oeeValues.reduce((sum, val) => sum + val, 0) / oeeValues.length)
                    : 0;
                
                return {
                    machineId: machine.id.id,
                    machineName: machine.name,
                    oee: machineOee
                };
            });

            const allMachineData = await Promise.all(machinePromises);
            const validMachines = allMachineData.filter(m => m.oee > 0);
            const sortedMachines = [...validMachines].sort((a, b) => b.oee - a.oee);
            
            const result = {
                bestMachines: [],
                worstMachines: [],
                allMachines: sortedMachines,
                highestOee: sortedMachines[0]?.oee || 0,
                lowestOee: sortedMachines[sortedMachines.length - 1]?.oee || 0
            };
            
            if (sortedMachines.length > 0) {
                result.bestMachines = sortedMachines.filter(m => m.oee === result.highestOee);
                result.worstMachines = sortedMachines.filter(m => m.oee === result.lowestOee);
            }

            return { machinePerformance: result };
        })());

        // 4. Parts data
        promises.push((async () => {
            const keys = ["targetparts", "totalparts"];
            const result = {
                targetParts: 0,
                totalParts: { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0, ts: new Date().toISOString() }
            };

            const entityId = selectedDevice === 'all' ? cleanedCustomerId : selectedDevice;
            const entityType = selectedDevice === 'all' ? "CUSTOMER" : "DEVICE";

            const targetValues = [];
            const partsAccumulator = { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0 };

            for (const shiftRange of shiftTimeRanges) {
                const data = await fetchTelemetryData(
                    entityId, 
                    entityType, 
                    keys, 
                    shiftRange.from, 
                    shiftRange.to
                );
                
                // Target parts
                const latestTarget = getLatestDataPoint(data?.targetparts);
                if (latestTarget) {
                    const targetVal = parseFloat(latestTarget.value);
                    if (!isNaN(targetVal)) {
                        targetValues.push(targetVal);
                    }
                }
                
                // Total parts
                const latestTotal = getLatestDataPoint(data?.totalparts);
                if (latestTotal?.value) {
                    try {
                        const partsJson = JSON.parse(latestTotal.value);
                        Object.keys(partsAccumulator).forEach(key => {
                            partsAccumulator[key] += partsJson[key] || 0;
                        });
                    } catch (error) {
                        console.error('Error parsing totalparts', error);
                    }
                }
            }

            if (targetValues.length > 0) {
                result.targetParts = Math.round(targetValues.reduce((sum, val) => sum + val, 0));
            }
            
            result.totalParts = { ...partsAccumulator, ts: new Date().toISOString() };

            return { parts: result };
        })());

        try {
            const results = await Promise.all(promises);
            
            // Combine all results
            const combinedData = results.reduce((acc, result) => ({
                ...acc,
                ...result
            }), {});

            setDashboardData(prev => ({
                ...prev,
                ...combinedData
            }));

            return combinedData;
        } catch (error) {
            console.error("Error fetching dashboard data", error);
            return null;
        }
    }, [shifts, selectedShift, selectedDate, customerId, selectedDevice, devices, fetchTelemetryData, getShiftTimes, getShiftTimeRanges]);

    // Memoized Grafana URL generation
    const generateGrafanaUrls = useCallback((data) => {
        if (!customerId || !selectedShift) return { mainUrl: '' };
        
        const cleanedId = cleanCustomerId(customerId);
        const bearerToken = encodeURIComponent(`Bearer+${token}`);
        const entityType = selectedDevice === 'all' ? 'CUSTOMER' : 'DEVICE';
        const isAllMachinesSelected = selectedDevice === 'all';
        const entityId = selectedDevice === 'all' ? cleanedId : selectedDevice;
        
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
        const adjustedDuration = selectedDevice === 'all' && devices.length > 0
            ? durationInSeconds * devices.length
            : durationInSeconds;

        const baseUrl = window._env_?.SERVER_URL || '';
        const GRAFANA_URL = window._env_?.GRAFANA_URL || '';

        const grafanaData = {
            oee: oeeVar,
            availability: availabilityVar,
            performance: performanceVar,
            duration: data.durations,
            targetParts: data.parts.targetParts || 0,
            totalParts: data.parts.totalParts || { totalshots: 0, goodparts: 0, scrap: 0, ncr: 0, ts: 0 },
            machinePerformance: data.machinePerformance
        };
        
        console.log(grafanaData, 'overallShiftData');
        
        const encodedData = encodeURIComponent(JSON.stringify(grafanaData));
        
        const mainUrl = `${GRAFANA_URL}d/ff8qk32lx4d1cf/one-page-dashboard-main?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&from=${from}&to=${to}&var-duration=${adjustedDuration}&var-url=${baseUrl}&var-isAllMachinesSelected=${isAllMachinesSelected}&var-grafanaurl=${GRAFANA_URL}&var-shifts=${shiftVar}&var-data=${encodedData}&kiosk&theme=light&refresh=20s`;
        
        return { mainUrl };
    }, [customerId, token, selectedDevice, selectedShift, shifts, selectedDate, devices, getShiftTimes]);

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

    useEffect(() => {
        if (isInitialLoad && customerId && selectedShift !== null) {
            handleSubmit();
            setIsInitialLoad(false);
        }
    }, [customerId, selectedShift, isInitialLoad]);

    // Handle submit with all data fetching
    const handleSubmit = useCallback(async () => {
        const data = await fetchAllDashboardData();
        if (data) {
            const { mainUrl } = generateGrafanaUrls(data);
            setMainGrafanaUrl(mainUrl);
        }
    }, [fetchAllDashboardData, generateGrafanaUrls]);

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
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id="machines-label">Machines</InputLabel>
                            <Select
                                labelId="machines-label"
                                value={selectedDevice}
                                onChange={(e) => setSelectedDevice(e.target.value)}
                                label="Machines"
                            >
                                {deviceOptions}
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