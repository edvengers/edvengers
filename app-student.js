// app-student.js
// Handles the student side:
// - Creates/updates a simple "student profile" document (by name)
// - Shows Hero Stars from Firestore
// - Sends questions to Firestore
// - Shows a chat-style view of own questions + teacher replies

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
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase config (same as teacher)
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

// Helper to make a safe doc id from name
function slugifyName(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

function formatTimeLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initStudentPortal() {
  // Get student name (from login script)
  let studentName = window.currentStudentName;
  if (!studentName) {
    // fallback to local storage (if they refresh)
    studentName = localStorage.getItem("currentStudentName");
  } else {
    localStorage.setItem("currentStudentName", studentName);
  }

  if (!studentName) {
    // If somehow reached here without login, show a message
    const hubTitle = document.getElementById("hub-title");
    if (hubTitle) {
      hubTitle.textContent = "Please go back and log in again.";
    }
    return;
  }

  const nameDisplay = document.getElementById("student-name-display");
  if (nameDisplay) {
    nameDisplay.textContent = studentName;
  }

  const studentId = slugifyName(studentName);
  const studentRef = doc(db, "students", studentId);

  // Ensure profile exists (at least name + stars)
  setDoc(
    studentRef,
    {
      name: studentName,
      stars: 0,
      updatedAt: Date.now(),
    },
    { merge: true }
  ).catch((err) => console.error("Error creating student profile", err));

  // Subscribe to stars
  const starsEl = document.getElementById("hero-stars-count");
  onSnapshot(studentRef, (snap) => {
    const data = snap.data();
    if (data && starsEl) {
      starsEl.textContent = data.stars || 0;
    }
  });

// --- Announcements & Homework subscriptions for student hub ---

  const announcementList = document.getElementById("announcement-list");
  const homeworkList = document.getElementById("homework-list");

  if (announcementList) {
    const annQuery = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(annQuery, (snapshot) => {
      announcementList.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item = document.createElement("div");
        item.className = "announcement";
        item.innerHTML = `
          <h4>${data.title || "Untitled"}</h4>
          <p>${data.message || ""}</p>
          <p class="helper-text">Posted: ${new Date(
            data.createdAt || Date.now()
          ).toLocaleString()}</p>
        `;
        announcementList.appendChild(item);
      });
    });
  }

  if (homeworkList) {
    const hwQuery = query(
      collection(db, "homework"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(hwQuery, (snapshot) => {
      homeworkList.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item = document.createElement("div");
        item.className = "announcement";
        item.innerHTML = `
          <h4>${data.title || "Untitled"}</h4>
          <p><a href="${data.link}" target="_blank">Open link</a></p>
          <p class="helper-text">
            ${data.level ? "Level: " + data.level + " • " : ""}Posted:
            ${new Date(data.createdAt || Date.now()).toLocaleString()}
          </p>
        `;
        homeworkList.appendChild(item);
      });
    });
  }

  // Handle Ask a Question
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatWindow = document.getElementById("chat-window");
  const chatStatus = document.getElementById("chat-status");

  if (chatForm && chatInput && chatWindow) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      chatStatus.textContent = "Sending question...";

      try {
        await addDoc(collection(db, "questions"), {
          studentName,
          text,
          reply: "",
          createdAt: Date.now(),
          repliedAt: null,
        });
        chatInput.value = "";
        chatStatus.textContent = "Question sent! Your teacher will reply soon.";
        setTimeout(() => (chatStatus.textContent = ""), 2500);
      } catch (err) {
        console.error("Error sending question:", err);
        chatStatus.textContent = "Error sending question. Please try again.";
      }
    });

    // Subscribe to this student's questions
    const qQuery = query(
      collection(db, "questions"),
      where("studentName", "==", studentName),
      orderBy("createdAt", "asc")
    );

    onSnapshot(qQuery, (snapshot) => {
      chatWindow.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rowStudent = document.createElement("div");
        rowStudent.className = "chat-row chat-row-student";
        rowStudent.innerHTML = `
          <div class="chat-bubble chat-bubble-student">
            <div class="chat-text">${data.text || ""}</div>
            <div class="chat-time">${formatTimeLabel(data.createdAt)}</div>
          </div>
        `;
        chatWindow.appendChild(rowStudent);

        if (data.reply) {
          const rowTeacher = document.createElement("div");
          rowTeacher.className = "chat-row chat-row-teacher";
          rowTeacher.innerHTML = `
            <div class="chat-bubble chat-bubble-teacher">
              <div class="chat-text">${data.reply}</div>
              <div class="chat-time">${formatTimeLabel(
                data.repliedAt || data.createdAt
              )}</div>
            </div>
          `;
          chatWindow.appendChild(rowTeacher);
        }
      });

      chatWindow.scrollTop = chatWindow.scrollHeight;
    });
  }
}

// Initialise when DOM is ready
document.addEventListener("DOMContentLoaded", initStudentPortal);
