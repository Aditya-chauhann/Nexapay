import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { TorusKnot, Environment, Float, Html, MeshTransmissionMaterial, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

interface OrbProps {
  color: 'blue' | 'green'
  icon: 'tether' | 'rupee'
}

const OrbMesh = ({ color, icon }: OrbProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const knotRef = useRef<THREE.Mesh>(null)
  
  const baseColor = color === 'blue' ? '#3b82f6' : '#10b981'
  const emissiveColor = color === 'blue' ? '#1d4ed8' : '#059669'

  const autoRotateGroupRef = useRef<THREE.Group>(null)
  const mouseGroupRef = useRef<THREE.Group>(null)
  const iconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoRotateGroupRef.current && icon === 'rupee') {
      // Offset the second orb by 180 degrees so they don't face away at the same time
      autoRotateGroupRef.current.rotation.y = Math.PI
    }
  }, [icon])

  useFrame((state, delta) => {
    if (autoRotateGroupRef.current) {
      // Constant auto-rotation
      autoRotateGroupRef.current.rotation.y += 0.004
      autoRotateGroupRef.current.rotation.x += 0.002
      
      // Typography fading based on rotation (simulating facing away)
      if (iconRef.current) {
        // cosine of the y rotation gives a value between -1 and 1. 
        // 1 means perfectly facing the camera, 0 means side-on.
        const facingRatio = Math.max(0, Math.cos(autoRotateGroupRef.current.rotation.y % (Math.PI * 2)))
        const scale = 0.8 + (facingRatio * 0.4) // 0.8 to 1.2
        const opacity = 0.4 + (facingRatio * 0.6) // 0.4 to 1.0
        iconRef.current.style.transform = `scale(${scale})`
        iconRef.current.style.opacity = `${opacity}`
      }
    }
    
    if (mouseGroupRef.current) {
      // Mouse parallax tilt (additive on top of auto-rotate by using a nested group)
      const targetX = (state.pointer.x * Math.PI) / 6
      const targetY = (state.pointer.y * Math.PI) / 6
      mouseGroupRef.current.rotation.x = THREE.MathUtils.lerp(mouseGroupRef.current.rotation.x, -targetY, 0.1)
      mouseGroupRef.current.rotation.y = THREE.MathUtils.lerp(mouseGroupRef.current.rotation.y, targetX, 0.1)
    }
  })

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={autoRotateGroupRef}>
        <group ref={mouseGroupRef}>
          {/* Irregular TorusKnot (p=2, q=3) */}
          <mesh ref={knotRef}>
            <torusKnotGeometry args={[1.2, 0.5, 256, 64, 2, 3]} />
            
            <MeshTransmissionMaterial 
              backside
              backsideThickness={1}
              thickness={3}
              roughness={0.1}
              transmission={1}
              ior={1.45}
              chromaticAberration={0.03}
              anisotropy={0.1}
              color="#ffffff"
              attenuationDistance={0.5}
              attenuationColor={baseColor}
              clearcoat={1}
              clearcoatRoughness={0.05}
              distortion={0.5} // Creates the warped liquid surface
              temporalDistortion={0.2} // Animates the distortion over time
            />
          </mesh>
          
          {/* Floating particle bubbles matching the neon color */}
          <Sparkles 
            count={40} 
            scale={4} 
            size={3} 
            speed={0.4} 
            opacity={0.8} 
            color={baseColor} 
          />
          
          {/* Inner Glow Point Light */}
          <pointLight position={[0, 0, 0]} intensity={2} color={baseColor} distance={3} />
          <rectAreaLight width={5} height={5} intensity={2} color={baseColor} position={[0, 0, -2]} lookAt={[0, 0, 0] as any} />
          
          {/* Hovering icon inside the pebble */}
          <Html transform center position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
            <div 
              ref={iconRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '120px',
                color: '#ffffff',
                filter: `drop-shadow(0 0 10px #ffffff) drop-shadow(0 0 20px ${baseColor}) drop-shadow(0 0 40px ${baseColor})`,
                transition: 'opacity 0.1s ease-out, transform 0.1s ease-out'
              }}
            >
              {icon === 'tether' ? (
                <span style={{ fontSize: '5rem', fontWeight: 900, fontFamily: 'sans-serif' }}>$</span>
              ) : (
                <span style={{ fontSize: '5rem', fontWeight: 900, fontFamily: 'sans-serif' }}>₹</span>
              )}
            </div>
          </Html>
        </group>
      </group>
    </Float>
  )
}

export const ThreeDOrb: React.FC<OrbProps & { className?: string }> = ({ color, icon, className = '' }) => {
  return (
    <div className={`pointer-events-auto ${className}`} style={{ width: '400px', height: '400px' }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={1.5} />
        <spotLight position={[10, 10, 10]} intensity={2} angle={0.15} penumbra={1} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={1} color={color === 'blue' ? '#3b82f6' : '#10b981'} />
        
        <OrbMesh color={color} icon={icon} />
        
        {/* Environment map provides realistic reflections for the glass */}
        <Environment preset="night" />
      </Canvas>
    </div>
  )
}
