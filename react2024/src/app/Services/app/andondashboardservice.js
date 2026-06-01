 import axiosInstance from '../core/axiosconfig'; 
 export const cleanCustomerId = (customerId) => {
    if (!customerId) return '';
    
    return customerId
      .replace(/\\/g, '')    // Remove backslashes
      .replace(/"/g, '')     // Remove quotes
      .trim();               // Remove whitespace
  };
 export const customerbaseddevices = async (customerId, pageSize, page) => {
    try {
      // Log the full URL being called
      const fullUrl = `${window._env_.SERVER_URL}api/customer/${customerId}/devices?pageSize=${pageSize}&page=${page}`;
      console.log('Full URL being called:', fullUrl);
      console.log('Parameters:', { customerId, pageSize, page });
      const cleanedCustomerId = cleanCustomerId(customerId);
    
      console.log('Original customerId:', customerId);
      console.log('Cleaned customerId:', cleanedCustomerId);
      
      // Validate the cleaned ID is a proper UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(cleanedCustomerId)) {
        throw new Error(`Invalid UUID format after cleaning: ${cleanedCustomerId}`);
      }
      
      const response = await axiosInstance.get(
        `${window._env_.SERVER_URL}api/customer/${cleanedCustomerId}/devices?pageSize=${pageSize}&page=${page}`,
        {
          // Add any required headers
          headers: {
            'Content-Type': 'application/json',
            // Add authentication if required
            // 'Authorization': `Bearer ${token}`,
          },
          // Add timeout
          timeout: 0,
        }
      );
      
      console.log('Device Response:', response);
      return response.data;
    } catch (error) {
      console.error('Error during Device:', error);
      
      // Enhanced error logging
      if (error.response) {
        // Server responded with error status
        console.error('Response Status:', error.response.status);
        console.error('Response Data:', error.response.data);
      }
      
      throw error;
    }
  };
 
  export const customerbasedshift = async (customerId,key) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const cleanedCustomerId = cleanCustomerId(customerId);

        const url = `${baseUrl}/api/plugins/telemetry/CUSTOMER/${cleanedCustomerId}/values/attributes?keys=${key}`;

      console.log('Shift API URL:', url);
  
      const response = await axiosInstance.get(url);
      console.log('Shift API Response:', response); // <-- Add this
  
      return response.data;
    } catch (error) {
      console.error('Error during Shift latest data:', error);
      throw error;
    }
  };

  export const userbasedrole = async (customerId,key) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const cleanedCustomerId = cleanCustomerId(customerId);

        const url = `${baseUrl}/api/plugins/telemetry/USER/${cleanedCustomerId}/values/attributes?keys=${key}`;

      console.log('Shift API URL:', url);
  
      const response = await axiosInstance.get(url);
      console.log('Shift API Response:', response); // <-- Add this
  
      return response.data;
    } catch (error) {
      console.error('Error during Shift latest data:', error);
      throw error;
    }
  };
  export const telemetrylatestdata = async (deviceId, entitytype, key) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const url = `${baseUrl}/api/plugins/telemetry/${entitytype}/${deviceId}/values/timeseries?keys=${key}&useStrictDataTypes=false`;
          
      console.log('Telemetry API URL:', url);
  
      const response = await axiosInstance.get(url);
      console.log('Telemetry API Response:', response); // <-- Add this
  
      return response.data;
    } catch (error) {
      console.error('Error during telemetry latest data:', error);
      throw error;
    }
  };

  export const telemetrycustomerlatestdata = async (deviceId, entitytype, key) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const cleanedCustomerId = cleanCustomerId(deviceId);
        const url = `${baseUrl}/api/plugins/telemetry/${entitytype}/${cleanedCustomerId}/values/timeseries?keys=${key}&useStrictDataTypes=false`;
          
      console.log('Telemetry API URL:', url);
  
      const response = await axiosInstance.get(url);
      console.log('Telemetry API Response:', response); // <-- Add this
  
      return response.data;
    } catch (error) {
      console.error('Error during telemetry latest data:', error);
      throw error;
    }
  };
  export const telemetrykeydata = async (deviceId, entitytype, key,starttime,endtime) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const url = `${baseUrl}/api/plugins/telemetry/${entitytype}/${deviceId}/values/timeseries?keys=${key}&startTs=${starttime}&endTs=${endtime}&interval=0&limit=50000&useStrictDataTypes=false`;
        console.log('Telemetry Key API URL:', url);
  
      const response = await axiosInstance.get(url);
      console.log('Telemetry Key API Response:', response); // <-- Add this
      console.log(response.data);
      return response.data;
      

    
    } catch (error) {
      console.error('Error during telemetry key data:', error);
      throw error;
    }
  };
  
  
  