import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative h-9 w-9 rounded-xl border border-border bg-background/50 text-foreground hover:bg-secondary transition-all focus:outline-none"
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
};

export default ThemeToggle;
