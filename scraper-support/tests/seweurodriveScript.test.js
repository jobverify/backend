import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/seweurodriveindiapvtltd/script.js')
  } catch {
    assert.fail('Expected SEW-Eurodrive India scraper module at ../../scraper/seweurodriveindiapvtltd/script.js')
  }
}

const careersHtml = `
  <html lang="en">
    <head>
      <title>Careers</title>
    </head>
    <body>
      <main>
        <h1>Your career at SEW-EURODRIVE</h1>
        <p>As a leading global specialist in drive technology, we keep the world moving.</p>
        <p>Join us and make your next move with us!</p>
        <h2>Job opportunities</h2>
        <p>Come and join our empowered, motivated, trained and qualified direct sales team.</p>
        <p>Take a look at our current job opportunities.</p>
        <p>You can find a list of current job offers as below:</p>
        <table>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Job Position</th>
              <th>Location</th>
              <th>Vertical</th>
              <th>Job Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Executive/Assistant Manager - Technical Sales</td>
              <td>Sriperumbudur/ Electronic city- Bangalore/Navi Mumbai</td>
              <td>Sales</td>
              <td><a href="https://media.sew-eurodrive.com/download/pdf/12345_Executive_Assistant_Manager_Technical_Sales.pdf">Click here (PDF, 462 KB)</a></td>
            </tr>
            <tr>
              <td>2</td>
              <td>Deputy Manager - Technical Sales( Resident)</td>
              <td>Ludhiana</td>
              <td>Sales</td>
              <td><a href="/download/pdf/98765_Deputy_Manager_Technical_Sales_Resident.pdf">click here (PDF, 465 KB)</a></td>
            </tr>
          </tbody>
        </table>
        <p>
          You may park your applications in the below link if you are interested to join us.
          <a href="/meta_seiten/web_online_contact_form_career.html">application form</a>
        </p>
        <a href="/meta_seiten/web_online_contact_form_career.xhtml">Apply now!</a>
        <footer>
          <p>In India, 400 employees are currently working with presence in almost 31 cities.</p>
        </footer>
      </main>
    </body>
  </html>
`

