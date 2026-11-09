import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const loadRenaultNissanTechnologyModule = async () => {
  try {
    return await import('../../scraper/renaultnissantechnology/script.js')
  } catch {
    assert.fail('Expected Renault Nissan Technology scraper module at ../../scraper/renaultnissantechnology/script.js')
  }
}

const readJsonFixture = (name) => JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'scraper-support', 'tests', 'fixtures', 'renaultnissantechnology', name),
    'utf8',
  ),
)

test('extractSearchResults keeps only India jobs from the verified RNTBCI public feed', async () => {
  const renault = await loadRenaultNissanTechnologyModule()
  const payload = readJsonFixture('search-results.json')

  const jobs = renault.extractSearchResults(payload)

  assert.deepEqual(jobs, [
    {
      title: 'Data Governance Leader (Deputy Manager)',
      company: 'Renault Nissan Technology and Business Centre',
      department: 'N - Information Technologies & Systems',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'JOB_POSTING-3-87777',
      requisitionId: 'JOBREQ_50237852',
      sourceUrl: 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers/job/Chennai/Data-Governance-Leader--Deputy-Manager-_JOBREQ_50237852-1',
      applyUrl: 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers/job/Chennai/Data-Governance-Leader--Deputy-Manager-_JOBREQ_50237852-1',
      employmentType: 'Full-time',
      experienceRequired: null,
      publicExperienceChecked: true,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        "Bachelor's or Master's degree in Information Systems, Data Science, Computer Science, or related field.",
        '10+ years of experience in data governance, data management, or IT leadership.',
        'Design and implement enterprise-wide data governance frameworks and policies.',
        'Ensure compliance with global data regulations such as GDPR, CCPA, and industry-specific standards.',
      ],
      postingDate: '2026-06-05',
      closingDate: null,
      jobDescription: "Role Overview: Strategic Data Governance Leader with proven expertise in establishing and enforcing data management frameworks, policies, and standards. Experience and Skills Required: Bachelor's or Master's degree in Information Systems, Data Science, Computer Science, or related field. 10+ years of experience in data governance, data management, or IT leadership. Responsibilities: Design and implement enterprise-wide data governance frameworks and policies. Ensure compliance with global data regulations such as GDPR, CCPA, and industry-specific standards.",
    },
    {
      title: 'Cloud Support Engineer - Level 3 (Senior Engineer)',
      company: 'Renault Nissan Technology and Business Centre',
      department: 'T - Research & Development',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'JOB_POSTING-3-87782',
      requisitionId: 'JOBREQ_50242089',
      sourceUrl: 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers/job/Chennai/Cloud-Support-Engineer----Level-3--Senior-Engineer-_JOBREQ_50242089',
      applyUrl: 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers/job/Chennai/Cloud-Support-Engineer----Level-3--Senior-Engineer-_JOBREQ_50242089',
      employmentType: 'Full-time',
      experienceRequired: null,
      publicExperienceChecked: true,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Define standards for custom metrics, anomaly detection, and AI-driven problem analysis.',
        'Automate monitoring deployments and configurations using Terraform and GitOps principles.',
      ],
      postingDate: '2026-06-05',
      closingDate: null,
      jobDescription: 'Role Summary: Dynatrace administration across GCP infrastructure and applications. Key Responsibilities: Define standards for custom metrics, anomaly detection, and AI-driven problem analysis. Automate monitoring deployments and configurations using Terraform and GitOps principles.',
    },
  ])
})

test('createRenaultNissanTechnologyScraper decorates the verified public feed with source metadata', async () => {
  const renault = await loadRenaultNissanTechnologyModule()
  const payload = readJsonFixture('search-results.json')

  const jobs = await renault.createRenaultNissanTechnologyScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchJson: async (url) => {
      assert.equal(url, renault.JOBS_API_URL)
      return payload
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'renaultnissantechnology')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[1].source, 'renaultnissantechnology')
})


test('RNTBCI reports the upstream 503 carried inside an HTTP 400 gateway response', async () => {
  const renault = await loadRenaultNissanTechnologyModule()
  const { classifyScraperError } = await import('../utils/failureClassification.js')
  const originalFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = async () => {
    requests += 1
    return new Response(JSON.stringify({ result: 'Error', data: {}, errorDetails: { message: "Access token is undefined - StatusCodeError: 503 - The backend sent '503' HTTP_STATUS and Reason: 'Service Unavailable'." } }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
  try {
    await assert.rejects(renault.createRenaultNissanTechnologyScraper().run(), (error) => {
      const failure = classifyScraperError(error)
      assert.equal(failure.failureKind, 'network_or_timeout')
      assert.equal(failure.softFailure, true)
      return true
    })
    assert.equal(requests, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
