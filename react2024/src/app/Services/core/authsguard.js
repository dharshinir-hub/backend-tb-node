// AuthGuard.js
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

const AuthGuard = (Component) => {
  const ProtectedComponent = (props) => {
    const navigate = useNavigate();
    const getJWToken = localStorage.getItem('tokens');

    if (getJWToken !== null) {
      return <Component {...props} />;
    } else {
      console.log('Redirecting to root path');
      navigate('/');
      return null;
    }
  };

  return ProtectedComponent;
};

export default AuthGuard;