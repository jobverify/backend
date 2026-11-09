import { createWorkablePublicApiScraper } from './workablePublicApi.js'
import { extractActiveDescription, readNativeDocument as readActiveNativeDocument, activeIframeSources } from './activeNativeHtml.js'
import { readVisibleNativeDocument as readNativeDocument } from './visibleNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from './inventoryEvidence.js'

const companyHost = url => new URL(url).hostname.replace(/^www\./, '')
const cleanUrl = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null
  } catch { return null }
}
const recruitingHost = /(?:^|\.)(?:workable\.com|greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|freshteam\.com|zappyhire\.com|darwinbox\.in|zohorecruit\.(?:com|in)|bamboohr\.com|recruitee\.com|jobvite\.com|teamtailor\.com|taleo\.net)$/i
const fetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)])
  let response
  try {
    requestSignal.throwIfAborted()
    response = await fetch(url, { redirect: 'follow', signal: requestSignal,
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
    const html = await response.text()
    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
    if (html.length > 3000000) throw new Error('Workable employer page exceeds verification budget')
    return { status: response.status, url: response.url, html }
  } catch (error) {
    if (signal?.aborted || requestSignal.aborted) {
      // Keep abort disposal owned until settlement; caller reasons stay opaque.
      try { await response?.body?.cancel?.() } catch {}
      signal?.throwIfAborted()
      requestSignal.throwIfAborted()
    }
    throw error
  }
}
const fetchJson = async (url, options = {}) => {
  const callerSignal = options.signal
  callerSignal?.throwIfAborted()
  const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), AbortSignal.timeout(30000)])
  let response
  try {
    signal.throwIfAborted()
    response = await fetch(url, { ...options, signal, redirect: 'follow', headers: {
      Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      ...options.headers,
    } })
    callerSignal?.throwIfAborted()
    signal.throwIfAborted()
    if (response.status !== 200 || response.url !== url) throw Object.assign(new Error(`Workable native HTTP status or redirect identity changed: ${url}`), { status: response.status })
    const payload = await response.json()
    callerSignal?.throwIfAborted()
    signal.throwIfAborted()
    return payload
  } catch (error) {
    if (callerSignal?.aborted || signal.aborted) {
      // Keep abort disposal owned until settlement; caller reasons stay opaque.
      try { await response?.body?.cancel?.() } catch {}
      callerSignal?.throwIfAborted()
      signal.throwIfAborted()
    }
    throw error
  }
}

