import React, { createContext, useState } from 'react';

export const UserDetailsContext = createContext();

export const UserDetailsProvider = ({ children }) => {
    debugger
  const [userDetails, setUserDetails] = useState(
    JSON.parse(localStorage.getItem('userDetails')) || {}
  );

  const updateUserDetails = (data) => {
    localStorage.setItem('userDetails', data);
    setUserDetails(data);
  };

  const logout = () => {
    localStorage.removeItem('userDetails');
    setUserDetails({});
  };

  return (
    <UserDetailsContext.Provider value={{ userDetails, updateUserDetails, logout }}>
      {children}
    </UserDetailsContext.Provider>
  );
};
