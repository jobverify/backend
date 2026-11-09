import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hytechprofessionals/script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | HytechPro</title>
  </head>
  <body>
    <section id="current-opening">
      <h3>Join Our Journey! <span>Current Openings</span></h3>
      <script>
        rec_embed_js.load({
          widget_id:"rec_job_listing_div",
          page_name:"Careers",
          source:"CareerSite",
          site:"https://hytechprous.zohorecruit.com",
          empty_job_msg:"No current Openings"
        });
      </script>
    </section>
  </body>
</html>
`

const jobsPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'SEO specialist',
      Job_Opening_Name: 'SEO specialist',
      City: 'Noida',
      Country: 'India',
      Job_Type: 'Full time',
      Industry: 'Technology',
      id: '720646000007690079',
      $url: 'https://hytechprous.zohorecruit.com/jobs/Careers/720646000007690079/SEO-specialist?source=CareerSite',
    },
    {
      Posting_Title: 'Full Stack Microsoft Web Developer',
      Job_Opening_Name: 'Full Stack Microsoft Web Developer',
      City: 'Delhi',
      Country: 'India',
      Job_Type: 'Full time',
      Industry: 'Engineering',
      id: '720646000007491197',
      $url: 'https://hytechprous.zohorecruit.com/jobs/Careers/720646000007491197/Full-Stack-Microsoft-Web-Developer?source=CareerSite',
    },
    {
      Posting_Title: 'Salesforce Developer',
      Job_Opening_Name: 'Salesforce Developer',
      City: 'Noida',
      Country: 'India',
      Job_Type: 'Full time',
      Industry: 'IT Services',
      id: '720646000008481001',
      $url: 'https://hytechprous.zohorecruit.com/jobs/Careers/720646000008481001/Salesforce-Developer?source=CareerSite',
    },
    {
      Posting_Title: 'Project Manager',
      Job_Opening_Name: 'Project Manager',
      City: 'Germantown',
      Country: 'United States',
      Job_Type: 'Full time',
      Industry: 'IT Services',
      id: '720646000004779225',
      $url: 'https://hytechprous.zohorecruit.com/jobs/Careers/720646000004779225/Project-Manager?source=CareerSite',
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hytechprofessionals/catalog.js')
  } catch {
    assert.fail('Expected HyTech Professionals catalog module at ../../scraper/hytechprofessionals/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hytechprofessionals/script.js')
  } catch {
    assert.fail('Expected HyTech Professionals scraper module at ../../scraper/hytechprofessionals/script.js')
  }
}

test('HyTech Professionals local catalog captures the verified first-party Zoho careers contract', async () => {
  const { HYTECH_PROFESSIONALS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HYTECH_PROFESSIONALS_CATALOG)

  assert.equal(defaultCatalog, HYTECH_PROFESSIONALS_CATALOG)
  assert.equal(provider.source, 'hytechprofessionals')
  assert.equal(provider.companyName, 'HyTech Professionals')
  assert.equal(provider.officialBrandName, 'HyTechPro')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.hytechpro.com/')
  assert.equal(provider.companyCareerPage, 'https://www.hytechpro.com/career')
  assert.equal(provider.jobsApiUrl, 'https://hytechprous.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite')
  assert.equal(provider.companyDomain, 'hytechpro.com')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-zoho-payload')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+zoho-public-jobs-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /SEO specialist/i)
  assert.match(provider.verifiedSurfaceSummary, /Full Stack Microsoft Web Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Salesforce Developer/i)
})

test('HyTech Professionals exact backlog row resolves from the local catalog', async () => {
  const { HYTECH_PROFESSIONALS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'HyTech Professionals\n',
    catalog: [hydrateProviderCatalogEntry(HYTECH_PROFESSIONALS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('HyTech Professionals scraper validates the official Zoho embed shell and filters India jobs', async () => {
  const hytech = await loadScriptModule()

  assert.equal(hytech.SOURCE, 'hytechprofessionals')
  assert.equal(hytech.COMPANY, 'HyTech Professionals')
  assert.equal(hytech.CAREERS_URL, 'https://www.hytechpro.com/career')
  assert.equal(hytech.JOBS_API_URL, 'https://hytechprous.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite')
  assert.equal(hytech.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hytech.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)

  assert.deepEqual(hytech.extractJobsFromPayload(jobsPayload).map((job) => ({
    title: job.title,
    location: job.location,
    country: job.country,
  })), [
    {
      title: 'SEO specialist',
      location: 'Noida, India',
      country: 'India',
    },
    {
      title: 'Full Stack Microsoft Web Developer',
      location: 'Delhi, India',
      country: 'India',
    },
    {
      title: 'Salesforce Developer',
      location: 'Noida, India',
      country: 'India',
    },
  ])
})

test('HyTech Professionals run returns normalized India jobs from the public Zoho payload', async () => {
  const hytech = await loadScriptModule()
  const jobs = await hytech.createHyTechProfessionalsScraper().run({
    fetchText: async (url) => {
      assert.equal(url, hytech.CAREERS_URL)
      return careersHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, hytech.JOBS_API_URL)
      return jobsPayload
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'hytechprofessionals')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('HyTech Professionals run fails closed when the verified careers shell or India payload disappears', async () => {
  const hytech = await loadScriptModule()

  await assert.rejects(
    hytech.createHyTechProfessionalsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => jobsPayload,
    }),
    /verified hytech professionals careers page/i,
  )

  await assert.rejects(
    hytech.createHyTechProfessionalsScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async () => ({ code: 'success', data: [] }),
    }),
    /no longer exposes trusted public india jobs/i,
  )
})
