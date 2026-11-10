/* Shared helpers used by every page */
const API = '/api';
const state = {
  token: localStorage.getItem('shelf_token'),
  user: JSON.parse(localStorage.getItem('shelf_user') || 'null'),
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const money = (n) => Number(n || 0).toFixed(2);
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const homeFor = (role) => (role === 'student' ? '/student.html' : '/admin.html');

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('shelf_token', token);
  localStorage.setItem('shelf_user', JSON.stringify(user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('shelf_token');
  localStorage.removeItem('shelf_user');
  location.href = '/';
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) { logout(); throw new Error(data.message || 'Please sign in'); }
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

/* Toast */
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2800);
}

/* Modal */
const modal = $('#modal');
function openModal({ title, bodyHtml, submitLabel = 'Save', onSubmit }) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-error').textContent = '';
  $('#modal-submit').textContent = submitLabel;
  const form = $('#modal-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#modal-submit');
    btn.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      modal.close();
    } catch (err) {
      $('#modal-error').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
  modal.showModal();
}
if (modal) $('#modal-cancel').onclick = () => modal.close();

function changePasswordForm() {
  openModal({
    title: 'Change password',
    submitLabel: 'Update password',
    bodyHtml: `
      <label>Current password <span class="muted">(leave blank if you sign in with Google)</span>
        <input name="currentPassword" type="password" autocomplete="current-password" /></label>
      <label>New password<input name="newPassword" type="password" minlength="6" required autocomplete="new-password" /></label>`,
    onSubmit: async (data) => {
      await api('/auth/password', { method: 'POST', body: data });
      toast('Password updated');
    },
  });
}
