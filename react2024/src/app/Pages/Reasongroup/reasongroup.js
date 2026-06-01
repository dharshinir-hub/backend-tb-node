import { useState, useEffect } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import '../../Pages/Reasonregistration/reasonreg.css';
import { customerbasedshift, shiftadd } from '../../Services/app/masterservice';
import Swal from 'sweetalert2';
import ReasonGroupAdd from './reasongroupadd';
import ReasonGroupEdit from './reasongroupedit';

const ReasonGroup = ({
  IsInGroupReg = false,
  groupKey = 'reasongroups',          // ✅ NEW
  reasonKey = 'reason',               // ✅ NEW
  title = 'Reason Group List',        // ✅ NEW
  addTooltip = 'Add Reason Group'     // ✅ NEW
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editDialogData, setEditDialogData] = useState(null);
  const [dialogOpenCount, setDialogOpenCount] = useState(0);
  const [datasource, setDatasource] = useState([]);
  const customerId = localStorage.getItem('CustomerID');

  const handleOpenAddDialog = () => {
    setIsAddDialogOpen(true);
    setDialogOpenCount(prev => prev + 1);
  };

  const handleCloseAddDialog = (event, reason) => {
    if (reason && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
    setIsAddDialogOpen(false);
    setDialogOpenCount(prev => Math.max(0, prev - 1));
    getReasonGroups();
  };

  const handleOpenEditDialog = (rowData) => {
    setEditDialogData(rowData);
    setIsEditDialogOpen(true);
    setDialogOpenCount(prev => prev + 1);
  };

  const handleCloseEditDialog = (event, reason) => {
    if (reason && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
    setIsEditDialogOpen(false);
    setEditDialogData(null);
    setDialogOpenCount(prev => Math.max(0, prev - 1));
    getReasonGroups();
  };

  // ✅ DELETE (fully dynamic now)
  const deleteReasonGroup = async (row) => {
    try {
      const [reasonsData, qualityData] = await Promise.all([
        customerbasedshift(customerId, 'reason'),
        customerbasedshift(customerId, 'qualityreason'),
      ]);
      const allReasons = [
        ...(reasonsData[0]?.value || []),
        ...(qualityData[0]?.value || []),
      ];

      const linkedReasons = allReasons.filter(
        (r) => r.group && r.group === row.groupName
      );

      if (linkedReasons.length > 0) {
        const reasonNames = linkedReasons.map((r) => r.reason).join(', ');
        Swal.fire({
          icon: 'warning',
          title: 'Cannot Delete Group',
          html: `
            <div style="text-align: left;">
              <p><strong>Group:</strong> ${row.groupName}</p>
              <p>This group is still used by the following reasons:</p>
              <div style="margin: 0.5rem 0">
                <p><strong>${reasonNames}</strong></p>
              </div>
              <p>Please move these reasons to another group before deleting this one.</p>
            </div>
          `,
          confirmButtonColor: '#f57c00',
          confirmButtonText: 'OK',
        });
        return;
      }

      Swal.fire({
        title: `Are you sure you want to delete "${row.groupName}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            const currentData = await customerbasedshift(customerId, groupKey);
            const allGroups = currentData[0]?.value || [];

            const updatedGroups = allGroups.filter(group => {
              if (typeof group.id === 'object' && group.id?.$oid && typeof row.id === 'object' && row.id?.$oid) {
                return group.id.$oid !== row.id.$oid;
              }
              return group.id !== row.id;
            });

            // ✅ CRITICAL FIX — dynamic key
            const formData = {
              [groupKey]: updatedGroups,
              lastUpdateTs: Date.now()
            };

            const scope = 'SERVER_SCOPE';
            const response = await shiftadd(formData, customerId, scope);

            if (response.msg) {
              Swal.fire('Deleted!', response.msg, 'success');
            } else {
              Swal.fire('Deleted!', 'Reason group deleted successfully.', 'success');
            }

            getReasonGroups();
          } catch (error) {
            console.error('Delete error:', error);
            Swal.fire('Error!', 'Failed to delete: ' + error.message, 'error');
          }
        }
      });
    } catch (error) {
      console.error('Error checking linked reasons:', error);
      Swal.fire('Error!', 'Could not verify linked reasons: ' + error.message, 'error');
    }
  };

  // ✅ FETCH dynamic
  const getReasonGroups = async () => {
    customerbasedshift(customerId, groupKey)
      .then((data) => {
        const groups = data[0]?.value || [];
        setDatasource(groups);
      })
      .catch(error => {
        console.error("Fetch error:", error);
        setDatasource([]);
      });
  };

  useEffect(() => {
    getReasonGroups();
  }, [groupKey]);

  return (
    <div className="pages" style={{ paddingBlockStart: IsInGroupReg ? '0px' : '40px' }}>
      <div className="pagecontents">
        <div className="left-labels" style={{
          padding: IsInGroupReg ? '0 2.3rem 1rem 0' : '1rem 2rem 1rem 0',
        }}>
          <div className="shift-content" style={{ gap: "0.5rem" }}>
            {IsInGroupReg ? (<h6>Create New</h6>) : (<h5>{title}</h5>)}

            <div className="add_new">
              <Tooltip title={addTooltip}>
                <IconButton className="circle" onClick={handleOpenAddDialog}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="idle_reason_list">
          {Array.isArray(datasource) && datasource.length > 0 ? (
            datasource
              .slice()
              .sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0))
              .map((item, idx) => {
                const itemId = typeof item.id === 'object' && item.id?.$oid ? item.id.$oid : item.id || idx;
                return (
                  <div className="idle_reason_item" key={itemId}>
                    <div className="icons">
                      <span className="icon-text">{idx + 1}</span>
                    </div>
                    <h3 className="reason-text">{item.groupName}</h3>
                    <div className="user_action">
                      <ul>
                        {/* <li>
                          <Tooltip title="Edit">
                            <IconButton onClick={() => handleOpenEditDialog(item)}>
                              <EditIcon sx={{ color: 'black' }} />
                            </IconButton>
                          </Tooltip>
                        </li> */}
                        <li>
                          <Tooltip title="Delete">
                            <IconButton onClick={() => deleteReasonGroup(item)}>
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
            <div style={{ margin: '2rem', color: '#888' }}>No reason groups found.</div>
          )}
        </div>
      </div>

      <ReasonGroupAdd
        open={isAddDialogOpen}
        handleClose={handleCloseAddDialog}
        handleAdd={handleCloseAddDialog}
        dialogOpenCount={dialogOpenCount}
        datasource={datasource}
        customerId={customerId}
        setDatasource={setDatasource}
        groupKey={groupKey}   // ✅ pass down
      />

      {isEditDialogOpen && editDialogData && (
        <ReasonGroupEdit
          open={isEditDialogOpen}
          handleClose={handleCloseEditDialog}
          handleAdd={handleCloseEditDialog}
          dialogData={editDialogData}
          dialogOpenCount={dialogOpenCount}
          datasource={datasource}
          customerId={customerId}
          setDatasource={setDatasource}
          groupKey={groupKey}  // ✅ pass down
        />
      )}
    </div>
  );
};

export default ReasonGroup;