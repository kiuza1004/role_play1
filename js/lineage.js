/**
 * LineageEngine - 리니지 1 클래식 코어 게임 엔진 (v2.2.0 Multi-Sector & Cycle Edition)
 * Three.js 3D 입체 그래픽스 렌더러 연동 & 실시간 쿼터뷰/액션뷰 시점 시스템
 * 4대 섹터 모험, 마물 전멸 시 포탈 개방, 안전지대 정비 및 사이클별 몬스터 레벨업 시스템 완비
 */

const SECTORS = [
    {
        id: 0,
        name: "말하는 섬 베이스캠프 (마을)",
        theme: "village",
        isSafetyZone: true,
        desc: "하딘의 결계가 지켜주는 성역. 판도라 상점과 허수아비로 정비 후 출정하십시오.",
        fogColor: 0x11161d,
        ambientColor: 0xd0e0ff,
        spawns: []
    },
    {
        id: 1,
        name: "섹터 1: 글루딘 야생 밀림",
        theme: "forest",
        isSafetyZone: false,
        desc: "가네프 오크 부족과 라이칸스로프가 배회하는 울창한 숲길.",
        fogColor: 0x0f2015,
        ambientColor: 0xa7f3d0,
        spawns: [
            { type: 'orc', count: 4, name: '가네프 오크', baseHp: 70, baseDmg: 10, speed: 1.5, radius: 20, exp: 40, adena: 80 },
            { type: 'lycanthrope', count: 3, name: '라이칸스로프', baseHp: 110, baseDmg: 15, speed: 2.1, radius: 22, exp: 75, adena: 130 }
        ]
    },
    {
        id: 2,
        name: "섹터 2: 비명의 개미굴 & 지하 암반",
        theme: "cave",
        isSafetyZone: false,
        desc: "지하 깊은 곳에 둥지를 튼 거대 맹독 거미 셀로브와 동굴 야수들.",
        fogColor: 0x1f1025,
        ambientColor: 0xe9d5ff,
        spawns: [
            { type: 'lycanthrope', count: 3, name: '동굴 늑대인간', baseHp: 135, baseDmg: 18, speed: 2.2, radius: 22, exp: 95, adena: 160 },
            { type: 'selolb', count: 3, name: '맹독 셀로브', baseHp: 190, baseDmg: 25, speed: 2.4, radius: 24, exp: 140, adena: 240 }
        ]
    },
    {
        id: 3,
        name: "섹터 3: 글루디오 성채 폐허 & 데스나이트의 제단",
        theme: "ruins",
        isSafetyZone: false,
        desc: "타락한 언데드 기사단장과 해골 기사들이 지키는 최종 결전지.",
        fogColor: 0x260a0a,
        ambientColor: 0xfecaca,
        spawns: [
            { type: 'skeleton', count: 4, name: '해골 기사', baseHp: 160, baseDmg: 20, speed: 1.9, radius: 20, exp: 120, adena: 200 },
            { type: 'selolb', count: 2, name: '변종 셀로브', baseHp: 210, baseDmg: 27, speed: 2.4, radius: 24, exp: 160, adena: 260 },
            { type: 'boss_deathknight', count: 1, name: '타락한 데스나이트 군주', baseHp: 520, baseDmg: 38, speed: 2.1, radius: 28, exp: 450, adena: 1200 }
        ]
    }
];

class LineageEngine {
    constructor(canvas, container) {
        this.canvas = canvas;
        this.container = container || (canvas ? canvas.parentElement : null);
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.isRunning = false;
        this.animationId = null;

        // 게임 설정 (속도 & 난이도)
        this.speedMultiplier = 1.0; // 1.0, 1.5, 2.0
        this.difficulty = 'normal';   // 'easy', 'normal', 'hard'

        // 3D 렌더러 초기화 (WebGL 지원 여부 검사 및 예외 안전 처리)
        this.lineage3D = null;
        if (window.Lineage3D && window.THREE && this.container) {
            try {
                this.lineage3D = new Lineage3D(this.container, this);
                if (this.canvas) this.canvas.style.display = 'none';
            } catch (err) {
                console.warn("[LineageEngine] 3D 초기화 실패, 2D 엔진으로 안전 전환합니다:", err);
                this.lineage3D = null;
                if (this.canvas) this.canvas.style.display = 'block';
            }
        } else {
            if (this.canvas) this.canvas.style.display = 'block';
        }

        this.init();
    }

    toggleCameraView() {
        if (this.lineage3D) {
            const mode = this.lineage3D.toggleViewMode();
            this.addLog("설정", `카메라 시점이 [${mode}]로 전환되었습니다.`);
            return mode;
        }
        return '쿼터뷰';
    }

    setSpeed(speed) {
        this.speedMultiplier = parseFloat(speed);
        this.addLog("설정", `게임 속도가 [${this.speedMultiplier}배속]으로 변경되었습니다.`);
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        const names = { 'easy': '쉬움 (초보자)', 'normal': '보통 (클래식)', 'hard': '어려움 (하드코어)' };
        this.addLog("설정", `게임 난이도가 [${names[diff]}]으로 설정되었습니다.`);
    }

