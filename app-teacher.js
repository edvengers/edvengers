// app-teacher.js (MASTER RESTORED & FIXED)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, setDoc, getDoc, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhD_rigOfXWYGcj7ooUggG0H4oVtV9cDI",
  authDomain: "edvengers-portal.firebaseapp.com",
  projectId: "edvengers-portal",
  storageBucket: "edvengers-portal.firebasestorage.app",
  messagingSenderId: "825538244708",
  appId: "1:825538244708:web:5eb57d970a65433190ef71",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// HELPERS
function fmtDateDayMonthYear(ts) { if (!ts) return "-"; return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function slugify(name) { return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, ""); }
function fmtTime(ts) { if (!ts) return ""; return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

// AUTH
const TEACHER_PASSWORD = "kalb25";
const loginForm = document.getElementById("teacher-login-form");

document.addEventListener("DOMContentLoaded", () => {
  if(localStorage.getItem("edvengerTeacherLoggedIn") === "yes") showDashboard();
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pwd = document.getElementById("teacher-password").value.trim();
      if (pwd === TEACHER_PASSWORD) {
        localStorage.setItem("edvengerTeacherLoggedIn", "yes");
        showDashboard();
      } else { alert("Wrong password."); }
    });
  }
  document.getElementById("teacher-logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("edvengerTeacherLoggedIn");
    location.reload();
  });
  
  const lastTab = localStorage.getItem("evTeacherTab");
  if(lastTab) switchTab(lastTab);
});

function showDashboard() {
  document.getElementById("teacher-login-section").style.display = "none";
  document.getElementById("teacher-dashboard-section").style.display = "block";
}

/* --- TABS --- */
window.switchTab = function(tabName) {
  document.querySelectorAll(".ev-tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".ev-tab-content").forEach(content => content.classList.remove("active"));
  document.querySelector(`button[onclick="switchTab('${tabName}')"]`)?.classList.add("active");
  document.getElementById(`tab-${tabName}`)?.classList.add("active");
  localStorage.setItem("evTeacherTab", tabName);
};

/* --- ADMIN: STUDENTS & HERO POINTS --- */
const studentsForm = document.getElementById("students-form");
const studentsList = document.getElementById("students-list");
const studentsSelect = document.getElementById("student-select");
const filterLevelInput = document.getElementById("filter-level");
const filterSubjectInput = document.getElementById("filter-subject");
const updatePointsBtn = document.getElementById("btn-update-points");

let studentsCache = [];
let selectedStudentId = null; 
let stagedDelta = 0; 

function renderStudentRow() {
  if (!studentsList) return;
  studentsList.innerHTML = "";
  if (!selectedStudentId) {
    studentsList.innerHTML = '<p class="helper-text">Select a student above to see Hero Points.</p>';
    return;
  }
  const student = studentsCache.find(s => s.id === selectedStudentId);
  if (!student) {
    studentsList.innerHTML = '<p class="helper-text">Student not found in current filter.</p>';
    return;
  }
  const current = student.stars || 0;
  const pendingText = stagedDelta !== 0 ? ` (pending: ${stagedDelta > 0 ? "+" : ""}${stagedDelta})` : "";
  const row = document.createElement("div");
  row.className = "student-row ev-card-bubble";
  row.innerHTML = `
    <div class="student-main">
      <div><strong>${student.name}</strong></div>
      <div class="helper-text">Level: ${student.level || "-"} • HP: <strong>${current}</strong>${pendingText}</div>
    </div>`;
  studentsList.appendChild(row);
}

function applyFiltersAndFillSelect() {
  if (!studentsSelect) return;
  const levelFilter = (filterLevelInput?.value || "").trim();
  const subjectFilter = (filterSubjectInput?.value || "").trim();
  
  let list = [...studentsCache];
  if (levelFilter) list = list.filter((s) => s.level === levelFilter);
  if (subjectFilter) list = list.filter((s) => (s.subjects || []).includes(subjectFilter));

  studentsSelect.innerHTML = '<option value="">-- Select student --</option>';
  list.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id; opt.textContent = s.name;
    studentsSelect.appendChild(opt);
  });
  if (!list.some(s => s.id === selectedStudentId)) {
    selectedStudentId = null; stagedDelta = 0;
  }
  renderStudentRow();
}

