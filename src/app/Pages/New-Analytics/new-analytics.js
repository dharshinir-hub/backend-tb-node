import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import dayjs from 'dayjs';
import './new-analytics.css';
import { cleanCustomerId, customerbaseddevices, customerbasedshift } from "../../Services/app/operatorservice";

export default function NewAnalytics() {
    const [selectedDevice, setSelectedDevice] = useState('all');
    const [devices, setDevices] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [fromDate, setFromDate] = useState(dayjs());
    const [toDate, setToDate] = useState(dayjs());
    const [analysisType, setAnalysisType] = useState('live_alarm');
    const [grafanaUrl, setGrafanaUrl] = useState([]);
    const [newToken, setNewToken] = useState(localStorage.getItem("token"));
    const [selectedShift, setSelectedShift] = useState('all');
    const customerId = localStorage.getItem('CustomerID');
    const [fromTime, setFromTime] = useState(null);
    const [toTime, setToTime] = useState(null);
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);

    useEffect(() => {
        if (customerId) {
            fetchShifts();
            fetchDevices();
        }
    }, [customerId]);

    useEffect(() => {
        updateGrafanaURL();
    }, [selectedDevice, fromTime, toTime, from, to, newToken, analysisType]);

    useEffect(() => {
        if (!fromDate || !toDate || shifts.length === 0) return;
        if (!fromDate.isSame(toDate, 'day') || selectedShift === 'all') {
            setSelectedShift('all');
            const firstShift = shifts[0];
            const lastShift = shifts[shifts.length - 1];
            const fromDT = dayjs(fromDate)
                .hour(Number(firstShift.start_time.split(':')[0]))
                .minute(Number(firstShift.start_time.split(':')[1]))
                .second(0)
                .millisecond(0);
            let lastShiftEndDT = dayjs(toDate)
                .hour(Number(lastShift.end_time.split(':')[0]))
                .minute(Number(lastShift.end_time.split(':')[1]))
                .second(0)
                .millisecond(0);
            const [endH, endM] = lastShift.end_time.split(':').map(Number);
            const [startH, startM] = lastShift.start_time.split(':').map(Number);
            if (endH < startH || (endH === startH && endM <= startM)) {
                lastShiftEndDT = lastShiftEndDT.add(1, 'day');
            }
            setFromTime(firstShift.start_time);
            setToTime(lastShift.end_time);
            setFrom(fromDT.valueOf());
            setTo(lastShiftEndDT.valueOf());
        } else {
            const shift = shifts.find(s => String(s.shift_no) === String(selectedShift)) || shifts[0];
            shiftHandler(shift);
        }
    }, [fromDate, toDate, selectedShift, shifts]);

    const shiftHandler = (shift) => {
        const startH = Number(shift.start_time.split(":")[0]);
        const startM = Number(shift.start_time.split(":")[1]);
        const endH = Number(shift.end_time.split(":")[0]);
        const endM = Number(shift.end_time.split(":")[1]);
        const fromDT = dayjs(fromDate).hour(startH).minute(startM).second(0).millisecond(0);
        let toDT = dayjs(fromDate).hour(endH).minute(endM).second(0).millisecond(0);
        if (endH < startH || (endH === startH && endM <= startM)) {
            toDT = toDT.add(1, 'day');
        }
        setFromTime(shift.start_time);
        setToTime(shift.end_time);
        setFrom(fromDT.valueOf());
        setTo(toDT.valueOf());
    };

    const fetchShifts = async () => {
        try {
            const result = await customerbasedshift(customerId, 'allShift');
            const shiftList = result[0]?.value || [];
            setShifts(shiftList);
        } catch (err) {
            console.error('Failed to fetch shifts', err);
        }
    };

    const fetchDevices = async () => {
        try {
            const result = await customerbaseddevices(customerId, 100, 0);
            const devicesList = result.data || [];
            setDevices(devicesList);
        } catch (err) {
            console.error("Failed to fetch devices", err);
        }
    };

    const getCurrentShift = (allShifts, selectedDate = dayjs()) => {
        const now = dayjs(selectedDate);
        for (let shift of allShifts) {
            const [startH, startM, startS = 0] = shift.start_time.split(":").map(Number);
            const [endH, endM, endS = 0] = shift.end_time.split(":").map(Number);
            let start = dayjs(now).hour(startH).minute(startM).second(startS).millisecond(0);
            let end = dayjs(now).hour(endH).minute(endM).second(endS).millisecond(0);
            if (end.isBefore(start)) {
                if (now.isBefore(end)) {
                    start = start.subtract(1, "day");
                } else {
                    end = end.add(1, "day");
                }
            }
            if (now.isAfter(start) && now.isBefore(end)) {
                return shift;
            }
        }
        return null;
    };

    const isShiftDisabled = !fromDate || !toDate ? true : !fromDate.isSame(toDate, 'day');

    const updateGrafanaURL = () => {
        const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
        const cleanedId = cleanCustomerId(customerId);
        let entityType = "CUSTOMER";
        let entityId = cleanedId;
        if (selectedDevice !== "all") {
            entityType = "DEVICE";
            entityId = selectedDevice;
        }
        const baseUrl = window._env_.SERVER_URL;
        const GRAFANA_URL = window._env_.GRAFANA_URL;
        const url =
            `${GRAFANA_URL}d/a56900cd-961f-4ed4-99c5-3ec120450653/alarm?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-keys=${analysisType}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light&refresh=5s`;
        console.log(url, 'Grafana URL');
        setGrafanaUrl(url);
    };

    return (
        <Box display="flex" flexWrap="wrap" height="calc(100vh - 2.6rem)" paddingTop="20px" bgcolor="#FEFCFC" flexDirection="column">
            <div className="header-1">
                <FormControl size="small" sx={{ minWidth: 160, background: '#fff' }}>
                    <InputLabel id="machines-label" style={{ background: '#fff' }}>Machines</InputLabel>
                    <Select
                        labelId="machines-label"
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                    >
                        <MenuItem value="all">All Machines</MenuItem>
                        {devices.map((d) => (
                            <MenuItem key={d.id.id} value={d.id.id}>{d.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160, background: "#fff" }}>
                    <InputLabel id="analysis-label" style={{ background: '#fff' }}>Analysis Type</InputLabel>
                    <Select
                        labelId="analysis-label"
                        value={analysisType}
                        onChange={(e) => setAnalysisType(e.target.value)}
                    >
                        <MenuItem value="live_alarm">Alarm</MenuItem>
                        <MenuItem value="live_reason">Downtime</MenuItem>
                    </Select>
                </FormControl>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                        label="From"
                        value={fromDate}
                        onChange={(newValue) => setFromDate(newValue)}
                        format="DD-MM-YYYY"
                        slotProps={{ textField: { size: "small", sx: { minWidth: 160, background: "#fff" } } }}
                    />
                </LocalizationProvider>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                        label="To"
                        value={toDate}
                        onChange={(newValue) => setToDate(newValue)}
                        format="DD-MM-YYYY"
                        slotProps={{ textField: { size: "small", sx: { minWidth: 160, background: "#fff" } } }}
                    />
                </LocalizationProvider>
                <FormControl size="small" sx={{ minWidth: 160, background: "#fff" }}>
                    <InputLabel id="shift-label" style={{ background: '#fff' }}>Shifts</InputLabel>
                    <Select
                        labelId="shift-label"
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        disabled={isShiftDisabled}
                    >
                        <MenuItem value="all">All Shifts</MenuItem>
                        {shifts.map((s) => (
                            <MenuItem key={s.shift_no} value={s.shift_no}>
                                {`Shift ${s.shift_no}`}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </div>
            <div style={{ flexGrow: 1 }}>
                <iframe
                    src={grafanaUrl}
                    style={{ width: "100%", height: "100%", border: "0" }}
                    title="Grafana Right"
                />
            </div>
        </Box>
    );
}
