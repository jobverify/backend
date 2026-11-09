import assert from 'node:assert/strict'
import test from 'node:test'

const loadLimeRoadModule = async () => {
  try {
    return await import('../../scraper/limeroad/script.js')
  } catch {
    assert.fail('Expected LimeRoad scraper module at ../../scraper/limeroad/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Limeroad</title>
  </head>
  <body>
    <div>careers</div>
    <div>Department - Customer Support</div>
    <div>Designation - Customer Support Representative</div>
    <div>Job Description -</div>
    <div>
      <div>• Deal directly with customers either by telephone or electronically using organizations products.</div>
      <div>• Respond promptly to customer inquiries.</div>
      <div>• Handle and resolve customer complaints.</div>
    </div>
    <div>Desired Candidate Profile -</div>
    <div>Education - Any Graduate - Any Specialization</div>
    <div>Job Description -</div>
    <div>
      <div>• Good verbal and written communication skills.</div>
      <div>• Knowledge of relevant computer applications.</div>
      <div>• Effective problem analysis and solving skills.</div>
    </div>
    <div>Limeroad is Offered in: हिन्दी</div>
  </body>
</html>
`

const driftedCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Limeroad</title>
  </head>
  <body>
    <div>careers</div>
    <div>No roles listed</div>
  </body>
</html>
`

test('LimeRoad pins the verified first-party careers shell and extracts the static role block conservatively', async () => {
  const limeroad = await loadLimeRoadModule()

  assert.equal(limeroad.SOURCE, 'limeroad')
  assert.equal(limeroad.COMPANY, 'LimeRoad')
  assert.equal(limeroad.VERIFIED_ON, '2026-07-16')
  assert.equal(limeroad.HOMEPAGE_URL, 'https://www.limeroad.com/')
  assert.equal(limeroad.CAREERS_URL, 'https://www.limeroad.com/careers')
  assert.deepEqual(limeroad.VERIFIED_ROLE_URLS, [
    'https://www.limeroad.com/careers',
  ])

  assert.equal(limeroad.hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.deepEqual(limeroad.extractRoleBlocks(careersPageHtml), [
    {
      department: 'Customer Support',
      title: 'Customer Support Representative',
      minimumQualification: 'Any Graduate - Any Specialization',
      experienceRequired: null,
      location: null,
      city: null,
      country: null,
      jobDescription:
        'Deal directly with customers either by telephone or electronically using organizations products. Respond promptly to customer inquiries. Handle and resolve customer complaints.',
      requiredSkills: [
        'Good verbal and written communication skills.',
        'Knowledge of relevant computer applications.',
        'Effective problem analysis and solving skills.',
      ],
      sourceUrl: 'https://www.limeroad.com/careers',
      applyUrl: 'https://www.limeroad.com/careers',
    },
  ])
})

test('LimeRoad scraper returns the verified static first-party role from the careers page', async () => {
  const limeroad = await loadLimeRoadModule()
  const requestedUrls = []

  const jobs = await limeroad.createLimeRoadScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === limeroad.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-16T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [limeroad.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Customer Support Representative',
    company: 'LimeRoad',
    department: 'Customer Support',
    location: null,
    city: null,
    country: null,
    jobId: 'limeroad-customer-support-representative',
    requisitionId: 'limeroad-customer-support-representative',
    sourceUrl: 'https://www.limeroad.com/careers',
    applyUrl: 'https://www.limeroad.com/careers',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: 'Any Graduate - Any Specialization',
    preferredQualification: null,
    requiredSkills: [
      'Good verbal and written communication skills.',
      'Knowledge of relevant computer applications.',
      'Effective problem analysis and solving skills.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Deal directly with customers either by telephone or electronically using organizations products. Respond promptly to customer inquiries. Handle and resolve customer complaints.',
    remoteStatus: null,
    source: 'limeroad',
    link: 'https://www.limeroad.com/careers',
    scrapedAt: '2026-07-16T12:00:00.000Z',
  })
})

test('LimeRoad scraper fails closed when the verified first-party careers block disappears', async () => {
  const limeroad = await loadLimeRoadModule()

  await assert.rejects(
    limeroad.createLimeRoadScraper().run({
      fetchText: async () => driftedCareersPageHtml,
    }),
    /careers page/i,
  )
})
