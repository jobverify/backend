import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'

export const HOME_URL='https://questt.com/'
export const EMPLOYER_URL='https://www.linkedin.com/company/questtai'
export const EMPLOYER_ID='69658946'
const check=(condition,message)=>{if(!condition)throw Error(message)}
const parse=(html,{social=false}={})=>{
 const doc=document(html)
 const prune=(n,hidden=false)=>{n.inactive ||= hidden||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const c of n.children.filter(v=>typeof v!=='string'))prune(c,n.inactive)}
 prune(doc.root)
 const schemas=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw))
 const visit=(value,corporateAddress=false)=>{
  if(!value||typeof value!=='object')return
  check(![value['@type']].flat().includes('JobPosting'),'New JobPosting requires native country, publication, expiry and application review')
  for(const [key,v] of Object.entries(value)){
   if(/^(?:addressCountry|country|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|jobLocation|hiringOrganization)$/i.test(key)){
    const socialDate=social&&value['@type']==='SocialMediaPosting'&&key==='datePublished'
    check(socialDate||corporateAddress&&key==='addressCountry'&&v==='IN','New structured role dates, expiry or country require review')
    if(socialDate)nativeDate(v,{required:true})
   }
   visit(v,social&&key==='address'&&value['@type']==='Organization'&&value.name==='Questt AI'&&value.url==='https://in.linkedin.com/company/questtai'&&value.sameAs==='https://questt.ai')
  }
 }
 schemas.forEach(value=>visit(value))
 check(!doc.nodes(n=>/JobPosting/i.test(n.attrs.itemtype||'')||/(?:^|\s)(?:addressCountry|country|jobLocation|hiringOrganization|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)(?:\s|$)/i.test(n.attrs.itemprop||'')||n.tag==='meta'&&/^(?:addressCountry|country|jobLocation|datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate)$/i.test(n.attrs.name||n.attrs.property||'')).length,'New native role country/date/expiry microdata requires review')
 return {doc,schemas}
}
export const collectQuesttNative=async({read})=>{
 const {doc:home}=parse(await read(HOME_URL))
 check(home.nodes(n=>n.tag==='h2'&&home.text(n)==='Questt AI, Bengaluru').length===1&&home.text(home.root).includes('Intelligence Warehouse')&&home.text(home.root).includes('Akhil Singh')&&home.text(home.root).includes('Nidhi Prabhu'),'Current exact Questt corporate identity changed')
 check(!home.nodes(n=>n.tag==='a'&&/careers?|hiring|open(?:ings|\s+roles)|join\s+(?:our|the)\s+team|jobs(?:\/|$)/i.test((n.attrs.href||'')+' '+home.text(n))).length,'New official recruiting handoff requires native inventory review')
 const {doc:employer,schemas}=parse(await read(EMPLOYER_URL),{social:true})
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='Questt AI').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:'+EMPLOYER_ID).length===1,'Native exact Questt AI employer identity changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&new URL(u.searchParams.get('url')).href==='https://questt.ai/'}catch{return false}}),'Native reciprocal Questt AI domain changed')
 check(schemas.flatMap(v=>v['@graph']||[v]).some(v=>v['@type']==='Organization'&&v.name==='Questt AI'&&v.url==='https://in.linkedin.com/company/questtai'&&v.sameAs==='https://questt.ai'),'Native structured exact employer association changed')
 check(!employer.nodes(n=>n.tag==='a'&&/\/jobs\/view\//.test(n.attrs.href||'')).length,'New native social vacancy requires exact role review')
 const scopeObservations=[]
 for(const location of ['India','Worldwide']){
  const url=`https://www.linkedin.com/jobs/search/?f_C=${EMPLOYER_ID}&location=${location}`
  const {doc}=parse(await read(url))
  check(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value===EMPLOYER_ID&&Object.hasOwn(n.attrs,'checked')).length===1,'Native exact employer scope changed')
  check(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1&&!doc.nodes(n=>doc.hasClass(n,'job-search-card')).length,'Native scoped inventory changed; new roles require country/date/expiry/application review')
  scopeObservations.push({url,employerId:EMPLOYER_ID,location,observedNoMatch:true,observedCardCount:0})
 }
 return {jobs:[],firstParty:false,inventoryStatus:'coverage-gap',facts:{scopeObservations,nativeCandidates:[],nativeObservedRecordCount:0,sourceScopeComplete:false,sourceListingComplete:false},reason:'Current Questt AI official corporate identity and exact native employer 69658946 validated. Checked India and Worldwide native scopes expose no-match states; neither establishes complete company inventory. No current role with native country, publication and enabled same-role application was recovered. Historical apply shortener redirects to expired unrelated search. Whole-company and India counts unknown; cleanup disabled.'}
}
