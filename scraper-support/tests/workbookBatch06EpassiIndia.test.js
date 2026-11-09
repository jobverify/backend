import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Epassi | Careers | Epassi</title>
  </head>
  <body>
    <main>
      <h2>Come grow with us.</h2>
      <p>
        If you're ready to contribute to a company where you can make a real difference in
        people's lives, explore our current openings. Your journey towards a fulfilling
        career in wellbeing starts here.
      </p>
      <a id="vacancies" data-hs-anchor="true"></a>
      <h3>Our vacancies.</h3>
      <link rel="stylesheet" href="//embed-css.jobylon.com/v1/epassi-custom.css" />
      <div id="jobylon-jobs-widget"></div>
      <script type="text/javascript">
        var jbl_company_id = 2253;
        var jbl_version = 'v1';
        var jbl_page_size = 10;
        (function() {
          var el = document.createElement('script');
          el.src = 'https://cdn.jobylon.com/embedder.js';
          document.body.appendChild(el);
        })();
      </script>
    </main>
  </body>
</html>
`

const VERIFIED_JOBYLON_EMBED_JS = `
(function(){
  var widget_selector = '#jobylon-jobs-widget';
  var html_embed = '<div class="jobylon-job-list"><div class="jobylon-job-list-page js-jobylon-page js-jobylon-page-1"><div id="jobylon-job-372856" class="jobylon-job "><div class="jobylon-job-title js-jobylon-toggle">Staff Applied AI Engineer</div><div class="jobylon-job-descr js-jobylon-togglable"><ul class="jobylon-job-details"><li class="jobylon-location"><strong>Location:</strong> Finland +7 more</li><li class="jobylon-function"><strong>Function:</strong> Engineering</li><li class="jobylon-experience"><strong>Experience:</strong> Experienced</li></ul><a class="jobylon-apply-btn" href="https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/" target="_blank" rel="noopener"><span class="jobylon-placeholder">Read more</span></a><a class="jobylon-apply-btn jobylon-actual-apply-btn" href="https://emp.jobylon.com/applications/jobs/372856/create/" target="_blank" rel="noopener"><span class="jobylon-placeholder">Apply</span></a></div></div><div id="jobylon-job-370526" class="jobylon-job "><div class="jobylon-job-title js-jobylon-toggle">B2B Marketing Manager - Sports Activation</div><div class="jobylon-job-descr js-jobylon-togglable"><ul class="jobylon-job-details"><li class="jobylon-location"><strong>Location:</strong> Omval 300, 1096 HP Amsterdam, Niederlande</li><li class="jobylon-function"><strong>Function:</strong> Marketing</li><li class="jobylon-experience"><strong>Experience:</strong> Not Applicable</li></ul><a class="jobylon-apply-btn" href="https://emp.jobylon.com/jobs/370526-epassi-b2b-marketing-manager-sports-activation/" target="_blank" rel="noopener"><span class="jobylon-placeholder">Read more</span></a><a class="jobylon-apply-btn jobylon-actual-apply-btn" href="https://emp.jobylon.com/applications/jobs/370526/create/" target="_blank" rel="noopener"><span class="jobylon-placeholder">Apply</span></a></div></div></div><ul class="jobylon-pagination"><li class="js-jobylon-page-link js-jobylon-page-link-1 active"><a href="#" class="js-jobylon-show-page" data-page="1">1</a></li></ul><small class="jobylon-powered-by">Powered by <a href="//www.jobylon.com" target="_blank" rel="noopener">Jobylon</a></small></div>';
})();
`

const VERIFIED_NON_INDIA_DETAIL_HTML = `
<html>
  <head>
    <title>Staff Applied AI Engineer - Epassi | Jobylon</title>
    <meta property="og:url" content="https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/">
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Staff Applied AI Engineer",
        "datePosted": "2026-07-24T08:45:55+00:00",
        "description": "<p>Drive platform engineering across Europe.</p>",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Epassi"
        },
        "jobLocation": [
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Finland",
              "addressLocality": "Helsinki",
              "addressRegion": "Uusimaa",
              "addressCountry": "FI"
            }
          },
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Germany",
              "addressLocality": "Hamburg",
              "addressRegion": "Hamburg",
              "addressCountry": "DE"
            }
          }
        ]
      }
    </script>
  </body>
