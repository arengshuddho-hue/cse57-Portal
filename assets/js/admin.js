﻿import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0WsZH_YyuPADXO525pOkCjaXwDCGCxpc",
  authDomain: "cse-57-portal.firebaseapp.com",
  databaseURL: "https://cse-57-portal-default-rtdb.firebaseio.com",
  projectId: "cse-57-portal",
  storageBucket: "cse-57-portal.firebasestorage.app",
  messagingSenderId: "316724142018",
  appId: "1:316724142018:web:384027899f55a50f88805b",
  measurementId: "G-MY3ZVBD1SZ"
};

const CLOUDINARY_CLOUD_NAME = "dwvomd7wd";
const CLOUDINARY_UPLOAD_PRESET = "CSE57C";

const CLASSROOM_SYNC_URL = "https://script.google.com/macros/s/AKfycbyNvAY1Ute23pNAMk8BX2W0ZV9fYgZs_Icq12Vx-v_FxrScVUgzto-TGCDTWbzY8QrX/exec";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let dbData = {};

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
    
    onValue(ref(db, 'portalData'), (snapshot) => {
      if (snapshot.val()) dbData = snapshot.val();
      window.renderItems();
    });

    // Live stats: active visitors + total visits
    onValue(ref(db, 'presence'), (snap) => {
      const count = snap.exists() ? Object.keys(snap.val()).length : 0;
      const el = document.getElementById('statActiveNow');
      if(el) el.textContent = count;
    });

    onValue(ref(db, 'stats/totalVisits'), (snap) => {
      const el = document.getElementById('statTotalVisits');
      if(el) el.textContent = snap.exists() ? snap.val() : 0;
    });
  } else {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('adminScreen').style.display = 'none';
  }
});

window.login = function() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('password').value;
  
  if(!email || !pass) return alert("Please enter both Email and Password!");
  
  document.getElementById('loading').style.display = 'block';
  
  signInWithEmailAndPassword(auth, email, pass)
    .then((userCredential) => {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('password').value = ''; 
    })
    .catch((error) => {
      document.getElementById('loading').style.display = 'none';
      alert("Login Failed: " + error.message);
    });
};

window.logout = function() {
  signOut(auth).then(() => {
    alert("Logged out successfully!");
  });
};

window.toggleInputMode = function() {
  const type = document.getElementById('itemType').value;
  const linkWrap = document.getElementById('linkInputWrap');
  const fileWrap = document.getElementById('fileInputWrap');

  if (type === 'upload') {
    linkWrap.style.display = 'none';
    fileWrap.style.display = 'block';
  } else {
    linkWrap.style.display = 'block';
    fileWrap.style.display = 'none';
  }
};

async function uploadFileToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const isPdf = file.type === 'application/pdf';
  const resourceType = isPdf ? 'raw' : 'auto';

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Upload failed');
  }

  const data = await res.json();
  return data.secure_url;
}

window.renderItems = function() {
  const category = document.getElementById('categorySelect').value;
  const items = dbData[category] || [];
  const listEl = document.getElementById('itemList');
  
  if(category === 'TICKER') {
    document.getElementById('itemType').disabled = true;
    document.getElementById('itemTitle').placeholder = "(Not needed for Ticker)";
    document.getElementById('itemContent').placeholder = "Enter scrolling text message here...";
  } else {
    document.getElementById('itemType').disabled = false;
    document.getElementById('itemTitle').placeholder = "Enter title to display";
    document.getElementById('itemContent').placeholder = "Paste your link here, or write your text...";
  }
  
  listEl.innerHTML = '';
  if (items.length === 0) {
    listEl.innerHTML = '<div style="color:#888; text-align:center; padding: 20px;">No items found.</div>';
    return;
  }
  
  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'item';
    
    let displayStr = '';
    if (typeof item === 'string') {
      displayStr = `<span style="color:#888;">[Legacy Data]</span> ${item}`;
    } else {
      const typeIcon = item.type === 'link' ? '🔗' : item.type === 'text' ? '📝' : item.type === 'image' ? '🖼️' : item.type === 'file' ? '📤' : '🔢';
      displayStr = `<strong>${item.title || '(No Title)'}</strong> <span style="color:#888; font-size:12px;">${typeIcon} ${item.type || 'Ticker'}</span><br><small style="color:#aaa;">${item.content}</small>`;
    }
    
    div.innerHTML = `
      <div class="item-content">${displayStr}</div>
      <button class="btn btn-danger" onclick="deleteItem('${category}', ${index})"><i class="fa-solid fa-trash"></i> Delete</button>
    `;
    listEl.appendChild(div);
  });
};

