import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({ currentUser:{uid:'admin'} as {uid:string}|null, get:vi.fn(), initializeApp:vi.fn() }));
vi.mock('../src/lib/firebase',()=>({requireFirebase:()=>({auth:{currentUser:mocks.currentUser},db:{}}),getFirebaseOptions:()=>({projectId:'demo-colima-2027'}),emulatorHost:()=> '127.0.0.1'}));
vi.mock('firebase/app',async importOriginal=>({...await importOriginal<typeof import('firebase/app')>(),initializeApp:mocks.initializeApp}));
vi.mock('firebase/database',async importOriginal=>({...await importOriginal<typeof import('firebase/database')>(),get:mocks.get,ref:vi.fn(()=>({}))}));
import { createUser } from '../src/services/users';
const input={firstName:'Ana',lastName:'Sol',email:'ana@example.com',role:'AUDITOR' as const,status:'active' as const,password:'testing-password'};
afterEach(()=>{vi.clearAllMocks();mocks.currentUser={uid:'admin'};});
describe('account creation authorization',()=>{
 it('rejects a forged actor before creating an Auth app',async()=>{await expect(createUser(input,'other')).rejects.toThrow('administrador');expect(mocks.get).not.toHaveBeenCalled();expect(mocks.initializeApp).not.toHaveBeenCalled();});
 it.each([{role:'SUPERVISOR',status:'active'},{role:'ADMINISTRADOR',status:'inactive'},null])('rejects a nonactive administrator profile: %s',async profile=>{mocks.get.mockResolvedValue({val:()=>profile});await expect(createUser(input,'admin')).rejects.toThrow('administrador');expect(mocks.initializeApp).not.toHaveBeenCalled();});
});
