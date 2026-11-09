import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <div class="aol-ad-outer-wrapper">
        <div class="aol-ad-inner-wrapper aol_ad_425041">
          <div class="panel panel-default open">
            <div class="panel-heading">Principal Engineer</div>
            <div class="panel-body">
              <p>Key Responsibilities: Lead procurement strategy for major electrical packages.</p>
              <div class="clearfix"></div>
              <a href="https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2-2-2-2-2/">
                <button class="fusion-button button read-more btn btn-info">Read More</button>
              </a>
            </div>
            <div class="panel-footer">
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Roles: </strong>E&amp;I Package, Principal Engineer, </span>
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Functional Areas: </strong>Procurement, </span>
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Locations: </strong>Chennai, </span>
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Experiences: </strong>10-12 years professional work experience, </span>
            </div>
          </div>
        </div>
        <div class="aol-ad-inner-wrapper aol_ad_424807">
          <div class="panel panel-default open">
            <div class="panel-heading">Sales and Marketing</div>
            <div class="panel-body">
              <p>Role Overview The Marketing &amp; Business Development professional will be responsible for driving business growth.</p>
              <div class="clearfix"></div>
              <a href="https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2/">
                <button class="fusion-button button read-more btn btn-info">Read More</button>
              </a>
            </div>
            <div class="panel-footer">
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Roles: </strong>Manager - Marketing &amp; BD, </span>
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Functional Areas: </strong>Sales &amp; Marketing, </span>
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Locations: </strong>India, </span>
              <span class="aol-tax-wrapper"><strong class="aol-ad-taxonomy">Experiences: </strong>12-18 years professional work experience, </span>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`

const principalEngineerDetailHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <div class="wt-post-title">
        <h2 class="post-title">Principal Engineer</h2>
      </div>
      <div class="post-meta">
        <span class="posted-on">Posted on <a href="#">May 15, 2026</a></span>
      </div>
      <div class="wt-post-text">
        <div class="aol-single aol-wrapper">
          <section class="qs-inner-cont tab-pane active">
            <strong>Key Responsibilities:</strong><br />
            Lead procurement strategy for major electrical packages.<br />
            <strong>Required Qualifications:</strong><br />
            Bachelor's Degree in Electrical Engineering or equivalent.
          </section>
        </div>
      </div>
    </body>
  </html>
`

const salesMarketingDetailHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <div class="wt-post-title">
        <h2 class="post-title">Sales and Marketing</h2>
      </div>
      <div class="post-meta">
        <span class="posted-on">Posted on <a href="#">May 14, 2026</a></span>
      </div>
      <div class="wt-post-text">
        <div class="aol-single aol-wrapper">
          <section class="qs-inner-cont tab-pane active">
            <strong>Role Overview</strong><br />
            Drive business growth by engaging with clients and shaping opportunities.
          </section>
        </div>
      </div>
    </body>
  </html>
`

test('WABAG custom scraper keeps listings on the verified first-party careers route', async () => {
  const wabag = await loadModule()
  assert.ok(wabag, 'Expected scraper module at ./script.js')

  assert.equal(wabag.CAREER_PAGE_URL, 'https://www.wabag.com/careers/')
  assert.equal(wabag.COMPANY, 'VA Tech Wabag')
  assert.equal(wabag.SOURCE, 'wabag')
})

test('WABAG parses official first-party openings and enriches them with same-domain detail pages', async () => {
  const wabag = await loadModule()
  assert.ok(wabag, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await wabag.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === wabag.CAREER_PAGE_URL) {
        return careersHtml
      }

      if (url === 'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2-2-2-2-2/') {
        return principalEngineerDetailHtml
      }

      if (url === 'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2/') {
        return salesMarketingDetailHtml
      }

      throw new Error(`Unexpected WABAG fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    wabag.CAREER_PAGE_URL,
    'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2-2-2-2-2/',
    'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2/',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      jobId: job.jobId,
      title: job.title,
      city: job.city,
      country: job.country,
      location: job.location,
      department: job.department,
      experienceRequired: job.experienceRequired,
      link: job.link,
      applyUrl: job.applyUrl,
    })),
    [
      {
        jobId: '425041',
        title: 'Principal Engineer',
        city: 'Chennai',
        country: 'India',
        location: 'Chennai',
        department: 'Procurement',
        experienceRequired: '10-12 years professional work experience',
        link: 'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2-2-2-2-2/',
        applyUrl: 'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2-2-2-2-2/',
      },
      {
        jobId: '424807',
        title: 'Sales and Marketing',
        city: null,
        country: 'India',
        location: 'India',
        department: 'Sales & Marketing',
        experienceRequired: '12-18 years professional work experience',
        link: 'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2/',
        applyUrl: 'https://www.wabag.com/career/sales-and-marketing-specialist-water-industry-2-2-2-2/',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Lead procurement strategy/i)
  assert.match(jobs[1].jobDescription, /Drive business growth/i)
  assert.ok(Date.parse(jobs[0].scrapedAt))
  assert.ok(Date.parse(jobs[1].scrapedAt))
})
