<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

type SubmissionStatus = 'PENDING' | 'AWAITING_CLARIFICATION' | 'BUDGETED' | 'ACCEPTED' | 'REJECTED'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type Severity = 'TRIVIAL' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER'
type ItemType = 'SCOPING' | 'EXECUTION' | 'REVIEW' | 'INFRASTRUCTURE'

interface ScopeFeature {
  id: string
  moduleName: string
  featureName: string
  featureDescription: string | null
  acceptanceCriteria: string | null
  priority: Priority
  priorityLabel: string
  severity: Severity
  severityLabel: string
  position: number
}

interface BudgetItem {
  id: string
  itemType: ItemType
  itemTypeLabel: string
  description: string
  hours: number
  hourlyRate: number
  amount: number
  position: number
}

interface SubmissionDto {
  id: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  projectName: string
  projectDescription: string | null
  scopeNotes: string | null
  status: SubmissionStatus
  statusLabel: string
  adminNotes: string | null
  budgetCurrency: string | null
  acceptedCompanyName: string | null
  acceptedPaisId: string | null
  acceptedTestTypeCode: string | null
  generatedCompaniaId: string | null
  generatedProjectId: string | null
  generatedUserId: string | null
  generatedTestRequestId: string | null
  generatedQuoteId: string | null
  rejectionReason: string | null
  submittedAt: string
  decidedAt: string | null
  totalBudgetAmount: number
  totalBudgetHours: number
  budgetItems: BudgetItem[]
  scopeFeatures: ScopeFeature[]
}

interface PaisDto { id: string; nombre: string; codigoIso: string }
interface TestTypeDto { id: string; code: string; name: string }
interface EnvironmentDto { id: string; code: string; name: string }
interface UserSummary { id: string; email: string; fullName: string; roles: string[]; roleLabels: string[]; enabled: boolean }
interface AcceptResult {
  submissionId: string
  userEmail: string
  generatedPassword: string | null
  companiaId: string
  projectId: string
  testRequestId: string
  quoteId: string
  mailDelivered: boolean
}

const api = useApi()
const auth = useAuthStore()
const route = useRoute()
const id = computed(() => String(route.params.id))

const sub = ref<SubmissionDto | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const paises = ref<PaisDto[]>([])
const testTypes = ref<TestTypeDto[]>([])
const environments = ref<EnvironmentDto[]>([])
const specialists = ref<UserSummary[]>([])

const acceptDialog = ref(false)
const rejectDialog = ref(false)
const acceptResult = ref<AcceptResult | null>(null)
const acceptForm = reactive({
  paisId: '',
  companyName: '',
  testTypeCode: 'FUNCTIONAL',
  environmentCode: '',
  assignedSpecialistId: ''
})
const rejectForm = reactive({ reason: '' })

const { t } = useI18n()
useHead({ title: () => sub.value ? `${sub.value.projectName} — ${t('common.appName')}` : `${t('admin.submissions.title')} — ${t('common.appName')}` })

async function load() {
  loading.value = true
  error.value = null
  try {
    sub.value = await api.get<SubmissionDto>(`/submissions/${id.value}`)
    if (sub.value) {
      acceptForm.companyName = sub.value.acceptedCompanyName || sub.value.projectName
    }
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo cargar la submission'
  } finally {
    loading.value = false
  }
}

async function loadCatalogs() {
  try {
    const [ps, tts, envs] = await Promise.all([
      api.get<PaisDto[]>('/public/countries'),
      api.get<TestTypeDto[]>('/test-types'),
      api.get<EnvironmentDto[]>('/environments')
    ])
    paises.value = ps
    testTypes.value = tts
    environments.value = envs
    if (ps.length && !acceptForm.paisId) acceptForm.paisId = ps[0].id
  } catch { /* el admin de submissions sin estos catálogos no acepta, ok */ }
  if (auth.isAdmin) {
    try {
      const all = await api.get<UserSummary[]>('/admin/users')
      specialists.value = all.filter(u => u.roles.includes('ROLE_ESPECIALISTA') && u.enabled)
    } catch { /* opcional */ }
  }
}

onMounted(async () => {
  await load()
  await loadCatalogs()
})

// ---------- Scope features ----------

const newFeature = reactive({
  moduleName: '',
  featureName: '',
  featureDescription: '',
  acceptanceCriteria: '',
  priority: 'MEDIUM' as Priority,
  severity: 'MINOR' as Severity
})

