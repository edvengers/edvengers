// app-teacher.js
// Handles teacher side:
// - Realtime announcements + homework (if elements exist)
// - Student profiles (students collection) + Hero Stars
// - Grouped student questions + replies (questions collection)

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

// Firebase config
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

// DOM refs (some may be null depending on which sections exist)
const announcementForm = document.getElementById("announcement-form");
const announcementList = document.getElementById("announcement-list");

const homeworkForm = document.getElementById("homework-form");
const homeworkList = document.getElementById("homework-list");

const studentsForm = document.getElementById("students-form");
const studentsList = document.getElementById("students-list");
const studentsSelect = document.getElementById("student-select");

const questionsList = document.getElementById("questions-list");

if (studentsSelect && document.getElementById("student-name")) {
  const nameInput = document.getElementById("student-name");
  studentsSelect.addEventListener("change", () => {
    if (studentsSelect.value) {
      nameInput.value = studentsSelect.value;
    }
  });
}

// Helpers
function slugifyName(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

function formatTimeLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// 1. ANNOUNCEMENTS (optional)

if (announcementForm) {
  announcementForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document
      .getElementById("announcement-title")
      .value.trim();
    const message = document
      .getElementById("announcement-message")
      .value.trim();

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

function renderAnnouncement(docSnap) {
  if (!announcementList) return;
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
}

function clearAnnouncements() {
  if (announcementList) announcementList.innerHTML = "";
}

// 2. HOMEWORK (optional)

if (homeworkForm) {
  homeworkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("homework-title").value.trim();
    const level = document.getElementById("homework-level").value.trim();

    const links = [];
    for (let i = 1; i <= 5; i++) {
      const input = document.getElementById(`homework-link-${i}`);
      if (input && input.value.trim()) {
        links.push(input.value.trim());
      }
    }

    if (!title || links.length === 0) return;

    try {
      await addDoc(collection(db, "homework"), {
        title,
        links,
        level,
        createdAt: Date.now(),
      });
      homeworkForm.reset();
    } catch (err) {
      console.error("Error adding homework:", err);
    }
  });
}

