export const zohoSourceSpecs = {
  agilisium: { source: 'agilisium', company: 'Agilisium', nativeName: 'Agilisium', orgId: '589705000000313622', pageId: '589705000000471052', domain: 'agilisium.com', board: 'https://agilisium.zohorecruit.com/jobs/Careers', official: 'https://www.agilisium.com/people-and-careers', dateFormat: 'MM/dd/yyyy' },
  npci: { source: 'npci', company: 'National Payments Corporation of India', nativeName: 'National Payments Corporation of India (NPCI)', orgId: '190737000000336525', pageId: '190737000000336688', domain: 'npci.org.in', board: 'https://careers.npci.org.in/jobs/Careers', dateFormat: 'dd/MM/yyyy' },
  fasal: { source: 'fasal', company: 'Fasal', nativeName: 'Wolkus Technology Solutions Private Limited', orgId: '622955000000340005', pageId: '622955000000340237', domain: 'fasal.co', board: 'https://jobs.fasal.co/jobs/Careers', official: 'https://www.fasal.co/life-at-fasal', dateFormat: 'MM/dd/yyyy' },
  yellowmessenger: { source: 'yellowmessenger', company: 'Yellow Messenger', nativeName: 'Yellow.ai', orgId: '157454000000312523', pageId: '157454000000312673', domain: 'yellow.ai', board: 'https://careers.yellow.ai/jobs/Careers', official: 'https://yellow.ai/career/', dateFormat: 'MM/dd/yyyy', embed: true },
  centilytics: { source: 'centilytics', company: 'Centilytics', nativeName: 'Centilytics', orgId: '592387000000320468', pageId: '592387000000320936', domain: 'centilytics.com', board: 'https://jobs.centilytics.com/jobs/Careers', dateFormat: 'MM/dd/yyyy', organizationType: 'staffing' },
}
const attr = value => JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
export const zohoBoardHtml = (meta, rows) => `<title>Jobs at ${meta.org_info.company_name}</title><input type="hidden" id="meta" value="${attr(meta)}"><input type="hidden" id="jobs" value="${attr(rows)}">`
export const makeZohoFixture = (source = 'agilisium') => {
  const spec = zohoSourceSpecs[source], id = '123456789012345678'
  const row = { id, Posting_Title: 'Platform Engineer', Job_Opening_Name: 'Platform Engineer', City: 'Mumbai', State: 'Maharashtra',
    ...(source === 'npci' ? {} : { Country: 'India' }), Remote_Job: 'No', Publish: true, Is_Locked: false,
    Keep_on_Career_Site: false, Date_Opened: source === 'npci' ? '24/10/2026' : '10/24/2026', Job_Description: 'Listing summary only.',
    $url: `${spec.board}/${id}/Platform-Engineer?source=CareerSite` }
  const meta = { source: 'CareerSite', list_url: spec.board, page_name: 'Careers', page_id: spec.pageId, date_format: spec.dateFormat,
    employee_portal: false, org_info: { id: spec.orgId, company_name: spec.nativeName, website: spec.embed ? '' : `https://${spec.domain}/`, type: spec.organizationType || 'internal', hide_company_name: false } }
  const detail = { ...row, Date_Opened: '2026-10-24', Remote_Job: false, ...(source === 'npci' ? { Entity: 'NPCI', Group: 'Digital', Client_Name: { name: 'Technology', id: '123' } } : {}),
    Job_Description: '<h2>Responsibilities</h2><p>Build and maintain reliable payment infrastructure.</p><h2>Requirements</h2><p>Strong JavaScript, databases and distributed systems experience.</p>',
    $appy_url: `${spec.board}/${id}/Platform-Engineer?$apply=true&source=CareerSite` }
  if (source === 'centilytics') detail.Client_Name = { id: '592387000000320470', name: 'Centilytics' }
  const homepage = spec.embed ? `<div id="rec_job_listing_div"></div><script src="https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js"></script><script>rec_embed_js.load({widget_id:'rec_job_listing_div',page_name:'Careers',source:'CareerSite',site:'https://careers.yellow.ai'});</script>` : `<a href="${spec.board}">View current openings</a>`
  return { spec, meta, rows: [row], details: { [id]: detail }, homepage, requests: [] }
}
export const zohoFixtureOptions = data => ({
  now: () => '2026-10-26T10:00:00.000Z', detailConcurrency: 1,
  fetchText: async () => { throw new Error('Legacy listing-only runtime called') },
  fetchPage: async (url, init = {}) => {
    init.signal?.throwIfAborted(); data.requests.push(url)
    if (url === data.spec.official) return { status: 200, url, html: data.homepage }
    if (url === data.spec.board) return { status: 200, url, html: zohoBoardHtml(data.meta, data.boardRows || data.rows) }
    throw new Error(`Unexpected Zoho page ${url}`)
  },
  fetchJson: async (url, init = {}) => {
    init.signal?.throwIfAborted(); data.requests.push(url)
    const parsed = new URL(url)
    if (parsed.pathname.endsWith('/Job_Openings')) return { code: 'success', info: { page_name: 'Careers', ...data.apiInfo }, data: data.rows }
    const id = parsed.pathname.split('/').at(-1)
    if (data.unavailableId === id) throw new Error('Temporary native detail failure')
    if (!data.details[id]) throw new Error(`Unexpected Zoho detail ${url}`)
    return { code: 'success', data: [data.details[id]] }
  },
})