// Opt-in current employer proof around the shared complete cursor/detail engine.
// The legacy markdown helpers remain usable for reading archived feeds only.
const createEmployerBoundWorkableSnapshot = (config, defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = settings.signal
    const loadPage = settings.fetchPage || fetchPage, loadJson = settings.fetchJson || fetchJson
    const fail = (reason, details = {}) => { throw Object.assign(new Error(`[${config.source}] Workable employer inventory: ${reason}`), details) }
    const maxJobs = settings.maxJobs ?? 0
    if (!Number.isSafeInteger(maxJobs) || maxJobs < 0) fail('invalid output limit')
    signal?.throwIfAborted()
    const page = await loadPage(config.careersUrl, { signal })
    signal?.throwIfAborted()
    const finalUrl = cleanUrl(page?.url)
    const allowedUrls = [config.careersUrl, ...(config.canonicalCareersUrls || [])]
    if (page?.status !== 200 || !finalUrl || !allowedUrls.includes(finalUrl.href)
      || typeof page.html !== 'string' || !page.html.trim()) fail('current first-party careers page unavailable or redirected', { status: page?.status })
    const document = readNativeDocument(page.html)
    const activeDocument = readActiveNativeDocument(page.html)
    const executable = node => node.tag === 'script' && node.attrs.src
      && !Object.hasOwn(node.attrs, 'nomodule')
      && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')
    const visible = new Set([
      ...document.nodes(node => node.tag === 'a' && node.attrs.href).map(node => `anchor:${node.attrs.href}`),
      ...document.frames().filter(node => !Object.hasOwn(node.attrs, 'srcdoc') && node.attrs.src).map(node => `iframe:${node.attrs.src}`),
    ])
    // CSS may be conditional or changed after hydration. It can disqualify
    // positive employer proof, but cannot prove an additional surface absent.
    const anchors = activeDocument.nodes(node => node.tag === 'a' && node.attrs.href)
      .map(node => ({ href: node.attrs.href, label: activeDocument.text(node), kind: 'anchor' }))
    const frames = activeIframeSources(page.html).map(href => ({ href, label: '', kind: 'iframe' }))
    const scripts = activeDocument.nodes(executable)
      .map(node => ({ href: node.attrs.src, label: '', kind: 'script' }))
    const nativeRoleIds = new Set(), advertisedIds = new Set(), unsafeIndiaIds = new Set(), reasons = new Set()
    let bound = false
    for (const candidate of [...anchors, ...frames, ...scripts]) {
      let url
      try { url = new URL(candidate.href, finalUrl) } catch { continue }
      const ownBoard = candidate.kind !== 'script' && cleanUrl(url.href)?.hostname === 'apply.workable.com'
        && url.pathname.replace(/\/+$/, '') === `/${config.tenant}`
        && [...url.searchParams].every(([key, value]) => key === 'lng' && /^[a-z]{2}$/.test(value)) && !url.hash
      if (ownBoard) { if (visible.has(`${candidate.kind}:${candidate.href}`)) bound = true; continue }
      const role = candidate.kind === 'anchor' && cleanUrl(url.href)?.hostname === 'apply.workable.com'
        && url.pathname.match(new RegExp(`^/${config.tenant}/j/([A-Z0-9]{6,32})(?:/apply)?/?$`))
      if (role) { advertisedIds.add(role[1]); continue }
      if (['http:', 'https:'].includes(url.protocol) && companyHost(url.href) !== companyHost(config.careersUrl)
        && (recruitingHost.test(url.hostname) || /\b(?:careers?|jobs?|openings?|apply|hiring)\b/i.test(`${url.pathname} ${candidate.label}`))) {
        reasons.add('additional-employer-recruiting-scope-unresolved')
      }
    }
    if (!bound) fail('active full-board careers handoff unavailable')
    const account = await loadJson(`https://apply.workable.com/api/v1/accounts/${config.tenant}`, { signal })
    signal?.throwIfAborted()
    let website
    try { website = new URL(account?.url) } catch { fail('native reciprocal company website unavailable') }
    if (!account || account.error || (Array.isArray(account.errors) ? account.errors.length : account.errors)
      || account.success === false || (account.status != null && ![200, 'ok', 'success'].includes(account.status))
      || !Number.isSafeInteger(account?.id) || account.id < 1 || account.uid !== config.accountUid
      || account.subdomain !== config.tenant || account.name !== config.company
      || !['http:', 'https:'].includes(website.protocol) || website.username || website.password || website.port
      || (config.reciprocalWebsiteUrl ? website.href !== config.reciprocalWebsiteUrl : website.pathname !== '/') || website.search || website.hash
      || companyHost(website.href) !== companyHost(config.careersUrl)) fail('native account/employer/reciprocal website identity changed')
    const inspectLocations = record => {
      if (!Array.isArray(record?.locations)) return
      if (record.locations.some(location => location.hidden !== false)) reasons.add('hidden-native-location-scope-unresolved')
      if (record.locations.some(location => location.countryCode === 'IN' && location.hidden !== false)) unsafeIndiaIds.add(record.shortcode)
      if (record.location && Object.hasOwn(record.location, 'hidden') && record.location.hidden !== false) {
        reasons.add('hidden-primary-native-location-scope-unresolved')
        if (record.location.countryCode === 'IN') unsafeIndiaIds.add(record.shortcode)
      }
    }
    const now = settings.now || (() => new Date().toISOString())
    const normalizedNow = () => {
      const value = now(), date = value instanceof Date ? value : new Date(value)
      if (!Number.isFinite(date.getTime())) fail('invalid check time')
      return date.toISOString()
    }
    const jobs = await createWorkablePublicApiScraper({ ...config, boardIdentityVerified: true,
      requiredContentSections: ['description'] }).run({ ...settings, maxJobs: 0, now: normalizedNow,
      fetchJson: async (url, init) => {
        const payload = await loadJson(url, init)
        signal?.throwIfAborted()
        if (url === `https://apply.workable.com/api/v3/accounts/${config.tenant}/jobs`) {
          for (const record of payload?.results || []) { nativeRoleIds.add(record.shortcode); inspectLocations(record) }
        } else inspectLocations(payload)
        return payload
      } })
    signal?.throwIfAborted()
    if ([...advertisedIds].some(id => !nativeRoleIds.has(id))) reasons.add('official-native-role-identities-not-reconciled')
    const visibleJobs = jobs.filter(job => !unsafeIndiaIds.has(job.jobId))
    const selected = maxJobs > 0 ? visibleJobs.slice(0, maxJobs) : visibleJobs
    const outputLimited = selected.length !== visibleJobs.length
    const evidence = readInventoryEvidence(jobs), listingComplete = evidence?.listingComplete === true && reasons.size === 0 && !outputLimited
    if (!listingComplete) for (const job of selected) Object.assign(job, {
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
    return attachInventoryEvidence(selected, { ...evidence, listingComplete,
      status: listingComplete ? evidence.status : 'discovery-only',
      indiaFacetCount: reasons.size ? null : evidence?.indiaFacetCount,
      pagesFetched: (evidence?.pagesFetched || 0) + 2,
      reason: listingComplete ? 'current-employer-handoff-and-workable-account-cursor-details-verified'
        : `workable-employer-incomplete:${[...reasons, ...(outputLimited ? ['source-job-limit'] : []), ...(!evidence?.listingComplete ? [evidence?.reason || 'native-incomplete'] : [])].join(';')}` })
  },
})

