/* core-home.js — Login, navegación, helpers globales y Home (loadHomeKpis) · 2026-04-26 */


const USERS={
  'pegsa':    {pass:'garobi2025',name:'PEGSA Admin',    initials:'PA', modules:['stock','insumos']},
  'bulltrade':{pass:'bull2025',  name:'Bulltrade Admin',initials:'BA', modules:['tesoreria']},
  'gerencia': {pass:'gestion25', name:'Gerencia',       initials:'GR', modules:['resultados','flujo','stock','insumos','mercado','tesoreria','simulador','historico','baseparams']},
  'admin':    {pass:'admin123',  name:'Administrador',  initials:'AD', modules:['resultados','flujo','stock','insumos','mercado','tesoreria','simulador','historico','baseparams']},
};
const PERIODS={'2025':{available:true},'2024':{available:false}};
let currentUser=null, selectedPeriod='2025', chartsInited=false;

function selPeriod(btn){document.querySelectorAll('.period-opt').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');selectedPeriod=btn.dataset.period;}

function tryLogin(){
  const u=document.getElementById('inputUser').value.trim().toLowerCase();
  const p=document.getElementById('inputPass').value;
  const err=document.getElementById('loginErr');
  err.classList.remove('show');
  if(!u||!p){showErr('Completá usuario y contraseña.');return;}
  const acc=USERS[u];
  if(!acc||acc.pass!==p){showErr('Usuario o contraseña incorrectos.');shake();return;}
  if(!PERIODS[selectedPeriod].available){showErr('El período '+selectedPeriod+' no está disponible aún.');return;}
  currentUser=acc;
  ['tbAvatar','tbAvatar2','tbAvatar3'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=acc.initials;});
  document.getElementById('tbUser').textContent=acc.name;
  ['tbPeriod','tbPeriod2','tbPeriod3'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=selectedPeriod;});
  document.getElementById('heroPeriod').textContent=selectedPeriod;
  document.querySelectorAll('.module-card[data-mod]').forEach(card=>{
    card.style.display=acc.modules.includes(card.dataset.mod)?'':'none';
  });
  const ls=document.getElementById('screenLogin');
  ls.style.opacity='0';ls.style.transition='opacity .35s ease';
  setTimeout(()=>{showScreen('screenHome');document.body.style.background='';sbInit(currentUser);loadHomeKpis();},350);
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
  if(mod==='simulador'){
    showScreen('screenSimulador');
    document.body.style.background='';
    window.scrollTo(0,0);
    initSimulador();
    return;
  }
  if(mod==='historico'){
    showScreen('screenHistorico');
    document.body.style.background='';
    window.scrollTo(0,0);
    initHistorico();
    return;
  }
  if(mod==='baseparams'){
    showScreen('screenBaseParams');
    document.body.style.background='';
    window.scrollTo(0,0);
    bpRenderUI();
    return;
  }
  showScreen('screenReport');
  document.body.style.background='';
  document.getElementById('reportBreadcrumb').textContent=mod==='resultados'?'Estado de Resultados':'Flujo de Fondos';
  if(typeof showMain==='function') showMain(mod==='resultados'?'centros':'flujo',null);
  if(!chartsInited){chartsInited=true;setTimeout(()=>{if(typeof renderConsolidadoChart==='function')renderConsolidadoChart();},300);}
  window.scrollTo(0,0);
}

// ── HOME · Live KPIs ─────────────────────────────────────────────────────
var _homeKpisLoaded = false;

