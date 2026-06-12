import { useApi } from '~/composables/useApi'

export interface CatalogValue {
  code: string
  label: string
}

export interface TestType {
  id: string
  code: string
  name: string
  description: string | null
}

export interface Environment {
  id: string
  code: string
  name: string
}

interface CatalogState {
  priorities: CatalogValue[]
  severities: CatalogValue[]
  projectStatuses: CatalogValue[]
  featureStatuses: CatalogValue[]
  testRequestStatuses: CatalogValue[]
  quoteStatuses: CatalogValue[]
  quoteItemTypes: CatalogValue[]
  kanbanStatuses: CatalogValue[]
  fixStatuses: CatalogValue[]
  testTypes: TestType[]
  environments: Environment[]
}

const empty = (): CatalogState => ({
  priorities: [],
  severities: [],
  projectStatuses: [],
  featureStatuses: [],
  testRequestStatuses: [],
  quoteStatuses: [],
  quoteItemTypes: [],
  kanbanStatuses: [],
  fixStatuses: [],
  testTypes: [],
  environments: []
})

export const useCatalog = () => {
  const api = useApi()
  const state = useState<CatalogState>('qa-catalog', empty)
  const loaded = useState<boolean>('qa-catalog-loaded', () => false)

  async function loadAll(force = false) {
    if (loaded.value && !force) return state.value
    const [priorities, severities, projectStatuses, featureStatuses, testRequestStatuses, quoteStatuses, quoteItemTypes, kanbanStatuses, fixStatuses, testTypes, environments] =
      await Promise.all([
        api.get<CatalogValue[]>('/catalog/priorities'),
        api.get<CatalogValue[]>('/catalog/severities'),
        api.get<CatalogValue[]>('/catalog/project-statuses'),
        api.get<CatalogValue[]>('/catalog/feature-statuses'),
        api.get<CatalogValue[]>('/catalog/test-request-statuses'),
        api.get<CatalogValue[]>('/catalog/quote-statuses'),
        api.get<CatalogValue[]>('/catalog/quote-item-types'),
        api.get<CatalogValue[]>('/catalog/kanban-statuses'),
        api.get<CatalogValue[]>('/catalog/fix-statuses'),
        api.get<TestType[]>('/test-types'),
        api.get<Environment[]>('/environments')
      ])
    state.value = { priorities, severities, projectStatuses, featureStatuses, testRequestStatuses, quoteStatuses, quoteItemTypes, kanbanStatuses, fixStatuses, testTypes, environments }
    loaded.value = true
    return state.value
  }

  return { state, loaded, loadAll }
}
