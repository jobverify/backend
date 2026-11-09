import { activeScripts, decodeNativeEntities, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS_URL = 'https://www.aavas.in/career'
export const LIST_URL = 'https://www.aavas.in/join-our-team'
const ORIGIN = 'https://www.aavas.in'
const WORKPLACE_STATES = new Set(['Maharashtra', 'Himachal Pradesh', 'Haryana'])
const NATIVE_SELECTOR_STATES = new Map([['10', 'Punjab'], ['15', 'Chandigarh']])
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const norm = value => clean(value).normalize('NFC').toLowerCase()
const prove = (ok, reason) => {
  if (!ok) throw Object.assign(new Error('Aavas native careers: ' + reason), {
    code: 'AAVAS_NATIVE_CONTRACT_UNAVAILABLE', softFailure: true,
    failureKind: 'parser_or_contract_error', abortRetries: true,
  })
}
const walk = (node, includeConditionalSelect = false) => node.inert && !(includeConditionalSelect && node.tag === 'select') ? []
  : [node, ...node.children.filter(child => typeof child !== 'string').flatMap(child => walk(child, includeConditionalSelect))]
const children = node => node.children.filter(child => typeof child !== 'string')
const one = (values, label) => { prove(values.length === 1, 'expected one ' + label); return values[0] }
const isClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const decodeId = value => {
  prove(typeof value === 'string' && /^[A-Za-z\d]+={0,2}$/.test(value), 'invalid native encoded identity')
  const id = Buffer.from(value, 'base64').toString('utf8')
  prove(/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) && Buffer.from(id).toString('base64') === value, 'noncanonical native encoded identity')
  return id
}
const options = select => children(select).filter(node => node.tag === 'option').map(node => {
  prove(node.children.every(child => typeof child === 'string'), 'unexpected native option markup')
  return { id: node.attrs.value, label: clean(decodeNativeEntities(node.children.join(''))) }
})
const sourceUrl = (encodedJobId, cities) => `${ORIGIN}/job-description/${encodedJobId}/${cities.map(city => city.id).join(',')}`

const selectorLocations = (stateSelect, citySelect, index, states) => {
  const stateOptions = options(stateSelect)
  prove(stateOptions.length > 0 && stateOptions.every(option => NATIVE_SELECTOR_STATES.get(option.id) === option.label)
    && new Set(stateOptions.map(option => option.id)).size === stateOptions.length, 'unreviewed native state selector identity')
  states.push(...stateOptions.map(option => option.label))
  const match = stateSelect.attrs.onchange?.match(/^handleChangeStateJoinTeam\(this\.selectedOptions,\s*(\d+),\s*(\[[\s\S]*\])\)$/)
  prove(match && Number(match[1]) === index && citySelect.attrs.id === 'multiSelectCityJoinTeam' + index, 'native state/branch controller association changed')
  let records
  try { records = JSON.parse(match[2]) } catch { prove(false, 'invalid native branch metadata') }
  prove(Array.isArray(records) && records.length > 0, 'missing native branch inventory')
  const selectedStates = new Map(stateOptions.map(option => [option.id, option.label]))
  const selected = records.filter(record => selectedStates.has(String(record?.branch_state)))
  prove(selected.length > 0, 'native selected branch inventory is empty')
  const proofs = new Map(), ids = new Set()
  const locations = selected.map(record => {
    const id = decodeId(record.id), stateId = String(record.branch_state), state = selectedStates.get(stateId)
    prove(!ids.has(id) && record.status === true && clean(record.branch_city) && clean(record.branch_name)
      && norm(record.state_name) === norm(state), 'native branch identity/state association changed')
    ids.add(id)
    if (record.branch_schema != null) {
      prove(typeof record.branch_schema === 'string', 'invalid native branch schema shape')
      let schema
      try { schema = JSON.parse(one(activeScripts(record.branch_schema), 'active native branch schema')) } catch { prove(false, 'invalid native branch schema') }
      const address = schema?.address
      prove(schema?.['@type'] === 'FinancialService' && /^Aavas Financiers Limited - /i.test(schema.name || '')
        && typeof schema['@id'] === 'string' && schema['@id'].startsWith(ORIGIN + '/home-loans/')
        && address?.['@type'] === 'PostalAddress' && typeof address.addressCountry === 'string'
        && /^(?:IN|India)$/.test(address.addressCountry)
        && norm(address.addressLocality) === norm(record.branch_city)
        && norm(address.addressRegion) === norm(state), 'native branch country/city/state schema conflict')
      proofs.set(stateId, { nativeStateId: stateId, state, country: address.addressCountry, nativeBranchId: record.id })
    }
    return { id: record.id, label: clean(record.branch_name), state, nativeStateId: stateId }
  })
  prove(stateOptions.every(option => proofs.has(option.id)), 'native state lacks exact matching India branch country proof')
  return { locations, proof: { method: 'native-state-selector-branch-country-schema', states: [...proofs.values()] } }
}

