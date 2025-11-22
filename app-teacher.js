// app-teacher.js
// Teacher login + students/points + announcements/homework + chat with photo

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  setDoc,
  increment,
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

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------
// SIMPLE TEACHER LOGIN
// ---------------------------------------------------------------------

const TEACHER_PASSWORD = "1234"; // change if you like

const loginSection = document.getElementById("teacher-login-section");
const dashSection = document.getElementById("teacher-dashboard-section");
const loginForm = document.getElementById("teacher-login-form");
const loginErr = document.getElementById("teacher-login-error");
const logoutBtn = document.getElementById("teacher-logout-btn");

function showDashboard() {
  if (loginSection) loginSection.style.display = "none";
  if (dashSection) dashSection.style.display = "block";
}
function showLogin() {
  if (dashSection) dashSection.style.display = "none";
  if (loginSection) loginSection.style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("edvengerTeacherLoggedIn");
  if (saved === "yes") showDashboard();

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (loginErr) loginErr.style.display = "none";
      const pwd = document.getElementById("teacher-password").value.trim();
      if (pwd === TEACHER_PASSWORD) {
        localStorage.setItem("edvengerTeacherLoggedIn", "yes");
        showDashboard();
      } else {
        if (loginErr) {
          loginErr.textContent = "Wrong password.";
          loginErr.style.display = "block";
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("edvengerTeacherLoggedIn");
      showLogin();
    });
  }
});

// ---------------------------------------------------------------------
// STUDENTS & HERO POINTS (CLEAN VERSION)
// ---------------------------------------------------------------------

const studentsForm = document.getElementById("students-form");
const studentsList = document.getElementById("students-list"); // shows 1 selected student
const studentsSelect = document.getElementById("student-select");

const filterLevelInput = document.getElementById("filter-level");
const filterSubjectInput = document.getElementById("filter-subject");
const filterApplyBtn = document.getElementById("filter-apply");
const filterClearBtn = document.getElementById("filter-clear");

let studentsCache = [];      // all students from Firestore
let currentStudentId = null; // selected student's doc id

function getCurrentStudent() {
  if (!currentStudentId) return null;
  return studentsCache.find((s) => s.id === currentStudentId) || null;
}

// Populate dropdown based on filters
function populateStudentSelect() {
  if (!studentsSelect) return;

  const levelFilter = (filterLevelInput?.value || "").trim();
  const subjectFilter = (filterSubjectInput?.value || "")
    .trim()
    .toLowerCase();

  studentsSelect.innerHTML = '<option value="">-- Select student --</option>';

  studentsCache.forEach((s) => {
    // level filter
    if (levelFilter && (s.level || "") !== levelFilter) return;

    // subject filter
    if (subjectFilter) {
      const subs = (s.subjects || []).map((x) => x.toLowerCase());
      if (!subs.includes(subjectFilter)) return;
    }

    const opt = document.createElement("option");
    opt.value = s.id; // use doc id
    opt.textContent = s.name;
    studentsSelect.appendChild(opt);
  });
}

// Render one selected student row with buttons
function renderSelectedStudent() {
  if (!studentsList) return;

  const s = getCurrentStudent();
  if (!s) {
    studentsList.innerHTML =
      '<p class="helper-text">Filter by level and subject, then select a student above to manage Hero Points.</p>';
    return;
  }

  const subjectsText = (s.subjects || []).join(", ");
  const stars = typeof s.stars === "number" ? s.stars : 0;

  studentsList.innerHTML = `
    <div class="student-row ev-card-bubble">
      <div class="student-main">
        <div><strong>${s.name}</strong></div>
        <div class="helper-text">
          Level: ${s.level || "-"}${
    subjectsText ? " • Subjects: " + subjectsText : ""
  } • Hero Points: <strong id="hero-points-value">${stars}</strong>
        </div>
      </div>
      <div class="student-actions">
        <button id="hero-add1" class="btn btn-small">+1</button>
        <button id="hero-add5" class="btn btn-small">+5</button>
        <button id="hero-reset-points" class="btn btn-ghost btn-small">
          Reset Points
        </button>
        <button id="hero-reset-password" class="btn btn-ghost btn-small">
          Reset Password
        </button>
      </div>
    </div>
  `;

  const add1Btn = document.getElementById("hero-add1");
  const add5Btn = document.getElementById("hero-add5");
  const resetPointsBtn = document.getElementById("hero-reset-points");
  const resetPwdBtn = document.getElementById("hero-reset-password");

  if (add1Btn) add1Btn.addEventListener("click", () => updateHeroPoints("add1"));
  if (add5Btn) add5Btn.addEventListener("click", () => updateHeroPoints("add5"));
  if (resetPointsBtn)
    resetPointsBtn.addEventListener("click", () => updateHeroPoints("reset"));
  if (resetPwdBtn)
    resetPwdBtn.addEventListener("click", () => resetStudentPassword());
}

