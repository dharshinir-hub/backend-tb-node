import React, { useEffect, useState } from 'react';
import { MenuItem, Select, FormControl, InputLabel} from '@mui/material';
import { cleanCustomerId,telemetrylatestdata,customerbaseddevices, customerbasedshift} from '../../Services/app/companyservice';
import './company.css';
import dayjs from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';


const CompanyDashboard = () => {
  const customerId = localStorage.getItem('CustomerID');
  const newToken = localStorage.getItem('newToken');

  const [devices, setDevices] = useState([]);
  const [deviceNames, setDeviceNames] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedShift, setSelectedShift] = useState('allshift');
  const [selectedShiftData, setSelectedShiftData] = useState(null);
  const [selectedShiftName, setSelectedShiftName] = useState('');
  const [utilizationData, setUtilizationData] = useState([]);
  const [formattedUtilization, setFormattedUtilization] = useState('');
  const [grafanaURL, setGrafanaURL] = useState('');
  const [timeData, setTimeData] = useState([]);
  const [formattedTime, setFormattedTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
   const [fromTime, setFromTime] = useState(null);
  const [toTime, setToTime] = useState(null);





  useEffect(() => {
    if (customerId) {
      fetchShifts();
      fetchDevices();
    }
  }, [customerId]);

  useEffect(() => {
    if (devices.length > 0) {
      fetchAverageUtilizationForAllDevices();
    }
  }, [devices, selectedDevice]);

  useEffect(() => {
    updateGrafanaURL();
  }, [selectedDevice, formattedUtilization, selectedShiftData]);

  

  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, 'allShift');
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);

      localStorage.setItem('shifts', JSON.stringify(shiftList));


      if (shiftList.length > 0) {
        const firstShift = shiftList[0];
        setSelectedShift(firstShift.shift_no);
        setSelectedShiftData(firstShift);
        setSelectedShiftName(`${firstShift.shift_no}`);
      }
      console.log('ShiftList',shifts);
    } catch (err) {
      console.error('Failed to fetch shifts', err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
      const names = devicesList.map((device, index) => device.name || `machine-${index + 1}`);
      setDeviceNames(names);
    } catch (err) {
      console.error('Failed to fetch devices', err);
    }
  };

const fetchAverageUtilizationForAllDevices = async () => {
  try {
    const devicesToFetch =
      selectedDevice === 'all'
        ? devices
        : devices.filter((device) => device.id?.id === selectedDevice);

    const utilizationList = await Promise.all(
      devicesToFetch.map(async (device) => {
        const deviceId = device.id?.id;
        const deviceName = device.name;

        try {
          const response = await telemetrylatestdata(deviceId, 'DEVICE', 'utilization');

          console.log("Telemetry Response:", response);

          // Access first element's value
          const rawValue = response?.utilization?.[0]?.value ?? 0;
          const value = Number(rawValue).toFixed(2);

          return {
            label: deviceName,
            value
          };
        } catch (err) {
          console.error(`Error fetching utilization for ${deviceName}`, err);
          return {
            label: deviceName,
            value: "0.00"
          };
        }
      })
    );

    setUtilizationData(utilizationList);

    const formatted = encodeURIComponent(JSON.stringify(utilizationList));
    setFormattedUtilization(formatted);

    console.log('Utilization List:', utilizationList);
  } catch (error) {
    console.error('Error fetching utilization for selected devices:', error);
  }
};



  useEffect(() => {
  fetchTimeTelemetryForAllDevices();
}, [selectedDevice]);



const fetchTimeTelemetryForAllDevices = async () => {
  try {
    const devicesToFetch = selectedDevice === 'all'
      ? devices
      : devices.filter((device) => device.id?.id === selectedDevice);

    const timeList = await Promise.all(
      devicesToFetch.map(async (device) => {
        const deviceId = device.id?.id;
        const deviceName = device.name;

        try {
          const response = await telemetrylatestdata(deviceId, 'DEVICE', 'time');
          const timeValue = response?.time?.[0]?.value || '{}'; // Default to empty JSON string if missing

          return {
            label: deviceName,
            time: timeValue
          };
        } catch (err) {
          console.error(`Error fetching time telemetry for ${deviceName}`, err);
          return {
            label: deviceName,
            time: '{}'
          };
        }
      })
    );

    setTimeData(timeList); // <- You should define `timeData` state
    const formattedTime = encodeURIComponent(JSON.stringify(timeList));
    setFormattedTime(formattedTime); // <- You should define `formattedTime` state
    console.log('Time List', formattedTime);
  } catch (error) {
    console.error('Error fetching time telemetry for selected devices:', error);
  }
};

useEffect(() => {
  fetchShiftTiming();
}, [shifts, selectedShift]); // call when shifts or selection changes


