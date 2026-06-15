<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const token = computed(() => String(route.params.token || ''))

interface BudgetItem {
  id: string
  itemType: string
  itemTypeLabel: string
  description: string
  hours: number
  hourlyRate: number
  amount: number
  position: number
}
interface ScopeFeature {
  id: string
  moduleName: string
  featureName: string
  featureDescription?: string
  source: 'MANUAL' | 'AUTO'
  position: number
}
interface SubmissionComment {
  id: string
  authorParty: 'CLIENT' | 'INTERNAL'
  authorDisplayName: string
  body: string
  createdAt: string
}
interface PublicSubmission {
  id: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  projectName: string
  projectDescription?: string
  scopeNotes?: string
  status: string
  statusLabel: string
  budgetCurrency: string
  companyName?: string
  masterUserEmail?: string
  requestedTestTypeCode?: string
  requestedEnvironmentCode?: string
  websiteUrl?: string
  submittedAt: string
  totalBudgetAmount: number
  totalBudgetHours: number
  budgetItems: BudgetItem[]
  scopeFeatures: ScopeFeature[]
  clientAgreedAt?: string
  internalAgreedAt?: string
  agreedAt?: string
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'PAID'
  paymentStatusLabel: string
  paidAt?: string
  rejectionReason?: string
  comments: SubmissionComment[]
  loginUrl: string
}

const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<PublicSubmission | null>(null)
const acting = ref(false)
const successMsg = ref<string | null>(null)

const newFeature = reactive({ moduleName: '', featureName: '', featureDescription: '' })
const newComment = ref('')
const rejectReason = ref('')
const rejectOpen = ref(false)
const paymentReference = ref('')
const accepted = ref<{ userEmail: string; generatedPassword?: string | null } | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await $fetch<PublicSubmission>(`${config.public.apiBase}/public/submissions/by-token/${token.value}`)
  } catch (e: any) {
    error.value = e?.data?.message || 'No pudimos cargar tu solicitud. Revisa el link e inténtalo de nuevo.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

function show(msg: string) {
  successMsg.value = msg
  setTimeout(() => { if (successMsg.value === msg) successMsg.value = null }, 4000)
}

async function call<T>(path: string, method: 'POST' | 'DELETE' = 'POST', body?: any): Promise<T> {
  return await $fetch<T>(`${config.public.apiBase}/public/submissions/by-token/${token.value}${path}`, {
    method,
    body
  })
}

const canMutateScope = computed(() => {
  const s = data.value?.status
  return s === 'BUDGETED' || s === 'NEGOTIATING' || s === 'AWAITING_CLARIFICATION'
})
const canApproveBudget = computed(() => {
  const s = data.value?.status
  return (s === 'BUDGETED' || s === 'NEGOTIATING') && (data.value?.budgetItems.length ?? 0) > 0
})
const isAwaitingPayment = computed(() => data.value?.status === 'AWAITING_PAYMENT')
const isAccepted = computed(() => data.value?.status === 'ACCEPTED')

async function addFeature() {
  if (!newFeature.moduleName.trim() || !newFeature.featureName.trim()) return
  acting.value = true
  try {
    await call('/scope-features', 'POST', {
      moduleName: newFeature.moduleName.trim(),
      featureName: newFeature.featureName.trim(),
      featureDescription: newFeature.featureDescription?.trim() || null
    })
    newFeature.moduleName = ''
    newFeature.featureName = ''
    newFeature.featureDescription = ''
    show('Funcionalidad agregada')
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo agregar la funcionalidad'
  } finally {
    acting.value = false
  }
}

async function removeFeature(id: string) {
  if (!confirm('¿Quitar esta funcionalidad del alcance?')) return
  acting.value = true
  try {
    await call(`/scope-features/${id}`, 'DELETE')
    show('Funcionalidad eliminada')
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo quitar la funcionalidad'
  } finally {
    acting.value = false
  }
}

async function postComment() {
  if (!newComment.value.trim()) return
  acting.value = true
  try {
    await call('/comments', 'POST', { body: newComment.value.trim() })
    newComment.value = ''
    show('Comentario enviado')
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo enviar el comentario'
  } finally {
    acting.value = false
  }
}

async function approveBudget() {
  if (!confirm('¿Confirmas que apruebas el presupuesto tal como está?')) return
  acting.value = true
  try {
    await call('/client-agree', 'POST')
    show('Presupuesto aprobado. Si el equipo también lo aprobó, pasamos a confirmar el pago.')
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo aprobar el presupuesto'
  } finally {
    acting.value = false
  }
}

async function rejectBudget() {
  if (!rejectReason.value.trim()) return
  acting.value = true
  try {
    await call('/client-reject', 'POST', { reason: rejectReason.value.trim() })
    rejectReason.value = ''
    rejectOpen.value = false
    show('Pedimos ajustes al equipo')
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo enviar la solicitud de ajustes'
  } finally {
    acting.value = false
  }
}

async function confirmPayment() {
  acting.value = true
  try {
    const res = await call<{ userEmail: string; generatedPassword: string | null }>(
      '/confirm-payment',
      'POST',
      { paymentReference: paymentReference.value?.trim() || null }
    )
    accepted.value = { userEmail: res.userEmail, generatedPassword: res.generatedPassword }
    show('Pago confirmado, tu QA está en marcha')
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo confirmar el pago'
  } finally {
    acting.value = false
  }
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}
function fmtAmount(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: data.value?.budgetCurrency || 'CLP', maximumFractionDigits: 0 }).format(n || 0)
}

