import React, { useState } from 'react';
import { Card, CardHeader, CardContent, Button } from '@mui/material';
import { useForm } from 'react-hook-form';
import './login.css';
import Spinner from 'react-bootstrap/Spinner';
import { toast } from 'react-toastify';
 import { useNavigate } from 'react-router-dom';
import { CustomEmailField, CustomPasswordField } from '../Inputfield/inputfield';
import { Loginapi, Userapi,Userapi1 } from '../../Services/app/loginservice';
import { startTokenAutoRefresh } from '../../Services/app/authservice';

function LoginForm() {
  const { register, handleSubmit, formState: { errors }, trigger } = useForm();
  const [loginLoading, setLoginLoading] = useState(false);
  const [configureLoading, setConfigureLoading] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    setConfigureLoading(true);
    console.log('Configure button clicked');
    window.location.href = "http://74.224.122.231:8080/home";
    setConfigureLoading(false);
  };
  
 
  
  const onSubmit = async (data) => {
    setLoginLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // First user login
      const response = await Loginapi(data.username, data.password);
      localStorage.setItem('email', data.username);
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('newToken', response.token); // Initial newToken

      localStorage.setItem('role_name', response.Role);
      if (Array.isArray(response.module) && response.module.length) {
        localStorage.setItem('mod_name', response.module[0]);
      }

      toast.success('Login successful!', {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });

      const userResponse = await Userapi();
      console.log('First User Response:', userResponse);
      localStorage.setItem('CustomerID', JSON.stringify(userResponse.customerId.id));
      console.log('First CustomerID:', localStorage.getItem('CustomerID'));
      localStorage.setItem('authority', JSON.stringify(userResponse.authority));
      localStorage.setItem('firstName', JSON.stringify(userResponse.firstName));
      localStorage.setItem('lastName', JSON.stringify(userResponse.lastName));

      // Second user login
      const secondUsername = "kiruthikam@gmail.com";
      const secondPassword = "yantra";
      const secondResponse = await Loginapi(secondUsername, secondPassword);
      localStorage.setItem('email1', secondUsername);
      localStorage.setItem('token1', secondResponse.token);
      localStorage.setItem('Companyname1', secondResponse.Companyname);
      localStorage.setItem('role_name1', secondResponse.Role);

      const secondUserResponse = await Userapi1();
      console.log('Second User Response:', secondUserResponse);
      localStorage.setItem('CustomerID1', JSON.stringify(secondUserResponse.customerId.id));
      console.log('Second CustomerID1:', localStorage.getItem('CustomerID1'));

      // Navigate after both users are set up
      navigate('/andon-dashboard');
    } catch (error) {
      toast.error('Login failed: ' + error.message, {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      console.error('Login failed:', error);
    } finally {
      setLoginLoading(false);
    }
  }
  return (
    <div
      className="container-fluid"
      style={{
        backgroundImage: `url(${window._env_.SERVER_URL}api/images/public/lV9yqcjsjFbzq9jD1shjyPJuv5G1Y6yw)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        className="right-column"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          width: "100%",
        }}
      >
        <Card className="login-card">
          <div style={{ padding: '15px 0' }}>
            <img
              src={`${window._env_.SERVER_URL}api/images/public/dqflY4QZLWQaUSSYKUKACqFmwQ6K3BqG`}
              alt="yantra-logo.png"
              style={{ maxWidth: '300px', display: 'block', margin: '0 auto' ,height:'80px'}}
              
            />
          </div>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="inputs">
                <CustomEmailField
                  register={register}
                  freeSolo
                  name="username"
                  rules={{ required: true, pattern: /^\S+@\S+$/i }}
                  errors={errors}
                  trigger={trigger}
                  required
                  id="outlined-basic"
                  variant="outlined"
                  label="Username"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <span style={{ marginRight: 8, color: 'black', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" stroke="none" fill="#ec6e17"/>
                          <path d="M22 6 12 13 2 6" stroke="#fff" strokeWidth="2" fill="none"/>
                        </svg>
                      </span>
                    ),
                  }}
                />
              </div>
              <br />
              <div className="inputs">
                {/* Password input */}
                {/* 
                  CustomPasswordField does not natively support passing a custom endAdornment (for the eye/lock icon) 
                  because it manages its own show/hide logic and icon. 
                  To show both a lock icon (startAdornment) and the show/hide (eye) icon (endAdornment), 
                  you can pass both via InputProps, and ensure CustomPasswordField uses InputProps.endAdornment if provided.
                */}
                <CustomPasswordField
                  register={register}
                  freeSolo
                  name="password"
                  rules={{ required: true }}
                  errors={errors}
                  trigger={trigger}
                  label="Password"
                  required
                  variant="outlined"
                  fullWidth
                
                />
                {/* 
                  The lock icon (startAdornment) will always show on the left.
                  The eye/eye-off icon (endAdornment) will always show on the right and toggle password visibility.
                  Both icons will be visible and functional.
                */}
              </div>
              <br />
              <div style={{ textAlign: "center" }}>
                {/* Login button */}
                <Button
                  type="submit"
                  variant="contained"
                  color="warning"
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <>
                      <Spinner
                        as="span"
                        variant="info"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                      />
                      <span className="visually-hidden">Loading...</span>
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>

                &nbsp;&nbsp;

                {/* <Button
                  onClick={handleClick}
                  variant="contained"
                  color="warning"
                  disabled={configureLoading}
                >
                  {configureLoading ? (
                    <>
                      <Spinner
                        as="span"
                        variant="info"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                      />
                      <span className="visually-hidden">Loading...</span>
                    </>
                  ) : (
                    "Configure"
                  )}
                </Button> */}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginForm;
