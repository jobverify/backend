import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {extractDwrPayload,fetchSuccessFactorsSearchSession,postSuccessFactorsDwr} from '../../scraper-support/shared/successFactorsDwr.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {getLiveSearchPages,extractDwrSearchResults,extractJobDetail} from './script.js'
import review from './currentAuthority20261113.json' with {type:'json'}

const CAREERS='https://www.biocon.com/careers/',BOARD='https://career10.successfactors.com/career?company=bioconlimi'
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(value,reason)=>{if(!value)throw Object.assign(Error('Biocon current native: '+reason),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})}
const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
const snapshot=node=>typeof node==='string'?node:{tag:node.tag,attrs:node.attrs,inert:!!node.inert,...(Object.hasOwn(node,'raw')?{raw:node.raw}:{}),children:node.children.map(snapshot)}
const parsed=html=>{const doc=readNativeDocument(html),root=doc.nodes(node=>node.tag==='root')[0],nodes=all(root),parents=new Map();for(const node of nodes)for(const child of node.children)if(typeof child!=='string')parents.set(child,node);return{doc,root,nodes,parents}}
const attributes=node=>Object.fromEntries(Object.entries(node.attrs).map(([key,value])=>[key,node.tag==='form'&&key==='action'?'<native-career-form-action>':key==='onclick'&&node.tag==='button'&&/^applyButton_(top|bottom)$/.test(node.attrs.id)?'<native-role-Apply-handler>':value]))
const chain=(node,parents)=>{const output=[];for(let at=node;at;at=parents.get(at))output.push({tag:at.tag,attrs:attributes(at),inert:!!at.inert});return output}
const styling=(tree,url)=>({declarations:tree.nodes.filter(node=>node.tag==='link'&&(decodeHTML(node.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')||decodeHTML(node.attrs.as||'').trim().toLowerCase()==='style')).map(node=>({attrs:node.attrs,href:new URL(node.attrs.href,url).href})),inline:tree.nodes.filter(node=>node.tag==='style').map(node=>({attrs:node.attrs,sha256:hash(node.raw||'')}))})
const typedKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key))
const reviewedPosting=row=>typedKeys(row,['corporatePosting','defaultLocale','id','jobReqSecKey','multiLingualTitles','operatorId','operatorName','otherValues','postingDate','showReferJobToFriend','title'])
  && Array.isArray(row.otherValues)&&row.otherValues.length===2&&row.otherValues.every(group=>Array.isArray(group))
  && row.otherValues.flat().length===5&&row.otherValues.flat().every((field,index)=>typedKeys(field,['fieldId','internalVal','longVal','shortVal'])
    && field.fieldId===['legalEntity_obj','department_obj','filter1','filter3','filter4'][index]&&field.internalVal===null&&field.longVal===null&&typeof field.shortVal==='string'&&(index<3||field.shortVal===''))
const normalized=row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='jobReqSecKey'))
const decodePages=pages=>{
  need(Array.isArray(pages)&&pages.length>0&&pages.length<=20,'bounded public native pages unavailable')
  const postings=[];let total
  for(const [index,text] of pages.entries()){
    const payload=extractDwrPayload(text,{}),results=payload?.results,pagination=results?.options?.pagination
    need(results&&Number.isSafeInteger(results.postingCount)&&results.postingCount>=0&&results.postingCount<=200
      && Array.isArray(results.postings)&&pagination?.currentPage===index+1&&pagination.pageSize===10
      && pagination.totalCount===results.postingCount&&pagination.startRow===index*10+1&&pagination.endRow===(index+1)*10
      && results.internalSearch===false&&results.userLoggedIn===false,'unfiltered native total, pagination or public scope changed')
    total??=results.postingCount;need(total===results.postingCount,'native total changed during pagination')
    postings.push(...results.postings)
  }
  need(postings.length===total&&new Set(postings.map(row=>row.id)).size===total&&postings.every(row=>Number.isSafeInteger(row.id)&&row.id>0),'native pagination incomplete or duplicated')
  return{postings,listings:pages.flatMap(extractDwrSearchResults)}
}

export async function runCurrentBiocon20261113(options={}){
  options.signal?.throwIfAborted()
  const deadline=AbortSignal.timeout(270000),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
  const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted()}
  const wait=promise=>new Promise((resolve,reject)=>{
    check();const abort=()=>{signal.removeEventListener('abort',abort);reject(options.signal?.aborted?options.signal.reason:signal.reason)}
    signal.addEventListener('abort',abort,{once:true})
    Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);try{check();resolve(value)}catch(error){reject(error)}},error=>{signal.removeEventListener('abort',abort);reject(options.signal?.aborted?options.signal.reason:error)})
    if(signal.aborted)abort()
  })
  const responses=[],failures=[];let requests=0
  const strictFetch=async(url,init={})=>{
    check();need(++requests<=250,'native request bound exceeded')
    const target=new URL(url),method=init.method||'GET'
    need(target.protocol==='https:'&&!target.username&&!target.password&&!target.port
      && ((target.origin==='https://www.biocon.com'&&target.pathname==='/careers/'&&method==='GET')
        || target.origin==='https://career10.successfactors.com'&&(method==='GET'&&target.pathname==='/career'
          || method==='POST'&&/^\/xi\/ajax\/remoting\/call\/plaincall\/careerJobSearchControllerProxy\.(?:getInitialJobSearchData|search)\.dwr$/.test(target.pathname))), 'undeclared public native request')
    const response=await wait((options.fetchImpl||fetch)(url,{...init,redirect:'manual',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])}))
    need(response.status===200&&response.url===url,'public HTTP or final URL changed')
    const text=await wait(response.text());need(Buffer.byteLength(text)<=4000000,'public body byte bound exceeded')
    responses.push({url,method,status:200,bytes:Buffer.byteLength(text),sha256:hash(text)})
    return{status:200,ok:true,url,headers:response.headers,text:async()=>text}
  }
  const read=async url=>{check();if(options.fetchText){const text=await wait(options.fetchText(url,{signal}));need(typeof text==='string'&&Buffer.byteLength(text)<=4000000,'injected native body invalid');responses.push({url,method:'GET',bytes:Buffer.byteLength(text),sha256:hash(text)});return text}return(await strictFetch(url,{headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,text/css'}})).text()}
  const search=async()=>decodePages(await wait(options.getSearchPages?options.getSearchPages({signal}):getLiveSearchPages({signal,fetchText:read,
    fetchSearchSession:args=>fetchSuccessFactorsSearchSession({...args,fetchImpl:strictFetch,signal}),
    fetchDwrText:async args=>{const text=await postSuccessFactorsDwr({...args,fetchImpl:strictFetch,signal});const count=extractDwrPayload(text,{})?.results?.postingCount;need(Number.isSafeInteger(count)&&count<=200,'native pagination total exceeds bound');return text}})))
  const context=async()=>{
    const html=await read(CAREERS),tree=parsed(html),known=review.pages.find(row=>row.url===CAREERS),styles=styling(tree,CAREERS)
    need(equal(styles.declarations,known.declarations)&&equal(styles.inline,known.inline),'corporate authority styling declarations changed')
    const links=tree.nodes.filter(node=>node.tag==='a'&&node.attrs.href===BOARD)
    need(links.length===known.targets.length&&links.length>0&&links.every((node,index)=>hash(chain(node,tree.parents))===known.targets[index].chainSHA256),'corporate authority visibility or ancestry changed')
    return{html,stylingQualified:review.stylesheetBytesReviewed===true&&known.declarations.every(row=>typeof row.sha256==='string')}
  }
  const inspect=async(row,listing,phase)=>{
    const html=await read(listing.sourceUrl),tree=parsed(html),known=review.pages.find(value=>value.roleId===String(row.id)),issues=[]
    const fail=reason=>issues.push(reason)
    if(!known||!reviewedPosting(row))fail('native-posting-schema-or-country-alternative-unreviewed')
    let detail
    try{detail=extractJobDetail(html,listing)}catch(error){fail('native-role-identity:'+error.message)}
    const frame=tree.nodes.find(node=>node.tag==='div'&&tree.doc.hasClass(node,'joqReqDescription'))
    if(!known||!frame||hash(snapshot(frame))!==known.criteriaTreeSHA256
      ||hash(tree.doc.text(tree.nodes.find(node=>node.tag==='body')||tree.root))!==known.bodyTextSHA256)fail('native-original-criteria-tree-or-visibility-changed')
    if(known){
      const targets=tree.nodes.filter(node=>node===frame||node.tag==='h1'||node.tag==='button'&&/^applyButton_(top|bottom)$/.test(node.attrs.id))
      if(targets.length!==known.targets.length||targets.some((node,index)=>hash(chain(node,tree.parents))!==known.targets[index].chainSHA256))fail('native-role-or-Apply-visibility-ancestry-changed')
      const styles=styling(tree,listing.sourceUrl)
      if(!equal(styles.declarations,known.declarations)||!equal(styles.inline,known.inline))fail('native-styling-declaration-unreviewed')
      const program=(from,to)=>{const start=html.indexOf(from),end=html.indexOf(to,start+from.length);return start>=0&&end>start?hash(html.slice(start,end)):null}
      if(program('function applyJobReq','function saveJobReq')!==known.applyProgramSHA256
        ||program('function JobListingDpcs2Handler','function showMFieldDialog')!==known.consentDispatchProgramSHA256)fail('native-Apply-program-unreviewed')
    }
    const buttons=tree.nodes.filter(node=>node.tag==='button'&&/^applyButton_(top|bottom)$/.test(node.attrs.id))
    if(buttons.length!==2||buttons.some(node=>{
      const expression=new RegExp(`^checkDpcs2AndProceed\\(\\{isUserLoggedIn:false,jobReqId:${row.id},jobSecKey:'[A-Za-z0-9+/=_-]{16,1024}',isApplyWithLinkedIn:false,elementId:'${node.attrs.id}',evtSrc:'Apply'\\}\\);returnfalse;?$`)
      return node.inert||Object.hasOwn(node.attrs,'disabled')||node.attrs['aria-disabled']||!expression.test((node.attrs.onclick||'').replace(/\s+/g,''))
    }))fail('native-active-same-role-Apply-control-unqualified')
    const forms=tree.nodes.filter(node=>node.tag==='form'&&node.attrs.id==='careerform')
    try{const form=new URL(forms[0]?.attrs.action,listing.sourceUrl);if(forms.length!==1||form.origin!=='https://career10.successfactors.com'||form.pathname!=='/career'||form.searchParams.size!==1||!form.searchParams.get('_s.crb'))fail('native-Apply-form-action-unqualified')}catch{fail('native-Apply-form-action-unqualified')}
    if(!detail?.country||!nativeCountryName(detail.country)||!detail?.jobDescription)fail('native-role-country-or-full-authored-criteria-unavailable')
    const intrinsicIssues=[...issues]
    if(!review.stylesheetBytesReviewed)fail('current-declared-stylesheet-bytes-unreviewed')
    return{requisitionId:String(row.id),phase,nativeHtml:html,detail,issues,intrinsicIssues,sourceDetailComplete:issues.length===0,originalCriteriaContentReconciled:!intrinsicIssues.some(reason=>/criteria|styling|identity/.test(reason)),nativeApplyProgramReconciled:!intrinsicIssues.some(reason=>/Apply/.test(reason))}
  }
  const employer=await context(),opening=await search(),details=[]
  for(const row of opening.postings)details.push(await inspect(row,opening.listings.find(value=>value.requisitionId===String(row.id)),'opening'))
  const employerClosing=await context(),closing=await search(),closingDetails=[]
  for(const row of closing.postings)closingDetails.push(await inspect(row,closing.listings.find(value=>value.requisitionId===String(row.id)),'closing'))
  const final=await search(),stable=equal(opening.postings.map(normalized),closing.postings.map(normalized))&&equal(opening.postings.map(normalized),final.postings.map(normalized))
  if(!stable)failures.push('native-entire-inventory-changed-after-closing-details')
  const jobs=[],withheldDetails=[]
  for(const proof of details){
    const last=closingDetails.find(value=>value.requisitionId===proof.requisitionId),issues=[...proof.issues,...(last?.issues||['native-closing-detail-unavailable'])]
    if(!stable||!last||!equal(proof.detail,last.detail))issues.push('native-full-closing-identity-country-or-criteria-changed')
    if(!employer.stylingQualified||!employerClosing.stylingQualified)issues.push('corporate-authority-stylesheet-bytes-unreviewed')
    if(issues.length){withheldDetails.push({requisitionId:proof.requisitionId,issues:[...new Set(issues)]});continue}
    jobs.push({...proof.detail,jobId:proof.requisitionId,source:'biocon',company:'Biocon',sourceUrl:opening.listings.find(row=>row.requisitionId===proof.requisitionId).sourceUrl,
      link:proof.detail.applyUrl,sourceDetailComplete:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()})
  }
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:responses.length,reportedTotal:opening.postings.length,indiaFacetCount:null,verifiedAt:null,reason:'Complete original native criteria and date corrections retained; current rendered stylesheet bytes, unknown country or active application qualification remain held; no authoritative zero or cleanup.'})
  attachSourceObservationEvidence(jobs,{source:'biocon',recordKind:'vacancy-rows',observedRecordCount:opening.postings.length,observedVacancyCount:opening.postings.length,sourceScopeComplete:false})
  const audit={source:'biocon',originalPostings:opening.postings,closingPostings:closing.postings,finalPostings:final.postings,details,closingDetails,withheldDetails,failures,responses,
    originalEmployerHtml:employer.html,closingEmployerHtml:employerClosing.html,stylesheetBytesReviewed:review.stylesheetBytesReviewed,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const observed=options.onAudit?.(audit);if(observed&&typeof observed.then==='function')Promise.resolve(observed).catch(()=>{})
  check();return jobs
}
