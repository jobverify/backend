import { createHash } from 'node:crypto'
import { readNativeDocument, activeIframeSources, extractActiveDescription } from './activeNativeHtml.js'
import { attachInventoryEvidence } from './inventoryEvidence.js'
import { inspectZohoNativeEmbed } from './zohoNativeEmbed.js'

const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const host = value => new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, '')
const companyWebsite = (value, domain) => {
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.port
      && url.pathname === '/' && !url.search && !url.hash && host(url.href) === domain
  } catch { return false }
}
const fail = reason => { throw new Error(`Zoho native inventory: ${reason}`) }
const countryNames = new Map(), regions = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regions.of(code)
  if (name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    countryNames.set(code.toLowerCase(), code); countryNames.set(name.toLowerCase(), code)
  }
}
const indiaCityStates = { Mumbai: 'Maharashtra', Chennai: 'Tamil Nadu', Hyderabad: 'Telangana', Bangalore: 'Karnataka', Bengaluru: 'Karnataka', Delhi: 'Delhi' }
const recruitingHost = /(?:^|\.)(?:zohorecruit\.(?:com|in)|workable\.com|greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|freshteam\.com|zappyhire\.com|darwinbox\.(?:com|in)|successfactors\.(?:com|eu)|taleo\.net|jobs2web\.com|teamtailor\.com|personio\.(?:com|de)|bamboohr\.com|applytojob\.com|breezy\.hr|recruitee\.com|jobvite\.com)$/i
const isoDate = (value, format) => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') fail('malformed native date')
  let parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  let year, month, day
  if (parts) [, year, month, day] = parts.map(Number)
  else {
    parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    if (!parts || !['MM/dd/yyyy', 'dd/MM/yyyy'].includes(format)) fail('unsupported native date format')
    year = Number(parts[3]); month = Number(parts[format === 'MM/dd/yyyy' ? 1 : 2]); day = Number(parts[format === 'MM/dd/yyyy' ? 2 : 1])
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail('impossible native date')
  return date.toISOString().slice(0, 10)
}
const nativeBoolean = value => value === true || value === 'Yes' ? true : value === false || value === 'No' ? false : null
const defaultPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { redirect: 'follow',
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]),
    headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
  const html = await response.text()
  if (Buffer.byteLength(html) > 4000000) fail('employer page exceeds response budget')
  return { status: response.status, url: response.url, html }
}
const defaultJson = async (url, { signal } = {}) => {
  const response = await fetch(url, { redirect: 'follow',
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]),
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
  if (response.status !== 200 || response.url !== url) fail('native HTTP status or redirect identity changed')
  const body = await response.text()
  if (Buffer.byteLength(body) > 4000000) fail('native JSON exceeds response budget')
  return JSON.parse(body)
}
const readHidden = (document, id) => {
  const nodes = document.nodes(node => node.tag === 'input' && node.attrs.type === 'hidden' && node.attrs.id === id)
  if (nodes.length !== 1) fail(`missing or ambiguous native ${id} carrier`)
  try { return JSON.parse(nodes[0].attrs.value) } catch { fail(`invalid native ${id} JSON`) }
}
const envelope = payload => {
  if (payload?.code !== 'success' || !Array.isArray(payload.data) || payload.error
    || (Array.isArray(payload.errors) ? payload.errors.length : payload.errors)) fail('native API success envelope changed')
  return payload.data
}
const inspectContinuation = payload => {
  for (const scope of [payload, payload?.info]) if (scope) for (const field of
    ['more_records', 'moreRecords', 'hasMore', 'has_more', 'next', 'next_page', 'nextPage', 'nextCursor', 'next_cursor', 'cursor', 'continuationToken', 'pagination']) {
    if (scope[field] != null && scope[field] !== false && scope[field] !== '') fail('native continuation requires complete enumeration')
  }
  for (const scope of [payload, payload?.info]) if (scope) for (const field of ['total', 'total_count', 'total_records']) {
    if (scope[field] != null && (!Number.isSafeInteger(scope[field]) || scope[field] !== payload.data?.length)) fail('native total contradicts the complete record array')
  }
}
const validateRows = rows => {
  if (!Array.isArray(rows)) fail('malformed native record array')
  const byId = new Map()
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !/^\d{8,30}$/.test(row.id) || !clean(row.Posting_Title)
      || typeof row.Publish !== 'boolean' || typeof row.Is_Locked !== 'boolean') fail('malformed native role identity or active state')
    if (byId.has(row.id)) fail('duplicate native role identity')
    for (const field of ['Country', 'City', 'State']) if (row[field] != null && typeof row[field] !== 'string') fail('malformed native geography field')
    if (row.Remote_Job != null && nativeBoolean(row.Remote_Job) === null) fail('malformed native remote status')
    byId.set(row.id, row)
  }
  return byId
}
const checkPair = (row, other, format, allowDetailOnlyState = false) => {
  for (const field of ['id', 'Posting_Title', 'City', 'State', 'Country']) {
    // A reviewed public listing can omit this optional subdivision while its
    // full native detail supplies it. A present value (including blank/null)
    // remains an assertion; country, city and role identity still must agree.
    const detailAddsState = field === 'State' && allowDetailOnlyState === true
      && !Object.hasOwn(row, 'State') && typeof other.State === 'string' && clean(other.State)
      && countryNames.get(clean(row.Country).toLowerCase()) === 'IN'
    if (!detailAddsState && clean(row[field]) !== clean(other[field])) fail(`native listing/detail ${field} changed`)
  }
  if (row.Publish !== other.Publish || row.Is_Locked !== other.Is_Locked
    || (row.Remote_Job != null && other.Remote_Job != null && nativeBoolean(row.Remote_Job) !== nativeBoolean(other.Remote_Job))) fail('native listing/detail state changed')
  if (isoDate(row.Date_Opened, format) !== isoDate(other.Date_Opened, format)) fail('native listing/detail public date changed')
}
const checkedRoleUrl = (value, row, config, apply = false) => {
  try {
    const url = new URL(value), board = new URL(config.boardUrl)
    if (url.origin !== board.origin || url.username || url.password || url.port || url.hash
      || !url.pathname.startsWith(`${board.pathname}/${row.id}/`)
      || url.pathname.slice(`${board.pathname}/${row.id}/`.length).includes('/')
      || !url.pathname.slice(`${board.pathname}/${row.id}/`.length)
      || url.searchParams.getAll('source').length !== 1 || url.searchParams.get('source') !== 'CareerSite'
      || [...url.searchParams.keys()].some(key => !['source', ...(apply ? ['$apply'] : [])].includes(key))
      || (apply && (url.searchParams.getAll('$apply').length !== 1 || url.searchParams.get('$apply') !== 'true'))) fail('foreign native role/application URL')
    return value
  } catch { fail('invalid native role/application URL identity') }
}
const indiaScope = (record, config) => {
  const country = clean(record.Country), city = clean(record.City), state = clean(record.State)
  const pair = config.allowIndiaCityState === true && indiaCityStates[city] === state
  const code = country ? countryNames.get(country.toLowerCase()) || (country === 'IND' ? 'IN' : null) : null
  if (country && code && code !== 'IN' && pair) fail('contradictory native country and India city/state')
  if (code === 'IN' || (!country && pair)) return { india: true, unknown: false, city, state }
  const additional = typeof record.Job_Location === 'string' ? [record.Job_Location] : record.Job_Location || []
  if (!Array.isArray(additional) || additional.some(value => typeof value !== 'string')) fail('malformed native additional locations')
  if (code && code !== 'IN') return { india: false, unknown: additional.some(value => clean(value) !== city) }
  return { india: false, unknown: true }
}

