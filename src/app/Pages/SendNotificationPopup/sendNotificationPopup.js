import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Button,
  Box,
  TextField,
  Autocomplete,
  Chip,
  Card,
  CardContent,
  Typography,
  Divider,
  IconButton,
  Switch,
  Popover,
  Grid,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import { FiSend, FiX, FiUsers, FiCheck, FiBell, FiInfo, FiAlertTriangle, FiLink, FiExternalLink } from "react-icons/fi";
import { FaCheck, FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import { getRecipientGroups, getRecipientGroupsFromAttribute, sendNotification } from "../../Services/app/notificationservice";
import { getCustomerUsers } from "../../Services/app/operatorservice";
import Swal from "sweetalert2";
import './sendNotificationPopup.css';
import CreateGroupDialog from "../CreateGroupDialog/createGroupDialog";

// Orange color theme
const orangeTheme = createTheme({
  palette: {
    primary: {
      main: "#F47804",
      light: "#FF9A45",
      dark: "#D86602",
      contrastText: "#fff",
    },
    secondary: {
      main: "#6B7280",
      light: "#9CA3AF",
      dark: "#4B5563",
    },
    success: {
      main: "#10B981",
    },
  },
});

const PRIMARY_COLOR = "#F47804";
const SECONDARY_COLOR = "#6B7280";
const SUCCESS_COLOR = "#10B981";



// =====================================================
// Main Send Notification Popup
// =====================================================
const SendNotificationPopup = () => {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [recipientGroups, setRecipientGroups] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  
  // Icon configuration state
  const [iconEnabled, setIconEnabled] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState("info");
  const [selectedColor, setSelectedColor] = useState("#6B7280");
  const [iconPopoverAnchor, setIconPopoverAnchor] = useState(null);
  const [colorPopoverAnchor, setColorPopoverAnchor] = useState(null);
  const [customHexColor, setCustomHexColor] = useState("");
  
  // Action button configuration state
  const [actionButtonEnabled, setActionButtonEnabled] = useState(false);
  const [actionButtonText, setActionButtonText] = useState("");
  const [actionButtonLink, setActionButtonLink] = useState("");

  const steps = ["Recipients", "Compose", "Review"];

  // Color palette options
  const colorOptions = [
    { name: "Primary", value: PRIMARY_COLOR },
    { name: "Gray", value: "#6B7280" },
    { name: "Red", value: "#DC2626" },
    { name: "Green", value: "#059669" },
    { name: "Blue", value: "#2563EB" },
    { name: "Purple", value: "#7C3AED" },
    { name: "Pink", value: "#DB2777" },
    { name: "Yellow", value: "#D97706" },
    { name: "Teal", value: "#0D9488" },
    { name: "Indigo", value: "#4F46E5" },
  ];

  const iconList = {
    info: <FaInfoCircle />,
    warning: <FaExclamationTriangle />,
    error: <FaExclamationCircle />,
    check: <FaCheck />
  };

  // Map frontend icon keys to backend icon values
  const iconMapping = {
    info: 'info',
    warning: 'warning',
    error: 'error',
    check: 'check',
    bell: 'notifications'
  };

  // Reset all configuration states when dialog closes
  const resetConfigurationStates = () => {
    setIconEnabled(false);
    setSelectedIcon("info");
    setSelectedColor("#6B7280");
    setActionButtonEnabled(false);
    setActionButtonText("");
    setActionButtonLink("");
    setCustomHexColor("");
    setIconPopoverAnchor(null);
    setColorPopoverAnchor(null);
  };

  const fetchRecipientGroups = async () => {
    try {
      const res = await getRecipientGroupsFromAttribute();
      const allGroups = res || [];
      setRecipientGroups(allGroups);
    } catch (error) {
      console.error("Error fetching recipient groups:", error);
      await Swal.fire({
        icon: 'error',
        title: 'Load Failed',
        text: 'Failed to load recipient groups.',
        confirmButtonColor: PRIMARY_COLOR,
      });
    }
  };

  const getUsersList = async () => {
    try {
      const customerId = JSON.parse(localStorage.getItem("CustomerID"));
      const res = await getCustomerUsers(customerId);
      const usersList = res.data || [];
      const modifiedUsers = usersList.map((u) => ({ id: u?.id?.id, email: u?.email }));
      setAvailableUsers(modifiedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      await Swal.fire({
        icon: 'error',
        title: 'Load Failed',
        text: 'Failed to load users list.',
        confirmButtonColor: PRIMARY_COLOR,
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecipientGroups();
      getUsersList();
    }
  }, [open]);

const handleSend = async () => {
  if (selectedGroups.length === 0) return;
  setLoading(true);
  try {
    const targetIds = selectedGroups.map((group) => group.id.id);

    // Icon configuration
    const iconConfig = iconEnabled
      ? { enabled: true, icon: iconMapping[selectedIcon] || "info", color: selectedColor }
      : { enabled: false, icon: "info", color: "#757575" };

    // Action button configuration
    const actionButtonConfig = actionButtonEnabled && actionButtonText && actionButtonLink
      ? {
          enabled: true,
          text: actionButtonText,
          link: actionButtonLink,
          linkType: "LINK"
        }
      : { enabled: false, text: "", link: "", linkType: "LINK" };

    await sendNotification(targetIds, subject, message, iconConfig, actionButtonConfig);

    await Swal.fire({
      icon: "success",
      title: "Notification Sent!",
      text: "Your notification has been sent successfully.",
      confirmButtonColor: PRIMARY_COLOR,
      timer: 2500,
      showConfirmButton: false,
      background: "#fff",
      customClass: { popup: "swal-front-popup" },
      didOpen: () => {
        document.querySelector(".swal2-container")?.focus();
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    handleClose();
  } catch (error) {
    console.error("Error sending notification:", error);
    await Swal.fire({
      icon: "error",
      title: "Send Failed",
      text: error.message || "Failed to send notification. Please try again.",
      confirmButtonColor: PRIMARY_COLOR,
      background: "#fff",
      customClass: { popup: "swal-front-popup" },
    });
  } finally {
    setTimeout(() => setLoading(false), 300);
  }
};


  const handleClose = () => {
    setOpen(false);
    setActiveStep(0);
    setSelectedGroups([]);
    setSubject("");
    setMessage("");
    resetConfigurationStates();
  };

  const handleIconClick = (event) => {
    setIconPopoverAnchor(event.currentTarget);
  };

  const handleColorClick = (event) => {
    setColorPopoverAnchor(event.currentTarget);
  };

  const handleIconSelect = (iconKey) => {
    setSelectedIcon(iconKey);
    setIconPopoverAnchor(null);
  };

  const handleColorSelect = (colorValue) => {
    setSelectedColor(colorValue);
    setColorPopoverAnchor(null);
  };

  const handleCustomColorApply = () => {
    if (customHexColor) {
      // Validate hex color format
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (hexColorRegex.test(customHexColor)) {
        setSelectedColor(customHexColor);
        setColorPopoverAnchor(null);
        setCustomHexColor("");
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Invalid Color',
          text: 'Please enter a valid hex color code (e.g., #FF0000 or #F00)',
          confirmButtonColor: PRIMARY_COLOR,
        });
      }
    }
  };

  const handleIconPopoverClose = () => {
    setIconPopoverAnchor(null);
  };

  const handleColorPopoverClose = () => {
    setColorPopoverAnchor(null);
    setCustomHexColor("");
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: "text.primary" }}>
              Select recipient groups
            </Typography>
            <Autocomplete
              multiple
              options={recipientGroups}
              getOptionLabel={(option) => option.name}
              value={selectedGroups}
              onChange={(e, newValue) => setSelectedGroups(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Recipient Groups"
                  placeholder="Select groups..."
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    {...getTagProps({ index })}
                    size="small"
                    variant="outlined"
                  />
                ))
              }
            />
            <Button
              variant="text"
              startIcon={<FiUsers />}
              sx={{ mt: 2, color: PRIMARY_COLOR, "&:hover": { backgroundColor: "rgba(244, 120, 4, 0.04)" } }}
              onClick={() => setCreateGroupOpen(true)}
            >
              Create new group
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box>
            <TextField
              fullWidth
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              sx={{ mb: 3 }}
            />
            <TextField
              fullWidth
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              multiline
              rows={5}
              placeholder="Type your notification message here..."
            />

            {/* Visual Settings */}
            <Card variant="outlined" sx={{ mt: 3, p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Notification Settings
              </Typography>

              {/* Icon Settings */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Switch
                      checked={iconEnabled}
                      onChange={(e) => setIconEnabled(e.target.checked)}
                      size="small"
                      color="primary"
                    />
                    <Typography variant="body1" fontWeight={500}>Show Icon</Typography>
                  </Box>

                  {iconEnabled && (
                    <Box display="flex" alignItems="center" gap={2}>
                      {/* Icon Selector */}
                      <Box>
                        <IconButton
                          onClick={handleIconClick}
                          size="small"
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            color: selectedColor,
                            width: 40,
                            height: 40,
                            "&:hover": { backgroundColor: "rgba(244, 120, 4, 0.04)" }
                          }}
                        >
                          {iconList[selectedIcon] || <FaInfoCircle />}
                        </IconButton>

                        <Popover
                          open={Boolean(iconPopoverAnchor)}
                          anchorEl={iconPopoverAnchor}
                          onClose={handleIconPopoverClose}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                          }}
                          PaperProps={{
                            sx: {
                              p: 2,
                              borderRadius: 2,
                              boxShadow: 3,
                            }
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                            Select Icon
                          </Typography>
                          <Grid container spacing={1} sx={{ width: 200 }}>
                            {Object.keys(iconList).map((key) => (
                              <Grid item key={key}>
                                <IconButton
                                  onClick={() => handleIconSelect(key)}
                                  size="small"
                                  sx={{
                                    border: selectedIcon === key ? "2px solid" : "1px solid",
                                    borderColor: selectedIcon === key ? PRIMARY_COLOR : "divider",
                                    color: "text.primary",
                                    width: 40,
                                    height: 40,
                                    '&:hover': {
                                      backgroundColor: 'rgba(244, 120, 4, 0.08)',
                                    },
                                  }}
                                >
                                  {iconList[key]}
                                </IconButton>
                              </Grid>
                            ))}
                          </Grid>
                        </Popover>
                      </Box>

                      {/* Color Selector */}
                      <Box>
                        <IconButton
                          onClick={handleColorClick}
                          size="small"
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            width: 40,
                            height: 40,
                            position: 'relative',
                            "&:hover": { backgroundColor: "rgba(244, 120, 4, 0.04)" },
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: selectedColor,
                              border: '1px solid #ddd',
                            }
                          }}
                        />

                        <Popover
                          open={Boolean(colorPopoverAnchor)}
                          anchorEl={colorPopoverAnchor}
                          onClose={handleColorPopoverClose}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                          }}
                          PaperProps={{
                            sx: {
                              p: 2,
                              borderRadius: 2,
                              boxShadow: 3,
                              width: 280,
                            }
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                            Select Color
                          </Typography>

                          {/* Color Palette Grid */}
                          <Grid container spacing={1} sx={{ mb: 2 }}>
                            {colorOptions.map((color) => (
                              <Grid item key={color.value}>
                                <Box
                                  onClick={() => handleColorSelect(color.value)}
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 1,
                                    bgcolor: color.value,
                                    border: selectedColor === color.value ? `2px solid ${PRIMARY_COLOR}` : '2px solid white',
                                    outline: selectedColor === color.value ? `1px solid ${color.value}` : '1px solid #e5e7eb',
                                    cursor: 'pointer',
                                    boxShadow: 1,
                                    '&:hover': {
                                      transform: 'scale(1.1)',
                                      transition: 'transform 0.2s',
                                    },
                                  }}
                                />
                              </Grid>
                            ))}
                          </Grid>

                          <Divider sx={{ my: 2 }} />

                          {/* Custom Color Input */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                              size="small"
                              placeholder="#000000"
                              value={customHexColor}
                              onChange={(e) => setCustomHexColor(e.target.value)}
                              sx={{ flex: 1 }}
                              inputProps={{
                                maxLength: 7,
                                style: { textTransform: 'uppercase' }
                              }}
                            />
                            <Button
                              variant="contained"
                              size="small"
                              onClick={handleCustomColorApply}
                              sx={{
                                bgcolor: PRIMARY_COLOR,
                                minWidth: 'auto',
                                px: 2,
                                "&:hover": { bgcolor: "#d86602" }
                              }}
                            >
                              Apply
                            </Button>
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                            Enter hex color code (e.g., #FF0000)
                          </Typography>
                        </Popover>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Action Button Settings */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Switch
                      checked={actionButtonEnabled}
                      onChange={(e) => setActionButtonEnabled(e.target.checked)}
                      size="small"
                      color="primary"
                    />
                    <Typography variant="body1" fontWeight={500}>Action Button</Typography>
                  </Box>
                </Box>

                {actionButtonEnabled && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 4 }}>
                    <TextField
                      fullWidth
                      label="Button Text"
                      value={actionButtonText}
                      onChange={(e) => setActionButtonText(e.target.value)}
                      placeholder="e.g., View Details, Learn More"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Button Link"
                      value={actionButtonLink}
                      onChange={(e) => setActionButtonLink(e.target.value)}
                      placeholder="e.g., https://example.com"
                      size="small"
                      InputProps={{
                        startAdornment: <FiLink style={{ marginRight: 8, color: SECONDARY_COLOR }} />
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      The button will open this link in a new tab when clicked
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: "text.primary" }}>
              Preview
            </Typography>

            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                {/* Recipients Summary */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: SECONDARY_COLOR, mb: 1 }}>
                    RECIPIENTS ({selectedGroups.length})
                  </Typography>
                  {selectedGroups.map((group) => (
                    <Box key={group.id.id} sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                        {group.name}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {(group.configuration?.usersFilter?.usersIds || []).slice(0, 3).map((id) => {
                          const user = availableUsers.find((u) => u.id === id);
                          return (
                            <Chip
                              key={id}
                              label={user ? user.email : id}
                              size="small"
                              variant="outlined"
                            />
                          );
                        })}
                        {(group.configuration?.usersFilter?.usersIds || []).length > 3 && (
                          <Chip
                            label={`+${(group.configuration?.usersFilter?.usersIds || []).length - 3} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Notification Preview - Matching Notification Bell Styling */}
                <div
                  className="notification-item-1"
                  style={{border: '1px solid #e5e7eb'}}
                >
                  {iconEnabled && (
                    <div className="notification-icon-1" style={{ color: selectedColor }}>
                    {iconList[selectedIcon] || <FaInfoCircle />}
                  </div>
                  )}
                  
                  <div className="notification-content-1">
                    <div className="notification-subject-1">
                      {subject}
                    </div>
                    <div className="notification-text-1">
                      {message}
                    </div>
                    
                    {/* Action Button Preview */}
                    {actionButtonEnabled && actionButtonText && actionButtonLink && (
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{
                          borderColor: PRIMARY_COLOR,
                          color: PRIMARY_COLOR,
                          '&:hover': {
                            borderColor: PRIMARY_COLOR,
                            backgroundColor: 'rgba(244, 120, 4, 0.04)'
                          },
                          marginTop: '8px',
                          fontSize: '12px',
                          padding: '2px 8px',
                          minWidth: 'auto',
                          lineHeight: 1.2,
                          height: '24px'
                        }}
                        
                      >
                        {actionButtonText}
                      </Button>
                    )}
                  </div>

                  <div className="notification-right-1">
                    <div className="notification-time-1">Just now</div>
                    <button
                      className="mark-read-btn-1"
                      title="Mark as read"
                    >
                      <FaCheck size={12} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={orangeTheme}>
      <>
        <Button
          startIcon={<FiSend />}
          variant="contained"
          sx={{
            bgcolor: PRIMARY_COLOR,
            "&:hover": { bgcolor: "#d86602" },
            fontWeight: 500,
          }}
          onClick={() => setOpen(true)}
        >
          Send Notification
        </Button>

        <Dialog
          open={open}
          onClose={handleClose}
          maxWidth="md"
          fullWidth
          PaperProps={{ elevation: 3 }}
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Send Notification
              </Typography>
              <IconButton
                onClick={handleClose}
                size="small"
                sx={{ color: SECONDARY_COLOR, "&:hover": { backgroundColor: "rgba(244, 120, 4, 0.04)" } }}
              >
                <FiX />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ py: 1 }}>
            <Stepper
              activeStep={activeStep}
              sx={{
                mb: 4,
                "& .MuiStepIcon-root.Mui-active": { color: PRIMARY_COLOR },
                "& .MuiStepIcon-root.Mui-completed": { color: PRIMARY_COLOR },
              }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            {getStepContent(activeStep)}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button
              onClick={handleClose}
              variant="text"
              sx={{ color: SECONDARY_COLOR, "&:hover": { backgroundColor: "rgba(244, 120, 4, 0.04)" } }}
            >
              Cancel
            </Button>

            <Box sx={{ flex: 1 }} />

            {activeStep > 0 && (
              <Button
                onClick={() => setActiveStep((s) => s - 1)}
                variant="outlined"
                sx={{ 
                  borderColor: PRIMARY_COLOR, 
                  color: PRIMARY_COLOR,
                  "&:hover": { 
                    borderColor: "#d86602", 
                    backgroundColor: "rgba(244, 120, 4, 0.04)" 
                  } 
                }}
              >
                Back
              </Button>
            )}

            {activeStep < steps.length - 1 ? (
              <Button
                onClick={() => setActiveStep((s) => s + 1)}
                variant="contained"
                disabled={
                  (activeStep === 0 && selectedGroups.length === 0) ||
                  (activeStep === 1 && (!subject.trim() || !message.trim()))
                }
                sx={{ 
                  bgcolor: PRIMARY_COLOR,
                  "&:hover": { bgcolor: "#d86602" },
                  "&.Mui-disabled": { bgcolor: "rgba(244, 120, 4, 0.5)" }
                }}
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                variant="contained"
                startIcon={<FiSend />}
                disabled={selectedGroups.length === 0 || !subject.trim() || !message.trim() || loading}
                sx={{ 
                  bgcolor: PRIMARY_COLOR,
                  "&:hover": { bgcolor: "#d86602" },
                  "&.Mui-disabled": { bgcolor: "rgba(244, 120, 4, 0.5)" }
                }}
              >
                {loading ? "Sending..." : "Send Notification"}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <CreateGroupDialog
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          onGroupCreated={() => {
            fetchRecipientGroups();
            setCreateGroupOpen(false);
          }}
          availableUsers={availableUsers}
        />
      </>
    </ThemeProvider>
  );
};

export default SendNotificationPopup;