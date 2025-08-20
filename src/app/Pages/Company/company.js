import React, { useEffect, useState } from 'react';
import { MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

import {
  cleanCustomerId,
  telemetrylatestdata,
  customerbaseddevices,
  customerbasedshift,
  telemetrykeydata
} from '../../Services/app/companyservice';
import './company.css';

const CompanyDashboard = () => {
  const customerId = localStorage.getItem('CustomerID');
  const newToken = localStorage.getItem('newToken');

  const [devices, setDevices] = useState([]);
  const [deviceNameIdJson, setDeviceNameIdJson] = useState({});
  const [shifts, setShifts] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedShift, setSelectedShift] = useState('allshift');
  const [selectedShiftData, setSelectedShiftData] = useState(null);
  const [utilizationData, setUtilizationData] = useState([]);
  const [formattedUtilization, setFormattedUtilization] = useState('');
  const [grafanaURL, setGrafanaURL] = useState('');
  const [timeData, setTimeData] = useState([]);
  const [formattedTime, setFormattedTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fromTime, setFromTime] = useState(null);
  const [toTime, setToTime] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
const [selectedDate, setSelectedDate] = useState(dayjs());

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
  }, [selectedDevice, formattedUtilization, formattedTime, selectedShiftData, fromTime, toTime, from, to]);

  useEffect(() => {
    if (shifts.length > 0) {
      const { from, to } = getShiftTimes(shifts, selectedShift);
      setFrom(from);
      setTo(to);
      setShiftTimingForSelected();
    }
  }, [shifts, selectedShift]);

  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, 'allShift');
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);
    } catch (err) {
      console.error('Failed to fetch shifts', err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];

      setDevices(devicesList);

      // Extract device name and id into JSON
      const nameIdMap = devicesList.reduce((acc, device) => {
        acc[device.name] = device.id.id;
        return acc;
      }, {});
      
      setDeviceNameIdJson(nameIdMap); // store in global state
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };
console.log('Device Id',deviceNameIdJson);
  // Global variable to store device name and id




const fetchAverageUtilizationForAllDevices = async () => {
    const customerId = localStorage.getItem('CustomerID');

  try {
    const cleanedId = cleanCustomerId(customerId);
 

    const lowerUtilResponse = await telemetrykeydata(cleanedId, 'CUSTOMER', 'lowerutilization', from, to);
    const timeseries = lowerUtilResponse?.lowerutilization || [];

    if (!timeseries.length) {
      console.warn('No lowerutilization timeseries found.');
      return;
    }
    

    const devicesToFetch =
      selectedDevice === 'all'
        ? devices.map(d => d.name)
        : devices.filter(d => d.id?.id === selectedDevice).map(d => d.name);

    const utilizationList = devicesToFetch.map(deviceName => {
      const hourlyBuckets = {};


      // Group by hour
      timeseries.forEach(({ ts, value }) => {
        try {
          const hour = new Date(ts).getHours();
          const parsed = JSON.parse(value);
          const deviceData = parsed?.[deviceName];
          if (!deviceData) return;
        


          if (!hourlyBuckets[hour]) hourlyBuckets[hour] = [];
          hourlyBuckets[hour].push({
            ts,
            utilization: deviceData.utilization,
            expected: deviceData.expected_utilization
          });
        } catch (e) {
          console.error(`❌ Error parsing telemetry at ts=${ts}`, e);
        }
      });

      const hourlyUtilValues = [];
      const hourlyExpectedValues = [];

      console.log(`\n📍 Device: ${deviceName}`);

      Object.entries(hourlyBuckets).forEach(([hour, entries]) => {
        const sorted = entries.sort((a, b) => b.ts - a.ts);

        for (const entry of sorted) {
          const uVal = parseFloat(entry.utilization);
          const eVal = parseFloat(entry.expected);
          if (uVal !== 0 || eVal !== 0) {
            if (uVal !== 0) hourlyUtilValues.push(uVal);
            if (eVal !== 0) hourlyExpectedValues.push(eVal);

            console.log(`✅ Hour ${hour}: ${new Date(entry.ts).toLocaleTimeString()} — Util=${uVal}, Expected=${eVal}`);
            break;
          }
        }
      });

      const utilizationAvg = hourlyUtilValues.reduce((a, b) => a + b, 0) / hourlyUtilValues.length || 0;
      const expectedAvg = hourlyExpectedValues.reduce((a, b) => a + b, 0) / hourlyExpectedValues.length || 0;

      console.log(`📊 Averages for ${deviceName} — Util=${utilizationAvg.toFixed(2)}, Expected=${expectedAvg.toFixed(2)}`);

      return {
        label: deviceName,
        utilization: utilizationAvg.toFixed(2),
        expected_utilization: expectedAvg.toFixed(2)
      };
    });

    console.log('\n✅ Final Utilization List:', utilizationList);
    setUtilizationData(utilizationList);
    setFormattedUtilization(encodeURIComponent(JSON.stringify(utilizationList)));
    console.log('Utilization list',utilizationList)

  } catch (error) {
    console.error('❌ Error fetching average utilization:', error);
  }
};

    console.log('Utilization list',formattedUtilization)


