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

const route = useRoute()
const api = useApi()
const id = computed(() => route.params.id as string)

const compania = ref<CompaniaDto | null>(null)
const usuarios = ref<UsuarioCompaniaDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const dialog = ref(false)
const userIdInput = ref('')
const asignando = ref(false)

async function cargar() {
  loading.value = true
  error.value = null
  try {
    const [c, us] = await Promise.all([
      api.get<CompaniaDto>(`/companias/${id.value}`),
      api.get<UsuarioCompaniaDto[]>(`/companias/${id.value}/usuarios`)
    ])
    compania.value = c
    usuarios.value = us
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cargar la compañía'
  } finally {
    loading.value = false
  }
}

async function asignar() {
  asignando.value = true
  try {
    await api.post<UsuarioCompaniaDto>(`/companias/${id.value}/usuarios`, {
      userId: userIdInput.value
    })
    dialog.value = false
    userIdInput.value = ''
    await cargar()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible asignar el usuario'
  } finally {
    asignando.value = false
  }
}

async function quitar(uc: UsuarioCompaniaDto) {
  try {
    await api.del(`/companias/${id.value}/usuarios/${uc.id}`)
    await cargar()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible quitar al usuario'
  }
}

onMounted(cargar)

const headers = [
  { title: 'Email', key: 'userEmail' },
  { title: 'Nombre', key: 'userFullName' },
  { title: 'Roles', key: 'userRoles' },
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
        <v-card-title class="d-flex align-center">
          Usuarios
          <v-spacer />
          <v-btn color="primary" size="small" prepend-icon="mdi-account-plus" @click="dialog = true">
            Asignar usuario
          </v-btn>
        </v-card-title>
        <v-data-table
          :headers="headers"
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
            <v-btn
              size="small"
              variant="text"
              color="error"
              icon="mdi-delete"
              @click="quitar(item)"
            />
          </template>
        </v-data-table>
      </v-card>
    </template>

    <v-dialog v-model="dialog" max-width="480">
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
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="asignando" :disabled="!userIdInput" @click="asignar">
            Asignar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
