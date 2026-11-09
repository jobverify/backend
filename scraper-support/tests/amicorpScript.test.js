import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - Amicorp</title>
    <link rel="canonical" href="https://amicorp.com/ami-news/careers/" />
    <meta property="og:site_name" content="Amicorp" />
    <meta property="og:url" content="https://amicorp.com/ami-news/careers/" />
  </head>
  <body>
    <main>
      <a href="https://amicorp.com/ami-news/careers/" aria-current="page">Careers</a>

      <div class="gem-infotext alignment-left">
        <a
          href="https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/"
          class="gem-infotext-wrap position--right vertical--center"
          title="Senior Group Legal JD1440"
        >
          <div class="gem-infotext">
            <div class="gem-infotext__title">
              <div class="title-customize title-h4">Senior Group Legal</div>
            </div>
            <div class="gem-infotext__subtitle">
              <div class="subtitle-customize title-h6 light">JD1440 - Bangalore (India) - 13 Apr 2026</div>
            </div>
          </div>
        </a>
      </div>

      <div class="gem-infotext alignment-left">
        <a
          href="https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/"
          class="gem-infotext-wrap position--right vertical--center"
          title="Central Fund Accountant - BL, CT, MU, CL - JD1527"
        >
          <div class="gem-infotext">
            <div class="gem-infotext__title">
              <div class="title-customize title-h4">Central Fund Accountant - BL, CT, MU, CL</div>
            </div>
            <div class="gem-infotext__subtitle">
              <div class="subtitle-customize title-h6 light">JD1527 - Bangalore (India) - 09 Jul 2026</div>
            </div>
          </div>
        </a>
      </div>

      <div class="gem-infotext alignment-left">
        <a
          href="https://amicorp.com/ami-news/careers/fund-relationship-management-amif-dubai-jd1479/"
          class="gem-infotext-wrap position--right vertical--center"
          title="Fund Relationship Management AMIF - Dubai JD1479"
        >
          <div class="gem-infotext">
            <div class="gem-infotext__title">
              <div class="title-customize title-h4">Fund Relationship Management AMIF</div>
            </div>
            <div class="gem-infotext__subtitle">
              <div class="subtitle-customize title-h6 light">JD1479 - Dubai (United Arab Emirates) - 28 Apr 2026</div>
            </div>
          </div>
        </a>
      </div>
    </main>
  </body>
</html>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://amicorp.com/ami-news/careers/</loc>
  </url>
  <url>
    <loc>https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/</loc>
  </url>
  <url>
    <loc>https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/</loc>
  </url>
  <url>
    <loc>https://amicorp.com/ami-news/careers/fund-relationship-management-amif-dubai-jd1479/</loc>
  </url>
</urlset>
`

const seniorGroupLegalDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Group Legal JD1440 - Amicorp</title>
    <meta name="description" content="The role holder is primarily accountable for ensuring compliance with statutory requirements for all internal entities, protect the interests of the Group and" />
    <link rel="canonical" href="https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/" />
    <meta property="og:site_name" content="Amicorp" />
    <meta property="article:published_time" content="2026-04-15T11:34:56+00:00" />
  </head>
  <body>
    <div id="thegem-heading-6a56909cda3f9" class="thegem-heading">
      <span class="colored" style="color: #F24A49;">Bangalore (India)</span>
      <span class="colored" style="color: #6F82C1;">(13 04 2026)</span>
      <span>JD1440</span>
    </div>
    <a class="gem-button" href="#form" target="_self">Apply now</a>
    <p>
      The role holder is primarily accountable for ensuring compliance with statutory requirements
      for all internal entities, protect the interests of the Group and minimizing legal risk.
    </p>
    <iframe
      aria-label="Career Page Form"
      src="https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/formperma/eclRamd2dWW4rbcIcyYbA0ooIb_3CA2MBYGp_56EYyY"
    ></iframe>
  </body>
</html>
`

const centralFundAccountantDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Central Fund Accountant - BL, CT, MU, CL - JD1527 - Amicorp</title>
    <meta name="description" content="The Fund Accountant position is responsible for the preparation and production of Net Asset Values (NAVs), fund accounting records, and investor capital" />
    <link rel="canonical" href="https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/" />
    <meta property="og:site_name" content="Amicorp" />
    <meta property="article:published_time" content="2026-04-15T15:29:02+00:00" />
  </head>
  <body>
    <div id="thegem-heading-6a56909e48ab1" class="thegem-heading">
      <span class="colored" style="color: #F24A49;">Bangalore (India)</span>
      <span class="colored" style="color: #6F82C1;">(09 07 2026)</span>
      <span>JD1527</span>
    </div>
    <a class="gem-button" href="#form" target="_self">Apply now</a>
    <p>
      The Fund Accountant position is responsible for the preparation and production of Net Asset
      Values (NAVs), fund accounting records, and investor capital activity reports.
    </p>
    <iframe
      aria-label="Career Page Form"
      src="https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/formperma/eclRamd2dWW4rbcIcyYbA0ooIb_3CA2MBYGp_56EYyY"
    ></iframe>
  </body>
</html>
`

const loadAmicorpModule = async () => {
  try {
    return await import('../../scraper/amicorp/script.js')
  } catch {
    assert.fail('Expected Amicorp scraper module at ../../scraper/amicorp/script.js')
  }
}

test('Amicorp scraper constants stay pinned to the verified first-party careers hub and detail-page apply surface from September 3, 2026', async () => {
  const amicorp = await loadAmicorpModule()

  assert.equal(amicorp.SOURCE, 'amicorp')
  assert.equal(amicorp.COMPANY, 'Amicorp')
  assert.equal(amicorp.OFFICIAL_BRAND_NAME, 'Amicorp')
  assert.equal(amicorp.VERIFIED_ON, '2026-09-03')
  assert.equal(amicorp.HOMEPAGE_URL, 'https://amicorp.com/')
  assert.equal(amicorp.CAREERS_URL, 'https://amicorp.com/ami-news/careers/')
  assert.equal(amicorp.PAGE_SITEMAP_URL, 'https://amicorp.com/?sitemap=page&sitemap_n=1')
  assert.equal(
    amicorp.TRUSTED_APPLY_FORM_URL,
    'https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/formperma/eclRamd2dWW4rbcIcyYbA0ooIb_3CA2MBYGp_56EYyY',
  )
  assert.match(amicorp.VERIFIED_SURFACE_SUMMARY, /Careers - Amicorp/i)
  assert.match(amicorp.VERIFIED_SURFACE_SUMMARY, /page-sitemap1\.xml/i)
  assert.equal(amicorp.hasOfficialCareersSurface(careersHtml), true)
  assert.equal(amicorp.hasOfficialPageSitemapSurface(pageSitemapXml), true)
})

test('extractCareerListings and extractIndiaListings keep only verified India listings from the Amicorp careers hub', async () => {
  const amicorp = await loadAmicorpModule()

  assert.deepEqual(amicorp.extractCareerListings(careersHtml), [
    {
      title: 'Senior Group Legal',
      subtitle: 'JD1440 - Bangalore (India) - 13 Apr 2026',
      sourceUrl: 'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/',
    },
    {
      title: 'Central Fund Accountant - BL, CT, MU, CL',
      subtitle: 'JD1527 - Bangalore (India) - 09 Jul 2026',
      sourceUrl: 'https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/',
    },
    {
      title: 'Fund Relationship Management AMIF',
      subtitle: 'JD1479 - Dubai (United Arab Emirates) - 28 Apr 2026',
      sourceUrl: 'https://amicorp.com/ami-news/careers/fund-relationship-management-amif-dubai-jd1479/',
    },
  ])

  assert.deepEqual(amicorp.extractIndiaListings(careersHtml), [
    {
      title: 'Senior Group Legal',
      subtitle: 'JD1440 - Bangalore (India) - 13 Apr 2026',
      sourceUrl: 'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/',
    },
    {
      title: 'Central Fund Accountant - BL, CT, MU, CL',
      subtitle: 'JD1527 - Bangalore (India) - 09 Jul 2026',
      sourceUrl: 'https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/',
    },
  ])
})

test('extractJobDetail maps a verified Amicorp first-party detail page into shared job fields', async () => {
  const amicorp = await loadAmicorpModule()
  const detail = amicorp.extractJobDetail({
    listing: {
      title: 'Senior Group Legal',
      subtitle: 'JD1440 - Bangalore (India) - 13 Apr 2026',
      sourceUrl: 'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/',
    },
    html: seniorGroupLegalDetailHtml,
  })

  assert.deepEqual(detail, {
    title: 'Senior Group Legal',
    company: 'Amicorp',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    state: null,
    country: 'India',
    jobId: 'amicorp-jd1440',
    requisitionId: 'JD1440',
    sourceUrl: 'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/',
    applyUrl: 'https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/formperma/eclRamd2dWW4rbcIcyYbA0ooIb_3CA2MBYGp_56EYyY',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-04-15T11:34:56+00:00',
    closingDate: null,
    jobDescription: 'The role holder is primarily accountable for ensuring compliance with statutory requirements for all internal entities, protect the interests of the Group and minimizing legal risk.',
    remoteStatus: null,
    sourceListingComplete: false,
    sourceDetailComplete: true,
    sourceDetailStatus: 'complete',
  })
})

test('extractJobDetail uses the native displayed posting date rather than updated-time metadata and accepts a single-quoted Zoho iframe', async () => {
  const amicorp = await loadAmicorpModule()
  const listing = {
    title: 'Senior Local Fund Operations (AMIF)',
    subtitle: 'Bangalore (India) - 04 Aug 2026',
    sourceUrl: 'https://amicorp.com/ami-news/careers/senior-local-fund-operations-amif-jd1551/',
  }

  const job = amicorp.extractJobDetail({
    listing,
    html: `
      <html><head><title>Senior Local Fund Operations (AMIF) - JD1551 - Amicorp</title>
      <link rel="canonical" href="${listing.sourceUrl}" />
      <meta property="og:site_name" content="Amicorp" />
      <meta property="og:updated_time" content="2026-08-04T09:45:08+00:00" />
      </head><body>
      <div><span class="colored" style="color:#152968">Bangalore (India)</span>
      <span class="colored" style="color:#6F82C1">(04 Aug 2026)</span><span>JD1551</span></div>
      <a href="#form">Apply now</a><p>Current first-party Amicorp role description. The role holder maintains fund administration records, reconciles investor activity and prepares accurate reports in accordance with native employer requirements.</p>
      <iframe aria-label='Career Page Form' src='https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/formperma/eclRamd2dWW4rbcIcyYbA0ooIb_3CA2MBYGp_56EYyY'></iframe>
      </body></html>
    `,
  })

  assert.equal(job.requisitionId, 'JD1551')
  assert.equal(job.postingDate, '2026-08-04')
  assert.equal(job.applyUrl, amicorp.TRUSTED_APPLY_FORM_URL)
})

test('run validates the verified Amicorp careers hub, sitemap, and detail pages before decorating India jobs', async () => {
  const amicorp = await loadAmicorpModule()
  const requestedUrls = []

  const jobs = await amicorp.createAmicorpScraper({
    maxJobs: 2,
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === amicorp.CAREERS_URL) return careersHtml
      if (url === amicorp.PAGE_SITEMAP_URL) return pageSitemapXml
      if (url === 'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/') {
        return seniorGroupLegalDetailHtml
      }
      if (url === 'https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/') {
        return centralFundAccountantDetailHtml
      }

      assert.fail(`Unexpected Amicorp URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    amicorp.CAREERS_URL,
    amicorp.PAGE_SITEMAP_URL,
    'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/',
    'https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'amicorp')
  assert.equal(
    jobs[0].link,
    'https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/formperma/eclRamd2dWW4rbcIcyYbA0ooIb_3CA2MBYGp_56EYyY',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Senior Group Legal', 'Central Fund Accountant - BL, CT, MU, CL'],
  )
})

