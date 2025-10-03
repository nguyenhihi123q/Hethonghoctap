/* Supabase Auth binding for existing Login Modal (index.html)
 * Adds onboarding-aware redirects.
 */
(function () {
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    if (!window.sb || !window.supabase) {
      console.error("[Supabase] Client not initialized. Ensure CDN and supabase-client.js are loaded.");
      return;
    }
    const modal = document.getElementById('loginModal');
    if (!modal) return;

    // ---- Helper: smart redirect after login/signup ----
    async function redirectAfterLogin() {
      try {
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return (window.location.href = 'auth.html');

        // ensure profile row exists; ignore errors
        try { await window.sb.from('profiles').insert({ id: user.id }).single(); } catch (_) {}

        const { data: prof } = await window.sb
          .from('profiles')
          .select('onboarding_done')
          .eq('id', user.id)
          .single();

        if (!prof?.onboarding_done) return (window.location.href = 'onboard.html');
        return (window.location.href = 'learn.html');
      } catch (e) {
        console.warn('redirectAfterLogin failed:', e?.message || e);
        window.location.href = 'onboard.html';
      }
    }

    const form = modal.querySelector('#loginForm');
    const emailInput = modal.querySelector('#loginEmail');
    const passInput  = modal.querySelector('#loginPassword');
    const forgotLink = modal.querySelector('.link-forgot');
    const signupLink = modal.querySelector('.link-register');

    function setError(id, message) {
      const field = modal.querySelector('[data-error-for="' + id + '"]');
      if (field) field.textContent = message || '';
    }
    function validate() {
      let ok = true;
      const email = (emailInput.value || '').trim();
      const pwd   = passInput.value || '';
      setError('loginEmail', ''); setError('loginPassword', '');
      if (!email) { setError('loginEmail', 'Vui lòng nhập email'); ok = false; }
      else if (!/^\S+@\S+\.\S+$/.test(email)) { setError('loginEmail', 'Email không hợp lệ'); ok = false; }
      if (!pwd) { setError('loginPassword', 'Vui lòng nhập mật khẩu'); ok = false; }
      else if (pwd.length < 6) { setError('loginPassword', 'Mật khẩu tối thiểu 6 ký tự'); ok = false; }
      return ok;
    }

    function closeModal() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    // Intercept the default submit handler (from script.js) and run Supabase auth instead.
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (!validate()) return;
      const email = emailInput.value.trim();
      const password = passInput.value;

      const { error } = await window.sb.auth.signInWithPassword({ email, password });
      if (error) {
        setError('loginPassword', error.message || 'Đăng nhập thất bại');
        if (typeof window.safeNotify === 'function') window.safeNotify('Đăng nhập thất bại: ' + (error.message || ''), 'error');
        return;
      }
      closeModal();
      if (typeof window.safeNotify === 'function') window.safeNotify('Đăng nhập thành công! Đang chuyển trang…', 'success');
      await redirectAfterLogin();
    }, true); // capture

    // "Quên mật khẩu?" → gửi reset password (redirect tới update-password.html)
    if (forgotLink) {
      forgotLink.addEventListener('click', async function (e) {
        e.preventDefault();
        const email = (emailInput.value || '').trim() || prompt('Nhập email để nhận liên kết đặt lại mật khẩu:');
        if (!email) return;
        const { error } = await window.sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/update-password.html'
        });
        if (error) {
          if (typeof window.safeNotify === 'function') window.safeNotify('Gửi liên kết thất bại: ' + (error.message || ''), 'error');
        } else {
          if (typeof window.safeNotify === 'function') window.safeNotify('Đã gửi liên kết đặt lại mật khẩu tới email của bạn.', 'success');
        }
      });
    }

    // "Đăng ký" → dùng ngay 2 trường Email/Mật khẩu trong modal hiện tại
    if (signupLink) {
      signupLink.addEventListener('click', async function (e) {
        e.preventDefault();
        if (!validate()) return;
        const email = emailInput.value.trim();
        const password = passInput.value;
        let fullName = prompt('Tên hiển thị (tối đa 24 ký tự):') || '';
        fullName = fullName.trim().slice(0,24);
        const { data, error } = await window.sb.auth.signUp({
          email, password,
          options: { data: { full_name: fullName || null }, emailRedirectTo: window.location.origin + '/onboard.html' }
        });
        if (error) {
          setError('loginPassword', error.message || 'Đăng ký thất bại');
          if (typeof window.safeNotify === 'function') window.safeNotify('Đăng ký thất bại: ' + (error.message || ''), 'error');
          return;
        }
        if (!data.session) {
          if (typeof window.safeNotify === 'function') window.safeNotify('Đăng ký thành công! Hãy kiểm tra email để xác nhận.', 'success');
        } else {
          closeModal();
          if (typeof window.safeNotify === 'function') window.safeNotify('Đăng ký & đăng nhập thành công! Đang chuyển trang…', 'success');
          await redirectAfterLogin();
        }
        try {
          if (data.user?.id) {
            await window.sb.from('profiles').insert([{ id: data.user.id, full_name: (typeof fullName === 'string' && fullName.trim()) ? fullName.trim() : null }]);
          }
        } catch (_) {}
      });
    }
  });
})();

