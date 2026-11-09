import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

const requireProof = (ok, reason) => {if (!ok) throw new Error(reason)}
export const active = html => {
  const doc = document(html || '')
  const prune = (n, inherited=false) => {
    n.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\b/i.test(n.attrs.style || '')
    for (const c of n.children.filter(c => typeof c !== 'string')) prune(c, n.inactive)
  }
  prune(doc.root)
  return doc
}
const text = html => {const doc=active(html); return doc.text(doc.root).replace(/[\u200b-\u200d\ufeff]/g,'').trim()}
export function officialContract(home, search, searchURL) {
  const h=active(home), s=active(search)
  requireProof(h.text(h.root).includes('Care Health Insurance') && h.nodes(n => n.tag === 'a' && n.attrs.href === searchURL).length, 'Official exact employer search handoff missing')
  requireProof(s.text(s.root).includes('Care Health Insurance Limited'), 'Official legal employer missing')
  const forms=s.nodes(n => n.tag === 'form' && n.attrs.id === 'job-form' && n.attrs.action === searchURL && n.attrs.method?.toUpperCase() === 'POST')
  requireProof(forms.length === 1 && s.nodes(n => n.attrs.id === 'apply-button' && n.tag === 'input' && !Object.hasOwn(n.attrs,'disabled'), forms[0]).length === 1, 'Active native application control missing')
  for(const category of ['0','1','2']) requireProof(s.nodes(n => n.attrs.onclick === `getOpnenings('${category}')`).length === 1, 'Native category set changed')
  const scripts=s.nodes(n => n.tag === 'script' && !n.attrs.src).map(n => n.raw || '').join('\n')
  requireProof(scripts.includes('url: "/rhicl/getOpenings/" + id') && scripts.includes('getOpnenings(0)') && scripts.includes('value.job_title') && scripts.includes('value.description') && scripts.includes('value.job_location') && scripts.includes('$(".hidden-section").show()'), 'Reviewed native loader or application reveal changed')
}
const fields = new Set(['id','job_category','job_title','job_location','experience','primary_skills','qualification','description','created_at','updated_at','banner_heading','banner_logo','banner_image','banner_footer'])
function date(value, now) {
  if (value == null || value === '') return null
  requireProof(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value), 'Unreviewed public date')
  const d=value.slice(0,10), parsed=new Date(value.replace(' ','T')+'Z')
  requireProof(Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === d && d <= now.toISOString().slice(0,10), 'Invalid or future public date')
  return d
}
export function rows(body, category, seen, now) {
  const records=JSON.parse(body)
  requireProof(Array.isArray(records) && records.length <= 100, 'Native array contract or bound changed')
  return records.map(row => {
    requireProof(row && Object.keys(row).every(k => fields.has(k)), 'Unreviewed secondary employer, geographic, expiry or pagination scope')
    requireProof(Number.isSafeInteger(row.id) && row.id > 0 && !seen.has(row.id) && row.job_category === category, 'Native category or unique identity changed')
    seen.add(row.id)
    const title=text(row.job_title), location=text(row.job_location)
    requireProof(title && location, 'Active title or location missing')
    const banner=text(row.banner_heading), simplified=value => value.toLowerCase().replace(/^(?:job\s*)?opening\s*[-–:]?\s*/i,'').replace(/[^a-z0-9]/g,'')
    requireProof(/^(?:Care Health Insurance|Job Opening)$/i.test(banner) || simplified(banner) === simplified(title), 'Contradictory native employer or role banner')
    const created=date(row.created_at,now), updated=date(row.updated_at,now)
    requireProof(!created || !updated || created <= updated, 'Contradictory public date chronology')
    let description=null
    if (typeof row.description === 'string') {
      const prose=text(row.description.replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1>/gi,''))
      if(prose.length >= 100 && !/coming soon|description (?:is )?unavailable|to be updated/i.test(prose)) description=text(row.description)
    }
    return {id:String(row.id), title, location, description, postingDate:created,
      nativeCreatedAt:row.created_at ?? null, nativeUpdatedAt:row.updated_at ?? null,
      india:/^Pan India$/i.test(location), category}
  })
}
