import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="min-h-[100dvh] min-h-screen bg-background px-4 py-10 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <Link
          to="/"
          className="flex items-center justify-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl flex items-center justify-center bg-primary/10 shadow-sm">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Nexa<span className="text-primary">Pay</span>
          </span>
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
