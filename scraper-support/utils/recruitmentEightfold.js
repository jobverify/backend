import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { extractActiveDescription } from './activeNativeHtml.js'
import { eightfoldDocument, parseEightfoldJson, readEightfoldDataCarrier } from './recruitmentEightfoldData.js'
import { nativeCountryName, nativeLocationCountryName } from '../shared/nativeJobPosting.js'

// The current classic client explicitly reads smartApplyData.textContent and
// renders the full own-job GET through the insights/description component. This
// is distinct from the PCSXPWA config-only carrier. Unknown client bytes hold.
const rendererSHA256 = 'f154f571d5be44a56fe45dceef4ed80b1cadf0792e34b6252fbed473b1bc506d'
const accounts = Object.freeze({
  'bayer.com': { source: 'bayer', employer: 'Bayer', origin: 'https://talent.bayer.com', corporateHosts: ['bayer.in', 'bayer.com'],
    application: { origin: 'https://career012.successfactors.eu', path: '/career', company: 'C0003153479P' } },
  'fluor.com': { source: 'fluor', employer: 'Fluor', origin: 'https://careers.fluor.com', corporateHosts: ['fluor.com'] },
})
const need = (condition, message) => { if (!condition) throw new Error('Eightfold ' + message) }
const sha = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' ? value.trim() : ''
const visible = value => text(value).normalize('NFC').replace(/\s+/gu, ' ')
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const https = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && !/^localhost$|\.localhost$|\.local$|^\[|^\d+(?:\.\d+){3}$/i.test(url.hostname) ? url : null
  } catch { return null }
}
const httpTarget = value => { const url = https(value); if (url) url.hash = ''; return url?.href }
const active = ({ node, ancestors }) => !node.inert && !node.nativeTagUnqualified
  && !ancestors.some(parent => parent.inert || ['svg', 'math', 'template', 'object', 'noscript'].includes(parent.tag))
const pageIdentity = (page, url) => need(page?.status === 200 && page.url === url && typeof page.html === 'string', 'public response URL/status identity changed')
const boardIdentity = value => {
  const url = https(value)
  if (!url || url.pathname !== '/careers' || url.hash || url.searchParams.size !== 1
    || url.searchParams.getAll('domain').length !== 1) return null
  const domain = url.searchParams.get('domain'), account = accounts[domain]
  return account && url.origin === account.origin ? { domain, account, boardURL: url.href, origin: url.origin } : null
}
const rendererOf = (parsed, origin) => {
  const scripts = parsed.entries.filter(({ node }) => node.tag === 'script' && typeof node.attrs.src === 'string'
    && /smartApply\./.test(node.attrs.src))
  need(scripts.length === 1 && active(scripts[0]), 'active classic renderer is missing or ambiguous')
  const attrs = scripts[0].node.attrs, url = https(new URL(attrs.src, origin).href)
  need(url && url.origin === origin && /^\/gen\/js\/smartApply\.[a-f\d]+\.js$/.test(url.pathname)
    && !url.search && !url.hash && !Object.hasOwn(attrs, 'nomodule')
    && /^(?:|(?:text|application)\/javascript)$/i.test(attrs.type || ''), 'classic renderer mode/URL changed')
  return url.href
}
const publicModel = (page, identity, role = false) => {
  const parsed = eightfoldDocument(page.html)
  need(!parsed.entries.some(({ node }) => node.tag === 'base'), 'native document base requires review')
  const carrier = readEightfoldDataCarrier(page.html, { id: 'smartApplyData', mountId: 'EFSmartApplyContainer' })
  const model = carrier.value
  need(object(model) && model.domain === identity.domain && model.branding?.companyName === identity.account.employer,
    'native account/employer identity changed')
  need(model.isUserAuthenticated === false && model.isUserETXCandidate === false && model.isDomainETX === false
    && (!Object.hasOwn(model, 'isDomainVeteran') || model.isDomainVeteran === false)
    && model.excludePrivatePositions === true && model.isPcsEnabled === true
    && object(model.candidate) && model.candidate.enc_id === 0 && model.candidate.email === ''
    && model.candidate.isUserInPcsIjp === false && object(model.loggedInCandidate) && Object.keys(model.loggedInCandidate).length === 0
    && model.user === (role ? 'Import ' + identity.domain : ''), 'native public unauthenticated mode changed')
  need(Number.isSafeInteger(model.count) && model.count >= 0 && model.count <= 100000
    && Array.isArray(model.positions) && model.positions.length <= 100 && model.positions.length <= model.count
    && object(model.query) && model.query.query === '', 'native positions/count/query model changed')
  const entryURL = rendererOf(parsed, identity.origin)
  return { model, carrier, parsed, entryURL }
}

