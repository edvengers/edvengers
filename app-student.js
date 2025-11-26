// app-student.js (MASTER VERSION)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
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

// --- AVATAR CONFIG ---
const AVATAR_PATH = "images/avatars/";
// --- AUDIO SYSTEM ---
const AUDIO_PATH = "audio/";
const SFX = {
  powerup: new Audio(AUDIO_PATH + "powerup.mp3"),
  click: new Audio(AUDIO_PATH + "click.mp3")
};

// Helper to play sound safely
function playSound(key) {
  const sound = SFX[key];
  if (sound) {
    sound.currentTime = 0; // Reset so it can play rapidly
    sound.play().catch(err => console.log("Browser blocked audio:", err));
  }
}
const AVAILABLE_AVATARS = [
  "hero-1.jpg", "hero-2.jpg", "hero-3.jpg", "hero-4.jpg", 
  "hero-5.jpg", "hero-6.jpg", "hero-7.jpg", "hero-8.jpg"
];

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDateLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thatDay = new Date(d);
  thatDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((thatDay - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
// DATE FORMATTER FIX
function fmtDateDayMonthYear(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

let currentStudent = null;
let chatUnsub = null;

const annContainer = document.getElementById("student-announcements");
const annToggleBtn = document.getElementById("student-ann-toggle");
const annCountLabel = document.getElementById("student-ann-count");
const hwContainer = document.getElementById("student-homework-list");
const hwToggleBtn = document.getElementById("student-hw-toggle");
const hwCountLabel = document.getElementById("student-hw-count");

let allAnnouncementsForStudent = [];
let allHomeworkForStudent = [];
let annVisibleCount = 3; 
let hwVisibleCount = 3;

window.openMission = function(url) {
  const overlay = document.getElementById("mission-overlay");
  const frame = document.getElementById("mission-frame");
  if (overlay && frame) {
    frame.src = url;
    overlay.classList.remove("hidden");
  }
};

window.closeMission = function() {
  const overlay = document.getElementById("mission-overlay");
  const frame = document.getElementById("mission-frame");
  if (overlay && frame) {
    overlay.classList.add("hidden");
    frame.src = ""; 
    if(typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }
};

async function loginStudent(name, password) {
  const trimmedName = name.trim();
  const trimmedPwd = password.trim();
  if (!trimmedName || !trimmedPwd) throw new Error("Missing fields.");

  const id = slugify(trimmedName);
  const ref = doc(db, "students", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Account not found. Please ask Teacher Andy to create your account first.");
  }

  const data = snap.data();
  if (!data.password || data.password !== trimmedPwd) {
    throw new Error("Incorrect password.");
  }

  return { id, ...data };
}

function switchToHub(student) {
  currentStudent = student;
  localStorage.setItem("edvengerStudentName", student.name);

  const loginSection = document.getElementById("student-login-section");
  const pwdSection = document.getElementById("student-password-section");
  const hubSection = document.getElementById("student-hub-section");

  if (loginSection) loginSection.style.display = "none";
  if (pwdSection) pwdSection.style.display = "none";
  if (hubSection) hubSection.style.display = "block";

  const displayName = document.getElementById("student-name-display");
  const profileName = document.getElementById("profile-name");
  const profileLevel = document.getElementById("profile-level");
  const profileSubjects = document.getElementById("profile-subjects");
  const starsEl = document.getElementById("hero-stars-count");

  if (displayName) displayName.textContent = student.name;
  if (profileName) profileName.textContent = student.name;
  if (profileLevel) profileLevel.textContent = student.level || "-";
  if (profileSubjects) profileSubjects.textContent = (student.subjects && student.subjects.join(", ")) || "-";
  if (starsEl) starsEl.textContent = student.stars || 0;

  // LOAD AVATAR IF EXISTS
  if (student.avatar) {
    const avatarEl = document.getElementById("my-avatar");
    if(avatarEl) avatarEl.src = AVATAR_PATH + student.avatar;
  }

  const ref = doc(db, "students", student.id);
  onSnapshot(ref, (snap) => {
    const data = snap.data();
    if (!data) return;
    if (starsEl) starsEl.textContent = data.stars || 0;
    if (profileLevel) profileLevel.textContent = data.level || "-";
    if (profileSubjects) profileSubjects.textContent = (data.subjects && data.subjects.join(", ")) || "-";
  });

  initAnnouncementsAndHomework(student);
  initChat(student);
  initAttendance(); 
  initSelfTraining(student); // Self Training
}

function initAttendance() {
    const attBtn = document.getElementById("btn-attendance");
    if (attBtn) {
      attBtn.addEventListener("click", async () => {
        if (!currentStudent) return;
        
        if(typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 100 });
        }
        
        const hero = document.getElementById("flying-hero");
        if (hero) {
          hero.classList.remove("hidden");
          hero.classList.add("fly-across");
          setTimeout(() => {
            hero.classList.remove("fly-across");
            hero.classList.add("hidden");
          }, 2600);
        }
    
        attBtn.disabled = true;
        attBtn.textContent = "Marked Present! ✅";
// PLAY SUPERHERO SOUND
        playSound("powerup");
        
        const msgsRef = collection(db, "chats", currentStudent.id, "messages");
        await addDoc(msgsRef, {
          sender: "student",
          text: "🔴 SYSTEM: Student Checked In for Class",
          createdAt: Date.now(),
          isSystem: true
        });
        
        const studentRef = doc(db, "students", currentStudent.id);
        await setDoc(studentRef, { hasUnread: true }, { merge: true });
        
        setTimeout(() => {
            attBtn.disabled = false;
            attBtn.textContent = "🙋‍♂️ I'm Here!";
        }, 3600000);
      });
    }
}

function initAnnouncementsAndHomework(student) {
  const level = student.level;
  const subjects = student.subjects || [];

  const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  onSnapshot(annQuery, (snap) => {
    if (!annContainer) return;
    const list = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const levels = d.levels || [];
      const subs = d.subjects || [];
      const levelMatch = levels.length === 0 || (level && levels.includes(level));
      const subjectMatch = subs.length === 0 || (subjects.length > 0 && subjects.some((s) => subs.includes(s)));
      if (levelMatch && subjectMatch) list.push({ id: docSnap.id, ...d });
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
      const levels = d.levels || [];
      const subs = d.subjects || [];
      const levelMatch = levels.length === 0 || (level && levels.includes(level));
      const subjectMatch = subs.length === 0 || (subjects.length > 0 && subjects.some((s) => subs.includes(s)));
      if (levelMatch && subjectMatch) list.push({ id: docSnap.id, ...d });
    });
    allHomeworkForStudent = list;
    renderStudentHomework();
  });
}

