// Select all canvas contexts
const canvasT = document.getElementById('time-canvas');
const canvasF = document.getElementById('freq-canvas');
const canvasP = document.getElementById('phasor-canvas');
const canvasPwr = document.getElementById('power-canvas');

const ctxT = canvasT.getContext('2d');
const ctxF = canvasF.getContext('2d');
const ctxP = canvasP.getContext('2d');
const ctxPwr = canvasPwr.getContext('2d');

// Select DOM Elements
const elements = {
    carrierFreq: document.getElementById('carrier-freq'),
    modulatorFreq: document.getElementById('modulator-freq'),
    modIndex: document.getElementById('mod-index'),
    dryWet: document.getElementById('dry-wet'),
    audioBtn: document.getElementById('audio-toggle'),
};

const displays = {
    carrierFreq: document.getElementById('val-carrier-freq'),
    modulatorFreq: document.getElementById('val-modulator-freq'),
    modIndex: document.getElementById('val-mod-index'),
    dryWet: document.getElementById('val-dry-wet'),
};

function getMode() {
    const radio = document.querySelector('input[name="mod-mode"]:checked');
    return radio ? radio.value : 'dsb-fc';
}

// Animation time trackers
let timePhase = 0;
let phasorTime = 0;

// --- AUDIO ENGINE SYSTEM ---
let audioCtx = null;
let nodes = {};
let isPlaying = false;

function initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // Generators
    nodes.cOsc = audioCtx.createOscillator(); // carrier (fc)
    nodes.mOsc = audioCtx.createOscillator(); // mod (fm)
    nodes.usbOsc = audioCtx.createOscillator(); // (fc+fm)
    nodes.lsbOsc = audioCtx.createOscillator(); // (fc-fm)

    // Setup Mod path logic
    nodes.modGain = audioCtx.createGain();
    nodes.vca = audioCtx.createGain();

    // Control Mix Gains
    nodes.branchMod = audioCtx.createGain();    // VCA Output Active?
    nodes.branchAdditive = audioCtx.createGain(); // Sum of Sidebands Active?
    nodes.usbGain = audioCtx.createGain();
    nodes.lsbGain = audioCtx.createGain();

    // Final mixing logic
    nodes.dryGain = audioCtx.createGain();
    nodes.wetGain = audioCtx.createGain();
    nodes.master = audioCtx.createGain();

    // Connect BRANCH 1: Amplitude Modulation (DSB modes)
    nodes.mOsc.connect(nodes.modGain);
    nodes.modGain.connect(nodes.vca.gain);
    nodes.cOsc.connect(nodes.vca);
    nodes.vca.connect(nodes.branchMod);

    // Connect BRANCH 2: Additive Frequency Logic (SSB/VSB)
    nodes.usbOsc.connect(nodes.usbGain);
    nodes.lsbOsc.connect(nodes.lsbGain);
    nodes.usbGain.connect(nodes.branchAdditive);
    nodes.lsbGain.connect(nodes.branchAdditive);

    // Connect Branches to WET, carrier directly to DRY
    nodes.branchMod.connect(nodes.wetGain);
    nodes.branchAdditive.connect(nodes.wetGain);
    nodes.cOsc.connect(nodes.dryGain);

    // Master mix
    nodes.dryGain.connect(nodes.master);
    nodes.wetGain.connect(nodes.master);
    nodes.master.connect(audioCtx.destination);

    nodes.master.gain.value = 0.25; // Conservatively safe level

    // Start generation
    nodes.cOsc.start();
    nodes.mOsc.start();
    nodes.usbOsc.start();
    nodes.lsbOsc.start();

    updateAudioParams();
}

