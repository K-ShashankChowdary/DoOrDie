import React from 'react';
import PolicyLayout from '../components/PolicyLayout';

const PrivacyPage = () => {
  return (
    <PolicyLayout title="Privacy Policy" lastUpdated="April 06, 2026">
      <section className="space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-3">1) Data We Collect</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Account info: name, email, password (hashed), optional phone/UPI.</li>
            <li>Payment & payout info from Razorpay (order IDs, payment IDs, linked account IDs).</li>
            <li>Content you submit: tasks, descriptions, proofs, comments.</li>
            <li>Technical data: IP address, device/browser metadata for fraud prevention and troubleshooting.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">2) How We Use It</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Authenticate you and keep your session active.</li>
            <li>Process stakes, payouts, and refunds through Razorpay Route.</li>
            <li>Send task, deadline, and validation notifications.</li>
            <li>Improve reliability, prevent abuse, and support you when issues arise.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">3) Sharing</h2>
          <p>
            We share data only with essential processors: Razorpay (payments), Cloudinary (file storage), and infrastructure/logging providers. We do not sell personal data.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">4) Security</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Passwords are hashed; access tokens are short-lived.</li>
            <li>Payments flow via Razorpay; we don’t store card/bank details.</li>
            <li>Access is limited to least-privilege operational needs.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">5) Cookies</h2>
          <p>
            We use essential cookies for authentication. Blocking them will prevent login from working.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">6) Your Choices</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Access, update, or delete your profile data.</li>
            <li>Close your account and request deletion via support.</li>
            <li>Opt out of non-essential email where applicable (system emails are required for security and receipts).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">7) Retention</h2>
          <p>
            We retain data for as long as your account is active and as needed for legal, accounting, and fraud-prevention purposes. Payment records may be kept as required by law.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">8) Contact</h2>
          <p>
            Privacy questions? Email <a className="text-blue-600 hover:text-blue-800" href="mailto:kshashankchowdary14@gmail.com">kshashankchowdary14@gmail.com</a>.
          </p>
        </div>
      </section>
    </PolicyLayout>
  );
};

export default PrivacyPage;
