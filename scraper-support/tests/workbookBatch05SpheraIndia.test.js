import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/spheraindia/script.js')
  } catch {
    assert.fail('Expected Sphera India scraper module at ../../scraper/spheraindia/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Come work with us!</h1>
      <p>Worldwide opportunities</p>
      <a href="https://sphera.wd1.myworkdayjobs.com/careers">See all jobs</a>
      <a href="https://sphera.wd1.myworkdayjobs.com/careers">See jobs in technology</a>
      <a href="https://sphera.wd1.myworkdayjobs.com/careers">See jobs in consulting</a>
    </main>
  </body>
</html>
`

const bootstrapHtml = `
<!doctype html>
<html lang="en">
  <head><title>Sphera Careers</title></head>
  <body><main><h1>Open Jobs</h1></main></body>
</html>
`

const indiaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <dl>
      <dt>Locations</dt>
      <dd>Bangalore, India</dd>
    </dl>
    <dl>
      <dt>Department</dt>
      <dd>Engineering</dd>
    </dl>
    <dl>
      <dt>Requisition ID</dt>
      <dd>R12345</dd>
    </dl>
    <section data-automation-id="jobPostingDescription">
      <div>
        Build resilient sustainability workflows for enterprise customers.
      </div>
    </section>
  </body>
</html>
`

test('Sphera India verifies the first-party handoff and emits only India Workday roles', async () => {
  const sphera = await loadModule()
  const requests = []

  assert.equal(sphera.SOURCE, 'spheraindia')
  assert.equal(sphera.COMPANY, 'Sphera India')
  assert.equal(sphera.CAREERS_URL, 'https://sphera.com/company/join-our-team/')
  assert.equal(sphera.WORKDAY_BOARD_URL, 'https://sphera.wd1.myworkdayjobs.com/careers')
  assert.equal(sphera.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    sphera.extractVerifiedWorkdayBoardUrl(careersHtml),
    sphera.WORKDAY_BOARD_URL,
  )
  assert.deepEqual(
    sphera.extractVerifiedWorkdayCategoryLinks(careersHtml),
    [sphera.WORKDAY_BOARD_URL],
  )

  const jobs = await sphera.createSpheraIndiaScraper().run({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, method: options.method || 'GET' })

      if (url === sphera.CAREERS_URL) {
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'text/html; charset=UTF-8' },
          text: async () => careersHtml,
        }
      }

      if (url === `${sphera.WORKDAY_BOARD_URL}?locationCountry=${sphera.INDIA_LOCATION_COUNTRY_ID}`) {
        return {
          ok: true,
          status: 200,
          url,
          headers: {
            get: () => 'text/html; charset=UTF-8',
            getSetCookie: () => ['CALYPSO_CSRF_TOKEN=test-token; Path=/; Secure'],
          },
          text: async () => bootstrapHtml,
        }
      }

      if (url === 'https://sphera.wd1.myworkdayjobs.com/wday/cxs/sphera/careers/jobs') {
        assert.equal(options.method, 'POST')
        assert.deepEqual(JSON.parse(options.body), {
          appliedFacets: {
            locationCountry: [sphera.INDIA_LOCATION_COUNTRY_ID],
          },
          limit: 20,
          offset: 0,
          searchText: '',
        })

        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'application/json; charset=UTF-8' },
          json: async () => ({
            total: 2,
            jobPostings: [
              {
                title: 'Senior Software Engineer',
                locationsText: 'Bangalore, India',
                externalPath: '/job/Bangalore-India/Senior-Software-Engineer_R12345',
              },
              {
                title: 'Account Executive',
                locationsText: 'Chicago, Illinois',
                externalPath: '/job/Chicago-Illinois/Account-Executive_R54321',
              },
            ],
          }),
        }
      }

      if (url === 'https://sphera.wd1.myworkdayjobs.com/careers/job/Bangalore-India/Senior-Software-Engineer_R12345') {
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'text/html; charset=UTF-8' },
          text: async () => indiaDetailHtml,
        }
      }

      throw new Error(`Unexpected Sphera request: ${url}`)
    },
    retryBaseDelayMs: 0,
  })

  assert.deepEqual(requests, [
    { url: sphera.CAREERS_URL, method: 'GET' },
    {
      url: `${sphera.WORKDAY_BOARD_URL}?locationCountry=${sphera.INDIA_LOCATION_COUNTRY_ID}`,
      method: 'GET',
    },
    {
      url: 'https://sphera.wd1.myworkdayjobs.com/wday/cxs/sphera/careers/jobs',
      method: 'POST',
    },
    {
      url: 'https://sphera.wd1.myworkdayjobs.com/wday/cxs/sphera/careers/job/Bangalore-India/Senior-Software-Engineer_R12345',
      method: 'GET',
    },
    {
      url: 'https://sphera.wd1.myworkdayjobs.com/careers/job/Bangalore-India/Senior-Software-Engineer_R12345',
      method: 'GET',
    },
  ])

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    company: job.company,
    source: job.source,
    location: job.location,
    city: job.city,
    country: job.country,
    department: job.department,
    link: job.link,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    requisitionId: job.requisitionId,
  })), [
    {
      title: 'Senior Software Engineer',
      company: 'Sphera India',
      source: 'spheraindia',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      department: 'Engineering',
      link: 'https://sphera.wd1.myworkdayjobs.com/careers/job/Bangalore-India/Senior-Software-Engineer_R12345',
      sourceUrl: 'https://sphera.wd1.myworkdayjobs.com/careers/job/Bangalore-India/Senior-Software-Engineer_R12345',
      applyUrl: 'https://sphera.wd1.myworkdayjobs.com/careers/job/Bangalore-India/Senior-Software-Engineer_R12345',
      requisitionId: 'R12345',
    },
  ])
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.ok(jobs[0].jobDescription?.includes('sustainability workflows'))
})

