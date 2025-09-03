
import React, { useState, useEffect, useRef,useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { MobileTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { DemoItem } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs'; // Added dayjs import for parsing time strings
import './shiftreg.css';
import { useForm } from 'react-hook-form';
import { CustomDaySelect,convertTo24Hour } from '../Inputfield/inputfield';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker';

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
  const parseTime24To12 = (timeString) => {
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

export default function ShiftEdit({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId, dialogData }) {
    console.log('datasource', datasource);
    console.log('dialogData', dialogData);
    const customDaySelectRef = useRef();
    const startTimeInputRef = useRef(null); // Add ref for start time input
    const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
    const [shiftsmodule, setShiftsmodule] = useState([]);

    const [pickerOpen, setPickerOpen] = useState(false);
    useEffect(() => {
      if (open) {
        setTimeout(() => setPickerOpen(true), 200);
      } else {
        setPickerOpen(false);
      }
    }, [open]);

    useEffect(() => {
      if (open && startTimeInputRef.current) {
        setTimeout(() => {
          if (startTimeInputRef.current) {
            startTimeInputRef.current.focus();
            startTimeInputRef.current.click();
          }
        }, 300);
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
        start_time: null,
        end_time: null,
        break_time: null,
        module: '',
        shift_no: '',
        start_day: '',
        end_day: ''
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
          const startTimeString = shiftForm.start_time.format('hh:mm:ss A');
          const endTimeString = shiftForm.end_time.format('hh:mm:ss A');
          const breakTimeString = shiftForm.break_time.format('HH:mm:ss'); // Use 24-hour format for break time
      
          const start_time = convertTo24Hour(startTimeString);
          const end_time = convertTo24Hour(endTimeString);
          const break_time = breakTimeString; // Break time is already in 24-hour format
          
          console.log('Shift start time:', start_time); // Should print "08:30:00" or similar
          console.log('Shift end time:', end_time);     // Should print "17:45:00" or similar
          console.log('Break time:', break_time);       // Should print "12:00:00" or similar
          const selectedModule = shiftsmodule.find(option => option.value === data.module);
        const moduleLabel = selectedModule ? selectedModule.label : '';
        
      
          // Find the end day label based on the selected value
          // Get the ID of the shift being edited from dialogData.
          // dialogData is expected to be available in this component's scope,
          // typically passed as a prop or derived from context/state when the dialog opens for editing.
          const shiftIdToEdit = dialogData?.id.$oid;
    
          // Assuming 'datasource' is an array containing existing shift data.
          // If 'datasource' is not an array or is undefined, initialize as an empty array.
          let existingShifts = Array.isArray(datasource) ? [...datasource] : [];
    
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
            id: existingIdStructure, // Keep the same id structure (object or string)
            start_time: start_time,
            end_time: end_time,
            break_time: break_time,
            shift_no: data.shift_no,
            start_day: shiftForm.start_day,
            end_day: shiftForm.end_day,
            module: moduleLabel
          };
    
          // Update the existing shift in the array with the new data.
          existingShifts[existingShiftIndex] = updatedShiftData;
          console.log('Shift updated at index:', existingShiftIndex, 'with data:', updatedShiftData);
    
          console.log('existingShifts after update:', existingShifts);
    
          // Prepare the final payload to be sent to the API.
          // This structure aligns with the existing `formData` definition in this file,
          // where 'allShift' contains the updated list of shifts.
          const formData = {
            allShift: existingShifts,
            lastUpdateTs: Date.now()
          };
    
          console.log('Submitted shift data:', JSON.stringify(formData));
          console.log('customerId', customerId);
          const scope = 'SERVER_SCOPE';
          // Make the API call
          
          const response = await shiftadd(formData,customerId,scope);
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
            { value: 'GENERAL', label: 'GENERAL' },
            { value: 'UNIT1', label: 'UNIT1' },
            { value: 'UNIT2', label: 'UNIT2' },
            { value: 'CMS', label: 'CMS' },
        ];
        setShiftsmodule(fallbackOptions);
    }, []); // Empty dependency array - runs only once
      useEffect(() => {
        
        if (!open) {
            reset(defaultShiftForm);
            setShiftForm(defaultShiftForm);
        } else {
            
            if (dialogData) {

                // Convert 24-hour time strings to Dayjs objects for display
                const initialFormState = {
                    // Use the helper function to parse 24-hour times
                    start_time: parseTime24To12(dialogData.start_time),
                    end_time: parseTime24To12(dialogData.end_time),
                    break_time: parseTime24(dialogData.break_time), // Use parseTime24 for break time
                    shift_no: dialogData.shift_no || '',
                    start_day: dialogData.start_day || '',
                    end_day: dialogData.end_day || '',
                    module:dialogData.module,
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

    // Add focus effect for start time field
    useEffect(() => {
        if (open && startTimeInputRef.current) {
            // Use a longer timeout to ensure the dialog is fully rendered
            setTimeout(() => {
                if (startTimeInputRef.current) {
                    startTimeInputRef.current.focus();
                    // Also try to open the time picker
                    startTimeInputRef.current.click();
                }
            }, 300);
        }
    }, [open]);

    // Rest of the component remains the same...
    // (keeping all the existing code for getShiftsAdddata, handleFormChange, handleTimeChange, onSubmit, and the JSX return)

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
            {/* Dialog content remains the same, but update the MobileTimePicker components */}
            <DialogTitle style={{ color: 'black' }}>Edit Shift</DialogTitle>
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
                                <div className={`form_field ${errors.start_time ? 'error-outline' : ''}`}>
                                    <DemoItem className="white-label">
                                        <DesktopTimePicker
                                            {...register("start_time", { required: "Start Time is required" })}
                                            value={shiftForm.start_time}
                                            onChange={(value) => handleTimeChange('start_time', value)}
                                            views={['hours', 'minutes', 'seconds']}
                                            format="hh:mm:ss A"
                                            ampm={true}
                                            label="Start Time *"
                                            error={!!errors.start_time}
                                            InputLabelProps={{ required: true }}
                                            open={pickerOpen}
                                            onOpen={() => setPickerOpen(true)}
                                            onClose={() => setPickerOpen(false)}
                                            slotProps={{
                                              textField: {
                                                inputRef: startTimeInputRef,
                                                autoFocus: true,
                                              }
                                            }}
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
                                    </DemoItem>
                                    {errors.start_time && <div className="mat-error">{errors.start_time.message}</div>}
                                </div>

                                <div className={`form_field${errors.end_time ? 'error-outline' : ''}`}>
                                    <DemoItem>
                                        <DesktopTimePicker
                                            {...register("end_time", { required: "End Time is required" })}
                                            value={shiftForm.end_time}
                                            onChange={(value) => handleTimeChange('end_time', value)}
                                            views={['hours', 'minutes', 'seconds']}
                                            format="hh:mm:ss A"
                                            ampm={true}
                                            label="End Time *"
                                            error={!!errors.end_time}
                                            InputLabelProps={{ required: true }}
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
                                    </DemoItem>
                                    {errors.end_time && <div className="mat-error">{errors.end_time.message}</div>}
                                </div>

                                <div className={`form_field${errors.break_time ? 'error-outline' : ''}`}>
                                    <DemoItem>
                                    <DesktopTimePicker
      {...register("break_time", { required: "Break Time is required" })}
      value={shiftForm.break_time}
      onChange={(value) => handleTimeChange('break_time', value)}
      onBlur={() => trigger('break_time')}
      ampm={false}
      label="Break Time *"
      format="HH:mm:ss"
      views={['hours', 'minutes','seconds']}
      openTo="hours"
      error={!!errors.break_time}
      InputLabelProps={{ required: true }}
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
                                    </DemoItem>
                                    {errors.break_time && <div className="mat-error">Break Time is required</div>}
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
                  {errors.module && <div className="mat-error">Module is required</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.shift_no ? 'error-outline' : ''}`}>
                <TextField
                    {...register("shift_no", { required: "Shift Number is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      },
                      setValueAs: v => v === "" ? "" : Number(v),
                      validate: value => {
                        if (value === "" || value === null || value === undefined) {
                          return "Shift Number is required";
                        }
                        if (isNaN(value)) {
                          return "Shift Number must be a number";
                        }
                        if (value <= 0) {
                          return "Shift Number must be greater than 0";
                        }
                        return true;
                      }
                     })}
                    onBlur={() => trigger('shift_no')}
                    label="Shift Number"
                    type="number"
                    name="shift_no"
                    value={shiftForm.shift_no}
                    onChange={handleFormChange}
                    error={!!errors.shift_no}
                    inputProps={{ maxLength: 100,min:1 }}
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
                  {errors.shift_no && <div className="mat-error">{errors.shift_no.message}</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.start_day ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("start_day", { required: "Start Day is required" })}
                    onBlur={() => trigger('start_day')}
                    ref={customDaySelectRef}
                    name="start_day"
                    value={shiftForm.start_day}
                    onChange={handleFormChange}
                    label="Start Day" 
                    required={true} 
                    error={!!errors.start_day}
                    options={[
                      { value: '1', label: 'Day 1' },
                      { value: '2', label: 'Day 2' },
                    ]}
                  />
                  {errors.start_day && <div className="mat-error">Start Day is required</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.end_day ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("end_day", { required: "End Day is required" })}
                    onBlur={() => trigger('end_day')}
                    ref={customDaySelectRef}
                    name="end_day"
                    value={shiftForm.end_day}
                    onChange={handleFormChange}
                    error={!!errors.end_day}
                    label="End Day"
                    required={true} 
                    options={[
                      { value: '1', label: 'Day 1' },
                      { value: '2', label: 'Day 2' },
                    ]}
                  />
                  {errors.end_day && <div className="mat-error">End Day is required</div>} {/* Changed to div and mat-error */}
                </div>
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