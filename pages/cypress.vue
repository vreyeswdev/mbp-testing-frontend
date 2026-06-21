<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.cypress.title')} — ${t('common.appName')}` })

const api = useApi()

interface SpecListResponse {
  count: number
  specs: string[]
}

interface CypressTest {
  title: string[]
  state: string
  duration: number | null
  displayError: string | null
}

interface CypressRunDetail {
  spec: { name: string; relative: string } | null
  stats: Record<string, number> | null
  tests: CypressTest[]
  error: string | null
  reporter: string | null
}

interface CypressRunResponse {
  success: boolean
  spec: string
  startedAt: string
  endedAt: string
  duration: number
  totalTests: number
  totalPassed: number
  totalFailed: number
  totalPending: number
  totalSkipped: number
  browserName: string
  browserVersion: string
  runs: CypressRunDetail[]
}

interface CypressRunExecutionResponse {
  runResultId: string | null
  result: CypressRunResponse
}

interface TestRunResultSummary {
  id: string
  testRequestId: string | null
  testCardId: string | null
  spec: string
  success: boolean | null
  totalTests: number | null
  totalPassed: number | null
  totalFailed: number | null
  durationMs: number | null
  startedAt: string | null
  endedAt: string | null
  executedByUserId: string | null
  executedByEmail: string | null
}

interface Page<T> {
  content: T[]
  totalElements: number
  number: number
  size: number
}

interface HealthResponse {
  healthy: boolean
}

const specs = ref<string[]>([])
const selected = ref<string | null>(null)
const loadingSpecs = ref(false)
const loadError = ref<string | null>(null)

const running = ref(false)
const runError = ref<string | null>(null)
const result = ref<CypressRunResponse | null>(null)
const lastRunResultId = ref<string | null>(null)

const healthLoading = ref(false)
const healthState = ref<'unknown' | 'up' | 'down'>('unknown')

const history = ref<TestRunResultSummary[]>([])
const historyLoading = ref(false)
const historyError = ref<string | null>(null)

async function loadSpecs() {
  loadingSpecs.value = true
  loadError.value = null
  try {
    const data = await api.get<SpecListResponse>('/cypress-runner/specs')
    specs.value = data.specs ?? []
    // Si el spec seleccionado ya no está, lo limpiamos.
    if (selected.value && !specs.value.includes(selected.value)) selected.value = null
  } catch (err: any) {
    loadError.value = err?.data?.message || err?.message || t('admin.cypress.loadError')
  } finally {
    loadingSpecs.value = false
  }
}

async function checkHealth() {
  healthLoading.value = true
  try {
    const data = await api.get<HealthResponse>('/cypress-runner/health')
    healthState.value = data.healthy ? 'up' : 'down'
  } catch {
    healthState.value = 'down'
  } finally {
    healthLoading.value = false
  }
}

