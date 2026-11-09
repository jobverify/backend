import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createCurrentDeclaredNativeRead, nativeContract } from '../../scraper-support/utils/currentDeclaredNativeRead.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME = 'https://vakilsearch.com/', CAREERS = HOME + 'careers'
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ensure = (value, reason) => nativeContract(value, 'Vakilsearch current native: ' + reason)
const roleURL = value => { try { const url = new URL(value); return url.origin === 'https://vakilsearch.com'
  && /^\/careers\/[a-z-]+$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password && !url.port } catch { return false } }
const brand = document => {
  const original = document.text(document.nodes(node => node.tag === 'root')[0])
  ensure(original.includes('Uber9 Business Process Services Private Limited') && /Registered Office Address\s*[-–]/i.test(original), 'current first-party publisher identity missing')
  const address = original.match(/Registered Office Address\s*[-–]\s*([^]*?\bChennai,\s*Tamil Nadu\s*600102,\s*India\.)/i)?.[1]
  ensure(address && !/Singapore|\bremote\b/i.test(address), 'current Chennai office postal-country proof changed')
  return { publisher: 'Uber9 Business Process Services Private Limited', originalPostalAddress: address, city: 'Chennai', state: 'Tamil Nadu', country: 'India' }
}
const cards = (document, allowed) => {
  const results = []
  for (const node of document.nodes(node => node.tag === 'div' && document.hasClass(node, 'tw-grid'))) {
    const links = document.nodes(node => node.tag === 'a' && roleURL(node.attrs.href), node)
    if (links.length !== 1) continue
    const columns = node.children.filter(child => typeof child !== 'string')
    if (columns.length !== 3) continue
    const identity = document.nodes(node => node.tag === 'p', columns[0]).map(node => document.text(node))
    const geography = document.nodes(node => node.tag === 'p', columns[1]).map(node => document.text(node))
    if (identity.length !== 2 || geography.length !== 2 || geography[0] !== 'Location') continue
    const url = links[0].attrs.href
    ensure(!results.some(row => row.url === url), 'duplicate native corporate role identity')
    allowed.add(url)
    results.push({ url, department: identity[0], title: identity[1], location: geography[1] })
  }
  const advertised = new Set(document.nodes(node => node.tag === 'a' && roleURL(node.attrs.href)).map(node => node.attrs.href))
  ensure(results.length > 0 && results.length === advertised.size, 'current corporate role cards incomplete or changed')
  return results
}
const detail = (page, card, currentOffice) => {
  const document = readNativeDocument(page.originalText), ownOffice = brand(document)
  ensure(same(currentOffice, ownOffice), 'role-owned current publisher office country changed')
  const titles = document.nodes(node => node.tag === 'h1').map(node => document.text(node))
  ensure(titles.length === 1 && titles[0] === card.title, 'corporate card and own role title disagree')
  const sections = document.nodes(node => document.hasClass(node, 'summarysection'))
  const parts = sections.map(node => ({ heading: document.nodes(node => node.tag === 'h3', node).map(node => document.text(node)), text: document.text(node) }))
  ensure(parts.length >= 2 && parts.every(part => part.heading.length === 1)
    && parts.some(part => part.heading[0] === 'Job Description') && parts.some(part => part.heading[0] === 'Job Specifications'), 'full authored description/specifications unavailable')
  const jobDescription = parts.map(part => part.text).join('\n\n')
  ensure(jobDescription.length >= 300 && /qualificat|skill|experience/i.test(jobDescription), 'native authored criteria incomplete')
  const locations = sections.flatMap(section => document.nodes(node => node.tag === 'li' && /^Location\s*:/i.test(document.text(node)), section)
    .map(node => document.text(node).replace(/^Location\s*:\s*/i, '').trim()))
  const distinct = [...new Set(locations)]
  const countryCarriers = sections.flatMap(section => document.nodes(node => ['li', 'p', 'dd', 'td'].includes(node.tag)
    && /^(?:(?:job|worksite|office|work)\s+)?countr(?:y|ies)\s*:/i.test(document.text(node)), section)
    .map(node => document.text(node)))
  // This is a current publisher worksite-to-postal-country join, not a country
  // field invented on the role. New cities, remote/mixed labels or contradicting
  // own role locations remain held even when another corporate office is India.
  const india = card.location === ownOffice.city && distinct.length === 1 && distinct[0] === ownOffice.city
    && countryCarriers.every(carrier => /^(?:India|IN|IND)$/i.test(carrier.slice(carrier.indexOf(':') + 1).trim()))
  return { card, title: titles[0], jobDescription, sections: parts, locations: distinct, countryCarriers, india, ownOffice, bodySHA256: page.bodySHA256 }
}

