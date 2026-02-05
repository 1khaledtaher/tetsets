import { getCurrentUser } from './auth.js';
import { showToast } from './ui.js';
import { currentUserData, saveShippingData } from './api.js';
import { loadCustomerData, saveCustomerData, clearCustomerData, isCustomerDataComplete, customerData } from './customer-data.js';

export function renderProfile() {
    const user = getCurrentUser();
    if (!user) return;
    
    // تحديث بيانات الحساب الأساسية
    document.getElementById('profile-fullname').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-date').textContent = new Date(user.metadata.creationTime).toLocaleDateString('ar-EG');
    document.getElementById('profile-avatar-img').src = user.photoURL || `https://ui-avatars.com/api/?background=3b82f6&color=fff&name=${encodeURIComponent(user.displayName || user.email.charAt(0))}`;
    
    // تحميل بيانات التوصيل
    loadCustomerData();
}

let listenersAttached = false;
function setupProfileListeners() {
    if (listenersAttached) return;
    
    // زر بيانات التوصيل
    document.getElementById('shipping-data-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('shipping-data-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small"></div>';
        
        try {
            await openShippingDataModal();
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
    
    // زر تسجيل الخروج
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            const btn = document.getElementById('logout-btn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner-small"></div>';
            
            try {
                // سيتم التعامل مع تسجيل الخروج في auth.js
                window.location.reload();
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    });
    
    // مستمعي أحداث النافذة المنبثقة
    setupShippingModalListeners();
    
    listenersAttached = true;
}

// دوال النافذة المنبثقة لبيانات التوصيل
async function openShippingDataModal() {
    const modal = document.getElementById('shipping-data-modal');
    if (!modal) return;
    
    // تحميل البيانات الحالية
    await loadCustomerData();
    if (isCustomerDataComplete()) {
        showShippingDataDisplay();
    } else {
        showShippingDataForm();
    }
    modal.classList.add('open');
}

// جعل الدالة متاحة في النطاق العام
window.openShippingDataModal = openShippingDataModal;

function closeShippingDataModal() {
    const modal = document.getElementById('shipping-data-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

function showShippingDataDisplay() {
    const displayContainer = document.getElementById('shipping-data-display');
    const formContainer = document.getElementById('shipping-data-form');
    const contentContainer = document.getElementById('saved-shipping-data');
    
    if (!displayContainer || !formContainer || !contentContainer) return;
    
    displayContainer.style.display = 'block';
    formContainer.style.display = 'none';
    
    contentContainer.innerHTML = `
        <div class="data-item">
            <span class="data-label">الاسم بالكامل:</span>
            <span class="data-value">${customerData.fullName}</span>
        </div>
        <div class="data-item">
            <span class="data-label">رقم الهاتف:</span>
            <span class="data-value">${customerData.phoneNumber}</span>
        </div>
        <div class="data-item">
            <span class="data-label">رقم هاتف آخر:</span>
            <span class="data-value ${customerData.phoneNumber2 ? '' : 'empty'}">${customerData.phoneNumber2 || 'غير محدد'}</span>
        </div>
        <div class="data-item">
            <span class="data-label">العنوان:</span>
            <span class="data-value">${customerData.address}</span>
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
    
    if (!displayContainer || !formContainer) return;
    
    displayContainer.style.display = 'none';
    formContainer.style.display = 'block';
    
    // ملء النموذج بالبيانات الموجودة
    document.getElementById('modal-full-name').value = customerData.fullName || '';
    document.getElementById('modal-phone-number').value = customerData.phoneNumber || '';
    document.getElementById('modal-phone-number-2').value = customerData.phoneNumber2 || '';
    document.getElementById('modal-address').value = customerData.address || '';
    document.getElementById('modal-landmark').value = customerData.landmark || '';
}

function setupShippingModalListeners() {
    // إغلاق النافذة
    document.getElementById('close-shipping-modal')?.addEventListener('click', closeShippingDataModal);
    document.getElementById('cancel-shipping-data')?.addEventListener('click', closeShippingDataModal);
    
    // إغلاق النافذة عند الضغط خارجها
    document.getElementById('shipping-data-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'shipping-data-modal') {
            closeShippingDataModal();
        }
    });
    
    // نموذج حفظ البيانات
    document.getElementById('shipping-data-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
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
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
    
    // زر تعديل البيانات
    document.getElementById('edit-shipping-data')?.addEventListener('click', showShippingDataForm);
}

setupProfileListeners();