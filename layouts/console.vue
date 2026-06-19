<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotifications } from '~/composables/useNotifications'

const auth = useAuthStore()
const notif = useNotifications()
const { t } = useI18n()
const route = useRoute()

const railCookie = useCookie<'1' | '0'>('mbp_console_rail', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const rail = ref(railCookie.value !== '0')
watch(rail, (v) => { railCookie.value = v ? '1' : '0' })

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
  { title: t('nav.requests'), icon: 'mdi-clipboard-text-outline', to: '/requests' }
])

const adminNav = computed(() => {
  const items: { title: string; icon: string; to: string }[] = []
  if (auth.isAdmin || auth.isEspecialista) {
    items.push(
      { title: t('nav.submissions'), icon: 'mdi-inbox-arrow-down-outline', to: '/admin/submissions' },
      { title: t('nav.cypressRunner'), icon: 'mdi-play-circle-outline', to: '/cypress' }
    )
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

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    '/dashboard': t('nav.dashboard'),
    '/requests': t('nav.requests'),
    '/notifications': t('nav.notifications'),
    '/estoy-dentro': t('nav.profile'),
    '/admin/submissions': t('nav.submissions'),
    '/admin/companias': t('nav.companies'),
    '/admin/test-types': t('nav.testTypes'),
    '/admin/environments': t('nav.environments'),
    '/cypress': t('nav.cypressRunner')
  }
  for (const key of Object.keys(map)) {
    if (route.path === key || route.path.startsWith(key + '/')) return map[key]
  }
  return t('nav.adminPanelTitle')
})
</script>

<template>
  <v-app class="console-app">
    <v-navigation-drawer
      :rail="rail"
      permanent
      :width="248"
      :rail-width="68"
      class="console-drawer"
      color="surface"
    >
      <div class="px-3 py-4 d-flex align-center" :class="rail ? 'justify-center' : 'justify-space-between'">
        <NuxtLink to="/dashboard" class="text-decoration-none text-on-surface">
          <BrandMark :size="28" :show-text="!rail" text-class="text-subtitle-1 font-weight-bold" />
        </NuxtLink>
        <v-btn
          v-if="!rail"
          variant="text"
          density="comfortable"
          icon="mdi-chevron-left"
          size="small"
          @click="rail = true"
        />
      </div>
      <v-btn
        v-if="rail"
        variant="text"
        density="comfortable"
        icon="mdi-chevron-right"
        size="small"
        class="d-block mx-auto mb-2"
        @click="rail = false"
      />

      <v-divider class="opacity-50" />

      <v-list density="compact" nav class="px-2">
        <v-list-item
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          class="console-nav-item"
          rounded="lg"
        />
      </v-list>

      <template v-if="adminNav.length">
        <v-divider class="opacity-50 mx-3 my-2" />
        <div v-if="!rail" class="px-5 text-caption text-medium-emphasis text-uppercase font-weight-medium mb-1">
          {{ t('nav.administration') }}
        </div>
        <v-list density="compact" nav class="px-2">
          <v-list-item
            v-for="item in adminNav"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            class="console-nav-item"
            rounded="lg"
          />
        </v-list>
      </template>

      <template #append>
        <v-divider class="opacity-50" />
        <v-list density="compact" nav class="px-2 py-2">
          <v-list-item
            @click="auth.logout()"
            prepend-icon="mdi-logout"
            :title="t('auth.logout')"
            class="console-nav-item"
            rounded="lg"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-app-bar density="comfortable" flat class="console-bar" color="background">
      <v-toolbar-title class="font-weight-semibold text-body-1 ps-2">
        {{ pageTitle }}
      </v-toolbar-title>
      <v-spacer />

      <ThemeToggle />

      <v-menu>
        <template #activator="{ props }">
          <v-btn icon v-bind="props" variant="text">
            <v-badge :model-value="notif.unread.value > 0" :content="notif.unread.value" color="error" offset-x="2" offset-y="2">
              <v-icon>mdi-bell-outline</v-icon>
            </v-badge>
          </v-btn>
        </template>
        <v-card min-width="320" max-width="400" elevation="8" rounded="lg">
          <v-card-title class="d-flex align-center text-body-1 py-3">
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
          <v-list density="compact" max-height="400" class="overflow-y-auto py-0">
            <v-list-item
              v-for="n in notif.list.value.slice(0, 10)"
              :key="n.id"
              :active="!n.readAt"
              @click="clickNotification(n)"
              class="py-2"
            >
              <v-list-item-title class="text-body-2">{{ n.message }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ new Date(n.createdAt).toLocaleString() }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="notif.list.value.length === 0">
              <v-list-item-title class="text-caption text-medium-emphasis text-center py-4">
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
          <v-btn v-bind="props" variant="text" class="ms-1 console-user-btn">
            <v-avatar color="primary" size="28" class="me-2">
              <span class="text-caption font-weight-bold">{{ initials }}</span>
            </v-avatar>
            <span class="d-none d-sm-inline text-body-2">{{ auth.fullName || auth.email }}</span>
            <v-icon end size="18">mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item to="/estoy-dentro" prepend-icon="mdi-account-circle-outline" :title="t('nav.profile')" />
          <v-list-item to="/manual" prepend-icon="mdi-book-open-page-variant-outline" title="Manual de uso" />
          <v-divider />
          <v-list-item @click="auth.logout()" prepend-icon="mdi-logout" :title="t('auth.logout')" />
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main class="console-main">
      <slot />
    </v-main>
  </v-app>
</template>

<style scoped>
.console-app :deep(.console-drawer .v-navigation-drawer__content) {
  scrollbar-width: thin;
}
.console-bar {
  border-bottom: 1px solid rgb(var(--v-theme-surface-variant));
}
.console-main {
  background: rgb(var(--v-theme-background));
}
.console-nav-item {
  margin-bottom: 2px;
  min-height: 38px;
}
.console-nav-item :deep(.v-list-item-title) {
  font-size: 0.875rem;
  font-weight: 500;
}
.console-nav-item.v-list-item--active {
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
}
.console-nav-item.v-list-item--active :deep(.v-icon) {
  color: rgb(var(--v-theme-primary));
}
.console-user-btn {
  text-transform: none;
}
</style>
