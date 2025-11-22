import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Autocomplete,
  Chip,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Divider,
  Paper,
  Tooltip,
   createTheme,
  ThemeProvider,
} from "@mui/material";
import { createRecipientGroup, updateRecipientGroup } from "../../Services/app/notificationservice";
import Swal from "sweetalert2";

const PRIMARY_COLOR = "#F47804";

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

const CreateGroupDialog = ({
  open,
  onClose,
  onGroupCreated,
  onGroupUpdated,
  editingGroup,
  availableUsers
}) => {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupType, setGroupType] = useState("private");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingGroup && open) {
      setGroupName(editingGroup.name || "");
      const groupUserIds = editingGroup.configuration?.usersFilter?.usersIds || [];
      const groupUsers = availableUsers.filter((user) => groupUserIds.includes(user.id));
      setSelectedUsers(groupUsers);

      const existingGroupType = editingGroup.configuration?.description?.includes('"isPublic":false')
        ? "private"
        : "public";
      setGroupType(existingGroupType);
    } else {
      setGroupName("");
      setSelectedUsers([]);
      setGroupType("private");
    }
  }, [editingGroup, open, availableUsers]);

  const handleSubmit = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setLoading(true);
    try {
      const customerId = JSON.parse(localStorage.getItem("CustomerID"));
      const userIds = selectedUsers.map((user) => user.id);
      let currentUser = {
        id: localStorage.getItem('userID'),
        email: localStorage.getItem('email')
      }
      const description = JSON.stringify({
        customerId,
        isPublic: groupType === "public",
        createdBy: currentUser?.id || "unknown",
        createdByEmail: currentUser?.email || "unknown"
      });

      if (editingGroup) {
        await updateRecipientGroup(editingGroup.id.id, groupName, userIds, description);
        Swal.fire({
          icon: "success",
          title: "Group Updated!",
          text: "Recipient group has been updated successfully.",
          timer: 2000,
          showConfirmButton: false
        });
        onGroupUpdated();
      } else {
        await createRecipientGroup(groupName, userIds, description);
        Swal.fire({
          icon: "success",
          title: "Group Created!",
          text: "Recipient group has been created successfully.",
          timer: 2000,
          showConfirmButton: false
        });
        onGroupCreated();
      }

      setGroupName("");
      setSelectedUsers([]);
      setGroupType("private");
    } catch (error) {
      console.error("Error creating/updating group:", error);
      Swal.fire({
        icon: "error",
        title: editingGroup ? "Update Failed" : "Creation Failed",
        text: `Failed to ${editingGroup ? "update" : "create"} recipient group.`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setGroupName("");
    setSelectedUsers([]);
    setGroupType("private");
    onClose();
  };

  return (
        <ThemeProvider theme={orangeTheme}>
    
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        elevation: 4,
        sx: {
          overflow: "hidden"
        }
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          color: "text.primary",
          px: 3,
          py: 2.5,
        }}
      >
        {editingGroup ? "Edit Recipient Group" : "Create Recipient Group"}
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Group Name */}
          <TextField
            fullWidth
            label="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            variant="outlined"
            size="medium"
            sx={{mt:1}}
          />

          {/* Group Visibility */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              borderColor: "divider"
            }}
          >
            <FormControl component="fieldset" fullWidth>
              <FormLabel
                component="legend"
                sx={{ mb: 1, fontWeight: 600}}
              >
                Group Visibility
              </FormLabel>
              <RadioGroup
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
                row
              >
                <FormControlLabel
                  value="private"
                  control={<Radio sx={{ color: PRIMARY_COLOR }} />}
                  label={
                    <Box>
                      <Typography fontWeight={500} sx={{color: '#00000099'}}>Private Group</Typography>
                      <Typography variant="caption" color="text.secondary" >
                        Only you can view, edit, and use this group
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="public"
                  control={<Radio sx={{ color: PRIMARY_COLOR }} />}
                  label={
                    <Box>
                      <Typography fontWeight={500}  sx={{color: '#00000099'}}>Public Group</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Visible and usable by all users
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Paper>

          {/* User Selection */}
          <Box>
            <Autocomplete
              multiple
              options={availableUsers}
              getOptionLabel={(option) => option.email}
              value={selectedUsers}
              disablePortal
              onChange={(e, newValue) => setSelectedUsers(newValue)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Group Members"
                  placeholder="Select users..."
                  helperText="Select users who will receive notifications for this group"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option.id}
                    label={option.email}
                    {...getTagProps({ index })}
                    size="small"
                    variant="outlined"
                    sx={{
                     
                      fontWeight: 500
                    }}
                  />
                ))
              }
            />
          </Box>

          {/* Public Group Warning */}
          {groupType === "public" && (
            <Box
              sx={{
                p: 2,
                bgcolor: "rgba(244, 120, 4, 0.1)",
                borderRadius: 2,
                border: `1px solid ${PRIMARY_COLOR}`
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: PRIMARY_COLOR, fontWeight: 500 }}
              >
                <strong>Note:</strong> This group will be visible to all users.
                Anyone can view, edit, delete or use this group.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button
          onClick={handleClose}
          variant="text"
          sx={{
            color: "#6B7280",
            "&:hover": { backgroundColor: "rgba(107,114,128,0.08)" },
            fontWeight: 500
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!groupName.trim() || selectedUsers.length === 0 || loading}
          sx={{
            bgcolor: PRIMARY_COLOR,
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            "&:hover": { bgcolor: "#d86602" },
            "&.Mui-disabled": {
              bgcolor: "rgba(244, 120, 4, 0.5)",
              color: "#fff"
            }
          }}
        >
          {loading
            ? editingGroup
              ? "Updating..."
              : "Creating..."
            : editingGroup
            ? "Update Group"
            : "Create Group"}
        </Button>
      </DialogActions>
    </Dialog>
    </ThemeProvider>
  );
};

export default CreateGroupDialog;
