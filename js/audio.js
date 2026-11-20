/**
 * LineageAudio - 리니지 클래식 고유 사운드 효과 및 배경음악 합성 엔진
 * 외부 파일 없이 순수 Web Audio API로 리니지 특유의 타격음, 물약 소리, 인챈트 팡파레 등을 실시간 합성.
 */
class LineageAudio {
    constructor() {
        this.ctx = null;
        this.bgmGain = null;
        this.sfxGain = null;
        this.isMuted = false;
        this.bgmTimer = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(0.16, this.ctx.currentTime);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

            this.bgmGain.connect(this.ctx.destination);
            this.sfxGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.bgmGain && this.sfxGain) {
            const t = this.ctx.currentTime;
            this.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.16, t);
            this.sfxGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, t);
        }
        return this.isMuted;
    }

    // 1. 리니지 특유의 칼질 휘두르기 (슉- 쇳소리)
    playSwing() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    // 2. 리니지 둔탁하고 찰진 칼질 타격음 (챙! 퍽!)
    playHit() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;

        // 금속 타격 고음
        const oscM = this.ctx.createOscillator();
        const gainM = this.ctx.createGain();
        oscM.type = 'triangle';
        oscM.frequency.setValueAtTime(900, now);
        oscM.frequency.exponentialRampToValueAtTime(150, now + 0.09);
        gainM.gain.setValueAtTime(0.35, now);
        gainM.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        oscM.connect(gainM);
        gainM.connect(this.sfxGain);
        oscM.start(now);
        oscM.stop(now + 0.09);

        // 살점 타격 저음
        const oscB = this.ctx.createOscillator();
        const gainB = this.ctx.createGain();
        oscB.type = 'square';
        oscB.frequency.setValueAtTime(160, now);
        oscB.frequency.exponentialRampToValueAtTime(40, now + 0.11);
        gainB.gain.setValueAtTime(0.4, now);
        gainB.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
        oscB.connect(gainB);
        gainB.connect(this.sfxGain);
        oscB.start(now);
        oscB.stop(now + 0.11);
    }

    // 3. 리니지 빨간물약 복용음 (꿀꺽)
    playPotion() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(550, now + 0.08);
        osc.frequency.linearRampToValueAtTime(250, now + 0.16);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.18);
    }

    // 4. 초록물약/용기의물약 가속 효과음 (샤아악!)
    playHaste() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.28);
    }

    // 5. 순간이동/귀환 주문서 텔레포트음 (휘이잉 퐁!)
    playTeleport() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    // 6. 무기/갑옷 주문서(데이/젤) 인챈트 성공음 (띠리리링 맑은 성공 팡파레)
    playEnchantSuccess() {
        if (this.isMuted || !this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C E G C E
        notes.forEach((freq, idx) => {
            const now = this.ctx.currentTime + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(now);
            osc.stop(now + 0.2);
        });
    }

    // 7. 인챈트 실패/증발음 (콰과광 파괴음)
    playEnchantFail() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.35);
    }

    // 8. 데스나이트 변신음 (장엄한 종소리 + 변신음)
    playPolymorph() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(650, now + 0.3);
        osc.frequency.linearRampToValueAtTime(200, now + 0.6);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.6);
    }

    // 9. 아데나(골드) 획득음
    playCoin() {
        if (this.isMuted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, now); // C6
        osc.frequency.setValueAtTime(1567.98, now + 0.06); // G6

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.16);
    }

    // 10. 레벨업 팡파레
    playLevelUp() {
        if (this.isMuted || !this.ctx) return;
        const chords = [
            [440, 554, 659], // A
            [493, 622, 739], // B
            [587, 739, 880]  // D
        ];
        chords.forEach((chord, i) => {
            const startT = this.ctx.currentTime + i * 0.14;
            chord.forEach(freq => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startT);
                gain.gain.setValueAtTime(0.2, startT);
                gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.22);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(startT);
                osc.stop(startT + 0.22);
            });
        });
    }

    // --- 리니지 특유의 서정적이고 웅장한 테마 BGM (말하는 섬 / 글루딘 테마풍) ---
    startLineageBGM() {
        this.stopBGM();
        this.init();

        // 비장하고 중후한 D단조 리니지 스타일 루프
        const melody = [
            293.66, 0, 329.63, 349.23, 392.00, 0, 349.23, 329.63,
            293.66, 261.63, 293.66, 0, 349.23, 392.00, 440.00, 0,
            523.25, 0, 440.00, 392.00, 349.23, 0, 392.00, 440.00,
            293.66, 0, 261.63, 220.00, 246.94, 261.63, 293.66, 0
        ];
        const bass = [
            146.83, 146.83, 174.61, 174.61, 196.00, 196.00, 174.61, 146.83,
            130.81, 130.81, 146.83, 146.83, 174.61, 174.61, 220.00, 146.83
        ];

        let step = 0;
        const tempo = 180; // ms per step

        this.bgmTimer = setInterval(() => {
            if (this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;

            const mNote = melody[step % melody.length];
            if (mNote > 0) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(mNote, now);
                gain.gain.setValueAtTime(0.09, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + (tempo / 1000) * 0.9);
                osc.connect(gain);
                gain.connect(this.bgmGain);
                osc.start(now);
                osc.stop(now + (tempo / 1000) * 0.95);
            }

            if (step % 2 === 0) {
                const bNote = bass[(Math.floor(step / 2)) % bass.length];
                if (bNote > 0) {
                    const bOsc = this.ctx.createOscillator();
                    const bGain = this.ctx.createGain();
                    bOsc.type = 'sawtooth';
                    bOsc.frequency.setValueAtTime(bNote, now);
                    bGain.gain.setValueAtTime(0.1, now);
                    bGain.gain.exponentialRampToValueAtTime(0.001, now + (tempo * 2 / 1000) * 0.85);
                    bOsc.connect(bGain);
                    bGain.connect(this.bgmGain);
                    bOsc.start(now);
                    bOsc.stop(now + (tempo * 2 / 1000) * 0.9);
                }
            }

            step++;
        }, tempo);
    }

    stopBGM() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
}

window.lineageAudio = new LineageAudio();
