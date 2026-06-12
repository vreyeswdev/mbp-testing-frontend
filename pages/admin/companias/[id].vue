<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  requiresRole: 'ROLE_ADMIN'
})

useHead({ title: 'Detalle de compañía — MBP Testing' })

interface CompaniaDto {
  id: string
  paisNombre: string
  nombre: string
  identificadorFiscal: string | null
  activo: boolean
  createdAt: string
}

interface UsuarioCompaniaDto {
  id: string
  userId: string
  userEmail: string
  userFullName: string
  userRoles: string[]
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
  createdAt: string
}

const route = useRoute()
const api = useApi()
const id = computed(() => route.params.id as string)

const tab = ref<'users' | 'projects'>('users')
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
    error.value = e?.data?.message || 'No fue posible cargar la compañía'
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
    error.value = e?.data?.message || 'No fue posible asignar el usuario'
  } finally {
    asignando.value = false
  }
}

async function quitarUsuario(uc: UsuarioCompaniaDto) {
  try {
    await api.del(`/companias/${id.value}/usuarios/${uc.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible quitar al usuario'
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
    error.value = e?.data?.message || 'No fue posible crear el project'
  } finally {
    savingProject.value = false
  }
}

async function removeProject(p: ProjectDto) {
  try {
    await api.del(`/projects/${p.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible eliminar el project'
  }
}

onMounted(load)

const userHeaders = [
  { title: 'Email', key: 'userEmail' },
  { title: 'Nombre', key: 'userFullName' },
  { title: 'Roles', key: 'userRoles' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
]

const projectHeaders = [
  { title: 'Nombre', key: 'name' },
  { title: 'Estado', key: 'status' },
  { title: 'Creado', key: 'createdAt' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
]
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/admin/companias" class="mb-4">
      Volver a compañías
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
              <div class="text-overline">País</div>
              <div>{{ compania.paisNombre }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">ID fiscal</div>
              <div>{{ compania.identificadorFiscal || '—' }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">Estado</div>
              <v-chip :color="compania.activo ? 'success' : 'grey'" size="small" variant="tonal">
                {{ compania.activo ? 'Activa' : 'Inactiva' }}
              </v-chip>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card>
        <v-tabs v-model="tab" color="primary">
          <v-tab value="users" prepend-icon="mdi-account-multiple">Usuarios</v-tab>
          <v-tab value="projects" prepend-icon="mdi-folder-multiple">Projects</v-tab>
        </v-tabs>

        <v-tabs-window v-model="tab">
          <v-tabs-window-item value="users">
            <v-card-text class="d-flex align-center">
              <v-spacer />
              <v-btn color="primary" size="small" prepend-icon="mdi-account-plus" @click="userDialog = true">
                Asignar usuario
              </v-btn>
            </v-card-text>
            <v-data-table
              :headers="userHeaders"
              :items="usuarios"
              :loading="loading"
              items-per-page="25"
              density="comfortable"
            >
              <template #item.userRoles="{ value }">
                <v-chip
                  v-for="role in (value as string[])"
                  :key="role"
                  size="x-small"
                  variant="tonal"
                  class="mr-1"
                >
                  {{ role.replace('ROLE_', '') }}
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
                Nuevo project
              </v-btn>
            </v-card-text>
            <v-data-table
              :headers="projectHeaders"
              :items="projects"
              :loading="loading"
              items-per-page="25"
              density="comfortable"
            >
              <template #item.status="{ value }">
                <v-chip size="x-small" variant="tonal">{{ value }}</v-chip>
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
        </v-tabs-window>
      </v-card>
    </template>

    <v-dialog v-model="userDialog" max-width="480">
      <v-card>
        <v-card-title>Asignar usuario</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="userIdInput"
            label="UUID del usuario"
            hint="Por ahora se ingresa el ID del usuario manualmente"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="userDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="asignando" :disabled="!userIdInput" @click="asignarUsuario">
            Asignar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="projectDialog" max-width="560">
      <v-card>
        <v-card-title>Nuevo project</v-card-title>
        <v-card-text>
          <v-text-field v-model="projectForm.name" label="Nombre" />
          <v-textarea v-model="projectForm.description" label="Descripción" rows="2" />
          <v-select
            v-model="projectForm.status"
            :items="[
              { code: 'ACTIVE', label: 'Active' },
              { code: 'ON_HOLD', label: 'On hold' },
              { code: 'ARCHIVED', label: 'Archived' }
            ]"
            item-title="label"
            item-value="code"
            label="Estado"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="projectDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="savingProject" @click="saveProject">Crear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
