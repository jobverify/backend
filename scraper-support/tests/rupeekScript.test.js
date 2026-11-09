import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join our team | Rupeek | Careers</title>
    <link rel="canonical" href="https://rupeek.com/careers" />
  </head>
  <body>
    <section>
      <h2>Why join Us?</h2>
      <h2>Engineering at Rupeek</h2>
      <div>Open Positions</div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mt-7 text-left">
        <a href="https://www.linkedin.com/jobs/view/assistant-manager-taxation-at-rupeek-4440699084" target="_blank">
          <div>
            <p>Assistant Manager - Taxation</p>
            <p>Location: Bengaluru, Karnataka, India</p>
            <p>13 hours ago</p>
          </div>
        </a>
        <a href="https://www.linkedin.com/jobs/view/back-office-executive-at-rupeek-4437967359" target="_blank">
          <div>
            <p>Back Office Executive</p>
            <p>Location: Greater Bengaluru Area</p>
            <p>6 days ago</p>
          </div>
        </a>
        <a href="https://www.linkedin.com/jobs/view/growth-manager-at-rupeek-9999999999" target="_blank">
          <div>
            <p>Growth Manager</p>
            <p>Location: Singapore</p>
            <p>1 day ago</p>
          </div>
        </a>
      </div>
    </section>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join our team | Rupeek | Careers</title>
    <link rel="canonical" href="https://rupeek.com/careers"/>
  </head>
  <body>
    <div>loading...</div>
    <section>
      <div>Excellent Growth</div>
      <div>Wealth creation</div>
      <div>Work that matters</div>
      <div>Passionate, Energetic People</div>
      <div>Innovation</div>
    </section>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mt-7 text-left">
      <a href="https://www.linkedin.com/jobs/view/assistant-manager-taxation-at-rupeek-4440699084" target="_blank">
        <div>
          <p>Assistant Manager - Taxation</p>
          <p>Location: Bengaluru, Karnataka, India</p>
          <p>13 hours ago</p>
        </div>
      </a>
    </div>
  </body>
</html>
`

const assistantManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rupeek hiring Assistant Manager - Taxation in Bengaluru, Karnataka, India | LinkedIn</title>
    <meta
      name="description"
      content="Requirements and skills: Proven work experience as a Tax Accountant or Tax Analyst. 3 years of experience in direct and indirect taxation."
    />
  </head>
  <body>
    <main>
      <h1>Assistant Manager - Taxation</h1>
      <section>
        <h2>About the job</h2>
        <p>Requirements and skills:</p>
        <p>Proven work experience as a Tax Accountant or Tax Analyst.</p>
        <p>3 years of experience in direct and indirect taxation.</p>
        <p>Strong Excel, reconciliation, and statutory compliance skills.</p>
      </section>
    </main>
  </body>
</html>
`

const backOfficeDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rupeek hiring Back Office Executive in Bengaluru, Karnataka, India | LinkedIn</title>
    <meta
      name="description"
      content="Coordinate customer documentation, maintain audit records, and support branch operations."
    />
  </head>
  <body>
    <main>
      <h1>Back Office Executive</h1>
      <section>
        <h2>Job Description</h2>
        <p>Coordinate customer documentation and maintain branch audit records.</p>
        <p>Support gold loan disbursal operations, reconcile case queues, and work with sales and credit teams.</p>
        <p>Ensure accurate status updates, follow-up tracking, and daily operational reporting.</p>
      </section>
    </main>
  </body>
</html>
`

const loadRupeekModule = async () => {
  try {
    return await import('../../scraper/rupeek/script.js')
  } catch {
    assert.fail('Expected Rupeek scraper module at ../../scraper/rupeek/script.js')
  }
}

test('Rupeek helpers stay pinned to the verified official careers page structure', async () => {
  const rupeek = await loadRupeekModule()

  assert.equal(rupeek.SOURCE, 'rupeek')
  assert.equal(rupeek.COMPANY_NAME, 'Rupeek')
  assert.equal(rupeek.OFFICIAL_BRAND_NAME, 'Rupeek')
  assert.equal(rupeek.VERIFIED_ON, '2026-07-17')
  assert.equal(rupeek.OFFICIAL_CAREERS_URL, 'https://rupeek.com/about/careers')
  assert.equal(rupeek.OFFICIAL_CAREERS_CANONICAL_URL, 'https://rupeek.com/careers')
  assert.equal(rupeek.hasOfficialRupeekCareersSignals(verifiedCareersHtml), true)
  assert.equal(
    rupeek.hasOfficialRupeekCareersSignals(
      verifiedCareersHtml.replace('Open Positions', 'Open Roles'),
    ),
    false,
  )
  assert.deepEqual(rupeek.extractJobCardsFromCareersHtml(verifiedCareersHtml), [
    {
      title: 'Assistant Manager - Taxation',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '4440699084',
      requisitionId: null,
      sourceUrl: 'https://www.linkedin.com/jobs/view/assistant-manager-taxation-at-rupeek-4440699084',
      applyUrl: 'https://www.linkedin.com/jobs/view/assistant-manager-taxation-at-rupeek-4440699084',
      postingDate: '13 hours ago',
    },
    {
      title: 'Back Office Executive',
      location: 'Greater Bengaluru Area',
      city: 'Bengaluru',
      country: 'India',
      jobId: '4437967359',
      requisitionId: null,
      sourceUrl: 'https://www.linkedin.com/jobs/view/back-office-executive-at-rupeek-4437967359',
      applyUrl: 'https://www.linkedin.com/jobs/view/back-office-executive-at-rupeek-4437967359',
      postingDate: '6 days ago',
    },
  ])
})

test('Rupeek accepts the current official careers page value-prop copy', async () => {
  const rupeek = await loadRupeekModule()

  assert.equal(rupeek.hasOfficialRupeekCareersSignals(currentCareersHtml), true)
})

test('Rupeek run validates the official careers page before returning the verified India subset', async () => {
  const { createRupeekScraper } = await loadRupeekModule()
  const scraper = createRupeekScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedUrls = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://rupeek.com/about/careers') return verifiedCareersHtml
      if (url === 'https://www.linkedin.com/jobs/view/assistant-manager-taxation-at-rupeek-4440699084') {
        return assistantManagerDetailHtml
      }
      if (url === 'https://www.linkedin.com/jobs/view/back-office-executive-at-rupeek-4437967359') {
        return backOfficeDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://rupeek.com/about/careers',
    'https://www.linkedin.com/jobs/view/assistant-manager-taxation-at-rupeek-4440699084',
    'https://www.linkedin.com/jobs/view/back-office-executive-at-rupeek-4437967359',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].experienceRequired, '3 years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.match(jobs[0].jobDescription || '', /Tax Accountant/i)
  assert.equal(jobs[0].source, 'rupeek')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.match(jobs[1].jobDescription || '', /branch audit records/i)
  assert.equal(jobs[1].source, 'rupeek')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Rupeek fails closed when the verified first-party careers page drifts', async () => {
  const { createRupeekScraper } = await loadRupeekModule()
  const scraper = createRupeekScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => verifiedCareersHtml.replace('Engineering at Rupeek', 'Team Rupeek'),
    }),
    /verified official careers page/i,
  )
})
