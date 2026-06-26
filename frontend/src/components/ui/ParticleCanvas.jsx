"use client";
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function ParticleCanvas() {
  const canvasRef = useRef(null);
  const location = useLocation();
  const path = location.pathname;

  // Determine background type based on active route
  let bgType = 'molecule';
  if (path === '/dashboard') bgType = 'skin';
  else if (path.includes('/doctor/')) bgType = 'dna';
  else if (path.includes('/admin/')) bgType = 'matrix';

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const mouse = { x: null, y: null, radius: 180 };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Simulation parameters
    let particles = [];
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    // --- Dynamic Particle Generator ---
    const buildBackground = () => {
      particles = [];
      const width = canvas.width;
      const height = canvas.height;
      center.x = width / 2;
      center.y = height / 2;

      if (bgType === 'molecule') {
        const numParticles = 75;
        const sphereRadius = Math.min(width, height) * 0.22;
        for (let i = 0; i < numParticles; i++) {
          const theta = Math.acos((Math.random() * 2) - 1);
          const phi = Math.random() * Math.PI * 2;
          particles.push({
            x: sphereRadius * Math.sin(theta) * Math.cos(phi),
            y: sphereRadius * Math.sin(theta) * Math.sin(phi),
            z: sphereRadius * Math.cos(theta),
            rx: 0, ry: 0, rz: 0,
            px: 0, py: 0,
            size: Math.random() * 2 + 1,
            color: 'rgba(16, 185, 129, opacity)' // Emerald
          });
        }
        // Initialize rotation coords
        particles.forEach(p => {
          p.rx = p.x; p.ry = p.y; p.rz = p.z;
        });
      } 
      
      else if (bgType === 'skin') {
        // Fullscreen wave of skin nodes
        const cols = 22;
        const rows = 18;
        const spacingX = width / (cols - 1);
        const spacingY = height / (rows - 1);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = c * spacingX;
            const y = r * spacingY;
            particles.push({
              x: x - width / 2,
              y: y - height / 2,
              z: Math.sin((c + r) * 0.5) * 15,
              ox: x - width / 2,
              oy: y - height / 2,
              oz: Math.sin((c + r) * 0.5) * 15,
              rx: 0, ry: 0, rz: 0,
              px: 0, py: 0,
              phase: Math.random() * Math.PI * 2,
              size: Math.random() * 1.5 + 0.8,
              color: 'rgba(20, 184, 166, opacity)' // Teal
            });
          }
        }
        particles.forEach(p => {
          p.rx = p.x; p.ry = p.y; p.rz = p.z;
        });
      } 
      
      else if (bgType === 'dna') {
        // Vertical rotating DNA strands
        const nodes = 35;
        const helixRadius = Math.min(width, height) * 0.15;
        const helixHeight = height * 0.95;
        for (let i = 0; i < nodes; i++) {
          const t = (i / (nodes - 1)) * Math.PI * 4;
          const y = -helixHeight / 2 + (i / (nodes - 1)) * helixHeight;

          // Strand 1
          particles.push({
            x: helixRadius * Math.cos(t),
            y: y,
            z: helixRadius * Math.sin(t),
            strand: 1,
            pairIndex: i,
            rx: 0, ry: 0, rz: 0,
            size: 2,
            color: 'rgba(20, 184, 166, opacity)'
          });

          // Strand 2
          particles.push({
            x: helixRadius * Math.cos(t + Math.PI),
            y: y,
            z: helixRadius * Math.sin(t + Math.PI),
            strand: 2,
            pairIndex: i,
            rx: 0, ry: 0, rz: 0,
            size: 2,
            color: 'rgba(168, 85, 247, opacity)'
          });
        }
        particles.forEach(p => {
          p.rx = p.x; p.ry = p.y; p.rz = p.z;
        });
      } 
      
      else if (bgType === 'matrix') {
        // Cybernetic matrix cube floating in space
        const cols = 6;
        const rows = 6;
        const depths = 6;
        const spacing = Math.min(width, height) * 0.08;
        const start = - (5 * spacing) / 2;

        for (let xIdx = 0; xIdx < cols; xIdx++) {
          for (let yIdx = 0; yIdx < rows; yIdx++) {
            for (let zIdx = 0; zIdx < depths; zIdx++) {
              // Sparse grid (only create 40% of grid nodes for abstract look)
              if (Math.random() < 0.35) {
                particles.push({
                  x: start + xIdx * spacing,
                  y: start + yIdx * spacing,
                  z: start + zIdx * spacing,
                  rx: 0, ry: 0, rz: 0,
                  px: 0, py: 0,
                  size: 1.2,
                  color: 'rgba(239, 68, 68, opacity)' // Red
                });
              }
            }
          }
        }
        particles.forEach(p => {
          p.rx = p.x; p.ry = p.y; p.rz = p.z;
        });
      }
    };

    buildBackground();

    let angleX = 0.0006; 
    let angleY = 0.001;  

    if (bgType === 'skin') {
      angleX = 0.0002;
      angleY = 0.0003;
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      center.x = canvas.width / 2;
      center.y = canvas.height / 2;

      // 1. Projection and motion logic
      particles.forEach((p, idx) => {
        if (bgType === 'skin') {
          // Slowly undulate z heights dynamically
          p.z = p.oz + Math.sin(Date.now() * 0.0012 + p.phase) * 6;
        }

        // Rotate around Y
        let x1 = p.rx * cosY - p.rz * sinY;
        let z1 = p.rx * sinY + p.rz * cosY;

        // Rotate around X
        let y2 = p.ry * cosX - z1 * sinX;
        let z2 = p.ry * sinX + z1 * cosX;

        p.rx = x1;
        p.ry = y2;
        p.rz = z2;

        const perspective = 500;
        const scale = perspective / (perspective + z2);

        // Project onto center
        let screenX = center.x + x1 * scale;
        let screenY = center.y + y2 * scale;

        // Interactive mouse push
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - screenX;
          const dy = mouse.y - screenY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            // Push away
            screenX -= (dx / (dist || 1)) * force * 15;
            screenY -= (dy / (dist || 1)) * force * 15;
          }
        }

        p.px = screenX;
        p.py = screenY;
      });

      // 2. Render Connections
      if (bgType === 'molecule') {
        const threshold = Math.min(canvas.width, canvas.height) * 0.18;
        ctx.lineWidth = 0.45;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];
            const dx = p1.rx - p2.rx;
            const dy = p1.ry - p2.ry;
            const dz = p1.rz - p2.rz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < threshold) {
              const avgDepth = (p1.rz + p2.rz) / 2;
              const maxRange = Math.min(canvas.width, canvas.height) * 0.22;
              const normalized = (avgDepth + maxRange) / (2 * maxRange);
              const opacity = Math.max(0, (1 - normalized) * 0.09 * (1 - dist / threshold));
              
              ctx.strokeStyle = `rgba(16, 185, 129, ${opacity})`;
              ctx.beginPath();
              ctx.moveTo(p1.px, p1.py);
              ctx.lineTo(p2.px, p2.py);
              ctx.stroke();
            }
          }
        }
      } 
      
      else if (bgType === 'skin') {
        // Draw grid lines between adjacent particles in the wave
        ctx.lineWidth = 0.35;
        const cols = 22;
        const rows = 18;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const p1 = particles[idx];
            if (!p1) continue;

            // Horizontal link
            if (c < cols - 1) {
              const p2 = particles[idx + 1];
              if (p2) {
                const opacity = 0.035 * Math.max(0.2, (p1.px / canvas.width));
                ctx.strokeStyle = `rgba(20, 184, 166, ${opacity})`;
                ctx.beginPath();
                ctx.moveTo(p1.px, p1.py);
                ctx.lineTo(p2.px, p2.py);
                ctx.stroke();
              }
            }
            // Vertical link
            if (r < rows - 1) {
              const p3 = particles[idx + cols];
              if (p3) {
                const opacity = 0.035 * Math.max(0.2, (p1.py / canvas.height));
                ctx.strokeStyle = `rgba(20, 184, 166, ${opacity})`;
                ctx.beginPath();
                ctx.moveTo(p1.px, p1.py);
                ctx.lineTo(p3.px, p3.py);
                ctx.stroke();
              }
            }
          }
        }
      } 
      
      else if (bgType === 'dna') {
        const nodes = 35;
        ctx.lineWidth = 0.55;
        // Draw crossbars between the pair indices
        for (let i = 0; i < nodes; i++) {
          const p1 = particles[i * 2];
          const p2 = particles[i * 2 + 1];
          if (p1 && p2) {
            const opacity = 0.035 * (1 - (p1.rz / (Math.min(canvas.width, canvas.height) * 0.15)));
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.stroke();
          }
        }
      }

      else if (bgType === 'matrix') {
        // Draw connections for matrix cube if nodes are close in 3D
        const threshold = Math.min(canvas.width, canvas.height) * 0.10;
        ctx.lineWidth = 0.35;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];
            const dx = p1.rx - p2.rx;
            const dy = p1.ry - p2.ry;
            const dz = p1.rz - p2.rz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < threshold) {
              const opacity = 0.035 * (1 - dist / threshold);
              ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`;
              ctx.beginPath();
              ctx.moveTo(p1.px, p1.py);
              ctx.lineTo(p2.px, p2.py);
              ctx.stroke();
            }
          }
        }
      }

      // 3. Draw Nodes
      particles.forEach(p => {
        const sphereRadius = Math.min(canvas.width, canvas.height) * 0.22;
        const normalized = (p.rz + sphereRadius) / (2 * sphereRadius);
        const opacity = Math.max(0.015, bgType === 'molecule' 
          ? (1 - normalized) * 0.35 + 0.05 
          : bgType === 'skin'
            ? 0.09
            : bgType === 'dna'
              ? 0.08
              : 0.05);

        ctx.beginPath();
        ctx.arc(p.px, p.py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace('opacity', opacity.toString());
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [bgType]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 bg-transparent" />;
}