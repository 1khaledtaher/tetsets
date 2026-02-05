// fileName: ui.js

// السطر الصحيح بعد التعديل
import { products, getReviewsForProduct, addReview, deleteReview, categories } from './api.js';
import { favorites, toggleFavorite, saveFavorites } from './favorites.js';
import { addToCart } from './cart.js';
// Import auth functions needed for the UI event listeners
import { getCurrentUser, handleLogin, handleSignup, handleGoogleSignIn, handleLogout, isEmailVerified, resendVerificationEmail, changeDisplayName, changePassword, isGoogleAccount, canChangePassword } from './auth.js';

// متغيرات عامة للصور
let mainImage, nextImage, prevImage, currentImageIndex;

// إضافة دالة updateCartCount المفقودة
export function updateCartCount() {
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        // استيراد cart من cart.js
        import('./cart.js').then(module => {
            const cart = module.cart || [];
            cartCountEl.textContent = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        }).catch(() => {
            cartCountEl.textContent = '0';
        });
    }
}

let modalCurrentProductId = null;

// --- Toast Notifications ---
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2900);
}

// دالة لعرض الأخطاء في النوافذ
function showAuthError(errorId, message) {
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        // إخفاء الخطأ بعد 5 ثوان
        setTimeout(() => {
            errorElement.classList.remove('show');
            errorElement.textContent = '';
        }, 5000);
    }
}

// دالة لإخفاء الأخطاء في النوافذ
function hideAuthError(errorId) {
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.classList.remove('show');
        errorElement.textContent = '';
    }
}

// --- تحديث منطق فتح مودال الصور ---
let modalImages = [];
let modalCurrentIndex = 0;
let isDragging = false;
let startX = 0;
let currentX = 0;

// تحديث دالة فتح مودال الصورة لقبول كل الصور
window.openImageModal = function(imageSrc, imagesArr = null) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    if (!modal || !modalImage) return;

    // إذا تم تمرير مصفوفة الصور، استخدمها، وإلا استخدم صورة واحدة فقط
    if (Array.isArray(imagesArr) && imagesArr.length > 0) {
        modalImages = imagesArr;
        modalCurrentIndex = imagesArr.indexOf(imageSrc);
        if (modalCurrentIndex === -1) modalCurrentIndex = 0;
    } else {
        modalImages = [imageSrc];
        modalCurrentIndex = 0;
    }
    modalImage.src = modalImages[modalCurrentIndex];
    modal.classList.add('open');
    updateModalNavButtons();
    
    // إضافة مستمعي الأحداث للسحب
    setTimeout(() => {
        setupModalSwipe();
    }, 100);
    
    console.log('تم فتح مودال الصورة مع', modalImages.length, 'صورة');
};

// تحديث دالة تغيير الصورة الرئيسية لتمرير كل الصور
window.changeMainImage = function(imageSrc, thumbnailElement) {
    const mainImage = document.getElementById('main-product-image');
    if (mainImage) {
        mainImage.src = imageSrc;
        // تحديث currentImageIndex في دالة السحب
        if (window._allProductImages) {
            const newIndex = window._allProductImages.indexOf(imageSrc);
            if (newIndex !== -1) {
                // تحديث المتغير العام للصورة الحالية
                window._currentImageIndex = newIndex;
                // إعادة تهيئة دالة السحب مع الصورة الجديدة
                if (window.setupProductImageSwipe) {
                    // إزالة المستمعين القديمة أولاً
                    const oldMainImage = document.getElementById('main-product-image');
                    if (oldMainImage && window._startDrag) {
                        oldMainImage.removeEventListener('mousedown', window._startDrag);
                        oldMainImage.removeEventListener('touchstart', window._startDrag);
                    }
                    if (window._drag) {
                        document.removeEventListener('mousemove', window._drag);
                        document.removeEventListener('touchmove', window._drag);
                    }
                    if (window._endDrag) {
                        document.removeEventListener('mouseup', window._endDrag);
                        document.removeEventListener('touchend', window._endDrag);
                    }
                    
                    // إعادة تهيئة دالة السحب
                    setTimeout(() => {
                        window.setupProductImageSwipe();
                    }, 50);
                }
            }
        }
        // تمرير كل الصور عند فتح المودال
        mainImage.onclick = function() {
            openImageModal(imageSrc, window._allProductImages || [imageSrc]);
        };
    }
    // تحديث الصور المصغرة
    document.querySelectorAll('.thumbnail-img').forEach(thumb => {
        thumb.classList.remove('active');
    });
    if (thumbnailElement) {
        thumbnailElement.classList.add('active');
    }
};

