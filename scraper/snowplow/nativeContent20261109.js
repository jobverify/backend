const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,names)=>object(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name))
const positive=value=>Number.isSafeInteger(value)&&value>0
const ordinal=value=>Number.isSafeInteger(value)&&value>=0
const text=value=>typeof value==='string'&&value.trim().length>0
const nullableText=value=>value===null||typeof value==='string'
const proof=(ok,reason)=>{if(!ok)throw Object.assign(Error('Snowplow native proof: '+reason),{failureKind:'parser_or_contract_error'})}
const cell=(value,validate)=>keys(value,['value'])&&validate(value.value)

// Content can change without changing the source contract. These checks admit
// only the native structures actually understood by the reviewed renderer;
// admission never makes the changing values qualified vacancy criteria.
export function validateSnowplowPostingLocations(locations){
 proof(Array.isArray(locations)&&locations.length<=100,'unreviewed native posting location alternatives schema')
 for(const location of locations)proof(keys(location,['sourceType','locationId','name','country','region','city','displayFormat','displayValue','showCity','showRegion'])
  &&location.sourceType==='site'&&positive(location.locationId)&&text(location.name)&&text(location.country)
  &&nullableText(location.region)&&nullableText(location.city)&&location.displayFormat==='name'&&text(location.displayValue)
  &&typeof location.showCity==='boolean'&&typeof location.showRegion==='boolean','unreviewed native posting location alternatives schema')
}

export function validateSnowplowApplicationForm(form){
 proof(keys(form,['id','/applicationForm/questions','/applicationForm/documents','/applicationForm/fields'])&&positive(form.id),'unreviewed application form schema')
 const allIds=new Set(),unique=value=>{if(!positive(value)||allIds.has(value))return false;allIds.add(value);return true}
 for(const kind of ['questions','documents','fields']){
  const container=form['/applicationForm/'+kind]
  proof(cell(container,value=>Array.isArray(value)&&value.length<=2000),'unreviewed application '+kind+' schema')
  const seenOrdinals=new Set(),order=value=>{if(!ordinal(value)||seenOrdinals.has(value))return false;seenOrdinals.add(value);return true}
  for(const value of container.value){
   if(kind==='questions'){
    proof(keys(value,['id','/question/description','/question/options','/question/isMandatory','/question/configuration','/applicationFormQuestion/ordinal','/question/text','/question/type'])
     &&unique(value.id)&&cell(value['/question/description'],nullableText)
     &&cell(value['/question/options'],options=>Array.isArray(options)&&options.length===0)
     &&cell(value['/question/isMandatory'],flag=>typeof flag==='boolean')
     &&cell(value['/question/configuration'],config=>keys(config,['allowMultipleAnswers'])&&typeof config.allowMultipleAnswers==='boolean')
     &&cell(value['/applicationFormQuestion/ordinal'],order)&&cell(value['/question/text'],text)
     &&cell(value['/question/type'],type=>type==='open_text'),'unreviewed application mandatory fields/questions schema')
   }else if(kind==='documents'){
    proof(keys(value,['id','/applicationFormDocument/instructions','/applicationFormDocument/ordinal','/applicationFormDocument/type','/applicationFormDocument/isMandatory','/applicationFormDocument/applicationFormId','/applicationFormDocument/name'])
     &&unique(value.id)&&cell(value['/applicationFormDocument/instructions'],nullableText)
     &&cell(value['/applicationFormDocument/ordinal'],order)&&cell(value['/applicationFormDocument/type'],text)
     &&cell(value['/applicationFormDocument/isMandatory'],flag=>typeof flag==='boolean')
     &&cell(value['/applicationFormDocument/applicationFormId'],id=>id===form.id)&&cell(value['/applicationFormDocument/name'],text),'unreviewed application document schema or identity')
   }else{
    proof(keys(value,['id','/applicationFormField/applicationFormId','/applicationFormField/ordinal','/applicationFormField/fieldPath','/applicationFormField/isMandatory'])
     &&unique(value.id)&&cell(value['/applicationFormField/applicationFormId'],id=>id===form.id)
     &&cell(value['/applicationFormField/ordinal'],order)
     &&cell(value['/applicationFormField/fieldPath'],path=>typeof path==='string'&&/^\/(?:candidate|application)\/[A-Za-z][A-Za-z0-9.]*$/.test(path))
     &&cell(value['/applicationFormField/isMandatory'],flag=>typeof flag==='boolean'),'unreviewed application field schema or identity')
   }
  }
 }
}
