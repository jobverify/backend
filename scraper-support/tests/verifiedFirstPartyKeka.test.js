import assert from 'node:assert/strict'
import test from 'node:test'

import { createVerifiedFirstPartyKekaScraper } from '../shared/verifiedFirstPartyKeka.js'

const ID = '11111111-1111-4111-8111-111111111111'
const ROOT = 'https://example.keka.com/careers/'
const OFFICIAL = 'https://example.com/careers'
const HANDOFF = 'https://example.keka.com/careers'
const DOCUMENT = 'https://example.keka.com/ats/documents/' + ID + '/careerportal/portal.html'
const EMBED = ROOT + 'api/embedjobs/js/' + ID
const PORTAL_INFO = ROOT + 'api/organization/default/careerportalinfo'
const ACTIVE = ROOT + 'api/embedjobs/default/active/' + ID

const fallbackRule = {
  id: '2',
  title: 'Remote India Engineer',
  descriptionIncludes: ['Location: Remote', 'joining the dedicated engineering team in India'],
  location: { name: 'Remote', city: 'Remote', state: null, countryCode: 'IN', countryName: 'India' },
}

const directConfig = {
  source: 'example-keka',
  companyName: 'Example',
  officialUrl: OFFICIAL,
  handoffType: 'portal-link',
  handoffUrl: HANDOFF,
  portalShellUrl: HANDOFF,
  kekaRootUrl: ROOT,
  identifier: ID,
  portalName: 'default',
  portalIdentity: { name: 'Example Technologies', shortName: 'Example Technologies', domain: 'example.keka.com' },
  descriptionLocationRules: [fallbackRule],
}

const officialHtml = '<a href="' + HANDOFF + '">Careers</a>'
const shellHtml = '<script>fetch(\'/ats/documents/' + ID + '/careerportal/portal.html\')</script>'
const portalHtml = '<script>window.khConfig={identifier:\'' + ID + '\',domain:\'' + ROOT + '\'}</script><script src="' + EMBED + '"></script>'
const embedScript = 'fetch(khConfig.domain + `api/organization/${portalName}/careerportalinfo`); fetch(khConfig.domain + `api/embedjobs/${portalName}/active/` + khConfig.identifier); job.jobLocations.forEach(render); khConfig.domain + portalNameUrl + \'jobdetails/\' + job.id'
const portalInfo = { name: 'Example Technologies', shortName: 'Example Technologies', careersPortalDomain: 'example.keka.com' }

const job = (id, title, locations, description = '<p>Build reliable products.</p>') => ({
  id,
  title,
  description,
  departmentIdentifier: '22222222-2222-4222-8222-222222222222',
  departmentName: 'Engineering',
  experience: '3-5',
  jobType: 2,
  publishedOn: '2026-09-13T00:00:00Z',
  skillNames: ['JavaScript'],
  jobLocations: locations,
})
const indiaLocation = { id: 1, name: 'Bangalore', city: 'Bengaluru', state: 'KA', countryCode: 'IN', countryName: 'India' }
const foreignLocation = { id: 2, name: 'London', city: 'London', state: 'England', countryCode: 'GB', countryName: 'United Kingdom' }
const indiaJob = job(1, 'India Engineer', [indiaLocation])
const fallbackJob = job(2, fallbackRule.title, [], '<p>Location: Remote. You will be joining the dedicated engineering team in India.</p>')
const foreignJob = job(3, 'UK Engineer', [foreignLocation])

const response = (url, body) => ({
  ok: true,
  status: 200,
  url,
  text: async () => String(body),
  json: async () => structuredClone(body),
})

const createFetch = ({ official = officialHtml, shell = shellHtml, portal = portalHtml, script = embedScript, info = portalInfo, jobs = [indiaJob, fallbackJob, foreignJob] } = {}) => async (url) => {
  if (url === OFFICIAL) return response(url, official)
  if (url === HANDOFF) return response(url, shell)
  if (url === DOCUMENT) return response(url, portal)
  if (url === EMBED) return response(url, script)
  if (url === PORTAL_INFO) return response(url, info)
  if (url === ACTIVE) return response(url, jobs)
  throw new Error('Unexpected URL ' + url)
}

