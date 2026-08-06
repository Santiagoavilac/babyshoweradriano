# Invitación Baby Shower — Adriano

Sitio estático mobile-first. Se abre desde WhatsApp: pantalla negra, el sobre en video,
un destello dorado y la invitación.

```
npm install          # solo hace falta para @vercel/kv
npx serve .          # http://localhost:3000
```

---

## Editar los datos del evento

Todo el contenido editable vive en el objeto `CONFIG` al inicio de **`script.js`**: fecha,
textos visibles, lugar, dress code, párrafo de bienvenida, programa del evento y el mensaje
de WhatsApp. La fecha se escribe en un solo lugar (`fecha` alimenta el contador,
`evento.fechaTexto` es lo que la gente lee).

El `programa` es una lista de `{ hora, titulo, detalle }`: agregar o quitar pasos solo
requiere tocar ese array.

---

## Links personalizados

**Para el uso diario no hace falta nada de esto.** El panel `/admin` crea el invitado, le
asigna el código y abre WhatsApp con la invitación lista: lo manejan los papás desde el
celular sin tocar un archivo ni una terminal. El script de abajo sirve para dar de alta
muchos invitados de una sola vez.

```bash
node scripts/generate-links.mjs --base https://tu-sitio.vercel.app "María Gómez" "Juan Pérez"
node scripts/generate-links.mjs --base https://tu-sitio.vercel.app --file nombres.txt
```

Cada invitado recibe un **código opaco** de 6 caracteres (`/a7f3k2`), no su nombre. Así el
nombre no aparece nunca en la URL, ni en la barra del navegador, ni en la vista previa de
WhatsApp. El sitio no muestra el nombre en ninguna parte.

El script escribe dos archivos:

| Archivo | Contenido |
|---|---|
| `invitados.json` | el mapeo `{ codigo: "Nombre" }` — **la única fuente de verdad** |
| `links.csv` | nombre, código, URL y el mensaje listo para pegar |

> **`invitados.json` es lo único que sabe qué código es cada persona.** Si lo perdés, los
> links siguen funcionando pero ya no vas a poder saber quién es quién. Guardalo. Y como
> contiene nombres reales, no lo subas a un repo público.

El script es **idempotente**: lee `invitados.json` antes de generar y conserva los códigos
ya asignados. Volver a correrlo con la lista completa no rompe los links que ya enviaste;
solo los nombres nuevos reciben código nuevo.

Después de generarlos, importá `invitados.json` en `/admin` para tener la lista maestra.

También funciona `?id=a7f3k2` como query, por si alguna ruta se rompe.

---

## El video

El archivo original venía en **AV1**, que la mayoría de los iPhones no puede decodificar —
habrían visto una pantalla negra. `scripts/build-assets.sh` genera un MP4 H.264 que sí
reproduce en todos lados, y deja el WebM como alternativa para navegadores que lo prefieran.

```bash
npm run assets   # regenera invitacion.mp4, poster.jpg y og.jpg
```

Si reemplazás el video, dejá el nuevo en `public/video/` y corré ese comando otra vez.

El video va siempre en silencio (el audio original es inaudible, −52 dB). Eso además
garantiza que los navegadores nunca bloqueen la reproducción.

## La música

`public/deep-in-it.mp3` arranca cuando el invitado toca el sobre, desde el segundo que
indica `CONFIG.musicaDesde` (46: antes de ahí la canción es intro instrumental). Sigue
sonando durante toda la invitación y vuelve a ese mismo segundo al terminar, no al 0.

El `play()` va dentro del handler del toque a propósito: iOS solo permite arrancar audio
dentro del gesto que lo pidió, y el destello ocurre medio minuto después. Hay un botón de
silencio abajo a la izquierda.

---

## Panel de invitados

**`/admin`** — usuario `adriano`, contraseña `adriano`.

La confirmación real la maneja la decoradora por WhatsApp, no la web. Por eso el panel
combina dos cosas:

- **Tracking automático** (lo escribe la invitación): quién abrió, quién tocó "Confirmar
  asistencia", cuándo fue el último evento y cuántas visitas hubo.
- **Estado manual** (lo cargás vos): estado (`Sin confirmar` / `Confirmado` / `No asiste`),
  cantidad de personas y notas por invitado.

