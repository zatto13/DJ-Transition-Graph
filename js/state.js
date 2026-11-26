// ==========================================
// 1. 定数・カラーパレット・初期サンプルデータ
// ==========================================
const STORAGE_KEY = 'dj_transition_graph_v1';

const NODE_COLORS = [
    { id: 'cyan', hex: '#06b6d4', label: 'シアン (House/Techno)' },
    { id: 'pink', hex: '#ec4899', label: 'ピンク (Vocal/Pop)' },
    { id: 'purple', hex: '#8b5cf6', label: 'パープル (Trance/UKG)' },
    { id: 'amber', hex: '#f59e0b', label: 'アンバー (Jazz/Funk)' },
    { id: 'emerald', hex: '#10b981', label: 'エメラルド (DnB/Break)' },
    { id: 'rose', hex: '#f43f5e', label: 'ローズ (Hardcore/Rave)' },
];

const EDGE_COLORS = [
    { id: 'cyan', hex: '#06b6d4' },
    { id: 'pink', hex: '#ec4899' },
    { id: 'amber', hex: '#f59e0b' },
    { id: 'emerald', hex: '#10b981' },
    { id: 'slate', hex: '#94a3b8' },
];

const QUICK_GENRES = [
    'House', 'Tech House', 'UK Garage', 'Drum & Bass',
    'Hardcore', 'Trance', 'Hip-Hop', 'Funkot', 'J-Pop'
];

function getSampleData() {
    return {
        nodes: [
            {
                id: 'n1',
                title: 'Midnight Velvet',
                artist: 'Kojiro & The Groovers',
                genre: 'Deep House',
                bpm: 124,
                key: '8A',
                color: '#f59e0b',
                memo: 'ウォームなエレピから始まるジャジー・ディープハウス。序盤の雰囲気作りに最適。',
                x: -340,
                y: -140
            },
            {
                id: 'n2',
                title: 'Neon Shibuya 2AM',
                artist: 'Aether Wave',
                genre: 'Tech House',
                bpm: 128,
                key: '8A',
                color: '#06b6d4',
                memo: 'ベースラインが太いテックハウス。32小節のクリーンなアウトロあり。',
                x: -80,
                y: -190
            },
            {
                id: 'n3',
                title: 'Liquid Horizon',
                artist: 'SubSurface',
                genre: 'UK Garage',
                bpm: 132,
                key: '9A',
                color: '#8b5cf6',
                memo: '2ステップ調のUKガラージ。ボーカルチョップが印象的。',
                x: 200,
                y: -130
            },
            {
                id: 'n4',
                title: 'Brass & Breakbeats',
                artist: 'Tokyo Fusion Unit',
                genre: 'Breakbeats',
                bpm: 126,
                key: '7A',
                color: '#f59e0b',
                memo: '生ホーンセクションとブレイクビーツの融合。ピーク前のフックに。',
                x: -240,
                y: 120
            },
            {
                id: 'n5',
                title: 'Hyperdrive Protocol',
                artist: 'K-Core System',
                genre: 'Hardcore',
                bpm: 160,
                key: '9A',
                color: '#f43f5e',
                memo: 'レイヴスタブが炸裂するUKハードコア。一気にフロアを爆発させる切り札。',
                x: 340,
                y: 110
            },
            {
                id: 'n6',
                title: 'Cybernetic Rain',
                artist: 'Vortexia',
                genre: 'Melodic House',
                bpm: 130,
                key: '8B',
                color: '#ec4899',
                memo: 'エモーショナルなシンセリフ。メジャー感を出したい時の転換点。',
                x: 40,
                y: 90
            }
        ],
        edges: [
            {
                id: 'e1',
                source: 'n1',
                target: 'n2',
                label: 'ロングミックス',
                rating: 5,
                style: 'solid',
                color: '#06b6d4',
                memo: '同キー(8A)。Aのエレピループを残したままBのキックを16小節かけてフェードイン。'
            },
            {
                id: 'e2',
                source: 'n2',
                target: 'n3',
                label: 'EQスワップ (Low切替)',
                rating: 5,
                style: 'solid',
                color: '#06b6d4',
                memo: 'BPM128→132へ徐々にピッチ上げ。Bのボーカルが入る瞬間にLowを完全入れ替え。'
            },
            {
                id: 'e3',
                source: 'n3',
                target: 'n2',
                label: 'フィルターアウト',
                rating: 3,
                style: 'dashed',
                color: '#94a3b8',
                memo: '少しトーンダウンしてグルーヴに戻す時の逆ルート。ハイパスフィルター推奨。'
            },
            {
                id: 'e4',
                source: 'n1',
                target: 'n4',
                label: 'ブレイク重ね',
                rating: 4,
                style: 'solid',
                color: '#f59e0b',
                memo: 'ジャズ/フュージョン文脈の鉄板つなぎ。ホーンの入りに合わせてカットイン気味でもOK。'
            },
            {
                id: 'e5',
                source: 'n4',
                target: 'n6',
                label: 'エコー/リバーブ飛ばし',
                rating: 4,
                style: 'solid',
                color: '#ec4899',
                memo: 'ブラスの最終音に1/2ディレイをかけて残響の中でCybernetic Rainのパッドへ。'
            },
            {
                id: 'e6',
                source: 'n6',
                target: 'n3',
                label: 'ロングミックス',
                rating: 4,
                style: 'solid',
                color: '#06b6d4',
                memo: '8B→9Aのエネルギッシュな展開。ドラムパターンが噛み合うので長めに混ぜられる。'
            },
            {
                id: 'e7',
                source: 'n3',
                target: 'n5',
                label: 'BPM倍取り / ブレイク切替',
                rating: 5,
                style: 'dashed',
                color: '#ec4899',
                memo: 'Liquid Horizonの2回目のブレイク無音部分でHyperdriveのビルドアップを頭出し！'
            }
        ],
        setlists: [
            {
                id: 'sl_default',
                name: 'メインルート候補 #1',
                tracks: ['n1', 'n2', 'n3', 'n5']
            }
        ],
        activeSetlistId: 'sl_default'
    };
}

