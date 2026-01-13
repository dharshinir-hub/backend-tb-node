import React, { useState, useCallback, useMemo, useEffect, useContext } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, Navbar } from 'react-bootstrap';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  BiSolidDashboard, BiTimeFive, BiChip, BiBarChartAlt2,
  BiBarChart, BiPulse, BiSolidExtension,
  BiDetail
} from "react-icons/bi";
import { FiActivity } from 'react-icons/fi';
import {
  MdPowerSettingsNew, MdInsertInvitation, MdMarkunreadMailbox, MdAccountCircle,
  MdList, MdManageAccounts, MdPrecisionManufacturing, MdAssignmentTurnedIn, MdAssessment, MdTrendingUp, MdMoreVert, MdLock
} from "react-icons/md";
import { AiTwotoneProfile } from "react-icons/ai";
import { FaChartBar, FaCogs } from 'react-icons/fa';
import { Tooltip, Menu, MenuItem, IconButton } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import logo from '../../assets/yantraimage.png';
import Swal from 'sweetalert2';
import useMobileWidth from './smalldevicesidebar';
import './sidebars.css';
import { SlArrowDown } from "react-icons/sl";
import { GoChevronDown, GoChevronUp } from "react-icons/go";
import { IoSettingsOutline } from "react-icons/io5";
import { IoMdSettings } from "react-icons/io";
import { FaChartLine } from "react-icons/fa";
import { stopTokenAutoRefresh } from '../Services/app/loginservice';
import { UserDetailsContext } from '../Shared/context/UserDetailsContext';
import { TbChecklist, TbLayoutGrid } from "react-icons/tb";
import ChangePasswordCard from '../Nav/changepassword';
import NotificationBell from '../Pages/NotificationBell/notificationBell';
import { RiNotificationBadgeLine } from "react-icons/ri";



const handleConfigurationClick = () => {
  window.open(`${window._env_.SERVER_URL}home`, "_blank");
};

