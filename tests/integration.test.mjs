import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, ref, set, update, push, query, orderByChild, limitToLast, onValue, serverTimestamp, get } from 'firebase/database';
const projectId='demo-colima-2027';
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9000');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
test('Android simulado: Auth, perfil, lectura en vivo, consulta, revocación', async () => {
 const seedUrl=`http://127.0.0.1:9000/.json?ns=${projectId}-default-rtdb`;
 async function seed(value){const response=await fetch(seedUrl,{method:'PUT',headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(value)});assert.equal(response.status,200);}
 const clients=[]; const disposers=[];
 function client(name){const app=initializeApp({apiKey:'demo-key',projectId,databaseURL:`https://${projectId}-default-rtdb.firebaseio.com`},name);clients.push(app);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const db=getDatabase(app);connectDatabaseEmulator(db,'127.0.0.1',9000);return {app,auth,db};}
 try {
  await seed(null);
  const admin=client('integration-admin');const android=client('integration-android');
  const password=`Test-${crypto.randomUUID()}`;
  const adminCredential=await createUserWithEmailAndPassword(admin.auth,`admin-${Date.now()}@example.test`,password);
  const validatorCredential=await createUserWithEmailAndPassword(android.auth,`validator-${Date.now()}@example.test`,password);
  const adminUid=adminCredential.user.uid;const validatorUid=validatorCredential.user.uid;
  const profile=(email,role)=>({firstName:'Prueba',lastName:'Emulador',email,role,status:'active',createdAt:Date.now(),updatedAt:Date.now(),createdBy:adminUid});
  await seed({users:{[adminUid]:profile(adminCredential.user.email,'ADMINISTRADOR'),[validatorUid]:profile(validatorCredential.user.email,'VALIDADOR')}});
  const destination=push(ref(android.db,'validations'));
  const received=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No llegó la lectura al listener administrativo')),10000);const stop=onValue(query(ref(admin.db,'validations'),orderByChild('timestamp'),limitToLast(500)),snapshot=>{if(snapshot.hasChild(destination.key)){clearTimeout(timer);resolve(snapshot.child(destination.key).val());}},reject);disposers.push(()=>{clearTimeout(timer);stop();});});
  await set(destination,{userId:validatorUid,folio:'COL-INTEGRACION-2027',documentType:'engomado_vehicular',elementType:'qr_vehicular',reportedResult:'valid',timestamp:serverTimestamp(),application:'mx.colima.android.simulado',appVersion:'test-1'});
  const event=await received;
  assert.equal(event.userId,validatorUid);assert.equal(event.reportedResult,'valid');assert.equal(typeof event.timestamp,'number');
  assert.equal((await get(destination)).val().folio,'COL-INTEGRACION-2027');
  await assert.rejects(set(destination,{...event,reportedResult:'invalid'}),/permission_denied/i);
  const audit=push(ref(admin.db,'auditLogs'));
  await update(ref(admin.db),{[`users/${validatorUid}/status`]:'inactive',[`users/${validatorUid}/updatedAt`]:serverTimestamp(),[`auditLogs/${audit.key}`]:{actorUid:adminUid,action:'user.update',targetId:validatorUid,timestamp:serverTimestamp(),details:'Desactivación de prueba'}});
  await assert.rejects(set(push(ref(android.db,'validations')),{...event,timestamp:serverTimestamp()}),/permission_denied/i);
  await signOut(android.auth);await signOut(admin.auth);
 }finally{disposers.forEach(stop=>stop());await Promise.all(clients.map(app=>deleteApp(app)));await seed(null);}
});
