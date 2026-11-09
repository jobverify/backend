import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Prism RMC</title>
    <link rel="canonical" href="https://www.rmcindia.com/" />
  </head>
  <body>
    <nav>
      <a href="https://www.rmcindia.com/join-our-team/">Join our team</a>
      <a href="https://www.rmcindia.com/job-openings/">Careers</a>
    </nav>
    <main>
      <p>One of India's leading ready mix concrete manufacturer.</p>
      <p>Prism RMC Brochure</p>
    </main>
  </body>
</html>
`

const PAGE_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.rmcindia.com/join-our-team/</loc></url>
  <url><loc>https://www.rmcindia.com/job-openings/</loc></url>
  <url><loc>https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/</loc></url>
  <url><loc>https://www.rmcindia.com/rmc-jobs-sales-executive/</loc></url>
</urlset>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Join our team &#8211; Prism RMC</title>
  </head>
  <body>
    <main>
      <h1>Join our team</h1>
      <div class="grid-item col-xl-6">
        <div class="item--inner">
          <div class="item--holder">
            <div class="item--image">
              <a href="https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/">
                <img src="/graduate.jpg" alt="Graduate Engineer Trainee" />
              </a>
            </div>
            <div class="item--meta">
              <h3 class="item--title">Graduate Engineer Trainee</h3>
              <ul class="item--feature">
                <li><i class="fa fa-map-marker"></i>Pan India</li>
                <li><i class="fa fa-briefcase"></i>Full-time</li>
                <li><i class="fa fa-graduation-cap"></i>Bachelor&#039;s Degree in Engineering (BE/B.Tech)</li>
                <li><i class="fa fa-user-plus"></i>Fresher</li>
              </ul>
            </div>
          </div>
          <div class="item-desc">We are seeking dynamic and motivated Graduate Engineer Trainees to join our team.</div>
          <div class="item--button">
            <a class="btn btn-secondary" href="https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/">
              Check Details
            </a>
          </div>
        </div>
      </div>
      <div class="grid-item col-xl-6">
        <div class="item--inner">
          <div class="item--holder">
            <div class="item--image">
              <a href="https://www.rmcindia.com/rmc-jobs-sales-executive/">
                <img src="/sales.jpg" alt="Sales Executive" />
              </a>
            </div>
            <div class="item--meta">
              <h3 class="item--title">Sales Executive</h3>
              <ul class="item--feature">
                <li><i class="fa fa-map-marker"></i>Pan India</li>
                <li><i class="fa fa-briefcase"></i>Full-time</li>
                <li><i class="fa fa-graduation-cap"></i>MBA in Marketing</li>
                <li><i class="fa fa-user-plus"></i>3-5 years Experience in RMC/ Building material industry</li>
              </ul>
            </div>
          </div>
          <div class="item-desc">Exciting news! We're hiring and looking for talented individuals to join our team.</div>
          <div class="item--button">
            <a class="btn btn-secondary" href="https://www.rmcindia.com/rmc-jobs-sales-executive/">
              Check details
            </a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const TRAINEE_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Graduate Engineer Trainee &#8211; Prism RMC</title>
  </head>
  <body>
    <main>
      <p><strong>Location:</strong> Pan India</p>
      <p><strong>Job Type:</strong> Full-time</p>
      <p><strong>Education:</strong> Bachelor's Degree in Engineering (BE/B.Tech)</p>
      <p><strong>Experience:</strong> Fresher</p>
      <p><strong>Job Description:</strong> We are seeking dynamic and motivated Graduate Engineer Trainees to join our team.</p>
      <p><strong>Qualifications:</strong></p>
      <ul>
        <li>Bachelor’s degree in Engineering – Civil</li>
        <li>Strong academic background with a good understanding of engineering fundamentals.</li>
      </ul>
      <a href="https://forms.gle/CpjiX3PnxG3STm7r9" class="btn btn-effect">
        <span class="ct-button-text">Click here to Apply</span>
      </a>
    </main>
  </body>
</html>
`

const SALES_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Sales Executive &#8211; Prism RMC</title>
  </head>
  <body>
    <main>
      <p><strong>Job Category:</strong> Marketing Department</p>
      <p><strong>Job Type:</strong> Full Time</p>
      <p><strong>Location:</strong> Pan India</p>
      <p><strong>Education:</strong> MBA in Marketing</p>
      <p><strong>Qualifications:</strong></p>
      <ul>
        <li>3-5 years Experience in RMC/ Building material industry</li>
      </ul>
      <a href="https://forms.gle/sales-executive-apply" class="btn btn-effect">
        <span class="ct-button-text">Click here to Apply</span>
      </a>
    </main>
  </body>
</html>
`

const EMPTY_CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Join our team &#8211; Prism RMC</title>
  </head>
  <body>
    <main>
      <h1>Join our team</h1>
      <p>There are currently no openings at Prism RMC.</p>
    </main>
  </body>
</html>
`