// ==========================================
// 2. アプリケーション状態管理
// ==========================================
const state = {
    nodes: [],
    edges: [],
    // 選択状態
    selectedNodeId: null,
    selectedEdgeId: null,
    hoveredNodeId: null,
    hoveredEdgeId: null,
    // モード設定
    connectMode: false,
    connectSourceId: null,
    focusMode: true,
    setlistMode: false,
    setlistRecordEnabled: true,
    setlists: [],
    activeSetlistId: null,
    realtimeGravity: false,
    sphereMode: false,
    sphereOrbitMode: false,
    sphereRot: { yaw: 0.35, pitch: -0.22 },
    sphereMaxRadius: 480,
    searchQuery: '',
    selectedGenreFilter: '',
    // カメラ（パン＆ズーム）
    camera: {
        x: 0,
        y: 0,
        zoom: 1
    },
    // インタラクション状態
    isDraggingNode: false,
    dragNodeId: null,
    dragOffset: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    isRotatingSphere: false,
    rotateStart: { x: 0, y: 0, yaw: 0, pitch: 0 },
    isDrawingEdge: false,
    drawEdgeSourceId: null,
    pointerWorld: { x: 0, y: 0 },
    pointerScreen: { x: 0, y: 0 },
    hasMovedDuringDrag: false
};

        function sanitizeGraphCoordinates() {
    state.nodes.forEach((n, idx) => {
        const nx = Number(n.x);
        const ny = Number(n.y);
        if (!Number.isFinite(nx)) {
            const angle = idx * 2.39996;
            const radius = 140 + Math.sqrt(idx) * 95;
            n.x = Math.round(Math.cos(angle) * radius);
        } else {
            n.x = nx;
        }
        if (!Number.isFinite(ny)) {
            const angle = idx * 2.39996;
            const radius = 140 + Math.sqrt(idx) * 95;
            n.y = Math.round(Math.sin(angle) * radius);
        } else {
            n.y = ny;
        }
        if (typeof n.z !== 'number' || !Number.isFinite(n.z)) {
            n.z = 0;
        }
    });
    if (!Number.isFinite(state.camera.x)) state.camera.x = 0;
    if (!Number.isFinite(state.camera.y)) state.camera.y = 0;
    if (!Number.isFinite(state.camera.zoom) || state.camera.zoom <= 0) state.camera.zoom = 1;
    if (!state.sphereRot || !Number.isFinite(state.sphereRot.yaw)) state.sphereRot = { yaw: 0.35, pitch: -0.22 };
    if (!Number.isFinite(state.sphereRot.pitch)) state.sphereRot.pitch = -0.22;
}

