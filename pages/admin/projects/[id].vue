<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useCatalog } from '~/composables/useCatalog'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

const { t } = useI18n()
useHead({ title: () => `${t('common.project')} — ${t('common.appName')}` })

interface ProjectDto {
  id: string
  companiaId: string
  companiaNombre: string
  name: string
  description: string | null
  status: string
  statusLabel: string
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
  priorityLabel: string
  severity: string
  severityLabel: string
  status: string
  statusLabel: string
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
    error.value = e?.data?.message || t('common.errorLoad')
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
    error.value = e?.data?.message || t('common.errorCreate')
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
    error.value = e?.data?.message || t('common.errorCreate')
  }
}

async function removeFeature(f: FeatureDto) {
  try {
    await api.del(`/features/${f.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
  }
}

async function removeModule(m: ModuleDto) {
  try {
    await api.del(`/modules/${m.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
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

const featureHeaders = computed(() => [
  { title: t('admin.projectDetail.headers.name'), key: 'name' },
  { title: t('admin.projectDetail.headers.priority'), key: 'priority' },
  { title: t('admin.projectDetail.headers.severity'), key: 'severity' },
  { title: t('admin.projectDetail.headers.status'), key: 'status' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="project ? `/admin/companias/${project.companiaId}` : '/admin/companias'" class="mb-4">
      {{ t('admin.projectDetail.back') }}
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
          <div class="text-overline">{{ t('admin.projectDetail.status') }}</div>
          <v-chip size="small" variant="tonal">{{ project.statusLabel || project.status }}</v-chip>
          <div v-if="project.description" class="mt-3">{{ project.description }}</div>
        </v-card-text>
      </v-card>

      <div class="d-flex align-center mb-3">
        <h2 class="text-h6 font-weight-medium">{{ t('admin.projectDetail.modules') }}</h2>
        <v-spacer />
        <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openNewModule">
          {{ t('admin.projectDetail.newModule') }}
        </v-btn>
      </div>

      <v-expansion-panels v-if="modules.length" multiple>
        <v-expansion-panel v-for="m in modules" :key="m.id">
          <v-expansion-panel-title>
            <div class="d-flex align-center w-100">
              <span class="font-weight-medium">{{ m.name }}</span>
              <v-spacer />
              <v-chip size="x-small" variant="tonal" class="mr-2">
                {{ t('admin.projectDetail.featuresCount', { count: featuresByModule[m.id]?.length ?? 0 }) }}
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
              <span class="text-body-2 text-medium-emphasis">{{ m.description || t('common.emptyDash') }}</span>
              <v-spacer />
              <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" @click="openNewFeature(m.id)">
                {{ t('admin.projectDetail.feature') }}
              </v-btn>
            </div>
            <v-data-table
              :headers="featureHeaders"
              :items="featuresByModule[m.id] ?? []"
              density="compact"
              hide-default-footer
            >
              <template #item.priority="{ item }">
                <v-chip :color="priorityColor(item.priority)" size="x-small" variant="tonal">{{ item.priorityLabel || item.priority }}</v-chip>
              </template>
              <template #item.severity="{ item }">
                <v-chip :color="severityColor(item.severity)" size="x-small" variant="tonal">{{ item.severityLabel || item.severity }}</v-chip>
              </template>
              <template #item.status="{ item }">
                <v-chip size="x-small" variant="tonal">{{ item.statusLabel || item.status }}</v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn size="x-small" variant="text" color="error" icon="mdi-delete" @click="removeFeature(item)" />
              </template>
            </v-data-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <v-card v-else variant="tonal" class="pa-4 text-center text-medium-emphasis">
        {{ t('admin.projectDetail.noModules') }}
      </v-card>
    </template>

    <v-dialog v-model="moduleDialog" max-width="520">
      <v-card>
        <v-card-title>{{ t('admin.projectDetail.moduleDialog.title') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="moduleForm.name" :label="t('common.name')" />
          <v-textarea v-model="moduleForm.description" :label="t('common.description')" rows="2" />
          <v-text-field v-model.number="moduleForm.position" :label="t('admin.projectDetail.moduleDialog.position')" type="number" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="moduleDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="saveModule">{{ t('common.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="featureDialog" max-width="640">
      <v-card>
        <v-card-title>{{ t('admin.projectDetail.featureDialog.title') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="featureForm.name" :label="t('admin.projectDetail.featureDialog.name')" />
          <v-textarea v-model="featureForm.description" :label="t('admin.projectDetail.featureDialog.description')" rows="2" />
          <v-textarea v-model="featureForm.acceptanceCriteria" :label="t('admin.projectDetail.featureDialog.acceptanceCriteria')" rows="3" />
          <v-row>
            <v-col cols="12" md="4">
              <v-select
                v-model="featureForm.priority"
                :items="catalog.state.value.priorities"
                item-title="label"
                item-value="code"
                :label="t('admin.projectDetail.featureDialog.priority')"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="featureForm.severity"
                :items="catalog.state.value.severities"
                item-title="label"
                item-value="code"
                :label="t('admin.projectDetail.featureDialog.severity')"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="featureForm.status"
                :items="catalog.state.value.featureStatuses"
                item-title="label"
                item-value="code"
                :label="t('admin.projectDetail.featureDialog.status')"
              />
            </v-col>
          </v-row>
          <v-text-field v-model.number="featureForm.position" :label="t('admin.projectDetail.featureDialog.position')" type="number" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="featureDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="saveFeature">{{ t('common.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
