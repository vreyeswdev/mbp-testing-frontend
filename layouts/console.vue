<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotifications } from '~/composables/useNotifications'

const auth = useAuthStore()
const notif = useNotifications()
const { t } = useI18n()
const drawer = ref(true)
const rail = ref(false)

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
  if (n.refType === 'FIX' && n.refId) navigateTo(`/fixes/${n.refId}`)
  else if (n.refType === 'COMMENT') navigateTo('/notifications')
}

const nav = computed(() => [
  { title: t('nav.dashboard'), icon: 'mdi-view-dashboard-outline', to: '/dashboard' },
  { title: t('nav.requests'), icon: 'mdi-clipboard-text-outline', to: '/requests' },
  { title: t('nav.notifications'), icon: 'mdi-bell-outline', to: '/notifications' },
  { title: t('nav.profile'), icon: 'mdi-account-circle-outline', to: '/estoy-dentro' }
])

const adminNav = computed(() => {
  const items: { title: string; icon: string; to: string }[] = []
  if (auth.isAdmin || auth.isEspecialista) {
    items.push({ title: t('nav.submissions'), icon: 'mdi-inbox-arrow-down-outline', to: '/admin/submissions' })
  }
  if (auth.isAdmin) {
    items.push(
      { title: t('nav.companies'), icon: 'mdi-domain', to: '/admin/companias' },
      { title: t('nav.testTypes'), icon: 'mdi-test-tube', to: '/admin/test-types' },
      { title: t('nav.environments'), icon: 'mdi-server-outline', to: '/admin/environments' }
    )
  }
  return items
})

const initials = computed(() => {
  const name = auth.fullName || auth.email || ''
  return name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
})
</script>

<template>
  <v-app theme="mbpConsole">
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
      <v-list-item nav class="py-3">
        <template #prepend>
          <v-icon color="primary">mdi-shield-check-outline</v-icon>
        </template>
        <v-list-item-title class="font-weight-bold">{{ t('common.appName') }}</v-list-item-title>
        <v-list-item-subtitle class="text-caption">{{ t('nav.console') }}</v-list-item-subtitle>
        <template #append>
          <v-btn
            variant="text"
            size="small"
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            @click="rail = !rail"
          />
        </template>
      </v-list-item>

      <v-divider />

      <v-list density="comfortable" nav>
        <v-list-item
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
        />
      </v-list>

      <template v-if="adminNav.length">
        <v-divider class="my-2" />
        <v-list-subheader v-if="!rail">{{ t('nav.administration') }}</v-list-subheader>
        <v-list density="comfortable" nav>
          <v-list-item
            v-for="item in adminNav"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
          />
        </v-list>
      </template>

      <template #append>
        <v-divider />
        <v-list density="comfortable" nav>
          <v-list-item @click="auth.logout()" prepend-icon="mdi-logout" :title="t('auth.logout')" />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-app-bar density="comfortable" flat border>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title class="font-weight-medium">
        <span class="d-none d-md-inline">{{ t('nav.adminPanelTitle') }}</span>
      </v-toolbar-title>
      <v-spacer />

      <v-menu>
        <template #activator="{ props }">
          <v-btn icon v-bind="props">
            <v-badge :model-value="notif.unread.value > 0" :content="notif.unread.value" color="error">
              <v-icon>mdi-bell-outline</v-icon>
            </v-badge>
          </v-btn>
        </template>
        <v-card min-width="320" max-width="400">
          <v-card-title class="d-flex align-center text-body-1">
            {{ t('notifications.popoverTitle') }}
            <v-spacer />
            <v-btn
              v-if="notif.unread.value > 0"
              size="x-small"
              variant="text"
              @click="notif.markAllRead()"
            >
              {{ t('notifications.markAllShort') }}
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-list density="comfortable" max-height="400" class="overflow-y-auto">
            <v-list-item
              v-for="n in notif.list.value.slice(0, 10)"
              :key="n.id"
              :active="!n.readAt"
              @click="clickNotification(n)"
            >
              <v-list-item-title class="text-body-2">{{ n.message }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ new Date(n.createdAt).toLocaleString() }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="notif.list.value.length === 0">
              <v-list-item-title class="text-caption text-medium-emphasis text-center">
                {{ t('notifications.empty2') }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
          <v-divider />
          <v-card-actions>
            <v-btn variant="text" size="small" to="/notifications" block>{{ t('notifications.viewAll') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>

      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="ms-2" prepend-icon="mdi-chevron-down">
            <v-avatar color="primary" size="28" class="me-2">
              <span class="text-caption font-weight-bold">{{ initials }}</span>
            </v-avatar>
            <span class="d-none d-sm-inline">{{ auth.fullName || auth.email }}</span>
          </v-btn>
        </template>
        <v-list density="comfortable">
          <v-list-item to="/estoy-dentro" prepend-icon="mdi-account-circle-outline" :title="t('nav.profile')" />
          <v-divider />
          <v-list-item @click="auth.logout()" prepend-icon="mdi-logout" :title="t('auth.logout')" />
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>
