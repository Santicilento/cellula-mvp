import { Check, Folder, FolderOpen, Info, Lock, RotateCw, ShieldCheck, Upload, UserPlus, ExternalLink, Zap, Clock } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { HttpError } from '../api/client'
import { useApp, useCancelPublish, usePublish, usePublishVersion, useTrial } from '../api/queries'
import { PageHeader } from '../components/layout/PageHeader'
import { Banner } from '../components/ui/Banner'
import { Button, ButtonAnchor, ButtonLink } from '../components/ui/Button'
import { CopyButton } from '../components/ui/CopyButton'
import { ErrorState } from '../components/ui/ErrorState'
import { Field } from '../components/ui/Field'
import { Skeleton } from '../components/ui/Skeleton'
import { fileSize, slugify } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'

interface Picked {
  name: string
  size: number
}

/** Un tamaño verosímil para una carpeta soltada (el navegador no deja leer su peso sin recorrerla). */
function guessFolderSize(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 900_000 + (h % 2_400_000)
}

function suggestName(fileName: string): string {
  const base = fileName.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ''
}

const BEFORE = [
  { icon: Lock, title: 'Tu app queda privada', text: 'Solo entran las personas que invites.' },
  { icon: ShieldCheck, title: 'Entran con Google o Microsoft', text: 'Nadie tiene que registrarse.' },
  { icon: Zap, title: 'Quitás accesos cuando quieras', text: 'El cambio es inmediato, sin tocar tu app.' },
]

