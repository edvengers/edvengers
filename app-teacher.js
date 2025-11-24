// app-teacher.js (Safe Restoration)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhD_rigOfXWYGcj7ooUggG0H4oVtV9cDI",
  authDomain: "edvengers-portal.firebaseapp.com",
  projectId: "edvengers-portal",
  storageBucket: "edvengers-portal.firebasestorage.app",
  messagingSenderId: "825538244708",
  appId: "1:825538244708:web:5eb57d970a65433190ef71"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const TEACHER_PASSWORD = "kalb25";

// LOGIN
document.getElementById("teacher-login-form").addEventListener("submit", (e)=>{
    e.preventDefault();
    if(document.getElementById("teacher-password").value === TEACHER_PASSWORD) {
        document.getElementById("teacher-login-section").style.display="none";
        document.getElementById("teacher-dashboard-section").style.display="block";
    } else { alert("Wrong password"); }
});

// --- STUDENTS & HERO POINTS ---
let studentsCache = [];
let selectedStudentId = null;
const studentsSelect = document.getElementById("student-select");
const studentsList = document.getElementById("students-list");

onSnapshot(query(collection(db, "students"), orderBy("name")), (snap)=>{
    studentsCache = [];
    studentsSelect.innerHTML = '<option value="">-- Select --</option>';
    snap.forEach(d => {
        const s = {id:d.id, ...d.data()};
        studentsCache.push(s);
        studentsSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
});

studentsSelect.addEventListener("change", ()=>{
    selectedStudentId = studentsSelect.value;
    renderStudentRow();
});

function renderStudentRow() {
    studentsList.innerHTML = "";
    if(!selectedStudentId) return;
    const s = studentsCache.find(x => x.id === selectedStudentId);
    if(!s) return;

    studentsList.innerHTML = `
      <div class="ev-card-bubble student-row">
        <div>
          <strong style="font-size:1.1rem;">${s.name}</strong><br>
          <span class="helper-text">Current Points: <strong style="color:gold">${s.stars||0}</strong></span>
        </div>
        <div class="student-actions">
          <button class="btn-small" onclick="modPoints('${s.id}', 1)">+1</button>
          <button class="btn-small" onclick="modPoints('${s.id}', 5)">+5</button>
          <button class="btn-small" style="background:red" onclick="modPoints('${s.id}', -${s.stars})">Reset</button>
        </div>
      </div>
    `;
}

window.modPoints = async function(id, delta) {
    await updateDoc(doc(db, "students", id), { stars: increment(delta) });
};

document.getElementById("students-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    const name = document.getElementById("student-name").value;
    const id = name.toLowerCase().replace(/\s+/g, "-");
    const level = document.getElementById("student-level").value;
    await setDoc(doc(db, "students", id), { 
        name, level, subjects:["P"+level.slice(1)+" Math"], password:"heroes2026", stars:0 
    }, {merge:true});
    alert("Student Created");
});

// --- ANNOUNCEMENTS ---
const annList = document.getElementById("announcement-list");
onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap)=>{
    annList.innerHTML="";
    snap.forEach(d => {
        const a = d.data();
        const pin = a.isPinned ? "📌" : "";
        annList.innerHTML += `<div class="ev-card-bubble"><h4>${pin} ${a.title}</h4><p>${a.message}</p></div>`;
    });
});

document.getElementById("announcement-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    await addDoc(collection(db, "announcements"), {
        title: document.getElementById("announcement-title").value,
        message: document.getElementById("announcement-message").value,
        isPinned: document.getElementById("announcement-pinned").checked,
        createdAt: Date.now()
    });
    alert("Posted");
});

// --- HOMEWORK ---
const hwList = document.getElementById("homework-list");
onSnapshot(query(collection(db, "homework"), orderBy("postedAt", "desc")), (snap)=>{
    hwList.innerHTML="";
    snap.forEach(d => {
        const h = d.data();
        hwList.innerHTML += `<div class="ev-card-bubble"><h4>${h.title}</h4></div>`;
    });
});

document.getElementById("homework-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    const links = [{
        url: document.getElementById("homework-link-1").value,
        name: document.getElementById("homework-name-1").value || "Link"
    }];
    await addDoc(collection(db, "homework"), {
        title: document.getElementById("homework-title").value,
        description: document.getElementById("homework-description").value,
        links, postedAt: Date.now()
    });
    alert("Homework Posted");
});

// --- CHAT ---
const chatList = document.getElementById("chat-student-list");
let currentChatId = null;
onSnapshot(collection(db, "students"), (snap)=>{
    chatList.innerHTML="";
    snap.forEach(d => {
        const s = d.data();
        const dot = s.hasUnread ? "🔴" : "";
        const btn = document.createElement("button");
        btn.className = "chat-student-item";
        btn.innerHTML = `${s.name} ${dot}`;
        btn.onclick = () => openChat(d.id);
        chatList.appendChild(btn);
    });
});

function openChat(id) {
    currentChatId = id;
    updateDoc(doc(db, "students", id), {hasUnread:false});
    const win = document.getElementById("chat-thread");
    onSnapshot(query(collection(db, "chats", id, "messages"), orderBy("createdAt")), (snap)=>{
        win.innerHTML="";
        snap.forEach(d => {
            const m = d.data();
            const cls = m.sender==="teacher"?"chat-bubble-me":"chat-bubble-other";
            const align = m.sender==="teacher"?"chat-row-right":"chat-row-left";
            const img = m.imageUrl ? `<img src="${m.imageUrl}">` : "";
            win.innerHTML += `<div class="chat-row ${align}"><div class="chat-bubble ${cls}">${m.text||""}${img}</div></div>`;
        });
        win.scrollTop = win.scrollHeight;
    });
}

document.getElementById("teacher-chat-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    if(!currentChatId) return;
    const txt = document.getElementById("teacher-chat-input").value;
    if(!txt) return;
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
        sender:"teacher", text:txt, createdAt:Date.now()
    });
    document.getElementById("teacher-chat-input").value="";
});