// App.js
import './App.css';
import AppRoutes from './routes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useIdleTimer from './idletimer';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import Swal from 'sweetalert2';

function App() {
  const navigate = useNavigate();

  const handleLogout = () => {
    Swal.fire({
      title: 'Are you sure want to logout?',
      showCancelButton: true,
      confirmButtonText: 'Ok',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.clear();
        navigate('/');
      }
    });
  };
  useIdleTimer({
    timeout: 3600, // 1 minute
    onTimeout: () => {
      handleLogout();
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