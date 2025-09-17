import axiosInstance1 from "./loginservice";
 export const cleanCustomerId = (customerId) => {
    if (!customerId) return '';
    
    return customerId
      .replace(/\\/g, '')    // Remove backslashes
      .replace(/"/g, '')     // Remove quotes
      .trim();               // Remove whitespace
  };
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
    const response = await axiosInstance1.get(url, {
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

  export const Downtimeadd1 = async (entityType, entityId, scope, thresholddata) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/${scope}`;
        
        console.log('Device Shift API URL:', url);
  
        const response = await axiosInstance1.post(url, thresholddata);
        console.log('Device Shift API Response:', response);
  
        return response.data;
    } catch (error) {
        console.error('Error during Device Shift update:', error);
        throw error;
    }
  };


  
export const getMachineLock = async (entityType, entityId, { keys, useStrictDataTypes = false }) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
    const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries`;
    const response = await axiosInstance1.get(url, {
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
      
      const response = await axiosInstance1.get(
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
  
      const response = await axiosInstance1.get(url);
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
  
      const response = await axiosInstance1.get(url);
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
  
      const response = await axiosInstance1.get(url);
      console.log('Telemetry Key API Response:', response); // <-- Add this
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error('Error during telemetry key data:', error);
      throw error;
    }
  };
  
    export const Deviceattributeget = async (customerId,key) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const cleanedCustomerId = cleanCustomerId(customerId);

        const url = `${baseUrl}/api/plugins/telemetry/DEVICE/${customerId}/values/attributes?keys=${key}`;

      console.log(' API URL:', url);
  
      const response = await axiosInstance1.get(url);
      console.log(' API Response:', response); // <-- Add this
  
      return response.data;
    } catch (error) {
      console.error('Error during Shift latest data:', error);
      throw error;
    }
  };