if(filterLevelInput) filterLevelInput.onchange = applyFiltersAndFillSelect;
if(filterSubjectInput) filterSubjectInput.onchange = applyFiltersAndFillSelect;
if(studentsSelect) studentsSelect.onchange = () => { selectedStudentId = studentsSelect.value || null; stagedDelta = 0; renderStudentRow(); };

// Point Buttons
document.getElementById("btn-add-1")?.addEventListener("click", () => { stagedDelta += 1; renderStudentRow(); });
document.getElementById("btn-add-5")?.addEventListener("click", () => { stagedDelta += 5; renderStudentRow(); });
document.getElementById("btn-sub-1")?.addEventListener("click", () => { stagedDelta -= 1; renderStudentRow(); });
document.getElementById("btn-sub-5")?.addEventListener("click", () => { stagedDelta -= 5; renderStudentRow(); });

if(updatePointsBtn) updatePointsBtn.onclick = async () => {
    if(!selectedStudentId || stagedDelta===0) return;
    await updateDoc(doc(db,"students",selectedStudentId), { stars: increment(stagedDelta), updatedAt: Date.now() });
    stagedDelta = 0;
    renderStudentRow();
};

onSnapshot(query(collection(db, "students"), orderBy("name", "asc")), (snap) => {
  studentsCache = [];
  snap.forEach(d => studentsCache.push({ id:d.id, ...d.data() }));
  applyFiltersAndFillSelect();
});

/* --- ADMIN: ANNOUNCEMENTS --- */
const annForm = document.getElementById("announcement-form");
const annList = document.getElementById("announcement-list");

if (annForm) {
  annForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("announcement-title").value.trim();
    const message = document.getElementById("announcement-message").value.trim();
    const isPinned = document.getElementById("announcement-pinned")?.checked || false;
    const levelVal = document.getElementById("announcement-level").value;
    const subjectVal = document.getElementById("announcement-subject").value;

    if (!title) return;
    const levels = levelVal ? [levelVal] : [];
    const subjects = subjectVal ? [subjectVal] : [];

    await addDoc(collection(db, "announcements"), { title, message, isPinned, levels, subjects, createdAt: Date.now() });
    annForm.reset();
  });
}

if (annList) {
  onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap) => {
    annList.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const card = document.createElement("div");
      card.className = "ev-card-bubble";
      if(d.isPinned) card.style.border = "1px solid var(--ev-accent)";
      card.innerHTML = `<h4>${d.isPinned?"📌 ":""}${d.title}</h4><p>${d.message}</p>
        <p class="helper-text">Target: ${(d.levels||[]).join(", ")||"All Levels"} • ${(d.subjects||[]).join(", ")||"All Subjects"}</p>`;
      annList.appendChild(card);
    });
  });
}

/* --- MISSIONS: HOMEWORK --- */
const hwForm = document.getElementById("homework-form");
const hwList = document.getElementById("homework-list");

if (hwForm) {
  hwForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("homework-title").value.trim();
    const desc = document.getElementById("homework-description").value.trim();
    
    // RESTORED: Loop for 5 Links
    const links = [];
    for(let i=1; i<=5; i++) {
        const name = document.getElementById(`homework-name-${i}`).value.trim();
        const url = document.getElementById(`homework-link-${i}`).value.trim();
        if(url) links.push({ name: name || `Link ${i}`, url: url });
    }

    const levelVal = document.getElementById("homework-level").value;
    const subjectVal = document.getElementById("homework-subject").value;

    if (!title || links.length === 0) return;
    
    const levels = levelVal ? [levelVal] : [];
    const subjects = subjectVal ? [subjectVal] : [];

    await addDoc(collection(db, "homework"), { title, description:desc, links, levels, subjects, postedAt: Date.now() });
    hwForm.reset();
  });
}

if (hwList) {
  onSnapshot(query(collection(db, "homework"), orderBy("postedAt", "desc")), (snap) => {
    hwList.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      // RESTORED: Show links in teacher view
      const linkHtml = (d.links||[]).map(l => `<li><a href="${l.url}" target="_blank">${l.name}</a></li>`).join("");
      const card = document.createElement("div");
      card.className = "ev-card-bubble";
      card.innerHTML = `<h4>${d.title}</h4><p>${d.description||""}</p>
        <ul class="ev-link-list">${linkHtml}</ul>
        <p class="helper-text">Target: ${(d.levels||[]).join(", ")||"All"} • ${(d.subjects||[]).join(", ")||"All"}</p>`;
      hwList.appendChild(card);
    });
  });
}

