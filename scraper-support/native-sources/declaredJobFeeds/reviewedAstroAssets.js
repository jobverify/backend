import {readNativeDocument} from '../../utils/activeNativeHtml.js'
import {hasClientDocumentBase} from '../../utils/reviewedClientProgram.js'

// Opt-in deployment pins only. Programs and their imports remain data; this
// selector admits no URL that was not explicitly reviewed in the profile.
const deployments=profile=>{
  const declaration=profile?.declaration
  if(declaration?.kind!=='active-declared-astro-component'
    ||!Array.isArray(declaration.reviewedAlternates)
    ||!declaration.reviewedAlternates.length||declaration.reviewedAlternates.length>3)return[]
  const entries=[declaration,...declaration.reviewedAlternates],seen=new Set()
  try{
    const primary=new URL(profile.primaryURL)
    for(const entry of entries){
      if(!entry||typeof entry.scriptURL!=='string'||typeof entry.scriptSpecifier!=='string'
        ||!entry.scriptSpecifier||!/^[a-f0-9]{64}$/i.test(entry.scriptSHA256??''))return[]
      const url=new URL(entry.scriptURL)
      if(url.protocol!=='https:'||url.username||url.password||url.hash||url.href!==entry.scriptURL
        ||url.origin!==primary.origin||new URL(entry.scriptSpecifier,primary).href!==url.href
        ||seen.has(url.href))return[]
      seen.add(url.href)
    }
  }catch{return[]}
  return entries
}

export const reviewedAstroAssetURLs=profile=>deployments(profile).map(entry=>entry.scriptURL)

export const selectReviewedAstroAsset=(html,profile)=>{
  if(hasClientDocumentBase(html))return null
  const entries=deployments(profile)
  if(!entries.length)return null
  const bySpecifier=new Map(entries.map(entry=>[entry.scriptSpecifier,entry]))
  const document=readNativeDocument(html,{excludeObjectFallback:true})
  const selected=[],root=document.nodes(node=>node.tag==='root')[0]
  const visit=(node,inherited='html')=>{
    if(!node||node.inert)return
    const namespace=node.tag==='svg'?'svg':node.tag==='math'?'math':inherited
    if(namespace==='html'&&node.tag==='astro-island'){
      const entry=bySpecifier.get(node.attrs['component-url'])
      if(entry)selected.push(entry)
    }
    const htmlIntegration=namespace==='svg'&&['foreignobject','desc','title'].includes(node.tag)
      ||namespace==='math'&&node.tag==='annotation-xml'
        &&['text/html','application/xhtml+xml'].includes((node.attrs.encoding??'').toLowerCase())
    for(const child of node.children??[]){
      if(typeof child!=='object')continue
      const textIntegration=namespace==='math'&&['mi','mo','mn','ms','mtext'].includes(node.tag)
        &&!['mglyph','malignmark'].includes(child.tag)
      visit(child,htmlIntegration||textIntegration?'html':namespace)
    }
  }
  visit(root)
  return selected.length===1?{...selected[0],kind:profile.declaration.kind}:null
}