window.addItem = async function() {
  const category = document.getElementById('categorySelect').value;
  const type = document.getElementById('itemType').value;
  const title = document.getElementById('itemTitle').value.trim();

  if (category !== 'TICKER' && !title) return alert('Please provide a Title!');

  const saveBtn = document.getElementById('saveBtn');
  let valToSave;

  if (type === 'upload') {
    const fileInput = document.getElementById('itemFile');
    const file = fileInput.files[0];
    if (!file) return alert('Please choose a file to upload!');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

    try {
      const url = await uploadFileToCloudinary(file);
      const isPdf = file.type === 'application/pdf';
      valToSave = { type: isPdf ? 'file' : 'image', title, content: url };
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save to Database';
      return alert('Upload Failed: ' + err.message);
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save to Database';
    fileInput.value = '';
  } else {
    const content = document.getElementById('itemContent').value.trim();
    if (!content) return alert('Please provide Content or Link!');

    valToSave = { type, title, content };
    if (category === 'TICKER') {
      valToSave = { type: 'ticker', title: 'Notice', content: content };
    }
  }

   if (!dbData[category]) dbData[category] = [];
  dbData[category].push(valToSave);

  try {
    await set(ref(db, 'portalData'), dbData);

    await push(ref(db, 'notifications'), {
      category: category,
      title: valToSave.title || 'Update',
      timestamp: Date.now()
    });

    document.getElementById('itemTitle').value = '';
    document.getElementById('itemContent').value = '';
    alert('Item Added Successfully!');
  } catch (err) {
    alert('Something went wrong: ' + err.message);
  }
};
window.deleteItem = function(category, index) {
  if (confirm('Are you sure you want to delete this?')) {
    dbData[category].splice(index, 1);
    set(ref(db, 'portalData'), dbData);
  }
};

window.syncClassroom = async function() {
  const btn = document.getElementById('classroomSyncBtn');
  const resultBox = document.getElementById('classroomSyncResult');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
  resultBox.innerHTML = '';

  try {
    const res = await fetch(CLASSROOM_SYNC_URL);
    if (!res.ok) throw new Error('Server error (' + res.status + ')');
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Sync failed');

    const allItems = data.newItems || [];
    const newItems = allItems.filter(item => !item.error && item.content);
    const errorItems = allItems.filter(item => item.error);

    if (newItems.length === 0 && errorItems.length === 0) {
      resultBox.innerHTML = '<div style="padding:12px 16px; border-radius:8px; background:rgba(88,166,255,0.08); color:#58a6ff; font-size:0.85em;"><i class="fa-solid fa-circle-check"></i> No new materials found. Everything is up to date.</div>';
    } else {
      newItems.forEach(item => {
        const cat = item.category || 'GCLASSROOM';
        if (!dbData[cat]) dbData[cat] = [];
         dbData[cat].unshift({
          type: item.type || 'link',
          title: item.title,
          content: item.content
        });
      });

      if (newItems.length > 0) {
        await set(ref(db, 'portalData'), dbData);

        await push(ref(db, 'notifications'), {
          category: 'GCLASSROOM',
          title: newItems.length + ' new Classroom material(s)',
          timestamp: Date.now()
        });
      }

      let html = '';
      if (newItems.length > 0) {
        html += '<div style="padding:12px 16px; border-radius:8px; background:rgba(63,185,80,0.08); color:#56d364; font-size:0.85em; margin-bottom:8px;"><i class="fa-solid fa-circle-check"></i> Synced ' + newItems.length + ' new item(s) successfully!</div>';
      }
      if (errorItems.length > 0) {
        html += '<div style="padding:12px 16px; border-radius:8px; background:rgba(248,81,73,0.08); color:#f85149; font-size:0.85em;"><i class="fa-solid fa-circle-exclamation"></i> ' + errorItems.length + ' item(s) failed to sync (check console for details).</div>';
        console.warn('Classroom sync errors:', errorItems);
      }
      resultBox.innerHTML = html;

      const currentCat = document.getElementById('categorySelect').value;
      if (newItems.some(item => (item.category || 'GCLASSROOM') === currentCat)) {
        window.renderItems();
      }
    }

  } catch (err) {
    console.error(err);
    resultBox.innerHTML = '<div style="padding:12px 16px; border-radius:8px; background:rgba(248,81,73,0.08); color:#f85149; font-size:0.85em;"><i class="fa-solid fa-circle-exclamation"></i> Sync failed: ' + err.message + '</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync from Classroom';
  }
};
