// app.js — playlist + progress + NOTES with export to Word
document.addEventListener('DOMContentLoaded', () => {
  const player = document.getElementById('player');
  const title = document.getElementById('video-title');
  const lessons = Array.from(document.querySelectorAll('.lesson'));
  const chkOf = (li) => li.querySelector('.chk');
  const LS_PROGRESS = 'course_demo_done_v1';
  const LS_NOTES = 'course_demo_notes_v1';

  // Init totals
  document.getElementById('progress-total').textContent = String(lessons.length);

  // Load saved done state
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_PROGRESS)||'{}'); } catch { return {}; } })();

  lessons.forEach((li, i) => {
    const id = li.dataset.id || String(i);
    if (saved[id]) chkOf(li).checked = true;
  });

  updateDoneUI();
  setActive(0, false);

  function setActive(index, scroll=true){
    lessons.forEach(l => l.classList.remove('active'));
    const li = lessons[index];
    if (!li) return;
    li.classList.add('active');
    const src = li.dataset.src;
    const tit = li.dataset.title;
    if (src) player.src = src;
    if (tit) title.textContent = tit;
    if (scroll){
      document.querySelector('.content').scrollIntoView({behavior:'smooth', block:'start'});
    }
  }

  function updateDoneUI(){
    // write saved
    lessons.forEach((li, i) => {
      const id = li.dataset.id || String(i);
      saved[id] = chkOf(li).checked ? 1 : 0;
    });
    try { localStorage.setItem(LS_PROGRESS, JSON.stringify(saved)); } catch {}

    const done = lessons.filter(li => chkOf(li).checked).length;
    const total = lessons.length || 1;
    const pct = Math.round(done*100/total);
    document.getElementById('progress-bar').style.width = pct+'%';
    document.getElementById('progress-count').textContent = String(done);
    document.getElementById('progress-pct').textContent = pct+'%';
  }

  // Click a lesson row -> set active, but allow checkbox clicks
  lessons.forEach((li, idx) => {
    li.addEventListener('click', (e) => {
      if (e.target && e.target.matches('input.chk')) return; // checkbox handled separately
      setActive(idx);
    });
    chkOf(li).addEventListener('change', updateDoneUI);
  });

  // Controls
  const currentIndex = () => lessons.findIndex(li => li.classList.contains('active'));
  document.getElementById('btn-next').addEventListener('click', () => {
    const i = currentIndex(); if (i === -1) return;
    const chk = chkOf(lessons[i]); chk.checked = true; updateDoneUI();
    setActive(Math.min(i+1, lessons.length-1));
  });
  document.getElementById('btn-prev').addEventListener('click', () => {
    const i = currentIndex(); if (i === -1) return;
    setActive(Math.max(i-1, 0));
  });
  document.getElementById('btn-done').addEventListener('click', () => {
    const i = currentIndex(); if (i === -1) return;
    const chk = chkOf(lessons[i]); chk.checked = true; updateDoneUI();
  });

  // ===== Notes logic =====
  const notes = document.getElementById('notes');
  // Load
  try {
    const savedNotes = localStorage.getItem(LS_NOTES);
    if (savedNotes) notes.value = savedNotes;
  } catch {}

  // Auto-save
  notes.addEventListener('input', () => {
    try { localStorage.setItem(LS_NOTES, notes.value); } catch {}
  });

  // Clear
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Xoá toàn bộ ghi chú?')){
      notes.value = '';
      try { localStorage.removeItem(LS_NOTES); } catch {}
    }
  });

  // Export to Word (.doc as HTML)
  document.getElementById('btn-export').addEventListener('click', () => {
    const titleText = title.textContent || 'ghi-chu';
    const safeTitle = titleText.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g,'-').toLowerCase();
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${titleText}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;line-height:1.6}
h1{font-size:20px;margin:0 0 10px 0}
hr{border:0;border-top:1px solid #ddd;margin:12px 0}
pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit}
.meta{color:#555;font-size:12px}
</style>
</head><body>
<h1>Ghi chú: ${titleText}</h1>
<div class="meta">Xuất từ hệ thống vào ${new Date().toLocaleString()}</div>
<hr>
<pre>${escapeHtml(notes.value)}</pre>
</body></html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghi-chu-${safeTitle}.doc`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  });

  function escapeHtml(s){
    return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  }
});
