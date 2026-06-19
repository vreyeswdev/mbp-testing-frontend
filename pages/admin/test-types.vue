<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: 'ROLE_ADMIN'
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.testTypes.title')} — ${t('common.appName')}` })

type ServiceCategory = 'QA' | 'AUTOMATION' | 'PERFORMANCE' | 'SECURITY'

interface TestTypeDto {
  id: string
  code: string
  name: string
  description: string | null
  available: boolean
  serviceCategory: ServiceCategory
  ordering: number
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  QA: 'QA Manual',
  AUTOMATION: 'Automatización',
  PERFORMANCE: 'Performance',
  SECURITY: 'Seguridad'
}
const categoryOptions = (Object.keys(CATEGORY_LABELS) as ServiceCategory[])
  .map(c => ({ value: c, title: CATEGORY_LABELS[c] }))

const api = useApi()

const items = ref<TestTypeDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const dialog = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const form = ref<{
  code: string
  name: string
  description: string
  available: boolean
  serviceCategory: ServiceCategory
  ordering: number
}>({ code: '', name: '', description: '', available: true, serviceCategory: 'QA', ordering: 0 })

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = await api.get<TestTypeDto[]>('/test-types')
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorLoad')
  } finally {
    loading.value = false
  }
}

function openNew() {
  editingId.value = null
  form.value = { code: '', name: '', description: '', available: true, serviceCategory: 'QA', ordering: 0 }
  dialog.value = true
}

function openEdit(item: TestTypeDto) {
  editingId.value = item.id
  form.value = {
    code: item.code,
    name: item.name,
    description: item.description ?? '',
    available: item.available,
    serviceCategory: item.serviceCategory,
    ordering: item.ordering
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    const body = {
      code: form.value.code.toUpperCase(),
      name: form.value.name,
      description: form.value.description || null,
      available: form.value.available,
      serviceCategory: form.value.serviceCategory,
      ordering: form.value.ordering
    }
    if (editingId.value) {
      await api.put<TestTypeDto>(`/test-types/${editingId.value}`, body)
    } else {
      await api.post<TestTypeDto>('/test-types', body)
    }
    dialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorCreate')
  } finally {
    saving.value = false
  }
}

async function remove(item: TestTypeDto) {
  try {
    await api.del(`/test-types/${item.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
  }
}

onMounted(load)

const headers = computed(() => [
  { title: t('admin.testTypes.headers.code'), key: 'code' },
  { title: t('admin.testTypes.headers.name'), key: 'name' },
  { title: t('admin.testTypes.headers.description'), key: 'description' },
  { title: 'Orden', key: 'ordering', width: 80 },
  { title: 'Disponible', key: 'available', width: 110 },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])

const groupBy = [{ key: 'serviceCategory', order: 'asc' as const }]

function categoryLabel(code: string) {
  return CATEGORY_LABELS[code as ServiceCategory] ?? code
}
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">{{ t('admin.testTypes.overline') }}</div>
        <h1 class="text-h4 font-weight-bold">{{ t('admin.testTypes.title') }}</h1>
      </div>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">{{ t('admin.testTypes.new') }}</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card variant="outlined">
      <v-data-table
        :headers="headers"
        :items="items"
        :loading="loading"
        :group-by="groupBy"
        items-per-page="50"
        density="comfortable"
      >
        <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
          <tr>
            <td :colspan="columns.length" class="bg-surface-variant">
              <div class="d-flex align-center ga-2 py-1">
                <v-btn
                  size="x-small"
                  variant="text"
                  :icon="isGroupOpen(item) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                  @click="toggleGroup(item)"
                />
                <span class="text-subtitle-2">{{ categoryLabel(item.value as string) }}</span>
              </div>
            </td>
          </tr>
        </template>
        <template #item.available="{ item }">
          <v-chip
            size="x-small"
            :color="item.available ? 'success' : 'accent'"
            variant="tonal"
          >
            {{ item.available ? 'Sí' : 'Próximamente' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn size="small" variant="text" icon="mdi-pencil" @click="openEdit(item)" />
          <v-btn size="small" variant="text" color="error" icon="mdi-delete" @click="remove(item)" />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ t('admin.testTypes.dialog.title') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.code" :label="t('admin.testTypes.dialog.code')" />
          <v-text-field v-model="form.name" :label="t('admin.testTypes.dialog.name')" />
          <v-textarea v-model="form.description" :label="t('admin.testTypes.dialog.description')" rows="2" />
          <v-select
            v-model="form.serviceCategory"
            :items="categoryOptions"
            label="Categoría de servicio"
            item-title="title"
            item-value="value"
          />
          <v-text-field
            v-model.number="form.ordering"
            label="Orden dentro de la categoría"
            type="number"
            min="0"
          />
          <v-switch
            v-model="form.available"
            label="Disponible para clientes"
            color="primary"
            density="comfortable"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">
            {{ editingId ? t('common.save') : t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