useEffect(() => {
  if (devices.length > 0) {
    fetchAverageUtilizationForAllDevices();
  }
}, [devices, selectedDevice]);


  const fetchTimeTelemetryForAllDevices = async () => {
  try {
    // Determine devices to fetch
    const devicesToFetch =
      selectedDevice === 'all'
        ? devices
        : devices.filter((device) => device.id?.id === selectedDevice);

    // Fetch telemetry for each device
    const timeList = await Promise.all(
      devicesToFetch.map(async (device) => {
        try {
          const response = await telemetrylatestdata(device.id?.id, 'DEVICE', 'time');
          const timeValue = response?.time?.[0]?.value || '{}';
          return { label: device.name, id: device.id?.id, time: timeValue };
        } catch {
          return { label: device.name, id: device.id?.id, time: '{}' };
        }
      })
    );

    setTimeData(timeList);

    // Format based on selection
    const filteredFormattedTime =
      selectedDevice === 'all'
        ? timeList // show all
        : timeList.filter((entry) => entry.id === selectedDevice); // show only selected

    setFormattedTime(encodeURIComponent(JSON.stringify(filteredFormattedTime)));
  } catch (error) {
    console.error('Error fetching time telemetry:', error);
  }
};

useEffect(() => {
  if (devices.length > 0) {
    fetchTimeTelemetryForAllDevices();
  }
}, [devices, selectedDevice]);

useEffect(() => {
  console.log('Formatted Time:', decodeURIComponent(formattedTime));
}, [formattedTime]);




  const setShiftTimingForSelected = () => {
    try {
      let starttime = '';
      let endtime = '';
      let shiftData = null;

      if (selectedShift === 'allshift') {
        shiftData = shifts.find((shift) => shift.shift_no === 1);
        if (shiftData) {
          starttime = shiftData.start_time;
          const now = new Date();
          endtime = now.toTimeString().split(' ')[0];
        }
      } else {
        shiftData = shifts.find((shift) => String(shift.shift_no) === String(selectedShift));
        if (shiftData) {
          starttime = shiftData.start_time;
          endtime = shiftData.end_time;
        }
      }

      if (shiftData) {
        setSelectedShiftData(shiftData);
      }

      setStartTime(starttime);
      setEndTime(endtime);
    } catch (error) {
      console.error('Error setting shift timing:', error);
    }
  };



  function combineDateAndTimeToMs(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return new Date(`${dateStr}T${timeStr}`).getTime();
}

function getShiftTimes(shifts, selectedShift, selectedDate) {
  if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
    return { from: null, to: null };
  }

  const todayStr = dayjs(selectedDate).format("YYYY-MM-DD");
  const nextDayStr = dayjs(selectedDate).add(1, 'day').format("YYYY-MM-DD");

  let from = null;
  let to = null;

  const normalizedShift = selectedShift.trim().toLowerCase();

  if (normalizedShift === 'allshift' || normalizedShift === 'all shift') {
    const sortedShifts = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
    const firstShiftStart = sortedShifts[0]?.start_time;
    const lastShiftEnd = sortedShifts[sortedShifts.length - 1]?.end_time;


    
    if (firstShiftStart && lastShiftEnd) {
      const fromStr = `${todayStr}T${firstShiftStart}`;
      const toStr = lastShiftEnd <= firstShiftStart
        ? `${nextDayStr}T${lastShiftEnd}`
        : `${todayStr}T${lastShiftEnd}`;

      from = new Date(fromStr).getTime(); // ✅ ms
      to = new Date(toStr).getTime();     // ✅ ms
    }
  } else {
    const shiftData = shifts.find((s) => String(s.shift_no) === String(selectedShift));
    if (shiftData) {
      const shiftStart = shiftData.start_time;
      const shiftEnd = shiftData.end_time;

      const fromStr = `${todayStr}T${shiftStart}`;
      const toStr = shiftEnd <= shiftStart
        ? `${nextDayStr}T${shiftEnd}`
        : `${todayStr}T${shiftEnd}`;

      from = new Date(fromStr).getTime(); // ✅ ms
      to = new Date(toStr).getTime();     // ✅ ms
    }
  }

  return { from, to }; // ✅ both in ms
}


  console.log('From', from, 'to', to);

