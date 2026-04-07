import React from 'react';
import PolicyLayout from '../components/PolicyLayout';

const TermsPage = () => {
  return (
    <PolicyLayout title="Terms and Conditions" lastUpdated="April 06, 2026">
      <section className="space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-3">1) Agreement to Terms</h2>
          <p>
            By accessing or using DoOrDie (the “Platform”), you agree to these Terms and to any policies referenced here. If you do not agree, please stop using the Platform.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">2) What We Provide</h2>
          <p>
            DoOrDie lets you create commitments with a monetary stake held in escrow, nominate a validator, submit proof, and route payouts automatically when tasks succeed or fail.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">3) Eligibility & Accounts</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>You must be 18+ and able to form a binding contract.</li>
            <li>Provide accurate registration details and keep credentials confidential.</li>
            <li>We may disable accounts that violate these Terms or the law.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">4) Payments, Escrow, and Payouts</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Payments and payouts run through Stripe. By funding a task, you authorize us to hold and disburse funds per task outcome.</li>
            <li>Creators must pay the stake before a task becomes active. Validators must have a linked Stripe Connect account to receive payouts.</li>
            <li>Stripe may require KYC to enable payouts. You agree to provide accurate documents if requested. Lack of KYC can delay or block payouts. Fees (if any) are shown at checkout; bank/card charges may apply.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">5) Validators, Proof, and Outcomes</h2>
          <ul className="list-disc ml-5 space-y-2 text-slate-600">
            <li>Creators must upload truthful proof before the deadline. Falsified proof may result in forfeiture and account action.</li>
            <li>Validators must review in good faith. Failure to review within the grace period may auto-release funds to the creator.</li>
            <li>We do not mediate factual disputes between users; our role is limited to payment routing based on declared outcomes.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">6) Compliance and KYC</h2>
          <p>
            Razorpay may require KYC to enable payouts. You agree to provide accurate documents if requested. Lack of KYC can delay or block payouts.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">7) Prohibited Use</h2>
          <p>
            Do not use the Platform for illegal activities, money laundering, gambling, harassment, or any content that infringes intellectual property or privacy rights.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">8) Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, the Platform is provided “as is.” We are not liable for indirect or consequential losses, lost profits, or disputes between users. Our aggregate liability will not exceed the total fees you paid to us in the last 3 months.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">9) Changes to Terms</h2>
          <p>
            We may update these Terms periodically. Material changes will be posted here with a revised “Last Updated” date. Continued use constitutes acceptance.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">10) Contact</h2>
          <p>
            Questions about these Terms? Email <a className="text-blue-600 hover:text-blue-800" href="mailto:kshashankchowdary14@gmail.com">kshashankchowdary14@gmail.com</a>.
          </p>
        </div>
      </section>
    </PolicyLayout>
  );
};

export default TermsPage;
