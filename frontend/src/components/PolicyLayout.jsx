import React from 'react';

const PolicyLayout = ({ title, lastUpdated, children }) => {
  return (
    <div className="policy-shell">
      <section className="policy-card">
        <header className="policy-head">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[color:var(--brand-red)]">
            Policy
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.24em] inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            Last Updated: {lastUpdated}
          </p>
        </header>

        <div className="policy-prose">
          {children}
        </div>
      </section>
    </div>
  );
};

export default PolicyLayout;
