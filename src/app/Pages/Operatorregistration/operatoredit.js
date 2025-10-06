
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import './operatorreg.css';
import { useForm } from 'react-hook-form';
import { convertTo24Hour } from '../Inputfield/inputfield';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import { decryptText, encryptText } from '../../Shared/utils/cryptoUtils';

// Helper function to parse time strings robustly
// It attempts to parse the string as HH:mm:ss first by prepending a dummy date.
// If that fails, it tries to parse as a full date/time string.
// This ensures the MobileTimePicker receives a valid Dayjs object,
// and the 'format' prop on the picker will ensure only the time is displayed.


export default function OperatorEdit({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId, dialogData }) {
  console.log('datasource', datasource);
  console.log('dialogData', dialogData);
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);
  const customDaySelectRef = useRef();
  const [shiftsmode, setShiftsmode] = useState([]);

  const componentNameRef = useRef();

    const [customerTitle, setCustomerTitle] = useState("");
  
    useEffect(() => {
      const title = localStorage.getItem("customerTitle") || "";
      setCustomerTitle(title);
    }, [open]);
    
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
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value); // Update the form state in react-hook-form
    trigger(name); // Trigger validation for this field
  };
  const defaultShiftForm = useMemo(() => ({
    operatorname: '',
    operatorid: '',
    mode: 'Operator',
    password: '',
    type: ''
    // language:'',
    // experiencelevel: ''
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const onSubmit = async (data) => {
    try {
      const shiftIdToEdit = dialogData?.id;

      let existingShifts = Array.isArray(datasource) ? [...datasource] : [];

      let existingShiftIndex = -1;
      let existingIdStructure = null;

      if (shiftIdToEdit) {
        existingShiftIndex = existingShifts.findIndex(item => {
          const itemId = typeof item.id === 'object' && item.id !== null ? item.id.$oid : item.id;
          const targetId = typeof shiftIdToEdit === 'object' && shiftIdToEdit !== null ? shiftIdToEdit.$oid : shiftIdToEdit;
          return itemId === targetId;
        });

        if (existingShiftIndex !== -1) {
          existingIdStructure = existingShifts[existingShiftIndex].id;
        }
      }

      if (existingShiftIndex === -1) {
        console.error('Shift not found for ID:', shiftIdToEdit);
        Swal.fire('Error', 'Shift not found for update. Please try again.', 'error');
        handleClose();
        reset(defaultShiftForm);
        return;
      }

      // ✅ Check for duplicates BEFORE modifying the array
      // const isDuplicate = existingShifts.some((item, index) => {
      //   if (index === existingShiftIndex) return false;

      //   const operatorIdMatch = item.operatorid?.toString().trim().toLowerCase() === shiftForm.operatorid?.toString().trim().toLowerCase();
      //   const operatorNameMatch = item.operatorname?.toString().trim().toLowerCase() === shiftForm.operatorname?.toString().trim().toLowerCase();
      //   return operatorIdMatch || operatorNameMatch;
      // });

      // if (isDuplicate) {
      //   handleClose();
      //   Swal.fire('Error', 'Duplicate Operator ID or Operator Name is not allowed.', 'error');
      //   return;
      // }

      // ✅ Now safe to update
      const updatedShiftData = {
        id: existingIdStructure,
        operatorname: shiftForm.operatorname,
        operatorid: shiftForm.operatorid,
        mode: shiftForm.mode,
        type: shiftForm.type,
        ...(shiftForm.mode === "Operator" && { password: encryptText(shiftForm.password) })

        // language: shiftForm.language,
        // experiencelevel: shiftForm.experiencelevel,
      };

      existingShifts[existingShiftIndex] = updatedShiftData;
      console.log('Shift updated at index:', existingShiftIndex, 'with data:', updatedShiftData);

      const formData = {
        alloperator: existingShifts,
        lastUpdateTs: Date.now()
      };

      console.log('Submitted shift data:', JSON.stringify(formData));
      console.log('customerId', customerId);

      const scope = 'SERVER_SCOPE';
      const response = await shiftadd(formData, customerId, scope);

      if (response.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire("Updated Successfully");
      }

      handleClose();
      reset(defaultShiftForm);
    } catch (error) {
      console.error('Error submitting shift data:', error);
      Swal.fire('Error submitting shift data: ' + error.message);
      handleClose();
      reset(defaultShiftForm);
    }
  };


  useEffect(() => {
    const fallbackOptions1 = [
      { value: 'Operator', label: 'Operator' },
      { value: 'Supervisor', label: 'Supervisor' },

    ];
    setShiftsmode(fallbackOptions1);
    if (!open) {
      reset(defaultShiftForm);
      setShiftForm(defaultShiftForm);
    } else {

      if (dialogData) {

        // Convert 24-hour time strings to Dayjs objects for 12-hour display
        const initialFormState = {
          // Use the helper function to parse 24-hour times
          operatorname: dialogData.operatorname || '',
          operatorid: dialogData.operatorid || '',
          mode: dialogData.mode || '',
          language: dialogData.language || '',
          experiencelevel: dialogData.experiencelevel || '',
          password: dialogData.mode === 'Operator' ? decryptText(dialogData.password) : '',
          type: dialogData.type || ''
        };

        // Find the correct module value if shiftsmodule is already loaded


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
      <DialogTitle style={{ color: 'black' }}>Edit User</DialogTitle>
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

                <div className={`form_field  ${errors.operatorname ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("operatorname", {
                      required: "User Name is required", validate: value =>
                        /^[a-zA-Z0-9\s]*$/.test(value) || "Special characters are not allowed", maxLength: {
                          value: 100,
                          message: "Maximum length is 100 characters"
                        }
                    })}
                    onBlur={() => trigger('operatorname')}
                    label="User Name"
                    type="text"
                    name="operatorname"
                    inputProps={{ maxLength: 100 }}
                    value={shiftForm.operatorname}
                    onChange={handleFormChange}
                    error={!!errors.operatorname}
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
                  {errors.operatorname && <div className="mat-error">{errors.operatorname.message}</div>} {/* Changed to div and mat-error */}
                </div>
                <div className={`form_field  ${errors.operatorid ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("operatorid", {
                      required: "User ID is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      },
                      validate: value => {
                        if (/[^a-zA-Z0-9]/.test(value)) {
                          if (/\s/.test(value)) {
                            return "Spaces are not allowed";
                          } else {
                            return "Special characters are not allowed";
                          }
                        }
                        return true;
                      }
                    })}
                    onBlur={() => trigger('operatorid')}
                    label="User ID"
                    type="text"
                    name="operatorid"
                    value={shiftForm.operatorid}
                    onChange={handleFormChange}
                    error={!!errors.operatorid}
                    inputProps={{ maxLength: 100, min: 1 }}
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
                  {errors.operatorid && <div className="mat-error">{errors.operatorid.message}</div>}


                  {/* Changed to div and mat-error */}
                </div>



                {/* <div className={`form_field  ${errors.experiencelevel ? 'error-outline' : ''}`}>
                  <TextField
                  inputRef={componentNameRef}
                    {...register("experiencelevel", { required: "Experience Level is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      } ,
                      
                      validate: value => {
                        if (isNaN(value)) return "User Id must be a number";
                        if (Number(value) <= 0) return "User Id must be greater than 0";
                        return true;
                      } })}
                    onBlur={() => trigger('experiencelevel')}
                    label="Experience Level"
                    type="number"
                    name="experiencelevel"
                    value={shiftForm.experiencelevel}
                    onChange={handleFormChange}
                    error={!!errors.experiencelevel}
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
                  {errors.experiencelevel && <div className="mat-error">{errors.experiencelevel.message}</div>}
                </div>    */}


                {/* <div className={`form_field  ${errors.language ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("language", { required: "Language is required",validate: value =>
                      /^[a-zA-Z0-9\s]*$/.test(value) || "Special characters are not allowed",maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      } })}
                    onBlur={() => trigger('language')}
                    label="Language"
                    type="text"
                    name="language"
                    inputProps={{ maxLength: 100 }}
                    value={shiftForm.language}
                    onChange={handleFormChange}
                    error={!!errors.language}
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
                  {errors.language && <div className="mat-error">{errors.language.message}</div>} 
                </div> */}


                {/* <div className={`form_field  ${errors.mode ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("mode", { required: "Mode is required" })}
                    onBlur={() => trigger('mode')}
                    ref={customDaySelectRef}
                    name="mode"
                    value={shiftForm.mode}
                    onChange={handleFormChange}
                    label="Select Role"
                    required={true}
                    options={shiftsmode}
                    error={!!errors.mode}
                  />
                  {errors.mode && <div className="mat-error">Mode is required</div>}
                </div> */}
                {shiftForm.mode === "Operator" && customerTitle === "PMI GLOBAL" &&(
                  <div className={`form_field ${errors.password ? 'error-outline' : ''}`}>
                    <TextField
                      {...register("password", {
                        required: shiftForm.mode === "Operator" ? "Password is required" : false,
                        minLength: {
                          value: 6,
                          message: "Password must be at least 6 characters"
                        },
                        maxLength: {
                          value: 20,
                          message: "Password must not exceed 20 characters"
                        }
                      })}
                      onBlur={() => trigger('password')}
                      label="Password"
                      type="password"
                      name="password"
                      value={shiftForm.password}
                      onChange={handleFormChange}
                      error={!!errors.password}
                      fullWidth
                    />
                    {errors.password && <div className="mat-error">{errors.password.message}</div>}
                  </div>
                )}

                <div className={`form_field ${errors.type ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("type", { required: "Type is required" })}
                    name="type"
                    value={shiftForm.type || ''}
                    onChange={handleFormChange}
                    onBlur={() => trigger('type')}
                    label="Select Type"
                    required={true}
                    options={[
                      { value: 'VMC', label: 'VMC' },
                      { value: 'HMC', label: 'HMC' },
                      { value: 'CNC', label: 'CNC' },
                    ]}
                    error={!!errors.type}
                    sx={{
                      width: 250, '& .MuiInputLabel-root': {
                        top: '-8px',
                        backgroundColor: '#ededed',
                        padding: '0 4px',
                      },
                    }}
                  />
                  {errors.type && <div className="mat-error">{errors.type.message}</div>}
                </div>
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