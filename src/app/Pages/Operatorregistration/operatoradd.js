import React, { useState, useEffect, useRef, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
// import dayjs from 'dayjs';
import './operatorreg.css';
import { useForm } from 'react-hook-form';
import { convertTo24Hour } from '../Inputfield/inputfield';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import { decryptText, encryptText } from '../../Shared/utils/cryptoUtils';
export default function OperatorAdd({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId }) {
  console.log('datasource', datasource);
  //console.log('setDatasource', setDatasource);

  //const customerId = localStorage.getItem('customerId');
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({
    shouldFocusError: true,
    mode: 'onBlur'
  });

  const defaultShiftForm = useMemo(() => ({
    operatorname: '',
    operatorid: '',
    mode: 'Operator',
    password: '',
    type: '',
    // language:'',
    // experiencelevel: ''
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const [shiftsmode, setShiftsmode] = useState([]);
  const customDaySelectRef = useRef();

  const [customerTitle, setCustomerTitle] = useState("");

  useEffect(() => {
    const title = localStorage.getItem("customerTitle") || "";
    setCustomerTitle(title);
  }, [open]);


  useEffect(() => {
    const fallbackOptions1 = [
      { value: 'Operator', label: 'Operator' },
      { value: 'Supervisor', label: 'Supervisor' },

    ];
    setShiftsmode(fallbackOptions1);
    if (!open) {
      reset(defaultShiftForm); // Reset form state and validation errors when the dialog is closed
    } else {
      setShiftForm(defaultShiftForm); // Set form state to default when the dialog opens
    }
  }, [open, reset, defaultShiftForm]);




  //Get module dropdown values



  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value); // Update the form state in react-hook-form
    trigger(name); // Trigger validation for this field
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

  //submit event 
  const onSubmit = async (data) => {
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const encryptedPassword =
        shiftForm.mode === "Operator" ? encryptText(shiftForm.password) : "";
      const currentShiftData = {
        id: id,
        operatorname: shiftForm.operatorname,
        operatorid: shiftForm.operatorid,
        mode: shiftForm.mode,
        type: shiftForm.type,
        ...(shiftForm.mode === "Operator" && { password: encryptedPassword })
        // language: shiftForm.language,
        // experiencelevel: shiftForm.experiencelevel,
      };

      const decryptedPassword = decryptText(encryptedPassword);
      console.log("Decrypted:", decryptedPassword);

      let existingShifts = Array.isArray(datasource) ? [...datasource] : [];

      // ✅ Check for duplicates BEFORE inserting
      const isDuplicate = existingShifts.some(item =>
        item.operatorid?.toString().trim().toLowerCase() === shiftForm.operatorid.toString().trim().toLowerCase() ||
        item.operatorname?.toString().trim().toLowerCase() === shiftForm.operatorname.toString().trim().toLowerCase()
      );

      if (isDuplicate) {
        handleClose();
        Swal.fire('Error', 'Duplicate Operator ID or Operator Name is not allowed.', 'error');
        return;
      }

      // If no duplicate, add new record
      existingShifts.push(currentShiftData);

      const formData = {
        alloperator: existingShifts,
        lastUpdateTs: Date.now()
      };

      const response = await shiftadd(formData, customerId, 'SERVER_SCOPE');

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
      <DialogTitle style={{ color: 'black' }}>Add User </DialogTitle>
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
                    inputRef={componentNameRef}
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
                    inputProps={{ maxLength: 100 }}
                    InputLabelProps={{
                      required: true,
                      sx: {
                        color: 'black',
                        '&.Mui-focused': { color: 'orange' },
                      },
                    }}
                    fullWidth
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
                  {errors.operatorid && <div className="mat-error">{errors.operatorid.message}</div>}
                </div>




                {/* <div className={`form_field  ${errors.experiencelevel ? 'error-outline' : ''}`}>
                  <TextField
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
                </div> */}



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

                {shiftForm.mode === "Operator" && customerTitle === "PMI GLOBAL" && (
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
                      onBlur={() => trigger("password")}
                      label="Password"
                      type="password"
                      name="password"
                      value={shiftForm.password}
                      onChange={handleFormChange}
                      error={!!errors.password}
                      InputLabelProps={{
                        required: true,
                        sx: {
                          color: "black",
                          "&.Mui-focused": {
                            color: "orange",
                          },
                        },
                      }}
                      fullWidth
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          "& fieldset": { borderColor: "black" },
                          "&:hover fieldset": { borderColor: "black" },
                          "&.Mui-focused fieldset": { borderColor: "orange" },
                          "& .MuiOutlinedInput-input": { color: "black" },
                          "&.Mui-focused .MuiOutlinedInput-input": { caretColor: "orange" },
                        },
                      }}
                    />
                    {errors.password && <div className="mat-error">{errors.password.message}</div>}
                  </div>
                )}
                <div className={`form_field ${errors.type ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("type", { required: "Type is required" })}
                    onBlur={() => trigger('type')}
                    name="type"
                    value={shiftForm.type}
                    onChange={handleFormChange}
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