// Update stars in Firestore
async function updateHeroPoints(action) {
  const s = getCurrentStudent();
  if (!s) {
    alert("Select a student first.");
    return;
  }
  const ref = doc(db, "students", s.id);

  try {
    if (action === "add1") {
      await updateDoc(ref, { stars: increment(1), updatedAt: Date.now() });
    } else if (action === "add5") {
      await updateDoc(ref, { stars: increment(5), updatedAt: Date.now() });
    } else if (action === "reset") {
      await updateDoc(ref, { stars: 0, updatedAt: Date.now() });
    }
  } catch (err) {
    console.error("Failed to update Hero Points:", err);
    alert("Failed to update Hero Points.");
  }
}

// Reset password to default
async function resetStudentPassword() {
  const s = getCurrentStudent();
  if (!s) {
    alert("Select a student first.");
    return;
  }
  const ref = doc(db, "students", s.id);
  try {
    await updateDoc(ref, { password: "heroes2026", updatedAt: Date.now() });
    alert(`Password for ${s.name} reset to heroes2026.`);
  } catch (err) {
    console.error("Failed to reset password:", err);
    alert("Failed to reset password.");
  }
}

// Create / update student doc from form
if (studentsForm) {
  studentsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedId = studentsSelect ? studentsSelect.value.trim() : "";
    const nameInput = document.getElementById("student-name");
    let name = nameInput ? nameInput.value.trim() : "";

    let id = selectedId;
    if (!id) {
      if (!name) return;
      id = slugify(name);
    }

    const levelInput = document.getElementById("student-level");
    const subjectsInput = document.getElementById("student-subjects");
    const level = levelInput ? levelInput.value.trim() : "";
    const subjects = subjectsInput
      ? subjectsInput.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (!name) {
      const existing = studentsCache.find((s) => s.id === id);
      if (existing) name = existing.name;
    }

    try {
      await setDoc(
        doc(db, "students", id),
        {
          name,
          level,
          subjects,
          password: "heroes2026", // default / reset
          updatedAt: Date.now(),
          createdAt: Date.now(),
        },
        { merge: true }
      );
      alert(`Saved/updated ${name}. Default password (if new): heroes2026`);
      studentsForm.reset();
      if (studentsSelect) studentsSelect.value = "";
      currentStudentId = null;
      renderSelectedStudent();
    } catch (err) {
      console.error(err);
      alert("Failed to save student.");
    }
  });
}

// Filter buttons & select change
if (filterApplyBtn) {
  filterApplyBtn.addEventListener("click", () => {
    populateStudentSelect();
  });
}

if (filterClearBtn) {
  filterClearBtn.addEventListener("click", () => {
    if (filterLevelInput) filterLevelInput.value = "";
    if (filterSubjectInput) filterSubjectInput.value = "";
    populateStudentSelect();
    currentStudentId = null;
    if (studentsSelect) studentsSelect.value = "";
    renderSelectedStudent();
  });
}

if (studentsSelect) {
  studentsSelect.addEventListener("change", () => {
    currentStudentId = studentsSelect.value || null;

    const s = getCurrentStudent();
    if (s) {
      const nameInput = document.getElementById("student-name");
      const levelInput = document.getElementById("student-level");
      const subjectsInput = document.getElementById("student-subjects");
      if (nameInput) nameInput.value = s.name || "";
      if (levelInput) levelInput.value = s.level || "";
      if (subjectsInput)
        subjectsInput.value = (s.subjects || []).join(", ");
    }
    renderSelectedStudent();
  });
}

