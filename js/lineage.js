/**
 * LineageEngine - 리니지 1 클래식 코어 게임 엔진 (모바일 터치 & 반응형 지원)
 * 마우스 포인트&클릭 및 모바일 스마트폰 터치 이동/공격 완벽 지원
 */
class LineageEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isRunning = false;
        this.animationId = null;

        this.init();
    }

    init() {
        // 플레이어 상태
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

        // 인벤토리 소지품
        this.inventory = [
            { id: 'red_potion', name: '빨간 물약', count: 30, icon: 'icon_red_potion' },
            { id: 'green_potion', name: '초록 물약', count: 10, icon: 'icon_green_potion' },
            { id: 'brave_potion', name: '용기의 물약', count: 6, icon: 'icon_brave_potion' },
            { id: 'teleport', name: '순간이동 주문서', count: 15, icon: 'icon_teleport' },
            { id: 'return', name: '귀환 주문서', count: 5, icon: 'icon_return' },
            { id: 'enchant_weapon', name: '무기 마법 주문서 (데이)', count: 5, icon: 'icon_enchant_weapon' },
            { id: 'polymorph', name: '변신 주문서 (데스나이트)', count: 4, icon: 'icon_polymorph' }
        ];

        // 단축창 (F1 ~ F8)
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

        this.buildWorld();

        this.logs = [];
        this.addLog("시스템", "리니지 클래식 모바일 서버에 접속하셨습니다. (말하는 섬)");
        this.addLog("안내", "화면 터치/클릭으로 이동 및 공격하고, 하단 단축 아이콘을 터치해 물약과 주문서를 사용하세요.");

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

        this.spawnMonsters();
    }

    spawnMonsters() {
        this.monsters = [];

        for (let i = 0; i < 4; i++) {
            this.monsters.push({
                type: 'orc',
                name: '가네프 오크',
                x: 600 + Math.random() * 260,
                y: 150 + Math.random() * 200,
                radius: 20,
                hp: 65,
                maxHp: 65,
                speed: 1.6,
                damage: 12,
                exp: 35,
                adena: 60 + Math.floor(Math.random() * 40),
                attackCooldown: 0,
                flipX: false
            });
        }

        for (let i = 0; i < 3; i++) {
            this.monsters.push({
                type: 'lycanthrope',
                name: '라이칸스로프',
                x: 650 + Math.random() * 220,
                y: 380 + Math.random() * 180,
                radius: 22,
                hp: 110,
                maxHp: 110,
                speed: 2.2,
                damage: 18,
                exp: 65,
                adena: 120 + Math.floor(Math.random() * 60),
                attackCooldown: 0,
                flipX: false
            });
        }

        for (let i = 0; i < 2; i++) {
            this.monsters.push({
                type: 'selolb',
                name: '셀로브',
                x: 750 + Math.random() * 160,
                y: 280 + Math.random() * 220,
                radius: 24,
                hp: 180,
                maxHp: 180,
                speed: 2.6,
                damage: 26,
                exp: 140,
                adena: 250 + Math.floor(Math.random() * 100),
                attackCooldown: 0,
                flipX: false
            });
        }
    }

    handleActionAt(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const clickX = (screenX - rect.left) * scaleX;
        const clickY = (screenY - rect.top) * scaleY;

        let clickedEntity = null;

        // NPC 터치/클릭
        for (const npc of this.npcs) {
            if (Math.hypot(clickX - npc.x, clickY - npc.y) < npc.radius + 16) {
                this.openShopModal();
                return;
            }
        }

        // 몬스터 터치/클릭
        for (const m of this.monsters) {
            if (Math.hypot(clickX - m.x, clickY - m.y) < m.radius + 18) {
                clickedEntity = m;
                break;
            }
        }

        // 허수아비 터치/클릭
        if (!clickedEntity) {
            for (const d of this.dummies) {
                if (Math.hypot(clickX - d.x, clickY - d.y) < d.radius + 18) {
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
        // 마우스 클릭
        this.onMouseDown = (e) => {
            if (e.button === 0) {
                this.handleActionAt(e.clientX, e.clientY);
            } else if (e.button === 2) {
                e.preventDefault();
                this.useItem('red_potion');
            }
        };

        // 모바일 터치 이벤트 (스마트폰 터치 지원)
        this.onTouchStart = (e) => {
            e.preventDefault();
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                this.handleActionAt(touch.clientX, touch.clientY);
            }
        };

        this.onContextMenu = (e) => e.preventDefault();

        // 키보드 단축키
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

    // --- 아이템 & 스킬 사용 로직 ---
    useItem(itemId) {
        const p = this.player;

        if (itemId === 'red_potion') {
            const item = this.getItem(itemId);
            if (item && item.count > 0) {
                item.count--;
                p.hp = Math.min(p.maxHp, p.hp + 45);
                window.lineageAudio.playPotion();
                this.spawnDamageEffect(p.x, p.y, "+45 HP", "#22c55e");
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
                p.polyTimer = 40.0;
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
            this.addLog("인챈트", `★ [대성공] ${w.name}이(가) 푸른빛을 발하며 +${w.enchant}로 강화되었습니다! (공격력 +${w.enchant * 2})`);
        } else {
            const success = Math.random() < 0.65;
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
                return `<div class="log-line"><span class="log-time">[${l.time}]</span> <span style="color:${col}; font-weight:700;">[${l.category}]</span> ${l.msg}</div>`;
            }).join('');
        }
    }

    loop(timestamp) {
        if (!this.isRunning) return;
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        window.lineageSprites.update(dt);
        this.update(dt);
        this.render();

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

        const inSafetyZone = p.x < 420;
        const regenRate = inSafetyZone ? 8 : 4;
        if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regenRate * dt);
        if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + (regenRate * 0.8) * dt);

        if (p.attackCooldown > 0) p.attackCooldown -= dt;

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

            if (p.x >= 420 && mDist < 200 && mDist > 40) {
                m.x += (mDx / mDist) * m.speed;
                m.y += (mDy / mDist) * m.speed;
                m.flipX = mDx < 0;
            }

            if (mDist <= 46) {
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

        if (target.name === '허수아비') {
            if (p.level < 5) {
                p.exp += 8;
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
        this.addLog("전투", `※ ${m.name}을(를) 처치하여 경험치(${m.exp})와 아데나를 획득했습니다.`);

        this.drops.push({
            x: m.x,
            y: m.y,
            adena: m.adena,
            exp: m.exp
        });

        if (Math.random() < 0.25) {
            const isWeaponScroll = Math.random() < 0.5;
            const scrollId = isWeaponScroll ? 'enchant_weapon' : 'polymorph';
            const item = this.getItem(scrollId);
            if (item) {
                item.count++;
                this.addLog("전투", `★ 대박 드랍! 몬스터가 [${item.name}]을(를) 떨어뜨렸습니다! ★`);
                window.lineageAudio.playEnchantSuccess();
            }
        }

        setTimeout(() => {
            if (this.isRunning) {
                this.monsters.push({
                    type: m.type,
                    name: m.name,
                    x: 600 + Math.random() * 300,
                    y: 150 + Math.random() * 400,
                    radius: m.radius,
                    hp: m.maxHp,
                    maxHp: m.maxHp,
                    speed: m.speed,
                    damage: m.damage,
                    exp: m.exp,
                    adena: m.adena,
                    attackCooldown: 0,
                    flipX: false
                });
            }
        }, 3500);
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
        this.addLog("시스템", "사망하셨습니다. 마을 안전지대에서 부활합니다.");
        const p = this.player;
        p.hp = p.maxHp;
        p.x = 240;
        p.y = 360;
        p.targetX = 240;
        p.targetY = 360;
        p.targetEntity = null;
        window.lineageAudio.playTeleport();
    }

    spawnDamageEffect(x, y, text, color) {
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

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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
        ctx.fillText("【안전지대 (Safety Zone)】 말하는 섬 마을", 20, 30);

        ctx.fillStyle = '#f87171';
        ctx.fillText("【전투구역 (Combat Zone)】 글루딘 야생 사냥터", 440, 30);

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
            const spriteKey = m.type === 'orc' ? 'orc' : (m.type === 'lycanthrope' ? 'lycanthrope' : 'selolb');
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
