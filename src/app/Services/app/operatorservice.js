import axiosInstance1 from "./loginservice";

export const cleanCustomerId = (customerId) => {
  if (!customerId) return '';
  return customerId
    .replace(/\\/g, '')
    .replace(/"/g, '')
    .trim();
};

export const operatorTelemetry = async (entityType, entityId, thresholddata) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/SERVER_SCOPE`;
    const response = await axiosInstance1.post(url, thresholddata);
    return response.data;
  } catch (error) {
    console.error('Error during Assign operator update:', error);
    throw error;
  }
};

export const getFirstMachineActive = async (entityType, entityId, { keys, startTs, endTs, interval = 0, limit = 10000, useStrictDataTypes = false }) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
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
    return response.data;
  } catch (error) {
    console.error('Error during telemetry fetch:', error);
    throw error;
  }
}

export const Downtimeadd1 = async (entityType, entityId, scope, thresholddata) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/timeseries/${scope}`;
    const response = await axiosInstance1.post(url, thresholddata);
    return response.data;
  } catch (error) {
    console.error('Error during Device Shift update:', error);
    throw error;
  }
};

export const getMachineLock = async (entityType, entityId, { keys, useStrictDataTypes = false }) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries`;
    const response = await axiosInstance1.get(url, {
      params: {
        keys,
        useStrictDataTypes,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error during telemetry fetch:', error);
    throw error;
  }
};

export const customerbaseddevices = async (customerId, pageSize, page) => {
  try {
    const cleanedCustomerId = cleanCustomerId(customerId);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanedCustomerId)) {
      throw new Error(`Invalid UUID format after cleaning: ${cleanedCustomerId}`);
    }
    const response = await axiosInstance1.get(
      `${window._env_.SERVER_URL}api/customer/${cleanedCustomerId}/devices?pageSize=${pageSize}&page=${page}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 0,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error during Device:', error);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
    throw error;
  }
};

export const customerbasedshift = async (customerId, key) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const cleanedCustomerId = cleanCustomerId(customerId);
    const url = `${baseUrl}/api/plugins/telemetry/CUSTOMER/${cleanedCustomerId}/values/attributes?keys=${key}`;
    const response = await axiosInstance1.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during Shift latest data:', error);
    throw error;
  }
};

export const telemetrylatestdata = async (deviceId, entitytype, key) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/plugins/telemetry/${entitytype}/${deviceId}/values/timeseries?keys=${key}&useStrictDataTypes=false`;
    const response = await axiosInstance1.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during telemetry latest data:', error);
    throw error;
  }
};

export const telemetrykeydata = async (deviceId, entitytype, key, starttime, endtime) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/plugins/telemetry/${entitytype}/${deviceId}/values/timeseries?keys=${key}&startTs=${starttime}&endTs=${endtime}&interval=0&limit=50000&useStrictDataTypes=false`;
    const response = await axiosInstance1.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during telemetry key data:', error);
    throw error;
  }
};

export const Deviceattributeget = async (customerId, key) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const cleanedCustomerId = cleanCustomerId(customerId);
    const url = `${baseUrl}/api/plugins/telemetry/DEVICE/${cleanedCustomerId}/values/attributes?keys=${key}`;
    const response = await axiosInstance1.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during Shift latest data:', error);
    throw error;
  }
};


export const createNewUser = async (payload) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/user?sendActivationMail=false`;
    const response = await axiosInstance1.post(url, payload);
    return response.data;
  } catch (error) {
    console.error('Error while creating new user:', error);
    throw error;
  }
};

export const getUserActivationLink = async (customerId) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const cleanedCustomerId = cleanCustomerId(customerId);
    const url = `${baseUrl}/api/user/${cleanedCustomerId}/activationLinkInfo`;
    const response = await axiosInstance1.get(url);
    return response.data;
  } catch (error) {
    console.error('Error while getting activation link:', error);
    throw error;
  }
};

export const createPasswordForUser = async (payload) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/noauth/activate?sendActivationMail=true`;
    const response = await axiosInstance1.post(url, payload);
    return response.data;
  } catch (error) {
    console.error('Error while creating password for new user:', error);
    throw error;
  }
};

export const getCustomerUsers = async (customerId, page = 0, pageSize = 1000000) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const cleanedCustomerId = cleanCustomerId(customerId);
    const url = `${baseUrl}/api/customer/${cleanedCustomerId}/users`;
    const params = {
      pageSize,
      page,
      sortProperty: 'createdTime',
      sortOrder: 'DESC',
    };
    const response = await axiosInstance1.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching customer users:", error);
    throw error;
  }
};

export const deleteUserById = async (userId) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/user/${userId}`;
    const response = await axiosInstance1.delete(url);
    return response.data;
  } catch (error) {
    console.error(`Error deleting user with ID ${userId}:`, error);
    throw error;
  }
};