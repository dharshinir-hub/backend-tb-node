// AuthGuard.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import TokenService from './tokenservice'; // Import your token service

const AuthGuard = (Component) => {
  const ProtectedComponent = (props) => {
    const isAuthenticated = TokenService.isTokenValidated(); // Replace with your authentication logic

    if (isAuthenticated) {
      return <Component {...props} />;
    } else {
      // Redirect to the login page or any other page you want
      return <Navigate to="/login" replace />;
    }
  };

  return ProtectedComponent;
};

export default AuthGuard;