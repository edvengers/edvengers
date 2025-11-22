// app-student.js
// Student login + profile + filtered announcements/homework + chat with photo

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
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

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

let currentStudent = null;
let chatUnsub = null;

// ---- Student announcements & homework limiting ----
const annContainer = document.getElementById("student-announcements");
const annToggleBtn = document.getElementById("student-ann-toggle");
const annCountLabel = document.getElementById("student-ann-count");

const hwContainer = document.getElementById("student-homework-list");
const hwToggleBtn = document.getElementById("student-hw-toggle");
const hwCountLabel = document.getElementById("student-hw-count");

// store filtered lists for this student
let allAnnouncementsForStudent = [];
let allHomeworkForStudent = [];

// whether we're showing all or just latest few
let showAllAnnouncements = false;
let showAllHomework = false;

async function loginStudent(name, password) {
  const trimmedName = name.trim();
  const trimmedPwd = password.trim();
  if (!trimmedName || !trimmedPwd) throw new Error("Missing fields.");

  const id = slugify(trimmedName);
  const ref = doc(db, "students", id);
  const snap = await getDoc(ref);

  // Student does not exist yet: allow creation only with default password
  if (!snap.exists()) {
    if (trimmedPwd !== "heroes2026") {
      throw new Error("Account not found. Please check with your teacher.");
    }
    await setDoc(ref, {
      name: trimmedName,
      level: "",
      subjects: [],
      stars: 0,
      password: "heroes2026",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { id, ...{ name: trimmedName, level: "", subjects: [], stars: 0 } };
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
  const hubSection = document.getElementById("student-hub-section");
  if (loginSection) loginSection.style.display = "none";
  if (hubSection) hubSection.style.display = "block";

  // Fill profile
  const displayName = document.getElementById("student-name-display");
  const profileName = document.getElementById("profile-name");
  const profileLevel = document.getElementById("profile-level");
  const profileSubjects = document.getElementById("profile-subjects");
  const starsEl = document.getElementById("hero-stars-count");

  if (displayName) displayName.textContent = student.name;
  if (profileName) profileName.textContent = student.name;
  if (profileLevel) profileLevel.textContent = student.level || "-";
  if (profileSubjects)
    profileSubjects.textContent =
      (student.subjects && student.subjects.join(", ")) || "-";
  if (starsEl) starsEl.textContent = student.stars || 0;

  // Live updates for stars & basic profile
  const ref = doc(db, "students", student.id);
  onSnapshot(ref, (snap) => {
    const data = snap.data();
    if (!data) return;
    if (starsEl) starsEl.textContent = data.stars || 0;
    if (profileLevel) profileLevel.textContent = data.level || "-";
    if (profileSubjects)
      profileSubjects.textContent =
        (data.subjects && data.subjects.join(", ")) || "-";
  });

  initAnnouncementsAndHomework(student);
  initChat(student);
}

function initAnnouncementsAndHomework(student) {
  const level = student.level;
  const subjects = student.subjects || [];

  // --- Announcements: listen + filter + store list ---
  const annQuery = query(
    collection(db, "announcements"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(annQuery, (snap) => {
    if (!annContainer) return;

    const list = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const levels = d.levels || [];
      const subs = d.subjects || [];

      const levelMatch =
        levels.length === 0 || (level && levels.includes(level));
      const subjectMatch =
        subs.length === 0 ||
        (subjects.length > 0 &&
          subjects.some((s) => subs.includes(s)));

      if (!levelMatch || !subjectMatch) return;

      list.push({
        id: docSnap.id,
        ...d,
      });
    });

    allAnnouncementsForStudent = list;
    renderStudentAnnouncements();
  });

  // --- Homework: listen + filter + store list ---
  const hwQuery = query(
    collection(db, "homework"),
    orderBy("postedAt", "desc")
  );

  onSnapshot(hwQuery, (snap) => {
    if (!hwContainer) return;

    const list = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const levels = d.levels || [];
      const subs = d.subjects || [];

      const levelMatch =
        levels.length === 0 || (level && levels.includes(level));
      const subjectMatch =
        subs.length === 0 ||
        (subjects.length > 0 &&
          subjects.some((s) => subs.includes(s)));

      if (!levelMatch || !subjectMatch) return;

      list.push({
        id: docSnap.id,
        ...d,
      });
    });

    allHomeworkForStudent = list;
    renderStudentHomework();
  });
}

// ---- Rendering helpers for announcements + homework ----

function renderStudentAnnouncements() {
  if (!annContainer) return;

  annContainer.innerHTML = "";

  const total = allAnnouncementsForStudent.length;
  if (!total) {
    annContainer.innerHTML =
      '<p class="helper-text">No announcements yet.</p>';
    if (annToggleBtn) annToggleBtn.style.display = "none";
    if (annCountLabel) annCountLabel.textContent = "";
    return;
  }

  const LIMIT = 5;
  const itemsToShow = showAllAnnouncements
    ? allAnnouncementsForStudent
    : allAnnouncementsForStudent.slice(0, LIMIT);

  itemsToShow.forEach((d) => {
    const card = document.createElement("div");
    card.className = "ev-card-bubble";
    card.innerHTML = `
      <h4>${d.title || "Untitled"}</h4>
      <p>${d.message || ""}</p>
      <p class="helper-text">
        Posted: ${
          d.createdAt
            ? new Date(d.createdAt).toLocaleString()
            : "-"
        }
      </p>
    `;
    annContainer.appendChild(card);
  });

  if (annToggleBtn) {
    if (total > LIMIT) {
      annToggleBtn.style.display = "inline-block";
      annToggleBtn.textContent = showAllAnnouncements
        ? "Show fewer announcements"
        : `Show older announcements (${total - LIMIT} more)`;
    } else {
      annToggleBtn.style.display = "none";
    }
  }

  if (annCountLabel) {
    annCountLabel.textContent = showAllAnnouncements
      ? `Showing all ${total} announcements`
      : `Showing latest ${Math.min(LIMIT, total)} of ${total} announcements`;
  }
}

function renderStudentHomework() {
  if (!hwContainer) return;

  hwContainer.innerHTML = "";

  const total = allHomeworkForStudent.length;
  if (!total) {
    hwContainer.innerHTML =
      '<p class="helper-text">No homework assigned yet.</p>';
    if (hwToggleBtn) hwToggleBtn.style.display = "none";
    if (hwCountLabel) hwCountLabel.textContent = "";
    return;
  }

  const LIMIT = 5;
  const itemsToShow = showAllHomework
    ? allHomeworkForStudent
    : allHomeworkForStudent.slice(0, LIMIT);

  itemsToShow.forEach((d) => {
    const links = (d.links || []).map(
      (url, i) =>
        `<li><a href="${url}" target="_blank">Link ${i + 1}</a></li>`
    );

    const card = document.createElement("div");
    card.className = "ev-card-bubble";
    card.innerHTML = `
      <h4>${d.title || "Untitled"}</h4>
      ${d.description ? `<p>${d.description}</p>` : ""}
      ${
        links.length
          ? `<ul class="ev-link-list">${links.join("")}</ul>`
          : '<p class="helper-text">No links provided.</p>'
      }
      <p class="helper-text">
        Posted: ${
          d.postedAt
            ? new Date(d.postedAt).toLocaleDateString()
            : "-"
        }
        ${
          d.dueAt
            ? " • Due: " +
              new Date(d.dueAt).toLocaleDateString()
            : ""
        }
      </p>
    `;
    hwContainer.appendChild(card);
  });

  if (hwToggleBtn) {
    if (total > LIMIT) {
      hwToggleBtn.style.display = "inline-block";
      hwToggleBtn.textContent = showAllHomework
        ? "Show fewer homework items"
        : `Show older homework (${total - LIMIT} more)`;
    } else {
      hwToggleBtn.style.display = "none";
    }
  }

  if (hwCountLabel) {
    hwCountLabel.textContent = showAllHomework
      ? `Showing all ${total} homework items`
      : `Showing latest ${Math.min(LIMIT, total)} of ${total} homework items`;
  }
}

// Toggle buttons
if (annToggleBtn) {
  annToggleBtn.addEventListener("click", () => {
    showAllAnnouncements = !showAllAnnouncements;
    renderStudentAnnouncements();
  });
}

if (hwToggleBtn) {
  hwToggleBtn.addEventListener("click", () => {
    showAllHomework = !showAllHomework;
    renderStudentHomework();
  });
}

function initChat(student) {
  const threadEl = document.getElementById("chat-window");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const imageInput = document.getElementById("chat-image");
  const statusEl = document.getElementById("chat-status");

  if (!threadEl || !form || !input) return;

  // subscribe to chat messages
  const msgsRef = collection(db, "chats", student.id, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"));

  if (chatUnsub) chatUnsub();
  chatUnsub = onSnapshot(q, (snap) => {
    threadEl.innerHTML = "";

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const isStudentMsg = m.sender === "student";

      // Student view:
      //  - student (me) on RIGHT (green)
      //  - teacher on LEFT (grey)
      const row = document.createElement("div");
      row.className =
        "chat-row " + (isStudentMsg ? "chat-row-right" : "chat-row-left");

      let inner = `
        <div class="chat-bubble ${
          isStudentMsg ? "chat-bubble-me" : "chat-bubble-other"
        }">
          ${m.text ? `<div class="chat-text">${m.text}</div>` : ""}
      `;

      if (m.imageUrl) {
        inner += `
          <div class="chat-image">
            <img src="${m.imageUrl}" alt="attachment" />
          </div>
        `;
      }

      inner += `<div class="chat-time">${fmtTime(m.createdAt)}</div></div>`;
      row.innerHTML = inner;
      threadEl.appendChild(row);
    });

    // auto-scroll to bottom
    threadEl.scrollTop = threadEl.scrollHeight;
  });

  // sending logic (unchanged)
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

      input.value = "";
      imageInput.value = "";
      if (statusEl) {
        statusEl.textContent = "Sent!";
        setTimeout(() => (statusEl.textContent = ""), 1500);
      }
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = "Failed to send. Try again.";
    }
  });
}

// ---- Bootstrapping ----

document.addEventListener("DOMContentLoaded", async () => {
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

  // Auto-login if name stored
  const savedName = localStorage.getItem("edvengerStudentName");
  if (savedName) {
    // best-effort fetch
    try {
      const id = slugify(savedName);
      const ref = doc(db, "students", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        switchToHub({ id, ...snap.data() });
      }
    } catch (_) {
      // ignore
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = "none";

      const name = document.getElementById("login-name").value;
      const pwd = document.getElementById("login-password").value;

      try {
        const student = await loginStudent(name, pwd);

        // If password is still default, you *could* prompt for change here.
        // For now we just log them in. Later we can add a change-password UI.

        switchToHub(student);
      } catch (err) {
        console.error(err);
        showError(err.message || "Login failed. Please try again.");
      }
    });
  }
});
