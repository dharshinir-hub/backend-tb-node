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
  };