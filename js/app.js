/* التطبيق الرئيسي: الدخول، لوحة المعلومات، الاستعلام، التفاصيل، التحرير، التقارير، المستخدمون */
(async function () {
  const { sb, esc, fmtDate, safeUrl, WORK_COLS, STORAGE_COLS, TAPE_COLS, ROLES } = L;
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  let me = null, opts = {}, filters = {}, page = 0;
  const PAGE = 25;
  const canEdit = () => me && ['admin', 'editor'].includes(me.role);
  const isAdmin = () => me && me.role === 'admin';
  const toast = (t) => { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (e.style.display = 'none'), 3000); };
  const fail = (e) => { console.error(e); toast('حدث خطأ: ' + (e.message || e)); };
  const busy = (t = 'جارٍ التحميل…') => (view.innerHTML = `<div class="spin">${t}</div>`);
  const badge = Reports.badge;

  // ---------- الدخول والصلاحية ----------
  if (!L.configured) { location.replace('index.html'); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.replace('index.html'); return; }
  const { data: prof, error: pe } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (pe || !prof || !prof.is_active) { await sb.auth.signOut(); location.replace('index.html?e=noaccess'); return; }
  me = prof;
  $('#lg').src = L.CFG.LOGO_URL || 'assets/logo.svg'; $('#org').textContent = L.CFG.ORG_NAME || '';
  $('#who').textContent = me.full_name || me.email || ''; $('#rl').textContent = ROLES[me.role];
  $('#out').onclick = async () => { await sb.auth.signOut(); location.replace('index.html'); };
  $('#nav').innerHTML = [['#/', 'لوحة المعلومات'], ['#/works', 'الأعمال والاستعلام'], ['#/reports', 'التقارير'], ...(canEdit() ? [['#/new', 'إضافة عمل']] : []), ...(isAdmin() ? [['#/users', 'المستخدمون']] : [])]
    .map(([h, t]) => `<a href="${h}">${t}</a>`).join('');
  try { const r = await sb.rpc('filter_options'); opts = r.data || {}; } catch (e) { /* ignore */ }

  // ---------- نموذج الفلاتر المشترك ----------
  const sel = (id, label, list) => `<div><label>${label}</label><select id="${id}"><option value="">الكل</option>${(list || []).map((v) => `<option ${filters[id.slice(2)] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`;
  const txt = (id, label) => `<div><label>${label}</label><input id="${id}" value="${esc(filters[id.slice(2)] || '')}"></div>`;
  function filterForm() {
    return `<div class="fgrid">${txt('f_q', 'بحث عام (عمل / مخرج / بطل / شركة)')}${txt('f_title', 'اسم العمل')}${txt('f_director', 'المخرج')}${txt('f_cast', 'الأبطال')}${txt('f_company', 'شركة الإنتاج')}
      ${sel('f_genre', 'نوع العمل', opts.genre)}${sel('f_color', 'اللون', opts.color)}${sel('f_rights_status', 'حق الاستغلال', opts.rights_status)}
      ${sel('f_exploitation_type', 'نوع الاستغلال', opts.exploitation_type)}${sel('f_broadcast_right', 'حق البث', opts.broadcast_right)}
      ${sel('f_show_status', 'صلاحية العرض', opts.show_status)}${sel('f_engineering_validity', 'الصلاحية الهندسية', opts.engineering_validity)}
      ${sel('f_correction_status', 'التصحيح', opts.correction_status)}
      <div><label>سنة الإنتاج من</label><input id="f_year_from" type="number" value="${esc(filters.year_from || '')}"></div>
      <div><label>إلى</label><input id="f_year_to" type="number" value="${esc(filters.year_to || '')}"></div></div>`;
  }
  function readFilters() {
    filters = {};
    view.querySelectorAll('[id^="f_"]').forEach((e) => { if (e.value) filters[e.id.slice(2)] = e.value.trim(); });
    return filters;
  }

  // ---------- لوحة المعلومات ----------
  async function dashboard() {
    busy();
    const { data, error } = await sb.rpc('dashboard_stats'); if (error) return fail(error);
    const bars = (t, arr) => { const mx = Math.max(1, ...arr.map((x) => x.n)); return `<div class="card bars"><h4>${t}</h4>${arr.map((x) => `<div class="row"><span>${esc(x.k)}</span><div class="tr"><div class="fl" style="width:${(x.n / mx) * 100}%"></div></div><b>${x.n}</b></div>`).join('')}</div>`; };
    view.innerHTML = `<h2 class="pt">لوحة المعلومات</h2>
      <div class="grid g4"><div class="stat"><b>${data.works}</b><span>عدد الأعمال</span></div><div class="stat"><b>${data.tapes}</b><span>عدد الأشرطة</span></div>
      <div class="stat"><b>${(data.rights.find((x) => x.k === 'سارى') || { n: 0 }).n}</b><span>أعمال حق استغلالها ساري</span></div>
      <div class="stat"><b>${(data.rights.find((x) => x.k === 'منتهى') || { n: 0 }).n}</b><span>أعمال حق استغلالها منتهٍ</span></div></div><br>
      <div class="grid g3">${bars('حق الاستغلال', data.rights)}${bars('اللون', data.color)}${bars('صلاحية العرض', data.show)}${bars('أكثر أنواع الأعمال', data.genre)}</div>`;
  }

  // ---------- الأعمال والاستعلام ----------
  async function works() {
    view.innerHTML = `<h2 class="pt">الأعمال والاستعلام</h2><div class="card">${filterForm()}
      <div class="actions"><button class="btn gold" id="go">بحث</button><button class="btn ghost" id="clr">مسح</button><span class="grow"></span>
      <button class="btn ghost" id="x1">قائمة الأسماء PDF</button><button class="btn ghost" id="x2">Excel للنتائج</button></div></div><div id="res"></div>`;
    $('#go').onclick = () => { readFilters(); page = 0; runSearch(); };
    $('#clr').onclick = () => { filters = {}; page = 0; works(); };
    view.querySelectorAll('.fgrid input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#go').click(); }));
    $('#x1').onclick = () => { readFilters(); runReport('names', 'print'); };
    $('#x2').onclick = () => { readFilters(); runReport('detail', 'excel'); };
    runSearch();
  }
  async function runSearch() {
    const box = $('#res'); box.innerHTML = '<div class="spin">جارٍ البحث…</div>';
    let q = sb.from('works').select('code,title,genre,color,director,cast_members,production_year,rights_status,poster_url', { count: 'exact' });
    q = L.applyFilters(q, filters).order('title').order('code').range(page * PAGE, page * PAGE + PAGE - 1);
    const { data, error, count } = await q; if (error) { box.innerHTML = ''; return fail(error); }
    const pages = Math.max(1, Math.ceil(count / PAGE));
    box.innerHTML = `<div class="muted" style="margin-bottom:6px">عدد النتائج: <b>${count}</b></div><div class="tw"><table class="t"><thead><tr><th></th><th>كود</th><th>العمل</th><th>النوع</th><th>الإخراج</th><th>الأبطال</th><th>السنة</th><th>اللون</th><th>حق الاستغلال</th></tr></thead><tbody>
      ${data.map((w) => `<tr><td style="width:50px">${Reports.img(w.poster_url, 'thumb', w.title)}</td><td>${w.code}</td><td><a href="#/work/${w.code}"><b>${esc(w.title)}</b></a></td><td>${esc(w.genre || '')}</td><td>${esc(w.director || '')}</td>
      <td style="max-width:320px;font-size:13px">${esc(w.cast_members || '')}</td><td>${w.production_year || ''}</td><td>${esc(w.color || '')}</td><td>${badge(w.rights_status)}</td></tr>`).join('') || '<tr><td colspan="9" class="spin">لا توجد نتائج</td></tr>'}</tbody></table></div>
      <div class="pager"><button class="btn sm" id="pv" ${page === 0 ? 'disabled' : ''}>السابق</button><span>صفحة ${page + 1} من ${pages}</span><button class="btn sm" id="nx" ${page + 1 >= pages ? 'disabled' : ''}>التالي</button></div>`;
    $('#pv').onclick = () => { page--; runSearch(); }; $('#nx').onclick = () => { page++; runSearch(); };
  }

  // ---------- تفاصيل عمل ----------
  async function workView(code) {
    busy();
    const { data: w, error } = await sb.from('works').select('*, tapes(*)').eq('code', code).maybeSingle();
    if (error) return fail(error); if (!w) { view.innerHTML = '<div class="card">العمل غير موجود</div>'; return; }
    w.tapes.sort((a, b) => a.id - b.id);
    const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    const v = (x) => (x === null || x === '' || x === undefined ? '—' : esc(x));
    view.innerHTML = `<div class="actions" style="margin:0 0 12px"><a href="#/works">← رجوع</a><span class="grow"></span>
      <button class="btn gold" id="st">بيان حالة (PDF)</button>${canEdit() ? `<a class="btn" href="#/edit/${w.code}">تعديل</a>` : ''}${isAdmin() ? '<button class="btn red" id="del">حذف</button>' : ''}</div>
      <div class="card detail"><div>${Reports.img(w.poster_url, 'poster', w.title)}<div style="height:10px"></div>${Reports.img(w.cast_photo_url, 'cast', 'صورة الأبطال')}</div>
      <div><h2 class="pt">${esc(w.title)} ${badge(w.rights_status)}</h2><div class="kvs">
      ${kv('كود العمل', w.code)}${kv('نوع العمل', v(w.genre))}${kv('سنة الإنتاج', v(w.production_year))}${kv('اللون', v(w.color))}${kv('الإخراج', v(w.director))}${kv('التأليف', v(w.author))}
      ${kv('شركة الإنتاج', v(w.production_company))}${kv('نوع الاستغلال', v(w.exploitation_type))}${kv('حق البث', v(w.broadcast_right))}${kv('مدة التعاقد', v(w.contract_duration))}
      ${kv('بداية الاستغلال التلفزيوني', fmtDate(w.tv_start))}${kv('نهاية الاستغلال التلفزيوني', fmtDate(w.tv_end))}${kv('بداية الاستغلال الفضائي', fmtDate(w.sat_start))}${kv('نهاية الاستغلال الفضائي', fmtDate(w.sat_end))}
      ${kv('رقم الصلاحية', v(w.validity_no))}${kv('تاريخ الصلاحية', fmtDate(w.validity_date))}${kv('صلاحية العرض', v(w.show_status))}${kv('الصلاحية الهندسية', v(w.engineering_validity))}
      ${kv('التصحيح', v(w.correction_status))}${kv('التقييم', v(w.rating))}${kv('المدة', v(w.duration_min))}${kv('الترجمة', w.has_translation ? 'نعم' : 'لا')}${kv('حظر البطل', w.hero_ban ? 'نعم' : 'لا')}
      ${kv('أماكن الحفظ', esc(STORAGE_COLS.filter(([k]) => w[k]).map(([, l]) => l).join(' ، ') || '—'))}</div>
      <div class="kv" style="margin-top:8px"><span class="k">الأبطال</span><span class="v">${v(w.cast_members)}</span></div>
      <div class="kv"><span class="k">القصة</span><span class="v" style="font-weight:400">${v(w.story)}</span></div><div class="kv"><span class="k">ملاحظات</span><span class="v" style="font-weight:400">${v(w.notes)}</span></div></div></div>
      <div class="card"><h3 style="margin-top:0">الأشرطة (${w.tapes.length})</h3><div class="tw"><table class="t"><thead><tr>${TAPE_COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>
      ${w.tapes.map((t) => `<tr>${TAPE_COLS.map(([k]) => `<td>${v(t[k])}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="5">لا توجد أشرطة</td></tr>'}</tbody></table></div></div>`;
    $('#st').onclick = () => Reports.openOverlay('بيان حالة: ' + w.title, Reports.statusReport([w], {}), () => Reports.excelStatus([w]));
    if (isAdmin()) $('#del').onclick = async () => {
      if (!confirm(`حذف العمل «${w.title}» وكل أشرطته نهائياً؟`)) return;
      const { error: e } = await sb.from('works').delete().eq('code', w.code); if (e) return fail(e); toast('تم الحذف'); location.hash = '#/works';
    };
  }

  // ---------- إضافة / تعديل ----------
  async function editView(code) {
    if (!canEdit()) { view.innerHTML = '<div class="card">ليست لديك صلاحية التعديل.</div>'; return; }
    busy();
    let w = { has_translation: false, hero_ban: false, tapes: [] };
    if (code) { const r = await sb.from('works').select('*, tapes(*)').eq('code', code).maybeSingle(); if (r.error || !r.data) return fail(r.error || 'غير موجود'); w = r.data; w.tapes.sort((a, b) => a.id - b.id); }
    else { const r = await sb.from('works').select('code').order('code', { ascending: false }).limit(1); w.code = ((r.data && r.data[0] && r.data[0].code) || 0) + 1; }
    const input = ([k, l, t]) => {
      const x = w[k] ?? '';
      if (t === 'bool') return `<div class="chk"><label><input type="checkbox" data-k="${k}" ${w[k] ? 'checked' : ''}> ${l}</label></div>`;
      if (t === 'area') return `<div style="grid-column:1/-1"><label>${l}</label><textarea data-k="${k}" rows="${k === 'cast_members' ? 2 : 3}">${esc(x)}</textarea></div>`;
      const list = t === 'cat' && opts[k] ? `list="dl_${k}"` : '';
      const dl = list ? `<datalist id="dl_${k}">${opts[k].map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
      const type = t === 'int' ? 'number' : t === 'date' ? 'date' : t === 'url' ? 'url' : 'text';
      return `<div ${t === 'url' ? 'style="grid-column:1/-1"' : ''}><label>${l}${k === 'title' ? ' *' : ''}</label><input data-k="${k}" type="${type}" ${list} value="${esc(x)}" ${k === 'code' && code ? 'readonly' : ''} ${t === 'url' ? 'dir="ltr" placeholder="https://..."' : ''}>${dl}</div>`;
    };
    const tapeRow = (t = {}) => `<div class="r" data-id="${t.id || ''}">${TAPE_COLS.map(([k, l]) => `<input data-t="${k}" placeholder="${l}" value="${esc(t[k] ?? '')}">`).join('')}<button type="button" class="btn red sm" onclick="this.parentNode.remove()">حذف</button></div>`;
    view.innerHTML = `<h2 class="pt">${code ? 'تعديل: ' + esc(w.title) : 'إضافة عمل جديد'}</h2><form id="ef">
      <div class="card"><div class="fgrid">${WORK_COLS.filter((c) => c[2] !== 'bool').map(input).join('')}</div><br>
      <div class="chk">${WORK_COLS.filter((c) => c[2] === 'bool').map(input).join('')}</div><br><label>أماكن الحفظ</label>
      <div class="chk">${STORAGE_COLS.map(([k, l]) => `<label><input type="checkbox" data-k="${k}" ${w[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
      <div class="card tapes-ed"><h3 style="margin-top:0">الأشرطة</h3><div id="tp">${w.tapes.map(tapeRow).join('')}</div><button type="button" class="btn ghost sm" id="addt">+ إضافة شريط</button></div>
      <div class="actions"><button class="btn gold" id="sv">حفظ</button><a class="btn ghost" href="${code ? '#/work/' + code : '#/works'}">إلغاء</a></div></form>`;
    $('#addt').onclick = () => $('#tp').insertAdjacentHTML('beforeend', tapeRow());
    $('#ef').onsubmit = async (e) => {
      e.preventDefault(); $('#sv').disabled = true;
      try {
        const row = {};
        view.querySelectorAll('[data-k]').forEach((el) => {
          const k = el.dataset.k;
          if (el.type === 'checkbox') row[k] = el.checked;
          else { let v = el.value.trim(); const t = (WORK_COLS.find((c) => c[0] === k) || [])[2]; row[k] = v === '' ? null : (t === 'int' ? Number(v) : v); }
        });
        if (row.poster_url && !safeUrl(row.poster_url)) throw new Error('رابط البوستر يجب أن يبدأ بـ http أو https');
        if (row.cast_photo_url && !safeUrl(row.cast_photo_url)) throw new Error('رابط صورة الأبطال يجب أن يبدأ بـ http أو https');
        if (!row.title) throw new Error('اسم العمل مطلوب');
        if (row.duration_min !== null && row.duration_min !== undefined && isNaN(Number(row.duration_min))) throw new Error('المدة يجب أن تكون رقماً');
        const r = code ? await sb.from('works').update(row).eq('code', code) : await sb.from('works').insert(row);
        if (r.error) throw r.error;
        const wc = row.code;
        const rows = [...view.querySelectorAll('#tp .r')].map((d) => ({ id: d.dataset.id, o: Object.fromEntries([...d.querySelectorAll('[data-t]')].map((i) => [i.dataset.t, i.value.trim() || null])) }))
          .filter((x) => Object.values(x.o).some(Boolean));
        const keep = new Set(rows.filter((x) => x.id).map((x) => +x.id));
        const gone = (w.tapes || []).filter((t) => !keep.has(t.id)).map((t) => t.id);
        if (gone.length) { const d = await sb.from('tapes').delete().in('id', gone); if (d.error) throw d.error; }
        for (const x of rows.filter((x) => x.id)) { const u = await sb.from('tapes').update(x.o).eq('id', +x.id); if (u.error) throw u.error; }
        const ins = rows.filter((x) => !x.id).map((x) => ({ ...x.o, work_code: wc }));
        if (ins.length) { const i = await sb.from('tapes').insert(ins); if (i.error) throw i.error; }
        toast('تم الحفظ'); location.hash = '#/work/' + wc;
      } catch (err) { fail(err); $('#sv').disabled = false; }
    };
  }

  // ---------- التقارير ----------
  const RT = { names: 'قائمة أسماء الأعمال', detail: 'التقرير التفصيلي', status: 'بيان حالة لكل عمل' };
  async function runReport(type, mode) {
    toast('جارٍ تجهيز التقرير…');
    try {
      const f = { ...filters };
      const ws = await L.fetchAllWorks(f, type === 'status', (n) => toast(`جارٍ التحميل… ${n}`));
      if (!ws.length) return toast('لا توجد أعمال مطابقة');
      if (type === 'status' && ws.length > 400 && mode !== 'excel' && !confirm(`سيتم إنشاء ${ws.length} ورقة. قد يستغرق ذلك وقتاً. متابعة؟`)) return;
      const posters = $('#withPosters') ? $('#withPosters').checked : false;
      const html = type === 'names' ? Reports.namesReport(ws, f) : type === 'detail' ? Reports.detailReport(ws, f, posters) : Reports.statusReport(ws, f);
      const xl = () => (type === 'names' ? Reports.excelNames : type === 'detail' ? Reports.excelDetail : Reports.excelStatus)(ws);
      if (mode === 'excel') xl(); else Reports.openOverlay(RT[type], html, xl, mode === 'print');
      $('#toast').style.display = 'none';
    } catch (e) { fail(e); }
  }
  function reports() {
    view.innerHTML = `<h2 class="pt">التقارير</h2><div class="card"><h3 style="margin-top:0">1) اختر التقرير</h3><div class="rtype">
      <label><input type="radio" name="rt" value="names" checked><b>قائمة أسماء الأعمال</b><small>3 أعمدة مرقمة — أسماء الأعمال فقط — بشعار الإدارة</small></label>
      <label><input type="radio" name="rt" value="detail"><b>التقرير التفصيلي</b><small>الأبطال، التأليف، الإخراج، اللون، حق الاستغلال</small></label>
      <label><input type="radio" name="rt" value="status"><b>بيان حالة لكل عمل</b><small>ورقة منفصلة لكل عمل (بوستر + صورة الأبطال + الأشرطة)</small></label></div>
      <label style="display:flex;gap:6px;align-items:center;color:var(--txt)"><input id="withPosters" type="checkbox" style="width:auto"> إظهار صورة البوستر في التقرير التفصيلي</label>
      <h3>2) حدّد الأعمال (اتركها فارغة لكل الأعمال)</h3>${filterForm()}
      <div class="actions"><button class="btn" id="r1">معاينة</button><button class="btn gold" id="r2">تصدير PDF</button><button class="btn gold" id="r3">تصدير Excel</button></div></div>`;
    const go = (m) => { readFilters(); runReport(view.querySelector('[name=rt]:checked').value, m); };
    $('#r1').onclick = () => go('view'); $('#r2').onclick = () => go('print'); $('#r3').onclick = () => go('excel');
  }

  // ---------- المستخدمون ----------
  async function users() {
    if (!isAdmin()) { view.innerHTML = '<div class="card">للمدير فقط.</div>'; return; }
    busy(); const { data, error } = await sb.from('profiles').select('*').order('created_at'); if (error) return fail(error);
    view.innerHTML = `<h2 class="pt">المستخدمون والصلاحيات</h2><div class="card muted">لإضافة مستخدم جديد: من لوحة Supabase ← Authentication ← Users ← Add user، ثم يظهر هنا لتحديد صلاحيته.</div>
      <div class="tw"><table class="t"><thead><tr><th>البريد</th><th>الاسم</th><th>الصلاحية</th><th>مفعّل</th><th></th></tr></thead><tbody>
      ${data.map((u) => `<tr data-id="${u.id}"><td dir="ltr" style="text-align:right">${esc(u.email)}</td><td><input class="uname" value="${esc(u.full_name || '')}"></td>
      <td><select class="rl" ${u.id === me.id ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><input type="checkbox" class="ac" style="width:auto" ${u.is_active ? 'checked' : ''} ${u.id === me.id ? 'disabled' : ''}></td><td><button class="btn sm">حفظ</button></td></tr>`).join('')}</tbody></table></div>
      <p class="muted">• مدير: كل شيء + المستخدمون + الحذف &nbsp; • محرر: إضافة وتعديل الأعمال &nbsp; • مشاهدة فقط: بحث وتقارير وتصدير.</p>`;
    view.querySelectorAll('tbody button').forEach((b) => (b.onclick = async () => {
      const tr = b.closest('tr'); const upd = { full_name: $(".uname", tr).value.trim() || null, role: $('.rl', tr).value, is_active: $('.ac', tr).checked };
      const { error: e } = await sb.from('profiles').update(upd).eq('id', tr.dataset.id); e ? fail(e) : toast('تم الحفظ');
    }));
  }

  // ---------- التوجيه ----------
  async function route() {
    Reports.closeOverlay();
    const h = location.hash || '#/'; const [, a, b] = h.split('/');
    document.querySelectorAll('#nav a').forEach((x) => x.classList.toggle('on', x.getAttribute('href') === (a === 'work' || a === 'edit' ? '#/works' : h)));
    try {
      if (!a) await dashboard();
      else if (a === 'works') await works();
      else if (a === 'work') await workView(+b);
      else if (a === 'edit') await editView(+b);
      else if (a === 'new') await editView(null);
      else if (a === 'reports') reports();
      else if (a === 'users') await users();
      else await dashboard();
    } catch (e) { fail(e); }
  }
  window.addEventListener('hashchange', route);
  route();
})();