// تحديث renderProductPage لتخزين كل الصور في متغير عام عند بناء الصفحة
export async function renderProductPage(productId) {
    const container = document.getElementById('product-details-section');
    if (!container) return;

    // إظهار دائرة التحميل
    container.innerHTML = `
        <div class="product-page-container">
            <header class="offer-details-header product-page-header" style="justify-content: center; position: relative;">
                <button class="back-btn" onclick="history.back()" style="position: absolute; right: 0;">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <h2 style="margin: 0 auto;">تفاصيل المنتج</h2>
            </header>
            <div class="product-loading">
                <div class="spinner"></div>
                <p>جاري تحميل المنتج...</p>
            </div>
        </div>
    `;

    const product = products.find(p => p.id === productId);
    if (!product) {
        container.innerHTML = `<p class="empty-message">المنتج غير موجود.</p>`;
        return;
    }
    
    console.log('Loading reviews for product:', productId);
    const reviews = await getReviewsForProduct(productId);
    console.log('Reviews loaded:', reviews.length, 'reviews');
    reviews.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

    // --- بداية: حساب متوسط التقييم ---
    let ratingHTML = '';
    if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;
        ratingHTML = createAverageRatingHTML(averageRating, reviews.length);
    } else {
        ratingHTML = '<p class="no-rating">لم يتم تقييمه حتى الآن</p>';
    }
    // --- نهاية: حساب متوسط التقييم ---

    let isFav = favorites.includes(productId);

    // تجميع جميع الصور
    const allImages = [
        product.image || product.img || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740',
        ...(product.additional_images || [])
    ].filter(img => img && img.trim() !== '');
    // تخزين كل الصور في متغير عام لاستخدامه في المودال
    window._allProductImages = allImages;

    // إنشاء تبويبات الأحجام إذا كان المنتج يحتوي على أحجام متعددة
    const sizeTabsHTML = product.sizes && product.sizes.length > 1 ? `
        <div class="size-tabs">
            ${product.sizes.map((size, index) => {
                const priceDisplay = size.discount && size.discount > 0 
                    ? `<span class="discounted-price">${size.discount} جنيه</span> <span class="old-price">${size.price} جنيه</span>`
                    : `${size.price} جنيه`;
                
                return `
                    <div class="size-tab ${index === 0 ? 'active' : ''}" data-size-index="${index}">
                        <span class="size-name">${size.name}</span>
                        <span class="size-price">${priceDisplay}</span>
                    </div>
                `;
            }).join('')}
        </div>
    ` : '';

    // إنشاء معرض الصور
    const imageGalleryHTML = allImages.length > 1 ? `
        <div class="product-gallery">
            <div class="main-image-container">
                <img src="${allImages[0]}" alt="${product.name}" class="product-page-img" id="main-product-image" onclick="openImageModal('${allImages[0]}', window._allProductImages)">
            </div>
            <div class="thumbnail-images">
                ${allImages.map((img, index) => `
                    <img src="${img}" alt="${product.name}" class="thumbnail-img ${index === 0 ? 'active' : ''}" 
                         onclick="changeMainImage('${img}', this)" data-index="${index}">
                `).join('')}
            </div>
            ${sizeTabsHTML}
        </div>
    ` : `
        <div class="product-gallery">
            <img src="${allImages[0]}" alt="${product.name}" class="product-page-img" id="main-product-image" onclick="openImageModal('${allImages[0]}', window._allProductImages)">
            ${sizeTabsHTML}
        </div>
    `;

    container.innerHTML = `
        <div class="product-page-container">
            <header class="offer-details-header product-page-header" style="justify-content: center; position: relative;">
                <button class="back-btn" onclick="history.back()" style="position: absolute; right: 0;">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <h2 style="margin: 0 auto;">تفاصيل المنتج</h2>
            </header>
            ${imageGalleryHTML}
            <div class="product-page-info">
                <h3>${product.name}</h3>
                <p class="price">
                    ${(() => {
                        if (product.sizes && product.sizes.length > 0) {
                            // إذا كان المنتج يحتوي على أحجام متعددة
                            const firstSize = product.sizes[0];
                            if (firstSize.discount && firstSize.discount > 0) {
                                return `<span class="discounted-price">${firstSize.discount} جنيه</span> <span class="old-price">${firstSize.price} جنيه</span>`;
                            } else {
                                return `${firstSize.price} جنيه`;
                            }
                        } else {
                            // النظام القديم - منتج بحجم واحد
                            if (product.discount && product.discount > 0) {
                                return `<span class="discounted-price">${product.discount} جنيه</span> <span class="old-price">${product.price} جنيه</span>`;
                            } else {
                                return `${product.price} جنيه`;
                            }
                        }
                    })()}
                </p>
                ${ratingHTML}
                <p class="desc">${product.description || product.desc || ''}</p>
                
                <!-- أزرار السلة والمفضلة -->
                <div class="product-page-actions">
                    <button id="product-add-cart" class="big-btn">
                        إضافة للسلة <i class="fas fa-shopping-bag"></i>
                    </button>
                    <button id="product-add-fav" class="add-to-fav-btn product-page-fav-btn ${isFav ? 'fav' : ''}" style="min-width:120px;">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
                
                <!-- الوصف التفصيلي -->
                ${product.detailed_description ? `
                    <div class="detailed-description-section">
                        <h4>الوصف التفصيلي</h4>
                        <p class="detailed-desc">${product.detailed_description}</p>
                    </div>
                ` : ''}
            </div>
            <div class="reviews-section">
                <h3>التقييمات والمراجعات</h3>
                <div id="review-form-container"></div>
                <div id="reviews-list"></div>
            </div>
        </div>
    `;

    // إضافة دالة تغيير الصورة الرئيسية للنطاق العام
    window.changeMainImage = function(imageSrc, thumbnailElement) {
        const mainImage = document.getElementById('main-product-image');
        if (mainImage) {
            mainImage.src = imageSrc;
            mainImage.onclick = function() {
                openImageModal(imageSrc, window._allProductImages || [imageSrc]);
            };
        }
        document.querySelectorAll('.thumbnail-img').forEach(thumb => {
            thumb.classList.remove('active');
        });
        if (thumbnailElement) {
            thumbnailElement.classList.add('active');
        }
    };

    // إضافة دالة فتح مودال الصورة
    window.openImageModal = function(imageSrc, imagesArr = null) {
        const modal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');
        if (modal && modalImage) {
            if (Array.isArray(imagesArr) && imagesArr.length > 0) {
                modalImages = imagesArr;
                modalCurrentIndex = imagesArr.indexOf(imageSrc);
                if (modalCurrentIndex === -1) modalCurrentIndex = 0;
            } else {
                modalImages = [imageSrc];
                modalCurrentIndex = 0;
            }
            modalImage.src = modalImages[modalCurrentIndex];
            modal.classList.add('open');
            updateModalNavButtons();
        }
    };

    // إضافة دالة إغلاق مودال الصورة
    window.closeImageModal = function() {
        const modal = document.getElementById('image-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    };

    // إضافة مستمعي الأحداث للصور
    setTimeout(() => {
        console.log('Setting up event listeners for product page');
        
        // إضافة مستمع لإغلاق المودال
        const closeBtn = document.getElementById('close-image-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeImageModal);
        }
        
        // إضافة ميزة السحب للصورة الرئيسية في صفحة تفاصيل المنتج
        setupProductImageSwipe();
        
        // إضافة مستمعي أحداث صفحة المنتج
        setupProductPageEventListeners(productId);
        
        // إضافة مستمعي أحداث تبويبات الأحجام
        setupSizeTabsListeners(productId);
        
        // إضافة مستمعي أحداث التقييمات
        console.log('Setting up review event listeners');
        setupReviewEventListeners(productId);
        
        // عرض التقييمات
        console.log('Rendering reviews list and form');
        renderReviewsList(productId, reviews);
        renderReviewForm(productId, reviews);
        
        console.log('All event listeners set up successfully');
    }, 100);
}

function getReviewLikes(reviewId) {
    const data = JSON.parse(localStorage.getItem('reviewLikes') || '{}');
    return data[reviewId] || { likes: 0, dislikes: 0, user: null };
}
function setReviewLikes(reviewId, likes, dislikes, userAction) {
    const data = JSON.parse(localStorage.getItem('reviewLikes') || '{}');
    data[reviewId] = { likes, dislikes, user: userAction };
    localStorage.setItem('reviewLikes', JSON.stringify(data));
}

// دالة لإنشاء قائمة المراجعات
function renderReviewsList(productId, reviews) {
    console.log('renderReviewsList called with:', { productId, reviewsCount: reviews.length });
    
    const listContainer = document.getElementById('reviews-list');
    const user = getCurrentUser();

    if (!listContainer) {
        console.error('Reviews list container not found!');
        return;
    }

    if (reviews.length === 0) {
        console.log('No reviews to display');
        listContainer.innerHTML = '<p class="empty-message">لا توجد مراجعات لهذا المنتج بعد.</p>';
        return;
    }

    console.log('Rendering', reviews.length, 'reviews');
    listContainer.innerHTML = reviews.map(review => {
        return `
        <div class="review-card">
            <div class="review-header">
                <img class="review-avatar" src="${review.userAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(review.userName || 'مستخدم')}" alt="avatar">
                <span class="review-author">${review.userName || 'مستخدم'}</span>
                <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
            </div>
            <p class="review-text">${review.text}</p>
        </div>
        `;
    }).join('');
    
    console.log('Reviews list rendered successfully');
}


// دالة لإنشاء نموذج إضافة مراجعة
function renderReviewForm(productId, reviews) {
    const formContainer = document.getElementById('review-form-container');
    const user = getCurrentUser();

    console.log('renderReviewForm called with:', { productId, user: user ? user.uid : 'no user', reviewsCount: reviews.length });

    if (!user) {
        formContainer.innerHTML = '<p>يجب <a href="#" onclick="openAuthModal()">تسجيل الدخول</a> لتتمكن من إضافة مراجعة.</p>';
        return;
    }

    // التحقق من وجود مراجعة سابقة للمستخدم
    const existingReview = reviews.find(review => review.userId === user.uid);
    if (existingReview) {
        formContainer.innerHTML = `
            <div class="existing-review-notice">
                <h4>مراجعتك لهذا المنتج</h4>
                <div class="star-rating-display">
                    ${'★'.repeat(existingReview.rating)}${'☆'.repeat(5 - existingReview.rating)}
                </div>
                <p class="review-text">${existingReview.text}</p>
                <button class="small-btn danger-btn delete-existing-review" data-review-id="${existingReview.id}" data-product-id="${productId}">حذف المراجعة</button>
            </div>
        `;
        return;
    }

    formContainer.innerHTML = `
        <form id="add-review-form">
            <h4>أضف مراجعتك</h4>
            <div class="star-rating">
                ${[5, 4, 3, 2, 1].map(star => `
                    <input type="radio" id="star${star}" name="rating" value="${star}">
                    <label for="star${star}">★</label>
                `).join('')}
            </div>
            <textarea id="review-text" placeholder="اكتب مراجعتك هنا..."></textarea>
            <button type="submit" class="big-btn" id="submit-review-btn">نشر المراجعة</button>
        </form>
    `;
    
    // إضافة مستمع الحدث للنموذج مباشرة
    const form = document.getElementById('add-review-form');
    if (form) {
        console.log('Form found, adding event listener');
        
        // إزالة أي مستمعين سابقين
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submit event triggered');
            
            const submitBtn = newForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;

            // تعطيل الزر وإظهار مؤشر التحميل
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner-small"></div>';

            try {
                const ratingInput = newForm.querySelector('input[name="rating"]:checked');
                const text = document.getElementById('review-text').value || '';
                console.log('Form data:', {rating: ratingInput ? ratingInput.value : null, text});
                
                if (!ratingInput) {
                    showToast('الرجاء اختيار تقييم (عدد النجوم)', 'error');
                    throw new Error("Rating not selected");
                }

                const rating = parseInt(ratingInput.value);
                console.log('Rating parsed:', rating);

                const reviewData = {
                    userId: user.uid,
                    userName: user.displayName || user.email.split('@')[0],
                    userAvatar: user.photoURL || '',
                    rating: rating,
                    text: text
                };
                console.log('Review data to send:', reviewData);
                
                // استيراد دالة addReview
                const { addReview } = await import('./api.js');
                console.log('addReview function imported');
                
                const result = await addReview(productId, reviewData);
                console.log('Review added successfully:', result);
                
                showToast('تم نشر مراجعتك بنجاح!', 'success');
                
                // إعادة تحميل الصفحة لعرض المراجعة الجديدة
                setTimeout(() => {
                    renderProductPage(productId);
                }, 1000);
                
            } catch (error) {
                // في حالة حدوث خطأ، أعد الزر لحالته الأصلية
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                console.error("Failed to submit review:", error);
                showToast(`فشل في نشر المراجعة: ${error.message}`, 'error');
            }
        });
        
        console.log('Event listener added successfully');
    } else {
        console.error('Form not found!');
    }
}