    init() {
        this.player = {
            name: "데포로쥬",
            title: "붉은기사단",
            x: 240,
            y: 360,
            targetX: 240,
            targetY: 360,
            speed: 2.8,
            level: 1,
            exp: 0,
            maxExp: 80,
            hp: 120,
            maxHp: 120,
            mp: 50,
            maxMp: 50,
            str: 18,
            dex: 12,
            con: 18,
            ac: -15,
            adena: 3000,
            weight: 42,
            weapon: {
                name: "싸울아비 장검",
                enchant: 0,
                baseDamage: 16
            },
            isPolymorphed: false,
            polyTimer: 0,
            hasteTimer: 0,
            braveTimer: 0,
            targetEntity: null,
            attackCooldown: 0,
            isAttacking: false,
            flipX: false
        };

        this.inventory = [
            { id: 'red_potion', name: '빨간 물약', count: 35, icon: 'icon_red_potion' },
            { id: 'green_potion', name: '초록 물약', count: 12, icon: 'icon_green_potion' },
            { id: 'brave_potion', name: '용기의 물약', count: 8, icon: 'icon_brave_potion' },
            { id: 'teleport', name: '순간이동 주문서', count: 20, icon: 'icon_teleport' },
            { id: 'return', name: '귀환 주문서', count: 6, icon: 'icon_return' },
            { id: 'enchant_weapon', name: '무기 마법 주문서 (데이)', count: 6, icon: 'icon_enchant_weapon' },
            { id: 'polymorph', name: '변신 주문서 (데스나이트)', count: 5, icon: 'icon_polymorph' }
        ];

        this.quickSlots = [
            'red_potion', 'green_potion', 'brave_potion', 'teleport',
            'return', 'enchant_weapon', 'polymorph', 'energy_bolt'
        ];

        this.monsters = [];
        this.dummies = [];
        this.npcs = [];
        this.drops = [];
        this.damageTexts = [];
        this.particles = [];
        this.logs = [];

        // 멀티 섹터 모험 & 사이클 시스템 상태
        this.currentCycle = 1;
        this.currentSector = 0;
        this.portalActive = true;
        this.totalSectorMonsters = 0;

        this.buildWorld();

        this.addLog("시스템", "리니지 클래식 3D v2.2.1 (멀티 섹터 모험 & 사이클 레벨업) 서버에 접속하셨습니다.");
        this.addLog("스토리", "[데포로쥬] 왕자님, 말하는 섬에서 정비 후 우측 출정 포탈로 진격하십시오!");
        this.addLog("안내", "각 구역 마물을 모두 소탕하면 다음 차원 포탈이 열립니다.");

        this.bindEvents();
    }

    buildWorld() {
        this.dummies = [
            { id: 'dum1', name: '허수아비', x: 180, y: 240, hp: 999999, maxHp: 999999, radius: 18 },
            { id: 'dum2', name: '허수아비', x: 250, y: 220, hp: 999999, maxHp: 999999, radius: 18 },
            { id: 'dum3', name: '허수아비', x: 320, y: 240, hp: 999999, maxHp: 999999, radius: 18 }
        ];

        this.npcs = [
            { id: 'npc_pandora', name: '판도라 (물약상인)', x: 140, y: 440, radius: 24 }
        ];

        this.loadSector(0);
    }

    loadSector(sectorId) {
        this.currentSector = sectorId;
        const sec = SECTORS[sectorId];
        this.monsters = [];
        this.drops = [];

        if (sectorId === 0) {
            this.player.x = 240;
            this.player.y = 360;
        } else {
            this.player.x = 180;
            this.player.y = 260;
        }
        this.player.targetX = this.player.x;
        this.player.targetY = this.player.y;
        this.player.targetEntity = null;

        if (this.lineage3D) {
            this.lineage3D.switchSectorTheme(sec);
        }

        if (sectorId === 0) {
            this.portalActive = true;
            if (this.lineage3D) {
                this.lineage3D.setPortalActive(true, 880, 260, `제 ${this.currentCycle}사이클 출정`);
            }
            this.addLog("모험", `【${sec.name}】에 도착했습니다. 판도라 상점과 허수아비로 정비하십시오.`);
            this.addLog("안내", `우측 [제 ${this.currentCycle}사이클 출정 포탈]에 다가가면 모험이 시작됩니다.`);
        } else {
            this.portalActive = false;
            if (this.lineage3D) {
                this.lineage3D.setPortalActive(false);
            }
            this.spawnSectorMonsters(sec);
            this.totalSectorMonsters = this.monsters.length;
            this.addLog("모험", `⚔️ 【${sec.name}】 진입! (제 ${this.currentCycle}사이클)`);
            this.addLog("미션", `구역 내 마물(${this.totalSectorMonsters}마리)을 전멸시켜 다음 포탈을 개방하십시오!`);
        }

        this.updateSectorHUD();
    }

