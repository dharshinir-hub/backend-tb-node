import React, { useState } from 'react';
import { Card, CardContent, Button, InputAdornment, IconButton, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import './login.css';
import Spinner from 'react-bootstrap/Spinner';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import mail from '../../../assets/mail.png';
import lock from '../../../assets/lock.png';
import { Loginapi, Userapi, Userapi1 } from '../../Services/app/loginservice';
import { startTokenAutoRefresh } from '../../Services/app/authservice';

function LoginForm() {
  const { register, handleSubmit, formState: { errors }, trigger } = useForm();
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    window.location.href = "http://74.224.122.231:8080/home";
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const onSubmit = async (data) => {
    setLoginLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const response = await Loginapi(data.username, data.password);
      localStorage.setItem('email', data.username);
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('newToken', response.token);
      localStorage.setItem('role_name', response.Role);

      if (Array.isArray(response.module) && response.module.length) {
        localStorage.setItem('mod_name', response.module[0]);
      }

      toast.success('Login successful!', { position: "top-center", autoClose: 1000 });

      const userResponse = await Userapi();
      localStorage.setItem('CustomerID', JSON.stringify(userResponse.customerId.id));
      localStorage.setItem('authority', JSON.stringify(userResponse.authority));
      localStorage.setItem('firstName', JSON.stringify(userResponse.firstName));
      localStorage.setItem('lastName', JSON.stringify(userResponse.lastName));

      const secondUsername = "pms@gmail.com";
      const secondPassword = "pmspms";
      const secondResponse = await Loginapi(secondUsername, secondPassword);
      localStorage.setItem('email1', secondUsername);
      localStorage.setItem('token1', secondResponse.token);
      localStorage.setItem('Companyname1', secondResponse.Companyname);
      localStorage.setItem('role_name1', secondResponse.Role);

      const secondUserResponse = await Userapi1();
      localStorage.setItem('CustomerID1', JSON.stringify(secondUserResponse.customerId.id));

      navigate('/company');
    } catch (error) {
      toast.error('Login failed: ' + error.message, { position: "top-center", autoClose: 1000 });
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div
      className="container-fluid"
      style={{
        backgroundImage: `url(${window._env_.SERVER_URL}api/images/public/76qC9HzBmPBNFqTBaHGwF40Wka0Ri03C)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="right-column" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", width: "100%" }}>
        <Card className="login-card">
          <div style={{ padding: '15px 0' }}>
            <img
              src={`${window._env_.SERVER_URL}api/images/public/b0coVWpU9C1Ztg9CrjtkHgi87ia4gFxH`}
              alt="yantra-logo.png"
              style={{ maxWidth: '300px', display: 'block', margin: '0 auto', height: '80px' }}
            />
          </div>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Email Field */}
              <div className="inputs">
                <TextField
                  label="Username"
                  variant="outlined"
                  fullWidth
                  {...register('username', {
                    required: 'Username is required',
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  error={!!errors.username}
                  helperText={errors.username?.message}
                  onBlur={() => trigger('username')}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <img src={mail} alt="Mail Icon" style={{ width: 24, height: 24 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </div>

              <br />

              {/* Password Field */}
              <div className="inputs">
                <TextField
                  label="Password"
                  variant="outlined"
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  onBlur={() => trigger('password')}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <img src={lock} alt="Lock Icon" style={{ width: 24, height: 24 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={togglePasswordVisibility} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </div>

              <br />

              <div style={{ textAlign: "center" }}>
                <Button type="submit" variant="contained" color="warning" disabled={loginLoading}>
                  {loginLoading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" role="status" />
                      <span className="visually-hidden">Loading...</span>
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginForm;
