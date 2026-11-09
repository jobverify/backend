import { readFileSync } from 'node:fs'
import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'
import { createPublicIO, sha256 } from '../publicIO.js'
import { boundedDeclaredPublicGet } from '../boundedDeclaredPublicGet.js'
import { readJobPosting } from '../jobPostingData.js'
import { appData, nativeOrganization } from '../declaredAshby/nativeData.js'
import { createNativeGreenhouseScraper, nativeEnvelopeFailed } from '../declaredGreenhouse/nativeCareers.js'
import { mergeDefinedNativeOptions } from '../declaredGreenhouse/runtimeControls.js'
import { text, plain, requireNative, roleURL, criteria, geography, literalFields } from './nativeData.js'
import {currentNuxtRoutes,groupedPostDeclarations,corroborateCurrentWorksites,collectionEnvelopeError} from '../publicLeverChannels/routeEvidence.js'
import {reviewedAstroAssetURLs,selectReviewedAstroAsset} from './reviewedAstroAssets.js'

export const DECLARED_JOB_FEED_PROFILES = JSON.parse(readFileSync(new URL('./profiles.json', import.meta.url)))
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const equalNativeFields=(a,b)=>{
  if(a===b)return true
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>equalNativeFields(value,b[index]))
  const keys=Object.keys(a)
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equalNativeFields(a[key],b[key]))
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const activeScript = node => !node.inert && !Object.hasOwn(node.attrs, 'nomodule')
  && ['', 'text/javascript', 'application/javascript', 'module'].includes((node.attrs.type || '').trim().toLowerCase())
