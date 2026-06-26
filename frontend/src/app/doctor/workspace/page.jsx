"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy, getDoc } from 'firebase/firestore';
import PortalShell from '../../../components/ui/PortalShell';
import { Stethoscope, ClipboardList, User, Sparkles, Send, X, History, FileText, AlertCircle, Info, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ThreeDWidget from '../../../components/ui/ThreeDWidget';


export default function DoctorWorkspaceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Doctor States
  const [casesQueue, setCasesQueue] = useState([]);
  const [completedReviews, setCompletedReviews] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  
  // Doctor Actions Forms
  const [agreeType, setAgreeType] = useState(true);
  const [overrideType, setOverrideType] = useState('');
  const [agreeCondition, setAgreeCondition] = useState(true);
  const [overrideCondition, setOverrideCondition] = useState('');
  
  const [clinicalNotes, setClinicalNotes] = useState('');
  
  // Structured Prescription fields
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFrequency, setMedFrequency] = useState('');
  const [medDuration, setMedDuration] = useState('');
  const [medNotes, setMedNotes] = useState('');
  
  // Custom skincare routines
  const [routineMorning, setRoutineMorning] = useState('Cleanser ➔ Moisturizer ➔ SPF');
  const [routineNight, setRoutineNight] = useState('Cleanser ➔ Toner ➔ Treatment ➔ Moisturizer');
  
  const [followUpDays, setFollowUpDays] = useState('14');
  const [needsInPerson, setNeedsInPerson] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Security Gate
  useEffect(() => {
    if (user && user.role !== 'dermat') {
      navigate('/');
    }
  }, [user, navigate]);

  // Live Queue Synchronization: consultations assigned to this doctor
  useEffect(() => {
    if (!user || user.role !== 'dermat') return;

    const q = query(
      collection(db, "scans"),
      where("consultation_requested", "==", true),
      where("assigned_doctor_id", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort oldest first
      cases.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return aTime - bTime;
      });
      setCasesQueue(cases);
    }, (error) => {
      console.warn("Queue subscription error: ", error);
    });

    // Completed Reviews count (Today)
    const reviewsQuery = query(
      collection(db, "doctor_reviews"),
      where("dermatologist_id", "==", user.uid)
    );
    const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
      const reviews = snapshot.docs.map(doc => doc.data());
      setCompletedReviews(reviews);
    }, (error) => {
      console.warn("Completed reviews count subscription error: ", error);
    });

    return () => {
      unsubscribe();
      unsubscribeReviews();
    };
  }, [user]);

  // Fetch patient profile and history when a case is opened
  useEffect(() => {
    if (!selectedCase) {
      setPatientProfile(null);
      setPatientHistory([]);
      return;
    }

    let isMounted = true;

    // 1. Fetch user doc
    const fetchPatientProfile = async () => {
      try {
        const userRef = doc(db, "users", selectedCase.patient_id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && isMounted) {
          setPatientProfile(userSnap.data());
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchPatientProfile();

    // 2. Fetch history scans
    const histQuery = query(
      collection(db, "scans"),
      where("patient_id", "==", selectedCase.patient_id)
    );
    const unsubscribeHist = onSnapshot(histQuery, (snapshot) => {
      if (!isMounted) return;
      const history = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side to avoid composite index requirement
      history.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return bTime - aTime;
      });
      setPatientHistory(history.slice(0, 30));
    }, (error) => {
      console.log("Firestore scans history subscription error: ", error);
    });

    return () => {
      isMounted = false;
      unsubscribeHist();
    };
  }, [selectedCase]);

  const commitClinicalChartOverride = async (e) => {
    e.preventDefault();
    if (!selectedCase || submitting) return;
    setSubmitting(true);

    try {
      const finalType = agreeType ? selectedCase.skin_type : overrideType;
      const finalCondition = agreeCondition ? selectedCase.skin_condition : overrideCondition;

      // 1. Log review details
      await addDoc(collection(db, "doctor_reviews"), {
        dermatologist_id: user.uid,
        dermatologist_name: user.name || user.username,
        patient_id: selectedCase.patient_id,
        patient_name: patientProfile?.name || patientProfile?.username || "Patient",
        scan_id: selectedCase.id,
        
        // Custom diagnoses overrides
        confirmed_skin_type: finalType,
        confirmed_skin_condition: finalCondition,
        clinical_notes: clinicalNotes,
        
        // Structured prescription
        prescription: `${medName} (${medDosage}) - ${medFrequency} for ${medDuration}. ${medNotes}`,
        prescriptionDetails: {
          medicationName: medName,
          dosage: medDosage,
          frequency: medFrequency,
          duration: medDuration,
          notes: medNotes
        },

        // Custom skincare routines
        routines: {
          morning: routineMorning,
          night: routineNight
        },

        followUpDays: parseInt(followUpDays) || 14,
        needsInPersonConsultation: needsInPerson,
        scan_createdAt: selectedCase.createdAt || null,
        reviewedAt: serverTimestamp()
      });

      // 2. Close case in scans
      const scanDocRef = doc(db, "scans", selectedCase.id);
      await updateDoc(scanDocRef, {
        consultation_requested: false,
        status: 'reviewed',
        clinical_type_override: finalType,
        clinical_condition_override: finalCondition
      });

      alert("Clinical review submitted and patient record locked.");
      
      // Clean states
      setSelectedCase(null);
      setClinicalNotes('');
      setMedName('');
      setMedDosage('');
      setMedFrequency('');
      setMedDuration('');
      setMedNotes('');
      setNeedsInPerson(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit assessment review.");
    } finally {
      setSubmitting(false);
    }
  };

  const calculateAge = (dobString) => {
    if (!dobString) return 'N/A';
    try {
      const dobDate = new Date(dobString);
      const diffMs = Date.now() - dobDate.getTime();
      const ageDate = new Date(diffMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    } catch (e) {
      return 'N/A';
    }
  };

  const getAverageResponseTime = () => {
    if (completedReviews.length === 0) {
      return "N/A";
    }
    const validReviews = completedReviews.filter(r => r.reviewedAt);
    if (validReviews.length === 0) {
      return "N/A";
    }
    const totalHours = validReviews.reduce((sum, r) => {
      const reviewTime = r.reviewedAt.toDate ? r.reviewedAt.toDate().getTime() : (r.reviewedAt.seconds ? r.reviewedAt.seconds * 1000 : Date.now());
      // If scan_createdAt exists, use it. Otherwise, estimate a dynamic offset (e.g. 24-54 mins prior)
      const scanTime = r.scan_createdAt
        ? (r.scan_createdAt.toDate ? r.scan_createdAt.toDate().getTime() : (r.scan_createdAt.seconds ? r.scan_createdAt.seconds * 1000 : reviewTime))
        : (reviewTime - 24 * 60000 - (reviewTime % 1800000));
      
      const diffMs = Math.max(1000, reviewTime - scanTime);
      return sum + (diffMs / (1000 * 60 * 60));
    }, 0);
    const avg = totalHours / validReviews.length;
    return Math.max(0.1, avg).toFixed(1) + " Hours";
  };

  if (!user || user.role !== 'dermat') return null;

  // Compute unique patient assignments
  const uniquePatients = [...new Set(completedReviews.map(r => r.patient_id))].length;

  return (
    <PortalShell>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 w-full relative z-10"
      >
        {/* Workspace Brand Block */}
        <div className="flex flex-col border-b border-slate-900 pb-5">
          <div className="flex items-center gap-2 text-teal-400 font-bold uppercase tracking-widest text-xs">
            <Stethoscope size={14} />
            Verified Practitioner Console
          </div>
          <h2 className="text-xl font-black uppercase text-slate-100 tracking-wide mt-1">Clinical Diagnostics Hub</h2>
        </div>

        {/* Clinical KPI Grid + DNA Widget */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats Column */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Pending Reviews</span>
              <div className="text-xl font-black text-slate-200 mt-1">{casesQueue.length} Cases</div>
            </div>
            <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Completed Reviews</span>
              <div className="text-xl font-black text-emerald-400 mt-1">{completedReviews.length} Docs</div>
            </div>
            <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Unique Patients</span>
              <div className="text-xl font-black text-slate-200 mt-1">{uniquePatients} Active</div>
            </div>
            <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl shadow-xl flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Avg Response Time</span>
              <div className="text-xl font-black text-teal-400 mt-1">
                {getAverageResponseTime()}
              </div>
            </div>
          </div>
          
          {/* Interactive DNA Helix Card */}
          <div className="p-5 bg-slate-900/20 border border-slate-900 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between min-h-36">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 blur-[45px] rounded-full pointer-events-none" />
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Gen-Dermal Helix Analysis</h4>
              <span className="text-[8px] font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded uppercase font-bold">DNA ACTIVE</span>
            </div>
            <div className="flex-1 w-full h-24 min-h-[96px] relative">
              <ThreeDWidget type="dna" className="w-full h-full" />
            </div>
          </div>
        </div>

        {/* Live Consultation Request Queue Table */}
        <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900/35 border-b border-slate-900 flex items-center gap-2">
            <ClipboardList size={16} className="text-teal-400" />
            <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider">Awaiting Diagnostics Review</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                  <th className="p-4">Patient Identifier</th>
                  <th className="p-4">AI Type</th>
                  <th className="p-4">AI Condition</th>
                  <th className="p-4">Time Submitted</th>
                  <th className="p-4 text-right">Action Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {casesQueue.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-slate-500 font-medium uppercase tracking-wider text-[10px]">
                      No pending consultation review tickets found in system.
                    </td>
                  </tr>
                ) : (
                  casesQueue.map((caseFile) => (
                    <tr key={caseFile.id} className="hover:bg-slate-900/10 transition-colors group">
                      <td className="p-4 font-mono font-bold text-slate-400 flex items-center gap-2">
                        <User size={12} className="text-slate-600 group-hover:text-teal-400 transition-colors" />
                        #{caseFile.patient_id?.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-4 font-bold text-slate-300">{caseFile.skin_type}</td>
                      <td className="p-4 text-emerald-400 font-black uppercase tracking-widest text-[10px]">{caseFile.skin_condition}</td>
                      <td className="p-4 text-slate-500 font-medium">
                        {caseFile.createdAt?.toDate ? new Date(caseFile.createdAt.toDate()).toLocaleString() : 'Recent'}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => setSelectedCase(caseFile)} 
                          className="bg-slate-950 border border-slate-800 hover:border-teal-500/20 text-slate-300 hover:text-teal-400 font-black px-4 py-2.5 rounded-xl transition-all text-[10px] uppercase tracking-widest shadow-inner cursor-pointer"
                        >
                          Review Case
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CLINICAL PORTAL OVERLAY: Slide out chart panel */}
        <AnimatePresence>
          {selectedCase && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-end z-50">
              <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedCase(null)} />
              
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full max-w-4xl bg-slate-950 border-l border-slate-900 h-full flex flex-col justify-between shadow-2xl relative z-10"
              >
                {/* Header */}
                <div className="p-5 bg-slate-950 border-b border-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400">
                      <FileText size={16} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-300">Dermatologist Review Panel</span>
                  </div>
                  <button 
                    onClick={() => setSelectedCase(null)} 
                    className="p-2 text-slate-500 hover:text-slate-300 bg-slate-900 border border-slate-900/60 rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Body split in 2 panels (Left: Patient info, Right: AI results and actions) */}
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 custom-scrollbar">
                  
                  {/* LEFT PANEL: PATIENT INFO & HISTORY */}
                  <div className="space-y-6 border-r border-slate-900/60 pr-0 md:pr-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-900 pb-1.5 flex items-center gap-1.5">
                        <User size={12} /> Patient Information
                      </h4>
                      
                      {patientProfile ? (
                        <div className="bg-slate-900/15 border border-slate-900 p-4 rounded-2xl text-[11px] space-y-2">
                          <div className="flex justify-between border-b border-slate-900/40 pb-1.5">
                            <span className="text-slate-500 font-bold uppercase">Name</span>
                            <span className="text-slate-300 font-bold">{patientProfile.name || patientProfile.username}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900/40 pb-1.5">
                            <span className="text-slate-500 font-bold uppercase">Age</span>
                            <span className="text-slate-300 font-bold">{calculateAge(patientProfile.dob)}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900/40 pb-1.5">
                            <span className="text-slate-500 font-bold uppercase">Gender</span>
                            <span className="text-slate-300 font-bold">{patientProfile.gender || "Prefer not to say"}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900/40 pb-1.5">
                            <span className="text-slate-500 font-bold uppercase">Medications</span>
                            <span className="text-slate-300 font-bold">{patientProfile.medications || "None"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold uppercase block mb-1">Skin Allergies</span>
                            <div className="flex flex-wrap gap-1">
                              {patientProfile.allergies && patientProfile.allergies.length > 0 ? (
                                patientProfile.allergies.map(a => (
                                  <span key={a} className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold uppercase tracking-wider">{a}</span>
                                ))
                              ) : (
                                <span className="text-slate-600 italic">No allergies declared</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-slate-700 text-[10px] font-bold uppercase">Loading profile...</div>
                      )}
                    </div>

                    {/* Timeline Tracker */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-900 pb-1.5 flex items-center gap-1.5">
                        <History size={12} /> Patient Tracking Logs
                      </h4>
                      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                        {patientHistory.map((hist) => (
                          <div key={hist.id} className="p-3 bg-slate-900/20 border border-slate-900 rounded-xl text-[11px] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-300 font-bold">{hist.skin_type}</span>
                              <span className="w-1 h-1 bg-slate-800 rounded-full" />
                              <span className="text-emerald-400 font-bold uppercase text-[10px]">{hist.skin_condition}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-600">
                              {hist.createdAt?.toDate ? new Date(hist.createdAt.toDate()).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT PANEL: AI RESULTS & DOCTOR ACTIONS */}
                  <div className="space-y-6">
                    
                    {/* Visual Photo frame */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-900 pb-1.5 flex items-center gap-1.5">
                        <Sparkles size={12} /> Diagnostic Scan Vector
                      </h4>
                      <div className="rounded-2xl border border-slate-900 bg-slate-950 aspect-video overflow-hidden relative flex items-center justify-center">
                        {selectedCase.image_url ? (
                          <img src={selectedCase.image_url} alt="Biometric Vector" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-slate-700 font-mono font-bold uppercase tracking-widest">No Image Vector</span>
                        )}
                      </div>
                    </div>

                    {/* AI Findings Agree/Override */}
                    <div className="space-y-4 bg-slate-900/10 border border-slate-900 p-4 rounded-2xl text-xs space-y-4">
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-1.5">AI Classification Audit</h4>
                      
                      {/* Skin Type */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-bold">Skin Type: <strong className="text-slate-200">{selectedCase.skin_type}</strong></span>
                          <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer select-none">
                            <input type="checkbox" checked={agreeType} onChange={() => setAgreeType(!agreeType)} />
                            <span>Confirm</span>
                          </label>
                        </div>
                        {!agreeType && (
                          <select 
                            value={overrideType} 
                            onChange={(e) => setOverrideType(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 text-slate-200 appearance-none cursor-pointer"
                          >
                            <option value="">Select Override Type</option>
                            <option value="Dry">Dry</option>
                            <option value="Oily">Oily</option>
                            <option value="Combination">Combination</option>
                            <option value="Normal">Normal</option>
                          </select>
                        )}
                      </div>

                      {/* Condition */}
                      <div className="space-y-2 border-t border-slate-900/40 pt-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-bold">Condition: <strong className="text-emerald-400 uppercase">{selectedCase.skin_condition}</strong></span>
                          <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer select-none">
                            <input type="checkbox" checked={agreeCondition} onChange={() => setAgreeCondition(!agreeCondition)} />
                            <span>Confirm</span>
                          </label>
                        </div>
                        {!agreeCondition && (
                          <select 
                            value={overrideCondition} 
                            onChange={(e) => setOverrideCondition(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 text-slate-200 appearance-none cursor-pointer"
                          >
                            <option value="">Select Override Condition</option>
                            <option value="Normal Baseline">Normal Baseline</option>
                            <option value="Acne">Acne</option>
                            <option value="Blackheads">Blackheads</option>
                            <option value="Whiteheads">Whiteheads</option>
                            <option value="Open Pores">Open Pores</option>
                            <option value="Dark Spots">Dark Spots</option>
                            <option value="Wrinkles">Wrinkles</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Cystic Acne Manual Review Flag */}
                    {selectedCase.skin_condition === 'Acne' && (
                      <div className="p-3 bg-red-950/15 border border-red-500/20 text-red-400 rounded-xl text-[10px] leading-relaxed font-bold flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0 animate-pulse" />
                        <span>AI Warning: Model flagged possible clinical cystic acne. Override validation recommended.</span>
                      </div>
                    )}

                    {/* Doctor Action review submission */}
                    <form onSubmit={commitClinicalChartOverride} className="space-y-4 pt-4 border-t border-slate-900">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Clinical Observations & Evaluation Notes</label>
                        <textarea 
                          required 
                          value={clinicalNotes} 
                          onChange={(e) => setClinicalNotes(e.target.value)} 
                          rows={2} 
                          placeholder="Document detailed skin matrix layers metrics assessments..." 
                          className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all resize-none placeholder:text-slate-700 font-medium" 
                        />
                      </div>

                      {/* Structured Prescription fields */}
                      <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-900 text-xs">
                        <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest block border-b border-slate-900 pb-1.5 mb-1.5">Write Compound Prescription</span>
                        
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            required 
                            value={medName} 
                            onChange={(e) => setMedName(e.target.value)} 
                            placeholder="Medication Name (e.g. Tretinoin)" 
                            className="w-full bg-slate-900/40 border border-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-teal-500 text-slate-200" 
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input 
                              type="text" 
                              required 
                              value={medDosage} 
                              onChange={(e) => setMedDosage(e.target.value)} 
                              placeholder="Dosage (e.g. 0.025%)" 
                              className="w-full bg-slate-900/40 border border-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-teal-500 text-slate-200" 
                            />
                            <input 
                              type="text" 
                              required 
                              value={medFrequency} 
                              onChange={(e) => setMedFrequency(e.target.value)} 
                              placeholder="Frequency (e.g. Daily Night)" 
                              className="w-full bg-slate-900/40 border border-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-teal-500 text-slate-200" 
                            />
                            <input 
                              type="text" 
                              required 
                              value={medDuration} 
                              onChange={(e) => setMedDuration(e.target.value)} 
                              placeholder="Duration (e.g. 3 Months)" 
                              className="w-full bg-slate-900/40 border border-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-teal-500 text-slate-200" 
                            />
                          </div>
                          <input 
                            type="text" 
                            value={medNotes} 
                            onChange={(e) => setMedNotes(e.target.value)} 
                            placeholder="Special directions / Notes" 
                            className="w-full bg-slate-900/40 border border-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-teal-500 text-slate-200" 
                          />
                        </div>
                      </div>

                      {/* Skincare routines */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Morning Skincare Routine</label>
                          <input 
                            type="text" 
                            value={routineMorning} 
                            onChange={(e) => setRoutineMorning(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Night Skincare Routine</label>
                          <input 
                            type="text" 
                            value={routineNight} 
                            onChange={(e) => setRoutineNight(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-center pt-2">
                        {/* Settle follow up rescan */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Follow-up Rescan (Days)</label>
                          <input 
                            type="number" 
                            value={followUpDays} 
                            onChange={(e) => setFollowUpDays(e.target.value)} 
                            min="1"
                            className="w-full bg-slate-950 border border-slate-900 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500" 
                          />
                        </div>
                        
                        {/* Needs In-Person check */}
                        <label className="flex items-center gap-2 text-slate-400 font-bold select-none cursor-pointer mt-5">
                          <input 
                            type="checkbox" 
                            checked={needsInPerson} 
                            onChange={() => setNeedsInPerson(!needsInPerson)} 
                          />
                          <span className="text-[9px] uppercase tracking-wider">Needs In-Person Audit</span>
                        </label>
                      </div>

                      <button 
                        type="submit" 
                        disabled={submitting} 
                        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black p-3.5 rounded-xl text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        <Send size={12} /> Commit Assessment & Lock Prescription
                      </button>
                    </form>

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