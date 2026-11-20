﻿import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
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
// ===== Card Layout Manager =====
const ALL_CARDS = [
  { id: 'ROUTINE',    name: 'Exam Routine',       icon: 'fa-calendar-days',        cat: 'academic' },
  { id: 'SUG',        name: 'Suggestions',        icon: 'fa-lightbulb',            cat: 'study' },
  { id: 'NOTES',      name: 'Notes',              icon: 'fa-book-open',            cat: 'study' },
  { id: 'DSA2',       name: 'DSA 2',              icon: 'fa-sitemap',              cat: 'subjects' },
  { id: 'SE',         name: 'Software Engg',      icon: 'fa-diagram-project',      cat: 'subjects' },
  { id: 'MATH',       name: 'Complex Variables',  icon: 'fa-square-root-variable', cat: 'subjects' },
  { id: 'NUM',        name: 'Numerical Methods',  icon: 'fa-calculator',           cat: 'subjects' },
  { id: 'DCOM',       name: 'Data Comm.',         icon: 'fa-network-wired',        cat: 'subjects' },
  { id: 'IPLAB',      name: 'Internet Prog. Lab', icon: 'fa-globe',                cat: 'subjects' },
  { id: 'VAULT',      name: 'Note Vault',         icon: 'fa-key',                  cat: 'personal' },
  { id: 'UPDATE',     name: 'Update Files',       icon: 'fa-cloud-arrow-up',       cat: 'personal' },
  { id: 'CLSROUTINE', name: 'Class Routine',      icon: 'fa-table-list',           cat: 'academic' },
  { id: 'COURSES',    name: 'Upcoming Courses',   icon: 'fa-graduation-cap',       cat: 'academic' },
  { id: 'FACULTY',    name: 'Faculty List',       icon: 'fa-chalkboard-user',      cat: 'academic' },
  { id: 'CLASSROOM',  name: 'Classroom Code',     icon: 'fa-hashtag',              cat: 'academic' },
  { id: 'GCLASSROOM', name: 'Google Classroom',   icon: 'fa-chalkboard',           cat: 'academic' },
  { id: 'PQS',        name: 'PQ Solutions',       icon: 'fa-scroll',               cat: 'study' },
  { id: 'BOOKS',      name: 'Books',              icon: 'fa-book',                 cat: 'study' },
  { id: 'LINKS',      name: 'Reference Links',    icon: 'fa-link',                 cat: 'study' },
  { id: 'HACKATHON',  name: 'Upcoming Hackathon', icon: 'fa-laptop-code',          cat: 'competitive' },
  { id: 'CP',         name: 'Upcoming CP',        icon: 'fa-trophy',               cat: 'competitive' }
];

let cardLayout = null;   // [{id, hidden}]
let dragIndex = null;

function buildLayoutFromConfig(saved) {
  // saved = array of {id, hidden} from Firebase (may be null/outdated)
  const result = [];
  const seen = new Set();
  if (Array.isArray(saved)) {
    saved.forEach(s => {
      if (ALL_CARDS.find(c => c.id === s.id) && !seen.has(s.id)) {
        result.push({ id: s.id, hidden: !!s.hidden });
        seen.add(s.id);
      }
    });
  }
  // new cards that aren't saved yet go to the end (visible)
  ALL_CARDS.forEach(c => {
    if (!seen.has(c.id)) result.push({ id: c.id, hidden: false });
  });
  return result;
}

