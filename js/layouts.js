// ==========================================
// 12. 自動整列レイアウト & リアルタイム重力シミュレーション
// ==========================================
const layoutMenuWrapper = document.getElementById('layout-menu-wrapper');
const layoutMenuBtn = document.getElementById('btn-layout-menu');
const layoutDropdown = document.getElementById('layout-dropdown');

layoutMenuBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dataDropdown.classList.add('hidden');
    layoutDropdown.classList.toggle('hidden');
});

let layoutAnimFrame = null;
function animateNodesToPositions(targetMap, label) {
    if (state.nodes.length === 0) {
        showToast('整列する楽曲がありません');
        return;
    }
    if (layoutAnimFrame) cancelAnimationFrame(layoutAnimFrame);

    const startPositions = new Map();
    state.nodes.forEach(n => {
        startPositions.set(n.id, { x: n.x, y: n.y });
    });

    const duration = 420;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);

        state.nodes.forEach(n => {
            const start = startPositions.get(n.id);
            const target = targetMap.get(n.id);
            if (start && target) {
                n.x = Math.round(start.x + (target.x - start.x) * ease);
                n.y = Math.round(start.y + (target.y - start.y) * ease);
            }
        });

        render();

        if (t < 1) {
            layoutAnimFrame = requestAnimationFrame(step);
        } else {
            layoutAnimFrame = null;
            sanitizeGraphCoordinates();
            saveToStorage();
            fitGraphToScreen();
            showToast(`${label}で整列しました`);
        }
    }

    layoutAnimFrame = requestAnimationFrame(step);
}

// 1. BPM順（左→右）レイアウト
function applyBpmLayout() {
    if (state.realtimeGravity) setRealtimeGravity(false, true);
    exitSphereMode();
    const withBpm = state.nodes.filter(n => n.bpm !== '' && !isNaN(Number(n.bpm)));
    const withoutBpm = state.nodes.filter(n => n.bpm === '' || isNaN(Number(n.bpm)));

    withBpm.sort((a, b) => Number(a.bpm) - Number(b.bpm) || a.title.localeCompare(b.title));

    const columns = [];
    withBpm.forEach(node => {
        const bpmVal = Number(node.bpm);
        const lastCol = columns[columns.length - 1];
        if (lastCol && Math.abs(bpmVal - lastCol.baseBpm) <= 2.5) {
            lastCol.nodes.push(node);
        } else {
            columns.push({ baseBpm: bpmVal, nodes: [node] });
        }
    });

    if (withoutBpm.length > 0) {
        columns.push({ baseBpm: Infinity, nodes: withoutBpm });
    }

    const colSpacing = 265;
    const rowSpacing = 112;
    const totalW = (columns.length - 1) * colSpacing;
    const targetMap = new Map();

    columns.forEach((col, cIdx) => {
        const x = -totalW / 2 + cIdx * colSpacing;
        const colH = (col.nodes.length - 1) * rowSpacing;
        col.nodes.forEach((node, rIdx) => {
            const y = -colH / 2 + rIdx * rowSpacing;
            targetMap.set(node.id, { x, y });
        });
    });

    animateNodesToPositions(targetMap, 'BPM順（左→右）');
}

