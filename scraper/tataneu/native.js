import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {createHash} from 'node:crypto'

export const EMPLOYER_URL='https://www.linkedin.com/company/tata-digital/'
export const FORM_ID='IxtwRnfNiki1zXI7kIJBMZeyMs9KiLhNnWpL0_WZcsxUM1kwUkdSQ0EzMTJIVFkxTU43VEdKVEFUOS4u'
export const FORM_URL='https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id='+FORM_ID
export const FORM_API_URL=`https://forms.cloud.microsoft/formapi/api/46701b23-cd77-488a-b5cd-723b90824131/users/cf32b297-884a-4db8-9d6a-4bd3f59972cc/light/runtimeFormsWithResponses('${FORM_ID}')?$expand=questions($expand=choices)&$top=1`
const check=(ok,reason)=>{if(!ok)throw Error(reason)}
const employer=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(u.hostname)&&u.pathname.replace(/\/$/,'')==='/company/tata-digital'}catch{return false}}
const review=(html,{social=false}={})=>{
 const doc=document(html)
 const prune=(n,hidden=false)=>{n.inactive ||= hidden||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const c of n.children.filter(v=>typeof v!=='string'))prune(c,n.inactive)}
 prune(doc.root)
 const sensitive=/^(?:datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|addressCountry|country|jobLocation)$/i
 check(!doc.nodes(n=>Object.hasOwn(n.attrs,'itemprop')||/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='meta'&&sensitive.test(n.attrs.name||n.attrs.property||'')).length,'New native microdata, country, publication or expiry requires review')
 const visit=(v,corporate=false)=>{if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){
  check(!(k==='@type'&&[x].flat().includes('JobPosting'))&&(!sensitive.test(k)||social&&v['@type']==='SocialMediaPosting'&&k==='datePublished'||corporate&&k==='addressCountry'&&x==='IN'),'New native JobPosting, country, date or expiry requires review')
  if(social&&v['@type']==='SocialMediaPosting'&&k==='datePublished')nativeDate(x,{required:true})
  visit(x,social&&k==='address'&&v['@type']==='Organization'&&v.name==='Tata Digital'&&employer(v.url))
 }}
 for(const s of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))visit(JSON.parse(s.raw))
 return doc
}

export const collectTataNeuNative=async({read})=>{
 const parent=review(await read(EMPLOYER_URL),{social:true})
 check(parent.nodes(n=>n.tag==='h1'&&parent.text(n)==='Tata Digital').length===1&&parent.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:26653083').length===1,'Native parent employer identity changed')
 check(parent.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&new URL(u.searchParams.get('url')).href==='https://www.tatadigital.in/'}catch{return false}}),'Native parent reciprocal official website changed')
 check(/debut offering, Tata Neu/.test(parent.text(parent.root)),'Native parent and Tata Neu brand association changed')
 check(!parent.nodes(n=>n.tag==='a'&&/\/jobs\/view\//.test(n.attrs.href||'')).length,'New parent native role links require exact brand and earliest-publication review')
 const scopeObservations=[]
 for(const location of ['India','Worldwide']){
  const url=`https://www.linkedin.com/jobs/search/?f_C=26653083&location=${location}`
  const doc=review(await read(url))
  check(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='26653083'&&Object.hasOwn(n.attrs,'checked')).length===1,'Native exact parent employer filter changed')
  check(doc.nodes(n=>n.tag==='h1'&&doc.text(n)===`We couldn’t find a match for Jobs jobs in ${location}`).length===1&&!doc.nodes(n=>doc.hasClass(n,'job-search-card')).length,'New native parent inventory requires branded-role review')
  scopeObservations.push({url,employerId:'26653083',location,observedCardCount:0,reportedScopeCount:null})
 }
 const payload=JSON.parse(await read(FORM_API_URL)),form=payload.form
 check(form?.id===FORM_ID&&form.title==='Lead Visual Designer | Application'&&form.ownerId==='cf32b297-884a-4db8-9d6a-4bd3f59972cc'&&form.ownerTenantId==='46701b23-cd77-488a-b5cd-723b90824131','Native application role or ownership changed')
 const inspect=v=>{if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){
  check(!/^(?:@type|datePosted|datePublished|dateModified|publicationDate|postedAt|validThrough|closingDate|expiryDate|expirationDate|expiresAt|addressCountry|country|jobLocation|startDate|endDate)$/i.test(k),'New form role country, schema, publication or expiry requires review')
  inspect(x)
 }}
 inspect(payload)
 const settings=JSON.parse(form.settings)
 check(Object.keys(settings).sort().join('|')==='EmailNotification|IsAnonymous|IsQuizMode|NotRecordIdentity|PermissionForResponder|RequiresUniqueResponse'&&settings.IsAnonymous===true&&settings.PermissionForResponder===1,'Native application access or closing configuration changed')
 const questions=[...form.questions].sort((a,b)=>a.order-b.order)
 // Reviewed public role text has no country, public publication, expiry or
 // Tata Neu scope. Changed prose must be reconciled before retaining exclusions.
 const reviewedProse=JSON.stringify([form.description,questions.map(q=>[q.title,q.subtitle,q.formsProRTQuestionTitle,q.formsProRTSubtitle])])
 check(createHash('sha256').update(reviewedProse).digest('hex')==='9ac1f4cb274741653ccf04254a37851fe5ef8b4b5f7207d9680881d81b8cc4b3','Native form prose changed; review country, publication, expiry and brand scope')
 check(questions.length===8&&questions.map(q=>q.title.trim()).join('|')==="Your name|Email address|Years of professional experience|Career overview|Portfolio|A case study you're proud of|Why this role?|Resume"&&questions.every(q=>q.type==='Question.TextField'&&q.required===true)&&questions[6].subtitle==='What interests you about leading visual design at Tata Digital?','Native parent form role content or country evidence changed')
 check(form.status==='Active'&&form.softDeleted===0,'Native application is inactive or deleted')
 const excludedNativeCandidates=[{title:'Lead Visual Designer',nativeEmployerLabel:'Tata Digital',sourceUrl:FORM_URL,applyUrl:FORM_URL,nativeApplicationStatus:form.status,nativeFormCreatedDate:form.createdDate,nativeFormModifiedDate:form.modifiedDate,postingDate:null,country:null,location:null,brandScopeVerified:false,activeApplyVerified:false,jobDescription:null,exclusionReasons:['exact-Tata-Neu-role-binding-unproven','missing-explicit-job-country','missing-public-role-publication']}]
 return {jobs:[],firstParty:false,inventoryStatus:'coverage-gap',facts:{scopeObservations,nativeObservedRecordCount:1,excludedNativeCandidates,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false},reason:'Exact Tata Digital employer native India and Worldwide searches expose no-match states, which do not prove Tata Neu inventory empty. Parent identity and Tata Neu product association are corroborated, but parent openings require explicit brand binding. Public Microsoft form confirms an active Lead Visual Designer parent application, without role country, public publication or proven exact Tata Neu role binding; excluded. Administrative form created/modified dates and timezone are not publication or job country. Official parent careers endpoint was inaccessible during capture. Inventory totals and enabled exact-brand role applications remain unverified; cleanup disabled.'}
}
