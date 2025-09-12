import React, { useState, useCallback, useMemo, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, Navbar } from 'react-bootstrap';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  BiSolidDashboard, BiTimeFive, BiChip, BiBarChartAlt2
} from "react-icons/bi";
import {
  MdPowerSettingsNew, MdInsertInvitation, MdMarkunreadMailbox, MdAccountCircle,
  MdList, MdManageAccounts, MdPrecisionManufacturing, MdAssignmentTurnedIn, MdAssessment,MdTrendingUp,
} from "react-icons/md";
import { Tooltip } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import logo from '../../assets/yantraimage.png';
import Swal from 'sweetalert2';
import useMobileWidth from './smalldevicesidebar';
import './sidebars.css';

const handleConfigurationClick = () => {
  window.open(`${window._env_.SERVER_URL}home`, "_blank");
};

 export default function PersistentDrawerLeft({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMobileWidth();
  const navigate = useNavigate();
  const location = useLocation();

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('authority')) || '';
  } catch (e) {
    user = '';
  }

  const firstName = JSON.parse(localStorage.getItem('firstName') || 'null');
  const lastName = JSON.parse(localStorage.getItem('lastName') || 'null');
  const username = [firstName, lastName].filter(Boolean).join(' ');

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const handleMenuItemClick = (item) => (e) => {
    if (item.name === "Configuration") {
      e.preventDefault();
      handleConfigurationClick();
      if (isMobile) setIsOpen(false);
    } else if (isMobile) {
      setIsOpen(false);
    } else {
      toggle();
    }
  };

  const menuItem = useMemo(() => [
    ...(user === "TENANT_ADMIN" ? [{ path: "/configuration", name: "Configuration", icon: <MdManageAccounts /> }] : []),
        { path: "/company", name: "Company", icon: <BiBarChartAlt2 /> },
    { path: "/machinemm", name: "Machines", icon: <BiSolidDashboard /> },
    // { path: "/analytics", name: "Analytics", icon: <BiChip /> },
    // { path: "/CurrentShift", name: "Current Shift Details", icon: <BiTimeFive /> },
    { path: "/report", name: "Reports", icon: <MdTrendingUp /> },
    // { path: "/andon-dashboard", name: "Andon Dashboard", icon: <BiSolidDashboard /> },
    { path: "/shift-registration", name: "Shift", icon: <MdInsertInvitation /> },
    { path: "/component-registration", name: "Component", icon: <MdMarkunreadMailbox /> },
    { path: "/operator-registration", name: "User", icon: <MdAccountCircle /> },
    { path: "/reason-registration", name: "Reason", icon: <MdList /> },
    { path: "/machines", name: "Machine", icon: <MdPrecisionManufacturing /> },
    { path: "/operator-details", name: "Allocation", icon: <MdAssignmentTurnedIn /> },
    


  ], [user]);

  useEffect(() => {
    console.log("Current active route:", location.pathname);
  }, [location]);

  const handleLogout = () => {
    Swal.fire({
      title: 'Are you sure want  to logout?',
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

  const formattedUser = typeof user === 'string'
    ? user.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    : '';

  return (
    <>
      <Navbar className="navbar">
        <div className="navbarcontent">
          <Button variant="outline-info" onClick={toggle} style={{ textAlign: 'center', color: 'black' }}>
            <span className="menu-icon">&#9776;</span>
          </Button>
          <img className="Logo" src={logo} alt="Logo" />
         <span style={{ fontWeight: '500', fontSize: '20px' }}></span>
          <div className="rightsidecontents">
            <span className="person" style={{
              backgroundColor: 'black',
              color: 'white',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight:'15px',
            }}>
              <PersonOutlineIcon style={{ fontSize: '24px' }} />
            </span>
            <div>
              <h6>{username}</h6>
              <p>{formattedUser}</p>
            </div>
            <Tooltip title="Log-out">
              <label className="circles-icon" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                <MdPowerSettingsNew />
              </label>
            </Tooltip>
          </div>
        </div>
      </Navbar>

      <div className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="top_section">
          <br />
          <img className="Logo1" src={logo} alt="Sidebar Logo" />
          <br />
        </div>
        {menuItem.map((item, index) => (
          <NavLink
            to={item.path}
            key={index}
            className={({ isActive }) => isActive ? 'link navlink active' : 'link navlink'}
            onClick={handleMenuItemClick(item)}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="icon">
                {isOpen ? item.icon : (
                  <Tooltip title={item.name} placement="top-start">
                    <div className="icon">{item.icon}</div>
                  </Tooltip>
                )}
              </div>
              <div style={{ display: isOpen ? 'block' : 'none', marginLeft: '8px' }} className="link_text">
                {isOpen && item.name}
              </div>
            </div>
          </NavLink>
        ))}
      </div>

      <main
        className="main-content"
        style={{ paddingLeft: isOpen ? '180px' : '90px', transition: 'padding-left 0.3s ease' }}
      >
        <Outlet />
      </main>
    </>
  );
}
