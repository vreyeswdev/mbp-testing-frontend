<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'
import { useCatalog } from '~/composables/useCatalog'

definePageMeta({ ssr: false, layout: 'console' })

const { t } = useI18n()
useHead({ title: () => `${t('board.title')} — ${t('common.appName')}` })

interface TestCardDto {
  id: string
  testRequestId: string
  featureId: string | null
  featureName: string | null
  title: string
  description: string | null
  status: 'BACKLOG' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE'
  statusLabel: string
  position: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

interface TestRequestDto {
  id: string
  projectId: string
  title: string
  status: string
  assignedSpecialistId: string | null
}

interface FeatureDto {
  id: string
  name: string
  moduleId: string
}

interface ModuleDto {
  id: string
  name: string
  projectId: string
}

const COLUMNS = computed<Array<{ key: TestCardDto['status']; label: string; color: string; icon: string }>>(() => [
  { key: 'BACKLOG',     label: t('board.columns.BACKLOG'),     color: 'secondary', icon: 'mdi-tray-full' },
  { key: 'IN_PROGRESS', label: t('board.columns.IN_PROGRESS'), color: 'primary',   icon: 'mdi-play-circle-outline' },
  { key: 'ON_HOLD',     label: t('board.columns.ON_HOLD'),     color: 'warning',   icon: 'mdi-pause-circle-outline' },
  { key: 'DONE',        label: t('board.columns.DONE'),        color: 'success',   icon: 'mdi-check-circle-outline' }
])

const route = useRoute()
const api = useApi()
const auth = useAuthStore()
const catalog = useCatalog()
const id = computed(() => route.params.id as string)

const request = ref<TestRequestDto | null>(null)
const cards = ref<TestCardDto[]>([])
const features = ref<FeatureDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const dialog = ref(false)
const form = ref<{ featureId: string | null; title: string; description: string; status: TestCardDto['status'] }>({
  featureId: null,
  title: '',
  description: '',
  status: 'BACKLOG'
})

interface FixDto {
  id: string
  title: string
  severity: string
  severityLabel: string
  status: string
  statusLabel: string
  createdAt: string
}

const fixesDialog = ref(false)
const fixesCard = ref<TestCardDto | null>(null)
const cardFixes = ref<FixDto[]>([])
const newFix = ref({ title: '', description: '', severity: 'MINOR' })

async function load() {
  loading.value = true
  error.value = null
  try {
    await catalog.loadAll()
    request.value = await api.get<TestRequestDto>(`/test-requests/${id.value}`)
    cards.value = await api.get<TestCardDto[]>(`/test-requests/${id.value}/cards`)
    if (request.value) {
      const modules = await api.get<ModuleDto[]>(`/projects/${request.value.projectId}/modules`)
      const featureCalls = modules.map(m => api.get<FeatureDto[]>(`/modules/${m.id}/features`))
      const lists = await Promise.all(featureCalls)
      features.value = lists.flat()
    }
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorLoad')
  } finally {
    loading.value = false
  }
}

const canEdit = computed(() => {
  if (auth.isAdmin) return true
  if (!request.value) return false
  return auth.id !== null && auth.id === request.value.assignedSpecialistId
})

const grouped = computed(() => {
  const map: Record<TestCardDto['status'], TestCardDto[]> = {
    BACKLOG: [], IN_PROGRESS: [], ON_HOLD: [], DONE: []
  }
  for (const c of cards.value) {
    map[c.status].push(c)
  }
  for (const k of Object.keys(map) as TestCardDto['status'][]) {
    map[k].sort((a, b) => a.position - b.position)
  }
  return map
})

function openNew(status: TestCardDto['status']) {
  form.value = { featureId: null, title: '', description: '', status }
  dialog.value = true
}

async function save() {
  try {
    await api.post<TestCardDto>(`/test-requests/${id.value}/cards`, {
      featureId: form.value.featureId,
      title: form.value.title,
      description: form.value.description || null,
      status: form.value.status,
      position: null
    })
    dialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorCreate')
  }
}

async function move(card: TestCardDto, status: TestCardDto['status']) {
  const lastPos = grouped.value[status].length
  try {
    await api.post(`/cards/${card.id}/move`, { status, position: lastPos })
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  }
}

async function remove(card: TestCardDto) {
  try {
    await api.del(`/cards/${card.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
  }
}

async function openFixes(card: TestCardDto) {
  fixesCard.value = card
  newFix.value = { title: '', description: '', severity: 'MINOR' }
  try {
    cardFixes.value = await api.get<FixDto[]>(`/test-cards/${card.id}/fixes`)
    fixesDialog.value = true
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorLoad')
  }
}

async function createFix() {
  if (!fixesCard.value || !newFix.value.title.trim()) return
  try {
    await api.post<FixDto>(`/test-cards/${fixesCard.value.id}/fixes`, {
      title: newFix.value.title,
      description: newFix.value.description || null,
      severity: newFix.value.severity,
      assignedToId: null
    })
    cardFixes.value = await api.get<FixDto[]>(`/test-cards/${fixesCard.value.id}/fixes`)
    newFix.value = { title: '', description: '', severity: 'MINOR' }
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorCreate')
  }
}

function fixStatusColor(s: string) {
  return ({
    OPEN: 'red',
    IN_REVIEW: 'amber',
    RESOLVED: 'success',
    WONT_FIX: 'grey'
  } as Record<string, string>)[s] ?? 'grey'
}

function nextStatus(s: TestCardDto['status']): TestCardDto['status'] | null {
  const cols = COLUMNS.value
  const i = cols.findIndex(c => c.key === s)
  const next = i >= 0 && i < cols.length - 1 ? cols[i + 1] : null
  return next ? next.key : null
}

function prevStatus(s: TestCardDto['status']): TestCardDto['status'] | null {
  const cols = COLUMNS.value
  const i = cols.findIndex(c => c.key === s)
  const prev = i > 0 ? cols[i - 1] : null
  return prev ? prev.key : null
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : '—'
}

onMounted(load)
</script>

<template>
  <v-container class="py-6" fluid>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="`/requests/${id}`" class="mb-3">
      {{ t('board.back') }}
    </v-btn>

    <div class="mb-5">
      <div class="text-overline text-medium-emphasis">{{ t('board.overline') }}</div>
      <h1 class="text-h4 font-weight-bold">
        {{ t('board.title') }}
        <span v-if="request" class="text-body-1 text-medium-emphasis ms-2">· {{ request.title }}</span>
      </h1>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading && cards.length === 0" type="card" />

    <v-row v-else>
      <v-col v-for="col in COLUMNS" :key="col.key" cols="12" md="3">
        <v-card variant="outlined" class="h-100">
          <v-card-title class="d-flex align-center">
            <v-icon class="me-2" :color="col.color">{{ col.icon }}</v-icon>
            <span class="text-body-2 font-weight-medium">{{ col.label }}</span>
            <v-spacer />
            <v-chip size="x-small" variant="tonal" :color="col.color">
              {{ grouped[col.key].length }}
            </v-chip>
          </v-card-title>
          <v-card-actions v-if="canEdit">
            <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="openNew(col.key)">
              {{ t('board.addCard') }}
            </v-btn>
          </v-card-actions>
          <v-divider />
          <v-card-text class="px-2 py-2">
            <v-card
              v-for="card in grouped[col.key]"
              :key="card.id"
              class="mb-2"
              variant="outlined"
              :color="col.color"
            >
              <v-card-title class="text-body-1">{{ card.title }}</v-card-title>
              <v-card-subtitle v-if="card.featureName">{{ card.featureName }}</v-card-subtitle>
              <v-card-text v-if="card.description" class="py-1">
                <span class="text-body-2">{{ card.description }}</span>
              </v-card-text>
              <v-card-text v-if="card.startedAt || card.completedAt" class="py-1 text-caption text-medium-emphasis">
                <div v-if="card.startedAt">{{ t('board.card.started', { value: fmt(card.startedAt) }) }}</div>
                <div v-if="card.completedAt">{{ t('board.card.completed', { value: fmt(card.completedAt) }) }}</div>
              </v-card-text>
              <v-card-actions class="pa-2">
                <v-btn
                  size="x-small"
                  variant="text"
                  prepend-icon="mdi-bug"
                  @click="openFixes(card)"
                >
                  {{ t('board.card.fixes') }}
                </v-btn>
                <v-spacer />
                <template v-if="canEdit">
                  <v-btn
                    v-if="prevStatus(card.status)"
                    size="x-small"
                    variant="tonal"
                    icon="mdi-arrow-left"
                    @click="move(card, prevStatus(card.status)!)"
                  />
                  <v-btn
                    v-if="nextStatus(card.status)"
                    size="x-small"
                    variant="tonal"
                    icon="mdi-arrow-right"
                    @click="move(card, nextStatus(card.status)!)"
                  />
                  <v-btn size="x-small" variant="text" color="error" icon="mdi-delete" @click="remove(card)" />
                </template>
              </v-card-actions>
            </v-card>
            <div v-if="grouped[col.key].length === 0" class="text-caption text-medium-emphasis text-center pa-3">
              {{ t('board.noCards') }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="dialog" max-width="560">
      <v-card>
        <v-card-title>{{ t('board.newCard') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="form.featureId"
            :items="features"
            item-title="name"
            item-value="id"
            :label="t('board.card.feature')"
            clearable
          />
          <v-text-field v-model="form.title" :label="t('common.title')" />
          <v-textarea v-model="form.description" :label="t('common.description')" rows="2" />
          <v-select
            v-model="form.status"
            :items="catalog.state.value.kanbanStatuses"
            item-title="label"
            item-value="code"
            :label="t('board.card.initialColumn')"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="!form.title" @click="save">{{ t('common.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="fixesDialog" max-width="640">
      <v-card v-if="fixesCard">
        <v-card-title>{{ t('board.card.fixes') }} — {{ fixesCard.title }}</v-card-title>
        <v-list density="comfortable" max-height="320" class="overflow-y-auto">
          <v-list-item
            v-for="fx in cardFixes"
            :key="fx.id"
            :to="`/fixes/${fx.id}`"
          >
            <template #prepend>
              <v-icon>mdi-bug</v-icon>
            </template>
            <v-list-item-title>{{ fx.title }}</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip :color="fixStatusColor(fx.status)" size="x-small" variant="tonal" class="me-1">
                {{ fx.statusLabel || fx.status }}
              </v-chip>
              <span class="text-caption">{{ fx.severityLabel || fx.severity }}</span>
            </v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="cardFixes.length === 0">
            <v-list-item-title class="text-caption text-medium-emphasis text-center">
              {{ t('board.card.noFixes') }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
        <v-divider v-if="canEdit" />
        <v-card-text v-if="canEdit">
          <div class="text-overline mb-2">{{ t('board.card.newFix') }}</div>
          <v-text-field v-model="newFix.title" :label="t('common.title')" density="compact" />
          <v-textarea v-model="newFix.description" :label="t('common.description')" rows="2" density="compact" />
          <v-select
            v-model="newFix.severity"
            :items="catalog.state.value.severities"
            item-title="label"
            item-value="code"
            :label="t('common.severity')"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="fixesDialog = false">{{ t('common.close') }}</v-btn>
          <v-btn
            v-if="canEdit"
            color="primary"
            :disabled="!newFix.title.trim()"
            @click="createFix"
          >
            {{ t('board.card.reportFix') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