export default function PersistentDrawerLeft({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [operationOpen, setOperationOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const isMobile = useMobileWidth();
  const navigate = useNavigate();
  const location = useLocation();

  const { userDetails } = useContext(UserDetailsContext);
  const [pageList, setPageList] = useState(userDetails.pageList || []);

  useEffect(() => {
    const parsed = typeof userDetails === 'string' ? JSON.parse(userDetails) : userDetails;
    setPageList(parsed.pageList || []);
  }, [userDetails]);


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
      // toggle();
    }
  };

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  // const menuItem = useMemo(() => [
  //   ...(user === "TENANT_ADMIN" ? [{ path: "/configuration", name: "Configuration", icon: <MdManageAccounts /> }] : []),
  //   {
  //     name: "Dashboard",
  //     icon: <BiSolidDashboard />,
  //     children: [
  //       { path: "/company", name: "Company", icon: <BiBarChartAlt2 /> },
  //       { path: "/machinemm", name: "Machine", icon: <IoMdSettings /> },
  //       { path: "/deviceoee", name: "Oee", icon: <FaChartLine style={{ fontSize: "23px" }} /> },
  //     ]
  //   },
  //   // {
  //   //   name: "Analytics",
  //   //   icon: <BiBarChart />,
  //   //   children: [
  //   //     { path: "/analytics", name: "Analytics 1", icon: <BiBarChart /> },
  //   //   ]
  //   // },
  //   // { path: "/report", name: "Reports", icon: <MdAssessment /> },
  //   {
  //     name: "Operation",
  //     icon: <MdPrecisionManufacturing />,
  //     children: [
  //       { path: "/operator-details", name: "Allocation", icon: <MdAssignmentTurnedIn /> },
  //     ]
  //   },
  // {
  //   name: "Analytics",
  //   icon: <BiChip />,
  //   children: [
  //     { path: "/Alarm", name: "Alarms", icon: <BiChip /> },
  //     { path: "/CurrentShift", name: "Current Shift Details", icon: <BiTimeFive /> },
  //   ]
  // },
  //   {
  //     name: "Master",
  //     icon: <MdList />,
  //     children: [
  //       { path: "/machines", name: "Machine", icon: <MdPrecisionManufacturing /> },
  //       { path: "/shift-registration", name: "Shift", icon: <MdInsertInvitation /> },
  //       { path: "/operator-registration", name: "Operator", icon: <MdAccountCircle /> },
  //       { path: "/user-registration", name: "User", icon: <MdAccountCircle /> },
  //       { path: "/component-registration", name: "Component", icon: <MdMarkunreadMailbox /> },
  //       { path: "/reason-registration", name: "Reason", icon: <MdList /> },
  //     ]
  //   },
  // ], [user]);

  const menuItem = useMemo(() => {
    const baseItems = [
      ...(user === "TENANT_ADMIN"
        ? [{ path: "/configuration", name: "Configuration", icon: <MdManageAccounts /> }]
        : []),
      {
        name: "Dashboard",
        icon: <BiSolidDashboard />,
        children: [
          { path: "/kpi-dashboard", name: "KPI", icon: <FaChartBar /> },
          { path: "/company", name: "Company", icon: <BiBarChartAlt2 /> },
          { path: "/machinemm", name: "Machine", icon: <IoMdSettings /> },
          { path: "/deviceoee", name: "Oee", icon: <FaChartLine style={{ fontSize: "23px" }} /> },
        ],
      },
      {
        name: "Analytics",
        icon: <BiBarChart />,
        children: [
          { path: "/analytics", name: "Operation", icon: <TbLayoutGrid size={20} /> },
          { path: "/production-analysis", name: "Component", icon: <FaCogs size={18} /> }
        ]
      },
      {
        name: "Leaderboard",
        icon: <BiBarChartAlt2 />,
        children: [
          { path: "/operator-leaderboard", name: "Operator", icon: <TbLayoutGrid size={20} /> }

        ]
      },
      { path: "/reports", name: "Reports", icon: <MdAssessment /> },
      {
        name: "Operation",
        icon: <AiTwotoneProfile />,
        children: [{ path: "/operator-details", name: "Allocation", icon: <MdAssignmentTurnedIn /> }],
      },
      {
        name: "Master",
        icon: <MdList />,
        children: [
          { path: "/machines", name: "Machine", icon: <MdPrecisionManufacturing /> },
          { path: "/machines-group", name: "Machine Group", icon: <FaCogs /> },
          { path: "/shift-registration", name: "Shift", icon: <MdInsertInvitation /> },
          // { path: "/operator-registration", name: "Operator", icon: <MdAccountCircle /> },
          { path: "/user-registration", name: "User", icon: <MdAccountCircle /> },
          { path: "/component-registration", name: "Component", icon: <MdMarkunreadMailbox /> },
          { path: "/reason-registration", name: "Reason", icon: <TbChecklist /> },
        ],
      },
      { path: "/notification-center", name: "Notification Center", icon: <RiNotificationBadgeLine /> },
    ];
    return baseItems
      .map((item) => {
        if (item.children) {
          const allowedChildren = item.children.filter((child) =>
            pageList.includes(child.path.replace("/", ""))
          );
          return allowedChildren.length > 0 ? { ...item, children: allowedChildren } : null;
        }
        return pageList.includes(item.path.replace("/", "")) ? item : null;
      })
      .filter(Boolean);
  }, [user, pageList]);


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
        stopTokenAutoRefresh();
        localStorage.clear();
        navigate('/');
      }
    });
  };

  const formattedUser = typeof user === 'string'
    ? user.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    : '';

  const renderDropdown = (item, isOpenState, setIsOpenState) => (
    <div key={item.name}>
      <div
        className="link navlink"
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          alignItems: 'baseline',
          cursor: 'pointer',
          padding: '8px 12px'
        }}
        onClick={() => setIsOpenState(!isOpenState)}
      >
        <div className="icon">{item.icon}</div>
        {isOpen && (
          <div style={{ marginLeft: '8px' }} className="link_text">
            {item.name} {isOpenState ? <GoChevronUp /> : <GoChevronDown />}
          </div>
        )}
      </div>

      {isOpenState && (
        <div style={{ marginLeft: isOpen ? '30px' : '0' }}>
          {item.children.map((child, idx) => (
            <NavLink
              to={child.path}
              key={idx}
              className={({ isActive }) =>
                isActive ? 'link navlink active' : 'link navlink'
              }
              onClick={handleMenuItemClick(child)}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                padding: '6px 12px'
              }}
            >
              <div className="icon">{child.icon}</div>
              {isOpen && (
                <div style={{ marginLeft: '8px' }} className="link_text">
                  {child.name}
                </div>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );

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
            <NotificationBell />
            <span className="person" style={{
              backgroundColor: 'black',
              color: 'white',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '15px',
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
            {/* <IconButton onClick={handleClick} size="large">
              <MdMoreVert />
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  setShowChangePassword(true);
                  handleClose();
                }}
              >
                <Tooltip title="Change Password">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdLock style={{ fontSize: '20px' }} />
                    Change Password
                  </span>
                </Tooltip>
              </MenuItem>

              <MenuItem
                onClick={() => {
                  handleLogout();
                  handleClose();
                }}
              >
                <Tooltip title="Log out">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdPowerSettingsNew style={{ fontSize: '20px' }} />
                    Log out
                  </span>
                </Tooltip>
              </MenuItem>
            </Menu>

            {showChangePassword && (
              <ChangePasswordCard onClose={() => setShowChangePassword(false)} />
            )} */}
          </div>
        </div>
      </Navbar>

      <div className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="top_section">
          <br />
          <img className="Logo1" src={logo} alt="Sidebar Logo" />
          <br />
        </div>
        {menuItem.map((item) => (
          item.children ? (
            item.name === "Master" ? renderDropdown(item, masterOpen, setMasterOpen) :
              item.name === "Dashboard" ? renderDropdown(item, dashboardOpen, setDashboardOpen) :
                item.name === "Operation" ? renderDropdown(item, operationOpen, setOperationOpen) :
                  item.name === "Analytics" ? renderDropdown(item, analyticsOpen, setAnalyticsOpen) :
                    item.name === "Leaderboard" ? renderDropdown(item, leaderboardOpen, setLeaderboardOpen) :
                      null
          ) : (
            <NavLink
              to={item.path}
              key={item.name}
              className={({ isActive }) =>
                isActive ? 'link navlink active' : 'link navlink'
              }
              onClick={handleMenuItemClick(item)}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px'
              }}
            >
              <div className="icon">{item.icon}</div>
              {isOpen && (
                <div style={{ marginLeft: '8px' }} className="link_text">
                  {item.name}
                </div>
              )}
            </NavLink>
          )
        ))}
      </div>

      <main
        className="main-content"
        style={{
          paddingLeft: isOpen
            ? '240px'
            : '85px',
          transition: 'padding-left 0.3s ease'
        }}
      >
        <Outlet />
      </main>
    </>
  );
}
