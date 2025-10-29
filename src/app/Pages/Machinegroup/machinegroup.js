import { useState, useEffect } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import './machinegroup.css';
import MachineGroupAdd from './machinegroupadd';
import { customerbasedshift } from '../../Services/app/operatorservice';
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

  const handleDeleteMachineGroup = (row) => {
    Swal.fire({
      title: 'Are you sure you want to delete this Machine Group?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const key = 'machinegroups';
          const currentDataResponse = await customerbasedshift(customerId, key);
          const allMachineGroups = currentDataResponse[0]?.value || [];
          const updatedMachineGroups = allMachineGroups.filter((group) => {
            if (
              typeof group.id === 'object' &&
              group.id?.$oid &&
              typeof row.id === 'object' &&
              row.id?.$oid
            ) {
              return group.id.$oid !== row.id.$oid;
            }
            return group.id !== row.id;
          });
          const formData = {
            machinegroups: updatedMachineGroups,
            lastUpdateTs: Date.now(),
          };
          const scope = 'SERVER_SCOPE';
          const response = await shiftadd(formData, customerId, scope);
          if (response?.msg) {
            Swal.fire('Deleted!', response.msg, 'success');
          } else {
            Swal.fire({
              icon: "success",
              title: "Deleted!",
              text: "Machine Group deleted successfully.",
              timer: 1500,
              showConfirmButton: false,
            });
          }
          fetchMachineGroups();
        } catch (error) {
          console.error('Error deleting Machine Group:', error);
          Swal.fire('Error!', 'Failed to delete Machine Group: ' + error.message, 'error');
        }
      } else {
        Swal.fire('Cancelled', '', 'info');
      }
    });
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
        setDatasource={setDatasource}
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
          setDatasource={setDatasource}
        />
      )}
    </div>
  );
};

export default MachineGroup;
