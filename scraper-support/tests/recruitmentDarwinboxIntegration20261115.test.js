import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, recruitmentBoard } from '../utils/verifiedRecruitment.js'
import { darwinboxPublicContractFetch20261115 } from '../../test/helpers/darwinboxPublicContract20261115.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

const native = 'https://fixture.darwinbox.in/ms/candidate/careers'
const official = 'https://employer.test/careers'
const config = { source: 'darwinbox-integration-fixture', companyName: 'Example Corporation',
  companyDomain: 'employer.test', companyCareerPage: official, requireCorporateIdentityMatch: true }

test('current declared Darwinbox candidate routes reach the native board dispatcher', () => {
  for (const url of [native, native + '/', 'https://fixture.darwinbox.in/ms/candidatev2/main',
    'https://fixture.darwinbox.in/ms/candidatev2/company-123/careers/allJobs']) {
    const board = recruitmentBoard(url)
    assert.equal(board?.kind, 'darwinbox', url)
    assert.equal(board.url, url)
  }
  for (const url of ['http://fixture.darwinbox.in/ms/candidate/careers', native + '?tenant=elsewhere',
    native + '#elsewhere', native.replace('fixture.', 'user@fixture.'), native.replace('.in/', '.in.evil.test/'),
    'https://fixture.darwinbox.in/ms/candidateapi/job/alljobs',
    'https://fixture.darwinbox.in/ms/candidatev2/main/careers/jobDetails/123']) assert.equal(recruitmentBoard(url), null, url)
})

test('an active corporate handoff records an unsupported current native app as a Darwinbox failure', async () => {
  const requests = []
  await assert.rejects(createVerifiedRecruitmentScraper(config).run({ fetchPage: async url => {
    requests.push(url)
    return { status: 200, url, html: url.startsWith('https://employer.test/')
      ? '<h1>Example Corporation Careers</h1><a href="' + native + '">Open jobs</a>'
      : '<title>Unsupported current app</title>' }
  } }), error => {
    assert.ok(error.recruitmentObservations.failures.some(row => row.stage === 'native-darwinbox'))
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
    assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
    return true
  })
  assert.ok(requests.includes(native))
})

test('native catalog hints and inactive corporate examples cannot authorize a Darwinbox read', async () => {
  for (const companyCareerPage of [native, official]) {
    const requests = []
    await assert.rejects(createVerifiedRecruitmentScraper({ ...config, companyCareerPage, atsPlatform: 'darwinbox' }).run({
      fetchPage: async url => { requests.push(url); return { status: 200, url,
        html: '<h1>Example Corporation Careers</h1><template><a href="' + native + '">Jobs</a></template>' } },
    }))
    assert.ok(requests.every(url => url.startsWith('https://employer.test/')))
  }
})

test('the current public Darwinbox contract survives generic discovery, IO grants and observation accounting', async () => {
  const transport = darwinboxPublicContractFetch20261115()
  const jobs = await createVerifiedRecruitmentScraper({ source: 'fisdom', companyName: 'Fisdom',
    companyDomain: 'fisdom.com', companyCareerPage: 'https://www.fisdom.com/careers/',
    requireCorporateIdentityMatch: true }).run({ fetchImpl: transport.fetchImpl })
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ['a64118f91e68cf', 'a64197589077ab'])
  assert.ok(jobs.every(job => job.company === 'Fisdom' && job.country === 'India'))
  assert.ok(jobs.every(job => job.nativeHiringOrganization.name === 'Finwizard Technology Pvt Ltd'
    && job.nativeEmployerBinding.method === 'current-corporate-legal-statement-and-native-role-employer'))
  assert.equal(readSourceObservationEvidence(jobs, 'fisdom').observedVacancyCount, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(transport.calls.filter(call => call.url.includes('/job/alljobs?')).length, 2)
})

test('a denied native API cannot be converted to empty inventory by the generic adapter', async () => {
  const transport = darwinboxPublicContractFetch20261115(packet => {
    if (packet.url.endsWith('/ms/candidateapi/companyinfo')) {
      packet.status = 403; packet.body = '<title>Access denied</title>'; packet.contentType = 'text/html'
    }
  })
  await assert.rejects(createVerifiedRecruitmentScraper({ source: 'fisdom', companyName: 'Fisdom',
    companyDomain: 'fisdom.com', companyCareerPage: 'https://www.fisdom.com/careers/',
    requireCorporateIdentityMatch: true }).run({ fetchImpl: transport.fetchImpl }), error => {
    assert.ok(error.recruitmentObservations.failures.some(row => row.stage === 'native-darwinbox' && row.status === 403))
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
    return true
  })
})
