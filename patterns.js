// Pattern definitions and the small math helpers they share. No DOM access here.
//
// A pattern describes the shape of line `i` as { pad, cells }:
//   pad   - left indent, in spaces
//   cells - indexes of the filled icon slots on that line (slot width = icon + gap)
// Simple patterns only move one icon sideways (pad); "centered" and "mask" patterns fill slots.

// Display width of the icon in monospace columns (emoji / non-ASCII ~ 2 columns).
function displayWidth(text) {
    const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
    const graphemes = segmenter ? Array.from(segmenter.segment(text), (x) => x.segment) : Array.from(text);
    let w = 0;
    for (const g of graphemes) {
        // one visible glyph: emoji / CJK take 2 columns, everything else 1
        w += /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(g) || g.codePointAt(0) >= 0x2e80 ? 2 : 1;
    }
    return Math.max(1, w);
}

// Indent for `n` half-slots (half an icon+gap), rounded once so centered shapes stay symmetric.
function halfSteps(n, w) {
    return Math.round((n * (w + 1)) / 2);
}

// 0 -> amplitude -> 0, repeating every `period` lines
function triangle(index, period, amplitude) {
    const half = period / 2;
    const pos = index % period;
    const t = pos <= half ? pos / half : (period - pos) / half;
    return Math.round(t * amplitude);
}

// Linear interpolation through [position 0..1, level 0..1] keypoints.
function piecewise(keys, t) {
    for (let k = 1; k < keys.length; k++) {
        if (t <= keys[k][0]) {
            const [t0, v0] = keys[k - 1];
            const [t1, v1] = keys[k];
            return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
        }
    }
    return keys[keys.length - 1][1];
}

const ECG_KEYS = [
    [0, 0.3], [0.08, 0.3], [0.14, 0.5], [0.2, 0.3], [0.28, 0.3],
    [0.31, 0.12], [0.36, 1], [0.41, 0], [0.45, 0.3],
    [0.52, 0.3], [0.62, 0.55], [0.72, 0.3], [1, 0.3]
];

function range(n) {
    return Array.from({ length: n }, (_, k) => k);
}

// Tiny hearts are drawn by hand: a smooth curve needs a few columns before it reads as a heart.
const HEART_SMALL = {
    2: ['.#.#.', '#####', '.###.', '..#..'],
    3: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
};

// --- smooth shapes ----------------------------------------------------------------------------
// Defined in continuous coordinates (x in [-xr, xr], y from `top` down to `bottom`) and sampled at
// every icon slot, so edges are round at any size. `ratio` = height / width on screen; the number of
// lines follows from the real icon proportions (aspect = slot width / row height).
function makeHeart(lobe, depth) {
    // two round lobes (radius `lobe`, outer edges at x = +-1) over tangent lines running to a tip `depth` below
    const ox = 1 - lobe;
    const dist = Math.hypot(ox, depth);
    const theta = Math.atan2(depth, ox) - Math.asin(lobe / dist); // angle of the outer tangent line
    const tangentY = -depth + Math.sqrt(dist * dist - lobe * lobe) * Math.sin(theta);
    const halfWidth = (y) => {
        if (y <= tangentY) {
            return (y + depth) / Math.tan(theta);
        }
        return ox + Math.sqrt(Math.max(0, lobe * lobe - y * y));
    };
    return {
        xr: 1,
        top: lobe,
        bottom: -depth,
        inside: (x, y) => {
            const ax = Math.abs(x);
            return Math.hypot(ax - ox, y) <= lobe || (y <= 0 && ax <= halfWidth(y));
        }
    };
}

const SHAPES = {
    heart: makeHeart(0.56, 1.1),
    circle: { xr: 1, top: 1, bottom: -1, inside: (x, y) => x * x + y * y <= 1 },
    ring: {
        xr: 1,
        top: 1,
        bottom: -1,
        // wall about as thick as one icon, seen from the unit circle
        inside: (x, y, R) => {
            const d = x * x + y * y;
            const inner = Math.max(0, 1 - 1.4 / (R + 0.5));
            return d <= 1 && d >= inner * inner;
        }
    }
};

