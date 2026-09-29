// ===== Service Worker Registration (PWA) =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
}

try {
  const cached = localStorage.getItem('cse57_offline_data');
  if (cached) window.data = JSON.parse(cached);
} catch (e) {}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.data = window.data || {};

// Fetch Live Data
onValue(ref(db, 'portalData'), (snapshot) => {
  const liveData = snapshot.val();
  if (liveData) {
    window.data = liveData;
    build_ticker();
    try { localStorage.setItem('cse57_offline_data', JSON.stringify(window.data)); } catch (e) {}
    cacheFilesForOffline(window.data);
  }
});

// ===== Offline File Caching (PDFs, images) =====
const FILE_CACHE_NAME = 'cse57c-files-v1';

async function cacheFilesForOffline(data){
  if(!('caches' in window)) return;
  try {
    const cache = await caches.open(FILE_CACHE_NAME);
    const urls = new Set();

    Object.values(data).forEach(items => {
      if(!Array.isArray(items)) return;
      items.forEach(item => {
        const url = typeof item === 'string' ? item : (item.content || item.file || item.link || '');
        if(url && /^https?:\/\//i.test(url) && url.includes('cloudinary.com')){
          urls.add(url);
        }
      });
    });

    for(const url of urls){
      const already = await cache.match(url);
      if(already) continue;
      try {
        const res = await fetch(url, { mode: 'cors' });
        if(res.ok) await cache.put(url, res);
      } catch(e) {
        // এই URL cache করা গেল না — চুপচাপ স্কিপ
      }
    }
  } catch(e){
    console.error('File caching failed', e);
  }
}

async function openFileOfflineAware(url, ev){
  if(navigator.onLine) return;

  ev.preventDefault();
  try {
    const cache = await caches.open(FILE_CACHE_NAME);
    const cached = await cache.match(url);
    if(cached){
      const blob = await cached.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      alert('This file is not saved for offline use yet. Open it once while online, and it will be available offline next time.');
    }
  } catch(e){
    alert('This file could not be opened offline.');
  }
}

// Build Scrolling Ticker
function build_ticker(){
  const track = document.getElementById('ticker-track');
  let items = window.data['TICKER'] || [];
  
  if(items.length === 0) {
    items = [{ content: 'Welcome to CSE-57 Academic Portal!' }];
  }
  
  const doubled = [...items, ...items, ...items];
  track.innerHTML = doubled.map(t => {
    const text = typeof t === 'string' ? t : (t.text || t.content || '');
    return `<span class="ticker-item"><i class="fa-solid fa-bolt"></i>${text}</span><span style="color:var(--gold);opacity:0.35;padding:0 4px">&#9670;</span>`;
  }).join('');
}

// UI Functions
window.isDark = true;
window.toggle_theme = function(){
  window.isDark = !window.isDark;
  document.body.classList.toggle('dark', window.isDark);
  document.body.classList.toggle('light', !window.isDark);
}

// Modal Logic (Completely Upgraded)
const GCLASSROOM_SUBJECTS = [
  { key: 'GC_DSA_LAB', label: 'DSA Lab', icon: 'fa-flask' },
  { key: 'GC_DSA_THEORY', label: 'DSA II Theory', icon: 'fa-sitemap' },
  { key: 'GC_SE_THEORY', label: 'SE Theory', icon: 'fa-diagram-project' },
  { key: 'GC_SE_LAB', label: 'SE Lab', icon: 'fa-laptop-code' },
  { key: 'GC_DCOM_THEORY', label: 'Data Comm Theory', icon: 'fa-network-wired' },
  { key: 'GC_IPLAB', label: 'IP Lab', icon: 'fa-globe' }
];

