import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  TextField,
  Button,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  FormHelperText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Swal from 'sweetalert2';
import { useForm, Controller } from 'react-hook-form';
import './machinegroup.css';
import { shiftadd } from '../../Services/app/masterservice';
import { customerbaseddevices } from '../../Services/app/operatorservice';

export default function MachineGroupEdit({
  open,
  handleClose,
  handleAdd,
  dialogOpenCount,
  datasource,
  setDatasource,
  customerId,
  dialogData,
}) {
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const componentNameRef = useRef();

  const [machines, setMachines] = useState([]);
   const fetchDevices = async () => {
      try {
        const result = await customerbaseddevices(customerId, 1000, 0);
        const devicesList = result.data || [];
        setMachines(devicesList);
      } catch (err) {
        console.error("Failed to fetch devices", err);
      }
    };

    useEffect(() => {
      fetchDevices()
    }, [])

  const defaultForm = useMemo(
    () => ({
      name: dialogData?.name || '',
      machines: dialogData?.machines || [],
    }),
    [dialogData]
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    defaultValues: defaultForm,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!open) reset(defaultForm);
    else reset(defaultForm);
  }, [open, dialogData, reset, defaultForm]);

  const onSubmit = async (data) => {
    try {
      const editId = dialogData?.id;
      let existingGroups = Array.isArray(datasource) ? [...datasource] : [];

      const groupIndex = existingGroups.findIndex((item) => {
        const itemId =
          typeof item.id === 'object' && item.id !== null ? item.id.$oid : item.id;
        const targetId =
          typeof editId === 'object' && editId !== null ? editId.$oid : editId;
        return itemId === targetId;
      });

      if (groupIndex === -1) {
        Swal.fire('Error', 'Machine group not found for update.', 'error');
        handleClose();
        reset(defaultForm);
        return;
      }

      const updatedGroup = {
        ...existingGroups[groupIndex],
        name: data.name.trim(),
        machines: data.machines,
      };

      const isDuplicate = existingGroups.some(
        (item, idx) =>
          idx !== groupIndex &&
          item.name?.trim().toLowerCase() === updatedGroup.name.toLowerCase()
      );
      if (isDuplicate) {
        Swal.fire('Error', 'Duplicate Machine Group name not allowed.', 'error');
        handleClose();
        return;
      }

      existingGroups[groupIndex] = updatedGroup;

      const formData = {
        machinegroups: existingGroups,
        lastUpdateTs: Date.now(),
      };

      const scope = 'SERVER_SCOPE';
      const response = await shiftadd(formData, customerId, scope);

      if (response?.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Updated!',
          text: 'Machine Group updated successfully',
          timer: 1500,
          showConfirmButton: false,
        });
      }

      handleClose();
      reset(defaultForm);
      setDatasource(existingGroups);
      if (handleAdd) handleAdd();
    } catch (error) {
      console.error('Error updating machine group:', error);
      Swal.fire('Error updating machine group: ' + error.message);
      handleClose();
      reset(defaultForm);
    }
  };

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (componentNameRef.current) componentNameRef.current.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      PaperProps={{
        style: { backgroundColor: dialogBackgroundColor, maxWidth: '600px' },
      }}
    >
      <DialogTitle style={{ color: 'black' }}>Edit Machine Group</DialogTitle>

      <div className="close_modal">
        <Tooltip title="Close">
          <IconButton
            aria-label="close"
            onClick={handleClose}
            style={{ backgroundColor: '#ffffff' }}
          >
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
            <TextField
              inputRef={componentNameRef}
              label="Machine Group Name"
              type="text"
              fullWidth
              {...register('name', {
                required: 'Machine Group Name is required',
                maxLength: { value: 100, message: 'Maximum 100 characters' },
              })}
              onBlur={() => trigger('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              InputLabelProps={{
                required: true,
                sx: { color: 'black', '&.Mui-focused': { color: 'orange' } },
              }}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  height: '3.5rem',
                  '& fieldset': { borderColor: 'black' },
                  '&:hover fieldset': { borderColor: 'black' },
                  '&.Mui-focused fieldset': { borderColor: 'orange' },
                },
                '& .MuiOutlinedInput-input': { color: 'black' },
              }}
            />

            <Controller
              name="machines"
              control={control}
              rules={{
                validate: (v) => v.length > 0 || 'Please select at least one machine',
              }}
              render={({ field }) => (
                <FormControl
                  size="small"
                  fullWidth
                  error={!!errors.machines}
                  required
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      height: '3.5rem',
                      alignItems: 'center',
                      '& fieldset': { borderColor: 'black' },
                      '&:hover fieldset': { borderColor: 'black' },
                      '&.Mui-focused fieldset': { borderColor: 'orange' },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'black',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-85%) scale(1)',
                      transformOrigin: 'top left',
                      transition: 'all 0.2s ease',
                      pointerEvents: 'none',
                      '&.Mui-focused, &.MuiFormLabel-filled': {
                        color: 'orange',
                        top: '0px',
                        transform: 'translateY(-50%) scale(0.75)',
                      },
                      '&.Mui-error': {
                        color: '#d32f2f',
                      },
                    },
                  }}
                >
                  <InputLabel sx={{ background: '#ededed' }}>Machines</InputLabel>
                  <Select
                    multiple
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.includes('all')) {
                        field.onChange(
                          field.value.length === machines.length
                            ? []
                            : machines.map((m) => m.name)
                        );
                      } else {
                        field.onChange(value);
                      }
                    }}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    <MenuItem value="all">
                      <Checkbox
                        checked={field.value.length === machines.length}
                        sx={{ '&.Mui-checked': { color: '#f47803ff' } }}
                      />
                      <ListItemText primary="All" />
                    </MenuItem>
                    {machines.map((machine) => (
                      <MenuItem key={machine.id} value={machine.name}>
                        <Checkbox
                          checked={field.value.includes(machine.name)}
                          sx={{ '&.Mui-checked': { color: '#f47803ff' } }}
                        />
                        <ListItemText primary={machine.name} />
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.machines && (
                    <FormHelperText>{errors.machines.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
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
