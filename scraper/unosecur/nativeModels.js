import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='unosecur',COMPANY='Unosecur',CAREERS='https://www.unosecur.com/careers'
export const need=(v,m)=>{if(!v)throw Object.assign(Error('Unosecur native: '+m),{code:'UNOSECUR_NATIVE_CONTRACT',abortRetries:true})}
export const hash=v=>createHash('sha256').update(v).digest('hex')
const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const all=(n,p)=>typeof n==='string'?[]:[...(p(n)?[n]:[]),...n.children.flatMap(c=>all(c,p))]
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:structuredClone(n.attrs),children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const excluded=new Set(['script','style','template','noscript','svg'])
const text=(n,visible=false)=>typeof n==='string'?decodeHTML(n):excluded.has(n.tag)||visible&&n.inert?'':n.children.map(c=>text(c,visible)).join(' ')
const nativeText=n=>clean(text(n)),one=(a,m)=>{need(a.length===1,'one '+m+' required');return a[0]}
const doc=html=>{const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'document');need(!all(root,n=>n.tag==='base').length,'unreviewed native base');return {d,root,identity:activeHead(html)}}
export const isRoleURL=value=>{try{const u=new URL(value);return u.origin==='https://jobs.reczee.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/unosecur\/[A-Za-z0-9]+\/apply$/.test(u.pathname)}catch{return false}}
export const isClientURL=value=>{try{const u=new URL(value);return u.origin==='https://app.reczee.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/react-static\/static\/js\/main\.[a-f0-9]+\.chunk\.js$/.test(u.pathname)}catch{return false}}
export const roleSlug=url=>{need(isRoleURL(url),'current declared native role URL required');return new URL(url).pathname.split('/')[2]}
export const apiURL=(role,client)=>client.apiBaseURL+'/requisitions/from-slug/'+roleSlug(role)+'?company_slug=unosecur'
export function readCareers(html){
 const {d,root,identity}=doc(html)
 need(JSON.stringify(identity.titles)===JSON.stringify(['Careers at Unosecur | Join Our Identity Security Team']),'current corporate publisher identity changed')
 const heading=one(d.nodes(n=>n.tag==='h1'&&nativeText(n)==='Join the Unosecur team'),'native publisher heading')
 const links=all(root,n=>n.tag==='a'&&/jobs\.reczee\.com/.test(n.attrs.href||''))
 need(links.length>0&&links.length<=12&&links.every(n=>isRoleURL(n.attrs.href)),'unreviewed native tenant/declaration or role bound')
 const visible=readVisibleNativeDocument(html,{strict:true}),vroot=one(visible.nodes(n=>n.tag==='root'),'visible document')
 const vlinks=all(vroot,n=>n.tag==='a'&&/jobs\.reczee\.com/.test(n.attrs.href||''))
 need(vlinks.length===links.length,'native declaration visibility changed')
 const rows=links.map((n,i)=>{
  need(!all(n,c=>['iframe','object','embed','form'].includes(c.tag)).length,'unreviewed delegated corporate role context')
  need(nativeText(n)===clean(text(vlinks[i],true)),'hidden native role declaration')
  const title=nativeText(one(all(n,c=>/^h[1-6]$/.test(c.tag)),'native corporate role title'))
  const locations=all(n,c=>c.attrs['fs-cmsfilter-field']==='location')
  need(locations.length===1||locations.length===2,'one native corporate role location or reviewed CMS pair required')
  const nativeLocationLabel=nativeText(locations[0])
  need(nativeLocationLabel&&locations.every(c=>nativeText(c)===nativeLocationLabel),'native corporate role location fields conflict')
  if(locations.length===2){
   // The current Webflow card repeats its hidden CMS filter in the team and
   // location tags. Bind both copies to the separately visible location tag.
   need(locations.every(c=>cls(c,'hide-2')),'unreviewed repeated corporate location markup')
   const tag=one(all(n,c=>cls(c,'career-list_tag')&&cls(c,'is-location')),'visible native corporate role location tag')
   const label=one(all(tag,c=>c.attrs['fs-cmsfilter-field']==='teams'&&!cls(c,'hide-2')),'visible native corporate role location label')
   need(nativeText(label)===nativeLocationLabel&&all(tag,c=>locations.includes(c)).length===1,'visible native corporate role location conflicts')
  }
  return {sourceUrl:n.attrs.href,slug:roleSlug(n.attrs.href),title,nativeLocationLabel,fullText:nativeText(n),card:tree(n)}
 })
 need(new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'duplicate native role URL')
 return {identity,heading:tree(heading),rows}
}
export function readClient(source,url){
 need(isClientURL(url),'current declared native client URL required')
 // The program's reviewed read/render contract is pinned, never executed.
 // Country is proved separately by original role and API location fields.
 // The November13 bundle changes unrelated application code. Its public GET,
 // URL builder, API version, own-role reader and criteria renderer have the
 // exact same source hashes as the previously reviewed deployment.
 need(['3928ddc04e0df5e22e193d3fdf6191944c6eb285959819b12d5d269452782e49',
  '8121c21c565097351e9ee508c1016485bc6835d398936b338c64ab8bb8ce7fab'].includes(hash(source)),
 'changed declared client requires read/render contract review')
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'}),nodes=[],pending=[ast]
 while(pending.length){const n=pending.pop();nodes.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?pending.push(...v.filter(c=>c&&typeof c==='object')):pending.push(v)}
 const module=id=>one(nodes.filter(n=>n.type==='Property'&&n.key?.value===id&&n.value?.type==='FunctionExpression'),'native client module '+id).value
 const span=n=>source.slice(n.start,n.end),http=span(module(17)),builder=span(module(16)),config=module(398)
 const configCalls=nodes.filter(n=>n.start>=config.start&&n.end<=config.end&&n.type==='CallExpression'&&n.callee?.object?.name==='JSON'&&n.callee?.property?.name==='parse')
 const literal=one(configCalls,'literal native version configuration').arguments[0];need(literal?.type==='Literal'&&typeof literal.value==='string','literal version data required')
 const version=JSON.parse(literal.value);need(version.apiVersion==='v1'&&builder.includes('"https://app.reczee.com/api"')&&builder.includes('.concat(r.apiVersion,"/").concat(e)'),'native API base/version declaration changed')
 need(http.includes('n.d(t,"c",(function(){return b}))')&&http.includes('function b(e,t,n,i){r()({method:"GET",url:Object(o.b)(e)'),'native public GET helper binding changed')
 const publicRead=one(nodes.filter(n=>n.type==='FunctionDeclaration'&&n.id?.name==='co'),'public role component')
 const rendering=one(nodes.filter(n=>n.type==='FunctionDeclaration'&&n.id?.name==='ro'),'public role renderer')
 need(span(publicRead).includes('Object(k.c)("requisitions/from-slug/".concat(a),{company_slug:n},')&&span(publicRead).includes('s(e.requisition)')&&span(publicRead).includes('j(e.screening_questions)')&&span(publicRead).includes('w(e.company_details)'),'public native role-data/tenant binding changed')
 need(span(rendering).includes('content:t.job_description')&&span(rendering).includes('document.title="".concat(t.designation," - ").concat(a.name)')&&span(rendering).includes('open_for_careers_page:t.open_for_careers_page')
  &&source.includes('dangerouslySetInnerHTML:{__html:e.content}')&&source.includes('path:"/:companySlug/:requisitionSlug/apply",component:co'),'native public criteria/title renderer changed')
 return {url,bodySHA256:hash(source),apiBaseURL:'https://app.reczee.com/api/'+version.apiVersion,pathTemplate:'requisitions/from-slug/<published-slug>',companyParameter:'company_slug',
  payload:'data.requisition',publishedTitleField:'designation',descriptionField:'job_description',publicVisibilityField:'open_for_careers_page',screeningQuestionsField:'data.screening_questions',programExecuted:false,
  declarations:{version:structuredClone(version),httpModuleSHA256:hash(http),urlBuilderSHA256:hash(builder),publicReadComponentSHA256:hash(span(publicRead)),renderingComponentSHA256:hash(span(rendering))}}
}
export function readRole(html,row){
 need(isRoleURL(row.sourceUrl),'declared native role required')
 const {d,root,identity}=doc(html),ld=all(root,n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json')
 const script=one(ld,'whole native structured posting');need(d.nodes(n=>n===script).length===1,'hidden native posting declaration')
 let posting;try{posting=JSON.parse(script.raw)}catch{need(false,'invalid native structured posting')}
 need(posting&&posting['@type']==='JobPosting'&&posting['@context']==='https://schema.org/','native posting type/context changed')
 const keys=['@context','@type','title','description','identifier','datePosted','employmentType','hiringOrganization','applicantLocationRequirements','jobLocation']
 need(Object.keys(posting).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(posting,k)),'new structured job fields require review')
 need(typeof posting.title==='string'&&JSON.stringify(identity.titles)===JSON.stringify([posting.title+' - Unosecur']),'native role publisher/title mismatch')
 need(posting.hiringOrganization?.name==='Unosecur'&&posting.identifier?.name==='Reczee'&&Number.isSafeInteger(posting.identifier?.value)&&posting.identifier.value>0,'native employer/posting identity missing')
 const body=one(all(root,n=>n.tag==='body'),'native role shell');need(!nativeText(body),'new visible/hidden native role content requires full-scope review')
 const declarations=d.nodes(n=>n.tag==='script'&&isClientURL(n.attrs.src)).map(tree);need(declarations.length===1,'one current declared native main client required')
 const geo=all(root,n=>Object.keys(n.attrs).some(k=>/^data-(?:country|location|worksite)$/i.test(k)||k==='itemprop'&&/country|location|worksite|address/i.test(n.attrs[k]))).map(tree)
 return {identity,jobPosting:posting,clientDeclarations:declarations,clientURL:declarations[0].attrs.src,
  unreviewedGeographicDeclarations:[...identity.metas.filter(m=>/country|location|worksite|job:/i.test([m.name,m.property,m.itemprop].filter(Boolean).join(' '))),...geo]}
}
const workScopes=text=>[...String(text).matchAll(/(?=(\b(?:(?:country|(?:work |job |office |employment )?location|work\s?site|duty station)\s*:|(?:located|based|stationed|posted)\s+(?:in|at|from)\b|(?:work|works|operate|relocate|relocated|transfer|transferred|deployed|assigned)\s+(?:in|at|from|to)\b|(?:will|shall|must)\s+(?:be\s+)?(?:working|operating|relocating)\s+(?:in|at|from|to)\b|overseas\b|abroad\b|work from anywhere\b)[^.!?\n]{0,160}))/gi)].map(m=>m[1])
export function makeJob(rawAPIJSON,row,role,careers,client,clock){
 let api;try{api=JSON.parse(rawAPIJSON)}catch{need(false,'invalid native job-data JSON')}
 need(api&&Object.keys(api).length===1&&api.data&&Object.keys(api.data).every(k=>['requisition','screening_questions','eeoc_questions_enabled','company_details'].includes(k)),'unreviewed native job-data envelope')
 const r=api.data.requisition,c=api.data.company_details,p=role.jobPosting
 const keys=['id','company','company_id','department','designation','experience_range','job_board_visibility','job_description','job_type','job_type_display','locations','open_for_applications','open_for_careers_page','open_for_internal_referrals','posted_on','slug','title','video_application_max_recording_seconds','video_application_mode']
 need(r&&Object.keys(r).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(r,k)),'unreviewed native requisition fields')
 need(c?.name==='Unosecur'&&c.slug==='unosecur'&&c.website_url==='https://www.unosecur.com/'&&c.careers_page_active===true&&r.company?.name==='Unosecur'&&r.company.id===r.company_id,'native publisher/tenant ownership mismatch')
 need(r.id===p.identifier.value&&r.slug===row.slug&&r.designation===p.title,'native posting/slug/published-title identity mismatch')
 need(r.open_for_careers_page===true,'native role is not currently published on careers page')
 need(r.open_for_applications===null||typeof r.open_for_applications==='boolean','unreviewed native application availability')
 need(typeof r.job_description==='string'&&r.job_description===p.description&&r.job_description.length>100&&r.job_description.length<=100000,'native complete role-description mismatch')
 need(r.posted_on===p.datePosted&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.posted_on)&&new Date(r.posted_on).toISOString()===r.posted_on,'native published timestamp mismatch or invalid date')
 need(r.job_type==='full_time'&&r.job_type_display==='Full-time'&&p.employmentType==='FULL_TIME','unreviewed native employment representation')
 need(Array.isArray(api.data.screening_questions)&&(api.data.eeoc_questions_enabled===null||typeof api.data.eeoc_questions_enabled==='boolean')
  &&['required','optional','off','disabled'].includes(r.video_application_mode),'unreviewed native application requirements')
 const jd=readNativeDocument(r.job_description),jr=one(jd.nodes(n=>n.tag==='root'),'whole native criteria'),visible=readVisibleNativeDocument(r.job_description,{strict:true}),vr=one(visible.nodes(n=>n.tag==='root'),'visible native criteria')
 need(!all(jr,n=>['iframe','object','embed','form','script'].includes(n.tag)).length,'delegated/unreviewed native criteria')
 need(nativeText(jr)===clean(text(vr,true)),'hidden or unreviewed native criteria')
 need(nativeText(jr).length>=100,'substantive visible native criteria required')
 const locations=Array.isArray(r.locations)?r.locations:[],addresses=(Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]).map(l=>l?.address),applicants=(Array.isArray(p.applicantLocationRequirements)?p.applicantLocationRequirements:[p.applicantLocationRequirements])
 const apiLocations=locations.map(l=>({city:l.city,country:nativeCountryName(l.country),codeCountry:nativeCountryName(l.country_code)}))
 const schemaLocations=addresses.map(a=>({city:a?.addressLocality,country:nativeCountryName(a?.addressCountry)})),applicantCountries=applicants.map(a=>nativeCountryName(a?.name))
 const scopes=[nativeText(jr),row.fullText,...api.data.screening_questions.map(q=>q.title)].flatMap(workScopes).filter(scope=>{
  // This exact published office-attendance question states a modality, not
  // a geographic placement. Additional workplace prose still needs review.
  if(/^work from (?:the )?office,\s*are you comfortable with this\s*$/i.test(scope))return false
  const city=/^(?:located|based|stationed|posted)\s+(?:in|at|from)\s+(.+?)(?=\s+(?:to|and|where|with)\b|[.!?\n]|$)/i.exec(scope)?.[1]
  // A placement naming the exact city in both independent native address
  // models is consistent. Country still comes from their literal country
  // fields. Overlapping statements are checked separately for contradictions.
  return !city||!apiLocations.some(l=>l.country==='India'&&l.codeCountry==='India'&&l.city===clean(city)&&schemaLocations.some(s=>s.city===l.city&&s.country==='India'))
 }),typed=role.unreviewedGeographicDeclarations
 const corporateCountry=nativeCountryName(row.nativeLocationLabel.split(',').at(-1).trim())
 const proven=corporateCountry==='India'&&locations.length>0&&apiLocations.length===schemaLocations.length&&apiLocations.every((a,i)=>a.country==='India'&&a.codeCountry==='India'&&a.city&&schemaLocations[i].country==='India'&&schemaLocations[i].city===a.city)
  &&applicantCountries.length>0&&applicantCountries.every(v=>v==='India')&&!scopes.length&&!typed.length
 const record={listing:structuredClone(row),role:structuredClone(role),api,careers:structuredClone(careers),client:structuredClone(client)}
 const j={source:SOURCE,company:COMPANY,jobId:String(r.id),requisitionId:null,nativePublicRoleSlug:r.slug,nativeInternalRequisitionTitle:r.title,nativeCorporateTitle:row.title,
  title:r.designation,sourceUrl:row.sourceUrl,nativeCanonicalRoleURL:row.sourceUrl,applyUrl:row.sourceUrl,link:row.sourceUrl,
  nativeHiringOrganization:structuredClone(p.hiringOrganization),legalEmployer:null,country:proven?'India':null,city:proven?apiLocations[0].city:null,state:null,
  location:proven?apiLocations.map(l=>l.city+', India').join('; '):null,nativeRoleLocations:structuredClone(locations),nativeApplicantLocationRequirements:structuredClone(p.applicantLocationRequirements),
  department:r.department?.title??null,employmentType:r.job_type_display,nativeEmploymentType:r.job_type,remoteStatus:null,nativeExperienceRange:structuredClone(r.experience_range),
  experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],numberOfOpenings:null,
  postingDate:r.posted_on,postedAt:r.posted_on,sourceDatePrecision:'timestamp',publicationTimezone:'UTC',closingDate:null,firstEverPublication:null,
  jobDescription:r.job_description,sourceDescription:r.job_description,nativeSourceRecord:record,
  nativeApplicationsOpen:r.open_for_applications,nativeRolePublicationObserved:true,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,applicationUrlIsGeneric:false,
  nativeApplicationHandoff:{kind:'public-role-page-with-application-interface',url:row.sourceUrl,publicRolePageRead:true,formInteractedWith:false},
  nativeApplicationRequirements:{videoApplicationMode:r.video_application_mode,videoApplicationMaximumRecordingSeconds:r.video_application_max_recording_seconds,
   screeningQuestions:structuredClone(api.data.screening_questions),eeocQuestionsEnabled:api.data.eeoc_questions_enabled},
  sourceNativeCriteriaContainerRetained:true,sourceCountryScopeUnresolved:!proven,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:proven?'native-closing-unreconciled':'native-country-unproven',
  nativeRoleClosingReconciled:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
 if(proven)j.sourceWorksiteCountryProof={method:'declared-reczee-jobposting-and-native-api-location',literalRoleCountry:true,exactCampusEstablished:false,
  country:'India',roleURL:row.sourceUrl,apiURL:apiURL(row.sourceUrl,client),nativeCorporateLocationLabel:row.nativeLocationLabel,nativeRoleAddresses:structuredClone(addresses),nativeAPILocations:structuredClone(locations),nativeApplicantRequirements:structuredClone(p.applicantLocationRequirements)}
 else j.sourceNativeCountryContext={nativeCorporateLocationLabel:row.nativeLocationLabel,corporateCountry,nativeRoleAddresses:structuredClone(addresses),nativeAPILocations:structuredClone(locations),nativeApplicantRequirements:structuredClone(p.applicantLocationRequirements),unreviewedWorkplaceScopes:scopes,unreviewedGeographicDeclarations:structuredClone(typed)}
 return j
}
export const equivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