useHead({ title: () => `Mi solicitud — ${data.value?.projectName || 'MBP Testing'}` })
</script>

<template>
  <div class="public-detail">
    <v-container max-width="1100" class="py-8">
      <div v-if="loading" class="d-flex justify-center py-16">
        <v-progress-circular indeterminate color="primary" size="48" />
      </div>

      <v-alert v-else-if="error" type="error" variant="tonal" class="my-4">
        {{ error }}
      </v-alert>

      <template v-else-if="data">
        <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
          <div>
            <div class="text-overline text-medium-emphasis">Solicitud {{ data.id.slice(0, 8) }}</div>
            <h1 class="text-h4 mt-1">{{ data.projectName }}</h1>
            <div class="text-body-2 text-medium-emphasis mt-1">
              Contacto: {{ data.contactName }} · {{ data.contactEmail }}
            </div>
          </div>
          <div class="d-flex align-center ga-2">
            <v-chip :color="data.status === 'ACCEPTED' ? 'success' : data.status === 'REJECTED' ? 'error' : 'primary'" variant="tonal">
              {{ data.statusLabel }}
            </v-chip>
            <v-chip v-if="data.paymentStatus !== 'NOT_REQUIRED'" :color="data.paymentStatus === 'PAID' ? 'success' : 'warning'" variant="outlined" size="small">
              Pago: {{ data.paymentStatusLabel }}
            </v-chip>
          </div>
        </div>

        <v-alert v-if="successMsg" type="success" variant="tonal" density="compact" class="mb-4" closable @click:close="successMsg = null">
          {{ successMsg }}
        </v-alert>

        <v-row>
          <!-- Columna principal -->
          <v-col cols="12" md="8">
            <!-- Estado y siguiente paso -->
            <v-card class="mb-4" variant="outlined">
              <v-card-text>
                <div v-if="data.status === 'PENDING'">
                  <div class="text-subtitle-1 mb-1">Recibimos tu solicitud</div>
                  <div class="text-body-2 text-medium-emphasis">
                    El equipo está revisando el alcance. Te avisaremos por correo cuando el presupuesto esté listo.
                  </div>
                </div>
                <div v-else-if="data.status === 'AWAITING_CLARIFICATION'">
                  <div class="text-subtitle-1 mb-1">Necesitamos aclaraciones</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Déjanos un comentario más abajo o ajusta el alcance.
                  </div>
                </div>
                <div v-else-if="data.status === 'BUDGETED' || data.status === 'NEGOTIATING'">
                  <div class="text-subtitle-1 mb-1">
                    {{ data.status === 'NEGOTIATING' ? 'Ajustando el presupuesto' : 'Presupuesto listo' }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    Revisa el detalle, suma o quita funcionalidades, comenta y aprueba cuando estés conforme.
                  </div>
                  <div class="d-flex ga-2 mt-3 flex-wrap">
                    <v-btn color="success" variant="flat" :disabled="!canApproveBudget || acting" prepend-icon="mdi-check" @click="approveBudget">
                      Aprobar presupuesto
                    </v-btn>
                    <v-btn variant="outlined" :disabled="acting" prepend-icon="mdi-pencil" @click="rejectOpen = true">
                      Pedir ajustes
                    </v-btn>
                  </div>
                  <div v-if="data.clientAgreedAt" class="text-caption text-success mt-2">
                    Aprobaste el presupuesto el {{ fmt(data.clientAgreedAt) }}. Esperando confirmación del equipo.
                  </div>
                </div>
                <div v-else-if="data.status === 'AGREED'">
                  <div class="text-subtitle-1 mb-1">Presupuesto acordado</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Ambas partes confirmaron. Estamos preparando el cobro.
                  </div>
                </div>
                <div v-else-if="isAwaitingPayment">
                  <div class="text-subtitle-1 mb-1">Confirma el pago para iniciar el QA</div>
                  <div class="text-body-2 text-medium-emphasis mb-3">
                    Total: <strong>{{ fmtAmount(data.totalBudgetAmount) }}</strong> · {{ data.totalBudgetHours }} h
                  </div>
                  <v-text-field
                    v-model="paymentReference"
                    label="Referencia de pago (opcional)"
                    hint="Número de transferencia, ID de transacción, etc."
                    persistent-hint
                    variant="outlined"
                    density="compact"
                    class="mb-3"
                  />
                  <v-btn color="primary" variant="flat" :loading="acting" prepend-icon="mdi-credit-card-check-outline" @click="confirmPayment">
                    Confirmar pago e iniciar QA
                  </v-btn>
                </div>
                <div v-else-if="isAccepted">
                  <div class="text-subtitle-1 mb-1 text-success">¡QA en marcha!</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Creamos tu cuenta y el tablero kanban. Inicia sesión para hacer seguimiento.
                  </div>
                  <v-alert v-if="accepted?.generatedPassword" type="warning" variant="tonal" class="mt-3" density="compact">
                    Guarda esta contraseña temporal: <strong>{{ accepted.generatedPassword }}</strong>
                    (no pudimos enviarla por correo).
                  </v-alert>
                  <v-btn :href="data.loginUrl" color="primary" variant="flat" class="mt-3" prepend-icon="mdi-login">
                    Ir a iniciar sesión
                  </v-btn>
                </div>
                <div v-else-if="data.status === 'REJECTED'">
                  <div class="text-subtitle-1 text-error mb-1">Solicitud rechazada</div>
                  <div class="text-body-2 text-medium-emphasis">{{ data.rejectionReason || 'Sin motivo.' }}</div>
                </div>
              </v-card-text>
            </v-card>

            <!-- Presupuesto -->
            <v-card class="mb-4" variant="outlined">
              <v-card-title class="d-flex align-center">
                <v-icon class="me-2">mdi-cash-multiple</v-icon>
                Presupuesto
              </v-card-title>
              <v-card-text>
                <div v-if="data.budgetItems.length === 0" class="text-body-2 text-medium-emphasis">
                  El equipo aún no ha cargado items en el presupuesto.
                </div>
                <v-table v-else density="compact">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Tipo</th>
                      <th class="text-end">Horas</th>
                      <th class="text-end">Tarifa</th>
                      <th class="text-end">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="i in data.budgetItems" :key="i.id">
                      <td>{{ i.description }}</td>
                      <td>{{ i.itemTypeLabel }}</td>
                      <td class="text-end">{{ i.hours }}</td>
                      <td class="text-end">{{ fmtAmount(i.hourlyRate) }}</td>
                      <td class="text-end">{{ fmtAmount(i.amount) }}</td>
                    </tr>
                    <tr class="font-weight-bold">
                      <td colspan="2">Total</td>
                      <td class="text-end">{{ data.totalBudgetHours }}</td>
                      <td />
                      <td class="text-end">{{ fmtAmount(data.totalBudgetAmount) }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>

            <!-- Scope -->
            <v-card class="mb-4" variant="outlined">
              <v-card-title class="d-flex align-center">
                <v-icon class="me-2">mdi-clipboard-list-outline</v-icon>
                Alcance ({{ data.scopeFeatures.length }})
              </v-card-title>
              <v-card-text>
                <div v-if="data.scopeFeatures.length === 0" class="text-body-2 text-medium-emphasis mb-3">
                  Aún no hay funcionalidades en el alcance.
                </div>
                <div v-else class="d-flex flex-column ga-2 mb-4">
                  <div v-for="f in data.scopeFeatures" :key="f.id" class="public-detail__feature">
                    <div>
                      <div class="text-subtitle-2">{{ f.moduleName }} · {{ f.featureName }}</div>
                      <div v-if="f.featureDescription" class="text-caption text-medium-emphasis">{{ f.featureDescription }}</div>
                    </div>
                    <div class="d-flex align-center ga-2">
                      <v-chip size="x-small" :color="f.source === 'AUTO' ? 'info' : 'default'" variant="tonal">
                        {{ f.source === 'AUTO' ? 'Detectado' : 'Manual' }}
                      </v-chip>
                      <v-btn v-if="canMutateScope" icon="mdi-close" variant="text" size="x-small" :disabled="acting" @click="removeFeature(f.id)" />
                    </div>
                  </div>
                </div>

                <div v-if="canMutateScope" class="public-detail__add">
                  <v-row dense>
                    <v-col cols="12" md="4">
                      <v-text-field v-model="newFeature.moduleName" label="Módulo / servicio" density="compact" variant="outlined" hide-details />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-text-field v-model="newFeature.featureName" label="Funcionalidad" density="compact" variant="outlined" hide-details />
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-text-field v-model="newFeature.featureDescription" label="Detalle (opcional)" density="compact" variant="outlined" hide-details />
                    </v-col>
                    <v-col cols="12" md="1" class="d-flex align-center justify-end">
                      <v-btn icon="mdi-plus" color="primary" variant="tonal" :disabled="acting || !newFeature.moduleName || !newFeature.featureName" @click="addFeature" />
                    </v-col>
                  </v-row>
                </div>
              </v-card-text>
            </v-card>

            <!-- Comentarios -->
            <v-card variant="outlined">
              <v-card-title class="d-flex align-center">
                <v-icon class="me-2">mdi-message-text-outline</v-icon>
                Comentarios
              </v-card-title>
              <v-card-text>
                <div v-if="data.comments.length === 0" class="text-body-2 text-medium-emphasis">
                  Sin comentarios aún.
                </div>
                <div v-else class="d-flex flex-column ga-3 mb-3">
                  <div v-for="c in data.comments" :key="c.id" class="public-detail__comment" :class="{ 'is-client': c.authorParty === 'CLIENT' }">
                    <div class="text-caption text-medium-emphasis">
                      <strong>{{ c.authorDisplayName }}</strong>
                      <span v-if="c.authorParty === 'INTERNAL'"> · Equipo MBP</span>
                      <span> · {{ fmt(c.createdAt) }}</span>
                    </div>
                    <div class="text-body-2 mt-1" style="white-space: pre-wrap;">{{ c.body }}</div>
                  </div>
                </div>
                <v-textarea
                  v-model="newComment"
                  label="Tu comentario"
                  variant="outlined"
                  rows="3"
                  auto-grow
                  hide-details
                  :disabled="data.status === 'ACCEPTED' || data.status === 'REJECTED'"
                />
                <div class="d-flex justify-end mt-2">
                  <v-btn color="primary" variant="flat" :loading="acting" :disabled="!newComment.trim() || data.status === 'ACCEPTED' || data.status === 'REJECTED'" prepend-icon="mdi-send" @click="postComment">
                    Comentar
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Sidebar -->
          <v-col cols="12" md="4">
            <v-card variant="outlined">
              <v-card-title>Detalles</v-card-title>
              <v-card-text class="d-flex flex-column ga-3">
                <div>
                  <div class="text-caption text-medium-emphasis">Compañía</div>
                  <div>{{ data.companyName || '—' }}</div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Cuenta maestra</div>
                  <div>{{ data.masterUserEmail || data.contactEmail }}</div>
                </div>
                <div v-if="data.websiteUrl">
                  <div class="text-caption text-medium-emphasis">Sitio</div>
                  <a :href="data.websiteUrl" target="_blank" rel="noopener" class="text-decoration-none">{{ data.websiteUrl }}</a>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Tipo de QA</div>
                  <div>{{ data.requestedTestTypeCode || '—' }}</div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Ambiente</div>
                  <div>{{ data.requestedEnvironmentCode || '—' }}</div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Recibida</div>
                  <div>{{ fmt(data.submittedAt) }}</div>
                </div>
                <div v-if="data.agreedAt">
                  <div class="text-caption text-medium-emphasis">Acordada</div>
                  <div>{{ fmt(data.agreedAt) }}</div>
                </div>
                <div v-if="data.paidAt">
                  <div class="text-caption text-medium-emphasis">Pagada</div>
                  <div>{{ fmt(data.paidAt) }}</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </v-container>

    <!-- Reject dialog -->
    <v-dialog v-model="rejectOpen" max-width="520">
      <v-card>
        <v-card-title>Pedir ajustes al presupuesto</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="rejectReason"
            label="¿Qué te gustaría cambiar?"
            variant="outlined"
            rows="4"
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejectOpen = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="acting" :disabled="!rejectReason.trim()" @click="rejectBudget">
            Enviar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.public-detail__feature {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(var(--v-theme-surface-variant), 0.18);
  border: 1px solid rgba(var(--v-theme-surface-variant), 0.4);
}
.public-detail__add {
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed rgba(var(--v-theme-surface-variant), 0.8);
}
.public-detail__comment {
  padding: 12px;
  border-radius: 10px;
  background: rgba(var(--v-theme-surface-variant), 0.18);
  border: 1px solid rgba(var(--v-theme-surface-variant), 0.4);
}
.public-detail__comment.is-client {
  background: rgba(var(--v-theme-primary), 0.06);
  border-color: rgba(var(--v-theme-primary), 0.3);
}
</style>
