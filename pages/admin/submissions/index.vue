<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.submissions.title')} — ${t('common.appName')}` })

type SubmissionStatus = 'PENDING' | 'AWAITING_CLARIFICATION' | 'BUDGETED' | 'ACCEPTED' | 'REJECTED'

interface SubmissionRow {
  id: string
  contactName: string
  contactEmail: string
  projectName: string
  status: SubmissionStatus
  statusLabel: string
  submittedAt: string
  totalBudgetAmount: number
}

const api = useApi()

const items = ref<SubmissionRow[]>([])
const loading = ref(true)
const statusFilter = ref<SubmissionStatus | null>(null)
const error = ref<string | null>(null)

const statusOptions = computed(() => [
  { value: null, title: t('admin.submissions.filterAll') },
  { value: 'PENDING', title: t('admin.submissions.filterPending') },
  { value: 'AWAITING_CLARIFICATION', title: t('admin.submissions.filterAwaiting') },
  { value: 'BUDGETED', title: t('admin.submissions.filterBudgeted') },
  { value: 'ACCEPTED', title: t('admin.submissions.filterAccepted') },
  { value: 'REJECTED', title: t('admin.submissions.filterRejected') }
])

const statusColor: Record<SubmissionStatus, string> = {
  PENDING: 'info',
  AWAITING_CLARIFICATION: 'warning',
  BUDGETED: 'primary',
  ACCEPTED: 'success',
  REJECTED: 'error'
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const q = statusFilter.value ? `?status=${statusFilter.value}` : ''
    items.value = await api.get<SubmissionRow[]>(`/submissions${q}`)
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorLoad')
  } finally {
    loading.value = false
  }
}

watch(statusFilter, load)
onMounted(load)

const headers = computed(() => [
  { title: t('admin.submissions.headers.date'), key: 'submittedAt' },
  { title: t('admin.submissions.headers.project'), key: 'projectName' },
  { title: t('admin.submissions.headers.contact'), key: 'contactName' },
  { title: t('admin.submissions.headers.email'), key: 'contactEmail' },
  { title: t('admin.submissions.headers.status'), key: 'status' },
  { title: t('admin.submissions.headers.amount'), key: 'totalBudgetAmount', align: 'end' as const },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])

function fmtDate(s: string) {
  return new Date(s).toLocaleString()
}
function fmtMoney(n: number) {
  if (!n) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}
</script>

<template>
  <v-container class="py-8" max-width="1280">
    <div class="d-flex align-center mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">{{ t('admin.submissions.overline') }}</div>
        <h1 class="text-h4 font-weight-bold">{{ t('admin.submissions.title') }}</h1>
      </div>
      <v-spacer />
      <v-select
        v-model="statusFilter"
        :items="statusOptions"
        item-title="title"
        item-value="value"
        :label="t('admin.submissions.filter')"
        density="compact"
        hide-details
        style="max-width: 240px"
      />
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card variant="outlined">
      <v-data-table
        :headers="headers"
        :items="items"
        :loading="loading"
        items-per-page="25"
        density="comfortable"
        :no-data-text="t('admin.submissions.noData')"
      >
        <template #item.submittedAt="{ value }">
          <span class="text-caption">{{ fmtDate(value) }}</span>
        </template>
        <template #item.status="{ item }">
          <v-chip :color="statusColor[item.status]" size="small" variant="tonal">
            {{ item.statusLabel || item.status }}
          </v-chip>
        </template>
        <template #item.totalBudgetAmount="{ value }">
          {{ fmtMoney(value) }}
        </template>
        <template #item.actions="{ item }">
          <v-btn
            size="small"
            variant="text"
            color="primary"
            :to="`/admin/submissions/${item.id}`"
            append-icon="mdi-arrow-right"
          >
            {{ t('admin.submissions.open') }}
          </v-btn>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>
