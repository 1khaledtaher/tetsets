import { products, coupons, lastOrderId, updateLastOrderId, saveCartToDB, createOrderInDB } from './api.js';
import { showToast } from './ui.js';
import { getCurrentUser } from './auth.js';
import { addOrder } from './orders.js';
import { isCustomerDataComplete, customerData, loadCustomerData, saveCustomerData } from './customer-data.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export let cart = [];
let lastOrderTime = 0;
let lastCartAction = { id: '', action: '', time: 0 };
let cartPageInitialized = false;

export function clearUserCart() {
    cart = [];
    updateCartCount();
    // تحديث الإجمالي بعد مسح السلة
    updateCartTotal();
}

export function loadGuestData() {
    cart = JSON.parse(localStorage.getItem('cart_guest')) || [];
    updateCartCount();
    // تحديث الإجمالي بعد تحميل بيانات الضيف
    updateCartTotal();
}

export function updateCartOnLoad(userCart) {
    cart = userCart;
    updateCartCount();
    // تحديث الإجمالي بعد تحميل السلة
    setTimeout(() => {
        updateCartTotal();
    }, 100);
}

async function saveCart() {
    try {
        const user = getCurrentUser();
        if (user) {
            await saveCartToDB(user.uid, cart);
        } else {
            localStorage.setItem('cart_guest', JSON.stringify(cart));
        }
        updateCartCount();
    } catch (error) {
        console.error('خطأ في حفظ السلة:', error);
        // في حالة فشل الحفظ في قاعدة البيانات، احفظ في localStorage كنسخة احتياطية
        localStorage.setItem('cart_guest', JSON.stringify(cart));
        updateCartCount();
    }
}

export function updateCartCount() {
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        cartCountEl.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    }
}

export async function addToCart(productId, fromDetails = false, selectedSize = null) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // تحديد الحجم والسعر
    let productName = product.name || 'منتج غير محدد';
    let productPrice = product.price || 0;
    let sizeName = '';
    
    if (product.sizes && product.sizes.length > 0) {
        // إذا كان المنتج يحتوي على أحجام متعددة
        if (selectedSize && selectedSize >= 0 && selectedSize < product.sizes.length) {
            // استخدام الحجم المحدد
            const size = product.sizes[selectedSize];
            productPrice = size.discount && size.discount > 0 ? size.discount : size.price;
            sizeName = size.name;
            productName = `${product.name} - ${size.name}`;
        } else {
            // استخدام الحجم الأساسي (الأول)
            const firstSize = product.sizes[0];
            productPrice = firstSize.discount && firstSize.discount > 0 ? firstSize.discount : firstSize.price;
            sizeName = firstSize.name;
            productName = `${product.name} - ${firstSize.name}`;
        }
    } else {
        // النظام القديم - منتج بحجم واحد
        productPrice = product.discount && product.discount > 0 ? product.discount : product.price;
    }
    
    // البحث عن المنتج في السلة (مع مراعاة الحجم)
    const cartItem = cart.find(item => {
        if (item.id === productId) {
            // إذا كان المنتج يحتوي على أحجام، تحقق من تطابق الحجم
            if (product.sizes && product.sizes.length > 0) {
                return item.sizeName === sizeName;
            }
            // إذا كان منتج بحجم واحد، لا حاجة للتحقق من الحجم
            return true;
        }
        return false;
    });
    
    if (cartItem) {
        cartItem.quantity += 1;
    } else {
        cart.push({ 
            id: productId, 
            name: productName,
            price: productPrice, 
            quantity: 1, 
            img: product.image || product.img || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740',
            sizeName: sizeName // إضافة اسم الحجم للتمييز بين الأحجام المختلفة
        });
    }
    
    // حفظ في قاعدة البيانات بشكل متزامن
    await saveCart();

    if (!fromDetails) {
        showToast('تم إضافة المنتج إلى السلة!', 'success');
    }
    
    // تحديث الإجمالي بعد إضافة المنتج
    updateCartTotal();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return; // We are not on the cart page

    // إخفاء شاشة التحميل فوراً عند بدء عرض السلة
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';

    if (!cart.length) {
        container.innerHTML = '<p class="empty-message">السلة فارغة.</p>';
        const summary = document.querySelector('.cart-summary');
        if (summary) summary.style.display = 'none';
        return;
    }
    
    const summary = document.querySelector('.cart-summary');
    if (summary) summary.style.display = 'block';

    // المنتجات كلها في كارت موحد
    container.innerHTML = `
      <div class="cart-items-table">
        ${cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (!product) return '';
            
            // تحديد السعر للعرض
            let priceDisplay = '';
            if (item.sizeName && product.sizes && product.sizes.length > 0) {
                // إذا كان المنتج يحتوي على أحجام متعددة
                const size = product.sizes.find(s => s.name === item.sizeName);
                if (size) {
                    if (size.discount && size.discount > 0) {
                        priceDisplay = `<span class='discounted-price'>${size.discount} جنيه</span> <span class='old-price'>${size.price} جنيه</span>`;
                    } else {
                        priceDisplay = `${size.price} جنيه`;
                    }
                } else {
                    priceDisplay = `${item.price} جنيه`;
                }
            } else {
                // النظام القديم - منتج بحجم واحد
                const useDiscount = product.discount && !isNaN(product.discount);
                if (useDiscount) {
                    priceDisplay = `<span class='discounted-price'>${product.discount} جنيه</span> <span class='old-price'>${product.price} جنيه</span>`;
                } else {
                    priceDisplay = `${item.price} جنيه`;
                }
            }
            
            return `
              <div class="cart-row">
                <img src="${product.image || product.img || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740'}" alt="${product.name}" loading="lazy">
                <span class="cart-row-name">${item.name}</span>
                <span class="cart-row-price">
                  ${priceDisplay}
                </span>
                <div class="quantity-controls">
                  <button class="quantity-btn" data-product-id="${product.id}" data-action="decrease">-</button>
                  <span class="quantity">${item.quantity}</span>
                  <button class="quantity-btn" data-product-id="${product.id}" data-action="increase">+</button>
                </div>
                <button class="remove-from-cart" data-product-id="${product.id}"><i class="fas fa-trash"></i></button>
              </div>
            `;
        }).join('')}
      </div>
    `;
    
    // تحديث الإجمالي بشكل متأخر قليلاً لضمان تحميل البيانات
    setTimeout(() => {
        updateCartTotal();
    }, 100);
}

