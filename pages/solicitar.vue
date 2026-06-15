<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'

const { t } = useI18n()
useHead({ title: () => `Solicitar QA — ${t('common.appName')}` })

interface TestTypeOption { id: string; code: string; name: string; description?: string | null; available: boolean }
interface EnvironmentOption { id: string; code: string; name: string }
interface ScopeFeatureInput { moduleName: string; featureName: string; featureDescription?: string }

interface SubmissionAck {
  id: string
  publicToken: string
  status: string
}

const config = useRuntimeConfig()

const drawer = ref(false)
const step = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)
const ack = ref<SubmissionAck | null>(null)

const testTypes = ref<TestTypeOption[]>([])
const environments = ref<EnvironmentOption[]>([])
const catalogLoading = ref(false)

const scanning = ref(false)
const scanError = ref<string | null>(null)
const scanInfo = ref<string | null>(null)

const form = reactive({
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  scopeNotes: '',
  requestedTestTypeCode: '',
  requestedEnvironmentCode: '',
  companyName: '',
  masterUserEmail: '',
  projectName: '',
  projectDescription: '',
  websiteUrl: '',
  scopeFeatures: [] as ScopeFeatureInput[]
})

const emailRule = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

const step1Valid = computed(() =>
  form.contactName.trim().length > 1 &&
  emailRule(form.contactEmail) &&
  form.scopeNotes.trim().length > 5 &&
  !!form.requestedTestTypeCode
)
const step2Valid = computed(() =>
  form.companyName.trim().length > 1 &&
  emailRule(form.masterUserEmail) &&
  form.projectName.trim().length > 1
)

async function loadCatalogs() {
  if (testTypes.value.length && environments.value.length) return
  catalogLoading.value = true
  try {
    const [tt, env] = await Promise.all([
      $fetch<TestTypeOption[]>(`${config.public.apiBase}/public/test-types`),
      $fetch<EnvironmentOption[]>(`${config.public.apiBase}/public/environments`)
    ])
    testTypes.value = tt
    environments.value = env
  } catch (e: any) {
    error.value = 'No pudimos cargar los tipos de QA y ambientes. Reintenta.'
  } finally {
    catalogLoading.value = false
  }
}

function openWizard() {
  ack.value = null
  error.value = null
  step.value = 1
  drawer.value = true
  loadCatalogs()
}

function addFeature() {
  form.scopeFeatures.push({ moduleName: '', featureName: '', featureDescription: '' })
}
function removeFeature(i: number) {
  form.scopeFeatures.splice(i, 1)
}

function normalizeUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}
const canScan = computed(() => {
  const t = form.websiteUrl?.trim() || ''
  if (!t) return false
  try {
    const u = new URL(normalizeUrl(t))
    return !!u.host && u.host.includes('.')
  } catch {
    return false
  }
})

async function scanUrl() {
  if (!canScan.value) return
  scanError.value = null
  scanInfo.value = null
  scanning.value = true
  try {
    const res = await $fetch<{
      url: string
      features: Array<{ moduleName: string; featureName: string }>
      technologies: string[]
      forms: number
    }>(`${config.public.apiBase}/public/scan-preview`, {
      method: 'POST',
      body: { url: normalizeUrl(form.websiteUrl) },
      timeout: 60000
    })
    if (!res.features.length) {
      scanInfo.value = 'No detectamos funcionalidades automáticamente. Súmalas manualmente abajo.'
      return
    }
    const existing = new Set(
      form.scopeFeatures
        .filter(f => f.featureName.trim())
        .map(f => `${f.moduleName.trim().toLowerCase()}::${f.featureName.trim().toLowerCase()}`)
    )
    let added = 0
    for (const f of res.features) {
      const key = `${f.moduleName.trim().toLowerCase()}::${f.featureName.trim().toLowerCase()}`
      if (existing.has(key)) continue
      form.scopeFeatures.push({
        moduleName: f.moduleName,
        featureName: f.featureName,
        featureDescription: ''
      })
      existing.add(key)
      added++
    }
    scanInfo.value = added > 0
      ? `Sumamos ${added} funcionalidad${added === 1 ? '' : 'es'} detectada${added === 1 ? '' : 's'}.`
      : 'Las funcionalidades detectadas ya estaban en la lista.'
  } catch (e: any) {
    scanError.value = e?.data?.message || 'No pudimos analizar el sitio. Verifica la URL e inténtalo de nuevo.'
  } finally {
    scanning.value = false
  }
}

