import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import { CONSUMER_VIEW_BODY, URLS, clean, fingerprint, hash, listingSnapshot, parseConsumerInventory, parseGlobalObservation, parseSoftwarePage, parseSonyRole, requireNative, softwareClientUrl, verifyConsumerShell, verifyGlobalCorporate, verifyIndiaCorporate, verifyIndiaFragment, verifyIndiaLoader, verifySoftwareClient, verifySoftwareCorporate, verifySoftwareIdentity } from './native.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
export const createSonyScraper = ({ fetchImpl = globalThis.fetch, now = () => new Date() } = {}) => ({
  async run({ signal, maxJobs = null, maxPages = 100, totalBudgetMs = 120000, requestTimeoutMs = 20000, onAudit } = {}) {
    signal?.throwIfAborted()
    requireNative(Number.isFinite(totalBudgetMs) && totalBudgetMs > 0 && Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0, 'Sony native request budget must be finite and positive')
    const deadline = Date.now() + totalBudgetMs, cookies = new Map(), receipts = []
    const wait=(operation,boundary)=>new Promise((resolve,reject)=>{const abort=()=>{boundary.removeEventListener('abort',abort);reject(signal?.aborted?signal.reason:boundary.reason)};if(boundary.aborted){abort();return}boundary.addEventListener('abort',abort,{once:true});Promise.resolve().then(operation).then(value=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():resolve(value)},error=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():reject(error)})})
    const request = async (url, { method = 'GET', body, headers = {}, kind = 'html' } = {}) => {
      signal?.throwIfAborted()
      const remaining = deadline - Date.now()
      requireNative(remaining > 0, 'Sony native source budget exhausted')
      const requestSignal = composeAbortSignals(signal, AbortSignal.timeout(Math.max(1, Math.min(remaining, requestTimeoutMs))))
      const origin = new URL(url).origin
      const jar = cookies.get(origin) || new Map()
      const response = await wait(()=>fetchImpl(url, { method, body, headers: { 'User-Agent': USER_AGENT,
        Accept: kind === 'json' ? 'application/json' : kind === 'script' ? 'application/javascript' : kind === 'xml' ? 'text/xml,application/xml' : 'text/html,application/xhtml+xml',
        ...(jar.size ? { Cookie: [...jar.values()].join('; ') } : {}), ...headers }, signal: requestSignal }),requestSignal)
      signal?.throwIfAborted(); requestSignal.throwIfAborted()
      for (const value of response.headers?.getSetCookie?.() || []) {
        const pair = value.split(';')[0], at = pair.indexOf('=')
        if (at > 0) jar.set(pair.slice(0, at), pair)
      }
      cookies.set(origin, jar)
      if (!response.ok) throw Object.assign(new Error(`[sony] HTTP ${response.status} at ${url}`), { status: response.status })
      requireNative(response.url === url, 'Sony public response redirected away from its exact native identity')
      const contentType = response.headers.get('content-type') || ''
      const types = { html: /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i, json: /^application\/(?:[a-z0-9.+-]*\+)?json(?:;|$)/i,
        xml: /^(?:text|application)\/xml(?:;|$)/i, script: /^(?:text|application)\/(?:x-)?javascript(?:;|$)/i }
      requireNative(types[kind].test(contentType), 'Sony native response content type changed')
      const text = await wait(()=>response.text(),requestSignal)
      signal?.throwIfAborted(); requestSignal.throwIfAborted()
      receipts.push({ url, method, status: response.status, contentType, bodySHA256: hash(text), observedAt: now().toISOString() })
      return kind === 'json' ? JSON.parse(text) : text
    }
    const corporate = await request(URLS.indiaCorporate)
    verifyIndiaCorporate(corporate)
    verifyIndiaLoader(await request(URLS.indiaCareers))
    const fragmentUrl = URLS.indiaFragment + '?_=' + Date.now()
    verifyIndiaFragment(await request(fragmentUrl))
    verifyConsumerShell(await request(URLS.consumer))
    const consumerRequest = () => request(URLS.consumerView, { method: 'POST', body: CONSUMER_VIEW_BODY,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: URLS.consumer }, kind: 'xml' })
    const consumer = parseConsumerInventory(await consumerRequest())
    verifySoftwareCorporate(await request(URLS.softwareCorporate))
    const clientUrl = softwareClientUrl(await request(URLS.software))
    const client = await request(clientUrl, { kind: 'script' })
    verifySoftwareClient(client)
    const nativeHeaders = { TenantGroupId: 'G1', Origin: 'https://careers.sonyindiasoftware.co.in', Referer: URLS.software }
    const tenant = await request(URLS.tenant, { kind: 'json' })
    const config = await request(URLS.config, { headers: nativeHeaders, kind: 'json' })
    verifySoftwareIdentity(tenant, config)
    const inventory = async () => {
      const records = [], ids = new Set(), slugs = new Set()
      let total = null, offset = 0
      requireNative(Number.isSafeInteger(maxPages) && maxPages > 0, 'Sony native page cap is invalid')
      for (let page = 0; page < maxPages; page++) {
        const form = new FormData()
        form.append('filterCri', JSON.stringify({ paginationStartNo: offset, selectedCall: 'sort', sortCriteria: { name: 'modifiedDate', isAscending: false }, anyOfTheseWords: '' }))
        form.append('domain', 'careers.sonyindiasoftware.co.in'); form.append('companyId', 'MTU1MzI=')
        const payload = parseSoftwarePage(await request(URLS.search, { method: 'POST', body: form, headers: nativeHeaders, kind: 'json' }))
        requireNative(total == null || payload.total === total, 'Sony native inventory total changed during pagination')
        total = payload.total
        for (const record of payload.records) {
          requireNative(!ids.has(record.id) && !slugs.has(record.jobUrl), 'Sony native inventory repeats a role identity')
          ids.add(record.id); slugs.add(record.jobUrl); records.push(record)
        }
        if (!payload.hasMore) {
          requireNative(records.length === total, 'Sony native inventory terminal count does not reconcile')
          return { records, total, pagesFetched: page + 1 }
        }
        requireNative(payload.records.length > 0 && records.length < total, 'Sony native pagination terminal marker conflicts with its rows')
        offset += payload.pageSize
      }
      requireNative(false, 'Sony native page cap prevented complete enumeration')
    }
    const opening = await inventory()
    const detail = async record => {
      const data = await request(URLS.detail, { method: 'POST', body: JSON.stringify({ jobUrl: record.jobUrl, externalSource: 'CAREERSITE', campusUrl: 'empty', companyId: '15532', jobId: String(record.id) }),
        headers: { ...nativeHeaders, 'Content-Type': 'application/json' }, kind: 'json' })
      const reqFields = await request(`https://public.zwayam.com/requisition_service/getReqFieldsForCareersSite/${record.id}/15532`, { headers: nativeHeaders, kind: 'json' })
      return {...parseSonyRole(record, data, reqFields),nativeListing:structuredClone(record),nativeDetailPayload:data,nativeReqFields:reqFields}
    }
    const reviewed = new Map()
    for (const record of opening.records) reviewed.set(record.id, await detail(record))
    verifyGlobalCorporate(await request(URLS.globalCorporate))
    const globalNativeFirstPage=await request(URLS.globalSearch, { method: 'POST', body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: '' }),
      headers: { 'Content-Type': 'application/json' }, kind: 'json' }),globalWorkday={...parseGlobalObservation(globalNativeFirstPage),nativeFirstPage:globalNativeFirstPage}
    const closing = await inventory()
    requireNative(opening.total === closing.total && fingerprint(listingSnapshot(opening.records)) === fingerprint(listingSnapshot(closing.records)), 'Sony closing native inventory changed')
    for (const record of closing.records) requireNative(reviewed.get(record.id)?.snapshot === (await detail(record)).snapshot, 'Sony closing native detail criteria or availability changed')
    requireNative(fingerprint(consumer) === fingerprint(parseConsumerInventory(await consumerRequest())), 'Sony India consumer inventory changed')
    verifyIndiaFragment(await request(URLS.indiaFragment + '?_=' + Date.now()))
    verifySoftwareCorporate(await request(URLS.softwareCorporate))
    requireNative(softwareClientUrl(await request(URLS.software)) === clientUrl && hash(await request(clientUrl, { kind: 'script' })) === hash(client), 'Sony native client changed during the run')
    const final=await inventory(),finalModels=new Map(final.records.map(r=>[r.id,fingerprint(listingSnapshot([r]))])),heldFinalRoleIds=opening.records.filter(r=>finalModels.get(r.id)!==fingerprint(listingSnapshot([r]))).map(r=>r.id),finalInventoryStable=opening.total===final.total&&heldFinalRoleIds.length===0
    const allJobs = opening.records.flatMap(record => reviewed.get(record.id)?.job&&!heldFinalRoleIds.includes(record.id) ? [reviewed.get(record.id).job] : [])
    const unresolvedCountries = opening.records.filter(record => /country|geography|location|address/.test(reviewed.get(record.id)?.reason || '')).map(record => ({ jobId: String(record.id), title: record.jobTitle, reason: reviewed.get(record.id).reason, nativeListing: record }))
    const observations = { software: { reportedTotal: opening.total, enumeratedRows: opening.records.length, pagesFetched: opening.pagesFetched,
      explicitIndiaRows: allJobs.length, unresolvedCountries, listingComplete: finalInventoryStable, closingInventoryAndCriteriaMatch: finalInventoryStable, finalInventoryStable, heldFinalRoleIds, originalNativeListing:opening.records,closingNativeListing:closing.records,finalNativeListing:final.records,nativeRoleDetails:[...reviewed].map(([jobId,r])=>({jobId,reason:r.reason??null,nativeListing:r.nativeListing,nativeDetailPayload:r.nativeDetailPayload,nativeReqFields:r.nativeReqFields})), companyId: 15532, tenantGroupId: 'G1', clientUrl, clientSHA256: hash(client) },
      consumer, globalWorkday, sourceScopeComplete: false, reason: 'reviewed-India-employers-do-not-establish-complete-Sony-group-inventory', retainedResponses: receipts }
    const selected = Number.isSafeInteger(maxJobs) && maxJobs > 0 ? allJobs.slice(0, maxJobs) : allJobs
    const jobs = selected.map(job => ({ ...job, link: job.applyUrl, scrapedAt: now().toISOString(), sourceNativeInventory: observations }))
    signal?.throwIfAborted()
    attachSourceObservationEvidence(jobs,{source:'sony',recordKind:'vacancy-rows',observedRecordCount:opening.records.length+consumer.reportedTotal,observedVacancyCount:opening.records.length+consumer.reportedTotal,sourceScopeComplete:false})
    Object.defineProperty(jobs,'sourceAudit',{value:observations});if(onAudit){const remaining=deadline-Date.now();requireNative(remaining>0,'Sony native source budget exhausted');await wait(()=>onAudit(observations),composeAbortSignals(signal,AbortSignal.timeout(remaining)))}
    return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: URLS.search, firstParty: true, listingComplete: false,
      pagesFetched: opening.pagesFetched + closing.pagesFetched+final.pagesFetched, reportedTotal: null, indiaFacetCount: null, verifiedAt: now().toISOString(),
      reason: `sony-current-native-India-roles-recovered;whole-group-inventory-unproved;unresolved-native-country-roles:${unresolvedCountries.length}`+(!finalInventoryStable?';final-native-membership-changed':'') })
  },
})
export const run = options => createSonyScraper().run(options)
