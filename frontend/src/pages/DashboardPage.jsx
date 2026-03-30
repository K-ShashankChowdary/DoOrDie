const DashboardPage = () => {
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-gray-400 mb-8">Welcome back to your protected area.</p>
            
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-2xl">
                <p className="text-gray-300">Your contracts and tasks will appear here.</p>
            </div>
        </div>
    );
};

export default DashboardPage;
