<script setup lang="ts">
useHead({ title: 'Solicitar servicio de QA — MBP Testing' })

interface PublicSubmissionAck {
  id: string
  status: string
  submittedAt: string
}

const config = useRuntimeConfig()

const form = reactive({
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  projectName: '',
  projectDescription: '',
  scopeNotes: ''
})

const formRef = ref()
const loading = ref(false)
const error = ref<string | null>(null)
const ack = ref<PublicSubmissionAck | null>(null)

const requiredRule = (v: string) => !!v?.trim() || 'Campo requerido'
const emailRule = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || 'Email inválido'

async function submit() {
  error.value = null
  const { valid } = await formRef.value?.validate()
  if (!valid) return
  loading.value = true
  try {
    const res = await $fetch<PublicSubmissionAck>(`${config.public.apiBase}/public/submissions`, {
      method: 'POST',
      body: form
    })
    ack.value = res
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible enviar la solicitud. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="py-10" max-width="900">
    <div v-if="!ack" class="mb-8 text-center">
      <span class="cyber-subtitle">// engagement-intake //</span>
      <h1 class="text-h3 cyber-title mt-2 cyber-glow-text">Solicitar servicio de QA</h1>
      <p class="text-body-1 mt-3 text-medium-emphasis" style="max-width: 640px; margin: 0 auto;">
        Cuéntanos qué necesitas testear. Un especialista revisará tu solicitud,
        definirá el alcance y te enviará un presupuesto en horas-persona.
      </p>
    </div>

    <v-card v-if="!ack" class="cyber-card pa-6 pa-md-8">
      <v-form ref="formRef" @submit.prevent="submit">
        <div class="cyber-subtitle mb-2">// 01 — contacto</div>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.contactName"
              label="Nombre completo"
              prepend-inner-icon="mdi-account-outline"
              :rules="[requiredRule]"
              autocomplete="name"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.contactEmail"
              label="Email corporativo"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              :rules="[requiredRule, emailRule]"
              autocomplete="email"
              hint="Será tu usuario al aceptar el presupuesto"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.contactPhone"
              label="Teléfono (opcional)"
              prepend-inner-icon="mdi-phone-outline"
              autocomplete="tel"
            />
          </v-col>
        </v-row>

        <div class="cyber-divider" />
        <div class="cyber-subtitle mb-2">// 02 — proyecto</div>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="form.projectName"
              label="Nombre del proyecto o producto"
              prepend-inner-icon="mdi-rocket-launch-outline"
              :rules="[requiredRule]"
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="form.projectDescription"
              label="Descripción breve del proyecto"
              prepend-inner-icon="mdi-text-box-outline"
              rows="3"
              auto-grow
              hint="Sector, tecnologías, estado actual"
              persistent-hint
            />
          </v-col>
        </v-row>

        <div class="cyber-divider" />
        <div class="cyber-subtitle mb-2">// 03 — necesidad de QA</div>
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="form.scopeNotes"
              label="¿Qué necesitas testear? Módulos, funcionalidades, riesgos"
              prepend-inner-icon="mdi-bug-check-outline"
              rows="5"
              auto-grow
              hint="Cuanto más detalle, más preciso el presupuesto"
              persistent-hint
            />
          </v-col>
        </v-row>

        <v-alert v-if="error" type="error" variant="tonal" class="mt-4" density="compact">
          {{ error }}
        </v-alert>

        <div class="d-flex justify-end mt-6 ga-3">
          <v-btn to="/" variant="text">Volver</v-btn>
          <v-btn
            type="submit"
            color="primary"
            size="large"
            :loading="loading"
            prepend-icon="mdi-send"
          >
            Enviar solicitud
          </v-btn>
        </div>
      </v-form>
    </v-card>

    <v-card v-else class="cyber-card cyber-card-glow pa-8 text-center">
      <v-icon size="80" color="success" class="mb-4">mdi-check-decagram</v-icon>
      <h2 class="cyber-title text-h4 mb-3">Recibimos tu solicitud</h2>
      <p class="text-body-1 mb-6">
        Te contactaremos a <span class="cyber-mono cyber-link">{{ form.contactEmail }}</span>
        cuando el especialista termine de revisar el alcance.
      </p>
      <div class="cyber-tag mb-6">
        <span>tracking id</span>
        <span class="cyber-mono">{{ ack.id }}</span>
      </div>
      <div>
        <v-btn to="/" variant="outlined" color="primary">Volver al inicio</v-btn>
      </div>
    </v-card>
  </v-container>
</template>