// أضف هذه الدالة الجديدة في ملف ui.js
function createAverageRatingHTML(average, count) {
    const roundedAverage = Math.round(average); // نقوم بتقريب المتوسط لأقرب عدد صحيح
    let starsHTML = '';

    for (let i = 1; i <= 5; i++) {
        // إذا كان i أصغر من أو يساوي التقييم المقرب، أضف نجمة ممتلئة
        if (i <= roundedAverage) {
            starsHTML += `<i class="fas fa-star"></i>`;
        } else {
            // وإلا، أضف نجمة فارغة
            starsHTML += `<i class="far fa-star"></i>`;
        }
    }

    return `
        <div class="average-rating-display">
            <div class="stars">${starsHTML}</div>
            <span class="review-count">${average.toFixed(1)} (${count} مراجعة)</span>
        </div>
    `;
}

// دالة لإضافة مستمعين الأحداث لصفحة المنتج
function setupReviewEventListeners(productId) {
    console.log('setupReviewEventListeners called for product:', productId);
    
    // --- مستمع حدث لحذف المراجعة (باستخدام تفويض الحدث) ---
    const reviewsListContainer = document.getElementById('reviews-list');
    if (reviewsListContainer) {
        console.log('Reviews list container found');
        reviewsListContainer.addEventListener('click', async (e) => {
            // نتأكد أن العنصر الذي تم الضغط عليه هو زر الحذف
            if (e.target.classList.contains('delete-review-btn')) {
                console.log('Delete review button clicked');
                const reviewId = e.target.dataset.reviewId;
                const prodId = e.target.dataset.productId;
                
                if (confirm('هل أنت متأكد من حذف هذه المراجعة؟')) {
                    try {
                        await deleteReview(prodId, reviewId);
                        showToast('تم حذف المراجعة.', 'info');
                        renderProductPage(prodId); // إعادة تحميل الصفحة لعرض التغييرات
                    } catch (error) {
                        showToast('فشل حذف المراجعة.', 'error');
                        console.error("Failed to delete review:", error);
                    }
                }
            }
        });
    } else {
        console.warn('Reviews list container not found');
    }
    
    // --- مستمع حدث لحذف المراجعة الموجودة ---
    const reviewFormContainer = document.getElementById('review-form-container');
    if (reviewFormContainer) {
        console.log('Review form container found');
        reviewFormContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-existing-review')) {
                console.log('Delete existing review button clicked');
                const reviewId = e.target.dataset.reviewId;
                const prodId = e.target.dataset.productId;
                
                if (confirm('هل أنت متأكد من حذف هذه المراجعة؟')) {
                    try {
                        await deleteReview(prodId, reviewId);
                        showToast('تم حذف المراجعة.', 'info');
                        renderProductPage(prodId); // إعادة تحميل الصفحة لعرض التغييرات
                    } catch (error) {
                        showToast('فشل حذف المراجعة.', 'error');
                        console.error("Failed to delete review:", error);
                    }
                }
            }
        });
    } else {
        console.warn('Review form container not found');
    }
}

