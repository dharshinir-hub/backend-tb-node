import {
  ROLES,
  ROLE_OPERATOR,
  ROLE_SUPERVISOR,
  ROLE_MAINTENANCE,
  ROLE_QUALITY,
  ROLE_MANAGER,
  ROLE_ADMIN,
  ROLE_SUPER_ADMIN,
  ROLE_HIERARCHY,
} from "../constants/role";
import { useUserRole } from "./useUserRole";

export function useRoleOptions(editingRole = null) {
  const { userRole } = useUserRole();

  const getRoleOptions = () => {
    switch (userRole) {
      // 1. Operator, Maintenance, Quality -> no roles
      case ROLE_OPERATOR:
      case ROLE_MAINTENANCE:
      case ROLE_QUALITY:
        return [];

      // 2. Supervisor -> only operator
      case ROLE_SUPERVISOR:
        return ROLES.filter((r) => r.value === ROLE_OPERATOR);

      // 3. Manager -> operator, maintenance, quality, supervisor
      case ROLE_MANAGER:
        return ROLES.filter((r) =>
          [ROLE_OPERATOR, ROLE_MAINTENANCE, ROLE_QUALITY, ROLE_SUPERVISOR].includes(r.value)
        );

      // 4. Admin -> all except super admin
      case ROLE_ADMIN:
        return ROLES.filter((r) => r.value !== ROLE_SUPER_ADMIN);

      // 5. Super Admin -> all
      case ROLE_SUPER_ADMIN:
        return ROLES;

      default:
        return [];
    }
  };

  // Exclude current user role
  const availableRoles = getRoleOptions()
    .filter(role => role.value !== userRole)
    .map((role) => ({
      ...role,
      disabled: shouldDisableRole(role.value, userRole, editingRole),
    }));

  return { availableRoles };
}

function shouldDisableRole(optionRole, userRole, editingRole) {
  const userRank = ROLE_HIERARCHY.indexOf(userRole);
  const optionRank = ROLE_HIERARCHY.indexOf(optionRole);
  const editRank = editingRole ? ROLE_HIERARCHY.indexOf(editingRole) : -1;

  // Disable if the option is higher than the user's rank
  // or if editingRole is lower than user's rank
  return optionRank > userRank || (editingRole && editRank < userRank);
}