const EMPTY_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.rmcindia.com/join-our-team/</loc></url>
</urlset>
`

const loadPrismRmcModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Prism RMC scraper module at ./script.js')
  }
}

test('Prism RMC scraper validates the verified first-party homepage, careers page, and sitemap', async () => {
  const prismRmc = await loadPrismRmcModule()

  assert.equal(prismRmc.SOURCE, 'prismrmc')
  assert.equal(prismRmc.COMPANY, 'Prism RMC')
  assert.equal(prismRmc.HOMEPAGE_URL, 'https://www.rmcindia.com/')
  assert.equal(prismRmc.CAREERS_URL, 'https://www.rmcindia.com/join-our-team/')
  assert.equal(prismRmc.PAGE_SITEMAP_URL, 'https://www.rmcindia.com/wp-sitemap-posts-page-1.xml')
  assert.equal(prismRmc.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(prismRmc.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(prismRmc.hasVerifiedPageSitemapSignal(PAGE_SITEMAP_XML), true)
  assert.deepEqual(prismRmc.extractDetailUrlsFromSitemap(PAGE_SITEMAP_XML), [
    'https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/',
    'https://www.rmcindia.com/rmc-jobs-sales-executive/',
  ])
  assert.deepEqual(prismRmc.extractListings(CAREERS_HTML), [
    {
      title: 'Graduate Engineer Trainee',
      company: 'Prism RMC',
      department: null,
      location: 'Pan India',
      city: null,
      country: 'India',
      jobId: 'rmc-jobs-graduate-engineer-trainee-details',
      requisitionId: 'rmc-jobs-graduate-engineer-trainee-details',
      sourceUrl: 'https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/',
      applyUrl: 'https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/',
      employmentType: 'Full-time',
      experienceRequired: 'Fresher',
      minimumQualification: "Bachelor's Degree in Engineering (BE/B.Tech)",
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are seeking dynamic and motivated Graduate Engineer Trainees to join our team.',
    },
    {
      title: 'Sales Executive',
      company: 'Prism RMC',
      department: null,
      location: 'Pan India',
      city: null,
      country: 'India',
      jobId: 'rmc-jobs-sales-executive',
      requisitionId: 'rmc-jobs-sales-executive',
      sourceUrl: 'https://www.rmcindia.com/rmc-jobs-sales-executive/',
      applyUrl: 'https://www.rmcindia.com/rmc-jobs-sales-executive/',
      employmentType: 'Full-time',
      experienceRequired: '3-5 years Experience in RMC/ Building material industry',
      minimumQualification: 'MBA in Marketing',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: "Exciting news! We're hiring and looking for talented individuals to join our team.",
    },
  ])
})

test('Prism RMC scraper enriches verified first-party detail pages into job records', async () => {
  const prismRmc = await loadPrismRmcModule()

  const [traineeListing, salesListing] = prismRmc.extractListings(CAREERS_HTML)
  const trainee = prismRmc.extractJobDetail(TRAINEE_DETAIL_HTML, traineeListing)
  const sales = prismRmc.extractJobDetail(SALES_DETAIL_HTML, salesListing)

  assert.equal(trainee.title, 'Graduate Engineer Trainee')
  assert.equal(trainee.location, 'Pan India')
  assert.equal(trainee.employmentType, 'Full-time')
  assert.equal(trainee.minimumQualification, "Bachelor's Degree in Engineering (BE/B.Tech)")
  assert.equal(trainee.experienceRequired, 'Fresher')
  assert.equal(trainee.applyUrl, 'https://forms.gle/CpjiX3PnxG3STm7r9')
  assert.ok(
    trainee.requiredSkills.includes('Strong academic background with a good understanding of engineering fundamentals.'),
  )
  assert.match(trainee.jobDescription, /Graduate Engineer Trainees/i)

  assert.equal(sales.title, 'Sales Executive')
  assert.equal(sales.department, 'Marketing Department')
  assert.equal(sales.employmentType, 'Full-time')
  assert.equal(sales.minimumQualification, 'MBA in Marketing')
  assert.equal(sales.experienceRequired, '3-5 years Experience in RMC/ Building material industry')
  assert.equal(sales.applyUrl, 'https://forms.gle/sales-executive-apply')
  assert.deepEqual(sales.requiredSkills, ['3-5 years Experience in RMC/ Building material industry'])
})

test('Prism RMC scraper returns normalized first-party jobs end to end from the verified careers flow', async () => {
  const prismRmc = await loadPrismRmcModule()
  const requestedUrls = []
  const requestedSitemaps = []

  const jobs = await prismRmc.createPrismRmcScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === prismRmc.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === prismRmc.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/') {
        return TRAINEE_DETAIL_HTML
      }
      if (url === 'https://www.rmcindia.com/rmc-jobs-sales-executive/') {
        return SALES_DETAIL_HTML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPageSitemap: async (url) => {
      requestedSitemaps.push(url)
      if (url === prismRmc.PAGE_SITEMAP_URL) return { status: 200, text: PAGE_SITEMAP_XML }
      throw new Error(`Unexpected sitemap URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.rmcindia.com/',
    'https://www.rmcindia.com/join-our-team/',
    'https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/',
    'https://www.rmcindia.com/rmc-jobs-sales-executive/',
  ])
  assert.deepEqual(requestedSitemaps, ['https://www.rmcindia.com/wp-sitemap-posts-page-1.xml'])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'prismrmc')
  assert.equal(jobs[0].company, 'Prism RMC')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].companyCareerPage, 'https://www.rmcindia.com/join-our-team/')
  assert.equal(jobs[0].companyDomain, 'rmcindia.com')
  assert.equal(jobs[0].jobType, 'Full-time Fresher')
  assert.equal(jobs[0].applyUrl, 'https://forms.gle/CpjiX3PnxG3STm7r9')
  assert.equal(jobs[0].link, 'https://forms.gle/CpjiX3PnxG3STm7r9')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[1].department, 'Marketing Department')
  assert.equal(jobs[1].jobType, 'Full-time Experienced')
  assert.equal(jobs[1].applyUrl, 'https://forms.gle/sales-executive-apply')
})

