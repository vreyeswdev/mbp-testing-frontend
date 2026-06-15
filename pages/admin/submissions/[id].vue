<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

type SubmissionStatus = 'PENDING' | 'AWAITING_CLARIFICATION' | 'BUDGETED' | 'NEGOTIATING' | 'AGREED' | 'AWAITING_PAYMENT' | 'ACCEPTED' | 'REJECTED'
type PaymentStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID'
type CommentParty = 'CLIENT' | 'INTERNAL'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type Severity = 'TRIVIAL' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER'
type ItemType = 'SCOPING' | 'EXECUTION' | 'REVIEW' | 'INFRASTRUCTURE'
type AutoScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
type ScopeFeatureSource = 'MANUAL' | 'AUTO'

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
  source: ScopeFeatureSource
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

interface SubmissionComment {
  id: string
  authorParty: CommentParty
  authorUserId: string | null
  authorDisplayName: string
  body: string
  createdAt: string
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
  websiteUrl: string | null
  autoScanStatus: AutoScanStatus | null
  autoScanStartedAt: string | null
  autoScanFinishedAt: string | null
  autoScanResult: Record<string, unknown> | null
  autoScanError: string | null
  publicToken: string | null
  companyName: string | null
  masterUserEmail: string | null
  requestedTestTypeCode: string | null
  requestedEnvironmentCode: string | null
  assignedSpecialistId: string | null
  assignedSpecialistEmail: string | null
  clientAgreedAt: string | null
  internalAgreedAt: string | null
  agreedAt: string | null
  paymentStatus: PaymentStatus
  paymentStatusLabel: string
  paymentReference: string | null
  paidAt: string | null
  comments: SubmissionComment[]
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

// // Polling del auto-scan: refresca cada 5s mientras está PENDING/RUNNING
// const scanPoll = ref<ReturnType<typeof setInterval> | null>(null)
// function startScanPolling() {
//   stopScanPolling()
//   scanPoll.value = setInterval(async () => {
//     if (!sub.value) return
//     const st = sub.value.autoScanStatus
//     if (st !== 'PENDING' && st !== 'RUNNING') {
//       stopScanPolling()
//       return
//     }
//     await load()
//   }, 5000)
// }
// function stopScanPolling() {
//   if (scanPoll.value) {
//     clearInterval(scanPoll.value)
//     scanPoll.value = null
//   }
// }

// watch(() => sub.value?.autoScanStatus, (st) => {
//   if (st === 'PENDING' || st === 'RUNNING') startScanPolling()
//   else stopScanPolling()
// })

// onBeforeUnmount(() => stopScanPolling())

async function rescan() {
  if (!sub.value) return
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/rescan`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo iniciar el re-escaneo'
  } finally {
    saving.value = false
  }
}

const autoScanCount = computed(() => {
  const raw = sub.value?.autoScanResult as any
  const list = raw?.funcionalidades_visibles
  return Array.isArray(list) ? list.length : 0
})

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

const itemTypeOptions: { value: ItemType; title: string }[] = [
  { value: 'SCOPING', title: 'Relevamiento' },
  { value: 'EXECUTION', title: 'Ejecución' },
  { value: 'REVIEW', title: 'Revisión' },
  { value: 'INFRASTRUCTURE', title: 'Infraestructura' }
]

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

const editItemDialog = ref(false)
const editItemForm = reactive({
  id: '',
  itemType: 'EXECUTION' as ItemType,
  description: '',
  days: 1,
  hourlyRate: 0,
  position: 0
})
const editItemHours = computed(() => +(editItemForm.days * hoursPerDay).toFixed(2))
const editItemAmount = computed(() => +(editItemHours.value * (editItemForm.hourlyRate || 0)).toFixed(2))

function openEditItem(i: BudgetItem) {
  editItemForm.id = i.id
  editItemForm.itemType = i.itemType
  editItemForm.description = i.description
  editItemForm.days = +(i.hours / hoursPerDay).toFixed(2)
  editItemForm.hourlyRate = i.hourlyRate
  editItemForm.position = i.position
  editItemDialog.value = true
}

async function saveEditItem() {
  if (!editItemForm.description.trim() || editItemForm.days <= 0) return
  saving.value = true
  try {
    await api.put(`/submissions/${id.value}/budget-items/${editItemForm.id}`, {
      itemType: editItemForm.itemType,
      description: editItemForm.description.trim(),
      days: editItemForm.days,
      hourlyRate: editItemForm.hourlyRate > 0 ? editItemForm.hourlyRate : null,
      position: editItemForm.position
    })
    editItemDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo actualizar el item'
  } finally {
    saving.value = false
  }
}

async function addFeatureToBudget(f: ScopeFeature) {
  saving.value = true
  try {
    const desc = f.featureDescription
      ? `${f.moduleName} — ${f.featureName} (${f.featureDescription})`
      : `${f.moduleName} — ${f.featureName}`
    await api.post(`/submissions/${id.value}/budget-items`, {
      itemType: 'EXECUTION',
      description: desc.slice(0, 500),
      days: 1,
      hourlyRate: null,
      position: sub.value?.budgetItems.length ?? 0
    })
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo agregar al presupuesto'
  } finally {
    saving.value = false
  }
}

async function generateBudgetFromScope() {
  if (!sub.value) return
  if (sub.value.scopeFeatures.length === 0) return
  if (!confirm(`Vamos a generar ${sub.value.scopeFeatures.length} items de tipo "Ejecución" (1 día c/u). Podrás editarlos después. ¿Continuar?`)) return
  saving.value = true
  try {
    let position = sub.value.budgetItems.length
    for (const f of sub.value.scopeFeatures) {
      const desc = f.featureDescription
        ? `${f.moduleName} — ${f.featureName} (${f.featureDescription})`
        : `${f.moduleName} — ${f.featureName}`
      await api.post(`/submissions/${id.value}/budget-items`, {
        itemType: 'EXECUTION',
        description: desc.slice(0, 500),
        days: 1,
        hourlyRate: null,
        position: position++
      })
    }
    success.value = `Generamos ${sub.value.scopeFeatures.length} items en el presupuesto`
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo generar el presupuesto'
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

// ---------- Negociación / claim / acuerdo / comentarios ----------

async function claim() {
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/claim`)
    success.value = 'Quedaste asignado a la solicitud'
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo tomar la solicitud'
  } finally {
    saving.value = false
  }
}

