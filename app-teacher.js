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
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* --------------------------------------------------
   SIMPLE TEACHER LOGIN (same as before)
-------------------------------------------------- */

const TEACHER_PASSWORD = "1234";

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

// ---- Students & Hero Points ----

const studentsForm = document.getElementById("students-form");
const studentsList = document.getElementById("students-list");
const studentsSelect = document.getElementById("student-select");

const filterLevelInput = document.getElementById("filter-level");
const filterSubjectInput = document.getElementById("filter-subject");
const updatePointsBtn = document.getElementById("update-points-btn");

let studentsCache = [];           // full list from Firestore
let selectedStudentId = null;     // which student we are working with
let stagedDelta = 0;              // pending change in points for that student

// helper to find student by id
function findStudentById(id) {
  return studentsCache.find((s) => s.id === id) || null;
}

// 1️⃣ Add / update student profile (inside collapsible)
if (studentsForm) {
  studentsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("student-name");
    const levelSelect = document.getElementById("student-level");
    const subjectsSelect = document.getElementById("student-subjects");

    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) return;

    const level = levelSelect ? levelSelect.value.trim() : "";

    let subjects = [];
    if (subjectsSelect) {
      subjects = Array.from(subjectsSelect.selectedOptions).map((o) =>
        o.value.trim()
      );
    }

    const id = slugify(name);

    try {
      await setDoc(
        doc(db, "students", id),
        {
          name,
          level,
          subjects,
          password: "heroes2026", // default/reset
          stars: 0,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      studentsForm.reset();
      alert(`Saved/updated ${name}. Default password: heroes2026`);
    } catch (err) {
      console.error(err);
      alert("Failed to save student.");
    }
  });
}

// 2️⃣ Render student row based on current selection + stagedDelta
function renderStudentRow() {
  if (!studentsList) return;

  studentsList.innerHTML = "";

  if (!selectedStudentId) {
    studentsList.innerHTML =
      '<p class="helper-text">Select a student above to see Hero Points.</p>';
    return;
  }

  const student = findStudentById(selectedStudentId);
  if (!student) {
    studentsList.innerHTML =
      '<p class="helper-text">Student not found in current filter.</p>';
    return;
  }

  const current = student.stars || 0;
  const pendingText =
    stagedDelta !== 0
      ? ` (pending: ${stagedDelta > 0 ? "+" : ""}${stagedDelta})`
      : "";

  const row = document.createElement("div");
  row.className = "student-row ev-card-bubble";
  row.dataset.id = student.id;

  row.innerHTML = `
    <div class="student-main">
      <div><strong>${student.name}</strong></div>
      <div class="helper-text">
        Level: ${student.level || "-"}${
    student.subjects?.length ? " • Subjects: " + student.subjects.join(", ") : ""
  }
        • Hero Points: <strong>${current}</strong>${pendingText}
      </div>
    </div>
    <div class="student-actions">
      <button class="btn btn-small" data-action="add1">+1</button>
      <button class="btn btn-small" data-action="add5">+5</button>
      <button class="btn btn-ghost btn-small" data-action="resetStars">
        Reset Points
      </button>
      <button class="btn btn-ghost btn-small" data-action="resetPwd">
        Reset Password
      </button>
    </div>
  `;

  studentsList.appendChild(row);
}

// 3️⃣ Filter list + fill student dropdown
function applyFiltersAndFillSelect() {
  if (!studentsSelect) return;

  const levelFilter = (filterLevelInput?.value || "").trim();
  const subjectFilter = (filterSubjectInput?.value || "").trim();

  let list = [...studentsCache];

  if (levelFilter) {
    list = list.filter((s) => s.level === levelFilter);
  }
  if (subjectFilter) {
    list = list.filter((s) => (s.subjects || []).includes(subjectFilter));
  }

  studentsSelect.innerHTML = '<option value="">-- Select student --</option>';

  list.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id; // use doc id
    opt.textContent = s.name;
    studentsSelect.appendChild(opt);
  });

  // if current selection not in filtered list, clear selection & staged points
  if (!list.some((s) => s.id === selectedStudentId)) {
    selectedStudentId = null;
    stagedDelta = 0;
  }

  renderStudentRow();
}

