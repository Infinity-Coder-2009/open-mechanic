"use client";

import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { 
  OrbitControls, 
  Grid, 
  AxesHelper, 
  ContactShadows,
  Stage,
  Html,
  Lines,
  useLines
} from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";

// Fan geometry component
function FanModel({ spec, wireframe, color }: { spec?: any; wireframe?: boolean; color?: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  
  useEffect(() => {
    if (!groupRef.current || !spec) return;
    
    const group = groupRef.current;
    group.clear();
    
    const params = spec.subAssemblies?.[0]?.mechanical || {};
    const diameter = params.bladeDiameter || 400;
    const bladeCount = params.bladeCount || 5;
    const hubDiameter = params.hubDiameter || 60;
    const bladeThickness = params.bladeThickness || 3;
    
    const radius = diameter / 2;
    const hubRadius = hubDiameter / 2;
    const bladeLength = radius - hubRadius;
    
    const material = new THREE.MeshBasicMaterial({
      color: color || 0x00b4d8,
      wireframe: wireframe ?? true,
      transparent: true,
      opacity: wireframe ? 0.6 : 0.8,
    });
    
    // Hub
    const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, 20, 32);
    const hub = new THREE.Mesh(hubGeo, material);
    hub.position.y = 10;
    group.add(hub);
    
    // Motor shaft hole
    const shaftGeo = new THREE.CylinderGeometry(4, 4, 25, 16);
    const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ 
      color: 0x333333, 
      wireframe: true 
    }));
    shaft.position.y = 12.5;
    group.add(shaft);
    
    // Blades
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2;
      
      // Create blade shape
      const bladeShape = new THREE.Shape();
      const chordRoot = 80;
      const chordTip = 40;
      
      bladeShape.moveTo(hubRadius, -chordRoot/2);
      bladeShape.lineTo(hubRadius, chordRoot/2);
      bladeShape.lineTo(radius, chordTip/2);
      bladeShape.lineTo(radius, -chordTip/2);
      
      const extrudeSettings = {
        depth: bladeThickness,
        bevelEnabled: false,
      };
      
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
      const blade = new THREE.Mesh(bladeGeo, material);
      
      blade.rotation.z = angle;
      blade.rotation.x = -Math.PI / 2;
      blade.position.y = bladeThickness / 2;
      
      group.add(blade);
    }
    
    // Guard ring
    const guardGeo = new THREE.TorusGeometry(radius + 10, 3, 8, 64);
    const guard = new THREE.Mesh(guardGeo, new THREE.MeshBasicMaterial({
      color: 0x666666,
      wireframe: true,
      opacity: 0.4,
      transparent: true,
    }));
    guard.rotation.x = Math.PI / 2;
    guard.position.y = 10;
    group.add(guard);
    
  }, [spec, wireframe, color]);
  
  return <group ref={groupRef} />;
}

// Drone geometry component
function DroneModel({ wireframe, color }: { wireframe?: boolean; color?: string }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useEffect(() => {
    if (!groupRef.current) return;
    
    const group = groupRef.current;
    group.clear();
    
    const material = new THREE.MeshBasicMaterial({
      color: color || 0x00b4d8,
      wireframe: wireframe ?? true,
      transparent: true,
      opacity: wireframe ? 0.6 : 0.8,
    });
    
    // Center body
    const bodyGeo = new THREE.BoxGeometry(80, 30, 80);
    const body = new THREE.Mesh(bodyGeo, material);
    group.add(body);
    
    // Arms
    const armLength = 180;
    const armGeo = new THREE.CylinderGeometry(8, 8, armLength, 8);
    
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const arm = new THREE.Mesh(armGeo, material);
      arm.position.x = Math.cos(angle) * (armLength/2 + 40);
      arm.position.y = Math.sin(angle) * (armLength/2 + 40);
      arm.rotation.z = angle + Math.PI/2;
      group.add(arm);
      
      // Motor at end of arm
      const motorGeo = new THREE.CylinderGeometry(20, 20, 25, 16);
      const motor = new THREE.Mesh(motorGeo, new THREE.MeshBasicMaterial({
        color: 0x888888,
        wireframe: true,
      }));
      motor.position.x = Math.cos(angle) * (armLength + 25);
      motor.position.y = Math.sin(angle) * (armLength + 25);
      motor.rotation.x = Math.PI / 2;
      group.add(motor);
      
      // Propeller
      const propGeo = new THREE.CylinderGeometry(100, 100, 3, 32);
      const prop = new THREE.Mesh(propGeo, new THREE.MeshBasicMaterial({
        color: 0x222222,
        wireframe: true,
        opacity: 0.3,
        transparent: true,
      }));
      prop.position.x = Math.cos(angle) * (armLength + 25);
      prop.position.y = Math.sin(angle) * (armLength + 25);
      prop.position.z = 15;
      group.add(prop);
    }
  }, [wireframe, color]);
  
  return <group ref={groupRef} />;
}

