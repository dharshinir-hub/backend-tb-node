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