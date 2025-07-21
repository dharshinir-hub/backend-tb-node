import axiosInstance from '../core/axiosconfig'; 
import axios from 'axios';
export const cleanCustomerId = (customerId) => {
    if (!customerId) return '';
    
    return customerId
      .replace(/\\/g, '')    // Remove backslashes
      .replace(/"/g, '')     // Remove quotes
      .trim();               // Remove whitespace
  };
  const axiosInstance1 = axios.create({
    baseURL: window._env_.SERVER_URL,
  });
  
  axiosInstance1.interceptors.request.use(config => {
    const token = localStorage.getItem('token1');
    if (token) {
      config.headers['X-Authorization'] = `Bearer ${token}`;
    }
    return config;
  });
  export default axiosInstance1;

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
  export const shiftadd = async (shiftdata,customerId,scope) => {
    try {
      const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const cleanedCustomerId = cleanCustomerId(customerId);
      const response = await axiosInstance1.post(`${baseUrl}/api/plugins/telemetry/CUSTOMER/${cleanedCustomerId}/${scope}`, shiftdata);
      // /api/plugins/telemetry/{entityType}/{entityId}/{scope}
      console.log('Response' ,response)
      return response.data; // Return the response data
    } 
    catch (error) {
      console.error('Error during login:', error);
      throw error; // Rethrow the error to handle it in the calling function
    }
  };

  export const Downtimeadd = async (entityType, entityId, scope, thresholddata) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/attributes/${scope}`;
        
        console.log('Device Shift API URL:', url);
  
        const response = await axiosInstance.post(url, thresholddata);
        console.log('Device Shift API Response:', response);
  
        return response.data;
    } catch (error) {
        console.error('Error during Device Shift update:', error);
        throw error;
    }
  };

  export const Downtimeadd1 = async (entityType, entityId, scope, thresholddata) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/${scope}`;
        
        console.log('Device Shift API URL:', url);
  
        const response = await axiosInstance.post(url, thresholddata);
        console.log('Device Shift API Response:', response);
  
        return response.data;
    } catch (error) {
        console.error('Error during Device Shift update:', error);
        throw error;
    }
  };
  export const DowntimeaddDelete = async (entityType, entityId, key, starttime, endtime) => {
    try {
      const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
      const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/delete?keys=${encodeURIComponent(key)}&startTs=${starttime}&endTs=${endtime}`;
      console.log('Timeseries Delete API URL:', url);
  
      const response = await axiosInstance.delete(url);
      console.log('Timeseries Delete API Response:', response);
  
      if (response.status === 200 || response.status === 204) {
        return true; // ✅ Successful delete
      } else {
        return false; // ❌ Something went wrong
      }
    } catch (error) {
      console.error('Error during Device Shift update:', error);
      throw error; // Let caller handle it
    }
  };

  export const DowntimeaddDelete1 = async (entityType, entityId, key, starttime, endtime) => {
    try {
      const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
      const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/delete?keys=${encodeURIComponent(key)}&startTs=${starttime}&endTs=${endtime}`;
      console.log('Timeseries Delete API URL:', url);
  
      const response = await axiosInstance1.delete(url);
      console.log('Timeseries Delete API Response:', response);
  
      if (response.status === 200 || response.status === 204) {
        return true; // ✅ Successful delete
      } else {
        return false; // ❌ Something went wrong
      }
    } catch (error) {
      console.error('Error during Device Shift update:', error);
      throw error; // Let caller handle it
    }
  };
  
  export const Downtimeadd2 = async (entityType, entityId, scope, thresholddata) => {
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
  export const Deviceattributeget = async (customerId,key) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, ''); // Remove trailing slash if any
        const cleanedCustomerId = cleanCustomerId(customerId);

        const url = `${baseUrl}/api/plugins/telemetry/DEVICE/${customerId}/values/attributes?keys=${key}`;

      console.log(' API URL:', url);
  
      const response = await axiosInstance.get(url);
      console.log(' API Response:', response); // <-- Add this
  
      return response.data;
    } catch (error) {
      console.error('Error during Shift latest data:', error);
      throw error;
    }
  };