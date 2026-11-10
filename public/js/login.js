const errBox = $('#auth-error');
const showError = (m) => { errBox.textContent = m || ''; };

function setTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('#signin-form').hidden = name !== 'signin';
  $('#signup-form').hidden = name !== 'signup';
  showError('');
}
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => setTab(t.dataset.tab)));

async function finish(token, user) {
  saveSession(token, user);
  location.replace(homeFor(user.role));
}

$('#signin-form').onsubmit = async (e) => {
  e.preventDefault();
  showError('');
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    finish(token, user);
  } catch (err) { showError(err.message); }
};

$('#signup-form').onsubmit = async (e) => {
  e.preventDefault();
  showError('');
  const data = Object.fromEntries(new FormData(e.target));
  if (data.password !== data.confirm) return showError('Passwords do not match');
  try {
    const { token, user } = await api('/auth/register', { method: 'POST', body: { name: data.name, email: data.email, password: data.password } });
    finish(token, user);
  } catch (err) { showError(err.message); }
};

(async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('error')) {
    showError(params.get('error'));
    history.replaceState(null, '', location.pathname);
  }

  // Returning from Google: the token arrives in the URL fragment
  if (location.hash.startsWith('#token=')) {
    const token = decodeURIComponent(location.hash.slice(7));
    history.replaceState(null, '', location.pathname);
    state.token = token;
    try {
      const user = await api('/auth/me');
      return finish(token, user);
    } catch (err) {
      state.token = null;
      return showError(err.message);
    }
  }

  // Already signed in
  if (state.token && state.user) location.replace(homeFor(state.user.role));
})();
