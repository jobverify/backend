import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261115.json',import.meta.url)))
const SOURCE='theenergycompany',COMPANY='The ENERGY COMPANY',HOME=profile.home,BOARD=profile.board
const sha=value=>createHash('sha256').update(value).digest('hex')
const problem=message=>Object.assign(Error('The ENERGY COMPANY native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(condition,message)=>{if(!condition)throw problem(message)}
const one=(rows,label)=>{need(rows.length===1,'missing or ambiguous '+label);return rows[0]}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const elements=node=>node.children.filter(n=>typeof n!=='string')
const retained=(node,ancestors=[])=>[{node,ancestors},...elements(node).flatMap(n=>retained(n,[...ancestors,node]))]
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...elements(node).flatMap(n=>within(n,predicate))]
const cls=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const authority=/country|address|employer|company|organi[sz]ation|location|workplace|qualificat|requirement|skill|experience|responsibilit|credential|certification|job(?:id|title|role)|vacancy|publisher|schema|itemprop|itemtype|itemscope/i
const unavailable=/\b(?:(?:(?:this|the)\s+)?(?:job|role|position|vacancy|opening|opportunity)\s+(?:(?:is|was|has(?:\s+been)?)\s+)?(?:(?:already|now|currently)\s+)*(?:closed|filled|withdrawn|cancelled|canceled|expired|removed|unavailable|not\s+available|no\s+longer\s+(?:available|active|open))|(?:no\s+longer|not(?:\s+currently)?)\s+accepting\s+(?:(?:any|new)\s+)?applications|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+)?(?:(?:are|is|were|have\s+been|has\s+been)\s+)?(?:now\s+)?(?:closed|ended|stopped|suspended))\b/i
const encode=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
function presentation(raw,css){
  const render=node=>{
    if(typeof node==='string')return node
    if(['script','template','noscript','object','textarea','xmp','noembed','noframes','plaintext'].includes(node.tag))return''
    if(node.tag==='root')return node.children.map(render).join('')
    // Opening these exact, reviewed standard HTML details exposes the same
    // authored criteria as the public summary control. No client code runs.
    const attrs=node.tag==='details'&&node.attrs.class==='t-role'?{...node.attrs,open:''}:node.attrs
    const start='<'+node.tag+Object.entries(attrs).map(([key,value])=>' '+key+'="'+encode(value)+'"').join('')+'>'
    if(voids.has(node.tag))return start
    const body=node.tag==='style'?node.raw||'':node.tag==='title'?encode(node.raw||''):node.tag==='iframe'?'':node.children.map(render).join('')
    return start+(node.tag==='head'?'<style>'+css+'</style>':'')+body+'</'+node.tag+'>'
  }
  return readVisibleNativeDocument(render(one(raw.nodes(n=>n.tag==='root'),'document root')),{strict:true})
}
function header(page,title,{legal=true,publishedLegal=false}={}){
  const head=one(page.raw.nodes(n=>n.tag==='head'),'native head')
  need(one(elements(head).filter(n=>n.tag==='title'),'native head title').raw===title,'own publisher title changed')
  const root=one(page.visible.nodes(n=>n.tag==='root'),'visible document root')
  need(!unavailable.test(page.visible.text(root)),'current role explicitly filled, closed or unavailable')
  const main=one(page.raw.nodes(n=>n.tag==='main'&&n.attrs.id==='main'),'own main'),visibleMain=one(page.visible.nodes(n=>n.tag==='main'&&n.attrs.id==='main'),'visible own main')
  need(sha(page.raw.text(main))===page.model.mainTextSHA256,'unreviewed current main criteria or publisher context')
  need(sha(page.raw.text(one(page.raw.nodes(n=>n.tag==='body'),'own published body')))===page.model.publishedBodyTextSHA256,'unreviewed published hiring conditions outside the original main')
  if(legal||publishedLegal){
    const document=legal?page.visible:page.raw,footer=one(document.nodes(n=>n.tag==='footer'&&cls(n,'t-site-footer')),'own current legal publisher')
    need(document.text(footer).includes('The Energy Company and Flexi product names are trademarks of Encrate Private Limited.'),'current own employer/brand legal publisher changed')
    need(within(footer,n=>n.tag==='a'&&n.attrs.href==='/we-are-hiring'&&document.text(n)==='Careers').length===1,'own reciprocal careers publisher link changed')
  }
  return{main,visibleMain,legalPublisher:legal?'Encrate Private Limited':null,originalCompany:COMPANY}
}
function roles(page){
  const publication=header(page,profile.nativeBoardTitle),main=publication.main,visible=publication.visibleMain
  const hero=one(within(visible,n=>n.tag==='section'&&n.attrs.class==='t-phero'),'own careers hero')
  const country=one(within(hero,n=>n.tag==='span'&&page.visible.text(n)===profile.nativeCountryScope),'current explicit country scope')
  need(page.visible.text(country)==='Bengaluru, India','current country scope is not native India')
  const article=one(within(visible,n=>n.tag==='article'&&n.attrs.class==='t-art'),'own role article')
  need(elements(article).filter(n=>n.tag==='h2'&&page.visible.text(n)===profile.nativeRoleScope).length===1,'own native all-role worksite scope changed')
  const list=one(within(article,n=>n.tag==='div'&&n.attrs.class==='t-roles'),'own current roles')
  const native=one(within(main,n=>n.tag==='div'&&n.attrs.class==='t-roles'),'authored current roles')
  const rows=elements(native),rendered=elements(list)
  need(rows.length===5&&rendered.length===5&&rows.every(n=>n.tag==='details'&&same(n.attrs,{class:'t-role'})),'coverage-gap: changed or empty own roles; not zero inventory')
  const commonOwner=structuredClone(visible),commonList=one(within(commonOwner,n=>n.tag==='div'&&n.attrs.class==='t-roles'),'common hiring context owner')
  commonList.children=[]
  const commonHiringContext=page.visible.text(commonOwner)
  need(sha(commonHiringContext)===profile.nativeVisibleCommonHiringContextSHA256,'full common native hiring conditions or benefits changed or hidden')
  const posting=page.raw.text(main).match(/5 open roles · Posted (October 2026)/g)
  need(posting?.length===1,'native month-only publication label changed')
  return rows.map((node,index)=>{
    const expected=profile.roles[index],shown=rendered[index],children=elements(node)
    need(same(children.map(n=>n.tag),['summary','div'])&&same(children[0].attrs,{})&&same(children[1].attrs,{class:'t-role-body'}),'unreviewed native summary/full criteria structure')
    const ancestry=one(retained(one(page.raw.nodes(n=>n.tag==='root'),'raw root')).filter(row=>row.node===node),'native role ancestry').ancestors.map(n=>({tag:n.tag,attrs:n.attrs}))
    need(same(ancestry,expected.roleAncestors),'unreviewed native role ancestor attributes')
    const summary=children[0],summaryItems=elements(summary),body=children[1],bodyItems=elements(body)
    need(same(summaryItems.map(n=>n.tag),['strong','span','span','span','i'])&&summaryItems.slice(0,4).every(n=>same(n.attrs,{}))&&same(summaryItems[4].attrs,{'aria-hidden':'true'})&&same(summaryItems[4].children,['+']),'own title or native location labels changed')
    const labels=summaryItems.slice(0,4).map(n=>page.raw.text(n))
    need(same(labels,[expected.title,expected.department,expected.specialty,expected.nativeLocation])&&/^Bengaluru · Full-time(?:, travel)?$/.test(labels[3]),'own current title/department/location changed')
    need(same(bodyItems.map(n=>n.tag),['h3','ul','h3','ul','a'])&&same(bodyItems.map(n=>n.attrs),[{}, {class:'t-list'}, {}, {class:'t-list'}, {class:'t-btn t-btn--primary',href:expected.nativeApplyHref}]),'unreviewed or omitted native qualification/application content')
    need(page.raw.text(bodyItems[0])==='Responsibilities'&&page.raw.text(bodyItems[2])==="What we're looking for",'native full criteria headings changed')
    const responsibilities=elements(bodyItems[1]),qualifications=elements(bodyItems[3])
    need(responsibilities.length===6&&qualifications.length===4&&[...responsibilities,...qualifications].every(n=>n.tag==='li'&&same(n.attrs,{})&&elements(n).length===0&&page.raw.text(n).length>=15),'incomplete or unreviewed current mandatory criteria')
    need(retained(node).every(({node:n})=>(!n.inert||n===summaryItems[4])&&!Object.hasOwn(n,'raw')&&['details','summary','strong','span','i','div','h3','ul','li','a'].includes(n.tag)),'hidden, inert or unsupported role criteria')
    need(page.raw.text(node)===page.visible.text(shown),'full native criteria not visibly available through its own summary')
    const applyURL=new URL(bodyItems[4].attrs.href,BOARD).href,address=new URL(applyURL)
    need(applyURL===expected.applyURL&&page.raw.text(bodyItems[4])==='Apply for this role'&&address.origin===new URL(HOME).origin&&address.pathname==='/contact-us'&&same([...address.searchParams],[['interest','Jobs'],['role',expected.title]]),'own exact role-specific application identity changed')
    return{title:expected.title,department:expected.department,specialty:expected.specialty,nativeLocation:expected.nativeLocation,applyURL,
      responsibilities:responsibilities.map(n=>page.raw.text(n)),qualifications:qualifications.map(n=>page.raw.text(n)),fullRole:page.raw.text(node),commonHiringContext,nativeAuthoredRole:node,
      countryProof:{currentBoardCountry:page.visible.text(country),roleScope:profile.nativeRoleScope,currentRoleLocation:expected.nativeLocation},legalPublisher:publication.legalPublisher}
  })
}
function application(page,role){
  // The board supplies the visible legal binding. Preserve the application's
  // same-host publisher declaration as an additional contradiction check;
  // its footer is not promoted as visibility or employment-country proof.
  header(page,'Contact Us | The Energy Company',{legal:false,publishedLegal:true})
  const form=one(page.visible.nodes(n=>n.tag==='form'&&n.attrs['data-t-form']==='contact'),'visible own contact application')
  need(same(form.attrs,{class:'t-form','data-t-form':'contact','data-subject':'Website enquiry'}),'current own application form changed')
  const interest=one(within(form,n=>n.tag==='select'&&n.attrs.id==='interest'&&n.attrs.name==='interest'),'current Jobs interest control')
  need(!Object.hasOwn(interest.attrs,'disabled')&&within(interest,n=>n.tag==='option'&&n.attrs.value==='Jobs'&&page.visible.text(n)==='Jobs').length===1,'own application Jobs interest unavailable')
  const original=one(page.raw.nodes(n=>n.tag==='form'&&n.attrs['data-t-form']==='contact'),'authored own application form')
  const path=one(retained(one(page.raw.nodes(n=>n.tag==='root'),'raw root')).filter(row=>row.node===original),'authored form ancestry')
  need(same(path.ancestors.map(n=>({tag:n.tag,attrs:n.attrs})),page.model.formAncestors)&&same(retained(original).map(({node})=>({tag:node.tag,attrs:node.attrs})),page.model.formShape),'unreviewed form owner or control/criteria structure')
  const message=one(retained(original).filter(({node:n})=>n.tag==='textarea'&&n.attrs.id==='contact-msg'&&n.attrs.name==='message'),'own role-query message field').node
  need(same(message.attrs,page.model.messageControlAttributes)&&message.raw===''&&!Object.hasOwn(message.attrs,'disabled')&&!Object.hasOwn(message.attrs,'readonly'),'current role application message unavailable')
  const submit=one(within(form,n=>n.tag==='button'&&n.attrs.type==='submit'),'own application submission control')
  need(!Object.hasOwn(submit.attrs,'disabled')&&page.visible.text(submit)==='Send message','current own application submission unavailable')
  return{url:role.applyURL,interest:'Jobs',nativeRoleQuery:role.title,messagePrefill:'I would like to apply for the '+role.title+' role. Link to my CV / LinkedIn: ',currentLiteralPrefillAndCompleteControllerReviewed:true,applicationSubmissionPerformed:false,originalForm:form}
}

