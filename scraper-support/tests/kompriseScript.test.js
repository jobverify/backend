import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at Komprise | Help Change How the World Manages Data</title>
    <link rel="canonical" href="https://www.komprise.com/careers/" />
  </head>
  <body>
    <h1>CAREERS @ KOMPRISE</h1>
    <h2>Open Positions</h2>
    <p>Your browser does not support JavaScript, or it is disabled. JavaScript must be enabled in order to view listings.</p>
    <p>Email us at us_careers@komprise.com or india_careers@komprise.com</p>
    <script>
      var job_manager_ajax_filters = {"ajax_url":"\\/jm-ajax\\/%%endpoint%%\\/"};
    </script>
    <script src="https://www.komprise.com/wp-content/plugins/wp-job-manager/assets/dist/js/ajax-filters.js"></script>
  </body>
</html>
`

const JOB_LISTING_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.komprise.com/job/account-executive/</loc>
    <lastmod>2026-06-17T21:57:44+00:00</lastmod>
  </url>
  <url>
    <loc>https://www.komprise.com/job/product-management-vp/</loc>
    <lastmod>2026-09-01T15:37:25+00:00</lastmod>
  </url>
  <url>
    <loc>https://www.komprise.com/job/sales-ops-analyst/</loc>
    <lastmod>2026-09-01T15:37:25+00:00</lastmod>
  </url>
  <url>
    <loc>https://www.komprise.com/job/ux-designer/</loc>
    <lastmod>2026-09-01T15:37:25+00:00</lastmod>
  </url>
  <url>
    <loc>https://www.komprise.com/job/implementation-engineer-2/</loc>
    <lastmod>2026-07-16T13:54:38+00:00</lastmod>
  </url>
  <url>
    <loc>https://www.komprise.com/job/technical-support-engineer/</loc>
    <lastmod>2026-07-16T14:04:53+00:00</lastmod>
  </url>
</urlset>
`

const ACCOUNT_EXECUTIVE_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title" content="Account Executive - Multiple Locations in the US &#8211; Komprise" />
    <meta property="og:description" content="Location: USA (Remote) | Employment Type: Full-time Company Overview: Komprise powers the connection between unstructured data management and AI." />
    <link rel="canonical" href="https://www.komprise.com/?post_type=job_listing&p=52562" />
  </head>
  <body>
    <li class="location"><a class="google_map_link" href="https://maps.google.com/maps?q=USA%20(Remote)">USA (Remote)</a></li>
    <p><strong>How to Apply:</strong> Submit your resume highlighting your relevant experience to: <a href="mailto:us_careers@komprise.com">us_careers@komprise.com</a>.</p>
    <div class="job_application">
      <input type="button" class="application_button button" value="Apply for job" />
      <div class="application_details">
        <p>To apply for this job <strong>email your details to</strong> <a class="job_application_email" href="mailto:us_careers@komprise.com?subject=Application%20via%20Account%20Executive%20listing%20on%20https%3A%2F%2Fwww.komprise.com">us_careers@komprise.com</a></p>
      </div>
    </div>
    <script>
      var job_manager_stats = {"postId":"52562"};
    </script>
  </body>
</html>
`

const PRODUCTIVITY_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title" content="Software Development Engineer - Productivity &#8211; Komprise" />
    <meta property="og:description" content="Job Title: Software Development Engineer &#8211; Productivity Location: Bengaluru Company Overview: Komprise unlocks unstructured data for AI while optimizing data&amp;hellip;" />
    <link rel="canonical" href="https://www.komprise.com/?post_type=job_listing&p=58125" />
  </head>
  <body>
    <li class="location"><a class="google_map_link" href="https://maps.google.com/maps?q=Bengaluru">Bengaluru</a></li>
    <div class="job_application">
      <input type="button" class="application_button button" value="Apply for job" />
      <div class="application_details">
        <p>To apply for this job <strong>email your details to</strong> <a class="job_application_email" href="mailto:india_careers@komprise.com?subject=Application%20via%20Software%20Development%20Engineer%20-%20Productivity%20listing%20on%20https%3A%2F%2Fwww.komprise.com">india_careers@komprise.com</a></p>
      </div>
    </div>
    <script>
      var job_manager_stats = {"postId":"58125"};
    </script>
  </body>
</html>
`

const IMPLEMENTATION_ENGINEER_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title" content="Implementation Engineer &#8211; Komprise" />
    <meta property="og:description" content="Company Overview Komprise unlocks unstructured data for AI while optimizing data placement to cut storage costs. With Komprise Intelligent Data&amp;hellip;" />
    <link rel="canonical" href="https://www.komprise.com/?post_type=job_listing&p=57725" />
  </head>
  <body>
    <li class="location"><a class="google_map_link" href="https://maps.google.com/maps?q=Bengaluru">Bengaluru</a></li>
    <div class="job_application">
      <input type="button" class="application_button button" value="Apply for job" />
      <div class="application_details">
        <p>To apply for this job <strong>email your details to</strong> <a class="job_application_email" href="mailto:india_careers@komprise.com?subject=Application%20via%20Implementation%20Engineer%20listing%20on%20https%3A%2F%2Fwww.komprise.com">india_careers@komprise.com</a></p>
      </div>
    </div>
    <script>
      var job_manager_stats = {"postId":"57725"};
    </script>
  </body>