window.renderCardLayout = function () {
  const box = document.getElementById('cardLayoutList');
  if (!box || !cardLayout) return;
  box.innerHTML = '';

  cardLayout.forEach((entry, index) => {
    const meta = ALL_CARDS.find(c => c.id === entry.id);
    if (!meta) return;

    const row = document.createElement('div');
    row.className = 'layout-row' + (entry.hidden ? ' is-hidden' : '');
    row.draggable = true;
    row.dataset.index = index;

    row.innerHTML = `
      <span class="layout-handle"><i class="fa-solid fa-grip-vertical"></i></span>
      <div class="layout-icon"><i class="fa-solid ${meta.icon}"></i></div>
      <div class="layout-name">${meta.name}</div>
      <span class="layout-cat">${meta.cat}</span>
      <button class="layout-btn" title="Move up" onclick="moveCard(${index}, -1)"><i class="fa-solid fa-arrow-up"></i></button>
      <button class="layout-btn" title="Move down" onclick="moveCard(${index}, 1)"><i class="fa-solid fa-arrow-down"></i></button>
      <button class="layout-btn ${entry.hidden ? 'eye-off' : 'eye-on'}" title="${entry.hidden ? 'Show' : 'Hide'}" onclick="toggleCardHidden(${index})">
        <i class="fa-solid ${entry.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
      </button>
    `;

    // Drag & drop (desktop)
    row.addEventListener('dragstart', (e) => {
      dragIndex = index;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      document.querySelectorAll('.layout-row').forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === index) return;
      const moved = cardLayout.splice(dragIndex, 1)[0];
      cardLayout.splice(index, 0, moved);
      dragIndex = null;
      window.renderCardLayout();
    });

    box.appendChild(row);
  });
};

window.moveCard = function (index, dir) {
  const target = index + dir;
  if (target < 0 || target >= cardLayout.length) return;
  const tmp = cardLayout[index];
  cardLayout[index] = cardLayout[target];
  cardLayout[target] = tmp;
  window.renderCardLayout();
};

window.toggleCardHidden = function (index) {
  cardLayout[index].hidden = !cardLayout[index].hidden;
  window.renderCardLayout();
};