function renderStudentAnnouncements() {
  if (!annContainer) return;
  annContainer.innerHTML = "";

  allAnnouncementsForStudent.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt - a.createdAt;
  });

  const total = allAnnouncementsForStudent.length;
  if (!total) {
    annContainer.innerHTML = '<p class="helper-text">No announcements yet.</p>';
    if (annToggleBtn) annToggleBtn.style.display = "none";
    if (annCountLabel) annCountLabel.textContent = "";
    return;
  }

  const itemsToShow = allAnnouncementsForStudent.slice(0, annVisibleCount);

  itemsToShow.forEach((d) => {
    const pinIcon = d.isPinned ? "📌 " : "";
    const pinClass = d.isPinned ? "pinned-item" : "";
    const dateStr = fmtDateDayMonthYear(d.createdAt); // Date Fix
    
    const card = document.createElement("div");
    card.className = `ev-card-bubble ${pinClass}`;
    card.innerHTML = `
      <h4>${pinIcon}${d.title || "Untitled"}</h4>
      <p>${d.message || ""}</p>
      <p class="helper-text">Posted: ${dateStr}</p>
    `;
    annContainer.appendChild(card);
  });

  if (annToggleBtn) {
    if (total > annVisibleCount) {
      annToggleBtn.style.display = "inline-block";
      annToggleBtn.textContent = `Show older (+3)`;
    } else {
      annToggleBtn.style.display = "none";
    }
  }
  if (annCountLabel) {
    annCountLabel.textContent = `Showing ${itemsToShow.length} of ${total}`;
  }
}

