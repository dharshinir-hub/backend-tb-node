import { useState } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Card, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import classNames from 'classnames';
import DeleteIcon from '@mui/icons-material/Delete';
import { useEffect } from 'react';
import '../../Pages/Operatorregistration/operatorreg.css';
import { customerbasedshift } from '../../Services/app/masterservice';
import EditIcon from '@mui/icons-material/Edit';
import Swal from 'sweetalert2'; // Ensure Swal is imported
import {shiftadd } from '../../Services/app/masterservice'; // Ensure shiftadd is imported
import OperatorAdd from './operatoradd';
import OperatorEdit from './operatoredit';
const OperatorRegistration = () => {
    // Separate state for Add and Edit dialogs
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null); // To store data for the edit dialog

    // dialogOpenCount is used for background color in dialogs, tracks total open dialogs
    const [dialogOpenCount, setDialogOpenCount] = useState(0);
    const [datasource, setDatasource] = useState([]);
    const customerId = localStorage.getItem('CustomerID');

    // Handlers for Add Shift dialog
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

    // Handlers for Edit Shift dialog
    const handleOpenEditDialog = (rowData) => {
        setEditDialogData(rowData); // Set the data for the specific row being edited
        setIsEditDialogOpen(true);
        setDialogOpenCount(prevCount => prevCount + 1);
    };

    const handleCloseEditDialog = (event, reason) => {
        if (reason && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
            return;
        }
        setIsEditDialogOpen(false);
        setEditDialogData(null); // Clear the data when dialog closes
        setDialogOpenCount(prevCount => Math.max(0, prevCount - 1)); // Ensure count doesn't go below 0
        getShifts(); // Refresh data after edit/close
    };

   
    const deleteshift = (row) => {
        console.log("Attempting to delete row:", row);

        Swal.fire({
            title: 'Are you sure you want to delete this record?',
            // text: "You won't be able to revert this!",
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
                    // Fetch the current list of shifts from the backend
                    const key = 'alloperator';
                    const currentDataResponse = await customerbasedshift(customerId, key);
                    const allShifts = currentDataResponse[0]?.value || [];

                    // Filter out the shift to be deleted based on its ID
                    const updatedShifts = allShifts.filter(shift => shift.id !== row.id);

                    // Prepare the payload to send back to the API
                    // This structure aligns with how shifts are added/updated
                    const formData = {
                        alloperator: updatedShifts,
                        lastUpdateTs: Date.now() // Update timestamp
                    };

                    const scope = 'SERVER_SCOPE'; // As seen in shiftadd.js context

                    // Call the API to update the shifts (effectively deleting the selected one)
                    const response = await shiftadd(formData, customerId, scope);

                    if (response.msg) {
                        Swal.fire('Deleted!', response.msg, 'success');
                    } else {
                        Swal.fire('Deleted!', 'Your shift has been deleted successfully.', 'success');
                    }
                    getShifts(); // Refresh the data in the table after deletion
                } catch (error) {
                    console.error('Error deleting shift:', error);
                    Swal.fire('Error!', 'Failed to delete the shift: ' + error.message, 'error');
                }
            } else {
                // User clicked "No" or outside the popup
                Swal.fire('Cancelled');
            }
        });
    };

    const convertTimes = (time) => {
        const date = new Date(time);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const getShifts = async () => {
        const key = 'alloperator';
        customerbasedshift(customerId, key)
            .then(async (data) => {
                const allShifts = data[0]?.value || [];
                console.log(allShifts);
                setDatasource(allShifts);
            })
            .catch(error => {
                console.error("Error fetching shifts:", error);
                setDatasource([]); // Set to empty array on error
            });
    };

    const getTotalShiftHours = (start, end, breakTime) => {
        const parseTime = (str) => {
            const [h, m, s] = str.split(':').map(Number);
            return h * 3600 + m * 60 + s;
        };

        const startSec = parseTime(start);
        const endSec = parseTime(end);
        const breakSec = parseTime(breakTime);

        let totalSec = endSec - startSec - breakSec;

        // Handle overnight shifts (e.g., 22:00 to 06:00)
        if (totalSec < 0) {
            totalSec += 24 * 3600;
        }

        const hours = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSec % 60).padStart(2, '0');

        return `${hours}:${minutes}:${seconds}`;
    };


    useEffect(() => {
        getShifts();
    },[]);

    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="left-labels">
                    <div className="shift-content">
                        <h5>User Registration</h5>
                        <div className="add_new">
                            <Tooltip title="Add Operator">
                                <IconButton className="circle" onClick={handleOpenAddDialog}> {/* Use new handler */}
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                            <OperatorAdd
                                open={isAddDialogOpen} // Use specific state for add dialog
                                handleClose={handleCloseAddDialog} // Use specific close handler
                                handleAdd={handleCloseAddDialog} // Call close handler on successful add
                                dialogOpenCount={dialogOpenCount}
                                datasource={datasource}
                                customerId={customerId}
                                setDatasource={setDatasource}
                                // dialogData is intentionally omitted for ShiftAdd to ensure it's empty
                            />
                        </div>
                    </div>
                </div>

                <Card className="card_sec">
                    <div className="example-container">
                        <Table stickyHeader aria-label="sticky table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>User Name</TableCell>                                   
                                    <TableCell>User ID</TableCell>                                   
                                    <TableCell>Role</TableCell>
                                    <TableCell>Experience Level</TableCell>
                                    <TableCell>Languages</TableCell>
                                    <TableCell>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Array.isArray(datasource) && datasource.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.operatorname || '---'}</TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.operatorid || '---'}</TableCell>                                        
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.mode || '---'}</TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            {row.experiencelevel || '---'}
                                        </TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            {row.language || '---'}
                                        </TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            <Tooltip title="Edit Operator">
                                                <IconButton onClick={() => handleOpenEditDialog(row)}> 
                                                    <EditIcon sx={{ color: '#454545' }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete Operator">
                                                <IconButton onClick={() => deleteshift(row,datasource)}>
                                                    <DeleteIcon sx={{ color: '#454545' }} />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
            {/* Render ShiftEdit conditionally outside the table loop */}
            {isEditDialogOpen && (
                <OperatorEdit
                    open={isEditDialogOpen} // Use specific state for edit dialog
                    handleClose={handleCloseEditDialog} // Use specific close handler
                    handleAdd={handleCloseEditDialog} // Call close handler on successful edit
                    dialogData={editDialogData} // Pass the stored row data
                    dialogOpenCount={dialogOpenCount}
                    datasource={datasource}
                    customerId={customerId}
                    setDatasource={setDatasource}
                />
            )}
        </div>
    );
};

export default OperatorRegistration;