<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: 'ROLE_ADMIN'
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.companies.title')} — ${t('common.appName')}` })

interface CompaniaDto {
  id: string
  paisNombre: string
  nombre: string
  identificadorFiscal: string | null
  activo: boolean
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  createdAt: string
}

interface UsageWindowDto {
  billable: number
  nonBillable: number
  total: number
  limit: number
  remaining: number
  windowStart: string | null
  windowEnd: string | null
}

interface UsageRunnerDto {
  weekly: UsageWindowDto
  monthly: UsageWindowDto
}

interface UsageDto {
  companiaId: string
  companiaNombre: string
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  cypress: UsageRunnerDto
  k6: UsageRunnerDto
}

interface UsuarioCompaniaDto {
  id: string
  userId: string
  userEmail: string
  userFullName: string
  userRoles: string[]
  userRoleLabels: string[]
  activo: boolean
  createdAt: string
}

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

const route = useRoute()
const api = useApi()
const id = computed(() => route.params.id as string)

const tab = ref<'users' | 'projects' | 'usage'>('users')
const compania = ref<CompaniaDto | null>(null)
const usuarios = ref<UsuarioCompaniaDto[]>([])
const projects = ref<ProjectDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const userDialog = ref(false)
const userIdInput = ref('')
const asignando = ref(false)

const projectDialog = ref(false)
const projectForm = ref({ name: '', description: '', status: 'ACTIVE' })
const savingProject = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [c, us, ps] = await Promise.all([
      api.get<CompaniaDto>(`/companias/${id.value}`),
      api.get<UsuarioCompaniaDto[]>(`/companias/${id.value}/usuarios`),
      api.get<ProjectDto[]>(`/projects?companiaId=${id.value}`)
    ])
    compania.value = c
    usuarios.value = us
    projects.value = ps
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorLoad')
  } finally {
    loading.value = false
  }
}

async function asignarUsuario() {
  asignando.value = true
  try {
    await api.post<UsuarioCompaniaDto>(`/companias/${id.value}/usuarios`, { userId: userIdInput.value })
    userDialog.value = false
    userIdInput.value = ''
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorSave')
  } finally {
    asignando.value = false
  }
}

