import React, { createContext, useState } from 'react';

export const UserDetailsContext = createContext();

export const UserDetailsProvider = ({ children }) => {
  const [userDetails, setUserDetails] = useState(
    JSON.parse(localStorage.getItem('userDetails')) || {}
  );

const updateUserDetails = (data) => {
  try {
    let parsedData = typeof data === "string" ? JSON.parse(data) : { ...data };
    if (!Array.isArray(parsedData.pageList)) {
      parsedData.pageList = [];
    }
    if (!parsedData.pageList.includes("notification-center")) {
      parsedData.pageList.push("notification-center");
    }
    localStorage.setItem("userDetails", JSON.stringify(parsedData));
    setUserDetails(parsedData);
  } catch (error) {
    console.error("Failed to update user details:", error);
  }
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
