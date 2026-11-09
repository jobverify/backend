import {readNativeDocument,decodeNativeEntities,extractActiveDescription} from '../../utils/activeNativeHtml.js'
import {plainHTML,countryName,nodeText} from '../jobPostingData.js'
import {readLiteralModel} from '../literalModel.js'
export const text=v=>typeof v==='string'?v.replace(/\s+/g,' ').trim():''
export const ensure=(ok,message)=>{if(!ok)throw Error('Public Workable: '+message)}
export const equal=(a,b)=>{
 if(a===b)return true
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]))
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]))
}
export const codeValid=code=>typeof code==='string'&&/^[A-Z0-9]{6,32}$/.test(code)
export const employment=value=>({full:'Full-time',part:'Part-time',contract:'Contract',temp:'Temporary',intern:'Internship',volunteer:'Volunteer',other:'Other'})[value]??null
export const publicURLs=(p,id)=>({board:`https://apply.workable.com/${p.tenant}/`,account:`https://apply.workable.com/api/v1/accounts/${p.tenant}`,
 collection:`https://www.workable.com/api/accounts/${p.tenant}?details=true`,widget:`https://apply.workable.com/api/v1/widget/accounts/${p.tenant}?details=true`,
 ownAPI:`https://apply.workable.com/api/v2/accounts/${p.tenant}/jobs/${id}`,generic:`https://apply.workable.com/j/${id}`,
 own:`https://apply.workable.com/${p.tenant}/j/${id}`,markdown:`https://apply.workable.com/${p.tenant}/jobs/view/${id}.md`})
