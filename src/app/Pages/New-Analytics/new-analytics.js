import {
    Box, FormControl, InputLabel, Select, MenuItem,
    Checkbox,
    ListItemText, Button, Tooltip,
    duration
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import "./new-analytics.css";
import {
    cleanCustomerId,
    customerbasedshift,
    telemetrykeydata
} from "../../Services/app/operatorservice";
import { getAverageOEEForRange, fetchAlarmDowntimeData } from "../../Shared/utils/oeeCalculations";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";
import { Category } from "@mui/icons-material";

export default function NewAnalytics() {
    const customerId = localStorage.getItem("CustomerID");
    const {
        devices,
        deviceNameID,
        machineGroups,
        availableMachines,
        selectedMachines,
        selectedGroups,
        showMachineGroupsDropdown,
        isAllMachinesSelected,
        handleGroupChange,
        handleMachineChange,
        getDeviceObjectsForMachines
    } = useMachineGroups(customerId);

    const [shifts, setShifts] = useState([]);
    const [fromDate, setFromDate] = useState(dayjs());
    const [toDate, setToDate] = useState(dayjs());
    const [analysisType, setAnalysisType] = useState("live_alarm");
    const [grafanaUrl, setGrafanaUrl] = useState("");
    const [newToken, setNewToken] = useState(localStorage.getItem("token"));
    const [selectedShift, setSelectedShift] = useState("all");
    const [fromTime, setFromTime] = useState(null);
    const [toTime, setToTime] = useState(null);
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const [avgOeeData, setAvgOeeData] = useState({});
    const [oeeFiscalUrl, setOeeFiscalUrl] = useState("");
    const [oeeDaysUrl, setOeeDaysUrl] = useState("");
    const [oeeGrafanaUrl, setOeeGrafanaUrl] = useState("");
    const [oeeViewType, setOeeViewType] = useState("fiscal");
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [alarmData, setAlarmData] = useState([]);
    const [downtimeData, setDowntimeData] = useState([]);
    const [tableData, setTableData] = useState([]);
    const isRunDisabled =
        isLoading ||
        selectedMachines.length === 0;
    const fetchShifts = async () => {
        try {
            const result = await customerbasedshift(customerId, "allShift");
            const shiftList = result?.[0]?.value || [];
            setShifts(shiftList);
        } catch (err) {
            console.error("Failed to fetch shifts", err);
        }
    };

    const updateOeeDataAndUrl = async () => {
        try {
            setIsLoading(true);
            const machinesForUrl = selectedMachines;
            const devicesToProcessFromMachines = getDeviceObjectsForMachines(machinesForUrl);

            let devicesToProcess = devicesToProcessFromMachines;

            if (devicesToProcess.length === 0) {
                console.log("No devices to process for OEE data");
                setAvgOeeData({});
                setIsLoading(false);
                return;
            }

            const { avgData, oeeData } = await getAverageOEEForRange(
                devicesToProcess,
                shifts,
                from,
                to
            );
            console.log('oee data', oeeData)

            const idToNameMap = Object.fromEntries(
                deviceNameID.map(d => [d.id, d.name])
            );
            const renamedData = Object.fromEntries(
                Object.entries(avgData).map(([id, value]) => [
                    idToNameMap[id] || id,
                    value
                ])
            );
            console.log(avgData, 'Average data', deviceNameID, renamedData)
            setAvgOeeData(renamedData);

            const machinesParam = selectedMachines.join(",");
            const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
            const cleanedId = cleanCustomerId(customerId);
            let entityType = "CUSTOMER";

            const baseUrl = window._env_.SERVER_URL;
            const GRAFANA_URL = window._env_.GRAFANA_URL;
            const deviceWiseData = Object.fromEntries(
                Object.entries(renamedData).map(([deviceId, deviceData]) => {
                    const formatted = Object.entries(deviceData).map(([date, value]) => ({
                        date,
                        value,
                    }));
                    return [deviceId, formatted];
                })
            );

            const avgOeeJson = encodeURIComponent(JSON.stringify(deviceWiseData));
            console.log('avg oee json', avgOeeJson);

            const fiscalUrl = `${GRAFANA_URL}d/bf4e1lg78zmdcf/analytics-dashboard-oee?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-avgOee=${avgOeeJson}&var-machines=${encodeURIComponent(machinesParam)}&kiosk&theme=light&refresh=20s`;

            console.log("OEE Grafana URL:", fiscalUrl);

            const daysUrl = `${GRAFANA_URL}d/df4h01gnbsem8c/analytics-dashboard-oee-day-wise?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&from=${from}&to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&var-avgOee=${avgOeeJson}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-machines=${encodeURIComponent(machinesParam)}&kiosk&theme=light&refresh=20s`;

            setOeeFiscalUrl(fiscalUrl);
            setOeeDaysUrl(daysUrl);
            setOeeGrafanaUrl(oeeViewType === "fiscal" ? fiscalUrl : daysUrl);
        } catch (error) {
            console.error("Error updating OEE data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    console.log('avg oee data', avgOeeData)

    const updateGrafanaURL = (latestTableData = null) => {
        if (analysisType === "oee") return;

        setIsLoading(true);
        try {
            const machinesForUrl = selectedMachines;
            const machineParam = machinesForUrl.join(",");

            const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
            const cleanedId = cleanCustomerId(customerId);
            const baseUrl = window._env_.SERVER_URL;
            const GRAFANA_URL = window._env_.GRAFANA_URL;
            let entityType = "CUSTOMER";
            const dataToUse = latestTableData || tableData;
            const tableDataJson = encodeURIComponent(JSON.stringify(dataToUse));

            const url =
                `${GRAFANA_URL}d/a56900cd-961f-4ed4-99c5-3ec120450653/alarm?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-keys=${analysisType}&var-tableData=${tableDataJson}&var-grafanaurl=${GRAFANA_URL}&var-machines=${encodeURIComponent(machineParam)}&kiosk&theme=light&refresh=20s`;
            console.log('Grafana URL with tableData:', url, 'Table data length:', dataToUse.length);
            setGrafanaUrl(url);
        } catch (error) {
            console.error("Error updating Grafana URL:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const mapDataToOperator = (data, type, shifts) => {
        return Object.values(
            Object.fromEntries(
                Object.keys(data).map(machineId => {
                    const machine = data[machineId];
                    const operatorValues = machine.operatorValues || [];
                    const componentValues = machine.componentValues || [];

                    const mapped = machine.result.map(item => {
                        const value = item.value;
                        const start = Number(value[type === "alarm" ? "alarm_start" : "idle_start"]);
                        const end = Number(value[type === "alarm" ? "alarm_end" : "idle_end"]);
                        const durationSec = Number(value[type === "alarm" ? "alarm_duration" : "idle_duration"]);
                        const dateObj = new Date(start);
                        const day = String(dateObj.getDate()).padStart(2, "0");
                        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                        const year = dateObj.getFullYear();
                        const date = `${day}-${month}-${year}`;

                        // 🔹 Find operator (partial overlap)
                        const operator = operatorValues.find(op => {
                            const opStart = Number(op.value?.start_time);
                            const opEnd = Number(op.value?.end_time);
                            return start < opEnd && end > opStart;
                        });

                        // 🔹 Find best matching component (largest overlap)
                        let bestComponent = null;
                        let maxOverlap = 0;
                        componentValues.forEach(cmp => {
                            const cmpStart = Number(cmp.value?.start_time);
                            const cmpEnd = Number(cmp.value?.end_time);
                            const overlapStart = Math.max(start, cmpStart);
                            const overlapEnd = Math.min(end, cmpEnd);
                            const overlap = Math.max(0, overlapEnd - overlapStart);
                            if (overlap > maxOverlap) {
                                maxOverlap = overlap;
                                bestComponent = cmp;
                            }
                        });

                        // 🔹 Shift logic
                        let shiftNumber = "Unknown";
                        if (shifts?.length > 0) {
                            const alarmDate = new Date(start);
                            const alarmMinutes = alarmDate.getHours() * 60 + alarmDate.getMinutes();

                            shifts.forEach(shift => {
                                const [sH, sM] = shift.start_time.split(":").map(Number);
                                const [eH, eM] = shift.end_time.split(":").map(Number);
                                const startMins = sH * 60 + sM;
                                const endMins = eH * 60 + eM;

                                if (endMins < startMins) {
                                    if (alarmMinutes >= startMins || alarmMinutes < endMins) {
                                        shiftNumber = shift.shift_no;
                                    }
                                } else if (alarmMinutes >= startMins && alarmMinutes < endMins) {
                                    shiftNumber = shift.shift_no;
                                }
                            });
                        }

                        return {
                            date,
                            machine_name: machine.machineName,
                            operator_name: operator ? operator.value?.name : "-",
                            operator_code: operator ? operator.value?.code : "-",
                            component_name: bestComponent ? bestComponent.value?.name || "-" : "-",
                            component_code: bestComponent ? bestComponent.value?.code || "-" : "-",
                            ...(type === "alarm"
                                ? {
                                    alarm_number: value.alarm_number,
                                    alarm_type: value.alarm_type,
                                    alarm_message: value.alarm_message,
                                }
                                : {
                                    code: value.code,
                                    mode: value.mode,
                                    category: value.category,
                                    name: value.name,
                                }),
                            duration: durationSec,
                            start_time: value[type === "alarm" ? "alarm_start" : "idle_start"],
                            end_time: value[type === "alarm" ? "alarm_end" : "idle_end"],
                            shift_number: shiftNumber,
                        };
                    });

                    return [machineId, mapped];
                })
            )
        ).flat();
    };

    const handleAlarmData = async () => {
        const devicesToProcess = getDeviceObjectsForMachines(selectedMachines);
        if (!from || !to) return;

        const dataTypes = analysisType === "live_alarm"
            ? ["live_alarm", "live_operator", "live_component"]
            : ["live_reason", "live_operator", "live_component"];


        const result = await fetchAlarmDowntimeData(devicesToProcess, from, to, dataTypes);
        const mappedData = mapDataToOperator(result, analysisType === "live_alarm" ? "alarm" : "reason", shifts);
        setTableData(mappedData);
        return mappedData;
    };

    const handleGenerateReport = async () => {
        if (analysisType === "oee") {
            if (from && to) {
                await updateOeeDataAndUrl();
            }
        } else {
            const tableDataResults = await handleAlarmData();
            console.log('Alarm data processed:', tableDataResults);
            updateGrafanaURL(tableDataResults);
        }
    };

    useEffect(() => {
        if (analysisType !== "oee" && tableData.length > 0 && !isInitialLoad) {
            console.log('TableData updated, refreshing Grafana URL');
            updateGrafanaURL();
        }
    }, [tableData]);

    useEffect(() => {
        if (isInitialLoad && shifts.length > 0 && from && to && selectedMachines.length > 0) {
            console.log("Initial load - generating report automatically");
            handleGenerateReport();
            setIsInitialLoad(false);
        }
    }, [isInitialLoad, shifts, from, to, selectedMachines, analysisType]);

    const isShiftDisabled = !fromDate || !toDate ? true : !fromDate.isSame(toDate, "day");

    useEffect(() => {
        if (!fromDate || !toDate || shifts.length === 0) return;

        if (!fromDate.isSame(toDate, "day") || selectedShift === "all") {
            setSelectedShift("all");
            const firstShift = shifts[0];
            const lastShift = shifts[shifts.length - 1];
            const fromDT = dayjs(fromDate)
                .hour(Number(firstShift.start_time.split(":")[0]))
                .minute(Number(firstShift.start_time.split(":")[1]))
                .second(0)
                .millisecond(0);

            let lastShiftEndDT = dayjs(toDate)
                .hour(Number(lastShift.end_time.split(":")[0]))
                .minute(Number(lastShift.end_time.split(":")[1]))
                .second(0)
                .millisecond(0);

            const [endH, endM] = lastShift.end_time.split(":").map(Number);
            const [startH, startM] = lastShift.start_time.split(":").map(Number);
            if (endH < startH || (endH === startH && endM <= startM)) {
                lastShiftEndDT = lastShiftEndDT.add(1, "day");
            }
            setFromTime(firstShift.start_time);
            setToTime(lastShift.end_time);
            setFrom(fromDT.valueOf());
            setTo(lastShiftEndDT.valueOf());
        } else {
            const shift = shifts.find((s) => String(s.shift_no) === String(selectedShift)) || shifts[0];
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
            toDT = toDT.add(1, "day");
        }
        setFromTime(shift.start_time);
        setToTime(shift.end_time);
        setFrom(fromDT.valueOf());
        setTo(toDT.valueOf());
    };

    const getCurrentIframeUrl = () => {
        if (analysisType === "oee") {
            return oeeGrafanaUrl;
        }
        return grafanaUrl;
    };

    useEffect(() => {
        if (customerId) {
            fetchShifts();
        }
    }, [customerId]);


    return (
        <Box
            display="flex"
            flexWrap="wrap"
            height="calc(100vh - 2.6rem)"
            paddingTop="20px"
            bgcolor="#FEFCFC"
            flexDirection="column"
        >
            <div className="header-1" style={{ display: "flex", alignItems: "center", gap: "10px" }}>

                {/* Machine Groups Dropdown - Custom UI for this component */}
                {showMachineGroupsDropdown && (
                    <FormControl
                        size="small"
                        sx={{ minWidth: 160, background: "#fff" }}
                    >
                        <InputLabel id="machine-group-label">Machine Group</InputLabel>
                        <Select
                            multiple
                            labelId="machine-group-label"
                            id="machine-group-select"
                            value={selectedGroups}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            label="Machine Group"
                            renderValue={(selected) => {
                                if (selected.length === machineGroups.length) return "All Groups";
                                if (selected.length === 0) return "Select Groups";
                                return selected.join(", ");
                            }}
                        >
                            <MenuItem value="all">
                                <Checkbox
                                    checked={selectedGroups.length === machineGroups.length}
                                />
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

                {/* Machines Dropdown - Custom UI for this component */}
                <FormControl size="small" sx={{ minWidth: 220, background: "#fff" }}>
                    <InputLabel>Machines</InputLabel>
                    <Select
                        multiple
                        value={selectedMachines}
                        onChange={(e) => handleMachineChange(e.target.value)}
                        label="Machines"
                        renderValue={(selected) =>
                            isAllMachinesSelected ? "All Machines" : selected.join(", ")
                        }
                        sx={{
                            width: 180,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            display: "block",
                        }}
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

                <FormControl size="small" sx={{ minWidth: 160, background: "#fff" }}>
                    <InputLabel id="analysis-label" sx={{ background: "#fff" }}>Analysis Type</InputLabel>
                    <Select
                        labelId="analysis-label"
                        id="analysis-label"
                        value={analysisType}
                        onChange={(e) => {
                            setAnalysisType(e.target.value);
                            if (e.target.value === "oee") setOeeViewType("fiscal");
                        }}
                    >
                        <MenuItem value="live_alarm">Alarm</MenuItem>
                        <MenuItem value="live_reason">Downtime</MenuItem>
                        <MenuItem value="oee">OEE</MenuItem>
                    </Select>
                </FormControl>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                        label="From"
                        value={fromDate}
                        onChange={(newValue) => setFromDate(newValue)}
                        format="DD-MM-YYYY"
                        slotProps={{
                            textField: { size: "small", sx: { minWidth: 160, background: "#fff" } },
                        }}
                    />
                </LocalizationProvider>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                        label="To"
                        value={toDate}
                        minDate={fromDate}
                        onChange={(newValue) => setToDate(newValue)}
                        format="DD-MM-YYYY"
                        slotProps={{
                            textField: { size: "small", sx: { minWidth: 160, background: "#fff" } },
                        }}
                    />
                </LocalizationProvider>

                <FormControl size="small" sx={{ minWidth: 160, background: "#fff" }}>
                    <InputLabel id="shift-label" sx={{ background: "#fff" }}>Shifts</InputLabel>
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

                <Tooltip
                    title={
                        selectedGroups.length === 0
                            ? "Please select at least one machine group"
                            : selectedMachines.length === 0
                                ? "Please select at least one machine"
                                : ""
                    }
                >
                    <span>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleGenerateReport}
                            disabled={isRunDisabled}
                            sx={{
                                minWidth: 140,
                                height: "40px",
                            }}
                        >
                            {isLoading ? "Analysing..." : "Run Analysis"}
                        </Button>
                    </span>
                </Tooltip>

            </div>

            {analysisType === "oee" && (
                <div
                    style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "flex-start",
                        paddingLeft: "40px",
                        marginTop: "2px",
                        marginBottom: "10px",
                        gap: "10px",
                    }}
                >
                    <button
                        className={`btn btn-sm ${oeeViewType === "fiscal" ? "btn-secondary" : "btn-outline-secondary"
                            }`}
                        onClick={() => {
                            setOeeViewType("fiscal");
                            if (oeeFiscalUrl) {
                                setOeeGrafanaUrl(oeeFiscalUrl);
                            }
                        }}
                    >
                        Fiscal
                    </button>

                    <button
                        className={`btn btn-sm ${oeeViewType === "days" ? "btn-secondary" : "btn-outline-secondary"
                            }`}
                        onClick={() => {
                            setOeeViewType("days");
                            if (oeeDaysUrl) {
                                setOeeGrafanaUrl(oeeDaysUrl);
                            }
                        }}
                    >
                        Days
                    </button>
                </div>
            )}

            <div style={{ flexGrow: 1, position: "relative" }}>
                <iframe
                    src={getCurrentIframeUrl()}
                    style={{ width: "100%", height: "100%", border: "0" }}
                    title="Grafana Dashboard"
                />

                <div
                    style={{
                        position: "absolute",
                        top: 2,
                        right: 14,
                        width: 80,
                        height: "100%",
                        backgroundColor: "transparent",
                        zIndex: 10,
                    }}
                />
            </div>
        </Box>
    );
}