// دالة لإعداد مستمعي الأحداث لأزرار المنتج في صفحة العرض
function setupProductPageEventListeners(productId) {
    const user = getCurrentUser();
    let isFav = favorites.includes(productId);
    
    // زر إضافة للسلة
    document.getElementById('product-add-cart')?.addEventListener('click', async function() {
        if (!user) {
            openAuthModal();
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        
        const product = products.find(p => p.id === productId);
        
        // التحقق من وجود أحجام متعددة
        if (product && product.sizes && product.sizes.length > 1) {
            // التحقق من وجود تبويبات أحجام
            const sizeTabs = document.querySelectorAll('.size-tab');
            if (sizeTabs.length > 0) {
                // استخدام الحجم المحدد من التبويبات
                const selectedSizeIndex = parseInt(this.dataset.selectedSize || '0');
                const btn = this;
                if (btn.classList.contains('loading')) return;
                
                btn.classList.add('loading');
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span class="cart-spinner"></span> جاري الإضافة...';
                
                try {
                    await addToCart(productId, true, selectedSizeIndex);
                    updateCartCount();
                    showToast('تم إضافة المنتج إلى السلة!', 'success');
                } finally {
                    btn.disabled = false;
                    btn.classList.remove('loading');
                    btn.innerHTML = originalText;
                }
                return;
            } else {
                // فتح نافذة اختيار الحجم إذا لم تكن هناك تبويبات
                openSizeSelectionModal(productId);
                return;
            }
        }
        
        // إذا كان منتج بحجم واحد، أضف مباشرة للسلة
        const btn = this;
        if (btn.classList.contains('loading')) return;
        
        btn.classList.add('loading');
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="cart-spinner"></span> جاري الإضافة...';
        
        try {
            await addToCart(productId, true);
            updateCartCount();
            showToast('تم إضافة المنتج إلى السلة!', 'success');
        } finally {
            btn.disabled = false;
            btn.classList.remove('loading');
            btn.innerHTML = originalText;
        }
    });
    
    // زر إضافة للمفضلة
    document.getElementById('product-add-fav')?.addEventListener('click', function(e) {
        e.stopPropagation(); // منع أي حدث عام
        if (!user) {
            openAuthModal();
            showToast('يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        if (isFav) {
            // إزالة من المفضلة
            const idx = favorites.indexOf(productId);
            if (idx > -1) favorites.splice(idx, 1);
            saveFavorites();
            this.classList.remove('fav');
            showToast('تمت الإزالة من المفضلة', 'info');
            isFav = false;
        } else {
            // إضافة للمفضلة
            favorites.push(productId);
            saveFavorites();
            this.classList.add('fav');
            showToast('تمت الإضافة إلى المفضلة', 'success');
            isFav = true;
        }
    });
}

// --- SPA Routing & Sections ---
export function showSection(section) {
    document.querySelectorAll('.page-section').forEach(sec => sec.style.display = 'none');
    const el = document.getElementById(section + '-section');
    if (el) el.style.display = '';

    document.querySelectorAll('.nav-item, .header-icon').forEach(link => link.classList.remove('active'));
    document.querySelectorAll(`.nav-item[data-section="${section}"], .header-icon[data-section="${section}"]`).forEach(link => link.classList.add('active'));
}

// --- UI Rendering ---
// fileName: ui.js

// ... باقي محتويات الملف تبقى كما هي ...

// --- بداية الكود الذي يجب إضافته في ملف ui.js ---

// أضف هذه الدوال للتحكم في مودال بيانات الشحن

export function openDataModal() {
    // هذا الكود يفترض أن المودال الخاص بالبيانات له id="data-modal"
    document.getElementById('data-modal')?.classList.add('open');
}

export function closeDataModal() {
  // هذا الكود يفترض أن المودال الخاص بالبيانات له id="data-modal"
  document.getElementById('data-modal')?.classList.remove('open');
}

// --- نهاية الكود ---

// --- UI Rendering ---
export function renderGreeting() {
    const user = getCurrentUser();
    const greetEl = document.getElementById('home-greeting');
    if (!greetEl) return;

    if (!user) {
        greetEl.innerHTML = `
            <div class="greet-text">مرحباً بك في <b>DZ Store</b>!<br>تسوق أجمل المنتجات العصرية بسهولة وسرعة.</div>
        `;
        return;
    }
    const name = user.displayName || user.email.split('@')[0];
    greetEl.innerHTML = `
        <div class="greet-text">مرحباً <span class="username">${name}</span>!</div>
    `;
}

// ... باقي محتويات الملف تبقى كما هي ...

export function updateAuthUI(user, authError = null) {
    const profileName = document.getElementById('profile-name');
    const profileFullname = document.getElementById('profile-fullname');
    const profileEmail = document.getElementById('profile-email');
    const profileDate = document.getElementById('profile-date');
    
    // التعامل مع الحسابات غير المحققة
    if (authError === 'EMAIL_NOT_VERIFIED') {
        showEmailVerificationModal();
        return;
    }
    
    if (user) {
        // تحديث اسم المستخدم في القائمة السفلية
        if (profileName) {
            profileName.textContent = user.displayName || user.email?.split('@')[0] || 'حسابي';
        }
        
        // تحديث معلومات الملف الشخصي
        if (profileFullname) {
            profileFullname.textContent = user.displayName || 'غير محدد';
        }
        if (profileEmail) {
            profileEmail.textContent = user.email || 'غير محدد';
        }
        if (profileDate) {
            const date = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date();
            profileDate.textContent = date.toLocaleDateString('ar-EG');
        }
        
        // التحقق من حالة التحقق من البريد الإلكتروني
        if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
            showEmailVerificationNotice();
        }
    } else {
        if (profileName) profileName.textContent = 'حسابي';
        if (profileFullname) profileFullname.textContent = '-';
        if (profileEmail) profileEmail.textContent = '-';
        if (profileDate) profileDate.textContent = '-';
    }
}

// دالة لإظهار إشعار التحقق من البريد الإلكتروني
function showEmailVerificationNotice() {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const notice = document.createElement('div');
    notice.className = 'toast info email-verification-notice';
    notice.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>يرجى التحقق من بريدك الإلكتروني لإكمال التسجيل</span>
            <button onclick="resendVerificationEmail()" style="background: none; border: none; color: white; text-decoration: underline; cursor: pointer; margin-right: 10px;">
                إعادة الإرسال
            </button>
        </div>
    `;
    
    toastContainer.appendChild(notice);
    
    // إزالة الإشعار بعد 10 ثوان
    setTimeout(() => {
        if (notice.parentNode) {
            notice.remove();
        }
    }, 10000);
}

// دالة إعادة إرسال رسالة التحقق
window.resendVerificationEmail = async function() {
    try {
        await resendVerificationEmail();
        showToast('تم إرسال رسالة التحقق مرة أخرى', 'success');
    } catch (error) {
        showToast('خطأ في إرسال رسالة التحقق: ' + error.message, 'error');
    }
};

// دالة لعرض مودال التحقق من البريد الإلكتروني
function showEmailVerificationModal() {
    const modal = document.createElement('div');
    modal.id = 'email-verification-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="email-verification-content">
            <div class="email-verification-header">
                <h3>تحقق من بريدك الإلكتروني</h3>
                <button class="close-verification-modal">&times;</button>
            </div>
            <div class="email-verification-body">
                <div class="verification-icon">
                    <i class="fas fa-envelope"></i>
                </div>
                <p>تم إرسال رسالة تحقق إلى بريدك الإلكتروني. يرجى فتح الرسالة والضغط على رابط التحقق لإكمال عملية التسجيل.</p>
                <p><strong>ملاحظة:</strong> لن تتمكن من تسجيل الدخول حتى تقوم بالتحقق من بريدك الإلكتروني.</p>
                <div class="verification-actions">
                    <button id="resend-verification-btn" class="big-btn">
                        <span class="btn-text">إعادة إرسال رسالة التحقق</span>
                        <span class="btn-loading" style="display:none;">
                            <i class="fas fa-spinner fa-spin"></i>
                            جاري الإرسال...
                        </span>
                    </button>
                    <button id="close-verification-btn" class="small-btn">إغلاق</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // إضافة مستمعي الأحداث
    modal.querySelector('.close-verification-modal').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#close-verification-btn').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#resend-verification-btn').addEventListener('click', async () => {
        const btn = modal.querySelector('#resend-verification-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        
        btn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-block';
        
        try {
            await resendVerificationEmail();
            showToast('تم إرسال رسالة التحقق مرة أخرى', 'success');
        } catch (error) {
            showToast('خطأ في إرسال رسالة التحقق: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btnText.style.display = 'inline-block';
            btnLoading.style.display = 'none';
        }
    });
    
    // إغلاق المودال عند الضغط خارج المحتوى
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

export function makeProductCard(product) {
    const isFav = favorites.includes(product.id);
    
    // حساب السعر بعد الخصم - دعم الأحجام المتعددة
    let discountDisplay = '';
    
    if (product.sizes && product.sizes.length > 0) {
        // إذا كان المنتج يحتوي على أحجام متعددة
        const firstSize = product.sizes[0];
        if (firstSize.discount && firstSize.discount > 0) {
            discountDisplay = `
                <span class="discounted-price">${firstSize.discount} جنيه</span>
                <span class="old-price">${firstSize.price} جنيه</span>
            `;
        } else {
            discountDisplay = `<span class="price">${firstSize.price} جنيه</span>`;
        }
    } else {
        // النظام القديم - منتج بحجم واحد
        if (product.discount && product.discount > 0) {
            discountDisplay = `
                <span class="discounted-price">${product.discount} جنيه</span>
                <span class="old-price">${product.price} جنيه</span>
            `;
        } else {
            discountDisplay = `<span class="price">${product.price} جنيه</span>`;
        }
    }
    
    // استخدام الاسم الأصلي للـ alt (بدون تمييز)
    const originalName = product.originalName || product.name;
    
    return `
      <div class="product-card" data-product-id="${product.id}">
        <img src="${product.image || product.img || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740'}" alt="${originalName}" loading="lazy">
        <h3>${product.name}</h3>
        <p class="desc">${product.description || product.desc || ''}</p>
        <p class="price">
          ${discountDisplay}
        </p>
        ${product.sizes && product.sizes.length > 1 ? `<p class="multiple-sizes">متوفر بـ ${product.sizes.length} أحجام</p>` : ''}
        <div class="product-actions">
          <button class="add-to-cart-btn product-card-add-cart" data-product-id="${product.id}">
            <span class="cart-spinner" style="display:none;"></span>
            <i class="fas fa-shopping-bag"></i>
          </button>
          <button class="add-to-fav-btn ${isFav ? 'fav' : ''}" data-product-id="${product.id}">
             <i class="fas fa-heart"></i>
          </button>
        </div>
      </div>
    `;
}

export function renderFavorites() {
    const container = document.getElementById('favorites-grid');
    if (!container) return;
    const favProducts = products.filter(p => favorites.includes(p.id));
    if (favProducts.length === 0) {
        container.innerHTML = '<p class="empty-message">لا توجد منتجات مفضلة بعد.</p>';
        return;
    }
    container.innerHTML = favProducts.map(product => makeProductCard(product)).join('');
}


// --- Modals (Auth & Product) ---
export function openAuthModal() {
    document.getElementById('auth-modal')?.classList.add('open');
    showLoginForm();
}
export function closeAuthModal() {
    document.getElementById('auth-modal')?.classList.remove('open');
}
export function showSignupForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
}
export function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
}

export function openProductModal(productId) {
    modalCurrentProductId = productId;
    const modal = document.getElementById('product-modal');
    const product = products.find(p => p.id === productId);
    if (!modal || !product) return;
    
    document.getElementById('modal-product-img').src = product.image || product.img || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740';
    document.getElementById('modal-product-name').textContent = product.name;
    document.getElementById('modal-product-desc').textContent = product.description || product.desc || "";
    
    // حساب السعر بعد الخصم - دعم الأحجام المتعددة
    let priceDisplay = '';
    
    if (product.sizes && product.sizes.length > 0) {
        // إذا كان المنتج يحتوي على أحجام متعددة
        const firstSize = product.sizes[0];
        if (firstSize.discount && firstSize.discount > 0) {
            priceDisplay = `
                <p class="price">
                    <span class="discounted-price">${firstSize.discount} جنيه</span>
                    <span class="old-price">${firstSize.price} جنيه</span>
                </p>
            `;
        } else {
            priceDisplay = `<p class="price">${firstSize.price} جنيه</p>`;
        }
        
        // إضافة مؤشر للأحجام المتعددة
        if (product.sizes.length > 1) {
            priceDisplay += `<p class="multiple-sizes">متوفر بـ ${product.sizes.length} أحجام</p>`;
        }
    } else {
        // النظام القديم - منتج بحجم واحد
        if (product.discount && product.discount > 0) {
            priceDisplay = `
                <p class="price">
                    <span class="discounted-price">${product.discount} جنيه</span>
                    <span class="old-price">${product.price} جنيه</span>
                </p>
            `;
        } else {
            priceDisplay = `<p class="price">${product.price} جنيه</p>`;
        }
    }
    
    document.getElementById('modal-product-extra').innerHTML = priceDisplay;
    
    const isFav = favorites.includes(productId);
    const modalFavBtn = document.getElementById('modal-add-fav');
    modalFavBtn.classList.toggle("fav", isFav);
    modalFavBtn.innerHTML = `<i class="fas fa-heart"></i> ${isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}`;
    modal.classList.add('open');
    
    // تعطيل زر التأكيد حتى يتم اختيار حجم
    const confirmBtn = document.getElementById('confirm-size-selection');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
}

export function closeProductModal() {
  document.getElementById('product-modal')?.classList.remove('open');
}

// --- Event Listeners Setup ---
export function setupUI() {
    // General body click listener for dynamic elements
    document.body.addEventListener('click', async (e) => {
        const user = getCurrentUser();
        const target = e.target;
        if (target.closest('.product-card') && !target.closest('.product-actions')) {
            location.hash = '#product/' + target.closest('.product-card').dataset.productId;
        } else if (target.closest('.add-to-cart-btn')) {
            const btn = target.closest('.add-to-cart-btn');
            if (!user) { openAuthModal(); showToast('سجّل الدخول لإضافة منتجات للسلة', 'error'); return; }
            if (btn.classList.contains('loading')) return;
            
            const productId = btn.dataset.productId;
            const product = products.find(p => p.id === productId);
            
            // التحقق من وجود أحجام متعددة
            if (product && product.sizes && product.sizes.length > 1) {
                // فتح نافذة اختيار الحجم
                openSizeSelectionModal(productId);
                return;
            }
            
            // إذا كان منتج بحجم واحد، أضف مباشرة للسلة
            btn.classList.add('loading');
            btn.disabled = true;
            const icon = btn.querySelector('i');
            const spinner = btn.querySelector('.cart-spinner');
            if (icon) icon.style.display = 'none';
            if (spinner) spinner.style.display = 'inline-block';
            
            try {
                await addToCart(productId, false);
                updateCartCount();
            } finally {
                if (icon) icon.style.display = '';
                if (spinner) spinner.style.display = 'none';
                btn.disabled = false;
                btn.classList.remove('loading');
            }
        } else if (target.closest('.add-to-fav-btn')) {
            if (!user) { openAuthModal(); showToast('سجّل الدخول لإضافة للمفضلة', 'error'); return; }
            toggleFavorite(target.closest('.add-to-fav-btn').dataset.productId);
        } else if (target.id === 'auth-modal' || target.id === 'close-auth-modal') {
            closeAuthModal();
        }
    });

    // Static product modal listeners
    document.getElementById('close-product-modal')?.addEventListener('click', closeProductModal);
    document.getElementById('modal-add-cart')?.addEventListener('click', async () => {
        if (!getCurrentUser()) { openAuthModal(); showToast('يجب تسجيل الدخول أولاً', 'error'); return; }
        
        const product = products.find(p => p.id === modalCurrentProductId);
        
        // التحقق من وجود أحجام متعددة
        if (product && product.sizes && product.sizes.length > 1) {
            // فتح نافذة اختيار الحجم
            closeProductModal();
            openSizeSelectionModal(modalCurrentProductId);
            return;
        }
        
        // إذا كان منتج بحجم واحد، أضف مباشرة للسلة
        const btn = document.getElementById('modal-add-cart');
        if (btn.classList.contains('loading')) return;
        
        btn.classList.add('loading');
        btn.disabled = true;
        
        try {
            await addToCart(modalCurrentProductId, true);
            updateCartCount();
            showToast('تم إضافة المنتج إلى السلة!', 'success');
        } finally {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    });
    document.getElementById('modal-add-fav')?.addEventListener('click', () => {
        if (!getCurrentUser()) { openAuthModal(); showToast('يجب تسجيل الدخول أولاً', 'error'); return; }
        toggleFavorite(modalCurrentProductId);
    });

    // إعداد مستمعي أحداث نافذة اختيار الحجم
    setupSizeSelectionListeners();

    // --- Auth event listeners moved here from auth.js ---
    document.getElementById('login-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        
        // إخفاء أي أخطاء سابقة
        hideAuthError('login-error');
        
        if (!email || !password) {
            showAuthError('login-error', 'الرجاء إدخال البريد وكلمة المرور');
            return;
        }
        
        // إظهار loading
        btn.disabled = true;
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loading').style.display = 'inline-block';
        
        try {
            await handleLogin(email, password);
            closeAuthModal();
            showToast('تم تسجيل الدخول بنجاح!', 'success');
        } catch (error) {
            let errorMessage = 'خطأ في تسجيل الدخول';
            if (error.message === 'EMAIL_NOT_VERIFIED') {
                errorMessage = 'يرجى التحقق من بريدك الإلكتروني أولاً قبل تسجيل الدخول';
                showEmailVerificationModal();
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'البريد الإلكتروني غير مسجل';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'كلمة المرور غير صحيحة';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'البريد الإلكتروني غير صحيح';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'تم تجاوز عدد المحاولات المسموح. حاول مرة أخرى لاحقاً';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'خطأ في الاتصال. تحقق من اتصال الإنترنت';
            }
            showToast(errorMessage, 'error');
        } finally {
            // إخفاء loading
            btn.disabled = false;
            btn.querySelector('.btn-text').style.display = 'inline-block';
            btn.querySelector('.btn-loading').style.display = 'none';
        }
    });

    document.getElementById('signup-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const btn = document.getElementById('signup-btn');
        
        // إخفاء أي أخطاء سابقة
        hideAuthError('signup-error');
        
        if (!name || !email || !password || !confirmPassword) {
            showToast('الرجاء ملء جميع الحقول', 'error');
            return;
        }
        
        if (password.length < 6) {
            showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showToast('كلمة المرور وتأكيدها غير متطابقين', 'error');
            return;
        }
        
        // إظهار loading
        btn.disabled = true;
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loading').style.display = 'inline-block';
        
        try {
            await handleSignup(email, password, name);
            showEmailVerificationModal();
            showToast('تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني', 'success');
        } catch (error) {
            let errorMessage = 'خطأ في إنشاء الحساب';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'البريد الإلكتروني غير صحيح';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'كلمة المرور ضعيفة جداً';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'خطأ في الاتصال. تحقق من اتصال الإنترنت';
            }
            showToast(errorMessage, 'error');
        } finally {
            // إخفاء loading
            btn.disabled = false;
            btn.querySelector('.btn-text').style.display = 'inline-block';
            btn.querySelector('.btn-loading').style.display = 'none';
        }
    });

    const googleSignInHandler = async () => {
        const btn = event.target;
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        
        // إظهار loading
        btn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-block';
        
        try {
            await handleGoogleSignIn();
            closeAuthModal();
            showToast('تم تسجيل الدخول بنجاح!', 'success');
        } catch (error) {
            let errorMessage = 'خطأ في الدخول عبر جوجل';
            if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = 'تم إغلاق نافذة الدخول';
            } else if (error.code === 'auth/cancelled-popup-request') {
                errorMessage = 'تم إلغاء عملية الدخول';
            }
            showToast(errorMessage, 'error');
        } finally {
            // إخفاء loading
            btn.disabled = false;
            btnText.style.display = 'inline-block';
            btnLoading.style.display = 'none';
        }
    };
    document.getElementById('google-signin-btn')?.addEventListener('click', googleSignInHandler);
    document.getElementById('google-signup-btn')?.addEventListener('click', googleSignInHandler);

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        handleLogout()
            .then(() => showToast('تم تسجيل الخروج بنجاح!', 'success'))
            .catch(error => showToast(`خطأ: ${error.message}`, 'error'));
    });

    // Auth modal form toggling
    document.getElementById('show-signup')?.addEventListener('click', (e) => { e.preventDefault(); showSignupForm(); });
    document.getElementById('show-login')?.addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });

    // Custom event listener to update UI when favorites change
    document.addEventListener('favoritesUpdated', () => {
        if (location.hash === '#favorites') {
            renderFavorites();
        }
        document.querySelectorAll('.product-card').forEach(card => {
            const favBtn = card.querySelector('.add-to-fav-btn');
            const productId = card.dataset.productId;
            if (favBtn && productId) {
                favBtn.classList.toggle('fav', favorites.includes(productId));
            }
        });
        if (document.getElementById('product-modal')?.classList.contains('open')) {
            const favBtn = document.getElementById('modal-add-fav');
            const isFav = favorites.includes(modalCurrentProductId);
            favBtn.classList.toggle('fav', isFav);
            favBtn.innerHTML = `<i class="fas fa-heart"></i> ${isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}`;
        }
    });
}

// دالة مساعدة لفحص حالة التصنيفات
function checkCategoriesLoaded() {
    return categories && categories.length > 0;
}

export function renderCategoryTabs() {
    const tabs = document.getElementById('categories-tabs');
    if (!tabs) return;
    
    // تأكد من تحميل التصنيفات أولاً
    if (!checkCategoriesLoaded()) {
        // إعادة المحاولة بعد فترة قصيرة
        setTimeout(renderCategoryTabs, 200);
        return;
    }
    
    // إنشاء تبويبات التصنيفات
    tabs.innerHTML = `<button class="category-tab active" data-category="all">الكل</button>` +
        categories.map(cat => `<button class="category-tab" data-category="${cat.id}">${cat.name}</button>`).join('');
    
    // تفعيل الفلترة عند الضغط
    tabs.querySelectorAll('.category-tab').forEach(tab => {
        tab.onclick = function() {
            // إزالة الفئة النشطة من جميع التبويبات
            tabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            // إضافة الفئة النشطة للتبويب المحدد
            tab.classList.add('active');
            
            // مسح البحث
            const searchInput = document.getElementById('shop-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            
            // إعادة عرض المنتجات مع الفلتر الجديد
            import('./shop.js').then(module => {
                module.renderShop();
            });
        };
    });
    
    // إضافة مستمعي الأحداث للتبويبات
    tabs.addEventListener('click', function(e) {
        if (e.target.classList.contains('category-tab')) {
            // إزالة الفئة النشطة من جميع التبويبات
            tabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            // إضافة الفئة النشطة للتبويب المحدد
            e.target.classList.add('active');
            
            // مسح البحث
            const searchInput = document.getElementById('shop-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            
            // إعادة عرض المنتجات مع الفلتر الجديد
            import('./shop.js').then(module => {
                module.renderShop();
            });
        }
    });
}

export function renderFeaturedProducts() {
    const featuredGrid = document.getElementById('featured-products-grid');
    if (!featuredGrid) return;
    
    const featuredProducts = products.filter(p => p.featured).slice(0, 6);
    featuredGrid.innerHTML = featuredProducts.map(makeProductCard).join('');
}

// متغير عام لتتبع interval العروض المميزة
let featuredOffersInterval = null;

export function renderFeaturedOffers() {
    const container = document.getElementById('offers-container');
    const indicatorsContainer = document.getElementById('offers-indicators');
    if (!container) return;
    
    // تنظيف الـ interval السابق إذا كان موجود
    if (featuredOffersInterval) {
        clearInterval(featuredOffersInterval);
        featuredOffersInterval = null;
    }
    
    // إظهار دائرة التحميل
    container.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>جاري تحميل العروض الحصرية...</p>
        </div>
    `;
    
    // انتظار قليل لتحميل العروض
    setTimeout(() => {
        // الحصول على العروض من main.js
        import('./main.js').then(module => {
            const offers = module.offers || [];
            
            if (offers.length === 0) {
                container.innerHTML = '<p class="empty-message">لا توجد عروض حصرية حاليًا.</p>';
                indicatorsContainer.innerHTML = '';
                return;
            }
            
            // عرض أول 4 عروض فقط
            const featuredOffers = offers.slice(0, 4);
            
            // إنشاء كارت واحد فقط مع إمكانية التبديل
            function createOfferCard(offer) {
                // حساب الأيام المتبقية إذا كان هناك مدة
                let durationText = '';
                if (offer.duration) {
                    const durationStr = String(offer.duration);
                    const match = durationStr.match(/(\d+)/);
                    if (match) {
                        const days = parseInt(match[1]);
                        durationText = `ينتهي بعد ${days} يوم`;
                    } else {
                        durationText = durationStr;
                    }
                }
                
                return `
                    <div class="featured-offer-card" onclick="location.hash='#offer/${offer.id}'">
                        <img src="${offer.image || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740'}" alt="${offer.title}">
                        <div class="featured-offer-content">
                            <h3 class="featured-offer-title">${offer.title}</h3>
                            <p class="featured-offer-desc">${offer.description || ''}</p>
                            <div class="featured-offer-meta">
                                ${offer.discount ? `<span class="featured-offer-discount">خصم ${offer.discount} جنيه</span>` : ''}
                                ${durationText ? `<span class="featured-offer-duration">${durationText}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // عرض أول عرض
            container.innerHTML = createOfferCard(featuredOffers[0]);
            
            // إضافة المؤشرات إذا كان هناك أكثر من عرض
            if (featuredOffers.length > 1) {
                indicatorsContainer.innerHTML = featuredOffers.map((_, index) => 
                    `<div class="offers-indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`
                ).join('');
                
                // تفعيل auto-slide
                setupAutoSlide(featuredOffers, createOfferCard);
            } else {
                indicatorsContainer.innerHTML = '';
                // إذا كان عرض واحد فقط، اجعله يملأ العرض بالكامل
                const singleCard = container.querySelector('.featured-offer-card');
                if (singleCard) {
                    singleCard.style.minWidth = '100%';
                    singleCard.style.maxWidth = '100%';
                }
            }
            
        }).catch(error => {
            console.error('خطأ في تحميل العروض:', error);
            container.innerHTML = '<p class="empty-message">خطأ في تحميل العروض الحصرية.</p>';
            indicatorsContainer.innerHTML = '';
        });
    }, 500);
}

// دالة إعداد auto-slide للعروض
function setupAutoSlide(offers, createCardFunction) {
    const container = document.getElementById('offers-container');
    const indicators = document.querySelectorAll('.offers-indicator');
    
    let currentIndex = 0;
    
    // تنظيف الـ interval السابق
    if (featuredOffersInterval) {
        clearInterval(featuredOffersInterval);
    }
    
    // الانتقال إلى عرض معين
    function goToSlide(index) {
        currentIndex = index;
        // إضافة تأثير fade out
        container.style.opacity = '0';
        // بعد انتهاء الـ fade out، غيّر المحتوى ثم أضف fade in
        setTimeout(() => {
            container.innerHTML = createCardFunction(offers[currentIndex]);
            // إعادة تفعيل transition بعد تغيير المحتوى
            container.style.transition = 'none';
            container.style.opacity = '0';
            // إعادة تفعيل transition بعد إعادة رسم العنصر
            setTimeout(() => {
                container.style.transition = 'opacity 0.3s ease';
                container.style.opacity = '1';
            }, 10);
            // تحديث المؤشرات
            const indicators = document.querySelectorAll('.offers-indicator');
            indicators.forEach((indicator, i) => {
                indicator.classList.toggle('active', i === currentIndex);
            });
        }, 300);
    }
    
    // الانتقال للعرض التالي
    function nextSlide() {
        const nextIndex = (currentIndex + 1) % offers.length;
        goToSlide(nextIndex);
    }
    
    // تفعيل auto-slide كل 3 ثوان
    featuredOffersInterval = setInterval(nextSlide, 3000);
    
    // إيقاف auto-slide عند hover
    container.addEventListener('mouseenter', () => {
        if (featuredOffersInterval) {
            clearInterval(featuredOffersInterval);
        }
    });
    
    // إعادة تفعيل auto-slide عند مغادرة الماوس
    container.addEventListener('mouseleave', () => {
        featuredOffersInterval = setInterval(nextSlide, 3000);
    });
    
    // النقر على المؤشرات
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            if (featuredOffersInterval) {
                clearInterval(featuredOffersInterval);
            }
            goToSlide(index);
            // إعادة تفعيل auto-slide بعد النقر
            featuredOffersInterval = setInterval(nextSlide, 3000);
        });
    });
    
    // إضافة CSS للانتقالات
    container.style.transition = 'opacity 0.3s ease';
}