</html>
`

const VERIFIED_NON_INDIA_DETAIL_HTML_TWO = `
<html>
  <head>
    <title>B2B Marketing Manager - Sports Activation - Epassi | Jobylon</title>
    <meta property="og:url" content="https://emp.jobylon.com/jobs/370526-epassi-b2b-marketing-manager-sports-activation/">
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "B2B Marketing Manager - Sports Activation",
        "datePosted": "2026-07-21",
        "description": "<p>Lead sports activation campaigns in the Netherlands.</p>",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Epassi"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Omval 300, 1096 HP Amsterdam, Niederlande",
            "addressLocality": "Amsterdam",
            "addressRegion": "Noord-Holland",
            "addressCountry": "NL"
          }
        }
      }
    </script>
  </body>
</html>
`

const VERIFIED_INDIA_DETAIL_HTML = `
<html>
  <head>
    <title>Staff Applied AI Engineer - Epassi | Jobylon</title>
    <meta property="og:url" content="https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/">
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Staff Applied AI Engineer",
        "datePosted": "2026-07-24T08:45:55+00:00",
        "description": "<p>Build platform capabilities for India and Europe.</p>",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Epassi"
        },
        "jobLocation": [
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "India",
              "addressLocality": "Bengaluru",
              "addressRegion": "Karnataka",
              "addressCountry": "IN"
            }
          }
        ]
      }
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/epassiindia/script.js')
  } catch {
    assert.fail('Expected Epassi India scraper module at ../../scraper/epassiindia/script.js')
  }
}

test('Epassi India validates the verified first-party careers shell and public Jobylon listing contract', async () => {
  const epassiindia = await loadModule()
  const listings = epassiindia.extractJobylonListings(VERIFIED_JOBYLON_EMBED_JS)
  const indiaJob = epassiindia.extractIndiaJobFromDetail(listings[0], VERIFIED_INDIA_DETAIL_HTML)

  assert.equal(epassiindia.SOURCE, 'epassiindia')
  assert.equal(epassiindia.COMPANY, 'Epassi India')
  assert.equal(epassiindia.OFFICIAL_BRAND, 'Epassi')
  assert.equal(epassiindia.VERIFIED_ON, '2026-10-09')
  assert.equal(epassiindia.CAREERS_URL, 'https://www.epassi.com/careers')
  assert.equal(epassiindia.JOBYLON_COMPANY_ID, 2253)
  assert.equal(epassiindia.JOBYLON_EMBED_URL, 'https://cdn.jobylon.com/jobs/companies/2253/embed/v1/?target=jobylon-jobs-widget&page_size=10')
  assert.equal(
    epassiindia.DISPOSITION,
    'verified-first-party-careers-page-plus-public-jobylon-embed-and-detail-pages',
  )
  assert.match(epassiindia.VERIFIED_SURFACE_SUMMARY, /2026-10-09/)
  assert.match(epassiindia.VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.epassi\.com\/careers/i)
  assert.match(epassiindia.VERIFIED_SURFACE_SUMMARY, /company id 2253/i)
  assert.match(epassiindia.VERIFIED_SURFACE_SUMMARY, /no public roles exposed India as a location/i)
  assert.equal(epassiindia.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.deepEqual(epassiindia.extractJobylonConfig(VERIFIED_CAREERS_HTML), {
    companyId: 2253,
    version: 'v1',
    pageSize: 10,
  })
  assert.equal(epassiindia.hasVerifiedJobylonEmbedSignal(VERIFIED_JOBYLON_EMBED_JS), true)
  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    jobId: '372856',
    requisitionId: '372856',
    title: 'Staff Applied AI Engineer',
    location: 'Finland +7 more',
    department: 'Engineering',
    experience: 'Experienced',
    sourceUrl: 'https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/',
    applyUrl: 'https://emp.jobylon.com/applications/jobs/372856/create/',
  })
  assert.deepEqual(indiaJob, {
    title: 'Staff Applied AI Engineer',
    company: 'Epassi India',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '372856',
    requisitionId: '372856',
    sourceUrl: 'https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer',
    applyUrl: 'https://emp.jobylon.com/applications/jobs/372856/create',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-24T08:45:55.000Z',
    closingDate: null,
    jobDescription: 'Build platform capabilities for India and Europe.',
    remoteStatus: null,
  })
})

test('Epassi India run validates the official page and returns [] when the verified public Jobylon details expose no India roles', async () => {
  const epassiindia = await loadModule()
  const requestedUrls = []

  const jobs = await epassiindia.createEpassiIndiaScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === epassiindia.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === epassiindia.JOBYLON_EMBED_URL) return VERIFIED_JOBYLON_EMBED_JS
      if (url === 'https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/') {
        return VERIFIED_NON_INDIA_DETAIL_HTML
      }
      if (url === 'https://emp.jobylon.com/jobs/370526-epassi-b2b-marketing-manager-sports-activation/') {
        return VERIFIED_NON_INDIA_DETAIL_HTML_TWO
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    epassiindia.CAREERS_URL,
    epassiindia.JOBYLON_EMBED_URL,
    'https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/',
    'https://emp.jobylon.com/jobs/370526-epassi-b2b-marketing-manager-sports-activation/',
  ])
  assert.deepEqual(jobs, [])
})