function loadHomeKpis(){
  if(_homeKpisLoaded) return; // solo carga una vez por sesión
  _homeKpisLoaded = true;

  // ── Hero update timestamp ──
  try {
    var hu = document.getElementById('heroUpdate');
    if (hu) {
      var d = new Date();
      var dd = String(d.getDate()).padStart(2,'0');
      var mm = String(d.getMonth()+1).padStart(2,'0');
      var yyyy = d.getFullYear();
      var hh = String(d.getHours()).padStart(2,'0');
      var mn = String(d.getMinutes()).padStart(2,'0');
      hu.textContent = dd+'/'+mm+'/'+yyyy+' '+hh+':'+mn;
    }
  } catch(e){}

  // ── Activar banner de cierre mensual cuando hay datos del último mes ──
  try {
    fetch(STOCK_SB+'/comportamiento_historico.json',{}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(d){
      if (!d || !d.snapshots || !d.snapshots.length) return;
      var last = d.snapshots[d.snapshots.length-1];
      if (last && last.periodo) {
        var meses = {'01':'enero','02':'febrero','03':'marzo','04':'abril','05':'mayo','06':'junio','07':'julio','08':'agosto','09':'septiembre','10':'octubre','11':'noviembre','12':'diciembre'};
        var p = last.periodo.split('-');
        var lbl = (meses[p[1]] || p[1]) + ' ' + p[0];
        var cierreEl = document.getElementById('alertCierre');
        var mesEl = document.getElementById('alertCierreMes');
        if (mesEl) mesEl.textContent = lbl;
        if (cierreEl) cierreEl.style.display = '';
      }
    });
  } catch(e){}

  // ── Activar banner de Diesel cuando hay días bajos en stock_insumos ──
  try {
    fetch(STOCK_SB+'/stock_insumos.json',{}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(d){
      if (!d || !d.insumos) return;
      var diesel = null;
      Object.keys(d.insumos).forEach(function(k){
        if (k && k.toLowerCase().indexOf('diesel') >= 0) diesel = d.insumos[k];
      });
      if (diesel && typeof diesel.dias_restantes === 'number' && diesel.dias_restantes <= 30) {
        var dEl = document.getElementById('alertDiesel');
        var ddEl = document.getElementById('alertDieselDias');
        if (ddEl) ddEl.textContent = Math.round(diesel.dias_restantes);
        if (dEl) dEl.style.display = '';
      }
    });
  } catch(e){}


  function fM(v){ // formatea millones: $1.234 M o $123 M
    if(v==null||isNaN(v)) return '—';
    var m = Math.abs(v)/1e6;
    return (v<0?'−':'')+'$\u00a0'+(m>=10?Math.round(m).toLocaleString('es-AR'):m.toFixed(1))+'\u00a0M';
  }
  function fB(v){ // formatea billones/millones para valuación
    if(v==null||isNaN(v)) return '—';
    var abs = Math.abs(v), sign = v<0?'−':'';
    if(abs>=1e9) return sign+'$\u00a0'+(abs/1e9).toFixed(2)+'\u00a0B';
    if(abs>=1e6) return sign+'$\u00a0'+(abs/1e6).toFixed(1)+'\u00a0M';
    return sign+'$\u00a0'+Math.round(abs).toLocaleString('es-AR');
  }
  function fN(v,dec){
    if(v==null||isNaN(v)) return '—';
    return '$\u00a0'+Number(v).toLocaleString('es-AR', dec!=null?{maximumFractionDigits:dec}:{maximumFractionDigits:0});
  }
  function fVar(v){
    if(!v) return '';
    return v>0 ? ' ↑ +$'+Math.abs(v).toLocaleString('es-AR') : ' ↓ −$'+Math.abs(v).toLocaleString('es-AR');
  }
  function set(id,val){ var el=document.getElementById(id); if(el) el.textContent=val; }
  function setC(id,val,cls){
    var el=document.getElementById(id);
    if(!el) return;
    el.textContent = val;
    if(cls){ el.className='kpi-num '+cls; }
  }

  // ── Stock ──────────────────────────────────────────────────
  fetch(STOCK_SB+'/stock_kpis_2025.json',{})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(d){
      if(!d||!d.kpis) return;
      var k = d.kpis;
      var pegsa = (k.por_propietario||{})['PEGSA'] || {};
      setC('hkpi-pegsa-cab', pegsa.cabezas ? Math.round(pegsa.cabezas).toLocaleString('es-AR')+' cab' : '—', 'gold');
      set('hkpi-pegsa-kg', pegsa.ton_estimado ? Math.round(pegsa.ton_estimado).toLocaleString('es-AR')+' tn proyectadas' : '—');
      setC('hkpi-total-cab', k.total_cabezas ? Number(k.total_cabezas).toLocaleString('es-AR')+' cab' : '—', '');
      set('hkpi-total-kg', k.total_ton_estimado_hoy ? Math.round(k.total_ton_estimado_hoy).toLocaleString('es-AR')+' tn · '+k.total_establecimientos+' establec.' : '—');
    })
    .catch(function(){});

  // ── Mercado + Negocios (para rentabilidad) ─────────────────
  var mPromise = MERCADO_DATA_CACHE
    ? Promise.resolve(MERCADO_DATA_CACHE)
    : fetch(STOCK_SB+'/mercado_precios.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;});

  var nPromise = NEGOCIOS_DATA_CACHE
    ? Promise.resolve(NEGOCIOS_DATA_CACHE)
    : fetch(STOCK_SB+'/negocios_resumen.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;});

  Promise.all([mPromise, nPromise]).then(function(res){
    var d   = res[0];
    var neg = res[1];

    // Cachear si no estaban cargados
    if(d   && !MERCADO_DATA_CACHE)  MERCADO_DATA_CACHE  = d;
    if(neg && !NEGOCIOS_DATA_CACHE) NEGOCIOS_DATA_CACHE = neg;

    if(d && d.hacienda){
      // Hacienda
      var nov = d.hacienda.find(function(h){ return h.categoria && h.categoria.toLowerCase().indexOf('461')>=0; });
      var vac = d.hacienda.find(function(h){ return h.categoria && h.categoria.toLowerCase().indexOf('vacas buenas')>=0; });
      if(nov){ setC('hkpi-novillo', fN(nov.precio), 'gold'); set('hkpi-novillo-var', 'MAG · '+d.fecha+(nov.variacion?fVar(nov.variacion):'')); }
      if(vac){ setC('hkpi-vaca',    fN(vac.precio), 'gold'); set('hkpi-vaca-var',    'MAG · '+d.fecha+(vac.variacion?fVar(vac.variacion):'')); }
      // Commodities: Maíz y Soja
      if(d.commodities){
        var mz = d.commodities.find(function(c){ return c.nombre&&(c.nombre.toLowerCase().indexOf('ma\xedz')>=0||c.nombre.toLowerCase().indexOf('maiz')>=0); });
        var sj = d.commodities.find(function(c){ return c.nombre&&c.nombre.toLowerCase().indexOf('soja')>=0; });
        if(mz) setC('hkpi-maiz', fN(mz.precio), 'gold');
        if(sj) setC('hkpi-soja', fN(sj.precio), 'gold');
      }
      // MEP desde último registro del historial
      var mepVal = null;
      if(d.historico && d.historico.length) mepVal = d.historico[d.historico.length-1].tc_mep || null;
      if(mepVal) setC('hkpi-mep', '$\u00a0'+Number(mepVal).toLocaleString('es-AR'), '');
      // Ternero E&C 330-370
      if(d.terneros_esyc){
        var ter330 = d.terneros_esyc.find(function(t){ return t.categoria && t.categoria.indexOf('330')>=0; });
        if(ter330) setC('hkpi-ter330', fN(ter330.precio), 'gold');
      }
    }

    // ── Rentabilidad acumulada (análisis compras) ────────────
    if(neg && neg.compras && neg.compras.length && d && d.insumos){
      var ins = d.insumos;
      var bp  = (typeof bpGet === 'function') ? bpGet() : {};
      var CORTE = '2026-03';
      var totRes = 0, totIngV = 0, totCab = 0;
      neg.compras.forEach(function(c){
        var catNorm = (typeof _analNormCat==='function') ? _analNormCat(c.categoria) : c.categoria;
        var tipo    = (typeof _analCatToTipo==='function') ? _analCatToTipo(catNorm) : null;
        var pesoE   = c.kg_cab > 0 ? c.kg_cab : ((typeof _analCatPesoE==='function') ? _analCatPesoE(catNorm) : 0);
        var pesoS   = (typeof _analCatPesoS==='function') ? _analCatPesoS(catNorm) : 0;
        var mes     = (typeof _analFechaMes==='function') ? _analFechaMes(c.fecha) : (c.fecha||'').slice(0,7);
        if(!mes || mes < CORTE) return;
        if(!c.precio_kg || !ins.maiz || !tipo) return;
        var bpTipo = bp[tipo] || null;
        if(typeof _segSimCat !== 'function') return;
        var sim = _segSimCat(tipo, pesoE, pesoS, c.precio_kg, ins, bpTipo);
        if(!sim || sim.resEco==null || !sim.ingresoVenta) return;
        var cab = c.cabezas || 1;
        totRes  += sim.resEco      * cab;
        totIngV += sim.ingresoVenta* cab;
        totCab  += cab;
      });
      if(totIngV > 0){
        var rentPct = totRes / totIngV * 100;
        var rentCol = rentPct >= 0 ? 'green' : 'red';
        setC('hkpi-rent-acum', (rentPct>=0?'+':'')+rentPct.toFixed(1)+'%', rentCol);
      }
    }
  });

  // ── Tesorería ──────────────────────────────────────────────
  var tPromise = _tesData
    ? Promise.resolve(_tesData)
    : fetch(STOCK_SB+'/tesoreria_ultimo.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;});

  tPromise.then(function(d){
    if(!d) return;
    var cheqTotal = (d.cheques||{}).total_cartera || 0;
    var flujo = d.flujo || {};
    var sems  = flujo.semanas || [];
    var acum  = (flujo.series||{}).saldo_acumulado || [];
    // Cobertura financiera: hasta qué semana el saldo se mantiene >= 0.
    // "Hasta X" = X es la primera semana donde el saldo se rompe (cae bajo cero).
    // Si todas son positivas -> cobertura completa hasta el horizonte proyectado.
    // Si todas son negativas (y el saldo inicial también) -> sin cobertura.
    var coberturaHasta = '—';
    var primeraNegIdx  = -1;
    for(var i=0; i<acum.length; i++){
      if(acum[i] < 0){ primeraNegIdx = i; break; }
    }
    var hasCoverage, coberturaLbl;
    if(primeraNegIdx === 0 && (flujo.saldo_inicial||0) < 0){
      hasCoverage = false; coberturaLbl = 'Sin cobertura';
    } else if(primeraNegIdx === -1){
      hasCoverage = true;
      coberturaLbl = 'hasta ' + (sems[sems.length-1]||'—') + '+';
    } else {
      hasCoverage = true;
      coberturaHasta = sems[primeraNegIdx] || '—';
      coberturaLbl = 'hasta ' + coberturaHasta;
    }
    setC('hkpi-tes-hasta', coberturaLbl, hasCoverage?'green':'');
    set('hkpi-tes-disp', 'Cartera cheqs: '+fM(cheqTotal)+' · Corte '+(d.fecha_corte||'').split('-').reverse().join('/'));
  });

  // ── Valuación activo corriente ─────────────────────────────
  var vPromise = _valData
    ? Promise.resolve(_valData)
    : fetch(STOCK_SB+'/valuacion_historica.json',{}).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;});

  vPromise.then(function(d){
    if(!d||!d.snapshots||!d.snapshots.length) return;
    var snaps = d.snapshots.slice().sort(function(a,b){ return a.periodo<b.periodo?-1:1; });
    var ult = snaps[snaps.length-1];
    var c   = ult.componentes || {};
    var pr  = ult.precios || {};
    // total USD: explícito o derivado
    var totalUSD = c.total_usd != null ? c.total_usd
                 : (c.total_pesos && pr.bna_tc_venta ? Math.round(c.total_pesos/pr.bna_tc_venta) : null);
    setC('hkpi-val-pesos', fB(c.total_pesos), 'gold');
    if(totalUSD!=null){
      var absM = Math.abs(totalUSD), sign = totalUSD<0?'−':'';
      var usdStr = absM>=1e6 ? sign+'U$S\u00a0'+(absM/1e6).toFixed(2)+'\u00a0M' : sign+'U$S\u00a0'+Math.round(absM).toLocaleString('es-AR');
      setC('hkpi-val-usd', usdStr, '');
    }
    set('hkpi-val-periodo', 'Período '+ult.periodo);
    if(pr.bna_tc_venta) set('hkpi-val-tc', 'MEP $'+Math.round(pr.bna_tc_venta).toLocaleString('es-AR')+'/USD');
  });
}

function goHome(){if(typeof sbSetActive==="function") sbSetActive("home");showScreen('screenHome');document.body.style.background='';window.scrollTo(0,0);loadHomeKpis();}
function logout(){
  currentUser=null;chartsInited=false;
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
    var periodEl = document.getElementById('sbUserPeriod');
    if (avatarEl) avatarEl.textContent = user.initials || '--';
    if (nameEl)   nameEl.textContent   = user.name || 'Usuario';
    if (periodEl) periodEl.textContent = (typeof selectedPeriod !== 'undefined' ? selectedPeriod : '');

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
  }
  sbShow();
}
