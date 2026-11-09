import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = String.raw`
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at AjnaLens | Join the Future of XR</title>
    <meta name="description" content="Build a transformative career at AjnaLens. Explore open opportunities, join our XR innovation journey, and help shape the future of immersive technology.">
  </head>
  <body>
    <nav aria-label="Main Navigation">
      <a href="/">Home</a>
      <a href="/company">Company</a>
      <a href="/careers">Career</a>
    </nav>

    <main>
      <h1>Build Technology That Outlives You</h1>
    </main>

    <script>self.__next_f.push([1,"22:[\"$\",\"$L2b\",null,{\"data\":{\"id\":1,\"title\":null,\"description\":null,\"openings_list\":[{\"id\":3,\"careeers\":[{\"id\":33,\"documentId\":\"o2su8wgzmnsgv6fetoy8p855\",\"ttile\":\"Product Researcher\",\"slug\":\"product-researcher\",\"experience\":\"0-4 \",\"createdAt\":\"2026-07-02T05:45:08.025Z\",\"career_category\":null}]},{\"id\":31,\"careeers\":[{\"id\":35,\"documentId\":\"renuqyc37i1hilu7fb25jkg1\",\"ttile\":\"Full Stack Developer\",\"slug\":\"full-stack-developer\",\"experience\":\"0–5\",\"createdAt\":\"2026-07-02T06:31:09.596Z\",\"career_category\":null}]}],\"cta\":{\"id\":44,\"title\":null,\"url\":null,\"external\":null}}}]")</script>
    <script>self.__next_f.push([1,"24:[\"$\",\"$L2d\",null,{\"data\":{\"id\":44,\"sub_title\":\"Submit your resume and explore opportunities to work on meaningful and impactful projects\",\"title\":\"Start Your Journey With Us\",\"slider\":[]},\"isCareer\":true}]")</script>
    <script>self.__next_f.push([1,"25:[\"$\",\"$L2e\",null,{\"data\":{\"id\":1,\"description\":\"Still curious? If you have questions that aren’t covered here, feel free to reach out to us at our careers email. We’d be happy to help.\",\"title\":\"Frequently Asked Questions\",\"list\":[{\"id\":1,\"answers\":\"Our hiring journey is fairly simple and transparent.\",\"question\":\"What does your hiring process look like?\"},{\"id\":2,\"answers\":\"You can apply directly through the Careers section on our website. Browse through the open roles, choose the one that aligns with your skills, and submit your application.\",\"question\":\"How can I apply for a job at AjnaLens?\"},{\"id\":4,\"answers\":\"Our teams currently work from the office. Many of the projects we work on require close collaboration, quick discussions, and hands-on development.\",\"question\":\"What is your working model?\"}]}}]")</script>
    <script>self.__next_f.push([1,"26:[\"$\",\"section\",null,{\"children\":[[\"$\",\"span\",null,{\"children\":\"Subscribe to job alert\"}],[\"$\",\"p\",null,{\"children\":\"Subscribe to get notifications when new job openings are published\"}],[\"$\",\"button\",null,{\"children\":\"Submit\"}]]}]")</script>
  </body>
</html>
`

const missingDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="robots" content="noindex">
    <title>404: This page could not be found.</title>
    <title>AjnaLens</title>
  </head>
  <body>
    <h1>404</h1>
    <h2>This page could not be found.</h2>
  </body>
</html>
`

const originUnreachableHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ajnalens.com | 523: Origin is unreachable</title>
  </head>
  <body>
    <h1>523</h1>
    <p>Origin is unreachable</p>
  </body>
</html>
`

const loadAjnaLensModule = async () => {
  try {
    return await import('../../scraper/ajnalens/script.js')
  } catch {
    assert.fail('Expected AjnaLens scraper module at ../../scraper/ajnalens/script.js')
  }
}

