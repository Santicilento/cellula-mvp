// Los textos de Claude en cada caso del guion. Español rioplatense, directo y sin jerga.
// Las respuestas son markdown: se muestran con el mismo formato que en claude.ai.

import type { Role } from '../../api/types'
import { ROLE_LABEL } from '../../lib/roles'
import { MCP_URL } from '../../lib/agents'

export interface Links {
  /** Lo que ve quien recibe el link de la app (pantalla "Esta app es privada"). */
  gate(slug: string): string
  /** Pestaña Accesos de la app, en Cellula. */
  accesos(slug: string): string
  /** Mis apps, en Cellula. */
  panel: string
  /** Conectar mi agente, en Cellula. */
  agente: string
}

export const buildIntro = () =>
  '¡Dale! Armé **Agenda de clases**, una app para que tus alumnas reserven su lugar en cada clase de yoga y vos veas quiénes se anotaron.'

export const buildFeatures = () =>
  `Lo que tiene:

- **Grilla semanal** con cada clase, su horario y los lugares que quedan.
- **Reservar y cancelar** con un toque, desde el lado de la alumna.
- **Vista de instructora** con la lista de anotadas por clase.

Probala en el panel de la derecha. Cuando quieras, le cambiamos horarios, nombres o colores.`

export const offerPublish = () =>
  'Para que tus alumnas la usen, falta ponerla online. Si querés, la publico ahora en **Cellula**: queda en un link privado y solo entran las personas que vos invites. ¿La publico?'

export const suggestCellula = () =>
  `Para que tus alumnas la usen, falta ponerla online. Te sugiero usar **Cellula**: la deja en un link privado, entran solo las personas que vos invites (con su cuenta de Google o Microsoft) y yo puedo publicarla y dar los accesos por vos a través de su conector MCP.

Para activarlo, agregá el conector en **Configuración → Conectores** con esta dirección:

\`\`\`
${MCP_URL}
\`\`\`

Cuando esté conectado, decime «Publicá esta app en Cellula» y me encargo del resto.`

export const connectHelp = () =>
  `**Cellula** es una plataforma para publicar y compartir, de forma privada, las apps que armo con vos. Se conecta a mí mediante un conector MCP, y así puedo publicar, dar acceso y quitarlo sin que salgas de esta charla.

Para conectarla:

1. Abrí **Configuración → Conectores**.
2. Elegí **Agregar conector personalizado** y pegá esta dirección:

\`\`\`
${MCP_URL}
\`\`\`

3. Tocá **Conectar**: se abre Cellula para que me autorices. Apretá **Permitir**.
4. Probá con «Mostrame mis apps en Cellula».`

export const alreadyConnected = () =>
  `Ya tenés **Cellula** conectada. Puedo:

- **Publicar** una app: «Publicá esta app en Cellula».
- **Dar acceso**: «Dale acceso de Ver a ana@ejemplo.com».
- **Quitar acceso**: «Quitale el acceso a Pablo Herrera en Control de stock».
- **Contarte qué pasó**: «¿Quién entró a Turnos del consultorio esta semana?».`

export const needsConnector = (what: string) =>
  `Para ${what} necesito el conector de **Cellula**, y todavía no lo agregaste. Es rápido: abrí **Configuración → Conectores**, elegí **Agregar conector personalizado** y pegá esta dirección:

\`\`\`
${MCP_URL}
\`\`\`

Después tocá **Conectar** y permitime el acceso en Cellula. Cuando termines, volvé y seguimos.`

export const needsAuth = () =>
  'Perdí la conexión con **Cellula**: puede que la hayas desconectado desde Cellula o que haya vencido. Volvé a conectarla en **Configuración → Conectores** y retomamos justo donde estábamos.'

export const connectorDisabled = () =>
  'El conector de **Cellula** está apagado en esta charla. Prendelo desde el menú de herramientas (el botón al lado del cuadro de texto) o en **Configuración → Conectores**, y lo hago.'

export const denied = (action: string) => `Listo, no ${action}. Avisame si querés que lo intente de nuevo.`

export const publishStart = (appName: string, assumed: boolean) =>
  assumed
    ? `Dale, publico **${appName}** en Cellula. (No tengo otra app en esta charla, así que uso la de siempre.)`
    : `Dale, publico **${appName}** en Cellula. Primero miro qué tenés ahí para no duplicar nada.`

export const alreadyPublished = (name: string, url: string) =>
  `**${name}** ya está publicada en Cellula (\`${url}\`). ¿Querés que publique una versión nueva con los cambios? El link y los accesos se mantienen.`

export const alreadyPublishing = (name: string) =>
  `**${name}** ya se está publicando en este momento. Pedime «¿Cómo va la publicación?» y te cuento el avance.`

export const publishVersionStart = (name: string) => `Perfecto, publico una versión nueva de **${name}**.`

