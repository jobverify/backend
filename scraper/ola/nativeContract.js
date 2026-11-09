import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { executableDocument, projectAuthorVisibility, projectedIframeSources } from './nativeVisibility.js'

export const ORIGIN='https://olacareers.turbohire.co'
export const CAREER_PAGE_ID='e0c1eb37-eb7a-4ca4-bcc5-d59ce4ce9212'
export const CAREER_PAGE_URL=ORIGIN+'/careerpage/'+CAREER_PAGE_ID
export const DASHBOARD_URL=ORIGIN+'/dashboardv2'
export const API_BASE_URL='https://thapi.azurewebsites.net'
export const NOAUTH_TOKEN_URL=API_BASE_URL+'/api/token/noauth'
export const ORGANIZATION_URL=API_BASE_URL+'/api/publicorganizations?accountName=olacareers'
export const FILTERED_JOBS_URL=API_BASE_URL+'/api/careerpagev2/filteredjobs?orgId='+CAREER_PAGE_ID+'&pageType=0'
export const SOURCES={
  ola:{companyName:'Ola',corporateURL:'https://www.olacabs.com/careers',delegation:CAREER_PAGE_URL,legalEmployer:'ANI Technologies Pvt Ltd',employerURL:'https://www.olacabs.com/'},
  olaelectric:{companyName:'Ola Electric',corporateURL:'https://www.olaelectric.com/careers',delegation:DASHBOARD_URL+'?orgId='+CAREER_PAGE_ID+'&type=0',legalEmployer:'Ola Electric Mobility Ltd',employerURL:'https://www.olaelectric.com/'},
}
export const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
export const ZERO_GUID='00000000-0000-0000-0000-000000000000'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
export const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Ola native source: '+message),{code:'OLA_NATIVE_CONTRACT'})}
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const canonical=value=>JSON.stringify(value,function(_key,item){return item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item})
export const reviewed=JSON.parse(readFileSync(new URL('./reviewedSurfaces.json',import.meta.url),'utf8'))
export const LIVE_FILTER_BODY={SortByV2:{Key:'PostedDate',Order:2},BunitIds:{Value:null,FilterType:0},Experience:{Value:null,FilterType:0},JobTypes:{Value:null,FilterType:0},JobTypeV2:{Value:null,FilterType:0},Locations:{Value:null,FilterType:0},CreatedDate:{Value:null,FilterType:0},Compensation:{Value:null,FilterType:0},Skills:{Value:null,FilterType:0},Keyword:'',ClientIds:{Value:null,FilterType:0},Department:'',CustomFields:{}}
const executable=node=>node.tag==='script'&&(!node.attrs.type||/^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(node.attrs.type))&&!Object.hasOwn(node.attrs,'nomodule')
const inlineHashes=html=>executableDocument(html).nodes(n=>executable(n)&&!n.attrs.src).map(n=>sha256(n.raw||''))
const scriptURLs=(html,base)=>executableDocument(html).nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>({url:new URL(n.attrs.src,base).href,active:executable(n)}))
const stylesheets=(html,base)=>executableDocument(html).nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>({url:new URL(n.attrs.href,base).href,media:n.attrs.media||null}))
const inlineStyles=html=>[...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>sha256(m[1]))
export const document=(html,css='')=>projectAuthorVisibility(readNativeDocument(html),String(html)+'<style>'+css+'</style>')
export const plain=html=>{const d=document(html);return d.nodes(n=>n.tag==='root').map(n=>d.text(n)).join(' ')}
const compact=html=>plain(html).replace(/\s/g,'')
const closure=text=>/\b(?:this|the)\s+(?:job|role|position|vacancy)\s+(?:(?:is|has been|has)\s+)?(?:closed|filled|expired|removed|cancelled|canceled|withdrawn|no longer (?:available|open|active|accepting applications)|not available)\b|\b(?:applications (?:are |have been )?closed|no longer accepting applications)\b/i.test(text)
export const assetContract=(url,body)=>{const asset=reviewed.assets.find(a=>a.url===url);check(asset&&sha256(body)===asset.sha256,'advertised public asset bytes changed: '+url);return asset}
const nativeClientVersion=html=>{
  const scripts=scriptURLs(html,ORIGIN),baseline=reviewed.surfaces.native
  const versions=[{scriptURLs:baseline.externalScripts.filter(url=>url.startsWith(ORIGIN+'/')),
    externalScripts:baseline.externalScripts,assetURLs:reviewed.assets.filter(a=>a.kind==='js'&&a.url.startsWith(ORIGIN+'/')
      &&(baseline.externalScripts.includes(a.url)||!(reviewed.nativeClientVersions||[]).some(v=>v.assetURLs.includes(a.url)))).map(a=>a.url)},...(reviewed.nativeClientVersions||[])]
  const version=versions.find(v=>{
    if(!scripts.every(s=>s.active))return false
    // A literal fingerprint in live HTML must still be hashed and rejected.
    const urls=scripts.map((s,index)=>/^sha256:[a-f0-9]{64}$/.test(v.externalScripts[index]||'')
      ? 'sha256:'+sha256(s.url) : s.url)
    return canonical(urls)===canonical(v.externalScripts)
  })
  check(version,'native executable client changed or inert')
  return version
}
export const corporateStylesheets=(html,source)=>stylesheets(html,SOURCES[source].corporateURL)
const corporateStyleVersion=(html,source)=>[reviewed.surfaces[source],...(reviewed.corporateStyleVersions?.[source]||[])]
  .find(v=>canonical(corporateStylesheets(html,source))===canonical(v.stylesheets)
    &&canonical(inlineStyles(html))===canonical(v.inlineStyleSHA256))
