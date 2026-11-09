import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AJAX_URL,
  CAREER_PAGE_URL,
  buildAjaxRequestBody,
  create247AiScraper,
  extractPageConfig,
} from './script.js'

const pageHtml = `
<div
  id="ymc-smart-filter-container-1"
  data-params='{"cpt":"career","tax":"area-of-interest","terms":"209,210","filter_id":"42238","target_id":"1","page":"1","page_id":"42554","per_page":"10"}'>
</div>
<script>
var _smart_filter_object = {"ajax_url":"https://www.247.ai/wp-admin/admin-ajax.php","nonce":"3766217669","current_page":"1","path":"https://www.247.ai/wp-content/plugins/ymc-smart-filter/"}
</script>
`

test('uses the official 24 7.ai careers page and WordPress smart-filter AJAX endpoint', () => {
  const config = extractPageConfig(pageHtml)

  assert.equal(CAREER_PAGE_URL, 'https://www.247.ai/jobs/')
  assert.equal(AJAX_URL, 'https://www.247.ai/wp-admin/admin-ajax.php')
  assert.deepEqual(config, {
    ajaxUrl: AJAX_URL,
    nonce: '3766217669',
    params: {
      cpt: 'career',
      tax: 'area-of-interest',
      terms: '209,210',
      filter_id: '42238',
      target_id: '1',
      page: '1',
      page_id: '42554',
      per_page: '10',
    },
  })
})

test('run submits the smart-filter AJAX request and returns India jobs with scraper metadata', async () => {
  const requests = []
  const scraper = create247AiScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push({ type: 'page', url })
      return pageHtml
    },
    fetchJson: async (url, body) => {
      requests.push({ type: 'ajax', url, body })
      return {
        data: `
          <article class="ymc-post-layout1 post-45009 post-item ">
            <header class="title">
              <a class="media-link " data-postid="45009" target=_self href="https://www.247.ai/career/staff-devops-engineer/">Staff Devops Engineer</a>
            </header>
            <div class="excerpt">Bangalore, India | Hybrid | Experience: 5+ years</div>
          </article>
          <article class="ymc-post-layout1 post-45010 post-item ">
            <header class="title">
              <a class="media-link " data-postid="45010" target=_self href="https://www.247.ai/career/customer-success-manager/">Customer Success Manager</a>
            </header>
            <div class="excerpt">Austin, Texas, United States | Full-time | Experience: 8+ years</div>
          </article>
        `,
      }
    },
  })

  assert.deepEqual(requests, [
    { type: 'page', url: CAREER_PAGE_URL },
    {
      type: 'ajax',
      url: AJAX_URL,
      body: buildAjaxRequestBody({
        params: {
          cpt: 'career',
          tax: 'area-of-interest',
          terms: '209,210',
          filter_id: '42238',
          target_id: '1',
          page: '1',
          page_id: '42554',
          per_page: '10',
        },
        nonce: '3766217669',
        paged: 1,
      }),
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Staff Devops Engineer')
  assert.equal(jobs[0].company, '[24]7.ai')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].source, '247ai')
  assert.equal(jobs[0].link, 'https://www.247.ai/career/staff-devops-engineer/')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
