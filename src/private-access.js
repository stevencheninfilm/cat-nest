const TOKEN_KEY = 'catnest.private.steven.session.v1';
let memoryToken = '';
export function accessToken() {
  try { return memoryToken || localStorage.getItem(TOKEN_KEY) || ''; } catch { return memoryToken; }
}
export function forgetAccess() {
  memoryToken = '';
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}
function remember(token) {
  memoryToken = token;
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export async function unlockSteven(apiBase) {
  const endpoint = `${apiBase.replace(/\/$/, '')}/api/access/steven`;
  async function request(options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 95000);
    try {
      const response = await fetch(endpoint, { ...options, signal:controller.signal });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error?.message || '暂时无法解锁，请稍后重试。'), { status:response.status });
      return data;
    } finally { clearTimeout(timeout); }
  }
  if (accessToken()) {
    try { await request({ headers:{ Authorization:`Bearer ${accessToken()}` } }); return; }
    catch (error) { if (error.status === 401) forgetAccess(); }
  }
  document.title = 'Steven · 私人小窝';
  const host = document.querySelector('#app');
  host.innerHTML = `<main class="private-entry"><form class="private-card"><span aria-hidden="true">🐾</span><p class="private-kicker">OUR PRIVATE HOME</p><h1>欢迎回到小窝</h1><p>输入访问密码，再和小猫见面。</p><label for="home-password">访问密码</label><input id="home-password" name="password" type="password" autocomplete="current-password" required maxlength="512" placeholder="仅你们两人知道的密码"/><button type="submit">解锁小窝</button><p class="private-message" role="status" aria-live="polite"></p></form></main>`;
  const form = host.querySelector('form'), input = form.querySelector('input'), button = form.querySelector('button'), message = form.querySelector('[role="status"]');
  await new Promise(resolve => {
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (button.disabled) return;
      button.disabled = true; message.textContent = '正在连接小窝…';
      try {
        const result = await request({ method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ password:input.value }) });
        remember(result.token); input.value = ''; resolve();
      } catch (error) {
        message.textContent = error.status === 401 ? '密码不正确，请重新输入。' : error.name === 'AbortError' ? '连接超时，请稍后重试。' : error.message;
        button.disabled = false;
      }
    });
  });
  host.replaceChildren();
}
