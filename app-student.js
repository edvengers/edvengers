// app-student.js
// Student side:
// - Create/update simple profile (students collection)
// - Show Hero Stars
// - Show announcements & homework
// - Let student send questions & see replies

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

function slugifyName(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

function formatTimeLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initStudentPortal() {
  console.log("[Student] initStudentPortal start");

  let studentName = window.currentStudentName;
  if (!studentName) {
    studentName = localStorage.getItem("currentStudentName");
  } else {
    localStorage.setItem("currentStudentName", studentName);
  }

  if (!studentName) {
    console.warn("[Student] No name found, cannot init portal");
    const hubTitle = document.getElementById("hub-title");
    if (hubTitle) hubTitle.textContent = "Please go back and log in again.";
    return;
  }

  const nameDisplay = document.getElementById("student-name-display");
  if (nameDisplay) nameDisplay.textContent = studentName;

  const studentId = slugifyName(studentName);
  const studentRef = doc(db, "students", studentId);

  // Ensure profile exists
  setDoc(
    studentRef,
    {
      name: studentName,
      stars: 0,
      updatedAt: Date.now(),
    },
    { merge: true }
  ).catch((err) => console.error("Error creating student profile", err));

  // Hero Stars subscription
  const starsEl = document.getElementById("hero-stars-count");
  onSnapshot(studentRef, (snap) => {
    const data = snap.data();
    if (data && starsEl) {
      starsEl.textContent = data.stars || 0;
    }
  });

  // Announcements & Homework lists
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
        const card = document.createElement("div");
        card.className = "ev-card-bubble";
        card.innerHTML = `
          <h4>${data.title || "Untitled"}</h4>
          <p>${data.message || ""}</p>
          <p class="helper-text">Posted: ${new Date(
            data.createdAt || Date.now()
          ).toLocaleString()}</p>
        `;
        announcementList.appendChild(card);
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
        const card = document.createElement("div");
        card.className = "ev-card-bubble";

        const links = data.links || (data.link ? [data.link] : []);
        const linksHtml = links
          .map(
            (url, idx) =>
              `<li><a href="${url}" target="_blank">Link ${idx + 1}</a></li>`
          )
          .join("");

        card.innerHTML = `
          <h4>${data.title || "Untitled"}</h4>
          ${
            linksHtml
              ? `<ul class="ev-link-list">${linksHtml}</ul>`
              : "<p>No links provided.</p>"
          }
          <p class="helper-text">
            ${data.level ? "Level: " + data.level + " • " : ""}Posted:
            ${new Date(data.createdAt || Date.now()).toLocaleString()}
          </p>
        `;
        homeworkList.appendChild(card);
      });
    });
  }

  // Ask a Question
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatWindow = document.getElementById("chat-window");
  const chatStatus = document.getElementById("chat-status");

  if (chatForm && chatInput && chatWindow) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      if (chatStatus) chatStatus.textContent = "Sending question...";

      try {
        await addDoc(collection(db, "questions"), {
          studentName,
          text,
          reply: "",
          createdAt: Date.now(),
          repliedAt: null,
        });
        chatInput.value = "";
        if (chatStatus) {
          chatStatus.textContent = "Question sent! Your teacher will reply soon.";
          setTimeout(() => (chatStatus.textContent = ""), 2500);
        }
      } catch (err) {
        console.error("Error sending question:", err);
        if (chatStatus) {
          chatStatus.textContent = "Error sending question. Please try again.";
        }
      }
    });

    // Subscribe to THIS student's questions
    const qQuery = query(
      collection(db, "questions"),
      where("studentName", "==", studentName),
      orderBy("createdAt", "asc")
    );

    onSnapshot(qQuery, (snapshot) => {
      chatWindow.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        // Student bubble
        const rowS = document.createElement("div");
        rowS.className = "chat-row chat-row-student";
        rowS.innerHTML = `
          <div class="chat-bubble chat-bubble-student">
            <div class="chat-text">${data.text || ""}</div>
            <div class="chat-time">${formatTimeLabel(data.createdAt)}</div>
          </div>
        `;
        chatWindow.appendChild(rowS);

        // Teacher reply bubble
        if (data.reply) {
          const rowT = document.createElement("div");
          rowT.className = "chat-row chat-row-teacher";
          rowT.innerHTML = `
            <div class="chat-bubble chat-bubble-teacher">
              <div class="chat-text">${data.reply}</div>
              <div class="chat-time">${formatTimeLabel(
                data.repliedAt || data.createdAt
              )}</div>
            </div>
          `;
          chatWindow.appendChild(rowT);
        }
      });

      chatWindow.scrollTop = chatWindow.scrollHeight;
    });
  }
}

document.addEventListener("DOMContentLoaded", initStudentPortal);