export const declaredEightfoldRecruitment = (page, config = {}) => {
  const identity = boardIdentity(page?.url)
  if (page?.status !== 200 || !identity || typeof page.html !== 'string') return null
  // The account names are evidence-reviewed family profiles, never guessed
  // tenant discovery. Configured publisher identity must independently agree.
  need(config.source === identity.account.source && [config.companyName, ...(config.nativeEmployerNames || []), ...(config.publisherNames || [])]
    .some(name => visible(name).toLowerCase() === identity.account.employer.toLowerCase()), 'configured account/employer identity changed')
  const current = publicModel(page, identity)
  need(current.model.query.location === '' && current.model.query.pid === '', 'native board query scope changed')
  return { kind: 'eightfold-classic', source: config.source, origin: identity.origin, domain: identity.domain,
    employerName: identity.account.employer, boardURL: identity.boardURL, entryURL: current.entryURL,
    openingModel: current.model, openingCarrierEvidence: current.carrier,
    openingPage: { url: page.url, status: page.status, html: page.html }, expectedPublisherNames: [identity.account.employer] }
}

const bindingOf = (binding, descriptor, page) => {
  const identity = boardIdentity(descriptor.boardURL), official = https(binding?.officialURL)
  need(identity && official && identity.account.corporateHosts.some(host => official.hostname === host || official.hostname.endsWith('.' + host))
    && httpTarget(binding.declaredURL) === descriptor.boardURL, 'current corporate handoff/account binding is unavailable')
  pageIdentity(page, official.href)
  const parsed = eightfoldDocument(page.html)
  need(!parsed.entries.some(({ node }) => node.tag === 'base'), 'corporate handoff base requires review')
  const labels = parsed.document.nodes(node => ['title', 'h1'].includes(node.tag)).map(node => node.raw || parsed.document.text(node))
  const employerPattern = new RegExp('(?:^|[^\\p{L}\\p{N}])' + identity.account.employer + '(?:$|[^\\p{L}\\p{N}])', 'iu')
  need(labels.some(label => employerPattern.test(label)), 'corporate publisher identity changed')
  const declarations = parsed.entries.filter(entry => active(entry) && ['a', 'iframe'].includes(entry.node.tag))
    .map(({ node }) => ({ href: node.attrs[node.tag === 'a' ? 'href' : 'src'],
      label: node.tag === 'a' ? parsed.document.text(node) : [node.attrs.title, node.attrs['aria-label'], node.attrs.name].filter(Boolean).join(' ') }))
    .flatMap(row => {
      try {
        const href = new URL(row.href, page.url).href
        return httpTarget(href) === descriptor.boardURL ? [{ href, label: row.label }] : []
      } catch { return [] }
    })
  need(declarations.length > 0 && declarations.every(row => text(row.label)), 'current active corporate handoff is missing')
  const unique = [...new Map(declarations.map(row => [stable(row), row])).values()]
  need(unique.length === 1, 'current corporate handoff is ambiguous')
  return { ...unique[0], officialURL: official.href, sourceHtmlSHA256: sha(page.html) }
}
const rowIdentity = (row, descriptor) => {
  need(object(row) && Number.isSafeInteger(row.id) && row.id > 0 && text(row.name) && row.posting_name === row.name
    && typeof row.location === 'string' && Array.isArray(row.locations) && row.locations.length > 0 && row.locations.length <= 40
    && row.locations.every(value => typeof value === 'string' && value.trim()) && row.locations.includes(row.location)
    && text(row.ats_job_id) && text(row.display_job_id) && text(row.id_locale) && row.type === 'ATS'
    && typeof row.isPrivate === 'boolean' && Number.isSafeInteger(row.t_create) && Number.isSafeInteger(row.t_update)
    && row.t_create > 0 && row.t_update >= row.t_create, 'native role identity/model changed')
  const url = https(row.canonicalPositionUrl)
  need(url && url.origin === descriptor.origin && url.pathname === '/careers/job/' + row.id && !url.search && !url.hash,
    'native role canonical identity changed')
  return url.href
}
const selectedOf = (page, descriptor) => {
  const url = descriptor.boardURL + '&location=India'
  pageIdentity(page, url)
  const identity = boardIdentity(descriptor.boardURL), current = publicModel(page, identity)
  need(current.entryURL === descriptor.entryURL && current.model.query.location === 'India' && current.model.query.pid === ''
    && stable(current.model.branding) === stable(descriptor.openingModel.branding), 'native selected account/query/renderer changed')
  const ids = new Set()
  for (const row of current.model.positions) {
    rowIdentity(row, descriptor)
    need(!ids.has(row.id), 'native selected membership contains duplicate roles'); ids.add(row.id)
  }
  return current
}
const indiaLocations = row => nativeLocationCountryName(row.location) === 'India'
  && row.locations.every(location => nativeLocationCountryName(location) === 'India')
