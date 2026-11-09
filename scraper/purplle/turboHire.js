import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {turboHireWorkplaces,turboHireDate,turboHireRecruitmentRecord} from '../../scraper-support/utils/turboHireNativeFacts.js'
import reviewedShell from './reviewedTurboHireShell.json' with {type:'json'}
export const POST_URL='https://www.linkedin.com/posts/purplle-com_hiringmadeeasy-purpllecareers-wearehiring-activity-7316045361444265984-q2bG'
export const SHORT_URL='https://lnkd.in/gqG86pHt'
export const TINY_URL='https://tinyurl.com/Purplle-Careers'
export const ORIGIN='https://purplle.turbohire.co'
export const ORG_ID='3ed17e54-f66f-4ade-90b9-ef064dc6fbd6'
export const BOARD_URL=ORIGIN+'/careerpage/'+ORG_ID
export const API='https://thapi-stage0.azurewebsites.net'
const LIST_URL=API+'/api/careerpagev2/filteredjobs?orgId='+ORG_ID+'&pageType=0'
const clients={
 '/runtime-main.a3801c5ec8c75a558b86.js':'7503ade1cb27613358ce98f6084210ce621d12c49d561ba3c9dca6ffe18a1e95',
 '/18.0a0a3f53b49041744779.chunk.js':'abcaa7c62f5eba8def6e1e5e1b28b412d5ef629eed81a0630617ec891a29175d',
 '/30.812b9abed47cf2099f54.chunk.js':'562f337b1298c5f56db392bd54e8c2a9e0e32d79275a627d9f90a4ed05c8352a',
 '/main.bc8f2fdf0fa9e74f4468.chunk.js':'4d56acc5efbcfba0f97c383dace482b51288ce727e03d22296e0c25d7e27d085',
 '/24.52ad9596a317e0433e77.chunk.js':'947f1d46af7076821bd671d0049574fa109d04a97ca093b59bba0adc2e1ad926',
 '/40.3ec75e9eb87caff145b7.chunk.js':'37422a4a8d2f7c78a4f9fc5fa6b0d7d951cb950e165ccc80e9d9d537ce5cbc94',
}
const sha=body=>createHash('sha256').update(body).digest('hex')
const check=(ok,message)=>{if(!ok)throw Error('Purplle TurboHire native contract: '+message)}
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const uuid=value=>typeof value==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)&&!/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value)
const company=value=>{try{const u=new URL(value);return u.href==='https://www.purplle.com/'}catch{return false}}
const documentElements=doc=>{
 const nodes=[]
 const walk=n=>{nodes.push(n);for(const c of n.children||[])if(typeof c!=='string'&&n.tag!=='template')walk(c)}
 walk(doc.nodes(n=>n.tag==='root')[0]);return nodes
}
const schema=(doc,type)=>documentElements(doc).filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{
 if(n.raw.trim()==='$GOOGLE_LD')return []
 const v=JSON.parse(n.raw);return[v].flat().flatMap(item=>item?.['@type']===type?[item]:item?.['@graph']?.filter(p=>p['@type']===type)||[])
})
const employer=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(u.hostname)&&u.pathname.replace(/\/$/,'')==='/company/purplle-com'}catch{return false}}
function postContract(html){
 const d=readNativeDocument(html),posts=schema(d,'SocialMediaPosting')
 check(posts.length===1&&posts[0]['@id']===POST_URL,'exact company post identity changed')
 const p=posts[0]
 check(p.author?.['@type']==='Organization'&&p.author.name==='Purplle.com'&&employer(p.author.url),'company post author changed')
 check(p.datePublished==='2025-04-10T10:32:19.688Z'&&/Our new Careers Page/.test(p.articleBody)&&p.articleBody.includes(SHORT_URL)&&p.articleBody.includes('TurboHire'),'declared careers announcement changed')
 check(d.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='public_post_feed-actor-name'&&employer(n.attrs.href)&&d.text(n)==='Purplle.com').length===1,'active company-post author changed')
 check(d.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='public_post-text').some(n=>{try{return new URL(n.attrs.href).searchParams.get('url')===SHORT_URL}catch{return false}}),'active declared careers link changed')
 return {url:POST_URL,publishedAt:p.datePublished,author:{name:p.author.name,url:p.author.url},numericLinkedInOrganizationCurrentlyVerified:false}
}
function shellContract(html){
 const d=readNativeDocument(html),nodes=documentElements(d)
 check(!nodes.some(n=>n.tag==='base'),'native base changed')
 check(!nodes.some(n=>n.tag==='time'||Object.keys(n.attrs||{}).some(k=>/^data-.*(?:country|job-location|expiry|expiration|date-posted|date-published)/i.test(k))||/(?:^|\s)(?:addressCountry|jobLocation|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)(?:\s|$)/i.test(n.attrs?.itemprop||'')||n.tag==='meta'&&/(?:country|joblocation|dateposted|datepublished|published_time|validThrough|closingDate|expiryDate)/i.test(n.attrs.name||n.attrs.property||'')),'new native HTML country/date/expiry carrier requires reconciliation')
 const roots=d.nodes(n=>n.tag==='div'&&n.attrs.id==='root')
 check(roots.length===1&&nodes.find(n=>n.attrs.id==='root')===roots[0],'active native root changed')
 const scripts=nodes.filter(n=>n.tag==='script'&&n.attrs.src)
 // Hash observed URLs only where the reviewed reference is a fingerprint.
 const scriptAttributes=scripts.map((n,index)=>/^sha256:[a-f0-9]{64}$/.test(reviewedShell.scripts[index]?.src||'')
  ? {...n.attrs,src:'sha256:'+sha(n.attrs.src)} : n.attrs)
 check(canonical(scriptAttributes)===canonical(reviewedShell.scripts),'native public program declarations changed')
 check(canonical(nodes.filter(n=>n.tag==='script'&&!n.attrs.src&&n.attrs.type!=='application/ld+json').map(n=>sha(n.raw)))===canonical(reviewedShell.inlineSHA256),'native inline programs changed')
 check(canonical(nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>n.attrs))===canonical(reviewedShell.styles),'native stylesheets changed')
 check(!nodes.some(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'new native canonical carrier requires reconciliation')
 check(!d.nodes(n=>['iframe','object','embed'].includes(n.tag)).some(n=>n.attrs.src),'unreviewed active native frame')
 return d
}
const metadata=(d,name)=>{
 const values=documentElements(d).filter(n=>n.tag==='meta'&&n.attrs.property===name)
 check(values.length===1&&typeof values[0].attrs.content==='string','native '+name+' metadata missing or ambiguous')
 return values[0].attrs.content
}
const organization=v=>{
 check(v&&v.OrgID===ORG_ID&&v.OrgName==='Purplle.com'&&company(v.OrgURL)&&v.CareerPageSubdomain==='purplle'&&v.IsCareerPagePublished===true,'organization identity, reciprocal website or publication changed')
 return Object.fromEntries(['OrgID','OrgName','OrgURL','CareerPageSubdomain','IsCareerPagePublished'].map(k=>[k,v[k]]))
}
const listContract=v=>{
 check(v&&Number.isSafeInteger(v.Total)&&v.Total>0&&v.Total<=1000&&Array.isArray(v.Result)&&v.Result.length===v.Total&&Object.keys(v).every(k=>['Total','Result'].includes(k)),'native inventory unknown or truncated')
 const ids=new Set()
 for(const r of v.Result){check(uuid(r.JobId)&&!ids.has(r.JobId)&&clean(r.JobTitle)&&r.OrgDetails?.OrgID===ORG_ID&&r.OrgDetails?.OrgName==='Purplle.com','native listing employer/identity changed');ids.add(r.JobId)}
 return v
}
const plain=html=>{let text=String(html);for(let i=0;i<3;i++){const next=decodeNativeEntities(text);if(next===text)break;text=next}const d=readNativeDocument(text);return d.text(d.nodes(n=>n.tag==='root')[0]).replace(/\s/g,'')}
function roleContract(row,dto,html,now){
 const d=shellContract(html),postings=schema(d,'JobPosting')
 check(postings.length===1,'native JobPosting missing or ambiguous');const p=postings[0]
 check(Object.keys(p).every(k=>['@context','@type','title','datePosted','description','hiringOrganization','jobLocation','industry','workHours','skills','validThrough','employmentType'].includes(k)),'new native structured criteria/date/scope carrier requires reconciliation')
 check(p.title===dto.JobTitle&&clean(dto.JobTitle)===clean(row.JobTitle)&&dto.JobId===row.JobId&&dto.JobCode===row.JobCode,'listing/detail/schema role identity conflict')
 check(metadata(d,'og:title')==='[Hiring For]: '+dto.JobTitle&&metadata(d,'og:site_name')==='Purplle.com'&&plain(metadata(d,'og:description'))===plain(p.description),'native OpenGraph identity or full criteria conflict')
 check(p.hiringOrganization?.name==='Purplle.com'&&company(p.hiringOrganization.sameAs)&&dto.OrgDetails?.OrgID===ORG_ID&&dto.OrgDetails?.OrgName==='Purplle.com'&&dto.OrgDetails?.IsCareerPagePublished===true,'native role employer conflict')
 for(const v of [row,dto]){
  check(!Object.keys(v).some(k=>/(?:country|joblocation|address|locations|closing|expiry|expiration|validthrough|deadline|dateposted|datepublished)/i.test(k)&&!['Location','ExpiryDates'].includes(k)),'new native country or lifecycle carrier requires reconciliation')
  check(!Object.keys(v).some(k=>/employer|hiringorganization/i.test(k)),'new native employer carrier requires reconciliation')
  check(!Object.keys(v).some(k=>/description|rolesandresponsibilities|eligibility|qualification|requirements|education|criteria/i.test(k)&&!['JobDescription','JobDescriptionV2','JobDescriptionBlobUrl','RolesAndResponsibilities','RolesAndResponsibilitiesV2','Eligibility','EligibilityV2'].includes(k)),'new native criteria carrier requires reconciliation')
  check(!v.JobDescriptionBlobUrl,'unread native description attachment requires reconciliation')
  if(v.CompanyUrl)check(company(v.CompanyUrl),'native CompanyUrl conflict')
  if(v.ClientName)check(v.ClientName==='Purplle.com'||v===row&&v.ClientName==='[REDACTED]'&&v.ShowClientName===false,'native client employer conflict')
  if(v.ClientCompany)check(v.ClientCompany.ClientName==='Purplle.com'&&company(v.ClientCompany.ClientUrl),'native client company conflict')
 }
 check(dto.IsPublic===true&&dto.IsDraft===false&&dto.JobStatus==='Active'&&Array.isArray(dto.PublishedJobBoards)&&dto.PublishedJobBoards.includes('CAREERPAGE'),'native role not active, public and published')
 check(uuid(dto.ApplicationEnquiryTemplateId)&&dto.JobIdObfuscated===row.JobIdObfuscated&&typeof dto.JobIdObfuscated==='string'&&dto.JobIdObfuscated.length>10,'native same-role application context changed')
 check(dto.Location===row.Location,'native listing/detail workplaces conflict')
 const places=turboHireWorkplaces(dto.Location),schemaPlaces=[p.jobLocation].flat().map(v=>v?.address)
 check(schemaPlaces.length===places.length&&schemaPlaces.every(a=>a&&a.addressCountry==='India'&&places.some(v=>v.address===a.addressLocality&&v.countryCode==='IN'))&&places.every(v=>v.countryCode==='IN'&&schemaPlaces.some(a=>a.addressLocality===v.address)),'native schema/detail country or locality conflict')
 check(dto.PublishedDates?.CAREERPAGE===row.PublishedDate&&canonical(dto.ExpiryDates||{})===canonical(row.ExpiryDates||{}),'native listing/detail lifecycle conflict')
 const postingDate=turboHireDate(dto.PublishedDates.CAREERPAGE,{now,publication:true}),closingDate=turboHireDate(dto.ExpiryDates?.CAREERPAGE,{now})
 turboHireDate(dto.PublishedDate,{now,publication:true})
 for(const value of Object.values(dto.PublishedDates))turboHireDate(value,{now,publication:true})
 check(postingDate&&p.datePosted===postingDate.slice(0,10),'native schema publication conflict')
 if(p.validThrough!=null)check(closingDate&&p.validThrough.slice(0,10)===closingDate.slice(0,10),'native schema expiry conflict')
 if(closingDate)check((closingDate.length===10?Date.parse(closingDate)-14*3600000:Date.parse(closingDate))>Date.parse(now),'native role expired or expiry day ambiguous')
 const sections=[]
 for(const name of ['JobDescription','RolesAndResponsibilities','Eligibility']){
  const legacy=dto[name],v2=dto[name+'V2'];check([legacy,v2].every(v=>v==null||typeof v==='string'),'invalid full native description section')
  if(legacy&&v2)check(plain(legacy)===plain(v2),'native description versions disagree')
  const value=v2||legacy||''
  check(!/<(?:style|link|script|iframe|object|embed)\b/i.test(value),'unreviewed description executable/style carrier')
  const active=extractActiveDescription(value)
  if(value)check(active&&plain(active)===plain(value),'inert native full criteria')
  if(active)sections.push(active)
 }
 check(sections.length&&sections[0].length>=200&&plain(sections.join(''))===plain(p.description),'native full description/schema criteria disagree or missing')
 check(!/\b(?:no longer accepting applications|this (?:job|role|position) is closed)\b/i.test(sections.join('')),'native role visibly closed')
 check(Array.isArray(dto.Skills)&&canonical(dto.Skills)===canonical(row.Skills)&&canonical(dto.Skills)===canonical(p.skills),'native skills conflict')
 check(dto.Experience&&canonical(dto.Experience)===canonical(row.Experience)&&Number.isFinite(dto.Experience.MinExp)&&Number.isFinite(dto.Experience.MaxExp)&&dto.Experience.MinExp>=0&&dto.Experience.MaxExp>=dto.Experience.MinExp,'native experience conflict')
 check(Array.isArray(dto.AdditionalFields)&&dto.AdditionalFields.every(f=>['Department','Job Type'].includes(f.JobCustomField?.FieldName)&&typeof f.Value==='string'&&(f.JobCustomField.FieldName!=='Job Type'||f.Value===dto.JobTypeV2)),'new native custom criteria/scope requires reconciliation')
 if(p.employmentType!=null)check(clean(p.employmentType).replace(/[ _-]/g,'').toLowerCase()===clean(dto.JobTypeV2).replace(/[ _-]/g,'').toLowerCase(),'native employment type conflict')
 const sourceUrl=ORIGIN+'/job/publicjobs/'+dto.JobId+'?utm_source=CareerPage',description=sections.join('\n\n'),first=places[0]
 return {source:'purplle',company:'Purplle',jobId:dto.JobId,sourceJobId:dto.JobId,jobCode:dto.JobCode,requisitionId:uuid(dto.RequisitionId)?dto.RequisitionId:null,title:clean(dto.JobTitle),country:'India',city:first.city,region:first.state,location:places.map(v=>v.address).join(' / '),nativeLocations:places,postingDate,nativeListingPublicationDate:row.PublishedDate,nativeDetailPublicationDate:dto.PublishedDates.CAREERPAGE,nativeGeneralPublicationDate:dto.PublishedDate,closingDate,sourceNativeClosingDate:dto.ExpiryDates?.CAREERPAGE??null,sourceClosingDateIsExact:Boolean(closingDate?.endsWith('Z')),employmentType:dto.JobTypeV2,experienceRequired:dto.Experience.MinExp+'-'+dto.Experience.MaxExp+' years',requiredSkills:dto.Skills,jobDescription:description,sourceDescription:description,sourceDetailComplete:true,sourceDetailStatus:'complete',activeApplyVerified:true,applicationPublicContextValidated:true,publicRolePageFetched:true,applicationSubmitted:false,sourceUrl,applyUrl:sourceUrl,link:sourceUrl,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now,nativeSourceRecord:{nativeListing:turboHireRecruitmentRecord(row),nativeDetail:turboHireRecruitmentRecord(dto),nativeJobPosting:p,nativeApplicationTemplateId:dto.ApplicationEnquiryTemplateId,nativeCustomFields:dto.AdditionalFields.map(f=>({name:f.JobCustomField.FieldName,value:f.Value}))}}
}

