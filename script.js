// Uses the globals from patterns.js and emoji-data.js: PATTERNS, PATTERN_MAP, PATTERN_THUMBS, displayWidth.
const { createApp } = Vue;

const DEFAULT_ICON = '😆';
const LINE_HEIGHT = 20;
const MAX_SCROLL_HEIGHT = 10000000; // browsers clamp element height; scroll is scaled beyond this
const PREVIEW_LINES = 40;
const PNG_MAX_LINES = 1000;
// Phones skip decorative work (floating faces) and render fewer emoji at once.
const IS_MOBILE = window.matchMedia('(max-width: 960px)').matches;
const EMOJI_VISIBLE_LIMIT = IS_MOBILE ? 120 : Infinity;
const LINE_PRESETS = [10, 50, 100, 500, 1000, 10000];

const DEFAULTS = {
    icon: DEFAULT_ICON,
    lines: 100,
    amplitude: 5,
    curveLength: 12,
    selectedPattern: 'straight',
    showLineNumbers: true,
    cycleIcons: false,
    cycleMode: 'line',
    exportFormat: 'plain'
};
const SAVED_FIELDS = Object.keys(DEFAULTS);

const CYCLE_MODES = [
    { value: 'line', label: 'Change every line' },
    { value: 'column', label: 'Change across the line' },
    { value: 'diagonal', label: 'Diagonal' }
];

// How the text is prepared when copied. Chat apps often trim leading spaces, which flattens shapes.
const EXPORT_FORMATS = [
    {
        value: 'plain',
        label: 'Plain text',
        hint: 'Raw spaces. Fine for editors and terminals; many chat apps trim leading spaces.'
    },
    {
        value: 'code',
        label: 'Code block (```)',
        hint: 'Wrapped in ``` so Slack, Discord, Telegram and GitHub keep spacing in a monospace font.'
    },
    {
        value: 'invisible',
        label: 'Invisible indent (⠀)',
        hint: 'Leading spaces become invisible braille blanks, so Zalo, Messenger and similar apps keep the indent.'
    }
];

const BUILTIN_PRESETS = [
    { name: '❤️ Heart', data: { icon: '❤️', selectedPattern: 'heart', amplitude: 7, fitLines: true } },
    { name: '💖 Big heart', data: { icon: '💖', selectedPattern: 'heart', amplitude: 10, fitLines: true } },
    { name: '🌈 Rainbow heart', data: { icon: '❤️ 🧡 💛 💚 💙 💜', cycleIcons: true, cycleMode: 'diagonal', selectedPattern: 'heart', amplitude: 7, fitLines: true } },
    { name: '🌈 Rainbow pyramid', data: { icon: '🟥 🟧 🟨 🟩 🟦 🟪', cycleIcons: true, cycleMode: 'line', selectedPattern: 'pyramid', amplitude: 5, lines: 6 } },
    { name: '💎 Diamond', data: { icon: '💎', selectedPattern: 'diamond', amplitude: 6, lines: 26 } },
    { name: '⭐ Star diamond', data: { icon: '⭐', selectedPattern: 'diamond', amplitude: 5, lines: 20 } },
    { name: '🎄 Tree', data: { icon: '🌲', selectedPattern: 'pyramid', amplitude: 8, lines: 9 } },
    { name: '⏳ Hourglass', data: { icon: '⏳', selectedPattern: 'hourglass', amplitude: 5, lines: 12 } },
    { name: '🔴 Circle', data: { icon: '🔴', selectedPattern: 'circle', amplitude: 5, fitLines: true } },
    { name: '🔵 Ring', data: { icon: '🔵', selectedPattern: 'ring', amplitude: 5, fitLines: true } },
    { name: '🟩 Frame', data: { icon: '🟩', selectedPattern: 'frame', amplitude: 4, fitLines: true } },
    { name: '❌ Cross', data: { icon: '❌', selectedPattern: 'cross', amplitude: 4, lines: 10 } },
    { name: '🏁 Checkerboard', data: { icon: '⬛', selectedPattern: 'checker', amplitude: 4, lines: 10 } },
    { name: '🔴🟢🔵 Checker', data: { icon: '🔴 🟢 🔵', cycleIcons: true, cycleMode: 'diagonal', selectedPattern: 'checker', amplitude: 4, lines: 20 } },
    { name: '🌊 Waves', data: { icon: '🌊', selectedPattern: 'wave', amplitude: 8, curveLength: 20, lines: 60 } },
    { name: '🏄 Surf', data: { icon: '🌊', selectedPattern: 'double-wave', amplitude: 10, curveLength: 28, lines: 60 } },
    { name: '🐍 Snake', data: { icon: '🐍', selectedPattern: 'wave', amplitude: 10, curveLength: 20, lines: 40 } },
    { name: '💓 ECG', data: { icon: '💓', selectedPattern: 'heartbeat', amplitude: 8, curveLength: 24, lines: 72 } },
    { name: '⚡ Lightning', data: { icon: '⚡', selectedPattern: 'zigzag', amplitude: 6, curveLength: 8, lines: 24 } },
    { name: '🔥 Flames', data: { icon: '🔥', selectedPattern: 'zigzag', amplitude: 12, curveLength: 12, lines: 48 } },
    { name: '🌸 Petals', data: { icon: '🌸', selectedPattern: 'random', amplitude: 14, lines: 30 } },
    { name: '👣 Footsteps', data: { icon: '👣', selectedPattern: 'stair-up', amplitude: 8, lines: 36 } },
    { name: '🦋 Butterfly', data: { icon: '🦋', selectedPattern: 'v-shape', amplitude: 8, curveLength: 16, lines: 32 } },
    { name: '🎵 Beat', data: { icon: '🎵', selectedPattern: 'square', amplitude: 8, curveLength: 8, lines: 32 } },
    { name: '🧧 Lì xì', data: { icon: '🧧', selectedPattern: 'diamond', amplitude: 5, lines: 20 } },
    { name: '🏮 Đèn lồng', data: { icon: '🏮', selectedPattern: 'curve', amplitude: 6, lines: 30 } }
];

