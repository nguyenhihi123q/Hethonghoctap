/* Initializes a global Supabase client `window.sb`.
 * Requires: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * Place this file next to your existing files.
 */
(function () {
  const SUPABASE_URL = "https://upxomkehdbosfucbfzzm.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweG9ta2VoZGJvc2Z1Y2JmenptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3OTMyNzEsImV4cCI6MjA3MDM2OTI3MX0.aSeDYiZUXHLnoBXdqzm6j7IxsLbwk8gSrl0x84DytIw";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase JS not loaded. Add CDN script before supabase-client.js");
    return;
  }

  // Create a single client for the app
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Small helpers
  window.getSession = async () => {
    const { data: { session }, error } = await window.sb.auth.getSession();
    if (error) console.error(error);
    return session;
  };

  window.requireAuth = async (redirectTo = "auth.html") => {
    const session = await window.getSession();
    if (!session) {
      window.location.href = redirectTo;
      return null;
    }
    return session;
  };
})();

// --- Require onboarding done before accessing learning pages ---
window.requireOnboarded = async function(redirectTo = 'onboard.html') {
  try {
    // đảm bảo đã đăng nhập
    if (typeof window.requireAuth === 'function') {
      await window.requireAuth('auth.html');
    } else {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return location.href = 'auth.html';
    }

    const { data: { user } } = await sb.auth.getUser();
    const { data: prof, error } = await sb
      .from('profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('requireOnboarded(): profiles not found or RLS?', error);
      // nếu chưa có dòng profile thì cho qua onboard để tạo
      return location.href = redirectTo;
    }
    if (!prof?.onboarding_done) {
      return location.href = redirectTo;
    }
  } catch (e) {
    console.error('requireOnboarded() failed', e);
    location.href = redirectTo;
  }
};
