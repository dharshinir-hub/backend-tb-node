import { useMemo, useState } from 'react';
import { Tooltip, IconButton, TextField, CardActions, TablePagination } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Card, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import classNames from 'classnames';
import DeleteIcon from '@mui/icons-material/Delete';
import { useEffect } from 'react';
import './componentreg.css';
import { customerbasedshift } from '../../Services/app/masterservice';
import EditIcon from '@mui/icons-material/Edit';
import Swal from 'sweetalert2'; // Ensure Swal is imported
import { shiftadd } from '../../Services/app/masterservice'; // Ensure shiftadd is imported
import ComponentEdit from '../Componentregistration/componentedit';
import ComponentAdd from '../Componentregistration/componentadd'
import { CUSTOMER_IDS } from '../../Shared/constants/ids';
import { cleanCustomerId } from '../../Services/app/operatorservice';
const ComponentRegistration = () => {
    // Separate state for Add and Edit dialogs
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null); // To store data for the edit dialog
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    // dialogOpenCount is used for background color in dialogs, tracks total open dialogs
    const [dialogOpenCount, setDialogOpenCount] = useState(0);
    const [datasource, setDatasource] = useState([]);
    const customerId = localStorage.getItem('CustomerID');
    const filteredDatasource = useMemo(() => {
        return datasource.filter(row =>
            row.component_name?.toLowerCase().includes(searchText.toLowerCase()) ||
            row?.component_number?.toLowerCase().includes(searchText.toLowerCase())
        );
    }, [datasource, searchText]);
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
        getComponents(); // Refresh data after add/close
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
        getComponents(); // Refresh data after edit/close
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
                    const key = 'component';
                    const currentDataResponse = await customerbasedshift(customerId, key);
                    const allShifts = currentDataResponse[0]?.value || [];

                    // Filter out the shift to be deleted based on its ID
                    const updatedShifts = allShifts.filter(shift => {
                        // Handle both string IDs and MongoDB ObjectId format
                        const shiftId = shift.id?.$oid || shift.id;
                        const rowId = row.id?.$oid || row.id;
                        return shiftId !== rowId;
                    });

                    // Prepare the payload to send back to the API
                    // This structure aligns with how shifts are added/updated
                    const formData = {
                        component: updatedShifts,
                        lastUpdateTs: Date.now() // Update timestamp
                    };

                    const scope = 'SERVER_SCOPE'; // As seen in shiftadd.js context

                    // Call the API to update the shifts (effectively deleting the selected one)
                    const response = await shiftadd(formData, customerId, scope);

                    if (response.msg) {
                        Swal.fire('Deleted!', response.msg, 'success');
                    } else {
                        Swal.fire('Deleted!', 'Your component has been deleted successfully.', 'success');
                    }
                    getComponents(); // Refresh the data in the table after deletion
                } catch (error) {
                    console.error('Error deleting component:', error);
                    Swal.fire('Error!', 'Failed to delete the component: ' + error.message, 'error');
                }
            } else {
                // User clicked "No" or outside the popup
                Swal.fire('Cancelled');
            }
        });
    };

    // const convertTimes = (time) => {
    //     const date = new Date(time);
    //     return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // };

    const getComponents = async () => {
        try {
            const componentKey = "component";
            const autoTargetKey = "autotarget";

            const [componentRes, autoTargetRes] = await Promise.all([
                customerbasedshift(customerId, componentKey),
                customerbasedshift(customerId, autoTargetKey)
            ]);

            const components = componentRes?.[0]?.value || [];
            const autoTargets = autoTargetRes?.[0]?.value || [];
            console.log(autoTargets, 'autotargets')
            const mappedJson = components.map(comp => {
                const match = autoTargets.find(
                    auto => auto.component_name === comp.component_name
                );

                return {
                    ...comp,
                    auto_target: match
                        ? {
                            cycle_levels: match.cycle_level || "00:00:00",
                            handling_levels: match.handling_level || "00:00:00"
                        }
                        : null
                };
            });

            console.log("Mapped datasource:", mappedJson);
            setDatasource(mappedJson);

        } catch (error) {
            console.error("Error fetching components:", error);
            setDatasource([]);
        }
    };
    console.log('datasource', datasource)

    // const getTotalShiftHours = (start, end, breakTime) => {
    //     const parseTime = (str) => {
    //         const [h, m, s] = str.split(':').map(Number);
    //         return h * 3600 + m * 60 + s;
    //     };

    //     const startSec = parseTime(start);
    //     const endSec = parseTime(end);
    //     const breakSec = parseTime(breakTime);

    //     let totalSec = endSec - startSec - breakSec;

    //     // Handle overnight shifts (e.g., 22:00 to 06:00)
    //     if (totalSec < 0) {
    //         totalSec += 24 * 3600;
    //     }

    //     const hours = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    //     const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    //     const seconds = String(totalSec % 60).padStart(2, '0');

    //     return `${hours}:${minutes}:${seconds}`;
    // };


    const paginatedData = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredDatasource.slice(start, start + rowsPerPage);
    }, [filteredDatasource, page, rowsPerPage]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    useEffect(() => {
        getComponents();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [searchText]);

    const timeToSeconds = (time) => {
        if (!time) return 0;
        const [h = 0, m = 0, s = 0] = String(time).split(":").map(Number);
        return h * 3600 + m * 60 + s;
    };

    const secondsToTime = (sec) => {
        if (sec === '' || sec === null || sec === undefined) return '';
        const sign = sec < 0 ? "-" : "";
        sec = Math.abs(sec);

        const h = String(Math.floor(sec / 3600)).padStart(2, "0");
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");

        return `${sign}${h}:${m}:${s}`;
    };

    const handleExportCSV = () => {
        const headers = [
            "Component Name",
            "Component Number",
            "Factor",
            "Factor Value",
            "Standard Cycle Time",
            "Auto Cycle Time",
            "Cycle Time Diff",
            "Standard Handling Time",
            "Actual Handling Time",
            "Handling Time Diff",
            "Setup Time"
        ];

        const rows = filteredDatasource.map(row => {
            const cycleTime = row.cycle_time || "-";
            const cycleLevel = row.auto_target?.cycle_levels || "-";
            const handlingTime = row.handling_time || "-";
            const handlingLevel = row.auto_target?.handling_levels || "-";

            const diffCycle =
                row.cycle_time && row.auto_target?.cycle_levels
                    ? secondsToTime(
                        timeToSeconds(row.cycle_time) -
                        timeToSeconds(row.auto_target?.cycle_levels)
                    )
                    : "-";

            const diffHandling =
                row.handling_time && row.auto_target?.handling_levels
                    ? secondsToTime(
                        timeToSeconds(row.handling_time) -
                        timeToSeconds(row.auto_target?.handling_levels)
                    )
                    : "-";

            return [
                row.component_name || "-",
                row.component_number || "-",
                row.factor || "-",
                row.factorval || "-",
                cycleTime,
                cycleLevel,
                diffCycle || "-",
                handlingTime,
                handlingLevel,
                diffHandling || "-",
                row.setupTime || "-"
            ];
        });

        const csvContent = [headers, ...rows]
            .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "components.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    };


    return (
        <div className="pages" style={{
            paddingLeft: "10px"
        }}>
            <div className="pagecontents">
                <div className="left-labels">
                    <div className="shift-content">
                        <h5>Component Registration</h5>
                        <div className="add_new">
                            <Tooltip title="Add Component">
                                <IconButton className="circle" onClick={handleOpenAddDialog}> 
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                            <ComponentAdd
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cleanCustomerId(customerId) === CUSTOMER_IDS.PMI && (
                            <Button
                                variant="outlined"
                                onClick={handleExportCSV}
                                sx={{
                                    minWidth: 120,
                                    height: 54,
                                    borderColor: '#f47803',
                                    color: '#f47803',
                                    '&:hover': { borderColor: '#f47803', color: '#f47803', background: '#e9e9e9' },
                                    textTransform: 'none',
                                    fontSize: "16px",
                                    fontWeight: 'bold',
                                }}
                            >
                                Export CSV
                            </Button>
                        )}
                        <TextField
                            label="Search Component Name or Number"
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            InputLabelProps={{
                                sx: { color: 'black', '&.Mui-focused': { color: 'orange' } },
                            }}
                            sx={{
                                minWidth: 300
                            }}
                        />
                    </div>
                </div>

                <Card className="card_sec">
                    <div className="example-container">
                        <Table stickyHeader aria-label="sticky table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Component Name</TableCell>
                                    {(cleanCustomerId(customerId) != CUSTOMER_IDS.GPLAST) && (<TableCell>Component Number</TableCell>)}
                                    {(cleanCustomerId(customerId) === CUSTOMER_IDS.ATECH || cleanCustomerId(customerId) === CUSTOMER_IDS.HITECH) && (<TableCell>Operation Type</TableCell>)}
                                    {(cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST) && (<TableCell>Item Code</TableCell>)}
                                    {(cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST) && (<TableCell>Process Name</TableCell>)}
                                    {(cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST) && (<TableCell>Operation Number</TableCell>)}
                                    {/* <TableCell>Route Card</TableCell> */}
                                    {/* <TableCell>Drawing Code</TableCell> */}
                                    {/* <TableCell>Mould Name</TableCell> */}
                                    {/* <TableCell>Mould Number</TableCell> */}
                                    <TableCell>Factor</TableCell>
                                    <TableCell>Factor Value</TableCell>
                                    {cleanCustomerId(customerId) === CUSTOMER_IDS.PMI ? (
                                        <>
                                            <TableCell>Standard Cycle Time</TableCell>
                                            <TableCell>Actual Cycle Time</TableCell>
                                            <TableCell>Standard Handling Time</TableCell>
                                            <TableCell>Actual Handling Time</TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell>Cycle Time</TableCell>
                                            <TableCell>Handling Time</TableCell>
                                        </>
                                    )}
                                    <TableCell>Setup Time</TableCell>
                                    <TableCell>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((row, index) => (
                                        <TableRow key={index}>
                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.component_name || '---'}
                                            </TableCell>
                                            {(cleanCustomerId(customerId) != CUSTOMER_IDS.GPLAST) && (<TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.component_number || '---'}
                                            </TableCell>)}
                                            {(cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST) && (<TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row?.item_code || '---'}
                                            </TableCell>)}
                                            {(cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST) && (<TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row?.process_name || '---'}
                                            </TableCell>)}
                                            {(cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST) && (<TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row?.operation_number || '---'}
                                            </TableCell>)}
                                            {(cleanCustomerId(customerId) === CUSTOMER_IDS.ATECH || cleanCustomerId(customerId) === CUSTOMER_IDS.HITECH) && (<TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.operation_type || '---'}
                                            </TableCell>)}
                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.factor || '---'}
                                            </TableCell>
                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.factorval || '---'}
                                            </TableCell>
                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.cycle_time || '---'}
                                            </TableCell>
                                            {cleanCustomerId(customerId) === CUSTOMER_IDS.PMI && (
                                                <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                    {row.auto_target?.cycle_levels || '---'}
                                                </TableCell>)}
                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.handling_time || '---'}
                                            </TableCell>
                                            {cleanCustomerId(customerId) === CUSTOMER_IDS.PMI && (
                                                <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                    {row.auto_target?.handling_levels || '---'}
                                                </TableCell>)}
                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                {row.setupTime || '---'}
                                            </TableCell>
                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                <Tooltip title="Edit Component">
                                                    <IconButton onClick={() => handleOpenEditDialog(row)}>
                                                        <EditIcon sx={{ color: 'black' }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Component">
                                                    <IconButton onClick={() => deleteshift(row, datasource)}>
                                                        <DeleteIcon sx={{ color: 'black' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} align="center" style={{
                                            padding: '20px', background: '#EDEDED', fontSize: '1rem',
                                            letterSpacing: ' 0.02rem'
                                        }}>
                                            No Results found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>

                        </Table>
                    </div>
                    <CardActions sx={{ px: 2, justifyContent: 'end', background: '#dddddd' }}>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50]}
                            component="div"
                            count={filteredDatasource.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            labelRowsPerPage="Items per page"
                        />
                    </CardActions>
                </Card>
            </div>
            {/* Render ShiftEdit conditionally outside the table loop */}
            {isEditDialogOpen && (
                <ComponentEdit
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

export default ComponentRegistration;