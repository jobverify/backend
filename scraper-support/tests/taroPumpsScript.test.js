import assert from 'node:assert/strict'
import test from 'node:test'

const loadTaroPumpsModule = async () => {
  try {
    return await import('../../scraper/taropumps/script.js')
  } catch {
    assert.fail('Expected Taro Pumps scraper module at ../../scraper/taropumps/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers at Taro Pumps</h1>
      <p>Apply here or email us at jobs@texmo.com</p>
      <section>
        <h2>Latest careers</h2>
        <article>
          <span>NEW</span>
          <a href="https://www.texmo.com/career-details?id=541133&title=+Assistant++Engineer+-++Design+%28Electrical%29">
            <h3>ASSISTANT ENGINEER - DESIGN (ELECTRICAL)</h3>
            <p>COIMBATORE</p>
            <p>INDIA</p>
            <p>PRODUCT ENGINEERING</p>
          </a>
        </article>
        <article>
          <a href="https://www.texmo.com/career-details?id=542917&title=+Engineer+-+Product">
            <h3>ENGINEER - PRODUCT</h3>
            <p>COIMBATORE</p>
            <p>INDIA</p>
            <p>PRODUCT ENGINEERING</p>
          </a>
        </article>
        <a href="https://www.texmo.com/careers/">View all jobs</a>
      </section>
    </main>
  </body>
</html>
`

const taroServerErrorHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Oops, there was a server error</h1>
    <p>500 Internal Server Error</p>
    <a href="/careers">Careers</a>
  </body>
</html>
`

const texmoCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Latest Careers</h2>
      <a href="https://www.texmo.com/career-details?id=548889&title=3D+Animator">
        3D Animator Coimbatore India Customer Service
      </a>
      <a href="https://www.texmo.com/career-details?id=541133&title=+Assistant++Engineer+-++Design+%28Electrical%29">
        Assistant Engineer - Design (Electrical) Coimbatore India Product Engineering
      </a>
      <a href="https://www.texmo.com/career-details?id=544010&title=+Senior+Engineer+-++Continuous+Improvement">
        Senior Engineer - Continuous Improvement Coimbatore India Program Management Office
      </a>
      <a href="https://www.texmo.com/career-details?id=524852&title=Engineer+-+Electrical+Design+">
        Engineer - Electrical Design Coimbatore India Manufacturing Operations
      </a>
      <a href="https://www.texmo.com/career-details?id=555555&title=Temporary+Project+Accountant">
        Temporary Project Accountant Riedlingen Germany Finance
      </a>
      <section>
        <h3>Why Work With Us</h3>
        <p>Taro Pumps</p>
      </section>
    </main>
  </body>
</html>
`

test('Taro Pumps scraper validates the verified official careers page and extracts first-party Texmo detail cards', async () => {
  const taroPumps = await loadTaroPumpsModule()

  assert.equal(taroPumps.SOURCE, 'taropumps')
  assert.equal(taroPumps.COMPANY, 'Taro Pumps')
  assert.equal(taroPumps.CAREERS_URL, 'https://www.taropumps.com/careers')
  assert.equal(taroPumps.VIEW_ALL_JOBS_URL, 'https://www.texmo.com/careers/')
  assert.equal(taroPumps.TEXMO_CAREERS_URL, 'https://www.texmo.com/careers/')
  assert.equal(taroPumps.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    taroPumps.extractViewAllJobsUrl(officialCareersHtml),
    'https://www.texmo.com/careers/',
  )
  assert.deepEqual(taroPumps.extractJobCards(officialCareersHtml), [
    {
      title: 'ASSISTANT ENGINEER - DESIGN (ELECTRICAL)',
      location: 'COIMBATORE, INDIA',
      city: 'COIMBATORE',
      country: 'India',
      department: 'PRODUCT ENGINEERING',
      jobId: '541133',
      requisitionId: '541133',
      sourceUrl: 'https://www.texmo.com/career-details?id=541133&title=+Assistant++Engineer+-++Design+%28Electrical%29',
      applyUrl: 'https://www.texmo.com/career-details?id=541133&title=+Assistant++Engineer+-++Design+%28Electrical%29',
      employmentType: null,
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'ENGINEER - PRODUCT',
      location: 'COIMBATORE, INDIA',
      city: 'COIMBATORE',
      country: 'India',
      department: 'PRODUCT ENGINEERING',
      jobId: '542917',
      requisitionId: '542917',
      sourceUrl: 'https://www.texmo.com/career-details?id=542917&title=+Engineer+-+Product',
      applyUrl: 'https://www.texmo.com/career-details?id=542917&title=+Engineer+-+Product',
      employmentType: null,
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Taro Pumps fallback Texmo board exposes current India roles when the branded careers page is unavailable', async () => {
  const taroPumps = await loadTaroPumpsModule()

  assert.equal(taroPumps.hasOfficialTexmoCareersSignal(texmoCareersHtml), true)
  assert.deepEqual(taroPumps.extractTexmoGroupJobCards(texmoCareersHtml), [
    {
      title: '3D Animator',
      location: 'Coimbatore, INDIA',
      city: 'Coimbatore',
      country: 'India',
      department: 'Customer Service',
      jobId: '548889',
      requisitionId: '548889',
      sourceUrl: 'https://www.texmo.com/career-details?id=548889&title=3D+Animator',
      applyUrl: 'https://www.texmo.com/career-details?id=548889&title=3D+Animator',
      employmentType: null,
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Assistant Engineer - Design (Electrical)',
      location: 'Coimbatore, INDIA',
      city: 'Coimbatore',
      country: 'India',
      department: 'Product Engineering',
      jobId: '541133',
      requisitionId: '541133',
      sourceUrl: 'https://www.texmo.com/career-details?id=541133&title=+Assistant++Engineer+-++Design+%28Electrical%29',
      applyUrl: 'https://www.texmo.com/career-details?id=541133&title=+Assistant++Engineer+-++Design+%28Electrical%29',
      employmentType: null,
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Engineer - Continuous Improvement',
      location: 'Coimbatore, INDIA',
      city: 'Coimbatore',
      country: 'India',
      department: 'Program Management Office',
      jobId: '544010',
      requisitionId: '544010',
      sourceUrl: 'https://www.texmo.com/career-details?id=544010&title=+Senior+Engineer+-++Continuous+Improvement',
      applyUrl: 'https://www.texmo.com/career-details?id=544010&title=+Senior+Engineer+-++Continuous+Improvement',
      employmentType: null,
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Engineer - Electrical Design',
      location: 'Coimbatore, INDIA',
      city: 'Coimbatore',
      country: 'India',
      department: 'Manufacturing Operations',
      jobId: '524852',
      requisitionId: '524852',
      sourceUrl: 'https://www.texmo.com/career-details?id=524852&title=Engineer+-+Electrical+Design+',
      applyUrl: 'https://www.texmo.com/career-details?id=524852&title=Engineer+-+Electrical+Design+',
      employmentType: null,
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('run falls back to the Texmo group careers board when the branded Taro page is broken', async () => {
  const taroPumps = await loadTaroPumpsModule()
  const requestedUrls = []

  const jobs = await taroPumps.createTaroPumpsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === taroPumps.CAREERS_URL) return taroServerErrorHtml
      if (url === taroPumps.TEXMO_CAREERS_URL) return texmoCareersHtml
      throw new Error(`Unexpected Taro Pumps fixture URL: ${url}`)
    },
    now: () => '2026-08-05T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    taroPumps.CAREERS_URL,
    taroPumps.TEXMO_CAREERS_URL,
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].company, 'Taro Pumps')
  assert.equal(jobs[0].source, 'taropumps')
  assert.equal(jobs[0].link, 'https://www.texmo.com/career-details?id=548889&title=3D+Animator')
  assert.equal(jobs[0].scrapedAt, '2026-08-05T00:00:00.000Z')
})

test('run falls back to the Texmo group careers board when the branded Taro page returns HTTP 503', async () => {
  const taroPumps = await loadTaroPumpsModule()
  const requestedUrls = []

  const jobs = await taroPumps.createTaroPumpsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === taroPumps.CAREERS_URL) {
        throw new Error(`HTTP 503 for ${url}`)
      }
      if (url === taroPumps.TEXMO_CAREERS_URL) return texmoCareersHtml
      throw new Error(`Unexpected Taro Pumps fixture URL: ${url}`)
    },
    now: () => '2026-08-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    taroPumps.CAREERS_URL,
    taroPumps.TEXMO_CAREERS_URL,
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].company, 'Taro Pumps')
  assert.equal(jobs[0].source, 'taropumps')
  assert.equal(jobs[0].scrapedAt, '2026-08-14T00:00:00.000Z')
})

test('run creates a browser fallback session by default when both HTTP surfaces time out', async () => {
  const taroPumps = await loadTaroPumpsModule()
  const fetchCalls = []
  const browserCalls = []
  const originalFetch = globalThis.fetch
  let closed = false

  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url))
    const error = new TypeError('fetch failed')
    error.cause = {
      code: 'UND_ERR_CONNECT_TIMEOUT',
      message: `Connect Timeout Error for ${url}`,
    }
    throw error
  }

  try {
    const jobs = await taroPumps.createTaroPumpsScraper().run({
      createBrowserSession: async () => ({
        fetchText: async (url) => {
          browserCalls.push(url)
          if (url === taroPumps.CAREERS_URL) return taroServerErrorHtml
          if (url === taroPumps.TEXMO_CAREERS_URL) return texmoCareersHtml
          throw new Error(`Unexpected Taro Pumps browser URL: ${url}`)
        },
        close: async () => {
          closed = true
        },
      }),
      now: () => '2026-08-05T00:00:00.000Z',
    })

    assert.equal(jobs.length, 4)
    assert.deepEqual(fetchCalls, [
      taroPumps.CAREERS_URL,
      taroPumps.TEXMO_CAREERS_URL,
    ])
    assert.deepEqual(browserCalls, [
      taroPumps.CAREERS_URL,
      taroPumps.TEXMO_CAREERS_URL,
    ])
    assert.equal(closed, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('run still accepts the original branded careers page when that inline surface is available', async () => {
  const taroPumps = await loadTaroPumpsModule()

  const jobs = await taroPumps.createTaroPumpsScraper().run({
    fetchText: async (url) => {
      if (url === taroPumps.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected Taro Pumps fixture URL: ${url}`)
    },
    now: () => '2026-08-05T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'ASSISTANT ENGINEER - DESIGN (ELECTRICAL)')
  assert.equal(jobs[1].title, 'ENGINEER - PRODUCT')
})

test('Taro Pumps returns an empty result when both branded and Texmo careers surfaces time out', async () => {
  const taroPumps = await loadTaroPumpsModule()
  const requestedUrls = []
  let closed = false

  const jobs = await taroPumps.createTaroPumpsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: www.texmo.com:443, timeout: 10000ms)',
      }
      throw error
    },
    createBrowserSession: async () => ({
      fetchText: async (url) => {
        requestedUrls.push(`browser:${url}`)
        const error = new TypeError('fetch failed')
        error.cause = {
          code: 'UND_ERR_CONNECT_TIMEOUT',
          message: `Connect Timeout Error for ${url}`,
        }
        throw error
      },
      close: async () => {
        closed = true
      },
    }),
  })

  assert.deepEqual(requestedUrls, [
    taroPumps.CAREERS_URL,
    `browser:${taroPumps.CAREERS_URL}`,
    taroPumps.TEXMO_CAREERS_URL,
    `browser:${taroPumps.TEXMO_CAREERS_URL}`,
  ])
  assert.deepEqual(jobs, [])
  assert.equal(closed, true)
})
