// fileName: orders.js

import { showToast } from './ui.js';
import { cancelOrderInDB } from './api.js';

let orders = [];

export function clearUserOrders() {
    orders = [];
}

export function updateOrdersOnLoad(userOrders) {
    orders = userOrders;
    renderOrders();
}

export function addOrder(newOrder) {
    orders.push(newOrder);
}

function formatOrderDate(dateISO) {
    const d = new Date(dateISO);
    let hours = d.getHours();
    let mins = d.getMinutes();
    let ampm = hours >= 12 ? "مساءً" : "صباحًا";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    mins = mins < 10 ? "0" + mins : mins;
    const dateStr = d.toLocaleDateString('ar-EG');
    return `${dateStr} - ${hours}:${mins} ${ampm}`;
}

async function cancelOrder(orderId) {
    try {
        const btn = document.querySelector(`.cancel-order-btn[data-order-id='${orderId}']`);
        if (btn) {
            btn.disabled = true;
            await cancelOrderInDB(orderId);
            // Update local state
            const order = orders.find(o => o.id === orderId);
            if (order) order.status = "cancelled";
            renderOrders();
            showToast("تم إرجاع/إلغاء الطلب بنجاح!", "success");
        }
    } catch (error) {
        showToast("فشل إرجاع الطلب.", "error");
    } finally {
        const btn = document.querySelector(`.cancel-order-btn[data-order-id='${orderId}']`);
        if (btn) {
            btn.disabled = false;
        }
    }
}

