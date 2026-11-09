import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/kodnest/fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const verifiedBundleJs = readFixture('bundle.js')

const loadModule = async () => {
  try {
    return await import('../../scraper/kodnest/script.js')
  } catch {
    assert.fail('Expected KodNest scraper module at ../../scraper/kodnest/script.js')
  }
}

test('KodNest validates the verified homepage shell, careers shell, and no-careers bundle contract', async () => {
  const kodnest = await loadModule()

  assert.equal(kodnest.SOURCE, 'kodnest')
  assert.equal(kodnest.COMPANY, 'KodNest')
  assert.equal(kodnest.HOMEPAGE_URL, 'https://www.kodnest.com/')
  assert.deepEqual(kodnest.CAREERS_ROUTE_URLS, [
    'https://www.kodnest.com/careers',
    'https://www.kodnest.com/careers/',
  ])
  assert.equal(kodnest.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(kodnest.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(kodnest.extractBundleAssetPath(verifiedHomepageHtml), '/assets/index-gPB9h3F3.js')
  assert.equal(kodnest.hasVerifiedBundleSignal(verifiedBundleJs), true)
  assert.equal(
    kodnest.routeMatchesVerifiedShell(
      verifiedCareersHtml,
      kodnest.extractBundleAssetPath(verifiedHomepageHtml),
    ),
    true,
  )
})

test('KodNest returns no jobs only while the verified homepage shell, careers shell, and bundle contract remain unchanged', async () => {
  const kodnest = await loadModule()
  const requestedPages = []
  const requestedText = []

  const jobs = await kodnest.createKodNestScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === kodnest.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (kodnest.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCareersHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedText.push(url)

      if (url === 'https://www.kodnest.com/assets/index-gPB9h3F3.js') {
        return verifiedBundleJs
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    kodnest.HOMEPAGE_URL,
    ...kodnest.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(requestedText, ['https://www.kodnest.com/assets/index-gPB9h3F3.js'])
  assert.deepEqual(jobs, [])
})

test('KodNest fails closed when the homepage shell, careers shell, or bundle no-careers contract changes', async () => {
  const kodnest = await loadModule()

  await assert.rejects(
    kodnest.createKodNestScraper().run({
      fetchPage: async (url) => {
        if (url === kodnest.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><head><title>Unexpected</title></head><body></body></html>',
          }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCareersHtml,
        }
      },
      fetchText: async () => verifiedBundleJs,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kodnest.createKodNestScraper().run({
      fetchPage: async (url) => {
        if (url === kodnest.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml,
          }
        }

        if (url === kodnest.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/full-stack-trainer">Apply now</a></body></html>',
          }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: verifiedCareersHtml,
        }
      },
      fetchText: async () => verifiedBundleJs,
    }),
    /careers routes changed materially or now expose public jobs/i,
  )

  await assert.rejects(
    kodnest.createKodNestScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        headers: {},
        html: url === kodnest.HOMEPAGE_URL ? verifiedHomepageHtml : verifiedCareersHtml,
      }),
      fetchText: async () =>
        'const redirects=[{from:"/careers",to:"/join-our-team",action:"301",note:"P0: careers live"}];',
    }),
    /client bundle changed materially or no longer confirms the verified no-careers route contract/i,
  )
})

const publicAnonToken = (role = 'anon', ref = 'copqjvapsjgzgzxfsrrf') => [
  Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role, ref })).toString('base64url'),
  'public-test-signature',
].join('.')
const currentBundle = (token = publicAnonToken(), origin = 'https://copqjvapsjgzgzxfsrrf.supabase.co') =>
  verifiedBundleJs + '\nconst assets=["assets/CareerHub-current.js","assets/careers-current.js"]; const url="' + origin + '",key="' + token + '";'
const currentHubModule = 'Careers at KodNest canonical:"https://kodnest.com/career" to:`/career/${job.slug}`'
const currentCareersModule = 'client.from("career_jobs").select("*").eq("status","published").order("published_at",{ascending:false})'
const currentHome = verifiedHomepageHtml.replace(/<script[^>]*>[\s\S]*?connect\.facebook\.net[\s\S]*?<\/script>/i, '')

