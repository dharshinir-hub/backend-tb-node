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
// import dayjs from 'dayjs';
import './shiftreg.css';
import { useForm } from 'react-hook-form';
import { CustomDaySelect,convertTo24Hour } from '../Inputfield/inputfield';
import { shiftgetmodule } from '../../Services/app/shiftservice';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import dayjs from 'dayjs';
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker';

export default function ShiftAdd({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId }) {
    console.log('datasource', datasource);
    //console.log('setDatasource', setDatasource);
  const customDaySelectRef = useRef();
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setTimeout(() => setPickerOpen(true), 200);
    } else {
      setPickerOpen(false);
    }
  }, [open]);
  //const customerId = localStorage.getItem('customerId');
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({
    shouldFocusError: true,
    mode: 'onBlur'
  });

  const defaultShiftForm = useMemo(() => ({
    start_time: null,
    end_time: null,
    break_time: null,
    module: '',
    shift_no: '',
    start_day: '',
    end_day: ''
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const startTimeInputRef = useRef(null);


  useEffect(() => {
    if (!open) {
      reset(defaultShiftForm); // Reset form state and validation errors when the dialog is closed
    } else {
      setShiftForm(defaultShiftForm); // Set form state to default when the dialog opens
    }
  }, [open, reset, defaultShiftForm]);


  useEffect(() => {
    getShiftsAdddata();
  }, []);
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
  //Get module dropdown values
  const getShiftsAdddata = async () => {
    try {
      const response = await shiftgetmodule();
      if (Array.isArray(response)) {
        const formattedOptions = response.map((item, index) => ({
          value: index + 1,
          label: item,
        }));
        setShiftsmodule(formattedOptions);
      } else {
        console.error('Unexpected response format:', response);
        setShiftsmodule([]);
      }
    } catch (error) {
      const fallbackOptions = [
        { value: 'GENERAL', label: 'GENERAL' },
        { value: 'UNIT1', label: 'UNIT1' },
        { value: 'UNIT2', label: 'UNIT2' },
        { value: 'CMS', label: 'CMS' },
      ];
      setShiftsmodule(fallbackOptions);
      console.error('Error fetching shifts:', error);
    }
  };

 
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value); // Update the form state in react-hook-form
    trigger(name); // Trigger validation for this field
  };

  const handleTimeChange = (name, value) => {
    setShiftForm((prevShiftForm) => ({
      ...prevShiftForm,
      [name]: value,
    }));
    setValue(name, value); // Update the form state in react-hook-form
    trigger(name); // Trigger validation for this field
  };

  //submit event 
  const onSubmit = async (data) => {
    try {
      const startTimeString = shiftForm.start_time.format('hh:mm:ss A');
      const endTimeString = shiftForm.end_time.format('hh:mm:ss A');
      const breakTimeString = shiftForm.break_time.format('hh:mm:ss A'); // Changed to 'hh:mm:ss A' for consistency
  
      const start_time = convertTo24Hour(startTimeString);
      const end_time = convertTo24Hour(endTimeString);
      const break_time = convertTo24Hour(breakTimeString);
      
      console.log('Shift start time:', start_time); // Should print "08:30:00" or similar
      console.log('Shift end time:', end_time);     // Should print "17:45:00" or similar
      console.log('Break time:', break_time);       // Should print "12:00:00" or similar
      const selectedModule = shiftsmodule.find(option => option.value === data.module);
    const moduleLabel = selectedModule ? selectedModule.label : '';
    
  
      // Find the end day label based on the selected value
      const id = Math.random().toString(36).substr(2, 9); // Generate a new ID for this shift

      // This object represents the current shift being added/updated
      const currentShiftData = {
        id:id,
        start_time: start_time,
        end_time: end_time,
        break_time: break_time,
        shift_no: data.shift_no,
        start_day: shiftForm.start_day,
        end_day: shiftForm.end_day,
        module: moduleLabel
      };

      // Assuming 'datasource' is an array containing existing shift data.
      // If 'datasource' is not an array or is undefined, initialize as an empty array.
      let existingShifts = Array.isArray(datasource) ? [...datasource] : [];

      // Find if the current shift already exists by its ID
      let existingShiftIndex = existingShifts.findIndex(shift => shift.id === currentShiftData.id);

      if (existingShiftIndex !== -1) {
          // If shift exists, update it with the new data
          existingShifts[existingShiftIndex] = currentShiftData;
          console.log('Shift updated at index:', existingShiftIndex);
      } else {
          // If shift does not exist, add it as a new entry
          existingShifts.push(currentShiftData);
          console.log('New shift added.');
      }
      console.log('existingShifts', existingShifts);
      // Construct the attribute payload as per the concept.
      // This payload will be sent to the API.
      // const attributePayload = [{
      //     key: 'allShift',
      //     value: existingShifts,
      //     lastUpdateTs: Date.now()
      // }];

      // Redefine 'formData' to be the 'attributePayload'.
      // This ensures the subsequent `shiftadd(formData, ...)` call sends the correct structure
      // (an array of attributes, where 'allShift' contains the updated list of shifts).
      const formData = {
        allShift: existingShifts,
        lastUpdateTs: Date.now()
      };

      console.log('Submitted shift data:', JSON.stringify(formData));
      console.log('customerId', customerId);
      const scope = 'SERVER_SCOPE';
      // Make the API call
      
      const response = await shiftadd(formData,customerId,scope);
      console.log('Shift Created response:', response);
  
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
      console.error('Error submitting shift data:', error);
      Swal.fire('Error submitting shift data: ' + error.message);
    }
  };
  



  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
      <DialogTitle style={{ color: 'black' }}>Add Shift</DialogTitle>
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
                <div className={`form_field  ${errors.start_time ? 'error-outline' : ''}`}>
                  <DemoItem className="white-label">
                    <DesktopTimePicker
                      {...register("start_time", {
                        required: "Start Time is required",
                        validate: (value, formValues) => {
                          const startTime = value;
                          const endTime = formValues.end_time;

                          // Only validate if both times are present and valid Dayjs objects
                          if (startTime && endTime && startTime.isValid() && endTime.isValid()) {
                            // if (startTime.isAfter(endTime)) {
                            //   return "Start Time must be before End Time";
                            // }
                            if (startTime.isSame(endTime, 'second')) { // Compare down to seconds
                              return "Start Time and End Time cannot be the same";
                            }
                          }
                          return true; // Validation passes
                        }
                      })}
                      onBlur={() => trigger('start_time')}
                      value={shiftForm.start_time}
                      onChange={(value) => {
                        handleTimeChange('start_time', value);
                        // Trigger validation for end_time as well when start_time changes
                        if (shiftForm.end_time && value && value.isValid()) {
                          trigger('end_time');
                        }
                      }}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss A"
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
                  {errors.start_time && <div className="mat-error">{errors.start_time.message}</div>}
                </div>
                <div className={`form_field  ${errors.end_time ? 'error-outline' : ''}`}>
                  <DemoItem>
                    <DesktopTimePicker
                      {...register("end_time", {
                        required: "End Time is required",
                        validate: (value, formValues) => {
                          const startTime = formValues.start_time;
                          const endTime = value;

                          // Only validate if both times are present and valid Dayjs objects
                          if (startTime && endTime && startTime.isValid() && endTime.isValid()) {
                            // if (endTime.isBefore(startTime)) {
                            //   return "End Time must be after Start Time";
                            // }
                            if (endTime.isSame(startTime, 'second')) { // Compare down to seconds
                              return "Start Time and End Time cannot be the same";
                            }
                          }
                          return true; // Validation passes
                        }
                      })}
                      onBlur={() => trigger('end_time')}
                      value={shiftForm.end_time}
                      onChange={(value) => {
                        handleTimeChange('end_time', value);
                        // Trigger validation for start_time as well when end_time changes
                        if (shiftForm.start_time && value && value.isValid()) {
                          trigger('start_time');
                        }
                      }}
                      label="End Time *"
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss A"
                      error={!!errors.end_time}
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
                  {errors.end_time && <div className="mat-error">{errors.end_time.message}</div>}
                </div>
                <div className={`form_field  ${errors.break_time ? 'error-outline' : ''}`}>
                  <DemoItem>
                    <DesktopTimePicker 
                      {...register("break_time", { required: "Break Time is required" })}
                    onBlur={() => trigger('break_time')}
                      value={shiftForm.break_time}
                      onChange={(value) => handleTimeChange('break_time', value)}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss"
                      label="Break Time *"
                      ampm={false}
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