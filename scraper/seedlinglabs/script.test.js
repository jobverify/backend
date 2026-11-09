import assert from 'node:assert/strict'
import test from 'node:test'

const loadSeedlingLabsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Seedling Labs scraper module at ./script.js')
  }
}

const siteShellHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="description" content="SeedlingLabs builds AI-native products that transform how teams develop, test, and teach. Explore Orchard, Sprout, and AI Labs — our Product-Development-as-a-Service ecosystem." />
      <meta property="og:site_name" content="SeedlingLabs" />
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "SeedlingLabs",
        "url": "https://seedlinglabs.com",
        "logo": "https://seedlinglabs.com/Logo.svg"
      }
      </script>
      <script type="module" crossorigin src="/assets/index-ClQIiX3I.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/index-B4rERkza.css">
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const careersShellHtml = siteShellHtml

const careersBundle = `
  var footer={email:\`mailto:info@seedlinglabs.com\`};
  var Fv=[
    {role:\`Senior Product Designer\`,team:\`Products\`,location:\`Bengaluru\`,type:\`Full-time\`},
    {role:\`Associate Director\`,team:\`Growth\`,location:\`Bengaluru\`,type:\`Full-time\`},
    {role:\`Software Development 3\`,team:\`Platform\`,location:\`Gangavathi\`,type:\`Full-time\`},
    {role:\`Software Development 2\`,team:\`Platform\`,location:\`Gangavathi\`,type:\`Full-time\`},
    {role:\`Software Development 2\`,team:\`Platform\`,location:\`Bengaluru\`,type:\`Full-time\`},
    {role:\`Technical Engineering Manager\`,team:\`Platform\`,location:\`Gangavathi\`,type:\`Full-time\`}
  ];
  function Iv(){
    return {
      title:\`CareersJoin SeedlingLabs\`,
      description:\`Join SeedlingLabs and build AI-native products that matter. Open roles in product design, engineering, and growth across Bengaluru and Gangavathi. AI-native work, real ownership, and impact at scale.\`,
      cta:\`View Open Roles\`,
      anchor:\`#openings\`,
      sectionTitle:\`Open Roles\`,
      sectionBody:\`Don't see the right fit? Reach out at \`,
      email:\`mailto:info@seedlinglabs.com\`,
      className:\`openings-list\`,
      rows:Fv.map((item)=>({href:\`mailto:info@seedlinglabs.com\`,item}))
    };
  }
`

test('Seedling Labs sentinels recognize the verified first-party shell and bundle-backed careers surface', async () => {
  const seedlingLabs = await loadSeedlingLabsModule()

  assert.equal(seedlingLabs.SOURCE, 'seedlinglabs')
  assert.equal(seedlingLabs.COMPANY, 'Seedling Labs')
  assert.equal(seedlingLabs.HOMEPAGE_URL, 'https://seedlinglabs.com/')
  assert.equal(seedlingLabs.CAREERS_URL, 'https://seedlinglabs.com/careers')
  assert.equal(seedlingLabs.hasOfficialSiteShellSignal(siteShellHtml), true)
  assert.equal(seedlingLabs.hasOfficialSiteShellSignal(careersShellHtml), true)
  assert.equal(seedlingLabs.extractBundleAssetPath(siteShellHtml), '/assets/index-ClQIiX3I.js')
  assert.equal(seedlingLabs.hasOfficialCareersBundleSignal(careersBundle), true)
})