function updateCartTotal() {
    const totalElement = document.getElementById('cart-total');
    const discountedTotalElement = document.getElementById('cart-discounted-total');
    const discountRow = document.getElementById('discount-row');

    if (!totalElement) return;

    let total = cart.reduce((sum, item) => {
        // استخدام السعر المحفوظ في السلة مباشرة
        return sum + item.price * item.quantity;
    }, 0);
    totalElement.textContent = total.toFixed(2);

    const couponCode = document.getElementById('coupon-code')?.value?.toUpperCase() || "";
    let discountedTotal = total;
    let couponApplied = false;
    
    // التحقق من وجود كوبون صالح في localStorage (تم التحقق منه من قاعدة البيانات)
    if (couponCode) {
        const user = getCurrentUser();
        if (user) {
            const validCoupons = JSON.parse(localStorage.getItem(`valid_coupons_${user.uid}`) || '{}');
            if (validCoupons[couponCode]) {
                const coupon = validCoupons[couponCode];
                couponApplied = true;
                discountedTotal = coupon.type === 'percentage' ?
                    total * (1 - coupon.value / 100) :
                    total - coupon.value;
                discountedTotal = Math.max(discountedTotal, 0);
            }
        }
    }

    if(discountedTotalElement) discountedTotalElement.textContent = discountedTotal.toFixed(2);
    if(discountRow) discountRow.style.display = couponApplied ? '' : 'none';
}

// دالة لتحديث حالة الكوبونات من الخادم
export async function updateCouponStatusFromServer(userId) {
    try {
        // إضافة cache لتجنب الاستدعاءات المتكررة
        const cacheKey = `coupon_cache_${userId}`;
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        const now = Date.now();
        
        // إذا تم التحديث خلال آخر 5 دقائق، استخدم البيانات المحفوظة
        if (cacheTime && (now - parseInt(cacheTime)) < 5 * 60 * 1000) {
            console.log('استخدام بيانات الكوبونات المحفوظة');
            return;
        }
        
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
        const { db } = await import('./firebase.js');
        
        // الحصول على جميع الكوبونات النشطة من الخادم
        const couponsRef = collection(db, 'coupons');
        const q = query(couponsRef, where('active', '==', true));
        const querySnapshot = await getDocs(q);
        
        const activeCoupons = {};
        querySnapshot.forEach(doc => {
            const couponData = { id: doc.id, ...doc.data() };
            activeCoupons[doc.data().code] = couponData;
            
            // تحديث الكوبونات المحلية
            coupons[doc.id] = couponData;
        });
        
        // الحصول على الكوبونات المستخدمة محلياً
        const usedCoupons = JSON.parse(localStorage.getItem(`used_coupons_${userId}`) || '{}');
        const updatedUsedCoupons = {};
        
        // التحقق من كل كوبون مستخدم محلياً
        for (const [couponCode, isUsed] of Object.entries(usedCoupons)) {
            // إذا كان الكوبون لا يزال موجوداً في الخادم، احتفظ به
            if (activeCoupons[couponCode]) {
                updatedUsedCoupons[couponCode] = isUsed;
            }
            // إذا لم يعد الكوبون موجوداً في الخادم، تجاهله (تم حذفه)
        }
        
        // حفظ الكوبونات المحدثة
        localStorage.setItem(`used_coupons_${userId}`, JSON.stringify(updatedUsedCoupons));
        
        // حفظ وقت التحديث
        localStorage.setItem(`${cacheKey}_time`, now.toString());
        
        console.log('تم تحديث حالة الكوبونات من الخادم');
        
    } catch (error) {
        console.error('خطأ في تحديث حالة الكوبونات:', error);
        // في حالة الخطأ، لا نوقف العملية
    }
}

// دالة للتحقق المباشر من قاعدة البيانات للكوبون
async function validateCouponFromDatabase(couponCode, userId) {
    try {
        // تحديث حالة الكوبونات من الخادم أولاً
        await updateCouponStatusFromServer(userId);
        
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
        const { db } = await import('./firebase.js');
        
        // البحث عن الكوبون في قاعدة البيانات
        const couponsRef = collection(db, 'coupons');
        const q = query(couponsRef, where('code', '==', couponCode));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return { valid: false, error: 'كود الخصم غير موجود' };
        }
        
        const couponDoc = querySnapshot.docs[0];
        const coupon = { id: couponDoc.id, ...couponDoc.data() };
        
        // التحقق من انتهاء صلاحية الكوبون أولاً
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
            return { valid: false, error: 'هذا الكوبون منتهي الصلاحية أو تم استهلاكه بالكامل' };
        }
        
        // التحقق من قيمة الخصم حسب النوع
        if (coupon.type === 'percentage' && (coupon.value < 1 || coupon.value > 100)) {
            return { valid: false, error: 'قيمة الخصم غير صحيحة' };
        }
        
        // التحقق من استخدام الكوبون من قبل المستخدم الحالي (في النهاية)
        const usedCoupons = JSON.parse(localStorage.getItem(`used_coupons_${userId}`) || '{}');
        if (usedCoupons[couponCode]) {
            return { valid: false, error: 'لقد استخدمت هذا الكوبون من قبل' };
        }
        
        return { valid: true, coupon: coupon };
        
    } catch (error) {
        console.error('خطأ في التحقق من الكوبون من قاعدة البيانات:', error);
        return { valid: false, error: 'خطأ في التحقق من الكوبون' };
    }
}

