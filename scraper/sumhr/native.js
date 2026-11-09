import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
export const ATS_URL = 'https://sumhr.hire.trakstar.com/'
const fail = message => { throw new Error('SumHR native inventory: ' + message) }
const decode = value => value.replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
const text = html => decode(html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
function activePage(html, allowApplicationReveal = false) {
  const doc = document(html)
  const revealScript = doc.nodes(node => node.tag === 'script').some(node =>
    /function show_application_form\(/.test(node.raw || '') && /\$\('#application_form_holder'\)\.slideDown\(/.test(node.raw || '') && /\$\('#div_apply_to_job'\)\.hide\(/.test(node.raw || ''))
  const revealControl = doc.nodes(node => node.tag === 'a' && node.attrs.href === '?apply=true').length > 0
  const prune = (node, inherited = false) => {
    const a = node.attrs, style = (a.style || '').replace(/\/\*[\s\S]*?\*\//g, '')
    // Trakstar's reviewed Apply control reveals this one wrapper. The form
    // itself and every other ancestor still require active native markup.
    const nativeReveal = allowApplicationReveal && revealScript && revealControl && a.id === 'application_form_holder' && /^\s*display\s*:\s*none\s*;?\s*$/i.test(style)
    const hidden = Object.hasOwn(a, 'hidden') || Object.hasOwn(a, 'inert') || a['aria-hidden'] === 'true'
      || (!nativeReveal && /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(style))
    node.inactive = inherited || hidden || ['template', 'noscript', 'style', 'textarea', 'iframe', 'xmp', 'noembed', 'noframes', 'plaintext'].includes(node.tag)
    for (const child of node.children) if (typeof child !== 'string') prune(child, node.inactive)
  }
  prune(doc.root)
  const serialize = node => {
    if (node.inactive || node.tag === 'script') return ''
    const content = node.children.map(child => typeof child === 'string' ? child : serialize(child)).join('')
    if (node.tag === 'root') return content
    if (node.raw !== undefined) return html.slice(node.start, node.end)
    return html.slice(node.start, node.openEnd) + content + html.slice(node.closeStart ?? node.openEnd, node.end ?? node.openEnd)
  }
  return { doc, html: serialize(doc.root), scripts: doc.nodes(node => node.tag === 'script' && !node.attrs.src).map(node => ({ type: node.attrs.type, raw: node.raw || '' })) }
}
export const activeHtml = html => activePage(html).html
const attr = (html, name) => html.match(new RegExp('\\b' + name + '=["\x27]([^"\x27]*)["\x27]', 'i'))?.[1]
const classText = (html, name) => text(html.match(new RegExp('<(?:span|div|h3)\\b[^>]*class=["\x27][^"\x27]*\\b' + name + '\\b[^"\x27]*["\x27][^>]*>([\\s\\S]*?)<\\/(?:span|div|h3)>', 'i'))?.[1] || '')
const INDIA_REGIONS = /^(?:MH|Maharashtra|KA|Karnataka|TN|Tamil Nadu|TS|Telangana|AP|Andhra Pradesh|DL|Delhi|UP|Uttar Pradesh|HR|Haryana|GJ|Gujarat|WB|West Bengal|RJ|Rajasthan|KL|Kerala|MP|Madhya Pradesh|BR|Bihar|OR|OD|Odisha|PB|Punjab|CH|Chandigarh|GA|Goa|UK|UT|Uttarakhand|HP|Himachal Pradesh|JK|Jammu and Kashmir|JH|Jharkhand|CG|Chhattisgarh|AS|Assam|AR|Arunachal Pradesh|MN|Manipur|ML|Meghalaya|MZ|Mizoram|NL|Nagaland|SK|Sikkim|TR|Tripura|LA|Ladakh|PY|Puducherry)$/i
function location(html) {
  const countries = [...html.matchAll(/<span\b[^>]*class=["'][^"']*\bmeta-job-location-country\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)].map(m => text(m[1]))
  const city = classText(html, 'meta-job-location-city'), state = classText(html, 'meta-job-location-state')
  if (countries.length !== 1 || !/^(?:India|IN)$/i.test(countries[0]) || !city || (state && !INDIA_REGIONS.test(state)) || /\b(?:Canada|United States|USA|Singapore|Australia|Germany|United Kingdom)\b/i.test(city)) fail('explicit India location missing or contradictory')
  return [city, state, 'India'].filter(Boolean).join(', ')
}
const identity = html => {
  const employer = html.match(/<h1\b[^>]*class=["'][^"']*\bnomargin\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  if (text(employer || '').toLowerCase() !== 'sumhr') fail('employer identity changed')
}
export function parseBoard(raw) {
  const { html } = activePage(raw)
  identity(html)
  if (!/<input\b[^>]*name=["']client["'][^>]*value=["']u0mr5["']/i.test(html)) fail('reviewed client identity changed')
  const count = text(html).match(/View\s+(\d+)\s+Opening/i)?.[1]
  const matches = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bjs-careers-page-job-list-item\b[^"']*["'][^>]*data-href=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<div class="rb-divider")/gi)]
  if (!count || +count !== matches.length || !matches.length || matches.length > 50) fail('native card count is missing or changed')
  const ids = new Set()
  return matches.map(match => {
    if (!/^\/jobs\/[a-z0-9]+\/$/.test(match[1]) || ids.has(match[1])) fail('invalid or duplicate native job identity')
    ids.add(match[1])
    const title = classText(match[2], 'js-job-list-opening-name')
    if (!title) fail('missing title')
    return { id: match[1].split('/')[2], title, location: location(match[2]), url: new URL(match[1], ATS_URL).href }
  })
}
export function parseDetail(raw, row, now = new Date()) {
  const page = activePage(raw, true), html = page.html
  identity(html)
  // This is a reviewed employer-configured accommodation contact, not JD text.
  // Combined with exact Sumhr tenant/client and @sumHR position this binds the
  // independent native surface to the fresh official employer email domain.
  if (!page.scripts.some(script => /a\.href\s*=\s*["']mailto:sid@sumhr\.com["']/.test(script.raw) && /a\.text\s*=\s*["']sid@sumhr\.com["']/.test(script.raw))) fail('reviewed employer contact binding changed')
  const canonical = html.match(/<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1]
  if (canonical !== row.url || classText(html, 'js-job-title') !== row.title || location(html) !== row.location) fail('native role, title or location mismatch')
  const form = html.match(/<form\b[^>]*id=["']job_application_form["'][^>]*>/i)?.[0]
  const holders = page.doc.nodes(node => node.attrs.id === 'application_form_holder'), forms = page.doc.nodes(node => node.tag === 'form' && node.attrs.id === 'job_application_form')
  if (holders.length !== 1 || forms.length !== 1 || page.doc.nodes(node => node === forms[0], holders[0]).length !== 1) fail('native form holder identity or containment changed')
  if (!form || attr(form, 'action') !== '/jobs/' + row.id || !/method=["']post["']/i.test(form) || !/<a\b[^>]*href=["']\?apply=true["']/i.test(html) || /no longer accepting|job (?:is )?(?:closed|expired)|position (?:is )?filled/i.test(text(html))) fail('active native application missing')
  let postingDate = null
  for (const script of page.scripts.filter(script => script.type === 'application/ld+json')) {
    let parsed
    try { parsed = JSON.parse(script.raw) } catch { fail('invalid structured data') }
    const records = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed]
    for (const record of records.filter(item => item['@type'] === 'JobPosting')) {
      if (Object.keys(record).some(key => /location|country|region|address/i.test(key) && key !== 'jobLocation')) fail('unreviewed secondary schema geographic scope')
      if (record.title !== row.title || record.hiringOrganization?.name?.toLowerCase() !== 'sumhr') fail('contradictory job schema identity')
      const locations = Array.isArray(record.jobLocation) ? record.jobLocation : [record.jobLocation]
      if (!locations.length || locations.some(item => !/^(?:India|IN)$/i.test(typeof item?.address?.addressCountry === 'object' ? item.address.addressCountry.name : item?.address?.addressCountry || '') || (item?.address?.addressRegion && !INDIA_REGIONS.test(item.address.addressRegion)))) fail('contradictory job schema countries or regions')
      for (const key of ['datePosted', 'validThrough']) if (record[key] != null) {
        const value = record[key]
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))
          || new Date(value.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) !== value.slice(0, 10)) fail('invalid public date')
        if (key === 'validThrough' && Date.parse(value) < +now) fail('expired public job')
        if (key === 'datePosted') { if (Date.parse(value) > +now) fail('future public posting date'); postingDate = value }
      }
    }
  }
  const block = html.match(/<div\b[^>]*class=["'][^"']*\bjobdesciption\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  let description = null
  if (block && !/<[^>]*\bhidden(?:\s|=|>)|<[^>]*aria-hidden=["']true|<[^>]*display\s*:\s*none|<[^>]*visibility\s*:\s*hidden/i.test(block[0])) {
    const prose = text(block[1].replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1>/gi, ''))
    if (prose.length >= 100 && !/description (?:will be|is being|coming|unavailable)|details (?:coming soon|to follow)|updated soon/i.test(prose)) description = text(block[1])
  }
  return { source: 'sumhr', company: 'SumHR', title: row.title, jobId: row.id, location: row.location, country: 'India',
    sourceUrl: row.url, applyUrl: row.url, link: row.url, postingDate, jobDescription: description,
    sourceListingComplete: false, sourceScopeComplete: false, sourceFirstParty: false, sourceDetailComplete: Boolean(description),
    sourceEmployerIdentityEvidence: { nativeTenant: 'sumhr', reviewedClientId: 'u0mr5', nativeConfiguredContact: 'sid@sumhr.com', officialContactDomain: 'sumhr.com', corporateOutboundAtsAuthorizationVerified: false },
    scrapedAt: now.toISOString() }
}
