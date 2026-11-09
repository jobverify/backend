import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>IT Companies in Pune for Freshers | Experience</title>
  </head>
  <body>
    <h1 class="main-heading">Current Openings</h1>
    <p>apply to any of the jobs below or email us your updated resume at <a href="mailto:ta@iprogrammer.co">ta@iprogrammer.co</a>.</p>
    <div class="elementor-widget-wrap">
      <h4 class="elementor-heading-title"><a href="/current-opening/devops-engineer/">DevOps Engineer</a></h4>
      <p>We are looking for a DevOps Engineer with 3+ years of experience in infrastructure automation and cloud environments.</p>
      <span><strong>Experience</strong> : 3+ Years</span>
      <span><strong>Vacancies</strong> : 01</span>
      <span><strong>Job Location</strong> : Pune</span>
      <span><strong>Work Mode</strong> : Work from Office</span>
    </div>
    <div class="elementor-widget-wrap">
      <h4 class="elementor-heading-title"><a href="/current-opening/odoo-qa-engineer/">Odoo QA Engineer</a></h4>
      <p>We are looking for an experienced Odoo QA Engineer with 4+ years of experience in ERP application testing.</p>
      <span><strong>Experience</strong> : 4+ Years</span>
      <span><strong>Vacancies</strong> : 01</span>
      <span><strong>Job Location</strong> : Pune</span>
      <span><strong>Work Mode</strong> : Hybrid</span>
    </div>
    <div class="elementor-widget-wrap">
      <h4 class="elementor-heading-title"><a href="/current-opening/lead-nodejs-engineer/">Lead NodeJS Engineer</a></h4>
      <p>We are looking for an experienced Lead NodeJS Engineer to architect and deliver high-quality, scalable backend systems.</p>
      <span><strong>Experience</strong> : 5+ Years</span>
      <span><strong>Vacancies</strong> : 01</span>
      <span><strong>Job Location</strong> : Pune</span>
      <span><strong>Work Mode</strong> : Work from Office</span>
    </div>
    <div class="elementor-widget-wrap">
      <h4 class="elementor-heading-title"><a href="/current-opening/reactjs-developer/">ReactJS Developer</a></h4>
      <p>We are looking for a ReactJS Developer with 4+ years of experience in building responsive and scalable web applications.</p>
      <span><strong>Experience</strong> : 4+ Years</span>
      <span><strong>Vacancies</strong> : 02</span>
      <span><strong>Job Location</strong> : Pune</span>
      <span><strong>Work Mode</strong> : Work from Office</span>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/iprogrammersolutions/script.js')
  } catch {
    assert.fail('Expected Iprogrammer Solutions scraper module at ../../scraper/iprogrammersolutions/script.js')
  }
}

test('Iprogrammer Solutions helpers stay pinned to the verified first-party openings page', async () => {
  const iprogrammer = await loadModule()

  assert.equal(iprogrammer.hasVerifiedOpeningsSignal(CAREERS_HTML), true)
  assert.deepEqual(
    iprogrammer.extractJobs(CAREERS_HTML).map((job) => ({
      title: job.title,
      location: job.location,
      experienceRequired: job.experienceRequired,
      vacancies: job.vacancies,
      remoteStatus: job.remoteStatus,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'DevOps Engineer',
        location: 'Pune, India',
        experienceRequired: '3+ Years',
        vacancies: '01',
        remoteStatus: 'On-site',
        sourceUrl: 'https://iprogrammer.com/current-opening/devops-engineer/',
      },
      {
        title: 'Odoo QA Engineer',
        location: 'Pune, India',
        experienceRequired: '4+ Years',
        vacancies: '01',
        remoteStatus: 'Hybrid',
        sourceUrl: 'https://iprogrammer.com/current-opening/odoo-qa-engineer/',
      },
      {
        title: 'Lead NodeJS Engineer',
        location: 'Pune, India',
        experienceRequired: '5+ Years',
        vacancies: '01',
        remoteStatus: 'On-site',
        sourceUrl: 'https://iprogrammer.com/current-opening/lead-nodejs-engineer/',
      },
      {
        title: 'ReactJS Developer',
        location: 'Pune, India',
        experienceRequired: '4+ Years',
        vacancies: '02',
        remoteStatus: 'On-site',
        sourceUrl: 'https://iprogrammer.com/current-opening/reactjs-developer/',
      },
    ],
  )
})

test('Iprogrammer Solutions run validates the openings page and decorates extracted jobs', async () => {
  const iprogrammer = await loadModule()
  const requestedUrls = []

  const jobs = await iprogrammer.createIprogrammerSolutionsScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return CAREERS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [iprogrammer.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'iprogrammersolutions')
  assert.equal(jobs[0].applyUrl, 'https://iprogrammer.com/current-opening/devops-engineer/')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Iprogrammer Solutions fails closed when the verified openings page drifts', async () => {
  const iprogrammer = await loadModule()

  await assert.rejects(
    iprogrammer.createIprogrammerSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified iProgrammer Solutions openings surface/i,
  )
})
