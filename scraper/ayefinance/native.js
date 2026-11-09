import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

export const EMPLOYER_URL = 'https://www.linkedin.com/company/aye-finance-ltd/'
export const LISTING_URL = 'https://www.linkedin.com/jobs/search/?f_C=9381588&location=India'
const check = (ok, reason) => { if (!ok) throw new Error(reason) }
const activeDocument = html => {
  const doc = document(html)
  const prune = (node, inherited = false) => {
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))
    for (const child of node.children.filter(value => typeof value !== 'string')) prune(child, node.inactive)
  }
  prune(doc.root)
  return doc
}
const companyMatches = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
      && url.pathname.replace(/\/$/, '') === '/company/aye-finance-ltd'
  } catch { return false }
}
const roleKey = value => {
  const url = new URL(value)
  check(url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash && ['www.linkedin.com', 'in.linkedin.com'].includes(url.hostname)
    && /^\/jobs\/view\/[^/]+-\d+$/.test(url.pathname), 'Native role URL changed')
  return url.pathname
}

export const collectNative = async ({ read, now }) => {
  const employer = activeDocument(await read(EMPLOYER_URL))
  check(employer.nodes(node => node.tag === 'h1' && employer.text(node) === 'Aye Finance Ltd').length === 1
    && employer.nodes(node => node.attrs['data-semaphore-content-urn'] === 'urn:li:organization:9381588').length === 1,
  'Native Aye Finance employer identity changed')
  check(employer.nodes(node => node.tag === 'a' && node.attrs['data-tracking-control-name'] === 'about_website').some(node => {
    try {
      const redirect = new URL(node.attrs.href), target = new URL(redirect.searchParams.get('url'))
      return redirect.origin === 'https://www.linkedin.com' && redirect.pathname === '/redir/redirect'
        && ['http:', 'https:'].includes(target.protocol) && !target.username && !target.password
        && target.hostname === 'www.ayefin.com' && target.pathname === '/' && !target.search && !target.hash && !target.port
    } catch { return false }
  }), 'Native employer reciprocal website changed')
  const listing = activeDocument(await read(LISTING_URL))
  check(listing.nodes(node => node.tag === 'input' && node.attrs.name === 'f_C' && node.attrs.value === '9381588'
    && Object.hasOwn(node.attrs, 'checked')).length === 1, 'Native exact employer filter changed')
  const cards = listing.nodes(node => listing.hasClass(node, 'job-search-card'))
  const headings = listing.nodes(node => node.tag === 'h1')
  const total = headings.length === 1 ? Number(listing.text(headings[0]).match(/^(\d+) Jobs in India$/)?.[1]) : NaN
  const noMatch = cards.length === 0 && headings.length === 1 && listing.text(headings[0]) === 'We couldn’t find a match for Jobs jobs in India'
  check(noMatch || cards.length > 0 && cards.length <= 100 && Number.isSafeInteger(total) && total >= cards.length,
    'Native bounded listing or reported count changed')
  const facts = [], ids = new Set()
  for (const card of cards) {
    const within = predicate => listing.nodes(predicate, card)
    const field = name => listing.text(within(node => listing.hasClass(node, name))[0]) || null
    const id = card.attrs['data-entity-urn']?.match(/^urn:li:jobPosting:(\d+)$/)?.[1]
    const subtitle = within(node => listing.hasClass(node, 'base-search-card__subtitle'))[0]
    check(id && !ids.has(id) && listing.text(subtitle) === 'Aye Finance Ltd'
      && listing.nodes(node => node.tag === 'a' && companyMatches(node.attrs.href), subtitle).length === 1,
    'Native listing exact employer or unique role identity changed')
    ids.add(id)
    const rawUrl = within(node => node.tag === 'a' && listing.hasClass(node, 'base-card__full-link'))[0]?.attrs.href
    const path = roleKey(rawUrl)
    check(path.endsWith(`-${id}`), 'Native role ID differs from its URL')
    const postingDate = within(node => node.tag === 'time')[0]?.attrs.datetime || null
    check(!postingDate || /^\d{4}-\d{2}-\d{2}$/.test(postingDate) && Number.isFinite(Date.parse(postingDate))
      && Date.parse(postingDate) <= Date.parse(now()), 'Native listing public date invalid or future')
    const title = field('base-search-card__title'), location = field('job-search-card__location')
    check(title && location, 'Native listing title or location missing')
    facts.push({ id, path, rawUrl, title, location, postingDate })
  }
  // These are independently discovered public native role identities, not a
  // purported enumerable board. Recheck their current primary documents on
  // every run when native filtered search does not enumerate them.
  if (noMatch) {
    for (const [id, slug, title, location] of [
      ['4474071845', 'relationship-manager', 'Relationship Manager', 'Raxaul, Bihar, India'],
      ['4471197446', 'sales-executive', 'Sales Executive', 'Dalsingh Sarai, Bihar, India'],
    ]) {
      const path = `/jobs/view/${slug}-at-aye-finance-ltd-${id}`
      facts.push({ id, path, title, location, rawUrl: `https://www.linkedin.com${path}`, postingDate: null })
    }
  }
  const jobs = [], detailObservations = []
  let stopReason = noMatch ? 'filtered-search-no-match; independently-discovered-role-watch-list' : 'bounded-detail-limit', visited = 0
  for (const fact of facts.slice(0, 20)) {
    let body
    const requestUrl = new URL(fact.rawUrl)
    requestUrl.hostname = 'www.linkedin.com'
    try { body = await read(requestUrl.href) } catch (error) {
      if ([403, 429].includes(error.status)) { stopReason = `native-details-HTTP${error.status}`; break }
      if ([404, 410].includes(error.status)) continue
      throw error
    }
    visited++
    const detail = activeDocument(body)
    const containsPosting = value => Array.isArray(value) ? value.some(containsPosting)
      : value && typeof value === 'object' && ([value['@type']].flat().includes('JobPosting')
        || Object.values(value).some(containsPosting))
    for (const node of detail.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) {
      let value
      try { value = JSON.parse(node.raw) } catch { throw new Error('Native structured data changed or malformed') }
      check(!containsPosting(value), 'New native JobPosting geography, dates and expiry require reconciliation')
    }
    check(detail.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && roleKey(node.attrs.href) === fact.path).length === 1,
      'Native detail canonical role changed')
    check(detail.nodes(node => node.attrs['data-semaphore-content-urn'] === `urn:li:jobPosting:${fact.id}`).length === 1,
      'Native primary posting identity changed')
    check(detail.nodes(node => node.tag === 'h1' && detail.text(node) === fact.title).length === 1
      && detail.nodes(node => node.tag === 'a' && detail.hasClass(node, 'topcard__org-name-link')
        && companyMatches(node.attrs.href) && detail.text(node) === 'Aye Finance Ltd').length === 1,
    'Native visible title or employer changed')
    check(detail.nodes(node => node.tag === 'span' && detail.hasClass(node, 'topcard__flavor--bullet')
      && detail.text(node) === fact.location).length === 1, 'Native detail and listing geography differ')
    if (/No longer accepting applications/i.test(detail.text(detail.root))) continue
    const parts = fact.location.split(',').map(value => value.trim())
    if (parts.at(-1) !== 'India') continue
    const apply = detail.nodes(node => node.tag === 'button' && detail.text(node) === 'Apply'
      && ['job-details-subnav-apply-modal', 'job-details-topcard-apply-modal'].includes(node.attrs['data-modal'])
      && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['aria-disabled'] !== 'true')
    const activeApplyVerified = apply.length > 0 && detail.nodes(node => node.tag === 'a'
      && node.attrs['data-tracking-control-name'] === 'public_jobs_nav-header-signin').some(node => {
      try {
        const target = new URL(node.attrs.href)
        return target.origin === 'https://www.linkedin.com' && target.pathname === '/login'
          && roleKey(target.searchParams.get('session_redirect')) === fact.path
      } catch { return false }
    })
    const markup = detail.nodes(node => detail.hasClass(node, 'show-more-less-html__markup'))
    const prose = node => node.inactive || ['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag) ? ''
      : node.children.map(child => typeof child === 'string' ? child : prose(child)).join(' ').replace(/\s+/g, ' ').trim()
    const description = markup.length === 1 && prose(markup[0]).length >= 40
      && prose(markup[0]).split(/\s+/).length >= 6 ? detail.text(markup[0]) : null
    const employment = detail.nodes(node => detail.hasClass(node, 'description__job-criteria-item'))
      .find(node => /^Employment type\s/.test(detail.text(node)))
    const sourceUrl = `https://in.linkedin.com${fact.path}`
    detailObservations.push({ jobId: fact.id, title: fact.title, location: fact.location,
      employer: 'Aye Finance Ltd', country: 'India', sourceUrl, sourceDescription: description,
      postingDate: fact.postingDate, nativeDetailPublicationDate: null, closingDate: null,
      nativeRelativeDateText: detail.nodes(node => detail.hasClass(node, 'posted-time-ago__text')).map(detail.text),
      activeApplyVerified, exclusion: activeApplyVerified ? null : 'no-active-native-application-control' })
    if (!activeApplyVerified) continue
    jobs.push({ source: 'ayefinance', company: 'Aye Finance', title: fact.title, jobId: fact.id, requisitionId: fact.id,
      location: fact.location, country: 'India', city: parts.length >= 3 ? parts[0] : null,
      region: parts.length >= 3 ? parts[1] : null, postingDate: fact.postingDate,
      nativeListingPublicationDate: fact.postingDate, nativeDetailPublicationDate: null, closingDate: null,
      employmentType: employment ? detail.text(employment).replace(/^Employment type\s+/, '') : null,
      sourceUrl, applyUrl: sourceUrl, link: sourceUrl, activeApplyVerified: true,
      jobDescription: description, sourceDescription: description, sourceDetailComplete: Boolean(description),
      sourceDetailFailureKind: description ? null : 'missing-content', sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, firstParty: false,
      employerPublishingName: 'Aye Finance Ltd', corporateHandoffVerified: false, scrapedAt: now() })
  }
  return { jobs, observations: { cards: facts, displayedSearchTotal: Number.isSafeInteger(total) ? total : null, visitedDetails: visited, details: detailObservations },
    reason: `Corporate careers handoff unverified; homepage capture was CloudFront403. Independent native LinkedIn employer 9381588 has reciprocal ayefin.com identity. ${stopReason}; observed ${cards.length} India-filtered cards, visited ${visited} details, recovered ${detailObservations.length} exact-employer explicit-India observations, ${jobs.length} with verified active application controls. ${detailObservations.filter(row => !row.activeApplyVerified).length} observations excluded because active application controls are absent. Unvisited cards and country-ambiguous metro roles excluded. Worldwide inventory, secondary scope, precise detail publication and expiry remain unknown.` }
}