// Emoji picker data comes from emoji-data.js (names + keywords). Glyphs are drawn by the OS font.
const EMOJI_GROUPS = ['Smileys', 'People', 'Animals', 'Food', 'Travel', 'Activities', 'Objects', 'Symbols', 'Flags'];
const EMOJI_BY_GROUP = EMOJI_GROUPS.map((_, g) => EMOJI_DATA.filter((row) => row[2] === g));
const MAX_SEARCH_RESULTS = IS_MOBILE ? 120 : 240;

// Vietnamese keywords (accents optional) -> English words used in the emoji names.
const VI_KEYWORDS = {
    cuoi: 'smile grin laugh', haha: 'laugh joy', khoc: 'cry sob tear', buon: 'sad disappointed',
    gian: 'angry mad', gian_du: 'angry rage', yeu: 'love heart kiss', thuong: 'love heart',
    tim: 'heart', ngu: 'sleep sleeping', met: 'tired weary', so: 'fear scream', ngac_nhien: 'surprised astonished',
    ngac: 'surprised', nong: 'hot', lanh: 'cold freezing', om: 'sick ill', say: 'drunk dizzy',
    le_luoi: 'tongue', luoi: 'tongue', nhay_mat: 'wink', nhay: 'wink', ngai: 'shy blush', do_mat: 'blush',
    tay: 'hand', ngon_tay: 'finger point', vo_tay: 'clap', like: 'thumbs up', cau_nguyen: 'folded pray',
    nam_tay: 'fist', co_len: 'muscle strong flexed', mat: 'face', mat_cuoi: 'smiling face',
    nguoi: 'person man woman', be: 'baby child', gia: 'old', me: 'mother', bo: 'father',
    meo: 'cat', cho: 'dog', chuot: 'mouse rat', tho: 'rabbit', gau: 'bear', cao: 'fox', ho: 'tiger',
    su_tu: 'lion', ngua: 'horse', bo_sua: 'cow', heo: 'pig', khi: 'monkey', ga: 'chicken', chim: 'bird',
    ca: 'fish', ca_map: 'shark', ran: 'snake', rua: 'turtle', ech: 'frog', buom: 'butterfly', ong: 'bee',
    sau: 'bug worm', ca_heo: 'dolphin', voi: 'elephant', gau_truc: 'panda', ca_sau: 'crocodile',
    hoa: 'flower blossom rose', cay: 'tree plant', la: 'leaf', nang: 'sun', mat_troi: 'sun', trang: 'moon',
    sao: 'star', may: 'cloud', mua: 'rain', tuyet: 'snow', gio: 'wind', lua: 'fire', nuoc: 'water',
    song: 'wave ocean', bien: 'ocean beach', nui: 'mountain', cau_vong: 'rainbow', set: 'lightning',
    an: 'food eat', com: 'rice', pho: 'noodles soup', banh: 'cake bread pie', banh_mi: 'bread sandwich',
    pizza: 'pizza', bia: 'beer', ruou: 'wine', ca_phe: 'coffee', tra: 'tea', sua: 'milk', kem: 'ice cream',
    keo: 'candy', socola: 'chocolate', tao: 'apple', chuoi: 'banana', dau: 'strawberry', cam: 'orange',
    xoai: 'mango', dua: 'coconut', nho: 'grapes', dua_hau: 'watermelon', ot: 'pepper', trung: 'egg',
    xe: 'car vehicle', o_to: 'car', xe_may: 'motorcycle', xe_dap: 'bicycle', may_bay: 'airplane plane',
    tau: 'ship train', tau_hoa: 'train', thuyen: 'boat', nha: 'house home', thanh_pho: 'city',
    bong_da: 'soccer football', bong: 'ball', game: 'video game', nhac: 'music note', mic: 'microphone',
    sach: 'book', tien: 'money', vang: 'gold money', kim_cuong: 'diamond gem', qua: 'gift', sinh_nhat: 'birthday cake',
    chuc_mung: 'party celebration', phao: 'fireworks', dien_thoai: 'phone', may_tinh: 'computer laptop',
    camera: 'camera', den: 'light bulb black', chia_khoa: 'key', khoa: 'lock', bua: 'hammer',
    co: 'flag', quoc_ky: 'flag', viet_nam: 'vietnam', canh_bao: 'warning',
    dung: 'check correct', sai: 'cross wrong', hoi: 'question', cham_than: 'exclamation',
    mui_ten: 'arrow', do: 'red', xanh: 'blue green', mau_tim: 'purple', mau_vang: 'yellow', mau_trang: 'white', cam_chi: 'prohibited',
    ma: 'ghost', quy: 'devil', thien_than: 'angel', robot: 'robot', ngoai_hanh_tinh: 'alien',
    xuong: 'skull', phan: 'poop', thoi_gian: 'time clock', dong_ho: 'clock'
};
const VI_LOOKUP = (() => {
    const map = new Map();
    for (const [key, value] of Object.entries(VI_KEYWORDS)) {
        map.set(key.replace(/_$/, '').replace(/_/g, ' '), value);
    }
    return map;
})();

