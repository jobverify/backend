import mongoose from 'mongoose';
export default mongoose.model('PipelineConfiguration',new mongoose.Schema({
  _id:{type:String,default:'global'},stages:[{_id:false,key:String,enabled:Boolean}],updatedBy:String,
},{timestamps:true}));
