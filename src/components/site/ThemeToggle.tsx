import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vice-theme");
      if (saved === "dark") {
        setTheme("dark");
        document.documentElement.dataset["theme"] = "dark";
      }
    } catch { /* Keep the default when storage is unavailable. */ }
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
    try { localStorage.setItem("vice-theme", next); } catch { /* Theme still works without storage. */ }
  }

  const label = `Switch to ${theme === "light" ? "dark" : "light"} mode`;
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label} className="rounded-none">
      {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
    </Button>
  );
}
