import React, { useEffect, useRef } from "react";
import { Users, UserCheck, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useTheme } from "next-themes";

interface DashboardGlobeProps {
  totalUsers?: number;
  activeUsers?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
  className?: string;
}

export const DashboardGlobe: React.FC<DashboardGlobeProps> = ({
  totalUsers = 2400,
  activeUsers = 0,
  totalDeposits = 0,
  totalWithdrawals = 0,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let rotation = 0;

    // Generate fixed points on a sphere (lat/lon)
    const points: { phi: number; theta: number }[] = [];
    const numPoints = 280;
    for (let i = 0; i < numPoints; i++) {
      const phi = Math.acos(-1 + (2 * i) / numPoints);
      const theta = Math.sqrt(numPoints * Math.PI) * phi;
      points.push({ phi, theta });
    }

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.36;

      // 1. Atmosphere Radial Glow
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.5,
        centerX,
        centerY,
        radius * 1.35
      );
      if (isDark) {
        glowGrad.addColorStop(0, "rgba(99, 102, 241, 0.12)");
        glowGrad.addColorStop(0.6, "rgba(168, 85, 247, 0.15)");
        glowGrad.addColorStop(1, "rgba(168, 85, 247, 0)");
      } else {
        glowGrad.addColorStop(0, "rgba(59, 130, 246, 0.08)");
        glowGrad.addColorStop(0.6, "rgba(96, 165, 250, 0.12)");
        glowGrad.addColorStop(1, "rgba(96, 165, 250, 0)");
      }
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Base Sphere Silhouette
      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );
      if (isDark) {
        sphereGrad.addColorStop(0, "#1e1b4b");
        sphereGrad.addColorStop(0.7, "#0f172a");
        sphereGrad.addColorStop(1, "#030712");
      } else {
        sphereGrad.addColorStop(0, "#eff6ff");
        sphereGrad.addColorStop(0.7, "#dbeafe");
        sphereGrad.addColorStop(1, "#bfdbfe");
      }
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Latitude / Longitude Guide Rings
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? "rgba(99, 102, 241, 0.18)" : "rgba(59, 130, 246, 0.2)";

      // Draw latitude circles
      [-0.5, 0, 0.5].forEach((lat) => {
        const rLat = radius * Math.cos(lat);
        const yLat = centerY + radius * Math.sin(lat) * 0.4;
        ctx.beginPath();
        ctx.ellipse(centerX, yLat, rLat, rLat * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 4. Rotating Sphere Point Cloud
      rotation += 0.007;

      points.forEach(({ phi, theta }) => {
        const currentTheta = theta + rotation;
        const x = radius * Math.sin(phi) * Math.cos(currentTheta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(currentTheta);

        // Only draw points on front-facing hemisphere
        if (z > -radius * 0.1) {
          const depthAlpha = Math.max(0.15, (z + radius * 0.5) / (radius * 1.5));
          const pointX = centerX + x;
          const pointY = centerY + y * 0.88;
          const dotSize = Math.max(1, 1.8 * ((z + radius) / (radius * 2)));

          ctx.beginPath();
          ctx.arc(pointX, pointY, dotSize, 0, Math.PI * 2);
          if (isDark) {
            ctx.fillStyle = z > 0 ? `rgba(168, 85, 247, ${depthAlpha})` : `rgba(56, 189, 248, ${depthAlpha * 0.7})`;
          } else {
            ctx.fillStyle = `rgba(37, 99, 235, ${depthAlpha * 0.85})`;
          }
          ctx.fill();
        }
      });

      // 5. Outer Orbital Ring with Glowing Gradient
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-0.25); // Slight tilt

      const ringRadiusX = radius * 1.28;
      const ringRadiusY = radius * 0.45;

      const ringGrad = ctx.createLinearGradient(-ringRadiusX, 0, ringRadiusX, 0);
      if (isDark) {
        ringGrad.addColorStop(0, "rgba(56, 189, 248, 0.85)");
        ringGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.95)");
        ringGrad.addColorStop(1, "rgba(236, 72, 153, 0.85)");
      } else {
        ringGrad.addColorStop(0, "rgba(59, 130, 246, 0.7)");
        ringGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.85)");
        ringGrad.addColorStop(1, "rgba(168, 85, 247, 0.7)");
      }

      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = isDark ? 14 : 6;
      ctx.shadowColor = isDark ? "#c084fc" : "#60a5fa";

      ctx.beginPath();
      ctx.ellipse(0, 0, ringRadiusX, ringRadiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Orbit satellite particle
      const satAngle = rotation * 1.5;
      const satX = ringRadiusX * Math.cos(satAngle);
      const satY = ringRadiusY * Math.sin(satAngle);
      ctx.fillStyle = isDark ? "#38bdf8" : "#2563eb";
      ctx.shadowBlur = 12;
      ctx.shadowColor = isDark ? "#38bdf8" : "#2563eb";
      ctx.beginPath();
      ctx.arc(satX, satY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <div
      className={`relative w-full h-[220px] sm:h-[240px] rounded-3xl overflow-hidden flex items-center justify-center p-3 select-none transition-all duration-300 ${
        isDark
          ? "bg-[#111726]/85 border border-slate-800/80 shadow-lg shadow-purple-950/10"
          : "bg-gradient-to-br from-white to-blue-50/50 border border-slate-200/80 shadow-sm"
      } ${className}`}
    >
      {/* Background Star Dots (Dark Mode Only) */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-4 left-8 w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
          <div className="absolute top-12 right-16 w-1 h-1 rounded-full bg-purple-400" />
          <div className="absolute bottom-6 left-24 w-1.5 h-1.5 rounded-full bg-indigo-300 opacity-60" />
          <div className="absolute top-20 right-8 w-1 h-1 rounded-full bg-pink-400 animate-ping" />
        </div>
      )}

      {/* Interactive 3D Canvas */}
      <canvas
        ref={canvasRef}
        width={360}
        height={220}
        className="max-w-full max-h-full object-contain pointer-events-none z-10"
      />

      {/* Floating Stat Badges */}
      {/* Top Left: Total Users */}
      <div
        className={`absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-md transition-transform hover:scale-105 shadow-sm border ${
          isDark
            ? "bg-[#1a2238]/80 border-slate-700/60 text-white"
            : "bg-white/85 border-slate-200/90 text-slate-900"
        }`}
      >
        <div className="w-6 h-6 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Users className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-xs font-extrabold leading-none">
            {totalUsers >= 1000 ? `${(totalUsers / 1000).toFixed(1)}K` : totalUsers}
          </div>
          <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            Total Users
          </div>
        </div>
      </div>

      {/* Top Right: Active Users */}
      <div
        className={`absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-md transition-transform hover:scale-105 shadow-sm border ${
          isDark
            ? "bg-[#1a2238]/80 border-slate-700/60 text-white"
            : "bg-white/85 border-slate-200/90 text-slate-900"
        }`}
      >
        <div className="w-6 h-6 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UserCheck className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-xs font-extrabold leading-none">{activeUsers}</div>
          <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            Active Users
          </div>
        </div>
      </div>

      {/* Bottom Left: Total Deposits */}
      <div
        className={`absolute bottom-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-md transition-transform hover:scale-105 shadow-sm border ${
          isDark
            ? "bg-[#1a2238]/80 border-slate-700/60 text-white"
            : "bg-white/85 border-slate-200/90 text-slate-900"
        }`}
      >
        <div className="w-6 h-6 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
          <ArrowDownToLine className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-xs font-extrabold leading-none font-mono">
            {totalDeposits.toFixed(2)} USDT
          </div>
          <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            Total Deposits
          </div>
        </div>
      </div>

      {/* Bottom Right: Total Withdrawals */}
      <div
        className={`absolute bottom-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-md transition-transform hover:scale-105 shadow-sm border ${
          isDark
            ? "bg-[#1a2238]/80 border-slate-700/60 text-white"
            : "bg-white/85 border-slate-200/90 text-slate-900"
        }`}
      >
        <div className="w-6 h-6 rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center">
          <ArrowUpFromLine className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-xs font-extrabold leading-none font-mono">
            {totalWithdrawals.toFixed(2)} USDT
          </div>
          <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            Total Withdrawals
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardGlobe;
