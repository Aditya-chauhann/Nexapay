import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Clock, FileText, CheckCircle2 } from "lucide-react";
import Footer from "@/components/layout/Footer";

export const PrivacyPolicy = () => {
  const lastUpdated = "July 28, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header Nav */}
      <nav className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg flex items-center justify-center bg-transparent">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Nexa<span className="text-primary">Pay</span></span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </Link>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Hero Banner */}
          <div className="mb-10 text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Shield className="h-3.5 w-3.5" /> Privacy & Data Protection
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Last Updated: {lastUpdated}
            </p>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Welcome to <strong>NexaPay Exchange</strong>. NexaPay Exchange values your privacy and is committed to protecting your personal information. This Privacy Policy explains how NexaPay Exchange collects, uses, stores, shares, and safeguards your information when you visit{" "}
              <a href="https://nexapay.exchange/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://nexapay.exchange/
              </a>{" "}
              or use any of NexaPay Exchange's products and services.
            </p>
            <div className="mt-4 rounded-lg bg-card/60 border border-border p-4 text-xs text-muted-foreground">
              By accessing or using NexaPay Exchange's website and services, you acknowledge that you have read and understood this Privacy Policy.
            </div>
          </div>

          {/* Policy Sections */}
          <div className="space-y-8">

            {/* Section 1 */}
            <section id="who-we-are" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">1</span>
                Who NexaPay Exchange Is
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  NexaPay Exchange provides technology-driven solutions designed to assist businesses with payment processing support, transaction monitoring, chargeback management, merchant services, and related financial technology solutions.
                </p>
                <p>
                  The goal of NexaPay Exchange is to provide transparent and reliable services while respecting the privacy rights of NexaPay Exchange's customers and website visitors.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section id="information-collected" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">2</span>
                Information NexaPay Exchange Collects
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Depending on how you interact with NexaPay Exchange, NexaPay Exchange may collect the following categories of information:
              </p>
              
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground mb-2">A. Information You Voluntarily Provide</h3>
                  <p className="text-xs text-muted-foreground mb-3">You may voluntarily provide NexaPay Exchange with information such as:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground font-medium">
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Full name</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Company name</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Job title</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Email address</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Phone number</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Business address</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Country</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Account credentials</div>
                    <div className="flex items-center gap-2 sm:col-span-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Customer support communications</div>
                  </div>
                </div>

                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground mb-2">B. Information Automatically Collected</h3>
                  <p className="text-xs text-muted-foreground mb-3">When you visit NexaPay Exchange's website, NexaPay Exchange may automatically collect technical information, such as:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground font-medium">
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> IP address</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Browser type</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Device information</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Operating system</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Language settings</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Referral URLs</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Pages visited</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Date and time of access</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Session duration</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Clickstream information</div>
                  </div>
                </div>

                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground mb-2">C. Cookies and Similar Technologies</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    NexaPay Exchange uses cookies and similar tracking technologies to:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1 mb-2">
                    <li>Maintain website functionality</li>
                    <li>Improve user experience</li>
                    <li>Remember preferences</li>
                    <li>Analyze website traffic</li>
                    <li>Measure marketing effectiveness</li>
                    <li>Protect against fraud</li>
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    You can manage cookie preferences through your browser settings. For more details, see our <Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link>.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="how-we-use" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">3</span>
                How NexaPay Exchange Uses Your Information
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                NexaPay Exchange uses information for business purposes including:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-muted-foreground">
                {[
                  "Creating and managing accounts",
                  "Delivering requested services",
                  "Providing customer support",
                  "Processing business inquiries",
                  "Monitoring platform performance",
                  "Preventing fraud",
                  "Detecting unauthorized activities",
                  "Improving website functionality",
                  "Sending service updates",
                  "Responding to legal obligations",
                  "Maintaining security",
                  "Conducting internal analytics",
                  "Developing new products and services",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 rounded-md bg-secondary/30 px-3 py-2 border border-border/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 4 */}
            <section id="legal-basis" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">4</span>
                Legal Basis for Processing
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Where required, NexaPay Exchange processes personal data based on one or more of the following legal grounds:
              </p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1.5">
                <li>Your consent</li>
                <li>Performance of a contract</li>
                <li>Compliance with legal obligations</li>
                <li>Legitimate business interests</li>
                <li>Protection of legal rights</li>
                <li>Fraud prevention</li>
                <li>Regulatory compliance</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="sharing" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">5</span>
                Sharing Your Information
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground">
                  NexaPay Exchange does not sell your information.
                </p>
                <p>NexaPay Exchange may share information with:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                  <li>Technology service providers</li>
                  <li>Cloud hosting providers</li>
                  <li>Payment partners</li>
                  <li>Analytics providers</li>
                  <li>Customer support platforms</li>
                  <li>Legal advisors</li>
                  <li>Regulatory authorities when required by law</li>
                  <li>Law enforcement agencies where legally obligated</li>
                  <li>Business partners necessary to provide NexaPay Exchange's services</li>
                </ul>
                <p className="text-xs italic text-muted-foreground mt-2">
                  All third parties are expected to protect your information using appropriate security measures.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section id="international-transfers" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">6</span>
                International Data Transfers
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Your information may be stored and processed in countries outside your place of residence.
                </p>
                <p>
                  Where international transfers occur, NexaPay Exchange implements safeguards to protect personal information in accordance with applicable privacy laws.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section id="data-security" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">7</span>
                Data Security
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  NexaPay Exchange employs technical and organizational safeguards designed to protect your information against unauthorized access, disclosure, alteration, or destruction.
                </p>
                <p className="text-xs font-medium text-foreground">These measures may include:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium text-foreground">
                  {["Encryption", "Secure servers", "Access controls", "Authentication procedures", "Network monitoring", "Security audits", "Employee confidentiality obligations"].map((sec, i) => (
                    <div key={i} className="rounded bg-secondary/50 p-2 text-center border border-border/40">
                      {sec}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic pt-2">
                  While NexaPay Exchange strives to protect your information, no internet transmission or electronic storage system can be guaranteed to be completely secure.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section id="data-retention" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">8</span>
                Data Retention
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  NexaPay Exchange retains information only for as long as necessary to:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Provide NexaPay Exchange's services</li>
                  <li>Meet contractual obligations</li>
                  <li>Resolve disputes</li>
                  <li>Enforce agreements</li>
                  <li>Comply with legal and regulatory requirements</li>
                </ul>
                <p className="text-xs">
                  When information is no longer required, NexaPay Exchange takes reasonable steps to securely delete or anonymize it.
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section id="privacy-rights" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">9</span>
                Your Privacy Rights
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Depending on your location, you may have rights regarding your personal information, including:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground">
                  {[
                    "Access your information",
                    "Correct inaccurate information",
                    "Update your information",
                    "Delete personal information",
                    "Restrict processing",
                    "Object to processing",
                    "Withdraw consent",
                    "Request data portability",
                    "Lodge a complaint with a supervisory authority"
                  ].map((right, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded bg-secondary/30 p-2.5 border border-border/30">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{right}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs pt-1">
                  Requests may be submitted using the contact information provided below.
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section id="marketing" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">10</span>
                Marketing Communications
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  If you subscribe to marketing communications, NexaPay Exchange may send updates regarding:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                  <li>Product announcements</li>
                  <li>Service improvements</li>
                  <li>Industry insights</li>
                  <li>Promotional campaigns</li>
                  <li>Company news</li>
                </ul>
                <p className="text-xs italic text-muted-foreground">
                  You may unsubscribe at any time using the unsubscribe link in NexaPay Exchange's emails or by contacting NexaPay Exchange.
                </p>
              </div>
            </section>

            {/* Section 11 */}
            <section id="third-party" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">11</span>
                Third-Party Websites
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                NexaPay Exchange's website may contain links to third-party websites or services. NexaPay Exchange is not responsible for the privacy practices, content, or security of external websites. NexaPay Exchange encourages users to review the privacy policies of any third-party services they access.
              </p>
            </section>

            {/* Section 12 */}
            <section id="childrens-privacy" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">12</span>
                Children's Privacy
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                NexaPay Exchange's services are intended for businesses and individuals who are legally capable of entering into binding agreements. NexaPay Exchange does not knowingly collect information from children under the age required by applicable law. If NexaPay Exchange becomes aware that such information has been collected, NexaPay Exchange will take steps to delete it.
              </p>
            </section>

            {/* Section 13 */}
            <section id="fraud-prevention" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">13</span>
                Fraud Prevention and Security Monitoring
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  To protect NexaPay Exchange's customers, partners, and platform, NexaPay Exchange may monitor transactions, user activities, login attempts, and system interactions for the purposes of:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-medium text-foreground">
                  {["Fraud detection", "Abuse prevention", "Security monitoring", "Risk management", "Compliance investigations"].map((item, idx) => (
                    <div key={idx} className="rounded bg-secondary/40 p-2 text-center border border-border/40">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-xs italic pt-1">
                  Such monitoring is carried out in accordance with applicable laws.
                </p>
              </div>
            </section>

            {/* Section 14 */}
            <section id="policy-changes" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">14</span>
                Changes to This Privacy Policy
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                NexaPay Exchange may update this Privacy Policy from time to time to reflect changes in NexaPay Exchange's services, legal requirements, or business practices. The updated version will become effective once published on NexaPay Exchange's website. Continued use of NexaPay Exchange's services after changes constitutes acceptance of the revised Privacy Policy.
              </p>
            </section>

            {/* Section 15 */}
            <section id="contact-us" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">15</span>
                Contact NexaPay Exchange
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you have questions regarding this Privacy Policy or NexaPay Exchange's privacy practices, please contact NexaPay Exchange through the contact details published on{" "}
                <a href="https://nexapay.exchange/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                  https://nexapay.exchange/
                </a>.
              </p>
            </section>

            {/* Section 16 */}
            <section id="your-consent" className="glass-card p-6 sm:p-8 bg-primary/5 border-primary/20">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">16</span>
                Your Consent
              </h2>
              <p className="text-sm text-foreground font-medium leading-relaxed">
                By accessing or using NexaPay Exchange, you acknowledge that you have read, understood, and agreed to the practices described in this Privacy Policy.
              </p>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
