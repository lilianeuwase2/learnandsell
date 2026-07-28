/* ---------- DATA ---------- */
const NAV_ITEMS = [
  {id:'home', label:'Home', roles:['guest','learner','buyer','admin']},
  {id:'courses', label:'Courses', roles:['guest','learner']},
  {id:'marketplace', label:'Marketplace', roles:['guest','learner','buyer']},
  {id:'cart', label:'Cart', roles:['learner','buyer']},
  {id:'dashboard', label:'Dashboard', roles:['learner']},
  {id:'seller-orders', label:'Shop orders', roles:['learner']},
  {id:'my-orders', label:'My orders', roles:['learner','buyer']},
  {id:'notifications', label:'Notifications', roles:['learner','buyer','admin']},
  {id:'admin', label:'Admin', roles:['admin']},
];

let COURSES = [
  {id:'tailoring', name:'Tailoring', icon:'🧵', color:'pill-mint', duration:'6 weeks',
    desc:'Cut, sew and finish garments from measurement to hem.',
    lessons:['Reading a measuring tape','Cutting your first pattern','Machine stitching basics','Finishing seams and hems'],
    quiz:{q:"What's the safest way to finish your first seam?", options:['Sew slowly and check tension every few stitches','Sew as fast as possible to save thread','Skip the backstitch at the end'], correct:0}},
  {id:'beading', name:'Beading', icon:'📿', color:'pill-amber', duration:'3 weeks',
    desc:'Design and string beaded jewellery and accessories.',
    lessons:['Bead types and tools','Stringing techniques','Pattern design','Clasps and finishing'],
    quiz:{q:'Why knot between beads on a bracelet?', options:['It looks decorative only','It stops the whole strand unravelling if one part breaks','It is not necessary'], correct:1}},
  {id:'basket', name:'Basket weaving', icon:'🧺', color:'pill-blue', duration:'4 weeks',
    desc:'Traditional Rwandan weaving using sisal and banana fibre.',
    lessons:['Preparing fibre','Base weaving','Building the walls','Rim finishing'],
    quiz:{q:'Why soak fibre before weaving?', options:['To make it more flexible and less likely to crack', 'To change its colour', 'It is optional and rarely done'], correct:0}},
];

const DEMO_PRODUCTS = [
  {id:'d1', name:'Kitenge wrap dress', price:18000, category:'Tailoring', desc:'Hand-sewn, made to size', icon:'🧵', shop:'Demo Sellers', stock:true},
  {id:'d2', name:'School uniform set', price:12000, category:'Tailoring', desc:'Durable cotton blend', icon:'🧵', shop:'Demo Sellers', stock:true},
  {id:'d3', name:'Beaded choker necklace', price:6000, category:'Beading', desc:'Layered glass beads', icon:'📿', shop:'Demo Sellers', stock:true},
  {id:'d4', name:'Beaded bracelet set', price:4500, category:'Beading', desc:'Set of three, adjustable', icon:'📿', shop:'Demo Sellers', stock:true},
  {id:'d5', name:'Woven storage basket', price:9000, category:'Basket weaving', desc:'Sisal and banana fibre', icon:'🧺', shop:'Demo Sellers', stock:true},
  {id:'d6', name:'Table mat set', price:7000, category:'Basket weaving', desc:'Set of four, hand-dyed', icon:'🧺', shop:'Demo Sellers', stock:true},
];

const AVATARS = ['🙂','👩🏾','👩🏽‍🦱','🧕🏾','👩🏿‍🦰'];

/* ---------- STATE ---------- */
let state = {
  role: 'learner',
  loggedIn: false,
  currentUser: null,      // {name, contact, language, avatar}
  enrolledCourse: null,
  lessonsDone: 0,
  quizPassed: false,
  quizSelected: null,
  certificates: [],       // course ids graduated
  shop: null,             // {name, desc, category, momoProvider, momoNumber}
  products: [],           // this seller's products
  cart: [],
  earnings: 0,
  reviews: [],
  notifications: [],
};

let registeredUsers = [];      // mock user "database"
let allOrders = [];            // every order placed on the platform
let orderCounter = 1000;
let pendingPayment = null;

/* ---------- UTIL ---------- */
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1900);
}

function currentRole(){ return state.loggedIn ? state.role : 'guest'; }

function canUseMarketplaceCheckout(){
  return state.loggedIn && (state.role === 'buyer' || state.role === 'learner');
}

function pushNotification(text){
  state.notifications.unshift({
    id: 'n'+Date.now()+Math.floor(Math.random()*1000),
    text,
    time: new Date().toLocaleString(),
    read: false
  });
}

function getUnreadNotificationCount(){
  return state.notifications.filter(n=>!n.read).length;
}

