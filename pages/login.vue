<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { Role } from '~/stores/auth'
import { useApi } from '~/composables/useApi'

useHead({ title: 'Iniciar sesión — MBP Testing' })

interface AuthResponse {
  accessToken: string
  expiresInMs: number
  user: { id: string; email: string; fullName: string; roles: Role[] }
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
  (v: string) => !!v || 'El email es requerido',
  (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || 'Email inválido'
]
const passwordRules = [
  (v: string) => !!v || 'La contraseña es requerida',
  (v: string) => (v?.length ?? 0) >= 8 || 'Mínimo 8 caracteres'
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
    await navigateTo('/estoy-dentro')
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card class="pa-6" elevation="3">
          <div class="text-center mb-6">
            <v-avatar color="primary" size="64" class="mb-3">
              <v-icon size="36" color="white">mdi-lock</v-icon>
            </v-avatar>
            <h1 class="text-h5 font-weight-medium">Iniciar sesión</h1>
            <p class="text-body-2 text-medium-emphasis">Accede con tu cuenta</p>
          </div>

          <v-alert v-if="error" type="error" variant="tonal" class="mb-4" density="compact">
            {{ error }}
          </v-alert>

          <v-form ref="formRef" @submit.prevent="onSubmit">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              :rules="emailRules"
              autocomplete="email"
              class="mb-2"
            />
            <v-text-field
              v-model="password"
              label="Contraseña"
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
              Entrar
            </v-btn>
          </v-form>

          <v-divider class="my-5" />

          <p class="text-caption text-center text-medium-emphasis">
            Credenciales de prueba: <code>user@mbp.test</code> / <code>User1234</code>
          </p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
