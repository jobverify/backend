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

test('Immidart keeps original employer identity while current native careers replace the legacy SPA reader', async () => {
  const immidart = await loadImmidartModule()

  assert.equal(immidart.SOURCE, 'immidarttechnologiesllp')
  assert.equal(immidart.COMPANY, 'Immidart Technologies LLP')
  assert.equal(immidart.HOMEPAGE_URL, 'https://www.immidart.com/')
  assert.equal(immidart.CAREERS_URL, 'https://www.immidart.com/careers/')
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

test('Immidart legacy body-only bundle data cannot publish country or teaser-only jobs', async () => {
  const immidart = await loadImmidartModule()
  let calls = 0
  await assert.rejects(immidart.createImmidartTechnologiesLlpScraper().run({
    fetchText: async () => { calls++; return routeBundle },
  }), /native HTTP metadata|body-only/i)
  assert.equal(calls, 0)
})

test('Immidart certificate failures propagate without a second request', async () => {
  const immidart = await loadImmidartModule()
  let calls = 0
  const certificateError = Object.assign(new Error('certificate mismatch'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' })
  await assert.rejects(immidart.fetchImmidartText(immidart.HOMEPAGE_URL, { request: () => {
    calls++
    const req = new EventEmitter()
    req.end = () => req.emit('error', certificateError)
    return req
  } }), error => error === certificateError)
  assert.equal(calls, 1)
})

test('Immidart transport always verifies TLS for the verified host', async () => {
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

  const text = await immidart.fetchImmidartText(immidart.HOMEPAGE_URL, {
    request: fakeRequest,
  })

  assert.equal(text, homepageHtml)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, immidart.HOMEPAGE_URL)
  assert.equal(requests[0].options.rejectUnauthorized, true)
  assert.match(requests[0].options.headers['User-Agent'], /Mozilla\/5\.0/)

  await assert.rejects(
    immidart.fetchImmidartText('https://example.com/', {
      request: fakeRequest,
    }),
    /verified origins/i,
  )
})

test('Immidart legacy empty or shell markers cannot certify current native inventory', async () => {
  const immidart = await loadImmidartModule()
  for (const html of [homepageHtml, careersHtml, '<h1>No jobs available</h1>']) {
    await assert.rejects(immidart.createImmidartTechnologiesLlpScraper().run({
      fetchText: async () => html,
    }), /native HTTP metadata|body-only/i)
  }
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