async function addFeature() {
  if (!newFeature.moduleName.trim() || !newFeature.featureName.trim()) return
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/scope-features`, {
      moduleName: newFeature.moduleName.trim(),
      featureName: newFeature.featureName.trim(),
      featureDescription: newFeature.featureDescription || null,
      acceptanceCriteria: newFeature.acceptanceCriteria || null,
      priority: newFeature.priority,
      severity: newFeature.severity,
      position: sub.value?.scopeFeatures.length ?? 0
    })
    Object.assign(newFeature, { moduleName: newFeature.moduleName, featureName: '', featureDescription: '', acceptanceCriteria: '' })
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo agregar la feature'
  } finally {
    saving.value = false
  }
}

async function removeFeature(featureId: string) {
  saving.value = true
  try {
    await api.del(`/submissions/${id.value}/scope-features/${featureId}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo eliminar'
  } finally {
    saving.value = false
  }
}

// ---------- Budget items ----------

const hoursPerDay = 8

const newItem = reactive({
  itemType: 'EXECUTION' as ItemType,
  description: '',
  days: 1,
  hourlyRate: 0
})

const newItemHours = computed(() => +(newItem.days * hoursPerDay).toFixed(2))
const newItemAmount = computed(() => +(newItemHours.value * (newItem.hourlyRate || 0)).toFixed(2))

async function addItem() {
  if (!newItem.description.trim() || newItem.days <= 0) return
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/budget-items`, {
      itemType: newItem.itemType,
      description: newItem.description.trim(),
      days: newItem.days,
      hourlyRate: newItem.hourlyRate > 0 ? newItem.hourlyRate : null,
      position: sub.value?.budgetItems.length ?? 0
    })
    Object.assign(newItem, { description: '', days: 1 })
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo agregar el item'
  } finally {
    saving.value = false
  }
}

async function removeItem(itemId: string) {
  saving.value = true
  try {
    await api.del(`/submissions/${id.value}/budget-items/${itemId}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo eliminar'
  } finally {
    saving.value = false
  }
}

// ---------- Transiciones ----------

async function transition(status: SubmissionStatus, adminNotes?: string) {
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/transitions`, { status, adminNotes: adminNotes || null })
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo transicionar'
  } finally {
    saving.value = false
  }
}

async function markBudgeted() {
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/mark-budgeted`)
    success.value = 'Presupuesto marcado como enviado'
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo marcar como presupuestada'
  } finally {
    saving.value = false
  }
}

async function accept() {
  saving.value = true
  try {
    const res = await api.post<AcceptResult>(`/submissions/${id.value}/accept`, {
      paisId: acceptForm.paisId,
      companyName: acceptForm.companyName,
      testTypeCode: acceptForm.testTypeCode,
      environmentCode: acceptForm.environmentCode || null,
      assignedSpecialistId: acceptForm.assignedSpecialistId || null,
      clientPassword: null
    })
    acceptResult.value = res
    acceptDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo aceptar'
  } finally {
    saving.value = false
  }
}

