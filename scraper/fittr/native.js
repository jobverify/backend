import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
export const HOME_URL='https://www.fittr.com/'
export const COACH_URL='https://www.fittr.com/become-a-coach/'
export const EMPLOYER_URL='https://www.linkedin.com/company/fittr/'
export const POSTS=[
 {id:'7414647927740223489',url:'https://www.linkedin.com/posts/fittr_punejobs-hiring-fittr-activity-7414647927740223489-d-cQ',title:'Associate Manager - New Business and Strategy',date:'2026-01-07T12:43:43.444Z',hash:'cf3e637025ceeda8bce0bde190e21dd496437d50897fc9faea31dbe56ebc59f7',location:'Pune (Work from Office)',application:'mailto:career@fittr.com'},
 {id:'7454432934230495232',url:'https://www.linkedin.com/posts/fittr_hiring-productdesigner-uxdesign-activity-7454432934230495232-hKaX',title:'Product Designer',date:'2026-04-27T07:35:08.162Z',hash:'23254a5d7130d8bd6979c2422a6c3b093b3f0af81e736d875be2bf3719a132ae',location:null,application:'https://lnkd.in/dAV6VQMX'},
]
const check=(ok,reason)=>{if(!ok)throw Error(reason)}
export const activeDocument=html=>{
 const doc=document(html)
 const prune=(n,hidden=false)=>{n.inactive ||= hidden||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const c of n.children.filter(v=>typeof v!=='string'))prune(c,n.inactive)}
 prune(doc.root);return doc
}
const sensitive=/^(?:datePublished|datePosted|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|addressCountry|country|jobLocation)$/i
const containsPosting=v=>Array.isArray(v)?v.some(containsPosting):v&&typeof v==='object'&&([v['@type']].flat().includes('JobPosting')||Object.values(v).some(containsPosting))
const schemas=doc=>doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw))
const reviewMarkup=doc=>{
 check(!doc.nodes(n=>Object.hasOwn(n.attrs,'itemprop')&&!(n.tag==='meta'&&['name','description','image'].includes(n.attrs.itemprop))||/JobPosting/i.test(n.attrs.itemtype||'')||n.tag==='meta'&&sensitive.test(n.attrs.name||n.attrs.property||'')).length,'New native microdata country, date, expiry or role requires review')
 check(!schemas(doc).some(containsPosting),'New native JobPosting country, earliest-public-date, expiry and application requires review')
}
const reviewFields=(value,path='')=>{
 if(!value||typeof value!=='object')return
 for(const [key,child] of Object.entries(value)){
  // Comment dates describe comments, never publication of the employer vacancy.
  check(!sensitive.test(key)||(key==='datePublished'&&(path===''||/^comment\.\d+$/.test(path))),'New native social country, publication or expiry requires review')
  reviewFields(child,path?path+'.'+key:key)
 }
}
export const collectFittrNative=async({read,now})=>{
 for(const url of [HOME_URL,COACH_URL]){
  const doc=activeDocument(await read(url));reviewMarkup(doc)
  check(doc.nodes(n=>n.tag==='a'&&n.attrs.href===EMPLOYER_URL).length>0,'Official active employer association changed')
  if(url===COACH_URL)check(doc.nodes(n=>n.tag==='h2'&&doc.text(n)==='Become a FITTR Coach').length===1,'Official coach onboarding route changed')
 }
 const employer=activeDocument(await read(EMPLOYER_URL))
 reviewMarkup(employer)
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='FITTR').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:2970058').length===1,'Exact native FITTR employer identity changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href==='http://www.fittr.com/'}catch{return false}}),'Native reciprocal official website changed')
 for(const location of ['India','Worldwide']){
  const doc=activeDocument(await read('https://www.linkedin.com/jobs/search/?f_C=2970058&location='+location));reviewMarkup(doc)
  check(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='2970058'&&Object.hasOwn(n.attrs,'checked')).length===1,'Exact checked native employer scope changed')
  check(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1&&doc.nodes(n=>doc.hasClass(n,'job-search-card')).length===0,'Native scoped listing changed; role country, date, expiry and active application review required')
 }
 const excludedNativeCandidates=[]
 for(const fact of POSTS){
  const doc=activeDocument(await read(fact.url));reviewMarkup(doc)
  const postings=schemas(doc).filter(v=>v['@type']==='SocialMediaPosting');check(postings.length===1,'Native social posting schema changed')
  const posting=postings[0];reviewFields(posting)
  const allowed=new Set(['@context','@type','@id','datePublished','headline','comment','commentCount','articleBody','author','interactionStatistic','hasPart'])
  check(Object.keys(posting).every(k=>allowed.has(k)),'New native social metadata requires review')
  check(posting['@id']===fact.url&&posting.author?.name==='FITTR'&&posting.author?.url==='https://in.linkedin.com/company/fittr','Native social exact employer or role identity changed')
  const nativePostedDate=nativeDate(posting.datePublished,{required:true})
  check(posting.datePublished===fact.date&&Date.parse(nativePostedDate.iso)<=Date.parse(new Date(now).toISOString()),'Native earliest social publication changed or future')
  check(typeof posting.articleBody==='string'&&createHash('sha256').update(posting.articleBody).digest('hex')===fact.hash&&doc.text(doc.root).includes(posting.articleBody.replace(/\s+/g,' ').trim()),'Native visible role prose changed; country, publication, expiry and application require review')
  excludedNativeCandidates.push({id:fact.id,title:fact.title,sourceURL:fact.url,nativePostedDate,country:null,location:fact.location,nativeApplicationURL:fact.application,activeApplyVerified:false,exclusionReason:'missing-explicit-job-country'})
 }
 return {jobs:[],firstParty:false,inventoryStatus:'coverage-gap',facts:{nativeEmployerId:'2970058',excludedNativeCandidates,nativeObservedRecordCount:2,sourceListingComplete:false,sourceScopeComplete:false},reason:'Exact native FITTR employer 2970058 reciprocates official domain, and active corporate pages associate its profile. Exact employer-filtered India and Worldwide searches each expose no-match states. Two employer-authored social vacancies retain earliest native dates 2026-01-07 and 2026-04-27 but have city-only Pune or no location; country remains unproven, application activity unverified, and both are excluded. Coach onboarding is not an enumerable vacancy inventory. Corporate social association is not a careers handoff. Whole-company counts unknown; coverage-gap and lifecycle cleanup disabled.'}
}
