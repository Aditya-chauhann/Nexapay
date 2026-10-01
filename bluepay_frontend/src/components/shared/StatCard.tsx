import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  onClick?: () => void;
  className?: string;
}

const StatCard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-primary",
  onClick,
  className = "",
}: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={onClick ? `View ${title} in transactions` : undefined}
      className={`glass-card p-5 sm:p-6 relative group transition-all duration-200 h-full w-full flex flex-col justify-between ${
        onClick
          ? "cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 select-none"
          : ""
      } ${className}`}
    >
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">
                {title}
              </p>
              {onClick && (
                <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all duration-150 shrink-0">
                  ↗
                </span>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-foreground break-all">
              {value}
            </p>
          </div>
          <div
            className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/80 transition-colors ${
              onClick ? "group-hover:bg-primary/10" : ""
            }`}
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </div>

      <div className="mt-3 pt-1 border-t border-border/20">
        {change ? (
          <p
            className={`text-xs font-medium line-clamp-1 ${
              changeType === "positive"
                ? "text-success"
                : changeType === "negative"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {change}
          </p>
        ) : (
          <div className="h-4" aria-hidden="true" />
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;
