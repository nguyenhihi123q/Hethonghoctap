// onboard.js — wizard steps + slider
(async function(){
  await requireAuth('auth.html');

  const step1 = document.querySelector('#form-step-1');
  const step2 = document.querySelector('#form-step-2');
  const step3 = document.querySelector('#form-step-3');

  const dots = document.querySelectorAll('#wizard-steps .dot');
  const setActiveStep = (i)=>dots.forEach((d,idx)=>d.classList.toggle('active', idx===i));

  document.querySelector('#to-step-2').onclick = () => {
    if (!step1.reportValidity()) return;
    step1.style.display='none'; step2.style.display='block'; setActiveStep(1);
  };
  document.querySelector('#back-1').onclick = () => {
    step2.style.display='none'; step1.style.display='block'; setActiveStep(0);
  };
  document.querySelector('#to-step-3').onclick = () => {
    step2.style.display='none'; step3.style.display='block'; setActiveStep(2);
  };
  document.querySelector('#back-2').onclick = () => {
    step3.style.display='none'; step2.style.display='block'; setActiveStep(1);
  };

  step3.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const { data: { user } } = await sb.auth.getUser();
    const payload = {
      goal: goal.value, grade: grade.value,
      hours: Number(hours.value), device: device.value,
      self: {
        html: Number(self_html.value), css: Number(self_css.value),
        js: Number(self_js.value),   algo: Number(self_algo.value),
      }
    };
    const { error } = await sb.from('survey_responses').upsert({ user_id: user.id, version: 1, payload });
    if (error) { alert('Lưu khảo sát lỗi: ' + error.message); return; }
    location.href = 'placement.html';
  });

  // slider
  const slides = document.querySelectorAll('#onboard-slider .slide');
  if (slides.length){
    let i=0, timer=null;
    const show = (n)=>{ slides[i].classList.remove('active'); i=(n+slides.length)%slides.length; slides[i].classList.add('active'); };
    const start=()=> timer=setInterval(()=>show(i+1), 4000);
    const stop =()=> timer&&clearInterval(timer);
    start();
    const box = document.getElementById('onboard-slider');
    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', start);
  }
})();