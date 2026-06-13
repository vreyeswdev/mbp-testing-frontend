<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  ssr: false,
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
  severity: Severity
  position: number
}

interface BudgetItem {
  id: string
  itemType: ItemType
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
interface UserSummary { id: string; email: string; fullName: string; roles: string[]; enabled: boolean }
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

useHead({ title: () => sub.value ? `Submission ${sub.value.projectName}` : 'Submission — MBP Testing' })

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
      api.get<PaisDto[]>('/paises'),
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

const statusMeta: Record<SubmissionStatus, { color: string; label: string }> = {
  PENDING: { color: 'info', label: 'Nueva' },
  AWAITING_CLARIFICATION: { color: 'warning', label: 'Scoping' },
  BUDGETED: { color: 'primary', label: 'Presupuesto enviado' },
  ACCEPTED: { color: 'success', label: 'Aceptada' },
  REJECTED: { color: 'error', label: 'Rechazada' }
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
      Volver al listado
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
      <v-card class="cyber-card pa-6 mb-6">
        <div class="d-flex align-start flex-wrap ga-4">
          <div class="flex-grow-1">
            <span class="cyber-subtitle">// submission #{{ sub.id.slice(0, 8) }}</span>
            <h1 class="text-h4 cyber-title mt-1 mb-2">{{ sub.projectName }}</h1>
            <p class="text-body-2 text-medium-emphasis mb-0">
              {{ sub.projectDescription || 'Sin descripción.' }}
            </p>
          </div>
          <v-chip
            :color="statusMeta[sub.status].color"
            size="large"
            variant="tonal"
            class="cyber-chip"
          >
            {{ statusMeta[sub.status].label }}
          </v-chip>
        </div>

        <div class="cyber-divider" />

        <v-row dense>
          <v-col cols="12" md="4">
            <div class="cyber-subtitle">// contacto</div>
            <div class="text-body-2">{{ sub.contactName }}</div>
            <div class="cyber-mono text-caption">{{ sub.contactEmail }}</div>
            <div v-if="sub.contactPhone" class="cyber-mono text-caption">{{ sub.contactPhone }}</div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="cyber-subtitle">// fechas</div>
            <div class="text-caption">
              Recibida: <span class="cyber-mono">{{ new Date(sub.submittedAt).toLocaleString() }}</span>
            </div>
            <div v-if="sub.decidedAt" class="text-caption">
              Decidida: <span class="cyber-mono">{{ new Date(sub.decidedAt).toLocaleString() }}</span>
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="cyber-subtitle">// totales</div>
            <div class="cyber-mono">
              {{ sub.totalBudgetHours }} h • {{ fmtMoney(sub.totalBudgetAmount, sub.budgetCurrency || 'CLP') }}
            </div>
          </v-col>
        </v-row>

        <div v-if="sub.scopeNotes" class="mt-4">
          <div class="cyber-subtitle mb-1">// notas del cliente</div>
          <div class="text-body-2" style="white-space: pre-wrap">{{ sub.scopeNotes }}</div>
        </div>

        <div v-if="sub.status === 'ACCEPTED' && sub.generatedTestRequestId" class="mt-5">
          <v-btn
            :to="`/requests/${sub.generatedTestRequestId}`"
            color="primary"
            prepend-icon="mdi-clipboard-check-outline"
          >
            Ver la TestRequest generada
          </v-btn>
        </div>

        <div v-if="sub.status === 'REJECTED' && sub.rejectionReason" class="mt-4">
          <v-alert type="error" variant="tonal" density="compact">
            Motivo del rechazo: {{ sub.rejectionReason }}
          </v-alert>
        </div>
      </v-card>

      <!-- Scope features -->
      <v-card class="cyber-card pa-6 mb-6">
        <div class="d-flex align-center mb-4">
          <span class="cyber-subtitle">// 01 — scope: módulos y features</span>
          <v-spacer />
          <span class="cyber-mono text-caption">{{ sub.scopeFeatures.length }} features</span>
        </div>

        <v-table v-if="sub.scopeFeatures.length" density="comfortable" class="mb-4">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Feature</th>
              <th>Prioridad</th>
              <th>Severidad</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in sub.scopeFeatures" :key="f.id">
              <td class="cyber-mono">{{ f.moduleName }}</td>
              <td>
                <div>{{ f.featureName }}</div>
                <div v-if="f.featureDescription" class="text-caption text-medium-emphasis">{{ f.featureDescription }}</div>
              </td>
              <td><v-chip size="x-small" variant="tonal" class="cyber-chip">{{ f.priority }}</v-chip></td>
              <td><v-chip size="x-small" variant="tonal" class="cyber-chip">{{ f.severity }}</v-chip></td>
              <td class="text-end">
                <v-btn v-if="isEditable" icon="mdi-delete-outline" size="small" variant="text" @click="removeFeature(f.id)" />
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-body-2 text-medium-emphasis mb-4">
          Aún no hay features de scope.
        </p>

        <v-divider v-if="isEditable" class="my-4" />

        <div v-if="isEditable">
          <div class="cyber-subtitle mb-2">// agregar feature</div>
          <v-row dense>
            <v-col cols="12" md="3">
              <v-text-field v-model="newFeature.moduleName" label="Módulo" density="compact" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="newFeature.featureName" label="Feature" density="compact" />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field v-model="newFeature.featureDescription" label="Descripción (opcional)" density="compact" />
            </v-col>
            <v-col cols="6" md="1">
              <v-select v-model="newFeature.priority" :items="['LOW','MEDIUM','HIGH','CRITICAL']" label="Prio" density="compact" />
            </v-col>
            <v-col cols="6" md="1" class="d-flex align-center">
              <v-btn color="primary" :loading="saving" icon="mdi-plus" @click="addFeature" />
            </v-col>
          </v-row>
        </div>
      </v-card>

      <!-- Budget items -->
      <v-card class="cyber-card pa-6 mb-6">
        <div class="d-flex align-center mb-4">
          <span class="cyber-subtitle">// 02 — presupuesto (días-persona)</span>
          <v-spacer />
          <span class="cyber-mono text-caption">
            Total: {{ sub.totalBudgetHours }} h • {{ fmtMoney(sub.totalBudgetAmount, sub.budgetCurrency || 'CLP') }}
          </span>
        </div>

        <v-table v-if="sub.budgetItems.length" density="comfortable" class="mb-4">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descripción</th>
              <th class="text-end">Horas</th>
              <th class="text-end">Tarifa/h</th>
              <th class="text-end">Monto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in sub.budgetItems" :key="i.id">
              <td><v-chip size="x-small" class="cyber-chip">{{ i.itemType }}</v-chip></td>
              <td>{{ i.description }}</td>
              <td class="text-end cyber-mono">{{ i.hours }}</td>
              <td class="text-end cyber-mono">{{ fmtMoney(i.hourlyRate, sub.budgetCurrency || 'CLP') }}</td>
              <td class="text-end cyber-mono">{{ fmtMoney(i.amount, sub.budgetCurrency || 'CLP') }}</td>
              <td class="text-end">
                <v-btn v-if="isEditable" icon="mdi-delete-outline" size="small" variant="text" @click="removeItem(i.id)" />
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-body-2 text-medium-emphasis mb-4">
          Aún no hay items de presupuesto.
        </p>

        <v-divider v-if="isEditable" class="my-4" />

        <div v-if="isEditable">
          <div class="cyber-subtitle mb-2">// agregar item</div>
          <v-row dense>
            <v-col cols="6" md="2">
              <v-select
                v-model="newItem.itemType"
                :items="['SCOPING','EXECUTION','REVIEW','INFRASTRUCTURE']"
                label="Tipo"
                density="compact"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="newItem.description" label="Descripción" density="compact" />
            </v-col>
            <v-col cols="4" md="1">
              <v-text-field v-model.number="newItem.days" label="Días" type="number" min="0.5" step="0.5" density="compact" />
            </v-col>
            <v-col cols="4" md="2">
              <v-text-field
                v-model.number="newItem.hourlyRate"
                label="Tarifa/h (opcional)"
                type="number"
                density="compact"
                :hint="`Default por especialista: ${auth.email ?? ''}`"
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
      <v-card class="cyber-card pa-6 mb-6">
        <div class="cyber-subtitle mb-3">// 03 — flujo de decisión</div>

        <div class="d-flex flex-wrap ga-3">
          <v-btn
            v-if="sub.status === 'PENDING'"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-search-web"
            :loading="saving"
            @click="transition('AWAITING_CLARIFICATION')"
          >
            Pasar a scoping
          </v-btn>
          <v-btn
            v-if="canMarkBudgeted"
            color="primary"
            prepend-icon="mdi-send-check-outline"
            :loading="saving"
            @click="markBudgeted"
          >
            Enviar presupuesto al cliente
          </v-btn>
          <v-btn
            v-if="canAccept"
            color="success"
            prepend-icon="mdi-check-circle-outline"
            @click="acceptDialog = true"
          >
            Aceptar presupuesto (cliente)
          </v-btn>
          <v-btn
            v-if="isEditable"
            color="error"
            variant="outlined"
            prepend-icon="mdi-close-octagon-outline"
            @click="rejectDialog = true"
          >
            Rechazar
          </v-btn>
        </div>
      </v-card>
    </template>

    <!-- Accept dialog -->
    <v-dialog v-model="acceptDialog" max-width="560">
      <v-card class="cyber-card">
        <v-card-title class="cyber-title text-h5">Aceptar presupuesto</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Esto creará la compañía, el usuario del cliente, el proyecto, módulos, features,
            la TestRequest (CONFIRMED) y la Quote (APPROVED). Se enviarán las credenciales por email.
          </p>
          <v-text-field v-model="acceptForm.companyName" label="Nombre de la compañía" />
          <v-select
            v-model="acceptForm.paisId"
            :items="paises"
            item-title="nombre"
            item-value="id"
            label="País"
          />
          <v-select
            v-model="acceptForm.testTypeCode"
            :items="testTypes"
            item-title="name"
            item-value="code"
            label="Tipo de test"
          />
          <v-select
            v-model="acceptForm.environmentCode"
            :items="[{ code: '', name: '— sin ambiente —' }, ...environments]"
            item-title="name"
            item-value="code"
            label="Ambiente"
          />
          <v-select
            v-model="acceptForm.assignedSpecialistId"
            :items="[{ id: '', email: '— sin asignar —', fullName: '' }, ...specialists]"
            :item-title="(u: any) => u.fullName ? `${u.fullName} (${u.email})` : u.email"
            item-value="id"
            label="Especialista asignado"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="acceptDialog = false">Cancelar</v-btn>
          <v-btn color="success" :loading="saving" @click="accept">Aceptar y crear todo</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reject dialog -->
    <v-dialog v-model="rejectDialog" max-width="500">
      <v-card class="cyber-card">
        <v-card-title class="cyber-title text-h5">Rechazar submission</v-card-title>
        <v-card-text>
          <v-textarea v-model="rejectForm.reason" label="Motivo" rows="3" auto-grow />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejectDialog = false">Cancelar</v-btn>
          <v-btn color="error" :loading="saving" :disabled="!rejectForm.reason.trim()" @click="reject">
            Rechazar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Result dialog -->
    <v-dialog :model-value="!!acceptResult" max-width="600" @update:model-value="(v) => !v && (acceptResult = null)">
      <v-card v-if="acceptResult" class="cyber-card cyber-card-glow">
        <v-card-title class="cyber-title text-h5">
          <v-icon color="success" class="me-2">mdi-check-decagram</v-icon>
          Submission aceptada
        </v-card-title>
        <v-card-text>
          <p class="mb-3">Se crearon las entidades del proyecto y se notificó al cliente.</p>
          <div class="cyber-mono text-caption mb-2">
            usuario: <span class="cyber-link">{{ acceptResult.userEmail }}</span>
          </div>
          <v-alert
            v-if="acceptResult.generatedPassword"
            type="warning"
            variant="tonal"
            class="mb-3"
          >
            El envío por email está deshabilitado. Comparte manualmente la contraseña temporal:
            <div class="cyber-mono mt-2" style="font-size: 1.1em">{{ acceptResult.generatedPassword }}</div>
          </v-alert>
          <v-alert v-else type="success" variant="tonal" class="mb-3" density="compact">
            Email con credenciales enviado.
          </v-alert>
          <div class="cyber-mono text-caption">test-request: {{ acceptResult.testRequestId }}</div>
          <div class="cyber-mono text-caption">quote: {{ acceptResult.quoteId }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="acceptResult = null">Cerrar</v-btn>
          <v-spacer />
          <v-btn color="primary" :to="`/requests/${acceptResult.testRequestId}`" prepend-icon="mdi-arrow-right">
            Ir a la TestRequest
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
