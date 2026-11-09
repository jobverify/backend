import { Schema, model } from "mongoose";

const siteSettingsSchema = new Schema({
  _id: { type: String, default: "global" },
  billingEnabled: { type: Boolean, default: false, required: true },
  experiencedJobsEnabled: { type: Boolean, default: true, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default model("SiteSettings", siteSettingsSchema);
