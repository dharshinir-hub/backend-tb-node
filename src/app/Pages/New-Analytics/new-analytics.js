import {
    Box, FormControl, InputLabel, Select, MenuItem,
    Checkbox,
    ListItemText
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import "./new-analytics.css";
import {
    cleanCustomerId,
    customerbasedshift,
} from "../../Services/app/operatorservice";
import { getAverageOEEForRange } from "../../Shared/utils/oeeCalculations";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";

export default function NewAnalytics() {
    const customerId = localStorage.getItem("CustomerID");
    const {
        devices,
        deviceNameID,
        machineGroups,
        availableMachines,
        selectedMachines,
        selectedGroup,
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
            const machinesForUrl = selectedMachines;
            const devicesToProcessFromMachines = getDeviceObjectsForMachines(machinesForUrl);

            let devicesToProcess = devicesToProcessFromMachines;

            if (devicesToProcess.length === 0) {
                console.log("No devices to process for OEE data");
                setAvgOeeData({});
                return;
            }

            const { avgData } = await getAverageOEEForRange(
                devicesToProcess,
                shifts,
                from,
                to
            );
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
        }
    };

    console.log('avg oee data', avgOeeData)

    const updateGrafanaURL = () => {
        if (analysisType === "oee") return;

        const machinesForUrl = selectedMachines;
        const machineParam = machinesForUrl.join(",");

        const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
        const cleanedId = cleanCustomerId(customerId);
        const baseUrl = window._env_.SERVER_URL;
        const GRAFANA_URL = window._env_.GRAFANA_URL;
        let entityType = "CUSTOMER";

        const url =
            `${GRAFANA_URL}d/a56900cd-961f-4ed4-99c5-3ec120450653/alarm?orgId=1&var-token=${bearerToken}&var-customerid=${cleanedId}&var-entityType=${entityType}&var-entityId=${cleanedId}&var-fromTime=${fromTime}&var-toTime=${toTime}&from=${from}&to=${to}&var-url=${baseUrl}&var-keys=${analysisType}&var-grafanaurl=${GRAFANA_URL}&var-machines=${encodeURIComponent(machineParam)}&kiosk&theme=light&refresh=20s`;
        console.log(url, 'Grafana URL');
        setGrafanaUrl(url);
    };

    useEffect(() => {
        if (analysisType === "oee") {
            if (from && to) {
                updateOeeDataAndUrl();
            }
        } else {
            updateGrafanaURL();
        }
    }, [selectedGroup, selectedMachines, analysisType]);

    useEffect(() => {
        if (analysisType === "oee") {
            if (from && to) {
                updateOeeDataAndUrl();
            }
        } else {
            updateGrafanaURL();
        }
    }, [from, to, oeeViewType, selectedMachines]);

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
                            labelId="machine-group-label"
                            id="machine-group-select"
                            value={selectedGroup}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            label="Machine Group"
                        >
                            <MenuItem value="all">All Groups</MenuItem>
                            {machineGroups.map((g, i) => (
                                <MenuItem key={i} value={g.name}>
                                    {g.name}
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
                    <InputLabel id="analysis-label">Analysis Type</InputLabel>
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
                        onChange={(newValue) => setToDate(newValue)}
                        format="DD-MM-YYYY"
                        slotProps={{
                            textField: { size: "small", sx: { minWidth: 160, background: "#fff" } },
                        }}
                    />
                </LocalizationProvider>

                <FormControl size="small" sx={{ minWidth: 160, background: "#fff" }}>
                    <InputLabel id="shift-label">Shifts</InputLabel>
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
                        onClick={() => setOeeViewType("fiscal")}
                    >
                        Fiscal
                    </button>

                    <button
                        className={`btn btn-sm ${oeeViewType === "days" ? "btn-secondary" : "btn-outline-secondary"
                            }`}
                        onClick={() => setOeeViewType("days")}
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