// دالة للتحقق من صلاحية الكوبون قبل إتمام الطلب
function validateCouponBeforeCheckout(coupon, userId) {
    // التحقق من انتهاء صلاحية الكوبون (عدد مرات الاستخدام)
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return 'هذا الكوبون منتهي الصلاحية أو تم استهلاكه بالكامل';
    }
    
    // التحقق من استخدام الكوبون من قبل المستخدم الحالي
    const usedCoupons = JSON.parse(localStorage.getItem(`used_coupons_${userId}`) || '{}');
    if (usedCoupons[coupon.code]) {
        return 'لقد استخدمت هذا الكوبون من قبل';
    }
    
    // التحقق من قيمة الخصم حسب النوع
    if (coupon.type === 'percentage' && (coupon.value < 1 || coupon.value > 100)) {
        return 'قيمة الخصم غير صحيحة';
    }
    
    // الكوبون صالح
    return null;
}

// دالة لزيادة عدد مرات استخدام الكوبون مع استخدام runTransaction
async function increaseCouponUsage(couponId) {
    try {
        const { doc, runTransaction } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
        const { db } = await import('./firebase.js');
        
        const couponRef = doc(db, 'coupons', couponId);
        
        await runTransaction(db, async (transaction) => {
            const couponDoc = await transaction.get(couponRef);
            if (!couponDoc.exists()) {
                throw new Error("الكوبون غير موجود.");
            }
            
            const couponData = couponDoc.data();
            const currentUsage = couponData.usage_count || 0;
            const usageLimit = couponData.usage_limit;
            
            // التحقق من أن الكوبون لم ينتهي بعد
            if (usageLimit && currentUsage >= usageLimit) {
                throw new Error("الكوبون تم استخدامه بالكامل.");
            }
            
            // تحديث العدد في قاعدة البيانات
            transaction.update(couponRef, {
                usage_count: currentUsage + 1
            });
            
            // تحديث البيانات المحلية
            if (coupons[couponId]) {
                coupons[couponId].usage_count = currentUsage + 1;
            }
            
            console.log(`تم تحديث عدد مرات استخدام الكوبون ${couponId} من ${currentUsage} إلى ${currentUsage + 1}`);
        });
        
    } catch (error) {
        console.error('خطأ في تحديث عدد مرات استخدام الكوبون:', error);
        throw error; // إعادة رمي الخطأ للمعالجة في الدالة المستدعية
    }
}

// --- حماية تهيئة صفحة السلة حتى تحميل المستخدم ---
export async function waitForUser(timeout = 3000) {
    // التحقق السريع أولاً
    const user = getCurrentUser();
    if (user) return user;
    
    // إذا لم يكن المستخدم موجود، انتظر لفترة أقصر
    let waited = 0;
    const checkInterval = 50; // تقليل من 100ms إلى 50ms
    
    while (!getCurrentUser() && waited < timeout) {
        await new Promise(r => setTimeout(r, checkInterval));
        waited += checkInterval;
    }
    
    return getCurrentUser();
}

export async function initCartPage() {
    if (cartPageInitialized) return;
    cartPageInitialized = true;
    
    // عرض السلة فوراً إذا كانت البيانات متوفرة
    if (cart.length > 0) {
        renderCart();
    }
    
    // سبينر انتظار المستخدم
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    
    // تقليل وقت الانتظار للمستخدم
    const user = await waitForUser(3000); // تقليل من 6 ثوان إلى 3 ثوان
    if (!user) {
        location.href = "index.html";
        return;
    }
    
    // إخفاء الـ overlay مبكراً
    if (overlay) overlay.style.display = 'none';
    
    // تحميل البيانات بشكل متوازي بدلاً من متسلسل
    const [userDataPromise, couponStatusPromise] = await Promise.allSettled([
        import('./api.js').then(mod => mod.loadUserData(user.uid)),
        updateCouponStatusFromServer(user.uid)
    ]);
    
    // عرض السلة مرة أخرى بعد تحميل البيانات
    renderCart();
    
    // تحديث الإجمالي بعد تحميل البيانات
    updateCartTotal();
    
    // إعداد مستمعي الأحداث
    document.getElementById('apply-coupon')?.addEventListener('click', applyCoupon);
    document.getElementById('checkout-btn')?.addEventListener('click', handleCheckout);
    
    // مستمع حدث لتحديث حالة الكوبونات عند فتح حقل الكوبون (فقط عند الحاجة)
    const couponInput = document.getElementById('coupon-code');
    if (couponInput) {
        let couponStatusUpdated = false;
        
        couponInput.addEventListener('focus', async () => {
            if (user && !couponStatusUpdated) {
                couponStatusUpdated = true;
                await updateCouponStatusFromServer(user.uid);
            }
        });
        
        // إضافة مستمع حدث للضغط على Enter
        couponInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCoupon();
            }
        });
        
        // تحديث الإجمالي عند تغيير قيمة الكوبون
        couponInput.addEventListener('input', () => {
            // تنظيف الكوبون الصالح عند تغيير النص
            clearValidCoupon();
            updateCartTotal();
        });
    }
    
    document.getElementById('cart-items')?.addEventListener('click', (e) => {
        if (e.target.closest('.quantity-btn')) {
            const btn = e.target.closest('.quantity-btn');
            updateCartItemQuantity(btn.dataset.productId, btn.dataset.action);
        }
        if (e.target.closest('.remove-from-cart')) {
            removeFromCart(e.target.closest('.remove-from-cart').dataset.productId);
        }
    });
}