// ===== Navbar auth-aware rendering (index.html) =====
(async function renderHeaderAuthState(){
  try {
    let mount = document.getElementById('authNavMount');
    if (!mount) {
      const navLoginBtn = document.getElementById('loginTrigger');
      if (navLoginBtn) {
        mount = navLoginBtn.closest('li') || navLoginBtn.parentElement;
        if (mount) mount.id = 'authNavMount';
      } else {
        const navMenu = document.querySelector('.nav-menu');
        if (navMenu) {
          mount = document.createElement('li');
          mount.id = 'authNavMount';
          navMenu.appendChild(mount);
        } else {
          return;
        }
      }
    }
    mount.style.position = 'relative';

    async function draw() {
      const { data: { session } } = await window.sb.auth.getSession();
      if (!session) {
        if (!document.getElementById('loginTrigger')) {
          const btn = document.createElement('button');
          btn.id = 'loginTrigger';
          btn.className = 'btn btn-primary';
          btn.textContent = 'Đăng nhập';
          btn.addEventListener('click', function(){
            const modal = document.getElementById('loginModal');
            modal?.classList.add('open');
            modal?.setAttribute('aria-hidden','false');
          });
          mount.innerHTML = '';
          mount.appendChild(btn);
        }
        return;
      }
      const user = session.user;
      const rawName = (user.user_metadata?.full_name || user.email || 'bạn').trim();
      let name = rawName;
      if (!user.user_metadata?.full_name && rawName.includes('@')) {
        name = rawName.split('@')[0];
      }
      const first = (name.charAt(0) || '?').toUpperCase();

      mount.innerHTML = `
        <button id="userMenuBtn" class="btn btn-primary" style="display:flex;align-items:center;gap:10px;">
          <span class="avatar-circle" style="width:26px;height:26px;border-radius:999px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:900;">${first}</span>
          <span class="user-name" style="font-weight:800;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;">${name}</span>
        </button>
        <div id="userDropdown" style="position:absolute;right:0;top:calc(100% + 8px);min-width:220px;background:#fff;color:#111827;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.18);padding:8px;display:none;z-index:1000">
          <a href="learn.html" style="display:block;padding:10px 12px;border-radius:8px;">Bảng điều khiển</a>
          <a href="trial.html" style="display:block;padding:10px 12px;border-radius:8px;">Vào trang học thử</a>
          <a href="update-password.html" style="display:block;padding:10px 12px;border-radius:8px;">Đổi mật khẩu</a>
          <button id="ddLogout" style="display:block;padding:10px 12px;border-radius:8px;background:#f6f7f9;border:1px solid #e5e7eb;width:100%;text-align:left;cursor:pointer;">Đăng xuất</button>
        </div>
      `;

      const btn = document.getElementById('userMenuBtn');
      const dd = document.getElementById('userDropdown');
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        dd.style.display = (dd.style.display === 'none' || dd.style.display === '') ? 'block' : 'none';
      });
      document.addEventListener('click', function(){ dd.style.display = 'none'; });
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') dd.style.display = 'none'; });

      document.getElementById('ddLogout').addEventListener('click', async function(){
        await window.sb.auth.signOut();
        await draw();
        window.location.replace('index.html?login=1');
      });
    }

    await draw();
    window.sb.auth.onAuthStateChange(draw);
  } catch(e) {
    console.warn('Navbar auth state render skipped:', e?.message || e);
  }
})();

// Auto-open login modal if URL contains ?login=1 or #login
(function autoOpenLoginFromQuery(){
  function openLogin(){
    var modal = document.getElementById('loginModal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function shouldOpen(){
    try {
      var qs = new URLSearchParams(window.location.search);
      if (qs.get('login') === '1') return true;
    } catch (e) {}
    return (window.location.hash || '').toLowerCase().includes('login');
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ if (shouldOpen()) openLogin(); });
  } else {
    if (shouldOpen()) openLogin();
  }
})();