test('run fails closed when the verified Amicorp careers hub, sitemap, or trusted apply form markers drift', async () => {
  const amicorp = await loadAmicorpModule()

  await assert.rejects(
    amicorp.createAmicorpScraper().run({
      fetchText: async (url) => {
        if (url === amicorp.CAREERS_URL) {
          return '<html><head><title>Unexpected</title></head><body>No careers cards</body></html>'
        }

        return pageSitemapXml
      },
    }),
    /verified official Amicorp careers page/i,
  )

  await assert.rejects(
    amicorp.createAmicorpScraper().run({
      fetchText: async (url) => {
        if (url === amicorp.CAREERS_URL) return careersHtml
        if (url === amicorp.PAGE_SITEMAP_URL) {
          return '<?xml version="1.0"?><urlset><url><loc>https://amicorp.com/</loc></url></urlset>'
        }

        return seniorGroupLegalDetailHtml
      },
    }),
    /verified Amicorp page sitemap/i,
  )

  await assert.rejects(
    amicorp.createAmicorpScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === amicorp.CAREERS_URL) return careersHtml
        if (url === amicorp.PAGE_SITEMAP_URL) return pageSitemapXml
        return seniorGroupLegalDetailHtml.replace('CareerPageForm', 'DifferentForm')
      },
    }),
    /trusted apply form/i,
  )
})

