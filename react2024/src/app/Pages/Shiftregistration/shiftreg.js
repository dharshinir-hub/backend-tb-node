import { useState } from 'react';
import { Tooltip, IconButton, Dialog, DialogActions, DialogTitle, DialogContent, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShiftAdd from './shiftadd';
import { Card, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import classNames from 'classnames';
import DeleteIcon from '@mui/icons-material/Delete';
import { useEffect } from 'react';
import './shiftreg.css';
import { customerbasedshift } from '../../Services/app/masterservice';
import EditIcon from '@mui/icons-material/Edit';
import ShiftEdit from './shiftedit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Swal from 'sweetalert2'; // Ensure Swal is imported
import { shiftadd } from '../../Services/app/masterservice'; // Ensure shiftadd is imported
import CloseIcon from '@mui/icons-material/Close';

const ShiftRegistration = () => {
    // Separate state for Add and Edit dialogs
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null); // To store data for the edit dialog
    const [openBreaksPopup, setOpenBreaksPopup] = useState(false);
    const [selectedShiftBreaks, setSelectedShiftBreaks] = useState([]);
    const [reasonData, setReasonData] = useState([]);

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
                    const key = 'allShift';
                    const currentDataResponse = await customerbasedshift(customerId, key);
                    const allShifts = currentDataResponse[0]?.value || [];

                    // Filter out the shift to be deleted based on its ID
                    const updatedShifts = allShifts.filter(shift => shift.id !== row.id);
                    const breakdetails = updatedShifts.flatMap(shift =>
                        Array.isArray(shift.break_details)
                            ? shift.break_details.map(brk => ({
                                id: brk.id || Math.random().toString(36).substr(2, 9),
                                start_time: brk.start_time,
                                end_time: brk.end_time,
                                break_time: brk.duration || brk.break_time || "00:00:00",
                                shift_no: shift.shift_no,
                                start_day: shift.start_day,
                                end_day: shift.end_day,
                                module: shift.module
                            }))
                            : []
                    );
                    // Prepare the payload to send back to the API
                    // This structure aligns with how shifts are added/updated
                    const formData = {
                        allShift: updatedShifts,
                        breakdetails: breakdetails,
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
        try {
            const [shiftRes, reasonRes] = await Promise.all([
                customerbasedshift(customerId, 'allShift'),
                customerbasedshift(customerId, 'reason'),
            ]);

            const allShifts = shiftRes[0]?.value || [];
            const reasons = reasonRes[0]?.value || [];

            console.log('Shifts:', allShifts);
            console.log('Reasons:', reasons);

            setDatasource(allShifts);
            setReasonData(reasons);
        } catch (error) {
            console.error('Error fetching shifts or reasons:', error);
            setDatasource([]);
            setReasonData([]);
        }
    };


    const getTotalShiftHours = (start, end, totalBreakTime) => {
        console.log(start, end, totalBreakTime, 'timings')
        const parseTime = (str) => {
            if (!str) str = "00:00:00";
            const [h, m, s] = str?.split(':').map(Number);
            return h * 3600 + m * 60 + s;
        };

        const startSec = parseTime(start);
        const endSec = parseTime(end);
        const breakSec = parseTime(totalBreakTime);

        let totalSec = endSec - startSec - breakSec;
        if (totalSec < 0) totalSec += 24 * 3600;
        const hours = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSec % 60).padStart(2, '0');

        return `${hours}:${minutes}:${seconds}`;
    };


    useEffect(() => {
        getShifts();
    }, []);

    const handleViewBreaks = (shift) => {
        setSelectedShiftBreaks(shift.break_details || []);
        setOpenBreaksPopup(true);
    };


    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="left-labels">
                    <div className="shift-content">
                        <h5>Shift Transaction Registration</h5>
                        <div className="add_new">
                            <Tooltip title="Add Shift">
                                <IconButton className="circle" onClick={handleOpenAddDialog}> {/* Use new handler */}
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                            <ShiftAdd
                                reason={reasonData}
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
                                    <TableCell>Shift No</TableCell>
                                    <TableCell>Start Time</TableCell>
                                    <TableCell>End Time</TableCell>
                                    <TableCell>Break Time</TableCell>
                                    <TableCell>Total Hours</TableCell>
                                    <TableCell>Module</TableCell>
                                    <TableCell>Start Day</TableCell>
                                    <TableCell>End Day</TableCell>
                                    <TableCell>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Array.isArray(datasource) && datasource.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.shift_no || '---'}</TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{convertTimes(`1970-01-01T${row.start_time}`) || '---'}</TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{convertTimes(`1970-01-01T${row.end_time}`) || '---'}</TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            {row.break_time || '---'}
                                            {Array.isArray(row.break_details) && row.break_details.length > 0 && (
                                                <Tooltip title="View Breaks">
                                                    <IconButton size="small" onClick={() => handleViewBreaks(row)}>
                                                        <VisibilityIcon sx={{ fontSize: 18, marginLeft: 0.5 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>

                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            <TableCell>
                                                {getTotalShiftHours(row.start_time, row.end_time, row.break_time)}
                                            </TableCell>

                                        </TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.module || '---'}</TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            {row.start_day || '---'}
                                        </TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            {row.end_day || '---'}
                                        </TableCell>
                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                            <Tooltip title="Edit Shift">
                                                <IconButton onClick={() => handleOpenEditDialog(row)}> {/* Use new handler, pass row data */}
                                                    <EditIcon sx={{ color: 'black' }} />
                                                </IconButton>
                                            </Tooltip>
                                            {/* ShiftEdit component is now rendered conditionally outside the map loop */}
                                            <Tooltip title="Delete Shift">
                                                <IconButton onClick={() => deleteshift(row, datasource)}>
                                                    <DeleteIcon sx={{ color: 'black' }} />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Break Details Dialog */}
                        <Dialog
                            open={openBreaksPopup}
                            onClose={() => setOpenBreaksPopup(false)}
                            maxWidth="sm"
                            fullWidth
                            PaperProps={{ style: { backgroundColor: '#ede7e7' } }}
                        >
                            {/* HEADER WITH CLOSE ICON */}
                            <DialogTitle
                                sx={{
                                    m: 0,
                                    p: 2,
                                    fontWeight: 600,
                                    backgroundColor: '#eeebeb',
                                }}
                            >
                                Break Details

                                <IconButton
                                    aria-label="close"
                                    onClick={() => setOpenBreaksPopup(false)}
                                    sx={{
                                        position: 'absolute',
                                        right: 8,
                                        top: 8,
                                        color: '#777',
                                        '&:hover': {
                                            backgroundColor: '#f2f2f2',
                                        },
                                    }}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </DialogTitle>

                            {/* TABLE CONTENT WITH 4-SIDE PADDING */}
                            <DialogContent
                                sx={{
                                    p: 2, // ✅ padding on all four sides
                                    backgroundColor: '#eeebeb',
                                }}
                            >
                                <Table
                                    size="small"
                                    sx={{
                                        borderCollapse: "collapse",
                                        width: "100%",
                                        backgroundColor: "#ffffff",
                                    }}
                                >
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: "#e5e5e5" }}>
                                            {["Start Time", "End Time", "Duration", "Reason"].map((head) => (
                                                <TableCell
                                                    key={head}
                                                    align="center"
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: "15px",
                                                        color: "#000",
                                                        borderBottom: "2px solid #cfcfcf",
                                                        padding: "14px 16px",
                                                    }}
                                                >
                                                    {head}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {selectedShiftBreaks.map((brk, idx) => (
                                            <TableRow
                                                key={idx}
                                                sx={{
                                                    backgroundColor: idx % 2 === 0 ? "#f2f2f2" : "#eaeaea",
                                                }}
                                            >
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        padding: "16px",
                                                        fontSize: "14px",
                                                        borderBottom: "1px solid #d6d6d6",
                                                    }}
                                                >
                                                    {convertTimes(`1970-01-01T${brk.start_time}`)}
                                                </TableCell>

                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        padding: "16px",
                                                        fontSize: "14px",
                                                        borderBottom: "1px solid #d6d6d6",
                                                    }}
                                                >
                                                    {convertTimes(`1970-01-01T${brk.end_time}`)}
                                                </TableCell>

                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        padding: "16px",
                                                        fontSize: "14px",
                                                        borderBottom: "1px solid #d6d6d6",
                                                    }}
                                                >
                                                    {brk.duration || brk.break_time}
                                                </TableCell>

                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        padding: "16px",
                                                        fontSize: "14px",
                                                        borderBottom: "1px solid #d6d6d6",
                                                    }}
                                                >
                                                    {brk.reason || "---"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </DialogContent>
                        </Dialog>


                    </div>
                </Card>
            </div>
            {/* Render ShiftEdit conditionally outside the table loop */}
            {isEditDialogOpen && (
                <ShiftEdit
                    reason={reasonData}
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

export default ShiftRegistration;