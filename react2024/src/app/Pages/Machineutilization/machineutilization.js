import { useEffect, useState } from "react";
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';


const MachineUtilization = () => {
  const [grafanaUrl, setGrafanaUrl] = useState("");
  const [deviceName, setDeviceName] = useState(""); // For storing the device name
  const navigate = useNavigate();
 const newToken = localStorage.getItem('newToken');
   const [iframeInteractive, setIframeInteractive] = useState(true);


useEffect(() => {
  const handleEsc = (e) => {
    // Only react if the event is not coming from the iframe
    if (e.target === document.body && e.key === 'Escape') {
      setIframeInteractive(false);
    }
  };

  window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, []);




  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get("deviceId");
    const from = params.get("from");
    const to = params.get("to");
    const fromTime = params.get("fromTime");
    const toTime = params.get("toTime");
    const deviceName = params.get("deviceName");
 
    console.log("URL Params:", { deviceId, from, to, fromTime, toTime, deviceName });

    if (deviceName) {
      setDeviceName(deviceName); // Store the deviceName if it's found
    }

    // Construct the Grafana URL once all params are available
    if (deviceId && from && to && fromTime && toTime) {
      const bearerToken = encodeURIComponent(`Bearer+${newToken}`);
      const baseUrl = window._env_.SERVER_URL;
      const GRAFANA_URL = window._env_.GRAFANA_URL;

      const url = `${GRAFANA_URL}d/ca045704-dd28-4115-9441-0fa3a94e0a02/mm-production-utilization-2-copy-copy?orgId=1&var-token=${bearerToken}&var-entityType=DEVICE&var-deviceId=${deviceId}&var-deviceName=${deviceName}&var-fromTime=${fromTime}&var-toTime=${toTime}&var-from=${from}&var-to=${to}&var-url=${baseUrl}&var-grafanaurl=${GRAFANA_URL}&kiosk&theme=light`;

            console.log("Final Grafana URL:", url);

      setGrafanaUrl(url); // Set the Grafana URL to be used in the iframe
    }
  }, []); // Runs once when the component is mounted

  if (!grafanaUrl) {
    return <div>Loading Grafana Dashboard...</div>; // Show a loading message while the URL is being constructed
  }

  return (
    <div style={{ paddingTop: '40px', paddingLeft: '0px', background: 'transparent', minHeight: '100vh' }}>
  <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px' }}>
    <Button
      type="submit"
      variant="contained"
      style={{ backgroundColor: '#626262' }}
      onClick={() => navigate('/company')}
      className="filter_btn btn_orange"
      color="warning"
    >
      Back
    </Button>
  </div>

  <iframe
    src={grafanaUrl}
    style={{ width: "100%", height: "90vh", border: "0",pointerEvents: iframeInteractive ? 'auto' : 'none' }}
    
    title={`Machine Utilization - ${deviceName}`}
  />
</div>

  );
};

export default MachineUtilization;
