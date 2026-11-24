/* التقارير: قائمة الأسماء (3 أعمدة) + التقرير التفصيلي + بيان الحالة لكل عمل + التصدير */
(function () {
  const { esc, safeUrl, fmtDate, CFG, WORK_COLS, TAPE_COLS } = L;
  const today = () => new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const val = (v) => (v === null || v === undefined || v === '' ? '—' : esc(v));
  const yn = (b) => (b ? 'نعم' : 'لا');

  function header(title, sub) {
    return `<div class="rh">
      <img class="rh-logo" src="${esc(CFG.LOGO_URL || 'assets/logo.svg')}" alt="">
      <div class="rh-t"><div class="org">${esc(CFG.ORG_NAME || '')}</div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>
      <div class="rh-d">${today()}</div></div>`;
  }
  const img = (url, cls, alt) => {
    const u = safeUrl(url);
    return `<div class="pw ${cls}">${u ? `<img src="${esc(u)}" alt="${esc(alt)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : ''}</div>`;
  };
  const badge = (r) => `<span class="bd ${r === 'سارى' ? 'ok' : r === 'منتهى' ? 'bad' : 'na'}">${val(r)}</span>`;

  // ---------- 1) قائمة أسماء الأعمال: 3 أعمدة + ترقيم + شعار (الأسماء فقط) ----------
  const PER_COL = 36, PER_PAGE = PER_COL * 3;
  function namesReport(works, f) {
    const sub = `${L.describeFilters(f)} — عدد الأعمال: ${works.length}`;
    const pages = Math.max(1, Math.ceil(works.length / PER_PAGE));
    let html = '';
    for (let p = 0; p < pages; p++) {
      const slice = works.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
      let cols = '';
      for (let c = 0; c < 3; c++) {
        const part = slice.slice(c * PER_COL, (c + 1) * PER_COL);
        cols += `<div class="ncol">${part.map((w, i) => `<div class="nm"><span class="no">${p * PER_PAGE + c * PER_COL + i + 1}</span><span class="tx${w.title.length > 29 ? ' xs' : w.title.length > 24 ? ' sm' : ''}">${esc(w.title)}</span></div>`).join('')}</div>`;
      }
      html += `<section class="sheet">${header('قائمة الأعمال', sub)}<div class="ngrid">${cols}</div><div class="pgno">صفحة ${p + 1} من ${pages}</div></section>`;
    }
    return html;
  }

  // ---------- 2) التقرير التفصيلي ----------
  function detailReport(works, f, withPosters) {
    const sub = `${L.describeFilters(f)} — عدد الأعمال: ${works.length}`;
    const rows = works.map((w, i) => `<tr>
      <td class="c">${i + 1}</td>
      ${withPosters ? `<td class="c">${img(w.poster_url, 'thumb', w.title)}</td>` : ''}
      <td class="b">${esc(w.title)}</td><td>${val(w.cast_members)}</td><td>${val(w.author)}</td><td>${val(w.director)}</td>
      <td class="c">${val(w.color)}</td><td class="c">${badge(w.rights_status)}</td></tr>`).join('');
    return `<section class="sheet wide flow">${header('التقرير التفصيلي للأعمال', sub)}
      <table class="rt"><thead><tr><th>م</th>${withPosters ? '<th>البوستر</th>' : ''}<th>العمل</th><th>الأبطال</th><th>التأليف</th><th>الإخراج</th><th>اللون</th><th>حق الاستغلال</th></tr></thead>
      <tbody>${rows}</tbody></table></section>`;
  }

  // ---------- 3) بيان حالة لكل عمل (ورقة منفصلة لكل عمل) ----------
  const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  function statusReport(works, f) {
    const sub = `${L.describeFilters(f)} — عدد الأعمال: ${works.length}`;
    return works.map((w, i) => {
      const tapes = (w.tapes || []).map((t, j) => `<tr><td class="c">${j + 1}</td>${TAPE_COLS.map(([k]) => `<td class="c">${val(t[k])}</td>`).join('')}</tr>`).join('')
        || `<tr><td colspan="${TAPE_COLS.length + 1}" class="c">لا توجد أشرطة مسجلة</td></tr>`;
      const store = L.STORAGE_COLS.filter(([k]) => w[k]).map(([, l]) => l).join(' ، ') || '—';
      return `<section class="sheet st">${header('بيان حالة عمل', sub)}
        <div class="st-top">
          <div class="st-title"><div class="code">كود العمل: ${w.code} &nbsp;•&nbsp; ورقة ${i + 1} من ${works.length}</div><h2>${esc(w.title)}</h2>
            <div class="st-main">
              ${kv('الأبطال', val(w.cast_members))}${kv('التأليف', val(w.author))}${kv('الإخراج', val(w.director))}
              ${kv('اللون', val(w.color))}${kv('حق الاستغلال', badge(w.rights_status))}
            </div></div>
          <div class="st-imgs">${img(w.poster_url, 'poster', w.title)}${img(w.cast_photo_url, 'cast', 'صورة الأبطال')}</div>
        </div>
        <div class="st-grid">
          ${kv('نوع العمل', val(w.genre))}${kv('سنة الإنتاج', val(w.production_year))}${kv('شركة الإنتاج', val(w.production_company))}
          ${kv('نوع الاستغلال', val(w.exploitation_type))}${kv('حق البث', val(w.broadcast_right))}${kv('مدة التعاقد', val(w.contract_duration))}
          ${kv('بداية الاستغلال التلفزيوني', fmtDate(w.tv_start))}${kv('نهاية الاستغلال التلفزيوني', fmtDate(w.tv_end))}${kv('رقم / تاريخ الصلاحية', `${val(w.validity_no)} / ${fmtDate(w.validity_date)}`)}
          ${kv('بداية الاستغلال الفضائي', fmtDate(w.sat_start))}${kv('نهاية الاستغلال الفضائي', fmtDate(w.sat_end))}${kv('التقييم', val(w.rating))}
          ${kv('صلاحية العرض', val(w.show_status))}${kv('الصلاحية الهندسية', val(w.engineering_validity))}${kv('التصحيح', val(w.correction_status))}
          ${kv('الترجمة', yn(w.has_translation))}${kv('حظر البطل', yn(w.hero_ban))}${kv('أماكن الحفظ', esc(store))}
        </div>
        <h3>الأشرطة (${(w.tapes || []).length})</h3>
        <table class="rt"><thead><tr><th>م</th>${TAPE_COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${tapes}</tbody></table>
        ${w.story ? `<h3>القصة</h3><p class="txt">${esc(w.story)}</p>` : ''}
        ${w.notes ? `<h3>ملاحظات</h3><p class="txt">${esc(w.notes)}</p>` : ''}
      </section>`;
    }).join('');
  }

  // ---------- النافذة العلوية للمعاينة والطباعة ----------
  function openOverlay(title, html, excelFn, autoPrint) {
    closeOverlay();
    const el = document.createElement('div');
    el.id = 'overlay';
    el.innerHTML = `<div class="ov-bar no-print"><strong>${esc(title)}</strong><span class="grow"></span>
      <button class="btn gold" id="ovPdf">تصدير PDF / طباعة</button>
      ${excelFn ? '<button class="btn" id="ovXls">تصدير Excel</button>' : ''}
      <button class="btn ghost" id="ovClose">إغلاق</button></div>
      <div class="ov-note no-print">لحفظ PDF: اضغط «تصدير PDF» ثم اختر الطابعة <b>Save as PDF / حفظ بتنسيق PDF</b> (ويُفضّل إلغاء خيار Headers and footers).</div>
      <div class="ov-body">${html}</div>`;
    document.body.appendChild(el);
    document.body.classList.add('has-overlay');
    el.querySelector('#ovClose').onclick = closeOverlay;
    el.querySelector('#ovPdf').onclick = () => window.print();
    if (excelFn) el.querySelector('#ovXls').onclick = excelFn;
    if (autoPrint) setTimeout(() => window.print(), 600);
  }
  function closeOverlay() {
    document.getElementById('overlay')?.remove();
    document.body.classList.remove('has-overlay');
  }

  // ---------- تصدير Excel ----------
  const sheetName = (s, used) => {
    let n = String(s).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'عمل';
    let k = n, i = 2;
    while (used.has(k)) k = `${n.slice(0, 26)}_${i++}`;
    used.add(k); return k;
  };
  function finish(wb, name) { wb.Workbook = { Views: [{ RTL: true }] }; XLSX.writeFile(wb, `${name}.xlsx`); }

  function excelNames(works) {
    const aoa = [['م', 'اسم العمل'], ...works.map((w, i) => [i + 1, w.title])];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 8 }, { wch: 45 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'أسماء الأعمال'); finish(wb, 'قائمة-الأعمال');
  }
  function excelDetail(works) {
    const cols = ['code', 'title', 'cast_members', 'author', 'director', 'color', 'rights_status', 'genre', 'production_year', 'production_company',
      'exploitation_type', 'broadcast_right', 'show_status', 'engineering_validity', 'correction_status', 'poster_url', 'cast_photo_url'];
    const label = Object.fromEntries(WORK_COLS.map(([k, l]) => [k, l]));
    const aoa = [['م', ...cols.map((c) => label[c])], ...works.map((w, i) => [i + 1, ...cols.map((c) => w[c] ?? '')])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 9 }, { wch: 32 }, { wch: 50 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 40 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'التقرير التفصيلي'); finish(wb, 'التقرير-التفصيلي');
  }
  function excelStatus(works) {
    const wb = XLSX.utils.book_new();
    const info = (w) => [['كود العمل', w.code], ['اسم العمل', w.title], ['الأبطال', w.cast_members || ''], ['التأليف', w.author || ''], ['الإخراج', w.director || ''],
      ['اللون', w.color || ''], ['حق الاستغلال', w.rights_status || ''], ['نوع العمل', w.genre || ''], ['سنة الإنتاج', w.production_year || ''],
      ['شركة الإنتاج', w.production_company || ''], ['نوع الاستغلال', w.exploitation_type || ''], ['حق البث', w.broadcast_right || ''],
      ['بداية الاستغلال التلفزيوني', fmtDate(w.tv_start)], ['نهاية الاستغلال التلفزيوني', fmtDate(w.tv_end)],
      ['بداية الاستغلال الفضائي', fmtDate(w.sat_start)], ['نهاية الاستغلال الفضائي', fmtDate(w.sat_end)],
      ['صلاحية العرض', w.show_status || ''], ['الصلاحية الهندسية', w.engineering_validity || ''], ['التصحيح', w.correction_status || ''],
      ['رابط البوستر', w.poster_url || ''], ['رابط صورة الأبطال', w.cast_photo_url || ''], ['القصة', w.story || ''], ['ملاحظات', w.notes || '']];
    if (works.length <= 100) {                      // ورقة (Sheet) منفصلة لكل عمل
      const used = new Set();
      works.forEach((w) => {
        const aoa = [...info(w), [], ['م', ...TAPE_COLS.map(([, l]) => l)], ...(w.tapes || []).map((t, i) => [i + 1, ...TAPE_COLS.map(([k]) => t[k] ?? '')])];
        const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 26 }, { wch: 60 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName(`${w.code}-${w.title}`, used));
      });
    } else {                                         // عدد كبير: ورقة واحدة صف لكل شريط
      const head = ['كود العمل', 'اسم العمل', 'الأبطال', 'التأليف', 'الإخراج', 'اللون', 'حق الاستغلال', 'صلاحية العرض', 'الصلاحية الهندسية', 'التصحيح', ...TAPE_COLS.map(([, l]) => l)];
      const aoa = [head];
      works.forEach((w) => {
        const base = [w.code, w.title, w.cast_members || '', w.author || '', w.director || '', w.color || '', w.rights_status || '', w.show_status || '', w.engineering_validity || '', w.correction_status || ''];
        const t = w.tapes && w.tapes.length ? w.tapes : [{}];
        t.forEach((x) => aoa.push([...base, ...TAPE_COLS.map(([k]) => x[k] ?? '')]));
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = head.map((_, i) => ({ wch: i === 2 ? 40 : 16 }));
      XLSX.utils.book_append_sheet(wb, ws, 'بيان الحالة');
    }
    finish(wb, 'بيان-حالة-الأعمال');
  }

  window.Reports = { namesReport, detailReport, statusReport, openOverlay, closeOverlay, excelNames, excelDetail, excelStatus, header, img, badge };
})();
