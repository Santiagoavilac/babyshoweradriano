#!/usr/bin/env node
/**
 * Genera links personalizados con códigos opacos, para que el nombre del
 * invitado no viaje nunca en la URL.
 *
 *   node scripts/generate-links.mjs --base https://tu-sitio.vercel.app "María Gómez" "Juan Pérez"
 *   node scripts/generate-links.mjs --base https://tu-sitio.vercel.app --file nombres.txt
 *
 * Es idempotente: lee invitados.json y conserva los códigos ya asignados.
 * Volver a correrlo NO rompe los links que ya enviaste.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const MAPA = 'invitados.json';

// Sin 0/O/1/l/i para que no se confundan al leerlos o dictarlos.
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
const LARGO = 6;

const args = process.argv.slice(2);
let base = 'https://babyshoweradriano.vercel.app';
const nombres = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base') {
    base = args[++i] || base;
  } else if (args[i] === '--file') {
    const ruta = args[++i];
    if (!ruta) {
      console.error('--file necesita una ruta');
      process.exit(1);
    }
    nombres.push(
      ...readFileSync(ruta, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    );
  } else {
    nombres.push(args[i]);
  }
}

if (nombres.length === 0) {
  console.error('Uso: node scripts/generate-links.mjs --base <url> "Nombre Uno" "Nombre Dos"');
  console.error('     node scripts/generate-links.mjs --base <url> --file nombres.txt');
  process.exit(1);
}

base = base.replace(/\/+$/, '');

// Mapa existente: { codigo: nombre }
let mapa = {};
if (existsSync(MAPA)) {
  try {
    mapa = JSON.parse(readFileSync(MAPA, 'utf8'));
  } catch {
    console.error(`${MAPA} existe pero no es JSON válido. Revisalo antes de continuar.`);
    process.exit(1);
  }
}

const codigoPorNombre = new Map();
for (const [codigo, nombre] of Object.entries(mapa)) {
  codigoPorNombre.set(nombre.toLowerCase(), codigo);
}

function nuevoCodigo() {
  let codigo;
  do {
    codigo = Array.from({ length: LARGO }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  } while (mapa[codigo]);
  return codigo;
}

const filas = [];
let nuevos = 0;

for (const nombre of nombres) {
  const limpio = nombre.trim();
  if (!limpio) continue;

  let codigo = codigoPorNombre.get(limpio.toLowerCase());
  const yaExistia = Boolean(codigo);

  if (!codigo) {
    codigo = nuevoCodigo();
    mapa[codigo] = limpio;
    codigoPorNombre.set(limpio.toLowerCase(), codigo);
    nuevos++;
  }

  const url = `${base}/${codigo}`;
  const mensaje =
    `Te invitamos al Baby Shower de Adriano\n` +
    `Sábado 5 de Septiembre, 4:00 PM — Colinas del Urubo Club House\n${url}`;

  filas.push({ nombre: limpio, codigo, url, mensaje, yaExistia });
}

for (const f of filas) {
  console.log(`\n── ${f.nombre}${f.yaExistia ? '  (código existente)' : '  (nuevo)'}`);
  console.log(f.mensaje);
}

writeFileSync(MAPA, JSON.stringify(mapa, null, 2) + '\n');

const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv =
  '﻿' +
  [
    ['Nombre', 'Codigo', 'URL', 'Mensaje'],
    ...filas.map((f) => [f.nombre, f.codigo, f.url, f.mensaje]),
  ]
    .map((l) => l.map(escape).join(','))
    .join('\r\n');

writeFileSync('links.csv', csv);

console.log(`\n✔ ${filas.length} links en links.csv (${nuevos} códigos nuevos)`);
console.log(`✔ Mapeo código→nombre actualizado en ${MAPA} — importalo en /admin`);
console.log(`\n⚠  ${MAPA} es la única forma de saber qué código es cada persona. No lo pierdas.`);
