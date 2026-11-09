import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper-support/tests/fixtures/immidarttechnologiesllp',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('company-careers.html')
const routeBundle = readFixture('routes.js')

const loadImmidartModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Immidart Technologies LLP scraper module at ./script.js')
  }
}

test('Immidart Technologies LLP scraper constants stay pinned to the verified official careers SPA surface', async () => {
  const immidart = await loadImmidartModule()

  assert.equal(immidart.SOURCE, 'immidarttechnologiesllp')
  assert.equal(immidart.COMPANY, 'Immidart Technologies LLP')
  assert.equal(immidart.HOMEPAGE_URL, 'https://www.immidart.com/')
  assert.equal(immidart.CAREERS_URL, 'https://www.immidart.com/company/careers')
  assert.equal(immidart.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(immidart.extractBundlePath(homepageHtml), '/assets/index-C11kHmGj.js')
  assert.equal(immidart.extractBundlePath(careersHtml), '/assets/index-C11kHmGj.js')
  assert.equal(immidart.hasEmbeddedCareersRoute(routeBundle), true)

  const jobs = immidart.extractEmbeddedJobs(routeBundle)

  assert.equal(jobs.length, 10)
  assert.deepEqual(jobs[0], {
    id: 'bdm-1',
    title: 'Business Development Manager',
    location: 'Bangalore',
    experience: '10+ Years',
    positions: 1,
    department: 'business',
    description: 'Drive business growth and strategic partnerships for our global mobility solutions.',
  })
  assert.deepEqual(jobs.at(-1), {
    id: 'sm-1',
    title: 'Scrum Master - SaaS Product Development',
    location: 'Bangalore',
    experience: '3-5 Years',
    positions: 1,
    department: 'engineering',
    description: "Join our product engineering team as a Scrum Master and help drive structure, focus, and accountability across our SaaS product development. You'll work closely with Product, Engineering, QA, and DevOps teams to ensure smooth delivery of planned features, enhancements, and production support.",
    responsibilities: [
      'Lead agile ceremonies: stand-ups, sprint planning, backlog refinement, reviews, and retrospectives',
      'Facilitate sprint goal alignment and track progress using Jira/Confluence/Azure DevOps',
      'Centralize visibility of all deliverables and drive metrics-based improvements',
      'Coach teams and managers on Agile principles, collaboration, and accountability',
      'Promote a culture of continuous improvement and ownership',
    ],
    requirements: [
      '3-5 years as a Scrum Master or Agile Delivery Facilitator in a SaaS/product-based company',
      'Strong Agile/Scrum knowledge and hands-on experience with Jira/Confluence/Azure DevOps',
      'Excellent facilitation, coaching, and stakeholder management skills',
      'Scrum Master certification (CSM/PSM I) preferred but not mandatory',
    ],
  })
})

test('Immidart extracts the first-party role array after a bundle minifier renames its variable', async () => {
  const immidart = await loadImmidartModule()
  const renamedBundle = routeBundle.replaceAll('$3', '_O')
  const jobs = immidart.extractEmbeddedJobs(renamedBundle)
  assert.equal(jobs.length, 10)
  assert.equal(jobs[0].title, 'Business Development Manager')
})

test('Immidart Technologies LLP run decorates official first-party careers jobs from the embedded bundle payload', async () => {
  const immidart = await loadImmidartModule()
  const requestedUrls = []

  const jobs = await immidart.createImmidartTechnologiesLlpScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === immidart.HOMEPAGE_URL) return homepageHtml
      if (url === immidart.CAREERS_URL) return careersHtml
      if (url === 'https://www.immidart.com/assets/index-C11kHmGj.js') return routeBundle

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    immidart.HOMEPAGE_URL,
    immidart.CAREERS_URL,
    'https://www.immidart.com/assets/index-C11kHmGj.js',
  ])
  assert.equal(jobs.length, 10)
  assert.deepEqual(jobs[0], {
      title: 'Business Development Manager',
      company: 'Immidart Technologies LLP',
      location: 'Bangalore, India',
      city: 'Bangalore',
    country: 'India',
    source: 'immidarttechnologiesllp',
    sourceUrl: 'https://www.immidart.com/company/careers',
    applyUrl: 'https://www.immidart.com/company/careers',
    link: 'https://www.immidart.com/company/careers',
    jobId: 'immidarttechnologiesllp-bdm-1',
    requisitionId: 'immidarttechnologiesllp-bdm-1',
    department: 'business',
    experienceRequired: '10+ Years',
    employmentType: 'Full-time',
    remoteStatus: 'On-site',
    jobDescription: 'Drive business growth and strategic partnerships for our global mobility solutions.',
    requiredSkills: [],
    preferredQualification: null,
    closingDate: null,
    postingDate: null,
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[8].jobId, 'immidarttechnologiesllp-mt-hr-1')
  assert.equal(jobs[8].requiredSkills.length, 3)
  assert.equal(jobs[9].jobId, 'immidarttechnologiesllp-sm-1')
  assert.equal(jobs[9].requiredSkills.length, 4)
})

