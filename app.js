let scene, camera, renderer, orbitControls;
let currentFunc = 'sin';
let maxDegree = 5;
let targetX = 1.5;

let originalLine = null;
let approxLine = null;
let layerLines = [];
let errorIndicator = null;

let customWeights = {}; // 사용자가 슬라이더로 조절할 각 항의 가중치 변수
let isAnimating = false;
let animProgress = 1.0; 
let lastTimestamp = 0;

const LAYER_COLORS = [
    0x38bdf8, 0xf43f5e, 0x10b981, 0xa855f7, 0xf59e0b,
    0x06b6d4, 0xec4899, 0x84cc16, 0xeab308, 0x6366f1
];

window.onload = function() {
    init3DScene();
    resetWeights();
    buildSlidersUI();
    updateEngine();
    initUIEvents();
    animateLoop();
};

function init3DScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(7, 8, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    let dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(5, 15, 10);
    scene.add(dirLight);

    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    // 3D 격자 무대 설치 (X-Z 평면 기반 공간화)
    let grid = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
    scene.add(grid);
}

function resetWeights() {
    customWeights = {};
    for(let i = 0; i <= 13; i++) {
        customWeights[i] = 1.0; 
    }
}

function buildSlidersUI() {
    const container = document.getElementById('dynamic-sliders-container');
    container.innerHTML = '';
    
    for (let i = 0; i <= maxDegree; i++) {
        // 급수 특성상 실제 존재하지 않는 항(예: sin의 짝수차 항)은 인터페이스 생성 패스
        if (currentFunc === 'sin' && i % 2 === 0) continue;
        if (currentFunc === 'cos' && i % 2 === 1) continue;

        const card = document.createElement('div');
        card.className = 'point-card';
        card.innerHTML = `
            <div class="point-header" style="color: var(--accent-blue)">✨ ${i}차 미분 항 튜닝 계수</div>
            <div class="axis-row">
                <label>Weight:</label>
                <input type="range" min="0" max="2" step="0.1" value="${customWeights[i].toFixed(1)}" data-idx="${i}" class="weight-slider">
                <span class="axis-val">${customWeights[i].toFixed(1)}</span>
            </div>
        `;
        container.appendChild(card);
    }

    document.querySelectorAll('.weight-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const val = parseFloat(e.target.value);
            customWeights[idx] = val;
            e.target.nextElementSibling.innerText = val.toFixed(1);
            updateEngine();
        });
    });
}

function updateEngine() {
    // 1. 기존 기하 오브젝트들 클리어
    if (originalLine) scene.remove(originalLine);
    if (approxLine) scene.remove(approxLine);
    layerLines.forEach(l => scene.remove(l));
    layerLines = [];
    if (errorIndicator) scene.remove(errorIndicator);

    const segments = 100;
    const xRange = 6; // -6부터 +6까지 드로잉

    // 2. [초록색] 오리지널 초월함수 선 배치 (Z=0 평면에 고정)
    const origPoints = [];
    for(let i = 0; i <= segments; i++) {
        let x = (-xRange/2) + (xRange * i / segments);
        let y = TaylorMath.getOriginalValue(currentFunc, x);
        origPoints.push(new THREE.Vector3(x, y, 0));
    }
    const origGeo = new THREE.BufferGeometry().setFromPoints(origPoints);
    originalLine = new THREE.Line(origGeo, new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 3 }));
    scene.add(originalLine);

    // 3. [Z축 입체 구조선] 레이어별 개별 고유 항 기여도 곡선 가시화
    const showLayers = document.getElementById('toggle-construction').checked;
    for(let i = 0; i <= maxDegree; i++) {
        if (currentFunc === 'sin' && i % 2 === 0) continue;
        if (currentFunc === 'cos' && i % 2 === 1) continue;

        const layerPoints = [];
        let zPos = -i * 0.8; // 각 차수항들이 Z축 뒤쪽으로 한 칸씩 쌓여 배치되는 입체 효과 규칙

        for(let j = 0; j <= segments; j++) {
            let x = (-xRange/2) + (xRange * j / segments);
            // 애니메이션 진행 시 Z축에 퍼져있던 선들이 중심(Z=0)으로 압착 압축되는 모션 효과식 적용
            let currentZ = zPos * (1.0 - animProgress); 
            let y = TaylorMath.getSingleTermValue(currentFunc, x, i, customWeights[i]);
            layerPoints.push(new THREE.Vector3(x, y, currentZ));
        }

        const layerGeo = new THREE.BufferGeometry().setFromPoints(layerPoints);
        const layerMat = new THREE.LineBasicMaterial({ 
            color: LAYER_COLORS[i % LAYER_COLORS.length], 
            opacity: showLayers ? 0.6 : 0.0, 
            transparent: true 
        });
        const lLine = new THREE.Line(layerGeo, layerMat);
        scene.add(lLine);
        layerLines.push(lLine);
    }

    // 4. [분홍색] 최종 합성된 테일러 다항식 P_n(x) 곡선 (Z=0 평면에 렌더링)
    const approxPoints = [];
    for(let i = 0; i <= segments; i++) {
        let x = (-xRange/2) + (xRange * i / segments);
        let y = TaylorMath.getAccumulatedValue(currentFunc, x, maxDegree, customWeights);
        approxPoints.push(new THREE.Vector3(x, y, 0));
    }
    const approxGeo = new THREE.BufferGeometry().setFromPoints(approxPoints);
    approxLine = new THREE.Line(approxGeo, new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3 }));
    scene.add(approxLine);

    // 5. [오차 기둥 인디케이터] 특정 x 지점에서의 오차 분석 기둥 기하 배치
    let yTrue = TaylorMath.getOriginalValue(currentFunc, targetX);
    let yApprox = TaylorMath.getAccumulatedValue(currentFunc, targetX, maxDegree, customWeights);
    
    const errorPoints = [
        new THREE.Vector3(targetX, yTrue, 0),
        new THREE.Vector3(targetX, yApprox, 0)
    ];
    const errorGeo = new THREE.BufferGeometry().setFromPoints(errorPoints);
    errorIndicator = new THREE.Line(errorGeo, new THREE.LineBasicMaterial({ color: 0xeab308, linewidth: 2 }));
    scene.add(errorIndicator);

    refreshUIValues(yTrue, yApprox);
}

