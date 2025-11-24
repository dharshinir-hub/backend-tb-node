import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ allowed, children }) => {
  if (!allowed) return <Navigate to="/" replace />; // redirect to login
  return children;
};

export default ProtectedRoute;