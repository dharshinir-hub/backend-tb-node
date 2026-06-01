import React, { useEffect, useState, useMemo } from "react";
import { telemetrykeydata, customerbasedshift } from "../../Services/app/companyservice";
import { getReportShifts } from "../../Services/app/reportservice";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, FormControl, InputLabel, MenuItem, Select, CircularProgress, ListItemText, Checkbox, Table, TableBody, TableCell, TableHead, TableRow, TablePagination, Card, CardContent, CardActions,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";
import { cleanCustomerId } from "../../Services/app/masterservice";

function getShiftTimes(shifts, selectedShiftNo, selectedDate) {
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
  const shift = shifts.find((s) => String(s.shift_no) === String(selectedShiftNo));
  if (!shift) return { from: null, to: null };
  return {
    from: getEpoch(shift.start_day, shift.start_time),
    to: getEpoch(shift.end_day, shift.end_time),
  };
}

function computeQueryRange(shifts, selectedShift, startDate, endDate) {
  if (!Array.isArray(shifts) || shifts.length === 0) {
    return {
      from: startDate.startOf("day").valueOf(),
      to: endDate.endOf("day").valueOf(),
    };
  }
  const allSelected =
    selectedShift.length === 0 || selectedShift.length === shifts.length;

  let firstShiftNo, lastShiftNo;
  if (allSelected) {
    firstShiftNo = String(shifts[0].shift_no);
    lastShiftNo = String(shifts[shifts.length - 1].shift_no);
  } else {
    const sorted = [...selectedShift].sort((a, b) => Number(a) - Number(b));
    firstShiftNo = sorted[0];
    lastShiftNo = sorted[sorted.length - 1];
  }

  const { from } = getShiftTimes(shifts, firstShiftNo, startDate);
  const { to } = getShiftTimes(shifts, lastShiftNo, endDate);

  return {
    from: from ?? startDate.startOf("day").valueOf(),
    to: to ?? endDate.endOf("day").valueOf(),
  };
}

function formatTs(ts) {
  if (!ts || ts === 0) return "---";

  const date = new Date(ts);

  const formattedDate = date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");

  const formattedTime = date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return `${formattedDate}, ${formattedTime}`;
}

