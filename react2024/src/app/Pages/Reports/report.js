import React, { useEffect, useState } from "react";
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
  Tooltip,
  Typography,
  CircularProgress,
  IconButton,
  Autocomplete,
  TextField
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { getAlarmReport, getEfficiencyReport, getGeneralReport, getIdleReasonReport, getOeeReport,getOperatorReport, getPartReport, getReportDownloadLink, getReportMachineList, getReportShifts, getSequenceReport } from "../../Services/app/reportservice";
import { customerbasedshift, cleanCustomerId } from "../../Services/app/operatorservice";
import classNames from 'classnames';
import { DownloadIcon, ChevronDown, ChevronUp } from "lucide-react";
import Swal from "sweetalert2";
import { useMachineGroups } from "../../Shared/hooks/useMachineGroups";

export default function MachineReport() {
  const [selectedTab, setSelectedTab] = useState("general");
  const [selectedShift, setSelectedShift] = useState([]);
  const [startDate, setStartDate] = useState(dayjs());
  const [efficiencyDate, setEfficiencyDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs());
  const [reportData, setReportData] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [idleReasonWithPercentage, setIdleReasonWithPercentage] = useState([]);
  const [alarmWithPercentage, setAlarmWithPercentage] = useState([]);
  const [averageEfficiency, setAverageEfficiency] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operators, setOperators] = useState([]);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  const customerId = localStorage.getItem("CustomerID");
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
    deviceNameID
  } = useMachineGroups(customerId, selectedTab === "efficiency");

  const REPORT_HEADERS = {
    general: [
      "S.no", "Date", "Machine", "Shift", "Operator Name", "Component Number",
      "Component Name", "Target", "Actual Parts Produced", "Reject", "Rework",
      "Efficiency(%)", "Utilization(%)", "Run Time", "Idle/Stop Time",
      "Alarm Time", "Disconnect Time", "Duration"
    ],
    oee: ["S.no", "Date", "Shift", "Machine Name", "Availability(%)", "Performance(%)", "Quality(%)", "OEE(%)"],
    part: [
      "S.no", "Date", "Shift", "Machine Name", "Component Name", "Operator Name", "Total Parts",
      "Actual Parts", "Start Time", "End Time", "Run Time", "Idle/Stop Time",
      "Machine OFF Time", "Duration", "Remarks"
    ],
    idle_reason: [
      "S.no", "Date", "Shift", "Machine Name",
      "Mode", "Category", "Reason", "Operator Name", "Component Name", "Duration"
    ],
    alarm: [
      "S.no", "Date", "Shift", "Machine Name",
      "Alarm Message", "Alarm Number", "Operator Name", "Component Name", "Duration"
    ],
    efficiency: [
      "S.no", "Component Number", "Component Name", "Total Parts", "Target Parts", "Efficiency(%)", "Run Time", "Idle/Stop Time", "Duration"
    ],
    operator_wise: [
      "S.no", "Date", "Shift", "Operator", "Machine Name", "Component Name", "Target Parts", "Actual Parts", "Efficiency"
    ],
    sequence_report: [
      "S.no", "Date & Time", "Machine Name", "Operator No", "Operator Name", "Comp. Drawing No",
      "Comp. Description", "Comp. Serial No", "Program No", "Revision No", "Actual Part Count",
      "Run Time", "Idle Time", "Disconnect Time", "Alarm Time", "Component Status",
      "Operation Sequence", "Planned Touch Time", "Start Time", "End Time", "Actual Run Time",
      "Operation Status", "Alarm", "Message"
    ]
  };

  const formatWithFallback = (value, fallback = "---") =>
    value === null || value === undefined || value?.length === 0 ? fallback : value;

  const formatTimeWithFallback = (value, fallback = "0:00:00") =>
    value === null || value === undefined ? fallback : formatTime(value);

  const formatDowntimeType = (value, fallback = "---") => {
    if (!value) return fallback;
    if (value.includes("_")) {
      return value
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^\w/, c => c.toUpperCase());
    }
    return value;
  };

  const formatStatusBadge = (status) => {
    const badgeStyle = {
      padding: '6px 12px',
      borderRadius: '4px',
      fontWeight: 'bold',
      color: 'white',
      fontSize: '0.75rem',
      display: 'inline-block'
    };
    const statusLower = status ? String(status).toLowerCase() : '';
    if (statusLower === 'running' || statusLower === 'completed') badgeStyle.backgroundColor = '#4CAF50';
    else if (statusLower === 'unknown') badgeStyle.backgroundColor = '#2196F3';
    else if (statusLower === 'skipped' || statusLower === 'rework' || statusLower === 'incomplete') badgeStyle.backgroundColor = '#F44336';
    else if (statusLower === 'stopped') badgeStyle.backgroundColor = '#F44336';
    else if (statusLower === 'idle') badgeStyle.backgroundColor = '#FF9800';
    else badgeStyle.backgroundColor = '#999999';
    return <span style={badgeStyle}>{formatWithFallback(status)}</span>;
  };

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
      { key: "efficiency", formatter: row => formatNumberSmart(row.efficiency) },
      { key: "run", formatter: row => formatNumberSmart(row.run) },
      { key: "run_time", formatter: row => formatTimeWithFallback(row.run_time) },
      { key: "idle_time", formatter: row => formatTimeWithFallback(row.idle_time) },
      { key: "alarm_time", formatter: row => formatTimeWithFallback(row.alarm_time) },
      { key: "discon_time", formatter: row => formatTimeWithFallback(row.discon_time) },
      { key: "total_time", formatter: row => formatTimeWithFallback(row.run_time + row.idle_time + row.alarm_time + row?.discon_time) },
    ],
    oee: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(formatDate(row.date)) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "availability", formatter: row => formatNumberSmart(row.availability) },
      { key: "performance", formatter: row => formatNumberSmart(row.performance) },
      { key: "quality", formatter: row => formatWithFallback(row.quality) },
      { key: "oee", formatter: row => formatNumberSmart(row.oee) },
    ],
    part: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(formatDate(row.date)) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "route_card", formatter: row => formatWithFallback(row.route_card) },
      { key: "operator", formatter: row => formatWithFallback(row.operator) },
      { key: "total_parts", formatter: row => formatWithFallback(row.total_parts) },
      { key: "productresult", formatter: row => formatWithFallback(row.productresult) },
      { key: "start_time", formatter: row => row.start_time ? formatDateTime(row.start_time) : "---" },
      { key: "end_time", formatter: row => row.end_time ? formatDateTime(row.end_time) : "---" },
      { key: "run_time", formatter: row => formatTimeWithFallback(row.run_time) },
      { key: "idle_time", formatter: row => formatTimeWithFallback(row.idle_time) },
      { key: "stop_time", formatter: row => formatTimeWithFallback(row.stop_time) },
      { key: "duration", formatter: row => formatTimeWithFallback(row.duration) },
      { key: "remark", formatter: row => formatWithFallback(row.remark) },
    ],
    idle_reason: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(formatDate(row.date)) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "mode", formatter: row => formatWithFallback(row.mode) },
      { key: "category", formatter: row => formatDowntimeType(row.category) },
      { key: "idle_reason_name", formatter: row => formatWithFallback(row.name) },
      { key: "operator_name", formatter: row => formatWithFallback(row.operator_name) },
      { key: "component_name", formatter: row => formatWithFallback(row.component_name) },
      { key: "duration", formatter: row => formatTimeWithFallback(row.idle_duration) },
    ],
    alarm: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(formatDate(row.date)) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "alarm_message", formatter: row => formatWithFallback(row.alarm_message) },
      { key: "alarm_number", formatter: row => formatWithFallback(row.alarm_number) },
      { key: "operator_name", formatter: row => formatWithFallback(row.operator_name) },
      { key: "component_name", formatter: row => formatWithFallback(row.component_name) },
      { key: "duration", formatter: row => formatTimeWithFallback(row.alarm_duration) },
    ],
    efficiency: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "route_card_id", formatter: row => formatWithFallback(row.route_card_id) },
      { key: "route_card", formatter: row => formatWithFallback(row.route_card) },
      { key: "total_parts", formatter: row => formatWithFallback(row.total_parts) },
      {
        key: "target",
        formatter: row => {
          const val = Number(row.target);
          return formatWithFallback(
            !isNaN(val) ? Math.trunc(val) : val
          );
        }
      }, { key: "efficiency_percentage", formatter: row => formatWithFallback(row.efficiency_percentage) },
      { key: "run_time", formatter: row => formatTimeWithFallback(row.run_time) },
      { key: "idle_time", formatter: row => formatTimeWithFallback(row.idle_time) },
      { key: "duration", formatter: row => formatTimeWithFallback(row.durtation) },
    ],
    operator_wise: [
      { key: "index", formatter: (_, i) => (page) * rowsPerPage + i + 1 },
      { key: "date", formatter: row => formatWithFallback(row.date) },
      { key: "shift_num", formatter: row => formatWithFallback(row.shift_num) },
      { key: "operator", formatter: row => formatWithFallback(row.operator) },
      { key: "machine_name", formatter: row => formatWithFallback(row.machine_name) },
      { key: "route_card", formatter: row => formatWithFallback(row.route_card) },
      { key: "target", formatter: row => formatWithFallback(row.target) },
      { key: "part_count", formatter: row => formatWithFallback(row.part_count) },
      { key: "opr_eff", formatter: row => formatNumberSmart(row.opr_eff) },
    ],
    sequence_report: [
      { key: "index", formatter: (_, i, isChild) => isChild ? "" : (page) * rowsPerPage + i + 1 },
      { key: "start_time", formatter: (row, idx, isChild) => isChild ? "" : (row.start_time ? formatDateTime(row.start_time) : "---") },
      { key: "machine_name", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.machine_name) },
      { key: "operator_no", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.operator_no) },
      { key: "operator_name", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.operator_name) },
      { key: "component_no", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.component_no) },
      { key: "component_name", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.component_name) },
      { key: "serial_no", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.serial_number) },
      { key: "program_number", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.program_number) },
      { key: "revision_no", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.revision_no) },
      { key: "part_number", formatter: (row, idx, isChild) => isChild ? "" : formatWithFallback(row.part_number) },
      { key: "run_time", formatter: (row, idx, isChild) => isChild ? "" : formatTimeWithFallback(row.run_time) },
      { key: "idle_time", formatter: (row, idx, isChild) => isChild ? "" : formatTimeWithFallback(row.idle_time) },
      { key: "disconnect_time", formatter: (row, idx, isChild) => isChild ? "" : formatTimeWithFallback(row.disconnect_time) },
      { key: "alarm_time", formatter: (row, idx, isChild) => isChild ? "" : formatTimeWithFallback(row.alarm_time) },
      { key: "component_status", formatter: (row, idx, isChild) => {
        if (isChild) return "";
        const status = row.component_status;
        const badgeStyle = {
          padding: '6px 12px',
          borderRadius: '4px',
          fontWeight: 'bold',
          color: 'white',
          fontSize: '0.75rem',
          display: 'inline-block'
        };
        if (status === 'Running') badgeStyle.backgroundColor = '#4CAF50';
        else if (status === 'Stopped') badgeStyle.backgroundColor = '#F44336';
        else if (status === 'Idle') badgeStyle.backgroundColor = '#FF9800';
        else badgeStyle.backgroundColor = '#999999';
        return <span style={badgeStyle}>{formatWithFallback(status)}</span>;
      } },
      { key: "operation_sequence", formatter: (row, idx, isChild) => {
        const seq = isChild ? row : row.sequence_detail?.[0];
        const opSeq = seq?.operation_sequence;
        if (typeof opSeq === 'object' && opSeq !== null) {
          return formatWithFallback(opSeq.sequence_number || opSeq.number || opSeq.id || '---');
        }
        return formatWithFallback(opSeq);
      } },
      { key: "planed_touch_time", formatter: (row, idx, isChild) => {
        const seq = isChild ? row : row.sequence_detail?.[0];
        return formatWithFallback(seq?.planed_touch_time);
      } },
      { key: "seq_start", formatter: (row, idx, isChild) => {
        const seq = isChild ? row : row.sequence_detail?.[0];
        const val = seq?.start;
        if (!val) return "-";
        try {
          const time = new Date(val);
          if (isNaN(time.getTime())) return "-";
          const hours = String(time.getHours()).padStart(2, '0');
          const minutes = String(time.getMinutes()).padStart(2, '0');
          const seconds = String(time.getSeconds()).padStart(2, '0');
          return `${hours}:${minutes}:${seconds}`;
        } catch {
          return "-";
        }
      } },
      { key: "seq_end", formatter: (row, idx, isChild) => {
        const seq = isChild ? row : row.sequence_detail?.[0];
        const val = seq?.end;
        if (!val) return "-";
        try {
          const time = new Date(val);
          if (isNaN(time.getTime())) return "-";
          const hours = String(time.getHours()).padStart(2, '0');
          const minutes = String(time.getMinutes()).padStart(2, '0');
          const seconds = String(time.getSeconds()).padStart(2, '0');
          return `${hours}:${minutes}:${seconds}`;
        } catch {
          return "-";
        }
      } },
      { key: "actual_run", formatter: (row, idx, isChild) => {
        const seq = isChild ? row : row.sequence_detail?.[0];
        const val = seq?.actual_run;
        if (val === null || val === undefined || val === "" || val === "-") return "-";
        const num = Number(val);
        if (isNaN(num)) return "-";
        return Math.round(num);
      } },
      { key: "operation_status", formatter: (row, idx, isChild) => {
        let status;
        if (isChild) {
          status = row.operation_status;
        } else {
          status = row.sequence_detail?.[0]?.operation_status;
        }
        return formatStatusBadge(status);
      } },
      { key: "seq_alarm", formatter: (row, idx, isChild) => {
        const seq = isChild ? row : row.sequence_detail?.[0];
        return formatWithFallback(seq?.alarm);
      } },
      { key: "message", formatter: (row, idx, isChild) => {
        const seq = isChild ? row : row.sequence_detail?.[0];
        return formatWithFallback(seq?.message);
      } },
    ],
  };

  const [reportTableHeaders, setReportTableHeaders] = useState(REPORT_HEADERS['general']);
  const [errorMsg, setErrorMsg] = useState({
    machines: false,
    shifts: false,
    startDate: false,
    endDate: false,
    dateRange: false
  })

  const formatNumberSmart = (value) => {
    if (value === null || value === undefined || value === "") return "---";
    const num = Number(value);
    if (isNaN(num)) return value;
    return Number.isInteger(num) ? num : Number(num.toFixed(2));
  };

  const handleOperatorChange = (event) => {
    const value = event.target.value;
    if (value.includes("all")) {
      if (selectedOperators.length === operators.length) {
        setSelectedOperators([]);
      } else {
        setSelectedOperators(operators.map((op) => op.name));
      }
      return;
    }
    setSelectedOperators(typeof value === 'string' ? value.split(',') : value);
  };

  const toggleRowExpansion = (index) => {
    setExpandedRows((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const customerName = localStorage.getItem('customerTitle');
        const shiftResult = await getReportShifts(customerName);

        // Ensure shiftList is always an array
        const shiftList = Array.isArray(shiftResult) ? shiftResult : (shiftResult?.data || []);
        setShifts(shiftList);

        const selectedShifts = Array.isArray(shiftList) ? shiftList.map(s => String(s.shift_no)) : [];
        if (selectedShifts.length > 0) setSelectedShift([selectedShifts[0]]);

        setErrorMsg(prev => ({
          ...prev,
          shifts: selectedShifts.length === 0 || selectedShifts[0] === undefined,
        }));

        // Fetch operators
        const opResult = await customerbasedshift(customerId, "alloperator");
        const allOpData = opResult?.[0]?.value || [];
        const opList = allOpData
          .filter(o => o?.mode?.toLowerCase() === 'operator')
          .map(op => ({ id: op.operatorid, name: op.operatorname }));
        setOperators(opList);
        setSelectedOperators(opList.map(op => op.name));
      } catch (err) {
        console.error("Error fetching initial data:", err);
        setShifts([]);
        setOperators([]);
      }
    };

    fetchData();
  }, []);

  const fetchReport = async (pageNum = page, limit = rowsPerPage, tab = selectedTab, machinesParam = groupedMachines, shiftsParam = selectedShift) => {
    try {
      const dateStr = startDate.format("YYYY-MM-DD");
      const dateEnd = endDate.format("YYYY-MM-DD");
      const efficiencyDateVal = efficiencyDate.format("YYYY-MM-DD");
      let response;

      if (tab === "part") {
        response = await getPartReport(
          Array.isArray(machinesParam) ? machinesParam.join(",") : machinesParam,
          shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
      } else if (tab === "efficiency") {
        response = await getEfficiencyReport(
          groupedMachines,
          selectedShift[0],
          efficiencyDateVal, efficiencyDateVal, pageNum, limit
        );
        setAverageEfficiency(response.average_efficiency || null)
      }
      else if (tab === "general") {
        response = await getGeneralReport(
          Array.isArray(machinesParam) ? machinesParam.join(",") : machinesParam,
          shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
      } else if (tab === "oee") {
        response = await getOeeReport(
          Array.isArray(machinesParam) ? machinesParam.join(",") : machinesParam,
          shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
      } else if (tab === "idle_reason") {
        response = await getIdleReasonReport(
          Array.isArray(machinesParam) ? machinesParam.join(",") : machinesParam,
          shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
        setIdleReasonWithPercentage(response.idleReasonWithPercentage || [])
      } else if (tab === "alarm") {
        response = await getAlarmReport(
          Array.isArray(machinesParam) ? machinesParam.join(",") : machinesParam,
          shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
        setAlarmWithPercentage(response.alarmWithPercentage || [])
      } else if (tab === "operator_wise") {
        response = await getOperatorReport(
          Array.isArray(machinesParam) ? machinesParam.join(",") : machinesParam,
          Array.isArray(selectedOperators) ? selectedOperators.join(",") : selectedOperators,
          shiftsParam,
          dateStr, dateEnd, pageNum, limit
        );
      } else if (tab === "sequence_report") {
        response = await getSequenceReport(
          Array.isArray(machinesParam) ? machinesParam.join(",") : machinesParam,
          "all",
          dateStr, dateEnd, pageNum, limit
        );
      }
      setReportData(response.data || response);
      setTotalCount(response.total1 || response.total || response.totalCount || response.totalReports || response.total_count || 0);
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
      machines: groupedMachines.length === 0 || groupedMachines[0] === undefined,
      shifts: selectedTab !== 'sequence_report' && (selectedShift.length === 0 || selectedShift[0] === undefined),
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
    if (currentTab === 'sequence_report') {
      setSelectedShift([]);
    }
    fetchReport(0, rowsPerPage, currentTab);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    setPage(0);
    setTotalCount(0);
    try {
      await fetchReport(0, rowsPerPage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShiftChange = (event) => {
    const value = event.target.value;
    let finalValue;
    const shiftsArray = Array.isArray(shifts) ? shifts : [];
    if (value.includes("all")) {
      if (selectedShift.length === shiftsArray.length) {
        finalValue = [];
      } else {
        finalValue = shiftsArray.map((shift) => String(shift.shift_no));
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
    const secs = Math.round(sec % 60);
    return [hrs, mins, secs]
      .map((v) => v.toString().padStart(2, "0"))
      .join(":");
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const date = typeof value === "number" ? dayjs(value) : dayjs(Number(value));
    return date.isValid() ? date.format("DD-MM-YYYY HH:mm:ss") : "---";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return dayjs(dateString).format("DD-MM-YYYY");
  };

  const triggerDownload = (response, defaultFilename) => {
    let filename = defaultFilename;
    const disposition = response.headers["content-disposition"];
    if (disposition && disposition.includes("filename=")) {
      filename = disposition.split("filename=")[1].replace(/"/g, "").trim();
    }
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCSV = async () => {
    const dateStr = startDate.format("YYYY-MM-DD");
    const dateEnd = endDate.format("YYYY-MM-DD");

    // Only allow export for sequence_report tab
    if (selectedTab !== "sequence_report") {
      Swal.fire({
        icon: "warning",
        title: "Not Available",
        text: "CSV export is only available for Sequence Report.",
        confirmButtonColor: "#f47803"
      });
      return;
    }

    // Check if customer is Surin (case-insensitive)
    const customerName = localStorage.getItem('customerTitle') || '';
    if (!customerName.toLowerCase().includes('surin')) {
      Swal.fire({
        icon: "warning",
        title: "Access Denied",
        text: "CSV export is only available for Surin customer.",
        confirmButtonColor: "#f47803"
      });
      return;
    }
    try {
      setIsDownloading(true);
      const response = await getReportDownloadLink(
        selectedTab,
        Array.isArray(groupedMachines) ? groupedMachines.join(",") : groupedMachines,
        selectedShift,
        dateStr,
        dateEnd,
        selectedTab === "operator_wise" ? (Array.isArray(selectedOperators) ? selectedOperators.join(",") : selectedOperators) : ""
      );
      const filename = `${selectedTab}_report_${dateStr}_${dateEnd}.csv`;
      triggerDownload(response, filename);
    } catch (error) {
      console.error(`Error during ${selectedTab} report download:`, error);
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: "Something went wrong while downloading the report. Please try again later.",
        confirmButtonColor: "#f47803"
      });
    } finally {
      setIsDownloading(false);
    }
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
        <Tab label="Idle Reason Report" value="idle_reason" />
        <Tab label="Alarm Report" value="alarm" />
        <Tab label="Part Wise Report" value="part" />

        {(localStorage.getItem('customerTitle') || '').toLowerCase().includes('surin') && (
          <Tab label="Sequence Report" value="sequence_report" />
        )}

        {cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID && (
          <Tab label="Operator Wise Report" value="operator_wise" />
        )}
      </Tabs>


      {/* Filters */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", my: 3, }}>
        {/* Machine Group Field */}
        {showMachineGroupsDropdown && (
          <FormControl
            size="small"
            sx={{
              background: "#fff",
              width: 200,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(0, 0, 0, 0.23)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(0, 0, 0, 0.87) !important",
              },
              "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#f47803 !important",
                borderWidth: "1px !important",
              }
            }}
          >
            <InputLabel sx={{ background: "#fff" }}>Machine Group</InputLabel>
            <Select
              multiple
              value={selectedGroups}
              onChange={(e) => handleGroupChange(e.target.value)}
              renderValue={(selected) => {
                if (selected.length === machineGroups.length) return "All Groups";
                if (selected.length === 0) return "Select Groups";
                return selected.join(", ");
              }}            >
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

        {/* Machine Field */}
        <FormControl
          error={errorMsg.machines}
          size="small"
          sx={{
            background: "#fff",
            width: 200,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(0, 0, 0, 0.23)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(0, 0, 0, 0.87) !important",
            },
            "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#f47803 !important",
              borderWidth: "1px !important",
            }
          }}
        >
          <InputLabel sx={{ background: "#fff" }}>Machine *</InputLabel>
          {selectedTab === "efficiency" ? (
            <Select
              value={groupedMachines || ""}
              onChange={(e) => handleGroupedMachineChange(e.target.value)}
              label="Machine"
            >
              {availableMachines.map((machineName, idx) => (
                <MenuItem key={idx} value={machineName}>
                  {machineName}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Select
              multiple
              value={groupedMachines}
              onChange={(e) => handleGroupedMachineChange(e.target.value)}
              renderValue={(selected) => {
                if (isAllMachinesSelected) return "All Machines";
                if (selected.length === 0) return "Select Machines";
                return selected.join(", ");
              }}            >
              <MenuItem value="all">
                <Checkbox
                  sx={{
                    "&.Mui-checked": {
                      color: "#f47803ff",
                    },
                  }}
                  checked={isAllMachinesSelected}
                />
                <ListItemText primary="All" />
              </MenuItem>

              {availableMachines.map((machineName, idx) => (
                <MenuItem key={idx} value={machineName}>
                  <Checkbox
                    checked={groupedMachines.includes(machineName)}
                    sx={{
                      "&.Mui-checked": {
                        color: "#f47803ff",
                      },
                    }}
                  />
                  <ListItemText primary={machineName} />
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>

        {selectedTab === "operator_wise" && (
          <Autocomplete
            multiple
            size="small"
            id="operator-select"
            options={[{ id: 'all', name: 'Select All' }, ...operators]}
            getOptionLabel={(option) => option.name}
            filterOptions={(options, { inputValue }) => {
              const searchTerm = inputValue.toLowerCase();
              return options.filter(
                (option) =>
                  option.id === 'all' ||
                  option.name.toLowerCase().includes(searchTerm) ||
                  option.id.toString().toLowerCase().includes(searchTerm)
              );
            }}
            value={operators.filter(op => selectedOperators.includes(op.name))}
            onChange={(event, newValue, reason) => {
              if (reason === 'clear') {
                setSelectedOperators([]);
              } else if (newValue.some(op => op.id === 'all')) {
                if (selectedOperators.length === operators.length) {
                  setSelectedOperators([]);
                } else {
                  setSelectedOperators(operators.map(op => op.name));
                }
              } else {
                setSelectedOperators(newValue.filter(op => op.id !== 'all').map(op => op.name));
              }
            }}
            disableCloseOnSelect
            renderTags={(value) => {
              if (value.length === 0) return null;
              if (value.length === operators.length && operators.length > 0) return "All Operators";
              if (value.length > 1) {
                return (
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: "0.85rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "230px"
                    }}
                  >
                    {value.slice(0, 1).map(v => v.name).join(", ")} +{value.length - 1}
                  </Typography>
                );
              }
              return (
                <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                  {value.map(v => v.name).join(", ")}
                </Typography>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Operators"
                placeholder={selectedOperators.length === 0 ? "Search Names or IDs" : ""}
                sx={{
                  background: "#fff",
                  "& .MuiInputBase-root": {
                    backgroundColor: "#fff",
                    height: '40px',
                    padding: '0 8px !important',
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(0, 0, 0, 0.23)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(0, 0, 0, 0.87) !important",
                  },
                  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#f47803 !important",
                    borderWidth: "1px !important",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "0.85rem",
                    background: "#fff",
                    padding: "0 4px",
                  }
                }}
              />
            )}
            renderOption={(props, option, { selected }) => (
              <li {...props}>
                <Checkbox
                  checked={option.id === 'all' ? (selectedOperators.length === operators.length && operators.length > 0) : selected}
                  style={{ marginRight: 8 }}
                  sx={{ "&.Mui-checked": { color: "#f47803ff" } }}
                />
                {option.id === 'all' ? <strong>{option.name}</strong> : `${option.id} - ${option.name}`}
              </li>
            )}
            sx={{ width: 300 }}
          />
        )}

        {/* Shift Field */}
        {selectedTab !== 'sequence_report' && (
          <FormControl
            error={errorMsg.shifts}
            size="small"
            sx={{
              background: "#fff",
              width: 160,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(0, 0, 0, 0.23)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(0, 0, 0, 0.87) !important",
              },
              "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#f47803 !important",
                borderWidth: "1px !important",
              }
            }}
          >
            <InputLabel sx={{ background: "#fff" }}>Shift *</InputLabel>
          {selectedTab === "efficiency" ? (
            <Select
              value={selectedShift[0] || ""}
              onChange={(e) => setSelectedShift([e.target.value])}
              label="Shift"
            >
              {Array.isArray(shifts) && shifts.map((shift) => (
                <MenuItem key={shift.shift_no} value={String(shift.shift_no)}>
                  {shift.shift_no}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Select
              multiple
              value={selectedShift}
              onChange={handleShiftChange}
              renderValue={(selected) => selected.join(", ")}
              label="Shift"
            >
              <MenuItem value="all">
                <Checkbox
                  sx={{
                    "&.Mui-checked": { color: "#f47803ff" },
                  }}
                  checked={Array.isArray(shifts) && selectedShift.length === shifts.length}
                />
                <ListItemText primary="All" />
              </MenuItem>
              {Array.isArray(shifts) && shifts.map((shift) => (
                <MenuItem key={shift.shift_no} value={String(shift.shift_no)}>
                  <Checkbox
                    sx={{
                      "&.Mui-checked": { color: "#f47803ff" },
                    }}
                    checked={selectedShift.includes(String(shift.shift_no))}
                  />
                  <ListItemText primary={`${shift.shift_no}`} />
                </MenuItem>
              ))}
            </Select>
          )}
          </FormControl>
        )}

        {/* Date Fields */}
        {selectedTab === 'efficiency' ? (
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Date *"
              value={efficiencyDate}
              onChange={(newValue) => {
                setEfficiencyDate(newValue);
              }}
              format="DD-MM-YYYY"
              disableFuture
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    background: "#fff",
                    minWidth: 160,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(0, 0, 0, 0.23)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(0, 0, 0, 0.87) !important",
                    },
                    "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#f47803 !important",
                      borderWidth: "1px !important",
                    }
                  },
                  error: !efficiencyDate,
                },
              }}
            />
          </LocalizationProvider>
        ) : (
          <>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Start Date *"
                value={startDate}
                onChange={handleStartDateChange}
                format="DD-MM-YYYY"
                disableFuture
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      background: "#fff",
                      minWidth: 160,
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(0, 0, 0, 0.23)",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(0, 0, 0, 0.87) !important",
                      },
                      "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#f47803 !important",
                        borderWidth: "1px !important",
                      }
                    },
                    error: errorMsg.startDate || errorMsg.dateRange,
                  },
                }}
              />
            </LocalizationProvider>

            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="End Date *"
                value={endDate}
                onChange={handleEndDateChange}
                format="DD-MM-YYYY"
                disableFuture
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      background: "#fff",
                      minWidth: 160,
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(0, 0, 0, 0.23)",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(0, 0, 0, 0.87) !important",
                      },
                      "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#f47803 !important",
                        borderWidth: "1px !important",
                      }
                    },
                    error: errorMsg.endDate || errorMsg.dateRange,
                  },
                }}
              />
            </LocalizationProvider>
          </>
        )}

        <Button
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          disabled={isSubmitting || machineGroupLoading}
          sx={{ minWidth: 120 }}
        >
          {isSubmitting ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Submit"
          )}
        </Button>

        {selectedTab === "sequence_report" && reportData.length > 0 && (localStorage.getItem('customerTitle') || '').toLowerCase().includes('surin') && (
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={downloadCSV}
            disabled={isDownloading}
            sx={{
              minWidth: 120,
              borderColor: '#f47803',
              color: '#f47803',
              '&:hover': {
                borderColor: '#d86602',
                backgroundColor: 'rgba(244, 120, 3, 0.04)'
              }
            }}
          >
            {isDownloading ? (
              <CircularProgress size={24} color="inherit" />
            ) : "Export CSV"}
          </Button>
        )}
      </Box>

      {/* Rest of the component remains the same */}
      {selectedTab === 'idle_reason' && idleReasonWithPercentage.length > 0 && (
        <Box
          sx={{
            mt: 3,
            mb: 3,
            p: 2.5,
            borderRadius: 3,
            background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid rgba(226, 232, 240, 0.7)",
            boxShadow:
              "0 4px 20px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)",
            backdropFilter: "blur(6px)",
            transition: "all 0.3s ease",
            "&:hover": {
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
            },
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
              borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
              pb: 1,
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1rem",
                color: "#1a202c",
                letterSpacing: "0.3px",
              }}
            >
              🕒 Idle Reason Summary
            </Typography>

            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#2d3748",
                background: "linear-gradient(90deg, #f7fafc, #edf2f7)",
                px: 1.5,
                py: 0.5,
                borderRadius: "8px",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              Total:{" "}
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  color: "#2b6cb0",
                }}
              >
                {formatTime(
                  idleReasonWithPercentage.reduce(
                    (sum, r) => sum + (r.total_idle_duration || 0),
                    0
                  )
                )}
              </Box>
            </Typography>
          </Box>

          {/* Inline Mini Progress Cards */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.8,
            }}
          >
            {idleReasonWithPercentage.map((item, index) => {
              const COLORS = [
                "#3182ce",
                "#38a169",
                "#d69e2e",
                "#805ad5",
                "#e53e3e",
                "#00a5cf",
                "#d53f8c",
                "#0d9b6c",
                "#dd6b20",
                "#5a67d8",
              ];
              const pct = parseFloat(item.percentage) || 0;
              const color = COLORS[index % COLORS.length];

              return (
                <Box
                  key={index}
                  sx={{
                    flex: "1 1 220px",
                    minWidth: "220px",
                    maxWidth: "280px",
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(226,232,240,0.6)",
                    boxShadow:
                      "0 2px 8px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.3)",
                    p: 1.5,
                    transition: "all 0.25s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow:
                        "0 4px 14px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.4)",
                    },
                  }}
                >
                  {/* Title & Percentage */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 0.8,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: "0.8rem",
                        color: "#2d3748",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        color: color,
                        minWidth: "35px",
                        textAlign: "right",
                      }}
                    >
                      {pct}%
                    </Typography>
                  </Box>

                  {/* Progress Bar with Shimmer */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        flex: 1,
                        height: 5,
                        borderRadius: 2,
                        background:
                          "linear-gradient(90deg, #edf2f7, #e2e8f0 40%, #edf2f7)",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${pct}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                          borderRadius: 2,
                          position: "relative",
                          "&::after": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            background:
                              "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                            animation: "shine 2.5s infinite",
                          },
                          "@keyframes shine": {
                            "0%": { transform: "translateX(-100%)" },
                            "100%": { transform: "translateX(100%)" },
                          },
                        }}
                      />
                    </Box>

                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: "0.7rem",
                        color: "#718096",
                        minWidth: "42px",
                        textAlign: "right",
                      }}
                    >
                      {formatTime(item.total_idle_duration)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {selectedTab === 'alarm' && alarmWithPercentage.length > 0 && (
        <Box
          sx={{
            mt: 3,
            mb: 3,
            p: 2.5,
            borderRadius: 3,
            background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid rgba(226, 232, 240, 0.7)",
            boxShadow:
              "0 4px 20px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)",
            backdropFilter: "blur(6px)",
            transition: "all 0.3s ease",
            "&:hover": {
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
            },
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
              borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
              pb: 1,
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1rem",
                color: "#1a202c",
                letterSpacing: "0.3px",
              }}
            >
              🚨 Alarm Summary
            </Typography>

            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#2d3748",
                background: "linear-gradient(90deg, #f7fafc, #edf2f7)",
                px: 1.5,
                py: 0.5,
                borderRadius: "8px",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              Total:{" "}
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  color: "#2b6cb0",
                }}
              >
                {formatTime(
                  alarmWithPercentage.reduce(
                    (sum, r) => sum + (r.total_alarm_duration || 0),
                    0
                  )
                )}
              </Box>
            </Typography>
          </Box>

          {/* Inline Mini Progress Cards */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.8,
            }}
          >
            {alarmWithPercentage.map((item, index) => {
              const COLORS = [
                "#e53e3e",
                "#3182ce",
                "#38a169",
                "#d69e2e",
                "#805ad5",
                "#00a5cf",
                "#d53f8c",
                "#0d9b6c",
                "#dd6b20",
                "#5a67d8",
              ];
              const pct = parseFloat(item.percentage) || 0;
              const color = COLORS[index % COLORS.length];

              return (
                <Box
                  key={index}
                  sx={{
                    flex: "1 1 220px",
                    minWidth: "220px",
                    maxWidth: "280px",
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(226,232,240,0.6)",
                    boxShadow:
                      "0 2px 8px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.3)",
                    p: 1.5,
                    transition: "all 0.25s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow:
                        "0 4px 14px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.4)",
                    },
                  }}
                >
                  {/* Title & Percentage */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 0.8,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: "0.8rem",
                        color: "#2d3748",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={item.alarm_message}
                    >
                      {item.alarm_message}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        color: color,
                        minWidth: "35px",
                        textAlign: "right",
                      }}
                    >
                      {pct}%
                    </Typography>
                  </Box>

                  {/* Progress Bar with Shimmer */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        flex: 1,
                        height: 5,
                        borderRadius: 2,
                        background:
                          "linear-gradient(90deg, #edf2f7, #e2e8f0 40%, #edf2f7)",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${pct}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                          borderRadius: 2,
                          position: "relative",
                          "&::after": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            background:
                              "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                            animation: "shine 2.5s infinite",
                          },
                        }}
                      />
                    </Box>

                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: "0.7rem",
                        color: "#718096",
                        minWidth: "42px",
                        textAlign: "right",
                      }}
                    >
                      {formatTime(item.total_alarm_duration)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {selectedTab === 'efficiency' && averageEfficiency && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.85rem",
              color: "#2d3748",
              background: "linear-gradient(90deg, #f7fafc, #edf2f7)",
              px: 1.5,
              py: 0.5,
              borderRadius: "8px",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
              display: "inline-block",
            }}
          >
            Avg Efficiency:{" "}
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                color: "#2b6cb0",
              }}
            >
              {averageEfficiency}%
            </Box>
          </Typography>
        </Box>
      )}

      {/* Report Table */}
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
                          header === "Alarm Time" ? "red !important" :
                            header === "Run Time"
                              ? "#207A24 !important"
                              : header === "Idle Time" || header === "Idle/Stop Time"
                                ? "#FFD700 !important"
                                : header === "Machine OFF Time"
                                  ? "#434343 !important" :
                                  header === "Disconnect Time" ? "#4b4949ff !important"
                                    : "#999999 !important",
                      }}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.map((row, index) => {
                  // Calculate global row offset for sequence_report (sum of all sequence items from previous records)
                  let globalRowOffset = 0;
                  if (selectedTab === 'sequence_report') {
                    for (let i = 0; i < index; i++) {
                      globalRowOffset += (reportData[i].sequence_detail?.length || 0);
                    }
                  }

                  return (
                    <React.Fragment key={index}>
                      <TableRow
                        sx={{
                          cursor: selectedTab === 'operator_wise' && row.machine_breakdown?.length > 1 ? 'pointer' : 'default',
                          transition: 'background-color 0.2s',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04) !important',
                          }
                        }}
                        onClick={() => selectedTab === 'operator_wise' && row.machine_breakdown?.length > 1 && toggleRowExpansion(index)}
                      >
                        {columns[selectedTab].map((col, i) => {
                          let bgColor = selectedTab === 'sequence_report' ? (globalRowOffset % 2 === 0 ? '#d9d9d9' : '#a3a3a3') : (index % 2 === 0 ? '#d9d9d9' : '#a3a3a3');
                          return (
                            <TableCell
                              key={i}
                              align="center"
                              style={{ backgroundColor: bgColor }}
                              sx={{
                                whiteSpace: "nowrap",
                                minWidth: "fit-content",
                                maxWidth: "200px",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                border: 'none',
                              }}
                            >
                              {i === 0 && selectedTab === 'operator_wise' && row.machine_breakdown?.length > 1 && (
                                <IconButton
                                  size="small"
                                  sx={{ mr: 0.5, p: 0.5, color: '#f47803' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRowExpansion(index);
                                  }}
                                >
                                  {expandedRows[index] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </IconButton>
                              )}
                              {(() => {
                                const rawData = col.formatter(row, index, false);
                                const isJSX = rawData !== null && typeof rawData === 'object' && rawData.$$typeof;
                                const displayData = isJSX ? rawData : (rawData !== null && rawData !== undefined ? String(rawData) : "---");
                                const fullData = Array.isArray(row[col.key]) ? row[col.key].join(" | ") : row[col.key] || "---";
                                return ['component_name', 'operator_name', 'component_number', 'machine_name', 'component_id', 'remark', 'operator', 'route_card'].includes(col.key) ? (
                                  <Tooltip title={fullData}>
                                    <span>{displayData}</span>
                                  </Tooltip>
                                ) : (
                                  <span>{displayData}</span>
                                );
                              })()}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      {selectedTab === 'operator_wise' && expandedRows[index] && row.machine_breakdown?.map((breakdown, bIdx) => (
                        <TableRow
                          key={`breakdown-${index}-${bIdx}`}
                          style={{
                            backgroundColor: '#f9fafb',
                            borderLeft: '4px solid #f47803',
                          }}
                        >
                          {columns[selectedTab].map((col, i) => (
                            <TableCell
                              key={`bcell-${i}`}
                              align="center"
                              style={{
                                backgroundColor: '#f9fafb',
                                paddingTop: '6px',
                                paddingBottom: '6px'
                              }}
                              sx={{
                                fontSize: '0.75rem',
                                color: '#475569',
                                borderBottom: '1px dashed #e2e8f0',
                              }}
                            >
                              {i === 0 ? "" : (i === 1 ? `↳ ${col.formatter(breakdown, bIdx)}` : col.formatter(breakdown, bIdx))}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {selectedTab === 'sequence_report' && row.sequence_detail?.slice(1).map((seq, sIdx) => {
                        const childGlobalRowIndex = globalRowOffset + 1 + sIdx;
                        const childBgColor = childGlobalRowIndex % 2 === 0 ? '#d9d9d9' : '#a3a3a3';
                        return (
                          <TableRow
                            key={`sequence-${index}-${sIdx + 1}`}
                            style={{
                              backgroundColor: childBgColor,
                            }}
                          >
                            {columns[selectedTab].map((col, i) => {
                              const rawData = col.formatter(seq, sIdx + 1, true);
                              const isJSX = rawData !== null && typeof rawData === 'object' && rawData.$$typeof;
                              const displayData = isJSX ? rawData : (rawData !== null && rawData !== undefined ? String(rawData) : "---");
                              return (
                                <TableCell
                                  key={`scell-${i}`}
                                  align="center"
                                  style={{
                                    backgroundColor: childBgColor,
                                    paddingTop: '8px',
                                    paddingBottom: '8px',
                                    minHeight: '40px',
                                  }}
                                  sx={{
                                    whiteSpace: "nowrap",
                                    minWidth: "fit-content",
                                    maxWidth: "200px",
                                    textOverflow: "ellipsis",
                                    overflow: "hidden",
                                    fontSize: '0.75rem',
                                    color: '#000',
                                    border: 'none',
                                  }}
                                >
                                  <span>{displayData}</span>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
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
    </Box>
  );
}