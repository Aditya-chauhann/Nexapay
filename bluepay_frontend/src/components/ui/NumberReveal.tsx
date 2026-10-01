import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface NumberRevealProps {
  value: string | number;
  label?: string;
}

export const NumberReveal: React.FC<NumberRevealProps> = ({ value, label }) => {
  const formattedStr =
    typeof value === "number"
      ? value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(value);

  const [displayValue, setDisplayValue] = useState(formattedStr);
  const [isScrambling, setIsScrambling] = useState(false);

  useEffect(() => {
    let iterations = 0;
    const maxIterations = 20; // 20 frames of gibberish
    setIsScrambling(true);
    
    const interval = setInterval(() => {
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        setDisplayValue(formattedStr);
        setIsScrambling(false);
      } else {
        // Scramble the digits
        const scrambled = formattedStr
          .split("")
          .map((char) => {
            if (char === "." || char === ",") return char;
            return Math.floor(Math.random() * 10).toString();
          })
          .join("");
        setDisplayValue(scrambled);
      }
    }, 40); // 40ms per frame

    return () => clearInterval(interval);
  }, [formattedStr]);

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="relative group flex flex-col items-center p-4 min-w-[180px] transition-all duration-300"
    >
      {/* Background glow effect that activates on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />
      
      {label && (
        <div className="relative z-10 mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary shadow-[0_0_8px_rgba(16,185,129,1)]"></span>
          </span>
          {label}
        </div>
      )}
      
      <div className="relative z-10 flex items-center gap-[2px]">
        <div className="mr-1 text-xl font-medium text-primary transition-colors duration-300">₹</div>
        {displayValue.split("").map((char, i) => {
          const isPunctuation = char === "." || char === ",";
          return (
            <div
              key={i}
              className={`relative overflow-hidden flex items-center justify-center rounded-lg border font-mono font-bold transition-all duration-300 ${
                isPunctuation 
                  ? "w-4 bg-transparent border-transparent text-primary shadow-none text-xl" 
                  : `w-8 h-10 text-xl shadow-sm ${
                      isScrambling 
                        ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                        : 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_15px_rgba(16,185,129,0.5)] group-hover:bg-primary/20 group-hover:shadow-[0_0_25px_rgba(16,185,129,0.7)]'
                    }`
              }`}
            >
              {/* Glass reflection highlight */}
              {!isPunctuation && (
                 <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              )}
              
              <span className={!isPunctuation && !isScrambling ? "drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-300" : ""}>
                {char}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
