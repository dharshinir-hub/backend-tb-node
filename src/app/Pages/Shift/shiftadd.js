import React, { useState, useEffect, useRef,useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import { Button } from 'react-bootstrap';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { MobileTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { DemoItem } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
// import dayjs from 'dayjs';
import './shift.css';
import { useForm } from 'react-hook-form';
import { CustomDaySelect,convertTo24Hour } from '../Inputfield/inputfield';
import { shiftgetmodule,shiftcreate } from '../../Services/app/shiftservice';
import Swal from 'sweetalert2';

export default function ShiftAdd({ open, handleClose, handleAdd, dialogOpenCount }) {
  const customDaySelectRef = useRef();

  const dialogBackgroundColor = dialogOpenCount === 0 ? '#484848' : '#0E121B';
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
        { value: '1', label: 'GENERAL' },
        { value: '2', label: 'Module A' },
        { value: '3', label: 'Module B' }
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
    
      const formData = {
        shift_start_time: start_time,
        shift_end_time: end_time,
        break_time: break_time,
        shift_no: data.shift_no,
        shift_name: 'test',
        shift_start_day:shiftForm.start_day,
        shift_end_day: shiftForm.end_day,
        module: moduleLabel
      };
  
      console.log('Submitted shift data:', formData);
  
      // Make the API call
      const response = await shiftcreate(formData);
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
      <DialogTitle style={{ color: 'white' }}>Shift Registration</DialogTitle>
      <div className="close_modal">
        <IconButton aria-label="close" onClick={handleClose} style={{ backgroundColor: 'white' }}>
          <CloseIcon />
        </IconButton>
      </div>
      <div className="machinedialog">
        <div className="filter_sec">
          <form onSubmit={handleSubmit(onSubmit)} className="form_sec shift_form" autoComplete="off">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="form_sec_fields">
                <div className={`form_field time_field_bg  ${errors.start_time ? 'error-outline' : ''}`}>
                  <DemoItem label="Start Time" className="white-label">
                    <MobileTimePicker
                      {...register("start_time", { required: "Start Time is required" })}
                      onBlur={() => trigger('start_time')}
                      value={shiftForm.start_time}
                      onChange={(value) => handleTimeChange('start_time', value)}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss A"
                      error={!!errors.start_time}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'white',
                          },
                          '&:hover fieldset': {
                            borderColor: 'white',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#ec6e17',
                          },
                          '& .MuiOutlinedInput-input': {
                            color: '#fff',
                          },
                          '&.Mui-focused .MuiOutlinedInput-input': {
                            caretColor: '#ec6e17',
                          },
                          '&::placeholder': {
                            color: 'white',
                            opacity: 1,
                          },
                        },
                      }}
                    />
                  </DemoItem>
                  {errors.start_time && <span className="error-message">Start Time is required</span>}
                </div>
                <div className={`form_field time_field_bg  ${errors.end_time ? 'error-outline' : ''}`}>
                  <DemoItem label="End Time">
                    <MobileTimePicker
                    {...register("end_time", { required: "End Time is required" })}
                    onBlur={() => trigger('end_time')}
                      value={shiftForm.end_time}
                      onChange={(value) => handleTimeChange('end_time', value)}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss A"
                      error={!!errors.end_time}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'white',
                          },
                          '&:hover fieldset': {
                            borderColor: 'white',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#ec6e17',
                          },
                          '& .MuiOutlinedInput-input': {
                            color: '#fff',
                          },
                          '&.Mui-focused .MuiOutlinedInput-input': {
                            caretColor: '#ec6e17',
                          },
                          '&::placeholder': {
                            color: 'white',
                            opacity: 1,
                          },
                        },
                      }}
                    />
                  </DemoItem>
                  {errors.end_time && <span className="error-message">End Time is required</span>}
                </div>
                <div className={`form_field time_field_bg  ${errors.break_time ? 'error-outline' : ''}`}>
                  <DemoItem label="Break Time">
                    <MobileTimePicker {...register("break_time", { required: "Break Time is required" })}
                    onBlur={() => trigger('break_time')}
                      value={shiftForm.break_time}
                      onChange={(value) => handleTimeChange('break_time', value)}
                      views={['hours', 'minutes', 'seconds']}
                      openTo="hours"
                      format="HH:mm:ss"
                      error={!!errors.break_time}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'white',
                          },
                          '&:hover fieldset': {
                            borderColor: 'white',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#ec6e17',
                          },
                          '& .MuiOutlinedInput-input': {
                            color: '#fff',
                          },
                          '&.Mui-focused .MuiOutlinedInput-input': {
                            caretColor: '#ec6e17',
                          },
                          '&::placeholder': {
                            color: 'white',
                            opacity: 1,
                          },
                        },
                      }}
                    />
                  </DemoItem>
                  {errors.break_time && <span className="error-message">Break Time is required</span>}
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
                    options={shiftsmodule}
                    error={!!errors.module}
                  />
                  {errors.module && <span className="error-message">Module is required</span>}
                </div>
                <div className={`form_field  ${errors.shift_no ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("shift_no", { required: "Shift Number is required" })}
                    onBlur={() => trigger('shift_no')}
                    label="Shift Number"
                    type="number"
                    name="shift_no"
                    value={shiftForm.shift_no}
                    onChange={handleFormChange}
                    error={!!errors.shift_no}
                    InputLabelProps={{
                      sx: {
                        color: 'white',
                        '&.Mui-focused': {
                          color: '#ec6e17',
                        },
                      },
                    }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'white',
                        },
                        '&:hover fieldset': {
                          borderColor: 'white',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#ec6e17',
                        },
                        '& .MuiOutlinedInput-input': {
                          color: '#fff',
                        },
                        '&.Mui-focused .MuiOutlinedInput-input': {
                          caretColor: '#ec6e17',
                        },
                        '&::placeholder': {
                          color: 'white',
                          opacity: 1,
                        },
                      },
                    }}
                  />
                  {errors.shift_no && <span className="error-message">Shift Number is required</span>}
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
                    error={!!errors.start_day}
                    options={[
                      { value: '1', label: 'Day 1' },
                      { value: '2', label: 'Day 2' },
                    ]}
                  />
                  {errors.start_day && <span className="error-message">Start Day is required</span>}
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
                    options={[
                      { value: '1', label: 'Day 1' },
                      { value: '2', label: 'Day 2' },
                    ]}
                  />
                  {errors.end_day && <span className="error-message">End Day is required</span>}
                </div>
              </div>
            </LocalizationProvider>
            <div className="form-button text-right" align="end" style={{ marginRight: '25px' }}>
              <Button type="submit" variant="outline-warning" className="filter_btn btn_orange">
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
