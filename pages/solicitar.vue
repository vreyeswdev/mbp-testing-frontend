<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => `${t('contact.title')} — ${t('common.appName')}` })

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

const requiredRule = (v: string) => !!v?.trim() || t('common.required')
const emailRule = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || t('auth.emailInvalid')

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
    error.value = e?.data?.message || t('contact.errorSend')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="py-10" max-width="900">
    <div v-if="!ack" class="mb-8">
      <div class="text-overline text-primary mb-1">{{ t('contact.overline') }}</div>
      <h1 class="text-h4 font-weight-bold">{{ t('contact.title') }}</h1>
      <p class="text-body-1 text-medium-emphasis mt-2" style="max-width: 720px;">
        {{ t('contact.subtitle') }}
      </p>
    </div>

    <v-card v-if="!ack" variant="outlined" class="pa-6 pa-md-8">
      <v-form ref="formRef" @submit.prevent="submit">
        <div class="text-subtitle-1 font-weight-medium mb-3">{{ t('contact.section1') }}</div>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.contactName"
              :label="t('contact.contactName')"
              prepend-inner-icon="mdi-account-outline"
              :rules="[requiredRule]"
              autocomplete="name"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.contactEmail"
              :label="t('contact.contactEmail')"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              :rules="[requiredRule, emailRule]"
              autocomplete="email"
              :hint="t('contact.contactEmailHint')"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.contactPhone"
              :label="t('contact.contactPhone')"
              prepend-inner-icon="mdi-phone-outline"
              autocomplete="tel"
            />
          </v-col>
        </v-row>

        <v-divider class="my-6" />
        <div class="text-subtitle-1 font-weight-medium mb-3">{{ t('contact.section2') }}</div>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="form.projectName"
              :label="t('contact.projectName')"
              prepend-inner-icon="mdi-rocket-launch-outline"
              :rules="[requiredRule]"
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="form.projectDescription"
              :label="t('contact.projectDescription')"
              prepend-inner-icon="mdi-text-box-outline"
              rows="3"
              auto-grow
              :hint="t('contact.projectDescriptionHint')"
              persistent-hint
            />
          </v-col>
        </v-row>

        <v-divider class="my-6" />
        <div class="text-subtitle-1 font-weight-medium mb-3">{{ t('contact.section3') }}</div>
        <v-row>
          <v-col cols="12">
            <v-textarea
              v-model="form.scopeNotes"
              :label="t('contact.scopeNotes')"
              prepend-inner-icon="mdi-bug-check-outline"
              rows="5"
              auto-grow
              :hint="t('contact.scopeNotesHint')"
              persistent-hint
            />
          </v-col>
        </v-row>

        <v-alert v-if="error" type="error" variant="tonal" class="mt-4" density="compact">
          {{ error }}
        </v-alert>

        <div class="d-flex justify-end mt-6 ga-3">
          <v-btn to="/" variant="text">{{ t('common.back') }}</v-btn>
          <v-btn
            type="submit"
            color="primary"
            size="large"
            :loading="loading"
            prepend-icon="mdi-send"
          >
            {{ t('contact.send') }}
          </v-btn>
        </div>
      </v-form>
    </v-card>

    <v-card v-else variant="tonal" color="success" class="pa-8 text-center">
      <v-icon size="72" color="success" class="mb-4">mdi-check-decagram</v-icon>
      <h2 class="text-h4 font-weight-bold mb-3">{{ t('contact.success.title') }}</h2>
      <p class="text-body-1 mb-4">
        {{ t('contact.success.body', { email: form.contactEmail }) }}
      </p>
      <v-chip variant="outlined" class="font-mono mb-6">
        {{ t('contact.success.trackingId', { id: ack.id }) }}
      </v-chip>
      <div>
        <v-btn to="/" variant="flat" color="primary">{{ t('contact.success.back') }}</v-btn>
      </div>
    </v-card>
  </v-container>
</template>