// 2. ジャンル別クラスターレイアウト
function applyGenreClusterLayout() {
    if (state.realtimeGravity) setRealtimeGravity(false, true);
    exitSphereMode();
    const groups = new Map();
    state.nodes.forEach(node => {
        const g = (node.genre || '').trim() || '未分類 (No Genre)';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(node);
    });

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
    const clusterCols = Math.max(1, Math.ceil(Math.sqrt(sortedGroups.length)));

    const clusters = sortedGroups.map(([genreName, nodes]) => {
        nodes.sort((a, b) => (Number(a.bpm) || 999) - (Number(b.bpm) || 999));
        const innerCols = nodes.length <= 2 ? 1 : 2;
        const innerRows = Math.ceil(nodes.length / innerCols);
        const w = innerCols * 235;
        const h = innerRows * 105;
        return { genreName, nodes, innerCols, w, h };
    });

    const numRows = Math.ceil(clusters.length / clusterCols);
    const colWidths = new Array(clusterCols).fill(0);
    const rowHeights = new Array(numRows).fill(0);

    clusters.forEach((cl, idx) => {
        const r = Math.floor(idx / clusterCols);
        const c = idx % clusterCols;
        colWidths[c] = Math.max(colWidths[c], cl.w);
        rowHeights[r] = Math.max(rowHeights[r], cl.h);
    });

    const clusterGapX = 120;
    const clusterGapY = 110;
    const totalGridW = colWidths.reduce((s, w) => s + w, 0) + (clusterCols - 1) * clusterGapX;
    const totalGridH = rowHeights.reduce((s, h) => s + h, 0) + (numRows - 1) * clusterGapY;

    const colOffsets = [];
    let accX = -totalGridW / 2;
    for (let c = 0; c < clusterCols; c++) {
        colOffsets.push(accX + colWidths[c] / 2);
        accX += colWidths[c] + clusterGapX;
    }

    const rowOffsets = [];
    let accY = -totalGridH / 2;
    for (let r = 0; r < numRows; r++) {
        rowOffsets.push(accY + rowHeights[r] / 2);
        accY += rowHeights[r] + clusterGapY;
    }

    const targetMap = new Map();
    clusters.forEach((cl, idx) => {
        const r = Math.floor(idx / clusterCols);
        const c = idx % clusterCols;
        const centerX = colOffsets[c];
        const centerY = rowOffsets[r];

        const innerRows = Math.ceil(cl.nodes.length / cl.innerCols);
        const innerW = (cl.innerCols - 1) * 235;
        const innerH = (innerRows - 1) * 105;

        cl.nodes.forEach((node, nIdx) => {
            const ic = nIdx % cl.innerCols;
            const ir = Math.floor(nIdx / cl.innerCols);
            const x = centerX - innerW / 2 + ic * 235;
            const y = centerY - innerH / 2 + ir * 105;
            targetMap.set(node.id, { x, y });
        });
    });

    animateNodesToPositions(targetMap, 'ジャンル別クラスター');
}

