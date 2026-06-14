<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: 'ROLE_ADMIN'
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.testTypes.title')} — ${t('common.appName')}` })

interface TestTypeDto {
  id: string
  code: string
  name: string
  description: string | null
}

const api = useApi()

const items = ref<TestTypeDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const dialog = ref(false)
const saving = ref(false)
const form = ref({ code: '', name: '', description: '' })

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
  form.value = { code: '', name: '', description: '' }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    await api.post<TestTypeDto>('/test-types', {
      code: form.value.code.toUpperCase(),
      name: form.value.name,
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
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])
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
        items-per-page="25"
        density="comfortable"
      >
        <template #item.actions="{ item }">
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
