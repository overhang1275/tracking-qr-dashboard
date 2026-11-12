'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Clear previous subscription data whenever access or query scope changes. */
import { useEffect, useState } from 'react';
import { limitToLast, onValue, orderByChild, query, ref } from 'firebase/database';
import { getFirebase } from '../lib/firebase';
import type { AuditLog } from '../types';
import { useAuth } from './use-auth';
export function useAuditLogs(){const {profile}=useAuth();const [rows,setRows]=useState<AuditLog[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);useEffect(()=>{setRows([]);setError(null);if(!profile || profile.role==='VALIDADOR'){setLoading(false);return;}const client=getFirebase();if(!client)return;setLoading(true);return onValue(query(ref(client.db,'auditLogs'),orderByChild('timestamp'),limitToLast(500)),snapshot=>{const result:AuditLog[]=[];snapshot.forEach(child=>{result.push({...child.val(),id:child.key});});setRows(result.reverse());setLoading(false);},()=>{setRows([]);setError('No fue posible cargar la auditoría.');setLoading(false);});},[profile]);return {rows,loading,error,truncated:rows.length===500};}
