'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Clear previous subscription data whenever access or query scope changes. */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { browserLocalPersistence, onAuthStateChanged, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { get, onValue, ref, update, serverTimestamp } from 'firebase/database';
import { getFirebase, requireFirebase } from '../lib/firebase';
import type { UserProfile } from '../types';
interface AuthState { user:User|null; profile:UserProfile|null; loading:boolean; error:string|null; configured:boolean; login:(email:string,password:string)=>Promise<void>; logout:()=>Promise<void>; resetPassword:(email:string)=>Promise<void> }
const AuthContext=createContext<AuthState|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
 const [user,setUser]=useState<User|null>(null); const [profile,setProfile]=useState<UserProfile|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [configured,setConfigured]=useState(false); const profileSubscription=useRef<null|(()=>void)>(null);
 useEffect(()=>{
  let client:ReturnType<typeof getFirebase>;
  try {client=getFirebase();} catch(err){setError(err instanceof Error?err.message:'Configuración no válida');setLoading(false);return;}
  setConfigured(Boolean(client)); if(!client){setLoading(false);return;}
  let active=true;
  const stopAuth=onAuthStateChanged(client.auth,current=>{
   profileSubscription.current?.();profileSubscription.current=null;setUser(null);setProfile(null);
   if(!current){setLoading(false);return;}
   setLoading(true);
   profileSubscription.current=onValue(ref(client.db,`users/${current.uid}`),snapshot=>{
    if(!active || client.auth.currentUser?.uid!==current.uid) return;
    const value=snapshot.val() as UserProfile|null;
    if(!value || value.status!=='active') {setError('Tu cuenta no tiene acceso activo. Contacta a un administrador.');setUser(null);setProfile(null);setLoading(false);void signOut(client.auth).catch(()=>{});return;}
    setUser(current);setProfile({...value,uid:current.uid});setLoading(false);
   },()=>{if(active){setError('No fue posible verificar tu acceso institucional. Contacta a un administrador.');setUser(null);setProfile(null);setLoading(false);void signOut(client.auth).catch(()=>{});}});
  },()=>{if(active){setError('No fue posible iniciar la sesión.');setLoading(false);}});
  return ()=>{active=false;profileSubscription.current?.();profileSubscription.current=null;stopAuth();};
 },[]);
 async function login(email:string,password:string){
  setError(null);const {auth,db}=requireFirebase();await setPersistence(auth,browserLocalPersistence);
  const credential=await signInWithEmailAndPassword(auth,email.trim(),password);
  try{
   const snapshot=await get(ref(db,`users/${credential.user.uid}`));
   if(snapshot.val()?.status!=='active')throw new Error('Acceso inactivo');
   await update(ref(db,`users/${credential.user.uid}`),{lastAccess:serverTimestamp()});
  }catch{
   const message='Tu cuenta no tiene acceso institucional activo o no fue posible verificarlo. Contacta a un administrador.';
   profileSubscription.current?.();profileSubscription.current=null;setUser(null);setProfile(null);setLoading(false);setError(message);
   await signOut(auth);throw new Error(message);
  }
 }
 async function logout(){profileSubscription.current?.();profileSubscription.current=null;setUser(null);setProfile(null);await signOut(requireFirebase().auth);}
 async function resetPassword(email:string){await sendPasswordResetEmail(requireFirebase().auth,email.trim());}
 return <AuthContext.Provider value={{user,profile,loading,error,configured,login,logout,resetPassword}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth requiere AuthProvider');return value;}
