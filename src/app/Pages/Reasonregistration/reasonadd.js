import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import Autocomplete from '@mui/material/Autocomplete';
import {
  cleanCustomerId,
  customerbasedshift,
} from '../../Services/app/operatorservice';

export default function ReasonAdd({
  open,
  handleClose,
  handleAdd,
  dialogOpenCount,
  datasource,
  setDatasource,
  customerId,
  reasonKey = 'reason',
  groupKey = 'reasongroups',
  isQuality = false,
}) {
  console.log('datasource', datasource);
  const resolvedGroupKey = useMemo(() => {
    return groupKey || 'reasongroups';
  }, [groupKey]);

  const customDaySelectRef = useRef();
  const componentNameRef = useRef();

  const dialogBackgroundColor =
    dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';

  const [shiftCategory, setShiftCategory] = useState([]);
  const [shiftsmode, setShiftsmode] = useState([]);
  const [reasonGroupOptions, setReasonGroupOptions] = useState([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    setValue,
    reset,
    unregister
  } = useForm({
    shouldFocusError: true,
    mode: 'onBlur',
  });

  const defaultShiftForm = useMemo(
    () => ({
      reason: '',
      mode: '',
      category: '',
      group: '',
    }),
    []
  );

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);

  const fetchReasonGroups = async () => {
    try {
      const data = await customerbasedshift(customerId, resolvedGroupKey);
      const allReasonGroups = data?.[0]?.value || [];

      const mappedGroups = allReasonGroups.map((item) => ({
        value: item.groupName,
        label: item.groupName,
      }));

      setReasonGroupOptions(mappedGroups);
    } catch (error) {
      console.error('Error fetching reason groups:', error);
      setReasonGroupOptions([]);
    }
  };

  useEffect(() => {
    fetchReasonGroups();
  }, [resolvedGroupKey, customerId]);

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
    } else {
      if (cleanCustomerId(customerId) === window._env_.GPLAST_CUSTOMER_ID) {
        fetchReasonGroups();
      }
      setShiftForm(defaultShiftForm);
    }
  }, [open, reset, defaultShiftForm]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value);
    trigger(name);
  };

  const onSubmit = async () => {
    try {
      const id = Math.random().toString(36).substr(2, 9);

      const targetKey =
        shiftForm.group?.toLowerCase() === "quality" ? "qualityreason" : "reason";

      const normalizedReason = shiftForm.reason
        ?.replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const scope = "SERVER_SCOPE";

      const currentData = await customerbasedshift(customerId, targetKey);
      let existingReasons = currentData?.[0]?.value || [];

      if (typeof existingReasons === "string") {
        existingReasons = JSON.parse(existingReasons);
      }

      if (!Array.isArray(existingReasons)) {
        existingReasons = [];
      }

      const isDuplicate = existingReasons.some(
        (item) => item.reason?.trim().toLowerCase() === normalizedReason
      );

      if (isDuplicate) {
        handleClose();
        Swal.fire("Error", "Duplicate Reason is not allowed.", "error");
        return;
      }

      let lastCode = 0;

      if (existingReasons.length > 0) {
        lastCode = Math.max(
          ...existingReasons.map((item) => parseInt(item.code, 10) || 0)
        );
      }

      const autoCode = lastCode + 1;

      const reasonData = {
        id,
        reason: shiftForm.reason?.trim(),
        code: String(autoCode),
        mode: shiftForm.mode,
        category: hideCategory ? "" : shiftForm.category,
        group: shiftForm.group || "",
      };

      existingReasons.push(reasonData);

      const formData = {
        [targetKey]: existingReasons,
        lastUpdateTs: Date.now(),
      };

      const response = await shiftadd(formData, customerId, scope);

      if (response?.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire("Reason Created Successfully");
      }

      handleClose();
      reset(defaultShiftForm);

    } catch (error) {
      console.error("Error submitting reason data:", error);
      Swal.fire("Error submitting reason data: " + error.message);
      handleClose();
      reset(defaultShiftForm);
    }
  };

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        componentNameRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const hideCategory =
    [window._env_.PMI_CUSTOMER_ID, window._env_.GPLAST_CUSTOMER_ID].includes(cleanCustomerId(customerId)) &&
    shiftForm.group?.toLowerCase() === "quality";

  useEffect(() => {
    if (hideCategory) {
      unregister("category");
      setShiftForm((prev) => ({ ...prev, category: "" }));
    }
  }, [hideCategory, unregister]);


  const isSaveDisabled =
    !shiftForm?.mode ||
    !shiftForm?.reason?.trim() ||
    (!hideCategory && !shiftForm?.category);

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
                    {...register("reason", {
                      required: "Reason Name is required",
                      maxLength: {
                        value: 100,
                        message: "Maximum length is 100 characters"
                      }
                    })}
                    onBlur={() => trigger('reason')}
                    label="Reason Name"
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
                {[window._env_.GPLAST_CUSTOMER_ID, window._env_.PMI_CUSTOMER_ID].includes(cleanCustomerId(customerId)) && (
                  <div className="form_field">
                    <Autocomplete
                      options={reasonGroupOptions}
                      getOptionLabel={(option) => option.label}
                      value={
                        reasonGroupOptions.find((opt) => opt.value === shiftForm.group) || null
                      }
                      onChange={(event, newValue) => {
                        const value = newValue ? newValue.value : '';
                        setShiftForm({ ...shiftForm, group: value });
                        setValue('group', value);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Reason Group"
                          variant="outlined"
                          fullWidth
                          InputLabelProps={{
                            sx: {
                              color: 'black',
                              '&.Mui-focused': { color: 'orange' },
                            },
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
                      )}
                    />
                  </div>
                )}
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
                {!hideCategory && (
                  <div className={`form_field ${errors.category ? 'error-outline' : ''}`}>
                    <CustomDaySelect
                      {...register("category", { required: !hideCategory && "Category is required" })}
                      onBlur={() => trigger('category')}
                      ref={customDaySelectRef}
                      name="category"
                      value={shiftForm.category}
                      onChange={handleFormChange}
                      label="Select Category"
                      required={!hideCategory}
                      options={shiftCategory}
                      error={!!errors.category}
                    />
                    {errors.category && <div className="mat-error">Category is required</div>}
                  </div>
                )}
              </div>
            </LocalizationProvider>
            <div className="form-button text-right" align="end" style={{ marginRight: '10px' }}>
              <Button type="submit" variant="contained" className="filter_btn btn_orange" color="warning" disabled={isSaveDisabled}>
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