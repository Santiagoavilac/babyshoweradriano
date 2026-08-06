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
const emptyState = document.getElementById('emptyState');
const importFile = document.getElementById('importFile');

let auth = null;
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

function guardarGuests() {
  localStorage.setItem(GUESTS_KEY, JSON.stringify(guests));
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

  // Si algún día se configura KV, el tracking automático viene del servidor.
  try {
    const res = await fetch('/api/events', { headers: { Authorization: auth } });
    if (res.ok) {
      const data = await res.json();
      events = {};
      for (const r of data.invitados || []) events[r.slug] = r;
      storageNote.hidden = true;
    } else {
      throw new Error(res.status);
    }
  } catch {
    storageNote.hidden = false;
    storageNote.textContent =
      'El tracking automático (aperturas y clicks) sale de localStorage: solo se ven los ' +
      'eventos generados en este mismo dispositivo.';
  }

  render();
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
  guardarGuests();
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
    tdName.textContent = r.name;
    if (!r.enLista) tdName.classList.add('unknown');
    const code = document.createElement('span');
    code.className = 'slug';
    code.textContent = r.id;
    tdName.appendChild(code);

    // Estado
    const tdStatus = document.createElement('td');
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
    const notes = document.createElement('input');
    notes.type = 'text';
    notes.className = 'notes';
    notes.placeholder = '—';
    notes.value = r.notes;
    notes.addEventListener('change', () => actualizar(r.id, 'notes', notes.value.trim()));
    tdNotes.appendChild(notes);

    // Tracking automático
    const tdOpen = document.createElement('td');
    tdOpen.textContent = r.opened ? 'Sí' : 'No';
    tdOpen.className = r.opened ? 'yes' : 'no';

    const tdRsvp = document.createElement('td');
    tdRsvp.textContent = r.rsvp ? 'Sí' : 'No';
    tdRsvp.className = r.rsvp ? 'yes' : 'no';

    const tdLast = document.createElement('td');
    tdLast.textContent = r.lastAt
      ? `${r.lastEvent} · ${new Date(r.lastAt).toLocaleString('es-BO')}`
      : '—';

    const tdViews = document.createElement('td');
    tdViews.textContent = r.views;

    tr.append(tdName, tdStatus, tdPeople, tdNotes, tdOpen, tdRsvp, tdLast, tdViews);
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
  guardarGuests();
  input.value = '';
  render();

  alert(`Invitado agregado.\n\nSu código es: ${id}\n\nAgregalo a invitados.json si querés que el generador de links lo conozca.`);
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

  guardarGuests();
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
    ['Invitado', 'Codigo', 'Estado', 'Personas', 'Notas', 'Abrió', 'Confirmó', 'Último evento', 'Fecha', 'Visitas'],
  ];

  for (const r of construirFilas()) {
    lineas.push([
      r.name, r.id, ESTADOS[r.status], r.people, r.notes,
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
  if (!confirm('¿Borrar la lista de invitados Y el tracking? Esto no se puede deshacer.\n\nExportá el JSON antes si querés conservarlo.')) return;

  localStorage.removeItem(GUESTS_KEY);
  localStorage.removeItem(EVENTS_KEY);
  try {
    await fetch('/api/events', { method: 'DELETE', headers: { Authorization: auth } });
  } catch {
    /* sin KV no hay nada que limpiar del lado del servidor */
  }
  cargar();
});
