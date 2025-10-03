(function(){
  // ====== Helpers ======
  function q(name){ const p=new URLSearchParams(location.search); return p.get(name); }

  function setText(id, text){
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function normalizeWeeks(w){
    if (!w) return [];
    if (Array.isArray(w)) return w;
    if (typeof w === 'object'){
      const keys = Object.keys(w);
      const numeric = keys.every(k => /^\d+$/.test(k));
      if (numeric){
        return keys.sort((a,b)=>Number(a)-Number(b)).map(k=>w[k]);
      }
    }
    return [];
  }

  function normalizePlan(planRaw){
    if (planRaw && typeof planRaw === 'object'){
      if (Array.isArray(planRaw)) return { weeks: planRaw };
      if (planRaw.weeks) { planRaw.weeks = normalizeWeeks(planRaw.weeks); return planRaw; }
      if (planRaw.plan?.weeks) { planRaw.plan.weeks = normalizeWeeks(planRaw.plan.weeks); return planRaw.plan; }
      if (planRaw.roadmap?.weeks) { planRaw.roadmap.weeks = normalizeWeeks(planRaw.roadmap.weeks); return planRaw.roadmap; }
    }
    let s = (planRaw ?? '').toString().trim();
    if (!s) return null;
    try {
      if ((s.startsWith('\"') && s.endsWith('\"')) || (s.startsWith('\'') && s.endsWith('\''))) {
        s = JSON.parse(s);
        s = (s ?? '').toString().trim();
      }
    } catch(e){}
    if (s.startsWith('=')) s = s.slice(1).trim();
    try {
      if (s.startsWith('{') || s.startsWith('[')) { return normalizePlan(JSON.parse(s)); }
    } catch(e){}
    try {
      const inner = JSON.parse(s);
      if (typeof inner === 'string') {
        let t = inner.trim();
        if (t.startsWith('=')) t = t.slice(1).trim();
        if (t.startsWith('{') || t.startsWith('[')) { return normalizePlan(JSON.parse(t)); }
      } else if (typeof inner === 'object') {
        return normalizePlan(inner);
      }
    } catch(e){}
    return null;
  }

  // ====== Renderers ======
  function renderPerTag(per_tag){
    const tbody = document.querySelector('#per-tag tbody');
    const skillsGrid = document.getElementById('skills-grid');
    if (tbody) tbody.innerHTML = '';
    if (skillsGrid) skillsGrid.innerHTML = '';

    const entries = Object.entries(per_tag || {});
    if (!entries.length){
      if (tbody){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="2">Chưa có dữ liệu kỹ năng.</td>';
        tbody.appendChild(tr);
      }
      return;
    }

    for (const [k,v] of entries){
      // Keep original table format
      if (tbody){
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${k.toUpperCase()}</td><td>${v}%</td>`;
        tbody.appendChild(tr);
      }

      // Visual skill row
      if (skillsGrid){
        const row = document.createElement('div');
        row.className = 'skill';
        const pct = Math.max(0, Math.min(100, Number(v) || 0));
        row.innerHTML = `
          <div class="skill-name">${k.toUpperCase()}</div>
          <div class="progress" aria-label="${k} ${pct}%" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
            <i style="width:${pct}%"></i>
          </div>
          <div class="progress-val">${pct}%</div>
        `;
        skillsGrid.appendChild(row);
      }
    }
  }

  function renderPlan(normalized){
    const planDiv = document.getElementById('plan');
    if (!planDiv) return;
    planDiv.innerHTML = '';

    if (!normalized?.weeks?.length){
      const empty = document.createElement('p');
      empty.textContent = 'Chưa có lộ trình được lưu.';
      planDiv.appendChild(empty);
      return;
    }

    normalized.weeks.forEach((w, i)=>{
      const week = w.week || (i+1);
      const focus = w.focus || w.theme || w.topic || '';
      const objectives = w.objectives || w.goals || [];
      const projects = w.projects || w.tasks || [];

      const el = document.createElement('article');
      el.className = 'plan-week';
      el.innerHTML = `
        <h3>Tuần ${week}: ${String(focus).toUpperCase()}</h3>
        <div class="meta">Mục tiêu</div>
        ${objectives.length ? `<ul class="list">${objectives.map(o=>`<li>${o}</li>`).join('')}</ul>` : '<p class="meta">(Chưa có)</p>'}
        <div class="meta" style="margin-top:6px">Sản phẩm</div>
        ${projects.length ? `<ul class="list">${projects.map(p=>`<li>${p}</li>`).join('')}</ul>` : '<p class="meta">(Chưa có)</p>'}
      `;
      planDiv.appendChild(el);
    });
  }

  // ====== Data layer (Supabase) ======
  async function getLatestPlan(userId, attemptId){
    const tried = [];
    async function tryQuery(selectStr, filtersCb, orderCol){
      let query = sb.from('recommendations').select(selectStr);
      query = filtersCb(query);
      if (orderCol) {
        try { query = query.order(orderCol, { ascending:false, nullsFirst:false }); } catch(e) {}
      }
      const { data, error } = await query.limit(1);
      tried.push({selectStr, orderCol, error});
      if (error) {
        console.warn('recommendations query error:', error);
        return null;
      }
      if (data && data.length && data[0].plan) return data[0].plan;
      return null;
    }

    let plan = await tryQuery('plan, created_at, updated_at, id', q => q.eq('user_id', userId), 'created_at');
    if (!plan) plan = await tryQuery('plan, updated_at, id', q => q.eq('user_id', userId), 'updated_at');
    if (!plan) plan = await tryQuery('plan', q => q.eq('user_id', userId), null);

    if (!plan && attemptId){
      plan = await tryQuery('plan, created_at, updated_at, id', q => q.eq('attempt_id', attemptId), 'created_at');
      if (!plan) plan = await tryQuery('plan, updated_at, id', q => q.eq('attempt_id', attemptId), 'updated_at');
      if (!plan) plan = await tryQuery('plan', q => q.eq('attempt_id', attemptId), null);
    }
    return plan;
  }

  // ====== Lifecycle ======
  async function load(){
    try{
      if (!window.requireAuth){ console.error('requireAuth not found'); }
      await requireAuth('auth.html');

      if (!window.sb){ console.error('Supabase client "sb" is missing'); return; }

      const attemptId = Number(q('attempt'));
      const { data: { user } } = await sb.auth.getUser();

      const [profRes, attemptRes] = await Promise.allSettled([
        sb.from('profiles').select('placement_level, skill_profile, recommended_plan').eq('id', user.id).maybeSingle(),
        attemptId ? sb.from('test_attempts').select('*').eq('id', attemptId).maybeSingle() : Promise.resolve({ value: { data: null } })
      ]);

      const prof = profRes.status === 'fulfilled' ? profRes.value.data : null;
      const attempt = attemptRes.status === 'fulfilled' ? attemptRes.value.data : null;

      const placement = prof?.placement_level || attempt?.placement || 'intermediate';
      const score = prof?.skill_profile?.score ?? attempt?.score ?? 0;
      const per_tag = prof?.skill_profile?.per_tag ?? attempt?.per_tag ?? {};

      // Summary top
      const summaryEl = document.getElementById('summary');
      if (summaryEl) summaryEl.textContent = `Mức hiện tại: ${String(placement).toUpperCase()} • Tổng điểm: ${score}%`;
      setText('placement-badge', String(placement).toUpperCase());
      setText('score-total', `${score}%`);

      // Skills
      renderPerTag(per_tag);

      // Plan
      let planRaw = await getLatestPlan(user.id, attemptId || attempt?.id);
      if (!planRaw) planRaw = prof?.recommended_plan ?? null;
      const normalized = normalizePlan(planRaw);
      renderPlan(normalized);

      // Button safety (prevent accidental navigation if not ready)
      const startBtn = document.getElementById('start-learning');
      if (startBtn){
        startBtn.addEventListener('click', (e)=>{
          // allow default, just ensure we have summary rendered
          if (!normalized?.weeks?.length){
            // still allow navigation, but you could optionally guard here
          }
        });
      }
    }catch(err){
      console.error('Load error:', err);
      const summaryEl = document.getElementById('summary');
      if (summaryEl) summaryEl.textContent = 'Không thể tải dữ liệu. Vui lòng thử lại.';
    }
  }

  window.addEventListener('DOMContentLoaded', load);
})();