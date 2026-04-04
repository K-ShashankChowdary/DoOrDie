import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconLayoutDashboard } from "./icons";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-shell grid place-items-center min-h-[100dvh] px-4 sm:px-6">
        <div className="modal-panel flex flex-col items-center justify-center gap-8 w-full max-w-md py-16 px-8 sm:px-10 fade-in">
          <IconLayoutDashboard className="w-9 h-9 text-slate-300" aria-hidden />
          <span className="spinner w-12 h-12" aria-hidden />
          <p className="text-slate-600 font-medium text-sm text-center leading-relaxed">
            Loading your tasks…
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