watch(drawer, (open) => {
  if (open) loadCatalogs()
})

async function submit() {
  if (!step1Valid.value || !step2Valid.value) return
  error.value = null
  loading.value = true
  try {
    const payload = {
      ...form,
      websiteUrl: form.websiteUrl?.trim() || null,
      contactPhone: form.contactPhone?.trim() || null,
      projectDescription: form.projectDescription?.trim() || null,
      requestedEnvironmentCode: form.requestedEnvironmentCode || null,
      scopeFeatures: form.scopeFeatures
        .filter(f => f.moduleName.trim() && f.featureName.trim())
        .map(f => ({
          moduleName: f.moduleName.trim(),
          featureName: f.featureName.trim(),
          featureDescription: f.featureDescription?.trim() || null
        }))
    }
    ack.value = await $fetch<SubmissionAck>(`${config.public.apiBase}/public/submissions`, {
      method: 'POST',
      body: payload
    })
  } catch (e: any) {
    error.value = e?.data?.message || 'No pudimos enviar la solicitud. Reintenta.'
  } finally {
    loading.value = false
  }
}

function goToPublicDetail() {
  if (!ack.value) return
  drawer.value = false
  navigateTo(`/solicitud/${ack.value.publicToken}`)
}

const selectedTestType = computed(() =>
  testTypes.value.find(t => t.code === form.requestedTestTypeCode)
)
const selectedEnvironment = computed(() =>
  environments.value.find(e => e.code === form.requestedEnvironmentCode)
)
</script>

