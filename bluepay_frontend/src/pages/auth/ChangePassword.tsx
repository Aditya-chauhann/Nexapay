import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Legacy route — staff password change is handled by MandatoryChangePasswordModal on /admin. */
const ChangePassword = () => {
  const { user } = useAuth();

  if (user?.type === "staff") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/auth/admin/login" replace />;
};

export default ChangePassword;
