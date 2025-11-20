// app-student.js
// Student Hub logic:
// - Login (local password)
// - Load announcements & homework from Firestore
// - Send questions to Firestore
// - Listen for this student's questions + teacher replies

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 1. FIREBASE CONFIG – COPY EXACTLY THE SAME AS app-teacher.js
const firebaseConfig = {
  apiKey: "AIzaSyAhD_rigOfXWYGcj7ooUggG0H4oVtV9cDI",
  authDomain: "edvengers-portal.firebaseapp.com",
  projectId: "edvengers-portal",
  storageBucket: "edvengers-portal.firebasestorage.app",
  messagingSenderId: "825538244708",
  appId: "1:825538244708:web:5eb57d970a65433190ef71",
};

// 2. INIT FIREBASE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. DOM ELEMENTS
const yearEl = document.getElementById("year");

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginSection = document.getElementById("login-section");
const dashboardSection = document.getElementById("dashboard-section");
const studentNameInput = document.getElementById("student-name");
const portalPasswordInput = document.getElementById("portal-password");
const studentNameDisplay = document.getElementById("student-name-display");

const annList = document.getElementById("student-announcements");
const hwList = document.getElementById("student-homework");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

const PORTAL_PASSWORD = "heroes2026";

let currentStudentName = null;
let unsubscribeQuestions = null;

// Helper: year in footer
function setYear() {
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

// Helper: render chat bubble
function renderChatBubble(text, sender = "student") {
  if (!chatWindow) return;
  const bubble = document.createElement("div");
  bubble.className =
    "chat-bubble " +
    (sender === "student" ? "chat-bubble-student" : "chat-bubble-teacher");
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 4. REALTIME ANNOUNCEMENTS
function renderAnnouncement(docSnap) {
  const data = docSnap.data();
  const div = document.createElement("div");
  div.className = "announcement";
  div.innerHTML = `
    <h4>${data.title || "Announcement"}</h4>
    <p>${data.message || ""}</p>
    <p class="helper-text">${new Date(data.createdAt || Date.now()).toLocaleString()}</p>
  `;
  annList.appendChild(div);
}

function loadAnnouncements() {
  if (!annList) return;
  const qAnn = query(
    collection(db, "announcements"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(qAnn, (snapshot) => {
    annList.innerHTML = "";
    snapshot.forEach(renderAnnouncement);
  });
}

// 5. REALTIME HOMEWORK
function renderHomework(docSnap) {
  const data = docSnap.data();
  const div = document.createElement("div");
  div.className = "announcement";
  div.innerHTML = `
    <h4>${data.title || "Homework"}</h4>
    <p><a href="${data.link}" target="_blank">Open Link</a></p>
    <p class="helper-text">
      ${new Date(data.createdAt || Date.now()).toLocaleString()}
      ${data.level ? " • " + data.level : ""}
    </p>
  `;
  hwList.appendChild(div);
}

function loadHomework() {
  if (!hwList) return;
  const qHw = query(collection(db, "homework"), orderBy("createdAt", "desc"));
  onSnapshot(qHw, (snapshot) => {
    hwList.innerHTML = "";
    snapshot.forEach(renderHomework);
  });
}

// 6. REALTIME STUDENT QUESTIONS + REPLIES
function startQuestionListener(studentName) {
  if (!chatWindow) return;

  // Clear old listener if any
  if (unsubscribeQuestions) {
    unsubscribeQuestions();
    unsubscribeQuestions = null;
  }

  // Listen only for this student's questions
  const q = query(
    collection(db, "questions"),
    where("studentName", "==", studentName)
  );

  unsubscribeQuestions = onSnapshot(q, (snapshot) => {
    chatWindow.innerHTML = "";

    const messages = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const qText = data.text || "";
      const reply = data.reply || "";
      const createdAt = data.createdAt || 0;
      const repliedAt = data.repliedAt || (createdAt + 1);

      if (qText) {
        messages.push({
          sender: "student",
          text: qText,
          ts: createdAt,
        });
      }

      if (reply) {
        messages.push({
          sender: "teacher",
          text: reply,
          ts: repliedAt,
        });
      }
    });

    // Sort all messages by time so it feels like WhatsApp/Telegram
    messages.sort((a, b) => a.ts - b.ts);

    messages.forEach((m) => {
      renderChatBubble(m.text, m.sender);
    });
  });
}
// 7. SEND QUESTION TO FIRESTORE
function setupChatForm() {
  if (!chatForm) return;

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    const studentName =
      currentStudentName || studentNameDisplay?.textContent || "Unknown";

    // Show bubble immediately
    renderChatBubble(text, "student");

    addDoc(collection(db, "questions"), {
      studentName,
      text,
      reply: "",
      createdAt: Date.now(),
    })
      .then((docRef) => {
        console.log("Question sent to Firestore with id:", docRef.id);
        // No alert needed now that it's working smoothly
        chatInput.value = "";
      })
      .catch((err) => {
        console.error("Error sending question:", err);
        alert(
          "❌ Sorry, your question could not be sent. Please try again later."
        );
      });
  });
}

// 8. LOGIN HANDLING
function setupLogin() {
  if (!loginForm) return;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (loginError) loginError.style.display = "none";

    const name = studentNameInput.value.trim();
    const pwd = portalPasswordInput.value.trim();

    if (!name) return;

    if (pwd !== PORTAL_PASSWORD) {
      if (loginError) {
        loginError.textContent = "Incorrect password. Please try again.";
        loginError.style.display = "block";
      }
      return;
    }

    // Successful "login"
    currentStudentName = name;
    if (studentNameDisplay) studentNameDisplay.textContent = name;
    if (loginSection) loginSection.style.display = "none";
    if (dashboardSection) dashboardSection.style.display = "block";

    // Start listening to this student's questions + replies
    startQuestionListener(name);
  });
}

// 9. INIT
function init() {
  setYear();
  loadAnnouncements();
  loadHomework();
  setupLogin();
  setupChatForm();
}

init();