const ldKeys = new Set(['@context', '@type', 'datePosted', 'employmentType', 'hiringOrganization', 'inLanguage', 'jobLocation', 'title', 'url', 'validThrough', 'description'])
const wallDate = value => {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value), 'native schema date/time contract changed')
  const date = new Date(value + 'Z')
  need(Number.isFinite(+date) && date.toISOString().slice(0, 19) === value, 'native schema date calendar is invalid')
  return +date
}
const schemaCountry = value => {
  if (typeof value === 'string') return nativeCountryName(value)
  need(object(value) && Object.keys(value).length === 2 && value['@type'] === 'Country'
    && Object.keys(value).every(key => ['@type', 'name'].includes(key)), 'native nested country identity/model changed')
  return nativeCountryName(value.name)
}
const publicRole = (page, row, descriptor) => {
  const sourceURL = rowIdentity(row, descriptor)
  pageIdentity(page, sourceURL)
  const current = publicModel(page, boardIdentity(descriptor.boardURL), true), model = current.model
  need(current.entryURL === descriptor.entryURL && model.pid === String(row.id) && model.query.pid === String(row.id)
    && model.singleview === true && model.isFallback === false && model.count === 1 && model.positions.length === 1
    && stable(model.positions[0]) === stable(row) && stable(model.branding) === stable(descriptor.openingModel.branding),
  'public role/listing account/identity changed')
  need(Array.isArray(model.all_applicable_locations) && model.all_applicable_locations.length > 0
    && model.all_applicable_locations.length === row.locations.length
    && model.all_applicable_locations.every(location => object(location) && Object.keys(location).every(key => ['location', 'city', 'state', 'country'].includes(key))
      && nativeCountryName(location.country) === 'India'
      && row.locations.includes(location.location)), 'public role explicit country scope changed')
  const nodes = current.parsed.document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
  need(nodes.length === 1 && !Object.hasOwn(nodes[0].attrs, 'src') && !Object.hasOwn(nodes[0].attrs, 'nomodule'),
    'public role schema identity is missing or ambiguous')
  const posting = parseEightfoldJson(nodes[0].raw)
  need(object(posting) && posting['@type'] === 'JobPosting' && [...Object.keys(posting)].every(key => ldKeys.has(key))
    && posting.title === row.name && text(posting.description), 'public role schema title/criteria contract changed')
  const employer = posting.hiringOrganization
  need(object(employer) && employer['@type'] === 'Organization' && employer.name === descriptor.employerName
    && employer.sameAs === descriptor.domain, 'public role native employer identity changed')
  const canonical = https(posting.url)
  need(canonical && canonical.origin === descriptor.origin && !canonical.hash && canonical.searchParams.size === 1
    && canonical.searchParams.get('domain') === descriptor.domain
    && new RegExp('^/careers/job/' + row.id + '(?:-[a-z0-9-]+)?$').test(canonical.pathname), 'public role schema URL identity changed')
  const locations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
  need(locations.length > 0 && locations.length <= 40 && locations.every(location => location?.['@type'] === 'Place'
    && object(location.address) && schemaCountry(location.address.addressCountry) === 'India'), 'public role schema country changed')
  const titles = current.parsed.document.nodes(node => node.tag === 'title').map(node => visible(decodeHTML(node.raw)))
  need(titles.length === 1 && titles[0] === visible(row.name + ' | ' + row.location + ' | ' + descriptor.employerName),
    'public role native page title changed')
  const modified = wallDate(posting.datePosted), generatedExpiry = wallDate(posting.validThrough)
  need(modified === row.t_update * 1000 && generatedExpiry - modified === 180 * 86400000,
    'native schema update/SEO expiry date projection changed')
  return { model, posting, carrier: current.carrier, originalHTML: page.html, originalHTMLSHA256: sha(page.html) }
}
const jobKeys = new Set(['id', 'name', 'posting_name', 'location', 'locations', 'hot', 'department', 'business_unit',
  't_update', 't_create', 'ats_job_id', 'display_job_id', 'type', 'job_description', 'id_locale', 'locale', 'stars',
  'medallionProgram', 'location_flexibility', 'work_location_option', 'canonicalPositionUrl', 'isPrivate', 'urls',
  'apply_redirect_url', 'preApplyInfoBanner', 'custom_JD', 'hideUploadResumeOption'])
