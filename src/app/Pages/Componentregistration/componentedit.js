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
import dayjs from 'dayjs'; // Added dayjs import for parsing time strings
import './componentreg.css';
import { useForm } from 'react-hook-form';
import { CustomDaySelect, convertTo24Hour } from '../Inputfield/inputfield';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CUSTOMER_IDS } from '../../Shared/constants/ids';
import { cleanCustomerId } from '../../Services/app/operatorservice';

// Helper function to parse time strings robustly
// It attempts to parse the string as HH:mm:ss first by prepending a dummy date.
// If that fails, it tries to parse as a full date/time string.
// This ensures the MobileTimePicker receives a valid Dayjs object,
// and the 'format' prop on the picker will ensure only the time is displayed.

const parseTime = (timeString) => {
  if (!timeString) return null;

  let parsed = null;

  // Attempt 1: Parse as HH:mm:ss by prepending a dummy date.
  // This is the most common format for the dialogData times (e.g., "08:00:00").
  parsed = dayjs(`2000-01-01 ${timeString}`, 'YYYY-MM-DD HH:mm:ss');
  if (parsed.isValid()) {
    // Convert from GMT to IST (add 5 hours 30 minutes)
    return parsed.add(5, 'hour').add(30, 'minute');
  }

  // Attempt 2: If the above fails, try parsing as a full date/time string
  // (e.g., "Tue10jun2025 18:30:00 GMT"). 
  parsed = dayjs(timeString);
  if (parsed.isValid()) {
    // Check if the string contains 'GMT' to determine if conversion is needed
    if (timeString.includes('GMT')) {
      // Convert from GMT to IST (add 5 hours 30 minutes)
      return parsed.add(5, 'hour').add(30, 'minute');
    } else {
      // If no GMT indication, assume it's already in local time
      return parsed;
    }
  }

  // Attempt 3: Try parsing with explicit GMT timezone
  parsed = dayjs(timeString + ' GMT');
  if (parsed.isValid()) {
    // Convert from GMT to IST (add 5 hours 30 minutes)
    return parsed.add(5, 'hour').add(30, 'minute');
  }

  // If still not valid, return null
  return null;
};
const parseTime24 = (timeString) => {
  if (!timeString) return null;

  try {
    // Parse using 24-hour format
    const parsed = dayjs(timeString, 'HH:mm:ss', true);

    if (parsed.isValid()) {
      const hours = parsed.hour();
      const minutes = parsed.minute();
      const seconds = parsed.second();

      // Validate 24-hour format bounds
      if (
        hours >= 0 && hours <= 23 &&
        minutes >= 0 && minutes <= 59 &&
        seconds >= 0 && seconds <= 59
      ) {
        // Return the dayjs object instead of formatted string
        return parsed;
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing time:', error);
    return null;
  }
};


export default function ComponentEdit({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId, dialogData }) {
  console.log('datasource', datasource);
  console.log('dialogData', dialogData);
  const customDaySelectRef = useRef();
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);
  const modeSelectRef = useRef();

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (modeSelectRef.current) {
          // For Material-UI Select, we need to trigger focus on the input element
          const selectElement = modeSelectRef.current;
          if (selectElement) {
            selectElement.focus();
            // If the above doesn't work, try clicking to open the dropdown
            selectElement.click();
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [open]);
  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({
    shouldFocusError: true,
    mode: 'onBlur'
  });
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value); // Update the form state in react-hook-form
    trigger(name); // Trigger validation for this field
  };
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
    cycle_time: null,
    handling_time: null,
    setupTime: null,
    item_code: '',
    process_name: '',
  }), []);
  const handleTimeChange = (name, value) => {
    setShiftForm((prevShiftForm) => ({
      ...prevShiftForm,
      [name]: value,
    }));
    setValue(name, value); // Update the form state in react-hook-form
    trigger(name); // Trigger validation for this field

  };
  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
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
      const startTimeString = shiftForm.cycle_time.format('hh:mm:ss A');
      const endTimeString = shiftForm.handling_time.format('hh:mm:ss A');
      const breakTimeString = shiftForm.setupTime.format('hh:mm:ss A'); // Changed to 'hh:mm:ss A' for consistency

      const cycle_time = convertTo24Hour(startTimeString);
      const handling_time = convertTo24Hour(endTimeString);
      const setupTime = convertTo24Hour(breakTimeString);

      console.log('Shift start time:', cycle_time); // Should print "08:30:00" or similar
      console.log('Shift end time:', handling_time);     // Should print "17:45:00" or similar
      console.log('Break time:', setupTime);       // Should print "12:00:00" or similar
      const selectedModule = shiftsmodule.find(option => option.value === data.factor);
      const moduleLabel = selectedModule ? selectedModule.label : '';


      // Find the end day label based on the selected value
      // Get the ID of the shift being edited from dialogData.
      // dialogData is expected to be available in this component's scope,
      // typically passed as a prop or derived from context/state when the dialog opens for editing.
      const shiftIdToEdit = dialogData?.id;

      // Assuming 'datasource' is an array containing existing shift data.
      // If 'datasource' is not an array or is undefined, initialize as an empty array.
      let existingShifts = Array.isArray(datasource) ? [...datasource] : [];
      const isGplast = cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST;
      const normalize = (val) => (val || '').trim().toLowerCase();
      if (isGplast) {
        const duplicate = existingShifts.find((shift) => {
          const itemId =
            typeof shift.id === "object" && shift.id !== null ? shift.id.$oid : shift.id;
          const targetId =
            typeof shiftIdToEdit === "object" && shiftIdToEdit !== null
              ? shiftIdToEdit.$oid
              : shiftIdToEdit;
          if (itemId === targetId) return false;
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
      }
      let existingShiftIndex = -1;
      let existingIdStructure = null; // To preserve the original ID structure (e.g., { $oid: "..." } or string)

      if (shiftIdToEdit) {
        // Find the index of the shift to be updated based on its ID.
        // Handle both string IDs and object IDs (like { $oid: "..." }) as per the concept.
        existingShiftIndex = existingShifts.findIndex(item => {
          const itemId = typeof item.id === 'object' && item.id !== null ? item.id.$oid : item.id;
          const targetId = typeof shiftIdToEdit === 'object' && shiftIdToEdit !== null ? shiftIdToEdit.$oid : shiftIdToEdit;
          return itemId === targetId;
        });

        if (existingShiftIndex !== -1) {
          // If the shift is found, preserve its original ID structure.
          existingIdStructure = existingShifts[existingShiftIndex].id;
        }
      }

      if (existingShiftIndex === -1) {
        // If the shift to edit was not found, it's an error in an edit context.
        console.error('Shift not found for ID:', shiftIdToEdit, 'Cannot update.');
        Swal.fire('Error', 'Shift not found for update. Please try again.', 'error');
        handleClose(); // Close the dialog
        reset(defaultShiftForm); // Reset form state
        return; // Stop the submission process
      }

      // This object represents the updated shift data.
      // Use the preserved ID structure for the updated shift.
      const updatedShiftData = {
        id: existingIdStructure,
        component_name: data.component_name,
        component_number: data.component_number,
        operation_number: data.operation_number,
        operation_name: data.operation_name,
        operation_type: data.operation_type,
        factorval: data.factorval,
        factor: moduleLabel,
        jobcard: data.jobcard,
        drawingcode: data.drawingcode,
        cycle_time: cycle_time,
        handling_time: handling_time,
        setupTime: setupTime,
         ...(cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST && {
          item_code: data.item_code,
          process_name: data.process_name,
        }),
      };

      // Update the existing shift in the array with the new data.
      existingShifts[existingShiftIndex] = updatedShiftData;
      console.log('Shift updated at index:', existingShiftIndex, 'with data:', updatedShiftData);

      console.log('existingShifts after update:', existingShifts);
      // const isDuplicate = existingShifts.some(
      //   shift =>
      //     shift.component_name.trim().toLowerCase() === data.component_name.trim().toLowerCase() &&
      //     shift.component_number.trim().toLowerCase() === data.component_number.trim().toLowerCase()
      // );

      // if (isDuplicate) {
      //   handleClose();
      //   Swal.fire("Duplicate entry", "Component Name and Number already exist", "error");
      //   return;
      // }
      // Prepare the final payload to be sent to the API.
      // This structure aligns with the existing `formData` definition in this file,
      // where 'allShift' contains the updated list of shifts.
      const formData = {
        component: existingShifts,
        lastUpdateTs: Date.now()
      };

      console.log('Submitted shift data:', JSON.stringify(formData));
      console.log('customerId', customerId);
      const scope = 'SERVER_SCOPE';
      // Make the API call

      const response = await shiftadd(formData, customerId, scope);
      console.log('Shift Updated response:', response);

      if (response.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire("Updated Successfully");
      }

      handleClose();
      reset(defaultShiftForm);
    } catch (error) {

      handleClose();
      reset(defaultShiftForm);
      console.error('Error submitting shift data:', error);
      Swal.fire('Error submitting shift data: ' + error.message);
    }
  };
  useEffect(() => {
    // Initialize shiftsmodule when component mounts
    const fallbackOptions = [
      { value: 'Multiplication Factor', label: 'Multiplication Factor' },
      { value: 'Divide Factor', label: 'Divide Factor' },
    ];
    setShiftsmodule(fallbackOptions);
  }, []); // Empty dependency array - runs only once
  useEffect(() => {

    if (!open) {
      reset(defaultShiftForm);
      setShiftForm(defaultShiftForm);
    } else {

      if (dialogData) {

        // Convert 24-hour time strings to Dayjs objects for 12-hour display
        const initialFormState = {
          // Use the helper function to parse 24-hour times
          cycle_time: parseTime24(dialogData.cycle_time),
          handling_time: parseTime24(dialogData.handling_time),
          setupTime: parseTime24(dialogData.setupTime),
          component_name: dialogData.component_name || '',
          component_number: dialogData.component_number || '',
          operation_number: dialogData.operation_number ? Number(dialogData.operation_number) : '',
          operation_name: dialogData.operation_name || '',
          operation_type: dialogData.operation_type || '',
          factorval: dialogData.factorval ? Number(dialogData.factorval) : '',
          factor: dialogData.factor || '',
          jobcard: dialogData.jobcard || '',
          drawingcode: dialogData.drawingcode || '',
          item_code: dialogData.item_code || '',
          process_name: dialogData.process_name || '',
        };

        // Find the correct module value if shiftsmodule is already loaded
        if (shiftsmodule.length > 0 && dialogData.module) {
          const selectedModuleOption = shiftsmodule.find(option => option.label === dialogData.module);
          if (selectedModuleOption) {
            initialFormState.module = selectedModuleOption.value;
          }
        }

        setShiftForm(initialFormState);
        reset(initialFormState);
      } else {
        setShiftForm(defaultShiftForm);
        reset(defaultShiftForm);
      }
    }
  }, [open, reset, defaultShiftForm, dialogData, shiftsmodule]);

  // Rest of the component remains the same...
  // (keeping all the existing code for getShiftsAdddata, handleFormChange, handleTimeChange, onSubmit, and the JSX return)

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
      {/* Dialog content remains the same, but update the MobileTimePicker components */}
      <DialogTitle style={{ color: 'black' }}>Edit Component </DialogTitle>
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
                    inputProps={{ maxLength: 100 }}
                    disabled
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
                  {errors.component_name && <div className="mat-error">{errors.component_name.message}</div>}
                </div>

                {/* Component Number Field */}
                {(cleanCustomerId(customerId) != CUSTOMER_IDS.GPLAST) && (
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
                      disabled
                      name="component_number"
                      value={shiftForm.component_number}
                      onChange={handleFormChange}
                      error={!!errors.component_number}
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
                    {errors.component_number && (
                      <div className="mat-error">{errors.component_number.message}</div>
                    )}
                  </div>
                )}

                {(cleanCustomerId(customerId) === CUSTOMER_IDS.ATECH || cleanCustomerId(customerId) === CUSTOMER_IDS.HITECH) && (<div className={`form_field ${errors.operation_type ? 'error-outline' : ''}`}>
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
                </div>)}
                {/* Operation Number Field 
                <div className={`form_field ${errors.operation_number ? 'error-outline' : ''}`}>
                  <TextField
                   inputRef={modeSelectRef}
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
                  {errors.operation_number && <div className="mat-error">{errors.operation_number.message}</div>}
                </div>   */}

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



                {cleanCustomerId(customerId) === CUSTOMER_IDS.GPLAST && (
                  <>
                    <div className={`form_field ${errors.item_code ? 'error-outline' : ''}`}>
                      <TextField
                        {...register("item_code", {
                          required: "Item Code is required",
                          maxLength: {
                            value: 100,
                            message: "Maximum length is 100 characters",
                          },
                        })}
                        label="Item Code"
                        type="text"
                        name="item_code"
                        disabled
                        value={shiftForm.item_code || ""}
                        onChange={handleFormChange}
                        error={!!errors.item_code}
                        InputLabelProps={{
                          required: true,
                          sx: {
                            color: "black",
                            "&.Mui-focused": { color: "orange" },
                          },
                        }}
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": { borderColor: "black" },
                            "&:hover fieldset": { borderColor: "black" },
                            "&.Mui-focused fieldset": { borderColor: "orange" },
                            "& .MuiOutlinedInput-input": { color: "black" },
                            "&.Mui-focused .MuiOutlinedInput-input": { caretColor: "orange" },
                            "&::placeholder": { color: "black", opacity: 1 },
                          },
                        }}
                      />
                      {errors.item_code && <div className="mat-error">{errors.item_code.message}</div>}
                    </div>
                    <div className={`form_field ${errors.process_name ? "error-outline" : ""}`}>
                      <CustomDaySelect
                        {...register("process_name", { required: "Process Name is required" })}
                        onBlur={() => trigger("process_name")}
                        name="process_name"
                        disabled
                        value={shiftForm.process_name || ""}
                        onChange={handleFormChange}
                        label="Process Name"
                        required={true}
                        options={[
                          { value: "CASTING-DCD", label: "CASTING-DCD" },
                          { value: "TRIMMING-DCD", label: "TRIMMING-DCD" },
                          { value: "TURNING-PMD", label: "TURNING-PMD" },
                          { value: "MILLING-PMD", label: "MILLING-PMD" },
                        ]}
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
                            message: "Maximum length is 100 characters",
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
                            "&.Mui-focused": { color: "orange" },
                          },
                        }}
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": { borderColor: "black" },
                            "&:hover fieldset": { borderColor: "black" },
                            "&.Mui-focused fieldset": { borderColor: "orange" },
                            "& .MuiOutlinedInput-input": { color: "black" },
                            "&.Mui-focused .MuiOutlinedInput-input": { caretColor: "orange" },
                            "&::placeholder": { color: "black", opacity: 1 },
                          },
                        }}
                      />
                      {errors.operation_number && <div className="mat-error">{errors.operation_number.message}</div>}
                    </div>
                  </>
                )}

                <div className={`form_field  ${errors.factorval ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("factorval", {
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
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
                    inputProps={{ maxLength: 100 }}
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



                {/* Rest of the form fields remain the same */}
              </div>
            </LocalizationProvider>
            <div className="form-button text-right" align="end" style={{ marginRight: '10px' }}>
              <Button type="submit" variant="contained" className="filter_btn btn_orange" color="warning">
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