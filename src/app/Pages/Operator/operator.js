import './operator.css';
import logo from '../../../assets/yantraimage.png';
import { FaRegClock, FaRegCalendarAlt, FaArrowUp } from "react-icons/fa";
import { IoLogOutOutline } from "react-icons/io5";
import { FaPause } from "react-icons/fa6";
import { RxCross2 } from "react-icons/rx";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Downtimeadd1, DowntimeaddDelete, Deviceattributeget, Downtimeadd2, DowntimeaddDelete1 } from '../../Services/app/masterservice';
import { FaCheckCircle, FaTimesCircle, FaArrowDown } from "react-icons/fa";
import Swal from 'sweetalert2';

import {operatorTelemetry} from '../../Services/app/operatorservice'
/* ---------------- OPERATOR SCREEN ---------------- */


import {
    FormControl,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from "@mui/material";
import { customerbaseddevices, customerbasedshift, telemetrykeydata, telemetrylatestdata } from '../../Services/app/alarmservice';
import { Loginapi } from '../../Services/app/authservice';
import { getOperatorDetails } from '../../Services/app/loginservice';

import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { CustomDaySelect, CustomDateSelect } from '../Inputfield/inputfield';
/* ---------------- CIRCULAR PROGRESS ---------------- */

function CircularProgress({
    actual = 10,
    target = 20,
    partsBehind = 0,
    partsRejects = 0,
    status = "Running"
}) {
    let percentage = Math.min(100, Math.round((actual / target) * 100));
    if (isNaN(percentage)) {
        percentage = 100;
    }
    const intPartsBehind = Math.round(partsBehind);
    const intPartsRejects = Math.round(partsRejects);
    const partsAhead = actual > target ? actual - target : 0;

    // 🎨 Color rules based on percentage and status
    let circleBackground;
    let innerBackground;

    if (status === "Alarm") {
        circleBackground = `conic-gradient(#742a2a ${percentage * 3.6}deg, #fc8181 ${percentage * 3.6}deg)`;
        innerBackground = "#c53030";
    } else if (percentage >= 100) {
        circleBackground = `conic-gradient(#22543d 360deg, #68d391 360deg)`;
        innerBackground = "#2f855a";
    } else if (percentage > 75) {
        circleBackground = `conic-gradient(#22543d ${percentage * 3.6}deg, #68d391 ${percentage * 3.6}deg)`;
        innerBackground = "#2f855a";
    } else if (percentage < 40) {
        circleBackground = `conic-gradient(#742a2a ${percentage * 3.6}deg, #fc8181 ${percentage * 3.6}deg)`;
        innerBackground = "#c53030";
    } else {
        circleBackground = `conic-gradient(#7b341e ${percentage * 3.6}deg, #f6ad55 ${percentage * 3.6}deg)`;
        innerBackground = "#dd6b20";
    }

    return (
        <div className="progress-circle" style={{ background: circleBackground }}>
            <div className="progress-circle-inner" style={{ background: innerBackground }}>
                {/* 🔹 Percentage */}
                <div className="progress-percentage1-inner">
                    <span className="big">{percentage}%</span>
                </div>

                <div className="progress-metrics">
                    {/* ✅ At Goal or Ahead/Behind */}
                    {percentage >= 100 && partsAhead === 0 ? (
                        <>
                            <div className="metric">
                                <FaCheckCircle style={{ color: "limegreen", fontSize: "1.8rem" }} />
                            </div>
                            <span className="label">At Goal</span>
                        </>
                    ) : partsAhead > 0 ? (
                        <>
                            <div className="metric">
                                <FaArrowUp style={{ color: "#00bfff", fontSize: "1.2rem" }} />
                                <span className="value">{partsAhead}</span>
                            </div>
                            <span className="label">Parts Ahead</span>
                        </>
                    ) : intPartsBehind > 0 ? (
                        <>
                            <div className="metric">
                                <FaArrowDown style={{ color: "#ffcc00", fontSize: "1.2rem" }} />
                                <span className="value">{intPartsBehind}</span>
                            </div>
                            <span className="label">Parts Behind</span>
                        </>
                    ) : (
                        <>
                            <div className="metric">
                                <FaCheckCircle style={{ color: "limegreen", fontSize: "1.5rem" }} />
                            </div>
                            <span className="label">At Goal</span>
                        </>
                    )}

                    {/* ❌ Rejects */}
                    <div className="metric">
                        <FaTimesCircle style={{ color: "red", fontSize: "1.2rem" }} />
                        <span className="value">{intPartsRejects}</span>
                    </div>
                    <span className="label">Rejects</span>
                </div>
            </div>
        </div>
    );
}

/* ---------------- VERTICAL PROGRESS ---------------- */
function VerticalProgress({
    shiftStart = "10:00",
    shiftEnd = "22:00",
    login = "10:15"
}) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const [startH, startM] = shiftStart.split(":").map(Number);
    const [endH, endM] = shiftEnd.split(":").map(Number);
    const [loginH, loginM] = login.split(":").map(Number);

    const shiftStartTime = new Date();
    shiftStartTime.setHours(startH, startM, 0, 0);

    const shiftEndTime = new Date();
    shiftEndTime.setHours(endH, endM, 0, 0);

    const total = shiftEndTime - shiftStartTime;
    const passed = currentTime - shiftStartTime;
    const progressPercent = Math.min(100, Math.max(0, (passed / total) * 100));

    const loginDate = new Date(shiftStartTime);
    loginDate.setHours(loginH, loginM, 0, 0);
    const loginOffset = loginDate - shiftStartTime;
    const loginPercent = Math.min(100, Math.max(0, (loginOffset / total) * 100));

    // Format login time for display
    const loginAMPM = loginDate.getHours() >= 12 ? 'PM' : 'AM';
    const formattedLoginTime = `${(loginDate.getHours() % 12) || 12}:${(loginDate.getMinutes() < 10 ? '0' : '') + loginDate.getMinutes()} ${loginAMPM}`;

    return (
        <div className="vertical-progress-container">
            <div className="time-label start-time">Shift 2: {shiftStart}</div>
            <div className="progress-wrapper">
                <div className="progress-bar">
                    <div
                        className="progress"
                        style={{
                            height: `${progressPercent}%`,
                            minHeight: progressPercent > 0 ? '2px' : '0px'
                        }}
                    />
                    <div className="login-indicator" style={{ top: `${loginPercent}%` }}>
                        <div className="login-time-label">Started: {formattedLoginTime}</div>
                    </div>
                </div>
            </div>
            <div className="time-label end-time">Shift End: {shiftEnd}</div>
        </div>
    );
}

