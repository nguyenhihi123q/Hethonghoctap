
// ---- helpers ----
const BAR = document.getElementById('bar');
const PROG_TEXT = document.getElementById('progress-text');
const FORM = document.getElementById('test-form');
const BTN = document.getElementById('submit-btn');

let QUESTIONS = [];
let START = Date.now();
const localKey = 'placement_answers_v1';

function shuffle(arr){ for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr;}
function weight(difficulty){ return 1 + 0.25*(difficulty-1); }
function escapeHTML(str){
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// Track per-question time (rough approximation by last interaction)
const timeSpent = new Map(); // qid -> ms
let lastQid = null;
let lastTs = Date.now();
function markTime(qid){
  const now = Date.now();
  if(lastQid !== null){
    const prev = timeSpent.get(lastQid) || 0;
    timeSpent.set(lastQid, prev + (now - lastTs));
  }
  lastQid = qid;
  lastTs = now;
}

function updateProgress(){
  const total = QUESTIONS.length;
  const answered = QUESTIONS.reduce((acc, q)=> acc + (FORM.querySelector('input[name="q'+q.id+'"]:checked') ? 1 : 0), 0);
  const pct = total ? Math.round(answered/total*100) : 0;
  BAR.style.width = pct + '%';
  PROG_TEXT.textContent = 'Đã trả lời ' + answered + '/' + total + ' ('+ pct + '%)';
  BTN.disabled = answered !== total || total === 0;
}

function render(){
  FORM.innerHTML = '';
  QUESTIONS.forEach((q, idx)=>{
    const tpl = document.getElementById('q-tpl').content.cloneNode(true);
    const title = tpl.querySelector('.q-title');
    const meta = tpl.querySelector('.q-meta');
    const opts = tpl.querySelector('.q-options');

    title.textContent = (idx+1) + '. ' + q.stem;
    meta.innerHTML = '#'+(idx+1) + ' • ' + (q.tags||[]).map(t=>`<span class="tag">${escapeHTML(t)}</span>`).join(' ') + ' • Độ khó: ' + escapeHTML(q.difficulty);

    (q.options||[]).forEach((opt,i)=>{
      const id = 'q'+q.id+'_opt'+i;
      const wrap = document.createElement('label');
      wrap.className = 'option';
      // Không cần setAttribute('for', id) khi input nằm bên trong label

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'q'+q.id;
      input.id = id;
      input.value = i;
      input.required = true;
      input.addEventListener('change', ()=>{
        markTime(q.id);
        persistLocal();
        updateProgress();
      });

      const span = document.createElement('span');
      span.className = 'option-text';
      span.textContent = opt;

      wrap.appendChild(input);
      wrap.appendChild(span);
      opts.appendChild(wrap);
    });

    FORM.appendChild(tpl);
  });

  // Try restore local selections
  try {
    const saved = JSON.parse(localStorage.getItem(localKey) || '{}');
    if (saved && saved.answers){
      for(const [qid, idx] of Object.entries(saved.answers)){
        const el = FORM.querySelector('input[name="q'+qid+'"][value="'+idx+'"]');
        if(el){ el.checked = true; }
      }
      if(saved.timeSpent){
        Object.entries(saved.timeSpent).forEach(([qid, ms])=> timeSpent.set(Number(qid), Number(ms)));
      }
    }
  } catch(e){ console.warn('Restore local failed', e); }

  updateProgress();
}

function persistLocal(){
  const obj = { answers: {}, timeSpent: Object.fromEntries(timeSpent) };
  QUESTIONS.forEach(q=>{
    const sel = FORM.querySelector('input[name="q'+q.id+'"]:checked');
    if(sel) obj.answers[q.id] = Number(sel.value);
  });
  try { localStorage.setItem(localKey, JSON.stringify(obj)); } catch(_){}
}

async function loadQuestions(){
  await requireAuth('auth.html');
  const { data, error } = await sb.from('test_questions')
    .select('id, stem, options, correct_index, tags, difficulty')
    .eq('active', true)
    .eq('version', 1)
    .limit(40);
  if(error){ alert('Lỗi tải câu hỏi: ' + error.message); enableSubmitSoon(); return; }

  // chọn ~12 câu (3 css, 3 html, 3 js, 3 algo) nếu có
  const byTag = {html:[],css:[],js:[],algo:[]};
  (data||[]).forEach(q=> (q.tags||[]).forEach(t=>{ if(byTag[t]) byTag[t].push(q); }));
  let pick = [];
['html','css','js','algo'].forEach(tag=>{
  pick = pick.concat(shuffle(byTag[tag]).slice(0,3));
});
// Deduplicate by question id (vì một câu có thể thuộc nhiều tag)
{
  const seen = new Set();
  pick = pick.filter(q => (seen.has(q.id) ? false : (seen.add(q.id), true)));
}
// Backfill to 12 unique questions
if (pick.length < 12) {
  const ids = new Set(pick.map(x=>x.id));
  shuffle(data).forEach(x=> { if(pick.length<12 && !ids.has(x.id)) { pick.push(x); ids.add(x.id); } });
}
  QUESTIONS = pick;
  render();
}

async function submitTest(){
  try { BTN.disabled = true; BTN.textContent = 'Đang nộp...'; } catch(_){}
  const { data: { user } } = await sb.auth.getUser();
  if(!user){ location.href='auth.html'; return; }

  // Chấm điểm
  let tagStat = {}; // {tag: {w:sumWeight, c:sumCorrectWeight}}
  let answers = [];
  let correctCount = 0;

  QUESTIONS.forEach((q)=>{
    const sel = document.querySelector('input[name="q'+q.id+'"]:checked');
    if(!sel){ alert('Vui lòng trả lời hết câu hỏi.'); throw new Error('unanswered'); }
    const selectedIndex = Number(sel.value);
    const isCorrect = selectedIndex === q.correct_index;
    const w = weight(q.difficulty);
    (q.tags||[]).forEach(t=>{
      tagStat[t] = tagStat[t] || {w:0,c:0};
      tagStat[t].w += w;
      tagStat[t].c += isCorrect ? w : 0;
    });
    correctCount += isCorrect ? 1 : 0;
    const ms = timeSpent.get(q.id) || 0;
    answers.push({ question_id: q.id, selected_index: selectedIndex, is_correct: isCorrect, time_spent_ms: ms });
  });

  const per_tag = {};
  for(const [t, s] of Object.entries(tagStat)){
    per_tag[t] = Math.round((s.c / s.w) * 100);
  }
  const score = Math.round(correctCount / QUESTIONS.length * 100);

  // Xếp mức
  let placement = 'intermediate';
  const tagVals = Object.values(per_tag);
  const lowTags = Object.values(per_tag).filter(v => v < 40).length;
  if (score < 50 || lowTags >= 2) placement = 'beginner';
  else if (score >= 80 && tagVals.every(v => v >= 60)) placement = 'advanced';

  // tạo attempt
  const { data: attemptRow, error: e1 } = await sb.from('test_attempts')
    .insert({ user_id: user.id, version: 1, started_at: new Date(START).toISOString(), ended_at: new Date().toISOString(), score, per_tag })
    .select('*')
    .single();
  if(e1){ alert('Lỗi lưu attempt: '+e1.message); enableSubmitSoon(); return; }

  // lưu answers
  // Deduplicate rows by question_id within this payload
const _seenQ = new Set();
const rows = answers.reduce((arr,a)=>{
  if(_seenQ.has(a.question_id)) return arr;
  _seenQ.add(a.question_id);
  arr.push({ attempt_id: attemptRow.id, ...a });
  return arr;
}, []);
  const { error: e2 } = await sb.from('test_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
  if(e2){ alert('Lỗi lưu answers: '+e2.message); enableSubmitSoon(); return; }

  // tạo plan đơn giản 4 tuần
  const plan = (function(){
    function weakest(n){
      const pairs = Object.entries(per_tag).sort((a,b)=>a[1]-b[1]);
      return pairs.slice(0, n).map(p=>p[0]);
    }
    const gaps = weakest(2);
    const base = ['html','css','js','algo'];
    const order = [...new Set([...gaps, ...base])];
    return {
      weeks: [
        { week: 1, focus: order[0]||'html', goals: ['Ôn nền tảng', 'Bài tập cơ bản'], deliverable: 'Quiz nhỏ' },
        { week: 2, focus: order[1]||'css', goals: ['Thực hành qua mini UI'], deliverable: 'Trang tĩnh' },
        { week: 3, focus: order[2]||'js', goals: ['DOM, sự kiện'], deliverable: 'Todo App' },
        { week: 4, focus: order[3]||'algo', goals: ['Thuật toán cơ bản'], deliverable: 'Bài tập leetcode easy' }
      ],
      created_at: new Date().toISOString(),
      placement, score, per_tag
    };
  })();

  const { error: e3 } = await sb.from('profiles')
    .update({ onboarding_done: true, placement_level: placement, skill_profile: { score, per_tag, at: new Date().toISOString() } })
    .eq('id', user.id);
  if(e3){ alert('Lỗi cập nhật hồ sơ: '+e3.message); enableSubmitSoon(); return; }

  const { error: e4 } = await sb.from('recommendations')
    .upsert({ user_id: user.id, plan });
  if(e4){ alert('Lỗi lưu lộ trình: '+e4.message); enableSubmitSoon(); return; }

  await sendToN8n({ user_id: user.id, placement, score, per_tag, plan });

  try { localStorage.removeItem(localKey); } catch(_){}
  location.href = 'results.html?attempt=' + attemptRow.id;
  enableSubmitSoon();
}

// --- n8n webhook config (điền trước khi deploy) ---
const N8N_URL   = 'https://automation.ailabviet.com/webhook/onboarding'; // ← THAY bằng URL Production của bạn
const N8N_TOKEN = 'ABCD1234'; // ← tùy chọn: set nếu workflow kiểm tra X-Workflow-Token

async function sendToN8n(payload){
  try {
    if (!N8N_URL) return;
    const headers = { 'Content-Type': 'application/json' };
    if (N8N_TOKEN) headers['X-Workflow-Token'] = N8N_TOKEN;
    const res = await fetch(N8N_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await res.text();
    console.log('[n8n] status:', res.status, 'body:', text);
    if (res.status === 401) alert('n8n 401 Unauthorized: kiểm tra token và node IF/Authentication trong workflow.');
    else if (!res.ok) alert('n8n lỗi HTTP ' + res.status + ': ' + text);
  } catch (err) {
    console.warn('[n8n] lỗi gọi webhook:', err);
  }
}
// --- end n8n config ---

function enableSubmitSoon(){
  try { BTN.disabled = false; BTN.textContent = 'Nộp bài'; } catch(_){}
}


// Prevent unwanted page jumps:
// 1) Never submit the form by default
FORM.addEventListener('submit', (e)=> e.preventDefault());
// 2) Block anchors with href="#" (logo...)
document.addEventListener('click', (e)=>{
  const a = e.target.closest('a[href="#"]');
  if(a){ e.preventDefault(); }
});

// events
document.getElementById('submit-btn').addEventListener('click', function(e){
  e.preventDefault();
  openConfirm();
});

// Kick off
loadQuestions();


// ===== Confirm modal & top progress =====
const MODAL = document.getElementById('confirm-modal');
const BTN_YES = document.getElementById('confirm-yes');
const BTN_NO  = document.getElementById('confirm-no');
const GP      = document.getElementById('global-progress');

function openConfirm(){ if(MODAL){ MODAL.hidden = false; MODAL.classList.add('show'); } }
function closeConfirm(){ if(MODAL){ MODAL.classList.remove('show'); MODAL.hidden = true; } }
function startProgress(){ if(GP) GP.classList.add('show'); }
function stopProgress(){ if(GP) GP.classList.remove('show'); }

if (BTN_YES){
  BTN_YES.addEventListener('click', async () => {
    closeConfirm();
    startProgress();
    try { await submitTest(); } finally { /* nếu redirect thì dòng dưới không chạy, ok */ stopProgress(); }
  });
}
if (BTN_NO){
  BTN_NO.addEventListener('click', () => closeConfirm());
}


// Strong guard: block any same-page hash navigation to prevent jump-to-top
document.addEventListener('click', (e)=>{
  const a = e.target.closest('a');
  if(!a) return;
  const href = a.getAttribute('href');
  if(!href) return;
  // Ignore absolute external links
  if (href.startsWith('#')) { e.preventDefault(); return; }
  try{
    const url = new URL(href, location.href);
    if(url.origin === location.origin && url.pathname === location.pathname && url.hash){
      e.preventDefault();
    }
  }catch(_){}
});
// Preserve scroll position when radios change (defensive)
document.addEventListener('change', (e)=>{
  if(e.target && e.target.matches('input[type="radio"]')){
    const y = window.scrollY;
    // After reflow (progress update, etc.) restore
    setTimeout(()=> window.scrollTo({top: y}), 0);
  }
});