/* --- MISSIONS: WRITING GYM --- */
// (Keep existing code from previous file - abbreviated here for space, but ensure you include the Gym Create & Inbox Logic)
const gymCreateForm = document.getElementById("gym-create-form");
const gymListContainer = document.getElementById("drill-list-container");
const gymInboxContainer = document.getElementById("gym-inbox-container");

if (gymCreateForm) {
  gymCreateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    document.getElementById("drill-status").textContent = "Deploying...";
    const title = document.getElementById("drill-title").value.trim();
    const level = document.getElementById("drill-level").value;
    const instructions = document.getElementById("drill-instructions").value.trim();
    const powerWords = document.getElementById("drill-powerwords").value.split(",").map(s=>s.trim()).filter(s=>s);
    const aiPrompt = document.getElementById("drill-ai-prompt").value.trim();
    const file = document.getElementById("drill-image").files[0];

    let imageUrl = null;
    if (file) {
      const ref = storageRef(storage, `drill-images/${Date.now()}_${file.name}`);
      await uploadBytes(ref, file);
      imageUrl = await getDownloadURL(ref);
    }
    await addDoc(collection(db, "writing_drills"), { title, level, instructions, powerWords, aiPrompt, imageUrl, createdAt: Date.now() });
    gymCreateForm.reset();
    document.getElementById("drill-status").textContent = "Deployed!";
  });
}

if (gymListContainer) {
  onSnapshot(query(collection(db, "writing_drills"), orderBy("createdAt", "desc")), (snap) => {
    gymListContainer.innerHTML = snap.empty ? '<p class="helper-text">No active missions.</p>' : "";
    snap.forEach(d => {
        const data = d.data();
        const div = document.createElement("div"); div.className="ev-card-bubble drill-card";
        div.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>${data.title} (${data.level})</strong><button class="btn btn-ghost btn-small" style="color:#ff6b6b;padding:2px;" onclick="deleteDrill('${d.id}')">🗑️</button></div>`;
        gymListContainer.appendChild(div);
    });
  });
}
window.deleteDrill = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db,"writing_drills",id)); };

if (gymInboxContainer) {
  onSnapshot(query(collection(db, "writing_submissions"), orderBy("createdAt", "desc")), (snap) => {
    gymInboxContainer.innerHTML = snap.empty ? '<p class="helper-text">No submissions.</p>' : "";
    snap.forEach((docSnap) => {
      const sub = docSnap.data();
      const isDone = sub.status === "graded";
      const card = document.createElement("div");
      card.className = "ev-card-bubble";
      if(isDone) card.style.opacity = "0.6"; 

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div><h4 style="margin:0;">${sub.studentName}</h4><span style="font-size:0.8rem; color:var(--ev-accent);">${sub.drillTitle}</span></div>
          <div style="text-align:right;"><span class="helper-text">${fmtDateDayMonthYear(sub.createdAt)}</span><br>${isDone ? '✅' : '🟡'}</div>
        </div>
        <details style="margin-top:0.5rem;">
          <summary class="btn btn-ghost btn-small" style="width:100%;">Review & Mark</summary>
          <div style="background:#020617; padding:1rem; margin-top:0.5rem; border-radius:8px;">
            <p style="white-space:pre-wrap; font-family:monospace; color:#e2e8f0;">${sub.text}</p>
            <button class="btn btn-primary" style="width:100%; margin-top:1rem;" onclick="copyForAI('${docSnap.id}', '${sub.drillId}')">⚡ Copy for AI</button>
            <textarea id="feedback-${docSnap.id}" rows="3" placeholder="Paste AI feedback here..." style="margin-top:1rem;">${sub.feedback || ""}</textarea>
            <button class="btn" style="width:100%; margin-top:0.5rem;" onclick="saveFeedback('${docSnap.id}')">💾 Send Intel</button>
          </div>
        </details>`;
      gymInboxContainer.appendChild(card);
    });
  });
}
window.copyForAI = async (subId, drillId) => {
  const sub = (await getDoc(doc(db,"writing_submissions",subId))).data();
  const drill = (await getDoc(doc(db,"writing_drills",drillId))).data();
  navigator.clipboard.writeText(`${drill.aiPrompt}\n\n---\n${sub.text}`).then(()=>alert("Copied!"));
};
window.saveFeedback = async (subId) => {
  await updateDoc(doc(db,"writing_submissions",subId), { feedback: document.getElementById(`feedback-${subId}`).value, status: "graded" });
  alert("Sent!");
};

