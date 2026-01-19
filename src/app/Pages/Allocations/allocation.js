import { useState, useEffect,useRef,useMemo,useForm} from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { TimeField } from '@mui/x-date-pickers/TimeField';
import './allocation.css';
import { customerbasedshift, shiftadd, Deviceattributeget,cleanCustomerId, Downtimeadd2 } from '../../Services/app/masterservice';
import { customerbaseddevices,telemetrylatestdata } from '../../Services/app/andondashboardservice';
import { Downtimeadd1,DowntimeaddDelete
    
 } from '../../Services/app/masterservice';

import Swal from 'sweetalert2';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import 'react-time-picker/dist/TimePicker.css';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { MobileTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { DemoItem } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import PersonIcon from '@mui/icons-material/Person';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import SettingsIcon from '@mui/icons-material/Settings';
import { Columns } from 'lucide-react';
import { CustomDateSelect, CustomDaySelect } from '../Inputfield/inputfield';
import { telemetrykeydata } from '../../Services/app/andondashboardservice';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker';
// Function to convert seconds to HH:mm:ss format
import VisibilityIcon from '@mui/icons-material/Visibility'; // 👁️ icon from MUI
import { useNavigate } from 'react-router-dom';
import { CUSTOMER_IDS } from '../../Shared/constants/ids';

const formatSecondsToTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'Not set';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Allocation = () => {
    // Dialog state
     const [selectedShift, setSelectedShift] = useState('');
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null);
    const [dialogOpenCount, setDialogOpenCount] = useState(0);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openEditDialog1, setOpenEditDialog1] = useState(false);
    const [openEditDialog2, setOpenEditDialog2] = useState(false);
    const [OpenEditDialog4, setOpenEditDialog4] = useState(false);
    const [selectedDevicename, setSelectedDevicename] = useState(null);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [operatorselected, setselectedoperator] = useState('');
    const [reasonselected, setselectedreason] = useState('');
    const [componentselected, setselectedcomponent] = useState('');
    const customerId = localStorage.getItem('CustomerID');
    const [devices, setDevices] = useState([]);
    const [operators, setoperators] = useState([]);
    const [operatorslist, setoperatorslist] = useState([]);
    const [reasons, setreasons] = useState([]);
    const [reasonslist, setreasonslist] = useState([]);
    const [components, setcomponents] = useState([]);
    const [componentslist, setcomponentslist] = useState([]);
    const [deviceThresholds, setDeviceThresholds] = useState({});
    const [shiftOptions, setShiftOptions] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [downtimedata, setDowntimeData] = useState([]);
    const [epochRange, setEpochRange] = useState({ from: null, to: null });
    const [loading, setLoading] = useState(false);
    const [filteredResult,setfilteredResult]=useState([]); // Changed from {} to []
    const [operatorsByDevice, setOperatorsByDevice] = useState({});
    const [componentsByDevice, setComponentsByDevice] = useState({});
    const [reasonsByDevice, setReasonsByDevice] = useState({});
    const [supervisors, setsupervisors] = useState([]);
    const [supervisorslist, setsupervisorslist] = useState([]);
    const [supervisorsByDevice, setSupervisorByDevice] = useState([]);   const [supervisorselected, setselectedsupervisor] = useState('');
    const customDaySelectRef = useRef();
    const selectRef = useRef();
 
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);

    const navigate = useNavigate();

    const handleViewClick = (id,name) => {
      const deviceId = id;
      navigate(`/operator-details?deviceId=${deviceId}&deviceName=${name}`); // Navigate to operator details page
    };
    const handleViewClick1 = (id,name) => {
      const deviceId = id;
      // navigate(`/operator-details?deviceId=${deviceId}&deviceName=${name}`); // Navigate to operator details page
    };
 // Helper function to get epoch from shift
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
    if (!value || !isTimeInShift(value, selectedShiftData)) {
      Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
      return;
    }
  
    setStartTime(value);
  
    if (endTime) {
      await validateAndCheckOverlap(value, endTime);
    }
  };
  const validateAndCheckOverlap = async (newStart, newEnd) => {
    if (!selectedDate || !selectedDeviceId?.id) return;
  
    const fromEpoch = dayjs(selectedDate).hour(newStart.hour()).minute(newStart.minute()).second(newStart.second()).valueOf();
    const toEpoch = dayjs(selectedDate).hour(newEnd.hour()).minute(newEnd.minute()).second(newEnd.second()).valueOf();
  
    // Ensure start time is before end time
    if (fromEpoch >= toEpoch) {
      Swal.fire('Error', 'Start time must be before end time.', 'error');
      setStartTime(null);
      setEndTime(null);
      return;
    }
  
    const hasOverlap = await checkOperatorTimeOverlap(selectedDeviceId.id, fromEpoch, toEpoch);
  
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
  
        const existingStart = parsed.operator_start_time || item.ts;
        const existingEnd = parsed.oprator_end_time || (existingStart + (parsed.operator_duration || 0) * 1000);
  
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
    
  const handleEndTimeChange = async (value) => {
    if (!value || !isTimeInShift(value, selectedShiftData)) {
      Swal.fire('Error', 'Selected time is outside the shift range!', 'error');
      return;
    }
  
    setEndTime(value);
  
    if (startTime) {
      await validateAndCheckOverlap(startTime, value);
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
 // Handle date change: update selectedDate and recalculate epochRange
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
  const getEpochFromShift1 = (shiftNo, selectedDateObj, shiftsList) => {
    if (!shiftNo || !selectedDateObj || shiftsList.length === 0) {
      return { fromEpoch: null, toEpoch: null };
    }
  
    const selectedShiftData = shiftsList.find(shift => shift.shift_no === shiftNo);
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
  
  const handleOperatorChange = (newValue) => {
    const dayjsVal = dayjs(newValue);
    setSelectedDate(dayjsVal);

    // Recalculate epoch range when date changes
    if (selectedShift && shifts.length > 0) {
      const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, dayjsVal);
      setEpochRange({ from: fromEpoch, to: toEpoch });
    }
  };
  
    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setselectedoperator(value);
    };
    const handleFormChange1 = (event) => {
        const { name, value } = event.target;
        setselectedreason(value);
    };
    const handleFormChange2 = (event) => {
        const { name, value } = event.target;
        setselectedcomponent(value);
    };
    const handleFormChange3 = (event) => {
      const { name, value } = event.target;
      setselectedsupervisor(value);
  };
  const handleOpenEditDialog = async (rowData) => {
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
        const deviceid = rowData.id?.id || rowData.id;
        setSelectedDeviceId(deviceid);
        setSelectedDevicename(rowData.name);
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
  
  
    const handleOpenEditDialog1 = async (rowData) => {
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
              setSelectedDeviceId(rowData.id?.$oid || rowData.id);
              setOpenEditDialog1(true);
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
    const handleOpenEditDialog2= async (rowData) => {
        const key = 'component';
        customerbasedshift(customerId, key)
            .then(async (data) => {
                const allShifts = data[0]?.value || [];
                setcomponentslist(allShifts);
                console.log('allshifts',allShifts)
                const reasons = allShifts.map(shift => ({
                    value: shift.component_name,
                    label: shift.component_name
                }));
                setcomponents(reasons);
                setSelectedDeviceId(rowData.id?.$oid || rowData.id);
                const key2 = 'live_component';
                const entitytype = 'DEVICE';
                const deviceid=rowData.id.id;

                try {
                    const response = await telemetrylatestdata(deviceid, entitytype, key2);
                    if (response && response.live_component && response.live_component.length > 0 && response.live_component[0].value) {
                      let operator = JSON.parse(response.live_component[0].value).component_name;
                      setselectedcomponent(operator);
                    } else {
                      setselectedoperator('');
                    }
                  } catch (error) {
                    setselectedoperator('');
                  }
                setOpenEditDialog2(true);
            })
            .catch(error => {
                console.error("Error fetching shifts:", error);
            });
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
    
          const existingStart = parsed.operator_start_time || item.ts;
          const existingEnd =
            parsed.oprator_end_time ||
            (existingStart + (parsed.operator_duration || 0) * 1000);
    
          const isOverlapping = fromEpoch < existingEnd && existingStart < toEpoch;
    
          if (isOverlapping) {
            const existingOperator = parsed.operator || 'Unknown';
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
                              operator: operatorselected,
                              code: opertorid,
                              operator_start_time: fromEpoch,
                              oprator_end_time: toEpoch,
                              operator_duration: durations
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
                          getShifts();
                        }, 2000);
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
              operator: operatorselected,
              code: opertorid,
              operator_start_time: fromEpoch,
              oprator_end_time: toEpoch,
              operator_duration: durations
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
          getShifts();
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
          
    
          await Downtimeadd1('DEVICE', selectedDeviceId.id, 'SERVER_SCOPE', key);
    
          // Optional: Update UI state to reflect change
          setDeviceThresholds(prev => ({
            ...prev,
            [selectedDeviceId.id || selectedDeviceId]: item.reasonselected
          }));
        }
    
        Swal.fire('Success', 'Reasons assigned successfully.', 'success');
        setTimeout(() => {
          getShifts();
        }, 2000);       
       } catch (err) {
        console.error('Update error:', err);
        Swal.fire('Error', 'Failed to assign reason.', 'error');
      } finally {
        setOpenEditDialog1(false);
      }
    };
    
    const handleSaveThreshold2= async () => {
        try {
             console.log('componentlist',componentslist)
            const operator = componentslist.find(op => op.component_name === componentselected);
            const component_number = operator ? operator.component_number : null;
            const cycle_time=operator ? operator.cycle_time : null;;
            const handling_time= operator ? operator.handling_time : null;
            const setupTime= operator ? operator.setupTime : null;
            const item_code = operator ? operator.item_code : null;
            const process_name = operator ? operator.process_name : null;
            const isGplast = cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST;
            const key2 = {
              component_name: componentselected,
              component_id: component_number,
              cycle_time,
              handling_time,
              setup_time: setupTime,
              component_start_time: Date.now(),
              ...(isGplast && {
                item_code: item_code,
                process_name: process_name,
              }),
            };
            const key = {                
                live_component: JSON.stringify(key2), // Stringify the object to avoid key conflicts
                lastUpdateTs: Date.now()
            };

            // Save operator assignment logic here
            await Downtimeadd1('DEVICE', selectedDeviceId.id, 'SERVER_SCOPE', key);

            setDeviceThresholds(prev => ({
                ...prev,
                [selectedDeviceId.id || selectedDeviceId]: componentselected // Ensure unique key by using device ID
            }));            Swal.fire('Success', 'Component assigned successfully.', 'success');
            setTimeout(() => {
              getShifts();
            }, 2000);  
                  } catch (err) {
            console.error('Update error:', err);
            Swal.fire('Error', 'Failed to assign component.', 'error');
        } finally {
            setOpenEditDialog2(false);
        }
    };
    const isOvernight = (shift) => {
      const start = dayjs(shift.start_time, 'HH:mm:ss');
      const end = dayjs(shift.end_time, 'HH:mm:ss');
      return end.isBefore(start);
    };
    const getShifts = async () => {
      try {
        const { data: allDevices = [] } = await customerbaseddevices(customerId, 100, 0);
        setDevices(allDevices);
    
        const thresholds = {};
        const operators = {};
        const components={};
        let supervisors = '';    
        for (const device of allDevices) {
          try {
            const response = await Deviceattributeget(device.id.id, 'downtime_threasold');
            thresholds[device.id.id || device.id] = response?.[0]?.value || null;
    
            // 🔽 Get operator for this device
            try {
              const key2 = 'live_operator';
              const entitytype = 'DEVICE';
              const telemetry = await telemetrylatestdata(device.id.id, entitytype, key2);
    
              if (telemetry?.live_operator?.[0]?.value) {
                const operator = JSON.parse(telemetry.live_operator[0].value)?.operator || '';
                operators[device.id.id] = operator;
              } else {
                operators[device.id.id] = '';
              }
            } catch (error) {
              operators[device.id.id] = '';
            }
            const key3 = 'live_component';
            const entitytype1 = 'DEVICE';

            try {
              const response = await telemetrylatestdata(device.id.id, entitytype1, key3);
              if (response && response.live_component && response.live_component.length > 0 && response.live_component[0].value) {
                let operator = JSON.parse(response.live_component[0].value).component_name;
                components[device.id.id] = operator;
              } else {
                components[device.id.id] = '';
              }
            } catch (error) {
              components[device.id.id] = '';
            }
           

          } catch (error) {
            console.error(`Error fetching threshold for device ${device.id}:`, error);
            thresholds[device.id.id || device.id] = null;
          }
        }
        try {
          const key4 = 'live_supervisor';
          const entitytype = 'CUSTOMER';
          const cleanCustomerId1 = cleanCustomerId(customerId)
          const telemetry = await telemetrylatestdata(cleanCustomerId1, entitytype, key4);

          if (telemetry?.live_supervisor?.[0]?.value) {
            const supervisor = JSON.parse(telemetry.live_supervisor[0].value)?.supervisor || '';
            supervisors= supervisor;
            console.log('supervisors',supervisors)
          } else {
            supervisors = '';
          }
        } catch (error) {
          supervisors = '';
        }
        setOperatorsByDevice(operators); // ✅ Store all operator names per device
        setComponentsByDevice(components);
        setSupervisorByDevice(supervisors)
      } catch (error) {
        console.error('Error fetching devices:', error);
      }
    };
    const handleOpenEditDialog4= async ()=>{
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
    const cancelreason = async () => {
      setOpenEditDialog1(false);
      setTimeout(() => {
        getShifts();
      }, 2000); // 2000 milliseconds = 2 seconds
    }
    const downtimereason = async () => {
              if (!selectedDeviceId.id || !selectedShift || !selectedDate) return;

        const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, selectedDate);
        if (!fromEpoch || !toEpoch) return;
      
        const fromTime = fromEpoch;
        const toTime = toEpoch;
        const deviceId = selectedDeviceId.id;
        try {
            if (deviceId && fromTime && toTime) {
                telemetrykeydata(deviceId, 'DEVICE', 'machineStatus', fromTime, toTime)
                .then(async machineStatusResponse => {
                  const machineData = machineStatusResponse?.machineStatus || [];      
                  
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
    const handleSaveThreshold3 = async() =>{
      try {
        const operator = supervisors.find(op => op.operatorname === supervisorselected);
        const opertorid = operator ? operator.operatorid : null;
        const key2 = {
            "supervisor": supervisorselected,
            "supervisor_id": opertorid,
            "supervisor_start_time": Date.now()
        };
        const key = {                
          live_supervisor: JSON.stringify(key2),// Stringify the object to avoid key conflicts
            lastUpdateTs: Date.now()
        };
        const cleancustomerid=  cleanCustomerId(customerId);

        // Save operator assignment logic here
        await Downtimeadd2('CUSTOMER', cleancustomerid, 'SERVER_SCOPE', key);

        Swal.fire('Success', 'Supervisor assigned successfully.', 'success');
        setTimeout(() => {
          getShifts();
        }, 2000); // 2000 milliseconds = 2 seconds
    } catch (err) {
        console.error('Update error:', err);
        Swal.fire('Error', 'Failed to assign operator.', 'error');
    } finally {
        setOpenEditDialog4(false);
    }
    }
// Convert epoch to IST date-time string
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
  
    useEffect(() => {
      setTimeout(() => {
        getShifts();
      }, 2000);    }, []);

    const selectedShiftData = shifts.find(shift => shift.shift_no === selectedShift);

    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="left-labels">
                    <div className="shift-content">
                        <h5>Allocations</h5>
                    </div>
                </div>
                <div className="idle_reason_item">
                <div className="metric-box" style={{ fontSize: '30px',cursor:'pointer'}}onClick={() => {
                                                    handleOpenEditDialog4();
                                                }}>
                                                <SupervisorAccountIcon style={{ fontSize: '30px',cursor:'pointer'}}className="metric-icon" />
                                                <div className="metric-content">
                                                    <span className="metric-label">Supervisor : {supervisorsByDevice}</span>
                                                   
                                                </div>
                                            </div>       
                </div>&nbsp;
                <div className="idle_reason_list">
                    {devices?.length > 0 ? (
                        [...new Map(devices.map(device => 
                            [device.id?.$oid || device.id, device])).values()]
                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                            .map((item) => {
                                const itemId = item.id?.$oid || item.id;
                                const threshold = deviceThresholds[item.id.id || item.id] ?? 'Not set';
                            

                                return (
                                 <>                               
                                    <div className="idle_reason_item" key={itemId} data-id={item.code}>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '4px'}}>
                                                <span style={{fontWeight: 600, fontSize: '20px'}}>Machine Name:</span>
                                                <span style={{color: 'black'}}>{item.name}</span>
                                            </div>
                                         <div style={{display: 'flex', gap: '20px',flexDirection: 'column',}}>
                                            <div className="metric-box"style={{ fontSize: '30px',cursor:'pointer'}}  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditDialog(item);
                                                }} >
                                                <PersonIcon style={{ fontSize: '30px',cursor:'pointer'}} className="metric-icon" />
                                                <div className="metric-content">
                                                <div className="metric-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
      <span>
        Operator: {operatorsByDevice?.[item?.id?.id] || 'N/A'}
      </span>  
      
    </div>



                                                </div>
                                            </div>
                                            <div className="metric-box" style={{ fontSize: '30px',cursor:'pointer'}} onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditDialog1(item);
                                                }}>
                                                <ReportProblemIcon style={{ fontSize: '30px',cursor:'pointer'}}className="metric-icon" />
                                                <div className="metric-content">
                                                    <span className="metric-label">Reason</span>
                                                   
                                                </div>
                                            </div>
                                            <div className="metric-box"style={{ fontSize: '30px',cursor:'pointer'}} onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditDialog2(item);
                                                }}> 
                                                <SettingsIcon style={{ fontSize: '30px',cursor:'pointer'}}className="metric-icon" />
                                                <div className="metric-content">
                                                    {/* <span className="metric-label">Component: {componentsByDevice[item.id.id] || 'N/A'}</span> */}
                                                    <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>
        Component: {componentsByDevice?.[item?.id?.id] || 'N/A'}
      </span>    
      <VisibilityIcon
  style={{ cursor: 'pointer', color: '#1976d2' }}
  onClick={(e) => {
    e.stopPropagation(); // Optional: prevent parent click
    handleViewClick1(item?.id?.id,item.name);
  }}
  titleAccess="View Component"
/>
    </div>
                                                  
                                                </div>
                                            </div>
                                        
                                         </div>
                                       
                                        </div>
                                    </div>
                                    </>
                                );
                            })
                    ) : (
                        <div style={{ margin: '2rem', color: '#888' }}>No devices found.</div>
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
  <VisibilityIcon
    style={{ cursor: 'pointer', color: '#1976d2' }}
    onClick={(e) => {
      e.stopPropagation();
      handleViewClick(selectedDeviceId, selectedDevicename);
    }}
    titleAccess="View Operator"

  />
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
    format="HH:mm:ss A"
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
    format="HH:mm:ss A"
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
                        setOpenEditDialog1(false);
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
                            width: '500px',
                            maxWidth: '500px'
                        }
                    }}
                >
                    <DialogTitle>Assign Component</DialogTitle>
                    <DialogContent>
                    <br></br>
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
    format="HH:mm:ss A"
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
    format="HH:mm:ss A"
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
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog2(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold2}>Save</Button>
                    </DialogActions>
                </Dialog>
                <Dialog 
                    open={OpenEditDialog4} 
                    onClose={() => setOpenEditDialog4(false)}  
                                    
                    disableEscapeKeyDown={true}
                    sx={{
                        '& .MuiDialog-paper': {
                            width: '500px',
                            maxWidth: '500px'
                        }
                    }}
                >
                    <DialogTitle>Assign Supervisor</DialogTitle>
                    <DialogContent>
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
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff4444' }} onClick={() => setOpenEditDialog4(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" sx={{ backgroundColor: '#ff9800' }} onClick={handleSaveThreshold3}>Save</Button>
                    </DialogActions>
                </Dialog>
            </div>
        </div>
    );
};

export default Allocation;