<template>
  <div class="solicitar">
    <div class="solicitar__bg" aria-hidden="true">
      <div class="solicitar__grid" />
      <div class="solicitar__glow solicitar__glow--a" />
      <div class="solicitar__glow solicitar__glow--b" />
    </div>

    <v-container class="solicitar__inner" max-width="1100">
      <div class="solicitar__hero">
        <v-chip variant="tonal" color="primary" size="small" prepend-icon="mdi-shimmer" class="mb-4">
          Solicitud guiada
        </v-chip>
        <h1 class="solicitar__title">
          Cuéntanos qué necesitas <span class="solicitar__title-accent">testear</span>
        </h1>
        <p class="solicitar__subtitle">
          Tres pasos cortos: tu contacto y el tipo de QA, los datos del proyecto y un resumen para confirmar.
          Recibirás un link privado por email para hacer seguimiento sin crear cuenta.
        </p>

        <div class="solicitar__features">
          <div class="solicitar__feature">
            <v-icon color="accent" size="28">mdi-account-tie-outline</v-icon>
            <div class="text-subtitle-2 mt-2">Sin registro</div>
            <div class="text-caption text-medium-emphasis">Solo necesitas un email para empezar</div>
          </div>
          <div class="solicitar__feature">
            <v-icon color="accent" size="28">mdi-cash-multiple</v-icon>
            <div class="text-subtitle-2 mt-2">Presupuesto a medida</div>
            <div class="text-caption text-medium-emphasis">Lo preparamos sobre tu alcance</div>
          </div>
          <div class="solicitar__feature">
            <v-icon color="accent" size="28">mdi-shield-check-outline</v-icon>
            <div class="text-subtitle-2 mt-2">Link privado</div>
            <div class="text-caption text-medium-emphasis">Token único enviado por correo</div>
          </div>
        </div>

        <div class="d-flex ga-3 mt-8 flex-wrap">
          <v-btn
            size="x-large"
            color="primary"
            variant="flat"
            append-icon="mdi-arrow-right"
            class="solicitar__cta"
            @click="openWizard"
          >
            Iniciar solicitud
          </v-btn>
          <v-btn size="x-large" variant="text" to="/">Volver</v-btn>
        </div>
      </div>
    </v-container>

    <v-dialog
      v-model="drawer"
      fullscreen
      scrollable
      transition="dialog-bottom-transition"
      class="solicitar__drawer"
    >
      <v-card class="solicitar__drawer-body" rounded="0">
        <div class="solicitar__drawer-header">
          <div class="solicitar__drawer-header-inner">
            <div class="d-flex align-center ga-2">
              <v-icon color="primary">mdi-clipboard-text-outline</v-icon>
              <span class="text-h6">Nueva solicitud de QA</span>
            </div>
            <v-btn icon="mdi-close" variant="text" @click="drawer = false" :disabled="loading" />
          </div>
        </div>
        <v-divider />
        <div class="solicitar__drawer-content">

        <div v-if="!ack" class="px-4 py-4">
          <v-stepper
            v-model="step"
            :items="['Contacto y QA', 'Compañía y alcance', 'Confirmación']"
            hide-actions
            flat
            class="bg-transparent"
          />

          <v-window v-model="step" class="mt-2">
            <!-- STEP 1 -->
            <v-window-item :value="1">
              <div class="solicitar__step">
                <div class="text-overline text-medium-emphasis">Paso 1 de 3</div>
                <h3 class="text-h5 mb-2">Tu contacto y el tipo de QA</h3>
                <p class="text-body-2 text-medium-emphasis mb-5">
                  Usaremos este email para enviarte el link de seguimiento.
                </p>

                <v-row dense>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.contactName"
                      label="Nombre de contacto"
                      prepend-inner-icon="mdi-account-outline"
                      variant="outlined"
                      autocomplete="name"
                      autofocus
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.contactEmail"
                      label="Email de contacto"
                      hint="A este email te enviaremos el link privado"
                      persistent-hint
                      prepend-inner-icon="mdi-email-outline"
                      variant="outlined"
                      type="email"
                      autocomplete="email"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.contactPhone"
                      label="Teléfono (opcional)"
                      prepend-inner-icon="mdi-phone-outline"
                      variant="outlined"
                    />
                  </v-col>
                </v-row>

                <v-textarea
                  v-model="form.scopeNotes"
                  label="Describe el QA que necesitas"
                  hint="Cuéntanos qué quieres probar, en qué fechas, qué te preocupa"
                  persistent-hint
                  prepend-inner-icon="mdi-bug-check-outline"
                  variant="outlined"
                  rows="4"
                  auto-grow
                  class="mt-4"
                />

                <div class="text-subtitle-2 mt-6 mb-2">¿Qué tipo de QA necesitas?</div>
                <div v-if="catalogLoading" class="d-flex justify-center pa-4">
                  <v-progress-circular indeterminate color="primary" />
                </div>
                <div v-else class="solicitar__type-grid">
                  <div
                    v-for="tt in testTypes"
                    :key="tt.code"
                    class="solicitar__type-card"
                    :class="{
                      'is-selected': form.requestedTestTypeCode === tt.code,
                      'is-disabled': !tt.available
                    }"
                    :role="tt.available ? 'button' : undefined"
                    :tabindex="tt.available ? 0 : -1"
                    :aria-disabled="!tt.available"
                    @click="tt.available && (form.requestedTestTypeCode = tt.code)"
                    @keydown.enter="tt.available && (form.requestedTestTypeCode = tt.code)"
                    @keydown.space.prevent="tt.available && (form.requestedTestTypeCode = tt.code)"
                  >
                    <div class="d-flex align-center justify-space-between ga-2">
                      <div class="d-flex align-center ga-2">
                        <v-icon :color="form.requestedTestTypeCode === tt.code ? 'primary' : 'medium-emphasis'">
                          {{ form.requestedTestTypeCode === tt.code ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank' }}
                        </v-icon>
                        <span class="text-subtitle-2">{{ tt.name }}</span>
                      </div>
                      <v-chip v-if="!tt.available" size="x-small" color="accent" variant="tonal" prepend-icon="mdi-clock-outline">
                        Próximamente
                      </v-chip>
                    </div>
                    <p v-if="tt.description" class="text-caption text-medium-emphasis mt-2 mb-0">
                      {{ tt.description }}
                    </p>
                  </div>
                </div>

                <v-select
                  v-model="form.requestedEnvironmentCode"
                  :items="environments"
                  item-title="name"
                  item-value="code"
                  label="¿En qué ambiente lo desean realizar?"
                  prepend-inner-icon="mdi-server-network-outline"
                  variant="outlined"
                  clearable
                  class="mt-6"
                />
              </div>
            </v-window-item>

            <!-- STEP 2 -->
            <v-window-item :value="2">
              <div class="solicitar__step">
                <div class="text-overline text-medium-emphasis">Paso 2 de 3</div>
                <h3 class="text-h5 mb-2">Compañía, cuenta maestra y alcance</h3>
                <p class="text-body-2 text-medium-emphasis mb-5">
                  Crearemos la cuenta maestra al iniciar el QA. Por ahora solo necesitamos los datos.
                </p>

                <v-row dense>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.companyName"
                      label="Nombre de la compañía"
                      prepend-inner-icon="mdi-domain"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.masterUserEmail"
                      label="Email de la cuenta maestra"
                      hint="Crearemos un usuario con este email cuando se inicie el QA"
                      persistent-hint
                      prepend-inner-icon="mdi-account-key-outline"
                      variant="outlined"
                      type="email"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.projectName"
                      label="Proyecto a revisar"
                      prepend-inner-icon="mdi-rocket-launch-outline"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.websiteUrl"
                      label="URL del sitio (opcional)"
                      hint="Si la dejas, podemos analizarla y sugerir funcionalidades"
                      persistent-hint
                      prepend-inner-icon="mdi-web"
                      placeholder="https://..."
                      variant="outlined"
                      type="url"
                    />
                  </v-col>
                </v-row>

                <div class="d-flex align-center ga-2 mt-2 flex-wrap">
                  <v-btn
                    :disabled="!canScan || scanning"
                    :loading="scanning"
                    color="accent"
                    variant="tonal"
                    prepend-icon="mdi-magnify-scan"
                    @click="scanUrl"
                  >
                    Escanear URL
                  </v-btn>
                  <span v-if="canScan" class="text-caption text-medium-emphasis">
                    Analizaremos el sitio (puede tardar unos segundos) y sumaremos las funcionalidades detectadas a la lista.
                  </span>
                  <span v-else class="text-caption text-medium-emphasis">
                    Ingresa una URL válida para habilitar el análisis automático.
                  </span>
                </div>
                <v-alert v-if="scanError" type="error" variant="tonal" density="compact" class="mt-2">
                  {{ scanError }}
                </v-alert>
                <v-alert v-if="scanInfo" type="success" variant="tonal" density="compact" class="mt-2" closable @click:close="scanInfo = null">
                  {{ scanInfo }}
                </v-alert>

                <v-textarea
                  v-model="form.projectDescription"
                  label="Descripción del proyecto (opcional)"
                  prepend-inner-icon="mdi-text-box-outline"
                  variant="outlined"
                  rows="2"
                  auto-grow
                  class="mt-3"
                />

                <div class="d-flex align-center justify-space-between mt-6">
                  <div>
                    <div class="text-subtitle-2">Módulos / funcionalidades a revisar</div>
                    <div class="text-caption text-medium-emphasis">
                      Suma lo que tengas claro; el resto lo completaremos juntos.
                      <span v-if="form.websiteUrl"> También analizaremos tu sitio automáticamente.</span>
                    </div>
                  </div>
                  <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="addFeature">
                    Agregar
                  </v-btn>
                </div>

                <div v-if="form.scopeFeatures.length === 0" class="solicitar__empty mt-3">
                  <v-icon size="32" color="medium-emphasis">mdi-clipboard-list-outline</v-icon>
                  <div class="text-body-2 mt-2">Sin funcionalidades aún. Puedes sumar después en el detalle.</div>
                </div>

                <div v-else class="mt-3 d-flex flex-column ga-3">
                  <div v-for="(f, i) in form.scopeFeatures" :key="i" class="solicitar__feature-row">
                    <v-row dense>
                      <v-col cols="12" md="4">
                        <v-text-field
                          v-model="f.moduleName"
                          label="Módulo / servicio"
                          density="compact"
                          variant="outlined"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="12" md="4">
                        <v-text-field
                          v-model="f.featureName"
                          label="Funcionalidad"
                          density="compact"
                          variant="outlined"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="12" md="3">
                        <v-text-field
                          v-model="f.featureDescription"
                          label="Detalle (opcional)"
                          density="compact"
                          variant="outlined"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="12" md="1" class="d-flex align-center justify-end">
                        <v-btn icon="mdi-trash-can-outline" variant="text" size="small" @click="removeFeature(i)" />
                      </v-col>
                    </v-row>
                  </div>
                </div>
              </div>
            </v-window-item>

            <!-- STEP 3 -->
            <v-window-item :value="3">
              <div class="solicitar__step">
                <div class="text-overline text-medium-emphasis">Paso 3 de 3</div>
                <h3 class="text-h5 mb-2">Confirma y envía</h3>
                <p class="text-body-2 text-medium-emphasis mb-5">
                  Revisa los datos. Al enviar, prepararemos un presupuesto y te llegará a tu correo
                  el link privado para revisarlo, comentarlo y aprobarlo.
                </p>

                <div class="solicitar__summary">
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Contacto</span>
                    <span class="solicitar__sum-val">{{ form.contactName }} · {{ form.contactEmail }}<span v-if="form.contactPhone"> · {{ form.contactPhone }}</span></span>
                  </div>
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Tipo de QA</span>
                    <span class="solicitar__sum-val">{{ selectedTestType?.name || '—' }}</span>
                  </div>
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Ambiente</span>
                    <span class="solicitar__sum-val">{{ selectedEnvironment?.name || 'A definir' }}</span>
                  </div>
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Descripción del QA</span>
                    <span class="solicitar__sum-val pre">{{ form.scopeNotes }}</span>
                  </div>
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Compañía</span>
                    <span class="solicitar__sum-val">{{ form.companyName }}</span>
                  </div>
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Cuenta maestra</span>
                    <span class="solicitar__sum-val">{{ form.masterUserEmail }}</span>
                  </div>
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Proyecto</span>
                    <span class="solicitar__sum-val">
                      {{ form.projectName }}
                      <span v-if="form.websiteUrl"> · <a :href="form.websiteUrl" target="_blank" rel="noopener">{{ form.websiteUrl }}</a></span>
                    </span>
                  </div>
                  <div class="solicitar__sum-row">
                    <span class="solicitar__sum-key">Funcionalidades</span>
                    <span class="solicitar__sum-val">
                      <template v-if="form.scopeFeatures.filter(f => f.featureName.trim()).length">
                        {{ form.scopeFeatures.filter(f => f.featureName.trim()).length }} declaradas
                      </template>
                      <template v-else>A definir en el detalle</template>
                    </span>
                  </div>
                </div>

                <v-alert type="info" variant="tonal" density="compact" class="mt-5">
                  Después de enviar, tu solicitud quedará en revisión. Recibirás un correo cuando el presupuesto esté listo
                  con un link privado para revisarlo, ajustar el alcance y aprobarlo.
                </v-alert>

                <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">
                  {{ error }}
                </v-alert>
              </div>
            </v-window-item>
          </v-window>

          <v-divider class="my-4" />
          <div class="d-flex align-center ga-2">
            <v-btn variant="text" :disabled="loading || step === 1" prepend-icon="mdi-arrow-left" @click="step--">
              Atrás
            </v-btn>
            <v-spacer />
            <v-btn
              v-if="step === 1"
              color="primary"
              variant="flat"
              :disabled="!step1Valid"
              append-icon="mdi-arrow-right"
              @click="step = 2"
            >
              Continuar
            </v-btn>
            <v-btn
              v-else-if="step === 2"
              color="primary"
              variant="flat"
              :disabled="!step2Valid"
              append-icon="mdi-arrow-right"
              @click="step = 3"
            >
              Continuar
            </v-btn>
            <v-btn
              v-else
              color="primary"
              variant="flat"
              prepend-icon="mdi-send"
              :loading="loading"
              :disabled="!step1Valid || !step2Valid"
              @click="submit"
            >
              Enviar solicitud
            </v-btn>
          </div>
        </div>

        <!-- ACK -->
        <div v-else class="pa-6">
          <div class="solicitar__ack">
            <div class="solicitar__ack-ring">
              <v-icon size="56" color="accent">mdi-check-decagram</v-icon>
            </div>
            <h3 class="text-h5 mt-4 text-center">¡Recibimos tu solicitud!</h3>
            <p class="text-body-2 text-medium-emphasis text-center mt-2">
              Te enviamos un correo a <strong>{{ form.contactEmail }}</strong> con el link privado para hacer seguimiento.
            </p>
            <div class="d-flex justify-center mt-4">
              <v-chip variant="outlined" prepend-icon="mdi-pound">
                {{ ack.id }}
              </v-chip>
            </div>
            <div class="d-flex justify-center mt-6 ga-2 flex-wrap">
              <v-btn variant="flat" color="primary" prepend-icon="mdi-arrow-right" @click="goToPublicDetail">
                Ver mi solicitud
              </v-btn>
              <v-btn variant="text" @click="drawer = false">Cerrar</v-btn>
            </div>
          </div>
        </div>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.solicitar {
  position: relative;
  min-height: calc(100vh - 64px);
  overflow: hidden;
  isolation: isolate;
  padding-block: clamp(40px, 8vh, 96px);
}
.solicitar__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
.solicitar__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(30, 58, 138, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(30, 58, 138, 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
}
:deep(.v-theme--mbpDark) .solicitar__grid {
  background-image:
    linear-gradient(rgba(96, 165, 250, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(96, 165, 250, 0.08) 1px, transparent 1px);
}
.solicitar__glow {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.55;
  animation: drift 18s ease-in-out infinite;
}
.solicitar__glow--a {
  background: radial-gradient(circle, #2563EB 0%, transparent 70%);
  top: -180px;
  left: -120px;
}
.solicitar__glow--b {
  background: radial-gradient(circle, #22D3EE 0%, transparent 70%);
  bottom: -160px;
  right: -80px;
  animation-delay: -6s;
}
@keyframes drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, -30px) scale(1.08); }
}
.solicitar__inner { position: relative; z-index: 1; }

.solicitar__hero { padding-block: clamp(24px, 4vw, 56px); }
.solicitar__title {
  font-size: clamp(2.25rem, 5.5vw, 4rem);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: rgb(var(--v-theme-on-background));
}
.solicitar__title-accent {
  background: linear-gradient(120deg, #2563EB, #22D3EE 50%, #22C55E);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.solicitar__subtitle {
  font-size: 1rem;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.8;
  max-width: 640px;
  margin-top: 16px;
}
.solicitar__features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  max-width: 720px;
  margin-top: 32px;
}
.solicitar__feature {
  padding: 20px;
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--v-theme-surface-variant), 0.8);
}
.solicitar__cta {
  box-shadow: 0 8px 32px rgba(var(--v-theme-primary), 0.35);
}

.solicitar__drawer-body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
}
.solicitar__drawer-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-surface-variant), 0.4);
}
.solicitar__drawer-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}
.solicitar__drawer-content {
  flex: 1;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}
