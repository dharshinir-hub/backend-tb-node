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

export const getAlarmByPeriod = async (machine, shiftNo, fromTime, toTime) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/alarm_by_period/${machine}/${encodeURIComponent(shiftNo)}/${fromTime}/${toTime}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during alarm by period:', error);
    throw error;
  }
};

export const getAlarmByPeriodTop = async (machine, shiftNo, fromTime, toTime, period, alarmMessage) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/alarm_by_period_top/${machine}/${encodeURIComponent(shiftNo)}/${fromTime}/${toTime}/${period}/${encodeURIComponent(alarmMessage)}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during alarm by period top:', error);
    throw error;
  }
};

export const getIdleByPeriod = async (machine, shiftNo, fromTime, toTime) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/idle_by_period/${machine}/${encodeURIComponent(shiftNo)}/${fromTime}/${toTime}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during idle by period:', error);
    throw error;
  }
};

export const getIdleReasonByPeriod = async (machine, shiftNo, fromTime, toTime, period, reason) => {
  try {
    const baseUrl = window._env_.SERVER_URL2.replace(/\/$/, '');
    const url = `${baseUrl}/report/idle_reason_by_period/${machine}/${encodeURIComponent(shiftNo)}/${fromTime}/${toTime}/${period}/${encodeURIComponent(reason)}`;
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error during idle reason by period:', error);
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
