<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useCatalog } from '~/composables/useCatalog'

definePageMeta({ ssr: false })

useHead({ title: 'Fix — MBP Testing' })

interface FixDto {
  id: string
  testCardId: string
  title: string
  description: string | null
  severity: string
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'WONT_FIX'
  reportedById: string
  reportedByEmail: string
  assignedToId: string | null
  assignedToEmail: string | null
  resolvedAt: string | null
  createdAt: string
}

interface CommentDto {
  id: string
  targetType: string
  targetId: string
  authorId: string
  authorEmail: string
  body: string
  createdAt: string
}

const ALLOWED_NEXT: Record<FixDto['status'], FixDto['status'][]> = {
  OPEN: ['IN_REVIEW', 'WONT_FIX', 'RESOLVED'],
  IN_REVIEW: ['RESOLVED', 'WONT_FIX', 'OPEN'],
  RESOLVED: ['OPEN'],
  WONT_FIX: ['OPEN']
}

const route = useRoute()
const api = useApi()
const catalog = useCatalog()
const id = computed(() => route.params.id as string)

const fix = ref<FixDto | null>(null)
const comments = ref<CommentDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const transitionDialog = ref(false)
const transitionTo = ref<FixDto['status'] | ''>('')
const transitionComment = ref('')
const newComment = ref('')

async function load() {
  loading.value = true
  error.value = null
  try {
    await catalog.loadAll()
    fix.value = await api.get<FixDto>(`/fixes/${id.value}`)
    comments.value = await api.get<CommentDto[]>(`/comments?targetType=FIX&targetId=${id.value}`)
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cargar'
  } finally {
    loading.value = false
  }
}

const allowedNext = computed(() => fix.value ? ALLOWED_NEXT[fix.value.status] : [])

function openTransition(to: FixDto['status']) {
  transitionTo.value = to
  transitionComment.value = ''
  transitionDialog.value = true
}

async function applyTransition() {
  if (!transitionTo.value) return
  try {
    await api.post(`/fixes/${id.value}/transitions`, {
      status: transitionTo.value,
      comment: transitionComment.value || null
    })
    transitionDialog.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible cambiar el estado'
  }
}

async function postComment() {
  if (!newComment.value.trim()) return
  try {
    await api.post<CommentDto>('/comments', {
      targetType: 'FIX',
      targetId: id.value,
      body: newComment.value
    })
    newComment.value = ''
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || 'No fue posible comentar'
  }
}

function statusColor(s: string) {
  return ({
    OPEN: 'red',
    IN_REVIEW: 'amber',
    RESOLVED: 'success',
    WONT_FIX: 'grey'
  } as Record<string, string>)[s] ?? 'grey'
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
</script>

<template>
  <v-container class="py-8">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/requests" class="mb-4">
      Volver
    </v-btn>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading && !fix" type="card" />

    <template v-else-if="fix">
      <v-card class="mb-6">
        <v-card-title class="d-flex align-center">
          {{ fix.title }}
          <v-spacer />
          <v-chip :color="severityColor(fix.severity)" size="small" variant="tonal" class="me-2">
            {{ fix.severity }}
          </v-chip>
          <v-chip :color="statusColor(fix.status)" variant="tonal">
            {{ fix.status.replace(/_/g, ' ') }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <div v-if="fix.description" class="mb-3">{{ fix.description }}</div>
          <v-row>
            <v-col cols="12" md="4">
              <div class="text-overline">Reportado por</div>
              <div>{{ fix.reportedByEmail }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">Asignado a</div>
              <div>{{ fix.assignedToEmail || '—' }}</div>
            </v-col>
            <v-col cols="12" md="4">
              <div class="text-overline">Resuelto</div>
              <div>{{ fix.resolvedAt ? new Date(fix.resolvedAt).toLocaleString() : '—' }}</div>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="flex-wrap pa-4">
          <v-btn
            v-for="t in allowedNext"
            :key="t"
            :color="statusColor(t)"
            variant="tonal"
            size="small"
            class="me-2 mb-2"
            @click="openTransition(t)"
          >
            → {{ t.replace(/_/g, ' ') }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <v-card>
        <v-card-title>Comentarios</v-card-title>
        <v-list density="comfortable">
          <v-list-item v-for="c in comments" :key="c.id">
            <template #prepend>
              <v-avatar size="32" color="grey-lighten-2">
                <v-icon size="20">mdi-account</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title>{{ c.authorEmail }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              {{ new Date(c.createdAt).toLocaleString() }}
            </v-list-item-subtitle>
            <div class="text-body-2 mt-1">{{ c.body }}</div>
          </v-list-item>
          <v-list-item v-if="comments.length === 0">
            <v-list-item-title class="text-caption text-medium-emphasis">
              Sin comentarios.
            </v-list-item-title>
          </v-list-item>
        </v-list>
        <v-divider />
        <v-card-text>
          <v-textarea v-model="newComment" label="Escribe un comentario…" rows="2" auto-grow />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" :disabled="!newComment.trim()" @click="postComment">Comentar</v-btn>
        </v-card-actions>
      </v-card>
    </template>

    <v-dialog v-model="transitionDialog" max-width="500">
      <v-card>
        <v-card-title>Cambiar a {{ transitionTo.replace(/_/g, ' ') }}</v-card-title>
        <v-card-text>
          <v-textarea v-model="transitionComment" label="Comentario (opcional)" rows="3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="transitionDialog = false">Cancelar</v-btn>
          <v-btn color="primary" @click="applyTransition">Aplicar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
