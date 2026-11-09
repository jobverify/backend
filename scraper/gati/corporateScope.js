import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const hash=value=>createHash('sha256').update(value).digest('hex')
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const equal=(a,b)=>canonical(a)===canonical(b)
const requireScope=(ok)=>{if(!ok)throw new Error('Unreviewed Gati corporate serialization')}
const styles=html=>html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g)||[]
const preloads=html=>html.match(/<link\b(?=[^>]*\bas="image")[^>]*>/g)||[]

// Duplicate object keys are not allowed to disappear during canonicalization.
function parseState(text){
 const value=JSON.parse(text),stack=[]
 for(const token of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]/g)){
  const word=token[0],top=stack.at(-1)
  if(word==='{')stack.push({object:true,keys:new Set(),key:true})
  else if(word==='[')stack.push({object:false})
  else if(word==='}'||word===']')stack.pop()
  else if(word===','&&top?.object)top.key=true
  else if(word===':'&&top?.object)top.key=false
  else if(word[0]==='"'&&top?.object&&top.key){const key=JSON.parse(word);requireScope(!top.keys.has(key));top.keys.add(key)}
 }
 return value
}

// Only native tNN references at reviewed hydration i/t paths may be renamed.
// Every key, array position, number and non-reference value must remain exact;
// the two maps preserve every equality and inequality in the complete graph.
function reconcileHydration(reviewed,current){
 const forward=new Map(),reverse=new Map()
 function walk(a,b,key='',parentKey=''){
  if(typeof a==='string'&&/^t\d+$/.test(a)&&(key==='i'||parentKey==='t')){
   requireScope(typeof b==='string'&&/^t\d+$/.test(b))
   requireScope(!forward.has(a)||forward.get(a)===b);requireScope(!reverse.has(b)||reverse.get(b)===a)
   forward.set(a,b);reverse.set(b,a);return a
  }
  if(Array.isArray(a)){requireScope(Array.isArray(b)&&a.length===b.length);return a.map((v,i)=>walk(v,b[i],String(i),key))}
  if(a&&typeof a==='object'){
   requireScope(b&&typeof b==='object'&&!Array.isArray(b)&&equal(Object.keys(a).sort(),Object.keys(b).sort()))
   return Object.fromEntries(Object.keys(a).map(k=>[k,walk(a[k],b[k],k,key)]))
  }
  requireScope(a===b);return a
 }
 return walk(reviewed,current)
}

// The only moved CSS blocks use this small, exact class/descendant vocabulary.
// Compare all nodes, including inert nodes, and all media/active-state variants.
// For every pair whose order changed, disjoint target sets prove no cascade
// tie can change visibility, interaction, layout or inherited values.
export function cssPermutationProof(html,reviewed,current){
 try{
  const nodes=[],parents=new Map(),root=readNativeDocument(html).nodes(n=>n.tag==='root')[0]
  function index(node,parent){if(typeof node==='string')return;nodes.push(node);parents.set(node,parent);node.children.forEach(child=>index(child,node))}index(root,null)
  function targets(block){
   const css=block.replace(/^<style\b[^>]*>/,'').replace(/<\/style>$/,''),selectors=[]
   for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    for(const raw of match[1].trim().split(',')){
     const selector=raw.trim();requireScope(/^(?:[a-z][\w-]*)?(?:\.[\w-]+)*(?:\s+(?:[a-z][\w-]*)?(?:\.[\w-]+)*)*$/i.test(selector))
     selectors.push(selector.replace(/\.(?:active|solidCard)(?=[.\s]|$)/g,'').split(/\s+/))
    }
   }
   requireScope(selectors.length>0)
   const compound=(node,part)=>{const tag=part.match(/^[a-z][\w-]*/i)?.[0],classes=[...part.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);return (!tag||node.tag===tag)&&classes.every(c=>(node.attrs.class||'').split(/\s+/).includes(c))}
   const matches=(node,parts,i=parts.length-1)=>{if(!node||!compound(node,parts[i]))return false;if(!i)return true;for(let p=parents.get(node);p;p=parents.get(p))if(matches(p,parts,i-1))return true;return false}
   return new Set(nodes.filter(node=>selectors.some(parts=>matches(node,parts))))
  }
  const pairs=[]
  for(let i=0;i<reviewed.length;i++)for(let j=i+1;j<reviewed.length;j++){
   if(current.indexOf(reviewed[i])<current.indexOf(reviewed[j]))continue
   const a=targets(reviewed[i]),b=targets(reviewed[j]),overlap=[...a].filter(n=>b.has(n)).length
   requireScope(overlap===0);pairs.push({first:hash(reviewed[i]),second:hash(reviewed[j]),firstTargets:a.size,secondTargets:b.size,overlap})
  }
  return {valid:true,pairs}
 }catch{return {valid:false}}
}

export function corporateVisibleScopeHash(html){
 const doc=readVisibleNativeDocument(html,{strict:true}),body=doc.nodes(n=>n.tag==='body')[0];requireScope(body)
 const states=[]
 function visit(node,path=''){if(typeof node==='string')return;states.push({path,tag:node.tag,attrs:node.attrs,active:!node.inert,activeFrame:node.activeFrame===true});node.children.forEach((child,i)=>visit(child,path+'/'+i))}visit(body)
 return hash(canonical({states,text:doc.text(body)}))
}

// These signatures retain every business value and every executable/attribute.
// Resource permutations require exact reviewed bytes and finite CSS orders;
// new CSS, new order, new links or a changed hydration graph remain unknown.
export function currentCorporateScopeHash(html,review){
 try{
  requireScope(typeof html==='string'&&review)
  const heads=[...html.matchAll(/<head>([\s\S]*?)<\/head>/g)];requireScope(heads.length===1)
  const head=heads[0][1],currentStyles=styles(head),currentPreloads=preloads(head)
  requireScope(equal([...currentStyles].sort(),[...review.styles].sort()))
  requireScope(review.styleOrders.includes(hash(canonical(currentStyles))))
  requireScope(cssPermutationProof(html,review.styles,currentStyles).valid)
  requireScope(equal([...currentPreloads].sort(),[...review.imagePreloads].sort()))
  let normalizedHead=head.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'').replace(/<link\b(?=[^>]*\bas="image")[^>]*>/g,'')
  normalizedHead+='<!--reviewed-gati-resources-->'+review.styles.join('')+[...review.imagePreloads].sort().join('')
  let normalized=html.replace(heads[0][0],'<head>'+normalizedHead+'</head>')
  const states=[...normalized.matchAll(/<script\b[^>]*\bid="ng-state"[^>]*>[\s\S]*?<\/script>/g)];requireScope(states.length===1)
  const exact=states[0][0].match(/^<script id="ng-state" type="application\/json">([\s\S]*)<\/script>$/);requireScope(exact)
  const state=parseState(exact[1]);requireScope(Object.hasOwn(state,'__nghData__'))
  state.__nghData__=reconcileHydration(review.hydration,state.__nghData__)
  normalized=normalized.replace(states[0][0],'<script id="ng-state" type="application/json">'+canonical(state)+'</script>')
  requireScope(corporateVisibleScopeHash(html)===review.visibleScopeHash)
  return hash(normalized)
 }catch{return null}
}