// Realtime students load
const studentsQuery = query(collection(db, "students"), orderBy("name", "asc"));
onSnapshot(studentsQuery, (snap) => {
  studentsCache = [];
  snap.forEach((docSnap) => {
    studentsCache.push({ id: docSnap.id, ...docSnap.data() });
  });

  populateStudentSelect();

  if (
    currentStudentId &&
    !studentsCache.find((s) => s.id === currentStudentId)
  ) {
    currentStudentId = null;
  }

  renderSelectedStudent();
});

// ---------------------------------------------------------------------
// ANNOUNCEMENTS
// ---------------------------------------------------------------------

const annForm = document.getElementById("announcement-form");
const annList = document.getElementById("announcement-list");

if (annForm) {
  annForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document
      .getElementById("announcement-title")
      .value.trim();
    const message = document
      .getElementById("announcement-message")
      .value.trim();
    const levelsRaw = document
      .getElementById("announcement-levels")
      .value.trim();
    const subjectsRaw = document
      .getElementById("announcement-subjects")
      .value.trim();

    if (!title || !message) return;

    const levels = levelsRaw ? levelsRaw.split(",").map((s) => s.trim()) : [];
    const subjects = subjectsRaw
      ? subjectsRaw.split(",").map((s) => s.trim())
      : [];

    try {
      await addDoc(collection(db, "announcements"), {
        title,
        message,
        levels,
        subjects,
        createdAt: Date.now(),
      });
      annForm.reset();
    } catch (err) {
      console.error(err);
      alert("Failed to post announcement.");
    }
  });
}

if (annList) {
  const qAnn = query(
    collection(db, "announcements"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(qAnn, (snap) => {
    annList.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const card = document.createElement("div");
      card.className = "ev-card-bubble";
      card.innerHTML = `
        <h4>${d.title || "Untitled"}</h4>
        <p>${d.message || ""}</p>
        <p class="helper-text">
          Levels: ${(d.levels || []).join(", ") || "All"}
          • Subjects: ${(d.subjects || []).join(", ") || "All"}
          • Posted: ${new Date(d.createdAt || Date.now()).toLocaleString()}
        </p>
      `;
      annList.appendChild(card);
    });
  });
}

// ---------------------------------------------------------------------
// HOMEWORK
// ---------------------------------------------------------------------

const hwForm = document.getElementById("homework-form");
const hwList = document.getElementById("homework-list");

if (hwForm) {
  hwForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("homework-title").value.trim();
    const description = document
      .getElementById("homework-description")
      .value.trim();

    const links = [];
    for (let i = 1; i <= 5; i++) {
      const input = document.getElementById(`homework-link-${i}`);
      if (input && input.value.trim()) {
        links.push(input.value.trim());
      }
    }

    const levelsRaw = document
      .getElementById("homework-levels")
      .value.trim();
    const subjectsRaw = document
      .getElementById("homework-subjects")
      .value.trim();
    const postedDate = document.getElementById("homework-posted").value;
    const dueDate = document.getElementById("homework-due").value;

    if (!title || links.length === 0) return;

    const levels = levelsRaw ? levelsRaw.split(",").map((s) => s.trim()) : [];
    const subjects = subjectsRaw
      ? subjectsRaw.split(",").map((s) => s.trim())
      : [];

    const postedAt = postedDate ? new Date(postedDate).getTime() : Date.now();
    const dueAt = dueDate ? new Date(dueDate).getTime() : null;

    try {
      await addDoc(collection(db, "homework"), {
        title,
        description,
        links,
        levels,
        subjects,
        postedAt,
        dueAt,
      });
      hwForm.reset();
    } catch (err) {
      console.error(err);
      alert("Failed to add homework.");
    }
  });
}

if (hwList) {
  const qHw = query(collection(db, "homework"), orderBy("postedAt", "desc"));
  onSnapshot(qHw, (snap) => {
    hwList.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const links = d.links || [];
      const linksHtml = links
        .map(
          (url, i) =>
            `<li><a href="${url}" target="_blank">Link ${i + 1}</a></li>`
        )
        .join("");

      const card = document.createElement("div");
      card.className = "ev-card-bubble";
      card.innerHTML = `
        <h4>${d.title || "Untitled"}</h4>
        ${d.description ? `<p>${d.description}</p>` : ""}
        ${
          linksHtml
            ? `<ul class="ev-link-list">${linksHtml}</ul>`
            : "<p>No links.</p>"
        }
        <p class="helper-text">
          Levels: ${(d.levels || []).join(", ") || "All"}
          • Subjects: ${(d.subjects || []).join(", ") || "All"}
          • Posted: ${
            d.postedAt ? new Date(d.postedAt).toLocaleDateString() : "-"
          }
          ${
            d.dueAt
              ? " • Due: " + new Date(d.dueAt).toLocaleDateString()
              : ""
          }
        </p>
      `;
      hwList.appendChild(card);
    });
  });
}

