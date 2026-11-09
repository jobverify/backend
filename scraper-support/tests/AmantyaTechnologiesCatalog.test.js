import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/amantyatechnologies/script.js')

const sampleHtml = `
  <section>
    <title>Careers | Amantya Technologies</title>
    <h2>Join Our Team</h2>
    <h5>Sr SW QA Automation Engineer</h5>
    <p>Experience: 4-8 Years</p>
    <p>Location: Gurgaon</p>
    <p>Job Type: Full Time</p>
    <ul><li>Selenium</li><li>Java</li></ul>
    <h5>TAC Engineer</h5>
    <p>Experience: 2-4 Years</p>
    <p>Location: Gurgaon</p>
    <p>Job Type: Full Time</p>
    <ul><li>LTE</li></ul>
    <a href="/apply">Apply Now</a>
  </section>
`

const liveCardHtml = `
  <title>Job Openings & Career Opportunities at Amantya Technologies</title>
  <h1>Career</h1>
  <section class="sectionPad">
    <div class="container">
      <div class="card mb-3">
        <div class="card-body">
          <div class="row">
            <div class="col-12">
              <h5>Linux Build - System Engineer</h5>
              <div class="row">
                <div class="col">
                  <h6>Experience</h6>
                  <p>7 - 9+ years</p>
                </div>
                <div class="col">
                  <h6>Position</h6>
                  <p></p>
                </div>
                <div class="col">
                  <h6>Job Location</h6>
                  <p>Gurgaon</p>
                </div>
                <div class="col">
                  <h6>Job Type</h6>
                  <p>Full Time</p>
                </div>
                <div class="col">
                  <button class="btn btn-outline-primary viewDetailsLink">View Detail</button>
                </div>
                <div class="col">
                  <button class="btn btn-primary">Apply Now</button>
                </div>
                <div class="col-12 toggleDescriptionArea">
                  <strong>Technical Skills :</strong>
                  <ul>
                    <li>Embedded Linux build environment development</li>
                    <li>Excellent scripting skills in Bash</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-body">
          <div class="row">
            <div class="col-12">
              <h5>Telecom Tester (Core Team)</h5>
              <div class="row">
                <div class="col">
                  <h6>Experience</h6>
                  <p>4 - 9 years</p>
                </div>
                <div class="col">
                  <h6>Job Location</h6>
                  <p>Gurgaon</p>
                </div>
                <div class="col">
                  <h6>Job Type</h6>
                  <p>Full Time</p>
                </div>
                <div class="col-12 toggleDescriptionArea">
                  <strong>Job Detail :</strong>
                  <ul>
                    <li>Experience in 5G Core Testing like SMF, AMF, UPF, UDM, PCF, Kubernetes.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
`

const loadCatalogModule = async () => import('../../scraper/amantyatechnologies/catalog.js')
const loadScriptModule = async () => import('../../scraper/amantyatechnologies/script.js')

test('Amantya Technologies local catalog captures the verified first-party careers surface', async () => {
  const { AMANTYA_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AMANTYA_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, AMANTYA_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'amantyatechnologies')
  assert.equal(provider.companyName, 'Amantya Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.amantyatech.com/careers')
  assert.equal(provider.companyDomain, 'amantyatech.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-panels')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Linux Build - System Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /RAN Developer/i)
  assert.equal(typeof module.run, 'function')
})

test('Amantya Technologies script extracts inline first-party job panels', async () => {
  const { extractJobPanels, hasOfficialAmantyaCareersSignal } = await loadScriptModule()
  const jobs = extractJobPanels(sampleHtml)

  assert.equal(hasOfficialAmantyaCareersSignal(sampleHtml), true)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Sr SW QA Automation Engineer')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.deepEqual(jobs[0].requiredSkills, ['Selenium', 'Java'])
  assert.equal(jobs[1].title, 'TAC Engineer')
})

test('Amantya Technologies script extracts the current bootstrap card layout from the live careers page', async () => {
  const { extractJobPanels, hasOfficialAmantyaCareersSignal } = await loadScriptModule()
  const jobs = extractJobPanels(liveCardHtml)

  assert.equal(hasOfficialAmantyaCareersSignal(liveCardHtml), true)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Linux Build - System Engineer')
  assert.equal(jobs[0].experienceRequired, '7 - 9+ years')
  assert.equal(jobs[0].location, 'Gurgaon')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.deepEqual(jobs[0].requiredSkills, [
    'Embedded Linux build environment development',
    'Excellent scripting skills in Bash',
  ])
  assert.equal(jobs[1].title, 'Telecom Tester (Core Team)')
})

test('Amantya Technologies exact backlog row resolves from the local catalog', async () => {
  const { AMANTYA_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Amantya Technologies\n',
    catalog: [hydrateProviderCatalogEntry(AMANTYA_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
