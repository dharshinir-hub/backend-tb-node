import React, { useState, useEffect, useRef,useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
// import dayjs from 'dayjs';
import './reasonreg.css';
import { useForm } from 'react-hook-form';
import { convertTo24Hour } from '../Inputfield/inputfield';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CustomDaySelect } from '../Inputfield/inputfield';

export default function ReasonAdd({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId }) {
    console.log('datasource', datasource);
    const customDaySelectRef = useRef();

  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);
  const [shiftsmode, setShiftsmode] = useState([]);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({
    shouldFocusError: true,
    mode: 'onBlur'
  });

  const defaultShiftForm = useMemo(() => ({
    reason: '',
    code: '',
    mode: '',
    module:'',  
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);

  useEffect(() => {
    const fallbackOptions = [
        { value: 'General', label: 'General' },
        { value: 'Pump', label: 'Pump'},
        { value: 'Valve', label: 'Valve' },
      ];
      setShiftsmodule(fallbackOptions);
      const fallbackOptions1 = [
        { value: 'Men', label: 'Men' },
        { value: 'Machine', label: 'Machine'},
        { value: 'MotherNature', label: 'MotherNature' },
        { value: 'Material', label: 'Material' },
        { value: 'Method', label: 'Method' },
        { value: 'Measurement', label: 'Measurement' },
      ];
      setShiftsmode(fallbackOptions1);
    if (!open) {
      reset(defaultShiftForm);
    } else {
      setShiftForm(defaultShiftForm);
    }
  }, [open, reset, defaultShiftForm]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value);
    trigger(name);
  };

  const onSubmit = async (data) => {
    try {
      // Generate unique ID for new reason
      const id = Math.random().toString(36).substr(2, 9);
  
      // Create reason data object
      const reasonData = {
        id,
        reason: shiftForm.reason?.trim().toLowerCase(),
        code: shiftForm.code?.trim().toLowerCase(),
        mode: shiftForm.mode,
        module: shiftForm.module
      };
  
      // Get existing reasons array or initialize empty array
      let existingReasons = Array.isArray(datasource) ? [...datasource] : [];
  
      // Check for duplicate reason or code (case-insensitive)
      const isDuplicate = existingReasons.some(item => 
        item.reason?.trim().toLowerCase() === reasonData.reason ||
        item.code?.trim().toLowerCase() === reasonData.code
      );
  
      if (isDuplicate) {
        handleClose();
        Swal.fire('Error', 'Duplicate Reason or Code is not allowed.', 'error');
        return;
      }
  
      // Add new reason
      existingReasons.push(reasonData);
  
      // Prepare payload for API
      const formData = {
        reason: existingReasons,
        lastUpdateTs: Date.now()
      };
  
      const scope = 'SERVER_SCOPE';
      const response = await shiftadd(formData, customerId, scope);
  
      if (response.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire("Reason Created Successfully");
      }
  
      handleClose();
      reset(defaultShiftForm);
  
    } catch (error) {
      console.error('Error submitting reason data:', error);
      Swal.fire('Error submitting reason data: ' + error.message);
      handleClose();
      reset(defaultShiftForm);
    }
  };
  
  const componentNameRef = useRef();

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (componentNameRef.current) {
          componentNameRef.current.focus();
        }
      }, 100); // reduced delay for better responsiveness
    
      return () => clearTimeout(timer); // cleanup on unmount
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
      <DialogTitle style={{ color: 'black' }}>Add Reason</DialogTitle>
      <div className="close_modal">
        <Tooltip title="Close">
          <IconButton aria-label="close" onClick={handleClose} style={{ backgroundColor: '#ffffff' }}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </div>
      <div className="machinedialog">
        <div className="filter_sec">
          <form onSubmit={handleSubmit(onSubmit)} className="form_sec shift_form" autoComplete="off">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="form_sec_fields">              
                
                <div className={`form_field  ${errors.reason ? 'error-outline' : ''}`}>
                  <TextField
                  inputRef={componentNameRef}
                    {...register("reason", { required: "Reason is required",                      
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      }, validate: value =>
                        /^[a-zA-Z0-9\s]*$/.test(value) || "Special characters are not allowed"
                    
                        })}
                    onBlur={() => trigger('reason')}
                    label="Reason"
                    type="text"
                    name="reason"
                    value={shiftForm.reason}
                    onChange={handleFormChange}
                    error={!!errors.reason}
                    inputProps={{ maxLength: 100 }}
                    InputLabelProps={{
                      required: true, 
                      sx: {
                        color: 'black',
                        '&.Mui-focused': {
                          color: 'orange',
                        },
                      },
                    }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'black',
                        },
                        '&:hover fieldset': {
                          borderColor: 'black',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'orange',
                        },
                        '& .MuiOutlinedInput-input': {
                          color: 'black',
                        },
                        '&.Mui-focused .MuiOutlinedInput-input': {
                          caretColor: 'orange',
                        },
                        '&::placeholder': {
                          color: 'black',
                          opacity: 1,
                        },
                      },
                    }}
                  />
                  {errors.reason && <div className="mat-error">{errors.reason.message}</div>}
                </div>
                <div className={`form_field  ${errors.code ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("code", { required: "Code is required" ,
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      } ,
                      validate: value => {
                        if (isNaN(value)) return "Code must be a number";
                        if (Number(value) <= 0) return "Code must be greater than 0";
                        return true;
                      }
                    })}
                    onBlur={() => trigger('code')}
                    label="Code"
                    type="number"
                    name="code"
                    value={shiftForm.code}
                    onChange={handleFormChange}
                    error={!!errors.code}
                    inputProps={{ maxLength: 100, min: 1 }}
                    InputLabelProps={{
                      required: true, 
                      sx: {
                        color: 'black',
                        '&.Mui-focused': {
                          color: 'orange',
                        },
                      },
                    }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'black',
                        },
                        '&:hover fieldset': {
                          borderColor: 'black',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'orange',
                        },
                        '& .MuiOutlinedInput-input': {
                          color: 'black',
                        },
                        '&.Mui-focused .MuiOutlinedInput-input': {
                          caretColor: 'orange',
                        },
                        '&::placeholder': {
                          color: 'black',
                          opacity: 1,
                        },
                      },
                    }}
                  />
                  {errors.code && <div className="mat-error">{errors.code.message}</div>}
                </div>              
                <div className={`form_field  ${errors.mode ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("mode", { required: "Mode is required" })}
                    onBlur={() => trigger('mode')}
                    ref={customDaySelectRef}
                    name="mode"
                    value={shiftForm.mode}
                    onChange={handleFormChange}
                    label="Select Mode"
                    required={true}
                    options={shiftsmode}
                    error={!!errors.mode}
                  />
                  {errors.mode && <div className="mat-error">Mode is required</div>}
                </div>
                <div className={`form_field  ${errors.module ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("module", { required: "Module is required" })}
                    onBlur={() => trigger('module')}
                    ref={customDaySelectRef}
                    name="module"
                    value={shiftForm.module}
                    onChange={handleFormChange}
                    label="Select Module"
                    required={true}
                    options={shiftsmodule}
                    error={!!errors.module}
                  />
                  {errors.module && <div className="mat-error">Module is required</div>}
                </div>
              </div>
            </LocalizationProvider>
            <div className="form-button text-right" align="end" style={{ marginRight: '10px' }}>
              <Button type="submit" variant="contained" className="filter_btn btn_orange" color="warning" >
                Save
              </Button>
            </div>
            <br></br>
          </form>
        </div>
      </div>
    </Dialog>
  );
}
