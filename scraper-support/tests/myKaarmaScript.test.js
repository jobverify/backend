import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at myKaarma | Join a Leader in Automotive Software</title>
  </head>
  <body>
    <main>
      <section class="careers-hero">
        <h1>Join the myKaarma team</h1>
        <p>Available positions</p>
      </section>
      <div id="rr-job-board" data-job-board-id="mykaarma"></div>
      <script src="https://static-assets.ripplingcdn.com/ats/embeds/job-board.v1.js"></script>
      <a href="https://ats.rippling.com/mykaarma/jobs/cc7fea19-dda7-496c-9f5f-6b89dec0f6eb">Future openings</a>
    </main>
  </body>
</html>
`

const verifiedEmbedHtml = `
<!doctype html>
<html lang="en">
  <head><title>myKaarma Jobs</title></head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          apiData: {
            jobBoard: {
              slug: 'mykaarma',
              companyName: 'myKaarma',
              boardURL: 'https://ats.rippling.com/mykaarma/jobs',
            },
          },
          dehydratedState: {
            queries: [
              {
                queryKey: ['board', 'mykaarma', 'job-posts', { page: 1 }],
                state: {
                  data: {
                    totalItems: 2,
                    items: [
                      {
                        id: '811e76a4-8ba4-4921-8ced-94a901dde48a',
                        name: 'Finance and Accounting Executive',
                        url: 'https://ats.rippling.com/mykaarma/jobs/811e76a4-8ba4-4921-8ced-94a901dde48a',
                        department: { name: 'Admin' },
                        locations: [
                          {
                            name: 'NOIDA, India',
                            city: 'NOIDA',
                            country: 'India',
                            countryCode: 'IN',
                            workplaceType: 'ONSITE',
                          },
                        ],
                      },
                      {
                        id: 'us-only-role',
                        name: 'Customer Success Manager',
                        url: 'https://ats.rippling.com/mykaarma/jobs/us-only-role',
                        department: { name: 'Customer Success' },
                        locations: [
                          {
                            name: 'Long Beach, CA',
                            city: 'Long Beach',
                            country: 'United States',
                            countryCode: 'US',
                            workplaceType: 'REMOTE',
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    })}</script>
  </body>
</html>
`

const loadMyKaarmaModule = async () => {
  try {
    return await import('../../scraper/mykaarma/script.js')
  } catch {
    assert.fail('Expected MyKaarma scraper module at ../../scraper/mykaarma/script.js')
  }
}

test('MyKaarma verifies the official careers page and extracts India jobs from the Rippling embed payload', async () => {
  const myKaarma = await loadMyKaarmaModule()

  assert.equal(myKaarma.CAREERS_URL, 'https://mykaarma.com/careers/')
  assert.equal(myKaarma.JOB_BOARD_SLUG, 'mykaarma')
  assert.equal(
    myKaarma.buildEmbedUrl(),
    'https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F',
  )
  assert.equal(myKaarma.hasVerifiedCareersPageSignal(verifiedCareersHtml), true)
  assert.deepEqual(myKaarma.extractEmbeddedJobBoard(verifiedCareersHtml), {
    slug: 'mykaarma',
    embedUrl: 'https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F',
  })

  const jobs = myKaarma.extractIndiaJobsFromEmbed(verifiedEmbedHtml, {
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Finance and Accounting Executive',
      company: 'MyKaarma',
      department: 'Admin',
      location: 'NOIDA, India',
      city: 'NOIDA',
      country: 'India',
      workplaceType: 'ONSITE',
      jobId: '811e76a4-8ba4-4921-8ced-94a901dde48a',
      requisitionId: '811e76a4-8ba4-4921-8ced-94a901dde48a',
      sourceUrl: 'https://ats.rippling.com/mykaarma/jobs/811e76a4-8ba4-4921-8ced-94a901dde48a',
      applyUrl: 'https://ats.rippling.com/mykaarma/jobs/811e76a4-8ba4-4921-8ced-94a901dde48a',
      link: 'https://ats.rippling.com/mykaarma/jobs/811e76a4-8ba4-4921-8ced-94a901dde48a',
      source: 'mykaarma',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
  ])
})

test('MyKaarma run validates the verified careers page before returning full native India records', async () => {
  const myKaarma = await loadMyKaarmaModule()
  const { replayCurrent } = await import('../../scraper/mykaarma/replayCurrent20261107.js')
  const { getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')
  assert.equal(typeof myKaarma.createMyKaarmaScraper, 'function')
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('MyKaarma current fixture forbids network') }
  try {
    const result = await replayCurrent({ runner: options => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'mykaarma')).run(options) })
    assert.deepEqual(result.output, result.fixture.expected)
    assert.equal(result.calls.length, 32)
    assert.equal(result.jobs.length, 7)
    assert.equal(result.output.nativeCollectionEvidence.observedNativeUniqueVacancies, 15)
    assert.equal(result.output.nativeCollectionEvidence.observedNativeLocationRows, 20)
    assert.equal(result.output.nativeCollectionEvidence.observations.filter(row => row.disposition === 'foreign-listed-only').length, 8)
    assert.equal(result.output.nativeCollectionEvidence.sourceScopeComplete, false)
    assert.equal(result.output.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
    for (const job of result.jobs) {
      assert.equal(job.country, 'India')
      assert.equal(job.nativeEmployer, 'myKaarma')
      assert.equal(job.nativeLegalEmployer, null)
      assert.equal(job.postedAt, null)
      assert.equal(job.closingDate, null)
      assert.equal(job.nativeCreatedOn, job.nativeJobPost.createdOn)
      assert.ok(job.jobDescription.length > 3000)
      assert.deepEqual(job.nativeContentSections.map(section => section.key), ['company', 'role'])
      assert.equal(job.nativeRoleClosingReconciled, true)
      assert.equal(job.sourceScopeComplete, false)
      assert.equal(job.lifecycleCleanupAllowed, false)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('MyKaarma fails closed when the verified careers or Rippling board contract drifts', async () => {
  const myKaarma = await loadMyKaarmaModule()

  await assert.rejects(
    myKaarma.createMyKaarmaScraper().run({
      fetchText: async (url) => {
        if (url === myKaarma.CAREERS_URL) {
          return verifiedCareersHtml.replace('data-job-board-id="mykaarma"', 'data-job-board-id="other-board"')
        }
        throw new Error(`Unexpected MyKaarma fixture URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    myKaarma.createMyKaarmaScraper().run({
      fetchText: async (url) => {
        if (url === myKaarma.CAREERS_URL) return verifiedCareersHtml
        if (url === myKaarma.buildEmbedUrl()) {
          return verifiedEmbedHtml.replace('"companyName":"myKaarma"', '"companyName":"Another Company"')
        }
        throw new Error(`Unexpected MyKaarma fixture URL: ${url}`)
      },
    }),
    /verified Rippling embed/i,
  )
})