/* ---------------- OPERATOR SCREEN ---------------- */


function Operator() {
    const [date, setDate] = useState(dayjs().format("DD-MM-YYYY"));
    const [time, setTime] = useState(dayjs().format("HH:mm:ss"));
    const [deviceThresholds, setDeviceThresholds] = useState({});

    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [operatorslist, setoperatorslist] = useState([]);
    // machine & operator states
    const [machines, setMachines] = useState([]);
    const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
    const [selectedMachine, setSelectedMachine] = useState("");

    const [operators, setOperators] = useState([]);
    const [selectedOperator, setSelectedOperator] = useState("");

    const [reasonslist, setreasonslist] = useState([]);
    const [reasons, setreasons] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);

    const [openDownTimeModal, setopenDownTimeModal] = useState(false);

    const [shifts, setShifts] = useState([]);
    const [shiftOptions, setShiftOptions] = useState([]);
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [selectedShift, setSelectedShift] = useState(null);
    const [filteredResult, setfilteredResult] = useState([]);
    const [epochRange, setEpochRange] = useState({ from: null, to: null });
    const [loading, setLoading] = useState(false);

    // telemetry state
    const [telemetry, setTelemetry] = useState({
        machineStatus: "Unknown",
        targetParts: 0,
        totalShots: 0,
        goodParts: 0,
        scrap: 0,
        ncr: 0,
        jobName: "",
        jobCode: "",
    });

    // temp state for confirmation
    const [pendingMachine, setPendingMachine] = useState("");
    const [pendingOperator, setPendingOperator] = useState("");
    const [confirmType, setConfirmType] = useState(null);

    // status color mapping
const status = telemetry.machineStatus?.toLowerCase();

