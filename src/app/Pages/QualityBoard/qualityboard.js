import React, { useMemo, useEffect, useState, useRef } from "react";
import {
    customerbaseddevices,
    customerbasedshift,
    telemetrykeydata,
} from "../../Services/app/companyservice";
import { FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, } from "@mui/material";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";
import { Downtimeadd1, DowntimeaddDelete, Deviceattributeget, Downtimeadd2, DowntimeaddDelete1 } from '../../Services/app/masterservice'; import Swal from "sweetalert2";
import { getReportGenerate, getReportGenerate1, getReportToken } from "../../Services/app/reportservice";
import { cleanCustomerId } from "../../Services/app/operatorservice";

function getCurrentShift(shifts) {
    if (!Array.isArray(shifts) || shifts.length === 0) return null;
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
    return String(shifts[0].shift_no);
}

function getShiftTimes(shifts, selectedShift, selectedDate) {
    if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
        return { from: null, to: null };
    }
    const baseDate = dayjs(selectedDate).startOf("day");
    const getEpoch = (dayOffset, timeStr) =>
        baseDate
            .add(Number(dayOffset) - 1, "day")
            .hour(Number(timeStr.split(":")[0]))
            .minute(Number(timeStr.split(":")[1]))
            .second(0)
            .millisecond(0)
            .valueOf();
    if (selectedShift === "all") {
        const sorted = [...shifts].sort(
            (a, b) => Number(a.shift_no) - Number(b.shift_no)
        );
        return {
            from: getEpoch(sorted[0].start_day, sorted[0].start_time),
            to: getEpoch(
                sorted[sorted.length - 1].end_day,
                sorted[sorted.length - 1].end_time
            ),
        };
    }
    const shift = shifts.find(
        (s) => String(s.shift_no) === String(selectedShift)
    );
    if (!shift) return { from: null, to: null };
    return {
        from: getEpoch(shift.start_day, shift.start_time),
        to: getEpoch(shift.end_day, shift.end_time),
    };
}


