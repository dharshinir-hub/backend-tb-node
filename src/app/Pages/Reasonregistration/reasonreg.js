import { useState, useEffect, useMemo } from 'react';
import {
    Tooltip,
    IconButton,
    Chip,
    Autocomplete,
    TextField,
    ToggleButtonGroup,
    ToggleButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import '../../Pages/Reasonregistration/reasonreg.css';
import { customerbasedshift, shiftadd } from '../../Services/app/masterservice';
import Swal from 'sweetalert2';
import ReasonAdd from './reasonadd';
import ReasonEdit from './reasonedit';
import { cleanCustomerId } from '../../Services/app/operatorservice';
import { CUSTOMER_IDS } from '../../Shared/constants/ids';

const ReasonRegistration = ({
    reasonKey = 'reason',
    groupKey = 'reasongroups',
    title = 'Reason Registration',
    addTooltip = 'Add Reason',
    isQuality = false,
}) => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editDialogData, setEditDialogData] = useState(null);
    const [dialogOpenCount, setDialogOpenCount] = useState(0);
    const [reasonGroupOptions, setReasonGroupOptions] = useState([]);
    const [datasource, setDatasource] = useState([]);
    const [filteredDataSource, setFilteredDataSource] = useState([]);
    const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
    const [sourceTypeFilter, setSourceTypeFilter] = useState('all');

    const customerId = localStorage.getItem('CustomerID');

    const fetchReasonGroups = async () => {
        try {
            const [groupData, qualityGroupData] = await Promise.all([
                customerbasedshift(customerId, groupKey),
                customerbasedshift(customerId, 'qualityreasongroups'),
            ]);
            const groups = groupData?.[0]?.value || [];
            const qualityGroups = qualityGroupData?.[0]?.value || [];
            const allGroups = [...groups, ...qualityGroups];
            const seen = new Set();
            const mapped = allGroups
                .filter((item) => {
                    if (seen.has(item.groupName)) return false;
                    seen.add(item.groupName);
                    return true;
                })
                .map((item) => ({ value: item.groupName, label: item.groupName }));
            setReasonGroupOptions(mapped);
        } catch (err) {
            console.error('Error fetching reason groups:', err);
            setReasonGroupOptions([]);
        }
    };

    const getReasons = async () => {
        try {
            const [reasonData, qualityData] = await Promise.all([
                customerbasedshift(customerId, 'reason'),
                customerbasedshift(customerId, 'qualityreason'),
            ]);

            const reasons = (reasonData?.[0]?.value || []).map(r => ({
                ...r,
                sourceType: 'reason'
            }));

            const qualityReasons = (qualityData?.[0]?.value || []).map(r => ({
                ...r,
                sourceType: 'qualityreason'
            }));

            const allReasons = [...reasons, ...qualityReasons];

            setDatasource(allReasons);
            setFilteredDataSource(allReasons);
        } catch (error) {
            console.error('Error fetching reasons:', error);
            setDatasource([]);
            setFilteredDataSource([]);
        }
    };

    useEffect(() => {
        if (!customerId) return;
        getReasons();
        if (cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST) {
            fetchReasonGroups();
        }
    }, [reasonKey, customerId]);

    useEffect(() => {
        let filtered = datasource;
        if (sourceTypeFilter !== 'all') {
            filtered = filtered.filter((item) => item.sourceType === sourceTypeFilter);
        }
        if (selectedGroupFilter !== 'all') {
            filtered = filtered.filter((item) => item?.group === selectedGroupFilter);
        }
        setFilteredDataSource(filtered);
    }, [datasource, selectedGroupFilter, sourceTypeFilter]);

    const handleOpenAddDialog = () => {
        setIsAddDialogOpen(true);
        setDialogOpenCount((c) => c + 1);
    };

    const handleCloseAddDialog = (event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        setIsAddDialogOpen(false);
        setDialogOpenCount((c) => Math.max(0, c - 1));
        getReasons();
    };
    const handleOpenEditDialog = (rowData) => {
        setEditDialogData(rowData);
        setIsEditDialogOpen(true);
        setDialogOpenCount((c) => c + 1);
    };

    const handleCloseEditDialog = (event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        setIsEditDialogOpen(false);
        setEditDialogData(null);
        setDialogOpenCount((c) => Math.max(0, c - 1));
        getReasons();
    };

    const deleteReason = (row) => {
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
            if (!result.isConfirmed) return;

            try {
                // ✅ reliable source detection
                const targetKey =
                    row?.sourceType === 'qualityreason'
                        ? 'qualityreason'
                        : 'reason';

                const currentData = await customerbasedshift(customerId, targetKey);
                const allReasons = currentData?.[0]?.value || [];

                const updatedReasons = allReasons.filter((reason) => {
                    if (
                        typeof reason.id === 'object' &&
                        reason.id?.$oid &&
                        typeof row.id === 'object' &&
                        row.id?.$oid
                    ) {
                        return reason.id.$oid !== row.id.$oid;
                    }
                    return reason.id !== row.id;
                });

                const formData = {
                    [targetKey]: updatedReasons,
                    lastUpdateTs: Date.now()
                };

                const scope = 'SERVER_SCOPE';
                const response = await shiftadd(formData, customerId, scope);

                Swal.fire(
                    'Deleted!',
                    response?.msg || 'Deleted successfully.',
                    'success'
                );

                getReasons();
            } catch (error) {
                console.error('Error deleting reason:', error);
                Swal.fire('Error!', error.message || 'Delete failed', 'error');
            }
        });
    };

    const sortedReasons = useMemo(() => {
        return filteredDataSource
            ?.slice()
            .sort((a, b) => Number(a?.code || 0) - Number(b?.code || 0));
    }, [filteredDataSource]);

    return (
        <div className="pages" style={{
            paddingBlockStart: '40px', paddingLeft: "10px"
        }}>
            <div className="pagecontents">
                <div className="left-labels" style={{
                    padding: '1rem 2rem 1rem 1rem',
                }}>
                    <div className="shift-content">
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                            }}
                        >
                            {/* LEFT — Title + Add */}
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <h5 style={{ margin: 0 }}>{title}</h5>

                                <Tooltip title={addTooltip}>
                                    <IconButton
                                        className="circle"
                                        onClick={handleOpenAddDialog}
                                        sx={{
                                            backgroundColor: "#F69320",
                                            color: "#945307",
                                            width: 32,
                                            height: 32,
                                            "&:hover": {
                                                backgroundColor: "#e6841c",
                                            },
                                        }}
                                    >
                                        <AddIcon fontSize="medium" />
                                    </IconButton>
                                </Tooltip>
                            </div>

                            {/* RIGHT — Filters */}
                            {(
                               cleanCustomerId(customerId) === CUSTOMER_IDS.PMI 
                            ) && (
                                    <ToggleButtonGroup
                                        value={sourceTypeFilter}
                                        exclusive
                                        onChange={(_, val) => {
                                            if (val !== null) setSourceTypeFilter(val);
                                        }}
                                        size="small"
                                    >
                                        <ToggleButton value="all">All</ToggleButton>
                                        <ToggleButton value="reason">Reason</ToggleButton>
                                        <ToggleButton value="qualityreason">
                                            Quality Reason
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                )}
                        </div>
                    </div>

                    {cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST && (
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                marginBottom: '20px'
                            }}
                        >
                            <Autocomplete
                                options={[
                                    { label: 'All Groups', value: 'all' },
                                    ...reasonGroupOptions
                                ]}
                                getOptionLabel={(o) => o.label}
                                value={
                                    selectedGroupFilter === 'all'
                                        ? { label: 'All Groups', value: 'all' }
                                        : reasonGroupOptions.find(
                                            (opt) => opt.value === selectedGroupFilter
                                        ) || null
                                }
                                onChange={(_, newValue) =>
                                    setSelectedGroupFilter(newValue?.value || 'all')
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Filter by Group"
                                        variant="outlined"
                                        sx={{ minWidth: 300 }}
                                    />
                                )}
                            />
                        </div>
                    )}
                </div>

                <div className="idle_reason_list">
                    {sortedReasons?.length > 0 ? (
                        sortedReasons.map((item, idx) => {
                            const itemId =
                                typeof item.id === 'object' && item.id?.$oid
                                    ? item.id.$oid
                                    : item.id || idx;

                            return (
           <div
    className="idle_reason_item"
    key={itemId}
    style={{
        borderColor: '#FFA500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: 0,
    }}
>
    {/* Number badge */}
    <div className="icons" style={{ flexShrink: 0 }}>
        <span className="icon-text">{idx + 1}</span>
    </div>

    {/* Reason name */}
   <h3
    className="reason-text"
    title={item.reason}   // ← add only this line
    style={{
        margin: 0,
        flexShrink: 1,
        minWidth: 0,
        wordBreak: 'break-word',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    }}
>
    {item.reason}
</h3>

    {/* Group chip — right next to reason name */}
    {item?.group && (
        <Chip
            label={item.group}
            size="small"
            variant="outlined"
            className="group-chip"
            color={item.sourceType === 'qualityreason' ? 'secondary' : 'default'}
            style={{ flexShrink: 0 }}
        />
    )}

    {/* Spacer pushes edit/delete to far right */}
    <div style={{ flex: 1 }} />

    {/* Edit + Delete icons */}
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Tooltip title="Edit">
            <IconButton onClick={() => handleOpenEditDialog(item)}>
                <EditIcon sx={{ color: 'black' }} />
            </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
            <IconButton onClick={() => deleteReason(item)}>
                <DeleteIcon sx={{ color: 'black' }} />
            </IconButton>
        </Tooltip>
    </div>
</div>
                            );
                        })
                    ) : (
                        <div
                            style={{
                                margin: '3rem 0',
                                textAlign: 'center',
                                color: '#888',
                                fontWeight: 500
                            }}
                        >
                            No reasons found.
                        </div>
                    )}
                </div>
            </div>

            <ReasonAdd
                open={isAddDialogOpen}
                handleClose={handleCloseAddDialog}
                dialogOpenCount={dialogOpenCount}
                datasource={datasource}
                customerId={customerId}
                setDatasource={setDatasource}
                reasonKey={reasonKey}
                groupKey={groupKey}
                isQuality={isQuality}
            />

            {isEditDialogOpen && editDialogData && (
                <ReasonEdit
                    open={isEditDialogOpen}
                    handleClose={handleCloseEditDialog}
                    dialogData={editDialogData}
                    dialogOpenCount={dialogOpenCount}
                    datasource={datasource}
                    customerId={customerId}
                    setDatasource={setDatasource}
                    reasonKey={reasonKey}
                    groupKey={groupKey}
                    isQuality={isQuality}
                />
            )}
        </div>
    );
};

export default ReasonRegistration;