"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import BiometricScanner from '../../components/ui/patient/biometric_scanner.jsx';
import PortalShell from '../../components/ui/PortalShell';
import { motion, AnimatePresence } from 'framer-motion';
import ThreeDWidget from '../../components/ui/ThreeDWidget';

import { Activity, Home, Camera, BarChart2, MessageSquare, User, Sparkles, AlertTriangle, Check, CheckCircle2, ChevronRight, X, Heart, Plus } from 'lucide-react';

export default function PatientDashboard() {
  const { user } = useAuth();
  
  // Navigation tabs: 'home' | 'scan' | 'tracker' | 'consult' | 'profile'
  const [activeTab, setActiveTab] = useState('home');

  // Database States
  const [historyLogs, setHistoryLogs] = useState([]);
  const [doctorReviews, setDoctorReviews] = useState([]);
  const [profileData, setProfileData] = useState(null);
  
  // Onboarding Step 2 Overlay state
  const [showProfileNudge, setShowProfileNudge] = useState(false);

  // Profile Form states
  const [allergies, setAllergies] = useState([]);
  const [newAllergy, setNewAllergy] = useState('');
  const [skinConditions, setSkinConditions] = useState([]);
  const [medications, setMedications] = useState('');
  const [skinTypeSelf, setSkinTypeSelf] = useState('Not sure');
  const [skinConcern, setSkinConcern] = useState('Acne');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Active scan parameters
  const [latestScan, setLatestScan] = useState(null);
  const [activeScan, setActiveScan] = useState(null);
  
  // Tracker compare states
  const [compareFirst, setCompareFirst] = useState(null);
  const [compareLast, setCompareLast] = useState(null);
  const [showCompare, setShowCompare] = useState(false);

  // Fetch scans history and profile data
  useEffect(() => {
    if (!user) return;

    // 1. Live query for patient's scan history
    const scansQuery = query(
      collection(db, "scans"),
      where("patient_id", "==", user.uid)
    );

    const unsubscribeScans = onSnapshot(scansQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid composite index requirement
      logs.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return bTime - aTime;
      });
      setHistoryLogs(logs);
      if (logs.length > 0) {
        setLatestScan(logs[0]);
        if (!activeScan) setActiveScan(logs[0]);
        
        // Setup initial compare items
        setCompareLast(logs[0]);
        setCompareFirst(logs[logs.length - 1]);
      }
    }, (error) => {
      console.warn("Scans subscription error: ", error);
    });

    // 2. Fetch doctor reviews
    const reviewsQuery = query(
      collection(db, "doctor_reviews"),
      where("patient_id", "==", user.uid)
    );

    const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
      const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid composite index requirement
      reviews.sort((a, b) => {
        const aTime = a.reviewedAt?.toDate ? a.reviewedAt.toDate().getTime() : (a.reviewedAt?.seconds ? a.reviewedAt.seconds * 1000 : 0);
        const bTime = b.reviewedAt?.toDate ? b.reviewedAt.toDate().getTime() : (b.reviewedAt?.seconds ? b.reviewedAt.seconds * 1000 : 0);
        return bTime - aTime;
      });
      setDoctorReviews(reviews);
    }, (error) => {
      console.warn("Reviews subscription error: ", error);
    });

    // 3. Fetch patient profile metadata
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileData(data);
        
        // Pre-fill profile forms
        setAllergies(data.allergies || []);
        setSkinConditions(data.skinConditions || []);
        setMedications(data.medications || '');
        setSkinTypeSelf(data.skinTypeSelf || 'Not sure');
        setSkinConcern(data.skinConcern || 'Acne');

        // Nudge user if they haven't completed onboarding Step 2 Profile
        if (data.hasCompletedProfile === false) {
          setShowProfileNudge(true);
        }
      }
    }, (error) => {
      console.warn("User subscription error: ", error);
    });

    return () => {
      unsubscribeScans();
      unsubscribeReviews();
      unsubscribeUser();
    };
  }, [user]);

  // Round-robin Patient to Doctor assignment logic
  const handleRequestConsultation = async (scanId) => {
    if (!scanId) return;
    try {
      // 1. Fetch active doctors
      const doctorsQuery = query(
        collection(db, "users"),
        where("role", "==", "dermat")
      );
      const doctorsSnap = await getDocs(doctorsQuery);
      const doctors = doctorsSnap.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(doc => doc.status === 'active' || doc.status === 'approved');

      if (doctors.length === 0) {
        alert("No verified dermatologists are currently online. Hold case in global queue.");
        // Submit to global queue anyway
        const scanDocRef = doc(db, "scans", scanId);
        await updateDoc(scanDocRef, { 
          consultation_requested: true,
          assigned_doctor_id: null,
          assigned_doctor_name: "Global Queue"
        });
        return;
      }

      // 2. Fetch all scans currently in consultation to count loads
      const activeScansQuery = query(
        collection(db, "scans"),
        where("consultation_requested", "==", true)
      );
      const scansSnap = await getDocs(activeScansQuery);
      const activeScans = scansSnap.docs.map(doc => doc.data());

      // Count case load per doctor
      const doctorLoad = {};
      doctors.forEach(d => {
        doctorLoad[d.uid] = 0;
      });
      activeScans.forEach(s => {
        if (s.assigned_doctor_id && doctorLoad[s.assigned_doctor_id] !== undefined) {
          doctorLoad[s.assigned_doctor_id]++;
        }
      });

      // 3. Round robin: pick doctor with fewest active open cases
      let assignedDoctor = doctors[0];
      let minLoad = doctorLoad[assignedDoctor.uid] || 0;

      doctors.forEach(doc => {
        const load = doctorLoad[doc.uid] || 0;
        if (load < minLoad) {
          minLoad = load;
          assignedDoctor = doc;
        }
      });

      // 4. Update scan doc
      const scanDocRef = doc(db, "scans", scanId);
      await updateDoc(scanDocRef, {
        consultation_requested: true,
        assigned_doctor_id: assignedDoctor.uid,
        assigned_doctor_name: assignedDoctor.name
      });

      alert(`Consultation assigned to Dr. ${assignedDoctor.name}. They will review your skin report shortly!`);
    } catch (e) {
      console.error(e);
      alert("Consultation request failed.");
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        allergies,
        skinConditions,
        medications,
        skinTypeSelf,
        skinConcern,
        hasCompletedProfile: true
      });
      setShowProfileNudge(false);
      alert("Skin profile successfully locked!");
    } catch (e) {
      console.error(e);
      alert("Failed to save profile details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const calculateStreak = () => {
    if (historyLogs.length === 0) return 0;
    // Simple calculation: count items in past 7 days, or return a simulated streak metrics
    return Math.min(historyLogs.length, 7); 
  };

  const getSkinScore = (condition) => {
    if (!condition) return 92;
    switch (condition.toLowerCase()) {
      case 'normal baseline': return 98;
      case 'acne': return 74;
      case 'blackheads': return 82;
      case 'whiteheads': return 80;
      case 'open pores': return 85;
      case 'dark spots': return 78;
      case 'wrinkles': return 76;
      default: return 90;
    }
  };

  // Cross-reference resolved ingredients to avoid based on allergies list
  const getAvoidIngredients = (ingredients = "", allergyList = []) => {
    const avoid = [];
    const lowerIng = ingredients.toLowerCase();
    allergyList.forEach(allergy => {
      const lowerAllergy = allergy.toLowerCase();
      if (lowerIng.includes(lowerAllergy)) {
        avoid.push(allergy);
      }
    });
    return avoid;
  };

  if (!user) return null;

  return (
    <PortalShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 w-full flex-1 flex flex-col justify-start relative z-10">
        
        {/* Onboarding Step 2 Nudge Overlay */}
        <AnimatePresence>
          {showProfileNudge && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-100 uppercase tracking-wider">Step 2: Build Your Skin Profile</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Let's custom map your sensitivities, allergies, and daily concerns so the AI and dermatologists can prescribe accurate blueprints.
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 pt-2 text-xs">
                  {/* Allergies chip builder */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Known Skin Allergies / Sensitivities</label>
                    <div className="flex gap-2 flex-wrap mb-2">
                      {allergies.map(all => (
                        <span key={all} className="px-2.5 py-1 bg-slate-950 rounded-lg text-emerald-400 font-bold border border-slate-900 flex items-center gap-1.5 text-[9px] uppercase tracking-wider">
                          {all}
                          <button type="button" onClick={() => setAllergies(allergies.filter(a => a !== all))} className="text-slate-500 hover:text-red-400">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newAllergy}
                        onChange={(e) => setNewAllergy(e.target.value)}
                        placeholder="e.g. Salicylic, Fragrance, Benzoyl" 
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 focus:outline-none focus:border-emerald-500 text-xs" 
                      />
                      <button 
                        type="button" 
                        onClick={() => { if (newAllergy) { setAllergies([...allergies, newAllergy]); setNewAllergy(''); } }}
                        className="p-2 bg-slate-950 border border-slate-800 text-emerald-400 rounded-xl hover:bg-slate-900 cursor-pointer"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Conditions checkboxes */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Existing Diagnosed Conditions</label>
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-900">
                      {['Acne', 'Eczema', 'Psoriasis', 'Rosacea', 'Hyperpigmentation', 'None'].map(cond => (
                        <label key={cond} className="flex items-center gap-2 text-slate-400 font-medium select-none cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={skinConditions.includes(cond)}
                            onChange={(e) => {
                              if (cond === 'None') { setSkinConditions(['None']); return; }
                              const filtered = skinConditions.filter(c => c !== 'None');
                              if (e.target.checked) setSkinConditions([...filtered, cond]);
                              else setSkinConditions(filtered.filter(c => c !== cond));
                            }}
                          />
                          {cond}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">How is your skin currently?</label>
                      <select 
                        value={skinTypeSelf} 
                        onChange={(e) => setSkinTypeSelf(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 text-xs"
                      >
                        <option value="Dry">Dry</option>
                        <option value="Oily">Oily</option>
                        <option value="Combination">Combination</option>
                        <option value="Normal">Normal</option>
                        <option value="Not sure">Not sure</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Primary Skin Concern</label>
                      <select 
                        value={skinConcern} 
                        onChange={(e) => setSkinConcern(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 text-xs"
                      >
                        <option value="Acne">Acne</option>
                        <option value="Dark spots">Dark spots</option>
                        <option value="Texture">Texture</option>
                        <option value="Dullness">Dullness</option>
                        <option value="Sensitivity">Sensitivity</option>
                        <option value="Anti-aging">Anti-aging</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Current Medications (Optional)</label>
                    <input 
                      type="text" 
                      value={medications}
                      onChange={(e) => setMedications(e.target.value)}
                      placeholder="e.g. Minocycline 100mg" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 focus:outline-none focus:border-emerald-500 text-xs" 
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowProfileNudge(false)}
                    className="flex-1 py-3 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  >
                    Skip For Now
                  </button>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {isSavingProfile ? "Saving Details..." : "Save Skin Profile"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Dashboard Sub Navigation Tabs */}
        <div className="flex gap-1.5 bg-slate-900/35 border border-slate-900/60 p-1 rounded-2xl w-max z-20 relative">
          {[
            { id: 'home', label: 'Home', icon: Home },
            { id: 'scan', label: 'Scan Node', icon: Camera },
            { id: 'tracker', label: 'Progress Tracker', icon: BarChart2 },
            { id: 'consult', label: 'Consult Clinical', icon: MessageSquare },
            { id: 'profile', label: 'Skin Profile', icon: User }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* --- DYNAMIC SUB-VIEW WORKSPACE --- */}
        <div className="w-full relative z-10 flex-1">
          <AnimatePresence mode="wait">
            
            {/* VIEW 1: HOME PANEL */}
            {activeTab === 'home' && (
              <motion.div 
                key="home-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 w-full"
              >
                {/* Streak and Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  
                  {/* Summary Card */}
                  <div className="md:col-span-2 p-6 bg-slate-900/20 border border-slate-900 rounded-3xl relative overflow-hidden flex flex-col justify-between min-h-48 shadow-xl">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[60px] rounded-full pointer-events-none" />
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Diagnostic Summary</h4>
                      <h3 className="text-xl font-black text-slate-100 uppercase tracking-wide">
                        Good morning, {user.username}!
                      </h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Streak tracker: <span className="text-emerald-400 font-bold">{calculateStreak()} days 💧</span>. 
                        Skin index indicates <span className="text-emerald-400 font-bold">{latestScan ? latestScan.skin_type : "No Scans"}</span>.
                      </p>
                    </div>

                    <div className="flex gap-4 items-center pt-4">
                      <button 
                        onClick={() => setActiveTab('scan')}
                        className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5"
                      >
                        <Camera size={12} /> Scan Now
                      </button>
                      {latestScan && (
                        <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">
                          Last scan: {latestScan.createdAt?.toDate ? new Date(latestScan.createdAt.toDate()).toLocaleDateString() : 'Recent'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Skin Score Widget */}
                  <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl flex flex-col justify-between items-center text-center shadow-xl relative min-h-48">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 blur-[45px] rounded-full pointer-events-none" />
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Skin Health Score</h4>
                    
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      {/* Circular Gauge Border */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="56" cy="56" r="48" stroke="rgba(16, 185, 129, 0.05)" strokeWidth="4" fill="transparent" />
                        <circle cx="56" cy="56" r="48" stroke="url(#emerald-gradient)" strokeWidth="4" fill="transparent" strokeDasharray="301.6" strokeDashoffset={301.6 - (301.6 * getSkinScore(latestScan?.skin_condition)) / 100} />
                        <defs>
                          <linearGradient id="emerald-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#14b8a6" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute font-black text-2xl text-slate-200">{getSkinScore(latestScan?.skin_condition)}</div>
                    </div>

                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Metrics: {latestScan ? latestScan.skin_condition : "Awaiting scan"}</span>
                  </div>

                  {/* Interactive 3D Scan Surface Grid Card */}
                  <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl flex flex-col justify-between shadow-xl relative min-h-48">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[45px] rounded-full pointer-events-none" />
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bio-Scan Surface Grid</h4>
                    <div className="flex-1 w-full h-24 min-h-[90px] relative">
                      <ThreeDWidget type="face" className="w-full h-full" />
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider text-center">Interactive Grid</span>
                  </div>

                </div>

                {/* Consultation Sale Banner */}
                <div className="p-5 bg-gradient-to-r from-teal-500/5 to-emerald-500/5 border border-teal-500/10 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase text-teal-400 tracking-widest flex items-center gap-1.5">
                      <Sparkles size={12} className="animate-pulse" /> Limited Offer Referral
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Get a full clinical review and compounding prescription formula from a verified dermatologist for **FREE**. Offer valid for new accounts.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('scan')}
                    className="py-2.5 px-5 bg-slate-950 border border-slate-800 text-emerald-400 hover:text-emerald-300 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  >
                    Deploy Scan View
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 2: AI SCAN VIEWPORT */}
            {activeTab === 'scan' && (
              <motion.div 
                key="scan-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Render the scan viewport card layout */}
                <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-3xl shadow-xl space-y-4">
                  <div className="flex flex-col border-b border-slate-900 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Biometric Scan Viewfinder</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Capture skin parameters to process computational recommendations.</p>
                  </div>
                  
                  {/* Embed custom scanner with checklist and reticles */}
                  <BiometricScanner userId={user.uid} onRequestConsultation={handleRequestConsultation} />
                </div>
              </motion.div>
            )}

            {/* VIEW 3: TRACKER TIMELINE */}
            {activeTab === 'tracker' && (
              <motion.div 
                key="tracker-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Horizontal Scroll timeline */}
                <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-3xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-3.5">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Photo Timeline Logs</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Scroll horizontally to audit visual structural history.</p>
                    </div>

                    <button
                      onClick={() => setShowCompare(!showCompare)}
                      className="px-3.5 py-2 bg-slate-950 border border-slate-800 text-teal-400 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer"
                    >
                      {showCompare ? "Close Compare" : "Compare Scans"}
                    </button>
                  </div>

                  {/* Before vs Now comparison view */}
                  {showCompare && compareFirst && compareLast && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950 border border-slate-900 rounded-2xl">
                      <div className="space-y-2">
                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Before ({compareFirst.createdAt?.toDate ? new Date(compareFirst.createdAt.toDate()).toLocaleDateString() : 'Baseline'})</span>
                        <div className="aspect-square rounded-xl overflow-hidden border border-slate-900 bg-black flex items-center justify-center">
                          {compareFirst.image_url ? (
                            <img src={compareFirst.image_url} alt="Compare First" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-slate-700 font-bold uppercase tracking-wider font-mono">No imagery</span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">
                          {compareFirst.skin_type} · {compareFirst.skin_condition}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Latest ({compareLast.createdAt?.toDate ? new Date(compareLast.createdAt.toDate()).toLocaleDateString() : 'Recent'})</span>
                        <div className="aspect-square rounded-xl overflow-hidden border border-slate-900 bg-black flex items-center justify-center">
                          {compareLast.image_url ? (
                            <img src={compareLast.image_url} alt="Compare Last" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-slate-700 font-bold uppercase tracking-wider font-mono">No imagery</span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-400">
                          {compareLast.skin_type} · {compareLast.skin_condition}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scroll Grid */}
                  <div className="flex gap-4 overflow-x-auto pb-2 pr-1 custom-scrollbar">
                    {historyLogs.length === 0 ? (
                      <div className="py-12 w-full text-center text-slate-600 text-[10px] font-black uppercase tracking-wider">
                        No scan images captured yet
                      </div>
                    ) : (
                      historyLogs.map(log => (
                        <div key={log.id} className="min-w-[120px] max-w-[120px] space-y-2 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-900">
                          <div className="w-full aspect-square rounded-xl overflow-hidden bg-black border border-slate-900">
                            {log.image_url ? (
                              <img src={log.image_url} alt="Scan Thumb" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-700 font-bold uppercase tracking-widest font-mono">Mock Frame</div>
                            )}
                          </div>
                          <div className="text-[8px] font-black uppercase text-slate-500 font-mono text-center">
                            {log.createdAt?.toDate ? new Date(log.createdAt.toDate()).toLocaleDateString() : 'Recent'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 10-day challenge heatmap */}
                <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl shadow-xl space-y-4">
                  <div className="flex flex-col">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">10-Day Skin Health Challenge</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Commit to a daily scan workflow for 10 days to maximize tracking logs.</p>
                  </div>
                  
                  {/* Heatmap timeline */}
                  <div className="flex gap-2.5 justify-center py-4 bg-slate-950/40 rounded-2xl border border-slate-900">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const hasScanned = idx < historyLogs.length;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5">
                          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                            hasScanned 
                              ? 'bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-400' 
                              : 'bg-transparent border-slate-900 text-slate-700'
                          }`}>
                            {hasScanned ? <Check size={12} /> : idx + 1}
                          </div>
                          <span className="text-[8px] font-mono font-bold text-slate-600 uppercase">Day {idx + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW 4: CONSULTATIONS & PRESCRIPTIONS */}
            {activeTab === 'consult' && (
              <motion.div 
                key="consult-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-3xl shadow-xl space-y-4">
                  <div className="flex flex-col border-b border-slate-900 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Clinical Referrals Records</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Review custom prescriptions and diagnostics certified by verified practitioners.</p>
                  </div>

                  {doctorReviews.length === 0 ? (
                    <div className="py-16 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-900/60 bg-slate-950/20 rounded-2xl">
                      No active medical consultation records found in database
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {doctorReviews.map(review => (
                        <div key={review.id} className="p-5 bg-slate-950 border border-slate-900 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-900/80 pb-2.5">
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-200">Dr. {review.dermatologist_name || "Practitioner Override"}</h4>
                              <span className="inline-block text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-400 mt-1">Certified Dermatologist</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">
                              {review.reviewedAt?.toDate ? new Date(review.reviewedAt.toDate()).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>

                          <div className="space-y-3.5 text-xs">
                            <div>
                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Clinical Evaluation Notes</span>
                              <p className="text-slate-300 leading-relaxed font-medium bg-slate-900/15 border border-slate-900 p-3 rounded-xl">
                                "{review.clinical_notes}"
                              </p>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest block mb-0.5">Prescribed Compounding Formula</span>
                              <div className="text-xs font-mono font-extrabold text-teal-400 bg-teal-950/5 border border-teal-500/10 p-3 rounded-xl border">
                                {review.prescription}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* VIEW 5: SKIN PROFILE EDIT */}
            {activeTab === 'profile' && (
              <motion.div 
                key="profile-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Advanced Profile Editor */}
                <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-3xl shadow-xl space-y-6">
                  <div className="flex flex-col border-b border-slate-900 pb-3.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Personal & Skin Settings</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Review credentials and update sensitivity settings.</p>
                  </div>

                  {/* Read only info */}
                  {profileData && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-950 border border-slate-900 p-4 rounded-2xl text-[11px] font-mono">
                      <div>
                        <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Patient Name</span>
                        <span className="text-slate-300 font-extrabold font-sans text-xs">{profileData.username || profileData.name}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Email Link</span>
                        <span className="text-slate-400 font-sans text-xs truncate block">{profileData.email}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Contact Node</span>
                        <span className="text-slate-300 font-sans text-xs">{profileData.phone || "Not Set"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Registration Date</span>
                        <span className="text-slate-500 text-xs">
                          {profileData.createdAt?.toDate ? new Date(profileData.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Edit Section */}
                  <div className="space-y-4 pt-2 text-xs">
                    {/* Allergies chip builder */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Known Skin Allergies / Sensitivities</label>
                      <div className="flex gap-2 flex-wrap mb-2">
                        {allergies.map(all => (
                          <span key={all} className="px-2.5 py-1 bg-slate-950 rounded-lg text-emerald-400 font-bold border border-slate-900 flex items-center gap-1.5 text-[9px] uppercase tracking-wider">
                            {all}
                            <button type="button" onClick={() => setAllergies(allergies.filter(a => a !== all))} className="text-slate-500 hover:text-red-400">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newAllergy}
                          onChange={(e) => setNewAllergy(e.target.value)}
                          placeholder="e.g. Fragrance, Latex" 
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 focus:outline-none focus:border-emerald-500 text-xs text-slate-200" 
                        />
                        <button 
                          type="button" 
                          onClick={() => { if (newAllergy) { setAllergies([...allergies, newAllergy]); setNewAllergy(''); } }}
                          className="p-2.5 bg-slate-950 border border-slate-800 text-emerald-400 rounded-xl hover:bg-slate-900 cursor-pointer"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Self skin-type assessment</label>
                        <select 
                          value={skinTypeSelf} 
                          onChange={(e) => setSkinTypeSelf(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 text-xs text-slate-200 appearance-none cursor-pointer"
                        >
                          <option value="Dry">Dry</option>
                          <option value="Oily">Oily</option>
                          <option value="Combination">Combination</option>
                          <option value="Normal">Normal</option>
                          <option value="Not sure">Not sure</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Primary Skin Concern</label>
                        <select 
                          value={skinConcern} 
                          onChange={(e) => setSkinConcern(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 text-xs text-slate-200 appearance-none cursor-pointer"
                        >
                          <option value="Acne">Acne</option>
                          <option value="Dark spots">Dark spots</option>
                          <option value="Texture">Texture</option>
                          <option value="Dullness">Dullness</option>
                          <option value="Sensitivity">Sensitivity</option>
                          <option value="Anti-aging">Anti-aging</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Current Medications</label>
                      <input 
                        type="text" 
                        value={medications}
                        onChange={(e) => setMedications(e.target.value)}
                        placeholder="e.g. none" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 text-xs text-slate-200" 
                      />
                    </div>

                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      {isSavingProfile ? "Updating Profile..." : "Lock & Save Profile Changes"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </PortalShell>
  );
}