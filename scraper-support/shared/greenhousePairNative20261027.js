import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'

// This protocol is deliberately source-owned by ESW and ExtraHop. Catalog flags
// never grant completeness: each run must reconcile its current public surfaces.
const BOARD_ROUTE='routes/$url_token'
const DETAIL_ROUTE='routes/$url_token_.jobs_.$job_post_id'
const BOT=/verify you are human|checking your browser|just a moment\.\.\.|access denied|captcha challenge/i
const TALENT=/talent (?:community|network|pool)|speculative|future opportunities|general application/i
const GLOBAL=/\b(?:APAC|EMEA|AMER|LATAM|worldwide|global|anywhere|Asia[- ]Pacific)\b/i
const MODE=/^(?:remote|hybrid|on[- ]site|in[- ]office)$/i
const GEO=/country|countries|location|address|geograph|region|latitude|longitude|postal|territor|continent/i
const str=v=>typeof v==='string'?v.trim():''
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const sorted=v=>[...new Set(v)].sort()
const fail=reason=>{throw Error(reason)}
const id=v=>v!=null&&/^(?:0|[1-9]\d*)$/.test(String(v))?String(v):fail('missing-or-invalid-native-id')
const display=new Intl.DisplayNames(['en'],{type:'region'})
const countryNames=new Map(),codes=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=display.of(code)
 if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)){countryNames.set(name.toLowerCase(),code);codes.set(code,name)}
}
for(const [alias,code] of Object.entries({USA:'US',US:'US','United States of America':'US',UK:'GB',GBR:'GB',IND:'IN',UAE:'AE',Vietnam:'VN','South Korea':'KR',Turkey:'TR'}))countryNames.set(alias.toLowerCase(),code)
const country=(v,typed=false)=>{const label=str(v);return countryNames.get(label.toLowerCase())||(typed&&codes.has(label.toUpperCase())?label.toUpperCase():null)}
// Qualified external evidence, not a native country field. Its application below
// is limited to the exact currently verified ESW posting, assigned office and
// city/state label; it does not create a general city or postal-code default.
const ESW_JERSEY_CITY_REFERENCE={
 url:'https://pe.usps.com/text/pub28/pub28apb.htm',
 title:'USPS Publication 28, Appendix B: Two-Letter State and Possession Abbreviations',
 method:'GET',status:200,capturedAt:'2026-10-27T10:35:07.091Z',
 sha256:'0ba863b726007dc640f6f25b849830119a80f5d3056e4e5e472ce4793b2f997b',
 retainedFixture:'scraper/esw/fixtures/usps-state-abbreviations-20261027.html',
 matchedState:'New Jersey',matchedPostalAbbreviation:'NJ',
}
const stateNames={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'}
const decode=value=>String(value??'').replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp|ndash|mdash|rsquo|lsquo|rdquo|ldquo|bull|hellip));/gi,(m,d,h,n)=>{
 if(d||h){let c=parseInt(d||h,d?10:16);return c>0&&c<=0x10ffff?String.fromCodePoint(c):m}
 return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',bull:'•',hellip:'…'}[n.toLowerCase()]
})
export const nativePlainText=value=>decode(decode(value)).replace(/<(?:script|style)\b[^>]*>[^]*?<\/(?:script|style)>/gi,'').replace(/<\/(?:p|div|h[1-6]|li|ul|ol)>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/[\t\r ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim()
const compact=v=>nativePlainText(v).replace(/\s+/g,' ')
const geoExtras=(obj,allowed)=>Object.keys(obj||{}).some(key=>GEO.test(key)&&!allowed.includes(key)&&obj[key]!=null)
function publication(v){
 if(v==null||v==='')return {value:null,precision:null}
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(v)||Number.isNaN(Date.parse(v)))fail('invalid-original-publication')
 return {value:v.length===10?v:new Date(v).toISOString(),precision:v.length===10?'day':'instant'}
}

export function createGreenhousePairScraper(config){
 const {source,companyName:company,boardToken,companyCareerPage:careers}=config
 if(!['esw','extrahop'].includes(source))fail('unsupported-source-owned-protocol')
 const board=`https://job-boards.greenhouse.io/${boardToken}`,api=`https://boards-api.greenhouse.io/v1/boards/${boardToken}`
 const corporateHost=host=>source==='esw'?(host==='esw.com'||/^(?:uk|es|de|fr|it|pt)\.esw\.com$/.test(host)):host==='www.extrahop.com'
 function jobUrl(v,key){let u;try{u=new URL(v)}catch{fail('invalid-native-public-url')};if(u.origin!==new URL(board).origin||u.pathname.replace(/\/$/,'')!==`/${boardToken}/jobs/${id(key)}`||u.username||u.password||u.hash)fail('foreign-native-job-identity');return u.origin+u.pathname.replace(/\/$/,'')}
 function loader(body){const m=body.match(/window\.__remixContext\s*=\s*(\{[^]*?\});\s*<\/script>/);if(!m)fail('native-client-loader-unavailable');let d;try{d=JSON.parse(m[1]).state.loaderData}catch{fail('invalid-native-loader-json')};if(d?.root?.urlToken!==boardToken||d.root.internal||d.root.preview)fail('foreign-or-private-native-board');return d}
 function corporate(body,url){
  if(!/<html\b|<a\b/i.test(body))fail('invalid-corporate-html')
  const channels=[],roleIds=[],bindings=[],reasons=[]
  for(const m of body.matchAll(/<(a|link|iframe|script)\b([^>]*?)\b(?:href|src)\s*=\s*["']([^"']+)["']([^>]*)>/gi)){
   let u;try{u=new URL(decode(m[3]),url)}catch{continue}
   if(u.username||u.password||!['http:','https:'].includes(u.protocol))continue
   const href=u.origin+u.pathname
   const role=corporateHost(u.hostname)&&u.pathname.match(/^\/careers\/open-roles\/(\d+)\/$/)
   if(role){roleIds.push(role[1]);continue}
   if(corporateHost(u.hostname)&&/^\/careers\/?(?:how-we-work\/|work-with-us\/|open-roles\/|students-graduates)?$/.test(u.pathname)){channels.push(href);continue}
   if(/(?:^|\.)greenhouse\.io$/.test(u.hostname)){
    const own=['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)&&new RegExp(`^/${boardToken}(?:/jobs/\\d+)?/?$`).test(u.pathname)
    const embed=u.hostname==='boards.greenhouse.io'&&u.pathname==='/embed/job_board/js'&&u.searchParams.get('for')===boardToken
    if(own||embed){bindings.push(own?href:u.origin+u.pathname+u.search);const key=u.pathname.match(/\/jobs\/(\d+)/);if(key)roleIds.push(key[1])}else reasons.push('additional-advertised-ats-channel')
   }else if(/(?:lever\.co|ashbyhq\.com|myworkdayjobs\.com|workable\.com|jobvite\.com|recruitee\.com|smartrecruiters\.com)$/.test(u.hostname))reasons.push('additional-advertised-ats-channel')
   else if(m[1].toLowerCase()==='a'&&/\/(?:jobs?|apply)(?:\/|$)/i.test(u.pathname)&&!corporateHost(u.hostname))reasons.push('additional-advertised-hiring-channel')
  }
  for(const m of body.matchAll(/<a\b([^>]*)>([^]*?)<\/a>/gi)){
   const href=m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i);if(!href)continue
   let u;try{u=new URL(decode(href[1]),url)}catch{continue};if(!['http:','https:'].includes(u.protocol))continue
   const action=/^(?:careers?|apply(?: now)?|open (?:roles|positions)|(?:view|explore|search|browse|see|find) (?:our |all )?(?:open )?(?:jobs|roles|positions))$/i.test(compact(m[2]))
   const careerPath=/\/careers?(?:\/|$)/i.test(u.pathname)&&!/^\/careers\/(?:blog|life-at-esw-blog)(?:\/|$)/.test(u.pathname)
   if(!action&&!careerPath)continue
   const normal=u.origin+u.pathname,ownRole=corporateHost(u.hostname)&&/^\/careers\/open-roles\/\d+\/$/.test(u.pathname)
   const boundNative=['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)&&new RegExp(`^/${boardToken}(?:/jobs/\\d+)?/?$`).test(u.pathname)
   if(!channels.includes(normal)&&!ownRole&&!boundNative)reasons.push('additional-advertised-hiring-channel')
  }
  return {channels:sorted(channels),roleIds:sorted(roleIds),bindings:sorted(bindings),reasons:sorted(reasons)}
 }
 function boardPage(body,page){
  const r=loader(body)[BOARD_ROUTE],p=r?.jobPosts
  if(r?.urlToken!==boardToken||r.board?.name!==company||r.board.public_url!==board||r.board.redirect_to)fail('native-board-employer-mismatch')
  if(!Array.isArray(p?.data)||!Number.isInteger(p.total)||p.total<0||!Number.isInteger(p.total_pages)||p.total_pages<0||p.page!==page||p.count!==p.data.length||(p.total>0&&p.total_pages<1)||(!p.total_pages&&(p.total||p.data.length)))fail('invalid-native-pagination')
  if(!Array.isArray(r.featuredPosts?.data)||!Array.isArray(r.offices))fail('invalid-native-board-channels')
  for(const row of [...p.data,...r.featuredPosts.data]){id(row.id);jobUrl(row.absolute_url,row.id);if(!str(row.title)||typeof row.location!=='string')fail('invalid-native-listing-role')}
  return {rows:p.data,featured:r.featuredPosts.data,pages:Math.max(1,p.total_pages),total:p.total,offices:r.offices}
 }
 function apiJobs(payload){
  if(!payload||payload.error||payload.errors||payload.hasMore||payload.has_more||!Array.isArray(payload.jobs)||!Number.isInteger(payload.meta?.total)||payload.meta.total!==payload.jobs.length)fail('incomplete-public-api-inventory')
  const seen=new Set()
  for(const row of payload.jobs){const key=id(row.id);if(seen.has(key))fail('duplicate-native-role-id');seen.add(key);jobUrl(row.absolute_url,key);if(row.company_name!==company||!str(row.title)||!row.location||typeof row.location.name!=='string'||!Array.isArray(row.offices)||(row.metadata!=null&&!Array.isArray(row.metadata)))fail('native-api-employer-or-shape-mismatch')}
  return payload.jobs
 }
 function officeGraph(payload,boardOffices,reasons){
  if(!Array.isArray(payload?.offices)||payload.error||payload.errors||payload.hasMore)fail('invalid-native-office-inventory')
  const graph=new Map()
  for(const o of payload.offices){const key=id(o.id);if(graph.has(key)||!str(o.name)||!Array.isArray(o.child_ids)||(o.location!=null&&typeof o.location!=='string'))fail('invalid-native-office');graph.set(key,o);if(geoExtras(o,['location']))reasons.add('unhandled-native-office-geography')}
  for(const o of graph.values()){
   if(o.parent_id!=null){let p=graph.get(id(o.parent_id));if(!p||!p.child_ids.some(k=>id(k)===id(o.id)))fail('broken-native-office-parent-graph')}
   for(const child of o.child_ids){let c=graph.get(id(child));if(!c||String(c.parent_id)!==id(o.id))fail('broken-native-office-child-graph')}
   let parent=o,seen=new Set();while(parent){if(seen.has(id(parent.id)))fail('cyclic-native-office-graph');seen.add(id(parent.id));parent=parent.parent_id==null?null:graph.get(id(parent.parent_id))}
  }
  const visit=(nodes,parent=null)=>{for(const n of nodes){const o=graph.get(id(n.id));if(!o||n.name!==o.name||(parent!=null&&String(o.parent_id)!==parent))fail('board-office-graph-mismatch');if(!Array.isArray(n.children))fail('invalid-board-office-children');visit(n.children,id(n.id))}}
  visit(boardOffices)
  return graph
 }
 function labelCountries(label,{typed=false,graph,allowOfficeNames=true}={}){
  const value=str(label),found=new Set(),unknown=[]
  const exact=country(value,typed)
  if(exact)return {codes:[exact],unknown:[]}
  if(typed)return {codes:[],unknown:[value||'missing-country']}
  if(/^Remote\s*-\s*USA$/i.test(value))return {codes:['US'],unknown:[],countryInferred:false,countryEvidence:'explicit-country-in-native-work-mode-label'}
  for(const part of value.split(/\s*(?:[;|/+]|\s+(?:or|and)\s+)\s*/i)){
   const segment=part.trim();if(!segment||MODE.test(segment))continue
   if(GLOBAL.test(segment)){unknown.push(segment);continue}
   let code=country(segment)
   if(!code){const pieces=segment.replace(/[()]/g,',').split(',').map(v=>v.trim()).filter(Boolean);code=country(pieces.at(-1))}
   if(!code&&allowOfficeNames&&graph){
    const cityState=segment.match(/^(.+),\s*([A-Z]{2})$/),state=cityState&&stateNames[cityState[2]]
    const hits=[...graph.values()].filter(o=>o.name.toLowerCase()===segment.toLowerCase()
      ||(state&&o.name.toLowerCase()===cityState[1].toLowerCase()&&str(o.location).split(',').map(v=>v.trim()).includes(state)&&labelCountries(o.location,{allowOfficeNames:false}).codes.includes('US')))
    const options=sorted(hits.flatMap(o=>labelCountries(o.location||'',{allowOfficeNames:false}).codes))
    if(options.length===1)code=options[0]
   }
   if(code)found.add(code);else unknown.push(segment)
  }
  return {codes:[...found],unknown:unknown.length?unknown:found.size?[]:[value||'missing-location']}
 }
 function geography(row,graph){
  const reasons=new Set(),locations=[],primary=labelCountries(row.location.name,{graph})
  if(geoExtras(row,['location'])||geoExtras(row.location,['name']))reasons.add('unhandled-native-geography')
  const add=(kind,label,result,field)=>locations.push({kind,label,sourceField:field,countryCodes:result.codes,country:result.codes.length===1?codes.get(result.codes[0]):null,unresolved:result.unknown.length>0,
   ...(result.countryEvidence?{countryEvidence:result.countryEvidence,countryInferred:result.countryInferred===true}:{}),
   ...(result.countryInference?{countryInference:result.countryInference}:{}),
  })
  add('primary',row.location.name,primary,'location.name')
  for(const [i,office]of row.offices.entries()){
   const g=graph.get(id(office.id));if(!g||office.name!==g.name||office.location!==g.location||String(office.parent_id??'')!==String(g.parent_id??'')||!same(sorted(office.child_ids?.map(id)||[]),sorted(g.child_ids.map(id))))fail('assigned-office-graph-mismatch')
   if(geoExtras(office,['location']))reasons.add('unhandled-native-office-geography')
   let result=labelCountries(office.location||office.name,{graph}),ancestor=g
   const qualifiedOffice=source==='esw'&&String(row.id)==='8690613002'&&String(office.id)==='4006080002'&&office.name==='Jersey City, NJ'
   if(qualifiedOffice&&result.codes.some(code=>code!=='US'))reasons.add('qualified-office-city-state-country-contradiction')
   if(qualifiedOffice&&office.location===null&&g.location===null&&!result.codes.length){
    result={codes:['US'],unknown:[],countryInferred:true,countryEvidence:'qualified-job-owned-city-state-with-official-USPS-reference',countryInference:{
     jobId:String(row.id),nativeOfficeId:String(office.id),nativeOfficeName:office.name,nativeOfficeLocation:office.location,
     city:'Jersey City',state:'New Jersey',postalAbbreviation:'NJ',countryCode:'US',
     qualification:'Country inferred from the exact assigned city/state label and official USPS state reference; no native structured country was supplied.',
     reference:{...ESW_JERSEY_CITY_REFERENCE},
    }}
   }
   const inherited=[]
   while(ancestor){const known=country(ancestor.name,true);if(known)inherited.push(known);ancestor=ancestor.parent_id==null?null:graph.get(id(ancestor.parent_id))}
   if(result.codes.length&&inherited.some(c=>!result.codes.includes(c)))reasons.add('contradictory-office-country-hierarchy')
   if(!result.codes.length&&sorted(inherited).length===1)result={codes:sorted(inherited),unknown:[]}
   add('office',office.location||office.name,result,`offices[${i}]`)
  }
  for(const [i,entry]of(row.metadata||[]).entries()){
   if(!entry||typeof entry.name!=='string')fail('malformed-native-metadata')
   if(!GEO.test(entry.name)||entry.value==null||entry.value==='')continue
   if(!/^(?:(?:job|office)\s+)?(?:country|countries|locations?|offices?)$/i.test(entry.name)){reasons.add('unhandled-native-geography');continue}
   for(const value of Array.isArray(entry.value)?entry.value:[entry.value]){if(typeof value!=='string'){reasons.add('unhandled-native-geography');continue}add('metadata',value,labelCountries(value,{typed:/countr/i.test(entry.name),graph}),`metadata[${i}]`)}
  }
  const assigned=sorted(locations.filter(v=>v.kind==='office').flatMap(v=>v.countryCodes))
  // A generic display mode has no country claim; assigned native offices supply
  // the explicit worksite scope. A city or a region is never such a mode.
  if(MODE.test(str(row.location.name))&&assigned.length&&locations.filter(v=>v.kind==='office').every(v=>!v.unresolved)){locations[0].countryCodes=assigned;locations[0].country=assigned.length===1?codes.get(assigned[0]):null;locations[0].unresolved=false;locations[0].countryEvidence='explicit-assigned-native-offices'}
  if(locations.some(v=>v.unresolved))reasons.add('native-worksite-country-unresolved')
  const all=sorted(locations.flatMap(v=>v.countryCodes))
  return {locations,codes:all,reasons,india:all.includes('IN')}
 }
 const listingSignature=rows=>rows.map(r=>({id:id(r.id),title:r.title,internal:r.internal_job_id,req:r.requisition_id,location:r.location,url:r.absolute_url,published:r.published_at,updated:r.updated_at,listed:r.isListed,active:r.active,status:r.status,department:r.department})).sort((a,b)=>a.id.localeCompare(b.id))
 const graphSignature=payload=>payload.offices.map(({id,name,location,parent_id,child_ids,...rest})=>({id,name,location,parent_id,child_ids:sorted(child_ids),extra:Object.fromEntries(Object.entries(rest).filter(([k])=>GEO.test(k)))})).sort((a,b)=>a.id-b.id)
 function schemas(body,key){
  const result=[],visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;if([n['@type']].flat().includes('JobPosting')){if(n.url)jobUrl(n.url,key);if(n.hiringOrganization?.name&&n.hiringOrganization.name!==company)fail('schema-employer-mismatch');result.push(n)}if(n['@graph'])visit(n['@graph'])}
  for(const m of body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi)){let node;try{node=JSON.parse(m[1])}catch{fail('invalid-role-schema-json')};visit(node)}return result
 }
 async function run({fetchImpl=globalThis.fetch,fetchPage,fetchJson,signal,maxJobs=Infinity,onAudit}={}){
  const reasons=new Set(),nativeJobs=[],unresolvedNativeRecords=[],selected=[],channels=new Map();let stopped=false,pagesFetched=0,observedTotal=null,sourceComplete=false,fullContentCount=0,healthyCount=0,observedIndiaCount=0
  const get=async(url,json=false)=>{
   if(stopped)fail('requests-stopped-after-denial');signal?.throwIfAborted();let response,body
   try{
    if(json&&fetchJson){let payload=await fetchJson(url,{method:'GET',signal});pagesFetched++;return payload}
    if(!json&&fetchPage){const v=await fetchPage(url,{method:'GET',signal});if(typeof v==='string'){body=v;response={ok:true,status:200}}else response=v}
    else response=await fetchImpl(url,{method:'GET',signal})
    pagesFetched++;if(body===undefined)body=await response.text()
    if([401,403,429].includes(response.status)||BOT.test(body)){stopped=true;fail(`source-access-denied-${response.status}`)}
    if(!response.ok)fail(`public-http-${response.status}`)
    if(response.url&&new URL(response.url).origin!==new URL(url).origin)fail('unexpected-cross-origin-redirect')
    return json?JSON.parse(body):body
   }catch(error){if(/\b(?:401|403|429)\b|access denied|captcha challenge|verify you are human/i.test(error.message))stopped=true;throw error}
  }
  const boardInventory=async()=>{
   const first=boardPage(await get(board),1),rows=[...first.rows],featured=[...first.featured]
   for(let page=2;page<=first.pages;page++){const next=boardPage(await get(`${board}?page=${page}`),page);if(next.total!==first.total||next.pages!==first.pages||!same(next.offices,first.offices))fail('native-pagination-or-office-drift');rows.push(...next.rows);featured.push(...next.featured)}
   if(rows.length!==first.total||new Set(rows.map(r=>id(r.id))).size!==rows.length)fail('native-count-or-identity-mismatch')
   for(const f of featured)if(!rows.some(r=>same(listingSignature([r]),listingSignature([f]))))fail('unreconciled-featured-job')
   return {...first,rows}
  }
  try{
   const queue=[careers];let bindings=[]
   for(let i=0;i<queue.length;i++){const url=queue[i];if(channels.has(url))continue;const inv=corporate(await get(url),url);channels.set(url,inv);inv.reasons.forEach(r=>reasons.add(r));bindings.push(...inv.bindings);for(const next of inv.channels)if(!queue.includes(next))queue.push(next)}
   // ESW publishes a corporate role shell. Only the first advertised shell is
   // required to establish its current canonical/embed ATS handoff.
   if(!bindings.length&&source==='esw'){
    const key=[...channels.values()].flatMap(c=>c.roleIds)[0];if(key){const url=`https://esw.com/careers/open-roles/${key}/`,inv=corporate(await get(url),url);channels.set(url,inv);bindings.push(...inv.bindings);inv.reasons.forEach(r=>reasons.add(r))}
   }
   if(!bindings.length)fail('current-corporate-ats-binding-unavailable')
   const openingBoard=await boardInventory(),openingPayload=await get(`${api}/jobs?content=true`,true),rows=apiJobs(openingPayload),openingOffices=await get(`${api}/offices`,true),graph=officeGraph(openingOffices,openingBoard.offices,reasons)
   observedTotal=rows.length
   if(!same(sorted(rows.map(r=>id(r.id))),sorted(openingBoard.rows.map(r=>id(r.id)))))fail('native-board-api-identity-set-mismatch')
   for(const c of channels.values())for(const key of c.roleIds)if(!rows.some(r=>id(r.id)===key))reasons.add('corporate-advertised-role-not-native')
   for(const row of rows){
    try{
     const listing=openingBoard.rows.find(r=>id(r.id)===id(row.id)),key=id(row.id),talent=TALENT.test(row.title)
     const internal=row.internal_job_id==null&&talent?null:id(row.internal_job_id),listingInternal=listing.internal_job_id==null&&talent?null:id(listing.internal_job_id)
     if(listing.title!==row.title||listing.location!==row.location.name||jobUrl(listing.absolute_url,key)!==jobUrl(row.absolute_url,key)||listingInternal!==internal||String(listing.requisition_id??'')!==String(row.requisition_id??''))fail('native-board-api-role-identity-mismatch')
     if(row.isListed===false||row.active===false||/closed|expired|draft|unpublished/i.test(row.status||''))fail('native-listed-role-state-mismatch')
     const description=nativePlainText(row.content);if(!description)fail('native-full-criteria-unavailable');fullContentCount++
     const date=publication(row.first_published),geo=geography(row,graph),roleSchemas=[]
     if(!date.value)geo.reasons.add('original-publication-unavailable')
     let detailPublishedAt=null,detailDescriptionHtml=null
     // Fetch a role page when native geography needs evidence or a qualified
     // inference needs role/schema consistency checks. The API has full criteria.
     if(!talent&&(geo.reasons.has('native-worksite-country-unresolved')||geo.locations.some(location=>location.countryInferred===true))){
      try{
      const body=await get(jobUrl(row.absolute_url,key)),d=loader(body)[DETAIL_ROUTE],detail=d?.jobPost
      if(!detail||d.urlToken!==boardToken||String(d.jobPostId)!==key||detail.company_name!==company||detail.post_type!=='job_post'||detail.redirect_to||detail.title!==row.title||id(detail.hiring_plan_id)!==id(row.internal_job_id)||jobUrl(detail.public_url,key)!==jobUrl(row.absolute_url,key)||detail.job_post_location!==row.location.name)fail('native-detail-identity-mismatch')
      if(compact([detail.introduction,detail.content,detail.conclusion].filter(v=>typeof v==='string').join('\n'))!==compact(row.content))fail('native-api-detail-full-criteria-mismatch')
      if(geoExtras(detail,['job_post_location']))geo.reasons.add('unhandled-native-detail-geography')
      detailPublishedAt=detail.published_at??null
      detailDescriptionHtml=[detail.introduction,detail.content,detail.conclusion].filter(v=>typeof v==='string').join('\n')
      roleSchemas.push(...schemas(body,key))
      for(const schema of roleSchemas){
       for(const loc of [schema.jobLocation].flat().filter(Boolean)){
        const address=loc.address;if(!address||typeof address!=='object'){geo.reasons.add('native-schema-country-unresolved');continue}
        const raw=address.addressCountry,label=typeof raw==='string'?raw:raw?.name||raw?.addressCountry,code=country(label,true)
        if(!code){geo.reasons.add('native-schema-country-unresolved');continue}
        if(geoExtras(loc,['address'])||geoExtras(address,['addressLocality','addressRegion','addressCountry','postalCode','streetAddress']))geo.reasons.add('unhandled-native-schema-geography')
        const city=str(address.addressLocality).toLowerCase()
        const cityMatches=city?geo.locations.filter(v=>v.label.toLowerCase().split(/[,|;/]/).map(p=>p.trim()).includes(city)):[]
        const matches=city?cityMatches:geo.locations.filter(v=>v.countryCodes.includes(code))
        if(!matches.length||matches.some(v=>v.countryCodes.length&&!v.countryCodes.includes(code)))geo.reasons.add('schema-feed-worksite-country-contradiction')
        else for(const match of matches){if(!match.countryCodes.length){match.countryCodes=[code];match.country=codes.get(code);match.unresolved=false;match.countryEvidence='current-bound-role-JobPosting-exact-worksite'}}
       }
       if(schema.applicantLocationRequirements||schema.jobLocationType)geo.reasons.add('native-schema-applicant-scope-unresolved')
      }
      if(sorted(roleSchemas.map(s=>s.datePosted).filter(Boolean)).length>1)geo.reasons.add('contradictory-schema-publication-dates')
      for(const schema of roleSchemas){
       for(const field of ['datePosted','dateModified','validThrough'])if(schema[field]!=null){try{const date=publication(schema[field]);if(field==='validThrough'&&Date.parse(date.value)<Date.now())geo.reasons.add('expired-native-schema-role')}catch{geo.reasons.add(`invalid-schema-${field}`)}}
      }
      geo.codes=sorted(geo.locations.flatMap(v=>v.countryCodes));geo.india=geo.codes.includes('IN')
      if(geo.locations.every(v=>!v.unresolved))geo.reasons.delete('native-worksite-country-unresolved')
      }catch(error){if(stopped||signal?.aborted)throw error;geo.reasons.add(`native-geography-detail-unresolved:${error.message}`)}
     }
     const liveDeadline=row.application_deadline?.value??row.application_deadline
     let expiry=null;if(liveDeadline!=null){if(typeof liveDeadline!=='string')geo.reasons.add('unhandled-native-expiry');else{expiry=publication(liveDeadline);if(Date.parse(expiry.value)<Date.now())geo.reasons.add('expired-native-listed-role')}}
     const conflicted=[...geo.reasons].some(r=>/contradict|mismatch/.test(r)),india=geo.india&&!conflicted&&!talent
     const chosen=geo.locations.find(v=>v.countryCodes.includes('IN'))||geo.locations[0]
     const job={source,company,companyDomain:source==='esw'?'esw.com':'extrahop.com',companyCareerPage:careers,atsPlatform:'greenhouse-native-public-api',jobId:key,title:row.title,requisitionId:row.requisition_id==null?null:String(row.requisition_id),nativeInternalJobId:internal,location:chosen?.label||null,country:conflicted?null:india?'India':geo.codes.length===1?codes.get(geo.codes[0]):null,nativePrimaryLocation:row.location.name,sourceLocations:geo.locations,nativeCountryCodes:geo.codes,postingDate:date.value,postingDatePrecision:date.precision,nativeFirstPublished:row.first_published??null,nativeUpdatedAt:row.updated_at??null,nativeBoardPublishedAt:listing.published_at??null,nativeBoardUpdatedAt:listing.updated_at??null,nativeApplicationDeadline:row.application_deadline??null,expiryDate:expiry?.value??null,expiryDatePrecision:expiry?.precision??null,nativeSchemaDates:roleSchemas.map(s=>s.datePosted).filter(Boolean),nativeSchemaDateModified:roleSchemas.map(s=>s.dateModified).filter(Boolean),nativeSchemaValidThrough:roleSchemas.map(s=>s.validThrough).filter(Boolean),applyUrl:jobUrl(row.absolute_url,key),sourceUrl:jobUrl(row.absolute_url,key),link:jobUrl(row.absolute_url,key),department:row.departments?.map(d=>d.name).filter(Boolean).join(' | ')||null,sourceDescription:description,jobDescription:description,description,nativeApiDescriptionHtml:row.content,nativeRecord:row,nativeRoleState:talent?'talent-community':'public-opening',scrapedAt:new Date().toISOString()}
     job.nativeInternalJobId=internal
     job.nativeSchemas=roleSchemas
     job.schemaDatePosted=sorted(roleSchemas.map(s=>s.datePosted).filter(Boolean)).length===1?roleSchemas.find(s=>s.datePosted)?.datePosted:null
     job.nativeUpdatedAtPrecision=publication(job.nativeUpdatedAt).precision
     job.nativeBoardPublishedAtPrecision=publication(job.nativeBoardPublishedAt).precision
     job.nativeBoardUpdatedAtPrecision=publication(job.nativeBoardUpdatedAt).precision
     job.nativeDetailPublishedAtPrecision=publication(detailPublishedAt).precision
     job.schemaDatePostedPrecision=publication(job.schemaDatePosted).precision
     job.nativeDetailPublishedAt=detailPublishedAt
     job.nativeDetailDescriptionHtml=detailDescriptionHtml
     nativeJobs.push(job)
     if(!talent){geo.reasons.forEach(r=>reasons.add(`${key}:${r}`));if(!geo.reasons.size)healthyCount++;if(geo.india)observedIndiaCount++}
     if(india&&![...geo.reasons].some(r=>/expired|identity|full-criteria|employer/.test(r)))selected.push(job)
    }catch(error){if(stopped||signal?.aborted)throw error;unresolvedNativeRecords.push({record:row,reason:error.message});reasons.add(`${row.id}:${error.message}`)}
   }
   for(const[url,inv]of channels){const close=corporate(await get(url),url);if(!same(inv,close))reasons.add('corporate-closing-channel-or-role-drift')}
   const closingBoard=await boardInventory();if(!same(listingSignature(openingBoard.rows),listingSignature(closingBoard.rows))||openingBoard.pages!==closingBoard.pages||openingBoard.total!==closingBoard.total||!same(openingBoard.offices,closingBoard.offices))reasons.add('native-board-closing-inventory-drift')
   const closingPayload=await get(`${api}/jobs?content=true`,true);apiJobs(closingPayload);if(!same(openingPayload,closingPayload))reasons.add('native-api-closing-inventory-drift')
   const closingOffices=await get(`${api}/offices`,true);officeGraph(closingOffices,closingBoard.offices,reasons);if(!same(graphSignature(openingOffices),graphSignature(closingOffices)))reasons.add('native-office-closing-graph-drift')
   if(nativeJobs.length!==rows.length)reasons.add('native-role-coverage-gap')
   sourceComplete=reasons.size===0
  }catch(error){if(signal?.aborted)throw error;reasons.add(error.message)}
  const limit=Number.isFinite(maxJobs)&&maxJobs>=0?Math.floor(maxJobs):Infinity,jobs=selected.slice(0,limit),listingComplete=sourceComplete&&jobs.length===selected.length
  if(jobs.length<selected.length)reasons.add('output-cap')
  for(const job of nativeJobs){job.sourceScopeComplete=sourceComplete;job.sourceListingComplete=listingComplete;job.lifecycleCleanupAllowed=listingComplete}
  onAudit?.({source,sourceComplete,observedNativeTotal:observedTotal,nativeTotal:sourceComplete?observedTotal:null,fullContentCount,healthyNativeCount:healthyCount,observedIndiaCount,observedHealthyIndiaCount:selected.length,indiaCount:sourceComplete?selected.length:null,channels:[...channels.keys()],stoppedAfterDenial:stopped,reasons:[...reasons].sort(),nativeJobs,unresolvedNativeRecords})
  return attachInventoryEvidence(jobs,{status:listingComplete?(observedTotal===0?'verified-empty':'complete-inventory'):'discovery-only',surface:careers,firstParty:channels.has(careers),listingComplete,pagesFetched,reportedTotal:sourceComplete?observedTotal:null,indiaFacetCount:sourceComplete?selected.length:null,verifiedAt:new Date().toISOString(),reason:listingComplete?`${source}-current-corporate-native-full-content-country-graph-and-closing-inventories-reconciled`:`${source}-incomplete:${[...reasons].sort().join(';')}`})
 }
 return {run}
}
