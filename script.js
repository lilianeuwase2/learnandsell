const NAV_ITEMS = [
  {id:'home',label:'Home'},
  {id:'courses',label:'Courses'},
  {id:'marketplace',label:'Marketplace'},
  {id:'dashboard',label:'Dashboard'},
  {id:'admin',label:'Admin'},
];
const navLinks = document.getElementById('navLinks');
NAV_ITEMS.forEach(item=>{
  const a = document.createElement('a');
  a.href='#'; a.className='nav-link'; a.textContent=item.label;
  a.onclick=(e)=>{e.preventDefault(); go(item.id);};
  a.dataset.id=item.id;
  navLinks.appendChild(a);
});

const COURSES = [
  {id:'tailoring', name:'Tailoring', icon:'🧵', color:'pill-mint', duration:'6 weeks', desc:'Cut, sew and finish garments from measurement to hem.', lessons:['Reading a measuring tape','Cutting your first pattern','Machine stitching basics','Finishing seams and hems']},
  {id:'beading', name:'Beading', icon:'📿', color:'pill-amber', duration:'3 weeks', desc:'Design and string beaded jewellery and accessories.', lessons:['Bead types and tools','Stringing techniques','Pattern design','Clasps and finishing']},
  {id:'basket', name:'Basket weaving', icon:'🧺', color:'pill-blue', duration:'4 weeks', desc:'Traditional Rwandan weaving using sisal and banana fibre.', lessons:['Preparing fibre','Base weaving','Building the walls','Rim finishing']},
];

let state = {
  role:'learner',
  loggedIn:false,
  enrolledCourse:null,
  lessonsDone:0,
  quizPassed:false,
  quizSelected:null,
  shop:null,
  products:[],
  cart:[],
};

function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),1900);
}

function go(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active', l.dataset.id===view));
  window.scrollTo({top:0,behavior:'smooth'});
  if(view==='dashboard') renderDashboard();
  if(view==='products') renderMyProducts();
  if(view==='marketplace') renderMarket('All');
  if(view==='cart') renderCart();
}

// role toggle on auth screen
const roleToggle = document.getElementById('roleToggle');
['learner','buyer','admin'].forEach(r=>{
  const d=document.createElement('div');
  d.className='role-opt'+(r==='learner'?' sel':'');
  d.textContent = r==='learner'?'Learner / seller':r==='buyer'?'Buyer':'Admin';
  d.dataset.role=r;
  d.onclick=()=>{
    document.querySelectorAll('.role-opt').forEach(o=>o.classList.remove('sel'));
    d.classList.add('sel'); state.role=r;
  };
  roleToggle.appendChild(d);
});

function loginAs(){
  state.loggedIn=true;
  toast('Welcome — logged in as '+state.role);
  if(state.role==='admin') go('admin');
  else if(state.role==='buyer') go('marketplace');
  else go('dashboard');
}

// home course teaser cards
const homeCourses = document.getElementById('homeCourses');
COURSES.forEach(c=>{
  homeCourses.innerHTML += `<div class="card">
    <div class="card-media" style="background:var(--sky-deep);">${c.icon}</div>
    <div class="card-body">
      <span class="pill ${c.color}">${c.duration}</span>
      <h4>${c.name}</h4><p>${c.desc}</p>
    </div>
  </div>`;
});

// course catalog with enroll
function renderCatalog(){
  const grid = document.getElementById('courseCatalog');
  grid.innerHTML='';
  COURSES.forEach(c=>{
    const enrolled = state.enrolledCourse===c.id;
    grid.innerHTML += `<div class="card">
      <div class="card-media" style="background:var(--sky-deep);">${c.icon}</div>
      <div class="card-body">
        <span class="pill ${c.color}">${c.duration}</span>
        <h4>${c.name}</h4><p>${c.desc}</p>
      </div>
      <div class="card-foot">
        <span style="font-size:12px;color:var(--muted);">${c.lessons.length} lessons</span>
        <button class="btn ${enrolled?'btn-navy':'btn-primary'}" onclick="enroll('${c.id}')">${enrolled?'Continue':'Enroll'}</button>
      </div>
    </div>`;
  });
}
renderCatalog();