test('verified Keka proves the first-party handoff, portal identity, renderer contract, and full active array', async () => {
  const calls = []
  const jobs = await createVerifiedFirstPartyKekaScraper(directConfig).run({
    fetchImpl: async (url, options) => { calls.push([url, options.signal]); return createFetch()(url) },
  })
  assert.deepEqual(calls.map(([url]) => url), [OFFICIAL, HANDOFF, DOCUMENT, EMBED, PORTAL_INFO, ACTIVE])
  assert.deepEqual(jobs.map(({ source, company, jobId, location, city, country }) => ({ source, company, jobId, location, city, country })), [
    { source: directConfig.source, company: 'Example', jobId: '1', location: 'Bangalore, KA, India', city: 'Bangalore', country: 'India' },
    { source: directConfig.source, company: 'Example', jobId: '2', location: 'Remote, India', city: 'Remote', country: 'India' },
  ])
  assert.ok(jobs.every((item) => item.sourceListingComplete === true && item.jobDescription))
  assert.ok(jobs.every((item) => item.applyUrl === item.sourceUrl && /\/jobdetails\//.test(item.applyUrl)))
})

test('verified Keka supports an exact first-party embedded khConfig without a portal-shell round trip', async () => {
  const config = {
    ...directConfig,
    handoffType: 'embedded-script',
    handoffUrl: EMBED,
    portalShellUrl: undefined,
    descriptionLocationRules: [],
  }
  const embeddedOfficial = '<script>window.khConfig={identifier:\'' + ID + '\',domain:\'' + ROOT + '\'}</script><script src="' + EMBED + '"></script>'
  const calls = []
  const jobs = await createVerifiedFirstPartyKekaScraper(config).run({
    fetchImpl: async (url) => {
      calls.push(url)
      if (url === OFFICIAL) return response(url, embeddedOfficial)
      return createFetch({ jobs: [indiaJob] })(url)
    },
  })
  assert.deepEqual(calls, [OFFICIAL, EMBED, PORTAL_INFO, ACTIVE])
  assert.equal(jobs.length, 1)
})

test('verified Keka fails closed on stale handoffs, portal identity changes, and renderer drift', async () => {
  const cases = [
    { fetchImpl: createFetch({ official: '<p>Careers</p>' }), pattern: /handoff/i },
    { fetchImpl: createFetch({ official: '<script>const decoy = \'<a href="' + HANDOFF + '">careers</a>\'</script>' }), pattern: /handoff/i },
    { fetchImpl: createFetch({ shell: '<p>Careers</p>' }), pattern: /document/i },
    { fetchImpl: createFetch({ portal: portalHtml.replace(ID, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') }), pattern: /configuration|identity/i },
    { fetchImpl: createFetch({ script: 'const jobs = []' }), pattern: /renderer|contract/i },
    { fetchImpl: createFetch({ info: { ...portalInfo, name: 'Other Company' } }), pattern: /portal identity/i },
  ]
  for (const sample of cases) {
    await assert.rejects(createVerifiedFirstPartyKekaScraper(directConfig).run({ fetchImpl: sample.fetchImpl }), sample.pattern)
  }
})

test('verified Keka validates every raw row before filtering and rejects unknown geography or weak description fallbacks', async () => {
  const malformed = [
    [indiaJob, indiaJob],
    [indiaJob, { ...foreignJob, title: '' }],
    [indiaJob, { ...foreignJob, description: '' }],
    [indiaJob, { ...foreignJob, jobLocations: {} }],
    [indiaJob, { ...foreignJob, jobLocations: [{ ...foreignLocation, countryCode: null }] }],
    [indiaJob, { ...foreignJob, jobLocations: [{ ...foreignLocation, countryCode: '001', countryName: 'World' }] }],
    [indiaJob, { ...foreignJob, jobLocations: [{ ...foreignLocation, countryCode: 'EU', countryName: 'European Union' }] }],
    [indiaJob, job(4, 'Unknown role', [])],
    [indiaJob, { ...fallbackJob, title: 'Changed title' }],
    [indiaJob, { ...fallbackJob, description: '<p>Location: Remote</p>' }],
  ]
  for (const jobs of malformed) {
    await assert.rejects(createVerifiedFirstPartyKekaScraper(directConfig).run({ fetchImpl: createFetch({ jobs }) }), /duplicate|invalid|missing|geography|fallback/i)
  }
})

test('verified Keka accepts an authoritative empty active array and preserves caller cancellation', async () => {
  assert.deepEqual(await createVerifiedFirstPartyKekaScraper(directConfig).run({ fetchImpl: createFetch({ jobs: [] }) }), [])
  const controller = new AbortController()
  const reason = new Error('cancel Keka')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(createVerifiedFirstPartyKekaScraper(directConfig).run({
    signal: controller.signal,
    fetchImpl: async () => { calls += 1; throw new Error('must not fetch') },
  }), (error) => error === reason)
  assert.equal(calls, 0)
})

test('verified Keka stops at every cancelled first-party request and preserves the original abort reason', async () => {
  const orderedUrls = [OFFICIAL, HANDOFF, DOCUMENT, EMBED, PORTAL_INFO, ACTIVE]
  for (let abortAfter = 1; abortAfter <= orderedUrls.length; abortAfter += 1) {
    const controller = new AbortController()
    const reason = new Error(`cancel request ${abortAfter}`)
    const calls = []
    const baseline = createFetch()
    await assert.rejects(createVerifiedFirstPartyKekaScraper(directConfig).run({
      signal: controller.signal,
      fetchImpl: async (url) => {
        calls.push(url)
        const result = await baseline(url)
        if (calls.length !== abortAfter) return result
        return {
          ...result,
          text: async () => { controller.abort(reason); return result.text() },
          json: async () => { controller.abort(reason); return result.json() },
        }
      },
    }), (error) => error === reason)
    assert.deepEqual(calls, orderedUrls.slice(0, abortAfter))
  }
})
