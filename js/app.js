// ==========================================
// 10. マウス & タッチ インタラクションハンドラ
// ==========================================
function getPointerPos(e) {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        sx: clientX - rect.left,
        sy: clientY - rect.top
    };
}

function handlePointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.button !== 1) return;
    const { sx, sy } = getPointerPos(e);
    const world = screenToWorld(sx, sy);
    state.pointerScreen = { x: sx, y: sy };
    state.pointerWorld = world;
    state.hasMovedDuringDrag = false;

    const hitNode = getNodeAt(world.x, world.y);

    if ((e.shiftKey || state.connectMode) && hitNode) {
        if (state.connectMode && state.connectSourceId && state.connectSourceId !== hitNode.id) {
            addEdge(state.connectSourceId, hitNode.id);
            state.connectSourceId = null;
            render();
            return;
        }
        state.isDrawingEdge = true;
        state.drawEdgeSourceId = hitNode.id;
        state.connectSourceId = hitNode.id;
        render();
        return;
    }

    if (hitNode) {
        state.isDraggingNode = true;
        state.dragNodeId = hitNode.id;
        state.dragOffset = {
            x: world.x - hitNode.x,
            y: world.y - hitNode.y
        };
        const idx = state.nodes.findIndex(n => n.id === hitNode.id);
        if (idx !== -1) {
            const [moved] = state.nodes.splice(idx, 1);
            state.nodes.push(moved);
        }
        render();
        return;
    }

    const hitEdge = getEdgeAt(world.x, world.y);
    if (hitEdge && e.button !== 2 && !e.altKey) {
        selectEdge(hitEdge.id);
        return;
    }

    if (state.sphereMode && (e.altKey || e.button === 2 || state.sphereOrbitMode)) {
        state.isRotatingSphere = true;
        state.rotateStart = {
            x: sx,
            y: sy,
            yaw: state.sphereRot.yaw,
            pitch: state.sphereRot.pitch
        };
        canvas.style.cursor = 'grabbing';
        return;
    }

    state.isPanning = true;
    state.panStart = {
        x: sx - state.camera.x,
        y: sy - state.camera.y
    };
}

function handlePointerMove(e) {
    const { sx, sy } = getPointerPos(e);
    const world = screenToWorld(sx, sy);

    if (Math.hypot(sx - state.pointerScreen.x, sy - state.pointerScreen.y) > 3) {
        state.hasMovedDuringDrag = true;
    }
    state.pointerScreen = { x: sx, y: sy };
    state.pointerWorld = world;

    if (state.isDrawingEdge) {
        const hoverN = getNodeAt(world.x, world.y);
        state.hoveredNodeId = hoverN ? hoverN.id : null;
        render();
        return;
    }

    if (state.isRotatingSphere) {
        const dx = sx - state.rotateStart.x;
        const dy = sy - state.rotateStart.y;
        state.sphereRot.yaw = state.rotateStart.yaw + dx * 0.0075;
        state.sphereRot.pitch = Math.max(
            -Math.PI / 2 + 0.08,
            Math.min(Math.PI / 2 - 0.08, state.rotateStart.pitch + dy * 0.0075)
        );
        projectAllSphereNodes();
        render();
        return;
    }

    if (state.isDraggingNode && state.dragNodeId) {
        const node = state.nodes.find(n => n.id === state.dragNodeId);
        if (node) {
            node.x = Math.round(world.x - state.dragOffset.x);
            node.y = Math.round(world.y - state.dragOffset.y);
            if (state.sphereMode) {
                const unrot = unrotate3DPoint(node.x, node.y, node.z || 0, state.sphereRot.yaw, state.sphereRot.pitch);
                node.x3 = unrot.x3;
                node.y3 = unrot.y3;
                node.z3 = unrot.z3;
                node.r = Math.hypot(unrot.x3, unrot.y3, unrot.z3);
                node.theta = Math.atan2(unrot.z3, unrot.x3);
                node.phi = node.r > 1e-4 ? Math.asin(Math.max(-1, Math.min(1, unrot.y3 / node.r))) : 0;
            }
            render();
        }
        return;
    }

    if (state.isPanning) {
        state.camera.x = sx - state.panStart.x;
        state.camera.y = sy - state.panStart.y;
        render();
        return;
    }

    const hoverNode = getNodeAt(world.x, world.y);
    const hoverEdge = hoverNode ? null : getEdgeAt(world.x, world.y);
    const nextHoverNodeId = hoverNode ? hoverNode.id : null;
    const nextHoverEdgeId = hoverEdge ? hoverEdge.id : null;

    if (state.hoveredNodeId !== nextHoverNodeId || state.hoveredEdgeId !== nextHoverEdgeId) {
        state.hoveredNodeId = nextHoverNodeId;
        state.hoveredEdgeId = nextHoverEdgeId;
        canvas.style.cursor = (hoverNode || hoverEdge) ? 'pointer' : (state.connectMode ? 'crosshair' : 'grab');
        render();
    }
}

