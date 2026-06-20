<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.k6.title')} — ${t('common.appName')}` })

const api = useApi()

type K6Profile = 'QUICK' | 'STANDARD' | 'AGGRESSIVE'
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
type SummaryStatus = 'PASSED' | 'WARNING' | 'FAILED'

interface K6Stage {
  duration: string
  target: number
}

interface K6Metrics {
  requests: number
  rps: number
  avgResponseTime: number
  p95: number
  p99: number
  errorRate: number
  maxUsers: number
}

interface K6Summary {
  status: SummaryStatus
  message: string
}

interface K6RunResponse {
  runId?: string
  success: boolean
  type: string
  profile: K6Profile
  testName: string
  method: HttpMethod
  targetUrl: string
  startedAt: string
  endedAt: string
  duration: number
  maxUsers: number
  metrics: K6Metrics
  stages: K6Stage[]
  summary: K6Summary
}

interface K6CurrentStage {
  index: number
  total: number
  durationMs: number
  rawDuration?: string
  target: number
  elapsedInStageMs: number
}

type K6RunStatusValue = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

interface K6RunStatus {
  runId: string
  status: K6RunStatusValue
  profile: K6Profile
  testName: string
  method: HttpMethod
  targetUrl: string
  startedAt: string
  endedAt: string | null
  elapsedMs: number
  totalDurationMs: number
  progressPct: number
  currentStage: K6CurrentStage | null
  result: K6RunResponse | null
  error: { message: string } | null
}

interface HealthResponse {
  healthy: boolean
}

const PROFILES: K6Profile[] = ['QUICK', 'STANDARD', 'AGGRESSIVE']
const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const profile = ref<K6Profile>('STANDARD')
const testName = ref('')
const method = ref<HttpMethod>('GET')
const targetUrl = ref('')
const headersText = ref('')
const bodyText = ref('')

const running = ref(false)
const runError = ref<string | null>(null)
const result = ref<K6RunResponse | null>(null)

// Estado para recuperación post-524.
// `currentRunId` se genera ANTES del POST para poder refrescar el estado
// si la conexión muere. `lostConnection` separa "el POST cayó por
// timeout/red" (la prueba sigue corriendo) de un error real del runner.
const currentRunId = ref<string | null>(null)
const runStatus = ref<K6RunStatus | null>(null)
const lostConnection = ref(false)
const refreshing = ref(false)

const healthLoading = ref(false)
const healthState = ref<'unknown' | 'up' | 'down'>('unknown')

const bodyAllowed = computed(() => method.value !== 'GET' && method.value !== 'DELETE')

const profileOptions = computed(() => PROFILES.map(p => ({
  value: p,
  title: p,
  subtitle: t(`admin.k6.profileHints.${p}`)
})))

function parseJsonLoose(text: string): unknown | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  return JSON.parse(trimmed)
}

async function checkHealth() {
  healthLoading.value = true
  try {
    const data = await api.get<HealthResponse>('/k6-runner/health')
    healthState.value = data.healthy ? 'up' : 'down'
  } catch {
    healthState.value = 'down'
  } finally {
    healthLoading.value = false
  }
}

function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback (navegadores muy viejos): no es UUID v4 estricto, pero
  // tampoco va a llegar a backend porque Joi rechazaría. Mantener simple.
  return 'r-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Heurística para detectar "se cayó la conexión del POST pero la prueba
// puede seguir corriendo". Cubre Cloudflare (524), gateway timeouts
// (502/503/504), aborts y errores de red de fetch (FetchError sin status).
function isConnectionLikelyDropped(err: any): boolean {
  const status = err?.statusCode ?? err?.status ?? err?.response?.status
  if (status === 524 || status === 502 || status === 503 || status === 504) return true
  if (status && status >= 200) return false // hay status HTTP real → no es drop
  const msg = String(err?.message || '').toLowerCase()
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('aborted') ||
    err?.name === 'FetchError' ||
    err?.name === 'AbortError'
  )
}

