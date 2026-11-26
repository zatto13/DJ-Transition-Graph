// ==========================================
// 4. Canvas セットアップ & 座標変換
// ==========================================
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
}

function screenToWorld(sx, sy) {
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
        x: (sx - cx - state.camera.x) / state.camera.zoom,
        y: (sy - cy - state.camera.y) / state.camera.zoom
    };
}

function worldToScreen(wx, wy) {
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
        x: wx * state.camera.zoom + cx + state.camera.x,
        y: wy * state.camera.zoom + cy + state.camera.y
    };
}

function fitGraphToScreen() {
    sanitizeGraphCoordinates();
    if (state.nodes.length === 0) {
        state.camera = { x: 0, y: 0, zoom: 1 };
        updateZoomLabel();
        render();
        return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
        minX = Math.min(minX, n.x - NODE_WIDTH / 2);
        maxX = Math.max(maxX, n.x + NODE_WIDTH / 2);
        minY = Math.min(minY, n.y - NODE_HEIGHT / 2);
        maxY = Math.max(maxY, n.y + NODE_HEIGHT / 2);
    });

    const rect = container.getBoundingClientRect();
    const padding = 100;
    const graphW = Math.max(maxX - minX, 200);
    const graphH = Math.max(maxY - minY, 200);
    const scaleX = (rect.width - padding * 2) / graphW;
    const scaleY = (rect.height - padding * 2) / graphH;
    const zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 1.35);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    state.camera.zoom = zoom;
    state.camera.x = -centerX * zoom;
    state.camera.y = -centerY * zoom;
    updateZoomLabel();
    render();
}

function updateZoomLabel() {
    document.getElementById('zoom-level').textContent = `${Math.round(state.camera.zoom * 100)}%`;
}

function focusCameraOnEdge(edge) {
    const src = state.nodes.find(n => n.id === edge.source);
    const tgt = state.nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return;
    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2;
    state.camera.x = -midX * state.camera.zoom;
    state.camera.y = -midY * state.camera.zoom;
    render();
}

function focusCameraOnNode(node) {
    if (!node) return;
    state.camera.x = -node.x * state.camera.zoom;
    state.camera.y = -node.y * state.camera.zoom;
    render();
}

// ==========================================
// 5. 幾何計算（ベジェ曲線・矩形交点・ヒットテスト）
// ==========================================
function getEdgeCurveOffset(edge) {
    const hasReverse = state.edges.some(
        e => e.id !== edge.id && e.source === edge.target && e.target === edge.source
    );
    const sameDirEdges = state.edges.filter(
        e => e.source === edge.source && e.target === edge.target
    );
    const dirIndex = sameDirEdges.findIndex(e => e.id === edge.id);

    let offset = 0;
    if (hasReverse) {
        offset += 34;
    }
    if (sameDirEdges.length > 1) {
        offset += (dirIndex - (sameDirEdges.length - 1) / 2) * 32;
    }
    return offset;
}

function computeEdgeGeometry(edge) {
    const src = state.nodes.find(n => n.id === edge.source);
    const tgt = state.nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return null;

    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;

    const curveOffset = getEdgeCurveOffset(edge);
    const midX = (src.x + tgt.x) / 2 + nx * curveOffset;
    const midY = (src.y + tgt.y) / 2 + ny * curveOffset;

    const srcScale = getNodeDepthMetrics(src).scale;
    const tgtScale = getNodeDepthMetrics(tgt).scale;
    const start = clipLineToRect(src.x, src.y, midX, midY, NODE_WIDTH * srcScale + 6, NODE_HEIGHT * srcScale + 6);
    const end = clipLineToRect(tgt.x, tgt.y, midX, midY, NODE_WIDTH * tgtScale + 10, NODE_HEIGHT * tgtScale + 10);

    const labelX = 0.25 * start.x + 0.5 * midX + 0.25 * end.x;
    const labelY = 0.25 * start.y + 0.5 * midY + 0.25 * end.y;

    return { start, control: { x: midX, y: midY }, end, labelPos: { x: labelX, y: labelY } };
}

