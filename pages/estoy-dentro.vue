<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useApi } from '~/composables/useApi'

useHead({ title: 'Estoy dentro — MBP Testing' })

const auth = useAuthStore()
const api = useApi()

const message = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await api.get<{ message: string }>('/hello')
    message.value = res.message
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cargar el mensaje'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="pa-6" elevation="2">
          <div class="text-center mb-4">
            <v-avatar color="success" size="72" class="mb-3">
              <v-icon size="40" color="white">mdi-shield-check</v-icon>
            </v-avatar>
            <h1 class="text-h4 font-weight-medium">¡Estás dentro!</h1>
            <p class="text-body-1 text-medium-emphasis mt-2">
              Esta página solo es visible para usuarios autenticados.
            </p>
          </div>

          <v-divider class="my-4" />

          <v-list density="comfortable">
            <v-list-item prepend-icon="mdi-account">
              <v-list-item-title>Nombre</v-list-item-title>
              <v-list-item-subtitle>{{ auth.fullName }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-email">
              <v-list-item-title>Email</v-list-item-title>
              <v-list-item-subtitle>{{ auth.email }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-shield-account">
              <v-list-item-title>Roles</v-list-item-title>
              <v-list-item-subtitle>{{ auth.roles.join(', ') || '—' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-divider class="my-4" />

          <div class="mb-4">
            <p class="text-overline mb-2">Respuesta del backend (GET /api/hello)</p>
            <v-skeleton-loader v-if="loading" type="text" />
            <v-alert v-else-if="error" type="error" variant="tonal" density="compact">
              {{ error }}
            </v-alert>
            <v-alert v-else type="success" variant="tonal" density="compact">
              {{ message }}
            </v-alert>
          </div>

          <v-btn block color="primary" variant="tonal" to="/bienvenida" prepend-icon="mdi-arrow-left">
            Volver a bienvenida
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
