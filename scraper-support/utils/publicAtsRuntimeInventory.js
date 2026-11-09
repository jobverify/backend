import { createPublishingGapAtsScraper } from './publishingGapAts.js'
import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { readNativeDocument, activeIframeSources } from './activeNativeHtml.js'
import { fetchJsonWithRetry } from './fetch.js'
import { attachInventoryEvidence, readInventoryEvidence, copyNativeCollectionEvidence } from './inventoryEvidence.js'
import { greenhouseCountryLabels, greenhouseLocationLabels } from './greenhouseLocations.js'
import { reconcileAshbyUsRemoteScope, verifyUnavailableAshbyRoles } from './ashbyScopeEvidence.js'
import { reconcileGreenhouseOfficeCountries, greenhouseOfficeCountryForRole } from './greenhouseOfficeCountry.js'

const publicHosts = new Set(['jobs.ashbyhq.com', 'jobs.lever.co', 'jobs.eu.lever.co',
  'boards.greenhouse.io', 'job-boards.greenhouse.io', 'boards.eu.greenhouse.io', 'job-boards.eu.greenhouse.io'])
const companyHost = value => new URL(value).hostname.replace(/^www\./, '')
const recruitingDomains = ['myworkdayjobs.com', 'smartrecruiters.com', 'workable.com', 'icims.com',
  'successfactors.com', 'successfactors.eu', 'taleo.net', 'jobs2web.com', 'teamtailor.com',
  'personio.com', 'personio.de', 'bamboohr.com', 'freshteam.com', 'applytojob.com', 'breezy.hr',
  'recruitee.com', 'jobvite.com']
const parseActiveUrl = (value, base, text = '') => {
  try {
    const url = new URL(value, base)
    return ['http:', 'https:'].includes(url.protocol) ? { url, text } : null
  } catch { return null }
}
const region = (url, board) => board.atsPlatform === 'lever' ? board.region || 'global'
  : board.atsPlatform === 'greenhouse' && url.hostname.includes('.eu.') ? 'eu' : 'global'
const parsePublicUrl = value => {
  try {
    const url = new URL(value), board = identifyPublicAtsBoard(url.href)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && publicHosts.has(url.hostname) && board ? { url, board } : null
  } catch { return null }
}
const sameBoard = (candidate, expected) => candidate?.board.atsPlatform === expected.board.atsPlatform
  && candidate.board.boardToken === expected.board.boardToken
  && region(candidate.url, candidate.board) === region(expected.url, expected.board)
const rootBoard = (candidate, expected) => sameBoard(candidate, expected)
  && candidate.url.pathname.replace(/\/+$/, '') === `/${encodeURIComponent(expected.board.boardToken)}`
  && !candidate.url.search && !candidate.url.hash
const additionalRecruitingSurface = (candidate, expected, officialUrl) => {
  const native = parsePublicUrl(candidate.url.href)
  if (native) return !sameBoard(native, expected)
  const host = candidate.url.hostname
  if (recruitingDomains.some(domain => host === domain || host.endsWith(`.${domain}`))) return true
  // Preserve proprietary off-site recruiting actions too; unsupported does not
  // mean absent. These URLs are observed only, never followed by this detector.
  return companyHost(candidate.url.href) !== companyHost(officialUrl)
    && (/\b(?:careers?|apply(?: now)?|open (?:roles|positions)|(?:view|search|browse) (?:jobs|roles|positions))\b/i.test(candidate.text)
      || /\/(?:careers?|jobs?|apply)(?:\/|$)/i.test(candidate.url.pathname))
}
const roleId = (candidate, expected) => {
  if (!sameBoard(candidate, expected)) return null
  const prefix = `/${encodeURIComponent(expected.board.boardToken)}/`
  if (!candidate.url.pathname.startsWith(prefix)) return null
  const tail = candidate.url.pathname.slice(prefix.length).replace(/\/+$/, '')
  const match = expected.board.atsPlatform === 'greenhouse' ? tail.match(/^jobs\/(\d+)$/)
    : expected.board.atsPlatform === 'ashby' ? tail.match(/^([a-z\d._-]+)(?:\/application)?$/i)
      : tail.match(/^([a-z\d._-]+)(?:\/apply)?$/i)
  return match?.[1] || null
}
const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)', Accept: 'text/html' },
  })
  if (Number(response.headers.get('content-length')) > 3000000) throw new Error('Employer response exceeds inventory verification budget')
  const html = await response.text()
  if (html.length > 3000000) throw new Error('Employer response exceeds inventory verification budget')
  return { status: response.status, url: response.url, html }
}
const indiaCountry = value => typeof value === 'string' && /^(?:India|IN|IND)$/i.test(value.trim())
const indiaLabel = value => typeof value === 'string' && /\bindia\b/i.test(value)
const nativeIndiaScope = (record, kind, provider, officeScope) => {
  if (!record) return false
  if (kind === 'greenhouse') return greenhouseCountryLabels(record).some(indiaCountry)
    || greenhouseLocationLabels(record).some(indiaLabel)
    || (Array.isArray(record.offices) && record.offices.some(office =>
      greenhouseOfficeCountryForRole(record, office, provider, officeScope)?.country === 'IN'))
  if (kind === 'lever') return indiaCountry(record.country) || indiaLabel(record.categories?.location)
    || (record.categories?.allLocations || []).some(indiaLabel)
  return [{ location: record.location, address: record.address }, ...(record.secondaryLocations || [])].some(candidate =>
    indiaLabel(candidate.location) || indiaCountry((candidate.address?.postalAddress || candidate.address || {}).addressCountry))
}