window.openClassroomHub = function(){
  document.getElementById('m-title').textContent = 'Google Classroom';
  document.getElementById('m-code').textContent = 'Select a subject';
  document.getElementById('m-icon').className = 'fa-solid fa-chalkboard';

  const list = document.getElementById('m-pdfs');
  list.innerHTML = '';

  GCLASSROOM_SUBJECTS.forEach(sub => {
    const count = (window.data[sub.key] || []).length;
    const div = document.createElement('div');
    div.className = 'pdf-item';
    div.style.cursor = 'pointer';
    div.innerHTML = `<div class="fi"><i class="fa-solid ${sub.icon}"></i></div><span class="pdf-label">${sub.label}</span><span class="pdf-num">${count}</span><i class="fa-solid fa-arrow-right pdf-arrow"></i>`;
    div.onclick = () => window.open_modal(sub.label, 'Google Classroom', sub.key, sub.icon);
    list.appendChild(div);
  });

  document.getElementById('overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
window.open_modal = function(name, code, key, icon){
  document.getElementById('m-title').textContent = name;
  document.getElementById('m-code').textContent = code;
  document.getElementById('m-icon').className = 'fa-solid ' + (icon || 'fa-file');
  
  const list = document.getElementById('m-pdfs');
  list.innerHTML = '';
  const files = window.data[key] || [];
  
  if(!files.length){
    list.innerHTML = '<div class="empty-state"><i class="fa-regular fa-folder-open"></i>Not available yet.</div>';
    document.getElementById('overlay').classList.add('on');
    document.body.style.overflow = 'hidden';
    return;
  }
  
  files.forEach((item, i) => {
    let type = 'link';
    let title = name + ' File ' + (i+1);
    let content = '';
    
    // Fallback for old string data
    if (typeof item === 'string') {
      content = item;
      if (/\.(jpg|jpeg|png|gif|webp)$/i.test(item)) type = 'image';
    } else {
      type = item.type || 'link';
      title = item.title || item.label || item.name || title;
      content = item.content || item.file || item.link || item.code || '';
      
      // Auto-detect old data structures
      if (key === 'CLASSROOM' && item.code) type = 'code';
    }

    if (type === 'image') {
      const wrap = document.createElement('div');
      wrap.className = 'routine-img-wrap';
      wrap.innerHTML = `<img src="${content}" alt="${title}">`;
      list.appendChild(wrap);
      
      const a = document.createElement('a');
      a.href = content; a.target = '_blank'; a.className = 'pdf-item img-type';
      a.innerHTML = `<div class="fi"><i class="fa-solid fa-expand"></i></div><span class="pdf-label">${title} (Full Screen)</span><span class="pdf-num">0${i+1}</span>`;
      list.appendChild(a);
    } 
    else if (type === 'text') {
      const div = document.createElement('div');
      div.className = 'info-box';
      div.innerHTML = `<i class="fa-solid fa-circle-info"></i> <div><strong>${title}</strong><br>${content}</div>`;
      list.appendChild(div);
    }
    else if (type === 'code') {
      const div = document.createElement('div');
      div.className = 'pdf-item code-type';
      div.innerHTML = `<div class="fi"><i class="fa-solid fa-hashtag"></i></div><span class="pdf-label">${title}</span><span class="code-chip" onclick="copy_code(this,'${content}')">${content}</span>`;
      list.appendChild(div);
    }
    else {
      // Default: Link (PDF, YouTube, etc.)
      const a = document.createElement('a');
      a.href = content; a.target = '_blank'; a.className = 'pdf-item pdf-type';
      a.onclick = (ev) => openFileOfflineAware(content, ev);
      
      let iconClass = 'fa-file-pdf';
      let iconColorClass = 'pdf-type'; 
      
      if(content.includes('youtube.com') || content.includes('youtu.be')) {
        iconClass = 'fa-youtube fa-brands';
        iconColorClass = 'hack-type'; 
      }
      else if(content.includes('drive.google.com')) {
        iconClass = 'fa-google-drive fa-brands';
        iconColorClass = 'links-type'; 
      }
      else if(content.includes('github.com')) {
        iconClass = 'fa-github fa-brands';
        iconColorClass = 'routine-type';
      }
      
      a.innerHTML = `<div class="fi ${iconColorClass}"><i class="${iconClass.includes('fa-brands') ? '' : 'fa-solid'} ${iconClass}"></i></div><span class="pdf-label">${title}</span><span class="pdf-num">0${i+1}</span><i class="fa-solid fa-arrow-right pdf-arrow"></i>`;
      list.appendChild(a);
    }
  });
  
  document.getElementById('overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}

window.copy_code = function(el, code){
  navigator.clipboard.writeText(code).then(()=>{
    const old = el.textContent;
    el.textContent = 'Copied!';
    setTimeout(() => { el.textContent = old; }, 1200);
  });
}

window.close_modal = function(){
  document.getElementById('overlay').classList.remove('on');
  document.body.style.overflow = '';
}
window.close_outside = function(e){
  if(e.target.id === 'overlay') window.close_modal();
}
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') window.close_modal();
});

// ===== Search Palette (Cmd+K) =====
let paletteActiveIndex = -1;
let paletteMatches = [];

function normalize(str){
  return (str || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

// Card data collected from existing onclick attributes, no HTML change needed
function getSearchIndex(){
  const cards = document.querySelectorAll('.grid .card[onclick]');
  const index = [];
  cards.forEach(card => {
    const onclickStr = card.getAttribute('onclick') || '';
    const m = onclickStr.match(/open_modal\('([^']*)','([^']*)','([^']*)','([^']*)'\)/);
    if(m){
      index.push({ name: m[1], code: m[2], key: m[3], icon: m[4] });
    }
  });
  return index;
}

window.openSearchPalette = function(){
  document.getElementById('searchOverlay').classList.add('on');
  document.body.style.overflow = 'hidden';
  const input = document.getElementById('paletteInput');
  input.value = '';
  paletteSearch('');
  setTimeout(() => input.focus(), 50);
}

window.closeSearchPalette = function(){
  document.getElementById('searchOverlay').classList.remove('on');
  document.body.style.overflow = '';
}

window.closeSearchOutside = function(e){
  if(e.target.id === 'searchOverlay') closeSearchPalette();
}

function getItemSearchIndex(){
  const index = [];
  Object.keys(window.data || {}).forEach(catKey => {
    if(catKey === 'TICKER') return;
    const meta = CATEGORY_META[catKey];
    if(!meta) return;
    const items = window.data[catKey] || [];
    items.forEach(item => {
      if(typeof item === 'string') return;
      const title = item.title || item.label || item.name;
      if(!title) return;
      index.push({
        name: title,
        code: meta.label,
        key: catKey,
        icon: meta.icon
      });
    });
  });
  return index;
}

window.paletteSearch = function(query){
  const q = normalize(query);
  const emptyState = document.getElementById('paletteEmptyState');
  const resultsBox = document.getElementById('paletteResults');
  const noResult = document.getElementById('paletteNoResult');

  if(!q){
    emptyState.style.display = 'block';
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    noResult.style.display = 'none';
    paletteMatches = [];
    paletteActiveIndex = -1;
    return;
  }

  const all = [...getSearchIndex(), ...getItemSearchIndex()];
  paletteMatches = all.filter(item =>
    normalize(item.name).includes(q) || normalize(item.code).includes(q)
  ).slice(0, 10);

  emptyState.style.display = 'none';

  if(paletteMatches.length === 0){
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    noResult.style.display = 'flex';
    paletteActiveIndex = -1;
    return;
  }

  noResult.style.display = 'none';
  resultsBox.style.display = 'flex';
  paletteActiveIndex = 0;

  resultsBox.innerHTML = paletteMatches.map((item, i) => `
    <div class="palette-row ${i === 0 ? 'active' : ''}" data-index="${i}"
         onmouseenter="setPaletteActive(${i})"
         onclick="chooseMatch(${i})">
      <div class="fi"><i class="fa-solid ${item.icon}"></i></div>
      <div class="palette-row-text">
        <div class="palette-row-name">${item.name}</div>
        <div class="palette-row-code">${item.code}</div>
      </div>
      <i class="fa-solid fa-arrow-right palette-row-arrow"></i>
    </div>
  `).join('');
}

window.setPaletteActive = function(i){
  paletteActiveIndex = i;
  document.querySelectorAll('.palette-row').forEach(r => r.classList.remove('active'));
  const row = document.querySelector(`.palette-row[data-index="${i}"]`);
  if(row) row.classList.add('active');
}

window.chooseMatch = function(i){
  const item = paletteMatches[i];
  if(!item) return;
  closeSearchPalette();
  window.open_modal(item.name, item.code, item.key, item.icon);
}

// Keyboard: Cmd/Ctrl+K to open, Esc to close, Arrow keys + Enter inside palette
document.addEventListener('keydown', function(e){
  const isOpen = document.getElementById('searchOverlay').classList.contains('on');

  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    isOpen ? closeSearchPalette() : window.openSearchPalette();
    return;
  }

  if(!isOpen) return;

  if(e.key === 'Escape'){
    closeSearchPalette();
  } else if(e.key === 'ArrowDown'){
    e.preventDefault();
    if(paletteMatches.length){
      paletteActiveIndex = (paletteActiveIndex + 1) % paletteMatches.length;
      setPaletteActive(paletteActiveIndex);
    }
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    if(paletteMatches.length){
      paletteActiveIndex = (paletteActiveIndex - 1 + paletteMatches.length) % paletteMatches.length;
      setPaletteActive(paletteActiveIndex);
    }
  } else if(e.key === 'Enter'){
    e.preventDefault();
    if(paletteActiveIndex >= 0) chooseMatch(paletteActiveIndex);
  }
});


const vaultFirebaseConfig = {
  apiKey: "AIzaSyDtECNnScV_uie6qvmb-HAxQ6dKDglxOfA",
  authDomain: "c-uits.firebaseapp.com",
  databaseURL: "https://c-uits-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "c-uits",
  storageBucket: "c-uits.firebasestorage.app",
  messagingSenderId: "1048855243261",
  appId: "1:1048855243261:web:57835bd57476d65c181194"
};

const CLOUDINARY_CLOUD_NAME = "dwvomd7wd";
const CLOUDINARY_UPLOAD_PRESET = "CSE57C";


const VAULT_NOTE_TTL_MS = 30 * 24 * 60 * 60 * 1000; 

const vaultApp = initializeApp(vaultFirebaseConfig, "vaultApp");
const vaultDb = getDatabase(vaultApp);

let vaultContentType = 'text'; 
let vaultChosenFile = null;
let currentVaultCode = null; 

function sanitizeVaultCode(raw){
  // Keep codes URL/DB-key safe: letters, numbers, dash, underscore only
  return (raw || '').trim().replace(/[.#$\[\]\/\s]/g, '-').slice(0, 60);
}

window.openVaultModal = function(){
  document.getElementById('vaultOverlay').classList.add('on');
  document.body.style.overflow = 'hidden';
  switchVaultTab('access');
}

window.closeVaultModal = function(){
  document.getElementById('vaultOverlay').classList.remove('on');
  document.body.style.overflow = '';
}

window.closeVaultOutside = function(e){
  if(e.target.id === 'vaultOverlay') window.closeVaultModal();
}

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    const v = document.getElementById('vaultOverlay');
    if(v && v.classList.contains('on')) window.closeVaultModal();
  }
});

window.switchVaultTab = function(tab){
  const accessBtn = document.getElementById('vaultTabAccessBtn');
  const createBtn = document.getElementById('vaultTabCreateBtn');
  const accessPane = document.getElementById('vaultAccessPane');
  const createPane = document.getElementById('vaultCreatePane');

  if(tab === 'access'){
    accessBtn.classList.add('active'); createBtn.classList.remove('active');
    accessPane.style.display = 'flex'; createPane.style.display = 'none';
  } else {
    createBtn.classList.add('active'); accessBtn.classList.remove('active');
    createPane.style.display = 'flex'; accessPane.style.display = 'none';
  }
}

window.generateVaultCode = function(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('vaultCreateCode').value = code;
}

window.setVaultContentType = function(type){
  vaultContentType = type;
  vaultChosenFile = null;

  document.querySelectorAll('#vaultTypeToggle .vault-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  const textWrap = document.getElementById('vaultTextWrap');
  const webWrap = document.getElementById('vaultWebWrap');
  const fileWrap = document.getElementById('vaultFileWrap');
  const langWrap = document.getElementById('vaultLangWrap');
  const textarea = document.getElementById('vaultTextInput');
  const dropText = document.getElementById('vaultFileDropText');
  const fileInput = document.getElementById('vaultFileInput');
  const createRunBtn = document.getElementById('vaultCreateRunBtn');

  document.getElementById('vaultCreateRunOutput').innerHTML = '';
  document.getElementById('vaultWebRunOutput').innerHTML = '';

  if(type === 'code'){
    langWrap.style.display = 'block';
    fileWrap.style.display = 'none';
    onVaultLangChange();
  } else if(type === 'text'){
    langWrap.style.display = 'none';
    fileWrap.style.display = 'none';
    webWrap.style.display = 'none';
    textWrap.style.display = 'block';
    textarea.classList.remove('as-code');
    textarea.placeholder = 'Write your note here...';
    createRunBtn.style.display = 'none';
  } else {
    langWrap.style.display = 'none';
    textWrap.style.display = 'none';
    webWrap.style.display = 'none';
    fileWrap.style.display = 'block';
    fileInput.accept = type === 'image' ? 'image/*' : 'application/pdf';
    dropText.textContent = type === 'image' ? 'Click to choose an image' : 'Click to choose a PDF';
  }
}

window.onVaultLangChange = function(){
  const lang = document.getElementById('vaultLangSelect').value;
  const textWrap = document.getElementById('vaultTextWrap');
  const webWrap = document.getElementById('vaultWebWrap');
  const textarea = document.getElementById('vaultTextInput');
  const createRunBtn = document.getElementById('vaultCreateRunBtn');

  document.getElementById('vaultCreateRunOutput').innerHTML = '';
  document.getElementById('vaultWebRunOutput').innerHTML = '';

  if(lang === 'web'){
    textWrap.style.display = 'none';
    webWrap.style.display = 'block';
  } else {
    textWrap.style.display = 'block';
    webWrap.style.display = 'none';
    textarea.classList.add('as-code');
    textarea.placeholder = 'Paste or write your code here...';
    createRunBtn.style.display = 'flex';
  }
}

window.switchWebPanel = function(panel){
  document.querySelectorAll('#vaultWebWrap .vault-web-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
  document.getElementById('vaultWebHtml').style.display = panel === 'html' ? 'block' : 'none';
  document.getElementById('vaultWebCss').style.display = panel === 'css' ? 'block' : 'none';
  document.getElementById('vaultWebJs').style.display = panel === 'js' ? 'block' : 'none';
}

window.onVaultFileChosen = function(input){
  const f = input.files && input.files[0];
  vaultChosenFile = f || null;
  const dropText = document.getElementById('vaultFileDropText');
  dropText.textContent = f ? f.name : 'Click to choose a file';
}

function vaultShowMsg(containerId, kind, html){
  document.getElementById(containerId).innerHTML =
    `<div class="vault-msg ${kind}"><i class="fa-solid ${kind === 'ok' ? 'fa-circle-check' : kind === 'err' ? 'fa-circle-exclamation' : 'fa-spinner fa-spin'}"></i><div>${html}</div></div>`;
}

async function uploadToCloudinary(file){
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(url, { method: 'POST', body: formData });
  if(!res.ok) throw new Error('Upload failed (' + res.status + ')');
  const result = await res.json();
  if(!result.secure_url) throw new Error('No URL returned from upload');
  return result.secure_url;
}

window.saveVaultNote = async function(){
  const rawCode = document.getElementById('vaultCreateCode').value;
  const code = sanitizeVaultCode(rawCode);
  const saveBtn = document.getElementById('vaultSaveBtn');

  if(!code){
    vaultShowMsg('vaultCreateResult', 'err', 'Please set a code before saving.');
    return;
  }

  let payload = null;

    if(vaultContentType === 'text'){
    const text = document.getElementById('vaultTextInput').value;
    if(!text.trim()){
      vaultShowMsg('vaultCreateResult', 'err', 'Note is empty — write something first.');
      return;
    }
    payload = { mode: 'text', content: text, createdAt: Date.now() };
  } else if(vaultContentType === 'code'){
    const lang = document.getElementById('vaultLangSelect').value;
    if(lang === 'web'){
      const html = document.getElementById('vaultWebHtml').value;
      const css = document.getElementById('vaultWebCss').value;
      const js = document.getElementById('vaultWebJs').value;
      if(!html.trim() && !css.trim() && !js.trim()){
        vaultShowMsg('vaultCreateResult', 'err', 'Note is empty — write something first.');
        return;
      }
      payload = { mode: 'code', language: 'web', content: JSON.stringify({html, css, js}), createdAt: Date.now() };
    } else {
      const text = document.getElementById('vaultTextInput').value;
      if(!text.trim()){
        vaultShowMsg('vaultCreateResult', 'err', 'Note is empty — write something first.');
        return;
      }
      payload = { mode: 'code', language: lang, content: text, createdAt: Date.now() };
    }
  } else {
    if(!vaultChosenFile){
      vaultShowMsg('vaultCreateResult', 'err', 'Please choose a file first.');
      return;
    }
  }

  saveBtn.disabled = true;
  vaultShowMsg('vaultCreateResult', 'loading', 'Checking code availability...');

  try {
    // Don't silently overwrite an existing note
    const existing = await get(child(ref(vaultDb), 'notes/' + code));
    if(existing.exists()){
      vaultShowMsg('vaultCreateResult', 'err', 'This code is already taken. Please choose another one.');
      saveBtn.disabled = false;
      return;
    }

    if(vaultContentType === 'image' || vaultContentType === 'pdf'){
      vaultShowMsg('vaultCreateResult', 'loading', 'Uploading file...');
      const url = await uploadToCloudinary(vaultChosenFile);
      payload = { mode: vaultContentType, content: url, createdAt: Date.now() };
    }

    vaultShowMsg('vaultCreateResult', 'loading', 'Saving your note...');
    await set(ref(vaultDb, 'notes/' + code), payload);

    vaultShowMsg('vaultCreateResult', 'ok',
      `Saved! Your code is <strong>${code}</strong> — write it down, this is the only way back in. Notes are automatically deleted after 30 days.`);

       // reset form
    document.getElementById('vaultCreateCode').value = '';
    document.getElementById('vaultTextInput').value = '';
    document.getElementById('vaultWebHtml').value = '';
    document.getElementById('vaultWebCss').value = '';
    document.getElementById('vaultWebJs').value = '';
    document.getElementById('vaultWebRunOutput').innerHTML = '';
    document.getElementById('vaultCreateRunOutput').innerHTML = '';
    vaultChosenFile = null;
    document.getElementById('vaultFileInput').value = '';
    const dropText = document.getElementById('vaultFileDropText');
    if(dropText) dropText.textContent = 'Click to choose a file';

  } catch(err){
    console.error(err);
    vaultShowMsg('vaultCreateResult', 'err', 'Something went wrong saving your note. Please try again.');
  } finally {
    saveBtn.disabled = false;
  }
}

window.fetchVaultNote = async function(){
  const rawCode = document.getElementById('vaultAccessCode').value;
  const code = sanitizeVaultCode(rawCode);

  if(!code){
    vaultShowMsg('vaultAccessResult', 'err', 'Please enter a code.');
    return;
  }

  vaultShowMsg('vaultAccessResult', 'loading', 'Looking up your note...');

  try {
    const snap = await get(child(ref(vaultDb), 'notes/' + code));
    if(!snap.exists()){
      vaultShowMsg('vaultAccessResult', 'err', 'No note found for this code. Double-check and try again.');
      return;
    }

    const note = snap.val();

    // Auto-expire: notes older than 30 days are deleted on access
    if(note.createdAt && (Date.now() - note.createdAt > VAULT_NOTE_TTL_MS)){
      await set(ref(vaultDb, 'notes/' + code), null);
      vaultShowMsg('vaultAccessResult', 'err', 'This note has expired and was automatically deleted. Notes are kept for 30 days only.');
      return;
    }

    currentVaultCode = code;
    renderVaultNote(note, code);

  } catch(err){
    console.error(err);
    vaultShowMsg('vaultAccessResult', 'err', 'Something went wrong fetching your note. Please try again.');
  }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getExpiryLabel(createdAt){
  if(!createdAt) return '';
  const msLeft = createdAt + VAULT_NOTE_TTL_MS - Date.now();
  if(msLeft <= 0) return 'Expiring soon.';
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if(daysLeft <= 1) return 'Expires in less than a day (notes auto-delete after 30 days).';
  return `Expires in ${daysLeft} days (notes auto-delete after 30 days).`;
}

function renderVaultNote(note, code){
  const box = document.getElementById('vaultAccessResult');
  const badgeLabel = { text: 'TEXT NOTE', code: 'CODE SNIPPET', image: 'IMAGE', pdf: 'PDF' }[note.mode] || 'NOTE';
  let bodyHtml = '';

    if(note.mode === 'text'){
    bodyHtml = `<div class="vault-note-text">${escapeHtml(note.content)}</div>`;
  } else if(note.mode === 'code'){
    if(note.language === 'web'){
      let parts;
      try { parts = JSON.parse(note.content); } catch(e){ parts = { html: note.content, css: '', js: '' }; }
      bodyHtml = `
        <div class="vault-web-view-tabs">
          <button class="vault-web-tab active" onclick="switchViewWebPanel(this,'html')"><i class="fa-brands fa-html5"></i> HTML</button>
          <button class="vault-web-tab" onclick="switchViewWebPanel(this,'css')"><i class="fa-brands fa-css3-alt"></i> CSS</button>
          <button class="vault-web-tab" onclick="switchViewWebPanel(this,'js')"><i class="fa-brands fa-js"></i> JS</button>
        </div>
        <pre class="vault-note-code" id="vaultViewHtml"><code>${escapeHtml(parts.html || '')}</code></pre>
        <pre class="vault-note-code" id="vaultViewCss" style="display:none;"><code>${escapeHtml(parts.css || '')}</code></pre>
        <pre class="vault-note-code" id="vaultViewJs" style="display:none;"><code>${escapeHtml(parts.js || '')}</code></pre>
        <div id="vaultRunOutput"></div>`;
    } else {
      bodyHtml = `<pre class="vault-note-code"><code>${escapeHtml(note.content)}</code></pre><div id="vaultRunOutput"></div>`;
    }
  } else if(note.mode === 'image'){
    bodyHtml = `<div class="vault-note-image"><img src="${note.content}" alt="Saved note image"></div>`;
  } else if(note.mode === 'pdf'){
    bodyHtml = `<a class="vault-note-pdf-link" href="${note.content}" target="_blank"><i class="fa-solid fa-file-pdf"></i> Open PDF <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto"></i></a>`;
  }

  const canExpand = (note.mode === 'text' || (note.mode === 'code' && note.language !== 'web'));
  const expiryLabel = getExpiryLabel(note.createdAt);

  box.innerHTML = `
    <div class="vault-note-view">
      <div class="vault-note-meta">
        <span class="vault-note-badge">${badgeLabel}</span>
                <div class="vault-note-actions">
          ${note.mode === 'code' ? `<button class="vault-run-btn" id="vaultRunBtn"><i class="fa-solid fa-play"></i> Run</button>` : ''}
          ${canExpand ? `<button class="vault-copy-btn" id="vaultExpandBtn"><i class="fa-solid fa-expand"></i> Full Screen</button>` : ''}
          ${canExpand ? `<button class="vault-copy-btn" id="vaultCopyBtn"><i class="fa-solid fa-copy"></i> Copy</button>` : ''}
          <button class="vault-copy-btn vault-delete-btn" id="vaultDeleteBtn"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>
      ${bodyHtml}
      ${expiryLabel ? `<div class="vault-expiry-note"><i class="fa-regular fa-clock"></i> ${expiryLabel}</div>` : ''}
    </div>
  `;

  if(canExpand){
    document.getElementById('vaultCopyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(note.content).then(() => {
        const btn = document.getElementById('vaultCopyBtn');
        const old = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(() => { btn.innerHTML = old; }, 1200);
      });
    });

    document.getElementById('vaultExpandBtn').addEventListener('click', () => {
      window.openVaultFullscreen(note);
    });
  }

   document.getElementById('vaultDeleteBtn').addEventListener('click', () => {
    confirmDeleteVaultNote(code);
  });

  if(note.mode === 'code'){
    const runBtn = document.getElementById('vaultRunBtn');
    if(runBtn){
      runBtn.addEventListener('click', () => runVaultCode(note));
    }
  }
}

function confirmDeleteVaultNote(code){
  const btn = document.getElementById('vaultDeleteBtn');
  if(!btn) return;

  if(btn.dataset.confirming === 'true'){
    deleteVaultNoteNow(code);
    return;
  }

  btn.dataset.confirming = 'true';
  btn.classList.add('confirming');
  const old = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Click again to confirm';

  setTimeout(() => {
    if(btn && btn.dataset && btn.dataset.confirming === 'true'){
      btn.dataset.confirming = 'false';
      btn.classList.remove('confirming');
      btn.innerHTML = old;
    }
  }, 3000);
}

async function deleteVaultNoteNow(code){
  const btn = document.getElementById('vaultDeleteBtn');
  if(btn) btn.disabled = true;
  try {
    await set(ref(vaultDb, 'notes/' + code), null);
    vaultShowMsg('vaultAccessResult', 'ok', 'Note deleted successfully.');
    document.getElementById('vaultAccessCode').value = '';
    currentVaultCode = null;
  } catch(err){
    console.error(err);
    vaultShowMsg('vaultAccessResult', 'err', 'Could not delete the note. Please try again.');
  }
}

window.openVaultFullscreen = function(note){
  const overlay = document.getElementById('vaultFullscreenOverlay');
  const body = document.getElementById('vaultFullscreenBody');
  const label = document.getElementById('vaultFullscreenLabel');

  label.textContent = note.mode === 'code' ? 'CODE SNIPPET' : 'TEXT NOTE';

  if(note.mode === 'code'){
    body.innerHTML = `<pre class="vault-fs-code"><code>${escapeHtml(note.content)}</code></pre>`;
  } else {
    body.innerHTML = `<div class="vault-fs-text">${escapeHtml(note.content)}</div>`;
  }

  const copyBtn = document.getElementById('vaultFullscreenCopyBtn');
  if(copyBtn){
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(note.content).then(() => {
        const oldHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(() => { copyBtn.innerHTML = oldHtml; }, 1200);
      });
    };
  }

  overlay.classList.add('on');
  document.body.style.overflow = 'hidden';
}

window.openVaultEditorFullscreen = function(){
  const overlay = document.getElementById('vaultFullscreenOverlay');
  const body = document.getElementById('vaultFullscreenBody');
  const label = document.getElementById('vaultFullscreenLabel');
  const copyBtn = document.getElementById('vaultFullscreenCopyBtn');

  const textarea = document.getElementById('vaultTextInput');
  const isCode = vaultContentType === 'code';

  label.textContent = isCode ? 'CODE SNIPPET · EDITING' : 'TEXT NOTE · EDITING';

  body.innerHTML = `<textarea id="vaultFsEditTextarea" class="vault-fs-edit-textarea ${isCode ? 'as-code' : ''}" placeholder="${isCode ? 'Paste or write your code here...' : 'Write your note here...'}" spellcheck="false"></textarea>`;

  const fsTextarea = document.getElementById('vaultFsEditTextarea');
  fsTextarea.value = textarea.value;

  fsTextarea.addEventListener('input', () => {
    textarea.value = fsTextarea.value;
  });

  if(copyBtn){
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(fsTextarea.value).then(() => {
        const oldHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(() => { copyBtn.innerHTML = oldHtml; }, 1200);
      });
    };
  }

  overlay.classList.add('on');
  document.body.style.overflow = 'hidden';
  setTimeout(() => fsTextarea.focus(), 60);
}

