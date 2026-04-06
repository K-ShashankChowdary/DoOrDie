import React from 'react';
import PolicyLayout from '../components/PolicyLayout';

const RefundPage = () => {
  return (
    <PolicyLayout title="Cancellation and Refunds" lastUpdated="April 06, 2026">
      <section className="space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-3">1) Cancellations</h2>
          <p>
            Once a task is funded it remains active until the deadline. Cancellations are not available to preserve commitment integrity.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">2) When Refunds Apply</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Task completed and approved by the validator before the deadline.</li>
            <li>Validator does not review within the grace window (auto-approval to creator).</li>
            <li>Payment was duplicated or failed but still charged (subject to Razorpay confirmation).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">3) When Refunds Do Not Apply</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Creator misses the deadline or uploads insufficient proof and validator rejects it.</li>
            <li>Violations of Terms (fraud, abusive content, or chargeback abuse).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">4) Timing</h2>
          <p>
            Eligible refunds are initiated immediately via Razorpay. Banks typically settle to the original payment method within 5–7 business days.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">5) Disputes & Support</h2>
          <p>
            If your refund is missing after 7 business days or you believe it was wrongly denied, email <a className="text-blue-600 hover:text-blue-800" href="mailto:kshashankchowdary14@gmail.com">kshashankchowdary14@gmail.com</a>. We aim to respond within 48 hours.
          </p>
        </div>
      </section>
    </PolicyLayout>
  );
};

export default RefundPage;
