// Hooks de datos (TanStack Query) sobre la API REST. Los componentes no conocen fetch ni URLs.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  AccessEntry,
  ActivityEvent,
  ActivityFilters,
  AgentStatus,
  AgentTestResult,
  AgentTool,
  AppNotification,
  AppSummary,
  DataOverview,
  DataTablePage,
  DemoState,
  GateInfo,
  GateResult,
  InviteInput,
  Provider,
  PublishInput,
  Trial,
  Usage,
  User,
} from './types'

export const keys = {
  me: ['me'] as const,
  trial: ['trial'] as const,
  apps: ['apps'] as const,
  app: (slug: string) => ['app', slug] as const,
  access: (slug: string) => ['access', slug] as const,
  activity: (f: ActivityFilters) => ['activity', f] as const,
  data: (slug: string) => ['data', slug] as const,
  table: (slug: string, table: string, page: number) => ['table', slug, table, page] as const,
  agent: ['agent'] as const,
  usage: ['usage'] as const,
  gate: (slug: string) => ['gate', slug] as const,
  demo: ['demo'] as const,
}

// ───────────── lecturas ─────────────

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.get<User>('/me'), staleTime: Infinity })

export const useTrial = () =>
  useQuery({ queryKey: keys.trial, queryFn: () => api.get<Trial>('/trial'), refetchInterval: 15_000 })

export const useApps = () => useQuery({ queryKey: keys.apps, queryFn: () => api.get<AppSummary[]>('/apps') })

/** `fast`: consulta cada 0,7 s mientras la app se está publicando (pantalla de progreso). */
export function useApp(slug: string | undefined, opts: { fast?: boolean } = {}) {
  return useQuery({
    queryKey: keys.app(slug ?? ''),
    queryFn: () => api.get<AppSummary>(`/apps/${slug}`),
    enabled: Boolean(slug),
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === 'publishing' ? (opts.fast ? 700 : 5000) : false),
  })
}

export const useAccess = (slug: string) =>
  useQuery({ queryKey: keys.access(slug), queryFn: () => api.get<AccessEntry[]>(`/apps/${slug}/access`) })

export function useActivity(filters: ActivityFilters) {
  const qs = new URLSearchParams()
  if (filters.app) qs.set('app', filters.app)
  if (filters.actor) qs.set('actor', filters.actor)
  if (filters.type) qs.set('type', filters.type)
  if (filters.range) qs.set('range', filters.range)
  return useQuery({
    queryKey: keys.activity(filters),
    queryFn: () => api.get<ActivityEvent[]>(`/activity?${qs.toString()}`),
    placeholderData: keepPreviousData,
  })
}

export const useDataOverview = (slug: string) =>
  useQuery({ queryKey: keys.data(slug), queryFn: () => api.get<DataOverview>(`/apps/${slug}/data`) })

export const useTablePage = (slug: string, table: string | undefined, page: number, pageSize = 6) =>
  useQuery({
    queryKey: keys.table(slug, table ?? '', page),
    queryFn: () => api.get<DataTablePage>(`/apps/${slug}/data/${table}?page=${page}&pageSize=${pageSize}`),
    enabled: Boolean(table),
    placeholderData: keepPreviousData,
  })

export const useAgent = () => useQuery({ queryKey: keys.agent, queryFn: () => api.get<AgentStatus>('/agent') })

export const useUsage = () => useQuery({ queryKey: keys.usage, queryFn: () => api.get<Usage>('/usage') })

export const useGate = (slug: string) =>
  useQuery({ queryKey: keys.gate(slug), queryFn: () => api.get<GateInfo>(`/gate/${slug}`), retry: false })

/** Revisa cada 2 s si la persona sigue teniendo acceso: así se ve la revocación inmediata. */
export function useGateSession(slug: string, email: string | undefined, provider: Provider | undefined) {
  return useQuery({
    queryKey: ['gate-session', slug, email],
    queryFn: () => api.get<GateResult>(`/gate/${slug}/session?email=${encodeURIComponent(email ?? '')}&provider=${provider ?? 'google'}`),
    enabled: Boolean(email),
    refetchInterval: 2000,
    retry: false,
  })
}

export const useDemo = () => useQuery({ queryKey: keys.demo, queryFn: () => api.get<DemoState>('/demo') })

export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api.get<AppNotification[]>('/notifications'), refetchInterval: 3000 })

// ───────────── escrituras ─────────────

function useInvalidate() {
  const qc = useQueryClient()
  return (...queryKeys: readonly (readonly unknown[])[]) => Promise.all(queryKeys.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

export function usePublish() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: PublishInput) => api.post<AppSummary>('/apps', input),
    onSuccess: () => invalidate(keys.apps, ['activity'], keys.usage),
  })
}

export function usePublishVersion(slug: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: PublishInput) => api.post<AppSummary>(`/apps/${slug}/versions`, input),
    onSuccess: () => invalidate(keys.apps, keys.app(slug), ['activity']),
  })
}

export function useCancelPublish() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (slug: string) => api.post<void>(`/apps/${slug}/cancel-publish`),
    onSuccess: () => invalidate(keys.apps, ['activity'], keys.usage),
  })
}

export function useRenameApp(slug: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (name: string) => api.patch<AppSummary>(`/apps/${slug}`, { name }),
    onSuccess: () => invalidate(keys.apps, keys.app(slug), ['activity'], keys.usage),
  })
}

export function useDeleteApp() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (slug: string) => api.delete(`/apps/${slug}`),
    onSuccess: () => invalidate(keys.apps, ['activity'], keys.usage),
  })
}

export function useInvite(slug: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: InviteInput) => api.post<AccessEntry>(`/apps/${slug}/access`, input),
    onSuccess: () => invalidate(keys.access(slug), keys.apps, keys.app(slug), ['activity'], keys.usage),
  })
}

export function useRevoke(slug: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (accessId: string) => api.delete(`/apps/${slug}/access/${accessId}`),
    onSuccess: () => invalidate(keys.access(slug), keys.apps, keys.app(slug), ['activity'], keys.usage),
  })
}

export function useInviteTrial() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (emails: string[]) => api.post<Trial>('/trial/invites', { emails }),
    onSuccess: () => invalidate(keys.trial, keys.demo),
  })
}

export function useTestAgent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (tool: AgentTool) => api.post<AgentTestResult>(`/agent/${tool}/test`),
    onSuccess: () => invalidate(keys.agent),
  })
}

export function useDisconnectAgent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agent/connections/${id}`),
    onSuccess: () => invalidate(keys.agent),
  })
}

export function useGateLogin(slug: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: { email: string; provider: Provider }) => api.post<GateResult>(`/gate/${slug}/login`, input),
    onSuccess: () => invalidate(keys.apps, ['activity'], keys.usage, keys.access(slug)),
  })
}

export function useAckNotifications() {
  return useMutation({ mutationFn: (ids: string[]) => api.post<void>('/notifications/ack', { ids }) })
}

export function useDemoActions() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries()
  return {
    setScenario: useMutation({
      mutationFn: (scenario: DemoState['scenario']) => api.post<void>('/demo/scenario', { scenario }),
      onSuccess: refresh,
    }),
    reset: useMutation({ mutationFn: () => api.post<void>('/demo/reset'), onSuccess: refresh }),
    simulateInvites: useMutation({ mutationFn: () => api.post<void>('/demo/simulate-invites'), onSuccess: refresh }),
  }
}