test('Immidart official fetch falls back only for the verified certificate alt-name mismatch', async () => {
  const immidart = await loadImmidartModule()
  const certificateError = Object.assign(
    new Error("Hostname/IP does not match certificate's altnames: Host: www.immidart.com."),
    { code: 'ERR_TLS_CERT_ALTNAME_INVALID' },
  )
  const fallbackUrls = []

  const page = await immidart.fetchTextWithOfficialFallback(immidart.HOMEPAGE_URL, {
    strictFetchText: async () => {
      throw certificateError
    },
    fallbackFetchText: async (url) => {
      fallbackUrls.push(url)
      return homepageHtml
    },
  })

  assert.equal(page, homepageHtml)
  assert.deepEqual(fallbackUrls, [immidart.HOMEPAGE_URL])

  await assert.rejects(
    immidart.fetchTextWithOfficialFallback('https://example.com/', {
      strictFetchText: async () => {
        throw certificateError
      },
      fallbackFetchText: async () => {
        throw new Error('Unexpected fallback for an unverified host')
      },
    }),
    /certificate's altnames/i,
  )

  await assert.rejects(
    immidart.fetchTextWithOfficialFallback(immidart.CAREERS_URL, {
      strictFetchText: async () => {
        throw new Error('HTTP 500 for https://www.immidart.com/company/careers')
      },
      fallbackFetchText: async () => {
        throw new Error('Unexpected fallback for a non-certificate error')
      },
    }),
    /HTTP 500/i,
  )
})

test('Immidart certificate-mismatch fallback disables TLS rejection only for the verified host', async () => {
  const immidart = await loadImmidartModule()
  const requests = []
  const fakeRequest = (url, options, callback) => {
    requests.push({ url, options })
    const request = new EventEmitter()
    request.setTimeout = () => request
    request.destroy = (error) => request.emit('error', error)
    request.end = () => {
      const response = new EventEmitter()
      response.statusCode = 200
      response.headers = {}
      response.setEncoding = () => {}
      callback(response)
      response.emit('data', homepageHtml)
      response.emit('end')
    }
    return request
  }

  const text = await immidart.fetchTextAllowingMismatchedCertificate(immidart.HOMEPAGE_URL, {
    request: fakeRequest,
  })

  assert.equal(text, homepageHtml)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, immidart.HOMEPAGE_URL)
  assert.equal(requests[0].options.rejectUnauthorized, false)
  assert.match(requests[0].options.headers['User-Agent'], /Mozilla\/5\.0/)

  await assert.rejects(
    immidart.fetchTextAllowingMismatchedCertificate('https://example.com/', {
      request: fakeRequest,
    }),
    /refusing certificate fallback/i,
  )
})

test('Immidart Technologies LLP fails closed when the verified first-party careers surface changes or loses embedded openings', async () => {
  const immidart = await loadImmidartModule()

  await assert.rejects(
    immidart.createImmidartTechnologiesLlpScraper().run({
      fetchText: async (url) => {
        if (url === immidart.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        if (url === immidart.CAREERS_URL) return careersHtml
        return routeBundle
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    immidart.createImmidartTechnologiesLlpScraper().run({
      fetchText: async (url) => {
        if (url === immidart.HOMEPAGE_URL) return homepageHtml
        if (url === immidart.CAREERS_URL) {
          return careersHtml.replace('/assets/index-C11kHmGj.js', '/assets/index-other.js')
        }
        return routeBundle
      },
    }),
    /verified official careers route/i,
  )

  await assert.rejects(
    immidart.createImmidartTechnologiesLlpScraper().run({
      fetchText: async (url) => {
        if (url === immidart.HOMEPAGE_URL) return homepageHtml
        if (url === immidart.CAREERS_URL) return careersHtml
        return routeBundle.replace('const $3=[', 'const $3=[]')
      },
    }),
    /embedded first-party job payload/i,
  )
})

const roleLiteral = (extra = '') => '{id:"one",title:"Engineer",location:"Bangalore",experience:"1-3 Years",department:"engineering",description:"Develop our product."' + extra + '}'

test('Immidart matches the client active filter on minified boolean constants', async () => {
  const immidart = await loadImmidartModule()
  const jobs = immidart.extractEmbeddedJobs('const roles=[' + roleLiteral(',active:!0') + ',' + roleLiteral(',active:!1').replace('id:"one"', 'id:"two"') + ',' + roleLiteral().replace('id:"one"', 'id:"legacy"') + ']')
  assert.deepEqual(jobs.map(job => job.id), ['one', 'legacy'])
  assert.deepEqual(immidart.extractEmbeddedJobs('const roles=[' + roleLiteral(',active:!1') + ']'), [])
})

test('Immidart rejects ambiguous active state, malformed active roles and duplicate identities', async () => {
  const immidart = await loadImmidartModule()
  for (const extra of [',active:"false"', ',active:null', ',active:0']) {
    assert.throws(() => immidart.extractEmbeddedJobs('const roles=[' + roleLiteral(extra) + ']'), /active/i)
  }
  assert.throws(() => immidart.extractEmbeddedJobs('const roles=[' + roleLiteral() + ',' + roleLiteral(',active:true') + ']'), /duplicate/i)
  assert.throws(() => immidart.extractEmbeddedJobs('const roles=[' + roleLiteral() + ',' + roleLiteral().replace('title:"Engineer"', 'title:""').replace('id:"one"', 'id:"two"') + ']'), /parseable/i)
})