</html>
`

const TECH_SUPPORT_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title" content="Technical Support Engineer &#8211; Komprise" />
    <meta property="og:description" content="Location: Bangalore | Employment Type: Full-time Company Overview: Komprise unlocks unstructured data for AI while optimizing data placement to cut costs." />
    <link rel="canonical" href="https://www.komprise.com/?post_type=job_listing&p=57727" />
  </head>
  <body>
    <h6 class="back_to_link"><a href="/careers/">&lt; Back To Careers</a></h6>
    <li class="location"><a class="google_map_link" href="https://maps.google.com/maps?q=Bengalaru">Bengalaru</a></li>
    <p><strong>How to Apply</strong></p>
    <div class="job_application">
      <input type="button" class="application_button button" value="Apply for job" />
      <div class="application_details">
        <p>To apply for this job <strong>email your details to</strong> <a class="job_application_email" href="mailto:india_careers@komprise.com?subject=Application%20via%20Technical%20Support%20Engineer%20listing%20on%20https%3A%2F%2Fwww.komprise.com">india_careers@komprise.com</a></p>
      </div>
    </div>
    <div class="job_info__box widget_text">
      <h4>Company Overview</h4>
      <div class="textwidget">
        <p>Komprise powers the connection between unstructured data management and AI.</p>
      </div>
    </div>
    <script>
      var job_manager_stats = {"postId":"57727"};
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/komprise/script.js')
  } catch {
    assert.fail('Expected Komprise scraper module at ../../scraper/komprise/script.js')
  }
}

test('Komprise helpers stay pinned to the verified careers page, job sitemap, and India apply-flow filter', async () => {
  const komprise = await loadModule()

  assert.equal(komprise.SOURCE, 'komprise')
  assert.equal(komprise.COMPANY, 'Komprise')
  assert.equal(komprise.VERIFIED_ON, '2026-10-03')
  assert.equal(komprise.HOMEPAGE_URL, 'https://www.komprise.com/')
  assert.equal(komprise.CAREERS_URL, 'https://www.komprise.com/careers/')
  assert.equal(komprise.SITEMAP_INDEX_URL, 'https://www.komprise.com/sitemap_index.xml')
  assert.equal(
    komprise.JOB_LISTING_SITEMAP_URL,
    'https://www.komprise.com/job_listing-sitemap.xml',
  )
  assert.deepEqual(komprise.VERIFIED_JOB_DETAIL_URLS, [
    'https://www.komprise.com/job/account-executive/',
    'https://www.komprise.com/job/ux-designer/',
    'https://www.komprise.com/job/software-development-engineer-test/',
  ])
  assert.equal(komprise.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(komprise.hasJobListingSitemapSignal(JOB_LISTING_SITEMAP_XML), true)
  assert.deepEqual(
    komprise.extractSitemapEntries(JOB_LISTING_SITEMAP_XML),
    [
      {
        url: 'https://www.komprise.com/job/account-executive/',
        lastmod: '2026-06-17T21:57:44+00:00',
      },
      {
        url: 'https://www.komprise.com/job/product-management-vp/',
        lastmod: '2026-09-01T15:37:25+00:00',
      },
      {
        url: 'https://www.komprise.com/job/sales-ops-analyst/',
        lastmod: '2026-09-01T15:37:25+00:00',
      },
      {
        url: 'https://www.komprise.com/job/ux-designer/',
        lastmod: '2026-09-01T15:37:25+00:00',
      },
      {
        url: 'https://www.komprise.com/job/implementation-engineer-2/',
        lastmod: '2026-07-16T13:54:38+00:00',
      },
      {
        url: 'https://www.komprise.com/job/technical-support-engineer/',
        lastmod: '2026-07-16T14:04:53+00:00',
      },
    ],
  )
  assert.deepEqual(
    komprise.extractJobFromDetailPage({
      url: 'https://www.komprise.com/job/technical-support-engineer/',
      lastmod: '2026-07-16T14:04:53+00:00',
      html: TECH_SUPPORT_DETAIL_HTML,
    }),
    {
      title: 'Technical Support Engineer',
      company: 'Komprise',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '57727',
      requisitionId: '57727',
      sourceUrl: 'https://www.komprise.com/job/technical-support-engineer/',
      applyUrl:
        'mailto:india_careers@komprise.com?subject=Application%20via%20Technical%20Support%20Engineer%20listing%20on%20https%3A%2F%2Fwww.komprise.com',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-16',
      closingDate: null,
      jobDescription:
        'Location: Bangalore | Employment Type: Full-time Company Overview: Komprise unlocks unstructured data for AI while optimizing data placement to cut costs.',
      remoteStatus: null,
    },
  )
  assert.equal(
    komprise.extractJobFromDetailPage({
      url: 'https://www.komprise.com/job/account-executive/',
      lastmod: '2026-06-17T21:57:44+00:00',
      html: ACCOUNT_EXECUTIVE_DETAIL_HTML,
    }),
    null,
  )
})

test('Komprise run validates the verified careers shell, consumes the job sitemap, and returns India roles only', async () => {
  const komprise = await loadModule()
  const requested = []

  const jobs = await komprise.createKompriseScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requested.push(url)

      if (url === komprise.CAREERS_URL) return CAREERS_HTML
      if (url === komprise.JOB_LISTING_SITEMAP_URL) return JOB_LISTING_SITEMAP_XML
      if (url === 'https://www.komprise.com/job/account-executive/') return ACCOUNT_EXECUTIVE_DETAIL_HTML
      if (url === 'https://www.komprise.com/job/implementation-engineer-2/') return IMPLEMENTATION_ENGINEER_DETAIL_HTML
      if (url === 'https://www.komprise.com/job/technical-support-engineer/') return TECH_SUPPORT_DETAIL_HTML
      if (url === 'https://www.komprise.com/job/product-management-vp/') return ACCOUNT_EXECUTIVE_DETAIL_HTML
      if (url === 'https://www.komprise.com/job/sales-ops-analyst/') return ACCOUNT_EXECUTIVE_DETAIL_HTML
      if (url === 'https://www.komprise.com/job/ux-designer/') return ACCOUNT_EXECUTIVE_DETAIL_HTML

      throw new Error(`Unexpected Komprise URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    komprise.CAREERS_URL,
    komprise.JOB_LISTING_SITEMAP_URL,
    'https://www.komprise.com/job/account-executive/',
    'https://www.komprise.com/job/product-management-vp/',
    'https://www.komprise.com/job/sales-ops-analyst/',
    'https://www.komprise.com/job/ux-designer/',
    'https://www.komprise.com/job/implementation-engineer-2/',
    'https://www.komprise.com/job/technical-support-engineer/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.applyUrl, job.source, job.scrapedAt]),
    [
      [
        'Implementation Engineer',
        'Bangalore, India',
        'mailto:india_careers@komprise.com?subject=Application%20via%20Implementation%20Engineer%20listing%20on%20https%3A%2F%2Fwww.komprise.com',
        'komprise',
        FIXED_SCRAPED_AT,
      ],
      [
        'Technical Support Engineer',
        'Bangalore, India',
        'mailto:india_careers@komprise.com?subject=Application%20via%20Technical%20Support%20Engineer%20listing%20on%20https%3A%2F%2Fwww.komprise.com',
        'komprise',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[1].jobDescription, /Komprise unlocks unstructured data for AI/i)
})