window.closeVaultFullscreen = function(){
  document.getElementById('vaultFullscreenOverlay').classList.remove('on');
  document.body.style.overflow = '';
}

window.closeVaultFullscreenOutside = function(e){
  if(e.target.id === 'vaultFullscreenOverlay') window.closeVaultFullscreen();
}

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    const fs = document.getElementById('vaultFullscreenOverlay');
    if(fs && fs.classList.contains('on')) window.closeVaultFullscreen();
  }
});

const CATEGORY_META = {
  TICKER: { label: 'Info Ticker', icon: 'fa-bolt' },
  DSA2: { label: 'DSA 2', icon: 'fa-sitemap' },
  SE: { label: 'Software Engg', icon: 'fa-diagram-project' },
  MATH: { label: 'Complex Variables', icon: 'fa-square-root-variable' },
  NUM: { label: 'Numerical Methods', icon: 'fa-calculator' },
  DCOM: { label: 'Data Communication', icon: 'fa-network-wired' },
  IPLAB: { label: 'Internet Prog. Lab', icon: 'fa-globe' },
  LINKS: { label: 'Reference Links', icon: 'fa-link' },
  COURSES: { label: 'Upcoming Courses', icon: 'fa-graduation-cap' },
  FACULTY: { label: 'Faculty List', icon: 'fa-chalkboard-user' },
  CLASSROOM: { label: 'Classroom Code', icon: 'fa-hashtag' },
  GCLASSROOM: { label: 'Google Classroom', icon: 'fa-chalkboard' },
  GC_DSA_LAB: { label: 'DSA Lab', icon: 'fa-flask' },
  GC_DSA_THEORY: { label: 'DSA II Theory', icon: 'fa-sitemap' },
  GC_SE_THEORY: { label: 'SE Theory', icon: 'fa-diagram-project' },
  GC_SE_LAB: { label: 'SE Lab', icon: 'fa-laptop-code' },
  GC_DCOM_THEORY: { label: 'Data Comm Theory', icon: 'fa-network-wired' },
  GC_IPLAB: { label: 'IP Lab', icon: 'fa-globe' },
  CLSROUTINE: { label: 'Class Routine', icon: 'fa-table-list' },
  HACKATHON: { label: 'Upcoming Hackathon', icon: 'fa-laptop-code' },
  CP: { label: 'Upcoming CP', icon: 'fa-trophy' },
  PQS: { label: 'PQ Solutions', icon: 'fa-scroll' },
  ROUTINE: { label: 'Exam Routine', icon: 'fa-calendar-days' },
  NOTES: { label: 'Notes', icon: 'fa-book-open' },
  SUG: { label: 'Suggestions', icon: 'fa-lightbulb' },
  BOOKS: { label: 'Books', icon: 'fa-book' }
};

