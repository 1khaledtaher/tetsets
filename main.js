// fileName: main.js

import { initializeAuth, getCurrentUser } from './auth.js';
import { loadInitialData } from './api.js';
import { initCartPage, updateCartCount } from './cart.js';
import { renderOrders } from './orders.js';
import { renderProfile } from './profile.js';
// تعديل هذا السطر
import { renderShop, renderFeaturedProducts, initShop, loadProducts } from './shop.js';
// === السطر الذي تم تصحيحه ===
// السطر الصحيح بعد التعديل
import { setupUI, showSection, renderGreeting, showToast, renderFavorites, openAuthModal, updateAuthUI, renderProductPage, renderCategoryTabs, renderFeaturedOffers, cleanupFeaturedOffers } from './ui.js';
import { favorites } from './favorites.js';
import { db } from './firebase.js';
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let offers = [];
let authReady = false;

// تصدير العروض للاستخدام في ui.js
export { offers };

async function fetchOffers() {
  offers = [];
  const querySnapshot = await getDocs(collection(db, "offers"));
  querySnapshot.forEach(docSnap => {
    offers.push({ id: docSnap.id, ...docSnap.data() });
  });
}

function renderOffersPage() {
  const offersSection = document.getElementById('offers-section');
  const offersList = document.getElementById('offers-list-section');
  offersList.innerHTML = '<div class="loading"><div class="spinner"></div> جاري تحميل العروض...</div>';
  fetchOffers().then(() => {
    if (!offers.length) {
      offersList.innerHTML = '<p class="empty-message">لا توجد عروض متاحة حالياً.</p>';
      return;
    }
    offersList.innerHTML = `
      <div class="offers-list-mobile">
        ${offers.map(o => {
          // حساب الأيام المتبقية إذا كان هناك مدة
          let durationText = '';
          if (o.duration) {
            // محاولة استخراج عدد الأيام من النص
            const durationStr = String(o.duration); // تحويل إلى نص
            const match = durationStr.match(/(\d+)/);
            if (match) {
              const days = parseInt(match[1]);
              durationText = `ينتهي العرض بعد <b>${days}</b> يوم`;
            } else {
              durationText = durationStr;
            }
          }
          return `
            <div class="offer-card-mobile variable-size-offer">
              <div class="offer-img-wrap"><img src="${o.image || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740'}" alt="${o.title}"></div>
              <div class="offer-info-mobile">
                <div class="offer-title-mobile">${o.title}</div>
                <div class="offer-desc-mobile">${o.description || ''}</div>
                <div class="offer-meta-mobile">
                  ${o.discount ? `<span class="offer-discount-mobile">خصم ${o.discount} جنيه</span>` : ''}
                  ${durationText ? `<span class="offer-duration-mobile">${durationText}</span>` : ''}
                </div>
                ${o.products ? `<button class="offer-shop-btn-mobile big-btn big-shop-btn" data-products="${o.products}" data-offer-id="${o.id}">تسوق العرض <i class="fas fa-arrow-left"></i></button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    // زر تسوق العرض
    offersList.querySelectorAll('.offer-shop-btn-mobile').forEach(btn => {
      btn.onclick = function() {
        const offerId = this.dataset.offerId;
        location.hash = `#offer/${offerId}`;
      };
    });
  });
}

function waitForAuthReady(timeout = 6000) {
    return new Promise((resolve) => {
        if (authReady) return resolve();
        let waited = 0;
        const interval = setInterval(() => {
            if (authReady || waited >= timeout) {
                clearInterval(interval);
                resolve();
            }
            waited += 100;
        }, 100);
    });
}

async function route() {
    await waitForAuthReady();
    
    // تنظيف intervals العروض المميزة عند تغيير الصفحة
    cleanupFeaturedOffers();
    
    let hash = location.hash.replace('#', '');
    if (hash.startsWith('product/')) {
        const productId = hash.split('/')[1];
        showSection('product-details');
        renderProductPage(productId);
        return;
    }
    if (hash.startsWith('offer/')) {
        const offerId = hash.split('/')[1];
        showSection('offer-details');
        renderOfferDetailsPage(offerId);
        return;
    }
    if (!hash || !['home', 'shop', 'favorites', 'orders', 'profile', 'about', 'offers'].includes(hash)) {
        hash = 'home';
    }
    const user = getCurrentUser();
    if (['favorites', 'orders', 'profile'].includes(hash) && !user) {
        openAuthModal();
        location.hash = '#home';
        showToast('يجب تسجيل الدخول للوصول إلى هذه الصفحة', 'error');
        return;
    }
    showSection(hash);
    switch (hash) {
        case 'home':
            renderFeaturedProducts();
            renderGreeting();
            renderFeaturedOffers();
            break;
        case 'shop':
            renderShop();
            break;
        case 'offers':
            renderOffersPage();
            break;
        case 'favorites':
            renderFavorites();
            break;
        case 'orders':
            renderOrders();
            break;
        case 'profile':
            renderProfile();
            break;
        case 'cart':
            // تحديث حالة الكوبونات عند فتح صفحة السلة
            if (user) {
                try {
                    const { updateCouponStatusFromServer } = await import('./cart.js');
                    await updateCouponStatusFromServer(user.uid);
                } catch (error) {
                    console.error('خطأ في تحديث حالة الكوبونات:', error);
                }
            }
            break;
    }
}

