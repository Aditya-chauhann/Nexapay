import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, Shield, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CONSENT_KEY = "trusto_cookie_consent";

export const CookieConsentBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already saved a choice
    const savedConsent = localStorage.getItem(CONSENT_KEY);
    if (!savedConsent) {
      // Delay showing slightly for smooth page entrance
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, "rejected");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg sm:left-auto sm:right-6 sm:max-w-md"
        >
          <div className="glass-card relative overflow-hidden p-5 shadow-2xl border border-primary/20 bg-card/95 backdrop-blur-xl">
            {/* Background Glow Effect */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Cookie className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Cookie Preferences</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3 text-primary" /> Privacy Protected
                  </p>
                </div>
              </div>
              <button
                onClick={handleReject}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Close cookie banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              We use cookies to improve your browsing experience, provide security, and analyze platform traffic. You can choose to accept all cookies or reject non-essential cookies. Read our{" "}
              <Link to="/cookie-policy" className="text-primary font-medium underline underline-offset-2 hover:text-primary/80">
                Cookie Policy
              </Link>{" "}
              for more info.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleAccept}
                className="inline-flex w-full sm:w-auto flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Check className="h-3.5 w-3.5" /> Accept All
              </button>
              <button
                onClick={handleReject}
                className="inline-flex w-full sm:w-auto flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                Reject Non-Essential
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsentBanner;
