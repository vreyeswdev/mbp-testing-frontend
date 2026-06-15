<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import banner from '~/assets/banner.jpg'

const { t } = useI18n()
useHead({ title: () => `${t('common.appName')} — ${t('welcome.title')}` })

const auth = useAuthStore()

const services = computed(() => [
  { icon: 'mdi-clipboard-check-outline', title: t('welcome.services.functional.title'), description: t('welcome.services.functional.description') },
  { icon: 'mdi-robot-outline', title: t('welcome.services.automation.title'), description: t('welcome.services.automation.description') },
  { icon: 'mdi-shield-bug-outline', title: t('welcome.services.security.title'), description: t('welcome.services.security.description') }
])

const flow = computed(() => [
  { step: '1', icon: 'mdi-send-outline', title: t('welcome.process.s1.title'), description: t('welcome.process.s1.description') },
  { step: '2', icon: 'mdi-file-document-edit-outline', title: t('welcome.process.s2.title'), description: t('welcome.process.s2.description') },
  { step: '3', icon: 'mdi-account-key-outline', title: t('welcome.process.s3.title'), description: t('welcome.process.s3.description') },
  { step: '4', icon: 'mdi-view-dashboard-outline', title: t('welcome.process.s4.title'), description: t('welcome.process.s4.description') }
])

const benefits = computed(() => [
  { icon: 'mdi-clock-check-outline', text: t('welcome.benefits.tracked') },
  { icon: 'mdi-source-branch', text: t('welcome.benefits.flow') },
  { icon: 'mdi-chart-line', text: t('welcome.benefits.metrics') },
  { icon: 'mdi-file-document-check-outline', text: t('welcome.benefits.reports') }
])
</script>

<template>
  <v-sheet color="surface" class="border-b">
    <v-container class="py-16">
      <v-row align="center">
        <v-col cols="12" md="7">
          <div class="text-overline text-primary mb-2">{{ t('welcome.overline') }}</div>
          <h1 class="text-h3 text-md-h2 font-weight-bold mb-4">{{ t('welcome.title') }}</h1>
          <p class="text-body-1 text-medium-emphasis mb-6" style="max-width: 640px;">
            {{ t('welcome.subtitle') }}
          </p>
          <div class="d-flex flex-wrap ga-3">
            <v-btn color="primary" size="large" to="/solicitar" prepend-icon="mdi-send">
              {{ t('welcome.ctaPrimary') }}
            </v-btn>
            <v-btn variant="outlined" size="large" to="/login" prepend-icon="mdi-login">
              {{ t('welcome.ctaSecondary') }}
            </v-btn>
          </div>
        </v-col>
        <v-col cols="12" md="5" class="d-none d-md-block">
          <div class="welcome-banner">
            <img :src="banner" alt="QA Services" class="welcome-banner__img" />
            <div class="welcome-banner__shine" aria-hidden="true" />
          </div>
          <v-card variant="tonal" color="primary" class="pa-4 mt-4">
            <v-list bg-color="transparent" density="compact">
              <v-list-item
                v-for="b in benefits"
                :key="b.text"
                :prepend-icon="b.icon"
                :title="b.text"
              />
            </v-list>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>

  <v-container id="servicios" class="py-16">
    <div class="text-center mb-10">
      <div class="text-overline text-primary mb-1">{{ t('welcome.services.overline') }}</div>
      <h2 class="text-h4 font-weight-bold">{{ t('welcome.services.title') }}</h2>
    </div>
    <v-row>
      <v-col v-for="s in services" :key="s.title" cols="12" md="4">
        <v-card variant="outlined" class="pa-6 h-100">
          <v-icon color="primary" size="36" class="mb-3">{{ s.icon }}</v-icon>
          <h3 class="text-h6 font-weight-medium mb-2">{{ s.title }}</h3>
          <p class="text-body-2 text-medium-emphasis mb-0">{{ s.description }}</p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <v-sheet color="surface-variant" id="proceso">
    <v-container class="py-16">
      <div class="text-center mb-10">
        <div class="text-overline text-primary mb-1">{{ t('welcome.process.overline') }}</div>
        <h2 class="text-h4 font-weight-bold">{{ t('welcome.process.title') }}</h2>
      </div>
      <v-row>
        <v-col v-for="step in flow" :key="step.step" cols="12" sm="6" md="3">
          <v-card variant="flat" class="pa-5 h-100">
            <div class="d-flex align-center mb-3">
              <v-avatar color="primary" size="36" class="me-3">
                <span class="text-body-1 font-weight-bold">{{ step.step }}</span>
              </v-avatar>
              <v-icon color="primary">{{ step.icon }}</v-icon>
            </div>
            <h3 class="text-subtitle-1 font-weight-medium mb-2">{{ step.title }}</h3>
            <p class="text-body-2 text-medium-emphasis mb-0">{{ step.description }}</p>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>

  <v-container class="py-16">
    <v-row justify="center">
      <v-col cols="12" md="10">
        <v-card variant="tonal" color="primary" class="pa-8 text-center">
          <h2 class="text-h4 font-weight-bold mb-3">{{ t('welcome.cta.title') }}</h2>
          <p class="text-body-1 mb-6" style="max-width: 640px; margin: 0 auto;">
            {{ t('welcome.cta.subtitle') }}
          </p>
          <div class="d-flex justify-center ga-3 flex-wrap">
            <v-btn color="primary" size="large" to="/solicitar" prepend-icon="mdi-send">
              {{ t('welcome.ctaPrimary') }}
            </v-btn>
            <template v-if="auth.isAuthenticated">
              <v-btn variant="outlined" size="large" to="/dashboard" prepend-icon="mdi-view-dashboard-outline">
                {{ t('nav.goToPanel') }}
              </v-btn>
            </template>
            <template v-else>
              <v-btn variant="outlined" size="large" to="/login" prepend-icon="mdi-login">
                {{ t('auth.login') }}
              </v-btn>
            </template>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.welcome-banner {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 24px 60px -24px rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(var(--v-theme-surface-variant), 0.8);
  isolation: isolate;
}
.welcome-banner__img {
  display: block;
  width: 100%;
  height: auto;
}
.welcome-banner__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(255, 255, 255, 0.08) 50%, transparent 60%);
  pointer-events: none;
}
</style>
