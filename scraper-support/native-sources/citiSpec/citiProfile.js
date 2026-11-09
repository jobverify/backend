import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { readLiteralModel } from '../literalModel.js'
import { text, content, children, hasClass, requirePublished, only, absolute } from '../cisVeeam/publishedData.js'

export const CITI_PRIMARY = 'https://jobs.citi.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D'
export const CITI_ASSETS = Object.freeze({
  'https://tbcdn.talentbrew.com/js/client/search.js': 'f58913158b9aa603a2a21969c4533ae9023d26ff6699d5ac505ef9d469bd85dd',
  'https://tbcdn.talentbrew.com/bundles/tb-corepack.js': '679b3cbd2d0f1c7c867f2a1c3a2b5394042ce544acb547a791a0c1ce0199f669',
})
export const citiRoleURL = value => {
  try { const url = new URL(value);return url.origin === 'https://jobs.citi.com' && !url.username && !url.password && !url.search && !url.hash
    && /^\/job\/[a-z0-9-]+\/[a-z0-9-]+\/287\/\d+$/.test(url.pathname) } catch { return false }
}
export const readCitiSearch = html => {
  const document = readNativeDocument(html), scope = only(document.nodes(node => node.attrs['data-selector-name'] === 'searchresults'), 'owned Citi searchresults')
  const list = only(children(scope, node => node.attrs.id === 'search-results-list'), 'owned Citi result list')
  const number = key => /^\d+$/.test(scope.attrs[key] || '') ? Number(scope.attrs[key]) : null
  const country = children(scope, node => node.tag === 'button' && hasClass(node, 'filter-button') && node.attrs['data-id'] === '1269750' && node.attrs['data-facet-type'] === '2')
  requirePublished(country.length === 1 && /India/.test(content(country[0])), 'Current native India facet is missing or ambiguous')
  const entries = children(list, node => node.tag === 'a' && node.attrs['data-job-id']).map(node => {
    const url = absolute(node.attrs.href, CITI_PRIMARY), id = node.attrs['data-job-id']
    requirePublished(citiRoleURL(url) && new URL(url).pathname.split('/').at(-1) === id, 'Citi own card org/posting identity conflict')
    const headings = children(node, child => child.tag === 'h2'), locations = children(node, child => hasClass(child, 'job-location'))
    return { sourceUrl: url, url, jobId: id, title: headings.length === 1 ? content(headings[0]) : null,
      country: null, location: null, sourceNativeCardLocationLabel: locations.length === 1 ? content(locations[0]) : null,
      originalAttributes: { ...node.attrs } }
  })
  const cards = [...new Map(entries.map(entry => [entry.url, entry])).values()]
  const currentPage = number('data-current-page'), totalPages = number('data-total-pages'), reportedJobs = number('data-total-job-results')
  requirePublished(currentPage > 0 && totalPages >= currentPage && reportedJobs >= 0 && number('data-records-per-page') > 0, 'Native search counters unreadable')
  return { document, scope, cards, currentPage, totalPages, reportedJobs, recordsPerPage: number('data-records-per-page'), originalAttributes: { ...scope.attrs } }
}
const defaults = { ActiveFacetID: 0, Distance: 50, RadiusUnitType: 2, RecordsPerPage: 20, CurrentPage: 1, Keywords: '', Location: '',
  Latitude: null, Longitude: null, ShowRadius: false, FacetTerm: '', FacetType: null, SearchResultsModuleName: null, SearchFiltersModuleName: null,
  SortCriteria: 0, SortDirection: 1, SearchType: 1, CategoryFacetTerm: null, CategoryFacetType: null, LocationFacetTerm: null, LocationFacetType: null,
  KeywordType: null, LocationType: null, LocationPath: null, OrganizationIds: null, RefinedKeywords: [] }
