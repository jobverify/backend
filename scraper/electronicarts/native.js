import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const SEARCH_URL = 'https://jobs.ea.com/en_US/careers/Home/'
const ORIGIN = 'https://jobs.ea.com', PAGE_SIZE = 20
const requireEA = (condition, message) => { if (!condition) throw Error('EA native inventory: ' + message) }
const one = (nodes, message) => { requireEA(nodes.length === 1, message); return nodes[0] }
const urlFor = offset => `${SEARCH_URL}?jobRecordsPerPage=20&jobOffset=${offset}`
const roleId = url => /^https:\/\/jobs\.ea\.com\/en_US\/careers\/JobDetail\/[^/?#]+\/([1-9]\d*)$/.exec(url)?.[1]
const proseText = node => !node || node.inactive || /^(?:h[1-6]|strong|b|script|style)$/.test(node.tag) ? ''
  : node.children.map(child => typeof child === 'string' ? child : proseText(child)).join(' ')
const activeProse = html => { const d = document(html); return extractActiveDescription(proseText(d.root)) ? extractActiveDescription(html) : null }

const countryLabels = new Map([['United States of America', 'United States'], ['Korea, Republic of', 'South Korea']])
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = nativeCountryName(code)
  if (name) countryLabels.set(regionNames.of(code), name)
}
const orderedCountries = [...countryLabels.keys()].sort((a, b) => b.length - a.length)
const foreignStates = /^(?:AK|AL|AZ|CA|CO|CT|DC|DE|FL|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|PR|RI|SC|SD|TX|UT|VA|VT|WA|WI|WV|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)$/i
const validateGeography = (country, state) => requireEA(country !== 'India' || !foreignStates.test(state || ''), 'contradictory native geography: India and foreign state')
const parseLocation = value => {
  const label = norm(value)
  const suffix = orderedCountries.find(country => label === country || label.endsWith(', ' + country))
  requireEA(suffix, 'native location has no recognized explicit country: ' + label)
  const parts = label.slice(0, label.length - suffix.length).replace(/,\s*$/, '').split(',').map(part => part.trim()).filter(Boolean)
  const country = countryLabels.get(suffix), state = parts.slice(1).join(', ') || null
  validateGeography(country, state)
  return { label, country, city: parts[0] || null, state }
}

const readPage = (page, url, type) => {
  requireEA(page?.status === 200 && page.url === url && typeof page.html === 'string' && page.html.length <= 4 * 1024 * 1024, 'HTTP failure, redirect identity or body bound')
  const d = document(page.html)
  for (const tag of ['html', 'body']) d.outer(one(d.nodes(node => node.tag === tag), 'native page envelope'))
  for (const [name, expected] of Object.entries({ 'avature.portal.id': '4', 'avature.portal.urlPath': 'careers', 'avature.portal.lang': 'en_US', 'avature.portal.page': type })) {
    const node = one(d.nodes(node => node.tag === 'meta' && node.attrs.name === name), 'native employer portal identity')
    requireEA(node.attrs.content === expected, 'native employer portal identity changed')
  }
  const canonical = one(d.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'native canonical identity')
  requireEA(canonical.attrs.href === (type === 'Home' ? SEARCH_URL.slice(0, -1) : url), 'native canonical identity mismatch')
  return d
}

const listingPage = (page, url, offset) => {
  const d = readPage(page, url, 'Home')
  requireEA(norm(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) === 'Job Search | Electronic Arts', 'listing employer identity changed')
  const forms = d.nodes(node => node.tag === 'form' && node.attrs.id === 'tpt_jobSortableForm')
  const form = one(forms, 'native unfiltered search form missing')
  requireEA(form.attrs.action === SEARCH_URL.slice(0, -1), 'native search form identity changed')
  for (const input of d.nodes(node => node.tag === 'input' && ['search', 'jobSort', 'jobSortDirection'].includes(node.attrs.name), form)) {
    requireEA(!input.attrs.value, 'native search filter is active')
  }
  requireEA(!d.nodes(node => node.tag === 'option' && Object.hasOwn(node.attrs, 'selected') && node.attrs.value, form).length, 'native country or department filter is active')
  const summaries = d.nodes(node => d.hasClass(node, 'list-controls__text__legend')).map(node => {
    const match = /^(\d+)-(\d+)\s+of\s+(\d+)\s+results$/.exec(d.text(node))
    requireEA(match && node.attrs['aria-label'] === `${match[3]} results`, 'native listing total or range schema changed')
    return match.slice(1).map(Number)
  })
  requireEA(summaries.length >= 1 && summaries.every(summary => JSON.stringify(summary) === JSON.stringify(summaries[0])), 'native listing count/range conflict')
  const [start, end, total] = summaries[0]
  requireEA(total > 0 && start === offset + 1 && end === Math.min(offset + PAGE_SIZE, total), 'native listing range does not match requested offset')
  const cards = d.nodes(node => node.tag === 'article' && d.hasClass(node, 'article--result'))
  const rows = cards.map(card => {
    d.outer(card)
    const anchor = one(d.nodes(node => node.tag === 'a' && d.hasClass(node, 'link_result'), card), 'listing role link missing')
    const idText = d.text(one(d.nodes(node => d.hasClass(node, 'list-item-id'), card), 'listing Role ID missing'))
    const id = /^Role ID ([1-9]\d*)$/.exec(idText)?.[1], url = anchor.attrs.href
    requireEA(id && roleId(url) === id && d.text(anchor), 'listing job identity mismatch')
    const location = parseLocation(d.text(one(d.nodes(node => d.hasClass(node, 'list-item-location'), card), 'listing location missing')))
    return { id, url, title: d.text(anchor), location }
  })
  requireEA(rows.length === end - start + 1, 'truncated or oversized native listing page')
  const next = [...new Set(d.nodes(node => node.tag === 'a' && d.hasClass(node, 'paginationNextLink')).map(node => node.attrs.href))]
  requireEA(end < total ? next.length === 1 && next[0] === urlFor(offset + PAGE_SIZE) : next.length === 0, 'native next-page offset or terminal condition changed')
  return { rows, total, nextUrl: next[0] || null }
}