async function runScenario() {
  if (running.value) return
  runError.value = null
  result.value = null
  runStatus.value = null
  lostConnection.value = false
  currentRunId.value = null

  if (!testName.value.trim()) {
    runError.value = t('admin.k6.runError')
    return
  }
  if (!targetUrl.value.trim() || !/^https?:\/\//i.test(targetUrl.value.trim())) {
    runError.value = t('admin.k6.targetUrlHint')
    return
  }

  let headers: Record<string, string> | undefined
  let body: unknown | undefined
  try {
    const parsedHeaders = parseJsonLoose(headersText.value)
    if (parsedHeaders !== undefined) {
      if (typeof parsedHeaders !== 'object' || Array.isArray(parsedHeaders) || parsedHeaders === null) {
        throw new Error('headers must be object')
      }
      headers = parsedHeaders as Record<string, string>
    }
  } catch {
    runError.value = t('admin.k6.invalidHeaders')
    return
  }

  try {
    if (bodyAllowed.value) {
      const parsedBody = parseJsonLoose(bodyText.value)
      if (parsedBody !== undefined) {
        const isValidBody =
          typeof parsedBody === 'string' ||
          Array.isArray(parsedBody) ||
          (typeof parsedBody === 'object' && parsedBody !== null)
        if (!isValidBody) {
          runError.value = t('admin.k6.invalidBody')
          return
        }
        body = parsedBody
      }
    }
  } catch {
    runError.value = t('admin.k6.invalidBody')
    return
  }

  // runId se genera ANTES del POST para que el backend-api lo persista en
  // su store en memoria y podamos consultar el estado por GET aún si la
  // respuesta del POST se pierde por 524.
  currentRunId.value = newRunId()
  running.value = true
  try {
    const payload: Record<string, unknown> = {
      runId: currentRunId.value,
      profile: profile.value,
      testName: testName.value.trim(),
      method: method.value,
      targetUrl: targetUrl.value.trim()
    }
    if (headers) payload.headers = headers
    if (body !== undefined) payload.body = body
    result.value = await api.post<K6RunResponse>('/k6-runner/run', payload)
    running.value = false
  } catch (err: any) {
    if (isConnectionLikelyDropped(err)) {
      // No es un fallo de la prueba: la conexión se cayó pero k6 puede
      // seguir corriendo en backend-api. Dejamos running=true para que la
      // UI siga mostrando "ejecutando" y el usuario pueda refrescar.
      lostConnection.value = true
      runError.value = null
      // Intento oportunista: traer el estado inicial sin bloquear al usuario.
      refreshRunStatus().catch(() => { /* el botón sigue disponible */ })
    } else {
      runError.value = err?.data?.message || err?.message || t('admin.k6.runError')
      running.value = false
    }
  }
}

async function refreshRunStatus() {
  if (!currentRunId.value) return
  refreshing.value = true
  try {
    const data = await api.get<K6RunStatus>(`/k6-runner/runs/${currentRunId.value}`)
    runStatus.value = data
    if (data.status === 'COMPLETED' && data.result) {
      result.value = data.result
      running.value = false
      lostConnection.value = false
    } else if (data.status === 'FAILED') {
      runError.value = data.error?.message || t('admin.k6.runError')
      running.value = false
      lostConnection.value = false
    }
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status ?? err?.response?.status
    if (status === 404) {
      runError.value = t('admin.k6.runNotFound')
      running.value = false
      lostConnection.value = false
    }
    // Cualquier otro error: dejar al usuario reintentar manualmente.
  } finally {
    refreshing.value = false
  }
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  const rest = Math.round(s % 60)
  return `${m}m ${rest}s`
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function fmtPercent(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—'
  return `${(rate * 100).toFixed(2)}%`
}

function fmtNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()
}

function summaryColor(status: SummaryStatus | undefined): string {
  switch (status) {
    case 'PASSED': return 'success'
    case 'WARNING': return 'warning'
    case 'FAILED': return 'error'
    default: return 'info'
  }
}

function summaryIcon(status: SummaryStatus | undefined): string {
  switch (status) {
    case 'PASSED': return 'mdi-check-circle'
    case 'WARNING': return 'mdi-alert'
    case 'FAILED': return 'mdi-close-circle'
    default: return 'mdi-information'
  }
}

function summaryLabel(status: SummaryStatus | undefined): string {
  switch (status) {
    case 'PASSED': return t('admin.k6.passed')
    case 'WARNING': return t('admin.k6.warning')
    case 'FAILED': return t('admin.k6.failed')
    default: return '—'
  }
}

onMounted(() => {
  checkHealth()
})
</script>

