/**
 * Lineage3D - 리니지 1 클래식 3D 입체 그래픽스 렌더링 엔진 (v2.0.0)
 * Three.js 기반 쿼터뷰 입체 MMORPG 렌더러
 * - 실시간 다이내믹 섀도우(그림자) 및 PBR 조명 시스템
 * - 기사, 52LV 데스나이트(화염검/망토), 가네프 오크, 라이칸스로프, 셀로브, 허수아비 3D 모델
 * - 입체 지형, 나무, 바위, 석재 마을, 경계 목조 울타리, 횃불 조명
 * - 3D 타격 스파크, 마법 투사체, 레벨업 빛기둥, 3D 플로팅 데미지 텍스트
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
        const width = this.container.clientWidth || 1024;
        const height = this.container.clientHeight || 520;

        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x11161d);
        this.scene.fog = new THREE.FogExp2(0x11161d, 0.012);

        // 2. Camera (리니지 정통 쿼터뷰 각도: 45도 상공에서 비스듬히 조망)
        const aspect = width / height;
        this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 500);
        this.viewMode = 'quarter'; // 'quarter' (전체 조망) | 'closeup' (입체 클로즈업)
        this.targetPitch = 50 * (Math.PI / 180);
        this.targetDistance = 46;
        this.cameraPitch = this.targetPitch;
        this.cameraDistance = this.targetDistance;
        this.updateCameraPosition(240, 360);

        // 3. WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        // 캔버스 스타일
        this.renderer.domElement.id = 'lineage3DCanvas';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.outline = 'none';

        this.container.appendChild(this.renderer.domElement);

        // 4. Lighting System (입체감과 볼륨감을 극대화하는 조명)
        // 4-1. 부드러운 환경광
        this.ambientLight = new THREE.AmbientLight(0xd0e0ff, 0.55);
        this.scene.add(this.ambientLight);

        // 4-2. 하늘-지면 대비 반사광 (상/하단 볼륨감)
        this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d3122, 0.45);
        this.scene.add(this.hemiLight);

        // 4-3. 주 태양광 (실시간 그림자 생성)
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

        // 4-4. 마을 횃불/가로등 포인트 라이트
        this.torchLight1 = new THREE.PointLight(0xff9933, 1.8, 22, 1.8);
        this.torchLight1.position.set(this.to3DX(420), 4.5, this.to3DZ(160));
        this.scene.add(this.torchLight1);

        this.torchLight2 = new THREE.PointLight(0xff9933, 1.8, 22, 1.8);
        this.torchLight2.position.set(this.to3DX(420), 4.5, this.to3DZ(360));
        this.scene.add(this.torchLight2);

        // 리사이즈 이벤트
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

    toggleViewMode() {
        if (this.viewMode === 'quarter') {
            this.viewMode = 'closeup';
            this.targetPitch = 32 * (Math.PI / 180); // 낮은 앵글로 입체감 극대화
            this.targetDistance = 24; // 가까이 줌인
            return '클로즈업 뷰';
        } else {
            this.viewMode = 'quarter';
            this.targetPitch = 50 * (Math.PI / 180);
            this.targetDistance = 46;
            return '쿼터뷰';
        }
    }

    updateCameraPosition(targetX, targetY) {
        // 부드러운 카메라 보간
        this.cameraPitch += (this.targetPitch - this.cameraPitch) * 0.1;
        this.cameraDistance += (this.targetDistance - this.cameraDistance) * 0.1;

        const x3D = this.to3DX(targetX);
        const z3D = this.to3DZ(targetY);

        // 부드럽게 타겟 위치로 카메라 이동
        const camHeight = Math.sin(this.cameraPitch) * this.cameraDistance;
        const camBack = Math.cos(this.cameraPitch) * this.cameraDistance;

        this.camera.position.set(x3D, camHeight, z3D + camBack);
        this.camera.lookAt(x3D, 1.2, z3D - 2.5);
    }

    // 절차적 지형 텍스처 생성 유틸리티
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
        // --- 1. 바닥 지형 (Terrain) ---
        // 마을 안전지대 바닥 (석재 보도블럭 타일)
        const stoneTex = this.createProceduralCanvas(512, 512, (ctx, w, h) => {
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
        stoneTex.repeat.set(4, 5);

        const villageWidth = 420 * this.scale;
        const totalHeight = 520 * this.scale;
        const villageGeo = new THREE.BoxGeometry(villageWidth, 0.6, totalHeight);
        const villageMat = new THREE.MeshStandardMaterial({
            map: stoneTex,
            roughness: 0.85,
            metalness: 0.1
        });
        this.villageGround = new THREE.Mesh(villageGeo, villageMat);
        this.villageGround.position.set(this.to3DX(210), -0.3, this.to3DZ(260));
        this.villageGround.receiveShadow = true;
        this.scene.add(this.villageGround);

        // 야생 사냥터 바닥 (거친 흙과 잔디)
        const wildTex = this.createProceduralCanvas(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#2e261a';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 4000; i++) {
                const rx = Math.random() * w;
                const ry = Math.random() * h;
                ctx.fillStyle = Math.random() > 0.4 ? '#3e3524' : '#1e1a12';
                ctx.fillRect(rx, ry, 2, 2);
            }
            // 풀 패치
            for (let i = 0; i < 80; i++) {
                const px = Math.random() * w;
                const py = Math.random() * h;
                ctx.fillStyle = 'rgba(46, 74, 34, 0.45)';
                ctx.beginPath();
                ctx.arc(px, py, 12 + Math.random() * 16, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        wildTex.repeat.set(6, 5);

        const wildWidth = (1024 - 420) * this.scale;
        const wildGeo = new THREE.BoxGeometry(wildWidth, 0.6, totalHeight);
        const wildMat = new THREE.MeshStandardMaterial({
            map: wildTex,
            roughness: 0.95,
            metalness: 0.05
        });
        this.wildGround = new THREE.Mesh(wildGeo, wildMat);
        this.wildGround.position.set(this.to3DX(420 + (1024 - 420) / 2), -0.3, this.to3DZ(260));
        this.wildGround.receiveShadow = true;
        this.scene.add(this.wildGround);

        // --- 2. 마을과 사냥터 경계선: 3D 목조 울타리와 횃불 기둥 관문 ---
        const fenceGroup = new THREE.Group();
        const borderX = this.to3DX(420);

        // 횃불 기둥 2개 (북쪽, 남쪽)
        const createTorchPillar = (z) => {
            const pillar = new THREE.Group();
            // 석조 받침
            const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.2, 8);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.6;
            baseMesh.castShadow = true;
            pillar.add(baseMesh);

            // 목조 기둥
            const postGeo = new THREE.CylinderGeometry(0.35, 0.4, 3.5, 8);
            const postMat = new THREE.MeshStandardMaterial({ color: 0x3d2716, roughness: 0.8 });
            const postMesh = new THREE.Mesh(postGeo, postMat);
            postMesh.position.y = 2.5;
            postMesh.castShadow = true;
            pillar.add(postMesh);

            // 철제 화로
            const bowlGeo = new THREE.CylinderGeometry(0.7, 0.4, 0.6, 8);
            const bowlMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.3 });
            const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
            bowlMesh.position.y = 4.4;
            bowlMesh.castShadow = true;
            pillar.add(bowlMesh);

            // 타오르는 불꽃 코어
            const fireGeo = new THREE.SphereGeometry(0.45, 8, 8);
            const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
            const fireMesh = new THREE.Mesh(fireGeo, fireMat);
            fireMesh.position.y = 4.8;
            pillar.add(fireMesh);

            pillar.position.set(borderX, 0, z);
            return pillar;
        };

        fenceGroup.add(createTorchPillar(this.to3DZ(160)));
        fenceGroup.add(createTorchPillar(this.to3DZ(360)));

        // 목조 펜스 레일 (울타리)
        const plankMat = new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.9 });
        for (let z = -24; z <= 24; z += 2.8) {
            if (Math.abs(z - this.to3DZ(260)) < 3.5) continue; // 중앙 게이트 통로는 열어둠!

            // 수직 기둥
            const postGeo = new THREE.BoxGeometry(0.4, 2.4, 0.4);
            const post = new THREE.Mesh(postGeo, plankMat);
            post.position.set(borderX, 1.2, z);
            post.castShadow = true;
            post.receiveShadow = true;
            fenceGroup.add(post);

            // 가로 레일 2줄
            const railGeo = new THREE.BoxGeometry(0.2, 0.25, 2.9);
            const rail1 = new THREE.Mesh(railGeo, plankMat);
            rail1.position.set(borderX, 1.6, z + 1.4);
            rail1.castShadow = true;
            fenceGroup.add(rail1);

            const rail2 = new THREE.Mesh(railGeo, plankMat);
            rail2.position.set(borderX, 0.8, z + 1.4);
            rail2.castShadow = true;
            fenceGroup.add(rail2);
        }
        this.scene.add(fenceGroup);

        // --- 3. 환경 오브젝트 (3D 바위, 나무, 분수대) ---
        // 3-1. 마을 수련장 나무 울타리 & 보도 장식
        this.addVillageProps();

        // 3-2. 사냥터 야생 바위 및 나무 클러스터
        this.addWildernessProps();

        // 바닥 클릭 감지용 투명 평면 (Raycasting Plane)
        const hitPlaneGeo = new THREE.PlaneGeometry(150, 100);
        const hitPlaneMat = new THREE.MeshBasicMaterial({ visible: false });
        this.raycastPlane = new THREE.Mesh(hitPlaneGeo, hitPlaneMat);
        this.raycastPlane.rotation.x = -Math.PI / 2;
        this.raycastPlane.position.y = 0;
        this.scene.add(this.raycastPlane);
    }

    addVillageProps() {
        const villageGroup = new THREE.Group();

        // 마을 중앙 석조 분수대
        const fountain = new THREE.Group();
        const basinGeo = new THREE.CylinderGeometry(3.2, 3.6, 0.8, 16);
        const basinMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
        const basin = new THREE.Mesh(basinGeo, basinMat);
        basin.position.y = 0.4;
        basin.castShadow = true;
        basin.receiveShadow = true;
        fountain.add(basin);

        const waterGeo = new THREE.CylinderGeometry(3.0, 3.0, 0.1, 16);
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.6 });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = 0.75;
        fountain.add(water);

        const centerPillarGeo = new THREE.CylinderGeometry(0.6, 0.8, 2.2, 12);
        const centerPillar = new THREE.Mesh(centerPillarGeo, basinMat);
        centerPillar.position.y = 1.4;
        centerPillar.castShadow = true;
        fountain.add(centerPillar);

        fountain.position.set(this.to3DX(240), 0, this.to3DZ(360));
        villageGroup.add(fountain);

        // 오크통 및 나무 상자 (판도라 상점 주변)
        const addBarrel = (x, z) => {
            const barrelGeo = new THREE.CylinderGeometry(0.65, 0.75, 1.6, 10);
            const barrelMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
            const barrel = new THREE.Mesh(barrelGeo, barrelMat);
            barrel.position.set(this.to3DX(x), 0.8, this.to3DZ(z));
            barrel.castShadow = true;
            barrel.receiveShadow = true;
            villageGroup.add(barrel);
        };

        addBarrel(110, 410);
        addBarrel(122, 420);
        addBarrel(170, 460);

        this.scene.add(villageGroup);
    }

    addWildernessProps() {
        const wildGroup = new THREE.Group();

        // 3D 소나무 생성기
        const createTree = (x, z, scale = 1.0) => {
            const tree = new THREE.Group();
            // 나무 몸통
            const trunkGeo = new THREE.CylinderGeometry(0.4 * scale, 0.6 * scale, 3.2 * scale, 8);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x422006, roughness: 0.9 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1.6 * scale;
            trunk.castShadow = true;
            tree.add(trunk);

            // 침엽수 나뭇잎 3단 원뿔
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
            const cone1Geo = new THREE.ConeGeometry(2.4 * scale, 3.0 * scale, 8);
            const cone1 = new THREE.Mesh(cone1Geo, leafMat);
            cone1.position.y = 3.6 * scale;
            cone1.castShadow = true;
            tree.add(cone1);

            const cone2Geo = new THREE.ConeGeometry(1.8 * scale, 2.6 * scale, 8);
            const cone2 = new THREE.Mesh(cone2Geo, leafMat);
            cone2.position.y = 5.2 * scale;
            cone2.castShadow = true;
            tree.add(cone2);

            tree.position.set(this.to3DX(x), 0, this.to3DZ(z));
            return tree;
        };

        // 3D 바위 생성기
        const createRock = (x, z, sx = 1.5, sy = 1.2, sz = 1.5) => {
            const rockGeo = new THREE.DodecahedronGeometry(1.2, 1);
            const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.scale.set(sx, sy, sz);
            rock.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
            rock.position.set(this.to3DX(x), 0.6 * sy, this.to3DZ(z));
            rock.castShadow = true;
            rock.receiveShadow = true;
            return rock;
        };

        // 사냥터 곳곳에 바위와 나무 자연스럽게 배치
        wildGroup.add(createTree(520, 90, 1.2));
        wildGroup.add(createTree(700, 70, 1.4));
        wildGroup.add(createTree(920, 110, 1.1));
        wildGroup.add(createTree(880, 460, 1.3));
        wildGroup.add(createTree(550, 480, 1.0));

        wildGroup.add(createRock(600, 290, 1.8, 1.4, 1.6));
        wildGroup.add(createRock(840, 210, 2.2, 1.6, 2.0));
        wildGroup.add(createRock(720, 420, 1.5, 1.1, 1.4));
        wildGroup.add(createRock(960, 330, 2.0, 1.5, 1.8));

        this.scene.add(wildGroup);
    }

    // ==========================================
    // 캐릭터 & 몬스터 3D 모델링 어셈블리
    // ==========================================

    // 1. 기사 (Knight) 풀 플레이트 아머 모델
    createKnightMesh() {
        const root = new THREE.Group();

        // 몸통 흉갑 (Silver/Blue Steel)
        const armorMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            metalness: 0.85,
            roughness: 0.25
        });
        const goldMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.9,
            roughness: 0.2
        });

        const chestGeo = new THREE.CylinderGeometry(0.7, 0.5, 1.4, 8);
        const chest = new THREE.Mesh(chestGeo, armorMat);
        chest.position.y = 2.0;
        chest.castShadow = true;
        root.add(chest);

        // 어깨 견갑 (Pauldrons)
        const shoulderGeo = new THREE.SphereGeometry(0.42, 8, 8);
        const leftShoulder = new THREE.Mesh(shoulderGeo, goldMat);
        leftShoulder.position.set(-0.9, 2.5, 0);
        leftShoulder.castShadow = true;
        root.add(leftShoulder);

        const rightShoulder = new THREE.Mesh(shoulderGeo, goldMat);
        rightShoulder.position.set(0.9, 2.5, 0);
        rightShoulder.castShadow = true;
        root.add(rightShoulder);

        // 머리 투구 (Helmet)
        const helmGeo = new THREE.SphereGeometry(0.55, 12, 12);
        const helm = new THREE.Mesh(helmGeo, armorMat);
        helm.position.y = 3.2;
        helm.castShadow = true;
        root.add(helm);

        // 투구 붉은 깃털 장식 (Plume)
        const plumeGeo = new THREE.ConeGeometry(0.2, 0.8, 6);
        const plumeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
        const plume = new THREE.Mesh(plumeGeo, plumeMat);
        plume.position.set(0, 3.8, -0.2);
        plume.rotation.x = -0.3;
        root.add(plume);

        // 왼손 방패 (Kite Shield)
        const shieldGroup = new THREE.Group();
        const shieldGeo = new THREE.BoxGeometry(0.12, 1.5, 1.0);
        const shieldMesh = new THREE.Mesh(shieldGeo, armorMat);
        shieldMesh.castShadow = true;
        shieldGroup.add(shieldMesh);

        // 방패 황금 십자 문양
        const crossGeo = new THREE.BoxGeometry(0.16, 1.2, 0.25);
        const crossMesh = new THREE.Mesh(crossGeo, goldMat);
        shieldGroup.add(crossMesh);

        shieldGroup.position.set(-0.95, 1.9, 0.35);
        root.add(shieldGroup);

        // 오른손 싸울아비 장검 (Sword)
        const swordGroup = new THREE.Group();
        // 칼날
        const bladeGeo = new THREE.BoxGeometry(0.1, 2.2, 0.35);
        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            metalness: 0.95,
            roughness: 0.15
        });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 1.1;
        blade.castShadow = true;
        swordGroup.add(blade);

        // 황금 코등이 (Guard)
        const guardGeo = new THREE.BoxGeometry(0.25, 0.15, 0.9);
        const guard = new THREE.Mesh(guardGeo, goldMat);
        swordGroup.add(guard);

        // 자루 & 폼멜
        const hiltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
        const hilt = new THREE.Mesh(hiltGeo, goldMat);
        hilt.position.y = -0.35;
        swordGroup.add(hilt);

        swordGroup.position.set(0.9, 1.8, 0.4);
        swordGroup.rotation.x = Math.PI / 4;
        root.add(swordGroup);
        root.swordMesh = swordGroup;

        // 다리 2개
        const legGeo = new THREE.CylinderGeometry(0.22, 0.2, 1.2, 6);
        const leftLeg = new THREE.Mesh(legGeo, armorMat);
        leftLeg.position.set(-0.35, 0.7, 0);
        leftLeg.castShadow = true;
        root.add(leftLeg);
        root.leftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(legGeo, armorMat);
        rightLeg.position.set(0.35, 0.7, 0);
        rightLeg.castShadow = true;
        root.add(rightLeg);
        root.rightLeg = rightLeg;

        root.name = "knight";
        return root;
    }

    // 2. 52LV 전설의 데스나이트 (Death Knight) 모델
    createDeathKnightMesh() {
        const root = new THREE.Group();

        // 흑요석 다크 메탈 아머
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x18181b,
            metalness: 0.9,
            roughness: 0.2
        });
        const goldAccentMat = new THREE.MeshStandardMaterial({
            color: 0xd97706,
            metalness: 0.8,
            roughness: 0.3
        });

        // 흉갑
        const chestGeo = new THREE.CylinderGeometry(0.75, 0.55, 1.5, 8);
        const chest = new THREE.Mesh(chestGeo, darkMat);
        chest.position.y = 2.1;
        chest.castShadow = true;
        root.add(chest);

        // 뾰족한 해골 스파이크 견갑
        const spikeGeo = new THREE.ConeGeometry(0.35, 0.9, 6);
        const leftSpike = new THREE.Mesh(spikeGeo, goldAccentMat);
        leftSpike.position.set(-1.0, 2.7, 0);
        leftSpike.rotation.z = 0.5;
        leftSpike.castShadow = true;
        root.add(leftSpike);

        const rightSpike = new THREE.Mesh(spikeGeo, goldAccentMat);
        rightSpike.position.set(1.0, 2.7, 0);
        rightSpike.rotation.z = -0.5;
        rightSpike.castShadow = true;
        root.add(rightSpike);

        // 해골 뿔 투구
        const skullGeo = new THREE.SphereGeometry(0.55, 10, 10);
        const skull = new THREE.Mesh(skullGeo, darkMat);
        skull.position.y = 3.3;
        skull.castShadow = true;
        root.add(skull);

        // 투구 뿔 2개
        const hornGeo = new THREE.ConeGeometry(0.18, 0.7, 5);
        const leftHorn = new THREE.Mesh(hornGeo, goldAccentMat);
        leftHorn.position.set(-0.4, 3.8, 0);
        leftHorn.rotation.z = 0.4;
        root.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, goldAccentMat);
        rightHorn.position.set(0.4, 3.8, 0);
        rightHorn.rotation.z = -0.4;
        root.add(rightHorn);

        // 타오르는 붉은 안광 (Eyes Glow)
        const eyeGeo = new THREE.SphereGeometry(0.1, 6, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.2, 3.35, 0.48);
        root.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.2, 3.35, 0.48);
        root.add(rightEye);

        // 펄럭이는 붉은 망토 (Red Cape)
        const capeGeo = new THREE.BoxGeometry(1.4, 2.2, 0.1);
        const capeMat = new THREE.MeshStandardMaterial({
            color: 0x991b1b,
            roughness: 0.9
        });
        const cape = new THREE.Mesh(capeGeo, capeMat);
        cape.position.set(0, 1.8, -0.6);
        cape.rotation.x = 0.18;
        cape.castShadow = true;
        root.add(cape);
        root.cape = cape;

        // 타오르는 전설의 화염검 (Flame Sword)
        const flameSwordGroup = new THREE.Group();
        const bladeGeo = new THREE.BoxGeometry(0.12, 2.5, 0.45);
        const flameMat = new THREE.MeshStandardMaterial({
            color: 0xff4500,
            emissive: 0xff2200,
            emissiveIntensity: 0.8,
            roughness: 0.2
        });
        const flameBlade = new THREE.Mesh(bladeGeo, flameMat);
        flameBlade.position.y = 1.25;
        flameBlade.castShadow = true;
        flameSwordGroup.add(flameBlade);

        // 화염검 가드
        const guardGeo = new THREE.BoxGeometry(0.3, 0.2, 1.0);
        const guard = new THREE.Mesh(guardGeo, goldAccentMat);
        flameSwordGroup.add(guard);

        // 검신 불꽃 포인트 라이트
        const swordLight = new THREE.PointLight(0xff3700, 2.0, 10, 2);
        swordLight.position.set(0, 1.2, 0);
        flameSwordGroup.add(swordLight);

        flameSwordGroup.position.set(0.95, 1.8, 0.4);
        flameSwordGroup.rotation.x = Math.PI / 4;
        root.add(flameSwordGroup);
        root.swordMesh = flameSwordGroup;

        // 다리
        const legGeo = new THREE.CylinderGeometry(0.24, 0.2, 1.3, 6);
        const leftLeg = new THREE.Mesh(legGeo, darkMat);
        leftLeg.position.set(-0.38, 0.7, 0);
        leftLeg.castShadow = true;
        root.add(leftLeg);
        root.leftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(legGeo, darkMat);
        rightLeg.position.set(0.38, 0.7, 0);
        rightLeg.castShadow = true;
        root.add(rightLeg);
        root.rightLeg = rightLeg;

        root.name = "deathknight";
        return root;
    }

    // 3. 가네프 오크 (Orc) 3D 모델
    createOrcMesh() {
        const root = new THREE.Group();
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.85 }); // 녹색 피부
        const leatherMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });

        // 육중한 덩치 몸통
        const bodyGeo = new THREE.BoxGeometry(1.6, 1.5, 1.1);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.y = 1.8;
        body.castShadow = true;
        root.add(body);

        // 가죽 벨트
        const beltGeo = new THREE.BoxGeometry(1.65, 0.35, 1.15);
        const belt = new THREE.Mesh(beltGeo, leatherMat);
        belt.position.y = 1.2;
        root.add(belt);

        // 오크 머리
        const headGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 2.8, 0.15);
        head.castShadow = true;
        root.add(head);

        // 뾰족 귀 2개
        const earGeo = new THREE.ConeGeometry(0.18, 0.5, 4);
        const leftEar = new THREE.Mesh(earGeo, skinMat);
        leftEar.position.set(-0.55, 2.9, 0.1);
        leftEar.rotation.z = 0.8;
        root.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, skinMat);
        rightEar.position.set(0.55, 2.9, 0.1);
        rightEar.rotation.z = -0.8;
        root.add(rightEar);

        // 거대한 가시 쇠몽둥이 (Spiked Club)
        const clubGroup = new THREE.Group();
        const handleGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.4, 6);
        const handle = new THREE.Mesh(handleGeo, leatherMat);
        handle.position.y = 0.7;
        handle.castShadow = true;
        clubGroup.add(handle);

        const headClubGeo = new THREE.CylinderGeometry(0.4, 0.25, 1.2, 8);
        const headClub = new THREE.Mesh(headClubGeo, ironMat);
        headClub.position.y = 1.8;
        headClub.castShadow = true;
        clubGroup.add(headClub);

        clubGroup.position.set(1.1, 1.5, 0.3);
        clubGroup.rotation.x = Math.PI / 6;
        root.add(clubGroup);
        root.weaponMesh = clubGroup;

        // 다리
        const legGeo = new THREE.CylinderGeometry(0.32, 0.28, 1.1, 6);
        const leftLeg = new THREE.Mesh(legGeo, leatherMat);
        leftLeg.position.set(-0.45, 0.55, 0);
        leftLeg.castShadow = true;
        root.add(leftLeg);
        root.leftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(legGeo, leatherMat);
        rightLeg.position.set(0.45, 0.55, 0);
        rightLeg.castShadow = true;
        root.add(rightLeg);
        root.rightLeg = rightLeg;

        return root;
    }

    // 4. 라이칸스로프 (Lycanthrope) 3D 야수 모델
    createLycanMesh() {
        const root = new THREE.Group();
        const furMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 }); // 잿빛 털
        const darkFurMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

        // 웅크린 야수 상체
        const torsoGeo = new THREE.BoxGeometry(1.3, 1.6, 1.2);
        const torso = new THREE.Mesh(torsoGeo, furMat);
        torso.position.set(0, 1.7, 0);
        torso.rotation.x = 0.3; // 전방 쏠림 자세
        torso.castShadow = true;
        root.add(torso);

        // 늑대 머리와 긴 주둥이 (Snout)
        const headGroup = new THREE.Group();
        const skullGeo = new THREE.BoxGeometry(0.75, 0.75, 0.8);
        const skull = new THREE.Mesh(skullGeo, darkFurMat);
        skull.castShadow = true;
        headGroup.add(skull);

        const snoutGeo = new THREE.BoxGeometry(0.45, 0.35, 0.65);
        const snout = new THREE.Mesh(snoutGeo, darkFurMat);
        snout.position.set(0, -0.15, 0.65);
        snout.castShadow = true;
        headGroup.add(snout);

        // 늑대 귀
        const earGeo = new THREE.ConeGeometry(0.18, 0.5, 4);
        const lEar = new THREE.Mesh(earGeo, darkFurMat);
        lEar.position.set(-0.35, 0.5, 0);
        headGroup.add(lEar);
        const rEar = new THREE.Mesh(earGeo, darkFurMat);
        rEar.position.set(0.35, 0.5, 0);
        headGroup.add(rEar);

        headGroup.position.set(0, 2.6, 0.5);
        root.add(headGroup);

        // 긴 늑대 꼬리
        const tailGeo = new THREE.CylinderGeometry(0.15, 0.05, 1.4, 6);
        const tail = new THREE.Mesh(tailGeo, furMat);
        tail.position.set(0, 1.2, -0.9);
        tail.rotation.x = -0.8;
        root.add(tail);

        // 야수 앞발 2개
        const armGeo = new THREE.BoxGeometry(0.35, 1.3, 0.35);
        const lArm = new THREE.Mesh(armGeo, darkFurMat);
        lArm.position.set(-0.85, 1.2, 0.4);
        lArm.castShadow = true;
        root.add(lArm);
        root.leftArm = lArm;

        const rArm = new THREE.Mesh(armGeo, darkFurMat);
        rArm.position.set(0.85, 1.2, 0.4);
        rArm.castShadow = true;
        root.add(rArm);
        root.rightArm = rArm;

        // 야수 뒷다리
        const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.5);
        const lLeg = new THREE.Mesh(legGeo, furMat);
        lLeg.position.set(-0.45, 0.5, -0.3);
        lLeg.castShadow = true;
        root.add(lLeg);
        root.leftLeg = lLeg;

        const rLeg = new THREE.Mesh(legGeo, furMat);
        rLeg.position.set(0.45, 0.5, -0.3);
        rLeg.castShadow = true;
        root.add(rLeg);
        root.rightLeg = rLeg;

        return root;
    }

    // 5. 셀로브 (Selolb) 3D 거대 거미 모델
    createSelolbMesh() {
        const root = new THREE.Group();
        const chitinMat = new THREE.MeshStandardMaterial({
            color: 0x881337, // 검붉은 키틴질 껍질
            roughness: 0.3,
            metalness: 0.6
        });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

        // 팽창된 복부 (Abdomen)
        const abdomenGeo = new THREE.SphereGeometry(1.2, 10, 10);
        const abdomen = new THREE.Mesh(abdomenGeo, chitinMat);
        abdomen.scale.set(1.1, 0.8, 1.5);
        abdomen.position.set(0, 1.1, -1.1);
        abdomen.castShadow = true;
        root.add(abdomen);

        // 흉부 (Cephalothorax)
        const thoraxGeo = new THREE.SphereGeometry(0.7, 8, 8);
        const thorax = new THREE.Mesh(thoraxGeo, blackMat);
        thorax.scale.set(1.0, 0.7, 1.0);
        thorax.position.set(0, 0.9, 0.3);
        thorax.castShadow = true;
        root.add(thorax);

        // 붉은 독 거미 눈 4개
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        for (let i = -1; i <= 1; i += 0.66) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), eyeMat);
            eye.position.set(i * 0.25, 1.0, 0.95);
            root.add(eye);
        }

        // 8개의 관절 다리
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

    // 6. 허수아비 (Wooden Dummy) 3D 모델
    createDummyMesh() {
        const root = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const strawMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 }); // 짚풀

        // 수직 나무 기둥
        const postGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.2, 8);
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.y = 1.6;
        post.castShadow = true;
        root.add(post);

        // 가로 나무 팔
        const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6);
        const arm = new THREE.Mesh(armGeo, woodMat);
        arm.position.y = 2.4;
        arm.rotation.z = Math.PI / 2;
        arm.castShadow = true;
        root.add(arm);

        // 짚단 몸통
        const bodyGeo = new THREE.CylinderGeometry(0.55, 0.45, 1.4, 8);
        const body = new THREE.Mesh(bodyGeo, strawMat);
        body.position.y = 2.0;
        body.castShadow = true;
        root.add(body);

        // 짚단 머리 & 밀짚모자
        const headGeo = new THREE.SphereGeometry(0.38, 8, 8);
        const head = new THREE.Mesh(headGeo, strawMat);
        head.position.y = 3.1;
        root.add(head);

        const hatGeo = new THREE.ConeGeometry(0.85, 0.5, 8);
        const hat = new THREE.Mesh(hatGeo, strawMat);
        hat.position.y = 3.5;
        hat.rotation.z = 0.15;
        hat.castShadow = true;
        root.add(hat);

        return root;
    }

    // 7. 판도라 (Pandora NPC) 3D 상점 가판대 모델
    createPandoraMesh() {
        const root = new THREE.Group();
        // 상점 목조 테이블
        const tableGeo = new THREE.BoxGeometry(2.4, 1.1, 1.2);
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.8 });
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.position.y = 0.55;
        table.castShadow = true;
        table.receiveShadow = true;
        root.add(table);

        // 테이블 위 물약병들
        const createPotionBottle = (x, z, color) => {
            const potGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.4, 6);
            const potMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, metalness: 0.5 });
            const pot = new THREE.Mesh(potGeo, potMat);
            pot.position.set(x, 1.3, z);
            return pot;
        };
        root.add(createPotionBottle(-0.6, 0, 0xef4444)); // 빨간물약
        root.add(createPotionBottle(-0.3, 0, 0x22c55e)); // 초록물약
        root.add(createPotionBottle(0.0, 0, 0x3b82f6)); // 파란물약
        root.add(createPotionBottle(0.3, 0, 0xf59e0b)); // 용기의물약

        // 상점 천막 기둥 4개와 빨간 줄무늬 차양 (Awning)
        const canopyGeo = new THREE.ConeGeometry(2.2, 0.8, 4);
        const canopyMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.y = 3.6;
        canopy.rotation.y = Math.PI / 4;
        canopy.castShadow = true;
        root.add(canopy);

        // 판도라 여성 상인 몸체
        const npcMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.8 }); // 초록 드레스
        const bodyGeo = new THREE.CylinderGeometry(0.35, 0.55, 1.6, 8);
        const body = new THREE.Mesh(bodyGeo, npcMat);
        body.position.set(0, 1.3, -0.6);
        body.castShadow = true;
        root.add(body);

        const headGeo = new THREE.SphereGeometry(0.32, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 2.3, -0.6);
        root.add(head);

        return root;
    }

    // 8. 바닥 드랍 아데나 코인
    createAdenaMesh() {
        const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8);
        const coinMat = new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            metalness: 0.9,
            roughness: 0.15,
            emissive: 0x854d0e,
            emissiveIntensity: 0.3
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.position.y = 0.2;
        coin.castShadow = true;
        return coin;
    }

    // ==========================================
    // 3D 텍스트 및 UI 빌보드 (이름표, HP바, 데미지 폰트)
    // ==========================================
    createNameplateTexture(text, subText, color = '#38bdf8') {
        const cvs = document.createElement('canvas');
        cvs.width = 256;
        cvs.height = 80;
        const ctx = cvs.getContext('2d');

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.roundRect(10, 10, 236, 60, 8);
        ctx.fill();

        ctx.textAlign = 'center';
        if (subText) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(subText, 128, 34);
            ctx.fillStyle = color;
            ctx.font = 'bold 22px sans-serif';
            ctx.fillText(text, 128, 58);
        } else {
            ctx.fillStyle = color;
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText(text, 128, 48);
        }

        const tex = new THREE.CanvasTexture(cvs);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(3.2, 1.0, 1);
        return sprite;
    }

    // 3D 데미지 플로팅 텍스트
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

    // 3D 타격 스파크 파티클
    spawnHitSpark3D(x, y, color = 0xfacc15) {
        for (let i = 0; i < 8; i++) {
            const pGeo = new THREE.SphereGeometry(0.12, 4, 4);
            const pMat = new THREE.MeshBasicMaterial({ color: color });
            const p = new THREE.Mesh(pGeo, pMat);
            p.position.set(this.to3DX(x), 2.2, this.to3DZ(y));
            p.vx = (Math.random() - 0.5) * 0.3;
            p.vy = 0.15 + Math.random() * 0.25;
            p.vz = (Math.random() - 0.5) * 0.3;
            p.life = 0.45;
            this.scene.add(p);
            this.particles3D.push(p);
        }
    }

    // 3D 클릭 지면 황금 링 리플
    spawnClickRing3D(x, y) {
        const ringGeo = new THREE.RingGeometry(0.3, 0.55, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(this.to3DX(x), 0.05, this.to3DZ(y));
        ring.scaleVal = 1.0;
        ring.life = 0.35;
        this.scene.add(ring);
        this.particles3D.push(ring);
    }

    // 3D 에너지 볼트 마법 투사체
    spawnMagicMissile3D(startX, startY, targetEntity) {
        const missileGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const missileMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 1.0
        });
        const missile = new THREE.Mesh(missileGeo, missileMat);
        missile.position.set(this.to3DX(startX), 2.5, this.to3DZ(startY));

        const light = new THREE.PointLight(0x38bdf8, 2.0, 8);
        missile.add(light);

        missile.target = targetEntity;
        missile.speed = 1.6;
        this.scene.add(missile);
        this.magicMissiles.push(missile);
    }

    // ==========================================
    // 3D 터치 / 마우스 Raycasting 바인딩
    // ==========================================
    bindRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mousePos = new THREE.Vector2();

        const triggerActionFromEvent = (clientX, clientY) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mousePos.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            this.mousePos.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mousePos, this.camera);

            // 1. 엔티티(몬스터, 허수아비, NPC) 피킹 우선 검사
            const entityHits = [];
            // NPC
            for (const [npcId, mesh] of this.meshes.npcs.entries()) {
                entityHits.push({ mesh, type: 'npc', id: npcId });
            }
            // 몬스터
            for (const [mRef, mesh] of this.meshes.monsters.entries()) {
                entityHits.push({ mesh, type: 'monster', entity: mRef });
            }
            // 허수아비
            for (const [dumId, mesh] of this.meshes.dummies.entries()) {
                entityHits.push({ mesh, type: 'dummy', id: dumId });
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

            // 2. 바닥 평면 인터섹션 -> 플레이어 이동
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

        canvasEl.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                triggerActionFromEvent(e.clientX, e.clientY);
            } else if (e.button === 2) {
                e.preventDefault();
                this.engine.useItem('red_potion');
            }
        });

        canvasEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches && e.touches.length > 0) {
                const t = e.touches[0];
                triggerActionFromEvent(t.clientX, t.clientY);
            }
        }, { passive: false });

        canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ==========================================
    // 실시간 3D 동기화 & 렌더 루프
    // ==========================================
    update(dt) {
        const p = this.engine.player;

        // 1. 플레이어 3D 메시 동기화
        if (!this.meshes.player || this.meshes.player.isPoly !== p.isPolymorphed) {
            if (this.meshes.player) this.scene.remove(this.meshes.player);
            this.meshes.player = p.isPolymorphed ? this.createDeathKnightMesh() : this.createKnightMesh();
            this.meshes.player.isPoly = p.isPolymorphed;

            // 이름표 부착
            const pNameplate = this.createNameplateTexture(p.name, `[${p.title}]`, '#38bdf8');
            pNameplate.position.y = 4.8;
            this.meshes.player.add(pNameplate);

            this.scene.add(this.meshes.player);
        }

        const pMesh = this.meshes.player;
        pMesh.position.set(this.to3DX(p.x), 0, this.to3DZ(p.y));

        // 플레이어 회전 방향 (이동 또는 타겟)
        let targetAngle = 0;
        if (p.targetEntity) {
            targetAngle = Math.atan2(p.targetEntity.x - p.x, p.targetEntity.y - p.y);
        } else {
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            if (Math.hypot(dx, dy) > 2) {
                targetAngle = Math.atan2(dx, dy);
            }
        }
        pMesh.rotation.y = targetAngle;

        // 보행/공격 3D 애니메이션
        const isMoving = Math.hypot(p.targetX - p.x, p.targetY - p.y) > 4;
        const animTime = performance.now() * 0.008;

        if (isMoving && pMesh.leftLeg && pMesh.rightLeg) {
            pMesh.leftLeg.rotation.x = Math.sin(animTime) * 0.6;
            pMesh.rightLeg.rotation.x = -Math.sin(animTime) * 0.6;
        } else if (pMesh.leftLeg && pMesh.rightLeg) {
            pMesh.leftLeg.rotation.x = 0;
            pMesh.rightLeg.rotation.x = 0;
        }

        // 검 휘두르기 공격 모션
        if (p.isAttacking && pMesh.swordMesh) {
            pMesh.swordMesh.rotation.x = (Math.PI / 4) + Math.sin(performance.now() * 0.02) * 0.8;
        } else if (pMesh.swordMesh) {
            pMesh.swordMesh.rotation.x = Math.PI / 4;
        }

        // 데스나이트 망토 펄럭임
        if (pMesh.cape) {
            pMesh.cape.rotation.x = 0.2 + (isMoving ? Math.sin(animTime * 1.5) * 0.25 : 0.05);
        }

        // 카메라 위치 플레이어 부드러운 팔로우
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
                else mMesh = this.createSelolbMesh();

                // 몬스터 이름표
                const nameplate = this.createNameplateTexture(m.name, null, '#fca5a5');
                nameplate.position.y = 4.2;
                mMesh.add(nameplate);

                this.scene.add(mMesh);
                this.meshes.monsters.set(m, mMesh);
            }

            mMesh.position.set(this.to3DX(m.x), 0, this.to3DZ(m.y));

            // 주인공을 향해 바라보기
            const mAngle = Math.atan2(p.x - m.x, p.y - m.y);
            mMesh.rotation.y = mAngle;

            // 셀로브 다리 애니메이션
            if (mMesh.legs) {
                mMesh.legs.forEach((leg, idx) => {
                    leg.rotation.x = Math.sin(animTime * 1.5 + idx) * 0.3;
                });
            }
        }

        // 3. 허수아비 3D 메시 동기화
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

            // 피격 리액션 흔들림
            if (p.targetEntity === dum && p.isAttacking) {
                dMesh.rotation.z = Math.sin(performance.now() * 0.03) * 0.12;
            } else {
                dMesh.rotation.z = 0;
            }
        }

        // 4. NPC 3D 메시 동기화
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
            dMesh.rotation.y += 0.05; // 빙글빙글 회전
        }

        // 6. 3D 데미지 플로팅 텍스트 업데이트
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

        // 7. 3D 파티클 업데이트
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

        // 8. 3D 마법 투사체 업데이트
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

        // 9. 횃불 포인트 라이트 깜빡임 (Flickering effect)
        const flicker = 1.6 + Math.sin(performance.now() * 0.015) * 0.35;
        this.torchLight1.intensity = flicker;
        this.torchLight2.intensity = flicker;

        // 최종 3D 렌더링
        this.renderer.render(this.scene, this.camera);
    }
}

window.Lineage3D = Lineage3D;