// 3. 力学整列（放射線・一直線継承＋矩形衝突解消）
function applyForceLayout() {
    if (state.realtimeGravity) setRealtimeGravity(false, true);
    exitSphereMode();
    const count = state.nodes.length;
    if (count === 0) return;

    const inDeg = new Map(state.nodes.map(n => [n.id, 0]));
    const outDeg = new Map(state.nodes.map(n => [n.id, 0]));
    const outAdj = new Map(state.nodes.map(n => [n.id, []]));

    state.edges.forEach(e => {
        if (inDeg.has(e.target) && outDeg.has(e.source) && e.source !== e.target) {
            inDeg.set(e.target, inDeg.get(e.target) + 1);
            outDeg.set(e.source, outDeg.get(e.source) + 1);
            outAdj.get(e.source).push(e.target);
        }
    });

    const visited = new Set();
    const depthMap = new Map();
    const angleMap = new Map();
    const isolatedNodes = [];

    const rootCandidates = state.nodes
        .filter(n => (inDeg.get(n.id) + outDeg.get(n.id)) > 0)
        .sort((a, b) => {
            if (inDeg.get(a.id) === 0 && inDeg.get(b.id) !== 0) return -1;
            if (inDeg.get(b.id) === 0 && inDeg.get(a.id) !== 0) return 1;
            return (outDeg.get(b.id) - inDeg.get(b.id)) - (outDeg.get(a.id) - inDeg.get(a.id));
        });

    state.nodes.forEach(n => {
        if (inDeg.get(n.id) === 0 && outDeg.get(n.id) === 0) {
            isolatedNodes.push(n);
            visited.add(n.id);
        }
    });

    const trees = [];
    rootCandidates.forEach(rootNode => {
        if (visited.has(rootNode.id)) return;
        const treeNodes = [];
        const queue = [rootNode.id];
        visited.add(rootNode.id);
        depthMap.set(rootNode.id, 0);

        while (queue.length > 0) {
            const curr = queue.shift();
            treeNodes.push(curr);
            const d = depthMap.get(curr);
            outAdj.get(curr).forEach(nxt => {
                if (!visited.has(nxt)) {
                    visited.add(nxt);
                    depthMap.set(nxt, d + 1);
                    queue.push(nxt);
                }
            });
        }
        trees.push({ rootId: rootNode.id, nodes: treeNodes });
    });

    const totalTreeNodes = trees.reduce((sum, t) => sum + t.nodes.length, 0);
    let cursorAngle = -Math.PI / 2;

    trees.forEach(tree => {
        const sectorSpan = totalTreeNodes > 0
            ? (2 * Math.PI * tree.nodes.length) / totalTreeNodes
            : (2 * Math.PI) / Math.max(1, trees.length);
        const rootAngle = cursorAngle + sectorSpan / 2;
        cursorAngle += sectorSpan;

        function assignAngles(nodeId, angle, spread) {
            angleMap.set(nodeId, angle);
            const children = outAdj.get(nodeId).filter(
                cid => depthMap.get(cid) === depthMap.get(nodeId) + 1
            );
            if (children.length === 0) return;

            if (children.length === 1) {
                // 一本道は角度を完全継承し、内側から外側へ真っ直ぐ伸ばす
                assignAngles(children[0], angle, spread);
            } else {
                const childSpread = spread / children.length;
                children.forEach((cid, idx) => {
                    const childAngle = angle - spread / 2 + childSpread * (idx + 0.5);
                    assignAngles(cid, childAngle, childSpread * 0.9);
                });
            }
        }

        assignAngles(tree.rootId, rootAngle, Math.min(sectorSpan * 0.85, Math.PI * 1.4));
    });

    const depthBuckets = new Map();
    let maxDepth = 0;
    depthMap.forEach((d, id) => {
        maxDepth = Math.max(maxDepth, d);
        if (!depthBuckets.has(d)) depthBuckets.set(d, []);
        depthBuckets.get(d).push(id);
    });

    const radiusByDepth = new Map();
    let prevRadius = 0;
    for (let d = 0; d <= maxDepth; d++) {
        const bucket = depthBuckets.get(d) || [];
        if (d === 0 && bucket.length === 1) {
            radiusByDepth.set(0, 0);
            prevRadius = 0;
        } else {
            const minRingForCount = (bucket.length * 245) / (2 * Math.PI);
            const r = Math.max(prevRadius + 240, minRingForCount, 240);
            radiusByDepth.set(d, r);
            prevRadius = r;
        }
    }

    const simNodes = [];
    trees.forEach(tree => {
        tree.nodes.forEach(id => {
            const d = depthMap.get(id) || 0;
            const angle = angleMap.get(id) ?? 0;
            const r = radiusByDepth.get(d) ?? 0;
            const tx = Math.cos(angle) * r;
            const ty = Math.sin(angle) * r * 0.8;
            simNodes.push({
                id,
                x: tx,
                y: ty,
                targetX: tx,
                targetY: ty,
                isRoot: r === 0
            });
        });
    });

    if (isolatedNodes.length > 0) {
        const outerR = Math.max(prevRadius + 250, (isolatedNodes.length * 245) / (2 * Math.PI), 320);
        isolatedNodes.forEach((node, idx) => {
            const angle = -Math.PI / 2 + (2 * Math.PI * idx) / isolatedNodes.length;
            const tx = Math.cos(angle) * outerR * 1.1;
            const ty = Math.sin(angle) * outerR * 0.82;
            simNodes.push({
                id: node.id,
                x: tx,
                y: ty,
                targetX: tx,
                targetY: ty,
                isRoot: false
            });
        });
    }

    // 矩形重なり解消パス（カード幅204 + 余白42, 高さ72 + 余白38）
    const reqW = NODE_WIDTH + 42;
    const reqH = NODE_HEIGHT + 38;
    for (let pass = 0; pass < 90; pass++) {
        let moved = false;
        for (let i = 0; i < simNodes.length; i++) {
            for (let j = i + 1; j < simNodes.length; j++) {
                const a = simNodes[i];
                const b = simNodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const overlapX = reqW - Math.abs(dx);
                const overlapY = reqH - Math.abs(dy);

                if (overlapX > 0 && overlapY > 0) {
                    moved = true;
                    if (overlapX < overlapY) {
                        const push = (overlapX / 2 + 1) * (dx >= 0 ? 1 : -1);
                        if (!a.isRoot) a.x -= push;
                        if (!b.isRoot) b.x += push;
                    } else {
                        const push = (overlapY / 2 + 1) * (dy >= 0 ? 1 : -1);
                        if (!a.isRoot) a.y -= push;
                        if (!b.isRoot) b.y += push;
                    }
                }
            }
        }
        simNodes.forEach(s => {
            if (!s.isRoot) {
                s.x += (s.targetX - s.x) * 0.08;
                s.y += (s.targetY - s.y) * 0.08;
            }
        });
        if (!moved) break;
    }

    const targetMap = new Map();
    simNodes.forEach(s => {
        targetMap.set(s.id, {
            x: Math.round(s.x),
            y: Math.round(s.y)
        });
    });

    animateNodesToPositions(targetMap, '力学整列（放射線・終点外側）');
}

