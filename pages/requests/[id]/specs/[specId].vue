<script setup lang="ts">
import { useApi } from '~/composables/useApi'

definePageMeta({
  ssr: false,
  layout: 'console',
  requiresRole: ['ROLE_ADMIN', 'ROLE_ESPECIALISTA']
})

const { t } = useI18n()
useHead({ title: () => `${t('admin.cypressSpecs.title')} — ${t('common.appName')}` })

interface CypressSpecDto {
  id: string
  testRequestId: string
  name: string
  description: string | null
  source: string
  active: boolean
  createdByEmail: string | null
  updatedByEmail: string | null
  createdAt: string | null
  updatedAt: string | null
}

const route = useRoute()
const router = useRouter()
const api = useApi()

const testRequestId = computed(() => route.params.id as string)
const specIdParam = computed(() => route.params.specId as string)
const isNew = computed(() => specIdParam.value === 'new')

const STARTER_SOURCE = `describe('nuevo spec', () => {
  it('hace algo', () => {
    cy.visit('https://example.com');
    cy.contains('Example');
  });
});
`

const form = ref({
  name: '',
  description: '',
  source: STARTER_SOURCE,
  active: true
})

const loading = ref(false)
const saving = ref(false)
const running = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const runError = ref<string | null>(null)
const lastRunResultId = ref<string | null>(null)

async function load() {
  if (isNew.value) return
  loading.value = true
  loadError.value = null
  try {
    const data = await api.get<CypressSpecDto>(
      `/test-requests/${testRequestId.value}/cypress-specs/${specIdParam.value}`
    )
    form.value.name = data.name
    form.value.description = data.description || ''
    form.value.source = data.source
    form.value.active = data.active
  } catch (err: any) {
    loadError.value = err?.data?.message || err?.message || t('admin.cypressSpecs.loadError')
  } finally {
    loading.value = false
  }
}

async function save(): Promise<string | null> {
  saving.value = true
  saveError.value = null
  try {
    if (isNew.value) {
      const created = await api.post<CypressSpecDto>(
        `/test-requests/${testRequestId.value}/cypress-specs`,
        {
          name: form.value.name,
          description: form.value.description || null,
          source: form.value.source
        }
      )
      // Redirigir a la URL canónica del spec creado.
      await router.replace(`/requests/${testRequestId.value}/specs/${created.id}`)
      return created.id
    } else {
      await api.put<CypressSpecDto>(
        `/test-requests/${testRequestId.value}/cypress-specs/${specIdParam.value}`,
        {
          name: form.value.name,
          description: form.value.description || null,
          source: form.value.source,
          active: form.value.active
        }
      )
      return specIdParam.value
    }
  } catch (err: any) {
    saveError.value = err?.data?.message || err?.message || t('admin.cypressSpecs.saveError')
    return null
  } finally {
    saving.value = false
  }
}

async function saveAndRun() {
  const id = await save()
  if (!id) return
  running.value = true
  runError.value = null
  lastRunResultId.value = null
  try {
    const data = await api.post<{ runResultId: string | null }>(
      '/cypress-runner/run',
      { cypressSpecId: id }
    )
    lastRunResultId.value = data.runResultId
  } catch (err: any) {
    runError.value = err?.data?.message || err?.message || t('admin.cypressSpecs.runError')
  } finally {
    running.value = false
  }
}

onMounted(load)
</script>

<template>
  <v-container fluid class="py-6" style="max-width: 1100px">
    <div class="d-flex align-center flex-wrap gap-2 mb-3">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        :to="`/requests/${testRequestId}/specs`"
      >
        {{ t('admin.cypressSpecs.back') }}
      </v-btn>
    </div>

    <div class="mb-5">
      <h1 class="text-h5 font-weight-bold">
        {{ isNew ? t('admin.cypressSpecs.new') : (form.name || t('admin.cypressSpecs.title')) }}
      </h1>
    </div>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">{{ loadError }}</v-alert>
    <v-alert v-if="saveError" type="error" variant="tonal" class="mb-4" closable @click:close="saveError = null">
      {{ saveError }}
    </v-alert>
    <v-alert v-if="runError" type="error" variant="tonal" class="mb-4" closable @click:close="runError = null">
      {{ runError }}
    </v-alert>
    <v-alert v-if="lastRunResultId" type="success" variant="tonal" class="mb-4">
      {{ t('admin.cypressSpecs.lastRunSaved') }} —
      <NuxtLink :to="`/test-runs/${lastRunResultId}`">{{ t('admin.cypressSpecs.viewDetail') }}</NuxtLink>
    </v-alert>

    <v-card variant="outlined" rounded="lg" class="pa-4" :loading="loading">
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.name"
            :label="t('admin.cypressSpecs.name')"
            :hint="t('admin.cypressSpecs.nameHint')"
            persistent-hint
            density="compact"
            variant="outlined"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="form.description"
            :label="t('admin.cypressSpecs.description')"
            density="compact"
            variant="outlined"
          />
        </v-col>
        <v-col cols="12" md="2" class="d-flex align-center">
          <v-switch
            v-model="form.active"
            :label="t('admin.cypressSpecs.active')"
            color="primary"
            density="compact"
            hide-details
            :disabled="isNew"
          />
        </v-col>
      </v-row>

      <div class="text-caption text-medium-emphasis mb-1">{{ t('admin.cypressSpecs.source') }}</div>
      <textarea
        v-model="form.source"
        class="source-editor"
        spellcheck="false"
        rows="24"
      />

      <div class="d-flex flex-wrap gap-2 mt-4">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-content-save-outline"
          :loading="saving"
          :disabled="running"
          @click="save"
        >
          {{ t('admin.cypressSpecs.save') }}
        </v-btn>
        <v-btn
          color="success"
          variant="flat"
          prepend-icon="mdi-play"
          :loading="running"
          :disabled="saving"
          @click="saveAndRun"
        >
          {{ t('admin.cypressSpecs.run') }}
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<style scoped>
.source-editor {
  width: 100%;
  min-height: 480px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  resize: vertical;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  white-space: pre;
  overflow-x: auto;
  tab-size: 2;
}
.source-editor:focus {
  outline: none;
  border-color: rgb(var(--v-theme-primary));
}
.gap-2 {
  gap: 8px;
}
</style>
