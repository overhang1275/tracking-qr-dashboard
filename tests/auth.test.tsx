import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),update:vi.fn(),signOut:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../src/lib/firebase',()=>({getFirebase:()=>({auth:{},db:{}}),requireFirebase:()=>({auth:{},db:{}})}));
vi.mock('firebase/auth',()=>({browserLocalPersistence:{},onAuthStateChanged:()=>()=>{},setPersistence:vi.fn().mockResolvedValue(undefined),signInWithEmailAndPassword:vi.fn().mockResolvedValue({user:{uid:'user'}}),signOut:mocks.signOut,sendPasswordResetEmail:vi.fn()}));
vi.mock('firebase/database',()=>({get:mocks.get,update:mocks.update,ref:vi.fn(()=>({})),serverTimestamp:()=>({'.sv':'timestamp'}),onValue:vi.fn()}));
import { AuthProvider, useAuth } from '../src/hooks/use-auth';
afterEach(()=>vi.clearAllMocks());
describe('institutional login denial',()=>{
 it.each([null,{status:'inactive'}])('clears session for missing or inactive profile: %s',async profile=>{
  mocks.get.mockResolvedValue({val:()=>profile});
  const {result}=renderHook(()=>useAuth(),{wrapper:AuthProvider});
  await act(async()=>{await expect(result.current.login('ana@example.com','password')).rejects.toThrow('acceso institucional');});
  expect(mocks.signOut).toHaveBeenCalledOnce();expect(mocks.update).not.toHaveBeenCalled();expect(result.current.user).toBeNull();expect(result.current.profile).toBeNull();expect(result.current.loading).toBe(false);expect(result.current.error).toContain('administrador');
 });
 it('signs out when profile lookup is denied',async()=>{
  mocks.get.mockRejectedValue(new Error('PERMISSION_DENIED'));
  const {result}=renderHook(()=>useAuth(),{wrapper:AuthProvider});
  await act(async()=>{await expect(result.current.login('ana@example.com','password')).rejects.toThrow('acceso institucional');});
  expect(mocks.signOut).toHaveBeenCalledOnce();expect(result.current.loading).toBe(false);
 });
});