function stripAccents(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
}

// Every word of the query must match (as a substring) either itself or one of its English equivalents.
function searchEmoji(query) {
    const q = stripAccents(query.trim());
    if (!q) {
        return [];
    }
    const words = q.split(/\s+/);
    // whole phrase first so two-word Vietnamese terms (e.g. "may bay") work
    const phraseExtra = VI_LOOKUP.get(q);
    // [word, exactOnly] pairs: a Vietnamese word also matches itself, but only as a whole English word
    const groups = words.map((word) => {
        const vi = VI_LOOKUP.get(word);
        return vi ? [[word, true], ...vi.split(' ').map((w) => [w, false])] : [[word, false]];
    });
    if (phraseExtra) {
        groups.length = 0;
        groups.push([[q, true], ...phraseExtra.split(' ').map((w) => [w, false])]);
    }
    const scored = [];
    for (const row of EMOJI_DATA) {
        const text = row[1];
        const tokens = text.split(' ');
        let score = 0;
        let ok = true;
        for (const alts of groups) {
            let best = 0;
            for (const [alt, exactOnly] of alts) {
                if (tokens.includes(alt)) {
                    best = Math.max(best, 3);
                } else if (!exactOnly && tokens.some((t) => t.startsWith(alt))) {
                    best = Math.max(best, 2);
                } else if (!exactOnly && alt.length > 2 && text.includes(alt)) {
                    best = Math.max(best, 1);
                }
            }
            if (!best) {
                ok = false;
                break;
            }
            score += best;
        }
        if (ok) {
            scored.push([score - tokens.length * 0.01, row]);
        }
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, MAX_SEARCH_RESULTS).map((x) => x[1]);
}

const THEME_KEY = 'renderIcons:theme';
const THEMES = [
    { value: 'light', icon: '☀️ Light', title: 'Light theme' },
    { value: 'dark', icon: '🌙 Dark', title: 'Dark theme' },
    { value: 'system', icon: '💻 Auto', title: 'Follow system theme' }
];

// Scattered faces for the glass background; a new random layout on every load.
function buildBackgroundFaces(W, H, count) {
    const faces = [];
    const ranges = [[0x1f600, 0x1f64f], [0x1f910, 0x1f92f], [0x1f970, 0x1f97a]];
    const pool = [];
    for (const [from, to] of ranges) {
        for (let cp = from; cp <= to; cp++) {
            pool.push(String.fromCodePoint(cp));
        }
    }
    let seed = (Math.random() * 4294967296) >>> 0;
    const rnd = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const sizeScale = Math.min(1, Math.max(0.55, W / 900)); // smaller faces on narrow screens
    // biggest first, so small faces fill the gaps; keep a minimum distance so faces rarely touch
    const sizes = Array.from({ length: count }, () => Math.round((14 + Math.pow(rnd(), 1.5) * 140) * sizeScale)).sort((x, y) => y - x);
    const placed = [];
    for (const size of sizes) {
        let spot = null;
        for (let attempt = 0; attempt < 40 && !spot; attempt++) {
            const x = rnd() * (W - size * 0.6) - size * 0.2;
            const y = rnd() * (H - size * 0.6) - size * 0.2;
            const cx = x + size / 2;
            const cy = y + size / 2;
            const clear = placed.every((p) => Math.hypot(p.cx - cx, p.cy - cy) >= ((p.size + size) / 2) * 1.05 + 8);
            if (clear) {
                spot = { cx, cy, size };
            }
        }
        if (!spot) {
            continue; // no room left for this one
        }
        placed.push(spot);
        faces.push({
            char: pool[Math.floor(rnd() * pool.length)],
            cx: spot.cx,
            cy: spot.cy,
            size,
            rot: ((rnd() * 60 - 30) * Math.PI) / 180
        });
    }
    return faces;
}

