/**
 * PROLIFT Technical Training Centre L.L.C
 * Modular Data-Driven Catalog & Lead Portal
 */
(function () {
    'use strict';

    const LEAD_CONFIG = {
        email: 'info@prolift.training',
        whatsapp: '971562301343'
    };

    const PAGE_SIZE = 24;

    const LEGAL_DOCS = {
        'Privacy Policy': `
            <p><strong>1. Data Controller:</strong> PROLIFT Technical Training Centre L.L.C (Commercial License No. 1636409, KHDA Permit No. 634197, HFZA Reg. No. 333618), located at Office 201, Al Saud Building, Al Qusais, Dubai, UAE, is responsible for personal data collected through this website.</p>
            <p><strong>2. Data We Collect &amp; Purpose:</strong> When you submit a course inquiry, corporate quote request, or certificate verification request, we collect your name, company name, email address, phone/WhatsApp number, and training details. We process this information strictly to respond to inquiries, schedule training, issue KHDA-permitted certificates and wallet cards, and verify trainee credentials under the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021 — UAE PDPL).</p>
            <p><strong>3. Third-Party Communication Channels:</strong> Form submissions sent by email are routed via FormSubmit (formsubmit.co) to info@prolift.training. If you contact us via WhatsApp, your message is processed through WhatsApp LLC in accordance with their privacy terms.</p>
            <p><strong>4. Data Retention &amp; Your Rights:</strong> Trainee assessment and certification records are retained as required by Dubai regulatory authorities. Under the UAE PDPL, you may request access to, correction of, or deletion of your personal contact details (subject to statutory record-keeping obligations) by emailing <a href="mailto:info@prolift.training" class="text-amber-600 underline">info@prolift.training</a>.</p>
        `,
        'Terms of Service': `
            <p>Registration in PROLIFT Technical Training Centre L.L.C courses implies adherence to our safety rules, attendance policies, and practical assessment standards required by KHDA (Permit 634197) and UAE authorities.</p>
            <p>Trainees must bring valid Emirates ID or passport identification and required Personal Protective Equipment (PPE) for practical field evaluations.</p>
        `,
        'Safety Standard Guidelines': `
            <p>Our courses are designed with reference to applicable UAE and Dubai occupational safety requirements, with a strong focus on hazard awareness, equipment pre-use inspection, and practical competence. Certificates and wallet cards are issued only after successful theoretical and practical evaluation.</p>
        `
    };

    const state = {
        meta: null,
        courses: [],
        category: 'all',
        subcat: 'all',
        role: 'all',
        search: '',
        visibleLimit: PAGE_SIZE,
        selectedIds: new Set(),
        searchTimer: null
    };

    // ================= DATA LOADING =================
    async function loadCatalogData() {
        try {
            const res = await fetch('./data/courses.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const payload = await res.json();
            state.meta = payload.meta || {};
            state.courses = Array.isArray(payload.courses) ? payload.courses : [];
        } catch (err) {
            if (window.__PROLIFT_FALLBACK_CATALOG__) {
                state.meta = window.__PROLIFT_FALLBACK_CATALOG__.meta || {};
                state.courses = window.__PROLIFT_FALLBACK_CATALOG__.courses || [];
            } else {
                const grid = document.getElementById('courseGrid');
                if (grid) {
                    grid.innerHTML = `
                        <div class="col-span-full text-center py-12 bg-amber-50 rounded-2xl border border-amber-200 p-6">
                            <i class="fa-solid fa-triangle-exclamation text-3xl text-amber-600 mb-2"></i>
                            <p class="text-sm font-bold text-slate-900">Unable to load external course data over local file protocol.</p>
                            <p class="text-xs text-slate-600 mt-1">Serve this folder via any static web server (e.g., VS Code Live Server, GitHub Pages, or Cloudflare Pages) to load <code>data/courses.json</code>.</p>
                        </div>
                    `;
                }
                return;
            }
        }

        restoreStateFromURL();
        updateDynamicCounts();
        populateSubcategoryFilter();
        populateDropdowns();
        syncFilterButtonUI();
        renderCourses();

        // Check if URL targets a specific course modal (?course=slug)
        const params = new URLSearchParams(window.location.search);
        const courseSlug = params.get('course');
        if (courseSlug) {
            const found = state.courses.find(c => c.slug === courseSlug || String(c.id) === courseSlug);
            if (found) openCourseModal(found.id);
        }
    }

    // ================= URL STATE SYNC (SHAREABLE FILTERS) =================
    function restoreStateFromURL() {
        const params = new URLSearchParams(window.location.search);
        const div = params.get('division');
        const sub = params.get('subcat');
        const role = params.get('role');
        const q = params.get('q');

        if (div && ['all', 'lifting', 'scaffolding', 'machinery', 'safety'].includes(div)) {
            state.category = div;
        }
        if (sub) {
            state.subcat = sub;
        }
        if (role && ['all', 'operator', 'supervisor', 'inspector', 'awareness'].includes(role)) {
            state.role = role;
        }
        if (q) {
            state.search = q;
            const input = document.getElementById('courseSearch');
            const clearBtn = document.getElementById('clearSearchBtn');
            if (input) input.value = q;
            if (clearBtn) clearBtn.classList.remove('hidden');
        }
    }

    function syncURLState(courseSlug = null) {
        if (!window.history || !window.history.replaceState) return;
        const params = new URLSearchParams();
        if (state.category !== 'all') params.set('division', state.category);
        if (state.subcat !== 'all') params.set('subcat', state.subcat);
        if (state.role !== 'all') params.set('role', state.role);
        if (state.search.trim()) params.set('q', state.search.trim());
        if (courseSlug) params.set('course', courseSlug);

        const qs = params.toString();
        const newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
    }

    // ================= DYNAMIC COUNTS & FACETS =================
    function updateDynamicCounts() {
        const total = state.courses.length;
        const catCounts = { all: total, lifting: 0, scaffolding: 0, machinery: 0, safety: 0 };
        const roleCounts = { all: total, operator: 0, supervisor: 0, inspector: 0, awareness: 0 };

        state.courses.forEach(c => {
            if (catCounts[c.category] !== undefined) catCounts[c.category]++;
            if (roleCounts[c.role] !== undefined) roleCounts[c.role]++;
        });

        document.querySelectorAll('[data-count-cat]').forEach(el => {
            const key = el.getAttribute('data-count-cat');
            if (catCounts[key] !== undefined) el.textContent = catCounts[key];
        });

        document.querySelectorAll('[data-count-role]').forEach(el => {
            const key = el.getAttribute('data-count-role');
            if (roleCounts[key] !== undefined) el.textContent = roleCounts[key];
        });
    }

    function populateSubcategoryFilter() {
        const select = document.getElementById('subcatFilterSelect');
        if (!select) return;

        const scopedCourses = state.category === 'all'
            ? state.courses
            : state.courses.filter(c => c.category === state.category);

        const counts = {};
        scopedCourses.forEach(c => {
            if (!c.subcat) return;
            counts[c.subcat] = (counts[c.subcat] || 0) + 1;
        });

        const subcats = Object.keys(counts).sort();
        select.innerHTML = `<option value="all">All Sub-Categories (${scopedCourses.length})</option>`;
        subcats.forEach(sc => {
            const opt = document.createElement('option');
            opt.value = sc;
            opt.textContent = `${sc} (${counts[sc]})`;
            select.appendChild(opt);
        });

        if (state.subcat !== 'all' && counts[state.subcat]) {
            select.value = state.subcat;
        } else {
            state.subcat = 'all';
            select.value = 'all';
        }
    }

    // ================= FILTERING & RENDERING =================
    function getFilteredCourses() {
        const searchTokens = state.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return state.courses.filter(course => {
            if (state.category !== 'all' && course.category !== state.category) return false;
            if (state.subcat !== 'all' && course.subcat !== state.subcat) return false;
            if (state.role !== 'all' && course.role !== state.role) return false;
            if (searchTokens.length === 0) return true;
            const haystack = `${course.title} ${course.desc} ${course.subcat} ${course.aliases || ''}`.toLowerCase();
            return searchTokens.every(tok => haystack.includes(tok));
        });
    }

    function renderCourses() {
        const container = document.getElementById('courseGrid');
        const countLabel = document.getElementById('courseResultsCount');
        const loadMoreWrap = document.getElementById('loadMoreWrap');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (!container) return;

        const filtered = getFilteredCourses();
        const visible = filtered.slice(0, state.visibleLimit);

        if (countLabel) {
            countLabel.textContent = `Showing ${visible.length} of ${filtered.length} matching courses (${state.courses.length} total).`;
        }

        container.innerHTML = '';

        if (filtered.length === 0) {
            if (loadMoreWrap) loadMoreWrap.classList.add('hidden');
            container.innerHTML = `
                <div class="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    <i class="fa-solid fa-folder-open text-4xl mb-2 text-slate-400"></i>
                    <p class="text-sm font-semibold text-slate-700">No safety courses match your current search or filters.</p>
                    <button type="button" onclick="resetAllFilters()" class="mt-3 bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                        Reset Search &amp; Filters
                    </button>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        visible.forEach(course => {
            const isSelected = state.selectedIds.has(course.id);
            const card = document.createElement('div');
            card.className = `bg-slate-50 rounded-2xl border ${isSelected ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-slate-200'} p-6 flex flex-col justify-between hover:border-amber-500 hover:shadow-lg transition-all group`;
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-3 gap-2">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md ${getCategoryBadge(course.category)}">
                            ${getCategoryLabel(course.category)}
                        </span>
                        <span class="text-[10px] text-slate-400 font-mono">#${course.id + 1}</span>
                    </div>
                    <h4 class="font-extrabold text-slate-900 text-base mb-1.5 group-hover:text-amber-600 transition-colors">${course.title}</h4>
                    <div class="text-[11px] text-slate-500 font-medium mb-2.5 flex items-center gap-1.5">
                        <i class="fa-solid fa-tag text-amber-500/80 text-[10px]"></i>
                        <span>${course.subcat}</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed mb-4">${course.desc}</p>
                </div>
                <div>
                    <div class="pt-4 border-t border-slate-200/60 flex items-center justify-between gap-2">
                        <button type="button" onclick="openCourseModal(${course.id})" class="text-xs font-bold text-slate-700 hover:text-amber-600 flex items-center gap-1">
                            <span>View Details</span>
                            <i class="fa-solid fa-chevron-right text-[10px]"></i>
                        </button>
                        <div class="flex items-center gap-1.5">
                            <button type="button" onclick="toggleCourseSelection(${course.id})" title="Add or remove from batch quote list" class="${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                                <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i>
                            </button>
                            <button type="button" onclick="openBookingModal(${course.id})" class="bg-navy-900 hover:bg-amber-500 hover:text-navy-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                Quick Quote
                            </button>
                        </div>
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        });
        container.appendChild(fragment);

        if (loadMoreWrap && loadMoreBtn) {
            const remaining = filtered.length - visible.length;
            if (remaining > 0) {
                loadMoreWrap.classList.remove('hidden');
                loadMoreBtn.textContent = `Load More Courses (${remaining} remaining)`;
            } else {
                loadMoreWrap.classList.add('hidden');
            }
        }
    }

    function loadMoreCourses() {
        state.visibleLimit += PAGE_SIZE;
        renderCourses();
    }

    function getCategoryLabel(cat) {
        switch (cat) {
            case 'lifting': return 'Lifting & Rigging';
            case 'scaffolding': return 'Scaffolding & Height';
            case 'machinery': return 'Machinery & Plant';
            default: return 'Technical Safety';
        }
    }

    function getCategoryBadge(cat) {
        switch (cat) {
            case 'lifting': return 'bg-blue-100 text-blue-700';
            case 'scaffolding': return 'bg-amber-100 text-amber-800';
            case 'machinery': return 'bg-purple-100 text-purple-700';
            default: return 'bg-slate-200 text-slate-700';
        }
    }

    // ================= FILTER CONTROLS =================
    function syncFilterButtonUI() {
        document.querySelectorAll('.cat-btn').forEach(btn => {
            const active = btn.getAttribute('data-cat') === state.category;
            btn.classList.toggle('bg-navy-900', active);
            btn.classList.toggle('text-white', active);
            btn.classList.toggle('active', active);
            btn.classList.toggle('bg-slate-100', !active);
            btn.classList.toggle('text-slate-700', !active);
        });

        document.querySelectorAll('.role-btn').forEach(btn => {
            const active = btn.getAttribute('data-role') === state.role;
            btn.classList.toggle('bg-amber-500', active);
            btn.classList.toggle('text-navy-950', active);
            btn.classList.toggle('font-bold', active);
            btn.classList.toggle('active', active);
            btn.classList.toggle('bg-slate-100', !active);
            btn.classList.toggle('text-slate-700', !active);
            btn.classList.toggle('font-semibold', !active);
        });
    }

    function setCategoryFilter(cat) {
        state.category = cat;
        state.subcat = 'all';
        state.visibleLimit = PAGE_SIZE;
        populateSubcategoryFilter();
        syncFilterButtonUI();
        syncURLState();
        renderCourses();
    }

    function setSubcatFilter(subcat) {
        state.subcat = subcat || 'all';
        state.visibleLimit = PAGE_SIZE;
        syncURLState();
        renderCourses();
    }

    function setRoleFilter(role) {
        state.role = role;
        state.visibleLimit = PAGE_SIZE;
        syncFilterButtonUI();
        syncURLState();
        renderCourses();
    }

    function handleSearchInput() {
        const input = document.getElementById('courseSearch');
        const clearBtn = document.getElementById('clearSearchBtn');
        state.search = input ? input.value : '';
        if (clearBtn) clearBtn.classList.toggle('hidden', !state.search.trim());
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
            state.visibleLimit = PAGE_SIZE;
            syncURLState();
            renderCourses();
        }, 100);
    }

    function clearCourseSearch() {
        const input = document.getElementById('courseSearch');
        const clearBtn = document.getElementById('clearSearchBtn');
        state.search = '';
        state.visibleLimit = PAGE_SIZE;
        if (input) input.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        syncURLState();
        renderCourses();
        if (input) input.focus();
    }

    function quickSearch(term) {
        const input = document.getElementById('courseSearch');
        const clearBtn = document.getElementById('clearSearchBtn');
        state.search = term;
        state.category = 'all';
        state.subcat = 'all';
        state.role = 'all';
        state.visibleLimit = PAGE_SIZE;
        if (input) input.value = term;
        if (clearBtn) clearBtn.classList.remove('hidden');
        populateSubcategoryFilter();
        syncFilterButtonUI();
        syncURLState();
        renderCourses();
    }

    function resetAllFilters() {
        const input = document.getElementById('courseSearch');
        const clearBtn = document.getElementById('clearSearchBtn');
        state.search = '';
        state.category = 'all';
        state.subcat = 'all';
        state.role = 'all';
        state.visibleLimit = PAGE_SIZE;
        if (input) input.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        populateSubcategoryFilter();
        syncFilterButtonUI();
        syncURLState();
        renderCourses();
    }

    function copyShareFilterLink() {
        syncURLState();
        const url = window.location.href;
        const btn = document.getElementById('shareFilterBtn');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                if (btn) {
                    const orig = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check text-emerald-600"></i> <span>Link Copied</span>';
                    setTimeout(() => { btn.innerHTML = orig; }, 2000);
                }
            });
        }
    }

    function scrollToCourses() {
        const el = document.getElementById('courses');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }

    // ================= MULTI-COURSE BATCH SELECTION =================
    function toggleCourseSelection(id) {
        if (state.selectedIds.has(id)) {
            state.selectedIds.delete(id);
        } else {
            state.selectedIds.add(id);
        }
        updateBatchUI();
        renderCourses();
    }

    function clearBatchSelection() {
        state.selectedIds.clear();
        updateBatchUI();
        renderCourses();
    }

    function updateBatchUI() {
        const count = state.selectedIds.size;
        const tray = document.getElementById('batchTray');
        const countText = document.getElementById('batchCountText');
        const navBadge = document.getElementById('navQuoteBadge');
        if (tray && countText) {
            tray.classList.toggle('hidden', count === 0);
            countText.textContent = `${count} course${count === 1 ? '' : 's'}`;
        }
        if (navBadge) {
            navBadge.classList.toggle('hidden', count === 0);
            navBadge.textContent = String(count);
        }
        syncModalSelectedCourses();
    }

    function syncModalSelectedCourses() {
        const wrap = document.getElementById('modalSelectedCoursesWrap');
        const countSpan = document.getElementById('modalSelectedCount');
        const chips = document.getElementById('modalSelectedChips');
        if (!wrap || !countSpan || !chips) return;
        const ids = Array.from(state.selectedIds);
        wrap.classList.toggle('hidden', ids.length === 0);
        countSpan.textContent = String(ids.length);
        chips.innerHTML = ids.map(id => {
            const c = state.courses[id];
            if (!c) return '';
            return `<span class="inline-flex items-center gap-1 bg-white border border-amber-300 text-slate-800 text-[11px] font-medium px-2 py-0.5 rounded-md">
                ${c.title}
                <button type="button" onclick="toggleCourseSelection(${id})" class="text-slate-400 hover:text-rose-600 ml-0.5">&times;</button>
            </span>`;
        }).join('');
    }

    // ================= DROPDOWN POPULATION =================
    function populateDropdowns(filterText = '') {
        const selectContact = document.getElementById('contactCourseSelect');
        const selectCalc = document.getElementById('calcCourseSelect');
        const q = filterText.trim().toLowerCase();

        const groups = [
            { key: 'lifting', label: 'Lifting & Rigging' },
            { key: 'scaffolding', label: 'Scaffolding & Height Safety' },
            { key: 'machinery', label: 'Heavy Equipment & Machinery' },
            { key: 'safety', label: 'General Technical Safety' }
        ];

        if (!q && selectContact && selectContact.options.length <= 1) {
            groups.forEach(g => {
                const items = state.courses.filter(c => c.category === g.key);
                if (!items.length) return;
                const og = document.createElement('optgroup');
                og.label = `${g.label} (${items.length})`;
                items.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.title;
                    opt.textContent = c.title;
                    og.appendChild(opt);
                });
                selectContact.appendChild(og);
            });
        }

        if (selectCalc) {
            const prevVal = selectCalc.value;
            selectCalc.innerHTML = '';
            groups.forEach(g => {
                const items = state.courses.filter(c => c.category === g.key && (!q || `${c.title} ${c.aliases || ''}`.toLowerCase().includes(q)));
                if (!items.length) return;
                const og = document.createElement('optgroup');
                og.label = `${g.label} (${items.length})`;
                items.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.title;
                    og.appendChild(opt);
                });
                selectCalc.appendChild(og);
            });
            if (prevVal && Array.from(selectCalc.options).some(o => o.value === prevVal)) {
                selectCalc.value = prevVal;
            }
        }
    }

    function filterModalCourses() {
        const val = document.getElementById('calcCourseFilterInput').value;
        populateDropdowns(val);
    }

    // ================= MODALS =================
    function openCourseModal(id) {
        const course = state.courses[id];
        if (!course) return;
        document.getElementById('modalCategory').innerText = `${getCategoryLabel(course.category).toUpperCase()} • ${course.subcat.toUpperCase()}`;
        document.getElementById('modalTitle').innerText = course.title;
        document.getElementById('modalDescription').innerText = course.desc;
        document.getElementById('modalAudience').innerText = course.audience;

        const bookBtn = document.getElementById('modalBookBtn');
        if (bookBtn) {
            bookBtn.setAttribute('onclick', `closeCourseModal(); openBookingModal(${course.id});`);
        }

        const objList = document.getElementById('modalObjectives');
        objList.innerHTML = `
            <li class="flex items-center gap-2"><i class="fa-solid fa-check text-emerald-500"></i> Regulatory safety standards compliance (UAE, KHDA &amp; International).</li>
            <li class="flex items-center gap-2"><i class="fa-solid fa-check text-emerald-500"></i> Equipment inspection routines and pre-start hazards check.</li>
            <li class="flex items-center gap-2"><i class="fa-solid fa-check text-emerald-500"></i> Practical maneuverability and emergency response handling.</li>
            <li class="flex items-center gap-2"><i class="fa-solid fa-check text-emerald-500"></i> Official certification wallet card issuance upon evaluation.</li>
        `;

        syncURLState(course.slug);
        document.getElementById('courseModal').classList.remove('hidden');
    }

    function closeCourseModal() {
        syncURLState(null);
        document.getElementById('courseModal').classList.add('hidden');
    }

    function openBookingModal(courseId = null) {
        const filterInput = document.getElementById('calcCourseFilterInput');
        if (filterInput) {
            filterInput.value = '';
            populateDropdowns('');
        }
        if (courseId !== null) {
            document.getElementById('calcCourseSelect').value = courseId;
        } else if (state.selectedIds.size > 0) {
            const firstId = Array.from(state.selectedIds)[0];
            document.getElementById('calcCourseSelect').value = firstId;
        }
        syncModalSelectedCourses();
        document.getElementById('quoteSuccessMsg').classList.add('hidden');
        document.getElementById('quoteCalculatorForm').classList.remove('hidden');
        document.getElementById('bookingModal').classList.remove('hidden');
        calculateEstimate();
    }

    function closeBookingModal() {
        document.getElementById('bookingModal').classList.add('hidden');
    }

    function openLegalModal(type) {
        const modal = document.getElementById('legalModal');
        const title = document.getElementById('legalModalTitle');
        const content = document.getElementById('legalDocsContent');
        if (content) {
            if (type && type !== 'Permits & Registrations') {
                title.innerText = type;
                content.innerHTML = LEGAL_DOCS[type] || '';
            } else {
                title.innerText = 'Licenses, Permits & Registrations';
                content.innerHTML = content.dataset.defaultHtml || content.innerHTML;
            }
        }
        modal.classList.remove('hidden');
    }

    function closeLegalModal() {
        document.getElementById('legalModal').classList.add('hidden');
    }

    function calculateEstimate() {
        const trainees = parseInt(document.getElementById('calcTrainees').value, 10) || 1;
        const discountLabel = document.getElementById('calcDiscountLabel');
        if (trainees >= 15) {
            discountLabel.innerText = 'Large batch (15+): group rates confirmed in your quote';
        } else if (trainees >= 5) {
            discountLabel.innerText = 'Group batch (5–14): group rates confirmed in your quote';
        } else {
            discountLabel.innerText = 'Small batch: standard rates';
        }
    }

    // ================= LEAD FORMS & VERIFICATION =================
    function val(id) {
        const el = document.getElementById(id);
        return el ? (el.value || '').trim() : '';
    }

    async function submitFormEmail(subject, fields) {
        try {
            const payload = Object.assign({ _subject: subject, _template: 'table', _captcha: 'false' }, fields);
            const response = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(LEAD_CONFIG.email), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });
            return response.ok;
        } catch (err) {
            return false;
        }
    }

    function openWhatsAppLead(subject, body) {
        window.open('https://wa.me/' + LEAD_CONFIG.whatsapp + '?text=' + encodeURIComponent(subject + '\n\n' + body), '_blank', 'noopener');
    }

    function handleVerifySubmit(e) {
        e.preventDefault();
        const id = document.getElementById('certInput').value.trim().slice(0, 60);
        const resContainer = document.getElementById('verifyResult');
        resContainer.classList.remove('hidden');
        resContainer.className = 'mt-6 p-6 rounded-xl text-left border bg-slate-900 border-amber-500/40 text-white';
        resContainer.innerHTML = '<p class="text-sm text-slate-200"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Submitting verification request...</p>';

        submitFormEmail('Certificate verification request: ' + id, { Certificate_ID: id, Request_Type: 'Certificate Record Verification' })
            .then(function (delivered) {
                resContainer.innerHTML = delivered
                    ? '<div class="flex items-start gap-3 text-sm text-slate-200"><i class="fa-solid fa-square-check text-emerald-400 text-xl mt-0.5"></i><div><span class="font-bold text-white">Request sent.</span><p class="mt-1">Your verification request for "' + id + '" has been emailed to our registrar team at info@prolift.training. We will confirm the record with you shortly.</p></div></div>'
                    : '<div class="flex items-start gap-3 text-sm text-slate-200"><i class="fa-solid fa-triangle-exclamation text-amber-400 text-xl mt-0.5"></i><div><span class="font-bold text-white">Could not send automatically.</span><p class="mt-1">Please message us on WhatsApp (+971 56 230 1343) or email info@prolift.training with Certificate ID "' + id + '".</p></div></div>';
            });
    }

    function handleContactSubmit(e) {
        e.preventDefault();
        const form = document.getElementById('contactForm');
        if (!form.reportValidity()) return;
        const subject = 'Training enquiry: ' + val('contactCourseSelect') + ' - ' + val('contactName');
        const body = ['Name: ' + val('contactName'), 'Company: ' + (val('contactCompany') || '-'), 'Email: ' + val('contactEmail'), 'Phone/WhatsApp: ' + val('contactPhone'), 'Course: ' + val('contactCourseSelect'), '', 'Requirements:', val('contactMessage')].join('\n');
        const btn = document.getElementById('contactSubmitBtn');
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Sending Inquiry...</span>';
        submitFormEmail(subject, { Name: val('contactName'), Company: val('contactCompany') || '-', Email: val('contactEmail'), Phone_WhatsApp: val('contactPhone'), Course: val('contactCourseSelect'), Requirements: val('contactMessage') })
            .then(function (sent) {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                const msg = document.getElementById('contactSuccessMsg');
                if (sent) {
                    msg.innerHTML = '<i class="fa-solid fa-circle-check mr-2"></i> Thank you! Your inquiry has been emailed to info@prolift.training. Our training team will contact you shortly.';
                    form.reset();
                    msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 8000);
                } else {
                    msg.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-2"></i> Direct email submission could not complete. Opening WhatsApp as backup so your inquiry reaches our team immediately.';
                    msg.classList.remove('hidden');
                    openWhatsAppLead(subject, body);
                }
            });
    }

    function sendContactViaWhatsApp(e) {
        e.preventDefault();
        const form = document.getElementById('contactForm');
        if (!form.reportValidity()) return;
        const subject = 'Training enquiry: ' + val('contactCourseSelect') + ' - ' + val('contactName');
        const body = ['Name: ' + val('contactName'), 'Company: ' + (val('contactCompany') || '-'), 'Email: ' + val('contactEmail'), 'Phone/WhatsApp: ' + val('contactPhone'), 'Course: ' + val('contactCourseSelect'), '', 'Requirements:', val('contactMessage')].join('\n');
        openWhatsAppLead(subject, body);
        const msg = document.getElementById('contactSuccessMsg');
        msg.innerHTML = '<i class="fa-brands fa-whatsapp mr-2"></i> WhatsApp has opened with your inquiry details. Press Send in WhatsApp to complete your submission.';
        msg.classList.remove('hidden');
    }

    function getBatchCourseSummary(primaryTitle) {
        const extraTitles = Array.from(state.selectedIds)
            .map(id => state.courses[id] && state.courses[id].title)
            .filter(t => t && t !== primaryTitle);
        if (!extraTitles.length) return primaryTitle;
        return `${primaryTitle} (+ ${extraTitles.length} additional: ${extraTitles.join(', ')})`;
    }

    function handleQuoteSubmit(e) {
        e.preventDefault();
        const form = document.getElementById('quoteCalculatorForm');
        if (!form.reportValidity()) return;
        const sel = document.getElementById('calcCourseSelect');
        const primaryTitle = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : 'Training';
        const courseSummary = getBatchCourseSummary(primaryTitle);
        const loc = document.getElementById('calcLocation');
        const locationText = loc.options[loc.selectedIndex].text;
        const subject = 'Quote request: ' + primaryTitle + ' - ' + val('quoteName');
        const body = ['Name: ' + val('quoteName'), 'Phone/WhatsApp: ' + val('quotePhone'), '', 'Courses: ' + courseSummary, 'Number of trainees: ' + val('calcTrainees'), 'Location: ' + locationText].join('\n');
        const btn = document.getElementById('quoteSubmitBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Sending Quote Request...';
        submitFormEmail(subject, { Name: val('quoteName'), Phone_WhatsApp: val('quotePhone'), Courses: courseSummary, Number_of_Trainees: val('calcTrainees'), Preferred_Location: locationText })
            .then(function (sent) {
                btn.disabled = false;
                btn.textContent = originalText;
                form.classList.add('hidden');
                const ok = document.getElementById('quoteSuccessMsg');
                ok.querySelector('h4').textContent = sent ? 'Quote Request Sent!' : 'Backup channel opened';
                ok.querySelector('p').textContent = sent
                    ? 'Your corporate quote request has been emailed to info@prolift.training. Our corporate team will reply with pricing and availability.'
                    : 'Direct email submission could not complete. WhatsApp has opened with your quote details; press Send there, or email info@prolift.training.';
                ok.classList.remove('hidden');
                if (!sent) openWhatsAppLead(subject, body);
            });
    }

    function sendQuoteViaWhatsApp(e) {
        e.preventDefault();
        const form = document.getElementById('quoteCalculatorForm');
        if (!form.reportValidity()) return;
        const sel = document.getElementById('calcCourseSelect');
        const primaryTitle = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : 'Training';
        const courseSummary = getBatchCourseSummary(primaryTitle);
        const loc = document.getElementById('calcLocation');
        const locationText = loc.options[loc.selectedIndex].text;
        const subject = 'Quote request: ' + primaryTitle + ' - ' + val('quoteName');
        const body = ['Name: ' + val('quoteName'), 'Phone/WhatsApp: ' + val('quotePhone'), '', 'Courses: ' + courseSummary, 'Number of trainees: ' + val('calcTrainees'), 'Location: ' + locationText].join('\n');
        openWhatsAppLead(subject, body);
        form.classList.add('hidden');
        document.getElementById('quoteSuccessMsg').classList.remove('hidden');
    }

    function toggleMobileMenu() {
        const menu = document.getElementById('mobileMenu');
        menu.classList.toggle('hidden');
        document.getElementById('mobileMenuBtn').setAttribute('aria-expanded', menu.classList.contains('hidden') ? 'false' : 'true');
    }

    // ================= ACCESSIBILITY & AMBIENT HERO =================
    function initAccessibility() {
        const content = document.getElementById('legalDocsContent');
        if (content) content.dataset.defaultHtml = content.innerHTML;

        window.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            closeCourseModal();
            closeBookingModal();
            closeLegalModal();
            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                toggleMobileMenu();
                document.getElementById('mobileMenuBtn').focus();
            }
        });

        const ids = ['courseModal', 'bookingModal', 'legalModal'];
        let lastFocus = null;
        function focusables(m) {
            return Array.prototype.slice.call(m.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'))
                .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
        }
        function anyOpen() {
            return ids.some(function (id) { return !document.getElementById(id).classList.contains('hidden'); });
        }
        ids.forEach(function (id) {
            const m = document.getElementById(id);
            if (!m) return;
            let wasOpen = false;
            new MutationObserver(function () {
                const open = !m.classList.contains('hidden');
                if (open && !wasOpen) {
                    lastFocus = document.activeElement;
                    document.body.style.overflow = 'hidden';
                    setTimeout(function () { const f = focusables(m); if (f.length) f[0].focus(); }, 0);
                } else if (!open && wasOpen) {
                    if (!anyOpen()) document.body.style.overflow = '';
                    if (lastFocus && lastFocus.focus) lastFocus.focus();
                }
                wasOpen = open;
            }).observe(m, { attributes: true, attributeFilter: ['class'] });

            m.addEventListener('keydown', function (e) {
                if (e.key !== 'Tab') return;
                const f = focusables(m);
                if (!f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            });
            m.addEventListener('click', function (e) {
                if (e.target === m) {
                    closeCourseModal();
                    closeBookingModal();
                    closeLegalModal();
                }
            });
        });
    }

    function initHeroMotion() {
        const slides = [].slice.call(document.querySelectorAll('#heroBg .hero-slide'));
        const btn = document.getElementById('heroMotionBtn');
        if (!slides.length || !btn) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const conn = navigator.connection || {};
        const lite = conn.saveData || /2g/.test(conn.effectiveType || '');
        let paused = reduce, idx = 0, timer = null;

        function vid(sl) { return sl.querySelector('video'); }
        function load(sl) {
            const v = vid(sl);
            if (!v || v.dataset.ready || lite || reduce) return;
            let added = false;
            [['data-webm', 'video/webm'], ['data-mp4', 'video/mp4']].forEach(function (t) {
                const u = v.getAttribute(t[0]);
                if (u) {
                    const e = document.createElement('source');
                    e.src = u;
                    e.type = t[1];
                    v.appendChild(e);
                    added = true;
                }
            });
            v.dataset.ready = '1';
            if (added) {
                v.addEventListener('canplay', function () { v.classList.add('on'); });
                v.load();
            }
        }
        function show(i) {
            slides.forEach(function (s, n) {
                const v = vid(s);
                s.classList.toggle('active', n === i);
                if (v && v.dataset.ready && v.querySelector('source')) {
                    if (n === i) { v.currentTime = 0; v.play().catch(function () {}); }
                    else v.pause();
                }
            });
            load(slides[(i + 1) % slides.length]);
        }
        function next() { idx = (idx + 1) % slides.length; show(idx); schedule(); }
        function schedule() { clearTimeout(timer); if (!paused && slides.length > 1) timer = setTimeout(next, 9000); }
        function setPaused(p) {
            paused = p;
            btn.setAttribute('aria-label', p ? 'Play background video' : 'Pause background video');
            btn.innerHTML = '<i class="fa-solid ' + (p ? 'fa-play' : 'fa-pause') + '"></i>';
            slides.forEach(function (s) {
                const v = vid(s);
                if (v && v.querySelector('source')) {
                    p ? v.pause() : (s.classList.contains('active') && v.play().catch(function () {}));
                }
            });
            p ? clearTimeout(timer) : schedule();
        }
        btn.addEventListener('click', function () { setPaused(!paused); });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) clearTimeout(timer);
            else if (!paused) schedule();
        });
        load(slides[0]);
        show(0);
        setPaused(paused);
        if (reduce) btn.classList.add('hidden');
    }

    // Expose public handlers for inline HTML event bindings
    window.setCategoryFilter = setCategoryFilter;
    window.setSubcatFilter = setSubcatFilter;
    window.setRoleFilter = setRoleFilter;
    window.handleSearchInput = handleSearchInput;
    window.clearCourseSearch = clearCourseSearch;
    window.quickSearch = quickSearch;
    window.resetAllFilters = resetAllFilters;
    window.copyShareFilterLink = copyShareFilterLink;
    window.loadMoreCourses = loadMoreCourses;
    window.scrollToCourses = scrollToCourses;
    window.toggleCourseSelection = toggleCourseSelection;
    window.clearBatchSelection = clearBatchSelection;
    window.filterModalCourses = filterModalCourses;
    window.openCourseModal = openCourseModal;
    window.closeCourseModal = closeCourseModal;
    window.openBookingModal = openBookingModal;
    window.closeBookingModal = closeBookingModal;
    window.openLegalModal = openLegalModal;
    window.closeLegalModal = closeLegalModal;
    window.calculateEstimate = calculateEstimate;
    window.handleVerifySubmit = handleVerifySubmit;
    window.handleContactSubmit = handleContactSubmit;
    window.sendContactViaWhatsApp = sendContactViaWhatsApp;
    window.handleQuoteSubmit = handleQuoteSubmit;
    window.sendQuoteViaWhatsApp = sendQuoteViaWhatsApp;
    window.toggleMobileMenu = toggleMobileMenu;

    document.addEventListener('DOMContentLoaded', () => {
        initAccessibility();
        initHeroMotion();
        loadCatalogData();
    });
})();
