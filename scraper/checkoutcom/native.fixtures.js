// Synthetic fixtures shaped after the retained 2026-10-27 public responses.
// These India examples are test controls, never observations of live openings.
export const specs = {
  checkoutcom: { source: 'checkoutcom', company: 'Checkout.com', token: 'checkout.com', domain: 'checkout.com', careersUrl: 'https://www.checkout.com/careers', proxyUrl: 'https://ashby-careers-checkout-production.up.railway.app/api/jobs' },
  vanta: { source: 'vanta', company: 'Vanta', token: 'vanta', domain: 'vanta.com', careersUrl: 'https://www.vanta.com/company/careers' },
}
export const description = '<h2>Requirements</h2><p>5+ years building C++ &amp; identity systems. Read <a href="https://example.com/spec">the specification</a>, carefully.</p><h2>Preferred qualifications</h2><p>A relevant degree.</p><p hidden>Hidden criteria</p>'
const uuid = i => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`
export function fixture(source = 'vanta', { index = 1, country = 'India', location = 'Bengaluru, India', secondary = [] } = {}) {
  const spec = specs[source], id = uuid(index)
  const address = country == null ? null : { postalAddress: { addressCountry: country, addressLocality: location.split(',')[0] } }
  const feed = { id, title: 'Software Engineer', department: 'Engineering', team: 'Platform', employmentType: 'FullTime', location, secondaryLocations: secondary,
    publishedAt: '2026-10-20T12:34:56.789+00:00', isListed: true, isRemote: false, workplaceType: 'OnSite', address,
    jobUrl: `https://jobs.ashbyhq.com/${spec.token}/${id}`, applyUrl: `https://jobs.ashbyhq.com/${spec.token}/${id}/application`, descriptionHtml: description,
    descriptionPlain: 'Requirements 5+ years building C++ & identity systems. Read the specification https://example.com/spec, carefully. Preferred qualifications A relevant degree.' }
  const brief = { id, title: feed.title, teamId: 'synthetic-team', locationId: 'synthetic-location', locationName: location, workplaceType: feed.workplaceType, employmentType: feed.employmentType,
    secondaryLocations: secondary.map(x => ({ locationName: x.location })), compensationTierSummary: null, __typename: 'JobPosting' }
  const posting = { id, title: feed.title, departmentName: 'Engineering', departmentExternalName: 'Engineering', locationName: location, locationAddress: null,
    workplaceType: feed.workplaceType, employmentType: feed.employmentType, descriptionHtml: description, isListed: true, isConfidential: false, teamNames: ['Platform'],
    secondaryLocationNames: secondary.map(x => x.location), compensationTierSummary: null, compensationTiers: [], applicationDeadline: '2026-11-30T23:59:00.000Z',
    compensationTierGuideUrl: null, scrapeableCompensationSalarySummary: null, compensationPhilosophyHtml: '<p>Published compensation policy.</p>', applicationLimitCalloutHtml: null }
  const schema = { '@context': 'https://schema.org', '@type': 'JobPosting', title: feed.title, description, directApply: true,
    identifier: { '@type': 'PropertyValue', name: spec.company, value: id }, datePosted: '2026-10-20', validThrough: posting.applicationDeadline,
    hiringOrganization: { '@type': 'Organization', name: spec.company, sameAs: `https://${spec.domain}/` },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', ...(address?.postalAddress || {}) } }, employmentType: 'FULL_TIME' }
  return { feed, brief, posting, schema }
}
export function careers(source, { extra = '' } = {}) {
  const s = specs[source]
  const client = s.proxyUrl || `https://api.ashbyhq.com/posting-api/job-board/${s.token}`
  return `<html><body><h1>${s.company} Careers</h1><h2>Open roles</h2><a href="${s.careersUrl}">Careers</a>${source === 'checkoutcom' ? '<a href="/jobs">Explore open positions</a><a href="/early-careers">Early careers</a><a href="https://jobs.ashbyhq.com/checkout.com/form/talent-communities">Join our talent community</a>' : ''}<script>fetch("${client}").then(r=>r.json())</script><div hidden>No open position found</div>${extra}</body></html>`
}
export function transport(source, records = [fixture(source)], options = {}) {
  const s = specs[source], calls = [], counts = new Map()
  const organization = { organizationId: 'synthetic-org-' + source, name: s.company, publicWebsite: `https://${s.domain}/`, hostedJobsPageSlug: s.token, isDemoOrg: false }
  const page = data => `<html><body><script>window.__appData = ${JSON.stringify(data)};</script></body></html>`
  const board = rows => page({ organization, posting: null, jobBoard: { teams: [], jobPostings: rows.map(r => r.brief) } })
  async function get(url, json) {
    calls.push(url); const n = (counts.get(url) || 0) + 1; counts.set(url, n)
    if (options.denyUrl === url) throw Object.assign(new Error('HTTP 403 public careers denial'), { status: 403 })
    if (url === s.careersUrl || (source === 'checkoutcom' && ['https://www.checkout.com/jobs','https://www.checkout.com/early-careers'].includes(url))) return careers(source, { extra: n > 1 ? options.closingExtra || '' : options.extra || '' })
    if (url === `https://jobs.ashbyhq.com/${s.token}`) return board(n > 1 ? options.closingBoardRecords || options.closingRecords || options.boardRecords || records : options.boardRecords || records)
    if (url === `https://api.ashbyhq.com/posting-api/job-board/${s.token}`) return { apiVersion: '1', jobs: structuredClone((n > 1 ? options.closingRecords || records : records).map(r => r.feed)), ...(options.feedExtras || {}) }
    if (url === s.proxyUrl) {
      const jobs = (options.proxyRecords || records).map(({ feed: r }) => ({ id:r.id,title:r.title,department:r.department,team:r.team,location:r.location,addressCountry:r.address?.postalAddress?.addressCountry || null,secondaryLocations:r.secondaryLocations.map(l=>l.location),isRemote:r.isRemote,workplaceType:r.workplaceType,employmentType:r.employmentType,publishedAt:r.publishedAt,applyUrl:r.applyUrl,jobUrl:r.jobUrl,compensation:null,parentDepartment:'Engineering' }))
      return { jobs, filters: {}, meta: { totalJobs:jobs.length,filteredJobs:jobs.length,lastFetched:'2026-10-27T09:00:00.000Z',cacheStatus:'fresh',hierarchyEnriched:true } }
    }
    const record = records.find(r => r.feed.jobUrl === url)
    if (record) { const r = options.mutateDetail ? options.mutateDetail(structuredClone(record)) : record; return page({ organization: options.organization || organization, posting:r.posting,jobBoard:null }) + `<script type="application/ld+json">${JSON.stringify(r.schema)}</script>` }
    if (options.additional?.[url]) return options.additional[url]
    throw Error(`UNEXPECTED_OFFLINE_${json ? 'JSON' : 'TEXT'}_REQUEST: ${url}`)
  }
  return { calls, fetchText: url => get(url, false), fetchJson: url => get(url, true), fetchPageHtml: () => careers(source) }
}