// دالة عرض تفاصيل العرض
async function renderOfferDetailsPage(offerId) {
    const offerDetailsSection = document.getElementById('offer-details-section');
    const offerProductsGrid = document.getElementById('offer-products-grid');
    
    // عرض حالة التحميل
    offerProductsGrid.innerHTML = '<div class="loading"><div class="spinner"></div> جاري تحميل المنتجات...</div>';
    
    try {
        // البحث عن العرض في المصفوفة المحلية
        const offer = offers.find(o => o.id === offerId);
        
        if (!offer) {
            // إذا لم يتم العثور على العرض، قم بتحميله من قاعدة البيانات
            await fetchOffers();
            const refreshedOffer = offers.find(o => o.id === offerId);
            
            if (!refreshedOffer) {
                showToast('العرض غير موجود', 'error');
                location.hash = '#offers';
                return;
            }
            
            displayOfferDetails(refreshedOffer);
        } else {
            displayOfferDetails(offer);
        }
        
    } catch (error) {
        console.error('خطأ في تحميل تفاصيل العرض:', error);
        showToast('خطأ في تحميل تفاصيل العرض', 'error');
        location.hash = '#offers';
    }
}

// دالة عرض تفاصيل العرض
function displayOfferDetails(offer) {
    // تحديث معلومات العرض
    document.getElementById('offer-details-title').textContent = offer.title;
    document.getElementById('offer-details-name').textContent = offer.title;
    document.getElementById('offer-details-description').textContent = offer.description || '';
    
    const offerImage = document.getElementById('offer-details-image');
    offerImage.src = offer.image || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740';
    offerImage.alt = offer.title;
    
    // تحديث الميتا داتا
    const metaContainer = document.getElementById('offer-details-meta');
    let metaHTML = '';
    
    if (offer.duration) {
        const durationStr = String(offer.duration);
        const match = durationStr.match(/(\d+)/);
        if (match) {
            const days = parseInt(match[1]);
            metaHTML += `<span>ينتهي العرض بعد <b>${days}</b> يوم</span>`;
        } else {
            metaHTML += `<span>${durationStr}</span>`;
        }
    }
    
    if (offer.discount) {
        metaHTML += `<span>خصم ${offer.discount} جنيه</span>`;
    }
    
    metaContainer.innerHTML = metaHTML;
    
    // تحميل المنتجات المرتبطة بالعرض
    if (offer.products && offer.products.length > 0) {
        loadOfferProducts(offer.products);
    } else {
        document.getElementById('offer-products-grid').innerHTML = '<p class="empty-message">لا توجد منتجات مرتبطة بهذا العرض</p>';
    }
}

// دالة تحميل منتجات العرض
async function loadOfferProducts(productIds) {
    const offerProductsGrid = document.getElementById('offer-products-grid');
    
    try {
        // استخدام دالة loadProducts المستوردة
        const allProducts = await loadProducts();
        
        // فلترة المنتجات حسب IDs
        const offerProducts = allProducts.filter(product => productIds.includes(product.id));
        
        if (offerProducts.length === 0) {
            offerProductsGrid.innerHTML = '<p class="empty-message">لم يتم العثور على المنتجات المرتبطة بالعرض</p>';
            return;
        }
        
        // استيراد دالة makeProductCard من ui.js
        const { makeProductCard } = await import('./ui.js');
        
        // عرض المنتجات باستخدام نفس دالة makeProductCard المستخدمة في الصفحة الرئيسية
        offerProductsGrid.innerHTML = offerProducts.map(product => makeProductCard(product)).join('');
        
    } catch (error) {
        console.error('خطأ في تحميل منتجات العرض:', error);
        offerProductsGrid.innerHTML = '<p class="empty-message">خطأ في تحميل المنتجات</p>';
    }
}

// --------- App Initialization ----------
async function initApp() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = "flex";
    setupUI();
    initShop();
    
    // تحميل البيانات الأولية (المنتجات والتصنيفات)
    await loadInitialData();
    
    // تحميل العروض
    await fetchOffers();
    
    // نحتاج انتظار تحميل بيانات المستخدم (والسلة) قبل إخفاء شاشة التحميل
    let afterAuthCallback = null;
    const hideOverlayIfReady = () => {
        if (authReady) loadingOverlay.style.display = "none";
    };
    initializeAuth(async (user, authError) => {
        authReady = true;
        updateAuthUI(user, authError);
        
        // تحديث حالة الكوبونات من الخادم عند تسجيل الدخول
        if (user) {
            try {
                const { updateCouponStatusFromServer } = await import('./cart.js');
                await updateCouponStatusFromServer(user.uid);
            } catch (error) {
                console.error('خطأ في تحديث حالة الكوبونات:', error);
            }
        }
        
        if (document.getElementById('home-section')) {
            route();
        }
        if (document.getElementById('cart-section')) {
            initCartPage();
        }
        updateCartCount();
        hideOverlayIfReady();
    });
    if (document.getElementById('home-section')) {
        window.addEventListener('hashchange', route);
    } else if (document.getElementById('cart-section')) {
        // في صفحة السلة، انتظر initCartPage ثم أخفِ overlay هناك
    }
    const cartLink = document.getElementById('cart-link');
    if(cartLink) {
        cartLink.addEventListener('click', (e) => {
            if (!getCurrentUser()) {
                e.preventDefault();
                openAuthModal();
                showToast('الرجاء تسجيل الدخول لعرض السلة', 'error');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// دوال مطلوبة لصفحة تفاصيل العرض
window.addToCart = function(productId) {
    // استيراد دالة addToCart من cart.js
    import('./cart.js').then(({ addToCart }) => {
        addToCart(productId);
    });
};

window.toggleFavorite = function(productId) {
    // استيراد دالة toggleFavorite من ui.js
    import('./ui.js').then(({ toggleFavorite }) => {
        toggleFavorite(productId);
    });
};