const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const nativeState = record => stable(Object.fromEntries([
  'id', 'shortcode', 'title', 'accountUid', 'state', 'isInternal', 'approvalStatus', 'location', 'locations',
  'published', 'remote', 'workplace', 'department', 'employmentType', 'description', 'requirements', 'benefits',
].map(key => [key, record?.[key] ?? null])))
const visibleSections = detail => ['description', 'requirements', 'benefits'].every(key => {
  const raw = detail?.[key], content = typeof raw === 'string' ? extractActiveDescription(raw) : null
  if (!content) return key !== 'description' && !raw
  const document = readNativeDocument(raw), root = document.nodes(node => node.tag === 'root')[0]
  const visible = root ? document.text(root) : ''
  return visible.replace(/\s/g, '') === content.replace(/\s/g, '')
})

// Closing reconciliation is opt-in. Each snapshot still uses the same strict
// native cursor/detail engine; existing consumers retain their request contract.
export const createEmployerBoundWorkableScraper = (config, defaults = {}) => {
  if (config.reconcileClosingInventory !== true) return createEmployerBoundWorkableSnapshot(config, defaults)
  return {
    async run(options = {}) {
      const settings = { ...defaults, ...options }, loadJson = settings.fetchJson || fetchJson, maxJobs = settings.maxJobs ?? 0
      if (!Number.isSafeInteger(maxJobs) || maxJobs < 0) throw Error('Workable employer inventory: invalid output limit')
      const snapshot = async () => {
        const state = { records: new Map(), details: new Map(), account: null }
        const jobs = await createEmployerBoundWorkableSnapshot(config).run({ ...settings, maxJobs: 0,
          fetchJson: async (url, init) => {
            const payload = await loadJson(url, init)
            if (url === `https://apply.workable.com/api/v1/accounts/${config.tenant}`) state.account = structuredClone(payload)
            if (url === `https://apply.workable.com/api/v3/accounts/${config.tenant}/jobs`) {
              for (const row of payload?.results || []) state.records.set(row.shortcode, structuredClone(row))
            } else if (url.startsWith(`https://apply.workable.com/api/v2/accounts/${config.tenant}/jobs/`)) {
              state.details.set(url.split('/').at(-1), structuredClone(payload))
            }
            return payload
          },
        })
        return { ...state, jobs, evidence: readInventoryEvidence(jobs) }
      }
      const initial = await snapshot(), closing = await snapshot(), reasons = new Set()
      if (!initial.evidence.listingComplete) reasons.add(initial.evidence.reason)
      if (!closing.evidence.listingComplete) reasons.add(closing.evidence.reason)
      if (initial.records.size !== closing.records.size || [...initial.records].some(([id, row]) => nativeState(row) !== nativeState(closing.records.get(id)))) {
        reasons.add('closing-native-role-inventory-changed')
      }
      const healthy = closing.jobs.filter(job => {
        const id = job.jobId
        if (!initial.records.has(id) || nativeState(initial.records.get(id)) !== nativeState(closing.records.get(id))
          || !initial.details.has(id) || nativeState(initial.details.get(id)) !== nativeState(closing.details.get(id))) {
          reasons.add(`closing-native-role-details-changed:${id}`); return false
        }
        if (!visibleSections(initial.details.get(id)) || !visibleSections(closing.details.get(id))) {
          reasons.add(`visible-full-native-description-unavailable:${id}`); return false
        }
        const raw = closing.details.get(id)
        Object.assign(job, { nativeEmployerBrand: closing.account.name, sourceDetailComplete: true,
          sourceNativeEmployerEvidence: { accountUid: closing.account.uid, tenant: closing.account.subdomain, brand: closing.account.name,
            companyWebsite: closing.account.url, legalEmployer: null },
          sourceNativeLocations: raw.locations,
          sourceNativeDescriptionSections: Object.fromEntries(['description', 'requirements', 'benefits'].map(key => [key, raw[key] ?? null])),
          sourceNativeStatusEvidence: { state: raw.state, isInternal: raw.isInternal, approvalStatus: raw.approvalStatus },
        })
        return true
      })
      const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
      if (selected.length !== healthy.length) reasons.add('source-job-limit')
      const complete = reasons.size === 0
      for (const job of selected) Object.assign(job, { sourceListingComplete: complete,
        ...(!complete ? { sourceScopeComplete: false, lifecycleCleanupAllowed: false } : {}) })
      return attachInventoryEvidence(selected, { ...closing.evidence, listingComplete: complete,
        status: complete ? closing.evidence.status : 'discovery-only', indiaFacetCount: complete ? selected.length : null,
        pagesFetched: initial.evidence.pagesFetched + closing.evidence.pagesFetched,
        reason: complete ? 'current-employer-account-full-native-cursors-details-and-closing-snapshot-reconciled'
          : `workable-closing-incomplete:${[...reasons].join(';')}` })
    },
  }
}