const completeCriteriaAgree = (html, schemaDescription) => {
  const parsed = eightfoldDocument(html), boundaries = new Map(), allowedWhitespace = new Set(), originalWhitespace = new Set(), blockBoundaries = new Set()
  let authored = ''
  const mark = kind => {
    if (!boundaries.has(authored.length)) boundaries.set(authored.length, new Set())
    boundaries.get(authored.length).add(kind)
  }
  const walk = node => {
    if (node.inert || node.tag === 'script') return
    if (node.tag === 'li') mark('list')
    const block = ['p', 'div', 'br', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'].includes(node.tag)
    if (block) { allowedWhitespace.add(authored.length); blockBoundaries.add(authored.length) }
    if (['table', 'tr', 'td', 'th'].includes(node.tag)) mark('table')
    for (const child of node.children) {
      if (typeof child === 'string') for (const character of decodeHTML(child)) {
        if (/\s/u.test(character)) { allowedWhitespace.add(authored.length); originalWhitespace.add(authored.length) }
        else authored += character
      }
      else walk(child)
    }
    if (['table', 'tr', 'td', 'th'].includes(node.tag)) mark('table')
    if (block) { allowedWhitespace.add(authored.length); blockBoundaries.add(authored.length) }
  }
  walk(parsed.entries[0].node)
  // The reviewed publisher serializes this HTML as Markdown in schema. Match
  // every authored character (including all case, numbers and punctuation).
  // Only extra presentation tokens at their actual HTML structure boundary
  // and a Markdown escape before the very same original character may differ.
  const schema = schemaDescription
  const tableRuleAt = index => {
    const lineStart = schema.lastIndexOf('\n', index - 1) + 1, nextLine = schema.indexOf('\n', index)
    const line = schema.slice(lineStart, nextLine === -1 ? schema.length : nextLine)
    return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)
  }
  let sourceAt = 0, schemaAt = 0, whitespaceAt = -1
  while (sourceAt < authored.length || schemaAt < schema.length) {
    if (/\s/u.test(schema[schemaAt] || '')) {
      // Layout whitespace may change at original spaces or real block edges,
      // never within an authored number/word (10 must not become 1 0).
      if (sourceAt !== 0 && sourceAt !== authored.length && !allowedWhitespace.has(sourceAt)) return false
      whitespaceAt = sourceAt; schemaAt++; continue
    }
    if (sourceAt < authored.length && authored[sourceAt] === schema[schemaAt]) {
      if (originalWhitespace.has(sourceAt) && !blockBoundaries.has(sourceAt)
        && /[\p{L}\p{N}]/u.test(authored[sourceAt - 1] || '') && /[\p{L}\p{N}]/u.test(authored[sourceAt])
        && whitespaceAt !== sourceAt) return false
      sourceAt++; schemaAt++; continue
    }
    const allowed = boundaries.get(sourceAt)
    if (allowed?.has('table') && schema.startsWith('---', schemaAt) && tableRuleAt(schemaAt)) { schemaAt += 3; continue }
    if (allowed?.has('table') && schema[schemaAt] === '|') { schemaAt++; continue }
    if (allowed?.has('list') && schema[schemaAt] === '*') { schemaAt++; continue }
    if (sourceAt < authored.length && schema[schemaAt] === '\\' && schema[schemaAt + 1] === authored[sourceAt]
      && '+-.*_#|[]()'.includes(authored[sourceAt])) { schemaAt++; continue }
    return false
  }
  return authored.length > 100
}
const fullJob = (job, insights, row, descriptor, posting) => {
  rowIdentity(job, descriptor)
  need(Object.keys(job).every(key => jobKeys.has(key)) && ['id', 'name', 'posting_name', 'location', 'locations', 'department',
    'business_unit', 't_create', 't_update', 'ats_job_id', 'display_job_id', 'type', 'id_locale', 'canonicalPositionUrl', 'isPrivate']
    .every(key => stable(job[key]) === stable(row[key])), 'native full role/listing identity or criteria changed')
  need(job.isPrivate === false && row.isPrivate === false, 'native role public mode changed')
  need(indiaLocations(job) && indiaLocations(row), 'native role country scope changed')
  need(typeof job.job_description === 'string' && (extractActiveDescription(job.job_description)?.length || 0) >= 100,
    'native full description criteria are missing')
  need(completeCriteriaAgree(job.job_description, posting.description), 'native/schema full description authored criteria disagree')
  need(object(job.custom_JD) && stable(job.custom_JD) === '{"enable":false}'
    && object(job.preApplyInfoBanner) && Object.keys(job.preApplyInfoBanner).length === 0,
  'native customized description/additional criteria require review')
  const insightKeys = ['skills', 'companies', 'schools', 'degrees', 'experience_years', 'seniority', 'titles', 'num_veterans']
  need(object(insights) && Object.keys(insights).length === insightKeys.length
    && insightKeys.every(key => Object.hasOwn(insights, key)) && insights.num_veterans === 0
    && insightKeys.filter(key => key !== 'num_veterans').every(key => object(insights[key]) && Object.keys(insights[key]).length === 0),
  'native insights description/criteria override requires review')
  const application = https(job.apply_redirect_url), profile = accounts[descriptor.domain].application
  const expectedApplication = { company: profile?.company, career_job_req_id: row.ats_job_id,
    career_ns: 'job_application', source: 'Eightfold', src: 'Eightfold' }
  need(profile && application && application.origin === profile.origin && application.pathname === profile.path
    && !application.hash && application.searchParams.size === Object.keys(expectedApplication).length
    && Object.entries(expectedApplication).every(([name, value]) => application.searchParams.getAll(name).length === 1
      && application.searchParams.get(name) === value), 'native application employer/account/requisition identity changed')
  return stable({ job, insights })
}