function updateAudioParams() {
    if (!audioCtx) return;

    const fc = parseFloat(elements.carrierFreq.value);
    const fm = parseFloat(elements.modulatorFreq.value);
    const m = parseFloat(elements.modIndex.value);
    const mix = parseFloat(elements.dryWet.value);
    const mode = getMode();

    const now = audioCtx.currentTime;
    const smooth = 0.03; // Inter-step interpolation

    // Set Frequencies
    nodes.cOsc.frequency.setTargetAtTime(fc, now, smooth);
    nodes.mOsc.frequency.setTargetAtTime(fm, now, smooth);
    nodes.usbOsc.frequency.setTargetAtTime(fc + fm, now, smooth);
    nodes.lsbOsc.frequency.setTargetAtTime(fc - fm, now, smooth);

    // Dry / Wet Mix ratios
    nodes.dryGain.gain.setTargetAtTime(1 - mix, now, smooth);
    nodes.wetGain.gain.setTargetAtTime(mix, now, smooth);

    // Mode branching configuration
    if (mode === 'dsb-fc') {
        nodes.branchMod.gain.setTargetAtTime(1, now, smooth);
        nodes.branchAdditive.gain.setTargetAtTime(0, now, smooth);

        nodes.vca.gain.setTargetAtTime(1, now, smooth); // Base unit DC offset
        nodes.modGain.gain.setTargetAtTime(m, now, smooth);
    }
    else if (mode === 'dsb-sc') {
        nodes.branchMod.gain.setTargetAtTime(1, now, smooth);
        nodes.branchAdditive.gain.setTargetAtTime(0, now, smooth);

        nodes.vca.gain.setTargetAtTime(0, now, smooth); // Carrier suppressed
        nodes.modGain.gain.setTargetAtTime(m, now, smooth);
    }
    else if (mode === 'ssb') {
        nodes.branchMod.gain.setTargetAtTime(0, now, smooth);
        nodes.branchAdditive.gain.setTargetAtTime(1, now, smooth);

        nodes.usbGain.gain.setTargetAtTime(1.0, now, smooth);
        nodes.lsbGain.gain.setTargetAtTime(0.0, now, smooth);
    }
    else if (mode === 'vsb') {
        nodes.branchMod.gain.setTargetAtTime(0, now, smooth);
        nodes.branchAdditive.gain.setTargetAtTime(1, now, smooth);

        nodes.usbGain.gain.setTargetAtTime(1.0, now, smooth);
        nodes.lsbGain.gain.setTargetAtTime(0.25, now, smooth); // 1/4 power vestige
    }
}

function toggleAudio() {
    if (!audioCtx) initAudio();

    if (isPlaying) {
        audioCtx.suspend().then(() => {
            elements.audioBtn.classList.remove('running');
            elements.audioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Start Engine</span>`;
            isPlaying = false;
        });
    } else {
        audioCtx.resume().then(() => {
            elements.audioBtn.classList.add('running');
            elements.audioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>Stop Engine</span>`;
            isPlaying = true;
        });
    }
}
elements.audioBtn.addEventListener('click', toggleAudio);

// --- UI EVENTS ---
function updateUI() {
    displays.carrierFreq.textContent = elements.carrierFreq.value;
    displays.modulatorFreq.textContent = elements.modulatorFreq.value;
    displays.modIndex.textContent = parseFloat(elements.modIndex.value).toFixed(2);
    displays.dryWet.textContent = Math.round(parseFloat(elements.dryWet.value) * 100);

    // Update live formula display based on mode
    const mode = getMode();
    const subtitleEl = document.querySelector('.subtitle');
    if (subtitleEl) {
        const formulas = {
            'dsb-fc': 'y(t) = [1 + m · cos(2π f_m t)] · A cos(2π f_c t)',
            'dsb-sc': 'y(t) = [m · cos(2π f_m t)] · A cos(2π f_c t)',
            'ssb': 'y(t) = A cos(2π (f_c + f_m) t)',
            'vsb': 'y(t) = A [cos(2π (f_c + f_m) t) + 0.25 · cos(2π (f_c - f_m) t)]'
        };
        subtitleEl.innerText = formulas[mode];
    }

    updateAudioParams();
    updateStats(); // Telemetry injection point
}

