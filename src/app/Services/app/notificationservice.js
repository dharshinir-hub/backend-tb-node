// services/notificationService.js
import axiosInstance from '../core/axiosconfig';
import axiosInstance1 from "./loginservice";
import { cleanCustomerId } from './operatorservice';

// =========================
// 🧠 Local Cache (prevents overwrite)
// =========================
let recipientGroupsCache = [];

// =========================
// 🔔 Notification APIs
// =========================
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

export const deleteNotification = async (notificationId) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/notification/${notificationId}`;
    const response = await axiosInstance.delete(url);
    return response.data;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// =========================
// 👥 Recipient Group APIs
// =========================
export const getRecipientGroups = async (pageSize = 50, page = 0) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/notification/targets?pageSize=${pageSize}&page=${page}&sortProperty=name&sortOrder=ASC&notificationType=GENERAL`;
    const response = await axiosInstance1.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching recipient groups:', error);
    throw error;
  }
};

// =========================
// 💾 Attribute Helpers
// =========================
export const saveRecipientGroupInAttribute = async (recipientData) => {
  try {
    recipientGroupsCache = recipientData; // keep latest in cache
    const customerId = JSON.parse(localStorage.getItem('CustomerID'));
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const cleanedCustomerId = cleanCustomerId(customerId);
    const payload = {
      recipientgroups: recipientData,
      lastUpdateTs: Date.now()
    };
    console.log('Saving recipient attribute payload:', JSON.stringify(payload, null, 2));
    const response = await axiosInstance1.post(
      `${baseUrl}/api/plugins/telemetry/CUSTOMER/${cleanedCustomerId}/SERVER_SCOPE`,
      payload
    );
    return response.data;
  } catch (error) {
    console.error('Error saving recipient attribute:', error);
    throw error;
  }
};

export const getRecipientGroupInAttribute = async () => {
  try {
    if (recipientGroupsCache.length > 0) {
      console.log('✅ Returning cached recipient groups');
      return recipientGroupsCache;
    }

    const customerId = JSON.parse(localStorage.getItem('CustomerID'));
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const cleanedCustomerId = cleanCustomerId(customerId);
    const url = `${baseUrl}/api/plugins/telemetry/CUSTOMER/${cleanedCustomerId}/values/attributes?keys=recipientgroups`;
    const response = await axiosInstance.get(url);

    if (
      Array.isArray(response.data) &&
      response.data.length > 0 &&
      response.data[0]?.value
    ) {
      recipientGroupsCache = response.data[0].value;
      return recipientGroupsCache;
    }

    console.warn('No recipient attribute found, returning empty list');
    return [];
  } catch (error) {
    console.error('Error fetching recipient attribute:', error);
    return [];
  }
};

// =========================
// 🧩 Merge Recipient Groups Safely
// =========================
const mergeRecipientGroupsAttribute = async (newGroups) => {
  try {
    // combine cache + new
    const existing = Array.isArray(recipientGroupsCache)
      ? [...recipientGroupsCache]
      : [];

    const merged = [
      ...existing.filter(
        (eg) => !newGroups.some((ng) => ng.id?.id === eg.id?.id)
      ),
      ...newGroups,
    ];

    recipientGroupsCache = merged;
    await saveRecipientGroupInAttribute(merged);
    console.log('✅ Merged recipient groups successfully:', merged);
    return merged;
  } catch (error) {
    console.error('❌ Error merging recipient groups attribute:', error);
    throw error;
  }
};

// =========================
// 👥 Get Recipient Groups from Attribute
// =========================
export const getRecipientGroupsFromAttribute = async () => {
  try {
    const userId = localStorage.getItem('userID');
    const recipientGroups = await getRecipientGroupInAttribute();

    if (!Array.isArray(recipientGroups)) {
      console.warn('No valid recipient group array found in attributes');
      return [];
    }

    const filteredGroups = recipientGroups.filter((group) => {
      const config = group?.configuration || {};
      let descriptionObj = {};
      try {
        if (typeof config.description === 'string') {
          descriptionObj = JSON.parse(config.description);
        }
      } catch (e) {
        console.warn('Invalid description JSON for group:', group.name, e);
      }

      const isPublic = descriptionObj?.isPublic ?? false;
      const createdBy = descriptionObj?.createdBy ?? null;

      if (isPublic) return true;
      if (!isPublic && createdBy && createdBy === userId) return true;
      return false;
    });

    console.log('Filtered recipient groups from attribute:', filteredGroups);
    return filteredGroups;
  } catch (error) {
    console.error('Error getting recipient groups from attribute:', error);
    return [];
  }
};