test('Epassi India fails closed when the verified first-party careers page drifts', async () => {
  const epassiindia = await loadModule()

  await assert.rejects(
    epassiindia.createEpassiIndiaScraper().run({
      fetchText: async (url) => {
        if (url === epassiindia.CAREERS_URL) {
          return VERIFIED_CAREERS_HTML.replace('var jbl_company_id = 2253;', 'var jbl_company_id = 9999;')
        }
        return VERIFIED_JOBYLON_EMBED_JS
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    epassiindia.createEpassiIndiaScraper().run({
      fetchText: async (url) => {
        if (url === epassiindia.CAREERS_URL) {
          return `
            ${VERIFIED_CAREERS_HTML}
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"JobPosting","title":"India Engineer"}
            </script>
          `
        }
        return VERIFIED_JOBYLON_EMBED_JS
      },
    }),
    /JobPosting markup/i,
  )
})

test('Epassi India fails closed when the public Jobylon embed or detail contract drifts', async () => {
  const epassiindia = await loadModule()

  await assert.rejects(
    epassiindia.createEpassiIndiaScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === epassiindia.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === epassiindia.JOBYLON_EMBED_URL) {
          return VERIFIED_JOBYLON_EMBED_JS.replace(
            'https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/',
            'https://example.com/jobs/372856-epassi-staff-applied-ai-engineer/',
          )
        }
        return VERIFIED_NON_INDIA_DETAIL_HTML
      },
    }),
    /public Jobylon embed/i,
  )

  await assert.rejects(
    epassiindia.createEpassiIndiaScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === epassiindia.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === epassiindia.JOBYLON_EMBED_URL) return VERIFIED_JOBYLON_EMBED_JS
        if (url === 'https://emp.jobylon.com/jobs/372856-epassi-staff-applied-ai-engineer/') {
          return VERIFIED_NON_INDIA_DETAIL_HTML.replace(
            '"title": "Staff Applied AI Engineer"',
            '"title": "Other Role"',
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /expected title/i,
  )
})

test('Epassi India parses every current embedded page when a summary location is unpublished', async () => {
  const epassiindia = await loadModule()
  const embed = await fs.readFile(new URL('../../scraper/epassiindia/fixtures/jobylon-current-embed.js', import.meta.url), 'utf8')
  const listings = epassiindia.extractJobylonListings(embed)
  assert.equal(listings.length, 17)
  assert.equal(new Set(listings.map(job => job.jobId)).size, 17)
  assert.equal(listings[0].jobId, '389049')
  assert.equal(listings[0].location, null)
  assert.equal(listings.at(-1).jobId, '343629')
})

test('Epassi India requires public detail country coverage for an unpublished listing location', async () => {
  const epassiindia = await loadModule()
  const embed = VERIFIED_JOBYLON_EMBED_JS.replace('Finland +7 more', '')
  const jobs = await epassiindia.run({
    fetchText: async url => url === epassiindia.CAREERS_URL ? VERIFIED_CAREERS_HTML
      : url === epassiindia.JOBYLON_EMBED_URL ? embed
        : url.includes('372856') ? VERIFIED_INDIA_DETAIL_HTML : VERIFIED_NON_INDIA_DETAIL_HTML_TWO,
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].jobDescription, 'Build platform capabilities for India and Europe.')
})

test('Epassi India accepts the actual explicit Europe-based role and rejects unclassified remote vacancies', async () => {
  const epassiindia = await loadModule()
  const detail = await fs.readFile(new URL('../../scraper/epassiindia/fixtures/detail-389049.html', import.meta.url), 'utf8')
  const listing = { jobId: '389049', title: 'Enterprise Systems Specialist', sourceUrl: 'https://emp.jobylon.com/jobs/389049-epassi-enterprise-systems-specialist/' }
  assert.equal(epassiindia.extractIndiaJobFromDetail(listing, detail), null)
  assert.throws(() => epassiindia.extractIndiaJobFromDetail(listing, detail.replace('Europe-based role', 'global role')), /country.*coverage|location.*coverage/i)
})

test('Epassi India rejects a detail identity mismatch even when its title matches', async () => {
  const epassiindia = await loadModule()
  const listing = epassiindia.extractJobylonListings(VERIFIED_JOBYLON_EMBED_JS)[0]
  assert.throws(() => epassiindia.extractIndiaJobFromDetail(listing, VERIFIED_INDIA_DETAIL_HTML.replace('/jobs/372856-', '/jobs/999999-')), /detail.*identity/i)
})