function enroll(id){
  if(state.enrolledCourse && state.enrolledCourse!==id){
    toast("You're mid-course — finish it before starting another");
    return;
  }
  state.enrolledCourse=id;
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
  document.getElementById('quizArea').style.display = state.lessonsDone>=c.lessons.length ? 'block':'none';
}

function completeLesson(i){
  if(i===state.lessonsDone){
    state.lessonsDone++;
    const c = COURSES.find(x=>x.id===state.enrolledCourse);
    renderLessons(c);
    toast('Lesson marked complete');
  }
}

function updateProgress(c){
  const pct = Math.round((state.lessonsDone/c.lessons.length)*100);
  document.getElementById('progressFill').style.width=pct+'%';
  document.getElementById('progressPct').textContent=pct+'%';
}

function selectQuiz(el){
  document.querySelectorAll('.quiz-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel');
  state.quizSelected = el.textContent;
}
function submitQuiz(){
  if(!state.quizSelected){ toast('Choose an answer first'); return; }
  const correct = state.quizSelected.startsWith('Sew slowly');
  if(correct){
    state.quizPassed=true;
    toast('Correct — course complete! Check your dashboard');
    go('dashboard');
  } else {
    toast('Not quite — try again');
  }
}

function renderDashboard(){
  const c = COURSES.find(x=>x.id===state.enrolledCourse) || COURSES[0];
  const total = c.lessons.length;
  const pct = Math.round((state.lessonsDone/total)*100);
  document.getElementById('dashProgressFill').style.width=pct+'%';
  document.getElementById('dashProgressLabel').textContent = `${state.lessonsDone} of ${total} lessons complete`;
  const certPanel = document.getElementById('certPanel');
  if(state.quizPassed){
    certPanel.innerHTML = `<h4 style="margin-bottom:8px;">Certificate</h4>
      <p style="font-size:13px;color:var(--mint-dark);font-weight:600;">🎓 Earned — Tailoring, Level 1</p>`;
  } else {
    certPanel.innerHTML = `<h4 style="margin-bottom:8px;">Certificate</h4>
      <p style="font-size:13px;">Complete all lessons and pass the quiz to graduate.</p>`;
  }
  const lock = document.getElementById('shopLockCard');
  if(state.quizPassed){
    lock.classList.add('unlocked');
    lock.innerHTML = `<h3 style="color:white;font-size:19px;">Shop unlocked 🎉</h3>
      <p style="color:#E4FBF3;margin-top:8px;">You graduated — set up your shop and start listing products.</p>
      <button class="btn" style="background:white;color:var(--navy-dark);margin-top:14px;" onclick="go('shop-create')">Create my shop</button>`;
  } else {
    lock.classList.remove('unlocked');
    lock.innerHTML = `<h3 style="color:white;font-size:19px;">Shop is locked</h3>
      <p style="color:#CBDCEC;margin-top:8px;">Finish your course to unlock your digital shop.</p>`;
  }
}

function createShop(){
  const name = document.getElementById('shopName').value || "Liliane's Tailoring Corner";
  const desc = document.getElementById('shopDesc').value || 'Handmade craft, made to order';
  const category = document.getElementById('shopCategory').value;
  state.shop = {name, desc, category};
  document.getElementById('myShopName').textContent = name;
  toast('Shop created — add your first product');
  go('products');
}

