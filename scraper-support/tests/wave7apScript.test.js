import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const dikshaPageOneHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Search jobs</h1>
    <a href="/join-diksha-now/">All Jobs</a>
    <div class="col-lg-12 mb-4 mb-lg-0">
      <article class="post mb-3">
        <div class="card-body bg-light p-4">
          <a href="/job/7442c255-8a39-4ccf-bf84-f9ada0138a3b/"><span>Save</span></a>
          <h4 class="my-2">
            <a href="/job/7442c255-8a39-4ccf-bf84-f9ada0138a3b/" class="text-decoration-none text-dark text-color-hover-primary">
              Tech Support
            </a>
          </h4>
          <p class="card-text text-3-5 mb-1">2026-07-16 | Bangalore | WFO | Junior</p>
          <a href="/job/7442c255-8a39-4ccf-bf84-f9ada0138a3b/" class="read-more text-color-secondary font-weight-semibold text-2">
            Read More
          </a>
        </div>
      </article>
    </div>
    <div class="col-lg-12 mb-4 mb-lg-0">
      <article class="post mb-3">
        <div class="card-body bg-light p-4">
          <a href="/job/2425300a-3dab-4725-a406-6fdef5ac3539/"><span>Save</span></a>
          <h4 class="my-2">
            <a href="/job/2425300a-3dab-4725-a406-6fdef5ac3539/" class="text-decoration-none text-dark text-color-hover-primary">
              Business Development Executive
            </a>
          </h4>
          <p class="card-text text-3-5 mb-1">2026-07-09 | Bangalore | WFO | Junior</p>
          <a href="/job/2425300a-3dab-4725-a406-6fdef5ac3539/" class="read-more text-color-secondary font-weight-semibold text-2">
            Read More
          </a>
        </div>
      </article>
    </div>
    <ul class="pagination pagination-rounded pagination-md justify-content-center">
      <li class="page-item active"><a class="page-link bg-secondary text-light border-color-secondary" href="#">1</a></li>
      <li class="page-item"><a class="page-link bg-transparent text-dark" href="?page=2">2</a></li>
      <li class="page-item"><a class="page-link bg-transparent text-dark" href="?page=3">3</a></li>
    </ul>
  </body>
</html>
`

const dikshaPageTwoHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Search jobs</h1>
    <div class="col-lg-12 mb-4 mb-lg-0">
      <article class="post mb-3">
        <div class="card-body bg-light p-4">
          <a href="/job/f1b31210-9cc7-4f91-a48a-03d834114c1b/"><span>Save</span></a>
          <h4 class="my-2">
            <a href="/job/f1b31210-9cc7-4f91-a48a-03d834114c1b/" class="text-decoration-none text-dark text-color-hover-primary">
              Senior Platform Engineer
            </a>
          </h4>
          <p class="card-text text-3-5 mb-1">2026-06-23 | Gurgaon | WFO | Senior</p>
          <a href="/job/f1b31210-9cc7-4f91-a48a-03d834114c1b/" class="read-more text-color-secondary font-weight-semibold text-2">
            Read More
          </a>
        </div>
      </article>
    </div>
  </body>
</html>
`

const dikshaPageThreeHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Search jobs</h1>
    <div class="col-lg-12 mb-4 mb-lg-0">
      <article class="post mb-3">
        <div class="card-body bg-light p-4">
          <a href="/job/3a8337fa-6cb9-4760-893b-e24ffaecb757/"><span>Save</span></a>
          <h4 class="my-2">
            <a href="/job/3a8337fa-6cb9-4760-893b-e24ffaecb757/" class="text-decoration-none text-dark text-color-hover-primary">
              Delivery Manager
            </a>
          </h4>
          <p class="card-text text-3-5 mb-1">2026-05-05 | Hyderabad | WFH | Middle-Senior</p>
          <a href="/job/3a8337fa-6cb9-4760-893b-e24ffaecb757/" class="read-more text-color-secondary font-weight-semibold text-2">
            Read More
          </a>
        </div>
      </article>
    </div>
  </body>