/* --- SELF TRAINING (RESTORED P3-P6) --- */
const trainingForm = document.getElementById("training-links-form");
if (trainingForm) {
  getDoc(doc(db, "settings", "training_links")).then(snap => {
    if(snap.exists()) {
      const d = snap.data();
      if(document.getElementById("link-p3-english")) document.getElementById("link-p3-english").value = d.p3_eng||"";
      if(document.getElementById("link-p3-math")) document.getElementById("link-p3-math").value = d.p3_math||"";
      if(document.getElementById("link-p4-english")) document.getElementById("link-p4-english").value = d.p4_eng||"";
      if(document.getElementById("link-p4-math")) document.getElementById("link-p4-math").value = d.p4_math||"";
      if(document.getElementById("link-p5-english")) document.getElementById("link-p5-english").value = d.p5_eng||"";
      if(document.getElementById("link-p5-math")) document.getElementById("link-p5-math").value = d.p5_math||"";
      if(document.getElementById("link-p6-english")) document.getElementById("link-p6-english").value = d.p6_eng||"";
      if(document.getElementById("link-p6-math")) document.getElementById("link-p6-math").value = d.p6_math||"";
    }
  });
  trainingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
        p3_eng: document.getElementById("link-p3-english").value.trim(),
        p3_math: document.getElementById("link-p3-math").value.trim(),
        p4_eng: document.getElementById("link-p4-english").value.trim(),
        p4_math: document.getElementById("link-p4-math").value.trim(),
        p5_eng: document.getElementById("link-p5-english").value.trim(),
        p5_math: document.getElementById("link-p5-math").value.trim(),
        p6_eng: document.getElementById("link-p6-english").value.trim(),
        p6_math: document.getElementById("link-p6-math").value.trim(),
        updatedAt: Date.now()
    };
    await setDoc(doc(db,"settings","training_links"), data, { merge: true });
    alert("Saved!");
  });
}

/* --- COMMS LINK (RESTORED CHAT LISTENER) --- */
const chatStudentList = document.getElementById("chat-student-list");
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("teacher-chat-form");
let chatStudentId = null;
let chatThreadUnsub = null;

if (chatStudentList) {
  // RESTORED: Sidebar Generation
  onSnapshot(query(collection(db, "students"), orderBy("name", "asc")), (snap) => {
    chatStudentList.innerHTML = "";
    snap.forEach((docSnap) => {
      const s = docSnap.data();
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-student-item" + (s.id === chatStudentId ? " active" : "");
      item.innerHTML = `
        <div class="chat-student-name-row"><span class="chat-student-name">${s.name}</span>${s.hasUnread?'<span class="unread-badge">!</span>':''}</div>
        <div class="chat-student-meta">${s.level}</div>`;
      
      item.onclick = () => {
        chatStudentId = docSnap.id;
        document.getElementById("teacher-chat-student-id").value = docSnap.id;
        document.querySelectorAll(".chat-student-item").forEach(b => b.classList.remove("active"));
        item.classList.add("active");
        
        updateDoc(doc(db,"students",docSnap.id), {hasUnread:false});
        
        if(chatThreadUnsub) chatThreadUnsub();
        const q = query(collection(db, "chats", docSnap.id, "messages"), orderBy("createdAt", "asc"));
        chatThreadUnsub = onSnapshot(q, (msgSnap) => {
            chatThread.innerHTML = "";
            msgSnap.forEach(m => {
                const msg = m.data();
                const cls = msg.sender==="teacher"?"chat-row-right":"chat-row-left";
                const bub = msg.sender==="teacher"?"chat-bubble-me":"chat-bubble-other";
                const div = document.createElement("div"); div.className = `chat-row ${cls}`;
                div.innerHTML = `<div class="chat-bubble ${bub}">${msg.text||""}${msg.imageUrl?`<img src="${msg.imageUrl}">`:""}<div class="chat-time">${fmtTime(msg.createdAt)}</div></div>`;
                chatThread.appendChild(div);
            });
            chatThread.scrollTop = chatThread.scrollHeight;
        });
      };
      chatStudentList.appendChild(item);
    });
  });
}

if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!chatStudentId) return alert("Select student first.");
    const txt = document.getElementById("teacher-chat-input").value.trim();
    if(txt) {
        await addDoc(collection(db, "chats", chatStudentId, "messages"), {sender:"teacher", text:txt, createdAt:Date.now()});
        document.getElementById("teacher-chat-input").value = "";
    }
  });
}