test('AjnaLens constants stay pinned to the verified first-party careers surface from July 15, 2026', async () => {
  const ajnaLens = await loadAjnaLensModule()

  assert.equal(ajnaLens.SOURCE, 'ajnalens')
  assert.equal(ajnaLens.COMPANY, 'AjnaLens')
  assert.equal(ajnaLens.OFFICIAL_BRAND_NAME, 'AjnaLens')
  assert.equal(ajnaLens.VERIFIED_ON, '2026-07-15')
  assert.equal(ajnaLens.HOMEPAGE_URL, 'https://ajnalens.com/')
  assert.equal(ajnaLens.CAREERS_URL, 'https://ajnalens.com/careers')
  assert.equal(ajnaLens.APPLICATION_URL, 'https://ajnalens.com/careers')
  assert.equal(
    ajnaLens.buildRoleDetailUrl('full-stack-developer'),
    'https://ajnalens.com/careers/full-stack-developer',
  )
  assert.match(ajnaLens.VERIFIED_SURFACE_SUMMARY, /two inline public openings/i)
  assert.equal(ajnaLens.hasOfficialCareersSurface(careersHtml), true)
  assert.deepEqual(ajnaLens.extractEmbeddedRoles(careersHtml), [
    {
      id: '33',
      title: 'Product Researcher',
      slug: 'product-researcher',
      experience: '0-4',
      postingDate: '2026-07-02T05:45:08.025Z',
    },
    {
      id: '35',
      title: 'Full Stack Developer',
      slug: 'full-stack-developer',
      experience: '0-5',
      postingDate: '2026-07-02T06:31:09.596Z',
    },
  ])
  assert.equal(
    ajnaLens.isVerifiedMissingDetailRoute({
      status: 404,
      url: ajnaLens.buildRoleDetailUrl('product-researcher'),
      html: missingDetailHtml,
    }),
    true,
  )
})

test('extractOpenPositions maps AjnaLens embedded inline openings into the shared job shape', async () => {
  const ajnaLens = await loadAjnaLensModule()
  const jobs = ajnaLens.extractOpenPositions(careersHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Product Researcher',
      company: 'AjnaLens',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: '33',
      requisitionId: '33',
      sourceUrl: 'https://ajnalens.com/careers',
      applyUrl: 'https://ajnalens.com/careers',
      employmentType: null,
      experienceRequired: '0-4',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-02T05:45:08.025Z',
      closingDate: null,
      jobDescription: 'Apply via the shared first-party careers page on https://ajnalens.com/careers. AjnaLens currently states its teams work from the office.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Full Stack Developer',
      company: 'AjnaLens',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: '35',
      requisitionId: '35',
      sourceUrl: 'https://ajnalens.com/careers',
      applyUrl: 'https://ajnalens.com/careers',
      employmentType: null,
      experienceRequired: '0-5',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-02T06:31:09.596Z',
      closingDate: null,
      jobDescription: 'Apply via the shared first-party careers page on https://ajnalens.com/careers. AjnaLens currently states its teams work from the office.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run fetches the verified AjnaLens careers page and confirms the current slug detail routes remain missing', async () => {
  const ajnaLens = await loadAjnaLensModule()
  const requestedUrls = []

  const jobs = await ajnaLens.createAjnaLensScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ajnaLens.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === ajnaLens.buildRoleDetailUrl('product-researcher')) {
        return { status: 404, url, html: missingDetailHtml }
      }

      if (url === ajnaLens.buildRoleDetailUrl('full-stack-developer')) {
        return { status: 404, url, html: missingDetailHtml }
      }

      throw new Error(`Unexpected AjnaLens URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ajnaLens.CAREERS_URL,
    ajnaLens.buildRoleDetailUrl('product-researcher'),
    ajnaLens.buildRoleDetailUrl('full-stack-developer'),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'ajnalens')
  assert.equal(jobs[0].link, 'https://ajnalens.com/careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
})

test('run fails closed when the verified AjnaLens careers surface or missing detail routes drift', async () => {
  const ajnaLens = await loadAjnaLensModule()

  await assert.rejects(
    ajnaLens.createAjnaLensScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: ajnaLens.CAREERS_URL,
        html: '<html><body><h1>Careers</h1><p>No openings payload</p></body></html>',
      }),
    }),
    /verified AjnaLens careers surface/i,
  )

  await assert.rejects(
    ajnaLens.createAjnaLensScraper().run({
      fetchPage: async (url) => {
        if (url === ajnaLens.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Product Researcher</h1><a href="https://ajnalens.com/careers">Apply now</a></body></html>',
        }
      },
    }),
    /verified missing role detail route/i,
  )
})

test('run marks AjnaLens origin-unreachable outages as upstream soft failures', async () => {
  const ajnaLens = await loadAjnaLensModule()

  await assert.rejects(
    ajnaLens.createAjnaLensScraper().run({
      fetchPage: async (url) => {
        assert.equal(url, ajnaLens.CAREERS_URL)
        return {
          status: 523,
          url,
          html: originUnreachableHtml,
        }
      },
    }),
    (error) => {
      assert.match(error.message, /origin is unreachable/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      return true
    },
  )
})