// dropdown change handlers
if (filterLevelInput) {
  filterLevelInput.addEventListener("change", () => {
    applyFiltersAndFillSelect();
  });
}
if (filterSubjectInput) {
  filterSubjectInput.addEventListener("change", () => {
    applyFiltersAndFillSelect();
  });
}
if (studentsSelect) {
  studentsSelect.addEventListener("change", () => {
    selectedStudentId = studentsSelect.value || null;
    stagedDelta = 0; // reset whenever you switch student
    renderStudentRow();
  });
}

// 4️⃣ Handle +1 / +5 / reset buttons (only stage changes, do NOT hit Firestore yet)
if (studentsList) {
  studentsList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn || !selectedStudentId) return;

    const action = btn.dataset.action;
    const student = findStudentById(selectedStudentId);
    if (!student) return;

    const current = student.stars || 0;

    if (action === "add1") {
      stagedDelta += 1;
    } else if (action === "add5") {
      stagedDelta += 5;
    } else if (action === "resetStars") {
      // reset to 0 => delta = -current
      stagedDelta = -current;
    } else if (action === "resetPwd") {
      // password reset happens immediately
      const ref = doc(db, "students", selectedStudentId);
      updateDoc(ref, { password: "heroes2026", updatedAt: Date.now() })
        .then(() => alert("Password reset to heroes2026."))
        .catch((err) => {
          console.error(err);
          alert("Failed to reset password.");
        });
    }

    renderStudentRow();
  });
}

// 5️⃣ Update Points button (apply stagedDelta to Firestore)
if (updatePointsBtn) {
  updatePointsBtn.addEventListener("click", async () => {
    if (!selectedStudentId) {
      alert("Select a student first.");
      return;
    }
    if (stagedDelta === 0) {
      alert("No pending point changes to save.");
      return;
    }

    const ref = doc(db, "students", selectedStudentId);

    try {
      await updateDoc(ref, {
        stars: increment(stagedDelta),
        updatedAt: Date.now(),
      });
      stagedDelta = 0; // clear pending
      // Firestore snapshot will refresh studentsCache -> UI
    } catch (err) {
      console.error(err);
      alert("Failed to update points.");
    }
  });
}

// 6️⃣ Live load from Firestore and keep cache in sync
const studentsQuery = query(collection(db, "students"), orderBy("name", "asc"));
onSnapshot(studentsQuery, (snap) => {
  studentsCache = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    studentsCache.push({ id: docSnap.id, ...data });
  });
  applyFiltersAndFillSelect();
});

/* --------------------------------------------------
   ANNOUNCEMENTS (unchanged)
-------------------------------------------------- */

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

    const levels = levelsRaw
      ? levelsRaw.split(",").map((s) => s.trim())
      : [];
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

/* --------------------------------------------------
   HOMEWORK (unchanged)
-------------------------------------------------- */

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

    const levels = levelsRaw
      ? levelsRaw.split(",").map((s) => s.trim())
      : [];
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
            d.postedAt
              ? new Date(d.postedAt).toLocaleDateString()
              : "-"
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

/* --------------------------------------------------
   CHAT (unchanged from previous working version)
-------------------------------------------------- */

const chatStudentList = document.getElementById("chat-student-list");
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("teacher-chat-form");
const chatInput = document.getElementById("teacher-chat-input");
const chatImage = document.getElementById("teacher-chat-image");
const chatStatus = document.getElementById("teacher-chat-status");
const chatStudentIdHidden = document.getElementById("teacher-chat-student-id");

let chatStudentId = null;
let chatThreadUnsub = null;

if (chatStudentList) {
  const q = query(collection(db, "students"), orderBy("name", "asc"));
  onSnapshot(q, (snap) => {
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
  const q = query(msgsRef, orderBy("createdAt", "asc"));
  chatThreadUnsub = onSnapshot(q, (snap) => {
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
