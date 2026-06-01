import { useState, useEffect } from "react";
import {
  ROLE_OPERATOR,
  ROLE_SUPERVISOR,
  ROLE_MAINTENANCE,
  ROLE_QUALITY,
  ROLE_MANAGER,
  ROLE_ADMIN,
  ROLE_SUPER_ADMIN,
} from "../constants/role";

export function useUserRole() {
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("userDetails");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setUserRole(parsed.mode || "");
    } catch (err) {
      console.error("Failed to parse user role:", err);
      setUserRole("");
    }
  }, []);

  return {
    userRole,
    isOperator: userRole === ROLE_OPERATOR,
    isSupervisor: userRole === ROLE_SUPERVISOR,
    isMaintenance: userRole === ROLE_MAINTENANCE,
    isQuality: userRole === ROLE_QUALITY,
    isManager: userRole === ROLE_MANAGER,
    isAdmin: userRole === ROLE_ADMIN,
    isSuperAdmin: userRole === ROLE_SUPER_ADMIN,
  };
}
