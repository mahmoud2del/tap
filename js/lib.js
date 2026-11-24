/* مكتبة مشتركة: الاتصال بـ Supabase + أدوات + تعريف الحقول + الاستعلام */
(function () {
  const CFG = window.APP_CONFIG || {};
  const configured = !!CFG.SUPABASE_URL && !/YOUR-/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY);
  const sb = configured ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // نفس منطق الدالة norm_ar في قاعدة البيانات
  const norm = (s) => String(s ?? '').replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .toLowerCase().trim();
  const safeUrl = (u) => { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };
  const collator = new Intl.Collator('ar');

  function fmtDate(d) {
    if (!d) return '—';
    const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d);
    if (!m) return esc(d);
    if (+m[1] === 1111) return 'غير محدد';           // قيمة 1111-01-01 في الشيت = غير محدد
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  // [المفتاح، العنوان، النوع]  النوع: text | int | date | bool | area | url | cat
  const WORK_COLS = [
    ['code', 'كود العمل', 'int'], ['title', 'اسم العمل', 'text'], ['genre', 'نوع العمل', 'cat'],
    ['production_year', 'سنة الإنتاج', 'int'], ['color', 'اللون', 'cat'], ['director', 'الإخراج', 'text'],
    ['author', 'التأليف', 'text'], ['cast_members', 'الأبطال', 'area'], ['production_company', 'شركة الإنتاج', 'text'],
    ['rights_status', 'حق الاستغلال', 'cat'], ['exploitation_type', 'نوع الاستغلال', 'cat'], ['broadcast_right', 'حق البث', 'cat'],
    ['contract_duration', 'مدة التعاقد', 'text'], ['validity_no', 'رقم الصلاحية', 'int'], ['validity_date', 'تاريخ الصلاحية', 'date'],
    ['tv_start', 'بداية الاستغلال التلفزيوني', 'date'], ['tv_end', 'نهاية الاستغلال التلفزيوني', 'date'],
    ['sat_start', 'بداية الاستغلال الفضائي', 'date'], ['sat_end', 'نهاية الاستغلال الفضائي', 'date'],
    ['show_status', 'صلاحية العرض', 'cat'], ['engineering_validity', 'الصلاحية الهندسية', 'cat'], ['correction_status', 'التصحيح', 'cat'],
    ['rating', 'التقييم', 'text'], ['duration_min', 'المدة (دقيقة)', 'text'],
    ['has_translation', 'الترجمة', 'bool'], ['hero_ban', 'حظر البطل', 'bool'],
    ['story', 'القصة', 'area'], ['notes', 'ملاحظات', 'area'],
    ['poster_url', 'رابط بوستر الفيلم', 'url'], ['cast_photo_url', 'رابط صورة الأبطال', 'url'],
  ];
  const STORAGE_COLS = [['hd1', 'هارد ق1'], ['tape_flag', 'شريط'], ['hd_tv', 'هارد TV'], ['hd_economic', 'هارد الاقتصادية'], ['hd_special', 'هارد المتخصصة'], ['inch_flag', 'البوصة']];
  const TAPE_COLS = [['tape_no', 'رقم الشريط'], ['tape_type', 'نوع الشريط'], ['medium', 'الوسيط'], ['part', 'الجزء'], ['tape_validity', 'صلاحية الشريط']];
  const ROLES = { admin: 'مدير', editor: 'محرر', viewer: 'مشاهدة فقط' };

  // ---------- الاستعلام ----------
  const clean = (s) => norm(s).replace(/[,()%*\\"]/g, ' ').trim();
  function applyFilters(q, f) {
    f = f || {};
    if (f.q && clean(f.q)) {
      const t = clean(f.q);
      q = q.or(['title_n', 'director_n', 'cast_n', 'company_n'].map((c) => `${c}.ilike."*${t}*"`).join(','));
    }
    if (f.title && clean(f.title)) q = q.ilike('title_n', `%${clean(f.title)}%`);
    if (f.director && clean(f.director)) q = q.ilike('director_n', `%${clean(f.director)}%`);
    if (f.cast && clean(f.cast)) q = q.ilike('cast_n', `%${clean(f.cast)}%`);
    if (f.company && clean(f.company)) q = q.ilike('company_n', `%${clean(f.company)}%`);
    ['genre', 'color', 'rights_status', 'exploitation_type', 'broadcast_right', 'show_status', 'engineering_validity', 'correction_status']
      .forEach((k) => { if (f[k]) q = q.eq(k, f[k]); });
    if (f.year_from) q = q.gte('production_year', +f.year_from);
    if (f.year_to) q = q.lte('production_year', +f.year_to);
    return q;
  }
  const FILTER_LABELS = { q: 'بحث', title: 'العمل', director: 'المخرج', cast: 'الأبطال', company: 'الشركة', genre: 'النوع', color: 'اللون',
    rights_status: 'حق الاستغلال', exploitation_type: 'نوع الاستغلال', broadcast_right: 'حق البث', show_status: 'صلاحية العرض',
    engineering_validity: 'الصلاحية الهندسية', correction_status: 'التصحيح', year_from: 'من سنة', year_to: 'إلى سنة' };
  const describeFilters = (f) => Object.keys(FILTER_LABELS).filter((k) => f && f[k]).map((k) => `${FILTER_LABELS[k]}: ${f[k]}`).join(' ، ') || 'جميع الأعمال';

  // جلب كل الأعمال (Supabase يرجع 1000 صف كحد أقصى للطلب فنقسّم على دفعات)
  async function fetchAllWorks(filters, withTapes, onProgress) {
    const out = []; const size = 500;
    for (let from = 0; ; from += size) {
      let q = sb.from('works').select(withTapes ? '*, tapes(*)' : '*');
      q = applyFilters(q, filters).order('code').range(from, from + size - 1);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...data);
      if (onProgress) onProgress(out.length);
      if (data.length < size) break;
    }
    out.sort((a, b) => collator.compare(a.title || '', b.title || '') || a.code - b.code);
    if (withTapes) out.forEach((w) => (w.tapes || []).sort((a, b) => (+a.id) - (+b.id)));
    return out;
  }

  window.L = { CFG, sb, configured, esc, norm, safeUrl, fmtDate, collator, WORK_COLS, STORAGE_COLS, TAPE_COLS, ROLES, applyFilters, describeFilters, fetchAllWorks };
})();
