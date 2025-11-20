// app-teacher.js
// This file handles:
// - Firebase initialisation
// - Teacher login (Firebase Auth)
// - CRUD for announcements & homework
// - Listing student questions + posting replies

// 1. IMPORT FIREBASE MODULES FROM CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 2. TODO: PASTE YOUR OWN FIREBASE CONFIG HERE
// Go to Firebase console → Project settings → Web app → Config
const firebaseConfig = {
  apiKey: "AIzaSyAhD_rigOfXWYGcj7ooUggG0H4oVtV9cDI",
  authDomain: "edvengers-portal.firebaseapp.com",
  projectId: "edvengers-portal",
  storageBucket: "edvengers-portal.firebasestorage.app",
  messagingSenderId: "825538244708",
  appId: "1:825538244708:web:5eb57d970a65433190ef71",
};

// 3. INITIALISE FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. DOM ELEMENTS
const loginSection = document.getElementById("teacher-login-section");
const dashboardSection = document.getElementById("teacher-dashboard-section");
const loginForm = document.getElementById("teacher-login-form");
const loginError = document.getElementById("teacher-login-error");
const logoutBtn = document.getElementById("teacher-logout-btn");

const announcementForm = document.getElementById("announcement-form");
const announcementList = document.getElementById("announcement-list");

const homeworkForm = document.getElementById("homework-form");
const homeworkList = document.getElementById("homework-list");

const questionsList = document.getElementById("questions-list");

// 5. AUTH: HANDLE LOGIN / LOGOUT / STATE

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.style.display = "none";
  const email = document.getElementById("teacher-email").value.trim();
  const pwd = document.getElementById("teacher-password").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    loginForm.reset();
  } catch (err) {
    console.error(err);
    loginError.textContent = "Login failed. Please check your email and password.";
    loginError.style.display = "block";
  }
});

logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Logged in
    loginSection.style.display = "none";
    dashboardSection.style.display = "block";
    startRealtimeSubscriptions();
  } else {
    // Logged out
    dashboardSection.style.display = "none";
    loginSection.style.display = "flex";
    clearLists();
  }
});

// 6. ANNOUNCEMENTS

if (announcementForm) {
  announcementForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("announcement-title").value.trim();
    const message = document.getElementById("announcement-message").value.trim();

    if (!title || !message) return;

    try {
      await addDoc(collection(db, "announcements"), {
        title,
        message,
        createdAt: Date.now(),
      });
      announcementForm.reset();
    } catch (err) {
      console.error("Error adding announcement:", err);
    }
  });
}

function renderAnnouncement(docSnapshot) {
  const data = docSnapshot.data();
  const card = document.createElement("div");
  card.className = "announcement";
  card.innerHTML = `
    <h4>${data.title || "Untitled"}</h4>
    <p>${data.message || ""}</p>
    <p class="helper-text">Posted: ${new Date(data.createdAt || Date.now()).toLocaleString()}</p>
  `;
  announcementList.appendChild(card);
}

function clearAnnouncements() {
  announcementList.innerHTML = "";
}

// 7. HOMEWORK

if (homeworkForm) {
  homeworkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("homework-title").value.trim();
    const link = document.getElementById("homework-link").value.trim();
    const level = document.getElementById("homework-level").value.trim();

    if (!title || !link) return;

    try {
      await addDoc(collection(db, "homework"), {
        title,
        link,
        level,
        createdAt: Date.now(),
      });
      homeworkForm.reset();
    } catch (err) {
      console.error("Error adding homework:", err);
    }
  });
}

function renderHomework(docSnapshot) {
  const data = docSnapshot.data();
  const item = document.createElement("div");
  item.className = "announcement"; // reuse style
  item.innerHTML = `
    <h4>${data.title || "Untitled"}</h4>
    <p><a href="${data.link}" target="_blank">Open link</a></p>
    <p class="helper-text">
      ${data.level ? "Level: " + data.level + " • " : ""}Posted:
      ${new Date(data.createdAt || Date.now()).toLocaleString()}
    </p>
  `;
  homeworkList.appendChild(item);
}

function clearHomework() {
  homeworkList.innerHTML = "";
}

// 8. STUDENT QUESTIONS + REPLIES

function formatTimeLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderQuestionsGrouped(snapshot) {
  // Clear existing list
  questionsList.innerHTML = "";

  // Group questions by studentName
  const byStudent = {};

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const studentName = data.studentName || "Unknown student";

    if (!byStudent[studentName]) {
      byStudent[studentName] = [];
    }

    byStudent[studentName].push({
      id: docSnap.id,
      text: data.text || "",
      reply: data.reply || "",
      createdAt: data.createdAt || 0,
      repliedAt: data.repliedAt || 0,
    });
  });

  // Sort students alphabetically
  const studentNames = Object.keys(byStudent).sort((a, b) =>
    a.localeCompare(b)
  );

  studentNames.forEach((name) => {
    const questions = byStudent[name].sort(
      (a, b) => a.createdAt - b.createdAt
    );
    const total = questions.length;
    const unanswered = questions.filter((q) => !q.reply).length;

    // <details> wrapper per student (collapsible)
    const thread = document.createElement("details");
    thread.className = "teacher-student-thread";

    // Auto-open if there are pending questions
    if (unanswered > 0) {
      thread.open = true;
    }

    // Summary row (student name + stats)
    const summary = document.createElement("summary");
    summary.className = "teacher-student-summary";
    summary.innerHTML = `
      <span class="teacher-student-name">${name}</span>
      <span class="teacher-student-meta">
        ${total} msg${total > 1 ? "s" : ""}
        ${unanswered > 0 ? ` • ${unanswered} pending` : ""}
      </span>
    `;
    thread.appendChild(summary);

    // Chat-style container inside
    const card = document.createElement("div");
    card.className = "announcement teacher-thread-card";

    const chat = document.createElement("div");
    chat.className = "teacher-chat-thread";

    // Build flat message list: student + teacher messages
    const messages = [];

    questions.forEach((q) => {
      // Student message
      messages.push({
        sender: "student",
        text: q.text,
        ts: q.createdAt,
        docId: q.id,
      });

      if (q.reply) {
        // Teacher reply message
        messages.push({
          sender: "teacher",
          text: q.reply,
          ts: q.repliedAt || q.createdAt + 1,
          docId: q.id,
        });
      }
    });

    // Sort by time so it flows like a chat
    messages.sort((a, b) => a.ts - b.ts);

    // Find the last student message – we always reply to this one
    const studentMessages = messages.filter((m) => m.sender === "student");
    const lastStudent = studentMessages[studentMessages.length - 1] || null;
    const replyTargetDocId = lastStudent ? lastStudent.docId : null;

    // Render messages with timestamps
    messages.forEach((m) => {
      const row = document.createElement("div");
      row.className =
        "teacher-chat-row " +
        (m.sender === "student"
          ? "teacher-chat-row-student"
          : "teacher-chat-row-teacher");

      const timeLabel = formatTimeLabel(m.ts);

      row.innerHTML = `
        <div class="teacher-chat-bubble">
          <div class="teacher-chat-text">${m.text}</div>
          <div class="teacher-chat-time">${timeLabel}</div>
        </div>
      `;
      chat.appendChild(row);
    });

    // ✅ Reply box ALWAYS visible (as long as there is at least one student message)
    if (replyTargetDocId) {
      const form = document.createElement("form");
      form.className = "teacher-chat-reply-form";
      form.dataset.docId = replyTargetDocId;
      form.innerHTML = `
        <label>
          <span class="teacher-reply-label">Reply</span>
          <textarea rows="2" placeholder="Type your reply..."></textarea>
        </label>
        <button type="submit" class="btn btn-small">Send reply</button>
      `;
      chat.appendChild(form);
    }

    card.appendChild(chat);
    thread.appendChild(card);
    questionsList.appendChild(thread);
  });

  // Attach reply listeners for the inline forms
  questionsList
    .querySelectorAll(".teacher-chat-reply-form")
    .forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const docId = form.dataset.docId;
        const textarea = form.querySelector("textarea");
        const newReply = textarea.value.trim();
        if (!newReply) return;

        try {
          await updateDoc(doc(db, "questions", docId), {
            reply: newReply,
            repliedAt: Date.now(),
          });
          textarea.value = "";
        } catch (err) {
          console.error("Error saving reply:", err);
        }
      });
    });
}
// 9. REALTIME SUBSCRIPTIONS

let unsubAnnouncements = null;
let unsubHomework = null;
let unsubQuestions = null;

function startRealtimeSubscriptions() {
  // Announcements
  const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  unsubAnnouncements = onSnapshot(annQuery, (snapshot) => {
    clearAnnouncements();
    snapshot.forEach(renderAnnouncement);
  });

  // Homework
  const hwQuery = query(collection(db, "homework"), orderBy("createdAt", "desc"));
  unsubHomework = onSnapshot(hwQuery, (snapshot) => {
    clearHomework();
    snapshot.forEach(renderHomework);
  });

  // Questions
  const qQuery = query(
    collection(db, "questions"),
    orderBy("createdAt", "desc")
  );
  unsubQuestions = onSnapshot(qQuery, (snapshot) => {
    renderQuestionsGrouped(snapshot);
  });
}

function clearLists() {
  clearAnnouncements();
  clearHomework();
  clearQuestions();

  if (unsubAnnouncements) unsubAnnouncements();
  if (unsubHomework) unsubHomework();
  if (unsubQuestions) unsubQuestions();

  unsubAnnouncements = unsubHomework = unsubQuestions = null;
}
