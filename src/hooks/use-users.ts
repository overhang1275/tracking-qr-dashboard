'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Clear previous subscription data whenever access or query scope changes. */
import { useEffect, useState } from 'react';
import { limitToFirst, onValue, orderByKey, query, ref } from 'firebase/database';
import { getFirebase } from '../lib/firebase';
import type { UserProfile } from '../types';
import { useAuth } from './use-auth';
export function useUsers(){const {profile}=useAuth();const [rows,setRows]=useState<UserProfile[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);useEffect(()=>{setRows([]);setError(null);if(profile?.role!=='ADMINISTRADOR'){setLoading(false);return;}const client=getFirebase();if(!client)return;setLoading(true);return onValue(query(ref(client.db,'users'),orderByKey(),limitToFirst(200)),snapshot=>{const result:UserProfile[]=[];snapshot.forEach(child=>{result.push({...child.val(),uid:child.key});});setRows(result);setLoading(false);},()=>{setRows([]);setError('No fue posible cargar los usuarios.');setLoading(false);});},[profile]);return {rows,loading,error,truncated:rows.length===200};}
