import assert from 'node:assert/strict'
import test from 'node:test'

const loadJumbotailModule = async () => {
  try {
    return await import('../../scraper/jumbotail/script.js')
  } catch {
    return null
  }
}

const LISTING_HTML = `
  <section class="open-roles">
    <article class="job-card">
      <a href="https://jumbotail.com/job/senior-product-manager-bengaluru/">Senior Product Manager</a>
      <p>Bengaluru, Karnataka, India</p>
    </article>
    <article class="job-card">
      <a href="/careers/sde-2-bengaluru/">SDE 2</a>
      <p>Bengaluru, Karnataka, India</p>
    </article>
    <article class="job-card">
      <a href="/careers/category-manager-dubai/">Category Manager</a>
      <p>Dubai, United Arab Emirates</p>
    </article>
  </section>
`

const DETAIL_BY_URL = {
  'https://jumbotail.com/careers/senior-product-manager-bengaluru/': `
    <main>
      <h1>Product Manager</h1>
      <div class="job-meta">
        <span>Product</span>
        <span>Bengaluru, Karnataka, India</span>
      </div>
      <section>
        <h2>About the role</h2>
        <p>Own the roadmap for seller growth.</p>
      </section>
    </main>
  `,
  'https://jumbotail.com/careers/sde-2-bengaluru/': `
    <main>
      <h1>SDE 2</h1>
      <div class="job-meta">
        <span>Engineering</span>
        <span>Bengaluru, Karnataka, India</span>
      </div>
      <section>
        <h2>What you will do</h2>
        <p>Build marketplace services at scale.</p>
      </section>
    </main>
  `,
}

test('run extracts India jobs from Jumbotail careers pages and preserves listing titles over mismatched detail titles', async () => {
  const jumbotail = await loadJumbotailModule()
  assert.ok(jumbotail, 'Expected Jumbotail scraper module at ../../scraper/jumbotail/script.js')

  const requestedUrls = []
  const jobs = await jumbotail.createJumbotailScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === jumbotail.CAREERS_PAGE_URL) {
        return LISTING_HTML
      }

      if (Object.hasOwn(DETAIL_BY_URL, url)) {
        return DETAIL_BY_URL[url]
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://jumbotail.com/careers/',
    'https://jumbotail.com/careers/senior-product-manager-bengaluru/',
    'https://jumbotail.com/careers/sde-2-bengaluru/',
  ])

  assert.equal(jumbotail.COMPANY, 'Jumbotail')
  assert.equal(jumbotail.SOURCE, 'jumbotail')
  assert.equal(jumbotail.CAREERS_PAGE_URL, 'https://jumbotail.com/careers/')
  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Senior Product Manager',
    company: 'Jumbotail',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'senior-product-manager-bengaluru',
    requisitionId: 'senior-product-manager-bengaluru',
    sourceUrl: 'https://jumbotail.com/careers/senior-product-manager-bengaluru/',
    applyUrl: 'mailto:mission@jumbotail.com',
    employmentType: null,
    department: 'Product',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'About the role Own the roadmap for seller growth.',
    remoteStatus: null,
    source: 'jumbotail',
    link: 'mailto:mission@jumbotail.com',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.equal(jobs[1].title, 'SDE 2')
  assert.equal(jobs[1].department, 'Engineering')
  assert.equal(jobs[1].sourceUrl, 'https://jumbotail.com/careers/sde-2-bengaluru/')
  assert.equal(jobs[1].applyUrl, 'mailto:mission@jumbotail.com')
})
