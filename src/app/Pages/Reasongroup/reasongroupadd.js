import React, { useState, useEffect, useRef, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import '../../Pages/Reasonregistration/reasonreg.css';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';

export default function ReasonGroupAdd({ open, handleClose, handleAdd, dialogOpenCount, datasource, customerId }) {
    const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';

    const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({
        shouldFocusError: true,
        mode: 'onBlur'
    });

    const defaultForm = useMemo(() => ({
        groupName: '',
    }), []);

    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        if (!open) {
            reset(defaultForm);
            setFormData(defaultForm);
        }
    }, [open, reset, defaultForm]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setValue(name, value);
        trigger(name);
    };

    const onSubmit = async (data) => {
        try {
            const id = Math.random().toString(36).substr(2, 9);
            let existingGroups = Array.isArray(datasource) ? [...datasource] : [];

            let lastCode = 0;
            if (existingGroups.length > 0) {
                lastCode = Math.max(...existingGroups.map(item => parseInt(item.code, 10) || 0));
            }
            const autoCode = lastCode + 1;

            const isDuplicate = existingGroups.some(item =>
                item.groupName?.trim().toLowerCase() === formData.groupName.trim().toLowerCase()
            );

            if (isDuplicate) {
                Swal.fire('Error', 'Reason Group name already exists.', 'error');
                return;
            }

            const reasonGroupData = {
                id,
                groupName: formData.groupName.trim(),
                code: String(autoCode)
            };

            existingGroups.push(reasonGroupData);
            const updateData = {
                reasongroups: existingGroups,
                lastUpdateTs: Date.now()
            };

            const scope = 'SERVER_SCOPE';
            const response = await shiftadd(updateData, customerId, scope);

            if (response.msg) {
                Swal.fire(response.msg);
            } else {
                Swal.fire("Reason Group Created Successfully");
            }

            handleClose();
            reset(defaultForm);
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error: ' + error.message);
            handleClose();
            reset(defaultForm);
        }
    };

    const groupNameRef = useRef();

    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                if (groupNameRef.current) {
                    groupNameRef.current.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [open]);

    return (
        <Dialog open={open} onClose={handleClose} fullWidth PaperProps={{ style: { backgroundColor: dialogBackgroundColor, maxWidth: "500px" } }}>
            <DialogTitle style={{ color: 'black' }}>Add Reason Group</DialogTitle>
            <div className="close_modal">
                <Tooltip title="Close">
                    <IconButton aria-label="close" onClick={handleClose} style={{ backgroundColor: '#ffffff' }}>
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </div>
            <div className="machinedialog">
                <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                    <div
                        style={{
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'stretch',
                            margin: '1rem',
                        }}
                    >
                        <div style={{ width: "100%" }}>

                            <TextField
                                inputRef={groupNameRef}
                                {...register("groupName", {
                                    required: "Group Name is required",
                                    maxLength: {
                                        value: 100,
                                        message: "Maximum 100 characters"
                                    }
                                })}
                                onBlur={() => trigger('groupName')}
                                label="Group Name"
                                type="text"
                                name="groupName"
                                value={formData.groupName}
                                onChange={handleFormChange}
                                error={!!errors.groupName}
                                inputProps={{ maxLength: 100 }}
                                InputLabelProps={{
                                    required: true,
                                    sx: {
                                        color: 'black',
                                        '&.Mui-focused': { color: 'orange' },
                                    },
                                }}
                                fullWidth
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': { borderColor: 'black' },
                                        '&:hover fieldset': { borderColor: 'black' },
                                        '&.Mui-focused fieldset': { borderColor: 'orange' },
                                        '& .MuiOutlinedInput-input': { color: 'black' },
                                        '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
                                    },
                                }}
                            />
                            {errors.groupName && <div className="mat-error">{errors.groupName.message}</div>}
                        </div>
                    </div>

                    <div
                        className="form-button text-right"
                        align="end"
                        style={{ margin: '0.8rem 1rem 1rem 1rem' }}
                    >
                        <Button
                            type="submit"
                            variant="contained"
                            className="filter_btn btn_orange"
                            color="warning"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </div>
        </Dialog>
    );
}