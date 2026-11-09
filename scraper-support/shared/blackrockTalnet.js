import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
const requireProof=(ok,message)=>{if(!ok)throw new Error('BlackRock tal.net: '+message)}
const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip);/g, (_, n) => ({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…'})[n])
const norm = value => decode(value).replace(/\s+/g, ' ').trim()

// Small source-local tree reader: exact attributes, active elements only, and raw
// script bodies kept separately. Inert markup cannot supply a title or full JD.
const dom = input => {
  const html = String(input), root = {tag:'root', attrs:{}, children:[]}, stack = [root]
  const raw = new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
  const tags = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let cursor = 0, match
  while ((match = tags.exec(html))) {
    const parent = stack.at(-1)
    if (match.index > cursor) parent.children.push(html.slice(cursor, match.index))
    cursor = tags.lastIndex
    if (!match[1]) continue
    const tag = match[1].toLowerCase()
    if (match[0].startsWith('</')) {
      const at = stack.findLastIndex(node => node.tag === tag)
      if (at > 0) stack.length = at
      continue
    }
    const attrs = {}
    for (const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = a[1].toLowerCase()
      requireProof(!Object.hasOwn(attrs, key), 'Duplicate native HTML attribute')
      attrs[key] = decode(a[2] ?? a[3] ?? a[4] ?? '')
    }
    const node = {tag,attrs,children:[],inert:parent.inert || tag === 'template' || (raw.has(tag) && tag !== 'script')}
    parent.children.push(node)
    if (raw.has(tag)) {
      const end = tag === 'plaintext' ? null : new RegExp(`</${tag}\\s*>`, 'ig')
      if (end) end.lastIndex = cursor
      const closing = end?.exec(html)
      node.raw = html.slice(cursor, closing?.index ?? html.length)
      cursor = closing ? end.lastIndex : html.length
      tags.lastIndex = cursor
    } else if (!voids.has(tag)) stack.push(node)
  }
  if (cursor < html.length) stack.at(-1).children.push(html.slice(cursor))
  return root
}
const all = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => all(child, predicate)) ]
const text = node => node.inert || node.tag === 'script' ? '' : norm(node.children.map(child => typeof child === 'string' ? child : text(child)).join(' '))
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const one = (nodes, label) => { requireProof(nodes.length === 1, `Expected one ${label}`); return nodes[0] }
const APAC = 'https://careers.blackrock.com/students-and-graduates-apac'
const TAL = 'https://blackrock.tal.net'
const BOARD = `${TAL}/vx/lang-en-GB/mobile-0/brand-3/candidate/jobboard/vacancy/1/adv/`
const SCOPE = Symbol('blackrock-early-careers-scope')
export const readBlackRockEarlyCareersScope = jobs => jobs?.[SCOPE] || null
const countries = Object.freeze({'Australia':'AU','Hong Kong':'HK','Japan':'JP','Singapore':'SG','Taiwan':'TW','Canada':'CA','United States':'US','Mexico':'MX','Belgium':'BE','Denmark':'DK','France':'FR','Germany':'DE','Hungary':'HU','Italy':'IT','Luxembourg':'LU','Netherlands':'NL','Saudi Arabia':'SA','Serbia':'RS','South Africa':'ZA','Sweden':'SE','Switzerland':'CH','United Arab Emirates':'AE','United Kingdom':'GB','Spain':'ES'})
// These labels are observed in the sealed full native inventory, not geocoded or
// inferred from a company location. A new location requires fresh scope review.
const cities = new Set('Abu Dhabi|Amsterdam|Atlanta|Belgrade|Boston|Brussels|Budapest|Cape Town|Chicago|Copenhagen|Edinburgh|Frankfurt|Hong Kong|London|Luxembourg|Madrid|Mexico City|Miami|Milan|Montreal|Munich|New York|Newport Beach|Paris|Princeton|Riyadh|San Francisco|Santa Monica|Sausalito|Seattle|Singapore|Stockholm|Sydney|Taipei|Tokyo|Toronto|Washington DC|Wilmington|Zurich'.split('|'))
const regionalCountries = {'Americas':new Set(['CA','MX','US']),'Asia Pacific':new Set(['AU','HK','JP','SG','TW']),'EMEA':new Set(['BE','DK','FR','DE','HU','IT','LU','NL','SA','RS','ZA','SE','CH','AE','GB','ES'])}
const checkedUrl = (value,origin=TAL) => {
  requireProof(typeof value==='string' && value.length>0,'Native URL unavailable')
  const u=new URL(value);requireProof(u.origin===origin&&!u.username&&!u.password&&!u.hash,'Unexpected native URL origin');return u
}
const detailUrl = value => {
  const u=checkedUrl(value);requireProof(!u.search,'Unexpected detail URL query')
  const match=u.pathname.match(/^\/vx\/(?:lang-en-GB\/)?mobile-0\/brand-3\/candidate\/so\/pm\/1\/pl\/1\/opp\/(\d+)-([^/]+)\/en-GB$/)
  requireProof(match,'Unexpected detail URL route');return {id:match[1],slug:match[2]}
}
const anchors = tree => all(tree,n=>n.tag==='a'&&Object.hasOwn(n.attrs,'href'))
const navigation = html => {
 const links=anchors(dom(html)).filter(n=>text(n)==='Career Opportunities').map(n=>n.attrs.href)
 const unique=[...new Set(links)];requireProof(unique.length>0,'Public Career Opportunities navigation missing')
 for(const link of unique){const u=checkedUrl(link);requireProof(!u.search&&/^\/vx\/lang-en-GB\/mobile-0\/brand-3\/(?:user-\d+\/(?:xf-[a-z0-9]+\/)?)?candidate\/jobboard\/vacancy\/1\/adv\/$/.test(u.pathname),'Unexpected public board navigation')}
 return unique.includes(BOARD)?BOARD:one(unique,'public board navigation')
}
export function parseBlackRockTalnetBoard(html) {
 const tree=dom(html)
 requireProof(all(tree,n=>n.tag==='h1').some(n=>text(n)==='Careers at BlackRock'),'Native employer identity missing')
 const count=one(all(tree,n=>n.tag==='h2'&&n.attrs.role==='alert'),'native total')
 const match=text(count).match(/^(\d+) results match!$/);requireProof(match,'Native total unavailable')
 const total=Number(match[1]);requireProof(Number.isSafeInteger(total)&&total>0,'Empty program board needs a new official handoff contract')
 requireProof(!all(tree,n=>['a','button'].includes(n.tag)&&(/\bnext\b/i.test(n.attrs.rel||'')||/next|more results/i.test(n.attrs['aria-label']||'')||/^(next|load more|show more)(\s|$)/i.test(text(n)))).length,'Unsupported native pagination')
 const table=one(all(tree,n=>n.tag==='table'&&cls(n,'solr_search_list')),'native inventory table')
 const rows=all(table,n=>n.tag==='tr'&&Object.hasOwn(n.attrs,'data-oppid')).map(n=>{
  const id=n.attrs['data-oppid'],title=norm(n.attrs['data-title']);requireProof(/^\d+$/.test(id)&&title,'Native listing identity missing')
  const link=one(anchors(n).filter(a=>cls(a,'subject')),'native role link'),url=link.attrs.href,identity=detailUrl(url)
  requireProof(identity.id===id,'Listing URL identity conflict')
  const columns=all(n,c=>c.tag==='td').map(text);requireProof(columns.length===3&&regionalCountries[columns[1]]&&/^20\d\d$/.test(columns[2]),'Listing scope fields unavailable')
  return {id,title,url,program:columns[0],region:columns[1],recruitmentYear:columns[2]}
 })
 requireProof(rows.length===total&&new Set(rows.map(r=>r.id)).size===total&&new Set(rows.map(r=>r.url)).size===total,'Native count/unique identities do not reconcile')
 return {total,rows}
}
export function parseBlackRockTalnetDetail(html,row) {
 const tree=dom(html),title=text(one(all(tree,n=>n.tag==='h1'&&cls(n,'section')),'native title'))
 requireProof(title===row.title,'Native title conflict')
 const canonical=one(all(tree,n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical').attrs.href
 // Current Mexico City program explicitly advertises brand0 in its canonical
 // while the observed public board and application stay brand3. Bind this one
 // native exception to the exact captured role, never to arbitrary brand0 URLs.
 const canonicalForIdentity=canonical===`${TAL}/vx/mobile-0/brand-0/candidate/so/pm/1/pl/1/opp/12227-2027-Mexico-City-Internship-Program/en-GB`
  ?canonical.replace('/brand-0/','/brand-3/'):canonical
 const identity=detailUrl(canonicalForIdentity),expected=detailUrl(row.url)
 requireProof(identity.id===row.id&&identity.slug===expected.slug,'Native canonical identity conflict')
 const form=one(all(tree,n=>n.tag==='form'&&cls(n,'form-view')),'native full detail form')
 const getField=(id,label)=>{
  const n=one(all(form,n=>n.tag==='div'&&new RegExp(`_datafield_${id}_1_1$`).test(n.attrs.id||'')),'native '+label)
  const labelId=n.attrs['aria-labelledby'];requireProof(typeof labelId==='string'&&new RegExp(`_field_que_${id}_1$`).test(labelId),'Native field label binding missing')
  const l=one(all(form,n=>n.tag==='label'&&n.attrs.id===labelId),'native '+label+' label')
  requireProof(text(l)===label,'Native field label mismatch');return text(n)
 }
 const region=getField(26515,'Region'),countryLabels=getField(144972,'Countries').split(',').map(norm),cityLabels=getField(144976,'Cities').split(',').map(norm)
 requireProof(region===row.region&&regionalCountries[region],'Native region conflict')
 requireProof(countryLabels.length>0&&countryLabels.every(c=>Object.hasOwn(countries,c)&&regionalCountries[region].has(countries[c])),'India or unknown native country requires extraction/scope review')
 requireProof(cityLabels.length>0&&cityLabels.every(c=>cities.has(c)),'India or unknown native city requires extraction/scope review')
 const recruitmentYear=getField(26494,'Recruitment Year'),program=getField(26520,'Program'),description=getField(26498,'Job description')
 requireProof(recruitmentYear===row.recruitmentYear&&program===row.program,'Native program/year identity conflict')
 requireProof(description.length>=200&&hasSourceDescription({sourceDescription:description}),'Full native program description unavailable')
 const apply=one(all(tree,n=>n.tag==='form'&&cls(n,'apply-form')),'native apply form'),applyUrl=checkedUrl(apply.attrs.action)
 requireProof(apply.attrs.method?.toLowerCase()==='post'&&!applyUrl.search&&applyUrl.pathname===`/vx/lang-en-GB/mobile-0/brand-3/candidate/so/pm/1/pl/1/opp/${row.id}/apply/en-GB`,'Native application identity conflict')
 return {...row,canonicalUrl:canonical,applyUrl:applyUrl.href,countries:countryLabels,countryCodes:countryLabels.map(c=>countries[c]),cities:cityLabels,description}
}
export async function runBlackRockEarlyCareers({fetchText,signal,now=()=>new Date().toISOString(),detailConcurrency=2,maxPrograms=100,timeoutMs=60000}={}) {
 requireProof(Number.isInteger(detailConcurrency)&&detailConcurrency>=1&&detailConcurrency<=2,'Invalid detail concurrency')
 requireProof(Number.isInteger(maxPrograms)&&maxPrograms>=1&&maxPrograms<=100,'Invalid bounded inventory cap')
 requireProof(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=60000,'Invalid bounded timeout')
 const checkedAt=new Date(typeof now==='function'?now():now).toISOString()
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason),timer=setTimeout(()=>controller.abort(new Error('BlackRock scope deadline exceeded')),timeoutMs)
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true})
 const get=async url=>{
  controller.signal.throwIfAborted()
  let rejectAbort;const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason||new Error('Aborted'));controller.signal.addEventListener('abort',rejectAbort,{once:true})})
  try{
   const result=await Promise.race([Promise.resolve().then(async()=>{
    if(fetchText)return fetchText(url,{signal:controller.signal})
    const response=await fetch(url,{signal:controller.signal,redirect:'follow'});return {status:response.status,finalURL:response.url,body:await response.text()}
   }),cancelled])
   controller.signal.throwIfAborted()
   if(typeof result==='string')return result
   requireProof(result?.status===200&&typeof result.body==='string','Native HTTP request failed')
   const final=checkedUrl(result.finalURL||url,new URL(url).origin)
   if(url===APAC||url.includes('/job/')||url.includes('/opp/')&&!url.includes('?instant=apply')||url===BOARD)requireProof(final.href===url,'Native response redirected outside exact request')
   if(url.includes('?instant=apply')){const id=new URL(url).pathname.match(/\/opp\/(\d+)$/)?.[1];requireProof(final.pathname===`/vx/lang-en-GB/mobile-0/brand-3/candidate/so/pm/1/pl/1/opp/${id}/apply`&&final.search==='?instant=apply','Public application redirect identity conflict')}
   return result.body
  }finally{controller.signal.removeEventListener('abort',rejectAbort)}
 }
 try{
  const apac=dom(await get(APAC)),corporate=[...new Set(anchors(apac).map(n=>n.attrs.href).filter(h=>{try{return new URL(h).origin==='https://careers.blackrock.com'&&new URL(h).pathname.startsWith('/job/')}catch{return false}}))]
  requireProof(corporate.length>0&&corporate.length<=maxPrograms,'Current corporate APAC program handoff unavailable')
  const handoffs=[]
  for(const url of corporate){checkedUrl(url,'https://careers.blackrock.com');const tree=dom(await get(url)),title=text(one(all(tree,n=>n.tag==='h1'),'corporate program title'))
   const links=[...new Set(anchors(tree).map(n=>n.attrs.href).filter(h=>{try{return new URL(h).hostname==='blackrock.tal.net'}catch{return false}}))],apply=one(links,'corporate native apply link'),u=checkedUrl(apply),id=u.pathname.match(/^\/vx\/candidate\/so\/pm\/1\/pl\/1\/opp\/(\d+)$/)?.[1]
   requireProof(id&&u.search==='?instant=apply','Unexpected corporate native handoff');handoffs.push({id,title,corporateUrl:url,applyUrl:apply})
  }
  requireProof(new Set(handoffs.map(h=>h.id)).size===handoffs.length,'Duplicate corporate program identities')
  const nav=navigation(await get(handoffs[0].applyUrl)),initialHtml=await get(nav)
  requireProof(navigation(initialHtml)===BOARD,'Observed session-free public board link unavailable')
  const initial=parseBlackRockTalnetBoard(initialHtml);requireProof(initial.total<=maxPrograms,'Native inventory exceeds configured cap')
  const programs=new Array(initial.total);let cursor=0
  await Promise.all(Array.from({length:detailConcurrency},async()=>{while(cursor<initial.total){const index=cursor++,row=initial.rows[index];programs[index]=parseBlackRockTalnetDetail(await get(row.url),row)}}))
  const final=parseBlackRockTalnetBoard(await get(BOARD));requireProof(JSON.stringify(final)===JSON.stringify(initial),'Native inventory changed during detail enumeration')
  const apacRows=programs.filter(p=>p.region==='Asia Pacific');requireProof(apacRows.length===handoffs.length&&handoffs.every(h=>apacRows.some(r=>r.id===h.id&&r.title===h.title)),'Corporate/native APAC scope does not reconcile')
  const jobs=attachInventoryEvidence([],{status:'complete-inventory',surface:BOARD,firstParty:true,listingComplete:true,pagesFetched:1,reportedTotal:initial.total,indiaFacetCount:0,verifiedAt:checkedAt,reason:'finite-public-program-board-complete-explicit-foreign-scope'})
  Object.defineProperty(jobs,SCOPE,{value:{surface:BOARD,scope:'tal.net brand3 public Career Opportunities board1 only',programs,handoffs,finalInventoryRechecked:true,employerAllCareersComplete:false}})
  return jobs
 }finally{controller.abort();clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