// --- حماية عند إتمام الطلب ---
export async function handleCheckout() {
    try {
        await waitForUser();
        await loadCustomerData();
        
        if (!isCustomerDataComplete()) {
            showToast('يرجى إكمال بيانات التوصيل أولاً', 'error');
            setTimeout(() => {
                openShippingDataModal();
            }, 400);
            return;
        }
        
        // التحقق من الكوبون قبل فتح نافذة طرق الدفع
        const couponCode = document.getElementById('coupon-code')?.value?.toUpperCase() || "";
        if (couponCode) {
            const user = getCurrentUser();
            if (user) {
                const validationResult = await validateCouponFromDatabase(couponCode, user.uid);
                if (!validationResult.valid) {
                    // إلغاء الكوبون وإظهار رسالة خطأ
                    document.getElementById('coupon-code').value = '';
                    showToast(validationResult.error, 'error');
                    updateCartTotal();
                    return;
                }
            }
        }
        
        // فتح نافذة طرق الدفع بدلاً من إتمام الطلب مباشرة
        openPaymentMethodsModal();

    } catch (error) {
        console.error("Checkout error:", error.message);
        showToast('حدث خطأ أثناء فتح طرق الدفع. يرجى المحاولة مرة أخرى.', 'error');
    }
}

// هذه الدالة يجب ألا تتكرر في التنفيذ لنفس الزر بسرعة بسبب حماية التكرار
export function updateCartItemQuantity(productId, action) {
    console.log('updateCartItemQuantity', productId, action);
    // حماية من التكرار السريع
    const now = Date.now();
    if (lastCartAction.id === productId && lastCartAction.action === action && now - lastCartAction.time < 200) {
        return;
    }
    lastCartAction = { id: productId, action, time: now };

    const cartItem = cart.find(item => item.id === productId);
    if (!cartItem) return;

    if (action === 'increase') {
        cartItem.quantity += 1;
    } else if (action === 'decrease') {
        cartItem.quantity -= 1;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
            return;
        }
    }
    saveCart();
    renderCart();
    // تحديث الإجمالي بعد تغيير الكمية
    updateCartTotal();
}

export function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    // تحديث الإجمالي بعد إزالة المنتج
    updateCartTotal();
    showToast('تم إزالة المنتج من السلة!', 'success');
}

// دوال النافذة المنبثقة لبيانات التوصيل
async function openShippingDataModal() {
    const modal = document.getElementById('shipping-data-modal');
    if (!modal) {
        console.error('النافذة المنبثقة لبيانات التوصيل غير موجودة');
        return;
    }
    
    try {
        // تحميل البيانات الحالية
        await loadCustomerData();
        
        if (isCustomerDataComplete()) {
            showShippingDataDisplay();
        } else {
            showShippingDataForm();
        }
        
        modal.classList.add('open');
        
        // إعداد مستمعي الأحداث
        setupShippingModalListeners();
        
    } catch (error) {
        console.error('خطأ في فتح النافذة المنبثقة:', error);
        showToast('حدث خطأ في فتح النافذة المنبثقة', 'error');
    }
}

function closeShippingDataModal() {
    const modal = document.getElementById('shipping-data-modal');
    if (modal) {
        modal.classList.remove('open');
    } else {
        console.error('النافذة المنبثقة لبيانات التوصيل غير موجودة');
    }
}

function showShippingDataDisplay() {
    const displayContainer = document.getElementById('shipping-data-display');
    const formContainer = document.getElementById('shipping-data-form');
    const contentContainer = document.getElementById('saved-data-content');
    
    if (!displayContainer || !formContainer || !contentContainer) {
        console.error('عناصر النافذة المنبثقة غير موجودة');
        return;
    }
    
    displayContainer.style.display = 'block';
    formContainer.style.display = 'none';
    
    contentContainer.innerHTML = `
        <div class="data-item">
            <span class="data-label">الاسم بالكامل:</span>
            <span class="data-value">${customerData.fullName || 'غير محدد'}</span>
        </div>
        <div class="data-item">
            <span class="data-label">رقم الهاتف:</span>
            <span class="data-value">${customerData.phoneNumber || 'غير محدد'}</span>
        </div>
        <div class="data-item">
            <span class="data-label">رقم هاتف آخر:</span>
            <span class="data-value ${customerData.phoneNumber2 ? '' : 'empty'}">${customerData.phoneNumber2 || 'غير محدد'}</span>
        </div>
        <div class="data-item">
            <span class="data-label">العنوان:</span>
            <span class="data-value">${customerData.address || 'غير محدد'}</span>
        </div>
        <div class="data-item">
            <span class="data-label">مكان مميز:</span>
            <span class="data-value ${customerData.landmark ? '' : 'empty'}">${customerData.landmark || 'غير محدد'}</span>
        </div>
    `;
}

function showShippingDataForm() {
    const displayContainer = document.getElementById('shipping-data-display');
    const formContainer = document.getElementById('shipping-data-form');
    
    if (!displayContainer || !formContainer) {
        console.error('عناصر النافذة المنبثقة غير موجودة');
        return;
    }
    
    displayContainer.style.display = 'none';
    formContainer.style.display = 'block';
    
    // ملء النموذج بالبيانات الموجودة
    const fullNameInput = document.getElementById('modal-full-name');
    const phoneInput = document.getElementById('modal-phone-number');
    const phone2Input = document.getElementById('modal-phone-number-2');
    const addressInput = document.getElementById('modal-address');
    const landmarkInput = document.getElementById('modal-landmark');
    
    if (fullNameInput) fullNameInput.value = customerData.fullName || '';
    if (phoneInput) phoneInput.value = customerData.phoneNumber || '';
    if (phone2Input) phone2Input.value = customerData.phoneNumber2 || '';
    if (addressInput) addressInput.value = customerData.address || '';
    if (landmarkInput) landmarkInput.value = customerData.landmark || '';
}