export async function collectPurplleTurboHire({fetchImpl,signal,now,retainedResponses,maxJobs=2,requestIntervalMs=800,corporateUnavailable=null}){
 check(Number.isSafeInteger(maxJobs)&&maxJobs>=1&&maxJobs<=20,'invalid bounded detail cap')
 check(Number.isSafeInteger(requestIntervalMs)&&requestIntervalMs>=0,'invalid request pacing')
 const clock=new Date(typeof now==='function'?now():now).toISOString(),previous=new Map();let token=null,totalBytes=0,requests=0
 const read=async(url,{method='GET',body,redirect=false,anonymous=false}={})=>{
  signal.throwIfAborted();check(++requests<=64,'aggregate request bound exceeded')
  const origin=new URL(url).origin,wait=requestIntervalMs-(Date.now()-(previous.get(origin)||0))
  if(wait>0)await new Promise((resolve,reject)=>{const timer=setTimeout(done,wait);function done(){signal.removeEventListener('abort',abort);resolve()}function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason)}signal.addEventListener('abort',abort,{once:true})})
  previous.set(origin,Date.now())
  const response=await fetchImpl(url,{signal,method,body,redirect:'manual',headers:{Accept:origin===API?'application/json, text/plain, */*':'text/html,application/javascript',...(origin===API?{Origin:ORIGIN,Referer:ORIGIN+'/',...(token&&!anonymous?{Authorization:'Bearer '+token}:{})}:{}),...(body?{'Content-Type':'application/json;charset=UTF-8'}:{})}})
  check(response.url===url,'native response final URL changed')
  const record={url,method,finalUrl:response.url,status:response.status,capturedAt:new Date().toISOString(),contentType:response.headers.get('content-type')}
  if(![200,...(redirect?[301,302]:[])].includes(response.status)){retainedResponses.push({...record,bodyUnread:true});void response.body?.cancel?.().catch(()=>{});throw Object.assign(Error('Purplle TurboHire public HTTP '+response.status),{status:response.status,requestUrl:url,finalUrl:response.url})}
  const expected=origin===API?/(?:application|text)\/[^;]*json/i:url.endsWith('.js')?/(?:application|text)\/(?:x-)?(?:java|ecma)script/i:/text\/html/i
  if(!expected.test(record.contentType||'')){void response.body?.cancel?.().catch(()=>{});throw Error('Purplle TurboHire public response MIME changed')}
  check(response.body?.getReader,'bounded native stream unavailable');const reader=response.body.getReader(),chunks=[];let bytes=0
  const cancel=()=>{void reader.cancel(signal.reason).catch(()=>{})}
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel()
  try{while(true){signal.throwIfAborted();const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;totalBytes+=value.byteLength;if(bytes>15000000||totalBytes>35000000){void reader.cancel().catch(()=>{});throw Error('Purplle TurboHire bounded native body exceeded')}chunks.push(Buffer.from(value))}}finally{signal.removeEventListener('abort',cancel);reader.releaseLock()}
  signal.throwIfAborted();const raw=Buffer.concat(chunks).toString('utf8');check(raw.trim(),'empty native response')
  if(anonymous){const v=JSON.parse(raw);check(typeof v.access_token==='string'&&v.token_type==='Bearer'&&v.ShouldRedirect===false&&v.expires_in>0,'anonymous public session contract changed');token=v.access_token;retainedResponses.push({...record,bodyBytes:bytes,anonymousSessionCredentialsRetained:false});return null}
  retainedResponses.push({...record,body:raw,bodyBytes:bytes,bodySHA256:sha(raw),location:response.headers.get('location')})
  return redirect?{body:raw,location:response.headers.get('location'),status:response.status}:raw
 }
 try{
  const publisher=postContract(await read(POST_URL)),short=readNativeDocument(await read(SHORT_URL))
  check(short.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='external_url_click'&&n.attrs.href===TINY_URL).length===1,'declared LinkedIn short-link destination changed')
  const tiny=await read(TINY_URL,{redirect:true});check([301,302].includes(tiny.status)&&tiny.location===BOARD_URL,'declared tenant redirect changed')
  const board=shellContract(await read(BOARD_URL))
  check(metadata(board,'og:title')==='Purplle.com - Career Page'&&metadata(board,'og:site_name')==='Purplle.com'&&metadata(board,'og:description')==='Explore job opportunities at Purplle.com','native board OpenGraph employer changed')
  for(const [url,hash]of Object.entries(clients))check(sha(await read(ORIGIN+url))===hash,'current native client bytes changed')
  await read(API+'/api/token/noauth',{anonymous:true})
  const lookup=organization(JSON.parse(await read(API+'/api/publicorganizations?accountName=purplle'))),org=organization(JSON.parse(await read(API+'/api/publicorganizations/'+ORG_ID)))
  check(canonical(lookup)===canonical(org),'organization lookup/detail disagreement')
  const body=JSON.stringify({SortByV2:{Key:'PostedDate',Order:2},...Object.fromEntries(['BunitIds','Experience','JobTypes','JobTypeV2','Locations','CreatedDate','Compensation','Skills','ClientIds'].map(k=>[k,{Value:null,FilterType:0}])),Keyword:'',Department:'',CustomFields:{}})
  const listing=listContract(JSON.parse(await read(LIST_URL,{method:'POST',body}))),jobs=[]
  for(const row of listing.Result.slice(0,maxJobs)){
   const html=await read(ORIGIN+'/job/publicjobs/'+row.JobId+'?utm_source=CareerPage'),dto=JSON.parse(await read(API+'/api/publicjobs/'+row.JobId+'?fieldVisibility=CareerPage'))
   jobs.push(roleContract(row,dto,html,clock))
  }
  const closing=listContract(JSON.parse(await read(LIST_URL,{method:'POST',body})))
  check(canonical(listing.Result)===canonical(closing.Result),'closing native inventory changed')
  check(canonical(org)===canonical(organization(JSON.parse(await read(API+'/api/publicorganizations/'+ORG_ID)))),'closing native employer changed')
  check(jobs.length>0,'no native detail verified; inventory remains unknown')
  for(const job of jobs){job.activeApplyVerified=false;job.nativeApplicationVerification='Current public role DTO and same-role public page verified; rendered Apply control or form not inspected';job.nativeSourceRecord.nativePublisher={corporateURL:'https://www.purplle.com/careers',corporateUnavailable,post:publisher,boardURL:BOARD_URL,organization:org,clientSHA256:clients}}
  return {jobs,firstParty:true,inventoryStatus:'coverage-gap',facts:{nativeRecordCount:listing.Result.length,nativeReportedIndiaFilteredCount:null,visitedDetailCount:jobs.length,stopReason:'bounded-TurboHire-details',countryUnknownRecoveredCount:0,nativeSurface:BOARD_URL,declaredPost:publisher,corporateUnavailable},reason:`Current company-post-declared TurboHire board: ${listing.Total} records observed; ${jobs.length} full native India details verified within bounded selection. ${corporateUnavailable?'Corporate careers remains HTTP'+corporateUnavailable.status+'; independently verified official publisher and reciprocal ATS supply this subset. ':''}LinkedIn employer/job channel remains inaccessible; exact numeric LinkedIn author mapping, company-wide inventory and remaining detail scope remain unknown. Public application context verified; rendered Apply control not inspected. Lifecycle cleanup disabled.`}
 }finally{token=null}
}
