"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import PortalShell from '../../../components/ui/PortalShell';
import { ShieldAlert, Mail, Award, CheckCircle, XCircle, FileText, Settings, Users, ClipboardList, TrendingUp, Search, Trash, Play, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import ThreeDWidget from '../../../components/ui/ThreeDWidget';


export default function AdminConsoleDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Sub-tabs: 'overview' | 'doctors' | 'patients' | 'queues' | 'config'
  const [adminSubTab, setAdminSubTab] = useState('overview');

  // Directory Database States
  const [allUsers, setAllUsers] = useState([]);
  const [allScans, setAllScans] = useState([]);
  const [allReviews, setAllReviews] = useState([]);

  // Selected Detail Modal slots
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [processingUid, setProcessingUid] = useState(null);

  // Search & Filters
  const [doctorFilter, setDoctorFilter] = useState('pending');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientHistory, setPatientHistory] = useState([]);

  // Config parameters state (stored in local storage for MVP-lite demo mock persistence)
  const [saleText, setSaleText] = useState('FREE for the next 10 days. Offer ends July 5.');
  const [featureConsult, setFeatureConsult] = useState(true);
  const [featureScanner, setFeatureScanner] = useState(true);
  const [featureRoutine, setFeatureRoutine] = useState(true);
  const [ingredientList, setIngredientList] = useState([
    { name: 'Salicylic Acid', type: 'BHA', target: 'Acne' },
    { name: 'Niacinamide', type: 'B3', target: 'Pores' },
    { name: 'Retinol', type: 'Vitamin A', target: 'Aging' }
  ]);
  const [newIngName, setNewIngName] = useState('');
  const [newIngType, setNewIngType] = useState('AHA');
  const [newIngTarget, setNewIngTarget] = useState('Acne');

  // Direct login security gate
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Real-time Database Snapshot Streams
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    // 1. Listen for all users
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snap) => {
      setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    }, (error) => {
      console.warn("Admin users subscription error: ", error);
    });

    // 2. Listen for all scans
    const unsubscribeScans = onSnapshot(collection(db, "scans"), (snap) => {
      setAllScans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.warn("Admin scans subscription error: ", error);
    });

    // 3. Listen for all reviews
    const unsubscribeReviews = onSnapshot(collection(db, "doctor_reviews"), (snap) => {
      setAllReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.warn("Admin reviews subscription error: ", error);
    });

    // Load initial config parameters if cached
    const cachedSale = localStorage.getItem('derma_sale_text');
    if (cachedSale) setSaleText(cachedSale);

    return () => {
      unsubscribeUsers();
      unsubscribeScans();
      unsubscribeReviews();
    };
  }, [user]);

  // Helper fetch timeline scans when a patient row is selected
  useEffect(() => {
    if (!selectedPatient) {
      setPatientHistory([]);
      return;
    }
    const filterScans = allScans.filter(s => s.patient_id === selectedPatient.uid);
    // Sort desc
    filterScans.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bTime - aTime;
    });
    setPatientHistory(filterScans);
  }, [selectedPatient, allScans]);

  const handleStatusApprovalChange = async (doctorUid, nextStatus, reason = '') => {
    setProcessingUid(doctorUid);
    try {
      const docRef = doc(db, "users", doctorUid);
      await updateDoc(docRef, { 
        status: nextStatus,
        reapplyReason: reason
      });
      alert(`Doctor registration status updated to [${nextStatus}].`);
      setSelectedDoctor(null);
      setRejectionReason('');
    } catch (e) {
      console.error(e);
      alert("Failed to update doctor status.");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleDeactivatePatient = async (patientUid, suspend) => {
    setProcessingUid(patientUid);
    try {
      const docRef = doc(db, "users", patientUid);
      await updateDoc(docRef, { 
        status: suspend ? 'suspended' : 'active',
        deactivateReason: suspend ? deactivateReason : ''
      });
      alert(`Patient account verification state set to [${suspend ? 'suspended' : 'active'}].`);
      setSelectedPatient(null);
      setDeactivateReason('');
    } catch (e) {
      console.error(e);
      alert("Action failed.");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReassignDoctor = async (scanId, nextDocId, nextDocName) => {
    try {
      const scanRef = doc(db, "scans", scanId);
      await updateDoc(scanRef, {
        assigned_doctor_id: nextDocId,
        assigned_doctor_name: nextDocName
      });
      alert(`Scan case reassigned to Dr. ${nextDocName}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePriority = async (scanId, currentPriority) => {
    try {
      const scanRef = doc(db, "scans", scanId);
      await updateDoc(scanRef, {
        urgent: !currentPriority
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('derma_sale_text', saleText);
    alert("Configuration parameters written to persistent memory cache.");
  };

  const handleAddIngredient = () => {
    if (!newIngName) return;
    setIngredientList([...ingredientList, { name: newIngName, type: newIngType, target: newIngTarget }]);
    setNewIngName('');
  };

  if (loading || !user || user.role !== 'admin') return null;

  // Filter registers
  const patientsList = allUsers.filter(u => u.role === 'patient');
  const doctorsList = allUsers.filter(u => u.role === 'dermat');
  const activeDoctors = doctorsList.filter(d => d.status === 'active' || d.status === 'approved');

  const pendingDoctorsCount = doctorsList.filter(d => d.status === 'pending').length;
  
  // Search patient profile list
  const filteredPatients = patientsList.filter(p => {
    const term = patientSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(term) || (p.email || '').toLowerCase().includes(term);
  });

  // Dynamic stats calculators to eliminate hardcoding
  const getActiveTodayCount = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const count = allScans.filter(s => {
      const scanDate = s.createdAt?.toDate ? s.createdAt.toDate() : null;
      return scanDate && scanDate >= today;
    }).length;
    return Math.max(count + 1, 1); // Minimum 1 since the active admin is logged in
  };

  const getPatientsThisWeek = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return patientsList.filter(p => {
      const pDate = p.createdAt?.toDate ? p.createdAt.toDate() : null;
      return pDate && pDate >= sevenDaysAgo;
    }).length;
  };

  const getScansThisWeek = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return allScans.filter(s => {
      const sDate = s.createdAt?.toDate ? s.createdAt.toDate() : null;
      return sDate && sDate >= sevenDaysAgo;
    }).length;
  };

  const getConditionStats = () => {
    if (allScans.length === 0) return { acnePct: 0, normalPct: 0, otherPct: 0, dominant: 'No Scans' };
    const acne = allScans.filter(s => (s.skin_condition || '').toLowerCase() === 'acne').length;
    const normal = allScans.filter(s => (s.skin_condition || '').toLowerCase() === 'normal baseline').length;
    const total = allScans.length;
    
    const acnePct = total > 0 ? Math.round((acne / total) * 100) : 0;
    const normalPct = total > 0 ? Math.round((normal / total) * 100) : 0;
    const otherPct = Math.max(0, 100 - acnePct - normalPct);
    
    let dominant = 'Balanced';
    if (acne > normal && acne > 0) dominant = 'Acne';
    else if (normal > acne && normal > 0) dominant = 'Normal';
    
    return { acnePct, normalPct, otherPct, dominant };
  };

  const conditionStats = getConditionStats();


  return (
    <PortalShell>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 w-full relative z-10"
      >
        
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-widest text-xs">
              <ShieldAlert size={14} className="animate-pulse" /> Root System Control Layer
            </div>
            <h2 className="text-xl font-black uppercase text-slate-100 tracking-wide mt-1">Administrative Oversight Desk</h2>
            <p className="text-xs text-slate-500 font-medium">SaaS control tower monitoring diagnostics telemetry, user profiles, and active configurations.</p>
          </div>
        </div>

        {/* Admin Section Tabs */}
        <div className="flex gap-1.5 bg-slate-900/35 border border-slate-900 p-1.5 rounded-2xl w-max">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'doctors', label: 'Doctors', icon: Award },
            { id: 'patients', label: 'Patients', icon: Users },
            { id: 'queues', label: 'Consultations', icon: ClipboardList },
            { id: 'config', label: 'Content Config', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  adminSubTab === tab.id
                    ? 'bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/20 text-red-400 shadow-inner'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* --- SUBVIEW CONTAINERS --- */}
        <div className="w-full">
          <AnimatePresence mode="wait">

            {/* TAB 1: OVERVIEW DASHBOARD */}
            {adminSubTab === 'overview' && (
              <motion.div 
                key="view-overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* KPIs Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Total Patients</span>
                    <div className="text-xl font-black text-slate-200 mt-1">{patientsList.length} Accounts</div>
                  </div>
                  <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Verified Doctors</span>
                    <div className="text-xl font-black text-emerald-400 mt-1">{activeDoctors.length} Active</div>
                  </div>
                  <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Telemetry Scans</span>
                    <div className="text-xl font-black text-slate-200 mt-1">{allScans.length} Scans</div>
                  </div>
                  <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Prescriptions</span>
                    <div className="text-xl font-black text-teal-400 mt-1">{allReviews.length} Issued</div>
                  </div>
                  <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Active Today</span>
                    <div className="text-xl font-black text-slate-200 mt-1">{getActiveTodayCount()} Users</div>
                  </div>
                  <div className={`p-4 border rounded-2xl shadow-xl transition-all ${
                    pendingDoctorsCount > 0 
                      ? 'bg-amber-500/5 border-amber-500/25 animate-pulse' 
                      : 'bg-slate-900/20 border-slate-900'
                  }`}>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Pending Approvals</span>
                    <div className={`text-xl font-black mt-1 ${pendingDoctorsCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{pendingDoctorsCount} Requests</div>
                  </div>
                </div>

                {/* Analytical progress representations */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Signup & Scan Stats */}
                  <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl space-y-4 shadow-xl">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">System Diagnostics Activity</span>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>Patient Signups (This Week)</span>
                          <span className="text-slate-200">{getPatientsThisWeek()} new</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, (getPatientsThisWeek() / Math.max(1, patientsList.length)) * 100)}%` }} />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>Scans Logged (This Week)</span>
                          <span className="text-slate-200">{getScansThisWeek()} uploads</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, (getScansThisWeek() / Math.max(1, allScans.length)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conditions pie chart widget */}
                  <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl space-y-4 shadow-xl">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Condition distribution profile</span>
                    
                    <div className="grid grid-cols-2 gap-4 items-center">
                      {/* Donut representation */}
                      <div className="relative w-24 h-24 mx-auto">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="36" stroke="rgba(248, 113, 113, 0.2)" strokeWidth="6" fill="transparent" />
                          <circle cx="48" cy="48" r="36" stroke="#10b981" strokeWidth="6" fill="transparent" strokeDasharray="226" strokeDashoffset={226 - (226 * conditionStats.acnePct) / 100} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-300 font-mono text-center px-1 leading-normal">{conditionStats.dominant}</div>
                      </div>

                      {/* Legend */}
                      <div className="text-[9px] font-bold text-slate-500 space-y-1.5 uppercase tracking-wider">
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500" /> Acne ({conditionStats.acnePct}%)</div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-teal-500" /> Normal ({conditionStats.normalPct}%)</div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-red-400" /> Others ({conditionStats.otherPct}%)</div>
                      </div>
                    </div>
                  </div>

                  {/* Operational 3D Network Topology Card */}
                  <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between min-h-[160px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">System Topology Matrix</span>
                      <span className="text-[8px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase font-bold font-black">NODE SYS</span>
                    </div>
                    <div className="flex-1 w-full h-24 min-h-[96px] relative">
                      <ThreeDWidget type="matrix" className="w-full h-full" />
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider text-center">Interactive Cyber Tesseract</span>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 2: DOCTOR MANAGEMENT */}
            {adminSubTab === 'doctors' && (
              <motion.div 
                key="view-doctors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Filters */}
                <div className="flex gap-2 bg-slate-900/40 p-1 rounded-xl border border-slate-900/60 w-max">
                  {['pending', 'active', 'rejected'].map(st => (
                    <button
                      key={st}
                      onClick={() => setDoctorFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        doctorFilter === st 
                          ? 'bg-gradient-to-r from-red-500/10 to-amber-500/10 border text-red-400 border-red-500/20 shadow-inner' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {st} ({doctorsList.filter(d => d.status === st).length})
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="bg-slate-900/20 border border-slate-900 rounded-3xl overflow-hidden shadow-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        <th className="p-4">Doctor Name</th>
                        <th className="p-4">License Key</th>
                        <th className="p-4">Specialization</th>
                        <th className="p-4">Experience</th>
                        <th className="p-4 text-right">Action Gate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/40">
                      {doctorsList.filter(d => d.status === doctorFilter).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest">
                            No dermatologist folders found
                          </td>
                        </tr>
                      ) : (
                        doctorsList.filter(d => d.status === doctorFilter).map((doctor) => (
                          <tr key={doctor.uid} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4 font-bold text-slate-200">Dr. {doctor.name}</td>
                            <td className="p-4 font-mono font-bold text-slate-400 uppercase">{doctor.licenseNum}</td>
                            <td className="p-4 text-teal-400 font-bold uppercase text-[10px]">{doctor.specialization || "Dermatologist"}</td>
                            <td className="p-4 text-slate-400 font-bold">{doctor.experience} Years</td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setSelectedDoctor(doctor)} 
                                className="bg-slate-950 border border-slate-800 hover:border-red-500/20 text-slate-300 hover:text-red-400 font-black px-3.5 py-2 rounded-xl transition-all text-[9px] uppercase tracking-widest shadow-inner cursor-pointer"
                              >
                                View File
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* TAB 3: PATIENT DIRECTORY */}
            {adminSubTab === 'patients' && (
              <motion.div 
                key="view-patients"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Search Bar */}
                <div className="relative w-full max-w-md">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient by name or email..." 
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all font-medium" 
                  />
                </div>

                {/* Table */}
                <div className="bg-slate-900/20 border border-slate-900 rounded-3xl overflow-hidden shadow-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        <th className="p-4">Patient Profile</th>
                        <th className="p-4">Email Address</th>
                        <th className="p-4">Join Date</th>
                        <th className="p-4">Account Status</th>
                        <th className="p-4 text-right">Action Gate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/40">
                      {filteredPatients.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest">
                            No patient directory folders match search
                          </td>
                        </tr>
                      ) : (
                        filteredPatients.map((patient) => (
                          <tr key={patient.uid} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4 font-bold text-slate-200">{patient.username || patient.name}</td>
                            <td className="p-4 text-slate-400 font-mono">{patient.email}</td>
                            <td className="p-4 text-slate-500 font-medium">
                              {patient.createdAt?.toDate ? new Date(patient.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                patient.status === 'suspended' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {patient.status || 'active'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setSelectedPatient(patient)} 
                                className="bg-slate-950 border border-slate-800 hover:border-red-500/20 text-slate-300 hover:text-red-400 font-black px-3.5 py-2 rounded-xl transition-all text-[9px] uppercase tracking-widest shadow-inner cursor-pointer"
                              >
                                View File
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* TAB 4: CONSULTATION QUEUE MANAGEMENT */}
            {adminSubTab === 'queues' && (
              <motion.div 
                key="view-queues"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Table */}
                <div className="bg-slate-900/20 border border-slate-900 rounded-3xl overflow-hidden shadow-xl">
                  <div className="p-4 bg-slate-900/35 border-b border-slate-900 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider">Oversight Consultation Queue</h3>
                    <span className="text-[8px] font-mono font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">
                      Live Queue Monitor
                    </span>
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        <th className="p-4">Patient ID</th>
                        <th className="p-4">AI Scan Prediction</th>
                        <th className="p-4">Assigned Doctor</th>
                        <th className="p-4">Urgent</th>
                        <th className="p-4 text-right">Reassign Queue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/40">
                      {allScans.filter(s => s.consultation_requested === true).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest">
                            No scans active in dermatologist review queues
                          </td>
                        </tr>
                      ) : (
                        allScans.filter(s => s.consultation_requested === true).map((scan) => (
                          <tr key={scan.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4 font-mono font-bold text-slate-400">#{scan.patient_id?.slice(0, 8).toUpperCase()}</td>
                            <td className="p-4 font-bold text-slate-300">{scan.skin_type} · <span className="text-emerald-400 uppercase tracking-wider text-[10px]">{scan.skin_condition}</span></td>
                            <td className="p-4 font-bold text-slate-300">Dr. {scan.assigned_doctor_name || "Unassigned"}</td>
                            <td className="p-4">
                              <button 
                                onClick={() => handleTogglePriority(scan.id, scan.urgent || false)}
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest cursor-pointer border ${
                                  scan.urgent 
                                    ? 'bg-red-500/15 border-red-500/20 text-red-400 animate-pulse' 
                                    : 'bg-transparent border-slate-800 text-slate-600 hover:text-slate-400'
                                }`}
                              >
                                {scan.urgent ? "Urgent" : "Standard"}
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <select
                                onChange={(e) => {
                                  const docId = e.target.value;
                                  const targetDoc = activeDoctors.find(d => d.uid === docId);
                                  if (targetDoc) handleReassignDoctor(scan.id, docId, targetDoc.name);
                                }}
                                className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 focus:outline-none focus:border-red-500 text-[10px] text-slate-300 cursor-pointer"
                                defaultValue=""
                              >
                                <option value="" disabled>Reassign To...</option>
                                {activeDoctors.map(doc => (
                                  <option key={doc.uid} value={doc.uid}>Dr. {doc.name}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* TAB 5: CONTENT CONFIG PANEL */}
            {adminSubTab === 'config' && (
              <motion.div 
                key="view-config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {/* Feature config */}
                <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl space-y-5 shadow-xl">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-900 pb-2 flex items-center gap-1.5"><Settings size={14} /> Features & Banners</h3>
                  
                  <div className="space-y-4 text-xs font-medium">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Sale Banner Promotional Text</label>
                      <input 
                        type="text" 
                        value={saleText}
                        onChange={(e) => setSaleText(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 text-xs text-slate-200" 
                      />
                    </div>

                    <div className="space-y-2 border-t border-slate-900/60 pt-3">
                      <span className="text-[9px] font-black text-slate-500 tracking-widest block uppercase mb-1.5">Toggle Platform Modules</span>
                      
                      <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-900 rounded-xl cursor-pointer">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Doctor Referral Consultations</span>
                        <input type="checkbox" checked={featureConsult} onChange={() => setFeatureConsult(!featureConsult)} />
                      </label>

                      <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-900 rounded-xl cursor-pointer">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">AI Ingredient Scanner</span>
                        <input type="checkbox" checked={featureScanner} onChange={() => setFeatureScanner(!featureScanner)} />
                      </label>

                      <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-900 rounded-xl cursor-pointer">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Routine Builder Recommendations</span>
                        <input type="checkbox" checked={featureRoutine} onChange={() => setFeatureRoutine(!featureRoutine)} />
                      </label>
                    </div>

                    <button 
                      onClick={handleSaveConfig}
                      className="w-full py-3 bg-gradient-to-r from-red-500 to-amber-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg cursor-pointer"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>

                {/* Manage ingredient database */}
                <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-3xl space-y-5 shadow-xl">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-900 pb-2 flex items-center gap-1.5"><ClipboardList size={14} /> Ingredient Database</h3>
                  
                  <div className="space-y-4">
                    {/* Add ingredient form */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <input 
                        type="text" 
                        value={newIngName}
                        onChange={(e) => setNewIngName(e.target.value)}
                        placeholder="Ingredient (e.g. BHA)" 
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2 focus:outline-none focus:border-red-500 text-[10px] text-slate-200" 
                      />
                      <select 
                        value={newIngType} 
                        onChange={(e) => setNewIngType(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2 focus:outline-none focus:border-red-500 text-[10px] text-slate-200 appearance-none cursor-pointer"
                      >
                        <option value="AHA">AHA</option>
                        <option value="BHA">BHA</option>
                        <option value="Vitamin">Vitamin</option>
                        <option value="Botanical">Botanical</option>
                      </select>
                      <button 
                        onClick={handleAddIngredient}
                        className="bg-slate-950 border border-slate-800 hover:border-red-500/20 text-red-400 font-bold p-2 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Ingredients list */}
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar text-xs">
                      {ingredientList.map(ing => (
                        <div key={ing.name} className="p-2.5 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-extrabold text-slate-200">{ing.name}</span>
                            <span className="text-[8px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded ml-2 uppercase tracking-wide">{ing.type}</span>
                          </div>
                          <button 
                            onClick={() => setIngredientList(ingredientList.filter(i => i.name !== ing.name))} 
                            className="text-slate-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* --- DOCTOR DETAIL MODAL OVERLAY --- */}
        <AnimatePresence>
          {selectedDoctor && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedDoctor(null)} />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative z-10 space-y-6"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-teal-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-300">Credentials application audit</span>
                  </div>
                  <button onClick={() => setSelectedDoctor(null)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer"><X size={14} /></button>
                </div>

                <div className="space-y-4 text-xs font-medium text-slate-400">
                  <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-900">
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Full Name</span>
                      <span className="text-slate-200 font-bold">Dr. {selectedDoctor.name}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">License Key</span>
                      <span className="text-slate-200 font-mono font-bold">{selectedDoctor.licenseNum}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Specialization</span>
                      <span className="text-teal-400 font-bold uppercase">{selectedDoctor.specialization || "Dermatologist"}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Experience (Years)</span>
                      <span className="text-slate-200 font-bold">{selectedDoctor.experience} Years</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">College / University</span>
                      <span className="text-slate-300 font-bold">{selectedDoctor.college || "N/A"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Hospital Clinic Address</span>
                      <span className="text-slate-300 font-bold">{selectedDoctor.hospital || "N/A"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Biography Bio</span>
                    <p className="p-3 bg-slate-950 rounded-xl border border-slate-900 text-slate-300 leading-relaxed italic">
                      "{selectedDoctor.bio || "No biography provided"}"
                    </p>
                  </div>

                  {/* Actions */}
                  {selectedDoctor.status === 'pending' && (
                    <div className="space-y-4 pt-2 border-t border-slate-800">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block ml-1">Write Rejection Reason (If Refusing)</label>
                        <input 
                          type="text" 
                          value={rejectionReason} 
                          onChange={(e) => setRejectionReason(e.target.value)} 
                          placeholder="e.g. License ID number could not be validated in MCI directories." 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500 placeholder:text-slate-700" 
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleStatusApprovalChange(selectedDoctor.uid, 'rejected', rejectionReason)} 
                          disabled={processingUid !== null} 
                          className="flex-1 bg-slate-950 border border-slate-800 text-slate-400 hover:text-red-400 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-35"
                        >
                          Refuse Application
                        </button>
                        <button 
                          onClick={() => handleStatusApprovalChange(selectedDoctor.uid, 'active')} 
                          disabled={processingUid !== null} 
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-35"
                        >
                          Verify & Approve
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedDoctor.status === 'active' && (
                    <button 
                      onClick={() => handleStatusApprovalChange(selectedDoctor.uid, 'rejected', 'Account verification suspended by system admin.')} 
                      disabled={processingUid !== null} 
                      className="w-full py-3 bg-slate-950 border border-slate-800 text-slate-400 hover:text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-35"
                    >
                      Suspend Practitioner Account
                    </button>
                  )}

                  {selectedDoctor.status === 'rejected' && (
                    <button 
                      onClick={() => handleStatusApprovalChange(selectedDoctor.uid, 'pending')} 
                      disabled={processingUid !== null} 
                      className="w-full py-3 bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-35"
                    >
                      Reset back to Pending review
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- PATIENT DETAIL MODAL OVERLAY --- */}
        <AnimatePresence>
          {selectedPatient && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedPatient(null)} />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative z-10 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-red-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-300">Patient Folder Overview</span>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer"><X size={14} /></button>
                </div>

                <div className="space-y-5 text-xs text-slate-400 font-medium">
                  {/* Basic info */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-900">
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Full Name</span>
                      <span className="text-slate-200 font-bold">{selectedPatient.username || selectedPatient.name}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Email Link</span>
                      <span className="text-slate-200 font-mono">{selectedPatient.email}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Contact Node</span>
                      <span className="text-slate-300">{selectedPatient.phone || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">Skin Type (Self)</span>
                      <span className="text-emerald-400 font-bold uppercase">{selectedPatient.skinTypeSelf || "N/A"}</span>
                    </div>
                  </div>

                  {/* Scans timeline history */}
                  <div className="space-y-2">
                    <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest block mb-1">Scan telemetry logs ({patientHistory.length} uploads)</span>
                    <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-1">
                      {patientHistory.map(hist => (
                        <div key={hist.id} className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl text-[10px] flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {hist.image_url ? (
                              <img src={hist.image_url} alt="Scan" className="w-10 h-10 object-cover rounded-lg border border-slate-800" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-900 rounded-lg border border-slate-850 flex items-center justify-center text-[8px] text-slate-600">No Img</div>
                            )}
                            <div>
                              <span className="text-slate-300 font-bold block">{hist.skin_type} · <strong className="text-emerald-400 uppercase font-mono">{hist.skin_condition}</strong></span>
                              <span className="text-[8px] text-slate-500 font-mono">
                                {hist.createdAt?.toDate ? new Date(hist.createdAt.toDate()).toLocaleString() : 'Recent'}
                              </span>
                            </div>
                          </div>
                          {hist.image_url && (
                            <a 
                              href={hist.image_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[8px] font-black uppercase text-teal-400 border border-teal-500/20 bg-teal-500/5 px-2.5 py-1.5 rounded-lg hover:bg-teal-500/25 transition-all shrink-0"
                            >
                              Open Full Image
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suspend Account Actions */}
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    {selectedPatient.status === 'suspended' ? (
                      <button
                        onClick={() => handleDeactivatePatient(selectedPatient.uid, false)}
                        disabled={processingUid !== null}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-35"
                      >
                        Reactivate Patient Account
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block ml-1">Deactivation / Suspension Reason</label>
                          <input 
                            type="text" 
                            value={deactivateReason} 
                            onChange={(e) => setDeactivateReason(e.target.value)} 
                            placeholder="e.g. Violations of platform guidelines or spam scans uploads." 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500 placeholder:text-slate-700" 
                          />
                        </div>
                        <button
                          onClick={() => handleDeactivatePatient(selectedPatient.uid, true)}
                          disabled={processingUid !== null}
                          className="w-full py-3 bg-slate-950 border border-slate-850 text-slate-400 hover:text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-35"
                        >
                          Suspend Account
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </PortalShell>
  );
}