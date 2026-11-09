// Two configured public employer profiles. Announcements and a guest search
// carrying an unwanted keyword remain observations, never vacancy-zero proof.
import {structure,norm,stable,sha} from '../bizongo/publicRead.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {collectPublicSource,coverageGap,requireSource} from '../adda247/sourceBoundary.js'

const profiles={actaai:{name:'Acta.ai',id:'98814926',tenant:'acta-ai'},arms4ai:{name:'ARMS 4 AI',id:'69828325',tenant:'arms4ai'}}
const configFor=source=>{const config=profiles[source];if(!config)throw TypeError('Unreviewed configured public employer');return config}
const aliases=config=>['www.linkedin.com','in.linkedin.com'].flatMap(host=>['','/'].map(end=>'https://'+host+'/company/'+config.tenant+end))
const profileURL=config=>'https://www.linkedin.com/company/'+config.tenant+'/'
const searchURL=config=>'https://www.linkedin.com/jobs/search/?f_C='+config.id+'&geoId=102713980'
const need=(condition,source,message)=>requireSource(condition,source,message)
const nativeProfile=(value,config)=>{try{return aliases(config).includes(new URL(value).href)}catch{return false}}

export function inspectNativeProfile(source,html){
 const config=configFor(source),s=structure(html),schemas=s.visible(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').flatMap(node=>{
  let value;try{value=JSON.parse(node.raw)}catch{need(false,source,'malformed current employer schema')}
  return[value,...(Array.isArray(value?.['@graph'])?value['@graph']:[])]
 })
 const organizations=schemas.filter(node=>node?.['@type']==='Organization'&&node.name===config.name&&nativeProfile(node.url,config))
 need(organizations.length===1&&s.visible(node=>node.tag==='h1'&&norm(s.text(node))===config.name).length===1,source,'current native employer identity changed')
 const ids=[]
 for(const node of s.visible(node=>node.tag==='a'&&node.attrs.href))try{
  const outer=new URL(node.attrs.href);if(outer.protocol!=='https:'||!['www.linkedin.com','in.linkedin.com'].includes(outer.hostname)||outer.port||outer.username||outer.password)continue
  const redirect=outer.searchParams.get('session_redirect');if(!redirect)continue
  const target=new URL(redirect);if(target.protocol!=='https:'||!['www.linkedin.com','in.linkedin.com'].includes(target.hostname)||target.port||target.pathname!=='/search/results/people/')continue
  const values=JSON.parse(target.searchParams.get('facetCurrentCompany'));if(Array.isArray(values))ids.push(...values.map(String))
 }catch{ /* Employee-facet data binds identity; no employee endpoint is read. */ }
 // Small profiles need not render an employee facet. The current own-company
 // header report control and own company-to-jobs module also publish typed URNs.
 // Hidden comments and unrelated recommended-company modules are not authority.
 for(const node of s.visible(node=>node.attrs['data-semaphore-tracking-prefix']==='top-card_ellipsis-menu-semaphore'&&node.attrs['data-semaphore-content-type']==='COMPANY')){
  const id=node.attrs['data-semaphore-content-urn']?.match(/^urn:li:organization:(\d+)$/)?.[1];need(id,source,'native header organization reference changed');ids.push(id)
 }
 for(const node of s.visible(node=>node.attrs['data-module-name']==='company_to_jserps_coview'&&node.attrs['data-impression-id']==='organization_guest_linkster')){
  const id=node.attrs['data-entity-id']?.match(/^urn:li:organization:(\d+)$/)?.[1];need(id,source,'native company-to-jobs organization reference changed');ids.push(id)
 }
 need(ids.length>0&&ids.every(id=>id===config.id),source,'native organization ID is absent or conflicting')
 const commentary=node=>!s.active(node)||node.tag==='script'?'':node.tag==='br'?'\n':node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):commentary(child)).join('')
 const served=s.visible(node=>node.attrs['data-test-id']==='main-feed-activity-card__commentary').map(node=>norm(commentary(node)))
 const nativeAnnouncements=schemas.filter(node=>node?.['@type']==='SocialMediaPosting').map(post=>{
  let url;try{url=new URL(post.url)}catch{need(false,source,'native announcement URL changed')}
  const id=url.pathname.match(new RegExp('^/posts/'+config.tenant+'_[^/]+-activity-(\\d+)-[^/]+$'))?.[1]
  need(url.origin==='https://www.linkedin.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&id&&post.mainEntityOfPage===post.url,source,'native announcement identity changed')
  need(post.author?.['@type']==='Organization'&&post.author.name===config.name&&nativeProfile(post.author.url,config),source,'native announcement employer identity changed')
  // A publisher may share an article with no commentary. Keep the empty native
  // text as an observation; never fabricate a role description from that link.
  need(typeof post.text==='string'&&typeof post.datePublished==='string'&&Number.isFinite(Date.parse(post.datePublished)),source,'native announcement text/date changed')
  return{kind:'native-public-employer-announcement',nativeAnnouncementId:id,sourceUrl:post.url,originalText:post.text,originalTextSHA256:sha(post.text),announcementPublishedAt:post.datePublished,
   hiringSignal:/\b(?:hiring|we are looking for|we['’]re looking for)\b/i.test(post.text),nativeTextParity:served.includes(norm(post.text)),nativeTextQualification:'public-announcement;not-a-verified-full-native-role',
   jobId:null,requisitionId:null,jobPostingDate:null,country:null,jobDescription:null,fullNativeJobDescriptionQualified:false,applicationActionPerformed:false}
 })
 need(nativeAnnouncements.length<=100&&new Set(nativeAnnouncements.map(row=>row.nativeAnnouncementId)).size===nativeAnnouncements.length,source,'duplicate/excessive native announcement identities')
 const activeJobsLinks=s.visible(node=>node.tag==='a'&&node.attrs.href).flatMap(node=>{try{const url=new URL(node.attrs.href);return url.protocol==='https:'&&['www.linkedin.com','in.linkedin.com'].includes(url.hostname)&&!url.port&&!url.username&&!url.password&&(/^\/jobs\/view\//.test(url.pathname)||url.searchParams.get('f_C')===config.id)?[{url:url.href,label:s.text(node)}]:[]}catch{return[]}})
 const org=organizations[0],employerIdentity={name:org.name,organizationId:config.id,profileURL:org.url,publishedWebsite:org.sameAs??null}
 return{nativeOrganizationId:config.id,employerIdentity,originalNativeOrganization:org,nativeAnnouncements,activeJobsLinks,model:{employerIdentity,nativeAnnouncements:[...nativeAnnouncements].sort((a,b)=>a.nativeAnnouncementId.localeCompare(b.nativeAnnouncementId)),activeJobsLinks:[...activeJobsLinks].sort((a,b)=>a.url.localeCompare(b.url))}}
}
export function inspectNativeSearch(source,html){
 const config=configFor(source),s=structure(html),forms=s.visible(node=>node.tag==='form'&&node.attrs.id==='jserp-filters')
 need(forms.length===1&&forms[0].attrs.action==='https://www.linkedin.com/jobs/search/'&&(!forms[0].attrs.method||forms[0].attrs.method.toLowerCase()==='get'),source,'current public native search form changed')
 const owner=node=>{if(Object.hasOwn(node.attrs,'form'))return node.attrs.form==='jserp-filters';for(let parent=s.parents.get(node);parent;parent=s.parents.get(parent))if(parent.tag==='form')return parent===forms[0];return false}
 const disabled=node=>{for(let parent=node;parent;parent=s.parents.get(parent))if((parent===node||parent.tag==='fieldset')&&Object.hasOwn(parent.attrs,'disabled'))return true;return false}
 const successful=node=>node.tag==='input'&&owner(node)&&!disabled(node)&&(!['checkbox','radio'].includes(node.attrs.type)||Object.hasOwn(node.attrs,'checked'))
 const values=name=>[...new Set(s.nodes.filter(node=>successful(node)&&node.attrs.name===name).map(node=>node.attrs.value??''))]
 const keywordValues=values('keywords'),nativeCompanyFilters=values('f_C'),nativeGeographyFilters=values('geoId'),cards=s.visible(node=>/^urn:li:jobPosting:\d+$/.test(node.attrs['data-entity-urn']||'')).map(node=>({nativePostingId:node.attrs['data-entity-urn'].slice('urn:li:jobPosting:'.length),originalServedText:s.text(node)}))
 need(cards.length<=1000&&new Set(cards.map(row=>row.nativePostingId)).size===cards.length,source,'duplicate/excessive unqualified native search cards')
 return{keywordValues,nativeCompanyFilters,nativeGeographyFilters,nativeHeadings:s.visible(node=>['h1','title'].includes(node.tag)).map(node=>s.text(node)),unexpectedKeywordRestriction:keywordValues.some(value=>value!==''),
  employerFilterBound:nativeCompanyFilters.length===1&&nativeCompanyFilters[0]===config.id,geographyFilterBound:nativeGeographyFilters.length===1&&nativeGeographyFilters[0]==='102713980',observedJobCardCount:cards.length,unqualifiedNativeCards:cards,nativeVacancyTotal:null,nativeIndiaTotal:null,
  qualification:'configured-native-guest-query-observation;no-authoritative-employer-vacancy-total'}
}
export const createCurrentProfileScraper=(source,defaults={})=>({async run(passed={}){
 const config=configFor(source),options={...defaults,...passed},url=profileURL(config),query=searchURL(config),allowed=new Set([...aliases(config),query])
 return collectPublicSource(source,options,allowed,async({read,audit,stamp,receipts,signal})=>{
  let first
  const snapshot=async phase=>{
   let profile
   try{profile=inspectNativeProfile(source,await read(url,{phase,allowedFinalUrls:aliases(config)}));return{profile,search:inspectNativeSearch(source,await read(query,{phase}))}}
   catch(error){signal.throwIfAborted();await audit({...first?.profile??profile??{},configuredSearch:first?.search??null,partialCurrentProfile:profile??null,nativeSnapshotFailure:{phase,status:error.status??null,failureKind:error.failureKind??null},closingReconciled:false,inventoryEvidence:error.inventoryEvidence??coverageGap(url,'current native snapshot unavailable'),companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false});throw error}
  }
  first=await snapshot('opening')
  const last=await snapshot('closing'),closingReconciled=stable([first.profile.model,first.search])===stable([last.profile.model,last.search]),evidence={...coverageGap(url,'configured-employer-profile-announcements-and-unqualified-guest-query;native-vacancy-scope-unavailable'),pagesFetched:receipts.length,verifiedAt:stamp()}
  await audit({...first.profile,configuredSearch:first.search,closingReconciled,inventoryEvidence:evidence,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  need(closingReconciled,source,'closing native employer announcement/search model changed')
  need(!first.profile.activeJobsLinks.length,source,'new public native job handoff requires reviewed detail collection')
  need(first.search.employerFilterBound&&first.search.geographyFilterBound&&!first.search.observedJobCardCount,source,'unqualified native query/cards require a reviewed full vacancy collector')
  return attachSourceObservationEvidence(attachInventoryEvidence([],evidence),{source,recordKind:'hiring-signals',observedRecordCount:1+first.profile.nativeAnnouncements.length,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 })
}})
