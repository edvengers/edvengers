// app-student.js (Safe Restoration)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
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
let currentStudent = null;

// OVERLAY & CONFETTI
window.openMission = function(url) {
  document.getElementById("mission-overlay").classList.remove("hidden");
  document.getElementById("mission-frame").src = url;
};
window.closeMission = function() {
  document.getElementById("mission-overlay").classList.add("hidden");
  document.getElementById("mission-frame").src = "";
  if(typeof confetti === 'function') confetti({particleCount:100, spread:70, origin:{y:0.6}});
};

// LOGIN
document.getElementById("student-login-form").addEventListener("submit", async(e)=>{
  e.preventDefault();
  const name = document.getElementById("login-name").value.trim();
  const pwd = document.getElementById("login-password").value.trim();
  const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

  try {
    const snap = await getDoc(doc(db, "students", id));
    if(!snap.exists()) throw new Error("Account not found.");
    const data = snap.data();
    if(data.password !== pwd) throw new Error("Wrong password.");

    if(data.password === "heroes2026") {
      document.getElementById("student-login-section").style.display="none";
      document.getElementById("student-password-section").style.display="block";
      document.getElementById("change-password-form").onsubmit = async(ev)=>{
        ev.preventDefault();
        const newP = document.getElementById("new-password").value;
        await updateDoc(doc(db, "students", id), {password:newP});
        initHub({id, ...data});
      };
    } else {
      initHub({id, ...data});
    }
  } catch(err) { alert(err.message); }
});

function initHub(student) {
  currentStudent = student;
  document.getElementById("student-login-section").style.display="none";
  document.getElementById("student-password-section").style.display="none";
  document.getElementById("student-hub-section").style.display="block";

  document.getElementById("student-name-display").textContent = student.name;
  document.getElementById("profile-name").textContent = student.name;
  document.getElementById("profile-level").textContent = student.level || "-";
  
  // Live Stars
  onSnapshot(doc(db, "students", student.id), (snap) => {
    if(snap.exists()) document.getElementById("hero-stars-count").textContent = snap.data().stars || 0;
  });

  // Attendance
  const attBtn = document.getElementById("btn-attendance");
  attBtn.onclick = async function() {
    this.disabled = true; this.textContent = "Marked! ✅";
    if(typeof confetti === 'function') confetti();
    const h = document.getElementById("flying-hero");
    h.classList.remove("hidden"); h.classList.add("fly-across");
    setTimeout(()=>h.classList.add("hidden"), 2600);
    
    await addDoc(collection(db, "chats", student.id, "messages"), {
      sender:"student", text:"🔴 CHECK-IN", createdAt:Date.now()
    });
    await setDoc(doc(db, "students", student.id), {hasUnread:true}, {merge:true});
  };

  // Announcements
  const annDiv = document.getElementById("student-announcements");
  onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap)=>{
    annDiv.innerHTML="";
    let list = [];
    snap.forEach(d => list.push(d.data()));
    list.sort((a,b) => (a.isPinned===b.isPinned)? 0 : a.isPinned? -1 : 1);
    list.forEach(d => {
       const pin = d.isPinned ? "📌 " : "";
       const cls = d.isPinned ? "pinned-item" : "";
       annDiv.innerHTML += `<div class="ev-card-bubble ${cls}"><h4>${pin}${d.title}</h4><p>${d.message}</p></div>`;
    });
  });

  // Homework
  const hwDiv = document.getElementById("student-homework-list");
  onSnapshot(query(collection(db, "homework"), orderBy("postedAt", "desc")), (snap)=>{
    hwDiv.innerHTML="";
    snap.forEach(doc => {
      const d = doc.data();
      const links = (d.links||[]).map(l => `<li><button class="btn-link" onclick="openMission('${l.url}')">🔗 ${l.name}</button></li>`).join("");
      hwDiv.innerHTML += `<div class="ev-card-bubble"><h4>${d.title}</h4><ul>${links}</ul></div>`;
    });
  });

  // Chat
  const chatWin = document.getElementById("chat-window");
  onSnapshot(query(collection(db, "chats", student.id, "messages"), orderBy("createdAt")), (snap)=>{
    chatWin.innerHTML="";
    snap.forEach(d => {
      const m = d.data();
      const cls = m.sender==="student"?"chat-bubble-me":"chat-bubble-other";
      const align = m.sender==="student"?"chat-row-right":"chat-row-left";
      const img = m.imageUrl ? `<img src="${m.imageUrl}">` : "";
      chatWin.innerHTML += `<div class="chat-row ${align}"><div class="chat-bubble ${cls}">${m.text||""}${img}</div></div>`;
    });
    chatWin.scrollTop = chatWin.scrollHeight;
  });

  document.getElementById("chat-form").onsubmit = async(e)=>{
    e.preventDefault();
    const txt = document.getElementById("chat-input").value;
    const file = document.getElementById("chat-image").files[0];
    if(!txt && !file) return;
    
    let url = null;
    if(file) {
      const ref = storageRef(storage, `chat/${student.id}/${Date.now()}`);
      await uploadBytes(ref, file);
      url = await getDownloadURL(ref);
    }
    await addDoc(collection(db, "chats", student.id, "messages"), {
      sender:"student", text:txt, imageUrl:url, createdAt:Date.now()
    });
    await setDoc(doc(db, "students", student.id), {hasUnread:true}, {merge:true});
    document.getElementById("chat-input").value="";
  };
}