function calculateShiftTimesWithDate(shifts, selectedShift, selectedDate) {
  if (!Array.isArray(shifts) || shifts.length === 0 || !selectedDate) {
    return { fromEpoch: null, toEpoch: null };
  }

  const baseDate = dayjs(selectedDate).subtract(1, 'day').format("YYYY-MM-DD");
  const todayStr = dayjs(selectedDate).format("YYYY-MM-DD");

  let fromEpoch = null;
  let toEpoch = null;

  const normalizedShift = selectedShift?.trim().toLowerCase() || "";

  if (normalizedShift === "allshift" || normalizedShift === "all shift") {
    const sortedShifts = [...shifts].sort((a, b) => Number(a.shift_no) - Number(b.shift_no));
    const firstShiftStart = sortedShifts[0]?.start_time;
    const lastShiftEnd = sortedShifts[sortedShifts.length - 1]?.end_time;

    if (firstShiftStart && lastShiftEnd) {
      fromEpoch = new Date(`${baseDate}T${firstShiftStart}`).getTime();
      toEpoch = new Date(`${baseDate}T${lastShiftEnd}`).getTime();

      if (lastShiftEnd <= firstShiftStart) {
        toEpoch = new Date(`${todayStr}T${lastShiftEnd}`).getTime();
      }
    }
  } else {
    const shiftData = shifts.find((s) => String(s.shift_no) === String(selectedShift));
    if (shiftData) {
      const shiftStart = shiftData.start_time;
      const shiftEnd = shiftData.end_time;

      fromEpoch = new Date(`${baseDate}T${shiftStart}`).getTime();
      toEpoch = new Date(`${baseDate}T${shiftEnd}`).getTime();

      if (shiftEnd <= shiftStart) {
        toEpoch = new Date(`${todayStr}T${shiftEnd}`).getTime();
      }
    }
  }

  return { fromEpoch, toEpoch };
}

  console.log("FromTime (epoch):", fromTime);
  console.log("ToTime (epoch):", toTime);
  console.log("Shifts data type:", typeof shifts, shifts);

useEffect(() => {
  if (!shifts.length || !selectedShift || !selectedDate) return;

  const { fromEpoch, toEpoch } = calculateShiftTimesWithDate(shifts, selectedShift, selectedDate);
  const { from, to } = getShiftTimes(shifts, selectedShift, selectedDate);

  if (fromEpoch && toEpoch && from && to) {
    setFromTime(fromEpoch);
    setToTime(toEpoch);
    setFrom(from);
    setTo(to);

    console.log("✅ fromTime:", fromEpoch);
    console.log("✅ toTime:", toEpoch);
    console.log("✅ from:", from);
    console.log("✅ to:", to);
  }
}, [shifts, selectedShift, selectedDate]); 






  const updateGrafanaURL = () => {
    const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
    const shiftListSerialized = encodeURIComponent(JSON.stringify(shifts));
    const cleanedId = cleanCustomerId(customerId);
    const encodedid = encodeURIComponent(JSON.stringify(deviceNameIdJson))
    console.log('id',encodedid);
     

    let entityType = 'CUSTOMER';
    let entityId = cleanedId;
    if (selectedDevice !== 'all') {
      entityType = 'DEVICE';
      entityId = selectedDevice;
    }


    const baseUrl = window._env_.SERVER_URL;
 console.log('baseurl',baseUrl);

 const GRAFANA_URL = window._env_. GRAFANA_URL;
 console.log('GRAFANA_URL',GRAFANA_URL);



    const fullURL = `http://192.168.0.224:3000/d/a7c6259b-3acb-45ed-92bb-0170e2dd0e9ff/company-dashboard-copy-1?orgId=1&var-utilization=${formattedUtilization}&var-token=${bearerToken}&var-customerid=${cleanedId}&var-shift=${shiftListSerialized}&var-entityType=${entityType}&var-entityId=${entityId}&var-fromTime=${fromTime}&var-toTime=${toTime}&var-timeList=${formattedTime}&from=${from}&to=${to}&var-allid=${encodedid}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&theme=light&kiosk`;


    setGrafanaURL(fullURL);

  };
  console.log('Grafana Url', grafanaURL);
  

  return (
    <div style={{ padding: '10px', background: '#fff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', flexWrap: 'wrap' }}>
        <h4><b>Company Dashboard</b></h4>
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
          <FormControl size="small" style={{ minWidth: 160, background: '#fff' }}>
            <InputLabel>Machines</InputLabel>
            <Select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
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
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              <MenuItem value="allshift">All Shifts</MenuItem>
              {shifts.map((s) => (
                <MenuItem key={s.shift_no} value={s.shift_no}>
                  {s.shift_name || `Shift ${s.shift_no}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
  label="Select Date"
  value={selectedDate}
  onChange={(newValue) => setSelectedDate(newValue)}
  format="DD-MM-YYYY"
/>

          </LocalizationProvider>
        </div>
      </div>

      <div style={{ width: '100%', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
        <iframe src={grafanaURL} title="Grafana Dashboard" style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    </div>
  );
};

export default CompanyDashboard;
