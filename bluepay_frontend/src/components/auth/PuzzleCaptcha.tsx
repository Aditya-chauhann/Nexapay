import React, { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, Sparkles, AlertCircle } from "lucide-react";

interface PuzzleCaptchaProps {
  onSuccess: () => void;
  onRefresh?: () => void;
  isSolved: boolean;
}

export function PuzzleCaptcha({ onSuccess, onRefresh, isSolved }: PuzzleCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const dockPieceRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [targetDelta, setTargetDelta] = useState({ x: -160, y: 0 });
  const [isNearTarget, setIsNearTarget] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Target slot X position inside landscape (between 125px and 175px)
  const [slotX, setSlotX] = useState(150);
  const slotY = 42; // Fixed Y position perfectly aligned horizontally with the dock piece

  // Randomize slot X on mount or refresh
  const randomizeSlot = useCallback(() => {
    const newX = Math.floor(Math.random() * 45) + 130; // 130 to 175
    setSlotX(newX);
    setPosition({ x: 0, y: 0 });
    setIsNearTarget(false);
    setHasInteracted(false);
    setFeedbackMessage(null);
  }, []);

  // Calculate the exact offset from dock piece to target hole
  const updateTargetDelta = useCallback(() => {
    if (targetRef.current && dockPieceRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const dockRect = dockPieceRef.current.getBoundingClientRect();
      setTargetDelta({
        x: targetRect.left - dockRect.left,
        y: targetRect.top - dockRect.top,
      });
    }
  }, []);

  useEffect(() => {
    randomizeSlot();
  }, [randomizeSlot]);

  useEffect(() => {
    updateTargetDelta();
    window.addEventListener("resize", updateTargetDelta);
    return () => window.removeEventListener("resize", updateTargetDelta);
  }, [updateTargetDelta, slotX]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 500);
    randomizeSlot();
    if (onRefresh) onRefresh();
  };

  // Drag handlers using pointer events
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSolved) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateTargetDelta();
    setIsDragging(true);
    setHasInteracted(true);
    setFeedbackMessage(null);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartPos({ ...position });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isSolved) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    const newX = startPos.x + deltaX;
    const newY = startPos.y + deltaY;

    setPosition({ x: newX, y: newY });

    // Distance to target
    const dist = Math.hypot(newX - targetDelta.x, newY - targetDelta.y);
    setIsNearTarget(dist < 45);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isSolved) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // Distance to target
    const dist = Math.hypot(position.x - targetDelta.x, position.y - targetDelta.y);

    // Snap tolerance: within 35px
    if (dist < 35) {
      setPosition({ x: targetDelta.x, y: targetDelta.y });
      setIsNearTarget(false);
      onSuccess();
    } else {
      // Smoothly return back to dock
      setPosition({ x: 0, y: 0 });
      setIsNearTarget(false);
      setFeedbackMessage("Try again — drag into the matching slot");
      setTimeout(() => setFeedbackMessage(null), 2500);
    }
  };

  // Standard classic 52x52 jigsaw puzzle piece path with tabs and blanks
  const piecePath = "M 10 0 H 22 C 22 6 24 8 26 8 C 28 8 30 6 30 0 H 42 C 48 0 52 4 52 10 V 22 C 58 22 60 24 60 26 C 60 28 58 30 52 30 V 42 C 52 48 48 52 42 52 H 30 C 30 46 28 44 26 44 C 24 44 22 46 22 52 H 10 C 4 52 0 48 0 42 V 30 C 6 30 8 28 8 26 C 8 24 6 22 0 22 V 10 C 0 4 4 0 10 0 Z";

  return (
    <div className="space-y-2 select-none" ref={containerRef}>
      {/* CAPTCHA Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <span>Complete the puzzle</span>
          {isSolved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
              Verified
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Refresh</span>
          <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Puzzle Interactive Box */}
      <div
        className={`relative w-full rounded-2xl p-2.5 sm:p-3 border transition-all duration-300 ${
          isSolved
            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-sm"
            : isNearTarget
            ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-md shadow-blue-500/10"
            : "bg-slate-50/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between gap-3 relative">
          {/* ═════════════════════════════════════════════════════════════
              1. MAIN LANDSCAPE IMAGE WITH HIGH-VISIBILITY TARGET HOLE
          ═════════════════════════════════════════════════════════════ */}
          <div className="relative flex-1 h-[140px] rounded-xl overflow-hidden shadow-inner border border-slate-200/80 dark:border-slate-800 bg-slate-900">
            {/* Scenic Alpine Night Landscape SVG */}
            <svg
              viewBox="0 0 280 140"
              className="w-full h-full object-cover"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <linearGradient id="skyGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#040d24" />
                  <stop offset="45%" stopColor="#0a2050" />
                  <stop offset="75%" stopColor="#143e8a" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>

                <linearGradient id="nebulaGrad2" x1="0%" y1="0%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                  <stop offset="50%" stopColor="#818cf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
                </linearGradient>

                <linearGradient id="mountainGradA" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#f1f5f9" />
                  <stop offset="25%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>

                <linearGradient id="mountainGradB" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#e2e8f0" />
                  <stop offset="35%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#091024" />
                </linearGradient>

                <linearGradient id="waterGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0d2b63" />
                  <stop offset="100%" stopColor="#040e24" />
                </linearGradient>

                {/* Intense Cyan Target Slot Glow */}
                <filter id="slotTargetGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Sky and Nebula */}
              <rect width="280" height="140" fill="url(#skyGrad2)" />
              <ellipse cx="140" cy="40" rx="135" ry="45" fill="url(#nebulaGrad2)" />

              {/* Stars */}
              <g fill="#ffffff">
                <circle cx="15" cy="18" r="0.75" opacity="0.9" />
                <circle cx="38" cy="32" r="1.1" opacity="0.85" />
                <circle cx="65" cy="12" r="0.6" opacity="0.7" />
                <circle cx="92" cy="24" r="0.9" opacity="0.95" />
                <circle cx="120" cy="15" r="1.2" opacity="0.85" />
                <circle cx="155" cy="28" r="0.7" opacity="0.7" />
                <circle cx="180" cy="10" r="1" opacity="0.95" />
                <circle cx="215" cy="22" r="0.8" opacity="0.8" />
                <circle cx="245" cy="16" r="1.2" opacity="0.95" />
                <circle cx="265" cy="35" r="0.65" opacity="0.6" />
                <circle cx="45" cy="50" r="0.8" opacity="0.75" />
                <circle cx="230" cy="45" r="0.9" opacity="0.8" />
              </g>

              {/* Distant Mountains */}
              <polygon
                points="0,85 30,55 70,80 110,50 155,75 200,45 240,70 280,50 280,105 0,105"
                fill="#0b1b3d"
                opacity="0.85"
              />

              {/* Sharp Alpine Mountain Peaks */}
              <polygon points="0,105 45,42 95,105" fill="url(#mountainGradA)" />
              <polygon points="45,42 95,105 75,105 45,60" fill="#0a1936" opacity="0.6" />

              <polygon points="70,105 135,30 205,105" fill="url(#mountainGradB)" />
              <polygon points="135,30 205,105 175,105 135,55" fill="#060e22" opacity="0.7" />

              <polygon points="175,105 235,38 280,95 280,105" fill="url(#mountainGradA)" />

              {/* Water Surface / Lake Reflection */}
              <rect x="0" y="105" width="280" height="35" fill="url(#waterGrad2)" />
              <line x1="0" y1="105" x2="280" y2="105" stroke="#38bdf8" strokeWidth="0.75" opacity="0.45" />
              <ellipse cx="140" cy="116" rx="65" ry="1.5" fill="#38bdf8" opacity="0.3" />
              <ellipse cx="90" cy="125" rx="40" ry="1" fill="#818cf8" opacity="0.25" />
              <ellipse cx="200" cy="127" rx="45" ry="1.2" fill="#38bdf8" opacity="0.25" />
            </svg>

            {/* ── HIGH-VISIBILITY TARGET PUZZLE HOLE ── */}
            <div
              ref={targetRef}
              className={`absolute pointer-events-none transition-all duration-300 z-10 ${
                isNearTarget ? "scale-105" : ""
              }`}
              style={{
                left: `${slotX}px`,
                top: `${slotY}px`,
                width: "56px",
                height: "56px",
              }}
            >
              <svg width="56" height="56" viewBox="0 0 56 56" className="w-full h-full overflow-visible">
                {/* 1. Translucent Frosted Glass Interior (Extremely visible against background) */}
                <path
                  d={piecePath}
                  fill={
                    isSolved
                      ? "rgba(16, 185, 129, 0.25)"
                      : isNearTarget
                      ? "rgba(56, 189, 248, 0.45)"
                      : "rgba(255, 255, 255, 0.32)"
                  }
                  className="transition-colors duration-200"
                />

                {/* 2. Bright Crisp White / Sky-Blue Dashed Outline with Neon Glow */}
                <path
                  d={piecePath}
                  fill="none"
                  stroke={
                    isSolved
                      ? "#10b981"
                      : isNearTarget
                      ? "#38bdf8"
                      : "rgba(255, 255, 255, 0.95)"
                  }
                  strokeWidth={isSolved ? "2.5" : isNearTarget ? "2.5" : "2"}
                  strokeDasharray={isSolved ? "none" : "4 3"}
                  filter="url(#slotTargetGlow)"
                  className="transition-all duration-200"
                />
              </svg>

              {/* Target Indicator Text or Checkmark inside hole */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {isSolved ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-in zoom-in-50 duration-200" />
                ) : isNearTarget ? (
                  <span className="text-[10px] font-black text-sky-300 tracking-wider animate-pulse">
                    DROP
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-white/90 drop-shadow-md tracking-wider">
                    TARGET
                  </span>
                )}
              </div>
            </div>

            {/* ── SUBTLE HORIZONTAL GUIDELINE CONNECTING DOCK TO TARGET ── */}
            {!isSolved && !isDragging && (
              <div className="absolute right-0 top-[68px] w-24 pointer-events-none flex items-center justify-end pr-1 opacity-70 animate-pulse">
                <svg width="90" height="20" viewBox="0 0 90 20" fill="none">
                  <path
                    d="M 85 10 L 10 10"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <polygon points="10,6 2,10 10,14" fill="#38bdf8" />
                </svg>
              </div>
            )}
          </div>

          {/* ═════════════════════════════════════════════════════════════
              2. DEDICATED "DRAG" AREA ON THE RIGHT WITH MATCHING PIECE
          ═════════════════════════════════════════════════════════════ */}
          <div className="w-[88px] sm:w-[96px] h-[140px] rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-between p-2 relative overflow-visible shadow-xs shrink-0">
            {/* Top Tag: "DRAG" */}
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
              Drag
            </span>

            {/* Center Area containing the piece */}
            <div className="relative w-[56px] h-[56px] flex items-center justify-center my-auto">
              {/* Silhouette outline in dock showing where piece was */}
              <div className="opacity-25 pointer-events-none">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <path d={piecePath} fill="#64748b" stroke="#94a3b8" strokeDasharray="2 2" />
                </svg>
              </div>

              {/* Draggable Puzzle Piece Element */}
              <div
                ref={dockPieceRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`absolute cursor-grab active:cursor-grabbing touch-none select-none z-40 transition-shadow ${
                  isDragging
                    ? "scale-105 shadow-2xl opacity-90 cursor-grabbing"
                    : isSolved
                    ? "pointer-events-none"
                    : "hover:scale-105 transition-transform"
                }`}
                style={{
                  transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                  width: "56px",
                  height: "56px",
                  transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  touchAction: "none",
                }}
              >
                {/* Puzzle Piece with exactly matching dimensions and scenic texture */}
                <div className="relative w-full h-full filter drop-shadow-xl">
                  <svg width="56" height="56" viewBox="0 0 56 56" className="w-full h-full">
                    <defs>
                      <clipPath id="pieceClipA">
                        <path d={piecePath} />
                      </clipPath>
                    </defs>

                    {/* Cutout graphic with matching alpine mountain texture */}
                    <g clipPath="url(#pieceClipA)">
                      <rect width="56" height="56" fill="#0a2050" />
                      {/* Stars */}
                      <circle cx="16" cy="12" r="0.9" fill="#ffffff" opacity="0.9" />
                      <circle cx="36" cy="18" r="1.1" fill="#ffffff" opacity="0.8" />
                      <circle cx="46" cy="8" r="0.7" fill="#ffffff" opacity="0.75" />
                      {/* Mountain Peak portion inside piece */}
                      <polygon points="5,56 28,14 56,56" fill="#f1f5f9" />
                      <polygon points="28,14 56,56 46,56 28,26" fill="#091024" opacity="0.65" />
                      <rect x="0" y="44" width="56" height="12" fill="#0d2b63" />
                      <line x1="0" y1="44" x2="56" y2="44" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
                    </g>

                    {/* Crisp border around the piece */}
                    <path
                      d={piecePath}
                      fill="none"
                      stroke={
                        isSolved
                          ? "#10b981"
                          : isDragging
                          ? "#38bdf8"
                          : "rgba(255, 255, 255, 0.95)"
                      }
                      strokeWidth={isSolved ? "2.5" : "2"}
                      filter="drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35))"
                    />
                  </svg>

                  {/* Hand / Cursor Icon communicating that piece can be dragged */}
                  {!isSolved && !hasInteracted && !isDragging && (
                    <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white rounded-full p-1 shadow-md animate-bounce pointer-events-none">
                      <span className="text-xs">👆</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Status Tag */}
            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500">
              {isSolved ? "Done" : "Hold & Drag"}
            </span>
          </div>
        </div>

        {/* Caption below puzzle */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-center font-medium min-h-[18px]">
          {isSolved ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in duration-200">
              <Sparkles className="w-3.5 h-3.5" />
              Verified securely ✓
            </span>
          ) : feedbackMessage ? (
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 animate-in fade-in duration-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {feedbackMessage}
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              Drag the puzzle piece into the matching slot
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
