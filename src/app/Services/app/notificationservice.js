// services/notificationService.js
import axiosInstance from '../core/axiosconfig';

export const getNotifications = async (pageSize = 10, page = 0, unreadOnly = true) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/notifications?pageSize=${pageSize}&page=${page}&sortProperty=createdTime&sortOrder=DESC&unreadOnly=${unreadOnly}`;
    
    const response = await axiosInstance.get(url);
    console.log('Notifications response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

export const markAllAsRead = async () => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/notifications/read`;
    const response = await axiosInstance.put(url);
    return response.data;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

export const markAsRead = async (notificationId) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/notification/${notificationId}/read`;
    const response = await axiosInstance.put(url);
    return response.data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};


export const deleteNotification = async(notificationId) => {
try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/notification/${notificationId}`;
    const response = await axiosInstance.delete(url);
    return response.data;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}