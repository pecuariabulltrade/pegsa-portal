/* core-home.js — Login, navegación y helpers globales · 2026-04-26 · v15.97: fuera loadHomeKpis */


const USERS={
  'pegsa':    {pass:'garobi2025',name:'PEGSA Admin',    initials:'PA', modules:['stock','insumos']},
  'bulltrade':{pass:'bull2025',  name:'Bulltrade Admin',initials:'BA', modules:['tesoreria']},
  // v15.94: fuera 'resultados','flujo','simulador','analisis-costos' (obsoletos, etapa 1:
  // sin acceso, el codigo sigue). 'simulador-engorde' = simulador.html (pagina propia).
  'gerencia': {pass:'gestion25', name:'Gerencia',       initials:'GR', modules:['stock','insumos','mercado','tesoreria','simulador-engorde','historico','remitos','acumulados','compras','gestion-costos','caravana']},
  'admin':    {pass:'admin123',  name:'Administrador',  initials:'AD', modules:['stock','insumos','mercado','tesoreria','simulador-engorde','historico','remitos','acumulados','compras','gestion-costos','caravana']},
};
// v15.95: sin selector de período (era del Estado de Resultados).
let currentUser=null;

function tryLogin(){
  const u=document.getElementById('inputUser').value.trim().toLowerCase();
  const p=document.getElementById('inputPass').value;
  const err=document.getElementById('loginErr');
  err.classList.remove('show');
  if(!u||!p){showErr('Completá usuario y contraseña.');return;}
  const acc=USERS[u];
  if(!acc||acc.pass!==p){showErr('Usuario o contraseña incorrectos.');shake();return;}
  currentUser=acc;
  // Defensive: estos elementos pueden no existir si el screenHome fue reemplazado
  ['tbAvatar','tbAvatar2','tbAvatar3'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=acc.initials;});
  var _tbUser = document.getElementById('tbUser'); if(_tbUser) _tbUser.textContent = acc.name;
  document.querySelectorAll('.module-card[data-mod]').forEach(card=>{
    card.style.display=acc.modules.includes(card.dataset.mod)?'':'none';
  });
  const ls=document.getElementById('screenLogin');
  ls.style.opacity='0';ls.style.transition='opacity .35s ease';
  setTimeout(()=>{showScreen('screenHome');document.body.style.background='';sbInit(currentUser);
    // v15.89: un link #caravana=<nro> abre la consulta directo después del login
    if(/caravana=/.test(location.hash)&&acc.modules.includes('caravana'))sbNavigate('caravana');},350);
}
function showErr(msg){const e=document.getElementById('loginErr');e.textContent=msg;e.classList.add('show');}
function shake(){const b=document.querySelector('.login-box');b.style.animation='shake .4s ease';setTimeout(()=>b.style.animation='',400);}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>{s.style.display='none';s.classList.remove('active');});
  const el=document.getElementById(id);if(!el)return;
  el.style.display=(id==='screenHome')?'flex':'block';
  el.classList.add('active');
}

function openModule(mod){
  if(currentUser && !currentUser.modules.includes(mod)){return;}
  if(typeof sbSetActive==="function") sbSetActive(mod);
  if(mod==='mercado'){
    showScreen('screenMercado');
    document.body.style.background='';
    window.scrollTo(0,0);
    initMercado();
    return;
  }
  if(mod==='insumos'){
    showScreen('screenInsumos');
    document.body.style.background='';
    window.scrollTo(0,0);
    initInsumos();
    return;
  }
  if(mod==='stock'){
    showScreen('screenStock');
    document.body.style.background='';
    window.scrollTo(0,0);
    initStock();
    return;
  }
  if(mod==='tesoreria'){
    showScreen('screenTesoreria');
    document.body.style.background='';
    window.scrollTo(0,0);
    initTesoreria();
    return;
  }
  if(mod==='historico'){
    showScreen('screenHistorico');
    document.body.style.background='';
    window.scrollTo(0,0);
    initHistorico();
    return;
  }
  // v15.59: Resultado por Remito
  if(mod==='remitos'){
    showScreen('screenRemitos');
    document.body.style.background='';
    window.scrollTo(0,0);
    initRemitos();
    return;
  }
  // v15.71.3: Resultados Acumulados (salio de adentro del 07)
  if(mod==='acumulados'){
    showScreen('screenAcumulados');
    document.body.style.background='';
    window.scrollTo(0,0);
    initAcumulados();
    return;
  }
  // v15.89: 14 · Consulta de Caravana
  if(mod==='caravana'){
    showScreen('screenCaravana');
    document.body.style.background='';
    window.scrollTo(0,0);
    initCaravana();
    return;
  }
  // v15.95: un módulo desconocido no hace nada (antes caía a screenReport).
}

function goHome(){if(typeof sbSetActive==="function") sbSetActive("home");showScreen('screenHome');document.body.style.background='';window.scrollTo(0,0);}
function logout(){
  currentUser=null;
  document.querySelectorAll('.module-card[data-mod]').forEach(card=>{card.style.display='';});
  sbHide();showScreen('screenLogin');document.body.style.background='';
  const ls=document.getElementById('screenLogin');
  ls.style.display='flex';ls.style.opacity='0';
  document.getElementById('inputPass').value='';
  document.getElementById('loginErr').classList.remove('show');
  setTimeout(()=>{ls.style.opacity='1';ls.style.transition='opacity .35s ease';},10);
}
window.addEventListener('load',()=>document.getElementById('inputUser').focus());


/* ════════════════════════════════════════════════════════════
   APP SIDEBAR · navegación, marcado activo, mostrar/ocultar
   ════════════════════════════════════════════════════════════ */
function sbNavigate(target){
  sbSetActive(target);
  if (target === 'home') {
    if (typeof goHome === 'function') goHome();
  } else {
    if (typeof openModule === 'function') openModule(target);
  }
}

function sbSetActive(target){
  document.querySelectorAll('.sb-item').forEach(function(el){
    el.classList.toggle('active', el.dataset.target === target);
  });
}

function sbShow(){
  document.body.classList.add('has-sidebar');
  var el = document.getElementById('appSidebar');
  if (el) el.style.display = 'flex';
}
function sbHide(){
  document.body.classList.remove('has-sidebar');
  var el = document.getElementById('appSidebar');
  if (el) el.style.display = 'none';
}

function sbInit(user){
  if (user) {
    var avatarEl = document.getElementById('sbAvatar');
    var nameEl   = document.getElementById('sbUserName');
    if (avatarEl) avatarEl.textContent = user.initials || '--';
    if (nameEl)   nameEl.textContent   = user.name || 'Usuario';

    // Filtrar módulos según permisos
    var modules = user.modules || [];
    document.querySelectorAll('.sb-item').forEach(function(el){
      var t = el.dataset.target;
      if (t === 'home' || modules.indexOf(t) >= 0) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });

    // v15.76 · si tiene el 07, se va pidiendo su índice mientras mira el home,
    // así al hacer clic ya está en caché. Va por remIndice() y no por un
    // <link rel="preload">: la promesa cacheada es la misma que usa
    // cargarRemitos(), así que no hay riesgo de que el preload no matchee el
    // fetch y el archivo se baje dos veces. Se hace en idle para no competir
    // con los ~25 JSON del home.
    if (modules.indexOf('remitos') >= 0 && typeof remPrefetchIndex === 'function') {
      var ric = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
      ric(function () { remPrefetchIndex(); });
    }
  }
  sbShow();
}
