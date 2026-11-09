import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { ActiveNativeContentError } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument, readNativeStatusLayout } from '../../scraper-support/utils/visibleNativeHtml.js'
import { readNativeStatusTextBlocks } from '../../scraper-support/utils/sourceAvailability.js'
import { readEightfoldLocationScope } from '../../scraper-support/apiPortal/eightfoldLocations.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { norm as nativeNorm, flow as nativeFlow, one as nativeOne, originalInner } from './currentHtml.js'
import { transport, cap, budget } from './currentTransport.js'
import { runNativeAnand } from './nativeCurrent.js'

export const SOURCE = 'anandengineeringproductspvtltd'
export const COMPANY_NAME = 'Anand Engineering Products Pvt Ltd.'
export const HOMEPAGE_URL = 'https://anandengg.in/'
export const CAREERS_URL = 'https://anandengg.in/open-positions/'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([a-f0-9]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")

const textFromHtml = (value) => decodeHtml(String(value ?? '')
  .replace(/<br\s*\/?\s*>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim()

export const hasHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Anand Engineering\s*\|\s*Heavy Steel Fabrication\s*&amp;\s*Manufacturing\s*<\/title>/i.test(page)
    && /href=["']https:\/\/anandengg\.in\/open-positions\/["']/i.test(page)
    && /admin@anandengg\.in/i.test(page)
    && /Thuvakudi/i.test(page)
}

const listingUrl = (page) => page === 1 ? CAREERS_URL : `${CAREERS_URL}${page}/`

export const parseListingPage = (html, page) => {
  const document = String(html ?? '')
  const expectedUrl = listingUrl(page)
  const canonical = document.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
  const anchor = document.match(/<div\b[^>]*class=["']e-load-more-anchor["'][^>]*data-page=["'](\d+)["'][^>]*data-max-page=["'](\d+)["']/i)
  if (!/<title>\s*Open Positions - Anand Engineering\s*<\/title>/i.test(document)
    || canonical !== CAREERS_URL
    || Number(anchor?.[1]) !== page
    || !Number.isInteger(Number(anchor?.[2]))
    || Number(anchor?.[2]) < page
    || Number(anchor?.[2]) > 100) {
    throw new Error(`Anand Engineering verified first-party listing changed: ${expectedUrl}`)
  }

  const cardRx = /<div\b(?=[^>]*data-elementor-type=["']loop-item["'])(?=[^>]*class=["'][^"']*\bjob-opening\b[^"']*["'])[^>]*>/gi
  const starts = [...document.matchAll(cardRx)]
  if (starts.length === 0) throw new Error(`Anand Engineering listing cards missing: ${expectedUrl}`)
  const cards = starts.map((match, index) => {
    const slice = document.slice(match.index, starts[index + 1]?.index ?? document.length)
    const jobId = match[0].match(/\bpost-(\d+)\b/)?.[1]
    const title = textFromHtml(slice.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
    const applyUrl = slice.match(/href=["'](https:\/\/anandengg\.in\/job-opening\/[a-z0-9-]+\/?)["']/i)?.[1]
    const cardText = textFromHtml(slice)
    const dateText = cardText.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i)?.[0]
    const postingDate = dateText ? new Date(`${dateText} GMT`).toISOString().slice(0, 10) : null
    const experienceRequired = cardText.match(/\b\d+\s*(?:[-–]\s*\d+)?\s+Years\b/i)?.[0] || null
    if (!jobId || !title || !applyUrl) throw new Error(`Anand Engineering first-party job link or card changed: ${expectedUrl}`)
    return { jobId, title, applyUrl, postingDate, experienceRequired }
  })
  return { cards, maxPage: Number(anchor[2]) }
}

// Country filters and company addresses cannot supply a vacancy's workplace.
// Use only explicit fields inside the bound role's visible JD container. The
// accepted opt-in reader withholds uncertain CSS/layout instead of resolving it.
const readRoleWorkplace = (html, card, descriptionHtml) => {
  const fields = []
  const result = (country = null, location = null, reason = 'role-workplace-unqualified') => ({
    country, location, city: null, state: null,
    nativeGeographyQualified: country !== null,
    rawNativeWorkplaceEvidence: {
      source: SOURCE, jobId: card.jobId, sourceUrl: card.applyUrl,
      descriptionHtml, fields, qualified: country !== null, reason,
    },
  })
  try {
    const document = readVisibleNativeDocument(html, { strict: true, statusLayout: true })
    const excluded = new Set(['footer', 'header', 'nav', 'aside', 'form', 'script', 'style', 'template', 'noscript', 'iframe', 'object'])
    const parents = new Map()
    const index = node => { for (const child of node.children) if (typeof child !== 'string') { parents.set(child, node); index(child) } }
    document.statusNodes(node => node.tag === 'root').forEach(index)
    const outsideRole = node => { for (; node; node = parents.get(node)) if (excluded.has(node.tag)) return true; return false }
    const titles = document.nodes(node => node.tag === 'h1' && !outsideRole(node))
    if (titles.length !== 1 || document.text(titles[0]) !== card.title) return result()
    const scopes = document.statusNodes(node => node.tag === 'div' && node.children.some(child =>
      typeof child !== 'string' && child.tag === 'h3' && document.text(child) === 'Job Description') && !outsideRole(node))
    if (scopes.length !== 1) return result()
    const scope = scopes[0]
    // Validate uncertainty before extracting fields, including conservatively
    // hidden contradictory fields. Definitely inert content stays excluded.
    readNativeStatusTextBlocks(scope)
    let malformedField = false
    const hasExcludedDescendant = node => node.children.some(child => typeof child !== 'string'
      && (excluded.has(child.tag) || hasExcludedDescendant(child)))
    const hasNestedBlock = node => node.children.some(child => typeof child !== 'string'
      && (readNativeStatusLayout(child)?.boundary === 'block' || hasNestedBlock(child)))
    const visit = node => {
      if (typeof node === 'string' || excluded.has(node.tag)) return
      const eligibleField = ['p', 'li', 'dd', 'td', 'div'].includes(node.tag) && !hasExcludedDescendant(node)
      const canOwnField = eligibleField && !hasNestedBlock(node)
      // Evaluate a complete accepted inline field as one block. Only wrappers
      // unable to own that block need raw empty-label fragments as a blocker;
      // those fragments never establish positive country evidence.
      if (!canOwnField) for (const child of node.children) if (typeof child === 'string') {
        const ownBlocks = readNativeStatusTextBlocks({ tag: 'span', children: [child] })
        if (ownBlocks.some(block => /^(?:(?:Job|Work)\s+)?(?:Location|Country)\s*:\s*$/i.test(block))) malformedField = true
      }
      // A wrapper cannot own text from an excluded or separate block. Recurse
      // into active child fields instead, preserving ordinary nested p labels.
      if (eligibleField) {
        const blocks = readNativeStatusTextBlocks(node)
        // A supplied label with no value is different from an absent field,
        // including a label separated from a later value by a block boundary.
        if (blocks.some(block => /^(?:(?:Job|Work)\s+)?(?:Location|Country)\s*:\s*$/i.test(block))) malformedField = true
        const match = canOwnField && blocks.length === 1
          && blocks[0].match(/^(?:(Job|Work)\s+)?(Location|Country)\s*:\s*(.*)$/i)
        if (match) {
          fields.push({ label: match[2].toLowerCase(), value: match[3] })
          return
        }
      }
      for (const child of node.children) visit(child)
    }
    visit(scope)
    if (malformedField || !fields.length || fields.some(({ value }) => !value || !/[\p{L}\p{N}]/u.test(value)
      || value.split(',').some(component => !component.trim())
      || /[;/|]|\b(?:and|or|worldwide|global|anywhere|multiple|travel|headquarters|company)\b/i.test(value))) return result()
    const locations = [...new Set(fields.filter(field => field.label === 'location').map(field => field.value))]
    const countries = [...new Set(fields.filter(field => field.label === 'country').map(field => field.value))]
    if (locations.length > 1 || countries.length > 1) return result()
    const countryFor = (value, typed = false) => {
      if (!value) return null
      if (typed) value = ({ IN: 'India', IND: 'India', US: 'United States', USA: 'United States' })[value.toUpperCase()] || value
      const scope = readEightfoldLocationScope({ locations: [value] })
      return scope.unresolved ? null : scope.country
    }
    const location = locations[0], typedCountry = countries[0] ? countryFor(countries[0], true) : null
    if (countries.length && !typedCountry) return result()
    if (location) {
      const explicit = countryFor(location)
      const components = new Set(location.split(',').map(value => countryFor(value.trim())).filter(Boolean))
      if (components.size > 1 || typedCountry && explicit && typedCountry !== explicit) return result()
      if (/\b(?:remote|hybrid)\b/i.test(location) && !typedCountry) return result()
      const country = typedCountry || explicit
      return country ? result(country, location, 'explicit-bound-role-workplace') : result()
    }
    return typedCountry ? result(typedCountry, countries[0], 'explicit-bound-role-country') : result()
  } catch (error) {
    if (error instanceof ActiveNativeContentError || error?.code === 'NATIVE_STATUS_LAYOUT_UNQUALIFIED') return result()
    throw error
  }
}

export const parseJobDetail = (html, card) => {
  const document = String(html ?? '')
  const canonical = document.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
  const title = textFromHtml(document.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const tree = readNativeDocument(document)
  const scopes = tree.nodes(node => node.tag === 'div' && node.children.some(child => typeof child !== 'string' && child.tag === 'h3' && nativeNorm(nativeFlow(child)) === 'Job Description'))
  const currentColumns = tree.nodes(node => node.attrs['data-id'] === '2615a90')
  const currentColumn = currentColumns.length === 1
  const scope = currentColumn ? currentColumns[0] : nativeOne(scopes, 'legacy job-description owner')
  const wholeHtml = originalInner(document, scope)
  const descriptionHtml = currentColumn ? wholeHtml : wholeHtml.replace(/^\s*<h3\b[^>]*>[\s\S]*?<\/h3>/i, '')
  const jobDescription = currentColumn ? nativeNorm(nativeFlow(scope)) : nativeNorm(scope.children.filter(child => !(typeof child !== 'string' && child.tag === 'h3' && nativeNorm(nativeFlow(child)) === 'Job Description')).map(nativeFlow).join(''))
  if (canonical !== card.applyUrl || title !== card.title || !jobDescription
    || !/<form\b[^>]*name=["']Career Form["']/i.test(document)
    || !/Application Form/i.test(document)) {
    throw new Error(`Anand Engineering verified job detail changed: ${card.applyUrl}`)
  }
  return {
    source: SOURCE,
    company: COMPANY_NAME,
    title,
    jobId: card.jobId,
    requisitionId: null,
    sourceUrl: card.applyUrl,
    applyUrl: card.applyUrl,
    link: card.applyUrl,
    ...readRoleWorkplace(document, card, descriptionHtml),
    sourceListingComplete: false,
    sourceScopeComplete: false,
    lifecycleCleanupAllowed: false,
    postingDate: card.postingDate,
    experienceRequired: card.experienceRequired,
    jobDescription,
    sourceDetailComplete: false,
    sourceDetailFailureKind: 'text-only-native-country-or-whole-record-proof-unqualified',
  }
}

const createLegacyAnandEngineeringProductsScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, maxPages = Infinity } = {}) {
    let pagesFetched = 0
    const readPage = async url => {
      signal?.throwIfAborted()
      const html = await fetchText(url, {signal})
      signal?.throwIfAborted()
      pagesFetched += 1
      return html
    }
    const homepage = await readPage(HOMEPAGE_URL)
    if (!hasHomepageSignal(homepage)) throw new Error('Anand Engineering verified official homepage changed')

    const cards = []
    let maxPage = 1
    for (let page = 1; page <= maxPage; page += 1) {
      const parsed = parseListingPage(await readPage(listingUrl(page)), page)
      maxPage = parsed.maxPage
      if (maxPage > maxPages) throw new Error('Anand native caller page limit prevents full legacy discovery')
      cards.push(...parsed.cards)
    }

    const jobs = []
    const seen = new Set()
    for (const card of cards) {
      if (seen.has(card.jobId)) continue
      seen.add(card.jobId)
      const detail = parseJobDetail(await readPage(card.applyUrl), card)
      jobs.push({ ...detail, scrapedAt: new Date().toISOString() })
    }
    return attachInventoryEvidence(jobs, {
      status: 'coverage-gap', surface: CAREERS_URL, firstParty: false,
      listingComplete: false, pagesFetched, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: null,
      reason: jobs.some(job => job.nativeGeographyQualified === false)
        ? 'anand-role-workplace-unqualified;company-inventory-scope-unqualified'
        : 'anand-company-inventory-scope-unqualified',
    })
  },
})

export const createAnandEngineeringProductsScraper = () => ({
  async run(options = {}) {
    const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap')
    if(maxJobs===0||maxPages===0||options.fetchResponse||options.fetchImpl||!options.fetchText)return runNativeAnand(options)
    const io=transport(options),{control}=io;let total=0
    try{
      control.check()
      const fetchText=url=>control.gate(async()=>{const text=await options.fetchText(url,{signal:control.signal});control.check();if(typeof text!=='string'||Buffer.byteLength(text)>4*1024*1024)throw Error('Anand legacy invalid or oversized text');total+=Buffer.byteLength(text);if(total>32*1024*1024)throw Error('Anand legacy aggregate text limit');return text},budget(options.readTimeoutMs,15000,'read timeout'),'legacy read/body')
      const jobs=await createLegacyAnandEngineeringProductsScraper().run({...options,fetchText,signal:control.signal,maxPages})
      control.check();const out=attachInventoryEvidence(jobs.slice(0,maxJobs),readInventoryEvidence(jobs));return attachSourceObservationEvidence(out,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:jobs.length,observedVacancyCount:jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    }catch(error){throw control.fail(error)}finally{control.dispose()}
  },
})
export const run = async (options = {}) => createAnandEngineeringProductsScraper().run(options)
