import { decodeHTML } from 'entities'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { recognizedNativeCountry } from './countryIdentity.js'

export const ENGLISH_INVENTORY_URL = 'https://careers.societegenerale.com/en/Technical/all-job-offers'
export const FRENCH_INVENTORY_URL = 'https://careers.societegenerale.com/fr/Technical/toutes-les-offres'
const ORIGIN = 'https://careers.societegenerale.com'
const text = value => decodeHTML(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
const compact = value => text(value).replace(/\s/g, '')
const attrs = value => Object.fromEntries([...String(value).matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m => [m[1], decodeHTML(m[3])]))
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const checkAbort = signal => { if (signal?.aborted) throw signal.reason }

// Race the caller, including readers that ignore AbortSignal. Late results have
// handlers but cannot resume parsing, schedule more reads, or attach evidence.
export const readWithCallerAbort = async (reader, url, signal) => {
  checkAbort(signal)
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal?.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(() => { checkAbort(signal); return reader(url, { signal }) }).then(value => {
      signal?.removeEventListener('abort', abort)
      if (signal?.aborted) reject(signal.reason)
      else resolve(value)
    }, error => {
      signal?.removeEventListener('abort', abort)
      reject(signal?.aborted ? signal.reason : error)
    })
  })
}

const pageEnvelope = (response, requestedUrl) => typeof response === 'string'
  ? { html: response, status: null, url: null, requestedUrl }
  : { html: String(response?.html ?? ''), status: response?.status, url: response?.url, requestedUrl }

const metaUrl = html => [...html.matchAll(/<meta\b[^>]*>/g)].map(m => attrs(m[0]))
  .find(item => item.property === 'og:url')?.content
