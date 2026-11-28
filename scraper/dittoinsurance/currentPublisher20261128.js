import {createHash} from 'node:crypto'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentDeclaredNativeRead} from '../../scraper-support/utils/currentDeclaredNativeRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME='https://joinditto.in/',CAREERS='https://careers.joinditto.in/',ORG=HOME+'#organization'
const CLIENT=CAREERS+'static/careers/careers.js',CSS=CAREERS+'static/careers/careers.css'
const CLIENT_HASH='2f2d1887486c50b8b337481dd57a9c3a937fe6c941c599000d3cecefe0f1192b',CSS_HASH='7a7672db645c72982dbe051e4572523b7ee9d19d5a80eb1128bc6624b5b11352'
const hash=value=>createHash('sha256').update(value).digest('hex'),norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const need=(ok,why)=>{if(!ok)throw Error('Ditto Insurance current publisher: '+why)}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const one=(rows,label)=>{need(rows.length===1,'expected one '+label);return rows[0]}
const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&equal(Object.keys(value).sort(),[...expected].sort())
const rawNodes=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(rawNodes)]
const schema=doc=>JSON.parse(one(doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json'&&!node.attrs.src),'active native schema').raw)
const corporateLinks=doc=>doc.nodes(node=>node.tag==='a'&&node.attrs.href&&!node.attrs.href.startsWith('mailto:')&&/\bcareers?\b/i.test(doc.text(node)))
export const hasCurrentDittoHandoff=html=>corporateLinks(readNativeDocument(html)).some(node=>node.attrs.href===CAREERS)

function corporate(html){
 const doc=readNativeDocument(html)
 need(one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'corporate canonical').attrs.href===HOME,'corporate identity changed')
 const links=corporateLinks(doc)
 need(links.some(node=>node.attrs.href===CAREERS)&&links.every(node=>node.attrs.href===CAREERS),'current corporate careers handoff unavailable or ambiguous')
 const models=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json'&&!node.attrs.src).map(node=>JSON.parse(node.raw))
 const org=one(models.flatMap(model=>Array.isArray(model['@graph'])?model['@graph']:[model]).filter(model=>model['@id']===ORG),'corporate employer model')
 need(equal(org['@type'],['Organization','InsuranceAgency'])&&org.name==='Ditto Insurance'&&org.url===HOME
  &&['Ditto Insurance Advisory Private Limited','Ditto Insurance Advisory Private Limited (formerly Tacterial Consulting Private Limited)'].includes(org.legalName)
  &&org.identifier?.['@type']==='PropertyValue'&&org.identifier.name==='IRDAI Corporate Agent License'&&org.identifier.value==='CA0738','corporate legal employer identity changed')
 return org
}

function declarations(doc){
 need(!doc.nodes(node=>node.tag==='base'||node.tag==='meta'&&(node.attrs['http-equiv']||'').toLowerCase()==='refresh').length,'native page navigation authority changed')
 const tree=rawNodes(one(doc.nodes(node=>node.tag==='root'),'document root'))
 need(!tree.some(node=>node.tag==='iframe'),'native page frame authority changed')
 need(!tree.some(node=>Object.keys(node.attrs).some(key=>/^on/i.test(key))),'unreviewed active executable handler')
 const scripts=doc.nodes(node=>node.tag==='script'&&node.attrs.type!=='application/ld+json')
 need(scripts.length===1&&scripts[0].attrs.src==='/static/careers/careers.js'&&keys(scripts[0].attrs,['src','defer'])&&!scripts[0].raw,'unreviewed active executable declaration')
 const styles=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='stylesheet')
 need(styles.length===1&&styles[0].attrs.href==='/static/careers/careers.css'&&keys(styles[0].attrs,['rel','href']),'unreviewed stylesheet declaration')
 const inline=tree.filter(node=>node.tag==='style')
 need(inline.length===1&&norm(inline[0].raw)===':root { --brand: #1667B1; }','unreviewed inline stylesheet')
 need(doc.nodes(node=>node.tag==='a'&&node.attrs.href===HOME&&doc.text(node)==='About Ditto').length===1,'reciprocal corporate employer link unavailable')
}

