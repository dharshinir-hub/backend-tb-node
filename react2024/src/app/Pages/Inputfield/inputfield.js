import React, { useState,forwardRef } from 'react';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
// Email field component
export const CustomEmailField = ({ register, name, rules, errors, trigger, ...props }) => {
  return (
    <TextField
      {...register(name, {
        ...rules,
        onBlur: () => trigger(name),
      })}
      error={!!errors[name]}
      helperText={errors[name] ? "Please enter a valid email address" : ""}
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
          '& .MuiInputLabel-root': {
            color: 'black', // Label color (default)
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: 'orange', // Label color when focused
          },
          '&.Mui-focused .MuiOutlinedInput-input': {
            caretColor: 'orange',
          },
          '&::placeholder': {
            color: 'black', // Placeholder text color
            opacity: 1,

          },
        },
      }}
      {...props}
    />
  );
};


// Password field component
export const CustomPasswordField = ({ register, name, rules, errors, trigger, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TextField
      {...register(name, {
        ...rules,
        onBlur: () => trigger(name)
      })}
      type={showPassword ? "text" : "password"}
      error={!!errors[name]}
      helperText={errors[name] ? "Please enter your password" : ""}
      InputProps={{
        startAdornment: (
          <span style={{ marginRight: 8, color: 'black', display: 'flex', alignItems: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="9" rx="2" fill="#ec6e17"/>
              <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="#ec6e17" strokeWidth="2" fill="none"/>
              <circle cx="12" cy="16" r="1.5" fill="#fff"/>
            </svg>
          </span>
        ),
        endAdornment: (
          <IconButton
            onClick={() => setShowPassword(!showPassword)}
            sx={{
              color: 'black',
              backgroundColor: 'transparent',
              '&:focus': {
                outline: 'none',
              },
            }}
          >
            {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </IconButton>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: 'black', // Default border color
          },
          '&:hover fieldset': {
            borderColor: 'black', // Border color on hover
          },
          '&.Mui-focused fieldset': {
            borderColor: 'orange', // Border color when focused
          },
          '& .MuiOutlinedInput-input': {
            color: 'black', // Text color
          },
          '&.Mui-focused .MuiOutlinedInput-input': {
            caretColor: 'orange', // Caret color when focused
          },
          
        },
      }}
      {...props}
    />
  );
};






//dropdown filed
export const CustomDaySelect = forwardRef(({ inputRef,name, value, onChange, label, options,...props }, ref) => {
  return (
    <FormControl variant="outlined" fullWidth {...props}>
      <InputLabel
        htmlFor={name}
        shrink
        inputRef={inputRef || ref}
        sx={{
          color: 'black',
          pointerEvents: 'none',
          transform: value? 'translate(14px, 0px) scale(0.75)' : 'translate(14px, 20px) scale(1)',
          transition: 'transform 0.2s ease-out',
          '&.Mui-focused': {
            color: 'orange',
            transform: 'translate(14px, 0px) scale(0.75)',
          },
        }}
      >
        {label}
      </InputLabel>
      <Select
        name={name}
        value={value}
        onChange={onChange}
        placeholder={label}
        ref={ref}
        input={<OutlinedInput
          sx={{
            '&.MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'black',
              },
              '&:hover fieldset': {
                borderColor: 'black',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'orange',
              },
              '&.MuiInputBase-input': {
                color: 'black', // Adjusted input text color
              },
              '&.Mui-focused.MuiInputBase-input': {
                caretColor: 'orange',
              },
              '&.MuiInputBase-input::placeholder': {
                color: 'black',
                opacity: 1,
              },
             
            },
            
            '&.MuiSelect-icon': {
              color: 'black',
            },
            '&.Mui-focused.MuiSelect-icon': {
              color: 'orange',
            },
          }}
        />}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
});

//Date picker
export const CustomDateSelect = forwardRef(
  ({ name, value, onChange, label, required, ...props }, ref) => {
    return (
      <DatePicker
        label={label}
        value={value} // <-- should be a dayjs object
        format="DD-MM-YYYY" // <-- display format
        inputRef={ref}
        onChange={(newValue) => {
          // Send dayjs object back to parent
          onChange(newValue); // <-- no formatting here
        }}
        slotProps={{
          textField: {
            name,
            variant: 'outlined',
            required,
            fullWidth: true,
            sx: {
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
                '& input': {
                  color: 'black',
                },
                '&.Mui-focused input': {
                  caretColor: 'orange',
                },
              },
              '& label': {
                color: 'black !important',
              },
              '& label.Mui-focused': {
                color: 'orange',
              },
              caretColor: 'hotpink',
            },
            '&::placeholder': {
              color: 'black',
              opacity: 1,
            },
          },
        }}
        {...props}
      />
    );
  }
);


export const convertTo24Hour=(time) =>{
  const [timePart, modifier] = time.split(' ');
  let [hours, minutes, seconds] = timePart.split(':').map(Number);

  if (modifier === 'PM' && hours !== 12) {
      hours += 12;
  } else if (modifier === 'AM' && hours === 12) {
      hours = 0;
  }

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = seconds.toString().padStart(2, '0');

  return `${hoursStr}:${minutesStr}:${secondsStr}`;
}
