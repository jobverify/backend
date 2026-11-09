import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T00:00:00.000Z'

const loadModule = async () => {
  try {
    return await import('../../scraper/pubmatic/script.js')
  } catch (error) {
    assert.fail(`Expected PubMatic scraper module at ../../scraper/pubmatic/script.js: ${error.message}`)
  }
}

test('PubMatic enriches India jobs with first-party detail-page experience', async () => {
  const pubmatic = await loadModule()
  const requestedUrls = []

  const listingHtml = `
    <html>
      <body>
        <h1>OPPORTUNITY. DELIVERED.</h1>
        <div class="postings-count">67 open positions</div>
        <a href="/engineering/">View Engineering Jobs</a>

        <h4 class="location-name">Pune, IN</h4>
        <a href="/job/?gh_jid=5348479008">Associate Director, Finance</a>

        <h4 class="location-name">Gurugram, IN</h4>
        <a href="/job/?gh_jid=5348226008">Customer Success Operations Manager - Spanish Language Expert</a>
      </body>
    </html>
  `

  const detailHtmlByUrl = {
    'https://pubmatic.com/job/?gh_jid=5348479008': `
      <html>
        <body>
          <section class="pubm-job__header">
            <div class="pubm-job__location yellow-bar-title yellow-bar-bottom">Pune, IN</div>
            <h1 class="pubm-job__title">Associate Director, Finance</h1>
          </section>
          <div class="pubm-job__container">
            <div class="pubm-job__content">
              <div class="pubm-job__description">
                <div class="content">
                  <p><strong>About the Role:</strong> The Associate Director, Finance will oversee all core financial, accounting, and compliance functions of the organization.</p>
                  <p><strong>What You'll Do:</strong></p>
                  <ul>
                    <li>10-15 years of post-qualification experience in finance, accounting, and compliance roles, preferably with exposure to technology or service industries.</li>
                    <li>Experience with GST, transfer pricing, and tax audits.</li>
                  </ul>
                  <p><strong>Qualification:</strong></p>
                  <ul>
                    <li>Chartered Accountant (CA) or equivalent qualification.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="pubm-job__sidebar"></div>
          </div>
        </body>
      </html>
    `,
    'https://pubmatic.com/job/?gh_jid=5348226008': `
      <html>
        <body>
          <section class="pubm-job__header">
            <div class="pubm-job__location yellow-bar-title yellow-bar-bottom">Gurugram, IN</div>
            <h1 class="pubm-job__title">Customer Success Operations Manager - Spanish Language Expert</h1>
          </section>
          <div class="pubm-job__container">
            <div class="pubm-job__content">
              <div class="pubm-job__description">
                <div class="content">
                  <p><strong>About the Role:</strong> Support strategic customer-success operations across global programs.</p>
                  <p><strong>Required Experience:</strong></p>
                  <ul>
                    <li>6-8 years of experience in customer success operations, program management, or business operations.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="pubm-job__sidebar"></div>
          </div>
        </body>
      </html>
    `,
  }

  const jobs = await pubmatic.createPubMaticScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === pubmatic.CAREERS_URL) {
        return listingHtml
      }

      if (detailHtmlByUrl[url]) {
        return detailHtmlByUrl[url]
      }

      throw new Error(`Unexpected PubMatic URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pubmatic.CAREERS_URL,
    'https://pubmatic.com/job/?gh_jid=5348479008',
    'https://pubmatic.com/job/?gh_jid=5348226008',
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.experienceRequired]),
    [
      ['Associate Director, Finance', 'Pune, Maharashtra, India', '10-15 years'],
      ['Customer Success Operations Manager - Spanish Language Expert', 'Gurugram, Haryana, India', '6-8 years'],
    ],
  )
  assert.match(jobs[0].jobDescription || '', /Chartered Accountant/i)
  assert.match(jobs[1].jobDescription || '', /customer success operations/i)
  assert.deepEqual(jobs.map((job) => job.scrapedAt), [FIXED_SCRAPED_AT, FIXED_SCRAPED_AT])
})
