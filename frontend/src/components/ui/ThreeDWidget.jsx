"use client";
import React, { useEffect, useRef, useState } from 'react';

/**
 * ThreeDWidget: A highly interactive 3D canvas rendering engine running purely on React and HTML5 Canvas.
 * Supports:
 * - Click & drag to rotate in 3D space.
 * - Mouse movement interaction (deformations, repulsion).
 * - Custom themes matching the DermaScan color schemas.
 * 
 * Props:
 * - type: "molecule" | "face" | "dna" | "matrix"
 * - className: CSS classes for sizing (e.g. "w-full h-64")
 */
export default function ThreeDWidget({ type = "molecule", className = "w-full h-full" }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Mouse interaction state
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const rotAngles = useRef({ x: 0, y: 0 }); // Current rotation angle offsets from dragging
  const baseRotSpeed = useRef({ x: 0.005, y: 0.007 }); // Continuous rotation speeds
  const mousePos = useRef({ x: null, y: null, targetX: null, targetY: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let lastWidth = 0;
    let lastHeight = 0;

    // Responsive Canvas Resize
    const resizeCanvas = () => {
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const newWidth = rect.width;
      const newHeight = rect.height;

      canvas.width = newWidth * window.devicePixelRatio;
      canvas.height = newHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      if (newWidth > 0 && newHeight > 0 && (newWidth !== lastWidth || newHeight !== lastHeight)) {
        lastWidth = newWidth;
        lastHeight = newHeight;
        initObjects();
      }
    };

    // Interactive 3D Objects Setup
    let particles = [];
    let connections = [];
    const center = { x: 0, y: 0 };

    // --- Object Builders ---
    const buildMolecule = (width, height) => {
      particles = [];
      const numParticles = 45;
      const radius = Math.min(width, height) * 0.35;
      for (let i = 0; i < numParticles; i++) {
        // Spherical distribution
        const theta = Math.acos((Math.random() * 2) - 1);
        const phi = Math.random() * Math.PI * 2;
        particles.push({
          x: radius * Math.sin(theta) * Math.cos(phi),
          y: radius * Math.sin(theta) * Math.sin(phi),
          z: radius * Math.cos(theta),
          size: Math.random() * 3 + 2,
          color: i % 2 === 0 ? 'rgba(20, 184, 166, opacity)' : 'rgba(16, 185, 129, opacity)'
        });
      }
    };

    const buildFaceScanner = (width, height) => {
      particles = [];
      // Create a 15x15 grid forming a skin/face-like curved surface
      const cols = 15;
      const rows = 15;
      const spacingX = (width * 0.7) / (cols - 1);
      const spacingY = (height * 0.7) / (rows - 1);
      const startX = - (width * 0.35);
      const startY = - (height * 0.35);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * spacingX;
          const y = startY + r * spacingY;
          // Curve upwards in the center (creating a facial peak)
          const distFromCenter = Math.sqrt(x*x + y*y);
          const z = Math.cos(distFromCenter / 60) * 35;

          particles.push({
            x, y, z,
            ox: x, oy: y, oz: z, // Original coordinates for restoring deformation
            row: r,
            col: c,
            color: 'rgba(16, 185, 129, opacity)'
          });
        }
      }
    };

    const buildDNA = (width, height) => {
      particles = [];
      const nodesPerStrand = 18;
      const radius = Math.min(width, height) * 0.22;
      const helixHeight = height * 0.7;

      for (let i = 0; i < nodesPerStrand; i++) {
        const t = (i / (nodesPerStrand - 1)) * Math.PI * 3.5; // Twist factor
        const y = -helixHeight/2 + (i / (nodesPerStrand - 1)) * helixHeight;

        // Strand 1
        const x1 = radius * Math.cos(t);
        const z1 = radius * Math.sin(t);
        particles.push({
          x: x1, y, z: z1,
          strand: 1,
          index: i,
          size: 4.5,
          color: 'rgba(20, 184, 166, opacity)' // Teal
        });

        // Strand 2 (180 deg phase shift)
        const x2 = radius * Math.cos(t + Math.PI);
        const z2 = radius * Math.sin(t + Math.PI);
        particles.push({
          x: x2, y, z: z2,
          strand: 2,
          index: i,
          size: 4.5,
          color: 'rgba(168, 85, 247, opacity)' // Violet/Purple
        });
      }
    };

    const buildMatrixCube = (width, height) => {
      particles = [];
      const size = Math.min(width, height) * 0.26;
      
      // Outer Cube Corners (8 nodes)
      const outerCorners = [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1],  [1, -1, 1],  [1, 1, 1],  [-1, 1, 1]
      ];

      // Build outer corners
      outerCorners.forEach(([cx, cy, cz]) => {
        particles.push({
          x: cx * size, y: cy * size, z: cz * size,
          size: 5,
          color: 'rgba(239, 68, 68, opacity)', // Red
          type: 'outer'
        });
      });

      // Inner Cube Corners (8 nodes)
      const innerSize = size * 0.45;
      outerCorners.forEach(([cx, cy, cz]) => {
        particles.push({
          x: cx * innerSize, y: cy * innerSize, z: cz * innerSize,
          size: 3.5,
          color: 'rgba(245, 158, 11, opacity)', // Amber
          type: 'inner'
        });
      });

      // Data packets sliding along virtual wires
      connections = [
        // Outer Cube Edges
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
        // Inner Cube Edges (nodes 8 to 15)
        [8, 9], [9, 10], [10, 11], [11, 8],
        [12, 13], [13, 14], [14, 15], [15, 12],
        [8, 12], [9, 13], [10, 14], [11, 15],
        // Inter-cube struts (Outer to Inner)
        [0, 8], [1, 9], [2, 10], [3, 11],
        [4, 12], [5, 13], [6, 14], [7, 15]
      ];
    };

    // Initialize objects
    const initObjects = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      center.x = width / 2;
      center.y = height / 2;

      if (type === 'molecule') buildMolecule(width, height);
      else if (type === 'face') buildFaceScanner(width, height);
      else if (type === 'dna') buildDNA(width, height);
      else if (type === 'matrix') buildMatrixCube(width, height);
    };

    // Start resize observation after all variables and builders are fully declared
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    resizeCanvas();

    // Active scan sweeping line position for face scanner
    let faceScanLineY = -120;
    let faceScanDirection = 1;

    // Simulation Loop
    let angleX = 0;
    let angleY = 0;

    const animate = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      // 1. Continuous rotation + mouse drag offsets
      angleX += baseRotSpeed.current.x;
      angleY += baseRotSpeed.current.y;
      
      const totalAngleX = angleX + rotAngles.current.x;
      const totalAngleY = angleY + rotAngles.current.y;

      const cosX = Math.cos(totalAngleX);
      const sinX = Math.sin(totalAngleX);
      const cosY = Math.cos(totalAngleY);
      const sinY = Math.sin(totalAngleY);

      // Track sweeping scanline for 'face' grid
      if (type === 'face') {
        faceScanLineY += 1.8 * faceScanDirection;
        if (faceScanLineY > height * 0.4 || faceScanLineY < -height * 0.4) {
          faceScanDirection *= -1;
        }
      }

      // 2. Projection & 3D transformations
      const projected = particles.map(p => {
        // Rotate around Y-axis
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.x * sinY + p.z * cosY;

        // Rotate around X-axis
        let y2 = p.y * cosX - z1 * sinX;
        let z2 = p.y * sinX + z1 * cosX;

        // Interactive mouse effects (Attraction/Repulsion/Deformation)
        if (mousePos.current.x !== null) {
          const screenCenterX = center.x + x1;
          const screenCenterY = center.y + y2;
          const dx = mousePos.current.x - screenCenterX;
          const dy = mousePos.current.y - screenCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (type === 'face') {
            // Push skin nodes inward creating an indentation mesh effect
            if (dist < 80) {
              const depthForce = (80 - dist) / 80;
              z2 += depthForce * 18; // Pull in depth
            }
          } else {
            // Radial push-away for molecule/DNA
            if (dist < 90) {
              const pushForce = (90 - dist) / 90;
              x1 -= (dx / (dist || 1)) * pushForce * 12;
              y2 -= (dy / (dist || 1)) * pushForce * 12;
            }
          }
        }

        // Perspective Projection
        const perspective = 300;
        const scale = perspective / (perspective + z2);
        
        return {
          ...p,
          px: center.x + x1 * scale,
          py: center.y + y2 * scale,
          depth: z2,
          scale: scale
        };
      });

      // --- RENDERING MODES ---

      if (type === 'molecule') {
        // Connect points close to each other in 3D
        const maxDist = Math.min(width, height) * 0.32;
        ctx.lineWidth = 0.55;
        for (let i = 0; i < projected.length; i++) {
          for (let j = i + 1; j < projected.length; j++) {
            const p1 = projected[i];
            const p2 = projected[j];
            const dx = p1.px - p2.px;
            const dy = p1.py - p2.py;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d < maxDist) {
              const alpha = (1 - (d / maxDist)) * 0.18 * p1.scale;
              ctx.strokeStyle = `rgba(20, 184, 166, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(p1.px, p1.py);
              ctx.lineTo(p2.px, p2.py);
              ctx.stroke();
            }
          }
        }

        // Draw Nodes
        projected.forEach(p => {
          const alpha = Math.max(0.15, Math.min(1, p.scale));
          ctx.beginPath();
          ctx.arc(p.px, p.py, p.size * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = p.color.replace('opacity', alpha.toString());
          ctx.fill();
        });
      }

      else if (type === 'face') {
        // Wireframe Grid Mesh connections
        ctx.lineWidth = 0.5;
        const cols = 15;
        const rows = 15;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const p = projected[idx];

            ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
            // Horizontal link
            if (c < cols - 1) {
              const pRight = projected[idx + 1];
              ctx.beginPath();
              ctx.moveTo(p.px, p.py);
              ctx.lineTo(pRight.px, pRight.py);
              ctx.stroke();
            }
            // Vertical link
            if (r < rows - 1) {
              const pDown = projected[idx + cols];
              ctx.beginPath();
              ctx.moveTo(p.px, p.py);
              ctx.lineTo(pDown.px, pDown.py);
              ctx.stroke();
            }

            // Glow highlighted nodes near the sweeping horizontal scan plane
            const rawY = p.y;
            const scanDist = Math.abs(rawY - faceScanLineY);
            if (scanDist < 8) {
              ctx.beginPath();
              ctx.arc(p.px, p.py, 2.5 * p.scale, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(34, 197, 94, ${p.scale})`;
              ctx.shadowColor = 'rgba(34, 197, 94, 0.6)';
              ctx.shadowBlur = 8;
              ctx.fill();
              ctx.shadowBlur = 0; // reset
            } else {
              ctx.beginPath();
              ctx.arc(p.px, p.py, 1 * p.scale, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(16, 185, 129, ${p.scale * 0.35})`;
              ctx.fill();
            }
          }
        }

        // Draw Sweep scanning plane indicator
        const scanYProj = center.y + faceScanLineY * Math.cos(totalAngleX);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width * 0.15, scanYProj);
        ctx.lineTo(width * 0.85, scanYProj);
        ctx.stroke();
      }

      else if (type === 'dna') {
        // Draw horizontal connecting rungs (bases pairs)
        const nodesPerStrand = 18;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < nodesPerStrand; i++) {
          const p1 = projected[i * 2];
          const p2 = projected[i * 2 + 1];

          // Connection base rung gradient
          const grad = ctx.createLinearGradient(p1.px, p1.py, p2.px, p2.py);
          grad.addColorStop(0, 'rgba(20, 184, 166, 0.45)');
          grad.addColorStop(0.5, 'rgba(120, 119, 198, 0.2)');
          grad.addColorStop(1, 'rgba(168, 85, 247, 0.45)');

          ctx.strokeStyle = grad;
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        }

        // Connect the spiral strands vertically
        ctx.lineWidth = 0.8;
        for (let strand = 1; strand <= 2; strand++) {
          ctx.strokeStyle = strand === 1 ? 'rgba(20, 184, 166, 0.25)' : 'rgba(168, 85, 247, 0.25)';
          ctx.beginPath();
          for (let i = 0; i < nodesPerStrand; i++) {
            const idx = i * 2 + (strand - 1);
            const p = projected[idx];
            if (i === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          }
          ctx.stroke();
        }

        // Draw Helix Nodes
        projected.forEach(p => {
          const alpha = Math.max(0.2, Math.min(1, p.scale));
          ctx.beginPath();
          ctx.arc(p.px, p.py, p.size * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = p.color.replace('opacity', alpha.toString());
          ctx.fill();
        });
      }

      else if (type === 'matrix') {
        // Draw tesseract connections
        ctx.lineWidth = 0.55;
        connections.forEach(([n1, n2]) => {
          const p1 = projected[n1];
          const p2 = projected[n2];

          const isInner = p1.type === 'inner' && p2.type === 'inner';
          const isStrut = p1.type !== p2.type;

          ctx.strokeStyle = isInner 
            ? 'rgba(245, 158, 11, 0.15)' 
            : isStrut 
              ? 'rgba(255, 255, 255, 0.08)' 
              : 'rgba(239, 68, 68, 0.15)';

          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        });

        // Draw animated data flow pulses along edges
        const pulseTime = (Date.now() / 1500) % 1;
        ctx.fillStyle = 'rgba(251, 146, 60, 0.8)';
        connections.forEach(([n1, n2]) => {
          // Send pulse along 30% of connections
          if ((n1 + n2) % 3 === 0) {
            const p1 = projected[n1];
            const p2 = projected[n2];
            const px = p1.px + (p2.px - p1.px) * pulseTime;
            const py = p1.py + (p2.py - p1.py) * pulseTime;
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Draw Nodes
        projected.forEach(p => {
          const alpha = Math.max(0.2, Math.min(1, p.scale));
          ctx.beginPath();
          ctx.arc(p.px, p.py, p.size * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = p.color.replace('opacity', alpha.toString());
          ctx.fill();
        });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [type]);

  // --- MOUSE HANDLERS FOR DRAG ROTATION & HOVER ACTION ---

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mousePos.current.x = x;
    mousePos.current.y = y;

    if (isDragging) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      // Update rotation angles dynamically based on drag distance
      rotAngles.current.x += dy * 0.01;
      rotAngles.current.y += dx * 0.01;

      // Set base speed to 0 when user drags it
      baseRotSpeed.current.x = 0;
      baseRotSpeed.current.y = 0;

      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Slowly restore autonomous rotation speed on release
    baseRotSpeed.current = { x: 0.005, y: 0.007 };
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    mousePos.current.x = null;
    mousePos.current.y = null;
    baseRotSpeed.current = { x: 0.005, y: 0.007 };
  };

  return (
    <div 
      ref={containerRef} 
      className={`${className} relative overflow-hidden bg-slate-950/45 border border-slate-900/60 rounded-3xl group/canvas cursor-grab active:cursor-grabbing shadow-inner flex items-center justify-center`}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
      
      {/* Interactive HUD labels indicating click-drag utility */}
      <div className="absolute bottom-2.5 left-4 right-4 flex justify-between items-center opacity-0 group-hover/canvas:opacity-100 transition-opacity pointer-events-none select-none">
        <span className="text-[7.5px] font-mono font-black tracking-widest text-slate-500 uppercase">
          {type} simulation node
        </span>
        <span className="text-[7.5px] font-mono font-bold tracking-widest text-emerald-500/80 uppercase">
          DRAG 3D MODEL
        </span>
      </div>
    </div>
  );
}
