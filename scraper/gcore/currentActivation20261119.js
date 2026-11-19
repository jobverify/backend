import {createHash} from 'node:crypto'
import {parseExpressionAt} from 'acorn'
import profile from './publisherProfile20261119.json' with {type:'json'}
import {sourceFrame} from './staticActivationClass20261107.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
// These six JSON string tokens are paired Angular SSR template references in
// one observed hydration subtree. No native/CMS content, query, program, or
// activation byte is omitted. Every ID use outside these exact paths fails.
const paths=[
 ['__nghData__',22,'c',0,0,'t',7],
 ['__nghData__',22,'c',0,0,'t',8],
 ['__nghData__',22,'c',0,0,'c',7,0,'i'],
 ['__nghData__',22,'c',0,0,'c',7,0,'t',0],
 ['__nghData__',22,'c',0,0,'c',7,0,'t',1],
 ['__nghData__',22,'c',0,0,'c',7,0,'c',0,0,'i'],
]
const offsets=[0,3,0,1,2,1]
const nodeAt=(node,path)=>path.reduce((node,key)=>{
 if(node?.type==='ArrayExpression'&&Number.isSafeInteger(key))return node.elements[key]
 if(node?.type!=='ObjectExpression')return null
 const found=node.properties.filter(p=>p.type==='Property'&&!p.computed&&p.kind==='init'&&p.key.type==='Literal'&&String(p.key.value)===String(key))
 return found.length===1?found[0].value:null
},node)
export function readCurrentHydrationFrame(text){
 try{
  const value=JSON.parse(text),ast=parseExpressionAt(text,0,{ecmaVersion:'latest'})
  const nodes=paths.map(path=>nodeAt(ast,path))
  if(nodes.some(n=>n?.type!=='Literal'||typeof n.value!=='string'||!/^t[1-9]\d{0,7}$/.test(n.value)
   ||text.slice(n.start,n.end)!==JSON.stringify(n.value)))return null
  const base=Number(nodes[0].value.slice(1))
  if(nodes.some((n,i)=>Number(n.value.slice(1))!==base+offsets[i]))return null
  const allowed=new Set(paths.map(p=>JSON.stringify(p.map(String)))),ids=new Set(nodes.map(n=>n.value))
  const collision=(v,path)=>typeof v==='string'?ids.has(v)&&!allowed.has(JSON.stringify(path))
   :v&&typeof v==='object'&&Object.entries(v).some(([key,item])=>collision(item,[...path,key]))
  if(collision(value,[]))return null
  const spans=nodes.map((n,i)=>({...n,marker:'<ANGULAR-TEMPLATE-ID:'+offsets[i]+'>'})).sort((a,b)=>b.start-a.start)
  for(const n of spans)text=text.slice(0,n.start)+n.marker+text.slice(n.end)
  return sha(text)
 }catch{return null}
}
export function matchesCurrentActivationClass(url,activation,programs){
 try{
  const contract=profile.activation
  if(!contract.carriers[url]||programs.length!==contract.count||activation.scripts.length!==contract.count)return false
  for(const [slot,old]of Object.entries(contract.slots))
   if(sourceFrame(programs[slot],old,{cookieSecure:true})!==contract.frames[old])return false
  const hydration=readCurrentHydrationFrame(programs[9])
  if(!hydration||hydration!==contract.hydrationFrames[url])return false
  const scripts=activation.scripts.map((script,slot)=>Object.hasOwn(contract.slots,slot)
   ?{...script,bodySha256:'<SOURCE-FRAME:'+contract.frames[contract.slots[slot]]+'>'}
   :slot===9?{...script,bodySha256:'<HYDRATION-FRAME:'+hydration+'>'}:script)
  return contract.carriers[url].includes(sha(JSON.stringify({bases:activation.bases,scripts,carriers:activation.carriers})))
 }catch{return false}
}
