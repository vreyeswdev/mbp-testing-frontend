<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { Role } from '~/stores/auth'
import { useApi } from '~/composables/useApi'

const { t } = useI18n()
useHead({ title: () => `${t('auth.login')} — ${t('common.appName')}` })

interface AuthResponse {
  accessToken: string
  expiresInMs: number
  user: { id: string; email: string; fullName: string; roles: Role[]; roleLabels?: string[] }
}

const auth = useAuthStore()
const api = useApi()

const email = ref('user@mbp.test')
const password = ref('User1234')
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const formRef = ref()

const emailRules = [
  (v: string) => !!v || t('auth.emailRequired'),
  (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || t('auth.emailInvalid')
]
const passwordRules = [
  (v: string) => !!v || t('auth.passwordRequired'),
  (v: string) => (v?.length ?? 0) >= 8 || t('auth.passwordMin')
]

async function onSubmit() {
  error.value = null
  const { valid } = await formRef.value?.validate()
  if (!valid) return
  loading.value = true
  try {
    const res = await api.post<AuthResponse>('/auth/login', {
      email: email.value,
      password: password.value
    })
    auth.setSession({ accessToken: res.accessToken, user: res.user })
    await navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e?.data?.message || t('auth.loginFailed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card variant="outlined" class="pa-6">
          <div class="text-center mb-6">
            <v-icon size="48" color="primary" class="mb-2">mdi-shield-check-outline</v-icon>
            <h1 class="text-h5 font-weight-bold">{{ t('auth.portalAccess') }}</h1>
            <p class="text-body-2 text-medium-emphasis mt-1">
              {{ t('auth.portalSubtitle') }}
            </p>
          </div>

          <v-alert v-if="error" type="error" variant="tonal" class="mb-4" density="compact">
            {{ error }}
          </v-alert>

          <v-form ref="formRef" @submit.prevent="onSubmit">
            <v-text-field
              v-model="email"
              :label="t('common.email')"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              :rules="emailRules"
              autocomplete="email"
              class="mb-2"
            />
            <v-text-field
              v-model="password"
              :label="t('common.password')"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
              :rules="passwordRules"
              autocomplete="current-password"
              class="mb-2"
            />

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
              class="mt-3"
            >
              {{ t('auth.enter') }}
            </v-btn>
          </v-form>

          <v-divider class="my-4" />

          <p class="text-caption text-center text-medium-emphasis mb-2">
            {{ t('auth.noAccount') }}
            <NuxtLink to="/solicitar" class="text-primary">{{ t('auth.requestService') }}</NuxtLink>
          </p>
          <p class="text-caption text-center text-medium-emphasis font-mono">
            {{ t('auth.demoNote') }}
          </p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