function renderStudentHomework() {
  if (!hwContainer) return;
  hwContainer.innerHTML = "";
  const total = allHomeworkForStudent.length;
  if (!total) {
    hwContainer.innerHTML = '<p class="helper-text">No homework assigned yet.</p>';
    if (hwToggleBtn) hwToggleBtn.style.display = "none";
    if (hwCountLabel) hwCountLabel.textContent = "";
    return;
  }

  const itemsToShow = allHomeworkForStudent.slice(0, hwVisibleCount);

  itemsToShow.forEach((d) => {
    const linksHtml = (d.links || []).map((item) => {
        const url = item.url || item; 
        const name = item.name || "Resource";
        return `<li><button class="btn-link" style="background:var(--ev-accent); border:none; border-radius:99px; padding:0.35rem 0.8rem; font-weight:700; cursor:pointer;" onclick="openMission('${url}')">🔗 ${name}</button></li>`;
    }).join("");

    const dateStr = fmtDateDayMonthYear(d.postedAt); // Date Fix

    const card = document.createElement("div");
    card.className = "ev-card-bubble";
    card.innerHTML = `
      <h4>${d.title || "Untitled"}</h4>
      ${d.description ? `<p>${d.description}</p>` : ""}
      ${linksHtml ? `<ul class="ev-link-list">${linksHtml}</ul>` : '<p class="helper-text">No links.</p>'}
      <p class="helper-text">Posted: ${dateStr}</p>
    `;
    hwContainer.appendChild(card);
  });

  if (hwToggleBtn) {
    if (total > hwVisibleCount) {
      hwToggleBtn.style.display = "inline-block";
      hwToggleBtn.textContent = `Show older (+3)`;
    } else {
      hwToggleBtn.style.display = "none";
    }
  }
  if (hwCountLabel) {
    hwCountLabel.textContent = `Showing ${itemsToShow.length} of ${total}`;
  }
}

if (annToggleBtn) annToggleBtn.addEventListener("click", () => {
    annVisibleCount += 3;
    renderStudentAnnouncements();
});
if (hwToggleBtn) hwToggleBtn.addEventListener("click", () => {
    hwVisibleCount += 3;
    renderStudentHomework();
});