async function reject() {
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/reject`, { reason: rejectForm.reason })
    rejectDialog.value = false
    rejectForm.reason = ''
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo rechazar'
  } finally {
    saving.value = false
  }
}

// ---------- helpers ----------

const statusColor: Record<SubmissionStatus, string> = {
  PENDING: 'info',
  AWAITING_CLARIFICATION: 'warning',
  BUDGETED: 'primary',
  ACCEPTED: 'success',
  REJECTED: 'error'
}

const isEditable = computed(() => sub.value && sub.value.status !== 'ACCEPTED' && sub.value.status !== 'REJECTED')
const canMarkBudgeted = computed(() =>
  sub.value && (sub.value.status === 'PENDING' || sub.value.status === 'AWAITING_CLARIFICATION')
  && sub.value.scopeFeatures.length > 0 && sub.value.budgetItems.length > 0
)
const canAccept = computed(() => sub.value?.status === 'BUDGETED' && auth.isAdmin)

function fmtMoney(n: number, ccy = 'CLP') {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: ccy, maximumFractionDigits: 0 }).format(n)
}
</script>

<template>
  <v-container class="py-8" max-width="1280">
    <v-btn variant="text" to="/admin/submissions" prepend-icon="mdi-arrow-left" class="mb-4">
      {{ t('admin.submissions.detail.back') }}
    </v-btn>

    <div v-if="loading" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>
    <v-alert v-if="success" type="success" variant="tonal" class="mb-4" closable @click:close="success = null">
      {{ success }}
    </v-alert>

    <template v-if="sub">
      <!-- Header -->
      <v-card variant="outlined" class="pa-6 mb-6">
        <div class="d-flex align-start flex-wrap ga-4">
          <div class="flex-grow-1">
            <span class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.header', { id: sub.id.slice(0, 8) }) }}</span>
            <h1 class="text-h4 font-weight-bold mb-2">{{ sub.projectName }}</h1>
            <p class="text-body-2 text-medium-emphasis mb-0">
              {{ sub.projectDescription || t('common.emptyDash') }}
            </p>
          </div>
          <v-chip
            :color="statusColor[sub.status]"
            size="large"
            variant="tonal"
            class=""
          >
            {{ sub.statusLabel || sub.status }}
          </v-chip>
        </div>

        <v-divider class="my-4" />

        <v-row no-gutters>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.contact') }}</div>
            <div class="text-body-2">{{ sub.contactName }}</div>
            <div class="font-mono text-caption">{{ sub.contactEmail }}</div>
            <div v-if="sub.contactPhone" class="font-mono text-caption">{{ sub.contactPhone }}</div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.dates') }}</div>
            <div class="text-caption">
              {{ t('admin.submissions.detail.received') }}: <span class="font-mono">{{ new Date(sub.submittedAt).toLocaleString() }}</span>
            </div>
            <div v-if="sub.decidedAt" class="text-caption">
              {{ t('admin.submissions.detail.decided') }}: <span class="font-mono">{{ new Date(sub.decidedAt).toLocaleString() }}</span>
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.totals') }}</div>
            <div class="font-mono">
              {{ sub.totalBudgetHours }} h • {{ fmtMoney(sub.totalBudgetAmount, sub.budgetCurrency || 'CLP') }}
            </div>
          </v-col>
        </v-row>

        <div v-if="sub.scopeNotes" class="mt-4">
          <div class="text-overline text-medium-emphasis mb-1">{{ t('admin.submissions.detail.clientNotes') }}</div>
          <div class="text-body-2" style="white-space: pre-wrap">{{ sub.scopeNotes }}</div>
        </div>

        <div v-if="sub.status === 'ACCEPTED' && sub.generatedTestRequestId" class="mt-5">
          <v-btn
            :to="`/requests/${sub.generatedTestRequestId}`"
            color="primary"
            prepend-icon="mdi-clipboard-check-outline"
          >
            {{ t('admin.submissions.detail.viewRequest') }}
          </v-btn>
        </div>

        <div v-if="sub.status === 'REJECTED' && sub.rejectionReason" class="mt-4">
          <v-alert type="error" variant="tonal" density="compact">
            {{ t('admin.submissions.detail.rejectReason', { reason: sub.rejectionReason }) }}
          </v-alert>
        </div>
      </v-card>

      <!-- Scope features -->
      <v-card variant="outlined" class="pa-6 mb-6">
        <div class="d-flex align-center mb-4">
          <span class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.scopeSection') }}</span>
          <v-spacer />
          <span class="font-mono text-caption">{{ t('admin.submissions.detail.scopeCount', { count: sub.scopeFeatures.length }) }}</span>
        </div>

        <v-table v-if="sub.scopeFeatures.length" density="comfortable" class="mb-4">
          <thead>
            <tr>
              <th>{{ t('admin.submissions.detail.module') }}</th>
              <th>{{ t('common.feature') }}</th>
              <th>{{ t('common.priority') }}</th>
              <th>{{ t('common.severity') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in sub.scopeFeatures" :key="f.id">
              <td class="font-mono">{{ f.moduleName }}</td>
              <td>
                <div>{{ f.featureName }}</div>
                <div v-if="f.featureDescription" class="text-caption text-medium-emphasis">{{ f.featureDescription }}</div>
              </td>
              <td><v-chip size="x-small" variant="tonal" class="">{{ f.priorityLabel || f.priority }}</v-chip></td>
              <td><v-chip size="x-small" variant="tonal" class="">{{ f.severityLabel || f.severity }}</v-chip></td>
              <td class="text-end">
                <v-btn v-if="isEditable" icon="mdi-delete-outline" size="small" variant="text" @click="removeFeature(f.id)" />
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-body-2 text-medium-emphasis mb-4">
          {{ t('admin.submissions.detail.noScope') }}
        </p>

        <v-divider v-if="isEditable" class="my-4" />

        <div v-if="isEditable">
          <div class="text-overline text-medium-emphasis mb-2">{{ t('admin.submissions.detail.addFeature') }}</div>
          <v-row no-gutters>
            <v-col cols="12" md="3">
              <v-text-field v-model="newFeature.moduleName" :label="t('admin.submissions.detail.module')" density="compact" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="newFeature.featureName" :label="t('common.feature')" density="compact" />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field v-model="newFeature.featureDescription" :label="t('common.description')" density="compact" />
            </v-col>
            <v-col cols="6" md="1">
              <v-select v-model="newFeature.priority" :items="['LOW','MEDIUM','HIGH','CRITICAL']" :label="t('common.priority')" density="compact" />
            </v-col>
            <v-col cols="6" md="1" class="d-flex align-center">
              <v-btn color="primary" :loading="saving" icon="mdi-plus" @click="addFeature" />
            </v-col>
          </v-row>
        </div>
      </v-card>

      <!-- Budget items -->
      <v-card variant="outlined" class="pa-6 mb-6">
        <div class="d-flex align-center mb-4">
          <span class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.budgetSection') }}</span>
          <v-spacer />
          <span class="font-mono text-caption">
            {{ t('admin.submissions.detail.budgetTotal', { hours: sub.totalBudgetHours, amount: fmtMoney(sub.totalBudgetAmount, sub.budgetCurrency || 'CLP') }) }}
          </span>
        </div>

        <v-table v-if="sub.budgetItems.length" density="comfortable" class="mb-4">
          <thead>
            <tr>
              <th>{{ t('common.type') }}</th>
              <th>{{ t('common.description') }}</th>
              <th class="text-end">{{ t('common.hours') }}</th>
              <th class="text-end">{{ t('common.hourlyRate') }}</th>
              <th class="text-end">{{ t('common.amount') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in sub.budgetItems" :key="i.id">
              <td><v-chip size="x-small" class="">{{ i.itemTypeLabel || i.itemType }}</v-chip></td>
              <td>{{ i.description }}</td>
              <td class="text-end font-mono">{{ i.hours }}</td>
              <td class="text-end font-mono">{{ fmtMoney(i.hourlyRate, sub.budgetCurrency || 'CLP') }}</td>
              <td class="text-end font-mono">{{ fmtMoney(i.amount, sub.budgetCurrency || 'CLP') }}</td>
              <td class="text-end">
                <v-btn v-if="isEditable" icon="mdi-delete-outline" size="small" variant="text" @click="removeItem(i.id)" />
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-body-2 text-medium-emphasis mb-4">
          {{ t('admin.submissions.detail.noBudget') }}
        </p>

        <v-divider v-if="isEditable" class="my-4" />

        <div v-if="isEditable">
          <div class="text-overline text-medium-emphasis mb-2">{{ t('admin.submissions.detail.addItem') }}</div>
          <v-row no-gutters>
            <v-col cols="6" md="2">
              <v-select
                v-model="newItem.itemType"
                :items="['SCOPING','EXECUTION','REVIEW','INFRASTRUCTURE']"
                :label="t('common.type')"
                density="compact"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="newItem.description" :label="t('common.description')" density="compact" />
            </v-col>
            <v-col cols="4" md="1">
              <v-text-field v-model.number="newItem.days" :label="t('common.days')" type="number" min="0.5" step="0.5" density="compact" />
            </v-col>
            <v-col cols="4" md="2">
              <v-text-field
                v-model.number="newItem.hourlyRate"
                :label="t('common.hourlyRate')"
                type="number"
                density="compact"
              />
            </v-col>
            <v-col cols="4" md="2">
              <v-text-field
                :model-value="`${newItemHours} h / ${fmtMoney(newItemAmount, sub.budgetCurrency || 'CLP')}`"
                label="Cálculo"
                readonly
                density="compact"
              />
            </v-col>
            <v-col cols="12" md="1" class="d-flex align-center">
              <v-btn color="primary" :loading="saving" icon="mdi-plus" @click="addItem" />
            </v-col>
          </v-row>
        </div>
      </v-card>

      <!-- Acciones -->
      <v-card variant="outlined" class="pa-6 mb-6">
        <div class="text-overline text-medium-emphasis mb-3">{{ t('admin.submissions.detail.flowSection') }}</div>

        <div class="d-flex flex-wrap ga-3">
          <v-btn
            v-if="sub.status === 'PENDING'"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-search-web"
            :loading="saving"
            @click="transition('AWAITING_CLARIFICATION')"
          >
            {{ t('admin.submissions.detail.toScoping') }}
          </v-btn>
          <v-btn
            v-if="canMarkBudgeted"
            color="primary"
            prepend-icon="mdi-send-check-outline"
            :loading="saving"
            @click="markBudgeted"
          >
            {{ t('admin.submissions.detail.sendBudget') }}
          </v-btn>
          <v-btn
            v-if="canAccept"
            color="success"
            prepend-icon="mdi-check-circle-outline"
            @click="acceptDialog = true"
          >
            {{ t('admin.submissions.detail.acceptBudget') }}
          </v-btn>
          <v-btn
            v-if="isEditable"
            color="error"
            variant="outlined"
            prepend-icon="mdi-close-octagon-outline"
            @click="rejectDialog = true"
          >
            {{ t('admin.submissions.detail.reject') }}
          </v-btn>
        </div>
      </v-card>
    </template>

    <!-- Accept dialog -->
    <v-dialog v-model="acceptDialog" max-width="560">
      <v-card variant="outlined">
        <v-card-title class="text-h5 font-weight-bold">{{ t('admin.submissions.detail.acceptDialog.title') }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ t('admin.submissions.detail.acceptDialog.description') }}
          </p>
          <v-text-field v-model="acceptForm.companyName" :label="t('admin.submissions.detail.acceptDialog.companyName')" />
          <v-select
            v-model="acceptForm.paisId"
            :items="paises"
            item-title="nombre"
            item-value="id"
            :label="t('admin.submissions.detail.acceptDialog.country')"
          />
          <v-select
            v-model="acceptForm.testTypeCode"
            :items="testTypes"
            item-title="name"
            item-value="code"
            :label="t('admin.submissions.detail.acceptDialog.testType')"
          />
          <v-select
            v-model="acceptForm.environmentCode"
            :items="[{ code: '', name: '— ' + t('common.optional') + ' —' }, ...environments]"
            item-title="name"
            item-value="code"
            :label="t('admin.submissions.detail.acceptDialog.environment')"
          />
          <v-select
            v-model="acceptForm.assignedSpecialistId"
            :items="[{ id: '', email: '— ' + t('common.optional') + ' —', fullName: '' }, ...specialists]"
            :item-title="(u: any) => u.fullName ? `${u.fullName} (${u.email})` : u.email"
            item-value="id"
            :label="t('admin.submissions.detail.acceptDialog.assignedSpecialist')"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="acceptDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="success" :loading="saving" @click="accept">{{ t('admin.submissions.detail.acceptDialog.confirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reject dialog -->
    <v-dialog v-model="rejectDialog" max-width="500">
      <v-card variant="outlined">
        <v-card-title class="text-h5 font-weight-bold">{{ t('admin.submissions.detail.rejectDialog.title') }}</v-card-title>
        <v-card-text>
          <v-textarea v-model="rejectForm.reason" :label="t('admin.submissions.detail.rejectDialog.reason')" rows="3" auto-grow />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejectDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" :loading="saving" :disabled="!rejectForm.reason.trim()" @click="reject">
            {{ t('admin.submissions.detail.reject') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Result dialog -->
    <v-dialog :model-value="!!acceptResult" max-width="600" @update:model-value="(v) => !v && (acceptResult = null)">
      <v-card v-if="acceptResult" class="">
        <v-card-title class="text-h5 font-weight-bold">
          <v-icon color="success" class="me-2">mdi-check-decagram</v-icon>
          {{ t('admin.submissions.detail.result.title') }}
        </v-card-title>
        <v-card-text>
          <p class="mb-3">{{ t('admin.submissions.detail.result.body') }}</p>
          <div class="font-mono text-caption mb-2">
            {{ t('admin.submissions.detail.result.user') }} <span class="text-primary">{{ acceptResult.userEmail }}</span>
          </div>
          <v-alert
            v-if="acceptResult.generatedPassword"
            type="warning"
            variant="tonal"
            class="mb-3"
          >
            {{ t('admin.submissions.detail.result.manualPassword') }}
            <div class="font-mono mt-2" style="font-size: 1.1em">{{ acceptResult.generatedPassword }}</div>
          </v-alert>
          <v-alert v-else type="success" variant="tonal" class="mb-3" density="compact">
            {{ t('admin.submissions.detail.result.emailSent') }}
          </v-alert>
          <div class="font-mono text-caption">{{ t('admin.submissions.detail.result.testRequest') }} {{ acceptResult.testRequestId }}</div>
          <div class="font-mono text-caption">{{ t('admin.submissions.detail.result.quote') }} {{ acceptResult.quoteId }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="acceptResult = null">{{ t('common.close') }}</v-btn>
          <v-spacer />
          <v-btn color="primary" :to="`/requests/${acceptResult.testRequestId}`" prepend-icon="mdi-arrow-right">
            {{ t('admin.submissions.detail.result.goToRequest') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
