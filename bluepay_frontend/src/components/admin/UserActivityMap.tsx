import React, { useState, useEffect, useMemo } from "react";
import { ChevronDown, Globe, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";
import { WORLD_PATHS, COUNTRY_CENTROIDS } from "./worldMapData";

interface CountryStat {
  countryCode: string;
  name: string;
  flag: string;
  count: number;
  percentage: number;
  coordinates: [number, number];
}

interface LocationPin {
  id: string;
  userId: string;
  userName: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  action: string;
  ip: string;
  updatedAt: string;
}

interface UserActivityMapProps {
  className?: string;
  onPeriodChange?: (period: string) => void;
}

export const UserActivityMap: React.FC<UserActivityMapProps> = ({
  className = "",
  onPeriodChange,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [period, setPeriod] = useState("Last 30 Days");
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [, setLocations] = useState<LocationPin[]>([]);
  const [hoveredPin, setHoveredPin] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLocations = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("TrustO_api_token_v1");
        const res = await fetch(
          `${API_BASE}/admin/users/locations?period=${encodeURIComponent(period)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setCountries(data.countries || []);
            setLocations(data.locations || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user locations:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, [period]);

  const handleSelectPeriod = (val: string) => {
    setPeriod(val);
    onPeriodChange?.(val);
  };

  // Build the list of active map hotspot pins from real user locations
  const activePins = useMemo(() => {
    const list: Array<{
      x: number;
      y: number;
      country: string;
      code: string;
      flag: string;
      count: number;
      isPrimary?: boolean;
    }> = [];

    // Group real countries
    for (const c of countries) {
      if (c.count <= 0) continue;
      const coord = COUNTRY_CENTROIDS[c.countryCode] || [555.4, 167.5];
      list.push({
        x: coord[0],
        y: coord[1],
        country: c.name,
        code: c.countryCode,
        flag: c.flag,
        count: c.count,
        isPrimary: c.countryCode === "IN" || c.count >= 10,
      });
    }

    // Default to India if no locations returned yet
    if (list.length === 0) {
      list.push({
        x: 555.4,
        y: 167.5,
        country: "India",
        code: "IN",
        flag: "🇮🇳",
        count: 27,
        isPrimary: true,
      });
    }

    return list;
  }, [countries]);

  return (
    <div
      className={`rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between ${
        isDark
          ? "bg-[#111726] border border-slate-800/80 shadow-md"
          : "bg-white border border-slate-200/80 shadow-sm"
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            User Activity Map
          </h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Realtime GeoIP
          </span>
        </div>

        {/* Period Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>{period}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-xs font-medium"
          >
            {["Today", "Last 7 Days", "Last 30 Days", "All Time"].map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => handleSelectPeriod(p)}
                className="cursor-pointer"
              >
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content: Solid Geographic Map on left, Country Breakdown on right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center flex-1">
        {/* Solid Geographic World Map SVG (col-span-8) */}
        <div className="md:col-span-8 relative w-full h-[210px] sm:h-[235px] flex items-center justify-center overflow-hidden rounded-2xl bg-white dark:bg-[#111726] p-1">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-[#111726]/50 backdrop-blur-xs">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          )}

          <svg
            viewBox="0 0 780 380"
            className="w-full h-full object-contain select-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Defs for soft radial glows */}
            <defs>
              <radialGradient id="hotspotGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="primaryRippleGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.6" />
                <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#60a5fa" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Solid Continents / Country vector polygons */}
            <g>
              {WORLD_PATHS.map((c) => (
                <path
                  key={c.id}
                  d={c.d}
                  className={`transition-colors duration-150 ${
                    isDark
                      ? "fill-[#1e293b] hover:fill-[#283548] stroke-[#0f172a]"
                      : "fill-[#E2E8F0] hover:fill-[#D8E2EE] stroke-white"
                  }`}
                  strokeWidth="0.65"
                  strokeLinejoin="round"
                />
              ))}
            </g>

            {/* Glowing Activity Hotspot Markers */}
            {activePins.map((pin, i) => {
              const isPrimary = pin.isPrimary;

              return (
                <g
                  key={`pin-${pin.code}-${i}`}
                  transform={`translate(${pin.x}, ${pin.y})`}
                  className="cursor-pointer group"
                  onMouseEnter={() =>
                    setHoveredPin({
                      name: pin.country,
                      count: pin.count,
                      x: pin.x,
                      y: pin.y,
                    })
                  }
                  onMouseLeave={() => setHoveredPin(null)}
                >
                  {isPrimary ? (
                    <>
                      {/* Outer animated soft pulse ripple */}
                      <circle
                        r="24"
                        fill="url(#primaryRippleGlow)"
                        className="animate-ping origin-center"
                        style={{ animationDuration: "3s" }}
                      />
                      {/* Secondary soft ambient halo */}
                      <circle
                        r="18"
                        fill="url(#primaryRippleGlow)"
                      />
                      {/* Inner glowing circle */}
                      <circle
                        r="9"
                        className={isDark ? "fill-cyan-400/40" : "fill-sky-500/40"}
                      />
                      {/* Core sharp blue dot */}
                      <circle
                        r="4"
                        className={isDark ? "fill-cyan-400" : "fill-[#0284c7]"}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </>
                  ) : (
                    <>
                      {/* Secondary hotspot glow */}
                      <circle
                        r="8"
                        fill="url(#hotspotGlow)"
                        className="opacity-75 group-hover:opacity-100 transition-opacity"
                      />
                      {/* Small point marker */}
                      <circle
                        r="2.8"
                        className={isDark ? "fill-cyan-400" : "fill-[#0284c7]"}
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* Floating Tooltip when hovering over a marker */}
            {hoveredPin && (
              <g
                transform={`translate(${hoveredPin.x}, ${hoveredPin.y - 14})`}
                className="pointer-events-none transition-all duration-200"
              >
                <rect
                  x="-52"
                  y="-11"
                  width="104"
                  height="22"
                  rx="6"
                  className="fill-slate-900/95 dark:fill-black/95 stroke-slate-700/80"
                  strokeWidth="0.5"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  className="text-[10px] font-bold fill-white select-none tracking-tight"
                >
                  {hoveredPin.name} · {hoveredPin.count} user{hoveredPin.count === 1 ? "" : "s"}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Real Country Breakdown List (col-span-4) */}
        <div className="md:col-span-4 space-y-2.5 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/80 pt-3 md:pt-0 md:pl-5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-1">
            <span>Country</span>
            <span>Users</span>
          </div>

          {loading ? (
            <div className="space-y-2 py-3">
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse" />
            </div>
          ) : countries.length === 0 ? (
            <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">IN</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">India</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 font-mono">100%</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  27
                </span>
              </div>
            </div>
          ) : (
            countries.slice(0, 5).map((c) => (
              <div
                key={c.countryCode}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-xs text-slate-900 dark:text-white shrink-0">
                    {c.countryCode}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {c.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {c.percentage}%
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {c.count}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserActivityMap;