function renderNav(){
  const navLinks = document.getElementById('navLinks');
  navLinks.innerHTML = '';
  NAV_ITEMS.filter(i=>i.roles.includes(currentRole())).forEach(item=>{
    const a = document.createElement('a');
    a.href='#'; a.className='nav-link';
    if(item.id === 'notifications'){
      const unread = getUnreadNotificationCount();
      a.textContent = unread ? `${item.label} (${unread})` : item.label;
    } else if(item.id === 'cart'){
      const cartCount = state.cart.length;
      a.textContent = cartCount ? `${item.label} (${cartCount})` : item.label;
    } else {
      a.textContent = item.label;
    }
    a.dataset.id = item.id;
    a.onclick=(e)=>{e.preventDefault(); go(item.id);};
    navLinks.appendChild(a);
  });
  document.getElementById('loginBtn').style.display = state.loggedIn ? 'none' : 'inline-block';
  document.getElementById('logoutBtn').style.display = state.loggedIn ? 'inline-block' : 'none';
  document.getElementById('profileBtn').style.display = state.loggedIn ? 'inline-block' : 'none';
}

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
  state.loggedIn=false; state.currentUser=null; state.role='learner';
  renderNav(); go('home');
  toast('Logged out');
}

/* ---------- AUTH ---------- */
const roleToggle = document.getElementById('roleToggle');
['learner','buyer','admin'].forEach(r=>{
  const d = document.createElement('div');
  d.className = 'role-opt'+(r==='learner'?' sel':'');
  d.textContent = r==='learner' ? 'Learner / seller' : r==='buyer' ? 'Buyer' : 'Admin';
  d.dataset.role = r;
  d.onclick = ()=>{
    document.querySelectorAll('.role-opt').forEach(o=>o.classList.remove('sel'));
    d.classList.add('sel'); state.role = r;
  };
  roleToggle.appendChild(d);
});

function loginAs(){
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

  state.loggedIn = true;
  state.currentUser = {name, contact, language, avatar: AVATARS[0]};
  registeredUsers.push({name, contact, role: state.role, language, active:true});
  pushNotification(`Welcome ${name.split(' ')[0]}! Your ${state.role} account is ready.`);

  toast('Welcome '+name.split(' ')[0]+' — logged in as '+state.role);
  renderNav();
  if(state.role==='admin') go('admin');
  else if(state.role==='buyer') go('marketplace');
  else go('dashboard');
}

function sendResetLink(){
  const contact = document.getElementById('resetContact').value.trim();
  if(!contact){ toast('Enter your phone number or email first'); return; }
  pushNotification(`Password reset link sent to ${contact}.`);
  toast('Reset link sent to '+contact+' (check your inbox)');
  renderNav();
  go('auth');
}

/* ---------- PROFILE ---------- */
function renderProfileForm(){
  const picker = document.getElementById('avatarPicker');
  picker.innerHTML='';
  AVATARS.forEach(a=>{
    const sel = state.currentUser && state.currentUser.avatar===a;
    const d = document.createElement('div');
    d.className = 'avatar-opt'+(sel?' sel':'');
    d.textContent = a;
    d.onclick = ()=>{ state.currentUser.avatar = a; renderProfileForm(); };
    picker.appendChild(d);
  });
  if(state.currentUser){
    document.getElementById('profileName').value = state.currentUser.name;
    document.getElementById('profileContact').value = state.currentUser.contact;
    document.getElementById('profileLanguage').value = state.currentUser.language;
  }
}
function saveProfile(){
  if(!state.currentUser) return;
  state.currentUser.name = document.getElementById('profileName').value.trim() || state.currentUser.name;
  state.currentUser.contact = document.getElementById('profileContact').value.trim() || state.currentUser.contact;
  state.currentUser.language = document.getElementById('profileLanguage').value;
  pushNotification('Your profile was updated successfully.');
  toast('Profile updated');
  renderNav();
  go('dashboard');
}

/* ---------- HOME TEASERS ---------- */
function renderHomeCourses(){
  const homeCourses = document.getElementById('homeCourses');
  homeCourses.innerHTML='';
  COURSES.forEach(c=>{
    homeCourses.innerHTML += `<div class="card">
      <div class="card-media" style="background:var(--sky-deep);">${c.icon}</div>
      <div class="card-body">
        <span class="pill ${c.color}">${c.duration}</span>
        <h4>${c.name}</h4><p>${c.desc}</p>
      </div>
    </div>`;
  });
}

/* ---------- COURSE CATALOG ---------- */
function renderCatalog(){
  const grid = document.getElementById('courseCatalog');
  grid.innerHTML='';
  COURSES.forEach(c=>{
    const enrolled = state.enrolledCourse===c.id;
    const graduated = state.certificates.includes(c.id);
    grid.innerHTML += `<div class="card">
      <div class="card-media" style="background:var(--sky-deep);">${c.icon}</div>
      <div class="card-body">
        <span class="pill ${c.color}">${c.duration}</span>
        <h4>${c.name}</h4><p>${c.desc}</p>
        ${graduated ? '<p style="color:var(--mint-dark);font-weight:600;font-size:12px;margin-top:6px;">🎓 Graduated</p>' : ''}
      </div>
      <div class="card-foot">
        <span style="font-size:12px;color:var(--muted);">${c.lessons.length} lessons</span>
        <button class="btn ${enrolled?'btn-navy':'btn-primary'}" onclick="enroll('${c.id}')">${graduated ? 'Review' : enrolled ? 'Continue' : 'Enroll'}</button>
      </div>
    </div>`;
  });
}

