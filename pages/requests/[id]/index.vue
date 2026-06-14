<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'
import { useCatalog } from '~/composables/useCatalog'

definePageMeta({ ssr: false, layout: 'console' })

const { t } = useI18n()
useHead({ title: () => `${t('common.appName')}` })

interface QuoteItemDto {
  id: string
  quoteId: string
  itemType: string
  itemTypeLabel: string
  description: string
  hours: number
  hourlyRate: number
  amount: number
  position: number
}

interface QuoteDto {
  id: string
  testRequestId: string
  status: string
  statusLabel: string
  currency: string
  notes: string | null
  createdById: string
  createdByEmail: string
  createdAt: string
  totalHours: number
  totalAmount: number
  items: QuoteItemDto[]
}

interface TestRequestDto {
  id: string
  projectId: string
  projectName: string
  testTypeId: string
  testTypeCode: string
  environmentId: string | null
  environmentCode: string | null
  title: string
  description: string | null
  status: string
  statusLabel: string
  assignedSpecialistId: string | null
  assignedSpecialistEmail: string | null
  requestedById: string
  requestedByEmail: string
  createdAt: string
}

interface HistoryEntry {
  id: string
  fromStatus: string | null
  fromStatusLabel: string | null
  toStatus: string
  toStatusLabel: string
  changedById: string
  changedByEmail: string
  comment: string | null
  changedAt: string
}

const TEST_REQUEST_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Solicitada',
  SCOPING: 'Relevamiento',
  SPECIALIST_ASSIGNED: 'Especialista asignado',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En progreso',
  BLOCKED: 'Bloqueada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada'
}
function statusLabel(code: string) {
  return TEST_REQUEST_STATUS_LABELS[code] ?? code
}

const ALLOWED_NEXT: Record<string, string[]> = {
  REQUESTED: ['SCOPING', 'CANCELLED'],
  SCOPING: ['CANCELLED'],
  SPECIALIST_ASSIGNED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
}

const route = useRoute()
const api = useApi()
const auth = useAuthStore()
const catalog = useCatalog()
const id = computed(() => route.params.id as string)

const request = ref<TestRequestDto | null>(null)
const history = ref<HistoryEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const transitionDialog = ref(false)
const transitionTo = ref('')
const transitionComment = ref('')

interface SpecialistOption {
  id: string
  email: string
  fullName: string
  roles: string[]
  enabled: boolean
}

const assignDialog = ref(false)
const specialistInput = ref('')
const assignComment = ref('')
const specialists = ref<SpecialistOption[]>([])
const loadingSpecialists = ref(false)

const quotes = ref<QuoteDto[]>([])
const activeQuote = computed<QuoteDto | null>(() => {
  return quotes.value.find(q => ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(q.status)) ?? null
})
const itemDialog = ref(false)
const itemForm = ref({
  itemType: 'EXECUTION',
  description: '',
  hours: 1,
  hourlyRate: 20000,
  position: 0
})
const editingItemId = ref<string | null>(null)
const rejectDialog = ref(false)
const rejectReason = ref('')

async function load() {
  loading.value = true
  error.value = null
  try {
    await catalog.loadAll()
    const [r, h, qs] = await Promise.all([
      api.get<TestRequestDto>(`/test-requests/${id.value}`),
      api.get<HistoryEntry[]>(`/test-requests/${id.value}/history`),
      api.get<QuoteDto[]>(`/test-requests/${id.value}/quotes`)
    ])
    request.value = r
    history.value = h
    quotes.value = qs
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cargar'
  } finally {
    loading.value = false
  }
}

async function openAssignDialog() {
  assignDialog.value = true
  specialistInput.value = ''
  assignComment.value = ''
  if (specialists.value.length === 0) {
    loadingSpecialists.value = true
    try {
      const list = await api.get<SpecialistOption[]>('/admin/users')
      specialists.value = list.filter(u => u.roles.includes('ROLE_ESPECIALISTA') && u.enabled)
    } catch (e: any) {
      error.value = e?.data?.message || 'No fue posible cargar los especialistas'
    } finally {
      loadingSpecialists.value = false
    }
  }
}

