# Cellula · prototipo del MVP

Prototipo **solo front-end** del MVP de Cellula (TPO de Tecnología e Innovación, Grupo 5, UADE): una plataforma para publicar y compartir, de forma privada, las apps que arma un agente de IA (Claude Code, Cursor). Tiene un **backend fake** (Mock Service Worker) y **datos de ejemplo**, así que se puede recorrer completo sin servidor.

Son **dos páginas en el mismo origen**, que comparten el backend fake:

| Página | Dirección (con `npm run dev`) | Qué es |
|---|---|---|
| Cellula | http://localhost:5173/ | El panel del MVP. |
| Clon de Claude | http://localhost:5173/claude/ | Una recreación de claude.ai con el conector MCP de Cellula, para mostrar el flujo del agente. |

Se armó a partir de:

- el documento del TPO (`TPO-TEI-GRUPO-5-CELLULA.pdf`, sección 8 «MVP»),
- el diseño del MVP (15 pantallas en el artifact «Cellula MVP»),
- el design system «Cellula» (tokens, componentes y marca).

## Cómo correrlo

Necesita Node 20.19 o más nuevo (o 22.12+).

```bash
npm install
npm run dev        # http://localhost:5173
```

Otros comandos:

```bash
npm run build      # compila a dist/
npm run preview    # sirve dist/ para probar el build
npm run typecheck  # TypeScript
npm run lint       # oxlint
npm test           # Vitest: reglas del backend, conector MCP, intenciones y flujos del clon
```

Para publicarlo en una subcarpeta (por ejemplo GitHub Pages) compilá con la base del repo:

```bash
VITE_BASE=/cellula-mvp/ npm run build
```

La app usa rutas con `#` (`/#/apps`), así que funciona en cualquier hosting estático sin configurar redirecciones.

## Qué se puede probar

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Mis apps / Mis apps vacía | `/#/apps` | Grilla con los estados Activa, Publicando y Con error; estado de usuario nuevo con la prueba bloqueada. |
| Publicar una app | `/#/apps/publicar` | Elegí una carpeta o un `.zip` (o arrastralo), poné el nombre y mirá el link. |
| Publicando → ¡Tu app está online! | `/#/apps/publicar/:app` | Progreso en tres pasos con porcentaje; se puede cancelar o salir (te avisa al terminar). |
| Accesos | `/#/apps/:app/accesos` | Invitar por email con rol Ver / Usar / Administrar y vencimiento; quitar acceso con confirmación. |
| Actividad (global y por app) | `/#/actividad`, `/#/apps/:app/actividad` | Filtros por origen, app, tipo y fecha; movimientos agrupados por día. |
| Datos | `/#/apps/:app/datos` | Tablas de cada app, paginadas. |
| Configuración | `/#/apps/:app/config` | Renombrar, publicar una versión nueva, eliminar la app. |
| Conectar mi agente | `/#/agente` | Pasos para Claude Code y Cursor, frases para copiar, probar la conexión, desconectar. |
| Uso y plan | `/#/plan` | Estado de la prueba gratis, cifras de uso y barras por app. |
| Cómo funciona el conector | `/#/como-funciona` | Recorrido de ocho pasos (Figura 7 del TPO). |
| Lo que ve el invitado | `/#/i/:app` | «Esta app es privada», ingreso con Google o Microsoft, «No tenés acceso». |

### Modo demo

El botón flotante **Modo demo** (abajo a la derecha) no es parte del producto: sirve para llegar a estados que en la vida real dependen del tiempo o de otras personas.

- **Escenario**: «Con apps» (prueba en curso, cuatro apps) o «Usuario nuevo» (sin apps, prueba bloqueada).
- **Que ingresen los invitados**: adelanta el ingreso de las personas invitadas para desbloquear la prueba.
- **Ver como invitado**: abre el link de una app como lo vería quien lo recibe.
- **Restablecer datos**: vuelve a los datos de ejemplo.

### Recorridos para mostrar

1. **Hard paywall**: Modo demo → *Usuario nuevo* → *Invitar personas* → escribí tres emails. A los pocos segundos ingresan de a uno y se desbloquean los 14 días; después ya se puede publicar.
2. **Publicar**: *Publicar una app* → elegí cualquier `.zip` o carpeta → *Publicar*.
3. **Revocación inmediata**: abrí una app con *Abrir app*, entrá con «Carolina Suárez» (Usar). En otra pestaña, quitale el acceso en *Accesos*: en 2 segundos la pantalla del invitado pasa a «No tenés acceso».
4. **Login en la plataforma, no en la app**: en esa misma pantalla se ve lo que Cellula le informa a la app (`X-Cellula-User`, `X-Cellula-Role`).

