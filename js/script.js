/* === HITS Config === */
// Dán URL Web App Apps Script của bạn (đã deploy Anyone) vào đây:
// window.CONTACT_ENDPOINT = "https://script.google.com/macros/s/AKfycbxzJK9QMvUXbABse8PDffJu9B4DeCfJCLWzT7t9-5X-KjFnxzFa0_ERFg4lO8D5tN1i/exec";
window.CONTACT_ENDPOINT = "https://script.google.com/macros/s/AKfycbyMvBpKZxudQAQlIDOG7cb3HtxHCtpLNmVjQAI_mqSxVJNnKVQaMgjvdtnfDQKkgP5o/exec";

/* ============================================================
   HITS – Main JS
   (Mobile nav, Pricing → Plan Modal, Login Modal, Contact Form)
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  /* -------------------------------
     Mobile Navigation Toggle
  ---------------------------------*/
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      navMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
      });
    });
  }

  /* -------------------------------
     Pricing → Plan Select Modal
     (bấm "Chọn Gói Này" → mở hộp)
  ---------------------------------*/
  const planModal = document.getElementById('planModal');
  if (planModal) {
    const planDialog = planModal.querySelector('.modal__dialog');
    const planSummary = document.getElementById('planSummary');
    const planCloseEls = planModal.querySelectorAll('[data-close]');

    function openPlan(planName) {
      if (planSummary) {
        planSummary.innerHTML = 'Bạn đang chọn: <strong>' + (planName || 'Gói HITS') + '</strong>';
      }
      planModal.classList.add('open');
      planModal.setAttribute('aria-hidden', 'false');
      document.addEventListener('keydown', escHandler);
    }
    function closePlan() {
      planModal.classList.remove('open');
      planModal.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', escHandler);
    }
    function escHandler(e) { if (e.key === 'Escape') closePlan(); }

    // Nút trong card giá
    document.querySelectorAll('.pricing-card .pricing-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('.pricing-card');
        const nameEl = card ? card.querySelector('.pricing-name') : null;
        const name = nameEl ? nameEl.textContent.trim() : 'Gói HITS';
        openPlan(name);
      });
    });

    // Đóng modal
    planCloseEls.forEach(el => el.addEventListener('click', closePlan));
    planModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal__backdrop')) closePlan();
    });
  }

  /* -------------------------------
     Login Modal
  ---------------------------------*/
  (function initLoginModal() {
    const modal = document.getElementById('loginModal');
    const trigger = document.getElementById('loginTrigger');
    if (!modal || !trigger) return;

    const dialog = modal.querySelector('.modal__dialog');
    const closeEls = modal.querySelectorAll('[data-close]');
    const emailInput = modal.querySelector('#loginEmail');
    const passInput = modal.querySelector('#loginPassword');
    const form = modal.querySelector('#loginForm');
    const togglePwdBtn = modal.querySelector('.toggle-password');

    function openModal() {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => emailInput && emailInput.focus(), 40);
      document.addEventListener('keydown', onKeydown);
      trapFocus(dialog);
    }
    function closeModal() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', onKeydown);
      trigger && trigger.focus();
    }
    function onKeydown(e) {
      if (e.key === 'Escape') closeModal();
    }
    function trapFocus(container) {
      const focusable = container.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      container.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus(); e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus(); e.preventDefault();
          }
        }
      });
    }

    trigger.addEventListener('click', openModal);
    closeEls.forEach(el => el.addEventListener('click', closeModal));
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal__backdrop')) closeModal();
    });

    // Toggle password visibility
    togglePwdBtn && togglePwdBtn.addEventListener('click', () => {
      const isPwd = passInput.type === 'password';
      passInput.type = isPwd ? 'text' : 'password';
      togglePwdBtn.setAttribute('aria-label', isPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      const icon = togglePwdBtn.querySelector('i');
      if (icon) icon.className = isPwd ? 'fa fa-eye-slash' : 'fa fa-eye';
      passInput.focus();
    });

    // Basic validation
    function setError(id, message) {
      const field = modal.querySelector('[data-error-for="' + id + '"]');
      if (field) field.textContent = message || '';
    }
    function validate() {
      let ok = true;
      const email = emailInput.value.trim();
      const pwd = passInput.value;
      setError('loginEmail', '');
      setError('loginPassword', '');
      if (!email) { setError('loginEmail', 'Vui lòng nhập email'); ok = false; }
      else if (!/^\S+@\S+\.\S+$/.test(email)) { setError('loginEmail', 'Email không hợp lệ'); ok = false; }
      if (!pwd) { setError('loginPassword', 'Vui lòng nhập mật khẩu'); ok = false; }
      else if (pwd.length < 6) { setError('loginPassword', 'Mật khẩu tối thiểu 6 ký tự'); ok = false; }
      return ok;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate()) return;
      closeModal();
      safeNotify('Đăng nhập thành công! Chào mừng trở lại 🎉', 'success');
    });
  })();

  /* -------------------------------
     Contact Form → gửi về Apps Script
  ---------------------------------*/
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async function (e) {
      // Lấy dữ liệu form
      const name = contactForm.querySelector('[name="name"]')?.value?.trim();
      const email = contactForm.querySelector('[name="email"]')?.value?.trim();
      const phone = contactForm.querySelector('[name="phone"]')?.value?.trim();
      const message = contactForm.querySelector('[name="message"]')?.value?.trim();

      // Validation cơ bản
      if (!name || !email || !message) {
        e.preventDefault();
        safeNotify('Vui lòng điền đầy đủ thông tin bắt buộc!', 'error');
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        e.preventDefault();
        safeNotify('Email không hợp lệ!', 'error');
        return;
      }

      const ENDPOINT = (window.CONTACT_ENDPOINT || '').trim();

      // Nếu có endpoint → gửi API; nếu không → để form xử lý mặc định/simulate
      if (ENDPOINT) {
        e.preventDefault();

        // Chống gửi trùng
        if (contactForm.dataset.sending === '1') return;
        contactForm.dataset.sending = '1';

        try {
          safeNotify('Đang gửi thông tin, vui lòng đợi...', 'info');

          const payload = { name, email, phone, message, source: 'HITS Landing' };

          // Gửi theo cách tránh preflight (không set Content-Type)
          const res = await sendContactPayload(ENDPOINT, payload);

          // Thử parse JSON; nếu CORS chặn đọc body vẫn coi res.ok là thành công
          let ok = res.ok;
          try {
            const data = await res.json();
            if (data && data.success === false) ok = false;
          } catch (_) {
            // ignore parse error – dựa vào res.ok
          }

          if (ok) {
            safeNotify('Đã gửi! Chúng tôi sẽ liên hệ với bạn sớm 📬', 'success');
            contactForm.reset();
          } else {
            throw new Error('Gửi thất bại');
          }
        } catch (err) {
          console.error(err);
          safeNotify('Gửi thất bại, vui lòng thử lại!', 'error');
        } finally {
          contactForm.dataset.sending = '0';
        }
      }
    });
  }
  /* -------------------------------
     CTA "Bắt đầu" (phân luồng theo đăng nhập & onboarding)
     - Gắn lên các phần tử: [data-cta-start], #ctaStart, .cta-start
  ---------------------------------*/
  (async function setupCTAStart(){
    const targets = Array.from(document.querySelectorAll('[data-cta-start], #ctaStart, .cta-start'));
    if (!targets.length) return;

    // helper mở Login Modal (nếu có), fallback query ?login=1
    function openLogin(){
      const modal = document.getElementById('loginModal');
      if (modal){
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        return;
      }
      // fallback: auto open qua hash/query (đã hỗ trợ trong supabase-modal.js)
      const url = new URL(window.location.href);
      url.searchParams.set('login', '1');
      if (!url.hash.includes('login')) url.hash = 'login';
      window.location.href = url.toString();
    }

    // nếu chưa có Supabase client → cho CTA mở modal đăng nhập
    if (!window.sb || !window.sb.auth) {
      targets.forEach(el => {
        el.addEventListener('click', function(e){ e.preventDefault(); openLogin(); });
        if (el.tagName === 'A') el.setAttribute('href', '#login');
      });
      return;
    }

    try {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) {
        targets.forEach(el => {
          el.addEventListener('click', function(e){ e.preventDefault(); openLogin(); });
          if (el.tagName === 'A') el.setAttribute('href', '#login');
        });
        return;
      }
      const { data: prof } = await window.sb
        .from('profiles')
        .select('onboarding_done')
        .eq('id', user.id)
        .single();

      const dest = (!prof || !prof.onboarding_done) ? 'onboard.html' : 'learn.html';
      targets.forEach(el => {
        if (el.tagName === 'A') {
          el.setAttribute('href', dest);
        } else {
          el.addEventListener('click', function(){ window.location.href = dest; });
        }
      });
    } catch (e) {
      // lỗi gì cũng cho quay về đăng nhập
      targets.forEach(el => {
        el.addEventListener('click', function(e){ e.preventDefault(); openLogin(); });
        if (el.tagName === 'A') el.setAttribute('href', '#login');
      });
    }
  })();

});

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Gửi payload tới Apps Script mà không gây CORS preflight
 * (không đặt Content-Type → trình duyệt dùng text/plain)
 */
