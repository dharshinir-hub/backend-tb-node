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

import { getFirstMachineActive, operatorTelemetry } from '../../Services/app/operatorservice'
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
    duration,
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
    shiftNo,
    shiftStart = "10:00",
    shiftEnd = "22:00",
    firstActive // epoch in ms
}) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Parse shift start/end
    const [startH, startM] = shiftStart.split(":").map(Number);
    const [endH, endM] = shiftEnd.split(":").map(Number);

    const shiftStartTime = new Date();
    shiftStartTime.setHours(startH, startM, 0, 0);

    const shiftEndTime = new Date();
    shiftEndTime.setHours(endH, endM, 0, 0);

    const total = shiftEndTime - shiftStartTime;
    const passed = currentTime - shiftStartTime;
    const progressPercent = Math.min(100, Math.max(0, (passed / total) * 100));

    // First active time
    let loginPercent = 0;
    let formattedLoginTime = "N/A";

    if (firstActive) {
        const loginDate = new Date(firstActive);
        const loginOffset = loginDate - shiftStartTime;
        loginPercent = Math.min(100, Math.max(0, (loginOffset / total) * 100));

        // ✅ Format with dayjs as 24-hour "HH:mm"
        formattedLoginTime = dayjs(loginDate).format("HH:mm");
    }

    return (
        <div className="vertical-progress-container">
            <div className="time-label start-time">
                Shift {shiftNo}: {shiftStart}
            </div>
            <div className="progress-wrapper">
                <div className="progress-bar">
                    <div
                        className="progress"
                        style={{
                            height: `${progressPercent}%`,
                            minHeight: progressPercent > 0 ? "2px" : "0px"
                        }}
                    />
                    {firstActive && (
                        <div className="login-indicator" style={{ top: `${loginPercent}%` }}>
                            <div className="login-time-label">
                                Started: {formattedLoginTime}
                            </div>
                        </div>
                    )}
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
    const [currentShift, setCurrentShift] = useState(null)

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



    // ========== getCurrentShift ==========
    const getCurrentShift = (allShifts, selectedDate = dayjs()) => {
        const now = dayjs(); // system current time
        const baseDate = selectedDate ? dayjs(selectedDate) : dayjs();

        for (let shift of allShifts) {
            let start = baseDate.startOf("day");
            let end = baseDate.startOf("day");

            // build start time
            start = start
                .add(Number(shift.start_time.split(":")[0]), "hour")
                .add(Number(shift.start_time.split(":")[1]), "minute")
                .add(Number(shift.start_time.split(":")[2]), "second");

            // build end time
            end = end
                .add(Number(shift.end_time.split(":")[0]), "hour")
                .add(Number(shift.end_time.split(":")[1]), "minute")
                .add(Number(shift.end_time.split(":")[2]), "second");

            // overnight case: end is next day
            if (shift.start_day !== shift.end_day) {
                end = end.add(1, "day");
            }

            if (now.isAfter(start) && now.isBefore(end)) {
                return shift; // return full object
            }
        }

        return null;
    };


    const downtimereason = async ({ shiftNo, selectedDate, fromEpoch, toEpoch, deviceId }) => {
        if (!deviceId || !shiftNo || !selectedDate || !fromEpoch || !toEpoch) return [];

        const fromTime = fromEpoch;
        const toTime = toEpoch;

        try {
            const machineStatusResponse = await telemetrykeydata(deviceId, "DEVICE", "machine_status", fromTime, toTime);
            const machineData = machineStatusResponse?.machine_status || [];

            const statusMapping = {
                0: { state: "Idle", color: "#FFEB3B" },
                1: { state: "Idle", color: "#FFEB3B" },
                2: { state: "Idle", color: "#FFEB3B" },
                3: { state: "Run", color: "#4CAF50" },
                100: { state: "Disconnect", color: "#808080" },
                4: { state: "Alarm", color: "#F44336" },
            };

            const sortedData = [...machineData].sort((a, b) => Number(a.ts) - Number(b.ts));

            const transformedData = sortedData
                .filter(item => item.ts && item.value !== undefined)
                .map(item => ({ ts: item.ts, value: item.value }));

            // helper: extract idle ranges
            const extractStartEndFromOneToThree = (data) => {
                const result = [];
                let recording = false;
                let segment = { start: null, value: null };

                for (let i = 0; i < data.length; i++) {
                    const current = data[i];
                    const numericValue = Number(current.value);

                    if (!recording && [0, 1, 2].includes(numericValue)) {
                        segment.start = current.ts;
                        segment.value = numericValue;
                        recording = true;
                    }

                    if (recording && numericValue === 3) {
                        segment.end = current.ts;
                        const duration = Math.floor((segment.end - segment.start) / 1000);

                        result.push({ start: segment.start, end: segment.end, duration, value: segment.value, status: "IDLE" });
                        recording = false;
                        segment = { start: null, value: null };
                    }

                    if (recording && [0, 1, 2].includes(numericValue)) {
                        segment.value = numericValue;
                    }
                }

                if (recording) {
                    segment.end = toTime;
                    const duration = Math.floor((segment.end - segment.start) / 1000);
                    result.push({ start: segment.start, end: segment.end, duration, value: segment.value, status: "IDLE" });
                }

                return result.length > 0 ? result : [{ start: fromTime, end: toTime, duration: 0, value: 0, status: "NO_DATA" }];
            };

            // apply downtime threshold
            const key = "downtime_threasold";
            const results = await Deviceattributeget(deviceId, key);

            let filteredResult = [];
            if (results && results.length > 0) {
                const downtime = results[0].value;
                const result = extractStartEndFromOneToThree(transformedData);
                filteredResult = result.filter(entry => entry.duration > downtime);
            }

            // live reasons
            const response = await telemetrykeydata(deviceId, "DEVICE", "live_reason", fromEpoch, toEpoch);
            if (response?.live_reason?.length > 0) {
                const parsedLiveReasons = response.live_reason
                    .map(entry => {
                        try {
                            return { ts: entry.ts, ...JSON.parse(entry.value) };
                        } catch { return null; }
                    })
                    .filter(Boolean);

                filteredResult = filteredResult.map(item => {
                    const matched = parsedLiveReasons.find(reason => String(reason.ts) === String(item.start));
                    return { ...item, reasonselected: matched?.name || item.reasonselected || "" };
                });
            }

            return filteredResult;
        } catch (error) {
            console.error("Error fetching downtime data:", error);
            return [];
        }
    };


    const [firstMachineActive, setFirstMachineActive] = useState(null);




    useEffect(() => {
        const getAllShifts = async () => {
            try {
                // Only fetch devices once (move this outside or into another effect if needed)
                if (!Object.keys(deviceNameIdJson).length) {
                    await fetchDevices();
                }

                console.log("Fetching shifts...");
                const response = await customerbasedshift(
                    "690d2210-8a3a-11f0-a3ac-9b534c07af2b",
                    "allShift"
                );
                const shifts = response[0]?.value || [];
                console.log("Shifts:", shifts);

                const currentActiveShift = await getCurrentShift(shifts, selectedDate);
                if (!currentActiveShift) return;

                const formattedShift = {
                    ...currentActiveShift,
                    start_time: currentActiveShift.start_time.slice(0, 5),
                    end_time: currentActiveShift.end_time.slice(0, 5),
                };
                setCurrentShift(formattedShift);

                const { fromEpoch, toEpoch } = getEpochFromShift2(
                    currentActiveShift.shift_no,
                    dayjs(selectedDate),
                    shifts
                );
                console.log(fromEpoch, toEpoch, "from and to");

                const deviceId = deviceNameIdJson[selectedMachine];
                if (!deviceId) return; // avoid invalid calls

                const machineData = await getFirstMachineActive("DEVICE", deviceId, {
                    keys: "machine_status",
                    startTs: fromEpoch,
                    endTs: toEpoch,
                    interval: 0,
                    limit: 2000, // 🔹 reduce load (adjust as needed)
                    useStrictDataTypes: false,
                });

                console.log("Machine telemetry data:", machineData);

                const lastActive = machineData?.machine_status
                    ?.slice()
                    .reverse()
                    .find((item) => item.value === "3");

                console.log(lastActive?.ts, "first active");
                setFirstMachineActive(lastActive?.ts || null);
            } catch (err) {
                console.error("Error in getAllShifts:", err);
            }
        };

        getAllShifts();
    }, [selectedMachine, selectedDate]); // 🔹 removed deviceNameIdJson

    // 🔹 Telemetry refresher
    useEffect(() => {
        if (!selectedMachine || !deviceNameIdJson[selectedMachine]) return;

        const deviceId = deviceNameIdJson[selectedMachine];
        fetchTelemetry(deviceId); // initial call

        const interval = setInterval(() => fetchTelemetry(deviceId), 5000);
        return () => clearInterval(interval);
    }, [selectedMachine, deviceNameIdJson]);


    const openDownTime = async (devicename, deviceid) => {
        const customerId = "690d2210-8a3a-11f0-a3ac-9b534c07af2b";
        setLoading(true);

        try {
            const [reasonsData, shiftsData] = await Promise.all([
                customerbasedshift(customerId, "reason"),
                customerbasedshift(customerId, "allShift"),
            ]);

            const allReasons = reasonsData[0]?.value || [];
            setreasonslist(allReasons);
            setreasons(allReasons.map(r => ({ value: r.reason, label: r.reason })));

            const allShifts = shiftsData[0]?.value || [];
            setShifts(allShifts);

            const options = allShifts.map(shift => ({
                value: shift.shift_no,
                label: `Shift${shift.shift_no}`,
            }));
            setShiftOptions(options);

            setSelectedDeviceId(deviceid);
            setSelectedDate(dayjs());
            setfilteredResult([]); // clear old data

            const currentShift = getCurrentShift(allShifts);
            let chosenShiftNo = currentShift?.shift_no || (options.length > 0 ? options[0].value : null);

            if (chosenShiftNo) {
                setSelectedShift(chosenShiftNo);

                const { fromEpoch, toEpoch } = getEpochFromShift(chosenShiftNo, dayjs());
                setEpochRange({ from: fromEpoch, to: toEpoch });

                // ✅ fetch and wait for data first
                const data = await downtimereason({
                    shiftNo: chosenShiftNo,
                    selectedDate: dayjs(),
                    fromEpoch,
                    toEpoch,
                    deviceId: deviceid,
                });

                setfilteredResult(data);

                // ✅ open modal only after data is set
                setopenDownTimeModal(true);
            } else {
                console.warn("⚠️ No active shift found right now");
            }
        } catch (err) {
            console.error("Error in openDownTime:", err);
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

    const getEpochFromShift2 = (shiftNo, selectedDateObj, shifts) => {
        if (!shiftNo || !selectedDateObj || !shifts || shifts.length === 0) {
            return { fromEpoch: null, toEpoch: null };
        }

        const selectedShiftData = shifts.find(shift => String(shift.shift_no) === String(shiftNo));
        if (!selectedShiftData) {
            return { fromEpoch: null, toEpoch: null };
        }

        const dateStr = selectedDateObj.format("YYYY-MM-DD");
        const startDateTime = dayjs(`${dateStr}T${selectedShiftData.start_time}`);

        let endDateTime;
        if (selectedShiftData.end_day !== selectedShiftData.start_day) {
            // shift spans to next day
            const nextDay = selectedDateObj.add(1, "day").format("YYYY-MM-DD");
            endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
        } else {
            endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
        }

        return {
            fromEpoch: startDateTime.valueOf(),
            toEpoch: endDateTime.valueOf(),
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

                console.log(responseData, 'responsea')
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
        console.log(shiftValue, 'shift value ------>')
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
            const startTime = dayjs().valueOf(); // current operator start time
            let endTime = 0;
            let duration = 0;

            const operatorName = operators.find(res => res.id == pendingOperator)?.name;
            console.log(operatorName, 'name');

            const previousOperator = JSON.parse(localStorage.getItem('operator_details'));

            if (previousOperator) {
                // Close the previous operator
                const updatedPrevOperator = {
                    ...previousOperator,
                    end_time: startTime,
                    duration: Math.floor((startTime - previousOperator.start_time) / 1000)
                };

                const prevPayload = {
                    ts: dayjs().valueOf(),
                    values: { live_operator: updatedPrevOperator }
                };

                console.log(prevPayload, 'prev operator payload');
                await operatorTelemetry('DEVICE', deviceId, prevPayload);
            }

            // Current operator payload (ongoing)
            const payload = {
                ts: dayjs().valueOf(),
                values: {
                    live_operator: {
                        name: operatorName,
                        code: +pendingOperator,
                        start_time: startTime,
                        end_time: "-",
                        duration: 0
                    }
                }
            };

            console.log(operators, 'operators');
            console.log(payload, 'payload');

            const response = await operatorTelemetry('DEVICE', deviceId, payload);

            // Save new operator details for next reference
            localStorage.setItem('operator_details', JSON.stringify(payload.values.live_operator));
        } catch (err) {
            console.log('operator api failure', err);
        }
    };





    const formattedReasons = reasons.map(reason => ({
        ...reason,
        label: reason.label.charAt(0).toUpperCase() + reason.label.slice(1)
    }));



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
                <div className="contect-section" style={{ width: '10rem' }}>
                    <VerticalProgress
                        shiftNo={currentShift?.shift_no}
                        shiftStart={currentShift?.start_time}
                        shiftEnd={currentShift?.end_time}
                        firstActive={firstMachineActive}
                    />
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

                    </div>
                    {filteredResult.length > 0 ? (
                        <div style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <colgroup>
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '36%' }} />
                                </colgroup>
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
                                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                                                <CustomDaySelect
                                                    name={`reasonselected-${index}`}
                                                    value={item.reasonselected || ''}
                                                    onChange={(e) => handleReasonChange(index, e.target.value)}
                                                    label="Select Reason"
                                                    required={true}
                                                    options={formattedReasons}
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
                </DialogContent>
                <DialogActions>
                    <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => cancelreason()}>Cancel</Button>
                    <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold2}>Save</Button>
                </DialogActions>
            </Dialog>

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