test('KodNest accepts its branded shell without a tracking pixel', async () => {
  const kodnest = await loadModule()
  assert.equal(kodnest.hasOfficialHomepageSignal(currentHome), true)
})

test('KodNest reads the current public careers feed before the obsolete no-careers bundle contract and excludes closed and foreign jobs', async () => {
  const kodnest = await loadModule()
  const requests = []
  const scraper = kodnest.createKodNestScraper({ now: () => '2026-10-03T00:00:00.000Z', pageSize: 2 })
  const jobs = await scraper.run({
    fetchPage: async (url) => ({ status: 200, url, html: currentHome, headers: {} }),
    fetchText: async (url) => url.endsWith('careers-current.js') ? currentCareersModule : url.endsWith('CareerHub-current.js') ? currentHubModule : currentBundle(),
    fetchJson: async (url, options) => {
      requests.push({ url, options })
      const offset = Number(new URL(url).searchParams.get('offset'))
      return offset === 0 ? [
        { id: 'active', slug: 'academic-developer', title: 'Academic Developer', status: 'published', location_label: 'Bengaluru · On-site', employment_type: 'full_time', summary: 'Teach developers.', jd_markdown: 'Review projects.', requirements: ['Java'], published_at: '2026-07-18T00:00:00Z', closes_at: null },
        { id: 'closed', slug: 'closed', title: 'Expired internship', status: 'published', location_label: 'Bengaluru', closes_at: '2026-09-20T00:00:00Z' },
      ] : [
        { id: 'foreign', slug: 'foreign', title: 'US developer', status: 'published', location_label: 'San Francisco', closes_at: null },
      ]
    },
  })
  assert.equal(requests.length, 2)
  assert.equal(new URL(requests[0].url).pathname, '/rest/v1/career_jobs')
  assert.equal(new URL(requests[1].url).searchParams.get('offset'), '2')
  assert.equal(requests[0].options.headers.apikey, publicAnonToken())
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Academic Developer')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, 'https://kodnest.com/career/academic-developer')
  assert.match(jobs[0].jobDescription, /Review projects/)
  assert.equal(jobs[0].closingDate, null)
})

for (const [label, bundle, feed] of [
  ['unverified backend', currentBundle(publicAnonToken(), 'https://otherproject.supabase.co'), []],
  ['non-public token', currentBundle(publicAnonToken('service_role')), []],
  ['malformed feed', currentBundle(), { error: 'not a jobs array' }],
]) {
  test('KodNest fails closed for a ' + label, async () => {
    const kodnest = await loadModule()
    await assert.rejects(kodnest.createKodNestScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: verifiedHomepageHtml, headers: {} }),
      fetchText: async (url) => url.endsWith('careers-current.js') ? currentCareersModule : url.endsWith('CareerHub-current.js') ? currentHubModule : bundle,
      fetchJson: async () => feed,
    }), /verified public careers|careers feed/i)
  })
}

const octoberHomepage = readFixture('homepage-20261009.html')
test('KodNest accepts the current Career Outcome Engine identity while retaining the verified public careers feed', async () => {
  const kodnest = await loadModule()
  assert.equal(kodnest.hasOfficialHomepageSignal(octoberHomepage), true)
  for (const html of [octoberHomepage.replaceAll('KodNest','Other'),octoberHomepage.replaceAll('https://kodnest.com','https://example.com'),octoberHomepage.replaceAll('Career Outcome Engine','Unverified')]) assert.equal(kodnest.hasOfficialHomepageSignal(html), false)
  const jobs=await kodnest.createKodNestScraper({now:()=> '2026-10-09T00:00:00Z'}).run({
    fetchPage:async url=>({status:200,url,html:octoberHomepage}),
    fetchText:async url=>url.endsWith('careers-current.js')?currentCareersModule:url.endsWith('CareerHub-current.js')?currentHubModule:currentBundle(),
    fetchJson:async()=>[{id:'current',slug:'academic-developer',title:'Academic Developer',status:'published',location_label:'Bengaluru · On-site',summary:'Build careers.',published_at:'2026-07-18T00:00:00Z',closes_at:null}],
  })
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].jobId,'kodnest-current')
})
