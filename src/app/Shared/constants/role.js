export const ROLE_OPERATOR = "Operator";
export const ROLE_SUPERVISOR = "Supervisor";
export const ROLE_MAINTENANCE = "Maintenance";
export const ROLE_QUALITY = "Quality";
export const ROLE_MANAGER = "Manager";
export const ROLE_ADMIN = "Admin";
export const ROLE_SUPER_ADMIN = "Super Admin";

export const ROLES = [
  { value: ROLE_OPERATOR, label: "Operator" },
  { value: ROLE_SUPERVISOR, label: "Supervisor" },
  { value: ROLE_MAINTENANCE, label: "Maintenance" },
  { value: ROLE_QUALITY, label: "Quality" },
  { value: ROLE_MANAGER, label: "Manager" },
  { value: ROLE_ADMIN, label: "Admin" },
  { value: ROLE_SUPER_ADMIN, label: "Super Admin" },
];

export const ROLE_HIERARCHY = [
  ROLE_OPERATOR,
  ROLE_SUPERVISOR,
  ROLE_MAINTENANCE,
  ROLE_QUALITY,
  ROLE_MANAGER,
  ROLE_ADMIN,
  ROLE_SUPER_ADMIN,
];
