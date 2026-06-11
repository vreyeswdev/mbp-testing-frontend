<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

useHead({ title: 'Bienvenida — MBP Testing' })

const auth = useAuthStore()
</script>

<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="pa-6" elevation="2">
          <div class="text-center mb-4">
            <v-avatar color="primary" size="72" class="mb-3">
              <v-icon size="40" color="white">mdi-hand-wave</v-icon>
            </v-avatar>
            <h1 class="text-h4 font-weight-medium">Bienvenido a MBP Testing</h1>
            <p class="text-body-1 text-medium-emphasis mt-2">
              Una aplicación de prueba con Spring Boot, Nuxt 4 y Vuetify (Material Design).
            </p>
          </div>

          <v-divider class="my-4" />

          <div class="d-flex flex-column ga-3">
            <template v-if="auth.isAuthenticated">
              <p class="text-body-2 text-center">
                Sesión activa como <strong>{{ auth.fullName }}</strong>.
              </p>
              <v-btn color="primary" size="large" to="/estoy-dentro" prepend-icon="mdi-shield-check">
                Ir a "Estoy dentro"
              </v-btn>
              <v-btn variant="text" @click="auth.logout()" prepend-icon="mdi-logout">
                Cerrar sesión
              </v-btn>
            </template>
            <template v-else>
              <v-btn color="primary" size="large" to="/login" prepend-icon="mdi-login">
                Iniciar sesión
              </v-btn>
            </template>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
