import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import fs from 'node:fs'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {check} from './nativeContract.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const profiles=JSON.parse(fs.readFileSync(new URL('./documentProfiles20261115.json',import.meta.url)))
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const mask='<style id="antiClickjack" type="text/css">body{display:none !important;}</style>'
const controllerSHA='4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433'
const fullTree=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(fullTree)]
const descendants=node=>node.children.filter(child=>typeof child!=='string').flatMap(child=>[child,...descendants(child)])
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const walk=(node,visit,parent)=>{
 if(!node||typeof node!=='object')return
 visit(node,parent)
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(item=>walk(item,visit,node));else if(value&&typeof value==='object')walk(value,visit,node)
}
// Only native anonymous CSRF, passive visit UUID and the same literal role ID
// vary. Every remaining byte, use context, script mode, sequence and attribute
// is part of the complete document program fingerprint. Nothing is executed.
export function currentScriptFrame(code,roleID){
 const ast=parse(code,{ecmaVersion:'latest',sourceType:'script'}),spans=[]
 walk(ast,node=>{
  let value,marker
  if(node.type==='VariableDeclarator'&&['CSRFToken','ctid'].includes(node.id?.name)){
   value=node.init;check(value?.type==='Literal'&&typeof value.value==='string'&&uuid.test(value.value),'Unreviewed anonymous native literal')
   marker='<NATIVE-'+node.id.name+'>'
  }else if(node.type==='Property'&&!node.computed&&(node.key.name??node.key.value)==='X-CSRF-Token'){
   value=node.value;check(value?.type==='Literal'&&typeof value.value==='string'&&uuid.test(value.value),'Unreviewed anonymous header literal');marker='<NATIVE-CSRFToken>'
  }else if(node.type==='Property'&&!node.computed&&(node.key.name??node.key.value)==='jobID'){
   value=node.value;check(roleID&&value?.type==='Literal'&&value.value===Number(roleID),'Native executable application role ID mismatch');marker='<NATIVE-ROLE-ID>'
  }else if(node.type==='Property'&&!node.computed&&(node.key.name??node.key.value)==='internalId'){
   value=node.value;check(roleID&&value?.type==='Literal'&&value.value===roleID+'-en_US','Native executable application internal ID mismatch');marker='<NATIVE-ROLE-INTERNAL-ID>'
  }
  if(marker)spans.push({start:value.start,end:value.end,marker})
 })
 for(const span of spans.sort((a,b)=>b.start-a.start))code=code.slice(0,span.start)+span.marker+code.slice(span.end)
 return sha(code)
}
export function documentProgramProfile(html,roleID){
 const document=readNativeDocument(html),root=document.nodes(node=>node.tag==='root')[0],nodes=fullTree(root)
 check(!nodes.some(node=>node.tag==='base'),'Unreviewed native document base')
 const scripts=nodes.filter(node=>node.tag==='script').map(node=>{
  const attrs={...node.attrs}
  if(attrs.src?.startsWith('/js/override.js?')){
   check(profiles.reviewedOverrideURLs.includes(attrs.src),'Unreviewed current override resource')
   attrs.src='<REVIEWED-OVERRIDE-RESOURCE>'
  }
  return{attrs,bodySHA256:currentScriptFrame(node.raw??'',roleID),inert:Boolean(node.inert)}
 })
 return sha(JSON.stringify(scripts))
}
export function verifyCurrentDocument(html,roleID){
 const profile=roleID?'role':'search'
 check(documentProgramProfile(html,roleID)===profiles[profile],'Unreviewed complete native '+profile+' document programs')
 const raw=readNativeDocument(html),root=raw.nodes(node=>node.tag==='root')[0],nodes=fullTree(root)
 const masks=nodes.filter(node=>node.attrs.id==='antiClickjack'),controllers=raw.nodes(node=>node.tag==='script'&&node.attrs.id==='antiClickJackScript')
 const heads=raw.nodes(node=>node.tag==='head')
 check(masks.length===1&&html.split(mask).length===2&&controllers.length===1
  &&heads.length===1&&heads[0].children.includes(masks[0])&&heads[0].children.includes(controllers[0])
  &&heads[0].children.indexOf(masks[0])<heads[0].children.indexOf(controllers[0])
  &&JSON.stringify(controllers[0].attrs)==='{"type":"text/javascript","id":"antiClickJackScript"}'
  &&sha(controllers[0].raw??'')===controllerSHA,'Unreviewed current top-window display controller')
 // This exact native controller removes this one anti-framing mask in a top
 // window. All independent author CSS, visibility, ancestors and inertness
 // remain intact; the source document and body hashes remain unmodified.
 return readVisibleNativeDocument(html.replace(mask,''),{strict:true})
}
export function verifyCurrentCorporate(html){
 const document=readVisibleNativeDocument(html,{strict:true}),root=document.nodes(node=>node.tag==='root')[0]
 check(!fullTree(root).some(node=>node.tag==='base'),'Unreviewed corporate base')
 const links=document.nodes(node=>node.tag==='a'&&node.attrs.href==='https://jobs.colgate.com/'&&/^Careers$/i.test(document.text(node)))
 check(links.length>0,'Current visible corporate recruiting handoff unavailable')
}
const closed=/\b(?:(?:this|the)\s+(?:job|position|role|vacancy)\s+(?:(?:(?:is|has\s+been)\s+)?(?:(?:currently|now|temporarily)\s+)?(?:closed|filled|expired|cancelled|canceled|unavailable)|is\s+(?:(?:currently|now|temporarily)\s+)?(?:not|no\s+longer)\s+(?:available|open|active))|applications(?:\s+for\s+(?:this|the)\s+(?:job|position|role|vacancy))?\s+(?:are|have\s+been)\s+(?:(?:currently|now|temporarily)\s+)?(?:closed|unavailable)|no\s+longer\s+accepting\s+applications)\b/i
const inactiveClosedNotice=new RegExp('^(?:'+closed.source+')[.!]?$', 'i')
const inertText=node=>typeof node==='string'?node:node.raw??node.children.map(inertText).join(' ')
const publicOwnerHTML=node=>typeof node==='string'?node:node.inert||['script','style'].includes(node.tag)?'':node.tag==='br'?'<br>':'<'+node.tag+'>'+node.children.map(publicOwnerHTML).join('')+'</'+node.tag+'>'
export function verifyCurrentRole(html,row){
 const visible=verifyCurrentDocument(html,row.id),raw=readNativeDocument(html)
 const owners=visible.nodes(node=>node.attrs.itemtype==='http://schema.org/JobPosting')
 check(owners.length===1,'Current visible own role owner unavailable')
 const nodes=[owners[0],...descendants(owners[0])]
 check(!nodes.some(node=>Object.keys(node.attrs).some(key=>/^on/i.test(key))),'Unreviewed executable role carrier')
 const authorityLabel=/^(?:country(?: of employment)?|work country|job country|employer|hiring organi[sz]ation|company)\s*[:\-–—]\s*\S/i
 check(!nodes.some(node=>authorityLabel.test(visible.text(node))||Object.entries(node.attrs).some(([key,value])=>/^(?:data-)?(?:country|work-country|job-country|employer|hiring-organization)$/.test(key)||['itemprop','property','name'].includes(key)&&/country|jobLocation|hiringOrganization|employer/i.test(value))),'Unreviewed own native country/employer declaration')
 const bodies=visible.nodes(node=>node.tag==='body')
 check(bodies.length===1&&descendants(bodies[0]).includes(owners[0]),'Current dedicated role page body unavailable')
 check(!closed.test(visible.text(bodies[0])),'Current visible native role is closed or unavailable')
 const descriptions=nodes.filter(node=>node.attrs.itemprop==='description'),allDescriptions=raw.nodes(node=>node.attrs.itemprop==='description')
 check(descriptions.length===3&&allDescriptions.length===3&&descriptions.every((node,index)=>norm(visible.text(node))===norm(raw.text(allDescriptions[index]))),'Current full criteria visibility differs')
 check(allDescriptions.every(node=>fullTree(node).every(child=>!child.inert||!norm(inertText(child)))),'Unreviewed inactive native criteria content')
 const completeOwner=fullTree(owners[0])
 check(!completeOwner.some(node=>node.nativeTagUnqualified||['img','video','audio','canvas','svg','iframe','object','embed','form','input','select','textarea'].includes(node.tag)),'Unreviewed full native criteria carrier')
 // Current genuine owners contain no inactive prose. Keep only exact inactive
 // closure-template notices harmless; hidden conditions cannot disappear from
 // an allegedly complete role. Style programs remain outside authored prose.
 check(completeOwner.every(node=>!node.inert||['style','script'].includes(node.tag)
  ||!norm(decodeNativeEntities(inertText(node)))||inactiveClosedNotice.test(norm(decodeNativeEntities(inertText(node))))),'Unreviewed inactive whole-owner native criteria content')
 const titles=nodes.filter(node=>node.attrs.itemprop==='title')
 check(titles.length===1&&visible.text(titles[0])===row.unifiedStandardTitle,'Current visible role title mismatch')
 const applies=visible.nodes(node=>node.tag==='a'&&/^Apply now$/i.test(visible.text(node)))
 check(applies.length>0&&applies.every(node=>node.attrs.href==='/talentcommunity/apply/'+row.id+'/?locale=en_US'
  &&!Object.hasOwn(node.attrs,'disabled')&&node.attrs['aria-disabled']!=='true'),'Current enabled own application control unavailable')
 return{fullCriteriaVisible:true,currentRoleOwnerVisible:true,activeClosedNoticeAbsent:true,topWindowMaskControllerReviewed:true,
  sourceDescription:publicOwnerHTML(owners[0]),jobDescription:visible.text(owners[0])}
}

export function parseCurrentJSON(text){
 const value=JSON.parse(text),ast=parse('('+text+')',{ecmaVersion:'latest'})
 walk(ast,node=>{if(node.type==='ObjectExpression'){const keys=node.properties.map(property=>property.key.name??property.key.value);check(new Set(keys).size===keys.length,'Duplicate decoded native JSON property')}})
 return value
}
const rowFields=['businessUnit_obj','currency','filter5','id','jobLocationShort','jobLocationShortWithCoordinates','supportedLocales','unifiedStandardStart','unifiedStandardTitle','unifiedUrlTitle','urlTitle']
export function verifyCurrentRows(page){
 if(Array.isArray(page.jobSearchResult))for(const entry of page.jobSearchResult){const row=entry?.response;check(row&&Object.keys(row).sort().join('|')===rowFields.join('|'),'Unreviewed native row country/criteria fields')}
}