const fetchShiftTiming = () => {
  try {
    let starttime = '';
    let endtime = '';
    let shiftData = null;

    if (selectedShift === 'allshift') {
      // Use Shift 1 details from already-fetched shifts
      shiftData = shifts.find(shift => shift.shift_no === 1);
      if (shiftData) {
        starttime = shiftData.start_time;

        // Get current time as HH:mm:ss
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0];
        endtime = currentTime;
      }
    } else {
      shiftData = shifts.find(shift => shift.shift_no === selectedShift);
      if (shiftData) {
        starttime = shiftData.start_time;
        endtime = shiftData.end_time;
      }
    }

    if (shiftData) {
      setSelectedShiftData(shiftData);
    }

    console.log('Start Time:', starttime);
    console.log('End Time:', endtime);

    setStartTime(starttime);
    setEndTime(endtime);
  } catch (error) {
    console.error('Error in fetchShiftTiming:', error);
  }
};


function combineDateAndTimeToMs(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const dateTimeStr = `${dateStr}T${timeStr}`;
  return new Date(dateTimeStr).getTime();
}

function getTodayShiftTimes(selectedShiftData) {
  if (!selectedShiftData) return { from: null, to: null };

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  let from = selectedShiftData?.start_time ?? null;
  let to = selectedShiftData?.end_time ?? null;

  // If values are in hh:mm:ss, combine with today's date
  if (typeof from === 'string' && from.includes(':')) {
    from = combineDateAndTimeToMs(todayStr, from);
  }
  if (typeof to === 'string' && to.includes(':')) {
    to = combineDateAndTimeToMs(todayStr, to);
  }

  return { from, to };
}

// ✅ Usage
const { from, to } = getTodayShiftTimes(selectedShiftData);
console.log("Today's Shift From (ms):", from);
console.log("Today's Shift To (ms):", to);




  const updateGrafanaURL = () => {
    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    console.log('Bearer Token',bearerToken);
    const shiftListSerialized = encodeURIComponent(JSON.stringify(shifts)); // shifts is the shiftList state
  console.log('Shift List:', shiftListSerialized);
    const cleanedId = cleanCustomerId(customerId);
    console.log('Customer Id',cleanedId);

    let entityType = 'CUSTOMER';
    let entityId = cleanedId;

    if (selectedDevice !== 'all') {
      entityType = 'DEVICE';
      entityId = selectedDevice;
    }

    let FromTime = '';
    let ToTime = '';

    const selectedShift = selectedShiftData;

    if (selectedShift && selectedShift.start_time && selectedShift.end_time) {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      const fromDateTimeStr = `${yesterdayStr}T${selectedShift.start_time}`;
      const toDateTimeStr = `${todayStr}T${selectedShift.end_time}`;

      const fromDateTime = new Date(fromDateTimeStr);
      let toDateTime = new Date(toDateTimeStr);

      const shiftStartToday = new Date(`${todayStr}T${selectedShift.start_time}`);
      if (toDateTime <= shiftStartToday) {
        toDateTime.setDate(toDateTime.getDate() + 1);
      }

      if (!isNaN(fromDateTime.getTime()) && !isNaN(toDateTime.getTime())) {
        FromTime = fromDateTime.getTime();
        ToTime = toDateTime.getTime();
      }
      console.log('from time',FromTime);
      console.log('to time ', ToTime);
    }

    const fullURL = `http://demo.yantra24x7.com:3000/d/a7c6259b-3acb-45ed-92bb-0170e2dd0e9ff/company-dashboard-copy-1?orgId=1&var-utilization=${formattedUtilization}&var-token=${bearerToken}&var-customerid=${cleanedId}&var-shift=${shiftListSerialized}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${FromTime}&var-toTime=${ToTime}&var-timeList=${formattedTime}&from=${from}&to=${to}&theme=light&kiosk`;

    setGrafanaURL(fullURL);
    console.log('Grafana Url',fullURL);
  };

  return (
    <div className="classbody" style={{ padding: '10px', background: '#fff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '35px', flexWrap: 'wrap' }}>
        <h4 className="classhead"><b>Company Dashboard</b></h4>
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
          <FormControl size="small" style={{ minWidth: 160, background: '#fff' }}>
            <InputLabel>Machines</InputLabel>
            <Select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              label="Machines"
            >
              <MenuItem value="all">All Machines</MenuItem>
              {devices.map((d) => (
                <MenuItem key={d.id.id} value={d.id.id}>{d.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" style={{ minWidth: 160, background: '#fff' }}>
            <InputLabel>Shifts</InputLabel>
            <Select
              value={selectedShift}
              onChange={(e) => {
                const selected = e.target.value;
                setSelectedShift(selected);
                const shiftData = shifts.find(s => s.shift_no === selected);
                setSelectedShiftData(shiftData || null);
                setSelectedShiftName(`${selected}`);
              }}
              label="Shifts"
            >
              <MenuItem value="allshift">All Shifts</MenuItem>
              {shifts.map((s) => (
                <MenuItem key={s.shift_no} value={s.shift_no}>
                  {s.shift_name || `Shift ${s.shift_no}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </div>

      <div className="iframe-panel" style={{ width: '100%', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
        <iframe
          src={grafanaURL}
          title="Grafana Dashboard"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      <div style={{ padding: '20px' }}>
        <h4>Average Utilization</h4>
        <ul>
          {utilizationData.map((item, idx) => (
            <li key={idx}>
              {item.label}: {item.value}%
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CompanyDashboard;