const statusColor =
  status === "running"
    ? "#3DA06A"
    : status === "idle"
    ? "#DD6B20"
    : status === "alarm"
    ? "#E53E3E"
    : status === "disconnect"
    ? "#ccc"
    : "#ccc";

    // fetch machines from API
    const fetchDevices = async () => {
        try {
            const customerId = "690d2210-8a3a-11f0-a3ac-9b534c07af2b"; // hardcoded
            const result = await customerbaseddevices(customerId, 1000, 0);
            const devicesList = result.data || [];

            setMachines(devicesList.map((d) => d.name));

            const nameIdMap = devicesList.reduce((acc, device) => {
                acc[device.name] = device.id.id;
                return acc;
            }, {});
            setDeviceNameIdJson(nameIdMap);

            if (devicesList.length > 0) {
                setSelectedMachine(devicesList[0].name);
            }
        } catch (err) {
            console.error("Failed to fetch devices", err);
        }
    };

    const handleDateChange1 = (newValue) => {
        const dayjsVal = dayjs(newValue);
        setSelectedDate(dayjsVal);

        // Recalculate epoch range when date changes
        if (selectedShift && shifts.length > 0) {
            const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, dayjsVal);
            setEpochRange({ from: fromEpoch, to: toEpoch });
            const key = 'alloperator';
            let customerId = '690d2210-8a3a-11f0-a3ac-9b534c07af2b'
            customerbasedshift(customerId, key)
                .then(async (data) => {
                    const allShifts = data[0]?.value || [];
                    setoperatorslist(allShifts);
                    console.log('alloperator', allShifts);

                    // ✅ Filter only "Operator" mode
                    const operatorNames = allShifts
                        .filter(shift => shift.mode === "Operator")  // <-- filter added
                        .map(shift => ({
                            value: shift.operatorname,
                            label: shift.operatorname
                        }));

                    setOperators(operatorNames);
                    const key2 = 'live_operator';
                    const entitytype = 'DEVICE';
                    const deviceid = selectedDeviceId;

                    try {
                        const response = await telemetrykeydata(deviceid, entitytype, key2, fromEpoch, toEpoch);
                        //const response = await telemetrylatestdata(deviceid, entitytype, key2);
                        if (response && response.live_operator && response.live_operator.length > 0 && response.live_operator[0].value) {
                            let operator = JSON.parse(response.live_operator[0].value).operator;
                            setSelectedOperator(operator);
                        } else {
                            setSelectedOperator('');
                        }
                    } catch (error) {

                        setSelectedOperator('');
                    }
                })
                .catch(error => {
                    console.error("Error fetching shifts:", error);
                });
        }
    };

    const formatDuration = (durationInSeconds) => {
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        const seconds = durationInSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const formatEpochToIST = (epoch) => {
        const options = { timeZone: 'Asia/Kolkata' };
        const date = new Date(epoch).toLocaleString('en-US', options);
        const d = new Date(date);

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    };

    // ✅ Fetch telemetry for selected machine
    const fetchTelemetry = async (deviceId) => {
        try {
            const keys = ["machine_Status", "targetparts", "totalparts", "live_component", "live_operator"];
            const data = await telemetrylatestdata(deviceId, "DEVICE", keys.join(","));

            const machineStatus = data?.machine_Status?.[0]?.value || "Unknown";
            const targetParts = parseInt(data?.targetparts?.[0]?.value || 0, 10);

            // Parse totalparts JSON
            let totalShots = 0, goodParts = 0, scrap = 0, ncr = 0;
            if (data?.totalparts?.[0]?.value) {
                try {
                    const parsed = JSON.parse(data.totalparts[0].value);
                    totalShots = parsed.totalshots || 0;
                    goodParts = parsed.goodparts || 0;
                    scrap = parsed.scrap || 0;
                    ncr = parsed.ncr || 0;
                } catch (err) {
                    console.error("Error parsing totalparts JSON", err);
                }
            }

            // Parse live_component JSON
            let jobName = "", jobCode = "";
            if (data?.live_component?.[0]?.value) {
                try {
                    const parsed = JSON.parse(data.live_component[0].value);
                    jobName = parsed.name || "";
                    jobCode = parsed.code || "";
                } catch (err) {
                    console.error("Error parsing live_component JSON", err);
                }
            }

            // ✅ Parse live_operator JSON
            let liveOperatorCode = "";
            if (data?.live_operator?.[0]?.value) {
                try {
                    const parsed = JSON.parse(data.live_operator[0].value);
                    liveOperatorCode = parsed.code || "";  // e.g. "112"
                } catch (err) {
                    console.error("Error parsing live_operator JSON", err);
                }
            }

            // ✅ Update telemetry state
            setTelemetry({
                machineStatus,
                targetParts,
                totalShots,
                goodParts,
                scrap,
                ncr,
                jobName,
                jobCode,
                liveOperator: liveOperatorCode,
            });

            // ✅ Automatically select operator in dropdown if found
            if (liveOperatorCode) {
                const found = operators.find(op => String(op.id) === String(liveOperatorCode));
                if (found) {
                    setSelectedOperator(found.id);
                }
            }

        } catch (err) {
            console.error("Telemetry fetch failed", err);
        }
    };


    const downtimereason = async () => {
        if (!selectedDeviceId || !selectedShift || !selectedDate) return;

        const { fromEpoch, toEpoch } = getEpochFromShift1(selectedShift, selectedDate);
        if (!fromEpoch || !toEpoch) return;

        const fromTime = fromEpoch;
        const toTime = toEpoch;
        const deviceId = selectedDeviceId;
        try {
            if (deviceId && fromTime && toTime) {
                telemetrykeydata(deviceId, 'DEVICE', 'machine_status', fromTime, toTime)
                    .then(async machineStatusResponse => {
                        const machineData = machineStatusResponse?.machine_status || [];

                        const statusMapping = {
                            0: { state: "Idle", color: "#FFEB3B" },
                            1: { state: "Idle", color: "#FFEB3B" },
                            2: { state: "Idle", color: "#FFEB3B" },
                            3: { state: "Run", color: "#4CAF50" },
                            100: { state: "Disconnect", color: "#808080" },
                            4: { state: "Alarm", color: "#F44336" },
                        };

                        let runTime = 0, idleTime = 0, disconnectTime = 0, alarmTime = 0;
                        const sortedData = [...machineData].sort((a, b) => Number(a.ts) - Number(b.ts));

                        for (let i = 0; i < sortedData.length; i++) {
                            const currentStatus = sortedData[i].value;
                            const currentTs = Number(sortedData[i].ts);

                            let nextTs;
                            if (i < sortedData.length - 1) {
                                nextTs = Number(sortedData[i + 1].ts);
                            } else {
                                nextTs = Number(toTime);
                            }

                            const intervalStart = Math.max(currentTs, Number(fromTime));
                            const intervalEnd = Math.min(nextTs, Number(toTime));
                            const duration = Math.max(0, intervalEnd - intervalStart);

                            if (duration > 0) {
                                const state = statusMapping[currentStatus]?.state;
                                if (state === "Run") {
                                    runTime += duration;
                                } else if (state === "Idle") {
                                    idleTime += duration;
                                } else if (state === "Disconnect") {
                                    disconnectTime += duration;
                                } else if (state === "Alarm") {
                                    alarmTime += duration;
                                }
                            }
                        }

                        const msToTime = ms => {
                            const absMs = Math.abs(ms);
                            const hours = Math.floor(absMs / 3600000);
                            const minutes = Math.floor((absMs % 3600000) / 60000);
                            const seconds = Math.floor((absMs % 60000) / 1000);
                            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        };



                        const transformedData = sortedData
                            .filter(item => item.ts && item.value !== undefined)
                            .map(item => ({ ts: item.ts, value: item.value }));

                        const extractStartEndFromOneToThree = (data) => {
                            const result = [];
                            let recording = false;
                            let segment = { start: null, value: null };

                            for (let i = 0; i < data.length; i++) {
                                const current = data[i];
                                const numericValue = Number(current.value);

                                if (!recording && (numericValue === 0 || numericValue === 1 || numericValue === 2)) {
                                    segment.start = current.ts;
                                    segment.value = numericValue;
                                    recording = true;
                                }

                                if (recording && numericValue === 3) {
                                    segment.end = current.ts;
                                    const startTime = new Date(segment.start);
                                    const endTime = new Date(segment.end);
                                    const duration = Math.floor((endTime - startTime) / 1000);

                                    result.push({
                                        start: segment.start,
                                        end: segment.end,
                                        duration: duration,
                                        value: segment.value,
                                        status: 'IDLE'
                                    });

                                    recording = false;
                                    segment = { start: null, value: null };
                                }

                                if (recording && (numericValue === 0 || numericValue === 1 || numericValue === 2)) {
                                    segment.value = numericValue;
                                }
                            }

                            // Handle case where recording never ended (no 3 found)
                            if (recording) {
                                segment.end = toTime;
                                const startTime = new Date(segment.start);
                                const endTime = new Date(segment.end);
                                const duration = Math.floor((endTime - startTime) / 1000);

                                result.push({
                                    start: segment.start,
                                    end: segment.end,
                                    duration: duration,
                                    value: segment.value,
                                    status: 'IDLE'
                                });
                            }

                            return result.length > 0 ? result : [{ start: fromTime, end: toTime, duration: 0, value: 0, status: 'NO_DATA' }];
                        };
                        let downtime;
                        const key = 'downtime_threasold';
                        const results = await Deviceattributeget(deviceId, key);
                        let downtimedatas = encodeURIComponent(JSON.stringify([{ start: fromTime, end: toTime, duration: 0, value: 0, status: 'NO_DATA' }]));
                        console.log('Result', results);

                        if (results && results.length > 0) {
                            downtime = results[0].value;
                            const result = extractStartEndFromOneToThree(transformedData);
                            const filteredResult = result.filter(entry => entry.duration > downtime);
                            console.log('filterresult', filteredResult)
                            setfilteredResult(filteredResult);
                            downtimedatas = encodeURIComponent(JSON.stringify(filteredResult));
                        }

                        const encodedData = encodeURIComponent(JSON.stringify(transformedData));
                        console.log('result', transformedData)

                        return Promise.all([
                            Promise.resolve(encodedData),
                            Promise.resolve(downtimedatas)
                        ]);
                    })
                    .then(async ([encodedData, downtimedatas]) => {
                        const downtimedata = downtimedatas;
                        console.log('downtimedata', downtimedata);

                        const key2 = 'live_reason';
                        const entitytype = 'DEVICE';
                        const deviceid = deviceId;

                        try {
                            const response = await telemetrykeydata(deviceid, entitytype, key2, fromEpoch, toEpoch);

                            if (
                                response &&
                                Array.isArray(response.live_reason) &&
                                response.live_reason.length > 0
                            ) {
                                const parsedLiveReasons = response.live_reason.map(entry => {
                                    try {
                                        const parsedValue = JSON.parse(entry.value);
                                        return {
                                            ts: entry.ts,
                                            ...parsedValue // includes: name, code, mode, module, idle_start
                                        };
                                    } catch (err) {
                                        console.error("Failed to parse live_reason value:", entry.value, err);
                                        return null;
                                    }
                                }).filter(reason => reason !== null);

                                // For each item in filteredResult, set reasonselected if match found
                                setfilteredResult(prevResults => {
                                    return prevResults.map(item => {
                                        const matched = parsedLiveReasons.find(reason =>
                                            String(reason.ts) === String(item.start)
                                        );
                                        return {
                                            ...item,
                                            reasonselected: matched?.name || item.reasonselected || ''
                                        };
                                    });
                                });

                            } else {
                                console.log("No valid live_reason data found");
                            }
                        } catch (error) {
                            console.error("Error while processing live_reason telemetry:", error);
                        }


                    })


            }
        } catch (error) {
            console.error('Error fetching downtime data:', error);
        } finally {
            setLoading(false);
        }
    };

    const cancelreason = async () => {
        setopenDownTimeModal(false);

    }


    const handleSaveThreshold2 = async () => {
        try {
            const completedRows = filteredResult.filter(item => item.reasonselected);

            if (completedRows.length === 0) {
                Swal.fire('Warning', 'No reasons selected to save.', 'warning');
                return;
            }

            for (const item of completedRows) {
                const operator = reasonslist.find(op => op.reason === item.reasonselected);
                const code = operator ? operator.code : null;
                const mode = operator ? operator.mode : null;
                const module = operator ? operator.module : null;

                const key = {
                    ts: item.start,  // This becomes the top-level "ts" field
                    values: {
                        live_reason: {
                            name: item.reasonselected,
                            code: code,
                            mode: mode,
                            module: module,
                            idle_start: item.start,
                            idle_end: item.end,
                            idle_duration: item.duration
                            // idle_start can be same as item.start or adjusted as needed

                        }
                    }
                };


                await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);

                // Optional: Update UI state to reflect change
                setDeviceThresholds(prev => ({
                    ...prev,
                    [selectedDeviceId.id || selectedDeviceId]: item.reasonselected
                }));
            }

            Swal.fire('Success', 'Reasons assigned successfully.', 'success');

        } catch (err) {
            console.error('Update error:', err);
            Swal.fire('Error', 'Failed to assign reason.', 'error');
        } finally {
            setopenDownTimeModal(false);
        }
    };


    const handleReasonChange = (index, val) => {
        setfilteredResult(prevResults => {
            const updatedResults = [...prevResults];
            updatedResults[index] = {
                ...updatedResults[index],
                reasonselected: val
            };
            return updatedResults;
        });
    };

    const getEpochFromShift1 = (shiftNo, selectedDateObj) => {
        if (!shiftNo || !selectedDateObj || shifts.length === 0) {
            return { fromEpoch: null, toEpoch: null };
        }

        const selectedShiftData = shifts.find(shift => shift.shift_no === shiftNo);
        if (!selectedShiftData) {
            return { fromEpoch: null, toEpoch: null };
        }

        const dateStr = selectedDateObj.format('YYYY-MM-DD');
        const startDateTime = dayjs(`${dateStr}T${selectedShiftData.start_time}`);

        let endDateTime;
        if (String(shiftNo) === "2" || shiftNo === 2) {
            const nextDay = selectedDateObj.add(1, 'day').format('YYYY-MM-DD');
            endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
        } else {
            endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
        }

        if (String(shiftNo) !== "2" && shiftNo !== 2) {
            const todayStr = dayjs().format('YYYY-MM-DD');
            if (dateStr === todayStr) {
                const now = dayjs();
                if (now.isBefore(endDateTime)) {
                    endDateTime = now;
                }
            }
        }

        return {
            fromEpoch: startDateTime.valueOf(),
            toEpoch: endDateTime.valueOf()
        };
    };

    const getEpochFromShift = (shiftNo, selectedDateObj) => {
        if (!shiftNo || !selectedDateObj || shifts.length === 0) {
            return { fromEpoch: null, toEpoch: null };
        }

        const selectedShiftData = shifts.find(shift => shift.shift_no === shiftNo);
        if (!selectedShiftData) {
            return { fromEpoch: null, toEpoch: null };
        }

        const dateStr = selectedDateObj.format('YYYY-MM-DD');
        const startDateTime = dayjs(`${dateStr}T${selectedShiftData.start_time}`);

        let endDateTime;
        // If shift 2, assume overnight so add 1 day to end time
        if (String(shiftNo) === "2" || shiftNo === 2) {
            const nextDay = selectedDateObj.add(1, 'day').format('YYYY-MM-DD');
            endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
        } else {
            endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
        }

        return {
            fromEpoch: startDateTime.valueOf(),
            toEpoch: endDateTime.valueOf()
        };
    };

    // refresh telemetry every 5 seconds
    useEffect(() => {
        if (!selectedMachine || !deviceNameIdJson[selectedMachine]) return;

        const deviceId = deviceNameIdJson[selectedMachine];
        fetchTelemetry(deviceId); // initial call

        const interval = setInterval(() => {
            fetchTelemetry(deviceId);
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedMachine, deviceNameIdJson]);

    // init
    useEffect(() => {
        const init = async () => {
            try {
                const secondUsername = "pms@gmail.com";
                const secondPassword = "pmspms";
                const secondResponse = await Loginapi(secondUsername, secondPassword);
                localStorage.setItem("email1", secondUsername);
                localStorage.setItem("token1", secondResponse.token);
                localStorage.setItem("Companyname1", secondResponse.Companyname);
                localStorage.setItem("role_name1", secondResponse.Role);

                await fetchDevices();

                // fetch operators
                const operatorResponse = await getOperatorDetails(
                    "690d2210-8a3a-11f0-a3ac-9b534c07af2b"
                );
                const responseData = operatorResponse?.[0]?.value || [];

                const mappedOperators = responseData.map((op) => ({
                    id: op.operatorid,
                    name: op.operatorname,
                }));

                setOperators(mappedOperators);

                if (mappedOperators.length > 0) {
                    setSelectedOperator(mappedOperators[0].id);
                }
            } catch (err) {
                console.error("Init failed", err);
            }
        };
        init();
    }, []);

    // live date & time
    useEffect(() => {
        const interval = setInterval(() => {
            setDate(dayjs().format("DD-MM-YYYY"));
            setTime(dayjs().format("HH:mm:ss"));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleShiftChange = (shiftValue) => {
        setSelectedShift(shiftValue);
        setSelectedShift(shiftValue);
        const selectedShiftData = shifts.find(shift => shift.shift_no === shiftValue);
        if (selectedShiftData) {
            setStartTime(dayjs(selectedShiftData.start_time, 'HH:mm:ss'));
            setEndTime(dayjs(selectedShiftData.end_time, 'HH:mm:ss'));
        }
        const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
        setEpochRange({ from: fromEpoch, to: toEpoch });
    };

    const handleConfirm = () => {
        if (confirmType === "machine") {
            setSelectedMachine(pendingMachine);
        } else if (confirmType === "operator") {
            setSelectedOperator(pendingOperator);
            //

            postOperator(pendingOperator)

        }
        setConfirmType(null);
        setPendingMachine("");
        setPendingOperator("");
    };

    const handleCancel = () => {
        setConfirmType(null);
        setPendingMachine("");
        setPendingOperator("");
    };

    // inside Operator component
    const [statusTimer, setStatusTimer] = useState("00:00:00");
    const [statusStartTime, setStatusStartTime] = useState(null);
    const [prevStatus, setPrevStatus] = useState("");



    const postOperator = async (pendingOperator) => {
        try {
            const deviceId = deviceNameIdJson[selectedMachine];

            let payload = {
                ts: dayjs().valueOf(),
                values: {
                    operator_id: +pendingOperator
                }
            }


            console.log(payload, 'payload')
            const response = await operatorTelemetry('DEVICE', deviceId, payload)

        } catch (err) {
            console.log('operator api failure')
        }
    }
    // ⏱️ Track timer when machine status changes
    useEffect(() => {
        if (!telemetry.machineStatus) return;

        if (telemetry.machineStatus !== prevStatus) {
            setPrevStatus(telemetry.machineStatus);
            setStatusStartTime(new Date()); // reset start time
            setStatusTimer("00:00:00");
        }
    }, [telemetry.machineStatus]);

    // ⏱️ Update timer every second
    useEffect(() => {
        if (!statusStartTime) return;

        const interval = setInterval(() => {
            const now = new Date();
            const diff = Math.floor((now - statusStartTime) / 1000); // seconds elapsed

            const hrs = String(Math.floor(diff / 3600)).padStart(2, "0");
            const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
            const secs = String(diff % 60).padStart(2, "0");

            setStatusTimer(`${hrs}:${mins}:${secs}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [statusStartTime]);


    const openDownTime = async (devicename, deviceid) => {
        const key = 'reason';
        const customerId = '690d2210-8a3a-11f0-a3ac-9b534c07af2b'
        setLoading(true);
        customerbasedshift(customerId, key)
            .then(async (data) => {
                const allShifts = data[0]?.value || [];
                setreasonslist(allShifts);

                const reasons = allShifts.map(shift => ({
                    value: shift.reason,
                    label: shift.reason
                }));
                setreasons(reasons);

                setSelectedDeviceId(deviceid);
                setopenDownTimeModal(true);
            })
            .catch(error => {
                console.error("Error fetching shifts:", error);
            });

        const key1 = 'allShift';
        customerbasedshift(customerId, key1)
            .then(async (data) => {
                const allShifts = data[0].value || [];
                setShifts(allShifts);

                const options = allShifts.map((shift) => ({
                    value: shift.shift_no,
                    label: `Shift${shift.shift_no}`,
                }));
                setShiftOptions(options);

                if (options.length > 0) {
                    const defaultShift = options[0].value;
                    setSelectedDate(dayjs());
                    setSelectedShift(defaultShift);
                    setfilteredResult([]);

                    const { fromEpoch, toEpoch } = getEpochFromShift(defaultShift, dayjs());
                    setEpochRange({ from: fromEpoch, to: toEpoch });
                }
            })
            .catch((err) => {
                console.error('Error loading shifts:', err);
            })
            .finally(() => setLoading(false));
    };

    return (
        <div className="operator-screen">
            {/* HEADER */}
            <div className="header">
                <img className="Logo" src={logo} alt="Logo" />
                <div className="header-text-element">
                    <h5>
                        <span className="span-1">Yantra </span>
                        <span className="span-2">Smart Buddy</span>
                    </h5>
                </div>

                <div className="calendar-container">
                    <div className="calendar">
                        <FaRegCalendarAlt style={{ fontSize: "1.3rem", color: "#F99022" }} />
                        <p>Date: </p>
                        <p>{date}</p>
                    </div>

                    <div className="calendar">
                        <FaRegClock style={{ fontSize: "1.3rem", color: "#F99022" }} />
                        <p>Time: </p>
                        <p>{time}</p>
                    </div>
                </div>
            </div>

            {/* STATUS HEADER */}
            <div className="header-2" style={{ background: statusColor }}>
                <div className="machine-name">
                    <p>Machine:</p>
                    <FormControl
                        size="small"
                        variant="standard"
                        sx={{
                            minWidth: 120,
                            marginLeft: "0.5rem",
                            "& .MuiInputBase-root": { color: "white" },
                            "& .MuiSvgIcon-root": { color: "white" },
                            "& .MuiInput-underline:before": { borderBottom: "1px solid white" },
                            "& .MuiInput-underline:hover:before": {
                                borderBottom: "2px solid white",
                            },
                        }}
                    >
                        <Select
                            value={selectedMachine}
                            onChange={(e) => {
                                setPendingMachine(e.target.value);
                                setConfirmType("machine");
                            }}
                        >
                            {machines.map((machine) => (
                                <MenuItem key={machine} value={machine}>
                                    {machine}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>
                <div className="header-2-right">
                    <div className="machine-name">
                        <p>Status: {telemetry.machineStatus}</p>
                    </div>

                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="content">
                <div className="contect-section" style={{width: '10rem'}}>
                    <VerticalProgress shiftStart="14:00" shiftEnd="22:00" login="15:20" />
                </div>

                <div className="contect-section circular-progress-section">
                    <CircularProgress
                        actual={telemetry.goodParts}
                        target={telemetry.targetParts}
                        partsBehind={Math.max(0, telemetry.targetParts - telemetry.goodParts)}
                        partsRejects={telemetry.scrap}
                        status={telemetry.machineStatus}
                    />
                    <div className="username-section">
                        <FormControl
                            variant="standard"
                            sx={{
                                minWidth: 140,
                                "& .MuiInputBase-root": { color: "#f99022", fontWeight: 600 },
                                "& .MuiSvgIcon-root": { color: "#f99022" },
                            }}
                        >
                            <Select
                                value={selectedOperator}
                                onChange={(e) => {
                                    setPendingOperator(e.target.value);
                                    setConfirmType("operator");
                                }}
                                disableUnderline
                            >
                                {operators.map((op) => (
                                    <MenuItem key={op.id} value={op.id}>
                                        {op.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>
                </div>

                <div className="contect-section">
                    <p>
                        Job Name: {telemetry.jobName}
                    </p>
                    <div style={{ textAlign: "end", marginTop: "0.2rem" }}>
                        <p className="actual">Actual vs Target</p>
                        <p className="actual-value">
                            {telemetry.goodParts}/{telemetry.targetParts}
                        </p>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className="footer1">
                <div className="footer-left" onClick={() => alert("Reject Parts clicked!")}>
                    <FaPause />
                    Reject Parts
                </div>
                <div
                    className="footer-right"
                    onClick={() =>
                        openDownTime(selectedMachine, deviceNameIdJson[selectedMachine])
                    }                >
                    <RxCross2 />
                    Reason for Downtime
                </div>
            </div>

            <Dialog
                open={openDownTimeModal}
                onClose={(event, reason) => {
                    if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
                        setopenDownTimeModal(false);
                    }
                }}
                sx={{
                    '& .MuiDialog-paper': {
                        width: '70%',
                        maxWidth: '70%'
                    }
                }}
            >
                <DialogTitle>Assign Reason</DialogTitle>
                <DialogContent>
                    <br></br>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <CustomDateSelect
                                name="selectedDate"
                                label="Select Date"
                                required
                                value={selectedDate}
                                onChange={handleDateChange1}
                                format="DD-MM-YYYY"
                                maxDate={dayjs()} // <-- Disallow future dates
                            />
                        </LocalizationProvider>
                        <CustomDaySelect
                            name="shift_no"
                            value={selectedShift}
                            onChange={(e) => handleShiftChange(e.target.value)}
                            label="Select Shift"
                            required
                            options={shiftOptions}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }}
                            onClick={() => downtimereason()}
                        >
                            Submit
                        </Button>
                    </div>
                    {filteredResult.length > 0 ? (
                        <div style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>Start Time (IST)</th>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>End Time (IST)</th>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>Duration</th>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>Status</th>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredResult.map((item, index) => (
                                        <tr key={index}>
                                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{formatEpochToIST(item.start)}</td>
                                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{formatEpochToIST(item.end)}</td>
                                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{formatDuration(item.duration)}</td>
                                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.status}</td>
                                            <td>
                                                <CustomDaySelect
                                                    name={`reasonselected-${index}`}
                                                    value={item.reasonselected || ''}
                                                    onChange={(e) => handleReasonChange(index, e.target.value)}
                                                    label="Select Reason"
                                                    required={true}
                                                    options={reasons}
                                                    error={!item.reasonselected}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ marginTop: '20px', textAlign: 'center', color: '#888' }}>
                            <h3>No Data Found</h3>
                        </div>
                    )}


                    {/* <CustomDaySelect
                            name="reasonselected"
                            value={reasonselected}
                            onChange={handleFormChange1}
                            label="Select Reason"
                            required={true}
                            options={reasons}
                            error={!reasonselected}
                            ref={customDaySelectRef}
                        /> */}
                </DialogContent>
                <DialogActions>
                    <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => cancelreason()}>Cancel</Button>
                    <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold2}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* CONFIRMATION POPUP */}
            <Dialog open={!!confirmType} onClose={handleCancel}>
                <DialogTitle>Confirm Change</DialogTitle>
                <DialogContent>
                    {confirmType === "machine"
                        ? `Are you sure you want to change the machine to "${pendingMachine}"?`
                        : `Are you sure you want to change the operator to "${operators.find((o) => o.id === pendingOperator)?.name || ""
                        }"?`}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button
                        onClick={handleConfirm}
                        sx={{
                            backgroundColor: "#F99022",
                            color: "white",
                            "&:hover": { backgroundColor: "#d97706" },
                        }}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}


export default Operator;


