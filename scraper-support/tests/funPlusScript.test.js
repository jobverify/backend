import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Hello! Welcome to FunPlus! - FunPlus</title>
  </head>
  <body>
    <nav>
      <a href="https://funplus.com/about/">About</a>
      <a href="https://funplus.com/careers/">Careers</a>
    </nav>
    <main>
      <h1>ALL FOR FUN!</h1>
      <p>At FunPlus our mission is to build a global organization, powered by the best talent.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - FunPlus</title>
  </head>
  <body>
    <main>
      <h1>SAY YES! TO A NEW ADVENTURE</h1>
      <h2>FUN ROLES</h2>
      <p>Take a look at our open positions; if you think you're the right fit, we'd love to hear from you!</p>
      <iframe src="https://funplus.factorialhr.com/embed/jobs" class="lazyload"></iframe>
    </main>
  </body>
</html>
`

const jobsBoardHtml = `
<!doctype html>
<html lang='en-il'>
  <head>
    <title>FunPlus - Job offers, offices and team</title>
  </head>
  <body>
    <div id='jobs'>
      <h2>Open Positions</h2>
      <div data-target='job-filters.officeGroup'>
        <h3>Barcelona</h3>
        <ul class='w-full text-left'>
          <li
            class='job-offer-item w-full'
            data-contract-type='intern'
            data-job-postings-url='https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342'
          >
            <div class="text-sm sm:text-base leading-xs sm:leading-sm font-bold text-gray-500 text-left factorial__headingFontFamily">Community Manager Intern</div>
            <div class="text-sm leading-sm sm:leading-base font-normal text-gray-350 text-left">CoMa</div>
            <div class="text-sm leading-sm sm:leading-base font-normal text-gray-350 text-left">Hybrid</div>
            <a href='https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342'>Apply now</a>
          </li>
        </ul>
      </div>
      <div data-target='job-filters.officeGroup'>
        <h3>Lisbon</h3>
        <ul class='w-full text-left'>
          <li
            class='job-offer-item w-full'
            data-contract-type='indefinite'
            data-job-postings-url='https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659'
          >
            <div class="text-sm sm:text-base leading-xs sm:leading-sm font-bold text-gray-500 text-left factorial__headingFontFamily">Senior Brand Manager (Gaming)</div>
            <div class="text-sm leading-sm sm:leading-base font-normal text-gray-350 text-left"></div>
            <div class="text-sm leading-sm sm:leading-base font-normal text-gray-350 text-left">Hybrid</div>
            <a href='https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659'>Apply now</a>
          </li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const sitemapXml = `
<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9' xmlns:xhtml='http://www.w3.org/1999/xhtml'>
  <url>
    <loc>https://funplus.factorialhr.com</loc>
    <priority>0.9</priority>
    <lastmod>2026-07-13</lastmod>
    <changefreq>weekly</changefreq>
  </url>
  <url>
    <loc>https://funplus.factorialhr.com/job_posting/community-manager-intern-298342</loc>
    <priority>0.3</priority>
    <lastmod>2026-07-13</lastmod>
    <changefreq>monthly</changefreq>
  </url>
  <url>
    <loc>https://funplus.factorialhr.com/job_posting/senior-brand-manager-gaming-310659</loc>
    <priority>0.3</priority>
    <lastmod>2026-07-13</lastmod>
    <changefreq>monthly</changefreq>
  </url>
</urlset>
`