test('Sphera India returns an authoritative empty result when the verified Workday board exposes no India roles', async () => {
  const sphera = await loadModule()

  const jobs = await sphera.createSpheraIndiaScraper().run({
    fetchImpl: async (url, options = {}) => {
      if (url === sphera.CAREERS_URL) {
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'text/html; charset=UTF-8' },
          text: async () => careersHtml,
        }
      }

      if (url === `${sphera.WORKDAY_BOARD_URL}?locationCountry=${sphera.INDIA_LOCATION_COUNTRY_ID}`) {
        return {
          ok: true,
          status: 200,
          url,
          headers: {
            get: () => 'text/html; charset=UTF-8',
            getSetCookie: () => ['CALYPSO_CSRF_TOKEN=test-token; Path=/; Secure'],
          },
          text: async () => bootstrapHtml,
        }
      }

      if (url === 'https://sphera.wd1.myworkdayjobs.com/wday/cxs/sphera/careers/jobs') {
        assert.equal(options.method, 'POST')
        return {
          ok: true,
          status: 200,
          url,
          headers: { get: () => 'application/json; charset=UTF-8' },
          json: async () => ({
            total: 0,
            jobPostings: [],
          }),
        }
      }

      throw new Error(`Unexpected Sphera request: ${url}`)
    },
    retryBaseDelayMs: 0,
  })

  assert.deepEqual(jobs, [])
})

test('Sphera India fails closed when the verified first-party careers-to-Workday contract is absent', async () => {
  const sphera = await loadModule()
  const requests = []

  const jobs = await sphera.createSpheraIndiaScraper().run({
    fetchImpl: async (url) => {
      requests.push(url)
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'text/html; charset=UTF-8' },
        text: async () => `
          <html>
            <body>
              <main>
                <h1>Join Our Team</h1>
                <p>Global careers</p>
                <a href="https://sphera.wd1.myworkdayjobs.com/careers">See all jobs</a>
              </main>
            </body>
          </html>
        `,
      }
    },
  })

  assert.deepEqual(requests, [sphera.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