export function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;
    if (!orders.length) {
        container.innerHTML = '<p class="empty-message">لا توجد طلبات حاليًا.</p>';
        return;
    }

    const activeStatuses = ["review", "waiting_payment", "shipping", "delivered", "returned"];
    const activeOrders = orders.filter(o => !o.status || activeStatuses.includes(o.status));
    const cancelledOrders = orders.filter(o => o.status === "cancelled");

    activeOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
    cancelledOrders.sort((a, b) => new Date(a.date) - new Date(b.date));

    const allSorted = [...activeOrders, ...cancelledOrders];

    container.innerHTML = allSorted.map(order => {
        const statusInfo = {
            review: { text: "تحت المراجعة", class: "review" },
            waiting_payment: { text: "انتظار التحويل", class: "waiting-payment" },
            shipping: { text: "قيد التوصيل", class: "shipping" },
            delivered: { text: "تم الاستلام", class: "delivered" },
            cancelled: { text: "ملغي", class: "cancelled" },
            returned: { text: "تم الإرجاع", class: "returned" }
        }[order.status] || { text: 'غير معروف', class: '' };

        const itemsSummary = order.items.map(item => {
            const itemPrice = item.discount || item.price; // السعر بعد خصم المنتج
            const itemTotal = itemPrice * item.quantity; // الإجمالي = السعر بعد الخصم × الكمية
            return `${item.name} (x${item.quantity}) - ${itemTotal} جنيه`;
        }).join('، ');
        
        // حساب الإجمالي قبل خصم الكوبون (السعر بعد خصم المنتجات)
        const totalBeforeCoupon = order.items ? order.items.reduce((sum, item) => {
            const itemPrice = item.discount || item.price; // السعر بعد خصم المنتج
            return sum + (itemPrice * item.quantity);
        }, 0) : order.total;
        
        // تحديث عرض معلومات الكوبون لتطابق تصميم الأدمن
        const couponInfo = order.coupon_code ? `
            <p><strong>الإجمالي قبل الخصم:</strong> <span style="color: #6c757d; text-decoration: line-through; font-size: 0.9em;">${totalBeforeCoupon} جنيه</span></p>
            <p><strong>الإجمالي بعد الخصم:</strong> <span style="color: #28a745; font-weight: 600; font-size: 1.1em;">${order.total_after_coupon || order.total} جنيه</span></p>
            <p><strong>كوبون الخصم المستخدم:</strong> <span style="background: linear-gradient(135deg, #007bff, #6f42c1); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.85em; font-weight: 600; display: inline-block; margin: 2px 0;">${order.coupon_code}</span></p>
        ` : `<p><strong>المبلغ الإجمالي:</strong> <span style="color: #28a745; font-weight: 600; font-size: 1.1em;">${totalBeforeCoupon} جنيه</span></p>`;

        // طريقة الدفع
        const paymentMethodText = order.payment_method ? `<p><strong>طريقة الدفع:</strong> ${getPaymentMethodText(order.payment_method)}</p>` : "";

        // العربون المطلوب
        const depositText = order.required_deposit ? `<p><strong>العربون المطلوب:</strong> ${order.required_deposit} جنيه</p>` : "";

        // المبلغ المستلم
        const receivedAmountText = order.received_amount ? `<p><strong>المبلغ المستلم:</strong> ${order.received_amount} جنيه</p>` : "";

        // بيانات التوصيل
        const shippingData = order.shipping_data ? `
            <div class="shipping-info">
                <h4>بيانات التوصيل:</h4>
                <p><strong>الاسم:</strong> ${order.shipping_data.fullName}</p>
                <p><strong>الهاتف:</strong> ${order.shipping_data.phoneNumber}</p>
                ${order.shipping_data.phoneNumber2 ? `<p><strong>هاتف آخر:</strong> ${order.shipping_data.phoneNumber2}</p>` : ''}
                <p><strong>العنوان:</strong> ${order.shipping_data.address}</p>
                ${order.shipping_data.landmark ? `<p><strong>مكان مميز:</strong> ${order.shipping_data.landmark}</p>` : ''}
            </div>
        ` : "";

        const cancelButton = order.status === "review"
            ? `<button class="small-btn danger-btn cancel-order-btn" style="background:linear-gradient(90deg,#f43f5e 60%,#fbc2eb 100%);color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:bold;box-shadow:0 2px 8px #ec489933;transition:background 0.2s;" data-order-id="${order.id}">إرجاع / إلغاء الطلب</button>`
            : "";

        // زر رفع لقطة شاشة التحويل للطلبات التي تحتاج تحويل
        const uploadButton = order.status === "waiting_payment"
            ? `<button class="small-btn upload-screenshot-btn" style="background:linear-gradient(90deg,#28a745 60%,#20c997 100%);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-weight:bold;box-shadow:0 4px 12px #28a74533;transition:all 0.3s ease;margin-right:10px;" data-order-id="${order.id}">
                <i class="fas fa-upload"></i> رفع إثبات التحويل
               </button>`
            : "";

        // عرض لقطة شاشة التحويل إذا كانت موجودة
        const screenshotDisplay = order.payment_screenshot 
            ? `<div class="payment-screenshot-display">
                <h4><i class="fas fa-check-circle" style="color:#28a745;margin-left:5px;"></i>تم رفع إثبات التحويل</h4>
                <div class="screenshot-preview-container">
                    <img src="${order.payment_screenshot}" alt="إثبات التحويل" style="max-width:200px;border-radius:8px;border:2px solid #28a745;cursor:pointer;" onclick="openScreenshotView('${order.payment_screenshot}')">
                    <p class="screenshot-upload-date">
                        <small>تم الرفع في: ${order.screenshot_upload_date ? formatOrderDate(order.screenshot_upload_date) : 'غير محدد'}</small>
                    </p>
                </div>
               </div>`
            : "";

        return `
            <div class="order-card status-${order.status || 'review'}">
                <div class="order-header">
                    <h3>طلب رقم #${order.order_number || order.id}</h3>
                    <span class="order-status ${statusInfo.class}">${statusInfo.text}</span>
                </div>
                <div class="order-items-summary">
                    <p><strong>المنتجات:</strong> ${itemsSummary}</p>
                    ${couponInfo}
                    ${paymentMethodText}
                    ${depositText}
                    ${receivedAmountText}
                    <p><strong>تاريخ الطلب:</strong> ${formatOrderDate(order.date)}</p>
                    ${shippingData}
                    <div class="order-actions">
                        ${uploadButton}
                        ${cancelButton}
                    </div>
                    ${screenshotDisplay}
                </div>
            </div>`;
    }).join('');

    // Add event listeners for the new cancel buttons
    document.querySelectorAll('.cancel-order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => cancelOrder(e.target.dataset.orderId));
    });

    // Add event listeners for upload screenshot buttons
    document.querySelectorAll('.upload-screenshot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openUploadModal(e.target.dataset.orderId));
    });
}

