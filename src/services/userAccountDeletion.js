import ResumeUsage from '../models/ResumeUsage.js';
import { removeRetiredAccountData } from './retiredAccountData.js';
import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import Subscription from "../models/Subscription.js";
import Click from "../models/Click.js";
import JobAlertDelivery from "../models/JobAlertDelivery.js";
import PlanPurchase from "../models/PlanPurchase.js";
import AccessEvent from "../models/AccessEvent.js";
import TelegramLinkToken from "../models/TelegramLinkToken.js";
import UserSuggestion from "../models/UserSuggestion.js";
import AdminAudit from "../models/AdminAudit.js";
import SiteSettings from "../models/SiteSettings.js";
import Application from '../models/Application.js';
import ApplicationEvent from '../models/ApplicationEvent.js';
import CandidateEvidence from '../models/CandidateEvidence.js';
import Resume from '../models/Resume.js';
import TailoredResume from '../models/TailoredResume.js';
import ResumeArtifact from '../models/ResumeArtifact.js';
import CVRevision from '../models/CVRevision.js';
import AutoApplyAttempt from '../models/AutoApplyAttempt.js';

// Keep the account until cleanup succeeds, so a failed deletion can be retried.
export const removeUserAccount = async (user) => {
  if (!user?._id || !user.email) {
    throw new Error("User ID and email are required for account deletion");
  }
  const userId = user._id;
  await User.updateOne({ _id: userId }, { $set: { accountDeletingAt: new Date() } });
  await removeRetiredAccountData(userId);
  for (const Model of [ApplicationEvent, CandidateEvidence, CVRevision]) await Model.deleteMany({ user: userId });
  for (const Model of [AutoApplyAttempt]) await Model.deleteMany({ user: userId });
  for (const Model of [Subscription, Click, JobAlertDelivery, PlanPurchase, AccessEvent, TelegramLinkToken, UserSuggestion, Application, Resume, TailoredResume, ResumeArtifact, ResumeUsage]) {
    await Model.deleteMany({ user: userId });
  }
  await PendingUser.deleteMany({ email: user.email });
  await AdminAudit.deleteMany({
    $or: [{ admin: userId }, { targetType: "User", targetId: userId }],
  });
  await SiteSettings.updateMany({ updatedBy: userId }, { $unset: { updatedBy: "" } });
  await User.deleteOne({ _id: userId });
};
