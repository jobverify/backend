import {createHash} from 'node:crypto'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const text=value=>String(value).normalize('NFC').replace(/\s+/g,' ').trim()

// The default for every authored visible carrier is authority, including new
// prose without familiar recruitment vocabulary. Only complete, positively
// reviewed marketing models may be projected out. A marketing carrier that
// gains a restriction no longer matches its complete model and stays bound.
export function projectAtosCorporateAuthority(proof,kind,contract){
 // This projection has already proved the exact original CSP nonce carriers;
 // use that bound placeholder rather than pinning a fresh request's nonce.
 const visible=readVisibleNativeDocument(proof.projectedHTML,{strict:true})
 const marketing=[]
 const tree=node=>{
  if(typeof node==='string')return text(node)||null
  if(node.inert)return null
  return{tag:node.tag,attrs:node.attrs,children:node.children.map(tree).filter(value=>value!==null)}
 }
 const bodies=visible.nodes(node=>node.tag==='body')
 if(bodies.length!==1)throw Error('Atos current native: missing or ambiguous corporate authority body')
 const project=node=>{
  if(typeof node==='string')return text(node)||null
  if(node.inert)return null
  if(kind==='corporate'&&node.attrs['data-df-id']==='atosai_blog:slider'&&node.attrs['data-paragraph-id']==='480'){
   const modelSHA256=sha(tree(node))
   if(contract.marketing.blogModelSHA256.includes(modelSHA256)){
    marketing.push({kind:'complete-reviewed-news-slider',modelSHA256})
    return{reviewedMarketing:'atosai_blog:slider/480'}
   }
  }
  return{tag:node.tag,attrs:node.attrs,children:node.children.map(project).filter(value=>value!==null)}
 }
 const head=visible.nodes(node=>node.tag==='head')
 if(head.length!==1)throw Error('Atos current native: missing or ambiguous corporate authority head')
 const declarations=proof.nodes.filter(node=>node.tag==='meta'||node.tag==='title').map(node=>{
  const declaration=node.tag==='title'?{tag:node.tag,attrs:node.attrs,text:node.raw}:tree(node)
  if(node.tag==='meta'&&['description','og:description','twitter:description'].includes(node.attrs.name??node.attrs.property)&&contract.marketing.descriptionTexts.includes(node.attrs.content)){
   marketing.push({kind:'complete-reviewed-marketing-description',modelSHA256:sha(declaration)})
   return{...declaration,attrs:{...declaration.attrs,content:'CURRENT_REVIEWED_CORPORATE_MARKETING_DESCRIPTION'}}
  }
  return declaration
 })
 const structured=(value,path=[])=>{
  if(Array.isArray(value))return value.map((item,index)=>structured(item,[...path,index]))
  if(!value||typeof value!=='object')return value
  return Object.fromEntries(Object.entries(value).map(([key,item])=>{
   if(key==='description'&&contract.marketing.descriptionTexts.includes(item)){
    marketing.push({kind:'complete-reviewed-structured-marketing-description',path:[...path,key],modelSHA256:sha(item)})
    return[key,'CURRENT_REVIEWED_CORPORATE_MARKETING_DESCRIPTION']
   }
   return[key,structured(item,[...path,key])]
  }))
 }
 const structuredModels=proof.nodes.filter(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>structured(JSON.parse(node.raw)))
 const model={kind,body:project(bodies[0]),headDeclarations:declarations,structuredModels}
 return{method:'complete-authored-visible-tree-and-head-authority-with-positive-reviewed-marketing-models',model,modelSHA256:sha(model),reviewedMarketing:marketing}
}

export const atosCorporateAuthoritySHA=sha
