import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDn5ec0O3WdbzN1nsxtS2BwZXjvWOp4Hsc",
  authDomain: "swift-byte-3n50x.firebaseapp.com",
  projectId: "swift-byte-3n50x",
  storageBucket: "swift-byte-3n50x.firebasestorage.app",
  messagingSenderId: "77189971036",
  appId: "1:77189971036:web:38986bacdbf9ef691b7a99"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connect to the specific Firestore database ID that was provisioned
const db = initializeFirestore(app, {}, "ai-studio-b8960489-482a-4b4d-b1ef-6bc37d9b3e1f");

// Enable multi-tab offline persistence for drivers operating in areas with poor mobile network
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed-precondition: Multiple tabs open?');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence unimplemented in this browser.');
    }
  });
} catch (e) {
  console.error('Error enabling Firestore persistence:', e);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { db, auth };