</html>
`

const sedinCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Opportunities</h1>
    <div class="swiper-slide h-auto">
      <div class="flex flex-col bg-dark2 bg-career-card-gradient border border-white/10 rounded-2xl p-6 shadow-career-card hover:border-primary/30 transition-all duration-200 h-full">
        <div class="flex flex-wrap gap-2 mb-4">
          <span class="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide bg-primary/10 text-primary">On-site</span>
          <span class="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 text-dark3 uppercase tracking-wide">Full time</span>
        </div>
        <h3 class="text-white text-xl font-bold leading-snug mb-1">Odoo Pre Sales</h3>
        <p class="text-blueCustom text-sm font-medium mb-4">Salesforce</p>
        <div class="flex items-center gap-2 text-dark3 text-sm mb-5"><span>Chennai / Bengaluru, India</span></div>
        <div class="mb-5"><p class="text-dark3 text-sm leading-relaxed line-clamp-3">Key Responsibilities Sales &amp; Business Development ...</p></div>
        <div class="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
          <span class="text-dark3 text-xs">Posted 21 May 2026</span>
          <a href="https://sedintechnologies.zohorecruit.in/jobs/Careers/202020000000828005/Odoo-Pre-Sales?source=CareerSite" target="_blank" rel="noopener noreferrer">Apply Now</a>
        </div>
      </div>
    </div>
    <div class="swiper-slide h-auto">
      <div class="flex flex-col bg-dark2 bg-career-card-gradient border border-white/10 rounded-2xl p-6 shadow-career-card hover:border-primary/30 transition-all duration-200 h-full">
        <div class="flex flex-wrap gap-2 mb-4">
          <span class="text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide bg-blueCustom/15 text-blueCustom">Remote</span>
          <span class="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 text-dark3 uppercase tracking-wide">Full time</span>
        </div>
        <h3 class="text-white text-xl font-bold leading-snug mb-1">Lead Polyglot Developer</h3>
        <p class="text-blueCustom text-sm font-medium mb-4">Tarka Labs</p>
        <div class="flex items-center gap-2 text-dark3 text-sm mb-5"><span>Remote</span></div>
        <div class="mb-5"><p class="text-dark3 text-sm leading-relaxed line-clamp-3">What you'll do?? Work on technically challenging problems...</p></div>
        <div class="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
          <span class="text-dark3 text-xs">Posted 8 Jul 2026</span>
          <a href="https://sedintechnologies.zohorecruit.in/jobs/Careers/202020000000735013/Lead-Polyglot-Developer?source=CareerSite" target="_blank" rel="noopener noreferrer">Apply Now</a>
        </div>
      </div>
    </div>
  </body>
</html>
`

const amnetLifeAtAmnetHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Life at Amnet</h1>
    <h2>Scale New Career Heights with Us</h2>
    <h2>Current Openings</h2>
    <p>Email your resume to <a href="mailto:careers@amnet.com">careers@amnet.com</a></p>
    <p>Amnet is Great Place to Work - Certified.</p>
  </body>
</html>
`

const amnetLegacyCurrentOpenings404Html = `
<!doctype html>
<html lang="en">
  <head><title>Page not found - Amnet</title></head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const dltRebrandHtml = `
<!doctype html>
<html lang="en">
  <body>
    <p>DLT Labs, the world’s foremost freight and logistics software innovator, is now KNNX Corp. (pronounced “Connects”), effective October 4, 2023.</p>
    <p>Visit knnx.com for more information.</p>
  </body>
</html>
`

const wyzmindzHomepageHtml = `
<!doctype html>
<html lang="en">
  <head><title>WyzMindz – SaaS CRM for Customer Service</title></head>
  <body>
    <h1>AI Powered Workflow Automation</h1>
    <p>SaaS CRM for Customer Service, Quality Audits, Automotive Dealers & BFSI Industry.</p>
    <h2>Get in touch</h2>
    <p>3rd Floor, Survey # 19/3, Srinivasa Industrial Estate</p>
    <p>Thank you for your response. ✨</p>
  </body>
</html>
`

