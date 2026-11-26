// ==========================================
// 7. グラフ操作ロジック（CRUD）
// ==========================================
function addNode(wx, wy, customProps = {}) {
    const newNode = {
        id: generateId('n'),
        title: customProps.title || `New Track ${state.nodes.length + 1}`,
        artist: customProps.artist || '',
        genre: customProps.genre || '',
        bpm: customProps.bpm ?? '',
        key: customProps.key ?? '',
        color: customProps.color || '#06b6d4',
        memo: customProps.memo || '',
        x: Math.round(wx),
        y: Math.round(wy)
    };
    state.nodes.push(newNode);
    selectNode(newNode.id);
    updateGenreFilterOptions();
    updateSearchCountBadge();
    updateTransitionListUI();
    saveToStorage();
    render();
    showToast('楽曲ノードを追加しました');
    return newNode;
}

function deleteNode(nodeId) {
    state.nodes = state.nodes.filter(n => n.id !== nodeId);
    state.edges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    state.setlists.forEach(sl => {
        sl.tracks = sl.tracks.filter(id => id !== nodeId);
    });
    if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
    updateGenreFilterOptions();
    updateSearchCountBadge();
    updateInspector();
    updateTransitionListUI();
    updateSetlistUI();
    saveToStorage();
    render();
    showToast('楽曲を削除しました');
}

function addEdge(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return null;

    const newEdge = {
        id: generateId('e'),
        source: sourceId,
        target: targetId,
        label: '',
        rating: 0,
        style: 'solid',
        color: '#06b6d4',
        memo: ''
    };
    state.edges.push(newEdge);
    selectEdge(newEdge.id);
    updateTransitionListUI();
    saveToStorage();
    render();
    showToast('つなぎルートを作成しました');
    return newEdge;
}

function deleteEdge(edgeId) {
    state.edges = state.edges.filter(e => e.id !== edgeId);
    if (state.selectedEdgeId === edgeId) state.selectedEdgeId = null;
    updateInspector();
    updateTransitionListUI();
    saveToStorage();
    render();
    showToast('つなぎを削除しました');
}

function reverseEdge(edgeId) {
    const edge = state.edges.find(e => e.id === edgeId);
    if (!edge) return;
    const tmp = edge.source;
    edge.source = edge.target;
    edge.target = tmp;
    updateInspector();
    updateTransitionListUI();
    saveToStorage();
    render();
    showToast('つなぎの向きを反転しました');
}

// ==========================================
// 8. 選択 & 左右サイドバーUI同期
// ==========================================
function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    state.selectedEdgeId = null;
    if (state.setlistMode && state.setlistRecordEnabled && nodeId) {
        appendToSetlist(nodeId);
    }
    updateInspector();
    updateTransitionListUI();
    openSidebar();
    render();
}

function selectEdge(edgeId) {
    state.selectedEdgeId = edgeId;
    state.selectedNodeId = null;
    updateInspector();
    updateTransitionListUI();
    openSidebar();
    render();
}

function clearSelection() {
    state.selectedNodeId = null;
    state.selectedEdgeId = null;
    updateInspector();
    updateTransitionListUI();
    render();
}

function isLeftSidebarOpen() {
    const sidebar = document.getElementById('transition-list-sidebar');
    if (!sidebar) return false;
    if (window.innerWidth >= 768) {
        return !sidebar.classList.contains('md:hidden');
    }
    return !sidebar.classList.contains('-translate-x-full');
}

function syncLeftSidebarToggleButton() {
    const btn = document.getElementById('btn-toggle-left-sidebar');
    if (!btn) return;
    const open = isLeftSidebarOpen();
    if (open) {
        btn.classList.add('bg-dj-cyan/15', 'text-dj-cyan', 'border-dj-cyan/40');
        btn.classList.remove('bg-dj-surface', 'text-slate-300', 'border-dj-border');
        btn.title = 'つなぎ一覧パネルを非表示にする';
        btn.innerHTML = '<i data-lucide="panel-left-close" class="w-4 h-4 pointer-events-none"></i>';
    } else {
        btn.classList.remove('bg-dj-cyan/15', 'text-dj-cyan', 'border-dj-cyan/40');
        btn.classList.add('bg-dj-surface', 'text-slate-300', 'border-dj-border');
        btn.title = 'つなぎ一覧パネルを表示する';
        btn.innerHTML = '<i data-lucide="panel-left-open" class="w-4 h-4 pointer-events-none"></i>';
    }
    lucide.createIcons();
}