// دالة تنظيف intervals العروض المميزة
export function cleanupFeaturedOffers() {
    if (featuredOffersInterval) {
        clearInterval(featuredOffersInterval);
        featuredOffersInterval = null;
    }
}

// --- دوال إدارة كلمات المرور ---

// دالة تبديل عرض/إخفاء كلمة المرور
window.togglePassword = function(inputId) {
    const input = document.getElementById(inputId);
    const toggleBtn = input.parentElement.querySelector('.password-toggle');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        toggleBtn.classList.add('showing');
    } else {
        input.type = 'password';
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        toggleBtn.classList.remove('showing');
    }
};

// دالة التحقق من قوة كلمة المرور
function checkPasswordStrength(password) {
    if (password.length < 6) return 'weak';
    if (password.length < 8) return 'medium';
    return 'strong';
}

// دالة التحقق من تطابق كلمات المرور
function checkPasswordMatch(password, confirmPassword) {
    return password === confirmPassword;
}

// دالة إضافة مؤشرات قوة كلمة المرور
function addPasswordStrengthIndicator(inputId, strengthId) {
    const input = document.getElementById(inputId);
    const strengthDiv = document.getElementById(strengthId);
    
    if (!input || !strengthDiv) return;
    
    input.addEventListener('input', function() {
        const strength = checkPasswordStrength(this.value);
        const strengthText = {
            weak: 'ضعيفة',
            medium: 'متوسطة',
            strong: 'قوية'
        };
        
        strengthDiv.textContent = `قوة كلمة المرور: ${strengthText[strength]}`;
        strengthDiv.className = `password-strength ${strength}`;
    });
}

