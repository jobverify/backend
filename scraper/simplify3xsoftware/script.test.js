import assert from 'node:assert/strict'
import test from 'node:test'
import * as simplify3x from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {filterIndiaJobs} from '../../scraper-support/utils/indiaLocationFilter.js'

// Explicit synthetic contract controls, not retained public response bodies.
const brandLinks = `
  <a href="https://www.linkedin.com/company/simplify3x/">LinkedIn</a>
  <a href="mailto:info@simplify3x.com">info@simplify3x.com</a>
  <a href="https://cvstaticfiles.s3.ap-south-1.amazonaws.com/website/Simplify3x/Simplify3X+SOC+2+Type+2+Report.pdf">Audit</a>
  <a href="https://www.hire3x.com/careers">Careers</a>
`
const homepageHtml = `<html><head>
  <title>Simplify3x - AI-Driven Technology Solutions for Enterprise Transformation</title>
  <meta property="og:url" content="https://simplify3x.com/">
  </head><body>Turning complex problems into simple solutions ${brandLinks}</body></html>`
const lifePageHtml = `<html><head><title>Life at Simplify3x - Where Innovation Meets People</title></head>
  <body><h1>Life at Simplify3x</h1>Driven by Innovation, United by Purpose ${brandLinks}</body></html>`
const appUrl = 'https://www.hire3x.com/js/app.abc123.js'
const clientUrl = 'https://www.hire3x.com/js/123.def456.js'
const observedAt = '2026-10-09T12:00:00.000Z'

const createReplay = ({location = ['Bengaluru, India'], mutate = () => {}} = {}) => {
  const role = {
    jobID: 'L071122A001CU001JD001', licenseKey: 'L071122A001', customerID: 'L071122A001CU001',
    customerName: 'Simplify3x', title: 'Synthetic Bengaluru Engineer', location,
    description: '<p>Build and maintain dependable software systems. Collaborate with engineering teams to review requirements, implement features, and improve automated testing.</p>',
    onHold: false, jobType: 'Full-time', createdAt: '2026-10-08T12:00:00.000Z',
  }
  const pages = new Map([
    [simplify3x.HOMEPAGE_URL, homepageHtml],
    [simplify3x.LIFE_PAGE_URL, lifePageHtml],
    [simplify3x.ABOUT_URL, `<title>About Us - Simplify3x</title>Simplify3x Software Private ${brandLinks}`],
    [simplify3x.CONTACT_URL, `<title>Contact Us - Simplify3x</title>${brandLinks}`],
    [simplify3x.CAREERS_URL, '<title>hire3x</title><link rel="canonical" href="https://hire3x.com"><script src="/js/app.abc123.js"></script>'],
    [appUrl, 'const base="https://api-website.hire3x.com/"; const api={getJobs:function(){return {url:"careers/jobs/",method:"get",params:{version:"v2"}}}}; const routes=[{path:"/careers",name:"Careers",component:()=>x.e(123)}]; const chunks={123:"def456"};'],
    [clientUrl, 'const base="https://recruitment.hire3x.com/JobRegistration/"; (api.getJobs)(); this.jobData=result.data.data; this.filteredJobs;'],
    [simplify3x.LISTING_URL, JSON.stringify({type: 'Success', data: [{categoryName: 'Synthetic control', jobs: [role]}]})],
    [simplify3x.DETAIL_BASE + role.jobID, JSON.stringify({type: 'Success', data: {
      ...role, closed: false, fields: ['resume', 'name', 'email'].map(key => ({key, mandatory: true, hide: false})),
    }})],
    [simplify3x.AVAILABILITY_BASE + role.jobID, JSON.stringify({type: 'Success', data: {JobID: role.jobID, customerID: role.customerID}})],
  ])
  const calls = []
  return {role, calls, fetchPage: async url => {
    calls.push(url)
    assert.ok(pages.has(url), 'Unmodeled public URL: ' + url)
    const page = {status: 200, url, html: pages.get(url)}
    mutate(page, url)
    return page
  }}
}

