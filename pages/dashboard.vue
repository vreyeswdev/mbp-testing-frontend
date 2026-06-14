<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ ssr: false, layout: 'console' })

const { t } = useI18n()
useHead({ title: () => `${t('dashboard.title')} — ${t('common.appName')}` })

interface GlobalMetrics {
  activeTestRequests: number
  completedTestRequests: number
  cancelledTestRequests: number
  openFixes: number
  resolvedFixes: number
  testCardsInProgress: number
  approvedAmount: number
}

interface SpecialistMetrics {
  userId: string
  email: string
  assignedTestRequests: number
  testRequestsByStatus: Record<string, number>
  cardsCompletedAllTime: number
  cardsInProgress: number
  fixesAssigned: number
  fixesOpen: number
  fixesResolved: number
  avgCardCycleHours: number
}

interface CompanyMetrics {
  companiaId: string
  companiaNombre: string
  totalProjects: number
  totalTestRequests: number
  testRequestsByStatus: Record<string, number>
  totalApprovedAmount: number
}

interface CompaniaDto {
  id: string
  nombre: string
}

const api = useApi()
const auth = useAuthStore()

const global = ref<GlobalMetrics | null>(null)
const specialist = ref<SpecialistMetrics | null>(null)
const companies = ref<CompanyMetrics[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function loadGlobal() {
  if (!auth.isAdmin) return
  try {
    global.value = await api.get<GlobalMetrics>('/metrics/global')
  } catch (e: any) {
    error.value = e?.data?.message || t('dashboard.errors.global')
  }
}

async function loadSpecialist() {
  if (!auth.isEspecialista || !auth.id) return
  try {
    specialist.value = await api.get<SpecialistMetrics>(`/metrics/specialists/${auth.id}`)
  } catch (e: any) {
    error.value = e?.data?.message || t('dashboard.errors.specialist')
  }
}

async function loadCompanies() {
  if (auth.isAdmin) {
    try {
      const list = await api.get<CompaniaDto[]>('/companias')
      companies.value = []
      for (const c of list) {
        try {
          const m = await api.get<CompanyMetrics>(`/metrics/companies/${c.id}`)
          companies.value.push(m)
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    return
  }
  if (!auth.isCliente) return
  // Cliente: no tenemos endpoint dedicado para listar sus compañías;
  // por ahora se omite (vendrá en track futuro de "mis compañías").
}

function fmtMoney(n: number) {
  return `CLP ${Number(n ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })}`
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadGlobal(), loadSpecialist(), loadCompanies()])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-container class="py-8" fluid>
    <div class="mb-6">
      <div class="text-overline text-medium-emphasis">{{ t('dashboard.overline') }}</div>
      <h1 class="text-h4 font-weight-bold">{{ t('dashboard.title') }}</h1>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading" type="card" />

    <template v-else>
      <section v-if="global" class="mb-8">
        <h2 class="text-h6 font-weight-medium mb-3">{{ t('dashboard.globalSection') }}</h2>
        <v-row>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.activeRequests')"
              :value="global.activeTestRequests"
              color="info"
              icon="mdi-clipboard-clock"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.completedRequests')"
              :value="global.completedTestRequests"
              color="success"
              icon="mdi-check-circle"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.cancelledRequests')"
              :value="global.cancelledTestRequests"
              color="red"
              icon="mdi-close-circle"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.cardsInProgress')"
              :value="global.testCardsInProgress"
              color="amber"
              icon="mdi-play"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.openFixes')"
              :value="global.openFixes"
              color="red"
              icon="mdi-bug"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.resolvedFixes')"
              :value="global.resolvedFixes"
              color="success"
              icon="mdi-bug-check"
            />
          </v-col>
          <v-col cols="12" sm="6" md="6">
            <MetricCard
              :title="t('dashboard.metrics.approvedAmount')"
              :value="fmtMoney(global.approvedAmount)"
              color="primary"
              icon="mdi-currency-usd"
            />
          </v-col>
        </v-row>
      </section>

      <section v-if="specialist" class="mb-8">
        <h2 class="text-h6 font-weight-medium mb-3">{{ t('dashboard.mySection') }}</h2>
        <v-row>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.assignedRequests')"
              :value="specialist.assignedTestRequests"
              icon="mdi-clipboard-account"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.cardsInProgress')"
              :value="specialist.cardsInProgress"
              color="amber"
              icon="mdi-play"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.completedCards')"
              :value="specialist.cardsCompletedAllTime"
              color="success"
              icon="mdi-check"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.avgCycle')"
              :value="`${specialist.avgCardCycleHours.toFixed(1)} h`"
              :hint="t('dashboard.metrics.avgCycleHint')"
              icon="mdi-timer-sand"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.assignedFixes')"
              :value="specialist.fixesAssigned"
              icon="mdi-bug"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.openFixesShort')"
              :value="specialist.fixesOpen"
              color="red"
              icon="mdi-bug-outline"
            />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <MetricCard
              :title="t('dashboard.metrics.resolvedFixesShort')"
              :value="specialist.fixesResolved"
              color="success"
              icon="mdi-bug-check"
            />
          </v-col>
        </v-row>
      </section>

      <section v-if="companies.length">
        <h2 class="text-h6 font-weight-medium mb-3">{{ t('dashboard.byCompanySection') }}</h2>
        <v-row>
          <v-col v-for="c in companies" :key="c.companiaId" cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title>{{ c.companiaNombre }}</v-card-title>
              <v-card-text>
                <v-row no-gutters>
                  <v-col cols="6"><div class="text-overline">{{ t('dashboard.company.projects') }}</div><div class="text-h6">{{ c.totalProjects }}</div></v-col>
                  <v-col cols="6"><div class="text-overline">{{ t('dashboard.company.requests') }}</div><div class="text-h6">{{ c.totalTestRequests }}</div></v-col>
                  <v-col cols="12"><div class="text-overline">{{ t('dashboard.company.approvedAmount') }}</div><div class="text-h6">{{ fmtMoney(c.totalApprovedAmount) }}</div></v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </section>

      <div v-if="!global && !specialist && !companies.length" class="text-center text-medium-emphasis pa-8">
        {{ t('dashboard.empty') }}
      </div>
    </template>
  </v-container>
</template>