// Paint the faces once into a single static canvas. Many separately blurred, animated elements
// under the glass cards forced the GPU to redo the blur every frame; one bitmap costs nothing.
function paintBackground(canvas) {
    const W = window.innerWidth;
    // phones: the height changes as the browser toolbar slides, so use the tallest it can be
    const H = IS_MOBILE ? Math.max(window.innerHeight, Math.min(window.screen.height || 0, 1400)) : window.innerHeight;
    // phones draw at half resolution: far fewer pixels, and the smooth upscale is the blur
    const scale = IS_MOBILE ? 0.5 : Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W * scale));
    canvas.height = Math.max(1, Math.round(H * scale));
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of buildBackgroundFaces(W, H, IS_MOBILE ? 22 : 46)) {
        ctx.save();
        ctx.translate(f.cx, f.cy);
        ctx.rotate(f.rot);
        ctx.font = f.size + 'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        ctx.fillText(f.char, 0, 0);
        ctx.restore();
    }
}

// --- persistence: defaults < localStorage < URL hash -------------------------------------------
const STORAGE_KEY = 'renderIcons:settings';
const PRESETS_KEY = 'renderIcons:presets';

// Keep only known fields with the right type/value, so bad storage or a hand-edited link can't break the app.
function sanitizeSettings(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') {
        return out;
    }
    for (const key of SAVED_FIELDS) {
        if (!(key in raw)) {
            continue;
        }
        const def = DEFAULTS[key];
        let value = raw[key];
        if (typeof def === 'number') {
            value = Number(value);
            if (!Number.isFinite(value)) {
                continue;
            }
        } else if (typeof def === 'boolean') {
            value = value === true || value === 'true';
        } else {
            value = String(value);
        }
        if (key === 'selectedPattern' && !PATTERN_MAP[value]) {
            continue;
        }
        if (key === 'cycleMode' && !CYCLE_MODES.some((m) => m.value === value)) {
            continue;
        }
        if (key === 'exportFormat' && !EXPORT_FORMATS.some((f) => f.value === value)) {
            continue;
        }
        out[key] = value;
    }
    return out;
}

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (error) {
        // storage unavailable (private mode / quota): ignore
    }
}

function settingsFromHash() {
    const hash = location.hash.replace(/^#/, '');
    return hash ? sanitizeSettings(Object.fromEntries(new URLSearchParams(hash))) : {};
}

function loadSettings() {
    return { ...DEFAULTS, ...sanitizeSettings(readStorage(STORAGE_KEY, {})), ...settingsFromHash() };
}

function loadTheme() {
    try {
        const t = localStorage.getItem(THEME_KEY);
        return THEMES.some((x) => x.value === t) ? t : 'system';
    } catch (error) {
        return 'system';
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', theme);
    }
}

const MONO_STYLE = "font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;margin:0";

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Selecting text by hand copies it with its monospace styling, so pasting into chat or rich-text apps
// keeps the shape. A plain writeText() only carries characters, which those apps show in a
// proportional font. With `rich` we copy both: the plain text and a monospace <pre>.
async function copyToClipboard(text, rich) {
    if (rich && navigator.clipboard && window.isSecureContext && window.ClipboardItem) {
        const html = '<pre style="' + MONO_STYLE + '">' + escapeHtml(text) + '</pre>';
        await navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' })
            })
        ]);
        return;
    }
    if (!rich && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }
    // Fallback (insecure pages): select a styled <pre>, exactly what a manual copy does.
    const el = document.createElement(rich ? 'pre' : 'textarea');
    if (rich) {
        el.style.cssText = MONO_STYLE + ';position:fixed;left:-9999px;top:0';
        el.textContent = text;
    } else {
        el.value = text;
        el.style.cssText = 'position:fixed;left:-9999px';
    }
    document.body.appendChild(el);
    if (rich) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        el.focus();
        el.select();
    }
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    document.body.removeChild(el);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyExportFormat(text, format) {
    if (format === 'invisible') {
        return text.replace(/^ +/gm, (m) => '⠀'.repeat(m.length));
    }
    if (format === 'code') {
        return '```\n' + text + '\n```';
    }
    return text;
}