const wyzmindzContactHtml = `
<!doctype html>
<html lang="en">
  <head><title>Contact – WyzMindz</title></head>
  <body>
    <h2>Get in touch</h2>
    <p>3rd Floor, Survey # 19/3, Srinivasa Industrial Estate</p>
    <h4>Thank you for your response. ✨</h4>
  </body>
</html>
`

const wyzmindzMissingCareerRouteHtml = `
<!doctype html>
<html lang="en">
  <head><title>Page not found - WyzMindz</title></head>
  <body class="error404">
    <h1>Page not found</h1>
  </body>
</html>
`

test('Diksha Technologies run enumerates first-party paginated job cards', async () => {
  const diksha = await loadModule('../../scraper/dikshatechnologies/script.js')

  assert.equal(diksha.hasOfficialCareersSignal(dikshaPageOneHtml), true)
  assert.deepEqual(diksha.extractPaginationPages(dikshaPageOneHtml), [1, 2, 3])
  assert.equal(diksha.extractJobCards(dikshaPageOneHtml).length, 2)
  assert.equal(diksha.extractJobCards(dikshaPageTwoHtml).length, 1)

  const jobs = await diksha.createDikshaTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === diksha.CAREERS_URL) return dikshaPageOneHtml
      if (url === `${diksha.CAREERS_URL}?page=2`) return dikshaPageTwoHtml
      if (url === `${diksha.CAREERS_URL}?page=3`) return dikshaPageThreeHtml
      throw new Error(`Unexpected Diksha URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Business Development Executive',
    'Delivery Manager',
    'Senior Platform Engineer',
    'Tech Support',
  ])
  assert.equal(jobs[0].company, 'Diksha Technologies')
  assert.equal(jobs[0].source, 'dikshatechnologies')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].location, 'Bangalore')
  assert.equal(jobs[0].workplaceType, 'WFO')
  assert.equal(jobs[0].experienceRequired, 'Junior')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.match(jobs[0].applyUrl, /\/job\//i)
})

test('Sedin Technologies run returns inline current opportunities from the verified first-party careers page', async () => {
  const sedin = await loadModule('../../scraper/sedintechnologies/script.js')

  assert.equal(sedin.hasOfficialCareersSignal(sedinCareersHtml), true)
  assert.equal(sedin.extractJobCards(sedinCareersHtml).length, 2)

  const jobs = await sedin.createSedinTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, sedin.CAREERS_URL)
      return sedinCareersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Lead Polyglot Developer')
  assert.equal(jobs[0].workplaceType, 'Remote')
  assert.equal(jobs[0].employmentType, 'Full time')
  assert.match(jobs[0].applyUrl, /zohorecruit\.in/i)
  assert.equal(jobs[1].title, 'Odoo Pre Sales')
  assert.equal(jobs[1].department, 'Salesforce')
})

test('Amnet Systems sentinel stays pinned to the email-only first-party careers surface', async () => {
  const amnet = await loadModule('../../scraper/amnetsystems/script.js')

  assert.equal(amnet.hasOfficialCareersSignal(amnetLifeAtAmnetHtml), true)
  assert.equal(amnet.hasEmailOnlyCurrentOpenings(amnetLifeAtAmnetHtml), true)
  assert.equal(amnet.isVerifiedMissingLegacyOpeningsRoute({
    status: 404,
    url: amnet.LEGACY_CURRENT_OPENINGS_URL,
    html: amnetLegacyCurrentOpenings404Html,
  }), true)

  const jobs = await amnet.run({
    fetchPage: async (url) => {
      if (url === amnet.CAREERS_URL) {
        return { status: 200, url, html: amnetLifeAtAmnetHtml }
      }

      if (url === amnet.LEGACY_CURRENT_OPENINGS_URL) {
        return { status: 404, url, html: amnetLegacyCurrentOpenings404Html }
      }

      throw new Error(`Unexpected Amnet URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    amnet.run({
      fetchPage: async (url) => {
        if (url === amnet.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h2>Current Openings</h2><a href="/jobs/technical-architect">Technical Architect</a></body></html>',
          }
        }

        return { status: 404, url, html: amnetLegacyCurrentOpenings404Html }
      },
    }),
    /email-only/i,
  )
})

