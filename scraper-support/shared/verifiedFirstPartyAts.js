import { normalizeCity } from '../utils/cityNormalizer.js'
import { extractAshbyExperienceRequired } from '../utils/ashbyExperience.js'

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const required = (value, field) => { const text = clean(value); if (!text) throw new Error('Invalid ATS record: missing ' + field); return text }
const sameText = (left, right) => clean(left).toLowerCase() === clean(right).toLowerCase()
const countryKey = value => clean(value).toLowerCase().replace(/[^a-z]/g, '')
const reservedRegions = new Set(['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'])
const countries = new Map()
const displayNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
  const code = String.fromCharCode(first, second), name = displayNames.of(code)
  if (name && !reservedRegions.has(code)) { countries.set(countryKey(code), code); countries.set(countryKey(name), code) }
}
for (const [name, code] of [['USA', 'US'], ['United States of America', 'US'], ['UK', 'GB'], ['UAE', 'AE']]) countries.set(countryKey(name), code)
const countryCode = value => { const code = countries.get(countryKey(value)); if (!code) throw new Error('Invalid ATS geography: unknown country ' + clean(value)); return code }
const htmlDecode = value => String(value || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ')
const visibleText = value => clean(htmlDecode(htmlDecode(value)).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' '))
const documentHtml = value => String(value || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
const attributes = (html, tags, attribute) => [...String(html).matchAll(new RegExp('<(?:' + tags + ')\\b[^>]*>', 'gi'))]
  .map(match => match[0].match(new RegExp('\\b' + attribute + '\\s*=\\s*(["\'])(.*?)\\1', 'i'))?.[2]).filter(Boolean).map(htmlDecode)
const escapeRegex = value => String(value).replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')
const strictUrl = value => {
  let url
  try { url = new URL(value) } catch { throw new Error('Invalid ATS URL identity') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Invalid ATS URL identity')
  return url
}
const comparableUrl = value => { const url = strictUrl(value); url.pathname = url.pathname.replace(/\/$/, '') || '/'; return url.href }
const verifyHandoffLink = (html, config) => {
  const expected = comparableUrl(config.handoffUrl)
  const document = documentHtml(html)
  const scriptTags = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>')
  const links = config.handoffType === 'script' ? attributes(scriptTags, 'script', 'src')
    : [...attributes(document, 'a', 'href'), ...attributes(document, 'iframe', 'src')]
  if (!links.some(link => { try { return comparableUrl(new URL(link, config.careersUrl).href) === expected } catch { return false } })) throw new Error('Official careers handoff changed for ' + config.source)
}
const ensureComplete = (jobs, total, label) => {
  if (!Array.isArray(jobs) || !Number.isSafeInteger(total) || total < 0 || total !== jobs.length) throw new Error('Incomplete or invalid ' + label + ' total')
  const ids = jobs.map(job => String(job?.id ?? ''))
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate ATS job identity')
}
const exactIds = (left, right) => left.length === right.length && left.every(id => new Set(right).has(id))
const validateRoleUrl = (value, id, config, application = false) => {
  const url = strictUrl(value)
  if (config.platform === 'ashby') {
    if (url.hostname !== 'jobs.ashbyhq.com' || url.port || url.search || url.pathname !== '/' + config.board + '/' + id + (application ? '/application' : '')) throw new Error('Invalid Ashby board/job URL identity')
  } else if ((config.greenhouseEmbeddedJobIds || config.greenhouseFirstPartyJobPath) && url.origin === new URL(config.careersUrl).origin) {
    if (url.pathname !== (config.greenhouseEmbeddedJobIds?.jobPath || config.greenhouseFirstPartyJobPath) || [...url.searchParams.keys()].length !== 1 || url.searchParams.get('gh_jid') !== id) throw new Error('Invalid Greenhouse first-party job URL identity')
  } else if (!['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(url.hostname) || url.port || url.search || url.pathname !== '/' + config.board + '/jobs/' + id) throw new Error('Invalid Greenhouse board/job URL identity')
  return url.href
}
const ashbyLocations = job => {
  if (!Array.isArray(job.secondaryLocations)) throw new Error('Invalid Ashby geography: secondaryLocations must be an array')
  return [{ location: job.location, address: job.address }, ...job.secondaryLocations].map(location => {
    const address = location?.address?.postalAddress
    const country = countryCode(address?.addressCountry)
    return { location: required(location?.location || address?.addressLocality || address?.addressCountry, 'location'), country, city: clean(address?.addressLocality), state: clean(address?.addressRegion) }
  })
}
const greenhouseLocations = (job, config) => required(job.location?.name, 'location').split(/\s*;\s*|\s+\/\s+/).map(segment => {
  const location = segment.trim()
  const override = config.locationCountryOverrides?.[location]
  const declaredCountry = override || location.split(',').at(-1).trim()
  if (!override && /^[a-z]{2}$/i.test(declaredCountry) && !/^(?:US|UK)$/i.test(declaredCountry)) {
    throw new Error('Invalid ATS geography: ambiguous free-text country/state code ' + declaredCountry)
  }
  return { location, country: countryCode(declaredCountry), city: location.split(',')[0].trim() }
})
const jobResult = (job, id, title, description, locations, config, sourceUrl, applyUrl) => {
  const eligible = locations.filter(location => location.country === 'IN')
  if (!eligible.length) return null
  const primary = eligible[0]
  const city = /\bremote\b/i.test(primary.location) ? 'Remote' : normalizeCity(primary.location) || primary.city || null
  return { source: config.source, company: config.companyName, companyCareerPage: config.careersUrl, atsPlatform: config.platform,
    jobId: id, requisitionId: String(job.requisition_id || id), title, location: primary.location, locations: eligible.map(location => location.location),
    city: city === 'India' ? null : city, state: primary.state || null, country: 'India', sourceUrl, applyUrl, link: applyUrl,
    jobDescription: description, experienceRequired: extractAshbyExperienceRequired({ title, jobDescription: description }), publicExperienceChecked: true,
    department: clean(job.department || job.departments?.[0]?.name) || null, employmentType: clean(job.employmentType) || null,
    postedAt: job.publishedAt || job.updated_at || null, remoteStatus: job.workplaceType || null, scrapedAt: new Date().toISOString() }
}
export const validateVerifiedAtsPayload = (payload, config) => {
  if (payload?.hasMore === true || payload?.nextCursor || payload?.nextPage) throw new Error('Incomplete ATS listing: unexpected pagination')
  if (config.platform === 'ashby') {
    if (payload?.apiVersion !== '1' || !Array.isArray(payload?.jobs)) throw new Error('Invalid Ashby response')
    ensureComplete(payload.jobs, payload.jobs.length, 'Ashby')
    for (const total of [payload.totalCount, payload.totalJobs, payload.meta?.total]) if (total !== undefined) ensureComplete(payload.jobs, total, 'Ashby')
  } else ensureComplete(payload?.jobs, payload?.meta?.total, 'Greenhouse')
  const nonVacancies = new Map((config.excludedNonVacancies || []).map(rule => [rule.id, rule]))
  const parsed = payload.jobs.map(job => {
    const id = String(job?.id ?? '')
    if (config.platform === 'ashby' ? !GUID.test(id) : !/^\d+$/.test(id) || Number(id) <= 0) throw new Error('Invalid ATS job identity')
    const title = required(job.title, 'title')
    const description = required(config.platform === 'ashby' ? job.descriptionHtml || job.descriptionPlain : job.content, 'description')
    if (!visibleText(description)) throw new Error('Invalid ATS record: empty description')
    const sourceUrl = validateRoleUrl(config.platform === 'ashby' ? job.jobUrl : job.absolute_url, id, config)
    const applyUrl = config.platform === 'ashby' ? validateRoleUrl(job.applyUrl, id, config, true) : sourceUrl
    const exclusion = nonVacancies.get(id)
    if (exclusion) {
      const location = required(job.location?.name, 'location')
      if (title !== clean(exclusion.title) || location !== clean(exclusion.location) || !exclusion.descriptionIncludes.every(signal => visibleText(description).includes(clean(signal)))) throw new Error('Invalid verified non-vacancy signature for ' + id)
      return { id, title, sourceUrl, location, output: null, excludedNonVacancy: true }
    }
    const locations = config.platform === 'ashby' ? ashbyLocations(job) : greenhouseLocations(job, config)
    if (config.platform === 'ashby' && typeof job.isListed !== 'boolean') throw new Error('Invalid Ashby listed status')
    return { id, title, sourceUrl, location: clean(job.location?.name), output: config.platform === 'ashby' && !job.isListed ? null : jobResult(job, id, title, description, locations, config, sourceUrl, applyUrl) }
  })
  return parsed
}

export const createVerifiedFirstPartyAtsScraper = config => {
  if (!['ashby', 'greenhouse'].includes(config.platform) || !/^[a-z0-9.-]+$/i.test(config.board) || !clean(config.source) || !clean(config.companyName)) throw new Error('Invalid verified ATS configuration')
  if (config.excludedNonVacancies !== undefined) {
    if (config.platform !== 'greenhouse' || !Array.isArray(config.excludedNonVacancies) || config.excludedNonVacancies.some(rule => !rule || typeof rule.id !== 'string' || !/^[1-9][0-9]*$/.test(rule.id) || !clean(rule.title) || !clean(rule.location) || !Array.isArray(rule.descriptionIncludes) || !rule.descriptionIncludes.length || rule.descriptionIncludes.some(signal => !clean(signal))) || new Set(config.excludedNonVacancies.map(rule => rule.id)).size !== config.excludedNonVacancies.length) throw new Error('Invalid verified non-vacancy configuration')
  }
  if (config.greenhouseVerifyClosedLinkedJobIds !== undefined && (config.greenhouseVerifyClosedLinkedJobIds !== true || config.platform !== 'greenhouse' || config.greenhouseEmbeddedBoardJobIds !== true || config.officialJobsApiPath || config.greenhouseEmbeddedApiUrl || config.greenhouseEmbeddedJobIds)) throw new Error('Invalid Greenhouse closed-link configuration')
  const careersUrl = strictUrl(config.careersUrl)
  if (config.greenhouseEmbeddedApiUrl && (config.platform !== 'greenhouse' || config.greenhouseEmbeddedApiUrl !== 'https://boards-api.greenhouse.io/v1/boards/' + config.board + '/departments')) throw new Error('Invalid Greenhouse embedded API configuration identity')
  if ((config.greenhouseEmbeddedJobIds || config.greenhouseEmbeddedBoardJobIds) && config.platform !== 'greenhouse') throw new Error('Invalid Greenhouse embedded ID configuration')
  if (config.greenhouseFirstPartyJobPath) {
    const jobPath = new URL(config.greenhouseFirstPartyJobPath, careersUrl)
    const boardLink = config.handoffType !== 'script' && ['https://boards.greenhouse.io/', 'https://job-boards.greenhouse.io/'].some(origin => config.handoffUrl === origin + config.board || config.handoffUrl === origin + config.board + '/')
    const boardScript = config.handoffType === 'script' && config.handoffUrl === 'https://boards.greenhouse.io/embed/job_board/js?for=' + config.board
    if (config.platform !== 'greenhouse' || jobPath.origin !== careersUrl.origin || jobPath.pathname !== config.greenhouseFirstPartyJobPath || jobPath.search || jobPath.hash || !(boardLink || boardScript)) throw new Error('Invalid Greenhouse first-party role configuration identity')
  }
  const timeoutMs = config.requestTimeoutMs ?? 15000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid verified ATS request deadline')
  const apiUrl = config.platform === 'ashby' ? 'https://api.ashbyhq.com/posting-api/job-board/' + config.board : 'https://boards-api.greenhouse.io/v1/boards/' + config.board + '/jobs?content=true'
  return { async run({ signal, fetchImpl = fetch } = {}) {
    signal?.throwIfAborted()
    const request = async (url, json = false, requireJobNotFound = false) => {
      signal?.throwIfAborted()
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
      try {
        const response = await fetchImpl(url, { signal: requestSignal, headers: { 'User-Agent': 'JobverifyScraper/1.0', Accept: json ? 'application/json' : 'text/html,application/javascript' } })
        signal?.throwIfAborted(); requestSignal.throwIfAborted()
        if (!response.ok && !(requireJobNotFound && response.status === 404)) { const error = new Error('HTTP ' + response.status + ' for ' + url); error.status = response.status; throw error }
        if (response.url && comparableUrl(response.url) !== comparableUrl(url)) throw new Error('Invalid ATS redirect identity for ' + url)
        const body = json ? await response.json() : await response.text()
        signal?.throwIfAborted(); requestSignal.throwIfAborted()
        if (requireJobNotFound && (response.status !== 404 || body?.status !== 404 || body?.error !== 'Job not found')) throw new Error('Invalid Greenhouse closed linked job response')
        return body
      } catch (error) { signal?.throwIfAborted(); requestSignal.throwIfAborted(); throw error }
    }
    const html = await request(config.careersUrl)
    if (config.handoffUrl) verifyHandoffLink(html, config)
    let officialJobs = null, officialIds = null
    if (config.officialJobsApiPath) {
      const scriptPattern = new RegExp(config.careersScriptPathPattern)
      const scripts = [...new Set(attributes(String(html).replace(/<!--[\s\S]*?-->/g, ''), 'script', 'src').map(src => { try { return new URL(src, careersUrl).href } catch { return null } }).filter(Boolean))]
        .filter(src => { const url = strictUrl(src); return url.origin === careersUrl.origin && !url.search && scriptPattern.test(url.pathname) })
      if (scripts.length !== 1) throw new Error('Official careers script handoff changed for ' + config.source)
      const script = await request(scripts[0])
      const fetchPattern = new RegExp('fetch\\(\\s*["\']' + escapeRegex(config.officialJobsApiPath) + '["\']')
      if (!fetchPattern.test(script) || !script.includes('https://job-boards.greenhouse.io/' + config.board + '/jobs/')) throw new Error('Official careers API handoff changed for ' + config.source)
      const officialUrl = new URL(config.officialJobsApiPath, careersUrl)
      if (officialUrl.origin !== careersUrl.origin) throw new Error('Invalid official careers API origin')
      const official = await request(officialUrl.href, true)
      if (!Array.isArray(official?.departments) || official.departments.some(department => !Array.isArray(department?.jobs))) throw new Error('Invalid official careers departments')
      officialJobs = official.departments.flatMap(department => department.jobs)
      ensureComplete(officialJobs, official.totalJobs, 'official careers')
      for (const job of officialJobs) { required(job?.title, 'official title'); required(job?.location?.name, 'official location'); validateRoleUrl(job.absolute_url, String(job.id), config) }
      officialIds = officialJobs.map(job => String(job.id))
    } else if (config.greenhouseEmbeddedApiUrl) {
      const scripts = [...String(html).replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1])
      const literalPattern = new RegExp('(["\'])' + escapeRegex(config.greenhouseEmbeddedApiUrl) + '\\1')
      if (!scripts.some(script => literalPattern.test(script))) throw new Error('Official careers embedded API handoff changed for ' + config.source)
    } else if (config.greenhouseEmbeddedBoardJobIds) {
      officialIds = [...new Set(attributes(documentHtml(html), 'a', 'href').flatMap(href => {
        try {
          const url = strictUrl(new URL(href, careersUrl).href)
          const match = url.pathname.match(new RegExp('^/' + escapeRegex(config.board) + '/jobs/([1-9][0-9]*)$'))
          return ['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(url.hostname) && !url.port && !url.search && match ? [match[1]] : []
        } catch { return [] }
      }))]
      if (!officialIds.length) throw new Error('Official careers board job-ID handoff is missing')
    } else if (config.greenhouseEmbeddedJobIds) {
      const { listingPath } = config.greenhouseEmbeddedJobIds
      officialIds = [...new Set(attributes(documentHtml(html), 'a', 'href').flatMap(href => {
        try { const url = new URL(href, careersUrl); return url.origin === careersUrl.origin && url.pathname === listingPath && /^\d+$/.test(url.searchParams.get('gh_jid') || '') && [...url.searchParams.keys()].length === 1 ? [url.searchParams.get('gh_jid')] : [] } catch { return [] }
      }))]
      if (!officialIds.length) throw new Error('Official careers job-ID handoff is missing')
    } else if (!config.handoffUrl) throw new Error('Official careers handoff configuration is missing')
    const payload = await request(apiUrl, true)
    const parsed = validateVerifiedAtsPayload(payload, config)
    if (config.greenhouseVerifyClosedLinkedJobIds) {
      const apiIds = new Set(parsed.map(job => job.id))
      if (parsed.some(job => !officialIds.includes(job.id))) throw new Error('Incomplete official careers / ATS identity parity')
      const unlistedIds = officialIds.filter(id => !apiIds.has(id))
      if (unlistedIds.length > 5) throw new Error('Incomplete official careers / ATS identity parity: closed-link limit exceeded')
      for (const id of unlistedIds) await request('https://boards-api.greenhouse.io/v1/boards/' + config.board + '/jobs/' + id, true, true)
      officialIds = officialIds.filter(id => apiIds.has(id))
    }
    if (officialIds && !exactIds(officialIds, parsed.map(job => job.id))) throw new Error('Incomplete official careers / ATS identity parity')
    if (officialJobs && officialJobs.some(job => { const ats = parsed.find(item => item.id === String(job.id)); return !sameText(job.title, ats.title) || !sameText(job.location.name, ats.location) || validateRoleUrl(job.absolute_url, String(job.id), config) !== ats.sourceUrl })) throw new Error('Invalid official careers / ATS title, location or URL identity parity')
    signal?.throwIfAborted()
    return parsed.map(job => job.output).filter(Boolean)
  } }
}