function setupShippingModalListeners() {
    // إغلاق النافذة
    const closeBtn = document.getElementById('close-shipping-modal');
    const cancelBtn = document.getElementById('cancel-shipping-data');
    const modal = document.getElementById('shipping-data-modal');
    const form = document.getElementById('shipping-data-form');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeShippingDataModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeShippingDataModal);
    }
    
    // إغلاق النافذة عند الضغط خارجها
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'shipping-data-modal') {
                closeShippingDataModal();
            }
        });
    }
    
    // نموذج حفظ البيانات
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (!submitBtn) return;
            
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner-small"></div>';
            
            try {
                const formData = new FormData(e.target);
                const data = {
                    fullName: formData.get('fullName').trim(),
                    phoneNumber: formData.get('phoneNumber').trim(),
                    phoneNumber2: formData.get('phoneNumber2').trim(),
                    address: formData.get('address').trim(),
                    landmark: formData.get('landmark').trim()
                };

                // التحقق من البيانات المطلوبة
                if (!data.fullName || !data.phoneNumber || !data.address) {
                    showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
                    return;
                }

                // التحقق من صحة رقم الهاتف
                const phoneRegex = /^(\+2)?01[0125][0-9]{8}$/;
                if (!phoneRegex.test(data.phoneNumber)) {
                    showToast('يرجى إدخال رقم هاتف مصري صحيح', 'error');
                    return;
                }

                if (data.phoneNumber2 && !phoneRegex.test(data.phoneNumber2)) {
                    showToast('يرجى إدخال رقم الهاتف الثاني صحيح', 'error');
                    return;
                }

                const success = await saveCustomerData(data);
                if (success) {
                    showToast('تم حفظ البيانات بنجاح', 'success');
                    closeShippingDataModal();
                    // إعادة محاولة إتمام الطلب
                    setTimeout(() => {
                        handleCheckout();
                    }, 500);
                }
            } catch (error) {
                console.error('خطأ في حفظ بيانات التوصيل:', error);
                showToast('حدث خطأ في حفظ البيانات', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
    
    // زر تعديل البيانات
    const editBtn = document.getElementById('edit-shipping-data');
    if (editBtn) {
        editBtn.addEventListener('click', showShippingDataForm);
    }
}

// جعل الدالة متاحة في النطاق العام
window.openShippingDataModal = openShippingDataModal;
window.applyCoupon = applyCoupon;

// إضافة دالة مساعدة لاختبار النافذة المنبثقة
window.testShippingModal = () => {
    console.log('اختبار النافذة المنبثقة...');
    openShippingDataModal();
};

// إضافة دالة مساعدة لاختبار إتمام الطلب
window.testCheckout = () => {
    console.log('اختبار إتمام الطلب...');
    handleCheckout();
};

// --- THIS FUNCTION WAS MISSING AND HAS BEEN RESTORED ---
async function applyCoupon() {
    const couponCode = document.getElementById('coupon-code')?.value?.toUpperCase();
    const user = getCurrentUser();
    const applyBtn = document.getElementById('apply-coupon');
    
    // إزالة أي رسالة سابقة
    let msg = document.getElementById('coupon-msg');
    if (msg) msg.remove();
    const couponRow = document.querySelector('.cart-coupon-row');
    
    function showCouponMsg(text, type) {
        let el = document.createElement('div');
        el.id = 'coupon-msg';
        el.textContent = text;
        el.style.fontSize = '0.98em';
        el.style.marginTop = '7px';
        el.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
        el.style.transition = 'opacity 0.3s';
        couponRow && couponRow.parentNode.insertBefore(el, couponRow.nextSibling);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 2500);
    }
    
    // التحقق من أن السلة ليست فارغة
    if (!cart || cart.length === 0) {
        showToast('السلة فارغة، لا يمكن تطبيق كود خصم', 'error');
        showCouponMsg('السلة فارغة، لا يمكن تطبيق كود خصم', 'error');
        return;
    }
    
    if (!couponCode) {
        showToast('الرجاء إدخال كود الخصم', 'error');
        showCouponMsg('الرجاء إدخال كود الخصم', 'error');
        return;
    }
    
    if (!user) {
        showToast('يجب تسجيل الدخول لاستخدام كوبون الخصم', 'error');
        showCouponMsg('يجب تسجيل الدخول لاستخدام كوبون الخصم', 'error');
        return;
    }
    
    // إظهار loading على الزر
    if (applyBtn) {
        const originalText = applyBtn.innerHTML;
        applyBtn.disabled = true;
        applyBtn.innerHTML = '<span class="cart-spinner"></span>';
        
        try {
            // التحقق من قاعدة البيانات مباشرة
            const validationResult = await validateCouponFromDatabase(couponCode, user.uid);
            
            if (!validationResult.valid) {
                showToast(validationResult.error, 'error');
                showCouponMsg(validationResult.error, 'error');
                document.getElementById('coupon-code').value = '';
                // إزالة الكوبون من الكوبونات الصالحة إذا كان موجوداً
                const validCoupons = JSON.parse(localStorage.getItem(`valid_coupons_${user.uid}`) || '{}');
                delete validCoupons[couponCode];
                localStorage.setItem(`valid_coupons_${user.uid}`, JSON.stringify(validCoupons));
                updateCartTotal();
                return;
            }
            
            // الكوبون صالح - حفظه في localStorage
            const validCoupons = JSON.parse(localStorage.getItem(`valid_coupons_${user.uid}`) || '{}');
            validCoupons[couponCode] = validationResult.coupon;
            localStorage.setItem(`valid_coupons_${user.uid}`, JSON.stringify(validCoupons));
            
            // تحديث الكوبونات المحلية بالبيانات الجديدة من قاعدة البيانات
            if (validationResult.coupon) {
                const couponId = validationResult.coupon.id;
                coupons[couponId] = validationResult.coupon;
            }
            
            // الكوبون صالح - تحديث الإجمالي
            updateCartTotal();
            showToast('تم تطبيق كود الخصم بنجاح!', 'success');
            showCouponMsg('تم تطبيق كود الخصم بنجاح!', 'success');
            
        } catch (error) {
            console.error('خطأ في تطبيق الكوبون:', error);
            showToast('خطأ في تطبيق الكوبون، يرجى المحاولة مرة أخرى', 'error');
            showCouponMsg('خطأ في تطبيق الكوبون، يرجى المحاولة مرة أخرى', 'error');
        } finally {
            // إعادة الزر لحالته الأصلية
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.innerHTML = originalText;
            }
        }
    }
}

