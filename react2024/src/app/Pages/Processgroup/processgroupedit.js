import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogTitle, TextField, Button, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { shiftadd } from '../../Services/app/masterservice';

export default function ProcessGroupEdit({ open, handleClose, dialogOpenCount, datasource, customerId, dialogData }) {
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const memoizedData = useMemo(() => dialogData, [dialogData]);
  const { register, handleSubmit, setValue, reset, formState: { errors }, trigger, watch } = useForm({
    mode: 'onBlur',
    defaultValues: { groupName: memoizedData?.groupName || '' },
  });
  const [formData, setFormData] = useState({ groupName: memoizedData?.groupName || '' });

  useEffect(() => {
    if (open) {
      reset({ groupName: memoizedData?.groupName || '' });
      setFormData({ groupName: memoizedData?.groupName || '' });
    }
  }, [open, memoizedData, reset]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setValue(name, value, { shouldValidate: true });
  };

  const onSubmit = async () => {
    try {
      let existingGroups = Array.isArray(datasource) ? [...datasource] : [];
      const editId = memoizedData?.id;
      const idx = existingGroups.findIndex(g => (typeof g.id === 'object' ? g.id.$oid : g.id) === (typeof editId === 'object' ? editId.$oid : editId));
      if (idx === -1) return Swal.fire('Error', 'Group not found', 'error');

      if (existingGroups.some((g, i) => i !== idx && g.groupName.trim().toLowerCase() === formData.groupName.trim().toLowerCase())) {
        Swal.fire('Error', 'Duplicate Process Group name not allowed', 'error');
        return;
      }

      existingGroups[idx] = { ...existingGroups[idx], groupName: formData.groupName.trim() };
      const payload = { processgroups: existingGroups, lastUpdateTs: Date.now() };
      const scope = 'SERVER_SCOPE';
      const response = await shiftadd(payload, customerId, scope);
      Swal.fire('Success', response.msg || 'Updated Successfully', 'success');
      handleClose();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
      handleClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth PaperProps={{ style: { backgroundColor: dialogBackgroundColor, maxWidth: '500px' } }}>
      <DialogTitle style={{ color: 'black' }}>Edit Process Group</DialogTitle>
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