// --- grid shapes: filled(col, row, R) on a (2R+1) x (2R+1) grid -------------------------------
const MASKS = {
    cross: (c, r, R) => c === r || c === 2 * R - r,
    checker: (c, r) => (c + r) % 2 === 0,
    frame: (c, r, R) => c === 0 || r === 0 || c === 2 * R || r === 2 * R
};

// A shape repeats after its own rows plus one blank row.
// `scale` shrinks the radius. Round shapes (SHAPES) and `stretch`ed grid shapes keep their proportions on
// screen: an icon slot is usually wider than a text row is tall (aspect = slot width / row height),
// so they get proportionally more rows.
function maskPattern(value, label, { scale = 1, stretch = false } = {}) {
    const shape = SHAPES[value];
    const grid = MASKS[value];
    const radius = (a) => Math.max(2, Math.round(a * scale));
    const clampAspect = (aspect) => Math.min(12, Math.max(1, aspect));
    const totalRows = (R, aspect) => {
        if (value === 'heart' && HEART_SMALL[R]) {
            return Math.max(1, Math.round(HEART_SMALL[R].length * clampAspect(aspect)));
        }
        if (shape) {
            const ratio = (shape.top - shape.bottom) / (2 * shape.xr);
            return Math.max(3, Math.round((2 * R + 1) * clampAspect(aspect) * ratio));
        }
        return Math.max(1, Math.round((2 * R + 1) * (stretch ? clampAspect(aspect) : 1)));
    };
    const filled = (c, r, rows, R) => {
        if (value === 'heart' && HEART_SMALL[R]) {
            const logical = Math.min(HEART_SMALL[R].length - 1, Math.floor(((r + 0.5) * HEART_SMALL[R].length) / rows));
            return HEART_SMALL[R][logical][c] === '#';
        }
        if (shape) {
            const x = ((c - R) / (R + 0.5)) * shape.xr;
            const y = shape.top - ((r + 0.5) / rows) * (shape.top - shape.bottom);
            return shape.inside(x, y, R);
        }
        const logical = Math.min(2 * R, Math.floor(((r + 0.5) * (2 * R + 1)) / rows));
        return grid(c, logical, R);
    };
    return {
        value,
        label,
        mask: true,
        stretch: Boolean(shape || stretch),
        cols: (a) => 2 * radius(a) + 1,
        // lines one shape takes (without the blank separator)
        shapeRows: (a, aspect = 1.25) => totalRows(radius(a), aspect),
        row: (i, a, c, w, aspect = 1.25) => {
            const R = radius(a);
            const rows = totalRows(R, aspect);
            const r = i % (rows + 1);
            if (r === rows) {
                return { pad: 0, cells: [] };
            }
            const cells = [];
            for (let col = 0; col <= 2 * R; col++) {
                if (filled(col, r, rows, R)) {
                    cells.push(col);
                }
            }
            return { pad: 0, cells };
        }
    };
}

// pad-only pattern: one icon per line
function shift(value, label, pad) {
    return { value, label, pad, row: (i, a, c, w) => ({ pad: pad(i, a, c, w), cells: [0] }) };
}

// centered pattern: `count` icons per line, indented so the shape stays centered
function centered(value, label, count, pad) {
    return {
        value,
        label,
        centered: true,
        cols: (a) => a + 1,
        row: (i, a, c, w) => ({ pad: pad(i, a, c, w), cells: range(count(i, a, c)) })
    };
}

