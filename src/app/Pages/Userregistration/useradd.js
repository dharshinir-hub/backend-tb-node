import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import './userreg.css';
import { useForm } from 'react-hook-form';
import { convertTo24Hour } from '../Inputfield/inputfield';
import Swal from 'sweetalert2';
import { Box, Checkbox, Chip, FormControl, InputAdornment, InputLabel, ListItemText, MenuItem, Select, Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import { decryptText, encryptText } from '../../Shared/utils/cryptoUtils';
import { CUSTOMER_IDS } from '../../Shared/constants/ids';
import { cleanCustomerId } from '../../Services/app/operatorservice';
import { createNewUser, createPasswordForUser, getUserActivationLink } from '../../Services/app/operatorservice';
import { ROLE_ADMIN, ROLE_MANAGER, ROLE_OPERATOR, ROLE_SUPER_ADMIN, ROLES } from '../../Shared/constants/role';
import { useUserRole } from '../../Shared/hooks/useUserRole';
import { useRoleOptions } from '../../Shared/hooks/useRoleOptions';
import { PAGE_LIST, QUALITY_PAGELIST } from '../../Shared/constants/pages';
import { UserDetailsContext } from '../../Shared/context/UserDetailsContext';
import { Visibility, VisibilityOff } from '@mui/icons-material';
export default function UserAdd({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId }) {

  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);

  const { register, handleSubmit, formState: { errors }, trigger, setValue, reset } = useForm({
    shouldFocusError: true,
    mode: 'onBlur'
  });

  const defaultShiftForm = useMemo(() => ({
    operatorname: '',
    operatorid: '',
    mode: '',
    password: '',
    email: '',
    pagelist: ''
  }), []);

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const [shiftsmode, setShiftsmode] = useState([]);
  const customDaySelectRef = useRef();
  const { availableRoles } = useRoleOptions();

  const { userDetails } = useContext(UserDetailsContext);
  const [pageList, setPageList] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const usersDetailsData = typeof userDetails === 'string' ? JSON.parse(userDetails) : userDetails
    if (usersDetailsData && usersDetailsData.mode) {
      if (usersDetailsData.mode === ROLE_SUPER_ADMIN) {
        setPageList(PAGE_LIST);
      } else {
        const allowedPages = usersDetailsData.pageList || [];
        const filtered = PAGE_LIST.filter((p) => allowedPages.includes(p.value));
        setPageList(filtered);
      }
    }
  }, [userDetails]);

  useEffect(() => {
    if (!open) {
      reset(defaultShiftForm);
    } else {
      setShiftForm(defaultShiftForm);
    }
  }, [open, reset, defaultShiftForm]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm({ ...shiftForm, [name]: value });
    setValue(name, value);
    trigger(name);
  };

  const componentNameRef = useRef();

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (componentNameRef.current) {
          componentNameRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  function generateRandomId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  const onSubmit = async (data) => {
    const customerId = JSON.parse(localStorage.getItem('CustomerID'));
    const tenantId = JSON.parse(localStorage.getItem('customerTenantID'));
    try {
      const existingShifts = Array.isArray(datasource) ? [...datasource] : [];
      if (existingShifts.some(item =>
        item.operatorid?.toString().trim().toLowerCase() === data.operatorid.toString().trim().toLowerCase()
      )) {
        Swal.fire('Error', 'Duplicate Operator ID is not allowed.', 'error');
        return;
      }
      const operatorId = [ROLE_ADMIN, ROLE_MANAGER, ROLE_SUPER_ADMIN].includes(data.mode)
        ? generateRandomId(6)
        : data.operatorid;
      const encryptedPassword = data.password?.trim() ? encryptText(data.password.trim()) : '';
      const decryptedPassword = encryptedPassword ? decryptText(encryptedPassword) : '';
      const email = data.email + '@yantra24x7.com';
      const descriptionObj = { mode: data.mode, userId: operatorId, pageList: data.mode === ROLE_OPERATOR ? ["operator"] : data.pagelist, password: encryptedPassword };
      const payload = {
        email,
        firstName: data.operatorname,
        additionalInfo: {
          description: JSON.stringify(descriptionObj),
          defaultDashboardId: null,
          defaultDashboardFullscreen: false,
          homeDashboardId: null,
          homeDashboardHideToolbar: true,
          role: descriptionObj.mode,
          userId: descriptionObj.userId,
          pageList: descriptionObj.pageList
        },
        authority: "CUSTOMER_USER",
        tenantId: { entityType: "TENANT", id: tenantId },
        customerId: { entityType: "CUSTOMER", id: customerId }
      };
      const userData = await createNewUser(payload);
      if (!userData?.id?.id) throw new Error('User ID not returned from createNewUser API');
      if (decryptedPassword) {
        const linkData = await getUserActivationLink(userData.id.id);
        if (!linkData?.value) throw new Error('Activation link not returned');
        const activateToken = new URL(linkData.value).searchParams.get('activateToken');
        if (!activateToken) throw new Error('Activation token not found');
        await createPasswordForUser({ activateToken, password: decryptedPassword });
      }
      const currentShiftData = {
        id: Math.random().toString(36).substr(2, 9),
        operatorname: data.operatorname,
        operatorid: operatorId,
        mode: data.mode,
        password: encryptedPassword
      };
      existingShifts.push(currentShiftData);
      await shiftadd({ alloperator: existingShifts, lastUpdateTs: Date.now() }, customerId, 'SERVER_SCOPE');
      setDatasource(existingShifts);
      Swal.fire("User created successfully!");
    } catch (error) {
      const errorMsg = error?.response?.data?.message;
      console.error('Error in operator creation flow:', error);
      Swal.fire('Error', errorMsg ? errorMsg : error.message, 'error');
    } finally {
      handleClose();
      reset(defaultShiftForm);
    }
  };

  const qualityValues = QUALITY_PAGELIST.map(p => p.value);
  const filteredPageList = useMemo(() => {


    if (
      [ROLE_ADMIN, ROLE_SUPER_ADMIN].includes(shiftForm.mode) &&
      cleanCustomerId(customerId) === CUSTOMER_IDS.PMI
    ) {
      const merged = [...pageList, ...QUALITY_PAGELIST];

      const uniquePages = merged.filter(
        (page, index, self) =>
          index === self.findIndex(p => p.value === page.value)
      );
      return uniquePages;
    }
    if (
      shiftForm.mode?.toLowerCase() === "quality" &&
      cleanCustomerId(customerId) === CUSTOMER_IDS.PMI
    ) {
      return QUALITY_PAGELIST;
    }
    return pageList.filter(p => !qualityValues.includes(p.value));
  }, [shiftForm.mode, pageList, customerId]);

  useEffect(() => {
    const allowedValues = filteredPageList.map(p => p.value);

    const cleaned = (shiftForm.pagelist || []).filter(v =>
      allowedValues.includes(v)
    );
    if (cleaned.length !== (shiftForm.pagelist || []).length) {
      setShiftForm(prev => ({ ...prev, pagelist: cleaned }));
      setValue("pagelist", cleaned);
    }
  }, [filteredPageList]);

  useEffect(() => {
    if (
      shiftForm.mode?.toLowerCase() === "quality" &&
      cleanCustomerId(customerId) === CUSTOMER_IDS.PMI
    ) {
      const qualityPages = QUALITY_PAGELIST.map(p => p.value);

      setShiftForm(prev => ({
        ...prev,
        pagelist: qualityPages
      }));

      setValue("pagelist", qualityPages);
    } else {
      setShiftForm(prev => ({
        ...prev,
        pagelist: []
      }));
      setValue("pagelist", []);
    }

    trigger("pagelist");
  }, [shiftForm.mode, customerId]);
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
                <div className={`form_field  ${errors.mode ? 'error-outline' : ''}`}>
                  <CustomDaySelect
                    {...register("mode", { required: "Mode is required" })}
                    onBlur={() => trigger('mode')}
                    ref={customDaySelectRef}
                    name="mode"
                    value={shiftForm.mode}
                    onChange={handleFormChange}
                    label="Select Role"
                    required={true}
                    options={availableRoles}
                    error={!!errors.mode}
                  />
                  {errors.mode && <div className="mat-error">Mode is required</div>}
                </div>

                {![ROLE_ADMIN, ROLE_MANAGER, ROLE_SUPER_ADMIN].includes(shiftForm.mode) && (

                  <div className={`form_field  ${errors.operatorid ? 'error-outline' : ''}`}>
                    <TextField
                      {...register("operatorid", {
                        required: "ID is required",
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
                      label="ID"
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
                )}
                <div className={`form_field  ${errors.operatorname ? 'error-outline' : ''}`}>
                  <TextField
                    inputRef={componentNameRef}
                    {...register("operatorname", {
                      required: "Name is required", validate: value =>
                        /^[a-zA-Z0-9\s]*$/.test(value) || "Special characters are not allowed", maxLength: {
                          value: 100,
                          message: "Maximum length is 100 characters"
                        }
                    })}
                    onBlur={() => trigger('operatorname')}
                    label="Name"
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
                  {errors.operatorname && <div className="mat-error">{errors.operatorname.message}</div>}
                </div>

                <div className={`form_field ${errors.email ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("email", {
                      required: "Email is required",
                      validate: value => {
                        const username = value?.replace(/@yantra24x7\.com$/, '').trim().toLowerCase();
                        return /^[a-z0-9._-]+$/.test(username) || "Invalid email format";
                      }
                    })}
                    onBlur={() => trigger('email')}
                    label="Email"
                    type="text"
                    name="email"
                    value={shiftForm.email?.replace(/@yantra24x7\.com$/, '') || ''}
                    onChange={(e) => {
                      const username = e.target.value.replace(/\s/g, '');
                      handleFormChange({ target: { name: 'email', value: username } });
                    }}

                    error={!!errors.email}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">@yantra24x7.com</InputAdornment>,
                    }}
                    InputLabelProps={{
                      required: true,
                      sx: { color: 'black', '&.Mui-focused': { color: 'orange' } },
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
                  {errors.email && <div className="mat-error">{errors.email.message}</div>}
                </div>

                {shiftForm.mode != ROLE_OPERATOR && (
                  <div className={`form_field ${errors.pagelist ? 'error-outline' : ''}`}>
                    <FormControl
                      fullWidth
                      error={!!errors.pagelist}
                      {...register("pagelist", { required: "Page list is required" })}
                    >
                      <InputLabel
                        required
                        sx={{
                          background: "#ededed",
                          color: "black",
                          '&.Mui-focused': { color: "orange" },
                        }}
                      >
                        Page Access
                      </InputLabel>

                      <Select
                        multiple
                        value={shiftForm.pagelist || []}
                        onChange={(e) => {
                          const { value } = e.target;

                          if (value.includes("all")) {
                            const allValues = filteredPageList.map((p) => p.value);
                            const isAllSelected = shiftForm.pagelist?.length === allValues.length;
                            const newValues = isAllSelected ? [] : allValues;
                            setShiftForm({ ...shiftForm, pagelist: newValues });
                            setValue("pagelist", newValues);
                            trigger("pagelist");
                            return;
                          }

                          setShiftForm({
                            ...shiftForm,
                            pagelist: typeof value === "string" ? value.split(",") : value,
                          });
                          setValue("pagelist", value);
                          trigger("pagelist");
                        }}
                        renderValue={(selected) =>
                          (selected || [])
                            .map((val) => filteredPageList.find((p) => p.value === val)?.label || val)
                            .join(", ")
                        }
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 48 * 5 + 8, // 5 items visible
                              width: 'auto',
                            },
                          },
                        }}
                        name="pagelist"
                        sx={{
                          '&.MuiOutlinedInput-root': {
                            '&.Mui-focused fieldset': {
                              borderColor: 'orange',
                            },
                            '&.Mui-focused.MuiInputBase-input': {
                              caretColor: 'orange',
                            },
                          },

                          '&.MuiSelect-icon': {
                            color: 'black',
                          },
                          '&.Mui-focused.MuiSelect-icon': {
                            color: 'orange',
                          },
                        }}
                      >
                        <MenuItem value="all">
                          <Checkbox
                            checked={shiftForm.pagelist?.length === filteredPageList.length} sx={{ '&.Mui-checked': { color: "#f47803ff" } }}
                          />
                          <ListItemText
                            primary={
                              shiftForm.pagelist?.length === filteredPageList.length
                                ? "Unselect All"
                                : "Select All"
                            }
                          />
                        </MenuItem>

                        {filteredPageList.map((page, index) => (
                          <MenuItem key={index} value={page.value}>
                            <Checkbox
                              checked={shiftForm.pagelist?.includes(page.value)}
                              sx={{ '&.Mui-checked': { color: "#f47803ff" } }}
                            />
                            <ListItemText primary={page.label} />
                          </MenuItem>
                        ))}
                      </Select>

                    </FormControl>
                    {errors.pagelist && <div className="mat-error">{errors.pagelist.message}</div>}
                  </div>
                )}

                {/* {cleanCustomerId(customerId) === CUSTOMER_IDS.PMI && (
)} */}
                <div className={`form_field ${errors.password ? 'error-outline' : ''}`}>
                  <TextField
                    {...register("password", {
                      required: "Password is required",
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
                    type={showPassword ? "text" : "password"}
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
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((prev) => !prev)}
                            edge="end"
                            tabIndex={-1}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
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