function formatDuration(startTs, endTs) {
  if (!startTs || !endTs || endTs === 0) return "---";
  const diff = Math.max(0, Math.floor((endTs - startTs) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function exportToCSV(data, allData) {
  const headers = [
    "S.no", "Machine", "Component", "Code", "Route Card No", "Operator", "Shift",
    "Push Time", "Completed Time", "Duration", "Status", "NOK History", "Reason", "Remarks", "Responded By"
  ];
  const rows = data.map((item, index) => {
    const nokCount = (allData || [])
      .filter(b => b.job_name === item.job_name && b.status === "NOK" && b.clicked_ts < item.clicked_ts)
      .slice(-5).length;
    return [
      index + 1,
      item.device_name || "---",
      item.job_name || "---",
      item.code || '---',
      item.route_card_no || '---',
      item.operator_name || "---",
      item.shift || "---",
      item.clicked_ts ? formatTs(item.clicked_ts) : "---",
      item.end_time && item.end_time !== 0 ? formatTs(item.end_time) : "---",
      formatDuration(item.clicked_ts, item.end_time),
      item.progress === "request" ? "Pending" : item.status || "---",
      nokCount,
      item.reason || "---",
      item.remarks || "---",
      item.bluecard_email || "---",
    ];
  });
  const csvContent =
    [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bluecard_report_${dayjs().format("YYYYMMDD_HHmm")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const TABLE_HEADERS = [
  "S.no", "Machine", "Component", "Component No", "Route Card No", "Operator", "Shift",
  "Push Time", "Completed Time", "Duration", "Status", "NOK History", "Reason", "Remarks", "Responded By"
];

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "request" },
  { label: "Completed – OK", value: "ok" },
  { label: "Completed – NOK", value: "nok" },
];

export default function BluecardReport() {
  const navigate = useNavigate();
  const CustomerId = localStorage.getItem('CustomerID');
   const customerId =  cleanCustomerId(CustomerId);

   const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState([]);
  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs());
  const [bluecardData, setBluecardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [queryTimeRange, setQueryTimeRange] = useState(null);
  const [warningModal, setWarningModal] = useState(null);
  const [nokHistory, setNokHistory] = useState({});

  const {
    machineGroups,
    availableMachines,
    selectedMachines: groupedMachines,
    selectedGroups,
    showMachineGroupsDropdown,
    handleGroupChange,
    handleMachineChange: handleGroupedMachineChange,
    loading: machineGroupLoading,
    isAllMachinesSelected,
  } = useMachineGroups(customerId);

  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const customerName = localStorage.getItem("customerTitle");
        const shiftList = (await getReportShifts(customerName)) || [];
        setShifts(shiftList);
        if (shiftList.length > 0) {
          setSelectedShift(shiftList.map(s => String(s.shift_no)));
        }

      } catch (err) {
        console.error("Shift fetch error:", err);
      }
    };
    fetchShifts();
  }, []);

  useEffect(() => {
    const fetchNokHistory = async (componentName) => {
      try {
        const result = await customerbasedshift(customerId, "bluecard_nok_history");
        const history = result[0]?.value || {};
        setNokHistory(history);
      } catch {
        setNokHistory({});
      }
    };
    fetchNokHistory();
  }, []);
  console.log('nok histore', nokHistory);

  const handleShiftChange = (event) => {
    const value = event.target.value;
    let finalValue;
    if (value.includes("all")) {
      if (selectedShift.length === shifts.length) {
        finalValue = [];
      } else {
        finalValue = shifts.map((s) => String(s.shift_no));
      }
    } else {
      finalValue = value;
    }
    setSelectedShift(finalValue);
  };

  const fetchData = async () => {
    const { from, to } = computeQueryRange(shifts, selectedShift, startDate, endDate);
    setQueryTimeRange({ from, to });
    setLoading(true);
    console.log('from', from, 'to', to)
    try {
      const data = await telemetrykeydata(
      customerId,
        "CUSTOMER",
        "bluecard_push",
        from,
        to
      );
      const parsed = (data?.bluecard_push || [])
        .map((p) => {
          try {
            if (typeof p.value === "string" && p.value.trim().startsWith("{")) {
              return JSON.parse(p.value);
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      setBluecardData(parsed);
    } catch (err) {
      console.error("Blue card report fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setPage(0);
    try {
      await fetchData();
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (shifts.length > 0 && !machineGroupLoading) {
      fetchData();
    }
  }, [shifts, machineGroupLoading]);


  const filteredData = useMemo(() => {
    const allShiftsSelected =
      selectedShift.length === 0 || selectedShift.length === shifts.length;

    const normalizedGroupedMachines =
      groupedMachines?.map((m) => m.trim()) || [];

    return bluecardData
      .filter((item) => {
        const deviceName = (item.device_name || "").trim();
        const itemShift = String(item.shift || "").trim();
        const itemStatus = (item.status || "").toUpperCase();
        const itemProgress = (item.progress || "").toLowerCase();

        const matchStatus =
          statusFilter === "all" ||
          (statusFilter === "request" && itemProgress === "request") ||
          (statusFilter === "ok" &&
            itemProgress === "completed" &&
            itemStatus === "OK") ||
          (statusFilter === "nok" &&
            itemProgress === "completed" &&
            itemStatus === "NOK");

        const matchShift =
          allShiftsSelected || selectedShift.map(String).includes(itemShift);

        return matchStatus && matchShift;
      })
      .filter((item) =>
        normalizedGroupedMachines.includes((item.device_name || "").trim())
      );
  }, [
    bluecardData,
    statusFilter,
    groupedMachines,
    selectedShift,
    shifts,
  ]);

  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredData.slice(start, end);
  }, [filteredData, page, rowsPerPage]);

  console.log('filtereddata', filteredData);
  const getStatusStyle = (item) => {
    if (item.progress === "request")
      return { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", label: "Pending" };
    if (item.status === "OK")
      return { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", label: "OK" };
    if (item.status === "NOK")
      return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", label: "NOK" };
    return { bg: "#f9fafb", text: "#374151", border: "#e5e7eb", label: "---" };
  };

  const total = bluecardData.length;
  const pending = bluecardData.filter((d) => d.progress === "request").length;
  const okCount = bluecardData.filter((d) => d.progress === "completed" && d.status === "OK").length;
  const nokCount = bluecardData.filter((d) => d.progress === "completed" && d.status === "NOK").length;

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


  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fdfdfd", padding: "20px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "20px",
          backgroundColor: "#fffefe",
          width: "100%",
          fontSize: "18px",
          fontWeight: "600",
        }}
      >
        <div style={{ fontSize: "23px", fontWeight: "600" }}>
          Blue Card Report
        </div>
      </div>


      <div style={{ padding: "0 24px", margin: 0 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", my: 3 }}>

          {showMachineGroupsDropdown && (
            <FormControl size="small" sx={{ background: "#fff", width: 200 }}>
              <InputLabel sx={{ background: "#fff" }}>Machine Group</InputLabel>
              <Select
                multiple
                value={selectedGroups}
                onChange={(e) => handleGroupChange(e.target.value)}
                renderValue={(selected) => {
                  if (selected.length === machineGroups.length) return "All Groups";
                  if (selected.length === 0) return "Select Groups";
                  return selected.join(", ");
                }}
              >
                <MenuItem value="all">
                  <Checkbox
                    sx={{ "&.Mui-checked": { color: "#f47803ff" } }}
                    checked={selectedGroups.length === machineGroups.length}
                  />
                  <ListItemText primary="All" />
                </MenuItem>
                {machineGroups.map((group) => (
                  <MenuItem key={group.name} value={group.name}>
                    <Checkbox
                      checked={selectedGroups.includes(group.name)}
                      sx={{ "&.Mui-checked": { color: "#f47803ff" } }}
                    />
                    <ListItemText primary={group.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl size="small" sx={{ background: "#fff", width: 200 }}>
            <InputLabel sx={{ background: "#fff" }}>Machine</InputLabel>
            <Select
              multiple
              value={groupedMachines}
              onChange={(e) => handleGroupedMachineChange(e.target.value)}
              renderValue={(selected) => {
                if (isAllMachinesSelected) return "All Machines";
                if (selected.length === 0) return "Select Machines";
                return selected.join(", ");
              }}
            >
              <MenuItem value="all">
                <Checkbox
                  sx={{ "&.Mui-checked": { color: "#f47803ff" } }}
                  checked={isAllMachinesSelected}
                />
                <ListItemText primary="All" />
              </MenuItem>
              {availableMachines.map((machineName, idx) => (
                <MenuItem key={idx} value={machineName}>
                  <Checkbox
                    checked={groupedMachines.includes(machineName)}
                    sx={{ "&.Mui-checked": { color: "#f47803ff" } }}
                  />
                  <ListItemText primary={machineName} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ background: "#fff", width: 160 }}>
            <InputLabel sx={{ background: "#fff" }}>Shift</InputLabel>
            <Select
              multiple
              value={selectedShift}
              onChange={handleShiftChange}
              renderValue={(selected) => selected.join(", ")}
              label="Shift"
            >
              <MenuItem value="all">
                <Checkbox
                  sx={{ "&.Mui-checked": { color: "#f47803ff" } }}
                  checked={selectedShift.length === shifts.length}
                />
                <ListItemText primary="All" />
              </MenuItem>
              {shifts.map((shift) => (
                <MenuItem key={shift.shift_no} value={String(shift.shift_no)}>
                  <Checkbox
                    sx={{ "&.Mui-checked": { color: "#f47803ff" } }}
                    checked={selectedShift.includes(String(shift.shift_no))}
                  />
                  <ListItemText primary={`${shift.shift_no}`} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              format="DD-MM-YYYY"
              disableFuture
              slotProps={{
                textField: { size: "small", style: { background: "#fff", minWidth: 160 } },
              }}
            />
          </LocalizationProvider>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              format="DD-MM-YYYY"
              disableFuture
              slotProps={{
                textField: { size: "small", style: { background: "#fff", minWidth: 160 } },
              }}
            />
          </LocalizationProvider>

          <FormControl size="small" sx={{ background: "#fff", width: 160 }}>
            <InputLabel sx={{ background: "#fff" }}>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              {STATUS_FILTERS.map((f) => (
                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="warning"
            onClick={handleSubmit}
            disabled={isSubmitting || machineGroupLoading}
            sx={{ minWidth: 120 }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : "Submit"}
          </Button>

          <Button
            variant="outlined"
            onClick={() => exportToCSV(filteredData, bluecardData)}
            disabled={filteredData.length === 0}
            sx={{
              minWidth: 120,
              borderColor: "#ED6C02",
              color: "#ED6C02",
              "&:hover": { borderColor: "#ED6C02", backgroundColor: "rgb(251, 244, 229)" },
              "&.Mui-disabled": { borderColor: "#f0e5d8", color: "#edb561" },
            }}
          >
            Export CSV
          </Button>
        </Box>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
          {[
            { label: "Total", value: total, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
            { label: "Pending", value: pending, color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
            { label: "Completed – OK", value: okCount, color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
            { label: "Completed – NOK", value: nokCount, color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
          ].map((card) => {
            const maxValue = Math.max(total, pending, okCount, nokCount, 1);
            const barWidth = (card.value / maxValue) * 100;

            return (
              <div key={card.label} style={{
                flex: "1",
                minWidth: "140px",
                backgroundColor: card.bg,
                border: `1px solid ${card.border}`,
                borderRadius: "10px",
                padding: "14px 20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>{card.label}</div>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: card.color }}>{card.value}</div>
                </div>

                <div style={{
                  height: "10px",
                  width: "100%",
                  backgroundColor: "#d6dae3",
                  borderRadius: "3px",
                  marginTop: "12px",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    backgroundColor: card.color,
                    borderRadius: "3px",
                    transition: "width 0.3s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        <Card sx={{ overflow: "auto", padding: 0 }}>
          <CardContent sx={{ padding: "0 !important" }}>
            <div className="example-container" style={{ background: "#fcfcfc" }}>
              <Table stickyHeader aria-label="bluecard report table" sx={{ tableLayout: "auto", width: "100%" }}>
                <TableHead sx={{ background: "#999999" }}>
                  <TableRow>
                    {TABLE_HEADERS.map((header, idx) => (
                      <TableCell
                        align="center"
                        key={idx}
                        sx={{
                          minWidth: 100,
                          fontSize: "14px !important",
                          color: "#fff !important",
                          backgroundColor:
                            header === "Push Time"
                              ? "#207A24 !important"
                              : header === "Duration"
                                ? "#FFA500 !important"
                                : "#999999 !important",
                        }}
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={TABLE_HEADERS.length} align="center" style={{ padding: "40px" }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        align="center"
                        colSpan={TABLE_HEADERS.length}
                        style={{
                          backgroundColor: "#f7f7f7", color: "#555",
                          padding: "30px", fontWeight: 500, fontSize: "1rem",
                        }}
                      >
                        NO DATA FOUND
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((item, index) => {
                      const s = getStatusStyle(item);
                      const globalIndex = page * rowsPerPage + index;
                      const rowBg = index % 2 === 0 ? "#efefef" : "#f8f8f8";
                      const entries = (bluecardData || [])
                        .filter(b => b.job_name === item.job_name && b.status === "NOK" && b.clicked_ts < item.clicked_ts)
                        .slice(-5);

                      const cellStyle = {
                        background: rowBg,
                        fontSize: "14px",
                        fontWeight: 400,
                        fontFamily: "Roboto, Helvetica, Arial, sans-serif",
                        color: "#000",
                        padding: "10px 20px",
                        borderBottom: "1px solid #e0e0e0",
                        textAlign: "center"
                      };

                      return (
                        <TableRow key={index} style={{ height: "36px" }}>

                          <TableCell align="center" style={cellStyle}>
                            {globalIndex + 1}
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                            {item.device_name || "---"}
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                            {item.job_name || "No Operations"}
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                            {item.code || "-"}
                          </TableCell>

                          <TableCell align="center" style={cellStyle}>
                            {item.route_card_no || "No Routecard"}
                          </TableCell>

                          <TableCell align="center" style={cellStyle}>
                            {item.operator_name || "No Operator"}
                          </TableCell>

                          <TableCell align="center" style={cellStyle}>
                            {item.shift || "---"}
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                            {formatTs(item.clicked_ts)}
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                            {item.progress === "completed"
                              ? formatTs(item.end_time)
                              : "---"}
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                            {item.progress === "completed"
                              ? formatDuration(item.clicked_ts, item.end_time)
                              : "---"}
                          </TableCell>

                          <TableCell align="center" style={cellStyle}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 600,
                                backgroundColor: s.bg,
                                color: s.text,
                                border: `1px solid ${s.border}`,
                                textTransform: "uppercase"
                              }}
                            >
                              {s.label}
                            </span>
                          </TableCell>

                          <TableCell align="center" style={cellStyle}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 600,
                                backgroundColor: entries.length === 0 ? "#f0fdf4" : "#fee2e2",
                                color: entries.length === 0 ? "#15803d" : "#b91c1c",
                                border: `1px solid ${entries.length === 0 ? "#bbf7d0" : "#fecaca"}`,
                                cursor: "pointer"
                              }}
                              onClick={() =>
                                setWarningModal({
                                  componentName: item.job_name,
                                  machineName: item.device_name,
                                  entries: entries || []
                                })
                              }
                            >
                              {entries.length}
                            </span>
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, maxWidth: 200 }}>
                            <div
                              title={formatReason(item.reason) || "---"}
                              style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180, margin: "0 auto", cursor: "default" }}
                            >
                              {formatReason(item.reason) || "---"}
                            </div>
                          </TableCell>

                          <TableCell align="center" style={{ ...cellStyle, maxWidth: 200 }}>
                            <div
                              title={item.remarks || "---"}
                              style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180, margin: "0 auto", cursor: "default" }}
                            >
                              {item.remarks || "---"}
                            </div>
                          </TableCell>

                          <TableCell align="center" style={cellStyle}>
                            {item.bluecard_email || "---"}
                          </TableCell>

                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardActions sx={{ px: 2, justifyContent: "end", background: "#dddddd" }}>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="Items per page"
              sx={{ "& .MuiTablePagination-toolbar": { alignItems: "baseline" } }}
            />
          </CardActions>
        </Card>

        {warningModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.45)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
              padding: "16px",
            }}
            onClick={() => setWarningModal(null)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "600px",
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div
                style={{
                  background: "linear-gradient(135deg,#ef4444,#b91c1c)",
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    ⚠ Previous NOK History
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginTop: "2px" }}>
                    {warningModal.componentName}
                  </div>
                  <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>
                    Machine: {warningModal.machineName}
                  </div>
                </div>
                <button
                  onClick={() => setWarningModal(null)}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "#fff",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    fontSize: "18px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: "16px 24px 8px", color: "#6b7280", fontSize: "13px" }}>
                Showing last <strong style={{ color: "#b91c1c" }}>{warningModal.entries.length} NOK rejection{warningModal.entries.length > 1 ? "s" : ""}</strong> for this component.
              </div>

              {/* NOK entry list */}
              <div style={{ overflowY: "auto", padding: "8px 24px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {warningModal.entries.map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #fecaca",
                      borderLeft: "4px solid #ef4444",
                      borderRadius: "10px",
                      padding: "14px 16px",
                      background: "#fef2f2",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#991b1b" }}>
                        NOK Record {i + 1}
                      </span>
                      <span style={{ fontSize: "11px", color: "#b91c1c", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "999px", padding: "2px 8px", fontWeight: 700 }}>
                        NOK
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "6px 16px",
                        fontSize: "13px",
                        color: "#374151",
                      }}
                    >
                      {/* Left column */}
                      <div><span style={{ color: "#6b7280" }}>Machine: </span><strong>{entry.device_name || "–"}</strong></div>
                      <div><span style={{ color: "#6b7280" }}>Route Card No: </span><strong>{entry.route_card_no || "No Route Card No"}</strong></div>

                      <div><span style={{ color: "#6b7280" }}>Operator: </span><strong>{entry.operator_name || "No Operator"}</strong></div>
                      <div><span style={{ color: "#6b7280" }}>Shift: </span><strong>{entry.shift || "–"}</strong></div>

                      {/* Right column */}
                      <div><span style={{ color: "#6b7280" }}>Rejected at: </span><strong>{formatTs(entry.end_time)}</strong></div>
                      <div>
                        <span style={{ color: "#6b7280" }}>Reason: </span>
                        <strong style={{ color: "#b91c1c" }}>{formatReason(entry.reason) || "No Reason"}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#6b7280" }}>Remark: </span>
                        <strong>{entry.remarks && entry.remarks !== "No Remarks" ? entry.remarks : "–"}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