// 4. 擬似3D球座標 (r, theta, phi) 重力シミュレーション
// 起点（入力次数0）を中心核 (r≈0) にアンカーし、外向きの動径重力 + 球面クーロン反発 + バネ張力で球殻配置する
const sphereVelocities = new Map();

function syncSphereModeUI() {
    const orbitBtn = document.getElementById('btn-sphere-orbit');
    if (!orbitBtn) return;
    if (state.sphereMode) {
        orbitBtn.classList.remove('hidden');
        orbitBtn.classList.add('flex');
        if (state.sphereOrbitMode) {
            orbitBtn.classList.add('bg-dj-cyan/20', 'text-dj-cyan', 'border-dj-cyan/50');
            orbitBtn.classList.remove('text-slate-300', 'border-transparent');
        } else {
            orbitBtn.classList.remove('bg-dj-cyan/20', 'text-dj-cyan', 'border-dj-cyan/50');
            orbitBtn.classList.add('text-slate-300', 'border-transparent');
        }
    } else {
        orbitBtn.classList.add('hidden');
        orbitBtn.classList.remove('flex');
    }
}

function exitSphereMode() {
    state.sphereMode = false;
    state.sphereOrbitMode = false;
    state.nodes.forEach(n => {
        n.z = 0;
    });
    syncSphereModeUI();
}

