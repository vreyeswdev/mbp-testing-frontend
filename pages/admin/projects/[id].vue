<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useCatalog } from '~/composables/useCatalog'

definePageMeta({
  ssr: false,
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

useHead({ title: 'Project — MBP Testing' })

interface ProjectDto {
  id: string
  companiaId: string
  companiaNombre: string
  name: string
  description: string | null
  status: string
  createdAt: string
}

interface ModuleDto {
  id: string
  projectId: string
  name: string
  description: string | null
  position: number
  createdAt: string
}

interface FeatureDto {
  id: string
  moduleId: string
  name: string
  description: string | null
  acceptanceCriteria: string | null
  priority: string
  severity: string
  status: string
  position: number
  createdAt: string
}

const route = useRoute()
const api = useApi()
const catalog = useCatalog()
const id = computed(() => route.params.id as string)

const project = ref<ProjectDto | null>(null)
const modules = ref<ModuleDto[]>([])
const featuresByModule = ref<Record<string, FeatureDto[]>>({})
const loading = ref(true)
const error = ref<string | null>(null)

const moduleDialog = ref(false)
const moduleForm = ref({ name: '', description: '', position: 0 })

const featureDialog = ref(false)
const featureModuleId = ref<string | null>(null)
const featureForm = ref({
  name: '',
  description: '',
  acceptanceCriteria: '',
  priority: 'MEDIUM',
  severity: 'MINOR',
  status: 'ACTIVE',
  position: 0
})

async function load() {
  loading.value = true
  error.value = null
  try {
    await catalog.loadAll()
    project.value = await api.get<ProjectDto>(`/projects/${id.value}`)
    modules.value = await api.get<ModuleDto[]>(`/projects/${id.value}/modules`)
    const featureCalls = modules.value.map(async (m) => {
      featuresByModule.value[m.id] = await api.get<FeatureDto[]>(`/modules/${m.id}/features`)
    })
    await Promise.all(featureCalls)
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cargar el proyecto'
  } finally {
    loading.value = false
  }
}

function openNewModule() {
  moduleForm.value = { name: '', description: '', position: modules.value.length }
  moduleDialog.value = true
}

async function saveModule() {
  try {
    await api.post<ModuleDto>(`/projects/${id.value}/modules`, { ...moduleForm.value })
    moduleDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible crear el módulo'
  }
}

function openNewFeature(moduleId: string) {
  featureModuleId.value = moduleId
  const existing = featuresByModule.value[moduleId] ?? []
  featureForm.value = {
    name: '',
    description: '',
    acceptanceCriteria: '',
    priority: 'MEDIUM',
    severity: 'MINOR',
    status: 'ACTIVE',
    position: existing.length
  }
  featureDialog.value = true
}

async function saveFeature() {
  if (!featureModuleId.value) return
  try {
    await api.post<FeatureDto>(`/modules/${featureModuleId.value}/features`, { ...featureForm.value })
    featureDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible crear la feature'
  }
}

async function removeFeature(f: FeatureDto) {
  try {
    await api.del(`/features/${f.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible eliminar'
  }
}

async function removeModule(m: ModuleDto) {
  try {
    await api.del(`/modules/${m.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible eliminar el módulo'
  }
}

function priorityColor(p: string) {
  return ({
    LOW: 'grey',
    MEDIUM: 'info',
    HIGH: 'warning',
    CRITICAL: 'error',
    BLOCKING: 'deep-purple'
  } as Record<string, string>)[p] ?? 'grey'
}

function severityColor(s: string) {
  return ({
    TRIVIAL: 'grey',
    MINOR: 'info',
    MAJOR: 'warning',
    CRITICAL: 'error',
    BLOCKER: 'deep-purple'
  } as Record<string, string>)[s] ?? 'grey'
}

onMounted(load)

const featureHeaders = [
  { title: 'Nombre', key: 'name' },
  { title: 'Prioridad', key: 'priority' },
  { title: 'Severidad', key: 'severity' },
  { title: 'Estado', key: 'status' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
]
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="project ? `/admin/companias/${project.companiaId}` : '/admin/companias'" class="mb-4">
      Volver a compañía
    </v-btn>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading && !project" type="card" />

    <template v-else-if="project">
      <v-card class="mb-6">
        <v-card-title>{{ project.name }}</v-card-title>
        <v-card-subtitle>{{ project.companiaNombre }}</v-card-subtitle>
        <v-card-text>
          <div class="text-overline">Estado</div>
          <v-chip size="small" variant="tonal">{{ project.status }}</v-chip>
          <div v-if="project.description" class="mt-3">{{ project.description }}</div>
        </v-card-text>
      </v-card>

      <div class="d-flex align-center mb-3">
        <h2 class="text-h6 font-weight-medium">Modules</h2>
        <v-spacer />
        <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openNewModule">
          Nuevo módulo
        </v-btn>
      </div>

      <v-expansion-panels v-if="modules.length" multiple>
        <v-expansion-panel v-for="m in modules" :key="m.id">
          <v-expansion-panel-title>
            <div class="d-flex align-center w-100">
              <span class="font-weight-medium">{{ m.name }}</span>
              <v-spacer />
              <v-chip size="x-small" variant="tonal" class="mr-2">
                {{ featuresByModule[m.id]?.length ?? 0 }} features
              </v-chip>
              <v-btn
                size="x-small"
                variant="text"
                color="error"
                icon="mdi-delete"
                @click.stop="removeModule(m)"
              />
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="d-flex align-center mb-3">
              <span class="text-body-2 text-medium-emphasis">{{ m.description || '—' }}</span>
              <v-spacer />
              <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" @click="openNewFeature(m.id)">
                Feature
              </v-btn>
            </div>
            <v-data-table
              :headers="featureHeaders"
              :items="featuresByModule[m.id] ?? []"
              density="compact"
              hide-default-footer
            >
              <template #item.priority="{ value }">
                <v-chip :color="priorityColor(value)" size="x-small" variant="tonal">{{ value }}</v-chip>
              </template>
              <template #item.severity="{ value }">
                <v-chip :color="severityColor(value)" size="x-small" variant="tonal">{{ value }}</v-chip>
              </template>
              <template #item.status="{ value }">
                <v-chip size="x-small" variant="tonal">{{ value }}</v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn size="x-small" variant="text" color="error" icon="mdi-delete" @click="removeFeature(item)" />
              </template>
            </v-data-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <v-card v-else variant="tonal" class="pa-4 text-center text-medium-emphasis">
        Aún no hay modules. Crea el primero arriba.
      </v-card>
    </template>

    <v-dialog v-model="moduleDialog" max-width="520">
      <v-card>
        <v-card-title>Nuevo módulo</v-card-title>
        <v-card-text>
          <v-text-field v-model="moduleForm.name" label="Nombre" />
          <v-textarea v-model="moduleForm.description" label="Descripción" rows="2" />
          <v-text-field v-model.number="moduleForm.position" label="Posición" type="number" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="moduleDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="saveModule">Crear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="featureDialog" max-width="640">
      <v-card>
        <v-card-title>Nueva feature</v-card-title>
        <v-card-text>
          <v-text-field v-model="featureForm.name" label="Nombre" />
          <v-textarea v-model="featureForm.description" label="Descripción" rows="2" />
          <v-textarea v-model="featureForm.acceptanceCriteria" label="Criterios de aceptación" rows="3" />
          <v-row>
            <v-col cols="12" md="4">
              <v-select
                v-model="featureForm.priority"
                :items="catalog.state.value.priorities"
                item-title="label"
                item-value="code"
                label="Prioridad"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="featureForm.severity"
                :items="catalog.state.value.severities"
                item-title="label"
                item-value="code"
                label="Severidad"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="featureForm.status"
                :items="catalog.state.value.featureStatuses"
                item-title="label"
                item-value="code"
                label="Estado"
              />
            </v-col>
          </v-row>
          <v-text-field v-model.number="featureForm.position" label="Posición" type="number" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="featureDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="saveFeature">Crear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
