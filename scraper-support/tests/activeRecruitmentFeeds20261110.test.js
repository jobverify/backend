import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse } from 'acorn'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { recruitmentProgramProfile } from '../utils/recruitmentProgramProfile.js'

const inline = readFileSync(new URL('./fixtures/active-ashby-careers-20261110/inline.js', import.meta.url), 'utf8')
const feed = 'https://api.ashbyhq.com/posting-api/job-board/anomalo'
const widget = '<select id="ashby-dept-filter"></select><div id="ashby-jobs-list"></div>'
const page = program => '<title>Anomalo Careers</title><h1>Anomalo Careers</h1>' + widget + '<script>' + program + '</script>'
const config = { source: 'anomaloindia', companyName: 'Anomalo', companyCareerPage: 'https://www.anomalo.com/careers/',
  requireCorporateIdentityMatch: true, discoverLiteralRecruitmentData: true }
const description = '<p>Develop production software, design reliable distributed systems and maintain services. Work with engineering colleagues to test, deploy and operate applications.</p>'
const role = { id: 'native-1', title: 'Software Engineer', isListed: true, location: 'Bengaluru, India',
  address: { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru' } }, secondaryLocations: [],
  descriptionHtml: description, descriptionPlain: 'Develop production software, design reliable distributed systems and maintain services.',
  publishedAt: '2026-11-10T00:00:00.000Z', employmentType: 'FullTime', isRemote: false,
  jobUrl: 'https://jobs.ashbyhq.com/anomalo/native-1', applyUrl: 'https://jobs.ashbyhq.com/anomalo/native-1/application' }
const run = (html, rows = [role]) => createVerifiedRecruitmentScraper(config).run({
  now: () => '2026-11-10T01:00:00.000Z',
  fetchPage: async url => ({ url, status: 200, html }),
  fetchJson: async url => { assert.equal(url, feed); return { apiVersion: '1', jobs: structuredClone(rows) } },
})

test('program profiles distinguish null, nonfinite numbers and signed zero', () => {
  const fingerprint = value => {
    const program = parse('const board = "official"; const value = ' + value, { ecmaVersion: 'latest', sourceType: 'module' })
    return recruitmentProgramProfile(program, program.body[0].declarations[0].init)
  }
  assert.notEqual(fingerprint('null'), fingerprint('1e1000'))
  assert.notEqual(fingerprint('0'), fingerprint('-0'))
})

test('current active Ashby widget fetch supplies native India details through generic recruitment discovery', async () => {
  const jobs = await run(page(inline))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDescription, description)
  assert.equal(jobs[0].officialAtsBinding.bindingMethod, 'runtime-current-careers-active-native-fetch')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 1)
})