test('Simplify3x uses its current Malaysian corporate binding and classifies only blocked routes without public job signals', () => {
  assert.equal(simplify3x.SOURCE, 'simplify3xsoftware')
  assert.equal(simplify3x.COMPANY, 'Simplify3x Software')
  assert.equal(simplify3x.HOMEPAGE_URL, 'https://simplify3x.com.my/')
  assert.equal(simplify3x.LIFE_PAGE_URL, 'https://simplify3x.com.my/life.html')
  assert.equal(simplify3x.CAREERS_URL, 'https://www.hire3x.com/careers')
  assert.equal(simplify3x.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(simplify3x.hasOfficialLifePageSignal(lifePageHtml), true)
  for (const status of [403, 404]) {
    assert.equal(simplify3x.isVerifiedMissingJobRoute({status, html: '<h1>Forbidden</h1>'}), true)
    assert.equal(simplify3x.isVerifiedMissingJobRoute({status, html: '<h1>Current Openings</h1>'}), false)
    assert.equal(simplify3x.isVerifiedMissingJobRoute({status, html: '<a href="/jobs/engineer">Engineer</a>'}), false)
  }
  assert.equal(simplify3x.isVerifiedMissingJobRoute({status: 200, html: '<p>No listings</p>'}), false)
})

test('the modeled Hire3x flow returns an active India assignment with held source coverage', async () => {
  const replay = createReplay()
  const jobs = await simplify3x.run({fetchPage: replay.fetchPage, now: () => observedAt})
  assert.deepEqual(replay.calls, [
    simplify3x.HOMEPAGE_URL, simplify3x.LIFE_PAGE_URL, simplify3x.ABOUT_URL, simplify3x.CONTACT_URL,
    simplify3x.CAREERS_URL, appUrl, clientUrl, simplify3x.LISTING_URL,
    simplify3x.DETAIL_BASE + replay.role.jobID, simplify3x.AVAILABILITY_BASE + replay.role.jobID,
    simplify3x.LISTING_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, replay.role.jobID)
  assert.equal(jobs[0].title, replay.role.title)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].nativeGeographyQualified, true)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].applyUrl, 'https://recruitment.hire3x.com/JobRegistration/' + replay.role.jobID)
  assert.equal(jobs[0].scrapedAt, observedAt)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Simplify3x fails closed on corporate identity, careers handoff, redirect and native HTTP drift', async () => {
  for (const [mutate, pattern] of [
    [(page, url) => { if (url === simplify3x.HOMEPAGE_URL) page.html = page.html.replaceAll('info@simplify3x.com', 'other@example.com') }, /homepage identity/],
    [(page, url) => { if (url === simplify3x.LIFE_PAGE_URL) page.html = page.html.replaceAll('https://www.hire3x.com/careers', 'https://other.example/careers') }, /handoff/],
    [(page, url) => { if (url === simplify3x.CAREERS_URL) page.url = 'https://other.example/careers' }, /redirect/],
    [(page, url) => { if (url === simplify3x.LISTING_URL) page.status = 503 }, /HTTP 503/],
  ]) await assert.rejects(simplify3x.run({fetchPage: createReplay({mutate}).fetchPage}), pattern)
  await assert.rejects(simplify3x.run({fetchPage: async () => { throw new Error('controlled source unavailable') }}), /controlled source unavailable/)
})

test('a modeled unresolved workplace retains raw evidence without qualifying an India role', async () => {
  const jobs = await simplify3x.run({fetchPage: createReplay({location: ['Remote']}).fetchPage})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].location, null)
  assert.equal(jobs[0].nativeGeographyQualified, false)
  assert.deepEqual(jobs[0].rawNativeWorkplaceEvidence.locations, ['Remote'])
  assert.equal(filterIndiaJobs(jobs).length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})
