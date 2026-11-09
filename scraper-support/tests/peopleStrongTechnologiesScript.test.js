import assert from 'node:assert/strict'
import test from 'node:test'

const PORTAL_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
    <link rel="stylesheet" href="assets/css/styles_v2.css">
  </head>
  <body>
    <app-root></app-root>
    <script src="main-P36U4EY7.js"></script>
  </body>
</html>
`

const BROKEN_API_TEXT = `
{"response":null,"messageCode":{"code":201,"messages":[{"message":"WFLYEE0086: Could not find method getRequisitionListWithPaginationBySolrBundle (JLjava/lang/Long;Lcom/talentpact/ats/common/transport/input/RequisitionFilterTO;Ljava/lang/String;IIILjava/util/List;Ljava/lang/String;)"}]}}
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/peoplestrongtechnologies/script.js')
  } catch {
    assert.fail('Expected PeopleStrong Technologies scraper module at ../../scraper/peoplestrongtechnologies/script.js')
  }
}

test('PeopleStrong Technologies helper sentinels stay pinned to the portal shell and broken jobs API', async () => {
  const peopleStrong = await loadScriptModule()

  assert.equal(peopleStrong.hasPublicPortalShell(PORTAL_SHELL_HTML), true)
  assert.equal(peopleStrong.hasBrokenJobsApiSignal(BROKEN_API_TEXT), true)
})

test('PeopleStrong Technologies rejects a broken jobs API instead of claiming verified empty inventory', async () => {
  const peopleStrong = await loadScriptModule()
  const requestedUrls = []

  await assert.rejects(peopleStrong.createPeopleStrongTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === peopleStrong.HOMEPAGE_URL || url === peopleStrong.SAMPLE_JOB_DETAIL_URL) {
        return { status: 200, url, html: PORTAL_SHELL_HTML }
      }
      if (url === peopleStrong.JOB_LIST_URL || url === peopleStrong.ALTERNATE_JOB_LIST_URL) {
        return { status: 404, url, html: PORTAL_SHELL_HTML }
      }
      throw new Error(`Unexpected PeopleStrong page URL: ${url}`)
    },
    fetchApiText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, peopleStrong.JOBS_API_URL)
      return { status: 200, text: BROKEN_API_TEXT }
    },
  }), /broken method payload/i)
  assert.deepEqual(requestedUrls, [
    peopleStrong.HOMEPAGE_URL,
    peopleStrong.JOB_LIST_URL,
    peopleStrong.ALTERNATE_JOB_LIST_URL,
    peopleStrong.SAMPLE_JOB_DETAIL_URL,
    peopleStrong.JOBS_API_URL,
  ])
})

test('PeopleStrong Technologies fails closed when the portal shell drifts materially', async () => {
  const peopleStrong = await loadScriptModule()

  await assert.rejects(
    peopleStrong.createPeopleStrongTechnologiesScraper().run({
      fetchPage: async () => ({ status: 200, url: peopleStrong.HOMEPAGE_URL, html: '<html><body>Unexpected</body></html>' }),
      fetchApiText: async () => ({ status: 200, text: BROKEN_API_TEXT }),
    }),
    /verified public portal shell/i,
  )
})