function handlePointerUp(e) {
    if (state.isDrawingEdge) {
        const targetNode = getNodeAt(state.pointerWorld.x, state.pointerWorld.y);
        if (targetNode && targetNode.id !== state.drawEdgeSourceId) {
            addEdge(state.drawEdgeSourceId, targetNode.id);
            state.connectSourceId = null;
        }
        state.isDrawingEdge = false;
        state.drawEdgeSourceId = null;
        render();
        return;
    }

    if (state.isDraggingNode) {
        if (state.hasMovedDuringDrag) {
            saveToStorage();
        } else if (state.dragNodeId) {
            selectNode(state.dragNodeId);
        }
        state.isDraggingNode = false;
        state.dragNodeId = null;
        render();
        return;
    }

    if (state.isRotatingSphere) {
        state.isRotatingSphere = false;
        canvas.style.cursor = 'grab';
        saveToStorage();
        render();
        return;
    }

    if (state.isPanning) {
        if (!state.hasMovedDuringDrag) {
            clearSelection();
            if (state.connectMode) {
                state.connectSourceId = null;
            }
        }
        state.isPanning = false;
        render();
    }
}

canvas.addEventListener('dblclick', (e) => {
    const { sx, sy } = getPointerPos(e);
    const world = screenToWorld(sx, sy);
    const hitNode = getNodeAt(world.x, world.y);
    const hitEdge = getEdgeAt(world.x, world.y);
    if (!hitNode && !hitEdge) {
        addNode(world.x, world.y);
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { sx, sy } = getPointerPos(e);
    const beforeWorld = screenToWorld(sx, sy);

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(Math.max(state.camera.zoom * zoomFactor, 0.12), 2.5);
    state.camera.zoom = nextZoom;

    const afterScreen = worldToScreen(beforeWorld.x, beforeWorld.y);
    state.camera.x += sx - afterScreen.x;
    state.camera.y += sy - afterScreen.y;

    updateZoomLabel();
    render();
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => {
    if (state.sphereMode) e.preventDefault();
});
canvas.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

let lastPinchDist = null;
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    } else if (e.touches.length === 1) {
        handlePointerDown(e);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinchDist !== null) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = dist / lastPinchDist;
        state.camera.zoom = Math.min(Math.max(state.camera.zoom * scale, 0.12), 2.5);
        lastPinchDist = dist;
        updateZoomLabel();
        render();
    } else if (e.touches.length === 1) {
        handlePointerMove(e);
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) lastPinchDist = null;
    handlePointerUp(e);
});

// ==========================================
// 11. UIコントロール・フォームイベントバインド
// ==========================================
document.getElementById('btn-add-node').onclick = () => {
    const jitterX = (Math.random() - 0.5) * 80;
    const jitterY = (Math.random() - 0.5) * 80;
    const center = screenToWorld(container.clientWidth / 2 + jitterX, container.clientHeight / 2 + jitterY);
    addNode(center.x, center.y);
};

