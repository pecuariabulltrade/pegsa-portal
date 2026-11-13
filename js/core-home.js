/* core-home.js — Login, navegación y helpers globales · 2026-04-26 · v15.97: fuera loadHomeKpis · v15.102: sesión recordada + identidad de Cloudflare Access */


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
let origenSesion=null; // v15.102: 'password' | 'cloudflare'

/* v15.102 · Sesión recordada: misma clave y formato que mobile.jsx (sessionStorage,
   8 horas; solo usuario y hora, NUNCA la contraseña). Al compartirla, pasar del móvil
   a index.html?mod=… tampoco pide contraseña. */
const SESION_KEY='pegsa_mobile_user';
const SESION_TTL_MS=8*60*60*1000;
function sesionLeer(){
  try{
    const s=JSON.parse(sessionStorage.getItem(SESION_KEY)||'null');
    if(!s||!s.ts||!s.username)return null;
    if(Date.now()-s.ts>SESION_TTL_MS){sessionStorage.removeItem(SESION_KEY);return null;}
    return s;
  }catch(e){return null;}
}
function sesionGuardar(username,origen){
  const a=USERS[username];if(!a)return;
  try{sessionStorage.setItem(SESION_KEY,JSON.stringify({username:username,name:a.name,initials:a.initials,ts:Date.now(),origen:origen}));}catch(e){}
}
function sesionBorrar(){try{sessionStorage.removeItem(SESION_KEY);}catch(e){}}

/* v15.102 · Identidad de Cloudflare Access. Detrás de Access, /cdn-cgi/access/get-identity
   (mismo origen) devuelve un JSON con `email`. Quién entra lo decide la política de
   Cloudflare: hoy todos los mails autorizados son de gerencia, así que cualquier identidad
   válida entra como 'gerencia'. NO poner mails en este archivo (el repo es público): cuando
   haya perfiles distintos por mail, el mapa va en un archivo que no se publique en un repo
   público. En GitHub Pages no se consulta (no hay Access y el 404 ensucia la consola). */
function identidadCloudflare(){
  if(/\.github\.io$/i.test(location.hostname))return Promise.resolve(null);
  const ctl=(typeof AbortController==='function')?new AbortController():null;
  const t=setTimeout(()=>{if(ctl)ctl.abort();},2500);
  return fetch('/cdn-cgi/access/get-identity',{cache:'no-store',credentials:'same-origin',signal:ctl?ctl.signal:undefined})
    .then(r=>r.ok?r.json():null)
    .then(j=>(j&&typeof j.email==='string'&&j.email.indexOf('@')>0)?j.email:null)
    .catch(()=>null)
    .finally(()=>clearTimeout(t));
}

function tryLogin(){
  const u=document.getElementById('inputUser').value.trim().toLowerCase();
  const p=document.getElementById('inputPass').value;
  const err=document.getElementById('loginErr');
  err.classList.remove('show');
  if(!u||!p){showErr('Completá usuario y contraseña.');return;}
  const acc=USERS[u];
  if(!acc||acc.pass!==p){showErr('Usuario o contraseña incorrectos.');shake();return;}
  sesionGuardar(u,'password');
  entrar(u,'password',true);
}

// v15.102: lo que pasa después de validar (antes estaba dentro de tryLogin).
function entrar(username,origen,animar){
  const acc=USERS[username];if(!acc)return false;
  currentUser=acc;origenSesion=origen||'password';
  // Defensive: estos elementos pueden no existir si el screenHome fue reemplazado
  ['tbAvatar','tbAvatar2','tbAvatar3'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=acc.initials;});
  var _tbUser = document.getElementById('tbUser'); if(_tbUser) _tbUser.textContent = acc.name;
  document.querySelectorAll('.module-card[data-mod]').forEach(card=>{
    card.style.display=acc.modules.includes(card.dataset.mod)?'':'none';
  });
  const ls=document.getElementById('screenLogin');
  const fin=()=>{showScreen('screenHome');document.body.style.background='';ls.style.visibility='';sbInit(currentUser);
    // v15.89: un link #caravana=<nro> abre la consulta directo después del login
    if(/caravana=/.test(location.hash)&&acc.modules.includes('caravana'))sbNavigate('caravana');};
  if(animar){ls.style.opacity='0';ls.style.transition='opacity .35s ease';setTimeout(fin,350);}
  else fin();
  return true;
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
  const porCloudflare=(origenSesion==='cloudflare');
  sesionBorrar();
  currentUser=null;origenSesion=null;
  // v15.102: si se entró con la identidad de Cloudflare, "Salir" cierra esa sesión
  // (volver a entrar pide el código por mail).
  if(porCloudflare){location.href='/cdn-cgi/access/logout';return;}
  document.querySelectorAll('.module-card[data-mod]').forEach(card=>{card.style.display='';});
  sbHide();showScreen('screenLogin');document.body.style.background='';
  const ls=document.getElementById('screenLogin');
  ls.style.display='flex';ls.style.opacity='0';ls.style.visibility='';
  document.getElementById('inputPass').value='';
  document.getElementById('loginErr').classList.remove('show');
  setTimeout(()=>{ls.style.opacity='1';ls.style.transition='opacity .35s ease';},10);
}

/* v15.102 · Arranque: 1) sesión guardada vigente → entra; 2) identidad de Cloudflare →
   entra como gerencia; 3) login como siempre. El login queda oculto mientras se decide
   (sin parpadeo). Se entra recién en 'load', cuando ya cargaron todos los módulos (igual
   que cuando alguien escribe la contraseña). */
(function arranque(){
  const ls=document.getElementById('screenLogin');
  const cargada=new Promise(r=>{if(document.readyState==='complete')r();else window.addEventListener('load',r,{once:true});});
  const mostrarLogin=()=>{if(ls)ls.style.visibility='';cargada.then(()=>{const i=document.getElementById('inputUser');if(i&&!currentUser)i.focus();});};
  if(ls)ls.style.visibility='hidden';
  const s=sesionLeer();
  if(s&&USERS[s.username]){
    cargada.then(()=>{if(!currentUser)entrar(s.username,s.origen||'password',false);});
    return;
  }
  identidadCloudflare().then(email=>{
    if(!email){mostrarLogin();return;}
    sesionGuardar('gerencia','cloudflare');
    cargada.then(()=>{if(!currentUser)entrar('gerencia','cloudflare',false);});
  });
})();


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
