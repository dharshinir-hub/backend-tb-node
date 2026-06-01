import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogTitle, TextField, Button, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { shiftadd } from '../../Services/app/masterservice';

export default function ProcessGroupAdd({ open, handleClose, dialogOpenCount, datasource, customerId }) {
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({ mode: 'onBlur' });
  const defaultForm = useMemo(() => ({ groupName: '' }), []);
  const [formData, setFormData] = useState(defaultForm);
  const groupNameRef = useRef();

  useEffect(() => {
    if (!open) { reset(defaultForm); setFormData(defaultForm); }
  }, [open, reset, defaultForm]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValue(name, value);
    trigger(name);
  };

  const onSubmit = async () => {
    try {
      const id = Math.random().toString(36).substr(2, 9);
      let existingGroups = Array.isArray(datasource) ? [...datasource] : [];
      const lastCode = existingGroups.length ? Math.max(...existingGroups.map(g => parseInt(g.code, 10) || 0)) : 0;
      const autoCode = lastCode + 1;

      if (existingGroups.some(g => g.groupName?.trim().toLowerCase() === formData.groupName.trim().toLowerCase())) {
        Swal.fire('Error', 'Duplicate Process Group name not allowed.', 'error');
        return;
      }

      const newGroup = { id, groupName: formData.groupName.trim(), code: String(autoCode) };
      const formDataToSend = { processgroups: [...existingGroups, newGroup], lastUpdateTs: Date.now() };

      const scope = 'SERVER_SCOPE';
      const response = await shiftadd(formDataToSend, customerId, scope);
      Swal.fire('Success', response.msg || 'Process Group created successfully', 'success');
      handleClose();
      reset(defaultForm);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
    }
  };

  useEffect(() => {
    if (open && groupNameRef.current) setTimeout(() => groupNameRef.current.focus(), 100);
  }, [open]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth PaperProps={{ style: { backgroundColor: dialogBackgroundColor, maxWidth: '500px' } }}>
      <DialogTitle style={{ color: 'black' }}>Add Process Group</DialogTitle>
      <div className="close_modal">
        <Tooltip title="Close">
          <IconButton onClick={handleClose} style={{ backgroundColor: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </div>
      <div className="machinedialog">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ margin: '1rem' }}>
            <TextField
              inputRef={groupNameRef}
              {...register('groupName', { required: 'Group Name is required', maxLength: { value: 100, message: 'Maximum 100 characters' } })}
              label="Group Name"
              value={formData.groupName}
              onChange={handleFormChange}
              onBlur={() => trigger('groupName')}
              fullWidth
              error={!!errors.groupName}
              helperText={errors.groupName?.message}
              InputLabelProps={{ required: true, sx: { color: 'black', '&.Mui-focused': { color: 'orange' } } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'black' },
                  '&:hover fieldset': { borderColor: 'black' },
                  '&.Mui-focused fieldset': { borderColor: 'orange' },
                  '& .MuiOutlinedInput-input': { color: 'black' },
                },
              }}
            />
          </div>
          <div align="end" style={{ margin: '0.8rem 1rem 1rem' }}>
            <Button type="submit" variant="contained" color="warning">Save</Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
