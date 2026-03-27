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
import { Autocomplete, Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import { cleanCustomerId, customerbasedshift } from '../../Services/app/operatorservice';
import { CUSTOMER_IDS } from '../../Shared/constants/ids';

export default function ReasonEdit({
  open,
  handleClose,
  handleAdd,
  dialogOpenCount,
  datasource,
  setDatasource,
  customerId,
  dialogData,
  reasonKey = 'reason',
  groupKey = 'reasongroups',
  isQuality = false,
}) {
  const memoizedDatasource = useMemo(() => datasource, [datasource]);
  const memoizedDialogData = useMemo(() => dialogData, [dialogData]);
  const userDetails = JSON.parse(localStorage.getItem("userDetails") || "{}");
  const hasReasonEditAccess = userDetails?.reasonEditAccess === true;
  const customDaySelectRef = useRef();
  const modeSelectRef = useRef();
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';

  const [shiftCategory, setShiftCategory] = useState([]);
  const [shiftsmode, setShiftsmode] = useState([]);

  const resolvedGroupKey = useMemo(() => {
    return groupKey || 'reasongroups';
  }, [groupKey]);

  const resolvedReasonKey = useMemo(() => {
    if (memoizedDialogData?.group?.toLowerCase() === 'quality') return 'qualityreason';
    if (isQuality) return 'qualityreason';
    return reasonKey || 'reason';
  }, [isQuality, reasonKey, memoizedDialogData]);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset,unregister, watch } = useForm({
    shouldFocusError: true,
    mode: 'onBlur',
    defaultValues: {
      reason: memoizedDialogData?.reason || '',
      code: memoizedDialogData?.code || '',
      mode: memoizedDialogData?.mode || '',
      category: memoizedDialogData?.category || '',
      group: memoizedDialogData?.group || ''
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
    group: memoizedDialogData?.group || '',
  }), [memoizedDialogData]);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const [reasonGroupOptions, setReasonGroupOptions] = useState([]);

  useEffect(() => {
    fetchReasonGroups();
  }, [resolvedGroupKey, customerId]);

  const fetchReasonGroups = async () => {
    // const key = 'reasongroups';
    try {
      const data = await customerbasedshift(customerId, resolvedGroupKey);
      const allReasonGroups = data[0]?.value || [];
      const mappedGroups = allReasonGroups.map((item) => ({
        value: item.groupName,
        label: item.groupName,
      }));
      setReasonGroupOptions(mappedGroups);
    } catch (error) {
      console.error("Error fetching reason groups:", error);
      setReasonGroupOptions([]);
    }
  };

 const onSubmit = async (data) => {
  try {
    const shiftIdToEdit = memoizedDialogData?.id;
    const targetKey =
     shiftForm.group?.toLowerCase() === 'quality' ? 'qualityreason' : 'reason';

    const normalizedReason = shiftForm.reason
      ?.replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const updatedShiftData = {
      id: shiftIdToEdit,
      reason: shiftForm.reason?.trim(),
      code: shiftForm.code,
      mode: shiftForm.mode,
category: hideCategory ? "" : shiftForm.category,
      group: shiftForm.group || "",
    };

    const scope = 'SERVER_SCOPE';

    // helper to extract id safely
    const getId = (val) =>
      typeof val === 'object' && val !== null ? val.$oid : val;

    if (targetKey !== resolvedReasonKey) {
      // ===============================
      // 🔁 GROUP CHANGED FLOW
      // ===============================

      // 🚨 Check duplicate in target list FIRST
      const targetData = await customerbasedshift(customerId, targetKey);
      let targetList = targetData?.[0]?.value || [];

      const isDuplicate = targetList.some((item) => {
        return (
          item.reason?.trim().toLowerCase() === normalizedReason &&
          getId(item.id) !== getId(shiftIdToEdit)
        );
      });

      if (isDuplicate) {
         handleClose();
        Swal.fire('Error', 'Duplicate Reason is not allowed.', 'error');
        return;
      }

      // ✅ Remove from source list
      const sourceData = await customerbasedshift(
        customerId,
        resolvedReasonKey
      );
      let sourceList = sourceData?.[0]?.value || [];

      sourceList = sourceList.filter(
        (item) => getId(item.id) !== getId(shiftIdToEdit)
      );

      await shiftadd(
        { [resolvedReasonKey]: sourceList, lastUpdateTs: Date.now() },
        customerId,
        scope
      );

      // ✅ Add to target list
      targetList.push(updatedShiftData);

      const response = await shiftadd(
        { [targetKey]: targetList, lastUpdateTs: Date.now() },
        customerId,
        scope
      );

      if (response.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire('Updated Successfully');
      }
    } else {
      // ===============================
      // ✏️ SAME LIST UPDATE FLOW
      // ===============================

      const sourceData = await customerbasedshift(
        customerId,
        resolvedReasonKey
      );
      let existingShifts = sourceData?.[0]?.value || [];

      // 🚨 Duplicate check in same list (exclude self)
      const isDuplicate = existingShifts.some((item) => {
        return (
          item.reason?.trim().toLowerCase() === normalizedReason &&
          getId(item.id) !== getId(shiftIdToEdit)
        );
      });

      if (isDuplicate) {
        handleClose();
        Swal.fire('Error', 'Duplicate Reason is not allowed.', 'error');
        return;
      }

      let existingShiftIndex = -1;
      let existingIdStructure = null;

      if (shiftIdToEdit) {
        existingShiftIndex = existingShifts.findIndex(
          (item) => getId(item.id) === getId(shiftIdToEdit)
        );

        if (existingShiftIndex !== -1) {
          existingIdStructure = existingShifts[existingShiftIndex].id;
        }
      }

      if (existingShiftIndex === -1) {
        console.error('Shift not found for ID:', shiftIdToEdit);
        Swal.fire(
          'Error',
          'Shift not found for update. Please try again.',
          'error'
        );
        handleClose();
        reset(defaultShiftForm);
        return;
      }

      updatedShiftData.id = existingIdStructure;
      existingShifts[existingShiftIndex] = updatedShiftData;

      const formData = {
        [resolvedReasonKey]: existingShifts,
        lastUpdateTs: Date.now(),
      };

      const response = await shiftadd(formData, customerId, scope);

      if (response.msg) {
        Swal.fire(response.msg);
      } else {
        Swal.fire('Updated Successfully');
      }
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
        group: memoizedDialogData.group || '',
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
          const selectElement = modeSelectRef.current;
          if (selectElement) {
            selectElement.focus();
            selectElement.click();
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [open]);
const hideCategory =
  [CUSTOMER_IDS.PMI, CUSTOMER_IDS.GPLAST].includes(cleanCustomerId(customerId)) &&
  (shiftForm.group || "").trim().toLowerCase() === "quality";

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
                    disabled={!hasReasonEditAccess}
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
                 {[CUSTOMER_IDS.GPLAST, CUSTOMER_IDS.PMI].includes(cleanCustomerId(customerId)) && (
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
                    name="mode"
                    label="Select Mode"
                    required={true}
                    value={shiftForm.mode}
                    onChange={handleFormChange}
                    onBlur={() => trigger("mode")}
                    options={shiftsmode}
                    error={!!errors.mode}
                    ref={modeSelectRef}

                  />

                  {errors.mode && <div className="mat-error">Mode is required</div>}
                </div>
                           {!hideCategory && (
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
                )}
               
              </div>
            </LocalizationProvider>
            <div className="form-button text-right" align="end" style={{ marginRight: '10px' }}>
              <Button type="submit" variant="contained" className="filter_btn btn_orange" color="warning"  disabled={isSaveDisabled}>
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