El «inicio de sesión» del invitado es una simulación: el selector de cuentas lista a las personas de ejemplo y deja escribir cualquier email. Entra solo quien está invitado a esa app.

## Clon de Claude (demo)

Está en **`/claude/`** (con la barra final) y es la otra mitad de la historia del TPO: el agente. Sirve para mostrar, en vivo y de forma libre, cómo una persona arma una app con Claude, la publica en Cellula y la comparte, sin salir del chat.

**Qué es real y qué es guion**

- **Es real**: la interfaz (chat, barra lateral, artefactos, menú de herramientas y de modelo, Configuración → Conectores) y el **conector MCP**. Claude le habla a `https://mcp.cellula.app/mcp` con JSON-RPC 2.0 y un token Bearer: sondea (401), manda a autorizar en una pantalla de Cellula (`/#/autorizar`), canjea el código, hace `initialize` y `tools/list`, y llama a las herramientas. Lo que hace queda de verdad en Cellula.
- **Es guion**: las respuestas. No hay un modelo de lenguaje: se reconocen frases clave y todo lo demás recibe una respuesta fija con sugerencias. El mismo pedido da siempre la misma respuesta.

**Recorrido**

1. Abrí `/claude/`. Viene con el prompt «Armame una app para que mis alumnas reserven clases de yoga y yo vea quién se anotó» ya escrito: apretá Enter (o escribí encima otro pedido).
2. Claude «arma» **Agenda de clases**: un artefacto interactivo a la derecha (se puede reservar y ver la vista de la instructora; la pestaña Código muestra el código real) y sugiere publicarla con **Cellula**.
3. **Configuración → Conectores → Agregar conector personalizado**: nombre «Cellula» y la dirección `https://mcp.cellula.app/mcp` (hay un atajo «Usar la dirección de Cellula»). Tocá **Conectar**.
4. Se abre la pantalla de **Cellula** «Claude quiere conectarse a tu cuenta»: **Permitir**. Claude queda **Conectado** con 7 herramientas, cada una con su permiso (las de solo lectura se permiten; las que modifican preguntan).
5. «**Publicá esta app en Cellula**»: Claude mira tus apps, pide permiso para publicar, y muestra el avance en vivo hasta devolver el link privado.
6. En Cellula (`/`): la app figura como «Publicada por tu agente», en Actividad como «Tu agente · Claude» y en Conectar mi agente, pestaña Claude, como conectado.
7. **Revocación inmediata**: en Cellula → Conectar mi agente, desconectá a Claude. En el clon, el conector pasa a «Requiere autenticación» y Claude pide reconectar.

**Frases que entiende** (sin importar mayúsculas ni acentos)

| Pedido | Ejemplos | Qué hace |
|---|---|---|
| Armar una app | «Armame una app…», «Haceme una página…», «Quiero una app para…» | Crea el artefacto y sugiere Cellula (o el conector, si falta). |
| Publicar | «Publicá esta app en Cellula», «Publicala», «Publicá Control de stock» | `list_apps` → permiso → `publish_app` → `get_publish_status`. Si ya existe, ofrece una versión nueva. |
| Dar acceso | «Dale acceso de Ver a ana@ejemplo.com», «Compartí Agenda de clases con ana@ejemplo.com», «Invitá a rocio@gmail.com como administrar» | `grant_access`. Sin rol dicho usa Ver; sin app, ofrece las apps para elegir. |
| Quitar acceso | «Quitale el acceso a Pablo Herrera en Control de stock» | `revoke_access`, con permiso y aviso de que es inmediato. |
| Mostrar apps | «Mostrame mis apps en Cellula», «¿Qué apps tengo?» | `list_apps` y una tabla. |
| Actividad | «¿Quién entró a Turnos del consultorio esta semana?» | `get_activity`. |
| Estado | «¿Cómo va la publicación?» | `get_publish_status`. |
| Ayuda | «¿Cómo conecto Cellula?», «¿Qué es el MCP?» | Los pasos, con botón para abrir Conectores. |
| Sí / No | «Sí», «Dale», «No, mejor no» | Confirma o descarta lo que Claude propuso. |

Si algo falla se explica como lo haría Claude: sin conector, con la conexión vencida, con la prueba bloqueada («Usuario nuevo» en el Modo demo) o con una persona que no existe.

**Para volver a empezar**: la pastilla **Demo** de la barra lateral → *Restablecer esta demo* (borra chats, conectores y la agenda; no toca Cellula). Para empezar también Cellula de cero: *Modo demo → Restablecer datos*.

**Notas técnicas**