.solicitar__step { padding-block: 8px 24px; }

.solicitar__type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.solicitar__type-card {
  cursor: pointer;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-surface-variant), 0.8);
  background: rgba(var(--v-theme-surface), 0.6);
  transition: all 0.18s ease;
}
.solicitar__type-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
}
.solicitar__type-card.is-selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  box-shadow: 0 4px 24px rgba(var(--v-theme-primary), 0.2);
}
.solicitar__type-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(var(--v-theme-surface-variant), 0.25);
}
.solicitar__type-card.is-disabled:hover {
  border-color: rgba(var(--v-theme-surface-variant), 0.8);
}

.solicitar__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  border: 1px dashed rgba(var(--v-theme-surface-variant), 0.8);
  border-radius: 12px;
  color: rgb(var(--v-theme-on-surface));
}
.solicitar__feature-row {
  padding: 12px;
  border-radius: 12px;
  background: rgba(var(--v-theme-surface-variant), 0.18);
}

.solicitar__summary {
  border: 1px solid rgba(var(--v-theme-surface-variant), 0.8);
  border-radius: 12px;
  overflow: hidden;
}
.solicitar__sum-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-surface-variant), 0.6);
}
.solicitar__sum-row:last-child { border-bottom: none; }
.solicitar__sum-key {
  font-size: 0.8125rem;
  font-weight: 500;
  opacity: 0.7;
}
.solicitar__sum-val { font-size: 0.9375rem; }
.solicitar__sum-val.pre { white-space: pre-wrap; }
@media (max-width: 640px) {
  .solicitar__sum-row { grid-template-columns: 1fr; gap: 4px; }
}

.solicitar__ack-ring {
  width: 110px;
  height: 110px;
  margin: 0 auto;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.18) 0%, transparent 70%);
  border: 1px solid rgba(34, 197, 94, 0.3);
}
</style>
