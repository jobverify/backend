import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const CAREERS_URL='https://www.cognitensor.com/'
export const CORPORATE_CAREERS_URL='https://www.cognitensor.com/company/careers'
export const EMPLOYER_URL='https://www.linkedin.com/company/cognitensor'
export const LISTING_URL='https://www.linkedin.com/jobs/search/?f_C=11509078&location=India'
export const CLIENT_URL='https://www.cognitensor.com/assets/index-CafDbZnE.js'
export const REVIEWED_CLIENT_SHA256='2ce519cb04ff8646389a4819d8d03e00cc704878552d92bb34d1ea1dc1086d29'
const check=(ok,reason)=>{if(!ok)throw Error(reason)}
const activeDocument=html=>{
 const doc=document(html)
 const prune=(node,inherited=false)=>{
  node.inactive ||= inherited||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''))
  for(const child of node.children.filter(v=>typeof v!=='string'))prune(child,node.inactive)
 }
 prune(doc.root);return doc
}
export const collectCogniTensorNative=async({read})=>{
 for(const url of [CAREERS_URL,CORPORATE_CAREERS_URL]){
  const html=await read(url),doc=activeDocument(html)
  check(/<title\b[^>]*>\s*CogniTensor\s*\|[^<]*<\/title>/i.test(html),'Corporate exact employer identity changed')
  check(doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src==='/assets/index-CafDbZnE.js').length===1,'Corporate active client handoff changed')
  check(doc.nodes(n=>n.tag==='div'&&n.attrs.id==='root').length===1,'Corporate active app root missing')
 }
 const client=await read(CLIENT_URL)
 // The reviewed client routes /company/careers to function IT: its Open Positions
 // section is a static Coming Soon message and general contact links. It has no
 // recruiting fetch/API or jobs array. Pinning the full reviewed client prevents
 // new roles, country/date/expiry fields or alternative APIs from being ignored.
 check(createHash('sha256').update(client).digest('hex')===REVIEWED_CLIENT_SHA256,'Corporate recruiting client changed; new native inventory review required')
 check(client.includes('path:"/company/careers",element:e.jsx(IT,{})')&&client.includes('children:"Coming Soon"')&&client.includes('"data-testid":"link-careers-general-application"')&&client.includes('href:"https://www.linkedin.com/company/cognitensor"'),'Reviewed active corporate careers route or employer handoff missing')
 const employer=activeDocument(await read(EMPLOYER_URL))
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='CogniTensor').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:11509078').length===1,'Exact native employer identity changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{
  try{const u=new URL(n.attrs.href),target=new URL(u.searchParams.get('url'));return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&target.href==='https://www.cognitensor.com/'}catch{return false}
 }),'Exact native employer reciprocal website changed')
 for(const location of ['India','Worldwide']){
  const listing=activeDocument(await read('https://www.linkedin.com/jobs/search/?f_C=11509078&location='+location))
  check(!listing.nodes(n=>/(?:^|\s)(?:datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|addressCountry|jobLocation|country|hiringOrganization)(?:\s|$)/i.test(n.attrs.itemprop||'')||n.tag==='meta'&&/^(?:datePosted|datePublished|dateModified|validThrough|closingDate|expiryDate|addressCountry|jobLocation|country)$/i.test(n.attrs.name||n.attrs.property||'')).length,'New native role country/date/expiry metadata requires review')
  check(!listing.nodes(n=>/JobPosting/i.test(n.attrs.itemtype||'')).length,'New native microdata role requires review')
  const containsPosting=value=>Array.isArray(value)?value.some(containsPosting):value&&typeof value==='object'&&([value['@type']].flat().includes('JobPosting')||Object.values(value).some(containsPosting))
  for(const n of listing.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))check(!containsPosting(JSON.parse(n.raw)),'New native JobPosting country/date/expiry requires review')
  check(listing.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='11509078'&&Object.hasOwn(n.attrs,'checked')).length===1,'Native checked exact employer filter missing')
  check(listing.nodes(n=>n.tag==='h1'&&listing.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1&&listing.nodes(n=>listing.hasClass(n,'job-search-card')).length===0,'Native scoped observation changed; new role country/date/expiry/application review required')
 }
 return {jobs:[],firstParty:true,facts:{nativeRecordCount:0,visitedDetailCount:0,corporateClientSHA256:REVIEWED_CLIENT_SHA256},reason:'Reviewed active corporate SPA careers component publishes Coming Soon and general application contact only; active corporate footer hands off to exact native employer 11509078 with reciprocal official website. Exact employer-filtered India and Worldwide native searches observed no matching cards. This bounded observation does not establish complete company inventory; totals unknown and cleanup disabled. A separately discovered historical role redirected to unrelated expired-role search and was rejected.'}
}
