import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
const TEACHER_PASSWORD = "kalb25";

// OVERLAY
window.openMission = function(url) {
  document.getElementById("mission-overlay").classList.remove("hidden");
  document.getElementById("mission-frame").src = url;
};
window.closeMission = function() {
  document.getElementById("mission-overlay").classList.add("hidden");
  document.getElementById("mission-frame").src = "";
};

// LOGIN
document.getElementById("teacher-login-form").addEventListener("submit", (e)=>{
    e.preventDefault();
    if(document.getElementById("teacher-password").value === TEACHER_PASSWORD) {
        document.getElementById("teacher-login-section").style.display="none";
        document.getElementById("teacher-dashboard-section").style.display="block";
    } else { alert("Wrong password"); }
});

// BOOKLET
document.getElementById("booklet-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    const url = document.getElementById("booklet-url").value;
    await setDoc(doc(db, "config", "booklet"), { url: url });
    alert("Game Link Updated!");
});

// STUDENTS
document.getElementById("students-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    const name = document.getElementById("student-name").value;
    const id = name.toLowerCase().replace(/\s+/g, "-");
    await setDoc(doc(db, "students", id), { name, password:"heroes2026", stars:0 }, {merge:true});
    alert("Student Created");
});

// ANNOUNCEMENTS
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

// HOMEWORK
document.getElementById("homework-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    const links = [{
        url: document.getElementById("homework-link-1").value,
        name: document.getElementById("homework-name-1").value || "Homework"
    }];
    await addDoc(collection(db, "homework"), {
        title: document.getElementById("homework-title").value,
        links, postedAt: Date.now()
    });
    alert("Homework Posted");
});

// CHAT LIST
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
        btn.onclick = () => openChat(d.id, s.name);
        chatList.appendChild(btn);
    });
});

function openChat(id, name) {
    currentChatId = id;
    updateDoc(doc(db, "students", id), {hasUnread:false});
    const win = document.getElementById("chat-thread");
    onSnapshot(query(collection(db, "chats", id, "messages"), orderBy("createdAt")), (snap)=>{
        win.innerHTML="";
        snap.forEach(d => {
            const m = d.data();
            const cls = m.sender==="teacher"?"chat-bubble-me":"chat-bubble-other";
            const align = m.sender==="teacher"?"chat-row-right":"chat-row-left";
            win.innerHTML += `<div class="chat-row ${align}"><div class="chat-bubble ${cls}">${m.text}</div></div>`;
        });
        win.scrollTop = win.scrollHeight;
    });
}

document.getElementById("teacher-chat-form").addEventListener("submit", async(e)=>{
    e.preventDefault();
    if(!currentChatId) return;
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
        sender:"teacher", text:document.getElementById("teacher-chat-input").value, createdAt:Date.now()
    });
    document.getElementById("teacher-chat-input").value="";
});