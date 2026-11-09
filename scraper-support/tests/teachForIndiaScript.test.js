import assert from 'node:assert/strict'
import test from 'node:test'

const loadTeachForIndiaModule = async () => {
  try {
    return await import('../../scraper/teachforindia/script.js')
  } catch {
    assert.fail('Expected Teach For India scraper module at ../../scraper/teachforindia/script.js')
  }
}

const landingHtml = `
<!doctype html>
<html>
  <body>
    <h2>Are you ready to lead with Love?</h2>
    <a href="https://teachforindia.my.salesforce-sites.com/careers">VIEW STAFF OPENINGS</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html>
  <body>
    <h4>Thank you for showing interest in our Staff roles!</h4>
    <p>For any questions, please write to us at - careers@teachforindia.org</p>
    <script>
      window.__tfiRemoting = {"csrf":"csrf-token-123","endpoint":"/careers/apexremote"};
    </script>
    <h4>CURRENTLY HIRING</h4>
  </body>
</html>
`

const remotePayload = [
  {
    action: 'TfiCareersPage_Controller',
    method: 'getAllJobSearchResult',
    state: 'SUCCESS',
    returnValue: [
      {
        Id: 'a0B123456789XYZ',
        Job_Description_Frontend_Name__c: 'Manager, Development',
        Location__c: 'Mumbai',
        Vertical__c: 'Development',
        Short_Description__c: 'Lead fundraising and partnerships for regional growth.',
      },
      {
        Id: 'a0B000000000NONE',
        Job_Description_Frontend_Name__c: 'Filtered Empty Row',
        Location__c: '',
        Vertical__c: 'Operations',
      },
    ],
  },
]

const detailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Manager, Development</h1>
    <div class="job-meta">
      <p><strong>Location:</strong> Mumbai</p>
      <p><strong>Vertical:</strong> Development</p>
      <p><strong>Experience:</strong> 5-8 years</p>
    </div>
    <section id="jobDescription">
      <p>Lead fundraising and partnerships for regional growth.</p>
      <ul>
        <li>Build institutional partnerships.</li>
        <li>Drive donor stewardship.</li>
      </ul>
    </section>
    <a class="apply-btn" href="mailto:careers@teachforindia.org">Apply Now</a>
  </body>
</html>
`

const noOpeningsHtml = `
<!doctype html>
<html>
  <body>
    <h4>Thank you for showing interest in our Staff roles!</h4>
    <p>For any questions, please write to us at - careers@teachforindia.org</p>
    <h4>CURRENTLY HIRING</h4>
    <ul><li><h4>No open positions found matching your filter criteria.</h4></li></ul>
  </body>
