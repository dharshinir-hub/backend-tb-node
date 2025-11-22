import { useState, useEffect, useRef, useMemo } from 'react';
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
import { createMachineGroupNotificationGroup } from '../../Services/app/machineGroupNotificationService';

export default function MachineGroupAdd({
  open,
  handleClose,
  handleAdd,
  dialogOpenCount,
  datasource,
  setDatasource,
  customerId,
}) {
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const componentNameRef = useRef();

  const [machines, setMachines] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultForm = useMemo(
    () => ({
      name: '',
      machines: [],
    }),
    []
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    trigger,
    formState: { errors },
  } = useForm({
    defaultValues: defaultForm,
    mode: 'onBlur',
  });

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

  useEffect(() => {
    if (!open) reset(defaultForm);
  }, [open, reset, defaultForm]);
  
const onSubmit = async (data) => {
  if (isSubmitting) return;
  setIsSubmitting(true);
  try {
    const id = Math.random().toString(36).substr(2, 9);
    let existingGroups = Array.isArray(datasource) ? [...datasource] : [];
    let lastCode = 0;

    if (existingGroups.length > 0) {
      lastCode = Math.max(
        ...existingGroups.map((item) => parseInt(item.code, 10) || 0)
      );
    }
    const autoCode = lastCode + 1;
    const newGroup = {
      id,
      code: String(autoCode),
      name: data.name.trim(),
      machines: data.machines,
    };

    const isDuplicate = existingGroups.some(
      (item) => item.name?.trim().toLowerCase() === newGroup.name.toLowerCase()
    );
    if (isDuplicate) {
      Swal.fire('Error', 'Duplicate Machine Group is not allowed.', 'error');
      setIsSubmitting(false);
      return;
    }

    existingGroups.push(newGroup);

    const formData = {
      machinegroups: existingGroups,
      lastUpdateTs: Date.now(),
    };

    const scope = 'SERVER_SCOPE';
    const response = await shiftadd(formData, customerId, scope);

    try {
      const currentUserId = localStorage.getItem("userID");
      await createMachineGroupNotificationGroup(newGroup, currentUserId, customerId);
      
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Machine Group and Notification Group Created Successfully',
        timer: 1500,
        showConfirmButton: false,
      });
      
    } catch (notificationError) {
      console.error('Failed to create notification group:', notificationError);
      const rollbackGroups = existingGroups.filter(group => group.id !== id);
      const rollbackFormData = {
        machinegroups: rollbackGroups,
        lastUpdateTs: Date.now(),
      };
      await shiftadd(rollbackFormData, customerId, scope);
      Swal.fire({
        icon: 'error',
        title: 'Partial Failure',
        text: 'Machine Group created but failed to create notification group. Machine Group has been rolled back.',
        timer: 2000,
      });
      setIsSubmitting(false);
      return;
    }

    handleClose();
    reset(defaultForm);
    setDatasource(existingGroups);
    if (handleAdd) handleAdd();
  } catch (error) {
    console.error('Error submitting machine group:', error);
    Swal.fire('Error', 'Failed to create machine group: ' + error.message, 'error');
  } finally {
    setIsSubmitting(false);
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
      <DialogTitle style={{ color: 'black' }}>Add Machine Group</DialogTitle>

      <div className="close_modal">
        <Tooltip title="Close">
          <IconButton
            aria-label="close"
            onClick={handleClose}
            style={{ backgroundColor: '#ffffff' }}
            disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              rules={{ validate: (v) => v.length > 0 || 'Please select at least one machine' }}
              render={({ field }) => (
                <FormControl
                  size="small"
                  fullWidth
                  error={!!errors.machines}
                  required
                  disabled={isSubmitting}
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
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-85%) scale(1)',
                      transition: 'all 0.2s ease',
                      pointerEvents: 'none',

                      '&.Mui-focused': {
                        color: 'orange',
                        top: '0px',
                        transform: 'translateY(-50%) scale(0.75)',
                      },

                      '&.Mui-error': {
                        color: '#d32f2f',
                      },

                      '&.MuiFormLabel-filled': {
                        top: '0px',
                        transform: 'translateY(-50%) scale(0.75)',
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}