// دالة إضافة مؤشر تطابق كلمات المرور
function addPasswordMatchIndicator(passwordId, confirmId, matchId) {
    const passwordInput = document.getElementById(passwordId);
    const confirmInput = document.getElementById(confirmId);
    const matchDiv = document.getElementById(matchId);
    
    if (!passwordInput || !confirmInput || !matchDiv) return;
    
    function checkMatch() {
        const match = checkPasswordMatch(passwordInput.value, confirmInput.value);
        matchDiv.textContent = match ? 'كلمات المرور متطابقة' : 'كلمات المرور غير متطابقة';
        matchDiv.className = `password-match ${match ? 'match' : 'no-match'}`;
    }
    
    passwordInput.addEventListener('input', checkMatch);
    confirmInput.addEventListener('input', checkMatch);
}

// --- دوال إدارة إعدادات الحساب ---

// دالة فتح مودال إعدادات الحساب
export function openProfileSettingsModal() {
    const modal = document.getElementById('profile-settings-modal');
    if (!modal) return;
    
    const user = getCurrentUser();
    if (!user) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    // إظهار/إخفاء قسم تغيير كلمة المرور حسب نوع الحساب
    const changePasswordSection = document.getElementById('change-password-section');
    if (changePasswordSection) {
        changePasswordSection.style.display = canChangePassword() ? 'block' : 'none';
    }
    
    // تعيين الاسم الحالي في حقل تغيير الاسم
    const newNameInput = document.getElementById('new-name');
    if (newNameInput) {
        newNameInput.value = user.displayName || '';
    }
    
    modal.classList.add('open');
}

