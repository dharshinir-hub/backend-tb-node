import { Card, Checkbox, Chip, Menu, MenuItem, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs,IconButton, Tooltip,Button, TablePagination } from "@mui/material";
import { useEffect, useState } from "react";
import { deleteNotification, getNotifications, markAllAsRead, markAsRead } from "../../Services/app/notificationservice";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MarkAsReadIcon from '@mui/icons-material/MarkEmailRead';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import Swal from 'sweetalert2';

const NotificationCenter = () => {
  const [selectedTab, setSelectedTab] = useState("unread");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const formatEpochTime = (epochTime) => {
    if (!epochTime) return '-';
    const date = new Date(epochTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const fetchNotifications = async (pageNum = page, size = rowsPerPage, tab = selectedTab) => {
    setLoading(true);
    try {
      const unreadOnly = tab === "unread";
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

  const tabChange = (currentTab) => {
    setSelectedTab(currentTab);
    setPage(0);
    setSelectedNotifications([]);
    fetchNotifications(0, rowsPerPage, currentTab);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    fetchNotifications(newPage, rowsPerPage, selectedTab);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    fetchNotifications(0, newRowsPerPage, selectedTab);
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
      fetchNotifications(page, rowsPerPage, selectedTab);
    } catch(err) {
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
        fetchNotifications(page, rowsPerPage, selectedTab);
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
        fetchNotifications(page, rowsPerPage, selectedTab);
      } catch(err) {
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
        fetchNotifications(page, rowsPerPage, selectedTab);
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

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="pages">
      <div className="pagecontents">
        <div className="left-labels">
          <div className="shift-content">
            <h5>Notifications</h5>
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
          <Tab label="Unread" value="unread" />
          <Tab label="All" value="all" />
        </Tabs>

        <Card className="card_sec" style={{marginTop: '1rem'}}>

            {notifications.length > 0 && (
     <div style={{ 
            padding: '12px 16px', 
            borderBottom: '1px solid #e0e0e0',
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f5f5f5'
          }}>
            {notifications.length > 0 && (
                     <Button
                  size="small"
                  startIcon={<CheckIcon />}
                  onClick={handleMarkAllAsRead}
                  variant="contained" className="filter_btn btn_orange" color="warning"
                >
                  Mark All as Read
                </Button>
               
            )}

            {selectedNotifications.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                  {selectedNotifications.length} selected
                </span>
                <Tooltip title="Delete Selected">
                  <IconButton 
                    size="small" 
                    onClick={handleBulkDelete}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </div>
            )}
          </div>
            ) }
     

          <div className="example-container">
            <Table stickyHeader aria-label="sticky table">
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
                    />
                  </TableCell>
                  <TableCell>Created time</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" style={{ background: '#f8f8f8' }}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : notifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" style={{ background: '#f8f8f8' }}>
                      No notifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((notification, index) => (
                    <TableRow 
                      key={notification.id.id}
                      hover
                      selected={selectedNotifications.includes(notification.id.id)}
                    >
                      <TableCell padding="checkbox" style={{ background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>
                        <Checkbox
                          checked={selectedNotifications.includes(notification.id.id)}
                          onChange={() => handleSelectNotification(notification.id.id)}
                        />
                      </TableCell>
                      <TableCell style={{ background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>
                        {formatEpochTime(notification.createdTime)}
                      </TableCell>
                      <TableCell style={{ background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>{notification.subject}</TableCell>
                      <TableCell style={{ background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>{notification.text}</TableCell>
                      <TableCell style={{ background: index % 2 === 0 ? '#efefef' : '#f8f8f8' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Tooltip title="Mark as Read">
                            <IconButton
                              size="small"
                              disabled={notification.status === 'READ'}
                              onClick={() => handleMarkAsRead(notification)}
                            >
                              <CheckIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(notification)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
      </div>
    </div>
  );
};

export default NotificationCenter;