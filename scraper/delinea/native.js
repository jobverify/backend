import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'
import { decode, text, visibleText, readAppData, readSchemas, qualificationSections } from './nativeHtml.js'
import { createDelineaPublicReader } from './publicRead.js'

const config = loadConfig(path.dirname(fileURLToPath(import.meta.url)))
export const SOURCE = 'delinea'
export const COMPANY = 'Delinea'
export const VERIFIED_ON = '2026-10-27'
export const CAREERS_PAGE_URL = 'https://delinea.com/careers'
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/delinea'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/delinea'
const fail = message => { throw new Error(message) }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
// Explicit real country names/codes supported by the current employer surface.
// New or regional labels stay unresolved until their country meaning is proven.
const COUNTRY_ALIASES = Object.freeze({ in: 'India', ind: 'India', india: 'India', us: 'United States', usa: 'United States', 'united states': 'United States', gb: 'United Kingdom', gbr: 'United Kingdom', uk: 'United Kingdom', 'united kingdom': 'United Kingdom', ae: 'United Arab Emirates', are: 'United Arab Emirates', uae: 'United Arab Emirates', 'united arab emirates': 'United Arab Emirates', sg: 'Singapore', sgp: 'Singapore', singapore: 'Singapore', it: 'Italy', ita: 'Italy', italy: 'Italy', mx: 'Mexico', mex: 'Mexico', mexico: 'Mexico', de: 'Germany', deu: 'Germany', germany: 'Germany', ph: 'Philippines', phl: 'Philippines', philippines: 'Philippines' })
const country = value => COUNTRY_ALIASES[text(value).toLowerCase()] || null
const address = value => value?.postalAddress || value || {}
const addressSignature = value => { const a = address(value); return [text(a.addressLocality), text(a.addressRegion), country(a.addressCountry)] }
const locations = job => [{ location: job.location, address: address(job.address) }, ...(job.secondaryLocations || []).map(l => ({ location: l.location, address: address(l.address) }))]
const locationNames = job => locations(job).map(l => text(l.location)).sort()
const validOrganization = org => org?.name === COMPANY && org.hostedJobsPageSlug === SOURCE && new URL(org.publicWebsite).hostname === 'delinea.com' && Boolean(org.organizationId)