function setConnectMode(enabled) {
    state.connectMode = enabled;
    state.connectSourceId = null;
    const btn = document.getElementById('btn-connect-mode');
    const banner = document.getElementById('mode-banner');
    if (enabled) {
        btn.classList.add('bg-dj-pink/20', 'text-dj-pink', 'border-dj-pink/40');
        btn.classList.remove('text-slate-300', 'border-transparent');
        banner.classList.remove('hidden');
    } else {
        btn.classList.remove('bg-dj-pink/20', 'text-dj-pink', 'border-dj-pink/40');
        btn.classList.add('text-slate-300', 'border-transparent');
        banner.classList.add('hidden');
    }
    render();
}

document.getElementById('btn-connect-mode').onclick = () => setConnectMode(!state.connectMode);
document.getElementById('btn-cancel-mode').onclick = () => setConnectMode(false);

document.getElementById('btn-focus-mode').onclick = () => {
    state.focusMode = !state.focusMode;
    const btn = document.getElementById('btn-focus-mode');
    if (state.focusMode) {
        btn.classList.add('bg-dj-purple/20', 'text-dj-purple', 'border-dj-purple/40');
        btn.classList.remove('text-slate-300', 'border-transparent');
        showToast('フォーカスモード ON（関連ルートを強調）');
    } else {
        btn.classList.remove('bg-dj-purple/20', 'text-dj-purple', 'border-dj-purple/40');
        btn.classList.add('text-slate-300', 'border-transparent');
        showToast('フォーカスモード OFF（全体表示）');
    }
    render();
};

document.getElementById('btn-setlist-mode').onclick = () => {
    state.setlistMode = !state.setlistMode;
    const btn = document.getElementById('btn-setlist-mode');
    const drawer = document.getElementById('setlist-drawer');
    if (state.setlistMode) {
        btn.classList.add('bg-dj-emerald/20', 'text-dj-emerald', 'border-dj-emerald/40');
        btn.classList.remove('text-slate-300', 'border-transparent');
        drawer.classList.remove('hidden');
        updateSetlistUI();
        const sl = getActiveSetlist();
        if (sl && sl.tracks.length > 0) {
            showToast(`セトリ「${sl.name}」の曲を強調表示中`);
        }
    } else {
        btn.classList.remove('bg-dj-emerald/20', 'text-dj-emerald', 'border-dj-emerald/40');
        btn.classList.add('text-slate-300', 'border-transparent');
        drawer.classList.add('hidden');
    }
    render();
};

// セトリ管理コントロール
document.getElementById('setlist-select').addEventListener('change', (e) => {
    state.activeSetlistId = e.target.value;
    saveToStorage();
    updateSetlistUI();
    render();
    const sl = getActiveSetlist();
    if (sl) showToast(`セトリ「${sl.name}」を選択・強調表示`);
});

document.getElementById('chk-setlist-record').addEventListener('change', (e) => {
    state.setlistRecordEnabled = e.target.checked;
});

document.getElementById('btn-new-setlist').onclick = () => {
    const defaultName = `セトリ #${state.setlists.length + 1}`;
    showSetlistPrompt('新しいセトリを作成', defaultName, (name) => {
        const newSl = {
            id: generateId('sl'),
            name,
            tracks: []
        };
        state.setlists.push(newSl);
        state.activeSetlistId = newSl.id;
        state.setlistRecordEnabled = true;
        saveToStorage();
        updateSetlistUI();
        render();
        showToast(`セトリ「${name}」を作成しました`);
    });
};

document.getElementById('btn-rename-setlist').onclick = () => {
    const sl = getActiveSetlist();
    if (!sl) return;
    showSetlistPrompt('セトリ名を変更', sl.name, (newName) => {
        sl.name = newName;
        saveToStorage();
        updateSetlistUI();
        showToast('セトリ名を変更しました');
    });
};

