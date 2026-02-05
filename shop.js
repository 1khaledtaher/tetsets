import { products, categories } from './api.js';
import { makeProductCard, renderCategoryTabs } from './ui.js';

// متغير عام لتخزين كلمة البحث الحالية
let currentSearchQuery = '';
let searchTimeout = null;
let isSearching = false;

function fuzzyMatch(str, q) {
    str = (str || "").toLowerCase();
    q = q.toLowerCase();
    
    // البحث المباشر أولاً
    if (str.includes(q)) return true;
    
    // إذا كانت كلمة البحث قصيرة جداً
    if (q.length < 2) return false;
    
    // البحث المرن مع السماح بخطأين
    let diffs = 0;
    let i = 0, j = 0;
    
    while (i < str.length && j < q.length) {
        if (str[i] === q[j]) { 
            i++; 
            j++; 
        } else { 
            diffs++; 
            i++; 
            if (diffs > 2) return false; 
        }
    }
    
    return diffs <= 2;
}

// دالة البحث المحسنة
function searchProducts(query) {
    if (!query || query.trim() === '') {
        return products;
    }
    
    const searchTerm = query.trim();
    return products.filter(product => {
        // البحث في اسم المنتج
        if (fuzzyMatch(product.name, searchTerm)) return true;
        
        // البحث في وصف المنتج
        if (product.description && fuzzyMatch(product.description, searchTerm)) return true;
        
        // البحث في التصنيف
        if (product.category && fuzzyMatch(product.category, searchTerm)) return true;
        
        return false;
    });
}

