import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent border-solid rounded-full animate-spin"></div>
                <p className="text-gray-400 font-medium">Loading session...</p>
            </div>
        );
    }

    // Redirect to login if not authenticated
    return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
