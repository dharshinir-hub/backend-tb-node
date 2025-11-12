import { useState, useEffect } from 'react';
import { Tooltip, IconButton, TextField, Tab, Tabs, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Card, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import classNames from 'classnames';
import DeleteIcon from '@mui/icons-material/Delete';
import '../../Pages/Userregistration/userreg.css';
import Swal from 'sweetalert2';

import { customerbasedshift, deleteUserById, getCustomerUsers } from '../../Services/app/operatorservice';
import { useUserRole } from '../../Shared/hooks/useUserRole';
import { EditIcon } from 'lucide-react';
import { ROLES, ROLE_ADMIN, ROLE_HIERARCHY, ROLE_MANAGER, ROLE_OPERATOR, ROLE_SUPER_ADMIN } from '../../Shared/constants/role';
import { useRoleOptions } from '../../Shared/hooks/useRoleOptions';
import UserAdd from './useradd';
import UserEdit from './useredit';
import { shiftadd } from '../../Services/app/masterservice';
import { PAGE_LIST } from '../../Shared/constants/pages';

const UserRegistration = () => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null);
    const [dialogOpenCount, setDialogOpenCount] = useState(0);
    const [datasource, setDatasource] = useState([]);
    const [datasource1, setDatasource1] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState(ROLES[0].value);
    const { availableRoles } = useRoleOptions();

    const customerId = localStorage.getItem('CustomerID');
    const { userRole, isOperator, isSupervisor, isMaintenance, isQuality, isManager, isAdmin, isSuperAdmin } = useUserRole();
    const currentUserId = JSON.parse(localStorage.getItem("userDetails"))?.id;

    // Common Search Filter
    const getFilteredDatasource = (role) => {
        const search = searchText.toLowerCase();
        return datasource.filter(user => {
            if (user?.userDetails?.mode !== role) return false;
            return (
                user.firstName?.toLowerCase().includes(search) ||
                user?.userDetails?.userId?.toLowerCase().includes(search) ||
                user?.userDetails?.mode?.toLowerCase().includes(search) ||
                user.email?.toLowerCase().includes(search)
            );
        });
    };

    const canAddUser = (role) => {
        return availableRoles.some(r => r.value === role && !r.disabled);
    };

    const canEditUser = (role, rowUserId) => {
        return availableRoles.some(r => r.value === role && !r.disabled) && rowUserId !== currentUserId;
    };

    const canDeleteUser = (role, rowUserId) => canEditUser(role, rowUserId);

    // Dialog Handlers
    const handleOpenAddDialog = () => { setIsAddDialogOpen(true); setDialogOpenCount(prev => prev + 1); };
    const handleCloseAddDialog = () => { setIsAddDialogOpen(false); setDialogOpenCount(prev => Math.max(0, prev - 1)); getUsersList(); };
    const handleOpenEditDialog = (rowData) => { setEditDialogData(rowData); setIsEditDialogOpen(true); setDialogOpenCount(prev => prev + 1); };
    const handleCloseEditDialog = () => { setIsEditDialogOpen(false); setEditDialogData(null); setDialogOpenCount(prev => Math.max(0, prev - 1)); getUsersList(); };

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
                    const userId = row?.id?.id;
                    if (!userId) {
                        Swal.fire('Error!', 'User ID not found. Cannot delete.', 'error');
                        return;
                    }
                    await deleteUserById(userId);
                    const key = 'alloperator';
                    const currentDataResponse = await customerbasedshift(customerId, key);
                    const allShifts = currentDataResponse[0]?.value || [];
                    const updatedShifts = allShifts.filter(shift => shift.operatorid !== row.userDetails.userId);
                    const formData = {
                        alloperator: updatedShifts,
                        lastUpdateTs: Date.now()
                    };
                    const scope = 'SERVER_SCOPE';
                    await shiftadd(formData, customerId, scope);
                    Swal.fire('Deleted!', 'User has been deleted successfully.', 'success');
                    getUsersList();
                } catch (error) {
                    console.error('Error deleting user:', error);
                    Swal.fire('Error!', 'Failed to delete the user: ' + error.message, 'error');
                }
            }
        });
    };

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
            setDatasource(parsedUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
            setDatasource([]);
        }
    };


    const getShifts = async () => {
        const key = 'alloperator';
        customerbasedshift(customerId, key)
            .then(async (data) => {
                const allShifts = data[0]?.value || [];
                console.log(allShifts);
                setDatasource1(allShifts);
            })
            .catch(error => {
                console.error("Error fetching shifts:", error);
                setDatasource1([]); // Set to empty array on error
            });
    };

    useEffect(() => { getUsersList(); getShifts() }, []);

    return (
        <div className="pages">
            <div className="pagecontents">
                <div className="left-labels" style={{ padding: '0 2rem 0 0' }}>
                    <div className="shift-content">
                        <h5>User Registration</h5>
                        {canAddUser(activeTab) && (
                            <div className="add_new">
                                <Tooltip title="Add User">
                                    <IconButton className="circle" onClick={handleOpenAddDialog}><AddIcon /></IconButton>
                                </Tooltip>
                                <UserAdd
                                    open={isAddDialogOpen}
                                    handleClose={handleCloseAddDialog}
                                    handleAdd={handleCloseAddDialog}
                                    dialogOpenCount={dialogOpenCount}
                                    datasource={datasource1}
                                    customerId={customerId}
                                    setDatasource={setDatasource1}
                                />
                            </div>
                        )}
                    </div>

                    <TextField
                        label="Search User"
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        InputLabelProps={{ sx: { color: 'black', '&.Mui-focused': { color: 'orange' } } }}
                        sx={{ minWidth: 300, marginTop: 2 }}
                    />
                </div>

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', marginTop: 2 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        aria-label="role tabs"
                        textColor="inherit"
                        TabIndicatorProps={{ sx: { backgroundColor: '#f47803' } }}
                    >
                        {ROLES.map(role => {
                            if (role.value === ROLE_SUPER_ADMIN && !isSuperAdmin) return null;
                            return <Tab key={role.value} label={role.label} value={role.value} />;
                        })}
                    </Tabs>
                </Box>

                {/* Tab Panels */}
                {/* Tab Panels */}
                {ROLES.map(role => (
                    <Box key={role.value} role="tabpanel" hidden={activeTab !== role.value} sx={{ marginTop: 2 }}>
                        {activeTab === role.value && (
                            <Card className="card_sec">
                                <div className="example-container">
                                    <Table stickyHeader aria-label={`${role.label} table`}>
                                        <TableHead>
                                            <TableRow>
                                                {![ROLE_ADMIN, ROLE_MANAGER, ROLE_SUPER_ADMIN].includes(activeTab) && (
                                                    <TableCell>ID</TableCell>
                                                )}
                                                <TableCell>Name</TableCell>
                                                <TableCell>Email</TableCell>
                                                {activeTab != ROLE_OPERATOR && (
                                                    <TableCell>Page Access</TableCell>
                                                )}

                                                {/* <TableCell>Role</TableCell> */}
                                                {/* Check if any row has edit/delete permissions to show Action column */}
                                                {getFilteredDatasource(role.value).some(row => canEditUser(row.userDetails?.mode, row.id?.id) || canDeleteUser(row.userDetails?.mode, row.id?.id)) && (
                                                    <TableCell>Action</TableCell>
                                                )}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {getFilteredDatasource(role.value).length > 0 ? getFilteredDatasource(role.value).map((row, index) => {
                                                const rowRole = row.userDetails?.mode;
                                                const editAllowed = canEditUser(rowRole, row.id?.id);
                                                const deleteAllowed = canDeleteUser(rowRole, row.id?.id);

                                                return (
                                                    <TableRow key={index}>
                                                        {![ROLE_ADMIN, ROLE_MANAGER, ROLE_SUPER_ADMIN].includes(activeTab) && (<TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row?.userDetails?.userId || '---'}</TableCell>)}
                                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.firstName || '---'}</TableCell>
                                                        <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{row.email || '---'}</TableCell>
                                                        {activeTab != ROLE_OPERATOR && (

                                                            <TableCell
                                                                className={classNames({
                                                                    "odd-row": index % 2 !== 0,
                                                                    "even-row": index % 2 === 0,
                                                                })}
                                                            >
                                                                {(() => {
                                                                    const pageList = row?.userDetails?.pageList;
                                                                    if (!pageList?.length) return "---";

                                                                    // Convert values to labels
                                                                    const labels = pageList.map(
                                                                        (val) => PAGE_LIST.find((p) => p.value === val)?.label || val
                                                                    );

                                                                    // Determine visible portion and tooltip text
                                                                    const visible = labels.slice(0, 3).join(", "); // show only first 3
                                                                    const full = labels.join(", ");

                                                                    return (
                                                                        <Tooltip title={full} placement="top" arrow>
                                                                            <span>
                                                                                {labels.length > 3 ? `${visible}, ...` : visible}
                                                                            </span>
                                                                        </Tooltip>
                                                                    );
                                                                })()}
                                                            </TableCell>)}
                                                        {/* <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>{rowRole || '---'}</TableCell> */}
                                                        {(editAllowed || deleteAllowed) && (
                                                            <TableCell className={classNames({ 'odd-row': index % 2 !== 0, 'even-row': index % 2 === 0 })}>
                                                                {editAllowed && (
                                                                    <Tooltip title="Edit User">
                                                                        <IconButton onClick={() => handleOpenEditDialog(row)}>
                                                                            <EditIcon sx={{ color: 'black' }} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}
                                                                {deleteAllowed && (
                                                                    <Tooltip title="Delete User">
                                                                        <IconButton onClick={() => deleteshift(row)}>
                                                                            <DeleteIcon sx={{ color: 'black' }} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                );
                                            }) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} align="center" style={{ padding: '20px', background: '#EDEDED', fontSize: '1rem', letterSpacing: '0.02rem' }}>
                                                        No Results found
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        )}
                    </Box>
                ))}


                {isEditDialogOpen && (
                    <UserEdit
                        open={isEditDialogOpen}
                        handleClose={handleCloseEditDialog}
                        handleAdd={handleCloseEditDialog}
                        dialogData={editDialogData}
                        dialogOpenCount={dialogOpenCount}
                        datasource={datasource1}
                        customerId={customerId}
                        setDatasource={setDatasource1}
                    />
                )}
            </div>
        </div>
    );
};
export default UserRegistration;