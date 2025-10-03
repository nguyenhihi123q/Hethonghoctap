// Learning dashboard logic; supports image override from <script id="image-config">
(async function(){
  // Read image configuration (if present)
  let IMG_CFG = { banner: "", courses: {} };
  try {
    const el = document.getElementById("image-config");
    if (el) IMG_CFG = JSON.parse(el.textContent || "{}");
    if (!IMG_CFG || typeof IMG_CFG !== "object") IMG_CFG = { banner: "", courses: {} };
    IMG_CFG.courses = IMG_CFG.courses || {};
  } catch(_) { IMG_CFG = { banner: "", courses: {} }; }

  const session = await window.requireAuth("auth.html");
  if (!session) return;
  const user = session.user;

  // Header user name & avatar
  const name = (user.user_metadata?.full_name || (user.email?.split('@')[0]) || 'bạn').trim();
  document.getElementById("userName").textContent = name;
  document.getElementById("userAvatar").textContent = (name[0] || '?').toUpperCase();

  // User dropdown
  const userBtn = document.getElementById("userBtn");
  const userMenu = document.getElementById("userMenu");
  userBtn.addEventListener("click", (e) => { e.stopPropagation(); userMenu.hidden = !userMenu.hidden; });
  document.addEventListener("click", () => { if (!userMenu.hidden) userMenu.hidden = true; });
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await window.sb.auth.signOut();
    window.location.href = "index.html?login=1";
  });

  // Try fetch courses/enrollments/progress from Supabase if available
  async function tryFetch(){
    try {
      const { data: enrolls, error: e1 } = await window.sb.from("enrollments").select("*").eq("user_id", user.id).limit(50);
      if (e1) throw e1;
      const courseIds = enrolls.map(x => x.course_id);
      const { data: courses, error: e2 } = await window.sb.from("courses").select("*").in("id", courseIds);
      if (e2) throw e2;
      const { data: progress, error: e3 } = await window.sb.from("progress").select("*").eq("user_id", user.id);
      if (e3) throw e3;
      return { enrolls, courses, progress };
    } catch (e) {
      return null;
    }
  }

  // --- Local fallback data: toàn bộ dùng ảnh LOCAL ---
  function sampleData(){
    const courses = [
      { id: "py-101",   title: "Python Cơ Bản",                         cover: "Images/LapTrinhPython.png",        provider:"HITS", level:"Beginner",   lessons: 42 },
      { id: "js-201",   title: "JavaScript Nâng Cao",                    cover: "Images/LapTrinhJava.png",          provider:"HITS", level:"Intermediate",lessons: 36 },
      { id: "sql-101",  title: "SQL cho Người Mới",                      cover: "Images/LapTrinhSql.png",           provider:"HITS", level:"Beginner",   lessons: 24 },
      { id: "algo-101", title: "Thuật toán & Cấu trúc dữ liệu",          cover: "Images/CauTrucDuLieuVaGT.png",     provider:"HITS", level:"Core",       lessons: 30 },
      { id: "web-101",  title: "Web Fundamentals",                        cover: "Images/Web Fundamentals.png",      provider:"HITS", level:"Beginner",   lessons: 28 },
      { id: "ml-101",   title: "Nhập môn Machine Learning",              cover: "Images/Machine Learning.png",      provider:"HITS", level:"Intro",      lessons: 20 },
    ];
    const progress = {
      "py-101": 0.68, "js-201": 0.22, "sql-101": 0.18, "algo-101": 0.10, "web-101": 0.45, "ml-101": 0.05
    };
    // Ưu tiên Python cho "tiếp tục học"
    const last = { id: "py-101", lesson: "Bài 12: Hàm & tham số" };
    return { courses, progress, last };
  }

  const fetched = await tryFetch();
  let data;
  if (fetched && fetched.courses?.length) {
    const progressMap = {};
    (fetched.progress || []).forEach(p => progressMap[p.course_id] = (p.percent || 0)/100);
    const lastEnroll = (fetched.enrolls || [])[0];
    data = {
      courses: fetched.courses.map(c => ({
        id: c.id,
        title: c.title,
        cover: c.cover || "",                       // sẽ được override bằng image-config nếu có
        provider: c.provider || "HITS",
        level: c.level || "All",
        lessons: c.lessons || 0
      })),
      progress: progressMap,
      last: lastEnroll ? { id: lastEnroll.course_id, lesson: lastEnroll.last_lesson || "Bài học gần nhất" } : null
    };
  } else {
    data = sampleData();
  }

  // ===== CHỐT: luôn ưu tiên PYTHON cho "Tiếp tục học" nếu tồn tại =====
  const hasPy = data.courses.find(c => c.id === "py-101");
  if (hasPy) {
    data.last = (data.last && data.last.id === "py-101")
      ? data.last
      : { id: "py-101", lesson: "Bài 12: Hàm & tham số" };
    if (data.progress["py-101"] == null) data.progress["py-101"] = 0.68;
  }

  // Fill "Continue learning"
  const cont = data.last || { id: data.courses[0].id, lesson: "Bài 1: Giới thiệu" };
  const cp = (data.progress[cont.id] || 0);
  document.getElementById("contTitle").textContent =
    data.courses.find(x=>x.id===cont.id)?.title || "Khoá học của bạn";
  document.getElementById("contLesson").textContent = cont.lesson;
  document.getElementById("contProg").style.width = Math.round(cp*100) + "%";

  // Determine banner image: prefer explicit banner in config, else per-course override, else course cover (LOCAL)
  const contCourse = data.courses.find(x=>x.id===cont.id) || data.courses[0];
  let contCoverUrl = "";
  if (IMG_CFG.banner) {
    contCoverUrl = IMG_CFG.banner;
  } else if (contCourse) {
    contCoverUrl =
      IMG_CFG.courses[contCourse.id] ||
      IMG_CFG.courses[contCourse.title] ||
      contCourse.cover || "";
  }
  document.getElementById("contCover").style.backgroundImage =
    contCoverUrl ? `url('${contCoverUrl}')` : "";

  document.getElementById("btnContinue").addEventListener("click", () => {
    alert("Giả lập mở bài học… (bạn có thể nối sang player thực tế)");
  });

  // Render "My courses" (ảnh ưu tiên từ image-config, sau đó tới cover LOCAL)
  const wrap = document.getElementById("courses");
  data.courses.slice(0,6).forEach(c => {
    const p = Math.round((data.progress[c.id] || 0) * 100);
    const override = IMG_CFG.courses[c.id] || IMG_CFG.courses[c.title] || c.cover;
    const el = document.createElement("article");
    el.className = "course";
    el.innerHTML = `
      <div class="cover" style="background-image:url('${override}')"></div>
      <div class="cbody">
        <div class="cmeta"><span class="badge">${c.provider}</span><span class="small">${c.lessons} bài</span></div>
        <h4 style="margin:6px 0 8px; font-size:16px">${c.title}</h4>
        <div class="progress"><i style="width:${p}%"></i></div>
        <div class="cmeta"><span>${p}% hoàn thành</span><a href="#" class="small">Tiếp tục</a></div>
      </div>
    `;
    wrap.appendChild(el);
  });

  // Recommendations
  const recs = document.getElementById("recs");
  const recList = [...data.courses].sort((a,b)=> (data.progress[a.id]||0) - (data.progress[b.id]||0)).slice(0,3);
  recList.forEach(r => {
    const cover = IMG_CFG.courses[r.id] || IMG_CFG.courses[r.title] || r.cover;
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<div class="cover" style="width:56px;height:42px;border-radius:8px;background-image:url('${cover}')"></div>
                    <div><b>${r.title}</b><div class="small" style="color:#64748b">Đề xuất dựa trên lịch sử học</div></div>`;
    recs.appendChild(el);
  });

  // Search filter (client)
  const input = document.getElementById("search");
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    wrap.querySelectorAll(".course").forEach(card => {
      const t = (card.querySelector("h4")?.textContent || "").toLowerCase();
      card.style.display = t.includes(q) ? "" : "none";
    });
  });
})();
