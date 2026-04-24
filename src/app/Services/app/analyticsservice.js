import axiosInstance from '../core/axiosconfig';

export const getDowntimeAnalytics = async (machine, shiftNo, fromTime, toTime, topFilter, period) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/analytics/downtime/${machine}/${shiftNo}/${fromTime}/${toTime}/${topFilter}/${period}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during downtime analytics:', error);
    throw error;
  }
};

export const getAlarmAnalytics = async (machine, shiftNo, fromTime, toTime, topFilter, period) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/analytics/alarm/${machine}/${shiftNo}/${fromTime}/${toTime}/${topFilter}/${period}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during alarm analytics:', error);
    throw error;
  }
};

export const getMetricByPeriod = async (machine, shiftNo, fromTime, toTime, period, metric) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/metric_by_period/${machine}/${shiftNo}/${fromTime}/${toTime}/${period}/${metric}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error during ${metric} analytics:`, error);
    throw error;
  }
};

export const getPartsAnalytics = async (machine, shiftNo, fromTime, toTime) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/part_by_period/${machine}/${encodeURIComponent(shiftNo)}/${fromTime}/${toTime}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during parts analytics:', error);
    throw error;
  }
};