function listing(html,corporateOrg){
 const doc=readNativeDocument(html,{sourceRanges:true});declarations(doc)
 const org=schema(doc)
 need(org['@context']==='https://schema.org'&&equal(org['@type'],['Organization','InsuranceAgency'])&&org['@id']===ORG&&org.name==='Ditto Insurance'
  &&org.legalName==='Ditto Insurance Advisory Private Limited'&&org.url===HOME&&equal(org.identifier,corporateOrg.identifier)
  &&equal(org.address,corporateOrg.address)&&equal(org.sameAs,corporateOrg.sameAs),'native listing legal employer identity changed')
 one(doc.nodes(node=>node.tag==='h1'&&doc.text(node)==='Careers at Ditto Insurance'),'careers heading')
 const section=one(doc.nodes(node=>node.tag==='section'&&node.attrs.id==='open-roles'),'native inventory owner')
 const count=norm(doc.text(one(doc.nodes(node=>hasClass(node,'count'),section),'native inventory count')))
 need(/^(?:0|[1-9]\d{0,2})$/.test(count),'invalid declared inventory count')
 const form=one(doc.nodes(node=>node.tag==='form',section),'native all-roles filter')
 need(form.attrs.method==='get'&&form.attrs.action===CAREERS+'#open-roles','native filter identity changed')
 const selects=doc.nodes(node=>node.tag==='select',form)
 need(equal(selects.map(node=>node.attrs.name),['department','location','work_mode'])&&selects.every(node=>{
  const opts=doc.nodes(child=>child.tag==='option',node)
  return opts.length>0&&opts[0].attrs.value===''&&opts.filter(child=>Object.hasOwn(child.attrs,'selected')).every(child=>child.attrs.value==='')
 }),'native global filter scope unavailable')
 need(!doc.nodes(node=>node.tag==='a'&&(/\bnext\b/i.test(node.attrs.rel||'')||/[?&]page=/.test(node.attrs.href||''))).length,'native inventory continuation unqualified')
 const nodes=doc.nodes(node=>node.tag==='a'&&hasClass(node,'job-row')),ids=new Set()
 need(nodes.length===Number(count)&&nodes.length<=100,'declared native inventory count differs from all role rows')
 const rows=nodes.map(node=>{
  const url=node.attrs.href
  need(/^https:\/\/careers\.joinditto\.in\/jobs\/[a-z0-9]+(?:-[a-z0-9]+)+$/.test(url),'foreign or unsupported native role URL')
  const id=url.split('/').at(-1),title=doc.text(one(doc.nodes(child=>child.tag==='h3',node),'native row title'))
  const meta=doc.nodes(child=>child.tag==='span',one(doc.nodes(child=>hasClass(child,'meta'),node),'native row metadata')).map(child=>doc.text(child))
  need(!ids.has(id)&&title&&meta.length>=2&&meta.length<=3&&meta.every(Boolean),'duplicate or malformed native role inventory')
  ids.add(id);return{id,url,title,meta,originalHtml:html.slice(node.sourceStart,node.sourceEnd)}
 })
 return{rows,declaredCount:Number(count),employer:org,originalText:html}
}

function passiveCriteria(html){
 const doc=readNativeDocument(html),root=one(doc.nodes(node=>node.tag==='root'),'criteria root')
 const allowed=new Set(['root','h1','h2','h3','h4','h5','h6','p','br','div','span','strong','em','b','i','u','s','ul','ol','li','a','blockquote','hr','table','tbody','thead','tr','th','td'])
 return rawNodes(root).every(node=>!node.inert&&allowed.has(node.tag)&&!Object.keys(node.attrs).some(key=>/^on/i.test(key))
  &&!(node.attrs.style||'').split(';').some(value=>value.trim()&&!/^(?:text-align\s*:\s*left|white-space\s*:\s*pre-wrap)\s*$/i.test(value.trim())))
}

