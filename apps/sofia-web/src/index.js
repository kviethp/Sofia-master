import http from 'node:http';

const port = Number(process.env.SOFIA_WEB_PORT || 3000);
const apiBaseUrl = process.env.SOFIA_API_BASE_URL || 'http://127.0.0.1:8080';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sofia Web</title>
    <style>
      :root {
        --bg: #f7f2eb;
        --panel: #fffaf3;
        --ink: #1f2937;
        --muted: #6b7280;
        --line: #e7dccd;
        --accent: #0f766e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", Georgia, serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top right, rgba(248, 208, 155, 0.55), transparent 24%),
          linear-gradient(180deg, #fcf8f2 0%, var(--bg) 100%);
      }
      main {
        width: min(980px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 28px 0 32px;
        display: grid;
        gap: 18px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(31, 41, 55, 0.05);
      }
      h1, h2 { margin: 0 0 10px; }
      p { color: var(--muted); }
      form { display: grid; gap: 12px; }
      input, select, textarea, button {
        width: 100%;
        border-radius: 12px;
        border: 1px solid var(--line);
        padding: 12px 14px;
        font: inherit;
      }
      textarea { min-height: 100px; resize: vertical; }
      button {
        background: var(--ink);
        color: white;
        cursor: pointer;
      }
      button.secondary { background: var(--accent); }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 0; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
      th { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
      code { background: #f1e7d8; padding: 2px 6px; border-radius: 6px; }
      .status { font-weight: 700; color: var(--accent); }
      .mono { font-family: Consolas, monospace; }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>Sofia Web</h1>
        <p>Submit a low-risk golden-path task and inspect recent task history.</p>
        <div class="actions">
          <input id="control-token" type="password" placeholder="Optional control token" />
          <button type="button" id="save-token">Save Token</button>
        </div>
      </section>

      <section class="panel">
        <h2>Create Task</h2>
        <form id="task-form">
          <label>
            Title
            <input name="title" value="Add a simple login page scaffold to a demo app" />
          </label>
          <label>
            Template
            <select name="templateId" id="template-select"></select>
          </label>
          <label>
            Notes
            <textarea name="notes">Golden path demo request</textarea>
          </label>
          <div class="actions">
            <button type="submit">Create Task</button>
            <button class="secondary" type="button" id="create-start-button">Create And Start</button>
          </div>
        </form>
        <pre id="task-create-result">No task submitted yet.</pre>
      </section>

      <section class="panel">
        <h2>Recent Tasks</h2>
        <table id="task-table">
          <thead><tr><th>Task</th><th>Status</th><th>Template</th><th>Workflow</th><th>Actions</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
    </main>
    <script>
      const apiBaseUrl = ${JSON.stringify(apiBaseUrl)};
      const controlTokenStorageKey = 'sofia.controlToken';
      document.getElementById('control-token').value = window.localStorage.getItem(controlTokenStorageKey) || '';

      function getControlHeaders() {
        const token = document.getElementById('control-token').value.trim();
        return token ? {authorization: 'Bearer ' + token} : {};
      }

      async function fetchJson(path, options) {
        const response = await fetch(apiBaseUrl + path, {
          ...(options || {}),
          headers: {
            ...(options?.headers || {}),
            ...getControlHeaders()
          }
        });
        if (!response.ok) {
          throw new Error(path + ' -> ' + response.status);
        }
        return response.json();
      }

      async function loadTemplates() {
        const templates = await fetchJson('/v1/project-templates');
        const select = document.getElementById('template-select');
        select.innerHTML = templates.map((template) => \`<option value="\${template.id}">\${template.id} - \${template.defaults?.workflowTemplate || ''}</option>\`).join('');
        select.value = 'webapp-basic';
      }

      async function loadTasks() {
        const tasks = await fetchJson('/v1/tasks?limit=8');
        const tbody = document.querySelector('#task-table tbody');
        tbody.innerHTML = tasks.map((task) => \`
          <tr>
            <td>
              <strong>\${task.title}</strong><br />
              <span class="mono">\${task.id}</span>
            </td>
            <td class="status">\${task.status}</td>
            <td>\${task.templateId || ''}</td>
            <td><code>\${task.workflowTemplate || ''}</code></td>
            <td>
              \${task.status === 'queued' ? \`<button class="secondary" onclick="window.sofiaWeb.startTask('\${task.id}')">Start</button>\` : '<span class="mono">-</span>'}
            </td>
          </tr>
        \`).join('') || '<tr><td colspan="5">No tasks yet.</td></tr>';
      }

      function getCreatePayload(formElement) {
        const form = new FormData(formElement);
        return {
          title: form.get('title'),
          templateId: form.get('templateId'),
          note: form.get('notes')
        };
      }

      async function createTask(formElement, startImmediately) {
        const payload = getCreatePayload(formElement);
        const result = await fetchJson('/v1/tasks', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(payload)
        });

        let finalResult = result;
        if (startImmediately) {
          finalResult = await fetchJson('/v1/tasks/' + result.id + '/start', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: '{}'
          });
        }

        document.getElementById('task-create-result').textContent = JSON.stringify(finalResult, null, 2);
        await loadTasks();
      }

      window.sofiaWeb = {
        async startTask(taskId) {
          try {
            const result = await fetchJson('/v1/tasks/' + taskId + '/start', {
              method: 'POST',
              headers: {'content-type': 'application/json'},
              body: '{}'
            });
            document.getElementById('task-create-result').textContent = JSON.stringify(result, null, 2);
            await loadTasks();
          } catch (error) {
            document.getElementById('task-create-result').textContent = String(error.message || error);
          }
        }
      };

      document.getElementById('task-form').addEventListener('submit', (event) => {
        event.preventDefault();
        createTask(event.target, false).catch((error) => {
          document.getElementById('task-create-result').textContent = String(error.message || error);
        });
      });

      document.getElementById('create-start-button').addEventListener('click', () => {
        const form = document.getElementById('task-form');
        createTask(form, true).catch((error) => {
          document.getElementById('task-create-result').textContent = String(error.message || error);
        });
      });

      Promise.all([loadTemplates(), loadTasks()]).catch((error) => {
        document.getElementById('task-create-result').textContent = String(error.message || error);
      });

      document.getElementById('save-token').addEventListener('click', () => {
        const value = document.getElementById('control-token').value.trim();
        if (value) {
          window.localStorage.setItem(controlTokenStorageKey, value);
        } else {
          window.localStorage.removeItem(controlTokenStorageKey);
        }
      });
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
  console.log(`sofia-web listening on :${port}`);
});

export {server};
