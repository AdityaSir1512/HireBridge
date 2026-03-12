const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { getClient } = require('../config/redis');

function scoreJob(userSkills = [], jobSkills = []) {
  if (!userSkills.length || !jobSkills.length) return 0;
  const set = new Set(userSkills.map(s => String(s).toLowerCase()));
  const overlap = jobSkills.filter(s => set.has(String(s).toLowerCase())).length;
  return overlap / Math.max(jobSkills.length, 1);
}

async function getJobs(filters = {}) {
  // Placeholder: integrate with Job Service via API Gateway later
  return [];
}

async function recommendJobsForUser(user, options = {}) {
  const { jobTypePreference } = user;
  const redis = getClient();
  const cacheKey = `matches:${user._id || user.userId}:type:${jobTypePreference}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const jobs = await getJobs({ jobType: jobTypePreference });
  const scored = jobs.map(job => ({ job, score: scoreJob(user.profile?.skills || [], job.skills || []) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  await redis.setEx(cacheKey, 900, JSON.stringify(scored));
  return scored;
}

async function findCandidatesForJob(job, users = []) {
  return users
    .map(u => ({ user: u, score: scoreJob(u.profile?.skills || [], job.skills || []) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

module.exports = { recommendJobsForUser, findCandidatesForJob };
