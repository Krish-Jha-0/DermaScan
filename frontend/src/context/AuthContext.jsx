"use client";
import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // ------------------------------------------------------------------
          // CRITICAL MASTER OVERRIDE GATES FOR ADMIN EMAILS
          // ------------------------------------------------------------------
          const ADMIN_EMAILS = ['krish.jha.1909@gmail.com', 'thakurriteesh124@gmail.com', 'shreyashdivekar32@gmail.com'];

          if (firebaseUser.email && ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())) {
            console.log("[✓] Admin Email Detected. Forcing Admin Node Credentials Token.");
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'admin',      // Strictly hardcoded to bypass Firestore query drops
              status: 'active',
              username: 'System Admin'
            });
            setLoading(false);
            return;
          }

          // Standard Operational Pipeline for regular Patients/Doctors
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: userData.role || 'patient',
              status: userData.status || 'active',
              username: userData.username || userData.name || 'User'
            });
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'patient',
              status: 'active',
              username: 'User'
            });
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth System Initialization Error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginUser = async (email, password) => {
    setLoading(true);
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const registerPatient = async (email, password, username, additionalData = {}) => {
    setLoading(true);
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', credential.user.uid), {
      username,
      email,
      role: 'patient',
      status: 'active',
      createdAt: serverTimestamp(),
      ...additionalData
    });
  };

  const registerDermatologist = async (email, password, name, additionalData = {}) => {
    setLoading(true);
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', credential.user.uid), {
      name,
      email,
      role: 'dermat',
      status: 'pending',
      createdAt: serverTimestamp(),
      ...additionalData
    });
  };

  const logoutUser = async () => {
    setUser(null);
    setLoading(false);
    // Wait for React to unmount components and unsubscribe from Firestore listeners
    await new Promise((resolve) => setTimeout(resolve, 100));
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, registerPatient, registerDermatologist, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);