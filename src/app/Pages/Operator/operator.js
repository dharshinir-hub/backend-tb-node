import './operator.css';
import logo from '../../../assets/yantraimage.png';
import { FaRegClock, FaRegCalendarAlt } from "react-icons/fa";
import { FaPause } from "react-icons/fa6";
import { RxCross2 } from "react-icons/rx";
import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import Swal from 'sweetalert2';
import { customerbaseddevices, customerbasedshift, Deviceattributeget, Downtimeadd1, getCustomerUsers, getFirstMachineActive, getMachineLock, operatorTelemetry, telemetrykeydata } from '../../Services/app/operatorservice'
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
import { ROLE_OPERATOR } from '../../Shared/constants/role'
import { getOperatorDetails, Loginapi, startTokenAutoRefresh } from '../../Services/app/loginservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import CircularProgress from '../../Shared/Pages/circularprogress/circularprogress';
import VerticalProgress from '../../Shared/Pages/verticalprogress/verticalprogress';
import { useLocation } from 'react-router-dom';

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
    const location = useLocation();
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
    const customerId1 = localStorage.getItem('CustomerID');

    const getCustomerId = () => {
        if (location.pathname === "/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV") {
            return window._env_.CUSTOMER_ID;
        } else if (location.pathname === "/smc_operator_bf9tz") {
            return window._env_.SMC_CUSTOMER_ID;
        } else {
            const customerIdStr = localStorage.getItem('CustomerID');
            try {
                return JSON.parse(customerIdStr);
            } catch (error) {
                console.error('Error parsing CustomerID from localStorage:', error);
                return customerIdStr;
            }
        }
    };
    const fetchDevices = async () => {
        try {
            const customerId = getCustomerId();
            const result = await customerbaseddevices(customerId, 1000, 0);
            const devicesList = result.data || [];
            setMachines(devicesList.map((d) => d.name));
            const nameIdMap = devicesList.reduce((acc, device) => {
                acc[device.name] = device.id.id;
                return acc;
            }, {});
            setDeviceNameIdJson(nameIdMap);
            const machineInfo = JSON.parse(localStorage.getItem("machineInfo"));
            if (machineInfo?.machine_name && machineInfo?.machine_id) {
                setSelectedMachine(machineInfo.machine_name);
            } else if (devicesList.length > 0) {
                const savedMachine = localStorage.getItem("selectedMachine");
                if (savedMachine && devicesList.some((d) => d.name === savedMachine)) {
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

    function getShiftEpoch(startTime = "06:00", endTime = "14:00") {
        const now = dayjs();
        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);
        let shiftStart = dayjs().hour(startH).minute(startM).second(0).millisecond(0);
        let shiftEnd = dayjs().hour(endH).minute(endM).second(0).millisecond(0);
        if (shiftEnd.isBefore(shiftStart)) {
            if (now.isBefore(shiftEnd)) {
                shiftStart = shiftStart.subtract(1, "day");
            } else {
                shiftEnd = shiftEnd.add(1, "day");
            }
        }
        const shiftStartEpoch = shiftStart.valueOf();
        const shiftEndEpoch = shiftEnd.valueOf();
        const nowEpoch = now.valueOf();
        const progress = Math.min(Math.max(((nowEpoch - shiftStartEpoch) / (shiftEndEpoch - shiftStartEpoch)) * 100, 0), 100);
        return { shiftStart: shiftStartEpoch, shiftEnd: shiftEndEpoch, now: nowEpoch, progress };
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


    // const fetchOperators = async () => {
    //   try {
    //     let operatorList = [];

    //     if (location.pathname === "/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV") {
    //       const res = await customerbasedshift(getCustomerId(), "alloperator");
    //       const allData = res?.[0]?.value || [];
    //       operatorList = allData
    //         .filter(o => o?.mode?.toLowerCase() === 'operator')
    //         .map(op => ({ id: op.operatorid, name: op.operatorname }));
    //     } else {
    //       // 👤 From user list API
    //       const res = await getCustomerUsers(customerId1);
    //       const users = res.data || [];
    //       const parsedUsers = users.map(u => {
    //         let desc = "";
    //         try {
    //           desc = u.additionalInfo?.description
    //             ? JSON.parse(u.additionalInfo.description)
    //             : "";
    //         } catch {
    //           desc = u.additionalInfo?.description || "";
    //         }
    //         return { ...u, userDetails: desc };
    //       });

    //       operatorList = parsedUsers
    //         .filter(u => u.userDetails?.mode?.toLowerCase() === 'operator')
    //         .map(u => ({ id: u.userDetails?.userId, name: u.firstName }));
    //     }
    //     setOperators(operatorList);
    //   } catch (error) {
    //     console.error("Error fetching operators:", error);
    //     setOperators([]);
    //   }
    // };

    const fetchOperators = async () => {
        try {
            let operatorList = [];
            const res = await customerbasedshift(getCustomerId(), "alloperator");
            const allData = res?.[0]?.value || [];
            operatorList = allData
                .filter(o => o?.mode?.toLowerCase() === 'operator')
                .map(op => ({ id: op.operatorid, name: op.operatorname }));
            setOperators(operatorList);
        } catch (error) {
            console.error("Error fetching operators:", error);
            setOperators([]);
        }
    };



    const fetchTelemetry = async (deviceId) => {
        try {
            const response = await customerbasedshift(
                getCustomerId(),
                "allShift"
            );
            const shifts = response[0]?.value || [];
            setShifts(shifts);
            const currentActiveShift = await getCurrentShift(shifts, dayjs());
            const { shiftStart, now } = getShiftEpoch(currentActiveShift?.start_time);
            await fetchOperators();
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
            const targetParts = parseInt(getLatest("targetparts") || 0, 10);
            const totalParts = getLatest("totalparts", true);
            const { totalshots = 0, goodparts = 0, scrap = 0, ncr = 0 } = totalParts;
            const liveComponent = getLatest("live_component", true);
            const jobName = liveComponent.name || "Route card not assigned";
            const jobCode = liveComponent.code || "";
            const liveOperator = getLatest("live_operator", true);
            const liveOperatorCode = liveOperator?.code || null;
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

    const downtimereason = async ({ shiftNo, selectedDate, fromEpoch, toEpoch, deviceId }) => {
        if (!deviceId || !shiftNo || !selectedDate || !fromEpoch || !toEpoch) return [];

        const fromTime = fromEpoch;
        const toTime = toEpoch;

        try {
            // Fetch machine status
            const machineStatusResponse = await telemetrykeydata(deviceId, "DEVICE", "machine_status", fromTime, toTime);
            const machineData = machineStatusResponse?.machine_status || [];

            // Sort and transform machine status
            const sortedData = [...machineData].sort((a, b) => Number(a.ts) - Number(b.ts));
            const transformedData = sortedData
                .filter(item => item.ts && item.value !== undefined)
                .map(item => ({ ts: item.ts, value: item.value }));

            // Extract idle segments (0,1,2 -> Idle; 3 -> Run)
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
                    const lastKnownTs = data.length > 0 ? data[data.length - 1].ts : fromTime;
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

            // Apply downtime threshold
            const key = "downtime_threasold";
            const results = await Deviceattributeget(deviceId, key);
            let filteredResult = [];
            if (results && results.length > 0) {
                const downtime = results[0].value;
                const result = extractStartEndFromOneToThree(transformedData);
                filteredResult = result.filter(entry => entry.duration > downtime);
            }

            // Fetch live reasons
            const response = await telemetrykeydata(deviceId, "DEVICE", "live_reason", fromEpoch, toEpoch);
            if (response?.live_reason?.length > 0) {
                const parsedLiveReasons = response.live_reason
                    .map(entry => {
                        try { return { ts: entry.ts, ...JSON.parse(entry.value) }; }
                        catch { return null; }
                    })
                    .filter(Boolean);

                // Make a copy to track unused reasons
                const unusedLiveReasons = [...parsedLiveReasons];

                filteredResult = filteredResult.map(item => {
                    // Only assign a reason if the idle segment truly overlaps the live_reason
                    const index = unusedLiveReasons.findIndex(reason => {
                        const reasonStart = Number(reason.idle_start);
                        const reasonEnd = reason.idle_end && reason.idle_end !== 0 ? Number(reason.idle_end) : reasonStart;
                        return reasonStart <= item.end && reasonEnd >= item.start;
                    });

                    let reasonName = "";
                    if (index !== -1) {
                        reasonName = unusedLiveReasons[index].name;
                        unusedLiveReasons.splice(index, 1); // mark as used
                    }

                    return { ...item, reasonselected: reasonName || item.reasonselected || "" };
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
                    getCustomerId(),
                    "allShift"
                );
                const shifts = response[0]?.value || [];
                setShifts(shifts);
                const currentActiveShift = await getCurrentShift(shifts, dayjs());
                if (!currentActiveShift) return;

                const formattedShift = {
                    ...currentActiveShift,
                    start_time: currentActiveShift.start_time.slice(0, 5),
                    end_time: currentActiveShift.end_time.slice(0, 5),
                };
                setCurrentShift(formattedShift);
                const startTime = dayjs(`${dayjs().format("YYYY-MM-DD")} ${formattedShift.start_time}`, "YYYY-MM-DD HH:mm");
                let endTime = dayjs(`${dayjs().format("YYYY-MM-DD")} ${formattedShift.end_time}`, "YYYY-MM-DD HH:mm");
                if (currentActiveShift.start_day !== currentActiveShift.end_day) {
                    endTime = endTime.add(1, "day");
                }

                const now = dayjs();
                const delay = endTime.diff(now);

                if (delay > 0) {
                    timer = setTimeout(() => {
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
        const customerId = getCustomerId();
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
                const { shiftStart: fromEpoch, now: toEpoch } = getShiftEpoch(currentShift?.start_time);
                setEpochRange({ from: fromEpoch, to: toEpoch });
                const data = await downtimereason({
                    shiftNo: chosenShiftNo,
                    selectedDate: dayjs(),
                    fromEpoch,
                    toEpoch,
                    deviceId: deviceid,
                });
                console.log([...data].reverse(), 'data table')
                setfilteredResult([...data].reverse());
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


    const [reasonsList2, setReasonsList2] = useState([])

    useEffect(() => {
        const getReasons = async () => {
            try {
                const response = await customerbasedshift(getCustomerId(), "reason");
                const reasons = response?.[0]?.value || [];
                setReasonsList2(reasons);
            } catch (err) {
                console.error("Error fetching reasons:", err);
            }
        };
        getReasons();
        const interval = setInterval(getReasons, 5000);
        return () => clearInterval(interval);
    }, []);

    const [idleStartTime, setIdleStartTime] = useState(null);

    // near top of component

    // near top of component
    // --- refs only ---
    const prevStatusRef = useRef(null);
    const lockedIdleStartRef = useRef(null);
    const activeReasonRef = useRef(null);
    const isLockedRef = useRef(false);

    // On mount, restore any locked idle info from localStorage
    useEffect(() => {
        const savedLockedIdleStart = localStorage.getItem("lockedIdleStartTime");
        const savedActiveReason = localStorage.getItem("activeReason");

        if (savedLockedIdleStart && savedActiveReason) {
            lockedIdleStartRef.current = Number(savedLockedIdleStart);
            activeReasonRef.current = JSON.parse(savedActiveReason);
            isLockedRef.current = true;
            console.log("[INIT] restored locked idle from storage", savedLockedIdleStart, savedActiveReason);
        }
    }, []);


    function parseShifts(allShifts) {
        return allShifts.map(shift => {
            const today = dayjs();
            const startDayOffset = shift.start_day - 1;
            const endDayOffset = shift.end_day - 1;
            let startTs = dayjs(today)
                .startOf("day")
                .add(startDayOffset, "day")
                .hour(Number(shift.start_time.split(":")[0]))
                .minute(Number(shift.start_time.split(":")[1]))
                .second(Number(shift.start_time.split(":")[2]));
            let endTs = dayjs(today)
                .startOf("day")
                .add(endDayOffset, "day")
                .hour(Number(shift.end_time.split(":")[0]))
                .minute(Number(shift.end_time.split(":")[1]))
                .second(Number(shift.end_time.split(":")[2]));
            if (endTs.isBefore(startTs)) {
                endTs = endTs.add(1, "day");
            }
            return {
                shift_no: shift.shift_no,
                startTs: startTs.valueOf(),
                endTs: endTs.valueOf(),
            };
        });
    }

    function splitIdleByShifts(idleStart, idleEnd, shifts) {
        const segments = [];
        shifts.forEach((shift) => {
            const overlapStart = Math.max(idleStart, shift.startTs);
            const overlapEnd = Math.min(idleEnd, shift.endTs);
            if (overlapStart < overlapEnd) {
                segments.push({
                    shift_no: shift.shift_no,
                    start: overlapStart,
                    end: overlapEnd
                });
            }
        });

        return segments;
    }

    useEffect(() => {
        if (!selectedMachine || !deviceNameIdJson[selectedMachine]) return;
        const deviceId = deviceNameIdJson[selectedMachine];
        const openReasonSwal = (idleStart, reasonsList2, previousReason = null) => {
            const reasonOptions = reasonsList2
                .map(
                    r =>
                        `<option value="${r.id}" ${previousReason?.id === r.id ? "selected" : ""
                        }>${r.reason}</option>`
                )
                .join("");

            Swal.fire({
                icon: "info",
                title: "Machine Locked",
                html: `<p>Machine has been locked due to downhold threshold reached.</p>
             <label for="reason">Select Reason:</label>
             <select id="reason" class="swal2-select">
               <option value="">-- Select --</option>
               ${reasonOptions}
             </select>`,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showCancelButton: false,
                confirmButtonText: "Submit",
                preConfirm: () => {
                    const reasonId = document.getElementById("reason").value;
                    if (!reasonId) {
                        Swal.showValidationMessage("Please select a reason");
                        return false;
                    }
                    return reasonsList2.find(r => r.id === reasonId);
                },
            }).then(result => {
                if (result.isConfirmed) {
                    const selectedReason = result.value;
                    activeReasonRef.current = selectedReason;
                    localStorage.setItem("lockedIdleStartTime", idleStart);
                    localStorage.setItem("activeReason", JSON.stringify(selectedReason));

                    Swal.fire({
                        icon: "question",
                        title: "Confirm Submission",
                        text: `You selected: ${selectedReason.reason}. Do you want to confirm?`,
                        showCancelButton: true,
                        confirmButtonText: "Yes, Submit",
                        cancelButtonText: "No, Go Back",
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                    }).then(async confirmResult => {
                        if (confirmResult.isConfirmed) {
                            const payload = {
                                ts: idleStart,
                                values: {
                                    live_reason: {
                                        name: selectedReason.reason,
                                        code: selectedReason.code || "",
                                        mode: selectedReason.mode || "",
                                        category: selectedReason.category || "",
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
                                console.log(
                                    "[LOCKED_IDLE] reason submitted, machine unlocked, waiting for running to close idle"
                                );
                                Swal.fire({
                                    icon: "success",
                                    title: "Submitted!",
                                    text: "Reason submitted successfully.",
                                    timer: 1500,
                                    showConfirmButton: false,
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
                            openReasonSwal(idleStart, reasonsList2, selectedReason);
                        }
                    });
                }
            });
        };

        const refreshData = async (checkRestore = false) => {
            try {
                const data = await fetchTelemetry(deviceId);
                let machineStatusArray = data?.machine_status || [];
                if (!machineStatusArray.length) return;
                machineStatusArray = machineStatusArray
                    .slice()
                    .sort((a, b) => b.ts - a.ts);
                const latestSample = machineStatusArray[0];
                const latestValue = String(latestSample?.value ?? "").trim();
                const latestStatusText = statusText(
                    parseInt(latestValue || "0", 10)
                ).toLowerCase();
                console.log(
                    "[refreshData] latestValue:",
                    latestValue,
                    "latestStatus:",
                    latestStatusText
                );
                const response = await getMachineLock("DEVICE", deviceId, {
                    keys: "lock_status",
                });
                const lockValue = response?.lock_status?.[0]?.value || "";
                const locked = String(lockValue).toLowerCase() === "locked";
                if (!locked && isLockedRef.current) {
                    console.log("[refreshData] unlocking via lock API");
                    isLockedRef.current = false;
                    Swal.close();
                }
                if (locked && !isLockedRef.current) {
                    console.log("[refreshData] detected lock -> opening Swal");
                    isLockedRef.current = true;
                    let lastIdleOrAlarm = null;
                    for (let i = 0; i < machineStatusArray.length - 1; i++) {
                        const current = machineStatusArray[i];
                        const next = machineStatusArray[i + 1];
                        if (String(next.value) === "3" && ["0", "1", "2", "5"].includes(String(current.value))) {
                            lastIdleOrAlarm = current;
                            break;
                        }
                    }
                    if (!lastIdleOrAlarm) {
                        lastIdleOrAlarm = machineStatusArray.find(item =>
                            ["0", "1", "2", "5"].includes(String(item.value))
                        );
                    }
                    const idleStart = lastIdleOrAlarm
                        ? lastIdleOrAlarm.ts
                        : dayjs().valueOf();
                    lockedIdleStartRef.current = idleStart;
                    console.log("[LOCKED_IDLE START] at", idleStart);
                    let previousReason = null;
                    const savedReason = localStorage.getItem("activeReason");
                    if (savedReason) {
                        try {
                            previousReason = JSON.parse(savedReason);
                        } catch (e) {
                            previousReason = null;
                        }
                    }
                    openReasonSwal(idleStart, reasonsList2, previousReason);
                }
                if (checkRestore && locked) {
                    const savedIdleStart = localStorage.getItem("lockedIdleStartTime");
                    const savedReason = localStorage.getItem("activeReason");
                    if (savedIdleStart && savedReason) {
                        try {
                            const parsedReason = JSON.parse(savedReason);
                            lockedIdleStartRef.current = parseInt(savedIdleStart, 10);
                            activeReasonRef.current = parsedReason;
                            isLockedRef.current = true;
                            console.log("[RESTORE] Reopening Swal after refresh with saved reason");
                            openReasonSwal(lockedIdleStartRef.current, reasonsList2, parsedReason);
                        } catch (e) {
                            console.error("Failed to restore reason from localStorage:", e);
                        }
                    }
                }
                const prevStatus = prevStatusRef.current;
                if (prevStatus !== latestStatusText) {
                    console.log(
                        `[refreshData] status changed ${prevStatus} -> ${latestStatusText}`
                    );
                }
                if (
                    latestStatusText === "running" &&
                    lockedIdleStartRef.current &&
                    activeReasonRef.current
                ) {
                    const runningEvent =
                        machineStatusArray.find(
                            item =>
                                String(item.value) === "3" &&
                                item.ts >= lockedIdleStartRef.current
                        ) || latestSample;
                    if (runningEvent) {
                        const idleEndTime = runningEvent.ts;
                        const duration = Math.floor(
                            (idleEndTime - lockedIdleStartRef.current) / 1000
                        );
                        const parsedShifts = generateShiftInstances(lockedIdleStartRef.current,
                            idleEndTime, shifts);
                        const segments = splitIdleByShifts(
                            lockedIdleStartRef.current,
                            idleEndTime,
                            parsedShifts
                        );
                        for (const seg of segments) {
                            const payload = {
                                ts: seg.start,
                                values: {
                                    live_reason: {
                                        name: activeReasonRef.current.reason,
                                        code: activeReasonRef.current.code || "",
                                        mode: activeReasonRef.current.mode || "",
                                        category: activeReasonRef.current.category || "",
                                        idle_start: seg.start,
                                        idle_end: seg.end,
                                        idle_duration: Math.floor((seg.end - seg.start) / 1000),
                                    },
                                },
                            };
                            try {
                                await operatorTelemetry("DEVICE", deviceId, payload);
                            } catch (err) {
                                console.error("Error submitting locked idle end:", err);
                            }
                        }

                        // console.log(
                        //     "[LOCKED_IDLE END] closing at",
                        //     idleEndTime,
                        //     "duration(s):",
                        //     duration
                        // );
                        // const payload = {
                        //     ts: idleEndTime,
                        //     values: {
                        //         live_reason: {
                        //             name: activeReasonRef.current.reason,
                        //             code: activeReasonRef.current.code || "",
                        //             mode: activeReasonRef.current.mode || "",
                        //             category: activeReasonRef.current.category || "",
                        //             idle_start: lockedIdleStartRef.current,
                        //             idle_end: idleEndTime,
                        //             idle_duration: duration,
                        //         },
                        //     },
                        // };
                        // try {
                        //     await operatorTelemetry("DEVICE", deviceId, payload);
                        // } catch (err) {
                        //     console.error("Error submitting locked idle end:", err);
                        // }

                        lockedIdleStartRef.current = null;
                        activeReasonRef.current = null;
                        isLockedRef.current = false;
                        localStorage.removeItem("lockedIdleStartTime");
                        localStorage.removeItem("activeReason");
                    }
                }

                prevStatusRef.current = latestStatusText;
            } catch (err) {
                console.error("Error refreshing telemetry/lock:", err);
            }
        };
        refreshData(true);
        const interval = setInterval(() => refreshData(false), 5000);
        return () => clearInterval(interval);
    }, [selectedMachine, deviceNameIdJson, reasonsList2]);

    function generateShiftInstances(startEpoch, endEpoch, shifts) {
        const startTimeOfDay = dayjs(startEpoch).hour() * 60 + dayjs(startEpoch).minute();
        const earliestShiftStart = Math.min(
            ...shifts.map((s) => {
                const [h, m] = s.start_time.split(":").map(Number);
                return h * 60 + m;
            })
        );
        const latestShiftEnd = Math.max(
            ...shifts.map((s) => {
                const [h, m] = s.end_time.split(":").map(Number);
                return h * 60 + m;
            })
        );
        const needsPreviousDay = startTimeOfDay < earliestShiftStart;
        const needsNextDay = (dayjs(endEpoch).hour() * 60 + dayjs(endEpoch).minute()) > latestShiftEnd;
        const startDate = dayjs(startEpoch)
            .startOf("day")
            .subtract(needsPreviousDay ? 1 : 0, "day");
        const endDate = dayjs(endEpoch)
            .endOf("day")
            .add(needsNextDay ? 1 : 0, "day");
        const result = [];
        let currentDate = startDate;
        while (currentDate.valueOf() <= endDate.valueOf()) {
            shifts.forEach((shift) => {
                const [startH, startM, startS] = shift.start_time.split(":").map(Number);
                const [endH, endM, endS] = shift.end_time.split(":").map(Number);
                let startTs = currentDate
                    .add(shift.start_day - 1, "day")
                    .hour(startH)
                    .minute(startM)
                    .second(startS);
                let endTs = currentDate
                    .add(shift.end_day - 1, "day")
                    .hour(endH)
                    .minute(endM)
                    .second(endS);
                if (endTs.isBefore(startTs)) endTs = endTs.add(1, "day");

                if (endTs.valueOf() >= startEpoch && startTs.valueOf() <= endEpoch) {
                    result.push({
                        shift_no: shift.shift_no,
                        startTs: startTs.valueOf(),
                        endTs: endTs.valueOf(),
                    });
                }
            });
            currentDate = currentDate.add(1, "day");
        }
        return result;
    }

    useEffect(() => {
        if (!operators.length) return;
        if (!telemetry.liveOperator) {
            setSelectedOperator("");
            return;
        }
        const found = operators.find(
            op => String(op.id) === String(telemetry.liveOperator)
        );
        if (found) {
            setSelectedOperator(found.id);
        } else {
            setSelectedOperator("");
        }
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
                const category = operator ? operator.category : null;
                const key = {
                    ts: item.start,
                    values: {
                        live_reason: {
                            name: item.reasonselected,
                            code: code,
                            mode: mode,
                            category: category,
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
        if (
            location.pathname !== "/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV" &&
            location.pathname !== "/smc_operator_bf9tz"
        ) {
            return;
        }
        const init = async () => {
            try {
                const secondUsername = window._env_.TENANT_GMAIL;
                const secondPassword = window._env_.TENANT_PASSWORD;
                const secondResponse = await Loginapi(secondUsername, secondPassword);
                localStorage.setItem("email1", secondUsername);
                localStorage.setItem("token1", secondResponse.token);
                localStorage.setItem("refreshToken1", secondResponse.refreshToken);
                localStorage.setItem("Companyname1", secondResponse.Companyname);
                localStorage.setItem("role_name1", secondResponse.Role);
                startTokenAutoRefresh();
                await fetchDevices();
            } catch (err) {
                console.error("Init failed", err);
            }
        };
        init();
    }, [location.pathname]);

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
                        code: pendingOperator,
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
        label: reason.label
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
                const produced = telemetry.totalShots || 0;
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
                        <FaRegCalendarAlt className="icon" style={{ color: '#F99022' }} />
                        <p className='date-label'>Date: </p>
                        <p className='date-label'>{date}</p>
                    </div>

                    <div className="calendar">
                        <FaRegClock className='icon' style={{ color: '#F99022' }} />
                        <p className='date-label'>Time: </p>
                        <p className='date-label'>{time}</p>
                    </div>
                </div>
            </div>
            <div className="header-2" style={{ background: telemetry.machineColor }}>
                <div className="machine-name">
                    <p>Machine:</p>
                    {(() => {
                        const machineInfo = JSON.parse(localStorage.getItem("machineInfo"));
                        if (machineInfo?.machine_name && machineInfo?.machine_id) {
                            // Show only the stored machine
                            return (
                                <div style={{ color: "white", marginLeft: "0.5rem" }}>
                                    {machineInfo.machine_name}
                                </div>
                            );
                        } else {
                            // Show dropdown
                            return (
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
                            );
                        }
                    })()}

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
                        actual={telemetry.totalShots}
                        target={telemetry.targetParts}
                        partsBehind={Math.max(0, telemetry.targetParts - telemetry.totalShots)}
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
                                        {op?.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>
                </div>
                <div className="contect-section">
                    <p style={{ textAlign: 'center' }}>
                        {telemetry.jobName}
                    </p>
                    <div style={{ textAlign: "end", marginTop: "0.2rem" }}>
                        <p className="actual">Actual vs Target</p>
                        <p className="actual-value">
                            {telemetry.totalShots}/{telemetry.targetParts}
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
                <DialogTitle style={{ textAlign: "center" }}>
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


