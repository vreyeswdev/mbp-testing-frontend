<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useCatalog } from '~/composables/useCatalog'

definePageMeta({ ssr: false })

useHead({ title: 'Solicitudes — MBP Testing' })

interface TestRequestDto {
  id: string
  projectId: string
  projectName: string
  testTypeCode: string
  environmentCode: string | null
  title: string
  status: string
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
    error.value = e?.data?.message || 'No fue posible cargar'
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
    error.value = e?.data?.message || 'No fue posible crear'
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

const headers = [
  { title: 'Título', key: 'title' },
  { title: 'Project', key: 'projectName' },
  { title: 'Test type', key: 'testTypeCode' },
  { title: 'Estado', key: 'status' },
  { title: 'Especialista', key: 'assignedSpecialistEmail' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
]
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-medium">Solicitudes de QA</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">
        Nueva solicitud
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="items"
        :loading="loading"
        items-per-page="25"
        density="comfortable"
      >
        <template #item.status="{ value }">
          <v-chip :color="statusColor(value)" size="small" variant="tonal">
            {{ value.replace(/_/g, ' ') }}
          </v-chip>
        </template>
        <template #item.assignedSpecialistEmail="{ value }">
          {{ value || '—' }}
        </template>
        <template #item.actions="{ item }">
          <v-btn size="small" variant="text" :to="`/requests/${item.id}`" icon="mdi-arrow-right" />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="640">
      <v-card>
        <v-card-title>Nueva solicitud</v-card-title>
        <v-card-text>
          <v-select
            v-model="form.projectId"
            :items="projects"
            item-title="name"
            item-value="id"
            label="Project"
          />
          <v-select
            v-model="form.testTypeId"
            :items="catalog.state.value.testTypes"
            item-title="name"
            item-value="id"
            label="Tipo de prueba"
          />
          <v-select
            v-model="form.environmentId"
            :items="catalog.state.value.environments"
            item-title="name"
            item-value="id"
            label="Ambiente (opcional)"
            clearable
          />
          <v-text-field v-model="form.title" label="Título" />
          <v-textarea v-model="form.description" label="Descripción" rows="3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Crear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