test('extractOpenings preserves SEW listing candidates without inventing country, requisitions or descriptions', async () => {
  const seweurodrive = await loadModule()

  assert.equal(seweurodrive.CAREERS_URL, 'https://www.seweurodriveindia.com/career/your_career/your_career.html')
  assert.equal(seweurodrive.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(seweurodrive.extractApplicationFormUrl(careersHtml), 'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html')
  const jobs = seweurodrive.extractOpenings(careersHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(job => job.title), [
    'Executive/Assistant Manager - Technical Sales',
    'Deputy Manager - Technical Sales( Resident)',
  ])
  assert.deepEqual(jobs.map(job => job.jobId), [
    'seweurodriveindiapvtltd-executive-assistant-manager-technical-sales-sales-sriperumbudur-electronic-city-bangalore-navi-mumbai',
    'seweurodriveindiapvtltd-deputy-manager-technical-sales-resident-sales-ludhiana',
  ])
  assert.deepEqual(jobs.map(job => job.location), [
    'Sriperumbudur/ Electronic city- Bangalore/Navi Mumbai', 'Ludhiana',
  ])
  assert.deepEqual(jobs.map(job => job.sourceUrl), [
    'https://media.sew-eurodrive.com/download/pdf/12345_Executive_Assistant_Manager_Technical_Sales.pdf',
    'https://www.seweurodriveindia.com/download/pdf/98765_Deputy_Manager_Technical_Sales_Resident.pdf',
  ])
  for (const job of jobs) {
    assert.equal(job.company, 'SEW-Eurodrive India Pvt Ltd')
    assert.equal(job.department, 'Sales')
    assert.equal(job.applyUrl, seweurodrive.extractApplicationFormUrl(careersHtml))
    assert.equal(job.country, null)
    assert.equal(job.sourceCountryScopeUnresolved, true)
    assert.equal(job.requisitionId, null)
    assert.equal(job.nativeLegalEmployer, null)
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.ok(job.listingSummary.includes(job.title))
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  const normalized = jobs.map(job => normalizeScrapedJob(job, { country: 'India', locationCountry: 'India' }))
  assert.equal(analyzePublishableJobs(normalized).indiaJobs.length, 0)
  assert.equal(analyzePublishableJobs(normalized).eligibleJobs.length, 0)
  assert.equal(extractionDetailHealth(jobs).missingDescriptions, 2)
})

test('run fetches the official SEW-EURODRIVE India careers page and decorates jobs for persistence', async () => {
  const seweurodrive = await loadModule()
  const requestedUrls = []

  const jobs = await seweurodrive.createSeweurodriveIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [seweurodrive.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'seweurodriveindiapvtltd')
  assert.equal(jobs[0].link, 'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run retains metadata-free PDF callback diagnostics without promoting text to verified native criteria', async () => {
  const seweurodrive = await loadModule()
  const requestedListingUrls = []
  const requestedDetailUrls = []

  const jobs = await seweurodrive.createSeweurodriveIndiaScraper().run({
    fetchText: async (url) => {
      requestedListingUrls.push(url)
      return careersHtml
    },
    fetchDocumentText: async (url) => {
      requestedDetailUrls.push(url)

      if (url.includes('12345_Executive_Assistant_Manager_Technical_Sales.pdf')) {
        return `
          Executive/Assistant Manager - Technical Sales
          EXPERIENCE : Minimum 2 years and above in selling similar products.
          RESPONSIBILITIES : Drive technical sales and customer engagement.
        `
      }

      if (url.includes('98765_Deputy_Manager_Technical_Sales_Resident.pdf')) {
        return `
          Deputy Manager - Technical Sales( Resident)
          EXPERIENCE: Min. 3 - 5 years in industrial sales.
          RESPONSIBILITIES : Own resident sales development in the region.
        `
      }

      throw new Error(`Unexpected SEW-EURODRIVE detail URL: ${url}`)
    },
  })

  assert.deepEqual(requestedListingUrls, [seweurodrive.CAREERS_URL])
  assert.deepEqual(requestedDetailUrls, [
    'https://media.sew-eurodrive.com/download/pdf/12345_Executive_Assistant_Manager_Technical_Sales.pdf',
    'https://www.seweurodriveindia.com/download/pdf/98765_Deputy_Manager_Technical_Sales_Resident.pdf',
  ])
  for (const job of jobs) {
    assert.equal(job.experienceRequired, null)
    assert.notEqual(job.publicExperienceChecked, true)
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.skipPublicExperienceEnrichment, true)
    assert.equal(job.country, null)
    assert.equal(job.requisitionId, null)
    assert.ok(job.sourceUnverifiedDetailDiagnostic.textBytes > 0)
    assert.match(job.sourceUnverifiedDetailDiagnostic.textSHA256, /^[a-f0-9]{64}$/)
  }
})

test('run keeps incomplete and empty PDF diagnostics unqualified and preserves every candidate', async () => {
  const seweurodrive = await loadModule()

  const jobs = await seweurodrive.createSeweurodriveIndiaScraper().run({
    fetchText: async () => careersHtml,
    fetchDocumentText: async (url) => {
      if (url.includes('12345_Executive_Assistant_Manager_Technical_Sales.pdf')) {
        return `
          Executive/Assistant Manager - Technical Sales
          QUALIFICATIONS : Diploma in engineering with strong product knowledge.
          RESPONSIBILITIES : Drive technical sales and customer engagement.
        `
      }

      return ''
    },
  })

  assert.equal(jobs.length, 2)
  for (const job of jobs) {
    assert.equal(job.experienceRequired, null)
    assert.notEqual(job.publicExperienceChecked, true)
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.ok(job.sourceDetailFailure)
  }
  assert.equal(jobs[0].sourceUnverifiedDetailDiagnostic.textBytes > 0, true)
  assert.equal(jobs[1].sourceUnverifiedDetailDiagnostic.textBytes, 0)
  assert.equal(extractionDetailHealth(jobs).missingDescriptions, 2)
})

test('extractOpenings rejects an unexpected SEW-EURODRIVE India careers page shape', async () => {
  const seweurodrive = await loadModule()

  assert.equal(seweurodrive.hasOfficialCareersSignal('<main><h1>Careers</h1></main>'), false)
  assert.throws(
    () => seweurodrive.extractOpenings('<main><h1>Careers</h1></main>'),
    /verified official careers surface/i,
  )
})
