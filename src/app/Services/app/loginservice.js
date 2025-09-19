// loginservice.js
import axios from 'axios';
 import axiosInstance from '../core/axiosconfig'; 
import { cleanCustomerId } from './alarmservice';
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

export const Loginapi = async (username,password) => {
  try {
   const response = await axios.post(`${window._env_.SERVER_URL}api/auth/login`, {
     username,password
    });
//    const response = await axios.post(`http://192.168.2.164:8080/api/auth/login`, {
//   username: "tenant@thingsboard.org",
//   password: "tenant"
// });

    console.log('Response' ,response)
    startTokenAutoRefresh()
    return response.data; // Return the response data
  } 
  catch (error) {
    console.error('Error during login:', error);
    throw error; // Rethrow the error to handle it in the calling function
  }
};

export const refreshTokenApi = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await axios.post(`${window._env_.SERVER_URL}api/auth/token`, {
      refreshToken
    });

    console.log('customer response',response.data);
    const newToken = response.data.token;
    localStorage.setItem('token', newToken);
    localStorage.setItem('newToken', newToken);
   const newRefreshToken = response.data.refreshToken;
    localStorage.setItem('refreshToken', newRefreshToken);

    console.log('Token refreshed:', newToken);
    return newToken;
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    throw error;
  }
};

export const refreshTenantTokenApi = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken1');
    const response = await axios.post(`${window._env_.SERVER_URL}api/auth/token`, {
      refreshToken
    });

    console.log('tenant response',response.data);

    const newToken = response.data.token;
    localStorage.setItem('token1', newToken);
    const newRefreshToken = response.data.refreshToken;
    localStorage.setItem('refreshToken1', newRefreshToken);
    console.log('Tenant Token refreshed:', newToken);
    return newToken;
  } catch (error) {
    console.error('Error refreshing tenant token:', error.response?.data || error.message);
    throw error;
  }
};


let refreshIntervalId = null;

export const startTokenAutoRefresh = () => {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(async () => {
    try {
      await refreshTokenApi();
    } catch (err) {
      console.error("Customer token refresh failed", err);
    }
    try {
      await refreshTenantTokenApi();
    } catch (err) {
      console.error("Tenant token refresh failed", err);
    }
  }, 24 * 60 * 60 * 1000);
};

export const stopTokenAutoRefresh = () => {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
};

export const Userapi = async () => {
  try {
    const response = await axiosInstance.get(`${window._env_.SERVER_URL}api/auth/user`, {
    });
    console.log('User Response' ,response)
    return response.data; // Return the response data
  } 
  catch (error) {
    console.error('Error during User:', error);
    throw error; // Rethrow the error to handle it in the calling function
  }
};
export const Userapi1 = async () => {
  try {
    const response = await axiosInstance1.get(`${window._env_.SERVER_URL}api/auth/user`, {
    });
    console.log('User Response' ,response)
    return response.data; // Return the response data
  } 
  catch (error) {
    console.error('Error during User:', error);
    throw error; // Rethrow the error to handle it in the calling function
  }
};


export const getOperatorDetails = async (customerId) => {
    try {
        const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
        const cleanedCustomerId = cleanCustomerId(customerId);
        const url = `${baseUrl}/api/plugins/telemetry/CUSTOMER/${cleanedCustomerId}/values/attributes?keys=alloperator`;
      console.log('Operator API URL:', url);
      const response = await axiosInstance1.get(url);
      console.log('Operator API Response:', response);
      return response.data;
    } catch (error) {
      console.error('Error during Operator data:', error);
      throw error;
    }
  };