// Current Zoho portals embed the full public array; their native listing API is
// unfiltered. Reconcile both carriers and a closing snapshot before completion.
export const createZohoNativeInventoryScraper = (config, defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, controller = new AbortController()
    const signal = settings.signal ? AbortSignal.any([settings.signal, controller.signal]) : controller.signal
    const fetchPage = settings.fetchPage || defaultPage, fetchJson = settings.fetchJson || defaultJson
    const now = settings.now || (() => new Date().toISOString()), maxJobs = settings.maxJobs ?? 0
    const concurrency = settings.detailConcurrency ?? 2
    if (!Number.isSafeInteger(maxJobs) || maxJobs < 0 || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) fail('invalid extraction limits')
    const reasons = new Set(), advertisedIds = new Set(), timestamp = () => new Date(now()).toISOString()
    let requests = 0
    const pageAt = async url => {
      signal?.throwIfAborted(); const page = await fetchPage(url, { signal }); signal?.throwIfAborted(); requests++
      if (page?.status !== 200 || page.url !== url || typeof page.html !== 'string' || !page.html.trim()) fail('employer page or redirect identity unavailable')
      return { ...readNativeDocument(page.html), html: page.html }
    }
    const jsonAt = async url => {
      signal?.throwIfAborted(); const payload = await fetchJson(url, { signal }); signal?.throwIfAborted(); requests++
      return payload
    }
    const boardUrl = new URL(config.boardUrl)
    const pageName = config.pageName ?? 'Careers'
    if (typeof pageName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(pageName)
      || boardUrl.pathname !== '/jobs/' + encodeURIComponent(pageName)) fail('native configured page name and board path disagree')
    const firstPartyBoard = boardUrl.protocol === 'https:' && !boardUrl.username && !boardUrl.password && !boardUrl.port
      && (host(config.boardUrl) === config.companyDomain || host(config.boardUrl).endsWith(`.${config.companyDomain}`))
    let currentOfficialBinding = false
    const inspectScope = (document, baseUrl) => {
      let bound = false
      const links = [...document.nodes(node => node.tag === 'a' && node.attrs.href).map(node => ({ href: node.attrs.href, text: document.text(node), kind: 'anchor' })),
        ...activeIframeSources(document.html).map(href => ({ href, text: '', kind: 'iframe' })),
        ...document.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
          && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')).map(node => ({ href: node.attrs.src, text: '', kind: 'script' }))]
      for (const link of links) {
        let url
        try { url = new URL(link.href, baseUrl) } catch { continue }
        if (link.kind !== 'script' && url.href === config.boardUrl) { bound = true; continue }
        const ownBoardScope = url.origin === boardUrl.origin
          && (url.pathname === boardUrl.pathname || url.pathname.startsWith(`${boardUrl.pathname}/`))
        if (ownBoardScope && link.kind === 'anchor' && url.pathname.startsWith(`${boardUrl.pathname}/`)) {
          const id = url.pathname.slice(boardUrl.pathname.length + 1).split('/')[0]
          if (/^\d{8,30}$/.test(id)) advertisedIds.add(id)
          else reasons.add('additional-native-board-path-unresolved')
        }
        if (ownBoardScope || url.href === config.officialUrl || url.href.replace(/#.*$/, '') === config.officialUrl) continue
        if (['http:', 'https:'].includes(url.protocol)
          && (recruitingHost.test(url.hostname) || /^(?:jobs|careers|recruit)\./i.test(url.hostname)
            || (link.kind !== 'script' && /\b(?:careers?|jobs?|openings?|opportunities|apply|hiring)\b/i.test(`${url.pathname} ${link.text}`)))) reasons.add('additional-employer-recruiting-scope-unresolved')
      }
      return bound
    }
    if (config.officialUrl) {
      const official = await pageAt(config.officialUrl)
      let bound = inspectScope(official, config.officialUrl)
      if (config.officialBinding === 'zoho-native-embed') {
        const embed = inspectZohoNativeEmbed(official, config.boardUrl)
        bound = embed.bound
        if (embed.additionalSites.length || embed.unknownScope) reasons.add('additional-employer-recruiting-scope-unresolved')
      }
      if (!bound) fail('active exact employer careers handoff unavailable')
      currentOfficialBinding = true
    } else if (!firstPartyBoard) fail('unverified first-party board domain')
    const organizationType = config.organizationType || 'internal'
    if (!['internal', 'staffing'].includes(organizationType)
      || (organizationType === 'staffing' && !clean(config.employerClientName))) fail('staffing employer/client contract unavailable')
    const checkMeta = meta => {
      const websiteBound = companyWebsite(meta?.org_info?.website, config.companyDomain)
        || (config.allowBlankNativeWebsite === true && meta?.org_info?.website === '' && firstPartyBoard && currentOfficialBinding)
      if (meta?.org_info?.id !== config.orgId || meta.org_info.company_name !== config.nativeCompany
        || !websiteBound || meta.org_info.type !== organizationType
        || meta.org_info.hide_company_name !== false || meta.page_id !== config.pageId
        || meta.list_url !== config.boardUrl || meta.page_name !== pageName || meta.source !== 'CareerSite'
        || meta.employee_portal !== false || !['MM/dd/yyyy', 'dd/MM/yyyy'].includes(meta.date_format)) fail('native employer/organization/page identity changed')
    }
    const apiUrl = `${boardUrl.origin}/recruit/v2/public/Job_Openings?source=CareerSite&pagename=${encodeURIComponent(pageName)}`
    const snapshot = async () => {
      const document = await pageAt(config.boardUrl), meta = readHidden(document, 'meta')
      inspectScope(document, config.boardUrl)
      checkMeta(meta)
      const embedded = validateRows(readHidden(document, 'jobs')), payload = await jsonAt(apiUrl)
      const records = envelope(payload), byId = validateRows(records)
      inspectContinuation(payload)
      if (payload.info?.page_name !== pageName || embedded.size !== byId.size) fail('native portal/API inventory incomplete')
      for (const [id, row] of byId) {
        if (!embedded.has(id)) fail('native portal/API role identities differ')
        checkPair(row, embedded.get(id), meta.date_format)
        if (row.Publish && !row.Is_Locked) checkedRoleUrl(row.$url, row, config)
      }
      return { records, byId, meta }
    }
    const initial = await snapshot(), jobs = new Array(initial.records.length)
    let next = 0
    const detailResults = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
      try {
      while (next < initial.records.length) {
        signal.throwIfAborted()
        const index = next++, row = initial.records[index]
        if (row.Publish !== true || row.Is_Locked === true) continue
        let payload
        try { payload = await jsonAt(`${boardUrl.origin}/recruit/v2/public/Job_Openings/${row.id}?source=CareerSite&pagename=${encodeURIComponent(pageName)}`) }
        catch (error) { signal?.throwIfAborted(); reasons.add(`native-detail-unavailable:${row.id}`); continue }
        const details = envelope(payload); inspectContinuation(payload)
        if (details.length !== 1) fail('native detail identity is ambiguous')
        const detail = details[0]; validateRows(details); checkPair(row, detail, initial.meta.date_format, config.allowDetailOnlyState)
        const applyUrl = checkedRoleUrl(detail.$appy_url, row, config, true)
        if (organizationType === 'staffing') {
          const client = detail.Client_Name
          if (!client || typeof client !== 'object' || typeof client.id !== 'string' || !/^\d{8,30}$/.test(client.id)
            || client.name !== config.employerClientName) { reasons.add('native-employer-client-unresolved'); continue }
        }
        if (config.employerEntity) {
          if (!clean(detail.Entity)) { reasons.add('native-employer-entity-unresolved'); continue }
          if (clean(detail.Entity) !== config.employerEntity) {
            if (!config.excludedEntities?.includes(clean(detail.Entity))) reasons.add('native-employer-entity-unresolved')
            continue
          }
        } else if (detail.Entity != null && clean(detail.Entity) !== config.nativeCompany) {
          reasons.add('native-employer-entity-unresolved'); continue
        }
        const scope = indiaScope(detail, config)
        if (scope.unknown) reasons.add('native-india-scope-unresolved')
        if (!scope.india) continue
        const description = extractActiveDescription(detail.Job_Description)
        if (!description) fail('full active native description unavailable')
        const postingDate = isoDate(detail.Date_Opened, initial.meta.date_format)
        if (!postingDate) reasons.add('native-public-date-unavailable')
        if (detail.Required_Skills != null && (!Array.isArray(detail.Required_Skills) || detail.Required_Skills.some(skill => !clean(skill?.name)))) fail('malformed native skills')
        jobs[index] = { source: config.source, company: config.company, title: detail.Posting_Title,
          jobId: row.id, requisitionId: row.id, sourceUrl: row.$url, applyUrl, link: applyUrl,
          location: [scope.city, scope.state, 'India'].filter(Boolean).join(', '), city: scope.city || null, state: scope.state || null, country: 'India',
          jobDescription: description, sourceDescription: description,
          nativeDescriptionSHA256: createHash('sha256').update(detail.Job_Description).digest('hex'),
          postingDate, nativeDateOpened: detail.Date_Opened, nativePublicationDateProvenance: 'native-public-Date_Opened-rendered-Posted-on', closingDate: null,
          department: clean(detail.Client_Name?.name) || clean(detail.Industry) || null,
          employmentType: clean(detail.Job_Type) || null, experienceRequired: clean(detail.Work_Experience) || null,
          requiredSkills: detail.Required_Skills?.map(skill => skill.name) || [], minimumQualification: null, preferredQualification: null,
          remoteStatus: nativeBoolean(detail.Remote_Job) === true ? 'Remote' : null,
          nativeEmployerEntity: detail.Entity || null, nativeJobLocations: detail.Job_Location || null,
          ...(organizationType === 'staffing' ? { nativeEmployerClient: { id: detail.Client_Name.id, name: detail.Client_Name.name } } : {}),
          companyCareerPage: config.boardUrl, companyDomain: config.companyDomain, atsPlatform: 'zohorecruit', scrapedAt: timestamp() }
      }
      } catch (error) { controller.abort(error); throw error }
    }))
    const failed = detailResults.find(result => result.status === 'rejected')
    if (failed) throw failed.reason
    const closing = await snapshot()
    if ([...advertisedIds].some(id => !closing.byId.has(id))) reasons.add('advertised-native-role-identities-not-reconciled')
    if (initial.byId.size !== closing.byId.size || [...initial.byId.keys()].some(id => !closing.byId.has(id))) reasons.add('closing-native-identities-not-reconciled')
    else for (const [id, row] of initial.byId) {
      try { checkPair(row, closing.byId.get(id), initial.meta.date_format) }
      catch { reasons.add('closing-native-record-state-not-reconciled') }
    }
    const allJobs = jobs.filter(Boolean).filter(job => {
      const current = closing.byId.get(job.jobId)
      if (!current || !current.Publish || current.Is_Locked) { reasons.add('closing-native-role-unavailable'); return false }
      try {
        checkPair(initial.byId.get(job.jobId), current, initial.meta.date_format)
        if (current.Entity != null && clean(current.Entity) !== job.nativeEmployerEntity) fail('closing native entity changed')
        if (job.nativeEmployerClient && current.Client_Name != null
          && (current.Client_Name.id !== job.nativeEmployerClient.id || current.Client_Name.name !== job.nativeEmployerClient.name)) fail('closing native client changed')
      } catch { reasons.add('closing-native-record-state-not-reconciled'); return false }
      return true
    }), selected = maxJobs > 0 ? allJobs.slice(0, maxJobs) : allJobs
    const capped = selected.length !== allJobs.length, listingComplete = reasons.size === 0 && !capped
    if (!listingComplete) for (const job of selected) Object.assign(job, { sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
    return attachInventoryEvidence(selected, { status: listingComplete ? closing.records.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      firstParty: true, listingComplete, surface: apiUrl, pagesFetched: requests, reportedTotal: closing.records.length,
      indiaFacetCount: reasons.size ? null : allJobs.length, verifiedAt: timestamp(),
      reason: listingComplete ? 'current-zoho-employer-board-api-full-records-and-closing-inventory-reconciled'
        : `zoho-native-incomplete:${[...reasons, ...(capped ? ['source-job-limit'] : [])].join(';')}` })
  },
})