test('an active fetch does not turn an explicit foreign role into India or a verified empty inventory', async () => {
  const jobs = await run(page(inline), [{ ...role, location: 'Remote (US)', address: { postalAddress: { addressCountry: 'United States' } } }])
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('inactive, uncalled, shadowed and reassigned widget declarations never authorize native requests', async () => {
  const mutations = [
    '<title>Anomalo</title><template>' + widget + '<script>' + inline + '</script></template>',
    page(inline).replace('<script>', '<script type="application/json">'),
    page(inline).replace('<script>', '<script nomodule>'),
    page(inline).replace('<select id=', '<select hidden id='),
    page(inline).replace(widget, widget + widget),
    page(inline.replace('function init() {', 'function init(fetch) {')),
    page(inline.replace('fetch(API_URL)', 'fetch(OLD_URL)')),
    page(inline.replace('function init() {', 'function init() { var API_URL = "https://api.ashbyhq.com/posting-api/job-board/foreign";')),
    page(inline.replace('fetch(API_URL)', 'var { API_URL } = { API_URL: "https://api.ashbyhq.com/posting-api/job-board/foreign" }; fetch(API_URL)')),
    page(inline.replace('fetch(API_URL)', 'return; fetch(API_URL)')),
    page(inline.replace('if (document.readyState', 'return; if (document.readyState')),
    page(inline.replace('var allJobs = [];', 'var allJobs = []; API_URL = "https://api.ashbyhq.com/posting-api/job-board/foreign";')),
    page(inline.replace('var allJobs = [];', 'var allJobs = []; var retired = (function(){ throw new Error("retired") })();')),
    page(inline.replace('select.addEventListener("change", function () {', 'select.addEventListener("change", (function(){ throw new Error("retired") })() || function () {')),
    page(inline.replace('return j.isListed;', 'return false;')),
    page(inline.replace('return r.json();', 'return {}; return r.json();')),
    page(inline.replace('document.readyState === "loading"', 'document.readyState === "never"')),
    page(inline.replace('document.addEventListener("DOMContentLoaded", init)', 'document.addEventListener("click", init)')),
    page(inline.replace('renderJobs(allJobs);', 'renderJobs([]);')),
    '<title>Anomalo</title>' + widget + '<script>const documentation = ' + JSON.stringify(feed) + ';</script>',
  ]
  for (const html of mutations) {
    const nativeRequests = []
    await assert.rejects(createVerifiedRecruitmentScraper(config).run({
      fetchPage: async url => ({ url, status: 200, html }),
      fetchJson: async url => { nativeRequests.push(url); return { apiVersion: '1', jobs: structuredClone([role]) } },
    }), error => error.failureKind === 'coverage_gap')
    assert.deepEqual(nativeRequests, [])
  }
})

test('a bound feed still rejects a native role from a different account', async () => {
  const jobs = await run(page(inline), [{ ...role, jobUrl: 'https://jobs.ashbyhq.com/foreign/native-1',
    applyUrl: 'https://jobs.ashbyhq.com/foreign/native-1/application' }])
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].returnedIndiaJobs, 0)
  assert.match(jobs[RECRUITMENT_OBSERVATIONS].failures[0].message, /foreign board or role identity/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('generic discovery consumes an existing supported active Lever renderer instead of stopping at HTML', async () => {
  const program = readFileSync(new URL('./fixtures/active-ashby-careers-20261110/lever-inline.js', import.meta.url), 'utf8')
    .replace("const ACCOUNT_NAME = 'cloudinary';", "const ACCOUNT_NAME = 'exampleco';")
  const controls = '<select id="filter-location"></select><select id="filter-team"></select><button id="clear-filters"></button><div id="job-listings"></div>'
  const jobs = await createVerifiedRecruitmentScraper({ source: 'exampleco', companyName: 'Example Co',
    companyCareerPage: 'https://exampleco.test/careers/', requireCorporateIdentityMatch: true,
    discoverLiteralRecruitmentData: true }).run({
    fetchPage: async url => ({ url, status: 200, html: '<title>Example Co</title>' + controls + '<script>' + program + '</script>' }),
    fetchJson: async url => {
      assert.equal(url, 'https://api.lever.co/v0/postings/exampleco?mode=json')
      return [{ id: 'lever-native-1', text: 'Software Engineer', country: 'IN', categories: { location: 'Bengaluru, India' },
        description, hostedUrl: 'https://jobs.lever.co/exampleco/lever-native-1', applyUrl: 'https://jobs.lever.co/exampleco/lever-native-1/apply' }]
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobDescription, description)
  assert.equal(jobs[0].officialAtsBinding.bindingMethod, 'runtime-current-careers-active-native-fetch')
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  for (const programVariant of [
    program.replace('function fetchJobs()', "function fetchJobs(API_URL = 'https://api.lever.co/v0/postings/foreign?mode=json')"),
    program.replace('const response = await fetch(API_URL);', "var {API_URL} = {API_URL:'https://api.lever.co/v0/postings/foreign?mode=json'}; const response = await fetch(API_URL);"),
    program.replace('initJobBoard();', 'return; initJobBoard();'),
    program.replace('const response = await fetch(API_URL);', 'return []; const response = await fetch(API_URL);'),
    program.replace('initJobBoard();', 'throw new Error("retired"); initJobBoard();'),
    program.replace('return jobs.filter(job => job && job.categories && job.text);', 'return [];'),
  ]) {
    assert.notEqual(programVariant, program)
    const nativeRequests = []
    await assert.rejects(createVerifiedRecruitmentScraper({ source: 'exampleco', companyName: 'Example Co',
      companyCareerPage: 'https://exampleco.test/careers/', requireCorporateIdentityMatch: true,
      discoverLiteralRecruitmentData: true }).run({
      fetchPage: async url => ({ url, status: 200, html: '<title>Example Co</title>' + controls + '<script>' + programVariant + '</script>' }),
      fetchJson: async url => { nativeRequests.push(url); return [{ id: 'lever-native-1', text: 'Software Engineer', country: 'IN',
        categories: { location: 'Bengaluru, India' }, description, hostedUrl: 'https://jobs.lever.co/exampleco/lever-native-1',
        applyUrl: 'https://jobs.lever.co/exampleco/lever-native-1/apply' }] },
    }), error => error.failureKind === 'coverage_gap')
    assert.deepEqual(nativeRequests, [])
  }
})

for (const label of ['Join our team', 'Work with us']) {
  test(`current official '${label}' navigation reaches role details before declaring the source unavailable`, async () => {
    const root = 'https://exampleco.test/', detail = 'https://openings.exampleco.test/roles/native-1'
    const posting = { '@type': 'JobPosting', identifier: { value: 'native-1' }, title: 'Software Engineer', url: detail,
      hiringOrganization: { name: 'Example Co' }, description,
      jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } } }
    const jobs = await createVerifiedRecruitmentScraper({ source: 'navigationfixture', companyName: 'Example Co',
      companyCareerPage: root, requireCorporateIdentityMatch: true }).run({
      fetchPage: async url => ({ url, status: 200, html: url === root
        ? '<title>Example Co</title><a href="' + detail + '">' + label + '</a>'
        : '<title>Example Co</title><h1>Software Engineer</h1>' + description
          + '<script type="application/ld+json">' + JSON.stringify(posting) + '</script>' }),
    })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].country, 'India')
    assert.equal(jobs[0].sourceDescription, description)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  })
}
