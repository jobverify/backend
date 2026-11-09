import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'

const CAREERS='https://www.hiddenbrains.com/careers.html'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Hidden Brains native role: '+message),{abortRetries:true})}
const all=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(all)]
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,predicate))]
const prefix=(node,value)=>(node.attrs.class||'').split(/\s+/).some(name=>name.startsWith('JobPostView_'+value+'__'))
const one=(items,label)=>{check(items.length===1,'missing/ambiguous '+label);return items[0]}
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
export const readHiddenBrainsCards=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),cards=new Map(),occurrences=doc.nodes(n=>prefix(n,'inner-box'))
 let desktopCardOccurrences=0,mobileCardOccurrences=0
 for(const block of occurrences){
  const titleNode=one(within(block,n=>prefix(n,'inner-title')),'visible role title')
  const subtitles=within(titleNode,n=>prefix(n,'sub-title'))
  check(subtitles.every(n=>['','-'].includes(doc.text(n))),'unreviewed native role subtitle')
  const title=doc.text({...titleNode,children:titleNode.children.filter(n=>typeof n==='string'||!prefix(n,'sub-title'))})
  const openings=doc.text(one(within(block,n=>prefix(n,'openings-text')),'visible headcount')).match(/^(\d+) Openings?$/i)
  const lists=within(block,n=>n.tag==='ul'),items=lists.length===1?within(lists[0],n=>n.tag==='li'):[]
  const apply=one(within(block,n=>n.tag==='a'&&(prefix(n,'apply-now-btn')||prefix(n,'apply-now-btn-mobile'))),'visible Apply control')
  if(prefix(apply,'apply-now-btn-mobile'))mobileCardOccurrences++;else desktopCardOccurrences++
  check(title&&openings&&Number(openings[1])>0&&items.length===2&&apply.attrs.href==='#InquiryJob'
   &&apply.attrs['aria-disabled']!=='true'&&/^APPLY NOW!$/i.test(doc.text(apply)),'changed native card identity or application')
  const details=within(block,n=>n.tag==='a'&&prefix(n,'view-details-link'))
  check(details.length<=1&&!details.some(n=>n.attrs.href!=='#'),'unreviewed native detail route')
  const card={title,openingsCount:Number(openings[1]),experienceRequired:doc.text(items[0]).replace(/\s*Experience$/i,''),
   employmentType:doc.text(items[1]),applyUrl:CAREERS+'#InquiryJob'}
  if(cards.has(title))check(stable(cards.get(title))===stable(card),'conflicting duplicate display cards')
  cards.set(title,card)
 }
 return{cards:[...cards.values()],displayCardOccurrences:occurrences.length,desktopCardOccurrences,mobileCardOccurrences}
}
export const readHiddenBrainsDeclaredRoles=(html,cards)=>{
 const raw=readNativeDocument(html),roots=raw.nodes(n=>n.tag==='root'),declared=roots.flatMap(all).filter(n=>n.tag==='script'&&(n.raw||'').includes('self.__next_f.push('))
 const active=readVisibleNativeDocument(html,{strict:true}).nodes(n=>n.tag==='script'&&(n.raw||'').includes('self.__next_f.push('))
 check(declared.length===active.length,'hidden native data carrier')
 if(!declared.length)return{roles:new Map(),nativeAllPositionsCount:null,nativeModelPresent:false}
 const records=readLiteralFlightRecords(active.map(n=>'<script>'+n.raw+'</script>').join('\n')),scopes=[]
 const walk=value=>{
  if(!value||typeof value!=='object')return
  if(Array.isArray(value)&&value[0]==='$'&&typeof value[1]==='string'&&/^\$L[0-9a-f]+$/i.test(value[1])&&Array.isArray(value[3]?.categories))scopes.push(value[3])
  for(const child of Object.values(value))walk(child)
 }
 for(const record of records.values())if(record.kind==='model')walk(record.value)
 const scope=one(scopes,'declared category component'),categories=scope.categories
 check(categories.every(c=>c&&Object.keys(c).sort().join(',')==='categoryName,count,jobs'&&typeof c.categoryName==='string'
  &&Number.isSafeInteger(c.count)&&Array.isArray(c.jobs)&&c.count===c.jobs.length)
  &&new Set(categories.map(c=>c.categoryName)).size===categories.length,'native category count or schema conflict')
 const main=one(categories.filter(c=>c.categoryName==='ALL POSITIONS'),'native ALL POSITIONS category')
 const resolve=(value,seen=new Set())=>{
  if(typeof value!=='string'||!/^\$[0-9a-f]+$/i.test(value))return value
  const id=value.slice(1),record=records.get(id)
  check(record&&!seen.has(id),'missing/cyclic native role reference')
  return record.kind==='text'?record.value:resolve(record.value,new Set([...seen,id]))
 }
 const normalize=value=>{
  const role=resolve(value)
  check(role&&Object.keys(role).sort().join(',')==='href,job_description,job_experience,job_title,job_type,no_of_openings','unreviewed native role fields')
  check(typeof role.job_title==='string'&&typeof role.job_experience==='string'&&typeof role.job_type==='string'
   &&/^[1-9]\d*$/.test(role.no_of_openings)&&role.href==='#','native role scalar identity changed')
  const body=resolve(role.job_description)
  check(typeof body==='string','native description reference is not text')
  const doc=readVisibleNativeDocument(body,{strict:true}),description=doc.text(one(doc.nodes(n=>n.tag==='root'),'description root'))
  check(description.length>=100&&extractActiveDescription(body),'missing/inert native description')
  const original=readNativeDocument(body),unhidden=node=>({...node,inert:false,children:node.children.map(child=>typeof child==='string'?child:unhidden(child))})
  check(original.text(unhidden(one(original.nodes(n=>n.tag==='root'),'original description root')))===description,'hidden or incomplete native description criteria')
  return{...role,nativeDescriptionHTML:body,job_description:description}
 }
 const roles=new Map()
 for(const item of main.jobs){const role=normalize(item);check(!roles.has(role.job_title),'duplicate native role identity');roles.set(role.job_title,role)}
 for(const category of categories)for(const item of category.jobs){const role=normalize(item);check(roles.has(role.job_title)
  &&stable(roles.get(role.job_title))===stable(role),'conflicting native role across categories')}
 check(cards.length===roles.size,'visible and declared native role inventory differ')
 for(const card of cards){
  const role=roles.get(card.title),experience=role?.job_experience.match(/^exp_(\d+)(?:_(\d+))?_years?$/)
  const nativeExperience=experience?[experience[1],experience[2]].filter(v=>v!=null).join('-'):null
  check(role&&experience&&card.experienceRequired.toLowerCase().replace(/years?/g,'').replace(/[^\d-]/g,'')===nativeExperience
   &&card.employmentType.replace(/[ _-]/g,'').toLowerCase()===role.job_type.replace(/[ _-]/g,'').toLowerCase()
   &&card.openingsCount===Number(role.no_of_openings),'visible and declared native role identity differ')
 }
 return{roles,nativeAllPositionsCount:main.count,nativeModelPresent:true}
}