test('DLT Lab Technologies sentinel stays pinned to the DLT Labs rebrand and blocked generic KNNX careers surface', async () => {
  const dlt = await loadModule('../../scraper/dltlabtechnologies/script.js')

  assert.equal(dlt.hasRebrandSignal(dltRebrandHtml), true)
  assert.equal(dlt.isVerifiedRedirectSurface({
    url: dlt.HOMEPAGE_URL,
    finalUrl: dlt.REDIRECT_TARGET_URL,
    status: 200,
    html: '<html><head><title>KNNX</title></head><body>KNNX Home</body></html>',
    errorKind: null,
  }), true)
  assert.equal(dlt.isBlockedCareersSurface({
    url: dlt.CAREERS_URL,
    finalUrl: dlt.CAREERS_URL,
    status: null,
    html: null,
    errorKind: 'network',
  }), true)

  const jobs = await dlt.run({
    probeUrl: async (url) => {
      if (url === dlt.HOMEPAGE_URL) {
        return {
          url,
          finalUrl: dlt.REDIRECT_TARGET_URL,
          status: 200,
          html: '<html><head><title>KNNX</title></head><body>KNNX Home</body></html>',
          errorKind: null,
        }
      }

      if (url === dlt.REBRAND_ARTICLE_URL) {
        return {
          url,
          finalUrl: url,
          status: 200,
          html: dltRebrandHtml,
          errorKind: null,
        }
      }

      if (url === dlt.CAREERS_URL) {
        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'network',
        }
      }

      throw new Error(`Unexpected DLT URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    dlt.run({
      probeUrl: async (url) => {
        if (url === dlt.HOMEPAGE_URL) {
          return {
            url,
            finalUrl: dlt.REDIRECT_TARGET_URL,
            status: 200,
            html: '<html><head><title>KNNX</title></head><body>KNNX Home</body></html>',
            errorKind: null,
          }
        }

        if (url === dlt.REBRAND_ARTICLE_URL) {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: dltRebrandHtml,
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: 200,
          html: '<html><body><h1>Current Openings</h1><p>Public KNNX board</p></body></html>',
          errorKind: null,
        }
      },
    }),
    /generic KNNX careers surface/i,
  )
})

test('Wyzmindz Solutions sentinel stays pinned to the WordPress marketing site and missing career routes', async () => {
  const wyzmindz = await loadModule('../../scraper/wyzmindzsolutions/script.js')

  assert.equal(wyzmindz.hasOfficialHomepageSignal(wyzmindzHomepageHtml), true)
  assert.equal(wyzmindz.hasVerifiedContactSignal(wyzmindzContactHtml), true)
  assert.equal(wyzmindz.hasPublicJobBoardSignal(wyzmindzHomepageHtml), false)
  assert.equal(wyzmindz.isVerifiedMissingCareerRoute({
    status: 404,
    url: wyzmindz.NO_PUBLIC_CAREER_ROUTE_URLS[0],
    html: wyzmindzMissingCareerRouteHtml,
  }), true)

  const jobs = await wyzmindz.run({
    fetchPage: async (url) => {
      if (url === wyzmindz.HOMEPAGE_URL) {
        return { status: 200, url, html: wyzmindzHomepageHtml }
      }

      if (url === wyzmindz.CONTACT_URL) {
        return { status: 200, url, html: wyzmindzContactHtml }
      }

      if (wyzmindz.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: wyzmindzMissingCareerRouteHtml }
      }

      throw new Error(`Unexpected WyzMindz URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    wyzmindz.run({
      fetchPage: async (url) => {
        if (url === wyzmindz.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>AI Powered Workflow Automation</h1><h2>Current Openings</h2><a href="/careers/open-role">Open Role</a></body></html>',
          }
        }

        if (url === wyzmindz.CONTACT_URL) {
          return { status: 200, url, html: wyzmindzContactHtml }
        }

        return { status: 404, url, html: wyzmindzMissingCareerRouteHtml }
      },
    }),
    /public jobs surface/i,
  )
})
