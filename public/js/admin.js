/* Shelf — admin / librarian page */

/* ---------- Navigation ---------- */
const views = { dashboard: renderDashboard, books: renderBooks, members: renderMembers, loans: renderLoans, users: renderUsers };
const titles = { dashboard: 'Dashboard', books: 'Books', members: 'Members', loans: 'Loans', users: 'Users' };

function navigate(name) {
  state.view = name;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#view-title').textContent = titles[name];
  $('#view-actions').innerHTML = '';
  $('#view').onclick = null;
  $('#view').innerHTML = '<p class="muted">Loading…</p>';
  views[name]().catch((err) => {
    $('#view').innerHTML = `<p class="error">${esc(err.message)}</p>`;
  });
}
$('#nav').onclick = (e) => { const b = e.target.closest('button[data-view]'); if (b) navigate(b.dataset.view); };


/* ---------- Dashboard ---------- */
async function renderDashboard() {
  const [s, loans] = await Promise.all([api('/stats'), api('/loans?status=issued')]);
  const due = loans.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 6);
  $('#view').innerHTML = `
    <div class="stats">
      <div class="stat"><b>${s.titles}</b><span>Book titles</span></div>
      <div class="stat"><b>${s.availableCopies} / ${s.totalCopies}</b><span>Copies on the shelf</span></div>
      <div class="stat"><b>${s.members}</b><span>Members</span></div>
      <div class="stat gold"><b>${s.activeLoans}</b><span>Books on loan</span></div>
      <div class="stat warn"><b>${s.overdueLoans}</b><span>Overdue</span></div>
      <div class="stat"><b>${money(s.finesCollected)}</b><span>Fines collected</span></div>
    </div>
    <h3 class="section-title">Due soonest</h3>
    <div class="table-wrap">${due.length ? `
      <table><thead><tr><th>Book</th><th>Member</th><th>Due</th><th>Status</th></tr></thead><tbody>
      ${due.map((l) => `<tr>
        <td>${esc(l.book?.title)}<span class="sub">${esc(l.book?.author)}</span></td>
        <td>${esc(l.member?.name)}<span class="sub">${esc(l.member?.membershipId)}</span></td>
        <td>${fmtDate(l.dueDate)}</td>
        <td>${l.isOverdue ? `<span class="badge bad">${l.overdueDays}d overdue</span>` : '<span class="badge ok">On time</span>'}</td>
      </tr>`).join('')}</tbody></table>` : '<div class="empty">No books are on loan right now.</div>'}
    </div>`;
}

/* ---------- Books ---------- */
async function renderBooks() {
  $('#view-actions').innerHTML = '<button class="btn primary" id="add-book">Add book</button>';
  $('#add-book').onclick = () => bookForm();
  $('#view').innerHTML = `
    <div class="toolbar">
      <div class="search"><input id="book-q" type="search" placeholder="Search title, author, ISBN or category" aria-label="Search books" /></div>
      <div class="filters"><select id="book-avail" aria-label="Availability"><option value="">All books</option><option value="true">Available now</option></select></div>
    </div>
    <div id="book-list"></div>`;
  const load = async () => {
    const params = new URLSearchParams({ q: $('#book-q').value, available: $('#book-avail').value });
    const books = await api('/books?' + params);
    $('#book-list').innerHTML = `<div class="table-wrap">${books.length ? `
      <table><thead><tr><th>Title</th><th>ISBN</th><th>Category</th><th>Copies</th><th></th></tr></thead><tbody>
      ${books.map((b) => `<tr>
        <td>${esc(b.title)}<span class="sub">${esc(b.author)}${b.year ? ', ' + esc(b.year) : ''}</span></td>
        <td>${esc(b.isbn)}</td>
        <td>${esc(b.category)}</td>
        <td><span class="badge ${b.availableCopies ? 'ok' : 'bad'}">${b.availableCopies} of ${b.totalCopies} in</span></td>
        <td class="row-actions">
          <button class="btn small" data-edit="${b._id}">Edit</button>
          <button class="btn small danger" data-del="${b._id}">Delete</button>
        </td></tr>`).join('')}</tbody></table>` : '<div class="empty">No books match. Add a book to start your catalogue.</div>'}</div>`;
    $('#book-list').onclick = async (e) => {
      const edit = e.target.closest('[data-edit]'); const del = e.target.closest('[data-del]');
      if (edit) bookForm(books.find((b) => b._id === edit.dataset.edit));
      if (del && confirm('Delete this book?')) {
        try { await api('/books/' + del.dataset.del, { method: 'DELETE' }); toast('Book deleted'); load(); }
        catch (err) { toast(err.message, true); }
      }
    };
  };
  $('#book-q').oninput = debounce(load);
  $('#book-avail').onchange = load;
  await load();
  window._reloadBooks = load;
}