// دوال نافذة طرق الدفع
function openPaymentMethodsModal() {
    const modal = document.getElementById('payment-methods-modal');
    if (!modal) {
        console.error('نافذة طرق الدفع غير موجودة');
        return;
    }
    
    // حساب العربون المطلوب
    const depositInfo = calculateRequiredDeposit();
    
    // تحديث محتوى النافذة بناءً على وجود منتجات تحتاج عربون
    const cashOption = document.getElementById('cash-option');
    const depositMessage = document.getElementById('deposit-message');
    const depositDetails = document.getElementById('deposit-details');
    
    if (depositInfo.hasDepositItems) {
        // تعطيل خيار الدفع عند الاستلام
        if (cashOption) {
            const cashRadio = cashOption.querySelector('input[type="radio"]');
            if (cashRadio) {
                cashRadio.disabled = true;
                cashRadio.checked = false;
            }
            cashOption.classList.add('disabled');
        }
        
        // إظهار رسالة العربون
        if (depositMessage) {
            depositMessage.style.display = 'block';
            depositMessage.innerHTML = `
                <div class="deposit-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>لا يمكنك دفع كل المبلغ عند الاستلام</strong>
                    <p>يجب أن تدفع عربون <strong>${depositInfo.totalDeposit} جنيه</strong> حفاظاً على سلامة المنتجات التالية في السلة:</p>
                    <ul>
                        ${depositInfo.depositItems.map(item => 
                            `<li>${item.name} (${item.quantity} قطعة) - عربون: ${item.totalDeposit} جنيه</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }
        
        // إظهار تفاصيل العربون
        if (depositDetails) {
            depositDetails.style.display = 'none';
        }
    } else {
        // تمكين خيار الدفع عند الاستلام
        if (cashOption) {
            const cashRadio = cashOption.querySelector('input[type="radio"]');
            if (cashRadio) {
                cashRadio.disabled = false;
            }
            cashOption.classList.remove('disabled');
        }
        
        // إخفاء رسالة العربون
        if (depositMessage) {
            depositMessage.style.display = 'none';
        }
        
        // إخفاء تفاصيل العربون
        if (depositDetails) {
            depositDetails.style.display = 'none';
        }
    }
    
    modal.classList.add('open');
    setupPaymentModalListeners();
}

function closePaymentMethodsModal() {
    const modal = document.getElementById('payment-methods-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

function setupPaymentModalListeners() {
    const modal = document.getElementById('payment-methods-modal');
    const closeBtn = document.getElementById('close-payment-modal');
    const cancelBtn = document.getElementById('cancel-payment-btn');
    const confirmBtn = document.getElementById('confirm-payment-btn');
    
    // إغلاق النافذة
    if (closeBtn) {
        closeBtn.addEventListener('click', closePaymentMethodsModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePaymentMethodsModal);
    }
    
    // إغلاق النافذة عند الضغط خارجها
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'payment-methods-modal') {
                closePaymentMethodsModal();
            }
        });
    }
    
    // مستمعي أحداث طرق الدفع
    const paymentOptions = document.querySelectorAll('.payment-method-option');
    paymentOptions.forEach(option => {
        const radio = option.querySelector('input[type="radio"]');
        const details = option.querySelector('.payment-method-details');
        
        if (radio && details) {
            radio.addEventListener('change', () => {
                // إزالة التحديد من جميع الخيارات
                paymentOptions.forEach(opt => {
                    opt.classList.remove('selected');
                    const optDetails = opt.querySelector('.payment-method-details');
                    if (optDetails) optDetails.style.display = 'none';
                });
                
                // تحديد الخيار المختار
                if (radio.checked && !radio.disabled) {
                    option.classList.add('selected');
                    details.style.display = 'block';
                    confirmBtn.disabled = false;
                } else {
                    confirmBtn.disabled = true;
                }
            });
        }
    });
    
    // زر إتمام الطلب
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const selectedMethod = document.querySelector('input[name="payment-method"]:checked');
            if (!selectedMethod) {
                showToast('يرجى اختيار طريقة دفع', 'error');
                return;
            }
            
            if (selectedMethod.value === 'instapay') {
                showToast('InstaPay متاح قريباً', 'info');
                return;
            }
            
            // التحقق من الكوبون قبل إتمام الطلب
            const couponCode = document.getElementById('coupon-code')?.value?.toUpperCase() || "";
            if (couponCode) {
                const user = getCurrentUser();
                if (user) {
                    const validationResult = await validateCouponFromDatabase(couponCode, user.uid);
                    if (!validationResult.valid) {
                        // إلغاء الكوبون وإظهار رسالة خطأ
                        document.getElementById('coupon-code').value = '';
                        showToast(validationResult.error, 'error');
                        // إغلاق نافذة طرق الدفع
                        closePaymentMethodsModal();
                        return;
                    }
                }
            }
            
            // إتمام الطلب بالطريقة المختارة
            await processOrderWithPayment(selectedMethod.value);
        });
    }
}