// دالة لتحويل طريقة الدفع إلى نص مقروء
function getPaymentMethodText(paymentMethod) {
    const paymentMethods = {
        'cash': 'الدفع عند الاستلام',
        'wallet': 'محفظة إلكترونية',
        'instapay': 'InstaPay'
    };
    return paymentMethods[paymentMethod] || 'غير محدد';
}

// دالة فتح مودال رفع لقطة شاشة التحويل
function openUploadModal(orderId) {
    const modal = document.getElementById('upload-screenshot-modal');
    if (!modal) {
        console.error('مودال رفع لقطة الشاشة غير موجود');
        return;
    }
    
    // تخزين معرف الطلب في المودال
    modal.dataset.orderId = orderId;
    
    // إعادة تعيين النموذج
    const fileInput = document.getElementById('screenshot-file');
    const previewContainer = document.getElementById('screenshot-preview');
    const submitBtn = document.getElementById('upload-screenshot-btn');
    
    if (fileInput) fileInput.value = '';
    if (previewContainer) previewContainer.innerHTML = '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'رفع لقطة الشاشة';
    }
    
    modal.classList.add('open');
    setupUploadModalListeners();
}

// دالة إغلاق مودال رفع لقطة شاشة التحويل
function closeUploadModal() {
    const modal = document.getElementById('upload-screenshot-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

// دالة إعداد مستمعي أحداث مودال الرفع
function setupUploadModalListeners() {
    const modal = document.getElementById('upload-screenshot-modal');
    const closeBtn = document.getElementById('close-upload-modal');
    const cancelBtn = document.getElementById('cancel-upload-btn');
    const fileInput = document.getElementById('screenshot-file');
    const submitBtn = document.getElementById('upload-screenshot-btn');
    const uploadLabel = document.querySelector('.file-upload-label');
    
    // إغلاق المودال
    if (closeBtn) {
        closeBtn.addEventListener('click', closeUploadModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeUploadModal);
    }
    
    // إغلاق المودال عند الضغط خارجه
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'upload-screenshot-modal') {
                closeUploadModal();
            }
        });
    }
    
    // معاينة الصورة عند اختيارها
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                previewImage(file);
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
    
    // رفع الصورة
    if (submitBtn) {
        submitBtn.addEventListener('click', uploadScreenshot);
    }
    
    // دعم سحب وإفلات الملفات
    if (uploadLabel) {
        uploadLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadLabel.classList.add('dragover');
        });
        
        uploadLabel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadLabel.classList.remove('dragover');
        });
        
        uploadLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadLabel.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (fileInput) {
                    fileInput.files = files;
                    previewImage(file);
                    if (submitBtn) submitBtn.disabled = false;
                }
            }
        });
    }
}

// دالة معاينة الصورة
function previewImage(file) {
    const previewContainer = document.getElementById('screenshot-preview');
    if (!previewContainer) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewContainer.innerHTML = `
            <div class="image-preview">
                <img src="${e.target.result}" alt="معاينة لقطة الشاشة" style="max-width:100%;border-radius:8px;">
                <p class="file-info">${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</p>
            </div>
        `;
    };
    reader.readAsDataURL(file);
}