function initChat(student) {
  const threadEl = document.getElementById("chat-window");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const imageInput = document.getElementById("chat-image");
  const statusEl = document.getElementById("chat-status");

  if (!threadEl || !form || !input) return;

  const msgsRef = collection(db, "chats", student.id, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"));

  if (chatUnsub) chatUnsub();
  chatUnsub = onSnapshot(q, (snap) => {
    threadEl.innerHTML = "";
    let lastDateKey = "";
    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const created = m.createdAt || Date.now();
      const dateObj = new Date(created);
      const dateKey = dateObj.toDateString();

      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const divider = document.createElement("div");
        divider.className = "chat-date-divider";
        divider.textContent = fmtDateLabel(created);
        threadEl.appendChild(divider);
      }

      const isStudentMsg = m.sender === "student";
      const row = document.createElement("div");
      row.className = "chat-row " + (isStudentMsg ? "chat-row-right" : "chat-row-left");
      let inner = `
        <div class="chat-bubble ${isStudentMsg ? "chat-bubble-me" : "chat-bubble-other"}">
          ${m.text ? `<div class="chat-text">${m.text}</div>` : ""}
      `;
      if (m.imageUrl) {
        inner += `<div class="chat-image"><img src="${m.imageUrl}" alt="attachment" /></div>`;
      }
      inner += `<div class="chat-time">${fmtTime(created)}</div></div>`;
      row.innerHTML = inner;
      threadEl.appendChild(row);
    });
    threadEl.scrollTop = threadEl.scrollHeight;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    const file = imageInput.files[0] || null;
    if (!text && !file) return;

    try {
      if (statusEl) statusEl.textContent = "Sending...";
      let imageUrl = null;
      if (file) {
        const path = `chat-images/${student.id}/${Date.now()}_${file.name}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file);
        imageUrl = await getDownloadURL(ref);
      }
      
      await addDoc(msgsRef, {
        sender: "student",
        text,
        imageUrl,
        createdAt: Date.now(),
      });

      const studentRef = doc(db, "students", student.id);
      await setDoc(studentRef, { hasUnread: true }, { merge: true });

      input.value = "";
      imageInput.value = "";
      if (statusEl) {
        statusEl.textContent = "Sent!";
        setTimeout(() => (statusEl.textContent = ""), 1500);
      }
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = "Failed to send.";
    }
  });
}

// --- SELF TRAINING LOGIC (NEW TAB FIX) ---
async function initSelfTraining(student) {
  const container = document.getElementById("training-buttons-container");
  if (!container) return;

  // 1. Fetch links
  const docRef = doc(db, "settings", "training_links");
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) {
    container.innerHTML = '<p class="helper-text">No training configured yet.</p>';
    return;
  }
  
  const links = snap.data();
  const level = student.level || ""; 
  const subjects = student.subjects || []; 

  container.innerHTML = ""; 

  let buttonsConfig = [];
  if (level === "P5") {
    buttonsConfig = [
      { label: "P5 English Training", url: links.p5_eng, subjectReq: "P5 English" },
      { label: "P5 Math Training", url: links.p5_math, subjectReq: "P5 Math" }
    ];
  } else if (level === "P6") {
    buttonsConfig = [
      { label: "P6 English Training", url: links.p6_eng, subjectReq: "P6 English" },
      { label: "P6 Math Training", url: links.p6_math, subjectReq: "P6 Math" }
    ];
  } else {
    container.innerHTML = '<p class="helper-text">Training modules coming soon for your level!</p>';
    return;
  }

  let hasButtons = false;
  buttonsConfig.forEach(cfg => {
    if (!cfg.url) return;
    hasButtons = true;
    const isUnlocked = subjects.includes(cfg.subjectReq);
    const btn = document.createElement("button");
    
    if (isUnlocked) {
      btn.className = "btn btn-primary";
      btn.style.width = "100%";
      btn.textContent = "⚔️ " + cfg.label;
      btn.onclick = () => {
         if(typeof confetti === 'function') confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
playSound("click");
         window.open(cfg.url, '_blank');
      };
    } else {
      btn.className = "btn";
      btn.style.width = "100%";
      btn.style.background = "#1e293b"; 
      btn.style.color = "#94a3b8"; 
      btn.style.cursor = "not-allowed";
      btn.style.border = "1px solid #334155";
      btn.innerHTML = "🔒 " + cfg.label;
      btn.onclick = () => alert(`Please subscribe to ${cfg.subjectReq} to access this training!`);
    }
    container.appendChild(btn);
  });

  if (!hasButtons) container.innerHTML = '<p class="helper-text">No training links active currently.</p>';
}

// --- MAIN EVENT LISTENER (LOGIN + AVATAR) ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Login Logic
  const loginForm = document.getElementById("student-login-form");
  const loginError = document.getElementById("login-error");

  const showError = (msg) => {
    if (loginError) {
      loginError.textContent = msg;
      loginError.style.display = "block";
    } else {
      alert(msg);
    }
  };

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = "none";
      const name = document.getElementById("login-name").value;
      const pwd = document.getElementById("login-password").value;

      try {
        const student = await loginStudent(name, pwd);
        if (student.password === "heroes2026") {
          document.getElementById("student-login-section").style.display = "none";
          document.getElementById("student-password-section").style.display = "block";
          
          const pwdForm = document.getElementById("change-password-form");
          pwdForm.onsubmit = async (evt) => {
            evt.preventDefault();
            const newPwd = document.getElementById("new-password").value.trim();
            if(!newPwd) return;
            const ref = doc(db, "students", student.id);
            await setDoc(ref, { password: newPwd, updatedAt: Date.now() }, { merge: true });
            student.password = newPwd;
            document.getElementById("student-password-section").style.display = "none";
            switchToHub(student);
          };
        } else {
          switchToHub(student);
        }
      } catch (err) {
        console.error(err);
        showError(err.message || "Login failed. Please try again.");
      }
    });
  }

  // 2. Avatar Logic
  const avatarBtn = document.getElementById("btn-change-avatar");
  const avatarOverlay = document.getElementById("avatar-overlay");
  const closeAvatarBtn = document.getElementById("close-avatar-btn");
  const avatarGrid = document.getElementById("avatar-grid");
  const myAvatarImg = document.getElementById("my-avatar");

  if (avatarBtn && avatarOverlay) {
    avatarBtn.addEventListener("click", () => {
      renderAvatarGrid();
      avatarOverlay.classList.remove("hidden");
    });
    closeAvatarBtn.addEventListener("click", () => {
      avatarOverlay.classList.add("hidden");
    });
  }

  function renderAvatarGrid() {
    avatarGrid.innerHTML = "";
    AVAILABLE_AVATARS.forEach(filename => {
      const img = document.createElement("img");
      img.src = AVATAR_PATH + filename;
      img.className = "avatar-option";
      img.onclick = () => selectAvatar(filename);
      avatarGrid.appendChild(img);
    });
  }

  async function selectAvatar(filename) {
    if (!currentStudent) return;
    if (myAvatarImg) myAvatarImg.src = AVATAR_PATH + filename;
    if (avatarOverlay) avatarOverlay.classList.add("hidden");

    try {
      const ref = doc(db, "students", currentStudent.id);
      await setDoc(ref, { avatar: filename }, { merge: true });
      if(typeof confetti === 'function') confetti({ particleCount: 50, spread: 60, origin: { y: 0.4 } });
playSound("click");
    } catch (err) {
      console.error("Error saving avatar:", err);
    }
  }
});