// ══════════════════════════════════════════════════════════════════
//  VAGT AUTH UTILITIES — vagt-auth.js
//  Shared across all portal pages. Handles:
//    - requireAuth(role, loginUrl)  → protect dashboard pages
//    - loginWithRole(email, pass, expectedRole, loginUrl) → protect login pages
//    - signOutUser(redirectUrl)
//    - createUserProfile(uid, data)  → admin creates new accounts
//    - getUserProfile(uid)
// ══════════════════════════════════════════════════════════════════

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────────
// requireAuth(requiredRole, loginUrl)
//
// Call at the top of every dashboard page script.
// Waits for Firebase auth state, fetches Firestore profile,
// checks role === requiredRole, and resolves with { user, profile }.
// Redirects to loginUrl on any failure.
//
// Usage:
//   const { user, profile } = await requireAuth('employee', 'employee-portal.html');
//   document.getElementById('user-name').textContent = profile.name;
// ─────────────────────────────────────────────────────────────────
export function requireAuth(requiredRole, loginUrl) {
  return new Promise((resolve) => {
    // Wait for Firebase to restore persisted auth state before acting.
    // unsubscribe after first settled state to avoid double-firing.
    let settled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!settled) {
        settled = true;
        unsub();
      } else {
        return;
      }

      if (!user) {
        window.location.replace(loginUrl);
        return;
      }

      try {
        const ref  = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await signOut(auth);
          window.location.replace(loginUrl + '?error=no_profile');
          return;
        }

        const profile = snap.data();

        if (!profile.role) {
          await signOut(auth);
          window.location.replace(loginUrl + '?error=no_profile');
          return;
        }
        if (profile.role !== requiredRole) {
          await signOut(auth);
          window.location.replace(loginUrl + '?error=wrong_role');
          return;
        }
        if (profile.active === false) {
          await signOut(auth);
          window.location.replace(loginUrl + '?error=inactive');
          return;
        }

        // Employee-only: redirect to onboarding wizard if profile not yet complete
        if (profile.role === 'employee' && !profile.profileComplete) {
          // Only redirect if we're NOT already on the onboard page
          if (!window.location.pathname.includes('employee-onboard')) {
            window.location.replace('employee-onboard.html');
            return;
          }
        }

        resolve({ user, profile });

      } catch (err) {
        // Firestore read failed — log the real error so it shows in DevTools
        console.error('[VAGT Auth] requireAuth Firestore error:', err.code, err.message);
        // Don't redirect on network errors — show inline message instead
        if (err.code === 'permission-denied') {
          window.location.replace(loginUrl + '?error=permission');
          return;
        }
        window.location.replace(loginUrl);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// loginWithRole(auth, email, pass, expectedRole, successUrl, onError)
//
// Called from login page submit handlers.
// Signs in with Firebase, checks Firestore role, then redirects.
//
// Usage (in employee-portal.html):
//   import { loginWithRole } from "../assets/js/vagt-auth.js";
//   loginWithRole(email, pass, 'employee', 'employee-dashboard.html', msg => showError(msg));
// ─────────────────────────────────────────────────────────────────
export async function loginWithRole(email, password, expectedRole, successUrl, onError) {
  const { signInWithEmailAndPassword } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");

  const FIREBASE_ERRORS = {
    'auth/user-not-found':   'No account found with that email.',
    'auth/wrong-password':   'Incorrect password. Please try again.',
    'auth/invalid-email':    'Please enter a valid email address.',
    'auth/too-many-requests':'Too many attempts. Please wait a few minutes.',
    'auth/invalid-credential':'Invalid email or password.',
    'auth/user-disabled':    'This account has been disabled. Contact VAGT admin.',
  };

  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);

    // Check Firestore profile
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      await signOut(auth);
      onError('Your account is not set up yet. Contact your VAGT admin.');
      return;
    }
    const profile = snap.data();
    if (profile.role !== expectedRole) {
      await signOut(auth);
      const portalName = expectedRole === 'employee' ? 'employee portal' :
                         expectedRole === 'client'   ? 'client portal'   : 'admin panel';
      onError(`This account does not have access to the ${portalName}.`);
      return;
    }
    if (profile.active === false) {
      await signOut(auth);
      onError('Your account is currently inactive. Contact your VAGT admin.');
      return;
    }

    // All good — redirect
    window.location.href = successUrl;

  } catch (err) {
    onError(FIREBASE_ERRORS[err.code] || 'Sign in failed. Please try again.');
  }
}

// ─────────────────────────────────────────────────────────────────
// signOutUser(redirectUrl)  — call from sign out buttons
// ─────────────────────────────────────────────────────────────────
export async function signOutUser(redirectUrl) {
  try { await signOut(auth); } catch (_) {}
  window.location.href = redirectUrl;
}

// ─────────────────────────────────────────────────────────────────
// getUserProfile(uid)  → Firestore profile object or null
// ─────────────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

// ─────────────────────────────────────────────────────────────────
// createUserProfile(uid, data)
// Admin only — creates a users/{uid} document in Firestore.
// data should include: role, name, email, active, + role-specific fields
// ─────────────────────────────────────────────────────────────────
export async function createUserProfile(uid, data, createdByUid) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: createdByUid || null,
  });
}

// ─────────────────────────────────────────────────────────────────
// getUsersByRole(role)  → array of profiles (admin only)
// ─────────────────────────────────────────────────────────────────
export async function getUsersByRole(role) {
  const q = query(collection(db, 'users'), where('role', '==', role));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────────
// checkSetupRequired()
// Returns true if zero admin users exist in Firestore.
// Used by admin-setup.html to allow first-time admin creation.
// ─────────────────────────────────────────────────────────────────
export async function checkSetupRequired() {
  const q = query(collection(db, 'users'), where('role', '==', 'admin'), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
}

// ─────────────────────────────────────────────────────────────────
// handleAuthError(urlParam)  → user-friendly string for ?error= params
// ─────────────────────────────────────────────────────────────────
export function handleAuthError() {
  const params = new URLSearchParams(window.location.search);
  const errors = {
    'no_profile':  'Your account has not been set up yet. Contact your VAGT admin.',
    'wrong_role':  'This account does not have access to this portal.',
    'inactive':    'Your account is currently inactive. Contact your VAGT admin.',
    'permission':  'Access denied. Please check your account with your VAGT admin.',
  };
  return errors[params.get('error')] || null;
}
