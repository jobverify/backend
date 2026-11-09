import { checkCurrentReplay, assertCurrentProvider } from '../native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const JOBS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Redpanda | Real-Time Data &amp; Enterprise AI</title>
    <link href="https://www.redpanda.com/jobs" rel="canonical" />
  </head>
  <body>
    <main>
      <p>JOIN OUR MISSION</p>
      <h1>Current job openings</h1>
      <p>Recruitment Scams Alert: All official communications from Redpanda will originate from email addresses ending in @redpanda.com.</p>
    </main>
    <script>
      document.addEventListener('DOMContentLoaded', function () {
        var ASHBY_BOARD = 'redpanda-data';
        fetch('https://api.ashbyhq.com/posting-api/job-board/' + encodeURIComponent(ASHBY_BOARD))
      });
    </script>
  </body>
</html>
`

const ashbyPayload = {
  jobs: [
    {
      id: 'senior-software-engineer-connectors-india',
      title: 'Senior Software Engineer, Connectors',
      department: 'Engineering',
      team: 'Connectors',
      employmentType: 'FullTime',
      location: 'Remote',
      secondaryLocations: [
        {
          location: 'Remote India',
          address: {
            postalAddress: {
              addressCountry: 'India',
              addressLocality: 'Bengaluru',
              addressRegion: 'Karnataka',
            },
          },
        },
      ],
      publishedAt: '2026-07-25T01:00:00.000Z',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/redpanda-data/senior-software-engineer-connectors-india',
      applyUrl: 'https://jobs.ashbyhq.com/redpanda-data/senior-software-engineer-connectors-india/application',
      descriptionPlain: 'Build Redpanda Connectors from India.',
    },
    {
      id: 'staff-software-engineer-cloud-poland',
      title: 'Staff Software Engineer, Cloud',
      department: 'Engineering',
      team: 'Cloud',
      employmentType: 'FullTime',
      location: 'Poland',
      secondaryLocations: [],
      publishedAt: '2026-07-24T10:00:00.000Z',
      isListed: true,
      isRemote: false,
      workplaceType: 'Hybrid',
      address: {
        postalAddress: {
          addressCountry: 'Poland',
          addressLocality: 'Warsaw',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/redpanda-data/staff-software-engineer-cloud-poland',
      applyUrl: 'https://jobs.ashbyhq.com/redpanda-data/staff-software-engineer-cloud-poland/application',
      descriptionPlain: 'Build Redpanda Cloud from Poland.',
    },
    {
      id: 'ignore-me',
      title: 'Unlisted India Role',
      department: 'Operations',
      employmentType: 'Contract',
      location: 'India',
      secondaryLocations: [],
      publishedAt: '2026-07-20T00:00:00.000Z',
      isListed: false,
      isRemote: false,
      workplaceType: 'OnSite',
      address: {
        postalAddress: {
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/redpanda-data/ignore-me',
      applyUrl: 'https://jobs.ashbyhq.com/redpanda-data/ignore-me/application',
      descriptionPlain: 'This role should be ignored.',
    },
  ],
}

const nonIndiaPayload = {
  jobs: ashbyPayload.jobs.filter((job) => job.id !== 'senior-software-engineer-connectors-india'),
}

const loadModule = async () => {
  try {
    return await import('../../scraper/redpanda/script.js')
  } catch {
    assert.fail('Expected Redpanda scraper module at ../../scraper/redpanda/script.js')
  }
}

test('Redpanda pins the verified first-party jobs page and embedded Ashby API handoff', async () => {
  const redpanda = await loadModule()

  assert.equal(redpanda.SOURCE, 'redpanda')
  assert.equal(redpanda.COMPANY, 'Redpanda')
  assert.equal(redpanda.JOBS_PAGE_URL, 'https://www.redpanda.com/jobs')
  assert.equal(redpanda.ASHBY_BOARD_SLUG, 'redpanda-data')
  assert.equal(
    redpanda.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/redpanda-data',
  )
  assert.equal(redpanda.hasVerifiedJobsPageSignal(JOBS_PAGE_HTML), true)
  assert.equal(redpanda.extractVerifiedAshbyBoardSlug(JOBS_PAGE_HTML), 'redpanda-data')
  assert.equal(
    redpanda.buildAshbyJobBoardUrl('redpanda-data'),
    'https://api.ashbyhq.com/posting-api/job-board/redpanda-data',
  )
})

test('Redpanda extracts only listed India jobs from the verified embedded Ashby payload', async () => {
  const redpanda = await loadModule()

  assert.deepEqual(redpanda.extractAshbyJobs(ashbyPayload), [
    {
      title: 'Senior Software Engineer, Connectors',
      company: 'Redpanda',
      department: 'Engineering',
      location: 'Remote India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'senior-software-engineer-connectors-india',
      requisitionId: 'senior-software-engineer-connectors-india',
      sourceUrl: 'https://jobs.ashbyhq.com/redpanda-data/senior-software-engineer-connectors-india',
      applyUrl: 'https://jobs.ashbyhq.com/redpanda-data/senior-software-engineer-connectors-india/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-25T01:00:00.000Z',
      closingDate: null,
      jobDescription: 'Build Redpanda Connectors from India.',
      remoteStatus: 'Remote',
    },
  ])
})

test('redpanda: current original-entity complete replay (legacy case 168)', async () => checkCurrentReplay('redpanda', 'complete'))

test('redpanda: current original-entity primary replay (legacy case 191)', async () => checkCurrentReplay('redpanda', 'primary'))
