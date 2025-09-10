import React, { useEffect, useState } from 'react';
import { telemetrykeydata } from '../../Services/app/andondashboardservice';
import './machinecard.css';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import {Deviceattributeget}from '../../Services/app/masterservice'
const MachineCard = () => {
  const navigate = useNavigate();
  const [grafanaUrl, setGrafanaUrl] = useState('');
  const [totalRunTime, setTotalRunTime] = useState('');
  const [totalIdleTime, setTotalIdleTime] = useState('');
  const [totalDisconnectTime, setTotalDisconnectTime] = useState('');
  const [totalAlarmTime, setTotalAlarmTime] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [filteredResult,setfilteredResult]=useState([]); // Changed from {} to []
  const [iframeInteractive, setIframeInteractive] = useState(true);
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIframeInteractive(false); // Disable interaction on Esc
      }
    };
  
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('deviceId');
    const fromTime = params.get('from'); 
    const toTime = params.get('to');
    const deviceNameParam = params.get('deviceName');
    if (deviceNameParam) {
      setDeviceName(deviceNameParam);
    }

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
          4: { state: "Alarm", color: "#F44336" },
        };

        let runTime = 0, idleTime = 0, disconnectTime = 0, alarmTime = 0;
        const sortedData = [...machineData].sort((a, b) => Number(a.ts) - Number(b.ts));
        let previousTs = Number(fromTime);
        let previousStatus = sortedData.length > 0 ? sortedData[0].value : null;
        
        for (let i = 0; i <= sortedData.length; i++) {
          const currentTs = i < sortedData.length ? Number(sortedData[i].ts) : Number(toTime);
          const currentStatus = i < sortedData.length ? sortedData[i].value : previousStatus;
        
          const duration = Math.max(0, currentTs - previousTs);
        
          const state = statusMapping[previousStatus]?.state;
          if (duration > 0 && state) {
            switch (state) {
              case "Run":
                runTime += duration;
                break;
              case "Idle":
                idleTime += duration;
                break;
              case "Disconnect":
                disconnectTime += duration;
                break;
              case "Alarm":
                alarmTime += duration;
                break;
            }
          }
        
          previousTs = currentTs;
          previousStatus = currentStatus;
        }
        
        

        const msToTime = ms => {
          const absMs = Math.abs(ms);
          const hours = Math.floor(absMs / 3600000);
          const minutes = Math.floor((absMs % 3600000) / 60000);
          const seconds = Math.floor((absMs % 60000) / 1000);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        setTotalRunTime(msToTime(runTime));
        setTotalIdleTime(msToTime(idleTime));
        setTotalDisconnectTime(msToTime(disconnectTime));
        setTotalAlarmTime(msToTime(alarmTime));

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
          telemetrykeydata(deviceId, 'DEVICE', 'shots', fromTime, toTime),
          telemetrykeydata(deviceId, 'DEVICE', ['averageOEE', 'averageAvailability', 'averagePerformance', 'quality'], fromTime, toTime),
          telemetrykeydata(deviceId, 'DEVICE', 'total_Shots', fromTime, toTime),
          Promise.resolve(downtimedatas)
        ]);
      })
      .then(([encodedData, shotsResponse, oeeResponse, totalShotsResponse, downtimedatas]) => {
        const shotData = shotsResponse?.shots || [];
    
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
    
        const orderedHours = generateHourRange(fromTime, toTime);
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
          console.log('last',last)
          console.log('first',first)
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
    
        const encodedBarData = encodeURIComponent(JSON.stringify(barData));
        const averageOEE = oeeResponse?.averageOEE?.[0]?.value || 0;
        const averageAvailability = oeeResponse?.averageAvailability?.[0]?.value || 0;
        const averagePerformance = oeeResponse?.averagePerformance?.[0]?.value || 0;
        const averageQuality = oeeResponse?.quality?.[0]?.value || 0;
    
        const oeeData = [{
          OEE: averageOEE,
          Availability: averageAvailability,
          Performance: averagePerformance,
          Quality: averageQuality
        }];
        const encodedOeeData = encodeURIComponent(JSON.stringify(oeeData));
        const totalShots = totalShotsResponse?.total_Shots?.[0]?.value || 0;
        const totalShotsData = [{
          TotalShots: totalShots
        }];
        const encodedTotalShotsData = encodeURIComponent(JSON.stringify(totalShotsData));
        const token = localStorage.getItem('token');
        const deviceId1 = params.get('deviceId');
        const starttimes = params.get('start-time');
        const endtimes = params.get('end-time');
        console.log('fromtime', fromTime);
        console.log('totime', toTime);
        console.log("fromTime:", fromTime, "Type:", typeof fromTime);
        console.log("toTime:", toTime, "Type:", typeof toTime);

        // Convert fromTime and toTime to Date objects
        const fromDate = new Date(Number(fromTime));
        const toDate = new Date(Number(toTime));
        
        // Include start and end times from params
        const startTimeParts = starttimes.split(':');
        const endTimeParts = endtimes.split(':');
        
        // Set hours and minutes from start/end times
        fromDate.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0, 0);
        toDate.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0, 0);
        
        // Convert to yesterday's date
        fromDate.setDate(fromDate.getDate() - 1);
        toDate.setDate(toDate.getDate() - 1);
        
        // Get epoch milliseconds
        const fromYesterdayEpoch = fromDate.getTime();
        const toYesterdayEpoch = toDate.getTime();
        
        console.log("Yesterday From:", fromDate.toString(), "Epoch:", fromYesterdayEpoch);
        console.log("Yesterday To:", toDate.toString(), "Epoch:", toYesterdayEpoch);

        // const fromyesterday = new Date(fromTime);
        // fromyesterday.setDate(fromyesterday.getDate() - 1);
        // const toyesterday = new Date(toTime);
        // toyesterday.setDate(toyesterday.getDate() - 1);
        if(deviceNameParam!='ROTOG'){
          const baseGrafanaUrl = `${window._env_.GRAFANA_URL}d/e40cb218-8486-4c8e-9d81-b4bf47d8978/machine-status`;
          const fullUrl = `${baseGrafanaUrl}?orgId=1&var-data1=${encodedData}&var-data2=${encodedBarData}&var-data3=${encodedOeeData}&var-data4=${encodedTotalShotsData}&var-data5=${downtimedatas}&var-device_id=${deviceId1}&var-token=${token}&var-from=${fromYesterdayEpoch}&var-to=${toYesterdayEpoch}&from=${fromTime}&to=${toTime}&kiosk&theme=light`;
          setGrafanaUrl(fullUrl);
          console.log('fullurl',fullUrl)
        }
        else{
          const baseGrafanaUrl = `${window._env_.GRAFANA_URL}d/f7aef44e-5c9d-4ff8-8c73-386d4fb908ec/machine-status-roto`;
          const fullUrl = `${baseGrafanaUrl}?orgId=1&var-data1=${encodedData}&var-data2=${encodedBarData}&var-data3=${encodedOeeData}&var-data4=${encodedTotalShotsData}&var-data5=${downtimedatas}&var-device_id=${deviceId1}&var-token=${token}&var-from=${fromYesterdayEpoch}&var-to=${toYesterdayEpoch}&from=${fromTime}&to=${toTime}&kiosk&theme=light`;
          setGrafanaUrl(fullUrl);
          console.log('fullurl',fullUrl)
        }
       
      })
      .catch(error => {
        console.error('Error loading telemetry data:', error);
      });
    
    }
  }, []);

  return (
    <div className="pages">
      <div className="pagecontents">
        <div className="left-labels" style={{display: 'flex',justifyContent:'space-between'}}>
          <h5>Machine Name : {deviceName}</h5>
          <Button type="submit" variant="contained" style={{backgroundColor:'#626262'}} onClick={() => navigate('/andon-dashboard')} className="filter_btn btn_orange" color="warning" >
          Back
              </Button>       
        </div>
        <br></br>
        <div className="metrics-container">
          <div className="metric-box">
            <img
              loading="lazy"
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/95d021d6a3fe38f186ced6618f2c96de1b843872491eee53366d33918322712e?placeholderIfAbsent=true&apiKey=9f17aecbe11342b3a92215778ac930da"
              className="metric-icon"
              alt="Run time status indicator"
            />
            <div className="metric-content">
              <span className="metric-value">{totalRunTime}</span>
              <div className="metric-label">Total Run</div>
            </div>
          </div>
          <div className="metric-box">
            <img
              loading="lazy"
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/3dbc1d1800e7f93d3c3bd3ec7565d9ca846802d6843a317a53c5627ec723f89e?placeholderIfAbsent=true&apiKey=9f17aecbe11342b3a92215778ac930da"
              className="metric-icon"
              alt="Idle time status indicator"
            />
            <div className="metric-content">
              <span className="metric-value">{totalIdleTime}</span>
              <div className="metric-label">Total Idle</div>
            </div>
          </div>
          <div className="metric-box">
            <img
              loading="lazy"
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/8f66452b44adfafa140ea5c973f59eddefe007fad26a40414feb23d6ad2a04a9?placeholderIfAbsent=true&apiKey=9f17aecbe11342b3a92215778ac930da"
              className="metric-icon"
              alt="Disconnect time status indicator"
            />
            <div className="metric-content">
              <span className="metric-value">{totalDisconnectTime}</span>
              <div className="metric-label">Total Disconnect</div>
            </div>
          </div>
          <div className="metric-box">
            <img
              loading="lazy"
              src="https://cdn.builder.io/api/v1/image/assets/TEMP/641f1bb7c73d956f7aff663cb56fabc99716421a0101466ce6096e74ee1958a7?placeholderIfAbsent=true&apiKey=9f17aecbe11342b3a92215778ac930da"
              className="metric-icon"
              alt="Alarm time status indicator"
            />
            <div className="metric-content">
              <span className="metric-value">{totalAlarmTime}</span>
              <div className="metric-label">Total Alarm</div>
            </div>
          </div>
        </div>
        {grafanaUrl && (
          <iframe
            title="Machine Status"
            src={grafanaUrl}
            width="100%"
            height="1400"
            frameBorder="0"
            allowFullScreen
            style={{ pointerEvents: iframeInteractive ? 'auto' : 'none' }} // ✅
            ></iframe>
        )}
      </div>
    </div>
  );
};

export default MachineCard;