const detailHtmlByUrl = {
  'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342': `
    <!doctype html>
    <html lang='en-il'>
      <head>
        <title>Community Manager Intern</title>
      </head>
      <body>
        <main>
          <ul>
            <li><a href='/embed/jobs'>Jobs</a></li>
          </ul>
          <h1>Community Manager Intern</h1>
          <ul>
            <li>Intern</li>
            <li>Full time</li>
            <li>Hybrid (Barcelona, Spain)</li>
          </ul>
          <section>
            <h2>About the role</h2>
            <p>Help grow the FunPlus community through social content, player feedback loops, and campaign support.</p>
          </section>
          <a href='/embed/apply/community-manager-intern-298342'>Apply now</a>
        </main>
      </body>
    </html>
  `,
  'https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659': `
    <!doctype html>
    <html lang='en-il'>
      <head>
        <title>Senior Brand Manager (Gaming)</title>
      </head>
      <body>
        <main>
          <ul>
            <li><a href='/embed/jobs'>Jobs</a></li>
          </ul>
          <h1>Senior Brand Manager (Gaming)</h1>
          <ul>
            <li>Indefinite</li>
            <li>Full time</li>
            <li>Hybrid (Lisbon, Lisbon, Portugal)</li>
          </ul>
          <section>
            <h2>About the role</h2>
            <p>Lead regional brand planning and campaign execution across FunPlus gaming titles.</p>
          </section>
          <a href='/embed/apply/senior-brand-manager-gaming-310659'>Apply now</a>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/funplus/script.js')
  } catch {
    assert.fail('Expected FunPlus scraper module at ../../scraper/funplus/script.js')
  }
}

test('FunPlus constants and parsers stay pinned to the verified first-party homepage, careers iframe, Factorial board, sitemap, and detail routes', async () => {
  const funPlus = await loadModule()

  assert.equal(funPlus.SOURCE, 'funplus')
  assert.equal(funPlus.COMPANY, 'FunPlus')
  assert.equal(funPlus.OFFICIAL_BRAND_NAME, 'FunPlus')
  assert.equal(funPlus.VERIFIED_ON, '2026-07-15')
  assert.equal(funPlus.HOMEPAGE_URL, 'https://funplus.com/')
  assert.equal(funPlus.CAREERS_URL, 'https://funplus.com/careers/')
  assert.equal(funPlus.JOBS_BOARD_URL, 'https://funplus.factorialhr.com/embed/jobs')
  assert.equal(funPlus.JOBS_SITEMAP_URL, 'https://funplus.factorialhr.com/sitemap.xml')
  assert.equal(
    funPlus.SAMPLE_DETAIL_URL,
    'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
  )
  assert.equal(
    funPlus.SAMPLE_APPLY_URL,
    'https://funplus.factorialhr.com/embed/apply/community-manager-intern-298342',
  )
  assert.equal(funPlus.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(funPlus.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(funPlus.extractJobsBoardUrl(careersHtml), funPlus.JOBS_BOARD_URL)
  assert.equal(funPlus.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(funPlus.hasVerifiedJobsSitemapSignal(sitemapXml), true)
  assert.deepEqual(funPlus.extractSitemapEntries(sitemapXml), {
    'https://funplus.factorialhr.com/job_posting/community-manager-intern-298342': '2026-07-13',
    'https://funplus.factorialhr.com/job_posting/senior-brand-manager-gaming-310659': '2026-07-13',
  })
  assert.deepEqual(funPlus.extractJobCards(jobsBoardHtml), [
    {
      title: 'Community Manager Intern',
      department: 'CoMa',
      workplaceType: 'Hybrid',
      employmentType: 'Internship',
      boardLocation: 'Barcelona',
      sourceUrl: 'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
    },
    {
      title: 'Senior Brand Manager (Gaming)',
      department: null,
      workplaceType: 'Hybrid',
      employmentType: 'Full-time',
      boardLocation: 'Lisbon',
      sourceUrl: 'https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659',
    },
  ])
  assert.deepEqual(
    funPlus.extractDetailMetadata(
      detailHtmlByUrl['https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342'],
      'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
    ),
    {
      title: 'Community Manager Intern',
      location: 'Barcelona, Spain',
      city: 'Barcelona',
      country: 'Spain',
      applyUrl: 'https://funplus.factorialhr.com/embed/apply/community-manager-intern-298342',
      jobDescription:
        'About the role Help grow the FunPlus community through social content, player feedback loops, and campaign support.',
    },
  )
})

test('FunPlus run validates the first-party homepage, careers iframe handoff, public Factorial board, sitemap, and detail pages before returning jobs', async () => {
  const funPlus = await loadModule()
  const requestedUrls = []

  const jobs = await funPlus.createFunPlusScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === funPlus.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === funPlus.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === funPlus.JOBS_BOARD_URL) {
        return { status: 200, url, html: jobsBoardHtml }
      }

      if (url === funPlus.JOBS_SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (detailHtmlByUrl[url]) {
        return { status: 200, url, html: detailHtmlByUrl[url] }
      }

      throw new Error(`Unexpected FunPlus URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    funPlus.HOMEPAGE_URL,
    funPlus.CAREERS_URL,
    funPlus.JOBS_BOARD_URL,
    funPlus.JOBS_SITEMAP_URL,
    'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
    'https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659',
  ])
  assert.deepEqual(jobs, [
    {
      jobId: '298342',
      requisitionId: '298342',
      title: 'Community Manager Intern',
      company: 'FunPlus',
      department: 'CoMa',
      location: 'Barcelona, Spain',
      city: 'Barcelona',
      country: 'Spain',
      sourceUrl: 'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
      applyUrl: 'https://funplus.factorialhr.com/embed/apply/community-manager-intern-298342',
      employmentType: 'Internship',
      workplaceType: 'Hybrid',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-13',
      closingDate: null,
      jobDescription:
        'About the role Help grow the FunPlus community through social content, player feedback loops, and campaign support.',
      source: 'funplus',
      companyCareerPage: 'https://funplus.com/careers/',
      companyDomain: 'funplus.com',
      atsPlatform: 'factorialhr-embed-jobs-html',
      link: 'https://funplus.factorialhr.com/embed/apply/community-manager-intern-298342',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      jobId: '310659',
      requisitionId: '310659',
      title: 'Senior Brand Manager (Gaming)',
      company: 'FunPlus',
      department: null,
      location: 'Lisbon, Lisbon, Portugal',
      city: 'Lisbon',
      country: 'Portugal',
      sourceUrl: 'https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659',
      applyUrl: 'https://funplus.factorialhr.com/embed/apply/senior-brand-manager-gaming-310659',
      employmentType: 'Full-time',
      workplaceType: 'Hybrid',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-13',
      closingDate: null,
      jobDescription:
        'About the role Lead regional brand planning and campaign execution across FunPlus gaming titles.',
      source: 'funplus',
      companyCareerPage: 'https://funplus.com/careers/',
      companyDomain: 'funplus.com',
      atsPlatform: 'factorialhr-embed-jobs-html',
      link: 'https://funplus.factorialhr.com/embed/apply/senior-brand-manager-gaming-310659',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('FunPlus scraper fails closed when the homepage, careers iframe, board shell, sitemap, or public detail/apply routes drift', async () => {
  const funPlus = await loadModule()

  await assert.rejects(
    funPlus.createFunPlusScraper().run({
      fetchPage: async (url) => {
        if (url === funPlus.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected FunPlus URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    funPlus.createFunPlusScraper().run({
      fetchPage: async (url) => {
        if (url === funPlus.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === funPlus.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              'https://funplus.factorialhr.com/embed/jobs',
              'https://example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected FunPlus URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    funPlus.createFunPlusScraper().run({
      fetchPage: async (url) => {
        if (url === funPlus.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === funPlus.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === funPlus.JOBS_BOARD_URL) {
          return { status: 200, url, html: '<html><head><title>FunPlus</title></head><body>Login</body></html>' }
        }

        throw new Error(`Unexpected FunPlus URL: ${url}`)
      },
    }),
    /public Factorial jobs board/i,
  )

  await assert.rejects(
    funPlus.createFunPlusScraper().run({
      fetchPage: async (url) => {
        if (url === funPlus.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === funPlus.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === funPlus.JOBS_BOARD_URL) {
          return { status: 200, url, html: jobsBoardHtml }
        }

        if (url === funPlus.JOBS_SITEMAP_URL) {
          return { status: 200, url, html: '<urlset><url><loc>https://funplus.factorialhr.com</loc></url></urlset>' }
        }

        throw new Error(`Unexpected FunPlus URL: ${url}`)
      },
    }),
    /jobs sitemap/i,
  )

  await assert.rejects(
    funPlus.createFunPlusScraper().run({
      fetchPage: async (url) => {
        if (url === funPlus.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === funPlus.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === funPlus.JOBS_BOARD_URL) {
          return { status: 200, url, html: jobsBoardHtml }
        }

        if (url === funPlus.JOBS_SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === 'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342') {
          return {
            status: 200,
            url,
            html: '<html><head><title>Broken</title></head><body><main><h1>Broken</h1></main></body></html>',
          }
        }

        if (url === 'https://funplus.factorialhr.com/embed/job_posting/senior-brand-manager-gaming-310659') {
          return {
            status: 200,
            url,
            html: detailHtmlByUrl[url],
          }
        }

        throw new Error(`Unexpected FunPlus URL: ${url}`)
      },
    }),
    /public job detail page/i,
  )
})

test('FunPlus follows the official Factorial canonical host while reconciling its legacy-host sitemap dates', async () => {
  const funPlus = await loadModule()
  const current = html => html.replaceAll('funplus.factorialhr.com', 'funplus.factorial.com')
  const jobs = await funPlus.createFunPlusScraper().run({ fetchPage: async url => {
    if (url === funPlus.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
    if (url === funPlus.CAREERS_URL) return { status: 200, url, html: careersHtml }
    if (url === funPlus.JOBS_BOARD_URL) return { status: 200, url: 'https://funplus.factorial.com/embed/jobs', html: current(jobsBoardHtml) }
    if (url === funPlus.JOBS_SITEMAP_URL) return { status: 200, url: 'https://funplus.factorial.com/sitemap.xml', html: sitemapXml }
    const legacyUrl = url.replace('funplus.factorial.com', 'funplus.factorialhr.com')
    if (detailHtmlByUrl[legacyUrl]) return { status: 200, url, html: current(detailHtmlByUrl[legacyUrl]) }
    throw Error('Unexpected URL ' + url)
  } })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.applyUrl.startsWith('https://funplus.factorial.com/embed/apply/')))
  assert.ok(jobs.every(job => job.postingDate === '2026-07-13'))
  assert.equal(funPlus.hasOfficialJobsBoardSignal(current(jobsBoardHtml).replaceAll('funplus.factorial.com', 'other.factorial.com')), false)
})
