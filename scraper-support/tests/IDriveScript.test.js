import assert from 'node:assert/strict'
import test from 'node:test'

const loadIDriveModule = async () => {
  try {
    return await import('../../scraper/idrive/script.js')
  } catch {
    assert.fail('Expected IDrive scraper module at ../../scraper/idrive/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at IDrive&reg;</title>
    <meta
      name="description"
      content="IDrive provides affordable and secure cloud backup for PCs, Macs, servers, iOS and Android devices. Watch out this page for vacancies / careers at IDrive."
    />
  </head>
  <body class="career">
    <section class="jobs_sec">
      <h2 class="heading">Current Job Openings</h2>
      <iframe
        src="https://widgets.sociablekit.com/indeed-jobs/iframe/25575419"
        class="sk-ww-indeed-jobs"
      ></iframe>
    </section>
    <p class="jobsemail">
      Please send us your updated resume to <a href="mailto:jobs@idrive.com">jobs@idrive.com</a>.
    </p>
  </body>
</html>
`

const emptyFeed = {
  bio: {
    profile_description:
      '0 IDrive jobs. Apply to the latest jobs near you. Learn about salary, employee reviews, interviews, benefits, and work-life balance',
    full_name: 'IDrive',
    username: 'Idrive-2',
    embed_id: '25575419',
    link: 'https://indeed.com/cmp/Idrive-2/jobs#cmp-skip-header-desktop',
  },
  settings: {
    embed_id: '25575419',
    type: '74',
    no_jobs_text: 'No jobs yet',
  },
  user_info: {
    embed_id: '25575419',
    solution_name: 'Indeed Jobs',
    show_feed: 'true',
  },
  posts: [],
}

const populatedFeed = {
  ...emptyFeed,
  posts: [
    {
      job_id: 'job-123',
      company: 'IDrive',
      job_title: 'Software Engineer',
      location: 'Bengaluru, Karnataka',
      job_link: 'https://www.indeed.com/viewjob?jk=abc123',
      ago_value: '2 days ago',
      date_time: '2026-07-15T10:00:00Z',
      description: '<p>Build backup systems.</p>',
      tags: ['Full-time', 'Remote'],
    },
  ],
}

test('IDrive scraper pins the verified official careers page and widget feed identity', async () => {
  const idrive = await loadIDriveModule()

  assert.equal(idrive.SOURCE, 'idrive')
  assert.equal(idrive.COMPANY, 'IDrive')
  assert.equal(idrive.VERIFIED_ON, '2026-07-16')
  assert.equal(idrive.OFFICIAL_CAREERS_URL, 'https://www.idrive.com/jobs/')
  assert.equal(
    idrive.OFFICIAL_JOBS_WIDGET_URL,
    'https://widgets.sociablekit.com/indeed-jobs/iframe/25575419',
  )
  assert.equal(idrive.WIDGET_EMBED_ID, '25575419')
  assert.equal(
    idrive.WIDGET_FEED_URL,
    'https://data.accentapi.com/feed/25575419.json',
  )
  assert.equal(idrive.extractWidgetEmbedId(officialCareersHtml), '25575419')
  assert.equal(idrive.hasOfficialIDriveCareersSignals(officialCareersHtml), true)
  assert.equal(idrive.hasExpectedWidgetFeedIdentity(emptyFeed), true)
  assert.deepEqual(idrive.extractWidgetPosts(emptyFeed), [])
  assert.deepEqual(
    idrive.mapWidgetPostToJob(populatedFeed.posts[0], { now: () => '2026-07-16T00:00:00.000Z' }),
    {
      jobId: 'job-123',
      requisitionId: 'job-123',
      title: 'Software Engineer',
      company: 'IDrive',
      location: 'Bengaluru, Karnataka',
      city: 'Bengaluru',
      link: 'https://www.indeed.com/viewjob?jk=abc123',
      applyUrl: 'https://www.indeed.com/viewjob?jk=abc123',
      sourceUrl: 'https://www.indeed.com/viewjob?jk=abc123',
      source: 'idrive',
      atsPlatform: 'indeed-via-sociablekit',
      employmentType: 'Full-time',
      jobDescription: 'Build backup systems.',
      postingDate: '2026-07-15T10:00:00Z',
      tags: ['Full-time', 'Remote'],
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
  )
})

test('IDrive scraper returns [] while the official widget feed remains valid but empty', async () => {
  const idrive = await loadIDriveModule()

  const jobs = await idrive.createIDriveScraper().run({
    fetchText: async (url) => {
      if (url === idrive.OFFICIAL_CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === idrive.WIDGET_FEED_URL) return emptyFeed
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
})

test('IDrive scraper returns normalized jobs when the official widget feed exposes posts', async () => {
  const idrive = await loadIDriveModule()

  const jobs = await idrive.createIDriveScraper().run({
    fetchText: async (url) => {
      if (url === idrive.OFFICIAL_CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === idrive.WIDGET_FEED_URL) return populatedFeed
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].city, 'Bengaluru')
})

test('IDrive scraper fails closed when the official careers page or widget identity drifts', async () => {
  const idrive = await loadIDriveModule()

  await assert.rejects(
    idrive.createIDriveScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
      fetchJson: async () => emptyFeed,
    }),
    /official careers page/i,
  )

  await assert.rejects(
    idrive.createIDriveScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({
        ...emptyFeed,
        bio: {
          ...emptyFeed.bio,
          full_name: 'Another Company',
        },
      }),
    }),
    /widget feed identity/i,
  )
})