test('Komprise accepts its changed first-party sitemap and the visible India email apply link', async () => {
  const komprise = await loadModule()
  const currentSitemap = `<urlset>
    <url><loc>https://www.komprise.com/job/account-executive/</loc><lastmod>2026-06-17T21:57:44+00:00</lastmod></url>
    <url><loc>https://www.komprise.com/job/ux-designer/</loc><lastmod>2026-08-24T16:37:33+00:00</lastmod></url>
    <url><loc>https://www.komprise.com/job/software-development-engineer-test/</loc><lastmod>2026-09-25T04:49:16+00:00</lastmod></url>
  </urlset>`
  assert.equal(komprise.hasJobListingSitemapSignal(currentSitemap), true)
  assert.equal(komprise.hasJobListingSitemapSignal(currentSitemap.replace('www.komprise.com/job/ux-designer', 'other.example/job/ux-designer')), false)

  const uxHtml = `<title>Komprise UX Designer</title>
    <meta property="og:title" content="Komprise UX Designer" />
    <meta property="og:description" content="Craft the future of our data management platform." />
    <a class="google_map_link">Bengalaru</a>
    <a href="mailto:india_careers@komprise.com">Apply</a>
    <script>var job_manager_stats = {"postId":"58531"};</script>`
  const job = komprise.extractJobFromDetailPage({
    url: 'https://www.komprise.com/job/ux-designer/',
    lastmod: '2026-08-24T16:37:33+00:00',
    html: uxHtml,
  })
  assert.equal(job.title, 'UX Designer')
  assert.equal(job.location, 'Bengaluru, India')
  assert.equal(job.applyUrl, 'mailto:india_careers@komprise.com')
})
