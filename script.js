/* Baby Shower Adriano — invitación */

const CONFIG = {
  // Bolivia es UTC-4 todo el año (sin horario de verano), por eso el offset va fijo.
  fecha: '2026-09-05T16:00:00-04:00',

  // El nombre no viaja nunca en la URL (quedaría en la vista previa de WhatsApp).
  // La invitación cambia el código por el nombre contra /api/nombre, que resuelve
  // de a uno: la lista completa sigue detrás del Basic Auth del panel.
  showGuestName: true,

  // Segundo desde el que arranca la música (por defecto; cada canción puede
  // pisarlo con su propio `desde`). Al terminar vuelve acá, no al principio.
  musicaDesde: 0,

  whatsapp: '59178006388',
  // Coordenadas exactas del lugar. Van así y no como link corto de Maps
  // porque los goo.gl caducan y estos links se mandan con meses de anticipación.
  maps: 'https://www.google.com/maps/search/?api=1&query=-17.7475890,-63.2171060',

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
    'rodeados de las personas que más queremos. Será una tarde para compartir, con buena ' +
    'comida y mucha alegría. Tu presencia es muy importante para nosotros.',

  mensaje:
    '¡Hola! Quiero confirmar mi asistencia al Baby Shower de Adriano (5 de septiembre, 4:00 PM).',

  rsvpNota:
    'Escribí tu nombre y confirmá. Se abrirá un chat de WhatsApp para avisarnos que venís.',
};

/* ---------- Música: una versión por canción ---------- */

// Cada canción vive en su subcarpeta y tiene su propia ruta (link) para compartir.
// Ej: /yellow, /stand-by-me, /take-five, /fly-me-to-the-moon
const SONGS = {
  'yellow':             { file: '/public/musica/yellow/audio.mp3',              titulo: 'Yellow — Coldplay',            desde: 0 },
  'stand-by-me':        { file: '/public/musica/stand-by-me/audio.mp3',         titulo: 'Stand by Me — Ben E. King',    desde: 0 },
  'take-five':          { file: '/public/musica/take-five/audio.mp3',           titulo: 'Take Five — Dave Brubeck',     desde: 0 },
  'fly-me-to-the-moon': { file: '/public/musica/fly-me-to-the-moon/audio.mp3',  titulo: 'Fly Me To The Moon — Sinatra', desde: 0 },
};
const SONG_DEFAULT = 'stand-by-me';

const RESERVADOS = new Set([
  'admin', 'api', 'index.html', 'favicon.svg', 'og.jpg', 'style.css', 'script.js',
  'public', ...Object.keys(SONGS),
]);

// El slug de canción puede venir en el path (/yellow) o como ?m=yellow.
function resolveSong() {
  const params = new URLSearchParams(location.search);
  const pathSeg = decodeURIComponent(location.pathname).split('/').filter(Boolean)[0] || '';
  const slug = (params.get('m') || pathSeg).trim().toLowerCase();
  return SONGS[slug] ? slug : SONG_DEFAULT;
}

const songSlug = resolveSong();
const song = SONGS[songSlug];
CONFIG.musicaDesde = song.desde;

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
musica.src = song.file;
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

const saludo = document.getElementById('saludo');

// Se resuelve una sola vez al cargar y queda acá porque lo usan dos cosas: el
// saludo del hero y, sobre todo, el mensaje de WhatsApp. El código sirve para
// que el nombre no viaje en el link, pero a la decoradora le tiene que llegar
// un nombre, no un código que después tenga que ir a buscar al panel.
let guestName = null;

// Si el servidor no contesta, la invitación queda sin saludo y no pasa nada más:
// el nombre es un adorno para leerla, y el mensaje cae de vuelta al código.
async function resolverNombre() {
  if (!guestId) return;
  try {
    const res = await fetch(`/api/nombre?id=${encodeURIComponent(guestId)}`);
    if (!res.ok) return;
    const { name } = await res.json();
    if (!name) return;
    guestName = name;
    if (CONFIG.showGuestName) {
      saludo.textContent = name;
      saludo.hidden = false;
    }
    // Link viejo con ID: precargamos el nombre para que no lo reescriban.
    const input = document.getElementById('rsvpNombre');
    if (input && !input.value) {
      input.value = name;
      document.getElementById('rsvpBtn').disabled = false;
    }
  } catch (_) {
    /* sin conexión */
  }
}

resolverNombre();

const rsvpBtn = document.getElementById('rsvpBtn');
const rsvpNombre = document.getElementById('rsvpNombre');

// El botón queda deshabilitado hasta que el invitado escriba su nombre: el
// mensaje a los papás tiene que llegar siempre firmado, no anónimo.
rsvpNombre.addEventListener('input', () => {
  rsvpBtn.disabled = rsvpNombre.value.trim() === '';
});

rsvpBtn.addEventListener('click', () => {
  const nombre = rsvpNombre.value.trim();
  if (!nombre) return;
  track('rsvp_click');
  const texto = `${CONFIG.mensaje}\n\nSoy ${nombre}.`;
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

/* ---------- Reveal por scroll (GSAP ScrollTrigger) ---------- */

const secciones = document.querySelectorAll('.section');
const hasST = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
let scrollAnimBuilt = false;

// Sin GSAP/ScrollTrigger (o con motion reducido) mostramos todo de una: la
// invitación nunca depende de la animación para poder leerse.
function mostrarTodo() {
  for (const s of secciones) s.classList.add('visible');
}

function buildScrollAnim() {
  if (scrollAnimBuilt) return;
  scrollAnimBuilt = true;

  if (reducedMotion || !hasST) {
    mostrarTodo();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  mostrarTodo(); // la caja de la sección queda visible; animamos sus hijos.

  for (const s of secciones) {
    // Revelado escalonado de los hijos (no del panel ni del oso, que tiene su
    // propio parallax). El scrollHint del hero conserva su pulso propio.
    const hijos = [...s.children].filter((el) =>
      !el.classList.contains('oso') &&
      !el.classList.contains('countdown') &&
      el.id !== 'scrollHint');

    gsap.from(hijos, {
      y: 24,
      autoAlpha: 0,
      duration: 0.7,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: s, start: 'top 80%', once: true },
    });

    // Parallax sutil del oso: sube apenas al pasar la sección.
    const oso = s.querySelector('.oso');
    if (oso) {
      gsap.fromTo(oso, { yPercent: 8 }, {
        yPercent: -8,
        ease: 'none',
        scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  }

  // Las celdas del contador entran con un rebote leve. No se animan los números:
  // los actualiza tick() cada segundo.
  const celdas = document.querySelectorAll('.cd-cell');
  if (celdas.length) {
    gsap.from(celdas, {
      autoAlpha: 0,
      y: 16,
      scale: 0.9,
      duration: 0.5,
      stagger: 0.08,
      ease: 'back.out(1.4)',
      scrollTrigger: { trigger: '#cuenta', start: 'top 75%', once: true },
    });
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

  // Se arma recién acá: con #content oculto las secciones miden 0 y los
  // ScrollTriggers calcularían mal sus posiciones.
  buildScrollAnim();
  if (hasST) ScrollTrigger.refresh();
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
  muteBtn.textContent = musica.muted ? 'Música off' : 'Música';
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
  // Al reponer el contenido cambian las medidas; recalcular para que los
  // ScrollTriggers y el parallax sigan alineados.
  if (hasST) ScrollTrigger.refresh();
  film.currentTime = 0;
  startFilm();
});

track('view');
