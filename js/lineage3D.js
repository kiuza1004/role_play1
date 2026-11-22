/**
 * Lineage3D - 리니지 1 클래식 3D 입체 그래픽스 렌더링 엔진 (v2.2.0)
 * Three.js 기반 멀티 섹터 모험 & 사이클 레벨업 시스템 렌더러
 * - 실시간 다이내믹 섀도우(그림자) 및 PBR 조명 시스템
 * - 4대 섹터 테마 동적 전환 (말하는 섬 마을 / 글루딘 숲 / 비명의 개미굴 / 성채 폐허)
 * - 신규 몬스터 3D 모델 (해골 기사 스켈레톤, 최종 보스 타락한 데스나이트)
 * - 차원 이동 마법진 포탈 및 섹터 클리어 시각 효과
 * - 쿼터뷰(전체 조망) & 클로즈업 액션 뷰 전환
 */
class Lineage3D {
    constructor(container, engine) {
        this.container = container;
        this.engine = engine;

        // 월드 스케일 변환 계수 (2D 픽셀 좌표 -> 3D 월드 좌표)
        this.scale = 0.085;
        this.offsetX = 512;
        this.offsetY = 260;

        this.meshes = {
            player: null,
            monsters: new Map(),
            dummies: new Map(),
            npcs: new Map(),
            drops: new Map()
        };

        this.particles3D = [];
        this.floatingTexts3D = [];
        this.magicMissiles = [];
        this.portalMesh = null;

        this.initThree();
        this.buildEnvironment();
        this.bindRaycaster();
    }

    // 2D 게임 좌표(x, y)를 3D 공간 좌표(X, 0, Z)로 변환
    to3DX(x) {
        return (x - this.offsetX) * this.scale;
    }

    to3DZ(y) {
        return (y - this.offsetY) * this.scale;
    }

    // 3D 공간 좌표(X, Z)를 2D 게임 좌표(x, y)로 역변환
    to2DX(x3D) {
        return (x3D / this.scale) + this.offsetX;
    }

    to2DY(z3D) {
        return (z3D / this.scale) + this.offsetY;
    }

    initThree() {
        let width = this.container.clientWidth;
        let height = this.container.clientHeight;
        if (!width || width < 100) width = 1024;
        if (!height || height < 100) height = Math.round(width * (520 / 1024));

        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x11161d);
        this.scene.fog = new THREE.FogExp2(0x11161d, 0.012);