    spawnSectorMonsters(sec) {
        const cycle = this.currentCycle;
        let diffHp = 1.0, diffDmg = 1.0;
        if (this.difficulty === 'easy') { diffHp = 0.8; diffDmg = 0.6; }
        else if (this.difficulty === 'hard') { diffHp = 1.35; diffDmg = 1.45; }

        const cycleHpMult = 1 + (cycle - 1) * 0.40;
        const cycleDmgMult = 1 + (cycle - 1) * 0.28;
        const cycleExpMult = 1 + (cycle - 1) * 0.45;
        const cycleAdenaMult = 1 + (cycle - 1) * 0.55;

        sec.spawns.forEach(spawn => {
            for (let i = 0; i < spawn.count; i++) {
                let mLevel = (sec.id * 2) + ((cycle - 1) * 3);
                if (spawn.type === 'boss_deathknight') mLevel += 4;
                mLevel = Math.max(1, mLevel);

                const sx = 460 + Math.random() * 420;
                const sy = 120 + Math.random() * 280;

                const finalHp = Math.round(spawn.baseHp * cycleHpMult * diffHp);
                const finalDmg = Math.round(spawn.baseDmg * cycleDmgMult * diffDmg);

                this.monsters.push({
                    type: spawn.type,
                    name: `[Lv.${mLevel}] ${spawn.name}`,
                    x: sx,
                    y: sy,
                    spawnX: sx,
                    spawnY: sy,
                    radius: spawn.radius,
                    hp: finalHp,
                    maxHp: finalHp,
                    speed: spawn.speed,
                    damage: finalDmg,
                    exp: Math.round(spawn.exp * cycleExpMult),
                    adena: Math.round(spawn.adena * cycleAdenaMult + Math.random() * 20),
                    attackCooldown: 0,
                    flipX: false
                });
            }
        });
    }

    updateSectorHUD() {
        const cycleEl = document.getElementById('hud-cycle-text');
        const sectorEl = document.getElementById('hud-sector-text');
        const monsterEl = document.getElementById('hud-monsters-text');

        if (cycleEl) cycleEl.textContent = `제 ${this.currentCycle}사이클`;
        const sec = SECTORS[this.currentSector];
        if (sectorEl && sec) sectorEl.textContent = sec.name;

        if (monsterEl) {
            if (this.currentSector === 0) {
                monsterEl.textContent = `안전지대 (우측 포탈로 출정)`;
            } else {
                const remain = this.monsters.length;
                if (remain > 0) {
                    monsterEl.textContent = `남은 마물: ${remain} / ${this.totalSectorMonsters}`;
                } else {
                    monsterEl.textContent = `구역 클리어! 포탈 개방`;
                }
            }
        }
    }

    onSectorClear() {
        window.lineageAudio.playLevelUp();
        this.portalActive = true;

        if (this.currentSector === 3) {
            const bonusAdena = 5000 * this.currentCycle;
            this.player.adena += bonusAdena;
            const scroll = this.getItem('enchant_weapon');
            if (scroll) scroll.count += 3;

            this.addLog("모험", `★★ 축하합니다! [제 ${this.currentCycle}사이클] 모험을 완벽하게 제패했습니다! ★★`);
            this.addLog("보상", `사이클 정복 보상: +${bonusAdena.toLocaleString()} 아데나, 데이 주문서 3장 지급!`);
            this.spawnDamageEffect(this.player.x, this.player.y - 20, "CYCLE CLEAR!!", "#fde047");

            if (this.lineage3D) {
                this.lineage3D.setPortalActive(true, 880, 260, "마을 귀환");
            }
        } else {
            const nextSec = SECTORS[this.currentSector + 1];
            this.addLog("모험", `★ 구역 클리어! [${nextSec.name}] 차원 포탈이 개방되었습니다! ★`);
            this.spawnDamageEffect(this.player.x, this.player.y - 20, "SECTOR CLEAR!", "#38bdf8");

            if (this.lineage3D) {
                this.lineage3D.setPortalActive(true, 880, 260, `${nextSec.name}`);
            }
        }
        this.updateSectorHUD();
    }

    attemptUsePortal() {
        if (!this.portalActive) return;

        window.lineageAudio.playTeleport();
        this.spawnClickRipple(this.player.x, this.player.y);

        if (this.currentSector === 0) {
            this.loadSector(1);
        } else if (this.currentSector < 3) {
            this.loadSector(this.currentSector + 1);
        } else {
            this.currentCycle++;
            this.player.hp = this.player.maxHp;
            this.player.mp = this.player.maxMp;
            this.addLog("시스템", `★★ 안전지대로 무사 귀환! HP/MP가 100% 회복되었습니다. ★★`);
            this.addLog("모험", `다음 출정 시에는 레벨이 오른 [제 ${this.currentCycle}사이클] 몬스터들이 출현합니다!`);
            this.loadSector(0);
        }
    }

    handleActionAt(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const clickX = (screenX - rect.left) * scaleX;
        const clickY = (screenY - rect.top) * scaleY;

        let clickedEntity = null;

        for (const npc of this.npcs) {
            if (Math.hypot(clickX - npc.x, clickY - npc.y) < npc.radius + 18) {
                this.openShopModal();
                return;
            }
        }

        for (const m of this.monsters) {
            if (Math.hypot(clickX - m.x, clickY - m.y) < m.radius + 20) {
                clickedEntity = m;
                break;
            }
        }

        if (!clickedEntity) {
            for (const d of this.dummies) {
                if (Math.hypot(clickX - d.x, clickY - d.y) < d.radius + 20) {
                    clickedEntity = d;
                    break;
                }
            }
        }

        if (clickedEntity) {
            this.player.targetEntity = clickedEntity;
            this.addLog("전투", `${clickedEntity.name}을(를) 공격 대상으로 지정했습니다.`);
        } else {
            this.player.targetEntity = null;
            this.player.targetX = clickX;
            this.player.targetY = clickY;
            this.spawnClickRipple(clickX, clickY);
        }
    }

