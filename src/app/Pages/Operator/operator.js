import './operator.css';
import logo from '../../../assets/yantraimage.png';
import { FaRegClock, FaRegCalendarAlt, FaBell } from "react-icons/fa";
import { FaPause } from "react-icons/fa6";
import { RxCross2 } from "react-icons/rx";
import React, { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import Swal from 'sweetalert2';
import { customerbaseddevices, customerbasedshift, Deviceattributeget, Downtimeadd1, getCustomerUsers, getFirstMachineActive, getMachineLock, operatorTelemetry, telemetrykeydata } from '../../Services/app/operatorservice';
import ReactDOMClient from 'react-dom/client';
import { keyframes } from "@mui/system";

import {
    FormControl,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Autocomplete,
    TextField,
    InputLabel,
    Checkbox,
    ListItemText,
    IconButton,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { ROLE_OPERATOR } from '../../Shared/constants/role'
import { getOperatorDetails, Loginapi, startTokenAutoRefresh } from '../../Services/app/loginservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import CircularProgress from '../../Shared/Pages/circularprogress/circularprogress';
import VerticalProgress from '../../Shared/Pages/verticalprogress/verticalprogress';
import { useLocation } from 'react-router-dom';
import { cleanCustomerId, shiftadd } from '../../Services/app/masterservice';
import DynamicSlidingKeyboard from '../../Shared/Pages/dynamicSlidingKeyboard/dynamicSlidingKeyboard';
import { getReportGenerate1, getReportToken } from '../../Services/app/reportservice';

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
    const CustomerEmail = localStorage.getItem("email");
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
    const [currentOperator, setCurrentOperator] = useState(null);
    const [pendingMachine, setPendingMachine] = useState("");
    const [pendingOperator, setPendingOperator] = useState("");
    const [confirmType, setConfirmType] = useState(null);
    const customerId1 = localStorage.getItem('CustomerID');
    const isSwalOpenRef = useRef(false);
    const [blueCardLogs, setBlueCardLogs] = useState([]);
    const [openBlueCardConfirm, setOpenBlueCardConfirm] = useState(false);
    const [requestPayload, setRequestPayload] = useState([]);
    const [isBlinking, setIsBlinking] = useState(false);
    const [blueCardText, setBlueCardText] = useState("Blue Card Push");
    const [openBlueCardSuccess, setOpenBlueCardSuccess] = useState(false);
    const [blueCardTimerStart, setBlueCardTimerStart] = useState(null);
    const [blueCardElapsed, setBlueCardElapsed] = useState(0);
    const blueCardTimerRef = useRef(null);
    const [routeCardNo, setRouteCardNo] = useState("");
    const [openReject, setOpenReject] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [existingCount, setExistingCount] = useState(0);
    const [rejectRows, setRejectRows] = useState([{ count: 0, reason: [], remark: "" }]);
    const [qualityReasonList, setQualityReasonList] = useState([]);
    const [isFetchingBluecard, setIsFetchingBluecard] = useState(false);
    const [prevOperatorData, setPrevOperatorData] = useState(null);
    const isValidRouteCard = /^[a-z0-9]+$/i.test(routeCardNo);
    const [openBlueCardResponse, setOpenBlueCardResponse] = useState(false);
    const [blueCardResponseData, setBlueCardResponseData] = useState(null);
    const prevRequestPayloadRef = useRef([]);
    const [blueCardNotifications, setBlueCardNotifications] = useState([]);
    const [showBlueCardNotif, setShowBlueCardNotif] = useState(false);
    const prevComponentCodeRef = useRef(null);
    const notifBellRef = useRef(null);
    const getCustomerId = () => {
        if (location.pathname === "/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV") {
            return window._env_.CUSTOMER_ID;
        } else if (location.pathname === "/smc_operator_bf9tz") {
            return window._env_.SMC_CUSTOMER_ID;
        } else if (location.pathname === "/atech_operator_atc67") {
            return window._env_.ATECH_CUSTOMER_ID;
        } else if (location.pathname === "/marks_operator_ch8st") {
            return window._env_.MARKS_CUSTOMER_ID;
        } else if (location.pathname === "/makino_operator_av5tc") {
            return window._env_.MAKINO_CUSTOMER_ID;
        } else if (location.pathname === "/demo_operator_av3tc") {
            return window._env_.DEMO_CUSTOMER_ID;
        } else if (location.pathname === "/gplast_operator_awe6tc") {
            return window._env_.GPLAST_CUSTOMER_ID;
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
    const isPMIBlueCardPage =
        location.pathname === "/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV" ||
        cleanCustomerId(getCustomerId()) === window._env_.CUSTOMER_ID;

    const isGplastCondition =
        location.pathname === "/gplast_operator_awe6tc" ||
        cleanCustomerId(getCustomerId()) === window._env_.GPLAST_CUSTOMER_ID;

    const isAtechCondition =
        location.pathname === "/atech_operator_atc67" ||
        cleanCustomerId(getCustomerId()) === window._env_.ATECH_CUSTOMER_ID;

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
            const qualityResult = await customerbasedshift(customerId, "qualityreason");
            setQualityReasonList(qualityResult?.[0]?.value || []);
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
            const { shiftStart, now, shiftEnd } = getShiftEpoch(currentActiveShift?.start_time, currentActiveShift?.end_time);
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
                endTs: shiftEnd || Date.now(),
            });
            const filteredData = {
                ...data,
                live_operator: (data.live_operator || []).filter(item => item.ts <= now),
                live_component: (data.live_component || []).filter(item => item.ts <= now),
            };
            const getLatest = (key, isJson = false) => {
                const arr = filteredData[key];
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
            const getLatestWithTs = (key, isJson = false) => {
                const arr = filteredData[key];
                if (!Array.isArray(arr) || arr.length === 0) return isJson ? {} : null;
                const value = arr[0];
                if (!isJson) return value;
                try {
                    return {
                        ts: value.ts,
                        value: JSON.parse(value.value)
                    };
                } catch (err) {
                    console.error(`Error parsing JSON for key: ${key}`, err);
                    return { ts: value.ts, value: null };
                }
            };
            const machineStatusArray = filteredData.machine_status || [];
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
                                ? "#808080"
                                : "#ccc";
            const targetParts = parseInt(getLatest("targetparts") || 0, 10);
            const totalParts = getLatest("totalparts", true);
            const { totalshots = 0, goodparts = 0, scrap = 0, ncr = 0 } = totalParts;
            const liveComponent = getLatest("live_component", true);
            const jobName = liveComponent.name || "Route card not assigned";
            const jobCode = liveComponent.code || "";
            const liveOperator = getLatestWithTs("live_operator", true);
            const liveOperatorCode = liveOperator?.value?.code || null;
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
                liveComponent,
                liveOperatorCode,
                liveOperator
            });
            if (liveOperator?.value) {
                setCurrentOperator({ ...liveOperator.value, ts: liveOperator.ts });
            }
            return filteredData;
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

    const fetchReasonGroups = async () => {
        const key = "reasongroups";
        try {
            const customerId = getCustomerId();
            const data = await customerbasedshift(customerId, key);
            const allReasonGroups = Array.isArray(data?.[0]?.value)
                ? data[0].value
                : [];
            const mappedGroups = [
                { value: "all", label: "All Groups" },
                ...allReasonGroups.map(item => ({
                    value: item.groupName || item.name || "",
                    label: item.groupName || item.name || "",
                })),
            ];
            setReasonGroupOptions(mappedGroups);
            return mappedGroups;
        } catch (error) {
            console.error("❌ Error fetching reason groups:", error);
            setReasonGroupOptions([{ value: "", label: "All Groups" }]);
            return [{ value: "", label: "All Groups" }];
        }
    };

    const downtimereason = async ({ shiftNo, selectedDate, fromEpoch, toEpoch, deviceId }) => {
        if (!deviceId || !shiftNo || !selectedDate || !fromEpoch || !toEpoch) return [];
        await fetchReasonGroups()
        const fromTime = fromEpoch;
        const toTime = toEpoch;

        try {
            const machineStatusResponse = await telemetrykeydata(deviceId, "DEVICE", "machine_status", fromTime, toTime);
            const machineData = machineStatusResponse?.machine_status || [];

            const sortedData = [...machineData].sort((a, b) => Number(a.ts) - Number(b.ts));
            const transformedData = sortedData
                .filter(item => item.ts && item.value !== undefined)
                .map(item => ({ ts: item.ts, value: Number(item.value) }));
            const IDLE_START_CODES = [0, 1, 2];
            const IDLE_END_CODES = [3, 4, 5, 100];

            const extractIdleSegments = (data) => {
                const result = [];
                let recording = false;
                let segment = { start: null, value: null };

                for (let i = 0; i < data.length; i++) {
                    const current = data[i];
                    const val = current.value;

                    if (!recording && IDLE_START_CODES.includes(val)) {
                        segment.start = current.ts;
                        segment.value = val;
                        recording = true;
                    }

                    if (recording && IDLE_END_CODES.includes(val)) {
                        segment.end = current.ts;
                        const duration = Math.floor((segment.end - segment.start) / 1000);
                        result.push({
                            start: segment.start,
                            end: segment.end,
                            duration,
                            value: segment.value,
                            status: "IDLE",
                        });
                        recording = false;
                        segment = { start: null, value: null };
                    }

                    if (recording && IDLE_START_CODES.includes(val)) {
                        segment.value = val;
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
                        status: "IDLE",
                    });
                }

                return result.length > 0
                    ? result
                    : [{ start: fromTime, end: toTime, duration: 0, value: 0, status: "NO_DATA" }];
            };

            const key = "downtime_threasold";
            const results = await Deviceattributeget(deviceId, key);
            let filteredResult = [];
            if (results && results.length > 0) {
                const downtime = results[0].value;
                const extracted = extractIdleSegments(transformedData);
                filteredResult = extracted.filter(entry => entry.duration > downtime);
            }

            const response = await telemetrykeydata(deviceId, "DEVICE", "live_reason", fromEpoch, toEpoch);
            if (response?.live_reason?.length > 0) {
                const parsedLiveReasons = response.live_reason
                    .map(entry => {
                        try { return { ts: entry.ts, ...JSON.parse(entry.value) }; }
                        catch { return null; }
                    })
                    .filter(Boolean);

                const unusedLiveReasons = [...parsedLiveReasons];

                filteredResult = filteredResult.map(item => {
                    const index = unusedLiveReasons.findIndex(reason => {
                        const reasonStart = Number(reason.idle_start);
                        const reasonEnd = reason.idle_end && reason.idle_end !== 0 ? Number(reason.idle_end) : reasonStart;
                        return reasonStart <= item.end && reasonEnd >= item.start;
                    });
                    let reasonName = "";
                    let reasonGroup = "";
                    if (index !== -1) {
                        reasonName = unusedLiveReasons[index].name;
                        const matchedReason = reasonsList2.find(
                            r =>
                                r.reason?.toLowerCase() === reasonName?.toLowerCase() ||
                                r.code?.toString() === unusedLiveReasons[index].code?.toString()
                        );
                        reasonGroup = matchedReason?.group || "all";
                        unusedLiveReasons.splice(index, 1);
                    }

                    return {
                        ...item,
                        groupselected: reasonGroup,
                        reasonselected: reasonName || item.reasonselected || ""
                    };
                });

            }
            return filteredResult;
        } catch (error) {
            console.error("Error fetching downtime data:", error);
            return [];
        }
    };

    const handleGroupChange = (index, selectedGroup) => {
        setfilteredResult(prev => {
            const updated = [...prev];
            updated[index].groupselected = selectedGroup;
            updated[index].reasonselected = "";
            return updated;
        });
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
                setSelectedShift(currentActiveShift.shift_no);
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
            setreasons(allReasons.map(r => ({ value: r.reason, label: r.reason, group: r.group || "" })));
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
        const customerId = getCustomerId();
        if (cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID) return;
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
                machineStatusArray = machineStatusArray.slice().sort((a, b) => b.ts - a.ts);
                const latestSample = machineStatusArray[0];
                const latestValue = String(latestSample?.value ?? "").trim();
                const latestStatus = parseInt(latestValue || "0", 10);
                const IDLE_START_CODES = ["0", "1", "2"];
                const IDLE_END_CODES = ["3", "4", "5", "100"];
                const latestStatusText = statusText(latestStatus).toLowerCase();
                console.log("[refreshData] latestValue:", latestValue, "latestStatus:", latestStatusText);
                const response = await getMachineLock("DEVICE", deviceId, { keys: "lock_status" });
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
                        if (IDLE_END_CODES.includes(String(next.value)) && IDLE_START_CODES.includes(String(current.value))) {
                            lastIdleOrAlarm = current;
                            break;
                        }
                    }
                    if (!lastIdleOrAlarm) {
                        lastIdleOrAlarm = machineStatusArray.find(item => IDLE_START_CODES.includes(String(item.value)));
                    }
                    const idleStart = lastIdleOrAlarm ? lastIdleOrAlarm.ts : dayjs().valueOf();
                    lockedIdleStartRef.current = idleStart;
                    console.log("[LOCKED_IDLE START] at", idleStart);
                    let previousReason = null;
                    const savedReason = localStorage.getItem("activeReason");
                    if (savedReason) {
                        try {
                            previousReason = JSON.parse(savedReason);
                        } catch {
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
                    console.log(`[refreshData] status changed ${prevStatus} -> ${latestStatusText}`);
                }
                if (IDLE_END_CODES.includes(String(latestStatus)) &&
                    lockedIdleStartRef.current &&
                    activeReasonRef.current) {
                    const endEvent = machineStatusArray.find(
                        item => IDLE_END_CODES.includes(String(item.value)) && item.ts >= lockedIdleStartRef.current
                    ) || latestSample;
                    if (endEvent) {
                        const idleEndTime = endEvent.ts;
                        const duration = Math.floor((idleEndTime - lockedIdleStartRef.current) / 1000);
                        const parsedShifts = generateShiftInstances(lockedIdleStartRef.current, idleEndTime, shifts);
                        const segments = splitIdleByShifts(lockedIdleStartRef.current, idleEndTime, parsedShifts);
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

                        console.log("[LOCKED_IDLE END] at", idleEndTime, "duration:", duration, "sec");
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

    const [reasonGroupOptions, setReasonGroupOptions] = useState([]);
    useEffect(() => {
        const customerId = getCustomerId();
        if (cleanCustomerId(customerId) != window._env_.GPLAST_CUSTOMER_ID) return;
        if (!selectedMachine || !deviceNameIdJson[selectedMachine]) return;
        const deviceId = deviceNameIdJson[selectedMachine];
        const openReasonSwal = (idleStart, reasonsList2, previousReason = null) => {
            if (isSwalOpenRef.current) return;
            isSwalOpenRef.current = true;
            const uniqueGroups = Array.from(
                new Set(reasonsList2.map(r => r.group).filter(g => g && g.trim() !== ""))
            );
            const hasGroups = uniqueGroups.length > 0;
            const allGroups = hasGroups
                ? [{ label: "All Groups", value: "all" }, ...uniqueGroups.map(g => ({ label: g, value: g }))]
                : [];
            const defaultGroup =
                previousReason && previousReason.group && uniqueGroups.includes(previousReason.group)
                    ? previousReason.group
                    : "all";
            const selectedReasonRef = { current: previousReason };
            const SwalContent = () => {
                const [group, setGroup] = React.useState(defaultGroup);
                const [reason, setReason] = React.useState(selectedReasonRef.current);
                const filteredReasons = React.useMemo(() => {
                    return group === "all" ? reasonsList2 : reasonsList2.filter(r => r.group === group);
                }, [group]);
                React.useEffect(() => {
                    selectedReasonRef.current = reason;
                }, [reason]);
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", minHeight: 150 }}>
                        <p>Machine has been locked due to downhold threshold reached.</p>

                        {hasGroups && (
                            <>
                                <label>Select Group:</label>
                                <Autocomplete
                                    options={allGroups}
                                    value={allGroups.find(g => g.value === group)}
                                    onChange={(_, newValue) => {
                                        setGroup(newValue?.value || "all");
                                        setReason(null);
                                    }}
                                    getOptionLabel={(opt) => opt?.label || ""}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Group" variant="outlined" size="small" />
                                    )}
                                />
                            </>
                        )}

                        <label>Select Reason:</label>
                        <Autocomplete
                            options={filteredReasons}
                            value={reason}
                            onChange={(_, newValue) => setReason(newValue)}
                            getOptionLabel={(opt) => opt?.reason || ""}
                            renderInput={(params) => (
                                <TextField {...params} label="Reason" variant="outlined" size="small" />
                            )}
                        />
                    </div>
                );
            };

            Swal.fire({
                icon: "info",
                title: "Machine Locked",
                html: '<div id="swal-root"></div>',
                showConfirmButton: true,
                confirmButtonText: "Submit",
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    const container = document.getElementById("swal-root");
                    if (container) {
                        ReactDOMClient.createRoot(container).render(<SwalContent />);
                    }
                },
                preConfirm: () => {
                    if (!selectedReasonRef.current) {
                        Swal.showValidationMessage("Please select a reason");
                        return false;
                    }
                    return selectedReasonRef.current;
                },
            }).then((result) => {
                if (result.isConfirmed && result.value) {
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
                    }).then(async (confirmResult) => {
                        isSwalOpenRef.current = false;
                        if (confirmResult.isConfirmed) {
                            const payload = {
                                ts: idleStart,
                                values: {
                                    live_reason: {
                                        name: selectedReason.reason,
                                        code: selectedReason.code || "",
                                        mode: selectedReason.mode || "",
                                        category: selectedReason.category || "",
                                        group: selectedReason.group || null,
                                        idle_start: idleStart,
                                        idle_end: 0,
                                        idle_duration: 0,
                                    },
                                },
                            };
                            try {
                                await operatorTelemetry("DEVICE", deviceId, payload);
                                await operatorTelemetry("DEVICE", deviceId, { lock_status: "unlocked" });
                                isLockedRef.current = false;
                                Swal.fire({
                                    icon: "success",
                                    title: "Submitted!",
                                    text: "Reason submitted successfully.",
                                    timer: 1500,
                                    showConfirmButton: false,
                                });
                            } catch (err) {
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
                } else {
                    isSwalOpenRef.current = false;
                }
            });
        };
        const refreshData = async (checkRestore = false) => {
            try {
                const data = await fetchTelemetry(deviceId);
                let machineStatusArray = data?.machine_status || [];
                if (!machineStatusArray.length) return;
                machineStatusArray = machineStatusArray.slice().sort((a, b) => b.ts - a.ts);
                const latestSample = machineStatusArray[0];
                const latestValue = String(latestSample?.value ?? "").trim();
                const latestStatus = parseInt(latestValue || "0", 10);
                const IDLE_START_CODES = ["0", "1", "2"];
                const IDLE_END_CODES = ["3", "4", "5", "100"];
                const latestStatusText = statusText(latestStatus).toLowerCase();
                const response = await getMachineLock("DEVICE", deviceId, { keys: "lock_status" });
                const lockValue = response?.lock_status?.[0]?.value || "";
                const locked = String(lockValue).toLowerCase() === "locked";
                if (!locked && isLockedRef.current) {
                    console.log("[refreshData] unlocking");
                    isLockedRef.current = false;
                    isSwalOpenRef.current = false;
                    Swal.close();
                }
                if (locked && !isLockedRef.current && !isSwalOpenRef.current) {
                    isLockedRef.current = true;
                    let lastIdleOrAlarm = null;
                    for (let i = 0; i < machineStatusArray.length - 1; i++) {
                        const current = machineStatusArray[i];
                        const next = machineStatusArray[i + 1];
                        if (IDLE_END_CODES.includes(String(next.value)) && IDLE_START_CODES.includes(String(current.value))) {
                            lastIdleOrAlarm = current;
                            break;
                        }
                    }
                    if (!lastIdleOrAlarm) {
                        lastIdleOrAlarm = machineStatusArray.find(item => IDLE_START_CODES.includes(String(item.value)));
                    }
                    const idleStart = lastIdleOrAlarm ? lastIdleOrAlarm.ts : dayjs().valueOf();
                    lockedIdleStartRef.current = idleStart;
                    let previousReason = null;
                    const savedReason = localStorage.getItem("activeReason");
                    if (savedReason) {
                        try {
                            previousReason = JSON.parse(savedReason);
                        } catch {
                            previousReason = null;
                        }
                    }
                    openReasonSwal(idleStart, reasonsList2, previousReason);
                }
                if (checkRestore && locked && !isSwalOpenRef.current) {
                    const savedIdleStart = localStorage.getItem("lockedIdleStartTime");
                    const savedReason = localStorage.getItem("activeReason");
                    if (savedIdleStart && savedReason) {
                        try {
                            const parsedReason = JSON.parse(savedReason);
                            lockedIdleStartRef.current = parseInt(savedIdleStart, 10);
                            activeReasonRef.current = parsedReason;
                            isLockedRef.current = true;
                            openReasonSwal(lockedIdleStartRef.current, reasonsList2, parsedReason);
                        } catch (e) {
                            console.error("Failed to restore reason:", e);
                        }
                    }
                }
                if (
                    IDLE_END_CODES.includes(String(latestStatus)) &&
                    lockedIdleStartRef.current &&
                    activeReasonRef.current
                ) {
                    const endEvent =
                        machineStatusArray.find(
                            item => IDLE_END_CODES.includes(String(item.value)) && item.ts >= lockedIdleStartRef.current
                        ) || latestSample;
                    if (endEvent) {
                        const idleEndTime = endEvent.ts;
                        const parsedShifts = generateShiftInstances(lockedIdleStartRef.current, idleEndTime, shifts);
                        const segments = splitIdleByShifts(lockedIdleStartRef.current, idleEndTime, parsedShifts);
                        for (const seg of segments) {
                            const payload = {
                                ts: seg.start,
                                values: {
                                    live_reason: {
                                        name: activeReasonRef.current.reason,
                                        code: activeReasonRef.current.code || "",
                                        mode: activeReasonRef.current.mode || "",
                                        category: activeReasonRef.current.category || "",
                                        group: activeReasonRef.current.group || null,
                                        idle_start: seg.start,
                                        idle_end: seg.end,
                                        idle_duration: Math.floor((seg.end - seg.start) / 1000),
                                    },
                                },
                            };
                            try {
                                await operatorTelemetry("DEVICE", deviceId, payload);
                            } catch (err) {
                                console.error("Error submitting locked idle segment:", err);
                            }
                        }
                        lockedIdleStartRef.current = null;
                        activeReasonRef.current = null;
                        isLockedRef.current = false;
                        isSwalOpenRef.current = false;
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
        if (!telemetry.liveOperatorCode) {
            setSelectedOperator("");
            return;
        }
        const found = operators.find(
            op => String(op.id) === String(telemetry.liveOperatorCode)
        );
        if (found) {
            setSelectedOperator(found.id);
        } else {
            setSelectedOperator("");
        }
    }, [telemetry.liveOperatorCode, operators]);

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
            location.pathname !== "/smc_operator_bf9tz" &&
            location.pathname !== "/marks_operator_ch8st" &&
            location.pathname !== "/makino_operator_av5tc" &&
            location.pathname !== "/gplast_operator_awe6tc" &&
            location.pathname !== "/demo_operator_av3tc" &&
            location.pathname !== "/atech_operator_atc67"
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

    // Reset blue card notifications when component changes
    useEffect(() => {
        const currentCode = telemetry?.liveComponent?.code || telemetry?.liveComponent?.name || null;
        if (prevComponentCodeRef.current !== null && prevComponentCodeRef.current !== currentCode) {
            setBlueCardNotifications([]);
        }
        prevComponentCodeRef.current = currentCode;
    }, [telemetry.liveComponent]);

    // Click outside handler for notification dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifBellRef.current && !notifBellRef.current.contains(e.target)) {
                setShowBlueCardNotif(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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

            if (currentOperator && currentOperator.start_time) {
                const updatedPrevOperator = {
                    ...currentOperator,
                    end_time: startTime,
                    duration: Math.floor((startTime - currentOperator.start_time) / 1000)
                };
                const prevPayload = {
                    ts: currentOperator.ts || dayjs().valueOf(),
                    values: { live_operator: updatedPrevOperator }
                };
                await operatorTelemetry('DEVICE', deviceId, prevPayload);
            }

            const newOperatorData = {
                name: operatorName,
                code: pendingOperator,
                start_time: startTime,
                end_time: 0,
                duration: 0,
                ts: startTime
            };

            const payload = {
                ts: startTime,
                values: {
                    live_operator: newOperatorData
                }
            };

            await operatorTelemetry('DEVICE', deviceId, payload);
            setCurrentOperator(newOperatorData);
            const payload2 = { ts: payload.ts, value: payload.values.live_operator };
            localStorage.setItem('operator_details', JSON.stringify(payload2));
        } catch (err) {
            console.error('operator api failure', err);
        }
    };

    const formattedReasons = reasons.map(reason => ({
        ...reason,
        label: reason.label
    }));

    const handleConfirmAlert = () => {
        const operator = operators.find((o) => o.id === pendingOperator)
        Swal.fire({
            title: "Confirm Change",
            text:
                confirmType === "machine"
                    ? `Are you sure you want to change the machine to "${pendingMachine}"?`
                    : `Are you sure you want to change the operator to "${operator.id} - ${operator.name
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

    const handleRejectParts = async () => {
        setSelectedRow({
            machineName: selectedMachine,
            op: {
                goodvsexp: `${telemetry.totalShots}/0`,
                operation_name: telemetry.jobName || "No Operations",
            },
        });
        setExistingCount(telemetry.scrap || 0);
        setRejectRows([{ count: 0, reason: [], remark: "", isExisting: false }]);
        setIsFetchingBluecard(false);
        setPrevOperatorData(null);
        setOpenReject(true);

        const deviceId = deviceNameIdJson[selectedMachine];

        // Fetch operations for current shift to get actual (goodvsexp numerator) and rejected counts
        if (deviceId && currentShift) {
            try {
                const { shiftStart, shiftEnd } = getShiftEpoch(currentShift.start_time, currentShift.end_time);
                const opsData = await telemetrykeydata(deviceId, "DEVICE", "operations", shiftStart, shiftEnd);
                const rawOps = opsData?.operations || [];
                const parsedOps = rawOps
                    .map(item => {
                        try {
                            const v = typeof item.value === "string" ? JSON.parse(item.value) : item.value;
                            return { ts: item.ts, ...v };
                        } catch { return null; }
                    })
                    .filter(Boolean);

                if (parsedOps.length > 0) {
                    parsedOps.sort((a, b) => b.ts - a.ts);
                    const latestOp = parsedOps[0];
                    const actualFromOps = Number((latestOp.goodvsexp?.split("/") || [])[0] || 0);
                    const rejectedFromOps = Number(latestOp.rejected ?? 0);
                    setSelectedRow({
                        machineName: selectedMachine,
                        op: {
                            goodvsexp: latestOp.goodvsexp || `${actualFromOps}/0`,
                            operation_name: telemetry.jobName || "No Operations",
                        },
                    });
                    setExistingCount(rejectedFromOps);
                }
            } catch (err) {
                console.warn("Could not fetch operations data for reject parts", err);
            }
        }

        const startTime = telemetry?.liveComponent?.start_time;
        if (deviceId && startTime) {
            try {
                const existingData = await telemetrykeydata(deviceId, "DEVICE", "rejection", startTime - 1000, startTime + 1000);
                const entries = existingData?.rejection || [];
                if (entries.length > 0) {
                    let parsed = null;
                    try { parsed = typeof entries[0].value === "string" ? JSON.parse(entries[0].value) : entries[0].value; } catch { }
                    if (parsed && Number(parsed.operator_count || 0) > 0) {
                        setPrevOperatorData({
                            count: Number(parsed.operator_count || 0),
                            reason: Array.isArray(parsed.operator_reason) ? parsed.operator_reason : parsed.operator_reason ? [parsed.operator_reason] : [],
                            remark: Array.isArray(parsed.operator_remark) ? parsed.operator_remark.join(", ") : parsed.operator_remark || "",
                        });
                    }
                }
            } catch (err) {
                console.warn("Could not fetch previous operator rejection data", err);
            }
        }
    };

    const formatReason = (val) => {
        if (!val) return "-";
        if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean).join(", ");
        return String(val);
    };
    const isGplast = cleanCustomerId(customerId1) === window._env_.GPLAST_CUSTOMER_ID;


    const handleLoginAndFetch = async (machineName,
        formattedDate,
        selectedShift,
        isLiveShift) => {
        try {
            const loginRes = await getReportToken(
                isGplast ? "gd" : "pmi",
                isGplast ? "gd" : "pmi"
            );
            const token = loginRes?.accessToken;
            if (!token) {
                console.warn("Token missing — skipping report call");
                return;
            }
            await getReportGenerate1(
                machineName,
                formattedDate,
                selectedShift,
                isLiveShift
            );
        } catch (err) {
            console.error("Login/report flow failed:", err);
        }
    };

    const handleSave = async () => {

        const filledRows = rejectRows.filter(
            row => !row.isExisting && (Number(row.count) || 0) > 0
        );

        if (filledRows.length === 0) return;

        const newCount = filledRows.reduce((sum, row) => sum + Number(row.count), 0);

        const newReasons = filledRows
            .flatMap(row => Array.isArray(row.reason) ? row.reason : [row.reason])
            .filter(Boolean);

        const newRemarks = filledRows
            .map(row => row.remark)
            .filter(Boolean);

        const deviceId = deviceNameIdJson[selectedMachine];
        const startTime = telemetry?.liveComponent?.start_time;

        if (!deviceId || !startTime) {
            Swal.fire("Error", "No active component found.", "error");
            return;
        }

        /* -------------------------------
           Existing Values
        --------------------------------*/

        let prevEmails = [];

        let prevOperatorCount = 0;
        let prevOperatorReasons = [];
        let prevOperatorRemarks = [];

        let prevQualityCount = 0;
        let prevQualityReason = [];
        let prevQualityRemark = [];
        let prevQualityRows = [];

        let prevCount = 0;
        let prevReasons = [];
        let prevRemarks = [];

        try {

            const existingData = await telemetrykeydata(
                deviceId,
                "DEVICE",
                "rejection",
                startTime - 1000,
                startTime + 1000
            );

            const entries = existingData?.rejection || [];

            if (entries.length > 0) {

                let parsed = null;

                try {
                    parsed = typeof entries[0].value === "string"
                        ? JSON.parse(entries[0].value)
                        : entries[0].value;
                } catch { }

                if (parsed) {

                    prevEmails = Array.isArray(parsed.operator_email)
                        ? parsed.operator_email
                        : parsed.operator_email
                            ? [parsed.operator_email]
                            : [];

                    prevOperatorCount = Number(parsed.operator_count || 0);

                    prevOperatorReasons = Array.isArray(parsed.operator_reason)
                        ? parsed.operator_reason
                        : parsed.operator_reason
                            ? [parsed.operator_reason]
                            : [];

                    prevOperatorRemarks = Array.isArray(parsed.operator_remark)
                        ? parsed.operator_remark
                        : parsed.operator_remark
                            ? [parsed.operator_remark]
                            : [];

                    prevQualityCount = Number(parsed.qualitycount || 0);

                    prevQualityReason = Array.isArray(parsed.qualityreason)
                        ? parsed.qualityreason
                        : parsed.qualityreason
                            ? [parsed.qualityreason]
                            : [];

                    prevQualityRemark = Array.isArray(parsed.quality_remark)
                        ? parsed.quality_remark
                        : parsed.quality_remark
                            ? [parsed.quality_remark]
                            : [];

                    prevQualityRows = Array.isArray(parsed.quality_rows)
                        ? parsed.quality_rows
                        : [];

                    prevCount = Number(parsed.count || 0);

                    prevReasons = Array.isArray(parsed.reason)
                        ? parsed.reason
                        : parsed.reason
                            ? [parsed.reason]
                            : [];

                    prevRemarks = Array.isArray(parsed.remark)
                        ? parsed.remark
                        : parsed.remark
                            ? [parsed.remark]
                            : [];
                }
            }

        } catch (err) {
            console.warn("Could not fetch existing rejection data", err);
        }

        /* -------------------------------
           Correct Merging Logic
        --------------------------------*/

        const combinedEmails = [
            ...new Set([...prevEmails, CustomerEmail])
        ];

        const operatorCount = prevOperatorCount + newCount;

        const operatorReasons = [
            ...new Set([...prevOperatorReasons, ...newReasons])
        ];

        const operatorRemarks = [
            ...prevOperatorRemarks,
            ...newRemarks
        ];

        const totalCount = prevCount + newCount;

        const finalReasons = [
            ...new Set([...prevReasons, ...newReasons])
        ];

        const finalRemarks = [
            ...prevRemarks,
            ...newRemarks
        ];

        /* -------------------------------
           Payload
        --------------------------------*/

        const key = {
            ts: startTime,
            values: {
                rejection: {

                    operator_email: combinedEmails,
                    operator_count: operatorCount,
                    operator_reason: operatorReasons,
                    operator_remark: operatorRemarks,

                    qualitycount: prevQualityCount,
                    qualityreason: prevQualityReason,
                    quality_remark: prevQualityRemark,
                    quality_rows: prevQualityRows,

                    count: totalCount,
                    reason: finalReasons,
                    remark: finalRemarks,

                    shift: currentShift?.shift_no
                }
            }
        };

        try {

            await Downtimeadd1("DEVICE", deviceId, "SERVER_SCOPE", key);

            setOpenReject(false);
            setRejectRows([{ count: 0, reason: [], remark: "" }]);

            Swal.fire({
                icon: "success",
                title: "Success",
                text: `${newCount} part(s) rejected successfully.`,
                timer: 2000,
                showConfirmButton: false
            });
            const formattedDate = dayjs(selectedDate).format("YYYY-MM-DD");
            const todayStr = dayjs().format("YYYY-MM-DD");
            const selectedDateStr = dayjs(selectedDate).format("YYYY-MM-DD");
            const currentShift = getCurrentShift(shifts);

            const isToday = selectedDateStr === todayStr;
            const isCurrentShift = String(selectedShift) === String(currentShift);
            const isLiveShift = isToday && isCurrentShift;

            await handleLoginAndFetch(selectedMachine,
                formattedDate,
                currentShift?.shift_no,
                "true")

        } catch (err) {

            console.error("Reject API failed:", err);

            Swal.fire(
                "Error",
                "Failed to reject parts. Try again.",
                "error"
            );
        }
    };

    const formatBlueCardTimer = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!blueCardTimerStart) {
            setBlueCardElapsed(0);
            return;
        }
        const interval = setInterval(() => {
            setBlueCardElapsed(Math.floor((Date.now() - blueCardTimerStart) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [blueCardTimerStart]);

    const showBlueCardSuccess = () => {
        Swal.fire({
            title: "Success",
            text: "Blue Card has been pushed successfully",
            icon: "success",
            showConfirmButton: false, // remove OK button
            timer: 1500,               // 3 seconds
            timerProgressBar: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            width: "500px",
            customClass: {
                popup: "swal-wide"
            }
        });
    };


    const handleBlueCardPush = async (routeCardNo) => {
        if (!telemetry?.liveComponent?.name
        ) {
            console.warn("Blue card push skipped — missing component or shots");
            return;
        }
        showBlueCardSuccess();

        const operator = operators.find(
            op => String(op.id) === String(selectedOperator)
        );
        const payload = {
            job_name: telemetry.jobName || "",
            code: telemetry.jobCode || "",
            device_name: selectedMachine || "",
            clicked_ts: Date.now(),
            operator_name: operator?.name || "No Operator",
            component_starttime: telemetry?.liveComponent?.start_time,
            route_card_no: routeCardNo || "",
            total_shots: telemetry.totalShots ?? 0,
            target_parts: telemetry.targetParts ?? 0,
            shift: currentShift?.shift_no,

            status: "-",
            progress: "request",
        };

        setBlueCardLogs(prev => [...prev, payload]);

        blueCardTimerRef.current = payload.clicked_ts;
        setBlueCardTimerStart(payload.clicked_ts);
        setBlueCardElapsed(0);

        console.log("Stored in state:", payload);

        const customerId = getCustomerId();
        const deviceId = deviceNameIdJson[selectedMachine];

        const telemetryPayload = {
            ts: payload.clicked_ts,
            values: {
                bluecard_push: payload
            }
        };

        await operatorTelemetry(
            'CUSTOMER',
            customerId,
            telemetryPayload
        );

        try {
            const REQUEST_KEY = "request_payload";
            let existingRequests = [];
            try {
                const existing = await customerbasedshift(customerId, REQUEST_KEY);
                const val = existing[0]?.value;
                existingRequests = Array.isArray(val) ? val : [];
            } catch {
                existingRequests = [];
            }
            const updatedRequests = [...existingRequests, payload];
            await shiftadd(
                { [REQUEST_KEY]: updatedRequests, lastUpdateTs: Date.now() },
                customerId,
                "SERVER_SCOPE"
            );
            console.log("request_payload saved:", updatedRequests);
        } catch (err) {
            console.error("Failed to save request_payload:", err);
        }
    };

    useEffect(() => {
        const fetchRequestPayload = async () => {
            try {
                const customerId = getCustomerId();
                const result = await customerbasedshift(customerId, "request_payload");
                const val = result[0]?.value;
                setRequestPayload(Array.isArray(val) ? val : []);
            } catch (err) {
                console.error("request_payload fetch failed:", err);
                setRequestPayload([]);
            }
        };

        fetchRequestPayload();
        const poll = setInterval(fetchRequestPayload, 5000);
        return () => clearInterval(poll);
    }, []);

    useEffect(() => {
        const prev = prevRequestPayloadRef.current;
        const wasPending = prev.find(item => item.device_name === selectedMachine);
        const isStillPending = requestPayload.find(item => item.device_name === selectedMachine);

        if (wasPending && !isStillPending) {
            const fetchResponse = async () => {
                try {
                    const from = wasPending.clicked_ts - 1000;
                    const to = wasPending.clicked_ts + 1000;
                    const data = await telemetrykeydata(
                        cleanCustomerId(customerId1),
                        "CUSTOMER",
                        "bluecard_push",
                        from,
                        to
                    );
                    const entries = (data?.bluecard_push || [])
                        .map(p => {
                            try {
                                return typeof p.value === "string" ? JSON.parse(p.value) : p.value;
                            } catch { return null; }
                        })
                        .filter(e => e && e.device_name === wasPending.device_name && e.progress === "completed");

                    if (entries.length > 0) {
                        setBlueCardResponseData(entries[0]);
                        setOpenBlueCardResponse(true);
                        setBlueCardTimerStart(null);
                        setBlueCardElapsed(0);
                        blueCardTimerRef.current = null;
                    }
                } catch (err) {
                    console.error("Failed to fetch blue card response:", err);
                }
            };
            fetchResponse();
        }

        prevRequestPayloadRef.current = requestPayload;
    }, [requestPayload]);

    useEffect(() => {
        let blinkInterval;

        const hasPending = requestPayload.some(
            (item) => item.device_name === selectedMachine
        );

        if (hasPending) {
            setIsBlinking(true);
            setBlueCardText("Blue Card Pushed");

            blinkInterval = setInterval(() => {
                setIsBlinking((prev) => !prev);
            }, 500);
        } else {
            setIsBlinking(false);
            setBlueCardText("Blue Card Push");
        }

        return () => clearInterval(blinkInterval);
    }, [requestPayload, selectedMachine]);

    useEffect(() => {
        const machineData = requestPayload.find(
            item => item.device_name === selectedMachine
        );

        if (!machineData) {
            setBlueCardTimerStart(null);
            setBlueCardElapsed(0);
            return;
        }

        const startTime = machineData.clicked_ts;
        setBlueCardTimerStart(startTime);

        const interval = setInterval(() => {
            setBlueCardElapsed(
                Math.floor((Date.now() - startTime) / 1000)
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [requestPayload, selectedMachine]);

    const showBlueCardConfirm = () => {
        Swal.fire({
            html: `
      <div style="text-align:center;padding:10px 10px;">
        <div
          style="
            width:80px;
            height:80px;
            border-radius:50%;
            border:4px solid #f4c7a1;
            display:flex;
            align-items:center;
            justify-content:center;
            margin:10px auto;
            color:#f4a261;
            font-size:40px;
            font-weight:bold;
          "
        >
          !
        </div>

        <p style="color:#000;margin-top:10px;font-size:20px;">
          Enter the Route Card No to push the Blue Card
        </p>

        <input
          id="routeCardInput"
          class="swal2-input"
          placeholder="Enter Route Card No"
          style="margin-top:10px;"
        />
      </div>
    `,
            showCancelButton: true,
            confirmButtonText: "Confirm",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#f97316",
            cancelButtonColor: "#6b7280",
            allowOutsideClick: false,
            width: "420px",

            didOpen: () => {
                const input = document.getElementById("routeCardInput");
                const confirmBtn = Swal.getConfirmButton();

                confirmBtn.disabled = true;

                const validateInput = () => {
                    const value = input.value.trim();
                    const isValid = /^[a-z0-9 ]+$/i.test(value) && value.length > 0;
                    confirmBtn.disabled = !isValid;
                };

                input.addEventListener("input", validateInput);
                input.addEventListener("keyup", validateInput);
            },

            preConfirm: () => {
                const value = document.getElementById("routeCardInput").value.trim();
                return value;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                handleBlueCardPush(result.value);
                showBlueCardSuccess();
            }
        });
    };

    console.log('blue card data------------', blueCardLogs)
    console.log('selected shift', currentShift?.shift_no)
    console.log('selected shift no is', selectedShift)

    const blinkGreenBorder = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 4px 0 0 rgba(21,128,61,0.9),
      inset -4px 0 0 0 rgba(21,128,61,0.9),
      inset 0 -4px 0 0 rgba(21,128,61,0.9),
      inset 4px 0 0 0 rgba(21,128,61,0.9),
      0 0 14px rgba(21,128,61,0.6);
  }
  50% {
    box-shadow:
      inset 0 4px 0 0 rgba(21,128,61,0.25),
      inset -4px 0 0 0 rgba(21,128,61,0.25),
      inset 0 -4px 0 0 rgba(21,128,61,0.25),
      inset 4px 0 0 0 rgba(21,128,61,0.25),
      0 0 6px rgba(21,128,61,0.25);
  }
`;

    /* ===== DARK RED ===== */
    const blinkRedBorder = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 4px 0 0 rgba(185,28,28,0.9),
      inset -4px 0 0 0 rgba(185,28,28,0.9),
      inset 0 -4px 0 0 rgba(185,28,28,0.9),
      inset 4px 0 0 0 rgba(185,28,28,0.9),
      0 0 14px rgba(185,28,28,0.6);
  }
  50% {
    box-shadow:
      inset 0 4px 0 0 rgba(185,28,28,0.25),
      inset -4px 0 0 0 rgba(185,28,28,0.25),
      inset 0 -4px 0 0 rgba(185,28,28,0.25),
      inset 4px 0 0 0 rgba(185,28,28,0.25),
      0 0 6px rgba(185,28,28,0.25);
  }
`;

    const totalShotsNum = Number(telemetry?.totalShots || 0);

    const currentTimeTarget = (() => {
        if (!currentShift || !telemetry.targetParts) return 0;
        if (!telemetry.jobName || telemetry.jobName === "Route card not assigned") {
            return telemetry.targetParts;
        }
        const { shiftStart, shiftEnd } = getShiftEpoch(currentShift.start_time, currentShift.end_time);
        if (!shiftStart || !shiftEnd) return 0;
        const elapsed = Math.max(0, Date.now() - shiftStart);
        const totalDuration = shiftEnd - shiftStart;
        return Math.min(telemetry.targetParts, Math.round((elapsed / totalDuration) * telemetry.targetParts));
    })();
    const blueCardPushCount = blueCardLogs.filter(log => log.device_name === selectedMachine &&
        log.component === telemetry.jobName).length;
    const isBlueCardLimitReached = blueCardPushCount >= totalShotsNum && totalShotsNum != 0;
    console.log('telemetry', telemetry)

    const rejectActual = Number((selectedRow?.op?.goodvsexp?.split("/") || [])[0] || 0);
    const rejectAllowed = Math.max(0, rejectActual - (existingCount || 0));
    const totalNewRejectCount = rejectRows.reduce((sum, r) => !r.isExisting ? sum + Number(r.count || 0) : sum, 0);
    const isMaxReached = totalNewRejectCount >= rejectAllowed;
    const existingRows = rejectRows.filter(r => r.isExisting);

    const handleRejectParts1 = async (deviceId, initialCount = 0) => {
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
                        handleRejectParts1(deviceId, count);
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

                    {/* Blue Card Notification Bell */}
                    {isPMIBlueCardPage && (

                        <div ref={notifBellRef} style={{ position: 'relative', marginLeft: '16px', cursor: 'pointer' }}>
                            <div onClick={() => setShowBlueCardNotif(prev => !prev)} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <FaBell size={22} style={{ color: '#6b7280' }} />
                                {blueCardNotifications.length > 0 && (
                                    <span style={{
                                        position: 'absolute', top: -6, right: -6,
                                        background: '#F99022', color: 'white',
                                        borderRadius: '50%', width: 18, height: 18,
                                        fontSize: 11, fontWeight: 700,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        lineHeight: 1,
                                    }}>
                                        {blueCardNotifications.length}
                                    </span>
                                )}
                            </div>

                            {showBlueCardNotif && (
                                <div style={{
                                    position: 'absolute', top: '110%', right: 0, zIndex: 1100,
                                    background: 'white', border: '1px solid #e5e7eb',
                                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                                    minWidth: 320, maxHeight: 360, overflowY: 'auto',
                                }}>
                                    <div style={{ padding: '10px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid #f3f4f6', color: '#111827' }}>
                                        Blue Card Responses
                                        {telemetry?.liveComponent?.name && (
                                            <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                                                ({telemetry.liveComponent.name})
                                            </span>
                                        )}
                                    </div>
                                    {blueCardNotifications.length === 0 ? (
                                        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                                            No responses yet for this component
                                        </div>
                                    ) : (
                                        [...blueCardNotifications].reverse().map((n, i) => {
                                            const relTime = (() => {
                                                if (!n.receivedAt) return '';
                                                const diff = Math.floor((Date.now() - n.receivedAt) / 1000);
                                                if (diff < 60) return 'Just now';
                                                if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                                return `${Math.floor(diff / 3600)}h ago`;
                                            })();
                                            return (
                                                <div key={i} style={{
                                                    padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
                                                    background: i === 0 ? '#fafafa' : 'white',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                        <span style={{ fontWeight: 600, fontSize: 14, color: n.status === 'OK' ? '#16a34a' : '#dc2626' }}>
                                                            {n.status === 'OK' ? '✓ Approved' : '✗ Rejected'} — {n.device_name || '-'}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                                            {relTime}
                                                        </span>
                                                    </div>
                                                    {n.status === 'NOK' && n.reason && (
                                                        <div style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
                                                            <strong>Reason:</strong> {Array.isArray(n.reason) ? n.reason.join(', ') : n.reason}
                                                        </div>
                                                    )}
                                                    {n.status === 'NOK' && n.remarks && n.remarks !== '-' && (
                                                        <div style={{ fontSize: 12, color: '#374151' }}>
                                                            <strong>Remark:</strong> {n.remarks}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    )}

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
            {isAtechCondition && deviceNameIdJson[selectedMachine] && currentShift && (() => {
                const { shiftStart, shiftEnd } = getShiftEpoch(currentShift.start_time, currentShift.end_time);
                if (!shiftStart || !shiftEnd) return null;
                const bearerToken = encodeURIComponent('Bearer+' + localStorage.getItem('token1'));
                const deviceId = deviceNameIdJson[selectedMachine];
                const grafanaUrl = window._env_.GRAFANA_URL;
                const serverUrl = window._env_.SERVER_URL;
                const iframeSrc = `${grafanaUrl}d/dfl4xwf27vp4we/machine-status-timeline?orgId=1&var-token=${bearerToken}&var-deviceId=${deviceId}&var-url=${serverUrl}&var-grafanaurl=${grafanaUrl}&from=${shiftStart}&to=now&theme=light&kiosk`;
                return (
                    <iframe
                        key={`grafana-mchstat-${currentShift.shift_no}-${selectedMachine}`}
                        src={iframeSrc}
                        style={{ display: 'block', width: '100%', height: '100px', border: 'none' }}
                        scrolling="no"
                        title="Machine Status Timeline"
                    />
                );
            })()}
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
                                    return operator ? `${operator.id} - ${operator.name}` : "";
                                }}
                                disableUnderline
                            >
                                <MenuItem disabled value="">
                                    No operator assigned
                                </MenuItem>
                                {operators.map((op) => (
                                    <MenuItem key={op.id} value={op.id}>
                                        {op?.id} - {op?.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>
                </div>
                <div className="contect-section">
                    <div className="job-info">
                        <p className="job-code">{telemetry.jobCode || ""}</p>
                        <p className="job-name">{telemetry.jobName || "—"}</p>
                    </div>

                    <div className="time-wrapper">
                        <div className="time-item">
                            <span>Cycle Time</span>
                            <p>{telemetry?.liveComponent?.cycle_time || "00:00:00"}</p>
                        </div>
                        <div className="time-item">
                            <span>Handling Time</span>
                            <p>{telemetry?.liveComponent?.handling_time || "00:00:00"}</p>
                        </div>
                    </div>

                    <div className="actual-wrapper">
                        <p className="actual-label">Actual vs Target</p>
                        <p className="actual-value">
                            {telemetry.totalShots ?? 0}/{telemetry.targetParts ?? 0}
                        </p>
                        {isAtechCondition && currentTimeTarget > 0 && (
                            <div
                                className="current-target-row"
                                style={{ background: (telemetry.totalShots ?? 0) >= currentTimeTarget ? '#16a34a' : '#dc2626' }}
                            >
                                <span className="current-target-label" style={{ color: '#fff' }}>Current Target</span>
                                <span className="current-target-value" style={{ color: '#fff' }}>
                                    {currentTimeTarget}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Blue card button */}
                    {isPMIBlueCardPage && (
                        <div
                            className="button-wrapper"
                            style={{
                                padding: "12px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                            }}
                        >
                            <button
                                className={`blue-card-button ${isBlinking ? "blink" : ""}`}
                                style={{
                                    fontSize: "20px",
                                    cursor: (blueCardText === "Blue Card Pushed" || !telemetry.jobName || telemetry.jobName === "Route card not assigned")
                                        ? "not-allowed"
                                        : "pointer",
                                    opacity: (blueCardText === "Blue Card Pushed" || !telemetry.jobName || telemetry.jobName === "Route card not assigned") ? 0.7 : 1
                                }}
                                onClick={() => {
                                    if (
                                        blueCardText === "Blue Card Pushed" ||
                                        !telemetry.jobName ||
                                        telemetry.jobName === "Route card not assigned"
                                    ) {
                                        return;
                                    }

                                    // ⭐ IMPORTANT: show error when limit reached
                                    if (isBlueCardLimitReached) {
                                        Swal.fire({
                                            icon: "error",
                                            title: "Limit Reached",
                                            text: `Blue Card can only be pushed ${telemetry.totalShots} times.`,
                                            confirmButtonColor: "#d33",
                                        });
                                        return;
                                    }

                                    showBlueCardConfirm();
                                }}
                                disabled={
                                    blueCardText === "Blue Card Pushed" ||
                                    !telemetry.jobName ||
                                    telemetry.jobName === "Route card not assigned"
                                }
                            >
                                {blueCardText}
                            </button>

                            {blueCardTimerStart && (
                                <div
                                    style={{
                                        marginTop: "10px",
                                        fontSize: "16px",
                                        fontWeight: "600",
                                        color: "#cc5500",
                                    }}
                                >
                                    Waiting Time: {formatBlueCardTimer(blueCardElapsed)}
                                </div>
                            )}
                            <style jsx>{`
  .blue-card-button {
    position: relative;
    padding: 12px 24px;
    font-size: 16px;
    border-radius: 50px; /* pill shape */
    border: none;
    background-color: #007bff;
    color: white;
    cursor: pointer;
    z-index: 0;
    overflow: visible;
  }

  /* Ripple layers radiating outward */
  .blue-card-button.blink::before,
  .blue-card-button.blink::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background-color: rgba(0, 123, 255, 0.4);
    z-index: -1;
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.7;
  }

  /* First layer */
  .blue-card-button.blink::before {
    animation: pulse1 2s infinite;
  }

  /* Second layer with staggered start and longer duration */
  .blue-card-button.blink::after {
    animation: pulse2 3s infinite;
  }

  @keyframes pulse1 {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.7;
    }
    70% {
      transform: translate(-50%, -50%) scale(2);
      opacity: 0;
    }
    100% {
      transform: translate(-50%, -50%) scale(2);
      opacity: 0;
    }
  }

  @keyframes pulse2 {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.6;
    }
    70% {
      transform: translate(-50%, -50%) scale(2.5);
      opacity: 0;
    }
    100% {
      transform: translate(-50%, -50%) scale(2.5);
      opacity: 0;
    }
  }
`}</style>
                        </div>
                    )}
                </div>

                <Dialog
                    open={openBlueCardConfirm}
                    onClose={() => setOpenBlueCardConfirm(false)}
                    PaperProps={{
                        sx: {
                            borderRadius: "8px",
                            padding: "10px 20px",
                            minWidth: "420px",
                            textAlign: "center",
                        },
                    }}
                >
                    <DialogContent>
                        <div
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                border: "4px solid #f4c7a1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "10px auto",
                                color: "#f4a261",
                                fontSize: 40,
                                fontWeight: "bold",
                            }}
                        >
                            !
                        </div>
                        <p style={{ color: "#555", marginBottom: 20, fontSize: "20px" }}>
                            Enter the Route Card No to push Blue Card
                        </p>

                        <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: "14px" }}>
                            <Button
                                variant="contained"
                                sx={{
                                    backgroundColor: "#f97316",
                                    padding: "10px 20px",
                                    "&:hover": { backgroundColor: "#ea580c" },
                                }}
                                onClick={() => {
                                    setOpenBlueCardConfirm(false);   // close confirm dialog
                                    handleBlueCardPush();            // push data
                                    setOpenBlueCardSuccess(true);    // open success dialog
                                }}
                            >
                                Confirm
                            </Button>

                            <Button
                                variant="contained"
                                sx={{
                                    backgroundColor: "#6b7280",
                                    padding: "6px 20px",
                                    "&:hover": { backgroundColor: "#4b5563" },
                                }}
                                onClick={() => setOpenBlueCardConfirm(false)}
                            >
                                cancel
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={openBlueCardResponse} disableEscapeKeyDown
                    onClose={(event, reason) => {
                        if (reason !== "backdropClick") {
                            setOpenBlueCardResponse(false);
                        }
                    }}
                    PaperProps={{
                        sx: {
                            borderRadius: "12px",
                            minWidth: "380px",
                            textAlign: "center",
                            overflow: "hidden",
                            background: blueCardResponseData?.status === "OK" ? "#0b9348" : "#fd3f3f",
                        },
                    }}
                >

                    <DialogContent
                        sx={{
                            padding: "28px 32px 20px",
                            background: "#ffffff",
                            textAlign: "center",

                            borderRadius: "12px",
                            animation:
                                blueCardResponseData?.status === "OK"
                                    ? `${blinkGreenBorder} 1.5s ease-in-out infinite`
                                    : `${blinkRedBorder} 1.5s ease-in-out infinite`,
                        }}
                    >
                        {/* Icon */}
                        <div
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                background:
                                    blueCardResponseData?.status === "OK" ? "#16a34a" : "#dc2626",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 16px",
                                color: "#fff",
                                fontSize: 40,
                                fontWeight: "bold",
                            }}
                        >
                            {blueCardResponseData?.status === "OK" ? "✓" : "✗"}
                        </div>

                        {/* Status heading */}
                        <h3
                            style={{
                                margin: "0 0 6px",
                                fontSize: "23px",
                                fontWeight: 700,
                                color:
                                    blueCardResponseData?.status === "OK" ? "#16a34a" : "#dc2626",
                            }}
                        >
                            {blueCardResponseData?.status === "OK"
                                ? "Blue Card Approved"
                                : "Blue Card Rejected"}
                        </h3>

                        {/* Machine */}
                        <p style={{ marginBottom: "6px", fontSize: "16px", color: "#374151" }}>
                            <strong>Machine:</strong>{" "}
                            <span
                                style={{
                                    color:
                                        blueCardResponseData?.status === "OK"
                                            ? "#16a34a"
                                            : "#dc2626",
                                    fontWeight: 600
                                }}
                            >
                                {blueCardResponseData?.device_name || "-"}
                            </span>
                        </p>

                        {/* Time */}
                        {blueCardResponseData?.end_time && (
                            <p style={{ marginBottom: "16px", fontSize: "14px", color: "#374151" }}>
                                at{" "}
                                <strong
                                    style={{
                                        color:
                                            blueCardResponseData?.status === "OK"
                                                ? "#16a34a"
                                                : "#dc2626",
                                    }}
                                >
                                    {new Date(blueCardResponseData.end_time).toLocaleTimeString(
                                        "en-IN",
                                        {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                            hour12: true,
                                        }
                                    )}
                                </strong>
                            </p>
                        )}

                        {/* NOK details */}
                        {blueCardResponseData?.status === "NOK" && (
                            <div
                                style={{
                                    background: "#ffffff",
                                    border:
                                        blueCardResponseData?.status === "OK"
                                            ? "1px solid #bbf7d0"
                                            : "1px solid #f04343",
                                    borderRadius: "8px",
                                    padding: "14px 16px",
                                    textAlign: "left",
                                    marginBottom: "16px",
                                }}
                            >
                                <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#374151" }}>
                                    <strong>Reason:</strong>{" "}
                                    <span
                                        style={{
                                            color:
                                                blueCardResponseData?.status === "OK"
                                                    ? "#16a34a"
                                                    : "#dc2626",
                                            fontWeight: 600,
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                            whiteSpace: "normal",
                                        }}
                                    >
                                        {Array.isArray(blueCardResponseData?.reason)
                                            ? blueCardResponseData.reason.join(", ")
                                            : blueCardResponseData?.reason || "Not provided"}
                                    </span>
                                </p>

                                <p style={{ margin: 0, fontSize: "14px", color: "#374151" }}>
                                    <strong>Remark:</strong>{" "}
                                    <span
                                        style={{
                                            color:
                                                blueCardResponseData?.status === "OK"
                                                    ? "#16a34a"
                                                    : "#dc2626",
                                            fontWeight: 600,
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                            whiteSpace: "normal",
                                        }}
                                    >
                                        {blueCardResponseData?.remarks &&
                                            blueCardResponseData.remarks !== "-"
                                            ? blueCardResponseData.remarks
                                            : "Not provided"}
                                    </span>
                                </p>
                            </div>
                        )}

                        <Button
                            variant="contained"
                            sx={{
                                marginTop: 1,
                                backgroundColor:
                                    blueCardResponseData?.status === "OK" ? "#16a34a" : "#dc2626",
                                "&:hover": {
                                    backgroundColor:
                                        blueCardResponseData?.status === "OK" ? "#15803d" : "#b91c1c",
                                },
                                minWidth: 120,
                            }}
                            onClick={() => {
                                if (blueCardResponseData) {
                                    setBlueCardNotifications(prev => [...prev, { ...blueCardResponseData, receivedAt: Date.now() }]);
                                }
                                setOpenBlueCardResponse(false);
                            }}
                        >
                            OK
                        </Button>
                    </DialogContent>
                </Dialog>

            </div>
            <div className="footer1">
                <div
                    className="footer-left"
                    onClick={() => {
                        if (telemetry.jobName && telemetry.jobName !== "Route card not assigned") {
                            if (isGplastCondition) {
                                handleRejectParts();
                            } else {
                                handleRejectParts1(deviceNameIdJson[selectedMachine]);
                            }
                        }
                    }}
                    style={{ opacity: (telemetry.jobName && telemetry.jobName !== "Route card not assigned") ? 1 : 0.4, cursor: (telemetry.jobName && telemetry.jobName !== "Route card not assigned") ? "pointer" : "not-allowed" }}
                >
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
                                    {(getCustomerId() === window._env_.GPLAST_CUSTOMER_ID) && (
                                        <col style={{ width: '12%' }} />
                                    )}
                                    <col style={{ width: '36%' }} />
                                </colgroup>
                                <thead>
                                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>Start Time (IST)</th>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>End Time (IST)</th>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>Duration</th>
                                        <th style={{ border: '1px solid #ccc', padding: '8px' }}>Status</th>
                                        {(getCustomerId() === window._env_.GPLAST_CUSTOMER_ID) && (<th style={{ border: '1px solid #ccc', padding: '8px' }}>Group</th>)}
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
                                            {(getCustomerId() === window._env_.GPLAST_CUSTOMER_ID) && (
                                                <td>
                                                    <CustomDaySelect
                                                        name={`groupselected-${index}`}
                                                        value={item.groupselected || "all"}
                                                        onChange={(e) => handleGroupChange(index, e.target.value)}
                                                        label="Select Group"
                                                        options={reasonGroupOptions}
                                                    />
                                                </td>)}
                                            <td>
                                                <CustomDaySelect
                                                    name={`reasonselected-${index}`}
                                                    value={item.reasonselected || ""}
                                                    onChange={(e) => handleReasonChange(index, e.target.value)}
                                                    label="Select Reason"
                                                    required
                                                    options={
                                                        (() => {
                                                            const filtered = formattedReasons.filter(r =>
                                                                !item.groupselected || item.groupselected === "all" || r.group === item.groupselected
                                                            );
                                                            if (item.reasonselected === "UNKNOWN" && !filtered.some(r => r.value === "UNKNOWN")) {
                                                                return [{ value: "UNKNOWN", label: "UNKNOWN", group: item.groupselected }, ...filtered];
                                                            }
                                                            return filtered;
                                                        })()
                                                    }
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
            <Dialog
                open={openReject}
                onClose={() => setOpenReject(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        width: 800,
                        maxWidth: "95%",
                        borderRadius: "14px",
                        overflow: "hidden",
                    },
                }}
            >
                <div style={{
                    padding: "18px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e8eaf0",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "22px" }}>🚫</span>
                        <span style={{ fontSize: "20px", fontWeight: "600", color: "#212121", letterSpacing: "0.4px" }}>
                            Reject Parts Entry
                        </span>
                        {selectedRow?.machineName && (
                            <span style={{ fontSize: "20px", fontWeight: "600", color: "#212121" }}>
                                - {selectedRow.machineName}
                            </span>
                        )}
                        {selectedRow?.op?.operation_name && selectedRow.op.operation_name !== "No Operations" && (
                            <span style={{ fontSize: "15px", fontWeight: "500", color: "#555", marginLeft: "4px" }}>
                                ({selectedRow.op.operation_name})
                            </span>
                        )}
                    </div>
                </div>

                <DialogContent
                    sx={{
                        padding: "20px 24px",
                        background: "#fff",
                        maxHeight: "70vh",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px"
                    }}
                >
                    {selectedRow && !isFetchingBluecard && (() => {
                        const actual = Number((selectedRow.op?.goodvsexp?.split("/") || [])[0] || 0);
                        const canReject = Math.max(0, actual - (existingCount || 0));
                        const rejectedAlready = existingCount || 0;
                        const stats = [
                            { label: "Actual", value: actual, color: "#fff", bg: "#1976d2", border: "#1565c0" },
                            { label: "Rejected", value: rejectedAlready, color: "#fff", bg: "#e53935", border: "#c62828" },
                            { label: "Remaining", value: canReject, color: "#fff", bg: "#2e7d32", border: "#1b5e20" },
                        ];
                        return (
                            <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                                {stats.map(s => (
                                    <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.border}`, borderRadius: "8px", padding: "10px 8px", textAlign: "center" }}>
                                        <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.85)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{s.label}</div>
                                        <div style={{ fontSize: "24px", fontWeight: "800", color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {prevOperatorData && prevOperatorData.count > 0 && (
                        <>
                            <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "8px" }}>
                                Previously Rejected
                            </div>

                            <div
                                style={{
                                    border: "1px solid #e0e0e0",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    flexShrink: 0
                                }}
                            >
                                {/* Header */}
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "100px 1fr 1fr",
                                        background: "#f5f6fa",
                                        borderBottom: "1px solid #e0e0e0"
                                    }}
                                >
                                    {["Count", "Reason", "Remark"].map((h, i) => (
                                        <div
                                            key={h}
                                            style={{
                                                padding: "14px",
                                                fontWeight: "600",
                                                fontSize: "15px",
                                                textAlign: "center",
                                                borderRight: i !== 2 ? "1px solid #e0e0e0" : "none"
                                            }}
                                        >
                                            {h}
                                        </div>
                                    ))}
                                </div>

                                {/* Rows container */}
                                <div
                                    style={{
                                        maxHeight: "260px", // ~4 rows
                                        overflowY: "auto"
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "100px 1fr 1fr",
                                            borderBottom: "1px solid #e0e0e0",
                                            alignItems: "center",
                                            minHeight: "65px",

                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: "14px",
                                                textAlign: "center",
                                                fontSize: "15px",
                                                fontWeight: "500",
                                                borderRight: "1px solid #e0e0e0",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center"
                                            }}
                                        >
                                            {prevOperatorData.count}
                                        </div>

                                        <div
                                            style={{
                                                padding: "14px",
                                                fontSize: "15px",
                                                fontWeight: "500",
                                                borderRight: "1px solid #e0e0e0",
                                                whiteSpace: "normal",
                                                wordBreak: "break-word",
                                                textAlign: "center"
                                            }}
                                        >
                                            {Array.isArray(prevOperatorData.reason)
                                                ? prevOperatorData.reason.join(", ")
                                                : prevOperatorData.reason || "-"}
                                        </div>

                                        <div
                                            style={{
                                                padding: "14px",
                                                fontSize: "15px",
                                                fontWeight: "500",
                                                whiteSpace: "normal",
                                                wordBreak: "break-word",
                                                textAlign: "center"
                                            }}
                                        >
                                            {prevOperatorData.remark || "-"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div style={{ fontWeight: 600, fontSize: "16px" }}>Add New Reject Parts</div>

                    {rejectRows.map((row, idx) => {
                        if (row.isExisting) return null;
                        const actual = Number((selectedRow?.op?.goodvsexp?.split("/") || [])[0] || 0);
                        const allowed = Math.max(0, actual - (existingCount || 0));
                        const usedByOthers = rejectRows.reduce((sum, r, i) => i !== idx && !r.isExisting ? sum + Number(r.count || 0) : sum, 0);
                        const remaining = Math.max(0, allowed - usedByOthers);
                        return (
                            <div key={idx} style={{ display: "grid", gridTemplateColumns: "80px 260px 1fr 50px", borderBottom: "1px solid #f0f0f0", alignItems: "center", gap: "8px", padding: "6px 8px" }}>
                                <div>
                                    <TextField
                                        type="number"
                                        value={row.count}
                                        size="small"
                                        label="Count"
                                        onFocus={() => { if (row.count === 0) setRejectRows(rejectRows.map((r, i) => i === idx ? { ...r, count: "" } : r)); }}
                                        onChange={(e) => {
                                            let val = e.target.value;
                                            if (val === "") val = "";
                                            else { val = Number(val); if (val > remaining) val = remaining; if (val < 0) val = 0; }
                                            setRejectRows(rejectRows.map((r, i) => i === idx ? { ...r, count: val } : r));
                                        }}
                                        inputProps={{ min: 0, max: remaining, style: { textAlign: "center", fontWeight: "600" } }}
                                        sx={{ width: "80px", "& .MuiInputBase-root": { height: "40px" } }}
                                    />
                                </div>
                                <div>
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>Reason</InputLabel>
                                        <Select
                                            multiple
                                            label="Reason"
                                            value={row.reason || []}
                                            MenuProps={{ PaperProps: { style: { maxHeight: 220, overflowY: "auto" } } }}
                                            onChange={(e) => {
                                                const { value } = e.target;
                                                setRejectRows(rejectRows.map((r, i) => i === idx ? { ...r, reason: typeof value === "string" ? value.split(",") : value } : r));
                                            }}
                                            renderValue={(selected) => selected.length <= 2 ? selected.join(", ") : `${selected.slice(0, 2).join(", ")} ...`}
                                            sx={{ height: "40px" }}
                                        >
                                            {(qualityReasonList || []).map((item, i) => (
                                                <MenuItem key={i} value={item.reason}>
                                                    <Checkbox checked={(row.reason || []).includes(item.reason)} size="small" />
                                                    <ListItemText primary={item.reason} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </div>
                                <div>
                                    <TextField
                                        value={row.remark}
                                        size="small"
                                        label="Remark"
                                        fullWidth
                                        onChange={(e) => setRejectRows(rejectRows.map((r, i) => i === idx ? { ...r, remark: e.target.value } : r))}
                                        sx={{ "& .MuiInputBase-root": { height: "40px" } }}
                                    />
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setRejectRows(rejectRows.filter((_, i) => i !== idx))}
                                        sx={{ background: "#fafafa", border: "1px solid #e0e0e0", "&:hover": { background: "#ffeaea", color: "#d32f2f" } }}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ padding: "12px 0" }}>
                        <Button
                            variant="outlined"
                            size="small"
                            disabled={isMaxReached}
                            style={{
                                border: `1px solid ${isMaxReached ? "#bdbdbd" : "#EC6E17"}`,
                                color: isMaxReached ? "#9e9e9e" : "#EC6E17",
                                backgroundColor: "transparent",
                                cursor: isMaxReached ? "not-allowed" : "pointer"
                            }}
                            onClick={() => setRejectRows([...rejectRows, { count: 0, reason: [], remark: "", isExisting: false }])}
                        >
                            + Add Row
                        </Button>
                    </div>
                </DialogContent>

                <DialogActions sx={{ padding: "14px 24px", gap: 1.5, backgroundColor: "#f8f9fb", borderTop: "1px solid #e8eaf0" }}>
                    <Button
                        onClick={() => setOpenReject(false)}
                        variant="outlined"
                        sx={{ borderRadius: "4px", minWidth: "110px", borderColor: "#90a4ae", background: "#969392", color: "#ffffff", "&:hover": { borderColor: "#788388", background: "#a5a2a1" } }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={(() => {
                            const newRows = rejectRows.filter(row => !row.isExisting);
                            if (newRows.length === 0) return true;
                            return newRows.some(row => (Number(row.count) || 0) <= 0 || (row.reason || []).length === 0 || !row.remark);
                        })()}
                        sx={{ borderRadius: "4px", minWidth: "110px", background: "#EC6E17", "&:hover": { background: "#e08529" } }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {confirmType && handleConfirmAlert()}

            <DynamicSlidingKeyboard touchEnabled={true} />
        </div>
    );
}

export default Operator;