async function internalAgree() {
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/internal-agree`)
    success.value = 'Acuerdo interno registrado'
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo marcar el acuerdo'
  } finally {
    saving.value = false
  }
}

const newComment = ref('')
async function postComment() {
  if (!newComment.value.trim()) return
  saving.value = true
  try {
    await api.post(`/submissions/${id.value}/comments`, { body: newComment.value.trim() })
    newComment.value = ''
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo enviar el comentario'
  } finally {
    saving.value = false
  }
}

const publicShareUrl = computed(() => {
  if (!sub.value?.publicToken) return null
  if (typeof window === 'undefined') return null
  return `${window.location.origin}/solicitud/${sub.value.publicToken}`
})

async function copyPublicLink() {
  if (!publicShareUrl.value) return
  try {
    await navigator.clipboard.writeText(publicShareUrl.value)
    success.value = 'Link público copiado'
  } catch {
    error.value = 'No se pudo copiar el link'
  }
}

// ---------- helpers ----------

const statusColor: Record<SubmissionStatus, string> = {
  PENDING: 'info',
  AWAITING_CLARIFICATION: 'warning',
  BUDGETED: 'primary',
  NEGOTIATING: 'accent',
  AGREED: 'success',
  AWAITING_PAYMENT: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'error'
}

const isEditable = computed(() => sub.value && sub.value.status !== 'ACCEPTED' && sub.value.status !== 'REJECTED')
const canMarkBudgeted = computed(() =>
  sub.value
  && (sub.value.status === 'PENDING' || sub.value.status === 'AWAITING_CLARIFICATION' || sub.value.status === 'NEGOTIATING')
  && sub.value.scopeFeatures.length > 0 && sub.value.budgetItems.length > 0
)
const canAccept = computed(() => sub.value?.status === 'BUDGETED' && auth.isAdmin)
const canClaim = computed(() => sub.value && !sub.value.assignedSpecialistId && sub.value.status !== 'ACCEPTED' && sub.value.status !== 'REJECTED')
const canInternalAgree = computed(() => {
  if (!sub.value) return false
  if (sub.value.internalAgreedAt) return false
  if (sub.value.budgetItems.length === 0) return false
  return sub.value.status === 'BUDGETED' || sub.value.status === 'NEGOTIATING'
})

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

        <v-divider class="my-4" />

        <v-row dense>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Compañía declarada</div>
            <div class="text-body-2">{{ sub.companyName || '—' }}</div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Cuenta maestra</div>
            <div class="text-body-2 font-mono">{{ sub.masterUserEmail || sub.contactEmail }}</div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">QA / ambiente</div>
            <div class="text-body-2">
              {{ sub.requestedTestTypeCode || '—' }}<span v-if="sub.requestedEnvironmentCode"> · {{ sub.requestedEnvironmentCode }}</span>
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Especialista asignado</div>
            <div class="text-body-2">{{ sub.assignedSpecialistEmail || '—' }}</div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Acuerdo</div>
            <div class="text-caption">
              Cliente: <span :class="sub.clientAgreedAt ? 'text-success' : 'text-medium-emphasis'">{{ sub.clientAgreedAt ? '✓ ' + new Date(sub.clientAgreedAt).toLocaleString() : 'pendiente' }}</span>
            </div>
            <div class="text-caption">
              Interno: <span :class="sub.internalAgreedAt ? 'text-success' : 'text-medium-emphasis'">{{ sub.internalAgreedAt ? '✓ ' + new Date(sub.internalAgreedAt).toLocaleString() : 'pendiente' }}</span>
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-overline text-medium-emphasis">Pago</div>
            <div class="text-body-2">
              <v-chip size="small" :color="sub.paymentStatus === 'PAID' ? 'success' : sub.paymentStatus === 'PENDING' ? 'warning' : 'default'" variant="tonal">
                {{ sub.paymentStatusLabel || sub.paymentStatus }}
              </v-chip>
              <span v-if="sub.paymentReference" class="ms-2 font-mono text-caption">{{ sub.paymentReference }}</span>
            </div>
            <div v-if="sub.paidAt" class="text-caption font-mono">{{ new Date(sub.paidAt).toLocaleString() }}</div>
          </v-col>
        </v-row>

        <v-divider v-if="publicShareUrl" class="my-4" />

        <div v-if="publicShareUrl" class="d-flex align-center ga-2 flex-wrap">
          <v-icon size="18" color="medium-emphasis">mdi-link-variant</v-icon>
          <span class="text-caption text-medium-emphasis">Link público del cliente</span>
          <a :href="publicShareUrl" target="_blank" rel="noopener" class="font-mono text-caption text-decoration-none text-truncate" style="max-width: 480px;">{{ publicShareUrl }}</a>
          <v-btn size="x-small" variant="text" prepend-icon="mdi-content-copy" @click="copyPublicLink">
            Copiar
          </v-btn>
        </div>
      </v-card>

      <!-- Auto-scan -->
      <v-card v-if="sub.websiteUrl" variant="outlined" class="pa-6 mb-6">
        <div class="d-flex align-center mb-3">
          <v-icon color="accent" class="me-2">mdi-magnify-scan</v-icon>
          <span class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.autoScan.section') }}</span>
          <v-spacer />
          <a :href="sub.websiteUrl" target="_blank" rel="noopener" class="font-mono text-caption text-decoration-none">
            {{ sub.websiteUrl }} <v-icon size="14">mdi-open-in-new</v-icon>
          </a>
        </div>
        <div class="d-flex align-center mb-2 flex-wrap ga-2">
          <v-chip size="small" color="accent" variant="tonal" prepend-icon="mdi-robot-happy-outline">
            {{ t('admin.submissions.detail.autoScan.completedHint', { count: autoScanCount }) }}
          </v-chip>
          <v-spacer />
          <v-btn size="small" variant="text" :loading="saving" prepend-icon="mdi-refresh" @click="rescan">
            {{ t('admin.submissions.detail.autoScan.retry') }}
          </v-btn>
        </div>
        <v-expansion-panels variant="accordion" class="auto-scan-raw">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2" size="18">mdi-code-json</v-icon>
              {{ t('admin.submissions.detail.autoScan.viewRaw') }}
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <pre class="auto-scan-json">{{ JSON.stringify(sub.autoScanResult, null, 2) }}</pre>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card>
      <!-- <v-card v-if="sub.websiteUrl" variant="outlined" class="pa-6 mb-6">
        <div class="d-flex align-center mb-3">
          <v-icon color="accent" class="me-2">mdi-magnify-scan</v-icon>
          <span class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.autoScan.section') }}</span>
          <v-spacer />
          <a :href="sub.websiteUrl" target="_blank" rel="noopener" class="font-mono text-caption text-decoration-none">
            {{ sub.websiteUrl }} <v-icon size="14">mdi-open-in-new</v-icon>
          </a>
        </div>

        <v-alert
          v-if="sub.autoScanStatus === 'PENDING' || sub.autoScanStatus === 'RUNNING'"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          <div class="d-flex align-center ga-3">
            <v-progress-circular indeterminate size="20" width="2" />
            <span>{{ t('admin.submissions.detail.autoScan.pending') }}</span>
          </div>
        </v-alert>

        <v-alert
          v-else-if="sub.autoScanStatus === 'FAILED'"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          <div class="d-flex align-center ga-3 flex-wrap">
            <span>{{ t('admin.submissions.detail.autoScan.failed', { error: sub.autoScanError || '—' }) }}</span>
            <v-spacer />
            <v-btn size="small" variant="text" :loading="saving" prepend-icon="mdi-refresh" @click="rescan">
              {{ t('admin.submissions.detail.autoScan.retry') }}
            </v-btn>
          </div>
        </v-alert>

        <template v-else-if="sub.autoScanStatus === 'COMPLETED'">
          <div class="d-flex align-center mb-2 flex-wrap ga-2">
            <v-chip size="small" color="accent" variant="tonal" prepend-icon="mdi-robot-happy-outline">
              {{ t('admin.submissions.detail.autoScan.completedHint', { count: autoScanCount }) }}
            </v-chip>
            <v-spacer />
            <v-btn size="small" variant="text" :loading="saving" prepend-icon="mdi-refresh" @click="rescan">
              {{ t('admin.submissions.detail.autoScan.retry') }}
            </v-btn>
          </div>
          <v-expansion-panels variant="accordion" class="auto-scan-raw">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="me-2" size="18">mdi-code-json</v-icon>
                {{ t('admin.submissions.detail.autoScan.viewRaw') }}
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <pre class="auto-scan-json">{{ JSON.stringify(sub.autoScanResult, null, 2) }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>

        <div v-else class="d-flex align-center ga-3 flex-wrap">
          <span class="text-body-2 text-medium-emphasis">
            El sitio aún no se ha analizado.
          </span>
          <v-spacer />
          <v-btn size="small" color="accent" variant="tonal" :loading="saving" prepend-icon="mdi-magnify-scan" @click="rescan">
            Escanear ahora
          </v-btn>
        </div>
      </v-card> -->

      <!-- Scope features -->
      <v-card variant="outlined" class="pa-6 mb-6">
        <div class="d-flex align-center mb-4 flex-wrap ga-2">
          <span class="text-overline text-medium-emphasis">{{ t('admin.submissions.detail.scopeSection') }}</span>
          <v-spacer />
          <v-btn
            v-if="isEditable && sub.scopeFeatures.length > 0"
            size="small"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-cash-plus"
            :loading="saving"
            @click="generateBudgetFromScope"
          >
            Pasar todo al presupuesto
          </v-btn>
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
                <div class="d-flex align-center ga-2">
                  <span>{{ f.featureName }}</span>
                  <v-chip
                    v-if="f.source === 'AUTO'"
                    size="x-small"
                    color="accent"
                    variant="tonal"
                    prepend-icon="mdi-robot-happy-outline"
                  >
                    {{ t('admin.submissions.detail.autoScan.autoBadge') }}
                  </v-chip>
                </div>
                <div v-if="f.featureDescription" class="text-caption text-medium-emphasis">{{ f.featureDescription }}</div>
              </td>
              <td><v-chip size="x-small" variant="tonal" class="">{{ f.priorityLabel || f.priority }}</v-chip></td>
              <td><v-chip size="x-small" variant="tonal" class="">{{ f.severityLabel || f.severity }}</v-chip></td>
              <td class="text-end">
                <v-tooltip text="Agregar como item de presupuesto" location="top">
                  <template #activator="{ props }">
                    <v-btn
                      v-if="isEditable"
                      v-bind="props"
                      icon="mdi-cash-plus"
                      size="small"
                      variant="text"
                      color="primary"
                      :disabled="saving"
                      @click="addFeatureToBudget(f)"
                    />
                  </template>
                </v-tooltip>
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
                <v-btn v-if="isEditable" icon="mdi-pencil-outline" size="small" variant="text" :disabled="saving" @click="openEditItem(i)" />
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
                :items="itemTypeOptions"
                item-title="title"
                item-value="value"
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

      <!-- Comentarios -->
      <v-card variant="outlined" class="pa-6 mb-6">
        <div class="d-flex align-center mb-3">
          <v-icon class="me-2">mdi-message-text-outline</v-icon>
          <span class="text-overline text-medium-emphasis">Comentarios con el cliente</span>
          <v-spacer />
          <span class="font-mono text-caption">{{ sub.comments.length }}</span>
        </div>

        <div v-if="sub.comments.length === 0" class="text-body-2 text-medium-emphasis">
          Sin comentarios aún.
        </div>
        <div v-else class="d-flex flex-column ga-3 mb-3">
          <div v-for="c in sub.comments" :key="c.id" class="submission-comment" :class="{ 'is-client': c.authorParty === 'CLIENT' }">
            <div class="text-caption text-medium-emphasis">
              <strong>{{ c.authorDisplayName }}</strong>
              · <span>{{ c.authorParty === 'CLIENT' ? 'Cliente' : 'Equipo MBP' }}</span>
              · {{ new Date(c.createdAt).toLocaleString() }}
            </div>
            <div class="text-body-2 mt-1" style="white-space: pre-wrap;">{{ c.body }}</div>
          </div>
        </div>

        <v-divider v-if="isEditable" class="my-3" />

        <div v-if="isEditable">
          <v-textarea
            v-model="newComment"
            label="Responder al cliente"
            variant="outlined"
            rows="3"
            auto-grow
            hide-details
          />
          <div class="d-flex justify-end mt-2">
            <v-btn color="primary" variant="flat" :loading="saving" :disabled="!newComment.trim()" prepend-icon="mdi-send" @click="postComment">
              Enviar comentario
            </v-btn>
          </div>
        </div>
      </v-card>

      <!-- Acciones -->
      <v-card variant="outlined" class="pa-6 mb-6">
        <div class="text-overline text-medium-emphasis mb-3">{{ t('admin.submissions.detail.flowSection') }}</div>

        <div class="d-flex flex-wrap ga-3">
          <v-btn
            v-if="canClaim"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-account-arrow-right-outline"
            :loading="saving"
            @click="claim"
          >
            Tomar / Asignarme
          </v-btn>
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
            v-if="canInternalAgree"
            color="success"
            variant="tonal"
            prepend-icon="mdi-handshake-outline"
            :loading="saving"
            @click="internalAgree"
          >
            Marcar acuerdo interno
          </v-btn>
          <v-btn
            v-if="canAccept"
            color="success"
            prepend-icon="mdi-check-circle-outline"
            @click="acceptDialog = true"
          >
            {{ t('admin.submissions.detail.acceptBudget') }} (manual)
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
        <div v-if="sub.status === 'AWAITING_PAYMENT'" class="text-caption text-medium-emphasis mt-3">
          Esperando que el cliente confirme el pago desde el detalle público.
        </div>
      </v-card>
    </template>

    <!-- Edit budget item dialog -->
    <v-dialog v-model="editItemDialog" max-width="640">
      <v-card variant="outlined">
        <v-card-title class="text-h5 font-weight-bold">Editar item de presupuesto</v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" md="4">
              <v-select
                v-model="editItemForm.itemType"
                :items="itemTypeOptions"
                item-title="title"
                item-value="value"
                :label="t('common.type')"
                density="compact"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="editItemForm.description"
                :label="t('common.description')"
                rows="2"
                auto-grow
                density="compact"
              />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field
                v-model.number="editItemForm.days"
                :label="t('common.days')"
                type="number"
                min="0.5"
                step="0.5"
                density="compact"
              />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field
                v-model.number="editItemForm.hourlyRate"
                :label="t('common.hourlyRate')"
                type="number"
                density="compact"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                :model-value="`${editItemHours} h / ${fmtMoney(editItemAmount, sub?.budgetCurrency || 'CLP')}`"
                label="Cálculo"
                readonly
                density="compact"
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editItemDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!editItemForm.description.trim() || editItemForm.days <= 0" @click="saveEditItem">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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

<style scoped>
.auto-scan-json {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  max-height: 360px;
  overflow: auto;
  background: rgba(var(--v-theme-surface-variant), 0.5);
  border-radius: 8px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.submission-comment {
  padding: 12px;
  border-radius: 10px;
  background: rgba(var(--v-theme-surface-variant), 0.18);
  border: 1px solid rgba(var(--v-theme-surface-variant), 0.4);
}
.submission-comment.is-client {
  background: rgba(var(--v-theme-primary), 0.06);
  border-color: rgba(var(--v-theme-primary), 0.3);
}
</style>
