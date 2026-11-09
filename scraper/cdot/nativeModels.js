import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
export const SOURCE='cdot',COMPANY='Centre for Development of Telematics (C-DOT)'
export const CURRENT_OPENINGS_URL='https://cdot.in/cdotweb/web/current_openings.php?lang=en'
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('C-DOT native: '+message),{code:'CDOT_NATIVE_CONTRACT',abortRetries:true})}
export const hash=value=>createHash('sha256').update(value).digest('hex')
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,predicate))]
const tree=node=>typeof node==='string'?clean(node)||null:['script','style','template'].includes(node.tag)?null:
 {tag:node.tag,attrs:structuredClone(node.attrs),children:node.children.map(tree).filter(n=>n!==null)}
const one=(rows,label)=>{need(rows.length===1,'one '+label+' required');return rows[0]}
const walk=v=>!v||typeof v!=='object'?[]:[v,...Object.values(v).flatMap(walk)]
export const isAdvertisementURL=url=>{
 try{const u=new URL(url);return u.origin==='https://cdot.in'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash
  &&/^\/cdotweb\/assets\/docs\/curr_openings\/adv\/[A-Za-z0-9_-]+\.pdf$/.test(u.pathname)}catch{return false}
}
const application=url=>{
 const u=new URL(url)
 need(u.origin==='https://cdotrecruitment.cdot.in'&&!u.username&&!u.password&&!u.port&&!u.hash
  &&u.pathname==='/cdotrecruitmentportal/college_home.jsp'&&[...u.searchParams].length===1&&/^\d+$/.test(u.searchParams.get('adv_id')||''),'unreviewed application advertisement identity')
 return {url:u.href,id:u.searchParams.get('adv_id')}
}
const localDate=label=>{
 const m=/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(label)
 need(m,'native application clock format changed')
 const [,day,month,year,hour,minute,second]=m,date=year+'-'+month+'-'+day
 const clock=new Date(date+'T'+hour+':'+minute+':'+second+'Z')
 need(Number.isFinite(clock.getTime())&&clock.toISOString().startsWith(date+'T'+hour+':'+minute+':'+second),'invalid native application calendar value')
 return {date,time:hour+':'+minute+':'+second}
}
export function readCdotListing(html){
 const d=readVisibleNativeDocument(html,{strict:true}),raw=readNativeDocument(html),head=activeHead(html)
 need(head.titles.length===1&&head.titles[0]==='Current Openings','current employer page identity changed')
 need(head.metas.filter(m=>m.name==='author'&&m.content==='Centre for Development of Telematics').length===1,'native employer publisher missing')
 need(!raw.nodes(n=>n.tag==='base').length,'active base unsupported')
 const schemas=raw.nodes(n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').map(n=>{
  try{return JSON.parse(n.raw)}catch{need(false,'invalid native JSON-LD')}
 })
 need(!walk(schemas).some(n=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).includes('JobPosting')),'new native JobPosting requires explicit field review')
 const table=one(d.nodes(n=>n.tag==='table'&&n.attrs.id==='openings'),'current native openings table')
 // The publisher hides its semantic column header in responsive CSS. Its
 // active HTML field declarations remain metadata, like native JSON-LD.
 const rawTable=one(raw.nodes(n=>n.tag==='table'&&n.attrs.id==='openings'),'declared native table')
 const header=one(raw.nodes(n=>n.tag==='tr'&&raw.nodes(c=>c.tag==='th',n).length===6,rawTable),'native table header')
 const columns=raw.nodes(n=>['td','th'].includes(n.tag),header).map(n=>raw.text(n))
 need(same(columns,['S_No','Post','Opening Date','Closing Date','Advertisement','Application Format']),'native table fields changed')
 const body=one(within(table,n=>n.tag==='tbody'),'native table body'),rows=within(body,n=>n.tag==='tr'&&n!==header).map(row=>{
  const cells=within(row,n=>['td','th'].includes(n.tag));need(cells.length===6,'unreviewed native role fields')
  const title=d.text(cells[1]),openingLabel=d.text(cells[2]),closingLabel=d.text(cells[3])
  need(title,'native role title missing')
  const opening=localDate(openingLabel),closing=localDate(closingLabel)
  need(opening.date+'T'+opening.time<=closing.date+'T'+closing.time,'application window reversed')
  const advert=one(within(cells[4],n=>n.tag==='a'&&n.attrs.href),'declared native PDF'),apply=one(within(cells[5],n=>n.tag==='a'&&n.attrs.href),'declared application advertisement')
  const sourceUrl=new URL(advert.attrs.href,CURRENT_OPENINGS_URL).href,own=application(new URL(apply.attrs.href,CURRENT_OPENINGS_URL).href)
  need(isAdvertisementURL(sourceUrl),'advertisement outside the declared official PDF surface')
  return {title,jobId:SOURCE+'-'+own.id,nativeApplicationAdvertisementID:own.id,sourceUrl,applyUrl:own.url,
   sourceApplicationOpeningLabel:openingLabel,sourceApplicationClosingLabel:closingLabel,applicationOpeningDate:opening.date,
   applicationOpeningTimeLocal:opening.time,closingDate:closing.date,applicationClosingTimeLocal:closing.time,
   applicationDateTimezone:null,attrs:structuredClone(row.attrs),cells:cells.map(n=>({attrs:structuredClone(n.attrs),text:d.text(n),tree:tree(n)})),tree:tree(row)}
 })
 need(rows.length>0,'native empty inventory cannot establish company absence')
 need(new Set(rows.map(r=>r.jobId)).size===rows.length&&new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'ambiguous duplicate advertisement/post identity')
 return {identity:{title:head.titles[0],publisher:'Centre for Development of Telematics',metas:head.metas},schemas,table:{attrs:table.attrs,columns,tree:tree(table)},rows}
}
export function makeListingObservation(row,page,clock){
 return {title:row.title,company:COMPANY,source:SOURCE,jobId:row.jobId,requisitionId:null,nativeApplicationAdvertisementID:row.nativeApplicationAdvertisementID,
  sourceUrl:row.sourceUrl,applyUrl:row.applyUrl,link:row.applyUrl,applicationUrlIsGeneric:true,nativeCanonicalRoleURL:null,
  country:null,city:null,state:null,location:null,nativeWorkplace:null,department:null,legalEmployer:null,
  sourceApplicationOpeningLabel:row.sourceApplicationOpeningLabel,sourceApplicationClosingLabel:row.sourceApplicationClosingLabel,
  applicationOpeningDate:row.applicationOpeningDate,applicationOpeningTimeLocal:row.applicationOpeningTimeLocal,closingDate:row.closingDate,
  applicationClosingTimeLocal:row.applicationClosingTimeLocal,applicationDateTimezone:null,postingDate:null,postedAt:null,sourceDatePrecision:null,firstEverPublication:null,
  employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],remoteStatus:null,
  jobDescription:null,sourceDescription:null,nativeHiringOrganization:{name:page.identity.publisher,url:'https://cdot.in/'},
  nativeSourceRecord:{listing:structuredClone(row),index:{identity:structuredClone(page.identity),schemas:structuredClone(page.schemas)}},
  sourceCountryScopeUnresolved:true,sourceDetailFailureKind:'native-country-unproven',sourceDetailComplete:false,sourceDetailStatus:'partial',
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:false,
  sourceNativeCriteriaContainerRetained:false,applicationVisited:false,activeApplyVerified:false,scrapedAt:clock}
}