function updateStats() {
    const m = parseFloat(elements.modIndex.value);
    const mode = getMode();

    let pc = 0;
    let psb = 0;
    let ptotal = 0;
    let eff = 0;

    const BASE_P = 0.5; // Theoretical nominal power normalized

    if (mode === 'dsb-fc') {
        pc = BASE_P;
        psb = (m * m / 2) * BASE_P;
        ptotal = pc + psb;
        eff = ptotal > 0 ? (psb / ptotal) * 100 : 0;
    } else if (mode === 'dsb-sc') {
        pc = 0;
        psb = (m * m / 2) * BASE_P;
        ptotal = psb;
        eff = 100;
    } else if (mode === 'ssb') {
        pc = 0;
        psb = BASE_P;
        ptotal = psb;
        eff = 100;
    } else if (mode === 'vsb') {
        pc = 0;
        const pUSB = BASE_P;
        const pLSB = BASE_P * 0.0625; // 0.25^2
        psb = pUSB + pLSB;
        ptotal = psb;
        eff = 100;
    }

    const elPc = document.getElementById('stat-pc');
    const elPsb = document.getElementById('stat-psb');
    const elPt = document.getElementById('stat-pt');
    const elEff = document.getElementById('stat-eff');

    if (elPc) elPc.textContent = pc.toFixed(3) + " W";
    if (elPsb) elPsb.textContent = psb.toFixed(3) + " W";
    if (elPt) elPt.textContent = ptotal.toFixed(3) + " W";

    if (elEff) {
        elEff.textContent = eff.toFixed(1) + "%";
        const r = Math.floor(255 * (1 - eff / 100));
        const g = Math.floor(150 + 105 * (eff / 100));
        const b = Math.floor(254 * (eff / 100));
        elEff.style.color = `rgb(${r},${g},${b})`;
    }

    // --- UPDATE NEW SCIENTIFIC LEDGER SECTION (Ledger Footer) ---
    // Reference Ac = 1.0 V peak.
    const vMax = 1 + m;
    const vMin = 1 - m;

    const ledVmax = document.getElementById('ld-vmax');
    const ledVmin = document.getElementById('ld-vmin');
    const ledPtot = document.getElementById('ld-ptotal');
    const ledEff = document.getElementById('ld-efficiency');

    if (ledVmax) ledVmax.textContent = vMax.toFixed(2) + " V";
    if (ledVmin) ledVmin.textContent = vMin.toFixed(2) + " V";
    if (ledPtot) ledPtot.textContent = ptotal.toFixed(3) + " W";
    if (ledEff) ledEff.textContent = eff.toFixed(1) + "%";
}

// Event setup for sliders
Object.values(elements).forEach(el => {
    if (el && el.id !== 'audio-toggle') el.addEventListener('input', updateUI);
});
// Radio button group event listeners
document.querySelectorAll('input[name="mod-mode"]').forEach(r => r.addEventListener('change', updateUI));

document.querySelectorAll('input[name="view-mode"]').forEach(r => {
    r.addEventListener('change', (e) => {
        const cluster = document.getElementById('vis-cluster');
        if (cluster) {
            cluster.setAttribute('data-view', e.target.value);
            // Slight delay so the browser calculates finished grid clientWidth before resize read
            setTimeout(resizeAll, 10);
        }
    });
});

// Resize handler for multiple canvases
function resizeAll() {
    [
        { c: canvasT, x: ctxT },
        { c: canvasF, x: ctxF },
        { c: canvasP, x: ctxP },
        { c: canvasPwr, x: ctxPwr }
    ].forEach(pair => {
        const dpr = window.devicePixelRatio || 1;
        const rect = pair.c.parentElement.getBoundingClientRect();
        pair.c.width = rect.width * dpr;
        pair.c.height = rect.height * dpr;
        pair.x.scale(dpr, dpr);
    });
}
window.addEventListener('resize', resizeAll);
resizeAll();

// --- RENDERING ENGINES ---