function renderHomework(docSnap) {
  if (!homeworkList) return;
  const data = docSnap.data();
  const item = document.createElement("div");
  item.className = "ev-card-bubble";

  const links = data.links || (data.link ? [data.link] : []);

  const linksHtml = links
    .map(
      (url, idx) =>
        `<li><a href="${url}" target="_blank">Link ${idx + 1}</a></li>`
    )
    .join("");

  item.innerHTML = `
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
  homeworkList.appendChild(item);
}

function clearHomework() {
  if (homeworkList) homeworkList.innerHTML = "";
}

// 3. STUDENTS & HERO STARS

if (studentsForm) {
  studentsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("student-name").value.trim();
    const level = document.getElementById("student-level").value.trim();
    const subjectsInput =
      document.getElementById("student-subjects").value.trim(); // e.g. "P5 Eng, P5 Math"

    if (!name) return;

    const id = slugifyName(name);
    const subjects = subjectsInput
      ? subjectsInput.split(",").map((s) => s.trim())
      : [];

    try {
      await setDoc(
        doc(db, "students", id),
        {
          name,
          level,
          subjects,
          stars: 0,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      studentsForm.reset();
    } catch (err) {
      console.error("Error saving student:", err);
    }
  });
}

function renderStudents(snapshot) {
  if (studentsSelect) {
    studentsSelect.innerHTML =
      '<option value="">-- New or type name below --</option>';
  }
  if (!studentsList) return;
  studentsList.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    // Fill dropdown
    if (studentsSelect && data.name) {
      const opt = document.createElement("option");
      opt.value = data.name;
      opt.textContent = data.name;
      studentsSelect.appendChild(opt);
    }

    // Existing row rendering (hero stars etc.) stays as I gave earlier…
    // (keep your current student-row creation + star buttons)
    // ...
  });

  // existing button listeners etc...
}

  // Attach star buttons
  studentsList.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const ref = doc(db, "students", id);
      try {
        if (action === "add1") {
          await updateDoc(ref, { stars: increment(1), updatedAt: Date.now() });
        } else if (action === "add5") {
          await updateDoc(ref, { stars: increment(5), updatedAt: Date.now() });
        } else if (action === "reset") {
          await updateDoc(ref, { stars: 0, updatedAt: Date.now() });
        }
      } catch (err) {
        console.error("Error updating stars:", err);
      }
    });
  });
}

// 4. STUDENT QUESTIONS + REPLIES

function renderQuestionsGrouped(snapshot) {
  if (!questionsList) return;
  questionsList.innerHTML = "";

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

  const studentNames = Object.keys(byStudent).sort((a, b) =>
    a.localeCompare(b)
  );

  studentNames.forEach((name) => {
    const questions = byStudent[name].sort(
      (a, b) => a.createdAt - b.createdAt
    );
    const total = questions.length;
    const unanswered = questions.filter((q) => !q.reply).length;

    const thread = document.createElement("details");
    thread.className = "teacher-student-thread";
   
    const summary = document.createElement("summary");
    summary.className = "teacher-student-summary";
    summary.innerHTML = `
      <span class="teacher-student-name">${name}</span>
      <span class="teacher-student-meta">
        ${total} msg${total > 1 ? "s" : ""}${
      unanswered > 0 ? ` • ${unanswered} pending` : ""
    }
      </span>
    `;
    thread.appendChild(summary);

    const card = document.createElement("div");
    card.className = "announcement teacher-thread-card";

    const chat = document.createElement("div");
    chat.className = "teacher-chat-thread";

    const messages = [];

    questions.forEach((q) => {
      messages.push({
        sender: "student",
        text: q.text,
        ts: q.createdAt,
        docId: q.id,
      });
      if (q.reply) {
        messages.push({
          sender: "teacher",
          text: q.reply,
          ts: q.repliedAt || q.createdAt + 1,
          docId: q.id,
        });
      }
    });

    messages.sort((a, b) => a.ts - b.ts);

    const studentMessages = messages.filter((m) => m.sender === "student");
    const lastStudent = studentMessages[studentMessages.length - 1] || null;
    const replyTargetDocId = lastStudent ? lastStudent.docId : null;

    messages.forEach((m) => {
      const row = document.createElement("div");
      row.className =
        "teacher-chat-row " +
        (m.sender === "student"
          ? "teacher-chat-row-student"
          : "teacher-chat-row-teacher");
      row.innerHTML = `
        <div class="teacher-chat-bubble">
          <div class="teacher-chat-text">${m.text}</div>
          <div class="teacher-chat-time">${formatTimeLabel(m.ts)}</div>
        </div>
      `;
      chat.appendChild(row);
    });

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

  // Attach reply handlers
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

// 5. REALTIME SUBSCRIPTIONS

function startRealtimeSubscriptions() {
  // Announcements
  if (announcementList) {
    const annQuery = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(annQuery, (snapshot) => {
      clearAnnouncements();
      snapshot.forEach(renderAnnouncement);
    });
  }

  // Homework
  if (homeworkList) {
    const hwQuery = query(
      collection(db, "homework"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(hwQuery, (snapshot) => {
      clearHomework();
      snapshot.forEach(renderHomework);
    });
  }

  // Students
  if (studentsList) {
    const stQuery = query(
      collection(db, "students"),
      orderBy("name", "asc")
    );
    onSnapshot(stQuery, (snapshot) => {
      renderStudents(snapshot);
    });
  }

  // Questions
  if (questionsList) {
    const qQuery = query(
      collection(db, "questions"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(qQuery, (snapshot) => {
      renderQuestionsGrouped(snapshot);
    });
  }
}

startRealtimeSubscriptions();
