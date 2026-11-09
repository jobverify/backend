import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <title>Aptech Limited | Pioneer in the non-formal vocational training business</title>
    <script defer="defer" src="/static/js/main.2efba755.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const careersHtml = homepageHtml

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.aptech-worldwide.com/</loc></url>
  <url><loc>https://www.aptech-worldwide.com/about-us</loc></url>
  <url><loc>https://www.aptech-worldwide.com/careers-with-aptech</loc></url>
</urlset>
`

const bundleJs = `
  const CareerCards = ({ careers }) => careers.length > 0
    ? careers.map((career) => career.title)
    : "No vacancies available";
  const CareersPage = () => ({
    title: "Vocational Education Jobs & Career Opportunities | Careers at Aptech Limited",
    desc: "Explore rewarding careers in vocational education at Aptech Limited and join a global organization committed to skill development and professional growth.",
    route: "/careers-with-aptech",
    heading: "Careers with Aptech",
    intro: "Aptech is always looking for talented people.",
    apiUrl: "https://api.aptech-worldwide.com/careers/getlist"
  });
`

const apiJson = {
  Careers: [
    {
      careerId: 7,
      title: 'Zonal Sales Head',
      location: 'Mumbai, Chennai, Noida, Bengaluru, Hyderabad',
      brief_job_description: '<ul><li>Lead and manage all sales activities within the zone.</li><li>Regularly review sales reports and conversions.</li></ul>',
      desired_candidate_profile: '<ul><li>Strategic Sales Leadership</li><li>Qualifications &amp; Experience<ul><li>Qualification: Graduate/ Management Graduate</li><li>Work Experience: 12 plus years of experience in Sales</li></ul></li></ul>',
      required_skill_set: '',
      soft_skills: '',
      apply_to: 'careers@aptech.co.in',
      publish_date: '2026-03-30T00:00:00.000Z',
      status: 1,
    },
    {
      careerId: 20,
      title: 'GenAI Engineer',
      location: 'Mumbai',
      brief_job_description: '<ul><li>Build and optimize GenAI systems for learning and assessment products.</li></ul>',
      desired_candidate_profile: '<ul><li>Experience with LLM systems and production engineering.</li></ul>',
      required_skill_set: '<ul><li>Python</li><li>Azure</li><li>Prompt engineering</li></ul>',
      soft_skills: '',
      apply_to: 'careers@aptech.co.in',
      publish_date: '2026-07-14T00:00:00.000Z',
      status: 1,
    },
  ],
}

const loadAptechModule = async () => {
  try {
    return await import('../../scraper/aptech/script.js')
  } catch {
    assert.fail('Expected Aptech scraper module at ../../scraper/aptech/script.js')
  }
}

test('Aptech helpers stay pinned to the verified first-party shell, bundle handoff, and careers API shape', async () => {
  const aptech = await loadAptechModule()

  assert.equal(aptech.SOURCE, 'aptech')
  assert.equal(aptech.COMPANY, 'Aptech')
  assert.equal(aptech.OFFICIAL_BRAND_NAME, 'Aptech Limited')
  assert.equal(aptech.VERIFIED_ON, '2026-07-15')
  assert.equal(aptech.HOMEPAGE_URL, 'https://www.aptech-worldwide.com/')
  assert.equal(aptech.CAREERS_URL, 'https://www.aptech-worldwide.com/careers-with-aptech')
  assert.equal(aptech.CAREERS_API_URL, 'https://api.aptech-worldwide.com/careers/getlist')
  assert.equal(aptech.SITEMAP_URL, 'https://www.aptech-worldwide.com/sitemap.xml')
  assert.equal(aptech.hasOfficialShellSignal(homepageHtml), true)
  assert.equal(aptech.extractMainBundleUrl(homepageHtml, aptech.HOMEPAGE_URL), 'https://www.aptech-worldwide.com/static/js/main.2efba755.js')
  assert.equal(aptech.hasCareersBundleSignal(bundleJs), true)
  assert.equal(aptech.extractCareersApiUrl(bundleJs), aptech.CAREERS_API_URL)
  assert.equal(aptech.hasCareersRouteInSitemap(sitemapXml), true)
  assert.deepEqual(
    aptech.extractCareerListings(apiJson).map((job) => ({
      careerId: job.careerId,
      title: job.title,
      location: job.location,
      applyTo: job.applyTo,
      postingDate: job.postingDate,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        careerId: '7',
        title: 'Zonal Sales Head',
        location: 'Mumbai, Chennai, Noida, Bengaluru, Hyderabad, India',
        applyTo: 'careers@aptech.co.in',
        postingDate: '2026-03-30',
        sourceUrl: aptech.CAREERS_URL,
      },
      {
        careerId: '20',
        title: 'GenAI Engineer',
        location: 'Mumbai, India',
        applyTo: 'careers@aptech.co.in',
        postingDate: '2026-07-14',
        sourceUrl: aptech.CAREERS_URL,
      },
    ],
  )
  assert.equal(
    aptech.buildApplyUrl('careers@aptech.co.in', 'GenAI Engineer'),
    'mailto:careers@aptech.co.in?subject=Ref%3A%20Application%20for%20GenAI%20Engineer',
  )
  assert.match(
    aptech.extractCareerListings(apiJson)[0].jobDescription,
    /Lead and manage all sales activities within the zone/i,
  )
  assert.match(
    aptech.extractCareerListings(apiJson)[1].jobDescription,
    /Python Azure Prompt engineering/i,
  )
})

test('Aptech run returns India jobs from the verified first-party careers API surface', async () => {
  const aptech = await loadAptechModule()
  const requestedPageUrls = []
  const requestedJsonUrls = []

  const jobs = await aptech.createAptechScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === aptech.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aptech.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === aptech.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === 'https://www.aptech-worldwide.com/static/js/main.2efba755.js') {
        return { status: 200, url, html: bundleJs }
      }

      throw new Error(`Unexpected Aptech page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === aptech.CAREERS_API_URL) {
        return { status: 200, url, json: apiJson }
      }

      throw new Error(`Unexpected Aptech JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPageUrls, [
    aptech.HOMEPAGE_URL,
    aptech.CAREERS_URL,
    aptech.SITEMAP_URL,
    'https://www.aptech-worldwide.com/static/js/main.2efba755.js',
  ])
  assert.deepEqual(requestedJsonUrls, [aptech.CAREERS_API_URL])

  assert.deepEqual(jobs, [
    {
      title: 'Zonal Sales Head',
      company: 'Aptech',
      department: null,
      location: 'Mumbai, Chennai, Noida, Bengaluru, Hyderabad, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '7',
      requisitionId: '7',
      sourceUrl: 'https://www.aptech-worldwide.com/careers-with-aptech',
      applyUrl: 'mailto:careers@aptech.co.in?subject=Ref%3A%20Application%20for%20Zonal%20Sales%20Head',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-03-30',
      closingDate: null,
      jobDescription: 'Brief Job Description: Lead and manage all sales activities within the zone. Regularly review sales reports and conversions. Desired Candidate Profile: Strategic Sales Leadership Qualifications & Experience Qualification: Graduate/ Management Graduate Work Experience: 12 plus years of experience in Sales',
      source: 'aptech',
      link: 'mailto:careers@aptech.co.in?subject=Ref%3A%20Application%20for%20Zonal%20Sales%20Head',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'GenAI Engineer',
      company: 'Aptech',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '20',
      requisitionId: '20',
      sourceUrl: 'https://www.aptech-worldwide.com/careers-with-aptech',
      applyUrl: 'mailto:careers@aptech.co.in?subject=Ref%3A%20Application%20for%20GenAI%20Engineer',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-14',
      closingDate: null,
      jobDescription: 'Brief Job Description: Build and optimize GenAI systems for learning and assessment products. Desired Candidate Profile: Experience with LLM systems and production engineering. Required Skill Set: Python Azure Prompt engineering',
      source: 'aptech',
      link: 'mailto:careers@aptech.co.in?subject=Ref%3A%20Application%20for%20GenAI%20Engineer',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('Aptech fails closed when the shell, sitemap, bundle handoff, or careers API shape drifts', async () => {
  const aptech = await loadAptechModule()

  await assert.rejects(
    aptech.createAptechScraper().run({
      fetchPage: async (url) => {
        if (url === aptech.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }
        throw new Error(`Unexpected Aptech page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: aptech.CAREERS_API_URL, json: apiJson }),
    }),
    /homepage/i,
  )

  await assert.rejects(
    aptech.createAptechScraper().run({
      fetchPage: async (url) => {
        if (url === aptech.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === aptech.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }
        if (url === aptech.SITEMAP_URL) {
          return { status: 200, url, html: '<urlset></urlset>' }
        }
        throw new Error(`Unexpected Aptech page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: aptech.CAREERS_API_URL, json: apiJson }),
    }),
    /sitemap/i,
  )

  await assert.rejects(
    aptech.createAptechScraper().run({
      fetchPage: async (url) => {
        if (url === aptech.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === aptech.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }
        if (url === aptech.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }
        if (url === 'https://www.aptech-worldwide.com/static/js/main.2efba755.js') {
          return { status: 200, url, html: 'const apiUrl = "https://example.com/jobs";' }
        }
        throw new Error(`Unexpected Aptech page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: aptech.CAREERS_API_URL, json: apiJson }),
    }),
    /bundle/i,
  )

  await assert.rejects(
    aptech.createAptechScraper().run({
      fetchPage: async (url) => {
        if (url === aptech.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }
        if (url === aptech.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }
        if (url === aptech.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }
        if (url === 'https://www.aptech-worldwide.com/static/js/main.2efba755.js') {
          return { status: 200, url, html: bundleJs }
        }
        throw new Error(`Unexpected Aptech page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: aptech.CAREERS_API_URL, json: { Careers: [{ title: 'Broken' }] } }),
    }),
    /careers api/i,
  )
})
