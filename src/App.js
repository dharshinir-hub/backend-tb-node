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
import { useContext } from 'react';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const operatorPath = "/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV";
  const oeePath = '/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp';
  const { logout } = useContext(UserDetailsContext);
  const handleLogout = () => {
    if (location.pathname === operatorPath || location.pathname === oeePath) {
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
      <header className="App-header">
        <AppRoutes />
        <ToastContainer />

      </header>
    </div>
  );
}

export default App;