function bookForm(book) {
  const b = book || {};
  openModal({
    title: book ? 'Edit book' : 'Add book',
    submitLabel: book ? 'Save changes' : 'Add book',
    bodyHtml: `
      <label>Title<input name="title" required value="${esc(b.title)}" /></label>
      <label>Author<input name="author" required value="${esc(b.author)}" /></label>
      <div class="grid-2">
        <label>ISBN<input name="isbn" required value="${esc(b.isbn)}" /></label>
        <label>Category<input name="category" value="${esc(b.category || 'General')}" /></label>
      </div>
      <div class="grid-2">
        <label>Publisher<input name="publisher" value="${esc(b.publisher)}" /></label>
        <label>Year<input name="year" type="number" value="${esc(b.year)}" /></label>
      </div>
      <label>Total copies<input name="totalCopies" type="number" min="1" required value="${esc(b.totalCopies || 1)}" /></label>`,
    onSubmit: async (data) => {
      await api(book ? '/books/' + book._id : '/books', { method: book ? 'PUT' : 'POST', body: data });
      toast(book ? 'Book updated' : 'Book added');
      navigate('books');
    },
  });
}

/* ---------- Members ---------- */
async function renderMembers() {
  $('#view-actions').innerHTML = '<button class="btn primary" id="add-member">Add member</button>';
  $('#add-member').onclick = () => memberForm();
  $('#view').innerHTML = `
    <div class="toolbar"><div class="search"><input id="member-q" type="search" placeholder="Search name, email or member ID" aria-label="Search members" /></div></div>
    <div id="member-list"></div>`;
  const load = async () => {
    const members = await api('/members?q=' + encodeURIComponent($('#member-q').value));
    $('#member-list').innerHTML = `<div class="table-wrap">${members.length ? `
      <table><thead><tr><th>Member</th><th>Contact</th><th>Status</th><th>On loan</th><th></th></tr></thead><tbody>
      ${members.map((m) => `<tr>
        <td>${esc(m.name)}<span class="sub">${esc(m.membershipId)}</span></td>
        <td>${esc(m.email)}<span class="sub">${esc(m.phone)}</span></td>
        <td><span class="badge ${m.status === 'active' ? 'ok' : 'warn'}">${esc(m.status)}</span></td>
        <td>${m.activeLoans}</td>
        <td class="row-actions">
          <button class="btn small" data-edit="${m._id}">Edit</button>
          <button class="btn small danger" data-del="${m._id}">Delete</button>
        </td></tr>`).join('')}</tbody></table>` : '<div class="empty">No members found. Add a member to start issuing books.</div>'}</div>`;
    $('#member-list').onclick = async (e) => {
      const edit = e.target.closest('[data-edit]'); const del = e.target.closest('[data-del]');
      if (edit) memberForm(members.find((m) => m._id === edit.dataset.edit));
      if (del && confirm('Delete this member?')) {
        try { await api('/members/' + del.dataset.del, { method: 'DELETE' }); toast('Member deleted'); load(); }
        catch (err) { toast(err.message, true); }
      }
    };
  };
  $('#member-q').oninput = debounce(load);
  await load();
}

function memberForm(member) {
  const m = member || {};
  openModal({
    title: member ? 'Edit member' : 'Add member',
    submitLabel: member ? 'Save changes' : 'Add member',
    bodyHtml: `
      <label>Full name<input name="name" required value="${esc(m.name)}" /></label>
      <label>Email<input name="email" type="email" required value="${esc(m.email)}" /></label>
      <div class="grid-2">
        <label>Phone<input name="phone" value="${esc(m.phone)}" /></label>
        <label>Status<select name="status">
          <option value="active" ${m.status !== 'suspended' ? 'selected' : ''}>Active</option>
          <option value="suspended" ${m.status === 'suspended' ? 'selected' : ''}>Suspended</option>
        </select></label>
      </div>`,
    onSubmit: async (data) => {
      await api(member ? '/members/' + member._id : '/members', { method: member ? 'PUT' : 'POST', body: data });
      toast(member ? 'Member updated' : 'Member added');
      navigate('members');
    },
  });
}

