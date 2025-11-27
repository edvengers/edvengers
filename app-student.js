alert("SYSTEM CHECK: JavaScript is connected!");
// app-student.js (DEBUG MODE)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, getDoc, increment, where
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

// --- CONFIG & AUDIO ---
const AVATAR_PATH = "images/avatars/";
// CHECK: Are your files .png or .jpg?
const AVAILABLE_AVATARS = [
  "hero-1.png", "hero-2.png", "hero-3.png", "hero-4.png", 
  "hero-5.png", "hero-6.png", "hero-7.png", "hero-8.png"
];
const AUDIO_PATH = "audio/";

// Safe Audio Loader
const SFX = {};
try {
  SFX.hero_theme = new Audio(AUDIO_PATH + "hero_theme.mp3");
  SFX.ding = new Audio(AUDIO_PATH + "ding.mp3");
  SFX.success = new Audio(AUDIO_PATH + "success.mp3");
  SFX.click = new Audio(AUDIO_PATH + "click.mp3");
} catch (e) {
  console.error("Audio files missing or path wrong", e);
}

function playSound(key) {
  try {
    const sound = SFX[key];
    if (sound) { sound.currentTime = 0; sound.play().catch(e => console.log("Audio play blocked", e)); }
  } catch(e) { console.log("Audio error", e); }
}

