import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Netcore</title>
  </head>
  <body>
    <main>
      <h1>Join the community shaping the future of Agentic Marketing here.</h1>
      <p>Support Login English Portuguese</p>
      <p>Please wait while you are redirected to the right page...</p>
    </main>
  </body>
</html>
`

const currentOfficialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Netcore</title>
  </head>
  <body>
    <main>
      <p>Netcore Cloud is now Netcore.ai</p>
      <p>Please wait while you are redirected to the right page...</p>
      <a href="/careers/">Careers</a>
    </main>
  </body>
</html>
`

const redirectShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers list - Netcore</title>
  </head>
  <body>
    <section>
      <p>Support Login English Portuguese</p>
      <p>Please wait while you are redirected to the right page...</p>
      <img alt="loading" src="/loading.gif">
    </section>
  </body>
</html>
`

const forbiddenHtml = `
<html>
  <head>
    <title>Error 403 Forbidden</title>
  </head>
  <body>
    <h1>403 Forbidden</h1>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Netcore Cloud Jobs</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="/apply/senior-platform-engineer">Apply now</a>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Senior Platform Engineer" }
    </script>
  </body>
</html>
`

const loadNetcoreCloudModule = async () => {
  try {
    return await import('../../scraper/netcorecloud/script.js')
  } catch {
    assert.fail('Expected Netcore Cloud scraper module at ../../scraper/netcorecloud/script.js')
  }
}

test('Netcore rejects obsolete careers shells, generic pages and forbidden responses', async () => {
  const n = await loadNetcoreCloudModule()
  for (const html of [officialCareersHtml, currentOfficialCareersHtml, redirectShellHtml, publicJobsHtml, forbiddenHtml]) {
    await assert.rejects(n.run({fetchPage: async url => ({status:200,url,html})}), /unavailable|handoff/i)
  }
})