// دالة رفع لقطة الشاشة
async function uploadScreenshot() {
    const modal = document.getElementById('upload-screenshot-modal');
    const orderId = modal?.dataset.orderId;
    const fileInput = document.getElementById('screenshot-file');
    const submitBtn = document.getElementById('upload-screenshot-btn');
    
    if (!orderId || !fileInput || !fileInput.files[0]) {
        showToast('يرجى اختيار ملف إثبات التحويل', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    
    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار ملف صورة صحيح لإثبات التحويل', 'error');
        return;
    }
    
    // التحقق من حجم الملف (أقل من 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('حجم ملف إثبات التحويل يجب أن يكون أقل من 5 ميجابايت', 'error');
        return;
    }
    
    try {
        // تعطيل الزر وإظهار حالة التحميل
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner-small"></div>';
        }
        
        // رفع الصورة إلى Cloudinary
        const imageUrl = await uploadImageToCloudinary(file);
        
        // حفظ رابط الصورة في قاعدة البيانات
        await saveScreenshotToDB(orderId, imageUrl);
        
        // تحديث الطلب محلياً
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.payment_screenshot = imageUrl;
            order.screenshot_upload_date = new Date().toISOString();
        }
        
        // إعادة عرض الطلبات
        renderOrders();
        
        // إغلاق المودال
        closeUploadModal();
        
        showToast('تم رفع إثبات التحويل بنجاح! سيتم مراجعته قريباً والتواصل معكم', 'success');
        
    } catch (error) {
        console.error('خطأ في رفع إثبات التحويل:', error);
        showToast('حدث خطأ في رفع إثبات التحويل. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        // إعادة تفعيل الزر
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'رفع لقطة الشاشة';
        }
    }
}

// دالة رفع الصورة إلى Cloudinary
async function uploadImageToCloudinary(file) {
    try {
        console.log('بدء رفع لقطة الشاشة إلى Cloudinary...');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'anaqa-products');
        
        console.log('إرسال الطلب إلى Cloudinary...');
        const response = await fetch('https://api.cloudinary.com/v1_1/dxisaw6cu/image/upload', {
            method: 'POST',
            body: formData
        });
        
        console.log('استجابة Cloudinary:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('خطأ في استجابة Cloudinary:', errorText);
            throw new Error(`فشل في رفع الصورة: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('بيانات الاستجابة من Cloudinary:', data);
        
        if (data.secure_url) {
            console.log('تم الحصول على رابط الصورة:', data.secure_url);
            return data.secure_url;
        }
        
        throw new Error('لم يتم العثور على رابط الصورة في الاستجابة');
        
    } catch (error) {
        console.error('خطأ في رفع الصورة إلى Cloudinary:', error);
        throw error;
    }
}

// دالة حفظ رابط إثبات التحويل في قاعدة البيانات
async function saveScreenshotToDB(orderId, imageUrl) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
        const { db } = await import('./firebase.js');
        
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            payment_screenshot: imageUrl,
            screenshot_upload_date: new Date().toISOString()
        });
        
        console.log('تم حفظ إثبات التحويل في قاعدة البيانات');
        
    } catch (error) {
        console.error('خطأ في حفظ إثبات التحويل:', error);
        throw error;
    }
}

// دالة فتح معاينة لقطة الشاشة في صفحة الطلبات
window.openScreenshotView = function(imageUrl) {
    const modal = document.getElementById('screenshot-view-modal');
    if (!modal) {
        // إنشاء المودال إذا لم يكن موجوداً
        const modalHTML = `
            <div id="screenshot-view-modal" class="modal-overlay">
                <div class="screenshot-modal-content">
                    <div class="screenshot-modal-header">
                        <h3>معاينة إثبات التحويل</h3>
                        <button class="close-modal-btn" onclick="closeScreenshotView()">&times;</button>
                    </div>
                    <div class="screenshot-modal-body">
                        <img id="screenshot-view-image" src="" alt="إثبات التحويل" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // إضافة مستمع حدث للضغط خارج الصورة
        const newModal = document.getElementById('screenshot-view-modal');
        if (newModal) {
            newModal.addEventListener('click', (e) => {
                if (e.target.id === 'screenshot-view-modal') {
                    closeScreenshotView();
                }
            });
        }
    }
    
    // تحديث الصورة
    const imageElement = document.getElementById('screenshot-view-image');
    if (imageElement) {
        imageElement.src = imageUrl;
    }
    
    // فتح المودال
    document.getElementById('screenshot-view-modal').classList.add('open');
};

// دالة إغلاق معاينة لقطة الشاشة في صفحة الطلبات
window.closeScreenshotView = function() {
    const modal = document.getElementById('screenshot-view-modal');
    if (modal) {
        modal.classList.remove('open');
    }
};