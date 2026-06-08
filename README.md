# Frequency Modulation (FM) Studio Toolbox

An interactive, presentation-ready web application designed for B.Tech ECE (MAKAUT) PCA-2 project presentations. The toolbox simulates Frequency Modulation (FM) using live mathematical generation, interactive UI controls, and real-time visualization of Signals, Spectra, Phasors, and Bessel Functions.

## 🚀 Features

- **Multi-Domain Visualization**: 
  - **Time Domain**: Live scrolling oscilloscope showing Modulating signal $m(t)$, Carrier signal $c(t)$, and Frequency Modulated signal $s(t)$.
  - **Frequency Domain**: Real-time Fast Fourier Transform (FFT) spectrum tracking Carson's Bandwidth and Bessel harmonic amplitudes.
  - **Phasor Domain**: Dynamic vector diagram mapping the Carrier, Upper Sideband (USB), Lower Sideband (LSB), and resulting frequency vectors.
  - **Bessel Domain**: Interactive plot of Bessel Functions of the First Kind ($J_n(\beta)$).
- **Dual Engine Modes**:
  - **WBFM Mode**: Wideband FM simulation using exact Bessel distribution (Constant Power).
  - **NBFM Mode**: Narrowband FM approximation demonstrating power discrepancies.
- **Audio Synthesis Engine**: Built-in Web Audio API engine plays the simulated FM carrier tone live.
- **Live Power & Efficiency Analytics**: Automatically calculates $P_t$, $P_c$, $P_{sb}$, and transmission efficiency $\eta$ based on theoretical models.
- **Advanced Modulators**: Supports Sine, Square, Triangle, and Multi-Tone wave modulation.

## 📁 Files Included

To run this project, ensure all three of these files are in the same directory:

1. `index.html`: The core HTML dashboard structure.
2. `styles.css`: Dark Mode Studio styling with neon accents.
3. `script.js`: The math, UI synchronization, audio engine, and Plotly.js visualization logic.

## 🛠️ Usage

1. **Upload to GitHub**: Upload `index.html`, `styles.css`, and `script.js` to a GitHub repository.
2. **Run Locally**: Simply double-click `index.html` to open it in any modern web browser. No server is required.
3. **GitHub Pages (Optional)**: If you enable GitHub Pages in your repository settings, the tool will be hosted live on the internet!

## 🎓 Academic Integrations

This project mathematically adheres to university-level communication theory:
- Implements exact numerical generation without relying on external DSP libraries.
- Features interactive LaTeX formulas for real-time theoretical validation during presentations.
- Evaluates $J_n(\beta)$ mathematically to predict WBFM harmonic distribution.

## Dependencies
- [Plotly.js](https://plotly.com/javascript/) for mathematical plotting.
- [MathJax](https://www.mathjax.org/) for LaTeX rendering.
- [Phosphor Icons](https://phosphoricons.com/) for UI icons.
