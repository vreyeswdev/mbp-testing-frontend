<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: 'ROLE_ADMIN'
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.companies.title')} — ${t('common.appName')}` })

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
    error.value = e?.data?.message || t('admin.companies.errorLoad')
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
    error.value = e?.data?.message || t('admin.companies.errorCreate')
  } finally {
    saving.value = false
  }
}

onMounted(cargar)

const headers = computed(() => [
  { title: t('admin.companies.headers.name'), key: 'nombre' },
  { title: t('admin.companies.headers.country'), key: 'paisNombre' },
  { title: t('admin.companies.headers.fiscalId'), key: 'identificadorFiscal' },
  { title: t('admin.companies.headers.active'), key: 'activo' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">{{ t('admin.companies.overline') }}</div>
        <h1 class="text-h4 font-weight-bold">{{ t('admin.companies.title') }}</h1>
      </div>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="abrirNueva">
        {{ t('admin.companies.new') }}
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card variant="outlined">
      <v-data-table
        :headers="headers"
        :items="companias"
        :loading="loading"
        items-per-page="25"
        density="comfortable"
      >
        <template #item.activo="{ value }">
          <v-chip :color="value ? 'success' : 'grey'" size="small" variant="tonal">
            {{ value ? t('common.yes') : t('common.no') }}
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
        <v-card-title>{{ t('admin.companies.newDialog') }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="guardar">
            <v-text-field v-model="form.nombre" :label="t('common.name')" required />
            <v-select
              v-model="form.paisId"
              :items="paises"
              item-title="nombre"
              item-value="id"
              :label="t('common.country')"
              required
            />
            <v-text-field
              v-model="form.identificadorFiscal"
              :label="t('admin.companies.fiscalId')"
              :hint="t('common.optional')"
              persistent-hint
            />
            <v-switch v-model="form.activo" :label="t('admin.companies.active')" color="primary" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="guardar">{{ t('common.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