test('Epassi India rejects an advertised client page omitted from the embed', async () => {
  const epassiindia = await loadModule()
  const missingPage = VERIFIED_JOBYLON_EMBED_JS.replace('</ul><small class="jobylon-powered-by">', '<li><a class="js-jobylon-show-page" data-page="2">2</a></li></ul><small class="jobylon-powered-by">')
  assert.throws(() => epassiindia.extractJobylonListings(missingPage), /pagination|embedded.*page/i)
})

test('Epassi India refuses missing employer and country metadata rather than claiming a complete empty inventory', async () => {
  const epassiindia = await loadModule()
  const listing = epassiindia.extractJobylonListings(VERIFIED_JOBYLON_EMBED_JS)[0]
  assert.throws(() => epassiindia.extractIndiaJobFromDetail(listing, VERIFIED_NON_INDIA_DETAIL_HTML.replace('"name": "Epassi"', '"name": "Unknown"')), /company identity/i)
  const ambiguous = VERIFIED_NON_INDIA_DETAIL_HTML.replaceAll('"FI"', '""').replaceAll('"DE"', '""').replace('"streetAddress": "Finland"', '"streetAddress": ""').replace('"streetAddress": "Germany"', '"streetAddress": ""')
  assert.throws(() => epassiindia.extractIndiaJobFromDetail(listing, ambiguous), /country.*coverage|location.*coverage/i)
})

test('Epassi India requires every public detail fetch and marks a listing limit incomplete', async () => {
  const epassiindia = await loadModule()
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const fetchText = async url => url === epassiindia.CAREERS_URL ? VERIFIED_CAREERS_HTML
    : url === epassiindia.JOBYLON_EMBED_URL ? VERIFIED_JOBYLON_EMBED_JS
      : url.includes('372856') ? VERIFIED_INDIA_DETAIL_HTML : VERIFIED_NON_INDIA_DETAIL_HTML_TWO
  const complete = await epassiindia.run({ fetchText })
  assert.equal(readInventoryEvidence(complete).listingComplete, true)
  assert.equal(readInventoryEvidence(complete).reportedTotal, 2)
  const limited = await epassiindia.run({ maxJobs: 1, fetchText })
  assert.equal(limited[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(limited).listingComplete, false)
  await assert.rejects(epassiindia.run({ fetchText: async url => url.includes('/jobs/372856-') ? Promise.reject(Error('HTTP 403 for public detail')) : fetchText(url) }), /HTTP 403/i)
})

test('Epassi India catalog records the complete verified current global inventory and India subset', async () => {
  const local = (await import('../../scraper/epassiindia/catalog.js')).default
  const { getScraperCatalog } = await import('../providers/index.js')
  const provider = getScraperCatalog().find(item => item.source === 'epassiindia')
  for (const entry of [local, provider]) {
    assert.equal(entry.verifiedOn, '2026-10-09')
    assert.equal(entry.verifiedPublicJobCount, 17)
    assert.equal(entry.verifiedIndiaJobCount, 0)
    assert.match(entry.verifiedSurfaceSummary, /17 distinct Epassi vacancies across two complete embedded pages/i)
    assert.match(entry.verifiedSurfaceSummary, /Europe-based role/i)
  }
})

test('Epassi India rejects unrecognized declared countries instead of classifying Remote or ZZ as foreign', async () => {
  const epassiindia = await loadModule()
  const detail = await fs.readFile(new URL('../../scraper/epassiindia/fixtures/detail-389049.html', import.meta.url), 'utf8')
  const listing = { jobId: '389049', title: 'Enterprise Systems Specialist', sourceUrl: 'https://emp.jobylon.com/jobs/389049-epassi-enterprise-systems-specialist/' }
  for (const country of ['Remote', 'ZZ', 'Atlantis']) {
    const modified = detail.replace('"streetAddress": ""', '"addressCountry": "' + country + '", "streetAddress": ""')
    assert.throws(() => epassiindia.extractIndiaJobFromDetail(listing, modified), /unknown|unrecognized.*country|country.*coverage/i)
  }
})

test('Epassi India rejects a foreign country declaration that contradicts an explicit India address', async () => {
  const epassiindia = await loadModule()
  const listing = epassiindia.extractJobylonListings(VERIFIED_JOBYLON_EMBED_JS)[0]
  assert.throws(() => epassiindia.extractIndiaJobFromDetail(listing, VERIFIED_INDIA_DETAIL_HTML.replace('"addressCountry": "IN"', '"addressCountry": "DE"')), /country.*conflict|country.*contradict/i)
})
