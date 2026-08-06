/* Baby Shower Adriano — invitación */

const CONFIG = {
  // Bolivia es UTC-4 todo el año (sin horario de verano), por eso el offset va fijo.
  fecha: '2026-09-05T16:00:00-04:00',

  // El nombre del invitado no se muestra en ninguna parte del sitio.
  // Si se activa, solo se usa el nombre que venga por ?n= — el mapeo
  // código→nombre vive en el panel y nunca se publica acá.
  showGuestName: false,

  // La canción entra recién en el segundo 46: la intro instrumental no acompaña
  // al video. Al terminar vuelve acá, no al principio.
  musicaDesde: 46,

  whatsapp: '17867163274',
  // Coordenadas exactas del lugar. Van así y no como link corto de Maps
  // porque los goo.gl caducan y estos links se mandan con meses de anticipación.
  maps: 'https://www.google.com/maps/search/?api=1&query=-17.7502577,-63.2208668',

  evento: {
    fechaTexto: 'Sábado, 5 de Septiembre 2026',
    horaTexto: '4:00 PM',
    lugar: 'Colinas del Urubo Club House',
    lugarDetalle: 'La Cabaña',
    dressCode: 'Semi-formal',
    dressCodeNota: 'Elegante y clásico. Vení cómodo, pero con tu mejor versión.',
  },

  bienvenida:
    'Estamos contando los días para conocer a Adriano, y queremos celebrar su llegada ' +
    'rodeados de las personas que más queremos. Será una tarde tranquila, con buena ' +
    'comida y mucha alegría. Tu presencia es el mejor regalo.',

  programa: [
    { hora: '4:00 PM', titulo: 'Recepción', detalle: 'Bienvenida y bocaditos' },
    { hora: '4:45 PM', titulo: 'Brindis', detalle: 'Unas palabras para Adriano' },
    { hora: '5:15 PM', titulo: 'Juegos', detalle: 'Sorpresas para los invitados' },
    { hora: '6:30 PM', titulo: 'Cena', detalle: 'A la mesa' },
  ],

  mensaje:
    '¡Hola! Quiero confirmar mi asistencia al Baby Shower de Adriano (5 de septiembre, 4:00 PM).',

  rsvpNota:
    'Al confirmar se abre un chat de WhatsApp. La decoradora te responderá para coordinar ' +
    'con cuántas personas asistís.',
};

const RESERVADOS = new Set([
  'admin', 'api', 'index.html', 'favicon.svg', 'og.jpg', 'style.css', 'script.js',
]);

/* ---------- Invitado ---------- */

// Devuelve solo el código de la URL. El nombre no llega nunca al frontend.
function resolveGuestId() {
  const params = new URLSearchParams(location.search);
  const pathId = decodeURIComponent(location.pathname).split('/').filter(Boolean)[0] || '';
  const raw = (params.get('id') || pathId).trim().slice(0, 40);

  if (!raw || RESERVADOS.has(raw.toLowerCase())) return null;

  const id = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return id || null;
}

const guestId = resolveGuestId();

/* ---------- Tracking ---------- */

const TRACK_KEY = 'bsa_events';

function trackLocal(event) {
  try {
    const db = JSON.parse(localStorage.getItem(TRACK_KEY) || '{}');
    const key = guestId || '_anonimo';
    const rec = db[key] || { views: 0 };
    if (event === 'view') rec.views = (rec.views || 0) + 1;
    if (event === 'open') rec.opened = true;
    if (event === 'rsvp_click') rec.rsvp = true;
    rec.lastEvent = event;
    rec.lastAt = new Date().toISOString();
    db[key] = rec;
    localStorage.setItem(TRACK_KEY, JSON.stringify(db));
  } catch (_) {
    /* localStorage bloqueado (modo privado) — el tracking no debe romper la invitación */
  }
}

