import React, { useState, useEffect, useRef, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { MobileTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { DemoItem } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// import dayjs from 'dayjs';
import './shiftreg.css';
import { useForm } from 'react-hook-form';
import { CustomDaySelect, convertTo24Hour } from '../Inputfield/inputfield';
import { shiftgetmodule } from '../../Services/app/shiftservice';
import Swal from 'sweetalert2';
import {
  Box,
  DialogActions,
  DialogContent,
  Grid,
  Typography,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem, Autocomplete
} from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import dayjs from 'dayjs';
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker';

export default function ShiftAdd({ reason, open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId }) {
  console.log('datasource', datasource);
  console.log('reason', reason)
  //console.log('setDatasource', setDatasource);
  const customDaySelectRef = useRef();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [breakTimeOpen, setBreakTimeOpen] = useState(false);
  const [breakList, setBreakList] = useState([]);
  const [breakErrors, setBreakErrors] = useState({
    start_time: "",
    end_time: "",
  });
  useEffect(() => {
    if (open) {
      setTimeout(() => setPickerOpen(true), 200);
    } else {
      setPickerOpen(false);
    }
  }, [open]);
  //const customerId = localStorage.getItem('customerId');
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset, setError, clearErrors } = useForm({
    shouldFocusError: true,
    mode: 'onBlur'
  });

  const validateShiftTimesForSameDay = (startTime, endTime, startDay, endDay) => {
    if (String(startDay) === '1' && String(endDay) === '1') {
      if (startTime && endTime) {
        const s = toSeconds(startTime);
        const e = toSeconds(endTime);
        if (s >= e) {
          return "Starttime must be less than endtime for Day 1";
        }
      }
    }
    return null;
  };

  const defaultShiftForm = useMemo(() => ({
    start_time: null,
    end_time: null,
    break_time: null,
    module: '',
    shift_no: '',
    start_day: '',
    end_day: ''
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const startTimeInputRef = useRef(null);
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  const [breakForm, setBreakForm] = useState({
    start_time: null,
    end_time: null,
    break_time: null,
    reason: "",
  });

  useEffect(() => {
    if (!open) {
      reset(defaultShiftForm); // Reset form state and validation errors when the dialog is closed
    } else {
      setShiftForm(defaultShiftForm); // Set form state to default when the dialog opens
    }
  }, [open, reset, defaultShiftForm]);


  useEffect(() => {
    getShiftsAdddata();
  }, []);
  useEffect(() => {
    if (open && startTimeInputRef.current) {
      setTimeout(() => {
        if (startTimeInputRef.current) {
          startTimeInputRef.current.focus();
          startTimeInputRef.current.click();
        }
      }, 300);
    }
  }, [open]);
  //Get module dropdown values
  const getShiftsAdddata = async () => {
    try {
      const response = await shiftgetmodule();
      if (Array.isArray(response)) {
        const formattedOptions = response.map((item, index) => ({
          value: index + 1,
          label: item,
        }));
        setShiftsmodule(formattedOptions);
      } else {
        console.error('Unexpected response format:', response);
        setShiftsmodule([]);
      }
    } catch (error) {
      const fallbackOptions = [
        { value: 'GENERAL', label: 'GENERAL' },
        { value: 'UNIT1', label: 'UNIT1' },
        { value: 'UNIT2', label: 'UNIT2' },
        { value: 'CMS', label: 'CMS' },
      ];
      setShiftsmodule(fallbackOptions);
      console.error('Error fetching shifts:', error);
    }
  };


  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value); // Update the form state in react-hook-form
    trigger(name); // Trigger validation for this field

    // Re-validate start/end time order when days change
    if (name === 'start_day' || name === 'end_day') {
      const startDay = name === 'start_day' ? value : shiftForm.start_day;
      const endDay = name === 'end_day' ? value : shiftForm.end_day;
      const error = validateShiftTimesForSameDay(shiftForm.start_time, shiftForm.end_time, startDay, endDay);
      if (error) {
        setError('start_time', { type: 'manual', message: "Start time must be less than end time" });
        setError('end_time', { type: 'manual', message: "End time must be greater than start time" });
      } else {
        clearErrors('start_time');
        clearErrors('end_time');
      }
    }
  };

  const handleTimeChange = (name, value) => {
    setShiftForm((prevShiftForm) => ({
      ...prevShiftForm,
      [name]: value,
    }));
    setValue(name, value);
    trigger(name);

    // Validate time order when start_time or end_time changes
    if (name === 'start_time' || name === 'end_time') {
      const startTime = name === 'start_time' ? value : shiftForm.start_time;
      const endTime = name === 'end_time' ? value : shiftForm.end_time;
      const error = validateShiftTimesForSameDay(startTime, endTime, shiftForm.start_day, shiftForm.end_day);
      if (error) {
        setError('start_time', { type: 'manual', message: "Start time must be less than end time" });
        setError('end_time', { type: 'manual', message: "End time must be greater than start time " });
      } else {
        clearErrors('start_time');
        clearErrors('end_time');
      }
    }
  };

  const calculateTotalBreakTime = (breakList = []) => {
    let totalSeconds = 0;

    breakList.forEach(b => {
      if (!b?.break_time) return;

      const [h, m, s] = b.break_time.split(":").map(Number);

      totalSeconds += h * 3600 + m * 60 + s;
    });

    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");

    return `${hh}:${mm}:${ss}`;
  };


  //submit event
  const onSubmit = async (data) => {
    // Validate time order when both start day and end day are Day 1
    const timeOrderError = validateShiftTimesForSameDay(
      shiftForm.start_time, shiftForm.end_time, shiftForm.start_day, shiftForm.end_day
    );
    if (timeOrderError) {
      setError('start_time', { type: 'manual', message: "Can't save - Start time must be less than end time" });
      setError('end_time', { type: 'manual', message: "Can't save - End time must be greater than start time" });
      return;
    }

    try {
      const start_time = convertTo24Hour(
        shiftForm.start_time.format('hh:mm:ss A')
      );
      const end_time = convertTo24Hour(
        shiftForm.end_time.format('hh:mm:ss A')
      );

      const totalBreakTime = calculateTotalBreakTime(breakList) || "00:00:00";

      const moduleLabel =
        shiftsmodule.find(option => option.value === data.module)?.label || '';

      const id = shiftForm.id || Math.random().toString(36).substr(2, 9);

      const updatedBreakList = Array.isArray(breakList)
        ? breakList.map(brk => ({
          ...brk,
          shift_id: id
        }))
        : [];

      const currentShiftData = {
        id,
        start_time,
        end_time,
        break_time: totalBreakTime,
        break_details: updatedBreakList,
        shift_no: data.shift_no,
        start_day: shiftForm.start_day,
        end_day: shiftForm.end_day,
        module: moduleLabel
      };

      const existingShifts = Array.isArray(datasource) ? [...datasource] : [];

      const index = existingShifts.findIndex(s => s.id === id);
      index !== -1
        ? (existingShifts[index] = currentShiftData)
        : existingShifts.push(currentShiftData);

      const breakdetails = existingShifts.flatMap(shift =>
        Array.isArray(shift.break_details)
          ? shift.break_details.map(brk => ({
            id: brk.id || Math.random().toString(36).substr(2, 9),
            start_time: brk.start_time,
            end_time: brk.end_time,
            break_time: brk.duration || brk.break_time || "00:00:00",
            shift_no: shift.shift_no,
            start_day: shift.start_day,
            end_day: shift.end_day,
            module: shift.module
          }))
          : []
      );

      await shiftadd(
        { allShift: existingShifts, breakdetails, lastUpdateTs: Date.now() },
        customerId,
        'SERVER_SCOPE'
      );

      Swal.fire("Created Successfully");
      handleClose();
      reset(defaultShiftForm);
      setBreakList([]);
      setBreakForm({ start_time: null, end_time: null, break_time: null, reason: "" });

    } catch (error) {
      console.error(error);
      Swal.fire("Error submitting shift data");
    }
  };


  const toHHMMSS = (t) => {
    if (!t) return null;
    return dayjs(t).format("HH:mm:ss");
  };

  const handleSaveBreak = () => {
    if (!validateRequiredBreakFields()) {
      return;
    }

    if (breakErrors.start_time || breakErrors.end_time) {
      return;
    }
    const formattedBreak = {
      ...breakForm,
      start_time: toHHMMSS(breakForm.start_time),
      end_time: toHHMMSS(breakForm.end_time),
      break_time: toHHMMSS(breakForm.break_time),
    };

    setBreakList((prev) => {
      if (editIndex !== null) {
        const updated = [...prev];
        updated[editIndex] = formattedBreak;
        return updated;
      }
      return [...prev, formattedBreak];
    });

    setBreakForm({
      start_time: null,
      end_time: null,
      break_time: null,
      reason: "",
    });

    setEditIndex(null);
    setChildOpen(false);
  };


  const handleEdit = (row, index) => {
    setBreakForm({
      start_time: row.start_time
        ? dayjs(row.start_time, "HH:mm:ss")
        : null,

      end_time: row.end_time
        ? dayjs(row.end_time, "HH:mm:ss")
        : null,

      break_time: row.break_time
        ? dayjs(row.break_time, "HH:mm:ss")
        : null,

      reason: row.reason || "",
    });

    setEditIndex(index);
    setChildOpen(true);
  };



  const handleAddNew = () => {
    setBreakForm({
      start_time: null,
      end_time: null,
      break_time: null,
      reason: "",
    });

    setEditIndex(null);   // ADD MODE ONLY
    setChildOpen(true);
  };


  const handleDelete = (index) => {
    setBreakList((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };



  const validateStartTime = (value) => {
    if (!value) {
      return "Start time is required";
    }

    const shiftStart = dayjs(shiftForm.start_time, "HH:mm:ss");
    const shiftEnd = dayjs(shiftForm.end_time, "HH:mm:ss");

    if (value.isBefore(shiftStart)) {
      return "Start time must be after shift start time";
    }

    if (value.isAfter(shiftEnd)) {
      return "Start time must be before shift end time";
    }

    return "";
  };


  const calculateDuration = (start, end) => {
    if (!start || !end) return null;

    let diff = end.diff(start, "second");

    // handle overnight shift (e.g. 23:00 → 01:00)
    if (diff < 0) {
      diff += 24 * 60 * 60;
    }

    return dayjs().startOf("day").add(diff, "second");
  };

  console.log('break list', breakList);

  const toSeconds = (time) => {

    if (!time) return null;

    if (dayjs.isDayjs(time)) {
      return time.hour() * 3600 + time.minute() * 60 + time.second();
    }
    // "HH:mm:ss" string
    const [h, m, s] = time.split(":").map(Number);
    return h * 3600 + m * 60 + (s || 0);
  };

  const isTimeWithinShift = (time, shiftStart, shiftEnd) => {
    if (!time || !shiftStart || !shiftEnd) return true;

    const t = toSeconds(time);
    const s = toSeconds(shiftStart);
    const e = toSeconds(shiftEnd);

    if (s < e) {
      return t >= s && t <= e;
    }

    return t >= s || t <= e;
  };

  const isEndAfterStart = (start, end) => {
    if (!start || !end) return true;

    const s = toSeconds(start);
    const e = toSeconds(end);

    // ❌ same time
    if (s === e) return false;

    // ✅ normal case (same day)
    if (e > s) return true;

    // ✅ midnight crossing (PM → AM)
    const startHour = dayjs(start).hour();
    const endHour = dayjs(end).hour();

    if (startHour >= 12 && endHour < 12) return true;

    // ❌ everything else
    return false;
  };



  const validateRequiredBreakFields = () => {
    const errors = {};

    const start = breakForm.start_time;
    const end = breakForm.end_time;

    // ✅ required checks
    if (!start) {
      errors.start_time = "Start time is required";
    }

    if (!end) {
      errors.end_time = "End time is required";
    }

    if (!breakForm.break_time) {
      errors.break_time = "Break duration is required";
    }

    if (!breakForm.reason) {
      errors.reason = "Reason is required";
    }

    // ✅ run time logic only if both exist
    if (start && end) {
      // 🔹 same time check
      if (
        calculateDuration(start, end).isSame(
          dayjs().startOf("day"),
          "second"
        )
      ) {
        errors.start_time = "Break start time cannot be same as end time";
        errors.end_time = "Break end time cannot be same as start time";
      }

      // 🔹 order check
      else if (!isEndAfterStart(start, end)) {
        errors.start_time = "Break start time must be less than end time";
        errors.end_time = "Break end time must be greater than start time";
      }

      // 🔹 overlap check (only if above passed)
      else {
        for (let i = 0; i < breakList.length; i++) {
          if (editIndex !== null && i === editIndex) continue;

          const existingStart = dayjs(
            breakList[i].start_time,
            "HH:mm:ss"
          );
          const existingEnd = dayjs(
            breakList[i].end_time,
            "HH:mm:ss"
          );

          if (start.isBefore(existingEnd) && end.isAfter(existingStart)) {
            errors.start_time = "Break time overlaps with an existing break";
            errors.end_time = "Break time overlaps with an existing break";
            break;
          }
        }
      }
    }

    // ✅ IMPORTANT — replace errors, don't merge stale ones
    setBreakErrors(errors);

    return Object.keys(errors).length === 0;
  };



  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
      <DialogTitle style={{ color: 'black' }}>Add Shift</DialogTitle>
      <div className="close_modal">
        <Tooltip title="Close">
          <IconButton aria-label="close" onClick={handleClose} style={{ backgroundColor: '#ffffff' }}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </div>
      <div className="machinedialog">
        <div className="filter_sec">
          <form onSubmit={handleSubmit(onSubmit)} className="form_sec shift_form" autoComplete="off">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="form_sec_fields">
                <div className={`form_field  ${errors.start_time ? 'error-outline' : ''}`}>
                  <DemoItem className="white-label">
                    <DesktopTimePicker
                      {...register("start_time", {
                        required: "Start Time is required",
                        validate: (value, formValues) => {
                          const startTime = value;
                          const endTime = formValues.end_time;

                          // Only validate if both times are present and valid Dayjs objects
                          if (startTime && endTime && startTime.isValid() && endTime.isValid()) {
                            // if (startTime.isAfter(endTime)) {
                            //   return "Start Time must be before End Time";
                            // }
                            if (startTime.isSame(endTime, 'second')) { // Compare down to seconds
                              return "Start Time and End Time cannot be the same";
                            }
                          }
                          return true; // Validation passes
                        }
                      })}
                      onBlur={() => trigger('start_time')}
                      value={shiftForm.start_time}
                      onChange={(value) => {
                        handleTimeChange('start_time', value);
                        // Trigger validation for end_time as well when start_time changes
                        if (shiftForm.end_time && value && value.isValid()) {
                          trigger('end_time');
                        }
                      }}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss A"
                      label="Start Time *"
                      error={!!errors.start_time}
                      InputLabelProps={{ required: true }}
                      open={pickerOpen}
                      onOpen={() => setPickerOpen(true)}
                      onClose={() => setPickerOpen(false)}
                      slotProps={{
                        textField: {
                          inputRef: startTimeInputRef,
                          autoFocus: true,
                        }
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'black',
                          },
                          '&:hover fieldset': {
                            borderColor: 'black',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'orange',
                          },
                          '& .MuiOutlinedInput-input': {
                            color: 'black',
                          },
                          '&.Mui-focused .MuiOutlinedInput-input': {
                            caretColor: 'orange',
                          },
                          '&::placeholder': {
                            color: 'black',
                            opacity: 1,
                          },
                        },
                      }}
                    />
                  </DemoItem>
                  {errors.start_time && <div className="mat-error">{errors.start_time.message}</div>}
                </div>
                <div className={`form_field  ${errors.end_time ? 'error-outline' : ''}`}>
                  <DemoItem>
                    <DesktopTimePicker
                      {...register("end_time", {
                        required: "End Time is required",
                        validate: (value, formValues) => {
                          const startTime = formValues.start_time;
                          const endTime = value;

                          // Only validate if both times are present and valid Dayjs objects
                          if (startTime && endTime && startTime.isValid() && endTime.isValid()) {
                            // if (endTime.isBefore(startTime)) {
                            //   return "End Time must be after Start Time";
                            // }
                            if (endTime.isSame(startTime, 'second')) { // Compare down to seconds
                              return "Start Time and End Time cannot be the same";
                            }
                          }
                          return true; // Validation passes
                        }
                      })}
                      onBlur={() => trigger('end_time')}
                      value={shiftForm.end_time}
                      onChange={(value) => {
                        handleTimeChange('end_time', value);
                        // Trigger validation for start_time as well when end_time changes
                        if (shiftForm.start_time && value && value.isValid()) {
                          trigger('start_time');
                        }
                      }}
                      label="End Time *"
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss A"
                      error={!!errors.end_time}
                      InputLabelProps={{ required: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'black',
                          },
                          '&:hover fieldset': {
                            borderColor: 'black',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'orange',
                          },
                          '& .MuiOutlinedInput-input': {
                            color: 'black',
                          },
                          '&.Mui-focused .MuiOutlinedInput-input': {
                            caretColor: 'orange',
                          },
                          '&::placeholder': {
                            color: 'black',
                            opacity: 1,
                          },
                        },
                      }}
                    />
                  </DemoItem>
                  {errors.end_time && <div className="mat-error">{errors.end_time.message}</div>}
                </div>


                <div className={`form_field  ${errors.break_time ? 'error-outline' : ''}`}>
                  <FormControl fullWidth error={!!errors.break_time}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => setBreakTimeOpen(true)}
                      sx={{
                        height: '56px',
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        px: '14px',
                        mt: 1,
                        position: 'relative',

                        borderColor: 'black',
                        '&:hover': { borderColor: 'black' },
                        color: 'rgba(0, 0, 0, 0.87)',

                        fontSize: '16px',
                        fontWeight: 400,
                        lineHeight: '1.4375em',
                        fontFamily: '"Roboto","Helvetica","Arial",sans-serif',

                        '&:focus-visible': {
                          outline: '2px solid orange',
                          outlineOffset: '-2px',
                        },
                      }}
                    >
                      {breakList.length > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 12,
                            transform: 'translateY(-50%)',
                            background: '#EDEDED',
                            padding: '0 4px',
                            fontSize: '12px',
                            color: 'black',
                            fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
                            pointerEvents: 'none',
                          }}
                        >
                          Break Time *
                        </span>
                      )}

                      {breakList.length > 0
                        ? calculateTotalBreakTime(breakList) || "00:00:00"
                        : "Select Break Time *"}
                    </Button>

                    {errors.break_time && (
                      <Typography color="error" variant="caption">
                        {errors.break_time.message}
                      </Typography>
                    )}
                  </FormControl>

                  <Dialog
                    open={breakTimeOpen}
                    onClose={() => setBreakTimeOpen(false)}
                    fullWidth
                    maxWidth="sm"
                    PaperProps={{
                      sx: {
                        minHeight: "32vh",
                        maxHeight: "90vh",
                      },
                    }}
                  >
                    <DialogTitle>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        {/* Left: Heading + Add Icon */}
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Typography variant="h6">Add Break Times</Typography>

                          <IconButton
                            onClick={handleAddNew}
                            size="small"
                            sx={{
                              color: "#6F3E06",
                              bgcolor: "#F1870C",
                              borderRadius: "50%",
                              ml: 1,
                              width: 28,
                              height: 28,
                              "&:hover": { bgcolor: "#d67a0b" },
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <IconButton
                          onClick={() => setBreakTimeOpen(false)}
                          size="small"
                          sx={{
                            bgcolor: '#EDEDED',
                            color: '#757575',
                            borderRadius: '50%',
                            width: 38,
                            height: 38,
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </DialogTitle>


                    <DialogContent>
                      {breakList.length === 0 ? (
                        <Typography color="text.secondary">
                          No break times added
                        </Typography>
                      ) : (
                        <TableContainer component={Paper} sx={{
                          mt: 2, "& .MuiTable-root": {
                            pb: 2,
                          },
                        }}>
                          <Table size="small">
                            {/* ---------- TABLE HEAD ---------- */}
                            <TableHead>
                              <TableRow>
                                <TableCell>Start Time</TableCell>
                                <TableCell>End Time</TableCell>
                                <TableCell>Break Time</TableCell>
                                <TableCell>Reason</TableCell>
                              </TableRow>
                            </TableHead>

                            {/* ---------- TABLE BODY ---------- */}
                            <TableBody>
                              {breakList.map((row, index) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    {row.start_time || "--"}
                                  </TableCell>

                                  <TableCell>
                                    {row.end_time || "--"}
                                  </TableCell>

                                  <TableCell>
                                    {row.break_time || "--"}
                                  </TableCell>


                                  {/* Reason + Edit + Delete */}
                                  <TableCell>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                      }}
                                    >
                                      <Typography variant="body2">
                                        {row.reason}
                                      </Typography>

                                      <Box>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleEdit(row, index)}
                                        >
                                          <EditIcon fontSize="small" />
                                        </IconButton>

                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={() => handleDelete(index)}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Box>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                      )}
                    </DialogContent>


                  </Dialog>

                  <Dialog
                    open={childOpen}
                    onClose={() => setChildOpen(false)}
                    fullWidth
                    maxWidth="sm"
                  >
                    <DialogTitle>Add Break</DialogTitle>

                    <DialogContent sx={{ mt: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <DesktopTimePicker
                            label="Start Time"
                            views={['hours', 'minutes', 'seconds']}
                            format="hh:mm:ss A"
                            value={breakForm.start_time}
                            onChange={(v) => {
                              const duration = breakForm.end_time
                                ? calculateDuration(v, breakForm.end_time)
                                : null;
                              setBreakForm((prev) => ({
                                ...prev,
                                start_time: v,
                                break_time: duration,
                              }));
                            }}
                            onAccept={(v) => {
                              const start = v;
                              const end = breakForm.end_time;
                              const errors = { ...breakErrors };

                              // within shift
                              if (
                                start &&
                                !isTimeWithinShift(start, shiftForm.start_time, shiftForm.end_time)
                              ) {
                                errors.start_time = "Break start time must be within shift time";
                              }

                              // same time
                              else if (
                                start &&
                                end &&
                                calculateDuration(start, end).isSame(
                                  dayjs().startOf("day"),
                                  "second"
                                )
                              ) {
                                errors.start_time = "Break start time cannot be same as end time";
                                errors.end_time = "Break end time cannot be same as start time";
                              }

                              // order check
                              else if (start && end && !isEndAfterStart(start, end)) {
                                errors.start_time = "Break start time must be less than end time";
                                errors.end_time = "Break end time must be greater than start time";
                              }

                              else {
                                errors.start_time = "";
                                // clear end error if now valid
                                if (errors.end_time === "Break end time cannot be same as start time" ||
                                  errors.end_time === "Break end time must be greater than start time") {
                                  errors.end_time = "";
                                }
                              }

                              setBreakErrors(errors);
                            }}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                required: true,
                                error: !!breakErrors.start_time,
                                helperText: breakErrors.start_time,
                                InputLabelProps: {
                                  shrink: true,
                                },
                                sx: {
                                  mt: 1,
                                },
                              },
                            }}
                          />
                        </Grid>

                        <Grid item xs={6}>
                          <DesktopTimePicker
                            label="End Time"
                            format="hh:mm:ss A"
                            views={['hours', 'minutes', 'seconds']}
                            value={breakForm.end_time}
                            onChange={(v) => {
                              const duration = calculateDuration(breakForm.start_time, v);
                              setBreakForm((prev) => ({
                                ...prev,
                                end_time: v,
                                break_time: duration,
                              }));
                            }}
                            onAccept={(v) => {
                              if (
                                v &&
                                !isTimeWithinShift(
                                  v,
                                  shiftForm.start_time,
                                  shiftForm.end_time
                                )
                              ) {
                                setBreakErrors((prev) => ({
                                  ...prev,
                                  end_time: "Break end time must be within shift time",
                                }));
                                return;
                              }

                              if (
                                v &&
                                breakForm.start_time &&
                                calculateDuration(breakForm.start_time, v).isSame(
                                  dayjs().startOf("day"),
                                  "second"
                                )
                              ) {
                                setBreakErrors((prev) => ({
                                  ...prev,
                                  end_time: "Break end time cannot be same as start time",
                                }));
                                return;
                              }

                              if (
                                v &&
                                breakForm.start_time &&
                                !isEndAfterStart(breakForm.start_time, v)
                              ) {
                                setBreakErrors((prev) => ({
                                  ...prev,
                                  end_time: "Break end time must be greater than start time",
                                }));
                                return;
                              }

                              setBreakErrors((prev) => ({ ...prev, end_time: "" }));
                            }}
                            slotProps={{
                              textField: {
                                fullWidth: true,          // ✅ width belongs here
                                required: true,
                                error: !!breakErrors.end_time,
                                helperText: breakErrors.end_time,
                                InputLabelProps: {
                                  shrink: true,           // ✅ prevents label cut
                                },
                                sx: {
                                  mt: 1,                  // ✅ space for floating label
                                },
                              },
                            }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <DesktopTimePicker
                            label="Break Time *"
                            value={breakForm.break_time}
                            format="HH:mm:ss"
                            ampm={false}
                            disabled
                            sx={{ width: "100%" }}
                          />
                        </Grid>


                        <Grid item xs={6}>
                          <FormControl fullWidth required error={!!breakErrors.reason}>
                            <Autocomplete
                              fullWidth
                              options={reason || []}
                              getOptionLabel={(option) => option.reason}
                              value={
                                reason?.find((r) => r.reason === breakForm.reason) || null
                              }
                              onChange={(event, newValue) => {
                                setBreakForm((prev) => ({
                                  ...prev,
                                  reason: newValue?.reason || "",
                                }));

                                setBreakErrors((prev) => ({
                                  ...prev,
                                  reason: "",
                                }));
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Reason"
                                  required
                                  error={!!breakErrors.reason}
                                  helperText={breakErrors.reason || ""}
                                />
                              )}
                              isOptionEqualToValue={(option, value) =>
                                option.reason === value.reason
                              }
                              disableClearable={false}
                            />

                            {/* {breakErrors.reason && (
                              <div style={{ color: "red", fontSize: "0.70rem", marginTop: 4 }}>
                                {breakErrors.reason}
                              </div>
                            )} */}
                          </FormControl>
                        </Grid>
                      </Grid>
                    </DialogContent>

                    <DialogActions>
                      <Button onClick={() => setChildOpen(false)}>
                        Cancel
                      </Button>

                      <Button
                        variant="contained"
                        onClick={handleSaveBreak}
                      >
                        Save
                      </Button>
                    </DialogActions>
                  </Dialog>


                </div>

                <div className={`form_field  ${errors.module ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("module", { required: "Module is required" })}
                    onBlur={() => trigger('module')}
                    ref={customDaySelectRef}
                    name="module"
                    value={shiftForm.module}
                    onChange={handleFormChange}
                    label="Select Module"
                    required={true}
                    options={shiftsmodule}
                    error={!!errors.module}
                  />
                  {errors.module && <div className="mat-error">Module is required</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.shift_no ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("shift_no", {
                      required: "Shift Number is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      },
                      setValueAs: v => v === "" ? "" : Number(v),
                      validate: value => {
                        if (value === "" || value === null || value === undefined) {
                          return "Shift Number is required";
                        }
                        if (isNaN(value)) {
                          return "Shift Number must be a number";
                        }
                        if (value <= 0) {
                          return "Shift Number must be greater than 0";
                        }
                        return true;
                      }
                    })}
                    onBlur={() => trigger('shift_no')}
                    label="Shift Number"
                    type="number"
                    name="shift_no"
                    value={shiftForm.shift_no}
                    onChange={handleFormChange}
                    error={!!errors.shift_no}
                    inputProps={{ maxLength: 100, min: 1 }}
                    InputLabelProps={{
                      required: true,
                      sx: {
                        color: 'black',
                        '&.Mui-focused': {
                          color: 'orange',
                        },
                      },
                    }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'black',
                        },
                        '&:hover fieldset': {
                          borderColor: 'black',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'orange',
                        },
                        '& .MuiOutlinedInput-input': {
                          color: 'black',
                        },
                        '&.Mui-focused .MuiOutlinedInput-input': {
                          caretColor: 'orange',
                        },
                        '&::placeholder': {
                          color: 'black',
                          opacity: 1,
                        },
                      },
                    }}
                  />
                  {errors.shift_no && <div className="mat-error">{errors.shift_no.message}</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.start_day ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("start_day", { required: "Start Day is required" })}
                    onBlur={() => trigger('start_day')}
                    ref={customDaySelectRef}
                    name="start_day"
                    value={shiftForm.start_day}
                    onChange={handleFormChange}
                    label="Start Day"
                    required={true}
                    error={!!errors.start_day}
                    options={[
                      { value: '1', label: 'Day 1' },
                      { value: '2', label: 'Day 2' },
                    ]}
                  />
                  {errors.start_day && <div className="mat-error">Start Day is required</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.end_day ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("end_day", { required: "End Day is required" })}
                    onBlur={() => trigger('end_day')}
                    ref={customDaySelectRef}
                    name="end_day"
                    value={shiftForm.end_day}
                    onChange={handleFormChange}
                    error={!!errors.end_day}
                    label="End Day"
                    required={true}
                    options={[
                      { value: '1', label: 'Day 1' },
                      { value: '2', label: 'Day 2' },
                    ]}
                  />
                  {errors.end_day && <div className="mat-error">End Day is required</div>} {/* Changed to div and mat-error */}
                </div>
              </div>
            </LocalizationProvider>
            <div className="form-button text-right" align="end" style={{ marginRight: '10px' }}>
              <Button type="submit" variant="contained" className="filter_btn btn_orange" color="warning" >
                Save
              </Button>
            </div>
            <br></br>
          </form>
        </div>
      </div>
    </Dialog >
  );
}