// ---------------------------------------------------------------------
// CHAT
// ---------------------------------------------------------------------

const chatStudentList = document.getElementById("chat-student-list");
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("teacher-chat-form");
const chatInput = document.getElementById("teacher-chat-input");
const chatImage = document.getElementById("teacher-chat-image");
const chatStatus = document.getElementById("teacher-chat-status");
const chatStudentIdHidden = document.getElementById("teacher-chat-student-id");

let chatStudentId = null;
let chatThreadUnsub = null;

// sidebar: list students
if (chatStudentList) {
  const qStudents = query(collection(db, "students"), orderBy("name", "asc"));
  onSnapshot(qStudents, (snap) => {
    const students = [];
    chatStudentList.innerHTML = "";

    snap.forEach((docSnap) => {
      students.push({ id: docSnap.id, ...docSnap.data() });
    });

    students.forEach((s) => {
      const item = document.createElement("div");
      item.className = "chat-student-item";
      item.dataset.id = s.id;
      item.innerHTML = `
        <div class="chat-student-name">${s.name}</div>
        <div class="chat-student-meta">Level: ${s.level || "-"} • ${
        (s.subjects || []).join(", ") || "No subjects"
      }</div>
      `;
      item.addEventListener("click", () => openChatForStudent(s.id, s.name));
      chatStudentList.appendChild(item);
    });
  });
}

function openChatForStudent(id, name) {
  chatStudentId = id;
  if (chatStudentIdHidden) chatStudentIdHidden.value = id;

  if (chatThreadUnsub) chatThreadUnsub();

  const msgsRef = collection(db, "chats", id, "messages");
  const qMsgs = query(msgsRef, orderBy("createdAt", "asc"));
  chatThreadUnsub = onSnapshot(qMsgs, (snap) => {
    if (!chatThread) return;
    chatThread.innerHTML = "";
    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const row = document.createElement("div");
      row.className =
        "chat-row " +
        (m.sender === "student"
          ? "chat-row-student"
          : "chat-row-teacher");

      let inner = `
        <div class="chat-bubble ${
          m.sender === "student"
            ? "chat-bubble-student"
            : "chat-bubble-teacher"
        }">
          ${m.text ? `<div class="chat-text">${m.text}</div>` : ""}
      `;
      if (m.imageUrl) {
        inner += `<div class="chat-image"><img src="${m.imageUrl}" alt="attachment" /></div>`;
      }
      inner += `<div class="chat-time">${fmtTime(m.createdAt)}</div></div>`;
      row.innerHTML = inner;
      chatThread.appendChild(row);
    });
    chatThread.scrollTop = chatThread.scrollHeight;
  });
}

if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatStudentId) {
      alert("Select a student chat first.");
      return;
    }

    const text = chatInput.value.trim();
    const file = chatImage.files[0] || null;
    if (!text && !file) return;

    try {
      if (chatStatus) chatStatus.textContent = "Sending...";
      const msgsRef = collection(db, "chats", chatStudentId, "messages");

      let imageUrl = null;
      if (file) {
        const path = `chat-images/${chatStudentId}/${Date.now()}_${file.name}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file);
        imageUrl = await getDownloadURL(ref);
      }

      await addDoc(msgsRef, {
        sender: "teacher",
        text,
        imageUrl,
        createdAt: Date.now(),
      });

      chatInput.value = "";
      chatImage.value = "";
      if (chatStatus) {
        chatStatus.textContent = "Sent!";
        setTimeout(() => (chatStatus.textContent = ""), 1500);
      }
    } catch (err) {
      console.error(err);
      if (chatStatus) chatStatus.textContent = "Failed to send.";
    }
  });
}

console.log("[Teacher] Dashboard JS loaded");
