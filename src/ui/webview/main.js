const vscodeApi = acquireVsCodeApi();

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const attachBtn = document.getElementById('attach-file');
const modelSelect = document.getElementById('model-select');
const autoApply = document.getElementById('auto-apply');

function addMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${role}`;
  wrapper.innerHTML = `<div class="bubble">${escapeHtml(text).replace(/\n/g, '<br/>')}</div>`;
  chatEl.appendChild(wrapper);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addPlan(plan) {
  const wrapper = document.createElement('div');
  wrapper.className = 'plan';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(plan, null, 2);
  const controls = document.createElement('div');
  controls.className = 'plan-controls';
  const accept = document.createElement('vscode-button');
  accept.textContent = 'Accept Plan';
  accept.addEventListener('click', () => vscodeApi.postMessage({ type: 'accept-plan' }));
  const reject = document.createElement('vscode-button');
  reject.textContent = 'Reject Plan';
  reject.appearance = 'secondary';
  reject.addEventListener('click', () => vscodeApi.postMessage({ type: 'reject-plan' }));
  controls.appendChild(accept);
  controls.appendChild(reject);
  wrapper.appendChild(pre);
  wrapper.appendChild(controls);
  chatEl.appendChild(wrapper);
  chatEl.scrollTop = chatEl.scrollHeight;
}

sendBtn.addEventListener('click', () => {
  const text = inputEl.value.trim();
  if (!text) return;
  vscodeApi.postMessage({ type: 'send', text });
  inputEl.value = '';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    sendBtn.click();
  }
  if (e.key === '@') {
    // Quick attach on @ mention
    vscodeApi.postMessage({ type: 'attach-file' });
  }
});

loginBtn.addEventListener('click', () => vscodeApi.postMessage({ type: 'login' }));
logoutBtn.addEventListener('click', () => vscodeApi.postMessage({ type: 'logout' }));
attachBtn.addEventListener('click', () => vscodeApi.postMessage({ type: 'attach-file' }));
modelSelect.addEventListener('change', () => {
  const value = modelSelect.value;
  vscodeApi.postMessage({ type: 'select-model', model: value });
});

autoApply.addEventListener('change', () => {
  vscodeApi.postMessage({ type: 'toggle-auto-apply', enabled: autoApply.checked });
});

window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'auth-state': {
      const loggedIn = !!msg.loggedIn;
      loginBtn.style.display = loggedIn ? 'none' : 'inline-flex';
      logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';
      break;
    }
    case 'chat:user': {
      addMessage('user', msg.text);
      break;
    }
    case 'chat:assistant': {
      addMessage('assistant', msg.text);
      break;
    }
    case 'plan': {
      addPlan(msg.plan);
      break;
    }
    case 'plan:await-approval': {
      // no-op; plan card renders accept/reject
      break;
    }
    case 'attachment': {
      addMessage('system', `Attached: ${msg.attachment.filePath}`);
      break;
    }
    case 'model': {
      modelSelect.value = msg.model;
      break;
    }
    case 'auto-apply': {
      autoApply.checked = !!msg.enabled;
      break;
    }
    case 'focus-input': {
      inputEl.focus();
      break;
    }
  }
});

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

vscodeApi.postMessage({ type: 'ready' });