export async function runCurrentEnergy(options={}){
  need(!options.fetchText&&(!options.fetchPage||options.fetchImpl),'native HTTP metadata required; legacy body-only page input cannot qualify current roles')
  const value=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),now=Date.parse(value)
  need(Number.isFinite(now)&&new Date(now).toISOString().slice(0,7)>=profile.nativePostingMonth,'invalid clock or future native posting month')
  const duration=options.sourceDeadlineMs??85000;need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,fetchImpl=options.fetchImpl||globalThis.fetch
  const receipts=[],styles=new Map(),allowed=new Set([profile.configuredRoot,profile.configuredCareers]);let count=0,total=0
  const read=async(url,kind='html',redirect=false)=>{
    signal.throwIfAborted();need(allowed.has(url)&&++count<=60,'public native URL/read bound')
    const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:problem('native byte bound'),fetchImpl:async(value,init)=>{
      const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'}})
      const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();let bytes=0;return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native byte chunk type');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=24000000-total,'native stream byte bound');bytes+=part.value.byteLength;total+=part.value.byteLength}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
      return{status:response.status,url:response.url,headers:response.headers,body}
    }})
    const bytes=Buffer.from(packet.bodyBase64,'base64'),html=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    receipts.push({requestedURL:url,...packet,body:html,bodySHA256:sha(bytes)})
    need(packet.url===url&&(packet.status===200||redirect&&packet.status===301),'native URL or public HTTP '+packet.status+' changed')
    if(packet.status===200){const mime=(packet.headers['content-type']||'').split(';')[0].trim().toLowerCase();need(kind==='css'?mime==='text/css':['text/html','application/xhtml+xml'].includes(mime),'native response type changed')}
    return{url,html,status:packet.status,headers:packet.headers}
  }
  const page=async(url,kind)=>{
    const result=await read(url),raw=readNativeDocument(normalizeNativeAttributeBoundaries(result.html)),all=retained(one(raw.nodes(n=>n.tag==='root'),'raw root')),model=profile.pages[kind]
    need(!all.some(({node:n})=>n.tag==='base'||n.tag==='meta'&&Object.hasOwn(n.attrs,'http-equiv')||Object.keys(n.attrs).some(key=>/^on[a-z]/i.test(key))),'unreviewed base, redirect or HTML activation')
    const programs=all.filter(({node})=>node.tag==='script').map(({node,ancestors})=>({attrs:node.attrs,sha256:sha(node.raw||''),parents:ancestors.map(n=>({tag:n.tag,attrs:n.attrs}))}))
    need(same(programs,model.scriptInventory),'current complete inline/application program declarations require review')
    need(same(all.filter(({node})=>node.tag==='meta'||Object.keys(node.attrs).some(key=>authority.test(key))).map(({node})=>({tag:node.tag,attrs:node.attrs})),model.authorityCarriers),'unreviewed native authority, criteria or country carrier')
    const inlineStyles=all.filter(({node})=>node.tag==='style'||Object.hasOwn(node.attrs,'style')).map(({node})=>({tag:node.tag,attrs:node.tag==='style'?node.attrs:{style:node.attrs.style},sha256:node.tag==='style'?sha(node.raw||''):null}))
    need(same(inlineStyles,model.inlineStyles),'native inline visibility inventory changed')
    const declared=raw.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>n.attrs)
    need(same(declared,model.stylesheets),'native stylesheet declarations changed')
    const urls=declared.map(attrs=>new URL(attrs.href,url).href)
    for(const url of urls){need(Object.hasOwn(profile.styles,url),'unreviewed stylesheet URL');allowed.add(url);if(!styles.has(url)){const sheet=await read(url,'css');need(sha(sheet.html)===profile.styles[url].sha256,'native stylesheet bytes changed');styles.set(url,sheet.html)}}
    return{...result,raw,model,visible:presentation(raw,urls.map(url=>styles.get(url)).join('\n'))}
  }
  const publication=async()=>{
    const root=await read(profile.configuredRoot,'html',true)
    need(root.status===301&&root.headers.location===HOME,'configured own root delegation changed');allowed.add(HOME)
    const home=await page(HOME,'home');header(home,'The Intelligent Storage Layer | The Energy Company',{legal:false})
    need(home.raw.nodes(n=>n.tag==='a'&&n.attrs.href==='/we-are-hiring'&&home.raw.text(n)==='Careers').length>=1,'current published own careers handoff changed')
    const configured=await read(profile.configuredCareers,'html',true)
    need(configured.status===301&&configured.headers.location===BOARD,'original configured careers delegation changed');allowed.add(BOARD)
    return roles(await page(BOARD,'board'))
  }
  try{
    const opening=await publication(),staged=[]
    for(const role of opening){allowed.add(role.applyURL);staged.push({role,application:application(await page(role.applyURL,'application'),role)})}
    const closing=await publication();need(same(opening,closing),'closing full native role membership/criteria/country/publisher changed')
    for(const item of staged){const result=application(await page(item.role.applyURL,'application'),item.role);need(same(result,item.application),'closing own current role application changed')}
    for(const url of styles.keys()){const sheet=await read(url,'css');need(sha(sheet.html)===profile.styles[url].sha256,'closing declared stylesheet changed')}
    signal.throwIfAborted()
    const jobs=staged.map(({role,application:app})=>({source:SOURCE,company:COMPANY,title:role.title,department:role.department,jobId:role.applyURL,requisitionId:null,
      sourceUrl:BOARD,link:role.applyURL,applyUrl:role.applyURL,sourceNativeIdentifier:null,sourceCanonicalRoleURL:null,country:'India',city:'Bengaluru',location:'Bengaluru, India',employmentType:'Full-time',remoteStatus:null,
      jobDescription:role.commonHiringContext+'\n\n'+role.fullRole,sourceDescription:role.commonHiringContext+'\n\n'+role.fullRole,sourceNativeCommonHiringContext:role.commonHiringContext,sourceNativeResponsibilities:role.responsibilities,sourceNativeQualifications:role.qualifications,sourceNativeRole:role.nativeAuthoredRole,
      sourceNativeCountryProof:role.countryProof,sourceNativeApplication:app,sourceNativeEmployerProof:{configuredRoot:profile.configuredRoot,ownPublishedCareers:BOARD,originalCompany:COMPANY,currentLegalPublisher:role.legalPublisher},
      postingDate:null,firstEverPostedAt:null,closingDate:null,sourcePostedDateRaw:'October 2026',sourcePostedMonth:'2026-10',postingDatePrecision:'month',sourcePostedDateIsExact:false,
      sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()}))
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,originalResponses:receipts,openingNativeRoles:opening,closingNativeRoles:closing,ownApplications:staged.map(item=>item.application),configuredCorporateAndRolesClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:count,verifiedAt:new Date().toISOString(),reason:'current own full native roles and scoped explicit work-country/application closing reconciled; configured publication positive; company inventory and zero unqualified'})
  }catch(error){
    if(options.signal?.aborted)throw options.signal.reason
    try{if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'sourceAudit',{value:{source:SOURCE,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true,writable:true})}catch{}
    throw error
  }finally{clearTimeout(timer)}
}
