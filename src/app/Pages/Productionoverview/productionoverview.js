import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Box,
    Typography,
    FormControl,
    Select,
    MenuItem,
    InputLabel,
    Checkbox,
    ListItemText
} from "@mui/material";
import dayjs from "dayjs";
import { customerbasedshift } from "../../Services/app/operatorservice";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";
import { getPartsReport } from "../../Shared/utils/oeepartsdata";

export default function ProductionOverview() {
    const customerId = localStorage.getItem("CustomerID");

    const [shifts, setShifts] = useState([]);
    const [data, setData] = useState({
        summary: null,
        dayWise: null,
        monthWise: null,
        ShiftData: null
    });
    const [avgPerformance, setAvgPerformance] = useState([]);
    const [iframeUrl, setIframeUrl] = useState("");
    const [rangeFrom, setRangeFrom] = useState(null);
    const [rangeTo, setRangeTo] = useState(null);

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

    const selectedDeviceIds = useMemo(
        () =>
            deviceNameID
                .filter((d) => selectedMachines.includes(d.name))
                .map((d) => d.id),
        [deviceNameID, selectedMachines]
    );

    const getShiftDateTime = useCallback((baseDate, shift, type) => {
        if (!baseDate || !shift) return null;

        const isStart = type === "start";
        const timeStr = isStart ? shift.start_time : shift.end_time;
        const dayFlag = isStart ? shift.start_day : shift.end_day;

        let dt = dayjs(baseDate).startOf("day");
        if (String(dayFlag) === "2") dt = dt.add(1, "day");

        const t = dayjs((timeStr || "").trim(), ["HH:mm:ss", "HH:mm"]);
        if (!t.isValid()) return dt.valueOf();

        return dt
            .hour(t.hour())
            .minute(t.minute())
            .second(isStart ? 0 : 59)
            .millisecond(isStart ? 0 : 999)
            .valueOf();
    }, []);

    const getYearRange = useCallback(
        (shiftList) => {
            if (!shiftList.length) return { from: null, to: null };

            const sorted = [...shiftList].sort(
                (a, b) => Number(a.shift_no) - Number(b.shift_no)
            );

            return {
                from: getShiftDateTime(dayjs().startOf("year"), sorted[0], "start"),
                to: getShiftDateTime(dayjs(), sorted[sorted.length - 1], "end")
            };
        },
        [getShiftDateTime]
    );

    const getShiftTimes = useCallback((shifts, shiftNo, date) => {
        if (!shifts.length || !date) return { from: null, to: null };

        const base = dayjs(date).format("YYYY-MM-DD");
        const dayOffset = (d) => dayjs(base).add(Number(d) - 1, "day").format("YYYY-MM-DD");

        if (shiftNo === "allshift") {
            const sorted = [...shifts].sort((a, b) => a.shift_no - b.shift_no);
            return {
                from: new Date(`${dayOffset(sorted[0].start_day)}T${sorted[0].start_time}`).getTime(),
                to: new Date(`${dayOffset(sorted.at(-1).end_day)}T${sorted.at(-1).end_time}`).getTime()
            };
        }

        const s = shifts.find((x) => String(x.shift_no) === String(shiftNo));
        if (!s) return { from: null, to: null };

        return {
            from: new Date(`${dayOffset(s.start_day)}T${s.start_time}`).getTime(),
            to: new Date(`${dayOffset(s.end_day)}T${s.end_time}`).getTime()
        };
    }, []);

    useEffect(() => {
        customerbasedshift(customerId, "allShift").then(
            (res) => setShifts(res?.[0]?.value || [])
        );
    }, [customerId]);

    useEffect(() => {
        if (!shifts.length) return;
        const { from, to } = getYearRange(shifts);
        setRangeFrom(from);
        setRangeTo(to);
    }, [shifts, getYearRange]);

    useEffect(() => {
        if (!selectedDeviceIds.length || !rangeFrom || !rangeTo) return;

        getPartsReport({
            machineIds: selectedDeviceIds,
            shifts,
            fromEpoch: rangeFrom,
            toEpoch: rangeTo,
            getShiftTimes
        }).then((res) =>
            setData({
                ShiftData: res.shiftData,
                summary: res.summary,
                dayWise: res.dayWise,
                monthWise: res.monthWise
            })
        );
    }, [selectedDeviceIds, rangeFrom, rangeTo, shifts, getShiftTimes]);

    useEffect(() => {
        if (!data.summary) return;
        setAvgPerformance([
            { today: data.summary.today.performance },
            { yesterday: data.summary.yesterday.performance }
        ]);
    }, [data.summary]);

    useEffect(() => {
        if (!data.summary || !data.monthWise || !avgPerformance.length) return;

        const url =
            `http://74.224.122.231:9097/d/bfbciun71fn5sa/production-metrics-db` +
            `?orgId=1&theme=light&kiosk=true` +
            `&var-efficiency=${encodeURIComponent(JSON.stringify(avgPerformance))}` +
            `&var-p_data=${encodeURIComponent(JSON.stringify(data.summary))}` +
            `&var-monthdata=${encodeURIComponent(JSON.stringify(data.monthWise))}`;

        setIframeUrl(url);
    }, [data.summary, data.monthWise, avgPerformance]);

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={2} pt={6} pr={3}>
                <Typography
                    variant="h5"
                    component="h4"
                    fontWeight={900}
                >
                    Production Overview
                </Typography>

                <Box display="flex" gap={2} flexWrap="wrap">
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
                </Box>
            </Box>

            <Box
                mt={2}
                height="calc(100vh - 180px)"
                sx={{
                    background: '#fff',
                    overflow: 'hidden',
                }}
            >
                {iframeUrl ? (
                    <iframe
                        src={iframeUrl}
                        title="Production Metrics"
                        width="100%"
                        height="100%"
                        style={{
                            border: 'none',
                            display: 'block',
                        }}
                        allowFullScreen
                    />
                ) : (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f8f9fa',
                            color: '#6c757d',
                            fontSize: '14px',
                        }}
                    >
                        Loading production dashboard...
                    </Box>
                )}
            </Box>

        </Box>
    );
}