// --- UTILS ---
function slugify(name) { return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, ""); }
function fmtTime(ts) { if(!ts) return ""; return new Date(ts).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
function fmtDateDayMonthYear(ts) { if(!ts) return "-"; return new Date(ts).toLocaleDateString("en-GB", {day:"2-digit", month:"2-digit", year:"2-digit"}); }

let currentStudent = null;

// --- GLOBAL HELPERS ---
window.openMission = function(url) {
  document.getElementById("mission-frame").src = url;
  document.getElementById("mission-overlay").classList.remove("hidden");
};
window.closeMission = function() {
  document.getElementById("mission-overlay").classList.add("hidden");
  document.getElementById("mission-frame").src = "";
};

// --- LOGIN LOGIC (DEBUG) ---
async function loginStudent(name, password) {
  const id = slugify(name);
  console.log("Attempting login for ID:", id); // Look in Console
  
  const snap = await getDoc(doc(db, "students", id));
  
  if (!snap.exists()) {
    alert(`DEBUG ERROR: Student ID '${id}' not found in database.\n\nDid you create the student in the Teacher Dashboard?`);
    throw new Error("Account not found.");
  }
  
  const data = snap.data();
  if (data.password !== password) {
    alert("DEBUG ERROR: Incorrect Password.");
    throw new Error("Incorrect password.");
  }
  
  return { id, ...data };
}

function switchToHub(student) {
  currentStudent = student;
  localStorage.setItem("edvengerStudentName", student.name);

  document.getElementById("student-login-section").style.display = "none";
  document.getElementById("student-password-section").style.display = "none";
  document.getElementById("student-hub-section").style.display = "block";

  document.getElementById("student-name-display").textContent = student.name;
  document.getElementById("profile-name").textContent = student.name;
  
  if (student.avatar) {
    const av = document.getElementById("my-avatar");
    if(av) av.src = AVATAR_PATH + student.avatar;
  }

  // Real-time Profile Listener
  onSnapshot(doc(db, "students", student.id), (snap) => {
    const data = snap.data();
    if (!data) return;
    document.getElementById("hero-stars-count").textContent = data.stars || 0;
    document.getElementById("profile-level").textContent = data.level || "-";
    document.getElementById("profile-subjects").textContent = (data.subjects || []).join(", ");
  });

  initAnnouncementsAndHomework(student);
  initChat(student);
  initAttendance(); 
  initSelfTraining(student); 
  initWritingGym(student); 
}

// --- ATTENDANCE ---
function initAttendance() {
  const attBtn = document.getElementById("btn-attendance");
  if (attBtn) {
    attBtn.addEventListener("click", async () => {
      if (!currentStudent) return;
      if(typeof confetti === 'function') confetti({ particleCount: 150, spread: 100 });
      playSound("hero_theme"); 
      
      const hero = document.getElementById("flying-hero");
      hero.classList.remove("hidden");
      hero.classList.add("fly-across");
      setTimeout(() => { hero.classList.remove("fly-across"); hero.classList.add("hidden"); }, 2600);
  
      attBtn.disabled = true;
      attBtn.textContent = "Marked Present! ✅";
      
      await addDoc(collection(db, "chats", currentStudent.id, "messages"), {
        sender: "student", text: "🔴 SYSTEM: Checked In", createdAt: Date.now(), isSystem: true
      });
      await setDoc(doc(db, "students", currentStudent.id), { hasUnread: true }, { merge: true });
      setTimeout(() => { attBtn.disabled = false; attBtn.textContent = "🙋‍♂️ I'm Here!"; }, 3600000);
    });
  }
}

// --- WRITING GYM ---
let currentActiveDrill = null;
let currentSubmission = null;
let currentPowerWords = [];
let powerWordsFound = new Set();

async function initWritingGym(student) {
  const container = document.getElementById("gym-active-mission-container");
  if (!container) return;

  // 1. Find Active Drill for Level
  const q = query(collection(db, "writing_drills"), orderBy("createdAt", "desc"));
  
  onSnapshot(q, (snap) => {
    container.innerHTML = "";
    let activeDrill = null;
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.level === student.level && !activeDrill) activeDrill = { id: docSnap.id, ...d };
    });

    if (!activeDrill) {
      container.innerHTML = '<p class="helper-text">No active missions for your level.</p>';
      return;
    }

    // 2. CHECK FOR EXISTING SUBMISSION
    const subQ = query(collection(db, "writing_submissions"), 
      where("studentId", "==", student.id),
      where("drillId", "==", activeDrill.id)
    );

    onSnapshot(subQ, (subSnap) => {
      container.innerHTML = ""; 
      let existingSub = null;
      if (!subSnap.empty) existingSub = { id: subSnap.docs[0].id, ...subSnap.docs[0].data() };

      const btn = document.createElement("button");
      btn.style.width = "100%";
      btn.style.padding = "1.2rem";

      if (!existingSub) {
        // NEW MISSION
        btn.className = "btn btn-primary";
        btn.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
             <span style="font-size:1.2rem; font-weight:900; letter-spacing:1px; text-transform:uppercase;">ENTER SIMULATION</span>
             <span style="font-size:0.9rem; opacity:0.9; font-weight:400; background:rgba(0,0,0,0.2); padding:2px 8px; border-radius:4px;">Mission: ${activeDrill.title}</span>
          </div>`;
        btn.onclick = () => openFocusMode(activeDrill, null); 

      } else if (existingSub.status === "pending") {
        // PENDING REVIEW
        btn.className = "btn btn-ghost";
        btn.disabled = true;
        btn.style.opacity = "0.7";
        btn.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
             <span style="font-size:1.1rem; font-weight:700;">⏳ AWAITING INTEL</span>
             <span style="font-size:0.8rem;">Mission Under Review</span>
          </div>`;

      } else if (existingSub.status === "graded") {
        // FEEDBACK READY
        btn.className = "btn btn-secondary"; 
        btn.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.3rem;">
             <span style="font-size:1.2rem; font-weight:900; letter-spacing:1px;">📬 MISSION DEBRIEF</span>
             <span style="font-size:0.9rem; font-weight:400;">Feedback Received! Tap to View.</span>
          </div>`;
        btn.onclick = () => openFocusMode(activeDrill, existingSub); 
      }

      container.appendChild(btn);
    });
  });
}

function openFocusMode(drill, submission) {
  currentActiveDrill = drill;
  currentSubmission = submission;
  currentPowerWords = drill.powerWords || [];
  powerWordsFound.clear();

  const overlay = document.getElementById("gym-overlay");
  const titleEl = document.getElementById("gym-mission-title");
  const instrEl = document.getElementById("gym-instructions");
  const imgEl = document.getElementById("gym-stimulus-image");
  const editor = document.getElementById("gym-editor");
  const belt = document.getElementById("gym-gadget-belt");
  const wordCountEl = document.getElementById("gym-word-count");
  const submitBtn = document.getElementById("gym-submit-btn");
  const feedbackBox = document.getElementById("gym-feedback-box");
  const feedbackText = document.getElementById("gym-feedback-text");

  // RESET UI
  overlay.classList.remove("hidden");
  titleEl.textContent = drill.title;
  instrEl.textContent = drill.instructions;
  wordCountEl.textContent = "Words: 0";
  belt.innerHTML = "";

  if (drill.imageUrl) {
    imgEl.src = drill.imageUrl;
    imgEl.classList.remove("hidden");
  } else { imgEl.classList.add("hidden"); }

  // RENDER POWER WORDS
  currentPowerWords.forEach(word => {
    const tag = document.createElement("span");
    tag.className = "gym-power-word";
    tag.textContent = word;
    tag.dataset.word = word.toLowerCase();
    belt.appendChild(tag);
  });

  // STATE: FRESH vs REVISION
  if (submission && submission.status === "graded") {
    editor.value = submission.text;
    feedbackBox.classList.remove("hidden");
    feedbackText.textContent = submission.feedback || "Good effort. See comments.";
    submitBtn.textContent = "Submit Revision (V2)";
    playSound("click");
  } else {
    editor.value = ""; 
    feedbackBox.classList.add("hidden");
    submitBtn.textContent = "Submit Mission";
  }

  // GAMIFICATION
  editor.oninput = () => {
    const text = editor.value;
    wordCountEl.textContent = `Words: ${text.trim().split(/\s+/).filter(w=>w.length>0).length}`;
    
    currentPowerWords.forEach(target => {
      const lowerText = text.toLowerCase();
      const lowerTarget = target.toLowerCase();
      if (lowerText.includes(lowerTarget) && !powerWordsFound.has(lowerTarget)) {
        powerWordsFound.add(lowerTarget);
        const tag = belt.querySelector(`span[data-word="${lowerTarget}"]`);
        if (tag) tag.classList.add("activated");
        playSound("ding");
        awardInstantXP(5);
      }
    });
  };

  document.getElementById("gym-exit-btn").onclick = () => overlay.classList.add("hidden");
  submitBtn.onclick = () => submitDrill();
}

async function awardInstantXP(amount) {
  if (!currentStudent) return;
  await updateDoc(doc(db, "students", currentStudent.id), { stars: increment(amount) });
  
  const popup = document.createElement("div");
  popup.textContent = `+${amount} Hero Points`;
  popup.style.cssText = "position:fixed; top:15%; left:50%; transform:translateX(-50%); background:#1fe6a8; color:#000; font-weight:bold; padding:0.5rem 1rem; border-radius:20px; z-index:10001; animation:floatUp 1s forwards;";
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);
}

async function submitDrill() {
  const editor = document.getElementById("gym-editor");
  const text = editor.value.trim();
  if (!text) return alert("Mission log is empty!");

  const checklist = confirm("SYSTEM DIAGNOSTIC:\n\n[ ] Checked Spelling?\n[ ] Checked Punctuation?\n[ ] Used Power Words?\n\nReady to Launch?");
  if (!checklist) return;

  const overlay = document.getElementById("gym-overlay");
  
  try {
    let subRef;
    if (currentSubmission) {
      subRef = doc(db, "writing_submissions", currentSubmission.id);
      await setDoc(subRef, {
        text: text,
        powerWordsUsed: Array.from(powerWordsFound),
        createdAt: Date.now(),
        status: "pending" 
      }, { merge: true });
    } else {
      await addDoc(collection(db, "writing_submissions"), {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        drillId: currentActiveDrill.id,
        drillTitle: currentActiveDrill.title,
        text: text,
        powerWordsUsed: Array.from(powerWordsFound),
        createdAt: Date.now(),
        status: "pending"
      });
    }

    playSound("success");
    awardInstantXP(20);
    if(typeof confetti === 'function') confetti({ particleCount: 200, spread: 120 });
    
    alert("Mission Accomplished! +20 Hero Points earned.");
    overlay.classList.add("hidden");

  } catch (err) {
    console.error(err);
    alert("Transmission Failed. Check connection.");
  }
}

// --- STANDARD LOGIC ---
function initAnnouncementsAndHomework(student) {
  const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  onSnapshot(annQuery, (snap) => {
    if (!annContainer) return;
    const list = [];
    snap.forEach((docSnap) => {
        const d = docSnap.data();
        if ((!d.levels || d.levels.includes(student.level))) list.push({id:docSnap.id, ...d});
    });
    allAnnouncementsForStudent = list;
    renderStudentAnnouncements();
  });
  const hwQuery = query(collection(db, "homework"), orderBy("postedAt", "desc"));
  onSnapshot(hwQuery, (snap) => {
    if (!hwContainer) return;
    const list = [];
    snap.forEach((docSnap) => {
        const d = docSnap.data();
        if ((!d.levels || d.levels.includes(student.level))) list.push({id:docSnap.id, ...d});
    });
    allHomeworkForStudent = list;
    renderStudentHomework();
  });
}
function renderStudentAnnouncements() {
    if(!annContainer) return; annContainer.innerHTML=""; 
    const items = allAnnouncementsForStudent.slice(0, annVisibleCount);
    items.forEach(d => {
        const pin = d.isPinned ? "📌 " : "";
        const card = document.createElement("div"); card.className = "ev-card-bubble" + (d.isPinned?" pinned-item":"");
        card.innerHTML = `<h4>${pin}${d.title}</h4><p>${d.message}</p><p class="helper-text">${fmtDateDayMonthYear(d.createdAt)}</p>`;
        annContainer.appendChild(card);
    });
    if(allAnnouncementsForStudent.length > annVisibleCount) { annToggleBtn.style.display="inline-block"; }
}
function renderStudentHomework() {
    if(!hwContainer) return; hwContainer.innerHTML="";
    const items = allHomeworkForStudent.slice(0, hwVisibleCount);
    items.forEach(d => {
        const links = (d.links||[]).map(l => `<li><button class="btn-link" onclick="openMission('${l.url||l}')">🔗 ${l.name||"Link"}</button></li>`).join("");
        const card = document.createElement("div"); card.className = "ev-card-bubble";
        card.innerHTML = `<h4>${d.title}</h4><p>${d.description||""}</p><ul class="ev-link-list">${links}</ul><p class="helper-text">${fmtDateDayMonthYear(d.postedAt)}</p>`;
        hwContainer.appendChild(card);
    });
    if(allHomeworkForStudent.length > hwVisibleCount) { hwToggleBtn.style.display="inline-block"; }
}
if(annToggleBtn) annToggleBtn.onclick=()=>{annVisibleCount+=3;renderStudentAnnouncements();};
if(hwToggleBtn) hwToggleBtn.onclick=()=>{hwVisibleCount+=3;renderStudentHomework();};

function initChat(student) {
    const thread = document.getElementById("chat-window");
    const form = document.getElementById("chat-form");
    if(!thread || !form) return;
    const q = query(collection(db, "chats", student.id, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
        thread.innerHTML="";
        snap.forEach(doc => {
            const m = doc.data();
            const cls = m.sender==="student"?"chat-row-right":"chat-row-left";
            const bubble = m.sender==="student"?"chat-bubble-me":"chat-bubble-other";
            const row = document.createElement("div"); row.className = `chat-row ${cls}`;
            row.innerHTML = `<div class="chat-bubble ${bubble}">${m.text||""}${m.imageUrl?`<img src="${m.imageUrl}">`:""}<div class="chat-time">${fmtTime(m.createdAt)}</div></div>`;
            thread.appendChild(row);
        });
        thread.scrollTop = thread.scrollHeight;
    });
    form.onsubmit = async (e) => {
        e.preventDefault();
        const txt = document.getElementById("chat-input").value.trim();
        if(txt) {
            await addDoc(collection(db, "chats", student.id, "messages"), {sender:"student", text:txt, createdAt:Date.now()});
            document.getElementById("chat-input").value = "";
            await setDoc(doc(db, "students", student.id), {hasUnread:true}, {merge:true});
        }
    };
}

function initSelfTraining(student) {
    const container = document.getElementById("training-buttons-container");
    if(!container) return;
    getDoc(doc(db, "settings", "training_links")).then(snap => {
        if(!snap.exists()) { container.innerHTML="<p class='helper-text'>No training configured.</p>"; return; }
        const links = snap.data();
        container.innerHTML = "";
        let cfg = [];
        if(student.level==="P5") cfg = [{l:"P5 English Training", u:links.p5_eng, s:"P5 English"}, {l:"P5 Math Training", u:links.p5_math, s:"P5 Math"}];
        else if(student.level==="P6") cfg = [{l:"P6 English Training", u:links.p6_eng, s:"P6 English"}, {l:"P6 Math Training", u:links.p6_math, s:"P6 Math"}];
        
        cfg.forEach(c => {
            if(!c.u) return;
            const btn = document.createElement("button");
            if((student.subjects||[]).includes(c.s)) {
                btn.className="btn btn-primary"; btn.style.width="100%"; btn.innerHTML=`⚔️ ${c.l}`;
                btn.onclick = () => { playSound("click"); window.open(c.u, '_blank'); };
            } else {
                btn.className="btn"; btn.style.width="100%"; btn.style.background="#1e293b"; btn.style.color="#94a3b8";
                btn.innerHTML=`🔒 ${c.l}`; btn.onclick=()=>alert(`Subscribe to ${c.s} to unlock.`);
            }
            container.appendChild(btn);
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("student-login-form");
    if(loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                const u = await loginStudent(document.getElementById("login-name").value, document.getElementById("login-password").value);
                switchToHub(u);
            } catch(err) { 
                console.error(err); 
                // Alert already handled in loginStudent for specific errors
            }
        });
    }
});