function drawArrow(ctx, fromx, fromy, tox, toy, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    const headlen = 8;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function drawTime(w, h, fc, fm, m, mix, mode) {
    ctxT.clearRect(0, 0, w, h);

    // Partition height into three explicit horizontal zones for full pedagogical display
    const trackH = h / 3;
    const duration = 2 / (fm || 0.1);
    const trackAmp = trackH * 0.35; // Scaled excursion limit

    // Geometric baselines
    const midMessage = trackH * 0.5;
    const midCarrier = trackH * 1.5;
    const midResult = trackH * 2.5;

    // Step 0. Draw partition borders & baselines
    ctxT.strokeStyle = 'rgba(255,255,255,0.06)'; ctxT.lineWidth = 1;
    [midMessage, midCarrier, midResult].forEach(y => {
        ctxT.beginPath(); ctxT.moveTo(0, y); ctxT.lineTo(w, y); ctxT.stroke();
    });
    ctxT.strokeStyle = 'rgba(255,255,255,0.08)';
    ctxT.beginPath(); ctxT.moveTo(0, trackH); ctxT.lineTo(w, trackH); ctxT.stroke();
    ctxT.beginPath(); ctxT.moveTo(0, 2 * trackH); ctxT.lineTo(w, 2 * trackH); ctxT.stroke();

    // Labels atop tracks
    ctxT.fillStyle = 'rgba(255,255,255,0.35)'; ctxT.font = 'bold 9px sans-serif';
    ctxT.fillText("INPUT MESSAGE m(t)", 12, midMessage - trackAmp - 8);
    ctxT.fillText("INPUT CARRIER c(t)", 12, midCarrier - trackAmp - 8);
    ctxT.fillText("OUTPUT SIGNAL s(t)", 12, midResult - trackAmp - 8);

    // Batch define linear paths
    const pathM = new Path2D();
    const pathC = new Path2D();
    const pathS = new Path2D();

    for (let x = 0; x <= w; x++) {
        const t = (x / w) * duration + timePhase;
        const cosC = Math.cos(2 * Math.PI * fc * t);
        const cosM = Math.cos(2 * Math.PI * fm * t);

        let wet = 0;
        if (mode === 'dsb-fc') wet = (1 + m * cosM) * cosC;
        else if (mode === 'dsb-sc') wet = (m * cosM) * cosC;
        else if (mode === 'ssb') wet = Math.cos(2 * Math.PI * (fc + fm) * t);
        else if (mode === 'vsb') wet = Math.cos(2 * Math.PI * (fc + fm) * t) + 0.25 * Math.cos(2 * Math.PI * (fc - fm) * t);

        const sigFinal = (1 - mix) * cosC + mix * wet;

        const yM = midMessage - (cosM * trackAmp);
        const yC = midCarrier - (cosC * trackAmp);
        const yS = midResult - (sigFinal * trackAmp);

        if (x === 0) {
            pathM.moveTo(x, yM); pathC.moveTo(x, yC); pathS.moveTo(x, yS);
        } else {
            pathM.lineTo(x, yM); pathC.lineTo(x, yC); pathS.lineTo(x, yS);
        }
    }

    // Stroke paths with unique styling identities
    ctxT.lineWidth = 1.5;

    // 1. Message Plot (Pinkish Accent)
    ctxT.strokeStyle = '#ff006e'; ctxT.stroke(pathM);

    // 2. Carrier Plot (Neutral Ghost)
    ctxT.strokeStyle = 'rgba(255,255,255,0.4)'; ctxT.stroke(pathC);

    // 3. Output Plot (Full Radiant Glow Cyan)
    ctxT.lineWidth = 2;
    ctxT.strokeStyle = '#00f2fe';
    ctxT.shadowBlur = 12; ctxT.shadowColor = '#00f2fe';
    ctxT.stroke(pathS);
    ctxT.shadowBlur = 0;

    // --- NEW: Draw Max/Min Voltage reference lines IN THE WAVEFORM for DSB-FC ---
    if (mode === 'dsb-fc' || mode === 'dsb-sc') {
        const envMax = (mode === 'dsb-fc') ? (1 + m) : m;
        const envMin = (mode === 'dsb-fc') ? Math.abs(1 - m) : 0;

        // We represent theoretical pedagogical Envelope Values (1+m) and (1-m)
        const peakV = (mode === 'dsb-fc') ? (1 + m) : m;
        const valleyV = (mode === 'dsb-fc') ? (1 - m) : 0;

        const yMax = midResult - (peakV * trackAmp);
        const yMin = midResult - (valleyV * trackAmp);

        ctxT.setLineDash([3, 3]);
        ctxT.lineWidth = 1;
        ctxT.strokeStyle = 'rgba(255, 209, 102, 0.4)'; // Warm yellow reference

        // Draw Top Peak Line
        ctxT.beginPath(); ctxT.moveTo(0, yMax); ctxT.lineTo(w, yMax); ctxT.stroke();
        // Draw Top Valley Line
        ctxT.beginPath(); ctxT.moveTo(0, yMin); ctxT.lineTo(w, yMin); ctxT.stroke();

        ctxT.setLineDash([]); // reset

        // Labels positioned on the far right
        ctxT.fillStyle = 'rgba(255, 209, 102, 0.8)';
        ctxT.font = 'bold 9px monospace';
        ctxT.textAlign = 'right';
        ctxT.fillText(`Vmax: ${peakV.toFixed(2)}V`, w - 10, yMax - 4);
        ctxT.fillText(`Vmin: ${valleyV.toFixed(2)}V`, w - 10, yMin - 4);
        ctxT.textAlign = 'left'; // reset default
    }
}

function drawFreq(w, h, fc, fm, m, mode) {
    ctxF.clearRect(0, 0, w, h);
    const halfH = h / 2;
    const cx = w / 2;
    const span = w * 0.22; // Horizontal pixel separation ratio
    const barMaxAmp = halfH * 0.55;

    // Part 1. TOP SUBPLOT: Baseband Spectrum (Raw Message)
    const base1 = halfH - 20;
    ctxF.strokeStyle = 'rgba(255,255,255,0.1)'; ctxF.lineWidth = 1;
    ctxF.beginPath(); ctxF.moveTo(15, base1); ctxF.lineTo(w - 15, base1); ctxF.stroke();

    ctxF.fillStyle = 'rgba(255,255,255,0.3)'; ctxF.font = 'bold 9px sans-serif'; ctxF.textAlign = 'left';
    ctxF.fillText("MESSAGE BASEBAND SPECTRUM", 15, 15);

    // Plot Single Baseband Spike for fm at visual center for symmetry
    ctxF.strokeStyle = '#ff006e'; ctxF.lineWidth = 3;
    ctxF.beginPath(); ctxF.moveTo(cx, base1); ctxF.lineTo(cx, base1 - barMaxAmp); ctxF.stroke();
    ctxF.fillStyle = '#ff006e'; ctxF.beginPath(); ctxF.arc(cx, base1 - barMaxAmp, 3, 0, 2 * Math.PI); ctxF.fill();

    ctxF.textAlign = 'center'; ctxF.font = '10px monospace'; ctxF.fillStyle = 'rgba(255,255,255,0.6)';
    ctxF.fillText("f_m", cx, base1 + 15);

    // Part 2. BOTTOM SUBPLOT: Passband Spectrum (RF Output)
    const base2 = h - 25;
    ctxF.strokeStyle = 'rgba(255,255,255,0.1)';
    ctxF.beginPath(); ctxF.moveTo(15, base2); ctxF.lineTo(w - 15, base2); ctxF.stroke();

    ctxF.font = 'bold 9px sans-serif'; ctxF.fillStyle = 'rgba(255,255,255,0.3)'; ctxF.textAlign = 'left';
    ctxF.fillText("MODULATED PASSBAND SPECTRUM", 15, halfH + 15);

    // Gather Active Spectral Lines and calculate exact power weights
    let passLines = [];
    const BASE_P = 0.5; // Reference normalized power W

    if (mode === 'dsb-fc') {
        // Sideband amplitude = m/2. Component Power = (m/2)^2 / 2 = m^2 / 8 * Ac^2 = (m^2 / 4) * Pc
        const sidebandP = (m * m / 4) * BASE_P;
        passLines = [
            { x: cx - span, mag: m / 2, lbl: 'fc-fm', pwr: sidebandP, col: '#ff006e' },
            { x: cx, mag: 1.0, lbl: 'fc', pwr: BASE_P, col: '#ffffff' },
            { x: cx + span, mag: m / 2, lbl: 'fc+fm', pwr: sidebandP, col: '#ff006e' }
        ];
    } else if (mode === 'dsb-sc') {
        const sidebandP = (m * m / 4) * BASE_P;
        passLines = [
            { x: cx - span, mag: m / 2, lbl: 'fc-fm', pwr: sidebandP, col: '#ff006e' },
            { x: cx + span, mag: m / 2, lbl: 'fc+fm', pwr: sidebandP, col: '#ff006e' }
        ];
    } else if (mode === 'ssb') {
        passLines = [{ x: cx + span, mag: 1.0, lbl: 'fc+fm', pwr: BASE_P, col: '#4facfe' }];
    } else if (mode === 'vsb') {
        passLines = [
            { x: cx - span, mag: 0.25, lbl: 'fc-fm', pwr: BASE_P * (0.25 * 0.25), col: '#ff006e' },
            { x: cx + span, mag: 1.0, lbl: 'fc+fm', pwr: BASE_P, col: '#4facfe' }
        ];
    }

    // Plot Passband bars
    ctxF.textAlign = 'center'; ctxF.font = '10px monospace';
    passLines.forEach(ln => {
        const hVal = ln.mag * barMaxAmp;
        ctxF.strokeStyle = ln.col; ctxF.lineWidth = 3;

        ctxF.shadowBlur = 8; ctxF.shadowColor = ln.col;
        ctxF.beginPath(); ctxF.moveTo(ln.x, base2); ctxF.lineTo(ln.x, base2 - hVal); ctxF.stroke();
        ctxF.shadowBlur = 0;

        ctxF.fillStyle = ln.col; ctxF.beginPath(); ctxF.arc(ln.x, base2 - hVal, 3, 0, 2 * Math.PI); ctxF.fill();

        // Main Label
        ctxF.fillStyle = 'rgba(255,255,255,0.6)';
        ctxF.fillText(ln.lbl, ln.x, base2 + 15);

        // NEW: Explicit Power Representation for this part
        ctxF.font = '9px monospace';
        ctxF.fillStyle = 'rgba(255,255,255,0.35)';
        ctxF.fillText(`[${ln.pwr.toFixed(3)}W]`, ln.x, base2 + 26);
        ctxF.font = '10px monospace'; // restore
    });
}

function drawPhasor(w, h, fc, fm, m, mode) {
    ctxP.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    // Grid circles
    ctxP.strokeStyle = 'rgba(255,255,255,0.05)'; ctxP.lineWidth = 1;
    ctxP.beginPath(); ctxP.arc(cx, cy, 70, 0, 2 * Math.PI); ctxP.stroke();
    ctxP.beginPath(); ctxP.arc(cx, cy, 35, 0, 2 * Math.PI); ctxP.stroke();

    // Crosshair
    ctxP.beginPath(); ctxP.moveTo(cx - 80, cy); ctxP.lineTo(cx + 80, cy); ctxP.stroke();
    ctxP.beginPath(); ctxP.moveTo(cx, cy - 80); ctxP.lineTo(cx, cy + 80); ctxP.stroke();

    const R = 60; // Scaling length
    const theta = phasorTime; // Realtime rotating angle for sidebands

    let vX = cx, vY = cy; // Starting drawing cursor at center

    // Define chain of vectors to draw
    // Each vector relative format: [length, angleInRadians, color]
    let vectors = [];

    if (mode === 'dsb-fc') {
        vectors.push({ r: R, ang: 0, col: 'rgba(255,255,255,0.7)' }); // Carrier vector stationary up
        vectors.push({ r: R * m / 2, ang: theta, col: '#ff006e' });             // USB rotates CW
        vectors.push({ r: R * m / 2, ang: -theta, col: '#ff006e' });             // LSB rotates CCW
    } else if (mode === 'dsb-sc') {
        // Carrier suppressed. Center at origin.
        vectors.push({ r: R * m / 2, ang: theta, col: '#ff006e' });
        vectors.push({ r: R * m / 2, ang: -theta, col: '#ff006e' });
    } else if (mode === 'ssb') {
        vectors.push({ r: R, ang: theta, col: '#4facfe' });
    } else if (mode === 'vsb') {
        vectors.push({ r: R, ang: theta, col: '#4facfe' });
        vectors.push({ r: R * 0.25, ang: -theta, col: '#ff006e' });
    }

    // Chain processing & draw
    vectors.forEach(v => {
        // In canvas, Up is -Y direction. Relative to locking carrier at Up (angle = -PI/2)
        const absoluteAng = (-Math.PI / 2) + v.ang;
        const dx = v.r * Math.cos(absoluteAng);
        const dy = v.r * Math.sin(absoluteAng);

        const nextX = vX + dx;
        const nextY = vY + dy;

        drawArrow(ctxP, vX, vY, nextX, nextY, v.col, 2);

        vX = nextX;
        vY = nextY;
    });

    // Draw FINAL Resultant Vector (Glow Cyan)
    ctxP.shadowBlur = 10; ctxP.shadowColor = '#00f2fe';
    drawArrow(ctxP, cx, cy, vX, vY, '#00f2fe', 3);
    ctxP.shadowBlur = 0;
}

function drawPower(w, h, m, mode) {
    const scale = window.devicePixelRatio || 1;
    ctxPwr.fillStyle = '#08090d';
    ctxPwr.fillRect(0, 0, w, h);

    const BASE_P = 0.5;
    let pc = 0, psb = 0, ptot = 0, eff = 0;
    if (mode === 'dsb-fc') {
        pc = BASE_P; psb = (m * m / 2) * BASE_P;
        ptot = pc + psb; eff = ptot > 0 ? (psb / ptot) * 100 : 0;
    } else if (mode === 'dsb-sc') {
        psb = (m * m / 2) * BASE_P; ptot = psb; eff = 100;
    } else if (mode === 'ssb') {
        psb = BASE_P; ptot = psb; eff = 100;
    } else if (mode === 'vsb') {
        psb = BASE_P + BASE_P * 0.0625; ptot = psb; eff = 100;
    }

    const cx = w / 2, cy = h / 2;
    ctxPwr.textAlign = 'center'; ctxPwr.textBaseline = 'middle';
    ctxPwr.fillStyle = 'rgba(255,255,255,0.3)'; ctxPwr.font = `bold ${10 * scale}px sans-serif`;
    ctxPwr.fillText("TRANSMISSION EFFICIENCY (η)", cx, cy - (35 * scale));

    const effColor = `rgba(${Math.floor(255 * (1 - eff / 100))}, ${Math.floor(150 + 105 * (eff / 100))}, 254, 1)`;
    ctxPwr.font = `bold ${32 * scale}px monospace`;
    ctxPwr.shadowBlur = 15; ctxPwr.shadowColor = effColor; ctxPwr.fillStyle = effColor;
    ctxPwr.fillText(eff.toFixed(1) + "%", cx, cy - (5 * scale)); ctxPwr.shadowBlur = 0;

    const barW = Math.min(w * 0.8, 350 * scale), barH = 18 * scale;
    const bx = cx - (barW / 2), by = cy + (30 * scale);
    ctxPwr.fillStyle = 'rgba(255,255,255,0.05)'; ctxPwr.fillRect(bx, by, barW, barH);
    const r = ptot > 0 ? (pc / ptot) : 0;
    const cW = barW * r, sW = barW - cW;
    if (cW > 0) { ctxPwr.fillStyle = 'rgba(255,255,255,0.3)'; ctxPwr.fillRect(bx, by, cW, barH); }
    if (sW > 0) { ctxPwr.fillStyle = '#00f2fe'; ctxPwr.fillRect(bx + cW, by, sW, barH); }

    ctxPwr.font = `${9 * scale}px sans-serif`; ctxPwr.fillStyle = 'rgba(255,255,255,0.5)';
    ctxPwr.textAlign = 'left'; ctxPwr.fillText(`Carrier: ${pc.toFixed(3)}W`, bx, by + barH + (12 * scale));
    ctxPwr.textAlign = 'right'; ctxPwr.fillText(`SB: ${psb.toFixed(3)}W`, bx + barW, by + barH + (12 * scale));
}

function animate(ts) {
    timePhase += 0.001;
    const fm = parseFloat(elements.modulatorFreq.value);
    phasorTime += 0.01 * Math.min(fm, 10);

    const fc = parseFloat(elements.carrierFreq.value);
    const m = parseFloat(elements.modIndex.value);
    const mix = parseFloat(elements.dryWet.value);
    const mode = getMode();

    const wT = canvasT.clientWidth, hT = canvasT.clientHeight;
    const wF = canvasF.clientWidth, hF = canvasF.clientHeight;
    const wP = canvasP.clientWidth, hP = canvasP.clientHeight;
    const wPwr = canvasPwr.clientWidth, hPwr = canvasPwr.clientHeight;

    drawTime(wT, hT, fc, fm, m, mix, mode);
    drawFreq(wF, hF, fc, fm, m, mode);
    drawPhasor(wP, hP, fc, fm, m, mode);
    drawPower(wPwr, hPwr, m, mode);

    requestAnimationFrame(animate);
}

// Initiate Main Loop
requestAnimationFrame(animate);
updateUI();

// --- Hardware Lab Interactive Logic ---
window.switchCircuit = function (type) {
    // 1. Update button highlight
    const btns = document.querySelectorAll('.lab-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    // Match btn text or implement simple finding logic
    // Simpler: just target current event src or standard select
    const targetBtn = Array.from(btns).find(b => b.getAttribute('onclick').includes(type));
    if (targetBtn) targetBtn.classList.add('active');

    // 2. Toggle actual content display slots
    const slots = document.querySelectorAll('.circuit-slot');
    slots.forEach(slot => slot.classList.remove('active'));

    const targetSlot = document.getElementById('circ-' + type);
    if (targetSlot) targetSlot.classList.add('active');
};


