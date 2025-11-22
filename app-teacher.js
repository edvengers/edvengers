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

// ---- Simple teacher login ----

const TEACHER_PASSWORD = "teach-heroes-2026"; // change this to whatever you like

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

const levelSelectProfile = document.getElementById("student-level");
const subjectsSelectProfile = document.getElementById("student-subjects");

let studentsCache = []; // full list from Firestore
let selectedStudentName = ""; // name from dropdown
let stagedStars = null; // staged points before "Update Points"

// When existing student is chosen, fill name / level / subjects in profile (optional)
if (studentsSelect && document.getElementById("student-name")) {
  const nameInput = document.getElementById("student-name");
  studentsSelect.addEventListener("change", () => {
    selectedStudentName = studentsSelect.value || "";
    const s = studentsCache.find((st) => st.name === selectedStudentName);

    if (nameInput && s) nameInput.value = s.name || "";

    if (levelSelectProfile && s) {
      levelSelectProfile.value = s.level || "";
    }

    if (subjectsSelectProfile && s) {
      const subs = s.subjects || [];
      Array.from(subjectsSelectProfile.options).forEach((opt) => {
        opt.selected = subs.includes(opt.value);
      });
    }

    // Reset staged stars and render the row
    stagedStars = s ? s.stars || 0 : null;
    renderStudentsList();
  });
}

// Create / update student document
if (studentsForm) {
  studentsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("student-name");
    let name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
      alert("Please enter a student name.");
      return;
    }

    const level = levelSelectProfile ? levelSelectProfile.value : "";
    const subjects = subjectsSelectProfile
      ? Array.from(subjectsSelectProfile.selectedOptions).map((o) => o.value)
      : [];

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
      alert(`Saved/updated ${name}. Default password: heroes2026`);
    } catch (err) {
      console.error(err);
      alert("Failed to save student.");
    }
  });
}

// Build the dropdown options based on filters
function refreshStudentOptions() {
  if (!studentsSelect) return;
  const levelFilter = (filterLevelInput?.value || "").trim();
  const subjectFilter = (filterSubjectInput?.value || "").trim();

  studentsSelect.innerHTML = '<option value="">-- Select student --</option>';

  studentsCache.forEach((s) => {
    if (levelFilter && s.level !== levelFilter) return;
    if (subjectFilter && !(s.subjects || []).includes(subjectFilter)) return;

    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    studentsSelect.appendChild(opt);
  });

  // If current selection no longer matches filter, clear it
  const stillValid = studentsCache.find((s) => {
    if (s.name !== selectedStudentName) return false;
    if (levelFilter && s.level !== levelFilter) return false;
    if (subjectFilter && !(s.subjects || []).includes(subjectFilter))
      return false;
    return true;
  });

  if (!stillValid) {
    selectedStudentName = "";
    stagedStars = null;
    studentsSelect.value = "";
  } else {
    studentsSelect.value = selectedStudentName;
  }
}

// Render the single selected student's row with staged stars
function renderStudentsList() {
  if (!studentsList) return;
  studentsList.innerHTML = "";

  if (!selectedStudentName) {
    const p = document.createElement("p");
    p.className = "helper-text";
    p.textContent = "Select a student above to view and update Hero Points.";
    studentsList.appendChild(p);
    return;
  }

  const s = studentsCache.find((st) => st.name === selectedStudentName);
  if (!s) {
    const p = document.createElement("p");
    p.className = "helper-text";
    p.textContent = "Student not found. Try clearing filters.";
    studentsList.appendChild(p);
    return;
  }

  const current = stagedStars !== null ? stagedStars : s.stars || 0;
  const row = document.createElement("div");
  row.className = "student-row ev-card-bubble";
  row.dataset.id = slugify(s.name);

  row.innerHTML = `
    <div class="student-main">
      <div><strong>${s.name}</strong></div>
      <div class="helper-text">
        Level: ${s.level || "-"}${
    s.subjects?.length ? " • Subjects: " + s.subjects.join(", ") : ""
  } • Hero Points: <strong id="hero-points-value">${current}</strong>
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
      <button class="btn btn-small" data-action="applyStars" style="margin-left: 0.75rem;">
        Update Points
      </button>
    </div>
  `;

  studentsList.appendChild(row);

  const valueEl = row.querySelector("#hero-points-value");

  function updateDisplay(newVal) {
    stagedStars = newVal;
    if (valueEl) valueEl.textContent = stagedStars;
  }

  row.querySelectorAll(".student-actions button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const base = stagedStars !== null ? stagedStars : s.stars || 0;

      if (action === "add1") {
        updateDisplay(base + 1);
      } else if (action === "add5") {
        updateDisplay(base + 5);
      } else if (action === "resetStars") {
        updateDisplay(0);
      } else if (action === "resetPwd") {
        try {
          await updateDoc(doc(db, "students", row.dataset.id), {
            password: "heroes2026",
            updatedAt: Date.now(),
          });
          alert("Password reset to heroes2026.");
        } catch (err) {
          console.error(err);
          alert("Failed to reset password.");
        }
      } else if (action === "applyStars") {
        // Commit staged stars to Firestore
        const finalStars =
          stagedStars !== null ? stagedStars : s.stars || 0;
        try {
          await updateDoc(doc(db, "students", row.dataset.id), {
            stars: finalStars,
            updatedAt: Date.now(),
          });
          // After update, rely on snapshot to refresh, but we can also clear staging
          stagedStars = null;
        } catch (err) {
          console.error(err);
          alert("Failed to update points.");
        }
      }
    });
  });
}

// Filter change → refresh list + options
if (filterLevelInput) {
  filterLevelInput.addEventListener("change", () => {
    refreshStudentOptions();
    stagedStars = null;
    selectedStudentName = "";
    renderStudentsList();
  });
}
if (filterSubjectInput) {
  filterSubjectInput.addEventListener("change", () => {
    refreshStudentOptions();
    stagedStars = null;
    selectedStudentName = "";
    renderStudentsList();
  });
}

// live load from Firestore
const studentsQuery = query(collection(db, "students"), orderBy("name", "asc"));
onSnapshot(studentsQuery, (snap) => {
  studentsCache = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const entry = { id: docSnap.id, ...data };
    studentsCache.push(entry);
  });

  // After each snapshot, rebuild dropdown + re-render selected student row
  refreshStudentOptions();
  renderStudentsList();
});

// ---- Announcements ----

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
  const q2 = query(
    collection(db, "announcements"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q2, (snap) => {
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

// ---- Homework ----

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
  const q3 = query(collection(db, "homework"), orderBy("postedAt", "desc"));
  onSnapshot(q3, (snap) => {
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

// ---- Chat ----

const chatStudentList = document.getElementById("chat-student-list");
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("teacher-chat-form");
const chatInput = document.getElementById("teacher-chat-input");
const chatImage = document.getElementById("teacher-chat-image");
const chatStatus = document.getElementById("teacher-chat-status");
const chatStudentIdHidden = document.getElementById("teacher-chat-student-id");

let chatStudentId = null;
let chatThreadUnsub = null;

// sidebar: students with last message / pending
if (chatStudentList) {
  const q4 = query(collection(db, "students"), orderBy("name", "asc"));
  onSnapshot(q4, async (snap) => {
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