const readListing = html => {
  const document = readNativeDocument(html)
  prove(document.nodes(node => node.tag === 'h1' && /Current Openings With Aavas/i.test(document.text(node))).length === 1,
    'current first-party inventory heading changed')
  const table = one(document.nodes(node => node.tag === 'table').filter(node => walk(node).some(child => child.tag === 'tr' && isClass(child, 'tableRepeatForJobs'))), 'native recruitment table')
  const headers = walk(table).filter(node => node.tag === 'th').map(node => document.text(node))
  prove(headers.length === 5 && headers[1] === 'Job Title' && headers[2] === "Opening Location's" && headers[3] === 'Branches', 'native workplace-state column contract changed')
  const rows = walk(table).filter(node => node.tag === 'tr' && isClass(node, 'tableRepeatForJobs'))
  prove(rows.length > 0 && rows.length <= 50, 'native profile inventory is empty or exceeds the reviewed bound')
  const ids = new Set()
  return rows.map((row, index) => {
    const cells = children(row).filter(node => node.tag === 'td')
    prove(cells.length === 5 && document.text(cells[0]) === String(index + 1), 'native role row/sequence identity changed')
    const title = document.text(one(walk(cells[1]).filter(node => node.tag === 'h6'), 'native profile title'))
    const apply = one(walk(cells[4]).filter(node => node.tag === 'a' && node.attrs.id === 'country' + index), 'native profile application control')
    const citySelects = walk(cells[3], true).filter(node => node.tag === 'select' && node.attrs.name === 'locationCity[]')
    const stateSelects = walk(cells[2]).filter(node => node.tag === 'select' && node.attrs.name === 'locationState[]')
    const readonlyState = walk(cells[2]).filter(node => node.tag === 'input' && node.attrs.name === 'group_id'
      && node.attrs.type === 'text' && Object.hasOwn(node.attrs, 'readonly'))
    const states = [], cities = []
    let encodedJobId, proof
    if (citySelects.length) {
      const select = one(citySelects, 'native city controller')
      const change = select.attrs.onchange?.match(/^handleChangeCityJoinTeam\(this\.selectedOptions,\s*(\d+),\s*'([A-Za-z\d=]+)'\)$/)
      prove(change && Number(change[1]) === index && apply.attrs.href === '#', 'native city/job controller association changed')
      encodedJobId = change[2]
      if (stateSelects.length) {
        prove(readonlyState.length === 0, 'ambiguous native workplace-state metadata')
        const result = selectorLocations(one(stateSelects, 'native state controller'), select, index, states)
        cities.push(...result.locations); proof = result.proof
      } else {
        const state = clean(one(readonlyState, 'role workplace-state column').attrs.value)
        prove(WORKPLACE_STATES.has(state) && select.attrs.id === 'multiSelectCityJoinTeamSingle', 'unsupported native workplace state')
        states.push(state)
        cities.push(...options(select).map(option => ({ ...option, state })))
        proof = { method: 'native-readonly-role-workplace-state-column', state }
      }
    } else {
      prove(stateSelects.length === 0, 'missing native branch controller')
      const state = clean(one(readonlyState, 'role workplace-state column').attrs.value)
      prove(WORKPLACE_STATES.has(state), 'unsupported native workplace state')
      const city = clean(one(walk(cells[3]).filter(node => node.tag === 'input' && node.attrs.name === 'group_id'
        && node.attrs.type === 'text' && Object.hasOwn(node.attrs, 'readonly')), 'role workplace branch').attrs.value)
      const url = new URL(apply.attrs.href, LIST_URL)
      const path = url.pathname.match(/^\/job-description\/([A-Za-z\d=]+)\/([A-Za-z\d=]+)$/)
      prove(url.origin === ORIGIN && !url.search && !url.hash && path, 'unverified direct native profile application URL')
      encodedJobId = path[1]; states.push(state); cities.push({ id: path[2], label: city, state })
      proof = { method: 'native-readonly-role-workplace-state-column', state }
    }
    const id = decodeId(encodedJobId)
    prove(!ids.has(id) && title && cities.length > 0 && new Set(cities.map(city => city.id)).size === cities.length, 'repeated or incomplete native profile identity')
    ids.add(id)
    for (const city of cities) {
      decodeId(city.id)
      prove(clean(city.label) && !/\b(?:United States|United Kingdom|Canada|Ontario|Singapore|Australia)\b/i.test(city.label), 'native branch country contradicts workplace-state proof')
    }
    return { id, encodedJobId, title, cities, states, proof, url: sourceUrl(encodedJobId, cities) }
  })
}
const listingSignature = profiles => JSON.stringify(profiles.map(profile => ({ id: profile.id, title: profile.title,
  states: profile.states, cities: profile.cities, proof: profile.proof,
})).sort((a, b) => Number(a.id) - Number(b.id)))

