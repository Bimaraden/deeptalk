/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  collection,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  DocumentData,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Database ID is required for custom provisioned databases in AI Studio
<<<<<<< Updated upstream
const rawConfig = firebaseConfig as any;
const getNestedValue = (obj: any, key: string): any => {
  if (!obj) return undefined;
  if (obj[key]) return obj[key];
  if (obj.default && obj.default[key]) return obj.default[key];
  return undefined;
};

const databaseId = getNestedValue(rawConfig, 'firestoreDatabaseId');

if (typeof window !== 'undefined') {
  (window as any)._firebaseConfig = rawConfig;
}

if (!databaseId) {
  console.warn('Firebase config keys:', Object.keys(rawConfig));
  console.error('CRITICAL: firestoreDatabaseId NOT found in firebase-applet-config.json');
=======
const databaseId = (firebaseConfig as any).firestoreDatabaseId;
if (!databaseId) {
  console.warn('firestoreDatabaseId not found in config. Keys present:', Object.keys(firebaseConfig));
  console.warn('Falling back to (default)');
>>>>>>> Stashed changes
} else {
  console.log('Initializing Firestore with databaseId:', databaseId);
}

export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

/**
 * Operation types for Firestore error reporting.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Detailed error info for diagnostics.
 */
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

/**
 * Standard error handler for Firestore operations.
 * Throws a JSON string error message for system diagnostics.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Initialize anonymous session.
 */
export async function initAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      if (error.code === 'auth/admin-restricted-operation') {
        console.warn('Anonymous auth is disabled. Please enable it in the Firebase Console or use Google Login.');
      } else {
        console.error('Auth error:', error);
      }
      throw error;
    }
  }
}

/**
 * Sign in with Google.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

/**
 * Test connection to Firestore.
 */
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Initial connection test
testConnection();
