import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Clock, ShieldCheck, CheckCircle2, AlertTriangle, Lock, Globe, Scale } from "lucide-react";
import Footer from "@/components/layout/Footer";

export const Terms = () => {
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
              <FileText className="h-3.5 w-3.5" /> Official Terms
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Terms & Conditions
            </h1>
            <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Last Updated: {lastUpdated}
            </p>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Welcome to <strong>NexaPay Exchange</strong>. These Terms & Conditions are rules that you must follow when you use NexaPay Exchange and our website at{" "}
              <a href="https://nexapay.exchange/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                https://nexapay.exchange/
              </a>.
            </p>
            <div className="mt-4 rounded-lg bg-card/60 border border-border p-4 text-xs text-muted-foreground">
              When you use our website, you are saying that you will follow these rules. If you do not like some of these rules, then you should not use our website or services.
            </div>
          </div>

          {/* Policy Sections */}
          <div className="space-y-8">

            {/* Section 1 */}
            <section id="who-can-use" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">1</span>
                Who Can Use NexaPay Exchange
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To use NexaPay Exchange you must be at least 18 years old and able to make agreements that are legally binding. When you use NexaPay Exchange you are saying that all the information you give us is true and correct.
              </p>
            </section>

            {/* Section 2 */}
            <section id="using-trusto-exchange" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">2</span>
                Using NexaPay Exchange
              </h2>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                You must use NexaPay Exchange for good things and follow all the laws that apply. You cannot:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground mb-4">
                {[
                  "Use NexaPay Exchange to do things or break the law.",
                  "Try to get into our systems or data without permission.",
                  "Put software or viruses into our system.",
                  "Mess with the security or the way NexaPay Exchange works.",
                  "Pretend to be someone or give us false information."
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 rounded-md bg-secondary/30 p-3 border border-border/30">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground italic">
                If we think you are not following these rules, we can stop you from using NexaPay Exchange.
              </p>
            </section>

            {/* Section 3 */}
            <section id="your-account" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">3</span>
                Your Account
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                For some things on NexaPay Exchange you need to make an account. You are in charge of keeping your account safe and secret. You must tell us right away if someone gets into your account without permission.
              </p>
            </section>

            {/* Section 4 */}
            <section id="our-property" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">4</span>
                Our Property
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Everything on NexaPay Exchange like words, pictures, and designs belongs to NexaPay Exchange or someone who lets us use it. You cannot copy or change any of this without our permission first.
              </p>
            </section>

            {/* Section 5 */}
            <section id="other-websites" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">5</span>
                Other Websites
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sometimes we link to websites to help you. We do not control these websites so we are not responsible for what they say or do. If you use these websites it is at your own risk.
              </p>
            </section>

            {/* Section 6 */}
            <section id="what-we-promise" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">6</span>
                What We Promise
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The information on NexaPay Exchange is for general knowledge. We try to make sure it is correct, but we cannot promise that it is perfect. Do not use the information on NexaPay Exchange to make decisions without getting advice from a professional first.
              </p>
            </section>

            {/* Section 7 */}
            <section id="something-goes-wrong" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">7</span>
                If Something Goes Wrong
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                NexaPay Exchange is not responsible if something bad happens when you use our website. You use NexaPay Exchange at your own risk.
              </p>
            </section>

            {/* Section 8 */}
            <section id="protect-us" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">8</span>
                You Must Help Protect Us
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you do something on NexaPay Exchange, you must help protect us from any problems that might come from it.
              </p>
            </section>

            {/* Section 9 */}
            <section id="private-information" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">9</span>
                Your Private Information
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When you use NexaPay Exchange you are also agreeing to our{" "}
                <Link to="/privacy-policy" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </Link>. This policy explains how we collect, use, and keep your information safe.
              </p>
            </section>

            {/* Section 10 */}
            <section id="stop-access" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">10</span>
                If We Stop Your Access
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We can stop you from using NexaPay Exchange at any time if we think it is necessary to keep our users safe or to follow the law.
              </p>
            </section>

            {/* Section 11 */}
            <section id="changes-to-terms" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">11</span>
                Changes to These Terms
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We might change these Terms & Conditions sometimes. When we do, the new rules will apply to everyone using NexaPay Exchange.
              </p>
            </section>

            {/* Section 12 */}
            <section id="laws-apply" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">12</span>
                Which Laws Apply
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                These Terms & Conditions are governed by applicable laws where NexaPay Exchange operates.
              </p>
            </section>

            {/* Section 13 */}
            <section id="reach-us" className="glass-card p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">13</span>
                How to Reach Us
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you have questions about these Terms & Conditions or about NexaPay Exchange, you can contact us through our website at{" "}
                <a href="https://nexapay.exchange/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                  https://nexapay.exchange/
                </a>.
              </p>
            </section>

            {/* Agreement Box */}
            <section id="agreement" className="glass-card p-6 sm:p-8 bg-primary/5 border-primary/20">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" /> User Agreement
              </h2>
              <p className="text-sm text-foreground font-medium leading-relaxed">
                When you use NexaPay Exchange, you are saying that you have read, understood, and agreed to these Terms & Conditions.
              </p>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