- El host `mcp.cellula.app` se reescribe a esta misma app (`/api/_mcp/…`), así no hay problemas de CORS; cualquier otro servidor MCP no se alcanza («No pudimos conectar con…»).
- El login usa una **ventana emergente** y, si el navegador la bloquea (o la abre en la misma pestaña, como algunos navegadores embebidos), una **redirección** de ida y vuelta. Los dos caminos terminan igual.
- El clon guarda su estado en `localStorage` (`claude-demo:v1`), separado del de Cellula (`cellula-mvp:db:v2`). Abrí `/claude/` con la barra final: sin ella el servidor redirige solo.
- Es una recreación de estilo para la demo, con la marca «Demo»: no usa logos ni archivos de Anthropic (el destello es un SVG propio).

## Backend fake

Los componentes no usan datos escritos a mano: todo pasa por `fetch('/api/...')`, y [MSW](https://mswjs.io) contesta desde el navegador (service worker). Para pasar a un backend real alcanza con dejar de iniciar el worker en `src/main.tsx`; el contrato está en `src/api/types.ts`.

- **Persistencia**: la base vive en `localStorage` (`cellula-mvp:db:v1`), así sobrevive a un F5 y se comparte entre pestañas. Para empezar de cero: *Modo demo → Restablecer datos*, o borrá el `localStorage`.
- **Tiempo simulado**: las publicaciones tardan unos 8 segundos y los invitados de la prueba «ingresan» cada 6 segundos. Los avisos («¡Tu app está online!», «Ingresaron 2 de 3») llegan como si hubiera un websocket: el front pregunta por novedades cada 3 segundos.
- **Reglas del MVP aplicadas por el backend**: sin prueba desbloqueada no se puede publicar (`402`); no se repiten nombres de app (`409`); no se puede invitar dos veces al mismo email (`409`); un acceso vencido o quitado se rechaza en el siguiente pedido. Las reglas viven en `src/mocks/service.ts` y las usan tanto el panel (REST) como el conector (MCP).
- **Datos de ejemplo**: la app «Turnos del consultorio», Lucía Benítez y las demás personas salen del documento del TPO. Las fechas se calculan a partir de hoy (siempre «Te quedan 9 días de 14», «Vence en 8 días»).

| Endpoint | Para qué |
|---|---|
| `GET /api/me`, `GET /api/trial`, `POST /api/trial/invites` | Persona logueada y prueba gratis |
| `GET/POST /api/apps`, `GET/PATCH/DELETE /api/apps/:slug` | Apps |
| `POST /api/apps/:slug/versions`, `POST /api/apps/:slug/cancel-publish` | Versiones nuevas y cancelar publicación |
| `GET/POST /api/apps/:slug/access`, `DELETE /api/apps/:slug/access/:id` | Accesos |
| `GET /api/activity` | Actividad (filtros por query string) |
| `GET /api/apps/:slug/data`, `GET /api/apps/:slug/data/:tabla` | Datos de cada app |
| `GET /api/agent`, `POST /api/agent/:tool/test`, `DELETE /api/agent/connections/:id` | Conector del agente |
| `GET /api/usage` | Uso y plan |
| `GET /api/notifications`, `POST /api/notifications/ack` | Avisos |
| `GET /api/gate/:slug`, `POST /api/gate/:slug/login`, `GET /api/gate/:slug/session` | Puerta de la app (invitados) |
| `POST /api/oauth/authorize` | Pantalla «Autorizar»: emite el código del conector |
| `POST /api/_mcp/mcp` | Servidor MCP de Cellula (JSON-RPC): `initialize`, `tools/list`, `tools/call` |
| `POST /api/_mcp/oauth/token`, `/oauth/revoke` | Canje del código por un token, y cierre de la conexión |
| `/api/demo/*` | Solo del modo demo |

## Librerías

| Para qué | Qué se usó |
|---|---|
| Base | React 19, TypeScript, Vite |
| Rutas | React Router (con `#`) |
| Datos y caché | TanStack Query |
| Backend fake | Mock Service Worker |
| Diálogos, tabs, radios, filtros, popover, menús, switch | Radix UI (sin estilos propios; los estilos son del design system o del clon) |
| Estado del clon de Claude | Zustand (con persistencia) |
| Respuestas con formato | react-markdown + remark-gfm |
| Pruebas | Vitest |
| Íconos | Lucide (el design system pide íconos de línea estilo Lucide) |
| Avisos | Sonner |
| Fuentes | Plus Jakarta Sans y JetBrains Mono (Cellula); Inter y Source Serif 4 (clon). Con Fontsource: no hace falta internet |

## Design system

- `src/styles/tokens.css`: tokens del design system (color, tipografía, espaciado, radios, sombras, bordes), generados de `tokens.json`.
- `src/styles/components.css`: el `bundle.css` del design system (`cl-btn`, `cl-badge`, `cl-card`, `cl-table`, `cl-dialog`…) más las piezas que el MVP usa y el sistema todavía no trae (control segmentado, selector, botón de ícono, barra de uso). Esas están marcadas con «MVP:».
- `src/components/ui/`: los componentes de React sobre esas clases (`Button`, `Badge`, `Banner`, `Field`, `RoleGroup`, `ConfirmDialog`, `CodeBlock`…).
- `public/brand/`: logo e isotipo (ver la nota de abajo).

## Qué cambió respecto del diseño del MVP

Para que quede explícito, estas son las diferencias con el artifact del MVP:

**Agregado (no estaba dibujado)**

1. **Modo demo**: el botón flotante descripto arriba.
2. **Diálogo «Desbloqueá tu prueba gratis»**: el TPO define la regla (invitar a 3 personas que ingresen) pero el MVP no dibuja el paso. Sin él, el estado «usuario nuevo» no tenía salida.
3. **Ingreso simulado del invitado** y una **pantalla de relleno de «la app adentro»**, para cerrar el circuito: se ve que el login lo resuelve Cellula y la revocación inmediata.
4. **Avisos (toasts)** al invitar, quitar, guardar, copiar y cuando una publicación termina.
5. **Confirmaciones** al *Desconectar* un agente y al *Eliminar esta app*, siguiendo la regla del design system de explicar el efecto antes de confirmar.
6. **Versión móvil**: el diseño es de escritorio (1440 px); acá las pantallas se adaptan a tablet y celular.
7. **Pantalla «Autorizar»** (`/#/autorizar`): «Claude quiere conectarse a tu cuenta de Cellula», con lo que va a poder hacer y los botones Cancelar / Permitir. Es la parte de Cellula del login del conector.
8. **Pestaña «Claude»** en Conectar mi agente (al lado de Claude Code y Cursor), con los pasos para agregar el conector en Claude, y «Claude» en la lista de agentes conectados.
9. En el **Modo demo**, un atajo «Abrir Claude (demo)».

**Ajustado**

10. **Cómo funciona el conector** (el diagrama de 1920 px) se rearmó con carriles por actor y sin flechas, para que sea responsive; en pantallas angostas son los mismos ocho pasos en lista.
11. Se usan los **valores del design system** y no los sueltos del MVP: radio de tarjetas 12 px (el MVP usa 14), botones de 44 px, campos con borde de 1,5 px. Es una diferencia de uno o dos píxeles.
12. «Guardar» y «Descartar cambios» en Configuración están deshabilitados hasta que haya algo para guardar.
13. «Si más adelante querés, podés volver a invitar a Ana» en lugar de «invitarla», para no suponer el género de la persona.
14. La paginación de Datos dice «Mostrando 1–6 de 248» en vez de «Mostrando 6 de 248».
15. El vencimiento de un acceso tiene máscara `dd/mm/aaaa` y se valida (tiene que ser posterior a hoy).

**Logo**: el design system guarda el logo como imágenes que no se pudieron descargar, así que `public/brand/*.svg` se **reconstruyó como vector a partir de la carátula del PDF** (es el mismo dibujo, en `#39814A`). Si tenés los originales (`marca/*.svg` del proyecto de LaTeX), reemplazá esos archivos con los mismos nombres.

## Estructura

```
src/
  api/          contrato (types.ts), cliente fetch y hooks de datos
  mocks/        backend fake: handlers REST, reglas de negocio (service.ts), conector MCP (mcp.ts), base en localStorage, datos de ejemplo
  claude/       clon de Claude: brain/ (intenciones y guion), mcp/ (cliente MCP + OAuth), store/, components/, pages/, artifacts/
  components/   ui/ (design system en React), layout/ y piezas de pantalla
  pages/        una carpeta o archivo por pantalla (app/ = detalle de una app, guest/ = invitado)
  lib/          formato de fechas y números en es-AR, portapapeles, roles
  styles/       tokens.css, components.css, app.css
claude/         index.html de la segunda página (/claude/)
public/
  brand/        logo e isotipo
  mockServiceWorker.js   service worker de MSW (generado con `npx msw init`)
```

## Fuera de alcance

Es un prototipo para validar el flujo: no hay autenticación real, base de datos ni cobro, y el conector MCP vive en el navegador (no hay un servidor MCP real). Todo lo que no está en el MVP del TPO (vencimientos automáticos, registro de quién accedió con detalle, copias de seguridad) tampoco está acá.
