import './operator.css';
import logo from '../../../assets/yantraimage.png';
import { FaRegClock, FaRegCalendarAlt } from "react-icons/fa";
import { FaPause } from "react-icons/fa6";
import { RxCross2 } from "react-icons/rx";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import Swal from 'sweetalert2';
import { customerbaseddevices, customerbasedshift, Deviceattributeget, Downtimeadd1, getFirstMachineActive, getMachineLock, operatorTelemetry, telemetrykeydata } from '../../Services/app/operatorservice'
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

import { getOperatorDetails, Loginapi, startTokenAutoRefresh } from '../../Services/app/loginservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import CircularProgress from '../../Shared/Pages/circularprogress/circularprogress';
import VerticalProgress from '../../Shared/Pages/verticalprogress/verticalprogress';

function Operator() {
    const [date, setDate] = useState(dayjs().format("DD-MM-YYYY"));
    const [time, setTime] = useState(dayjs().format("HH:mm:ss"));
    const [deviceThresholds, setDeviceThresholds] = useState({});
    const [currentShift, setCurrentShift] = useState(null)
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
    const [isLocked, setIsLocked] = useState(false);
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
    const [pendingMachine, setPendingMachine] = useState("");
    const [pendingOperator, setPendingOperator] = useState("");
    const [confirmType, setConfirmType] = useState(null);
const fetchDevices = async () => {
    try {
        const customerId = "690d2210-8a3a-11f0-a3ac-9b534c07af2b";
        const result = await customerbaseddevices(customerId, 1000, 0);
        const devicesList = result.data || [];
        setMachines(devicesList.map((d) => d.name));
        const nameIdMap = devicesList.reduce((acc, device) => {
            acc[device.name] = device.id.id;
            return acc;
        }, {});
        setDeviceNameIdJson(nameIdMap);
        if (devicesList.length > 0) {
            const savedMachine = localStorage.getItem("selectedMachine");
            if (savedMachine && devicesList.some(d => d.name === savedMachine)) {
                setSelectedMachine(savedMachine);
            } else {
                const defaultMachine = devicesList[0].name;
                setSelectedMachine(defaultMachine);
                localStorage.setItem("selectedMachine", defaultMachine);
            }
        }
    } catch (err) {
        console.error("Failed to fetch devices", err);
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

    function getShiftEpoch(shiftTime = "06:00") {
        const [hour, minute] = shiftTime.split(":").map(Number);

        const shiftStart = dayjs()
            .hour(hour)
            .minute(minute)
            .second(0)
            .millisecond(0)
            .valueOf();

        const now = dayjs().valueOf();

        return { shiftStart, now };
    }

    const statusText = (code) => {
  switch (code) {
    case 0:
    case 1:
    case 2:
      return "idle";
    case 3:
      return "running";
    case 5:
      return "alarm";
    case 100:
      return "disconnect";
    default:
      return "unknown";
  }
};

const fetchTelemetry = async (deviceId) => {
  try {
    const { shiftStart, now } = getShiftEpoch(currentShift?.start_time);

    const keysConfig = [
      { key: "machine_status", isJson: false },
      { key: "targetparts", isJson: false },
      { key: "totalparts", isJson: true },
      { key: "live_operator", isJson: true },
      { key: "live_component", isJson: true },
    ];

    const data = await getFirstMachineActive("DEVICE", deviceId, {
      keys: keysConfig.map(k => k.key).join(","),
      startTs: shiftStart || Date.now() - 3600000,
      endTs: now || Date.now(),
    });

    const getLatest = (key, isJson = false) => {
      const arr = data[key];
      if (!arr || arr.length === 0) return isJson ? {} : null;
      const value = arr[0].value;
      if (!isJson) return value;
      try {
        return JSON.parse(value);
      } catch (err) {
        console.error(`Error parsing JSON for key: ${key}`, err);
        return {};
      }
    };

    // ----- MACHINE STATUS -----
    const machineStatusArray = data.machine_status || [];
    const latestStatusCode = parseInt(machineStatusArray[0]?.value || 0, 10);
    const machineStatus = statusText(latestStatusCode);

    const firstActive = machineStatusArray
      .slice()
      .reverse()
      .find(item => item.value === "3")?.ts || null;

    const statusColor =
      machineStatus.toLowerCase() === "running"
        ? "#3DA06A"
        : machineStatus.toLowerCase() === "idle"
          ? "#DD6B20"
          : machineStatus.toLowerCase() === "alarm"
            ? "#E53E3E"
            : machineStatus.toLowerCase() === "disconnect"
              ? "#ccc"
              : "#ccc";

    // ----- OTHER TELEMETRY -----
    const targetParts = parseInt(getLatest("targetparts") || 0, 10);

    const totalParts = getLatest("totalparts", true);
    const { totalshots = 0, goodparts = 0, scrap = 0, ncr = 0 } = totalParts;

    const liveComponent = getLatest("live_component", true);
    const jobName = liveComponent.name || "Route card not assigned";
    const jobCode = liveComponent.code || "";

    const liveOperator = getLatest("live_operator", true);
    const liveOperatorCode = liveOperator.code || "";

    setTelemetry({
      machineStatus,
      machineColor: statusColor,
      firstActive,
      targetParts,
      totalShots: totalshots,
      goodParts: goodparts,
      scrap,
      ncr,
      jobName,
      jobCode,
      liveOperator: liveOperatorCode,
    });
    return data;
  } catch (err) {
    console.error("Telemetry fetch failed", err);
  }
};




    const getCurrentShift = (allShifts, selectedDate = dayjs()) => {
        const now = dayjs();
        const baseDate = selectedDate ? dayjs(selectedDate) : dayjs();
        for (let shift of allShifts) {
            let start = baseDate.startOf("day");
            let end = baseDate.startOf("day");
            start = start
                .add(Number(shift.start_time.split(":")[0]), "hour")
                .add(Number(shift.start_time.split(":")[1]), "minute")
                .add(Number(shift.start_time.split(":")[2]), "second");
            end = end
                .add(Number(shift.end_time.split(":")[0]), "hour")
                .add(Number(shift.end_time.split(":")[1]), "minute")
                .add(Number(shift.end_time.split(":")[2]), "second");
            if (shift.start_day !== shift.end_day) {
                end = end.add(1, "day");
            }
            if (now.isAfter(start) && now.isBefore(end)) {
                return shift;
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
    // get last known timestamp from telemetry
    const lastKnownTs = data.length > 0 ? data[data.length - 1].ts : fromTime;

    // or use current time if it's before shift end
    const now = Date.now();
    const safeEnd = Math.min(toTime, now, lastKnownTs);

    segment.end = safeEnd;
    const duration = Math.floor((segment.end - segment.start) / 1000);

    result.push({
        start: segment.start,
        end: segment.end,
        duration,
        value: segment.value,
        status: "IDLE"
    });
}

                return result.length > 0 ? result : [{ start: fromTime, end: toTime, duration: 0, value: 0, status: "NO_DATA" }];
            };
            const key = "downtime_threasold";
            const results = await Deviceattributeget(deviceId, key);
            let filteredResult = [];
            if (results && results.length > 0) {
                const downtime = results[0].value;
                const result = extractStartEndFromOneToThree(transformedData);
                filteredResult = result.filter(entry => entry.duration > downtime);
            }
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
        let timer;
        let interval;

        const getAllShifts = async () => {
            try {
                if (!Object.keys(deviceNameIdJson).length) {
                    await fetchDevices();
                }

                const response = await customerbasedshift(
                    "690d2210-8a3a-11f0-a3ac-9b534c07af2b",
                    "allShift"
                );
                const shifts = response[0]?.value || [];
                console.log("Shifts:", shifts);

                // 🔑 Always recalc current shift from NOW
                const currentActiveShift = await getCurrentShift(shifts, dayjs());
                if (!currentActiveShift) return;

                const formattedShift = {
                    ...currentActiveShift,
                    start_time: currentActiveShift.start_time.slice(0, 5),
                    end_time: currentActiveShift.end_time.slice(0, 5),
                };
                setCurrentShift(formattedShift);

                // const { fromEpoch, toEpoch } = getEpochFromShift2(
                //     currentActiveShift.shift_no,
                //     dayjs(),
                //     shifts
                // );

                // const deviceId = deviceNameIdJson[selectedMachine];
                // if (!deviceId) return;

                // const machineData = await getFirstMachineActive("DEVICE", deviceId, {
                //     keys: "machine_status",
                //     startTs: fromEpoch,
                //     endTs: toEpoch,
                //     interval: 0,
                //     limit: 2000,
                //     useStrictDataTypes: false,
                // });

                // console.log("Machine telemetry data:", machineData);

                // const lastActive = machineData?.machine_status
                //     ?.slice()
                //     .reverse()
                //     .find((item) => item.value === "3");
                // setFirstMachineActive(lastActive?.ts || null);

                // --- Shift timing ---
                const startTime = dayjs(`${dayjs().format("YYYY-MM-DD")} ${formattedShift.start_time}`, "YYYY-MM-DD HH:mm");
                let endTime = dayjs(`${dayjs().format("YYYY-MM-DD")} ${formattedShift.end_time}`, "YYYY-MM-DD HH:mm");

                // Overnight (end next day)
                if (currentActiveShift.start_day !== currentActiveShift.end_day) {
                    endTime = endTime.add(1, "day");
                }

                const now = dayjs();
                const delay = endTime.diff(now);

                if (delay > 0) {
                    timer = setTimeout(() => {
                        // 🚀 Just call again → `getCurrentShift` will pick the next shift automatically
                        getAllShifts();
                    }, delay);
                }
            } catch (err) {
                console.error("Error in getAllShifts:", err);
            }
        };

        getAllShifts();

        interval = setInterval(() => {
            getAllShifts();
        }, 60 * 1000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [selectedMachine]);


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
            setfilteredResult([]);
            const currentShift = getCurrentShift(allShifts);
            let chosenShiftNo = currentShift?.shift_no || (options.length > 0 ? options[0].value : null);
            if (chosenShiftNo) {
                setSelectedShift(chosenShiftNo);
                const { fromEpoch, toEpoch } = getEpochFromShift2(chosenShiftNo, dayjs(), allShifts);
                setEpochRange({ from: fromEpoch, to: toEpoch });
                const data = await downtimereason({
                    shiftNo: chosenShiftNo,
                    selectedDate: dayjs(),
                    fromEpoch,
                    toEpoch,
                    deviceId: deviceid,
                });
                setfilteredResult([...data].reverse());
                setopenDownTimeModal(true);
                console.log(data, 'data for the table')
            } else {
                console.warn("⚠️ No active shift found right now");
            }
        } catch (err) {
            console.error("Error in openDownTime:", err);
        } finally {
            setLoading(false);
        }
    };


    const [reasonsList2, setReasonsList2] = useState([])

    useEffect(() => {
        const getReasons = async () => {
            try {
                const response = await customerbasedshift(
                    "690d2210-8a3a-11f0-a3ac-9b534c07af2b",
                    "reason"
                );
                const reasons = response?.[0]?.value || [];
                setReasonsList2(reasons);
            } catch (err) {
                console.error("Error fetching reasons:", err);
            }
        };
        getReasons();
    }, []);

const [idleStartTime, setIdleStartTime] = useState(null);
const [activeReason, setActiveReason] = useState(null); // store reason until running again

useEffect(() => {
    if (!selectedMachine || !deviceNameIdJson[selectedMachine]) return;
    const deviceId = deviceNameIdJson[selectedMachine];

    const refreshData = async () => {
        try {
            // fetch telemetry (already getting machine_status)
            const data = await fetchTelemetry(deviceId);

            // latest machine status
            const machineStatusArray = data?.machine_status || [];
            const latestStatusCode = parseInt(machineStatusArray[0]?.value || 0, 10);
            const machineStatus = statusText(latestStatusCode);

            // lock_status check
            const response = await getMachineLock("DEVICE", deviceId, {
                keys: "lock_status",
            });
            const lockValue = response?.lock_status?.[0]?.value || "";
            const locked = String(lockValue).toLowerCase() === "locked";

            /* ---------------- When Machine Locks ---------------- */
if (locked && !isLocked) {
    setIsLocked(true);

    // find last Idle/Alarm event before lock
    const lastIdleOrAlarm = machineStatusArray.find(
        (item) => ["0", "1", "2", "5"].includes(String(item.value))
    );

    // use true idle/alarm start time, fallback to popup time
    const idleStart = lastIdleOrAlarm ? lastIdleOrAlarm.ts : dayjs().valueOf();
    setIdleStartTime(idleStart);

    console.log("Idle/Alarm started at:", idleStart);

    const reasonOptions = reasonsList2
        .map(
            (r) =>
                `<option value="${r.id}">${r.reason
                    .charAt(0)
                    .toUpperCase()}${r.reason.slice(1)}</option>`
        )
        .join("");

    Swal.fire({
        icon: "info",
        title: "Machine Locked",
        html: `
            <p>Machine has been locked due to downhold threshold reached.</p>
            <label for="reason">Select Reason:</label>
            <select id="reason" class="swal2-select">
              <option value="">-- Select --</option>
              ${reasonOptions}
            </select>
          `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCancelButton: false,
        confirmButtonText: "Submit",
        width: "auto",
        preConfirm: () => {
            const reasonId = document.getElementById("reason").value;
            if (!reasonId) {
                Swal.showValidationMessage("Please select a reason");
                return false;
            }
            return reasonsList2.find((r) => r.id === reasonId);
        },
    }).then((result) => {
        if (result.isConfirmed) {
            const selectedReason = result.value;
            setActiveReason(selectedReason);

            Swal.fire({
                icon: "question",
                title: "Confirm Submission",
                text: `You selected:  ${selectedReason.reason.charAt(0).toUpperCase()}${selectedReason.reason.slice(1)}. Do you want to confirm?`,
                showCancelButton: true,
                confirmButtonText: "Yes, Submit",
                cancelButtonText: "No, Go Back",
                allowOutsideClick: false,
                allowEscapeKey: false,
            }).then(async (confirmResult) => {
                if (confirmResult.isConfirmed) {
                    const payload = {
                        ts: idleStart, // ✅ true start time
                        values: {
                            live_reason: {
                                name: selectedReason.reason,
                                code: selectedReason.code || "",
                                mode: selectedReason.mode || "",
                                module: selectedReason.module || "",
                                idle_start: idleStart,
                                idle_end: 0,
                                idle_duration: 0,
                            },
                        },
                    };
                    try {
                        await operatorTelemetry("DEVICE", deviceId, payload);
                        await operatorTelemetry("DEVICE", deviceId, {
                            lock_status: "unlocked",
                        });

                        Swal.fire({
                            icon: "success",
                            title: "Submitted!",
                            text: "Reason submitted successfully.",
                            timer: 1500,
                            showConfirmButton: false,
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                        });
                    } catch (err) {
                        console.error("Error submitting reason:", err);
                        Swal.fire({
                            icon: "error",
                            title: "Error",
                            text: "Failed to submit reason. Please try again.",
                        });
                    }
                } else {
                    setIsLocked(false);
                    setIdleStartTime(null);
                    setActiveReason(null);
                }
            });
        }
    });
}

            /* ---------------- When Machine Back to Running ---------------- */
            if (machineStatus.toLowerCase() === "running" && idleStartTime && activeReason) {
                // find first running event after idle_start
                const runningEvent = machineStatusArray.find(
                    (item) => item.value === "3" && item.ts > idleStartTime
                );

                if (runningEvent) {
                    const idleEndTime = runningEvent.ts;
                    const duration = Math.floor((idleEndTime - idleStartTime) / 1000); 
                    const payload = {
                        ts: idleEndTime,
                        values: {
                            live_reason: {
                                name: activeReason.reason,
                                code: activeReason.code || "",
                                mode: activeReason.mode || "",
                                module: activeReason.module || "",
                                idle_start: idleStartTime,
                                idle_end: idleEndTime,
                                idle_duration: duration,
                            },
                        },
                    };

                    try {
                        await operatorTelemetry("DEVICE", deviceId, payload);
                    } catch (err) {
                        console.error("Error submitting idle end:", err);
                    }

                    // reset
                    setIdleStartTime(null);
                    setActiveReason(null);
                    setIsLocked(false);
                }
            }
        } catch (err) {
            console.error("Error refreshing telemetry/lock:", err);
        }
    };

    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
}, [selectedMachine, deviceNameIdJson, isLocked, reasonsList2, idleStartTime, activeReason]);

useEffect(() => {
  if (!telemetry.liveOperator || !operators.length) return;
  const found = operators.find(op => String(op.id) === String(telemetry.liveOperator));
  if (found) setSelectedOperator(found.id);
}, [telemetry.liveOperator, operators]);

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
                    ts: item.start,
                    values: {
                        live_reason: {
                            name: item.reasonselected,
                            code: code,
                            mode: mode,
                            module: module,
                            idle_start: item.start,
                            idle_end: item.end,
                            idle_duration: item.duration
                        }
                    }
                };
                await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
                setDeviceThresholds(prev => ({
                    ...prev,
                    [selectedDeviceId.id || selectedDeviceId]: item.reasonselected
                }));
            }
            Swal.fire({
                icon: "success",
                title: "Success",
                text: 'Reasons assigned successfully.',
                timer: 1500,
                showConfirmButton: false,
            });

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

    useEffect(() => {
        const init = async () => {
            try {
                const secondUsername = "pms@gmail.com";
                const secondPassword = "pmspms";
                const secondResponse = await Loginapi(secondUsername, secondPassword);
                localStorage.setItem("email1", secondUsername);
                localStorage.setItem("token1", secondResponse.token);
                localStorage.setItem("refreshToken1", secondResponse.refreshToken);
                localStorage.setItem("Companyname1", secondResponse.Companyname);
                localStorage.setItem("role_name1", secondResponse.Role);
                startTokenAutoRefresh();
                await fetchDevices();
                const operatorResponse = await getOperatorDetails(
                    "690d2210-8a3a-11f0-a3ac-9b534c07af2b"
                );
                const responseData = operatorResponse?.[0]?.value || [];
                const mappedOperators = responseData.map((op) => ({
                    id: op.operatorid,
                    name: op.operatorname,
                }));
                setOperators(mappedOperators);
            } catch (err) {
                console.error("Init failed", err);
            }
        };
        init();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setDate(dayjs().format("DD-MM-YYYY"));
            setTime(dayjs().format("HH:mm:ss"));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

const handleConfirm = () => {
    if (confirmType === "machine") {
        setSelectedMachine(pendingMachine);
        localStorage.setItem("selectedMachine", pendingMachine);
    } else if (confirmType === "operator") {
        setSelectedOperator(pendingOperator);
        postOperator(pendingOperator);
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

    const postOperator = async (pendingOperator) => {
        try {
            const deviceId = deviceNameIdJson[selectedMachine];
            const startTime = dayjs().valueOf();
            const operatorName = operators.find(res => res.id == pendingOperator)?.name;
            const previousOperator = JSON.parse(localStorage.getItem('operator_details'));
            if (previousOperator) {
                const updatedPrevOperator = {
                    ...previousOperator,
                    end_time: startTime,
                    duration: Math.floor((startTime - previousOperator.start_time) / 1000)
                };
                const prevPayload = {
                    ts: dayjs().valueOf(),
                    values: { live_operator: updatedPrevOperator }
                };
                await operatorTelemetry('DEVICE', deviceId, prevPayload);
            }
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
            await operatorTelemetry('DEVICE', deviceId, payload);
            localStorage.setItem('operator_details', JSON.stringify(payload.values.live_operator));
        } catch (err) {
            console.error('operator api failure', err);
        }
    };

    const formattedReasons = reasons.map(reason => ({
        ...reason,
        label: reason.label.charAt(0).toUpperCase() + reason.label.slice(1)
    }));

    const handleConfirmAlert = () => {
        Swal.fire({
            title: "Confirm Change",
            text:
                confirmType === "machine"
                    ? `Are you sure you want to change the machine to "${pendingMachine}"?`
                    : `Are you sure you want to change the operator to "${operators.find((o) => o.id === pendingOperator)?.name || ""
                    }"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#F99022",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Confirm",
            cancelButtonText: "Cancel",
        }).then((result) => {
            if (result.isConfirmed) {
                handleConfirm();
            } else {
                handleCancel();
            }
        });
    };

    const handleRejectParts = async (deviceId, initialCount = 0) => {
        let rejectCount = initialCount;
        await Swal.fire({
            title: "Reject Parts",
            html: `
      <div style="display:flex; align-items:center; justify-content:center; gap:30px;">
        <button id="decrement" 
          style="width:50px;height:50px;border-radius:50%;font-size:24px;font-weight:bold;background:#f56565;color:white;border:none;cursor:pointer;">-</button>
        <span id="counterValue" style="font-size:28px; font-weight:bold; min-width:50px; text-align:center;">${rejectCount}</span>
        <button id="increment" 
          style="width:50px;height:50px;border-radius:50%;font-size:24px;font-weight:bold;background:#48bb78;color:white;border:none;cursor:pointer;">+</button>
      </div>
    `,
            showCancelButton: true,
            confirmButtonText: "Continue",
            cancelButtonText: "Cancel",
            didOpen: () => {
                const counterEl = Swal.getHtmlContainer().querySelector("#counterValue");
                const incBtn = Swal.getHtmlContainer().querySelector("#increment");
                const decBtn = Swal.getHtmlContainer().querySelector("#decrement");
                const produced = telemetry.goodParts || 0;
                const alreadyRejected = telemetry.scrap || 0;
                const maxReject = produced - alreadyRejected;
                incBtn.addEventListener("click", () => {
                    if (rejectCount < maxReject) {
                        rejectCount++;
                        counterEl.textContent = rejectCount;
                    } else {
                        Swal.showValidationMessage(`Cannot exceed ${maxReject} parts`);
                    }
                });
                decBtn.addEventListener("click", () => {
                    if (rejectCount > 0) {
                        rejectCount--;
                        counterEl.textContent = rejectCount;
                    }
                });
            },
            preConfirm: () => {
                if (rejectCount <= 0) {
                    Swal.showValidationMessage("Please select at least 1 reject part");
                    return false;
                }
                return rejectCount;
            },
        }).then(async (result) => {
            if (result.isConfirmed) {
                const count = result.value;

                // Step 2: Confirmation
                Swal.fire({
                    title: "Confirm Rejection",
                    text: `Are you sure you want to reject ${count} part(s)?`,
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Yes, Reject",
                    cancelButtonText: "No, Go Back",
                }).then(async (confirmResult) => {
                    if (confirmResult.isConfirmed) {
                        try {
                            // Step 3: API call
                            const payload = { ts: dayjs().valueOf(), values: { rejection_id: count } };
                            await operatorTelemetry("DEVICE", deviceId, payload);

                            Swal.fire({
                                icon: "success",
                                title: "Success",
                                text: `${count} part(s) rejected successfully.`,
                                timer: 2000,
                                showConfirmButton: false,
                            });
                        } catch (err) {
                            console.error("Reject API failed:", err);
                            Swal.fire("Error", "Failed to reject parts. Try again.", "error");
                        }
                    } else if (confirmResult.dismiss === Swal.DismissReason.cancel) {
                        // 👈 Reopen with the same count
                        handleRejectParts(deviceId, count);
                    }
                });
            }
        });
    };

    return (
        <div className="operator-screen">
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
                        <FaRegCalendarAlt className="icon" style={{color:'#F99022'}}/>
                        <p className='date-label'>Date: </p>
                        <p className='date-label'>{date}</p>
                    </div>

                    <div className="calendar">
                        <FaRegClock  className='icon' style={{color:'#F99022'}}/>
                        <p className='date-label'>Time: </p>
                        <p className='date-label'>{time}</p>
                    </div>
                </div>
            </div>
            <div className="header-2" style={{ background: telemetry.machineColor }}>
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
                        <p>Status: {telemetry.machineStatus.charAt(0).toUpperCase() + telemetry.machineStatus.slice(1)}
</p>
                    </div>

                </div>
            </div>
            <div className="content">
                <div className="contect-section" style={{ width: '10rem' }}>
                    <VerticalProgress
                        shiftNo={currentShift?.shift_no}
                        shiftStart={currentShift?.start_time}
                        shiftEnd={currentShift?.end_time}
                        firstActive={telemetry?.firstActive}
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
      value={selectedOperator || ""}
      onChange={(e) => {
        setPendingOperator(e.target.value);
        setConfirmType("operator");
      }}
      displayEmpty
      renderValue={(selected) => {
        if (!selected) {
          return <span style={{ color: "#f99022" }}>No operator assigned</span>;
        }
        const operator = operators.find(op => String(op.id) === String(selected));
        return operator ? operator.name : "";
      }}
      disableUnderline
    >
      <MenuItem disabled value="">
        No operator assigned
      </MenuItem>
      {operators.map((op) => (
        <MenuItem key={op.id} value={op.id}>
          {op?.name[0]?.toUpperCase() + op?.name?.slice(1)?.toLowerCase()}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
</div>

                </div>
                <div className="contect-section">
                    <p style={{textAlign: 'center'}}>
                        {telemetry.jobName }
                    </p>
                    <div style={{ textAlign: "end", marginTop: "0.2rem" }}>
                        <p className="actual">Actual vs Target</p>
                        <p className="actual-value">
                            {telemetry.goodParts}/{telemetry.targetParts}
                        </p>
                    </div>
                </div>
            </div>
            <div className="footer1">
                <div className="footer-left" onClick={() => handleRejectParts(deviceNameIdJson[selectedMachine])}>
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
<DialogTitle style={{ textAlign: "center"}}>
  Assign Reason
</DialogTitle>                <DialogContent>
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
            {confirmType && handleConfirmAlert()}
        </div>
    );
}

export default Operator;


