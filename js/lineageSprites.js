/**
 * LineageSprites - 리니지 1 클래식 도트 그래픽 및 아이콘 렌더러
 * 기사(Knight), 52레벨 데스나이트(Death Knight), 오크, 셀로브, 허수아비, 상징적 아이템 아이콘 구현
 */
class LineageSprites {
    constructor() {
        this.cache = {};
        this.animTimer = 0;
        this.frame = 0;
        this.initAllSprites();
    }

    update(dt) {
        this.animTimer += dt;
        if (this.animTimer >= 0.16) {
            this.animTimer = 0;
            this.frame = (this.frame + 1) % 4;
        }
    }

    createPixelCanvas(width, height, matrix, palette, scale = 2) {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const char = matrix[y] ? matrix[y][x] : ' ';
                if (char && char !== ' ' && char !== '.') {
                    ctx.fillStyle = palette[char] || '#ffffff';
                    ctx.fillRect(x * scale, y * scale, scale, scale);
                }
            }
        }
        return canvas;
    }

    initAllSprites() {
        // --- 1. 클래식 기사 (Knight) ---
        // A: 은빛 강철, D: 짙은 쇠, S: 살구색 피부, R: 붉은 망토, W: 칼날, G: 손잡이 금
        const knightPal = {
            'A': '#cbd5e1', 'D': '#475569', 'S': '#fed7aa', 'R': '#b91c1c',
            'W': '#ffffff', 'G': '#eab308', 'E': '#0f172a', 'B': '#1e3a8a'
        };

        const knightWalk1 = [
            "..RRR...",
            ".DAAADD.",
            "..SESE..",
            ".RAAAAR.",
            "RRAAAARR",
            "R.BAAW.R",
            "..BAAW..",
            "..DDDD..",
            "..A..A..",
            "..D..D.."
        ];

        const knightWalk2 = [
            "..RRR...",
            ".DAAADD.",
            "..SESE..",
            ".RAAAAR.",
            "RRAAAARR",
            "..BAAW..",
            "..BAAW..",
            "..DDDD..",
            ".A....A.",
            ".D....D."
        ];

        const knightAttack = [
            "..RRR...",
            ".DAAADD.",
            "..SESE..",
            ".RAAAAR.",
            "RRAAAARR",
            "..BAA...",
            ".WBAA...",
            "W.DDDD..",
            "..A..A..",
            "..D..D.."
        ];

        this.cache['knight_walk'] = [
            this.createPixelCanvas(8, 10, knightWalk1, knightPal, 3),
            this.createPixelCanvas(8, 10, knightWalk2, knightPal, 3),
            this.createPixelCanvas(8, 10, knightWalk1, knightPal, 3),
            this.createPixelCanvas(8, 10, knightWalk2, knightPal, 3)
        ];
        this.cache['knight_attack'] = [
            this.createPixelCanvas(8, 10, knightAttack, knightPal, 3),
            this.createPixelCanvas(8, 10, knightWalk1, knightPal, 3)
        ];

        // --- 2. 전설의 52레벨 데스나이트 (Death Knight) ---
        // B: 칠흑 갑옷, K: 해골 뼈, E: 붉은 안광, F: 타오르는 불꽃검, O: 주황불꽃, Y: 노랑불꽃
        const dkPal = {
            'B': '#18181b', 'D': '#27272a', 'K': '#e4e4e7', 'E': '#ef4444',
            'F': '#ea580c', 'O': '#f97316', 'Y': '#fde047', 'S': '#3f3f46'
        };

        const dkWalk1 = [
            "..KKK...",
            ".KEEEK..",
            "..KKK...",
            ".BBBBBB.",
            "BBBBBBBB",
            "B.BBBF.B",
            "..BBBO..",
            "..DDDD..",
            "..B..B..",
            "..D..D.."
        ];

        const dkWalk2 = [
            "..KKK...",
            ".KEEEK..",
            "..KKK...",
            ".BBBBBB.",
            "BBBBBBBB",
            "..BBBF..",
            "..BBBO..",
            "..DDDD..",
            ".B....B.",
            ".D....D."
        ];

        const dkAttack = [
            "..KKK...",
            ".KEEEK..",
            "..KKK...",
            ".BBBBBB.",
            "BBBBBBBB",
            ".FBBBB..",
            "OFBBBB..",
            "..DDDD..",
            "..B..B..",
            "..D..D.."
        ];

        this.cache['deathknight_walk'] = [
            this.createPixelCanvas(8, 10, dkWalk1, dkPal, 3.2),
            this.createPixelCanvas(8, 10, dkWalk2, dkPal, 3.2)
        ];
        this.cache['deathknight_attack'] = [
            this.createPixelCanvas(8, 10, dkAttack, dkPal, 3.2),
            this.createPixelCanvas(8, 10, dkWalk1, dkPal, 3.2)
        ];

        // --- 3. 리니지 상징: 허수아비 (Dummy) ---
        const dummyPal = {
            'W': '#854d0e', 'Y': '#ca8a04', 'L': '#fef08a', 'R': '#b91c1c', 'D': '#3f2c1d'
        };
        const dummyMatrix = [
            "...YY...",
            "..YYYY..",
            "...RR...",
            "W.YYYY.W",
            "WWYYYYWW",
            "..YYYY..",
            "...WW...",
            "...WW...",
            "...WW...",
            "..DDDD.."
        ];
        this.cache['dummy'] = [
            this.createPixelCanvas(8, 10, dummyMatrix, dummyPal, 3)
        ];

        // --- 4. 몬스터: 오크 (Orc) ---
        const orcPal = {
            'G': '#15803d', 'D': '#14532d', 'R': '#ef4444', 'E': '#fde047', 'A': '#78350f', 'W': '#e2e8f0'
        };
        const orcM1 = [
            "..RRR...",
            ".GGGGGG.",
            "..GEEGD.",
            "A.GGGG.A",
            "AAGGGGAW",
            "..AAAA..",
            "..GG.GG.",
            "..DD.DD."
        ];
        const orcM2 = [
            "..RRR...",
            ".GGGGGG.",
            "..GEEGD.",
            ".AGGGGAW",
            "..AAAA.A",
            "..AAAA..",
            ".G...G..",
            ".D...D.."
        ];
        this.cache['orc'] = [
            this.createPixelCanvas(8, 8, orcM1, orcPal, 3),
            this.createPixelCanvas(8, 8, orcM2, orcPal, 3)
        ];

        // --- 5. 몬스터: 늑대인간 (Lycanthrope) ---
        const wolfPal = {
            'G': '#52525b', 'D': '#27272a', 'L': '#a1a1aa', 'E': '#ef4444', 'W': '#ffffff'
        };
        const wolfM1 = [
            ".GG...GG",
            "GGLLLLGG",
            ".GLEELG.",
            "..GGGG..",
            ".GGGGGG.",
            "W.GGGG.W",
            "..D..D..",
            "..D..D.."
        ];
        const wolfM2 = [
            ".GG...GG",
            "GGLLLLGG",
            ".GLEELG.",
            "..GGGG..",
            ".GGGGGG.",
            "..GGGG..",
            ".W....W.",
            ".D....D."
        ];
        this.cache['lycanthrope'] = [
            this.createPixelCanvas(8, 8, wolfM1, wolfPal, 3),
            this.createPixelCanvas(8, 8, wolfM2, wolfPal, 3)
        ];

        // --- 6. 몬스터: 셀로브 (거대 거미 - Selolb) ---
        const selPal = {
            'R': '#991b1b', 'B': '#18181b', 'E': '#fde047', 'L': '#450a0a'
        };
        const selM1 = [
            "B..RR..B",
            ".B.RER.B",
            "..BRRRB.",
            "BBBRRRBBB",
            "..BRRRB.",
            ".B.RRR.B",
            "B..RR..B",
            "...LL..."
        ];
        const selM2 = [
            ".B.RR.B.",
            "B..RER..B",
            "..BRRRB.",
            "BBBRRRBBB",
            "..BRRRB.",
            "B..RRR..B",
            ".B.RR.B.",
            "...LL..."
        ];
        this.cache['selolb'] = [
            this.createPixelCanvas(9, 8, selM1, selPal, 3),
            this.createPixelCanvas(9, 8, selM2, selPal, 3)
        ];

        // --- 7. 물약상인 판도라 (Pandora) ---
        const panPal = {
            'G': '#16a34a', 'H': '#78350f', 'S': '#fed7aa', 'W': '#ffffff', 'D': '#15803d'
        };
        const panM = [
            "..HHHH..",
            "..SESE..",
            ".GGGGGG.",
            ".GWWWWG.",
            ".GWWWWG.",
            "..DDDD..",
            "..G..G..",
            "..D..D.."
        ];
        this.cache['npc_pandora'] = [
            this.createPixelCanvas(8, 8, panM, panPal, 3)
        ];

        // --- 8. 리니지 클래식 상징 아이템 아이콘 (24x24) ---
        this.cache['icon_red_potion'] = this.drawPotionIcon('#ef4444');    // 빨간 물약
        this.cache['icon_green_potion'] = this.drawPotionIcon('#22c55e');  // 초록 물약
        this.cache['icon_brave_potion'] = this.drawPotionIcon('#eab308');  // 용기의 물약
        this.cache['icon_teleport'] = this.drawScrollIcon('#c084fc');      // 순간이동 주문서
        this.cache['icon_return'] = this.drawScrollIcon('#38bdf8');        // 귀환 주문서
        this.cache['icon_enchant_weapon'] = this.drawScrollIcon('#ef4444', '★'); // 데이 (무기마법주문서)
        this.cache['icon_enchant_armor'] = this.drawScrollIcon('#3b82f6', '◆');  // 젤 (갑옷마법주문서)
        this.cache['icon_polymorph'] = this.drawScrollIcon('#fbbf24', '💀');      // 변신 주문서
        this.cache['icon_sword'] = this.drawSwordIcon();                   // 싸울아비 장검
    }

    drawPotionIcon(liquidColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 36;
        canvas.height = 36;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 36, 36);

        // 코르크 마개
        ctx.fillStyle = '#92400e';
        ctx.fillRect(15, 4, 6, 4);

        // 유리병 목
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(14, 8, 8, 4);

        // 플라스크 몸통
        ctx.fillStyle = liquidColor;
        ctx.beginPath();
        ctx.arc(18, 22, 11, 0, Math.PI * 2);
        ctx.fill();

        // 유리 반사광
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(15, 18, 4, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    }

    drawScrollIcon(ribbonColor, symbol = '') {
        const canvas = document.createElement('canvas');
        canvas.width = 36;
        canvas.height = 36;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 36, 36);

        // 낡은 양피지 두루마리
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(8, 7, 20, 22);

        // 리본 끈
        ctx.fillStyle = ribbonColor;
        ctx.fillRect(6, 16, 24, 4);

        if (symbol) {
            ctx.fillStyle = ribbonColor;
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(symbol, 18, 28);
        }
        return canvas;
    }

    drawSwordIcon() {
        const canvas = document.createElement('canvas');
        canvas.width = 36;
        canvas.height = 36;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 36, 36);

        // 대각선 칼날
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(6, 30);
        ctx.lineTo(28, 8);
        ctx.stroke();

        // 코등이
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(8, 22);
        ctx.lineTo(14, 28);
        ctx.stroke();

        return canvas;
    }

    draw(ctx, spriteKey, x, y, flipX = false) {
        const frames = this.cache[spriteKey];
        if (!frames) return;
        const img = frames[this.frame % frames.length];

        ctx.save();
        ctx.translate(x, y);
        if (flipX) ctx.scale(-1, 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
    }
}

window.lineageSprites = new LineageSprites();
