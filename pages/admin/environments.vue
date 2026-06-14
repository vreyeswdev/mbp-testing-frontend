<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: 'ROLE_ADMIN'
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.environments.title')} — ${t('common.appName')}` })

interface EnvironmentDto {
  id: string
  code: string
  name: string
}

const api = useApi()

const items = ref<EnvironmentDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const dialog = ref(false)
const saving = ref(false)
const form = ref({ code: '', name: '' })

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = await api.get<EnvironmentDto[]>('/environments')
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorLoad')
  } finally {
    loading.value = false
  }
}

function openNew() {
  form.value = { code: '', name: '' }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    await api.post<EnvironmentDto>('/environments', {
      code: form.value.code.toUpperCase(),
      name: form.value.name
    })
    dialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorCreate')
  } finally {
    saving.value = false
  }
}

async function remove(item: EnvironmentDto) {
  try {
    await api.del(`/environments/${item.id}`)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || t('common.errorDelete')
  }
}

onMounted(load)

const headers = computed(() => [
  { title: t('admin.environments.headers.code'), key: 'code' },
  { title: t('admin.environments.headers.name'), key: 'name' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center mb-6">
      <div>
        <div class="text-overline text-medium-emphasis">{{ t('admin.environments.overline') }}</div>
        <h1 class="text-h4 font-weight-bold">{{ t('admin.environments.title') }}</h1>
      </div>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">{{ t('admin.environments.new') }}</v-btn>
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

    <v-dialog v-model="dialog" max-width="480">
      <v-card>
        <v-card-title>{{ t('admin.environments.dialog.title') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.code" :label="t('admin.environments.dialog.code')" />
          <v-text-field v-model="form.name" :label="t('admin.environments.dialog.name')" />
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
