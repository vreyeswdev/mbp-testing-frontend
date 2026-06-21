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
  specs: CypressSpecSummary[]
}

interface CypressSpecsCompanyGroup {
  companiaId: string
  companiaNombre: string
  testRequests: CypressSpecsTestRequestGroup[]
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

// Estado de un spec dentro de la ejecución batch.
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
// Estado
// -------------------------------------------------------------------
const groups = ref<CypressSpecsCompanyGroup[]>([])
const loadingGroups = ref(false)
const groupsError = ref<string | null>(null)
const selected = ref<Set<string>>(new Set())

const batchRunning = ref(false)
const batchItems = ref<BatchItem[]>([])
const batchProgressIndex = ref(0)

const healthLoading = ref(false)
const healthState = ref<'unknown' | 'up' | 'down'>('unknown')

const history = ref<TestRunResultSummary[]>([])
const historyLoading = ref(false)
const historyError = ref<string | null>(null)

// Legacy filesystem
const showLegacy = ref(false)
const fsSpecs = ref<string[]>([])
const fsLoading = ref(false)
const fsError = ref<string | null>(null)
const fsSelected = ref<string | null>(null)
const fsRunning = ref(false)
const fsResult = ref<CypressRunResponse | null>(null)
const fsResultRunId = ref<string | null>(null)
const fsError2 = ref<string | null>(null)

// -------------------------------------------------------------------
// Selección por TR / compañía
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

function companyAllSelected(comp: CypressSpecsCompanyGroup): boolean {
  const all = comp.testRequests.flatMap(tr => tr.specs)
  return all.length > 0 && all.every(s => selected.value.has(s.id))
}

function companySomeSelected(comp: CypressSpecsCompanyGroup): boolean {
  const all = comp.testRequests.flatMap(tr => tr.specs)
  return all.some(s => selected.value.has(s.id)) && !companyAllSelected(comp)
}

function toggleCompany(comp: CypressSpecsCompanyGroup) {
  const s = new Set(selected.value)
  const all = comp.testRequests.flatMap(tr => tr.specs)
  if (companyAllSelected(comp)) {
    all.forEach(spec => s.delete(spec.id))
  } else {
    all.forEach(spec => { if (spec.active) s.add(spec.id) })
  }
  selected.value = s
}

function clearSelection() {
  selected.value = new Set()
}

const selectedCount = computed(() => selected.value.size)

// Mapa plano specId → { companiaNombre, testRequestTitle, name } para batch.
const specIndex = computed(() => {
  const idx = new Map<string, { companiaNombre: string; testRequestTitle: string; name: string }>()
  for (const comp of groups.value) {
    for (const tr of comp.testRequests) {
      for (const spec of tr.specs) {
        idx.set(spec.id, {
          companiaNombre: comp.companiaNombre,
          testRequestTitle: tr.testRequestTitle,
          name: spec.name
        })
      }
    }
  }
  return idx
})

// -------------------------------------------------------------------
// Carga de datos
// -------------------------------------------------------------------
async function loadGrouped() {
  loadingGroups.value = true
  groupsError.value = null
  try {
    groups.value = await api.get<CypressSpecsCompanyGroup[]>('/cypress-specs/grouped')
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
    const page = await api.get<Page<TestRunResultSummary>>('/test-runs?page=0&size=20')
    history.value = page.content ?? []
  } catch (err: any) {
    historyError.value = err?.data?.message || err?.message || t('admin.cypress.historyError')
  } finally {
    historyLoading.value = false
  }
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
// Legacy filesystem
// -------------------------------------------------------------------
async function loadFsSpecs() {
  fsLoading.value = true
  fsError.value = null
  try {
    const data = await api.get<SpecListResponse>('/cypress-runner/specs')
    fsSpecs.value = data.specs ?? []
    if (fsSelected.value && !fsSpecs.value.includes(fsSelected.value)) fsSelected.value = null
  } catch (err: any) {
    fsError.value = err?.data?.message || err?.message || t('admin.cypress.loadError')
  } finally {
    fsLoading.value = false
  }
}

async function runFsSelected() {
  if (!fsSelected.value || fsRunning.value) return
  fsRunning.value = true
  fsError2.value = null
  fsResult.value = null
  fsResultRunId.value = null
  try {
    const data = await api.post<CypressRunExecutionResponse>('/cypress-runner/run', { spec: fsSelected.value })
    fsResult.value = data.result
    fsResultRunId.value = data.runResultId
    loadHistory()
  } catch (err: any) {
    fsError2.value = err?.data?.message || err?.message || t('admin.cypress.runError')
  } finally {
    fsRunning.value = false
  }
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

watch(showLegacy, (v) => {
  if (v && fsSpecs.value.length === 0) loadFsSpecs()
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

    <!-- Specs por compañía -->
    <v-card variant="outlined" rounded="lg" class="mb-4">
      <v-card-title class="d-flex align-center text-body-1 py-3">
        <v-icon start>mdi-domain</v-icon>
        {{ t('admin.cypress.specsByCompany') }}
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

      <div v-else-if="loadingGroups && groups.length === 0" class="d-flex justify-center pa-6">
        <v-progress-circular indeterminate size="32" />
      </div>

      <div v-else-if="groups.length === 0" class="pa-4">
        <v-alert type="info" variant="tonal" density="compact">
          {{ t('admin.cypress.specsByCompanyEmpty') }}
        </v-alert>
      </div>

      <v-expansion-panels v-else variant="accordion" multiple>
        <v-expansion-panel
          v-for="comp in groups"
          :key="comp.companiaId"
        >
          <v-expansion-panel-title>
            <v-checkbox
              :model-value="companyAllSelected(comp)"
              :indeterminate="companySomeSelected(comp)"
              hide-details
              density="compact"
              class="me-2"
              @click.stop
              @update:model-value="toggleCompany(comp)"
            />
            <strong>{{ comp.companiaNombre }}</strong>
            <v-chip class="ms-2" size="x-small" variant="tonal">
              {{ comp.testRequests.reduce((acc, tr) => acc + tr.specs.length, 0) }}
            </v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div v-for="tr in comp.testRequests" :key="tr.testRequestId" class="mb-3">
              <div class="d-flex align-center mb-1">
                <v-checkbox
                  :model-value="trAllSelected(tr)"
                  :indeterminate="trSomeSelected(tr)"
                  hide-details
                  density="compact"
                  class="me-2"
                  @update:model-value="toggleTr(tr)"
                />
                <div>
                  <div class="text-body-2 font-weight-medium">{{ tr.testRequestTitle }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ tr.projectName }} · {{ tr.statusLabel }}
                  </div>
                </div>
                <v-spacer />
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-cog-outline"
                  :to="`/requests/${tr.testRequestId}/specs`"
                >
                  {{ t('admin.cypressSpecs.title') }}
                </v-btn>
              </div>
              <v-list density="compact" class="py-0 ms-9">
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
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>

    <!-- Filesystem legacy (colapsado por default) -->
    <v-card variant="outlined" rounded="lg" class="mb-4">
      <v-card-title
        class="d-flex align-center text-body-1 py-3"
        style="cursor: pointer"
        @click="showLegacy = !showLegacy"
      >
        <v-icon start>mdi-folder-outline</v-icon>
        {{ t('admin.cypress.legacyTitle') }}
        <v-spacer />
        <v-icon>{{ showLegacy ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
      </v-card-title>
      <v-divider v-if="showLegacy" />
      <div v-if="showLegacy" class="pa-3">
        <v-alert type="info" variant="tonal" density="compact" class="mb-3">
          {{ t('admin.cypress.legacyHint') }}
        </v-alert>
        <v-row>
          <v-col cols="12" md="5">
            <div v-if="fsError" class="mb-2">
              <v-alert type="error" variant="tonal" density="compact">{{ fsError }}</v-alert>
            </div>
            <v-list v-else-if="fsSpecs.length > 0" density="compact" max-height="320" class="overflow-y-auto py-0">
              <v-list-item
                v-for="s in fsSpecs"
                :key="s"
                :active="fsSelected === s"
                :disabled="fsRunning"
                @click="fsSelected = s"
              >
                <template #prepend>
                  <v-icon size="18">mdi-file-code-outline</v-icon>
                </template>
                <v-list-item-title class="text-body-2 font-monospace">{{ s }}</v-list-item-title>
              </v-list-item>
            </v-list>
            <div v-else class="text-caption text-medium-emphasis">{{ t('admin.cypress.noSpecs') }}</div>
            <v-btn
              class="mt-2"
              color="primary"
              size="small"
              :disabled="!fsSelected || fsRunning"
              :loading="fsRunning"
              prepend-icon="mdi-play"
              @click="runFsSelected"
            >
              {{ t('admin.cypress.run') }}
            </v-btn>
          </v-col>
          <v-col cols="12" md="7">
            <div v-if="fsError2" class="mb-2">
              <v-alert type="error" variant="tonal" density="compact">{{ fsError2 }}</v-alert>
            </div>
            <div v-else-if="!fsResult" class="text-caption text-medium-emphasis pa-3 text-center">
              {{ t('admin.cypress.noResult') }}
            </div>
            <div v-else>
              <div class="d-flex align-center gap-2 mb-2 flex-wrap">
                <v-chip
                  :color="fsResult.success ? 'success' : 'error'"
                  size="small"
                  variant="tonal"
                  :prepend-icon="fsResult.success ? 'mdi-check-circle' : 'mdi-close-circle'"
                >
                  {{ fsResult.success ? t('admin.cypress.success') : t('admin.cypress.failed') }}
                </v-chip>
                <v-chip
                  v-if="fsResultRunId"
                  :to="`/test-runs/${fsResultRunId}`"
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-content-save-check-outline"
                >
                  {{ t('admin.cypress.saved') }}
                </v-chip>
              </div>
              <div class="text-body-2 font-monospace mb-2 text-truncate">{{ fsResult.spec }}</div>
              <div class="text-caption">
                {{ fsResult.totalPassed }}/{{ fsResult.totalTests }} ok ·
                {{ fmtDuration(fsResult.duration) }}
              </div>
            </div>
          </v-col>
        </v-row>
      </div>
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
