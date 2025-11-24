import React, { useState, useEffect, useRef, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { MobileTimePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { DemoItem } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import './componentreg.css';
import { useForm } from 'react-hook-form';
import { CustomDaySelect } from '../Inputfield/inputfield';
import { shiftgetmodule } from '../../Services/app/shiftservice';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import dayjs from 'dayjs';
import { CUSTOMER_IDS } from '../../Shared/constants/ids';
import { cleanCustomerId } from '../../Services/app/operatorservice';
export default function ComponentAdd({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId }) {
  const customDaySelectRef = useRef();
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);
  
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

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({
    shouldFocusError: true,
    mode: 'onBlur'
  });

  const defaultShiftForm = useMemo(() => ({
    component_name: '',
    component_number: '',
    operation_number: '',
    operation_name: '',
    operation_type: '',
    factorval: '',
    factor: '',
    jobcard: '',
    drawingcode: '',
    cycle_time: dayjs('00:00:00', 'HH:mm:ss'),
    handling_time: dayjs('00:00:00', 'HH:mm:ss'),
    setupTime: dayjs('00:00:00', 'HH:mm:ss')
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);

  useEffect(() => {
    if (!open) {
      reset(defaultShiftForm);
    } else {
      setShiftForm(defaultShiftForm);
    }
  }, [open, reset, defaultShiftForm]);

  useEffect(() => {
    getComponentsAdddata();
  }, []);

  const getComponentsAdddata = async () => {
    try {
      const response = await shiftgetmodule();
      if (Array.isArray(response)) {
        const formattedOptions = response.map((item, index) => ({
          value: item,
          label: item,
        }));
        setShiftsmodule(formattedOptions);
      } else {
        console.error('Unexpected response format:', response);
        setShiftsmodule([]);
      }
    } catch (error) {
      const fallbackOptions = [
        { value: 'Multiplication Factor', label: 'Multiplication Factor' },
        { value: 'Divide Factor', label: 'Divide Factor' },
      ];
      setShiftsmodule(fallbackOptions);
      console.error('Error fetching shifts:', error);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value);
    trigger(name);
  };

  const handleTimeChange = (name, value) => {
    setShiftForm((prevShiftForm) => ({
      ...prevShiftForm,
      [name]: value,
    }));
    setValue(name, value);
    trigger(name);
  };

  const onSubmit = async (data) => {
    try {
      if (
        !data.cycle_time ||
        data.cycle_time.format('HH:mm:ss') === '00:00:00'

      ) {
        handleClose();
        Swal.fire('Error', 'Cycle Time must not be 00:00:00.', 'error');
        return;
      }
      const id = Math.random().toString(36).substr(2, 9); // Generate a new ID

      const currentShiftData = {
        id,
        component_name: data.component_name,
        component_number: data.component_number,
        operation_number: data.operation_number,
        operation_name: data.operation_name,
        operation_type: data.operation_type,
        factorval: data.factorval,
        jobcard: data.jobcard,
        drawingcode: data.drawingcode,
        factor: data.factor,
        cycle_time: data.cycle_time ? data.cycle_time.format('HH:mm:ss') : null,
        handling_time: data.handling_time ? data.handling_time.format('HH:mm:ss') : null,
        setupTime: data.setupTime ? data.setupTime.format('HH:mm:ss') : null
      };

      let existingShifts = Array.isArray(datasource) ? [...datasource] : [];

      // 🔍 Check for duplicate based on component_name & component_number
      const duplicateName = existingShifts.find(
        shift => shift.component_name.trim().toLowerCase() === data.component_name.trim().toLowerCase()
      );
      const duplicateNumber = existingShifts.find(
        shift => shift.component_number.trim().toLowerCase() === data.component_number.trim().toLowerCase()
      );

      if (duplicateNumber) {
        handleClose();
        let errorMessage = "Duplicate entry: Component Number already exists";
        Swal.fire("Duplicate entry", errorMessage, "error");
        return;
      }

      existingShifts.push(currentShiftData);

      const formData = {
        component: existingShifts,
        lastUpdateTs: Date.now()
      };

      console.log('Submitted component data:', JSON.stringify(formData));
      console.log('customerId', customerId);
      const scope = 'SERVER_SCOPE';
      const response = await shiftadd(formData, customerId, scope);

      if (response.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire("Created Successfully");
      }

      handleClose();
      reset(defaultShiftForm);

    } catch (error) {
      handleClose();
      reset(defaultShiftForm);
      console.error('Error submitting data:', error);
      Swal.fire('Error submitting data: ' + error.message);
    }
  };


  return (
    <Dialog open={open} onClose={handleClose} maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
      <DialogTitle style={{ color: 'black' }}>Add Component</DialogTitle>
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
                {/* Component Name Field */}
                <div className={`form_field ${errors.component_name ? 'error-outline' : ''}`}>
                  <TextField
                    inputRef={componentNameRef}
                    {...register("component_name", {
                      required: "Component Name is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      }
                    })}
                    label="Component Name"
                    type="text"
                    name="component_name"
                    value={shiftForm.component_name}
                    onChange={handleFormChange}
                    error={!!errors.component_name}
                    InputLabelProps={{
                      required: true,
                      sx: {
                        color: 'black',
                        '&.Mui-focused': {
                          color: 'orange',
                        },
                      },
                    }}
                    inputProps={{ maxLength: 100 }}
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
                  {errors.component_name && <div className="mat-error">{errors.component_name.message}</div>}
                </div>

                {/* Component Number Field */}
                <div className={`form_field ${errors.component_number ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("component_number", {
                      required: "Component Number is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      }
                    })}
                    label="Component Number"
                    type="text"
                    name="component_number"
                    value={shiftForm.component_number}
                    onChange={handleFormChange}
                    error={!!errors.component_number}
                    InputLabelProps={{
                      required: true,
                      sx: {
                        color: 'black',
                        '&.Mui-focused': {
                          color: 'orange',
                        },
                      },
                    }}
                    inputProps={{ maxLength: 100 }}
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
                  {errors.component_number && (
                    <div className="mat-error">{errors.component_number.message}</div>
                  )}
                </div>

                {(cleanCustomerId(customerId) === CUSTOMER_IDS.ATECH || cleanCustomerId(customerId) === CUSTOMER_IDS.HITECH) && (
     <div className={`form_field ${errors.operation_type ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("operation_type", { required: "Operation type is required" })}
                    onBlur={() => trigger('operation_type')}
                    name="operation_type"
                    value={shiftForm.operation_type}
                    onChange={handleFormChange}
                    label="Operation Type"
                    required={true}
                    options={[
                      { value: 'VMC', label: 'VMC' },
                      { value: 'HMC', label: 'HMC' },
                      { value: 'CNC', label: 'CNC' },
                      { value: 'TC', label: 'TC' },
                    ]}
                    error={!!errors.operation_type}
                    sx={{
                     '& .MuiInputLabel-root': {
                        top: '-6px',
                        backgroundColor: '#ededed',
                        padding: '0 4px',
                      },
                    }}
                  />
                  {errors.operation_type && <div className="mat-error">{errors.operation_type.message}</div>}
                </div>
                )}
               

                {/* Operation Number Field 
                <div className={`form_field ${errors.operation_number ? 'error-outline' : ''}`}>
                  <TextField
                   {...register("operation_number", {
                    required: "Mould Number is required",
                    maxLength: {
                      value: 100,
                      message: "Maximum length is 100 characters"
                    },
                    setValueAs: v => v === "" ? "" : Number(v), // Converts to number or empty
                    validate: value => {
                      if (isNaN(value)) return "Mould Number must be a number";
                      if (value <= 0) return "Mould Number must be greater than 0";
                      return true;
                    }
                  })}
                  
                    label="Mould Number"
                    type="number"
                    name="operation_number"
                    value={shiftForm.operation_number}
                    onChange={handleFormChange}
                    error={!!errors.operation_number}
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
                  {errors.operation_number && <div className="mat-error">{errors.operation_number.message}</div>}
                </div>  */}

                {/* Operation Name Field 
             
                 <div className={`form_field  ${errors.operation_name ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("operation_name", { required: "Mould Name is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      },
                      validate: value =>
                        /^[a-zA-Z0-9\s]*$/.test(value) || "Special characters are not allowed"
                    })}
                    onBlur={() => trigger('operation_name')}
                    label="Mould Name"
                    type="text"
                    name="operation_name"
                    value={shiftForm.operation_name}
                    onChange={handleFormChange}
                    error={!!errors.operation_name}
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
                  {errors.operation_name && (
  <div className="mat-error">{errors.operation_name.message}</div>
)}
                </div>  */}



                <div className={`form_field  ${errors.factorval ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("factorval", {
                      maxLength: {
                        value: 4,
                        message: "Maximum length is 4 digits"
                      },
                      setValueAs: v => v === "" ? "" : Number(v),
                      validate: value => {
                        if (value === "" || value === null || value === undefined) {
                          return "Factor is required";
                        }
                        if (isNaN(value)) {
                          return "Factor must be a number";
                        }
                        if (value <= 0) {
                          return "Factor must be greater than 0";
                        }
                        if (value.toString().length > 4) {
                          return "Maximum 4 digits allowed";
                        }
                        return true;
                      }
                    })}

                    onBlur={() => trigger('factorval')}
                    label="Factor Value"
                    type="number"
                    name="factorval"
                    value={shiftForm.factorval}
                    onChange={handleFormChange}
                    error={!!errors.factorval}
                    inputProps={{ maxLength: 4, min: 1 }}
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
                  {errors.factorval && <div className="mat-error">{errors.factorval.message}</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.factor ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("factor", { required: "Factor is required" })}
                    onBlur={() => trigger('factor')}
                    ref={customDaySelectRef}
                    name="factor"
                    value={shiftForm.factor}
                    onChange={handleFormChange}
                    label="Select Factor"
                    required={true}
                    options={shiftsmodule}
                    error={!!errors.factor}
                  />
                  {errors.factor && <div className="mat-error">{errors.factor.message}</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.cycle_time ? 'error-outline' : ''}`}>
                  <DemoItem className="white-label">
                    <TimePicker
                      {...register("cycle_time", {
                        required: "Cycle Time is required",
                        
                        // validate: (value, formValues) => {
                        //   if (customerTitle === "ATECH") {
                        //     return true;
                        //   }
                        //   const cycleTime = value;
                        //   const handlingTime = formValues.handling_time;
                        //   const setupTime = formValues.setupTime;

                        //   if (cycleTime && cycleTime.isValid()) {
                        //     if (handlingTime && handlingTime.isValid() && cycleTime.isSame(handlingTime, 'second')) {
                        //       return "Cycle Time cannot be same as Handling Time";
                        //     }
                        //     if (setupTime && setupTime.isValid() && cycleTime.isSame(setupTime, 'second')) {
                        //       return "Cycle Time cannot be same as Setup Time";
                        //     }
                        //   }
                        //   return true;
                        // }
                      })}
                      onBlur={() => trigger('cycle_time')}
                      value={shiftForm.cycle_time}
                      onChange={(value) => {
                        handleTimeChange('cycle_time', value);
                        if (value && value.isValid()) {
                          trigger('handling_time');
                          trigger('setupTime');
                        }
                      }}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss"
                      label="Cycle Time *"
                      ampm={false}
                      error={!!errors.cycle_time}
                      InputLabelProps={{ required: true }}
                      slotProps={{
                        textField: {
                          placeholder: "HH:mm:ss",   // allows typing manually
                        }
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: 'black' },
                          '&:hover fieldset': { borderColor: 'black' },
                          '&.Mui-focused fieldset': { borderColor: 'orange' },
                          '& .MuiOutlinedInput-input': { color: 'black' },
                          '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
                          '&::placeholder': { color: 'black', opacity: 1 },
                        },
                      }}
                    />
                  </DemoItem>
                  {errors.cycle_time && <div className="mat-error">{errors.cycle_time.message}</div>}
                </div>
                <div className={`form_field  ${errors.handling_time ? 'error-outline' : ''}`}>
                  <DemoItem>
                    <TimePicker
                      {...register("handling_time", {
                        required: "Handling Time is required",
                        // validate: (value, formValues) => {
                        //   if (customerTitle === "ATECH") {
                        //     return true;
                        //   }
                        //   const handlingTime = value;
                        //   const cycleTime = formValues.cycle_time;
                        //   const setupTime = formValues.setupTime;

                        //   if (handlingTime && handlingTime.isValid()) {
                        //     if (cycleTime && cycleTime.isValid() && handlingTime.isSame(cycleTime, 'second')) {
                        //       return "Handling Time cannot be same as Cycle Time";
                        //     }
                        //     if (setupTime && setupTime.isValid() && handlingTime.isSame(setupTime, 'second')) {
                        //       return "Handling Time cannot be same as Setup Time";
                        //     }
                        //   }
                        //   return true;
                        // }
                      })}
                      onBlur={() => trigger('handling_time')}
                      value={shiftForm.handling_time}
                      onChange={(value) => {
                        handleTimeChange('handling_time', value);
                        if (value && value.isValid()) {
                          trigger('cycle_time');
                          trigger('setupTime');
                        }
                      }}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss"
                      ampm={false}
                      label="Handling Time *"
                      error={!!errors.handling_time}
                      InputLabelProps={{ required: true }}
                      slotProps={{
                        textField: {
                          placeholder: "HH:mm:ss",   // ✅ allows manual typing
                        }
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: 'black' },
                          '&:hover fieldset': { borderColor: 'black' },
                          '&.Mui-focused fieldset': { borderColor: 'orange' },
                          '& .MuiOutlinedInput-input': { color: 'black' },
                          '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
                          '&::placeholder': { color: 'black', opacity: 1 },
                        },
                      }}
                    />
                  </DemoItem>
                  {errors.handling_time && <div className="mat-error">{errors.handling_time.message}</div>}
                </div>
                <div className={`form_field  ${errors.setupTime ? 'error-outline' : ''}`}>
                  <DemoItem>

                    <TimePicker
                      {...register("setupTime", {
                        required: "Setup Time is required",
                        // validate: (value, formValues) => {
                        //   if (customerTitle === "ATECH") {
                        //     return true;
                        //   }
                        //   const setupTime = value;
                        //   const cycleTime = formValues.cycle_time;
                        //   const handlingTime = formValues.handling_time;

                        //   if (setupTime && setupTime.isValid()) {
                        //     if (cycleTime && cycleTime.isValid() && setupTime.isSame(cycleTime, 'second')) {
                        //       return "Setup Time cannot be same as Cycle Time";
                        //     }
                        //     if (handlingTime && handlingTime.isValid() && setupTime.isSame(handlingTime, 'second')) {
                        //       return "Setup Time cannot be same as Handling Time";
                        //     }
                        //   }
                        //   return true;
                        // }
                      })}
                      onBlur={() => trigger('setupTime')}
                      value={shiftForm.setupTime}
                      onChange={(value) => {
                        handleTimeChange('setupTime', value);
                        if (value && value.isValid()) {
                          trigger('cycle_time');
                          trigger('handling_time');
                        }
                      }}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss"
                      label="Setup Time *"
                      ampm={false}
                      error={!!errors.setupTime}
                      InputLabelProps={{ required: true }}
                      slotProps={{
                        textField: {
                          placeholder: "HH:mm:ss",   // ✅ allows manual typing
                        }
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: 'black' },
                          '&:hover fieldset': { borderColor: 'black' },
                          '&.Mui-focused fieldset': { borderColor: 'orange' },
                          '& .MuiOutlinedInput-input': { color: 'black' },
                          '&.Mui-focused .MuiOutlinedInput-input': { caretColor: 'orange' },
                          '&::placeholder': { color: 'black', opacity: 1 },
                        },
                      }}
                    />

                  </DemoItem>
                  {errors.setupTime && <div className="mat-error">{errors.setupTime.message}</div>}
                </div>


                {/* Operation Number Field 
                <div className={`form_field ${errors.jobcard ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("jobcard", { required: "Job Card is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      },
                      validate: value =>
                        /^[a-zA-Z0-9\s]*$/.test(value) || "Special characters are not allowed" })}
                    label="Raw Material"
                    type="text"
                    name="jobcard"
                    value={shiftForm.jobcard}
                    onChange={handleFormChange}
                    error={!!errors.jobcard}
                    inputProps={{ maxLength: 100}}
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
                  {errors.jobcard && <div className="mat-error">{errors.jobcard.message}</div>}
                </div>
                <div className={`form_field ${errors.drawingcode ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("drawingcode", { required: "Drawingcode is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      },
                      validate: value => {
                        if (isNaN(value)) return "Drawing code  must be a number";
                        if (Number(value) <= 0) return "Drawing code must be greater than 0";
                        return true;
                      }
                     })}
                    label="Raw Material Code"
                    type="number"
                    name="drawingcode"
                    value={shiftForm.drawingcode}
                    onChange={handleFormChange}
                    error={!!errors.drawingcode}
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
                  {errors.drawingcode && <div className="mat-error">{errors.drawingcode.message}</div>}
                </div>  */}

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