function clipLineToRect(cx, cy, tx, ty, w, h) {
    const dx = tx - cx;
    const dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    const halfW = w / 2;
    const halfH = h / 2;
    const scaleX = Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity;
    const scaleY = Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity;
    const t = Math.min(scaleX, scaleY);

    return {
        x: cx + dx * t,
        y: cy + dy * t
    };
}

function getNodeAt(wx, wy) {
    const ordered = state.sphereMode
        ? [...state.nodes].sort((a, b) => (a.z || 0) - (b.z || 0))
        : state.nodes;
    for (let i = ordered.length - 1; i >= 0; i--) {
        const n = ordered[i];
        const sc = getNodeDepthMetrics(n).scale;
        const hw = (NODE_WIDTH * sc) / 2;
        const hh = (NODE_HEIGHT * sc) / 2;
        if (
            wx >= n.x - hw &&
            wx <= n.x + hw &&
            wy >= n.y - hh &&
            wy <= n.y + hh
        ) {
            return n;
        }
    }
    return null;
}

function getEdgeAt(wx, wy) {
    const threshold = 10 / state.camera.zoom;
    for (let i = state.edges.length - 1; i >= 0; i--) {
        const edge = state.edges[i];
        const geom = computeEdgeGeometry(edge);
        if (!geom) continue;

        if (Math.hypot(wx - geom.labelPos.x, wy - geom.labelPos.y) < threshold + 16) {
            return edge;
        }

        const steps = 24;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const mt = 1 - t;
            const px = mt * mt * geom.start.x + 2 * mt * t * geom.control.x + t * t * geom.end.x;
            const py = mt * mt * geom.start.y + 2 * mt * t * geom.control.y + t * t * geom.end.y;
            if (Math.hypot(wx - px, wy - py) <= threshold) {
                return edge;
            }
        }
    }
    return null;
}

// ==========================================
// 6. レンダリングエンジン (HTML5 Canvas)
// ==========================================
function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function isNodeMatched(node) {
    if (state.selectedGenreFilter) {
        const nodeGenre = (node.genre || '').trim();
        if (nodeGenre !== state.selectedGenreFilter) {
            return false;
        }
    }

    const rawQuery = state.searchQuery.trim().toLowerCase();
    if (!rawQuery) return true;

    const terms = rawQuery.split(/\s+/);
    const searchableText = [
        node.title || '',
        node.artist || '',
        node.memo || '',
        node.genre || '',
        node.bpm !== undefined && node.bpm !== '' ? String(node.bpm) : '',
        node.key || ''
    ].join(' ').toLowerCase();

    return terms.every(term => searchableText.includes(term));
}

function isEdgeMatched(edge) {
    const rawQuery = state.searchQuery.trim().toLowerCase();
    if (!rawQuery) return false;
    const terms = rawQuery.split(/\s+/);
    const searchableText = [
        edge.label || '',
        edge.memo || ''
    ].join(' ').toLowerCase();
    return terms.every(term => searchableText.includes(term));
}

function updateSearchCountBadge() {
    const badge = document.getElementById('search-match-count');
    if (!badge) return;
    const hasText = state.searchQuery.trim().length > 0;
    const hasGenre = state.selectedGenreFilter !== '';
    if (!hasText && !hasGenre) {
        badge.classList.add('hidden');
        return;
    }
    const matchedCount = state.nodes.filter(n => isNodeMatched(n)).length;
    badge.textContent = `${matchedCount}件`;
    badge.classList.remove('hidden');
}

