import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

export const PROFILE_URL = 'https://www.linkedin.com/company/baazi-games'
export const JOBS_URL = 'https://www.linkedin.com/jobs/baazi-games-jobs-worldwide?f_C=14573181&trk=top-card_top-card-primary-button-top-card-primary-cta'
const COMPANY = 'Baazi Games', SOURCE = 'baazigames'
const subsetContractError = message => Object.assign(new Error('Baazi Games employer LinkedIn subset: ' + message), {
  abortRetries: true, failureKind: 'incomplete_listing', primaryInventoryUnavailable: 'Baazi Games public site is unavailable; current job inventory is unavailable',
})
const uncomment = html => String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')
const visiblePage = html => uncomment(html).replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, '')
const attr = (tag, name) => decodeHtmlEntities(tag.match(new RegExp('\\b' + name + '=["\\x27]([^"\\x27]*)["\\x27]', 'i'))?.[1])
const canonical = html => {
  const links = [...visiblePage(html).matchAll(/<link\b[^>]*>/gi)].filter(m => attr(m[0], 'rel') === 'canonical')
  return links.length === 1 ? attr(links[0][0], 'href') : null
}
const hasActiveNativeApply = page => {
  const buttons = [...visiblePage(page).matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi)]
    .filter(m => attr(m[0], 'id') === 'topbar-apply')
  return buttons.length === 1 && attr(buttons[0][0], 'data-modal') === 'job-details-subnav-apply-modal'
    && attr(buttons[0][0], 'data-tracking-control-name') === 'public_jobs_contextual-sign-in-modal_ssr-ui-lib-outlet-button'
    && !/\bdisabled(?:\s|=|>)/i.test(buttons[0][0].split('>')[0]) && stripTags(buttons[0][0]) === 'Apply'
}
const readProfile = html => {
  const page = visiblePage(html)
  if (!['https://in.linkedin.com/company/baazi-games', PROFILE_URL].includes(canonical(page))
    || !/<title>\s*Baazi Games\s*\|\s*LinkedIn\s*<\/title>/i.test(page)) throw subsetContractError('employer profile identity changed')
  const anchors = [...page.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(m => m[0])
  const websites = anchors.filter(a => attr(a, 'data-tracking-control-name') === 'about_website')
  try {
    if (websites.length !== 1) throw new Error()
    const anchor = websites[0], wrapper = new URL(attr(anchor, 'href'))
    if (wrapper.protocol !== 'https:' || wrapper.hostname !== 'www.linkedin.com' || wrapper.pathname !== '/redir/redirect'
      || wrapper.username || wrapper.password || wrapper.port || wrapper.hash
      || wrapper.searchParams.getAll('url').length !== 1 || wrapper.searchParams.get('url') !== 'http://baazigames.com'
      || ![...wrapper.searchParams.keys()].every(k => ['url', 'urlhash', 'trk'].includes(k))
      || stripTags(anchor) !== 'http://baazigames.com') throw new Error()
  } catch { throw subsetContractError('current native employer domain binding changed') }
  const handoffs = anchors.filter(a => attr(a, 'data-tracking-control-name') === 'top-card_top-card-primary-button-top-card-primary-cta')
  if (handoffs.length !== 1 || attr(handoffs[0], 'href') !== JOBS_URL || stripTags(handoffs[0]) !== 'See jobs') {
    throw subsetContractError('published employer company-ID search handoff changed')
  }
}
const readCards = html => {
  const page = visiblePage(html)
  const count = page.match(/<title>\s*Baazi Games Jobs at Baazi Games in Worldwide \((\d+) Open Roles\) \| LinkedIn\s*<\/title>/)?.[1]
    ?? page.match(/<title>\s*(\d+) Baazi Games jobs in Worldwide\s*<\/title>/)?.[1]
  if (canonical(page) !== JOBS_URL.split('?')[0] || !count || Number(count) > 100
    || !stripTags(page).includes("You've viewed all jobs for this search")) throw subsetContractError('published search identity or bounded terminal inventory changed')
  const starts = [...page.matchAll(/<div\b[^>]*data-entity-urn=["']urn:li:jobPosting:(\d+)["'][^>]*>/gi)]
  if (!starts.length || starts.length !== Number(count)) throw subsetContractError('native visible card count does not reconcile')
  const seen = new Set()
  return starts.map((start, index) => {
    const block = page.slice(start.index, starts[index + 1]?.index ?? page.length), id = start[1]
    const anchors = [...block.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(m => m[0])
    const link = anchors.filter(a => attr(a, 'data-tracking-control-name') === 'public_jobs_jserp-result_search-card')
    const employer = anchors.filter(a => attr(a, 'data-tracking-control-name') === 'public_jobs_jserp-result_job-search-card-subtitle')
    const sourceUrl = link.length === 1 ? canonicalLinkedInJobUrl(attr(link[0], 'href'), id) : null
    const title = stripTags(block.match(/<h3\b[^>]*class=["'][^"']*\bbase-search-card__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const location = stripTags(block.match(/<span\b[^>]*class=["'][^"']*\bjob-search-card__location\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1])
    const postingDate = block.match(/<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})["']/i)?.[1]
    if (!sourceUrl || !title || !location || !postingDate || !Number.isFinite(Date.parse(postingDate)) || seen.has(id)
      || employer.length !== 1 || !isLinkedInEmployerUrl(attr(employer[0], 'href')) || stripTags(employer[0]) !== COMPANY) {
      throw subsetContractError('malformed, duplicate, or foreign employer card')
    }
    seen.add(id)
    return {id, sourceUrl, title, location, postingDate}
  })
}
const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const isLinkedInEmployerUrl = value => {
  try {
    const url = new URL(decodeHtmlEntities(value))
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
      && /^\/company\/baazi-games\/?$/.test(url.pathname)
      && [...url.searchParams.keys()].every(key => key === 'trk') && !url.hash
  } catch { return false }
}

const canonicalLinkedInJobUrl = (value, id) => {
  try {
    const url = new URL(decodeHtmlEntities(value))
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
      || !['www.linkedin.com', 'in.linkedin.com', 'uk.linkedin.com'].includes(url.hostname)
      || !new RegExp('^/jobs/view/[a-z0-9-]+-' + id + '$').test(url.pathname)
      || ![...url.searchParams.keys()].every(key => ['refId', 'trackingId', 'trk', 'position', 'pageNum'].includes(key))) return null
    url.search = ''
    return url.href
  } catch { return null }
}

const refineDelhiWorkplace = (job, location, jdHtml, workplaces) => {
  const address = job.jobLocation.address
  if (address.addressLocality !== 'Delhi' || !['IN', 'India'].includes(address.addressCountry)
    || (address.addressRegion != null && address.addressRegion !== 'Delhi')
    || !['Delhi, India', 'Delhi, Delhi, India'].includes(location)
    || workplaces.length !== 1 || workplaces[0] !== 'New Delhi') return null
  // New Delhi is contained within Delhi; this is deliberately one-way. The
  // native IN country and matching card/schema Delhi context are required.
  // Keep the coarser native address and coordinates alongside the precise JD.
  if (/<(?:style|link)\b/i.test(jdHtml)) throw subsetContractError('unreviewed JD workplace visibility')
  const document = readNativeDocument(jdHtml), blocks = new Set(['div', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
  const hasBlock = node => node.children.some(child => typeof child !== 'string' && !child.inert && (blocks.has(child.tag) || hasBlock(child)))
  const headers = document.nodes(node => blocks.has(node.tag) && !hasBlock(node))
    .filter(node => /^(?:(?:Job\s+|Work\s+)?Location)\s*:/i.test(document.text(node)))
  const presentation = node => Object.hasOwn(node.attrs, 'class') || Object.hasOwn(node.attrs, 'style') || Object.hasOwn(node.attrs, 'id')
    || node.children.some(child => typeof child !== 'string' && !child.inert && presentation(child))
  if (headers.length !== 1 || !/^(?:Job\s+|Work\s+)?Location\s*:\s*New Delhi$/i.test(document.text(headers[0])) || presentation(headers[0])) {
    throw subsetContractError('missing active explicit JD workplace refinement proof')
  }
  return {
    location: 'New Delhi, Delhi, India', city: 'New Delhi', state: 'Delhi',
    evidence: { kind: 'native-jd-workplace-refinement', listingLocation: location, schemaAddress: { ...address },
      schemaLocation: job.jobLocation, jdWorkplaces: workplaces, country: 'India',
      relationship: 'New Delhi within Delhi; no reverse city substitution', referenceUrl: 'https://dmnewdelhi.delhi.gov.in/' },
  }
}

const readLinkedInIndiaDetail = (html, card, checkedAt) => {
  const idAware = String(html ?? '').replace(/(<code\b[^>]*id=["']decoratedJobPostingId["'][^>]*>)\s*<!--("\d+")-->\s*(<\/code>)/gi, '$1$2$3')
  const native = uncomment(idAware), page = visiblePage(idAware)
  const idCodes = [...page.matchAll(/<code\b[^>]*id=["']decoratedJobPostingId["'][^>]*>\s*"(\d+)"\s*<\/code>/gi)]
  if (idCodes.length !== 1 || idCodes[0][1] !== card.id) throw subsetContractError('active native job ID does not match current card')
  const canonical = page.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
  const title = stripTags(page.match(/<h1\b[^>]*class=["'][^"']*\btop-card-layout__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const location = stripTags(page.match(/<span\b[^>]*class=["'][^"']*\btopcard__flavor--bullet\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1])
  const employer = page.match(/<a\b[^>]*data-tracking-control-name=["']public_jobs_topcard-org-name["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
  const schemas = []
  for (const match of native.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data
    try { data = JSON.parse(match[1]) } catch { throw subsetContractError('malformed published job schema') }
    schemas.push(...(Array.isArray(data) ? data : [data]).filter(item => item?.['@type'] === 'JobPosting'))
  }
  const job = schemas[0]
  const address = job?.jobLocation?.address
  const description = stripTags(decodeHtmlEntities(job?.description))
  const visibleDescription = stripTags(page.match(/<div\b[^>]*class=["'][^"']*\bshow-more-less-html__markup\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
  if (schemas.length !== 1 || canonical !== card.sourceUrl || title !== card.title || job?.title !== card.title
    || !employer || !isLinkedInEmployerUrl(employer[1]) || stripTags(employer[2]) !== COMPANY
    || job?.hiringOrganization?.name !== COMPANY || !isLinkedInEmployerUrl(job?.hiringOrganization?.sameAs)) throw subsetContractError('job identity or employer does not match the current company card')
  const workplaceParts = (location || '').split(',').map(part => part.trim())
  const indianRegions = new Set([
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
    'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ])
  const visibleRegion = workplaceParts.length === 3 ? workplaceParts[1] : null
  if (location !== card.location || ![2, 3].includes(workplaceParts.length) || workplaceParts.at(-1) !== 'India'
    || (visibleRegion !== null && !indianRegions.has(visibleRegion))
    || [job.country, job.jobLocation?.country].some(country => country != null && !['IN', 'India'].includes(country))
    || !['IN', 'India'].includes(address?.addressCountry) || !address?.addressLocality
    || workplaceParts[0] !== address.addressLocality
    || (address.addressRegion != null && (!indianRegions.has(address.addressRegion) || address.addressRegion !== visibleRegion))) {
    throw subsetContractError('conflicting or unverified native India workplace country')
  }
  const jdHtml = decodeHtmlEntities(job.description)
  const jdLines = jdHtml.replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
  const workplaces = [...jdLines.matchAll(/(?:^|\n)\s*(?:Job\s+|Work\s+)?Location\s*:\s*[-–]?\s*([^\n]+)/gi)].map(m => normalizeWhitespace(m[1]))
  const allowedWorkplaces = [location, location.replace(/,\s*India$/i, ''), address.addressLocality, 'India']
  // Published JD uses this Delhi-region/hybrid label; country is independently explicit IN in the native schema.
  allowedWorkplaces.push(address.addressLocality + ' / Hybrid')
  if (['Delhi', 'New Delhi'].includes(address.addressLocality)) allowedWorkplaces.push('Delhi NCR | Hybrid')
  const refinement = refineDelhiWorkplace(job, location, jdHtml, workplaces)
  if (!refinement && workplaces.some(workplace => !allowedWorkplaces.includes(workplace))) {
    throw subsetContractError('conflicting explicit JD workplace: ' + workplaces.join('; '))
  }
  const posted = Date.parse(job.datePosted), closes = Date.parse(job.validThrough), now = Date.parse(checkedAt)
  if (!Number.isFinite(posted) || !Number.isFinite(closes) || !Number.isFinite(now)
    || posted > now || closes <= now || closes <= posted || job.datePosted.slice(0, 10) !== card.postingDate
    || /No longer accepting applications/i.test(stripTags(page) || '')
    || !hasActiveNativeApply(page)) throw subsetContractError('job is not a currently open native application')
  if (!description || description.length < 300 || description !== visibleDescription) throw subsetContractError('published job description is missing or conflicts with visible content')
  return {
    title: card.title, company: COMPANY, source: SOURCE, jobId: card.id, requisitionId: null,
    location: refinement?.location || location, city: refinement?.city || address.addressLocality, country: 'India', department: null,
    ...(refinement ? { state: refinement.state, sourceWorkplaceEvidence: refinement.evidence } : {}),
    sourceUrl: card.sourceUrl, applyUrl: card.sourceUrl, link: card.sourceUrl,
    employmentType: job.employmentType || null, postingDate: new Date(posted).toISOString(), closingDate: new Date(closes).toISOString(),
    jobDescription: description, requiredSkills: [], experienceRequired: null, minimumQualification: null, preferredQualification: null,
    sourceListingComplete: false, scrapedAt: checkedAt,
  }
}


export const runBaaziLinkedInSubset = async ({fetchPage, signal, now = () => new Date().toISOString()}) => {
  const read = async url => {
    signal?.throwIfAborted()
    const page = await fetchPage(url, {signal})
    signal?.throwIfAborted()
    if (page.status !== 200) throw Object.assign(subsetContractError('HTTP ' + page.status + ' at ' + url), {status: page.status})
    if (page.url !== url || typeof page.html !== 'string' || Buffer.byteLength(page.html) > 3 * 1024 * 1024) {
      throw subsetContractError('final authority or bounded native response changed')
    }
    return page.html
  }
  const profile = await read(PROFILE_URL)
  readProfile(profile)
  const cards = readCards(await read(JOBS_URL)), checkedAt = now(), jobs = []
  for (const card of cards) {
    // The one currently published European Union card has no India scope.
    if (!/,\s*India$/.test(card.location)) continue
    jobs.push(readLinkedInIndiaDetail(await read(card.sourceUrl), card, checkedAt))
  }
  if (!jobs.length) throw subsetContractError('no independently verified currently open India roles')
  const fingerprint = list => JSON.stringify(list.map(c => [c.id, c.title, c.sourceUrl, c.location, c.postingDate]))
  if (fingerprint(cards) !== fingerprint(readCards(await read(JOBS_URL)))) throw subsetContractError('employer listing changed during traversal')
  readProfile(await read(PROFILE_URL))
  return attachInventoryEvidence(jobs, {
    status: 'coverage-gap', firstParty: true, listingComplete: false, surface: JOBS_URL,
    pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
    reason: 'Primary public site unavailable (No Games Available at the Moment); current employer-bound LinkedIn search exposes '
      + cards.length + ' observed cards, including ' + jobs.length + ' independently verified India roles. Guest search is a partial employer inventory; global and India totals unknown. Published native Apply requires applicant sign-in; no external intake was accessed.',
  })
}
