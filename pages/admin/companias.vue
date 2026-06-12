<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  requiresRole: 'ROLE_ADMIN'
})

useHead({ title: 'Compañías — MBP Testing' })

interface PaisDto {
  id: string
  nombre: string
  codigoIso: string
}

interface CompaniaDto {
  id: string
  paisId: string
  paisNombre: string
  nombre: string
  identificadorFiscal: string | null
  activo: boolean
  createdAt: string
}

const api = useApi()

const companias = ref<CompaniaDto[]>([])
const paises = ref<PaisDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const dialog = ref(false)
const saving = ref(false)
const form = ref({
  paisId: '',
  nombre: '',
  identificadorFiscal: '',
  activo: true
})

async function cargar() {
  loading.value = true
  error.value = null
  try {
    const [cs, ps] = await Promise.all([
      api.get<CompaniaDto[]>('/companias'),
      api.get<PaisDto[]>('/paises')
    ])
    companias.value = cs
    paises.value = ps
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cargar las compañías'
  } finally {
    loading.value = false
  }
}

function abrirNueva() {
  form.value = {
    paisId: paises.value[0]?.id ?? '',
    nombre: '',
    identificadorFiscal: '',
    activo: true
  }
  dialog.value = true
}

async function guardar() {
  saving.value = true
  try {
    await api.post<CompaniaDto>('/companias', {
      paisId: form.value.paisId,
      nombre: form.value.nombre,
      identificadorFiscal: form.value.identificadorFiscal || null,
      activo: form.value.activo
    })
    dialog.value = false
    await cargar()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible crear la compañía'
  } finally {
    saving.value = false
  }
}

onMounted(cargar)

const headers = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'País', key: 'paisNombre' },
  { title: 'ID fiscal', key: 'identificadorFiscal' },
  { title: 'Activa', key: 'activo' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
]
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-medium">Compañías</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="abrirNueva">
        Nueva compañía
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="companias"
        :loading="loading"
        items-per-page="25"
        density="comfortable"
      >
        <template #item.activo="{ value }">
          <v-chip :color="value ? 'success' : 'grey'" size="small" variant="tonal">
            {{ value ? 'Sí' : 'No' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            size="small"
            variant="text"
            :to="`/admin/companias/${item.id}`"
            icon="mdi-arrow-right"
          />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>Nueva compañía</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="guardar">
            <v-text-field v-model="form.nombre" label="Nombre" required />
            <v-select
              v-model="form.paisId"
              :items="paises"
              item-title="nombre"
              item-value="id"
              label="País"
              required
            />
            <v-text-field
              v-model="form.identificadorFiscal"
              label="Identificador fiscal"
              hint="Opcional"
              persistent-hint
            />
            <v-switch v-model="form.activo" label="Activa" color="primary" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="guardar">Crear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