document.getElementById('btn-delete-setlist').onclick = () => {
    const sl = getActiveSetlist();
    if (!sl) return;
    if (state.setlists.length <= 1) {
        showConfirm('セトリのクリア', `最後のセトリ「${sl.name}」の曲リストを空にしますか？`, () => {
            sl.tracks = [];
            saveToStorage();
            updateSetlistUI();
            render();
            showToast('セトリを空にしました');
        });
        return;
    }
    showConfirm('セトリの削除', `セトリ「${sl.name}」を削除しますか？`, () => {
        state.setlists = state.setlists.filter(item => item.id !== sl.id);
        state.activeSetlistId = state.setlists[0].id;
        saveToStorage();
        updateSetlistUI();
        render();
        showToast(`セトリ「${sl.name}」を削除しました`);
    });
};

document.getElementById('btn-clear-setlist').onclick = () => {
    const sl = getActiveSetlist();
    if (!sl) return;
    sl.tracks = [];
    saveToStorage();
    updateSetlistUI();
    render();
};

document.getElementById('btn-copy-setlist').onclick = () => {
    const sl = getActiveSetlist();
    if (!sl || sl.tracks.length === 0) return;
    const header = `【${sl.name}】\n`;
    const lines = sl.tracks.map((id, idx) => {
        const n = state.nodes.find(item => item.id === id);
        if (!n) return '';
        const genrePart = n.genre ? ` | ${n.genre}` : '';
        let line = `${idx + 1}. ${n.title}${n.artist ? ' - ' + n.artist : ''} [${n.bpm || '---'} BPM / ${n.key || '-'}${genrePart}]`;
        if (idx > 0) {
            const prevId = sl.tracks[idx - 1];
            const edge = state.edges.find(e => e.source === prevId && e.target === id);
            if (edge && edge.label) {
                line = `   ↳ (${edge.label})\n` + line;
            }
        }
        return line;
    });
    const text = header + lines.join('\n');

    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('セトリをクリップボードにコピーしました');
    } catch (err) {
        showToast('コピーに失敗しました');
    }
    textarea.remove();
};

document.getElementById('btn-zoom-in').onclick = () => {
    state.camera.zoom = Math.min(state.camera.zoom * 1.2, 2.5);
    updateZoomLabel();
    render();
};
document.getElementById('btn-zoom-out').onclick = () => {
    state.camera.zoom = Math.max(state.camera.zoom / 1.2, 0.25);
    updateZoomLabel();
    render();
};
document.getElementById('btn-reset-view').onclick = fitGraphToScreen;

['node-title', 'node-artist', 'node-genre', 'node-bpm', 'node-key', 'node-memo'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
        const node = state.nodes.find(n => n.id === state.selectedNodeId);
        if (!node) return;
        const field = id.replace('node-', '');
        node[field] = field === 'bpm' ? (parseFloat(e.target.value) || '') : e.target.value;
        if (field === 'genre') {
            updateGenreFilterOptions();
            updateSetlistUI();
        }
        updateSearchCountBadge();
        updateTransitionListUI();
        saveToStorage();
        render();
    });
});

document.getElementById('btn-delete-node').onclick = () => {
    if (!state.selectedNodeId) return;
    deleteNode(state.selectedNodeId);
};

document.getElementById('edge-label').addEventListener('input', (e) => {
    const edge = state.edges.find(item => item.id === state.selectedEdgeId);
    if (!edge) return;
    edge.label = e.target.value;
    updateTransitionListUI();
    saveToStorage();
    render();
});

document.getElementById('edge-style').addEventListener('change', (e) => {
    const edge = state.edges.find(item => item.id === state.selectedEdgeId);
    if (!edge) return;
    edge.style = e.target.value;
    updateTransitionListUI();
    saveToStorage();
    render();
});