// ===== Sign Up mode inside existing modal (toggle) =====
(function enhanceSignupUX(){
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  const form = modal.querySelector('#loginForm');
  if (!form) return;
  const emailInput = modal.querySelector('#loginEmail');
  const passInput  = modal.querySelector('#loginPassword');

  function findLinkByText(txtIncludes){
    txtIncludes = txtIncludes.toLowerCase();
    const links = modal.querySelectorAll('a');
    for (const a of links){
      const t = (a.textContent || '').trim().toLowerCase();
      if (t.includes(txtIncludes)) return a;
    }
    return null;
  }
  const forgotLink = findLinkByText('quên mật khẩu') || modal.querySelector('.link-forgot');
  const signupLink = findLinkByText('đăng ký') || modal.querySelector('.link-register');

  let nameRow = modal.querySelector('#signupFullNameRow');
  if (!nameRow){
    nameRow = document.createElement('div');
    nameRow.id = 'signupFullNameRow';
    nameRow.style.display = 'none';
    nameRow.style.marginTop = '10px';
    nameRow.innerHTML = `
      <label for="signupFullName" style="font-weight:600;">Họ tên (tuỳ chọn)</label>
      <input id="signupFullName" type="text" placeholder="Nguyễn Văn A" maxlength="24" style="width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:10px;" />
    `;
    const emailLabel = form.querySelector('label[for="loginEmail"]');
    if (emailLabel && emailLabel.parentElement === form){
      form.insertBefore(nameRow, emailLabel);
    } else {
      form.insertBefore(nameRow, form.firstChild);
    }
  }

  const titleEl = modal.querySelector('h2, .modal-title') || modal.querySelector('h3');
  const submitBtn = form.querySelector('button[type="submit"], .btn[type="submit"]') || form.querySelector('button');

  let isSignup = false;
  function setMode(signup){
    isSignup = !!signup;
    if (titleEl){ titleEl.textContent = isSignup ? 'Đăng ký' : 'Đăng nhập'; }
    if (submitBtn){ submitBtn.textContent = isSignup ? 'Tạo tài khoản' : 'Đăng nhập'; }
    if (nameRow) nameRow.style.display = isSignup ? '' : 'none';
    if (forgotLink) forgotLink.style.visibility = isSignup ? 'hidden' : 'visible';
    if (signupLink){
      const parent = signupLink.parentElement;
      if (parent) {
        parent.firstChild && parent.firstChild.nodeType === 3 && (parent.firstChild.textContent = isSignup ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? ');
      }
      signupLink.textContent = isSignup ? 'Đăng nhập' : 'Đăng ký';
    }
  }

  if (signupLink){
    signupLink.addEventListener('click', function(ev){
      ev.preventDefault();
      setMode(!isSignup);
    });
  }

  form.addEventListener('submit', async function (e) {
    if (!isSignup) return; // login handled by capture-phase listener
    e.preventDefault();
    e.stopImmediatePropagation();

    const email = (emailInput?.value || '').trim();
    const password = (passInput?.value || '');
    const fullName = (modal.querySelector('#signupFullName')?.value || '').trim().slice(0,24);
    if (!email || !password) return;

    const { data, error } = await window.sb.auth.signUp({
      email, password,
      options: { data: { full_name: fullName || null }, emailRedirectTo: window.location.origin + '/onboard.html' }
    });
    if (error) {
      const errField = modal.querySelector('[data-error-for="loginPassword"]') || modal.querySelector('[data-error-for="loginEmail"]');
      if (errField) errField.textContent = error.message || 'Đăng ký thất bại';
      if (typeof window.safeNotify === 'function') window.safeNotify('Đăng ký thất bại: ' + (error.message || ''), 'error');
      return;
    }
    if (!data.session) {
      if (typeof window.safeNotify === 'function') window.safeNotify('Đăng ký thành công! Hãy kiểm tra email để xác nhận.', 'success');
    } else {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
      if (typeof window.safeNotify === 'function') window.safeNotify('Đăng ký & đăng nhập thành công! Đang chuyển trang…', 'success');
      await redirectAfterLogin();
    }
    try {
      if (data.user?.id) {
        await window.sb.from('profiles').insert([{ id: data.user.id, full_name: fullName || null }]);
      }
    } catch (_) {}
  }, false);
})();