test('Amicorp uses the working first-party sitemap query endpoint when rewritten sitemap paths return 404', async () => {
  const amicorp = await loadAmicorpModule()
  const jobs = await amicorp.createAmicorpScraper().run({
    fetchText: async (url) => {
      if (url === 'https://amicorp.com/ami-news/careers/') return careersHtml
      if (url === 'https://amicorp.com/?sitemap=page&sitemap_n=1') return pageSitemapXml
      if (url === 'https://amicorp.com/page-sitemap1.xml') {
        throw new Error('HTTP 404 for https://amicorp.com/page-sitemap1.xml')
      }
      if (url === 'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/') {
        return seniorGroupLegalDetailHtml
      }
      if (url === 'https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/') {
        return centralFundAccountantDetailHtml
      }
      throw new Error(`Unexpected Amicorp URL: ${url}`)
    },
  })

  assert.deepEqual(jobs.map(job => job.requisitionId), ['JD1440', 'JD1527'])
  assert.deepEqual(jobs.map(job => job.country), ['India', 'India'])
})

test('Amicorp fails closed when its page sitemap omits a listed India role', async () => {
  const amicorp = await loadAmicorpModule()
  const sitemapMissingIndiaRole = pageSitemapXml.replace(
    'https://amicorp.com/ami-news/careers/central-fund-accountant-bl-ct-mu-cl-jd1527/',
    'https://amicorp.com/ami-news/careers/other-overseas-role/',
  )

  await assert.rejects(amicorp.createAmicorpScraper().run({
    fetchText: async (url) => {
      if (url === amicorp.CAREERS_URL) return careersHtml
      if (url === amicorp.PAGE_SITEMAP_URL) return sitemapMissingIndiaRole
      if (url === 'https://amicorp.com/ami-news/careers/senior-group-legal-jd1440/') {
        return seniorGroupLegalDetailHtml
      }
      throw new Error(`Unexpected Amicorp URL: ${url}`)
    },
  }), /page sitemap no longer advertises the verified detail URL/)
})
