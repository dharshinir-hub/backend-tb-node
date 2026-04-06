
import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
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
import { Checkbox, FormControl, InputAdornment, InputLabel, ListItemText, MenuItem, Select, Tooltip } from '@mui/material';
import { shiftadd } from '../../Services/app/masterservice';
import { CustomDaySelect } from '../Inputfield/inputfield';
import { decryptText, encryptText } from '../../Shared/utils/cryptoUtils';
import { cleanCustomerId, createNewUser } from '../../Services/app/operatorservice';
import { ROLE_ADMIN, ROLE_MANAGER, ROLE_OPERATOR, ROLE_SUPER_ADMIN, ROLES } from '../../Shared/constants/role';
import { useUserRole } from '../../Shared/hooks/useUserRole';
import { useRoleOptions } from '../../Shared/hooks/useRoleOptions';
import { PAGE_LIST, QUALITY_PAGELIST } from '../../Shared/constants/pages';
import { UserDetailsContext } from '../../Shared/context/UserDetailsContext';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { changePasswordWithUserToken, fakeLogin } from '../../Services/app/loginservice';

export default function UserEdit({ open, handleClose, handleAdd, dialogOpenCount, datasource, setDatasource, customerId, dialogData }) {
  console.log('datasource', datasource);
  console.log('dialogData', dialogData);
  const dialogBackgroundColor = dialogOpenCount === 0 ? '#f7f7f7' : '#ededed';
  const [shiftsmodule, setShiftsmodule] = useState([]);
  const customDaySelectRef = useRef();
  const [shiftsmode, setShiftsmode] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  const componentNameRef = useRef();

  const { userDetails } = useContext(UserDetailsContext);
  const [pageList, setPageList] = useState([]);
  const { userRole, isOperator, isSupervisor, isMaintenance, isQuality, isManager, isAdmin, isSuperAdmin } = useUserRole();

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
    if (open) {
      const timer = setTimeout(() => {
        if (componentNameRef.current) {
          componentNameRef.current.focus();
        }
      }, 100);

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
    setValue(name, value);
    trigger(name);
  };
  const defaultShiftForm = useMemo(() => ({
    operatorname: '',
    operatorid: '',
    mode: '',
    password: '',
    email: '',
    pagelist: ''
  }), []);
  const { availableRoles } = useRoleOptions();

  const [shiftForm, setShiftForm] = useState(defaultShiftForm);

  const onSubmit = async (data) => {
    const customerId = JSON.parse(localStorage.getItem('CustomerID'));
    const tenantId = JSON.parse(localStorage.getItem('customerTenantID'));

    try {
      const apiId = dialogData?.id?.id;
      const shiftIdToEdit = dialogData?.userDetails?.userId;

      if (!apiId || !shiftIdToEdit) {
        throw new Error('Cannot update user: required user IDs are missing.');
      }
      let existingShifts = Array.isArray(datasource) ? [...datasource] : [];
      const existingShiftIndex = existingShifts.findIndex(
        (item) => item.operatorid === shiftIdToEdit
      );

      if (existingShiftIndex === -1) {
        throw new Error('Shift not found for local update.');
      }

      const isDuplicate = existingShifts.some((item, index) => {
        if (index === existingShiftIndex) return false;
        return (
          item.operatorid?.toString().trim().toLowerCase() ===
          data.operatorid?.toString().trim().toLowerCase()
        );
      });
      if (isDuplicate) {
        Swal.fire('Error', 'Duplicate Operator ID is not allowed.', 'error');
        return;
      }

      const encryptedPassword = data.password?.trim()
        ? encryptText(data.password.trim())
        : '';
      const oldPassword = dialogData?.userDetails?.password
        ? decryptText(dialogData.userDetails.password)
        : '';
      const isPasswordChanged =
        data.password?.trim() && data.password.trim() !== oldPassword;
      let finalEncryptedPassword = dialogData?.userDetails?.password || encryptedPassword;
      const email = data.email + '@yantra24x7.com';
      if (isPasswordChanged) {
        try {
          const userTokens = await fakeLogin(email, oldPassword);
          const pwdPayload = {
            currentPassword: oldPassword,
            newPassword: data.password?.trim(),
          };
          await changePasswordWithUserToken(pwdPayload, userTokens.token);
          console.log('Password successfully changed!');
          finalEncryptedPassword = encryptedPassword;
        } catch (err) {
          console.warn('Password change failed — using old password:', err);
          Swal.fire(
            'Warning',
            'User updated, but password change failed. Old password retained.',
            'warning'
          );
        }
      }

      const descriptionObj = {
        mode: data.mode,
        userId: data.operatorid,
        pageList: data.mode === ROLE_OPERATOR ? ['operator'] : data.pagelist,
        password: finalEncryptedPassword,
      };

      const payload = {
        id: { entityType: 'USER', id: dialogData.id.id },
        tenantId: { entityType: 'TENANT', id: tenantId },
        customerId: { entityType: 'CUSTOMER', id: customerId },
        email: email,
        authority: 'CUSTOMER_USER',
        firstName: data.operatorname,
        lastName: null,
        phone: null,
        name: email,
        additionalInfo: {
          description: JSON.stringify(descriptionObj),
          defaultDashboardId: null,
          defaultDashboardFullscreen: false,
          homeDashboardId: null,
          homeDashboardHideToolbar: true,
          userCredentialsEnabled: false,
          role: descriptionObj.mode,
          userId: descriptionObj.userId,
          pageList: descriptionObj.pageList,
        },
      };

      console.log('Payload for user update:', payload);

      const updatedUser = await createNewUser(payload);
      if (!updatedUser?.id?.id) {
        throw new Error('User ID not returned from update API');
      }

      existingShifts[existingShiftIndex] = {
        ...existingShifts[existingShiftIndex],
        id: shiftIdToEdit,
        operatorname: data.operatorname,
        operatorid: data.operatorid,
        mode: data.mode,
        pagelist: descriptionObj.pageList,
        pageList: descriptionObj.pageList,
        ...(data.mode === 'Operator' && { password: finalEncryptedPassword }),
      };

      const formData = {
        alloperator: existingShifts,
        lastUpdateTs: Date.now(),
      };

      const response = await shiftadd(formData, customerId, 'SERVER_SCOPE');
      setDatasource(existingShifts);
      Swal.fire(response.msg || 'User updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      handleClose();
      reset(defaultShiftForm);
    }
  };

  useEffect(() => {
    if (!open) {
      reset(defaultShiftForm);
      setShiftForm(defaultShiftForm);
    } else {

      if (dialogData) {
        console.log(dialogData, 'dialogdata')
        const initialFormState = {
          operatorname: dialogData.firstName || '',
          operatorid: dialogData.userDetails.userId || '',
          mode: dialogData.userDetails.mode || '',
          language: dialogData.language || '',
          experiencelevel: dialogData.experiencelevel || '',
          password: dialogData.userDetails.password ? decryptText(dialogData.userDetails.password) : '',
          email: dialogData.email ? dialogData.email.split('@')[0] : '',
          pagelist: dialogData.userDetails.pageList || []
        };
        setShiftForm(initialFormState);
        reset(initialFormState);
      } else {
        setShiftForm(defaultShiftForm);
        reset(defaultShiftForm);
      }
    }
  }, [open, reset, defaultShiftForm, dialogData, shiftsmodule]);


  const qualityValues = QUALITY_PAGELIST.map(p => p.value);

  const filteredPageList = useMemo(() => {
    const customer = cleanCustomerId(customerId);

    // ✅ PMI (unchanged)
    if (
      [ROLE_ADMIN, ROLE_SUPER_ADMIN].includes(shiftForm.mode) &&
      customer === window._env_.PMI_CUSTOMER_ID
    ) {
      const merged = [...pageList, ...QUALITY_PAGELIST];

      const uniquePages = merged.filter(
        (page, index, self) =>
          index === self.findIndex(p => p.value === page.value)
      );
      return uniquePages;
    }

    // ✅ GPLAST Admin/Super Admin
    if (
      [ROLE_ADMIN, ROLE_SUPER_ADMIN].includes(shiftForm.mode) &&
      customer === window._env_.GPLAST_CUSTOMER_ID
    ) {
      const merged = [...pageList, { value: "quality", label: "Quality Entry" }];

      const uniquePages = merged.filter(
        (page, index, self) =>
          index === self.findIndex(p => p.value === page.value)
      );
      return uniquePages;
    }

    // ✅ PMI Quality (unchanged)
    if (
      shiftForm.mode?.toLowerCase() === "quality" &&
      customer === window._env_.PMI_CUSTOMER_ID
    ) {
      return QUALITY_PAGELIST;
    }

    // ✅ GPLAST Quality
    if (
      shiftForm.mode?.toLowerCase() === "quality" &&
      customer === window._env_.GPLAST_CUSTOMER_ID
    ) {
      return [{ value: "quality", label: "Quality Entry" }];
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
    const customer = cleanCustomerId(customerId);

    if (shiftForm.mode === ROLE_OPERATOR) {
      setShiftForm(prev => ({
        ...prev,
        pagelist: ["operator"]
      }));
      setValue("pagelist", ["operator"]);
    } else if (
      shiftForm.mode?.toLowerCase() === "quality" &&
      customer === window._env_.PMI_CUSTOMER_ID
    ) {
      const qualityPages = QUALITY_PAGELIST.map(p => p.value);

      setShiftForm(prev => ({
        ...prev,
        pagelist: qualityPages
      }));

      setValue("pagelist", qualityPages);

      // 👉 GPLAST logic
    } else if (
      shiftForm.mode?.toLowerCase() === "quality" &&
      customer === window._env_.GPLAST_CUSTOMER_ID
    ) {
      const qualityPages = ["quality"];

      setShiftForm(prev => ({
        ...prev,
        pagelist: qualityPages
      }));

      setValue("pagelist", qualityPages);

    }

    trigger("pagelist");
  }, [shiftForm.mode, customerId]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="300px" PaperProps={{ style: { backgroundColor: dialogBackgroundColor } }}>
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
                    disabled
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
                )}

                <div className={`form_field  ${errors.operatorname ? 'error-outline' : ''}`}>
                  <TextField
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
                    disabled
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
                              maxHeight: 48 * 5 + 8,
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
                        {/* Select All option */}
                        <MenuItem value="all">
                          <Checkbox
                            checked={
                              (shiftForm.pagelist || []).length === filteredPageList.length &&
                              filteredPageList.length > 0
                            }
                            sx={{ '&.Mui-checked': { color: "#f47803ff" } }}
                          />
                          <ListItemText
                            primary={
                              (shiftForm.pagelist || []).length === filteredPageList.length
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
                {(isAdmin || isSuperAdmin || isManager) && (
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
                )}

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