function stepSphericalGravityPhysics(steps = 20, coolingFactor = 1.0) {
    const count = state.nodes.length;
    if (count === 0) return;

    const inDeg = new Map(state.nodes.map(n => [n.id, 0]));
    const outDeg = new Map(state.nodes.map(n => [n.id, 0]));
    const outAdj = new Map(state.nodes.map(n => [n.id, []]));

    state.edges.forEach(e => {
        if (inDeg.has(e.target) && outDeg.has(e.source) && e.source !== e.target) {
            inDeg.set(e.target, inDeg.get(e.target) + 1);
            outDeg.set(e.source, outDeg.get(e.source) + 1);
            outAdj.get(e.source).push(e.target);
        }
    });

    // 起点（入力次数0）を特定して中心核アンカーにする
    const roots = state.nodes.filter(n => inDeg.get(n.id) === 0 && outDeg.get(n.id) > 0);
    const anchorIds = new Set(roots.map(r => r.id));

    if (anchorIds.size === 0) {
        const best = state.nodes
            .filter(n => outDeg.get(n.id) > 0)
            .sort((a, b) => (outDeg.get(b.id) - inDeg.get(b.id)) - (outDeg.get(a.id) - inDeg.get(a.id)))[0];
        if (best) anchorIds.add(best.id);
    }

    // BFSで各ノードの最小ホップ深度を算出し、目標球殻半径 targetR を決定
    const depthMap = new Map();
    const queue = [];
    anchorIds.forEach(id => {
        depthMap.set(id, 0);
        queue.push(id);
    });
    while (queue.length > 0) {
        const curr = queue.shift();
        const d = depthMap.get(curr);
        outAdj.get(curr).forEach(nxt => {
            if (!depthMap.has(nxt)) {
                depthMap.set(nxt, d + 1);
                queue.push(nxt);
            }
        });
    }

    const maxDepth = Math.max(1, ...Array.from(depthMap.values()));
    const baseShellStep = Math.max(210, Math.min(280, 180 + Math.sqrt(count) * 14));
    const maxShellRadius = Math.max(360, maxDepth * baseShellStep);
    state.sphereMaxRadius = maxShellRadius;

    // フィボナッチ球面（黄金螺旋）で初期の球座標を均等割り当て
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const simNodes = state.nodes.map((n, idx) => {
        let vel = sphereVelocities.get(n.id);
        if (!vel) {
            vel = { vx: 0, vy: 0, vz: 0 };
            sphereVelocities.set(n.id, vel);
        }

        const inc = inDeg.get(n.id);
        const out = outDeg.get(n.id);
        const isIsolated = inc === 0 && out === 0;
        const isAnchor = anchorIds.has(n.id);
        const isPinned = state.realtimeGravity && state.isDraggingNode && state.dragNodeId === n.id;

        let targetR = baseShellStep * 1.4;
        if (isAnchor) {
            targetR = anchorIds.size === 1 ? 0 : 95;
        } else if (isIsolated) {
            targetR = maxShellRadius * 1.12;
        } else if (depthMap.has(n.id)) {
            const d = depthMap.get(n.id);
            const sinkBonus = out === 0 ? 0.35 : 0;
            targetR = (d + sinkBonus) * baseShellStep;
        }

        // 未初期化または平面状態なら黄金螺旋球面上に初期配置
        if (typeof n.x3 !== 'number' || !Number.isFinite(n.x3) || !state.sphereMode) {
            const tNorm = count > 1 ? idx / (count - 1) : 0.5;
            const yUnit = 1 - tNorm * 1.85; // +0.925 〜 -0.925
            const phi0 = Math.asin(Math.max(-0.92, Math.min(0.92, yUnit)));
            const theta0 = idx * goldenAngle;
            const initR = Math.max(targetR, isAnchor ? 0 : 120);
            const c3 = sphericalToCartesian3D(initR, theta0, phi0);
            n.x3 = c3.x3;
            n.y3 = c3.y3;
            n.z3 = c3.z3;
        }

        return {
            node: n,
            id: n.id,
            x: n.x3,
            y: n.y3,
            z: n.z3,
            vx: isPinned ? 0 : vel.vx,
            vy: isPinned ? 0 : vel.vy,
            vz: isPinned ? 0 : vel.vz,
            targetR,
            isAnchor,
            isIsolated,
            isPinned
        };
    });

    const simMap = new Map(simNodes.map(s => [s.id, s]));
    const idealSpringLen = baseShellStep * 0.95;

    for (let iter = 0; iter < steps; iter++) {
        // 1. 3D球面空間でのクーロン反発力（カード幅を考慮してXY方向をやや強めに反発）
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const a = simNodes[i];
                const b = simNodes[j];
                const dx = b.x - a.x;
                const dy = (b.y - a.y) * 1.45;
                const dz = b.z - a.z;
                const dist = Math.hypot(dx, dy, dz) || 1;

                const minSep = 250;
                if (dist < minSep * 2.1) {
                    const force = ((minSep * minSep) / (dist * dist)) * 11 * coolingFactor;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force * 0.65;
                    const fz = (dz / dist) * force;
                    if (!a.isPinned) { a.vx -= fx; a.vy -= fy; a.vz -= fz; }
                    if (!b.isPinned) { b.vx += fx; b.vy += fy; b.vz += fz; }
                }
            }
        }

        // 2. つなぎエッジのバネ張力 ＋ 外向き動径方向ガイド（子ノードが親の外側球殻へ向かう）
        state.edges.forEach(edge => {
            const src = simMap.get(edge.source);
            const tgt = simMap.get(edge.target);
            if (!src || !tgt || src === tgt) return;

            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dz = tgt.z - src.z;
            const dist = Math.hypot(dx, dy, dz) || 1;
            const displacement = dist - idealSpringLen;
            const springForce = displacement * 0.048 * coolingFactor;

            const fx = (dx / dist) * springForce;
            const fy = (dy / dist) * springForce;
            const fz = (dz / dist) * springForce;
            if (!src.isPinned) { src.vx += fx * 0.65; src.vy += fy * 0.65; src.vz += fz * 0.65; }
            if (!tgt.isPinned) { tgt.vx -= fx; tgt.vy -= fy; tgt.vz -= fz; }

            // 到着曲が常に親より外側の球殻へ押し出される動径バイアス
            const srcR = Math.hypot(src.x, src.y, src.z);
            const tgtR = Math.hypot(tgt.x, tgt.y, tgt.z);
            if (tgtR < srcR + baseShellStep * 0.65 && !tgt.isAnchor && !tgt.isPinned) {
                const outDirLen = tgtR || 1;
                const pushOut = 4.6 * coolingFactor;
                tgt.vx += (tgt.x / outDirLen) * pushOut;
                tgt.vy += (tgt.y / outDirLen) * pushOut;
                tgt.vz += (tgt.z / outDirLen) * pushOut;
            }
        });

        // 3. 球座標動径ポテンシャル（内から外への重力場）＋ 速度積分
        simNodes.forEach(s => {
            if (s.isPinned) {
                s.vx = 0;
                s.vy = 0;
                s.vz = 0;
                return;
            }

            const curR = Math.hypot(s.x, s.y, s.z);
            if (s.isAnchor && s.targetR === 0) {
                // 単一ルートは原点 (0, 0, 0) に静かにアンカー
                s.vx += -s.x * 0.16 * coolingFactor;
                s.vy += -s.y * 0.16 * coolingFactor;
                s.vz += -s.z * 0.16 * coolingFactor;
            } else {
                const safeR = curR || 1;
                const ux = curR > 1e-3 ? s.x / safeR : Math.cos(Math.random() * Math.PI * 2);
                const uy = curR > 1e-3 ? s.y / safeR : (Math.random() - 0.5);
                const uz = curR > 1e-3 ? s.z / safeR : Math.sin(Math.random() * Math.PI * 2);

                // 目標球殻半径 targetR への動径復元力 ＋ 外向き重力バイアス
                const radialDiff = s.targetR - curR;
                const radialK = s.isAnchor ? 0.11 : (s.isIsolated ? 0.07 : 0.055);
                const radialForce = radialDiff * radialK * coolingFactor;

                s.vx += ux * radialForce;
                s.vy += uy * radialForce;
                s.vz += uz * radialForce;
            }

            s.vx *= 0.76;
            s.vy *= 0.76;
            s.vz *= 0.76;

            s.x += s.vx;
            s.y += s.vy;
            s.z += s.vz;
        });
    }

    // 3D直交座標から球座標 (r, theta, phi) を書き戻し、2D画面座標へ投影
    simNodes.forEach(s => {
        if (!s.isPinned) {
            s.node.x3 = s.x;
            s.node.y3 = s.y;
            s.node.z3 = s.z;
            const r = Math.hypot(s.x, s.y, s.z);
            s.node.r = r;
            s.node.theta = Math.atan2(s.z, s.x);
            s.node.phi = r > 1e-4 ? Math.asin(Math.max(-1, Math.min(1, s.y / r))) : 0;
        }
        sphereVelocities.set(s.id, { vx: s.vx, vy: s.vy, vz: s.vz });
    });

    state.sphereMode = true;
    projectAllSphereNodes();
}