export const published = (name: string, url: string, slug: string, mode: 'new' | 'version', links: Links) =>
  `¡Listo! ${mode === 'version' ? `Publiqué la versión nueva de **${name}**` : `**${name}** está online`} y es **privada**:

**[https://${url}](${links.gate(slug)})**

- Solo entran las personas que invites: quien reciba el link sin invitación no ve nada.
- Entran con su cuenta de Google o Microsoft, sin registrarse.
- Podés ver y administrar todo desde [Cellula](${links.accesos(slug)}).

¿Querés que invite a alguien? Decime el email y el rol: **Ver**, **Usar** o **Administrar**.`

export const publishStatus = (name: string, status: string, url: string, detail: string | null) =>
  status === 'active'
    ? `**${name}** ya está online: https://${url}`
    : status === 'publishing'
      ? `**${name}** se está publicando todavía${detail ? ` (${detail})` : ''}. En unos segundos debería estar lista.`
      : `**${name}** tuvo un problema al publicarse. Probá publicarla de nuevo desde Cellula o pedímelo.`

export const trialLocked = (links: Links) =>
  `Cellula me avisó que todavía no tenés la **prueba gratis** desbloqueada, y sin eso no se puede publicar. Se desbloquea invitando a **3 personas** que ingresen con su cuenta de Google o Microsoft.

Podés hacerlo desde [Mis apps en Cellula](${links.panel}) (botón «Invitar personas»). Cuando ingresen las tres, volvé y la publico enseguida.`

export const toolFailed = (message: string) => `No pude hacerlo: ${message}`

export const appNotFound = (message: string) =>
  `${message} Decime el nombre exacto, o pedime «Mostrame mis apps en Cellula» para ver cómo se llaman.`

export const askEmail = () =>
  '¿A qué email le doy acceso? Decime también el rol: **Ver** (puede ver, sin cambiar nada), **Usar** (puede ver y cargar datos) o **Administrar** (puede todo, e invitar o quitar personas).'

export const askPerson = () => '¿A quién le quito el acceso? Pasame el nombre o el email, y en qué app.'

export const askWhichApp = (verb: string) => `¿En qué app ${verb}? Elegí una:`

export const grantStart = (email: string, role: Role, explicit: boolean, appName: string) =>
  explicit
    ? `Dale, le doy acceso de **${ROLE_LABEL[role]}** a ${email} en **${appName}**.`
    : `Dale, le doy acceso a ${email} en **${appName}**. No me dijiste el rol, así que va con **Ver**, el más restrictivo; si querés otro, decímelo.`

export const granted = (name: string, email: string, role: Role, appName: string, slug: string, links: Links) =>
  `Listo: **${name}** (${email}) ya puede entrar a **${appName}** con rol **${ROLE_LABEL[role]}**. Entra con su cuenta de Google o Microsoft, sin registrarse.

Lo ves en [Accesos](${links.accesos(slug)}), y queda en Actividad como «Tu agente».`

export const revokeStart = (person: string, appName: string) =>
  `Dale, le quito el acceso a **${person}** en **${appName}**. Como esto cambia quién puede entrar, primero te pido permiso.`

export const revoked = (name: string, appName: string, slug: string, links: Links) =>
  `Listo: **${name}** ya no puede entrar a **${appName}**. El cambio es **inmediato**: si tenía la app abierta, se le cierra, y no hizo falta tocar la app ni volver a publicarla.

Si más adelante querés, podés volver a invitar a esa persona. Lo ves en [Accesos](${links.accesos(slug)}).`

export const listIntro = () => 'Dale, miro qué tenés en Cellula.'

export const listEmpty = () => 'Todavía no tenés apps en Cellula. Si querés, armamos una y la publico.'

export const activityIntro = (app: string | null, days: number, onlyEntries: boolean) =>
  `Dale, miro ${onlyEntries ? 'quién entró' : 'la actividad'}${app ? ` en **${app}**` : ''} ${days === 1 ? 'hoy' : days <= 7 ? 'en los últimos 7 días' : 'en los últimos 30 días'}.`

export const nothingToConfirm = () =>
  'Dale. Igual no tengo nada pendiente para confirmar. ¿Qué querés que haga? Puedo armar una app, publicarla en Cellula o compartirla con alguien.'

export const nothingPending = () => 'Dale, lo dejamos así. Avisame si querés que haga otra cosa.'

export const greeting = () =>
  '¡Hola, Lucía! ¿En qué te ayudo hoy? Puedo armarte una app, publicarla en **Cellula** y compartirla con quien quieras.'

export const fallback = (cellulaReady: boolean) =>
  cellulaReady
    ? 'Eso todavía no lo puedo resolver en esta demo, pero con **Cellula** ya conectada puedo armarte una app, publicarla, darle acceso a alguien o contarte quién entró. ¿Probamos con alguna?'
    : 'Esto es una demo, así que no interpreto cualquier pedido. Lo que sí hago es armarte una app y, si conectás **Cellula**, publicarla y compartirla de forma privada. ¿Probamos con alguna?'
