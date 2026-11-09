import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Stashfin</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/careers">Careers</a>
      <a href="/culture">Culture</a>
    </nav>
    <main>
      <section class="hero">
        <h1>Be part of the journey</h1>
        <p>Join a team that's redefining the future of finance. At Stashfin, your ideas drive innovation, your work sparks change, and your career grows with purpose.</p>
      </section>
      <section class="openings">
        <h2>We're always looking for talented people</h2>
        <p>Stashfin is growing fast, and we are always looking for passionate, dynamic, and talented individuals to join our distributed team all around the world.</p>
        <div>All openings Product Design Product Management Software Development</div>
        <section>
          <h2>Product Design</h2>
          <article>
            <h3>Product Designer</h3>
            <p>We're looking for a mid-level Product Designer to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
          <article>
            <h3>UX Designer</h3>
            <p>We're looking for a UX Designer to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
          <article>
            <h3>UX Designer</h3>
            <p>We're looking for a UX Designer to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
        </section>
        <section>
          <h2>Product Management</h2>
          <article>
            <h3>Growth Product Manager</h3>
            <p>We're looking for a Growth Product Manager to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
          <article>
            <h3>Senior Product Manager</h3>
            <p>We're looking for a Senior Product Manager to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
        </section>
        <section>
          <h2>Software Development</h2>
          <article>
            <h3>Frontend Engineer</h3>
            <p>We're looking for a Frontend Engineer to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
          <article>
            <h3>Backend Engineer</h3>
            <p>We're looking for a Backend Engineer to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
          <article>
            <h3>Backend Engineer</h3>
            <p>We're looking for a Backend Engineer to join our team.</p>
            <p>Gurgaon, India Full-time</p>
          </article>
        </section>
      </section>
      <section>
        <h2>Perks & Benefits</h2>
      </section>
      <section>
        <h2>Employee Stories</h2>
        <h3>Anubhav Agarwal</h3>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/stashfin/script.js')
  } catch {
    assert.fail('Expected Stashfin scraper module at ../../scraper/stashfin/script.js')
  }
}

test('Stashfin pins the verified first-party inline careers page contract', async () => {
  const stashfin = await loadModule()

  assert.equal(stashfin.SOURCE, 'stashfin')
  assert.equal(stashfin.COMPANY, 'Stashfin')
  assert.equal(stashfin.OFFICIAL_BRAND_NAME, 'Stashfin')
  assert.equal(stashfin.VERIFIED_ON, '2026-07-17')
  assert.equal(stashfin.HOMEPAGE_URL, 'https://www.stashfin.com/')
  assert.equal(stashfin.CAREERS_URL, 'https://www.stashfin.com/careers')
  assert.equal(stashfin.PUBLIC_BOARD_URL, 'https://www.stashfin.com/careers')
  assert.equal(stashfin.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(
    stashfin.hasOfficialCareersPageSignal('<html><body><h1>Unexpected</h1></body></html>'),
    false,
  )
})

test('extractSearchResults maps Stashfin inline public cards into shared scraper fields', async () => {
  const stashfin = await loadModule()
  const jobs = stashfin.extractSearchResults(CAREERS_HTML)

  assert.equal(jobs.length, 8)
  assert.deepEqual(jobs[0], {
    title: 'Product Designer',
    company: 'Stashfin',
    department: 'Product Design',
    location: 'Gurgaon, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: 'product-designer-gurgaon-india',
    requisitionId: 'product-designer-gurgaon-india',
    sourceUrl: 'https://www.stashfin.com/careers',
    applyUrl: 'https://www.stashfin.com/careers',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: "We're looking for a mid-level Product Designer to join our team.",
    publicExperienceChecked: true,
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'UX Designer')
  assert.equal(jobs[1].jobId, 'ux-designer-gurgaon-india')
  assert.equal(jobs[2].title, 'UX Designer')
  assert.equal(jobs[2].jobId, 'ux-designer-gurgaon-india-2')
  assert.equal(jobs[4].department, 'Product Management')
  assert.equal(jobs[5].title, 'Frontend Engineer')
  assert.equal(jobs[7].jobId, 'backend-engineer-gurgaon-india-2')
})

test('run fetches the verified Stashfin careers page and decorates inline jobs', async () => {
  const stashfin = await loadModule()
  const requestedUrls = []
  const scraper = stashfin.createStashfinScraper({ maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === stashfin.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected Stashfin URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [stashfin.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'stashfin')
  assert.equal(jobs[0].link, 'https://www.stashfin.com/careers')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].jobId, 'ux-designer-gurgaon-india')
})

test('run fails closed when the verified Stashfin careers page contract drifts', async () => {
  const stashfin = await loadModule()

  await assert.rejects(
    stashfin.createStashfinScraper().run({
      fetchText: async () => CAREERS_HTML.replace("We're always looking for talented people", 'Open Roles'),
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    stashfin.createStashfinScraper().run({
      fetchText: async () =>
        CAREERS_HTML
          .replace(/<article>[\s\S]*?<\/article>/, '')
          .replace(/<article>[\s\S]*?<\/article>/, '')
          .replace(/<article>[\s\S]*?<\/article>/, '')
          .replace(/<article>[\s\S]*?<\/article>/, '')
          .replace(/<article>[\s\S]*?<\/article>/, '')
          .replace(/<article>[\s\S]*?<\/article>/, '')
          .replace(/<article>[\s\S]*?<\/article>/, '')
          .replace(/<article>[\s\S]*?<\/article>/, ''),
    }),
    /trusted inline public job cards/i,
  )
})
