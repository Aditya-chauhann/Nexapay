import { Link } from "react-router-dom";
import { ShieldCheck, FileText, Cookie, Wallet } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border/60 bg-card/40 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand info */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg flex items-center justify-center bg-primary/10">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Nexa<span className="text-primary">Pay</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm">
              Technology-driven solutions designed to assist businesses with secure payment processing support, transaction monitoring, and financial technology services.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Protected with enterprise-grade encryption</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Navigation</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-muted-foreground transition-colors hover:text-foreground">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/auth/login" className="text-muted-foreground transition-colors hover:text-foreground">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/auth/register" className="text-muted-foreground transition-colors hover:text-foreground">
                  Register
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Legal & Compliance</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/privacy-policy" className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
                  <FileText className="h-3.5 w-3.5" /> Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/cookie-policy" className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
                  <Cookie className="h-3.5 w-3.5" /> Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Support / Contact */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Contact & Support</h3>
            <p className="mt-4 text-sm text-muted-foreground">
              Have questions regarding our services or legal policies?
            </p>
            <a
              href="https://nexopay.exchange/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline"
            >
              Visit nexopay.exchange &rarr;
            </a>
          </div>
        </div>

        <div className="mt-12 border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} NexoPay Exchange. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/cookie-policy" className="hover:underline">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
