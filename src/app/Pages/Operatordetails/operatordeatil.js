import React, { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import {
  cleanCustomerId,
  telemetrylatestdata,
  customerbaseddevices,
  customerbasedshift
} from '../../Services/app/companyservice';
import { CustomDaySelect, CustomDateSelect } from '../Inputfield/inputfield';
import { telemetrykeydata } from '../../Services/app/andondashboardservice';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker';
import Swal from 'sweetalert2';
import { Downtimeadd1, DowntimeaddDelete, Deviceattributeget, Downtimeadd2, DowntimeaddDelete1 } from '../../Services/app/masterservice';
import { Autocomplete, FormControl, FormHelperText } from '@mui/material';
import { CUSTOMER_IDS } from '../../Shared/constants/ids';

const OperatorDetails = () => {
  const params = new URLSearchParams(window.location.search);
  const token = localStorage.getItem('token');
  const customerId = localStorage.getItem('CustomerID');
  const customerId1 = cleanCustomerId(customerId);
  const [selectedDevicename, setSelectedDevicename] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [startDateTime, setStartDateTime] = useState(null);
  const [endDateTime, setEndDateTime] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeUrl, setIframeUrl] = useState('');
  const initialLoad = useRef(true);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [utilizationData, setUtilizationData] = useState([]);
  const [devices, setDevices] = useState([]);
  const [formattedUtilization, setFormattedUtilization] = useState('');
  const [Deviceid, setdeviceid] = useState('');
  const [Devicename, setdevicename] = useState('');
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [iframeInteractive, setIframeInteractive] = useState(true);
  const [Assignmodes, setAssignmodes] = useState([]);
  const [selectedassignmode, setSelectedassignmode] = useState('');
  const [operators, setoperators] = useState([]);
  const [operatorslist, setoperatorslist] = useState([]);
  const [operatorsByDevice, setOperatorsByDevice] = useState({});
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [filteredResult, setfilteredResult] = useState([]); // Changed from {} to []
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [operatorselected, setselectedoperator] = useState('');
  const [epochRange, setEpochRange] = useState({ from: null, to: null });
  const [shiftOptions, setShiftOptions] = useState([]);
  const customDaySelectRef = useRef();
  const selectRef = useRef();
  const [deviceThresholds, setDeviceThresholds] = useState({});
  const [components, setcomponents] = useState([]);
  const [componentslist, setcomponentslist] = useState([]);
  const [componentselected, setselectedcomponent] = useState('');
  const [openEditDialog1, setOpenEditDialog1] = useState(false);
  const [reasons, setreasons] = useState([]);
  const [reasonslist, setreasonslist] = useState([]);
  const [reasonselected, setselectedreason] = useState('');
  const [openEditDialog2, setOpenEditDialog2] = useState(false);
  const [supervisors, setsupervisors] = useState([]);
  const [supervisorslist, setsupervisorslist] = useState([]);
  const [supervisorsByDevice, setSupervisorByDevice] = useState([]);
  const [supervisorselected, setselectedsupervisor] = useState('');
  const [OpenEditDialog4, setOpenEditDialog4] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [savingComponent, setSavingComponent] = useState(false);
  const [timeErrors, setTimeErrors] = useState({
    startTime: '',
    endTime: ''
  });
  const [savingStates, setSavingStates] = useState({
    operator: false,
    component: false,
    supervisor: false
  });

  const [dateErrors, setDateErrors] = useState({
    operator: '',
    component: '',
    supervisor: ''
  });

  useEffect(() => {
    if (openEditDialog || openEditDialog1 || OpenEditDialog4) {
      const dateError = validateDate(selectedDate);
      const newDateErrors = {
        operator: openEditDialog ? dateError : '',
        component: openEditDialog1 ? dateError : '',
        supervisor: OpenEditDialog4 ? dateError : ''
      };
      setDateErrors(newDateErrors);
    }
  }, [selectedDate, openEditDialog, openEditDialog1, OpenEditDialog4]);

  useEffect(() => {
    if (openEditDialog || openEditDialog1 || OpenEditDialog4) {
      const startError = validateStartTime(startTime);
      const endError = validateEndTime(endTime);
      setTimeErrors({
        startTime: startError,
        endTime: endError
      });
    }
  }, [startTime, endTime, selectedDate, selectedShift, openEditDialog, openEditDialog1, OpenEditDialog4]);
  // Add date validation function
  const validateDate = (date) => {
    if (!date || !date.isValid()) {
      return 'Invalid date format';
    }
    const now = dayjs().startOf('day');
    const maxDate = dayjs().add(7, 'day').endOf('day');
    if (date.isBefore(now, 'day')) {
      return 'Date cannot be in the past.';
    }
    if (date.isAfter(maxDate)) {
      return 'Date cannot be more than 7 days from today.';
    }
    return '';
  };

  const handleTimeChange = (type, value, dialogType) => {
    if (type === 'start') {
      setStartTime(value);
    } else {
      setEndTime(value);
    }
    const startError = validateStartTime(type === 'start' ? value : startTime);
    const endError = validateEndTime(type === 'end' ? value : endTime);
    setTimeErrors({
      startTime: startError,
      endTime: endError
    });
    if (dialogType === 'component' && type === 'start' && value && endTime) {
      setTimeout(() => validateAndCheckOverlap1(value, endTime), 100);
    } else if (dialogType === 'component' && type === 'end' && startTime && value) {
      setTimeout(() => validateAndCheckOverlap1(startTime, value), 100);
    }
  };

  const handleStartTimeChange = (value) => handleTimeChange('start', value, 'operator');
  const handleEndTimeChange = (value) => handleTimeChange('end', value, 'operator');
  const handleStartTimeChange1 = (value) => handleTimeChange('start', value, 'component');
  const handleEndTimeChange1 = (value) => handleTimeChange('end', value, 'component');

  const validateStartTime = (value) => {
    if (!value) return 'Start time is required';
    if (!value.isValid()) {
      return 'Invalid time format';
    }
    const selectedShiftData = shifts.find(
      (shift) => shift.shift_no === selectedShift
    );
    if (!selectedShiftData) return '';
    const now = dayjs();
    const isToday = selectedDate.isSame(now, 'day');
    const { shiftStart, shiftEnd } = getShiftBoundaries(selectedShiftData, selectedDate);
    const selectedDateTime = getAdjustedDateTime(value, selectedDate, selectedShiftData);
    if (!selectedDateTime || !shiftStart || !shiftEnd) {
      return 'Unable to validate time';
    }
    if (isToday && selectedDateTime.isBefore(now, 'minute')) {
      return "Start time can't be in the past";
    }
    if (endTime) {
      const adjustedEnd = getAdjustedDateTime(endTime, selectedDate, selectedShiftData);
      if (selectedDateTime.isSame(adjustedEnd, 'second')) {
        return 'Start and end time cannot be the same';
      }
      if (selectedDateTime.isAfter(adjustedEnd)) {
        return 'Start time cannot be after end time';
      }
    }
    const formattedStart = shiftStart.format('DD-MM-YYYY hh:mm:ss A');
    const formattedEnd = shiftEnd.format('DD-MM-YYYY hh:mm:ss A');
    if (selectedDateTime.isBefore(shiftStart) || selectedDateTime.isAfter(shiftEnd)) {
      return `Start time must be within shift ${formattedStart} - ${formattedEnd}`;
    }
    return '';
  };

  const validateEndTime = (value) => {
    if (!value) return 'End time is required';
    if (!value.isValid()) {
      return 'Invalid time format';
    }
    const selectedShiftData = shifts.find(
      (shift) => shift.shift_no === selectedShift
    );
    if (!selectedShiftData) return '';
    const now = dayjs();
    const isToday = selectedDate.isSame(now, 'day');
    const { shiftStart, shiftEnd } = getShiftBoundaries(selectedShiftData, selectedDate);
    const selectedDateTime = getAdjustedDateTime(value, selectedDate, selectedShiftData);
    if (!selectedDateTime || !shiftStart || !shiftEnd) {
      return 'Unable to validate time';
    }
    if (isToday && selectedDateTime.isBefore(now, 'second')) {
      return 'End time must be in the future';
    }
    if (startTime) {
      const adjustedStart = getAdjustedDateTime(startTime, selectedDate, selectedShiftData);
      if (selectedDateTime.isSame(adjustedStart, 'second')) {
        return 'End and start time cannot be the same';
      }
      if (selectedDateTime.isBefore(adjustedStart)) {
        return 'End time cannot be before start time';
      }
    }
    const formattedStart = shiftStart.format('DD-MM-YYYY hh:mm:ss A');
    const formattedEnd = shiftEnd.format('DD-MM-YYYY hh:mm:ss A');
    if (selectedDateTime.isBefore(shiftStart) || selectedDateTime.isAfter(shiftEnd)) {
      return `End time must be within shift ${formattedStart} - ${formattedEnd}`;
    }
    return '';
  };

  const getEpochFromShift = (shiftNo, selectedDateObj) => {
    if (!shiftNo || !selectedDateObj || shifts.length === 0) {
      return { fromEpoch: null, toEpoch: null };
    }

    const selectedShiftData = shifts.find(shift => shift.shift_no === shiftNo);
    if (!selectedShiftData) {
      return { fromEpoch: null, toEpoch: null };
    }

    const { shiftStart, shiftEnd } = getShiftBoundaries(selectedShiftData, selectedDateObj);

    return {
      fromEpoch: shiftStart.valueOf(),
      toEpoch: shiftEnd.valueOf()
    };
  };
  const getEpochFromShift1 = (shiftNo, selectedDateObj) => {
    if (!shiftNo || !selectedDateObj || shifts.length === 0) {
      return { fromEpoch: null, toEpoch: null };
    }

    const selectedShiftData = shifts.find(shift => shift.shift_no === shiftNo);
    if (!selectedShiftData) {
      return { fromEpoch: null, toEpoch: null };
    }

    const dateStr = selectedDateObj.format('YYYY-MM-DD');
    const startDateTime = dayjs(`${dateStr}T${selectedShiftData.start_time}`);

    let endDateTime;
    if (String(shiftNo) === "2" || shiftNo === 2) {
      const nextDay = selectedDateObj.add(1, 'day').format('YYYY-MM-DD');
      endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
    } else {
      endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
    }

    if (String(shiftNo) !== "2" && shiftNo !== 2) {
      const todayStr = dayjs().format('YYYY-MM-DD');
      if (dateStr === todayStr) {
        const now = dayjs();
        if (now.isBefore(endDateTime)) {
          endDateTime = now;
        }
      }
    }

    return {
      fromEpoch: startDateTime.valueOf(),
      toEpoch: endDateTime.valueOf()
    };
  };
  const isTimeInShift = (time, shift) => {
    if (!shift) return true;
    const start = dayjs(shift.start_time, 'HH:mm:ss');
    const end = dayjs(shift.end_time, 'HH:mm:ss');
    // Overnight shift
    if (end.isBefore(start)) {
      return time.isAfter(start) || time.isBefore(end) || time.isSame(start) || time.isSame(end);
    }
    // Normal shift
    return (time.isAfter(start) && time.isBefore(end)) || time.isSame(start) || time.isSame(end);
  };
  // const handleStartTimeChange = async (value) => {
  //   if (!value) return;

  //   // 1. Check if start time equals end time (to the second)
  //   if (dayjs(value).isSame(endTime, 'second')) {
  //     setOpenEditDialog(false);
  //     setOpenEditDialog4(false);
  //     setOpenEditDialog1(false);
  //     Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
  //     return;
  //   }

  //   // // 2. Check if start time is within shift range
  //   // if (!isTimeInShift(value, selectedShiftData)) {
  //   //   setOpenEditDialog(false);
  //   //   setOpenEditDialog1(false);
  //   //   setOpenEditDialog4(false);
  //   //   Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
  //   //   return;
  //   // }

  //   // 3. Proceed
  //   setStartTime(value);

  //   // 4. Check overlap if endTime exists
  //   if (endTime) {
  //     await validateAndCheckOverlap(value, endTime);
  //   }
  // };

  // const handleStartTimeChange1 = async (value) => {
  //   setStartTime(value);
  //   const startError = validateStartTime(value);
  //   const endError = endTime ? validateEndTime(endTime) : '';
  //   setTimeErrors({
  //     startTime: startError,
  //     endTime: endError
  //   });
  //   if (value && endTime && !startError && !endError) {
  //     await validateAndCheckOverlap1(value, endTime);
  //   }
  // };

  // const handleEndTimeChange1 = async (value) => {
  //   setEndTime(value);
  //   const endError = validateEndTime(value);
  //   const startError = startTime ? validateStartTime(startTime) : '';
  //   setTimeErrors({
  //     startTime: startError,
  //     endTime: endError
  //   });
  //   if (startTime && value && !startError && !endError) {
  //     await validateAndCheckOverlap1(startTime, value);
  //   }
  // };

  const validateAndCheckOverlap = async (newStart, newEnd) => {
    if (!selectedDate || !selectedDeviceId?.id) return false;

    const fromEpoch = dayjs(selectedDate).hour(newStart.hour()).minute(newStart.minute()).second(newStart.second()).valueOf();
    const toEpoch = dayjs(selectedDate).hour(newEnd.hour()).minute(newEnd.minute()).second(newEnd.second()).valueOf();

    // Ensure start time is before end time
    if (fromEpoch >= toEpoch) {
      Swal.fire('Error', 'Start time must be before end time.', 'error');
      return false;
    }

    const hasOverlap = await checkOperatorTimeOverlap(selectedDeviceId.id, fromEpoch, toEpoch);

    if (hasOverlap) {
      Swal.fire('Error', 'Selected time overlaps with an already assigned operator.', 'error');
      return false;
    }
  };
  const validateAndCheckOverlap1 = async (newStart, newEnd) => {
    if (!selectedDate || !selectedDeviceId?.id) return false;

    const selectedShiftData = shifts.find(shift => shift.shift_no === selectedShift);
    if (!selectedShiftData) return false;
    const fromDateTime = getAdjustedDateTime(newStart, selectedDate, selectedShiftData);
    const toDateTime = getAdjustedDateTime(newEnd, selectedDate, selectedShiftData);
    if (!fromDateTime || !toDateTime) return false;
    const fromEpoch = fromDateTime.valueOf();
    const toEpoch = toDateTime.valueOf();

    // Ensure start time is before end time
    if (fromEpoch >= toEpoch) {
      Swal.fire('Error', 'Start time must be before end time.', 'error');
      setStartTime(null);
      setEndTime(null);
      return false;
    }

    const hasOverlap = await checkOperatorTimeOverlap1(selectedDeviceId.id, fromEpoch, toEpoch);

    if (hasOverlap) {
      Swal.fire('Error', 'Selected time overlaps with an already assigned component.', 'error');
      setStartTime(null);
      setEndTime(null);
    }
  };
  const checkOperatorTimeOverlap = async (deviceId, fromEpoch, toEpoch) => {
    try {
      // Get all existing operator assignments for this device, not just within the new time range


      const response = await telemetrykeydata(deviceId, 'DEVICE', 'live_operator', 0, Date.now());

      const existingData = response?.live_operator || [];

      for (const item of existingData) {
        if (!item?.value) continue;

        let parsed = {};
        try {
          parsed = JSON.parse(item.value);
        } catch (e) {
          continue;
        }

        const existingStart = parsed.start_time || item.ts;
        const existingEnd = parsed.end_time || (existingStart + (parsed.duration || 0) * 1000);

        // Check overlap: if the new time range overlaps with any existing assignment
        const isOverlapping = fromEpoch < existingEnd && existingStart < toEpoch;
        if (isOverlapping) {
          console.log('Overlap detected:', {
            newStart: new Date(fromEpoch),
            newEnd: new Date(toEpoch),
            existingStart: new Date(existingStart),
            existingEnd: new Date(existingEnd),
            operator: parsed.operator
          });
          return true; // Conflict found
        }
      }

      return false; // No conflicts
    } catch (error) {
      console.error('Error checking overlap:', error);
      return false;
    }
  };

  const checkOperatorTimeOverlap1 = async (deviceId, fromEpoch, toEpoch) => {
    try {
      // Get all existing operator assignments for this device, not just within the new time range


      const response = await telemetrykeydata(deviceId, 'DEVICE', 'live_component', 0, Date.now());

      const existingData = response?.live_component || [];

      for (const item of existingData) {
        if (!item?.value) continue;

        let parsed = {};
        try {
          parsed = JSON.parse(item.value);
        } catch (e) {
          continue;
        }

        const existingStart = parsed.start_time || item.ts;
        const existingEnd = parsed.end_time || (existingStart + (parsed.duration || 0) * 1000);

        // Check overlap: if the new time range overlaps with any existing assignment
        const isOverlapping = fromEpoch < existingEnd && existingStart < toEpoch;
        if (isOverlapping) {
          console.log('Overlap detected:', {
            newStart: new Date(fromEpoch),
            newEnd: new Date(toEpoch),
            existingStart: new Date(existingStart),
            existingEnd: new Date(existingEnd),
            operator: parsed.name
          });
          return true; // Conflict found
        }
      }

      return false; // No conflicts
    } catch (error) {
      console.error('Error checking overlap:', error);
      return false;
    }
  };
  // const handleEndTimeChange = async (value) => {
  //   if (dayjs(value).isSame(startTime, 'second')) {
  //     setOpenEditDialog(false);
  //     setOpenEditDialog1(false);
  //     setOpenEditDialog4(false);
  //     Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
  //     return;
  //   }
  //   // if (!value || !isTimeInShift(value, selectedShiftData)) {
  //   //   setOpenEditDialog(false);
  //   //   setOpenEditDialog1(false);
  //   //   setOpenEditDialog4(false);
  //   //   Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
  //   //   return;
  //   // }


  //   setEndTime(value);

  //   if (startTime) {
  //     await validateAndCheckOverlap(startTime, value);
  //   }
  // };
  // const handleEndTimeChange1 = async (value) => {
  //   if (dayjs(value).isSame(startTime, 'second')) {
  //     setOpenEditDialog(false);
  //     setOpenEditDialog1(false);
  //     setOpenEditDialog4(false);
  //     Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
  //     return;
  //   }
  //   // if (!value || !isTimeInShift(value, selectedShiftData)) {
  //   //   setOpenEditDialog(false);
  //   //   setOpenEditDialog1(false);
  //   //   setOpenEditDialog4(false);
  //   //   Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
  //   //   return;
  //   // }

  //   setEndTime(value);

  //   if (startTime) {
  //     await validateAndCheckOverlap(startTime, value);
  //   }
  // };
  const handleDateChange = (newValue) => {
    const dayjsVal = dayjs(newValue);
    setSelectedDate(dayjsVal);

    // Recalculate epoch range when date changes
    if (selectedShift && shifts.length > 0) {
      const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, dayjsVal);
      setEpochRange({ from: fromEpoch, to: toEpoch });
      const key = 'alloperator';
      customerbasedshift(customerId, key)
        .then(async (data) => {
          const allOperators = data[0]?.value || [];
          setoperatorslist(allOperators);

          const operatorOptions = allOperators
            .filter(shift => shift.mode === "Operator")
            .map(shift => ({
              id: shift.operatorid,
              value: shift.operatorid,
              label: `${shift.operatorid} - ${shift.operatorname}`,
              name: shift.operatorname
            }));

          setoperators(operatorOptions);

          const key2 = 'live_operator';
          const entitytype = 'DEVICE';
          const deviceid = selectedDeviceId;

          try {
            const response = await telemetrykeydata(deviceid, entitytype, key2, fromEpoch, toEpoch);
            if (response && response.live_operator && response.live_operator.length > 0 && response.live_operator[0].value) {
              const parsedValue = JSON.parse(response.live_operator[0].value);
              const operatorCode = parsedValue.code || '';

              const foundOperator = allOperators.find(op => op.operatorid === operatorCode);
              if (foundOperator) {
                setSelectedOperatorId(foundOperator.operatorid);
                setOperatorName(foundOperator.operatorname);
              } else {
                setSelectedOperatorId('');
                setOperatorName('');
              }
            } else {
              setSelectedOperatorId('');
              setOperatorName('');
            }
          } catch (error) {
            console.error('Error fetching live_operator:', error);
            setSelectedOperatorId('');
            setOperatorName('');
          }
        })
        .catch(error => {
          console.error("Error fetching operators:", error);
        });
    }
  };
  const handleOperatorChange = (event, newValue) => {
    if (newValue) {
      setSelectedOperatorId(newValue.id);
      setOperatorName(newValue.name || '');
    } else {
      setSelectedOperatorId('');
      setOperatorName('');
    }
  };

  const handleOperatorChange1 = (newValue) => {
    const dayjsVal = dayjs(newValue);
    setSelectedDate(dayjsVal);
    handleShiftChange(selectedShift, dayjsVal);
  };

  const handleShiftChange = (shiftValue, dateParam) => {
    const now = dayjs();
    const selectedDateLocal = dateParam || selectedDate;
    const isToday = selectedDateLocal.isSame(now, 'day');
    const currentShiftData = getCurrentShift(shifts, now);
    const selectedShiftData = shifts.find(shift => shift.shift_no === shiftValue);
    setSelectedShift(shiftValue);
    if (isToday && currentShiftData && currentShiftData.shift_no === shiftValue) {
      const currentTimeRounded = now.startOf('minute');
      setStartTime(currentTimeRounded);
      setEndTime(dayjs(currentShiftData.end_time, 'HH:mm:ss'));
    }
    else if (selectedShiftData) {
      setStartTime(dayjs(selectedShiftData.start_time, 'HH:mm:ss'));
      setEndTime(dayjs(selectedShiftData.end_time, 'HH:mm:ss'));
    }
    const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDateLocal);
    setEpochRange({ from: fromEpoch, to: toEpoch });
  };
  const operatorvaluechange = async (shiftValue) => {
    try {
      setSelectedShift(shiftValue);
      const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
      setEpochRange({ from: fromEpoch, to: toEpoch });

      const key = 'alloperator';
      const operatorData = await customerbasedshift(customerId, key);
      const allOperators = operatorData[0]?.value || [];
      setoperatorslist(allOperators);

      const operatorOptions = allOperators
        .filter(shift => shift.mode === "Operator")
        .map(shift => ({
          id: shift.operatorid,
          value: shift.operatorid,
          label: `${shift.operatorid} - ${shift.operatorname}`,
          name: shift.operatorname
        }));

      setoperators(operatorOptions);

      const key2 = 'live_operator';
      const entitytype = 'DEVICE';
      const deviceId = selectedDeviceId;

      try {
        const response = await telemetrykeydata(deviceId, entitytype, key2, fromEpoch, toEpoch);
        if (response && response.live_operator && response.live_operator.length > 0 && response.live_operator[0].value) {
          const parsedValue = JSON.parse(response.live_operator[0].value);
          const operatorName = parsedValue.operator || '';
          const operatorCode = parsedValue.code || '';

          const foundOperator = allOperators.find(op =>
            op.operatorid === operatorCode || op.operatorname === operatorName
          );

          if (foundOperator) {
            setSelectedOperatorId(foundOperator.operatorid);
            setOperatorName(foundOperator.operatorname);
          } else {
            setSelectedOperatorId('');
            setOperatorName('');
          }
        } else {
          setSelectedOperatorId('');
          setOperatorName('');
        }
      } catch (error) {
        console.error('Error fetching live_operator:', error);
        setSelectedOperatorId('');
        setOperatorName('');
      }
      setOpenEditDialog(true);
    } catch (error) {
      console.error('Error in operatorvaluechange:', error);
    }
  };
  const operatorvaluechange1 = async (shiftValue) => {
    try {
      setSelectedShift(shiftValue);
      const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
      setEpochRange({ from: fromEpoch, to: toEpoch });

      const key = 'component';
      const operatorData = await customerbasedshift(customerId, key);
      const allComponents = operatorData[0]?.value || [];
      setcomponentslist(allComponents);
      const componentOptions = allComponents.map(comp => ({
        id: comp.id,
        value: comp.component_name,
        label: cleanCustomerId(customerId) === CUSTOMER_IDS.ATECH || cleanCustomerId(customerId) === CUSTOMER_IDS.HITECH
          ? `${comp.component_number} - ${comp.component_name.length > 15 ? comp.component_name.slice(0, 15) + '...' : comp.component_name}${comp.operation_type ? ` (${comp.operation_type})` : ''}`
          : `${comp.component_number} - ${comp.component_name}`
      }));
      setcomponents(componentOptions);
      const key2 = 'live_component';
      const entitytype = 'DEVICE';
      const deviceId = selectedDeviceId;

      try {
        const response = await telemetrykeydata(deviceId, entitytype, key2, fromEpoch, toEpoch);
        if (response?.live_component?.[0]?.value) {
          const parsedValue = JSON.parse(response.live_component[0].value);
          const componentName = parsedValue.component_name || '';
          setselectedcomponent(componentName);
          const foundComponent = allComponents.find(comp => comp.component_name === componentName);
          setSelectedComponentId(foundComponent?.id || '');
        } else {
          setselectedcomponent('');
          setSelectedComponentId('');
        }
      } catch (error) {
        console.error('Error fetching live_component:', error);
        setselectedcomponent('');
        setSelectedComponentId('');
      }

      setOpenEditDialog1(true);
    } catch (error) {
      console.error('Error in operatorvaluechange1:', error);
    }
  };
  const operatorvaluechange2 = async (shiftValue) => {
    try {
      setSelectedShift(shiftValue);

      const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
      setEpochRange({ from: fromEpoch, to: toEpoch });

      const key = 'alloperator';
      customerbasedshift(customerId, key)
        .then(async (data) => {
          const allShifts = data[0]?.value || [];
          setsupervisorslist(allShifts);
          console.log('allsupervisor', allShifts);

          // ✅ Filter only "Operator" mode
          const operatorNames = allShifts
            .filter(shift => shift.mode === "Supervisor")  // <-- filter added
            .map(shift => ({
              value: shift.operatorname,
              label: `${shift.operatorid} - ${shift.operatorname}`
            }));

          setsupervisors(operatorNames);
          const key2 = 'live_supervisor';
          const entitytype = 'CUSTOMER';
          const cleancustomerid = cleanCustomerId(customerId);

          try {
            const response = await telemetrylatestdata(cleancustomerid, entitytype, key2);
            if (response && response.live_supervisor && response.live_supervisor.length > 0 && response.live_supervisor[0].value) {
              let operator = JSON.parse(response.live_supervisor[0].value).supervisor;
              setselectedsupervisor(operator);
            } else {
              setselectedsupervisor('');
            }
          } catch (error) {

            setselectedsupervisor('');
          }
          setOpenEditDialog4(true);
        })
        .catch(error => {
          console.error("Error fetching shifts:", error);
        });

      setOpenEditDialog4(true);
    } catch (error) {
      console.error('Error in operatorvaluechange1:', error);
    }
  };
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setselectedoperator(value);
  };
  const handleFormChange3 = (event) => {
    const { name, value } = event.target;
    setselectedsupervisor(value);
  };
  const handleOpenEditDialog = async (devicename, deviceid) => {
    setLoading(true);

    const key1 = 'allShift';

    try {
      const shiftData = await customerbasedshift(customerId, key1);
      const allShifts = shiftData[0]?.value || [];
      setShifts(allShifts);

      const options = allShifts.map((shift) => ({
        value: shift.shift_no,
        label: `Shift${shift.shift_no}`,
      }));
      setShiftOptions(options);
      const now = dayjs();
      const currentShiftData = getCurrentShift(allShifts, now);
      const fallbackShiftData = allShifts[0];
      if (currentShiftData) {
        const currentTimeRounded = dayjs().startOf('minute');
        setStartTime(currentTimeRounded);
        setEndTime(dayjs(currentShiftData.end_time, 'HH:mm:ss'));
      } else if (fallbackShiftData) {
        setStartTime(dayjs(fallbackShiftData.start_time, 'HH:mm:ss'));
        setEndTime(dayjs(fallbackShiftData.end_time, 'HH:mm:ss'));
      }
      if (options.length > 0) {
        const defaultShift = options[0].value;
         setSelectedDate(now);
        const selectedShiftNo = currentShiftData
          ? currentShiftData.shift_no
          : fallbackShiftData?.shift_no;
        setSelectedShift(selectedShiftNo);
        setfilteredResult([]); // (Optional) clear table

        // Calculate initial epoch range for current date and first shift
        const { fromEpoch, toEpoch } = getEpochFromShift(defaultShift, dayjs());
        setEpochRange({ from: fromEpoch, to: toEpoch });
        console.log('fromEpoch:', fromEpoch, 'toEpoch:', toEpoch, 'defaultShift:', defaultShift, 'currentDate:', dayjs());

        setfilteredResult([]);

        // Get operator data
        const key = 'alloperator';
        const operatorData = await customerbasedshift(customerId, key);
        const allOperators = operatorData[0]?.value || [];
        setoperatorslist(allOperators);

        const operatorOptions = allOperators
          .filter((shift) => shift.mode === "Operator")
          .map((shift) => ({
            id: shift.operatorid,
            value: shift.operatorid,
            label: `${shift.operatorid} - ${shift.operatorname}`,
            name: shift.operatorname
          }));
        setoperators(operatorOptions);

        // ✅ Now safely fetch live_operator after all data is ready
        setSelectedDeviceId(deviceid);
        setSelectedDevicename(devicename);
        const key2 = 'live_operator';
        const entitytype = 'DEVICE';

        await fetchLiveOperator(deviceid, entitytype, key2, fromEpoch, toEpoch);
        setOpenEditDialog(true);
      }
    } catch (err) {
      console.error('Error in handleOpenEditDialog:', err);
    } finally {
      setLoading(false);
    }
  };
  const fetchLiveOperator = async (deviceid, entitytype, key2, fromEpoch, toEpoch) => {
    try {
      const response = await telemetrykeydata(deviceid, entitytype, key2, fromEpoch, toEpoch);
      if (
        response &&
        response.live_operator &&
        response.live_operator.length > 0 &&
        response.live_operator[0].value
      ) {
        const parsedValue = JSON.parse(response.live_operator[0].value);
        const operatorName = parsedValue.operator || '';
        const operatorCode = parsedValue.code || '';

        // Find operator by code (operatorid) or name
        const foundOperator = operatorslist.find(op =>
          op.operatorid === operatorCode || op.operatorname === operatorName
        );

        if (foundOperator) {
          setSelectedOperatorId(foundOperator.operatorid);
          setOperatorName(foundOperator.operatorname);
        } else {
          setSelectedOperatorId('');
          setOperatorName('');
        }
      } else {
        setSelectedOperatorId('');
        setOperatorName('');
      }
    } catch (error) {
      console.error('Error fetching live_operator:', error);
      setSelectedOperatorId('');
      setOperatorName('');
    }
  };
  const handleOpenEditDialog1 = async (devicename, deviceid) => {
    setTimeErrors({ startTime: '', endTime: '' });
    setLoading(true);
    const key1 = 'allShift';
    try {
      const shiftData = await customerbasedshift(customerId, key1);
      const allShifts = shiftData[0]?.value || [];
      setShifts(allShifts);
      const options = allShifts.map((shift) => ({
        value: shift.shift_no,
        label: `Shift${shift.shift_no}`,
      }));
      setShiftOptions(options);
      const now = dayjs();
      const currentShiftData = getCurrentShift(allShifts, now);
      const fallbackShiftData = allShifts[0];
      if (currentShiftData) {
        const currentTimeRounded = dayjs().startOf('minute');
        setStartTime(currentTimeRounded);
        setEndTime(dayjs(currentShiftData.end_time, 'HH:mm:ss'));
      } else if (fallbackShiftData) {
        setStartTime(dayjs(fallbackShiftData.start_time, 'HH:mm:ss'));
        setEndTime(dayjs(fallbackShiftData.end_time, 'HH:mm:ss'));
      }
      if (options.length > 0) {
        setSelectedDate(now);
        const selectedShiftNo = currentShiftData
          ? currentShiftData.shift_no
          : fallbackShiftData?.shift_no;
        setSelectedShift(selectedShiftNo);
        setfilteredResult([]);
        const { fromEpoch, toEpoch } = getEpochFromShift(selectedShiftNo, now);
        setEpochRange({ from: fromEpoch, to: toEpoch });

        const key = 'component';
        const operatorData = await customerbasedshift(customerId, key);
        const allComponents = operatorData[0]?.value || [];
        setcomponentslist(allComponents);
        const componentOptions = allComponents.map(comp => ({
          id: comp.id,
          value: comp.component_name,
          label: cleanCustomerId(customerId) === CUSTOMER_IDS.ATECH || cleanCustomerId(customerId) === CUSTOMER_IDS.HITECH
            ? `${comp.component_number} - ${comp.component_name.length > 15 ? comp.component_name.slice(0, 15) + '...' : comp.component_name}${comp.operation_type ? ` (${comp.operation_type})` : ''}`
            : `${comp.component_number} - ${comp.component_name}`
        }));
        setcomponents(componentOptions);

        setSelectedDeviceId(deviceid);
        setSelectedDevicename(devicename);
        const key2 = 'live_component';
        const entitytype = 'DEVICE';
        await fetchLiveComponent(deviceid, entitytype, key2, fromEpoch, toEpoch);
        setOpenEditDialog1(true);
      }
    } catch (err) {
      console.error('Error in handleOpenEditDialog:', err);
    } finally {
      setLoading(false);
    }
  };
  const fetchLiveComponent = async (deviceid, entitytype, key2, fromEpoch, toEpoch) => {
    try {
      const response = await telemetrykeydata(deviceid, entitytype, key2, fromEpoch, toEpoch);
      if (response && response.live_component && response.live_component.length > 0 && response.live_component[0].value) {
        const data = JSON.parse(response.live_component[0].value);
        const componentName = data.component_name || '';
        setselectedcomponent(componentName);
        const foundComponent = componentslist.find(comp => comp.component_name === componentName);
        if (foundComponent) {
          setSelectedComponentId(foundComponent.id);
        } else {
          setSelectedComponentId('');
        }
      } else {
        setselectedcomponent('');
        setSelectedComponentId('');
      }
    } catch (error) {
      console.error('Error fetching live_component:', error);
      setselectedcomponent('');
      setSelectedComponentId('');
    }
  };
  const handleOpenEditDialog2 = async (devicename, deviceid) => {
    const key = 'reason';
    const customerId = localStorage.getItem('CustomerID');
    customerbasedshift(customerId, key)
      .then(async (data) => {
        const allShifts = data[0]?.value || [];
        setreasonslist(allShifts);
        const reasons = allShifts.map(shift => ({
          value: shift.reason,
          label: shift.reason
        }));
        setreasons(reasons);
        setSelectedDeviceId(deviceid);
        setOpenEditDialog2(true);
        //downtimereason();
      })
      .catch(error => {
        console.error("Error fetching shifts:", error);
      });
    const key1 = 'allShift';

    // Fetch shifts and set shift options
    customerbasedshift(customerId, key1)
      .then(async (data) => {
        const allShifts = data[0].value || [];
        setShifts(allShifts);

        const options = allShifts.map((shift) => ({
          value: shift.shift_no,
          label: `Shift${shift.shift_no}`,
        }));
        setShiftOptions(options);
        const selectedShiftData = allShifts.find(shift => shift.shift_no === allShifts[0]?.shift_no || '1');
        if (selectedShiftData) {
          setStartTime(dayjs(selectedShiftData.start_time, 'HH:mm:ss'));
          setEndTime(dayjs(selectedShiftData.end_time, 'HH:mm:ss'));
        }
        if (options.length > 0) {
          const defaultShift = options[0].value;
          setSelectedDate(dayjs()); // Set to current date
          setSelectedShift(defaultShift);
          setfilteredResult([]); // (Optional) clear table

          // Calculate initial epoch range for current date and first shift
          const { fromEpoch, toEpoch } = getEpochFromShift(defaultShift, dayjs());
          setEpochRange({ from: fromEpoch, to: toEpoch });
        }
      })
      .catch((err) => {
        console.error('Error loading shifts:', err);
      })
      .finally(() => setLoading(false));
  };
  const handleOpenEditDialog4 = async () => {
    const key1 = 'allShift';
    const shiftData = await customerbasedshift(customerId, key1);
    const allShifts = shiftData[0]?.value || [];
    setShifts(allShifts);

    const options = allShifts.map((shift) => ({
      value: shift.shift_no,
      label: `Shift${shift.shift_no}`,
    }));
    setShiftOptions(options);
    const now = dayjs();
    const currentShiftData = getCurrentShift(allShifts, now);
    const fallbackShiftData = allShifts[0];
    if (currentShiftData) {
      const currentTimeRounded = dayjs().startOf('minute');
      setStartTime(currentTimeRounded);
      setEndTime(dayjs(currentShiftData.end_time, 'HH:mm:ss'));
    } else if (fallbackShiftData) {
      setStartTime(dayjs(fallbackShiftData.start_time, 'HH:mm:ss'));
      setEndTime(dayjs(fallbackShiftData.end_time, 'HH:mm:ss'));
    }
    if (options.length > 0) {
      const defaultShift = options[0].value;
      setSelectedDate(now);
        const selectedShiftNo = currentShiftData
          ? currentShiftData.shift_no
          : fallbackShiftData?.shift_no;
        setSelectedShift(selectedShiftNo);
      setfilteredResult([]); // (Optional) clear table

      // Calculate initial epoch range for current date and first shift
      const { fromEpoch, toEpoch } = getEpochFromShift(defaultShift, dayjs());
      setEpochRange({ from: fromEpoch, to: toEpoch });
      console.log('fromEpoch:', fromEpoch, 'toEpoch:', toEpoch, 'defaultShift:', defaultShift, 'currentDate:', dayjs());

      setfilteredResult([]);


      const key = 'alloperator';
      customerbasedshift(customerId, key)
        .then(async (data) => {
          const allShifts = data[0]?.value || [];
          setsupervisorslist(allShifts);
          console.log('allsupervisor', allShifts);

          // ✅ Filter only "Operator" mode
          const operatorNames = allShifts
            .filter(shift => shift.mode === "Supervisor")  // <-- filter added
            .map(shift => ({
              value: shift.operatorname,
              label: `${shift.operatorid} - ${shift.operatorname}`
            }));

          setsupervisors(operatorNames);
          const key2 = 'live_supervisor';
          const entitytype = 'CUSTOMER';
          const cleancustomerid = cleanCustomerId(customerId);

          try {
            const response = await telemetrylatestdata(cleancustomerid, entitytype, key2);
            if (response && response.live_supervisor && response.live_supervisor.length > 0 && response.live_supervisor[0].value) {
              let operator = JSON.parse(response.live_supervisor[0].value).supervisor;
              setselectedsupervisor(operator);
            } else {
              setselectedsupervisor('');
            }
          } catch (error) {

            setselectedsupervisor('');

          }
          setOpenEditDialog4(true);
        })
        .catch(error => {
          console.error("Error fetching shifts:", error);
        });
    }

  }
  const handleSaveThreshold3 = async () => {
    if (savingStates.supervisor) return;
    setSavingStates(prev => ({ ...prev, supervisor: true }));
    try {
      const dateError = validateDate(selectedDate);
      if (dateError) {
        setDateErrors(prev => ({ ...prev, supervisor: dateError }));
        Swal.fire('Error', dateError, 'error');
        return;
      }
      const startError = validateStartTime(startTime);
      const endError = validateEndTime(endTime);
      if (startError || endError) {
        setTimeErrors({ startTime: startError, endTime: endError });
        Swal.fire('Error', 'Please fix time validation errors.', 'error');
        return;
      }

      if (!selectedShift || !selectedDate || !supervisorselected) {
        Swal.fire('Error', 'Please fill all required fields.', 'error');
        return;
      }

      const selectedShiftData = shifts.find(shift => shift.shift_no === selectedShift);
      if (!selectedShiftData) {
        Swal.fire('Error', 'Selected shift not found.', 'error');
        return;
      }
      const fromDateTime = getAdjustedDateTime(startTime, selectedDate, selectedShiftData);
      const toDateTime = getAdjustedDateTime(endTime, selectedDate, selectedShiftData);
      if (!fromDateTime || !toDateTime) {
        Swal.fire('Error', 'Invalid time selection. Please check start and end times.', 'error');
        return;
      }
      const fromEpoch = fromDateTime.valueOf();
      const toEpoch = toDateTime.valueOf();
      if (fromEpoch >= toEpoch) {
        Swal.fire('Error', 'Start time must be before end time.', 'error');
        return;
      }

      const durations = Math.floor((toEpoch - fromEpoch) / 1000);
      const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
      const fromtime = shiftEpoch.fromEpoch;
      const totime = shiftEpoch.toEpoch;

      if (!fromtime || !totime) {
        Swal.fire('Error', 'Unable to determine shift boundaries.', 'error');
        return;
      }
      const cleancustomerid1 = cleanCustomerId(customerId);
      // 🔍 Check for overlap before saving
      const response = await telemetrykeydata(
        cleancustomerid1,
        'CUSTOMER',
        'live_supervisor',
        fromtime,
        totime
      );

      const existingEntries = response?.live_supervisor || [];
      console.log('existingdatas', existingEntries)
      for (const item of existingEntries) {
        if (!item?.value) continue;

        let parsed;
        try {
          parsed = JSON.parse(item.value);
        } catch (e) {
          continue;
        }

        const existingStart = parsed.start_time || item.ts;
        const existingEnd =
          parsed.end_time ||
          (existingStart + (parsed.duration || 0) * 1000);

        const isOverlapping = fromEpoch < existingEnd && existingStart < toEpoch;

        if (isOverlapping) {
          const existingOperator = parsed.name || 'Unknown';
          const conflictStart = dayjs(existingStart).format('DD-MM-YYYY HH:mm:ss');
          const conflictEnd = dayjs(existingEnd).format('DD-MM-YYYY HH:mm:ss');

          Swal.fire({
            icon: 'error',
            title: 'Error',
            html: `Time overlaps with existing supervisor "<strong>${existingOperator}</strong>" between <strong>${conflictStart}</strong> and <strong>${conflictEnd}</strong>.`,
            showCancelButton: true,
            confirmButtonText: 'Overwrite',
            cancelButtonText: 'No, Cancel',
            backdrop: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            allowEnterKey: false
          }).then((result1) => {
            if (result1.isConfirmed) {
              // Only show the second confirmation if user clicked "Overwrite"
              Swal.fire({
                title: 'Do you want to overwrite the existing supervisor allocation with the new changes?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, Save',
                cancelButtonText: 'No, Cancel',
                backdrop: true,
                allowOutsideClick: false,
                allowEscapeKey: false,
                allowEnterKey: false
              }).then(async (result2) => {
                if (result2.isConfirmed) {
                  try {
                    const cleancustomerid1 = cleanCustomerId(customerId);

                    // First delete existing data in the time range
                    const deleteResponse = await DowntimeaddDelete1('CUSTOMER', cleancustomerid1, 'live_supervisor', fromtime, totime);

                    if (deleteResponse !== true) {
                      throw new Error('Failed to delete existing data for the specified time range.');
                    }
                    else {
                      const operator = supervisorslist.find(op => op.operatorname === supervisorselected);
                      const opertorid = operator ? operator.operatorid : null;

                      const key = {
                        ts: fromEpoch,
                        values: {
                          live_supervisor: {
                            name: supervisorselected,
                            code: opertorid,
                            start_time: fromEpoch,
                            end_time: toEpoch,
                            duration: durations
                          }
                        }
                      };
                      const cleancustomerid = cleanCustomerId(customerId);
                      await Downtimeadd2('CUSTOMER', cleancustomerid, 'SERVER_SCOPE', key);


                      Swal.fire({
                        title: 'Success',
                        text: 'Supervisor assigned successfully.',
                        icon: 'success',
                        backdrop: true,
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        allowEnterKey: false
                      });

                      setTimeout(() => {
                        handleSubmit();
                      }, 2000);
                    }
                    // Then proceed to add new operator data

                  } catch (error) {
                    console.error('Error in supervisor allocation update:', error);
                    Swal.fire({
                      title: 'Error',
                      text: error.message || 'Failed to update supervisor allocation.',
                      icon: 'error',
                      backdrop: true,
                      allowOutsideClick: false,
                      allowEscapeKey: false,
                      allowEnterKey: false
                    });
                  }
                } else {
                  console.log("User cancelled save.");
                }
              });
            } else {
              console.log("User cancelled overwrite.");
            }
          });


          return;
        }
      }

      // ✅ Proceed to save if no overlap
      const operator = supervisorslist.find(op => op.operatorname === supervisorselected);
      const opertorid = operator ? operator.operatorid : null;
      const key = {
        ts: fromEpoch,
        values: {
          live_supervisor: {
            name: supervisorselected,
            code: opertorid,
            start_time: fromEpoch,
            end_time: toEpoch,
            duration: durations
          }
        }
      };

      const cleancustomerid = cleanCustomerId(customerId);
      await Downtimeadd2('CUSTOMER', cleancustomerid, 'SERVER_SCOPE', key);

      Swal.fire('Success', 'Supervisor assigned successfully.', 'success');
      setTimeout(() => {
        handleSubmit();
      }, 2000);
    } catch (err) {
      console.error('Update error:', err);
      Swal.fire('Error', 'Failed to assign Supervisor.', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, supervisor: false }));
      setOpenEditDialog4(false);
    }
  }
  const cancelreason = async () => {
    setOpenEditDialog2(false);

  }

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

  const downtimereason = async () => {
    if (!selectedDeviceId || !selectedShift || !selectedDate) return;

    const { fromEpoch, toEpoch } = getEpochFromShift2(selectedShift, selectedDate, shifts);
    console.log(fromEpoch, toEpoch, 'from and to time')
    if (!fromEpoch || !toEpoch) return;

    const fromTime = fromEpoch;
    const toTime = toEpoch;
    const deviceId = selectedDeviceId;
    try {
      if (deviceId && fromTime && toTime) {
        telemetrykeydata(deviceId, 'DEVICE', 'machine_status', fromTime, toTime)
          .then(async machineStatusResponse => {
            const machineData = machineStatusResponse?.machine_status || [];

            const statusMapping = {
              0: { state: "Idle", color: "#FFEB3B" },
              1: { state: "Idle", color: "#FFEB3B" },
              2: { state: "Idle", color: "#FFEB3B" },
              3: { state: "Run", color: "#4CAF50" },
              100: { state: "Disconnect", color: "#808080" },
              5: { state: "Alarm", color: "#F44336" },
            };

            let runTime = 0, idleTime = 0, disconnectTime = 0, alarmTime = 0;
            const sortedData = [...machineData].sort((a, b) => Number(a.ts) - Number(b.ts));

            for (let i = 0; i < sortedData.length; i++) {
              const currentStatus = sortedData[i].value;
              const currentTs = Number(sortedData[i].ts);

              let nextTs;
              if (i < sortedData.length - 1) {
                nextTs = Number(sortedData[i + 1].ts);
              } else {
                nextTs = Number(toTime);
              }

              const intervalStart = Math.max(currentTs, Number(fromTime));
              const intervalEnd = Math.min(nextTs, Number(toTime));
              const duration = Math.max(0, intervalEnd - intervalStart);

              if (duration > 0) {
                const state = statusMapping[currentStatus]?.state;
                if (state === "Run") {
                  runTime += duration;
                } else if (state === "Idle") {
                  idleTime += duration;
                } else if (state === "Disconnect") {
                  disconnectTime += duration;
                } else if (state === "Alarm") {
                  alarmTime += duration;
                }
              }
            }

            const msToTime = ms => {
              const absMs = Math.abs(ms);
              const hours = Math.floor(absMs / 3600000);
              const minutes = Math.floor((absMs % 3600000) / 60000);
              const seconds = Math.floor((absMs % 60000) / 1000);
              return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            };



            const transformedData = sortedData
              .filter(item => item.ts && item.value !== undefined)
              .map(item => ({ ts: item.ts, value: item.value }));

            const extractStartEndFromOneToThree = (data) => {
              const result = [];
              let recording = false;
              let segment = { start: null, value: null };

              for (let i = 0; i < data.length; i++) {
                const current = data[i];
                const numericValue = Number(current.value);

                if (!recording && (numericValue === 0 || numericValue === 1 || numericValue === 2)) {
                  segment.start = current.ts;
                  segment.value = numericValue;
                  recording = true;
                }

                if (recording && numericValue === 3) {
                  segment.end = current.ts;
                  const startTime = new Date(segment.start);
                  const endTime = new Date(segment.end);
                  const duration = Math.floor((endTime - startTime) / 1000);

                  result.push({
                    start: segment.start,
                    end: segment.end,
                    duration: duration,
                    value: segment.value,
                    status: 'IDLE'
                  });

                  recording = false;
                  segment = { start: null, value: null };
                }

                if (recording && (numericValue === 0 || numericValue === 1 || numericValue === 2)) {
                  segment.value = numericValue;
                }
              }

              if (recording) {
                const now = Date.now();
                segment.end = Math.min(toTime, now);
                const startTime = new Date(segment.start);
                const endTime = new Date(segment.end);
                const duration = Math.floor((endTime - startTime) / 1000);
                result.push({
                  start: segment.start,
                  end: segment.end,
                  duration: duration,
                  value: segment.value,
                  status: 'IDLE'
                });
              }


              return result.length > 0 ? result : [{ start: fromTime, end: toTime, duration: 0, value: 0, status: 'NO_DATA' }];
            };
            let downtime;
            const key = 'downtime_threasold';
            const results = await Deviceattributeget(deviceId, key);
            let downtimedatas = encodeURIComponent(JSON.stringify([{ start: fromTime, end: toTime, duration: 0, value: 0, status: 'NO_DATA' }]));
            console.log('Result', results);

            if (results && results.length > 0) {
              downtime = results[0].value;
              const result = extractStartEndFromOneToThree(transformedData);
              const filteredResult = result.filter(entry => entry.duration > downtime);
              console.log('filterresult', filteredResult)
              setfilteredResult(filteredResult);
              downtimedatas = encodeURIComponent(JSON.stringify(filteredResult));
            }

            const encodedData = encodeURIComponent(JSON.stringify(transformedData));
            console.log('result', transformedData)

            return Promise.all([
              Promise.resolve(encodedData),
              Promise.resolve(downtimedatas)
            ]);
          })
          .then(async ([encodedData, downtimedatas]) => {
            const downtimedata = downtimedatas;
            console.log('downtimedata', downtimedata);

            const key2 = 'live_reason';
            const entitytype = 'DEVICE';
            const deviceid = deviceId;

            try {
              const response = await telemetrykeydata(deviceid, entitytype, key2, fromEpoch, toEpoch);

              if (
                response &&
                Array.isArray(response.live_reason) &&
                response.live_reason.length > 0
              ) {
                const parsedLiveReasons = response.live_reason.map(entry => {
                  try {
                    const parsedValue = JSON.parse(entry.value);
                    return {
                      ts: entry.ts,
                      ...parsedValue // includes: name, code, mode, module, idle_start
                    };
                  } catch (err) {
                    console.error("Failed to parse live_reason value:", entry.value, err);
                    return null;
                  }
                }).filter(reason => reason !== null);

                // For each item in filteredResult, set reasonselected if match found
                setfilteredResult(prevResults => {
                  return prevResults.map(item => {
                    const matched = parsedLiveReasons.find(reason =>
                      String(reason.ts) === String(item.start)
                    );
                    return {
                      ...item,
                      reasonselected: matched?.name || item.reasonselected || ''
                    };
                  });
                });

              } else {
                console.log("No valid live_reason data found");
              }
            } catch (error) {
              console.error("Error while processing live_reason telemetry:", error);
            }


          })


      }
    } catch (error) {
      console.error('Error fetching downtime data:', error);
    } finally {
      setLoading(false);
    }
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


  // Format seconds to HH:mm:ss
  const formatDuration = (durationInSeconds) => {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = durationInSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  const handleDateChange1 = (newValue) => {
    const dayjsVal = dayjs(newValue);
    setSelectedDate(dayjsVal);

    // Recalculate epoch range when date changes
    if (selectedShift && shifts.length > 0) {
      const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, dayjsVal);
      setEpochRange({ from: fromEpoch, to: toEpoch });
      const key = 'alloperator';
      customerbasedshift(customerId, key)
        .then(async (data) => {
          const allShifts = data[0]?.value || [];
          setoperatorslist(allShifts);
          console.log('alloperator', allShifts);

          // ✅ Filter only "Operator" mode
          const operatorNames = allShifts
            .filter(shift => shift.mode === "Operator")  // <-- filter added
            .map(shift => ({
              value: shift.operatorname,
              label: `${shift.operatorid} - ${shift.operatorname}`
            }));

          setoperators(operatorNames);
          const key2 = 'live_operator';
          const entitytype = 'DEVICE';
          const deviceid = selectedDeviceId;

          try {
            const response = await telemetrykeydata(deviceid, entitytype, key2, fromEpoch, toEpoch);
            //const response = await telemetrylatestdata(deviceid, entitytype, key2);
            if (response && response.live_operator && response.live_operator.length > 0 && response.live_operator[0].value) {
              let operator = JSON.parse(response.live_operator[0].value).operator;
              setselectedoperator(operator);
            } else {
              setselectedoperator('');
            }
          } catch (error) {

            setselectedoperator('');
          }
        })
        .catch(error => {
          console.error("Error fetching shifts:", error);
        });
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
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIframeInteractive(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const commonOptions = [
      { value: 'Component', label: 'Component' },
      { value: 'Reason', label: 'Reason' },
      // { value: 'Supervisor', label: 'Supervisor' },
    ];
    const fallbackOptions =
      cleanCustomerId(customerId) === CUSTOMER_IDS.PMI
        ? commonOptions
        : [{ value: 'Operator', label: 'Operator' }, ...commonOptions];

    setSelectedassignmode(fallbackOptions[0].value)
    setAssignmodes(fallbackOptions);
    const fetchDevices = async () => {
      try {
        const devicesData = await customerbaseddevices(customerId1, 100, 0);
        setDevices(devicesData);

        const sortedDevices = (Array.isArray(devicesData?.data) ? devicesData.data : [])
          .sort((a, b) => a.name.localeCompare(b.name));

        const options = sortedDevices.map(device => ({
          value: device.id?.id || '',
          label: device.name || `Device ${device.id?.id || ''}`
        }));

        if (options.length > 0) {
          setdevicename(options[0]?.label || '');
          setSelectedDevicename(options[0]?.label || '');
          setdeviceid(options[0]?.value || '');
          setSelectedDevice(options[0]?.value || '');
        }

        setDeviceOptions(options);
      } catch (error) {
        console.error('Error fetching devices:', error);
      }
    };

    fetchDevices();

    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().add(7, 'day').endOf('day');
    setStartDateTime(todayStart);
    setEndDateTime(todayEnd);

    if (Deviceid && token) {
      const fromEpoch = todayStart.valueOf();
      const toEpoch = todayEnd.valueOf();
      const keys = cleanCustomerId(customerId) === CUSTOMER_IDS.PMI ? 'live_component' : 'live_operator';
      const entitytype = 'DEVICE';
      const url = `${window._env_.GRAFANA_URL}d/bef32fe1-8f81-4d8e-94c3-9828fe8ec685/operator-dashboard?orgId=1&var-device_id=${Deviceid}&var-entityType=${entitytype}&var-entityId=${Deviceid}&var-token=${token}&var-key=${keys}&from=${fromEpoch}&to=${toEpoch}&kiosk&theme=light`;
      setIframeUrl(url);
      initialLoad.current = false;
    }
  }, [Deviceid, token, customerId1]);

  const getiframedata = async () => {
    const fallbackOptions = [
      // { value: 'Operator', label: 'Operator' },
      { value: 'Component', label: 'Component' },
      { value: 'Reason', label: 'Reason' },
      { value: 'Supervisor', label: 'Supervisor' },
    ];
    setSelectedassignmode(fallbackOptions[0].value);
    setAssignmodes(fallbackOptions);

    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().add(7, 'day').endOf('day');
    setStartDateTime(todayStart);
    setEndDateTime(todayEnd);

    if (token) {
      const fromEpoch = todayStart.valueOf();
      const toEpoch = todayEnd.valueOf();
      let keys;
      let entitytype;
      let entityId;
      let url;

      switch (selectedassignmode) {
        case 'Operator':
          keys = 'live_operator';
          entitytype = 'DEVICE';
          entityId = Deviceid;
          break;
        case 'Supervisor':
          keys = 'live_supervisor';
          entitytype = 'CUSTOMER';
          entityId = cleanCustomerId(customerId);
          break;
        case 'Component':
          keys = 'live_component';
          entitytype = 'DEVICE';
          entityId = Deviceid;
          break;
        case 'Reason':
          keys = 'live_reason';
          entitytype = 'DEVICE';
          entityId = Deviceid;
          break;
        default:
          keys = 'live_component';
          entitytype = 'DEVICE';
          entityId = Deviceid;
      }

      url = `${window._env_.GRAFANA_URL}d/bef32fe1-8f81-4d8e-94c3-9828fe8ec685/operator-dashboard?orgId=1&var-device_id=${entityId}&var-token=${token}&var-key=${keys}&var-entityType=${entitytype}&var-entityId=${entityId}&from=${fromEpoch}&to=${toEpoch}&kiosk&theme=light`;
      setIframeUrl(url);
      initialLoad.current = false;
    }
  };

  useEffect(() => {
    if (devices.length > 0) {
      fetchAverageUtilizationForAllDevices();
    }
  }, [devices, selectedDevice]);

  const fetchAverageUtilizationForAllDevices = async () => {
    try {
      let devicesToFetch = [];

      if (selectedDevice === 'all') {
        devicesToFetch = devices;
      } else {
        devicesToFetch = devices.filter((device) => device.id?.id === selectedDevice);
      }

      const utilizationList = await Promise.all(
        devicesToFetch.map(async (device) => {
          const deviceId = device.id?.id;
          const deviceName = device.name;

          try {
            const response = await telemetrylatestdata(deviceId, 'DEVICE', 'averageUtilization');
            const value = response?.averageUtilization?.[0]?.value || 0;

            return {
              label: deviceName,
              value: parseFloat(value).toFixed(2).toString()
            };
          } catch (err) {
            console.error(`Error fetching utilization for ${deviceName}`, err);
            return {
              label: deviceName,
              value: '0.00'
            };
          }
        })
      );

      setUtilizationData(utilizationList);
      const formatted = encodeURIComponent(JSON.stringify(utilizationList));
      setFormattedUtilization(formatted);
    } catch (error) {
      console.error('Error fetching utilization for selected devices:', error);
    }
  };

  const handleSubmit = () => {
    if (!token || !startDateTime || !endDateTime || !selectedassignmode) return;

    const fromEpoch = startDateTime.valueOf();
    const toEpoch = endDateTime.valueOf();
    let url;
    let keys;
    let entitytype;
    let entityId;

    if (selectedassignmode === 'Operator') {
      keys = 'live_operator';
      entitytype = 'DEVICE';
      entityId = selectedDevice;
    }
    else if (selectedassignmode === 'Supervisor') {
      keys = 'live_supervisor';
      entitytype = 'CUSTOMER';
      entityId = cleanCustomerId(customerId);
      console.log('Supervisor Submit:', { entityId, entitytype, keys, token, fromEpoch, toEpoch });
    }
    else {
      keys = 'live_component';
      entitytype = 'DEVICE';
      entityId = selectedDevice;
    }

    url = `${window._env_.GRAFANA_URL}d/bef32fe1-8f81-4d8e-94c3-9828fe8ec685/operator-dashboard?orgId=1&var-device_id=${entityId}&var-token=${token}&var-key=${keys}&var-entityType=${entitytype}&var-entityId=${entityId}&from=${fromEpoch}&to=${toEpoch}&kiosk&theme=light`;

    setIframeUrl(url);
    setIframeKey(prevKey => prevKey + 1);
    initialLoad.current = false;
  };
  const isOvernight = (shift) => {
    const start = dayjs(shift.start_time, 'HH:mm:ss');
    const end = dayjs(shift.end_time, 'HH:mm:ss');
    return end.isBefore(start);
  };
  const handleSaveThreshold = async () => {
    if (savingStates.operator) return;
    setSavingStates(prev => ({ ...prev, operator: true }));
    try {
      const dateError = validateDate(selectedDate);
      if (dateError) {
        setDateErrors(prev => ({ ...prev, operator: dateError }));
        Swal.fire('Error', dateError, 'error');
        return;
      }
      const startError = validateStartTime(startTime);
      const endError = validateEndTime(endTime);
      if (startError || endError) {
        setTimeErrors({ startTime: startError, endTime: endError });
        Swal.fire('Error', 'Please fix time validation errors.', 'error');
        return;
      }

      if (!selectedDeviceId || !selectedShift || !selectedDate || !selectedOperatorId) {
        Swal.fire('Error', 'Please fill all required fields.', 'error');
        return;
      }

      const selectedShiftData = shifts.find(shift => shift.shift_no === selectedShift);
      if (!selectedShiftData) {
        Swal.fire('Error', 'Selected shift not found.', 'error');
        return;
      }
      const fromDateTime = getAdjustedDateTime(startTime, selectedDate, selectedShiftData);
      const toDateTime = getAdjustedDateTime(endTime, selectedDate, selectedShiftData);

      if (!fromDateTime || !toDateTime) {
        Swal.fire('Error', 'Invalid time selection. Please check start and end times.', 'error');
        return;
      }

      const fromEpoch = fromDateTime.valueOf();
      const toEpoch = toDateTime.valueOf();

      if (fromEpoch >= toEpoch) {
        Swal.fire('Error', 'Start time must be before end time.', 'error');
        return;
      }

      const durations = Math.floor((toEpoch - fromEpoch) / 1000);
      const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
      const fromtime = shiftEpoch.fromEpoch;
      const totime = shiftEpoch.toEpoch;

      if (!fromtime || !totime) {
        Swal.fire('Error', 'Unable to determine shift boundaries.', 'error');
        return;
      }

      // Find the selected operator
      const selectedOperator = operatorslist.find(op => op.operatorid === selectedOperatorId);
      if (!selectedOperator) {
        Swal.fire('Error', 'Selected operator not found.', 'error');
        return;
      }

      // Check for overlapping entries
      const response = await telemetrykeydata(
        selectedDeviceId,
        'DEVICE',
        'live_operator',
        fromtime,
        totime
      );

      const existingEntries = response?.live_operator || [];
      const overlapping = [];

      for (const item of existingEntries) {
        if (!item?.value) continue;
        let parsed;
        try {
          parsed = JSON.parse(item.value);
        } catch {
          continue;
        }
        const existingStart = parsed.start_time || item.ts;
        const existingEnd =
          parsed.end_time ||
          (existingStart + (parsed.duration || 0) * 1000);
        const isOverlapping = fromEpoch < existingEnd && existingStart < toEpoch;
        if (isOverlapping) {
          overlapping.push({ item, parsed, existingStart, existingEnd });
        }
      }
      if (overlapping.length > 0) {
        setOpenEditDialog(false);
        const overlapDetails = overlapping.map(overlap => {
          const existingOperator = overlap.parsed.name || 'Unknown';
          const conflictStart = dayjs(overlap.existingStart).format('DD-MM-YYYY HH:mm:ss');
          const conflictEnd = dayjs(overlap.existingEnd).format('DD-MM-YYYY HH:mm:ss');
          return `"<strong>${existingOperator}</strong>" between <strong>${conflictStart}</strong> and <strong>${conflictEnd}</strong>.`;
        }).join('<br>');
        const result1 = await Swal.fire({
          icon: 'error',
          title: 'Error',
          html: `Time overlaps with existing operator ${overlapDetails}`,
          showCancelButton: true,
          confirmButtonText: 'Overwrite',
          cancelButtonText: 'No, Cancel',
          backdrop: true,
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false
        });

        if (!result1.isConfirmed) {
          console.log("User cancelled overwrite.");
          return;
        }
        const result2 = await Swal.fire({
          title: 'Confirm Overwrite',
          text: 'Do you want to overwrite the existing operator allocation with the new changes?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, Save',
          cancelButtonText: 'No, Cancel',
          backdrop: true,
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false
        });

        if (!result2.isConfirmed) {
          console.log("User cancelled save.");
          return;
        }
        for (const overlap of overlapping) {
          const { parsed, existingStart, existingEnd } = overlap;
          if (fromEpoch > existingStart && toEpoch < existingEnd) {
            const leftDuration = Math.floor((fromEpoch - existingStart) / 1000);
            const rightDuration = Math.floor((existingEnd - toEpoch) / 1000);
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_operator', existingStart, existingEnd);
            const leftKey = {
              ts: existingStart,
              values: {
                live_operator: {
                  ...parsed,
                  start_time: existingStart,
                  end_time: fromEpoch,
                  duration: leftDuration,
                },
              },
            };
            await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', leftKey);
            const rightKey = {
              ts: toEpoch,
              values: {
                live_operator: {
                  ...parsed,
                  start_time: toEpoch,
                  end_time: existingEnd,
                  duration: rightDuration,
                },
              },
            };
            await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', rightKey);
          }
          else if (fromEpoch <= existingStart && toEpoch > existingStart && toEpoch < existingEnd) {
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_operator', existingStart, existingEnd);

            const newStart = toEpoch;
            const newDuration = Math.floor((existingEnd - newStart) / 1000);
            const updatedKey = {
              ts: newStart,
              values: {
                live_operator: {
                  ...parsed,
                  start_time: newStart,
                  end_time: existingEnd,
                  duration: newDuration,
                },
              },
            };
            await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', updatedKey);
          }
          else if (fromEpoch > existingStart && fromEpoch < existingEnd && toEpoch >= existingEnd) {
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_operator', existingStart, existingEnd);
            const newEnd = fromEpoch;
            const newDuration = Math.floor((newEnd - existingStart) / 1000);
            const updatedKey = {
              ts: existingStart,
              values: {
                live_operator: {
                  ...parsed,
                  start_time: existingStart,
                  end_time: newEnd,
                  duration: newDuration,
                },
              },
            };
            await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', updatedKey);
          }
          else if (fromEpoch <= existingStart && toEpoch >= existingEnd) {
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_operator', existingStart, existingEnd);
          }
        }
        try {
          const now = Date.now();
          const key = {
            ts: fromEpoch || now,
            values: {
              live_operator: {
                name: selectedOperator.operatorname,
                code: selectedOperatorId,
                start_time: fromEpoch,
                end_time: toEpoch,
                duration: durations
              }
            }
          };

          await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
          setDeviceThresholds(prev => ({
            ...prev,
            [selectedDeviceId.id || selectedDeviceId]: selectedOperator.operatorname,
          }));

          Swal.fire({
            title: 'Success',
            text: 'Operator assigned successfully.',
            icon: 'success',
            backdrop: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            allowEnterKey: false
          });
          setTimeout(() => {
            handleSubmit();
          }, 2000);
          return;
        } catch (error) {
          console.error('Error saving operator:', error);
          Swal.fire('Error', 'Failed to assign operator.', 'error');
          return;
        }
      }

      // ✅ Proceed to save if no overlap
      const now = Date.now();
      const key = {
        // ts: fromEpoch > now ? fromEpoch : now,
        ts: fromEpoch || now,
        values: {
          live_operator: {
            name: selectedOperator.operatorname,
            code: selectedOperatorId,
            start_time: fromEpoch,
            end_time: toEpoch,
            duration: durations
          }
        }
      };

      await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);

      setDeviceThresholds(prev => ({
        ...prev,
        [selectedDeviceId.id || selectedDeviceId]: selectedOperator.operatorname
      }));

      Swal.fire('Success', 'Operator assigned successfully.', 'success');
      setTimeout(() => {
        handleSubmit();
      }, 2000);
    } catch (err) {
      console.error('Update error:', err);
      Swal.fire('Error', 'Failed to assign operator.', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, operator: false }));
      setOpenEditDialog(false);
    }
  };
  const handleSaveThreshold1 = async () => {
 
    if (savingComponent) {
      return;
    }
    if (selectedDate && !selectedDate.isValid()) {
      Swal.fire('Error', 'Invalid date format. Please select a valid date.', 'error');
      return;
    }

    if (startTime && !startTime.isValid()) {
      Swal.fire('Error', 'Invalid start time format. Please select a valid time.', 'error');
      return;
    }

    if (endTime && !endTime.isValid()) {
      Swal.fire('Error', 'Invalid end time format. Please select a valid time.', 'error');
      return;
    }

    if (startTime && endTime && startTime.isSame(endTime, 'second')) {
      Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
      return;
    }

    const hasErrors = timeErrors.startTime || timeErrors.endTime;
    if (hasErrors) {
      Swal.fire('Error', 'Please fix the time validation errors before saving.', 'error');
      return;
    }

    if (!selectedDeviceId || !selectedShift || !selectedDate || !selectedComponentId) {
      Swal.fire('Error', 'Please fill all required fields.', 'error');
      return;
    }

    const selectedShiftData = shifts.find(shift => shift.shift_no === selectedShift);
    if (!selectedShiftData) {
      Swal.fire('Error', 'Selected shift not found.', 'error');
      return;
    }

    const component = componentslist.find(comp => comp.id === selectedComponentId);
    if (!component) {
      Swal.fire('Error', 'Selected component not found.', 'error');
      return;
    }

    // Set saving state
    setSavingComponent(true);

    try {
      const componentName = component.component_name;
      const componentNumber = component.component_number || null;
      const cycleTime = component.cycle_time || null;
      const handlingTime = component.handling_time || null;
      const setupTime = component.setupTime || null;
      const factorValue = component.factorval || null;
      const factors = component.factor || null;

      const fromDateTime = getAdjustedDateTime(startTime, selectedDate, selectedShiftData);
      const toDateTime = getAdjustedDateTime(endTime, selectedDate, selectedShiftData);

      if (!fromDateTime || !toDateTime) {
        Swal.fire('Error', 'Invalid time selection. Please check start and end times.', 'error');
        return;
      }

      const fromEpoch = fromDateTime.valueOf();
      const toEpoch = toDateTime.valueOf();

      if (fromEpoch >= toEpoch) {
        Swal.fire('Error', 'Start time must be before end time.', 'error');
        return;
      }

      const durations = Math.floor((toEpoch - fromEpoch) / 1000);
      const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
      const fromtime = shiftEpoch.fromEpoch;
      const totime = shiftEpoch.toEpoch;

      if (!fromtime || !totime) {
        Swal.fire('Error', 'Unable to determine shift boundaries.', 'error');
        return;
      }

      // Check for overlapping entries within the shift period
      const response = await telemetrykeydata(
        selectedDeviceId,
        'DEVICE',
        'live_component',
        fromtime,
        totime
      );

      const existingEntries = response?.live_component || [];
      const overlapping = [];

      for (const item of existingEntries) {
        if (!item?.value) continue;
        let parsed;
        try {
          parsed = JSON.parse(item.value);
        } catch {
          continue;
        }
        const existingStart = parsed.start_time || item.ts;
        const existingEnd = parsed.end_time || (existingStart + (parsed.duration || 0) * 1000);
        const isOverlapping = fromEpoch < existingEnd && existingStart < toEpoch;
        if (isOverlapping) {
          overlapping.push({ item, parsed, existingStart, existingEnd });
        }
      }

      // If there are overlaps, show confirmation dialog
      if (overlapping.length > 0) {
        // Close the main dialog first
        setOpenEditDialog1(false);

        const overlapDetails = overlapping.map(overlap => {
          const existingComponent = overlap.parsed.name || 'Unknown';
          const conflictStart = dayjs(overlap.existingStart).format('DD-MM-YYYY HH:mm:ss');
          const conflictEnd = dayjs(overlap.existingEnd).format('DD-MM-YYYY HH:mm:ss');
          return `"<strong>${existingComponent}</strong>" between <strong>${conflictStart}</strong> and <strong>${conflictEnd}</strong>.`;
        }).join('<br>');

        // Show confirmation dialog for overwrite
        const result1 = await Swal.fire({
          icon: 'error',
          title: 'Error',
          html: `Time overlaps with existing component ${overlapDetails}`,
          showCancelButton: true,
          confirmButtonText: 'Overwrite',
          cancelButtonText: 'No, Cancel',
          backdrop: true,
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false
        });

        if (!result1.isConfirmed) {
          console.log("User cancelled overwrite.");
          setSavingComponent(false);
          return;
        }

        // Show second confirmation
        const result2 = await Swal.fire({
          title: 'Confirm Overwrite',
          text: 'Do you want to overwrite the existing component allocation with the new changes?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, Save',
          cancelButtonText: 'No, Cancel',
          backdrop: true,
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false
        });

        if (!result2.isConfirmed) {
          console.log("User cancelled save.");
          setSavingComponent(false);
          return;
        }

        // Handle the overlap cases
        for (const overlap of overlapping) {
          const { parsed, existingStart, existingEnd } = overlap;
          if (fromEpoch > existingStart && toEpoch < existingEnd) {
            const leftDuration = Math.floor((fromEpoch - existingStart) / 1000);
            const rightDuration = Math.floor((existingEnd - toEpoch) / 1000);
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_component', existingStart, existingEnd);
            if (leftDuration > 0) {
              const leftKey = {
                ts: existingStart,
                values: {
                  live_component: {
                    ...parsed,
                    start_time: existingStart,
                    end_time: fromEpoch,
                    duration: leftDuration,
                  },
                },
              };
              await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', leftKey);
            }
            if (rightDuration > 0) {
              const rightKey = {
                ts: toEpoch,
                values: {
                  live_component: {
                    ...parsed,
                    start_time: toEpoch,
                    end_time: existingEnd,
                    duration: rightDuration,
                  },
                },
              };
              await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', rightKey);
            }
          }
          else if (fromEpoch <= existingStart && toEpoch > existingStart && toEpoch < existingEnd) {
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_component', existingStart, existingEnd);
            const newStart = toEpoch;
            const newDuration = Math.floor((existingEnd - newStart) / 1000);
            if (newDuration > 0) {
              const updatedKey = {
                ts: newStart,
                values: {
                  live_component: {
                    ...parsed,
                    start_time: newStart,
                    end_time: existingEnd,
                    duration: newDuration,
                  },
                },
              };
              await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', updatedKey);
            }
          }
          else if (fromEpoch > existingStart && fromEpoch < existingEnd && toEpoch >= existingEnd) {
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_component', existingStart, existingEnd);
            const newEnd = fromEpoch;
            const newDuration = Math.floor((newEnd - existingStart) / 1000);
            if (newDuration > 0) {
              const updatedKey = {
                ts: existingStart,
                values: {
                  live_component: {
                    ...parsed,
                    start_time: existingStart,
                    end_time: newEnd,
                    duration: newDuration,
                  },
                },
              };
              await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', updatedKey);
            }
          }
          else if (fromEpoch <= existingStart && toEpoch >= existingEnd) {
            await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_component', existingStart, existingEnd);
          }
        }

        // Save the new component assignment after handling overlaps
        try {
          const now = Date.now();
          const key = {
            ts: fromEpoch || now,
            values: {
              live_component: {
                name: componentName,
                code: componentNumber,
                start_time: fromEpoch,
                end_time: toEpoch,
                duration: durations,
                cycle_time: cycleTime,
                handling_time: handlingTime,
                setup_time: setupTime,
                factorval: factorValue,
                factor: factors,
              },
            },
          };

          await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
          setDeviceThresholds(prev => ({
            ...prev,
            [selectedDeviceId.id || selectedDeviceId]: componentName,
          }));

          Swal.fire({
            title: 'Success',
            text: 'Component assigned successfully.',
            icon: 'success',
            backdrop: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            allowEnterKey: false
          });

          setTimeout(() => {
            handleSubmit();
          }, 2000);

          return;
        } catch (error) {
          console.error('Error saving component:', error);
          Swal.fire('Error', 'Failed to assign component.', 'error');
          return;
        } finally {
          setSavingComponent(false);
        }
      }

      // ✅ Proceed to save if no overlap
      try {
        const now = Date.now();
        const key = {
          ts: fromEpoch || now,
          values: {
            live_component: {
              name: componentName,
              code: componentNumber,
              start_time: fromEpoch,
              end_time: toEpoch,
              duration: durations,
              cycle_time: cycleTime,
              handling_time: handlingTime,
              setup_time: setupTime,
              factorval: factorValue,
              factor: factors,
            },
          },
        };

        console.log(key, 'payload for component');

        // Uncomment when ready to save
        await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
        setDeviceThresholds(prev => ({
          ...prev,
          [selectedDeviceId.id || selectedDeviceId]: componentName,
        }));

        Swal.fire({
          title: 'Success',
          text: 'Component assigned successfully.',
          icon: 'success',
          backdrop: true,
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false
        });

        setTimeout(() => {
          handleSubmit();
        }, 2000);

      } catch (error) {
        console.error('Error saving component:', error);
        Swal.fire('Error', 'Failed to assign component.', 'error');
      } finally {
        setSavingComponent(false);
        handleCloseComponentDialog();
      }

    } catch (error) {
      console.error('Error in component assignment:', error);
      Swal.fire('Error', 'An error occurred while assigning component.', 'error');
      setSavingComponent(false);
    }
  };
  const handleCloseComponentDialog = () => {
    setOpenEditDialog1(false);
    setselectedcomponent('');
    setSelectedComponentId('');
    setSavingComponent(false); // Reset saving state
    setTimeErrors({ startTime: '', endTime: '' }); // Also reset errors
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

  const handleSaveThreshold2 = async () => {
    if (
      !startTime || !endTime ||
      !isTimeInShift(startTime, selectedShiftData) ||
      !isTimeInShift(endTime, selectedShiftData)
    ) {
      setOpenEditDialog(false);
      setOpenEditDialog1(false);
      setOpenEditDialog4(false);
      Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
      return;
    }
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
          ts: item.start,  // This becomes the top-level "ts" field
          values: {
            live_reason: {
              name: item.reasonselected,
              code: code,
              mode: mode,
              category: category,
              idle_start: item.start,
              idle_end: item.end,
              idle_duration: item.duration
              // idle_start can be same as item.start or adjusted as needed

            }
          }
        };


        await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);

        // Optional: Update UI state to reflect change
        setDeviceThresholds(prev => ({
          ...prev,
          [selectedDeviceId.id || selectedDeviceId]: item.reasonselected
        }));
      }

      Swal.fire('Success', 'Reasons assigned successfully.', 'success');

    } catch (err) {
      console.error('Update error:', err);
      Swal.fire('Error', 'Failed to assign reason.', 'error');
    } finally {
      setOpenEditDialog2(false);
    }
  };

  const handleAssignModeChange = (e) => {
    setSelectedassignmode(e.target.value);
  };
  const handleFormChange2 = (event) => {
    const { name, value } = event.target;
    setselectedcomponent(value);
  };

  const isShiftOvernight = (shift) => {
    if (!shift) return false;
    if (parseInt(shift.start_day) !== parseInt(shift.end_day)) return true;
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const [endHour, endMin] = shift.end_time.split(':').map(Number);
    if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
      return true;
    }
    return false;
  };

  const getShiftBoundaries = (shift, baseDate) => {
    if (!shift) return { shiftStart: null, shiftEnd: null };
    const startDay = parseInt(shift.start_day);
    const endDay = parseInt(shift.end_day);
    const isOvernight = isShiftOvernight(shift);
    const [startHour, startMinute, startSecond] = shift.start_time.split(':').map(Number);
    const [endHour, endMinute, endSecond] = shift.end_time.split(':').map(Number);
    let shiftStart = dayjs(baseDate)
      .add(startDay - 1, 'day')
      .set('hour', startHour)
      .set('minute', startMinute)
      .set('second', startSecond || 0)
      .set('millisecond', 0);;
    let shiftEnd = dayjs(baseDate)
      .add(endDay - 1, 'day')
      .set('hour', endHour)
      .set('minute', endMinute)
      .set('second', endSecond || 0)
      .set('millisecond', 0);
    return { shiftStart, shiftEnd };
  };

  const getAdjustedDateTime = (timeValue, selectedDate, shift) => {
    if (!timeValue || !shift) return null;
    const startDay = parseInt(shift.start_day);
    const endDay = parseInt(shift.end_day);
    const isOvernight = isShiftOvernight(shift);
    let datetime = dayjs(selectedDate)
      .set('hour', timeValue.hour())
      .set('minute', timeValue.minute())
      .set('second', timeValue.second())
      .set('millisecond', 0); 
    const { shiftStart, shiftEnd } = getShiftBoundaries(shift, selectedDate);
    if (startDay > 1 && endDay > 1) {
      datetime = datetime.add(startDay - 1, 'day');
    }
    else if (isOvernight && startDay === 1 && endDay === 2) {
      if (timeValue.hour() < 12) {
        datetime = datetime.add(1, 'day');
      }
    }
    else if (isOvernight) {
      const startHour = parseInt(shift.start_time.split(':')[0]);
      const endHour = parseInt(shift.end_time.split(':')[0]);
      if (startHour >= 18 && timeValue.hour() < 12) {
        datetime = datetime.add(1, 'day');
      }
    }
    return datetime;
  };

  const selectedShiftData = shifts.find(shift => shift.shift_no === selectedShift);
  return (
    <div className="pages">
      <div className="pagecontents">
        <br></br>
        {/* <div className="left-labels" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h5>Machine Name : {selectedDevicename}</h5>
        </div> */}
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
            <DateTimePicker
              label="Start Date & Time *"
              value={startDateTime}
              onChange={(newValue) => setStartDateTime(newValue)}
              ampm={false}
              required={true}
              format="DD-MM-YYYY HH:mm:ss"
              views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
              inputFormat="DD-MM-YYYY HH:mm:ss"
              renderInput={(params) => <TextField {...params} required />}
              sx={{
                width: 250,
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
            <DateTimePicker
              label="End Date & Time *"
              value={endDateTime}
              required={true}
              onChange={(newValue) => setEndDateTime(newValue)}
              ampm={false}
              format="DD-MM-YYYY HH:mm:ss"
              views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
              inputFormat="DD-MM-YYYY HH:mm:ss"
              renderInput={(params) => <TextField {...params} required />}
              sx={{
                width: 250,
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
            <CustomDaySelect
              name="Assigns"
              value={selectedassignmode}
              onChange={(e) => setSelectedassignmode(e.target.value)}
              label="Select Assigns"
              required={true}
              options={Assignmodes}
              sx={{
                width: 250,
              }}
            />
            {(selectedassignmode === 'Operator' || selectedassignmode === 'Component' || selectedassignmode === 'Reason') && (

              <CustomDaySelect
                name="device"
                value={selectedDevice}
                onChange={(e) => {
                  setSelectedDevice(e.target.value);
                  // Find the selected device's name from deviceOptions
                  const selected = deviceOptions.find(opt => opt.value === e.target.value);
                  setSelectedDevicename(selected ? selected.label : '');
                }}
                label="Select Machine"
                required={true}
                options={deviceOptions}
                sx={{
                  width: 250,
                }}
              />
            )}

            <Button
              variant="contained"
              color="warning"
              className="filter_btn btn_orange"
              onClick={handleSubmit}
            >
              Submit
            </Button>

            {selectedassignmode === 'Operator' && (
              <Button
                variant="contained"
                color="secondary"
                className="filter_btn btn_blue"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditDialog(selectedDevicename, selectedDevice);
                }}
              >
                Assign Operator
              </Button>
            )}

            {selectedassignmode === 'Component' && (
              <Button
                variant="contained"
                color="secondary"
                className="filter_btn btn_green"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditDialog1(selectedDevicename, selectedDevice);
                }}
              >
                Assign Component
              </Button>
            )}
            {selectedassignmode === 'Reason' && (
              <Button
                variant="contained"
                color="secondary"
                className="filter_btn btn_green"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditDialog2(selectedDevicename, selectedDevice);
                }}
              >
                Assign Reason
              </Button>
            )}
            {selectedassignmode === 'Supervisor' && (
              <Button
                variant="contained"
                color="secondary"
                className="filter_btn btn_blue"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditDialog4();
                }}
              >
                Assign Supervisor
              </Button>
            )}
          </div>
        </LocalizationProvider>

        {/* Conditional Assign Buttons */}


        {iframeUrl && (selectedassignmode != 'Reason') && (
          <div style={{ position: 'relative' }}>
            <iframe
              key={iframeKey}
              src={iframeUrl}
              height="900"
              title="Operator Dashboard"
              allowFullScreen
              width="100%"
              frameBorder="0"
              style={{ pointerEvents: iframeInteractive ? 'auto' : 'none' }}
            />

            <div //0ee
              style={{
                position: 'absolute',
                top: 2,
                right: 14,
                width: 80,
                height: 40,
                backgroundColor: 'transparent',
                zIndex: 10
              }}
            />
          </div>
        )}
      </div>
      <Dialog
        open={openEditDialog}
        onClose={(event, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
            setOpenEditDialog(false);
          }
        }}
        disableEscapeKeyDown={true}
        sx={{
          '& .MuiDialog-paper': {
            width: '700px',
            maxWidth: '700px'
          }
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 0 24px' }}>
          <DialogTitle sx={{ padding: 0 }}>Assign Operator</DialogTitle>
          {/* <VisibilityIcon
    style={{ cursor: 'pointer', color: '#1976d2' }}
    onClick={(e) => {
      e.stopPropagation();
      handleViewClick(selectedDeviceId, selectedDevicename);
    }}
    titleAccess="View Operator"

  /> */}
        </div>

        <DialogContent>
          <br></br>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <CustomDateSelect
                name="selectedDate"
                label="Select Date"
                required
                value={selectedDate}
                onChange={(e) => {
                  handleDateChange(e);
                  handleOperatorChange1(e);
                }}
                format="DD-MM-YYYY"
                minDate={dayjs()} // ✅ Allows today
                maxDate={dayjs().add(7, 'day')} // ✅ Allows up to 7 days from today
                slotProps={{
                  textField: {
                    sx: { width: '100%' },
                    error: !!dateErrors.operator,
                    helperText: dateErrors.operator || '',
                  },
                }}
              />
            </LocalizationProvider>
            <CustomDaySelect
              name="shift_no"
              value={selectedShift}
              onChange={(e) => {
                const value = e.target.value;
                handleShiftChange(value);     // First function
                operatorvaluechange(value);       // Second function
              }}
              label="Select Shift"
              required
              options={shiftOptions}

            />
            {/* <CustomDaySelect
              name="operatorselected"
              value={operatorselected}
              onChange={handleFormChange}
              label="Select Operator"
              required={true}
              options={operators}
              error={!operatorselected}
              ref={customDaySelectRef}
            /> */}
            <Autocomplete
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: 'orange',
                  },
                  '&.Mui-focused .MuiOutlinedInput-input': {
                    caretColor: 'orange',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'orange',
                },
              }}
              options={operators}
              getOptionLabel={(option) => option.label}
              value={operators.find(c => c.id === selectedOperatorId) || null}
              onChange={handleOperatorChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Operator"
                  required
                  error={!selectedOperatorId}
                  helperText={!selectedOperatorId ? 'Operator is required' : ''}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              autoHighlight
              filterSelectedOptions
              componentsProps={{ popper: { style: { minWidth: 'fit-content' } } }}
            />

          </div>
          <br></br>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <FormControl fullWidth error={!!timeErrors.startTime}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopTimePicker
                  value={startTime}
                  onChange={(value) => handleTimeChange('start', value, 'operator')}
                  label="Start Time *"
                  views={['hours', 'minutes', 'seconds']}
                  openTo="hours"
                  format="hh:mm:ss A"
                  slotProps={{
                    textField: {
                      error: !!timeErrors.startTime,
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: timeErrors.startTime ? 'red' : 'black' },
                      '&:hover fieldset': { borderColor: timeErrors.startTime ? 'red' : 'black' },
                      '&.Mui-focused fieldset': { borderColor: timeErrors.startTime ? 'red' : 'orange' },
                    },
                  }}
                />
              </LocalizationProvider>
              <FormHelperText>
                {timeErrors.startTime || " "}
              </FormHelperText>
            </FormControl>

            <FormControl fullWidth error={!!timeErrors.endTime}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopTimePicker
                  value={endTime}
                  onChange={(value) => handleTimeChange('end', value, 'operator')}
                  label="End Time *"
                  views={['hours', 'minutes', 'seconds']}
                  openTo="hours"
                  format="hh:mm:ss A"
                  slotProps={{
                    textField: {
                      error: !!timeErrors.endTime,
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: timeErrors.endTime ? 'red' : 'black' },
                      '&:hover fieldset': { borderColor: timeErrors.endTime ? 'red' : 'black' },
                      '&.Mui-focused fieldset': { borderColor: timeErrors.endTime ? 'red' : 'orange' },
                    },
                  }}
                />
              </LocalizationProvider>
              <FormHelperText>
                {timeErrors.endTime || " "}
              </FormHelperText>
            </FormControl>
          </div>
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            className="filter_btn btn_orange"
            sx={{ backgroundColor: '#ff9800' }}
            onClick={handleSaveThreshold}
            disabled={
              savingStates.operator ||
              !selectedOperatorId ||
              !startTime ||
              !endTime ||
              timeErrors.startTime ||
              timeErrors.endTime ||
              dateErrors.operator ||
              !selectedDate?.isValid()
            }
          >
            {savingStates.operator ? 'Saving...' : 'Save'}
          </Button>        </DialogActions>
      </Dialog>


      <Dialog
        open={openEditDialog1}
        onClose={(event, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
            setOpenEditDialog(false);
          }
        }}
        disableEscapeKeyDown={true}
        disableBackdropClick={savingComponent}
        sx={{
          '& .MuiDialog-paper': {
            width: '700px',
            maxWidth: '700px'
          }
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 0 24px' }}>
          <DialogTitle sx={{ padding: 0 }}>Assign Component</DialogTitle>
        </div>

        <DialogContent>
          <br></br>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <CustomDateSelect
                name="selectedDate"
                label="Select Date"
                required
                value={selectedDate}
                onChange={(e) => {
                  handleDateChange(e);
                  handleOperatorChange1(e);
                }}
                format="DD-MM-YYYY"
                minDate={dayjs()} // ✅ Allows today
                maxDate={dayjs().add(7, 'day')} // ✅ Allows up to 7 days from today
                slotProps={{
                  textField: {
                    sx: {
                      width: '100%',
                    },
                    error: selectedDate && !selectedDate.isValid(),
                    helperText: selectedDate && !selectedDate.isValid() ? 'Invalid date format' : '',
                  },
                }}
              />
            </LocalizationProvider>
            <CustomDaySelect
              name="shift_no"
              value={selectedShift}
              onChange={(e) => {
                const value = e.target.value;
                handleShiftChange(value);     // First function
                operatorvaluechange1(value);       // Second function
              }}
              label="Select Shift"
              required
              options={shiftOptions}
            />
            {/* <CustomDaySelect
              name="componentselected"
              value={componentselected}
              onChange={handleFormChange2}
              label="Select Component"
              required={true}
              options={components}
              error={!componentselected}
              ref={customDaySelectRef}
            /> */}
            <Autocomplete
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': { borderColor: 'orange' },
                  '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'orange' },
              }}
              options={components}
              getOptionLabel={(option) => option.label}
              value={components.find(c => c.id === selectedComponentId) || null}
              onChange={(event, newValue) => {
                if (newValue) {
                  setselectedcomponent(newValue.value);
                  setSelectedComponentId(newValue.id);
                } else {
                  setselectedcomponent('');
                  setSelectedComponentId('');
                }
              }}
              isOptionEqualToValue={(option, value) => {
                if (!option || !value) return false;
                return option.id === value.id;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Component"
                  required
                  error={!selectedComponentId}
                  helperText={!selectedComponentId ? 'Component is required' : ''}
                />
              )}
              autoHighlight
              filterSelectedOptions
              componentsProps={{ popper: { style: { width: 'fit-content' } } }}
            />
          </div>
          <br></br>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <FormControl fullWidth error={!!timeErrors.startTime}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopTimePicker
                  label="Start Time *"
                  value={startTime}
                  onChange={handleStartTimeChange1}
                  views={['hours', 'minutes', 'seconds']}
                  openTo="hours"
                  format="hh:mm:ss A"
                  minTime={
                    selectedShiftData && !isOvernight(selectedShiftData)
                      ? dayjs().isSame(selectedDate, 'day')
                        ? dayjs()
                        : dayjs(selectedShiftData.start_time, 'HH:mm:ss')
                      : undefined
                  }
                  maxTime={
                    selectedShiftData && !isOvernight(selectedShiftData)
                      ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
                      : undefined
                  }
                  slotProps={{
                    textField: {
                      error: !!timeErrors.startTime,
                      sx: {
                        '& fieldset': { borderColor: timeErrors.startTime ? 'red' : 'black' },
                        '&:hover fieldset': { borderColor: timeErrors.startTime ? 'red' : 'black' },
                        '&.Mui-focused fieldset': { borderColor: timeErrors.startTime ? 'red' : 'orange' },
                      }
                    }
                  }}
                />
              </LocalizationProvider>
              <FormHelperText>
                {timeErrors.startTime || " "}
              </FormHelperText>
            </FormControl>

            <FormControl fullWidth error={!!timeErrors.endTime}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopTimePicker
                  label="End Time *"
                  value={endTime}
                  onChange={handleEndTimeChange1}
                  views={['hours', 'minutes', 'seconds']}
                  openTo="hours"
                  format="hh:mm:ss A"
                  minTime={startTime || (
                    selectedShiftData && !isOvernight(selectedShiftData)
                      ? dayjs().isSame(selectedDate, 'day')
                        ? dayjs()
                        : dayjs(selectedShiftData.start_time, 'HH:mm:ss')
                      : undefined
                  )}
                  maxTime={
                    selectedShiftData && !isOvernight(selectedShiftData)
                      ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
                      : undefined
                  }
                  slotProps={{
                    textField: {
                      error: !!timeErrors.endTime,
                      sx: {
                        '& fieldset': { borderColor: timeErrors.endTime ? 'red' : 'black' },
                        '&:hover fieldset': { borderColor: timeErrors.endTime ? 'red' : 'black' },
                        '&.Mui-focused fieldset': { borderColor: timeErrors.endTime ? 'red' : 'orange' },
                      }
                    }
                  }}
                />
              </LocalizationProvider>
              <FormHelperText>
                {timeErrors.endTime || " "}
              </FormHelperText>
            </FormControl>
          </div>
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog1(false)}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            className="filter_btn btn_orange"
            sx={{ backgroundColor: '#ff9800' }}
            onClick={handleSaveThreshold1}
            disabled={savingComponent || !selectedComponentId || !startTime || !endTime || timeErrors.startTime || timeErrors.endTime || !selectedDate?.isValid()}
          >
            {savingComponent ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={openEditDialog2}
        onClose={(event, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
            setOpenEditDialog2(false);
          }
        }}
        sx={{
          '& .MuiDialog-paper': {
            width: '70%',
            maxWidth: '70%'
          }
        }}
      >
        <DialogTitle>Assign Reason</DialogTitle>
        <DialogContent>
          <br></br>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <CustomDateSelect
                name="selectedDate"
                label="Select Date"
                required
                value={selectedDate}
                onChange={handleDateChange1}
                format="DD-MM-YYYY"
                maxDate={dayjs()} // <-- Disallow future dates
              />
            </LocalizationProvider>
            <CustomDaySelect
              name="shift_no"
              value={selectedShift}
              onChange={(e) => handleShiftChange(e.target.value)}
              label="Select Shift"
              required
              options={shiftOptions}
            />
            <Button
              type="submit"
              variant="contained"
              className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }}
              onClick={() => downtimereason()}
            >
              Submit
            </Button>
          </div>
          {filteredResult.length > 0 ? (
            <div style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2' }}>
                    <th style={{ border: '1px solid #ccc', padding: '8px' }}>Start Time (IST)</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px' }}>End Time (IST)</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px' }}>Duration</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px' }}>Status</th>
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
                      <td>
                        <CustomDaySelect
                          name={`reasonselected-${index}`}
                          value={item.reasonselected || ''}
                          onChange={(e) => handleReasonChange(index, e.target.value)}
                          label="Select Reason"
                          required={true}
                          options={reasons}
                          error={!item.reasonselected}
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


          {/* <CustomDaySelect
                            name="reasonselected"
                            value={reasonselected}
                            onChange={handleFormChange1}
                            label="Select Reason"
                            required={true}
                            options={reasons}
                            error={!reasonselected}
                            ref={customDaySelectRef}
                        /> */}
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => cancelreason()}>Cancel</Button>
          <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold2}>Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={OpenEditDialog4}
        onClose={() => setOpenEditDialog4(false)}

        disableEscapeKeyDown={true}
        sx={{
          '& .MuiDialog-paper': {
            width: '700px',
            maxWidth: '700px'
          }
        }}
      >
        <DialogTitle>Assign Supervisor</DialogTitle>
        <DialogContent>
          <br></br>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <CustomDateSelect
                  name="selectedDate"
                  label="Select Date"
                  required
                  value={selectedDate}
                  onChange={(e) => {
                    handleDateChange(e);
                    handleOperatorChange1(e);
                  }}
                  format="DD-MM-YYYY"
                  minDate={dayjs()}
                  maxDate={dayjs().add(7, 'day')}
                  slotProps={{
                    textField: {
                      sx: { width: '100%' },
                      error: !!dateErrors.supervisor,
                      helperText: dateErrors.supervisor || '',
                    },
                  }}
                />
              </LocalizationProvider>
            </LocalizationProvider>
            <CustomDaySelect
              name="shift_no"
              value={selectedShift}
              onChange={(e) => {
                const value = e.target.value;
                handleShiftChange(value);     // First function
                operatorvaluechange2(value);       // Second function
              }}
              label="Select Shift"
              required
              options={shiftOptions}
            />
            <CustomDaySelect
              name="supervisorselected"
              value={supervisorselected}
              onChange={handleFormChange3}
              label="Select Supervisor"
              required={true}
              options={supervisors}
              error={!supervisorselected}
              ref={selectRef}
            />
          </div>
          <br></br>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <FormControl fullWidth error={!!timeErrors.startTime}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopTimePicker
                  value={startTime}
                  onChange={(value) => handleTimeChange('start', value, 'supervisor')}
                  label="Start Time *"
                  views={['hours', 'minutes', 'seconds']}
                  openTo="hours"
                  format="hh:mm:ss A"
                  slotProps={{
                    textField: {
                      error: !!timeErrors.startTime,
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: timeErrors.startTime ? 'red' : 'black' },
                      '&:hover fieldset': { borderColor: timeErrors.startTime ? 'red' : 'black' },
                      '&.Mui-focused fieldset': { borderColor: timeErrors.startTime ? 'red' : 'orange' },
                    },
                  }}
                />
              </LocalizationProvider>
              <FormHelperText>
                {timeErrors.startTime || " "}
              </FormHelperText>
            </FormControl>

            <FormControl fullWidth error={!!timeErrors.endTime}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopTimePicker
                  value={endTime}
                  onChange={(value) => handleTimeChange('end', value, 'supervisor')}
                  label="End Time *"
                  views={['hours', 'minutes', 'seconds']}
                  openTo="hours"
                  format="hh:mm:ss A"
                  slotProps={{
                    textField: {
                      error: !!timeErrors.endTime,
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: timeErrors.endTime ? 'red' : 'black' },
                      '&:hover fieldset': { borderColor: timeErrors.endTime ? 'red' : 'black' },
                      '&.Mui-focused fieldset': { borderColor: timeErrors.endTime ? 'red' : 'orange' },
                    },
                  }}
                />
              </LocalizationProvider>
              <FormHelperText>
                {timeErrors.endTime || " "}
              </FormHelperText>
            </FormControl>
          </div>

        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog4(false)}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            className="filter_btn btn_orange"
            sx={{ backgroundColor: '#ff9800' }}
            onClick={handleSaveThreshold3}
            disabled={
              savingStates.supervisor ||
              !supervisorselected ||
              !startTime ||
              !endTime ||
              timeErrors.startTime ||
              timeErrors.endTime ||
              dateErrors.supervisor ||
              !selectedDate?.isValid()
            }
          >
            {savingStates.supervisor ? 'Saving...' : 'Save'}
          </Button>        </DialogActions>
      </Dialog>
    </div>
  );
};

export default OperatorDetails;