document.getElementById('edge-memo').addEventListener('input', (e) => {
    const edge = state.edges.find(item => item.id === state.selectedEdgeId);
    if (!edge) return;
    edge.memo = e.target.value;
    updateTransitionListUI();
    saveToStorage();
    render();
});

document.querySelectorAll('.preset-tag').forEach(btn => {
    btn.onclick = () => {
        const edge = state.edges.find(item => item.id === state.selectedEdgeId);
        if (!edge) return;
        edge.label = btn.textContent;
        document.getElementById('edge-label').value = btn.textContent;
        updateTransitionListUI();
        saveToStorage();
        render();
    };
});

document.getElementById('btn-reverse-edge').onclick = () => {
    if (state.selectedEdgeId) reverseEdge(state.selectedEdgeId);
};

document.getElementById('btn-delete-edge').onclick = () => {
    if (state.selectedEdgeId) deleteEdge(state.selectedEdgeId);
};

function updateGenreFilterOptions() {
    const genres = Array.from(
        new Set(
            state.nodes
                .map(n => (n.genre || '').trim())
                .filter(g => g.length > 0)
        )
    ).sort((a, b) => a.localeCompare(b));

    if (state.selectedGenreFilter && !genres.includes(state.selectedGenreFilter)) {
        state.selectedGenreFilter = '';
    }

    ['genre-filter', 'genre-filter-mobile'].forEach((selectId, idx) => {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        const defaultLabel = idx === 0 ? '全ジャンル (All)' : '全ジャンル';
        sel.innerHTML = `<option value="">${defaultLabel}</option>`;
        genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            if (g === state.selectedGenreFilter) opt.selected = true;
            sel.appendChild(opt);
        });
    });
}

function handleGenreFilterChange(val) {
    state.selectedGenreFilter = val;
    const desktopSel = document.getElementById('genre-filter');
    const mobileSel = document.getElementById('genre-filter-mobile');
    if (desktopSel) desktopSel.value = val;
    if (mobileSel) mobileSel.value = val;
    updateSearchCountBadge();
    render();
}

document.getElementById('genre-filter').addEventListener('change', e => handleGenreFilterChange(e.target.value));
document.getElementById('genre-filter-mobile').addEventListener('change', e => handleGenreFilterChange(e.target.value));

function handleSearchInput(val) {
    state.searchQuery = val;
    const inputEl = document.getElementById('search-input');
    if (inputEl && inputEl.value !== val) inputEl.value = val;
    const clearBtn = document.getElementById('btn-clear-search');
    if (val) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
    updateSearchCountBadge();
    render();
}
document.getElementById('search-input').addEventListener('input', e => handleSearchInput(e.target.value));
document.getElementById('btn-clear-search').onclick = () => handleSearchInput('');

// ==========================================
// 13. 初期化エントリーポイント
// ==========================================
if (typeof ResizeObserver !== 'undefined') {
    const canvasResizeObserver = new ResizeObserver(() => {
        resizeCanvas();
    });
    canvasResizeObserver.observe(container);
}

window.addEventListener('resize', () => {
    syncLeftSidebarToggleButton();
    syncSidebarToggleButton();
    syncSphereModeUI();
    resizeCanvas();
});

window.onload = function () {
    lucide.createIcons();
    const loaded = loadFromStorage();
    if (!loaded) {
        const sample = getSampleData();
        state.nodes = sample.nodes;
        state.edges = sample.edges;
        state.setlists = sample.setlists;
        state.activeSetlistId = sample.activeSetlistId;
        saveToStorage();
    }
    updateGenreFilterOptions();
    updateSearchCountBadge();
    updateInspector();
    updateTransitionListUI();
    updateSetlistUI();
    syncLeftSidebarToggleButton();
    syncSidebarToggleButton();
    resizeCanvas();
    fitGraphToScreen();
    requestAnimationFrame(() => {
        resizeCanvas();
        fitGraphToScreen();
    });
};