export const careersChannels = html => {
  const channels = new Set(); const locales = new Set()
  for (const m of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u; try { u = new URL(decode(m[1]), CAREERS_PAGE_URL) } catch { continue }
    if (u.hostname === 'delinea.com' && /^\/(?:de|es|fr|pt)\/careers\/?$/.test(u.pathname)) locales.add(u.href)
    if (u.protocol !== 'https:' || u.username || u.password) continue
    if (u.hostname === 'jobs.ashbyhq.com' || /(?:^|\.)myworkdayjobs\.com$/.test(u.hostname) || (/apply today|we['’]?re hiring|join (?:the )?team/i.test(visibleText(m[2])) && u.hostname !== 'delinea.com')) channels.add(u.hostname === 'jobs.ashbyhq.com' ? u.href.replace(/\/$/, '') : u.href)
  }
  return { channels: [...channels].sort(), locales: [...locales].sort() }
}
export const hasVerifiedCareersSignal = html => careersChannels(html).channels.includes(ASHBY_PUBLIC_BOARD_URL) && /delinea/i.test(visibleText(html))
const denial = error => [401, 403, 429].includes(error?.status) || /HTTP (?:401|403|429)|access denied|verify you are human|captcha|bot challenge/i.test(error?.message || '')
const validPostingUrls = job => {
  try {
    const role = new URL(job.jobUrl); const apply = new URL(job.applyUrl)
    return role.origin === 'https://jobs.ashbyhq.com' && role.pathname === `/delinea/${job.id}` && !role.search && !role.hash
      && apply.origin === role.origin && apply.pathname === `${role.pathname}/application` && !apply.search && !apply.hash
  } catch { return false }
}
const boardSnapshot = html => {
  const data = readAppData(html)
  if (!validOrganization(data.organization) || !Array.isArray(data.jobBoard?.jobPostings)) fail('Invalid Delinea native employer/board')
  const jobs = data.jobBoard.jobPostings
  if (jobs.some(j => !j.id || !j.title || !j.locationName || !Array.isArray(j.secondaryLocations)) || new Set(jobs.map(j => j.id)).size !== jobs.length) fail('Invalid or duplicate Delinea native posting identity')
  return { organization: { id: data.organization.organizationId, name: data.organization.name, slug: data.organization.hostedJobsPageSlug }, jobs }
}
const stableBoard = board => board.jobs.map(j => ({ id: j.id, title: j.title, locationName: j.locationName, secondaryLocations: j.secondaryLocations, employmentType: j.employmentType, workplaceType: j.workplaceType })).sort((a, b) => a.id.localeCompare(b.id))
const feedSnapshot = feed => {
  if (!Array.isArray(feed?.jobs)) fail('Verified Delinea Ashby payload changed materially')
  if (feed.jobs.some(j => !j.id) || new Set(feed.jobs.map(j => j.id)).size !== feed.jobs.length) fail('Duplicate/missing Delinea feed identity')
  return feed.jobs.filter(j => j.isListed === true)
}
const stableFeed = jobs => jobs.map(j => ({ id: j.id, title: j.title, locations: locations(j), publishedAt: j.publishedAt, employmentType: j.employmentType, workplaceType: j.workplaceType, jobUrl: j.jobUrl, applyUrl: j.applyUrl, descriptionHtml: j.descriptionHtml, descriptionPlain: j.descriptionPlain })).sort((a, b) => a.id.localeCompare(b.id))

export const extractAshbyJobs = (payload = {}) => (payload.jobs || []).filter(j => j.isListed === true).flatMap(job => {
  const selected = locations(job).find(l => country(l.address.addressCountry) === 'India')
  if (!selected || !job.id || !job.title || !validPostingUrls(job)) return []
  return [{ title: text(job.title), company: COMPANY, department: text(job.department) || null, team: text(job.team) || null,
    location: text(selected.location), city: text(selected.address.addressLocality) || null, state: text(selected.address.addressRegion) || null, country: 'India',
    jobId: text(job.id), requisitionId: null, sourceUrl: job.jobUrl, applyUrl: job.applyUrl, employmentType: text(job.employmentType).replace(/([a-z])([A-Z])/g, '$1 $2') || null,
    postingDate: text(job.publishedAt) || null, closingDate: null, jobDescription: visibleText(job.descriptionHtml) || text(job.descriptionPlain),
    descriptionHtml: job.descriptionHtml || null, remoteStatus: job.workplaceType || (job.isRemote === true ? 'Remote' : null) }]
})

const extractDetail = (job, brief, board, html) => {
  const data = readAppData(html); const posting = data.posting; const schemas = readSchemas(html)
  if (!validOrganization(data.organization) || data.organization.organizationId !== board.organization.id || !posting || schemas.length !== 1) fail(`Missing/wrong native employer or detail for ${job.id}`)
  const schema = schemas[0]
  if (posting.id !== job.id || schema.identifier?.value !== job.id || schema.identifier?.name !== COMPANY || schema.hiringOrganization?.name !== COMPANY || new URL(schema.hiringOrganization?.sameAs).hostname !== 'delinea.com') fail(`Native employer/posting mismatch for ${job.id}`)
  if (posting.isListed !== true || posting.isConfidential === true || !validPostingUrls(job) || !same([posting.title, brief.title, schema.title], [job.title, job.title, job.title])) fail(`Native publication/identity mismatch for ${job.id}`)
  const nativeLocations = [posting.locationName, ...(posting.secondaryLocationNames || [])].map(text).sort()
  const boardLocations = [brief.locationName, ...brief.secondaryLocations.map(l => l.locationName)].map(text).sort()
  if (!same(locationNames(job), nativeLocations) || !same(nativeLocations, boardLocations)) fail(`Native location mismatch for ${job.id}`)
  const locs = locations(job)
  const feedAddressSignatures = locs.map(l => addressSignature(l.address))
  const schemaLocations = (Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]).map(l => addressSignature(l?.address))
  // Structured data may omit native secondary locations, but every address it
  // publishes must match a role-owned feed address, including locality/region.
  if (locs.some(l => !country(l.address.addressCountry)) || schemaLocations.some(a => !a[2] || !feedAddressSignatures.some(f => same(a, f))) || !schemaLocations.some(a => same(a, feedAddressSignatures[0]))) fail(`Missing/conflicting native country for ${job.id}`)
  if (locs.some(l => /\bindia\b/i.test(l.location) && country(l.address.addressCountry) !== 'India')) fail(`Conflicting India country for ${job.id}`)
  if (!job.descriptionHtml || posting.descriptionHtml !== job.descriptionHtml || !visibleText(posting.descriptionHtml)) fail(`Incomplete native description for ${job.id}`)
  if (schema.description && visibleText(schema.description) !== visibleText(posting.descriptionHtml)) fail(`Native schema criteria mismatch for ${job.id}`)
  if (!job.publishedAt || !Number.isFinite(Date.parse(job.publishedAt)) || schema.datePosted !== job.publishedAt.slice(0, 10)) fail(`Native original publication mismatch for ${job.id}`)
  if (posting.employmentType !== job.employmentType || posting.workplaceType !== job.workplaceType || brief.employmentType !== job.employmentType || brief.workplaceType !== job.workplaceType) fail(`Native employment/workplace mismatch for ${job.id}`)
  const deadline = posting.applicationDeadline
  if (deadline != null && (typeof deadline !== 'string' || !Number.isFinite(Date.parse(deadline)))) fail(`Unknown native deadline precision for ${job.id}`)
  const nativeFields = Object.fromEntries(['departmentName','departmentExternalName','teamNames','locationName','locationAddress','secondaryLocationNames','workplaceType','employmentType','applicationDeadline','compensationTierSummary','compensationTiers','compensationTierGuideUrl','scrapeableCompensationSalarySummary','compensationPhilosophyHtml','applicationLimitCalloutHtml'].map(k => [k, posting[k] ?? null]))
  const fullDescription = text([visibleText(posting.descriptionHtml), visibleText(posting.compensationPhilosophyHtml), visibleText(posting.applicationLimitCalloutHtml)].filter(Boolean).join(' '))
  const base = extractAshbyJobs({ jobs: [job] })[0]
  return { ...(base || { title: job.title, company: COMPANY, jobId: job.id, requisitionId: null, sourceUrl: job.jobUrl, applyUrl: job.applyUrl, postingDate: job.publishedAt }),
    closingDate: deadline ?? null, jobDescription: fullDescription, descriptionHtml: job.descriptionHtml,
    ...qualificationSections(job.descriptionHtml), nativeFields, nativeLocations: locs.map(l => ({ location: l.location, ...l.address, country: country(l.address.addressCountry) })),
    experienceRequired: extractAshbyExperienceRequired({ title: job.title, jobDescription: fullDescription }), isIndia: Boolean(base) }
}

export const createDelineaScraper = ({ maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null, now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText, fetchJson, signal, onNativeAudit, fetchImpl, transport, onNativeResponse } = {}) {
    const reader = createDelineaPublicReader({ fetchText, fetchJson, signal, fetchImpl, transport, onNativeResponse })
    try {
    const getText = url => reader.readText(url)
    const getJson = url => reader.readJson(url)
    const issues = []; const rows = []
    const additionalChannelChecks = []
    const inspectAdditionalChannel = async (url, phase) => {
      try {
        const body = await getText(url)
        let payload; try { payload = JSON.parse(body) } catch { /* no proven inventory protocol */ }
        const outcome = payload?.widget === 'redirect' && new URL(payload.url, url).href === url ? 'self-redirect-without-inventory' : 'unparsed-advertised-channel'
        additionalChannelChecks.push({ url, phase, outcome })
        issues.push(`unresolved-advertised-channel:${url}:${outcome}`)
      } catch (e) { if (denial(e) || signal?.aborted) throw e; additionalChannelChecks.push({ url, phase, outcome: 'failed', reason: e.message }); issues.push(`advertised-channel-failed:${url}`) }
    }
    const openingCareers = await getText(CAREERS_PAGE_URL)
    if (!hasVerifiedCareersSignal(openingCareers)) fail('Verified Delinea careers page changed materially')
    const openingChannels = careersChannels(openingCareers)
    const localizedChannels = {}
    if (!same(openingChannels.channels, [ASHBY_PUBLIC_BOARD_URL])) issues.push('additional-advertised-hiring-channel')
    for (const locale of openingChannels.locales) {
      try { localizedChannels[locale] = careersChannels(await getText(locale)).channels; if (!same(localizedChannels[locale], [ASHBY_PUBLIC_BOARD_URL])) issues.push(`unreconciled-localized-channel:${locale}`) }
      catch (e) { if (denial(e)) throw e; issues.push(`localized-channel-failed:${locale}`) }
    }
    const advertisedChannels = [...new Set([...openingChannels.channels, ...Object.values(localizedChannels).flat()])].sort()
    for (const channel of advertisedChannels.filter(url => url !== ASHBY_PUBLIC_BOARD_URL)) await inspectAdditionalChannel(channel, 'opening')
    const opening = boardSnapshot(await getText(ASHBY_PUBLIC_BOARD_URL))
    const originalNativeFeed = await getJson(ASHBY_JOB_BOARD_URL)
    const jobs = feedSnapshot(originalNativeFeed)
    if (!same(opening.jobs.map(j => j.id).sort(), jobs.map(j => j.id).sort())) issues.push('opening-board-feed-identity-mismatch')
    for (const job of jobs) {
      const brief = opening.jobs.find(j => j.id === job.id)
      if (!brief || !validPostingUrls(job)) { issues.push(`missing-native-brief-or-public-url:${job.id}`); continue }
      try { rows.push(extractDetail(job, brief, opening, await getText(job.jobUrl))) }
      catch (e) { if (denial(e) || signal?.aborted) throw e; issues.push(e.message); if (reader.limitExceeded) break }
    }
    let closing = null; let closingFeed = null; let closingChannels = null
    try {
      if (reader.limitExceeded) fail('cohort read budget exhausted before closing inventory')
      closing = boardSnapshot(await getText(ASHBY_PUBLIC_BOARD_URL))
      closingFeed = feedSnapshot(await getJson(ASHBY_JOB_BOARD_URL))
      closingChannels = careersChannels(await getText(CAREERS_PAGE_URL))
      if (!same(opening.organization, closing.organization) || !same(stableBoard(opening), stableBoard(closing)) || !same(stableFeed(jobs), stableFeed(closingFeed))) issues.push('closing-inventory-or-criteria-changed')
      if (!same(openingChannels, closingChannels) || !same(closingChannels.channels, [ASHBY_PUBLIC_BOARD_URL])) issues.push('closing-hiring-channel-changed')
      for (const locale of openingChannels.locales) {
        if (!same(localizedChannels[locale], careersChannels(await getText(locale)).channels)) issues.push(`closing-localized-channel-changed:${locale}`)
      }
      for (const channel of advertisedChannels.filter(url => url !== ASHBY_PUBLIC_BOARD_URL)) await inspectAdditionalChannel(channel, 'closing')
    } catch (e) { if (denial(e) || signal?.aborted) throw e; issues.push(`closing-inventory-failed:${e.message}`) }
    const indiaRows = rows.filter(r => r.isIndia)
    const cap = Number.isInteger(maxJobs) && maxJobs >= 0 && indiaRows.length > maxJobs
    if (cap) issues.push('output-cap')
    const complete = issues.length === 0 && rows.length === jobs.length
    const scrapedAt = reader.observedAt || now()
    const pagesFetched = reader.audit.requests
    const result = (cap ? indiaRows.slice(0, maxJobs) : indiaRows).map(({ isIndia, ...job }) => ({ ...job, source: SOURCE, link: job.applyUrl, scrapedAt, sourceListingComplete: complete,
      ...(!complete ? { sourceScopeComplete: false, lifecycleCleanupAllowed: false } : {}) }))
    const audit = { source: SOURCE, verifiedAt: scrapedAt, complete, issues, advertisedChannels, additionalChannelChecks, openingChannels, localizedChannels, closingChannels, opening: { organization: opening.organization, ids: opening.jobs.map(j => j.id).sort() }, closing: closing && { organization: closing.organization, ids: closing.jobs.map(j => j.id).sort() }, originalNativeFeed, nativeCount: jobs.length, fullyHealthyCount: rows.length, indiaCount: indiaRows.length, eligibleCount: result.length, pagesFetched, rows, publicRead: reader.audit }
    onNativeAudit?.(audit)
    signal?.throwIfAborted()
    attachSourceObservationEvidence(result, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: jobs.length, observedVacancyCount: jobs.length, sourceScopeComplete: false })
    return attachInventoryEvidence(result, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: ASHBY_PUBLIC_BOARD_URL, firstParty: true, listingComplete: complete, pagesFetched,
      reportedTotal: complete ? jobs.length : null, indiaFacetCount: complete ? indiaRows.length : null, verifiedAt: scrapedAt,
      reason: complete ? 'native-board-feed-all-details-and-closing-inventory-reconciled' : [...new Set(issues)].join('; ') || 'incomplete-native-details' })
    } finally { reader.dispose() }
  },
})
export const run = async (options = {}) => createDelineaScraper(options).run(options)