// دالة إغلاق مودال إعدادات الحساب
export function closeProfileSettingsModal() {
    const modal = document.getElementById('profile-settings-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

// دالة تغيير اسم المستخدم
async function handleChangeName() {
    const newName = document.getElementById('new-name').value.trim();
    const btn = document.querySelector('#change-name-form .big-btn');
    
    if (!newName) {
        showToast('يرجى إدخال اسم جديد', 'error');
        return;
    }
    
    // إظهار loading
    btn.disabled = true;
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loading').style.display = 'inline-block';
    
    try {
        await changeDisplayName(newName);
        showToast('تم تغيير الاسم بنجاح!', 'success');
        
        // تحديث واجهة المستخدم
        updateAuthUI(getCurrentUser());
        
        // إغلاق المودال
        closeProfileSettingsModal();
    } catch (error) {
        showToast(`خطأ في تغيير الاسم: ${error.message}`, 'error');
    } finally {
        // إخفاء loading
        btn.disabled = false;
        btn.querySelector('.btn-text').style.display = 'inline-block';
        btn.querySelector('.btn-loading').style.display = 'none';
    }
}

// تغيير كلمة المرور
document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    // إخفاء أي أخطاء سابقة
    hideAuthError('change-password-error');
    
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showAuthError('change-password-error', 'الرجاء ملء جميع الحقول');
        return;
    }
    
    if (newPassword.length < 6) {
        showAuthError('change-password-error', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        showAuthError('change-password-error', 'كلمة المرور الجديدة وتأكيدها غير متطابقين');
        return;
    }
    
    // إظهار loading
    btn.disabled = true;
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loading').style.display = 'inline-block';
    
    try {
        await changePassword(currentPassword, newPassword);
        showToast('تم تغيير كلمة المرور بنجاح!', 'success');
        // مسح الحقول
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';
    } catch (error) {
        let errorMessage = 'خطأ في تغيير كلمة المرور';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'كلمة المرور الحالية غير صحيحة';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'كلمة المرور الجديدة ضعيفة جداً';
        }
        showAuthError('change-password-error', errorMessage);
    } finally {
        // إخفاء loading
        btn.disabled = false;
        btn.querySelector('.btn-text').style.display = 'inline-block';
        btn.querySelector('.btn-loading').style.display = 'none';
    }
});

// دوال التنقل في المودال
function showPrevModalImage() {
    if (modalImages.length <= 1) return;
    modalCurrentIndex = (modalCurrentIndex - 1 + modalImages.length) % modalImages.length;
    document.getElementById('modal-image').src = modalImages[modalCurrentIndex];
    updateModalNavButtons();
}
function showNextModalImage() {
    if (modalImages.length <= 1) return;
    modalCurrentIndex = (modalCurrentIndex + 1) % modalImages.length;
    document.getElementById('modal-image').src = modalImages[modalCurrentIndex];
    updateModalNavButtons();
}
function updateModalNavButtons() {
    const prevBtn = document.getElementById('modal-image-prev');
    const nextBtn = document.getElementById('modal-image-next');
    if (!prevBtn || !nextBtn) return;
    if (modalImages.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    }
}

// إضافة مستمعي الأحداث للأزرار
setTimeout(() => {
    const prevBtn = document.getElementById('modal-image-prev');
    const nextBtn = document.getElementById('modal-image-next');
    
    if (prevBtn) {
        prevBtn.onclick = showPrevModalImage;
    }
    if (nextBtn) {
        nextBtn.onclick = showNextModalImage;
    }
    
    // دعم الأسهم من الكيبورد
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('image-modal');
        if (!modal || !modal.classList.contains('open')) return;
        
        if (e.key === 'ArrowLeft') {
            showPrevModalImage();
        } else if (e.key === 'ArrowRight') {
            showNextModalImage();
        } else if (e.key === 'Escape') {
            closeImageModal();
        }
    });
}, 200);

// إعداد دعم السحب
function setupModalSwipe() {
    const modalImage = document.getElementById('modal-image');
    if (!modalImage) return;

    // إزالة المستمعين السابقين
    modalImage.removeEventListener('mousedown', startDrag);
    modalImage.removeEventListener('touchstart', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchend', endDrag);

    // إضافة المستمعين الجدد
    modalImage.addEventListener('mousedown', startDrag);
    modalImage.addEventListener('touchstart', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
    
    console.log('تم إعداد دعم السحب للمودال');
}

function startDrag(e) {
    if (modalImages.length <= 1) return;
    
    isDragging = true;
    startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    currentX = startX;
    
    const modalImage = document.getElementById('modal-image');
    modalImage.style.transition = 'none';
    modalImage.style.cursor = 'grabbing';
    modalImage.classList.add('dragging');
    
    console.log('بدء السحب:', startX);
}

function drag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
    
    const modalImage = document.getElementById('modal-image');
    const deltaX = currentX - startX;
    modalImage.style.transform = `translateX(${deltaX}px)`;
}

function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    const deltaX = currentX - startX;
    const threshold = mainImage.offsetWidth / 3; // ثلث عرض الصورة للسهولة
    mainImage.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    nextImage.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    prevImage.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    if (deltaX > threshold) {
        // سحب لليمين - عرض الصورة السابقة (اليسار)
        mainImage.style.transform = `translateX(${mainImage.offsetWidth}px)`;
        prevImage.style.transform = `translateX(0)`;
        setTimeout(() => {
            currentImageIndex = (currentImageIndex - 1 + window._allProductImages.length) % window._allProductImages.length;
            window._currentImageIndex = currentImageIndex; // تحديث المتغير العام
            updateProductImage();
            resetTransforms();
        }, 400);
    } else if (deltaX < -threshold) {
        // سحب لليسار - عرض الصورة التالية (اليمين)
        mainImage.style.transform = `translateX(-${mainImage.offsetWidth}px)`;
        nextImage.style.transform = `translateX(0)`;
        setTimeout(() => {
            currentImageIndex = (currentImageIndex + 1) % window._allProductImages.length;
            window._currentImageIndex = currentImageIndex; // تحديث المتغير العام
            updateProductImage();
            resetTransforms();
        }, 400);
    } else {
        // رجع الصور لمكانها مع انيميشن سلس
        mainImage.style.transform = '';
        nextImage.style.transform = `translateX(${mainImage.offsetWidth}px)`;
        prevImage.style.transform = `translateX(-${mainImage.offsetWidth}px)`;
    }
    setTimeout(() => {
        mainImage.style.transition = '';
        nextImage.style.transition = '';
        prevImage.style.transition = '';
    }, 350);
}

function resetTransforms() {
    mainImage.style.transform = '';
    nextImage.style.transform = `translateX(${mainImage.offsetWidth}px)`;
    prevImage.style.transform = `translateX(-${mainImage.offsetWidth}px)`;
}