export const accountMatches=(p,a)=>{
 let url;try{url=new URL(a?.url)}catch{return false}
 return a?.ok!==false&&a?.success!==false&&!a?.error&&a?.status!=='error'&&a?.id===p.accountId&&a?.uid===p.accountUid&&a?.subdomain===p.tenant&&a?.name===p.companyName
  &&['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'&&url.hostname.replace(/^www\./,'')===p.domain
}
export const pageIdentity=(page,title,canonical=null)=>{
 const d=readNativeDocument(page.originalText),titles=d.nodes(n=>n.tag==='title').map(n=>text(decodeNativeEntities(n.raw)))
 ensure(titles.length===1&&titles[0]===title,'own/board title identity changed')
 if(canonical){const links=d.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))
  ensure(links.length===1&&new URL(links[0].attrs.href,page.url).href===canonical,'own role canonical identity changed')}
 return d
}
// Read the published JSON assignment as literal data only. This context contains
// feature flags/config, never vacancy identity, recruitment or country authority.
export const ownContext=html=>{
 const scripts=readNativeDocument(html).nodes(n=>n.tag==='script'&&!n.attrs.src),values=[]
 for(const script of scripts){const raw=script.raw||'',match=raw.match(/^\s*window\.careers\s*=\s*([\s\S]*?)\s*;?\s*$/)
  if(match){let literal=match[1];if(literal.endsWith(';'))literal=literal.slice(0,-1);values.push(readLiteralModel(literal).value)}}
 ensure(values.length===1&&values[0]&&typeof values[0]==='object'&&!Array.isArray(values[0]),'own literal page context unavailable or ambiguous')
 return values[0]
}
export const markdownRows=(p,raw)=>{
 ensure(typeof raw==='string'&&raw.startsWith('# '+p.companyName+' ')&&raw.includes('| Title | Department | Location | Type | Salary | Posted | Details |'),'markdown collection contract changed')
 const rows=[],issues=[];let inFence=false
 for(const line of raw.split(/\r?\n/)){
  if(/^\s*```|^\s*~~~/.test(line)){inFence=!inFence;continue}
  if(inFence||!line.startsWith('|')||!line.includes('[View]('))continue
  const cells=line.split('|').slice(1,-1).map(v=>v.trim()),links=[...line.matchAll(/\[View\]\((https:\/\/apply\.workable\.com\/[^\s)]+)\)/g)]
  let id=null,url=null
  if(links.length===1){try{const u=new URL(links[0][1]);id=u.pathname.match(new RegExp('^/'+p.tenant+'/jobs/view/([A-Z0-9]{6,32})\\.md$'))?.[1]??null;if(id&&!u.search&&!u.hash)url=u.href;else id=null}catch{}}
  if(!id){issues.push({kind:'malformed-markdown-peer',originalLine:line});continue}
  const contractQualified=cells.length===7&&cells[6]==='[View]('+url+')'&&Boolean(cells[0])&&/^\d{4}-\d{2}-\d{2}$/.test(cells[5])
  const value=index=>cells.length===7?cells[index]:null
  rows.push({id,url,title:value(0),department:value(1),location:value(2),employmentType:value(3),salary:value(4),published:value(5),originalLine:line,contractQualified})
  if(!contractQualified)issues.push({kind:'malformed-markdown-peer',id,originalLine:line})
 }
 const counts=new Map();for(const row of rows)counts.set(row.id,(counts.get(row.id)||0)+1)
 for(const row of rows)if(counts.get(row.id)>1){row.contractQualified=false;issues.push({kind:'duplicate-markdown-identity',id:row.id,originalLine:row.originalLine})}
 return {rows,issues}
}

export const geography=detail=>{
 const input=Array.isArray(detail?.locations)?detail.locations:[],locations=[],countries=[];let unresolved=input.length===0
 for(const l of input){
  if(!l||typeof l!=='object'||Array.isArray(l)||l.hidden!==false){unresolved=true;continue}
  const code=countryName(l.countryCode),label=countryName(l.country)
  if(!code||text(l.country)&&label!==code){unresolved=true;continue}
  if(!countries.includes(code))countries.push(code)
  locations.push({country:code,city:text(l.city)||null,state:text(l.region)||null,
   location:[text(l.city),text(l.region),code].filter(Boolean).join(', ')})
 }
 const one=locations.length===1?locations[0]:null
 return {country:countries.length===1?countries[0]:null,countries,city:one?.city??null,state:one?.state??null,
  location:locations.length?locations.map(l=>l.location).join(' | '):'Location undisclosed',locations,unresolved,originalJobLocations:input}
}
const nonGeo=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['country','city','state','locations'].includes(k)))
const worksiteShape=value=>value&&typeof value==='object'&&!Array.isArray(value)
 && ['country','countryCode','city','region','hidden'].some(k=>Object.hasOwn(value,k))
 && ['country','countryCode','city','region'].every(k=>value[k]==null||typeof value[k]==='string')
 && (value.hidden==null||typeof value.hidden==='boolean')
 && !(countryName(value.country)&&countryName(value.countryCode)&&countryName(value.country)!==countryName(value.countryCode))
const sameLocation=(a,b)=>['country','countryCode','city','region','hidden'].every(k=>(a?.[k]??null)===(b?.[k]??null))
export const validatePair=(p,id,variants,detail,own,mdRow,ownMarkdown)=>{
 ensure(detail&&typeof detail==='object'&&!Array.isArray(detail),'native own model unavailable')
 ensure(detail.ok!==false&&detail.success!==false&&!detail.error&&detail.status!=='error','native own error envelope')
 ensure(detail.accountUid===p.accountUid&&detail.shortcode===id&&Number.isSafeInteger(detail.id)&&detail.id>0,'native own account/post identity changed')
 ensure(detail.state==='published'&&detail.isInternal===false&&detail.approvalStatus==='approved','native own publication eligibility changed')
 ensure(text(detail.title)&&typeof detail.published==='string'&&Number.isFinite(Date.parse(detail.published)),'native title/publication missing')
 ensure(extractActiveDescription(detail.description),'native description unavailable or hidden')
 for(const key of ['requirements','benefits'])if(detail[key]!=null&&detail[key]!=='')ensure(typeof detail[key]==='string'&&extractActiveDescription(detail[key]),'native '+key+' unavailable or hidden')
 ensure(Array.isArray(detail.locations)&&detail.locations.length>0,'native worksite collection missing')
 ensure(detail.locations.every(worksiteShape),'malformed native worksite element')
 if(detail.location!=null)ensure(worksiteShape(detail.location),'malformed native primary worksite')
 const urls=publicURLs(p,id);ensure(own?.url===urls.own||own?.url===urls.own+'/','own redirect points outside native tenant/post')
 pageIdentity(own,detail.title+' - '+p.companyName,urls.own);const context=ownContext(own.originalText)
 for(const row of variants){
  ensure(row&&typeof row==='object'&&!Array.isArray(row),'malformed posting row')
  ensure(equal(nonGeo(row),nonGeo(variants[0])),'contradictory duplicate location views')
  ensure(row.shortcode===id&&row.title===detail.title&&(row.code??null)===(detail.code??null),'listing/native identity or employer code changed')
  ensure(row.url===urls.generic&&row.shortlink===urls.generic&&row.application_url===urls.generic+'/apply','published own/application declaration changed')
  ensure(typeof row.published_on==='string'&&row.published_on===detail.published.slice(0,10),'publication date contradiction')
  ensure(row.telecommuting===detail.remote,'native remote flag contradiction')
  if(row.employment_type!=null||detail.type!=null)ensure(row.employment_type===employment(detail.type),'native employment type contradiction')
  ensure(Array.isArray(detail.department)&&row.department===detail.department.join(', '),'native department contradiction')
  ensure(Array.isArray(row.locations)&&row.locations.length>0&&row.locations.every(worksiteShape)&&row.locations.every(l=>detail.locations.some(r=>sameLocation(l,r))),'listing/native worksite projection contradiction')
  if(text(row.country))ensure(row.locations.some(l=>l.country===row.country),'listing country projection contradiction')
  const listing=plainHTML(row.description)
  for(const key of ['description','requirements','benefits'])if(text(detail[key]))ensure(listing.includes(plainHTML(detail[key])),'listing/native '+key+' contradiction')
 }
 for(const key of ['salary_from','salary_to'])if(detail[key]!=null)ensure(typeof detail[key]==='number'&&Number.isFinite(detail[key])&&detail[key]>=0,'native salary amount invalid')
 if(detail.salary_from!=null&&detail.salary_to!=null)ensure(detail.salary_from<=detail.salary_to,'native salary range inverted')
 if(mdRow){
  ensure(mdRow.contractQualified!==false,'ambiguous or malformed Markdown declaration for this post')
  ensure(mdRow.title===detail.title&&mdRow.published===detail.published.slice(0,10),'markdown/native identity/publication contradiction')
  ensure(typeof ownMarkdown==='string'&&ownMarkdown.startsWith('# '+detail.title+'\n'),'own markdown title unavailable')
  const compact=value=>value.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()
  for(const [key,label]of [['description','Description'],['requirements','Requirements'],['benefits','Benefits']]){
   const matches=[...ownMarkdown.matchAll(new RegExp('^## '+label+'\\r?\\n','gm'))]
   ensure(matches.length<=1,'ambiguous own markdown '+key+' section')
   let part=''
   if(matches.length){part=ownMarkdown.slice(matches[0].index+matches[0][0].length);const end=part.search(/^## (?:Description|Requirements|Benefits|Apply)\r?$|^---\s*$/m);if(end>=0)part=part.slice(0,end)}
   const decoded=part.replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\\([\\`*_[\]{}()#+.!-])/g,'$1')
   ensure(compact(decoded)===compact(plainHTML(detail[key]||'')),'own markdown/native '+key+' contradiction')
  }
  const heading=ownMarkdown.split(/\r?\n/).find(l=>l.startsWith('> '))||''
  ensure(heading.includes(p.companyName+' · ')&&heading.includes('Posted '+detail.published.slice(0,10)),'own markdown publisher/publication contradiction')
  if(detail.salary_from!=null||detail.salary_to!=null){
   const pay=ownMarkdown.match(/^\*\*Salary:\*\* (.+)$/m)?.[1]
   ensure(typeof detail.salary_currency_iso_code==='string'&&/^[A-Z]{3}$/.test(detail.salary_currency_iso_code),'native salary currency invalid')
   ensure(pay&&new RegExp('^(?:(?:From|Up to) )?'+detail.salary_currency_iso_code+' ').test(pay),'own markdown salary currency contradiction')
   if(pay.startsWith('From '))ensure(detail.salary_from!=null&&detail.salary_to==null,'own markdown lower salary bound contradiction')
   if(pay.startsWith('Up to '))ensure(detail.salary_from==null&&detail.salary_to!=null,'own markdown upper salary bound contradiction')
   const numbers=pay.match(/\d[\d,]*(?:\.\d+)?/g)?.map(n=>Number(n.replaceAll(',','')))||[]
   const expected=[...new Set([detail.salary_from,detail.salary_to].filter(v=>v!=null))]
   ensure(equal([...new Set(numbers)],expected),'own markdown salary amount contradiction')
  }
 }
 return context
}
export const projectJob=(p,row,observedAt)=>{
 const n=row.originalNative,first=row.listingVariants[0]||{},g=row.geography,parts=[]
 for(const[key,label]of [['description','Description'],['requirements','Requirements'],['benefits','Benefits']])if(text(n[key]))parts.push(label+'\n'+plainHTML(n[key]))
 for(const[key,label]of [['education','Education'],['experience','Experience'],['function','Function'],['industry','Industry']])if(text(first[key]))parts.push(label+': '+first[key])
 const salary={minimum:n.salary_from??null,maximum:n.salary_to??null,currency:n.salary_currency_iso_code??null,frequency:n.salary_frequency??null}
 if(Object.values(salary).some(v=>v!=null))parts.push('Salary: '+[salary.currency,salary.minimum,salary.maximum,salary.frequency].filter(v=>v!=null).join(' '))
 return {source:p.source,company:p.companyName,title:n.title,jobId:row.id,publicJobId:row.id,platformJobId:n.id,employerJobCode:n.code??null,requisitionId:null,
  sourceUrl:publicURLs(p,row.id).own,applyUrl:first.application_url??null,link:publicURLs(p,row.id).own,
  ...g,locations:g.locations.map(place=>place.location),countryScopeUnresolved:g.unresolved,employmentType:employment(n.type),remoteType:({remote:'Remote',hybrid:'Hybrid',on_site:'On-site'})[n.workplace]??null,
  workplace:n.workplace??null,department:Array.isArray(n.department)?n.department.join(', '):null,postingDate:n.published,closingDate:null,
  experienceRequired:first.experience??null,sourceExperienceRequired:first.experience??null,sourceEmploymentType:first.employment_type??employment(n.type),minimumQualification:first.education??null,requiredSkills:[],salaryRange:salary,
  jobDescription:parts.join('\n\n'),sourceScopeComplete:false,lifecycleCleanupAllowed:false,discoveryOnly:true,scrapedAt:observedAt,
  nativeFieldProvenance:row.fieldProvenance}
}
