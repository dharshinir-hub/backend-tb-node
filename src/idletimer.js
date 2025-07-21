import { useEffect, useRef } from 'react';

/**
 * @typedef {Object} IdleTimerOptions
 * @property {number} timeout - in seconds
 * @property {function(): void} onTimeout
 */

const useIdleTimer = ({ timeout, onTimeout }) => {
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);

  const updateExpiredTime = () => {
    const newExpiryTime = Date.now() + timeout * 1000;
    localStorage.setItem("_expiredTime", newExpiryTime.toString());

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      localStorage.setItem("_expiredTime", newExpiryTime.toString());
    }, 300);
  };

  const handleUserActivity = () => {
    updateExpiredTime();
  };

  useEffect(() => {
    updateExpiredTime();

    intervalRef.current = setInterval(() => {
      const expiredTime = parseInt(localStorage.getItem("_expiredTime") || '', 10);
      if (expiredTime < Date.now()) {
        onTimeout();
        cleanup();
      }
    }, 1000);

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };

    return cleanup;
  }, [timeout, onTimeout]);
};

export default useIdleTimer;