function refreshUIValues(yTrue, yApprox) {
    document.getElementById('curve-degree').innerText = `P_${maxDegree}(x)`;
    document.getElementById('n-value-display').innerText = maxDegree;
    document.getElementById('x-value-display').innerText = targetX.toFixed(1);

    // 🎯 우측 텍스트 수식 파트 동적 정밀 생성
    let formulaStr = "P(x) = ";
    let terms = [];
    for(let i = 0; i <= maxDegree; i++) {
        if (currentFunc === 'sin' && i % 2 === 0) continue;
        if (currentFunc === 'cos' && i % 2 === 1) continue;
        
        let w = customWeights[i];
        if (w === 0) continue;
        let wStr = w !== 1.0 ? `(${w.toFixed(1)})·` : "";

        if (currentFunc === 'sin') {
            let k = (i - 1) / 2;
            let sign = k % 2 === 0 ? "+" : "-";
            terms.push(`${sign} ${wStr}x^${i}/${i}!`);
        } else if (currentFunc === 'cos') {
            let k = i / 2;
            let sign = k % 2 === 0 ? "+" : "-";
            terms.push(`${sign} ${wStr}${i===0 ? '1' : `x^${i}/${i}!`}`);
        } else if (currentFunc === 'exp') {
            terms.push(`+ ${wStr}${i===0 ? '1' : `x^${i}/${i}!`}`);
        }
    }
    formulaStr += terms.join(" ");
    document.getElementById('matrix-x').innerText = formulaStr;

    // 참값 및 오차 데이터 출력 연동
    document.getElementById('final-b-coordinates').innerText = `참값 f(x): ${yTrue.toFixed(4)} | 근사 P(x): ${yApprox.toFixed(4)}`;
    document.getElementById('interpolation-ratio').innerText = Math.abs(yTrue - yApprox).toFixed(5);
}

function initUIEvents() {
    // 패널 여닫기 토글
    document.getElementById('btn-toggle-left').addEventListener('click', (e) => {
        document.getElementById('info-panel').classList.toggle('collapsed');
        e.target.innerText = document.getElementById('info-panel').classList.contains('collapsed') ? "▶" : "◀";
    });
    document.getElementById('btn-toggle-top').addEventListener('click', (e) => {
        document.getElementById('top-control-panel').classList.toggle('collapsed');
        e.target.innerText = document.getElementById('top-control-panel').classList.contains('collapsed') ? "◀" : "▶";
    });
    document.getElementById('btn-toggle-bottom').addEventListener('click', (e) => {
        document.getElementById('bottom-control-panel').classList.toggle('collapsed');
        e.target.innerText = document.getElementById('bottom-control-panel').classList.contains('collapsed') ? "◀" : "▶";
    });

    // 프리셋 셀렉트
    document.getElementById('preset-select').addEventListener('change', (e) => {
        currentFunc = e.target.value;
        resetWeights();
        buildSlidersUI();
        updateEngine();
    });

    // 차수(N) 조절 슬라이더
    document.getElementById('input-n-value').addEventListener('input', (e) => {
        maxDegree = parseInt(e.target.value);
        buildSlidersUI();
        updateEngine();
    });

    // 타깃 위치(x) 조절 슬라이더
    document.getElementById('input-target-x').addEventListener('input', (e) => {
        targetX = parseFloat(e.target.value);
        updateEngine();
    });

    document.getElementById('toggle-construction').addEventListener('change', () => {
        updateEngine();
    });

    // 애니메이션 트리거 버튼 연동
    document.getElementById('btn-toggle-sim').addEventListener('click', () => {
        isAnimating = true;
        animProgress = 0.0; // 0에서 결합 연출 시작
        lastTimestamp = 0;
    });

    document.getElementById('btn-reset-sim').addEventListener('click', () => {
        isAnimating = false;
        animProgress = 1.0;
        resetWeights();
        buildSlidersUI();
        updateEngine();
    });
}

function animateLoop(timestamp) {
    requestAnimationFrame(animateLoop);
    orbitControls.update();

    if (isAnimating) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        let elapsed = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        animProgress += elapsed / 2000; // 2초 동안 결합 애니메이션이 부드럽게 펼쳐짐
        if (animProgress >= 1.0) {
            animProgress = 1.0;
            isAnimating = false;
        }
        updateEngine();
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
