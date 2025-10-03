// course-catalog.js
// Global course catalog used by learn.js recommender
// Load this BEFORE learn.js
window.COURSE_CATALOG = [
  { id: "python_basic",   title: "Python Cơ Bản",            level: "BEGINNER",     tags: ["python","programming","variables","loops","beginner"] },
  { id: "javascript_adv", title: "JavaScript Nâng Cao",      level: "INTERMEDIATE", tags: ["javascript","async","closures","es6","advanced"] },
  { id: "sql_beginner",   title: "SQL cho Người Mới",        level: "BEGINNER",     tags: ["sql","database","queries","join","beginner"] },
  { id: "algo_ds",        title: "Thuật toán & Cấu trúc DL", level: "INTERMEDIATE", tags: ["algorithms","data structures","sorting","searching"] },
  { id: "ml_intro",       title: "Nhập môn Machine Learning",level: "INTERMEDIATE", tags: ["machine learning","python","sklearn","regression","classification"] },
  { id: "web_frontend",   title: "Web Frontend",             level: "BEGINNER",     tags: ["html","css","javascript","web"] },
  { id: "java_oop",       title: "Lập trình Java OOP",       level: "INTERMEDIATE", tags: ["java","oop","inheritance","encapsulation"] },
  { id: "db_design",      title: "Thiết kế CSDL",            level: "INTERMEDIATE", tags: ["database","sql","normalization","index"] }
];

// Optionally, expose a safe getter
window.getCourseCatalog = function(){ return Array.isArray(window.COURSE_CATALOG) ? window.COURSE_CATALOG : []; };
