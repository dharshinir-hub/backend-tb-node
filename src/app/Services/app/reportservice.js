import axiosInstance from '../core/axiosconfig'; 
  
export const getReportShifts = async(customerName) => {
    try {
      const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, ''); 
      const url = `${baseUrl}/report/shift-list/${customerName}`;
       const response = await axiosInstance.get(url);
       console.log('Report Shift response', response.data);
       return response.data;
    } catch(error) {
      console.error('Error during report shift data:', error);
    }
  }

export const getReportMachineList = async(customerName) => {
    try {
      const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, ''); 
      const url = `${baseUrl}/report/machine-list/${customerName}`;
       const response = await axiosInstance.get(url);
       console.log('Report Machine list response', response.data);
       return response.data;
    } catch(error) {
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