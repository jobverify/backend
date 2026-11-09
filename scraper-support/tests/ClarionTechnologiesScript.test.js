import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html><head><title>Careers | Clarion Technologies</title></head>
<body>
  <p>Permanent Work From Home Opportunity</p>
  <iframe src="https://jobs.clariontechnologies.co.in:444/featured-job"></iframe>
</body></html>
`

const featuredHtml = `
<!doctype html>
<html><head><title>Careers | Clarion Technologies</title></head><body>
  <h1>Featured Jobs</h1><h2>Current Openings [1]</h2>
  <table><tbody><tr>
    <td><img src="/images/development.png"></td>
    <td>
      <a class="h2" href="https://www.clariontech.com/open-position-detail?jobid=2674">SQL Database Developer</a>
      <p><span>Pune</span></p>
    </td>
    <td><p>3 - 5 years</p></td>
    <td><p>Pune - <b>2</b></p></td>
    <td><label class="badge-orange">Urgent</label></td>
    <td><a href="https://www.clariontech.com/open-position-detail?jobid=2674">Apply Now</a></td>
  </tr></tbody></table>
  <a href="https://www.clariontech.com/open-positions">View All Openings</a>
</body></html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/clariontechnologies/script.js')
  } catch {
    assert.fail('Expected Clarion Technologies scraper module at ../../scraper/clariontechnologies/script.js')
  }
}

test('Clarion Technologies validators stay pinned to the verified featured-jobs handoff from Friday, July 17, 2026', async () => {
  const clarion = await loadModule()
  assert.equal(clarion.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(clarion.hasFeaturedJobsSignal(featuredHtml), true)
  assert.equal(clarion.VERIFIED_ON, '2026-08-07')
})

test('Clarion Technologies default fetch page keeps verified TLS and scraper headers for the iframe host', async () => {
  const clarion = await loadModule()
  let capturedUrl = null
  let capturedOptions = null

  await clarion.defaultFetchPage(clarion.FEATURED_JOBS_URL, {
    fetchPageImpl: async (url, options) => {
      capturedUrl = url
      capturedOptions = options
      return { status: 200, url, html: featuredHtml }
    },
  })

  assert.equal(capturedUrl, clarion.FEATURED_JOBS_URL)
  assert.equal(Object.hasOwn(capturedOptions, 'allowInsecureTlsHosts'), false)
  assert.equal(capturedOptions.label, 'clariontechnologies')
  assert.match(capturedOptions.headers['User-Agent'], /Mozilla\/5\.0/)
})

test('Clarion Technologies retries only its job host certificate-chain failure through verified native HTTPS', async () => {
  const clarion = await loadModule()
  const calls = []

  const html = await clarion.fetchClarionJobsText(clarion.FEATURED_JOBS_URL, {
    fetchPage: async () => {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: {
          code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
          message: 'unable to verify the first certificate',
        },
      })
    },
    execFile: async (file, args, options) => {
      calls.push({ file, args, options })
      return { stdout: featuredHtml }
    },
  })

  assert.equal(html, featuredHtml)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].file, process.platform === 'win32' ? 'curl.exe' : 'curl')
  assert.ok(calls[0].args.includes('--disable'))
  assert.ok(calls[0].args.includes('=https'))
  assert.equal(calls[0].args.includes('--insecure'), false)
  assert.equal(calls[0].args.includes('-k'), false)
  assert.equal(calls[0].args.at(-1), clarion.FEATURED_JOBS_URL)
  assert.equal(calls[0].options.windowsHide, true)
})

test('Clarion Technologies never invokes its native transport fallback for another host', async () => {
  const clarion = await loadModule()
  const expected = new Error('unable to verify the first certificate')
  let nativeCalls = 0

  await assert.rejects(
    clarion.fetchClarionJobsText('https://example.com/featured-job', {
      fetchPage: async () => {
        throw expected
      },
      execFile: async () => {
        nativeCalls += 1
        return { stdout: featuredHtml }
      },
    }),
    (error) => error === expected,
  )

  assert.equal(nativeCalls, 0)
})

test('Clarion Technologies run validates the verified page and iframe surface and stays fail-closed', async () => {
  const clarion = await loadModule()
  const jobs = await clarion.createClarionTechnologiesScraper({
    now: () => '2026-09-13T00:00:00.000Z',
  }).run({
    fetchText: async (url) => (url === clarion.CAREERS_URL ? careersHtml : featuredHtml),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'SQL Database Developer',
    company: 'Clarion Technologies',
    department: null,
    location: 'Pune',
    city: 'Pune',
    state: null,
    country: 'India',
    jobId: 'clariontechnologies-2674',
    requisitionId: '2674',
    sourceUrl: 'https://www.clariontech.com/open-position-detail?jobid=2674',
    applyUrl: 'https://www.clariontech.com/open-position-detail?jobid=2674',
    link: 'https://www.clariontech.com/open-position-detail?jobid=2674',
    employmentType: null,
    workplaceType: null,
    remoteStatus: null,
    experienceRequired: '3 - 5 years',
    numberOfPositions: 2,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    companyCareerPage: clarion.CAREERS_URL,
    companyDomain: 'clariontech.com',
    atsPlatform: 'official-company-careers',
    source: 'clariontechnologies',
    scrapedAt: '2026-09-13T00:00:00.000Z',
  })
})
