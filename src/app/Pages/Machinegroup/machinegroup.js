import { useState, useEffect } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import './machinegroup.css';
import MachineGroupAdd from './machinegroupadd';
import { customerbasedshift, getCustomerUsers } from '../../Services/app/operatorservice';
import MachineGroupEdit from './machinegroupedit';
import { shiftadd } from '../../Services/app/masterservice';
import Swal from 'sweetalert2';

const MachineGroup = () => {
  const [machineGroups, setMachineGroups] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [dialogOpenCount, setDialogOpenCount] = useState(0);
  const customerId = localStorage.getItem('CustomerID');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editDialogData, setEditDialogData] = useState(null);

  const handleCloseAddDialog = (event, reason) => {
    if (reason && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }
    setIsAddDialogOpen(false);
    setDialogOpenCount(prevCount => Math.max(0, prevCount - 1));
    fetchMachineGroups();
  };

  const handleCloseEditDialog = (event, reason) => {
    if (reason && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }
    setIsEditDialogOpen(false);
    setEditDialogData(null);
    setDialogOpenCount(prevCount => Math.max(0, prevCount - 1));
    fetchMachineGroups();
  };

  useEffect(() => {
    fetchMachineGroups();
  }, []);

  const getUsersList = async () => {
    try {
      const res = await getCustomerUsers(customerId);
      const usersList = res.data || [];
      const parsedUsers = usersList.map(user => {
        let parsedDescription = '';
        try { parsedDescription = user.additionalInfo?.description ? JSON.parse(user.additionalInfo.description) : ''; }
        catch { parsedDescription = user.additionalInfo?.description || ''; }
        return { ...user, userDetails: parsedDescription };
      });
      return parsedUsers;
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMachineGroups = async () => {
    const key = 'machinegroups';
    customerbasedshift(customerId, key)
      .then(async (data) => {
        const allMachineGroups = data[0]?.value || [];
        setMachineGroups(allMachineGroups);
      })
      .catch(error => {
        console.error("Error fetching machine groups:", error);
        setMachineGroups([]);
      });
  };

  const handleOpenAddDialog = () => {
    console.log('Add Machine Group clicked');
    setIsAddDialogOpen(true);
    setDialogOpenCount(prevCount => prevCount + 1);
  };

  const handleOpenEditDialog = (group) => {
    console.log('Edit Machine Group:', group);
    setEditDialogData(group);
    setIsEditDialogOpen(true);
    setDialogOpenCount(prevCount => prevCount + 1);
  };

const handleDeleteMachineGroup = async (group) => {
  try {
    const users = await getUsersList();
    const usersInGroup = users.filter(user => {
      const userGroups = user.userDetails?.groups || [];
      return userGroups.includes(group.code);
    });
    if (usersInGroup.length > 0) {
      const userListHTML = usersInGroup
        .map(user => {
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
          const displayName = fullName || user.email || 'Unnamed User';
          return `
            <li style="margin-bottom: 4px; line-height: 1.4;">
              <strong style="color: #222;">${displayName}</strong>
              ${user.email && fullName
                ? `<span style="color: #666;"> &nbsp;|&nbsp; ${user.email}</span>`
                : ''}
            </li>`;
        })
        .join('');
      await Swal.fire({
        icon: 'warning',
        title: `<span style="font-weight:600;">Cannot Delete “${group.name}”</span>`,
        html: `
          <div style="text-align:left; font-size:14px; line-height:1.6;">
            <p>The machine group <strong>“${group.name}”</strong> cannot be deleted because it currently has <strong>${usersInGroup.length}</strong> user${usersInGroup.length > 1 ? 's' : ''} assigned:</p>
            <ul style="margin:10px 0 12px 22px; padding:0; list-style-type:disc;">${userListHTML}</ul>
            <p style="margin:0;">Please reassign or remove these users before attempting to delete this group.</p>
          </div>
        `,
        confirmButtonText: 'Understood',
        confirmButtonColor: '#f47804',
        width: 500,
        customClass: {
          popup: 'swal2-rounded swal2-shadow',
          title: 'swal2-title-custom',
        },
      });
      return;
    }
    const confirm = await Swal.fire({
      title: `<span style="font-weight:600;">Delete “${group.name}”?</span>`,
      html: `
        <div style="text-align:left; font-size:14px; line-height:1.6;">
          <p>You are about to permanently delete the machine group <strong>“${group.name}”</strong>.</p>
          <p style="color:#666;">This action cannot be undone.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#a1a1a1',
      reverseButtons: true,
      focusCancel: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      width: 460,
    });

    if (!confirm.isConfirmed) return;
    const key = 'machinegroups';
    const currentDataResponse = await customerbasedshift(customerId, key);
    const allGroups = currentDataResponse[0]?.value || [];
    const updatedGroups = allGroups.filter(existing => {
      const existingId = existing.id?.$oid || existing.id;
      const targetId = group.id?.$oid || group.id;
      return existingId !== targetId;
    });

    const formData = {
      machinegroups: updatedGroups,
      lastUpdateTs: Date.now(),
    };

    const scope = 'SERVER_SCOPE';
    const response = await shiftadd(formData, customerId, scope);
    Swal.fire({
      icon: 'success',
      title: `<span style="font-weight:600;">“${group.name}” Deleted</span>`,
      text: response?.msg || `The machine group “${group.name}” has been removed successfully.`,
      timer: 1600,
      showConfirmButton: false,
      customClass: {
        popup: 'swal2-rounded swal2-shadow',
      },
    });
    fetchMachineGroups();
  } catch (error) {
    console.error('Error deleting Machine Group:', error);
    Swal.fire({
      icon: 'error',
      title: '<span style="font-weight:600;">Deletion Failed</span>',
      text: error.message || 'An unexpected error occurred while deleting the machine group.',
      confirmButtonColor: '#d33',
      width: 440,
    });
  }
};

  return (
    <div className="pages">
      <div className="pagecontents">
        <div className="left-labels">
          <div className="shift-content-1">
            <h5>Machine Group List</h5>
            <div className="add_new">
              <Tooltip title="Add Machine Group">
                <IconButton className="circle" onClick={handleOpenAddDialog}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="idle_reason_list">
          {Array.isArray(machineGroups) && machineGroups.length > 0 ? (
            machineGroups
              .slice()
              .sort((a, b) => Number(a.code) - Number(b.code))
              .map((group, idx) => {
                const itemId = group.id || idx;
                return (
                  <div
                    className="idle_reason_item"
                    key={itemId}
                    data-id={group.code}
                  >
                    <div className="icons">
                      <span className="icon-text">{group.code}</span>
                    </div>
                    <h3 className="reason-text">{group.name}</h3>
                    <div className="user_action">
                      <ul>
                        <li>
                          <Tooltip title="Edit Machine Group">
                            <IconButton
                              onClick={() => handleOpenEditDialog(group)}
                            >
                              <EditIcon sx={{ color: 'black' }} />
                            </IconButton>
                          </Tooltip>
                        </li>
                        <li>
                          <Tooltip title="Delete Machine Group">
                            <IconButton
                              onClick={() => handleDeleteMachineGroup(group)}
                            >
                              <DeleteIcon sx={{ color: 'black' }} />
                            </IconButton>
                          </Tooltip>
                        </li>
                      </ul>
                    </div>
                  </div>
                );
              })
          ) : (
            <div style={{ margin: '2rem', color: '#888' }}>
              No machine groups found.
            </div>
          )}
        </div>
      </div>
      <MachineGroupAdd
        open={isAddDialogOpen}
        handleClose={handleCloseAddDialog}
        handleAdd={handleCloseAddDialog}
        dialogOpenCount={dialogOpenCount}
        datasource={machineGroups}
        customerId={customerId}
        setDatasource={setMachineGroups}
      />

      {isEditDialogOpen && editDialogData && (
        <MachineGroupEdit
          open={isEditDialogOpen}
          handleClose={handleCloseEditDialog}
          handleAdd={handleCloseEditDialog}
          dialogData={editDialogData}
          dialogOpenCount={dialogOpenCount}
          datasource={machineGroups}
          customerId={customerId}
          setDatasource={setMachineGroups}
        />
      )}
    </div>
  );
};

export default MachineGroup;