function getFocusVisibility() {
    const hasTextSearch = state.searchQuery.trim().length > 0;
    const hasSearch = hasTextSearch || state.selectedGenreFilter !== '';
    const activeTracks = Array.isArray(getActiveSetlistTracks()) ? getActiveSetlistTracks() : [];
    const useSetlistHighlight = state.setlistMode && activeTracks.length > 0 && !hasSearch;
    const activeNodeId = state.selectedNodeId;
    const useFocus = state.focusMode && activeNodeId !== null && !hasSearch && !useSetlistHighlight;

    const highlightedNodes = new Set();
    const highlightedEdges = new Set();
    const setlistNodeSet = new Set(activeTracks);
    const setlistEdgePairSet = new Set();

    if (useSetlistHighlight) {
        activeTracks.forEach((id, idx) => {
            highlightedNodes.add(id);
            if (idx > 0) {
                setlistEdgePairSet.add(`${activeTracks[idx - 1]}->${id}`);
            }
        });
        state.edges.forEach(e => {
            if (setlistEdgePairSet.has(`${e.source}->${e.target}`)) {
                highlightedEdges.add(e.id);
            }
        });
    } else if (useFocus) {
        highlightedNodes.add(activeNodeId);
        state.edges.forEach(e => {
            if (e.source === activeNodeId || e.target === activeNodeId) {
                highlightedEdges.add(e.id);
                highlightedNodes.add(e.source);
                highlightedNodes.add(e.target);
            }
        });
    }

    return {
        hasTextSearch,
        hasSearch,
        useSetlistHighlight,
        setlistNodeSet,
        setlistEdgePairSet,
        useFocus,
        highlightedNodes,
        highlightedEdges
    };
}

