import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/emidstechnologieslimited/script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Emids</title>
  </head>
  <body>
    <h1>Help Shape the Future of Health</h1>
    <h4>Be A Part Of Our Growth Story</h4>
    <a href="https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs" target="_blank">
      Explore Open Roles
    </a>
  </body>
</html>
`

const bibhaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Emids</title>
  </head>
  <body>
    <h1>Help Shape the Future of Health</h1>
    <p>Join our global team of expert problem solvers.</p>
    <h4>Be A Part Of Our Growth Story</h4>
    <a href="https://emids.bibha.ai/career/emids/" target="_blank">
      Explore Open Roles
    </a>
  </body>
</html>
`

const bibhaBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | </title>
  </head>
  <body>
    <script src="/_next/static/chunks/app/career/%5BtenantCode%5D/page-9e40bb64e701c5b8.js" async=""></script>
  </body>
</html>
`

const candidateExperienceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Emids Career Site</title>
    <base href="/hcmUI/CandidateExperience/en/sites/CX_1/" data-apibaseurl="https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com:443" data-sitenumber="CX_1" />
  </head>
  <body>
    Emids Career Site
  </body>
</html>
`

const listingPayload = {
  items: [
    {
      TotalJobsCount: 1,
      Limit: 5,
      requisitionList: [
        {
          Id: 'REQ-1001',
          Title: 'Business Analyst',
          JobFunction: 'Consulting',
          PrimaryLocation: 'Bengaluru, Karnataka, India',
          PrimaryLocationCountry: 'IN',
          secondaryLocations: [],
          ExternalPostedStartDate: '2026-07-10T00:00:00Z',
          ExternalPostedEndDate: null,
          ShortDescriptionStr: 'Partner with delivery teams and business stakeholders.',
          RequisitionType: 'Regular',
        },
      ],
    },
  ],
}

const detailPayload = {
  items: [
    {
      Id: 'REQ-1001',
      Title: 'Business Analyst',
      JobFunction: 'Consulting',
      PrimaryLocation: 'Bengaluru, Karnataka, India',
      PrimaryLocationCountry: 'IN',
      secondaryLocations: [],
      ExternalPostedStartDate: '2026-07-10T00:00:00Z',
      ExternalPostedEndDate: null,
      ExternalDescriptionStr: '<p>Gather requirements and partner with delivery teams.</p>',
      ExternalResponsibilitiesStr: '<p>Work with stakeholders and delivery leads.</p>',
      ExternalQualificationsStr: '<p>Bachelor degree and prior BA experience.</p>',
      RequisitionType: 'Regular',
    },
  ],
}