createApp({
    data() {
        const settings = loadSettings();
        return {
            ...settings,
            theme: loadTheme(),
            themes: THEMES,
            emojiShowAll: false,
            patterns: PATTERNS,
            thumbs: PATTERN_THUMBS,
            linePresets: LINE_PRESETS,
            cycleModes: CYCLE_MODES,
            exportFormats: EXPORT_FORMATS,
            // feedback
            copied: false,
            linkCopied: false,
            notice: '',
            feedbackTimer: null,
            // viewer
            scrollTop: 0,
            measuredWidth: 0,
            spacePx: 8.4,
            viewportHeight: 460,
            outputTab: 'editor',
            trimSim: true,
            // presets
            presetName: '',
            userPresets: readStorage(PRESETS_KEY, []).filter((p) => p && typeof p.name === 'string'),
            builtinPresets: BUILTIN_PRESETS,
            // emoji picker
            showEmoji: false,
            emojiAppend: false,
            emojiCategory: 0,
            emojiCategories: EMOJI_GROUPS,
            emojiQuery: ''
        };
    },
    computed: {
        settings() {
            return Object.fromEntries(SAVED_FIELDS.map((key) => [key, this[key]]));
        },
        settingsSnapshot() {
            return JSON.stringify(this.settings);
        },
        safeIcon() {
            return (this.icon || '').trim();
        },
        // Several icons when cycling is on (split on whitespace), otherwise just the one.
        iconList() {
            if (!this.safeIcon) {
                return []; // empty input: no icons, only line numbers
            }
            return this.cycleIcons ? this.safeIcon.split(/\s+/).filter(Boolean) : [this.safeIcon];
        },
        // Icons used for sizing; falls back to the default so layout maths never sees an empty list.
        widthList() {
            return this.iconList.length ? this.iconList : [DEFAULT_ICON];
        },
        totalLines() {
            return this.normalizeNumber(this.lines, 1, 100);
        },
        safeAmplitude() {
            return this.normalizeNumber(this.amplitude, 0, 4);
        },
        safeCurveLength() {
            return this.normalizeNumber(this.curveLength, 2, 16);
        },
        pattern() {
            return PATTERN_MAP[this.selectedPattern] || PATTERN_MAP.straight;
        },
        selectedLabel() {
            return this.pattern.label;
        },
        amplitudeLabel() {
            return this.pattern.mask ? 'Size' : 'Width';
        },
        amplitudeUnit() {
            return this.pattern.mask ? 'radius, in icons' : 'amplitude, in spaces';
        },
        patternHint() {
            const p = this.pattern;
            if (!p.usesAmplitude) {
                return 'Straight has no shape settings.';
            }
            if (p.mask) {
                return 'Shape size comes from Size.';
            }
            return p.usesCurve ? 'Uses width and wave length.' : 'Uses width only.';
        },
        formatHint() {
            return (EXPORT_FORMATS.find((f) => f.value === this.exportFormat) || EXPORT_FORMATS[0]).hint;
        },
        // Width of the widest icon in "space" units, measured with the real output font so shapes stay symmetric.
        iconWidth() {
            return this.measuredWidth || Math.max(...this.widthList.map(displayWidth));
        },
        // Gap (in spaces) between icons and the resulting half-step. Icon + gap should be an
        // even number of spaces so each half-step is whole; pick the gap that gets closest to that.
        iconSpacing() {
            const w = this.iconWidth;
            let best = null;
            for (let gap = 1; gap <= 4; gap++) {
                const step = Math.max(1, Math.round((w + gap) / 2));
                const error = Math.abs(w + gap - step * 2);
                if (!best || error < best.error - 1e-9) {
                    best = { gap, step, error };
                }
            }
            return best;
        },
        // Slot width / row height: how much wider than tall one icon slot looks. Shapes use it to stay in proportion.
        cellAspect() {
            return (this.iconSpacing.step * 2 * this.spacePx) / LINE_HEIGHT;
        },
        // Lines one whole shape needs with the current icon (only for shape patterns).
        shapeRows() {
            return this.pattern.shapeRows ? this.pattern.shapeRows(this.safeAmplitude, this.cellAspect) : 0;
        },
        // Scroll area height; clamped for huge outputs (scroll position is then scaled).
        scrollHeight() {
            return Math.min(this.totalLines * LINE_HEIGHT, MAX_SCROLL_HEIGHT);
        },
        contentWidthCh() {
            const w = this.iconWidth;
            const digits = String(this.totalLines).length + 1;
            const a = this.safeAmplitude;
            const slot = this.iconSpacing.step * 2;
            return this.pattern.multi ? this.pattern.cols(a) * slot + w + digits + 4 : a + w + digits + 4;
        },
        visibleCount() {
            return Math.ceil(this.viewportHeight / LINE_HEIGHT) + 1;
        },
        firstLine() {
            const n = this.totalLines;
            if (n * LINE_HEIGHT <= MAX_SCROLL_HEIGHT) {
                return Math.min(n - 1, Math.floor(this.scrollTop / LINE_HEIGHT));
            }
            // huge outputs: scroll position is scaled onto the line range
            const maxFirst = Math.max(0, n - Math.ceil(this.viewportHeight / LINE_HEIGHT));
            const range = Math.max(1, this.scrollHeight - this.viewportHeight);
            const ratio = Math.min(1, Math.max(0, this.scrollTop / range));
            return Math.floor(ratio * maxFirst);
        },
        // keeps text moving smoothly between whole-line steps
        subLineOffset() {
            return this.totalLines * LINE_HEIGHT <= MAX_SCROLL_HEIGHT ? this.scrollTop % LINE_HEIGHT : 0;
        },
        visibleText() {
            const end = Math.min(this.totalLines, this.firstLine + this.visibleCount);
            const rows = new Array(Math.max(0, end - this.firstLine));
            for (let i = this.firstLine, k = 0; i < end; i++, k++) {
                rows[k] = this.lineAt(i);
            }
            return rows.join('\n');
        },
        // What a chat app would show for the first lines, given the chosen copy format.
        chatPreview() {
            if (this.outputTab !== 'chat') {
                return { mode: 'bubble', text: '' };
            }
            const n = Math.min(this.totalLines, PREVIEW_LINES);
            const lines = [];
            for (let i = 0; i < n; i++) {
                lines.push(this.lineAt(i));
            }
            const text = lines.join('\n');
            if (this.exportFormat === 'code') {
                return { mode: 'code', text };
            }
            if (this.exportFormat === 'invisible') {
                return { mode: 'bubble', text: applyExportFormat(text, 'invisible') };
            }
            return { mode: 'bubble', text: this.trimSim ? text.replace(/^ +/gm, '') : text };
        },
        allPresets() {
            return [
                ...this.builtinPresets.map((p) => ({ ...p, builtin: true })),
                ...this.userPresets.map((p) => ({ ...p, builtin: false }))
            ];
        },
        isSearching() {
            return this.emojiQuery.trim().length > 0;
        },
        // Search results while typing, otherwise the selected category.
        allEmojis() {
            return this.isSearching ? searchEmoji(this.emojiQuery) : EMOJI_BY_GROUP[this.emojiCategory];
        },
        currentEmojis() {
            return this.emojiShowAll ? this.allEmojis : this.allEmojis.slice(0, EMOJI_VISIBLE_LIMIT);
        },
        emojiHiddenCount() {
            return this.allEmojis.length - this.currentEmojis.length;
        }
    },
    watch: {
        iconList() {
            this.measureIcon();
        },
        theme(value) {
            applyTheme(value);
            writeStorage(THEME_KEY, value);
        },
        // Debounced: every keystroke used to write storage and the URL (Safari limits URL updates).
        settingsSnapshot(value) {
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(this.flushSave, 300);
        },
        emojiCategory() {
            this.emojiShowAll = false;
        },
        emojiQuery() {
            this.emojiShowAll = false;
        }
    },
    mounted() {
        applyTheme(this.theme);
        this.measureViewport();
        this.measureIcon();
        this.syncHash();
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => this.measureIcon());
        }
        this.resizeObserver = new ResizeObserver(() => this.measureViewport());
        this.resizeObserver.observe(this.$refs.viewer);
        window.addEventListener('hashchange', this.onHashChange);
        window.addEventListener('pagehide', this.flushSave);
        if (this.$refs.bgCanvas) {
            paintBackground(this.$refs.bgCanvas);
            this.bgWidth = window.innerWidth;
            window.addEventListener('resize', this.onResizeRepaint);
        }
    },
    beforeUnmount() {
        window.removeEventListener('hashchange', this.onHashChange);
        window.removeEventListener('pagehide', this.flushSave);
        window.removeEventListener('resize', this.onResizeRepaint);
        clearTimeout(this.resizeTimer);
        clearTimeout(this.feedbackTimer);
        clearTimeout(this.saveTimer);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    },
    methods: {
        normalizeNumber(value, min, fallback) {
            if (value === '' || value === null) {
                return fallback;
            }
            const n = Number(value);
            if (!Number.isFinite(n)) {
                return fallback;
            }
            return Math.max(min, Math.floor(n));
        },
        // Measure in the DOM: canvas can pick a different emoji fallback font than the page.
        measureIcon() {
            const pre = this.$refs.viewer && this.$refs.viewer.querySelector('.viewer-text');
            if (!pre) {
                return;
            }
            const probe = this.probe || (this.probe = document.createElement('span'));
            probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;font:' + getComputedStyle(pre).font;
            if (!probe.isConnected) {
                document.body.appendChild(probe);
            }
            probe.textContent = ' '.repeat(16);
            const space = probe.getBoundingClientRect().width / 16;
            let widest = 0;
            for (const icon of this.widthList) {
                probe.textContent = icon;
                widest = Math.max(widest, probe.getBoundingClientRect().width);
            }
            this.measuredWidth = space > 0 && widest > 0 ? widest / space : 0;
            if (space > 0) {
                this.spacePx = space;
            }
        },
        iconIndex(i, idx, multi) {
            if (this.cycleMode === 'column') {
                return multi ? idx : i;
            }
            return this.cycleMode === 'diagonal' ? i + idx : i;
        },
        // Structure of line `i`; lines are built on demand, so cost follows what is shown, not the line count.
        lineParts(i) {
            const p = this.pattern;
            const { gap, step } = this.iconSpacing;
            const row = p.row(i, this.safeAmplitude, this.safeCurveLength, step * 2 - 1, this.cellAspect);
            const list = this.iconList;
            const n = list.length;
            const cells = (n === 0 ? [] : row.cells).map((idx) => ({
                idx,
                icon: n === 1 ? list[0] : list[this.iconIndex(i, idx, p.multi) % n]
            }));
            return { pad: row.pad, cells, gap, slot: step * 2, num: this.showLineNumbers ? String(i + 1) : '' };
        },
        lineAt(i) {
            const { pad, cells, gap, slot, num } = this.lineParts(i);
            if (!cells.length) {
                return num ? ' '.repeat(pad) + num : '';
            }
            let s = '';
            let prev = -1;
            for (const cell of cells) {
                s += ' '.repeat(prev < 0 ? pad + cell.idx * slot : gap + (cell.idx - prev - 1) * slot) + cell.icon;
                prev = cell.idx;
            }
            return num ? s + ' ' + num : s;
        },
        buildFullText() {
            const n = this.totalLines;
            const chunks = [];
            const CHUNK = 20000;
            for (let s = 0; s < n; s += CHUNK) {
                const end = Math.min(n, s + CHUNK);
                const part = new Array(end - s);
                for (let i = s, k = 0; i < end; i++, k++) {
                    part[k] = this.lineAt(i);
                }
                chunks.push(part.join('\n'));
            }
            return chunks.join('\n');
        },
        flash(key, message) {
            if (key) {
                this[key] = true;
            }
            this.notice = message || '';
            clearTimeout(this.feedbackTimer);
            this.feedbackTimer = setTimeout(() => {
                this.copied = false;
                this.linkCopied = false;
                this.notice = '';
            }, 1600);
        },
        async copyOutput() {
            let text;
            try {
                text = applyExportFormat(this.buildFullText(), this.exportFormat);
            } catch (error) {
                this.notice = 'Output is too large to build in memory.';
                return;
            }
            try {
                // code blocks are markdown: keep them plain; everything else also carries monospace styling
                await copyToClipboard(text, this.exportFormat !== 'code');
                this.flash('copied');
            } catch (error) {
                console.error('Copy failed:', error);
                this.notice = 'Copy failed (output may be too large for the clipboard).';
            }
        },
        downloadText() {
            try {
                const text = applyExportFormat(this.buildFullText(), this.exportFormat === 'invisible' ? 'invisible' : 'plain');
                downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'icons.txt');
            } catch (error) {
                this.notice = 'Output is too large to download as one file.';
            }
        },
        // Draw the shape on a canvas using the same layout model as the text, so it stays symmetric.
        downloadPng() {
            const pre = this.$refs.viewer.querySelector('.viewer-text');
            const dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
            const rows = Math.min(this.totalLines, PNG_MAX_LINES);
            const fontSize = 18;
            const lineH = 26;
            const margin = 24;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const font = fontSize + 'px ' + getComputedStyle(pre).fontFamily;
            ctx.font = font;
            const spaceW = ctx.measureText(' ').width;
            const w = this.iconWidth;

            const parts = [];
            let maxUnits = 1;
            for (let i = 0; i < rows; i++) {
                const p = this.lineParts(i);
                parts.push(p);
                const last = p.cells.length ? p.cells[p.cells.length - 1].idx : -1;
                const end = p.pad + (last >= 0 ? last * p.slot + w : 0) + (p.num ? p.num.length + 1 : 0);
                maxUnits = Math.max(maxUnits, end);
            }
            const width = Math.ceil(maxUnits * spaceW) + margin * 2;
            const height = rows * lineH + margin * 2;
            const scale = width * height * 4 < 100e6 ? 2 : 1;
            canvas.width = width * scale;
            canvas.height = height * scale;
            ctx.scale(scale, scale);
            ctx.fillStyle = dark ? '#12151c' : '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.font = font;
            ctx.textBaseline = 'middle';
            const ink = dark ? '#e8ebf2' : '#14213d';
            parts.forEach((p, r) => {
                const y = margin + r * lineH + lineH / 2;
                ctx.fillStyle = ink;
                p.cells.forEach((cell) => {
                    ctx.fillText(cell.icon, margin + (p.pad + cell.idx * p.slot) * spaceW, y);
                });
                if (p.num) {
                    const last = p.cells.length ? p.cells[p.cells.length - 1].idx : -1;
                    const x = p.pad + (last >= 0 ? last * p.slot + w + 1 : 0);
                    ctx.globalAlpha = 0.5;
                    ctx.fillText(p.num, margin + x * spaceW, y);
                    ctx.globalAlpha = 1;
                }
            });
            canvas.toBlob((blob) => {
                if (!blob) {
                    this.notice = 'Could not create the image.';
                    return;
                }
                downloadBlob(blob, 'icons.png');
                if (this.totalLines > rows) {
                    this.flash(null, 'PNG contains the first ' + rows.toLocaleString() + ' lines.');
                }
            }, 'image/png');
        },
        // --- sharing ---
        hashString() {
            return new URLSearchParams(Object.entries(this.settings).map(([k, v]) => [k, String(v)])).toString();
        },
        // A link pasted into the address bar of an already-open tab changes only the hash (no reload).
        // Our own updates use replaceState, which does not fire this event.
        onHashChange() {
            const fromLink = settingsFromHash();
            if (Object.keys(fromLink).length) {
                Object.assign(this, DEFAULTS, fromLink);
            }
        },
        syncHash() {
            try {
                history.replaceState(null, '', '#' + this.hashString());
            } catch (error) {
                // e.g. sandboxed frame: sharing still works through copyLink
            }
        },
        async copyLink() {
            const url = location.origin === 'null' || location.protocol === 'file:'
                ? location.href.split('#')[0] + '#' + this.hashString()
                : location.origin + location.pathname + '#' + this.hashString();
            try {
                await copyToClipboard(url);
                this.flash('linkCopied');
            } catch (error) {
                this.notice = 'Could not copy the link.';
            }
        },
        // --- presets ---
        savePreset() {
            const name = this.presetName.trim();
            if (!name) {
                return;
            }
            const data = { ...this.settings };
            const existing = this.userPresets.findIndex((p) => p.name === name);
            if (existing >= 0) {
                this.userPresets.splice(existing, 1, { name, data });
            } else {
                this.userPresets.push({ name, data });
            }
            writeStorage(PRESETS_KEY, this.userPresets);
            this.presetName = '';
        },
        applyPreset(preset) {
            // built-in samples are for copying, so they come without line numbers
            Object.assign(this, DEFAULTS, preset.builtin ? { showLineNumbers: false } : {}, sanitizeSettings(preset.data));
            if (preset.data.fitLines) {
                // shape height depends on the icon's size, so wait for it to be measured
                this.$nextTick(() => {
                    this.measureIcon();
                    this.$nextTick(() => this.fitLines());
                });
            }
        },
        deletePreset(name) {
            this.userPresets = this.userPresets.filter((p) => p.name !== name);
            writeStorage(PRESETS_KEY, this.userPresets);
        },
        // --- misc ---
        onScroll(e) {
            this.scrollTop = e.target.scrollTop;
        },
        measureViewport() {
            this.viewportHeight = this.$refs.viewer.clientHeight;
        },
        // Repaint the background after the window settles; ignore height-only changes (mobile toolbars).
        onResizeRepaint() {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => {
                if (Math.abs(window.innerWidth - this.bgWidth) > 40) {
                    this.bgWidth = window.innerWidth;
                    paintBackground(this.$refs.bgCanvas);
                }
            }, 300);
        },
        flushSave() {
            clearTimeout(this.saveTimer);
            writeStorage(STORAGE_KEY, this.settingsSnapshot);
            this.syncHash();
        },
        // One shape exactly: set the line count to the rows the current shape needs.
        fitLines() {
            if (this.shapeRows) {
                this.lines = this.shapeRows;
            }
        },
        resetAll() {
            Object.assign(this, DEFAULTS);
        },
        clearIcon() {
            this.icon = '';
            this.$refs.iconInput.focus();
        },
        pickEmoji(emoji) {
            if (this.emojiAppend) {
                this.icon = (this.icon || '') + (this.cycleIcons && this.icon ? ' ' : '') + emoji;
            } else {
                this.icon = emoji;
            }
        }
    }
}).mount('#app');