function drawGrid(width, height) {
    const step = 40 * state.camera.zoom;
    if (step < 10) return;

    const offsetX = (width / 2 + state.camera.x) % step;
    const offsetY = (height / 2 + state.camera.y) % step;

    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    for (let x = offsetX; x < width; x += step) {
        for (let y = offsetY; y < height; y += step) {
            ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
    }
}

function drawSphereWireframe() {
    const maxR = Math.max(280, state.sphereMaxRadius || 480);
    const shells = [maxR * 0.45, maxR * 0.85];
    const yaw = state.sphereRot.yaw;
    const pitch = state.sphereRot.pitch;

    ctx.save();
    // 中心核（重力原点）のマーカー
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();

    shells.forEach((shellR, sIdx) => {
        ctx.strokeStyle = sIdx === 0 ? 'rgba(6, 182, 212, 0.10)' : 'rgba(139, 92, 246, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);

        // 赤道・緯線リング（phi = -30°, 0°, +30°）
        [-Math.PI / 6, 0, Math.PI / 6].forEach(phi => {
            ctx.beginPath();
            const steps = 48;
            for (let i = 0; i <= steps; i++) {
                const theta = (i / steps) * Math.PI * 2;
                const c3 = sphericalToCartesian3D(shellR, theta, phi);
                const rot = rotate3DPoint(c3.x3, c3.y3, c3.z3, yaw, pitch);
                if (i === 0) ctx.moveTo(rot.x, rot.y);
                else ctx.lineTo(rot.x, rot.y);
            }
            ctx.stroke();
        });

        // 経線リング（theta = 0°, 60°, 120°）
        if (sIdx === 1) {
            [0, Math.PI / 3, (2 * Math.PI) / 3].forEach(baseTheta => {
                ctx.beginPath();
                const steps = 48;
                for (let i = 0; i <= steps; i++) {
                    const angle = (i / steps) * Math.PI * 2;
                    const x3 = shellR * Math.cos(angle) * Math.cos(baseTheta);
                    const y3 = shellR * Math.sin(angle);
                    const z3 = shellR * Math.cos(angle) * Math.sin(baseTheta);
                    const rot = rotate3DPoint(x3, y3, z3, yaw, pitch);
                    if (i === 0) ctx.moveTo(rot.x, rot.y);
                    else ctx.lineTo(rot.x, rot.y);
                }
                ctx.stroke();
            });
        }
    });

    ctx.restore();
}

function render() {
    sanitizeGraphCoordinates();
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawGrid(width, height);

    ctx.save();
    ctx.translate(width / 2 + state.camera.x, height / 2 + state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);

    // 擬似3D球座標モード時の球殻ワイヤーフレームガイド描画
    if (state.sphereMode) {
        drawSphereWireframe();
    }

    const {
        hasTextSearch,
        hasSearch,
        useSetlistHighlight,
        setlistNodeSet,
        setlistEdgePairSet,
        useFocus,
        highlightedNodes,
        highlightedEdges
    } = getFocusVisibility();

    // 1. エッジ（つなぎ矢印）描画
    state.edges.forEach(edge => {
        const geom = computeEdgeGeometry(edge);
        if (!geom) return;

        const isSelected = edge.id === state.selectedEdgeId;
        const isHovered = edge.id === state.hoveredEdgeId;
        const isOutOfSelected = state.selectedNodeId && edge.source === state.selectedNodeId;
        const edgeSearchHit = hasTextSearch && isEdgeMatched(edge);
        const isSetlistEdge = useSetlistHighlight && setlistEdgePairSet.has(`${edge.source}->${edge.target}`);

        const srcNodeObj = state.nodes.find(n => n.id === edge.source);
        const tgtNodeObj = state.nodes.find(n => n.id === edge.target);
        const avgEdgeDepthAlpha = (state.sphereMode && srcNodeObj && tgtNodeObj)
            ? (getNodeDepthMetrics(srcNodeObj).alphaFactor + getNodeDepthMetrics(tgtNodeObj).alphaFactor) * 0.5
            : 1;

        let alpha = 0.85 * avgEdgeDepthAlpha;
        if (useSetlistHighlight) {
            alpha = isSetlistEdge || isSelected ? 1.0 : 0.12;
        } else if (useFocus && !highlightedEdges.has(edge.id) && !isSelected) {
            alpha = 0.12;
        } else if (hasSearch) {
            const srcMatch = isNodeMatched(srcNodeObj || { title: '' });
            const tgtMatch = isNodeMatched(tgtNodeObj || { title: '' });
            if (!srcMatch && !tgtMatch && !edgeSearchHit) alpha = 0.14;
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        const strokeColor = isSelected
            ? '#ffffff'
            : (isSetlistEdge
                ? '#10b981'
                : (edgeSearchHit ? '#22d3ee' : (isOutOfSelected ? '#06b6d4' : (edge.color || '#06b6d4'))));
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected || isHovered || edgeSearchHit || isSetlistEdge ? 3.2 : (isOutOfSelected ? 2.5 : 1.8);

        if (edge.style === 'dashed') {
            ctx.setLineDash([6, 5]);
        } else {
            ctx.setLineDash([]);
        }

        if (isSelected || isOutOfSelected || edgeSearchHit || isSetlistEdge) {
            ctx.shadowColor = strokeColor;
            ctx.shadowBlur = 12;
        }

        ctx.beginPath();
        ctx.moveTo(geom.start.x, geom.start.y);
        ctx.quadraticCurveTo(geom.control.x, geom.control.y, geom.end.x, geom.end.y);
        ctx.stroke();

        ctx.setLineDash([]);
        const angle = Math.atan2(geom.end.y - geom.control.y, geom.end.x - geom.control.x);
        const headLen = isSelected || isHovered || edgeSearchHit || isSetlistEdge ? 12 : 10;
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(geom.end.x, geom.end.y);
        ctx.lineTo(
            geom.end.x - headLen * Math.cos(angle - Math.PI / 6),
            geom.end.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            geom.end.x - headLen * Math.cos(angle + Math.PI / 6),
            geom.end.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        const labelText = (edge.label || '').trim();
        const stars = edge.rating ? `★${edge.rating}` : '';
        const fullText = [labelText, stars].filter(Boolean).join(' ');

        if (fullText) {
            ctx.font = '500 10px Inter, sans-serif';
            const textMetrics = ctx.measureText(fullText);
            const badgeW = textMetrics.width + 14;
            const badgeH = 20;
            const bx = geom.labelPos.x - badgeW / 2;
            const by = geom.labelPos.y - badgeH / 2;

            roundRectPath(ctx, bx, by, badgeW, badgeH, 6);
            ctx.fillStyle = isSelected ? '#ec4899' : '#12141d';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = isSelected ? '#fbcfe8' : strokeColor;
            ctx.stroke();

            ctx.fillStyle = isSelected ? '#ffffff' : '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fullText, geom.labelPos.x, geom.labelPos.y + 0.5);
        }

        ctx.restore();
    });

    // 2. ドラッグ中の仮つなぎライン描画
    if (state.isDrawingEdge && state.drawEdgeSourceId) {
        const src = state.nodes.find(n => n.id === state.drawEdgeSourceId);
        if (src) {
            ctx.save();
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(state.pointerWorld.x, state.pointerWorld.y);
            ctx.stroke();

            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.arc(state.pointerWorld.x, state.pointerWorld.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // 3. ノード（楽曲カード）描画（球座標モード時は奥から手前へZソート＆遠近スケール適用）
    const activeTracks = Array.isArray(getActiveSetlistTracks()) ? getActiveSetlistTracks() : [];
    const renderNodes = state.sphereMode
        ? [...state.nodes].sort((a, b) => (a.z || 0) - (b.z || 0))
        : state.nodes;

    renderNodes.forEach(node => {
        const isSelected = node.id === state.selectedNodeId;
        const isHovered = node.id === state.hoveredNodeId;
        const isConnectSource = node.id === state.connectSourceId;
        const setlistIndex = activeTracks.indexOf(node.id);
        const isInActiveSetlist = useSetlistHighlight && setlistNodeSet.has(node.id);
        const isSearchHighlight = hasSearch && isNodeMatched(node);
        const isPinnedDrag = state.realtimeGravity && state.isDraggingNode && state.dragNodeId === node.id;
        const depth = getNodeDepthMetrics(node);

        let alpha = 1;
        if (useSetlistHighlight && !isInActiveSetlist && !isSelected) {
            alpha = 0.16 * (state.sphereMode ? (0.5 + 0.5 * depth.alphaFactor) : 1);
        } else if (useFocus && !highlightedNodes.has(node.id)) {
            alpha = 0.18 * (state.sphereMode ? (0.5 + 0.5 * depth.alphaFactor) : 1);
        } else if (hasSearch && !isSearchHighlight) {
            alpha = 0.14;
        } else if (!isSelected && !isHovered && !isSearchHighlight && !isInActiveSetlist) {
            alpha *= depth.alphaFactor;
        } else if (state.sphereMode && !isSelected && !isHovered) {
            // フォーカス中の隣接ノードでも奥行き感を残す
            alpha *= (0.45 + 0.55 * depth.alphaFactor);
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(node.x, node.y);
        if (depth.scale !== 1) {
            ctx.scale(depth.scale, depth.scale);
        }

        const x = -NODE_WIDTH / 2;
        const y = -NODE_HEIGHT / 2;
        const accentColor = node.color || '#06b6d4';

        if (isSelected || isConnectSource) {
            ctx.shadowColor = isConnectSource ? '#ec4899' : accentColor;
            ctx.shadowBlur = 18;
        } else if (isPinnedDrag) {
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 20;
        } else if (isInActiveSetlist) {
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 20;
        } else if (isSearchHighlight) {
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 18;
        } else if (isHovered) {
            ctx.shadowColor = 'rgba(255,255,255,0.18)';
            ctx.shadowBlur = 12;
        }

        roundRectPath(ctx, x, y, NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS);
        ctx.fillStyle = isSelected
            ? '#1e2336'
            : (isInActiveSetlist ? '#142623' : (isSearchHighlight ? '#182234' : '#151824'));
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.lineWidth = isSelected || isConnectSource || isSearchHighlight || isInActiveSetlist || isPinnedDrag ? 2.2 : 1.2;
        ctx.strokeStyle = isConnectSource
            ? '#ec4899'
            : (isPinnedDrag
                ? '#f59e0b'
                : (isSelected
                    ? '#ffffff'
                    : (isInActiveSetlist
                        ? '#10b981'
                        : (isSearchHighlight ? '#22d3ee' : (isHovered ? accentColor : '#2a2f45')))));
        ctx.stroke();

        ctx.save();
        roundRectPath(ctx, x, y, NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS);
        ctx.clip();
        ctx.fillStyle = accentColor;
        ctx.fillRect(x, y, 5, NODE_HEIGHT);
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 12.5px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const maxTextW = NODE_WIDTH - 24;
        let titleText = String(node.title ?? 'Untitled') || 'Untitled';
        if (ctx.measureText(titleText).width > maxTextW) {
            while (titleText.length > 0 && ctx.measureText(titleText + '…').width > maxTextW) {
                titleText = titleText.slice(0, -1);
            }
            titleText += '…';
        }
        ctx.fillText(titleText, x + 14, y + 11);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '400 10.5px Inter, sans-serif';
        let artistText = String(node.artist ?? 'Unknown Artist') || 'Unknown Artist';
        if (ctx.measureText(artistText).width > maxTextW) {
            while (artistText.length > 0 && ctx.measureText(artistText + '…').width > maxTextW) {
                artistText = artistText.slice(0, -1);
            }
            artistText += '…';
        }
        ctx.fillText(artistText, x + 14, y + 28);

        const bpmText = `${node.bpm || '---'} BPM`;
        ctx.font = '700 10px "JetBrains Mono", monospace';
        const bpmW = ctx.measureText(bpmText).width + 10;
        roundRectPath(ctx, x + 14, y + 47, bpmW, 17, 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(bpmText, x + 19, y + 50);

        let cursorX = x + 14 + bpmW + 5;

        if (node.key !== undefined && node.key !== null && String(node.key).trim() !== '') {
            const keyText = String(node.key);
            const keyW = ctx.measureText(keyText).width + 10;
            roundRectPath(ctx, cursorX, y + 47, keyW, 17, 4);
            ctx.fillStyle = `${accentColor}26`;
            ctx.fill();
            ctx.fillStyle = accentColor;
            ctx.fillText(keyText, cursorX + 5, y + 50);
            cursorX += keyW + 5;
        }

        if (node.genre !== undefined && node.genre !== null && String(node.genre).trim() !== '') {
            ctx.font = '600 9.5px Inter, sans-serif';
            let genreText = String(node.genre).trim();
            const maxGenreW = (x + NODE_WIDTH - 18) - cursorX;
            if (maxGenreW > 24) {
                if (ctx.measureText(genreText).width + 10 > maxGenreW) {
                    while (genreText.length > 0 && ctx.measureText(genreText + '…').width + 10 > maxGenreW) {
                        genreText = genreText.slice(0, -1);
                    }
                    genreText += '…';
                }
                const genreW = ctx.measureText(genreText).width + 10;
                roundRectPath(ctx, cursorX, y + 47, genreW, 17, 8.5);
                ctx.fillStyle = 'rgba(139, 92, 246, 0.18)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.45)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.fillStyle = '#ddd6fe';
                ctx.fillText(genreText, cursorX + 5, y + 50.5);
            }
        }

        if (node.memo !== undefined && node.memo !== null && String(node.memo).trim() !== '') {
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(x + NODE_WIDTH - 12, y + NODE_HEIGHT - 12, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        if (state.setlistMode && setlistIndex !== -1) {
            const badgeR = 11;
            const bx = x + NODE_WIDTH - 4;
            const by = y + 4;
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#090a0f';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#090a0f';
            ctx.font = '700 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(setlistIndex + 1), bx, by + 0.5);
        }

        ctx.restore();
    });

    ctx.restore();
}