// 擬似3D球座標 (r, theta, phi) <-> 3D直交座標 <-> 2D画面投影ヘルパー
function sphericalToCartesian3D(r, theta, phi) {
    const cosPhi = Math.cos(phi);
    return {
        x3: r * cosPhi * Math.cos(theta),
        y3: r * Math.sin(phi),
        z3: r * cosPhi * Math.sin(theta)
    };
}

function rotate3DPoint(x3, y3, z3, yaw, pitch) {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const x1 = x3 * cosY - z3 * sinY;
    const z1 = x3 * sinY + z3 * cosY;

    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const y2 = y3 * cosP - z1 * sinP;
    const z2 = y3 * sinP + z1 * cosP;

    return { x: x1, y: y2, z: z2 };
}

function unrotate3DPoint(x, y, z, yaw, pitch) {
    const cosP = Math.cos(-pitch);
    const sinP = Math.sin(-pitch);
    const y1 = y * cosP - z * sinP;
    const z1 = y * sinP + z * cosP;

    const cosY = Math.cos(-yaw);
    const sinY = Math.sin(-yaw);
    const x2 = x * cosY - z1 * sinY;
    const z2 = x * sinY + z1 * cosY;

    return { x3: x2, y3: y1, z3: z2 };
}

function projectAllSphereNodes() {
    if (!state.sphereMode) return;
    const yaw = state.sphereRot.yaw;
    const pitch = state.sphereRot.pitch;
    let observedMaxZ = 180;
    state.nodes.forEach(n => {
        if (typeof n.r === 'number' && typeof n.theta === 'number' && typeof n.phi === 'number') {
            const c3 = sphericalToCartesian3D(n.r, n.theta, n.phi);
            n.x3 = c3.x3;
            n.y3 = c3.y3;
            n.z3 = c3.z3;
        } else {
            n.x3 = n.x || 0;
            n.y3 = n.y || 0;
            n.z3 = n.z || 0;
        }
        const rot = rotate3DPoint(n.x3, n.y3, n.z3, yaw, pitch);
        const focal = 1500;
        const persp = focal / Math.max(520, focal - rot.z);
        n.x = Math.round(rot.x * persp);
        n.y = Math.round(rot.y * persp);
        n.z = rot.z;
        n._persp = persp;
        observedMaxZ = Math.max(observedMaxZ, Math.abs(rot.z));
    });
    state.sphereMaxRadius = observedMaxZ;
}

function getNodeDepthMetrics(node) {
    if (!state.sphereMode) {
        return { scale: 1, alphaFactor: 1, z: 0, normZ: 0 };
    }
    const maxR = Math.max(220, state.sphereMaxRadius || 420);
    const normZ = Math.max(-1, Math.min(1, (node.z || 0) / maxR));
    // 手前 (normZ = +1) は 1.18倍・不透明度 1.0、奥 (normZ = -1) は 0.52倍・不透明度 0.24 まで明確に遠近感を出す
    const t = (normZ + 1) / 2; // 0.0 (最奥) 〜 1.0 (最手前)
    const eased = t * t * (3 - 2 * t); // smoothstep
    const scale = 0.52 + eased * 0.66;       // 0.52 〜 1.18
    const alphaFactor = 0.24 + eased * 0.76; // 0.24 〜 1.00
    return { scale, alphaFactor, z: node.z || 0, normZ };
}

const NODE_WIDTH = 204;
const NODE_HEIGHT = 72;
const NODE_RADIUS = 12;