/** Publicar una app, paso 1: elegir la carpeta y ponerle nombre. También sirve para publicar una versión nueva (?app=slug). */
export function PublicarForm() {
  const [params] = useSearchParams()
  const existingSlug = params.get('app') ?? undefined
  const existing = useApp(existingSlug)
  const trial = useTrial()
  const publish = usePublish()
  const publishVersion = usePublishVersion(existingSlug ?? '')
  const navigate = useNavigate()

  const isNewVersion = Boolean(existingSlug)
  usePageTitle(isNewVersion ? 'Publicar una nueva versión' : 'Publicar una app')

  const [picked, setPicked] = useState<Picked | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const folderInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)

  const effectiveName = isNewVersion ? existing.data?.name ?? '' : name
  const slug = slugify(effectiveName)
  const locked = trial.data?.status === 'locked'
  const busy = publish.isPending || publishVersion.isPending
  const canPublish = Boolean(picked) && effectiveName.trim().length >= 2 && !locked && !busy

  function choose(next: Picked) {
    setPicked(next)
    if (!isNewVersion && !name.trim()) setName(suggestName(next.name))
  }

  function onFolder(files: FileList | null) {
    if (!files || files.length === 0) return
    const first = files[0] as File & { webkitRelativePath?: string }
    const folder = first.webkitRelativePath?.split('/')[0] || first.name
    const size = Array.from(files).reduce((sum, f) => sum + f.size, 0)
    choose({ name: folder, size: size || guessFolderSize(folder) })
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const item = e.dataTransfer.items?.[0]
    const entry = item?.webkitGetAsEntry?.()
    if (entry?.isDirectory) return choose({ name: entry.name, size: guessFolderSize(entry.name) })
    const file = e.dataTransfer.files?.[0]
    if (file) choose({ name: file.name, size: file.size || guessFolderSize(file.name) })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!picked || !canPublish) return
    const input = { name: effectiveName.trim(), fileName: picked.name, fileSize: picked.size }
    const onError = (err: unknown) => {
      if (err instanceof HttpError && err.field === 'name') setNameError(err.message)
      else setNameError(err instanceof HttpError ? err.message : 'No pudimos publicar. Probá de nuevo.')
    }
    if (isNewVersion && existingSlug) {
      publishVersion.mutate(input, { onSuccess: (app) => navigate(`/apps/publicar/${app.slug}`), onError })
    } else {
      publish.mutate(input, { onSuccess: (app) => navigate(`/apps/publicar/${app.slug}`), onError })
    }
  }

  if (isNewVersion && existing.isError) {
    return (
      <div className="page">
        <PageHeader title="Publicar una nueva versión" back={{ to: '/apps', label: 'Mis apps' }} />
        <ErrorState message="No encontramos la app que querés actualizar." />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/apps', label: 'Mis apps' }}
        title={isNewVersion ? 'Publicar una nueva versión' : 'Publicar una app'}
        subtitle={
          isNewVersion
            ? `Subí la carpeta con los cambios de ${existing.data?.name ?? 'tu app'} y la actualizamos.`
            : 'Subí la carpeta que te dejó tu agente de IA y la ponemos online.'
        }
      />

      {locked && (
        <Banner
          tone="warn"
          icon={Clock}
          actions={<ButtonLink to="/apps">Ir a Mis apps</ButtonLink>}
        >
          <strong>Primero desbloqueá tu prueba gratis.</strong> Para publicar, invitá a 3 personas que ingresen con Google o Microsoft.
        </Banner>
      )}

      <div className="publish-layout">
        <form className="publish-main" onSubmit={submit} noValidate>
          <div
            className={`dropzone${dragging ? ' dropzone--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="cl-ico cl-ico--lg"><Upload className="cl-i" aria-hidden="true" /></span>
            {picked ? (
              <>
                <div className="dropzone__text">
                  <span className="dropzone__title">Listo, esta es tu carpeta</span>
                  <span className="dropzone__chip"><Folder className="cl-i" aria-hidden="true" />{picked.name} · {fileSize(picked.size)}</span>
                </div>
                <div className="dropzone__actions">
                  <Button onClick={() => folderInput.current?.click()}>Elegir otra carpeta</Button>
                  <Button onClick={() => zipInput.current?.click()}>Elegir otro .zip</Button>
                </div>
              </>
            ) : (
              <>
                <div className="dropzone__text">
                  <span className="dropzone__title">Arrastrá acá la carpeta de tu app</span>
                  <span className="dropzone__sub">o un archivo .zip</span>
                </div>
                <div className="dropzone__actions">
                  <Button variant="primary" icon={<FolderOpen className="cl-i" aria-hidden="true" />} onClick={() => folderInput.current?.click()}>Elegir carpeta</Button>
                  <Button onClick={() => zipInput.current?.click()}>Elegir archivo .zip</Button>
                </div>
              </>
            )}
            <input
              ref={folderInput}
              type="file"
              hidden
              onChange={(e) => { onFolder(e.target.files); e.target.value = '' }}
              {...({ webkitdirectory: '', directory: '' } as object)}
            />
            <input
              ref={zipInput}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) choose({ name: f.name, size: f.size })
                e.target.value = ''
              }}
            />
          </div>

          <div className="cl-card name-card">
            <Field
              wrapperClassName="name-card__field"
              label="Nombre de tu app"
              placeholder="Por ejemplo: Agenda de clases"
              value={effectiveName}
              readOnly={isNewVersion}
              onChange={(e) => { setName(e.target.value); setNameError(null) }}
              error={nameError}
              help={
                <span className="inline-help">
                  <Lock className="cl-i" aria-hidden="true" style={{ color: 'var(--brand)', width: 15, height: 15 }} />
                  Tu link va a ser: {slug || 'nombre-de-tu-app'}.cellula.app
                </span>
              }
            />
            <Button type="submit" variant="primary" size="lg" disabled={!canPublish} className="name-card__submit">
              {busy ? 'Publicando…' : 'Publicar'}
            </Button>
          </div>
        </form>

        <aside className="publish-aside" aria-label="Ayuda">
          <section className="cl-card">
            <h2 className="side-title">Antes de empezar</h2>
            <div className="before-list">
              {BEFORE.map(({ icon: Icon, title, text }) => (
                <div key={title} className="before-list__item">
                  <span className="cl-ico cl-ico--sm"><Icon className="cl-i" aria-hidden="true" /></span>
                  <span><b>{title}</b><br /><span className="muted">{text}</span></span>
                </div>
              ))}
            </div>
          </section>
          <section className="callout">
            <h2>¿Preferís que lo haga tu agente?</h2>
            <p>Conectalo y pedile: «Publicá esta app en Cellula». Sin subir nada a mano.</p>
            <Link to="/agente">Conectar mi agente</Link>
          </section>
        </aside>
      </div>
    </div>
  )
}

type StepState = 'done' | 'now' | 'todo'

function ProgressStep({ n, state, title, text, last, children }: { n: number; state: StepState; title: string; text: string; last?: boolean; children?: React.ReactNode }) {
  return (
    <li className="pstep">
      <div className="pstep__rail">
        <span className={`pstep__dot pstep__dot--${state}`}>
          {state === 'done' ? <Check className="cl-i" aria-hidden="true" /> : state === 'now' ? <RotateCw className="cl-i cl-spin" aria-hidden="true" /> : n}
        </span>
        {!last && <span className={`pstep__line${state === 'done' ? ' pstep__line--done' : ''}`} />}
      </div>
      <div className="pstep__body">
        <span className={`pstep__title${state === 'todo' ? ' pstep__title--todo' : ''}`}>{title}</span>
        <span className="pstep__text">{text}</span>
        {children}
      </div>
    </li>
  )
}

/** Publicar una app, pasos 2 y 3: progreso y "¡Tu app está online!". */
export function PublicarProgreso() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const app = useApp(slug, { fast: true })
  const cancel = useCancelPublish()
  usePageTitle(app.data?.status === 'active' ? 'Tu app está online' : 'Publicando tu app')

  if (app.isError) {
    return (
      <div className="page">
        <PageHeader back={{ to: '/apps', label: 'Mis apps' }} title="Publicar una app" />
        <ErrorState message="No encontramos esa publicación. Puede que ya la hayas cancelado." />
      </div>
    )
  }
  if (!app.data) {
    return (
      <div className="page">
        <PageHeader back={{ to: '/apps', label: 'Mis apps' }} title="Publicar una app" />
        <Skeleton style={{ height: 420, maxWidth: 720, alignSelf: 'center', width: '100%' }} />
      </div>
    )
  }

  const a = app.data
  const stage = a.publish?.stage ?? 3
  const percent = a.publish?.percent ?? 100

  if (a.status === 'active') {
    return (
      <div className="page">
        <PageHeader back={{ to: '/apps', label: 'Mis apps' }} title="Publicar una app" />
        <section className="cl-card success">
          <div className="success__head">
            <span className="success__check"><Check className="cl-i" aria-hidden="true" /></span>
            <h2>¡Tu app está online!</h2>
            <p>{a.name} ya tiene su link. Copialo y probala.</p>
          </div>
          <div className="linkbox">
            <span className="linkbox__url">{a.url}</span>
            <CopyButton text={`https://${a.url}`} label="Copiar link" copiedLabel="¡Link copiado!" size="lg" />
          </div>
          <div className="privacy-note">
            <span className="cl-ico cl-ico--solid"><Lock className="cl-i" aria-hidden="true" /></span>
            <span>
              <b>Tu app es privada: solo entran las personas que invites.</b>
              <br />Quien reciba el link sin invitación no va a poder ver nada.
            </span>
          </div>
          <div className="success__actions">
            <ButtonLink to={`/apps/${a.slug}/accesos`} variant="primary" size="lg" icon={<UserPlus className="cl-i" aria-hidden="true" />}>Invitar personas</ButtonLink>
            <ButtonAnchor href={`${import.meta.env.BASE_URL}#/i/${a.slug}`} target="_blank" rel="noopener" size="lg" icon={<ExternalLink className="cl-i" aria-hidden="true" />}>Abrir mi app</ButtonAnchor>
            <ButtonLink to="/apps" variant="ghost" size="lg">Volver a Mis apps</ButtonLink>
          </div>
        </section>
      </div>
    )
  }

  if (a.status === 'error') {
    return (
      <div className="page">
        <PageHeader back={{ to: '/apps', label: 'Mis apps' }} title="Publicar una app" />
        <ErrorState message={`No pudimos publicar ${a.name}.`} onRetry={() => navigate(`/apps/publicar?app=${a.slug}`)} />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader back={{ to: '/apps', label: 'Mis apps' }} title="Publicar una app" />
      <section className="cl-card cl-card--live progress" aria-live="polite">
        <div className="progress__head">
          <h2>Estamos publicando {a.name}</h2>
          {a.fileName && (
            <span className="dropzone__chip"><Folder className="cl-i" aria-hidden="true" />{a.fileName}{a.fileSize ? ` · ${fileSize(a.fileSize)}` : ''}</span>
          )}
        </div>
        <ol className="pstep-list">
          <ProgressStep
            n={1}
            state={stage === 1 ? 'now' : 'done'}
            title="Preparando"
            text={stage === 1 ? 'Revisamos que tu carpeta esté completa.' : 'Revisamos que tu carpeta esté completa. Listo.'}
          />
          <ProgressStep
            n={2}
            state={stage === 1 ? 'todo' : stage === 2 ? 'now' : 'done'}
            title="Publicando"
            text="Ponemos tu app online. Puede tardar un minuto."
          >
            {stage === 2 && (
              <div className="pbar">
                <div className="cl-meter" role="progressbar" aria-label="Avance de la publicación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <span style={{ width: `${percent}%` }} />
                </div>
                <span className="pbar__pct">{percent}%</span>
              </div>
            )}
          </ProgressStep>
          <ProgressStep
            n={3}
            state={stage === 3 ? 'now' : 'todo'}
            title="Activando el acceso privado"
            text="Después de publicar, cerramos la puerta: solo entran los invitados."
            last
          />
        </ol>
        <div className="progress__foot">
          <span><Info className="cl-i" aria-hidden="true" style={{ width: 16, height: 16, verticalAlign: '-3px', marginRight: 6 }} />Podés salir de esta pantalla: seguimos publicando y te avisamos cuando esté lista.</span>
          <Button
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(a.slug, { onSuccess: () => navigate('/apps/publicar') })}
          >
            Cancelar
          </Button>
        </div>
      </section>
    </div>
  )
}
