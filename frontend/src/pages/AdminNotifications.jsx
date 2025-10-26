import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  FaBell, 
  FaCheck, 
  FaCheckDouble, 
  FaChevronLeft, 
  FaTrash, 
  FaWallet, 
  FaSyncAlt,
  FaFilter,
  FaSearch,
  FaMoneyBillWave
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { currentUser, getUserProfile } = useAuth();
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useWebSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [balance, setBalance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Mark all notifications as read when the component mounts
  useEffect(() => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  }, []);

  // Filter notifications based on selected filters
  const filteredNotifications = notifications.filter(notification => {
    const matchesStatus = filter === 'all' || 
                         (filter === 'unread' && !notification.read) || 
                         (filter === 'read' && notification.read);
    
    const matchesType = typeFilter === 'all' || 
                       (typeFilter === 'product-approval' && notification.type === 'product-approval') ||
                       (typeFilter === 'system' && notification.type === 'system');
    
    return matchesStatus && matchesType;
  });

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification._id || notification.id);
    }
    
    // Handle navigation based on notification type
    if (notification.type === 'product-approval' && notification.data?.productId) {
      navigate(`/admin/products?productId=${notification.data.productId}`);
    } else {
      setSelectedNotification(notification);
    }
  };

  const handleDeleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/admin/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        // The WebSocket context will handle updating the notifications list
        alert('Notification deleted');
      } else {
        alert('Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Error deleting notification');
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete all notifications?')) {
      try {
        const response = await fetch('/api/admin/notifications', {
          method: 'DELETE',
          credentials: 'include',
        });
        
        if (response.ok) {
          // The WebSocket context will handle updating the notifications list
          alert('All notifications deleted');
        } else {
          alert('Failed to delete all notifications');
        }
      } catch (error) {
        console.error('Error deleting all notifications:', error);
        alert('Error deleting notifications');
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'product-approval':
        return '📦';
      case 'system':
        return '⚙️';
      default:
        return '🔔';
    }
  };

  // Fetch balance on component mount
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/admin/balance', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setBalance(data.balance);
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };
    
    fetchBalance();
  }, []);

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex items-center">
            <button 
              onClick={() => navigate(-1)} 
              className="mr-4 text-gray-600 hover:text-gray-800"
            >
              <FaChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
              <FaMoneyBillWave className="mr-2" />
              <span className="font-medium">Balance:</span>
              <span className="ml-1 font-bold">₹{balance.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className={`px-3 py-2 rounded-md text-sm flex items-center ${
                  unreadCount === 0 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                <FaCheckDouble className="mr-1" /> Mark all read
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={notifications.length === 0}
                className={`px-3 py-2 rounded-md text-sm flex items-center ${
                  notifications.length === 0 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <FaTrash className="mr-1" /> Clear all
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">Status</label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All types</option>
              <option value="product-approval">Product Approvals</option>
              <option value="system">System</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FaBell className="mx-auto text-4xl text-gray-300 mb-4" />
            <p className="text-lg">No notifications found</p>
            <p className="text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => (
              <li 
                key={notification._id || notification.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start">
                  <div className="text-2xl mr-3 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {formatDate(notification.createdAt || new Date())}
                        </span>
                        {!notification.read && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {notification.message}
                    </p>
                    {notification.data?.reason && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Reason:</span> {notification.data.reason}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotification(notification._id || notification.id, e);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete notification"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedNotification.title}
                </h2>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 text-gray-700">
                <p className="whitespace-pre-line">{selectedNotification.message}</p>
                {selectedNotification.data?.reason && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <h4 className="font-medium text-gray-900 mb-1">Additional Details:</h4>
                    <p className="text-sm text-gray-600">
                      {selectedNotification.data.reason}
                    </p>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Received: {formatDate(selectedNotification.createdAt || new Date())}
                  </p>
                  {selectedNotification.read && (
                    <p className="text-sm text-gray-500 mt-1">
                      Read: {formatDate(selectedNotification.updatedAt || new Date())}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
                {!selectedNotification.read && (
                  <button
                    onClick={() => {
                      markAsRead(selectedNotification._id || selectedNotification.id);
                      setSelectedNotification(prev => ({ ...prev, read: true }));
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
