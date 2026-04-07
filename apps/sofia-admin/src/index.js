import http from 'node:http';

const port = Number(process.env.SOFIA_ADMIN_PORT || 3001);
const apiBaseUrl = process.env.SOFIA_API_BASE_URL || 'http://127.0.0.1:8080';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sofia Admin</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe7;
        --panel: #fffdf8;
        --ink: #1e1a16;
        --muted: #6f665d;
        --line: #ddd2c2;
        --accent: #0f766e;
        --warn: #b45309;
        --danger: #b91c1c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background:
          radial-gradient(circle at top left, #f7d8ae 0, transparent 28%),
          linear-gradient(180deg, #f8f4ec 0%, var(--bg) 100%);
        color: var(--ink);
      }
      header, main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; }
      header { padding: 28px 0 20px; }
      h1 { margin: 0; font-size: 38px; letter-spacing: -0.03em; }
      p { color: var(--muted); }
      main { display: grid; gap: 16px; padding-bottom: 28px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 12px 30px rgba(30, 26, 22, 0.06);
      }
      .panel h2 { margin: 0 0 10px; font-size: 18px; }
      .metric { font-size: 30px; font-weight: 700; }
      .tiny { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 9px 0; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
      th { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
      code { background: #f1e8da; padding: 2px 6px; border-radius: 6px; }
      .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 12px; background: #ece6db; }
      .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      button {
        border: 0;
        border-radius: 999px;
        background: var(--ink);
        color: white;
        padding: 10px 14px;
        cursor: pointer;
      }
      button.secondary { background: var(--warn); }
      button.danger { background: var(--danger); }
      .mono { font-family: Consolas, "SFMono-Regular", monospace; }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; }
      .actions { display: flex; gap: 8px; flex-wrap: wrap; }
      ul.compact { margin: 0; padding-left: 18px; color: var(--muted); }
      ul.compact li { margin: 0 0 6px; }
    </style>
  </head>
  <body>
    <header>
      <div class="toolbar">
        <span class="badge mono">API <span id="api-base"></span></span>
        <button id="refresh">Refresh</button>
      </div>
      <div class="toolbar" style="margin-top: 12px;">
        <input id="control-token" type="password" placeholder="Optional control token" style="max-width: 340px;" />
        <button id="save-token">Save Token</button>
      </div>
      <h1>Sofia Admin</h1>
      <p>Runtime, queue, runs, approvals, and template state in one place.</p>
    </header>
    <main>
      <section class="grid">
        <div class="panel"><div class="tiny">Runtime Mode</div><div class="metric" id="runtime-mode">...</div></div>
        <div class="panel"><div class="tiny">Queued Runs</div><div class="metric" id="queued-count">...</div></div>
        <div class="panel"><div class="tiny">Dead Letter</div><div class="metric" id="dead-letter-count">...</div></div>
        <div class="panel"><div class="tiny">Pending Approvals</div><div class="metric" id="pending-approvals">...</div></div>
      </section>

      <section class="grid">
        <div class="panel"><h2>Runtime Health</h2><pre id="runtime-health">Loading...</pre></div>
        <div class="panel"><h2>Policy Guardrails</h2><pre id="policy-guardrails">Loading...</pre></div>
        <div class="panel"><h2>Runtime Metrics</h2><pre id="runtime-metrics">Loading...</pre></div>
        <div class="panel"><h2>Task Status</h2><pre id="task-status">Loading...</pre></div>
        <div class="panel"><h2>Run Status</h2><pre id="run-status">Loading...</pre></div>
        <div class="panel">
          <h2>Active Memory Timeline</h2>
          <div id="memory-timeline-meta" class="tiny">Loading...</div>
          <ul id="memory-timeline-summary" class="compact"><li>Loading...</li></ul>
        </div>
      </section>

      <section class="panel">
        <h2>Recent Dead-Letter Runs</h2>
        <table id="dead-letter-table"><thead><tr><th>Run</th><th>Task</th><th>Step Count</th><th>Decision Count</th><th>Actions</th></tr></thead><tbody></tbody></table>
      </section>

      <section class="panel">
        <h2>Recent Approvals</h2>
        <table id="approval-table"><thead><tr><th>Approval</th><th>Task</th><th>Status</th><th>Phase</th><th>Decision By</th><th>Actions</th></tr></thead><tbody></tbody></table>
      </section>

      <section class="panel">
        <h2>Project Templates</h2>
        <table id="template-table"><thead><tr><th>Template</th><th>Risk</th><th>Workflow</th><th>Description</th></tr></thead><tbody></tbody></table>
      </section>

      <section class="panel">
        <h2>Action Log</h2>
        <pre id="action-log">No actions yet.</pre>
      </section>
    </main>
    <script>
      const apiBaseUrl = ${JSON.stringify(apiBaseUrl)};
      const controlTokenStorageKey = 'sofia.controlToken';
      document.getElementById('api-base').textContent = apiBaseUrl;
      document.getElementById('control-token').value = window.localStorage.getItem(controlTokenStorageKey) || '';

      function getControlHeaders() {
        const token = document.getElementById('control-token').value.trim();
        return token ? {authorization: 'Bearer ' + token} : {};
      }

      async function fetchJson(path) {
        const response = await fetch(apiBaseUrl + path, { headers: getControlHeaders() });
        if (!response.ok) throw new Error(path + ' -> ' + response.status);
        return response.json();
      }

      async function postJson(path, payload) {
        const response = await fetch(apiBaseUrl + path, {
          method: 'POST',
          headers: {'content-type': 'application/json', ...getControlHeaders()},
          body: JSON.stringify(payload || {})
        });
        const body = await response.json();
        if (!response.ok) throw new Error((body && body.message) || path + ' -> ' + response.status);
        return body;
      }

      function setText(id, value) {
        document.getElementById(id).textContent = value;
      }

      function appendActionLog(message) {
        const target = document.getElementById('action-log');
        const next = '[' + new Date().toISOString() + '] ' + message;
        target.textContent = target.textContent === 'No actions yet.' ? next : next + '\n' + target.textContent;
      }

      function fillTable(tableId, rows, renderRow) {
        const tbody = document.querySelector('#' + tableId + ' tbody');
        tbody.innerHTML = rows.map(renderRow).join('') || '<tr><td colspan="5">No data</td></tr>';
      }

      function setTimeline(memory) {
        const timeline = memory?.activeTimeline;
        const meta = document.getElementById('memory-timeline-meta');
        const summary = document.getElementById('memory-timeline-summary');

        if (!timeline?.available) {
          meta.textContent = timeline?.activeTaskId ? 'Timeline artifact not readable yet' : 'No active timeline';
          summary.innerHTML = '<li>No active task memory timeline available.</li>';
          return;
        }

        meta.textContent = [
          timeline.title || timeline.activeTaskId || 'Active task',
          timeline.timelinePath || '',
          timeline.updatedAt ? ('updated ' + timeline.updatedAt) : ''
        ].filter(Boolean).join(' · ');

        const items = Array.isArray(timeline.summary) ? timeline.summary : [];
        summary.innerHTML = items.length
          ? items.map((line) => '<li>' + line.replace(/^-\s*/, '') + '</li>').join('')
          : '<li>Timeline summary is empty.</li>';
      }

      async function refresh() {
        try {
          const results = await Promise.all([
            fetchJson('/v1/runtime/status'),
            fetchJson('/v1/runtime/metrics'),
            fetchJson('/v1/runs?status=dead_lettered&limit=8'),
            fetchJson('/v1/approvals?limit=8'),
            fetchJson('/v1/project-templates')
          ]);
          const runtime = results[0];
          const metrics = results[1];
          const deadLetterRuns = results[2];
          const approvals = results[3];
          const templates = results[4];

          setText('runtime-mode', runtime.mode || 'unknown');
          setText('queued-count', runtime.queue?.queuedCount ?? 0);
          setText('dead-letter-count', runtime.queue?.deadLetterCount ?? 0);
          setText('pending-approvals', runtime.pendingApprovals ?? 0);
          setText('runtime-health', JSON.stringify(runtime.services, null, 2));
          setText('policy-guardrails', JSON.stringify(runtime.policy || {}, null, 2));
          setText('runtime-metrics', JSON.stringify(metrics, null, 2));
          setText('task-status', JSON.stringify(runtime.tasksByStatus || {}, null, 2));
          setText('run-status', JSON.stringify(runtime.runsByStatus || {}, null, 2));
          setTimeline(runtime.memory || {});

          fillTable('dead-letter-table', deadLetterRuns, (run) => [
            '<tr>',
            '<td class="mono">' + run.id + '</td>',
            '<td class="mono">' + run.taskId + '</td>',
            '<td>' + (run.steps?.length || 0) + '</td>',
            '<td>' + (run.decisions?.length || 0) + '</td>',
            '<td><div class="actions"><button onclick="window.sofiaAdmin.replayRun(\'' + run.id + '\')">Replay</button></div></td>',
            '</tr>'
          ].join(''));

          fillTable('approval-table', approvals, (approval) => [
            '<tr>',
            '<td class="mono">' + approval.id + '</td>',
            '<td class="mono">' + approval.taskId + '</td>',
            '<td>' + approval.status + '</td>',
            '<td>' + approval.phaseName + '</td>',
            '<td>' + (approval.decisionBy || '') + '</td>',
            '<td>' + (
              approval.status === 'pending'
                ? '<div class="actions"><button onclick="window.sofiaAdmin.approveTask(\'' + approval.taskId + '\')">Approve</button><button class="danger" onclick="window.sofiaAdmin.rejectTask(\'' + approval.taskId + '\')">Reject</button></div>'
                : '<span class="tiny">No actions</span>'
            ) + '</td>',
            '</tr>'
          ].join(''));

          fillTable('template-table', templates, (template) => [
            '<tr>',
            '<td><strong>' + template.id + '</strong></td>',
            '<td>' + (template.defaults?.risk || '') + '</td>',
            '<td><code>' + (template.defaults?.workflowTemplate || '') + '</code></td>',
            '<td>' + (template.description || '') + '</td>',
            '</tr>'
          ].join(''));
        } catch (error) {
          setText('runtime-health', String(error.message || error));
        }
      }

      window.sofiaAdmin = {
        async replayRun(runId) {
          try {
            await postJson('/v1/runs/' + runId + '/replay', {replayedBy: 'sofia-admin'});
            appendActionLog('Replayed dead-letter run ' + runId);
            await refresh();
          } catch (error) {
            appendActionLog('Replay failed for ' + runId + ': ' + String(error.message || error));
          }
        },
        async approveTask(taskId) {
          try {
            await postJson('/v1/tasks/' + taskId + '/approve', {decisionBy: 'sofia-admin', note: 'approved from admin shell'});
            appendActionLog('Approved task ' + taskId);
            await refresh();
          } catch (error) {
            appendActionLog('Approve failed for ' + taskId + ': ' + String(error.message || error));
          }
        },
        async rejectTask(taskId) {
          try {
            await postJson('/v1/tasks/' + taskId + '/reject', {decisionBy: 'sofia-admin', note: 'rejected from admin shell'});
            appendActionLog('Rejected task ' + taskId);
            await refresh();
          } catch (error) {
            appendActionLog('Reject failed for ' + taskId + ': ' + String(error.message || error));
          }
        }
      };

      document.getElementById('refresh').addEventListener('click', refresh);
      document.getElementById('save-token').addEventListener('click', () => {
        const value = document.getElementById('control-token').value.trim();
        if (value) {
          window.localStorage.setItem(controlTokenStorageKey, value);
          appendActionLog('Saved control token to local storage');
        } else {
          window.localStorage.removeItem(controlTokenStorageKey);
          appendActionLog('Cleared control token from local storage');
        }
      });
      refresh();
      setInterval(refresh, 15000);
    </script>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  if ((req.method || 'GET') !== 'GET') {
    res.writeHead(405, {'content-type': 'text/plain; charset=utf-8'});
    res.end('method_not_allowed');
    return;
  }

  res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
  res.end(html);
});

server.listen(port, () => {
  console.log(`sofia-admin listening on :${port}`);
});

export {server};
