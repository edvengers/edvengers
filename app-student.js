// app-student.js
// Student side: login + hub + stars + announcements + homework + Q&A

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

let currentStudentName = null;
let questionsUnsub = null;

async function handleLogin(name, password, showError) {
  const trimmedName = name.trim();
  const trimmedPwd = password.trim();
  if (!trimmedName || !trimmedPwd) {
    showError("Please enter both name and password.");
    return null;
  }

  const id = slugifyName(trimmedName);
  const ref = doc(db, "students", id);
  const snap = await getDoc(ref);

  // If student does not exist yet:
  if (!snap.exists()) {
    // Only allow creation with default password
    if (trimmedPwd !== "heroes2026") {
      showError("Account not found. Please check with your teacher.");
      return null;
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

    return trimmedName;
  }

  const data = snap.data();
  if (!data.password || data.password !== trimmedPwd) {
    showError("Incorrect password. Please try again or ask your teacher.");
    return null;
  }

  return trimmedName;
}

function enterHub(name) {
  currentStudentName = name;
  localStorage.setItem("edvengerStudentName", name);

  const loginSection = document.getElementById("student-login-section");
  const hubSection = document.getElementById("student-hub-section");
  if (loginSection) loginSection.style.display = "none";
  if (hubSection) hubSection.style.display = "block";

  const nameDisplay = document.getElementById("student-name-display");
  const detailsName = document.getElementById("details-name");
  if (nameDisplay) nameDisplay.textContent = name;
  if (detailsName) detailsName.textContent = name;

  initHubData(name);
}

function initHubData(name) {
  const id = slugifyName(name);
  const studentRef = doc(db, "students", id);

  // Ensure profile exists
  setDoc(
    studentRef,
    {
      name,
      updatedAt: Date.now(),
    },
    { merge: true }
  ).catch((err) => console.error("Error creating profile:", err));

  // Hero Stars
  const starsEl = document.getElementById("hero-stars-count");
  onSnapshot(studentRef, (snap) => {
    const data = snap.data();
    if (data && starsEl) {
      starsEl.textContent = data.stars || 0;
    }
  });

  // Announcements
  const announcementList = document.getElementById("announcement-list");
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

  // Homework
  const homeworkList = document.getElementById("homework-list");
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

  // Questions (per student)
  const chatWindow = document.getElementById("chat-window");
  if (questionsUnsub) questionsUnsub();

  const qQuery = query(
    collection(db, "questions"),
    where("studentName", "==", name),
    orderBy("createdAt", "asc")
  );
  questionsUnsub = onSnapshot(qQuery, (snapshot) => {
    if (!chatWindow) return;
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

  // Send question
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatStatus = document.getElementById("chat-status");

  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      if (chatStatus) chatStatus.textContent = "Sending question...";

      try {
        await addDoc(collection(db, "questions"), {
          studentName: name,
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
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("edvengerStudentName");
  const loginSection = document.getElementById("student-login-section");
  const hubSection = document.getElementById("student-hub-section");

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

  if (savedName && hubSection && loginSection) {
    loginSection.style.display = "none";
    hubSection.style.display = "block";
    enterHub(savedName);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = "none";

      const name = document.getElementById("login-name").value;
      const pwd = document.getElementById("login-password").value;

      try {
        const resultName = await handleLogin(name, pwd, showError);
        if (resultName) {
          enterHub(resultName);
        }
      } catch (err) {
        console.error(err);
        showError("Login failed. Please try again.");
      }
    });
  }
});
