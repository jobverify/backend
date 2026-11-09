import {parse} from 'acorn'

const numericTokens=new WeakSet()
export const nativeSafeCount=value=>{
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null
 if(value&&numericTokens.has(value)&&/^(?:0|[1-9][0-9]*)\.0+$/.test(value.nativeJSONNumberLexeme)){
  const n=Number(value.nativeJSONNumberLexeme)
  if(Number.isSafeInteger(n)&&n>=0)return n
 }
 return null
}

// JSON.parse validates the JSON grammar; its rounded result is discarded.
// The AST supplies original numeric tokens and decoded, duplicate-checked keys.
export function parseNativeJSON(text){
 if(typeof text!=='string')throw new TypeError('AECOM native JSON must be text')
 JSON.parse(text)
 const source='('+text+')',ast=parse(source,{ecmaVersion:'latest'}).body[0].expression
 const number=node=>{
  const raw=source.slice(node.start,node.end),value=Number(raw)
  if(/^-?(?:0|[1-9][0-9]*)$/.test(raw)&&raw!=='-0'&&Number.isSafeInteger(value))return value
  const token={nativeJSONNumberLexeme:raw};numericTokens.add(token);return token
 }
 const read=node=>{
  if(node.type==='ObjectExpression'){
   const seen=new Set(),pairs=node.properties.map(p=>{
    if(p.type!=='Property'||p.computed||p.kind!=='init'||p.method||p.shorthand)throw new Error('AECOM native invalid JSON property')
    const key=p.key.value
    if(seen.has(key))throw new Error('AECOM native duplicate JSON field: '+key)
    // This diagnostic marker is reserved. A publisher object with that key
    // must not be confused with a parsed numeric scalar during export/closing.
    if(key==='nativeJSONNumberLexeme')throw new Error('AECOM native reserved numeric marker in publisher object')
    seen.add(key);return[key,read(p.value)]
   })
   return Object.fromEntries(pairs)
  }
  if(node.type==='ArrayExpression')return node.elements.map(read)
  if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='Literal'&&typeof node.argument.value==='number')return number(node)
  if(node.type==='Literal')return typeof node.value==='number'?number(node):node.value
  throw new Error('AECOM native unsupported JSON value')
 }
 return read(ast)
}
