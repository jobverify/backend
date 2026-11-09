import {readNativeDocument, readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {decodeHTML} from 'entities/decode'

const fields = ['description', 'responsibilities', 'qualifications']
const labels = ['Description', 'Responsibilities', 'Qualifications']
// Exact decorative styles witnessed across all three retained native models.
// Every other attribute/style is unreviewed; none can hide or change criteria.
const styles = new Set([
 'margin-bottom: 0cm; margin-top: 0px;',
 'margin: 0cm 0cm 0cm 0.4px; font-size: 12pt; font-family: Aptos, sans-serif; text-indent: 0.4px;',
 'font-size: 12pt;', 'margin: 0px;',
 'margin: 0cm 0cm 8pt; line-height: 107%; font-size: 11pt; font-family: Aptos, sans-serif;',
 "font-family: 'Open Sans', sans-serif;",
 'margin-top: 0cm; margin-bottom: 0cm;',
 'line-height: 115%; margin-top: 0cm; margin-right: 0cm; margin-bottom: 8pt; font-size: 11pt; font-family: Aptos, sans-serif;',
])
const tags = new Set(['root', 'p', 'br', 'strong', 'ul', 'li', 'span'])
const gap = (message, evidence, cause) => Object.assign(new Error('Elektrobit native quality: '+message, {cause}), {
 code:'ELEKTROBIT_NATIVE_QUALITY_GAP', source:'elektrobitautomotive', softFailure:true,
 failureKind:'coverage_gap', abortRetries:true, sourceScopeComplete:false,
 sourceListingComplete:false, lifecycleCleanupAllowed:false, nativeQualityEvidence:evidence,
})
const need = (ok,message,evidence) => {if(!ok)throw gap(message,evidence)}
const own = (record,field) => {
 const descriptor=Object.getOwnPropertyDescriptor(record,field)
 if(!descriptor){need(!(field in record),'Inherited native '+field,{field,present:false,inherited:true});return{field,present:false}}
 need(Object.hasOwn(descriptor,'value'),'Accessor native '+field,{field,present:true,accessor:true})
 return{field,present:true,rawValue:descriptor.value}
}
const plain = record => need(record!==null&&typeof record==='object'
 &&[Object.prototype,null].includes(Object.getPrototypeOf(record)),'Unreviewed native record owner',{ownerType:typeof record})
// Failure snapshots keep every own native criteria carrier without invoking
// accessors or claiming active content was verified on the rejected model.
const rawCriteria = record => fields.map(field=>{
 if(record===null||typeof record!=='object')return{field,present:false}
 const d=Object.getOwnPropertyDescriptor(record,field)
 return !d?{field,present:false}:Object.hasOwn(d,'value')?{field,present:true,rawValue:d.value}:{field,present:true,accessor:true}
})
const withRawCriteria = (record, action) => {
 try{return action()}catch(error){
  if(error?.code==='ELEKTROBIT_NATIVE_QUALITY_GAP')error.sourceNativeCriteriaEvidence={projection:null,activeTextVerified:false,fields:rawCriteria(record)}
  throw error
 }
}
const country = record => {
 plain(record)
 const name=own(record,'country'),code=own(record,'country_code'),evidence={country:name,country_code:code}
 const message='Elektrobit India jobs API no longer honors the verified India country filter'
 need(name.present&&typeof name.rawValue==='string'&&name.rawValue.trim().toLowerCase()==='india',message,evidence)
 need(!code.present||(typeof code.rawValue==='string'&&(code.rawValue===''||code.rawValue==='IN')),message,evidence)
 return{country:'India',name,code}
}
export const hasNativeIndiaCountry = record => withRawCriteria(record,()=>{country(record);return true})

// Decode raw text leaves once. Decoding document.text() again would promote
// an authored literal &amp;bull; into a bullet and recurse across ancestors.
const nativeTextLeaf = value => {
 for(const match of value.matchAll(/&#(?:x([\da-f]+)|(\d+));/gi)){
  const point=match[1]===undefined?Number(match[2]):parseInt(match[1],16)
  if(!Number.isSafeInteger(point)||point>0x10ffff||(point>=0xd800&&point<=0xdfff))throw new RangeError('Invalid native criteria character reference')
 }
 // The installed pure HTML5 decoder leaves unknown references literal and
 // never reparses its emitted output as another reference or markup.
 return decodeHTML(value)
}
const nativeText = node => node.children.map(child=>typeof child==='string'?nativeTextLeaf(child):nativeText(child)).join(' ')
const activeText = field => {
 if(!field.present||field.rawValue===null||field.rawValue==='')return null
 need(typeof field.rawValue==='string','Nonstring native criteria',field)
 const raw=field.rawValue
 need(!raw.includes('<!--')&&!/<[!?]/.test(raw),'Unreviewed native criteria declaration/comment',field)
 try{
  const document=readNativeDocument(raw),root=document.nodes(n=>n.tag==='root')[0]
  need(!!root,'Missing native criteria root',field)
  const walk=node=>{
   need(!node.inert&&!node.nativeTagUnqualified&&tags.has(node.tag),'Hidden, inert or unreviewed native criteria carrier',field)
   for(const[key,value]of Object.entries(node.attrs)){
    need((key==='style'&&styles.has(value))||(node.tag==='ul'&&key==='type'&&value==='disc'),'Unreviewed native criteria attribute',field)
   }
   for(const child of node.children)if(typeof child!=='string')walk(child)
  }
  walk(root)
  // The shared tree deliberately uses first-attribute HTML semantics. Audit
  // original token lists too, so a conflicting duplicate cannot disappear.
  for(const match of raw.matchAll(/<([a-z][a-z0-9:_-]*)(?=[\t\n\f\r />])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)){
   const seen=new Set()
   for(const[key]of readNativeAttributeTokens(match[2])){
    need(!seen.has(key),'Duplicate native criteria attribute',field);seen.add(key)
   }
  }
  const text=nativeText(root).replace(/\s+/g,' ').trim()
  need(!!text&&/[\p{L}\p{N}]/u.test(text),'Native criteria has no active authored text',field)
  return text
 }catch(error){
  if(error?.code==='ELEKTROBIT_NATIVE_QUALITY_GAP')throw error
  throw gap('Malformed native criteria',field,error)
 }
}

const projectQuality = record => {
 const geo=country(record),city=own(record,'city')
 need(!city.present||typeof city.rawValue==='string','Nonstring native city',city)
 const nativeFields=fields.map(field=>own(record,field))
 const evidenceFields=nativeFields.map(field=>Object.freeze({...field,text:activeText(field)}))
 const text=evidenceFields.map((field,i)=>field.text?labels[i]+':\n'+field.text:null).filter(Boolean).join('\n\n')
 need(!!text,'No active native criteria',{fields:nativeFields})
 return{
  country:geo.country,city:city.present?(city.rawValue.trim()||null):null,
  minimumQualification:null,preferredQualification:null,requiredSkills:[],jobDescription:text,sourceDescription:text,
  sourceNativeCriteriaEvidence:Object.freeze({projection:'all-own-native-fields-in-declared-order-no-deduplication',fields:Object.freeze(evidenceFields)}),
  sourceNativeGeographyEvidence:Object.freeze({authority:'own-explicit-country-name',country:geo.name,country_code:geo.code,city}),
 }
}

export const projectElektrobitNativeQuality = record => withRawCriteria(record,()=>projectQuality(record))