// 単発実行の擬似球座標・重力整列（アニメーション付き）
function applyGravityLayout() {
    if (state.nodes.length === 0) {
        showToast('整列する楽曲がありません');
        return;
    }
    const originalPositions = state.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
    sphereVelocities.clear();
    state.sphereMode = false; // 黄金螺旋シードから綺麗に球殻展開

    for (let wave = 0; wave < 14; wave++) {
        const cooling = 1 - (wave / 14) * 0.72;
        stepSphericalGravityPhysics(20, cooling);
    }

    const targetMap = new Map();
    state.nodes.forEach(n => {
        targetMap.set(n.id, { x: n.x, y: n.y });
    });

    originalPositions.forEach(orig => {
        const n = state.nodes.find(item => item.id === orig.id);
        if (n) {
            n.x = orig.x;
            n.y = orig.y;
        }
    });

    syncSphereModeUI();
    animateNodesToPositions(targetMap, '擬似球座標・重力整列（内→外）');
}

// リアルタイム球座標重力シミュレーション（1秒に1回の描画＆保存）
let gravityIntervalId = null;

function runRealtimeGravityTick() {
    if (!state.realtimeGravity) return;
    stepSphericalGravityPhysics(18, 0.65);
    render();
    saveToStorage();
}

function setRealtimeGravity(enabled, silent = false) {
    state.realtimeGravity = enabled;
    if (gravityIntervalId) {
        clearInterval(gravityIntervalId);
        gravityIntervalId = null;
    }

    const headerBtn = document.getElementById('btn-realtime-gravity');
    const liveDot = document.getElementById('gravity-live-dot');
    const menuStatus = document.getElementById('menu-gravity-status');
    const banner = document.getElementById('gravity-live-banner');

    if (enabled) {
        sphereVelocities.clear();
        headerBtn.classList.add('bg-dj-amber/20', 'text-dj-amber', 'border-dj-amber/50', 'glow-amber');
        headerBtn.classList.remove('text-slate-300', 'border-transparent');
        if (liveDot) liveDot.classList.remove('hidden');
        if (menuStatus) {
            menuStatus.textContent = 'ON';
            menuStatus.className = 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-dj-amber/20 text-dj-amber border border-dj-amber/40 pointer-events-none';
        }
        if (banner) banner.classList.remove('hidden');

        runRealtimeGravityTick();
        syncSphereModeUI();
        gravityIntervalId = setInterval(runRealtimeGravityTick, 1000);
        if (!silent) showToast('球座標リアルタイム重力 ON（1秒更新・Alt+ドラッグで回転）');
    } else {
        headerBtn.classList.remove('bg-dj-amber/20', 'text-dj-amber', 'border-dj-amber/50', 'glow-amber');
        headerBtn.classList.add('text-slate-300', 'border-transparent');
        if (liveDot) liveDot.classList.add('hidden');
        if (menuStatus) {
            menuStatus.textContent = 'OFF';
            menuStatus.className = 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-dj-surface text-slate-400 pointer-events-none';
        }
        if (banner) banner.classList.add('hidden');
        render();
        if (!silent) showToast('球座標リアルタイム重力 OFF');
    }
}

