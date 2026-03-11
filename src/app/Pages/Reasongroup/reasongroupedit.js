import React, { useState, useEffect, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import '../../Pages/Reasonregistration/reasonreg.css';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';

export default function ReasonGroupEdit({
    open,
    handleClose,
    dialogOpenCount,
    datasource,
    customerId,
    dialogData,
    groupKey = 'reasongroups',      // ✅ NEW
    title = 'Edit Reason Group'     // ✅ NEW
}) {
    const memoizedDatasource = useMemo(() => datasource, [datasource]);
    const memoizedDialogData = useMemo(() => dialogData, [dialogData]);
    const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';

    const { register, handleSubmit, formState: { errors }, trigger, setValue, reset, watch } = useForm({
        shouldFocusError: true,
        mode: 'onBlur',
        defaultValues: {
            groupName: memoizedDialogData?.groupName || '',
        }
    });

    const defaultForm = useMemo(() => ({
        groupName: memoizedDialogData?.groupName || '',
    }), [memoizedDialogData]);

    const [formData, setFormData] = useState(defaultForm);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setValue(name, value, { shouldValidate: true });
    };

    const onSubmit = async () => {
        try {
            const groupIdToEdit = memoizedDialogData?.id;
            let existingGroups = Array.isArray(memoizedDatasource) ? [...memoizedDatasource] : [];

            let groupIndex = -1;
            let existingIdStructure = null;

            if (groupIdToEdit) {
                groupIndex = existingGroups.findIndex(item => {
                    const itemId = typeof item.id === 'object' ? item.id?.$oid : item.id;
                    const targetId = typeof groupIdToEdit === 'object' ? groupIdToEdit?.$oid : groupIdToEdit;
                    return itemId === targetId;
                });

                if (groupIndex !== -1) {
                    existingIdStructure = existingGroups[groupIndex].id;
                }
            }

            if (groupIndex === -1) {
                Swal.fire('Error', 'Reason group not found.', 'error');
                handleClose();
                reset(defaultForm);
                return;
            }

            const isDuplicate = existingGroups.some((item, index) =>
                index !== groupIndex &&
                item.groupName?.trim().toLowerCase() === formData.groupName.trim().toLowerCase()
            );

            if (isDuplicate) {
                Swal.fire('Error', 'Reason Group name already exists.', 'error');
                return;
            }

            const updatedGroup = {
                id: existingIdStructure,
                groupName: formData.groupName.trim(),
                code: existingGroups[groupIndex].code
            };

            existingGroups[groupIndex] = updatedGroup;

            // ✅ CRITICAL FIX — dynamic key
            const updateData = {
                [groupKey]: existingGroups,
                lastUpdateTs: Date.now()
            };

            const scope = 'SERVER_SCOPE';
            const response = await shiftadd(updateData, customerId, scope);

            Swal.fire(response?.msg || 'Updated Successfully');

            handleClose();
            reset(defaultForm);
        } catch (error) {
            handleClose();
            reset(defaultForm);
            console.error('Error:', error);
            Swal.fire('Error: ' + error.message);
        }
    };

    useEffect(() => {
        if (!open) {
            reset(defaultForm);
            setFormData(defaultForm);
        } else if (memoizedDialogData) {
            const initialForm = {
                groupName: memoizedDialogData.groupName || '',
            };
            setFormData(initialForm);
            reset(initialForm);
            Object.keys(initialForm).forEach(key => {
                setValue(key, initialForm[key]);
            });
        }
    }, [open, reset, defaultForm, memoizedDialogData, setValue]);

    const formValues = watch();
    useEffect(() => {
        setFormData(formValues);
    }, [formValues]);

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            PaperProps={{ style: { backgroundColor: dialogBackgroundColor, maxWidth: "500px" } }}
        >
            <DialogTitle style={{ color: 'black' }}>{title}</DialogTitle>

            <div className="close_modal">
                <Tooltip title="Close">
                    <IconButton aria-label="close" onClick={handleClose} style={{ backgroundColor: '#ffffff' }}>
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </div>

            <div className="machinedialog">
                <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'stretch', margin: '1rem' }}>
                        <div style={{ width: "100%" }}>
                            <TextField
                                {...register("groupName", {
                                    required: "Group Name is required",
                                    maxLength: { value: 100, message: "Maximum 100 characters" }
                                })}
                                onBlur={() => trigger('groupName')}
                                label="Group Name"
                                name="groupName"
                                value={formData.groupName}
                                onChange={handleFormChange}
                                error={!!errors.groupName}
                                inputProps={{ maxLength: 100 }}
                                fullWidth
                            />
                            {errors.groupName && <div className="mat-error">{errors.groupName.message}</div>}
                        </div>
                    </div>

                    <div className="form-button text-right" align="end" style={{ marginRight: '10px' }}>
                        <Button type="submit" variant="contained" className="filter_btn btn_orange" color="warning">
                            Save
                        </Button>
                    </div>
                    <br />
                </form>
            </div>
        </Dialog>
    );
}