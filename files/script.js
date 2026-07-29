/* ============================================================
   Learn and Sell — front end wired to the real backend API.
   Backend base URL is set in config.js (window.LEARN_AND_SELL_API_BASE).
   ============================================================ */

const API_BASE = window.LEARN_AND_SELL_API_BASE || 'http://localhost:4000/api';

/* ---------- API HELPER ---------- */
let authToken = localStorage.getItem('las_token') || null;

async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers['Authorization'] = 'Bearer ' + authToken;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (networkErr) {
    const err = new Error('Could not reach the backend. Is it running at ' + API_BASE + '?');
    err.status = 0;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body, e.g. 204 */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- NAV ---------- */
const NAV_ITEMS = [
  {id:'home', label:'Home', roles:['guest','learner','buyer','admin']},
  {id:'courses', label:'Courses', roles:['guest','learner']},
  {id:'marketplace', label:'Marketplace', roles:['guest','learner','buyer']},
  {id:'dashboard', label:'Dashboard', roles:['learner']},
  {id:'seller-orders', label:'Shop orders', roles:['learner']},
  {id:'my-orders', label:'My orders', roles:['buyer']},
  {id:'notifications', label:'Notifications', roles:['learner','buyer','admin']},
  {id:'admin', label:'Admin', roles:['admin']},
];

/* ---------- APP STATE ---------- */
let currentUser = null;      // {id,name,contact,role,language,avatar,active}
let courses = [];            // catalogue from GET /courses (no quiz answers)
let enrollments = [];        // this learner's enrollments from GET /enrollments/me
let shop = null;             // this learner's shop, if any
let myProducts = [];         // this learner's product list
let cart = [];                // client-side only, cleared on checkout
let notifications = [];
let marketFilter = 'All';
let activeCourseId = null;   // course currently open in course-detail view
let quizSelected = null;

const AVATARS = ['🙂','👩🏾','👩🏽‍🦱','🧕🏾','👩🏿‍🦰'];

/* ---------- UTIL ---------- */
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1900);
}
function currentRole(){ return currentUser ? currentUser.role : 'guest'; }
function getUnreadNotificationCount(){ return notifications.filter(n=>!n.read).length; }

function renderNav(){
  const navLinks = document.getElementById('navLinks');
  navLinks.innerHTML = '';
  NAV_ITEMS.filter(i=>i.roles.includes(currentRole())).forEach(item=>{
    const a = document.createElement('a');
    a.href='#'; a.className='nav-link';
    if(item.id === 'notifications'){
      const unread = getUnreadNotificationCount();
      a.textContent = unread ? `${item.label} (${unread})` : item.label;
    } else {
      a.textContent = item.label;
    }
    a.dataset.id = item.id;
    a.onclick=(e)=>{e.preventDefault(); go(item.id); document.getElementById('navLinks').classList.remove('open');};
    navLinks.appendChild(a);
  });
  document.getElementById('loginBtn').style.display = currentUser ? 'none' : 'inline-block';
  document.getElementById('logoutBtn').style.display = currentUser ? 'inline-block' : 'none';
  document.getElementById('profileBtn').style.display = currentUser ? 'inline-block' : 'none';
}

function toggleMobileNav(){
  document.getElementById('navLinks').classList.toggle('open');
}
document.addEventListener('click', (e)=>{
  const nav = document.getElementById('navLinks');
  const toggle = document.getElementById('navToggle');
  if(nav.classList.contains('open') && !nav.contains(e.target) && e.target !== toggle){
    nav.classList.remove('open');
  }
});

