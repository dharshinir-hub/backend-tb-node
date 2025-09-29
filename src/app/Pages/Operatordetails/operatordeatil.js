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
import { CustomDaySelect,CustomDateSelect } from '../Inputfield/inputfield';
import { telemetrykeydata } from '../../Services/app/andondashboardservice';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker';
import Swal from 'sweetalert2';
import { Downtimeadd1,DowntimeaddDelete,Deviceattributeget,Downtimeadd2, DowntimeaddDelete1} from '../../Services/app/masterservice';
const OperatorDetails = () => {
  const params = new URLSearchParams(window.location.search);
  const token = localStorage.getItem('token');
  const customerId = localStorage.getItem('CustomerID');
  const customerId1 =cleanCustomerId(customerId);
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
  const [filteredResult,setfilteredResult]=useState([]); // Changed from {} to []
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
  const getEpochFromShift = (shiftNo, selectedDateObj) => {
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
    // If shift 2, assume overnight so add 1 day to end time
    if (String(shiftNo) === "2" || shiftNo === 2) {
      const nextDay = selectedDateObj.add(1, 'day').format('YYYY-MM-DD');
      endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
    } else {
      endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
    }
  
    return {
      fromEpoch: startDateTime.valueOf(),
      toEpoch: endDateTime.valueOf()
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
  const handleStartTimeChange = async (value) => {
    if (!value) return;
  
    // 1. Check if start time equals end time (to the second)
    if (dayjs(value).isSame(endTime, 'second')) {
      setOpenEditDialog(false);
      setOpenEditDialog4(false);
      setOpenEditDialog1(false);
      Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
      return;
    }
  
    // 2. Check if start time is within shift range
    if (!isTimeInShift(value, selectedShiftData)) {
      setOpenEditDialog(false);
      setOpenEditDialog1(false);
      setOpenEditDialog4(false);
      Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
      return;
    }
  
    // 3. Proceed
    setStartTime(value);
  
    // 4. Check overlap if endTime exists
    if (endTime) {
      await validateAndCheckOverlap(value, endTime);
    }
  };
  
  const handleStartTimeChange1 = async (value) => {
    if (dayjs(value).isSame(endTime, 'second')) {
      setOpenEditDialog(false);
      setOpenEditDialog1(false);
      setOpenEditDialog4(false);
      Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
      return;
    }
    if (!value || !isTimeInShift(value, selectedShiftData)) {
      setOpenEditDialog(false);
      setOpenEditDialog1(false);
      setOpenEditDialog4(false);
      Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
      return;
    }
  
    setStartTime(value);
  
    if (endTime) {
      await validateAndCheckOverlap1(value, endTime);
    }
  };
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
  
    const fromEpoch = dayjs(selectedDate).hour(newStart.hour()).minute(newStart.minute()).second(newStart.second()).valueOf();
    const toEpoch = dayjs(selectedDate).hour(newEnd.hour()).minute(newEnd.minute()).second(newEnd.second()).valueOf();
  
    // Ensure start time is before end time
    if (fromEpoch >= toEpoch) {
      Swal.fire('Error', 'Start time must be before end time.', 'error');
      return false;
    }
  
    const hasOverlap = await checkOperatorTimeOverlap1(selectedDeviceId.id, fromEpoch, toEpoch);
  
    if (hasOverlap) {
      Swal.fire('Error', 'Selected time overlaps with an already assigned operator.', 'error');
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
  const handleEndTimeChange = async (value) => {
    if (dayjs(value).isSame(startTime, 'second')) {
      setOpenEditDialog(false);
      setOpenEditDialog1(false);
      setOpenEditDialog4(false);
      Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
      return;
    }
    if (!value || !isTimeInShift(value, selectedShiftData)) {
      setOpenEditDialog(false);
      setOpenEditDialog1(false);
      setOpenEditDialog4(false);
      Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
      return;
    }
   
  
    setEndTime(value);
  
    if (startTime) {
      await validateAndCheckOverlap(startTime, value);
    }
  };
  const handleEndTimeChange1 = async (value) => {
   if (dayjs(value).isSame(startTime, 'second')) {
    setOpenEditDialog(false);
    setOpenEditDialog1(false);
    setOpenEditDialog4(false);
      Swal.fire('Error', 'Start Time and End Time cannot be the same!', 'error');
      return;
    }
    if (!value || !isTimeInShift(value, selectedShiftData)) {
      setOpenEditDialog(false);
      setOpenEditDialog1(false);
      setOpenEditDialog4(false);
      Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
      return;
    }
  
    setEndTime(value);
  
    if (startTime) {
      await validateAndCheckOverlap(startTime, value);
    }
  };
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
            const allShifts = data[0]?.value || [];
            setoperatorslist(allShifts);
            console.log('alloperator', allShifts);
            
            // ✅ Filter only "Operator" mode
            const operatorNames = allShifts
              .filter(shift => shift.mode === "Operator")  // <-- filter added
              .map(shift => ({
                value: shift.operatorname,
                label: shift.operatorname
              }));
            
            setoperators(operatorNames);
              const key2 = 'live_operator';
              const entitytype = 'DEVICE';
              const deviceid=selectedDeviceId;
  
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
              //setOpenEditDialog(true);
          })
          .catch(error => {
              console.error("Error fetching shifts:", error);
          });
    }
  };
  const handleOperatorChange = (newValue) => {
    const dayjsVal = dayjs(newValue);
    setSelectedDate(dayjsVal);

    // Recalculate epoch range when date changes
    if (selectedShift && shifts.length > 0) {
      const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, dayjsVal);
      setEpochRange({ from: fromEpoch, to: toEpoch });
    }
  };
  const handleOperatorChange1 = (newValue) => {
    const dayjsVal = dayjs(newValue);
    setSelectedDate(dayjsVal);

    // Recalculate epoch range when date changes
    if (selectedShift && shifts.length > 0) {
      const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, dayjsVal);
      setEpochRange({ from: fromEpoch, to: toEpoch });
    }
  };
  const handleShiftChange = (shiftValue) => {
    setSelectedShift(shiftValue);
    setSelectedShift(shiftValue);
  const selectedShiftData = shifts.find(shift => shift.shift_no === shiftValue);
  if (selectedShiftData) {
    setStartTime(dayjs(selectedShiftData.start_time, 'HH:mm:ss'));
    setEndTime(dayjs(selectedShiftData.end_time, 'HH:mm:ss'));
  }
    const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
    setEpochRange({ from: fromEpoch, to: toEpoch });
  };
  const operatorvaluechange = (shiftValue) => {
    setSelectedShift(shiftValue);
    const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
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
              label: shift.operatorname
            }));
          
          setoperators(operatorNames);
            const key2 = 'live_operator';
            const entitytype = 'DEVICE';
            const deviceid=selectedDeviceId;

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
            setOpenEditDialog(true);
        })
        .catch(error => {
            console.error("Error fetching shifts:", error);
        });
  };
  const operatorvaluechange1 = async (shiftValue) => {
    try {
      setSelectedShift(shiftValue);
  
      const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
      setEpochRange({ from: fromEpoch, to: toEpoch });
  
      const key = 'component';
      const operatorData = await customerbasedshift(customerId, key);
      const allShifts = operatorData[0]?.value || [];
      console.log('componentss',allShifts)
      setcomponentslist(allShifts);
  
      console.log('All Shifts:', allShifts);
  
      const reasons = allShifts.map(shift => ({
        value: shift.component_name,
        label: shift.component_name
      }));
  
      setcomponents(reasons);
  
      const key2 = 'live_component';
      const entitytype = 'DEVICE';
      const deviceId = selectedDeviceId;
  
      try {
        const response = await telemetrykeydata(deviceId, entitytype, key2, fromEpoch, toEpoch);
  
        if (
          response &&
          response.live_component &&
          response.live_component.length > 0 &&
          response.live_component[0].value
        ) {
          const parsedValue = JSON.parse(response.live_component[0].value);
          const operator = parsedValue.component_name || '';
          setselectedcomponent(operator);
        } else {
          setselectedcomponent('');
        }
      } catch (error) {
        console.error('Error fetching live_component:', error);
        setselectedcomponent('');
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
                label: shift.operatorname
              }));
            
            setsupervisors(operatorNames);
              const key2 = 'live_supervisor';
              const entitytype = 'CUSTOMER';
              const cleancustomerid=  cleanCustomerId(customerId);
    
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
  const handleOpenEditDialog = async (devicename,deviceid) => {
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
  
      if (options.length > 0) {
        const defaultShift = options[0].value;
            setSelectedDate(dayjs()); // Set to current date
            setSelectedShift(defaultShift);
            setfilteredResult([]); // (Optional) clear table
  
            // Calculate initial epoch range for current date and first shift
            const { fromEpoch, toEpoch } = getEpochFromShift(defaultShift, dayjs());
            setEpochRange({ from: fromEpoch, to: toEpoch });
        console.log('fromEpoch:', fromEpoch, 'toEpoch:', toEpoch, 'defaultShift:', defaultShift, 'currentDate:',  dayjs());
       
        setfilteredResult([]);
  
        // Get operator data
        const key = 'alloperator';
        const operatorData = await customerbasedshift(customerId, key);
        const allOperators = operatorData[0]?.value || [];
        setoperatorslist(allOperators);
  
        const operatorNames = allOperators
          .filter((shift) => shift.mode === "Operator")
          .map((shift) => ({
            value: shift.operatorname,
            label: shift.operatorname
          }));
        setoperators(operatorNames);
  
        // ✅ Now safely fetch live_operator after all data is ready
        setSelectedDeviceId(deviceid);
        setSelectedDevicename(devicename);
        const key2 = 'live_operator';
        const entitytype = 'DEVICE';
  
        await fetchLiveOperator(deviceid, entitytype, key2, fromEpoch, toEpoch);
        
        // Clear time fields for fresh start
        setStartTime(null);
        setEndTime(null);
        
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
        const operator = JSON.parse(response.live_operator[0].value).operator;
        setselectedoperator(operator);
      } else {
        setselectedoperator('');
      }
    } catch (error) {
      console.error('Error fetching live_operator:', error);
      setselectedoperator('');
    }
  };

  const handleOpenEditDialog1= async (devicename,deviceid) => {
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
        console.log('fromEpoch:', fromEpoch, 'toEpoch:', toEpoch, 'defaultShift:', defaultShift, 'currentDate:',  dayjs());
       
        setfilteredResult([]);
  
        // Get operator data
        const key = 'component';
        const operatorData = await customerbasedshift(customerId, key);
        const allShifts = operatorData[0]?.value || [];
        setcomponentslist(allShifts);
        console.log('componentss',allShifts)
        const reasons = allShifts.map(shift => ({
            value: shift.component_name,
            label: shift.component_name
        }));
        setcomponents(reasons);
  
        // ✅ Now safely fetch live_operator after all data is ready
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
        let operator = JSON.parse(response.live_component[0].value).component_name;
        setselectedcomponent(operator);
      } else {
        setselectedcomponent('');
      }
    } catch (error) {
      console.error('Error fetching live_operator:', error);
      setselectedcomponent('');
    }
  };
  const handleOpenEditDialog2 = async (devicename,deviceid) => {
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
const handleOpenEditDialog4= async ()=>{
  const key1 = 'allShift';
    const shiftData = await customerbasedshift(customerId, key1);
    const allShifts = shiftData[0]?.value || [];
    setShifts(allShifts);

    const options = allShifts.map((shift) => ({
      value: shift.shift_no,
      label: `Shift${shift.shift_no}`,
    }));
    setShiftOptions(options);

    if (options.length > 0) {
      const defaultShift = options[0].value;
          setSelectedDate(dayjs()); // Set to current date
          setSelectedShift(defaultShift);
          setfilteredResult([]); // (Optional) clear table

          // Calculate initial epoch range for current date and first shift
          const { fromEpoch, toEpoch } = getEpochFromShift(defaultShift, dayjs());
          setEpochRange({ from: fromEpoch, to: toEpoch });
      console.log('fromEpoch:', fromEpoch, 'toEpoch:', toEpoch, 'defaultShift:', defaultShift, 'currentDate:',  dayjs());
     
      setfilteredResult([]);
      setStartTime(null);
      setEndTime(null);

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
            label: shift.operatorname
          }));
        
        setsupervisors(operatorNames);
          const key2 = 'live_supervisor';
          const entitytype = 'CUSTOMER';
          const cleancustomerid=  cleanCustomerId(customerId);

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
const handleSaveThreshold3 = async() =>{
  try {
    if (!selectedShift || !selectedDate || !supervisorselected) {
      Swal.fire('Error', 'Please fill all required fields.', 'error');
      return;
    }

    let fromEpoch, toEpoch;

    if (startTime && endTime && selectedDate) {
      const start = dayjs(selectedDate)
        .set('hour', startTime.hour())
        .set('minute', startTime.minute())
        .set('second', startTime.second())
        .set('millisecond', 0);
    
      let end;
    
      // Overnight shift: end time is earlier than start time
      if (endTime.isBefore(startTime)) {
        end = dayjs(selectedDate)
          .add(1, 'day')
          .set('hour', endTime.hour())
          .set('minute', endTime.minute())
          .set('second', endTime.second())
          .set('millisecond', 0);
      } else {
        // Same-day shift
        end = dayjs(selectedDate)
          .set('hour', endTime.hour())
          .set('minute', endTime.minute())
          .set('second', endTime.second())
          .set('millisecond', 0);
      }
    
      fromEpoch = start.valueOf();
      toEpoch = end.valueOf();
    }
     else {
      const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
      fromEpoch = shiftEpoch.fromEpoch;
      toEpoch = shiftEpoch.toEpoch;
    }

    if (!fromEpoch || !toEpoch) return;
    const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
    let fromtime = shiftEpoch.fromEpoch;
    let totime = shiftEpoch.toEpoch;
    let durations = Math.floor((toEpoch - fromEpoch) / 1000);
    const cleancustomerid1=  cleanCustomerId(customerId);
    // 🔍 Check for overlap before saving
    const response = await telemetrykeydata(
      cleancustomerid1,
      'CUSTOMER',
      'live_supervisor',
      fromtime,
      totime
    );

    const existingEntries = response?.live_supervisor || [];
    console.log('existingdatas',existingEntries)
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
                  const cleancustomerid1=  cleanCustomerId(customerId);

                  // First delete existing data in the time range
                  const deleteResponse = await DowntimeaddDelete1('CUSTOMER', cleancustomerid1, 'live_supervisor', fromtime, totime);
                
                  if (deleteResponse !== true) {
                    throw new Error('Failed to delete existing data for the specified time range.');
                  }
                  else{
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
                    const cleancustomerid=  cleanCustomerId(customerId);
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

    const cleancustomerid=  cleanCustomerId(customerId);
    await Downtimeadd2('CUSTOMER', cleancustomerid, 'SERVER_SCOPE', key);

    Swal.fire('Success', 'Supervisor assigned successfully.', 'success');    
    setTimeout(() => {
      handleSubmit();
    }, 2000);
  } catch (err) {
    console.error('Update error:', err);
    Swal.fire('Error', 'Failed to assign Supervisor.', 'error');
  } finally {
    setOpenEditDialog4(false);
  }
}
const cancelreason = async () => {
  setOpenEditDialog2(false);

}
const downtimereason = async () => {
  if (!selectedDeviceId || !selectedShift || !selectedDate) return;

  const { fromEpoch, toEpoch } = getEpochFromShift1(selectedShift, selectedDate);
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
              4: { state: "Alarm", color: "#F44336" },
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
            
              // Handle case where recording never ended (no 3 found)
              if (recording) {
                segment.end = toTime;
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
            
              return result.length > 0 ? result : [{start: fromTime, end: toTime, duration: 0, value: 0, status: 'NO_DATA'}];
            };
            let downtime;
            const key='downtime_threasold';
            const results = await Deviceattributeget(deviceId, key);
            let downtimedatas = encodeURIComponent(JSON.stringify([{start: fromTime, end: toTime, duration: 0, value: 0, status: 'NO_DATA'}]));
              console.log('Result',results);

            if (results && results.length > 0) {
              downtime = results[0].value;
              const result = extractStartEndFromOneToThree(transformedData);
              const filteredResult = result.filter(entry => entry.duration > downtime);
              console.log('filterresult',filteredResult)
              setfilteredResult(filteredResult);
              downtimedatas = encodeURIComponent(JSON.stringify(filteredResult));
            }
    
            const encodedData = encodeURIComponent(JSON.stringify(transformedData));
            console.log('result',transformedData)
    
            return Promise.all([
              Promise.resolve(encodedData),                   
              Promise.resolve(downtimedatas)
            ]);
          })
         .then(async([encodedData, downtimedatas]) => {                 
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
              label: shift.operatorname
            }));
          
          setoperators(operatorNames);
            const key2 = 'live_operator';
            const entitytype = 'DEVICE';
            const deviceid=selectedDeviceId;

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
   const customerName = JSON.parse(localStorage.getItem('firstName'))
   const commonOptions = [
  { value: 'Component', label: 'Component' },
  { value: 'Reason', label: 'Reason' },
  { value: 'Supervisor', label: 'Supervisor' },
];

