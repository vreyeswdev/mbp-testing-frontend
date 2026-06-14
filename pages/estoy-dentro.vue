<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useApi } from '~/composables/useApi'

definePageMeta({ layout: 'console' })

const { t } = useI18n()
useHead({ title: () => `${t('profile.title')} — ${t('common.appName')}` })

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
    error.value = e?.data?.message || t('common.errorLoad')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-container class="py-8" max-width="1080">
    <div class="mb-6">
      <div class="text-overline text-medium-emphasis">{{ t('profile.overline') }}</div>
      <h1 class="text-h4 font-weight-bold">{{ t('profile.title') }}</h1>
    </div>

    <v-row>
      <v-col cols="12" md="7">
        <v-card variant="outlined">
          <v-card-title class="text-subtitle-1 font-weight-medium">{{ t('profile.sessionData') }}</v-card-title>
          <v-divider />
          <v-list density="comfortable">
            <v-list-item prepend-icon="mdi-account-outline">
              <v-list-item-title>{{ t('common.fullName') }}</v-list-item-title>
              <v-list-item-subtitle>{{ auth.fullName || t('common.emptyDash') }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-email-outline">
              <v-list-item-title>{{ t('common.email') }}</v-list-item-title>
              <v-list-item-subtitle>{{ auth.email || t('common.emptyDash') }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-shield-account-outline">
              <v-list-item-title>{{ t('auth.roles') }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ (auth.roleLabels.length ? auth.roleLabels : auth.roles).join(', ') || t('common.emptyDash') }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card variant="outlined">
          <v-card-title class="text-subtitle-1 font-weight-medium">{{ t('profile.backendStatus') }}</v-card-title>
          <v-divider />
          <v-card-text>
            <v-skeleton-loader v-if="loading" type="text" />
            <v-alert v-else-if="error" type="error" variant="tonal" density="compact">
              {{ error }}
            </v-alert>
            <v-alert v-else type="success" variant="tonal" density="compact">
              {{ message }}
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
