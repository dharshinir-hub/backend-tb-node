import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import {
  cleanCustomerId,
  telemetrylatestdata,
  customerbaseddevices,
  customerbasedshift
} from '../../Services/app/companyservice';
import './Alarm.css';

const Alarm = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedShift, setSelectedShift] = useState('');
  const [shifts, setShifts] = useState([]);
  const [iframeUrl, setIframeUrl] = useState('');
  const [devices, setDevices] = useState([]);
  const [machineData, setMachineData] = useState([]);
  const [deviceNameIdList, setDeviceNameIdList] = useState([]);
 const [fromEpoch, setFromEpoch] = useState(null);
const [toEpoch, setToEpoch] = useState(null);
const [customerData, setcustomerDataArray] = useState([]);


  const customerId = cleanCustomerId(localStorage.getItem('CustomerID'));

  const getCurrentShift = () => {
    const now = dayjs();
    const time = now.format('HH:mm:ss');
    return time >= '08:00:00' && time < '20:00:00' ? '1' : '2';
  };

 const getEpochFromShift = (shiftNo, selectedDateObj) => {
  const selectedShiftData = shifts.find(shift => String(shift.shift_no) === String(shiftNo));
  if (!selectedShiftData || !selectedDateObj) return { fromEpoch: null, toEpoch: null };

  const dateStr = selectedDateObj.format('YYYY-MM-DD');
  const startDateTime = dayjs(`${dateStr}T${selectedShiftData.start_time}`);
  let endDateTime;

  if (shiftNo === '2') {
    const nextDay = selectedDateObj.add(1, 'day').format('YYYY-MM-DD');
    endDateTime = dayjs(`${nextDay}T${selectedShiftData.end_time}`);
  } else {
    endDateTime = dayjs(`${dateStr}T${selectedShiftData.end_time}`);
  }

  if (dateStr === dayjs().format('YYYY-MM-DD') && dayjs().isBefore(endDateTime)) {
    endDateTime = dayjs();
  }

  return {
    fromEpoch: startDateTime.valueOf(),
    toEpoch: endDateTime.valueOf()
  };
};


  const fetchShifts = async () => {
    try {
      const result = await customerbasedshift(customerId, 'allShift');
      const shiftList = result[0]?.value || [];
      setShifts(shiftList);
      localStorage.setItem('shifts', JSON.stringify(shiftList));
      const currentShift = getCurrentShift();
      setSelectedShift(currentShift);
    } catch (err) {
      console.error('Failed to fetch shifts', err);
    }
  };

  const fetchDevices = async () => {
    try {
      const result = await customerbaseddevices(customerId, 100, 0);
      const devicesList = result.data || [];
      setDevices(devicesList);
    } catch (err) {
      console.error('Failed to fetch devices', err);
    }
  };

  const extractDeviceNameId = (devicesList) => {
    const list = devicesList.map(device => ({
      name: device.name,
      id: device.id.id
    }));
    setDeviceNameIdList(list);
    return list;
  };
      console.log('Device List',deviceNameIdList);


  const fetchMachineData = async () => {
    if (devices.length === 0) return;

    const currentTs = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const machineArray = [];

    for (const device of devices) {
      try {
        const telemetry = await telemetrylatestdata(device.id.id, 'DEVICE', 'runduration');
        const rundurationValue = telemetry?.runduration?.[0]?.value || 0;
        const formattedDuration = formatDuration(rundurationValue);

        machineArray.push({
          name: device.name,
          ts: currentTs,
          runduration: formattedDuration
        });
      } catch (err) {
        console.error(`Failed to fetch telemetry for ${device.name}`, err);
      }
    }

    setMachineData(machineArray);
    console.log('Machine Data' ,machineData);
  };

  const formatDuration = (value) => {
    const seconds = parseInt(value, 10);
    if (isNaN(seconds)) return '00:00:00';

    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const updateIframeUrl = (fromEpoch, toEpoch) => {
    const newToken = localStorage.getItem('newToken');
    if (!newToken || !fromEpoch || !toEpoch) return;

    const encodedMachineData = encodeURIComponent(JSON.stringify(machineData));
    const encodedDeviceList = encodeURIComponent(JSON.stringify(deviceNameIdList));

    const fullIframeUrl = `http://demo.yantra24x7.com:3000/d/efabde71-deb9-4a5d-9156-eea1a1aa8cfa/main-screen-valve-c-46-summary-3?orgId=1&var-token=${encodeURIComponent(newToken)}&var-fromTime=${fromEpoch}&var-toTime=${toEpoch}&var-machineData=${encodedMachineData}&var-deviceid=${encodedDeviceList}&theme=light&kiosk`;

    setIframeUrl(fullIframeUrl);
    console.log('first Grafana Url',fullIframeUrl);
  };

 const fetchCustomerTelemetryData = async () => {
  if (!Array.isArray(customerbaseddevices) || customerbaseddevices.length === 0) {
    console.warn('No valid customer-based devices available:', customerbaseddevices);
    return;
  }

  const currentTs = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const customerDataArray = [];

  for (const customer of customerbaseddevices) {
    try {
      const telemetry = await telemetrylatestdata(
        customer.id.id,
        'CUSTOMER',
        'overall_performance,overall_oee,overall_availability'
      );

      const performance = telemetry?.overall_performance?.[0]?.value || 0;
      const oee = telemetry?.overall_oee?.[0]?.value || 0;
      const availability = telemetry?.overall_availability?.[0]?.value || 0;

      customerDataArray.push({
        name: customer.name,
        ts: currentTs,
        overall_performance: Number(performance),
        overall_oee: Number(oee),
        overall_availability: Number(availability),
      });
    } catch (err) {
      console.error(`Failed to fetch telemetry for ${customer.name}`, err);
    }
  }

  console.log('Customer Telemetry Data:', customerDataArray);
  setcustomerDataArray(customerDataArray);
};
console.log('Customer Data',customerData);




  

const handleMachineClick = (deviceId) => {
 const fromTime = fromEpoch;
 const toTime = toEpoch;

  // Get device name
  const device = devices.find((d) => d.id.id === deviceId);
  const deviceName = device?.name || '';
  const encodedDeviceName = encodeURIComponent(deviceName);

  // Create Grafana URL
  const grafanaLink = `http://demo.yantra24x7.com:3000/d/f1db1e7b-9eac-4ce6-89bd-92e71f994004/main-screen-valve-c-46-summary-3-copy-2?orgId=1&var-fromTime=${fromTime}&var-toTime=${toTime}&theme=light&var-device_id=${deviceId}&var-device_name=${encodedDeviceName}&kiosk`;

  // Set iframe URL
  setIframeUrl(grafanaLink);

  // Debug log
  console.log('📊 Grafana URL:', grafanaLink);
};




  useEffect(() => {
    fetchShifts();
    fetchDevices();
  }, []);

  useEffect(() => {
    if (devices.length > 0) {
      extractDeviceNameId(devices);
      fetchMachineData();
    }
  }, [devices]);
useEffect(() => {
  if (selectedShift && selectedDate && shifts.length > 0) {
    const { fromEpoch, toEpoch } = getEpochFromShift(selectedShift, selectedDate);
    setFromEpoch(fromEpoch);
    setToEpoch(toEpoch);
  }
}, [selectedShift, selectedDate, shifts]);

useEffect(() => {
  fetchCustomerTelemetryData();
}, [customerbaseddevices]);



  return (
    <div className="pages">
      <div className="pagecontents">
        <div
          className="top-bar"
          style={{ display: 'flex',justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h5 className="head">
            <b>Production Monitoring Alarms</b>
          </h5>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Select Date"
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                format="DD-MM-YYYY"
                disableFuture
              />
            </LocalizationProvider>

            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Select Shift</InputLabel>
              <Select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                {shifts.map((shift) => (
                  <MenuItem key={shift.shift_no} value={String(shift.shift_no)}>
                    Shift {shift.shift_no}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>

        <div style={{ display: 'flex', marginTop: '10px' }}>
          <div style={{ width: '30%', paddingRight: '20px' }}>
            <h5>Summary</h5>
            <p>Completed Runs</p>

            <div className="machine-summary-list" style={{ backgroundColor: 'white' }}>
              {machineData.map((machine, index) => {
                const device = devices.find((d) => d.name === machine.name);
                const deviceId = device?.id?.id || '';
                return (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#f5f8fc',
                      border: '1px solid #d3d3d3',
                      borderRadius: '5px',
                      padding: '12px 16px',
                      marginBottom: '12px',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleMachineClick(deviceId)}
                  >
                    <div style={{ fontWeight: 'bold' }}>{machine.name}</div>
                    <div style={{ fontSize: '14px' }}>
                      Time: {dayjs(machine.ts).format('DD/MM/YYYY, HH:mm')}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      Duration: {machine.runduration}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ width: '70%' }}>
            <iframe
              title="Grafana Panel"
              src={iframeUrl}
              style={{ width: '100%', height: '100%', border: '0' }}
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alarm;