/* ---------- Loans ---------- */
let loanFilter = 'issued';
async function renderLoans() {
  $('#view-actions').innerHTML = '<button class="btn primary" id="issue-book">Issue book</button>';
  $('#issue-book').onclick = issueForm;
  $('#view').innerHTML = `
    <div class="toolbar"><div class="filters"><select id="loan-filter" aria-label="Filter loans">
      <option value="issued">On loan</option><option value="overdue">Overdue</option>
      <option value="returned">Returned</option><option value="">All loans</option>
    </select></div></div>
    <div id="loan-list"></div>`;
  $('#loan-filter').value = loanFilter;
  const load = async () => {
    loanFilter = $('#loan-filter').value;
    const loans = await api('/loans' + (loanFilter ? '?status=' + loanFilter : ''));
    $('#loan-list').innerHTML = `<div class="table-wrap">${loans.length ? `
      <table><thead><tr><th>Book</th><th>Member</th><th>Issued</th><th>Due</th><th>Fine</th><th>Status</th><th></th></tr></thead><tbody>
      ${loans.map((l) => `<tr>
        <td>${esc(l.book?.title || 'Deleted book')}</td>
        <td>${esc(l.member?.name || 'Deleted member')}<span class="sub">${esc(l.member?.membershipId)}</span></td>
        <td>${fmtDate(l.issueDate)}</td>
        <td>${fmtDate(l.dueDate)}</td>
        <td>${Number(l.fine) > 0 ? money(l.fine) : '—'}</td>
        <td>${l.status === 'returned' ? `<span class="badge">Returned ${fmtDate(l.returnDate)}</span>`
          : l.isOverdue ? `<span class="badge bad">${l.overdueDays}d overdue</span>` : '<span class="badge ok">On loan</span>'}</td>
        <td class="row-actions">${l.status === 'issued' ? `<button class="btn small" data-return="${l._id}">Return</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>` : '<div class="empty">No loans here. Issue a book to a member to create one.</div>'}</div>`;
    $('#loan-list').onclick = async (e) => {
      const r = e.target.closest('[data-return]');
      if (!r) return;
      try {
        const loan = await api(`/loans/${r.dataset.return}/return`, { method: 'POST' });
        toast(loan.fine > 0 ? `Returned. Fine due: ${money(loan.fine)}` : 'Book returned');
        load();
      } catch (err) { toast(err.message, true); }
    };
  };
  $('#loan-filter').onchange = load;
  await load();
}

async function issueForm() {
  let books, members;
  try {
    [books, members] = await Promise.all([api('/books?available=true'), api('/members')]);
  } catch (err) { return toast(err.message, true); }
  members = members.filter((m) => m.status === 'active');
  if (!books.length || !members.length) {
    return toast(!books.length ? 'No books are available to issue' : 'Add an active member first', true);
  }
  openModal({
    title: 'Issue book',
    submitLabel: 'Issue book',
    bodyHtml: `
      <label>Book<select name="bookId" required>${books.map((b) => `<option value="${b._id}">${esc(b.title)} (${b.availableCopies} in)</option>`).join('')}</select></label>
      <label>Member<select name="memberId" required>${members.map((m) => `<option value="${m._id}">${esc(m.name)} — ${esc(m.membershipId)}</option>`).join('')}</select></label>
      <label>Loan period (days)<input name="days" type="number" min="1" max="90" value="14" /></label>`,
    onSubmit: async (data) => {
      await api('/loans/issue', { method: 'POST', body: data });
      toast('Book issued');
      navigate('loans');
    },
  });
}


/* ---------- Users (admin only) ---------- */
async function renderUsers() {
  $('#view-actions').innerHTML = '<button class="btn primary" id="add-staff">Add staff</button>';
  $('#add-staff').onclick = staffForm;
  const users = await api('/users');
  const roleBadge = (r) => `<span class="badge ${r === 'admin' ? 'bad' : r === 'librarian' ? 'warn' : ''}">${esc(r)}</span>`;
  $('#view').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Role</th><th>Sign in with</th><th>Joined</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr>
      <td>${esc(u.name)}<span class="sub">${esc(u.email)}</span></td>
      <td>${roleBadge(u.role)}</td>
      <td>${esc(u.signIn)}</td>
      <td>${fmtDate(u.createdAt)}</td>
      <td class="row-actions">${u._id === state.user.id ? '<span class="muted">You</span>' : `
        <button class="btn small" data-role="${u._id}">Change role</button>
        <button class="btn small danger" data-del="${u._id}">Delete</button>`}</td>
    </tr>`).join('')}</tbody></table></div>`;

  $('#view').onclick = async (e) => {
    const r = e.target.closest('[data-role]'); const d = e.target.closest('[data-del]');
    if (r) {
      const u = users.find((x) => x._id === r.dataset.role);
      openModal({
        title: 'Change role',
        submitLabel: 'Save role',
        bodyHtml: `<p class="muted">${esc(u.name)} (${esc(u.email)})</p>
          <label>Role<select name="role">${['student', 'librarian', 'admin'].map((x) => `<option value="${x}" ${x === u.role ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`,
        onSubmit: async (data) => { await api('/users/' + u._id, { method: 'PUT', body: data }); toast('Role updated'); navigate('users'); },
      });
    }
    if (d && confirm('Delete this account?')) {
      try { await api('/users/' + d.dataset.del, { method: 'DELETE' }); toast('Account deleted'); navigate('users'); }
      catch (err) { toast(err.message, true); }
    }
  };
}

function staffForm() {
  openModal({
    title: 'Add staff',
    submitLabel: 'Add staff',
    bodyHtml: `
      <label>Full name<input name="name" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <div class="grid-2">
        <label>Temporary password<input name="password" type="password" minlength="6" required autocomplete="new-password" /></label>
        <label>Role<select name="role"><option value="librarian">Librarian</option><option value="admin">Admin</option></select></label>
      </div>`,
    onSubmit: async (data) => { await api('/users', { method: 'POST', body: data }); toast('Staff added'); navigate('users'); },
  });
}

/* ---------- Boot ---------- */
if (!state.token || !state.user) {
  location.replace('/');
} else if (state.user.role === 'student') {
  location.replace('/student.html');
} else {
  $('#user-name').textContent = state.user.name;
  $('#user-role').textContent = state.user.role;
  $('#nav-users').hidden = state.user.role !== 'admin';
  $('#logout').onclick = logout;
  $('#change-password').onclick = changePasswordForm;
  navigate('dashboard');
}