// دالة إتمام الطلب مع طريقة الدفع المختارة
async function processOrderWithPayment(paymentMethod) {
    try {
        const confirmBtn = document.getElementById('confirm-payment-btn');
        if (!confirmBtn) return;
        
        if (confirmBtn.disabled) return; // منع التكرار
        const originalBtnText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<div class="spinner-small"></div>';
        
        const user = getCurrentUser();
        if (!user) {
            showToast('يجب تسجيل الدخول أولاً', 'error');
            throw new Error("User not logged in");
        }
        
        if (!cart.length) {
            showToast('سلة التسوق فارغة', 'error');
            throw new Error("Cart is empty");
        }
        
        if (Date.now() - lastOrderTime < 60000) {
            showToast("يرجى الانتظار دقيقة قبل إرسال طلب جديد.", "error");
            throw new Error("Wait a minute");
        }
        
        // حساب الإجمالي الفعلي (سعر بعد خصم المنتج)
        let total = cart.reduce((sum, item) => {
            // استخدام السعر المحفوظ في السلة مباشرة
            return sum + item.price * item.quantity;
        }, 0);

        // حساب الإجمالي قبل خصم المنتج (السعر الأصلي للمنتجات)
        let total_before_discount = cart.reduce((sum, item) => {
            const product = products.find(p => p.id === item.id);
            if (product && product.sizes && product.sizes.length > 0) {
                // إذا كان المنتج يحتوي على أحجام متعددة
                const size = product.sizes.find(s => s.name === item.sizeName);
                if (size) {
                    return sum + size.price * item.quantity;
                }
            }
            // النظام القديم أو إذا لم يتم العثور على الحجم
            return sum + (product ? product.price : 0) * item.quantity;
        }, 0);

        const couponCode = document.getElementById('coupon-code')?.value?.toUpperCase() || "";
        let coupon_code_field = undefined;
        let couponValidationError = null;
        let total_before_coupon = total; // حفظ الإجمالي قبل تطبيق خصم الكوبون (بعد خصم المنتج)
        
        if (couponCode) {
            // التحقق المباشر من قاعدة البيانات للكوبون
            const validationResult = await validateCouponFromDatabase(couponCode, user.uid);
            
            if (!validationResult.valid) {
                // إلغاء الكوبون وإظهار رسالة خطأ
                document.getElementById('coupon-code').value = '';
                showToast(validationResult.error, 'error');
                // إغلاق نافذة طرق الدفع
                closePaymentMethodsModal();
                return; // منع إكمال عملية البيع إذا كان الكوبون غير صالح أو مستخدم
            } else {
                // تطبيق الخصم إذا كان الكوبون صالح
                const coupon = validationResult.coupon;
                total = coupon.type === 'percentage' ?
                    total * (1 - coupon.value / 100) :
                    total - coupon.value;
                total = Math.max(total, 0);
                coupon_code_field = couponCode;
            }
        }

        const newOrderNumber = lastOrderId + 1;
        await updateLastOrderId(newOrderNumber);

        // أضف تفاصيل السعر لكل منتج
        const itemsWithDetails = cart.map(item => {
            const product = products.find(p => p.id === item.id);
            
            if (product && product.sizes && product.sizes.length > 0) {
                // إذا كان المنتج يحتوي على أحجام متعددة
                const size = product.sizes.find(s => s.name === item.sizeName);
                if (size) {
                    return {
                        id: item.id,
                        name: item.name,
                        img: item.img,
                        quantity: item.quantity,
                        price: size.price,
                        discount: size.discount,
                        actual_price: size.discount && size.discount > 0 ? size.discount : size.price,
                        sizeName: item.sizeName
                    };
                }
            }
            
            // النظام القديم - منتج بحجم واحد
            const useDiscount = product && product.discount && !isNaN(product.discount);
            return {
                id: item.id,
                name: item.name,
                img: item.img,
                quantity: item.quantity,
                price: product ? product.price : 0,
                discount: useDiscount ? product.discount : null,
                actual_price: item.price
            };
        });

        // تحديد حالة الطلب حسب طريقة الدفع
        let orderStatus = 'review'; // الحالة الافتراضية
        if (paymentMethod === 'cash') {
            orderStatus = 'review'; // تحت المراجعة للدفع عند الاستلام
        } else if (paymentMethod === 'wallet') {
            orderStatus = 'waiting_payment'; // انتظار التحويل
        }

        // حساب العربون المطلوب
        const depositInfo = calculateRequiredDeposit();

        const order = {
            userId: user.uid,
            items: itemsWithDetails,
            total: total,
            total_before_coupon: total_before_coupon, // الإجمالي قبل خصم الكوبون (دائماً)
            total_after_coupon: total, // الإجمالي بعد خصم الكوبون (دائماً)
            status: orderStatus,
            payment_method: paymentMethod,
            required_deposit: depositInfo.totalDeposit, // إضافة حقل العربون المطلوب
            date: new Date().toISOString(),
            order_number: newOrderNumber,
            shipping_data: {
                fullName: customerData.fullName,
                phoneNumber: customerData.phoneNumber,
                phoneNumber2: customerData.phoneNumber2 || '',
                address: customerData.address,
                landmark: customerData.landmark || ''
            }
        };
        
        // إضافة كود الكوبون إذا كان موجوداً (البيانات الأساسية تُرسل دائماً)
        if (coupon_code_field) {
            order.coupon_code = coupon_code_field;
        }

        console.log('إنشاء الطلب:', order);
        
        // التحقق من صحة البيانات قبل الإرسال
        if (!order.userId || !order.items || order.items.length === 0) {
            throw new Error("Invalid order data");
        }
        
        if (!order.shipping_data.fullName || !order.shipping_data.phoneNumber || !order.shipping_data.address) {
            throw new Error("Incomplete shipping data");
        }
        
        // خصم الكوبون أولاً قبل إنشاء الطلب
        if (couponCode) {
            try {
                // التحقق مرة أخرى من قاعدة البيانات قبل خصم العدد
                const finalValidation = await validateCouponFromDatabase(couponCode, user.uid);
                if (!finalValidation.valid) {
                    throw new Error(finalValidation.error);
                }
                
                // استخدام runTransaction لخصم العدد بشكل آمن
                await increaseCouponUsage(finalValidation.coupon.id);
                
                console.log(`تم خصم الكوبون ${couponCode} بنجاح`);
                
            } catch (error) {
                console.error('خطأ في خصم الكوبون:', error);
                // في حالة فشل خصم الكوبون، نوقف العملية تماماً
                throw new Error(`فشل في خصم الكوبون: ${error.message}`);
            }
        }
        
        // إنشاء الطلب بعد نجاح خصم الكوبون
        const newOrderRef = await createOrderInDB(order);
        addOrder({ id: newOrderRef.id, ...order });
        
        // حفظ الكوبون في localStorage كـ "مستخدم" بعد إتمام الطلب بنجاح
        if (couponCode) {
            const usedCoupons = JSON.parse(localStorage.getItem(`used_coupons_${user.uid}`) || '{}');
            usedCoupons[couponCode] = true;
            localStorage.setItem(`used_coupons_${user.uid}`, JSON.stringify(usedCoupons));
            
            // تنظيف الكوبون من الكوبونات الصالحة
            const validCoupons = JSON.parse(localStorage.getItem(`valid_coupons_${user.uid}`) || '{}');
            delete validCoupons[couponCode];
            localStorage.setItem(`valid_coupons_${user.uid}`, JSON.stringify(validCoupons));
            
            // إرسال إشعار لتحديث الإدارة إذا كانت مفتوحة
            const updateEvent = new CustomEvent('couponUsageUpdated', {
                detail: { couponCode: couponCode }
            });
            window.dispatchEvent(updateEvent);
        }
        
        // مسح السلة
        cart = [];
        saveCart();
        lastOrderTime = Date.now();
        
        // إغلاق نافذة طرق الدفع
        closePaymentMethodsModal();
        
        // رسالة نجاح مختلفة حسب طريقة الدفع
        if (paymentMethod === 'cash') {
            showToast('تم إنشاء الطلب بنجاح! سيتم التواصل معك خلال 5 أيام', 'success');
        } else if (paymentMethod === 'wallet') {
            showToast('تم إنشاء الطلب! يرجى تحويل المبلغ على الرقم 01559552721', 'success');
            setTimeout(() => {
                showToast('بعد التحويل، اذهب لصفحة الطلبات وارفع لقطة شاشة التحويل', 'info');
            }, 2000);
        } else if (paymentMethod === 'instapay') {
            showToast('تم إنشاء الطلب! يرجى تحويل المبلغ', 'success');
            setTimeout(() => {
                showToast('بعد التحويل، اذهب لصفحة الطلبات وارفع لقطة شاشة التحويل', 'info');
            }, 2000);
        }
        
        setTimeout(() => {
            location.href = "index.html#orders";
        }, 1000);

    } catch (error) {
        console.error("Order processing error:", error.message);
        // في حالة حدوث خطأ، أعد الزر لحالته الأصلية
        const confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'إتمام الطلب';
        }
        
        // إظهار رسالة خطأ للمستخدم
        if (error.message === "Cart is empty") {
            showToast('سلة التسوق فارغة', 'error');
        } else if (error.message === "Wait a minute") {
            showToast("يرجى الانتظار دقيقة قبل إرسال طلب جديد.", "error");
        } else if (error.message === "User not logged in") {
            showToast('يجب تسجيل الدخول أولاً', 'error');
        } else if (error.message === "Invalid order data") {
            showToast('بيانات الطلب غير صحيحة', 'error');
        } else if (error.message === "Incomplete shipping data") {
            showToast('بيانات التوصيل غير مكتملة', 'error');
        } else if (error.message.includes('فشل في خصم الكوبون')) {
            showToast(error.message, 'error');
            // مسح الكوبون وإعادة حساب السعر
            const couponInput = document.getElementById('coupon-code');
            if (couponInput) {
                couponInput.value = '';
            }
            updateCartTotal();
            // إغلاق نافذة طرق الدفع
            closePaymentMethodsModal();
        } else if (error.message.includes('الكوبون')) {
            showToast(error.message, 'error');
            // مسح الكوبون وإعادة حساب السعر
            const couponInput = document.getElementById('coupon-code');
            if (couponInput) {
                couponInput.value = '';
            }
            updateCartTotal();
            // إغلاق نافذة طرق الدفع
            closePaymentMethodsModal();
        } else {
            showToast('حدث خطأ أثناء إنشاء الطلب. يرجى المحاولة مرة أخرى.', 'error');
        }
    }
}

