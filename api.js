// fileName: api.js (النسخة الكاملة والمُصححة)

import { db } from './firebase.js';
// --- بداية قسم الاستيراد (Import) ---
// تم دمج كل دوال Firestore في سطر واحد لتجنب الأخطاء
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    query,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { updateCartOnLoad } from './cart.js';
import { updateFavoritesOnLoad } from './favorites.js';
import { updateOrdersOnLoad } from './orders.js';
import { renderFeaturedProducts } from './ui.js';


// --- بداية قسم المتغيرات العامة ---
export let products = [];
export let categories = [];
export let coupons = {};
export let lastOrderId = 0;
export let currentUserData = null; // لإدارة بيانات المستخدم


// --- بداية قسم دوال تحميل البيانات الأولية ---
export async function loadProducts() {
    products = [];
    const querySnapshot = await getDocs(collection(db, "products"));
    querySnapshot.forEach(doc => {
        products.push({ id: doc.id, ...doc.data() });
        renderFeaturedProducts(); // تحديث الواجهة مع كل منتج
    });
}

export async function loadCategories() {
    try {
        categories = [];
        const querySnapshot = await getDocs(collection(db, "categories"));
        querySnapshot.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
        console.log(`تم تحميل ${categories.length} تصنيف بنجاح`);
    } catch (error) {
        console.error('خطأ في تحميل التصنيفات:', error);
        categories = [];
    }
}

export async function loadCoupons() {
    coupons = {};
    const querySnapshot = await getDocs(collection(db, "coupons"));
    querySnapshot.forEach(doc => { 
        const couponData = doc.data();
        // تحميل فقط الكوبونات النشطة
        if (couponData.active !== false) {
            coupons[doc.id] = { id: doc.id, ...couponData }; 
        }
    });
    
    // تنظيف localStorage من الكوبونات المحذوفة
    cleanupDeletedCoupons();
}

// دالة لتنظيف localStorage من الكوبونات المحذوفة
function cleanupDeletedCoupons() {
    try {
        const keys = Object.keys(localStorage);
        const validCouponCodes = Object.values(coupons).map(coupon => coupon.code);
        
        keys.forEach(key => {
            if (key.startsWith('used_coupons_')) {
                const usedCoupons = JSON.parse(localStorage.getItem(key) || '{}');
                let hasChanges = false;
                
                // حذف الكوبونات التي لم تعد موجودة في قاعدة البيانات
                Object.keys(usedCoupons).forEach(couponCode => {
                    if (!validCouponCodes.includes(couponCode)) {
                        delete usedCoupons[couponCode];
                        hasChanges = true;
                        console.log(`تم حذف كوبون محذوف من localStorage: ${couponCode}`);
                    }
                });
                
                // حفظ التغييرات إذا كان هناك حذف
                if (hasChanges) {
                    localStorage.setItem(key, JSON.stringify(usedCoupons));
                }
            }
        });
    } catch (error) {
        console.error('خطأ في تنظيف الكوبونات المحذوفة:', error);
    }
}

async function loadLastOrderId() {
    const docSnap = await getDoc(doc(db, "meta", "lastOrderId"));
    lastOrderId = docSnap.exists() ? (docSnap.data().value || 10000) : 10000;
}

export async function updateLastOrderId(newId) {
    try {
        await setDoc(doc(db, "meta", "lastOrderId"), { value: newId });
        lastOrderId = newId;
    } catch (e) {
        console.error("Failed to update last order ID:", e);
        lastOrderId = Math.floor(10000 + Math.random() * 89999);
    }
}

export async function loadUserData(userId) {
    if (!userId) {
        currentUserData = null;
        return;
    }
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
        currentUserData = userDocSnap.data();
    } else {
        currentUserData = {};
    }

    const cartDocSnap = await getDoc(doc(userDocRef, "cart", "cart"));
    const favDocSnap = await getDoc(doc(userDocRef, "favorites", "favorites"));
    const ordersSnapshot = await getDocs(collection(db, "orders"));

    const userCart = cartDocSnap.exists() ? cartDocSnap.data().items : [];
    const userFavorites = favDocSnap.exists() ? favDocSnap.data().items : [];
    const userOrders = [];
    ordersSnapshot.forEach(orderDoc => {
        if (orderDoc.data().userId === userId) {
            userOrders.push({ id: orderDoc.id, ...orderDoc.data() });
        }
    });

    // تنظيف الكوبونات المحذوفة من localStorage للمستخدم الحالي
    cleanupDeletedCoupons();

    updateCartOnLoad(userCart);
    updateFavoritesOnLoad(userFavorites);
    updateOrdersOnLoad(userOrders);
}

