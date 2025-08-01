import { useState, useEffect } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import '../../Pages/Reasonregistration/reasonreg.css';
import { customerbasedshift, shiftadd } from '../../Services/app/masterservice';
import Swal from 'sweetalert2';
import ReasonAdd from './reasonadd';
import ReasonEdit from './reasonedit';

const ReasonRegistration = () => {
    // Dialog state
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null);
    const [dialogOpenCount, setDialogOpenCount] = useState(0);

    // Data source for reasons
    const [datasource, setDatasource] = useState([]);
    const customerId = localStorage.getItem('CustomerID');

    // Open/close handlers for Add dialog
    const handleOpenAddDialog = () => {
        setIsAddDialogOpen(true);
        setDialogOpenCount(prevCount => prevCount + 1);
    };
    const handleCloseAddDialog = (event, reason) => {
        if (reason && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
            return;
        }
        setIsAddDialogOpen(false);
        setDialogOpenCount(prevCount => Math.max(0, prevCount - 1)); // Ensure count doesn't go below 0
        getShifts(); // Refresh data after add/close
    };
    const handleOpenEditDialog = (rowData) => {
        setEditDialogData(rowData); // Set the data for the specific row being edited
        setIsEditDialogOpen(true);
        setDialogOpenCount(prevCount => prevCount + 1);
    };
    // Open/close handlers for Edit dialog
    const handleCloseEditDialog = (event, reason) => {
        if (reason && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
            return;
        }
        setIsEditDialogOpen(false);
        setEditDialogData(null); // Clear the data when dialog closes
        setDialogOpenCount(prevCount => Math.max(0, prevCount - 1)); // Ensure count doesn't go below 0
        getShifts(); // Refresh data after edit/close
    };
  

    // Delete reason handler
    const deleteshift = (row) => {
        Swal.fire({
            title: 'Are you sure you want to delete this record?',
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
                    // Fetch the current list of reasons from the backend
                    const key = 'reason';
                    const currentDataResponse = await customerbasedshift(customerId, key);
                    const allReasons = currentDataResponse[0]?.value || [];

                    // Filter out the reason to be deleted based on its ID
                    const updatedReasons = allReasons.filter(reason => {
                        // Handle both string and object id
                        if (typeof reason.id === 'object' && reason.id?.$oid && typeof row.id === 'object' && row.id?.$oid) {
                            return reason.id.$oid !== row.id.$oid;
                        }
                        return reason.id !== row.id;
                    });

                    // Prepare the payload to send back to the API
                    const formData = {
                        reason: updatedReasons,
                        lastUpdateTs: Date.now()
                    };

                    const scope = 'SERVER_SCOPE';

                    // Call the API to update the reasons (effectively deleting the selected one)
                    const response = await shiftadd(formData, customerId, scope);

                    if (response.msg) {
                        Swal.fire('Deleted!', response.msg, 'success');
                    } else {
                        Swal.fire('Deleted!', 'Your reason has been deleted successfully.', 'success');
                    }
                    getShifts();
                } catch (error) {
                    console.error('Error deleting reason:', error);
                    Swal.fire('Error!', 'Failed to delete the reason: ' + error.message, 'error');
                }
            } else {
                Swal.fire('Cancelled');
            }
        });
    };

    // Fetch reasons from backend
    const getShifts = async () => {
        const key = 'reason';
        customerbasedshift(customerId, key)
            .then(async (data) => {
                const allReasons = data[0]?.value || [];
                setDatasource(allReasons);
            })
            .catch(error => {
                console.error("Error fetching reasons:", error);
                setDatasource([]);
            });
    };

    useEffect(() => {
        getShifts();
    }, []);

    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="left-labels">
                    <div className="shift-content">
                        <h5>Reason Registration</h5>
                        <div className="add_new">
                            <Tooltip title="Add Reason">
                                <IconButton className="circle" onClick={handleOpenAddDialog}>
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Dynamically render each reason as a card-like item */}
                <div className="idle_reason_list">
                    {Array.isArray(datasource) && datasource.length > 0 ? (
                        datasource
                            .slice() // Create a shallow copy to avoid mutating state
                            .sort((a, b) => {
                                // Ensure codes are treated as numbers for correct sorting
                                const codeA = Number(a.code);
                                const codeB = Number(b.code);
                                return codeA - codeB;
                            })
                            .map((item, idx) => {
                                const itemId = typeof item.id === 'object' && item.id?.$oid ? item.id.$oid : item.id || idx;
                                return (
                                    <div
                                        className="idle_reason_item"
                                        key={itemId}
                                        data-id={item.code}
                                    >
                                        <div className="icons">
                                            <span className="icon-text">{item.code}</span>
                                        </div>
                                        <h3 className="reason-text">{item.reason}</h3>
                                        <div className="user_action">
                                            <ul>
                                                <li>
                                                    <Tooltip title="Edit Reason">
                                                        <IconButton onClick={() => handleOpenEditDialog(item)}>
                                                            <EditIcon sx={{ color: '#454545' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </li>
                                                <li>
                                                    <Tooltip title="Delete Reason">
                                                        <IconButton onClick={() => deleteshift(item)}>
                                                            <DeleteIcon sx={{ color: '#454545' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })
                    ) : (
                        <div style={{ margin: '2rem', color: '#888' }}>No reasons found.</div>
                    )}
                </div>
            </div>

            {/* Add Dialog */}
            <ReasonAdd
                open={isAddDialogOpen}
                handleClose={handleCloseAddDialog}
                handleAdd={handleCloseAddDialog}
                dialogOpenCount={dialogOpenCount}
                datasource={datasource}
                customerId={customerId}
                setDatasource={setDatasource}
            />

            {/* Edit Dialog */}
            {isEditDialogOpen && editDialogData && (
                <ReasonEdit
                    open={isEditDialogOpen}
                    handleClose={handleCloseEditDialog}
                    handleAdd={handleCloseEditDialog}
                    dialogData={editDialogData}
                    dialogOpenCount={dialogOpenCount}
                    datasource={datasource}
                    customerId={customerId}
                    setDatasource={setDatasource}
                />
            )}
        </div>
    );
};

export default ReasonRegistration;