let notifications = [];
let notifLastSeen = parseInt(localStorage.getItem('cse57_notif_last_seen') || '0', 10);

onValue(ref(db, 'notifications'), (snapshot) => {
  const val = snapshot.val() || {};
  notifications = Object.entries(val)
    .map(([id, n]) => ({ id, ...n }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30);
  renderNotifications();
});

function getTimeAgo(ts){
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

function renderNotifications(){
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  if (!list) return;

  const unread = notifications.filter(n => n.timestamp > notifLastSeen).length;
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i><span>No notifications yet.</span></div>';
    return;
  }

  list.innerHTML = notifications.map(n => {
    const meta = CATEGORY_META[n.category] || { label: n.category, icon: 'fa-circle-info' };
    const isNew = n.timestamp > notifLastSeen;
    return `
      <div class="notif-row ${isNew ? 'unread' : ''}" data-category="${n.category}">
        <div class="notif-icon"><i class="fa-solid ${meta.icon}"></i></div>
        <div class="notif-text">
          <div class="notif-title">${escapeHtml(n.title || meta.label)}</div>
          <div class="notif-meta">${meta.label} · ${getTimeAgo(n.timestamp)}</div>
        </div>
        ${isNew ? '<span class="notif-dot"></span>' : ''}
      </div>`;
  }).join('');

  list.querySelectorAll('.notif-row').forEach(row => {
    row.addEventListener('click', () => window.openNotification(row.dataset.category));
  });
}

window.openNotification = function(category){
  closeNotifDropdown();
  if (category === 'TICKER') return;
  const meta = CATEGORY_META[category] || { label: category, icon: 'fa-file' };
  window.open_modal(meta.label, meta.label, category, meta.icon);
}

window.toggleNotifDropdown = function(){
  const wrap = document.getElementById('notifWrapper');
  const opening = !wrap.classList.contains('open');
  wrap.classList.toggle('open');

  if (opening) {
    notifLastSeen = Date.now();
    localStorage.setItem('cse57_notif_last_seen', notifLastSeen);
    document.getElementById('notifBadge').style.display = 'none';
  }
}

function closeNotifDropdown(){
  document.getElementById('notifWrapper').classList.remove('open');
}

document.addEventListener('click', function(e){
  const wrap = document.getElementById('notifWrapper');
  if (wrap && wrap.classList.contains('open') && !wrap.contains(e.target)) {
    wrap.classList.remove('open');
  }
});

const PAIZA_LANG = {
  python3: 'python3',
  cpp: 'cpp',
  java: 'java',
  c: 'c',
  javascript: 'javascript'
};

function paizaSleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function executeCode(content, lang, outBox, runBtn){
  if(!outBox) return;

  if(runBtn){
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';
  }

  outBox.innerHTML = `
    <div class="vault-run-output">
      <div class="vault-run-output-header"><span><i class="fa-solid fa-terminal"></i> Console</span></div>
      <div class="vault-run-console">Running...</div>
    </div>`;

  const consoleEl = outBox.querySelector('.vault-run-console');

  try {
   
    const createUrl = 'https://api.paiza.io/runners/create?' + new URLSearchParams({
      source_code: content,
      language: PAIZA_LANG[lang] || 'python3',
      api_key: 'guest'
    });
    const createRes = await fetch(createUrl, { method: 'POST' });
    if(!createRes.ok) throw new Error('Execution service error (' + createRes.status + ')');
    const createData = await createRes.json();
    if(!createData.id) throw new Error(createData.error || 'Could not start execution');

   
    let status = 'running';
    let attempts = 0;
    while(status !== 'completed' && attempts < 15){
      await paizaSleep(1000);
      const statusUrl = 'https://api.paiza.io/runners/get_status?' + new URLSearchParams({
        id: createData.id, api_key: 'guest'
      });
      const statusRes = await fetch(statusUrl);
      const statusData = await statusRes.json();
      status = statusData.status;
      attempts++;
    }

    if(status !== 'completed') throw new Error('Execution timed out');

  
    const detailsUrl = 'https://api.paiza.io/runners/get_details?' + new URLSearchParams({
      id: createData.id, api_key: 'guest'
    });
    const detailsRes = await fetch(detailsUrl);
    const details = await detailsRes.json();

    let output = '';
    if(details.build_stderr) output += details.build_stderr + '\n';
    if(details.stdout) output += details.stdout;
    if(details.stderr) output += (output ? '\n' : '') + details.stderr;
    if(!output.trim()) output = '(No output)';

    const isErr = !!(details.stderr || details.build_stderr) || details.build_result === 'failure';
    consoleEl.textContent = output;
    consoleEl.classList.toggle('err-text', isErr);

  } catch(err){
    console.error(err);
    if(consoleEl){
      consoleEl.textContent = 'Failed to run code: ' + err.message;
      consoleEl.classList.add('err-text');
    }
  } finally {
    if(runBtn){
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run';
    }
  }
}

function buildWebSrcdoc(parts){
  const html = (parts && parts.html) || '';
  const css = (parts && parts.css) || '';
  const js = (parts && parts.js) || '';
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
}

function renderWebPreview(parts, outBox){
  if(!outBox) return;
  outBox.innerHTML = `
    <div class="vault-run-output">
      <div class="vault-run-output-header"><span><i class="fa-solid fa-eye"></i> Live Preview</span></div>
      <div class="vault-run-iframe-wrap">
        <iframe sandbox="allow-scripts allow-modals"></iframe>
      </div>
    </div>`;
  const iframe = outBox.querySelector('iframe');
  iframe.srcdoc = buildWebSrcdoc(parts);
}

function runVaultCode(note){
  const outBox = document.getElementById('vaultRunOutput');
  const runBtn = document.getElementById('vaultRunBtn');

  if(note.language === 'web'){
    let parts;
    try { parts = JSON.parse(note.content); } catch(e){ parts = { html: note.content, css: '', js: '' }; }
    renderWebPreview(parts, outBox);
    return;
  }
  executeCode(note.content, note.language || 'python3', outBox, runBtn);
}

window.runDraftCode = function(){
  const content = document.getElementById('vaultTextInput').value;
  if(!content.trim()) return;
  const lang = document.getElementById('vaultLangSelect').value;
  const outBox = document.getElementById('vaultCreateRunOutput');
  const runBtn = document.getElementById('vaultCreateRunBtn');
  executeCode(content, lang, outBox, runBtn);
}

window.runDraftWebCode = function(){
  const html = document.getElementById('vaultWebHtml').value;
  const css = document.getElementById('vaultWebCss').value;
  const js = document.getElementById('vaultWebJs').value;
  const outBox = document.getElementById('vaultWebRunOutput');
  renderWebPreview({ html, css, js }, outBox);
}

window.switchViewWebPanel = function(btn, panel){
  btn.parentElement.querySelectorAll('.vault-web-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('vaultViewHtml').style.display = panel === 'html' ? 'block' : 'none';
  document.getElementById('vaultViewCss').style.display = panel === 'css' ? 'block' : 'none';
  document.getElementById('vaultViewJs').style.display = panel === 'js' ? 'block' : 'none';
}

import { onDisconnect, push as presencePush, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

(function trackPresence(){
  const presenceRef = presencePush(ref(db, 'presence'));
  set(presenceRef, { connectedAt: serverTimestamp() });
  onDisconnect(presenceRef).remove();

  runTransaction(ref(db, 'stats/totalVisits'), (current) => (current || 0) + 1);
})();