export default function QualityBoard() {

    const customerId = localStorage.getItem("CustomerID");
    const CustomerEmail = localStorage.getItem("email");
    console.log('email', CustomerEmail);
    const isPMI = cleanCustomerId(customerId) === window._env_.CUSTOMER_ID;
    const [devices, setDevices] = useState([]);
    const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
    const [shifts, setShifts] = useState([]);
    const [selectedShift, setSelectedShift] = useState("all");
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState("all");
    const [operationsData, setOperationsData] = useState([]);
    const [openReject, setOpenReject] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [rejectCount, setRejectCount] = useState(0);
    const [rejectReason, setRejectReason] = useState([]);
    const [reasonError, setReasonError] = useState(false);
    const [countError, setCountError] = useState(false);
    const [countPopup, setCountPopup] = useState(false);
    const [operatorrejectdata, setOperatorRejectData] = useState({
        operator_count: 0,
        operator_reason: "",
        operator_remark: "",
        operator_email: ""
    });
    const [existingCount, setExistingCount] = useState(0);
    const [existingBluecardEmail, setBluecardEmail] = useState(0);
    const [existingBluecardCount, setExistingBluecardCount] = useState(0);
    const [existingBluecardReason, setExistingBluecardReason] = useState("");
    const [existingQualityCount, setExistingQualityCount] = useState(0);
    const [existingQualityReason, setExistingQualityReason] = useState("");
    const [isFetchingBluecard, setIsFetchingBluecard] = useState(false);
    const [qualityReasonList, setQualityReasonList] = useState([]);
    const [existingBluecardRemark, setExistingBluecardRemark] = useState("");
    const [existingQualityRemark, setExistingQualityRemark] = useState("");
    const [rejectionData, setRejectionData] = useState({});
    const [remark, setRemark] = useState("");
    const [remarkError, setRemarkError] = useState(false);
    const [componentData, setComponentData] = useState([]);
    const [isBeforeFirstShift, setIsBeforeFirstShift] = useState(false);
    const [qualityEntryRecordsData, setQualityEntryRecordsData] = useState({});
    const [logsDialogOpen, setLogsDialogOpen] = useState(false);
    const [logsDialogMachine, setLogsDialogMachine] = useState("");
    const [logsDialogRecords, setLogsDialogRecords] = useState([]);
    const [rejectRows, setRejectRows] = useState([{ count: 0, reason: [], remark: "" }]);
    const [newRejectRows, setNewRejectRows] = useState([]);

    const autoFetchDone = useRef(false);

    const {
        deviceNameID,
        machineGroups,
        availableMachines,
        selectedMachines,
        selectedGroups,
        showMachineGroupsDropdown,
        isAllMachinesSelected,
        handleGroupChange,
        handleMachineChange
    } = useMachineGroups(customerId);

    const fetchDevices = async () => {
        try {
            const result = await customerbaseddevices(customerId, 100, 0);
            const devicesList = result?.data || [];
            setDevices(devicesList);
            const map = devicesList.reduce((acc, d) => {
                acc[d.id.id] = d.name;
                return acc;
            }, {});
            setDeviceNameIdJson(map);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchShifts = async () => {
        try {
            const shiftResult = await customerbasedshift(customerId, "allShift");
            const shiftData = shiftResult?.[0]?.value || [];
            setShifts(shiftData);
            const qualityResult = await customerbasedshift(
                customerId,
                "qualityreason"
            );
            const qualityData = qualityResult?.[0]?.value || [];
            setQualityReasonList(qualityData);
            const ComponentResult = await customerbasedshift(
                customerId,
                "component"
            );
            const ComponentList = ComponentResult?.[0]?.value || [];
            setComponentData(ComponentList);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchDevices();
        fetchShifts();
    }, []);

    useEffect(() => {
        if (shifts.length > 0) {
            const currentShift = getCurrentShift(shifts);
            setSelectedShift(currentShift);
        }
    }, [shifts]);

    useEffect(() => {
        if (!selectedDate || !shifts?.length) return;
        const { from, to } = getShiftTimes(shifts, selectedShift, selectedDate);
        if (from !== null && to !== null) {
            setFrom(from);
            setTo(to);
        }
    }, [selectedShift, selectedDate, shifts]);

    useEffect(() => {
        if (!shifts?.length) return;

        const firstShift = [...shifts].sort(
            (a, b) => Number(a.shift_no) - Number(b.shift_no)
        )[0];
        if (!firstShift) return;
        const { from } = getShiftTimes(
            shifts,
            String(firstShift.shift_no),
            dayjs()
        );
        if (!from) return;

        const now = dayjs();
        const shiftStart = dayjs(from);

        if (now.isBefore(shiftStart)) {
            setIsBeforeFirstShift(true);
            setSelectedDate(dayjs().subtract(1, 'day'));

            const msUntilStart = shiftStart.diff(now);
            const timer = setTimeout(() => {
                setIsBeforeFirstShift(false);
                setSelectedDate(dayjs());
            }, msUntilStart);

            return () => clearTimeout(timer);
        } else {
            setIsBeforeFirstShift(false);
        }
    }, [shifts]);

    const timeToMs = (timeStr) => {
        const [h, m, s] = timeStr.split(":").map(Number);
        return ((h * 60 + m) * 60 + s) * 1000;
    };

    const getISTTimeMs = (epoch) => {
        const istDate = new Date(
            new Date(epoch).toLocaleString("en-US", {
                timeZone: "Asia/Kolkata"
            })
        );
        return (
            istDate.getHours() * 3600000 +
            istDate.getMinutes() * 60000 +
            istDate.getSeconds() * 1000
        );
    };

    const findShiftByStartTime = (startEpoch, shifts) => {
        const timeMs = getISTTimeMs(startEpoch);
        const sortedShifts = [...shifts].sort(
            (a, b) => Number(a.shift_no) - Number(b.shift_no)
        );
        for (const shift of sortedShifts) {
            const shiftStartMs = timeToMs(shift.start_time);
            const shiftEndMs = timeToMs(shift.end_time);
            const startDay = Number(shift.start_day);
            const endDay = Number(shift.end_day);

            if (startDay === 1 && endDay === 1) {
                if (timeMs >= shiftStartMs && timeMs < shiftEndMs) {
                    return shift.shift_no;
                }
            }
            if (startDay === 1 && endDay === 2) {
                if (timeMs >= shiftStartMs || timeMs < shiftEndMs) {
                    return shift.shift_no;
                }
            }
            if (startDay === 2 && endDay === 2) {
                if (timeMs >= shiftStartMs && timeMs < shiftEndMs) {
                    return shift.shift_no;
                }
            }
        }
        return null;
    };


    const selectedDeviceIds = useMemo(
        () =>
            deviceNameID
                .filter((d) => selectedMachines.includes(d.name))
                .map((d) => d.id),
        [deviceNameID, selectedMachines]
    );

    const fetchTelemetryData = async () => {
        if (!from || !to) return;
        const devicesToFetch =
            selectedDevice === "all"
                ? selectedDeviceIds
                : [selectedDevice];
        try {
            const machineWiseResults = await Promise.all(
                devicesToFetch.map(async (deviceId) => {
                    try {
                        const data = await telemetrykeydata(
                            deviceId,
                            "DEVICE",
                            ["operations", "rejection", "qualityentryrecords"],
                            from,
                            to
                        );
                        const rawOperations = data?.operations || [];
                        const parsedOperations = rawOperations
                            .map((item) => {
                                try {
                                    const parsedValue =
                                        typeof item.value === "string"
                                            ? JSON.parse(item.value)
                                            : item.value;
                                    return {
                                        ts: item.ts,
                                        ...parsedValue,
                                    };
                                } catch {
                                    return null;
                                }
                            })
                            .filter(Boolean);

                        const rawRejection = data?.rejection || [];
                        const parsedRejection = rawRejection
                            .map((item) => {
                                try {
                                    const parsedValue =
                                        typeof item.value === "string"
                                            ? JSON.parse(item.value)
                                            : item.value;

                                    return {
                                        ts: item.ts,
                                        ...parsedValue,
                                    };
                                } catch {
                                    return null;
                                }
                            })
                            .filter(Boolean);

                        const rawQualityEntryRecords = data?.qualityentryrecords || [];

                        return {
                            deviceName:
                                deviceNameIdJson[deviceId] || deviceId,
                            operations: parsedOperations,
                            rejection: parsedRejection,
                            qualityEntryRecords: rawQualityEntryRecords,
                        };
                    } catch {
                        return {
                            deviceName:
                                deviceNameIdJson[deviceId] || deviceId,
                            operations: [],
                            rejection: [],
                        };
                    }
                })
            );

            const machineWiseData = {};
            const machineWiseRejectData = {};
            const machineWiseQualityEntryRecords = {};

            machineWiseResults.forEach(
                ({ deviceName, operations, rejection, qualityEntryRecords }) => {
                    machineWiseData[deviceName] = operations.map((op) => {
                        const shiftNo = findShiftByStartTime(op.ts, shifts);
                        return {
                            ...op,
                            shift: shiftNo,
                        };
                    });

                    machineWiseRejectData[deviceName] = rejection.map((rej) => {
                        const shiftNo = findShiftByStartTime(rej.ts, shifts);
                        return {
                            ...rej,
                            shift: shiftNo,
                        };
                    });

                    machineWiseQualityEntryRecords[deviceName] = (qualityEntryRecords || []).sort(
                        (a, b) => b.ts - a.ts
                    );
                }
            );
            setOperationsData(machineWiseData);
            setRejectionData(machineWiseRejectData);
            setQualityEntryRecordsData(machineWiseQualityEntryRecords);
        } catch (err) {
            console.error("❌ Operator Data Fetch Failed", err);
        }
    };
    console.log('quality entry data', qualityEntryRecordsData);
    useEffect(() => {
        if (!from || !to || selectedDeviceIds.length === 0 || autoFetchDone.current) return;
        autoFetchDone.current = true;
        fetchTelemetryData();
    }, [from, to, selectedDeviceIds]);

    const mergeOperationsWithRejection = (opsData, rejData, componentData) => {
        const result = {};
        const componentMap = new Map(
            (componentData || []).map(c => [c.component_number, c.operation_number])
        );
        Object.keys(opsData || {}).forEach(machine => {
            const opsList = opsData[machine] || [];
            const rejList = rejData[machine] || [];
            const rejectionMap = new Map(rejList.map(r => [Number(r.ts), r]));
            result[machine] = opsList.map(op => {
                const opStartTs = Number(op.start_time);
                const matchedRejection = rejectionMap.get(opStartTs);

                const operation_number = componentMap.get(op.code) || "";

                return {
                    ...op,
                    rejection_info: {
                        qualityreason: matchedRejection?.qualityreason || "",
                        quality_remark: matchedRejection?.quality_remark || "",
                        quality_customer_email: matchedRejection?.quality_customer_email || "",
                        quality_rows: matchedRejection?.quality_rows || [],
                    },
                    operation_number,
                };
            });
        });
        return result;
    };

    const mergedData = useMemo(() => {
        return mergeOperationsWithRejection(
            operationsData,
            rejectionData,
            componentData
        );
    }, [operationsData, rejectionData, componentData]);

    console.log('mergedData', mergedData)

    const thStyle = {
        padding: "12px 14px",
        fontWeight: "600",
        height: "50px",
        textAlign: "center",
        fontSize: "14px",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
    };

    const tdStyle = {
        padding: "10px 12px",
        fontSize: "14px",
        fontWeight: "400",
        textAlign: "center",
        verticalAlign: "middle",
        whiteSpace: "normal",
        wordBreak: "break-word",
        border: "1px solid #e8ecef",
    };

    const openRejectPopup = async (machineName, op) => {
        setSelectedRow({ machineName, op });
        setExistingBluecardCount(0);
        setExistingBluecardReason("");
        setExistingQualityCount(0);
        setExistingQualityReason("");
        setExistingQualityRemark("");
        setExistingBluecardRemark("");
        setRejectRows([{ count: 0, reason: [], remark: "" }]);
        setOperatorRejectData({
            operator_count: 0,
            operator_reason: "",
            operator_remark: "",
            operator_email: ""
        });
        setOpenReject(true);
        setIsFetchingBluecard(true);

        const deviceId = Object.keys(deviceNameIdJson).find(
            (id) => deviceNameIdJson[id] === machineName
        );
        if (deviceId && op.start_time) {
            try {
                const startTs = op.start_time;
                const data = await telemetrykeydata(
                    deviceId,
                    "DEVICE",
                    "rejection",
                    startTs - 1000,
                    startTs + 1000
                );
                const rejectionEntries = data?.rejection || [];
                if (rejectionEntries.length > 0) {
                    const parsed = rejectionEntries
                        .map((p) => {
                            try {
                                return typeof p.value === "string"
                                    ? JSON.parse(p.value)
                                    : p.value;
                            } catch {
                                return null;
                            }
                        })
                        .filter(Boolean);
                    if (parsed.length > 0) {
                        const entry = parsed[0];

                        const blueCount = Number(entry?.bluecard_count || 0);
                        const qualCount = Number(entry?.qualitycount || 0);
                        const Count = Number(entry?.count || 0);

                        setExistingCount(Count);
                        setExistingBluecardCount(blueCount);
                        setExistingBluecardReason(entry?.bluecard_reason || "");
                        setExistingBluecardRemark(entry?.bluecard_remark || "");
                        setBluecardEmail(entry?.bluecard_email || "")
                        setExistingQualityCount(qualCount);
                        const operatorCount = Number(entry?.operator_count || 0);
                        const operatorReason = entry?.operator_reason || "";
                        const operatorRemark = entry?.operator_remark || "";
                        const operatorEmail = entry?.operator_email || "";

                        setOperatorRejectData({
                            operator_count: operatorCount,
                            operator_reason: operatorReason,
                            operator_remark: operatorRemark,
                            operator_email: operatorEmail
                        });

                        const qualReasonRaw = entry?.qualityreason || [];
                        const qualReasonArr = Array.isArray(qualReasonRaw)
                            ? qualReasonRaw
                            : qualReasonRaw
                                ? String(qualReasonRaw).split(",").map(s => s.trim()).filter(Boolean)
                                : [];

                        const qualRemark = entry?.quality_remark || "";

                        setExistingQualityReason(qualReasonArr);
                        setExistingQualityRemark(qualRemark);

                        if (Array.isArray(entry?.quality_rows) && entry.quality_rows.length > 0) {
                            const rows = entry.quality_rows.map(row => ({
                                count: Number(row?.count || 0),
                                reason: Array.isArray(row?.reason)
                                    ? row.reason
                                    : row?.reason
                                        ? [row.reason]
                                        : [],
                                remark: row?.remark || "",
                                isExisting: true
                            }));
                            setRejectRows(rows);

                        } else if (qualCount > 0) {
                            setRejectRows([{
                                count: qualCount,
                                reason: qualReasonArr,
                                remark: qualRemark,
                                isExisting: true
                            }]);
                        }
                    }
                }
            } catch (err) {
                console.warn("Failed to fetch bluecard data", err);
            }
        }
        setIsFetchingBluecard(false);
    };

    console.log('operations data', operationsData);
    console.log('rejction data', rejectionData);
    console.log('shifts', shifts);
    console.log('from', from, 'to', to)
    console.log('selected device id', selectedDevice)
    console.log('deviceNameIdJson', deviceNameIdJson)
    console.log('selected device', selectedMachines)
    console.log('selected device id ', selectedDeviceIds);

    const postQualityLog = async (deviceId, count, machineName, componentName) => {
        const currentTime = dayjs().format("DD-MM-YYYY HH:mm:ss");
        const logMessage = `CustomerEmail: ${CustomerEmail}, LogMessage: rejected ${count} parts, Component: ${componentName}, Machine: ${machineName}, Time: ${currentTime}, Shift: ${selectedShift}`;
        const logKey = {
            qualityentryrecords: logMessage,
        };
        try {
            await Downtimeadd1("DEVICE", deviceId, "SERVER_SCOPE", logKey);
        } catch (err) {
            console.warn("Failed to post quality log", err);
        }
    };

    const handleSave = async () => {
        setOpenReject(false)
        if (!selectedRow) return;

        const totalNewRejectCount = rejectRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
        const allReasons = [...new Set(rejectRows.flatMap(row => Array.isArray(row.reason) ? row.reason : [row.reason]).filter(Boolean))];
        const combinedRemark = rejectRows.map(row => row.remark).filter(Boolean).join("; ");

        let hasError = false;

        const hasExistingQuality =
            existingQualityCount !== null &&
            existingQualityCount !== undefined &&
            existingQualityCount !== "-" &&
            Number(existingQualityCount) > 0;

        if (!hasExistingQuality) {
            if (totalNewRejectCount <= 0) {
                hasError = true;
            }
        }
        if (hasError) return;

        const { machineName, op } = selectedRow;
        const [actual = 0] = (op.goodvsexp?.split("/") || []).map(Number);

        const deviceId = Object.keys(deviceNameIdJson).find(
            (id) => deviceNameIdJson[id] === machineName
        );
        console.log('edit device id', deviceId)
        if (!deviceId) {
            console.error("Device ID not found");
            return;
        }

        const qualityCount = totalNewRejectCount;
        const bluecardCount = existingBluecardCount || 0;
        const totalRejectCount = bluecardCount + qualityCount + operatorrejectdata.operator_count;

        setOperationsData((prev) => {
            const updated = { ...prev };
            updated[machineName] = updated[machineName].map((item) => {
                if (item === op) {
                    const newGood = Math.max(0, actual - totalRejectCount);
                    return {
                        ...item,
                        rejected: totalRejectCount,
                        goodparts: newGood,
                        rejectReason: rejectReason,
                    };
                }
                return item;
            });
            return updated;
        });

        const qualityRowsJson = rejectRows.map(row => ({
            count: Number(row.count) || 0,
            reason: Array.isArray(row.reason) ? row.reason : [row.reason],
            remark: row.remark || "",
            email: CustomerEmail
        }));

        const qualityReasonCombined = [
            ...new Set(
                qualityRowsJson.flatMap(r => r.reason).filter(Boolean)
            )
        ];

        const qualityRemarkCombined = qualityRowsJson
            .map(r => r.remark)
            .filter(Boolean)
            .join(", ");

        const finalReason = [
            ...new Set([
                ...qualityReasonCombined,
                ...(Array.isArray(existingBluecardReason)
                    ? existingBluecardReason
                    : [existingBluecardReason]),
                ...(Array.isArray(operatorrejectdata.operator_reason)
                    ? operatorrejectdata.operator_reason
                    : [operatorrejectdata.operator_reason])
            ])
        ].filter(Boolean);

        const finalRemark = [
            existingBluecardRemark,
            qualityRemarkCombined,
            operatorrejectdata.operator_remark
        ]
            .filter(Boolean)
            .join(" , ");


        const key = {
            ts: op.start_time,
            values: {
                rejection: {
                    operator_count: operatorrejectdata.operator_count,
                    operator_reason: operatorrejectdata.operator_reason,
                    operator_remark: operatorrejectdata.operator_remark,
                    operator_email: operatorrejectdata.operator_email,
                    bluecard_count: bluecardCount,
                    bluecard_reason: existingBluecardReason,
                    bluecard_remark: existingBluecardRemark,
                    bluecard_email: existingBluecardEmail,
                    qualitycount: qualityCount,
                    qualityreason: qualityReasonCombined || [],
                    quality_remark: qualityRemarkCombined || "",
                    quality_rows: qualityRowsJson,
                    count: totalRejectCount || 0,
                    reason: finalReason.length ? finalReason : [],
                    remark: finalRemark || "",
                    shift: selectedShift,
                    quality_customer_email: CustomerEmail
                },
            },
        };

        try {
            await Downtimeadd1("DEVICE", deviceId, "SERVER_SCOPE", key);
            const deltaRejectCount = totalNewRejectCount - (Number(existingQualityCount) || 0);
            await postQualityLog(deviceId, deltaRejectCount > 0 ? deltaRejectCount : totalNewRejectCount, machineName, op.operation_name);
            await Swal.fire({
                icon: "success",
                title: "Saved",
                text: "Rejection data updated successfully",
                timer: 1500,
                showConfirmButton: false,
            });
            const formattedDate = dayjs(selectedDate).format("YYYY-MM-DD");
            console.log(formattedDate);
            let rejectcall = getReportGenerate(formattedDate);
            console.log("reject call", rejectcall);

            const todayStr = dayjs().format("YYYY-MM-DD");
            const selectedDateStr = dayjs(selectedDate).format("YYYY-MM-DD");
            const currentShift = getCurrentShift(shifts);

            const isToday = selectedDateStr === todayStr;
            const rowShift = op.shift;
            const isCurrentShift = String(rowShift) === String(currentShift);
            const isLiveShift = isToday && isCurrentShift;

            await handleLoginAndFetch(machineName,
                formattedDate,
                rowShift,
                isLiveShift ? "true" : "false")

            await fetchTelemetryData();

            console.log("telemetry data called ------------");
            setOpenReject(false);
            setRejectRows([{ count: 0, reason: [], remark: "" }]);
        } catch (err) {
            console.error("Post failed", err);
        }
        console.log('telemetry data called ------------')
    };


    const handleLoginAndFetch = async (machineName,
        formattedDate,
        selectedShift,
        isLiveShift) => {
        try {
            const loginRes = await getReportToken(
                isPMI ? "pmi" : "gd",
                isPMI ? "pmi" : "gd"
            ); const token = loginRes?.accessToken;
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

    const formatReason = (val) => {
        if (!val) return "-";
        if (Array.isArray(val)) {
            return val.map(v => String(v).trim()).filter(Boolean).join(", ");
        }
        if (typeof val === "string") {
            return val.split(",").map(s => s.trim()).filter(Boolean).join(", ");
        }
        return "-";
    };

    const handleSubmit = () => {
        fetchTelemetryData();
    };

    const handleExport = () => {
        const headers = ["S.no", "Date", "Machine", "Shift", "Component Name", "Component Number", "Actual", "Good Parts", "Total Rejected", "Quality Reject", "Reason", "Remark", "Rejected By", "Last Updated Time"];
        const dateStr = dayjs(selectedDate).format("DD-MM-YYYY");
        const csvRows = [];
        let rowNum = 1;

        const allRows = Object.entries(mergedData || {}).flatMap(([machineName, operations]) => {
            if (!Array.isArray(operations)) return [];
            const filtered = operations.filter((op) => {
                const [actual = 0] = (op.goodvsexp?.split("/") || []).map(Number);
                if (op?.operation_name && actual < 1) return false;
                if (op.operation_name === "No Operations") return actual > 0;
                return !!op?.operation_name;
            });
            const latestMap = new Map();
            filtered.forEach((op) => {
                const key = [op.operation_name, op.code, op.start_time, op.end_time].join("|");
                const existing = latestMap.get(key);
                if (!existing || (op.ts || 0) > (existing.op.ts || 0)) {
                    latestMap.set(key, { machineName, op });
                }
            });
            return Array.from(latestMap.values());
        });

        allRows.sort((a, b) => (a.op.shift || 99) - (b.op.shift || 99));

        allRows.forEach(({ machineName, op }) => {
            const [actual = 0] = (op.goodvsexp?.split("/") || []).map(Number);
            const rejected = op.rejected ?? 0;
            const goodParts = op.goodparts ?? Math.max(0, actual - rejected);
            const qualityRows = op?.rejection_info?.quality_rows;
            const hasQualityRows = Array.isArray(qualityRows) && qualityRows.length > 0;
            const respondedBy = op?.rejection_info?.quality_customer_email || "-";
            const lastUpdated = qualityEntryRecordsData[machineName]?.[0]?.ts
                ? dayjs(qualityEntryRecordsData[machineName][0].ts).format("DD-MM-YYYY HH:mm:ss")
                : "-";

            if (hasQualityRows) {
                qualityRows.forEach((qRow, idx) => {
                    const reason = Array.isArray(qRow.reason) ? qRow.reason.join(", ") || "-" : qRow.reason || "-";
                    csvRows.push([
                        idx === 0 ? rowNum : "",
                        dateStr,
                        machineName,
                        op.shift ?? "-",
                        op.operation_name || "No Operations",
                        op.code || "-",
                        idx === 0 ? actual : "",
                        idx === 0 ? goodParts : "",
                        idx === 0 ? rejected : "",
                        qRow.count ?? 0,
                        reason,
                        qRow.remark || "-",
                        respondedBy,
                        idx === 0 ? lastUpdated : "",
                    ]);
                });
            } else {
                const reason = Array.isArray(op?.rejection_info?.qualityreason)
                    ? op.rejection_info.qualityreason.join(", ") || "-"
                    : op?.rejection_info?.qualityreason || "-";
                csvRows.push([
                    rowNum,
                    dateStr,
                    machineName,
                    op.shift ?? "-",
                    op.operation_name || "No Operations",
                    op.code || "-",
                    actual,
                    goodParts,
                    rejected,
                    0,
                    reason,
                    op?.rejection_info?.quality_remark || "-",
                    respondedBy,
                    lastUpdated,
                ]);
            }
            rowNum++;
        });

        const csvContent = [headers, ...csvRows]
            .map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quality_board_${dayjs(selectedDate).format("DD-MM-YYYY")}_shift${selectedShift}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const componentCode = selectedRow?.op?.code;
    const machineOpsForComponent = selectedRow
        ? (mergedData[selectedRow.machineName] || []).filter(op => op.code === componentCode && op.shift == selectedRow?.op?.shift)
        : [];
    const componentActual = machineOpsForComponent.reduce((sum, op) =>
        sum + Number((op.goodvsexp?.split("/") || [])[0] || 0), 0);
    const compRejList = rejectionData[selectedRow?.machineName] || [];
    const compRejMap = new Map(compRejList.map(r => [Number(r.ts), r]));
    const componentRejected = machineOpsForComponent.reduce((sum, op) => {
        const rej = compRejMap.get(Number(op.start_time));
        return sum + Number(rej?.count || 0);
    }, 0);
    const allowed = Math.max(0, componentActual - componentRejected);
    const totalNewCount = rejectRows.reduce((sum, r) => {
        if (!r.isExisting) {
            return sum + Number(r.count || 0);
        }
        return sum;
    }, 0);
    const isMaxReached = totalNewCount >= allowed;
    const existingRows = rejectRows.filter(r => r.isExisting);

    const allComponentExistingRows = (() => {
        if (!selectedRow) return [];
        const code = selectedRow.op?.code;
        const compOps = (mergedData[selectedRow.machineName] || []).filter(op => op.code === code && op.shift == selectedRow?.op?.shift);
        const rejList = rejectionData[selectedRow.machineName] || [];
        const rejMap = new Map(rejList.map(r => [Number(r.ts), r]));
        const rows = [];
        compOps.forEach(op => {
            const rej = rejMap.get(Number(op.start_time));
            if (rej?.quality_rows?.length > 0) {
                rej.quality_rows.forEach(row => rows.push({
                    count: Number(row.count || 0),
                    reason: Array.isArray(row.reason) ? row.reason : row.reason ? [row.reason] : [],
                    remark: row.remark || ""
                }));
            } else if (Number(rej?.qualitycount) > 0) {
                const r = rej.qualityreason;
                rows.push({
                    count: Number(rej.qualitycount),
                    reason: Array.isArray(r) ? r : r ? [r] : [],
                    remark: rej.quality_remark || ""
                });
            }
        });
        return rows;
    })();

    const { operator_count, operator_reason } = operatorrejectdata;

    const rejectionCount = isPMI ? existingBluecardCount : operator_count;
    const rejectionReason = isPMI ? existingBluecardReason : operator_reason;
    const rejectionLabel = isPMI ? "Blue Card Rejection :" : "Operator Rejection :";


    return (
        <div style={{ padding: "20px", minHeight: "90vh", backgroundColor: "white" }}>
            <style>{`
                .qb-thin-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
                .qb-thin-scroll::-webkit-scrollbar-track { background: transparent; }
                .qb-thin-scroll::-webkit-scrollbar-thumb { background-color: #bbb; border-radius: 4px; }
                .qb-thin-scroll::-webkit-scrollbar-thumb:hover { background-color: #ebebeb; }
               
            `}</style>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    padding: "20px",
                    flexWrap: "wrap",
                }}
                className="company-dashboard"
            >
                <h4><b>Quality Entry Dashboard</b></h4>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                        flexWrap: "wrap",
                    }}
                >
                    {showMachineGroupsDropdown && (
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ fontSize: '14px', color: '#000' }}>
                                Machine Group
                            </InputLabel>
                            <Select
                                multiple
                                value={selectedGroups}
                                onChange={(e) => handleGroupChange(e.target.value)}
                                label="Machine Group"
                                renderValue={(selected) => {
                                    if (selected.length === machineGroups.length)
                                        return "All Groups";
                                    if (selected.length === 0)
                                        return "Select Groups";
                                    return (
                                        selected.slice(0, 2).join(", ") +
                                        (selected.length > 2 ? "..." : "")
                                    );
                                }}
                            >
                                <MenuItem value="all">
                                    <Checkbox
                                        checked={
                                            selectedGroups.length === machineGroups.length
                                        }
                                    />
                                    <ListItemText primary="All" />
                                </MenuItem>

                                {machineGroups.map((g) => (
                                    <MenuItem key={g.name} value={g.name}>
                                        <Checkbox
                                            checked={selectedGroups.includes(g.name)}
                                        />
                                        <ListItemText primary={g.name} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel sx={{ fontSize: '14px', color: '#000' }}>
                            Machines
                        </InputLabel>
                        <Select
                            multiple
                            value={selectedMachines}
                            onChange={(e) => handleMachineChange(e.target.value)}
                            label="Machines"
                            renderValue={(selected) =>
                                isAllMachinesSelected
                                    ? "All Machines"
                                    : selected.slice(0, 2).join(", ") +
                                    (selected.length > 2 ? "..." : "")
                            }
                        >
                            <MenuItem value="all">
                                <Checkbox checked={isAllMachinesSelected} />
                                <ListItemText primary="All Machines" />
                            </MenuItem>
                            {availableMachines.map((machine) => (
                                <MenuItem key={machine} value={machine}>
                                    <Checkbox
                                        checked={selectedMachines.includes(machine)}
                                    />
                                    <ListItemText primary={machine} />
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Shifts</InputLabel>
                        <Select
                            value={selectedShift}
                            label="Shifts"
                            onChange={(e) => setSelectedShift(e.target.value)}
                        >
                            <MenuItem value="all">All Shifts</MenuItem>
                            {shifts.map((s) => {
                                const isToday =
                                    dayjs(selectedDate).format("YYYY-MM-DD") ===
                                    dayjs().format("YYYY-MM-DD");

                                const shiftDate = dayjs(selectedDate).add(
                                    Number(s.start_day) - 1,
                                    "day"
                                );

                                const shiftStart = dayjs(
                                    `${shiftDate.format("YYYY-MM-DD")}T${s.start_time}`
                                ).valueOf();

                                const isDisabled = isToday && shiftStart > Date.now();

                                return (
                                    <MenuItem
                                        key={s.shift_no}
                                        value={String(s.shift_no)}
                                        disabled={isDisabled}
                                    >
                                        Shift {s.shift_no}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>

                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            label="Select Date"
                            value={selectedDate}
                            onChange={(newValue) => {
                                if (!newValue) return;
                                setSelectedDate(newValue);
                            }}
                            maxDate={dayjs()}
                            shouldDisableDate={(date) => isBeforeFirstShift && date.isSame(dayjs(), 'day')}
                            slotProps={{
                                textField: { size: "small", sx: { minWidth: 160 } },
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
                            '&.Mui-disabled': { background: '#f4780380' },
                            textTransform: 'none',
                            fontWeight: 'bold',
                            gap: '8px'
                        }}
                    >
                        Submit
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={handleExport}
                        sx={{
                            minWidth: 120,
                            height: 40,
                            borderColor: '#f47803',
                            color: '#f47803',
                            '&:hover': { borderColor: '#f47803', color: '#f47803', background: '#fff8f0' },
                            textTransform: 'none',
                            fontWeight: 'bold',
                        }}
                    >
                        Export CSV
                    </Button>
                </div>
            </div>

            <div
                style={{
                    marginTop: "10px",
                    border: "1px solid #cfd8dc",
                    borderRadius: "10px",
                    overflowX: "auto",
                }}
            >
                <div
                    style={{
                        height: "74vh",
                        width: "100%",
                        overflowY: "auto",
                        overflowX: "auto",
                    }}
                >
                    <table
                        style={{
                            minWidth: "1600px",
                            width: "100%",
                            fontSize: "14px",
                        }}
                    >
                        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                            <tr style={{ background: "#808183", color: "white" }}>
                                <th style={thStyle}>S.no</th>
                                <th style={thStyle}>Date</th>
                                <th style={thStyle}>Machine</th>
                                <th style={thStyle}>Shift</th>
                                <th style={thStyle}>Component Name</th>
                                <th style={thStyle}>Component Number</th>
                                <th style={thStyle}>Actual</th>
                                <th style={thStyle}>Good Parts</th>
                                <th style={thStyle}>Total Reject</th>
                                <th style={thStyle}>Quality Reject</th>
                                <th style={thStyle}>Reason</th>
                                <th style={thStyle}>Remark</th>
                                <th style={thStyle}>Rejected By</th>
                                <th style={thStyle}>Edit</th>
                                <th style={thStyle}>Last Updated Time</th>
                                <th style={thStyle}>Logs</th>
                            </tr>
                        </thead>

                        <tbody>
                            {(() => {
                                let rowNumber = 1;

                                const allRows = Object.entries(mergedData || {}).flatMap(
                                    ([machineName, operations]) => {
                                        if (!Array.isArray(operations)) return [];
                                        const filtered = operations.filter((op) => {
                                            const [actual = 0] =
                                                (op.goodvsexp?.split("/") || []).map(Number);
                                            if (op?.operation_name && actual < 1) return false;

                                            if (op.operation_name === "No Operations") {
                                                return actual > 0;
                                            }
                                            return !!op?.operation_name;
                                        });

                                        const latestMap = new Map();
                                        filtered.forEach((op) => {
                                            const key = [
                                                op.operation_name,
                                                op.code,
                                                op.start_time,
                                                op.end_time,
                                            ].join("|");

                                            const existing = latestMap.get(key);

                                            if (!existing || (op.ts || 0) > (existing.op.ts || 0)) {
                                                latestMap.set(key, {
                                                    machineName,
                                                    op,
                                                    key: `${machineName}-${key}`,
                                                });
                                            }
                                        });
                                        return Array.from(latestMap.values());
                                    }
                                );
                                allRows.sort(
                                    (a, b) => (a.op.shift || 99) - (b.op.shift || 99)
                                );

                                if (allRows.length === 0) {
                                    return (
                                        <tr style={{ height: "60vh" }}>
                                            <td
                                                colSpan={11}
                                                style={{
                                                    textAlign: "center",
                                                    verticalAlign: "middle",
                                                    color: "#666",
                                                    fontWeight: 500,
                                                    fontSize: "16px",
                                                }}
                                            >
                                                No records
                                            </td>
                                        </tr>
                                    );
                                }

                                return allRows.map(({ machineName, op, key }) => {
                                    const [actual = 0] =
                                        (op.goodvsexp?.split("/") || []).map(Number);
                                    const rejected = op.rejected ?? 0;
                                    const goodParts =
                                        op.goodparts ?? Math.max(0, actual - rejected);
                                    const qualityRows = op?.rejection_info?.quality_rows;
                                    const hasQualityRows = Array.isArray(qualityRows) && qualityRows.length > 0;
                                    const rowBg = rowNumber % 2 === 0 ? "#f8fafb" : "#ffffff";
                                    const sno = rowNumber++;

                                    const centeredTdStyle = { ...tdStyle, verticalAlign: "middle" };

                                    const nestedContainerStyle = {
                                        maxHeight: hasQualityRows && qualityRows.length > 3 ? "132px" : "none",
                                        overflowY: hasQualityRows && qualityRows.length > 3 ? "auto" : "visible",
                                        scrollbarWidth: "thin",
                                        scrollbarColor: "#bbb transparent",
                                    };

                                    const nestedItemBase = {
                                        padding: "12px 10px",
                                        textAlign: "center",
                                        height: "60px",
                                        boxSizing: "border-box",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "14px",
                                        fontWeight: "400",
                                        overflow: "hidden",
                                    };

                                    const scrollTextStyle = {
                                        maxHeight: "3rem",
                                        overflowY: "auto",
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                        width: "100%",
                                        textAlign: "center",
                                        scrollbarWidth: "thin",
                                        scrollbarColor: "#bbb transparent",
                                    };

                                    return (
                                        <tr key={key} className="qb-table-row" style={{ background: rowBg, textAlign: "center" }}>
                                            <td style={centeredTdStyle}>{sno}</td>
                                            <td style={{ ...centeredTdStyle, minWidth: "110px" }}>
                                                {dayjs(selectedDate).format("DD-MM-YYYY")}
                                            </td>
                                            <td style={{ ...centeredTdStyle, minWidth: "150px" }}>{machineName}</td>
                                            <td style={centeredTdStyle}>{op.shift}</td>
                                            <td style={{ ...centeredTdStyle, minWidth: "160px" }}>
                                                {op.operation_name || "No Operations"}
                                            </td>
                                            <td style={centeredTdStyle}>{op.code || "-"}</td>
                                            <td style={centeredTdStyle}>{actual}</td>
                                            <td style={centeredTdStyle}>{goodParts}</td>
                                            <td style={centeredTdStyle}>{rejected}</td>

                                            {hasQualityRows ? (
                                                <>
                                                    <td style={{ ...tdStyle, padding: 0 }}>
                                                        <div style={nestedContainerStyle}>
                                                            {qualityRows.map((qRow, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        ...nestedItemBase,
                                                                        borderBottom:
                                                                            idx < qualityRows.length - 1 ? "1px solid #e9e7e7" : "none",
                                                                    }}
                                                                >
                                                                    {qRow.count ?? 0}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>

                                                    <td style={{ ...tdStyle, minWidth: "180px", padding: 0 }}>
                                                        <div style={nestedContainerStyle} className="qb-thin-scroll">
                                                            {qualityRows.map((qRow, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        ...nestedItemBase,
                                                                        borderBottom:
                                                                            idx < qualityRows.length - 1 ? "1px solid #e9e7e7" : "none",
                                                                    }}
                                                                >
                                                                    <div style={scrollTextStyle} className="qb-thin-scroll">
                                                                        {Array.isArray(qRow.reason)
                                                                            ? qRow.reason.join(", ") || "-"
                                                                            : qRow.reason || "-"}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>

                                                    <td style={{ ...tdStyle, minWidth: "180px", padding: 0 }}>
                                                        <div style={nestedContainerStyle} className="qb-thin-scroll">
                                                            {qualityRows.map((qRow, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        ...nestedItemBase,
                                                                        borderBottom:
                                                                            idx < qualityRows.length - 1 ? "1px solid #e9e7e7" : "none",
                                                                    }}
                                                                >
                                                                    <div style={scrollTextStyle} className="qb-thin-scroll">
                                                                        {qRow.remark || "-"}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>

                                                    {/* NEW EMAIL COLUMN */}
                                                    <td style={{ ...tdStyle, minWidth: "160px", padding: 0 }}>
                                                        <div style={nestedContainerStyle}>
                                                            {qualityRows.map((qRow, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        ...nestedItemBase,
                                                                        borderBottom:
                                                                            idx < qualityRows.length - 1 ? "1px solid #e9e7e7" : "none",
                                                                    }}
                                                                >
                                                                    {qRow.email || "-"}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={tdStyle}>{op?.rejection_info?.qualitycount ?? 0}</td>

                                                    <td style={{ ...tdStyle, minWidth: "180px" }}>
                                                        {Array.isArray(op?.rejection_info?.qualityreason)
                                                            ? op.rejection_info.qualityreason.join(", ") || "-"
                                                            : op?.rejection_info?.qualityreason || "-"}
                                                    </td>

                                                    <td style={{ ...tdStyle, minWidth: "180px" }}>
                                                        {op?.rejection_info?.quality_remark || "-"}
                                                    </td>

                                                    {/* EMAIL COLUMN */}
                                                    <td style={{ ...centeredTdStyle, minWidth: "160px" }}>
                                                        {op?.rejection_info?.quality_customer_email || "-"}
                                                    </td>
                                                </>
                                            )}

                                            <td style={{ ...centeredTdStyle, minWidth: "110px" }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => openRejectPopup(machineName, op)}
                                                >
                                                    <EditIcon fontSize="small" sx={{ color: "#4e4d4d" }} />
                                                </IconButton>
                                            </td>
                                            <td style={{ ...centeredTdStyle, minWidth: "160px" }}>
                                                {qualityEntryRecordsData[machineName]?.[0]?.ts
                                                    ? dayjs(qualityEntryRecordsData[machineName][0].ts).format("DD-MM-YYYY HH:mm:ss")
                                                    : "-"}
                                            </td>
                                            <td style={{ ...centeredTdStyle, minWidth: "80px" }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setLogsDialogMachine(machineName);
                                                        setLogsDialogRecords(qualityEntryRecordsData[machineName] || []);
                                                        setLogsDialogOpen(true);
                                                    }}
                                                >
                                                    <VisibilityIcon fontSize="small" sx={{ color: "#363738" }} />
                                                </IconButton>
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

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

                    {!isFetchingBluecard && (rejectionCount > 0 || rejectionReason) && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                background: "#e8f0fe",
                                border: "1px solid #c5d5f5",
                                borderRadius: "8px",
                                padding: "10px 16px",
                                flexWrap: "wrap"
                            }}
                        >
                            <span style={{ fontWeight: 700, color: "#1565c0" }}>
                                🔵 {rejectionLabel}
                            </span>

                            <span
                                style={{
                                    background: "#1565c0",
                                    color: "white",
                                    borderRadius: "20px",
                                    padding: "2px 14px",
                                    fontWeight: "800"
                                }}
                            >
                                {rejectionCount}
                            </span>

                            {rejectionReason && (
                                <span
                                    style={{
                                        fontSize: "13px",
                                        color: "#1565c0",
                                        fontWeight: "600"
                                    }}
                                >
                                    {formatReason(
                                        Array.isArray(rejectionReason)
                                            ? rejectionReason
                                            : [rejectionReason]
                                    )}
                                </span>
                            )}
                        </div>
                    )}
                    {/* Actual / Rejected / Can Reject */}

                    {selectedRow && !isFetchingBluecard && (() => {

                        const componentCode = selectedRow.op?.code;
                        const machineOpsForComponent = (mergedData[selectedRow.machineName] || []).filter(op => op.code === componentCode && op.shift == selectedRow?.op?.shift);
                        const componentActual = machineOpsForComponent.reduce((sum, op) =>
                            sum + Number((op.goodvsexp?.split("/") || [])[0] || 0), 0);
                        const rejList = rejectionData[selectedRow.machineName] || [];
                        const rejMap = new Map(rejList.map(r => [Number(r.ts), r]));
                        const componentRejected = machineOpsForComponent.reduce((sum, op) => {
                            const rej = rejMap.get(Number(op.start_time));
                            return sum + Number(rej?.count || 0);
                        }, 0);
                        const componentRemaining = Math.max(0, componentActual - componentRejected);

                        const stats = [
                            { label: "Actual", value: componentActual, color: "#1565c0", bg: "#e3f2fd", border: "#bbdefb" },
                            { label: "Rejected", value: componentRejected, color: "#c62828", bg: "#ffebee", border: "#ffcdd2" },
                            { label: "Remaining", value: componentRemaining, color: "#2e7d32", bg: "#e8f5e9", border: "#c8e6c9" },
                        ];

                        return (
                            <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                                {stats.map(s => (
                                    <div
                                        key={s.label}
                                        style={{
                                            flex: 1,
                                            background: s.bg,
                                            border: `1px solid ${s.border}`,
                                            borderRadius: "8px",
                                            padding: "10px 8px",
                                            textAlign: "center"
                                        }}
                                    >
                                        <div style={{
                                            fontSize: "11px",
                                            color: "#666",
                                            fontWeight: "600",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                            marginBottom: "4px"
                                        }}>
                                            {s.label}
                                        </div>

                                        <div style={{
                                            fontSize: "24px",
                                            fontWeight: "800",
                                            color: s.color,
                                            lineHeight: 1
                                        }}>
                                            {s.value}
                                        </div>

                                    </div>
                                ))}
                            </div>
                        );

                    })()}

                    {/* ================= PREVIOUSLY REJECTED ================= */}
                    {allComponentExistingRows.length > 0 && (
                        <>
                            {/* Header */}
                            <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "8px" }}>
                                Previously Rejected
                            </div>

                            <div
                                style={{
                                    border: "1px solid #e0e0e0",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "100px 1fr 1fr",
                                        background: "#f5f6fa",
                                        borderBottom: "1px solid #e0e0e0",
                                    }}
                                >
                                    {["Count", "Reason", "Remark"].map((h, i) => (
                                        <div
                                            key={h}
                                            style={{
                                                padding: "20px",
                                                fontWeight: "600",
                                                fontSize: "14px",
                                                textAlign: "center",
                                                borderRight: i !== 2 ? "1px solid #e0e0e0" : "none",
                                            }}
                                        >
                                            {h}
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    {allComponentExistingRows.map((row, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "100px 1fr 1fr",
                                                borderBottom: "1px solid #e0e0e0",
                                                alignItems: "center",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    padding: "10px",
                                                    textAlign: "center",
                                                    fontWeight: "500",
                                                    borderRight: "1px solid #e0e0e0",
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                }}
                                            >
                                                {row.count}
                                            </div>

                                            <div
                                                style={{
                                                    padding: "10px",
                                                    fontSize: "13px",
                                                    fontWeight: "500",
                                                    borderRight: "1px solid #e0e0e0",
                                                    whiteSpace: "normal",
                                                    wordBreak: "break-word",
                                                    maxHeight: "3.6em",
                                                    overflowY: "auto",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {Array.isArray(row.reason) ? row.reason.join(", ") : row.reason || "-"}
                                            </div>

                                            <div
                                                style={{
                                                    padding: "10px",
                                                    fontSize: "13px",
                                                    fontWeight: "500",
                                                    whiteSpace: "normal",
                                                    wordBreak: "break-word",
                                                    maxHeight: "3.6em",
                                                    overflowY: "auto",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {row.remark || "-"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ADD NEW */}
                    <div style={{ fontWeight: 600, fontSize: "15px" }}>
                        Add New Reject Parts
                    </div>

                    {rejectRows.map((row, idx) => {

                        if (row.isExisting) return null;

                        const usedByOthers = rejectRows.reduce((sum, r, i) => {
                            if (i !== idx && !r.isExisting) {
                                return sum + Number(r.count || 0);
                            }
                            return sum;
                        }, 0);

                        const remaining = Math.max(0, allowed - usedByOthers);

                        return (
                            <div
                                key={idx}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "80px 260px 1fr 50px",
                                    borderBottom: "1px solid #f0f0f0",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "6px 8px"
                                }}
                            >
                                {/* COUNT */}
                                <div>
                                    <TextField
                                        type="number"
                                        value={row.count}
                                        size="small"
                                        label="Count"
                                        onFocus={() => {
                                            if (row.count === 0) {
                                                setRejectRows(
                                                    rejectRows.map((r, i) =>
                                                        i === idx ? { ...r, count: "" } : r
                                                    )
                                                );
                                            }
                                        }}
                                        onChange={(e) => {
                                            let val = e.target.value;
                                            if (val === "") val = "";
                                            else {
                                                val = Number(val);
                                                if (val > remaining) val = remaining;
                                                if (val < 0) val = 0;
                                            }
                                            setRejectRows(
                                                rejectRows.map((r, i) =>
                                                    i === idx ? { ...r, count: val } : r
                                                )
                                            );
                                        }}
                                        inputProps={{
                                            min: 0,
                                            max: remaining,
                                            style: { textAlign: "center", fontWeight: "600" }
                                        }}
                                        sx={{
                                            width: "80px",
                                            "& .MuiInputBase-root": { height: "40px" }
                                        }}
                                    />
                                </div>
                                {/* REASON */}
                                <div>
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>Reason</InputLabel>
                                        <Select
                                            multiple
                                            label="Reason"
                                            value={row.reason || []}
                                            MenuProps={{
                                                PaperProps: { style: { maxHeight: 220, overflowY: "auto" } }
                                            }}
                                            onChange={(e) => {
                                                const { value } = e.target;
                                                setRejectRows(
                                                    rejectRows.map((r, i) =>
                                                        i === idx
                                                            ? {
                                                                ...r,
                                                                reason:
                                                                    typeof value === "string" ? value.split(",") : value
                                                            }
                                                            : r
                                                    )
                                                );
                                            }}
                                            renderValue={(selected) => {
                                                if (selected.length <= 2) return selected.join(", ");
                                                return `${selected.slice(0, 2).join(", ")} ...`;
                                            }}
                                            sx={{ height: "40px" }}
                                        >
                                            {(qualityReasonList || []).map((item, i) => (
                                                <MenuItem key={i} value={item.reason}>
                                                    <Checkbox
                                                        checked={(row.reason || []).includes(item.reason)}
                                                        size="small"
                                                    />
                                                    <ListItemText primary={item.reason} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </div>
                                {/* REMARK */}
                                <div>
                                    <TextField
                                        value={row.remark}
                                        size="small"
                                        label="Remark"
                                        fullWidth
                                        onChange={(e) => {
                                            setRejectRows(
                                                rejectRows.map((r, i) =>
                                                    i === idx ? { ...r, remark: e.target.value } : r
                                                )
                                            );
                                        }}
                                        sx={{ "& .MuiInputBase-root": { height: "40px" } }}
                                    />
                                </div>
                                {/* DELETE */}
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setRejectRows(rejectRows.filter((_, i) => i !== idx))}
                                        sx={{
                                            background: "#fafafa",
                                            border: "1px solid #e0e0e0",
                                            "&:hover": { background: "#ffeaea", color: "#d32f2f" }
                                        }}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </div>
                            </div>
                        );
                    })}
                    {/* ADD ROW */}
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
                            onClick={() =>
                                setRejectRows([
                                    ...rejectRows,
                                    { count: 0, reason: [], remark: "", isExisting: false }
                                ])
                            }
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
                            return newRows.some(row => (Number(row.count) || 0) <= 0 || row.reason.length === 0 || !row.remark);
                        })()}
                        sx={{
                            borderRadius: "4px", minWidth: "110px",
                            background: "#EC6E17",
                            "&:hover": { background: "#e08529" },
                        }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Logs Dialog */}
            <Dialog
                open={logsDialogOpen}
                onClose={() => setLogsDialogOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: "14px",
                        overflow: "hidden",
                        width: "820px",
                        maxWidth: "80vw",
                        minHeight: "60vh",
                    },
                }}
            >
                <div style={{
                    padding: "16px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #c9cace",
                    background: "#efeeed",
                }}>
                    <span style={{ fontSize: "18px", fontWeight: "600", color: "black" }}>
                        Logs — {logsDialogMachine}
                    </span>
                    <IconButton
                        size="small"
                        onClick={() => setLogsDialogOpen(false)}
                        sx={{
                            backgroundColor: "#ffffff",
                            color: "#918d8d",
                            borderRadius: "50%",
                            width: 32,
                            height: 32,
                            "&:hover": {
                                backgroundColor: "#c2c0c0",
                                color: "#fff"
                            },
                        }}
                    >
                        ✕
                    </IconButton>
                </div>
                <DialogContent
                    sx={{
                        padding: "18px 24px",
                        paddingBottom: "10px",
                        flex: 1,
                        overflowY: "auto",
                        overflowX: "auto",
                        backgroundColor: "#f8f9fb",
                    }}
                >
                    {logsDialogRecords.length === 0 ? (
                        <div style={{
                            textAlign: "center",
                            color: "#888",
                            fontSize: "15px",
                            padding: "32px 0",
                        }}>
                            No logs available for this machine.
                        </div>
                    ) : (
                        <table style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "13px",
                            backgroundColor: "white",
                            borderRadius: "8px",
                            overflow: "hidden",
                            border: "1px solid #e0e0e0",
                        }}>
                            <thead>
                                <tr style={{ backgroundColor: "#f0f0f0", borderBottom: "2px solid #e0e0e0" }}>
                                    {["Date", "Time", "Shift", "Machine", "Component", "Message", "Responded By"].map((col) => (
                                        <th key={col} style={{
                                            padding: "10px 12px",
                                            textAlign: "center",
                                            fontWeight: "600",
                                            color: "#444",
                                            fontSize: "14px",
                                            whiteSpace: "nowrap",
                                            textTransform: "uppercase",
                                        }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logsDialogRecords.map((record, idx) => {
                                    const raw = record.value || "";
                                    const parse = (key) => {
                                        const match = raw.match(new RegExp(`${key}:\\s*([^,]+)`));
                                        return match ? match[1].trim() : "-";
                                    };

                                    const email = parse("CustomerEmail");
                                    const message = parse("LogMessage");
                                    const component = parse("Component");
                                    const machine = parse("Machine");
                                    const timeStr = parse("Time");
                                    const shift = parse("Shift");

                                    const dayjsTime = dayjs(timeStr, "DD-MM-YYYY HH:mm:ss");
                                    const date = dayjsTime.isValid() ? dayjsTime.format("DD-MM-YYYY") : "-";
                                    const time = dayjsTime.isValid() ? dayjsTime.format("HH:mm:ss") : "-";

                                    const avatarColors = ["#F47803", "#2e7d32", "#1565c0", "#6a1b9a", "#c62828"];
                                    const avatarColor = avatarColors[email.charCodeAt(0) % avatarColors.length];

                                    const shiftColors = {
                                        A: { bg: "#e3f2fd", color: "#1565c0" },
                                        B: { bg: "#f3e5f5", color: "#6a1b9a" },
                                        C: { bg: "#e8f5e9", color: "#2e7d32" },
                                    };
                                    const shiftStyle = shiftColors[shift] || { bg: "#f5f5f5", color: "#555" };

                                    return (
                                        <tr
                                            key={idx}
                                            style={{
                                                borderBottom: idx < logsDialogRecords.length - 1 ? "1px solid #f0f0f0" : "none",
                                                backgroundColor: idx % 2 === 0 ? "white" : "#fafafa",
                                            }}
                                        >
                                            <td style={{
                                                padding: "10px 12px",
                                                color: "#F47803",
                                                fontWeight: "600",
                                                fontSize: "14px",
                                                whiteSpace: "nowrap",
                                                verticalAlign: "middle",
                                            }}>
                                                {date}
                                            </td>
                                            <td style={{
                                                padding: "10px 12px",
                                                color: "#F47803",
                                                fontWeight: "600",
                                                fontSize: "14px",
                                                whiteSpace: "nowrap",
                                                verticalAlign: "middle",
                                            }}>
                                                {time}
                                            </td>
                                            <td style={{
                                                padding: "10px 12px",
                                                verticalAlign: "middle",
                                                whiteSpace: "nowrap",
                                            }}>
                                                <span style={{
                                                    background: shiftStyle.bg,
                                                    color: shiftStyle.color,
                                                    borderRadius: "5px",
                                                    padding: "3px 10px",
                                                    fontSize: "14px",
                                                    fontWeight: "700",
                                                }}>
                                                    {shift}
                                                </span>
                                            </td>
                                            <td style={{
                                                padding: "10px 12px",
                                                verticalAlign: "middle",
                                                whiteSpace: "nowrap",
                                            }}>
                                                <span style={{
                                                    background: "#fff3e0",
                                                    color: "#e65100",
                                                    borderRadius: "5px",
                                                    padding: "3px 8px",
                                                    fontSize: "14px",
                                                    fontWeight: "600",
                                                }}>
                                                    {machine}
                                                </span>
                                            </td>
                                            <td style={{
                                                padding: "10px 12px",
                                                verticalAlign: "middle",
                                                whiteSpace: "nowrap",
                                            }}>
                                                <span style={{
                                                    background: "#e8f5e9",
                                                    color: "#2e7d32",
                                                    borderRadius: "5px",
                                                    padding: "3px 8px",
                                                    fontSize: "14px",
                                                    fontWeight: "600",
                                                }}>
                                                    {component}
                                                </span>
                                            </td>
                                            <td style={{
                                                padding: "10px 12px",
                                                color: "#333",
                                                fontSize: "14px",
                                                fontWeight: "500",
                                                lineHeight: "1.5",
                                                verticalAlign: "middle",
                                                minWidth: "180px",
                                            }}>
                                                {message}
                                            </td>
                                            <td style={{
                                                padding: "10px 12px",
                                                verticalAlign: "middle",
                                                whiteSpace: "nowrap",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <div style={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: "50%",
                                                        background: avatarColor,
                                                        color: "white",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "14px",
                                                        fontWeight: "700",
                                                        flexShrink: 0,
                                                    }}>
                                                        {email[0].toUpperCase()}
                                                    </div>
                                                    <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>{email}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};