function openLeftSidebar() {
    const sidebar = document.getElementById('transition-list-sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('-translate-x-full', 'md:hidden');
    syncLeftSidebarToggleButton();
    resizeCanvas();
}

function closeLeftSidebar() {
    const sidebar = document.getElementById('transition-list-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('-translate-x-full', 'md:hidden');
    syncLeftSidebarToggleButton();
    resizeCanvas();
}

function toggleLeftSidebar() {
    if (isLeftSidebarOpen()) closeLeftSidebar();
    else openLeftSidebar();
}

function updateTransitionListUI() {
    const listEl = document.getElementById('transition-list-items');
    const countEl = document.getElementById('transition-list-count');
    const filterInput = document.getElementById('transition-list-filter');
    const sortSelect = document.getElementById('transition-list-sort');
    if (!listEl || !countEl) return;

    const query = (filterInput ? filterInput.value : '').trim().toLowerCase();
    const sortMode = sortSelect ? sortSelect.value : 'recent';

    let enriched = state.edges.map((edge, idx) => {
        const src = state.nodes.find(n => n.id === edge.source);
        const tgt = state.nodes.find(n => n.id === edge.target);
        return { edge, src, tgt, index: idx };
    }).filter(item => item.src && item.tgt);

    if (query) {
        const terms = query.split(/\s+/);
        enriched = enriched.filter(({ edge, src, tgt }) => {
            const blob = [
                src.title, src.artist, src.genre,
                tgt.title, tgt.artist, tgt.genre,
                edge.label, edge.memo
            ].filter(Boolean).join(' ').toLowerCase();
            return terms.every(t => blob.includes(t));
        });
    }

    if (sortMode === 'recent') {
        enriched.sort((a, b) => b.index - a.index);
    } else if (sortMode === 'rating') {
        enriched.sort((a, b) => (b.edge.rating || 0) - (a.edge.rating || 0) || b.index - a.index);
    } else if (sortMode === 'source') {
        enriched.sort((a, b) => (a.src.title || '').localeCompare(b.src.title || ''));
    } else if (sortMode === 'bpm') {
        enriched.sort((a, b) => (Number(a.src.bpm) || 999) - (Number(b.src.bpm) || 999));
    }

    countEl.textContent = enriched.length;
    listEl.innerHTML = '';

    if (enriched.length === 0) {
        listEl.innerHTML = `
            <div class="p-4 text-center text-[11px] text-slate-500 border border-dashed border-dj-border rounded-xl">
                ${state.edges.length === 0 ? 'つなぎがまだ登録されていません。<br>Shift+ドラッグで曲同士を結んでみましょう。' : '条件に一致するつなぎがありません。'}
            </div>
        `;
        return;
    }

    enriched.forEach(({ edge, src, tgt }) => {
        const isSelected = state.selectedEdgeId === edge.id;
        const isNodeRelated = state.selectedNodeId && (edge.source === state.selectedNodeId || edge.target === state.selectedNodeId);

        const card = document.createElement('div');
        card.className = `p-2.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
            isSelected
                ? 'bg-dj-pink/15 border-dj-pink shadow-md'
                : (isNodeRelated
                    ? 'bg-dj-surface border-dj-cyan/50 hover:border-dj-cyan'
                    : 'bg-dj-surface/60 border-dj-border hover:bg-dj-surface hover:border-slate-600')
        }`;

        const starsHtml = edge.rating
            ? `<span class="text-[10px] font-mono text-amber-400 shrink-0">${'★'.repeat(edge.rating)}</span>`
            : '';

        const labelBadge = edge.label
            ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-dj-panel border border-dj-border text-dj-cyan truncate max-w-[140px]">${escapeHtml(edge.label)}</span>`
            : `<span class="text-[10px] text-slate-500 italic">手法未設定</span>`;

        const memoHtml = edge.memo && edge.memo.trim()
            ? `<div class="text-[10px] text-slate-400 line-clamp-2 leading-snug pt-0.5 border-t border-dj-border/50">${escapeHtml(edge.memo)}</div>`
            : '';

        card.innerHTML = `
            <div class="flex items-center justify-between gap-1.5">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${edge.color || '#06b6d4'}"></span>
                    ${labelBadge}
                </div>
                ${starsHtml}
            </div>
            <div class="space-y-1">
                <div class="flex items-center justify-between gap-1 text-[11px]">
                    <span class="font-medium text-white truncate">${escapeHtml(src.title)}</span>
                    <span class="font-mono text-[9.5px] text-slate-400 shrink-0">${src.bpm || '---'} / ${escapeHtml(src.key || '-')}</span>
                </div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400 pl-1">
                    <i data-lucide="corner-down-right" class="w-3 h-3 text-dj-pink shrink-0"></i>
                    <span class="font-medium text-slate-200 truncate flex-1">${escapeHtml(tgt.title)}</span>
                    <span class="font-mono text-[9.5px] text-slate-400 shrink-0">${tgt.bpm || '---'} / ${escapeHtml(tgt.key || '-')}</span>
                </div>
            </div>
            ${memoHtml}
        `;

        card.onclick = () => {
            selectEdge(edge.id);
            focusCameraOnEdge(edge);
            if (window.innerWidth < 768) {
                closeLeftSidebar();
            }
        };

        listEl.appendChild(card);
    });

    lucide.createIcons();
}

function isSidebarOpen() {
    const sidebar = document.getElementById('inspector-sidebar');
    if (!sidebar) return false;
    if (window.innerWidth >= 768) {
        return !sidebar.classList.contains('md:hidden');
    }
    return !sidebar.classList.contains('translate-x-full');
}

function syncSidebarToggleButton() {
    const btn = document.getElementById('btn-toggle-sidebar');
    if (!btn) return;
    const open = isSidebarOpen();
    if (open) {
        btn.classList.add('bg-dj-cyan/15', 'text-dj-cyan', 'border-dj-cyan/40');
        btn.classList.remove('bg-dj-surface', 'text-slate-300', 'border-dj-border');
        btn.title = '編集パネルを非表示にする';
        btn.innerHTML = '<i data-lucide="panel-right-close" class="w-4 h-4 pointer-events-none"></i>';
    } else {
        btn.classList.remove('bg-dj-cyan/15', 'text-dj-cyan', 'border-dj-cyan/40');
        btn.classList.add('bg-dj-surface', 'text-slate-300', 'border-dj-border');
        btn.title = '編集パネルを表示する';
        btn.innerHTML = '<i data-lucide="panel-right-open" class="w-4 h-4 pointer-events-none"></i>';
    }
    lucide.createIcons();
}

function openSidebar() {
    const sidebar = document.getElementById('inspector-sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('translate-x-full', 'md:hidden');
    syncSidebarToggleButton();
    resizeCanvas();
}

function closeSidebar() {
    const sidebar = document.getElementById('inspector-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('translate-x-full', 'md:hidden');
    syncSidebarToggleButton();
    resizeCanvas();
}

function toggleSidebar() {
    if (isSidebarOpen()) closeSidebar();
    else openSidebar();
}

function updateInspector() {
    const viewEmpty = document.getElementById('view-empty');
    const viewNode = document.getElementById('view-node');
    const viewEdge = document.getElementById('view-edge');
    const titleEl = document.getElementById('inspector-title');

    document.getElementById('stat-nodes').textContent = state.nodes.length;
    document.getElementById('stat-edges').textContent = state.edges.length;

    if (state.selectedNodeId) {
        const node = state.nodes.find(n => n.id === state.selectedNodeId);
        if (!node) return;

        viewEmpty.classList.add('hidden');
        viewEdge.classList.add('hidden');
        viewNode.classList.remove('hidden');
        titleEl.textContent = '楽曲インスペクター';

        document.getElementById('node-title').value = node.title || '';
        document.getElementById('node-artist').value = node.artist || '';
        document.getElementById('node-genre').value = node.genre || '';
        document.getElementById('node-bpm').value = node.bpm || '';
        document.getElementById('node-key').value = node.key || '';
        document.getElementById('node-memo').value = node.memo || '';

        const chipsContainer = document.getElementById('genre-quick-chips');
        chipsContainer.innerHTML = '';
        QUICK_GENRES.forEach(g => {
            const chip = document.createElement('button');
            chip.type = 'button';
            const isCurrent = (node.genre || '').toLowerCase() === g.toLowerCase();
            chip.className = `px-2 py-0.5 rounded text-[10px] border transition ${
                isCurrent
                    ? 'bg-dj-purple/30 text-purple-200 border-dj-purple'
                    : 'bg-dj-surface/80 text-slate-400 border-dj-border hover:text-white hover:border-slate-500'
            }`;
            chip.textContent = g;
            chip.onclick = () => {
                node.genre = g;
                document.getElementById('node-genre').value = g;
                updateGenreFilterOptions();
                updateSearchCountBadge();
                updateInspector();
                updateSetlistUI();
                saveToStorage();
                render();
            };
            chipsContainer.appendChild(chip);
        });

        const colorsContainer = document.getElementById('node-colors');
        colorsContainer.innerHTML = '';
        NODE_COLORS.forEach(c => {
            const btn = document.createElement('button');
            const active = node.color === c.hex;
            btn.className = `w-6 h-6 rounded-full transition transform ${active ? 'scale-110 ring-2 ring-white' : 'opacity-70 hover:opacity-100'}`;
            btn.style.backgroundColor = c.hex;
            btn.title = c.label;
            btn.onclick = () => {
                node.color = c.hex;
                updateInspector();
                saveToStorage();
                render();
            };
            colorsContainer.appendChild(btn);
        });

        const outEdges = state.edges.filter(e => e.source === node.id);
        const inEdges = state.edges.filter(e => e.target === node.id);

        document.getElementById('out-count').textContent = outEdges.length;
        document.getElementById('in-count').textContent = inEdges.length;

        const outList = document.getElementById('node-out-list');
        outList.innerHTML = outEdges.length ? '' : '<div class="text-[11px] text-slate-500 italic">登録なし</div>';
        outEdges.forEach(e => {
            const target = state.nodes.find(n => n.id === e.target);
            if (!target) return;
            const item = document.createElement('div');
            item.className = 'p-2 rounded-lg bg-dj-surface/70 hover:bg-dj-surface border border-dj-border cursor-pointer flex items-center justify-between gap-2 transition';
            const genreSuffix = target.genre ? ` · ${escapeHtml(target.genre)}` : '';
            item.innerHTML = `
                <div class="min-w-0">
                    <div class="text-xs font-medium text-white truncate">${escapeHtml(target.title)}</div>
                    <div class="text-[10px] text-dj-cyan truncate">${escapeHtml(e.label || 'つなぎ')} (${target.bpm || '---'} BPM / ${escapeHtml(target.key || '-')}${genreSuffix})</div>
                </div>
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
            `;
            item.onclick = () => selectEdge(e.id);
            outList.appendChild(item);
        });

        const inList = document.getElementById('node-in-list');
        inList.innerHTML = inEdges.length ? '' : '<div class="text-[11px] text-slate-500 italic">登録なし</div>';
        inEdges.forEach(e => {
            const source = state.nodes.find(n => n.id === e.source);
            if (!source) return;
            const item = document.createElement('div');
            item.className = 'p-2 rounded-lg bg-dj-surface/70 hover:bg-dj-surface border border-dj-border cursor-pointer flex items-center justify-between gap-2 transition';
            const genreSuffix = source.genre ? ` · ${escapeHtml(source.genre)}` : '';
            item.innerHTML = `
                <div class="min-w-0">
                    <div class="text-xs font-medium text-white truncate">${escapeHtml(source.title)}</div>
                    <div class="text-[10px] text-dj-purple truncate">${escapeHtml(e.label || 'つなぎ')} (${source.bpm || '---'} BPM / ${escapeHtml(source.key || '-')}${genreSuffix})</div>
                </div>
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
            `;
            item.onclick = () => selectEdge(e.id);
            inList.appendChild(item);
        });

        lucide.createIcons();
    } else if (state.selectedEdgeId) {
        const edge = state.edges.find(e => e.id === state.selectedEdgeId);
        if (!edge) return;

        const src = state.nodes.find(n => n.id === edge.source);
        const tgt = state.nodes.find(n => n.id === edge.target);

        viewEmpty.classList.add('hidden');
        viewNode.classList.add('hidden');
        viewEdge.classList.remove('hidden');
        titleEl.textContent = 'つなぎ・トランジション編集';

        document.getElementById('edge-source-name').textContent = src ? `${src.title} (${src.bpm || '---'} BPM / ${src.key || '-'})` : 'Unknown';
        document.getElementById('edge-target-name').textContent = tgt ? `${tgt.title} (${tgt.bpm || '---'} BPM / ${tgt.key || '-'})` : 'Unknown';

        if (src && tgt && src.bpm && tgt.bpm) {
            const diff = (tgt.bpm - src.bpm).toFixed(1);
            const sign = diff > 0 ? '+' : '';
            document.getElementById('edge-bpm-diff').textContent = `BPM差: ${sign}${diff}`;
        } else {
            document.getElementById('edge-bpm-diff').textContent = '';
        }

        document.getElementById('edge-label').value = edge.label || '';
        document.getElementById('edge-style').value = edge.style || 'solid';
        document.getElementById('edge-memo').value = edge.memo || '';

        const starsContainer = document.getElementById('edge-rating-stars');
        starsContainer.innerHTML = '';
        for (let r = 1; r <= 5; r++) {
            const starBtn = document.createElement('button');
            starBtn.type = 'button';
            const filled = (edge.rating || 0) >= r;
            starBtn.className = `p-1 rounded transition ${filled ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`;
            starBtn.innerHTML = `<i data-lucide="star" class="w-4 h-4 ${filled ? 'fill-amber-400' : ''}"></i>`;
            starBtn.onclick = () => {
                edge.rating = edge.rating === r ? 0 : r;
                updateInspector();
                updateTransitionListUI();
                saveToStorage();
                render();
            };
            starsContainer.appendChild(starBtn);
        }

        const edgeColorsContainer = document.getElementById('edge-colors');
        edgeColorsContainer.innerHTML = '';
        EDGE_COLORS.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const active = edge.color === c.hex;
            btn.className = `w-5 h-5 rounded-full transition ${active ? 'scale-110 ring-2 ring-white' : 'opacity-70 hover:opacity-100'}`;
            btn.style.backgroundColor = c.hex;
            btn.onclick = () => {
                edge.color = c.hex;
                updateInspector();
                updateTransitionListUI();
                saveToStorage();
                render();
            };
            edgeColorsContainer.appendChild(btn);
        });

        lucide.createIcons();
    } else {
        viewNode.classList.add('hidden');
        viewEdge.classList.add('hidden');
        viewEmpty.classList.remove('hidden');
        titleEl.textContent = 'インスペクター';
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ==========================================
// 9. セットリスト管理・選択・強調 & BPMチャート
// ==========================================
function appendToSetlist(nodeId) {
    const sl = getActiveSetlist();
    if (!sl) return;
    if (sl.tracks[sl.tracks.length - 1] === nodeId) return;
    sl.tracks.push(nodeId);
    saveToStorage();
    updateSetlistUI();
    render();
}

function updateSetlistUI() {
    const listContainer = document.getElementById('setlist-items');
    const countBadge = document.getElementById('setlist-count');
    const chartContainer = document.getElementById('bpm-chart-container');
    const selectEl = document.getElementById('setlist-select');
    const recordChk = document.getElementById('chk-setlist-record');

    if (recordChk) {
        recordChk.checked = state.setlistRecordEnabled;
    }

    if (!Array.isArray(state.setlists) || state.setlists.length === 0) {
        state.setlists = [{ id: 'sl_default', name: 'セトリ #1', tracks: [] }];
        state.activeSetlistId = 'sl_default';
    }
    state.setlists.forEach(sl => {
        if (!Array.isArray(sl.tracks)) sl.tracks = [];
    });

    if (selectEl) {
        selectEl.innerHTML = '';
        state.setlists.forEach(sl => {
            const opt = document.createElement('option');
            opt.value = sl.id;
            const tList = Array.isArray(sl.tracks) ? sl.tracks : [];
            opt.textContent = `${sl.name || 'セトリ'} (${tList.length}曲)`;
            if (sl.id === state.activeSetlistId) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    const activeSl = getActiveSetlist();
    const trackIds = activeSl ? activeSl.tracks : [];
    const validTracks = trackIds
        .map(id => state.nodes.find(n => n.id === id))
        .filter(Boolean);

    countBadge.textContent = `${validTracks.length}曲`;
    listContainer.innerHTML = '';

    if (validTracks.length === 0) {
        chartContainer.innerHTML = '<span class="text-[10px] text-slate-500">曲をクリックして選択中のセトリに追加...</span>';
        return;
    }

    const bpms = validTracks.map(t => Number(t.bpm) || 128);
    const minBpm = Math.min(...bpms) - 4;
    const maxBpm = Math.max(...bpms) + 4;
    const range = Math.max(maxBpm - minBpm, 10);

    const svgW = 280;
    const svgH = 28;
    const points = bpms.map((b, idx) => {
        const px = validTracks.length === 1 ? svgW / 2 : (idx / (validTracks.length - 1)) * (svgW - 16) + 8;
        const py = svgH - 4 - ((b - minBpm) / range) * (svgH - 8);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');

    chartContainer.innerHTML = `
        <div class="flex flex-col justify-center shrink-0 pr-2">
            <span class="text-[9px] text-slate-400 uppercase">BPM推移</span>
            <span class="text-[11px] font-mono text-dj-cyan font-bold">${Math.min(...bpms)} → ${Math.max(...bpms)}</span>
        </div>
        <svg viewBox="0 0 ${svgW} ${svgH}" class="flex-1 h-7 overflow-visible">
            <polyline fill="none" stroke="#10b981" stroke-width="2" points="${points}" />
            ${bpms.map((b, idx) => {
                const px = validTracks.length === 1 ? svgW / 2 : (idx / (validTracks.length - 1)) * (svgW - 16) + 8;
                const py = svgH - 4 - ((b - minBpm) / range) * (svgH - 8);
                return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.8" fill="#ffffff" />`;
            }).join('')}
        </svg>
    `;

    validTracks.forEach((t, idx) => {
        let transitionBadge = '';
        if (idx > 0) {
            const prev = validTracks[idx - 1];
            const edge = state.edges.find(e => e.source === prev.id && e.target === t.id);
            if (edge) {
                transitionBadge = `<span class="text-[10px] px-1.5 py-0.2 rounded bg-dj-cyan/15 text-dj-cyan truncate max-w-[110px]">↳ ${escapeHtml(edge.label || 'つなぎ')}</span>`;
            } else {
                transitionBadge = `<span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300">未登録ルート</span>`;
            }
        }

        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-dj-surface/70 hover:bg-dj-surface px-2.5 py-1.5 rounded-lg border border-dj-border/60 text-xs cursor-pointer transition';
        const genrePill = t.genre
            ? `<span class="text-[10px] px-1.5 py-0.2 rounded-full bg-dj-purple/20 text-purple-200 border border-dj-purple/40 shrink-0">${escapeHtml(t.genre)}</span>`
            : '';
        row.innerHTML = `
            <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-mono text-[11px] font-bold text-dj-emerald w-5 shrink-0">#${idx + 1}</span>
                <span class="truncate text-white font-medium">${escapeHtml(t.title)}</span>
                ${genrePill}
                ${transitionBadge}
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-1">
                <span class="font-mono text-[10px] text-slate-400">${t.bpm || '---'} / ${escapeHtml(t.key || '-')}</span>
                <button data-idx="${idx}" class="btn-remove-setlist text-slate-500 hover:text-red-400 p-0.5">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>
            </div>
        `;
        row.onclick = () => {
            focusCameraOnNode(t);
        };
        listContainer.appendChild(row);
    });

    listContainer.querySelectorAll('.btn-remove-setlist').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const sl = getActiveSetlist();
            if (!sl) return;
            const idx = Number(btn.dataset.idx);
            sl.tracks.splice(idx, 1);
            saveToStorage();
            updateSetlistUI();
            render();
        };
    });

    lucide.createIcons();
}
