import axios from 'axios';

export const Loginapi = async (username, password) => {
  try {
    const response = await axios.post(`${window._env_.SERVER_URL}api/auth/login`, {
      username,
      password
    });

    const { token, refreshToken } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('newToken', token); // set initial newToken

    return response.data;
  } catch (error) {
    console.error('Error during login:', error.response?.data || error.message);
    throw error;
  }
};

export const refreshTokenApi = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');

    const response = await axios.post(`http://74.224.122.231:8080/api/auth/token`, {
      refreshToken
    });

    const newToken = response.data.token;
    localStorage.setItem('token', newToken);
    localStorage.setItem('newToken', newToken); // ✅ Update for use in Grafana iframe

    console.log('Token refreshed:', newToken);
    return newToken;
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    throw error;
  }
};

export const startTokenAutoRefresh = () => {
  setInterval(async () => {
    try {
      await refreshTokenApi();
      console.log('Auto refresh successful');
    } catch (err) {
      console.error("Auto refresh failed", err);
      // Optional: Add logout or redirect if needed
    }
  }, 5 * 60 * 1000); // 🔁 Every 5 minutes
};
