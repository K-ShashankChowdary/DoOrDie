import { Link } from 'react-router-dom';

const NotFoundPage = () => {
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-7xl font-bold text-red-500 mb-4 tracking-tighter">404</h1>
            <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
            <p className="text-gray-400 mb-8 max-w-md">Oops! The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
            <Link to="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Back to Dashboard
            </Link>
        </div>
    );
};

export default NotFoundPage;
