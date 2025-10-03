
// update-password.js
// Yêu cầu: đã load Supabase SDK v2 và file supabase-client.js (tạo biến global `sb`)
(function () {
  const $ = (sel) => document.querySelector(sel);
  const msgBox = $("#msg");
  const btn = $("#btnSubmit");
  const pass1 = $("#password");
  const pass2 = $("#password2");

  function showMsg(text, type = "info") {
    if (!msgBox) return;
    msgBox.textContent = text;
    msgBox.className = "msg " + type; // .msg, .msg.success, .msg.error
  }

  function setLoading(isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Đang cập nhật..." : "Cập nhật mật khẩu";
  }

  // Parse hash/query helpers
  function parseFragmentParams() {
    // Hỗ trợ cả hash (#access_token=...) và query (?code=...)
    const out = {};
    const frag = window.location.hash?.replace(/^#/, "");
    if (frag) {
      new URLSearchParams(frag).forEach((v, k) => (out[k] = v));
    }
    const qs = window.location.search?.replace(/^\?/, "");
    if (qs) {
      new URLSearchParams(qs).forEach((v, k) => (out[k] = v));
    }
    return out;
  }

  async function ensureSessionFromUrl() {
    try {
      if (!window.sb) return;
      const params = parseFragmentParams();

      // Trường hợp thường gặp của email recovery: có access_token & refresh_token trong URL hash
      if (params.access_token && params.refresh_token) {
        const { data, error } = await sb.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) {
          console.warn("setSession from hash failed:", error);
        } else {
          // Dọn URL cho sạch
          history.replaceState({}, document.title, window.location.pathname);
          return true;
        }
      }

      // Trường hợp dùng flow PKCE: redirect về có ?code=...&type=recovery
      if (params.code) {
        // Một số phiên bản yêu cầu đọc trực tiếp từ current URL
        // exchangeCodeForSession sẽ tự lưu session vào client nếu thành công
        const { data, error } = await sb.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          console.warn("exchangeCodeForSession failed:", error);
        } else {
          // Dọn URL cho sạch
          history.replaceState({}, document.title, window.location.pathname);
          return true;
        }
      }
    } catch (e) {
      console.error("ensureSessionFromUrl() error:", e);
    }
    return false;
  }

  async function requireLoggedIn() {
    // cố gắng đọc session hiện tại
    const { data: sess1 } = await sb.auth.getSession();
    if (sess1?.session) return true;

    // Nếu chưa có, thử thiết lập từ URL (khi mở từ email)
    const ok = await ensureSessionFromUrl();
    if (ok) return true;

    // Thử lại
    const { data: sess2 } = await sb.auth.getSession();
    return !!sess2?.session;
  }

  async function handleSubmit() {
    try {
      showMsg("", "info");

      const p1 = pass1.value.trim();
      const p2 = pass2.value.trim();

      // Validate
      if (p1.length < 6) {
        showMsg("Mật khẩu phải có ít nhất 6 ký tự.", "error");
        pass1.focus();
        return;
      }
      if (p1 !== p2) {
        showMsg("Hai mật khẩu không khớp. Vui lòng nhập lại.", "error");
        pass2.focus();
        return;
      }

      setLoading(true);

      // Đảm bảo đã có session (đặc biệt khi vào từ email khôi phục)
      const authed = await requireLoggedIn();
      if (!authed) {
        setLoading(false);
        showMsg("Không tìm thấy phiên đăng nhập. Hãy mở trang từ email khôi phục của Supabase hoặc đăng nhập lại.", "error");
        return;
      }

      // Cập nhật mật khẩu
      const { data, error } = await sb.auth.updateUser({ password: p1 });
      if (error) {
        setLoading(false);
        // Một số thông báo thân thiện
        let human = error.message || "Có lỗi xảy ra khi cập nhật mật khẩu.";
        if (/Password should be/.test(human)) {
          human = "Mật khẩu không đủ mạnh. Hãy dùng mật khẩu dài hơn và khó đoán hơn.";
        }
        showMsg(human, "error");
        return;
      }

      setLoading(false);
      showMsg("✅ Đã cập nhật mật khẩu thành công! Bạn có thể đóng trang này hoặc quay lại đăng nhập.", "success");

      // Xoá nội dung input để tránh lộ
      pass1.value = "";
      pass2.value = "";
    } catch (e) {
      console.error(e);
      setLoading(false);
      showMsg("Đã xảy ra lỗi bất ngờ. Vui lòng thử lại.", "error");
    }
  }

  // Wire up events
  document.addEventListener("DOMContentLoaded", async () => {
    // Tự cố gắng thiết lập session nếu có token trong URL
    await ensureSessionFromUrl();

    if (btn) btn.addEventListener("click", handleSubmit);

    // Cho phép Enter để submit
    [pass1, pass2].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
      });
    });
  });
})();