export async function runCurrentVakilsearch(options = {}) {
  const allowed = new Set([HOME, CAREERS]), io = createCurrentDeclaredNativeRead('vakilsearch', url => allowed.has(url), options)
  ensure(options.maxJobs == null || Number.isSafeInteger(options.maxJobs) && options.maxJobs >= 0, 'invalid output cap')
  const clock = typeof options.now === 'function' ? options.now() : options.now ?? new Date().toISOString()
  ensure(Number.isFinite(Date.parse(clock)), 'invalid observation clock')
  const phase = async () => {
    const home = await io.read(HOME), document = readNativeDocument(home.originalText)
    ensure(document.nodes(node => node.tag === 'title' && /Vakilsearch|Zolvit/i.test(node.raw || '')).length === 1
      && document.nodes(node => node.tag === 'a' && node.attrs.href === CAREERS).length > 0, 'current corporate careers handoff missing')
    const listingPage = await io.read(CAREERS), listing = readNativeDocument(listingPage.originalText), office = brand(listing)
    ensure(listing.nodes(node => /^h[1-6]$/.test(node.tag) && listing.text(node) === 'Open Positions').length === 1,
      'current corporate native openings identity changed')
    const rows = cards(listing, allowed), records = []
    for (const card of rows) {
      // Transport/access failures stop the source. A role-local title or
      // criteria disagreement is retained as a held observation and cannot
      // discard other independently paired current first-party roles.
      const page = await io.read(card.url)
      try { records.push(detail(page, card, office)) }
      catch (error) {
        if (error.failureKind !== 'coverage_gap') throw error
        records.push({ card, india: false, heldReason: error.message, bodySHA256: page.bodySHA256 })
      }
    }
    return { office, rows, records, listingBodySHA256: listingPage.bodySHA256 }
  }
  const opening = await phase(), closing = await phase()
  ensure(same(opening.office, closing.office) && same(opening.rows, closing.rows), 'opening/closing corporate role inventory changed')
  const qualified = closing.records.filter(current => current.india && opening.records.some(earlier => earlier.card.url === current.card.url
    && earlier.india && same([earlier.card, earlier.jobDescription, earlier.locations, earlier.ownOffice], [current.card, current.jobDescription, current.locations, current.ownOffice])))
  const jobs = qualified.slice(0, options.maxJobs ?? qualified.length).map(row => ({ source: 'vakilsearch', company: 'Vakilsearch', companyName: 'Vakilsearch',
    title: row.title, jobId: row.card.url.split('/').at(-1), requisitionId: null, department: row.card.department,
    sourceUrl: row.card.url, applyUrl: row.card.url, link: row.card.url, companyCareerPage: CAREERS, companyDomain: 'vakilsearch.com',
    country: 'India', city: 'Chennai', state: 'Tamil Nadu', location: 'Chennai, Tamil Nadu, India', locations: ['Chennai, Tamil Nadu, India'],
    jobDescription: row.jobDescription, sourceDescription: row.jobDescription, postingDate: null, closingDate: null, employmentType: null, remoteStatus: null,
    sourceNativeRoleLocation: row.locations, sourceNativeAuthoredCriteria: row.sections, sourceNativeDetailBodySHA256: row.bodySHA256,
    sourceNativeCountryEvidence: { kind: 'exact-role-city-and-current-publisher-office-postal-country', roleLocation: row.locations[0],
      corporateCardLocation: row.card.location, ...row.ownOffice, typedRoleCountry: row.countryCarriers.length ? 'India' : null, originalRoleCountryCarriers: row.countryCarriers },
    sourceCountryScopeUnresolved: false, sourceNativeCountryConflict: false, sourceNativePostingIdentityQualified: true,
    sourceCurrentNativeRoleQualified: true, sourceNativeDetailQualified: true, sourceDetailComplete: true, fullNativeAuthoredCriteriaAvailable: true,
    sourceNativeClosingReconciled: true, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    scrapedAt: new Date(clock).toISOString(),
  }))
  await options.onAudit?.({ source: 'vakilsearch', opening, closing, returnedCount: jobs.length, rawPages: io.pages,
    websiteJavaScriptExecuted: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
  io.signal.throwIfAborted()
  attachSourceObservationEvidence(jobs, { source: 'vakilsearch', recordKind: 'vacancy-rows', observedRecordCount: closing.rows.length,
    observedVacancyCount: closing.rows.length, sourceScopeComplete: false })
  return attachInventoryEvidence(jobs, { status: jobs.length ? 'discovery-only' : 'coverage-gap', firstParty: true, surface: CAREERS,
    listingComplete: false, pagesFetched: io.pages.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date(clock).toISOString(),
    reason: 'current-corporate-native-role-cards-and-complete-own-criteria;exact-chennai-worksite-to-current-employer-postal-country;opening-closing-reconciled;whole-employer-scope-and-cleanup-unqualified' })
}