    bindEvents() {
        this.onMouseDown = (e) => {
            if (e.button === 0) {
                this.handleActionAt(e.clientX, e.clientY);
            } else if (e.button === 2) {
                e.preventDefault();
                this.useItem('red_potion');
            }
        };

        this.onTouchStart = (e) => {
            e.preventDefault();
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                this.handleActionAt(touch.clientX, touch.clientY);
            }
        };

        this.onContextMenu = (e) => e.preventDefault();

        this.onKeyDown = (e) => {
            if (!this.isRunning) return;
            const k = e.key;

            const slotMap = {
                '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7,
                'F1': 0, 'F2': 1, 'F3': 2, 'F4': 3, 'F5': 4, 'F6': 5, 'F7': 6, 'F8': 7
            };

            if (slotMap[k] !== undefined) {
                e.preventDefault();
                const itemId = this.quickSlots[slotMap[k]];
                this.useItem(itemId);
            }

            if (k.toLowerCase() === 'i' || k === 'Tab') {
                e.preventDefault();
                this.toggleInventory();
            }

            if (k.toLowerCase() === 'c') {
                this.toggleStats();
            }
        };

        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('contextmenu', this.onContextMenu);
        window.addEventListener('keydown', this.onKeyDown);
    }

    unbindEvents() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);
        window.removeEventListener('keydown', this.onKeyDown);
    }

    start() {
        this.isRunning = true;
        window.lineageAudio.startLineageBGM();
        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);
        this.updateHUD();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.unbindEvents();
        window.lineageAudio.stopBGM();
    }

    useItem(itemId) {
        const p = this.player;

        if (itemId === 'red_potion') {
            const item = this.getItem(itemId);
            if (item && item.count > 0) {
                item.count--;
                const healAmount = this.difficulty === 'easy' ? 65 : 45;
                p.hp = Math.min(p.maxHp, p.hp + healAmount);
                window.lineageAudio.playPotion();
                this.spawnDamageEffect(p.x, p.y, `+${healAmount} HP`, "#22c55e");
                this.updateHUD();
            } else {
                this.addLog("시스템", "빨간 물약이 부족합니다.");
            }
        } else if (itemId === 'green_potion') {
            const item = this.getItem(itemId);
            if (item && item.count > 0) {
                item.count--;
                p.hasteTimer = 30.0;
                window.lineageAudio.playHaste();
                this.addLog("시스템", "초록 물약을 마셔 몸이 민첩해졌습니다! (1단 가속 30초)");
                this.updateHUD();
            } else {
                this.addLog("시스템", "초록 물약이 부족합니다.");
            }
        } else if (itemId === 'brave_potion') {
            const item = this.getItem(itemId);
            if (item && item.count > 0) {
                item.count--;
                p.braveTimer = 25.0;
                window.lineageAudio.playHaste();
                this.addLog("시스템", "용기의 물약을 마셔 검을 휘두르는 속도가 폭풍처럼 빨라졌습니다! (2단 가속)");
                this.updateHUD();
            } else {
                this.addLog("시스템", "용기의 물약이 부족합니다.");
            }
        } else if (itemId === 'teleport') {
            const item = this.getItem(itemId);
            if (item && item.count > 0) {
                item.count--;
                p.x = 100 + Math.random() * (this.canvas.width - 200);
                p.y = 100 + Math.random() * (this.canvas.height - 200);
                p.targetX = p.x;
                p.targetY = p.y;
                p.targetEntity = null;
                window.lineageAudio.playTeleport();
                this.addLog("시스템", "공간을 왜곡하여 순간이동했습니다.");
                this.updateHUD();
            }
        } else if (itemId === 'return') {
            const item = this.getItem(itemId);
            if (item && item.count > 0) {
                item.count--;
                p.x = 240;
                p.y = 360;
                p.targetX = 240;
                p.targetY = 360;
                p.targetEntity = null;
                window.lineageAudio.playTeleport();
                this.addLog("시스템", "귀환 주문서를 사용하여 말하는 섬 마을 안전지대로 복귀했습니다.");
                this.updateHUD();
            }
        } else if (itemId === 'enchant_weapon') {
            this.attemptEnchantWeapon();
        } else if (itemId === 'polymorph') {
            const item = this.getItem(itemId);
            if (item && item.count > 0) {
                item.count--;
                p.isPolymorphed = true;
                p.polyTimer = 45.0;
                window.lineageAudio.playPolymorph();
                this.addLog("변신", "★ 전설의 52레벨 [데스나이트]로 변신했습니다! (공속 대폭 상승) ★");
                this.updateHUD();
            }
        } else if (itemId === 'energy_bolt') {
            if (p.mp >= 10 && p.targetEntity) {
                p.mp -= 10;
                this.castEnergyBolt(p.targetEntity);
            }
        }
    }

    attemptEnchantWeapon() {
        const item = this.getItem('enchant_weapon');
        if (!item || item.count <= 0) {
            this.addLog("시스템", "무기 마법 주문서(데이)가 부족합니다.");
            return;
        }

        item.count--;
        const w = this.player.weapon;

        if (w.enchant < 6) {
            w.enchant++;
            window.lineageAudio.playEnchantSuccess();
            this.addLog("인챈트", `★ [대성공] ${w.name}이(가) 푸른빛을 발하며 +${w.enchant}로 강화되었습니다! (공격력 +${w.enchant * 3})`);
        } else {
            // 난이도에 따른 인챈트 성공률 조정 (쉬움: 80%, 보통: 65%, 어려움: 50%)
            let successRate = 0.65;
            if (this.difficulty === 'easy') successRate = 0.80;
            if (this.difficulty === 'hard') successRate = 0.50;

            const success = Math.random() < successRate;
            if (success) {
                w.enchant++;
                window.lineageAudio.playEnchantSuccess();
                this.addLog("인챈트", `★ [신화적 성공!!] +${w.enchant} ${w.name} 인챈트에 성공했습니다!!`);
            } else {
                window.lineageAudio.playEnchantFail();
                this.addLog("인챈트", `※ [인챈트 실패] +${w.enchant} ${w.name}이(가) 강력한 마법의 힘을 이기지 못하고 증발하여 흔적도 없이 사라졌습니다!`);
                w.enchant = 0;
            }
        }
        this.updateHUD();
    }

    castEnergyBolt(target) {
        if (this.lineage3D) {
            this.lineage3D.spawnMagicMissile3D(this.player.x, this.player.y, target);
        }
        window.lineageAudio.playSwing();
        this.addLog("마법", `${target.name}에게 에너지 볼트를 시전했습니다.`);
        const dmg = 35 + this.player.str;
        target.hp -= dmg;
        this.spawnDamageEffect(target.x, target.y, `-${dmg}`, "#38bdf8");
        window.lineageAudio.playHit();
        if (target.hp <= 0 && target !== this.dummies[0] && target !== this.dummies[1] && target !== this.dummies[2]) {
            this.killMonster(target);
        }
    }

    getItem(id) {
        return this.inventory.find(i => i.id === id);
    }

    addLog(category, msg) {
        if (!this.logs) this.logs = [];
        const time = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.logs.unshift({ time, category, msg });
        if (this.logs.length > 50) this.logs.pop();

        const logBox = document.getElementById('chat-log-content');
        if (logBox) {
            logBox.innerHTML = this.logs.slice(0, 15).map(l => {
                let col = '#e2e8f0';
                if (l.category === '전투') col = '#fca5a5';
                if (l.category === '시스템') col = '#93c5fd';
                if (l.category === '인챈트') col = '#fde047';
                if (l.category === '변신') col = '#c084fc';
                if (l.category === '설정') col = '#86efac';
                return `<div class="log-line"><span class="log-time">[${l.time}]</span> <span style="color:${col}; font-weight:700;">[${l.category}]</span> ${l.msg}</div>`;
            }).join('');
        }
    }

    loop(timestamp) {
        if (!this.isRunning) return;
        // 게임 속도 배율(speedMultiplier) 적용
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1) * this.speedMultiplier;
        this.lastTime = timestamp;

        window.lineageSprites.update(dt);
        this.update(dt);
        this.render(dt);

        this.animationId = requestAnimationFrame(this.loop);
    }

    update(dt) {
        const p = this.player;

        if (p.hasteTimer > 0) p.hasteTimer -= dt;
        if (p.braveTimer > 0) p.braveTimer -= dt;
        if (p.polyTimer > 0) {
            p.polyTimer -= dt;
            if (p.polyTimer <= 0) {
                p.isPolymorphed = false;
                this.addLog("시스템", "데스나이트 변신이 해제되었습니다.");
            }
        }

        const inSafetyZone = (this.currentSector === 0) || (p.x < 360);
        const regenRate = inSafetyZone ? (this.difficulty === 'easy' ? 14 : 10) : 4;
        if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regenRate * dt);
        if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + (regenRate * 0.8) * dt);

        if (p.attackCooldown > 0) p.attackCooldown -= dt;

        // 차원 이동 포탈 도달 체크
        if (this.portalActive) {
            const pDist = Math.hypot(p.x - 880, p.y - 260);
            if (pDist < 48) {
                this.attemptUsePortal();
            }
        }

        let targetX = p.targetX;
        let targetY = p.targetY;

        if (p.targetEntity) {
            targetX = p.targetEntity.x;
            targetY = p.targetEntity.y;
            const dist = Math.hypot(p.x - targetX, p.y - targetY);

            if (dist <= 52) {
                this.performAttack(p.targetEntity);
            }
        }

        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const distToTarget = Math.hypot(dx, dy);

        if (distToTarget > 6 && (!p.targetEntity || distToTarget > 50)) {
            let speedMult = 1.0;
            if (p.hasteTimer > 0) speedMult *= 1.35;
            if (p.isPolymorphed) speedMult *= 1.25;

            p.x += (dx / distToTarget) * p.speed * speedMult;
            p.y += (dy / distToTarget) * p.speed * speedMult;

            p.flipX = dx < 0;
        }

        this.monsters.forEach(m => {
            const mDx = p.x - m.x;
            const mDy = p.y - m.y;
            const mDist = Math.hypot(mDx, mDy);

            // 1) 주인공이 필드(x >= 420)에 있고 감지 반경(210px) 내에 있을 때: 추격
            if (!inSafetyZone && mDist < 210 && mDist > 40) {
                m.x += (mDx / mDist) * m.speed;
                m.y += (mDy / mDist) * m.speed;
                m.flipX = mDx < 0;
            } 
            // 2) 주인공이 안전지대(마을)로 피신했거나 너무 멀어졌을 때: 원래 자리(spawnX, spawnY)로 복귀!
            else if (inSafetyZone || mDist >= 250) {
                const sDx = m.spawnX - m.x;
                const sDy = m.spawnY - m.y;
                const sDist = Math.hypot(sDx, sDy);

                if (sDist > 5) {
                    const returnSpeed = m.speed * 1.35; // 원래 위치로 신속하게 복귀
                    m.x += (sDx / sDist) * returnSpeed;
                    m.y += (sDy / sDist) * returnSpeed;
                    m.flipX = sDx < 0;
                }
            }

            // 3) 몬스터 뭉침 방지 (Separation):
            // 몬스터끼리 겹쳐서 몰려다니지 않도록 반발력으로 서로를 밀어내어 분산
            this.monsters.forEach(other => {
                if (other !== m) {
                    const sepDx = m.x - other.x;
                    const sepDy = m.y - other.y;
                    const sepDist = Math.hypot(sepDx, sepDy);
                    const minDist = m.radius + other.radius + 8;
                    if (sepDist < minDist && sepDist > 0) {
                        const pushForce = (minDist - sepDist) * 0.08;
                        m.x += (sepDx / sepDist) * pushForce;
                        m.y += (sepDy / sepDist) * pushForce;
                    }
                }
            });

            // 근접 공격 (주인공이 필드에 있을 때만)
            if (!inSafetyZone && mDist <= 46) {
                if (m.attackCooldown <= 0) {
                    m.attackCooldown = 1.4;
                    p.hp -= Math.max(4, m.damage + p.ac / 4);
                    window.lineageAudio.playHit();
                    this.spawnDamageEffect(p.x, p.y, `-${Math.round(m.damage)}`, "#ef4444");

                    if (p.hp <= 0) {
                        p.hp = 0;
                        this.triggerPlayerDeath();
                    }
                }
            }
            if (m.attackCooldown > 0) m.attackCooldown -= dt;
        });

        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            const dDist = Math.hypot(p.x - d.x, p.y - d.y);
            if (dDist < 35) {
                p.adena += d.adena;
                p.exp += d.exp;
                window.lineageAudio.playCoin();
                this.addLog("전투", `아데나 (${d.adena})를 획득했습니다.`);
                this.spawnDamageEffect(p.x, p.y - 15, `+${d.adena} 아데나`, "#fbbf24");

                if (p.exp >= p.maxExp) {
                    this.levelUp();
                }

                this.drops.splice(i, 1);
            }
        }

        this.updateEffects(dt);
        this.updateHUD();
    }

    performAttack(target) {
        const p = this.player;
        if (p.attackCooldown > 0) return;

        let attackInterval = 0.55;
        if (p.hasteTimer > 0) attackInterval *= 0.8;
        if (p.braveTimer > 0) attackInterval *= 0.75;
        if (p.isPolymorphed) attackInterval *= 0.65;

        p.attackCooldown = attackInterval;
        p.isAttacking = true;
        setTimeout(() => { p.isAttacking = false; }, 120);

        window.lineageAudio.playSwing();

        const baseDmg = p.weapon.baseDamage + (p.weapon.enchant * 3) + Math.floor(p.str * 0.8);
        const dmg = Math.round(baseDmg + (Math.random() - 0.5) * 8);

        target.hp -= dmg;
        window.lineageAudio.playHit();
        this.spawnDamageEffect(target.x, target.y - 10, `${dmg}`, "#ffffff");
        if (this.lineage3D) {
            this.lineage3D.spawnHitSpark3D(target.x, target.y, 0xfacc15);
        }

        if (target.name === '허수아비') {
            if (p.level < 5) {
                p.exp += (this.difficulty === 'easy' ? 12 : 8);
                if (p.exp >= p.maxExp) {
                    this.levelUp();
                }
            } else {
                if (Math.random() < 0.08) {
                    this.addLog("시스템", "허수아비 훈련으로는 5레벨 이상 성장할 수 없습니다. 우측 필드로 나가 몬스터를 사냥하십시오.");
                }
            }
        } else {
            if (Math.random() < 0.3) {
                this.addLog("전투", `${target.name}에게 ${dmg}의 대미지를 입혔습니다.`);
            }

            if (target.hp <= 0) {
                this.killMonster(target);
            }
        }
    }

    killMonster(m) {
        const p = this.player;
        const idx = this.monsters.indexOf(m);
        if (idx !== -1) {
            this.monsters.splice(idx, 1);
        }

        p.targetEntity = null;
        const earnedExp = this.difficulty === 'easy' ? Math.round(m.exp * 1.3) : m.exp;
        this.addLog("전투", `※ ${m.name} 처치! (EXP +${earnedExp}, 아데나 +${m.adena})`);

        this.drops.push({
            x: m.x,
            y: m.y,
            adena: m.adena,
            exp: earnedExp
        });

        if (Math.random() < 0.28) {
            const isWeaponScroll = Math.random() < 0.5;
            const scrollId = isWeaponScroll ? 'enchant_weapon' : 'polymorph';
            const item = this.getItem(scrollId);
            if (item) {
                item.count++;
                this.addLog("전투", `★ 대박 드랍! [${item.name}]을(를) 획득했습니다! ★`);
                window.lineageAudio.playEnchantSuccess();
            }
        }

        this.updateSectorHUD();

        // 섹터 내 모든 최초 마물 처치 시 포탈 개방!
        if (this.monsters.length === 0 && this.currentSector > 0) {
            this.onSectorClear();
        }
    }

    levelUp() {
        const p = this.player;
        p.level++;
        p.exp -= p.maxExp;
        p.maxExp = Math.floor(p.maxExp * 1.5);
        p.maxHp += 28;
        p.hp = p.maxHp;
        p.maxMp += 12;
        p.mp = p.maxMp;
        p.str += 1;
        p.ac -= 1;
        window.lineageAudio.playLevelUp();
        this.addLog("시스템", `★★ 축하합니다! 레벨이 상승하여 [Lv.${p.level}]이 되었습니다! ★★`);
        this.spawnDamageEffect(p.x, p.y - 30, "LEVEL UP!", "#fde047");
    }

    triggerPlayerDeath() {
        this.addLog("시스템", "사망하셨습니다. 마을 베이스캠프로 귀환하여 부활합니다.");
        const p = this.player;
        p.hp = p.maxHp;
        this.loadSector(0);
        window.lineageAudio.playTeleport();
    }

    spawnDamageEffect(x, y, text, color) {
        if (this.lineage3D) {
            this.lineage3D.spawnDamageText3D(x, y, text, color);
        }
        this.damageTexts.push({
            x: x + (Math.random() - 0.5) * 14,
            y: y - 10,
            vy: -1.2,
            text: text,
            color: color,
            life: 0.9
        });
    }

    spawnClickRipple(x, y) {
        if (this.lineage3D) {
            this.lineage3D.spawnClickRing3D(x, y);
        }
        this.particles.push({
            type: 'ripple',
            x: x,
            y: y,
            radius: 4,
            maxRadius: 18,
            life: 0.35
        });
    }

    updateEffects(dt) {
        for (let i = this.damageTexts.length - 1; i >= 0; i--) {
            const t = this.damageTexts[i];
            t.y += t.vy;
            t.life -= dt;
            if (t.life <= 0) this.damageTexts.splice(i, 1);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.radius += 24 * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    openShopModal() {
        const modal = document.getElementById('shop-modal');
        if (modal) modal.style.display = 'flex';
    }

    toggleInventory() {
        const inv = document.getElementById('inventory-modal');
        if (inv) {
            inv.style.display = inv.style.display === 'flex' ? 'none' : 'flex';
            this.renderInventoryModal();
        }
    }

    toggleStats() {
        const st = document.getElementById('stats-modal');
        if (st) {
            st.style.display = st.style.display === 'flex' ? 'none' : 'flex';
            this.renderStatsModal();
        }
    }

    renderInventoryModal() {
        const list = document.getElementById('inv-item-list');
        if (!list) return;
        list.innerHTML = this.inventory.map(item => `
            <div class="inv-slot" onclick="window.lineageEngine.useItem('${item.id}')">
                <span class="inv-name">${item.name}</span>
                <span class="inv-count">${item.count}개</span>
            </div>
        `).join('');
    }

    renderStatsModal() {
        const p = this.player;
        const body = document.getElementById('stats-content');
        if (!body) return;
        body.innerHTML = `
            <div class="stat-line"><span>이름</span>: ${p.name} [${p.title}]</div>
            <div class="stat-line"><span>클래스</span>: 기사 (Knight)</div>
            <div class="stat-line"><span>레벨</span>: Lv.${p.level} (${((p.exp / p.maxExp) * 100).toFixed(1)}%)</div>
            <div class="stat-line"><span>HP / MP</span>: ${Math.ceil(p.hp)}/${p.maxHp} | ${Math.ceil(p.mp)}/${p.maxMp}</div>
            <div class="stat-line"><span>방어구(AC)</span>: ${p.ac}</div>
            <div class="stat-line"><span>STR / DEX / CON</span>: ${p.str} / ${p.dex} / ${p.con}</div>
            <div class="stat-line"><span>착용 무기</span>: +${p.weapon.enchant} ${p.weapon.name}</div>
            <div class="stat-line"><span>보유 아데나</span>: ${p.adena.toLocaleString()} Adena</div>
        `;
    }

    updateHUD() {
        const p = this.player;
        const hpBar = document.getElementById('hp-gauge-fill');
        const mpBar = document.getElementById('mp-gauge-fill');
        const expBar = document.getElementById('exp-gauge-fill');
        const hpText = document.getElementById('hp-gauge-text');
        const mpText = document.getElementById('mp-gauge-text');
        const expText = document.getElementById('exp-gauge-text');
        const adenaText = document.getElementById('hud-adena-text');
        const weaponText = document.getElementById('hud-weapon-text');

        if (hpBar) hpBar.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
        if (hpText) hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
        if (mpBar) mpBar.style.width = `${Math.max(0, (p.mp / p.maxMp) * 100)}%`;
        if (mpText) mpText.textContent = `${Math.ceil(p.mp)} / ${p.maxMp}`;

        const expPercent = ((p.exp / p.maxExp) * 100).toFixed(2);
        if (expBar) expBar.style.width = `${expPercent}%`;
        if (expText) expText.textContent = `EXP ${expPercent}% (Lv.${p.level})`;

        if (adenaText) adenaText.textContent = `${p.adena.toLocaleString()} 아데나`;
        if (weaponText) weaponText.textContent = `+${p.weapon.enchant} ${p.weapon.name}`;

        this.quickSlots.forEach((id, idx) => {
            const countEl = document.getElementById(`slot-count-${idx + 1}`);
            if (countEl) {
                const it = this.getItem(id);
                countEl.textContent = it ? it.count : '';
            }
        });
    }

    render(dt = 0.016) {
        if (this.lineage3D) {
            this.lineage3D.update(dt);
            return;
        }

        const ctx = this.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const currentSec = (this.sectors && this.sectors[this.currentSector]) ? this.sectors[this.currentSector] : { name: '알 수 없음' };

        if (this.currentSector === 0) {
            // 마을 잔디 타일
            ctx.fillStyle = '#2d4229';
            ctx.fillRect(0, 0, 420, this.canvas.height);

            // 마을 자갈길
            ctx.fillStyle = '#473c2b';
            ctx.fillRect(100, 320, 240, 70);
            ctx.fillRect(200, 160, 60, 260);

            // 필드 사냥터
            ctx.fillStyle = '#3a3224';
            ctx.fillRect(420, 0, this.canvas.width - 420, this.canvas.height);

            // 울타리 경계
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(420, 0);
            ctx.lineTo(420, this.canvas.height);
            ctx.stroke();

            ctx.fillStyle = '#4ade80';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText("【안전지대 (Safety Zone)】 말하는 섬 마을", 20, 30);

            ctx.fillStyle = '#f87171';
            ctx.fillText("【전투구역 (Combat Zone)】 훈련소", 440, 30);
        } else if (this.currentSector === 1) {
            // 글루딘 숲
            ctx.fillStyle = '#162e16';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`【${currentSec.name}】 야생의 수풀림 (전원 처치 시 포탈 개방)`, 20, 30);
        } else if (this.currentSector === 2) {
            // 비명의 개미굴
            ctx.fillStyle = '#1c101e';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#c084fc';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`【${currentSec.name}】 어두운 지하 동굴 (전원 처치 시 포탈 개방)`, 20, 30);
        } else if (this.currentSector === 3) {
            // 성채 폐허
            ctx.fillStyle = '#181216';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#f87171';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`【${currentSec.name}】 보스 데스나이트의 안식처`, 20, 30);
        }

        // 2D 차원 포탈 드로잉
        if (this.portal && this.portal.active) {
            ctx.save();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.beginPath();
            ctx.arc(this.portal.x, this.portal.y, this.portal.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = '#fde047';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.portal.label || "차원 이동 포탈", this.portal.x, this.portal.y - 32);
            ctx.restore();
        }

        // 허수아비
        for (const dum of this.dummies) {
            window.lineageSprites.draw(ctx, 'dummy', dum.x, dum.y);
            ctx.fillStyle = '#fbbf24';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dum.name, dum.x, dum.y - 28);
        }

        // NPC
        for (const npc of this.npcs) {
            window.lineageSprites.draw(ctx, 'npc_pandora', npc.x, npc.y);
            ctx.fillStyle = '#4ade80';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(npc.name, npc.x, npc.y - 24);
        }

        // 드랍 아데나
        for (const d of this.drops) {
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#eab308';
            ctx.font = '9px monospace';
            ctx.fillText("아데나", d.x - 12, d.y + 14);
        }

        // 몬스터
        for (const m of this.monsters) {
            let spriteKey = 'orc';
            if (m.type === 'skeleton') spriteKey = 'knight_walk';
            else if (m.type === 'deathknight') spriteKey = 'deathknight_walk';
            else if (m.type === 'lycanthrope') spriteKey = 'lycanthrope';
            else if (m.type === 'selolb') spriteKey = 'selolb';
            window.lineageSprites.draw(ctx, spriteKey, m.x, m.y, m.flipX);

            ctx.fillStyle = '#fca5a5';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.name, m.x, m.y - 24);

            const barW = 32;
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(m.x - barW / 2, m.y - 20, barW, 4);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(m.x - barW / 2, m.y - 20, (m.hp / m.maxHp) * barW, 4);
        }

        // 플레이어
        const p = this.player;
        const playerSprite = p.isPolymorphed
            ? (p.isAttacking ? 'deathknight_attack' : 'deathknight_walk')
            : (p.isAttacking ? 'knight_attack' : 'knight_walk');

        if (p.hasteTimer > 0 || p.braveTimer > 0) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.fill();
        }

        window.lineageSprites.draw(ctx, playerSprite, p.x, p.y, p.flipX);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`[${p.title}]`, p.x, p.y - 38);
        ctx.fillText(p.name, p.x, p.y - 24);

        if (p.targetEntity) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.targetEntity.x, p.targetEntity.y, p.targetEntity.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
        }

        for (const pt of this.particles) {
            if (pt.type === 'ripple') {
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        for (const dt of this.damageTexts) {
            ctx.fillStyle = dt.color;
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(dt.text, dt.x, dt.y);
        }
    }
}

window.LineageEngine = LineageEngine;