function updateProductImage() {
    mainImage.src = window._allProductImages[currentImageIndex];
    updateImageIndexes();
    resetTransforms();
    // تحديث الصور المصغرة
    document.querySelectorAll('.thumbnail-img').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === currentImageIndex);
    });
    // تحديث onclick للصورة الرئيسية
    mainImage.onclick = function() {
        openImageModal(mainImage.src, window._allProductImages);
    };
}

// تحديث صور الجانبين بناءً على الصورة الحالية
function updateImageIndexes() {
    if (!window._allProductImages || typeof currentImageIndex === 'undefined') return;
    if (!nextImage || !prevImage) return;
    const total = window._allProductImages.length;
    // الصورة التالية
    const nextIdx = (currentImageIndex + 1) % total;
    nextImage.src = window._allProductImages[nextIdx];
    // الصورة السابقة
    const prevIdx = (currentImageIndex - 1 + total) % total;
    prevImage.src = window._allProductImages[prevIdx];
}

// دالة إعداد السحب للصورة الرئيسية في صفحة المنتج
function setupProductImageSwipe() {
    mainImage = document.getElementById('main-product-image');
    if (!mainImage || !window._allProductImages || window._allProductImages.length <= 1) return;
    
    currentImageIndex = window._currentImageIndex || 0;
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    
    // إنشاء الصور الجانبية
    nextImage = document.createElement('img');
    prevImage = document.createElement('img');
    nextImage.className = 'side-image next-image';
    prevImage.className = 'side-image prev-image';
    nextImage.style.position = 'absolute';
    prevImage.style.position = 'absolute';
    nextImage.style.top = '0';
    prevImage.style.top = '0';
    nextImage.style.zIndex = '-1';
    prevImage.style.zIndex = '-1';
    
    const container = mainImage.parentElement;
    if (container) {
        container.style.position = 'relative';
        container.appendChild(nextImage);
        container.appendChild(prevImage);
    }
    
    // تخزين مراجع الدوال للاستخدام في الإزالة
    window._startDrag = startDrag;
    window._drag = drag;
    window._endDrag = endDrag;

    // تهيئة الصور الجانبية عند البداية
    updateImageIndexes();
    resetTransforms();
    
    // تحديث الصور المصغرة لتتطابق مع الصورة الحالية
    document.querySelectorAll('.thumbnail-img').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === currentImageIndex);
    });

    // إضافة مستمعي الأحداث للماوس
    mainImage.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    // إضافة مستمعي الأحداث للمس
    mainImage.addEventListener('touchstart', startDrag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', endDrag);
}

// إعداد مستمعي أحداث نافذة اختيار الحجم
function setupSizeSelectionListeners() {
    // مستمع حدث لإغلاق نافذة اختيار الحجم
    document.getElementById('cancel-size-selection')?.addEventListener('click', () => {
        closeSizeSelectionModal();
    });
    
    // مستمع حدث لزر الإغلاق
    document.getElementById('close-size-modal')?.addEventListener('click', () => {
        closeSizeSelectionModal();
    });
    
    // مستمع حدث لتأكيد اختيار الحجم
    document.getElementById('confirm-size-selection')?.addEventListener('click', async () => {
        const modal = document.getElementById('size-selection-modal');
        const selectedSize = modal?.querySelector('.size-option.selected');
        
        if (!selectedSize) {
            showToast('يرجى اختيار حجم', 'error');
            return;
        }
        
        const productId = modal.dataset.productId;
        const sizeIndex = parseInt(selectedSize.dataset.sizeIndex);
        
        const btn = document.getElementById('confirm-size-selection');
        if (btn.classList.contains('loading')) return;
        
        btn.classList.add('loading');
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="cart-spinner"></span> جاري الإضافة...';
        
        try {
            await addToCart(productId, true, sizeIndex);
            updateCartCount();
            showToast('تم إضافة المنتج إلى السلة!', 'success');
            closeSizeSelectionModal();
        } catch (error) {
            showToast('خطأ في إضافة المنتج للسلة', 'error');
        } finally {
            btn.disabled = false;
            btn.classList.remove('loading');
            btn.innerHTML = originalText;
        }
    });
    
    // مستمعي أحداث اختيار الأحجام - استخدام event delegation
    document.addEventListener('click', (e) => {
        const sizeOption = e.target.closest('.size-option');
        if (sizeOption) {
            const modal = document.getElementById('size-selection-modal');
            if (!modal) return;
            
            // إزالة التحديد من جميع الأحجام
            modal.querySelectorAll('.size-option').forEach(option => {
                option.classList.remove('selected');
            });
            
            // تحديد الحجم المختار
            sizeOption.classList.add('selected');
            
            // تفعيل زر التأكيد
            const confirmBtn = document.getElementById('confirm-size-selection');
            if (confirmBtn) {
                confirmBtn.disabled = false;
            }
        }
    });
}

// دالة فتح نافذة اختيار الحجم
function openSizeSelectionModal(productId) {
    const modal = document.getElementById('size-selection-modal');
    const product = products.find(p => p.id === productId);
    
    if (!modal || !product) {
        showToast('خطأ في فتح نافذة اختيار الحجم', 'error');
        return;
    }
    
    // إذا لم تكن هناك أحجام متعددة، أضف مباشرة للسلة
    if (!product.sizes || product.sizes.length <= 1) {
        addToCart(productId, true);
        return;
    }
    
    // تعيين معرف المنتج في المودال
    modal.dataset.productId = productId;
    
    // تحديث معلومات المنتج
    const productImg = document.getElementById('size-modal-product-img');
    const productName = document.getElementById('size-modal-product-name');
    const productDesc = document.getElementById('size-modal-product-desc');
    
    if (productImg) {
        productImg.src = product.image || product.img || 'https://img.freepik.com/free-vector/realistic-cup-black-brewed-coffee-saucer-vector-illustration_1284-66002.jpg?semt=ais_hybrid&w=740';
        productImg.alt = product.name;
    }
    
    if (productName) {
        productName.textContent = product.name;
    }
    
    if (productDesc) {
        productDesc.textContent = product.description || product.desc || '';
    }
    
    // إنشاء خيارات الأحجام
    const sizesContainer = document.getElementById('size-options');
    if (sizesContainer) {
        sizesContainer.innerHTML = product.sizes.map((size, index) => {
            const priceDisplay = size.discount && size.discount > 0 
                ? `<span class="discounted-price">${size.discount} جنيه</span> <span class="old-price">${size.price} جنيه</span>`
                : `<span class="price">${size.price} جنيه</span>`;
            
            return `
                <div class="size-option" data-size-index="${index}">
                    <span class="size-name">${size.name}</span>
                    <span class="size-price">${priceDisplay}</span>
                </div>
            `;
        }).join('');
    }
    
    // فتح المودال
    modal.classList.add('open');
    
    // تعطيل زر التأكيد حتى يتم اختيار حجم
    const confirmBtn = document.getElementById('confirm-size-selection');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
}

// دالة إغلاق نافذة اختيار الحجم
function closeSizeSelectionModal() {
    const modal = document.getElementById('size-selection-modal');
    if (modal) {
        modal.classList.remove('open');
        // إزالة التحديد من جميع الأحجام
        modal.querySelectorAll('.size-option').forEach(option => {
            option.classList.remove('selected');
        });
    }
}

// إعداد مستمعي أحداث تبويبات الأحجام
function setupSizeTabsListeners(productId) {
    const sizeTabs = document.querySelectorAll('.size-tab');
    const addToCartBtn = document.getElementById('product-add-cart');
    
    sizeTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            // إزالة الفئة النشطة من جميع التبويبات
            sizeTabs.forEach(t => t.classList.remove('active'));
            // إضافة الفئة النشطة للتبويب المحدد
            tab.classList.add('active');
            
            // تحديث السعر المعروض
            const product = products.find(p => p.id === productId);
            if (product && product.sizes && product.sizes[index]) {
                const size = product.sizes[index];
                const priceElement = document.querySelector('.product-page-info .price');
                if (priceElement) {
                    if (size.discount && size.discount > 0) {
                        priceElement.innerHTML = `<span class="discounted-price">${size.discount} جنيه</span> <span class="old-price">${size.price} جنيه</span>`;
                    } else {
                        priceElement.innerHTML = `<span class="price">${size.price} جنيه</span>`;
                    }
                }
            }
            
            // تحديث معرف الحجم المحدد في زر إضافة للسلة
            if (addToCartBtn) {
                addToCartBtn.dataset.selectedSize = index;
            }
        });
    });
}
