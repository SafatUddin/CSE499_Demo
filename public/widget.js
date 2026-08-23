(function () {
  'use strict';

  var scriptEl = document.currentScript;
  var widgetKey = scriptEl && scriptEl.getAttribute('data-widget-key');
  if (!widgetKey) {
    console.error('[Remlin widget] Missing data-widget-key attribute on the script tag.');
    return;
  }

  var apiBase = new URL(scriptEl.src).origin;
  var VISITOR_ID_KEY = 'remlin_widget_visitor_id_' + widgetKey;
  var POLL_MS = 4000;

  function getVisitorId() {
    try {
      var existing = localStorage.getItem(VISITOR_ID_KEY);
      if (existing) return existing;
      var id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
      localStorage.setItem(VISITOR_ID_KEY, id);
      return id;
    } catch (e) {
      // localStorage unavailable (private browsing, etc) — fall back to a session-only id.
      return 'session-' + Math.random().toString(16).slice(2);
    }
  }

  var visitorId = getVisitorId();

  var style = document.createElement('style');
  style.textContent = [
    '.remlin-widget-bubble{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#111827;box-shadow:0 6px 24px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2147483000;border:none;transition:transform .15s ease;}',
    '.remlin-widget-bubble:hover{transform:scale(1.06);}',
    '.remlin-widget-bubble svg{width:26px;height:26px;fill:#fff;}',
    '.remlin-widget-panel{position:fixed;bottom:88px;right:20px;width:340px;max-width:calc(100vw - 32px);height:480px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.3);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
    '.remlin-widget-panel.open{display:flex;}',
    '.remlin-widget-header{background:#111827;color:#fff;padding:14px 16px;font-size:14px;font-weight:700;display:flex;justify-content:space-between;align-items:center;}',
    '.remlin-widget-close{cursor:pointer;background:none;border:none;color:#fff;opacity:.7;font-size:18px;line-height:1;}',
    '.remlin-widget-close:hover{opacity:1;}',
    '.remlin-widget-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f9fafb;}',
    '.remlin-widget-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4;word-wrap:break-word;}',
    '.remlin-widget-msg.customer{align-self:flex-end;background:#111827;color:#fff;border-bottom-right-radius:2px;}',
    '.remlin-widget-msg.agent{align-self:flex-start;background:#fff;color:#111827;border:1px solid #e5e7eb;border-bottom-left-radius:2px;}',
    '.remlin-widget-msg img{max-width:100%;border-radius:8px;margin-top:6px;display:block;}',
    '.remlin-widget-inputbar{display:flex;border-top:1px solid #e5e7eb;padding:8px;gap:6px;}',
    '.remlin-widget-inputbar input{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;font-size:13px;outline:none;}',
    '.remlin-widget-inputbar button{background:#111827;color:#fff;border:none;border-radius:10px;padding:0 14px;font-size:13px;font-weight:600;cursor:pointer;}',
    '.remlin-widget-inputbar button:disabled{opacity:.5;cursor:default;}',
  ].join('\n');
  document.head.appendChild(style);

  var bubble = document.createElement('button');
  bubble.className = 'remlin-widget-bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

  var panel = document.createElement('div');
  panel.className = 'remlin-widget-panel';
  panel.innerHTML =
    '<div class="remlin-widget-header"><span>Chat with us</span><button class="remlin-widget-close" aria-label="Close chat">&times;</button></div>' +
    '<div class="remlin-widget-messages"></div>' +
    '<div class="remlin-widget-inputbar"><input type="text" placeholder="Type a message…" maxlength="4000" /><button>Send</button></div>';

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  var messagesEl = panel.querySelector('.remlin-widget-messages');
  var inputEl = panel.querySelector('input');
  var sendBtn = panel.querySelector('.remlin-widget-inputbar button');
  var closeBtn = panel.querySelector('.remlin-widget-close');

  var isOpen = false;
  var isSending = false;
  var pollTimer = null;
  var lastRenderedCount = 0;

  function renderMessages(messages) {
    if (!messages || messages.length === lastRenderedCount) return;
    lastRenderedCount = messages.length;
    messagesEl.innerHTML = '';
    messages.forEach(function (m) {
      var bubbleEl = document.createElement('div');
      bubbleEl.className = 'remlin-widget-msg ' + (m.sender === 'customer' ? 'customer' : 'agent');
      var textNode = document.createElement('div');
      textNode.textContent = m.text;
      bubbleEl.appendChild(textNode);
      if (m.imageUrl) {
        var img = document.createElement('img');
        img.src = m.imageUrl;
        img.alt = '';
        bubbleEl.appendChild(img);
      }
      messagesEl.appendChild(bubbleEl);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function fetchMessages() {
    var url = apiBase + '/api/widget/messages?widgetKey=' + encodeURIComponent(widgetKey) + '&visitorId=' + encodeURIComponent(visitorId);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) { renderMessages(data.messages || []); })
      .catch(function () { /* transient network errors are silently retried on next poll */ });
  }

  function startPolling() {
    if (pollTimer) return;
    fetchMessages();
    pollTimer = setInterval(fetchMessages, POLL_MS);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || isSending) return;
    isSending = true;
    sendBtn.disabled = true;
    inputEl.value = '';

    fetch(apiBase + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey: widgetKey, visitorId: visitorId, text: text }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed');
        return r.json();
      })
      .then(function (data) {
        lastRenderedCount = -1; // force re-render even if the count happens to match
        renderMessages(data.messages || []);
      })
      .catch(function () {
        var errEl = document.createElement('div');
        errEl.className = 'remlin-widget-msg agent';
        errEl.textContent = "Sorry, that message couldn't be sent. Please try again.";
        messagesEl.appendChild(errEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      })
      .finally(function () {
        isSending = false;
        sendBtn.disabled = false;
      });
  }

  bubble.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      startPolling();
    } else {
      stopPolling();
    }
  });

  closeBtn.addEventListener('click', function () {
    isOpen = false;
    panel.classList.remove('open');
    stopPolling();
  });

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
