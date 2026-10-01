import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, Clock, ShieldCheck, CheckCircle2, Sliders, Shield, Info, Layers } from "lucide-react";
import Footer from "@/components/layout/Footer";

export const CookiePolicy = () => {
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

      {/* Main Content */}
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Banner */}
          <div className="mb-10 text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Cookie className="h-3.5 w-3.5" /> Cookie Usage & Transparency
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Cookie Policy
            </h1>
            <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Last Updated: {lastUpdated}
            </p>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              This Cookie Policy explains how <strong>NexaPay Exchange</strong> ("NexaPay Exchange," "we," "our," or "us") uses cookies and similar technologies when you visit{" "}
              <a href="https://nexapay.exchange/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                https://nexapay.exchange/
              </a>.
            </p>
            <div className="mt-4 rounded-lg bg-card/60 border border-border p-4 text-xs text-muted-foreground">
              By continuing to use our website, you agree to the use of cookies as described in this Policy, subject to your browser settings and applicable laws.
            </div>
          </div>

          {/* Policy Sections */}
          <div className="space-y-8">

            {/* Section 1 */}
            <section id="what-are-cookies" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">1</span>
                What Are Cookies?
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Cookies are small text files that are stored on your computer, smartphone, or other device when you visit a website. They help websites remember your preferences, improve functionality, enhance security, and provide a better browsing experience.
                </p>
                <p>
                  Cookies generally do not contain information that directly identifies you, but they may be linked to information you voluntarily provide through our website.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section id="why-we-use-cookies" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">2</span>
                Why We Use Cookies
              </h2>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                NexaPay Exchange uses cookies to:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-muted-foreground">
                {[
                  "Ensure the website functions properly.",
                  "Improve website speed and performance.",
                  "Remember user preferences and settings.",
                  "Maintain secure user sessions.",
                  "Analyze website traffic and visitor behavior.",
                  "Enhance user experience.",
                  "Detect and prevent fraudulent or suspicious activity.",
                  "Measure the effectiveness of marketing campaigns.",
                  "Support website improvements and new features."
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-md bg-secondary/30 px-3 py-2 border border-border/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3 */}
            <section id="types-of-cookies" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">3</span>
                Types of Cookies We Use
              </h2>
              
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-primary" /> Essential Cookies
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    These cookies are necessary for the operation and security of our website. They enable core functions such as page navigation, secure access, and form submissions. Without these cookies, certain features may not work correctly.
                  </p>
                </div>

                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                    <Layers className="h-4 w-4 text-primary" /> Performance Cookies
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Performance cookies help us understand how visitors interact with our website by collecting anonymous information about page visits, navigation patterns, and overall website performance. This information helps us improve the user experience.
                  </p>
                </div>

                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                    <Sliders className="h-4 w-4 text-primary" /> Functional Cookies
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    These cookies remember your preferences, such as language settings or previously entered information, allowing us to provide a more personalized browsing experience.
                  </p>
                </div>

                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                    <Info className="h-4 w-4 text-primary" /> Analytics Cookies
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Analytics cookies help us measure website usage, identify popular content, monitor visitor activity, and improve our services. The information collected is generally aggregated and does not directly identify individual users.
                  </p>
                </div>

                <div className="rounded-lg bg-secondary/40 p-4 border border-border/50">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                    <Cookie className="h-4 w-4 text-primary" /> Marketing Cookies
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Where applicable, marketing cookies may be used to deliver relevant advertisements, measure campaign performance, and understand user interests. These cookies may be placed by us or trusted third-party advertising partners.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="third-party-cookies" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">4</span>
                Third-Party Cookies
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Some features on our website may rely on trusted third-party service providers, such as analytics platforms, embedded content providers, or advertising partners. These providers may set their own cookies in accordance with their respective privacy policies.
                </p>
                <p className="text-xs italic text-muted-foreground">
                  NexaPay Exchange does not control third-party cookies and encourages users to review the privacy and cookie policies of those providers.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="managing-cookies" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">5</span>
                Managing Cookies
              </h2>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                Most web browsers allow you to:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-foreground font-medium mb-3">
                {[
                  "View stored cookies.",
                  "Delete existing cookies.",
                  "Block all cookies.",
                  "Block cookies from specific websites.",
                  "Receive notifications before cookies are stored."
                ].map((action, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded bg-secondary/30 p-2.5 border border-border/30">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground italic">
                Please note that disabling certain cookies may affect website functionality, user experience, or access to some features.
              </p>
            </section>

            {/* Section 6 */}
            <section id="data-protection" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">6</span>
                Data Protection
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Information collected through cookies is handled in accordance with our{" "}
                <Link to="/privacy-policy" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </Link>. We implement reasonable administrative and technical safeguards to help protect information collected through our website.
              </p>
            </section>

            {/* Section 7 */}
            <section id="updates-to-policy" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">7</span>
                Updates to This Cookie Policy
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We may update this Cookie Policy from time to time to reflect changes in technology, legal requirements, or our business practices. Any updates will become effective when published on this website. We encourage users to review this page periodically.
              </p>
            </section>

            {/* Section 8 */}
            <section id="contact-us" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">8</span>
                Contact Us
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you have any questions regarding this Cookie Policy or our use of cookies, please contact us using the contact information available on{" "}
                <a href="https://nexapay.exchange/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                  https://nexapay.exchange/
                </a>.
              </p>
            </section>

            {/* Acknowledgement Box */}
            <section id="acknowledgement" className="glass-card p-6 sm:p-8 bg-primary/5 border-primary/20">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" /> Cookie Policy Acknowledgement
              </h2>
              <p className="text-sm text-foreground font-medium leading-relaxed">
                By continuing to use NexaPay Exchange, you acknowledge that you have read and understood this Cookie Policy.
              </p>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CookiePolicy;