Quien toca "Confirmar asistencia" y pasa a WhatsApp queda marcado como **Confirmado**
automáticamente (aparece con la etiqueta *automático*). En cuanto vos elegís un estado a
mano, ese estado queda fijo y el tracking no lo vuelve a mover: si alguien tocó el botón
solo para avisar que no puede ir, lo ponés en "No asiste" y ahí se queda.

Arriba hay filtros por estado y un resumen. El total de **personas** suma solo los
confirmados: es el número que sirve para catering.

**Flujo normal:** correr el generador → *Importar JSON* con `invitados.json` → a medida que
la decoradora recibe respuestas, cambiar el estado y la cantidad a mano.

Reimportar `invitados.json` es seguro: actualiza nombres pero **nunca pisa** los estados,
personas ni notas que ya cargaste.

Es una barrera de cortesía, no de seguridad. Cualquiera que lea el código encuentra las
credenciales — no pongas ahí nada que no quieras que se vea.

### Persistencia

Todo vive en Redis (Upstash, vía el Marketplace de Vercel): tanto el tracking como la lista
maestra y el estado manual. Podés entrar desde el celular o desde otra computadora y ver lo
mismo, y limpiar el caché no borra nada.

| Clave | La escribe | Contiene |
|---|---|---|
| `bsa:guests` | la invitación, vía `/api/track` | `views`, `opened`, `rsvp`, `lastEvent`, `lastAt` |
| `bsa:lista` | el panel, vía `/api/guests` | `name`, `status`, `people`, `notes`, `manual` |

`localStorage` quedó como espejo local: si el servidor no responde, el panel sigue usable
con lo último que viste y aparece un aviso. Ahí sí conviene *Exportar JSON*, que es un
respaldo completo y `Importar JSON` lo restaura.

**Sin base conectada** el panel funciona igual pero solo con `localStorage`, y ahí pierde
la mitad de la gracia: como el click ocurre en el teléfono del invitado, ese evento nunca
llega a tu navegador. Verías todo en cero y el auto-confirmado no se activaría nunca.

Para activarlo:

```bash
vercel link
vercel integration add upstash    # crea la base y conecta las variables
vercel env pull .env.local --yes  # solo si querés correr vercel dev en local
```

También se puede desde el dashboard: Storage → **Upstash Redis** → conectar al proyecto.
En cualquiera de los dos casos hace falta un **redeploy** después.

> **Ojo:** `@vercel/kv` está discontinuado. La base ahora se provisiona por el Marketplace
> y el cliente es `@upstash/redis`. `api/_kv.js` acepta tanto `UPSTASH_REDIS_REST_URL`/
> `UPSTASH_REDIS_REST_TOKEN` como los viejos `KV_REST_API_*`.

Podés cambiar las credenciales del panel con las variables de entorno `ADMIN_USER` y
`ADMIN_PASS` (el login del cliente en `admin.js` sigue pidiendo adriano/adriano, así que
si las cambiás, actualizá también esa comprobación).

---

## Deploy a Vercel

```bash
npx vercel        # preview
npx vercel --prod # producción
```

O conectá el repo desde el dashboard. No hay build step: es HTML/CSS/JS plano más las
funciones de `/api`.

`vercel.json` manda todo lo que no sea un archivo real ni `/api/*` a `index.html`, que es
lo que hace funcionar las rutas tipo `/a7f3k2`.

`outputDirectory: "."` no es decorativo: si falta, Vercel toma `public/` como raíz del sitio
(es su default cuando esa carpeta existe y no hay framework) y el `index.html` de la raíz
nunca se sirve — todo el sitio responde 404 menos las funciones de `/api`.

Después de deployar, actualizá `og:url` en `index.html` con tu dominio final para que la
previsualización de WhatsApp apunte bien.

---

## Estructura

```
index.html              invitación
admin.html / admin.js   panel
script.js               CONFIG, intro, destello GSAP, scroll reveal, countdown, tracking
style.css / admin.css
api/track.js            POST — registra eventos de la invitación
api/events.js           GET/DELETE — tracking automático (Basic Auth)
api/guests.js           GET/POST/PUT/DELETE — lista maestra y estado (Basic Auth)
api/_kv.js              cliente Redis + auth compartidos
scripts/build-assets.sh generación de video/imágenes con ffmpeg
scripts/generate-links.mjs
public/                 video, poster, og:image, favicon
```