const PATTERNS = [
    shift('straight', 'Straight (default)', () => 0),
    // Sine blended 50/50 with a triangle wave: pure sine rounds to irregular 0/1/2-space steps on a
    // character grid, the blend keeps the rounded look but moves at an even pace.
    // Even period + half-line phase give peaks and troughs plateaus of equal length.
    shift('wave', 'Sine Wave', (i, a, c) => {
        const period = Math.max(2, 2 * Math.round(c / 2));
        const phase = ((i % period) + 0.5) / period;
        const sine = (1 - Math.cos(phase * Math.PI * 2)) / 2;
        const tri = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
        return Math.round((sine + tri) / 2 * a);
    }),
    shift('curve', 'Curved (bounce)', (i, a) => (a === 0 ? 0 : triangle(i, a * 2, a))),
    shift('stair-up', 'Stair Up', (i, a) => i % (a + 1)),
    shift('stair-down', 'Stair Down', (i, a) => a - (i % (a + 1))),
    shift('zigzag', 'Zigzag', (i, a, c) => (a === 0 ? 0 : triangle(i, Math.max(2, c), a))),
    shift('double-wave', 'Double Wave', (i, a, c) => {
        const x = (i / Math.max(2, c)) * Math.PI * 2;
        return Math.round(((2 + Math.sin(x) + Math.sin(2 * x)) / 4) * a);
    }),
    shift('square', 'Square Wave', (i, a, c) => (i % Math.max(2, c) < Math.max(2, c) / 2 ? 0 : a)),
    // ECG: flat baseline, small P bump, sharp Q-R-S spike, rounded T bump
    shift('heartbeat', 'Heartbeat', (i, a, c) => {
        const period = Math.max(8, c);
        // snap key times to whole lines so the spike always lands exactly on a sample
        const keys = ECG_KEYS.map(([t, v]) => [Math.round(t * period) / period, v]);
        return Math.round(piecewise(keys, (i % period) / period) * a);
    }),
    shift('v-shape', 'V Shape', (i, a, c) => (a === 0 ? 0 : a - triangle(i, Math.max(2, c), a))),
    shift('random', 'Random Walk', (i, a) => {
        // deterministic hash so a line is always the same without storing state
        let h = Math.imul(i + 1, 2654435761);
        h = Math.imul(h ^ (h >>> 15), 2246822519);
        h ^= h >>> 13;
        return (h >>> 0) % (a + 1);
    }),
    centered('pyramid', 'Pyramid', (i, a) => (i % (a + 1)) + 1, (i, a, c, w) => halfSteps(a - (i % (a + 1)), w)),
    centered(
        'diamond',
        'Diamond',
        (i, a) => (a === 0 ? 1 : triangle(i, a * 2, a) + 1),
        (i, a, c, w) => (a === 0 ? 0 : halfSteps(a - triangle(i, a * 2, a), w))
    ),
    centered(
        'hourglass',
        'Hourglass',
        (i, a) => (a === 0 ? 1 : a - triangle(i, a * 2, a) + 1),
        (i, a, c, w) => (a === 0 ? 0 : halfSteps(triangle(i, a * 2, a), w))
    ),
    maskPattern('heart', 'Heart', { scale: 0.8, stretch: true }),
    maskPattern('circle', 'Circle', { stretch: true }),
    maskPattern('ring', 'Ring', { stretch: true }),
    maskPattern('frame', 'Frame', { stretch: true }),
    maskPattern('cross', 'Cross (X)'),
    maskPattern('checker', 'Checkerboard')
];

// Which settings a pattern actually reacts to (drives enabled/disabled controls).
const CURVE_PATTERNS = new Set(['wave', 'double-wave', 'square', 'heartbeat', 'v-shape', 'zigzag']);
PATTERNS.forEach((p) => {
    p.usesAmplitude = p.value !== 'straight';
    p.usesCurve = CURVE_PATTERNS.has(p.value);
    p.multi = Boolean(p.centered || p.mask); // lines can hold several icons
});
const PATTERN_MAP = Object.fromEntries(PATTERNS.map((p) => [p.value, p]));

// Static miniature of a pattern, as small bars/dots in a 48x38 box.
function patternThumb(p) {
    const a = p.mask ? 4 : 6;
    const rows = 12;
    const items = [];
    let max = 1;
    for (let i = 0; i < rows; i++) {
        // thumb units: icon width 1, slot width 2
        const { pad, cells } = p.row(i, a, 12, 1);
        const xs = cells.map((idx) => pad + idx * 2);
        items.push(xs);
        xs.forEach((x) => {
            max = Math.max(max, x + 1.4);
        });
    }
    const out = [];
    items.forEach((xs, i) => {
        xs.forEach((x) => {
            out.push({ x: (x / max) * 44 + 2, y: i * 3 + 1.5, w: Math.max(1.6, (1.4 / max) * 44) });
        });
    });
    return out;
}
const PATTERN_THUMBS = Object.fromEntries(PATTERNS.map((p) => [p.value, patternThumb(p)]));

if (typeof module !== 'undefined') {
    module.exports = { PATTERNS, PATTERN_MAP, MASKS, SHAPES, displayWidth };
}
