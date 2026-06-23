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

// -------------------------------------------------------------------
// Tipos
// -------------------------------------------------------------------
interface CypressRunDetail {
  spec: { name: string; relative: string } | null
  stats: Record<string, number> | null
  tests: unknown[]
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

interface CypressSpecSummary {
  id: string
  testRequestId: string
  name: string
  description: string | null
  active: boolean
  updatedByEmail: string | null
  updatedAt: string | null
}

interface CypressSpecsTestRequestGroup {
  testRequestId: string
  testRequestTitle: string
  status: string
  statusLabel: string
  projectName: string
  companiaId: string
  companiaNombre: string
  specs: CypressSpecSummary[]
}

interface TestRunResultSummary {
  id: string
  spec: string
  success: boolean | null
  totalTests: number | null
  totalPassed: number | null
  totalFailed: number | null
  durationMs: number | null
  endedAt: string | null
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

interface BatchItem {
  specId: string
  name: string
  testRequestTitle: string
  companiaNombre: string
  state: 'pending' | 'running' | 'success' | 'failed'
  runResultId: string | null
  totalTests: number | null
  totalPassed: number | null
  totalFailed: number | null
  error: string | null
}

// -------------------------------------------------------------------
// Estado: specs por TR
// -------------------------------------------------------------------
const trGroups = ref<CypressSpecsTestRequestGroup[]>([])
const loadingGroups = ref(false)
const groupsError = ref<string | null>(null)
const selected = ref<Set<string>>(new Set())

const batchRunning = ref(false)
const batchItems = ref<BatchItem[]>([])
const batchProgressIndex = ref(0)

const healthLoading = ref(false)
const healthState = ref<'unknown' | 'up' | 'down'>('unknown')

// -------------------------------------------------------------------
// Estado: historial con filtros + paginación
// -------------------------------------------------------------------
const history = ref<TestRunResultSummary[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyError = ref<string | null>(null)
const historyPage = ref(0) // 0-indexed
const historyPageSize = ref(20)
const historyFilterTrId = ref<string | null>(null)
const historyFilterSpec = ref('')
const historyFilterResult = ref<'all' | 'success' | 'failed'>('all')

// -------------------------------------------------------------------
// Selección por TR
// -------------------------------------------------------------------
function isSelected(id: string): boolean {
  return selected.value.has(id)
}

function toggleSpec(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selected.value = s
}

function trAllSelected(tr: CypressSpecsTestRequestGroup): boolean {
  return tr.specs.length > 0 && tr.specs.every(s => selected.value.has(s.id))
}

function trSomeSelected(tr: CypressSpecsTestRequestGroup): boolean {
  return tr.specs.some(s => selected.value.has(s.id)) && !trAllSelected(tr)
}

function toggleTr(tr: CypressSpecsTestRequestGroup) {
  const s = new Set(selected.value)
  if (trAllSelected(tr)) {
    tr.specs.forEach(spec => s.delete(spec.id))
  } else {
    tr.specs.forEach(spec => { if (spec.active) s.add(spec.id) })
  }
  selected.value = s
}

function clearSelection() {
  selected.value = new Set()
}

const selectedCount = computed(() => selected.value.size)

const specIndex = computed(() => {
  const idx = new Map<string, { companiaNombre: string; testRequestTitle: string; name: string }>()
  for (const tr of trGroups.value) {
    for (const spec of tr.specs) {
      idx.set(spec.id, {
        companiaNombre: tr.companiaNombre,
        testRequestTitle: tr.testRequestTitle,
        name: spec.name
      })
    }
  }
  return idx
})

const trFilterOptions = computed(() => {
  const opts = trGroups.value.map(tr => ({
    value: tr.testRequestId,
    title: `${tr.companiaNombre} · ${tr.testRequestTitle}`
  }))
  return [{ value: null, title: t('admin.cypress.historyFilterTrAll') }, ...opts]
})

const resultFilterOptions = computed(() => [
  { value: 'all', title: t('admin.cypress.historyFilterResultAll') },
  { value: 'success', title: t('admin.cypress.historyFilterResultSuccess') },
  { value: 'failed', title: t('admin.cypress.historyFilterResultFailed') }
])

// Filtros client-side sobre la página devuelta por el backend.
const filteredHistory = computed(() => {
  const q = historyFilterSpec.value.trim().toLowerCase()
  const result = historyFilterResult.value
  return history.value.filter(row => {
    if (q && !(row.spec ?? '').toLowerCase().includes(q)) return false
    if (result === 'success' && row.success !== true) return false
    if (result === 'failed' && row.success !== false) return false
    return true
  })
})

// -------------------------------------------------------------------
// Carga de datos
// -------------------------------------------------------------------
async function loadGrouped() {
  loadingGroups.value = true
  groupsError.value = null
  try {
    trGroups.value = await api.get<CypressSpecsTestRequestGroup[]>('/cypress-specs/grouped-by-tr')
  } catch (err: any) {
    groupsError.value = err?.data?.message || err?.message || t('admin.cypress.loadError')
  } finally {
    loadingGroups.value = false
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

async function loadHistory() {
  historyLoading.value = true
  historyError.value = null
  try {
    const params = new URLSearchParams()
    params.set('page', String(historyPage.value))
    params.set('size', String(historyPageSize.value))
    if (historyFilterTrId.value) params.set('testRequestId', historyFilterTrId.value)
    const page = await api.get<Page<TestRunResultSummary>>(`/test-runs?${params.toString()}`)
    history.value = page.content ?? []
    historyTotal.value = page.totalElements ?? 0
  } catch (err: any) {
    historyError.value = err?.data?.message || err?.message || t('admin.cypress.historyError')
  } finally {
    historyLoading.value = false
  }
}

function onHistoryServerFiltersChange() {
  historyPage.value = 0
  loadHistory()
}

// -------------------------------------------------------------------
// Ejecución batch (secuencial — el runner Cypress es pesado, mejor no paralelo)
// -------------------------------------------------------------------
async function runBatch() {
  if (selectedCount.value === 0 || batchRunning.value) return
  const ids = Array.from(selected.value)
  batchItems.value = ids.map(id => {
    const meta = specIndex.value.get(id)
    return {
      specId: id,
      name: meta?.name || id,
      testRequestTitle: meta?.testRequestTitle || '',
      companiaNombre: meta?.companiaNombre || '',
      state: 'pending' as const,
      runResultId: null,
      totalTests: null,
      totalPassed: null,
      totalFailed: null,
      error: null
    }
  })
  batchRunning.value = true
  batchProgressIndex.value = 0

  for (let i = 0; i < ids.length; i++) {
    batchProgressIndex.value = i
    const item = batchItems.value[i]
    item.state = 'running'
    try {
      const data = await api.post<CypressRunExecutionResponse>('/cypress-runner/run', {
        cypressSpecId: item.specId
      })
      item.runResultId = data.runResultId
      item.totalTests = data.result?.totalTests ?? null
      item.totalPassed = data.result?.totalPassed ?? null
      item.totalFailed = data.result?.totalFailed ?? null
      item.state = data.result?.success ? 'success' : 'failed'
    } catch (err: any) {
      item.error = err?.data?.message || err?.message || t('admin.cypress.runError')
      item.state = 'failed'
    }
  }

  batchRunning.value = false
  batchProgressIndex.value = ids.length
  loadHistory()
}

function batchSummary() {
  const total = batchItems.value.length
  const done = batchItems.value.filter(i => i.state === 'success' || i.state === 'failed').length
  const ok = batchItems.value.filter(i => i.state === 'success').length
  const failed = batchItems.value.filter(i => i.state === 'failed').length
  return { total, done, ok, failed }
}

// -------------------------------------------------------------------
// Formato
// -------------------------------------------------------------------
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

onMounted(() => {
  loadGrouped()
  checkHealth()
  loadHistory()
})
</script>

<template>
  <v-container fluid class="py-6" style="max-width: 1300px">
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

    <!-- Acciones batch -->
    <v-card variant="outlined" rounded="lg" class="mb-4 pa-3">
      <div class="d-flex align-center flex-wrap gap-2">
        <div class="text-body-2">
          <strong>{{ selectedCount }}</strong> {{ t('admin.cypress.selectedCount') }}
        </div>
        <v-spacer />
        <v-btn
          v-if="selectedCount > 0 && !batchRunning"
          variant="text"
          size="small"
          @click="clearSelection"
        >
          {{ t('admin.cypress.clearSelection') }}
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-play"
          :loading="batchRunning"
          :disabled="selectedCount === 0"
          @click="runBatch"
        >
          {{ batchRunning
            ? t('admin.cypress.batchRunning', { i: batchProgressIndex + 1, n: selectedCount })
            : t('admin.cypress.runSelected', { n: selectedCount }) }}
        </v-btn>
      </div>
      <v-progress-linear
        v-if="batchRunning"
        :model-value="batchItems.length > 0 ? (batchProgressIndex / batchItems.length) * 100 : 0"
        class="mt-2"
        height="6"
        color="primary"
      />
    </v-card>

    <!-- Resultados del batch -->
    <v-card v-if="batchItems.length > 0" variant="outlined" rounded="lg" class="mb-4">
      <v-card-title class="d-flex align-center text-body-1 py-3">
        <v-icon start>mdi-format-list-checks</v-icon>
        {{ t('admin.cypress.batchResults') }}
        <v-spacer />
        <v-chip size="small" variant="tonal" color="success" class="me-1">
          ✓ {{ batchSummary().ok }}
        </v-chip>
        <v-chip size="small" variant="tonal" color="error" class="me-1">
          ✗ {{ batchSummary().failed }}
        </v-chip>
        <v-chip size="small" variant="tonal">
          {{ batchSummary().done }} / {{ batchSummary().total }}
        </v-chip>
      </v-card-title>
      <v-divider />
      <v-table density="compact">
        <thead>
          <tr>
            <th></th>
            <th>{{ t('admin.cypress.batchSpec') }}</th>
            <th>{{ t('admin.cypress.batchContext') }}</th>
            <th class="text-right">{{ t('admin.cypress.stats.passed') }}</th>
            <th class="text-right">{{ t('admin.cypress.stats.failed') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in batchItems" :key="item.specId">
            <td>
              <v-icon v-if="item.state === 'pending'" color="grey">mdi-clock-outline</v-icon>
              <v-progress-circular v-else-if="item.state === 'running'" indeterminate size="20" />
              <v-icon v-else-if="item.state === 'success'" color="success">mdi-check-circle</v-icon>
              <v-icon v-else color="error">mdi-close-circle</v-icon>
            </td>
            <td class="font-monospace text-body-2">{{ item.name }}</td>
            <td class="text-caption text-medium-emphasis">
              {{ item.companiaNombre }} · {{ item.testRequestTitle }}
            </td>
            <td class="text-right text-success">{{ item.totalPassed ?? '—' }}</td>
            <td class="text-right" :class="(item.totalFailed ?? 0) > 0 ? 'text-error' : ''">
              {{ item.totalFailed ?? '—' }}
            </td>
            <td class="text-right">
              <v-btn
                v-if="item.runResultId"
                size="small"
                variant="text"
                prepend-icon="mdi-open-in-new"
                :to="`/test-runs/${item.runResultId}`"
              >
                {{ t('admin.cypress.viewDetail') }}
              </v-btn>
              <span v-else-if="item.error" class="text-caption text-error">{{ item.error }}</span>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- Specs por TestRequest -->
    <v-card variant="outlined" rounded="lg" class="mb-4">
      <v-card-title class="d-flex align-center text-body-1 py-3">
        <v-icon start>mdi-clipboard-text-outline</v-icon>
        {{ t('admin.cypress.specsByTestRequest') }}
        <v-spacer />
        <v-btn
          variant="text"
          density="comfortable"
          icon="mdi-refresh"
          size="small"
          :loading="loadingGroups"
          @click="loadGrouped"
        />
      </v-card-title>
      <v-divider />

      <div v-if="groupsError" class="pa-4">
        <v-alert type="error" variant="tonal" density="compact">{{ groupsError }}</v-alert>
      </div>

      <div v-else-if="loadingGroups && trGroups.length === 0" class="d-flex justify-center pa-6">
        <v-progress-circular indeterminate size="32" />
      </div>

      <div v-else-if="trGroups.length === 0" class="pa-4">
        <v-alert type="info" variant="tonal" density="compact">
          {{ t('admin.cypress.specsByTestRequestEmpty') }}
        </v-alert>
      </div>

      <v-expansion-panels v-else variant="accordion" multiple>
        <v-expansion-panel
          v-for="tr in trGroups"
          :key="tr.testRequestId"
        >
          <v-expansion-panel-title>
            <v-checkbox
              :model-value="trAllSelected(tr)"
              :indeterminate="trSomeSelected(tr)"
              hide-details
              density="compact"
              class="me-2"
              @click.stop
              @update:model-value="toggleTr(tr)"
            />
            <div class="flex-grow-1 d-flex align-center flex-wrap gap-2">
              <strong>{{ tr.testRequestTitle }}</strong>
              <v-chip size="x-small" variant="tonal" color="primary" prepend-icon="mdi-domain">
                {{ tr.companiaNombre }}
              </v-chip>
              <span class="text-caption text-medium-emphasis">{{ tr.projectName }} · {{ tr.statusLabel }}</span>
              <v-spacer />
              <v-chip size="x-small" variant="tonal">{{ tr.specs.length }}</v-chip>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="d-flex justify-end mb-2">
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-cog-outline"
                :to="`/requests/${tr.testRequestId}/specs`"
              >
                {{ t('admin.cypress.manageSpecs') }}
              </v-btn>
            </div>
            <v-list density="compact" class="py-0">
              <v-list-item
                v-for="spec in tr.specs"
                :key="spec.id"
                :disabled="!spec.active"
                @click="spec.active && toggleSpec(spec.id)"
              >
                <template #prepend>
                  <v-checkbox
                    :model-value="isSelected(spec.id)"
                    :disabled="!spec.active"
                    hide-details
                    density="compact"
                    @click.stop
                    @update:model-value="toggleSpec(spec.id)"
                  />
                </template>
                <v-list-item-title class="text-body-2 font-monospace">{{ spec.name }}</v-list-item-title>
                <v-list-item-subtitle v-if="spec.description" class="text-caption">
                  {{ spec.description }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip v-if="!spec.active" size="x-small" variant="tonal" color="grey">
                    inactivo
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>

    <!-- Historial reciente -->
    <v-card variant="outlined" rounded="lg">
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

      <!-- Filtros -->
      <div class="pa-3 d-flex flex-wrap gap-3 align-end">
        <v-select
          v-model="historyFilterTrId"
          :items="trFilterOptions"
          item-title="title"
          item-value="value"
          :label="t('admin.cypress.historyFilterTr')"
          density="compact"
          variant="outlined"
          hide-details
          style="min-width: 260px"
          @update:model-value="onHistoryServerFiltersChange"
        />
        <v-text-field
          v-model="historyFilterSpec"
          :label="t('admin.cypress.historyFilterSpec')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          style="min-width: 220px"
        />
        <v-select
          v-model="historyFilterResult"
          :items="resultFilterOptions"
          item-title="title"
          item-value="value"
          :label="t('admin.cypress.historyFilterResult')"
          density="compact"
          variant="outlined"
          hide-details
          style="min-width: 180px"
        />
      </div>
      <v-divider />

      <div v-if="historyError" class="pa-4">
        <v-alert type="error" variant="tonal" density="compact">{{ historyError }}</v-alert>
      </div>

      <div v-else-if="historyLoading && history.length === 0" class="d-flex justify-center pa-6">
        <v-progress-circular indeterminate size="28" />
      </div>

      <div v-else-if="filteredHistory.length === 0" class="pa-4">
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
          <tr v-for="row in filteredHistory" :key="row.id">
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

      <!-- Paginación servidor -->
      <div v-if="!historyError && historyTotal > 0" class="d-flex align-center justify-end pa-3 gap-3 flex-wrap">
        <v-select
          v-model="historyPageSize"
          :items="[10, 20, 50]"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 90px"
          @update:model-value="onHistoryServerFiltersChange"
        />
        <span class="text-caption text-medium-emphasis">
          {{ historyPage * historyPageSize + 1 }}–{{ Math.min((historyPage + 1) * historyPageSize, historyTotal) }} / {{ historyTotal }}
        </span>
        <v-btn
          size="small"
          variant="text"
          icon="mdi-chevron-left"
          :disabled="historyPage === 0 || historyLoading"
          @click="historyPage = historyPage - 1; loadHistory()"
        />
        <v-btn
          size="small"
          variant="text"
          icon="mdi-chevron-right"
          :disabled="(historyPage + 1) * historyPageSize >= historyTotal || historyLoading"
          @click="historyPage = historyPage + 1; loadHistory()"
        />
      </div>
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
.gap-3 {
  gap: 12px;
}
</style>