test('Seedling Labs extracts the visible first-party open roles from the verified client bundle', async () => {
  const seedlingLabs = await loadSeedlingLabsModule()

  const listings = seedlingLabs.extractCareerListings(careersBundle)

  assert.equal(listings.length, 6)
  assert.deepEqual(
    listings.map((listing) => `${listing.title} | ${listing.department} | ${listing.location}`),
    [
      'Senior Product Designer | Products | Bengaluru, Karnataka, India',
      'Associate Director | Growth | Bengaluru, Karnataka, India',
      'Software Development 3 | Platform | Gangavathi, Karnataka, India',
      'Software Development 2 | Platform | Gangavathi, Karnataka, India',
      'Software Development 2 | Platform | Bengaluru, Karnataka, India',
      'Technical Engineering Manager | Platform | Gangavathi, Karnataka, India',
    ],
  )

  assert.deepEqual(
    (({
      title,
      department,
      location,
      city,
      state,
      country,
      employmentType,
      applyUrl,
      sourceUrl,
      jobId,
      requisitionId,
    }) => ({
      title,
      department,
      location,
      city,
      state,
      country,
      employmentType,
      applyUrl,
      sourceUrl,
      jobId,
      requisitionId,
    }))(listings[0]),
    {
      title: 'Senior Product Designer',
      department: 'Products',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      employmentType: 'Full-time',
      applyUrl: 'mailto:info@seedlinglabs.com',
      sourceUrl: 'https://seedlinglabs.com/careers',
      jobId: 'seedlinglabs-senior-product-designer-bengaluru-karnataka',
      requisitionId: 'seedlinglabs-senior-product-designer-bengaluru-karnataka',
    },
  )

  assert.deepEqual(
    listings
      .filter((listing) => listing.title === 'Software Development 2')
      .map((listing) => listing.jobId),
    [
      'seedlinglabs-software-development-2-gangavathi-karnataka',
      'seedlinglabs-software-development-2-bengaluru-karnataka',
    ],
  )
})

test('Seedling Labs run verifies the first-party shell and bundle before returning the current openings', async () => {
  const seedlingLabs = await loadSeedlingLabsModule()
  const requestedUrls = []

  const jobs = await seedlingLabs.createSeedlingLabsScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === seedlingLabs.HOMEPAGE_URL) return siteShellHtml
      if (url === seedlingLabs.CAREERS_URL) return careersShellHtml
      if (url === 'https://seedlinglabs.com/assets/index-ClQIiX3I.js') return careersBundle

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    seedlingLabs.HOMEPAGE_URL,
    seedlingLabs.CAREERS_URL,
    'https://seedlinglabs.com/assets/index-ClQIiX3I.js',
  ])
  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      source: job.source,
      link: job.link,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Senior Product Designer',
        department: 'Products',
        source: 'seedlinglabs',
        link: 'https://seedlinglabs.com/careers',
        companyCareerPage: 'https://seedlinglabs.com/careers',
        companyDomain: 'seedlinglabs.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Associate Director',
        department: 'Growth',
        source: 'seedlinglabs',
        link: 'https://seedlinglabs.com/careers',
        companyCareerPage: 'https://seedlinglabs.com/careers',
        companyDomain: 'seedlinglabs.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Software Development 3',
        department: 'Platform',
        source: 'seedlinglabs',
        link: 'https://seedlinglabs.com/careers',
        companyCareerPage: 'https://seedlinglabs.com/careers',
        companyDomain: 'seedlinglabs.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Software Development 2',
        department: 'Platform',
        source: 'seedlinglabs',
        link: 'https://seedlinglabs.com/careers',
        companyCareerPage: 'https://seedlinglabs.com/careers',
        companyDomain: 'seedlinglabs.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Software Development 2',
        department: 'Platform',
        source: 'seedlinglabs',
        link: 'https://seedlinglabs.com/careers',
        companyCareerPage: 'https://seedlinglabs.com/careers',
        companyDomain: 'seedlinglabs.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Technical Engineering Manager',
        department: 'Platform',
        source: 'seedlinglabs',
        link: 'https://seedlinglabs.com/careers',
        companyCareerPage: 'https://seedlinglabs.com/careers',
        companyDomain: 'seedlinglabs.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
})

test('Seedling Labs fails closed when the verified shell or bundle no longer matches the trusted first-party surface', async () => {
  const seedlingLabs = await loadSeedlingLabsModule()

  await assert.rejects(
    seedlingLabs.createSeedlingLabsScraper().run({
      fetchText: async (url) => {
        if (url === seedlingLabs.HOMEPAGE_URL) {
          return siteShellHtml.replace('SeedlingLabs', 'Another Company')
        }

        return careersShellHtml
      },
    }),
    /verified official site shell/i,
  )

  await assert.rejects(
    seedlingLabs.createSeedlingLabsScraper().run({
      fetchText: async (url) => {
        if (url === seedlingLabs.HOMEPAGE_URL) return siteShellHtml
        if (url === seedlingLabs.CAREERS_URL) return careersShellHtml
        if (url === 'https://seedlinglabs.com/assets/index-ClQIiX3I.js') {
          return careersBundle.replace('View Open Roles', 'Explore')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers bundle/i,
  )
})