        // 2. Camera (리니지 정통 쿼터뷰 & 모바일 최적화 클로즈업 줌)
        const aspect = width / height;
        this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 500);
        this.viewMode = 'quarter'; // 'quarter' | 'closeup'
        this.targetPitch = 48 * (Math.PI / 180);
        this.defaultQuarterDistance = 26; // 기존 46 -> 26으로 기본 줌 대폭 확대 (캐릭터 시인성 1.7배 향상)
        this.defaultCloseupDistance = 16;  // 기존 24 -> 16으로 클로즈업 줌 강화
        this.minDistance = 12;            // 최대 줌인 한계
        this.maxDistance = 55;            // 최대 줌아웃 한계
        this.targetDistance = this.defaultQuarterDistance;
        this.cameraPitch = this.targetPitch;
        this.cameraDistance = this.targetDistance;
        this.updateCameraPosition(240, 360);

        // 3. WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        this.renderer.domElement.id = 'lineage3DCanvas';
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.outline = 'none';

        this.container.appendChild(this.renderer.domElement);

        // 4. Lighting System
        this.ambientLight = new THREE.AmbientLight(0xd0e0ff, 0.55);
        this.scene.add(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d3122, 0.45);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfff4d6, 1.25);
        this.sunLight.position.set(30, 65, 45);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 160;
        this.sunLight.shadow.camera.left = -55;
        this.sunLight.shadow.camera.right = 55;
        this.sunLight.shadow.camera.top = 45;
        this.sunLight.shadow.camera.bottom = -45;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);

        // 횃불 포인트 라이트
        this.torchLight1 = new THREE.PointLight(0xff9933, 1.8, 22, 1.8);
        this.torchLight1.position.set(this.to3DX(420), 4.5, this.to3DZ(160));
        this.scene.add(this.torchLight1);

        this.torchLight2 = new THREE.PointLight(0xff9933, 1.8, 22, 1.8);
        this.torchLight2.position.set(this.to3DX(420), 4.5, this.to3DZ(360));
        this.scene.add(this.torchLight2);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (!width || !height) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // 줌 인 (화면 확대)
    zoomIn(step = 3) {
        this.targetDistance = Math.max(this.minDistance, this.targetDistance - step);
        const percent = Math.round((this.defaultQuarterDistance / this.targetDistance) * 100);
        this.engine.addLog("시점", `화면 확대 [줌 ${percent}%]`);
    }

    // 줌 아웃 (화면 축소)
    zoomOut(step = 3) {
        this.targetDistance = Math.min(this.maxDistance, this.targetDistance + step);
        const percent = Math.round((this.defaultQuarterDistance / this.targetDistance) * 100);
        this.engine.addLog("시점", `화면 축소 [줌 ${percent}%]`);
    }

    // 줌 리셋 (기본 거리 복원)
    resetZoom() {
        this.targetDistance = this.viewMode === 'closeup' ? this.defaultCloseupDistance : this.defaultQuarterDistance;
        this.engine.addLog("시점", "카메라 줌이 기본 크기로 복원되었습니다.");
    }

    toggleViewMode() {
        if (this.viewMode === 'quarter') {
            this.viewMode = 'closeup';
            this.targetPitch = 30 * (Math.PI / 180);
            this.targetDistance = this.defaultCloseupDistance;
            return '클로즈업 뷰';
        } else {
            this.viewMode = 'quarter';
            this.targetPitch = 48 * (Math.PI / 180);
            this.targetDistance = this.defaultQuarterDistance;
            return '쿼터뷰';
        }
    }

    updateCameraPosition(targetX, targetY) {
        this.cameraPitch += (this.targetPitch - this.cameraPitch) * 0.1;
        this.cameraDistance += (this.targetDistance - this.cameraDistance) * 0.1;

        const x3D = this.to3DX(targetX);
        const z3D = this.to3DZ(targetY);

        const camHeight = Math.sin(this.cameraPitch) * this.cameraDistance;
        const camBack = Math.cos(this.cameraPitch) * this.cameraDistance;

        this.camera.position.set(x3D, camHeight, z3D + camBack);
        this.camera.lookAt(x3D, 1.4, z3D - 1.6);
    }

    createProceduralCanvas(w, h, drawFn) {
        const cvs = document.createElement('canvas');
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext('2d');
        drawFn(ctx, w, h);
        const tex = new THREE.CanvasTexture(cvs);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    buildEnvironment() {
        // 섹터별 지면 텍스처 미리 생성
        // 1. 마을 석재 바닥
        this.texVillage = this.createProceduralCanvas(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#2c3539';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#1a1f24';
            ctx.lineWidth = 3;
            const tileSize = 64;
            for (let x = 0; x < w; x += tileSize) {
                for (let y = 0; y < h; y += tileSize) {
                    ctx.fillStyle = (Math.random() > 0.5) ? '#38444d' : '#2f3b42';
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                    ctx.strokeRect(x, y, tileSize, tileSize);
                }
            }
        });
        this.texVillage.repeat.set(8, 5);

        // 2. 숲 풀밭
        this.texForest = this.createProceduralCanvas(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#1e3a1e';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 3000; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#284e28' : '#142a14';
                ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
            }
        });
        this.texForest.repeat.set(8, 5);

        // 3. 개미굴 어두운 암석
        this.texCave = this.createProceduralCanvas(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#261528';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 3500; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#3b1d3d' : '#180d1a';
                ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
            }
        });
        this.texCave.repeat.set(8, 5);

        // 4. 성채 폐허 흑요석 및 용암 균열
        this.texRuins = this.createProceduralCanvas(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#18181b';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.moveTo(Math.random() * w, Math.random() * h);
                ctx.lineTo(Math.random() * w, Math.random() * h);
                ctx.stroke();
            }
        });
        this.texRuins.repeat.set(8, 5);

        // 메인 통합 지면
        const totalW = 1024 * this.scale;
        const totalH = 520 * this.scale;
        const groundGeo = new THREE.BoxGeometry(totalW, 0.6, totalH);
        this.groundMat = new THREE.MeshStandardMaterial({
            map: this.texVillage,
            roughness: 0.85,
            metalness: 0.1
        });
        this.mainGround = new THREE.Mesh(groundGeo, this.groundMat);
        this.mainGround.position.set(0, -0.3, 0);
        this.mainGround.receiveShadow = true;
        this.scene.add(this.mainGround);

        // 환경 프롭 그룹들
        this.propsGroup = new THREE.Group();
        this.scene.add(this.propsGroup);

        this.buildSectorProps('village');

        // 바닥 클릭 감지용 투명 평면
        const hitPlaneGeo = new THREE.PlaneGeometry(150, 100);
        const hitPlaneMat = new THREE.MeshBasicMaterial({ visible: false });
        this.raycastPlane = new THREE.Mesh(hitPlaneGeo, hitPlaneMat);
        this.raycastPlane.rotation.x = -Math.PI / 2;
        this.raycastPlane.position.y = 0;
        this.scene.add(this.raycastPlane);
    }

    // 섹터 테마에 따른 지형 텍스처, 조명, 환경 소품 동적 교체
    switchSectorTheme(sectorData) {
        const theme = sectorData.theme || 'village';

        // 1. 배경 및 안개 색상
        const fogCol = sectorData.fogColor || 0x11161d;
        this.scene.background.setHex(fogCol);
        this.scene.fog.color.setHex(fogCol);

        // 2. 환경광 색상
        const ambCol = sectorData.ambientColor || 0xd0e0ff;
        this.ambientLight.color.setHex(ambCol);

        // 3. 지면 재질 변경
        if (theme === 'village') this.groundMat.map = this.texVillage;
        else if (theme === 'forest') this.groundMat.map = this.texForest;
        else if (theme === 'cave') this.groundMat.map = this.texCave;
        else if (theme === 'ruins') this.groundMat.map = this.texRuins;
        this.groundMat.needsUpdate = true;

        // 4. 소품 재배치
        this.buildSectorProps(theme);
    }

    buildSectorProps(theme) {
        // 기존 소품 모두 제거
        while (this.propsGroup.children.length > 0) {
            this.propsGroup.remove(this.propsGroup.children[0]);
        }

        if (theme === 'village') {
            // 마을 분수대
            const fountain = new THREE.Group();
            const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 }));
            basin.position.y = 0.4;
            basin.castShadow = true;
            basin.receiveShadow = true;
            fountain.add(basin);

            const water = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.6 }));
            water.position.y = 0.75;
            fountain.add(water);

            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2.2, 12), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 }));
            pillar.position.y = 1.4;
            pillar.castShadow = true;
            fountain.add(pillar);

            fountain.position.set(this.to3DX(240), 0, this.to3DZ(360));
            this.propsGroup.add(fountain);

            // 오크통들
            const addBarrel = (x, z) => {
                const b = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 1.6, 10), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 }));
                b.position.set(this.to3DX(x), 0.8, this.to3DZ(z));
                b.castShadow = true;
                b.receiveShadow = true;
                this.propsGroup.add(b);
            };
            addBarrel(110, 410);
            addBarrel(122, 420);
            addBarrel(170, 460);

            // 마을 수련장 목조 울타리
            const fenceMat = new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.9 });
            for (let x = 140; x <= 360; x += 40) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 0.35), fenceMat);
                post.position.set(this.to3DX(x), 0.9, this.to3DZ(170));
                post.castShadow = true;
                this.propsGroup.add(post);
            }
        } else if (theme === 'forest') {
            // 소나무와 야생 바위들
            const createTree = (x, z, scale = 1.0) => {
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * scale, 0.6 * scale, 3.2 * scale, 8), new THREE.MeshStandardMaterial({ color: 0x422006, roughness: 0.9 }));
                trunk.position.y = 1.6 * scale;
                trunk.castShadow = true;
                tree.add(trunk);

                const leafMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
                const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.4 * scale, 3.0 * scale, 8), leafMat);
                c1.position.y = 3.6 * scale;
                c1.castShadow = true;
                tree.add(c1);

                const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.8 * scale, 2.6 * scale, 8), leafMat);
                c2.position.y = 5.2 * scale;
                c2.castShadow = true;
                tree.add(c2);

                tree.position.set(this.to3DX(x), 0, this.to3DZ(z));
                return tree;
            };

            const createRock = (x, z, s = 1.5) => {
                const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 }));
                r.scale.set(s, s * 0.8, s);
                r.position.set(this.to3DX(x), 0.5 * s, this.to3DZ(z));
                r.castShadow = true;
                r.receiveShadow = true;
                return r;
            };

            this.propsGroup.add(createTree(120, 100, 1.3));
            this.propsGroup.add(createTree(260, 420, 1.1));
            this.propsGroup.add(createTree(450, 90, 1.4));
            this.propsGroup.add(createTree(700, 70, 1.2));
            this.propsGroup.add(createTree(880, 460, 1.3));

            this.propsGroup.add(createRock(340, 260, 1.8));
            this.propsGroup.add(createRock(600, 320, 2.2));
            this.propsGroup.add(createRock(780, 160, 1.6));
        } else if (theme === 'cave') {
            // 동굴 종유석 및 보랏빛 수정 기둥
            const createCrystal = (x, z, color = 0xa855f7) => {
                const cGeo = new THREE.ConeGeometry(0.8, 3.8, 6);
                const cMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.8 });
                const crystal = new THREE.Mesh(cGeo, cMat);
                crystal.position.set(this.to3DX(x), 1.9, this.to3DZ(z));
                crystal.castShadow = true;
                return crystal;
            };

            this.propsGroup.add(createCrystal(140, 120, 0x9333ea));
            this.propsGroup.add(createCrystal(360, 420, 0xec4899));
            this.propsGroup.add(createCrystal(520, 100, 0x9333ea));
            this.propsGroup.add(createCrystal(740, 390, 0xc084fc));
        } else if (theme === 'ruins') {
            // 성채 폐허 기둥과 불타는 화로 제단
            const createRuinPillar = (x, z) => {
                const pillar = new THREE.Group();
                const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 4.2, 8), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 }));
                p.position.y = 2.1;
                p.castShadow = true;
                pillar.add(p);

                const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
                brazier.position.y = 4.4;
                pillar.add(brazier);

                pillar.position.set(this.to3DX(x), 0, this.to3DZ(z));
                return pillar;
            };

            this.propsGroup.add(createRuinPillar(160, 140));
            this.propsGroup.add(createRuinPillar(160, 380));
            this.propsGroup.add(createRuinPillar(620, 100));
            this.propsGroup.add(createRuinPillar(620, 420));
        }
    }

    // ==========================================
    // 3D 차원 이동 마법진 포탈 (Portal)
    // ==========================================
    setPortalActive(active, x = 880, y = 260, label = "다음 구역") {
        if (!active) {
            if (this.portalMesh) {
                this.scene.remove(this.portalMesh);
                this.portalMesh = null;
            }
            return;
        }

        if (this.portalMesh) this.scene.remove(this.portalMesh);

        const group = new THREE.Group();

        // 1. 회전하는 황금빛/푸른빛 마법진 링
        const ringGeo = new THREE.RingGeometry(1.6, 2.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        group.add(ring);
        group.ring = ring;

        // 2. 반투명 빛기둥 (Light Beam)
        const beamGeo = new THREE.CylinderGeometry(1.5, 1.8, 6.0, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x0284c7,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 3.0;
        group.add(beam);
        group.beam = beam;

        // 3. 중심 회전 룬 코어
        const coreGeo = new THREE.OctahedronGeometry(0.7, 0);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 2.4;
        group.add(core);
        group.core = core;

        // 포탈 라벨
        const labelSprite = this.createNameplateTexture(`▶ ${label} 이동 포탈 ◀`, "차원 이동 마법진", "#facc15");
        labelSprite.position.y = 5.6;
        group.add(labelSprite);

        group.position.set(this.to3DX(x), 0, this.to3DZ(y));
        this.scene.add(group);
        this.portalMesh = group;
    }

    // ==========================================
    // 캐릭터 & 몬스터 3D 모델 빌더
    // ==========================================

    // ==========================================
    // 캐릭터 & 몬스터 정밀 3D 절차적 텍스처 캐시
    // ==========================================
    getKnightShieldTexture() {
        if (this._texKnightShield) return this._texKnightShield;
        this._texKnightShield = this.createProceduralCanvas(256, 384, (ctx, w, h) => {
            // 1. 방패 바탕 (상하 분할: 상단 로얄블루, 하단 버건디 레드)
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#1e3a8a');
            grad.addColorStop(0.48, '#172554');
            grad.addColorStop(0.52, '#7f1d1d');
            grad.addColorStop(1, '#450a0a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // 2. 외부 황금 테두리 프레임
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 14;
            ctx.strokeRect(7, 7, w - 14, h - 14);

            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 4;
            ctx.strokeRect(16, 16, w - 32, h - 32);

            // 3. 중앙 황금 십자가 및 문양
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(w / 2 - 14, 25, 28, h - 50);
            ctx.fillRect(25, h * 0.35 - 14, w - 50, 28);

            // 중앙 다이아몬드 보석 문양
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(w / 2, h * 0.35 - 28);
            ctx.lineTo(w / 2 + 26, h * 0.35);
            ctx.lineTo(w / 2, h * 0.35 + 28);
            ctx.lineTo(w / 2 - 26, h * 0.35);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 3;
            ctx.stroke();

            // 4. 모서리 황금 리벳 징
            ctx.fillStyle = '#fef08a';
            const rivets = [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12], [12, h / 2], [w - 12, h / 2]];
            rivets.forEach(([rx, ry]) => {
                ctx.beginPath();
                ctx.arc(rx, ry, 5, 0, Math.PI * 2);
                ctx.fill();
            });
        });
        return this._texKnightShield;
    }

    getKnightChestTexture() {
        if (this._texKnightChest) return this._texKnightChest;
        this._texKnightChest = this.createProceduralCanvas(256, 256, (ctx, w, h) => {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#94a3b8');
            grad.addColorStop(0.5, '#cbd5e1');
            grad.addColorStop(1, '#64748b');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // 흉부 중심선 음영
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(w / 2, 20);
            ctx.lineTo(w / 2, h - 20);
            ctx.stroke();

            // 가슴 황금 엠블럼 (왕실 휘장)
            ctx.fillStyle = '#d97706';
            ctx.beginPath();
            ctx.arc(w / 2, 75, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(w / 2, 75, 20, 0, Math.PI * 2);
            ctx.fill();

            // 하단 복부 판금 분할선 및 리벳
            for (let y = 140; y < h - 20; y += 32) {
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(30, y);
                ctx.lineTo(w - 30, y);
                ctx.stroke();

                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(45, y, 4, 0, Math.PI * 2);
                ctx.arc(w - 45, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        return this._texKnightChest;
    }

    getKnightCapeTexture() {
        if (this._texKnightCape) return this._texKnightCape;
        this._texKnightCape = this.createProceduralCanvas(128, 256, (ctx, w, h) => {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#b91c1c');
            grad.addColorStop(0.6, '#991b1b');
            grad.addColorStop(1, '#450a0a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // 주름 음영 세로줄
            for (let x = 16; x < w; x += 22) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                ctx.fillRect(x, 10, 8, h - 20);
            }

            // 테두리 황금 자수
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, w - 6, h - 6);
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2;
            ctx.strokeRect(8, 8, w - 16, h - 16);
        });
        return this._texKnightCape;
    }

    getSwordRuneTexture() {
        if (this._texSwordRune) return this._texSwordRune;
        this._texSwordRune = this.createProceduralCanvas(64, 256, (ctx, w, h) => {
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(0, 0, w, h);

            // 중심 혈조 (Fuller)
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(w / 2 - 4, 15, 8, h - 30);

            // 푸른빛 룬 문자 각인
            ctx.fillStyle = '#0284c7';
            for (let y = 35; y < h - 35; y += 30) {
                ctx.beginPath();
                ctx.arc(w / 2, y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        return this._texSwordRune;
    }

    getDeathKnightCapeTexture() {
        if (this._texDeathKnightCape) return this._texDeathKnightCape;
        this._texDeathKnightCape = this.createProceduralCanvas(128, 256, (ctx, w, h) => {
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 3;
            for (let y = 10; y < h; y += 20) {
                ctx.beginPath();
                ctx.moveTo(Math.random() * w, y);
                ctx.lineTo(Math.random() * w, y + 15);
                ctx.stroke();
            }
        });
        return this._texDeathKnightCape;
    }

    // ==========================================
    // 캐릭터 & 몬스터 3D 모델 빌더
    // ==========================================

    // 1. 클래식 명품 기사 (Knight - 데포로쥬 왕자)
    createKnightMesh() {
        const root = new THREE.Group();

        // 머티리얼 구성
        const plateMat = new THREE.MeshStandardMaterial({
            color: 0xc8d0db,
            metalness: 0.9,
            roughness: 0.22
        });
        const chestPlateMat = new THREE.MeshStandardMaterial({
            map: this.getKnightChestTexture(),
            metalness: 0.88,
            roughness: 0.24
        });
        const goldTrimMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.92,
            roughness: 0.18
        });
        const leatherMat = new THREE.MeshStandardMaterial({
            color: 0x27272a,
            roughness: 0.85
        });
        const shieldFaceMat = new THREE.MeshStandardMaterial({
            map: this.getKnightShieldTexture(),
            metalness: 0.65,
            roughness: 0.35
        });
        const swordBladeMat = new THREE.MeshStandardMaterial({
            map: this.getSwordRuneTexture(),
            metalness: 0.95,
            roughness: 0.12
        });
        const capeMat = new THREE.MeshStandardMaterial({
            map: this.getKnightCapeTexture(),
            roughness: 0.75,
            side: THREE.DoubleSide
        });

        // 상체 컨테이너 (바운스 애니메이션 지원)
        const bodyGroup = new THREE.Group();
        root.add(bodyGroup);
        root.bodyGroup = bodyGroup;

        // 1-1. 흉갑 (Cuirass) & 목 보호대 (Gorget)
        const chestUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.58, 1.0, 10), chestPlateMat);
        chestUpper.position.y = 2.15;
        chestUpper.castShadow = true;
        bodyGroup.add(chestUpper);

        const chestLower = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.52, 0.6, 10), plateMat);
        chestLower.position.y = 1.65;
        chestLower.castShadow = true;
        bodyGroup.add(chestLower);

        const gorget = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 16), goldTrimMat);
        gorget.position.set(0, 2.7, 0);
        gorget.rotation.x = Math.PI / 2;
        bodyGroup.add(gorget);

        // 허리 벨트 & 버클
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 12), leatherMat);
        belt.position.y = 1.35;
        bodyGroup.add(belt);

        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.26), goldTrimMat);
        buckle.position.set(0, 1.35, 0.55);
        bodyGroup.add(buckle);

        // 대퇴부 장갑판 (Faulds & Tassets)
        const lTasset = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.08), goldTrimMat);
        lTasset.position.set(-0.35, 1.15, 0.48);
        lTasset.rotation.x = 0.2;
        bodyGroup.add(lTasset);

        const rTasset = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.08), goldTrimMat);
        rTasset.position.set(0.35, 1.15, 0.48);
        rTasset.rotation.x = 0.2;
        bodyGroup.add(rTasset);

        // 1-2. 투구 (Great Helm with Visor & Plume)
        const helmGroup = new THREE.Group();
        const helmBase = new THREE.Mesh(new THREE.DodecahedronGeometry(0.54, 1), plateMat);
        helmBase.position.y = 3.25;
        helmBase.castShadow = true;
        helmGroup.add(helmBase);

        // T-자형 황금 십자군 바이저
        const visorCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.14), goldTrimMat);
        visorCrossV.position.set(0, 3.25, 0.52);
        helmGroup.add(visorCrossV);

        const visorCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.14), goldTrimMat);
        visorCrossH.position.set(0, 3.32, 0.5);
        helmGroup.add(visorCrossH);

        // 눈 슬릿 (검은색 틈새)
        const slitMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
        const lEyeSlit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.05), slitMat);
        lEyeSlit.position.set(-0.18, 3.32, 0.57);
        helmGroup.add(lEyeSlit);
        const rEyeSlit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.05), slitMat);
        rEyeSlit.position.set(0.18, 3.32, 0.57);
        helmGroup.add(rEyeSlit);

        // 헬멧 상단 3중 깃털 (Royal Plumes)
        const plumeMat1 = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
        const plumeMat2 = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
        const p1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 6), plumeMat1);
        p1.position.set(0, 3.9, -0.2);
        p1.rotation.x = -0.35;
        helmGroup.add(p1);

        const p2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.75, 6), plumeMat2);
        p2.position.set(-0.12, 3.82, -0.22);
        p2.rotation.x = -0.4;
        p2.rotation.z = -0.15;
        helmGroup.add(p2);

        const p3 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.75, 6), plumeMat2);
        p3.position.set(0.12, 3.82, -0.22);
        p3.rotation.x = -0.4;
        p3.rotation.z = 0.15;
        helmGroup.add(p3);

        bodyGroup.add(helmGroup);

        // 1-3. 3단 레이어드 견갑 (Pauldrons)
        const createPauldron = (side) => {
            const pGroup = new THREE.Group();
            const top = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), goldTrimMat);
            top.scale.set(1.1, 0.7, 0.9);
            top.castShadow = true;
            pGroup.add(top);

            const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.25, 8), plateMat);
            mid.position.y = -0.22;
            pGroup.add(mid);

            const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.22, 8), goldTrimMat);
            bot.position.y = -0.4;
            pGroup.add(bot);

            pGroup.position.set(side * 0.98, 2.45, 0);
            return pGroup;
        };
        bodyGroup.add(createPauldron(-1));
        bodyGroup.add(createPauldron(1));

        // 1-4. 왼팔 & 카이트 실드 (Left Arm & Shield)
        const leftArm = new THREE.Group();
        leftArm.position.set(-0.85, 2.3, 0);

        const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.65, 8), plateMat);
        lUpperArm.position.y = -0.32;
        leftArm.add(lUpperArm);

        const lElbow = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), goldTrimMat);
        lElbow.position.y = -0.65;
        leftArm.add(lElbow);

        const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.6, 8), plateMat);
        lForearm.position.set(0, -0.95, 0.15);
        lForearm.rotation.x = Math.PI / 4;
        leftArm.add(lForearm);

        // 명품 카이트 실드 (Kite Shield)
        const shieldGroup = new THREE.Group();
        const sFace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.25), shieldFaceMat);
        sFace.castShadow = true;
        shieldGroup.add(sFace);

        // 방패 테두리 프레임
        const sBorder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.86, 1.3), goldTrimMat);
        sBorder.scale.set(0.9, 0.95, 0.95);
        shieldGroup.add(sBorder);

        // 중앙 볼록 황금 스파이크 보스 (Shield Boss)
        const sBoss = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 8), goldTrimMat);
        sBoss.rotation.z = -Math.PI / 2;
        sBoss.position.set(-0.16, 0.2, 0);
        shieldGroup.add(sBoss);

        shieldGroup.position.set(-0.25, -0.9, 0.38);
        leftArm.add(shieldGroup);
        bodyGroup.add(leftArm);
        root.leftArm = leftArm;

        // 1-5. 오른팔 & 명검 싸울아비 장검 (Right Arm & Sword)
        const rightArm = new THREE.Group();
        rightArm.position.set(0.85, 2.3, 0);

        const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.65, 8), plateMat);
        rUpperArm.position.y = -0.32;
        rightArm.add(rUpperArm);

        const rElbow = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), goldTrimMat);
        rElbow.position.y = -0.65;
        rightArm.add(rElbow);

        const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.6, 8), plateMat);
        rForearm.position.set(0, -0.95, 0.15);
        rForearm.rotation.x = Math.PI / 4;
        rightArm.add(rForearm);

        // 명품 싸울아비 장검 (Saulabi Longsword)
        const swordGroup = new THREE.Group();

        // 날렵한 양날 칼날 (Diamond Blade)
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.5, 0.42), swordBladeMat);
        blade.position.y = 1.35;
        blade.castShadow = true;
        swordGroup.add(blade);

        // 칼끝 뾰족한 칼날 팁
        const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), swordBladeMat);
        bladeTip.position.y = 2.75;
        bladeTip.rotation.y = Math.PI / 4;
        swordGroup.add(bladeTip);

        // 황금 독수리 날개 크로스가드
        const guardCenter = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 1.05), goldTrimMat);
        guardCenter.position.y = 0.08;
        swordGroup.add(guardCenter);

        // 가드 중앙 루비 보석
        const ruby = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.1 }));
        ruby.position.set(0.14, 0.08, 0);
        swordGroup.add(ruby);

        // 가죽 감긴 힐트 (손잡이)
        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.72, 8), leatherMat);
        hilt.position.y = -0.38;
        swordGroup.add(hilt);

        // 황금 팔각 폼멜
        const pommel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16), goldTrimMat);
        pommel.position.y = -0.78;
        swordGroup.add(pommel);

        // 은은한 인챈트 룬 오라 (포인트 라이트)
        const runeGlow = new THREE.PointLight(0x38bdf8, 1.2, 5, 2);
        runeGlow.position.set(0, 1.2, 0);
        swordGroup.add(runeGlow);

        swordGroup.position.set(0, -1.15, 0.4);
        swordGroup.rotation.x = Math.PI / 4;
        rightArm.add(swordGroup);
        bodyGroup.add(rightArm);
        root.rightArm = rightArm;
        root.swordMesh = swordGroup;

        // 1-6. 붉은기사단 왕실 망토 (Royal Cloak)
        const cape = new THREE.Mesh(new THREE.BoxGeometry(1.48, 2.3, 0.08), capeMat);
        cape.position.set(0, 1.6, -0.62);
        cape.rotation.x = 0.15;
        cape.castShadow = true;
        bodyGroup.add(cape);
        root.cape = cape;

        // 1-7. 강철 판금 다리 & 기사 부츠 (Greaves & Sabatons)
        const createLeg = (side) => {
            const leg = new THREE.Group();
            leg.position.set(side * 0.36, 1.2, 0);

            // 허벅지 (Cuisses)
            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.65, 8), plateMat);
            thigh.position.y = -0.32;
            thigh.castShadow = true;
            leg.add(thigh);

            // 무릎 보호대 (Poleyn with Gold Rivet)
            const knee = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 8), goldTrimMat);
            knee.position.set(0, -0.65, 0.08);
            knee.castShadow = true;
            leg.add(knee);

            // 정강이 (Greaves)
            const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.6, 8), plateMat);
            calf.position.y = -0.98;
            calf.castShadow = true;
            leg.add(calf);

            // 기사 사바톤 부츠 (Sabatons)
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.52), goldTrimMat);
            foot.position.set(0, -1.32, 0.12);
            foot.castShadow = true;
            leg.add(foot);

            return leg;
        };

        const leftLeg = createLeg(-1);
        const rightLeg = createLeg(1);
        root.add(leftLeg);
        root.add(rightLeg);
        root.leftLeg = leftLeg;
        root.rightLeg = rightLeg;

        return root;
    }

    // 2. 52LV 전설의 데스나이트 (플레이어 변신용 - Dark Knight of Legend)
    createDeathKnightMesh() {
        const root = new THREE.Group();

        const obsidianMat = new THREE.MeshStandardMaterial({
            color: 0x11161d,
            metalness: 0.95,
            roughness: 0.18
        });
        const darkGoldMat = new THREE.MeshStandardMaterial({
            color: 0xb45309,
            metalness: 0.9,
            roughness: 0.25
        });
        const capeMat = new THREE.MeshStandardMaterial({
            map: this.getDeathKnightCapeTexture(),
            roughness: 0.85,
            side: THREE.DoubleSide
        });

        const bodyGroup = new THREE.Group();
        root.add(bodyGroup);
        root.bodyGroup = bodyGroup;

        // 흉갑
        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.58, 1.55, 10), obsidianMat);
        chest.position.y = 2.15;
        chest.castShadow = true;
        bodyGroup.add(chest);

        // 어깨 악마 스파이크 (Fiend Spikes)
        const lSpike = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.0, 6), darkGoldMat);
        lSpike.position.set(-1.08, 2.75, 0);
        lSpike.rotation.z = 0.55;
        lSpike.castShadow = true;
        bodyGroup.add(lSpike);

        const rSpike = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.0, 6), darkGoldMat);
        rSpike.position.set(1.08, 2.75, 0);
        rSpike.rotation.z = -0.55;
        rSpike.castShadow = true;
        bodyGroup.add(rSpike);

        // 해골 투구 & 거대한 악마의 뿔 2쌍
        const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 1), obsidianMat);
        skull.position.y = 3.35;
        skull.castShadow = true;
        bodyGroup.add(skull);

        // 주 뿔
        const lHorn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95, 6), darkGoldMat);
        lHorn.position.set(-0.45, 3.9, 0);
        lHorn.rotation.z = 0.45;
        bodyGroup.add(lHorn);

        const rHorn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95, 6), darkGoldMat);
        rHorn.position.set(0.45, 3.9, 0);
        rHorn.rotation.z = -0.45;
        bodyGroup.add(rHorn);

        // 이글거리는 핏빛 안광 (PointLight 포함)
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), eyeMat);
        lEye.position.set(-0.22, 3.38, 0.52);
        bodyGroup.add(lEye);

        const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), eyeMat);
        rEye.position.set(0.22, 3.38, 0.52);
        bodyGroup.add(rEye);

        const eyeGlow = new THREE.PointLight(0xff0033, 1.5, 6, 2);
        eyeGlow.position.set(0, 3.38, 0.7);
        bodyGroup.add(eyeGlow);

        // 전장의 찢어진 망토
        const cape = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.08), capeMat);
        cape.position.set(0, 1.7, -0.65);
        cape.rotation.x = 0.2;
        cape.castShadow = true;
        bodyGroup.add(cape);
        root.cape = cape;

        // 화염검 (Flaming Sword of Despair)
        const flameSwordGroup = new THREE.Group();
        const flameBlade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.7, 0.48), new THREE.MeshStandardMaterial({
            color: 0xff4500,
            emissive: 0xff2200,
            emissiveIntensity: 0.9,
            roughness: 0.2
        }));
        flameBlade.position.y = 1.35;
        flameBlade.castShadow = true;
        flameSwordGroup.add(flameBlade);

        const flameTip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 4), new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0xff1100,
            emissiveIntensity: 1.0
        }));
        flameTip.position.y = 2.95;
        flameTip.rotation.y = Math.PI / 4;
        flameSwordGroup.add(flameTip);

        const swordLight = new THREE.PointLight(0xff3700, 2.5, 12, 2);
        swordLight.position.set(0, 1.35, 0);
        flameSwordGroup.add(swordLight);

        flameSwordGroup.position.set(1.0, 1.9, 0.45);
        flameSwordGroup.rotation.x = Math.PI / 4;
        bodyGroup.add(flameSwordGroup);
        root.swordMesh = flameSwordGroup;

        // 다리
        const createDLeg = (side) => {
            const leg = new THREE.Group();
            leg.position.set(side * 0.4, 1.25, 0);

            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 0.7, 8), obsidianMat);
            thigh.position.y = -0.35;
            thigh.castShadow = true;
            leg.add(thigh);

            const knee = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), darkGoldMat);
            knee.position.set(0, -0.7, 0.08);
            knee.castShadow = true;
            leg.add(knee);

            const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.65, 8), obsidianMat);
            calf.position.y = -1.05;
            calf.castShadow = true;
            leg.add(calf);

            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.55), darkGoldMat);
            foot.position.set(0, -1.4, 0.12);
            foot.castShadow = true;
            leg.add(foot);

            return leg;
        };

        const leftLeg = createDLeg(-1);
        const rightLeg = createDLeg(1);
        root.add(leftLeg);
        root.add(rightLeg);
        root.leftLeg = leftLeg;
        root.rightLeg = rightLeg;

        return root;
    }

    // 3. 오크 (Orc)
    createOrcMesh() {
        const root = new THREE.Group();
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.85 });
        const leatherMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.1), skinMat);
        body.position.y = 1.8;
        body.castShadow = true;
        root.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), skinMat);
        head.position.set(0, 2.8, 0.15);
        head.castShadow = true;
        root.add(head);

        const club = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.4, 6), leatherMat);
        handle.position.y = 0.7;
        club.add(handle);
        const headClub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.25, 1.2, 8), ironMat);
        headClub.position.y = 1.8;
        headClub.castShadow = true;
        club.add(headClub);
        club.position.set(1.1, 1.5, 0.3);
        club.rotation.x = Math.PI / 6;
        root.add(club);

        const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 1.1, 6), leatherMat);
        lLeg.position.set(-0.45, 0.55, 0);
        lLeg.castShadow = true;
        root.add(lLeg);

        const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 1.1, 6), leatherMat);
        rLeg.position.set(0.45, 0.55, 0);
        rLeg.castShadow = true;
        root.add(rLeg);

        return root;
    }

    // 4. 라이칸스로프 (Lycanthrope)
    createLycanMesh() {
        const root = new THREE.Group();
        const furMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 });
        const darkFurMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 1.2), furMat);
        torso.position.set(0, 1.7, 0);
        torso.rotation.x = 0.3;
        torso.castShadow = true;
        root.add(torso);

        const head = new THREE.Group();
        const skull = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.8), darkFurMat);
        skull.castShadow = true;
        head.add(skull);
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.65), darkFurMat);
        snout.position.set(0, -0.15, 0.65);
        head.add(snout);
        head.position.set(0, 2.6, 0.5);
        root.add(head);

        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.05, 1.4, 6), furMat);
        tail.position.set(0, 1.2, -0.9);
        tail.rotation.x = -0.8;
        root.add(tail);

        const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.5), furMat);
        lLeg.position.set(-0.45, 0.5, -0.3);
        lLeg.castShadow = true;
        root.add(lLeg);

        const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.5), furMat);
        rLeg.position.set(0.45, 0.5, -0.3);
        rLeg.castShadow = true;
        root.add(rLeg);

        return root;
    }

    // 5. 셀로브 (Selolb - 거대 거미)
    createSelolbMesh() {
        const root = new THREE.Group();
        const chitinMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.3, metalness: 0.6 });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

        const abdomen = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10), chitinMat);
        abdomen.scale.set(1.1, 0.8, 1.5);
        abdomen.position.set(0, 1.1, -1.1);
        abdomen.castShadow = true;
        root.add(abdomen);

        const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), blackMat);
        thorax.position.set(0, 0.9, 0.3);
        thorax.castShadow = true;
        root.add(thorax);

        root.legs = [];
        const legGeo = new THREE.CylinderGeometry(0.09, 0.06, 1.8, 5);
        for (let i = 0; i < 8; i++) {
            const side = i < 4 ? -1 : 1;
            const idx = i % 4;
            const leg = new THREE.Mesh(legGeo, blackMat);
            leg.position.set(side * 0.9, 0.6, (idx - 1.5) * 0.6);
            leg.rotation.z = side * 0.7;
            leg.rotation.y = (idx - 1.5) * 0.3;
            leg.castShadow = true;
            root.add(leg);
            root.legs.push(leg);
        }

        return root;
    }

    // 6. [신규] 해골 기사 스켈레톤 (Skeleton)
    createSkeletonMesh() {
        const root = new THREE.Group();
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
        const rustyMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.6, roughness: 0.6 });

        // 늑골 흉곽
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.6), boneMat);
        rib.position.y = 1.9;
        rib.castShadow = true;
        root.add(rib);

        // 해골 머리
        const skull = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), boneMat);
        skull.position.set(0, 2.9, 0.1);
        skull.castShadow = true;
        root.add(skull);

        // 안광
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        eye.position.set(-0.15, 2.9, 0.45);
        root.add(eye);
        const eye2 = eye.clone();
        eye2.position.x = 0.15;
        root.add(eye2);

        // 녹슨 검
        const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.25), rustyMat);
        sword.position.set(0.85, 1.6, 0.3);
        sword.rotation.x = Math.PI / 4;
        sword.castShadow = true;
        root.add(sword);

        // 다리 뼈
        const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 5), boneMat);
        lLeg.position.set(-0.3, 0.6, 0);
        lLeg.castShadow = true;
        root.add(lLeg);

        const rLeg = lLeg.clone();
        rLeg.position.x = 0.3;
        root.add(rLeg);

        return root;
    }

    // 7. [신규] 최종 보스: 타락한 데스나이트 군주 (Boss Death Knight)
    createBossDeathKnightMesh() {
        const base = this.createDeathKnightMesh();
        base.scale.set(1.45, 1.45, 1.45); // 1.45배 거대한 체구

        // 보스 전용 황금 왕관 뿔
        const crownGeo = new THREE.ConeGeometry(0.45, 1.0, 6);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(0, 4.3, 0);
        base.add(crown);

        // 보스 주변 타오르는 화염 아우라 라이트
        const bossLight = new THREE.PointLight(0xef4444, 3.0, 16, 2);
        bossLight.position.set(0, 2.5, 0);
        base.add(bossLight);

        return base;
    }

    // 8. 허수아비 (Dummy)
    createDummyMesh() {
        const root = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const strawMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 });

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 3.2, 8), woodMat);
        post.position.y = 1.6;
        post.castShadow = true;
        root.add(post);

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), woodMat);
        arm.position.y = 2.4;
        arm.rotation.z = Math.PI / 2;
        arm.castShadow = true;
        root.add(arm);

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.4, 8), strawMat);
        body.position.y = 2.0;
        body.castShadow = true;
        root.add(body);

        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 8), strawMat);
        hat.position.y = 3.5;
        hat.rotation.z = 0.15;
        hat.castShadow = true;
        root.add(hat);

        return root;
    }

    // 9. 판도라 (Pandora NPC)
    createPandoraMesh() {
        const root = new THREE.Group();
        const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.8 }));
        table.position.y = 0.55;
        table.castShadow = true;
        table.receiveShadow = true;
        root.add(table);

        const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 }));
        canopy.position.y = 3.6;
        canopy.rotation.y = Math.PI / 4;
        canopy.castShadow = true;
        root.add(canopy);

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.8 }));
        body.position.set(0, 1.3, -0.6);
        body.castShadow = true;
        root.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 }));
        head.position.set(0, 2.3, -0.6);
        root.add(head);

        return root;
    }

    // 10. 드랍 아데나 코인
    createAdenaMesh() {
        const coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15, emissive: 0x854d0e, emissiveIntensity: 0.3 })
        );
        coin.position.y = 0.2;
        coin.castShadow = true;
        return coin;
    }

    // ==========================================
    // 3D 텍스트 및 UI 빌보드
    // ==========================================
    createNameplateTexture(text, subText, color = '#38bdf8') {
        const cvs = document.createElement('canvas');
        cvs.width = 256;
        cvs.height = 80;
        const ctx = cvs.getContext('2d');

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(10, 10, 236, 60, 8);
        } else {
            ctx.rect(10, 10, 236, 60);
        }
        ctx.fill();

        ctx.textAlign = 'center';
        if (subText) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText(subText, 128, 33);
            ctx.fillStyle = color;
            ctx.font = 'bold 21px sans-serif';
            ctx.fillText(text, 128, 57);
        } else {
            ctx.fillStyle = color;
            ctx.font = 'bold 23px sans-serif';
            ctx.fillText(text, 128, 48);
        }

        const tex = new THREE.CanvasTexture(cvs);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(3.2, 1.0, 1);
        return sprite;
    }

    spawnDamageText3D(x, y, text, color = '#ef4444') {
        const cvs = document.createElement('canvas');
        cvs.width = 160;
        cvs.height = 80;
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = color;
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(text, 80, 52);

        const tex = new THREE.CanvasTexture(cvs);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);

        sprite.position.set(this.to3DX(x) + (Math.random() - 0.5) * 1.2, 4.2, this.to3DZ(y));
        sprite.scale.set(2.4, 1.2, 1);
        sprite.vy = 0.06;
        sprite.life = 0.85;

        this.scene.add(sprite);
        this.floatingTexts3D.push(sprite);
    }

    spawnHitSpark3D(x, y, color = 0xfacc15) {
        for (let i = 0; i < 8; i++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 4), new THREE.MeshBasicMaterial({ color: color }));
            p.position.set(this.to3DX(x), 2.2, this.to3DZ(y));
            p.vx = (Math.random() - 0.5) * 0.3;
            p.vy = 0.15 + Math.random() * 0.25;
            p.vz = (Math.random() - 0.5) * 0.3;
            p.life = 0.45;
            this.scene.add(p);
            this.particles3D.push(p);
        }
    }

    spawnClickRing3D(x, y) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.55, 16),
            new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(this.to3DX(x), 0.05, this.to3DZ(y));
        ring.scaleVal = 1.0;
        ring.life = 0.35;
        this.scene.add(ring);
        this.particles3D.push(ring);
    }

    spawnMagicMissile3D(startX, startY, targetEntity) {
        const missile = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.0 })
        );
        missile.position.set(this.to3DX(startX), 2.5, this.to3DZ(startY));
        missile.add(new THREE.PointLight(0x38bdf8, 2.0, 8));
        missile.target = targetEntity;
        missile.speed = 1.6;
        this.scene.add(missile);
        this.magicMissiles.push(missile);
    }

    // ==========================================
    // 3D Raycasting
    // ==========================================
    bindRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mousePos = new THREE.Vector2();

        const triggerActionFromEvent = (clientX, clientY) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mousePos.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            this.mousePos.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mousePos, this.camera);

            // 포탈 클릭 체크
            if (this.portalMesh && this.engine.portalActive) {
                const portalHits = this.raycaster.intersectObjects(this.portalMesh.children, true);
                if (portalHits.length > 0) {
                    this.engine.attemptUsePortal();
                    return;
                }
            }

            // 엔티티 피킹
            const entityHits = [];
            for (const [npcId, mesh] of this.meshes.npcs.entries()) {
                if (mesh.visible) entityHits.push({ mesh, type: 'npc', id: npcId });
            }
            for (const [mRef, mesh] of this.meshes.monsters.entries()) {
                entityHits.push({ mesh, type: 'monster', entity: mRef });
            }
            for (const [dumId, mesh] of this.meshes.dummies.entries()) {
                if (mesh.visible) entityHits.push({ mesh, type: 'dummy', id: dumId });
            }

            for (const item of entityHits) {
                const intersects = this.raycaster.intersectObjects(item.mesh.children, true);
                if (intersects.length > 0) {
                    if (item.type === 'npc') {
                        this.engine.openShopModal();
                        return;
                    } else if (item.type === 'monster') {
                        this.engine.player.targetEntity = item.entity;
                        this.engine.addLog("전투", `${item.entity.name}을(를) 공격 대상으로 지정했습니다.`);
                        return;
                    } else if (item.type === 'dummy') {
                        const d = this.engine.dummies.find(dum => dum.id === item.id);
                        if (d) {
                            this.engine.player.targetEntity = d;
                            this.engine.addLog("전투", `${d.name}을(를) 공격 대상으로 지정했습니다.`);
                        }
                        return;
                    }
                }
            }

            // 바닥 평면 인터섹션
            const groundIntersects = this.raycaster.intersectObject(this.raycastPlane);
            if (groundIntersects.length > 0) {
                const hit = groundIntersects[0].point;
                const gameX = Math.max(30, Math.min(990, this.to2DX(hit.x)));
                const gameY = Math.max(30, Math.min(490, this.to2DY(hit.z)));

                this.engine.player.targetEntity = null;
                this.engine.player.targetX = gameX;
                this.engine.player.targetY = gameY;
                this.spawnClickRing3D(gameX, gameY);
            }
        };

        const canvasEl = this.renderer.domElement;

        // 1. 마우스 조작
        canvasEl.addEventListener('mousedown', (e) => {
            if (e.button === 0) triggerActionFromEvent(e.clientX, e.clientY);
            else if (e.button === 2) {
                e.preventDefault();
                this.engine.useItem('red_potion');
            }
        });

        // 2. PC 마우스 휠 줌 (확대 / 축소)
        canvasEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) this.zoomIn(2.5);
            else this.zoomOut(2.5);
        }, { passive: false });

        // 3. 모바일 터치 및 핀치 투 줌 (Pinch-to-zoom)
        let initialPinchDist = null;
        let startZoomDistance = null;

        canvasEl.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                startZoomDistance = this.targetDistance;
            } else if (e.touches && e.touches.length === 1) {
                initialPinchDist = null;
                e.preventDefault();
                triggerActionFromEvent(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        canvasEl.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches.length === 2 && initialPinchDist && startZoomDistance) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                if (currentDist > 10) {
                    const ratio = currentDist / initialPinchDist;
                    const newDist = startZoomDistance / ratio;
                    this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, newDist));
                }
            }
        }, { passive: false });

        canvasEl.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialPinchDist = null;
                startZoomDistance = null;
            }
        });

        canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ==========================================
    // 실시간 3D 동기화 & 렌더 루프
    // ==========================================
    update(dt) {
        const p = this.engine.player;

        // 1. 플레이어 메시 동기화
        if (!this.meshes.player || this.meshes.player.isPoly !== p.isPolymorphed) {
            if (this.meshes.player) this.scene.remove(this.meshes.player);
            this.meshes.player = p.isPolymorphed ? this.createDeathKnightMesh() : this.createKnightMesh();
            this.meshes.player.isPoly = p.isPolymorphed;

            const pNameplate = this.createNameplateTexture(p.name, `[${p.title}]`, '#38bdf8');
            pNameplate.position.y = 4.8;
            this.meshes.player.add(pNameplate);
            this.scene.add(this.meshes.player);
        }

        const pMesh = this.meshes.player;
        pMesh.position.set(this.to3DX(p.x), 0, this.to3DZ(p.y));

        let targetAngle = 0;
        if (p.targetEntity) {
            targetAngle = Math.atan2(p.targetEntity.x - p.x, p.targetEntity.y - p.y);
        } else {
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            if (Math.hypot(dx, dy) > 2) targetAngle = Math.atan2(dx, dy);
        }
        pMesh.rotation.y = targetAngle;

        const isMoving = Math.hypot(p.targetX - p.x, p.targetY - p.y) > 4;
        const animTime = performance.now() * 0.008;

        if (isMoving) {
            if (pMesh.leftLeg && pMesh.rightLeg) {
                pMesh.leftLeg.rotation.x = Math.sin(animTime) * 0.65;
                pMesh.rightLeg.rotation.x = -Math.sin(animTime) * 0.65;
            }
            if (pMesh.leftArm && pMesh.rightArm && !p.isAttacking) {
                pMesh.leftArm.rotation.x = -Math.sin(animTime) * 0.35;
                pMesh.rightArm.rotation.x = Math.sin(animTime) * 0.35;
            }
            if (pMesh.bodyGroup) {
                pMesh.bodyGroup.position.y = Math.abs(Math.sin(animTime * 2)) * 0.08;
            }
        } else {
            if (pMesh.leftLeg && pMesh.rightLeg) {
                pMesh.leftLeg.rotation.x = 0;
                pMesh.rightLeg.rotation.x = 0;
            }
            if (pMesh.leftArm && pMesh.rightArm && !p.isAttacking) {
                pMesh.leftArm.rotation.x = 0;
                pMesh.rightArm.rotation.x = 0;
            }
            if (pMesh.bodyGroup) {
                pMesh.bodyGroup.position.y = Math.sin(performance.now() * 0.003) * 0.03;
            }
        }

        if (p.isAttacking) {
            const attackSwing = Math.sin(performance.now() * 0.025);
            if (pMesh.rightArm) {
                pMesh.rightArm.rotation.x = (Math.PI / 4) + attackSwing * 0.9;
            }
            if (pMesh.swordMesh) {
                pMesh.swordMesh.rotation.x = (Math.PI / 4) + attackSwing * 0.6;
            }
            if (pMesh.leftArm) {
                pMesh.leftArm.rotation.x = -0.2 + attackSwing * 0.15;
            }
        } else {
            if (pMesh.swordMesh) {
                pMesh.swordMesh.rotation.x = Math.PI / 4;
            }
        }

        if (pMesh.cape) {
            pMesh.cape.rotation.x = 0.18 + (isMoving ? Math.sin(animTime * 1.6) * 0.28 : Math.sin(performance.now() * 0.003) * 0.04);
        }

        this.updateCameraPosition(p.x, p.y);

        // 2. 몬스터 3D 메시 동기화
        const currentMonsters = new Set(this.engine.monsters);
        for (const [mRef, mesh] of this.meshes.monsters.entries()) {
            if (!currentMonsters.has(mRef) || mRef.hp <= 0) {
                this.scene.remove(mesh);
                this.meshes.monsters.delete(mRef);
            }
        }

        for (const m of this.engine.monsters) {
            if (m.hp <= 0) continue;
            let mMesh = this.meshes.monsters.get(m);
            if (!mMesh) {
                if (m.type === 'orc') mMesh = this.createOrcMesh();
                else if (m.type === 'lycanthrope') mMesh = this.createLycanMesh();
                else if (m.type === 'selolb') mMesh = this.createSelolbMesh();
                else if (m.type === 'skeleton') mMesh = this.createSkeletonMesh();
                else if (m.type === 'boss_deathknight') mMesh = this.createBossDeathKnightMesh();
                else mMesh = this.createOrcMesh();

                const isBoss = m.type === 'boss_deathknight';
                const nameplate = this.createNameplateTexture(m.name, isBoss ? "★ [BOSS] 최종 군주 ★" : null, isBoss ? '#fde047' : '#fca5a5');
                nameplate.position.y = isBoss ? 5.8 : 4.2;
                mMesh.add(nameplate);

                this.scene.add(mMesh);
                this.meshes.monsters.set(m, mMesh);
            }

            mMesh.position.set(this.to3DX(m.x), 0, this.to3DZ(m.y));
            mMesh.rotation.y = Math.atan2(p.x - m.x, p.y - m.y);

            if (mMesh.legs) {
                mMesh.legs.forEach((leg, idx) => {
                    leg.rotation.x = Math.sin(animTime * 1.5 + idx) * 0.3;
                });
            }
        }

        // 3. 허수아비 동기화 (마을 섹터에서만 보임)
        const inVillage = this.engine.currentSector === 0;
        for (const dum of this.engine.dummies) {
            let dMesh = this.meshes.dummies.get(dum.id);
            if (!dMesh) {
                dMesh = this.createDummyMesh();
                dMesh.position.set(this.to3DX(dum.x), 0, this.to3DZ(dum.y));
                const dNameplate = this.createNameplateTexture(dum.name, null, '#fbbf24');
                dNameplate.position.y = 4.3;
                dMesh.add(dNameplate);
                this.scene.add(dMesh);
                this.meshes.dummies.set(dum.id, dMesh);
            }
            dMesh.visible = inVillage;
            if (inVillage && p.targetEntity === dum && p.isAttacking) {
                dMesh.rotation.z = Math.sin(performance.now() * 0.03) * 0.12;
            } else {
                dMesh.rotation.z = 0;
            }
        }

        // 4. NPC 판도라 동기화 (마을 섹터에서만 보임)
        for (const npc of this.engine.npcs) {
            let nMesh = this.meshes.npcs.get(npc.id);
            if (!nMesh) {
                nMesh = this.createPandoraMesh();
                nMesh.position.set(this.to3DX(npc.x), 0, this.to3DZ(npc.y));
                const nNameplate = this.createNameplateTexture(npc.name, null, '#4ade80');
                nNameplate.position.y = 4.6;
                nMesh.add(nNameplate);
                this.scene.add(nMesh);
                this.meshes.npcs.set(npc.id, nMesh);
            }
            nMesh.visible = inVillage;
        }

        // 5. 드랍 아데나 동기화
        const currentDrops = new Set(this.engine.drops);
        for (const [dRef, mesh] of this.meshes.drops.entries()) {
            if (!currentDrops.has(dRef)) {
                this.scene.remove(mesh);
                this.meshes.drops.delete(dRef);
            }
        }

        for (const drop of this.engine.drops) {
            let dMesh = this.meshes.drops.get(drop);
            if (!dMesh) {
                dMesh = this.createAdenaMesh();
                this.scene.add(dMesh);
                this.meshes.drops.set(drop, dMesh);
            }
            dMesh.position.set(this.to3DX(drop.x), 0.25, this.to3DZ(drop.y));
            dMesh.rotation.y += 0.05;
        }

        // 6. 포탈 회전 애니메이션
        if (this.portalMesh) {
            if (this.portalMesh.ring) this.portalMesh.ring.rotation.z += 0.02;
            if (this.portalMesh.core) {
                this.portalMesh.core.rotation.y += 0.03;
                this.portalMesh.core.rotation.x += 0.01;
            }
        }

        // 7. 3D 플로팅 텍스트 업데이트
        for (let i = this.floatingTexts3D.length - 1; i >= 0; i--) {
            const txt = this.floatingTexts3D[i];
            txt.position.y += txt.vy;
            txt.life -= dt;
            txt.material.opacity = Math.max(0, txt.life / 0.85);
            if (txt.life <= 0) {
                this.scene.remove(txt);
                this.floatingTexts3D.splice(i, 1);
            }
        }

        // 8. 3D 파티클 업데이트
        for (let i = this.particles3D.length - 1; i >= 0; i--) {
            const pt = this.particles3D[i];
            pt.life -= dt;
            if (pt.scaleVal !== undefined) {
                pt.scaleVal += 3.5 * dt;
                pt.scale.set(pt.scaleVal, pt.scaleVal, 1);
                pt.material.opacity = Math.max(0, pt.life / 0.35);
            } else {
                pt.position.x += pt.vx;
                pt.position.y += pt.vy;
                pt.position.z += pt.vz;
                pt.vy -= 0.01;
            }
            if (pt.life <= 0) {
                this.scene.remove(pt);
                this.particles3D.splice(i, 1);
            }
        }

        // 9. 3D 마법 투사체 업데이트
        for (let i = this.magicMissiles.length - 1; i >= 0; i--) {
            const m = this.magicMissiles[i];
            const targetX = this.to3DX(m.target.x);
            const targetZ = this.to3DZ(m.target.y);
            const dx = targetX - m.position.x;
            const dz = targetZ - m.position.z;
            const dist = Math.hypot(dx, dz);

            if (dist < 1.0) {
                this.spawnHitSpark3D(m.target.x, m.target.y, 0x38bdf8);
                this.scene.remove(m);
                this.magicMissiles.splice(i, 1);
            } else {
                m.position.x += (dx / dist) * m.speed;
                m.position.z += (dz / dist) * m.speed;
            }
        }

        // 10. 조명 깜빡임
        const flicker = 1.6 + Math.sin(performance.now() * 0.015) * 0.35;
        this.torchLight1.intensity = flicker;
        this.torchLight2.intensity = flicker;

        this.renderer.render(this.scene, this.camera);
    }
}

window.Lineage3D = Lineage3D;