const settingsOf = html => {
  const matches = [...html.matchAll(/<script\b[^>]*data-drupal-selector=["']drupal-settings-json["'][^>]*>([\s\S]*?)<\/script>/g)]
  if (matches.length !== 1) return null
  try { return JSON.parse(matches[0][1]) } catch { return null }
}

const nativeCards = (html, locale, issues) => [...html.matchAll(/<div\s+data-offer-id=["']([^"']+)["'][\s\S]*?(?=\s*<div\s+data-offer-id=|<\/main>)/g)].map(match => {
  const attributes = attrs(match[0].slice(0, match[0].indexOf('>') + 1))
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/.exec(match[0])
  const anchorAttributes = attrs(anchor?.[1])
  const labels = [...match[0].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)].map(m => text(m[1]))
  let url
  try { url = new URL(anchorAttributes.href, ORIGIN) } catch { /* Reconciliation records the missing card. */ }
  const id = attributes['data-offer-id']
  if (!/^[A-Z0-9]{5,}$/.test(id || '') || !url || url.origin !== ORIGIN || url.search || url.hash
    || !(locale === 'en' ? url.pathname.startsWith('/en/job-offers/') : url.pathname.startsWith('/offres-d-emploi/'))
    || !url.pathname.endsWith(`-${id}-${locale}`) || !text(anchor?.[2]) || labels.length !== 3 || labels.some(label => !label)) {
    issues.add(`native-${locale}-card-identity-or-fields-unresolved`)
    return null
  }
  return { id, locale, url: url.href, title: text(anchor[2]), location: labels[0], contract: labels[1], department: labels[2], attributes }
}).filter(Boolean)

const inspectPage = (page, locale) => {
  const issues = new Set()
  const expected = locale === 'en' ? ENGLISH_INVENTORY_URL : FRENCH_INVENTORY_URL
  if (page.status !== 200 || page.url !== expected) issues.add(`native-${locale}-response-metadata-unverified`)
  if (metaUrl(page.html) !== expected) issues.add(`native-${locale}-surface-ownership-unverified`)
  const settings = settingsOf(page.html)
  if (settings?.path?.currentLanguage !== locale || settings?.path?.currentPath !== 'Technical/toutes-les-offres') issues.add(`native-${locale}-unfiltered-page-unverified`)
  const reported = /<strong\b[^>]*>\s*([\d,\s]+)\s*<\/strong>\s*offre\(s\)/.exec(page.html)
  const total = reported ? Number(reported[1].replace(/[,\s]/g, '')) : null
  const cards = nativeCards(page.html, locale, issues)
  if (!Number.isSafeInteger(total) || total < 0 || cards.length !== total || new Set(cards.map(card => card.id)).size !== cards.length) issues.add(`native-${locale}-advertised-card-total-unreconciled`)
  if (/rel=["']next["']|class=["'][^"']*\bpager\b|href=["'][^"']*[?&]page=/i.test(page.html)) issues.add(`native-${locale}-pagination-unresolved`)
  return { locale, cards, settings, total, issues: [...issues], signature: canonical({ total, cards: [...cards].sort((a,b) => a.id.localeCompare(b.id)), model: settings?.quantum?.all_offers, filters: settings?.quantum?.quantum_filters }) }
}

const reconcile = pages => {
  const issues = new Set(pages.flatMap(page => page.issues))
  const first = pages[0].settings?.quantum
  const model = first?.all_offers
  const filters = first?.quantum_filters
  const object = value => value && typeof value === 'object' && !Array.isArray(value)
  if (!object(model) || !object(filters?.refLocation?.id) || !object(filters?.refContrat?.id)) issues.add('native-country-and-offer-model-unavailable')
  for (const page of pages.slice(1)) if (canonical(page.settings?.quantum?.all_offers) !== canonical(model)
    || canonical(page.settings?.quantum?.quantum_filters) !== canonical(filters)) issues.add('native-language-models-disagree')
  const entries = object(model) ? Object.entries(model) : []
  const known = new Map()
  let unresolvedCountryRecords = 0
  for (const [id, role] of entries) {
    const labels = filters?.refLocation?.id?.[role?.country]
    if (!/^[A-Z0-9]{5,}$/.test(id) || !object(role) || Object.keys(role).sort().join(',') !== 'city,country,region'
      || !['city','country','region'].every(key => typeof role[key] === 'string')
      || !/^[A-Z]{3}$/.test(role.country) || !text(labels?.en) || !text(labels?.fr)) {
      issues.add('native-country-or-location-model-unresolved')
      unresolvedCountryRecords += 1
      continue
    }
    if (!recognizedNativeCountry(role.country, labels.en)) {
      issues.add(`native-country-identity-unresolved:${role.country}`)
      unresolvedCountryRecords += 1
      continue
    }
    known.set(id, role)
  }
  const cards = pages.flatMap(page => page.cards)
  const byId = new Map()
  for (const card of cards) {
    const role = known.get(card.id)
    const country = filters?.refLocation?.id?.[role?.country]?.[card.locale]
    if (!role || !country || !(card.location === country || card.location.endsWith(`, ${country}`))) issues.add('native-card-country-unresolved')
    if (!byId.has(card.id)) byId.set(card.id, card) // The English inventory is first.
  }
  if (byId.size !== entries.length || entries.some(([id]) => !byId.has(id)) || [...byId.keys()].some(id => !Object.hasOwn(model || {}, id))) issues.add('native-bilingual-identities-unreconciled')
  const indiaRows = cards.filter(card => known.get(card.id)?.country === 'IND').length
  const indiaFacet = filters?.refLocation?.en?.India
  const indiaFacetFR = filters?.refLocation?.fr?.Inde
  if (indiaFacet?.id !== 'IND' || indiaFacetFR?.id !== 'IND' || indiaFacet.count !== indiaRows || indiaFacetFR.count !== indiaRows) issues.add('native-India-language-row-facet-unreconciled')
  const countries = new Set([...known.values()].map(role => role.country))
  for (const locale of ['en','fr']) for (const facet of Object.values(filters?.refLocation?.[locale] || {})) {
    if (facet?.count !== 0 && recognizedNativeCountry(facet?.id, filters?.refLocation?.id?.[facet?.id]?.en)) countries.add(facet.id)
  }
  const countryLanguageRows = Object.fromEntries([...countries].sort().map(country => [country, cards.filter(card => known.get(card.id)?.country === country).length]))
  // Display labels are not IDs: the native dictionaries contain country/city
  // label collisions (for example Morocco -> MAR_A05). Such a value cannot
  // stand in for the missing country counter, even if India alone reconciles.
  for (const locale of ['en','fr']) {
    let countryTotal = 0
    for (const country of countries) {
      const matches = Object.entries(filters?.refLocation?.[locale] || {}).filter(([,facet]) => facet?.id === country)
      const expectedLabel = filters?.refLocation?.id?.[country]?.[locale]
      if (matches.length !== 1 || matches[0][0] !== expectedLabel) {
        issues.add(`native-country-facet-ID-unresolved:${country}:${locale}`)
        continue
      }
      const count = matches[0][1].count
      if (!Number.isSafeInteger(count) || count < 0 || count !== countryLanguageRows[country]) issues.add(`native-country-facet-count-unreconciled:${country}:${locale}`)
      if (Number.isSafeInteger(count) && count >= 0) countryTotal += count
    }
    if (countryTotal !== cards.length) issues.add(`native-all-country-facet-row-total-unreconciled:${locale}`)
  }
  let contractRows = 0
  for (const [id, labels] of Object.entries(filters?.refContrat?.id || {})) {
    const en = filters?.refContrat?.en?.[labels.en]
    const fr = filters?.refContrat?.fr?.[labels.fr]
    const count = cards.filter(card => card.contract === labels[card.locale]).length
    if (en?.id !== id || fr?.id !== id || en.count !== count || fr.count !== count) issues.add('native-contract-language-row-facets-unreconciled')
    contractRows += Number.isSafeInteger(en?.count) ? en.count : 0
  }
  if (contractRows !== cards.length) issues.add('native-all-language-row-total-unreconciled')
  const india = [...byId.values()].filter(card => known.get(card.id)?.country === 'IND')
  const expectedIndia = entries.filter(([, role]) => role?.country === 'IND').length
  if (india.length !== expectedIndia) issues.add('native-India-identities-unreconciled')
  return { issues: [...issues], model, filters, india, nativeGlobalDistinct: entries.length, nativeIndiaDistinct: expectedIndia,
    nativeIndiaLanguageRows: indiaFacet?.count ?? null, nativeLanguageRows: cards.length, countryLanguageRows, unresolvedCountryRecords }
}

const isoDate = value => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(String(value)) ? String(value).slice(0,10).replaceAll('/', '-') : null
const employment = value => ({ STANDARD:'Full-time', TEMPORARY_WORK:'Contract', EXPERIENCED:'Contract', APPRENTICESHIP:'Internship', GRADUATE_JOB:'Internship', SUMMER_JOB:'Internship', INTERNSHIP:'Internship', COOPERATIVE:'Internship' })[value] || null

const ownedDetail = (page, card, inventory) => {
  if (page.status !== 200 || page.url !== card.url || metaUrl(page.html) !== card.url) throw new Error('detail-response-or-surface-ownership-unverified')
  const posts = []
  for (const match of page.html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)) {
    let data
    try { data = JSON.parse(match[1]) } catch { throw new Error('detail-native-JSON-invalid') }
    if (data?.['@type'] === 'JobPosting') posts.push(data)
  }
  if (posts.length !== 1) throw new Error('detail-native-role-model-unresolved')
  const post = posts[0]
  const crawl = /<div\b[^>]*id=["']crawl_data["'][^>]*>([\s\S]*?)<\/div>/.exec(page.html)?.[1]
  const values = Object.fromEntries([...String(crawl || '').matchAll(/<span\b[^>]*>/g)].map(m => { const a = attrs(m[0]); return [a.id, a['data-value']] }))
  const h1 = [...page.html.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/g)].filter(m => attrs(m[1]).id === 'offerTitle')
  const title = text(h1[0]?.[2])
  const role = inventory.model[card.id]
  const locations = Array.isArray(post.jobLocation) ? post.jobLocation : [post.jobLocation]
  const address = locations[0]?.address
  const expectedCountry = inventory.filters.refLocation.id.IND[card.locale]
  if (post.identifier?.value !== card.id || values.offer_ref !== card.id || values.country_id !== 'IND'
    || values.localisation_id !== role.city || !page.html.includes(`id="offer-${card.id}-${card.locale}"`)
    || post.hiringOrganization?.name !== 'Societe Generale' || post.hiringOrganization?.sameAs !== ORIGIN
    || h1.length !== 1 || title !== card.title || text(values.page_title) !== title || !text(post.title).startsWith(`${title} - `)
    || locations.length !== 1 || address?.addressCountry !== expectedCountry
    || typeof address.addressLocality !== 'string') throw new Error('detail-identity-employer-or-country-unresolved')
  const city = text(address.addressLocality) || null
  if (role.city && text(inventory.filters.refLocation.id[role.city]?.[card.locale]) !== city || !role.city && city) throw new Error('detail-native-location-unreconciled')
  const sections = [...page.html.matchAll(/<section\b[^>]*id=["'](job-detail-[^"']+)["'][^>]*>([\s\S]*?)<\/section>/g)]
  const bySection = new Map(sections.map(m => [m[1], text(m[2])]))
  if (bySection.size !== sections.length || !['job-detail-description','job-detail-profile','job-detail-group'].every(id => bySection.get(id))) throw new Error('detail-complete-sections-unresolved')
  const description = sections.map(m => text(m[2])).join(' ')
  let comparable = compact(description)
  // The publisher's JSON-LD emits an empty heading even when its corresponding
  // optional section is absent from the public role. No role content is removed.
  if (!bySection.has('job-detail-evolution') && card.locale === 'en') comparable = comparable.replace('Businessinsight', 'WhyjoinusBusinessinsight')
  if (comparable !== compact(post.description)) throw new Error('detail-full-description-model-unreconciled')
  let apply
  try { apply = new URL(values.taleo_url) } catch { throw new Error('detail-apply-identity-unresolved') }
  if (apply.protocol !== 'https:' || apply.hostname !== 'socgen.taleo.net' || !apply.pathname.startsWith('/careersection/') || apply.searchParams.get('job') !== card.id) throw new Error('detail-apply-identity-unresolved')
  const contract = inventory.filters.refContrat.id[values.contract_type_id]?.[card.locale]
  if (contract !== card.contract || text(post.employmentType) !== contract || isoDate(values.publication_date) !== isoDate(post.datePosted)) throw new Error('detail-native-fields-unreconciled')
  return { title, company:'Societe Generale', department:card.department, location:city ? `${city}, India` : 'India', city, country:'India',
    jobId:card.id, requisitionId:card.id, sourceUrl:card.url, applyUrl:apply.href, link:apply.href,
    employmentType:employment(values.contract_type_id), experienceRequired:null,
    minimumQualification:bySection.get('job-detail-profile'), preferredQualification:null, requiredSkills:[],
    postingDate:isoDate(post.datePosted), closingDate:null, jobDescription:description,
    remoteStatus:values.hybrid_working === '1' ? 'Hybrid' : null, source:'societegenerale', sourceDetailComplete:true, scrapedAt:new Date().toISOString() }
}

export const collectSocieteGenerale = async ({ fetchText, signal, maxJobs = null, maxRequests = 10000, detailConcurrency = 12,
  legacyListings, legacyDetail }) => {
  checkAbort(signal)
  const issues = new Set()
  const audit = { source:'societegenerale', requests:0, detailRequests:0, inventoryRequests:0,
    nativeGlobalDistinct:null, nativeIndiaDistinct:null, nativeIndiaLanguageRows:null, nativeLanguageRows:null, issues:[] }
  const requestLimit = Number.isSafeInteger(maxRequests) && maxRequests >= 0 ? maxRequests : 0
  const jobLimit = maxJobs == null ? null : Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? maxJobs : 0
  const read = async (url, detail = false) => {
    checkAbort(signal)
    if (audit.requests >= requestLimit) throw new Error('native-request-budget-exhausted')
    audit.requests += 1
    audit[detail ? 'detailRequests' : 'inventoryRequests'] += 1
    return pageEnvelope(await readWithCallerAbort(fetchText, url, signal), url)
  }
  const finish = (jobs, inventory, complete = false) => {
    checkAbort(signal)
    audit.issues = [...issues]
    audit.sourceScopeComplete = complete === true
    audit.lifecycleCleanupAllowed = complete === true
    for (const job of jobs) {
      job.sourceListingComplete = complete === true
      job.sourceScopeComplete = complete === true
      job.lifecycleCleanupAllowed = complete === true
    }
    Object.defineProperty(jobs, 'sourceAudit', { value:audit })
    const empty = complete && jobs.length === 0
    return attachInventoryEvidence(jobs, { status: complete ? empty ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
      surface:ENGLISH_INVENTORY_URL, firstParty:Boolean(inventory?.firstParty), listingComplete:complete,
      pagesFetched:audit.inventoryRequests, reportedTotal:inventory?.nativeIndiaDistinct ?? null,
      indiaFacetCount:inventory?.nativeIndiaLanguageRows ?? null, verifiedAt:new Date().toISOString(),
      reason: complete ? `official-bilingual-native-inventory;global-distinct=${audit.nativeGlobalDistinct};India-distinct=${audit.nativeIndiaDistinct};India-language-rows=${audit.nativeIndiaLanguageRows};all-India-role-owned-details;stable-full-closing-criteria`
        : [...issues].join(';') || 'native-inventory-unverified' })
  }
  if (jobLimit === 0 || requestLimit === 0) {
    issues.add(jobLimit === 0 ? 'caller-zero-job-limit' : 'native-request-budget-exhausted')
    return finish([], null)
  }
  const first = await read(ENGLISH_INVENTORY_URL)
  const native = settingsOf(first.html)?.quantum?.all_offers
  const hydrate = async (selected, iteratee) => {
    const results = new Array(selected.length)
    let cursor = 0
    const worker = async () => {
      while (cursor < selected.length) {
        checkAbort(signal)
        const index = cursor++
        try { results[index] = await iteratee(selected[index]) } catch (error) {
          checkAbort(signal)
          issues.add(String(error?.message || 'detail-read-failed'))
        }
      }
    }
    const concurrency = Number.isSafeInteger(detailConcurrency) && detailConcurrency > 0 ? detailConcurrency : 1
    await Promise.all(Array.from({ length:Math.min(concurrency, selected.length) }, worker))
    checkAbort(signal)
    return results.filter(Boolean)
  }
  if (!native) {
    issues.add('native-country-and-bilingual-inventory-unavailable')
    const listings = legacyListings(first.html)
    if (jobLimit != null && jobLimit < listings.length) issues.add('caller-job-limit')
    const jobs = await hydrate(jobLimit == null ? listings : listings.slice(0,jobLimit), async listing => {
      const page = await read(listing.sourceUrl, true)
      const detail = legacyDetail(page.html, listing)
      return { ...listing, ...detail, source:'societegenerale', link:detail.applyUrl || detail.sourceUrl || listing.sourceUrl, scrapedAt:new Date().toISOString() }
    })
    return finish(jobs, null)
  }
  const opening = [inspectPage(first, 'en')]
  try { opening.push(inspectPage(await read(FRENCH_INVENTORY_URL), 'fr')) } catch (error) {
    checkAbort(signal)
    issues.add(`native-fr-inventory-read-failed:${error?.message || 'reader'}`)
    opening.push(inspectPage(pageEnvelope('', FRENCH_INVENTORY_URL), 'fr'))
  }
  const inventory = reconcile(opening)
  inventory.firstParty = opening.every(page => !page.issues.some(issue => /ownership|response|unfiltered/.test(issue)))
  Object.assign(audit, Object.fromEntries(['nativeGlobalDistinct','nativeIndiaDistinct','nativeIndiaLanguageRows','nativeLanguageRows'].map(key => [key, inventory[key]])))
  audit.countryLanguageRows = inventory.countryLanguageRows
  audit.unresolvedCountryRecords = inventory.unresolvedCountryRecords
  inventory.issues.forEach(issue => issues.add(issue))
  if (jobLimit != null && jobLimit < inventory.india.length) issues.add('caller-job-limit')
  const selected = jobLimit == null ? inventory.india : inventory.india.slice(0,jobLimit)
  const jobs = await hydrate(selected, async card => ownedDetail(await read(card.url, true), card, inventory))
  if (jobs.length !== inventory.nativeIndiaDistinct) issues.add('detail-India-inventory-not-fully-hydrated')
  const closing = []
  for (const [index, url] of [ENGLISH_INVENTORY_URL, FRENCH_INVENTORY_URL].entries()) {
    try { closing.push(inspectPage(await read(url), index === 0 ? 'en' : 'fr')) } catch (error) {
      checkAbort(signal)
      issues.add(`closing-inventory-read-failed:${error?.message || 'reader'}`)
    }
  }
  if (closing.length !== 2) issues.add('closing-bilingual-inventory-unavailable')
  else {
    reconcile(closing).issues.forEach(issue => issues.add(`closing-${issue}`))
    if (closing.some((page, index) => page.signature !== opening[index].signature)) issues.add('closing-full-native-criteria-changed')
  }
  return finish(jobs, inventory, issues.size === 0 && inventory.firstParty)
}