function getActiveSetlist() {
    if (!Array.isArray(state.setlists) || state.setlists.length === 0) return null;
    let found = state.setlists.find(s => s.id === state.activeSetlistId);
    if (!found) {
        found = state.setlists[0];
        state.activeSetlistId = found.id;
    }
    return found;
}

function getActiveSetlistTracks() {
    const sl = getActiveSetlist();
    if (!sl) return [];
    if (!Array.isArray(sl.tracks)) {
        sl.tracks = [];
    }
    return sl.tracks;
}

// ==========================================
// 3. 永続化 (LocalStorage) & ユーティリティ
// ==========================================
function saveToStorage() {
    try {
        const payload = {
            nodes: state.nodes,
            edges: state.edges,
            setlists: state.setlists,
            activeSetlistId: state.activeSetlistId,
            sphereMode: state.sphereMode,
            sphereRot: state.sphereRot,
            sphereMaxRadius: state.sphereMaxRadius
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('LocalStorage save failed:', e);
    }
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
                state.nodes = parsed.nodes.map(n => ({ genre: '', ...n }));
                state.edges = parsed.edges;
                if (Array.isArray(parsed.setlists) && parsed.setlists.length > 0) {
                    state.setlists = parsed.setlists;
                    state.activeSetlistId = parsed.activeSetlistId || parsed.setlists[0].id;
                } else if (Array.isArray(parsed.setlist)) {
                    state.setlists = [{
                        id: 'sl_default',
                        name: 'セトリ #1',
                        tracks: parsed.setlist
                    }];
                    state.activeSetlistId = 'sl_default';
                } else {
                    state.setlists = [{ id: 'sl_default', name: 'セトリ #1', tracks: [] }];
                    state.activeSetlistId = 'sl_default';
                }
                state.sphereMode = Boolean(parsed.sphereMode);
                if (parsed.sphereRot && Number.isFinite(parsed.sphereRot.yaw) && Number.isFinite(parsed.sphereRot.pitch)) {
                    state.sphereRot = parsed.sphereRot;
                }
                if (Number.isFinite(parsed.sphereMaxRadius)) {
                    state.sphereMaxRadius = parsed.sphereMaxRadius;
                }
                sanitizeGraphCoordinates();
                if (state.sphereMode) {
                    projectAllSphereNodes();
                }
                return true;
            }
        }
    } catch (e) {
        console.warn('LocalStorage load failed:', e);
    }
    return false;
}

function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'px-4 py-2 rounded-full bg-dj-surface/95 border border-dj-cyan/40 text-xs text-white shadow-xl backdrop-blur-md transition-opacity duration-300';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 2400);
}

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    modal.classList.remove('hidden');

    const btnOk = document.getElementById('confirm-ok');
    const btnCancel = document.getElementById('confirm-cancel');

    const cleanup = () => {
        modal.classList.add('hidden');
        btnOk.onclick = null;
        btnCancel.onclick = null;
    };

    btnCancel.onclick = cleanup;
    btnOk.onclick = () => {
        cleanup();
        onConfirm();
    };
}

function showSetlistPrompt(title, defaultValue, onSave) {
    const modal = document.getElementById('setlist-modal');
    const input = document.getElementById('setlist-modal-input');
    document.getElementById('setlist-modal-title').textContent = title;
    input.value = defaultValue || '';
    modal.classList.remove('hidden');
    setTimeout(() => {
        input.focus();
        input.select();
    }, 30);

    const btnOk = document.getElementById('setlist-modal-ok');
    const btnCancel = document.getElementById('setlist-modal-cancel');

    const cleanup = () => {
        modal.classList.add('hidden');
        btnOk.onclick = null;
        btnCancel.onclick = null;
        input.onkeydown = null;
    };

    const submit = () => {
        const val = input.value.trim();
        if (!val) return;
        cleanup();
        onSave(val);
    };

    btnCancel.onclick = cleanup;
    btnOk.onclick = submit;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') submit();
        else if (e.key === 'Escape') cleanup();
    };
}
