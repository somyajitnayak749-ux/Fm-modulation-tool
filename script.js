// Math/Utility Functions
function besselJ(n, x) {
    if (n < 0) return (n % 2 === 0 ? 1 : -1) * besselJ(-n, x);
    let sum = 0, m = 0;
    while (m < 30) {
        let num = Math.pow(-1, m) * Math.pow(x / 2, 2 * m + n);
        let den = factorial(m) * factorial(m + n);
        let term = num / den;
        sum += term;
        if (Math.abs(term) < 1e-10 && m > n) break;
        m++;
    }
    return sum;
}

function factorial(num) {
    if (num <= 1) return 1;
    let fact = 1;
    for (let i = 2; i <= num; i++) fact *= i;
    return fact;
}

function randomGaussian() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

function fft(real, imag) {
    const n = real.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
        if (i < j) {
            let tr = real[i], ti = imag[i];
            real[i] = real[j]; imag[i] = imag[j];
            real[j] = tr; imag[j] = ti;
        }
        let k = n / 2;
        while (k <= j) { j -= k; k /= 2; }
        j += k;
    }
    for (let l = 2; l <= n; l *= 2) {
        let angle = -2 * Math.PI / l;
        let wTreal = Math.cos(angle), wTimag = Math.sin(angle);
        for (let i = 0; i < n; i += l) {
            let wReal = 1, wImag = 0;
            for (let j = 0; j < l / 2; j++) {
                let tr = wReal * real[i + j + l / 2] - wImag * imag[i + j + l / 2];
                let ti = wReal * imag[i + j + l / 2] + wImag * real[i + j + l / 2];
                real[i + j + l / 2] = real[i + j] - tr;
                imag[i + j + l / 2] = imag[i + j] - ti;
                real[i + j] += tr;
                imag[i + j] += ti;
                let nextWReal = wReal * wTreal - wImag * wTimag;
                let nextWImag = wReal * wTimag + wImag * wTreal;
                wReal = nextWReal;
                wImag = nextWImag;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Sync UI elements
    function syncInput(sliderId, numberId) {
        const slider = document.getElementById(sliderId);
        const num = document.getElementById(numberId);
        slider.addEventListener('input', () => { num.value = slider.value; updateAll(); });
        num.addEventListener('input', () => { slider.value = num.value; updateAll(); });
    }
    syncInput('fc-slider', 'fc-number');
    syncInput('fm-slider', 'fm-number');
    syncInput('fm2-slider', 'fm2-number');
    syncInput('dev-slider', 'dev-number');
    syncInput('noise-slider', 'noise-number');
    syncInput('theta-slider', 'theta-number');

    let isBetaDriving = false;
    const betaSlider = document.getElementById('beta-slider');
    const betaNum = document.getElementById('beta-in-number');
    const devSlider = document.getElementById('dev-slider');
    const devNum = document.getElementById('dev-number');

    function handleBetaChange() {
        isBetaDriving = true;
        betaNum.value = betaSlider.value;
        let fm1 = getVal('fm-number'), fm2 = getVal('fm2-number');
        let maxFm = isMulti ? Math.max(fm1, fm2) : fm1;
        if(maxFm === 0) maxFm = 1;
        let newBeta = parseFloat(betaSlider.value);
        let newDev = newBeta * maxFm;
        devSlider.value = newDev.toFixed(0);
        devNum.value = newDev.toFixed(0);
        updateAll();
        isBetaDriving = false;
    }
    betaSlider.addEventListener('input', handleBetaChange);

    function handleBetaNumChange() {
        isBetaDriving = true;
        betaSlider.value = betaNum.value;
        let fm1 = getVal('fm-number'), fm2 = getVal('fm2-number');
        let maxFm = isMulti ? Math.max(fm1, fm2) : fm1;
        if(maxFm === 0) maxFm = 1;
        let newBeta = parseFloat(betaNum.value);
        let newDev = newBeta * maxFm;
        devSlider.value = newDev.toFixed(0);
        devNum.value = newDev.toFixed(0);
        updateAll();
        isBetaDriving = false;
    }
    betaNum.addEventListener('input', handleBetaNumChange);

    function getVal(id) { return parseFloat(document.getElementById(id).value) || 0; }

    // State Variables
    let currentMode = 'WBFM';
    let waveType = 'sine';
    let isMulti = false;
    let liveTimeOffset = 0;
    let currentWindowDuration = 0.05;
    let oscilloscopeAnimationId = null;
    
    // Audio Engine variables must be declared before they are used in animateOscilloscope
    let audioCtx = null, carrierOsc = null, modOsc1 = null, modOsc2 = null, modGain = null, mainGain = null;
    let isPlaying = false;
    const audioBtn = document.getElementById('audio-btn');

    function animateOscilloscope() {
        if (!isPlaying || (currentDomain !== 'time' && currentDomain !== 'all')) {
            oscilloscopeAnimationId = requestAnimationFrame(animateOscilloscope);
            return;
        }
        
        liveTimeOffset += 0.003; 
        if (liveTimeOffset > 0.8) {
            liveTimeOffset = 0; 
        }
        
        let startMs = liveTimeOffset * 1000;
        let endMs = (liveTimeOffset + currentWindowDuration) * 1000;
        
        if (document.getElementById('plot-modulating').data) {
            Plotly.relayout('plot-modulating', {'xaxis.range': [startMs, endMs]});
            Plotly.relayout('plot-carrier', {'xaxis.range': [startMs, endMs]});
            Plotly.relayout('plot-fm', {'xaxis.range': [startMs, endMs]});
        }
        
        oscilloscopeAnimationId = requestAnimationFrame(animateOscilloscope);
    }
    
    if (!oscilloscopeAnimationId) animateOscilloscope();

    // Mode Selection Buttons
    document.getElementById('mode-grid').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#mode-grid .neon-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentMode = e.target.getAttribute('data-mode');
            
            if (currentMode === 'NBFM') {
                document.getElementById('eq-wbfm').style.display = 'none';
                document.getElementById('eq-nbfm').style.display = 'block';
            } else {
                document.getElementById('eq-nbfm').style.display = 'none';
                document.getElementById('eq-wbfm').style.display = 'block';
            }
            
            updateAll();
        }
    });

    document.getElementById('wave-grid').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            if (e.target.id === 'btn-multi') {
                isMulti = !isMulti;
                if (isMulti) {
                    e.target.classList.add('active');
                    document.getElementById('fm2-wrapper').style.display = 'block';
                } else {
                    e.target.classList.remove('active');
                    document.getElementById('fm2-wrapper').style.display = 'none';
                }
            } else {
                document.querySelectorAll('#wave-grid .neon-btn:not(#btn-multi)').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                waveType = e.target.getAttribute('data-wave');
            }
            updateAudioEngineParams();
            updateAll();
        }
    });

    let currentDomain = 'all';

    document.getElementById('domain-grid').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#domain-grid .neon-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentDomain = e.target.getAttribute('data-domain');
            
            const vt = document.getElementById('view-time');
            const vf = document.getElementById('view-freq');
            const vp = document.getElementById('view-phasor');
            const vb = document.getElementById('view-bessel');

            vt.style.display = 'none';
            vf.style.display = 'none';
            vp.style.display = 'none';
            vb.style.display = 'none';

            if (currentDomain === 'all') {
                vt.style.display = 'flex';
                vf.style.display = 'flex';
            } else if (currentDomain === 'time') {
                vt.style.display = 'flex';
            } else if (currentDomain === 'freq') {
                vf.style.display = 'flex';
            } else if (currentDomain === 'phasor') {
                vp.style.display = 'flex';
            } else if (currentDomain === 'bessel') {
                vb.style.display = 'flex';
            }

            if (currentDomain === 'phasor') {
                document.getElementById('phasor-angle-container').style.display = 'block';
            } else {
                document.getElementById('phasor-angle-container').style.display = 'none';
            }

            window.dispatchEvent(new Event('resize'));
            updateAll();
        }
    });

    // Audio Engine Functions
    function updateAudioEngineParams() {
        if (!isPlaying || !audioCtx) return;
        const fc = getVal('fc-number'), fm1 = getVal('fm-number'), fm2 = getVal('fm2-number'), deltaF = getVal('dev-number');
        let oscType = waveType === 'square' ? 'square' : (waveType === 'triangle' ? 'triangle' : 'sine');

        carrierOsc.frequency.setValueAtTime(fc, audioCtx.currentTime);
        modOsc1.frequency.setValueAtTime(fm1, audioCtx.currentTime);
        modOsc1.type = oscType;
        
        if (isMulti) {
            if (!modOsc2) {
                modOsc2 = audioCtx.createOscillator();
                modOsc2.connect(modGain);
                modOsc2.start();
            }
            modOsc2.frequency.setValueAtTime(fm2, audioCtx.currentTime);
            modOsc2.type = oscType;
            modGain.gain.setValueAtTime(deltaF / 2, audioCtx.currentTime); 
        } else {
            if (modOsc2) { modOsc2.stop(); modOsc2.disconnect(); modOsc2 = null; }
            modGain.gain.setValueAtTime(deltaF, audioCtx.currentTime);
        }
    }

    audioBtn.addEventListener('click', () => {
        if (!isPlaying) {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if(audioCtx.state === 'suspended') audioCtx.resume();
            carrierOsc = audioCtx.createOscillator();
            modOsc1 = audioCtx.createOscillator();
            modGain = audioCtx.createGain();
            mainGain = audioCtx.createGain();
            mainGain.gain.value = 0.2; 

            modOsc1.connect(modGain);
            modGain.connect(carrierOsc.frequency);
            carrierOsc.connect(mainGain);
            mainGain.connect(audioCtx.destination);

            modOsc1.start();
            carrierOsc.start();

            isPlaying = true;
            updateAudioEngineParams();
            audioBtn.innerHTML = '<i class="ph ph-stop"></i> Stop Engine';
            audioBtn.classList.add('playing');
        } else {
            if (carrierOsc) carrierOsc.stop();
            if (modOsc1) modOsc1.stop();
            if (modOsc2) { modOsc2.stop(); modOsc2 = null; }
            isPlaying = false;
            audioBtn.innerHTML = '<i class="ph ph-play"></i> Start Engine';
            audioBtn.classList.remove('playing');
        }
    });

    // Main Update
    function updateAll() {
        const fc = getVal('fc-number');
        let fm1 = getVal('fm-number'), fm2 = getVal('fm2-number'), deltaF = getVal('dev-number');
        const noiseLevel = getVal('noise-number') / 100;
        let maxFm = isMulti ? Math.max(fm1, fm2) : fm1;

        if (currentMode === 'NBFM' && maxFm > 0 && deltaF / maxFm >= 0.3) {
            deltaF = maxFm * 0.25;
            document.getElementById('dev-number').value = deltaF.toFixed(1);
            document.getElementById('dev-slider').value = deltaF.toFixed(1);
        }

        const beta = maxFm > 0 ? deltaF / maxFm : 0;
        const bw = currentMode === 'NBFM' ? 2 * maxFm : 2 * (deltaF + maxFm);

        if (!isBetaDriving) {
            document.getElementById('beta-slider').value = beta.toFixed(2);
            document.getElementById('beta-in-number').value = beta.toFixed(2);
        }

        // Update UI
        document.getElementById('live-beta').textContent = beta.toFixed(2);
        document.getElementById('live-bw').textContent = (currentMode === 'NBFM' ? 2 * maxFm : 2 * (deltaF + maxFm)).toFixed(1) + ' Hz';
        document.getElementById('live-type').textContent = currentMode;

        // Update Power Analytics
        let pt, pc, psb, eta;
        if (currentMode === 'WBFM') {
            // True WBFM: Constant power
            let j0 = besselJ(0, beta);
            pt = 1.000; // Normalized to 1 Watt
            pc = j0 * j0;
            psb = pt - pc;
            eta = (psb / pt) * 100;
        } else {
            // NBFM Approximation: Power increases
            pt = 1.0 + (beta * beta) / 2.0;
            pc = 1.0; // Carrier unattenuated
            psb = (beta * beta) / 2.0;
            eta = (psb / pt) * 100;
        }

        document.getElementById('card-pt').textContent = pt.toFixed(3) + ' W';
        document.getElementById('card-pc').textContent = pc.toFixed(3) + ' W';
        document.getElementById('card-psb').textContent = psb.toFixed(3) + ' W';
        document.getElementById('card-eta').textContent = eta.toFixed(1) + '%';

        document.getElementById('card-fmax').textContent = (fc + deltaF).toFixed(2) + ' Hz';
        document.getElementById('card-fmin').textContent = Math.max(0, fc - deltaF).toFixed(2) + ' Hz';
        document.getElementById('card-beta').textContent = beta.toFixed(2);
        document.getElementById('card-bw').textContent = Math.round(bw) + ' Hz';

        updateAudioEngineParams();

        const sigs = generateSignals(fc, fm1, fm2, deltaF, waveType, isMulti, noiseLevel);
        let minFm = isMulti && fm2 > 0 ? Math.min(fm1, fm2) : fm1;
        currentWindowDuration = minFm > 0 ? Math.min(3 / minFm, 0.5) : 0.05;
        
        if (currentDomain === 'time' || currentDomain === 'all') {
            plotTimeDomain(sigs.time, sigs.msg, sigs.car, sigs.fm, noiseLevel, currentWindowDuration);
        }
        if (currentDomain === 'freq' || currentDomain === 'all') {
            plotFreqDomain(fc, fm1, fm2, deltaF, beta, waveType, isMulti, sigs.fm, sigs.Fs);
        }
        if (currentDomain === 'phasor') {
            plotPhasorDomain(sigs.phases, beta);
        }
        if (currentDomain === 'bessel') {
            plotBesselDomain(beta);
        }
    }

    function generateSignals(fc, fm1, fm2, deltaF, waveType, isMulti, noiseLevel) {
        const time = [], msg = [], car = [], fm = [], phases = [];
        const Fs = Math.max(fc * 20, 4096); 
        const duration = 1.0; 
        
        let phase = 0; const dt = 1 / Fs;

        for (let t = 0; t <= duration; t += dt) {
            time.push(t * 1000); 
            let mVal = 0;
            if (waveType === 'sine') {
                mVal = Math.cos(2 * Math.PI * fm1 * t);
                if (isMulti) mVal = (mVal + Math.cos(2 * Math.PI * fm2 * t)) / 2;
            } else if (waveType === 'square') {
                mVal = Math.sign(Math.sin(2 * Math.PI * fm1 * t));
                if (isMulti) mVal = (mVal + Math.sign(Math.sin(2 * Math.PI * fm2 * t))) / 2;
            } else if (waveType === 'triangle') {
                mVal = 2 * Math.abs(2 * (t * fm1 - Math.floor(t * fm1 + 0.5))) - 1;
                if (isMulti) mVal = (mVal + (2 * Math.abs(2 * (t * fm2 - Math.floor(t * fm2 + 0.5))) - 1)) / 2;
            }

            const cVal = Math.cos(2 * Math.PI * fc * t);
            phase += 2 * Math.PI * deltaF * mVal * dt;
            let fVal = Math.cos(2 * Math.PI * fc * t + phase) + randomGaussian() * noiseLevel;

            msg.push(mVal); car.push(cVal); fm.push(fVal); phases.push(phase);
        }
        return { time, msg, car, fm, phases, Fs };
    }

    function plotTimeDomain(time, msgSignal, carrierSignal, fmSignal, noiseLevel, windowDuration) {
        let startMs = liveTimeOffset * 1000;
        let endMs = (liveTimeOffset + windowDuration) * 1000;
        const darkLayout = {
            plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
            font: { color: '#94a3b8' },
            xaxis: { title: 'Time (ms)', range: [startMs, endMs], gridcolor: '#2d3748', zerolinecolor: '#475569' },
            yaxis: { title: 'Amplitude', range: [-1.5, 1.5], gridcolor: '#2d3748', zerolinecolor: '#475569' },
            margin: { l: 40, r: 20, t: 20, b: 30 }
        };

        Plotly.react('plot-modulating', [{
            x: time, y: msgSignal, mode: 'lines', name: 'Message', line: {color: '#e11d48'}
        }], Object.assign({title: {text: 'MODULATING SIGNAL m(t)', font: {size: 12, color: '#e2e8f0'}}}, darkLayout), {responsive: true});

        Plotly.react('plot-carrier', [{
            x: time, y: carrierSignal, mode: 'lines', name: 'Carrier', line: {color: '#94a3b8'}
        }], Object.assign({title: {text: 'CARRIER SIGNAL c(t)', font: {size: 12, color: '#e2e8f0'}}}, darkLayout), {responsive: true});

        const layoutFM = Object.assign({title: {text: 'FM SIGNAL s(t)', font: {size: 12, color: '#e2e8f0'}}}, darkLayout);
        layoutFM.yaxis = { title: 'Amplitude', range: [-1.5 - noiseLevel, 1.5 + noiseLevel], gridcolor: '#2d3748', zerolinecolor: '#475569' };
        Plotly.react('plot-fm', [{
            x: time, y: fmSignal, mode: 'lines', name: 'FM Signal', line: {color: '#00e5ff', width: 2}
        }], layoutFM, {responsive: true});
    }

    function plotFreqDomain(fc, fm1, fm2, deltaF, beta, waveType, isMulti, fmSignal, Fs) {
        const darkLayout = {
            plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
            font: { color: '#94a3b8' },
            xaxis: { title: 'Frequency (Hz)', gridcolor: '#2d3748', zerolinecolor: '#475569' },
            yaxis: { title: 'Magnitude', range: [0, 1], gridcolor: '#2d3748', zerolinecolor: '#475569' },
            margin: { l: 40, r: 20, t: 20, b: 30 },
            title: {text: 'FREQUENCY DOMAIN SPECTRUM', font: {size: 12, color: '#e2e8f0'}}
        };

        if (waveType === 'sine' && !isMulti && fm1 > 0) {
            const freqs = [], amplitudes = [];
            const n_sidebands = currentMode === 'NBFM' ? 1 : Math.floor(beta) + 5; 
            for (let n = -n_sidebands; n <= n_sidebands; n++) {
                let f = fc + n * fm1;
                if (f > 0) { freqs.push(f); amplitudes.push(Math.abs(besselJ(n, beta))); }
            }
            Plotly.react('plot-freq', [{
                x: freqs, y: amplitudes, type: 'bar', marker: { color: '#00e5ff' }, width: Array(freqs.length).fill(Math.max(fm1 * 0.2, 5))
            }], darkLayout, {responsive: true});
        } else {
            let N = 1; while(N < fmSignal.length) N *= 2; N /= 2; if(N > 8192) N = 8192;
            if (N >= 256) {
                let real = new Float32Array(N), imag = new Float32Array(N);
                for(let i=0; i<N; i++) real[i] = fmSignal[i];
                fft(real, imag);
                let freqs = [], mags = [];
                for(let i=0; i<N/2; i++) {
                    let f = i * Fs / N;
                    let mag = Math.sqrt(real[i]*real[i] + imag[i]*imag[i]) / N;
                    if(i > 0) mag *= 2; 
                    freqs.push(f); mags.push(mag);
                }
                let viewRange = Math.max(deltaF * 4, (isMulti ? Math.max(fm1,fm2) : fm1) * 10);
                if (viewRange < 100) viewRange = 100;
                
                darkLayout.xaxis.range = [Math.max(0, fc - viewRange), fc + viewRange];
                darkLayout.yaxis.range = [0, 1.2];
                Plotly.react('plot-freq', [{
                    x: freqs, y: mags, type: 'line', line: { color: '#00e5ff', width: 2 }
                }], darkLayout, {responsive: true});
            }
        }
    }

    function plotPhasorDomain(phases, beta) {
        let thetaDeg = getVal('theta-number');
        let theta = thetaDeg * (Math.PI / 180);
        
        let cX = 1, cY = 0;
        let usbX = cX + (beta/2) * Math.cos(theta);
        let usbY = cY + (beta/2) * Math.sin(theta);
        let lsbX = usbX - (beta/2) * Math.cos(theta);
        let lsbY = usbY + (beta/2) * Math.sin(theta);
        let sbSumX = 1;
        let sbSumY = beta * Math.sin(theta);
        let wbfmX = Math.cos(beta * Math.sin(theta));
        let wbfmY = Math.sin(beta * Math.sin(theta));

        let updateX = [[cX, usbX], [usbX, lsbX], [cX, sbSumX], [0, sbSumX], [0, wbfmX]];
        let updateY = [[cY, usbY], [usbY, lsbY], [cY, sbSumY], [0, sbSumY], [0, wbfmY]];

        let thetas = [];
        for(let t=0; t<=Math.PI*2; t+=0.05) thetas.push(t);
        let arcWbfmX = thetas.map(th => Math.cos(beta * Math.sin(th)));
        let arcWbfmY = thetas.map(th => Math.sin(beta * Math.sin(th)));
        let arcNbfmX = thetas.map(th => 1);
        let arcNbfmY = thetas.map(th => beta * Math.sin(th));

        let annotations = [
            { ax: 0, ay: 0, x: cX, y: cY, xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 2, arrowsize: 0.8, arrowwidth: 3, arrowcolor: '#94a3b8' },
            { ax: cX, ay: cY, x: usbX, y: usbY, xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 2, arrowsize: 0.8, arrowwidth: 2, arrowcolor: '#36b37e' },
            { ax: usbX, ay: usbY, x: lsbX, y: lsbY, xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 2, arrowsize: 0.8, arrowwidth: 2, arrowcolor: '#ff991f' },
            { ax: cX, ay: cY, x: sbSumX, y: sbSumY, xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 2, arrowsize: 0.8, arrowwidth: 3, arrowcolor: '#a855f7' },
            { ax: 0, ay: 0, x: sbSumX, y: sbSumY, xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 2, arrowsize: 0.8, arrowwidth: 4, arrowcolor: '#e11d48' },
            { ax: 0, ay: 0, x: wbfmX, y: wbfmY, xref: 'x', yref: 'y', axref: 'x', ayref: 'y', showarrow: true, arrowhead: 2, arrowsize: 0.8, arrowwidth: 4, arrowcolor: '#00e5ff' }
        ];

        if (document.getElementById('plot-phasor').data) {
            Plotly.restyle('plot-phasor', {
                x: [arcWbfmX, arcNbfmX, [0,1], updateX[0], updateX[1], updateX[2], updateX[3], updateX[4]],
                y: [arcWbfmY, arcNbfmY, [0,0], updateY[0], updateY[1], updateY[2], updateY[3], updateY[4]]
            }, [0, 1, 2, 3, 4, 5, 6, 7]);
            
            Plotly.relayout('plot-phasor', { annotations: annotations });
            return;
        }

        const darkLayout = {
            plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
            font: { color: '#94a3b8' },
            xaxis: { title: 'In-Phase (I)', gridcolor: '#2d3748', zerolinecolor: '#475569' },
            yaxis: { title: 'Quadrature (Q)', gridcolor: '#2d3748', zerolinecolor: '#475569', scaleanchor: 'x', scaleratio: 1 },
            margin: { l: 40, r: 20, t: 30, b: 30 },
            title: {text: 'PHASOR VECTOR ANALYSIS', font: {size: 12, color: '#e2e8f0'}},
            showlegend: true,
            legend: { x: 0, y: 1, font: {size: 10}, bgcolor: 'rgba(18, 19, 28, 0.8)' },
            annotations: annotations
        };

        let traces = [
            { x: arcWbfmX, y: arcWbfmY, mode: 'lines', line: {color: 'rgba(0, 229, 255, 0.2)', width: 2}, name: 'WBFM Arc', hoverinfo: 'none' },
            { x: arcNbfmX, y: arcNbfmY, mode: 'lines', line: {color: 'rgba(225, 29, 72, 0.2)', width: 2, dash: 'dot'}, name: 'NBFM Path', hoverinfo: 'none' },
            { x: [0, 1], y: [0, 0], mode: 'lines', line: {color: '#94a3b8', width: 3}, name: 'Carrier Vector' },
            { x: updateX[0], y: updateY[0], mode: 'lines', line: {color: '#36b37e', width: 2}, name: 'USB Vector' },
            { x: updateX[1], y: updateY[1], mode: 'lines', line: {color: '#ff991f', width: 2}, name: 'LSB Vector' },
            { x: updateX[2], y: updateY[2], mode: 'lines', line: {color: '#a855f7', width: 3, dash: 'dash'}, name: 'Sideband Sum' },
            { x: updateX[3], y: updateY[3], mode: 'lines', line: {color: '#e11d48', width: 4}, name: 'NBFM Resultant' },
            { x: updateX[4], y: updateY[4], mode: 'lines', line: {color: '#00e5ff', width: 4}, name: 'WBFM Resultant' }
        ];

        Plotly.newPlot('plot-phasor', traces, darkLayout, {responsive: true});
    }

    function plotBesselDomain(currentBeta) {
        const darkLayout = {
            plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
            font: { color: '#94a3b8' },
            xaxis: { title: 'Modulation Index (β)', range: [0, 15], gridcolor: '#2d3748', zerolinecolor: '#475569' },
            yaxis: { title: 'Amplitude Jn(β)', range: [-0.5, 1], gridcolor: '#2d3748', zerolinecolor: '#475569' },
            margin: { l: 40, r: 20, t: 30, b: 40 },
            title: {text: 'BESSEL FUNCTIONS OF THE FIRST KIND', font: {size: 12, color: '#e2e8f0'}},
            shapes: [{
                type: 'line',
                x0: currentBeta, y0: -0.5,
                x1: currentBeta, y1: 1,
                line: { color: '#00e5ff', width: 2, dash: 'dot' }
            }],
            annotations: [{
                x: currentBeta, y: 0.9,
                text: `Live β = ${currentBeta.toFixed(2)}`,
                showarrow: false,
                font: { color: '#00e5ff', size: 12 },
                xanchor: 'left', xshift: 5
            }]
        };

        const betaVals = [];
        for (let b = 0; b <= 15; b += 0.1) betaVals.push(b);

        const traces = [];
        const colors = ['#e11d48', '#3b82f6', '#36b37e', '#ff991f', '#94a3b8', '#a855f7'];
        
        for (let n = 0; n <= 5; n++) {
            const jVals = betaVals.map(b => besselJ(n, b));
            traces.push({
                x: betaVals, y: jVals, mode: 'lines',
                name: `J${n}(β)`, line: { color: colors[n], width: 2 }
            });
        }

        Plotly.react('plot-bessel', traces, darkLayout, {responsive: true});
    }

    updateAll();
});
