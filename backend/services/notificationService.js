import { apiService } from './apiService.js';

// Client-side notification service functions
export const getNotifications = async (page = 1, limit = 20, unreadOnly = false) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (unreadOnly) params.append('unreadOnly', 'true');
  return await apiService.get(`/notifications?${params}`);
};

export const markAsRead = async (notificationId) => {
  return await apiService.put(`/notifications/${notificationId}/read`);
};

export const markAllAsRead = async () => {
  return await apiService.put('/notifications/mark-all-read');
};

export const deleteNotification = async (notificationId) => {
  return await apiService.delete(`/notifications/${notificationId}`);
};

export const clearAllNotifications = async () => {
  return await apiService.delete('/notifications/clear-all');
};

export const getNotificationStats = async () => {
  return await apiService.get('/notifications/stats');
};

export const updateNotificationPreferences = async (preferences) => {
  return await apiService.put('/notifications/preferences', preferences);
};

export const getUnreadCount = async () => {
  const stats = await getNotificationStats();
  return stats.stats.unread;
};
