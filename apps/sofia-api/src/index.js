import http from 'node:http';
import {URL} from 'node:url';

import {runDoctor} from './doctor.js';
import {approveTask, createTask, getRun, getRuntimeMetrics, getRuntimeStatus, getTask, listApprovals, listPendingApprovals, listProjectTemplates, listRuns, listTasks, rejectTask, replayDeadLetterRun, startTask} from './runtime-backend.js';
import {runSmoke} from './smoke.js';

const port = process.env.SOFIA_API_PORT || 8080;
const controlToken = String(process.env.SOFIA_CONTROL_TOKEN || '').trim();

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {'content-type': 'application/json'});
  res.end(JSON.stringify(payload));
}

function readControlToken(req) {
  const authorization = String(req.headers.authorization || '').trim();
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return String(req.headers['x-sofia-token'] || '').trim();
}

function requiresControlAuth(url) {
  return url.pathname.startsWith('/v1/');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer((req, res) => {
  (async () => {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const taskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
    const taskStartMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/start$/);
    const taskApproveMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/approve$/);
    const taskRejectMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/reject$/);
    const runMatch = url.pathname.match(/^\/v1\/runs\/([^/]+)$/);
    const runReplayMatch = url.pathname.match(/^\/v1\/runs\/([^/]+)\/replay$/);

    if (url.pathname === '/health') {
      json(res, 200, {status: 'ok', service: 'sofia-api', mode: 'scaffold'});
      return;
    }

    if (url.pathname === '/health/ready') {
      const metrics = await getRuntimeMetrics();
      const ready = metrics.services.postgresOk && metrics.services.redisOk;
      json(res, ready ? 200 : 503, {
        status: ready ? 'ready' : 'not_ready',
        service: 'sofia-api',
        mode: metrics.mode,
        services: metrics.services
      });
      return;
    }

    if (controlToken && requiresControlAuth(url) && readControlToken(req) !== controlToken) {
      json(res, 401, {
        error: 'unauthorized',
        message: 'control token missing or invalid'
      });
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/doctor') {
      json(res, 200, await runDoctor());
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/runtime/status') {
      json(res, 200, await getRuntimeStatus());
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/runtime/metrics') {
      json(res, 200, await getRuntimeMetrics());
      return;
    }

    if (method === 'POST' && url.pathname === '/v1/smoke') {
      json(res, 200, await runSmoke());
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/project-templates') {
      json(res, 200, listProjectTemplates());
      return;
    }

    if (method === 'POST' && url.pathname === '/v1/tasks') {
      json(res, 201, await createTask(await readBody(req)));
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/tasks') {
      json(
        res,
        200,
        await listTasks({
          status: url.searchParams.get('status') || '',
          limit: url.searchParams.get('limit') || ''
        })
      );
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/runs') {
      json(
        res,
        200,
        await listRuns({
          status: url.searchParams.get('status') || '',
          taskId: url.searchParams.get('taskId') || '',
          limit: url.searchParams.get('limit') || ''
        })
      );
      return;
    }

    if (method === 'GET' && taskMatch) {
      json(res, 200, await getTask(taskMatch[1]));
      return;
    }

    if (method === 'POST' && taskStartMatch) {
      json(res, 200, await startTask(taskStartMatch[1]));
      return;
    }

    if (method === 'POST' && taskApproveMatch) {
      json(res, 200, await approveTask(taskApproveMatch[1], await readBody(req)));
      return;
    }

    if (method === 'POST' && taskRejectMatch) {
      json(res, 200, await rejectTask(taskRejectMatch[1], await readBody(req)));
      return;
    }

    if (method === 'GET' && runMatch) {
      json(res, 200, await getRun(runMatch[1]));
      return;
    }

    if (method === 'POST' && runReplayMatch) {
      json(res, 200, await replayDeadLetterRun(runReplayMatch[1], await readBody(req)));
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/approvals/pending') {
      json(
        res,
        200,
        await listPendingApprovals({
          limit: url.searchParams.get('limit') || ''
        })
      );
      return;
    }

    if (method === 'GET' && url.pathname === '/v1/approvals') {
      json(
        res,
        200,
        await listApprovals({
          status: url.searchParams.get('status') || '',
          taskId: url.searchParams.get('taskId') || '',
          limit: url.searchParams.get('limit') || ''
        })
      );
      return;
    }

    json(res, 404, {error: 'not_found'});
  })().catch((error) => {
    json(res, 500, {
      error: 'internal_error',
      message: String(error.message || error)
    });
  });
});

server.listen(port, () => {
  console.log(`sofia-api listening on :${port}`);
});

export {server};