async function quitarUsuario(uc: UsuarioCompaniaDto) {
  try {
    await api.del(`/companias/${id.value}/usuarios/${uc.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
  }
}

function openNewProject() {
  projectForm.value = { name: '', description: '', status: 'ACTIVE' }
  projectDialog.value = true
}

async function saveProject() {
  savingProject.value = true
  try {
    await api.post<ProjectDto>('/projects', {
      companiaId: id.value,
      name: projectForm.value.name,
      description: projectForm.value.description || null,
      status: projectForm.value.status
    })
    projectDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorCreate')
  } finally {
    savingProject.value = false
  }
}

async function removeProject(p: ProjectDto) {
  try {
    await api.del(`/projects/${p.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
  }
}

// --- Usage ---
const usage = ref<UsageDto | null>(null)
const usageLoading = ref(false)
const usageError = ref<string | null>(null)
const savingPlan = ref(false)
const planSelection = ref<'FREE' | 'PRO' | 'ENTERPRISE'>('FREE')

async function loadUsage() {
  usageLoading.value = true
  usageError.value = null
  try {
    const data = await api.get<UsageDto>(`/companias/${id.value}/usage`)
    usage.value = data
    planSelection.value = data.plan
  } catch (e: any) {
    usageError.value = e?.data?.message || t('common.errorLoad')
  } finally {
    usageLoading.value = false
  }
}

async function savePlan() {
  savingPlan.value = true
  usageError.value = null
  try {
    const data = await api.put<UsageDto>(`/companias/${id.value}/plan`, { plan: planSelection.value })
    usage.value = data
    if (compania.value) compania.value.plan = data.plan
  } catch (e: any) {
    usageError.value = e?.data?.message || t('common.errorSave')
  } finally {
    savingPlan.value = false
  }
}

function pct(w: UsageWindowDto): number {
  if (w.limit < 0) return 0
  if (w.limit === 0) return 0
  return Math.min(100, Math.round((w.billable / w.limit) * 100))
}

function pctColor(p: number): string {
  if (p >= 90) return 'error'
  if (p >= 70) return 'warning'
  return 'success'
}

watch(tab, (v) => {
  if (v === 'usage' && !usage.value) loadUsage()
})

onMounted(load)

const userHeaders = computed(() => [
  { title: t('admin.companyDetail.headersUsers.email'), key: 'userEmail' },
  { title: t('admin.companyDetail.headersUsers.name'), key: 'userFullName' },
  { title: t('admin.companyDetail.headersUsers.roles'), key: 'userRoles' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])

const projectHeaders = computed(() => [
  { title: t('admin.companyDetail.headersProjects.name'), key: 'name' },
  { title: t('admin.companyDetail.headersProjects.status'), key: 'status' },
  { title: t('admin.companyDetail.headersProjects.created'), key: 'createdAt' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/admin/companias" class="mb-4">
      {{ t('admin.companyDetail.back') }}
    </v-btn>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading && !compania" type="card" />

    <template v-else-if="compania">
      <v-card class="mb-6">
        <v-card-title>{{ compania.nombre }}</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <div class="text-overline">{{ t('admin.companyDetail.country') }}</div>
              <div>{{ compania.paisNombre }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">{{ t('admin.companyDetail.fiscalId') }}</div>
              <div>{{ compania.identificadorFiscal || t('common.emptyDash') }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">{{ t('admin.companyDetail.status') }}</div>
              <v-chip :color="compania.activo ? 'success' : 'grey'" size="small" variant="tonal">
                {{ compania.activo ? t('admin.companyDetail.active') : t('admin.companyDetail.inactive') }}
              </v-chip>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card>
        <v-tabs v-model="tab" color="primary">
          <v-tab value="users" prepend-icon="mdi-account-multiple">{{ t('admin.companyDetail.tabUsers') }}</v-tab>
          <v-tab value="projects" prepend-icon="mdi-folder-multiple">{{ t('admin.companyDetail.tabProjects') }}</v-tab>
          <v-tab value="usage" prepend-icon="mdi-gauge">{{ t('admin.companyDetail.tabUsage') }}</v-tab>
        </v-tabs>

        <v-tabs-window v-model="tab">
          <v-tabs-window-item value="users">
            <v-card-text class="d-flex align-center">
              <v-spacer />
              <v-btn color="primary" size="small" prepend-icon="mdi-account-plus" @click="userDialog = true">
                {{ t('admin.companyDetail.assignUser') }}
              </v-btn>
            </v-card-text>
            <v-data-table
              :headers="userHeaders"
              :items="usuarios"
              :loading="loading"
              items-per-page="25"
              density="comfortable"
            >
              <template #item.userRoles="{ item }">
                <v-chip
                  v-for="(label, idx) in (item.userRoleLabels || item.userRoles)"
                  :key="idx"
                  size="x-small"
                  variant="tonal"
                  class="mr-1"
                >
                  {{ label }}
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn size="small" variant="text" color="error" icon="mdi-delete" @click="quitarUsuario(item)" />
              </template>
            </v-data-table>
          </v-tabs-window-item>

          <v-tabs-window-item value="projects">
            <v-card-text class="d-flex align-center">
              <v-spacer />
              <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openNewProject">
                {{ t('admin.companyDetail.newProject') }}
              </v-btn>
            </v-card-text>
            <v-data-table
              :headers="projectHeaders"
              :items="projects"
              :loading="loading"
              items-per-page="25"
              density="comfortable"
            >
              <template #item.status="{ item }">
                <v-chip size="x-small" variant="tonal">{{ item.statusLabel || item.status }}</v-chip>
              </template>
              <template #item.createdAt="{ value }">
                {{ new Date(value).toLocaleDateString() }}
              </template>
              <template #item.actions="{ item }">
                <v-btn size="small" variant="text" :to="`/admin/projects/${item.id}`" icon="mdi-arrow-right" />
                <v-btn size="small" variant="text" color="error" icon="mdi-delete" @click="removeProject(item)" />
              </template>
            </v-data-table>
          </v-tabs-window-item>

          <v-tabs-window-item value="usage">
            <div class="pa-4">
              <v-alert v-if="usageError" type="error" variant="tonal" class="mb-3" closable @click:close="usageError = null">
                {{ usageError }}
              </v-alert>

              <div v-if="usageLoading && !usage" class="d-flex justify-center pa-6">
                <v-progress-circular indeterminate size="32" />
              </div>

              <template v-else-if="usage">
                <!-- Selector de plan -->
                <v-card variant="outlined" class="mb-4">
                  <v-card-text class="d-flex align-center flex-wrap gap-3">
                    <div>
                      <div class="text-overline">{{ t('admin.usage.currentPlan') }}</div>
                      <v-chip :color="usage.plan === 'FREE' ? 'grey' : usage.plan === 'PRO' ? 'primary' : 'success'"
                              variant="flat" size="small">
                        {{ usage.plan }}
                      </v-chip>
                    </div>
                    <v-spacer />
                    <v-select
                      v-model="planSelection"
                      :items="['FREE', 'PRO', 'ENTERPRISE']"
                      :label="t('admin.usage.changePlan')"
                      density="compact"
                      variant="outlined"
                      hide-details
                      style="max-width: 220px"
                    />
                    <v-btn
                      color="primary"
                      :loading="savingPlan"
                      :disabled="planSelection === usage.plan"
                      @click="savePlan"
                    >
                      {{ t('common.save') }}
                    </v-btn>
                  </v-card-text>
                </v-card>

                <!-- Runners: cypress + k6 -->
                <v-row dense>
                  <v-col v-for="(runner, runnerKey) in { cypress: usage.cypress, k6: usage.k6 }"
                          :key="runnerKey" cols="12" md="6">
                    <v-card variant="outlined" class="mb-3">
                      <v-card-title class="text-body-1 d-flex align-center">
                        <v-icon start>{{ runnerKey === 'cypress' ? 'mdi-flask-outline' : 'mdi-speedometer' }}</v-icon>
                        {{ runnerKey === 'cypress' ? 'Cypress' : 'k6' }}
                      </v-card-title>
                      <v-card-text>
                        <!-- Weekly -->
                        <div class="text-overline mb-1">{{ t('admin.usage.weekly') }}</div>
                        <div v-if="runner.weekly.limit < 0" class="text-caption text-success mb-3">
                          ∞ {{ t('admin.usage.unlimited') }} · {{ t('admin.usage.billable') }}: {{ runner.weekly.billable }} ·
                          {{ t('admin.usage.staff') }}: {{ runner.weekly.nonBillable }}
                        </div>
                        <template v-else>
                          <v-progress-linear
                            :model-value="pct(runner.weekly)"
                            :color="pctColor(pct(runner.weekly))"
                            height="14"
                            rounded
                          >
                            <strong class="text-caption">
                              {{ runner.weekly.billable }} / {{ runner.weekly.limit }}
                            </strong>
                          </v-progress-linear>
                          <div class="text-caption text-medium-emphasis mt-1 mb-3">
                            {{ t('admin.usage.staff') }}: {{ runner.weekly.nonBillable }} ·
                            {{ t('admin.usage.remaining') }}: {{ runner.weekly.remaining }}
                          </div>
                        </template>

                        <!-- Monthly -->
                        <div class="text-overline mb-1">{{ t('admin.usage.monthly') }}</div>
                        <div v-if="runner.monthly.limit < 0" class="text-caption text-success">
                          ∞ {{ t('admin.usage.unlimited') }} · {{ t('admin.usage.billable') }}: {{ runner.monthly.billable }} ·
                          {{ t('admin.usage.staff') }}: {{ runner.monthly.nonBillable }}
                        </div>
                        <template v-else>
                          <v-progress-linear
                            :model-value="pct(runner.monthly)"
                            :color="pctColor(pct(runner.monthly))"
                            height="14"
                            rounded
                          >
                            <strong class="text-caption">
                              {{ runner.monthly.billable }} / {{ runner.monthly.limit }}
                            </strong>
                          </v-progress-linear>
                          <div class="text-caption text-medium-emphasis mt-1">
                            {{ t('admin.usage.staff') }}: {{ runner.monthly.nonBillable }} ·
                            {{ t('admin.usage.remaining') }}: {{ runner.monthly.remaining }}
                          </div>
                        </template>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>

                <v-alert type="info" variant="tonal" density="compact" class="mt-2">
                  {{ t('admin.usage.staffHint') }}
                </v-alert>
              </template>
            </div>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card>
    </template>

    <v-dialog v-model="userDialog" max-width="480">
      <v-card>
        <v-card-title>{{ t('admin.companyDetail.assignDialog.title') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="userIdInput"
            :label="t('admin.companyDetail.assignDialog.userId')"
            :hint="t('admin.companyDetail.assignDialog.hint')"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="userDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="asignando" :disabled="!userIdInput" @click="asignarUsuario">
            {{ t('admin.companyDetail.assignUser') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="projectDialog" max-width="560">
      <v-card>
        <v-card-title>{{ t('admin.companyDetail.projectDialog.title') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="projectForm.name" :label="t('admin.companyDetail.projectDialog.name')" />
          <v-textarea v-model="projectForm.description" :label="t('admin.companyDetail.projectDialog.description')" rows="2" />
          <v-select
            v-model="projectForm.status"
            :items="[
              { code: 'ACTIVE', label: t('admin.companyDetail.projectStatusOptions.ACTIVE') },
              { code: 'ON_HOLD', label: t('admin.companyDetail.projectStatusOptions.ON_HOLD') },
              { code: 'ARCHIVED', label: t('admin.companyDetail.projectStatusOptions.ARCHIVED') }
            ]"
            item-title="label"
            item-value="code"
            :label="t('admin.companyDetail.projectDialog.status')"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="projectDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="savingProject" @click="saveProject">{{ t('common.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
