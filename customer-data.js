import { getCurrentUser } from './auth.js';
import { showToast } from './ui.js';
import { saveCustomerDataToDB, getCustomerDataFromDB } from './api.js';

// هيكل بيانات العميل
export let customerData = {
    fullName: '',
    phoneNumber: '',
    phoneNumber2: '',
    address: '',
    landmark: ''
};

// تحميل بيانات العميل
export async function loadCustomerData() {
    const user = getCurrentUser();
    if (!user) {
        // للمستخدمين الضيوف، استخدم localStorage
        const savedData = localStorage.getItem('customer_data_guest');
        if (savedData) {
            customerData = JSON.parse(savedData);
        }
        return;
    }

    try {
        const data = await getCustomerDataFromDB(user.uid);
        if (data) {
            customerData = { ...customerData, ...data };
        }
    } catch (error) {
        console.error('خطأ في تحميل بيانات العميل:', error);
    }
}

// حفظ بيانات العميل
export async function saveCustomerData(data) {
    const user = getCurrentUser();
    
    // تحديث البيانات المحلية
    customerData = { ...customerData, ...data };
    
    if (!user) {
        // للمستخدمين الضيوف، استخدم localStorage
        localStorage.setItem('customer_data_guest', JSON.stringify(customerData));
        return true;
    }

    try {
        await saveCustomerDataToDB(user.uid, customerData);
        return true;
    } catch (error) {
        console.error('خطأ في حفظ بيانات العميل:', error);
        showToast('حدث خطأ في حفظ البيانات', 'error');
        return false;
    }
}

// مسح بيانات العميل
export async function clearCustomerData() {
    const user = getCurrentUser();
    
    customerData = {
        fullName: '',
        phoneNumber: '',
        phoneNumber2: '',
        address: '',
        landmark: ''
    };
    
    if (!user) {
        localStorage.removeItem('customer_data_guest');
    } else {
        try {
            await saveCustomerDataToDB(user.uid, customerData);
        } catch (error) {
            console.error('خطأ في مسح بيانات العميل:', error);
        }
    }
}

// التحقق من اكتمال البيانات المطلوبة
export function isCustomerDataComplete() {
    return customerData.fullName.trim() !== '' &&
           customerData.phoneNumber.trim() !== '' &&
           customerData.address.trim() !== '';
}

// عرض بيانات العميل في النموذج
export function displayCustomerDataInForm() {
    const form = document.getElementById('customer-data-form');
    if (!form) return;

    document.getElementById('full-name').value = customerData.fullName || '';
    document.getElementById('phone-number').value = customerData.phoneNumber || '';
    document.getElementById('phone-number-2').value = customerData.phoneNumber2 || '';
    document.getElementById('address').value = customerData.address || '';
    document.getElementById('landmark').value = customerData.landmark || '';
}

// عرض البيانات المحفوظة
export function displaySavedCustomerData() {
    const displayContainer = document.getElementById('customer-data-display');
    const formContainer = document.getElementById('customer-data-form');
    const contentContainer = document.getElementById('saved-data-content');
    
    if (!displayContainer || !formContainer || !contentContainer) return;

    if (isCustomerDataComplete()) {
        // إخفاء النموذج وإظهار البيانات المحفوظة
        formContainer.style.display = 'none';
        displayContainer.style.display = 'block';
        
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
    } else {
        // إظهار النموذج لإدخال البيانات
        formContainer.style.display = 'block';
        displayContainer.style.display = 'none';
    }
}

// تهيئة صفحة بيانات العميل
export function initCustomerDataPage() {
    const form = document.getElementById('customer-data-form');
    const editBtn = document.getElementById('edit-customer-data');
    const clearBtn = document.getElementById('clear-customer-data');
    
    if (!form) return;

    // تحميل البيانات وعرضها
    loadCustomerData().then(() => {
        displayCustomerDataInForm();
        displaySavedCustomerData();
    });

    // معالجة تقديم النموذج
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
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
            displaySavedCustomerData();
        }
    });

    // زر تعديل البيانات
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const formContainer = document.getElementById('customer-data-form');
            const displayContainer = document.getElementById('customer-data-display');
            
            if (formContainer && displayContainer) {
                formContainer.style.display = 'block';
                displayContainer.style.display = 'none';
            }
        });
    }

    // زر مسح البيانات
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من مسح جميع البيانات؟')) {
                await clearCustomerData();
                displayCustomerDataInForm();
                displaySavedCustomerData();
                showToast('تم مسح البيانات', 'info');
            }
        });
    }
} 