// fileName: auth.js

import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from './firebase.js';
import { loadUserData } from './api.js';
import { loadGuestData, clearUserCart, updateCartCount, updateCouponStatusFromServer } from './cart.js';
import { clearUserFavorites } from './favorites.js';
import { clearUserOrders } from './orders.js';

let currentUser = null;

export function getCurrentUser() {
    console.log('getCurrentUser called, currentUser:', currentUser ? { uid: currentUser.uid, email: currentUser.email } : 'null');
    return currentUser;
}

// initializeAuth is now leaner
export function initializeAuth(onAuthChangeCallback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // التحقق من حالة التحقق من البريد الإلكتروني
            if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
                // تسجيل الخروج من الحسابات غير المحققة
                await signOut(auth);
                currentUser = null;
                // إظهار رسالة للمستخدم
                if (onAuthChangeCallback) {
                    onAuthChangeCallback(null, 'EMAIL_NOT_VERIFIED');
                }
                return;
            }
            
            currentUser = user;
            await loadUserData(user.uid);
            
            // تحديث حالة الكوبونات من الخادم عند تسجيل الدخول
            try {
                await updateCouponStatusFromServer(user.uid);
            } catch (error) {
                console.error('خطأ في تحديث حالة الكوبونات:', error);
            }
        } else {
            // Clear all user-specific data from state
            clearUserCart();
            clearUserFavorites();
            clearUserOrders();
            // Load any guest data from localStorage
            loadGuestData();
        }
        // This callback handles UI updates and routing
        if (onAuthChangeCallback) {
            onAuthChangeCallback(user);
        }
    });
}

// Auth functions now just return the promise from Firebase
export async function handleLogin(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // التحقق من حالة التحقق من البريد الإلكتروني
    if (!user.emailVerified) {
        // تسجيل الخروج فوراً إذا لم يتم التحقق
        await signOut(auth);
        throw new Error('EMAIL_NOT_VERIFIED');
    }
    
    return userCredential;
}

export async function handleSignup(email, password, displayName) {
    try {
        // محاولة إنشاء الحساب
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // تحديث اسم المستخدم
        if (displayName) {
            await updateProfile(user, {
                displayName: displayName
            });
        }
        
        // إرسال رسالة التحقق
        await sendEmailVerification(user);
        
        return userCredential;
    } catch (error) {
        // إذا كان البريد مستخدم بالفعل
        if (error.code === 'auth/email-already-in-use') {
            // محاولة تسجيل الدخول بالبريد الموجود
            try {
                const signInResult = await signInWithEmailAndPassword(auth, email, password);
                const existingUser = signInResult.user;
                
                // إذا لم يتم التحقق من البريد، قم بتحديث كلمة المرور وإرسال رسالة تحقق جديدة
                if (!existingUser.emailVerified) {
                    // تحديث كلمة المرور
                    await updatePassword(existingUser, password);
                    
                    // تحديث اسم المستخدم إذا كان مختلفاً
                    if (displayName && existingUser.displayName !== displayName) {
                        await updateProfile(existingUser, {
                            displayName: displayName
                        });
                    }
                    
                    // إرسال رسالة تحقق جديدة
                    await sendEmailVerification(existingUser);
                    
                    // تسجيل الخروج لإجبار المستخدم على التحقق
                    await signOut(auth);
                    
                    throw new Error('EMAIL_NOT_VERIFIED_UPDATED');
                } else {
                    // إذا كان الحساب محقق بالفعل، قم بتسجيل الخروج ورمي خطأ
                    await signOut(auth);
                    throw new Error('EMAIL_ALREADY_VERIFIED');
                }
            } catch (signInError) {
                // إذا فشل تسجيل الدخول، فهذا يعني أن كلمة المرور مختلفة
                throw new Error('EMAIL_EXISTS_DIFFERENT_PASSWORD');
            }
        }
        
        throw error;
    }
}

export function handleGoogleSignIn() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
}

export function handleLogout() {
    return signOut(auth);
}

// دالة للتحقق من حالة التحقق من البريد الإلكتروني
export function isEmailVerified() {
    return currentUser && currentUser.emailVerified;
}

// دالة لإعادة إرسال رسالة التحقق
export async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
        return sendEmailVerification(user);
    }
    return Promise.reject(new Error('لا يمكن إرسال رسالة التحقق'));
}

// دالة لتغيير اسم المستخدم
export async function changeDisplayName(newName) {
    if (!currentUser) {
        throw new Error('لا يوجد مستخدم مسجل');
    }
    
    await updateProfile(currentUser, {
        displayName: newName
    });
    
    return currentUser;
}

// دالة لتغيير كلمة المرور
export async function changePassword(currentPassword, newPassword) {
    if (!currentUser) {
        throw new Error('لا يوجد مستخدم مسجل');
    }
    
    if (!currentUser.email) {
        throw new Error('لا يمكن تغيير كلمة المرور لحساب Google');
    }
    
    // إعادة المصادقة
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    
    // تغيير كلمة المرور
    await updatePassword(currentUser, newPassword);
    
    return currentUser;
}

// دالة للتحقق من نوع الحساب
export function isGoogleAccount() {
    return currentUser && currentUser.providerData[0]?.providerId === 'google.com';
}

// دالة للتحقق من إمكانية تغيير كلمة المرور
export function canChangePassword() {
    return currentUser && currentUser.providerData[0]?.providerId === 'password';
}