function enroll(id){
  if(!state.loggedIn || state.role!=='learner'){ toast('Log in as a learner first'); go('auth'); return; }
  if(state.enrolledCourse && state.enrolledCourse!==id && !state.quizPassed){
    toast("You're mid-course — finish it before starting another");
    return;
  }
  if(state.enrolledCourse !== id){
    state.enrolledCourse = id;
    state.lessonsDone = state.certificates.includes(id) ? COURSES.find(c=>c.id===id).lessons.length : 0;
    state.quizPassed = state.certificates.includes(id);
    state.quizSelected = null;
    const course = COURSES.find(c=>c.id===id);
    if(course) pushNotification(`Enrolled in ${course.name}. Start your first lesson.`);
  }
  renderNav();
  openCourseDetail(id);
}

function openCourseDetail(id){
  const c = COURSES.find(x=>x.id===id);
  document.getElementById('courseDetailHeader').innerHTML = `
    <span class="pill ${c.color}">${c.duration}</span>
    <h2 style="font-size:26px;">${c.icon} ${c.name}</h2>
    <p style="margin-top:6px;">${c.desc}</p>`;
  renderLessons(c);
  go('course-detail');
}

function renderLessons(c){
  const list = document.getElementById('lessonList');
  list.innerHTML='';
  c.lessons.forEach((l,i)=>{
    const done = i < state.lessonsDone;
    list.innerHTML += `<div class="lesson-row ${done?'done':''}">
      <div class="lesson-left"><div class="check ${done?'done':''}">${done?'✓':(i+1)}</div>
      <div><div style="font-weight:600;font-size:14px;">${l}</div><div style="font-size:12px;color:var(--muted);">Video lesson · ~8 min</div></div></div>
      <button class="btn btn-outline" onclick="completeLesson(${i})" ${done?'disabled style="opacity:.5"':''}>${done?'Done':'Watch'}</button>
    </div>`;
  });
  updateProgress(c);
  const quizArea = document.getElementById('quizArea');
  if(state.lessonsDone >= c.lessons.length && !state.quizPassed){
    quizArea.style.display='block';
    renderQuiz(c);
  } else {
    quizArea.style.display='none';
  }
}

function completeLesson(i){
  if(i===state.lessonsDone){
    state.lessonsDone++;
    const c = COURSES.find(x=>x.id===state.enrolledCourse);
    renderLessons(c);
    if(c) pushNotification(`Lesson completed in ${c.name} (${state.lessonsDone}/${c.lessons.length}).`);
    toast('Lesson marked complete');
    renderNav();
  }
}
function updateProgress(c){
  const pct = Math.round((state.lessonsDone/c.lessons.length)*100);
  document.getElementById('progressFill').style.width = pct+'%';
  document.getElementById('progressPct').textContent = pct+'%';
}

