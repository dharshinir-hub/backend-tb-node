import { useEffect, useState } from "react";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tabs,
  Tab,
  Box,
  Table, TableBody, TableCell, TableHead, TableRow, TablePagination, ListItemText, Checkbox, Card,
  CardContent,
  CardActions,
  Tooltip
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { getGeneralReport, getOeeReport, getPartReport, getReportMachineList, getReportShifts } from "../../Services/app/reportservice";
import classNames from 'classnames';

export default function MachineReport() {
  const [selectedTab, setSelectedTab] = useState("general");
  // const [selectedModule, setSelectedModule] = useState("SURIN");
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [selectedShift, setSelectedShift] = useState([]);
  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs());
  const [reportData, setReportData] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const REPORT_HEADERS = {
    general: [
      "S.no", "Date", "Machine", "Shift", "Operator Name", "Component Number",
      "Component Name", "Target", "Actual Parts Produced", "Reject", "Rework",
      "Efficiency(%)", "Utilization(%)", "Run Time", "Idle/Stop Time",
      "Machine OFF Time", "Duration"
    ],
    oee: ["S.no", "Date", "Shift", "Machine Name", "Availability(%)", "Performance(%)", "Quality(%)", "OEE(%)"],
    // idle: ["S.no", "Date", "Shift", "Machine Name", "Operator Name", "Mode", "Reason", "Duration"],
    part: [
      "S.no", "Date", "Shift", "Machine Name", "Component Name", "Operator Name",
      "Actual Parts", "Start Time", "End Time", "Run Time", "Idle/Stop Time",
      "Machine OFF Time", "Duration"
    ]
  };

  const formatWithFallback = (value, fallback = "---") =>
    value === null || value === undefined ? fallback : value;

  const formatTimeWithFallback = (value, fallback = "0:00:00") =>
    value === null || value === undefined ? fallback : formatTime(value);

  const columns = {
    general: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(formatDate(row.date)) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      {
        key: "operator_name", formatter: row => Array.isArray(row.operator_name)
          ? (row.operator_name.length > 2 ? row.operator_name.slice(0, 2).join(' | ') + ' ...' : row.operator_name.join(' | '))
          : formatWithFallback(row.operator_name)
      },
       {
        key: "component_id", formatter: row => Array.isArray(row.component_id)
          ? (row.component_id.length > 2 ? row.component_id.slice(0, 2).join(' | ') + ' ...' : row.component_id.join(' | '))
          : formatWithFallback(row.component_id)
      },
      {
        key: "component_name", formatter: row => Array.isArray(row.component_name)
          ? (row.component_name.length > 2 ? row.component_name.slice(0, 2).join(' | ') + ' ...' : row.component_name.join(' | '))
          : formatWithFallback(row.component_name)
      },
      { key: "tar", formatter: row => formatWithFallback(row.tar) },
      { key: "actual", formatter: row => formatWithFallback(row.actual) },
      { key: "reject", formatter: row => formatWithFallback(row.reject) },
      { key: "rework", formatter: row => formatWithFallback(row.rework) },
      { key: "efficiency", formatter: row => formatWithFallback(row.efficiency) },
      { key: "run", formatter: row => formatWithFallback(row.run) },
      { key: "run_time", formatter: row => formatTimeWithFallback(row.run_time) },
      { key: "idle_time", formatter: row => formatTimeWithFallback(row.idle_time) },
      { key: "discon_time", formatter: row => formatTimeWithFallback(row.discon_time) },
      { key: "total_time", formatter: row => formatTimeWithFallback(row.run_time + row.idle_time + row.discon_time) },
    ],
    oee: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(formatDate(row.date)) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "availability", formatter: row => formatWithFallback(row.availability) },
      { key: "performance", formatter: row => formatWithFallback(row.performance) },
      { key: "quality", formatter: row => formatWithFallback(row.quality) },
      { key: "oee", formatter: row => formatWithFallback(row.oee) },
    ],
    part: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(formatDate(row.date)) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "route_card", formatter: row => formatWithFallback(row.route_card) },
      { key: "operator", formatter: row => formatWithFallback(row.operator) },
      { key: "productresult", formatter: row => formatWithFallback(row.productresult) },
      { key: "start_time", formatter: row => row.start_time ? formatDateTime(row.start_time) : "---" },
      { key: "end_time", formatter: row => row.end_time ? formatDateTime(row.end_time) : "---" },
      { key: "run_time", formatter: row => formatTimeWithFallback(row.run_time) },
      { key: "idle_time", formatter: row => formatTimeWithFallback(row.idle_time) },
      { key: "stop_time", formatter: row => formatTimeWithFallback(row.stop_time) },
      { key: "duration", formatter: row => formatTimeWithFallback(row.duration) },
    ]
  };

  const [reportTableHeaders, setReportTableHeaders] = useState(REPORT_HEADERS['general']);
  const [errorMsg, setErrorMsg] = useState({
    machines: false,
    shifts: false,
    startDate: false,
    endDate: false,
    dateRange: false
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const customerName = localStorage.getItem('customerName');
        const shiftResult = await getReportShifts(customerName);
        const shiftList = shiftResult || [];
        setShifts(shiftList);
        const selectedShifts = shiftList.map(s => String(s.shift_no));
        if (shiftList.length > 0) setSelectedShift([selectedShifts[0]]);
        const machineResult = await getReportMachineList(customerName);
        const machinesList = machineResult || [];
        setMachines(machinesList);
        const selectedMachinesList = machinesList.map(m => m.name);
        if (machinesList.length > 0) setSelectedMachines([selectedMachinesList[0]]);
        if (selectedMachinesList.length > 0 && selectedShifts.length > 0) {
          await fetchReport(0, rowsPerPage, "general", selectedMachinesList, selectedShifts);
        }
        setErrorMsg(prev => ({
          ...prev,
          machines: selectedMachinesList.length === 0 || selectedMachinesList[0] === undefined,
          shifts: selectedShifts.length === 0 || selectedShifts[0] === undefined,
        }));
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };

    fetchData();
  }, []);

  const fetchReport = async (pageNum = page, limit = rowsPerPage, tab = selectedTab, machinesParam = selectedMachines, shiftsParam = selectedShift) => {
    try {
      const dateStr = startDate.format("YYYY-MM-DD");
      const dateEnd = endDate.format("YYYY-MM-DD");
      let response;
      if (tab === "part") {
        response = await getPartReport(
          machinesParam.join(","), shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
      } else if (tab === "general") {
        response = await getGeneralReport(
          machinesParam.join(","), shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
      } else if (tab === "oee") {
        response = await getOeeReport(
          machinesParam.join(","), shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
      }
      setReportData(response.data || response);
      setTotalCount(response.total || 0);
    } catch (err) {
      console.error(`Failed to fetch ${tab} report`, err);
    }
  };

  const handleChangePage = async (event, newPage) => {
    setPage(newPage);
    await fetchReport(newPage, rowsPerPage);
  };

  const handleChangeRowsPerPage = async (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setRowsPerPage(newLimit);
    setPage(0);
    setTotalCount(0);
    await fetchReport(0, newLimit);
  };

  const validateForm = () => {
    const errors = {
      machines: selectedMachines.length === 0 || selectedMachines[0] === undefined,
      shifts: selectedShift.length === 0 || selectedShift[0] === undefined,
      startDate: !startDate,
      endDate: !endDate,
      dateRange: startDate && endDate && startDate.isAfter(endDate),
    };
    setErrorMsg(errors);
    return !Object.values(errors).some(Boolean);
  };
  const tabChange = (currentTab) => {
    setSelectedTab(currentTab);
    setReportTableHeaders(REPORT_HEADERS[currentTab] || []);
    setReportData([]);
    setPage(0);
    setTotalCount(0);
    fetchReport(0, rowsPerPage, currentTab);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setPage(0);
    setTotalCount(0);
    await fetchReport(0, rowsPerPage);
  };

  const handleMachineChange = (event) => {
    const value = event.target.value;
    let finalValue;
    if (value.includes("all")) {
      if (selectedMachines.length === machines.length) {
        finalValue = [];
      } else {
        finalValue = machines.map((m) => m.name);
      }
    } else {
      finalValue = value;
    }
    setSelectedMachines(finalValue);
    setErrorMsg((prev) => ({
      ...prev,
      machines: finalValue.length === 0,
    }));
  };


  const handleShiftChange = (event) => {
    const value = event.target.value;
    let finalValue;
    if (value.includes("all")) {
      if (selectedShift.length === shifts.length) {
        finalValue = [];
      } else {
        finalValue = shifts.map((shift) => String(shift.shift_no));
      }
    } else {
      finalValue = value;
    }
    setSelectedShift(finalValue);
    setErrorMsg((prev) => ({
      ...prev,
      shifts: finalValue.length === 0,
    }));
  };

  const handleStartDateChange = (newValue) => {
    if (!newValue || !newValue.isValid()) {
      setStartDate(null);
      setErrorMsg((prev) => ({ ...prev, startDate: true }));
    } else {
      setStartDate(newValue);
      setErrorMsg((prev) => ({
        ...prev,
        startDate: false,
        dateRange: endDate && newValue.isAfter(endDate)
      }));
    }
  };

  const handleEndDateChange = (newValue) => {
    if (!newValue || !newValue.isValid()) {
      setEndDate(null);
      setErrorMsg((prev) => ({ ...prev, endDate: true }));
    } else {
      setEndDate(newValue);
      setErrorMsg((prev) => ({
        ...prev,
        endDate: false,
        dateRange: startDate && startDate.isAfter(newValue)
      }));
    }
  };


  const formatTime = (seconds) => {
    const sec = Number(seconds);
    if (isNaN(sec)) return "00:00:00";
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return [hrs, mins, secs]
      .map((v) => v.toString().padStart(2, "0"))
      .join(":");
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    return dayjs(dateString).format("DD-MM-YYYY HH:mm:ss");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return dayjs(dateString).format("DD-MM-YYYY");
  };

  return (
    <Box sx={{
      p: 2, background: "#fffefeff", color: "#0a0a0aff", height: "100vh", paddingTop: "50px", overflow: 'auto', "&::-webkit-scrollbar": { display: "none", }, scrollbarWidth: "none", msOverflowStyle: "none",
    }}>
      {/* Tabs */}
      <Tabs
        value={selectedTab}
        onChange={(e, v) => tabChange(v)}
        textColor="inherit"
        TabIndicatorProps={{
          sx: {
            backgroundColor: '#f47803',
          },
        }}
      >
        <Tab label="General Report" value="general" />
        <Tab label="OEE Report" value="oee" />
        {/* <Tab label="Idle Reason Report" value="idle" /> */}
        <Tab label="Part Wise Report" value="part" />
      </Tabs>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", my: 3, }}>
        {/* <FormControl size="small" sx={{ background: "#fff", minWidth: 160 }}>
          <InputLabel>Module</InputLabel>
          <Select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
          >
            <MenuItem value="SURIN">SURIN</MenuItem>
            <MenuItem value="MODULE2">MODULE 2</MenuItem>
          </Select>
        </FormControl> */}
        <FormControl error={errorMsg.machines} size="small" sx={{ background: "#fff", width: 200 }}>
          <InputLabel sx={{ background: '#fff' }}>Machine * </InputLabel>
          <Select
            multiple
            value={selectedMachines}
            onChange={handleMachineChange}
            renderValue={(selected) => selected.join(", ")}
          >
            <MenuItem value="all">
              <Checkbox sx={{
                '&.Mui-checked': {
                  color: "#f47803ff",
                }
              }}
                checked={selectedMachines.length === machines.length}
              />
              <ListItemText primary="All" />
            </MenuItem>
            {machines.map((machine) => (
              <MenuItem key={machine.id} value={machine.name}>
                <Checkbox checked={selectedMachines.includes(machine.name)} sx={{
                  '&.Mui-checked': {
                    color: "#f47803ff",
                  }
                }} />
                <ListItemText primary={machine.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl error={errorMsg.shifts} size="small" sx={{ background: "#fff", width: 160 }}>
          <InputLabel sx={{ background: '#fff' }}>Shift *</InputLabel>
          <Select
            multiple
            value={selectedShift}
            onChange={handleShiftChange}
            renderValue={(selected) =>
              selected.join(", ")
            }
          >
            <MenuItem value="all">
              <Checkbox sx={{
                '&.Mui-checked': {
                  color: "#f47803ff",
                }
              }}
                checked={selectedShift.length === shifts.length}
              />
              <ListItemText primary="All" />
            </MenuItem>
            {shifts.map((shift) => (
              <MenuItem key={shift.shift_no} value={String(shift.shift_no)}>
                <Checkbox sx={{
                  '&.Mui-checked': {
                    color: "#f47803ff",
                  },
                }} checked={selectedShift.includes(String(shift.shift_no))} />
                <ListItemText primary={`${shift.shift_no}`} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Start Date *"
            value={startDate}
            required={true}
            onChange={(newValue) => handleStartDateChange(newValue)}
            format="DD-MM-YYYY"
            disableFuture={true}
            slotProps={{
              textField: {
                size: "small",
                style: { background: "#fff", minWidth: 160 },
                error: errorMsg.startDate || errorMsg.dateRange,
              },
            }}
          />
        </LocalizationProvider>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="End Date *"
            required={true}
            value={endDate}
            onChange={(newValue) => handleEndDateChange(newValue)}
            format="DD-MM-YYYY"
            disableFuture={true}
            slotProps={{
              textField: {
                size: "small",
                style: { background: "#fff", minWidth: 160 },
                error: errorMsg.endDate || errorMsg.dateRange,
              },
            }}
          />
        </LocalizationProvider>

        <Button
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          sx={{ minWidth: 120 }}
        >
          Submit
        </Button>

        {/* Action Buttons */}
        {/* {reportData.length > 0 && (
        <>
         <Button variant="contained" color="warning">
            View Chart
          </Button>
          <Button variant="contained" color="warning">
            Export
          </Button>
        </>
      )} */}
      </Box>

      {/* Report Table */}
      {
        <Card className="card_sec" sx={{ overflow: "auto", padding: 0 }}>
          <CardContent sx={{ padding: "0 !important" }}>
            <div className="example-container" style={{ background: '#fcfcfc' }}>
              <Table stickyHeader aria-label="sticky table" sx={{ tableLayout: "auto", width: "100%" }} >
                <TableHead sx={{ background: '#999999' }}>
                  <TableRow>
                    {reportTableHeaders.map((header, index) => (
                      <TableCell align="center"
                        key={index}
                        sx={{
                          minWidth: header === 'Actual Parts Produced' ? 110 : 100,
                          fontSize: '14px !important',
                          color: "#fff !important",
                          backgroundColor:
                            header === "Run Time"
                              ? "#207A24 !important"
                              : header === "Idle/Stop Time"
                                ? "#FFA500 !important"
                                : header === "Machine OFF Time"
                                  ? "#434343 !important"
                                  : "#999999 !important",
                        }}
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.map((row, index) => (
                    <TableRow key={index}>
                      {columns[selectedTab].map((col, i) => (
                        <TableCell
                          key={i}
                          align="center"
                          style={{ background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}
                          sx={{
                            whiteSpace: "nowrap",
                            minWidth: "fit-content",
                            maxWidth: "200px",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                        >
                          {(() => {
                            const rawData = col.formatter(row, index);
                            const displayData = rawData !== null && rawData !== undefined ? String(rawData) : "---";
                            const fullData = Array.isArray(row[col.key]) ? row[col.key].join(" | ") : row[col.key] || "---";
                            return ['component_name', 'operator_name', 'component_number', 'machine_name', 'component_id'].includes(col.key) ? (
                              <Tooltip title={fullData}>
                                <span>{displayData}</span>
                              </Tooltip>
                            ) : (
                              <span>{displayData}</span>
                            );
                          })()}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {reportData.length === 0 && (
                    <TableRow>
                      <TableCell
                        align="center"
                        colSpan={reportTableHeaders.length}
                        style={{
                          backgroundColor: "#f7f7f7",
                          color: "#555",
                          padding: "30px",
                          fontWeight: 500,
                          fontSize: "1rem",
                          height: '100%'
                        }}
                      >
                        NO DATA FOUND
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardActions sx={{ px: 2, justifyContent: 'end', background: '#dddddd' }}>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Items per page"
              sx={{
                "& .MuiTablePagination-toolbar": {
                  alignItems: "baseline"
                }
              }}
            />
          </CardActions>
        </Card>
      }
    </Box>
  );
}