const attr = (node, key) => node.attrs['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())]
const field = (node, name, type) => {
  const value = attr(node, name), fallback = defaults[name[0].toUpperCase() + name.slice(1)]
  if (type === 'int') return Number.isFinite(parseInt(value, 10)) ? parseInt(value, 10) : fallback
  if (type === 'float') return Number.isFinite(parseFloat(value)) ? parseFloat(value).toFixed(5) : fallback
  return value?.length ? value : fallback
}
// Exact field mapping and nested binder of the two fingerprinted, currently
// advertised public assets. No website code, eval or dynamic expressions run.
export const citiPagination = (search, page) => {
  const { document, scope: result } = search, filter = only(document.nodes(node => node.attrs.id === 'search-filters'), 'native search filter panel')
  requirePublished(Number.isSafeInteger(page) && page >= 1 && page <= search.totalPages, 'Page outside actual declared range')
  requirePublished(result.attrs['data-ajax-url'] === '/search-jobs/results', 'Unsupported native GET route')
  const criteria = {}
  for (const [name, type] of Object.entries({ activeFacetId: 'int', currentPage: 'int', recordsPerPage: 'int', totalContentResults: 'int', distance: 'int',
    keywords: 'string', location: 'string', latitude: 'float', longitude: 'float', customFacetName: 'string', facetTerm: 'string', facetType: 'int',
    searchResultsModuleName: 'string', sortCriteria: 'int', sortDirection: 'int', searchType: 'int', categoryFacetTerm: 'string', categoryFacetType: 'int',
    locationFacetTerm: 'string', locationFacetType: 'int', keywordType: 'string', locationType: 'string', locationPath: 'string', organizationIds: 'string', postalCode: 'string', resultsType: 'int' })) {
    criteria[name === 'activeFacetId' ? 'ActiveFacetID' : name[0].toUpperCase() + name.slice(1)] = field(result, name, type)
  }
  criteria.CurrentPage = page;criteria.RadiusUnitType = field(filter, 'radiusUnitType', 'int');criteria.ShowRadius = attr(result, 'showRadius');criteria.IsPagination = 'True'
  criteria.SearchFiltersModuleName = field(filter, 'searchFiltersModuleName', 'string')
  criteria.FacetFilters = children(filter, node => node.tag === 'input' && hasClass(node, 'filter-checkbox')
    && Object.hasOwn(node.attrs, 'checked') && !Object.hasOwn(node.attrs, 'disabled')).map(node => ({
      ID: Number(attr(node, 'id')), FacetType: Number(attr(node, 'facetType')), Count: Number(attr(node, 'count')),
      Display: attr(node, 'display'), IsApplied: true, FieldName: attr(node, 'fieldName') }))
  const refined = readLiteralModel(attr(result, 'refinedKeywords') || '[]').value
  requirePublished(Array.isArray(refined) && refined.every(value => typeof value === 'string'), 'Refined keyword data is not literal strings')
  criteria.RefinedKeywords = refined
  for (const [name, key] of Object.entries({ fc: 'filteredCategories', fl: 'filteredLocations', fcf: 'filteredCustomFacet', afc: 'filteredAdvancedCategories', afl: 'filteredAdvancedLocations', afcf: 'filteredAdvancedCustomFacet' })) criteria[name] = attr(filter, key)
  const countryFacets = criteria.FacetFilters.filter(value => value.FacetType === 2)
  requirePublished(countryFacets.length === 1 && countryFacets[0].ID === 1269750 && countryFacets[0].Display === 'India', 'Native request country facet changed')
  const pairs = [], append = (key, value) => pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value == null ? '' : value))
  const bind = (name, value) => {
    if (Array.isArray(value)) value.forEach((item, index) => bind(name + '[' + index + ']', item))
    else if (typeof value !== 'object') append(name, value)
    else for (const key in value) bind(name + '.' + key, value[key])
  }
  for (const key in criteria) bind(key, criteria[key])
  const query = pairs.join('&').replaceAll('%20', '+'), limit = Number(attr(filter, 'ajaxCharLimit'))
  requirePublished(Number.isSafeInteger(limit) && limit > 0 && query.length <= limit, 'Current native action would require POST; public GET-only reader holds it')
  return { url: 'https://jobs.citi.com/search-jobs/results?' + query, criteria, page, GETBranchCharacterLimit: limit }
}
