import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mistralsolutions/script.js')

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers Job Listings - Mistral Solutions</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h2>Explore Our Career Opportunities</h2>
    <table class="career-table">
      <thead>
        <tr>
          <th>Job ID</th>
          <th>Position</th>
          <th>Experience</th>
          <th>Location</th>
          <th>Required Skills</th>
          <th>Job Description</th>
          <th>Apply</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>JID-021</td>
          <td>Test Engineer - Senior Engineer</td>
          <td>3 to 7 Years</td>
          <td>Bangalore</td>
          <td>Expertise in electronics testing, embedded systems, troubleshooting, and oscilloscopes.</td>
          <td>
            <a
              href="https://mistralsolutions.com/wp-content/uploads/2026/07/18.Test-Engineer-Senior-Engineer.docx"
              class="job-description-btn"
              target="_blank">View Details</a>
          </td>
          <td>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdXCkBGxh_l8CuzwNaudaOr3Xg_wQATHZsCQGRGb8TdVi5OGA/viewform?usp=pp_url&#038;entry.1656541746=Test%20Engineer%20-%20Senior%20Engineer%20"
              class="apply-btn"
              target="_blank">
              Apply
            </a>
          </td>
        </tr>
        <tr>
          <td>JID-001</td>
          <td>Pre-Sales Lead - Module Lead/ Project Lead</td>
          <td>5 to 8 years</td>
          <td>Bangalore</td>
          <td>Expertise in electronics, embedded software, proposals, and stakeholder communication.</td>
          <td>
            <a
              href="https://mistralsolutions.com/wp-content/uploads/2026/07/Pre-Sales-Lead-Module-Lead_-Project-Lead.docx"
              class="job-description-btn"
              target="_blank">View Details</a>
          </td>
          <td>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdXCkBGxh_l8CuzwNaudaOr3Xg_wQATHZsCQGRGb8TdVi5OGA/viewform?usp=pp_url&#038;entry.1656541746=Pre-Sales%20Lead%20-%20Module%20Lead/%20Project%20Lead"
              class="apply-btn"
              target="_blank">
              Apply
            </a>
          </td>
        </tr>
      </tbody>
    </table>
    <p><strong>Don't find a role matching your skills?</strong></p>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mistralsolutions/catalog.js')
  } catch {
    assert.fail('Expected Mistral Solutions catalog module at ../../scraper/mistralsolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mistralsolutions/script.js')
  } catch {
    assert.fail('Expected Mistral Solutions scraper module at ../../scraper/mistralsolutions/script.js')
  }
}

test('Mistral Solutions local catalog captures the verified first-party careers table', async () => {
  const { MISTRAL_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scriptModule = await loadScriptModule()

  assert.equal(defaultCatalog, MISTRAL_SOLUTIONS_CATALOG)
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.source, 'mistralsolutions')
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.companyName, 'Mistral Solutions')
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.officialBrandName, 'Mistral Solutions')
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.adapter, 'script')
  assert.equal(
    MISTRAL_SOLUTIONS_CATALOG.companyCareerPage,
    'https://mistralsolutions.com/career/careers-job-listings/',
  )
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.atsPlatform, 'official-company-careers-table')
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.countryFilter, 'India')
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.paginationStrategy, 'single-careers-table-page')
  assert.equal(
    MISTRAL_SOLUTIONS_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+html-job-table+docx-detail-links+google-forms-apply-links',
  )
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.companyDomain, 'mistralsolutions.com')
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.verifiedOn, '2026-08-03')
  assert.equal(MISTRAL_SOLUTIONS_CATALOG.modulePath, modulePath)
  assert.match(MISTRAL_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(MISTRAL_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /JID-024/i)
  assert.match(MISTRAL_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /JID-023/i)
  assert.match(MISTRAL_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /JID-021/i)
  assert.match(MISTRAL_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /JID-001/i)
  assert.match(MISTRAL_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Google Forms/i)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, MISTRAL_SOLUTIONS_CATALOG)

  const report = generateCompanyCoverageReport({
    csvText: 'Mistral Solutions\n',
    catalog: [MISTRAL_SOLUTIONS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Mistral Solutions extracts first-party careers table rows with docx detail links and Google Forms apply links', async () => {
  const mistral = await loadScriptModule()

  assert.equal(mistral.hasOfficialCareersPageSignal(careersHtml), true)

  const extractedJobs = mistral.extractJobsFromHtml(careersHtml)
  assert.deepEqual(
    extractedJobs.map((job) => [job.jobId, job.title, job.location, job.sourceUrl, job.applyUrl]),
    [
      [
        'JID-021',
        'Test Engineer - Senior Engineer',
        'Bangalore',
        'https://mistralsolutions.com/wp-content/uploads/2026/07/18.Test-Engineer-Senior-Engineer.docx',
        'https://docs.google.com/forms/d/e/1FAIpQLSdXCkBGxh_l8CuzwNaudaOr3Xg_wQATHZsCQGRGb8TdVi5OGA/viewform?usp=pp_url&entry.1656541746=Test%20Engineer%20-%20Senior%20Engineer%20',
      ],
      [
        'JID-001',
        'Pre-Sales Lead - Module Lead/ Project Lead',
        'Bangalore',
        'https://mistralsolutions.com/wp-content/uploads/2026/07/Pre-Sales-Lead-Module-Lead_-Project-Lead.docx',
        'https://docs.google.com/forms/d/e/1FAIpQLSdXCkBGxh_l8CuzwNaudaOr3Xg_wQATHZsCQGRGb8TdVi5OGA/viewform?usp=pp_url&entry.1656541746=Pre-Sales%20Lead%20-%20Module%20Lead/%20Project%20Lead',
      ],
    ],
  )

  const native=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/mistral-native-documents.json.gz',import.meta.url))))
  const jobs = await mistral.createMistralSolutionsScraper().run({
    fetchResponse: async url => {
      const packet=native.packets.find(p=>p.requestedURL===url)
      assert.ok(packet,'Only the original declared native URLs may be read')
      return {...packet,bytes:Buffer.from(packet.bodyBase64||packet.bodyText,packet.bodyBase64?'base64':'utf8')}
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 25)
  assert.equal(jobs[0].source, 'mistralsolutions')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].requisitionId, null)
  assert.match(jobs[0].sourceDescription, /Preferred Profile/)
})

test('Mistral Solutions fails closed when the verified careers table disappears', async () => {
  const mistral = await loadScriptModule()

  await assert.rejects(
    mistral.createMistralSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>No listings here.</p></body></html>',
    }),
    /native careers table/i,
  )
})
