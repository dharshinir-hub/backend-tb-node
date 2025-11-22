// components/NotificationBell.js
import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaCheck, FaExclamationTriangle, FaInfoCircle, FaExclamationCircle } from 'react-icons/fa';
import { Button } from '@mui/material';
import './notificationBell.css';
import { getNotifications, markAllAsRead, markAsRead } from '../../Services/app/notificationservice';
import { useNavigate } from 'react-router-dom';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearInterval(interval);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(data.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications([]);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkAsRead = async (notification, e) => {
    e.stopPropagation();
    try {
      await markAsRead(notification.id.id);
      setNotifications(prev => prev.filter(n => n.id.id !== notification.id.id));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleActionButtonClick = (notification, e) => {
    e.stopPropagation();
    const actionConfig = notification.additionalConfig?.actionButtonConfig;
    if (actionConfig?.enabled && actionConfig.linkType === 'LINK' && actionConfig.link) {
      window.open(actionConfig.link, '_blank');
    }
  };

  const getNotificationIcon = (notification) => {
    if (!notification.additionalConfig?.icon?.enabled) {
      return null;
    }

    const iconConfig = notification.additionalConfig.icon;
    const iconColor = iconConfig.color || '#F69320';
    
    const iconProps = {
      color: iconColor,
      size: 16
    };

    switch (iconConfig.icon) {
      case 'warning':
        return <FaExclamationTriangle {...iconProps} />;
      case 'error':
        return <FaExclamationCircle {...iconProps} />;
      case 'info':
        return <FaInfoCircle {...iconProps} />;
      case 'check':
        return <FaCheck {...iconProps} />;
      default:
        return <FaInfoCircle {...iconProps} />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const unreadCount = notifications.length;

  const viewAllNotifications = () => {
    navigate('/notification-center');
    setIsOpen(false);
  };
  
  return (
    <div className="notification-container" ref={dropdownRef}>
      <div 
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
              >
                <FaCheck size={14} />
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                No unread notifications
              </div>
            ) : (
              notifications.map((notification) => {
                const icon = getNotificationIcon(notification);
                const actionConfig = notification.additionalConfig?.actionButtonConfig;
                const hasActionButton = actionConfig?.enabled && actionConfig.linkType === 'LINK';
                
                return (
                  <div
                    key={notification.id.id}
                    className="notification-item"
                  >
                    {icon && (
                      <div className="notification-icon">
                        {icon}
                      </div>
                    )}
                    <div className="notification-content">
                      <div className="notification-subject">
                        {notification.subject}
                      </div>
                      <div className="notification-text">
                        {notification.text}
                      </div>
                      {hasActionButton && (
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{
                            borderColor: '#F69320',
                            color: '#F69320',
                            '&:hover': {
                              borderColor: '#F69320',
                              backgroundColor: 'rgba(246, 147, 32, 0.04)'
                            },
                            marginTop: '4px',
                            fontSize: '11px',
                            padding: '2px 8px',
                            minWidth: 'auto',
                            lineHeight: 1.2,
                            height: '24px'
                          }}
                          onClick={(e) => handleActionButtonClick(notification, e)}
                        >
                          {actionConfig.text || 'View Details'}
                        </Button>
                      )}
                    </div>
                    
                    <div className="notification-right">
                      <div className="notification-time">
                        {formatTime(notification.createdTime)}
                      </div>
                      <button 
                        className="mark-read-btn"
                        onClick={(e) => handleMarkAsRead(notification, e)}
                        title="Mark as read"
                      >
                        <FaCheck size={12} />
                        <span className="mark-read-text">Mark as read</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button className="view-all-btn" onClick={viewAllNotifications}>View All Notifications</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;