// =========================
// 🧩 Create Recipient Group
// =========================
export const createRecipientGroup = async (name, userIds, description) => {
  const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
  const url = `${baseUrl}/api/notification/target`;
  const body = {
    name,
    configuration: {
      type: 'PLATFORM_USERS',
      usersFilter: { type: 'USER_LIST', usersIds: userIds },
      description
    },
  };

  try {
    const response = await axiosInstance1.post(url, body);
    const newGroup = response.data;

    try {
      await mergeRecipientGroupsAttribute([newGroup]);
    } catch (attrError) {
      console.error('⚠️ Attribute sync failed, rolling back backend create:', attrError);
      await axiosInstance1.delete(`${baseUrl}/api/notification/target/${newGroup.id.id}`);
      throw new Error('Recipient group creation rolled back due to attribute sync failure');
    }

    return newGroup;
  } catch (error) {
    console.error('❌ Error creating recipient group:', error);
    throw error;
  }
};

// =========================
// 📝 Update Recipient Group
// =========================
export const updateRecipientGroup = async (groupId, name, userIds, description) => {
  const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
  const url = `${baseUrl}/api/notification/target`;
  const body = {
    id: { entityType: 'NOTIFICATION_TARGET', id: groupId },
    name,
    configuration: {
      type: 'PLATFORM_USERS',
      usersFilter: { type: 'USER_LIST', usersIds: userIds },
      description
    },
  };

  try {
    const response = await axiosInstance1.post(url, body);
    const updatedGroup = response.data;

    try {
      const existing = Array.isArray(recipientGroupsCache)
        ? [...recipientGroupsCache]
        : [];
      const updated = existing.map((g) =>
        g.id?.id === groupId ? updatedGroup : g
      );
      recipientGroupsCache = updated;
      await saveRecipientGroupInAttribute(updated);
    } catch (attrError) {
      console.error('⚠️ Attribute sync failed after update:', attrError);
    }

    return updatedGroup;
  } catch (error) {
    console.error('❌ Error updating recipient group:', error);
    throw error;
  }
};

// =========================
// ❌ Delete Recipient Group
// =========================
export const deleteRecipientGroup = async (groupId) => {
  const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
  const url = `${baseUrl}/api/notification/target/${groupId}`;

  try {
    const response = await axiosInstance1.delete(url);

    try {
      const filtered = recipientGroupsCache.filter(
        (g) => g.id?.id !== groupId
      );
      recipientGroupsCache = filtered;
      await saveRecipientGroupInAttribute(filtered);
    } catch (attrError) {
      console.error('⚠️ Attribute sync failed after delete:', attrError);
    }

    return response.data;
  } catch (error) {
    console.error('❌ Error deleting recipient group:', error);
    throw error;
  }
};

// =========================
// 🚀 Send Notification
// =========================
export const sendNotification = async (
  targets,
  subject,
  body,
  iconConfig = null,
  actionButtonConfig = null
) => {
  try {
    const baseUrl = window._env_.SERVER_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/notification/request`;

    const defaultIconConfig = {
      enabled: true,
      icon: 'info',
      color: '#757575',
    };

    const senderEmail = localStorage.getItem('email') || null;

    const payload = {
      targets,
      template: {
        name: `notification_${Date.now()}`,
        notificationType: 'GENERAL',
        configuration: {
          deliveryMethodsTemplates: {
            WEB: {
              subject,
              body,
              additionalConfig: {
                icon: iconConfig || defaultIconConfig,
                actionButtonConfig:
                  actionButtonConfig || {
                    enabled: false,
                    text: '',
                    link: '',
                    linkType: 'LINK',
                  },
                sentByEmail: senderEmail, // ✅ store sender here
              },
              enabled: true,
              method: 'WEB',
            },
          },
        },
      },
      additionalConfig: { sendingDelayInSec: 0 },
    };

    const response = await axiosInstance1.post(url, payload);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
};