async function createQuote() {
  try {
    await api.post<QuoteDto>(`/test-requests/${id.value}/quotes`, { currency: 'CLP', notes: null })
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible crear el borrador'
  }
}

function openNewItem() {
  itemForm.value = { itemType: 'EXECUTION', description: '', hours: 1, hourlyRate: 20000, position: activeQuote.value?.items.length ?? 0 }
  editingItemId.value = null
  itemDialog.value = true
}

function openEditItem(item: QuoteItemDto) {
  itemForm.value = {
    itemType: item.itemType,
    description: item.description,
    hours: Number(item.hours),
    hourlyRate: Number(item.hourlyRate),
    position: item.position
  }
  editingItemId.value = item.id
  itemDialog.value = true
}

async function saveItem() {
  if (!activeQuote.value) return
  try {
    const body = { ...itemForm.value }
    if (editingItemId.value) {
      await api.put<QuoteItemDto>(`/quotes/${activeQuote.value.id}/items/${editingItemId.value}`, body)
    } else {
      await api.post<QuoteItemDto>(`/quotes/${activeQuote.value.id}/items`, body)
    }
    itemDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  }
}

async function deleteItem(item: QuoteItemDto) {
  if (!activeQuote.value) return
  try {
    await api.del(`/quotes/${activeQuote.value.id}/items/${item.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
  }
}

async function submitQuote() {
  if (!activeQuote.value) return
  try {
    await api.post(`/quotes/${activeQuote.value.id}/submit`, {})
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  }
}

async function approveQuote() {
  if (!activeQuote.value) return
  try {
    await api.post(`/quotes/${activeQuote.value.id}/approve`, {})
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  }
}

async function rejectQuote() {
  if (!activeQuote.value) return
  try {
    await api.post(`/quotes/${activeQuote.value.id}/reject`, { reason: rejectReason.value || null })
    rejectDialog.value = false
    rejectReason.value = ''
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  }
}

function quoteStatusColor(s: string) {
  return ({
    DRAFT: 'grey',
    SUBMITTED: 'info',
    APPROVED: 'success',
    REJECTED: 'red',
    SUPERSEDED: 'orange'
  } as Record<string, string>)[s] ?? 'grey'
}

function fmtMoney(n: number, currency = 'CLP') {
  return `${currency} ${Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 })}`
}

const allowedNext = computed(() => {
  if (!request.value) return []
  return ALLOWED_NEXT[request.value.status] ?? []
})

function openTransition(to: string) {
  transitionTo.value = to
  transitionComment.value = ''
  transitionDialog.value = true
}

async function applyTransition() {
  try {
    await api.post(`/test-requests/${id.value}/transitions`, {
      status: transitionTo.value,
      comment: transitionComment.value || null
    })
    transitionDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  }
}

async function assign() {
  try {
    await api.post(`/test-requests/${id.value}/assign-specialist`, {
      userId: specialistInput.value,
      comment: assignComment.value || null
    })
    assignDialog.value = false
    specialistInput.value = ''
    assignComment.value = ''
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  }
}

function statusColor(s: string) {
  return ({
    REQUESTED: 'grey',
    SCOPING: 'info',
    SPECIALIST_ASSIGNED: 'cyan',
    CONFIRMED: 'blue',
    IN_PROGRESS: 'amber',
    BLOCKED: 'orange',
    COMPLETED: 'success',
    CANCELLED: 'red'
  } as Record<string, string>)[s] ?? 'grey'
}

function formatDate(d: string) {
  return new Date(d).toLocaleString()
}

onMounted(load)
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-4">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/requests">
        {{ t('requests.detail.back') }}
      </v-btn>
      <v-spacer />
      <v-btn
        v-if="request"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-view-column"
        :to="`/requests/${id}/board`"
      >
        {{ t('requests.detail.viewBoard') }}
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading && !request" type="card" />

    <template v-else-if="request">
      <v-card variant="outlined" class="mb-6">
        <v-card-title class="d-flex align-center">
          {{ request.title }}
          <v-spacer />
          <v-chip :color="statusColor(request.status)" variant="tonal">{{ request.statusLabel }}</v-chip>
        </v-card-title>
        <v-card-subtitle>{{ request.projectName }} · {{ request.testTypeCode }}<span v-if="request.environmentCode"> · {{ request.environmentCode }}</span></v-card-subtitle>
        <v-card-text>
          <div v-if="request.description" class="mb-3">{{ request.description }}</div>
          <v-row>
            <v-col cols="12" md="4">
              <div class="text-overline">{{ t('requests.detail.requestedBy') }}</div>
              <div>{{ request.requestedByEmail }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">{{ t('requests.detail.specialist') }}</div>
              <div>{{ request.assignedSpecialistEmail || t('common.emptyDash') }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">{{ t('requests.detail.createdAt') }}</div>
              <div>{{ formatDate(request.createdAt) }}</div>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="flex-wrap pa-4">
          <v-btn
            v-for="nextS in allowedNext"
            :key="nextS"
            :color="statusColor(nextS)"
            variant="tonal"
            size="small"
            class="me-2 mb-2"
            @click="openTransition(nextS)"
          >
            → {{ statusLabel(nextS) }}
          </v-btn>
          <v-btn
            v-if="auth.isAdmin && request.status === 'SCOPING'"
            color="primary"
            variant="tonal"
            size="small"
            class="me-2 mb-2"
            prepend-icon="mdi-account-arrow-right"
            @click="openAssignDialog"
          >
            {{ t('requests.detail.assignSpecialist') }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <v-card variant="outlined" class="mb-6">
        <v-card-title class="d-flex align-center">
          {{ t('requests.detail.quote') }}
          <v-spacer />
          <v-chip v-if="activeQuote" :color="quoteStatusColor(activeQuote.status)" variant="tonal">
            {{ activeQuote.statusLabel }}
          </v-chip>
        </v-card-title>
        <v-card-text v-if="!activeQuote">
          <div class="text-medium-emphasis">{{ t('requests.detail.noActiveQuote') }}</div>
          <v-btn class="mt-3" color="primary" size="small" prepend-icon="mdi-plus" @click="createQuote">
            {{ t('requests.detail.createDraft') }}
          </v-btn>
        </v-card-text>
        <template v-else>
          <v-card-text>
            <v-data-table
              :headers="[
                { title: t('common.type'), key: 'itemType' },
                { title: t('common.description'), key: 'description' },
                { title: t('common.hours'), key: 'hours', align: 'end' },
                { title: t('common.hourlyRate'), key: 'hourlyRate', align: 'end' },
                { title: t('common.subtotal'), key: 'amount', align: 'end' },
                { title: '', key: 'actions', sortable: false, align: 'end' }
              ]"
              :items="activeQuote.items"
              density="compact"
              hide-default-footer
            >
              <template #item.itemType="{ item }">{{ item.itemTypeLabel || item.itemType }}</template>
              <template #item.hourlyRate="{ value }">{{ fmtMoney(value, activeQuote.currency) }}</template>
              <template #item.amount="{ value }">{{ fmtMoney(value, activeQuote.currency) }}</template>
              <template #item.actions="{ item }">
                <v-btn
                  v-if="activeQuote.status === 'DRAFT'"
                  size="x-small"
                  variant="text"
                  icon="mdi-pencil"
                  @click="openEditItem(item)"
                />
                <v-btn
                  v-if="activeQuote.status === 'DRAFT'"
                  size="x-small"
                  variant="text"
                  color="error"
                  icon="mdi-delete"
                  @click="deleteItem(item)"
                />
              </template>
            </v-data-table>
            <div class="d-flex justify-end mt-3">
              <div class="text-right">
                <div class="text-overline">{{ t('requests.detail.totalHours') }}</div>
                <div class="text-h6">{{ activeQuote.totalHours }}</div>
                <div class="text-overline mt-2">{{ t('common.total') }}</div>
                <div class="text-h6">{{ fmtMoney(activeQuote.totalAmount, activeQuote.currency) }}</div>
              </div>
            </div>
          </v-card-text>
          <v-card-actions class="flex-wrap pa-4">
            <v-btn
              v-if="activeQuote.status === 'DRAFT'"
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="mdi-plus"
              class="me-2 mb-2"
              @click="openNewItem"
            >
              {{ t('requests.detail.addItem') }}
            </v-btn>
            <v-btn
              v-if="activeQuote.status === 'DRAFT'"
              color="info"
              variant="tonal"
              size="small"
              prepend-icon="mdi-send"
              class="me-2 mb-2"
              :disabled="activeQuote.items.length === 0"
              @click="submitQuote"
            >
              {{ t('requests.detail.sendToClient') }}
            </v-btn>
            <v-btn
              v-if="activeQuote.status === 'SUBMITTED'"
              color="success"
              variant="tonal"
              size="small"
              prepend-icon="mdi-check"
              class="me-2 mb-2"
              @click="approveQuote"
            >
              {{ t('requests.detail.approve') }}
            </v-btn>
            <v-btn
              v-if="activeQuote.status === 'SUBMITTED'"
              color="error"
              variant="tonal"
              size="small"
              prepend-icon="mdi-close"
              class="me-2 mb-2"
              @click="rejectDialog = true"
            >
              {{ t('requests.detail.reject') }}
            </v-btn>
          </v-card-actions>
        </template>
      </v-card>

      <v-card variant="outlined">
        <v-card-title>{{ t('requests.detail.history') }}</v-card-title>
        <v-list density="comfortable">
          <v-list-item v-for="h in history" :key="h.id">
            <template #prepend>
              <v-icon>mdi-arrow-right-bold</v-icon>
            </template>
            <v-list-item-title>
              <span v-if="h.fromStatus">{{ h.fromStatusLabel || h.fromStatus }} → </span>{{ h.toStatusLabel || h.toStatus }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ formatDate(h.changedAt) }} · {{ h.changedByEmail }}
              <span v-if="h.comment"> · {{ h.comment }}</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>
    </template>

    <v-dialog v-model="transitionDialog" max-width="500">
      <v-card>
        <v-card-title>{{ t('requests.detail.transitionTo', { label: statusLabel(transitionTo) }) }}</v-card-title>
        <v-card-text>
          <v-textarea v-model="transitionComment" :label="t('common.commentOptional')" rows="3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="transitionDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="applyTransition">{{ t('common.apply') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="assignDialog" max-width="540">
      <v-card>
        <v-card-title>{{ t('requests.detail.assignSpecialist') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="specialistInput"
            :items="specialists"
            :loading="loadingSpecialists"
            :item-title="(u: SpecialistOption) => u.fullName ? `${u.fullName} (${u.email})` : u.email"
            item-value="id"
            :label="t('common.specialist')"
            prepend-inner-icon="mdi-account-search-outline"
            :no-data-text="t('common.noData')"
          />
          <v-textarea v-model="assignComment" :label="t('common.commentOptional')" rows="2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="assignDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="!specialistInput" @click="assign">{{ t('requests.detail.assignSpecialist') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="itemDialog" max-width="560">
      <v-card>
        <v-card-title>{{ editingItemId ? t('requests.detail.editItem') : t('requests.detail.newItem') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="itemForm.itemType"
            :items="catalog.state.value.quoteItemTypes"
            item-title="label"
            item-value="code"
            :label="t('common.type')"
          />
          <v-text-field v-model="itemForm.description" :label="t('common.description')" />
          <v-row>
            <v-col cols="6">
              <v-text-field v-model.number="itemForm.hours" :label="t('common.hours')" type="number" step="0.25" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model.number="itemForm.hourlyRate" :label="t('common.hourlyRate')" type="number" />
            </v-col>
          </v-row>
          <v-text-field v-model.number="itemForm.position" label="Posición" type="number" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="itemDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="saveItem">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="rejectDialog" max-width="500">
      <v-card>
        <v-card-title>{{ t('requests.detail.rejectQuote') }}</v-card-title>
        <v-card-text>
          <v-textarea v-model="rejectReason" :label="t('common.reasonOptional')" rows="3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejectDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" @click="rejectQuote">{{ t('requests.detail.reject') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
