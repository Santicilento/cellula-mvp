import { Lock, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { HttpError } from '../../api/client'
import { useDeleteApp, useRenameApp } from '../../api/queries'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field } from '../../components/ui/Field'
import { ago, plural } from '../../lib/format'
import { useAppContext } from './useAppContext'

/** Configuración: nombre y dirección, quién puede entrar, publicar versión nueva y zona de eliminación. */
export default function Config() {
  const { app } = useAppContext()
  const rename = useRenameApp(app.slug)
  const del = useDeleteApp()
  const navigate = useNavigate()

  const [name, setName] = useState(app.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty = name.trim() !== app.name

  function save() {
    setNameError(null)
    rename.mutate(name.trim(), {
      onSuccess: () => toast.success('Guardamos los cambios'),
      onError: (err) => setNameError(err instanceof HttpError ? err.message : 'No pudimos guardar. Probá de nuevo.'),
    })
  }

  const people = app.peopleCount

  return (
    <>
      <section className="cl-card settings">
        <div className="settings__sec">
          <div className="settings__intro">
            <h2>Nombre y dirección</h2>
            <p>Así se ve tu app para quienes la usan.</p>
          </div>
          <div className="settings__body">
            <Field label="Nombre" value={name} onChange={(e) => { setName(e.target.value); setNameError(null) }} error={nameError} />
            <Field label="Dirección" value={app.url} readOnly help="Es el link que compartís con tus invitados." />
          </div>
        </div>

        <div className="settings__sec">
          <div className="settings__intro"><h2>Quién puede entrar</h2></div>
          <div className="settings__body">
            <div className="private-box">
              <span className="cl-ico cl-ico--solid"><Lock className="cl-i" aria-hidden="true" /></span>
              <span className="private-box__text">
                {people > 1 ? (
                  <><b>Privada.</b> Solo entran las {people} {plural(people, 'persona', 'personas')} que invitaste.</>
                ) : (
                  <><b>Privada.</b> Por ahora solo entrás vos. Invitá a quien quieras.</>
                )}
              </span>
              <Link to={`/apps/${app.slug}/accesos`}>Ver accesos</Link>
            </div>
          </div>
        </div>

        <div className="settings__sec">
          <div className="settings__intro">
            <h2>Publicación</h2>
            <p>
              {app.publishedAt
                ? `Última vez: ${ago(app.publishedAt)}, por ${app.lastPublishedBy === 'agent' ? 'tu agente' : 'vos'}.`
                : 'Todavía no se publicó.'}
            </p>
          </div>
          <div className="settings__body settings__body--row">
            <ButtonLink to={`/apps/publicar?app=${app.slug}`} icon={<Upload className="cl-i" aria-hidden="true" />}>
              Publicar una nueva versión
            </ButtonLink>
          </div>
        </div>

        <div className="settings__sec">
          <div className="settings__intro">
            <h2 className="danger-title">Eliminar app</h2>
            <p>Esta acción no se puede deshacer.</p>
          </div>
          <div className="settings__body settings__body--row">
            <p className="settings__warn">Se borran la app, sus datos y todos los accesos. El link deja de funcionar.</p>
            <Button variant="danger-outline" icon={<Trash2 className="cl-i" aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>
              Eliminar esta app
            </Button>
          </div>
        </div>
      </section>

      <div className="settings__actions">
        <Button disabled={!dirty || rename.isPending} onClick={() => { setName(app.name); setNameError(null) }}>Descartar cambios</Button>
        <Button variant="primary" disabled={!dirty || rename.isPending || name.trim().length < 2} onClick={save}>
          {rename.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        icon={Trash2}
        title={`¿Eliminar ${app.name}?`}
        description={<>Se borran la app, sus datos y los accesos de {people} {plural(people, 'persona', 'personas')}. El link <b>{app.url}</b> deja de funcionar ahora mismo.</>}
        note={<><b>Esto no se puede deshacer.</b> Si después la necesitás, vas a tener que publicarla de nuevo.</>}
        confirmLabel="Sí, eliminar app"
        busy={del.isPending}
        onConfirm={() =>
          del.mutate(app.slug, {
            onSuccess: () => {
              toast.success(`Eliminamos ${app.name}`)
              navigate('/apps', { replace: true })
            },
            onError: () => toast.error('No pudimos eliminar la app. Probá de nuevo.'),
          })
        }
      />
    </>
  )
}
