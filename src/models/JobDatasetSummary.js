import { Schema, model } from "mongoose";

const JobDatasetSummarySchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    lifecycleVersion: { type: Number, default: 1, min: 1 },
    refreshSequence: { type: Number, default: 0, min: 0 },
    publishedSequence: { type: Number, default: 0, min: 0 },
    totalJobs: { type: Number, default: 0, min: 0 },
    totalCompanies: { type: Number, default: 0, min: 0 },
    companies: { type: [String], default: [] },
    cities: { type: [String], default: [] },
    jobTypes: { type: [String], default: [] },
    refreshedAt: { type: Date, default: Date.now },
    nextClosingAt: { type: Date, default: null },
    nextPublicationAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    strict: true,
  },
);

const JobDatasetSummary = model("JobDatasetSummary", JobDatasetSummarySchema);

export default JobDatasetSummary;
