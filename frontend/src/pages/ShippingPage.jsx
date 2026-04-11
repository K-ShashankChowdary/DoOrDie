import React from 'react';
import PolicyLayout from '../components/PolicyLayout';

const ShippingPage = () => {
  return (
    <PolicyLayout title="Shipping Policy" lastUpdated="April 06, 2026">
      <section className="space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-3">1) Digital-Only Service</h2>
          <p>
            DoOrDie provides a 100% digital product. No physical goods are shipped.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">2) Instant Availability</h2>
          <p>
            Once you activate a task from your demo wallet, the contract appears immediately in your dashboard across all logged-in devices.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">3) No Shipping Fees</h2>
          <p>
            There are no shipping or handling charges. Stake amounts are simulated in this demo.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">4) Access Issues</h2>
          <p>
            If you cannot see your task after activation, email <a className="text-blue-600 hover:text-blue-800" href="mailto:kshashankchowdary14@gmail.com">kshashankchowdary14@gmail.com</a>. We will verify the payment and restore access promptly.
          </p>
        </div>
      </section>
    </PolicyLayout>
  );
};

export default ShippingPage;
