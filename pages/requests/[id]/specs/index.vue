<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.cypressSpecs.title')} — ${t('common.appName')}` })

interface CypressSpecSummary {
  id: string
  testRequestId: string
  name: string
  description: string | null
  active: boolean
  updatedByEmail: string | null
  updatedAt: string | null
}

const route = useRoute()
const api = useApi()
const testRequestId = computed(() => route.params.id as string)

const specs = ref<CypressSpecSummary[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const runningId = ref<string | null>(null)
const lastRunResultId = ref<string | null>(null)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    specs.value = await api.get<CypressSpecSummary[]>(
      `/test-requests/${testRequestId.value}/cypress-specs`
    )
  } catch (err: any) {
    loadError.value = err?.data?.message || err?.message || t('admin.cypressSpecs.loadError')
  } finally {
    loading.value = false
  }
}

async function runSpec(spec: CypressSpecSummary) {
  if (runningId.value) return
  runningId.value = spec.id
  actionError.value = null
  lastRunResultId.value = null
  try {
    const data = await api.post<{ runResultId: string | null; result: { success: boolean } }>(
      '/cypress-runner/run',
      { cypressSpecId: spec.id }
    )
    lastRunResultId.value = data.runResultId
  } catch (err: any) {
    actionError.value = err?.data?.message || err?.message || t('admin.cypressSpecs.runError')
  } finally {
    runningId.value = null
  }
}

async function deleteSpec(spec: CypressSpecSummary) {
  if (!confirm(t('admin.cypressSpecs.deleteConfirm'))) return
  actionError.value = null
  try {
    await api.delete(`/test-requests/${testRequestId.value}/cypress-specs/${spec.id}`)
    specs.value = specs.value.filter(s => s.id !== spec.id)
  } catch (err: any) {
    actionError.value = err?.data?.message || err?.message || t('admin.cypressSpecs.deleteError')
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

onMounted(load)
</script>

<template>
  <v-container fluid class="py-6" style="max-width: 1100px">
    <div class="d-flex align-center flex-wrap gap-2 mb-3">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="`/requests/${testRequestId}/board`">
        {{ t('admin.cypressSpecs.back') }}
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        :to="`/requests/${testRequestId}/specs/new`"
      >
        {{ t('admin.cypressSpecs.new') }}
      </v-btn>
    </div>

    <div class="mb-5">
      <div class="text-overline text-medium-emphasis">TestRequest</div>
      <h1 class="text-h4 font-weight-bold">{{ t('admin.cypressSpecs.title') }}</h1>
      <div class="text-body-2 text-medium-emphasis">{{ t('admin.cypressSpecs.subtitle') }}</div>
    </div>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4" closable @click:close="loadError = null">
      {{ loadError }}
    </v-alert>
    <v-alert v-if="actionError" type="error" variant="tonal" class="mb-4" closable @click:close="actionError = null">
      {{ actionError }}
    </v-alert>
    <v-alert v-if="lastRunResultId" type="success" variant="tonal" class="mb-4">
      {{ t('admin.cypressSpecs.lastRunSaved') }} —
      <NuxtLink :to="`/test-runs/${lastRunResultId}`">{{ t('admin.cypressSpecs.viewDetail') }}</NuxtLink>
    </v-alert>

    <v-card variant="outlined" rounded="lg">
      <div v-if="loading && specs.length === 0" class="d-flex justify-center pa-6">
        <v-progress-circular indeterminate size="32" />
      </div>

      <div v-else-if="specs.length === 0" class="pa-4">
        <v-alert type="info" variant="tonal" density="compact">
          {{ t('admin.cypressSpecs.empty') }}
        </v-alert>
      </div>

      <v-table v-else density="compact">
        <thead>
          <tr>
            <th>{{ t('admin.cypressSpecs.name') }}</th>
            <th>{{ t('admin.cypressSpecs.description') }}</th>
            <th>{{ t('admin.cypressSpecs.active') }}</th>
            <th>{{ t('admin.cypressSpecs.updatedBy') }}</th>
            <th>{{ t('admin.cypressSpecs.updatedAt') }}</th>
            <th class="text-right" style="min-width: 280px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="spec in specs" :key="spec.id">
            <td class="font-monospace text-body-2">{{ spec.name }}</td>
            <td class="text-body-2">{{ spec.description || '—' }}</td>
            <td>
              <v-chip
                :color="spec.active ? 'success' : 'grey'"
                size="x-small"
                variant="tonal"
              >
                {{ spec.active ? t('admin.cypressSpecs.active') : t('admin.cypressSpecs.active') + ': no' }}
              </v-chip>
            </td>
            <td class="text-caption">{{ spec.updatedByEmail || '—' }}</td>
            <td class="text-caption">{{ fmtDateTime(spec.updatedAt) }}</td>
            <td class="text-right">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                :loading="runningId === spec.id"
                :disabled="!spec.active || runningId !== null"
                prepend-icon="mdi-play"
                class="me-1"
                @click="runSpec(spec)"
              >
                {{ t('admin.cypressSpecs.runFromList') }}
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-pencil"
                :to="`/requests/${testRequestId}/specs/${spec.id}`"
                class="me-1"
              >
                {{ t('admin.cypressSpecs.edit') }}
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                color="error"
                icon="mdi-delete-outline"
                @click="deleteSpec(spec)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>

<style scoped>
.font-monospace {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.gap-2 {
  gap: 8px;
}
</style>
