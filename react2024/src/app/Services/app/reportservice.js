import axiosInstance from '../core/axiosconfig';

export const getReportShifts = async (customerName) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/shift-list/${customerName}`;
    const response = await axiosInstance.get(url);
    console.log('Report Shift response', response.data);
    // Ensure we always return an array
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
  } catch (error) {
    console.error('Error during report shift data:', error);
    return [];
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
    return { data: [] };
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

export const getOperatorReport = async (machine, operators, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');

    const url = `${baseUrl}/report/operator_report/${machine}/${shiftNo}/${operators}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('Operator Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during operator report data:', error);
    throw error;
  }
};

export const getSequenceReport = async (machine, shiftNo, fromTime, toTime, page = 0, limit = 10) => {
  try {
    // Sequence report runs on its own backend (SERVER_URL3); other reports use SERVER_URL2.
    const baseUrl = window._env_.SERVER_URL3.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/sequence-report/${machine}/${shiftNo}/${fromTime}/${toTime}/${page + 1}/${limit}`;
    const response = await axiosInstance.get(url);
    console.log('Sequence Report response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error during sequence report data:', error);
    throw error;
  }
};

export const getReportDownloadLink = async (type, machine, shiftNo, fromTime, toTime, operators = "") => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
  const endpointMap = {
    part: "part_report_download",
    general: "general_report_download",
    oee: "oee_report_download",
    idle_reason: "idle_report_download1",
    alarm: "alarm_report_download",
    operator_wise: "operator_report_download",
    sequence_report: "sequence_report_download"
  };
  const endpoint = endpointMap[type];
  if (!endpoint) throw new Error(`Unknown report type: ${type}`);

  let url = `${baseUrl}/report/${endpoint}/${machine}/${shiftNo}/${fromTime}/${toTime}`;
  if (type === "operator_wise") {
    url = `${baseUrl}/report/${endpoint}/${machine}/${shiftNo}/${operators}/${fromTime}/${toTime}`;
  }
  if (type === "sequence_report") {
    // Sequence report runs on its own backend (SERVER_URL3).
    const seqBase = window._env_.SERVER_URL3.replace(/\/$/, '');
    url = `${seqBase}/api/v1/sequence-report/download/${encodeURIComponent(machine)}/${encodeURIComponent(shiftNo)}/${fromTime}/${toTime}`;
  }

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
    return { data: [] };
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

export const getAllPlans = async () => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
  const token = localStorage.getItem("reportToken");
  const url = `${baseUrl}/Plan/all`;
  const response = await axiosInstance.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updatePlan = async (id, payload) => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
  const token = localStorage.getItem("reportToken");
  const url = `${baseUrl}/Plan/update/${id}`;
  const response = await axiosInstance.put(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

export const createPlan = async (payload) => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
  const token = localStorage.getItem("reportToken");
  const url = `${baseUrl}/Plan/create`;
  const response = await axiosInstance.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

export const getCurrentMachinePlan = async (machineName, shiftNo, date) => {   //getting the current shift plan
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
  const token = localStorage.getItem("reportToken");
  const url = `${baseUrl}/Plan/current-machine?machine_name=${encodeURIComponent(machineName)}&shift_no=${encodeURIComponent(shiftNo)}&date=${encodeURIComponent(date)}`;
  const response = await axiosInstance.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getJobsByWorkname = async (workname, page = 1, limit = 10) => {    //scheduling plan
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/job/by-workname?workname=${workname}&page=${page}&limit=${limit}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching jobs by workname:', error);
    throw error;
  }
};

export const getPlanDetails = async (machineName, shiftNo, startDate, endDate) => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
  const token = localStorage.getItem("reportToken");
  const url = `${baseUrl}/Plan/plan-details/${encodeURIComponent(machineName)}/${shiftNo}/${startDate}/${endDate}`;
  const response = await axiosInstance.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
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

export const deletePlan = async (id) => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
  const token = localStorage.getItem("reportToken");
  const url = `${baseUrl}/Plan/delete/${id}`;
  const response = await axiosInstance.delete(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getErpJson = async (planNo) => {
  const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, "");
  const token = localStorage.getItem("reportToken");
  const url = `${baseUrl}/reportGenerate/erpGet?plan_no=${encodeURIComponent(planNo)}`;
  const response = await axiosInstance.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};