</html>
`

test('Teach For India validates the official careers handoff and normalizes Salesforce remoting listings', async () => {
  const teachForIndia = await loadTeachForIndiaModule()

  assert.equal(teachForIndia.WORK_WITH_US_URL, 'https://www.teachforindia.org/work-with-us')
  assert.equal(teachForIndia.CAREERS_URL, 'https://teachforindia.my.salesforce-sites.com/careers')
  assert.equal(teachForIndia.CAREERS_API_URL, 'https://teachforindia.my.salesforce-sites.com/careers/apexremote')
  assert.equal(teachForIndia.APPLICATION_URL, 'mailto:careers@teachforindia.org')
  assert.equal(typeof teachForIndia.hasOfficialLandingSignal, 'function')
  assert.equal(typeof teachForIndia.hasCareersSurfaceSignal, 'function')
  assert.equal(typeof teachForIndia.extractCsrfToken, 'function')
  assert.equal(typeof teachForIndia.buildRemotePayload, 'function')
  assert.equal(typeof teachForIndia.extractListingsFromRemote, 'function')
  assert.equal(typeof teachForIndia.extractJobDetail, 'function')
  assert.equal(typeof teachForIndia.createTeachForIndiaScraper, 'function')
  assert.equal(typeof teachForIndia.run, 'function')

  assert.equal(teachForIndia.hasOfficialLandingSignal(landingHtml), true)
  assert.equal(teachForIndia.hasCareersSurfaceSignal(careersHtml), true)
  assert.equal(teachForIndia.extractCsrfToken(careersHtml), 'csrf-token-123')
  assert.deepEqual(teachForIndia.buildRemotePayload('csrf-token-123'), [
    {
      action: 'TfiCareersPage_Controller',
      method: 'getAllJobSearchResult',
      data: [],
      type: 'rpc',
      tid: 1,
      ctx: {
        csrf: 'csrf-token-123',
        vid: '066xx0000000001',
        ns: '',
      },
    },
  ])

  assert.deepEqual(teachForIndia.extractListingsFromRemote(remotePayload), [
    {
      title: 'Manager, Development',
      company: 'Teach For India',
      department: 'Development',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'a0B123456789XYZ',
      requisitionId: 'a0B123456789XYZ',
      sourceUrl: 'https://teachforindia.my.salesforce-sites.com/careers/job?id=a0B123456789XYZ',
      applyUrl: 'mailto:careers@teachforindia.org',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead fundraising and partnerships for regional growth.',
    },
  ])
})

test('extractJobDetail maps Teach For India public detail pages into shared scraper fields', async () => {
  const teachForIndia = await loadTeachForIndiaModule()
  const listing = teachForIndia.extractListingsFromRemote(remotePayload)[0]
  const detail = teachForIndia.extractJobDetail(detailHtml, listing)

  assert.equal(detail.title, 'Manager, Development')
  assert.equal(detail.company, 'Teach For India')
  assert.equal(detail.department, 'Development')
  assert.equal(detail.location, 'Mumbai, India')
  assert.equal(detail.city, 'Mumbai')
  assert.equal(detail.country, 'India')
  assert.equal(detail.applyUrl, 'mailto:careers@teachforindia.org')
  assert.equal(detail.experienceRequired, '5-8 years')
  assert.match(detail.jobDescription, /Build institutional partnerships/i)
  assert.match(detail.jobDescription, /Drive donor stewardship/i)
})

test('run follows the official handoff, loads remote listings, and decorates shared runner fields', async () => {
  const teachForIndia = await loadTeachForIndiaModule()
  const requestedTexts = []
  const requestedPosts = []

  const jobs = await teachForIndia.createTeachForIndiaScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === teachForIndia.WORK_WITH_US_URL) return landingHtml
      if (url === teachForIndia.CAREERS_URL) return careersHtml
      if (url === 'https://teachforindia.my.salesforce-sites.com/careers/job?id=a0B123456789XYZ') return detailHtml
      throw new Error(`Unexpected Teach For India text URL: ${url}`)
    },
    postJson: async (url, body) => {
      requestedPosts.push([url, body])
      return remotePayload
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [
    'https://www.teachforindia.org/work-with-us',
    'https://teachforindia.my.salesforce-sites.com/careers',
    'https://teachforindia.my.salesforce-sites.com/careers/job?id=a0B123456789XYZ',
  ])
  assert.deepEqual(requestedPosts, [[
    'https://teachforindia.my.salesforce-sites.com/careers/apexremote',
    teachForIndia.buildRemotePayload('csrf-token-123'),
  ]])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'teachforindia')
  assert.equal(jobs[0].link, 'mailto:careers@teachforindia.org')
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:00:00.000Z')
})

test('run returns zero jobs cleanly when the verified Teach For India board is public but empty', async () => {
  const teachForIndia = await loadTeachForIndiaModule()

  const jobs = await teachForIndia.createTeachForIndiaScraper().run({
    fetchText: async (url) => {
      if (url === teachForIndia.WORK_WITH_US_URL) return landingHtml
      if (url === teachForIndia.CAREERS_URL) return noOpeningsHtml
      throw new Error(`Unexpected Teach For India text URL: ${url}`)
    },
    postJson: async () => {
      throw new Error('postJson should not be called when the board explicitly shows no open positions')
    },
  })

  assert.deepEqual(jobs, [])
})
