import { Link } from "react-router-dom";
import { Wallet, Shield, ArrowRight, Zap, Lock, Users, LogIn, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { defaultRedirectForUser } from "@/lib/admin-access";
import { useState, useEffect } from "react";
import { NumberReveal } from "@/components/ui/NumberReveal";
import { getPublicPricing, type GlobalPricing } from "@/lib/api-pricing";
import Footer from "@/components/layout/Footer";

const Index = () => {
  const { user } = useAuth();
  const verified = user?.emailVerified;
  const dashboardHref =
    verified && user ? defaultRedirectForUser(user) : "/auth/login";

  const [rates, setRates] = useState<GlobalPricing | null>(null);
  const [usdtInput, setUsdtInput] = useState("100");
  const [inrOutput, setInrOutput] = useState("9050.00");

  useEffect(() => {
    let mounted = true;
    const fetchRates = async () => {
      try {
        const p = await getPublicPricing();
        if (mounted) setRates(p);
      } catch (err) {
        // ignore errors on public page
      }
    };
    
    fetchRates();
    const int = setInterval(fetchRates, 5000);
    return () => {
      mounted = false;
      clearInterval(int);
    };
  }, []);

  useEffect(() => {
    const rate = rates?.inrPrice ? Number(rates.inrPrice) : 90.5;
    const usdt = Number(usdtInput);
    if (!isNaN(usdt) && usdt > 0) {
      setInrOutput((usdt * rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
      setInrOutput("0.00");
    }
  }, [usdtInput, rates]);

  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <nav className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 pt-[max(1rem,env(safe-area-inset-top))] bg-white">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg flex items-center justify-center bg-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">
            Nexa<span className="text-primary">Pay</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          <Link
            to="/blog"
            className="rounded-lg px-4 py-2.5 text-sm text-slate-600 font-medium transition-colors hover:text-primary sm:py-2"
          >
            Blog
          </Link>
          {!verified ? (
            <>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:text-primary sm:py-2"
              >
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
              <Link
                to="/auth/register"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold transition-all hover:bg-primary/95 shadow-sm sm:py-2"
              >
                <UserPlus className="h-4 w-4" /> Register
              </Link>
            </>
          ) : null}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Headline and live rates */}
          <div className="lg:col-span-7 text-left space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5 shrink-0 animate-pulse" /> USDT to INR • Automated Payouts
            </div>
            
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl leading-none">
              The simplest way to exchange <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">USDT</span> to INR.
            </h1>
            
            <p className="max-w-xl text-lg text-slate-600">
              Deposit TRC-20 USDT into your dedicated customer wallet and receive Indian Rupees directly to your bank account or UPI address instantly. Fully automated.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <NumberReveal label="Live Bank Rate" value={rates?.inrPrice ?? "00.00"} />
              <NumberReveal label="Live UPI Rate" value={rates?.upiInrPrice ?? "00.00"} />
            </div>

            <div className="pt-6 flex flex-col sm:flex-row items-stretch gap-4">
              <Link
                to={verified ? dashboardHref : "/auth/register"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:translate-y-[-1px] hover:shadow-primary/30"
              >
                {verified ? "Go to Dashboard" : "Create Free Account"} <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Right Column: Live conversion widget mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden"
            >
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-bl-full pointer-events-none" />

              <h3 className="text-xl font-bold text-slate-900 mb-6">Estimate Conversion</h3>
              
              <div className="space-y-4">
                {/* Input block */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">You Deposit</label>
                  <div className="flex items-center justify-between">
                    <input
                      type="number"
                      value={usdtInput}
                      onChange={(e) => setUsdtInput(e.target.value)}
                      className="bg-transparent border-none text-2xl font-bold text-slate-900 focus:outline-none focus:ring-0 p-0 w-full no-spinner"
                      placeholder="0.00"
                    />
                    <span className="flex items-center gap-1.5 bg-green-50 text-green-700 font-bold px-3 py-1.5 rounded-xl text-sm border border-green-100">
                      USDT
                    </span>
                  </div>
                </div>

                {/* Arrow bridge */}
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-primary text-white p-3 rounded-full shadow-md shadow-primary/20 border-4 border-white">
                    <ArrowRight className="h-5 w-5 rotate-90" />
                  </div>
                </div>

                {/* Output block */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">You Receive (INR)</label>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-black text-slate-900">
                      ₹ {inrOutput}
                    </div>
                    <span className="flex items-center gap-1.5 bg-blue-50 text-primary font-bold px-3 py-1.5 rounded-xl text-sm border border-blue-100">
                      INR
                    </span>
                  </div>
                </div>
              </div>

              {/* Status details */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Average processing: <strong className="text-slate-800 font-semibold">Instant</strong></span>
                </div>
                <span>Fee: <strong className="text-slate-800 font-semibold">0%</strong></span>
              </div>
            </motion.div>
          </div>

        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              Engineered for speed and security.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              NexoPay bridges the gap between blockchain assets and traditional bank systems seamlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Wallet, title: "Dedicated Custodial Wallets", desc: "Get a permanent TRC-20 deposit address specifically for your account. Funds are scanned automatically." },
              { icon: Lock, title: "Ironclad Security", desc: "Private keys are sharded, encrypted, and isolated on security nodes. Your assets are always safe." },
              { icon: Users, title: "Direct Referral System", desc: "Invite others to join NexoPay and receive recurring commissions in INR on all of their transaction volumes." },
            ].map((f, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 p-8 rounded-2xl transition-all duration-300 hover:shadow-md hover:border-slate-200">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Index;