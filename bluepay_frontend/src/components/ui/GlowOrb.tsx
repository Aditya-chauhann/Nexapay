import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import "./GlowOrb.css";

interface GlowOrbProps {
  color: "blue" | "green";
  icon: "tether" | "rupee";
  className?: string;
}

export const GlowOrb: React.FC<GlowOrbProps> = ({ color, icon, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Mouse positions
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for tilt
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15 });

  // Map mouse positions to rotation degrees (max ~15 degrees)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calculate mouse position relative to center of element (-0.5 to 0.5)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const imageSrc = icon === "tether" ? "/tether-3d.png" : "/rupee-3d.png";

  return (
    <motion.div
      ref={ref}
      className={`glow-orb-container glow-orb-${color} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
      }}
    >
      <div className="glow-orb-3d-image-wrapper">
        <img src={imageSrc} alt={`${icon} 3d glass`} className="glow-orb-3d-image" />
      </div>
      
      {/* Subtle ambient particles */}
      <div 
        className="glow-particle" 
        style={{ width: 8, height: 8, top: '20%', left: '-10%', animationDelay: '0s', color: color === 'blue' ? '#3b82f6' : '#10b981' }} 
      />
      <div 
        className="glow-particle" 
        style={{ width: 12, height: 12, bottom: '10%', right: '-5%', animationDelay: '1.5s', color: color === 'blue' ? '#3b82f6' : '#10b981' }} 
      />
      <div 
        className="glow-particle" 
        style={{ width: 6, height: 6, top: '70%', left: '110%', animationDelay: '3s', color: color === 'blue' ? '#3b82f6' : '#10b981' }} 
      />
    </motion.div>
  );
};
