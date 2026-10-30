const { sqlOne } = require('../../backend/src/db');

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  try {
    const pending = await sqlOne(
      `SELECT job_run_id, job_name FROM job_runs
       WHERE status = 'queued'
       ORDER BY submitted_at ASC
       LIMIT 1`
    );

    if (!pending) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'No pending jobs' }));
    }

    const { executeJobRun } = require('../../backend/src/batch-runner');

    // Await completion — requires maxDuration: 300 in vercel.json (Pro plan).
    // On Hobby (10 s limit) only short jobs will complete in time.
    await executeJobRun(pending.job_run_id);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Done', jobRunId: pending.job_run_id }));
  } catch (err) {
    console.error('Cron error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message }));
  }
};