function go(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const target = document.getElementById('view-'+view);
  if(target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active', l.dataset.id===view));
  window.scrollTo({top:0, behavior:'smooth'});

  if(view==='dashboard') renderDashboard();
  if(view==='products') renderMyProducts();
  if(view==='marketplace') renderMarket();
  if(view==='cart') renderCart();
  if(view==='my-orders') renderMyOrders();
  if(view==='seller-orders') renderSellerOrders();
  if(view==='profile') renderProfileForm();
  if(view==='notifications') renderNotifications();
  if(view==='admin') { renderNav(); showAdminTab('overview'); }
}

function logout(){
  authToken = null; currentUser = null;
  localStorage.removeItem('las_token');
  enrollments = []; shop = null; myProducts = []; notifications = [];
  renderNav(); go('home');
  toast('Logged out');
}

/* ---------- AUTH ---------- */
let pendingRole = 'learner';
const roleToggle = document.getElementById('roleToggle');
['learner','buyer','admin'].forEach(r=>{
  const d = document.createElement('div');
  d.className = 'role-opt'+(r==='learner'?' sel':'');
  d.textContent = r==='learner' ? 'Learner / seller' : r==='buyer' ? 'Buyer' : 'Admin';
  d.dataset.role = r;
  d.onclick = ()=>{
    document.querySelectorAll('.role-opt').forEach(o=>o.classList.remove('sel'));
    d.classList.add('sel'); pendingRole = r;
  };
  roleToggle.appendChild(d);
});

async function onAuthSuccess(user, token){
  authToken = token;
  localStorage.setItem('las_token', token);
  currentUser = user;
  await Promise.all([refreshCourses(), refreshNotifications()]);
  if(user.role === 'learner') await Promise.all([refreshEnrollments(), refreshShop()]);
  toast('Welcome '+user.name.split(' ')[0]+' — logged in as '+user.role);
  renderNav();
  if(user.role==='admin') go('admin');
  else if(user.role==='buyer') go('marketplace');
  else go('dashboard');
}

async function loginAs(){
  const errBox = document.getElementById('authError');
  const name = document.getElementById('regName').value.trim();
  const contact = document.getElementById('regContact').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const language = document.getElementById('regLanguage').value;

  if(!name || !contact || !password){
    errBox.textContent = 'Please fill in your name, phone/email, and password.';
    errBox.style.display = 'block';
    return;
  }
  if(password.length < 4){
    errBox.textContent = 'Password should be at least 4 characters.';
    errBox.style.display = 'block';
    return;
  }
  errBox.style.display = 'none';

  try{
    const data = await apiFetch('/auth/register', { method:'POST', auth:false,
      body:{ name, contact, password, role: pendingRole, language } });
    await onAuthSuccess(data.user, data.token);
  }catch(err){
    if(err.status === 409){
      // account already exists — treat this as a login attempt instead
      try{
        const data2 = await apiFetch('/auth/login', { method:'POST', auth:false, body:{ contact, password } });
        if(data2.user.role !== pendingRole){
          toast(`This account is registered as ${data2.user.role} — logging you in as that role.`);
        }
        await onAuthSuccess(data2.user, data2.token);
      }catch(err2){
        errBox.textContent = err2.message;
        errBox.style.display = 'block';
      }
    } else {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  }
}

async function sendResetLink(){
  const contact = document.getElementById('resetContact').value.trim();
  if(!contact){ toast('Enter your phone number or email first'); return; }
  try{
    const data = await apiFetch('/auth/forgot-password', { method:'POST', auth:false, body:{ contact } });
    toast(data.message || 'Reset link sent (simulated)');
  }catch(err){
    toast(err.message);
  }
  go('auth');
}

/* ---------- PROFILE ---------- */
function renderProfileForm(){
  const picker = document.getElementById('avatarPicker');
  picker.innerHTML='';
  AVATARS.forEach(a=>{
    const sel = currentUser && currentUser.avatar===a;
    const d = document.createElement('div');
    d.className = 'avatar-opt'+(sel?' sel':'');
    d.textContent = a;
    d.onclick = ()=>{ currentUser.avatar = a; renderProfileForm(); };
    picker.appendChild(d);
  });
  if(currentUser){
    document.getElementById('profileName').value = currentUser.name;
    document.getElementById('profileContact').value = currentUser.contact;
    document.getElementById('profileLanguage').value = currentUser.language;
  }
}
async function saveProfile(){
  if(!currentUser) return;
  const name = document.getElementById('profileName').value.trim();
  const contact = document.getElementById('profileContact').value.trim();
  const language = document.getElementById('profileLanguage').value;
  try{
    const data = await apiFetch('/auth/me', { method:'PATCH', body:{ name, contact, language, avatar: currentUser.avatar } });
    currentUser = data.user;
    toast('Profile updated');
    renderNav();
    go('dashboard');
  }catch(err){ toast(err.message); }
}

/* ---------- COURSES ---------- */
async function refreshCourses(){
  const data = await apiFetch('/courses', { auth:false });
  courses = data.courses;
  renderHomeCourses();
  renderCatalog();
}

function renderHomeCourses(){
  const homeCourses = document.getElementById('homeCourses');
  homeCourses.innerHTML='';
  courses.forEach(c=>{
    homeCourses.innerHTML += `<div class="card">
      <div class="card-media">${c.icon}</div>
      <div class="card-body">
        <span class="pill ${c.color}">${c.duration}</span>
        <h4>${c.name}</h4><p>${c.description}</p>
      </div>
    </div>`;
  });
}

async function refreshEnrollments(){
  if(!currentUser || currentUser.role !== 'learner') return;
  const data = await apiFetch('/enrollments/me');
  enrollments = data.enrollments;
}
async function refreshShop(){
  if(!currentUser || currentUser.role !== 'learner') return;
  const data = await apiFetch('/shops/me');
  shop = data.shop;
}

function renderCatalog(){
  const grid = document.getElementById('courseCatalog');
  grid.innerHTML='';
  courses.forEach(c=>{
    const enrollment = enrollments.find(e=>e.course_id===c.id);
    const enrolled = !!enrollment;
    const graduated = !!(enrollment && enrollment.graduated_at);
    grid.innerHTML += `<div class="card">
      <div class="card-media">${c.icon}</div>
      <div class="card-body">
        <span class="pill ${c.color}">${c.duration}</span>
        <h4>${c.name}</h4><p>${c.description}</p>
        ${graduated ? '<p style="color:var(--mint-dark);font-weight:600;font-size:12px;margin-top:6px;">🎓 Graduated</p>' : ''}
      </div>
      <div class="card-foot">
        <span style="font-size:12px;color:var(--muted);">${c.lessons.length} lessons</span>
        <button class="btn ${enrolled?'btn-navy':'btn-primary'}" onclick="enroll('${c.id}')">${graduated ? 'Review' : enrolled ? 'Continue' : 'Enroll'}</button>
      </div>
    </div>`;
  });
}

async function enroll(id){
  if(!currentUser || currentUser.role!=='learner'){ toast('Log in as a learner first'); go('auth'); return; }
  try{
    await apiFetch('/enrollments', { method:'POST', body:{ courseId:id } });
    await refreshEnrollments();
    renderNav();
    openCourseDetail(id);
  }catch(err){ toast(err.message); }
}

function openCourseDetail(id){
  activeCourseId = id;
  quizSelected = null;
  const c = courses.find(x=>x.id===id);
  document.getElementById('courseDetailHeader').innerHTML = `
    <span class="pill ${c.color}">${c.duration}</span>
    <h2 style="font-size:26px;">${c.icon} ${c.name}</h2>
    <p style="margin-top:6px;">${c.description}</p>`;
  renderLessons(c);
  go('course-detail');
}

/* ---------- OFFLINE VIDEO DOWNLOADS ----------
   Real "download this lesson to watch offline" using the browser's Cache
   Storage API — genuinely works, no backend needed, no service worker
   required for this explicit-download pattern (only needed if you also
   want *streaming* pages to work offline, not just saved videos).

   DEMO_LESSON_VIDEO_URL is a placeholder: swap lessonVideoUrl() for a real
   per-lesson URL (e.g. l.videoUrl from the API) once real lesson videos
   are hosted. Using Blender Foundation's "Big Buck Bunny" (CC-BY 3.0) here
   only because it's a small, freely-licensed file that's safe and reliable
   to fetch for a demo — not real course content. */
const DEMO_LESSON_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const OFFLINE_CACHE_NAME = 'las-offline-videos-v1';

function lessonVideoUrl(courseId, lessonIndex){
  return DEMO_LESSON_VIDEO_URL; // one shared demo file; replace per-lesson in production
}

async function isLessonDownloaded(url){
  if(!('caches' in window)) return false;
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  return !!(await cache.match(url));
}

async function downloadLessonForOffline(courseId, lessonIndex, btnEl){
  if(!('caches' in window)){ toast('Offline downloads need a modern browser'); return; }
  const url = lessonVideoUrl(courseId, lessonIndex);
  const originalLabel = btnEl.textContent;
  btnEl.textContent = 'Downloading…'; btnEl.disabled = true;
  try{
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const response = await fetch(url);
    if(!response.ok) throw new Error('bad response');
    await cache.put(url, response);
    toast('Saved for offline viewing');
  }catch(err){
    toast('Could not download — check your connection and try again');
    btnEl.textContent = originalLabel; btnEl.disabled = false;
    return;
  }
  const c = courses.find(x=>x.id===activeCourseId);
  if(c) renderLessons(c);
}

async function removeLessonDownload(courseId, lessonIndex){
  const url = lessonVideoUrl(courseId, lessonIndex);
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  await cache.delete(url);
  toast('Removed downloaded lesson');
  const c = courses.find(x=>x.id===activeCourseId);
  if(c) renderLessons(c);
}

async function playLesson(courseId, lessonIndex, title){
  const url = lessonVideoUrl(courseId, lessonIndex);
  let src = url, offline = false;
  if('caches' in window){
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const cached = await cache.match(url);
    if(cached){ src = URL.createObjectURL(await cached.blob()); offline = true; }
  }
  openVideoModal(title, src, offline);
}

function openVideoModal(title, src, offline){
  let modal = document.getElementById('videoModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'videoModal';
    modal.className = 'video-modal';
    modal.innerHTML = `<div class="video-modal-inner">
        <div class="video-modal-head">
          <span id="videoModalTitle" style="font-weight:700;color:var(--navy-dark);"></span>
          <button class="video-modal-close" onclick="closeVideoModal()">✕</button>
        </div>
        <video id="videoModalPlayer" controls autoplay style="width:100%;border-radius:10px;display:block;"></video>
        <p id="videoModalBadge" style="font-size:12px;margin-top:8px;"></p>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('videoModalTitle').textContent = title;
  document.getElementById('videoModalPlayer').src = src;
  document.getElementById('videoModalBadge').innerHTML = offline
    ? '📥 Playing from your offline download — no data used.'
    : '📶 Streaming — download this lesson to watch it offline next time.';
  modal.classList.add('open');
}
function closeVideoModal(){
  const modal = document.getElementById('videoModal');
  if(!modal) return;
  const player = document.getElementById('videoModalPlayer');
  player.pause(); player.removeAttribute('src'); player.load();
  modal.classList.remove('open');
}

async function renderLessons(c){
  const enrollment = enrollments.find(e=>e.course_id===c.id) || { lessons_done:0, quiz_passed:false };
  const list = document.getElementById('lessonList');
  list.innerHTML='';
  for(let i=0;i<c.lessons.length;i++){
    const l = c.lessons[i];
    const done = i < enrollment.lessons_done;
    const url = lessonVideoUrl(c.id, i);
    const downloaded = await isLessonDownloaded(url);
    const row = document.createElement('div');
    row.className = 'lesson-row' + (done?' done':'');
    row.innerHTML = `
      <div class="lesson-left"><div class="check ${done?'done':''}">${done?'✓':(i+1)}</div>
      <div><div style="font-weight:600;font-size:14px;">${l.title}</div>
        <div style="font-size:12px;color:var(--muted);">Video lesson · ~8 min${downloaded?' · <span style="color:var(--mint-dark);font-weight:600;">📥 Available offline</span>':''}</div>
      </div></div>
      <div class="lesson-actions"></div>`;
    const actions = row.querySelector('.lesson-actions');

    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-outline';
    playBtn.textContent = '▶ Play';
    playBtn.onclick = () => playLesson(c.id, i, l.title);
    actions.appendChild(playBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-outline';
    if(downloaded){
      downloadBtn.textContent = '🗑 Remove download';
      downloadBtn.onclick = () => removeLessonDownload(c.id, i);
    } else {
      downloadBtn.textContent = '⬇ Download';
      downloadBtn.onclick = () => downloadLessonForOffline(c.id, i, downloadBtn);
    }
    actions.appendChild(downloadBtn);

    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn ' + (done ? 'btn-outline' : 'btn-primary');
    completeBtn.textContent = done ? 'Done' : 'Mark complete';
    completeBtn.disabled = done;
    if(done) completeBtn.style.opacity = '.5';
    completeBtn.onclick = () => completeLesson(i);
    actions.appendChild(completeBtn);

    list.appendChild(row);
  }
  const pct = Math.round((enrollment.lessons_done/c.lessons.length)*100);
  document.getElementById('progressFill').style.width = pct+'%';
  document.getElementById('progressPct').textContent = pct+'%';

  const quizArea = document.getElementById('quizArea');
  if(enrollment.lessons_done >= c.lessons.length && !enrollment.quiz_passed){
    quizArea.style.display='block';
    renderQuiz(c);
  } else {
    quizArea.style.display='none';
  }
}

async function completeLesson(i){
  const enrollment = enrollments.find(e=>e.course_id===activeCourseId);
  if(!enrollment || i !== enrollment.lessons_done) return;
  try{
    await apiFetch(`/enrollments/${activeCourseId}/lessons/complete`, { method:'POST' });
    await refreshEnrollments();
    const c = courses.find(x=>x.id===activeCourseId);
    renderLessons(c);
    toast('Lesson marked complete');
    renderNav();
    await refreshNotifications();
  }catch(err){ toast(err.message); }
}

function renderQuiz(c){
  document.getElementById('quizTitle').textContent = 'Module quiz — '+c.quiz.question;
  const opts = document.getElementById('quizOptions');
  opts.innerHTML='';
  c.quiz.options.forEach((opt,i)=>{
    const d = document.createElement('div');
    d.className='quiz-opt';
    d.textContent = opt;
    d.onclick = ()=>{
      document.querySelectorAll('.quiz-opt').forEach(o=>o.classList.remove('sel'));
      d.classList.add('sel');
      quizSelected = i;
    };
    opts.appendChild(d);
  });
}
async function submitQuiz(){
  if(quizSelected===null || quizSelected===undefined){ toast('Choose an answer first'); return; }
  try{
    const data = await apiFetch(`/enrollments/${activeCourseId}/quiz`, { method:'POST', body:{ selectedIndex: quizSelected } });
    if(data.correct){
      await refreshEnrollments();
      toast('Correct — course complete! Check your dashboard');
      renderNav();
      await refreshNotifications();
      go('dashboard');
    } else {
      toast('Not quite — try again');
    }
  }catch(err){ toast(err.message); }
}

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  const greeting = document.getElementById('dashGreeting');
  const firstName = currentUser ? currentUser.name.split(' ')[0] : 'there';
  greeting.textContent = 'Karibu, '+firstName;

  const active = enrollments.find(e=>!e.quiz_passed) || enrollments[enrollments.length-1];
  if(active){
    const c = courses.find(x=>x.id===active.course_id);
    document.getElementById('dashCourseName').textContent = active.course_name;
    const total = c ? c.lessons.length : 1;
    const pct = Math.round((active.lessons_done/total)*100);
    document.getElementById('dashProgressFill').style.width = pct+'%';
    document.getElementById('dashProgressLabel').textContent = `${active.lessons_done} of ${total} lessons complete`;
  } else {
    document.getElementById('dashCourseName').textContent = 'No course yet';
    document.getElementById('dashProgressFill').style.width = '0%';
    document.getElementById('dashProgressLabel').textContent = 'Enroll in a course to get started';
  }

  const graduated = enrollments.filter(e=>e.graduated_at);
  const certPanel = document.getElementById('certPanel');
  if(graduated.length){
    certPanel.innerHTML = `<h4 style="margin-bottom:8px;">Certificates</h4>` +
      graduated.map(e=>`<p style="font-size:13px;color:var(--mint-dark);font-weight:600;">🎓 ${e.course_name}</p>`).join('');
  } else {
    certPanel.innerHTML = `<h4 style="margin-bottom:8px;">Certificates</h4>
      <p style="font-size:13px;">Complete a course and pass its quiz to graduate.</p>`;
  }

  const lock = document.getElementById('shopLockCard');
  if(graduated.length){
    lock.classList.add('unlocked');
    if(shop){
      lock.innerHTML = `<h3 style="color:var(--navy-dark);font-size:19px;">Your shop is open 🎉</h3>
        <p style="color:var(--muted);margin-top:8px;">Manage your products and orders any time.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
          <button class="btn btn-outline" onclick="go('products')">Manage products</button>
          <button class="btn btn-primary" onclick="go('seller-orders')">View orders</button>
        </div>`;
    } else {
      lock.innerHTML = `<h3 style="color:var(--navy-dark);font-size:19px;">Shop unlocked 🎉</h3>
        <p style="color:var(--muted);margin-top:8px;">You graduated — set up your shop and start listing products.</p>
        <button class="btn btn-navy" style="margin-top:14px;" onclick="go('shop-create')">Create my shop</button>`;
    }
  } else {
    lock.classList.remove('unlocked');
    lock.innerHTML = `<h3 style="color:var(--navy-dark);font-size:19px;">Shop is locked</h3>
      <p style="color:var(--muted);margin-top:8px;">Finish your course to unlock your digital shop.</p>`;
  }
}

/* ---------- SHOP + PRODUCTS ---------- */
async function createShop(){
  const name = document.getElementById('shopName').value.trim();
  const description = document.getElementById('shopDesc').value.trim();
  const category = document.getElementById('shopCategory').value;
  const momoProvider = document.getElementById('shopMomoProvider').value;
  const momoNumber = document.getElementById('shopMomoNumber').value.trim();
  if(!name || !momoNumber){ toast('Add a shop name and mobile money number'); return; }
  try{
    const data = await apiFetch('/shops', { method:'POST', body:{ name, description, category, momoProvider, momoNumber } });
    shop = data.shop;
    document.getElementById('myShopName').textContent = shop.name;
    toast('Shop created — add your first product');
    renderNav();
    await refreshNotifications();
    go('products');
  }catch(err){ toast(err.message); }
}

function toggleAddProduct(){
  const p = document.getElementById('addProductPanel');
  const isOpening = p.style.display === 'none';
  p.style.display = isOpening ? 'block' : 'none';
  if(isOpening){
    document.getElementById('pEditId').value='';
    document.getElementById('pName').value='';
    document.getElementById('pPrice').value='';
    document.getElementById('pDesc').value='';
    document.getElementById('pSaveBtn').textContent = 'Save product';
  }
}
async function addProduct(){
  const editId = document.getElementById('pEditId').value;
  const name = document.getElementById('pName').value.trim();
  const price = document.getElementById('pPrice').value;
  const description = document.getElementById('pDesc').value.trim();
  if(!name || !price){ toast('Add a name and price'); return; }

  try{
    if(editId){
      await apiFetch(`/products/${editId}`, { method:'PUT', body:{ name, price, description } });
      toast('Product updated');
    } else {
      await apiFetch('/products', { method:'POST', body:{ name, price, description } });
      toast('Product listed');
    }
    renderNav();
    toggleAddProduct();
    await refreshNotifications();
    await renderMyProducts();
  }catch(err){ toast(err.message); }
}
function editProduct(id){
  const p = myProducts.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('addProductPanel').style.display='block';
  document.getElementById('pEditId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pPrice').value = p.price_rwf;
  document.getElementById('pDesc').value = p.description;
  document.getElementById('pSaveBtn').textContent = 'Update product';
}
async function deleteProduct(id){
  try{
    await apiFetch(`/products/${id}`, { method:'DELETE' });
    toast('Product removed');
    renderNav();
    await refreshNotifications();
    await renderMyProducts();
  }catch(err){ toast(err.message); }
}
async function toggleStock(id){
  try{
    await apiFetch(`/products/${id}/stock`, { method:'PATCH' });
    renderNav();
    await refreshNotifications();
    await renderMyProducts();
  }catch(err){ toast(err.message); }
}
async function renderMyProducts(){
  if(shop) document.getElementById('myShopName').textContent = shop.name;
  const data = await apiFetch('/products/mine');
  myProducts = data.products;
  const grid = document.getElementById('myProductGrid');
  grid.innerHTML='';
  if(myProducts.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No products yet — add your first one above.</div>`;
    return;
  }
  myProducts.forEach(p=>{
    grid.innerHTML += `<div class="card">
      <div class="card-media">🧵</div>
      <div class="card-body">
        <span class="pill ${p.in_stock?'pill-mint':'pill-amber'}">${p.in_stock?'In stock':'Out of stock'}</span>
        <h4>${p.name}</h4><p>${p.description||'Handmade item'}</p>
      </div>
      <div class="card-foot" style="flex-wrap:wrap;gap:6px;">
        <span class="price">${Number(p.price_rwf).toLocaleString()} RWF</span>
        <div>
          <button class="mini-btn" onclick="editProduct('${p.id}')">Edit</button>
          <button class="mini-btn" onclick="toggleStock('${p.id}')">${p.in_stock?'Mark out':'Mark in'}</button>
          <button class="mini-btn danger" onclick="deleteProduct('${p.id}')">Remove</button>
        </div>
      </div>
    </div>`;
  });
}

/* ---------- SELLER ORDERS + PAYOUT ---------- */
async function renderSellerOrders(){
  try{
    const earningsData = await apiFetch('/shops/me/earnings');
    document.getElementById('earningsAmount').textContent = Number(earningsData.balanceRwf).toLocaleString()+' RWF';
  }catch(err){ /* no shop yet */ }

  const data = await apiFetch('/orders/seller');
  const list = document.getElementById('sellerOrdersList');
  list.innerHTML='';
  if(data.orders.length===0){
    list.innerHTML = '<div class="empty-state">No orders for your shop yet.</div>';
    return;
  }
  data.orders.forEach(o=>{ list.innerHTML += orderCardHTML(o, true); });
}
async function requestPayout(){
  try{
    const data = await apiFetch('/shops/me/payout', { method:'POST' });
    toast(`Payout of ${Number(data.payout.amount_rwf).toLocaleString()} RWF requested via ${data.payout.momo_provider} (simulated)`);
    await renderSellerOrders();
    renderNav();
    await refreshNotifications();
  }catch(err){ toast(err.message); }
}
async function advanceOrder(orderId){
  try{
    await apiFetch(`/orders/${orderId}/advance`, { method:'PATCH' });
    await renderSellerOrders();
    renderNav();
    await refreshNotifications();
  }catch(err){ toast(err.message); }
}

function orderCardHTML(o, sellerView){
  const stages = ['processing','shipped','completed'];
  const currentIdx = stages.indexOf(o.status);
  const idShort = String(o.id).slice(0,8);
  return `<div class="order-card">
    <div class="order-top">
      <div class="order-id">Order #${idShort}</div>
      <span class="badge ${o.status==='completed'?'badge-green':'badge-amber'}">${o.status[0].toUpperCase()+o.status.slice(1)}</span>
    </div>
    <div class="order-items">${o.items.map(it=>it.name_snapshot+' — '+Number(it.price_rwf).toLocaleString()+' RWF').join(', ')}</div>
    <div class="order-items">Paid via ${o.method||'—'} · Total ${Number(o.total_rwf).toLocaleString()} RWF</div>
    <div class="order-track">
      ${stages.map((s,i)=>`<div class="track-step ${i<=currentIdx?'done':''}">${s[0].toUpperCase()+s.slice(1)}</div>`).join('')}
    </div>
    ${sellerView && o.status!=='completed' ? `<button class="btn btn-outline" style="margin-top:12px;" onclick="advanceOrder('${o.id}')">Mark as ${stages[currentIdx+1][0].toUpperCase()+stages[currentIdx+1].slice(1)}</button>` : ''}
    ${!sellerView && o.status==='completed' ? `<button class="btn btn-outline" style="margin-top:12px;" onclick="openReviewPanel('${o.id}')">Rate products</button>` : ''}
  </div>`;
}

/* ---------- MARKETPLACE ---------- */
function filterMarket(cat){
  marketFilter = cat;
  document.querySelectorAll('.mkt-filter').forEach(b=>b.classList.toggle('btn-primary', b.dataset.cat===cat));
  document.querySelectorAll('.mkt-filter').forEach(b=>b.classList.toggle('btn-outline', b.dataset.cat!==cat));
  renderMarket();
}
async function renderMarket(){
  const search = document.getElementById('marketSearch').value||'';
  const maxPrice = Number(document.getElementById('priceRange').value);
  document.getElementById('priceRangeLabel').textContent = maxPrice.toLocaleString()+' RWF';

  const params = new URLSearchParams();
  if(marketFilter !== 'All') params.set('category', marketFilter);
  if(search) params.set('search', search);
  params.set('maxPrice', maxPrice);

  const data = await apiFetch('/products?'+params.toString(), { auth:false });
  const grid = document.getElementById('marketGrid');
  grid.innerHTML='';
  if(data.products.length===0){
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No products match your search.</div>';
    return;
  }
  data.products.forEach(p=>{
    const avg = Number(p.avg_rating);
    const count = Number(p.review_count);
    grid.innerHTML += `<div class="card">
      <div class="card-media">🧵</div>
      <div class="card-body">
        <span class="pill pill-blue">${p.category}</span>
        <h4>${p.name}</h4><p>${p.description}</p>
        <p style="font-size:12px;margin-top:8px;color:var(--muted);">${count ? `★ ${avg} (${count} review${count>1?'s':''})` : 'No reviews yet'}</p>
      </div>
      <div class="card-foot">
        <span class="price">${Number(p.price_rwf).toLocaleString()} RWF</span>
        <button class="btn btn-primary" onclick='addToCart(${JSON.stringify(p.id)}, ${JSON.stringify(p.name)}, ${p.price_rwf})'>Add to cart</button>
      </div>
    </div>`;
  });
}
function addToCart(productId, name, price){
  if(!currentUser || currentUser.role!=='buyer'){ toast('Log in as a buyer first'); go('auth'); return; }
  cart.push({productId, name, price});
  toast(name+' added to cart');
}
function renderCart(){
  const wrap = document.getElementById('cartItems');
  wrap.innerHTML='';
  if(cart.length===0){
    wrap.innerHTML = '<p>Your cart is empty — visit the marketplace to add items.</p>';
  }
  let total=0;
  cart.forEach(item=>{
    total += item.price;
    wrap.innerHTML += `<div class="cart-item"><span>${item.name}</span><span>${Number(item.price).toLocaleString()} RWF</span></div>`;
  });
  document.getElementById('cartTotal').textContent = total.toLocaleString()+' RWF';
}
async function checkout(){
  if(cart.length===0){ toast('Your cart is empty'); return; }
  const method = document.getElementById('payMethod').value;
  const phone = document.getElementById('payPhone').value.trim();
  if(!phone){ toast('Enter the mobile money number to pay from'); return; }
  try{
    const data = await apiFetch('/orders/checkout', { method:'POST', body:{ items: cart, method, phone } });
    toast('Payment confirmed via '+method+' (simulated) — order #'+String(data.order.id).slice(0,8)+' placed');
    cart = [];
    renderCart();
    renderNav();
    await refreshNotifications();
    go('my-orders');
  }catch(err){ toast(err.message); }
}

/* ---------- BUYER ORDERS ---------- */
let myOrdersCache = [];
async function renderMyOrders(){
  const data = await apiFetch('/orders/mine');
  myOrdersCache = data.orders;
  const list = document.getElementById('myOrdersList');
  list.innerHTML='';
  if(myOrdersCache.length===0){
    list.innerHTML = '<div class="empty-state">You haven\'t placed any orders yet.</div>';
    return;
  }
  myOrdersCache.forEach(o=>{ list.innerHTML += orderCardHTML(o, false); });
}

function openReviewPanel(orderId){
  const order = myOrdersCache.find(o=>String(o.id)===String(orderId));
  if(!order){ return; }
  const panel = document.getElementById('reviewPanel');
  const productSelect = document.getElementById('reviewProduct');
  productSelect.innerHTML = '';
  order.items.forEach(item=>{
    productSelect.innerHTML += `<option value="${item.name_snapshot}">${item.name_snapshot}</option>`;
  });
  document.getElementById('reviewOrderId').value = String(order.id);
  document.getElementById('reviewRating').value = '5';
  document.getElementById('reviewComment').value = '';
  panel.style.display = 'block';
}
function closeReviewPanel(){
  document.getElementById('reviewPanel').style.display = 'none';
  document.getElementById('reviewOrderId').value = '';
}
async function submitReview(){
  const orderId = document.getElementById('reviewOrderId').value;
  const productName = document.getElementById('reviewProduct').value;
  const rating = Number(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value.trim();
  if(!orderId || !productName){ toast('Choose an order product to review'); return; }
  try{
    await apiFetch('/reviews', { method:'POST', body:{ orderId, productName, rating, comment } });
    toast('Review submitted');
    closeReviewPanel();
    renderMarket();
    renderMyOrders();
    renderNav();
    await refreshNotifications();
  }catch(err){ toast(err.message); }
}

/* ---------- NOTIFICATIONS ---------- */
async function refreshNotifications(){
  if(!currentUser) return;
  const data = await apiFetch('/notifications');
  notifications = data.notifications;
  renderNav();
}
function renderNotifications(){
  const list = document.getElementById('notificationList');
  if(!list){ return; }
  if(notifications.length===0){
    list.innerHTML = '<div class="notify-empty">No notifications yet.</div>';
    return;
  }
  list.innerHTML = '';
  notifications.forEach(n=>{
    list.innerHTML += `<div class="notify-card ${n.read ? '' : 'unread'}">
      <div class="notify-top">
        <div class="notify-text">${n.text}</div>
        <div class="notify-time">${new Date(n.created_at).toLocaleString()}</div>
      </div>
    </div>`;
  });
  markAllNotificationsRead(true);
}
async function markAllNotificationsRead(silent){
  await apiFetch('/notifications/read-all', { method:'PATCH' });
  notifications.forEach(n=>{ n.read = true; });
  renderNav();
  if(!silent) toast('All notifications marked as read');
}

/* ---------- ADMIN ---------- */
const ADMIN_TABS = [
  {id:'overview', label:'Overview'},
  {id:'courses', label:'Courses'},
  {id:'users', label:'Users'},
  {id:'products', label:'Products'},
  {id:'reports', label:'Reports'},
];
function renderAdminSubtabs(){
  const wrap = document.getElementById('adminSubtabs');
  wrap.innerHTML='';
  ADMIN_TABS.forEach(t=>{
    const d = document.createElement('div');
    d.className='subtab'; d.textContent=t.label; d.dataset.id=t.id;
    d.onclick = ()=>showAdminTab(t.id);
    wrap.appendChild(d);
  });
}
function showAdminTab(id){
  renderAdminSubtabs();
  document.querySelectorAll('.admin-pane').forEach(p=>p.style.display='none');
  document.getElementById('admin-'+id).style.display='block';
  document.querySelectorAll('.subtab').forEach(t=>t.classList.toggle('active', t.dataset.id===id));

  if(id==='overview') renderAdminOverview();
  if(id==='courses') renderAdminCourses();
  if(id==='users') renderAdminUsers();
  if(id==='products') renderAdminProducts();
  if(id==='reports') renderAdminReports();
}
async function renderAdminOverview(){
  const data = await apiFetch('/admin/overview');
  document.getElementById('statLearners').textContent = data.users;
  document.getElementById('statCourses').textContent = data.courses;
  document.getElementById('statProducts').textContent = data.products;
  document.getElementById('statOrders').textContent = data.orders;
}
function toggleAddCourse(){
  const p = document.getElementById('addCoursePanel');
  p.style.display = p.style.display==='none' ? 'block' : 'none';
}
async function addCourse(){
  const name = document.getElementById('cName').value.trim();
  const duration = document.getElementById('cDuration').value.trim();
  const description = document.getElementById('cDesc').value.trim();
  if(!name || !duration){ toast('Add a course name and duration'); return; }
  try{
    await apiFetch('/courses', { method:'POST', body:{
      name, duration, description, icon:'🧶', color:'pill-blue',
      lessons:['Introduction','Core technique','Practice project','Finishing touches'],
      quiz:{ question:'Quick check', options:['Follow the steps carefully','Skip steps to finish faster','Ignore instructions'], correct:0 }
    }});
    toggleAddCourse();
    document.getElementById('cName').value=''; document.getElementById('cDuration').value=''; document.getElementById('cDesc').value='';
    await refreshCourses();
    renderAdminCourses();
    toast('Course added');
    renderNav();
  }catch(err){ toast(err.message); }
}
async function deleteCourse(id){
  try{
    await apiFetch(`/courses/${id}`, { method:'DELETE' });
    await refreshCourses();
    renderAdminCourses();
    toast('Course removed');
    renderNav();
  }catch(err){ toast(err.message); }
}
function renderAdminCourses(){
  const table = document.getElementById('adminCoursesTable');
  table.innerHTML = '<tr><th>Course</th><th>Duration</th><th>Lessons</th><th></th></tr>';
  courses.forEach(c=>{
    table.innerHTML += `<tr><td>${c.icon} ${c.name}</td><td>${c.duration}</td><td>${c.lessons.length}</td>
      <td><button class="mini-btn danger" onclick="deleteCourse('${c.id}')">Remove</button></td></tr>`;
  });
}
async function toggleUserActive(userId){
  try{
    const data = await apiFetch(`/admin/users/${userId}/toggle-active`, { method:'PATCH' });
    toast(`User ${data.user.name} was ${data.user.active ? 'reactivated' : 'suspended'}`);
    renderAdminUsers();
  }catch(err){ toast(err.message); }
}
async function renderAdminUsers(){
  const data = await apiFetch('/admin/users');
  const table = document.getElementById('adminUsersTable');
  table.innerHTML = '<tr><th>Name</th><th>Contact</th><th>Role</th><th>Language</th><th>Status</th><th></th></tr>';
  if(data.users.length===0){
    table.innerHTML += '<tr><td colspan="6" style="color:var(--muted);">No one has registered yet.</td></tr>';
    return;
  }
  data.users.forEach(u=>{
    table.innerHTML += `<tr><td>${u.name}</td><td>${u.contact}</td><td style="text-transform:capitalize;">${u.role}</td><td>${u.language}</td>
      <td><span class="badge ${u.active?'badge-green':'badge-gray'}">${u.active?'Active':'Suspended'}</span></td>
      <td><button class="mini-btn" onclick="toggleUserActive('${u.id}')">${u.active?'Suspend':'Reactivate'}</button></td></tr>`;
  });
}
async function removeMarketProduct(id){
  try{
    await apiFetch(`/admin/products/${id}`, { method:'DELETE' });
    renderAdminProducts();
    toast('Product removed by admin');
    renderNav();
  }catch(err){ toast(err.message); }
}
async function renderAdminProducts(){
  const data = await apiFetch('/admin/products');
  const table = document.getElementById('adminProductsTable');
  table.innerHTML = '<tr><th>Product</th><th>Shop</th><th>Category</th><th>Price</th><th></th></tr>';
  data.products.forEach(p=>{
    table.innerHTML += `<tr><td>${p.name}</td><td>${p.shop_name||'—'}</td><td>${p.category}</td><td>${Number(p.price_rwf).toLocaleString()} RWF</td>
      <td><button class="mini-btn danger" onclick="removeMarketProduct('${p.id}')">Remove</button></td></tr>`;
  });
}
async function renderAdminReports(){
  const data = await apiFetch('/admin/reports');
  const enrollBox = document.getElementById('reportEnrollment');
  enrollBox.innerHTML = data.enrollmentByCourse.map(r=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);"><span>${r.name}</span><span>${r.active} active</span></div>`).join('');
  const s = data.sales;
  document.getElementById('reportSales').innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);"><span>Total orders</span><span>${s.total_orders}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);"><span>Completed orders</span><span>${s.completed_orders}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;"><span>Total sales value</span><span>${Number(s.total_sales_rwf).toLocaleString()} RWF</span></div>`;
}

/* ---------- INIT ---------- */
async function init(){
  renderNav();
  try{
    await refreshCourses();
  }catch(err){
    if (err.status === 0) {
      toast('Could not reach the backend — check config.js / that the API is running');
    } else {
      toast(err.message || 'Backend error while loading courses');
    }
  }
  if(authToken){
    try{
      const data = await apiFetch('/auth/me');
      currentUser = data.user;
      await refreshNotifications();
      if(currentUser.role === 'learner') await Promise.all([refreshEnrollments(), refreshShop()]);
      renderCatalog();
      renderNav();
    }catch(err){
      // stored token is invalid/expired
      authToken = null;
      localStorage.removeItem('las_token');
    }
  }
}
init();
