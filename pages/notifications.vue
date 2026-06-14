<script setup lang="ts">
import { useNotifications } from '~/composables/useNotifications'

definePageMeta({ ssr: false, layout: 'console' })

const { t } = useI18n()
useHead({ title: () => `${t('notifications.title')} — ${t('common.appName')}` })

const notif = useNotifications()

onMounted(() => notif.refresh())

async function onClick(id: string) {
  await notif.markRead(id)
}
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">{{ t('notifications.overline') }}</div>
        <h1 class="text-h4 font-weight-bold">{{ t('notifications.title') }}</h1>
      </div>
      <v-spacer />
      <v-btn
        v-if="notif.unread.value > 0"
        size="small"
        variant="tonal"
        @click="notif.markAllRead()"
      >
        {{ t('notifications.markAllRead') }}
      </v-btn>
    </div>

    <v-card variant="outlined">
      <v-list density="comfortable">
        <v-list-item
          v-for="n in notif.list.value"
          :key="n.id"
          :active="!n.readAt"
          @click="onClick(n.id)"
        >
          <template #prepend>
            <v-icon>mdi-bell</v-icon>
          </template>
          <v-list-item-title>{{ n.message }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ new Date(n.createdAt).toLocaleString() }}
            <span v-if="n.readAt"> · {{ t('notifications.read') }}</span>
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item v-if="notif.list.value.length === 0">
          <v-list-item-title class="text-center text-medium-emphasis">
            {{ t('notifications.empty') }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>
  </v-container>
</template>