const bibhaJobsPayload = {
  success: true,
  data: {
    jobs: [
      {
        id: 'c67cfcfe-35c1-4522-9891-33d14385ec2c',
        title: 'Architect',
        category: 'Banking, Financial Services and Insurance',
        location: [],
        postedDate: '2026-08-07T12:43:21.699Z',
        experience: '12-15',
        workMode: 'Hybrid',
        rrNumber: 'RR/825/2026',
        employmentType: null,
        description: '<p>Design and oversee enterprise architecture.</p>',
      },
      {
        id: '5d9f0c37-e4d7-4367-8321-a700bc5c4bef',
        title: 'Senior Consultant',
        category: 'Banking, Financial Services and Insurance',
        location: ['Bangalore Urban, Karnataka'],
        postedDate: '2026-07-28T06:09:54.877Z',
        experience: '5-10',
        workMode: 'Hybrid',
        rrNumber: 'RR/752/2026',
        employmentType: null,
        description: '<p>Lead Databricks and data engineering initiatives.</p>',
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      totalItems: 2,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  },
}

const bibhaArchitectDetailPayload = {
  success: true,
  data: {
    id: 'c67cfcfe-35c1-4522-9891-33d14385ec2c',
    title: 'Architect',
    category: 'Banking, Financial Services and Insurance',
    location: [],
    country: 'India',
    postedDate: '2026-08-07T12:43:21.699Z',
    experience: '12-15',
    description: '<p>Design and oversee enterprise architecture.</p>',
    workMode: 'Hybrid',
    rrNumber: 'RR/825/2026',
    employmentType: null,
  },
}

const bibhaConsultantDetailPayload = {
  success: true,
  data: {
    id: '5d9f0c37-e4d7-4367-8321-a700bc5c4bef',
    title: 'Senior Consultant',
    category: 'Banking, Financial Services and Insurance',
    location: ['Bangalore Urban, Karnataka', 'Noida, Uttar Pradesh'],
    country: 'India',
    postedDate: '2026-07-28T06:09:54.877Z',
    experience: '5-10',
    description: '<p>Lead Databricks and data engineering initiatives across India teams.</p>',
    workMode: 'Hybrid',
    rrNumber: 'RR/752/2026',
    employmentType: null,
  },
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/emidstechnologieslimited/catalog.js')
  } catch {
    assert.fail('Expected Emids Technologies Limited catalog module at ../../scraper/emidstechnologieslimited/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/emidstechnologieslimited/script.js')
  } catch {
    assert.fail('Expected Emids Technologies Limited scraper module at ../../scraper/emidstechnologieslimited/script.js')
  }
}

test('Emids Technologies Limited local catalog captures the verified Bibha handoff and public jobs API', async () => {
  const { EMIDS_TECHNOLOGIES_LIMITED_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EMIDS_TECHNOLOGIES_LIMITED_CATALOG)

  assert.equal(defaultCatalog, EMIDS_TECHNOLOGIES_LIMITED_CATALOG)
  assert.equal(provider.source, 'emidstechnologieslimited')
  assert.equal(provider.companyName, 'Emids Technologies Limited')
  assert.equal(provider.officialBrandName, 'Emids')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.emids.com/')
  assert.equal(provider.companyCareerPage, 'https://www.emids.com/careers/')
  assert.equal(provider.officialJobsBoardUrl, 'https://emids.bibha.ai/career/emids/')
  assert.equal(provider.tenantCode, 'emids')
  assert.equal(provider.publicApiKey, 'JzLueUKODg9oROwgxqjRe52eZkIQPHyyayYsxAdwshdsjhds23sgdshdg')
  assert.equal(provider.workspaceDomain, 'emids.bibha.ai')
  assert.equal(
    provider.listingApiBaseUrl,
    'https://emids.bibha.ai/api/bibha-recruiter-job-management/v2/career-config/jobs',
  )
  assert.equal(
    provider.detailApiBaseUrl,
    'https://emids.bibha.ai/api/bibha-recruiter-job-management/v2/career-config/job',
  )
  assert.equal(provider.publicJobsBaseUrl, 'https://emids.bibha.ai/career/emids/apply/')
  assert.equal(
    provider.oracleCandidateExperienceUrl,
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs',
  )
  assert.equal(
    provider.oracleListingApiBaseUrl,
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    provider.oracleDetailApiBaseUrl,
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    provider.oraclePublicJobsBaseUrl,
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  )
  assert.equal(provider.siteNumber, 'CX_1')
  assert.equal(provider.companyDomain, 'emids.com')
  assert.equal(provider.atsPlatform, 'bibha-public-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'tenant-jobs-api-page-and-limit-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-bibha-careers-shell+public-bibha-jobs-api+public-bibha-job-detail-api+india-country-filter',
  )
  assert.equal(provider.verifiedPublicJobCount, 12)
  assert.equal(provider.verifiedIndiaJobCount, 12)
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Explore Open Roles/i)
  assert.match(provider.verifiedSurfaceSummary, /Bibha/i)
  assert.match(provider.verifiedSurfaceSummary, /Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /Tech Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Consultant/i)
})

