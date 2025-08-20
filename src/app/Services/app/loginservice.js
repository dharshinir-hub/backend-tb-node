// loginservice.js
import axios from 'axios';
 import axiosInstance from '../core/axiosconfig'; 
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

    const newToken = response.data.token;
    localStorage.setItem('token', newToken);

    console.log('Token refreshed:', newToken);
    return newToken;
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    throw error;
  }
};

export const startTokenAutoRefresh = () => {
  // Refresh every 5 minutes (300000ms)
  setInterval(async () => {
    try {
      await refreshTokenApi();
    } catch (err) {
      console.error("Auto refresh failed", err);
      // Optional: handle re-login or logout if refresh fails
    }
  }, 5 * 60 * 1000); // 5 minutes
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
