// App.js
import './App.css';
import AppRoutes from './routes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useIdleTimer from './idletimer';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import Swal from 'sweetalert2';
import { stopTokenAutoRefresh } from './app/Services/app/loginservice';
import { UserDetailsContext } from './app/Shared/context/UserDetailsContext';
import { useContext, useEffect, useState } from 'react';
import DynamicSlidingKeyboard from './app/Shared/Pages/dynamicSlidingKeyboard/dynamicSlidingKeyboard';
import { getMachineInfo } from './app/Services/app/operatorservice';
import * as Sentry from '@sentry/react';

function ErrorFallback({ error, resetError }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: '#0f172a',
      color: '#fff', fontFamily: 'sans-serif', gap: '16px',
      padding: '24px', textAlign: 'center'
    }}>
      <h2 style={{ fontSize: '22px', margin: 0 }}>Something went wrong</h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '400px', margin: 0 }}>
        An unexpected error occurred. Our team has been notified automatically.
      </p>
      <p style={{ color: '#ef4444', fontSize: '12px', maxWidth: '500px', margin: 0 }}>
        {error?.message}
      </p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button onClick={resetError} style={{
          padding: '8px 20px', background: '#3b82f6', color: '#fff',
          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
        }}>
          Try Again
        </button>
        <button onClick={() => { window.location.href = '/'; }} style={{
          padding: '8px 20px', background: '#1e293b', color: '#94a3b8',
          border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
        }}>
          Go to Login
        </button>
      </div>
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const operatorPath = "/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV";
  const oeePath = '/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp';
  const oeePath2 = '/Ze9R2tLmN7wQvB2cF4kH2oPjU1yE0aDgT4sK2qWl~3rMnOp'
  const { logout } = useContext(UserDetailsContext);
  
const [touchEnabled, setTouchEnabled] = useState(false);

  useEffect(() => {
    const fetchMachine = async () => {
      try {
        const data = await getMachineInfo();
        localStorage.setItem("machineInfo", JSON.stringify(data));
        setTouchEnabled(data?.Touch === true);
      } catch (err) {
        console.error("Error fetching machine info:", err);
      }
    };
    fetchMachine();
  }, []);


  const handleLogout = () => {
    if (location.pathname === operatorPath || location.pathname === oeePath || location.pathname === oeePath2) {
      return;
    }
    Swal.fire({
      title: 'Are you sure want to logout?',
      showCancelButton: true,
      confirmButtonText: 'Ok',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        stopTokenAutoRefresh()
        localStorage.clear();
        navigate('/');
      }
    });
  };
  useIdleTimer({
    timeout: 3600, // 1 minute
    onTimeout: () => {
      handleLogout();
      logout();
      // You can also redirect, logout, or perform another action here
    }
  });
  return (
    <div className="App">
      <DynamicSlidingKeyboard touchEnabled={touchEnabled}/>
      <header className="App-header">
        <Sentry.ErrorBoundary fallback={({ error, resetError }) => (
          <ErrorFallback error={error} resetError={resetError} />
        )}>
          <AppRoutes />
        </Sentry.ErrorBoundary>
        <ToastContainer />
      </header>
    </div>
  );
}

export default Sentry.withProfiler(App);