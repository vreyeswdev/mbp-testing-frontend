<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

useHead({ title: 'Submissions — MBP Testing' })

type SubmissionStatus = 'PENDING' | 'AWAITING_CLARIFICATION' | 'BUDGETED' | 'ACCEPTED' | 'REJECTED'

interface SubmissionRow {
  id: string
  contactName: string
  contactEmail: string
  projectName: string
  status: SubmissionStatus
  submittedAt: string
  totalBudgetAmount: number
}

const api = useApi()

const items = ref<SubmissionRow[]>([])
const loading = ref(true)
const statusFilter = ref<SubmissionStatus | null>(null)
const error = ref<string | null>(null)

const statusOptions = [
  { value: null, title: 'Todas' },
  { value: 'PENDING', title: 'Pendientes' },
  { value: 'AWAITING_CLARIFICATION', title: 'En scoping' },
  { value: 'BUDGETED', title: 'Presupuestadas' },
  { value: 'ACCEPTED', title: 'Aceptadas' },
  { value: 'REJECTED', title: 'Rechazadas' }
]

const statusMeta: Record<SubmissionStatus, { color: string; label: string }> = {
  PENDING: { color: 'info', label: 'Nueva' },
  AWAITING_CLARIFICATION: { color: 'warning', label: 'Scoping' },
  BUDGETED: { color: 'primary', label: 'Presupuesto enviado' },
  ACCEPTED: { color: 'success', label: 'Aceptada' },
  REJECTED: { color: 'error', label: 'Rechazada' }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const q = statusFilter.value ? `?status=${statusFilter.value}` : ''
    items.value = await api.get<SubmissionRow[]>(`/submissions${q}`)
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cargar las submissions'
  } finally {
    loading.value = false
  }
}

watch(statusFilter, load)
onMounted(load)

const headers = [
  { title: 'Fecha', key: 'submittedAt' },
  { title: 'Proyecto', key: 'projectName' },
  { title: 'Contacto', key: 'contactName' },
  { title: 'Email', key: 'contactEmail' },
  { title: 'Estado', key: 'status' },
  { title: 'Monto', key: 'totalBudgetAmount', align: 'end' as const },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
]

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
        <span class="cyber-subtitle">// admin / intake</span>
        <h1 class="text-h4 cyber-title mt-1">Submissions</h1>
      </div>
      <v-spacer />
      <v-select
        v-model="statusFilter"
        :items="statusOptions"
        item-title="title"
        item-value="value"
        label="Filtro de estado"
        density="compact"
        hide-details
        style="max-width: 240px"
      />
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card class="cyber-card">
      <v-data-table
        :headers="headers"
        :items="items"
        :loading="loading"
        items-per-page="25"
        density="comfortable"
        no-data-text="Sin submissions"
      >
        <template #item.submittedAt="{ value }">
          <span class="cyber-mono text-caption">{{ fmtDate(value) }}</span>
        </template>
        <template #item.status="{ value }">
          <v-chip :color="statusMeta[value as SubmissionStatus].color" size="small" variant="tonal" class="cyber-chip">
            {{ statusMeta[value as SubmissionStatus].label }}
          </v-chip>
        </template>
        <template #item.totalBudgetAmount="{ value }">
          <span class="cyber-mono">{{ fmtMoney(value) }}</span>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            size="small"
            variant="text"
            color="primary"
            :to="`/admin/submissions/${item.id}`"
            append-icon="mdi-arrow-right"
          >
            Abrir
          </v-btn>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>