async function sendContactPayload(url, payload) {
  try {
    return await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload) // KHÔNG đặt headers để tránh preflight
    });
  } catch (e) {
    // Fallback nếu cần: form-encoded
    const params = new URLSearchParams(payload);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
  }
}

/**
 * Thông báo (nếu site đã có showNotification thì dùng, không thì dùng tạm)
 */
function safeNotify(msg, type) {
  if (typeof showNotification === 'function') {
    showNotification(msg, type);
    return;
  }
  // fallback mini toast
  const colors = { success: '#16a34a', error: '#ef4444', info: '#2563eb' };
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    background: ${colors[type] || '#111827'}; color: #fff;
    padding: 10px 14px; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.2);
    font-weight: 600; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  `;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 4500);
}


// Hiển thị tên người dùng lên nút "Đăng nhập"
document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('loginTrigger');
  const sb = window.sb; // client tạo trong supabase-client.js
  if (!el || !sb) return;

  const getDisplayName = (user) => {
    const m = user?.user_metadata || {};
    return (
      m.full_name ||
      m.name ||
      m.username ||
      m.display_name ||
      (user?.email ? user.email.split('@')[0] : 'Tài khoản')
    );
  };

  const render = (user) => {
    if (user) {
      const name = getDisplayName(user);
      el.textContent = name;
      el.classList.add('is-auth');
      el.setAttribute('aria-label', `Tài khoản: ${name}`);
      // nếu muốn bấm vào dẫn tới trang sau đăng nhập:
      el.href = 'post-login.html'; // hoặc 'account.html' tuỳ bạn
      el.onclick = null; // tránh handler mở login cũ, nếu có
    } else {
      el.textContent = 'Đăng nhập';
      el.classList.remove('is-auth');
      el.removeAttribute('aria-label');
      el.href = 'auth.html';
    }
  };

  // Lần đầu tải trang
  try {
    const { data: { user } } = await sb.auth.getUser();
    render(user);
  } catch (e) {
    render(null);
  }

  // Cập nhật theo thời gian thực khi đăng nhập/đăng xuất
  sb.auth.onAuthStateChange((_event, session) => {
    render(session?.user || null);
  });
});

