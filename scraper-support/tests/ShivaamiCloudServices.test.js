import assert from 'node:assert/strict'
import test from 'node:test'

const shellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Shivaami - Enterprise IT Solutions</title>
    <script type="module" crossorigin src="/assets/index-BQa_sAgz.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const mainBundle = `
  const routes = [
    "/contact",
    "/careers",
    "assets/Careers-BeFM9JtK.js",
    "assets/CareerThankYou-CuQUQAdz.js"
  ];
`

const careersBundle = `
  const jobs = [
    {
      title:"Social Media Manager",
      experience:"3-5 years",
      description:"We are looking for a creative Social Media Manager to drive B2B strategies, manage paid campaigns, create thought-leadership content for CXOs, and oversee leadership LinkedIn profiles."
    },
    {
      title:"Inside Sales Representative",
      experience:"0-2 years (Freshers can also apply)",
      description:"Looking for individuals who will actively source new sales opportunities through emailing and cold-calling."
    }
  ];
  const location = "Mumbai, India";
  const sectionHeading = "Current Openings";
  const applyCopy = "Apply Now";
  const formEndpoint = "STORE_CAREER_DETAILS";
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/shivaamicloudservices/provider.js')
  } catch {
    assert.fail('Expected Shivaami Cloud Services provider module at ../../scraper/shivaamicloudservices/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/shivaamicloudservices/script.js')
  } catch {
    assert.fail('Expected Shivaami Cloud Services scraper module at ../../scraper/shivaamicloudservices/script.js')
  }
}

test('Shivaami Cloud Services exports the verified first-party SPA careers contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'shivaamicloudservices',
    companyName: 'Shivaami Cloud Services',
    officialBrandName: 'Shivaami',
    adapter: 'script',
    modulePath: '../../scraper/shivaamicloudservices/script.js',
    homepageUrl: 'https://www.shivaami.com/',
    companyCareerPage: 'https://www.shivaami.com/careers/',
    atsPlatform: 'javascript-first-party-careers-bundle',
    countryFilter: 'India',
    paginationStrategy: 'careers-spa-shell-plus-main-bundle-plus-careers-chunk',
    extractionStrategy: 'verified-first-party-spa-shell+careers-chunk-role-array+single-page-apply-flow',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'shivaami.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.shivaami.com/careers/ served a first-party JavaScript careers route, that its bundled careers chunk rendered a Current Openings section with roles including Social Media Manager and Inside Sales Representative, and that applications flowed through Shivaami\'s own careers form on the same route.',
    dryRunFile: 'shivaamicloudservices/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Shivaami Cloud Services discovers the careers chunk and maps public openings', async () => {
  const shivaami = await loadScriptModule()

  assert.equal(shivaami.hasCareersShellSignal(shellHtml), true)
  assert.equal(
    shivaami.extractMainBundleUrl(shellHtml),
    'https://www.shivaami.com/assets/index-BQa_sAgz.js',
  )
  assert.equal(
    shivaami.extractCareersChunkUrl(mainBundle),
    'https://www.shivaami.com/assets/Careers-BeFM9JtK.js',
  )
  assert.deepEqual(shivaami.extractOpeningsFromCareersBundle(careersBundle), [
    {
      title: 'Social Media Manager',
      experience: '3-5 years',
      description:
        'We are looking for a creative Social Media Manager to drive B2B strategies, manage paid campaigns, create thought-leadership content for CXOs, and oversee leadership LinkedIn profiles.',
    },
    {
      title: 'Inside Sales Representative',
      experience: '0-2 years (Freshers can also apply)',
      description: 'Looking for individuals who will actively source new sales opportunities through emailing and cold-calling.',
    },
  ])

  const jobs = await shivaami.run({
    fetchText: async (url) => {
      if (url === shivaami.CAREERS_URL) return shellHtml
      if (url === 'https://www.shivaami.com/assets/index-BQa_sAgz.js') return mainBundle
      if (url === 'https://www.shivaami.com/assets/Careers-BeFM9JtK.js') return careersBundle
      throw new Error(`Unexpected Shivaami URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Social Media Manager',
      company: 'Shivaami Cloud Services',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'social-media-manager',
      requisitionId: 'social-media-manager',
      sourceUrl: 'https://www.shivaami.com/careers/',
      applyUrl: 'https://www.shivaami.com/careers/',
      employmentType: null,
      experienceRequired: '3-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'We are looking for a creative Social Media Manager to drive B2B strategies, manage paid campaigns, create thought-leadership content for CXOs, and oversee leadership LinkedIn profiles.',
      link: 'https://www.shivaami.com/careers/',
      source: 'shivaamicloudservices',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
    {
      title: 'Inside Sales Representative',
      company: 'Shivaami Cloud Services',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'inside-sales-representative',
      requisitionId: 'inside-sales-representative',
      sourceUrl: 'https://www.shivaami.com/careers/',
      applyUrl: 'https://www.shivaami.com/careers/',
      employmentType: null,
      experienceRequired: '0-2 years (Freshers can also apply)',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Looking for individuals who will actively source new sales opportunities through emailing and cold-calling.',
      link: 'https://www.shivaami.com/careers/',
      source: 'shivaamicloudservices',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})