// Opt-in runtime replacement for historical source-scope uncertainty. Only an
// inspected employer handoff and reconciled full native inventory can replace
// the configured false flag. Ordinary public ATS providers retain their policy.
export const createRuntimeVerifiedPublicAtsScraper = provider => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = (url, options) => fetchJsonWithRetry(url, {
    ...options, timeoutMs: 20000, label: provider.source,
  }), signal } = {}) {
    signal?.throwIfAborted()
    const fail = reason => {
      const error = new Error(`[${provider.source}] Current employer inventory binding unavailable: ${reason}`)
      Object.assign(error, { softFailure: true, abortRetries: true, failureKind: 'source_identity_unverified' })
      throw error
    }
    const policy = provider.runtimeInventoryVerification || {}
    const employerRoleLinks = policy.employerRoleLinks
    const expected = parsePublicUrl(policy.boardUrl)
    if (!expected || !['board-handoff', 'board-embed', 'role-links-exact'].includes(policy.mode)
      || expected.board.atsPlatform !== provider.atsPlatform || expected.board.boardToken !== provider.boardToken
      || !rootBoard(expected, expected)
      || (provider.atsPlatform === 'lever' && region(expected.url, expected.board) !== (provider.leverRegion || 'global'))) fail('invalid configured board or policy')
    const handoffBoard = policy.handoffBoardUrl === undefined ? null : parsePublicUrl(policy.handoffBoardUrl)
    if (policy.handoffBoardUrl !== undefined && (!handoffBoard || provider.atsPlatform !== 'ashby'
      || policy.mode !== 'board-handoff' || !rootBoard(handoffBoard, handoffBoard)
      || handoffBoard.url.href !== policy.handoffBoardUrl || handoffBoard.url.origin !== expected.url.origin
      || handoffBoard.board.boardToken === expected.board.boardToken
      || handoffBoard.board.boardToken.toLowerCase() !== expected.board.boardToken.toLowerCase())) {
      fail('invalid configured native board case handoff')
    }
    if (policy.nativeRemoteCountryScope !== undefined
      && (policy.nativeRemoteCountryScope !== 'US' || provider.atsPlatform !== 'ashby')) fail('invalid configured native remote country scope')
    if (policy.unavailableAdvertisedRoles !== undefined
      && (policy.unavailableAdvertisedRoles !== 'ashby-native-404' || provider.atsPlatform !== 'ashby'
        || policy.mode !== 'board-handoff')) fail('invalid configured unavailable advertised role scope')
    if (employerRoleLinks !== undefined && (provider.atsPlatform !== 'greenhouse' || policy.mode !== 'role-links-exact'
      || typeof employerRoleLinks !== 'object' || !employerRoleLinks
      || typeof employerRoleLinks.pathname !== 'string' || !/^\/[a-z0-9/_-]+\/$/i.test(employerRoleLinks.pathname)
      || typeof employerRoleLinks.idParameter !== 'string' || !/^[a-z][a-z0-9_]*$/i.test(employerRoleLinks.idParameter))) {
      fail('invalid configured employer role identity links')
    }
    const handoffPages = policy.employerHandoffPages
    if (handoffPages !== undefined && (!Array.isArray(handoffPages) || handoffPages.length < 1 || handoffPages.length > 3
      || handoffPages.some(value => {
        const candidate = typeof value === 'string' ? parseActiveUrl(value) : null
        return !candidate || candidate.url.protocol !== 'https:' || candidate.url.username || candidate.url.password
          || candidate.url.port || candidate.url.search || candidate.url.hash || candidate.url.href !== value
          || companyHost(value) !== companyHost(provider.companyCareerPage)
      }))) fail('invalid configured employer handoff page')
    const inspectEmployerPage = (page, pinnedUrls = null) => {
      let finalUrl
      try { finalUrl = new URL(page?.url) } catch { fail('invalid employer response URL') }
      if (Number(page?.status) !== 200 || finalUrl.protocol !== 'https:' || finalUrl.username || finalUrl.password
        || finalUrl.port || typeof page.html !== 'string' || !page.html.trim()) fail('employer response unavailable')
      if (pinnedUrls && !pinnedUrls.includes(finalUrl.href)) fail('unexpected employer handoff redirect')
      const redirectedToBoard = policy.mode === 'board-handoff' && rootBoard(parsePublicUrl(finalUrl.href), expected)
      if (!redirectedToBoard && companyHost(finalUrl.href) !== companyHost(provider.companyCareerPage)) fail('foreign employer redirect')
      const document = readNativeDocument(page.html)
      const anchorCandidates = document.nodes(node => node.tag === 'a' && node.attrs.href)
        .map(node => parseActiveUrl(node.attrs.href, finalUrl, document.text(node))).filter(Boolean)
      const scripts = document.nodes(node => node.tag === 'script' && node.attrs.src
        && !Object.hasOwn(node.attrs, 'nomodule')
        && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')).map(node => node.attrs.src)
      const embedCandidates = [...scripts, ...activeIframeSources(page.html)]
        .map(value => parseActiveUrl(value, finalUrl)).filter(Boolean)
      return { anchorCandidates, embedCandidates, redirectedToBoard }
    }
    const firstPage = await fetchPage(provider.companyCareerPage, { signal })
    signal?.throwIfAborted()
    const employerPages = [inspectEmployerPage(firstPage)]
    if (handoffPages) {
      const advertisedPage = handoffPages.map(url => employerPages[0].anchorCandidates.find(candidate => candidate.url.href === url)).find(Boolean)
      if (!advertisedPage) fail('active advertised employer handoff page not established')
      const nextPage = await fetchPage(advertisedPage.url.href, { signal })
      signal?.throwIfAborted()
      employerPages.push(inspectEmployerPage(nextPage, handoffPages))
    }
    const employerRoleId = candidate => {
      if (!employerRoleLinks || candidate.url.origin !== new URL(provider.companyCareerPage).origin
        || candidate.url.pathname !== employerRoleLinks.pathname || candidate.url.hash
        || candidate.url.username || candidate.url.password || candidate.url.port) return null
      const ids = candidate.url.searchParams.getAll(employerRoleLinks.idParameter)
      return ids.length === 1 && /^\d+$/.test(ids[0]) ? ids[0] : null
    }
    const mappedEmployerLinks = employerPages.flatMap(page => page.anchorCandidates).filter(candidate => employerRoleId(candidate))
    if (employerRoleLinks) {
      if (!mappedEmployerLinks.length) fail('active employer role identity links not established')
      // Follow a currently advertised first-party role, then require its active
      // apply action to establish the same native board AND the same role ID.
      // Query parameters on a marketing page alone cannot bind a native feed.
      const advertised = mappedEmployerLinks[0]
      const rolePage = await fetchPage(advertised.url.href, { signal })
      signal?.throwIfAborted()
      const inspected = inspectEmployerPage(rolePage, [advertised.url.href])
      if (!inspected.anchorCandidates.some(candidate => roleId(parsePublicUrl(candidate.url.href), expected) === employerRoleId(advertised))) {
        fail('employer role native apply identity not established')
      }
      employerPages.push(inspected)
    }
    const anchorCandidates = employerPages.flatMap(page => page.anchorCandidates)
    const embedCandidates = employerPages.flatMap(page => page.embedCandidates)
    const anchors = anchorCandidates.map(candidate => parsePublicUrl(candidate.url.href)).filter(Boolean)
    let advertisedIds = new Set([...anchors.map(candidate => roleId(candidate, expected)),
      ...mappedEmployerLinks.map(employerRoleId)].filter(Boolean))
    const hasBoardAnchor = anchors.some(candidate => rootBoard(candidate, expected))
    const embeds = embedCandidates.map(candidate => parsePublicUrl(candidate.url.href)).filter(Boolean)
    const hasEmbed = expected.board.atsPlatform === 'ashby' && embeds.some(candidate => sameBoard(candidate, expected)
      && candidate.url.pathname === `/${encodeURIComponent(provider.boardToken)}/embed`
      && !candidate.url.search && !candidate.url.hash)
    let bound = policy.mode === 'board-handoff' ? hasBoardAnchor || employerPages.some(page => page.redirectedToBoard)
      : policy.mode === 'board-embed' ? hasEmbed : advertisedIds.size > 0
    let verifiedCaseHandoff = false
    if (!bound && handoffBoard && anchors.some(candidate => rootBoard(candidate, handoffBoard))) {
      // The employer's advertised case alias is observed, then independently
      // resolved by that native page. API role identities stay exact-case.
      const page = await fetchPage(handoffBoard.url.href, { signal })
      signal?.throwIfAborted()
      if (Number(page?.status) !== 200 || ![handoffBoard.url.href, expected.url.href].includes(page?.url)
        || typeof page.html !== 'string' || !page.html.trim()) fail('native board case handoff unavailable')
      const declarations = readNativeDocument(page.html).nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url')
      if (declarations.length !== 1 || declarations[0].attrs.content !== expected.url.href) {
        fail('native board canonical case identity not established')
      }
      verifiedCaseHandoff = bound = true
      for (const candidate of anchors) {
        const id = roleId(candidate, handoffBoard)
        if (id) advertisedIds.add(id)
      }
    }
    if (!bound) fail(`active ${policy.mode} handoff not established`)

    let payload
    const nativeScraper = createPublishingGapAtsScraper({ ...provider, sourceScopeComplete: true })
    let jobs = await nativeScraper.run({ signal,
      fetchJson: async (url, options) => { payload = await fetchJson(url, options); return payload },
    })
    const originalNativeJobs = jobs
    let nativeCountryAudit = { proofs: [], failures: [], pagesFetched: 0 }
    if (policy.nativeRemoteCountryScope === 'US' && readInventoryEvidence(jobs)?.listingComplete !== true) {
      // The initial extraction validates the original envelope and role schema
      // before any role-detail request or temporary country reconciliation.
      nativeCountryAudit = await reconcileAshbyUsRemoteScope(payload, provider, { fetchPage, signal })
      if (nativeCountryAudit.proofs.length) {
        payload = nativeCountryAudit.payload
        jobs = await nativeScraper.run({ signal, fetchJson: async () => payload })
      }
    }
    signal?.throwIfAborted()
    const records = provider.atsPlatform === 'lever' ? payload : payload.jobs
    const nativeIds = new Set(records.filter(row => row.isListed !== false).map(row => String(row.id)))
    let unavailableAudit = { proofs: [], failures: [], pagesFetched: 0 }
    if (policy.unavailableAdvertisedRoles === 'ashby-native-404') {
      unavailableAudit = await verifyUnavailableAshbyRoles([...advertisedIds].filter(id => !nativeIds.has(id)), provider, { fetchPage, signal })
      const unavailableIds = new Set(unavailableAudit.proofs.map(proof => proof.jobId))
      advertisedIds = new Set([...advertisedIds].filter(id => !unavailableIds.has(id)))
    }
    if (provider.atsPlatform === 'greenhouse') for (const row of records) {
      if (roleId(parsePublicUrl(row.absolute_url), expected) !== String(row.id)) {
        throw new Error(`[${provider.source}] Invalid Greenhouse native board or role URL identity`)
      }
    }
    const reasons = []
    if ([...advertisedIds].some(id => !nativeIds.has(id))
      || (policy.mode === 'role-links-exact' && (advertisedIds.size !== nativeIds.size
        || [...nativeIds].some(id => !advertisedIds.has(id))))) reasons.push('official-role-identities-not-reconciled')
    if ([...anchorCandidates, ...embedCandidates].some(candidate =>
      !(verifiedCaseHandoff && sameBoard(parsePublicUrl(candidate.url.href), handoffBoard))
      && additionalRecruitingSurface(candidate, expected, provider.companyCareerPage))) {
      reasons.push('additional-employer-ats-scope-unresolved')
    }
    const evidence = readInventoryEvidence(jobs)
    const byId = new Map(records.map(row => [String(row.id), row]))
    const officeScope = provider.atsPlatform === 'greenhouse' ? reconcileGreenhouseOfficeCountries(records, provider) : null
    // A current employer binding does not disambiguate shared city names.
    // Require native country/India labels before returning an India vacancy.
    const selectedJobs = copyNativeCollectionEvidence(originalNativeJobs,
      jobs.filter(job => nativeIndiaScope(byId.get(String(job.jobId)), provider.atsPlatform, provider, officeScope)))
    if (nativeCountryAudit.proofs.length) {
      const originalAudit = Object.getOwnPropertyDescriptor(selectedJobs, 'nativeCollectionEvidence')?.value
      const reconciledAudit = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')?.value
      if (originalAudit && reconciledAudit) Object.defineProperty(selectedJobs, 'nativeCollectionEvidence', {
        value: { ...originalAudit, nativeCountryReconciliation: {
          nativeRecords: reconciledAudit.nativeRecords, nativePayload: reconciledAudit.nativePayload,
          proofs: structuredClone(nativeCountryAudit.proofs), failures: structuredClone(nativeCountryAudit.failures),
        } }, configurable: true,
      })
    }
    if (selectedJobs.length !== jobs.length) reasons.push('native-location-scope-unresolved:india-country-evidence-unavailable')
    if (!evidence?.listingComplete) reasons.push(evidence?.reason || 'native-inventory-evidence-unavailable')
    const listingComplete = reasons.length === 0
    if (!listingComplete) for (const job of selectedJobs) {
      job.sourceListingComplete = false
      job.sourceScopeComplete = false
      job.lifecycleCleanupAllowed = false
    }
    const countryProofReason = nativeCountryAudit.proofs.length
      ? `:native-remote-applicant-country-verified:${nativeCountryAudit.proofs.map(proof => `${proof.jobId}=US@${proof.sha256}`).join(',')}` : ''
    const countryFailureReason = nativeCountryAudit.failures.length
      ? `:native-remote-applicant-country-unverified:${nativeCountryAudit.failures.map(failure => `${failure.jobId}=${failure.reason}`).join(',')}` : ''
    const unavailableProofReason = unavailableAudit.proofs.length
      ? `:native-advertised-unavailable-verified:${unavailableAudit.proofs.map(proof => `${proof.jobId}@${proof.sha256}`).join(',')}` : ''
    const nativeProofOffsets = [':native-worksite-country-verified:', ':native-office-country-verified:', ':native-prospect-posts-excluded:']
      .map(marker => evidence?.reason?.indexOf(marker) ?? -1).filter(index => index >= 0)
    const nativeProofReason = nativeProofOffsets.length ? evidence.reason.slice(Math.min(...nativeProofOffsets)) : ''
    return attachInventoryEvidence(selectedJobs, { ...evidence, listingComplete,
      status: listingComplete ? evidence.status : 'discovery-only',
      firstParty: evidence?.firstParty === true,
      pagesFetched: (evidence?.pagesFetched || 0) + employerPages.length + Number(verifiedCaseHandoff) + nativeCountryAudit.pagesFetched + unavailableAudit.pagesFetched,
      indiaFacetCount: reasons.some(reason => /identities-not-reconciled|additional-employer|native-location-scope-unresolved/.test(reason)) ? null : evidence?.indiaFacetCount,
      reason: (listingComplete ? `public-ats-current-employer-and-native-inventory-verified:${policy.mode}`
        : `public-ats-runtime-incomplete:${reasons.join(';')}`) + (verifiedCaseHandoff ? ':native-case-canonical-board-verified' : '')
        + countryProofReason + countryFailureReason + unavailableProofReason + nativeProofReason,
    })
  },
})