// Robotic arm component
function RoboticArmModel({ wireframe, color }: { wireframe?: boolean; color?: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const [jointAngles, setJointAngles] = useState([0, -0.5, 1.0, 0, 0.5, 0]);
  
  useFrame((_, delta) => {
    // Subtle animation
    setJointAngles(prev => prev.map((a, i) => a + Math.sin(Date.now() * 0.001 + i) * 0.001));
  });
  
  useEffect(() => {
    if (!groupRef.current) return;
    
    const group = groupRef.current;
    group.clear();
    
    const material = new THREE.MeshBasicMaterial({
      color: color || 0x00b4d8,
      wireframe: wireframe ?? true,
      transparent: true,
      opacity: wireframe ? 0.6 : 0.8,
    });
    
    // Base
    const baseGeo = new THREE.CylinderGeometry(60, 80, 40, 16);
    const base = new THREE.Mesh(baseGeo, material);
    base.position.y = 20;
    group.add(base);
    
    // Links
    const linkLengths = [200, 180, 150, 100, 80];
    const jointRadii = [30, 25, 20, 15, 12];
    
    let currentY = 40;
    let currentAngle = 0;
    
    for (let i = 0; i < linkLengths.length; i++) {
      // Joint
      const jointGeo = new THREE.SphereGeometry(jointRadii[i], 16, 16);
      const joint = new THREE.Mesh(jointGeo, material);
      joint.position.y = currentY;
      group.add(joint);
      
      // Link
      const linkGeo = new THREE.CylinderGeometry(12, 10, linkLengths[i], 8);
      const link = new THREE.Mesh(linkGeo, material);
      link.position.y = currentY + linkLengths[i] / 2;
      group.add(link);
      
      currentY += linkLengths[i];
    }
    
    // End effector
    const eeGeo = new THREE.BoxGeometry(50, 30, 50);
    const ee = new THREE.Mesh(eeGeo, material);
    ee.position.y = currentY + 15;
    group.add(ee);
  }, [wireframe, color]);
  
  return <group ref={groupRef} />;
}

// Generic placeholder
function PlaceholderModel({ wireframe, color }: { wireframe?: boolean; color?: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const [rotation, setRotation] = useState(0);
  
  useFrame((_, delta) => {
    setRotation(r => r + delta * 0.2);
  });
  
  useEffect(() => {
    if (!groupRef.current) return;
    
    const group = groupRef.current;
    group.clear();
    
    const material = new THREE.MeshBasicMaterial({
      color: color || 0x00b4d8,
      wireframe: wireframe ?? true,
      transparent: true,
      opacity: wireframe ? 0.4 : 0.6,
    });
    
    // Rotating geometric shape
    const geo = new THREE.OctahedronGeometry(80, 0);
    const mesh = new THREE.Mesh(geo, material);
    group.add(mesh);
    
    // Inner shape
    const innerGeo = new THREE.IcosahedronGeometry(40, 0);
    const innerMesh = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({
      color: 0xff6b00,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    }));
    group.add(innerMesh);
  }, [wireframe, color]);
  
  return (
    <group ref={groupRef} rotation-y={rotation}>
      <group />
    </group>
  );
}

function Scene({ spec, wireframe, isGenerating }) {
  const modelType = spec?.type?.toLowerCase() || "";
  
  return (
    <>
      <Stage
        environment="city"
        intensity={0.5}
        contactShadowOpacity={0.3}
        shadows={false}
      >
        {modelType.includes("fan") && <FanModel spec={spec} wireframe={wireframe} />}
        {modelType.includes("drone") && <DroneModel wireframe={wireframe} />}
        {modelType.includes("robot") || modelType.includes("arm") ? (
          <RoboticArmModel wireframe={wireframe} />
        ) : (
          <PlaceholderModel wireframe={wireframe} />
        )}
      </Stage>
      
      <Grid 
        cellSize={50} 
        cellThickness={1} 
        sectionSize={10} 
        minorColor="#00b4d810" 
        majorColor="#00b4d830" 
        infinite 
      />
      
      <AxesHelper xAxisColor="#ff6b00" yAxisColor="#00ff88" zAxisColor="#8b5cf6" axisLength={200} />
      
      {isGenerating && (
        <Html
          position={[0, 200, 0]}
          style={{
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-primary font-mono">Generating...</span>
          </div>
        </Html>
      )}
    </>
  );
}

interface ThreeViewerProps {
  designSpec?: any;
  isGenerating?: boolean;
}

export function ThreeViewer({ designSpec, isGenerating }: ThreeViewerProps) {
  const [wireframe, setWireframe] = useState(true);
  const [cameraPosition, setCameraPosition] = useState([0, 150, 400]);
  
  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-black/50">
      <Canvas
        camera={{ position: cameraPosition, fov: 45 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x0a0f1a, 1);
          gl.shadowMap.enabled = false;
        }}
        style={{ touchAction: "none" }}
      >
        <Scene spec={designSpec} wireframe={wireframe} isGenerating={isGenerating} />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={100}
          maxDistance={1000}
          target={[0, 50, 0]}
        />
        
        <ContactShadows opacity={0.2} scale={200} blur={2} color="#00b4d8" />
      </Canvas>
      
      {/* Controls overlay */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-col items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-3 bg-background/80 backdrop-blur-md border border-border/30 rounded-lg px-4 py-2 pointer-events-auto">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span>Wireframe</span>
          </label>
          
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">View:</span>
            <button
              onClick={() => setCameraPosition([0, 150, 400])}
              className="btn-ghost p-1.5 text-xs"
              title="Perspective"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={() => setCameraPosition([0, 500, 0])}
              className="btn-ghost p-1.5 text-xs"
              title="Top"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16M4 4h16M4 4l16 16" />
              </svg>
            </button>
            <button
              onClick={() => setCameraPosition([400, 150, 0])}
              className="btn-ghost p-1.5 text-xs"
              title="Front"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
            <button
              onClick={() => setCameraPosition([0, 150, -400])}
              className="btn-ghost p-1.5 text-xs"
              title="Side"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center pointer-events-auto">
          Drag to rotate • Scroll to zoom • Right-click to pan
        </div>
      </div>
    </div>
  );
}