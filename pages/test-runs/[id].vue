<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA', 'ROLE_CLIENTE']
})

const { t } = useI18n()
const route = useRoute()
const api = useApi()

interface TestEntry {
  title: string[]
  state: string
  durationMs: number | null
  displayError: string | null
}

interface RunDetail {
  specName: string | null
  specRelative: string | null
  stats: Record<string, unknown> | null
  tests: TestEntry[]
  error: string | null
  reporter: string | null
}

interface TestRunResultDetail {
  id: string
  testRequestId: string | null
  testCardId: string | null
  spec: string
  success: boolean | null
  totalTests: number | null
  totalPassed: number | null
  totalFailed: number | null
  totalPending: number | null
  totalSkipped: number | null
  browserName: string | null
  browserVersion: string | null
  durationMs: number | null
  startedAt: string | null
  endedAt: string | null
  executedByUserId: string | null
  executedByEmail: string | null
  createdAt: string | null
  runs: RunDetail[]
}

const id = computed(() => String(route.params.id))
const loading = ref(false)
const loadError = ref<string | null>(null)
const data = ref<TestRunResultDetail | null>(null)

useHead({ title: () => `${t('admin.cypress.result')} — ${t('common.appName')}` })

async function load() {
  loading.value = true
  loadError.value = null
  try {
    data.value = await api.get<TestRunResultDetail>(`/test-runs/${id.value}`)
  } catch (err: any) {
    loadError.value = err?.data?.message || err?.message || t('admin.cypress.runError')
  } finally {
    loading.value = false
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

const flatTests = computed<TestEntry[]>(() => {
  if (!data.value) return []
  return data.value.runs.flatMap(r => r.tests || [])
})

onMounted(load)
</script>

<template>
  <v-container fluid class="py-6" style="max-width: 1000px">
    <div class="d-flex align-center gap-2 mb-4">
      <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" to="/cypress">
        {{ t('admin.cypress.title') }}
      </v-btn>
      <v-spacer />
    </div>

    <v-card variant="outlined" rounded="lg" min-height="320">
      <v-card-title class="d-flex align-center text-body-1 py-3 flex-wrap gap-2">
        <v-icon start>mdi-chart-bar</v-icon>
        {{ t('admin.cypress.result') }}
        <v-spacer />
        <v-chip
          v-if="data"
          :color="data.success ? 'success' : 'error'"
          variant="tonal"
          size="small"
          :prepend-icon="data.success ? 'mdi-check-circle' : 'mdi-close-circle'"
        >
          {{ data.success ? t('admin.cypress.success') : t('admin.cypress.failed') }}
        </v-chip>
      </v-card-title>
      <v-divider />

      <div v-if="loading" class="pa-8 text-center">
        <v-progress-circular indeterminate size="48" color="primary" />
      </div>

      <div v-else-if="loadError" class="pa-4">
        <v-alert type="error" variant="tonal">{{ loadError }}</v-alert>
      </div>

      <div v-else-if="!data" class="pa-8 text-center text-medium-emphasis">—</div>

      <div v-else class="pa-4">
        <div class="text-body-2 font-monospace mb-3 text-truncate">{{ data.spec }}</div>

        <v-row dense class="mb-3">
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.total') }}</div>
            <div class="text-h6">{{ data.totalTests ?? '—' }}</div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.passed') }}</div>
            <div class="text-h6 text-success">{{ data.totalPassed ?? '—' }}</div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.failed') }}</div>
            <div class="text-h6" :class="(data.totalFailed ?? 0) > 0 ? 'text-error' : ''">
              {{ data.totalFailed ?? '—' }}
            </div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">{{ t('admin.cypress.stats.skipped') }}</div>
            <div class="text-h6">{{ (data.totalSkipped ?? 0) + (data.totalPending ?? 0) }}</div>
          </v-col>
        </v-row>

        <v-divider class="mb-3" />

        <v-row dense class="text-caption mb-3">
          <v-col cols="12" sm="6">
            <div class="text-medium-emphasis">{{ t('admin.cypress.browser') }}</div>
            <div>{{ data.browserName }} <span v-if="data.browserVersion">{{ data.browserVersion }}</span></div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-medium-emphasis">{{ t('admin.cypress.duration') }}</div>
            <div>{{ fmtDuration(data.durationMs) }}</div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-medium-emphasis">{{ t('admin.cypress.startedAt') }}</div>
            <div>{{ fmtDateTime(data.startedAt) }}</div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-medium-emphasis">{{ t('admin.cypress.endedAt') }}</div>
            <div>{{ fmtDateTime(data.endedAt) }}</div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-medium-emphasis">{{ t('admin.cypress.historyExecutedBy') }}</div>
            <div>{{ data.executedByEmail ?? '—' }}</div>
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
              <span class="text-caption text-medium-emphasis me-3">{{ fmtDuration(test.durationMs) }}</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <pre v-if="test.displayError" class="text-caption text-pre-wrap">{{ test.displayError }}</pre>
              <div v-else class="text-caption text-medium-emphasis">—</div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
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
</style>
