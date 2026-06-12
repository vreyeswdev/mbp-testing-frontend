<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotifications } from '~/composables/useNotifications'

const auth = useAuthStore()
const notif = useNotifications()

onMounted(() => {
  if (auth.isAuthenticated) notif.startPolling()
})
onBeforeUnmount(() => notif.stopPolling())

watch(() => auth.isAuthenticated, (v) => {
  if (v) notif.startPolling()
  else notif.stopPolling()
})

async function clickNotification(n: { id: string; refType: string | null; refId: string | null }) {
  await notif.markRead(n.id)
  if (n.refType === 'FIX' && n.refId) {
    navigateTo(`/fixes/${n.refId}`)
  } else if (n.refType === 'COMMENT') {
    navigateTo('/notifications')
  }
}
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
        <v-btn variant="text" color="white" to="/dashboard" prepend-icon="mdi-view-dashboard">
          Dashboard
        </v-btn>
        <v-btn variant="text" color="white" to="/requests" prepend-icon="mdi-clipboard-text">
          Solicitudes
        </v-btn>
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
        <v-menu v-if="auth.isAdmin" open-on-hover>
          <template #activator="{ props }">
            <v-btn variant="text" color="white" prepend-icon="mdi-book-open-variant" v-bind="props">
              Catálogos
            </v-btn>
          </template>
          <v-list>
            <v-list-item to="/admin/test-types" prepend-icon="mdi-test-tube">
              <v-list-item-title>Test types</v-list-item-title>
            </v-list-item>
            <v-list-item to="/admin/environments" prepend-icon="mdi-server">
              <v-list-item-title>Environments</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-menu>
          <template #activator="{ props }">
            <v-btn icon v-bind="props">
              <v-badge :model-value="notif.unread.value > 0" :content="notif.unread.value" color="error">
                <v-icon color="white">mdi-bell</v-icon>
              </v-badge>
            </v-btn>
          </template>
          <v-card min-width="320" max-width="400">
            <v-card-title class="d-flex align-center">
              <span class="text-body-1">Notificaciones</span>
              <v-spacer />
              <v-btn
                v-if="notif.unread.value > 0"
                size="x-small"
                variant="text"
                @click="notif.markAllRead()"
              >
                Marcar leídas
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-list density="comfortable" max-height="400" class="overflow-y-auto">
              <v-list-item
                v-for="n in notif.list.value.slice(0, 10)"
                :key="n.id"
                :class="!n.readAt ? 'bg-blue-grey-lighten-5' : ''"
                @click="clickNotification(n)"
              >
                <v-list-item-title class="text-body-2">{{ n.message }}</v-list-item-title>
                <v-list-item-subtitle>{{ new Date(n.createdAt).toLocaleString() }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="notif.list.value.length === 0">
                <v-list-item-title class="text-caption text-medium-emphasis text-center">
                  Sin notificaciones
                </v-list-item-title>
              </v-list-item>
            </v-list>
            <v-divider />
            <v-card-actions>
              <v-btn variant="text" size="small" to="/notifications" block>Ver todas</v-btn>
            </v-card-actions>
          </v-card>
        </v-menu>

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