export const surfaceAssets=(source,html=null,corporateHTML=null)=>{
  const selected=html?new Set(nativeClientVersion(html).assetURLs):null
  const corporateVersions=[reviewed.surfaces[source],...(reviewed.corporateStyleVersions?.[source]||[])]
  const styles=corporateHTML?[corporateStyleVersion(corporateHTML,source)||reviewed.surfaces[source]]:corporateVersions
  return reviewed.assets.filter(a=>(a.url.startsWith(ORIGIN+'/')||styles.some(v=>v.stylesheets.some(s=>s.url===a.url)))
    &&(!selected||a.kind!=='js'||!a.url.startsWith(ORIGIN+'/')||selected.has(a.url)))
}
export function corporateContract(html,source,css='') {
  const cfg=SOURCES[source],baseline=reviewed.surfaces[source],doc=document(html,css),reasons=[]
  check(doc.nodes(n=>n.tag==='base').length===0,'unreviewed corporate base URL')
  const anchors=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({url:new URL(n.attrs.href,cfg.corporateURL).href,text:doc.text(n)}))
  const delegated=anchors.filter(a=>a.url===cfg.delegation&&/openings|opportunities/i.test(a.text))
  if(!delegated.length)reasons.push('corporate-delegation-hidden-inert-or-missing')
  if(!corporateStyleVersion(html,source))reasons.push('unreviewed-corporate-stylesheet-visibility')
  const scripts=scriptURLs(html,cfg.corporateURL)
  if(scripts.some(s=>!s.active)||canonical(scripts.map(s=>s.url))!==canonical(baseline.externalScripts)||canonical(inlineHashes(html))!==canonical(baseline.inlineExecutableSHA256))reasons.push('changed-corporate-executable-client')
  // Magento modules, dynamic scripts and the corporate legal notices do not
  // establish an exhaustive brand/employer boundary for the shared tenant.
  reasons.push('corporate-dynamic-hiring-paths-not-exhaustively-bound','shared-tenant-brand-and-legal-employer-scope-unresolved')
  const extra=anchors.filter(a=>/career|job|hiring|vacanc|open.position|work.with|join.our.team/i.test(a.url+' '+a.text)&&![cfg.corporateURL,cfg.delegation].includes(a.url)&&!/^https:\/\/cdn\.olaelectric\.com\/.*\.(?:mp4|webm)$/i.test(a.url)).map(a=>a.url)
  if(extra.length)reasons.push('additional-corporate-hiring-path')
  const frames=executableDocument(html).nodes(n=>['iframe','object','embed'].includes(n.tag)).map(n=>n.attrs.src||n.attrs.data||'unresolved-frame')
  if(frames.length)reasons.push('unreviewed-corporate-frame')
  return {reasons,delegationVisible:delegated.length>0,extraHiringPaths:[...new Set(extra)].sort(),frames,scripts:scripts.map(s=>s.url),inlineExecutableSHA256:inlineHashes(html),stylesheets:stylesheets(html,cfg.corporateURL),legalNotices:[...plain(html).matchAll(/Copyright[^.]{0,100}(?:Pvt Ltd|Mobility Ltd)/gi)].map(m=>m[0])}
}
export function nativeSurfaceContract(html,css='',{role=false}={}) {
  const baseline=reviewed.surfaces.native,doc=document(html,css),scripts=scriptURLs(html,ORIGIN)
  check(canonical(stylesheets(html,ORIGIN))===canonical(baseline.stylesheets)&&canonical(inlineStyles(html))===canonical(baseline.inlineStyleSHA256),'unreviewed native stylesheet visibility')
  const version=nativeClientVersion(html)
  check(canonical(inlineHashes(html))===canonical(baseline.inlineExecutableSHA256),'native executable client changed or inert')
  check(doc.nodes(n=>n.tag==='base').length===0&&projectedIframeSources(doc).length===0&&executableDocument(html).nodes(n=>['iframe','object','embed'].includes(n.tag)).length===0,'unreviewed native base/frame')
  check(doc.nodes(n=>n.tag==='div'&&n.attrs.id==='root').length===1,'native public application root hidden or missing')
  const data=executableDocument(html).nodes(n=>n.tag==='script'&&!n.attrs.src&&!executable(n))
  check(data.length===1&&data[0].attrs.type==='application/ld+json'&&(role||data[0].raw==='$GOOGLE_LD'),'unreviewed native inline configuration')
  const links=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>new URL(n.attrs.href,ORIGIN).href)
  if(!role)check(links.length===0,'unreviewed native board hiring link')
  return {doc,links,authorCSS:css,nativeClientURLs:version.scriptURLs,
    visibleClosure:closure(doc.nodes(n=>n.tag==='body').map(n=>doc.text(n)).join(' '))}
}
export function organizationContract(value) {
  check(value&&typeof value==='object'&&!Array.isArray(value)&&value.OrgID===CAREER_PAGE_ID,'public tenant identity changed')
  check(value.OrgName==='ANI Technologies Pvt Ltd'&&value.OrgURL==='https://www.olaelectric.com/'&&value.CareerPageSubdomain==='olacareers'&&value.IsCareerPagePublished===true,'public tenant website/name/publication changed')
  const pages=value.CareerPages?.filter(p=>p.Type==='CAREER_PAGE')
  check(pages?.length===1&&/Ola Electric/.test(pages[0].BannerSubText||''),'native public brand context changed')
  return {OrgID:value.OrgID,OrgName:value.OrgName,OrgURL:value.OrgURL,CareerPageSubdomain:value.CareerPageSubdomain,IsCareerPagePublished:true,CareerPage:{Type:'CAREER_PAGE',BannerText:pages[0].BannerText,BannerSubText:pages[0].BannerSubText}}
}
export function listingContract(value) {
  check(value&&typeof value==='object'&&!Array.isArray(value)&&Number.isSafeInteger(value.Total)&&value.Total>=0&&Array.isArray(value.Result)&&value.Result.length<=10000,'invalid native global listing')
  const reasons=[],seen=new Set(),records=[]
  if(Object.keys(value).some(k=>!['Total','Result'].includes(k)))reasons.push('unknown-native-continuation-or-list-metadata')
  for(const row of value.Result){check(row&&typeof row==='object'&&UUID.test(row.JobId)&&typeof row.JobTitle==='string'&&norm(row.JobTitle),'invalid native job identity');if(seen.has(row.JobId)){reasons.push('duplicate-native-job-id');continue}seen.add(row.JobId);records.push(row)}
  // Current public client returns the complete array, then paginates locally.
  // No guessed offset/page/limit request is permitted if this stops exhausting.
  if(value.Total!==records.length)reasons.push('native-total-not-exhausted')
  return {records,total:value.Total,reasons}
}
export const jobURL=id=>ORIGIN+'/job/publicjobs/'+id
export const publicJobURL=id=>API_BASE_URL+'/api/publicjobs/'+id+'?fieldVisibility=CareerPage'
export function dateValue(raw,{expiry=false}={}) {
  check(typeof raw==='string','missing native date')
  const exact=/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?Z$/.exec(raw),day=expiry&&/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0{1,7})?)?$/.exec(raw)
  check(exact||day,'unsupported ambiguous native date')
  const value=exact?exact[1]+'T'+exact[2]+'.'+(exact[3]||'').padEnd(3,'0').slice(0,3)+'Z':day[1]+'T00:00:00.000Z',instant=+new Date(value)
  check(Number.isFinite(instant)&&new Date(instant).toISOString()===value,'impossible native date')
  return {raw,value:exact?raw:day[1],day:raw.slice(0,10),instant,exact:Boolean(exact),precision:exact?(exact[3]?'fractional-second':'second'):'day'}
}
const visibleSection=(html,css,label)=>{
  check(typeof html==='string','invalid '+label+' HTML')
  check(!/<!--|<(?:script|style|link|iframe|object|embed|form|input|button|select|option|fieldset)\b/i.test(html),'unreviewed '+label+' executable/style/form/comment content')
  const doc=document(html,css),root=doc.nodes(n=>n.tag==='root')[0]
  check(root,'missing active '+label+' content')
  const visit=node=>{
    // Comparing visible text alone cannot authorize returning the original
    // raw subtree. Exclude mixed visible/hidden or parser-inert criteria.
    check(!node.inert&&!Object.hasOwn(node,'raw'),'hidden or inert '+label+' content')
    for(const child of node.children||[])if(typeof child!=='string')visit(child)
  }
  visit(root)
  if(html)check(doc.text(root).length>0,'empty active '+label+' content')
  return html
}
const sections=(dto,css='')=>['JobDescription','RolesAndResponsibilities','Eligibility'].map(key=>{
  const v2=dto[key+'V2'],legacy=dto[key]
  check((v2==null||typeof v2==='string')&&(legacy==null||typeof legacy==='string'),'invalid full role section')
  if(v2&&legacy)check(compact(v2)===compact(legacy),'native full-description versions disagree')
  const selected=v2||legacy||''
  visibleSection(selected,css,'full role section')
  return [key+'V2',selected]
})
const structuredCriteria=(posting,css='')=>{
  const labels={qualifications:'Qualifications',educationRequirements:'Education requirements'},native={},parts=[],qualificationValues=[]
  for(const key of Object.keys(posting)){
    if(/qualificat|education|requirement|skill|experience|responsibilit|credential|certification|competenc/i.test(key)&&!Object.hasOwn(labels,key))check(posting[key]==null,'unsupported structured role criterion: '+key)
  }
  for(const [key,label]of Object.entries(labels)){
    if(!Object.hasOwn(posting,key))continue
    const value=posting[key]
    native[key]=value
    if(value==null||value==='')continue
    check(typeof value==='string'||Array.isArray(value)&&value.every(v=>typeof v==='string'&&norm(v)),'unsupported structured '+key+' shape')
    const values=Array.isArray(value)?value:[value]
    for(const text of values){visibleSection(text,css,'structured '+key);qualificationValues.push(text)}
    if(values.length)parts.push('<h3>'+label+'</h3>\n'+values.join('\n'))
  }
  return {native,html:parts.join('\n'),minimumQualification:qualificationValues.join('\n')||null}
}
const employmentContract=(row,dto,posting)=>{
  // These aliases come from the pinned client's FTE/PTE/CONTRACT/INTERN/OTHER
  // native types. Unsupported shapes or labels cannot establish agreement.
  const aliases={FULLTIME:'FULL_TIME',FTE:'FULL_TIME',PARTTIME:'PART_TIME',PTE:'PART_TIME',CONTRACT:'CONTRACTOR',CONTRACTOR:'CONTRACTOR',INTERN:'INTERN',INTERNSHIP:'INTERN',OTHER:'OTHER'}
  const read=(value,label)=>{
    if(value==null||value==='')return null
    check(typeof value==='string','unsupported '+label+' shape')
    const key=value.replace(/[\s_-]/g,'').toUpperCase()
    if(['UNSPECIFIED','SELECT'].includes(key))return null
    check(Object.hasOwn(aliases,key),'unsupported '+label+' value')
    return aliases[key]
  }
  const supplied=[['listing JobTypeV2',row.JobTypeV2],['listing Type',row.Type],['public DTO JobTypeV2',dto.JobTypeV2],['public DTO Type',dto.Type],['schema employmentType',posting.employmentType]].map(([label,value])=>read(value,label)).filter(Boolean)
  check(new Set(supplied).size<=1,'schema/native employment type disagreement')
  const value=read(dto.JobTypeV2,'public DTO JobTypeV2')?dto.JobTypeV2:read(posting.employmentType,'schema employmentType')?posting.employmentType:read(dto.Type,'public DTO Type')?dto.Type:null
  return {value,canonical:supplied[0]||null,schema:posting.employmentType??null}
}
const optionalExpiry=record=>{
  const dates=record.ExpiryDates
  check(dates==null||typeof dates==='object'&&!Array.isArray(dates),'invalid native expiry map')
  const raw=dates?.CAREERPAGE
  return raw==null||raw===''?null:raw
}
function postingContract(page,row) {
  const postings=[]
  const visit=value=>{check(value&&typeof value==='object','invalid native structured data');if(Array.isArray(value))return value.forEach(visit);if([value['@type']].flat().includes('JobPosting'))postings.push(value);if(value['@graph'])visit(value['@graph'])}
  for(const n of page.doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))visit(JSON.parse(n.raw))
  check(postings.length===1,'missing or ambiguous public JobPosting')
  const posting=postings[0]
  check(norm(posting.title)===norm(row.JobTitle)&&typeof posting.description==='string'&&plain(posting.description).length>=200,'native role title/full description mismatch')
  check(!page.visibleClosure,'native page visibly closed')
  const hiring=posting.hiringOrganization
  check(hiring&&typeof hiring.name==='string'&&typeof hiring.sameAs==='string','missing exact role-owned employer')
  check(Object.keys(hiring).every(k=>['@type','name','sameAs','logo'].includes(k)),'unreviewed hiring organization hierarchy')
  const employers=Object.entries(SOURCES).filter(([,cfg])=>cfg.legalEmployer===hiring.name&&cfg.employerURL===hiring.sameAs)
  check(employers.length===1,'unresolved role-owned legal employer/brand')
  if(posting.identifier)check(posting.identifier.value===row.JobId,'schema role identity mismatch')
  if(posting.url)check(posting.url===jobURL(row.JobId),'schema application context mismatch')
  check(!Object.keys(posting).some(k=>/hiring|employer|country|location|eligib/i.test(k)&&!['hiringOrganization','jobLocation'].includes(k)),'unreviewed structured employer or work-country hierarchy')
  return {posting,employerSource:employers[0][0]}
}
function countryContract(row,dto,posting,html) {
  for(const record of [row,dto])check(!Object.keys(record).some(k=>k!=='Location'&&/country|joblocation|address|locations|hiringorganization|employer/i.test(k)),'unreviewed role employer/country field')
  check(typeof dto.Location==='string'&&dto.Location===row.Location,'listing/detail work location disagreement')
  const locations=JSON.parse(dto.Location)
  check(Array.isArray(locations)&&locations.length>0&&locations.length<=64,'missing typed native work addresses')
  const addresses=locations.map(l=>{check(l&&typeof l==='object'&&Object.keys(l).every(k=>['Address','PlaceId'].includes(k))&&typeof l.Address==='string'&&norm(l.Address),'unknown typed native address');return norm(l.Address)})
  const remote=addresses.some(a=>/^remote(?: job)?$/i.test(a)),countries=[]
  for(const address of addresses){if(/^remote(?: job)?$/i.test(address))continue;const country=nativeLocationCountryName(address);check(country,'unknown explicit native work country');countries.push(country)}
  const labels=[...plain(html).matchAll(/\bLocation\s*:\s*([\s\S]*?)(?=\bLocation\s*:|\b(?:Department|Role Overview|Role|Experience|Employment Type)\s*:|$)/gi)].map(m=>norm(m[1]))
  const remoteIndia=labels.some(l=>/^(?:India\s*\(Remote\)|Remote\s*[,(-]?\s*India\s*\)?)$/i.test(l))
  for(const label of labels){const country=/^(?:India\s*\(Remote\)|Remote\s*[,(-]?\s*India\s*\)?)$/i.test(label)?'India':nativeLocationCountryName(label);check(country,'unknown role-owned Location country');countries.push(country)}
  if(remote)check(remoteIndia,'remote placeholder without explicit role-owned country')
  const native=[posting.jobLocation].flat();check(native.length>0&&native.length<=64,'missing schema work addresses')
  const schemaCountries=native.map(l=>{const a=l?.address;check(a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).every(k=>['@type','addressCountry','addressLocality','addressRegion','postalCode','streetAddress'].includes(k)),'unreviewed schema work address');const country=nativeCountryName(a.addressCountry);check(country,'unknown schema work country');check(addresses.some(b=>norm(a.addressLocality)===b&&(/^remote(?: job)?$/i.test(b)?remoteIndia&&country==='India':nativeLocationCountryName(b)===country)),'schema/detail work locality or country conflict');return country})
  const unique=[...new Set(countries)].sort();check(unique.length>0&&canonical(unique)===canonical([...new Set(schemaCountries)].sort()),'role/schema country disagreement')
  return {addresses,countries:unique,remote,location:remote?'Remote, India':addresses.join(' / ')}
}
export function roleContract(row,dto,page,source,now) {
  check(dto&&typeof dto==='object'&&dto.JobId===row.JobId&&norm(dto.JobTitle)===norm(row.JobTitle)&&dto.JobCode===row.JobCode,'listing/full role identity conflict')
  check(dto.JobStatus==='Active'&&dto.IsPublic===true&&dto.IsDraft===false,'role is not active published public inventory')
  check(Array.isArray(dto.PublishedJobBoards)&&dto.PublishedJobBoards.includes('CAREERPAGE'),'role absent from public career board')
  for(const item of [row.OrgDetails,dto.OrgDetails])check(item?.OrgID===CAREER_PAGE_ID&&(!item.CareerPageSubdomain||item.CareerPageSubdomain==='olacareers')&&(!item.OrgName||item.OrgName==='ANI Technologies Pvt Ltd')&&(!item.OrgURL||item.OrgURL==='https://www.olaelectric.com/'),'role tenant identity mismatch')
  for(const item of [row,dto]){
    check(!item.ClientName&&!item.ShowClientName&&(!item.ClientId||item.ClientId===ZERO_GUID),'unreviewed client hiring hierarchy')
    check(!Object.keys(item).some(k=>/employer|hiringfor|hiringorganization|clientdetails|clients?additional|subsidiary|parentorganization/i.test(k)),'unreviewed employer hiring hierarchy')
    const nonempty=value=>value!=null&&value!==''&&value!==false&&value!==ZERO_GUID&&!(Array.isArray(value)&&value.length===0)&&!(typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===0)
    check(!['ClientCompany','ClientDesc','ClientDescV2'].some(k=>nonempty(item[k])),'unreviewed native client employer context')
    const known=new Set(['JobDescription','JobDescriptionV2','JobDescV2','RolesAndResponsibilities','RolesAndResponsibilitiesV2','Eligibility','EligibilityV2','Skills','Experience'])
    check(!Object.keys(item).some(k=>!known.has(k)&&/description|qualification|requirement|education|skill|experience/i.test(k)&&nonempty(item[k])),'unreviewed native role criteria or attachment field')
  }
  check(dto.OrgDetails.IsCareerPagePublished===true,'full role tenant not published')
  const {posting,employerSource}=postingContract(page,row),nativeSections=Object.fromEntries(sections(dto,page.authorCSS)),html=Object.values(nativeSections).filter(Boolean).join('\n')
  visibleSection(posting.description,page.authorCSS,'schema full description')
  const country=countryContract(row,dto,posting,html),criteria=structuredCriteria(posting,page.authorCSS),employment=employmentContract(row,dto,posting)
  const publishedHTML=[html,criteria.html].filter(Boolean).join('\n')
  check(plain(nativeSections.JobDescriptionV2).length>=200&&compact(html)===compact(posting.description),'complete DTO/schema body conflict or clipped full description')
  check(!closure(plain(publishedHTML)),'full role explicitly closed')
  for(const key of ['Skills','Experience','Department','JobTypeV2','Type'])if(row[key]!=null)check(canonical(row[key])===canonical(dto[key]),'listing/full role criteria disagreement: '+key)
  if(row.JobDescV2)check(compact(html).startsWith(compact(row.JobDescV2)),'listing preview/full role body disagreement')
  check(dto.PublishedDates&&typeof dto.PublishedDates==='object'&&!Array.isArray(dto.PublishedDates),'missing board publication lifecycle')
  const posted=dateValue(dto.PublishedDates.CAREERPAGE),general=dto.PublishedDate==null?null:dateValue(dto.PublishedDate),expiryRaw=optionalExpiry(dto),expiry=expiryRaw==null?null:dateValue(expiryRaw,{expiry:true})
  check(posted.raw===row.PublishedDate&&expiryRaw===optionalExpiry(row),'listing/detail public board dates conflict')
  check(posted.instant<=+new Date(now)&&(!expiry||expiry.instant>posted.instant),'future publication or invalid expiry')
  check(posting.datePosted===posted.day||posting.datePosted===posted.raw,'CAREERPAGE/schema publication conflict')
  if(posting.validThrough!=null&&posting.validThrough!==''){
    check(expiry,'schema expiry without a native public board expiry')
    const schemaExpiry=dateValue(posting.validThrough,{expiry:true})
    check(schemaExpiry.exact&&expiry.exact?schemaExpiry.instant===expiry.instant:schemaExpiry.day===expiry.day,'schema/public board expiry disagreement')
  }
  // The pinned public client checks expiry only when CAREERPAGE has a value;
  // absent/null expiry is an open-ended role, rather than an invented date.
  if(expiry)check(expiry.exact?expiry.instant>+new Date(now):expiry.instant-14*3600000>+new Date(now),'expired role or ambiguous expiry-day boundary')
  check(Array.isArray(dto.Skills)&&dto.Skills.every(s=>typeof s==='string'&&norm(s)),'invalid native skills')
  const experience=dto.Experience;check(experience&&typeof experience==='object'&&!Array.isArray(experience),'missing native experience')
  check(Object.keys(experience).every(k=>['MinExp','MaxExp'].includes(k)),'unreviewed experience units or fields')
  for(const bound of [experience.MinExp,experience.MaxExp])check(bound==null||typeof bound==='number'&&Number.isFinite(bound)&&bound>=0,'invalid native experience bound')
  const bounds=experience.MinExp!=null&&experience.MaxExp!=null
  check(!bounds||experience.MaxExp>=experience.MinExp,'invalid native experience bounds')
  const experienceRequired=bounds?(experience.MinExp===experience.MaxExp?experience.MinExp+' years':experience.MinExp+'-'+experience.MaxExp+' years'):experience.MinExp!=null?experience.MinExp+'+ years':experience.MaxExp!=null?'Up to '+experience.MaxExp+' years':null
  check(dto.RequisitionId==null||typeof dto.RequisitionId==='string'&&UUID.test(dto.RequisitionId),'invalid requisition identity')
  const requisitionId=dto.RequisitionId&&dto.RequisitionId!==ZERO_GUID?dto.RequisitionId:null
  check(dto.JobIdObfuscated===row.JobId&&(!row.JobIdObfuscated||row.JobIdObfuscated===dto.JobIdObfuscated),'application role identity disagreement')
  check(dto.ApplicationEnquiryTemplateId==null||UUID.test(dto.ApplicationEnquiryTemplateId),'invalid public application template identity')
  check(Array.isArray(dto.AdditionalFields)&&dto.AdditionalFields.length===0,'unreviewed role custom fields')
  const roleLinks=page.links;check(roleLinks.every(u=>u===DASHBOARD_URL||u===jobURL(row.JobId)),'unreviewed public role hiring link')
  const nativeListingState=Object.fromEntries(['JobId','JobIdObfuscated','JobCode','JobTitle','Department','PublishedDate','ExpiryDates','Location','Type','JobTypeV2','ShowClientName','ClientName','Experience','Skills','JobDescV2'].map(k=>[k,row[k]]))
  const semantic={jobId:dto.JobId,jobCode:dto.JobCode,title:dto.JobTitle,requisitionId,location:dto.Location,department:dto.Department,type:dto.Type,jobType:dto.JobTypeV2,experience,skills:dto.Skills,nativeSections,publishedDates:dto.PublishedDates,expiryDates:dto.ExpiryDates,general:dto.PublishedDate,boards:dto.PublishedJobBoards,jobStatus:dto.JobStatus,isPublic:dto.IsPublic,isDraft:dto.IsDraft,applicationTemplateId:dto.ApplicationEnquiryTemplateId,applicationRoleId:dto.JobIdObfuscated,posting,employerSource,roleLinks,nativeListingState}
  const cfg=SOURCES[employerSource]
  const selectedAddresses=country.countries.includes('India')?country.addresses.filter(a=>/^remote(?: job)?$/i.test(a)||nativeLocationCountryName(a)==='India'):country.addresses
  check(selectedAddresses.length>0,'missing address for the selected work-country scope')
  const selectedRemote=selectedAddresses.some(a=>/^remote(?: job)?$/i.test(a)),displayCountry=country.countries.includes('India')?'India':country.countries.join(' / '),displayLocation=selectedAddresses.map(a=>/^remote(?: job)?$/i.test(a)?'Remote, India':a).join(' / ')
  return {semantic,employerSource,countries:country.countries,job:{id:dto.JobId,jobId:dto.JobId,sourceJobId:dto.JobId,jobCode:dto.JobCode,requisitionId,source,company:cfg.companyName,legalEmployer:posting.hiringOrganization.name,nativeHiringOrganization:posting.hiringOrganization,title:dto.JobTitle,department:dto.Department||null,employmentType:employment.value,nativeJobType:dto.Type,nativeSchemaEmploymentType:employment.schema,nativeEmploymentTypeCanonical:employment.canonical,sourceUrl:jobURL(row.JobId),applyUrl:jobURL(row.JobId),link:jobURL(row.JobId),country:displayCountry,location:displayLocation,city:!selectedRemote&&selectedAddresses.length===1?selectedAddresses[0].split(',')[0]:null,remoteStatus:selectedRemote?'Remote':null,nativeLocationAddresses:country.addresses,nativeCountryEvidence:{addresses:country.addresses,schemaCountries:country.countries,roleOwnedRemoteCountry:country.remote},nativeExperience:experience,experienceRequired,sourceExperienceRequired:experienceRequired,experienceRequiredProvenance:experienceRequired?'source':null,requiredSkills:dto.Skills,jobDescription:publishedHTML,sourceDescription:publishedHTML,nativeDescriptionSections:nativeSections,nativeStructuredCriteria:criteria.native,minimumQualification:criteria.minimumQualification,nativeSchemaDescription:posting.description,postingDate:posted.raw,postedAt:posted.raw,nativePublicationDate:posted.raw,nativePublicationPrecision:posted.precision,nativePublicationSource:'publicjobs.PublishedDates.CAREERPAGE',nativePublicationGeneral:general?.raw||null,nativePublishedDates:dto.PublishedDates,closingDate:expiry?.value??null,nativeExpiryRaw:expiry?.raw??null,nativeExpiryPrecision:expiry?.precision??null,sourceClosingDateIsExact:expiry?.exact??false,nativeExpirySource:expiry?'publicjobs.ExpiryDates.CAREERPAGE':null,nativeExpiryDates:dto.ExpiryDates??null,nativeExpiryState:expiry?'specified':'not-specified',firstEverPublication:null,nativeApplicationTemplateId:dto.ApplicationEnquiryTemplateId===ZERO_GUID?null:dto.ApplicationEnquiryTemplateId||null,applicationLinkSource:'official-corporate-delegation+current-native-public-client',publicRolePageFetched:true,applicationPublicContextValidated:true,applicationSubmitted:false,candidateActionsTaken:false,sourceDetailComplete:true,sourceDetailStatus:'complete',sourceAvailabilityVerified:true,sourceActive:true,scrapedAt:now}}
}
