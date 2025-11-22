// services/machineGroupNotificationService.js
import { 
  createRecipientGroup, 
  deleteRecipientGroup, 
  getRecipientGroupsFromAttribute,
  updateRecipientGroup 
} from './notificationservice';
import { getCustomerUsers } from './operatorservice';

// Create recipient group description for machine groups
const createMachineGroupDescription = (machineGroupCode, createdBy, isPublic = true) => {
  return JSON.stringify({
    isPublic,
    createdBy,
    machineGroupCode,
    type: 'MACHINE_GROUP',
    createdAt: new Date().toISOString()
  });
};

export const createMachineGroupNotificationGroup = async (machineGroup, createdByUserId, customerId) => {
  debugger
  try {
    console.log('🔄 Creating notification group for machine group:', machineGroup.name);
    
    // Validate required parameters
    if (!createdByUserId) {
      throw new Error('Created by user ID is required');
    }
    
    if (!customerId) {
      throw new Error('Customer ID is required for user sync');
    }
    
    // Use consistent parameter - get email from createdByUserId or localStorage?
    const createdByEmail = localStorage.getItem('email'); // Consider if this should be passed as parameter instead
    
    const description = createMachineGroupDescription(machineGroup.code, createdByEmail, true);
    
    // Create recipient group with at least the creator
    const recipientGroup = await createRecipientGroup(
      machineGroup.name,
      [createdByUserId], // Use the parameter consistently
      description
    );
    
    console.log('✅ Created notification recipient group for machine group:', machineGroup.name, recipientGroup);
    
    // Sync all users after creating the group
    try {
      await syncAllUsersToNotificationGroups(customerId);
      console.log('✅ Synced users to new notification group');
    } catch (syncError) {
      console.warn('⚠️ Could not sync users to new notification group:', syncError);
      // Consider if this should be a critical error or just a warning
      // You might want to notify the user that group was created but user sync failed
    }
    
    return recipientGroup;
  } catch (error) {
    console.error('❌ Error creating notification recipient group for machine group:', machineGroup.name, error);
    
    // Enhanced error handling
    let errorMessage = 'Creation failed';
    
    if (error.response) {
      errorMessage = `Server error: ${error.response.data?.message || error.response.statusText}`;
    } else if (error.request) {
      errorMessage = 'Network error: Could not connect to server';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};
// Delete notification recipient group when machine group is deleted
export const deleteMachineGroupNotificationGroup = async (machineGroup) => {
  try {
    console.log('🔄 Deleting notification group for machine group:', machineGroup.name);
    
    const groups = await getRecipientGroupsFromAttribute();
    const machineGroupRecipient = groups.find(group => {
      try {
        const config = group?.configuration || {};
        const description = typeof config.description === 'string' 
          ? JSON.parse(config.description) 
          : config.description || {};
        return description.machineGroupCode === machineGroup.code && description.type === 'MACHINE_GROUP';
      } catch (e) {
        console.warn('Error parsing group description:', e);
        return false;
      }
    });

    if (machineGroupRecipient) {
      await deleteRecipientGroup(machineGroupRecipient.id.id);
      console.log('✅ Deleted notification recipient group for machine group:', machineGroup.name);
      return true;
    } else {
      console.warn('⚠️ No notification group found for machine group:', machineGroup.name);
      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting notification recipient group for machine group:', machineGroup.name, error);
    
    if (error.response) {
      throw new Error(`Server error: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Network error: Could not connect to server');
    } else {
      throw new Error(`Deletion failed: ${error.message}`);
    }
  }
};

// Update notification recipient group when machine group is edited
export const updateMachineGroupNotificationGroup = async (oldMachineGroup, newMachineGroup, updatedByUserId) => {
  try {
    console.log('🔄 Updating notification group for machine group:', oldMachineGroup.name, '→', newMachineGroup.name);
    
    const groups = await getRecipientGroupsFromAttribute();
    const machineGroupRecipient = groups.find(group => {
      try {
        const config = group?.configuration || {};
        const description = typeof config.description === 'string' 
          ? JSON.parse(config.description) 
          : config.description || {};
        return description.machineGroupCode === oldMachineGroup.code && description.type === 'MACHINE_GROUP';
      } catch (e) {
        console.warn('Error parsing group description:', e);
        return false;
      }
    });

    if (machineGroupRecipient) {
      const description = createMachineGroupDescription(newMachineGroup.code, updatedByUserId, true);
      
      await updateRecipientGroup(
        machineGroupRecipient.id.id,
        newMachineGroup.name, // Update with new machine group name
        machineGroupRecipient.configuration.usersFilter.usersIds, // Keep existing users
        description
      );
      
      console.log('✅ Updated notification recipient group for machine group:', newMachineGroup.name);
      return true;
    } else {
      console.warn('⚠️ No notification group found for machine group:', oldMachineGroup.name);
      return false;
    }
  } catch (error) {
    console.error('❌ Error updating notification recipient group for machine group:', error);
    
    if (error.response) {
      throw new Error(`Server error: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Network error: Could not connect to server');
    } else {
      throw new Error(`Update failed: ${error.message}`);
    }
  }
};

// Sync users to notification groups based on their machine groups
export const syncUserToNotificationGroups = async (user, customerId) => {
  try {
    const userGroups = user.userDetails?.groups || [];
    const userId = user.id?.id;
    
    if (!userId || !userGroups.length) {
      return;
    }

    // Get all recipient groups
    const recipientGroups = await getRecipientGroupsFromAttribute();
    
    // Filter machine group recipient groups
    const machineGroupRecipients = recipientGroups.filter(group => {
      try {
        const config = group?.configuration || {};
        const description = typeof config.description === 'string' 
          ? JSON.parse(config.description) 
          : config.description || {};
        return description.type === 'MACHINE_GROUP';
      } catch (e) {
        console.warn('Error parsing group description:', e);
        return false;
      }
    });

    // For each machine group recipient, update user membership
    for (const recipientGroup of machineGroupRecipients) {
      try {
        const config = recipientGroup?.configuration || {};
        const description = typeof config.description === 'string' 
          ? JSON.parse(config.description) 
          : config.description || {};
        
        const machineGroupCode = description.machineGroupCode;
        const currentUserIds = recipientGroup.configuration.usersFilter.usersIds || [];
        
        // Check if user should be in this group
        const shouldBeInGroup = userGroups.includes(machineGroupCode);
        const isInGroup = currentUserIds.includes(userId);
        
        if (shouldBeInGroup && !isInGroup) {
          // Add user to group
          const updatedUserIds = [...currentUserIds, userId];
          await updateRecipientGroup(
            recipientGroup.id.id,
            recipientGroup.name,
            updatedUserIds,
            config.description
          );
          console.log(`✅ Added user ${user.firstName} to notification group: ${recipientGroup.name}`);
          
        } else if (!shouldBeInGroup && isInGroup) {
          // Remove user from group
          const updatedUserIds = currentUserIds.filter(id => id !== userId);
          await updateRecipientGroup(
            recipientGroup.id.id,
            recipientGroup.name,
            updatedUserIds,
            config.description
          );
          console.log(`✅ Removed user ${user.firstName} from notification group: ${recipientGroup.name}`);
        }
      } catch (error) {
        console.error(`❌ Error syncing user to recipient group ${recipientGroup.name}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error syncing user to notification groups:', error);
    throw error;
  }
};

// Sync all users to their appropriate notification groups
export const syncAllUsersToNotificationGroups = async (customerId) => {
  try {
    const res = await getCustomerUsers(customerId);
    const usersList = res.data || [];
    const parsedUsers = usersList.map(user => {
      let parsedDescription = '';
      try { 
        parsedDescription = user.additionalInfo?.description ? 
          JSON.parse(user.additionalInfo.description) : ''; 
      } catch { 
        parsedDescription = user.additionalInfo?.description || ''; 
      }
      return { ...user, userDetails: parsedDescription };
    });

    let syncedCount = 0;
    for (const user of parsedUsers) {
      await syncUserToNotificationGroups(user, customerId);
      syncedCount++;
    }
    
    console.log(`✅ Synced ${syncedCount} users to notification groups`);
    return syncedCount;
  } catch (error) {
    console.error('❌ Error syncing all users to notification groups:', error);
    throw error;
  }
};