function role(html,row,employer){
 const doc=readNativeDocument(html,{sourceRanges:true});declarations(doc)
 need(one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'native role canonical').attrs.href===row.url,'native role canonical identity changed')
 const model=schema(doc),remote=row.meta[1]==='Remote'
 const shape=['@context','@type','title','url','identifier','hiringOrganization','directApply','description','datePosted',
  ...(Object.hasOwn(model,'employmentType')?['employmentType']:[]),...(remote?['jobLocationType','applicantLocationRequirements']:['jobLocation'])]
 need(keys(model,shape)&&model['@context']==='https://schema.org'&&model['@type']==='JobPosting'&&model.url===row.url&&norm(model.title)===row.title
  &&keys(model.identifier,['@type','name','value'])&&model.identifier['@type']==='PropertyValue'&&model.identifier.name==='Ditto Insurance'&&model.identifier.value===row.id
  &&keys(model.hiringOrganization,['@type','@id','name','url','sameAs','logo'])&&model.hiringOrganization['@type']==='Organization'&&model.hiringOrganization['@id']===ORG
  &&model.hiringOrganization.name==='Ditto Insurance'&&model.hiringOrganization.url===HOME&&equal(model.hiringOrganization.sameAs,employer.sameAs)
  &&model.hiringOrganization.logo===employer.logo?.url&&model.directApply===true
  &&(!Object.hasOwn(model,'employmentType')||model.employmentType==='FULL_TIME'),'native role employer/posting identity or model shape changed')
 need(typeof model.datePosted==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(model.datePosted)
  &&Number.isFinite(Date.parse(model.datePosted+'T00:00:00Z'))&&new Date(model.datePosted+'T00:00:00Z').toISOString().slice(0,10)===model.datePosted,'invalid native publication calendar date')
 if(remote)need(row.meta.length===2&&model.jobLocationType==='TELECOMMUTE'&&keys(model.applicantLocationRequirements,['@type','name'])
  &&model.applicantLocationRequirements['@type']==='Country'&&model.applicantLocationRequirements.name==='India','native remote vacancy India country unavailable')
 else need(equal(row.meta.slice(1),['Bengaluru','On-site'])&&Array.isArray(model.jobLocation)&&model.jobLocation.length===1
  &&keys(model.jobLocation[0],['@type','address'])&&model.jobLocation[0]['@type']==='Place'
  &&keys(model.jobLocation[0].address,['@type','streetAddress','addressLocality','addressRegion','postalCode','addressCountry'])
  &&model.jobLocation[0].address['@type']==='PostalAddress'&&model.jobLocation[0].address.addressLocality===row.meta[1]
  &&equal(model.jobLocation[0].address,employer.address)&&model.jobLocation[0].address.addressCountry==='IN','native onsite vacancy India country unavailable or contradictory')
 const article=one(doc.nodes(node=>node.tag==='article'&&hasClass(node,'role-story')),'native complete role owner')
 need(doc.text(one(doc.nodes(node=>node.tag==='h1',article),'native role heading'))===row.title
  &&doc.text(one(article.children.filter(node=>typeof node!=='string'&&node.tag==='p'&&hasClass(node,'eyebrow')),'native role department'))===row.meta[0]
  &&equal(doc.nodes(node=>node.tag==='span',one(doc.nodes(node=>hasClass(node,'meta'),article),'native role metadata')).map(node=>doc.text(node)),row.meta.slice(1)),
 'native listing/detail title or workplace conflict')
 const owner=one(doc.nodes(node=>hasClass(node,'job-description'),article),'native full criteria owner'),description=html.slice(owner.sourceOpenEnd,owner.sourceCloseStart)
 need(typeof model.description==='string'&&description===model.description&&passiveCriteria(description)&&extractActiveDescription(description)?.length>=250,'native complete original criteria/model parity unavailable')
 const applyUrl=row.url+'/apply',targets=doc.nodes(node=>node.tag==='a'&&/^(?:Apply for this role|Apply now)$/.test(doc.text(node)))
 need(targets.length===2&&targets.every(node=>node.attrs.href===applyUrl),'native role application target identity changed')
 return{model,signature:{model,meta:row.meta,description,applyUrl},job:{source:'dittoinsurance',company:'Ditto Insurance',jobId:row.id,requisitionId:row.id,title:row.title,
  department:row.meta[0],location:remote?'Remote':'Bengaluru',city:remote?null:'Bengaluru',state:remote?null:'Karnataka',country:'India',remoteStatus:remote?'Remote':'On-site',
  sourceUrl:row.url,detailUrl:row.url,applyUrl,link:applyUrl,companyDomain:'joinditto.in',companyCareerPage:CAREERS,atsPlatform:'employer-native',
  jobDescription:description,sourceDescription:description,postingDate:model.datePosted,closingDate:null,employmentType:model.employmentType||null,
  sourceNativeRecord:model,sourceDetailComplete:false,nativeCriteriaTextComplete:true,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,
  sourceDetailFailureKind:'current-first-party-criteria-data-rendering-and-application-unqualified',sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  sourceCompanyScope:'Current corporate-linked own careers publisher; company-wide scope and rendered/application behavior unqualified'}}
}