const isRedirect = status => [301, 302, 303, 307, 308].includes(status)
const hostStarts = new Map()
const waitForHost = async (url, signal) => {
  const host = new URL(url).hostname, start = Math.max(Date.now(), hostStarts.get(host) || 0)
  hostStarts.set(host, start + 500)
  if (start > Date.now()) await new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer);signal?.removeEventListener('abort', aborted);reject(signal.reason || Error('Public GET aborted')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted);resolve() }, start - Date.now())
    signal?.addEventListener('abort', aborted, { once: true });if (signal?.aborted) aborted()
  })
  signal?.throwIfAborted()
}
const parallel = async (items, visit, signal) => {
  let next = 0
  const settled = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (next < items.length) { signal?.throwIfAborted();await visit(items[next++]) }
  }))
  const failure = settled.find(result => result.status === 'rejected');if (failure) throw failure.reason
}
const organizationQualified = (profile, value) => nativeOrganization({ ...profile, companyName: profile.publisherName }, value)
const brandQualified = (profile, record) => {
  if (!profile.brandKeyword) return true
  const keyword = new RegExp('\\b' + profile.brandKeyword + '\\b', 'i')
  return [record.text, record.categories?.team, record.categories?.department].some(value => keyword.test(text(value)))
    || /(?:you will join|this (?:role|position) (?:is|works))[^.!?]{0,100}\bdelphix (?:team|product)\b/i.test(plain(record.descriptionBody || record.description))
}
export const createDeclaredJobFeedScraper = (profile, defaults = {}) => ({ name: profile.source, async run(passed = {}) {
  const options = profile.platform === 'greenhouse' ? mergeDefinedNativeOptions(defaults, passed) : { ...defaults, ...passed }, { signal, maxJobs = null, onAudit = () => {}, onRecords = () => {}, now = () => new Date().toISOString() } = options
  const countryFilter = profile.countryFilter ?? 'India'
  signal?.throwIfAborted()
  requireNative(['India', 'Global'].includes(countryFilter), 'countryFilter must be India or Global')
  requireNative(maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'maxJobs must be a nonnegative safe integer or null')
  requireNative(!(options.fetchJson || options.fetchText) || options.fetchPage || options.fetchImpl, 'Parsed/text-only injection has no original HTTP provenance')
  if (profile.platform === 'greenhouse') return createNativeGreenhouseScraper(profile, defaults).run({ ...options, now: () => {
    const observedAt = typeof now === 'function' ? now() : now
    requireNative(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'Invalid observation clock')
    return observedAt
  }, onAudit: async (audit, control, check) => {
    check()
    const detachedAudit = structuredClone(audit);check()
    await onAudit(detachedAudit)
    check()
    const detachedRecords = structuredClone(audit.observations);check()
    await onRecords(detachedRecords)
    check()
  } })
  const observedAt = typeof now === 'function' ? now() : now
  requireNative(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'Invalid observation clock')
  const allowedURLs = new Set([...profile.primaryPages, ...(profile.identityPages||[]), profile.publicAPIURL, profile.boardURL,
    ...(['active-declared-external-profile', 'active-declared-astro-component'].includes(profile.declaration.kind) ? [profile.declaration.scriptURL] : [])])
  for(const url of reviewedAstroAssetURLs(profile))allowedURLs.add(url)
  const held = new Set(), allowed = url => allowedURLs.has(url.href) && !held.has(url.hostname)
  const originalFetch = options.fetchImpl || globalThis.fetch
  const fetchPage = options.fetchPage || (async url => {
    await waitForHost(url, signal);requireNative(allowed(new URL(url)), 'public host became unavailable while queued')
    return boundedDeclaredPublicGet(url, { fetchImpl: originalFetch,
      signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
      overflowError: Error('Declared public job feed: native entity exceeds input limit') })
  })
  const io = createPublicIO({ ...options, fetchPage, allowed }), observations = new Map(), order = new Map(), history = []
  const load = async url => {
    const page = await io.load(url, { fresh: true })
    if ([401, 403, 429].includes(page?.status)) held.add(new URL(url).hostname)
    return page
  }
  const original = page => page?.usable && page.transportQualified && page.bodyBase64 && typeof page.originalText === 'string'
  const readJSON = async (url, phase, label) => {
    const page = await load(url)
    try {
      requireNative(original(page), label + ' original public response unavailable')
      const value = io.json(page);requireNative(value != null && !nativeEnvelopeFailed(value), label + ' error envelope')
      return value
    } catch (error) { signal?.throwIfAborted();phase.issues.push(error.message);return null }
  }
  const primary = async result => {
    if(profile.identityPages){
      result.originalIdentityPages=[]
      for(const[index,url]of profile.identityPages.entries()){
        const page=await load(url);result.originalIdentityPages.push(page)
        requireNative(page?.transportQualified,'original brand handoff transport unavailable')
        const next=profile.identityPages[index+1]
        if(next)requireNative(isRedirect(page.status)&&typeof page.headers.location==='string'
          &&new URL(page.headers.location,url).href===next,'original brand home redirect changed')
        else requireNative(original(page)&&readNativeDocument(page.originalText).nodes(n=>n.tag==='title')
          .some(n=>plain(n.raw||'').toLowerCase().includes(profile.brandKeyword)),'original brand product binding changed')
      }
    }
    const pages = []
    for (const [index, url] of profile.primaryPages.entries()) {
      const page = await load(url);pages.push(page)
      requireNative(page?.transportQualified, 'current primary transport unqualified')
      const next = profile.primaryPages[index + 1]
      if (isRedirect(page.status)) {
        requireNative(next && typeof page.headers.location === 'string' && new URL(page.headers.location, url).href === next, 'configured primary redirect changed')
        continue
      }
      requireNative(original(page), 'current primary unavailable')
      const document = readNativeDocument(page.originalText)
      const titles = document.nodes(node => node.tag === 'title').map(node => plain(node.raw || ''))
      requireNative(titles.some(title => profile.primaryTitleSignals.some(signal => title.toLowerCase().includes(signal.toLowerCase()))), 'current primary publisher/title changed')
      if (next) requireNative(document.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
        try { return new URL(node.attrs.href, url).href === next } catch { return false }
      }), 'current primary career handoff changed')
    }
    result.originalPrimaryPages = pages
    const page = pages.at(-1), document = readNativeDocument(page.originalText)
    let declaration = profile.declaration
    const reviewedAstro=declaration.kind==='active-declared-astro-component'&&Object.hasOwn(declaration,'reviewedAlternates')
    if(reviewedAstro){
      declaration=selectReviewedAstroAsset(page.originalText,profile)
      requireNative(declaration,'active reviewed Astro deployment changed or ambiguous')
    }
    const scripts = document.nodes(node => node.tag === 'script' && activeScript(node))
    if(declaration.kind==='active-current-nuxt-route-chain')return currentNuxtRoutes(profile,pages,load,allowedURLs,result)
    if (['active-declared-external-profile', 'active-declared-astro-component'].includes(declaration.kind)) {
      const declared = declaration.kind === 'active-declared-astro-component'
        ? reviewedAstro||document.nodes(node => node.tag === 'astro-island' && !node.inert && node.attrs['component-url'] === declaration.scriptSpecifier).length === 1
        : scripts.some(node => node.attrs.src === declaration.scriptSpecifier)
      requireNative(declared, 'active company-declared native asset changed')
      requireNative(new URL(declaration.scriptSpecifier, page.url).href === declaration.scriptURL, 'declared asset target changed')
      const asset = await load(declaration.scriptURL);result.originalDeclarationAsset = asset
      requireNative(original(asset) && asset.bodySHA256 === declaration.scriptSHA256, 'current declared native asset changed')
    } else if (declaration.kind === 'active-literal-native-inline-profile') {
      requireNative(scripts.some(node => !node.attrs.src && sha256(Buffer.from(node.raw || '')) === declaration.scriptSHA256
        && node.raw.includes(declaration.literalPublicURI)), 'active literal company/native profile changed')
    } else if (declaration.kind === 'active-native-embed-script') {
      requireNative(scripts.some(node => node.attrs.src === declaration.scriptURL), 'active company/native embed changed')
    } else requireNative(document.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
      try { return new URL(node.attrs.href, page.url).href === profile.boardURL } catch { return false }
    }), 'current company/native board handoff changed')
    if(profile.literalCachedRoleReferences){
      result.originalCachedRoleAvailability=[]
      for(const url of profile.literalCachedRoleReferences){allowedURLs.add(url);result.originalCachedRoleAvailability.push(await load(url))}
    }
    return true
  }
  const ownAPIURL = id => 'https://api.lever.co/v0/postings/' + profile.boardSlug + '/' + id
  const inspect = async (id, matching, brief, result) => {
    const record = matching.length === 1 ? matching[0] : null
    const url = record?.jobUrl || record?.hostedUrl || profile.boardURL + '/' + id
    const job = { source: profile.source, company: profile.publisherName, jobId: id, requisitionId: null, internalJobId: null,
      title: plain(record?.title || record?.text || brief?.title), sourceUrl: url, applyUrl: null, jobDescription: null,
      country: null, city: null, state: null, location: null, locations: [], sourceCountryScopeUnresolved: true,
      sourceEmploymentTypeUnresolved: true, sourceRemoteStatusUnresolved: true,
      sourceCurrentNativeRoleQualified: false, sourceCurrentNativePostingIdentityQualified: false, sourceNativeDetailQualified: false, sourceNativeIssues: [],
      sourceNativePhase: result.phase, sourceNativeListingRecord: structuredClone(record), sourceNativeBoardRecord: structuredClone(brief),
      sourceNativeListingConflicts: structuredClone(matching.length > 1 ? matching : []), sourceNativePostKind: 'job',
      sourceBrandScopeQualified: record ? brandQualified(profile, record) : false,
      sourceAliasPublisherShift: profile.sourceAliasPublisherShift || null, sourceScopeComplete: false, sourceDetailComplete: false, lifecycleCleanupAllowed: false }
    if(profile.publicGroupedAPIURL)job.sourceNativeGroupedDeclarations=structuredClone(result.nativeGroupedDeclarations?.[id]||[])
    try {
      requireNative(roleURL(profile, url, id), 'native public role URI changed')
      allowedURLs.add(url)
      let nativeRecord = record
      if (profile.platform === 'lever') {
        allowedURLs.add(ownAPIURL(id));nativeRecord = await readJSON(ownAPIURL(id), result, 'own Lever post')
        job.sourceNativeRecord = structuredClone(nativeRecord)
        if(!record&&nativeRecord){job.title=plain(nativeRecord.text);job.sourceBrandScopeQualified=brandQualified(profile,nativeRecord)}
      }
      const page = await load(url);job.sourceNativeOwnBodySHA256 = page?.bodySHA256 ?? null
      requireNative(original(page), 'own hosted post unavailable')
      const parsed = readJobPosting(page.originalText), schema = parsed.candidate?.model || null
      job.sourceNativeJobPosting = structuredClone(schema)
      let posting = null, org = null
      if (profile.platform === 'ashby') {
        const data = appData(parsed.document);posting = data.posting;org = data.organization
        job.sourceNativePosting = structuredClone(posting);job.sourceNativeOrganization = structuredClone(org)
      }
      const ownedRecord=record||(profile.platform==='lever'?nativeRecord:null)
      requireNative(ownedRecord && matching.length <= 1 && uuid.test(id), 'unique native index identity unavailable')
      requireNative(parsed.candidates.length === 1 && !parsed.errors.length && schema, 'unique own JobPosting unavailable')
      requireNative(plain(schema.title) === job.title && schema.hiringOrganization?.name === profile.publisherName, 'own native publisher/title changed')
      const hoursKey = value => typeof value === 'string' ? value.replace(/[\s_-]/g, '').toLowerCase().replace(/^contractor$/, 'contract').replace(/^internship$/, 'intern') : null
      const nativeHours = profile.platform === 'ashby' ? posting?.employmentType ?? record.employmentType : ownedRecord.categories?.commitment
      if (schema.employmentType != null && nativeHours != null) requireNative(typeof schema.employmentType === 'string'
        && hoursKey(schema.employmentType) === hoursKey(nativeHours), 'own native/schema employment conflict')
      const og = parsed.document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url').map(node => node.attrs.content)
      const canonical = parsed.document.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
      requireNative(og.length === 1 && roleURL(profile, og[0], id) && (!canonical.length
        || canonical.length === 1 && roleURL(profile, canonical[0].attrs.href, id)), 'own hosted role URI authority changed')
      requireNative(roleURL(profile, ownedRecord.applyUrl, id, true), 'native application URI identity changed')
      if (profile.platform === 'ashby') {
        requireNative(organizationQualified(profile, org) && posting?.id === id && schema.identifier?.value === id
          && schema.identifier.name === profile.publisherName && new URL(schema.hiringOrganization.sameAs).origin === profile.websiteOrigin,
        'own native organization/posting identity changed')
        requireNative(posting.isListed === true && posting.isConfidential === false && record.isListed === true, 'native post is unlisted or confidential')
        requireNative(text(posting.title) === job.title && (!brief || text(brief.title) === job.title), 'native listing/own title mismatch')
        requireNative(Array.isArray(record.secondaryLocations) && equal([posting.locationName, ...(posting.secondaryLocationNames || [])],
          [record.location, ...record.secondaryLocations.map(place => place.location)]), 'native listing/own locations mismatch')
        requireNative(typeof record.descriptionHtml === 'string' && posting.descriptionHtml === record.descriptionHtml && schema.description === posting.descriptionHtml,
          'native listing/own criteria mismatch')
        requireNative(posting.employmentType === record.employmentType && posting.workplaceType === record.workplaceType, 'native employment/workplace mismatch')
      } else {
        requireNative(matching.length<=1&&nativeRecord?.id === id && (!record||equal(nativeRecord, record))&&roleURL(profile,nativeRecord.hostedUrl,id), 'native listing/own API record mismatch')
        requireNative(Array.isArray(ownedRecord.lists) && [ownedRecord.descriptionBody, ownedRecord.description, ...ownedRecord.lists.map(section => section.content)]
          .some(value => typeof value === 'string' && plain(value)), 'native full criteria unavailable')
        // Lever's typed country stays separate from untyped schema localities.
        // The original schema is retained even when it carries no country.
        requireNative([ownedRecord.descriptionBody || ownedRecord.description, ...ownedRecord.lists.map(section => section.content)]
          .filter(value => plain(value)).every(value => plain(schema.description).includes(plain(value))), 'own hosted/API criteria mismatch')
      }
      if(profile.publicGroupedAPIURL)for(const declaration of job.sourceNativeGroupedDeclarations)for(const key of Object.keys(declaration.originalRecord))
        requireNative(Object.hasOwn(nativeRecord,key)&&equalNativeFields(declaration.originalRecord[key],nativeRecord[key]),'grouped collection/own post conflict: '+key)
      const description = criteria(profile, nativeRecord, posting)
      requireNative(description, 'complete native criteria missing')
      Object.assign(job, { jobDescription: description, sourceDescription: description, sourceNativeDetailQualified: true,
        ...geography(profile, nativeRecord, schema), ...literalFields(profile, nativeRecord, posting, schema),
        sourceUrl: url, applyUrl: ownedRecord.applyUrl, link: ownedRecord.applyUrl, applicationUrlIsGeneric: false,
        companyCareerPage: profile.primaryURL, companyDomain: new URL(profile.primaryPages.at(-1)).hostname.replace(/^www\./, ''), atsPlatform: profile.platform,
        sourceNativeApplication: { activationVerified: false, applicantEligibilityQualified: false, originalApplicantLocationRequirements: schema.applicantLocationRequirements ?? null } })
      job.sourceCurrentNativePostingIdentityQualified = result.publisherQualified
      job.sourceCurrentNativeRoleQualified = job.sourceCurrentNativePostingIdentityQualified && !job.sourceNativeCountryConflict
    } catch (error) { signal?.throwIfAborted();job.sourceNativeIssues.push(error.message);io.issue('native-own-post-held', { phase: result.phase, id, message: error.message }) }
    const earlier = observations.get(id)
    if (earlier) {
      if (!earlier.sourceCurrentNativePostingIdentityQualified) Object.assign(job, {
        sourceCurrentNativePostingIdentityQualified: false, sourceCurrentNativeRoleQualified: false, sourceNativeTemporalQualification: 'opening-native-identity-unqualified' })
      const identity = row => [row.jobId, row.title, row.company, row.sourceUrl, row.applyUrl]
      if (earlier.sourceNativeDetailQualified && job.sourceNativeDetailQualified && !equal(identity(earlier), identity(job))) Object.assign(job, {
        sourceCurrentNativeRoleQualified: false, sourceCurrentNativePostingIdentityQualified: false, sourceNativeTemporalQualification: 'opening-closing-native-identity-or-public-handoff-changed' })
      history.push({ id, earlier: structuredClone(earlier), current: structuredClone(job) })
      if (earlier.jobDescription && !job.sourceNativeDetailQualified) observations.set(id, { ...earlier, sourceCurrentNativeRoleQualified: false, sourceCurrentNativePostingIdentityQualified: false,
        sourceNativeClosingObservation: job, sourceNativeTemporalQualification: 'earlier-complete-positive-retained-closing-own-post-held' })
      else observations.set(id, job)
    } else observations.set(id, job)
  }
  const collect = async phase => {
    const result = { phase, publisherQualified: false, nativeListingComplete: false, qualified: false, nativePostIds: [], issues: [],
      originalNativeFeed: null, originalNativeBoard: null, nativePages: [] }
    let declared = false
    try { declared = await primary(result) } catch (error) { signal?.throwIfAborted();result.issues.push(error.message) }
    let records = [], briefs = [], complete = false, boardQualified = false,leverBoardIds=[]
    if (profile.platform === 'ashby') {
      const board = await load(profile.boardURL)
      try {
        requireNative(original(board), 'current native board unavailable')
        result.originalNativeBoard = appData(readNativeDocument(board.originalText))
        const data = result.originalNativeBoard
        briefs = Array.isArray(data.jobBoard?.jobPostings) ? data.jobBoard.jobPostings : []
        boardQualified = organizationQualified(profile, data.organization) && Array.isArray(data.jobBoard?.jobPostings)
          && briefs.every(record => uuid.test(record?.id)) && new Set(briefs.map(record => record.id)).size === briefs.length
      } catch (error) { signal?.throwIfAborted();result.issues.push(error.message) }
      const feed = await readJSON(profile.publicAPIURL, result, 'native Ashby feed');result.originalNativeFeed = feed
      records = Array.isArray(feed?.jobs) ? feed.jobs : []
      complete = feed?.apiVersion === '1' && Array.isArray(feed.jobs) && boardQualified
        && equal([...records.map(record => record?.id)].sort(), [...briefs.map(record => record.id)].sort())
        && [feed, feed?.meta].filter(Boolean).every(value => value.hasMore == null || value.hasMore === false)
        && ['next', 'nextPage', 'nextCursor'].every(key => feed?.[key] == null && feed?.meta?.[key] == null)
    } else {
      const board=await load(profile.boardURL);result.originalNativeBoard=board
      result.nativeBoardMissing=Boolean(profile.allowMissingNativeBoard&&board?.status===404&&board.transportQualified&&board.bodyBase64)
      if(original(board)){
        const doc=readNativeDocument(board.originalText)
        boardQualified=doc.nodes(n=>n.tag==='title').some(n=>plain(n.raw||'')===profile.publisherName)
        const linked=new Map()
        for(const node of doc.nodes(n=>n.tag==='a'&&n.attrs.href)){
          try{const url=new URL(node.attrs.href,profile.boardURL),id=url.pathname.split('/')[2]
            if(uuid.test(id)&&(roleURL(profile,url.href,id)||roleURL(profile,url.href,id,true))){
              if(!linked.has(id))linked.set(id,{id,originalPublicLinks:[]})
              linked.get(id).originalPublicLinks.push({url:url.href,attributes:{...node.attrs},text:doc.text(node)})
            }
          }catch{}
        }
        briefs=[...linked.values()];leverBoardIds=[...linked.keys()]
      }else if(!result.nativeBoardMissing)result.issues.push('current public Lever board unavailable')
      let skip = 0, done = false
      if(profile.nativeProxyURL){
        const proxyPage=await load(profile.nativeProxyURL);result.originalNativeProxy=null
        try{requireNative(original(proxyPage),'current first-party proxy original transport unavailable');result.originalNativeProxy=io.json(proxyPage)}
        catch(error){signal?.throwIfAborted();result.issues.push(error.message)}
        const proxy=result.originalNativeProxy
        result.nativeFeedUnavailable=!(proxy?.ok===true&&Array.isArray(proxy.data))
        result.nativeProxyEnvelopeError=collectionEnvelopeError(proxy)
        if(!result.nativeFeedUnavailable){records.push(...proxy.data);complete=!result.nativeProxyEnvelopeError&&[proxy,proxy.meta||{}].every(v=>v.hasMore==null||v.hasMore===false)&&['next','nextPage','nextCursor'].every(k=>proxy[k]==null&&proxy.meta?.[k]==null)}
        else result.issues.push('Advertised native proxy unavailable; no empty-feed or source-zero evidence')
        result.nativePages.push(proxy)
      }
      for (let pageIndex = 0; !profile.nativeProxyURL&&pageIndex < 100 && !done; pageIndex++) {
        const url = 'https://api.lever.co/v0/postings/' + profile.boardSlug + '?mode=json&skip=' + skip + '&limit=100'
        allowedURLs.add(url)
        const page = await readJSON(url, result, 'native Lever page');result.nativePages.push(page)
        if (!Array.isArray(page)) break
        records.push(...page)
        if (page.length < 100) { complete = true;done = true }
        else if (new Set(records.map(record => record?.id)).size !== records.length) { result.issues.push('native pagination repeated identities');break }
        skip += 100
      }
      result.originalNativeFeed = result.nativePages
      if(profile.publicGroupedAPIURL){
        allowedURLs.add(profile.publicGroupedAPIURL)
        result.originalNativeGroupedFeed=await readJSON(profile.publicGroupedAPIURL,result,'current declared grouped native collection')
        const groups=groupedPostDeclarations(result.originalNativeGroupedFeed);result.nativeGroupedDeclarations=groups.declarations
        result.nativeGroupedCollectionComplete=groups.complete
        if(!groups.complete)result.issues.push('Declared grouped native collection is malformed, incomplete or returned an error')
        complete=complete&&groups.complete&&equal(Object.keys(groups.declarations).sort(),records.map(r=>r?.id).sort())
        for(const [id,declarations]of Object.entries(groups.declarations))if(!briefs.some(r=>r.id===id))briefs.push({id,originalGroupedDeclarations:declarations})
      }
      if(result.nativeBoardMissing){
        boardQualified=true
        if(records.length)complete=false
      }
      else complete=complete&&equal([...records.map(r=>r?.id)].sort(),[...leverBoardIds].sort())
    }
    const supplied = new Map(), boardRecords = new Map()
    for (const record of records) {
      if (!uuid.test(record?.id)) { complete = false;result.issues.push('malformed native identity; full original page retained');continue }
      if (!supplied.has(record.id)) supplied.set(record.id, [])
      supplied.get(record.id).push(record)
    }
    for (const brief of briefs) if (uuid.test(brief?.id)) boardRecords.set(brief.id, brief)
    const ids = [...new Set([...supplied.keys(), ...boardRecords.keys()])]
    result.nativePostIds = ids;result.observedNativeRecordCount = records.length
    result.publisherQualified = declared && boardQualified
    result.nativeListingComplete = complete && records.length === supplied.size
    result.qualified = result.publisherQualified && result.nativeListingComplete
    for (const id of ids) if (!order.has(id)) order.set(id, order.size)
    await parallel(ids, id => inspect(id, supplied.get(id) || [], boardRecords.get(id) || null, result), signal)
    if(profile.nativeLocationCountryCorroboration)corroborateCurrentWorksites(profile,result,observations,history)
    return result
  }
  let opening, closing, fatal
  try { opening = await collect('opening');signal?.throwIfAborted();closing = await collect('closing') } catch (error) { fatal = error }
  const before = new Set(opening?.nativePostIds || []), after = new Set(closing?.nativePostIds || [])
  for (const [id, job] of observations) if (!closing?.publisherQualified || !before.has(id) || !after.has(id)) Object.assign(job, {
    sourceCurrentNativeRoleQualified: false, sourceCurrentNativePostingIdentityQualified: false, sourceNativeTemporalQualification: 'not-present-in-both-phases-or-closing-publisher-unqualified' })
  const all = [...observations.values()].sort((a, b) => order.get(a.jobId) - order.get(b.jobId))
  history.sort((a, b) => order.get(a.id) - order.get(b.id))
  const audit = { source: profile.source, countryFilter, opening, closing, observations: all, observationHistory: history, rawPages: io.rawPages, issues: io.issues,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
    qualification: 'Original public native models before country/brand selection. Whole-employer/India-zero, active recruitment, applications, database persistence and publication remain unqualified.' }
  await onAudit(structuredClone(audit));await onRecords(structuredClone(all));signal?.throwIfAborted();if (fatal) throw fatal
  const eligible = all.filter(job => job.sourceBrandScopeQualified && job.jobDescription && (countryFilter === 'Global'
    ? job.sourceCurrentNativePostingIdentityQualified
    : job.sourceCurrentNativeRoleQualified && !job.sourceNativeCountryConflict && (job.country === 'India' || job.sourceCountryScopeUnresolved)))
  const jobs = (maxJobs === null ? eligible : eligible.slice(0, maxJobs)).map(job => ({ ...job, scrapedAt: observedAt }))
  Object.defineProperty(jobs, 'sourceAudit', { value: audit })
  attachSourceObservationEvidence(jobs, { source: profile.source, recordKind: 'vacancy-rows', observedRecordCount: all.length,
    observedVacancyCount: all.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', firstParty: io.rawPages.some(page => page.transportQualified), surface: profile.publicAPIURL,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: io.rawPages.filter(page => page.usable).length, verifiedAt: observedAt,
    reason: 'current-declared-public-native-postings-before-country-brand-selection;whole-source-activation-applications-database-publication-unqualified' })
} })