function renderQuiz(c){
  document.getElementById('quizTitle').textContent = 'Module quiz — '+c.quiz.q;
  const opts = document.getElementById('quizOptions');
  opts.innerHTML='';
  c.quiz.options.forEach((opt,i)=>{
    const d = document.createElement('div');
    d.className='quiz-opt';
    d.textContent = opt;
    d.onclick = ()=>{
      document.querySelectorAll('.quiz-opt').forEach(o=>o.classList.remove('sel'));
      d.classList.add('sel');
      state.quizSelected = i;
    };
    opts.appendChild(d);
  });
}
function submitQuiz(){
  if(state.quizSelected===null || state.quizSelected===undefined){ toast('Choose an answer first'); return; }
  const c = COURSES.find(x=>x.id===state.enrolledCourse);
  if(state.quizSelected === c.quiz.correct){
    state.quizPassed = true;
    if(!state.certificates.includes(c.id)) state.certificates.push(c.id);
    pushNotification(`Congratulations! You graduated from ${c.name} and your shop is now unlocked.`);
    toast('Correct — course complete! Check your dashboard');
    renderNav();
    go('dashboard');
  } else {
    toast('Not quite — try again');
  }
}

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  const greeting = document.getElementById('dashGreeting');
  const firstName = state.currentUser ? state.currentUser.name.split(' ')[0] : 'there';
  greeting.textContent = 'Karibu, '+firstName;

  const c = COURSES.find(x=>x.id===state.enrolledCourse);
  if(c){
    document.getElementById('dashCourseName').textContent = c.name;
    const pct = Math.round((state.lessonsDone/c.lessons.length)*100);
    document.getElementById('dashProgressFill').style.width = pct+'%';
    document.getElementById('dashProgressLabel').textContent = `${state.lessonsDone} of ${c.lessons.length} lessons complete`;
  } else {
    document.getElementById('dashCourseName').textContent = 'No course yet';
    document.getElementById('dashProgressFill').style.width = '0%';
    document.getElementById('dashProgressLabel').textContent = 'Enroll in a course to get started';
  }

  const certPanel = document.getElementById('certPanel');
  if(state.certificates.length){
    certPanel.innerHTML = `<h4 style="margin-bottom:8px;">Certificates</h4>` +
      state.certificates.map(id=>{
        const cc = COURSES.find(x=>x.id===id);
        return `<p style="font-size:13px;color:var(--mint-dark);font-weight:600;">🎓 ${cc.name}</p>`;
      }).join('');
  } else {
    certPanel.innerHTML = `<h4 style="margin-bottom:8px;">Certificates</h4>
      <p style="font-size:13px;">Complete a course and pass its quiz to graduate.</p>`;
  }

  const lock = document.getElementById('shopLockCard');
  if(state.certificates.length){
    lock.classList.add('unlocked');
    if(state.shop){
      lock.innerHTML = `<h3 style="color:var(--navy-dark);font-size:19px;">Your shop is open 🎉</h3>
        <p style="color:var(--muted);margin-top:8px;">Manage your products and orders any time.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
          <button class="btn" style="background:white;color:var(--navy-dark);border:1px solid var(--line);" onclick="go('products')">Manage products</button>
          <button class="btn" style="background:#E9EFF6;color:var(--navy-dark);" onclick="go('seller-orders')">View orders</button>
        </div>`;
    } else {
      lock.innerHTML = `<h3 style="color:var(--navy-dark);font-size:19px;">Shop unlocked 🎉</h3>
        <p style="color:var(--muted);margin-top:8px;">You graduated — set up your shop and start listing products.</p>
        <button class="btn" style="background:white;color:var(--navy-dark);border:1px solid var(--line);margin-top:14px;" onclick="go('shop-create')">Create my shop</button>`;
    }
  } else {
    lock.classList.remove('unlocked');
    lock.innerHTML = `<h3 style="color:var(--navy-dark);font-size:19px;">Shop is locked</h3>
      <p style="color:var(--muted);margin-top:8px;">Finish your course to unlock your digital shop.</p>`;
  }
}

