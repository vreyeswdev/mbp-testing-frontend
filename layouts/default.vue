<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" flat>
      <v-app-bar-title>
        <NuxtLink to="/" class="text-white text-decoration-none font-weight-medium">
          MBP Testing
        </NuxtLink>
      </v-app-bar-title>

      <v-spacer />

      <template v-if="auth.isAuthenticated">
        <v-btn variant="text" color="white" to="/estoy-dentro" prepend-icon="mdi-shield-check">
          Estoy dentro
        </v-btn>
        <v-btn
          v-if="auth.isAdmin"
          variant="text"
          color="white"
          to="/admin/companias"
          prepend-icon="mdi-domain"
        >
          Administración
        </v-btn>
        <v-btn variant="text" color="white" @click="auth.logout()" prepend-icon="mdi-logout">
          Salir
        </v-btn>
      </template>
      <template v-else>
        <v-btn variant="text" color="white" to="/login" prepend-icon="mdi-login">
          Iniciar sesión
        </v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>
