import React, { useState, useEffect, useMemo, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import './reasonreg.css';
import { useForm } from 'react-hook-form';
import { convertTo24Hour } from '../Inputfield/inputfield';
import Swal from 'sweetalert2';
import { Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CustomDaySelect } from '../Inputfield/inputfield';

export default function ReasonEdit({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId, dialogData }) {
  const memoizedDatasource = useMemo(() => datasource, [datasource]);
  const memoizedDialogData = useMemo(() => dialogData, [dialogData]);

  const customDaySelectRef = useRef();
  const modeSelectRef = useRef(); // New ref for mode field
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';

  const [shiftCategory, setShiftCategory] = useState([]);
  const [shiftsmode, setShiftsmode] = useState([]);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset, watch } = useForm({
    shouldFocusError: true,
    mode: 'onBlur',
    defaultValues: {
      reason: memoizedDialogData?.reason || '',
      code: memoizedDialogData?.code || '',
      mode: memoizedDialogData?.mode || '',
      category: memoizedDialogData?.category || ''
    }
  });

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm(prev => ({ ...prev, [name]: value }));
    setValue(name, value, { shouldValidate: true });
  };

  const defaultShiftForm = useMemo(() => ({
    reason: memoizedDialogData?.reason || '',
    code: memoizedDialogData?.code || '',
    mode: memoizedDialogData?.mode || '',
    category: memoizedDialogData?.category || '',
  }), [memoizedDialogData]);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);

  const onSubmit = async (data) => {
    try {
      const shiftIdToEdit = memoizedDialogData?.id;
      let existingShifts = Array.isArray(memoizedDatasource) ? [...memoizedDatasource] : [];
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

      const updatedShiftData = {
        id: existingIdStructure,
        reason: shiftForm.reason,
        code: shiftForm.code,
        mode: shiftForm.mode,
        category: shiftForm.category
      };

      existingShifts[existingShiftIndex] = updatedShiftData;
      const formData = {
        reason: existingShifts,
        lastUpdateTs: Date.now()
      };

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
      handleClose();
      reset(defaultShiftForm);
      console.error('Error submitting shift data:', error);
      Swal.fire('Error submitting shift data: ' + error.message);
    }
  };

  useEffect(() => {
    const fallbackOptions = [
     { value: 'Planned downtime', label: 'Planned Downtime' },
     { value: 'Unplanned downtime', label: 'Unplanned Downtime' },
    ];
    setShiftCategory(fallbackOptions);

    const fallbackOptions1 = [
      { value: 'Men', label: 'Men' },
      { value: 'Machine', label: 'Machine' },
      { value: 'MotherNature', label: 'MotherNature' },
      { value: 'Material', label: 'Material' },
      { value: 'Method', label: 'Method' },
      { value: 'Measurement', label: 'Measurement' },
    ];
    setShiftsmode(fallbackOptions1);

    if (!open) {
      reset(defaultShiftForm);
      setShiftForm(defaultShiftForm);
    } else if (memoizedDialogData) {
      const initialFormState = {
        reason: memoizedDialogData.reason || '',
        code: memoizedDialogData.code || '',
        mode: memoizedDialogData.mode || '',
        category: memoizedDialogData.category || '',
      };

      setShiftForm(initialFormState);
      reset(initialFormState);

      Object.keys(initialFormState).forEach(key => {
        setValue(key, initialFormState[key]);
      });
    }
  }, [open, reset, defaultShiftForm, memoizedDialogData, setValue]);

  const formValues = watch();
  useEffect(() => {
    setShiftForm(formValues);
  }, [formValues]);

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



  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
      <DialogTitle style={{ color: 'black' }}>Edit Reason</DialogTitle>
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
                    {...register("reason", {
                      required: "Reason is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      }
                    })}
                    onBlur={() => trigger('reason')}
                    label="Reason"
                    type="text"
                    name="reason"
                    disabled
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
                {/* <div className={`form_field  ${errors.code ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("code", {
                      required: "Code is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      },
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
                    disabled
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
                </div> */}
                <div className={`form_field  ${errors.mode ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("mode", { required: "Mode is required" })}
                    name="mode"
                    label="Select Mode"
                    required={true}
                    value={shiftForm.mode}
                    onChange={handleFormChange}
                    onBlur={() => trigger("mode")}
                    options={shiftsmode}
                    error={!!errors.mode}
                    ref={modeSelectRef} // Use ref directly, not inputRef

                  />

                  {errors.mode && <div className="mat-error">Mode is required</div>}
                </div>
                <div className={`form_field ${errors.category ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("category", { required: "Category is required" })}
                    onBlur={() => trigger('category')}
                    ref={customDaySelectRef}
                    name="category"
                    value={shiftForm.category}
                    onChange={handleFormChange}
                    label="Select Category"
                    required={true}
                    options={shiftCategory}
                    error={!!errors.category}
                  />
                   {errors.category && <div className="mat-error">Category is required</div>}
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