<template>
  <v-container fluid class="py-6" style="max-width: 1200px">
    <!-- Header -->
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
      <div>
        <div class="text-h5 font-weight-bold">{{ t('admin.k6.title') }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ t('admin.k6.subtitle') }}</div>
      </div>
      <div class="d-flex align-center gap-2">
        <v-chip
          v-if="healthState !== 'unknown'"
          :color="healthState === 'up' ? 'success' : 'error'"
          :prepend-icon="healthState === 'up' ? 'mdi-check-circle' : 'mdi-alert-circle'"
          variant="tonal"
          size="small"
        >
          {{ healthState === 'up' ? t('admin.k6.runnerHealthy') : t('admin.k6.runnerOffline') }}
        </v-chip>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-heart-pulse"
          :loading="healthLoading"
          @click="checkHealth"
        >
          {{ t('admin.k6.checkHealth') }}
        </v-btn>
      </div>
    </div>

    <v-row>
      <!-- Configurador -->
      <v-col cols="12" md="5">
        <v-card variant="outlined" rounded="lg">
          <v-card-title class="d-flex align-center text-body-1 py-3">
            <v-icon start>mdi-cog-outline</v-icon>
            {{ t('admin.k6.configTitle') }}
          </v-card-title>
          <v-divider />
          <div class="pa-4">
            <v-select
              v-model="profile"
              :items="profileOptions"
              item-title="title"
              item-value="value"
              :label="t('admin.k6.profile')"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              class="mb-3"
            >
              <template #item="slotProps">
                <v-list-item
                  v-bind="(slotProps as any).props"
                  :title="(slotProps as any).item.raw.title"
                  :subtitle="(slotProps as any).item.raw.subtitle"
                />
              </template>
            </v-select>

            <v-text-field
              v-model="testName"
              :label="t('admin.k6.testName')"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              class="mb-3"
              :disabled="running"
            />

            <v-select
              v-model="method"
              :items="METHODS"
              :label="t('admin.k6.method')"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              class="mb-3"
              :disabled="running"
            />

            <v-text-field
              v-model="targetUrl"
              :label="t('admin.k6.targetUrl')"
              :hint="t('admin.k6.targetUrlHint')"
              persistent-hint
              variant="outlined"
              density="comfortable"
              class="mb-3"
              :disabled="running"
            />

            <v-textarea
              v-model="headersText"
              :label="t('admin.k6.headers')"
              :hint="t('admin.k6.headersHint')"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rows="2"
              auto-grow
              class="mb-3 font-monospace"
              :disabled="running"
            />

            <v-textarea
              v-if="bodyAllowed"
              v-model="bodyText"
              :label="t('admin.k6.body')"
              :hint="t('admin.k6.bodyHint')"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rows="3"
              auto-grow
              class="mb-2 font-monospace"
              :disabled="running"
            />
          </div>

          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="running"
              :loading="running"
              prepend-icon="mdi-play"
              @click="runScenario"
            >
              {{ t('admin.k6.run') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Resultados -->
      <v-col cols="12" md="7">
        <v-card variant="outlined" rounded="lg" min-height="320">
          <v-card-title class="d-flex align-center text-body-1 py-3">
            <v-icon start>mdi-chart-line</v-icon>
            {{ t('admin.k6.result') }}
            <v-spacer />
            <v-chip
              v-if="result"
              :color="summaryColor(result.summary?.status)"
              variant="tonal"
              size="small"
              :prepend-icon="summaryIcon(result.summary?.status)"
            >
              {{ summaryLabel(result.summary?.status) }}
            </v-chip>
          </v-card-title>
          <v-divider />

          <!-- En ejecución -->
          <div v-if="running" class="pa-5">
            <v-alert
              v-if="lostConnection"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-4"
              icon="mdi-cloud-off-outline"
            >
              <div class="text-caption">{{ t('admin.k6.connectionLost') }}</div>
            </v-alert>

            <div class="d-flex align-center mb-3">
              <v-progress-circular indeterminate size="32" color="primary" class="me-3" />
              <div>
                <div class="text-body-2 font-weight-medium">{{ t('admin.k6.running') }}</div>
                <div v-if="currentRunId" class="text-caption text-medium-emphasis font-monospace">
                  {{ t('admin.k6.runIdLabel') }}: {{ currentRunId }}
                </div>
              </div>
            </div>

            <div v-if="runStatus">
              <v-progress-linear
                :model-value="runStatus.progressPct"
                height="10"
                rounded
                color="primary"
                class="mb-2"
              />
              <div class="d-flex justify-space-between text-caption text-medium-emphasis mb-3">
                <span>{{ fmtNumber(runStatus.progressPct, 1) }}%</span>
                <span>
                  {{ t('admin.k6.elapsed') }}: {{ fmtDuration(runStatus.elapsedMs) }} /
                  {{ t('admin.k6.totalEstimated') }}: {{ fmtDuration(runStatus.totalDurationMs) }}
                </span>
              </div>

              <div v-if="runStatus.currentStage" class="text-body-2 mb-2">
                {{ t('admin.k6.stageLabel', {
                  index: runStatus.currentStage.index,
                  total: runStatus.currentStage.total,
                  target: runStatus.currentStage.target
                }) }}
              </div>
            </div>

            <v-btn
              variant="tonal"
              color="primary"
              prepend-icon="mdi-refresh"
              :loading="refreshing"
              :disabled="!currentRunId"
              @click="refreshRunStatus"
            >
              {{ t('admin.k6.refreshStatus') }}
            </v-btn>
          </div>

          <!-- Error -->
          <div v-else-if="runError" class="pa-4">
            <v-alert type="error" variant="tonal">
              <div class="font-weight-medium">{{ t('admin.k6.runError') }}</div>
              <div class="text-caption text-pre-wrap mt-1">{{ runError }}</div>
            </v-alert>
            <v-btn
              v-if="currentRunId"
              class="mt-3"
              variant="text"
              prepend-icon="mdi-refresh"
              :loading="refreshing"
              @click="refreshRunStatus"
            >
              {{ t('admin.k6.refreshStatus') }}
            </v-btn>
          </div>

          <!-- Sin datos -->
          <div v-else-if="!result" class="pa-8 text-center text-medium-emphasis">
            <v-icon size="48" class="mb-2" color="grey">mdi-speedometer</v-icon>
            <div class="text-body-2">{{ t('admin.k6.noResult') }}</div>
          </div>

          <!-- Resultado -->
          <div v-else class="pa-4">
            <div class="d-flex align-center gap-2 mb-3 flex-wrap">
              <v-chip size="small" variant="tonal" color="primary">{{ result.profile }}</v-chip>
              <v-chip size="small" variant="outlined">{{ result.method }}</v-chip>
              <div class="text-body-2 font-monospace text-truncate" style="max-width: 100%">
                {{ result.targetUrl }}
              </div>
            </div>

            <v-alert
              :type="summaryColor(result.summary?.status) as any"
              variant="tonal"
              density="compact"
              :icon="summaryIcon(result.summary?.status)"
              class="mb-4"
            >
              <div class="font-weight-medium">{{ t('admin.k6.summary') }}</div>
              <div class="text-caption mt-1">{{ result.summary?.message }}</div>
            </v-alert>

            <div class="text-subtitle-2 mb-2">{{ t('admin.k6.metrics.title') }}</div>
            <v-row dense class="mb-3">
              <v-col cols="6" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('admin.k6.metrics.requests') }}</div>
                <div class="text-h6">{{ fmtNumber(result.metrics.requests, 0) }}</div>
              </v-col>
              <v-col cols="6" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('admin.k6.metrics.rps') }}</div>
                <div class="text-h6">{{ fmtNumber(result.metrics.rps) }}</div>
              </v-col>
              <v-col cols="6" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('admin.k6.metrics.avgResponseTime') }}</div>
                <div class="text-h6">{{ fmtNumber(result.metrics.avgResponseTime) }}</div>
              </v-col>
              <v-col cols="6" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('admin.k6.metrics.p95') }}</div>
                <div class="text-h6" :class="result.metrics.p95 > 2000 ? 'text-warning' : ''">
                  {{ fmtNumber(result.metrics.p95) }}
                </div>
              </v-col>
              <v-col cols="6" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('admin.k6.metrics.p99') }}</div>
                <div class="text-h6" :class="result.metrics.p99 > 5000 ? 'text-error' : ''">
                  {{ fmtNumber(result.metrics.p99) }}
                </div>
              </v-col>
              <v-col cols="6" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('admin.k6.metrics.errorRate') }}</div>
                <div
                  class="text-h6"
                  :class="result.metrics.errorRate > 0.05 ? 'text-error' : (result.metrics.errorRate > 0 ? 'text-warning' : 'text-success')"
                >
                  {{ fmtPercent(result.metrics.errorRate) }}
                </div>
              </v-col>
            </v-row>

            <v-divider class="mb-3" />

            <v-row dense class="text-caption mb-3">
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.k6.duration') }}</div>
                <div>{{ fmtDuration(result.duration) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.k6.maxUsers') }}</div>
                <div>{{ fmtNumber(result.maxUsers, 0) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.k6.startedAt') }}</div>
                <div>{{ fmtDateTime(result.startedAt) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.k6.endedAt') }}</div>
                <div>{{ fmtDateTime(result.endedAt) }}</div>
              </v-col>
            </v-row>

            <v-divider class="mb-3" />

            <div class="text-subtitle-2 mb-2">{{ t('admin.k6.stages') }}</div>
            <v-expansion-panels variant="accordion" density="compact">
              <v-expansion-panel
                v-for="(stage, idx) in result.stages"
                :key="idx"
              >
                <v-expansion-panel-title>
                  <v-chip size="x-small" variant="tonal" color="primary" class="me-2">#{{ idx + 1 }}</v-chip>
                  <span class="text-body-2">{{ t('admin.k6.stageTarget') }}: <strong>{{ stage.target }}</strong> VUs</span>
                  <v-spacer />
                  <span class="text-caption text-medium-emphasis me-3">{{ stage.duration }}</span>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="text-caption">
                    {{ t('admin.k6.stageDuration') }}: <code class="font-monospace">{{ stage.duration }}</code> ·
                    {{ t('admin.k6.stageTarget') }}: <code class="font-monospace">{{ stage.target }}</code>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.text-pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}
.font-monospace {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.gap-2 {
  gap: 8px;
}
</style>