document.getElementById('btn-realtime-gravity').onclick = () => {
    setRealtimeGravity(!state.realtimeGravity);
};

document.getElementById('btn-menu-realtime-gravity').onclick = (e) => {
    e.stopPropagation();
    layoutDropdown.classList.add('hidden');
    setRealtimeGravity(!state.realtimeGravity);
};

document.getElementById('btn-stop-gravity-banner').onclick = () => {
    setRealtimeGravity(false);
};

document.getElementById('btn-reset-sphere-rot').onclick = () => {
    state.sphereRot = { yaw: 0.35, pitch: -0.22 };
    projectAllSphereNodes();
    render();
    showToast('球体の視点を初期角度にリセットしました');
};

document.getElementById('btn-sphere-orbit').onclick = () => {
    state.sphereOrbitMode = !state.sphereOrbitMode;
    syncSphereModeUI();
    if (state.sphereOrbitMode) {
        showToast('球体回転モード ON（背景ドラッグで3D回転）');
    } else {
        showToast('球体回転モード OFF（背景ドラッグでパン移動）');
    }
};

document.getElementById('btn-layout-bpm').onclick = (e) => {
    e.stopPropagation();
    layoutDropdown.classList.add('hidden');
    applyBpmLayout();
};

document.getElementById('btn-layout-genre').onclick = (e) => {
    e.stopPropagation();
    layoutDropdown.classList.add('hidden');
    applyGenreClusterLayout();
};

document.getElementById('btn-layout-force').onclick = (e) => {
    e.stopPropagation();
    layoutDropdown.classList.add('hidden');
    applyForceLayout();
};

document.getElementById('btn-layout-gravity').onclick = (e) => {
    e.stopPropagation();
    layoutDropdown.classList.add('hidden');
    applyGravityLayout();
};

const dataMenuWrapper = document.getElementById('data-menu-wrapper');
const dataMenuBtn = document.getElementById('btn-data-menu');
const dataDropdown = document.getElementById('data-dropdown');

dataMenuBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    layoutDropdown.classList.add('hidden');
    dataDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (dataMenuWrapper && !dataMenuWrapper.contains(e.target)) {
        dataDropdown.classList.add('hidden');
    }
    if (layoutMenuWrapper && !layoutMenuWrapper.contains(e.target)) {
        layoutDropdown.classList.add('hidden');
    }
});

document.getElementById('btn-export-json').onclick = (e) => {
    e.stopPropagation();
    dataDropdown.classList.add('hidden');
    const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        nodes: state.nodes,
        edges: state.edges,
        setlists: state.setlists,
        activeSetlistId: state.activeSetlistId
    };
    const jsonStr = JSON.stringify(payload, null, 2);

    const triggerDownload = () => {
        try {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dj-transition-graph-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.warn('Download blocked:', err);
        }
    };

    triggerDownload();

    const exportModal = document.getElementById('export-modal');
    const exportTextarea = document.getElementById('export-json-text');
    exportTextarea.value = jsonStr;
    exportModal.classList.remove('hidden');

    document.getElementById('export-download-retry').onclick = () => {
        triggerDownload();
        showToast('ダウンロードを再試行しました');
    };

    document.getElementById('export-copy-btn').onclick = () => {
        exportTextarea.focus();
        exportTextarea.select();
        try {
            document.execCommand('copy');
            showToast('JSONデータをクリップボードにコピーしました');
        } catch (err) {
            showToast('コピーに失敗しました。手動で選択してコピーしてください');
        }
    };

    document.getElementById('export-close').onclick = () => {
        exportModal.classList.add('hidden');
    };
};