async function runSelected() {
  if (!selected.value || running.value) return
  running.value = true
  runError.value = null
  result.value = null
  lastRunResultId.value = null
  try {
    const data = await api.post<CypressRunExecutionResponse>('/cypress-runner/run', { spec: selected.value })
    result.value = data.result
    lastRunResultId.value = data.runResultId
    // Refrescar historial para incluir el run recién persistido.
    loadHistory()
  } catch (err: any) {
    runError.value = err?.data?.message || err?.message || t('admin.cypress.runError')
  } finally {
    running.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  historyError.value = null
  try {
    const page = await api.get<Page<TestRunResultSummary>>('/test-runs?page=0&size=20')
    history.value = page.content ?? []
  } catch (err: any) {
    historyError.value = err?.data?.message || err?.message || t('admin.cypress.historyError')
  } finally {
    historyLoading.value = false
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

function stateColor(state: string): string {
  switch (state) {
    case 'passed': return 'success'
    case 'failed': return 'error'
    case 'pending': return 'warning'
    case 'skipped': return 'grey'
    default: return 'info'
  }
}

const flatTests = computed<CypressTest[]>(() => {
  if (!result.value) return []
  return result.value.runs.flatMap(r => r.tests || [])
})

onMounted(() => {
  loadSpecs()
  checkHealth()
  loadHistory()
})
</script>

<template>
  <v-container fluid class="py-6" style="max-width: 1200px">
    <!-- Header -->
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
      <div>
        <div class="text-h5 font-weight-bold">{{ t('admin.cypress.title') }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ t('admin.cypress.subtitle') }}</div>
      </div>
      <div class="d-flex align-center gap-2">
        <v-chip
          v-if="healthState !== 'unknown'"
          :color="healthState === 'up' ? 'success' : 'error'"
          :prepend-icon="healthState === 'up' ? 'mdi-check-circle' : 'mdi-alert-circle'"
          variant="tonal"
          size="small"
        >
          {{ healthState === 'up' ? t('admin.cypress.runnerHealthy') : t('admin.cypress.runnerOffline') }}
        </v-chip>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-heart-pulse"
          :loading="healthLoading"
          @click="checkHealth"
        >
          {{ t('admin.cypress.checkHealth') }}
        </v-btn>
      </div>
    </div>

    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      icon="mdi-information-outline"
    >
      {{ t('admin.cypress.managedHint') }}
    </v-alert>

    <v-row>
      <!-- Selector de specs -->
      <v-col cols="12" md="5">
        <v-card variant="outlined" rounded="lg">
          <v-card-title class="d-flex align-center text-body-1 py-3">
            <v-icon start>mdi-file-tree-outline</v-icon>
            {{ t('admin.cypress.specsTitle') }}
            <v-chip class="ms-2" size="x-small" variant="tonal">{{ specs.length }}</v-chip>
            <v-spacer />
            <v-btn
              variant="text"
              density="comfortable"
              icon="mdi-refresh"
              size="small"
              :loading="loadingSpecs"
              @click="loadSpecs"
            />
          </v-card-title>
          <v-divider />

          <div v-if="loadError" class="pa-4">
            <v-alert type="error" variant="tonal" density="compact">{{ loadError }}</v-alert>
          </div>

          <div v-else-if="loadingSpecs && specs.length === 0" class="d-flex justify-center pa-6">
            <v-progress-circular indeterminate size="32" />
          </div>

          <div v-else-if="specs.length === 0" class="pa-4">
            <v-alert type="info" variant="tonal" density="compact">
              {{ t('admin.cypress.noSpecs') }}
            </v-alert>
          </div>

          <v-list v-else density="compact" max-height="480" class="overflow-y-auto py-0">
            <v-list-item
              v-for="s in specs"
              :key="s"
              :active="selected === s"
              :disabled="running"
              @click="selected = s"
            >
              <template #prepend>
                <v-icon size="18">mdi-file-code-outline</v-icon>
              </template>
              <v-list-item-title class="text-body-2 font-monospace">{{ s }}</v-list-item-title>
            </v-list-item>
          </v-list>

          <v-divider />
          <v-card-actions class="px-4 py-3">
            <div class="text-caption text-medium-emphasis text-truncate" style="max-width: 200px">
              <span v-if="selected">{{ t('admin.cypress.selected') }}: <code>{{ selected }}</code></span>
            </div>
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!selected || running"
              :loading="running"
              prepend-icon="mdi-play"
              @click="runSelected"
            >
              {{ t('admin.cypress.run') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Resultados (en vivo) -->
      <v-col cols="12" md="7">
        <v-card variant="outlined" rounded="lg" min-height="320">
          <v-card-title class="d-flex align-center text-body-1 py-3 flex-wrap gap-2">
            <v-icon start>mdi-chart-bar</v-icon>
            {{ t('admin.cypress.result') }}
            <v-spacer />
            <v-chip
              v-if="result && lastRunResultId"
              :to="`/test-runs/${lastRunResultId}`"
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="mdi-content-save-check-outline"
              :title="t('admin.cypress.savedHint')"
            >
              {{ t('admin.cypress.saved') }}
            </v-chip>
            <v-chip
              v-else-if="result"
              color="warning"
              variant="tonal"
              size="small"
              prepend-icon="mdi-content-save-alert-outline"
              :title="t('admin.cypress.savedHint')"
            >
              {{ t('admin.cypress.notSaved') }}
            </v-chip>
            <v-chip
              v-if="result"
              :color="result.success ? 'success' : 'error'"
              variant="tonal"
              size="small"
              :prepend-icon="result.success ? 'mdi-check-circle' : 'mdi-close-circle'"
            >
              {{ result.success ? t('admin.cypress.success') : t('admin.cypress.failed') }}
            </v-chip>
          </v-card-title>
          <v-divider />

          <!-- En ejecución -->
          <div v-if="running" class="pa-8 text-center">
            <v-progress-circular indeterminate size="48" color="primary" class="mb-3" />
            <div class="text-body-2 text-medium-emphasis">{{ t('admin.cypress.running') }}</div>
          </div>

          <!-- Error -->
          <div v-else-if="runError" class="pa-4">
            <v-alert type="error" variant="tonal">
              <div class="font-weight-medium">{{ t('admin.cypress.runError') }}</div>
              <div class="text-caption text-pre-wrap mt-1">{{ runError }}</div>
            </v-alert>
          </div>

          <!-- Sin datos -->
          <div v-else-if="!result" class="pa-8 text-center text-medium-emphasis">
            <v-icon size="48" class="mb-2" color="grey">mdi-flask-empty-outline</v-icon>
            <div class="text-body-2">{{ t('admin.cypress.noResult') }}</div>
          </div>

          <!-- Resultado -->
          <div v-else class="pa-4">
            <div class="text-body-2 font-monospace mb-3 text-truncate">{{ result.spec }}</div>

            <v-row dense class="mb-3">
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.total') }}</div>
                <div class="text-h6">{{ result.totalTests }}</div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.passed') }}</div>
                <div class="text-h6 text-success">{{ result.totalPassed }}</div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.failed') }}</div>
                <div class="text-h6" :class="result.totalFailed > 0 ? 'text-error' : ''">{{ result.totalFailed }}</div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.skipped') }}</div>
                <div class="text-h6">{{ result.totalSkipped + result.totalPending }}</div>
              </v-col>
            </v-row>

            <v-divider class="mb-3" />

            <v-row dense class="text-caption mb-3">
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.cypress.browser') }}</div>
                <div>{{ result.browserName }} <span v-if="result.browserVersion">{{ result.browserVersion }}</span></div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.cypress.duration') }}</div>
                <div>{{ fmtDuration(result.duration) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.cypress.startedAt') }}</div>
                <div>{{ fmtDateTime(result.startedAt) }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="text-medium-emphasis">{{ t('admin.cypress.endedAt') }}</div>
                <div>{{ fmtDateTime(result.endedAt) }}</div>
              </v-col>
            </v-row>

            <v-divider class="mb-3" />

            <div class="text-subtitle-2 mb-2">{{ t('admin.cypress.details') }}</div>
            <div v-if="flatTests.length === 0" class="text-caption text-medium-emphasis">
              {{ t('admin.cypress.noTests') }}
            </div>
            <v-expansion-panels v-else variant="accordion" density="compact">
              <v-expansion-panel
                v-for="(test, idx) in flatTests"
                :key="idx"
              >
                <v-expansion-panel-title>
                  <v-chip :color="stateColor(test.state)" size="x-small" variant="tonal" class="me-2">
                    {{ test.state }}
                  </v-chip>
                  <span class="text-body-2">{{ test.title?.join(' › ') }}</span>
                  <v-spacer />
                  <span class="text-caption text-medium-emphasis me-3">{{ fmtDuration(test.duration) }}</span>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <pre v-if="test.displayError" class="text-caption text-pre-wrap">{{ test.displayError }}</pre>
                  <div v-else class="text-caption text-medium-emphasis">—</div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Historial reciente -->
    <v-card variant="outlined" rounded="lg" class="mt-6">
      <v-card-title class="d-flex align-center text-body-1 py-3">
        <v-icon start>mdi-history</v-icon>
        {{ t('admin.cypress.history') }}
        <v-spacer />
        <v-btn
          variant="text"
          density="comfortable"
          icon="mdi-refresh"
          size="small"
          :loading="historyLoading"
          @click="loadHistory"
        />
      </v-card-title>
      <v-divider />

      <div v-if="historyError" class="pa-4">
        <v-alert type="error" variant="tonal" density="compact">{{ historyError }}</v-alert>
      </div>

      <div v-else-if="historyLoading && history.length === 0" class="d-flex justify-center pa-6">
        <v-progress-circular indeterminate size="28" />
      </div>

      <div v-else-if="history.length === 0" class="pa-4">
        <v-alert type="info" variant="tonal" density="compact">
          {{ t('admin.cypress.historyEmpty') }}
        </v-alert>
      </div>

      <v-table v-else density="compact">
        <thead>
          <tr>
            <th>{{ t('admin.cypress.historyResult') }}</th>
            <th>{{ t('admin.cypress.historySpec') }}</th>
            <th class="text-right">{{ t('admin.cypress.stats.passed') }}</th>
            <th class="text-right">{{ t('admin.cypress.stats.failed') }}</th>
            <th>{{ t('admin.cypress.duration') }}</th>
            <th>{{ t('admin.cypress.historyEndedAt') }}</th>
            <th>{{ t('admin.cypress.historyExecutedBy') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in history" :key="row.id">
            <td>
              <v-chip
                :color="row.success ? 'success' : 'error'"
                size="x-small"
                variant="tonal"
                :prepend-icon="row.success ? 'mdi-check' : 'mdi-close'"
              >
                {{ row.success ? t('admin.cypress.success') : t('admin.cypress.failed') }}
              </v-chip>
            </td>
            <td class="font-monospace text-body-2">{{ row.spec }}</td>
            <td class="text-right text-success">{{ row.totalPassed ?? '—' }}</td>
            <td class="text-right" :class="(row.totalFailed ?? 0) > 0 ? 'text-error' : ''">
              {{ row.totalFailed ?? '—' }}
            </td>
            <td>{{ fmtDuration(row.durationMs) }}</td>
            <td>{{ fmtDateTime(row.endedAt) }}</td>
            <td class="text-caption">{{ row.executedByEmail ?? '—' }}</td>
            <td>
              <v-btn
                size="small"
                variant="text"
                :to="`/test-runs/${row.id}`"
                prepend-icon="mdi-open-in-new"
              >
                {{ t('admin.cypress.viewDetail') }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
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
