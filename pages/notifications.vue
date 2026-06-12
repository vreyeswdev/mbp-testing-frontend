<script setup lang="ts">
import { useNotifications } from '~/composables/useNotifications'

definePageMeta({ ssr: false })

useHead({ title: 'Notificaciones — MBP Testing' })

const notif = useNotifications()

onMounted(() => notif.refresh())

async function onClick(id: string) {
  await notif.markRead(id)
}
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-medium">Notificaciones</h1>
      <v-spacer />
      <v-btn
        v-if="notif.unread.value > 0"
        size="small"
        variant="tonal"
        @click="notif.markAllRead()"
      >
        Marcar todas como leídas
      </v-btn>
    </div>

    <v-card>
      <v-list density="comfortable">
        <v-list-item
          v-for="n in notif.list.value"
          :key="n.id"
          :class="!n.readAt ? 'bg-blue-grey-lighten-5' : ''"
          @click="onClick(n.id)"
        >
          <template #prepend>
            <v-icon>mdi-bell</v-icon>
          </template>
          <v-list-item-title>{{ n.message }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ new Date(n.createdAt).toLocaleString() }}
            <span v-if="n.readAt"> · leída</span>
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item v-if="notif.list.value.length === 0">
          <v-list-item-title class="text-center text-medium-emphasis">
            No tienes notificaciones todavía.
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>
  </v-container>
</template>
