/* Panel admin — no pretende ser seguro, solo cómodo. */

const EVENTS_KEY = 'bsa_events';   // lo escribe la invitación (tracking automático)
const GUESTS_KEY = 'bsa_guests';   // lo escribe este panel (lista maestra + estado manual)

const ESTADOS = {
  sin_confirmar: 'Sin confirmar',
  confirmado: 'Confirmado',
  no_asiste: 'No asiste',
};

const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

const loginForm = document.getElementById('loginForm');
const dashboard = document.getElementById('dashboard');
const loginError = document.getElementById('loginError');
const tableBody = document.getElementById('tableBody');
const storageNote = document.getElementById('storageNote');
const syncNote = document.getElementById('syncNote');
const avisoRespaldo = document.getElementById('avisoRespaldo');
const emptyState = document.getElementById('emptyState');
const importFile = document.getElementById('importFile');

let auth = null;
let enServidor = false;
let guests = {};   // { id: { name, status, people, notes } }
let events = {};   // { id: { views, opened, rsvp, lastEvent, lastAt } }
let filtro = 'todos';

/* ---------- Persistencia ---------- */

function leerJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

// localStorage queda como espejo local: si el servidor no responde, el panel
// sigue usable y no se pierde lo que estabas cargando.
function guardarGuests() {
  localStorage.setItem(GUESTS_KEY, JSON.stringify(guests));
}

