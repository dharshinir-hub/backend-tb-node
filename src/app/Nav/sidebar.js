import React, { useState, useCallback, useMemo, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, Navbar } from 'react-bootstrap';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { BiSolidDashboard,BiTimeFive,BiChip,BiArea, BiBarChartAlt2} from "react-icons/bi";import { MdPowerSettingsNew, MdInsertInvitation, MdMarkunreadMailbox, MdAccountCircle, MdList, MdManageAccounts,MdPrecisionManufacturing,MdAssignmentTurnedIn } from "react-icons/md";
import { Tooltip } from '@mui/material';
import './sidebars.css';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import logo from '../../assets/yantraimage.png';
import Swal from 'sweetalert2';
import useMobileWidth from './smalldevicesidebar';

// Import the configuration click handler from login.js (or define it here if not exported)
const handleConfigurationClick = () => {
  // This is the function from login.js (file_context_0)
  window.open(`${window._env_.SERVER_URL}home`, "_blank");
};

export default function PersistentDrawerLeft({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMobileWidth();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('authority')) || '';
  } catch (e) {
    user = '';
  }
  const firstName = JSON.parse(localStorage.getItem('firstName') || 'null');
  const lastName = JSON.parse(localStorage.getItem('lastName') || 'null');
  const username = [firstName, lastName].filter(Boolean).join(' ');
  const linkTextStyle = {
    display: isOpen ? 'block' : 'none',
    marginLeft: '8px',
  };
  const containerStyle = {
    display: 'flex',
    alignItems: 'center'
  };

  const toggle = useCallback(() => {
    setIsOpen(prevIsOpen => !prevIsOpen);
  }, []);

  // Add a special handler for configuration menu
  const handleMenuItemClick = (item) => (e) => {
    if (item.name === "Configuration") {
      e.preventDefault(); // Prevent navigation
      handleConfigurationClick();
      // Optionally, close sidebar on mobile
      if (isMobile) setIsOpen(false);
      return;
    }
    // For other menu items, handle sidebar toggle
    if (isMobile) {
      setIsOpen(false);
    } else {
      toggle();
    }
  };

  const menuItem = useMemo(() => [
    // Show Configuration menu only if authority is TENANT_ADMIN
    ...(user === "TENANT_ADMIN"
      ? [{ path: "/configuration", name: "Configuration", icon: <MdManageAccounts /> }]
      : []),
    { path: "/andon-dashboard", name: "Andon Dashboard", icon: <BiSolidDashboard /> },
    { path: "/shift-registration", name: "Shift", icon: <MdInsertInvitation /> },
    { path: "/component-registration", name: "Component", icon: <MdMarkunreadMailbox /> },
    { path: "/operator-registration", name: "User", icon: <MdAccountCircle /> },
    { path: "/reason-registration", name: "Reason", icon: <MdList /> },
    { path: "/machines", name: "Machine", icon: <MdPrecisionManufacturing /> },
    { path: "/operator-details", name: "Allocation", icon: <MdAssignmentTurnedIn /> },
    { path: "/company", name: "Company", icon: <BiBarChartAlt2 /> },
     { path: "/Alarm", name: "Machines", icon: <BiChip /> },
     { path: "/CurrentShift", name: "Current Shift Details", icon: <BiTimeFive /> },


    // { path: "/oee", name: "OEE", icon: <BiSolidDashboard /> },
    // { path: "/status_chart", name: "M-Status Chart", icon: <BiSolidDashboard /> },
    // { path: "/efficiency_report", name: "Efficiency Report", icon: <CgTimelapse /> },
    // { path: "/general_report", name: "General Report", icon: <MdFileCopy /> },
    // { path: "/idle_report", name: "Idle Reason Report", icon: <MdDataUsage /> },
    // { path: "/compare_chart", name: "Compare chart", icon: <IoMdGitCompare /> },
    // { path: "/quality_entry", name: "Quality Entry", icon: <CgTimelapse /> },
    // { path: "/machines", name: "Machine", icon: <MdWidgets /> },
    // { path: "/shift", name: "Shift", icon: <MdInsertInvitation /> },
    // { path: "/user", name: "User", icon: <MdPersonAdd /> },
    // { path: "/component", name: "Component", icon: <MdMarkunreadMailbox /> },
    // { path: "/operator", name: "Operator", icon: <MdAccountCircle /> },
    // { path: "/reason", name: "Reason", icon: <MdList /> },
    // { path: "/m_dashboard", name: "M-DashBoard", icon: <BiSolidDashboard /> },
    // { path: "/alarm", name: "Alarms", icon: <IoIosAlarm /> },
    // { path: "/alarm_report", name: "Alarm Report", icon: <IoIosAlarm /> },
    // { path: "/trend_chart", name: "Trend Chart", icon: <MdList /> },
    // { path: "/m_machine", name: "M-Machine", icon: <MdWidgets /> },
  ], []);

  const location = useLocation();
  useEffect(() => {
    console.log("Current active route:", location.pathname);
  }, [location]);

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

  const formattedUser = typeof user === 'string'
    ? user
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
    : '';

  return (
    <>
      <Navbar className="navbar">
        <div className="navbarcontent">
          <Button variant="outline-info" onClick={toggle} style={{ textAlign: 'center', color: 'black' }}>
            <span className="menu-icon">&#9776;</span>
          </Button>
          <img className="Logo" src={logo} alt="Description of Logo" />
          <span style={{ fontWeight: '500',fontSize:'20px' }}>Smart Supervisor</span>
          <div className="rightsidecontents">
            {/* <p>Welcome {formattedUser}</p>
            <span className="person">
              <PersonOutlineIcon
                className="v-align-middle display as-display"
                style={{ fontSize: '24px' }}
                aria-hidden="true"
              />
            </span> */}
             <span
              className="person"
              style={{
                backgroundColor: 'black',
                color: 'white',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PersonOutlineIcon
                className="v-align-middle display as-display"
                style={{ fontSize: '24px' }}
                aria-hidden="true"
              />
            </span>
            <div>
              <h6>{username}</h6>
              <p>{formattedUser}</p>
            </div>
            
            <Tooltip title="Log-out" aria-describedby="cdk-describedby-message-1">
              <label className="circles-icon" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                <MdPowerSettingsNew />
              </label>
            </Tooltip>
          </div>
        </div>
      </Navbar>
      <div>
        <div>
          <div className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="top_section">
              <br />
              <img className="Logo1" src={logo} alt="Description of Logo" />
              <br />
            </div>
            {menuItem.map((item, index) => (
              <NavLink
                to={item.path}
                key={index}
                className={({ isActive }) => isActive ? 'link navlink active' : 'link navlink'}
                onClick={handleMenuItemClick(item)}
                style={{ textDecoration: 'none', color: 'inherit', position: 'relative', display: 'block' }}
              >
                <div style={containerStyle}>
                  <div className="icon" data-tooltip-id={`tooltip-${index}`}>
                    {isOpen ? (
                      item.icon
                    ) : (
                      <Tooltip title={item.name} placement="top-start">
                        <div className="icon" data-tooltip-id={`tooltip-${index}`}>{item.icon}</div>
                      </Tooltip>
                    )}
                  </div>
                  <div style={linkTextStyle} className="link_text">
                    {isOpen ? item.name : ''}
                  </div>
                </div>
              </NavLink>
            ))}
            <br />
          </div>
          <main
            className="main-content"
            style={{ paddingLeft: isOpen ? '230px' : '100px', transition: 'padding-left 0.3s ease' }}
          >
            <Outlet />
          </main>
        </div>
      </div>
      {/* <footer className="footer">
        Footer Content
      </footer> */}
    </>
  );
}
