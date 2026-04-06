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
import { customerbasedshift, shiftadd } from '../../Services/app/masterservice';
import dayjs from 'dayjs';
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
    setupTime: dayjs('00:00:00', 'HH:mm:ss'),
    item_code: '',
    process_name: '',
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const [processGroupOptions, setProcessGroupOptions] = useState([]);

  useEffect(() => {
    if (!open) {
      reset(defaultShiftForm);
    } else {
      setShiftForm(defaultShiftForm);
    }
  }, [open, reset, defaultShiftForm]);

  useEffect(() => {
    getComponentsAdddata();
    if (cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID) {
      fetchProcessGroups();
    }
  }, []);

  const fetchProcessGroups = async () => {
    const key = 'processgroups';
    try {
      const data = await customerbasedshift(customerId, key);
      const allProcessGroups = data[0]?.value || [];
      const mappedGroups = allProcessGroups.map((item) => ({
        value: item.groupName,
        label: item.groupName
      }));
      setProcessGroupOptions(mappedGroups);
    } catch (error) {
      console.error("Error fetching reason groups:", error);
      setProcessGroupOptions([]);
    }
  };

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
      const timeFields = [
        { key: "cycle_time", label: "Cycle Time" },
        { key: "handling_time", label: "Handling Time" },
        { key: "setupTime", label: "Setup Time" },
      ];
      for (const { key, label } of timeFields) {
        const value = data[key];
        if (!value || !dayjs(value).isValid()) {
          handleClose();
          Swal.fire({
            icon: "error",
            title: "Invalid Input",
            text: `${label} has an invalid or incomplete time format.`,
          });
          return;
        }
        if (key === "cycle_time" && dayjs(value).format("HH:mm:ss") === "00:00:00") {
          handleClose();
          Swal.fire({
            icon: "error",
            title: "Invalid Input",
            text: "Cycle Time must not be 00:00:00.",
          });
          return;
        }
      }
      const safeFormat = (v) => dayjs(v).format("HH:mm:ss");
      const id = Math.random().toString(36).substr(2, 9);
      const isGplast = cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID;

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
        cycle_time: safeFormat(data.cycle_time),
        handling_time: safeFormat(data.handling_time),
        setupTime: safeFormat(data.setupTime),
        ...(cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID && {
          item_code: data.item_code,
          process_name: data.process_name,
        }),
      };

      let existingShifts = Array.isArray(datasource) ? [...datasource] : [];
      const normalize = (val) => (val || "").trim().toLowerCase();
      if (isGplast) {
        const duplicate = existingShifts.find((shift) => {
          return (
            normalize(shift.component_name) === normalize(data.component_name) &&
            normalize(shift.item_code) === normalize(data.item_code) &&
            normalize(shift.process_name) === normalize(data.process_name) &&
            normalize(shift.operation_number) === normalize(data.operation_number)
          );
        });

        if (duplicate) {
          handleClose();
          Swal.fire(
            "Duplicate entry",
            "Component with same Item Code and Process Name already exists",
            "error"
          );
          return;
        }
      } else {
        const duplicateNumber = existingShifts.find(
          (shift) =>
            normalize(shift.component_number) === normalize(data.component_number)
        );
        if (duplicateNumber) {
          handleClose();
          Swal.fire(
            "Duplicate entry",
            "Component Number already exists",
            "error"
          );
          return;
        }
      }

      existingShifts.push(currentShiftData);

      const formData = {
        component: existingShifts,
        lastUpdateTs: Date.now(),
      };

      console.log("Submitted component data:", JSON.stringify(formData));
      const scope = "SERVER_SCOPE";
      const response = await shiftadd(formData, customerId, scope);

      Swal.fire(response.msg || "Component created successfully!", "", "success");

      handleClose();
      reset(defaultShiftForm);
    } catch (error) {
      console.error("Error submitting data:", error);
      handleClose();
      reset(defaultShiftForm);
      Swal.fire("Error", `Error submitting data: ${error.message}`, "error");
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
                {(cleanCustomerId(customerId) != window._env_.GPLAST_CUSTOMER_ID) && (
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
                )}
                {(cleanCustomerId(customerId) === window._env_.ATECH_CUSTOMER_ID || cleanCustomerId(customerId) === window._env_.HITECH_CUSTOMER_ID) && (
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



                {cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID && (
                  <>
                    <div className={`form_field ${errors.item_code ? 'error-outline' : ''}`}>
                      <TextField
                        {...register("item_code", {
                          required: "Item Code is required",
                          maxLength: {
                            value: 100,
                            message: "Maximum length is 100 characters"
                          },
                        })}
                        label="Item Code"
                        type="text"
                        name="item_code"
                        value={shiftForm.item_code || ""}
                        onChange={handleFormChange}
                        error={!!errors.item_code}
                        InputLabelProps={{
                          required: true,
                          sx: {
                            color: "black",
                            "&.Mui-focused": {
                              color: "orange",
                            },
                          },
                        }}
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor: "black",
                            },
                            "&:hover fieldset": {
                              borderColor: "black",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "orange",
                            },
                            "& .MuiOutlinedInput-input": {
                              color: "black",
                            },
                            "&.Mui-focused .MuiOutlinedInput-input": {
                              caretColor: "orange",
                            },
                            "&::placeholder": {
                              color: "black",
                              opacity: 1,
                            },
                          },
                        }}
                      />
                      {errors.item_code && (
                        <div className="mat-error">{errors.item_code.message}</div>
                      )}
                    </div>
                    <div className={`form_field ${errors.process_name ? "error-outline" : ""}`}>
                      <CustomDaySelect
                        {...register("process_name", { required: "Process Name is required" })}
                        onBlur={() => trigger("process_name")}
                        name="process_name"
                        value={shiftForm.process_name || ""}
                        onChange={handleFormChange}
                        label="Process Name"
                        required={true}
                        options={processGroupOptions}
                        error={!!errors.process_name}
                      />
                      {errors.process_name && (
                        <div className="mat-error">{errors.process_name.message}</div>
                      )}
                    </div>
                    <div className={`form_field ${errors.operation_number ? 'error-outline' : ''}`}>
                      <TextField
                        {...register("operation_number", {
                          required: "Operation Number is required",
                          maxLength: {
                            value: 100,
                            message: "Maximum length is 100 characters"
                          },
                        })}
                        label="Operation Number"
                        type="text"
                        name="operation_number"
                        value={shiftForm.operation_number || ""}
                        onChange={handleFormChange}
                        error={!!errors.operation_number}
                        InputLabelProps={{
                          required: true,
                          sx: {
                            color: "black",
                            "&.Mui-focused": {
                              color: "orange",
                            },
                          },
                        }}
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor: "black",
                            },
                            "&:hover fieldset": {
                              borderColor: "black",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "orange",
                            },
                            "& .MuiOutlinedInput-input": {
                              color: "black",
                            },
                            "&.Mui-focused .MuiOutlinedInput-input": {
                              caretColor: "orange",
                            },
                            "&::placeholder": {
                              color: "black",
                              opacity: 1,
                            },
                          },
                        }}
                      />
                      {errors.operation_number && (
                        <div className="mat-error">{errors.operation_number.message}</div>
                      )}
                    </div>
                  </>
                )}
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
                {/* ===== Cycle Time ===== */}
                <div className={`form_field ${errors.cycle_time ? "error-outline" : ""}`}>
                  <DemoItem className="white-label">
                    <TimePicker
                      {...register("cycle_time", {
                        required: "Cycle Time is required",
                        validate: (value) => {
                          if (!value) return "Cycle Time is required";
                          if (!dayjs(value).isValid()) return "Invalid time format";
                          return true;
                        },
                      })}
                      onBlur={() => trigger("cycle_time")}
                      value={shiftForm.cycle_time}
                      onChange={(value) => handleTimeChange("cycle_time", value)}
                      views={["hours", "minutes", "seconds"]}
                      format="HH:mm:ss"
                      ampm={false}
                      label="Cycle Time *"
                      error={!!errors.cycle_time}
                      slotProps={{
                        textField: {
                          helperText: errors.cycle_time?.message,
                        },
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: errors.cycle_time ? "red" : "black",
                          },
                          "&:hover fieldset": { borderColor: "black" },
                          "&.Mui-focused fieldset": {
                            borderColor: errors.cycle_time ? "red" : "orange",
                          },
                          "& .MuiOutlinedInput-input": { color: "black" },
                          "&.Mui-focused .MuiOutlinedInput-input": { caretColor: "orange" },
                        },
                      }}
                    />
                  </DemoItem>
                </div>

                {/* ===== Handling Time ===== */}
                <div className={`form_field ${errors.handling_time ? "error-outline" : ""}`}>
                  <DemoItem>
                    <TimePicker
                      {...register("handling_time", {
                        required: "Handling Time is required",
                        validate: (value) => {
                          if (!value) return "Handling Time is required";
                          if (!dayjs(value).isValid()) return "Invalid time format";
                          return true;
                        },
                      })}
                      onBlur={() => trigger("handling_time")}
                      value={shiftForm.handling_time}
                      onChange={(value) => handleTimeChange("handling_time", value)}
                      views={["hours", "minutes", "seconds"]}
                      format="HH:mm:ss"
                      ampm={false}
                      label="Handling Time *"
                      error={!!errors.handling_time}
                      slotProps={{
                        textField: {
                          helperText: errors.handling_time?.message,
                        },
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: errors.handling_time ? "red" : "black",
                          },
                          "&:hover fieldset": { borderColor: "black" },
                          "&.Mui-focused fieldset": {
                            borderColor: errors.handling_time ? "red" : "orange",
                          },
                          "& .MuiOutlinedInput-input": { color: "black" },
                          "&.Mui-focused .MuiOutlinedInput-input": { caretColor: "orange" },
                        },
                      }}
                    />
                  </DemoItem>
                </div>

                {/* ===== Setup Time ===== */}
                <div className={`form_field ${errors.setupTime ? "error-outline" : ""}`}>
                  <DemoItem>
                    <TimePicker
                      {...register("setupTime", {
                        required: "Setup Time is required",
                        validate: (value) => {
                          if (!value) return "Setup Time is required";
                          if (!dayjs(value).isValid()) return "Invalid time format";
                          return true;
                        },
                      })}
                      onBlur={() => trigger("setupTime")}
                      value={shiftForm.setupTime}
                      onChange={(value) => handleTimeChange("setupTime", value)}
                      views={["hours", "minutes", "seconds"]}
                      format="HH:mm:ss"
                      ampm={false}
                      label="Setup Time *"
                      error={!!errors.setupTime}
                      slotProps={{
                        textField: {
                          helperText: errors.setupTime?.message,
                        },
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": {
                            borderColor: errors.setupTime ? "red" : "black",
                          },
                          "&:hover fieldset": { borderColor: "black" },
                          "&.Mui-focused fieldset": {
                            borderColor: errors.setupTime ? "red" : "orange",
                          },
                          "& .MuiOutlinedInput-input": { color: "black" },
                          "&.Mui-focused .MuiOutlinedInput-input": { caretColor: "orange" },
                        },
                      }}
                    />
                  </DemoItem>
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