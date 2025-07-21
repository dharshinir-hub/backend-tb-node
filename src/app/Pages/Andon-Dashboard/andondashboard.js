import React, { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import './andondasboard.css';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { CustomDateSelect, CustomDaySelect } from '../Inputfield/inputfield';
import { customerbaseddevices, telemetrylatestdata, customerbasedshift } from '../../Services/app/andondashboardservice';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { IconButton, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { telemetrykeydata,telemetrycustomerlatestdata } from '../../Services/app/andondashboardservice';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime); // Correctly extend dayjs with relativeTime plugin

const Home = () => {
  const customerId = localStorage.getItem('CustomerID');
  const [devices, setDevices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedShift, setSelectedShift] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const [deviceStatuses1, setDeviceStatuses1] = useState({});
  const [deviceStatuses2, setDeviceStatuses2] = useState({});
  const [deviceStatuses3, setDeviceStatuses3] = useState({});
  const [shifts, setShifts] = useState([]);
  const [shiftOptions, setShiftOptions] = useState([]);
  const [epochRange, setEpochRange] = useState({ from: null, to: null });
  const [deviceWiseConcatenated, setDeviceWiseConcatenated] = useState({});
  const [deviceWiseSum, setDeviceWiseSum] = useState({});
  const [oeeIframeUrl,setOeeIframeUrl]=useState({});
  const [iframeurlsss,setiframeurlsss]=useState({});
  const [oeedevicename,setoeedevicename]=useState('');
  const [totalShotsSum, setTotalShotsSum] = useState(0);

  const pagesize = 10;
  const page = 0;

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
    // If selected shift is 2, end time is on the next day
    if (String(shiftNo) === "2" || shiftNo === 2) {
      // Add 1 day to the date for end time
      const nextDay = selectedDateObj.add(1, 'day').format('YYYY-MM-DD');
      endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
    } else {
      endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
    }
     if(String(shiftNo) != "2" || shiftNo != 2){
    // If selected date is today, use current time as end if it's before shift end
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

  // To avoid stale closure for dayjsDate in async, useRef for latest date
  const dayjsDateRef = useRef(dayjs(selectedDate));
  useEffect(() => {
    dayjsDateRef.current = dayjs(selectedDate);
  }, [selectedDate]);

  // Define FROM and TO timestamps for iframe and as fallback
  const dayjsDate = dayjs(selectedDate);
  const defaultFrom = dayjsDate.startOf('day').valueOf();
  const defaultTo = dayjsDate.endOf('day').valueOf();

  // 1. Always calculate and set epochRange based on selected shift and date FIRST
  useEffect(() => {
    if (selectedShift && shifts.length > 0 && selectedDate) {
      const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, selectedDate);
      setEpochRange({ from: fromEpoch, to: toEpoch });
    }
  }, [shifts, selectedShift, selectedDate]);

  // 2. Only after epochRange is set, fetch devices and bardata
  useEffect(() => {
    if (customerId && pagesize && page >= 0) {
      setLoading(true);
      const key = 'allShift';

      // Fetch shifts and set shift options
      customerbasedshift(customerId, key)
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
            setSelectedShift(defaultShift);

            // Calculate initial epoch range
            const { fromEpoch, toEpoch } = getEpochFromShift(defaultShift, selectedDate);
            setEpochRange({ from: fromEpoch, to: toEpoch });
          }
        })
        .catch((err) => {
          console.error('Error loading shifts:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [customerId, pagesize, page]);
  const calculateTotalBarDataSum = (devices, deviceWiseSum) => {
    if (!devices || !deviceWiseSum) return 0;
    
    return devices.reduce((total, device) => {
      const deviceId = device.id?.id;
      const barDataSum = deviceWiseSum[deviceId];
      
      // Only add if barDataSum is a valid number
      if (barDataSum !== undefined && barDataSum !== null && !isNaN(barDataSum)) {
        return total + Number(barDataSum);
      }
      return total;
    }, 0);
  };
  
  // Function to get individual device bar data sum
  const getDeviceBarDataSum = (deviceId, deviceWiseSum) => {
    return deviceWiseSum[deviceId] !== undefined ? deviceWiseSum[deviceId] : '';
  };
  
  // Function to get all devices with their bar data sum values
  const getAllDevicesBarDataSum = (devices, deviceWiseSum) => {
    if (!devices || !deviceWiseSum) return [];
    
    return devices.map(device => {
      const deviceId = device.id?.id;
      const deviceName = device.name || 'Unknown Device';
      const barDataSum = deviceWiseSum[deviceId] !== undefined ? deviceWiseSum[deviceId] : 0;
      
      return {
        deviceId,
        deviceName,
        barDataSum: Number(barDataSum) || 0
      };
    });
  };
  // 3. Fetch devices and bardata only after epochRange is set (i.e., after shift and date are resolved)
  useEffect(() => {
    if (customerId && pagesize && page >= 0 && epochRange.from != null && epochRange.to != null) {
      setLoading(true);

      customerbaseddevices(customerId, pagesize, page)
        .then(async (data) => {
          const allDevices = data.data || [];
          setDevices(allDevices);
          handleViewMachineCard1(allDevices[0].id?.id,allDevices[0].name)
          const statusMap = {};
          const statusMap1 = {};
          const statusMap2 = {};
          const statusMap3 = {};
          const deviceWiseConcatTemp = {};
          const deviceWiseSumTemp = {};

          // Use the calculated epochRange for bardata
          const from = epochRange.from;
          const to = epochRange.to;
          let totalShotsAccumulator = 0; // Local variable to accumulate all device totals

          for (const device of allDevices) {
            const deviceId = device.id?.id;
            const entitytype = 'DEVICE';
            const key = 'machine_status';
            const key1 = 'machine_status';
            const key2 = 'live_operator';
            const key3 = 'live_component';
            // Fetch machine status
            try {
              const response = await telemetrylatestdata(deviceId, entitytype, key);
              if (response && response.machine_status && response.machine_status.length > 0) {
                const status = response.machine_status[0].value;
                statusMap[deviceId] = status;
              } else {
                statusMap[deviceId] = 'Unknown';
              }
            } catch (error) {
              statusMap[deviceId] = 'Error';
            }
            setDeviceStatuses(prev => ({ ...prev, [deviceId]: statusMap[deviceId] }));

            // Fetch last update time
            try {
              const response = await telemetrylatestdata(deviceId, entitytype, key1);
              if (response && response.machine_status && response.machine_status.length > 0) {
                let lastUpdateTime = response.machine_status[0].ts;
                statusMap1[deviceId] = lastUpdateTime;
              }
            } catch (error) {
              statusMap1[deviceId] = 'Error';
            }
            setDeviceStatuses1(prev => ({ ...prev, [deviceId]: statusMap1[deviceId] }));
            //Fetch live operator
            try {
              const response = await telemetrykeydata(deviceId, entitytype, key2, from, to);
              const operators = response?.live_operator || [];
              console.log('operators:', operators);
            
              let operator = 'No Operator';
            
              if (operators.length === 1) {
                try {
                  const valueObj = JSON.parse(operators[0].value);
                  console.log('Parsed value (single):', valueObj);
                  operator = valueObj.name || 'No Operator';
                } catch (parseError) {
                  console.error('JSON parse error (single operator):', parseError);
                }
              }
              else if (operators.length > 1) {
                const now = new Date();
                const nowMinutes = now.getHours() * 60 + now.getMinutes();
              
                let latestRecord = null;
                let latestEndMinutes = 0;
              
                for (const item of operators) {
                  try {
                    const parsed = JSON.parse(item.value);
              
                    // ✅ Only consider records that have a "name" field
                    if (!parsed.name) continue;
              
                    const name = parsed.name;
                    const startEpoch = parsed.start_time;
                    const endEpoch = parsed.end_time;
              
                    if (!startEpoch || !endEpoch) continue;
              
                    const start = new Date(startEpoch);
                    const end = new Date(endEpoch);
              
                    const startMinutes = start.getHours() * 60 + start.getMinutes();
                    const endMinutes = end.getHours() * 60 + end.getMinutes();
              
                    console.log(`Checking name: ${name}, from ${startMinutes} to ${endMinutes}, now ${nowMinutes}`);
              
                    // ✅ Only compare by time (HH:mm), ignore date
                    if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
                      operator = name;
                      break;
                    }
              
                    // Fallback to the one with latest end time (by minutes)
                    if (endMinutes > latestEndMinutes) {
                      latestEndMinutes = endMinutes;
                      latestRecord = parsed;
                    }
              
                  } catch (parseError) {
                    console.error('JSON parse error (multiple name operators):', parseError);
                  }
                }
              
                // Fallback to the latest name record if no match found
                if (!operator && latestRecord) {
                  operator = latestRecord.name || 'No Operator';
                }
              
                console.log('Final operator:', operator);
              }
            
              console.log('Final operator:', operator);
              statusMap2[deviceId] = operator;
            } catch (error) {
              console.error('Telemetry fetch error:', error);
              statusMap2[deviceId] = 'Error';
            }
            
            setDeviceStatuses2(prev => ({ ...prev, [deviceId]: statusMap2[deviceId] }));
            

            //Fetch live component
            try {
              const response = await telemetrykeydata(deviceId, entitytype, key3, from, to);
              const operators = response?.live_component || [];
              console.log('components:', operators);
            
              let operator = 'No Component';
            
              if (operators.length === 1) {
                try {
                  const valueObj = JSON.parse(operators[0].value);
                  console.log('Parsed value (single):', valueObj);
                  operator = valueObj.name || 'No Component';
                } catch (parseError) {
                  console.error('JSON parse error (single operator):', parseError);
                }
              } 
              else if (operators.length > 1) {
                const now = new Date();
                const nowMinutes = now.getHours() * 60 + now.getMinutes();
              
                let latestRecord = null;
                let latestEndMinutes = 0;
              
                for (const item of operators) {
                  try {
                    const parsed = JSON.parse(item.value);
              
                    // ✅ Only consider records that have a "name" field
                    if (!parsed.name) continue;
              
                    const name = parsed.name;
                    const startEpoch = parsed.start_time;
                    const endEpoch = parsed.end_time;
              
                    if (!startEpoch || !endEpoch) continue;
              
                    const start = new Date(startEpoch);
                    const end = new Date(endEpoch);
              
                    const startMinutes = start.getHours() * 60 + start.getMinutes();
                    const endMinutes = end.getHours() * 60 + end.getMinutes();
              
                    console.log(`Checking name: ${name}, from ${startMinutes} to ${endMinutes}, now ${nowMinutes}`);
              
                    // ✅ Only compare by time (HH:mm), ignore date
                    if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
                      operator = name;
                      break;
                    }
              
                    // Fallback to the one with latest end time (by minutes)
                    if (endMinutes > latestEndMinutes) {
                      latestEndMinutes = endMinutes;
                      latestRecord = parsed;
                    }
              
                  } catch (parseError) {
                    console.error('JSON parse error (multiple name components):', parseError);
                  }
                }
              
                // Fallback to the latest name record if no match found
                if (!operator && latestRecord) {
                  operator = latestRecord.name || 'No Operator';
                }
              
                console.log('Final operator:', operator);
              }
              
              
            
              console.log('Final operator:', operator);
              statusMap3[deviceId] = operator;
            } catch (error) {
              console.error('Telemetry fetch error:', error);
              statusMap3[deviceId] = 'Error';
            }
            // try {
            //   const response = await telemetrylatestdata(deviceId, entitytype, key3);
            //   if (response && response.live_component && response.live_component.length > 0) {
            //     let component = response.live_component[0].value ? JSON.parse(response.live_component[0].value).component_name : 'No Component';
            //     console.log('component',component)
            //     statusMap3[deviceId] = component;
            //   }
            // } catch (error) {
            //   statusMap3[deviceId] = 'Error';
            // }
            setDeviceStatuses3(prev => ({ ...prev, [deviceId]: statusMap3[deviceId] }));
            // Fetch shots and build final bar data, then concatenate values and store deviceId-wise
            try {
              const shotsResponse = await telemetrykeydata(deviceId, 'DEVICE', 'shots', from, to);
              const shotData = shotsResponse?.shots || [];
              console.log('devicename',device.name ,'shots',shotData)
              // Generate hour range for the day
              const generateHourRange = (startEpoch, endEpoch) => {
                const start = new Date(Number(startEpoch));
                const end = new Date(Number(endEpoch));
                const hours = [];
                const current = new Date(start);
                current.setMinutes(0, 0, 0);
                while (current < end) {
                  hours.push(current.getHours());
                  current.setHours(current.getHours() + 1);
                }
                return hours;
              };

              const orderedHours = generateHourRange(from, to);
              const hourlyData = {};
              orderedHours.forEach(h => hourlyData[h] = []);

              shotData.forEach(point => {
                try {
                  const timestamp = new Date(Number(point.ts));
                  const hour = timestamp.getHours();
                  if (orderedHours.includes(hour)) {
                    const value = parseInt(point.value, 10);
                    if (!isNaN(value)) {
                      hourlyData[hour].push(value);
                    }
                  }
                } catch (error) {
                  console.warn('Error processing data point:', point, error);
                }
              });

              const barData = orderedHours.map(h => {
                const values = hourlyData[h];
                if (!values || values.length === 0) {
                  return {
                    value: 0,
                    name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
                  };
                }
                const first = values[0];
                const last = values[values.length - 1];
                let diff = 0;
                if(last < first){
                  console.log('values',values)
                  diff = Math.abs(last - first);
                }else{
                  console.log('values',values)
                  diff = values.length;
                }               
                return {
                  value: diff,
                  name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
                };
              });
              console.log('barData',barData)             
              // Sum the values in barData
              const barDataSum = barData.reduce((acc, cur) => acc + (cur.value || 0), 0);
              deviceWiseSumTemp[deviceId] = barDataSum;
              // Concatenate only the final bar data values (comma separated)
              deviceWiseConcatTemp[deviceId] = barData.map(b => b.value).join(',');
            } catch (error) {
              deviceWiseConcatTemp[deviceId] = '';
              deviceWiseSumTemp[deviceId] = 0;
            }
            setDeviceWiseConcatenated(prev => ({ ...prev, [deviceId]: deviceWiseConcatTemp[deviceId] }));
            setDeviceWiseSum(prev => ({ ...prev, [deviceId]: deviceWiseSumTemp[deviceId] }));
          }

          const type ='CUSTOMER';
          const keyss='m_count';
          const mCountResponse = await telemetrycustomerlatestdata(customerId, type, keyss);
          const mCountData = mCountResponse?.m_count?.[0]?.value ? JSON.parse(mCountResponse.m_count[0].value) : {};      
         // Replace this part:
         const totalBarDataSum = calculateTotalBarDataSum(allDevices, deviceWiseSumTemp);

         // Get all devices data using the temp object
         const allDevicesData = getAllDevicesBarDataSum(allDevices, deviceWiseSumTemp);

console.log('Total Bar Data Sum:', totalBarDataSum);
console.log('All Devices Data:', allDevicesData);


          
          console.log('Total Bar Data Sum:', totalBarDataSum);
          console.log('All Devices Data:', allDevicesData);
          
          const statusCounts = {
            "RunningMachines": mCountData.active || 0,
            "IdleMachines": mCountData.idle || 0,
            "DisconnectedMachines": mCountData.disconnect || 0,
            "TotalMachines": mCountData.total || 0,
            "ProductionCount": totalBarDataSum || 0
          };
          console.log('statuscount', statusCounts);
          const iframeurlsss = `${window._env_.GRAFANA_URL}/d/a612538d-e25a-4c99-a704-95a50265dc43/legends-total?orgId=1&from=${epochRange.from}&to=${epochRange.to}&var-data=${encodeURIComponent(JSON.stringify(statusCounts))}&kiosk&theme=light`;
          setiframeurlsss(iframeurlsss);
        })
      
        .catch((err) => {
          console.error('Error loading devices:', err);
        })
        .finally(() => setLoading(false));
       

    }
   
  }, [customerId, pagesize, page, epochRange.from, epochRange.to]);

  // Handle shift change: update selectedShift and recalculate epochRange
  const handleShiftChange = (shiftValue) => {
    setSelectedShift(shiftValue);
    const { fromEpoch, toEpoch } = getEpochFromShift(shiftValue, selectedDate);
    setEpochRange({ from: fromEpoch, to: toEpoch });
  };

  // Handle date change: update selectedDate and recalculate epochRange
  const handleDateChange = (newValue) => {
    const dayjsVal = dayjs(newValue);
    setSelectedDate(dayjsVal);

    // Recalculate epoch range when date changes
    if (selectedShift && shifts.length > 0) {
      const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, dayjsVal);
      setEpochRange({ from: fromEpoch, to: toEpoch });
    }
  };

  // Correct relative time function using dayjs
  const getRelativeTime = (lastUpdateTime) => {
    if (!lastUpdateTime || isNaN(lastUpdateTime)) return 'No status';
    // lastUpdateTime is expected to be in ms
    const now = dayjs();
    const time = dayjs(Number(lastUpdateTime));
    const diffInSeconds = now.diff(time, 'second');
    if (diffInSeconds < 60) {
      return `${diffInSeconds} sec${diffInSeconds !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 3600) {
      const mins = Math.floor(diffInSeconds / 60);
      return `${mins} min${mins !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
    } else {
      return time.fromNow();
    }
  };

  const navigate = useNavigate();
  const handleViewMachineCard = (deviceId,deviceName) => {
    const fromEpoch = epochRange.from != null ? epochRange.from : defaultFrom;
    const toEpoch = epochRange.to != null ? epochRange.to : defaultTo;

    const selectedShiftData = shifts.find(shift => shift.shift_no === selectedShift);
    if (!selectedShiftData) {
      console.warn(`No shift data found for selected shift: ${selectedShift}`);
      return { fromEpoch: null, toEpoch: null };
    }
    const { start_time, end_time } = selectedShiftData;
    console.log('start_time:', start_time, 'end_time:', end_time);
    navigate(`/machine-card?deviceId=${deviceId}&from=${fromEpoch}&to=${toEpoch}&deviceName=${deviceName}&start-time=${start_time}&end-time=${end_time}`);
  };
  const handleViewMachineCard1 = async (deviceId, deviceName) => {
    const fromEpoch = epochRange.from != null ? epochRange.from : defaultFrom;
    const toEpoch = epochRange.to != null ? epochRange.to : defaultTo;
    
    try {
      const oeeResponse = await telemetrykeydata(deviceId, 'DEVICE', ['oee', 'availability', 'performance', 'quality'], fromEpoch, toEpoch);
      const generateHourRange = (startEpoch, endEpoch) => {
        const start = new Date(Number(startEpoch));
        const end = new Date(Number(endEpoch));
        const hours = [];
        const current = new Date(start);
        current.setMinutes(0, 0, 0);
        while (current < end) {
          hours.push(current.getHours());
          current.setHours(current.getHours() + 1);
        }
        return hours;
      };
      const orderedHours = generateHourRange(fromEpoch, toEpoch);
      const hourlyData = {};
      orderedHours.forEach(h => hourlyData[h] = []);
      //const averageOEE = oeeResponse?.oee?.[0]?.value || 0;
      oeeResponse?.oee?.forEach(point => {
        try {
          const timestamp = new Date(Number(point.ts));
          const hour = timestamp.getHours();
          if (orderedHours.includes(hour)) {
            const value = parseInt(point.value, 10);
            if (!isNaN(value)) {
              hourlyData[hour].push(value);
            }
          }
        } catch (error) {
          console.warn('Error processing data point:', point, error);
        }
      });
      const averageOEE = orderedHours.map(h => {
        const values = hourlyData[h];
        if (!values || values.length === 0) {
          return {
            value: 0,
            name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
          };
        }
        const first = values[0];
        const last = values[values.length - 1];
        console.log('values',values)

        // let diff = 0;
        // console.log('last',last)
        // console.log('first',first)
        // if(last < first){
         
        //   diff = Math.abs(last - first);
        // }else{
        //   console.log('values',values)
        //    diff = values.length;
        // }
        // return {
        //   value: diff,
        //   name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
        // };
      });
      console.log('averageOEE',averageOEE)
      //const averageAvailability = oeeResponse?.availability?.[0]?.value || 0;
      oeeResponse?.availability?.forEach(point => {
        try {
          const timestamp = new Date(Number(point.ts));
          const hour = timestamp.getHours();
          if (orderedHours.includes(hour)) {
            const value = parseInt(point.value, 10);
            if (!isNaN(value)) {
              hourlyData[hour].push(value);
            }
          }
        } catch (error) {
          console.warn('Error processing data point:', point, error);
        }
      });
      const averageAvailability = orderedHours.map(h => {
        const values = hourlyData[h];
        if (!values || values.length === 0) {
          return {
            value: 0,
            name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
          };
        }
        const first = values[0];
        const last = values[values.length - 1];
        console.log('values',values)

        // let diff = 0;
        // console.log('last',last)
        // console.log('first',first)
        // if(last < first){
         
        //   diff = Math.abs(last - first);
        // }else{
        //   console.log('values',values)
        //    diff = values.length;
        // }
        // return {
        //   value: diff,
        //   name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
        // };
      });
      console.log('averageAvailability',averageAvailability)
      //const averagePerformance = oeeResponse?.performance?.[0]?.value || 0;
      oeeResponse?.performance?.forEach(point => {
        try {
          const timestamp = new Date(Number(point.ts));
          const hour = timestamp.getHours();
          if (orderedHours.includes(hour)) {
            const value = parseInt(point.value, 10);
            if (!isNaN(value)) {
              hourlyData[hour].push(value);
            }
          }
        } catch (error) {
          console.warn('Error processing data point:', point, error);
        }
      });
      const averagePerformance = orderedHours.map(h => {
        const values = hourlyData[h];
        if (!values || values.length === 0) {
          return {
            value: 0,
            name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
          };
        }
      });
      console.log('averagePerformance',averagePerformance)
      //const averageQuality = oeeResponse?.quality?.[0]?.value || 0;
      oeeResponse?.quality?.forEach(point => {
        try {
          const timestamp = new Date(Number(point.ts));
          const hour = timestamp.getHours();
          if (orderedHours.includes(hour)) {
            const value = parseInt(point.value, 10);
            if (!isNaN(value)) {
              hourlyData[hour].push(value);
            }
          }
        } catch (error) {
          console.warn('Error processing data point:', point, error);
        }
      });
      const averageQuality = orderedHours.map(h => {
        const values = hourlyData[h];
        if (!values || values.length === 0) {
          return {
            value: 0,
            name: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
          };
        }
      });
      console.log('averageQuality',averageQuality)

      const oeeData = {
        OEE: averageOEE,
        Availability: averageAvailability,
        Performance: averagePerformance,
        Quality: averageQuality
      };
      console.log('oeeData',oeeData)
      setoeedevicename(deviceName)
      const encodedOeeData = encodeURIComponent(JSON.stringify(oeeData));
      const token = localStorage.getItem('token');
      const customerId1 = localStorage.getItem('CustomerID');
      const cleanedCustomerId = cleanCustomerId(customerId1);
      const newIframeUrl = `${window._env_.GRAFANA_URL}/d/e40cb218-8486-4c8e-9d81-b4bf47d7a768/oee-analysis?orgId=1&var-device_id=${deviceId}&var-token=${token}&var-customer_id=${cleanedCustomerId}&from=${fromEpoch}&to=${toEpoch}&kiosk&theme=light`;
      setOeeIframeUrl(newIframeUrl);
    } catch (error) {
      console.error('Error fetching OEE data:', error);
    }
  };
 const cleanCustomerId = (customerId) => {
    if (!customerId) return '';
    
    return customerId
      .replace(/\\/g, '')    // Remove backslashes
      .replace(/"/g, '')     // Remove quotes
      .trim();               // Remove whitespace
  };
  
  
  return (
    <div className="pages">
      <div className="pagecontents">
        <div className="left-labels">
          <h5>Andon Dashboard</h5>
        </div>

        <div className="rows" style={{
          display: 'flex',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 999
        }}>

        <div className="col-7">
    <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>      
      <div className='panel' style={{width: '100%',height:'160px'}}>
        <h5 style={{textAlign:'center'}}> Machine Status</h5>
        {iframeurlsss && (
          <iframe
            src={iframeurlsss}
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            style={{ pointerEvents: 'auto' }}
          ></iframe>
        )}
      </div>
      <div className='row' style={{height: '80px',marginLeft:'10px'}}>
        <div className="col panel" style={{padding:'10px', height: '100%',marginBottom:'20px'}}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <CustomDateSelect
              name="selectedDate"
              label="Select Date"
              required
              value={selectedDate}
              onChange={handleDateChange}
              format="DD-MM-YYYY"
            />
          </LocalizationProvider>
        </div>
        <div className="col panel" style={{padding:'10px', height: '100%'}}>
          <CustomDaySelect
            name="shift_no"
            value={selectedShift}
            onChange={(e) => handleShiftChange(e.target.value)}
            label="Select Shift"
            required
            options={shiftOptions}
          />
        </div>
      </div>
    </div>
  </div>&nbsp;&nbsp;

  <div className="col-5 panel">
    <h5 style={{textAlign:'center'}}> OEE Analysis : {oeedevicename}</h5>
    {oeeIframeUrl && (
      <iframe
        title="OEE Analysis"
        src={oeeIframeUrl}
        width="100%"
        height="200"
        frameBorder="0"
        allowFullScreen
        style={{ pointerEvents: 'auto' }}
      ></iframe>
    )}
  </div>
</div>
     
          <div className="row">

          <div className='col-12'>
            <div className="iframe-panels">
              {devices?.length > 0 &&
                devices.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((device, index) => {
                  const deviceId = device.id?.id;
                  const deviceName = device.name || `machine-${index + 1}`;
                  const machineStatus = deviceStatuses[deviceId] === null ? 'Disconnected' : deviceStatuses[deviceId];
                  const lastUpdateTime = deviceStatuses1[deviceId];
                  const liveOperator = deviceStatuses2[deviceId];
                  let liveComponent= deviceStatuses3[deviceId];                 
                  const totalShots = deviceWiseConcatenated[deviceId] || '';
                  const barDataSum = deviceWiseSum[deviceId] !== undefined ? deviceWiseSum[deviceId] : '';
                  
                  // Use correct relative time
                  const finaltime = getRelativeTime(lastUpdateTime);
                  console.log('deviceName', deviceName, 'lastUpdateTime', lastUpdateTime, 'selectedshift', selectedShift);

                  const fromForIframe = epochRange.from != null ? epochRange.from : defaultFrom;
                  const toForIframe = epochRange.to != null ? epochRange.to : defaultTo;
                  const iframeUrl = `${window._env_.GRAFANA_URL}/d/e82e4712-5af0-43cf-b7eb-7c0fc940f378/machine-card?orgId=1&var-data=${machineStatus}&var-data1=${encodeURIComponent(barDataSum)}&var-data2=${liveOperator} &var-data3=${liveComponent}&from=${fromForIframe}&to=${toForIframe}&kiosk&theme=light`;

                  return (
                    <div key={deviceId || index} className="device-panel">
                      {/* <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center'}}>
                        <div style={{display:'flex', alignItems:'center', cursor:'pointer'}}>
                          <Tooltip title="OEE Analysis">
                            <IconButton>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>              
                        </div>
                      </div> */}
                      <div onClick={() => handleViewMachineCard1(deviceId,deviceName)} style={{ alignItems: 'center', display: 'flex', justifyContent: 'center', fontSize: '15px', flexDirection: 'column',cursor:'pointer' }}>
                      <h6>{deviceName}</h6>

                        {finaltime && finaltime !== 'No status' && (
                          <span>Updated {finaltime}</span>
                        )}
                      </div>
                      <div onClick={() => handleViewMachineCard(deviceId, deviceName)} style={{ position: 'relative', width: '100%', height: '400px',cursor:'pointer' }}>
                        <iframe
                          title={`Grafana Panel - ${deviceName}`}
                          src={iframeUrl}
                          width="100%"
                          height="300"
                          frameBorder="0"
                          allowFullScreen
                          style={{ pointerEvents: 'auto' }}
                        ></iframe>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer'
                        }} />
                      </div>
                      <br></br>
                    </div>
                  );
                })}
            </div>
          </div>
         
          
        </div>

        </div>
        </div>
  )}

export default Home;
