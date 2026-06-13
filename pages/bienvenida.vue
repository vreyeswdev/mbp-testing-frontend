<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

useHead({ title: 'MBP Testing — QA & Security Engineering' })

const auth = useAuthStore()
</script>

<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="9">
        <div class="text-center mb-10">
          <span class="cyber-subtitle">// qa engineering platform //</span>
          <h1 class="text-h2 cyber-title mt-2 cyber-glow-text">MBP Testing</h1>
          <p class="text-body-1 mt-4 text-medium-emphasis" style="max-width: 640px; margin: 0 auto;">
            Pruebas funcionales, automatización y seguridad como servicio.
            Tableros kanban, presupuestos cronometrados, y trazabilidad completa
            del bug al fix.
          </p>
        </div>

        <v-row dense>
          <v-col cols="12" md="6">
            <v-card class="cyber-card pa-6 h-100">
              <div class="d-flex align-center mb-3">
                <v-icon color="primary" size="28" class="me-2">mdi-shield-bug-outline</v-icon>
                <span class="cyber-subtitle">// soy cliente</span>
              </div>
              <h2 class="text-h5 mb-3">¿Necesitas testear tu producto?</h2>
              <p class="text-body-2 text-medium-emphasis mb-5">
                Pide un análisis de QA sin crear cuenta. Recibimos tu solicitud,
                definimos el alcance y te enviamos un presupuesto. Si lo apruebas,
                creamos tu compañía, usuario y proyecto automáticamente.
              </p>
              <v-btn color="primary" size="large" to="/solicitar" prepend-icon="mdi-send">
                Solicitar servicio
              </v-btn>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card class="cyber-card pa-6 h-100">
              <div class="d-flex align-center mb-3">
                <v-icon color="primary" size="28" class="me-2">mdi-shield-key-outline</v-icon>
                <span class="cyber-subtitle">// ya tengo cuenta</span>
              </div>
              <h2 class="text-h5 mb-3">Acceso al portal</h2>
              <template v-if="auth.isAuthenticated">
                <p class="text-body-2 text-medium-emphasis mb-5">
                  Sesión activa como <strong class="cyber-mono">{{ auth.fullName }}</strong>.
                </p>
                <div class="d-flex flex-column ga-2">
                  <v-btn color="primary" size="large" to="/dashboard" prepend-icon="mdi-view-dashboard">
                    Ir al dashboard
                  </v-btn>
                  <v-btn variant="text" @click="auth.logout()" prepend-icon="mdi-logout">
                    Cerrar sesión
                  </v-btn>
                </div>
              </template>
              <template v-else>
                <p class="text-body-2 text-medium-emphasis mb-5">
                  Si ya recibiste credenciales por email, entra al portal para ver
                  el avance de tu proyecto en tiempo real.
                </p>
                <v-btn color="primary" size="large" to="/login" prepend-icon="mdi-login">
                  Iniciar sesión
                </v-btn>
              </template>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
