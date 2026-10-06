export function PrivacyPolicy() {
  return (
    <article className="container mx-auto max-w-3xl px-4 py-14 text-slate-200">
      <p className="text-sm text-violet-300">CandidFan</p>
      <h1 className="mt-2 text-4xl font-black text-white">Privacy Policy</h1>
      <p className="mt-3 text-sm text-slate-400">Effective September 28, 2026</p>

      <div className="mt-8 space-y-7 leading-7 text-slate-300">
        <section>
          <h2 className="text-xl font-bold text-white">Information we use</h2>
          <p className="mt-2">CandidFan uses the account details you provide to create and secure your account, provide support, and administer membership. If you submit gift-card proof, it is stored securely for manual payment review.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">Analytics</h2>
          <p className="mt-2">We use Google Analytics 4 to understand site visits and the membership funnel, including registration, preview playback, premium-page visits, gift-card submissions, and approved memberships. Google Analytics may use cookies or similar browser identifiers and receive technical and usage information such as browser, device, and page activity.</p>
          <p className="mt-2">When a gift-card proof is submitted, a pseudonymous Google Analytics client identifier may be stored with the pending payment request so we can attribute an approved membership to the browser that began the flow. It is not a name or email address. If the request is approved, we send Google Analytics a purchase event; the identifier is cleared from the payment request after review. Denied requests do not generate purchase events, and their identifier is also cleared. We do not send account email addresses or gift-card proof codes to Google Analytics.</p>
          <p className="mt-2">You can limit analytics cookies through your browser settings or privacy tools. Google explains its data practices in its <a className="text-violet-300 underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">How information is protected and retained</h2>
          <p className="mt-2">We use access controls and security measures to protect account and payment-review information. Account and support information is retained as needed to operate the service, provide support, and meet applicable obligations. Analytics identifiers attached to a payment request are removed when that request is reviewed.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">Questions</h2>
          <p className="mt-2">For privacy questions or requests, contact <a className="text-violet-300 underline" href="mailto:candidfancom@gmail.com">candidfancom@gmail.com</a>.</p>
        </section>
      </div>
    </article>
  );
}
