/* Shelf — student page: browse the catalogue and see my loans */
const views = { catalogue: renderCatalogue, loans: renderMyLoans };
const titles = { catalogue: 'Find books', loans: 'My loans' };
const COLORS = ['#0e7c7b', '#c98a1b', '#b3372f', '#2f5d8a', '#6b4e9b'];
const colorFor = (text = '') => COLORS[[...text].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

function navigate(name) {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#view-title').textContent = titles[name];
  $('#view').innerHTML = '<p class="muted">Loading…</p>';
  views[name]().catch((err) => { $('#view').innerHTML = `<p class="error">${esc(err.message)}</p>`; });
}
$('#nav').onclick = (e) => { const b = e.target.closest('button[data-view]'); if (b) navigate(b.dataset.view); };

/* ---------- Catalogue ---------- */
async function renderCatalogue() {
  $('#view').innerHTML = `
    <div class="toolbar">
      <div class="search"><input id="q" type="search" placeholder="Search title, author, ISBN or subject" aria-label="Search books" /></div>
      <div class="filters"><select id="avail" aria-label="Availability"><option value="">All books</option><option value="true">Available now</option></select></div>
    </div>
    <div id="results"></div>`;
  const load = async () => {
    const params = new URLSearchParams({ q: $('#q').value, available: $('#avail').value });
    const books = await api('/books?' + params);
    $('#results').innerHTML = books.length
      ? `<div class="books">${books.map((b) => `
          <article class="book-card" style="--c:${colorFor(b.category)}">
            <h3>${esc(b.title)}</h3>
            <p class="muted">${esc(b.author)}${b.year ? ', ' + esc(b.year) : ''}</p>
            <p class="meta">${esc(b.category)}</p>
            <span class="badge ${b.availableCopies ? 'ok' : 'bad'}">${b.availableCopies ? `${b.availableCopies} available` : 'All copies on loan'}</span>
          </article>`).join('')}</div>`
      : '<div class="empty table-wrap">No books match your search. Try a different title or author.</div>';
  };
  $('#q').oninput = debounce(() => load().catch((e) => toast(e.message, true)));
  $('#avail').onchange = () => load().catch((e) => toast(e.message, true));
  await load();
}

/* ---------- My loans ---------- */
async function renderMyLoans() {
  const [me, loans] = await Promise.all([api('/me'), api('/me/loans')]);
  const current = loans.filter((l) => l.status === 'issued');
  const history = loans.filter((l) => l.status === 'returned');
  const s = me.summary;

  $('#member-id').textContent = me.member?.membershipId || '';
  const notice = !me.member
    ? '<div class="notice">Your library membership isn’t set up yet. Visit the library desk to finish registration.</div>'
    : me.member.status === 'suspended'
      ? '<div class="notice bad">Your membership is suspended. Visit the library desk for help.</div>' : '';

  const table = (rows, returned) => rows.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Book</th><th>Borrowed</th><th>${returned ? 'Returned' : 'Due'}</th><th>Fine</th><th>Status</th></tr></thead><tbody>
      ${rows.map((l) => `<tr>
        <td>${esc(l.book?.title || 'Removed book')}<span class="sub">${esc(l.book?.author)}</span></td>
        <td>${fmtDate(l.issueDate)}</td>
        <td>${fmtDate(returned ? l.returnDate : l.dueDate)}</td>
        <td>${Number(l.fine) > 0 ? money(l.fine) : '—'}</td>
        <td>${returned ? '<span class="badge">Returned</span>' : l.isOverdue ? `<span class="badge bad">${l.overdueDays}d overdue</span>` : '<span class="badge ok">On time</span>'}</td>
      </tr>`).join('')}</tbody></table></div>` : '';

  $('#view').innerHTML = `
    ${notice}
    <div class="stats">
      <div class="stat gold"><b>${s.onLoan}</b><span>Books on loan</span></div>
      <div class="stat warn"><b>${s.overdue}</b><span>Overdue</span></div>
      <div class="stat"><b>${money(s.fineSoFar)}</b><span>Fine so far</span></div>
      <div class="stat"><b>${s.totalBorrowed}</b><span>Borrowed in total</span></div>
    </div>
    <h3 class="section-title">On loan now</h3>
    ${table(current, false) || '<div class="empty table-wrap">You have no books on loan. Find something to read in the catalogue.</div>'}
    ${history.length ? `<h3 class="section-title gap">History</h3>${table(history, true)}` : ''}`;
}

/* ---------- Boot ---------- */
if (!state.token || !state.user) {
  location.replace('/');
} else if (state.user.role !== 'student') {
  location.replace('/admin.html');
} else {
  $('#user-name').textContent = state.user.name;
  $('#logout').onclick = logout;
  $('#change-password').onclick = changePasswordForm;
  navigate('catalogue');
}
