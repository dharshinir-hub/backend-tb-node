import React, { createContext, useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

export const UserDetailsContext = createContext();

export const UserDetailsProvider = ({ children }) => {
  const [userDetails, setUserDetails] = useState(
    JSON.parse(localStorage.getItem('userDetails')) || {}
  );

  // Re-identify user on page refresh if already logged in
  useEffect(() => {
    const customerId = JSON.parse(localStorage.getItem('CustomerID'));
    const customerTitle = localStorage.getItem('customerTitle');
    const email = localStorage.getItem('email');
    if (!customerId) return;
    const env = window._env_ || {};
    Sentry.setUser({
      id: customerId,
      email,
      customer: customerTitle || 'Unknown',
      environment: window.location.hostname === 'smart.yantra24x7.com' ? 'production' : 'development',
    });
    posthog.identify(customerId, {
      email,
      customer: customerTitle || 'Unknown',
      environment: window.location.hostname === 'smart.yantra24x7.com' ? 'production' : 'development',
    });
  }, []);

  const updateUserDetails = (data) => {
    try {
      let parsedData = typeof data === 'string' ? JSON.parse(data) : { ...data };
      if (!Array.isArray(parsedData.pageList)) {
        parsedData.pageList = [];
      }
      if (!parsedData.pageList.includes('notification-center')) {
        parsedData.pageList.push('notification-center');
      }
      localStorage.setItem('userDetails', JSON.stringify(parsedData));
      setUserDetails(parsedData);
    } catch (error) {
      console.error('Failed to update user details:', error);
    }
  };

  const logout = () => {
    posthog.reset();
    Sentry.setUser(null);
    localStorage.removeItem('userDetails');
    setUserDetails({});
  };

  return (
    <UserDetailsContext.Provider value={{ userDetails, updateUserDetails, logout }}>
      {children}
    </UserDetailsContext.Provider>
  );
};