test('Emids Technologies Limited exact backlog row resolves from the local catalog', async () => {
  const { EMIDS_TECHNOLOGIES_LIMITED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Emids Technologies Limited\n',
    catalog: [hydrateProviderCatalogEntry(EMIDS_TECHNOLOGIES_LIMITED_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Emids Technologies Limited scraper extracts India jobs from the Oracle Cloud finder and detail APIs', async () => {
  const emids = await loadScriptModule()
  const jobs = await emids.run({
    fetchText: async (url) => {
      if (url === emids.CAREERS_URL) return careersHtml
      if (url === emids.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      assert.fail(`Unexpected fetchText URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === emids.buildSearchUrl({ page: 0 })) return listingPayload
      if (url === emids.buildJobDetailApiUrl('REQ-1001')) return detailPayload
      assert.fail(`Unexpected fetchJson URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map(({ title, department, location, country, employmentType, sourceUrl, applyUrl, minimumQualification }) => ({
      title,
      department,
      location,
      country,
      employmentType,
      sourceUrl,
      applyUrl,
      minimumQualification,
    })),
    [
      {
        title: 'Business Analyst',
        department: 'Consulting',
        location: 'Bengaluru, Karnataka, India',
        country: 'India',
        employmentType: 'Regular',
        sourceUrl:
          'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/REQ-1001',
        applyUrl:
          'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/REQ-1001',
        minimumQualification: 'Bachelor degree and prior BA experience.',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /stakeholders/i)
})

test('Emids Technologies Limited scraper follows the verified Bibha public board and jobs APIs', async () => {
  const emids = await loadScriptModule()

  assert.equal(emids.hasOfficialCorporateCareersSignal(bibhaCareersHtml), true)
  assert.equal(emids.extractCorporateHandoffUrl(bibhaCareersHtml), 'https://emids.bibha.ai/career/emids/')
  assert.equal(emids.hasOfficialBibhaCareersSignal(bibhaBoardHtml), true)
  assert.equal(emids.buildBibhaJobsApiUrl({ page: 1 }), 'https://emids.bibha.ai/api/bibha-recruiter-job-management/v2/career-config/jobs?tenantCode=emids&page=1&limit=10')
  assert.equal(
    emids.buildBibhaJobDetailApiUrl('c67cfcfe-35c1-4522-9891-33d14385ec2c'),
    'https://emids.bibha.ai/api/bibha-recruiter-job-management/v2/career-config/job?tenantCode=emids&jobId=c67cfcfe-35c1-4522-9891-33d14385ec2c',
  )
  assert.equal(
    emids.buildBibhaApplyUrl('c67cfcfe-35c1-4522-9891-33d14385ec2c'),
    'https://emids.bibha.ai/career/emids/apply/c67cfcfe-35c1-4522-9891-33d14385ec2c/',
  )

  const jobs = await emids.run({
    fetchText: async (url) => {
      if (url === emids.CAREERS_URL) return bibhaCareersHtml
      if (url === emids.OFFICIAL_JOBS_BOARD_URL) return bibhaBoardHtml
      assert.fail(`Unexpected fetchText URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === emids.buildBibhaJobsApiUrl({ page: 1 })) return bibhaJobsPayload
      if (url === emids.buildBibhaJobDetailApiUrl('c67cfcfe-35c1-4522-9891-33d14385ec2c')) return bibhaArchitectDetailPayload
      if (url === emids.buildBibhaJobDetailApiUrl('5d9f0c37-e4d7-4367-8321-a700bc5c4bef')) return bibhaConsultantDetailPayload
      assert.fail(`Unexpected fetchJson URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map(({ title, location, country, requisitionId, experienceRequired, applyUrl, remoteStatus }) => ({
      title,
      location,
      country,
      requisitionId,
      experienceRequired,
      applyUrl,
      remoteStatus,
    })),
    [
      {
        title: 'Architect',
        location: 'India',
        country: 'India',
        requisitionId: 'RR/825/2026',
        experienceRequired: '12-15',
        applyUrl: 'https://emids.bibha.ai/career/emids/apply/c67cfcfe-35c1-4522-9891-33d14385ec2c/',
        remoteStatus: 'Hybrid',
      },
      {
        title: 'Senior Consultant',
        location: 'Bangalore Urban, Karnataka / Noida, Uttar Pradesh',
        country: 'India',
        requisitionId: 'RR/752/2026',
        experienceRequired: '5-10',
        applyUrl: 'https://emids.bibha.ai/career/emids/apply/5d9f0c37-e4d7-4367-8321-a700bc5c4bef/',
        remoteStatus: 'Hybrid',
      },
    ],
  )
  assert.match(jobs[1].jobDescription, /Databricks/i)
})

test('Emids Technologies Limited scraper still fails closed when the first-party handoff changes to an unverified board', async () => {
  const emids = await loadScriptModule()

  await assert.rejects(
    emids.run({
      fetchText: async (url) => {
        if (url === emids.CAREERS_URL) {
          return `
            <html>
              <head><title>Careers - Emids</title></head>
              <body>
                <h1>Help Shape the Future of Health</h1>
                <h4>Be A Part Of Our Growth Story</h4>
                <a href="https://example.com/jobs">Explore Open Roles</a>
              </body>
            </html>
          `
        }
        assert.fail(`Unexpected fetchText URL: ${url}`)
      },
      fetchJson: async () => bibhaJobsPayload,
    }),
    /careers handoff changed to https:\/\/example\.com\/jobs/i,
  )
})

test('Emids Technologies Limited scraper fails closed when the first-party handoff disappears', async () => {
  const emids = await loadScriptModule()

  await assert.rejects(
    emids.run({
      fetchText: async (url) => {
        if (url === emids.CAREERS_URL) {
          return '<html><head><title>Careers - Emids</title></head><body>No open roles link</body></html>'
        }
        return candidateExperienceHtml
      },
      fetchJson: async () => listingPayload,
    }),
    /verified first-party careers page/i,
  )
})