function apiGuests(method, body) {
  return fetch('/api/guests', {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function sincronizar(promesa) {
  if (!enServidor) return;
  try {
    const res = await promesa;
    if (!res.ok) throw new Error(res.status);
    syncNote.hidden = true;
  } catch {
    syncNote.hidden = false;
    syncNote.textContent =
      'No se pudo guardar en el servidor. El cambio quedó en este navegador; ' +
      'refrescá para reintentar.';
  }
}

function guardarUno(id) {
  guardarGuests();
  sincronizar(apiGuests('POST', { id, guest: guests[id] }));
}

function guardarTodos() {
  guardarGuests();
  sincronizar(apiGuests('PUT', { guests }));
}

function nuevoCodigo() {
  let codigo;
  do {
    codigo = Array.from(
      { length: 6 },
      () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
    ).join('');
  } while (guests[codigo]);
  return codigo;
}

async function cargar() {
  guests = leerJSON(GUESTS_KEY);
  events = leerJSON(EVENTS_KEY);
  syncNote.hidden = true;

  const pedir = (ruta) => fetch(ruta, { headers: { Authorization: auth } });

  try {
    const [resEventos, resLista] = await Promise.all([pedir('/api/events'), pedir('/api/guests')]);
    if (!resEventos.ok || !resLista.ok) throw new Error('sin servidor');

    const data = await resEventos.json();
    events = {};
    for (const r of data.invitados || []) events[r.slug] = r;

    const lista = (await resLista.json()).guests || {};
    // La primera vez el servidor está vacío y lo que vale es lo que ya tenías acá.
    if (!Object.keys(lista).length && Object.keys(guests).length) {
      await apiGuests('PUT', { guests });
    } else {
      guests = lista;
      guardarGuests();
    }

    enServidor = true;
    storageNote.hidden = true;
    avisoRespaldo.hidden = true;
  } catch {
    enServidor = false;
    storageNote.hidden = false;
    storageNote.textContent =
      'Sin conexión con el servidor: el panel está mostrando lo guardado en este navegador. ' +
      'Refrescá para reintentar.';
    avisoRespaldo.hidden = false;
  }

  render();
}

/* ---------- Invitación ---------- */

// El link sale del dominio donde está abierto el panel, así que sigue funcionando
// en vercel.app y también si algún día se le pone un dominio propio.
function linkInvitacion(id) {
  return `${location.origin}/${id}`;
}

function mensajeInvitacion(id) {
  return (
    'Te invitamos al Baby Shower de Adriano\n' +
    'Sábado 5 de Septiembre, 4:00 PM — Colinas del Urubo Club House\n' +
    linkInvitacion(id)
  );
}

// navigator.clipboard no existe fuera de HTTPS ni en algunos navegadores viejos;
// el textarea es el plan B para que "Copiar link" nunca quede sin hacer nada.
async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/* ---------- Filas ---------- */

function construirFilas() {
  const ids = new Set([...Object.keys(guests), ...Object.keys(events)]);

  return [...ids].map((id) => {
    const g = guests[id] || {};
    const e = events[id] || {};

    // Tocar "Confirmar asistencia" marca al invitado como confirmado, pero solo
    // mientras nadie haya elegido su estado a mano: la decisión manual siempre gana.
    const autoConfirmado = !g.manual && Boolean(e.rsvp);

    return {
      id,
      name: g.name || (id === '_anonimo' ? 'Visita sin código' : 'Desconocido'),
      enLista: Boolean(guests[id]),
      status: autoConfirmado ? 'confirmado' : g.status || 'sin_confirmar',
      auto: autoConfirmado,
      people: g.people ?? 1,
      notes: g.notes || '',
      views: e.views || 0,
      opened: !!e.opened,
      rsvp: !!e.rsvp,
      lastEvent: e.lastEvent || null,
      lastAt: e.lastAt || null,
    };
  });
}

function actualizar(id, campo, valor) {
  const actual = guests[id] || { name: 'Desconocido' };
  guests[id] = { ...actual, [campo]: valor };
  // Elegir el estado a mano lo congela: el tracking ya no lo vuelve a mover.
  if (campo === 'status') guests[id].manual = true;
  guardarUno(id);
  render();
}

/* ---------- Render ---------- */

function render() {
  const filas = construirFilas().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const visibles = filtro === 'todos' ? filas : filas.filter((r) => r.status === filtro);

  tableBody.replaceChildren();

  for (const r of visibles) {
    const tr = document.createElement('tr');

    // Invitado
    const tdName = document.createElement('td');
    tdName.dataset.label = 'Invitado';
    tdName.textContent = r.name;
    if (!r.enLista) tdName.classList.add('unknown');
    const code = document.createElement('span');
    code.className = 'slug';
    code.textContent = r.id;
    tdName.appendChild(code);

    // Invitación: mandarla es la tarea principal del panel, así que vive en la
    // fila y no detrás de un archivo que haya que generar aparte.
    const tdLink = document.createElement('td');
    tdLink.className = 'acciones';
    tdLink.dataset.label = 'Invitación';

    const enviar = document.createElement('button');
    enviar.type = 'button';
    enviar.className = 'accion';
    enviar.textContent = 'Enviar';
    // Sin número: WhatsApp abre la lista de contactos y eligen a quién mandarla.
    enviar.addEventListener('click', () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(mensajeInvitacion(r.id))}`, '_blank');
    });

    const copiar = document.createElement('button');
    copiar.type = 'button';
    copiar.className = 'accion';
    copiar.textContent = 'Copiar link';
    copiar.addEventListener('click', async () => {
      const ok = await copiarAlPortapapeles(linkInvitacion(r.id));
      copiar.textContent = ok ? 'Copiado' : 'Copiá a mano';
      setTimeout(() => { copiar.textContent = 'Copiar link'; }, 1800);
    });

    tdLink.append(enviar, copiar);

    // Estado
    const tdStatus = document.createElement('td');
    tdStatus.dataset.label = 'Estado';
    const select = document.createElement('select');
    select.className = `status status-${r.status}`;
    for (const [valor, texto] of Object.entries(ESTADOS)) {
      const opt = document.createElement('option');
      opt.value = valor;
      opt.textContent = texto;
      if (valor === r.status) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => actualizar(r.id, 'status', select.value));
    tdStatus.appendChild(select);

    if (r.auto) {
      const auto = document.createElement('span');
      auto.className = 'auto-tag';
      auto.textContent = 'automático';
      auto.title = 'Se confirmó solo porque tocó el botón. Si lo cambiás a mano, queda fijo.';
      tdStatus.appendChild(auto);
    }

    // Personas
    const tdPeople = document.createElement('td');
    tdPeople.dataset.label = 'Personas';
    const people = document.createElement('input');
    people.type = 'number';
    people.min = '0';
    people.className = 'people';
    people.value = r.people;
    people.addEventListener('change', () =>
      actualizar(r.id, 'people', Math.max(0, Number(people.value) || 0))
    );
    tdPeople.appendChild(people);

    // Notas
    const tdNotes = document.createElement('td');
    tdNotes.dataset.label = 'Notas';
    const notes = document.createElement('input');
    notes.type = 'text';
    notes.className = 'notes';
    notes.placeholder = '—';
    notes.value = r.notes;
    notes.addEventListener('change', () => actualizar(r.id, 'notes', notes.value.trim()));
    tdNotes.appendChild(notes);

    // Tracking automático
    const tdOpen = document.createElement('td');
    tdOpen.dataset.label = 'Abrió';
    tdOpen.textContent = r.opened ? 'Sí' : 'No';
    tdOpen.className = r.opened ? 'yes' : 'no';

    const tdRsvp = document.createElement('td');
    tdRsvp.dataset.label = 'Confirmó';
    tdRsvp.textContent = r.rsvp ? 'Sí' : 'No';
    tdRsvp.className = r.rsvp ? 'yes' : 'no';

    const tdLast = document.createElement('td');
    tdLast.dataset.label = 'Último evento';
    tdLast.textContent = r.lastAt
      ? `${r.lastEvent} · ${new Date(r.lastAt).toLocaleString('es-BO')}`
      : '—';

    const tdViews = document.createElement('td');
    tdViews.dataset.label = 'Visitas';
    tdViews.textContent = r.views;

    tr.append(tdName, tdLink, tdStatus, tdPeople, tdNotes, tdOpen, tdRsvp, tdLast, tdViews);
    tableBody.appendChild(tr);
  }

  emptyState.hidden = filas.length > 0;

  const confirmados = filas.filter((r) => r.status === 'confirmado');
  document.getElementById('statConfirmados').textContent = confirmados.length;
  document.getElementById('statPendientes').textContent =
    filas.filter((r) => r.status === 'sin_confirmar').length;
  document.getElementById('statNoAsisten').textContent =
    filas.filter((r) => r.status === 'no_asiste').length;
  // Solo cuentan los confirmados: es el número que sirve para catering.
  document.getElementById('statPersonas').textContent =
    confirmados.reduce((sum, r) => sum + (r.people || 0), 0);
}

/* ---------- Login ---------- */

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const usuario = document.getElementById('userInput').value;
  const clave = document.getElementById('passInput').value;

  if (usuario !== 'adriano' || clave !== 'adriano') {
    loginError.hidden = false;
    return;
  }

  auth = 'Basic ' + btoa(`${usuario}:${clave}`);
  loginForm.hidden = true;
  dashboard.hidden = false;
  cargar();
});

/* ---------- Filtros ---------- */

for (const btn of document.querySelectorAll('.filter')) {
  btn.addEventListener('click', () => {
    filtro = btn.dataset.filter;
    for (const b of document.querySelectorAll('.filter')) b.classList.remove('active');
    btn.classList.add('active');
    render();
  });
}

/* ---------- Alta manual ---------- */

document.getElementById('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('addName');
  const nombre = input.value.trim();
  if (!nombre) return;

  const id = nuevoCodigo();
  guests[id] = { name: nombre, status: 'sin_confirmar', people: 1, notes: '' };
  guardarUno(id);
  input.value = '';
  render();

  alert(`${nombre} ya está en la lista.\n\nAhora tocá "Enviar" en su fila para mandarle la invitación por WhatsApp.`);
});

/* ---------- Importar / exportar ---------- */

document.getElementById('importBtn').addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('Ese archivo no es JSON válido.');
    importFile.value = '';
    return;
  }

  let nuevos = 0;
  let actualizados = 0;

  for (const [id, valor] of Object.entries(data)) {
    // Acepta el invitados.json del generador ({ codigo: "Nombre" })
    // y el export completo de este panel ({ codigo: { name, status, ... } }).
    const entrante = typeof valor === 'string' ? { name: valor } : valor || {};
    if (!entrante.name) continue;

    if (guests[id]) {
      // Nunca pisar el estado manual ya cargado.
      guests[id].name = entrante.name;
      actualizados++;
    } else {
      guests[id] = {
        name: entrante.name,
        status: entrante.status || 'sin_confirmar',
        people: entrante.people ?? 1,
        notes: entrante.notes || '',
        // Un JSON con estado explícito viene de un respaldo del panel: era una decisión manual.
        manual: entrante.manual ?? Boolean(entrante.status),
      };
      nuevos++;
    }
  }

  guardarTodos();
  importFile.value = '';
  render();
  alert(`Importado: ${nuevos} invitados nuevos, ${actualizados} nombres actualizados.\nLos estados que ya tenías no se tocaron.`);
});

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const hoy = () => new Date().toISOString().slice(0, 10);

document.getElementById('exportBtn').addEventListener('click', () => {
  descargar(
    `invitados-adriano-${hoy()}.json`,
    JSON.stringify(guests, null, 2),
    'application/json'
  );
});

document.getElementById('csvBtn').addEventListener('click', () => {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [
    ['Invitado', 'Link', 'Codigo', 'Estado', 'Personas', 'Notas', 'Abrió', 'Confirmó', 'Último evento', 'Fecha', 'Visitas'],
  ];

  for (const r of construirFilas()) {
    lineas.push([
      r.name, linkInvitacion(r.id), r.id, ESTADOS[r.status], r.people, r.notes,
      r.opened ? 'Sí' : 'No',
      r.rsvp ? 'Sí' : 'No',
      r.lastEvent || '',
      r.lastAt ? new Date(r.lastAt).toLocaleString('es-BO') : '',
      r.views,
    ]);
  }

  const csv = '﻿' + lineas.map((l) => l.map(escape).join(',')).join('\r\n');
  descargar(`invitados-adriano-${hoy()}.csv`, csv, 'text/csv;charset=utf-8');
});

document.getElementById('refreshBtn').addEventListener('click', cargar);

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!confirm('¿Borrar TODOS los invitados y lo que se registró de cada uno?\n\nEsto no se puede deshacer. Si no estás seguro, cancelá y tocá "Guardar copia" primero.')) return;

  localStorage.removeItem(GUESTS_KEY);
  localStorage.removeItem(EVENTS_KEY);
  guests = {};
  try {
    await Promise.all([
      fetch('/api/events', { method: 'DELETE', headers: { Authorization: auth } }),
      fetch('/api/guests', { method: 'DELETE', headers: { Authorization: auth } }),
    ]);
  } catch {
    /* sin servidor no hay nada que limpiar del otro lado */
  }
  cargar();
});
