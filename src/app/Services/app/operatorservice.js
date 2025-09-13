import axiosInstance from "../core/axiosconfig";
import axiosInstance1 from "./loginservice";

  export const operatorTelemetry = async (entityType, entityId, thresholddata) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/SERVER_SCOPE`;
        
        console.log('Assign operator API URL:', url);
  
        const response = await axiosInstance1.post(url, thresholddata);
        console.log('Assign operator API Response:', response);
  
        return response.data;
    } catch (error) {
        console.error('Error during Assign operator update:', error);
        throw error;
    }
  };

export const getFirstMachineActive = async (entityType, entityId, { keys, startTs, endTs, interval = 0, limit = 10000, useStrictDataTypes = false }) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
    const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries`;
    const response = await axiosInstance.get(url, {
      params: {
        keys,
        startTs,
        endTs,
        interval,
        limit,
        useStrictDataTypes,
      },
    });
    console.log('Telemetry API URL:', response.config.url);
    console.log('Telemetry API Response:', response);
    return response.data;
  } catch (error) {
    console.error('Error during telemetry fetch:', error);
    throw error;
  }
  }

//   export const unlockMachine = async (entityType, entityId) => {
//   try {
//     const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash
//     const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/values/attributes`;

//     const payload = {
//       lock_status: "unlocked", // 👈 payload to unlock machine
//     };

//     const response = await axiosInstance.post(url, payload);

//     console.log("Unlock API URL:", response.config.url);
//     console.log("Unlock API Payload:", payload);
//     console.log("Unlock API Response:", response);

//     return response.data;
//   } catch (error) {
//     console.error("Error unlocking machine:", error);
//     throw error;
//   }
// };


  
export const getMachineLock = async (entityType, entityId, { keys, useStrictDataTypes = false }) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
    const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries`;
    const response = await axiosInstance.get(url, {
      params: {
        keys,
        useStrictDataTypes,
      },
    });
    console.log('Machine lock API URL:', response.config.url);
    console.log('Machine lock Response:', response);
    return response.data;
  } catch (error) {
    console.error('Error during telemetry fetch:', error);
    throw error;
  }
  };