const readRole = (html, profile, checkedAt) => {
  const document = readNativeDocument(html)
  const canonical = one(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'native profile canonical URL')
  prove(canonical.attrs.href === profile.url, 'native profile canonical identity conflict')
  prove(document.nodes(node => node.tag === 'meta' && node.attrs.name === 'author'
    && /^Aavas Financiers (?:Ltd|Limited)$/.test(node.attrs.content || '')).length > 0, 'native employer identity changed')
  const title = document.text(one(document.nodes(node => node.tag === 'h1' && isClass(node, 'card-title')), 'native role title'))
  prove(title === profile.title, 'native role title conflict')
  const field = label => document.text(one(document.nodes(node => node.tag === 'p' && isClass(node, 'card-subtitle')
    && document.text(node).startsWith(label + ':')), 'native ' + label)).slice(label.length + 1).trim()
  const locations = field('Location').split(',').map(clean)
  prove(locations.length === profile.cities.length && [...locations].map(norm).sort().join('|') === profile.cities.map(city => norm(city.label)).sort().join('|'), 'native role city inventory conflict')
  prove(document.nodes(node => node.tag === 'h6' && document.text(node) === 'Description').length === 1
    && document.nodes(node => node.tag === 'h6' && document.text(node) === 'Desired Skills').length === 1
    && document.nodes(node => ['a', 'button'].includes(node.tag) && node.attrs.id === 'open_job_apply_form').length === 1, 'native full description/application contract changed')
  const descriptionHeaders = [...html.matchAll(/<h6\b[^>]*>Description<\/h6>/g)]
  const skillHeaders = [...html.matchAll(/<h6\b[^>]*>Desired Skills<\/h6>/g)]
  const applyHeaders = [...html.matchAll(/<(?:a|button)\b(?=[^>]*\bid="open_job_apply_form")[^>]*>/g)]
  prove(descriptionHeaders.length === 1 && skillHeaders.length === 1 && applyHeaders.length === 1, 'ambiguous raw description boundaries')
  const start = descriptionHeaders[0].index + descriptionHeaders[0][0].length
  const skills = skillHeaders[0].index, end = applyHeaders[0].index
  prove(start < skills && skills < end && extractActiveDescription(html.slice(start, skills)), 'missing active full native responsibilities')
  const sourceDescription = html.slice(start, end).trim(), jobDescription = extractActiveDescription(sourceDescription)
  prove(jobDescription, 'missing active native role content')
  const experienceRequired = field('Experience'), range = experienceRequired.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s+Years?$/i)
  prove(range && Number(range[1]) <= Number(range[2]), 'native experience range changed')
  const labels = profile.cities.map(city => `${city.label}, ${city.state}, India`)
  return { source: 'aavasfinanciers', company: 'Aavas Financiers', jobId: profile.id, title,
    sourceUrl: profile.url, applyUrl: profile.url, link: profile.url, country: 'India', locations: labels,
    location: labels.join(' / '), city: profile.cities.length === 1 ? profile.cities[0].label : null,
    state: profile.states.length === 1 ? profile.states[0] : null, nativeWorkplaceStates: profile.states,
    nativeLocationProof: { ...profile.proof, nativeJobId: profile.encodedJobId, nativeCityIds: profile.cities.map(city => city.id) },
    jobDescription, sourceDescription, sourceDetailComplete: true, experienceRequired,
    minExperience: Number(range[1]), maxExperience: Number(range[2]), experienceUnits: 'years',
    qualification: field('Minimum Qualification'), department: field('Department'),
    postingDate: null, closingDate: null, sourceScopeComplete: false, sourceListingComplete: false,
    lifecycleCleanupAllowed: false, scrapedAt: checkedAt }
}

