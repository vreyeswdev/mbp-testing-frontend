<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useCatalog } from '~/composables/useCatalog'

definePageMeta({ ssr: false, layout: 'console' })

const { t } = useI18n()
useHead({ title: () => `${t('requests.title')} — ${t('common.appName')}` })

interface TestRequestDto {
  id: string
  projectId: string
  projectName: string
  testTypeCode: string
  environmentCode: string | null
  title: string
  status: string
  statusLabel: string
  assignedSpecialistEmail: string | null
  requestedByEmail: string
  createdAt: string
}

interface ProjectDto {
  id: string
  name: string
  companiaId: string
  companiaNombre: string
}

const api = useApi()
const catalog = useCatalog()

const items = ref<TestRequestDto[]>([])
const projects = ref<ProjectDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const dialog = ref(false)
const saving = ref(false)
const form = ref({
  projectId: '',
  testTypeId: '',
  environmentId: '',
  title: '',
  description: ''
})

async function load() {
  loading.value = true
  error.value = null
  try {
    await catalog.loadAll()
    const [list, ps] = await Promise.all([
      api.get<TestRequestDto[]>('/test-requests'),
      api.get<ProjectDto[]>('/projects')
    ])
    items.value = list
    projects.value = ps
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorLoad')
  } finally {
    loading.value = false
  }
}

function openNew() {
  form.value = {
    projectId: projects.value[0]?.id ?? '',
    testTypeId: catalog.state.value.testTypes[0]?.id ?? '',
    environmentId: '',
    title: '',
    description: ''
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    await api.post<TestRequestDto>('/test-requests', {
      projectId: form.value.projectId,
      testTypeId: form.value.testTypeId,
      environmentId: form.value.environmentId || null,
      title: form.value.title,
      description: form.value.description || null
    })
    dialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorCreate')
  } finally {
    saving.value = false
  }
}

function statusColor(s: string) {
  return ({
    REQUESTED: 'grey',
    SCOPING: 'info',
    SPECIALIST_ASSIGNED: 'cyan',
    CONFIRMED: 'blue',
    IN_PROGRESS: 'amber',
    BLOCKED: 'orange',
    COMPLETED: 'success',
    CANCELLED: 'red'
  } as Record<string, string>)[s] ?? 'grey'
}

onMounted(load)

const headers = computed(() => [
  { title: t('requests.headers.title'), key: 'title' },
  { title: t('requests.headers.project'), key: 'projectName' },
  { title: t('requests.headers.testType'), key: 'testTypeCode' },
  { title: t('requests.headers.status'), key: 'status' },
  { title: t('requests.headers.specialist'), key: 'assignedSpecialistEmail' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">{{ t('requests.overline') }}</div>
        <h1 class="text-h4 font-weight-bold">{{ t('requests.title') }}</h1>
      </div>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">
        {{ t('requests.new') }}
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card variant="outlined">
      <v-data-table
        :headers="headers"
        :items="items"
        :loading="loading"
        items-per-page="25"
        density="comfortable"
      >
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" size="small" variant="tonal">
            {{ item.statusLabel || item.status }}
          </v-chip>
        </template>
        <template #item.assignedSpecialistEmail="{ value }">
          {{ value || t('common.emptyDash') }}
        </template>
        <template #item.actions="{ item }">
          <v-btn size="small" variant="text" :to="`/requests/${item.id}`" icon="mdi-arrow-right" />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="640">
      <v-card>
        <v-card-title>{{ t('requests.dialog.newTitle') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="form.projectId"
            :items="projects"
            item-title="name"
            item-value="id"
            :label="t('requests.dialog.projectLabel')"
          />
          <v-select
            v-model="form.testTypeId"
            :items="catalog.state.value.testTypes"
            item-title="name"
            item-value="id"
            :label="t('requests.dialog.testTypeLabel')"
          />
          <v-select
            v-model="form.environmentId"
            :items="catalog.state.value.environments"
            item-title="name"
            item-value="id"
            :label="t('requests.dialog.environmentLabel')"
            clearable
          />
          <v-text-field v-model="form.title" :label="t('requests.dialog.titleLabel')" />
          <v-textarea v-model="form.description" :label="t('requests.dialog.descriptionLabel')" rows="3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">{{ t('common.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
