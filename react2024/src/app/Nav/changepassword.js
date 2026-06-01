import React, { useState } from 'react';
import {
    Card,
    CardContent,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Typography,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import Swal from 'sweetalert2';
import lock from '../../assets/lock.png'; // adjust your path
import { changePassword } from '../Services/app/loginservice';

const ChangePasswordCard = ({ onClose }) => {
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    const togglePasswordVisibility = (field) => {
        setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const validate = () => {
        const newErrors = {};

        if (!form.currentPassword)
            newErrors.currentPassword = 'Current password is required';
        if (!form.newPassword)
            newErrors.newPassword = 'New password is required';
        else if (form.newPassword.length < 6)
            newErrors.newPassword = 'Password must be at least 6 characters';
        if (!form.confirmPassword)
            newErrors.confirmPassword = 'Confirm password is required';
        else if (form.newPassword !== form.confirmPassword)
            newErrors.confirmPassword = 'Passwords do not match';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        try {
            const response = await changePassword({
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            });

            if (response) {
                Swal.fire({
                    icon: 'success',
                    title: 'Password Changed Successfully!',
                    confirmButtonColor: '#F97316',
                });

                const newPasswordToken = response?.token;
                if (newPasswordToken) {
                    localStorage.setItem('token', newPasswordToken);
                }
                console.log('token', newPasswordToken)

                onClose?.(); 
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Password Change Failed',
                    text: response?.data?.message || 'Unexpected server response.',
                });
                onClose?.(); 

            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error Changing Password',
                text: error.response?.data?.message || 'Please try again later.',
            });
            onClose?.(); 

        }
    };

const renderPasswordField = (label, name, fieldKey) => (
  <div style={{ position: 'relative', marginBottom: '8px' }}>
    <TextField
      label={label}
      variant="outlined"
      fullWidth
      name={name}
      type={showPassword[fieldKey] ? 'text' : 'password'}
      value={form[name]}
      onChange={handleChange}
      error={!!errors[name]}
      margin="normal"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <img src={lock} alt="Lock Icon" style={{ width: 20, height: 20 }} />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              onClick={() => togglePasswordVisibility(fieldKey)}
              edge="end"
            >
              {showPassword[fieldKey] ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiInputBase-root': { borderRadius: 2 },
        '& .MuiOutlinedInput-input': { fontSize: 14 },
      }}
    />

    {errors[name] && (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          color: '#d32f2f',
          fontSize: '11px',
          marginTop: '1px',
          marginRight: '2px',
        }}
      >
        {errors[name]}
      </div>
    )}
  </div>
);


    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.3)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Card
                style={{
                    backgroundColor: '#FEFCFC',
                    padding: 24,
                    width: 440,
                    borderRadius: 6,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
            >
                <CardContent>
                    <Typography variant="h6" align="center" gutterBottom>
                        Change Password
                    </Typography>

                    {renderPasswordField('Current Password', 'currentPassword', 'current')}
                    {renderPasswordField('New Password', 'newPassword', 'new')}
                    {renderPasswordField('Confirm Password', 'confirmPassword', 'confirm')}

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginTop: 20,
                            gap: 12,
                        }}
                    >
                        <Button variant="outlined" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            sx={{ backgroundColor: '#F97316', color: 'white' }}
                            onClick={handleSubmit}
                        >
                            Save
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ChangePasswordCard;