/* ---------- SHOP + PRODUCTS ---------- */
function createShop(){
  if(!state.loggedIn || state.role!=='learner'){ toast('Log in as a learner first'); go('auth'); return; }
  const ownerName = state.currentUser ? state.currentUser.name.split(' ')[0] : 'My';
  const name = document.getElementById('shopName').value || `${ownerName}'s Shop`;
  const desc = document.getElementById('shopDesc').value || 'Handmade craft, made to order';
  const category = document.getElementById('shopCategory').value;
  const momoProvider = document.getElementById('shopMomoProvider').value;
  const momoNumber = document.getElementById('shopMomoNumber').value;
  state.shop = {name, desc, category, momoProvider, momoNumber};
  document.getElementById('myShopName').textContent = name;
  pushNotification(`Shop "${name}" created and linked to ${momoProvider}.`);
  toast('Shop created — add your first product');
  renderNav();
  go('products');
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
function addProduct(){
  if(!state.loggedIn || state.role!=='learner'){ toast('Log in as a learner first'); go('auth'); return; }
  const editId = document.getElementById('pEditId').value;
  const name = document.getElementById('pName').value.trim();
  const price = document.getElementById('pPrice').value;
  const desc = document.getElementById('pDesc').value.trim();
  if(!name || !price){ toast('Add a name and price'); return; }

  if(editId){
    const p = state.products.find(x=>x.id===editId);
    if(p){ p.name=name; p.price=Number(price); p.desc=desc; }
    pushNotification(`Product "${name}" was updated.`);
    toast('Product updated');
  } else {
    state.products.push({
      id: 'p'+Date.now(), name, price:Number(price), desc,
      category: state.shop ? state.shop.category : 'Tailoring',
      stock:true, shop: state.shop ? state.shop.name : 'My shop'
    });
    pushNotification(`Product "${name}" was listed in your shop.`);
    toast('Product listed');
  }
  renderNav();
  toggleAddProduct();
  renderMyProducts();
}
function editProduct(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('addProductPanel').style.display='block';
  document.getElementById('pEditId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pDesc').value = p.desc;
  document.getElementById('pSaveBtn').textContent = 'Update product';
}
function deleteProduct(id){
  const p = state.products.find(x=>x.id===id);
  state.products = state.products.filter(x=>x.id!==id);
  renderMyProducts();
  if(p) pushNotification(`Product "${p.name}" was removed from your shop.`);
  toast('Product removed');
  renderNav();
}
function toggleStock(id){
  const p = state.products.find(x=>x.id===id);
  if(p){
    p.stock = !p.stock;
    pushNotification(`Product "${p.name}" marked as ${p.stock ? 'in stock' : 'out of stock'}.`);
  }
  renderMyProducts();
  renderNav();
}
function renderMyProducts(){
  if(state.shop) document.getElementById('myShopName').textContent = state.shop.name;
  const grid = document.getElementById('myProductGrid');
  grid.innerHTML='';
  if(state.products.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No products yet — add your first one above.</div>`;
    return;
  }
  state.products.forEach(p=>{
    grid.innerHTML += `<div class="card">
      <div class="card-media" style="background:var(--sky-deep);">🧵</div>
      <div class="card-body">
        <span class="pill ${p.stock?'pill-mint':'pill-amber'}">${p.stock?'In stock':'Out of stock'}</span>
        <h4>${p.name}</h4><p>${p.desc||'Handmade item'}</p>
      </div>
      <div class="card-foot" style="flex-wrap:wrap;gap:6px;">
        <span class="price">${p.price.toLocaleString()} RWF</span>
        <div>
          <button class="mini-btn" onclick="editProduct('${p.id}')">Edit</button>
          <button class="mini-btn" onclick="toggleStock('${p.id}')">${p.stock?'Mark out':'Mark in'}</button>
          <button class="mini-btn danger" onclick="deleteProduct('${p.id}')">Remove</button>
        </div>
      </div>
    </div>`;
  });
}

/* ---------- SELLER ORDERS + PAYOUT ---------- */
function renderSellerOrders(){
  document.getElementById('earningsAmount').textContent = state.earnings.toLocaleString()+' RWF';
  const myProductNames = state.products.map(p=>p.name);
  const relevant = allOrders.filter(o=>o.items.some(it=>myProductNames.includes(it.name)));
  const list = document.getElementById('sellerOrdersList');
  list.innerHTML='';
  if(relevant.length===0){
    list.innerHTML = '<div class="empty-state">No orders for your shop yet.</div>';
    return;
  }
  relevant.forEach(o=>{
    list.innerHTML += orderCardHTML(o, true);
  });
}
function requestPayout(){
  if(state.earnings<=0){ toast('No completed-order balance to pay out yet'); return; }
  const method = state.shop ? state.shop.momoProvider : 'MTN MoMo';
  pushNotification(`Payout request submitted: ${state.earnings.toLocaleString()} RWF via ${method}.`);
  toast(`Payout of ${state.earnings.toLocaleString()} RWF requested via ${method}`);
  state.earnings = 0;
  renderSellerOrders();
  renderNav();
}
function advanceOrder(orderId){
  const o = allOrders.find(x=>x.id===orderId);
  if(!o) return;
  const stages = ['Processing','Shipped','Completed'];
  const idx = stages.indexOf(o.status);
  if(idx < stages.length-1){
    o.status = stages[idx+1];
    pushNotification(`Order #${o.id} moved to ${o.status}.`);
    if(o.status==='Completed'){
      const myProductNames = state.products.map(p=>p.name);
      const mine = o.items.filter(it=>myProductNames.includes(it.name));
      state.earnings += mine.reduce((s,it)=>s+it.price,0);
    }
  }
  renderSellerOrders();
  renderNav();
}

function orderCardHTML(o, sellerView){
  const stages = ['Processing','Shipped','Completed'];
  const currentIdx = stages.indexOf(o.status);
  const hasReview = o.items.every(it=>state.reviews.some(r=>r.orderId===o.id && r.productName===it.name));
  return `<div class="order-card">
    <div class="order-top">
      <div class="order-id">Order #${o.id}</div>
      <span class="badge ${o.status==='Completed'?'badge-green':'badge-amber'}">${o.status}</span>
    </div>
    <div class="order-items">${o.items.map(it=>it.name+' — '+it.price.toLocaleString()+' RWF').join(', ')}</div>
    <div class="order-items">Paid via ${o.method} · Total ${o.total.toLocaleString()} RWF</div>
    <div class="order-track">
      ${stages.map((s,i)=>`<div class="track-step ${i<=currentIdx?'done':''}">${s}</div>`).join('')}
    </div>
    ${sellerView && o.status!=='Completed' ? `<button class="btn btn-outline" style="margin-top:12px;" onclick="advanceOrder('${o.id}')">Mark as ${stages[currentIdx+1]}</button>` : ''}
    ${!sellerView && o.status==='Completed' ? `<button class="btn btn-outline" style="margin-top:12px;" onclick="openReviewPanel('${o.id}')">${hasReview ? 'Update review' : 'Rate products'}</button>` : ''}
  </div>`;
}

/* ---------- MARKETPLACE ---------- */
let marketFilter = 'All';
function filterMarket(cat){ marketFilter = cat; renderMarket(); }
function renderMarket(){
  const search = (document.getElementById('marketSearch').value||'').toLowerCase();
  const maxPrice = Number(document.getElementById('priceRange').value);
  document.getElementById('priceRangeLabel').textContent = maxPrice.toLocaleString()+' RWF';

  const all = [...DEMO_PRODUCTS, ...state.products];
  let list = marketFilter==='All' ? all : all.filter(p=>p.category===marketFilter);
  list = list.filter(p=>p.stock !== false && p.price<=maxPrice);
  if(search) list = list.filter(p=>p.name.toLowerCase().includes(search));

  const grid = document.getElementById('marketGrid');
  grid.innerHTML='';
  if(list.length===0){
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No products match your search.</div>';
    return;
  }
  list.forEach(p=>{
    const productReviews = state.reviews.filter(r=>r.productName===p.name);
    const avgRating = productReviews.length
      ? (productReviews.reduce((sum,r)=>sum+r.rating,0) / productReviews.length).toFixed(1)
      : null;
    grid.innerHTML += `<div class="card">
      <div class="card-media" style="background:var(--sky-deep);">${p.icon||'🧵'}</div>
      <div class="card-body">
        <span class="pill pill-blue">${p.category}</span>
        <h4>${p.name}</h4><p>${p.desc}</p>
        <p style="font-size:12px;margin-top:8px;color:var(--muted);">${avgRating ? `★ ${avgRating} (${productReviews.length} review${productReviews.length>1?'s':''})` : 'No reviews yet'}</p>
      </div>
      <div class="card-foot">
        <span class="price">${p.price.toLocaleString()} RWF</span>
        <button class="btn btn-primary" onclick='addToCart(${JSON.stringify(p.name)}, ${p.price})'>Add to cart</button>
      </div>
    </div>`;
  });
}
function addToCart(name, price){
  if(!canUseMarketplaceCheckout()){ toast('Log in as a learner or buyer first'); go('auth'); return; }
  state.cart.push({name, price});
  toast(name+' added to cart');
  renderNav();
}

function removeFromCart(index){
  state.cart.splice(index, 1);
  renderCart();
  renderNav();
}

function renderCart(){
  const wrap = document.getElementById('cartItems');
  wrap.innerHTML='';
  if(state.cart.length===0){
    wrap.innerHTML = '<p>Your cart is empty — visit the marketplace to add items.</p>';
    pendingPayment = null;
    document.getElementById('paymentSimPanel').style.display = 'none';
    document.getElementById('checkoutBtn').disabled = false;
  }
  let total=0;
  state.cart.forEach((item, index)=>{
    total += item.price;
    wrap.innerHTML += `<div class="cart-item">
      <span>${item.name}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <span>${item.price.toLocaleString()} RWF</span>
        <button class="mini-btn danger" onclick="removeFromCart(${index})">Remove</button>
      </div>
    </div>`;
  });
  document.getElementById('cartTotal').textContent = total.toLocaleString()+' RWF';
}
function checkout(){
  if(!canUseMarketplaceCheckout()){ toast('Log in as a learner or buyer first'); go('auth'); return; }
  if(state.cart.length===0){ toast('Your cart is empty'); return; }

  const method = document.getElementById('payMethod').value;
  const number = document.getElementById('payNumber').value.trim();
  if(!number){
    toast('Enter a mobile money number');
    return;
  }

  const total = state.cart.reduce((s,i)=>s+i.price,0);

  pendingPayment = {
    id: orderCounter++,
    buyer: state.currentUser ? state.currentUser.name : 'Guest buyer',
    items: [...state.cart],
    total,
    method,
    number,
    otp: String(Math.floor(100000 + Math.random() * 900000)),
  };

  const panel = document.getElementById('paymentSimPanel');
  panel.style.display = 'block';
  document.getElementById('paymentSummary').textContent = `${method} request sent to ${number} for ${total.toLocaleString()} RWF.`;
  document.getElementById('paymentStatus').textContent = 'Waiting for OTP confirmation.';
  document.getElementById('demoOtp').textContent = pendingPayment.otp;
  document.getElementById('paymentOtp').value = '';
  document.getElementById('verifyPaymentBtn').disabled = false;
  document.getElementById('checkoutBtn').disabled = true;
  toast('Payment request started. Enter the demo OTP to confirm.');
}

function verifyPaymentOtp(){
  if(!pendingPayment){
    toast('Start a payment first');
    return;
  }

  const otp = document.getElementById('paymentOtp').value.trim();
  if(otp !== pendingPayment.otp){
    document.getElementById('paymentStatus').textContent = 'Invalid OTP. Please try again.';
    toast('Invalid OTP');
    return;
  }

  document.getElementById('verifyPaymentBtn').disabled = true;
  document.getElementById('paymentStatus').textContent = 'OTP verified. Processing payment...';

  setTimeout(()=>{
    finalizePayment();
  }, 1200);
}

function finalizePayment(){
  if(!pendingPayment){
    return;
  }

  const order = {
    id: pendingPayment.id,
    buyer: pendingPayment.buyer,
    items: pendingPayment.items,
    total: pendingPayment.total,
    method: pendingPayment.method,
    status:'Processing',
    date: new Date().toLocaleDateString()
  };

  allOrders.push(order);
  pushNotification(`Payment confirmed for order #${order.id} via ${order.method}.`);
  pushNotification(`Order #${order.id} is now Processing.`);
  toast('Payment confirmed via '+order.method+' — order #'+order.id+' placed');

  state.cart = [];
  pendingPayment = null;
  document.getElementById('paymentStatus').textContent = 'Payment successful.';
  document.getElementById('paymentSimPanel').style.display = 'none';
  document.getElementById('checkoutBtn').disabled = false;
  renderCart();
  renderNav();
  go('my-orders');
}

/* ---------- BUYER ORDERS ---------- */
function renderMyOrders(){
  const mine = allOrders.filter(o=>state.currentUser && o.buyer===state.currentUser.name);
  const list = document.getElementById('myOrdersList');
  list.innerHTML='';
  if(mine.length===0){
    list.innerHTML = '<div class="empty-state">You haven\'t placed any orders yet.</div>';
    return;
  }
  mine.forEach(o=>{ list.innerHTML += orderCardHTML(o, false); });
}

function openReviewPanel(orderId){
  const order = allOrders.find(o=>o.id===Number(orderId) || o.id===orderId);
  if(!order){ return; }
  const panel = document.getElementById('reviewPanel');
  const productSelect = document.getElementById('reviewProduct');
  productSelect.innerHTML = '';
  order.items.forEach(item=>{
    productSelect.innerHTML += `<option value="${item.name}">${item.name}</option>`;
  });

  document.getElementById('reviewOrderId').value = String(order.id);
  const loadExistingReview = ()=>{
    const selectedProduct = productSelect.value;
    const existing = state.reviews.find(r=>r.orderId===order.id && r.productName===selectedProduct && r.buyer===state.currentUser.name);
    document.getElementById('reviewRating').value = existing ? String(existing.rating) : '5';
    document.getElementById('reviewComment').value = existing ? existing.comment : '';
  };
  productSelect.onchange = loadExistingReview;
  loadExistingReview();
  panel.style.display = 'block';
}

function closeReviewPanel(){
  document.getElementById('reviewPanel').style.display = 'none';
  document.getElementById('reviewOrderId').value = '';
}

function submitReview(){
  if(!state.currentUser){ return; }
  const orderId = document.getElementById('reviewOrderId').value;
  const productName = document.getElementById('reviewProduct').value;
  const rating = Number(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value.trim();
  if(!orderId || !productName){ toast('Choose an order product to review'); return; }
  const numericOrderId = Number(orderId);
  const existing = state.reviews.find(r=>r.orderId===numericOrderId && r.productName===productName && r.buyer===state.currentUser.name);
  if(existing){
    existing.rating = rating;
    existing.comment = comment;
    existing.updatedAt = new Date().toLocaleString();
    toast('Review updated');
  } else {
    state.reviews.push({
      orderId: numericOrderId,
      productName,
      rating,
      comment,
      buyer: state.currentUser.name,
      createdAt: new Date().toLocaleString()
    });
    toast('Review submitted');
  }
  pushNotification(`Review saved for "${productName}".`);
  closeReviewPanel();
  renderMarket();
  renderMyOrders();
  renderNav();
}

/* ---------- NOTIFICATIONS ---------- */
function renderNotifications(){
  const list = document.getElementById('notificationList');
  if(!list){ return; }
  if(state.notifications.length===0){
    list.innerHTML = '<div class="notify-empty">No notifications yet.</div>';
    return;
  }
  list.innerHTML = '';
  state.notifications.forEach(n=>{
    list.innerHTML += `<div class="notify-card ${n.read ? '' : 'unread'}">
      <div class="notify-top">
        <div class="notify-text">${n.text}</div>
        <div class="notify-time">${n.time}</div>
      </div>
    </div>`;
  });
  state.notifications.forEach(n=>{ n.read = true; });
  renderNav();
}

function markAllNotificationsRead(){
  state.notifications.forEach(n=>{ n.read = true; });
  renderNotifications();
  toast('All notifications marked as read');
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
function renderAdminOverview(){
  document.getElementById('statLearners').textContent = registeredUsers.length;
  document.getElementById('statCourses').textContent = COURSES.length;
  document.getElementById('statProducts').textContent = DEMO_PRODUCTS.length + state.products.length;
  document.getElementById('statOrders').textContent = allOrders.length;
}
function toggleAddCourse(){
  const p = document.getElementById('addCoursePanel');
  p.style.display = p.style.display==='none' ? 'block' : 'none';
}
function addCourse(){
  const name = document.getElementById('cName').value.trim();
  const duration = document.getElementById('cDuration').value.trim();
  const desc = document.getElementById('cDesc').value.trim();
  if(!name || !duration){ toast('Add a course name and duration'); return; }
  COURSES.push({
    id: 'c'+Date.now(), name, icon:'🧶', color:'pill-blue', duration, desc: desc||'New craft track',
    lessons:['Introduction','Core technique','Practice project','Finishing touches'],
    quiz:{q:'Quick check', options:['Follow the steps carefully','Skip steps to finish faster','Ignore instructions'], correct:0}
  });
  toggleAddCourse();
  document.getElementById('cName').value=''; document.getElementById('cDuration').value=''; document.getElementById('cDesc').value='';
  renderAdminCourses();
  renderCatalog(); renderHomeCourses();
  pushNotification(`Admin added course "${name}".`);
  toast('Course added');
  renderNav();
}
function deleteCourse(id){
  const deleted = COURSES.find(c=>c.id===id);
  COURSES = COURSES.filter(c=>c.id!==id);
  renderAdminCourses();
  renderCatalog(); renderHomeCourses();
  if(deleted){ pushNotification(`Admin removed course "${deleted.name}".`); }
  toast('Course removed');
  renderNav();
}
function renderAdminCourses(){
  const table = document.getElementById('adminCoursesTable');
  table.innerHTML = '<tr><th>Course</th><th>Duration</th><th>Lessons</th><th></th></tr>';
  COURSES.forEach(c=>{
    table.innerHTML += `<tr><td>${c.icon} ${c.name}</td><td>${c.duration}</td><td>${c.lessons.length}</td>
      <td><button class="mini-btn danger" onclick="deleteCourse('${c.id}')">Remove</button></td></tr>`;
  });
}
function toggleUserActive(idx){
  registeredUsers[idx].active = !registeredUsers[idx].active;
  pushNotification(`User ${registeredUsers[idx].name} was ${registeredUsers[idx].active ? 'reactivated' : 'suspended'}.`);
  renderAdminUsers();
  renderNav();
}
function renderAdminUsers(){
  const table = document.getElementById('adminUsersTable');
  table.innerHTML = '<tr><th>Name</th><th>Contact</th><th>Role</th><th>Language</th><th>Status</th><th></th></tr>';
  if(registeredUsers.length===0){
    table.innerHTML += '<tr><td colspan="6" style="color:var(--muted);">No one has registered in this session yet.</td></tr>';
    return;
  }
  registeredUsers.forEach((u,i)=>{
    table.innerHTML += `<tr><td>${u.name}</td><td>${u.contact}</td><td style="text-transform:capitalize;">${u.role}</td><td>${u.language}</td>
      <td><span class="badge ${u.active?'badge-green':'badge-gray'}">${u.active?'Active':'Suspended'}</span></td>
      <td><button class="mini-btn" onclick="toggleUserActive(${i})">${u.active?'Suspend':'Reactivate'}</button></td></tr>`;
  });
}
function removeMarketProduct(id, isDemo){
  if(isDemo){ toast('Demo catalogue items are fixed in this prototype'); return; }
  const removed = state.products.find(p=>p.id===id);
  state.products = state.products.filter(p=>p.id!==id);
  renderAdminProducts();
  if(removed){ pushNotification(`Admin removed product "${removed.name}".`); }
  toast('Product removed by admin');
  renderNav();
}
function renderAdminProducts(){
  const table = document.getElementById('adminProductsTable');
  table.innerHTML = '<tr><th>Product</th><th>Shop</th><th>Category</th><th>Price</th><th></th></tr>';
  const all = [...DEMO_PRODUCTS.map(p=>({...p,demo:true})), ...state.products.map(p=>({...p,demo:false}))];
  all.forEach(p=>{
    table.innerHTML += `<tr><td>${p.name}</td><td>${p.shop||'—'}</td><td>${p.category}</td><td>${p.price.toLocaleString()} RWF</td>
      <td><button class="mini-btn danger" onclick="removeMarketProduct('${p.id}', ${p.demo})">Remove</button></td></tr>`;
  });
}
function renderAdminReports(){
  const enrollBox = document.getElementById('reportEnrollment');
  enrollBox.innerHTML = COURSES.map(c=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);"><span>${c.name}</span><span>${state.enrolledCourse===c.id?1:0} active</span></div>`).join('');
  const totalSales = allOrders.reduce((s,o)=>s+o.total,0);
  const completed = allOrders.filter(o=>o.status==='Completed').length;
  document.getElementById('reportSales').innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);"><span>Total orders</span><span>${allOrders.length}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line);"><span>Completed orders</span><span>${completed}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;"><span>Total sales value</span><span>${totalSales.toLocaleString()} RWF</span></div>`;
}

/* ---------- INIT ---------- */
renderNav();
renderHomeCourses();
renderCatalog();
