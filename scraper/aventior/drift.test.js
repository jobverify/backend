import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8')
const fetchCaptured = async url => {
  if (url === scraper.CAREERS_URL) return fixture('aventior-careers.html')
  if (url === scraper.LINKEDIN_COMPANY_PAGE_URL) return fixture('aventior-company.html')
  if (url === scraper.LINKEDIN_COMPANY_JOBS_URL) return fixture('aventior-jobs.html')
  throw new Error('Unexpected URL: ' + url)
}

test('Aventior accepts the observed company-scoped no-match copy without declaring company inventory empty', async () => {
  assert.equal(scraper.hasVerifiedLinkedInJobsPageSignal(fixture('aventior-jobs.html')), true)
  const jobs = await scraper.run({fetchText:fetchCaptured})
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.firstParty, false)
})

test('Aventior new no-match guard rejects lost company filtering and unrelated search identity', () => {
  const html = fixture('aventior-jobs.html')
  assert.equal(scraper.hasVerifiedLinkedInJobsPageSignal(html.replaceAll('27234995','999')), false)
  assert.equal(scraper.hasVerifiedLinkedInJobsPageSignal(html.replaceAll('Aventior','Other Company')), false)
  assert.equal(scraper.hasVerifiedLinkedInJobsPageSignal('<title>Sign in | LinkedIn</title><p>Sign in to view Aventior jobs</p>'), false)
})

const card = ({id,company='Aventior',location='Pune, Maharashtra, India',url='https://in.linkedin.com/jobs/view/engineer-'+id}) =>
  '<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:' + id + '"><a class="base-card__full-link" href="' + url + '"><h3 class="base-search-card__title">Engineer</h3></a><h4 class="base-search-card__subtitle"><a>' + company + '</a></h4><span class="job-search-card__location">' + location + '</span><time class="job-search-card__listdate--new" datetime="2026-10-03"></time></div>'

test('Aventior bounds mixed cards to preserve exact employer, India and LinkedIn URLs; runtime flags guest rows incomplete', async () => {
  const broken = '<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:999"><h3 class="base-search-card__title">Incomplete</h3></div>'
  const html = '<title>Aventior jobs in Worldwide</title>' + broken + card({id:101}) + card({id:102,company:'Other Company'}) + card({id:103,location:'Boston, MA, United States'}) + card({id:104,location:'Remote'}) + card({id:105,company:'aventior'}) + card({id:106,url:'https://unrelated.example/jobs/view/engineer-106'})
  assert.deepEqual(scraper.extractSearchResults(html).map(job => job.jobId), ['101'])
  const jobs = await scraper.run({fetchText:async url => url === scraper.LINKEDIN_COMPANY_JOBS_URL ? html : url.includes('/jobs/view/') ? '<html></html>' : fetchCaptured(url)})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].company, 'Aventior')
  assert.equal(jobs[0].sourceListingComplete, false)
})


test('Aventior final India filter rejects a public detail that contradicts the India listing', async () => {
  const jobsHtml = '<title>Aventior jobs in Worldwide</title>' + card({id:101})
  const detail = '<script type="application/ld+json">' + JSON.stringify({'@type':'JobPosting',title:'Engineer',hiringOrganization:{name:'Aventior'},jobLocation:{address:{addressLocality:'Boston',addressRegion:'MA',addressCountry:'US'}}}) + '</script>'
  const jobs = await scraper.run({fetchText:async url => url === scraper.LINKEDIN_COMPANY_JOBS_URL ? jobsHtml : url.includes('/jobs/view/') ? detail : fetchCaptured(url)})
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
