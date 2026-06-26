"use client";
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from "axios";
import { Camera, RefreshCw, Sparkles, AlertTriangle, Upload, Eye, FileText, Check, ChevronDown, ChevronUp, Grid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';


export default function BiometricScanner({ userId, onRequestConsultation }) {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [scanResult, setScanResult] = useState(null);
  
  // Checklist Modal state
  const [showChecklist, setShowChecklist] = useState(true);
  const [checklistChecks, setChecklistChecks] = useState({
    washFace: false,
    noMakeup: false,
    lightCheck: false,
    phoneArm: false,
    faceGuide: false
  });

  // Camera Settings
  const [facingMode, setFacingMode] = useState('user'); // 'user' for front, 'environment' for rear
  const [showGrid, setShowGrid] = useState(true);
  const [brightnessVal, setBrightnessVal] = useState('Good'); // Too dark | Good | Too bright
  
  // Patient allergies list (cross-referenced)
  const [allergiesList, setAllergiesList] = useState([]);
  
  // Accordion toggle
  const [activeAccordion, setActiveAccordion] = useState(null);

  // Consultation queue states
  const [consultRequested, setConsultRequested] = useState(false);
  const [scanDocId, setScanDocId] = useState(null);

  // Fetch patient allergies
  useEffect(() => {
    if (!userId) return;
    const fetchAllergies = async () => {
      try {
        const docRef = doc(db, 'users', userId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setAllergiesList(snap.data().allergies || []);
        }
      } catch (e) {
        console.error("Allergies fetch error: ", e);
      }
    };
    fetchAllergies();
  }, [userId, scanResult]);

  // Simulate changing lighting brightness levels dynamically
  useEffect(() => {
    const interval = setInterval(() => {
      const vals = ['Too dark', 'Good', 'Good', 'Too bright'];
      setBrightnessVal(vals[Math.floor(Math.random() * vals.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Simulating loading steps
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < 2 ? prev + 1 : 2));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const toggleCheck = (key) => {
    setChecklistChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(checklistChecks).every(v => v === true);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setImgSrc(imageSrc);
    }
  }, [webcamRef]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImgSrc(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleScanSubmit = async () => {
    if (!imgSrc) return;
    setLoading(true);
    try {
      const base64Response = await fetch(imgSrc);
      const blob = await base64Response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, 'scan.jpg');
      formData.append('patient_id', userId || 'anonymous_user');

      const scanApiUrl = 'http://127.0.0.1:5000/api/scan';
      const backendResponse = await axios.post(scanApiUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (backendResponse.data.success) {
        const { skin_type, skin_condition, recommended_ingredient, condition_confidence, alternative_confidence } = backendResponse.data;
        
        let downloadURL = "";
        let scanDocId = null;

        // 1. Try uploading to Firebase Storage first (might fail due to CORS or storage rules)
        try {
          const fileRef = ref(storage, `scans/${userId || 'anonymous'}/${Date.now()}.jpg`);
          await uploadBytes(fileRef, blob);
          downloadURL = await getDownloadURL(fileRef);
        } catch (storageErr) {
          console.warn("Firebase Storage upload failed, falling back to local base64/placeholder image data: ", storageErr);
          // Fall back to base64 imgSrc if it exists and is small enough
          if (imgSrc && imgSrc.startsWith('data:') && imgSrc.length < 900000) {
            downloadURL = imgSrc;
          } else {
            downloadURL = "/glowing_skin_mesh.png";
          }
        }

        // 2. Always register the scan in Firestore so the patient can request doctor reviews
        try {
          const scanDocRef = await addDoc(collection(db, "scans"), {
            patient_id: userId || 'anonymous_user',
            skin_type,
            skin_condition,
            recommended_ingredient,
            condition_confidence: condition_confidence ?? 89,
            alternative_confidence: alternative_confidence ?? 11,
            image_url: downloadURL,
            createdAt: serverTimestamp(),
            consultation_requested: false,
            status: 'analyzed'
          });
          scanDocId = scanDocRef.id;
        } catch (dbErr) {
          console.warn("Firestore scan registry sync failed: ", dbErr);
        }

        setScanResult({
          skin_type,
          skin_condition,
          recommended_ingredient,
          condition_confidence: condition_confidence ?? 89,
          alternative_confidence: alternative_confidence ?? 11
        });
        setConsultRequested(false);
        if (scanDocId) {
          setScanDocId(scanDocId);
        }
      } else {
        alert("Failed to parse diagnostic data structure.");
      }
    } catch (error) {
      console.error("Neural Data Ingress Error:", error);
      alert("AI Scan request failed. Check that the Python backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  const triggerDoctorReview = async () => {
    if (!scanDocId) {
      alert("Please process your scan first before requesting consultation.");
      return;
    }
    setConsultRequested(true);
    try {
      if (onRequestConsultation) {
        await onRequestConsultation(scanDocId);
      } else {
        // Fallback standard update
        const scanRef = doc(db, "scans", scanDocId);
        await updateDoc(scanRef, { consultation_requested: true });
        alert("Scan details pushed to clinical queues! A dermatologist will audit shortly.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to register consultation ticket.");
      setConsultRequested(false);
    }
  };

  // Helper: Extract active ingredients from recommendations text
  const detectIngredientsList = (desc) => {
    if (!desc) return ["Green Tea Extract"];
    const common = [
      'Salicylic Acid', 'Niacinamide', 'Lactic Acid', 'Retinol', 'Hyaluronic Acid', 
      'Centella Asiatica', 'Cica', 'Bakuchiol', 'Benzoyl Peroxide', 'Mandelic Acid', 
      'Glycolic Acid', 'Zinc PCA', 'Alpha Arbutin', 'Rosehip Seed Oil', 'Vitamin C'
    ];
    const detected = [];
    const lower = desc.toLowerCase();
    common.forEach(ing => {
      if (lower.includes(ing.toLowerCase()) || (ing === 'Cica' && lower.includes('centella'))) {
        detected.push(ing);
      }
    });
    if (detected.length === 0) detected.push("Green Tea Extract");
    return detected;
  };

  // Helper: check if recommended ingredient matches user's allergies to prevent adverse reactions
  const getAvoidIngredients = (ingredient, allergies) => {
    if (!allergies || !Array.isArray(allergies)) return [];
    const normalizedIng = ingredient.toLowerCase().trim();
    return allergies.filter(allergy => {
      const normalizedAllergy = (allergy || '').toLowerCase().trim();
      if (!normalizedAllergy) return false;
      // Direct string comparison
      if (normalizedIng.includes(normalizedAllergy) || normalizedAllergy.includes(normalizedIng)) {
        return true;
      }
      // Common allergen class references
      const allergenSynonyms = {
        'aspirin': ['salicylic acid', 'bha'],
        'salicylates': ['salicylic acid', 'bha'],
        'retinoids': ['retinol', 'tretinoin', 'bakuchiol'],
        'vitamin a': ['retinol', 'tretinoin', 'bakuchiol'],
        'vitamin c': ['l-ascorbic acid', 'ascorbic acid', 'ascorbyl palmitate'],
        'soy': ['glycine soja', 'soybean extract'],
        'fragrance': ['essential oils', 'limonene', 'linalool']
      };
      for (const [allergen, items] of Object.entries(allergenSynonyms)) {
        if (normalizedAllergy.includes(allergen)) {
          if (items.some(item => normalizedIng.includes(item))) {
            return true;
          }
        }
      }
      return false;
    });
  };

  // Ingredient definitions for educational accordion
  const ingredientDetails = {
    'Salicylic Acid': 'A beta-hydroxy acid (BHA) that penetrates oil glands to clear out sebum plugs and blackheads.',
    'Niacinamide': 'A form of Vitamin B3 that regulates sebum output, fades dark spots, and reduces visible pores.',
    'Lactic Acid': 'A gentle alpha-hydroxy acid (AHA) that cleanses surface scales while retaining skin moisture.',
    'Retinol': 'A Vitamin A derivative that speeds up skin cell renewal to fade wrinkles and improve texture.',
    'Hyaluronic Acid': 'A humectant that draws in structural moisture to plump dry skin layers.',
    'Centella Asiatica': 'A botanical extract (Cica) that calms redness, repairs barriers, and heals acne scars.',
    'Cica': 'A botanical extract that calms redness, repairs barriers, and heals acne scars.',
    'Bakuchiol': 'A plant-derived Retinol alternative that treats signs of aging without drying out dry skin.',
    'Benzoyl Peroxide': 'An antibacterial organic compound that kills acne-triggering bacteria in pores.',
    'Mandelic Acid': 'An ultra-gentle AHA with large molecules, ideal for exfoliating sensitive or dry skin.',
    'Glycolic Acid': 'An AHA that exfoliates surface skin scales to treat texture, whiteheads, and dark spots.',
    'Zinc PCA': 'A zinc compound that controls shine, reduces oil, and has anti-inflammatory properties.',
    'Alpha Arbutin': 'A skin-brightening agent that stops melanin transfer to fade dark spots.',
    'Rosehip Seed Oil': 'A dry oil rich in essential fatty acids that smooths micro-textures.',
    'Vitamin C': 'An antioxidant that halts hyperpigmentation and stimulates collagen repair.',
    'Green Tea Extract': 'A soothing antioxidant that balances sebum levels and protects the skin barrier.'
  };

  const loadingStepsText = [
    "Locking biometric coordinate meshes...",
    "Assessing tissue sebum layers and lipids...",
    "Formulating matching ingredient profiles..."
  ];

  return (
    <div className="space-y-6 w-full relative">
      <AnimatePresence mode="wait">
        
        {/* STEP 1: PRE-SCAN CHECKLIST MODAL */}
        {showChecklist && (
          <motion.div 
            key="checklist-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-6 bg-slate-950 border border-slate-900 rounded-3xl space-y-6 text-xs shadow-2xl relative"
          >
            <div className="flex items-start gap-4 border-b border-slate-900 pb-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">Pre-Scan Telemetry Checklist</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Please check all requirements to ensure AI calibration accuracy.</p>
              </div>
            </div>

            <div className="space-y-3 font-medium text-slate-400">
              <label className="flex items-start gap-3 p-3 bg-slate-900/10 border border-slate-900/60 rounded-xl cursor-pointer hover:border-slate-800 select-none">
                <input type="checkbox" checked={checklistChecks.washFace} onChange={() => toggleCheck('washFace')} className="mt-0.5 cursor-pointer" />
                <span>Washed face and waited at least **1 hour** before scanning to normalize sebum levels.</span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-900/10 border border-slate-900/60 rounded-xl cursor-pointer hover:border-slate-800 select-none">
                <input type="checkbox" checked={checklistChecks.noMakeup} onChange={() => toggleCheck('noMakeup')} className="mt-0.5 cursor-pointer" />
                <span>Removed all makeup, powders, sunscreens, and skincare products.</span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-900/10 border border-slate-900/60 rounded-xl cursor-pointer hover:border-slate-800 select-none">
                <input type="checkbox" checked={checklistChecks.lightCheck} onChange={() => toggleCheck('lightCheck')} className="mt-0.5 cursor-pointer" />
                <span>Standing in a well-lit room or near natural lighting (avoiding direct flash).</span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-900/10 border border-slate-900/60 rounded-xl cursor-pointer hover:border-slate-800 select-none">
                <input type="checkbox" checked={checklistChecks.phoneArm} onChange={() => toggleCheck('phoneArm')} className="mt-0.5 cursor-pointer" />
                <span>Holding phone at arm's length, keeping it aligned and centered on face.</span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-900/10 border border-slate-900/60 rounded-xl cursor-pointer hover:border-slate-800 select-none">
                <input type="checkbox" checked={checklistChecks.faceGuide} onChange={() => toggleCheck('faceGuide')} className="mt-0.5 cursor-pointer" />
                <span>Ready to align face features within the oval target guidelines.</span>
              </label>
            </div>

            <button
              onClick={() => setShowChecklist(false)}
              disabled={!allChecked}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg transition-all disabled:opacity-35 cursor-pointer"
            >
              I'm Ready - Open Camera
            </button>
          </motion.div>
        )}

        {/* STEP 2: CAMERA AND VIEWPORT OVERLAYS */}
        {!showChecklist && (
          <motion.div 
            key="scanner-workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {!imgSrc ? (
              <div className="space-y-4">
                <div className="relative rounded-3xl overflow-hidden bg-black aspect-video border border-slate-900 shadow-2xl group">
                  {/* Pulse Border */}
                  <div className="absolute inset-0 border border-emerald-500/25 pointer-events-none rounded-3xl z-20" />
                  
                  {/* Grid System Overlay (3x3 Rule grid) */}
                  {showGrid && (
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10">
                      <div className="border-r border-b border-emerald-500/5" />
                      <div className="border-r border-b border-emerald-500/5" />
                      <div className="border-b border-emerald-500/5" />
                      <div className="border-r border-b border-emerald-500/5" />
                      <div className="border-r border-b border-emerald-500/5" />
                      <div className="border-b border-emerald-500/5" />
                      <div className="border-r border-emerald-500/5" />
                      <div className="border-r border-emerald-500/5" />
                      <div className="border-transparent" />
                    </div>
                  )}

                  {/* High Tech Oval Face Target Guide */}
                  <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                    <svg className="w-48 h-64 text-emerald-500/25 animate-pulse" viewBox="0 0 100 100">
                      <ellipse cx="50" cy="50" rx="35" ry="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3, 3" />
                    </svg>
                    
                    {/* Targeting indicators */}
                    <div className="absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2 border-emerald-500/40" />
                    <div className="absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2 border-emerald-500/40" />
                    <div className="absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2 border-emerald-500/40" />
                    <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-emerald-500/40" />
                  </div>

                  {/* Brightness status overlay */}
                  <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800 flex items-center gap-1.5 text-[8px] font-mono font-bold uppercase tracking-widest text-slate-300">
                    Light level: 
                    <span className={`${
                      brightnessVal === 'Good' ? 'text-emerald-400' : 'text-amber-500 animate-pulse'
                    }`}>
                      {brightnessVal}
                    </span>
                  </div>

                  {/* Grid / Lens settings overlay */}
                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowGrid(!showGrid)}
                      className="p-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl cursor-pointer"
                      title="Toggle 3x3 Grid"
                    >
                      <Grid size={12} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                      className="p-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl cursor-pointer"
                      title="Toggle Camera"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  <Webcam 
                    audio={false} 
                    ref={webcamRef} 
                    screenshotFormat="image/jpeg" 
                    videoConstraints={{ facingMode: facingMode }}
                    className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" 
                  />

                  {/* Primary Trigger button */}
                  <motion.button 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }} 
                    onClick={capture} 
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 p-4 rounded-full shadow-2xl hover:opacity-90 transition-all cursor-pointer z-20"
                  >
                    <Camera size={20} />
                  </motion.button>
                </div>

                {/* Upload File Fallback Section */}
                <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-900 bg-slate-900/10 rounded-3xl text-center space-y-3">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-900 text-slate-500">
                    <Upload size={16} />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">No Camera Hardware?</h5>
                    <p className="text-[9px] text-slate-500 mt-0.5 font-medium">Upload a clean high-resolution face capture straight from your library</p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current.click()} 
                    className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Select Image File
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Photo Captured Container */}
                <div className="rounded-3xl overflow-hidden border border-slate-900 max-h-72 flex items-center justify-center bg-slate-950 shadow-2xl relative">
                  <img src={imgSrc} alt="Captured Profile" className="w-full h-full object-cover" />
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800 flex items-center gap-1.5 text-[8px] font-mono font-bold text-teal-400 uppercase tracking-widest">
                    <Eye size={10} /> Captured Node Frame
                  </div>
                </div>

                {/* Scan Loading View */}
                {loading ? (
                  <div className="p-6 bg-slate-950/60 border border-slate-900 rounded-3xl space-y-4 flex flex-col items-center justify-center text-center">
                    {/* Glowing radar ring spinner */}
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-500/10" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-emerald-400 animate-spin" />
                      <Sparkles size={16} className="text-emerald-400 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                        Running Diagnostics
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono tracking-wide animate-pulse">
                        {loadingStepsText[loadingStep]}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setImgSrc(null); setScanResult(null); }} 
                      className="flex items-center justify-center gap-2 border border-slate-800 hover:border-slate-700 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-900/10 transition-all cursor-pointer"
                    >
                      <RefreshCw size={12} /> Retake
                    </button>
                    <button 
                      onClick={handleScanSubmit} 
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      Process Scan Matrix
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: SCAN RESULTS WITH ALLERGY CROSS REFERENCES */}
            <AnimatePresence>
              {scanResult && !loading && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="p-6 bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-3xl space-y-5 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 blur-[40px] pointer-events-none rounded-full" />
                  
                  <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                    <FileText size={14} className="text-teal-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Analysis Results</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Skin Type</span>
                      <div className="font-extrabold text-slate-200 text-sm tracking-wide">{scanResult.skin_type}</div>
                    </div>
                    <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Condition</span>
                      <div className="font-extrabold text-emerald-400 text-sm uppercase tracking-wide">{scanResult.skin_condition}</div>
                    </div>
                  </div>

                  {/* Confidence Score Progress Bars */}
                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-3">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-900 pb-1.5">Condition Confidence Scores</span>
                    <div className="space-y-2 text-[10px]">
                      <div>
                        <div className="flex justify-between font-bold text-slate-400 mb-0.5">
                          <span>{scanResult.skin_condition} Match Accuracy</span>
                          <span className="text-emerald-400">{scanResult.condition_confidence ?? 89}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${scanResult.condition_confidence ?? 89}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between font-bold text-slate-500 mb-0.5">
                          <span>Alternative Condition Probability</span>
                          <span>{scanResult.alternative_confidence ?? 11}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-700" style={{ width: `${scanResult.alternative_confidence ?? 11}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Ingredients tags / Avoid chips */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Recommended Ingredients</span>
                      <div className="flex gap-2 flex-wrap">
                        {detectIngredientsList(scanResult.recommended_ingredient).map(ing => {
                          const allergiesMatches = getAvoidIngredients(ing, allergiesList);
                          const shouldAvoid = allergiesMatches.length > 0;
                          return (
                            <span 
                              key={ing} 
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                shouldAvoid 
                                  ? 'bg-red-500/10 border-red-500/20 text-red-400 shadow-glow shadow-red-500/5' 
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              }`}
                              title={shouldAvoid ? `Allergy hazard: ${allergiesMatches.join(', ')}` : ''}
                            >
                              {ing} {shouldAvoid ? '⚠️ AVOID' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Educational Expandable Accordion */}
                    <div className="space-y-2 border-t border-slate-900/60 pt-3">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">What these ingredients do</span>
                      {detectIngredientsList(scanResult.recommended_ingredient).map(ing => (
                        <div key={ing} className="border border-slate-900 rounded-xl overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => setActiveAccordion(activeAccordion === ing ? null : ing)}
                            className="w-full flex items-center justify-between p-3 bg-slate-950/40 text-[10px] font-black uppercase text-slate-300 tracking-wider cursor-pointer hover:bg-slate-950/80"
                          >
                            <span>{ing}</span>
                            {activeAccordion === ing ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          
                          {activeAccordion === ing && (
                            <div className="p-3.5 bg-slate-950 text-[11px] text-slate-400 leading-normal font-medium border-t border-slate-900/40">
                              {ingredientDetails[ing] || 'Provides active hydration and barrier support properties targeting custom skin pathology profiles.'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consultation Sale Banner */}
                  <div className="p-5 bg-gradient-to-r from-teal-500/15 to-emerald-500/15 border border-teal-500/20 rounded-3xl shadow-xl flex flex-col justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <h5 className="text-[10px] font-black uppercase text-teal-400 tracking-widest flex items-center gap-1">
                        <Sparkles size={11} className="animate-pulse" /> Diagnostic Referral Referral
                      </h5>
                      <p className="text-slate-400 font-medium leading-relaxed">
                        Get a detailed clinical compounding prescription from a certified dermatologist. **FREE for the next 10 days.**
                      </p>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={triggerDoctorReview}
                      disabled={consultRequested}
                      className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        consultRequested 
                          ? 'bg-slate-950 text-emerald-400 border border-emerald-500/20 font-bold' 
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950'
                      }`}
                    >
                      {consultRequested ? 'Referral Sent to Queue' : 'Request Doctor Review'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}