function toggleAddProduct(){
  const p = document.getElementById('addProductPanel');
  p.style.display = p.style.display==='none' ? 'block' : 'none';
}
function addProduct(){
  const name = document.getElementById('pName').value;
  const price = document.getElementById('pPrice').value;
  const desc = document.getElementById('pDesc').value;
  if(!name || !price){ toast('Add a name and price'); return; }
  state.products.push({name, price:Number(price), desc, category: state.shop ? state.shop.category : 'Tailoring', stock:true});
  document.getElementById('pName').value=''; document.getElementById('pPrice').value=''; document.getElementById('pDesc').value='';
  toggleAddProduct();
  renderMyProducts();
  toast('Product listed');
}
function renderMyProducts(){
  const grid = document.getElementById('myProductGrid');
  grid.innerHTML='';
  if(state.products.length===0){
    grid.innerHTML = `<p style="grid-column:1/-1;">No products yet — add your first one above.</p>`;
    return;
  }
  state.products.forEach((p,i)=>{
    grid.innerHTML += `<div class="card">
      <div class="card-media" style="background:var(--sky-deep);">🧵</div>
      <div class="card-body">
        <span class="pill ${p.stock?'pill-mint':'pill-amber'}">${p.stock?'In stock':'Out of stock'}</span>
        <h4>${p.name}</h4><p>${p.desc||'Handmade item'}</p>
      </div>
      <div class="card-foot">
        <span class="price">${p.price.toLocaleString()} RWF</span>
        <button class="btn btn-outline" onclick="toggleStock(${i})">${p.stock?'Mark out of stock':'Mark in stock'}</button>
      </div>
    </div>`;
  });
}
function toggleStock(i){ state.products[i].stock = !state.products[i].stock; renderMyProducts(); }

const DEMO_PRODUCTS = [
  {name:'Kitenge wrap dress', price:18000, category:'Tailoring', desc:'Hand-sewn, made to size', icon:'🧵'},
  {name:'School uniform set', price:12000, category:'Tailoring', desc:'Durable cotton blend', icon:'🧵'},
  {name:'Beaded choker necklace', price:6000, category:'Beading', desc:'Layered glass beads', icon:'📿'},
  {name:'Beaded bracelet set', price:4500, category:'Beading', desc:'Set of three, adjustable', icon:'📿'},
  {name:'Woven storage basket', price:9000, category:'Basket weaving', desc:'Sisal and banana fibre', icon:'🧺'},
  {name:'Table mat set', price:7000, category:'Basket weaving', desc:'Set of four, hand-dyed', icon:'🧺'},
];
function renderMarket(filter){
  const grid = document.getElementById('marketGrid');
  grid.innerHTML='';
  const all = [...DEMO_PRODUCTS, ...state.products.map(p=>({...p, icon:'🧵'}))];
  const list = filter==='All' ? all : all.filter(p=>p.category===filter);
  list.forEach((p,i)=>{
    grid.innerHTML += `<div class="card">
      <div class="card-media" style="background:var(--sky-deep);">${p.icon||'🧵'}</div>
      <div class="card-body">
        <span class="pill pill-blue">${p.category}</span>
        <h4>${p.name}</h4><p>${p.desc}</p>
      </div>
      <div class="card-foot">
        <span class="price">${p.price.toLocaleString()} RWF</span>
        <button class="btn btn-primary" onclick='addToCart(${JSON.stringify(p.name)}, ${p.price})'>Add to cart</button>
      </div>
    </div>`;
  });
}
function filterMarket(cat){ renderMarket(cat); }

function addToCart(name, price){
  state.cart.push({name, price});
  toast(name+' added to cart');
}
function renderCart(){
  const wrap = document.getElementById('cartItems');
  wrap.innerHTML='';
  if(state.cart.length===0){
    wrap.innerHTML = '<p>Your cart is empty — visit the marketplace to add items.</p>';
  }
  let total=0;
  state.cart.forEach(item=>{
    total += item.price;
    wrap.innerHTML += `<div class="cart-item"><span>${item.name}</span><span>${item.price.toLocaleString()} RWF</span></div>`;
  });
  document.getElementById('cartTotal').textContent = total.toLocaleString()+' RWF';
}
function checkout(){
  if(state.cart.length===0){ toast('Your cart is empty'); return; }
  const method = document.getElementById('payMethod').value;
  toast('Payment confirmed via '+method);
  state.cart=[];
  renderCart();
}
