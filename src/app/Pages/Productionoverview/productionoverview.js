import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Box,
    Typography,
    FormControl,
    Select,
    MenuItem,
    InputLabel,
    Checkbox,
    ListItemText,
    Button, CircularProgress
} from "@mui/material";
import dayjs from "dayjs";
import { customerbasedshift } from "../../Services/app/operatorservice";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";
import { getPartsReport } from "../../Shared/utils/oeepartsdata";
import { useRef } from "react";

export default function ProductionOverview() {
    const customerId = localStorage.getItem("CustomerID");
    const initialLoadDone = useRef(false);

    const [isLoading, setIsLoading] = useState(false);
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
    const [selectedYear, setSelectedYear] = useState(dayjs().year());
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const [todayData, setTodayData] = useState(null);
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

    const getYearRange = (shifts, selectedYear) => {
        if (!shifts?.length || !selectedYear)
            return { from: null, to: null, setFrom: null, setTo: null };

        const now = dayjs();
        const currentYear = now.year();

        const firstShift = shifts[0];
        const lastShift = shifts[shifts.length - 1];

        // ---------- FROM ----------
        const yearStart = dayjs(`${selectedYear}-01-01`);

        const [fsH, fsM] = firstShift.start_time.split(":").map(Number);

        const fromDT = yearStart
            .hour(fsH)
            .minute(fsM)
            .second(0)
            .millisecond(0);

        let toDT;
        let setFrom = null;
        let setTo = null;

        // ---------- CURRENT YEAR ----------
        if (Number(selectedYear) === currentYear) {
            let currentShift = shifts[0];

            for (const shift of shifts) {
                const [sh, sm] = shift.start_time.split(":").map(Number);
                const [eh, em] = shift.end_time.split(":").map(Number);

                let start = dayjs().hour(sh).minute(sm).second(0);
                let end = dayjs().hour(eh).minute(em).second(0);

                if (eh < sh || (eh === sh && em <= sm)) {
                    end = end.add(1, "day");
                }

                if (now.isAfter(start) && now.isBefore(end)) {
                    currentShift = shift;
                    break;
                }
            }

            const [endH, endM] =
                currentShift.end_time.split(":").map(Number);
            const [startH, startM] =
                currentShift.start_time.split(":").map(Number);

            toDT = dayjs().hour(endH).minute(endM).second(0);

            if (endH < startH || (endH === startH && endM <= startM)) {
                toDT = toDT.add(1, "day");
            }
        }

        // ---------- PAST YEAR ----------
        // ---------- PAST YEAR ----------
        else {
            const yearEnd = dayjs(`${selectedYear}-12-31`);

            const [endH, endM] =
                lastShift.end_time.split(":").map(Number);
            const [startH, startM] =
                lastShift.start_time.split(":").map(Number);

            toDT = yearEnd.hour(endH).minute(endM).second(0);

            if (endH < startH || (endH === startH && endM <= startM)) {
                toDT = toDT.add(1, "day");
            }

            const [curFsH, curFsM] =
                firstShift.start_time.split(":").map(Number);

            const weekStart = dayjs()
                .startOf("week")
                .add(1, "day"); // Monday start

            setFrom = weekStart
                .hour(curFsH)
                .minute(curFsM)
                .second(0)
                .millisecond(0);


            // ✅ setTo = current shift end
            let currentShift = shifts[0];

            for (const shift of shifts) {
                const [sh, sm] = shift.start_time.split(":").map(Number);
                const [eh, em] = shift.end_time.split(":").map(Number);

                let start = dayjs().hour(sh).minute(sm).second(0);
                let end = dayjs().hour(eh).minute(em).second(0);

                if (eh < sh || (eh === sh && em <= sm)) {
                    end = end.add(1, "day");
                }

                if (now.isAfter(start) && now.isBefore(end)) {
                    currentShift = shift;
                    break;
                }
            }

            const [curEndH, curEndM] =
                currentShift.end_time.split(":").map(Number);
            const [curStartH, curStartM] =
                currentShift.start_time.split(":").map(Number);

            setTo = dayjs().hour(curEndH).minute(curEndM).second(0);

            if (
                curEndH < curStartH ||
                (curEndH === curStartH && curEndM <= curStartM)
            ) {
                setTo = setTo.add(1, "day");
            }
        }


        return {
            from: fromDT.valueOf(),
            to: toDT.valueOf(),
            setFrom: setFrom ? setFrom.valueOf() : null,
            setTo: setTo ? setTo.valueOf() : null,
        };
    };


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
        if (!shifts?.length || !selectedYear) return;

        const range = getYearRange(shifts, selectedYear);

        setRangeFrom(range.from);
        setRangeTo(range.to);
        setFrom(range.setFrom);
        setTo(range.setTo);

    }, [shifts, selectedYear]);


    console.log('from', rangeFrom, 'to', rangeTo)
    console.log('set from', from, 'set to', to)


    useEffect(() => {
        if (
            !initialLoadDone.current &&
            selectedDeviceIds.length &&
            rangeFrom &&
            rangeTo &&
            shifts.length
        ) {
            initialLoadDone.current = true;
            handleSubmit();
        }
    }, [selectedDeviceIds, rangeFrom, rangeTo, shifts]);



    useEffect(() => {
        if (!data.summary) return;

        setAvgPerformance([
            { today: todayData?.today?.performance ?? data?.summary?.today?.performance ?? 0 },
            { yesterday: todayData?.yesterday?.performance ?? data?.summary?.yesterday?.performance ?? 0 }
        ]);
    }, [data.summary, todayData]);

    console.log('avg performance', avgPerformance);

    const handleSubmit = async () => {
        if (!selectedDeviceIds.length || !rangeFrom || !rangeTo) return;

        setIsLoading(true);
        setIframeUrl(""); // clear old iframe

        try {
            // ---------- YEAR DATA ----------
            const resYear = await getPartsReport({
                machineIds: selectedDeviceIds,
                shifts,
                fromEpoch: rangeFrom,
                toEpoch: rangeTo,
                getShiftTimes
            });

            const newData = {
                ShiftData: resYear.shiftData,
                summary: resYear.summary,
                dayWise: resYear.dayWise,
                monthWise: resYear.monthWise
            };

            setData(newData);

            // ---------- CURRENT WEEK DATA ----------
            let todaySummary = null;

            if (from && to) {
                const resToday = await getPartsReport({
                    machineIds: selectedDeviceIds,
                    shifts,
                    fromEpoch: from,
                    toEpoch: to,
                    getShiftTimes
                });

                todaySummary = resToday.summary;
                setTodayData(todaySummary);
            }

            // ---------- PERFORMANCE ----------
            const perf = [
                {
                    today:
                        todaySummary?.today?.performance ??
                        newData.summary?.today?.performance ??
                        0
                },
                {
                    yesterday:
                        todaySummary?.yesterday?.performance ??
                        newData.summary?.yesterday?.performance ??
                        0
                }
            ];

            setAvgPerformance(perf);

            // ---------- DASHBOARD URL ----------
            const url =
                `${window._env_.GRAFANA_URL}d/bfbciun71fn5sa/production-metrics-db` +
                `?orgId=1&theme=light&kiosk=true` +
                `&var-efficiency=${encodeURIComponent(JSON.stringify(perf))}` +
                `&var-p_data=${encodeURIComponent(JSON.stringify(todaySummary || newData.summary))}` +
                `&var-monthdata=${encodeURIComponent(JSON.stringify(newData.monthWise))}`;

            setIframeUrl(url);
        } catch (error) {
            console.error("Dashboard load failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    console.log('data', data)
    console.log('todayData', todayData)
    const minYear = 2025;
    const maxYear = dayjs().year();

    return (
        <Box>
            <Box
                display="flex"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={2}
                pt={6}
                pr={3}
            >
                <Typography variant="h5" component="h4" fontWeight={900}>
                    Production Overview
                </Typography>

                <Box display="flex" gap={2} flexWrap="wrap">

                    {/* Machine Group Dropdown */}
                    {showMachineGroupsDropdown && (
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ fontSize: '13px', color: '#86868b' }}>
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

                    {/* Machines Dropdown */}
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel sx={{ fontSize: '13px', color: '#86868b' }}>
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

                    {/* Year Selector */}
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Year</InputLabel>
                        <Select
                            value={selectedYear}
                            label="Year"
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            {Array.from(
                                { length: maxYear - minYear + 1 },
                                (_, i) => maxYear - i
                            ).map((year) => (
                                <MenuItem key={year} value={year}>
                                    {year}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Submit Button */}
                    <Button
                        variant="contained"
                        size="medium"
                        onClick={handleSubmit}
                        disabled={
                            isLoading ||
                            !data.summary ||
                            !data.monthWise ||
                            !avgPerformance.length
                        }
                        sx={{
                            backgroundColor: "#F47803",
                            "&:hover": {
                                backgroundColor: "#e68417"
                            }
                        }}
                    >
                        {isLoading ? (
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                                <CircularProgress size={18} sx={{ mr: 1, color: "inherit" }} />
                            </Box>
                        ) : (
                            "Submit"
                        )}
                    </Button>
                </Box>
            </Box>

            {/* Dashboard Area */}
            <Box
                mt={2}
                height="calc(100vh - 180px)"
                sx={{
                    background: '#fff',
                    overflow: 'hidden',
                }}
            >
                {isLoading ? (
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
                        Analysing production data...
                    </Box>
                ) : iframeUrl ? (
                    <>
                   <div style={{ position: 'relative', width: '100%', height: '100%' }}>
  
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

  {/* Right overlay */}
  <div
    style={{
      position: 'absolute',
      top: 60,
      right: 14,
      width: 90,
      height: "calc(100% - 60px)",
      backgroundColor: 'transparent',
      zIndex: 10
    }}
  />

  {/* Top bar */}
  <div
    style={{
      position: 'absolute',
      top: 0,
      width: "100%",
      height: 50,
      backgroundColor: 'transparent',
      zIndex: 20
    }}
  />

</div>
                    </>
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
                        Click submit to load dashboard
                    </Box>
                )}
            </Box>

        </Box>
    );

}