function track(event) {
  trackLocal(event);

  const body = JSON.stringify({ event, slug: guestId || '_anonimo' });

  // keepalive/sendBeacon para que el evento sobreviva a la navegación a WhatsApp
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

/* ---------- Render del contenido ---------- */

const content = document.getElementById('content');
const intro = document.getElementById('intro');
const film = document.getElementById('filmEl');
const flash = document.getElementById('flash');
const skipBtn = document.getElementById('skipBtn');
const replayBtn = document.getElementById('replayBtn');
const scrollHint = document.getElementById('scrollHint');
const musica = document.getElementById('musicaEl');
const muteBtn = document.getElementById('muteBtn');

const { evento } = CONFIG;

document.getElementById('bienvenidaTexto').textContent = CONFIG.bienvenida;
document.getElementById('detFecha').textContent = evento.fechaTexto;
document.getElementById('detHora').textContent = evento.horaTexto;
document.getElementById('detLugar').textContent = evento.lugar;
document.getElementById('detLugarDetalle').textContent = evento.lugarDetalle;
document.getElementById('dressCode').textContent = evento.dressCode;
document.getElementById('dressCodeNota').textContent = evento.dressCodeNota;
document.getElementById('rsvpNota').textContent = CONFIG.rsvpNota;
document.getElementById('mapsBtn').href = CONFIG.maps;

const programaLista = document.getElementById('programaLista');
for (const paso of CONFIG.programa) {
  const li = document.createElement('li');

  const hora = document.createElement('span');
  hora.className = 'tl-hora';
  hora.textContent = paso.hora;

  const titulo = document.createElement('span');
  titulo.className = 'tl-titulo';
  titulo.textContent = paso.titulo;

  li.append(hora, titulo);

  if (paso.detalle) {
    const detalle = document.createElement('span');
    detalle.className = 'tl-detalle';
    detalle.textContent = paso.detalle;
    li.appendChild(detalle);
  }

  programaLista.appendChild(li);
}

if (CONFIG.showGuestName) {
  const nombre = (new URLSearchParams(location.search).get('n') || '').trim();
  if (nombre) {
    const p = document.createElement('p');
    p.className = 'greeting';
    p.textContent = `Para: ${nombre.slice(0, 80)}`;
    document.getElementById('hero').prepend(p);
  }
}

document.getElementById('rsvpBtn').addEventListener('click', () => {
  track('rsvp_click');
  const texto = CONFIG.mensaje + (guestId ? ` [ref: ${guestId}]` : '');
  location.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`;
});

/* ---------- Contador regresivo ---------- */

const target = new Date(CONFIG.fecha).getTime();
const cd = {
  days: document.getElementById('cdDays'),
  hours: document.getElementById('cdHours'),
  minutes: document.getElementById('cdMinutes'),
  seconds: document.getElementById('cdSeconds'),
};
const cdGrid = document.querySelector('.cd-grid');
const cdMessage = document.getElementById('cdMessage');
let timer;

function tick() {
  const diff = target - Date.now();

  if (diff <= 0) {
    cdGrid.hidden = true;
    cdMessage.hidden = false;
    cdMessage.textContent = '¡Hoy es el día!';
    clearInterval(timer);
    return;
  }

  const s = Math.floor(diff / 1000);
  cd.days.textContent = Math.floor(s / 86400);
  cd.hours.textContent = String(Math.floor(s / 3600) % 24).padStart(2, '0');
  cd.minutes.textContent = String(Math.floor(s / 60) % 60).padStart(2, '0');
  cd.seconds.textContent = String(s % 60).padStart(2, '0');
}

tick();
timer = setInterval(tick, 1000);

/* ---------- Reveal por scroll ---------- */

const secciones = document.querySelectorAll('.section');
let observer;

function activarScrollReveal() {
  document.getElementById('hero').classList.add('visible');

  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  for (const s of secciones) {
    if (!s.classList.contains('visible')) observer.observe(s);
  }
}

let hintOculto = false;
window.addEventListener('scroll', () => {
  if (hintOculto || window.scrollY < 40) return;
  hintOculto = true;
  scrollHint.classList.add('gone');
}, { passive: true });

/* ---------- Intro y transición ---------- */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof window.gsap !== 'undefined';
let revealed = false;

function showContent() {
  content.hidden = false;
  intro.hidden = true;
  film.pause();
  document.body.classList.remove('locked');
  replayBtn.hidden = false;

  // El observer se crea recién acá: con #content oculto las secciones miden 0
  // y todas se marcarían como visibles de golpe.
  if (!observer) activarScrollReveal();
}

function reveal(fast = false) {
  if (revealed) return;
  revealed = true;
  skipBtn.hidden = true;

  if (!hasGsap) {
    showContent();
    return;
  }

  const tl = gsap.timeline();
  tl.fromTo(flash,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1.4, duration: 0.35, ease: 'expo.in', onComplete: showContent })
    .to(flash, { opacity: 0, duration: 0.7, ease: 'power2.out' });

  if (fast) tl.timeScale(1.8);
}

// Buscar antes de que el navegador sepa la duración deja currentTime en 0.
function irAlInicioMusical() {
  if (musica.readyState >= 1) musica.currentTime = CONFIG.musicaDesde;
  else musica.addEventListener('loadedmetadata', irAlInicioMusical, { once: true });
}

function startFilm() {
  track('open');
  document.getElementById('introHint').hidden = true;
  skipBtn.hidden = false;

  // Va acá y no en showContent() porque iOS solo deja arrancar audio dentro del
  // gesto que lo pidió, y el destello ocurre medio minuto después del toque.
  irAlInicioMusical();
  const m = musica.play();
  if (m && m.catch) m.catch(() => { muteBtn.hidden = true; });
  muteBtn.hidden = false;

  const p = film.play();
  if (p && p.catch) {
    // Códec no soportado, ahorro de datos, etc. Nunca dejar al invitado en negro.
    p.catch(() => reveal(true));
  }
}

if (reducedMotion) {
  intro.hidden = true;
  content.hidden = false;
  replayBtn.hidden = false;
  revealed = true;
  for (const s of secciones) s.classList.add('visible');
  track('open');
} else {
  document.body.classList.add('locked');

  intro.addEventListener('click', (e) => {
    if (e.target === skipBtn) return;
    if (film.paused && !revealed) startFilm();
  });

  // El destello arranca antes del último frame para que el corte no se sienta seco
  film.addEventListener('timeupdate', () => {
    if (film.duration && film.currentTime >= film.duration - 0.45) reveal();
  });
  film.addEventListener('ended', () => reveal());
  film.addEventListener('error', () => reveal(true));

  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    reveal(true);
  });
}

musica.addEventListener('ended', () => {
  irAlInicioMusical();
  musica.play().catch(() => {});
});

muteBtn.addEventListener('click', () => {
  musica.muted = !musica.muted;
  muteBtn.textContent = musica.muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', musica.muted ? 'Activar música' : 'Silenciar música');
});

replayBtn.addEventListener('click', () => {
  revealed = false;
  content.hidden = true;
  intro.hidden = false;
  replayBtn.hidden = true;
  document.body.classList.add('locked');
  window.scrollTo(0, 0);
  if (hasGsap) gsap.set(flash, { opacity: 0 });
  film.currentTime = 0;
  startFilm();
});

track('view');
