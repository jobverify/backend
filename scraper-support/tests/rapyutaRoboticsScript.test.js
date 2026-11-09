import assert from 'node:assert/strict'
import test from 'node:test'

const loadRapyutaRoboticsModule = async () => {
  try {
    return await import('../../scraper/rapyutarobotics/script.js')
  } catch {
    assert.fail('Expected Rapyuta Robotics scraper module at ../../scraper/rapyutarobotics/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Work on Problems that Matter</h1>
      <a href="https://apply.workable.com/api/v1/widget/accounts/rapyuta-robotics">See All Open positions</a>
      <section>
        <h2>All Open Positions</h2>
        <p>Loading open positions...</p>
      </section>
    </main>
  </body>
</html>
`

const widgetPayload = {
  name: 'Rapyuta Robotics',
  jobs: [
    {
      title: 'Quality Assurance Engineer - Robotics',
      shortcode: '0E6A9F5D16',
      code: '',
      employment_type: 'Full-time',
      department: 'Engineering',
      url: 'https://apply.workable.com/j/0E6A9F5D16',
      application_url: 'https://apply.workable.com/j/0E6A9F5D16/apply',
      published_on: '2026-04-14',
      country: 'India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      education: "Bachelor's Degree",
      experience: 'Mid-Senior level',
      locations: [
        {
          country: 'India',
          city: 'Chennai',
          region: 'Tamil Nadu',
          hidden: false,
        },
      ],
    },
    {
      title: 'AI Systems Engineer',
      shortcode: 'A17DF7F126',
      code: 'T/E/0/F/july-7/9/26',
      employment_type: 'Full-time',
      department: 'Engineering',
      url: 'https://apply.workable.com/j/A17DF7F126',
      application_url: 'https://apply.workable.com/j/A17DF7F126/apply',
      published_on: '2026-07-09',
      country: 'Japan',
      city: 'Koto City',
      state: 'Tokyo',
      education: "Bachelor's Degree",
      experience: '',
      locations: [
        {
          country: 'Japan',
          city: 'Koto City',
          region: 'Tokyo',
          hidden: false,
        },
      ],
    },
    {
      title: 'Senior Application Support Engineer',
      shortcode: '710177DA91',
      code: '',
      employment_type: 'Full-time',
      department: 'Engineering',
      url: 'https://apply.workable.com/j/710177DA91',
      application_url: 'https://apply.workable.com/j/710177DA91/apply',
      published_on: '2026-03-18',
      country: 'India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      education: "Bachelor's Degree",
      experience: 'Mid-Senior level',
      locations: [
        {
          country: 'India',
          city: 'Chennai',
          region: 'Tamil Nadu',
          hidden: false,
        },
      ],
    },
  ],
}

test('Rapyuta Robotics scraper validates the verified official careers handoff and extracts India jobs from the Workable widget payload', async () => {
  const rapyuta = await loadRapyutaRoboticsModule()

  assert.equal(rapyuta.SOURCE, 'rapyutarobotics')
  assert.equal(rapyuta.COMPANY, 'Rapyuta Robotics')
  assert.equal(rapyuta.CAREERS_URL, 'https://www.rapyuta-robotics.com/careers/')
  assert.equal(rapyuta.WIDGET_API_URL, 'https://apply.workable.com/api/v1/widget/accounts/rapyuta-robotics')
  assert.equal(rapyuta.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(
    rapyuta.extractIndiaJobs(widgetPayload).map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      state: job.state,
      country: job.country,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      postingDate: job.postingDate,
    })),
    [
      {
        title: 'Quality Assurance Engineer - Robotics',
        location: 'Chennai, Tamil Nadu, India',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        jobId: '0E6A9F5D16',
        sourceUrl: 'https://apply.workable.com/j/0E6A9F5D16',
        applyUrl: 'https://apply.workable.com/j/0E6A9F5D16/apply',
        postingDate: '2026-04-14',
      },
      {
        title: 'Senior Application Support Engineer',
        location: 'Chennai, Tamil Nadu, India',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        jobId: '710177DA91',
        sourceUrl: 'https://apply.workable.com/j/710177DA91',
        applyUrl: 'https://apply.workable.com/j/710177DA91/apply',
        postingDate: '2026-03-18',
      },
    ],
  )
})

test('Rapyuta Robotics scraper validates the official careers page before reading the widget payload and decorates persisted jobs', async () => {
  const rapyuta = await loadRapyutaRoboticsModule()
  const requestedUrls = []
  const scrapedAt = new Date('2026-07-10T05:15:00.000Z')

  const jobs = await rapyuta.createRapyutaRoboticsScraper({
    now: () => scrapedAt,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return widgetPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    rapyuta.CAREERS_URL,
    rapyuta.WIDGET_API_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Quality Assurance Engineer - Robotics',
        location: 'Chennai, Tamil Nadu, India',
        source: 'rapyutarobotics',
        link: 'https://apply.workable.com/j/0E6A9F5D16/apply',
        scrapedAt: '2026-07-10T05:15:00.000Z',
      },
      {
        title: 'Senior Application Support Engineer',
        location: 'Chennai, Tamil Nadu, India',
        source: 'rapyutarobotics',
        link: 'https://apply.workable.com/j/710177DA91/apply',
        scrapedAt: '2026-07-10T05:15:00.000Z',
      },
    ],
  )
})

test('Rapyuta Robotics scraper fails closed when the verified official careers handoff changes', async () => {
  const rapyuta = await loadRapyutaRoboticsModule()

  await assert.rejects(
    rapyuta.createRapyutaRoboticsScraper().run({
      fetchText: async () => '<main><h1>Careers</h1><p>Join us.</p></main>',
      fetchJson: async () => widgetPayload,
    }),
    /official careers handoff/i,
  )
})