document.getElementById('input-import-json').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const parsed = JSON.parse(ev.target.result);
            if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
                throw new Error('Invalid schema');
            }
            state.nodes = parsed.nodes.map(n => ({ genre: '', ...n }));
            state.edges = parsed.edges;
            if (Array.isArray(parsed.setlists) && parsed.setlists.length > 0) {
                state.setlists = parsed.setlists;
                state.activeSetlistId = parsed.activeSetlistId || parsed.setlists[0].id;
            } else {
                state.setlists = [{ id: 'sl_default', name: 'セトリ #1', tracks: [] }];
                state.activeSetlistId = 'sl_default';
            }
            clearSelection();
            updateGenreFilterOptions();
            updateSearchCountBadge();
            updateTransitionListUI();
            updateSetlistUI();
            saveToStorage();
            fitGraphToScreen();
            showToast('JSONデータを読み込みました');
        } catch (err) {
            showToast('JSONファイルの形式が正しくありません');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
    dataDropdown.classList.add('hidden');
});

document.getElementById('btn-load-sample').onclick = (e) => {
    e.stopPropagation();
    dataDropdown.classList.add('hidden');
    showConfirm('サンプルデータの復元', '現在のグラフを上書きして、サンプルのDJつなぎネットワークを読み込みますか？', () => {
        if (state.realtimeGravity) setRealtimeGravity(false, true);
        const sample = getSampleData();
        state.nodes = sample.nodes;
        state.edges = sample.edges;
        state.setlists = sample.setlists;
        state.activeSetlistId = sample.activeSetlistId;
        clearSelection();
        updateGenreFilterOptions();
        updateSearchCountBadge();
        updateTransitionListUI();
        updateSetlistUI();
        saveToStorage();
        fitGraphToScreen();
        showToast('サンプルデータを復元しました');
    });
};

document.getElementById('btn-clear-all').onclick = (e) => {
    e.stopPropagation();
    dataDropdown.classList.add('hidden');
    showConfirm('全消去（新規作成）', 'すべての楽曲とつなぎデータを消去して白紙から始めますか？', () => {
        if (state.realtimeGravity) setRealtimeGravity(false, true);
        state.nodes = [];
        state.edges = [];
        state.setlists = [{ id: 'sl_default', name: 'セトリ #1', tracks: [] }];
        state.activeSetlistId = 'sl_default';
        clearSelection();
        updateGenreFilterOptions();
        updateSearchCountBadge();
        updateTransitionListUI();
        updateSetlistUI();
        saveToStorage();
        fitGraphToScreen();
        showToast('グラフをクリアしました');
    });
};

// 左右パネル開閉＆左パネル絞り込みイベント
document.getElementById('btn-toggle-left-sidebar').onclick = toggleLeftSidebar;
document.getElementById('btn-close-left-sidebar').onclick = closeLeftSidebar;
document.getElementById('btn-toggle-sidebar').onclick = toggleSidebar;
document.getElementById('btn-close-sidebar').onclick = closeSidebar;

const transitionFilterInput = document.getElementById('transition-list-filter');
const clearTransitionFilterBtn = document.getElementById('btn-clear-transition-filter');
transitionFilterInput.addEventListener('input', () => {
    if (transitionFilterInput.value) clearTransitionFilterBtn.classList.remove('hidden');
    else clearTransitionFilterBtn.classList.add('hidden');
    updateTransitionListUI();
});
clearTransitionFilterBtn.onclick = () => {
    transitionFilterInput.value = '';
    clearTransitionFilterBtn.classList.add('hidden');
    updateTransitionListUI();
};
document.getElementById('transition-list-sort').addEventListener('change', updateTransitionListUI);

// キーボードショートカット (Ctrl+F / Escape / Delete)
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchEl = document.getElementById('search-input');
        if (searchEl) {
            searchEl.focus();
            searchEl.select();
        }
        return;
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape' && document.activeElement.id === 'search-input') {
            handleSearchInput('');
            document.activeElement.blur();
        }
        return;
    }
    if (e.key === 'Escape') {
        setConnectMode(false);
        clearSelection();
        document.getElementById('export-modal').classList.add('hidden');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedNodeId) deleteNode(state.selectedNodeId);
        else if (state.selectedEdgeId) deleteEdge(state.selectedEdgeId);
    }
});
