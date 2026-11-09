import assert from 'node:assert/strict'
import test from 'node:test'

const loadAesTechnologiesModule = async () => {
  try {
    return await import('../../scraper/aestechnologies/script.js')
  } catch {
    assert.fail('Expected AES Technologies scraper module at ../../scraper/scraper/aestechnologies/script.js')
  }
}

const sampleListingHtml = `
<div id="content_innerpage_rightmain">
  <h2>Current Openings</h2>
  <table>
    <tr>
      <td style="color: #00BFFF"><b>APPLICATION MAINTENANCE SUPPORT PROJECT(24*7)</b></td>
    </tr>
    <tr>
      <td>
        <a href="https://careers.advanceecomsolutions.com/job-detail/319">
          <b class="careers-arrow">Presales Solution Architect – Azure Data & AI [Remote]&nbsp;<blink>Hot</blink></b>
        </a>
      </td>
    </tr>
  </table>
</div>
`

const sampleDetailHtml = `
<div class="careers-details">
  <table>
    <tr>
      <td>
        <a href="https://careers.advanceecomsolutions.com/apply-job/319">
          <b>Presales Solution Architect – Azure Data & AI [Remote] (PSA[110626])</b>
        </a>
      </td>
    </tr>
    <tr>
      <td>
        <p><p><strong>As a Presales Solution Architect – Azure Data & AI</strong>, you will play a crucial role in designing and implementing data analytics and AI solutions on the Azure platform.<br><br><strong>Key Responsibility :</strong><br>• Collaborate with cross-functional teams to gather requirements and design end to-end data and AI solutions.<br><br>• Job Function Sales Accommodations</p></p>
      </td>
    </tr>
    <tr>
      <td align="right"><a href="https://careers.advanceecomsolutions.com/apply-job/319"><b class="apply">Apply for this Job</b></a></td>
    </tr>
  </table>
</div>
`

test('extractSearchResults maps AES Technologies careers pages into conservative job records', async () => {
  const aes = await loadAesTechnologiesModule()
  const listings = aes.extractListings(sampleListingHtml)
  const jobs = listings.map((listing) => aes.extractJobDetail(sampleDetailHtml, listing))

  assert.equal(aes.pageIndicatesJobs(sampleListingHtml), true)
  assert.equal(listings.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Presales Solution Architect - Azure Data & AI [Remote]',
    company: 'AES Technologies',
    department: 'Presales Solution Architect - Azure Data & AI [Remote]',
    location: 'Remote, India',
    city: null,
    country: 'India',
    jobId: 'aestechnologies-319',
    requisitionId: '319',
    sourceUrl: 'https://careers.advanceecomsolutions.com/careers',
    applyUrl: 'https://careers.advanceecomsolutions.com/apply-job/319',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'As a Presales Solution Architect - Azure Data & AI, you will play a crucial role in designing and implementing data analytics and AI solutions on the Azure platform. Key Responsibility : • Collaborate with cross-functional teams to gather requirements and design end to-end data and AI solutions. • Job Function Sales Accommodations Apply via the AES Technologies careers page.',
  })
})

test('run fetches the AES Technologies careers listing and detail page and decorates the openings', async () => {
  const aes = await loadAesTechnologiesModule()
  const requestedUrls = []
  const scraper = aes.createAesTechnologiesScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === aes.CAREER_PAGE_URL) return sampleListingHtml
      if (url === 'https://careers.advanceecomsolutions.com/job-detail/319') return sampleDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      aes.CAREER_PAGE_URL,
      'https://careers.advanceecomsolutions.com/job-detail/319',
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'aestechnologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})