export async function loadInitialData() {
    await loadProducts();
    await loadCategories();
    await loadCoupons();
    await loadLastOrderId();
    
    // تنظيف الكوبونات المحذوفة من localStorage لجميع المستخدمين
    cleanupDeletedCoupons();
    
    // تحديث حالة الكوبونات من الخادم لجميع المستخدمين
    try {
        const keys = Object.keys(localStorage);
        const userKeys = keys.filter(key => key.startsWith('used_coupons_'));
        
        for (const userKey of userKeys) {
            const userId = userKey.replace('used_coupons_', '');
            try {
                const { updateCouponStatusFromServer } = await import('./cart.js');
                await updateCouponStatusFromServer(userId);
            } catch (error) {
                console.error(`خطأ في تحديث حالة الكوبونات للمستخدم ${userId}:`, error);
            }
        }
    } catch (error) {
        console.error('خطأ في تحديث حالة الكوبونات:', error);
    }
}


// --- بداية قسم دوال حفظ البيانات ---
export async function saveShippingData(userId, data) {
    if (!userId) return;
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, data, { merge: true });
    currentUserData = { ...currentUserData, ...data };
}

export async function saveCartToDB(userId, cart) {
    if (!userId) return;
    await setDoc(doc(db, "users", userId, "cart", "cart"), { items: cart });
}

export async function saveFavoritesToDB(userId, favorites) {
    if (!userId) return;
    await setDoc(doc(db, "users", userId, "favorites", "favorites"), { items: favorites });
}

export async function createOrderInDB(order) {
    return await addDoc(collection(db, "orders"), order);
}

export async function cancelOrderInDB(orderId) {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, { status: "cancelled" });
}


// --- بداية قسم دوال المراجعات (Reviews) ---
export async function getReviewsForProduct(productId) {
    try {
        console.log('getReviewsForProduct called for product:', productId);
        const reviews = [];
        const reviewsRef = collection(db, 'products', productId, 'reviews');
        const q = query(reviewsRef);
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            reviews.push({ id: doc.id, ...doc.data() });
        });
        console.log('Reviews fetched:', reviews.length, 'reviews');
        return reviews;
    } catch (error) {
        console.error('Error fetching reviews for product:', productId, error);
        return [];
    }
}

export async function addReview(productId, reviewData) {
    try {
        console.log('addReview called with:', { productId, reviewData });
        
        // التحقق من صحة البيانات
        if (!productId) {
            throw new Error('Product ID is required');
        }
        if (!reviewData || !reviewData.userId) {
            throw new Error('Review data and user ID are required');
        }
        if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
            throw new Error('Valid rating (1-5) is required');
        }
        
        const reviewsRef = collection(db, 'products', productId, 'reviews');
        console.log('Reviews collection reference created');
        
        // إضافة timestamp
        reviewData.createdAt = serverTimestamp();
        console.log('Review data with timestamp:', reviewData);
        
        const result = await addDoc(reviewsRef, reviewData);
        console.log('Review added to Firestore:', result);
        
        return result;
    } catch (error) {
        console.error('Error in addReview:', error);
        throw error;
    }
}

export async function deleteReview(productId, reviewId) {
    const reviewRef = doc(db, 'products', productId, 'reviews', reviewId);
    return await deleteDoc(reviewRef);
}

// --- بداية قسم دوال بيانات العميل ---
export async function saveCustomerDataToDB(userId, customerData) {
    if (!userId) return;
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, { customerData }, { merge: true });
}

export async function getCustomerDataFromDB(userId) {
    if (!userId) return null;
    try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            return userData.customerData || null;
        }
        return null;
    } catch (error) {
        console.error('خطأ في جلب بيانات العميل:', error);
        return null;
    }
}