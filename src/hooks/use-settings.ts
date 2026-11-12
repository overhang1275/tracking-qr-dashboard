'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Clear previous subscription data whenever access or query scope changes. */
import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getFirebase } from '../lib/firebase';
import type { ApplicationSettings } from '../types';
import { useAuth } from './use-auth';
export function useSettings(){const {profile}=useAuth();const [settings,setSettings]=useState<ApplicationSettings|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);useEffect(()=>{setSettings(null);setError(null);if(!profile){setLoading(false);return;}const client=getFirebase();if(!client)return;setLoading(true);return onValue(ref(client.db,'settings/institution'),snapshot=>{setSettings(snapshot.val());setLoading(false);},()=>{setError('No fue posible cargar la configuración.');setLoading(false);});},[profile]);return {settings,loading,error};}
