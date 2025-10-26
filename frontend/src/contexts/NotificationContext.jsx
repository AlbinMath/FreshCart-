import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification, 
  clearAllNotifications,
  getNotificationStats,
  updateNotificationPreferences,
  getUnreadCount
} from '../../../backend/services/notificationService';

const NotificationContext = createContext();

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }) {
  const { currentUser, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [preferences, setPreferences] = useState({
    email: true,
    push: true,
    licenseUpdates: true,
    emailVerificationReminders: true
  });

  // Helper function to check if auth is ready for API calls with retry
  const isAuthReady = async (maxRetries = 3, delay = 200) => {
    if (!currentUser || authLoading) return false;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try to get the Firebase token to verify auth is fully ready
        const token = await currentUser.getIdToken(false);
        if (token) return true;
      } catch (error) {
        // If this is not the last retry, wait before trying again
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    return false;
  };

  // Load notifications when user changes and auth is ready
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (currentUser) {
      // Add a small delay and verify auth is ready before loading
      // apiService now has its own waitForAuth mechanism
      const timer = setTimeout(async () => {
        const ready = await isAuthReady(3, 200); // Try 3 times with 200ms delay
        if (ready) {
          loadNotifications();
          loadUnreadCount();
          loadStats();
        }
      }, 300); // 300ms initial delay (apiService will wait up to 2s if needed)
      
      return () => clearTimeout(timer);
    } else {
      // Clear notifications when user logs out
      setNotifications([]);
      setUnreadCount(0);
      setStats(null);
    }
  }, [currentUser, authLoading]);

  // Auto-refresh unread count every 30 seconds
  useEffect(() => {
    if (!currentUser || authLoading) return;

    const interval = setInterval(async () => {
      const ready = await isAuthReady();
      if (ready) {
        loadUnreadCount();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser, authLoading]);

  const loadNotifications = async (page = 1, limit = 20, unreadOnly = false) => {
    if (!currentUser || authLoading) return;
    
    try {
      setLoading(true);
      const response = await getNotifications(page, limit, unreadOnly);
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
      return response;
    } catch (error) {
      // Silently fail on authentication errors (401, token issues, etc.)
      if (error.status === 401 || error.isAuthError) {
        // 401 Unauthorized - silently ignore (auth not ready yet)
        return;
      }
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('token') || errorMsg.includes('authenticated') || errorMsg.includes('auth') || errorMsg.includes('unauthorized')) {
        // Auth error - silently ignore
        return;
      }
      console.error('Error loading notifications:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!currentUser || authLoading) return;
    
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      // Silently fail on authentication errors (401, token issues, etc.)
      if (error.status === 401 || error.isAuthError) {
        // 401 Unauthorized - silently ignore (auth not ready yet)
        return;
      }
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('token') || errorMsg.includes('authenticated') || errorMsg.includes('auth') || errorMsg.includes('unauthorized')) {
        // Auth error - silently ignore
        return;
      }
      console.error('Error loading unread count:', error);
    }
  };

  const loadStats = async () => {
    if (!currentUser || authLoading) return;
    
    try {
      const response = await getNotificationStats();
      setStats(response.stats);
    } catch (error) {
      // Silently fail on authentication errors (401, token issues, etc.)
      if (error.status === 401 || error.isAuthError) {
        // 401 Unauthorized - silently ignore (auth not ready yet)
        return;
      }
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('token') || errorMsg.includes('authenticated') || errorMsg.includes('auth') || errorMsg.includes('unauthorized')) {
        // Auth error - silently ignore
        return;
      }
      console.error('Error loading notification stats:', error);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification._id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update stats
      if (stats) {
        setStats(prev => ({
          ...prev,
          unread: Math.max(0, prev.unread - 1)
        }));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await markAllAsRead();
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      
      // Reset unread count
      setUnreadCount(0);
      
      // Update stats
      if (stats) {
        setStats(prev => ({ ...prev, unread: 0 }));
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  };

  const deleteNotificationById = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      
      // Update local state
      const deletedNotification = notifications.find(n => n._id === notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      
      // Update unread count if the deleted notification was unread
      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      // Update stats
      if (stats) {
        setStats(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
          unread: deletedNotification && !deletedNotification.isRead 
            ? Math.max(0, prev.unread - 1) 
            : prev.unread
        }));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  };

  const clearAllNotificationsData = async () => {
    try {
      await clearAllNotifications();
      
      // Clear local state
      setNotifications([]);
      setUnreadCount(0);
      setStats(null);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  };

  const updateNotificationPreferencesData = async (newPreferences) => {
    try {
      const response = await updateNotificationPreferences(newPreferences);
      setPreferences(response.preferences);
      return response;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  };

  const refreshNotifications = () => {
    if (currentUser && !authLoading) {
      loadNotifications();
      loadUnreadCount();
      loadStats();
    }
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    stats,
    preferences,
    loadNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotificationById,
    clearAllNotificationsData,
    updateNotificationPreferencesData,
    refreshNotifications,
    loadUnreadCount,
    loadStats
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