const fallbackOptions =
  customerName === 'PMI'
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
      const keys=  customerName === 'PMI' ? 'live_component' : 'live_operator';
      const entitytype='DEVICE';
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
    try {
      if (!selectedDeviceId || !selectedShift || !selectedDate || !operatorselected) {
        Swal.fire('Error', 'Please fill all required fields.', 'error');
        return;
      }
  
      let fromEpoch, toEpoch;
  
      if (startTime && endTime && selectedDate) {
        const start = dayjs(selectedDate)
          .set('hour', startTime.hour())
          .set('minute', startTime.minute())
          .set('second', startTime.second())
          .set('millisecond', 0);
      
        let end;
      
        // Overnight shift: end time is earlier than start time
        if (endTime.isBefore(startTime)) {
          end = dayjs(selectedDate)
            .add(1, 'day')
            .set('hour', endTime.hour())
            .set('minute', endTime.minute())
            .set('second', endTime.second())
            .set('millisecond', 0);
        } else {
          // Same-day shift
          end = dayjs(selectedDate)
            .set('hour', endTime.hour())
            .set('minute', endTime.minute())
            .set('second', endTime.second())
            .set('millisecond', 0);
        }
      
        fromEpoch = start.valueOf();
        toEpoch = end.valueOf();
      }
       else {
        const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
        fromEpoch = shiftEpoch.fromEpoch;
        toEpoch = shiftEpoch.toEpoch;
      }
  
      if (!fromEpoch || !toEpoch) return;
      const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
      let fromtime = shiftEpoch.fromEpoch;
      let totime = shiftEpoch.toEpoch;
      let durations = Math.floor((toEpoch - fromEpoch) / 1000);
  
      // 🔍 Check for overlap before saving
      const response = await telemetrykeydata(
        selectedDeviceId,
        'DEVICE',
        'live_operator',
        fromtime,
        totime
      );
  
      const existingEntries = response?.live_operator || [];
      console.log('existingdatas',existingEntries)
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
            html: `Time overlaps with existing operator "<strong>${existingOperator}</strong>" between <strong>${conflictStart}</strong> and <strong>${conflictEnd}</strong>.`,
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
                title: 'Do you want to overwrite the existing operator allocation with the new changes?',
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
                    // First delete existing data in the time range
                    const deleteResponse = await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_operator', fromEpoch, toEpoch);
                  
                    if (deleteResponse !== true) {
                      throw new Error('Failed to delete existing data for the specified time range.');
                    }
                    else{
                      const operator = operatorslist.find(op => op.operatorname === operatorselected);
                      const opertorid = operator ? operator.operatorid : null;
                  
                      const key = {
                        ts: fromEpoch,
                        values: {
                          live_operator: {
                            name: operatorselected,
                            code: opertorid,
                            start_time: fromEpoch,
                            end_time: toEpoch,
                            duration: durations
                          }
                        }
                      };
                  
                      await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
                  
                      setDeviceThresholds(prev => ({
                        ...prev,
                        [selectedDeviceId.id || selectedDeviceId]: operatorselected
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
                      // setTimeout(() => {
                      //   window.location.reload()
                      // ;
                      // }, 10);
                    }
                    // Then proceed to add new operator data
                  
                  } catch (error) {
                    console.error('Error in operator allocation update:', error);
                    Swal.fire({
                      title: 'Error',
                      text: error.message || 'Failed to update operator allocation.',
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
      const operator = operatorslist.find(op => op.operatorname === operatorselected);
      const opertorid = operator ? operator.operatorid : null;
  
      const key = {
        ts: fromEpoch,
        values: {
          live_operator: {
            name: operatorselected,
            code: opertorid,
            start_time: fromEpoch,
            end_time: toEpoch,
            duration: durations
          }
        }
      };
  
      await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
  
      setDeviceThresholds(prev => ({
        ...prev,
        [selectedDeviceId.id || selectedDeviceId]: operatorselected
      }));
  
      Swal.fire('Success', 'Operator assigned successfully.', 'success');
      setTimeout(() => {
        handleSubmit();
      }, 2000);
    } catch (err) {
      console.error('Update error:', err);
      Swal.fire('Error', 'Failed to assign operator.', 'error');
    } finally {
      setOpenEditDialog(false);
    }
  };

  const handleSaveThreshold1 = async () => {
    try {
      if (!selectedDeviceId || !selectedShift || !selectedDate || !componentselected) {
        Swal.fire('Error', 'Please fill all required fields.', 'error');
        return;
      }
  
      let fromEpoch, toEpoch;
  
      if (startTime && endTime && selectedDate) {
        const start = dayjs(selectedDate)
          .set('hour', startTime.hour())
          .set('minute', startTime.minute())
          .set('second', startTime.second())
          .set('millisecond', 0);
      
        let end;
      
        // Overnight shift: end time is earlier than start time
        if (endTime.isBefore(startTime)) {
          end = dayjs(selectedDate)
            .add(1, 'day')
            .set('hour', endTime.hour())
            .set('minute', endTime.minute())
            .set('second', endTime.second())
            .set('millisecond', 0);
        } else {
          // Same-day shift
          end = dayjs(selectedDate)
            .set('hour', endTime.hour())
            .set('minute', endTime.minute())
            .set('second', endTime.second())
            .set('millisecond', 0);
        }
      
        fromEpoch = start.valueOf();
        toEpoch = end.valueOf();
      }
       else {
        const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
        fromEpoch = shiftEpoch.fromEpoch;
        toEpoch = shiftEpoch.toEpoch;
      }
  
      if (!fromEpoch || !toEpoch) return;
      const shiftEpoch = getEpochFromShift(selectedShift, selectedDate);
      let fromtime = shiftEpoch.fromEpoch;
      let totime = shiftEpoch.toEpoch;
      let durations = Math.floor((toEpoch - fromEpoch) / 1000);
  
      // 🔍 Check for overlap before saving
      const response = await telemetrykeydata(
        selectedDeviceId,
        'DEVICE',
        'live_component',
        fromtime,
        totime
      );
  
      const existingEntries = response?.live_component || [];
      console.log('existingdatas',existingEntries)
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
            html: `Time overlaps with existing component "<strong>${existingOperator}</strong>" between <strong>${conflictStart}</strong> and <strong>${conflictEnd}</strong>.`,
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
                title: 'Do you want to overwrite the existing component allocation with the new changes?',
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
                    // First delete existing data in the time range
                    const deleteResponse = await DowntimeaddDelete('DEVICE', selectedDeviceId, 'live_component', fromEpoch, toEpoch);
                  
                    if (deleteResponse !== true) {
                      throw new Error('Failed to delete existing data for the specified time range.');
                    }
                    else{
                      const operator = componentslist.find(op => op.component_name === componentselected);
                      const component_number = operator ? operator.component_number : null;
                      const cycle_time=operator ? operator.cycle_time : null;;
                      const handling_time= operator ? operator.handling_time : null;
                      const setupTime= operator ? operator.setupTime : null;
                      const factorvalue= operator ? operator.factorval : null;
                      const factors= operator ? operator.factor : null;
                      const key = {
                        ts: fromEpoch,
                        values: {
                          live_component: {
                            name: componentselected,
                            code: component_number,
                            start_time: fromEpoch,
                            end_time: toEpoch,
                            duration: durations,
                            cycle_time:cycle_time,handling_time:handling_time,setup_time:setupTime,
                            factorval:factorvalue,
                            factor:factors,
                            
                          }
                        }
                      };
                  
                      await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
                  
                      setDeviceThresholds(prev => ({
                        ...prev,
                        [selectedDeviceId.id || selectedDeviceId]: operatorselected
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
                    }
                    // Then proceed to add new operator data
                  
                  } catch (error) {
                    console.error('Error in component allocation update:', error);
                    Swal.fire({
                      title: 'Error',
                      text: error.message || 'Failed to update component allocation.',
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
      const operator = componentslist.find(op => op.component_name === componentselected);
      const component_number = operator ? operator.component_number : null;
      const cycle_time=operator ? operator.cycle_time : null;;
      const handling_time= operator ? operator.handling_time : null;
      const setupTime= operator ? operator.setupTime : null;
      const factorvalue= operator ? operator.factorval : null;
      const factors= operator ? operator.factor : null;
      const key = {
        ts: fromEpoch,
        values: {
          live_component: {
            name: componentselected,
            code: component_number,
            start_time: fromEpoch,
            end_time: toEpoch,
            duration: durations,
            cycle_time:cycle_time,handling_time:handling_time,setup_time:setupTime,
            factorval:factorvalue,
            factor:factors,
            
          }
        }
      };
      await Downtimeadd1('DEVICE', selectedDeviceId, 'SERVER_SCOPE', key);
  
      setDeviceThresholds(prev => ({
        ...prev,
        [selectedDeviceId.id || selectedDeviceId]: operatorselected
      }));
  
      Swal.fire('Success', 'Component assigned successfully.', 'success');
      setTimeout(() => {
        handleSubmit();
      }, 2000);
    } catch (err) {
      console.error('Update error:', err);
      Swal.fire('Error', 'Failed to assign Component.', 'error');
    } finally {
      setOpenEditDialog1(false);
    }
  };
  const handleSaveThreshold2 = async () => {
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
              idle_end:item.end,
              idle_duration:item.duration
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
          {(selectedassignmode === 'Operator' ||selectedassignmode === 'Component'  || selectedassignmode === 'Reason') && (

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
                handleOpenEditDialog(selectedDevicename,selectedDevice);
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
                handleOpenEditDialog1(selectedDevicename,selectedDevice);
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
                handleOpenEditDialog2(selectedDevicename,selectedDevice);
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
       
        
        {iframeUrl && (selectedassignmode!='Reason' ) && (
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
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px'}}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <CustomDateSelect
                      name="selectedDate"
                      label="Select Date"
                      required
                      value={selectedDate}
                      onChange={(e) => {
                        handleDateChange(e);
                        handleOperatorChange(e);
                      }}   
                      format="DD-MM-YYYY"
                      minDate={dayjs()} // ✅ Allows today
                      maxDate={dayjs().add(7, 'day')} // ✅ Allows up to 7 days from today
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
                        <CustomDaySelect
                            name="operatorselected"
                            value={operatorselected}
                            onChange={handleFormChange}
                            label="Select Operator"
                            required={true}
                            options={operators}
                            error={!operatorselected}
                            ref={customDaySelectRef}
                        />
               
                        </div>
                        <br></br>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px'}}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DesktopTimePicker
  value={startTime}
  onChange={handleStartTimeChange}
  label="Start Time"
  minTime={
    selectedShiftData && !isOvernight(selectedShiftData)
      ? dayjs(selectedShiftData.start_time, 'HH:mm:ss')
      : undefined
  }
  maxTime={
    selectedShiftData && !isOvernight(selectedShiftData)
      ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
      : undefined
  }
  views={['hours', 'minutes', 'seconds']}
  openTo="hours"
  format="hh:mm:ss A"
  error={!!startTime}
  InputLabelProps={{ required: false }}
  sx={{
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: 'black' },
      '&:hover fieldset': { borderColor: 'black' },
      '&.Mui-focused fieldset': { borderColor: 'orange' },
      '& .MuiOutlinedInput-input': { color: 'black' },
      '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
      '&::placeholder': { color: 'black', opacity: 1 },
    },
  }}
/>

</LocalizationProvider>
<LocalizationProvider dateAdapter={AdapterDayjs}>
  <DesktopTimePicker
    value={endTime}
    onChange={handleEndTimeChange}
    label="End Time"
    minTime={
      selectedShiftData && !isOvernight(selectedShiftData)
        ? dayjs(selectedShiftData.start_time, 'HH:mm:ss')
        : undefined
    }
    maxTime={
      selectedShiftData && !isOvernight(selectedShiftData)
        ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
        : undefined
    }
    views={['hours', 'minutes', 'seconds']}
    openTo="hours"
    format="hh:mm:ss A"
    error={!!endTime}
    InputLabelProps={{ required: false }}
    sx={{
      '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: 'black' },
        '&:hover fieldset': { borderColor: 'black' },
        '&.Mui-focused fieldset': { borderColor: 'orange' },
        '& .MuiOutlinedInput-input': { color: 'black' },
        '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
        '&::placeholder': { color: 'black', opacity: 1 },
      },
    }}
  />
</LocalizationProvider>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold}>Save</Button>
                    </DialogActions>
                </Dialog>


                <Dialog 
                    open={openEditDialog1} 
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
  <DialogTitle sx={{ padding: 0 }}>Assign Component</DialogTitle>  
</div>

                    <DialogContent>
                      <br></br>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px'}}>
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
                        <CustomDaySelect
                            name="componentselected"
                            value={componentselected}
                            onChange={handleFormChange2}
                            label="Select Component"
                            required={true}
                            options={components}
                            error={!componentselected}
                            ref={customDaySelectRef}
                        />
                        </div>
                        <br></br>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px'}}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DesktopTimePicker
  value={startTime}
  onChange={handleStartTimeChange1}
  label="Start Time"
  minTime={
    selectedShiftData && !isOvernight(selectedShiftData)
      ? dayjs(selectedShiftData.start_time, 'HH:mm:ss')
      : undefined
  }
  maxTime={
    selectedShiftData && !isOvernight(selectedShiftData)
      ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
      : undefined
  }
  views={['hours', 'minutes', 'seconds']}
  openTo="hours"
  format="hh:mm:ss A"
  error={!!startTime}
  InputLabelProps={{ required: false }}
  sx={{
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: 'black' },
      '&:hover fieldset': { borderColor: 'black' },
      '&.Mui-focused fieldset': { borderColor: 'orange' },
      '& .MuiOutlinedInput-input': { color: 'black' },
      '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
      '&::placeholder': { color: 'black', opacity: 1 },
    },
  }}
/>

</LocalizationProvider>
<LocalizationProvider dateAdapter={AdapterDayjs}>
  <DesktopTimePicker
    value={endTime}
    onChange={handleEndTimeChange1}
    label="End Time"
    minTime={
      selectedShiftData && !isOvernight(selectedShiftData)
        ? dayjs(selectedShiftData.start_time, 'HH:mm:ss')
        : undefined
    }
    maxTime={
      selectedShiftData && !isOvernight(selectedShiftData)
        ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
        : undefined
    }
    views={['hours', 'minutes', 'seconds']}
    openTo="hours"
    format="hh:mm:ss A"
    error={!!endTime}
    InputLabelProps={{ required: false }}
    sx={{
      '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: 'black' },
        '&:hover fieldset': { borderColor: 'black' },
        '&.Mui-focused fieldset': { borderColor: 'orange' },
        '& .MuiOutlinedInput-input': { color: 'black' },
        '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
        '&::placeholder': { color: 'black', opacity: 1 },
      },
    }}
  />
</LocalizationProvider>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog1(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold1}>Save</Button>
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
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px'}}>
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
                            className="filter_btn btn_orange"               sx={{ backgroundColor: '#ff9800' }}           
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
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() =>cancelreason()}>Cancel</Button>
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
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px'}}>
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
                    />
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
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px'}}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DesktopTimePicker
  value={startTime}
  onChange={handleStartTimeChange1}
  label="Start Time"
  minTime={
    selectedShiftData && !isOvernight(selectedShiftData)
      ? dayjs(selectedShiftData.start_time, 'HH:mm:ss')
      : undefined
  }
  maxTime={
    selectedShiftData && !isOvernight(selectedShiftData)
      ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
      : undefined
  }
  views={['hours', 'minutes', 'seconds']}
  openTo="hours"
  format="hh:mm:ss A"
  error={!!startTime}
  InputLabelProps={{ required: false }}
  sx={{
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: 'black' },
      '&:hover fieldset': { borderColor: 'black' },
      '&.Mui-focused fieldset': { borderColor: 'orange' },
      '& .MuiOutlinedInput-input': { color: 'black' },
      '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
      '&::placeholder': { color: 'black', opacity: 1 },
    },
  }}
/>

</LocalizationProvider>
<LocalizationProvider dateAdapter={AdapterDayjs}>
  <DesktopTimePicker
    value={endTime}
    onChange={handleEndTimeChange1}
    label="End Time"
    minTime={
      selectedShiftData && !isOvernight(selectedShiftData)
        ? dayjs(selectedShiftData.start_time, 'HH:mm:ss')
        : undefined
    }
    maxTime={
      selectedShiftData && !isOvernight(selectedShiftData)
        ? dayjs(selectedShiftData.end_time, 'HH:mm:ss')
        : undefined
    }
    views={['hours', 'minutes', 'seconds']}
    openTo="hours"
    format="hh:mm:ss A"
    error={!!endTime}
    InputLabelProps={{ required: false }}
    sx={{
      '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: 'black' },
        '&:hover fieldset': { borderColor: 'black' },
        '&.Mui-focused fieldset': { borderColor: 'orange' },
        '& .MuiOutlinedInput-input': { color: 'black' },
        '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
        '&::placeholder': { color: 'black', opacity: 1 },
      },
    }}
  />
</LocalizationProvider>
                        </div>
                       
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog4(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold3}>Save</Button>
                    </DialogActions>
                </Dialog>
    </div>
  );
};

export default OperatorDetails;