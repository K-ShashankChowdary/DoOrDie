import { Link } from 'react-router-dom';
import { IconSearch } from '../components/icons';

const NotFoundPage = () => {
    return (
        <div className="page-shell grid place-items-center min-h-[100dvh] px-4 sm:px-6 text-center fade-in">
            <div className="modal-panel max-w-lg w-full space-y-10 py-12 px-6 sm:px-10">
                <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center rounded-2xl bg-white/90 p-4 shadow-[var(--elev-2)] ring-1 ring-slate-200/80">
                        <IconSearch className="w-10 h-10 text-[color:var(--brand-red)]" aria-hidden />
                    </div>
                </div>
                <h1 className="text-6xl sm:text-7xl font-black gradient-text tracking-tight">404</h1>
                <div className="space-y-3 max-w-md mx-auto">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Page not found</h2>
                    <p className="text-slate-500 leading-relaxed text-[0.95rem]">
                        That URL doesn&apos;t match anything here. It may have moved or been removed.
                    </p>
                </div>
                <Link to="/" className="btn btn-primary w-full justify-center gap-2">
                    Back to home
                </Link>
            </div>
        </div>
    );
};

export default NotFoundPage;
