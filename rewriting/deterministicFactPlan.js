/** Experimental bypass only when the existing schema has no remaining choice. */
import {assessRewriteInput,factPlanSchema,expandModelPlan,validateFactPlan} from './factPlan.js';

export function buildDeterministicFactPlan(input,options) {
 const assessment=assessRewriteInput(input,options);
 if(!assessment.ok)return {ok:false,reason:assessment.reason,modelRequired:false};
 const schema=factPlanSchema(input,options);
 if(schema.properties.categories.minItems!==0)return {ok:false,reason:'category_choice_required',modelRequired:true};
 const overviews=schema.properties.overviewFactId.enum||[];
 if(overviews.length>1)return {ok:false,reason:'overview_choice_required',modelRequired:true};
 const compactPlan={categories:[],overviewFactId:overviews.length?overviews[0]:null};
 const plan=expandModelPlan(compactPlan,input,options);
 const result=validateFactPlan(plan,input,'stop',options);
 return {...result,modelRequired:false,compactPlan,...(result.ok?{quality:{...result.quality,method:'deterministic_source_fact_organization'}}:{})};
}