// دالة لحساب العربون المطلوب للمنتجات في السلة
function calculateRequiredDeposit() {
    let totalDeposit = 0;
    const depositItems = [];
    
    cart.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product && product.deposit) {
            const itemDeposit = product.deposit * item.quantity;
            totalDeposit += itemDeposit;
            
            // إنشاء اسم المنتج مع الحجم إذا كان متوفراً
            let productDisplayName = product.name;
            if (item.sizeName) {
                productDisplayName += ` - ${item.sizeName}`;
            }
            
            depositItems.push({
                name: productDisplayName,
                quantity: item.quantity,
                deposit: product.deposit,
                totalDeposit: itemDeposit
            });
        }
    });
    
    return {
        totalDeposit,
        depositItems,
        hasDepositItems: depositItems.length > 0
    };
}

// دالة للتحقق من أن السلة تحتوي على منتجات تحتاج عربون
function hasDepositItems() {
    return cart.some(item => {
        const product = products.find(p => p.id === item.id);
        return product && product.deposit;
    });
}

// دالة لتنظيف الكوبونات الصالحة عند إزالة الكوبون من حقل الإدخال
function clearValidCoupon() {
    const couponCode = document.getElementById('coupon-code')?.value?.toUpperCase();
    const user = getCurrentUser();
    
    if (user && couponCode) {
        const validCoupons = JSON.parse(localStorage.getItem(`valid_coupons_${user.uid}`) || '{}');
        delete validCoupons[couponCode];
        localStorage.setItem(`valid_coupons_${user.uid}`, JSON.stringify(validCoupons));
    }
    
    updateCartTotal();
}

// دالة لتنظيف جميع الكوبونات الصالحة للمستخدم
export function clearAllValidCoupons(userId) {
    if (userId) {
        localStorage.removeItem(`valid_coupons_${userId}`);
    }
}