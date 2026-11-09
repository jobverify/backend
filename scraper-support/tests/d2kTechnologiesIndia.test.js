import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadCatalog = async () => import('../../scraper/d2ktechnologiesindia/catalog.js')
const loadScript = async () => import('../../scraper/d2ktechnologiesindia/script.js')

const careersHtml = `
<!doctype html>
<html>
  <head><title>Careers | D2K Technologies</title></head>
  <body>
    <h1>Why D2K?</h1>
    <p>Current Openings</p>
    <p>D2K Technologies India Pvt. Ltd.</p>
    <div>
      <div class="N8MGzv"><p><span><span><span style="letter-spacing:0.05em;" class="wixui-rich-text__text">SQL Developer</span></span></span></p></div>
      <div class="N8MGzv"><p>Experience: 1 to 4 years</p></div>
      <div class="N8MGzv">
        <ul class="font_8 wixui-rich-text__text">
          <li><p>Experience with T-SQL</p></li>
          <li><p>Integration Services, Reporting Services</p></li>
        </ul>
      </div>
      <div><a href="https://www.d2ktechnologies.com/sqldeveloper" aria-label="Apply Now">Apply Now</a></div>
    </div>
    <div>
      <div class="N8MGzv"><p><span><span><span style="letter-spacing:0.05em;" class="wixui-rich-text__text">Python Developer</span></span></span></p></div>
      <div class="N8MGzv"><p>Experience: 1 to 2 years</p></div>
      <div class="N8MGzv">
        <ul class="font_8 wixui-rich-text__text">
          <li><p>Experience using Python</p></li>
        </ul>
      </div>
      <div><a href="https://www.d2ktechnologies.com/pythondeveloper" aria-label="Apply Now">Apply Now</a></div>
    </div>
  </body>
</html>
`

test('D2K Technologies India catalog captures the verified first-party careers contract', async () => {
  const { D2K_TECHNOLOGIES_INDIA_CATALOG } = await loadCatalog()

  assert.equal(D2K_TECHNOLOGIES_INDIA_CATALOG.source, 'd2ktechnologiesindia')
  assert.equal(D2K_TECHNOLOGIES_INDIA_CATALOG.companyName, 'D2K Technologies India')
  assert.equal(D2K_TECHNOLOGIES_INDIA_CATALOG.companyCareerPage, 'https://www.d2ktechnologies.com/careerold.html')
  assert.equal(D2K_TECHNOLOGIES_INDIA_CATALOG.atsPlatform, 'official-company-site-job-cards')
  assert.match(D2K_TECHNOLOGIES_INDIA_CATALOG.verifiedSurfaceSummary, /MSBI Developer/i)
})

test('D2K Technologies India extracts same-domain careers cards', async () => {
  const d2k = await loadScript()

  assert.equal(d2k.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(d2k.extractJobCards(careersHtml), [
    {
      title: 'SQL Developer',
      location: null,
      city: null,
      country: null,
      sourceUrl: 'https://www.d2ktechnologies.com/sqldeveloper',
      applyUrl: 'https://www.d2ktechnologies.com/sqldeveloper',
      employmentType: 'Full Time',
      experienceRequired: '1 to 4 years',
      jobDescription: 'Experience with T-SQL Integration Services, Reporting Services',
      requiredSkills: ['Experience with T-SQL', 'Integration Services, Reporting Services'],
    },
    {
      title: 'Python Developer',
      location: null,
      city: null,
      country: null,
      sourceUrl: 'https://www.d2ktechnologies.com/pythondeveloper',
      applyUrl: 'https://www.d2ktechnologies.com/pythondeveloper',
      employmentType: 'Full Time',
      experienceRequired: '1 to 2 years',
      jobDescription: 'Experience using Python',
      requiredSkills: ['Experience using Python'],
    },
  ])
})

test('D2K Technologies India run normalizes job records and fails closed on drift', async () => {
  const d2k = await loadScript()
  const requestedUrls = []

  const jobs = await d2k.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml.replaceAll('Experience:', 'Job Location: Navi Mumbai, Maharashtra, India</p><p>Experience:')
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(requestedUrls, ['https://www.d2ktechnologies.com/careerold.html'])
  assert.equal(jobs[0].source, 'd2ktechnologiesindia')
  assert.equal(jobs[0].link, 'https://www.d2ktechnologies.com/sqldeveloper')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')

  await assert.rejects(
    d2k.run({ fetchText: async () => '<html><body>Unexpected</body></html>' }),
    /verified d2k careers page/i,
  )
})

test('D2K does not infer role geography from its registered office',async()=>{
 const d2k=await loadScript();const jobs=d2k.extractJobCards(careersHtml)
 assert.ok(jobs.every(job=>job.country===null&&job.location===null))
 const runJobs = await d2k.run({
  fetchText:async()=>careersHtml,
  now: () => '2026-09-14T00:00:00.000Z',
 })
 assert.deepEqual(runJobs, [])
 const evidence = readInventoryEvidence(runJobs)
 assert.equal(evidence?.status, 'discovery-only')
 assert.equal(evidence?.surface, d2k.CAREERS_URL)
 assert.equal(evidence?.listingComplete, false)
 assert.equal(evidence?.reportedTotal, 2)
})
test('D2K stops before requests when the source is cancelled',async()=>{
 const d2k=await loadScript(),reason=new Error('Source cancelled');let calls=0
 await assert.rejects(d2k.run({signal:AbortSignal.abort(reason),fetchText:async()=>{calls++;return careersHtml}}),error=>error===reason)
 assert.equal(calls,0)
})
