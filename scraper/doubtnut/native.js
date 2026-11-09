import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
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

export const HOME_URL='https://www.doubtnut.com/'
export const EMPLOYER_URL='https://www.linkedin.com/company/doubtnut'
export const FRESHTEAM_URL='https://doubtnut.freshteam.com/jobs'
export const POSTS=[
 {id:'7112793826741694464',url:'https://www.linkedin.com/posts/doubtnut_hiring-doubtnutishiring-sales-activity-7112793826741694464-DcwY',title:'Full time sales',date:'2023-09-27T13:43:17.573Z',hash:'f2e97b9b19d3bb18dc89f3bacec6ea1aae13e962324b67d5ab1e2882f39df939',application:'https://lnkd.in/dH52dN9T',group:'sales-2023'},
 {id:'6646810686842376192',url:'https://www.linkedin.com/posts/doubtnut_freshteam-activity-6646810686842376192-dm44',title:'Backend, Android, Data Sciences, Data Engineering and Analyst roles',date:'2020-03-20T16:52:39.513Z',hash:'a1571d751198788b172d7ff76b2af328dd73fb3f72130412dea00f4bbb94f7f5',application:'https://doubtnut.freshteam.com/jobs',group:'engineering-2020'},
 {id:'7122989063283863553',url:'https://www.linkedin.com/posts/doubtnut_hiring-doubtnutishiring-sales-activity-7122989063283863553-9t1E',title:'Full time sales',date:'2023-10-25T16:55:31.387Z',hash:'f2e97b9b19d3bb18dc89f3bacec6ea1aae13e962324b67d5ab1e2882f39df939',application:'https://lnkd.in/dH52dN9T',group:'sales-2023'},
]
export const collectDoubtnutNative=async({read,now})=>{
 // A historical employer-authored ATS handoff must not turn a retired tenant
 // into a verified-empty inventory merely because it still responds HTTP 200.
 const board=activeDocument(await read(FRESHTEAM_URL));reviewMarkup(board)
 check(board.nodes(n=>board.hasClass(n,'no-ats')).length===1&&board.nodes(n=>n.tag==='h2'&&board.hasClass(n,'invalid-domain-header')&&board.text(n)==="We couldn't find").length===1,'Historical Freshteam tenant changed; new vacancy inventory requires review')
 const employer=activeDocument(await read(EMPLOYER_URL));reviewMarkup(employer)
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='Doubtnut').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:13222185').length===1,'Exact native employer identity changed')
 const organizations=schemas(employer).flatMap(v=>v['@graph']||[v]).filter(v=>v['@type']==='Organization')
 check(organizations.length===1&&organizations[0].name==='Doubtnut'&&organizations[0].url==='https://in.linkedin.com/company/doubtnut'&&organizations[0].sameAs==='https://play.google.com/store/apps/details?id=com.doubtnutapp','Native employer application identity changed')
 for(const location of ['India','Worldwide']){
  const doc=activeDocument(await read('https://www.linkedin.com/jobs/search/?f_C=13222185&location='+location));reviewMarkup(doc)
  check(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='13222185'&&Object.hasOwn(n.attrs,'checked')).length===1,'Exact checked native employer scope changed')
  check(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1&&doc.nodes(n=>doc.hasClass(n,'job-search-card')).length===0,'Native scoped listing changed; role country, dates, expiry and active application require review')
 }
 const observations=[]
 for(const fact of POSTS){
  const doc=activeDocument(await read(fact.url));reviewMarkup(doc)
  const postings=schemas(doc).filter(v=>v['@type']==='SocialMediaPosting');check(postings.length===1,'Native social posting schema changed')
  const posting=postings[0];reviewFields(posting)
  const allowed=new Set(['@context','@type','@id','datePublished','headline','comment','commentCount','articleBody','author','interactionStatistic','hasPart','text','image'])
  check(Object.keys(posting).every(k=>allowed.has(k)),'New native social metadata requires review')
  check(posting['@id']===fact.url&&posting.author?.name==='Doubtnut'&&posting.author?.url==='https://in.linkedin.com/company/doubtnut','Native social exact employer or role identity changed')
  const nativePostedDate=nativeDate(posting.datePublished,{required:true})
  check(posting.datePublished===fact.date&&Date.parse(nativePostedDate.iso)<=Date.parse(new Date(now).toISOString()),'Native earliest social publication changed or future')
  check(typeof posting.articleBody==='string'&&createHash('sha256').update(posting.articleBody).digest('hex')===fact.hash&&doc.text(doc.root).includes(posting.articleBody.replace(/\s+/g,' ').trim()),'Native visible role prose changed; country, publication, expiry and application require review')
  if(fact.group==='engineering-2020')check(doc.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='public_post_feed-article-content').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href===FRESHTEAM_URL}catch{return false}}),'Historical exact employer Freshteam handoff changed')
  observations.push({id:fact.id,title:fact.title,sourceURL:fact.url,nativePostedDate,country:null,location:null,nativeApplicationURL:fact.application,activeApplyVerified:false,group:fact.group,exclusionReason:'historical-vacancy;missing-explicit-job-country;active-application-unverified'})
 }
 const excludedNativeCandidates=[...new Set(observations.map(f=>f.group))].map(group=>{
  const records=observations.filter(f=>f.group===group).sort((a,b)=>a.nativePostedDate.iso.localeCompare(b.nativePostedDate.iso))
  return {...records[0],nativePublicationObservations:records,firstEverPublication:null}
 }).sort((a,b)=>a.nativePostedDate.iso.localeCompare(b.nativePostedDate.iso))
 return {jobs:[],firstParty:false,inventoryStatus:'coverage-gap',facts:{nativeEmployerId:'13222185',historicalATSTenantStatus:'invalid-domain',excludedNativeCandidates,nativeObservedRecordCount:observations.length,sourceListingComplete:false,sourceScopeComplete:false},reason:'Exact native Doubtnut employer 13222185 exposes no-match India and Worldwide searches; this is not proof of company emptiness. Employer-authored historical vacancies and earliest observed publication retained. Historical Freshteam handoff returns HTTP200 invalid-domain/no-ats, not an empty vacancy feed. No explicit job country or verified active application; posts excluded. Current corporate recruiting association unproven, firstParty false, whole-company counts unknown, lifecycle cleanup disabled.'}
}
