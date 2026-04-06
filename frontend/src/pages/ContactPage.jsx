import React from 'react';
import PolicyLayout from '../components/PolicyLayout';

const ContactPage = () => {
  return (
    <PolicyLayout title="Contact Us" lastUpdated="April 06, 2026">
      <section className="space-y-8">
        <p>
          We’re here to help with payments, validators, or policy questions. Reach out and we’ll get back promptly.
        </p>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide w-28">Email</span>
            <a 
              href="mailto:kshashankchowdary14@gmail.com" 
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              kshashankchowdary14@gmail.com
            </a>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide w-28">Response</span>
            <span className="text-slate-700 font-semibold">Within 24–48 business hours</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide w-28">Support window</span>
            <span className="text-slate-700 font-semibold">Mon–Sat, 9:00–19:00 IST</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide w-28">Founder</span>
            <span className="text-slate-700 font-semibold">Shashank Chowdary</span>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">Escalations</h2>
          <p className="text-slate-600">
            For urgent payout or security issues, include “URGENT” in the subject line so we can prioritize your ticket.
          </p>
        </div>
      </section>
    </PolicyLayout>
  );
};

export default ContactPage;