export async function runCurrentDittoPublisher(options={}){
 const corporateOpening=corporate(options.homeOpening),allowedRoles=new Set()
 // An injected page reader is a transport seam only; the same URL/status,
 // finite bytes, deadline and exact caller cancellation rules still apply.
 const fetchImpl=options.fetchPage?async(url,init)=>{
  const page=await options.fetchPage(url,{signal:init.signal});need(typeof page?.html==='string','invalid injected native entity')
  const response=new Response(page.html,{status:page.status,headers:page.headers});Object.defineProperty(response,'url',{value:page.url});return response
 }:undefined
 const io=createCurrentDeclaredNativeRead('dittoinsurance',url=>[HOME,CAREERS,CLIENT,CSS].includes(url)||allowedRoles.has(url),
  {signal:options.signal,sourceTimeoutMs:120000,...(fetchImpl?{fetchImpl,requestIntervalMs:0}:{})})
 const read=async url=>(await io.read(url)).originalText
 const opening=listing(await read(CAREERS),corporateOpening);for(const row of opening.rows)allowedRoles.add(row.url)
 const assets=async()=>{need(hash(await read(CLIENT))===CLIENT_HASH,'unreviewed current executable client');need(hash(await read(CSS))===CSS_HASH,'unreviewed current stylesheet')}
 await assets()
 const roleObservations=[],failures=[],accepted=new Map()
 const inspect=async(rows,phase)=>{
  for(const row of rows){
   const originalText=await read(row.url),observation={id:row.id,url:row.url,phase,originalText};roleObservations.push(observation)
   try{observation.model=schema(readNativeDocument(originalText));const result=role(originalText,row,opening.employer);observation.qualifiedCriteriaData=true
    if(phase==='opening')accepted.set(row.id,result)
    else if(!equal(accepted.get(row.id)?.signature,result.signature))failures.push({id:row.id,phase,reason:'full native criteria or posting changed at closing'})
   }catch(error){io.signal.throwIfAborted();failures.push({id:row.id,phase,reason:error.message})}
  }
 }
 await inspect(opening.rows,'opening')
 const corporateClosing=corporate(await read(HOME)),closingBeforeDetails=listing(await read(CAREERS),corporateClosing)
 need(equal(opening.rows,closingBeforeDetails.rows)&&equal(opening.employer,closingBeforeDetails.employer),'closing native inventory/employer changed')
 await assets();await inspect(closingBeforeDetails.rows,'closing')
 const closing=listing(await read(CAREERS),corporateClosing)
 need(equal(opening.rows,closing.rows)&&equal(opening.employer,closing.employer),'closing native inventory/employer changed after all details')
 const held=new Set(failures.map(row=>row.id));let jobs=[...accepted].filter(([id])=>!held.has(id)).map(([,value])=>value.job)
 const limited=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0&&options.maxJobs<jobs.length
 if(limited)jobs=jobs.slice(0,options.maxJobs)
 for(const job of jobs)job.scrapedAt=(options.now||(()=>new Date().toISOString()))()
 attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.pages.length+1,
  reportedTotal:opening.declaredCount,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'Current employer handoff and native full original criteria reconciled; rendered criteria, applications and company-wide recruitment scope unqualified'+(limited?'; source job limit':'')})
 attachSourceObservationEvidence(jobs,{source:'dittoinsurance',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false})
 const audit={source:'dittoinsurance',homeOpening:{url:HOME,originalText:options.homeOpening,sha256:hash(options.homeOpening)},corporateOpening,corporateClosing,opening,closingBeforeDetails,closing,
  roleObservations,failures,limited,responses:io.pages,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false}
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});Object.defineProperty(jobs,'sourceAudit',{value:audit})
 io.signal.throwIfAborted();return jobs
}