const defaultPage = async (url, { signal, stage } = {}) => {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
  if (response.status !== 200 || response.url !== url) {
    await response.body?.cancel()
    return { status: response.status, finalUrl: response.url, html: '', stage }
  }
  const html = await response.text()
  prove(Buffer.byteLength(html) <= 3 * 1024 * 1024, 'native response exceeds reviewed size bound')
  return { status: response.status, finalUrl: response.url, html, stage }
}

export async function runNative({ fetchPage = defaultPage, signal, now = () => new Date().toISOString(), maxJobs = null } = {}) {
  signal?.throwIfAborted()
  prove(maxJobs === null, 'caller cap cannot establish a native profile inventory')
  const page = async (url, stage) => {
    signal?.throwIfAborted()
    const response = await fetchPage(url, { signal, stage })
    signal?.throwIfAborted()
    if (response.status !== 200) throw Object.assign(new Error('Aavas official/native HTTP ' + response.status), {
      stage, requestedUrl: url, finalUrl: response.finalUrl || response.url, status: response.status, httpStatus: response.status,
      softFailure: true, abortRetries: true, failureKind: [202, 401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'upstream_inventory_unavailable',
    })
    prove((response.finalUrl || response.url) === url && typeof response.html === 'string', 'unverified response final URL/body')
    return response.html
  }
  const official = readNativeDocument(await page(CAREERS_URL, 'official-careers'))
  prove(official.nodes(node => node.tag === 'a' && node.attrs.href === LIST_URL && /View Open Positions/i.test(official.text(node))).length > 0, 'current official career delegation changed')
  const firstHtml = await page(LIST_URL, 'native-list'), first = readListing(firstHtml), document = readNativeDocument(firstHtml)
  const clients = document.nodes(node => node.tag === 'script' && node.attrs.src).map(node => new URL(node.attrs.src, LIST_URL))
    .filter(url => url.origin === ORIGIN && url.pathname === '/js/multiselect-dropdown.min.js')
  const client = one(clients, 'current native selector client')
  prove([...client.searchParams].length === 1 && /^\d+$/.test(client.searchParams.get('v') || ''), 'unreviewed native selector client identity')
  const script = await page(client.href, 'native-selector-client')
  prove(script.includes('function handleChangeCityJoinTeam(') && script.includes('`/job-description/${l}/${i}`')
    && script.includes('function getCityListJoinPage(') && script.includes('e.id') && script.includes('branch_state'), 'native selector route/branch contract changed')
  const checkedAt = new Date(now()).toISOString(), jobs = []
  for (const profile of first) jobs.push(readRole(await page(profile.url, 'native-role'), profile, checkedAt))
  const last = readListing(await page(LIST_URL, 'native-list-recheck'))
  prove(listingSignature(first) === listingSignature(last), 'final native profile inventory changed')
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', firstParty: true, surface: LIST_URL,
    listingComplete: false, pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
    reason: 'current-first-party-role-control-and-workplace-state-country-proof-rechecked;independent-whole-company-native-total-unavailable' })
}
