// Auth flows for auth.html (with onboarding redirect)
// Requires: supabase-client.js (window.sb), and optionally window.requireAuth
(function () {
  const $ = (sel) => document.querySelector(sel);

  // ---- Helper: smart redirect after login/signup ----
  async function redirectAfterLogin() {
    try {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) return (window.location.href = 'auth.html');

      // ensure a profile row exists; ignore if policy forbids
      try { await window.sb.from('profiles').insert({ id: user.id }).single(); } catch (_) {}

      // check onboarding flag
      const { data: prof } = await window.sb
        .from('profiles')
        .select('onboarding_done')
        .eq('id', user.id)
        .single();

      if (!prof?.onboarding_done) {
        return (window.location.href = 'onboard.html');
      }
      // already onboarded -> go learn/dashboard
      return (window.location.href = 'learn.html');
    } catch (e) {
      console.warn('redirectAfterLogin failed:', e?.message || e);
      // fallback to onboarding
      window.location.href = 'onboard.html';
    }
  }

  // ---- Tab switching ----
  const tabLogin = $("#tab-login");
  const tabSignup = $("#tab-signup");
  const paneLogin = $("#pane-login");
  const paneSignup = $("#pane-signup");

  function showPane(which) {
    if (which === "login") {
      tabLogin?.classList.add("active");
      tabSignup?.classList.remove("active");
      if (paneLogin) paneLogin.hidden = false;
      if (paneSignup) paneSignup.hidden = true;
    } else {
      tabSignup?.classList.add("active");
      tabLogin?.classList.remove("active");
      if (paneSignup) paneSignup.hidden = false;
      if (paneLogin) paneLogin.hidden = true;
    }
  }

  tabLogin?.addEventListener("click", () => showPane("login"));
  tabSignup?.addEventListener("click", () => showPane("signup"));

  // ---- Messages ----
  const toast = $("#toast");
  function notify(msg, type = "info") {
    if (!toast) return alert(msg);
    toast.textContent = msg;
    toast.className = "toast " + type;
    toast.removeAttribute("hidden");
    setTimeout(() => toast.setAttribute("hidden", "true"), 4000);
  }

  // ---- LOGIN ----
  $("#login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#login-email")?.value?.trim();
    const password = $("#login-password")?.value;

    if (!email || !password) {
      notify("Vui lòng nhập email và mật khẩu.", "warn");
      return;
    }

    const { error } = await window.sb.auth.signInWithPassword({ email, password });
    if (error) {
      notify(error.message || "Đăng nhập thất bại.", "error");
      return;
    }
    notify("Đăng nhập thành công! Đang chuyển trang...");
    await redirectAfterLogin();
  });

  // ---- SIGN UP ----
  $("#signup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = $("#signup-name")?.value?.trim();
    const email = $("#signup-email")?.value?.trim();
    const password = $("#signup-password")?.value;

    if (!email || !password) {
      notify("Vui lòng nhập email và mật khẩu.", "warn");
      return;
    }

    // signUp with user metadata
    const { data, error } = await window.sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || null },
        // after email confirm -> land on onboarding
        emailRedirectTo: window.location.origin + "/onboard.html"
      }
    });

    if (error) {
      notify(error.message || "Đăng ký thất bại.", "error");
      return;
    }

    // If confirm email is enabled: no session yet
    if (!data.session) {
      notify("Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.", "success");
    } else {
      notify("Đăng ký & đăng nhập thành công! Đang chuyển trang...");
      await redirectAfterLogin();
    }

    // (Optional) Try create a profile row; ignore if table doesn't exist
    try {
      if (data.user?.id) {
        await window.sb.from("profiles").insert([{ id: data.user.id, full_name: fullName || null }]);
      }
    } catch (e) {
      // ignore missing table or RLS errors silently
      console.info("profiles insert skipped:", e?.message || e);
    }
  });

  // ---- Magic link (OTP) ----
  $("#btn-magic-link")?.addEventListener("click", async () => {
    const email = prompt("Nhập email để nhận liên kết đăng nhập:");
    if (!email) return;
    const { error } = await window.sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/onboard.html" }
    });
    if (error) notify(error.message || "Gửi liên kết thất bại.", "error");
    else notify("Đã gửi liên kết đăng nhập tới email của bạn.", "success");
  });
})();