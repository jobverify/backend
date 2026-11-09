import {createCurrentDeclaredNativeRead, nativeContract as need, nativeDigest} from '../../scraper-support/utils/currentDeclaredNativeRead.js'
import {readNativeDocument, extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const origin = 'https://www.trukker.com'
const careers = origin + '/careers', positions = origin + '/career-positions'
const listingFeed = origin + '/assets/scripts/career.json', ownFeed = listingFeed + '?v=1'
const listClient = 'c181aaea34a691187bd6be4bd193ee45bf4d8411cb90ade4f909afcd156600ce'
const ownClient = '7877781cd4b01509739d6e4c39f57efca41fd270b6fbb85ab49b66ddb85b802d'
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const clean = value => typeof value === 'string' ? extractActiveDescription(value) : null
const groups = [['KEYRESPONSIBILITIES', 'Key Responsibilities'], ['QUALIFICATIONS', 'Requirements'],
  ['KPI', 'KPI'], ['WHOWEARELOOKING', 'Who We Are Looking For'], ['KEYSUCCESSTRAIS', 'Key Success Traits']]

function client(page, expected) {
  const doc = readNativeDocument(page.originalText)
  const scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src
    && /^(?:|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type || '')
    && node.raw?.includes('xobj.open') && node.raw.includes('career.json'))
  need(scripts.length === 1 && nativeDigest(scripts[0].raw) === expected, 'TruKKer native client contract changed')
  return doc
}

function handoff(page) {
  const doc = readNativeDocument(page.originalText)
  need(doc.nodes(node => node.tag === 'a' && (() => {
    try { return new URL(node.attrs.href, careers).href === positions } catch { return false }
  })()).length > 0, 'TruKKer current corporate careers handoff changed')
}

function model(reader, page) {
  const rows = reader.json(page), ids = new Set()
  need(Array.isArray(rows) && rows.length <= 250, 'TruKKer native inventory envelope changed')
  for (const row of rows) {
    need(row && typeof row === 'object' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.URL || '')
      && !ids.has(row.URL) && typeof row.TITLE === 'string' && row.TITLE.trim()
      && typeof row.COUNTRY === 'string' && typeof row.LOCATION === 'string', 'TruKKer native identity envelope changed')
    ids.add(row.URL)
  }
  return rows
}

export async function runCurrentTrukker(options = {}) {
  const allowed = new Set([careers, positions, listingFeed, ownFeed])
  const reader = createCurrentDeclaredNativeRead('trukkerindia', url => allowed.has(url), options)
  const maxJobs = options.maxJobs ?? 250
  need(Number.isSafeInteger(maxJobs) && maxJobs > 0 && maxJobs <= 250, 'TruKKer invalid role bound')
  const checkedAt = new Date(typeof options.now === 'function' ? options.now() : options.now ?? Date.now()).toISOString()
  handoff(await reader.read(careers))
  client(await reader.read(positions), listClient)
  const rows = model(reader, await reader.read(listingFeed))
  const ownRows = model(reader, await reader.read(ownFeed))
  need(stable(rows) === stable(ownRows), 'TruKKer current native listing/own inventory disagree')
  // The current publisher itself assigns these other physical worksites to
  // non-India COUNTRY records. Do not overwrite conflicting locality evidence.
  const otherWorksites = new Set(rows.filter(row => row.COUNTRY.trim() && row.COUNTRY !== 'India')
    .map(row => row.LOCATION.trim().toLowerCase()))
  const jobs = [], held = []
  for (const row of rows.filter(row => row.COUNTRY === 'India')) {
    if (jobs.length >= maxJobs) break
    if (!clean(row.ABOUT) || !/\bat\s+trukker\b/i.test(clean(row.ABOUT))
      || /\b(?:remote|hybrid|worldwide|anywhere)\b|[,/|;]/i.test(row.LOCATION)
      || otherWorksites.has(row.LOCATION.trim().toLowerCase())
      || !['KEYRESPONSIBILITIES', 'QUALIFICATIONS'].every(key => Array.isArray(row[key]) && row[key].length
        && row[key].every(item => clean(item)))) {
      held.push({reason: 'native-role-employer-worksite-or-criteria-unqualified', record: structuredClone(row)})
      continue
    }
    const sourceUrl = origin + '/opening?id=' + row.URL
    allowed.add(sourceUrl)
    const validateOwn = page => {
      const doc = client(page, ownClient)
      need(doc.nodes(node => node.tag === 'a' && node.attrs.href === 'mailto:career@trukker.com').length > 0,
        'TruKKer native role application handoff changed')
      return {clientSHA256: ownClient, application: 'mailto:career@trukker.com'}
    }
    const opening = validateOwn(await reader.read(sourceUrl))
    const closing = validateOwn(await reader.read(sourceUrl))
    need(stable(opening) === stable(closing), 'TruKKer closing native role changed')
    const sections = [clean(row.ABOUT)]
    for (const [key, label] of groups) {
      need(row[key] == null || Array.isArray(row[key]) && row[key].every(item => typeof item === 'string'), 'TruKKer native criteria shape changed')
      if (row[key]?.length) sections.push(label + '\n' + row[key].map(clean).join('\n'))
    }
    const description = sections.join('\n\n')
    need(description.length >= 100, 'TruKKer native full criteria unavailable')
    jobs.push({source: 'trukkerindia', company: 'TruKKer India', title: row.TITLE, jobId: row.URL,
      requisitionId: null, country: 'India', city: row.LOCATION, location: row.LOCATION + ', India',
      department: row.DEPT || null, sourceUrl, applyUrl: opening.application, link: opening.application,
      jobDescription: description, postingDate: null, closingDate: null, firstEverPostedAt: null,
      legalEmployer: null, scrapedAt: checkedAt, nativeSourceRecord: structuredClone(row),
      sourceCurrentNativeRoleQualified: true, sourceDetailComplete: true, sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      sourceNativeClosingContext: {fullRoleClientRechecked: true, fullCriteriaInventoryRechecked: true, companyScopeComplete: false}})
  }
  need(stable(model(reader, await reader.read(ownFeed))) === stable(ownRows), 'TruKKer closing native inventory changed')
  need(stable(model(reader, await reader.read(listingFeed))) === stable(rows), 'TruKKer closing native inventory changed')
  client(await reader.read(positions), listClient)
  handoff(await reader.read(careers))
  reader.signal.throwIfAborted()
  if (jobs.length) jobs[0].nativeInventoryContext = {nativeRows: structuredClone(rows), heldNativeRecords: held}
  attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: careers, firstParty: true,
    listingComplete: false, pagesFetched: reader.pages.length, reportedTotal: null, indiaFacetCount: null,
    verifiedAt: checkedAt, reason: 'current-declared-native-inventory-and-full-role-criteria-reconciled;typed-native-work-country;whole-company-inventory-unknown;cleanup-forbidden'})
  return attachSourceObservationEvidence(jobs, {source: 'trukkerindia', recordKind: 'vacancy-rows',
    observedRecordCount: rows.length, observedVacancyCount: rows.length, sourceScopeComplete: false})
}
