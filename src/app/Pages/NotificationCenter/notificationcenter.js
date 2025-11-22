import {
  Card,
  Checkbox,
  Chip,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  IconButton,
  Tooltip,
  Button,
  TablePagination,
  Box,
  Typography,
  Badge,
  ToggleButton,
  ToggleButtonGroup
} from "@mui/material";
import { useEffect, useState } from "react";
import { deleteNotification, getNotifications, markAllAsRead, markAsRead, getRecipientGroups, deleteRecipientGroup, getRecipientGroupsFromAttribute } from "../../Services/app/notificationservice";
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import Swal from 'sweetalert2';
import './notificationcenter.css';
import { FiSend } from "react-icons/fi";
import SendNotificationPopup from "../SendNotificationPopup/sendNotificationPopup";
import CreateGroupDialog from "../CreateGroupDialog/createGroupDialog";
import { getCustomerUsers } from "../../Services/app/operatorservice";

const NotificationCenter = () => {
  const [selectedTab, setSelectedTab] = useState("inbox");
  const [inboxView, setInboxView] = useState("unread"); // "unread" or "all"
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Recipients state - updated for client-side pagination
  const [allRecipientGroups, setAllRecipientGroups] = useState([]); // Store all groups
  const [displayedRecipientGroups, setDisplayedRecipientGroups] = useState([]); // Groups to display on current page
  const [recipientPage, setRecipientPage] = useState(0);
  const [recipientRowsPerPage, setRecipientRowsPerPage] = useState(10);
  const [recipientTotalCount, setRecipientTotalCount] = useState(0);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);

  const formatEpochTime = (epochTime) => {
    if (!epochTime) return '-';
    const date = new Date(epochTime);

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const timeString = `${hours}:${minutes} ${ampm}`;

    if (isToday) return `Today, ${timeString}`;
    if (isYesterday) return `Yesterday, ${timeString}`;
    
    const month = date.toLocaleString('default', { month: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${day} ${month} ${year}, ${timeString}`;
  };

  const handleLinkRedirect = (notification, e) => {
    e.stopPropagation();
    const actionConfig = notification.additionalConfig?.actionButtonConfig;
    if (actionConfig?.enabled && actionConfig.linkType === 'LINK' && actionConfig.link) {
      window.open(actionConfig.link, '_blank');
    }
  };

  // Notifications functions (server-side pagination - unchanged)
  const fetchNotifications = async (pageNum = page, size = rowsPerPage) => {
    setLoading(true);
    try {
      const unreadOnly = inboxView === "unread";
      const response = await getNotifications(size, pageNum, unreadOnly);
      setNotifications(response.data || []);
      setTotalCount(response.totalElements || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to fetch notifications',
        timer: 3000
      });
      setNotifications([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Updated recipient groups function - get all data once
  const fetchRecipientGroups = async () => {
    try {
      const res = await getRecipientGroupsFromAttribute();
      const allGroups = res || [];
      setAllRecipientGroups(allGroups);
      setRecipientTotalCount(allGroups.length);
      
      // Apply pagination to the data
      updateDisplayedRecipientGroups(allGroups, recipientPage, recipientRowsPerPage);
    } catch (error) {
      console.error("Error fetching recipient groups:", error);
      Swal.fire({
        icon: 'error',
        title: 'Load Failed',
        text: 'Failed to load recipient groups.',
      });
      setAllRecipientGroups([]);
      setDisplayedRecipientGroups([]);
      setRecipientTotalCount(0);
    }
  };

  // Client-side pagination function for recipient groups
  const updateDisplayedRecipientGroups = (groups, pageNum, rowsPerPage) => {
    const startIndex = pageNum * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedGroups = groups.slice(startIndex, endIndex);
    setDisplayedRecipientGroups(paginatedGroups);
  };

  const getUsersList = async () => {
    try {
      const customerId = JSON.parse(localStorage.getItem("CustomerID"));
      const res = await getCustomerUsers(customerId);
      const usersList = res.data || [];
      const modifiedUsers = usersList.map((u) => ({ id: u?.id?.id, email: u?.email }));
      setAvailableUsers(modifiedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleInboxViewChange = (event, newView) => {
    if (newView !== null) {
      setInboxView(newView);
      setPage(0);
      setSelectedNotifications([]);
    }
  };

  const tabChange = (currentTab) => {
    setSelectedTab(currentTab);
    setPage(0);
    setRecipientPage(0);
    setSelectedNotifications([]);

    if (currentTab === "inbox") {
      fetchNotifications(0, rowsPerPage);
    } else if (currentTab === "recipients") {
      fetchRecipientGroups();
      getUsersList();
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    fetchNotifications(newPage, rowsPerPage);
  };

  // Updated recipient pagination - client-side
  const handleRecipientPageChange = (event, newPage) => {
    setRecipientPage(newPage);
    updateDisplayedRecipientGroups(allRecipientGroups, newPage, recipientRowsPerPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    fetchNotifications(0, newRowsPerPage);
  };

  // Updated recipient rows per page change - client-side
  const handleRecipientRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRecipientRowsPerPage(newRowsPerPage);
    setRecipientPage(0);
    updateDisplayedRecipientGroups(allRecipientGroups, 0, newRowsPerPage);
  };

  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications(prev => {
      if (prev.includes(notificationId)) {
        return prev.filter(id => id !== notificationId);
      } else {
        return [...prev, notificationId];
      }
    });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allIds = notifications.map(notification => notification.id.id);
      setSelectedNotifications(allIds);
    } else {
      setSelectedNotifications([]);
    }
  };

  const handleMarkAsRead = async (notification) => {
    if (!notification) return;

    try {
      await markAsRead(notification.id.id);
      await Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Notification marked as read',
        timer: 2000,
        showConfirmButton: false
      });
      fetchNotifications(page, rowsPerPage);
    } catch (err) {
      console.log(err, 'error');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to mark notification as read',
        timer: 3000
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to mark all ${notifications.length} notifications as read`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, mark all as read!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await markAllAsRead();
        await Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'All notifications marked as read',
          timer: 2000,
          showConfirmButton: false
        });
        fetchNotifications(page, rowsPerPage);
      } catch (err) {
        console.error('Error during mark all as read:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to mark all notifications as read',
          timer: 3000
        });
      }
    }
  };

  const handleDelete = async (notification) => {
    if (!notification) return;

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete the notification: "${notification.subject}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await deleteNotification(notification.id.id);
        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Notification has been deleted',
          timer: 2000,
          showConfirmButton: false
        });
        fetchNotifications(page, rowsPerPage);
      } catch (err) {
        console.error('Error during delete:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete notification',
          timer: 3000
        });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length === 0) return;

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete ${selectedNotifications.length} selected notification(s)`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: `Yes, delete ${selectedNotifications.length} item(s)!`,
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await Promise.all(
          selectedNotifications.map(id => deleteNotification(id))
        );
        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: `${selectedNotifications.length} notification(s) have been deleted`,
          timer: 2000,
          showConfirmButton: false
        });
        fetchNotifications(page, rowsPerPage);
        setSelectedNotifications([]);
      } catch (err) {
        console.error('Error during bulk delete:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete notifications',
          timer: 3000
        });
      }
    }
  };

  // Updated recipient group functions to handle client-side data
  const handleDeleteGroup = async (group) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete the group: "${group.name}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await deleteRecipientGroup(group.id.id);
        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: `Group "${group.name}" has been deleted successfully.`,
          timer: 2000,
          showConfirmButton: false
        });
        // Refresh the entire list after deletion
        await fetchRecipientGroups();
      } catch (error) {
        console.error('Error deleting group:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: 'Failed to delete group. Please try again.',
        });
      }
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setCreateGroupOpen(true);
  };

  // Get user emails for a group
  const getUserEmailsForGroup = (group) => {
    const userIds = group.configuration?.usersFilter?.usersIds || [];
    return userIds.map(userId => {
      const user = availableUsers.find(u => u.id === userId);
      return user ? user.email : userId;
    });
  };

  useEffect(() => {
    if (selectedTab === "inbox") {
      fetchNotifications();
    } else if (selectedTab === "recipients") {
      fetchRecipientGroups();
      getUsersList();
    }
  }, [selectedTab,inboxView]);

  // Update displayed groups when allRecipientGroups changes
  useEffect(() => {
    if (allRecipientGroups.length > 0) {
      updateDisplayedRecipientGroups(allRecipientGroups, recipientPage, recipientRowsPerPage);
    }
  }, [allRecipientGroups]);

  const renderInboxTab = () => (
    <Box>
      {/* Top controls with selection indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          my: 2,
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={inboxView}
            exclusive
            onChange={handleInboxViewChange}
            aria-label="notification view"
            size="small"
          >
            <ToggleButton value="unread" aria-label="unread only">
              Unread
            </ToggleButton>
            <ToggleButton value="all" aria-label="all notifications">
              All
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            onClick={handleMarkAllAsRead}
            sx={{
              borderColor: "#F47804",
              color: "#F47804",
              fontWeight: 500,
              "&:hover": {
                borderColor: "#d86602",
                backgroundColor: "rgba(244, 120, 4, 0.04)",
              },
            }}
          >
            Mark All as Read
          </Button>
        </Box>

        {/* Selection indicator and bulk actions */}
        {selectedNotifications.length > 0 && (
          <Box sx={{marginRight: 5 }}>
          
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={handleBulkDelete}
              startIcon={<DeleteIcon />}
              sx={{
                backgroundColor: '#d32f2f',
                '&:hover': {
                  backgroundColor: '#b71c1c',
                },
              }}
            >
              Delete Selected ({selectedNotifications.length})
            </Button>
          </Box>
        )}
      </Box>

      <Card className="card_sec">
        <div className="example-container-1">
          <Table stickyHeader aria-label="notifications table">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedNotifications.length > 0 &&
                      selectedNotifications.length < notifications.length
                    }
                    checked={
                      notifications.length > 0 &&
                      selectedNotifications.length === notifications.length
                    }
                    onChange={handleSelectAll}
                     sx={{
                            '&.Mui-checked': {
                              color: '#F47804',
                            },
                          }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: 13 }}>Subject</TableCell>
                <TableCell sx={{ fontSize: 13 }}>Message</TableCell>
                <TableCell sx={{ fontSize: 13 }}>Sent By</TableCell>
                <TableCell sx={{ fontSize: 13 }}>Created</TableCell>
                <TableCell sx={{ fontSize: 13 }}>Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ background: '#f8f8f8' }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ background: '#f8f8f8', fontSize: 13 }}>
                    No {inboxView === "unread" ? "unread" : ""} notifications found
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification, index) => {
                  const rowBg = index % 2 === 0 ? '#efefef' : '#f8f8f8';
                  const hasLink =
                    notification.additionalConfig?.actionButtonConfig?.enabled &&
                    notification.additionalConfig.actionButtonConfig.linkType === 'LINK' &&
                    notification.additionalConfig.actionButtonConfig.link;

                  // 🧩 Sender logic
                  const loggedInEmail = localStorage.getItem('email')?.trim()?.toLowerCase();
                  const sentByEmail = notification.additionalConfig?.sentByEmail?.trim()?.toLowerCase();

                  let sentBy = 'Machine';
                  if (sentByEmail) {
                    sentBy = sentByEmail === loggedInEmail ? 'You' : notification.additionalConfig.sentByEmail;
                  }

                  return (
                    <TableRow
                      key={notification.id.id}
                      hover
                      selected={selectedNotifications.includes(notification.id.id)}
                      sx={{
                        backgroundColor: selectedNotifications.includes(notification.id.id) 
                          ? 'rgba(244, 120, 4, 0.08)' 
                          : rowBg
                      }}
                    >
                      <TableCell padding="checkbox" sx={{ padding: '6px 8px', background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>
                        <Checkbox
                          checked={selectedNotifications.includes(notification.id.id)}
                          onChange={() => handleSelectNotification(notification.id.id)}
                          sx={{
                            '&.Mui-checked': {
                              color: '#F47804',
                            },
                          }}
                        />

                      </TableCell>

                      <TableCell sx={{ padding: '6px 8px', fontSize: 13 , background: index % 2 === 0 ? '#efefef' : '#f8f8f8'}}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          
                          {notification.subject}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ padding: '6px 8px', fontSize: 13, background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>
                        {notification.text}
                      </TableCell>

                      {/* 🟢 Sent By column with "You" logic */}
                      <TableCell sx={{ padding: '6px 8px', fontSize: 13,  background: index % 2 === 0 ? '#efefef' : '#f8f8f8',color: '#555' }}>
                        {sentBy}
                      </TableCell>
                      
                      <TableCell sx={{ padding: '6px 8px', fontSize: 13, background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>
                        {formatEpochTime(notification.createdTime)}
                      </TableCell>

                      

                      <TableCell sx={{ padding: '4px 6px', background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Tooltip title={notification.status === 'READ' ? "Already Read" : "Mark as Read"}>
                            <span>
                              <IconButton
                                size="small"
                                sx={{ padding: '4px' }}
                                disabled={notification.status === 'READ'}
                                onClick={() => handleMarkAsRead(notification)}
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              sx={{ padding: '4px' }}
                              onClick={() => handleDelete(notification)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {hasLink && (
                            <Tooltip title={notification.additionalConfig.actionButtonConfig.text || "Open Link"}>
                              <IconButton
                                size="small"
                                sx={{ padding: '4px' }}
                                onClick={(e) => handleLinkRedirect(notification, e)}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          rowsPerPageOptions={[10, 20, 30]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Rows per page:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
          }
        />
      </Card>
    </Box>
  );

  const renderRecipientsTab = () => (
    <Box>
      <Box sx={{ display: 'flex', my: 2 }}>
        <Button
          variant="outlined"
          onClick={() => {
            setEditingGroup(null);
            setCreateGroupOpen(true);
          }}
          sx={{
            borderColor: "#F47804",
            color: "#F47804",
            fontWeight: 500,
            "&:hover": {
              borderColor: "#d86602",
              backgroundColor: "rgba(244, 120, 4, 0.04)",
            },
          }}
        >
          Create New Group
        </Button>
      </Box>

      <Card className="card_sec">
        <div className="example-container-1">
          <Table stickyHeader aria-label="recipients table">
            <TableHead>
              <TableRow>
                <TableCell>Group Name</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Visibility</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" style={{ background: '#f8f8f8' }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : displayedRecipientGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" style={{ background: '#f8f8f8' }}>
                    No recipient groups found
                  </TableCell>
                </TableRow>
              ) : (
                displayedRecipientGroups.map((group, index) => {
                  const userEmails = getUserEmailsForGroup(group);

                  let visibility = "-";
                  let createdBy = "-";
                  try {
                    const desc = group.configuration?.description;
                    if (typeof desc === "string") {
                      const parsed = JSON.parse(desc);
                      visibility = parsed?.isPublic ? "Public" : "Private";
                      createdBy = parsed?.createdByEmail || "-";
                    }
                  } catch (e) {
                    console.warn("Invalid description JSON for group:", group.name, e);
                  }

                  const rowBg = index % 2 === 0 ? '#efefef' : '#f8f8f8';
 const loggedInEmail = localStorage.getItem('email')?.trim()?.toLowerCase();
                  return (
                    <TableRow key={group.id.id} hover>
                      <TableCell style={{ background: rowBg, padding: '12px 8px' }}>
                        <Typography sx={{ fontSize: 14 }}>
                          {group.name}
                        </Typography>
                      </TableCell>

                      <TableCell style={{ background: rowBg, padding: '12px 8px' }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                          {userEmails.slice(0, 3).map((email, idx) => (
                            <Chip
                              key={idx}
                              label={email}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontSize: '13px',
                                height: 22,
                              }}
                            />
                          ))}
                          {userEmails.length > 3 && (
                            <Chip
                              label={`+${userEmails.length - 3} more`}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontSize: '1px',
                                height: 22,
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      <TableCell style={{ background: rowBg, padding: '12px 8px' }}>
                        <Typography sx={{ fontSize: 14 }}>
                          {visibility}
                        </Typography>
                      </TableCell>

                      <TableCell style={{ background: rowBg, padding: '12px 8px' }}>
                        <Typography sx={{ fontSize: 14 }}>
                          {createdBy === loggedInEmail ? 'You' : createdBy}
                        </Typography>
                      </TableCell>

                      <TableCell style={{ background: rowBg, padding: '12px 6px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <Tooltip title="Edit Group">
                            <IconButton
                              size="small"
                              sx={{ padding: '4px' }}
                              onClick={() => handleEditGroup(group)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Group">
                            <IconButton
                              size="small"
                              sx={{ padding: '4px' }}
                              onClick={() => handleDeleteGroup(group)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          rowsPerPageOptions={[10, 20, 30]}
          component="div"
          count={recipientTotalCount}
          rowsPerPage={recipientRowsPerPage}
          page={recipientPage}
          onPageChange={handleRecipientPageChange}
          onRowsPerPageChange={handleRecipientRowsPerPageChange}
          labelRowsPerPage="Rows per page:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
          }
        />
      </Card>
    </Box>
  );

  return (
    <div className="pages">
      <div className="pagecontents">
        <div className="left-labels-1">
          <div className="shift-content-2">
            <h5>Notifications</h5>
            <SendNotificationPopup />
          </div>
        </div>

        <Tabs
          value={selectedTab}
          onChange={(e, v) => tabChange(v)}
          textColor="inherit"
          TabIndicatorProps={{
            sx: {
              backgroundColor: '#f47803',
            },
          }}
        >
          <Tab label="Inbox" value="inbox" />
          <Tab label="Recipients" value="recipients" />
        </Tabs>

        {selectedTab === "inbox" && renderInboxTab()}
        {selectedTab === "recipients" && renderRecipientsTab()}

        <CreateGroupDialog
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          onGroupCreated={() => {
            fetchRecipientGroups();
            setCreateGroupOpen(false);
          }}
          onGroupUpdated={() => {
            fetchRecipientGroups();
            setCreateGroupOpen(false);
          }}
          editingGroup={editingGroup}
          availableUsers={availableUsers}
        />
      </div>
    </div>
  );
};

export default NotificationCenter;