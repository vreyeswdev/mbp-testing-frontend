<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const { t } = useI18n()
const year = new Date().getFullYear()
</script>

<template>
  <v-app>
    <v-app-bar density="comfortable" flat border>
      <v-container class="d-flex align-center py-0" fluid>
        <NuxtLink to="/" class="text-decoration-none text-on-surface">
          <BrandMark :size="28" />
        </NuxtLink>
        <v-spacer />
        <v-btn variant="text" to="/#servicios" class="d-none d-sm-inline-flex">{{ t('nav.services') }}</v-btn>
        <v-btn variant="text" to="/#proceso" class="d-none d-sm-inline-flex">{{ t('nav.process') }}</v-btn>
        <v-btn variant="text" to="/solicitar">{{ t('nav.requestService') }}</v-btn>
        <ThemeToggle class="ms-2" />
        <template v-if="auth.isAuthenticated">
          <v-btn color="primary" variant="flat" to="/dashboard" prepend-icon="mdi-view-dashboard-outline" class="ms-2">
            {{ t('nav.goToPanel') }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn color="primary" variant="flat" to="/login" prepend-icon="mdi-login" class="ms-2">
            {{ t('auth.login') }}
          </v-btn>
        </template>
      </v-container>
    </v-app-bar>

    <v-main>
      <slot />
    </v-main>

    <v-footer color="surface" class="border-t">
      <v-container>
        <v-row align="center" no-gutters>
          <v-col cols="12" md="6" class="text-body-2 text-medium-emphasis">
            {{ t('footer.copyright', { year, tagline: t('footer.tagline') }) }}
          </v-col>
          <v-col cols="12" md="6" class="text-md-end text-body-2 text-medium-emphasis">
            <NuxtLink to="/solicitar" class="text-decoration-none me-4">{{ t('nav.requestService') }}</NuxtLink>
            <NuxtLink to="/login" class="text-decoration-none">{{ t('nav.clientsAccess') }}</NuxtLink>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </v-app>
</template>
