import { checkCurrentReplay, assertCurrentProvider } from '../native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | SandboxAQ</title>
  </head>
  <body>
    <main>
      <h1>Careers at Sandbox AQ</h1>
      <p>Embark on Your Next Great Adventure at SandboxAQ!</p>
      <p>Discover full-time roles and our Residency Program.</p>
      <a href="/careers-list">View Job Openings</a>
    </main>
    <footer>
      <p>© 2026 SandboxAQ</p>
    </footer>
  </body>
</html>
`

const careersListHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers List | SandboxAQ</title>
  </head>
  <body>
    <main>
      <h4>Sign up for email updates</h4>
      <p>Get updates on how SandboxAQ can power your organization.</p>
    </main>
    <footer>
      <p>© 2026 SandboxAQ</p>
    </footer>
  </body>
</html>
`

const ashbyBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SandboxAQ Jobs</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
  </body>
</html>
`

const ashbyPayload = {
  jobs: [
    {
      id: '54e2b57a-50dd-4e9a-beed-81ec2abcc9fa',
      title: 'Staff Machine Learning Engineer, AI Generation Engine',
      department: 'Engineering & Research & Product',
      team: 'AI Generation Engine',
      employmentType: 'FullTime',
      location: 'United States',
      secondaryLocations: [
        {
          location: 'Canada',
          address: {
            postalAddress: {
              addressCountry: 'Canada',
            },
          },
        },
      ],
      publishedAt: '2026-07-17T12:00:00.000+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/sandboxaq/54e2b57a-50dd-4e9a-beed-81ec2abcc9fa',
      applyUrl: 'https://jobs.ashbyhq.com/sandboxaq/54e2b57a-50dd-4e9a-beed-81ec2abcc9fa/application',
      descriptionPlain: 'Own the end-to-end ML lifecycle for SandboxAQ AI Generation Engine products.',
    },
    {
      id: '42615b29-0fcb-429c-b305-8fa6b1137153',
      title: 'Product & Growth Marketer, AI Simulation',
      department: 'Operations',
      team: 'Marketing',
      employmentType: 'FullTime',
      location: 'United States',
      secondaryLocations: [],
      publishedAt: '2026-07-13T12:00:00.000+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/sandboxaq/42615b29-0fcb-429c-b305-8fa6b1137153',
      applyUrl: 'https://jobs.ashbyhq.com/sandboxaq/42615b29-0fcb-429c-b305-8fa6b1137153/application',
      descriptionPlain: 'Shape messaging and demand generation for SandboxAQ AI Simulation offerings.',
    },
    {
      id: '622ef111-1333-480b-b63a-90b0b4cc205d',
      title: 'Principal Technical Product Manager, Data Platform',
      department: 'Engineering & Research & Product',
      team: 'AI Simulation',
      employmentType: 'FullTime',
      location: 'United Kingdom',
      secondaryLocations: [],
      publishedAt: '2026-07-14T12:00:00.000+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United Kingdom',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/sandboxaq/622ef111-1333-480b-b63a-90b0b4cc205d',
      applyUrl: 'https://jobs.ashbyhq.com/sandboxaq/622ef111-1333-480b-b63a-90b0b4cc205d/application',
      descriptionPlain: 'Lead platform product strategy for SandboxAQ data capabilities.',
    },
    {
      id: 'ignore-me',
      title: 'Unlisted Role',
      department: 'Operations',
      team: 'Operations',
      employmentType: 'FullTime',
      location: 'United States',
      secondaryLocations: [],
      publishedAt: '2026-07-10T00:00:00.000+00:00',
      isListed: false,
      jobUrl: 'https://jobs.ashbyhq.com/sandboxaq/ignore-me',
      applyUrl: 'https://jobs.ashbyhq.com/sandboxaq/ignore-me/application',
      descriptionPlain: 'This role should be ignored.',
    },
  ],
}

const loadSandboxAQModule = async () => {
  try {
    return await import('../../scraper/sandboxaq/script.js')
  } catch {
    assert.fail('Expected SandboxAQ scraper module at ../../scraper/sandboxaq/script.js')
  }
}

test('SandboxAQ pins the verified official careers shell and public Ashby endpoints', async () => {
  const sandboxAQ = await loadSandboxAQModule()

  assert.equal(sandboxAQ.SOURCE, 'sandboxaq')
  assert.equal(sandboxAQ.COMPANY, 'SandboxAQ')
  assert.equal(sandboxAQ.CAREERS_PAGE_URL, 'https://www.sandboxaq.com/careers')
  assert.equal(sandboxAQ.CAREERS_LIST_URL, 'https://www.sandboxaq.com/careers-list')
  assert.equal(sandboxAQ.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/sandboxaq')
  assert.equal(
    sandboxAQ.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/sandboxaq',
  )
  assert.equal(sandboxAQ.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    sandboxAQ.extractVerifiedCareersListUrl(careersHtml),
    'https://www.sandboxaq.com/careers-list',
  )
  assert.equal(sandboxAQ.hasVerifiedCareersListShellSignal(careersListHtml), true)
  assert.equal(sandboxAQ.hasVerifiedAshbyPublicBoardShellSignal(ashbyBoardHtml), true)
  assert.equal(
    sandboxAQ.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/sandboxaq'),
    'https://api.ashbyhq.com/posting-api/job-board/sandboxaq',
  )
})

test('SandboxAQ extracts listed jobs from the verified public Ashby payload into shared scraper fields', async () => {
  const sandboxAQ = await loadSandboxAQModule()
  const jobs = sandboxAQ.extractAshbyJobs(ashbyPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Staff Machine Learning Engineer, AI Generation Engine',
      company: 'SandboxAQ',
      department: 'Engineering & Research & Product',
      location: 'United States',
      city: null,
      state: null,
      country: 'United States',
      jobId: '54e2b57a-50dd-4e9a-beed-81ec2abcc9fa',
      requisitionId: '54e2b57a-50dd-4e9a-beed-81ec2abcc9fa',
      sourceUrl: 'https://jobs.ashbyhq.com/sandboxaq/54e2b57a-50dd-4e9a-beed-81ec2abcc9fa',
      applyUrl: 'https://jobs.ashbyhq.com/sandboxaq/54e2b57a-50dd-4e9a-beed-81ec2abcc9fa/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-17T12:00:00.000+00:00',
      closingDate: null,
      jobDescription: 'Own the end-to-end ML lifecycle for SandboxAQ AI Generation Engine products.',
      remoteStatus: 'Remote',
    },
    {
      title: 'Product & Growth Marketer, AI Simulation',
      company: 'SandboxAQ',
      department: 'Operations',
      location: 'United States',
      city: null,
      state: null,
      country: 'United States',
      jobId: '42615b29-0fcb-429c-b305-8fa6b1137153',
      requisitionId: '42615b29-0fcb-429c-b305-8fa6b1137153',
      sourceUrl: 'https://jobs.ashbyhq.com/sandboxaq/42615b29-0fcb-429c-b305-8fa6b1137153',
      applyUrl: 'https://jobs.ashbyhq.com/sandboxaq/42615b29-0fcb-429c-b305-8fa6b1137153/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-13T12:00:00.000+00:00',
      closingDate: null,
      jobDescription: 'Shape messaging and demand generation for SandboxAQ AI Simulation offerings.',
      remoteStatus: 'Remote',
    },
    {
      title: 'Principal Technical Product Manager, Data Platform',
      company: 'SandboxAQ',
      department: 'Engineering & Research & Product',
      location: 'United Kingdom',
      city: null,
      state: null,
      country: 'United Kingdom',
      jobId: '622ef111-1333-480b-b63a-90b0b4cc205d',
      requisitionId: '622ef111-1333-480b-b63a-90b0b4cc205d',
      sourceUrl: 'https://jobs.ashbyhq.com/sandboxaq/622ef111-1333-480b-b63a-90b0b4cc205d',
      applyUrl: 'https://jobs.ashbyhq.com/sandboxaq/622ef111-1333-480b-b63a-90b0b4cc205d/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-14T12:00:00.000+00:00',
      closingDate: null,
      jobDescription: 'Lead platform product strategy for SandboxAQ data capabilities.',
      remoteStatus: 'Remote',
    },
  ])
})

test('sandboxaq: current original-entity complete replay (legacy case 254)', async () => checkCurrentReplay('sandboxaq', 'complete'))

test('sandboxaq: current original-entity primary replay (legacy case 287)', async () => checkCurrentReplay('sandboxaq', 'primary'))