const detailPage = (page, row) => {
  const d = readPage(page, row.url, 'JobDetail')
  const bodyText = d.text(one(d.nodes(node => node.tag === 'body'), 'native role body'))
  requireEA(!/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(bodyText), 'native role visibly closed or unavailable')
  const title = one(d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title'), 'detail title missing').attrs.content
  const og = one(d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url'), 'detail URL missing').attrs.content
  requireEA(norm(title) === row.title && og === row.url, 'detail title or URL identity changed')
  const articles = d.nodes(node => node.tag === 'article' && d.hasClass(node, 'article--details'))
  const general = one(articles.filter(node => d.nodes(child => d.hasClass(child, 'article__header__text__title') && d.text(child) === 'General Information', node).length), 'native general information missing')
  const fields = new Map()
  for (const node of d.nodes(node => d.hasClass(node, 'article__content__view__field'), general)) {
    const labels = d.nodes(child => d.hasClass(child, 'article__content__view__field__label'), node)
    if (!labels.length) continue
    const label = d.text(one(labels, 'duplicated native field label'))
    const value = d.text(one(d.nodes(child => d.hasClass(child, 'article__content__view__field__value'), node), 'missing native field value'))
    requireEA(!fields.has(label), 'duplicate native general information')
    fields.set(label, value)
  }
  requireEA(fields.get('Role ID') === row.id, 'detail Role ID identity changed')
  requireEA(![...fields.keys()].some(label => /posted|publication|closing|date/i.test(label)), 'unverified native publication date contract')
  const locationField = one(d.nodes(node => d.hasClass(node, 'field--locations'), general), 'native complete location field missing')
  const locationValue = one(d.nodes(node => d.hasClass(node, 'article__content__view__field__value'), locationField), 'native location content missing')
  d.outer(locationValue)
  let locationMarkup = d.inner(locationValue)
  requireEA(/^\s*<strong>Locations<\/strong>\s*:/i.test(locationMarkup), 'native location list label changed')
  const secondaryLocations = []
  for (const dataset of d.nodes(node => node.tag === 'ul', locationValue)) {
    requireEA(d.hasClass(dataset, 'MultipleDataSetFields'), 'unverified secondary location dataset')
    const entries = d.nodes(node => node.tag === 'li', dataset)
    const values = new Map()
    for (const entry of entries) {
      requireEA(d.hasClass(entry, 'MultipleDataSetField'), 'unverified secondary location entry')
      const label = d.text(one(d.nodes(node => d.hasClass(node, 'MultipleDataSetFieldLabel'), entry), 'secondary location label'))
      const value = d.text(one(d.nodes(node => d.hasClass(node, 'MultipleDataSetFieldValue'), entry), 'secondary location value'))
      requireEA(['Location:', 'State:', 'Country:'].includes(label) && !values.has(label), 'unknown or duplicate secondary location field')
      values.set(label, value)
    }
    // Avature emits empty dataset placeholders alongside actual locations.
    if (entries.length) {
      requireEA(values.size >= 2 && values.get('Location:') && values.get('Country:'), 'incomplete secondary location dataset')
      const country = countryLabels.get(values.get('Country:'))
      requireEA(country, 'unknown secondary country')
      const city = values.get('Location:'), state = values.get('State:') || null
      validateGeography(country, state)
      secondaryLocations.push({ label: [city, state, values.get('Country:')].filter(Boolean).join(', '), country, city, state })
    }
    locationMarkup = locationMarkup.replace(d.outer(dataset), '')
  }
  const locations = locationMarkup.replace(/^\s*<strong>Locations<\/strong>\s*:/i, '').split(/<br\s*\/?\s*>/i)
    .map(part => { const doc = document(part); return doc.text(doc.root) }).filter(Boolean).map(parseLocation)
  locations.push(...secondaryLocations)
  requireEA(locations.length && locations.some(location => location.country === row.location.country), 'listing primary country absent from native detail locations')
  const apply = d.nodes(node => node.tag === 'a' && d.text(node) === 'Apply')
  requireEA(apply.length && apply.every(node => node.attrs.href === `${ORIGIN}/en_US/careers/ApplicationMethods?jobId=${row.id}`), 'native application identity changed')
  const description = articles.filter(node => d.nodes(child => d.hasClass(child, 'article__header__text__title') && d.text(child) === 'Description & Requirements', node).length)
  requireEA(description.length <= 1, 'ambiguous native description section')
  let descriptionHtml = null
  if (description.length) {
    const values = d.nodes(node => d.hasClass(node, 'article__content__view__field__value'), description[0])
    // Verified Avature template: company introduction, optional compensation,
    // employer role body, then company benefits/equal-opportunity boilerplate.
    if (values.length === 4 && activeProse(d.inner(values[2]))) descriptionHtml = values.map(node => d.inner(node)).join('\n\n')
  }
  return { row, fields, locations, descriptionHtml, applyUrl: apply[0].attrs.href }
}

const defaultFetchPage = async (url, { signal }) => {
  const response = await fetch(url, { signal, credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
  return { status: response.status, url: response.url, html: await response.text() }
}

export const runElectronicArtsNative = async ({ fetchPage = defaultFetchPage, signal, timeoutMs = 900000, maxPages = 100, maxDetails = 2000 } = {}) => {
  requireEA(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 900000 && Number.isSafeInteger(maxPages) && maxPages > 0
    && Number.isSafeInteger(maxDetails) && maxDetails > 0, 'invalid source request budget')
  signal?.throwIfAborted()
  const deadline = new AbortController(), combined = composeAbortSignals(signal, deadline.signal)
  const timer = setTimeout(() => deadline.abort(Error('EA source timed out')), timeoutMs)
  let onAbort
  const aborted = new Promise((_, reject) => { onAbort = () => reject(combined.reason); combined.addEventListener('abort', onAbort, { once: true }) })
  try {
    const collect = async () => {
      const get = async url => { combined.throwIfAborted(); const response = await fetchPage(url, { signal: combined }); combined.throwIfAborted(); return response }
      const rows = [], ids = new Set()
      let offset = 0, total, pagesFetched = 0, next = urlFor(0)
      while (next) {
        requireEA(pagesFetched < maxPages, 'page budget leaves incomplete native inventory')
        const parsed = listingPage(await get(next), next, offset)
        requireEA(total == null || total === parsed.total, 'native total changed during listing enumeration')
        total = parsed.total
        for (const row of parsed.rows) { requireEA(!ids.has(row.id), 'duplicate native listing identity'); ids.add(row.id); rows.push(row) }
        pagesFetched++; offset += PAGE_SIZE; next = parsed.nextUrl
      }
      requireEA(rows.length === total && rows.length <= maxDetails, 'count or detail budget leaves incomplete native inventory')
      const details = new Array(rows.length)
      // Read every public role: the listing card contains only its primary city.
      // A continuous bounded queue avoids waiting for a slow page between batches.
      // Store by listing index so completion timing cannot reorder native jobs.
      let nextDetail = 0
      const worker = async () => {
        while (nextDetail < rows.length) {
          combined.throwIfAborted()
          const index = nextDetail++, row = rows[index]
          try { details[index] = detailPage(await get(row.url), row) }
          catch (error) { deadline.abort(error); throw error }
        }
      }
      const workers = await Promise.allSettled(Array.from({ length: Math.min(8, rows.length) }, worker))
      const failed = workers.find(result => result.status === 'rejected')
      if (failed) throw failed.reason
      const jobs = details.flatMap(detail => {
        const india = detail.locations.filter(location => location.country === 'India')
        if (!india.length) return []
        return [{ source: 'electronicarts', company: 'Electronic Arts', title: detail.row.title, jobId: detail.row.id, requisitionId: detail.row.id,
          location: india.map(location => location.label).join('; '), locations: india.map(location => location.label), city: india[0].city, country: 'India',
          department: detail.fields.get('Studio/Department') || null, employmentType: detail.fields.get('Worker Type') || null, workModel: detail.fields.get('Work Model') || null,
          sourceUrl: detail.row.url, applyUrl: detail.applyUrl, link: detail.applyUrl, jobDescription: detail.descriptionHtml, sourceDescription: detail.descriptionHtml,
          postingDate: null, closingDate: null, requiredSkills: [], experienceRequired: null, minimumQualification: null, preferredQualification: null }]
      })
      const complete = jobs.every(job => job.jobDescription)
      if (!complete) for (const job of jobs) job.sourceListingComplete = false
      return attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'discovery-only', surface: SEARCH_URL, firstParty: true,
        listingComplete: complete, pagesFetched, reportedTotal: rows.length, indiaFacetCount: jobs.length, verifiedAt: new Date().toISOString(),
        reason: complete ? 'counted-native-avature-pages-and-all-primary-secondary-detail-locations-reconciled' : 'selected-native-role-body-missing-or-template-changed' })
    }
    return await Promise.race([collect(), aborted])
  } finally { clearTimeout(timer); combined.removeEventListener('abort', onAbort) }
}