test('Prism RMC scraper returns no jobs when the verified careers page explicitly shows no openings', async () => {
  const prismRmc = await loadPrismRmcModule()

  const jobs = await prismRmc.createPrismRmcScraper().run({
    fetchText: async (url) => {
      if (url === prismRmc.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === prismRmc.CAREERS_URL) return EMPTY_CAREERS_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPageSitemap: async (url) => {
      if (url === prismRmc.PAGE_SITEMAP_URL) return { status: 200, text: EMPTY_SITEMAP_XML }
      throw new Error(`Unexpected sitemap URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Prism RMC scraper accepts the verified sitemap body even when the host currently labels the sitemap response as 404', async () => {
  const prismRmc = await loadPrismRmcModule()
  const requested = []

  const jobs = await prismRmc.createPrismRmcScraper().run({
    fetchText: async (url) => {
      requested.push(`text:${url}`)

      if (url === prismRmc.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === prismRmc.CAREERS_URL) return EMPTY_CAREERS_HTML

      throw new Error(`Unexpected fetchText URL: ${url}`)
    },
    fetchPageSitemap: async (url) => {
      requested.push(`sitemap:${url}`)

      assert.equal(url, prismRmc.PAGE_SITEMAP_URL)
      return {
        status: 404,
        text: EMPTY_SITEMAP_XML,
      }
    },
  })

  assert.deepEqual(requested, [
    `text:${prismRmc.HOMEPAGE_URL}`,
    `sitemap:${prismRmc.PAGE_SITEMAP_URL}`,
    `text:${prismRmc.CAREERS_URL}`,
  ])
  assert.deepEqual(jobs, [])
})

test('Prism RMC scraper fails closed when the verified public surface drifts', async () => {
  const prismRmc = await loadPrismRmcModule()

  await assert.rejects(
    prismRmc.createPrismRmcScraper().run({
      fetchText: async (url) => {
        if (url === prismRmc.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchPageSitemap: async () => assert.fail('invalid homepage must stop before the sitemap request'),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    prismRmc.createPrismRmcScraper().run({
      fetchText: async (url) => {
        if (url === prismRmc.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === prismRmc.PAGE_SITEMAP_URL) return PAGE_SITEMAP_XML
        if (url === prismRmc.CAREERS_URL) {
          return CAREERS_HTML.replace(/rmc-jobs-sales-executive/gi, 'rmc-jobs-regional-sales-lead')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchPageSitemap: async (url) => {
        assert.equal(url, prismRmc.PAGE_SITEMAP_URL)
        return { status: 200, text: PAGE_SITEMAP_XML }
      },
    }),
    /sitemap|detail urls/i,
  )

  await assert.rejects(
    prismRmc.createPrismRmcScraper().run({
      fetchText: async (url) => {
        if (url === prismRmc.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === prismRmc.PAGE_SITEMAP_URL) return PAGE_SITEMAP_XML
        if (url === prismRmc.CAREERS_URL) return CAREERS_HTML
        if (url === 'https://www.rmcindia.com/rmc-jobs-graduate-engineer-trainee-details/') {
          return TRAINEE_DETAIL_HTML.replace('Click here to Apply', 'Learn more')
        }
        if (url === 'https://www.rmcindia.com/rmc-jobs-sales-executive/') return SALES_DETAIL_HTML

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchPageSitemap: async (url) => {
        assert.equal(url, prismRmc.PAGE_SITEMAP_URL)
        return { status: 200, text: PAGE_SITEMAP_XML }
      },
    }),
    /job detail page changed materially|apply/i,
  )
})
