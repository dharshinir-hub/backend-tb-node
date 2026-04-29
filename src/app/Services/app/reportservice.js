import axiosInstance from '../core/axiosconfig';

export const getReportShifts = async (customerName) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/shift-list/${customerName}`;
    const response = await axiosInstance.get(url);
    console.log('Report Shift response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during report shift data:', error);
  }
}

export const getReportMachineList = async (customerName) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/machine-list/${customerName}`;
    const response = await axiosInstance.get(url);
    console.log('Report Machine list response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during report machine list data:', error);
  }
}

export const getGeneralReport = async (machine, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/general_report/${machine}/${shiftNo}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('General Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during general report data:', error);
    throw error;
  }
};

export const getPartReport = async (machine, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/part_report/${machine}/${shiftNo}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('Part Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during part report data:', error);
    throw error;
  }
};

export const getOeeReport = async (machine, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/oee_report/${machine}/${shiftNo}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('OEE Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during oee report data:', error);
    throw error;
  }
};

export const getIdleReasonReport = async (machine, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/idle_report/${machine}/${shiftNo}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('Idle Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during idle report data:', error);
    throw error;
  }
};

export const getAlarmReport = async (machine, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/alarm_report/${machine}/${shiftNo}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('Alarm Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during alarm report data:', error);
    throw error;
  }
};

export const getEfficiencyReport = async (machine, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/efficiency_report/${machine}/${shiftNo}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('Efficiency Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during efficiency report data:', error);
    throw error;
  }
};

export const getReportDownloadLink = async (type, machine, shiftNo, fromTime, toTime) => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
  const endpointMap = {
    part: "part_report_download",
    general: "general_report_download",
    oee: "oee_report_download",
    idle_reason: "idle_report_download1",
    alarm: "alarm_report_download"
  };
  const endpoint = endpointMap[type];
  if (!endpoint) throw new Error(`Unknown report type: ${type}`);
  const url = `${baseUrl}/report/${endpoint}/${machine}/${shiftNo}/${fromTime}/${toTime}`;
  return await axiosInstance.get(url, { responseType: "blob" });
};

export const getReportGenerate = async (date) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/schuduletask/${date}`;
    const response = await axiosInstance.get(url);
    console.log('Quality API rejected', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during report machine list data:', error);
  }
}

export const getReportToken = async (username, password) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
    const url = `${baseUrl}/Auth/login1/${username}/${password}`;

    const response = await axiosInstance.post(url);
    const accessToken = response?.data?.accessToken;
    if (accessToken) {
      localStorage.setItem("reportToken", accessToken);
    } else {
      console.warn("accessToken not found in response");
    }

    return response.data;
  } catch (error) {
    console.error("Error during report machine list data:", error);
    throw error; 
  }
};

export const getReportGenerate1 = async (device, date, currentshift, status) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
    const token = localStorage.getItem("reportToken");

    const url =
      `${baseUrl}/reportGenerate/ShiftPartUpdatePerMachineByDateAndShift1` +
      `?machine_name=${encodeURIComponent(device)}` +
      `&date=${date}` +
      `&shift_no=${currentshift}` +
      `&currntshift=${status}`;
    const response = await axiosInstance.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Quality API response", response.data);
    return response.data;
  } catch (error) {
    console.error("Error during report machine list data:", error);
    throw error;
  }
};