// دالة تمييز النص المطابق
function highlightText(text, query) {
    if (!query || query.trim() === '') return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

// الكود الجديد والمُصحح لدالة renderShop
export function renderShop() {
    const grid = document.getElementById('shop-products-grid');
    if (!grid) {
        return;
    }

    // إنشاء تبويبات التصنيفات إذا لم تكن موجودة
    const tabs = document.getElementById('categories-tabs');
    if (tabs && tabs.children.length <= 1) {
        renderCategoryTabs();
    }

    // فلترة حسب عرض خاص
    let filteredProducts = [...products];
    const offerProducts = localStorage.getItem('shop_offer_products');
    if (offerProducts) {
        const ids = offerProducts.split(',').map(id => id.trim());
        filteredProducts = filteredProducts.filter(p => ids.includes(p.id));
        localStorage.removeItem('shop_offer_products');
    }

    // إظهار دائرة التحميل فقط إذا لم تكن المنتجات محملة بعد وليس أثناء البحث
    if (filteredProducts.length === 0 && products.length === 0 && !isSearching) {
        grid.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p>جاري تحميل المنتجات...</p>
            </div>
        `;
        return;
    }

    // فلترة حسب البحث
    if (currentSearchQuery.trim() !== '') {
        filteredProducts = searchProducts(currentSearchQuery);
    }

    // فلترة حسب التصنيف
    const activeTab = document.querySelector('.category-tab.active');
    const selectedCat = activeTab ? activeTab.dataset.category : 'all';
    
    if (selectedCat !== "all") {
        filteredProducts = filteredProducts.filter(p => {
            // التحقق من category أو categoryId
            return p.category === selectedCat || p.categoryId === selectedCat;
        });
    }

    // إظهار معلومات نتائج البحث
    let searchInfo = '';
    if (currentSearchQuery.trim() !== '') {
        const totalResults = filteredProducts.length;
        searchInfo = `
            <div class="search-results-info">
                تم العثور على <strong>${totalResults}</strong> منتج${totalResults === 1 ? '' : totalResults === 2 ? 'ين' : 'ات'} 
                لـ "<strong>${currentSearchQuery}</strong>"
            </div>
        `;
    }

    // عرض المنتجات مع تمييز النص المطابق
    const productsHTML = filteredProducts.length === 0
        ? '<p class="empty-message">لا توجد منتجات متاحة.</p>'
        : filteredProducts.map(product => {
            // تمييز النص المطابق في اسم المنتج
            const highlightedName = highlightText(product.name, currentSearchQuery);
            const highlightedDesc = product.description ? highlightText(product.description, currentSearchQuery) : '';
            
            // إنشاء نسخة معدلة من المنتج مع النص المميز
            const highlightedProduct = {
                ...product,
                name: highlightedName,
                description: highlightedDesc,
                originalName: product.name // حفظ الاسم الأصلي
            };
            
            return makeProductCard(highlightedProduct);
        }).join('');

    grid.innerHTML = searchInfo + productsHTML;
}

export function renderFeaturedProducts() {
    const container = document.getElementById('featured-products-grid');
    if (!container) return;
    
    // إظهار دائرة التحميل فقط إذا لم تكن المنتجات محملة بعد
    if (products.length === 0) {
        container.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p>جاري تحميل المنتجات المميزة...</p>
            </div>
        `;
        return;
    }
    
    let featuredProducts = products.filter(p => p.featured);
    if (featuredProducts.length === 0 && products.length > 0) {
        featuredProducts = products;
    }
    container.innerHTML = featuredProducts.length === 0
        ? '<p class="empty-message">لا توجد منتجات مميزة حاليًا.</p>'
        : featuredProducts.map(product => makeProductCard(product)).join('');
}

// دالة مسح البحث
export function clearSearch() {
    const searchInput = document.getElementById('shop-search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    
    if (searchInput) {
        searchInput.value = '';
        currentSearchQuery = '';
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        isSearching = false;
        
        // إلغاء البحث المعلق
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        renderShop();
    }
}

// دالة إعداد البحث
function setupSearch() {
    const searchInput = document.getElementById('shop-search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    
    if (!searchInput) return;
    
    // إضافة مستمع الأحداث للبحث مع تأخير
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value;
        
        // إظهار/إخفاء زر المسح
        if (query.trim() !== '') {
            clearBtn.style.display = 'block';
        } else {
            clearBtn.style.display = 'none';
        }
        
        // إلغاء البحث السابق
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // إظهار رسالة البحث إذا كان هناك نص
        if (query.trim() !== '') {
            isSearching = true;
            const grid = document.getElementById('shop-products-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="loading-container">
                        <div class="spinner"></div>
                        <p>جاري البحث...</p>
                    </div>
                `;
            }
        }
        
        // تأخير البحث لمدة 300 مللي ثانية
        searchTimeout = setTimeout(() => {
            currentSearchQuery = query;
            isSearching = false;
            renderShop();
        }, 300);
    });
    
    // زر مسح البحث
    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        currentSearchQuery = '';
        clearBtn.style.display = 'none';
        isSearching = false;
        
        // إلغاء البحث المعلق
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        renderShop();
        searchInput.focus();
    });
    
    // البحث عند الضغط على Enter
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            // إلغاء التأخير والبحث فوراً
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            currentSearchQuery = e.target.value;
            isSearching = false;
            renderShop();
            e.target.blur(); // إزالة التركيز من الحقل
        }
    });
}

// Add this entire function to shop.js
let listenersAttached = false;
export function initShop() {
    if (listenersAttached) return;

    // إعداد البحث أولاً
    setupSearch();

    // إعداد تبويبات التصنيف
    renderCategoryTabs();

    const categoryFilter = document.getElementById('shop-category-filter');
    const sortFilter = document.getElementById('shop-sort-filter');
    const searchFilter = document.getElementById('shop-search-filter');

    if (categoryFilter && sortFilter && searchFilter) {
        categoryFilter.addEventListener('change', renderShop);
        sortFilter.addEventListener('change', renderShop);
        searchFilter.addEventListener('input', renderShop);
    }
    
    listenersAttached = true;
}

// دالة تحميل المنتجات للاستخدام في main.js
export async function loadProducts() {
    // إذا كانت المنتجات محملة بالفعل، إرجاعها
    if (products && products.length > 0) {
        return products;
    }
    
    // إذا لم تكن محملة، انتظر قليلاً ثم أعد المحاولة
    await new Promise(resolve => setTimeout(resolve, 500));
    return products || [];
}