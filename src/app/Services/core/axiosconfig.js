import axios from 'axios';
// import { environment } from '../../../environment/environment';

// const getToken = () => {
//   return localStorage.getItem('token');
// };

// Create an Axios instance
// const axiosInstance = axios.create({
//   baseURL: window._env_.SERVER_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Add a request interceptor
// axiosInstance.interceptors.request.use(
//   (config) => {
//     const token = getToken();
//     if (token) {
//       config.headers['Authorization'] = `${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );
const axiosInstance = axios.create({
  baseURL: window._env_.SERVER_URL,
});

axiosInstance.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['X-Authorization'] = `Bearer ${token}`;
  }
  return config;
});
export default axiosInstance;


