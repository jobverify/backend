// All records in this file are synthetic; they are not current Delinea vacancies.
export const careers = '<title>Delinea careers</title><h1>What makes Delinea different</h1><a href="https://jobs.ashbyhq.com/delinea">Apply Today (EN)</a>'
export const organization = { organizationId: 'synthetic-employer', name: 'Delinea', hostedJobsPageSlug: 'delinea', publicWebsite: 'https://delinea.com/' }
export const html = (data) => `<script>window.__appData = ${JSON.stringify(data)};</script>`
export const description = '<h2>Requirements</h2><ul><li>5+ years building identity systems.</li><li>Use C++ &amp; preserve &amp;lt;literal&amp;gt; text.</li></ul><h2>Preferred qualifications</h2><p>A relevant degree.</p>'
export const plain = 'Requirements 5+ years building identity systems. Use C++ & preserve &lt;literal&gt; text. Preferred qualifications A relevant degree.'
export function fixture({ id = 'synthetic-india', country = 'India', location = 'Home Office (India)' } = {}) {
  const feed = { id, title: 'Synthetic Identity Engineer', department: 'Engineering', team: 'Platform', employmentType: 'FullTime', location, secondaryLocations: [], publishedAt: '2026-10-20T12:34:56.789+00:00', isListed: true, isRemote: true, workplaceType: 'Remote', address: { postalAddress: { addressCountry: country } }, jobUrl: `https://jobs.ashbyhq.com/delinea/${id}`, applyUrl: `https://jobs.ashbyhq.com/delinea/${id}/application`, descriptionHtml: description, descriptionPlain: plain }
  const brief = { id, title: feed.title, locationName: location, secondaryLocations: [], employmentType: feed.employmentType, workplaceType: feed.workplaceType }
  const posting = { id, title: feed.title, departmentName: feed.department, departmentExternalName: feed.department, locationName: location, locationAddress: null, workplaceType: 'Remote', employmentType: feed.employmentType, descriptionHtml: description, isListed: true, isConfidential: false, teamNames: ['Platform'], secondaryLocationNames: [], applicationDeadline: '2026-11-30T23:59:00.000Z', compensationTiers: [], compensationTierSummary: null, compensationPhilosophyHtml: '<p>Published compensation policy.</p>' }
  const schema = { '@type': 'JobPosting', title: feed.title, identifier: { name: 'Delinea', value: id }, datePosted: '2026-10-20', hiringOrganization: { name: 'Delinea', sameAs: 'https://delinea.com/' }, jobLocation: { address: { addressCountry: country } } }
  return { feed, brief, posting, schema }
}
export function transport(records = [fixture()], { closingRecords = records, mutateDetail = x => x, closingCareers = careers, extraFeed = [], failDetail = null } = {}) {
  let boardReads = 0; let feedReads = 0; let careerReads = 0; const calls = []
  return { calls, fetchText: async url => {
    calls.push(url)
    if (url === 'https://delinea.com/careers') return ++careerReads > 1 ? closingCareers : careers
    if (url === 'https://jobs.ashbyhq.com/delinea') return html({ organization, jobBoard: { jobPostings: (++boardReads > 1 ? closingRecords : records).map(x => x.brief) } })
    const record = records.find(x => x.feed.jobUrl === url)
    if (!record) throw new Error(`Unexpected URL ${url}`)
    if (failDetail) throw failDetail
    const detail = mutateDetail(structuredClone(record))
    return html({ organization, posting: detail.posting }) + `<script type="application/ld+json">${JSON.stringify(detail.schema)}</script>`
  }, fetchJson: async url => {
    calls.push(url)
    if (url !== 'https://api.ashbyhq.com/posting-api/job-board/delinea') throw new Error(`Unexpected URL ${url}`)
    return { jobs: [...(++feedReads > 1 ? closingRecords : records).map(x => x.feed), ...extraFeed], apiVersion: '1' }
  } }
}
