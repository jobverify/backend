import assert from 'node:assert/strict'
import test from 'node:test'

const sucuriChallengeHtml = `
  <html><title>You are being redirected...</title>
  <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
  <script>var s={},u,c,U,r,i,l=0,a,e=eval,w=String.fromCharCode,sucuri_cloudproxy_js='',S='bT1TdHJpbmcuZnJvbUNoYXJDb2RlKDQ4KSArIFN0cmluZy5mcm9tQ2hhckNvZGUoNTMpICsgImEiICsgIjUiICsgJ2YnICsgJzQnICsgU3RyaW5nLmZyb21DaGFyQ29kZSg1MikgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKDk3KSArIFN0cmluZy5mcm9tQ2hhckNvZGUoMTAyKSArICIyIiArICdmJyArIFN0cmluZy5mcm9tQ2hhckNvZGUoOTcpICsgJzcnICsgU3RyaW5nLmZyb21DaGFyQ29kZSg5OSkgKyAnMScgKyAnZicgKyAnYScgKyAiNiIgKyAnMycgKyAiNSIgKyAiOCIgKyAiNiIgKyAiOSIgKyAiOCIgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKDQ4KSArICc5JyArICdjJyArICJlIiArIFN0cmluZy5mcm9tQ2hhckNvZGUoOTgpICsgIjkiICsgU3RyaW5nLmZyb21DaGFyQ29kZSg1MCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKDUxKSArICcnO2RvY3VtZW50LmNvb2tpZT0ncycrJ3UnKydjJysndScrJ3InKydpJysnXycrJ2MnKydsJysnbycrJ3UnKydkJysncCcrJ3InKydvJysneCcrJ3knKydfJysndScrJ3UnKydpJysnZCcrJ18nKyc3JysnNicrJ2MnKydiJysnOScrJzEnKycxJysnZScrJ2UnKyI9IiArIG0gKyAnO3BhdGg9LzttYXgtYWdlPTg2NDAwJzsgbG9jYXRpb24ucmVsb2FkKCk7';L=S.length;U=0;r='';var A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';for(u=0;u<64;u++){s[A.charAt(u)]=u;}for(i=0;i<L;i++){c=s[S.charAt(i)];U=(U<<6)+c;l+=6;while(l>=8){((a=(U>>>(l-=8))&0xff)||(i<(L-2)))&&(r+=w(a));}}e(r);</script></html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Onward Tech |  Career</title>
  </head>
  <body>
    <h2>Current Openings</h2>
    <div class="accordion-databox">
      <div class="panel">
        <div class="accordion-trigger">
          <div class="row row-cols-5 align-items-center">
            <div class="col border-end">
              <div class="d-flex align-items-center justify-content-between">
                <span class="srno">1</span>
                <span class="title">Mechanical Design Engineer</span>
              </div>
            </div>
            <div class="col border-end"><span>Jun 10, 2026</span></div>
            <div class="col border-end"><span>9550 W Higgins Road, Suite 910, Rosemont, IL, 60018, USA.</span></div>
            <div class="col border-end"><span>5+ Years</span></div>
            <div class="col"><a href="javascript:void(0);">View Job</a></div>
          </div>
        </div>
        <div class="accordion-data" id="show">
          <div class="careers-tab">
            <p>US only role.</p>
            <p>Please send your resumes to RAGHUVEER_DAYATRI@onwardgroup.com mentioning the Job Title in the subject.</p>
            <div class="d-flex align-items-center justify-content-center">
              <a href="#current" class="btn">Apply</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="accordion-databox">
      <div class="panel">
        <div class="accordion-trigger">
          <div class="row row-cols-5 align-items-center">
            <div class="col border-end">
              <div class="d-flex align-items-center justify-content-between">
                <span class="srno">2</span>
                <span class="title">Embedded - SME (Validation Automotive)</span>
              </div>
            </div>
            <div class="col border-end"><span>Dec 18, 2025</span></div>
            <div class="col border-end"><span>Pune - ATP</span></div>
            <div class="col border-end"><span>15-18 Years</span></div>
            <div class="col"><a href="javascript:void(0);">View Job</a></div>
          </div>
        </div>
        <div class="accordion-data" id="show">
          <div class="careers-tab">
            <p><strong>Job Summary:</strong></p>
            <p>We are looking for a highly experienced Embedded Systems Subject Matter Expert (SME) specializing in Validation.</p>
            <p>Please send your resumes to ketaki_karanjkar@onwardgroup.com mentioning the Job Title in the subject.</p>
            <div class="d-flex align-items-center justify-content-center">
              <a href="#current" class="btn">Apply</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="accordion-databox">
      <div class="panel">
        <div class="accordion-trigger">
          <div class="row row-cols-5 align-items-center">
            <div class="col border-end">
              <div class="d-flex align-items-center justify-content-between">
                <span class="srno">3</span>
                <span class="title">India Business Delivery Head – Automotive Digital</span>
              </div>
            </div>
            <div class="col border-end"><span>Dec 18, 2025</span></div>
            <div class="col border-end"><span>Pune - ATP / Chennai</span></div>
            <div class="col border-end"><span>20-25 Years</span></div>
            <div class="col"><a href="javascript:void(0);">View Job</a></div>
          </div>
        </div>
        <div class="accordion-data" id="show">
          <div class="careers-tab">
            <p><strong>Role Overview:</strong></p>
            <p>The India Delivery Head – Automotive Digital will lead the delivery and operations for GCC-driven automotive digital programs.</p>
            <p>Please send your resumes to ketaki_karanjkar@onwardgroup.com mentioning the Job Title in the subject.</p>
            <div class="d-flex align-items-center justify-content-center">
              <a href="#current" class="btn">Apply</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/onwardtechnologies/script.js')
  } catch {
    assert.fail('Expected Onward Technologies scraper module at ../../scraper/onwardtechnologies/script.js')
  }
}

test('Onward Technologies pins the verified careers page and Sucuri challenge behavior', async () => {
  const onwardTechnologies = await loadScriptModule()

  assert.equal(onwardTechnologies.SOURCE, 'onwardtechnologies')
  assert.equal(onwardTechnologies.COMPANY, 'Onward Technologies')
  assert.equal(onwardTechnologies.OFFICIAL_BRAND_NAME, 'Onward Tech')
  assert.equal(onwardTechnologies.VERIFIED_ON, '2026-07-17')
  assert.equal(onwardTechnologies.CAREERS_PAGE_URL, 'https://www.onwardgroup.com/careers.php')
  assert.equal(onwardTechnologies.hasSucuriChallengeSignal(sucuriChallengeHtml), true)
  assert.equal(onwardTechnologies.hasOfficialCareersPageSignal(careersPageHtml), true)

  const cookie = onwardTechnologies.extractSucuriCookie(sucuriChallengeHtml)
  assert.match(cookie, /^sucuri_cloudproxy_uuid_[a-z0-9]+=.+$/i)
})

test('defaultFetchText accepts the live 307 Sucuri interstitial body for the verified careers page', async () => {
  const onwardTechnologies = await loadScriptModule()
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    ok: false,
    status: 307,
    text: async () => sucuriChallengeHtml,
  })

  try {
    const html = await onwardTechnologies.defaultFetchText(onwardTechnologies.CAREERS_PAGE_URL)
    assert.equal(html, sucuriChallengeHtml)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('extractIndiaJobs keeps only India listings from the verified Onward Technologies careers accordion', async () => {
  const onwardTechnologies = await loadScriptModule()
  const jobs = onwardTechnologies.extractIndiaJobs(careersPageHtml)

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      experienceRequired: job.experienceRequired,
      applyUrl: job.applyUrl,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Embedded - SME (Validation Automotive)',
        location: 'Pune - ATP',
        city: 'Pune',
        country: 'India',
        experienceRequired: '15-18 Years',
        applyUrl: 'mailto:ketaki_karanjkar@onwardgroup.com?subject=Embedded%20-%20SME%20(Validation%20Automotive)',
        sourceUrl: 'https://www.onwardgroup.com/careers.php',
      },
      {
        title: 'India Business Delivery Head - Automotive Digital',
        location: 'Pune - ATP / Chennai',
        city: null,
        country: 'India',
        experienceRequired: '20-25 Years',
        applyUrl: 'mailto:ketaki_karanjkar@onwardgroup.com?subject=India%20Business%20Delivery%20Head%20-%20Automotive%20Digital',
        sourceUrl: 'https://www.onwardgroup.com/careers.php',
      },
    ],
  )
})

test('run solves the verified Sucuri gate, validates the official careers page, and decorates India jobs', async () => {
  const onwardTechnologies = await loadScriptModule()
  const requests = []

  const jobs = await onwardTechnologies.createOnwardTechnologiesScraper().run({
    fetchText: async (url, options = {}) => {
      requests.push({
        url,
        cookie: options?.headers?.Cookie ?? options?.headers?.cookie ?? null,
      })

      if (requests.length === 1) return sucuriChallengeHtml
      if (requests.length === 2 && requests[1].cookie) return careersPageHtml

      throw new Error(`Unexpected request #${requests.length} for ${url}`)
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, onwardTechnologies.CAREERS_PAGE_URL)
  assert.equal(requests[0].cookie, null)
  assert.match(requests[1].cookie, /^sucuri_cloudproxy_uuid_[a-z0-9]+=.+$/i)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'onwardtechnologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-17T00:00:00.000Z')
})

test('run fails closed when the Onward Technologies careers surface changes materially after the Sucuri handoff', async () => {
  const onwardTechnologies = await loadScriptModule()

  await assert.rejects(
    onwardTechnologies.createOnwardTechnologiesScraper().run({
      fetchText: async (url, options = {}) => {
        if (!(options?.headers?.Cookie ?? options?.headers?.cookie)) return sucuriChallengeHtml
        return '<html><body><h1>Unexpected page</h1></body></html>'
      },
    }),
    /official Onward Technologies careers page/i,
  )
})
