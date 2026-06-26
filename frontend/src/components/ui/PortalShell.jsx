"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, LogOut, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PortalShell({ children }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  // Select creative background graphics based on page role
  let bgImage = '/glowing_skin_mesh.png';
  if (user && user.role === 'patient') {
    bgImage = '/patient_mesh_bg.png';
  } else if (user && (user.role === 'dermat' || user.role === 'dermatologist')) {
    bgImage = '/doctor_mesh_bg.png';
  } else if (user && user.role === 'admin') {
    bgImage = '/admin_mesh_bg.png';
  }
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!user) return <>{children}</>;

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  // Compile active workspace routes natively
  const links = [
    { 
      name: 'Workspace Desk', 
      path: user.role === 'patient' ? '/dashboard' : user.role === 'dermat' ? '/doctor/workspace' : '/admin/console', 
      icon: LayoutDashboard 
    }
  ];

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'admin':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'dermat':
      case 'dermatologist':
        return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 w-full overflow-x-hidden relative">
      
      {/* Animated Photo Background Layer (Landing page matching style) */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none animate-bg-pan opacity-80"
        style={{ 
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Glassmorphic Backdrop Overlay */}
      <div className={`absolute inset-0 z-0 pointer-events-none backdrop-blur-[2.5px] transition-colors duration-300 ${
        user && user.role === 'admin' ? 'bg-slate-950/92' : 'bg-slate-950/75'
      }`} />

      {/* Immersive Left Sidebar Navigation Panel Layout */}
      <aside className="w-64 border-r border-slate-900/60 bg-slate-950/80 backdrop-blur-2xl p-6 flex flex-col justify-between fixed h-full z-30">
        
        {/* Glow overlay */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 blur-[35px] pointer-events-none rounded-full" />

        <div className="space-y-8 relative z-10">
          
          {/* Brand Logo Wrapper */}
          <div 
            onClick={() => navigate(links[0].path)}
            className="flex items-center gap-2.5 px-2 cursor-pointer group"
          >
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="p-1.5 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 rounded-xl text-emerald-400"
            >
              <Activity size={16} />
            </motion.div>
            <span className="font-black text-xs tracking-widest uppercase bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent group-hover:from-emerald-400 transition-colors">
              DermaScan
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-0.5" />
          </div>

          {/* Connected User Identity Badge */}
          <div className="p-4 bg-slate-900/25 border border-slate-900/80 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 font-black text-xs uppercase shrink-0">
              {user.username?.slice(0, 2)}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-black text-slate-200 truncate leading-none mb-1">{user.username}</h4>
              <span className={`inline-block text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${getRoleBadgeStyle(user.role)}`}>
                {user.role === 'dermat' ? 'Doctor' : user.role}
              </span>
            </div>
          </div>

          {/* Iterating Navigation Links Matrix */}
          <nav className="space-y-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <button 
                  key={link.path} 
                  onClick={() => navigate(link.path)} 
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-400 shadow-inner' 
                      : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/20'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                  {link.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Terminate Session Button */}
        <button 
          onClick={handleLogout} 
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all border border-transparent hover:border-red-500/10 cursor-pointer"
        >
          <LogOut size={14} />
          Close Station
        </button>
      </aside>

      {/* Primary Workspace Viewport Window Shifted Past Sidebar */}
      <div className="flex-1 pl-64 flex flex-col relative z-10 w-full min-h-screen overflow-hidden bg-transparent">
        
        {/* Subtle Interactive Grid Mesh Backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 z-0 pointer-events-none" />

        {/* Slowly pulsing drift glow orbs */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-teal-500/5 blur-[90px] rounded-full pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] left-[10%] w-96 h-96 bg-emerald-500/5 blur-[90px] rounded-full pointer-events-none z-0" />

        {/* Interactive Cursor Spotlight Glow for Dashboards */}
        <div 
          className="absolute pointer-events-none z-0 rounded-full blur-[90px] opacity-75"
          style={{
            left: mousePos.x - 256, // Adjust for the 256px wide sidebar
            top: mousePos.y,
            width: '650px',
            height: '650px',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, rgba(20, 184, 166, 0.04) 50%, transparent 80%)',
          }}
        />

        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}