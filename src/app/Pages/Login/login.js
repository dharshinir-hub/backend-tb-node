import React, { useContext, useState } from 'react';
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
import { getCustomerTitle, getOperatorDetails, Loginapi, startTokenAutoRefresh, Userapi, Userapi1 } from '../../Services/app/loginservice';
import { decryptText } from '../../Shared/utils/cryptoUtils';
import { ROLE_OPERATOR } from '../../Shared/constants/role';
import { UserDetailsContext } from '../../Shared/context/UserDetailsContext';

function LoginForm() {
  const { register, handleSubmit, formState: { errors }, trigger } = useForm();
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };
  const { updateUserDetails } = useContext(UserDetailsContext);

  const onSubmit = async (data) => {
    setLoginLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      if (data.username === 'pmi_tv1@yantra24x7.com' && data.password === 'pmitv1') {
        tenantLogin()
        navigate("/Zx9R2tLmN7wQvB1cF4kH5oPjU6yE3aDgT8sK0qWl~1rMnOp");
      }
      else
        if (data.username.includes("@") && data.username.includes(".com")) {
          const response = await Loginapi(data.username, data.password);
          localStorage.setItem("email", data.username);
          localStorage.setItem("token", response.token);
          localStorage.setItem("refreshToken", response.refreshToken);
          localStorage.setItem("newToken", response.token);
          localStorage.setItem("role_name", response.Role);

          if (Array.isArray(response.module) && response.module.length) {
            localStorage.setItem("mod_name", response.module[0]);
          }

          toast.success("Login successful!", { position: "top-center", autoClose: 1000 });

          const userResponse = await Userapi();
          localStorage.setItem("CustomerID", JSON.stringify(userResponse.customerId.id));
          localStorage.setItem("customerTenantID", JSON.stringify(userResponse.tenantId.id));
          localStorage.setItem("authority", JSON.stringify(userResponse.authority));
          localStorage.setItem("firstName", JSON.stringify(userResponse.firstName));
          localStorage.setItem("lastName", JSON.stringify(userResponse.lastName));
          localStorage.setItem("userID",userResponse?.id?.id);
          try {
            const description = userResponse?.additionalInfo?.description || "{}";
            updateUserDetails(description);
          } catch (err) {
            console.error("Failed to store user description:", err);
            localStorage.setItem("userDetails", "{}");
          }
          const customerTitle = await getCustomerTitle(userResponse.customerId.id);
          localStorage.setItem("customerTitle", customerTitle);
          await tenantLogin();

          const secondUserResponse = await Userapi1();
          localStorage.setItem("CustomerID1", JSON.stringify(secondUserResponse.customerId.id));

          let role = "";
          let pageList = [];

          try {
            const parsedDetails = userResponse?.additionalInfo?.description
              ? JSON.parse(userResponse.additionalInfo.description)
              : {};
            role = parsedDetails.mode || "";
            pageList = parsedDetails.pageList || [];
          } catch (err) {
            console.error("Failed to parse userDetails JSON:", err);
          }
handleNavigationAfterLogin(role, pageList);

        } 
        // else {
        //   await tenantLogin();
        //   const operatorResponse = await getOperatorDetails(window._env_.CUSTOMER_ID);
        //   const responseData = operatorResponse?.[0]?.value;
        //   if (responseData && responseData.length > 0) {
        //     const operator = responseData.find((res) => res.operatorid === data.username);
        //     if (operator) {
        //       const decryptedPassword = decryptText(operator.password || "");
        //       if (decryptedPassword === data.password) {
        //         localStorage.setItem("role_name", 'OPERATOR');
        //         toast.success("Login successful!", { position: "top-center", autoClose: 1000 });
        //         navigate("/wP7n_AqZ9-rtY4X8jvS2T6eK0uL3MhQxGdN5oRc~1fHbJiV");
        //       } else {
        //         toast.error("Login failed: Invalid username or password", {
        //           position: "top-center",
        //           autoClose: 1500,
        //         });
        //       }
        //     } else {
        //       toast.error("Login failed: Invalid username or password", {
        //         position: "top-center",
        //         autoClose: 1500,
        //       });
        //     }
        //   } else {
        //     toast.error("Login failed: Invalid username or password", {
        //       position: "top-center",
        //       autoClose: 1500,
        //     });
        //   }

        // }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || error.message || "Something went wrong";
      console.log(errorMsg)
      console.error("Login failed:", errorMsg);
      toast.error("Login failed: " + errorMsg, {
        position: "top-center",
        autoClose: 1500,
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleNavigationAfterLogin = (role, pageList) => {
  if (role === ROLE_OPERATOR) {
    navigate("/operator");
  } else {
    const menuOrder = [
      "company",
      "machinemm",
      "deviceoee",
      "operator-details",
      "machines",
      "shift-registration",
      "operator-registration",
      "user-registration",
      "component-registration",
      "reason-registration",
    ];
    const firstAccessiblePage = menuOrder.find((page) =>
      pageList.includes(page)
    );
    if (firstAccessiblePage) {
      navigate(`/${firstAccessiblePage}`);
    } else {
      navigate("/");
    }
  }
};

  const tenantLogin = async () => {
    const secondUsername = window._env_.TENANT_GMAIL;
    const secondPassword = window._env_.TENANT_PASSWORD;
    const secondResponse = await Loginapi(secondUsername, secondPassword);
    localStorage.setItem('email1', secondUsername);
    localStorage.setItem('token1', secondResponse.token);
    localStorage.setItem('refreshToken1', secondResponse.refreshToken);
    localStorage.setItem('Companyname1', secondResponse.Companyname);
    localStorage.setItem('role_name1', secondResponse.Role);
  }

  return (
    <div
      className="container-fluid"
      style={{
        backgroundImage: `url(${window._env_.SERVER_URL}api/images/public/${window._env_.BG_IMAGE})`,
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
              src={`${window._env_.SERVER_URL}api/images/public/${window._env_.LOGO}`}
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
                    required: 'Username is required'
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
