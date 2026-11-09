import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lakechemicalspvtltd',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedJobSearchHtml = readFixture('job-search.html')

const buildConnectTimeoutError = () => {
  const error = new Error('fetch failed')
  error.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted addresses: 13.248.243.5:443, 76.223.105.230:443, timeout: 10000ms)',
  }
  return error
}

const loadLakeChemicalsModule = async () => {
  try {
    return await import('../../scraper/lakechemicalspvtltd/script.js')
  } catch {
    assert.fail('Expected Lake Chemicals scraper module at ../../scraper/lakechemicalspvtltd/script.js')
  }
}

test('Lake Chemicals scraper recognizes the verified homepage and first-party job search surface', async () => {
  const lakeChemicals = await loadLakeChemicalsModule()

  assert.equal(lakeChemicals.SOURCE, 'lakechemicalspvtltd')
  assert.equal(lakeChemicals.COMPANY, 'Lake Chemicals Pvt. Ltd')
  assert.equal(lakeChemicals.HOMEPAGE_URL, 'https://lakechemicals.com/')
  assert.equal(lakeChemicals.JOB_SEARCH_URL, 'https://lakechemicals.com/job-search')
  assert.equal(lakeChemicals.isVerifiedLakeChemicalsUnavailableError(buildConnectTimeoutError()), true)
  assert.equal(lakeChemicals.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(lakeChemicals.hasOfficialJobSearchSignal(verifiedJobSearchHtml), true)

  const jobs = lakeChemicals.extractPublicJobs(verifiedJobSearchHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Production Executive/ Senior Executive',
      'Production Technician/ Junior Officer',
      'Quality Control- Senior Executive',
      'Marketing Executive',
      'EHS – Sr. Executive / Assistant Manager',
      'Quality Control- Assistant/Deputy Manager',
    ],
  )
  assert.deepEqual(
    jobs.map((job) => job.nativeLocation),
    [
      'Attibele (Factory)',
      'Attibele (Factory)',
      'Attibele (Factory)',
      'Shivajinagar (Head Office)',
      'Attibele (Factory)',
      'Attibele (Factory)',
    ],
  )
  assert.deepEqual(
    jobs.map((job) => job.city),
    [null, null, null, null, null, null],
  )
  assert.equal(jobs[0].minimumQualification, 'Diploma in Chemical Engineering, B.Sc. in Chemistry, B.Tech/ B.E. in Chemical Engineering')
  assert.equal(jobs[0].experienceRequired, '5-8 years')
  assert.deepEqual(jobs[0].requiredSkills, [
    'Experience in handling reactors, centrifuges, dryers',
    'Experience of having worked in the Intermediate Area & Clean Room',
    'Adherence to cGmp and safety practices',
    'Flexibility of working in shifts',
  ])
  assert.equal(jobs[3].minimumQualification, 'MBA/BBA/BBM in Marketing')
  assert.equal(jobs[3].experienceRequired, 'Fresher / 1-2 years of experience in API Marketing')
  assert.ok(
    jobs.every((job) =>
      job.country === null && job.location === null
      && job.sourceUrl === 'https://lakechemicals.com/job-search'
      && job.requisitionId === null && job.nativeCanonicalRoleURL === null
      && job.applicationUrlIsGeneric === true
      && job.applyUrl === 'https://lakechemicals.com/job-search'
      && job.jobDescription.includes('Qualification') && !job.jobDescription.includes('Apply via the official')),
  )
})

// Runtime HTTP metadata, country proofs and closing behavior are exercised by
// test/lakeNativeInventory.test.js. The retired body-only override cannot certify them.
test('Lake Chemicals runtime rejects legacy body-only transport before public HTTP', async () => {
  const lake = await loadLakeChemicalsModule()
  await assert.rejects(lake.run({fetchText: async () => verifiedJobSearchHtml}), /metadata|body.only|unsupported/i)
})

test('Lake Chemicals network failure never becomes verified empty', async t => {
  const lake = await loadLakeChemicalsModule()
  t.mock.method(globalThis, 'fetch', async () => {throw buildConnectTimeoutError()})
  await assert.rejects(lake.run(), /fetch failed/)
})
