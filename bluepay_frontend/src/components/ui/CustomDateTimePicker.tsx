import React, { useMemo } from "react";
import { Calendar, Clock, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CustomDateTimePickerProps {
  label: string;
  value: string; // Format: "YYYY-MM-DDTHH:mm" (Local ISO)
  onChange: (val: string) => void;
  isEndDate?: boolean;
}

export function formatLocalISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CustomDateTimePicker({
  label,
  value,
  onChange,
  isEndDate = false,
}: CustomDateTimePickerProps) {
  // Parse YYYY-MM-DDTHH:mm
  const parsed = useMemo(() => {
    try {
      const [datePart, timePart] = value.split("T");
      const [year, month, day] = datePart.split("-");
      const [hStr, mStr] = (timePart || "00:00").split(":");
      let hNum = parseInt(hStr, 10);
      if (isNaN(hNum)) hNum = 12;
      const ampm = hNum >= 12 ? "PM" : "AM";
      let h12 = hNum % 12;
      if (h12 === 0) h12 = 12;

      return {
        date: datePart || formatLocalISO(new Date()).slice(0, 10),
        hour: String(h12).padStart(2, "0"),
        minute: (mStr || "00").slice(0, 2),
        ampm,
        formattedDisplay: `${day}/${month}/${year} at ${String(h12).padStart(2, "0")}:${(mStr || "00").slice(0, 2)} ${ampm}`,
      };
    } catch {
      const d = new Date();
      const localIso = formatLocalISO(d);
      const [datePart, timePart] = localIso.split("T");
      const [year, month, day] = datePart.split("-");
      const [hStr, mStr] = timePart.split(":");
      let hNum = parseInt(hStr, 10);
      const ampm = hNum >= 12 ? "PM" : "AM";
      let h12 = hNum % 12;
      if (h12 === 0) h12 = 12;

      return {
        date: datePart,
        hour: String(h12).padStart(2, "0"),
        minute: mStr,
        ampm,
        formattedDisplay: `${day}/${month}/${year} at ${String(h12).padStart(2, "0")}:${mStr} ${ampm}`,
      };
    }
  }, [value]);

  const updateValue = (newDate: string, newHour12: string, newMin: string, newAmpm: string) => {
    let h = parseInt(newHour12, 10);
    if (isNaN(h)) h = 12;
    if (newAmpm === "PM" && h < 12) h += 12;
    if (newAmpm === "AM" && h === 12) h = 0;

    const h24Str = String(h).padStart(2, "0");
    const minStr = String(newMin).padStart(2, "0");
    onChange(`${newDate}T${h24Str}:${minStr}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    updateValue(e.target.value, parsed.hour, parsed.minute, parsed.ampm);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateValue(parsed.date, e.target.value, parsed.minute, parsed.ampm);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateValue(parsed.date, parsed.hour, e.target.value, parsed.ampm);
  };

  const handleAmpmChange = (newAmpm: string) => {
    updateValue(parsed.date, parsed.hour, parsed.minute, newAmpm);
  };

  // Quick Preset Handlers (using Local ISO time)
  const applyPreset = (preset: "now" | "1day" | "3days" | "1week" | "1month" | "1year") => {
    const now = new Date();
    if (preset === "now") {
      onChange(formatLocalISO(now));
      return;
    }
    const target = new Date();
    if (preset === "1day") target.setDate(target.getDate() + 1);
    if (preset === "3days") target.setDate(target.getDate() + 3);
    if (preset === "1week") target.setDate(target.getDate() + 7);
    if (preset === "1month") target.setMonth(target.getMonth() + 1);
    if (preset === "1year") target.setFullYear(target.getFullYear() + 1);
    onChange(formatLocalISO(target));
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const defaultMinutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  const minutesList = defaultMinutes.includes(parsed.minute)
    ? defaultMinutes
    : [...defaultMinutes, parsed.minute].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground hover:bg-secondary/60 hover:border-primary/50 transition-all focus:outline-none focus:border-primary"
          >
            <div className="flex items-center gap-2 font-mono text-xs">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span>{parsed.formattedDisplay}</span>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-80 p-4 border border-border bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Select Date & Time
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">IST / Local</span>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" /> Quick Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {!isEndDate ? (
                <>
                  <button
                    type="button"
                    onClick={() => applyPreset("now")}
                    className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1 text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    ⚡ Now
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("1day")}
                    className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1 text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    Tomorrow
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => applyPreset("1day")}
                    className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1 text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    +1 Day
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("3days")}
                    className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1 text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("1week")}
                    className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1 text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    +1 Week
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("1month")}
                    className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1 text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    +1 Month
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Date</span>
            <input
              type="date"
              value={parsed.date}
              onChange={handleDateChange}
              className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Time Picker Controls */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Time (Hour : Minute : AM/PM)</span>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={parsed.hour}
                onChange={handleHourChange}
                className="rounded-xl border border-border bg-secondary/40 px-2 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
              >
                {hoursList.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <select
                value={parsed.minute}
                onChange={handleMinuteChange}
                className="rounded-xl border border-border bg-secondary/40 px-2 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
              >
                {minutesList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <div className="flex rounded-xl border border-border bg-secondary/40 p-0.5">
                <button
                  type="button"
                  onClick={() => handleAmpmChange("AM")}
                  className={`flex-1 rounded-lg text-xs font-bold transition-colors ${
                    parsed.ampm === "AM" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handleAmpmChange("PM")}
                  className={`flex-1 rounded-lg text-xs font-bold transition-colors ${
                    parsed.ampm === "PM" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
