"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Mail, Lock, User, ShieldCheck, Award, ArrowRight, Stethoscope, Phone, Calendar, Heart, GraduationCap, MapPin, AlignLeft, Info, X, UserCheck, AlertTriangle } from 'lucide-react';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import ThreeDWidget from '../components/ui/ThreeDWidget';


export default function OnboardingPage() {
  const { user, loginUser, registerPatient, registerDermatologist, logoutUser, loading } = useAuth();
  const navigate = useNavigate();

  // Modal Auth Trigger State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Onboarding screens inside modal: 'login' | 'signup'
  const [viewMode, setViewMode] = useState('login'); 
  const [signUpRole, setSignUpRole] = useState('patient');

  // Clear authentication error when modal toggles or view mode changes
  useEffect(() => {
    setAuthError(null);
  }, [viewMode, showAuthModal]);
  
  // Doctor profile cache (for reading pending registration details)
  const [doctorProfile, setDoctorProfile] = useState(null);

  // Form input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  
  // Patient fields
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Prefer not to say');

  // Doctor fields
  const [licenseNum, setLicenseNum] = useState('');
  const [specialization, setSpecialization] = useState('Dermatologist');
  const [experience, setExperience] = useState('');
  const [college, setCollege] = useState('');
  const [hospital, setHospital] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState(['English']);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Doctor document assets
  const [licenseFile, setLicenseFile] = useState(null);
  const [idFile, setIdFile] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  const dermatQuotes = [
    "\"Healthy skin is a reflection of overall wellness.\" — Dr. Evelyn Shore",
    "\"The best foundation you can wear is healthy, glowing skin.\" — Dr. Marcus Vance",
    "\"Skincare must be simple, consistent, and scientifically sound.\" — Dr. Sarah Chen"
  ];

  // Rotate quotes
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % dermatQuotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  // Fetch pending doctor details
  useEffect(() => {
    const fetchDocProfile = async () => {
      if (user && user.role === 'dermat' && (user.status === 'pending' || user.status === 'rejected')) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setDoctorProfile(docSnap.data());
          }
        } catch (e) {
          console.error("Error fetching doc details", e);
        }
      } else {
        setDoctorProfile(null);
      }
    };
    fetchDocProfile();
  }, [user]);

  // Strict Dynamic Router Guardian: Inspects role and status on active token emission
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') {
        navigate('/admin/console');
      } else if (user.role === 'dermat' || user.role === 'dermatologist') {
        if (user.status === 'active' || user.status === 'approved') {
          navigate('/doctor/workspace');
        }
        // Pending or rejected doctors stay here to view holding/rejection pages
      } else {
        navigate('/dashboard'); // Patient Default Page
      }
    }
  }, [user, loading, navigate]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) return;

    if (viewMode === 'signup' && password !== confirmPassword) {
      setAuthError("Passwords do not match!");
      return;
    }

    setIsSubmitting(true);

    try {
      if (viewMode === 'login') {
        await loginUser(email, password);
      } else if (viewMode === 'signup') {
        if (signUpRole === 'patient') {
          const patientData = {
            name,
            phone,
            dob,
            gender,
            hasCompletedProfile: false 
          };
          await registerPatient(email, password, name || 'Patient', patientData);
          alert("Account created successfully! Welcome to DermaScan.");
        } else if (signUpRole === 'dermat') {
          if (!agreeTerms) {
            setAuthError("You must confirm all submitted details are accurate.");
            setIsSubmitting(false);
            return;
          }

          let licenseUrl = '';
          let idUrl = '';
          let photoUrl = '';

          const additionalData = {
            name,
            phone,
            licenseNum,
            specialization,
            experience: parseInt(experience) || 0,
            college,
            hospital,
            bio,
            languages,
            licenseUrl,
            idUrl,
            photoUrl,
            reapplyReason: ""
          };

          await registerDermatologist(email, password, name, additionalData);
          alert("Application submitted! Please await administrator validation approval.");
          setViewMode('login');
        }
      }
    } catch (error) {
      console.error("Authentication Error: ", error);
      const errorCode = error.code || "";
      const errorMsg = error.message || "";
      let errMsg = "Authentication failed. Please check details.";

      if (
        errorCode.includes("invalid-credential") || 
        errorCode.includes("wrong-password") || 
        errorCode.includes("user-not-found") ||
        errorMsg.includes("invalid-credential") || 
        errorMsg.includes("wrong-password") || 
        errorMsg.includes("user-not-found")
      ) {
        errMsg = "Invalid email or password combination.";
      } else if (errorCode.includes("weak-password") || errorMsg.includes("weak-password")) {
        errMsg = "Password must be at least 6 characters.";
      } else if (errorCode.includes("email-already-in-use") || errorMsg.includes("email-already-in-use")) {
        errMsg = "An account with this email already exists.";
      } else if (errorCode.includes("invalid-email") || errorMsg.includes("invalid-email")) {
        errMsg = "Please enter a valid email address.";
      } else {
        errMsg = error.message || errMsg;
      }
      setAuthError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLanguage = (lang) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter(l => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const triggerForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email address in the field first.");
      return;
    }
    alert(`Reset instructions successfully routed to ${email}`);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="p-3 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full shadow-lg"
        >
          <Activity size={24} className="text-slate-950" />
        </motion.div>
        <div className="text-emerald-400 font-black text-xs uppercase tracking-widest animate-pulse">
          Initializing System Environment...
        </div>
      </div>
    );
  }

  // --- HOLDING SCREENS FOR PENDING / REJECTED DOCTORS ---
  if (user && user.role === 'dermat') {
    if (user.status === 'pending') {
      return (
        <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
          <div className="absolute top-0 left-0 w-full h-full bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6 text-center"
          >
            <div className="flex justify-center">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl animate-pulse">
                <ShieldCheck size={36} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider">Application Under Review</h2>
              <p className="text-xs text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
                Your dermatologist credentials registration is under review. We will notify you within 24–48 hours once verified by administration nodes.
              </p>
            </div>

            {doctorProfile && (
              <div className="bg-slate-950/70 border border-slate-900 rounded-2xl p-5 text-left text-xs space-y-3.5">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-900 pb-2">Submitted Profile Parameters</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-0.5">Practitioner Name</span>
                    <span className="text-slate-300 font-bold">Dr. {doctorProfile.name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-0.5">License Number</span>
                    <span className="text-slate-300 font-mono font-bold">{doctorProfile.licenseNum}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-0.5">College / University</span>
                    <span className="text-slate-300 font-bold">{doctorProfile.college || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-0.5">Specialization</span>
                    <span className="text-teal-400 font-bold">{doctorProfile.specialization || "Dermatologist"}</span>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={async () => { await logoutUser(); navigate('/'); }}
              className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-red-400 border border-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              Sign Out / Clear Session
            </button>
          </motion.div>
        </div>
      );
    }

    if (user.status === 'rejected') {
      return (
        <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
          <div className="absolute top-0 left-0 w-full h-full bg-red-500/5 blur-[120px] pointer-events-none rounded-full" />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6 text-center"
          >
            <div className="flex justify-center">
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl">
                <ShieldCheck size={36} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider text-red-400">Credentials Refused</h2>
              <p className="text-xs text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
                Your dermatologist application details could not be validated by system administration.
              </p>
            </div>

            <div className="bg-red-950/10 border border-red-500/20 rounded-2xl p-4 text-left">
              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <Info size={11} /> Administrator Rejection Reason
              </span>
              <p className="text-xs text-slate-300 font-medium leading-relaxed italic">
                "{doctorProfile?.reapplyReason || "License key mismatch or documents verification failed. Please review your details and reapply."}"
              </p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={async () => { await logoutUser(); navigate('/'); }}
                className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-300 border border-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      );
    }
  }

  // --- PREMIUM 3D SINGLE-SCREEN LANDING PAGE LAYOUT ---
  return (
    <div className="relative h-screen w-full flex flex-col justify-between overflow-hidden bg-slate-950 px-6 md:px-16 py-6 font-sans">
      
      {/* Animated Photo Background Layer */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none animate-bg-pan opacity-80"
        style={{ 
          backgroundImage: "url('/glowing_skin_mesh.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Interactive Cursor Spotlight Glow */}
      <div 
        className="absolute pointer-events-none z-0 rounded-full blur-[90px] opacity-75"
        style={{
          left: mousePos.x,
          top: mousePos.y,
          width: '650px',
          height: '650px',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, rgba(20, 184, 166, 0.04) 50%, transparent 80%)',
        }}
      />

      {/* Glassmorphic Backdrop Overlay */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] z-0 pointer-events-none" />

      {/* Decorative Glow Blobs */}
      <div className="absolute top-[-15%] left-[-15%] w-[45%] aspect-square rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[45%] aspect-square rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="w-full flex items-center justify-between relative z-20">
        {/* Left: DermaScan AI branding with pulse */}
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="p-1.5 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 shadow-glow">
            <Activity size={18} />
          </div>
          <span className="font-black text-sm tracking-widest uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            DermaScan <span className="text-emerald-400 font-mono">AI</span>
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-0.5" />
        </div>

        {/* Right: Login/Signup CTA button */}
        <button
          onClick={() => { setViewMode('login'); setShowAuthModal(true); }}
          className="px-5 py-2.5 bg-slate-950/60 border border-slate-800 hover:border-emerald-500/20 text-slate-300 hover:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-inner z-20"
        >
          Login / Signup
        </button>
      </header>

      {/* HERO CONTENT: Left Column (Text & Roles info), Right Column (Empty for 3D sphere backdrop view) */}
      <main className="flex-1 flex items-center w-full relative z-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
          
          {/* Left Hero block */}
          <div className="space-y-6 max-w-xl text-left">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
                Computer Vision Dermatology
              </span>
              <h2 className="text-3xl md:text-4xl font-black uppercase text-slate-100 tracking-wide leading-tight">
                Your Skin. <br />Understood.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                DermaScan maps custom active ingredient formulas based on deep learning skin type scans and routes cases instantly to dermatologist assessment consoles.
              </p>
            </div>

            {/* Feature Cards split by roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Card 1: Patients */}
              <div className="p-5 rounded-2xl bg-slate-900/15 border border-slate-900/60 hover:border-emerald-500/20 hover:bg-slate-900/30 transition-all flex flex-col justify-between space-y-3 shadow-lg group">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase text-slate-300 tracking-widest flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                    <User size={12} className="text-emerald-400" /> Patient Portal
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">
                    Upload biometric scans to evaluate sebum conditions, track 30-day timelines, and request clinical reviews.
                  </p>
                </div>
                <button 
                  onClick={() => { setSignUpRole('patient'); setViewMode('signup'); setShowAuthModal(true); }}
                  className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1 hover:text-emerald-300 transition-all cursor-pointer bg-transparent border-none p-0 w-max"
                >
                  Start Scan <ArrowRight size={10} />
                </button>
              </div>

              {/* Card 2: Doctors */}
              <div className="p-5 rounded-2xl bg-slate-900/15 border border-slate-900/60 hover:border-teal-500/20 hover:bg-slate-900/30 transition-all flex flex-col justify-between space-y-3 shadow-lg group">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase text-slate-300 tracking-widest flex items-center gap-1.5 group-hover:text-teal-400 transition-colors">
                    <Stethoscope size={12} className="text-teal-400" /> Doctor Portal
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">
                    Audit diagnostic queue cases, review chronological patient logs, and compound prescriptions.
                  </p>
                </div>
                <button 
                  onClick={() => { setSignUpRole('dermat'); setViewMode('signup'); setShowAuthModal(true); }}
                  className="text-[9px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1 hover:text-teal-300 transition-all cursor-pointer bg-transparent border-none p-0 w-max"
                >
                  Apply Here <ArrowRight size={10} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 3D molecular sphere widget */}
          <div className="hidden lg:block h-96 w-full max-w-md ml-auto">
            <ThreeDWidget type="molecule" className="w-full h-full" />
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full flex items-center justify-between border-t border-slate-900/40 pt-4 relative z-20 text-[9px] font-mono text-slate-600 font-bold uppercase tracking-widest">
        <span>© 2026 DermaScan AI</span>
        <span>Authorized Medical Audits strictly logged</span>
      </footer>

      {/* --- CENTERING LOGIN/SIGNUP MODAL OVERLAY --- */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            {/* Click outside to close modal */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowAuthModal(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative z-10 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-300 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer"
              >
                <X size={14} />
              </button>

              {/* Brand Header */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 rounded-2xl text-emerald-400">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-widest uppercase text-slate-100">
                    DermaScan Account
                  </h3>
                </div>
              </div>

              {/* Dynamic Inputs Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {authError && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-medium leading-normal flex items-start gap-2 shadow-inner">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${viewMode}-${signUpRole}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Sign Up Mode Role Selector */}
                    {viewMode === 'signup' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                          Select Registration Type
                        </label>
                        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950 border border-slate-900 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setSignUpRole('patient')}
                            className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                              signUpRole === 'patient'
                                ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-emerald-500/20 text-emerald-400 shadow-inner'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <User size={12} />
                            Patient
                          </button>
                          <button
                            type="button"
                            onClick={() => setSignUpRole('dermat')}
                            className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                              signUpRole === 'dermat'
                                ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-emerald-500/20 text-emerald-400 shadow-inner'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <Stethoscope size={12} />
                            Doctor
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Full Name input for registration */}
                    {viewMode === 'signup' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                          Full Name
                        </label>
                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                            placeholder={signUpRole === 'dermat' ? "Dr. Evelyn Shore" : "Krish Jha"}
                            required 
                          />
                        </div>
                      </div>
                    )}

                    {/* Email Address Input */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                          placeholder="john@example.com"
                          required 
                        />
                      </div>
                    </div>

                    {/* Patient Sign Up - Phone Number */}
                    {viewMode === 'signup' && signUpRole === 'patient' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="tel" 
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                              placeholder="+91 99999 99999"
                              required 
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Date of Birth
                          </label>
                          <div className="relative">
                            <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="date" 
                              value={dob}
                              onChange={(e) => setDob(e.target.value)}
                              className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                              required 
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Patient Sign Up - Gender dropdown inside form */}
                    {viewMode === 'signup' && signUpRole === 'patient' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                          Gender Identity
                        </label>
                        <div className="relative">
                          <Heart size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium appearance-none cursor-pointer"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">▼</div>
                        </div>
                      </div>
                    )}

                    {/* Doctor Registration Form Fields - Section 1 */}
                    {viewMode === 'signup' && signUpRole === 'dermat' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                              Phone Number
                            </label>
                            <div className="relative">
                              <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input 
                                type="tel" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                                placeholder="+91 99999 99999"
                                required 
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                              License ID
                            </label>
                            <div className="relative">
                              <ShieldCheck size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input 
                                type="text" 
                                value={licenseNum}
                                onChange={(e) => setLicenseNum(e.target.value)}
                                className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono font-bold uppercase" 
                                placeholder="MCI-12345"
                                required 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                              Specialization
                            </label>
                            <div className="relative">
                              <Stethoscope size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <select
                                value={specialization}
                                onChange={(e) => setSpecialization(e.target.value)}
                                className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium appearance-none cursor-pointer"
                              >
                                <option value="Dermatologist">Dermatologist</option>
                                <option value="Cosmetologist">Cosmetologist</option>
                                <option value="Trichologist">Trichologist</option>
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">▼</div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                              Experience
                            </label>
                            <div className="relative">
                              <Award size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input 
                                type="number" 
                                value={experience}
                                onChange={(e) => setExperience(e.target.value)}
                                className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                                placeholder="5"
                                min="0"
                                required 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Medical College / University
                          </label>
                          <div className="relative">
                            <GraduationCap size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="text" 
                              value={college}
                              onChange={(e) => setCollege(e.target.value)}
                              className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                              placeholder="All India Institute of Medical Sciences"
                              required 
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Clinic Name & Address
                          </label>
                          <div className="relative">
                            <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="text" 
                              value={hospital}
                              onChange={(e) => setHospital(e.target.value)}
                              className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                              placeholder="Skin Care Clinic, Bandra West, Mumbai"
                              required 
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Languages Spoken
                          </label>
                          <div className="flex gap-2 flex-wrap p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[9px]">
                            {['English', 'Hindi', 'Marathi', 'Bengali', 'Tamil'].map(lang => (
                              <button
                                key={lang}
                                type="button"
                                onClick={() => toggleLanguage(lang)}
                                className={`px-2.5 py-1 rounded-lg font-black uppercase border transition-all cursor-pointer ${
                                  languages.includes(lang)
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {lang}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Short Bio (Max 200 Characters)
                          </label>
                          <div className="relative">
                            <AlignLeft size={14} className="absolute left-3.5 top-3 text-slate-500" />
                            <textarea 
                              value={bio}
                              onChange={(e) => setBio(e.target.value.slice(0, 200))}
                              rows={2}
                              className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium resize-none placeholder:text-slate-700" 
                              placeholder="Experienced dermatologist specializing in cosmetic clinical assessments..."
                              required 
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Password and Confirm Password inputs */}
                    {viewMode === 'login' ? (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                          Password
                        </label>
                        <div className="relative">
                          <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                            placeholder="••••••••"
                            required 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Password
                          </label>
                          <div className="relative">
                            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                              placeholder="••••••••"
                              required 
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="password" 
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-medium" 
                              placeholder="••••••••"
                              required={viewMode === 'signup'} 
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Agreement checkbox (Doctor signup only) */}
                    {viewMode === 'signup' && signUpRole === 'dermat' && (
                      <div className="flex items-start gap-2.5 p-2 bg-slate-950/40 border border-slate-900 rounded-xl">
                        <input 
                          type="checkbox" 
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                          className="mt-0.5 cursor-pointer"
                          id="agree-check-modal"
                        />
                        <label htmlFor="agree-check-modal" className="text-[10px] text-slate-400 font-medium leading-normal cursor-pointer select-none">
                          I confirm that all submitted medical registration credentials are accurate.
                        </label>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>

                {/* Submit Action Button */}
                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {isSubmitting ? (
                    viewMode === 'login' ? "Logging In..." : "Signing Up..."
                  ) : (
                    <>
                      {viewMode === 'login' ? "Log In" : "Sign Up"}
                      <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Toggle Mode Navigation (Below login/register buttons inside modal) */}
              <div className="text-center pt-2 space-y-3.5 border-t border-slate-900/60 mt-4">
                {viewMode === 'login' ? (
                  <div className="flex items-center justify-between text-xs font-medium px-1">
                    <button 
                      type="button"
                      onClick={triggerForgotPassword}
                      className="text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-none p-0 cursor-pointer font-bold"
                    >
                      Forgot Password?
                    </button>
                    <span className="text-slate-700">|</span>
                    <button 
                      type="button"
                      onClick={() => setViewMode('signup')} 
                      className="text-emerald-400 font-black hover:text-emerald-300 transition-colors bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 font-mono uppercase tracking-wider text-[10px]"
                    >
                      Create Account
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 font-medium">
                    Already have an account?{' '}
                    <button 
                      type="button"
                      onClick={() => setViewMode('login')} 
                      className="text-emerald-400 font-black hover:text-emerald-300 transition-colors bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 font-mono uppercase tracking-wider text-[10px]"
                    >
                      Return to Log In
                    </button>
                  </div>
                )}
                
                {/* Derm Quotes Panel (Rotating) */}
                <div className="text-[10px] font-medium text-teal-400/80 italic font-sans py-2 animate-pulse min-h-[30px] flex items-center justify-center">
                  {dermatQuotes[quoteIndex]}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}