export const readEightfoldRecruitment = async (descriptor, {
  readPage, readRenderer, readNativeJson, permit, matchingEmployer, addJob, recordRead, inventoryRead, unresolved,
  maxPages = 6, maxDetails = 8, remainingRequests, now = new Date().toISOString(), officialBinding, recheckOfficialBinding,
}) => {
  const identity = boardIdentity(descriptor?.boardURL)
  need(identity && descriptor.kind === 'eightfold-classic' && descriptor.domain === identity.domain
    && descriptor.origin === identity.origin && descriptor.employerName === identity.account.employer
    && descriptor.source === identity.account.source && matchingEmployer(descriptor.employerName), 'native descriptor employer/account changed')
  need(Number.isSafeInteger(maxPages) && maxPages > 0 && Number.isSafeInteger(maxDetails) && maxDetails > 0
    && Number.isFinite(Date.parse(now)) && typeof recheckOfficialBinding === 'function', 'native budget/binding callback changed')
  const opening = publicModel(descriptor.openingPage, identity)
  need(stable(opening.model) === stable(descriptor.openingModel) && opening.entryURL === descriptor.entryURL,
    'opening native board/renderer identity changed')
  const corporateOpening = bindingOf(officialBinding, descriptor, officialBinding?.page)
  let ownReads = 0
  const available = () => {
    const count = remainingRequests ? remainingRequests() : 16 - ownReads
    need(Number.isSafeInteger(count) && count >= 0, 'remaining native request budget is invalid')
    return count
  }
  const read = async (callback, url) => {
    need(available() > 0, 'native request budget reached before closing reserve')
    permit(url); ownReads++
    return callback(url, { cache: 'no-store' })
  }
  const checkEntry = async () => {
    const response = await read(readRenderer, descriptor.entryURL)
    pageIdentity(response, descriptor.entryURL)
    need(sha(response.html) === rendererSHA256, 'native renderer entry data/render contract changed')
    return { url: response.url, status: response.status, html: response.html, sha256: sha(response.html) }
  }
  const readJson = async url => {
    const response = await read(readNativeJson, url)
    need(response?.status === 200 && response.url === url && typeof response.text === 'string', 'native JSON response identity changed')
    return { value: parseEightfoldJson(response.text), rawText: response.text, url, sha256: sha(response.text) }
  }
  // Two opening reads plus four closing authority reads are mandatory, even
  // for a partial selection. Each positive adds six own-role/JSON reads.
  if (available() < 6) { unresolved('native-eightfold-closing-reserve-budget'); return }
  const entryOpening = await checkEntry(), selectedURL = descriptor.boardURL + '&location=India'
  const selectedPage = await read(readPage, selectedURL), selected = selectedOf(selectedPage, descriptor)
  const rows = selected.model.positions
  inventoryRead({ kind: 'eightfold-classic', surface: selectedURL, domain: descriptor.domain,
    reportedTotal: selected.model.count, observedRecordCount: rows.length, observedRecords: rows.length,
    globalNativeReportedTotal: opening.model.count, pagesFetched: 1, nativeListingTruncated: rows.length < selected.model.count,
    selectorCountryQualification: false, listingComplete: false, sourceListingComplete: false,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false })
  for (const row of rows) {
    recordRead(structuredClone(row), { domain: descriptor.domain, employerName: descriptor.employerName })
    if (!indiaLocations(row)) unresolved('native-eightfold-explicit-location-scope-unresolved')
  }
  unresolved('native-eightfold-source-scope-partial-cleanup-forbidden')
  const candidates = rows.filter(row => row.isPrivate === false && indiaLocations(row))
  const selectedCount = Math.min(candidates.length, maxDetails, Math.max(0, Math.floor((available() - 4) / 6)))
  if (selectedCount < candidates.length) unresolved('native-eightfold-detail-budget-closing-reserve')
  const staged = []
  for (const row of candidates.slice(0, selectedCount)) {
    const roleURL = rowIdentity(row, descriptor), apiURL = descriptor.origin + '/api/apply/v2/jobs/' + row.id + '?domain=' + descriptor.domain
    const insightURL = descriptor.origin + '/api/apply/v2/jobs/' + row.id + '/insights?domain=' + descriptor.domain
    const roleOpening = publicRole(await read(readPage, roleURL), row, descriptor)
    const jobOpening = await readJson(apiURL), insightsOpening = await readJson(insightURL)
    const snapshot = fullJob(jobOpening.value, insightsOpening.value, row, descriptor, roleOpening.posting)
    staged.push({ row, roleOpening, jobOpening, insightsOpening, snapshot, roleURL, apiURL, insightURL })
  }
  // All selected openings precede every closing read. Closing an early role
  // before later acquisition would leave an unseen change inside this batch.
  for (const item of staged) {
    const { row, roleOpening, roleURL, apiURL, insightURL, snapshot } = item
    const roleClosing = publicRole(await read(readPage, roleURL), row, descriptor)
    const jobClosing = await readJson(apiURL), insightsClosing = await readJson(insightURL)
    need(fullJob(jobClosing.value, insightsClosing.value, row, descriptor, roleClosing.posting) === snapshot
      && stable(roleOpening.posting) === stable(roleClosing.posting)
      && stable(roleOpening.model) === stable(roleClosing.model), 'closing native full role criteria/identity changed')
    Object.assign(item, { roleClosing, jobClosing, insightsClosing })
  }
  const selectedClosingPage = await read(readPage, selectedURL), selectedClosing = selectedOf(selectedClosingPage, descriptor)
  need(stable(selectedClosing.model.positions) === stable(rows) && selectedClosing.model.count === selected.model.count,
    'closing native selected membership/count changed')
  const boardClosingPage = await read(readPage, descriptor.boardURL)
  pageIdentity(boardClosingPage, descriptor.boardURL)
  const boardClosing = publicModel(boardClosingPage, identity)
  need(boardClosing.entryURL === descriptor.entryURL && stable(boardClosing.model.branding) === stable(opening.model.branding)
    && boardClosing.model.query.location === '' && boardClosing.model.query.pid === '', 'closing native board account changed')
  const entryClosing = await checkEntry()
  need(available() > 0, 'closing corporate handoff request reserve exhausted')
  permit(officialBinding.officialURL); ownReads++
  const corporateClosingPage = await recheckOfficialBinding(officialBinding)
  const corporateClosing = bindingOf(officialBinding, descriptor, corporateClosingPage)
  need(corporateClosing.href === corporateOpening.href && corporateClosing.label === corporateOpening.label,
    'closing corporate handoff declaration changed')
  for (const item of staged) {
    const { row, jobOpening, insightsOpening, jobClosing, insightsClosing, roleOpening, roleClosing } = item
    const job = jobOpening.value
    addJob({ id: String(row.id), title: job.name, url: row.canonicalPositionUrl, applyURL: job.apply_redirect_url,
      employer: { ...roleOpening.posting.hiringOrganization },
      employerBinding: { method: 'current-corporate-handoff-classic-account-own-role-and-exact-renderer',
        officialURL: corporateOpening.officialURL, declaredURL: corporateOpening.href, nativeDomain: descriptor.domain,
        legalEmployer: null },
      country: 'India', location: job.location, employmentType: roleOpening.posting.employmentType,
      description: job.job_description, posted: null, closing: null, remoteStatus: null, legalEmployer: null,
      sourcePublicationDateUnavailable: true, sourceRemoteStatusUnresolved: true,
      record: { originalNativeRole: structuredClone(job), originalNativeInsights: structuredClone(insightsOpening.value),
        originalListingRecord: structuredClone(row), originalPublicJobPosting: structuredClone(roleOpening.posting),
        nativeATSRequisitionID: row.ats_job_id, nativeCreatedTimestamp: job.t_create, nativeUpdatedTimestamp: job.t_update,
        nativeSchemaDatePosted: roleOpening.posting.datePosted, nativeSchemaValidThrough: roleOpening.posting.validThrough,
        nativePublicationDateSemantics: 'schema-projects-native-update-without-timezone-original-publication-unknown',
        nativeClosingDateSemantics: 'generated-180-day-SEO-expiry-real-application-deadline-unknown',
        originalNativeWorkLocationOption: job.work_location_option, originalListingWorkLocationOption: row.work_location_option,
        nativeHiringOrganization: structuredClone(roleOpening.posting.hiringOrganization), legalEmployer: null,
        nativeCriteriaAuthority: { clientURL: descriptor.entryURL, clientSHA256: rendererSHA256,
          field: 'own-job.job_description', insightsDescriptionOverride: false, customJDEnabled: false,
          schemaFullAuthoredCriteriaReconciled: true,
          schemaSerializationReconciliation: 'every-authored-character-with-only-reviewed-structural-Markdown-tokens' },
        sourceDetailComplete: true, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
        nativeEvidence: { observedAt: now, corporateOpeningPage: structuredClone(officialBinding.page),
          corporateClosingPage, corporateOpening, corporateClosing,
          boardOpeningPage: structuredClone(descriptor.openingPage), boardClosingPage,
          selectedOpeningPage: selectedPage, selectedClosingPage,
          publicRoleOpening: roleOpening, publicRoleClosing: roleClosing,
          ownJobOpening: jobOpening, ownJobClosing: jobClosing, insightsOpening, insightsClosing,
          rendererOpening: entryOpening, rendererClosing: entryClosing },
        nativeClosingContext: { eachFullRoleAndAPIRechecked: true, currentPublisherHandoffRechecked: true,
          allSelectedRoleAcquisitionsPrecedeAllClosingRoleReads: true,
          nativeEntryRechecked: true, selectedMembershipRechecked: true, globalSourceScopeComplete: false,
          fullNativeRecordSHA256: sha(snapshotOf(item)), rawRoleHTMLEqual: roleOpening.originalHTML === roleClosing.originalHTML } } })
  }
}

const snapshotOf = item => stable({ job: item.jobOpening.value, insights: item.insightsOpening.value })