window.saveCardLayout = async function () {
  const btn = document.getElementById('saveLayoutBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  try {
    await set(ref(db, 'portalConfig/cards'), cardLayout);
    alert('Layout saved! User section e live update hoye jabe.');
  } catch (err) {
    alert('Save failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Layout';
  }
};

window.resetCardLayout = function () {
  if (!confirm('Default order e ferot jabe (shob card visible). Sure?')) return;
  cardLayout = ALL_CARDS.map(c => ({ id: c.id, hidden: false }));
  window.renderCardLayout();
};
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
    
    onValue(ref(db, 'portalData'), (snapshot) => {
      if (snapshot.val()) dbData = snapshot.val();
      window.renderItems();
    });

    // Live stats & device tracking
    onValue(ref(db, 'presence/active'), (snap) => {
      const data = snap.val() || {};
      const count = snap.exists() ? Object.keys(data).length : 0;
      const el = document.getElementById('statActiveNow');
      if(el) el.textContent = count;

      // Update active devices list
      const devicesBox = document.getElementById('activeDevicesList');
      if (devicesBox) {
        const entries = Object.values(data);
        if (entries.length === 0) {
          devicesBox.innerHTML = '<span style="color:#8b949e; font-size:0.85em;">No active visitors</span>';
        } else {
          devicesBox.innerHTML = entries.map(item => {
            const icon = item.device === 'Mobile' ? 'fa-mobile-screen' : (item.device === 'Tablet' ? 'fa-tablet-screen-button' : 'fa-laptop');
            const os = escapeHtml(item.os || 'Unknown OS');
            const browser = escapeHtml(item.browser || 'Browser');
            return `<span style="display:inline-flex; align-items:center; gap:6px; background:rgba(86,211,100,0.1); border:1px solid rgba(86,211,100,0.25); color:#56d364; border-radius:20px; padding:4px 10px; font-size:0.8em;"><i class="fa-solid ${icon}"></i> ${os} · ${browser}</span>`;
          }).join('');
        }
      }
    });

    onValue(ref(db, 'stats/totalVisits'), (snap) => {
      const el = document.getElementById('statTotalVisits');
      if(el) el.textContent = snap.exists() ? snap.val() : 0;
    });

    // Recent visitor logs
    onValue(ref(db, 'presence/history'), (snap) => {
      const logsBox = document.getElementById('visitorLogsList');
      const badge = document.getElementById('visitorCountBadge');
      if (!logsBox) return;
      if (!snap.exists()) {
        logsBox.innerHTML = '<div style="color:#8b949e; font-size:0.85em; text-align:center; padding:15px;">No visitor logs yet.</div>';
        if (badge) badge.textContent = '0 visits logged';
        return;
      }
      const raw = snap.val() || {};
      const list = Object.entries(raw)
        .map(([k, v]) => ({ id: k, ...v }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 40);

      if (badge) badge.textContent = `${list.length} recent visits`;

      logsBox.innerHTML = list.map(v => {
        const icon = v.device === 'Mobile' ? 'fa-mobile-screen' : (v.device === 'Tablet' ? 'fa-tablet-screen-button' : 'fa-laptop');
        const os = escapeHtml(v.os || 'Unknown OS');
        const browser = escapeHtml(v.browser || 'Browser');
        const screen = escapeHtml(v.screen || '');
        const isNew = !!v.isNew;
        const count = v.visitCount || 1;
        const refName = escapeHtml(v.referrer || 'Direct');
        const timeAgo = getTimeAgo(v.timestamp || Date.now());

        return `
          <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-color); border:1px solid var(--border-color); border-radius:8px; padding:8px 12px; font-size:0.85em; gap:8px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:10px;">
              <i class="fa-solid ${icon}" style="color:var(--accent-purple); font-size:1.1em; width:16px; text-align:center;"></i>
              <div>
                <span style="font-weight:600; color:var(--text-main);">${os} · ${browser}</span>
                ${screen ? `<span style="color:#8b949e; font-size:0.85em; margin-left:6px;">(${screen})</span>` : ''}
                <span style="color:#8b949e; font-size:0.8em; margin-left:6px;"><i class="fa-solid fa-arrow-turn-down-right" style="font-size:0.7em;"></i> ${refName}</span>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:0.75em; padding:2px 8px; border-radius:12px; background:${isNew ? 'rgba(63,185,80,0.15)' : 'rgba(163,113,247,0.15)'}; color:${isNew ? '#56d364' : '#a371f7'};">
                ${isNew ? 'New Visitor' : 'Visit #' + count}
              </span>
              <span style="color:#8b949e; font-size:0.8em;">${timeAgo}</span>
            </div>
          </div>`;
      }).join('');
    });

    // Card layout config
    onValue(ref(db, 'portalConfig/cards'), (snap) => {
      cardLayout = buildLayoutFromConfig(snap.val());
      window.renderCardLayout();
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

    const isSecretCategory = category === 'SECRETC' || category === 'secret' || /secret/i.test(category);
    if (!isSecretCategory) {
      await push(ref(db, 'notifications'), {
        category: category,
        title: valToSave.title || 'Update',
        timestamp: Date.now()
      });
    }

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

// Clean up any accidentally pushed secret notifications from database
onValue(ref(db, 'notifications'), (snap) => {
  const val = snap.val();
  if (val) {
    Object.entries(val).forEach(([id, n]) => {
      if (n && (n.category === 'SECRETC' || /secret/i.test(n.category || '') || /section c/i.test(n.title || ''))) {
        remove(ref(db, `notifications/${id}`)).catch(() => {});
      }
    });
  }
}, { onlyOnce: true });

// ===== Secret Section C password =====
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

window.setSecretPass = async function () {
  const input = document.getElementById('secretPassNew');
  const pass = input.value.trim();
  if (pass.length < 4) return alert('Kom-pokkhe 4 character dao.');
  try {
    await set(ref(db, 'portalConfig/secretHash'), await sha256(pass));
    input.value = '';
    alert('Password set hoyeche!');
  } catch (err) {
    alert('Failed: ' + err.message);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}
