'use strict';

const xMin = -10.0;
const xMax = 10.0;
const dx = 0.1;

let currentOrder = 1;
let selectedFunction = 'sin';
let centerPoint = 0.0; // 근사의 중심점 (a)

let mainChart, errorChart;

// DOM 캐싱
const orderInput = document.getElementById('orderInput');
const orderVal = document.getElementById('orderVal');
const funcSelect = document.getElementById('funcSelect');
const centerInput = document.getElementById('centerInput');
const centerVal = document.getElementById('centerVal');

// 대상 함수 정의 및 테일러 급수 항 계산기
const TargetFunctions = {
    sin: {
        name: 'f(x) = sin(x)',
        calc: (x) => Math.sin(x),
        latex: (n, a) => getTaylorLatex('sin', n, a)
    },
    cos: {
        name: 'f(x) = cos(x)',
        calc: (x) => Math.cos(x),
        latex: (n, a) => getTaylorLatex('cos', n, a)
    },
    exp: {
        name: 'f(x) = e^x',
        calc: (x) => Math.exp(x),
        latex: (n, a) => getTaylorLatex('exp', n, a)
    },
    ln: {
        name: 'f(x) = ln(1+x)',
        calc: (x) => (x > -1 ? Math.log(1 + x) : null),
        latex: (n, a) => getTaylorLatex('ln', n, a)
    }
};

// 팩토리얼 연산
function factorial(n) {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

// n차 미분계수 f^(n)(a) 구하기
function getDerivativeAt(func, n, a) {
    switch (func) {
        case 'sin':
            // sin, cos, -sin, -cos 반복
            return Math.sin(a + (n * Math.PI) / 2);
        case 'cos':
            // cos, -sin, -cos, sin 반복
            return Math.cos(a + (n * Math.PI) / 2);
        case 'exp':
            return Math.exp(a);
        case 'ln':
            if (n === 0) return Math.log(1 + a);
            // d^n/dx^n (ln(1+x)) = (-1)^(n-1) * (n-1)! / (1+x)^n
            return (Math.pow(-1, n - 1) * factorial(n - 1)) / Math.pow(1 + a, n);
    }
    return 0;
}

// 테일러 다항식 계산 P_n(x)
function calcTaylorPolynomial(func, maxN, a, x) {
    let sum = 0;
    for (let n = 0; n <= maxN; n++) {
        const coef = getDerivativeAt(func, n, a) / factorial(n);
        sum += coef * Math.pow(x - a, n);
    }
    return sum;
}

// 앱 초기화
initCharts();
updateSimulation();

function initCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    mainChart = new Chart(document.getElementById('mainChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: '원본 초월함수 f(x)', data: [], borderColor: '#38bdf8', borderWidth: 2.5, pointRadius: 0 },
                { label: '테일러 근사 다항식 P(x)', data: [], borderColor: '#10b981', borderWidth: 2.5, pointRadius: 0 },
                { label: '근사의 중심점 (a)', data: [], backgroundColor: '#f43f5e', pointRadius: 6, showLine: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', min: xMin, max: xMax },
                y: { min: -5.0, max: 5.0 }
            },
            animation: false
        }
    });

    errorChart = new Chart(document.getElementById('errorChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: '절대 오차 |f(x) - P(x)|', data: [], borderColor: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.1)', fill: true, borderWidth: 1.5, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', min: xMin, max: xMax },
                y: { min: 0, max: 5.0 }
            },
            animation: false
        }
    });
}

function updateSimulation() {
    const origData = [];
    const approxData = [];
    const errorData = [];

    const currentFunc = TargetFunctions[selectedFunction];

    for (let x = xMin; x <= xMax; x += dx) {
        const yOrig = currentFunc.calc(x);
        
        // ln(1+x)의 정의역 제한 처리
        if (selectedFunction === 'ln' && x <= -1) continue;
        
        const yApprox = calcTaylorPolynomial(selectedFunction, currentOrder, centerPoint, x);

        if (yOrig !== null && !isNaN(yOrig)) {
            origData.push({ x: x, y: yOrig });
            approxData.push({ x: x, y: yApprox });
            errorData.push({ x: x, y: Math.abs(yOrig - yApprox) });
        }
    }

    mainChart.data.datasets[0].data = origData;
    mainChart.data.datasets[1].data = approxData;
    mainChart.data.datasets[2].data = [{ x: centerPoint, y: currentFunc.calc(centerPoint) }];
    mainChart.update();

    errorChart.data.datasets[0].data = errorData;
    errorChart.update();

    updateFormulaUI();
}

// 수식 대시보드 텍스트 매핑
function getTaylorLatex(func, maxN, a) {
    let baseStr = `P_${maxN}(x) = `;
    const terms = [];

    for (let n = 0; n <= Math.min(maxN, 4); n++) {
        const dVal = getDerivativeAt(func, n, a);
        if (Math.abs(dVal) < 0.001) continue;

        let coefStr = '';
        const fact = factorial(n);
        
        if (n === 0) {
            coefStr = `${dVal.toFixed(2)}`;
        } else {
            coefStr = `${(dVal / fact).toFixed(2)}`;
        }

        let xStr = '';
        if (n > 0) {
            xStr = a === 0 ? `·x^${n}` : `·(x - ${a.toFixed(1)})^${n}`;
        }
        terms.push(`${coefStr}${xStr}`);
    }

    if (maxN > 4) terms.push('... (이하 생략)');
    return baseStr + terms.join(' + ').replace(/\+ -/g, '- ');
}

function updateFormulaUI() {
    document.getElementById('formula-target').innerText = TargetFunctions[selectedFunction].name;
    document.getElementById('formula-poly').innerText = TargetFunctions[selectedFunction].latex(currentOrder, centerPoint);
    document.getElementById('formula-curr-info').innerText = `차수: ${currentOrder}차 | 중심점 a = ${centerPoint.toFixed(2)}`;
}

// 이벤트 리스너 바인딩
orderInput.addEventListener('input', (e) => {
    currentOrder = parseInt(e.target.value);
    orderVal.innerText = currentOrder;
    updateSimulation();
});

funcSelect.addEventListener('change', (e) => {
    selectedFunction = e.target.value;
    // ln(1+x) 선택 시 중심점 범위 안전지대로 강제 조정
    if (selectedFunction === 'ln' && centerPoint <= -0.9) {
        centerPoint = 0.0;
        centerInput.value = 0.0;
        centerVal.innerText = "0.0";
    }
    updateSimulation();
});

centerInput.addEventListener('input', (e) => {
    centerPoint = parseFloat(e.target.value);
    if (selectedFunction === 'ln' && centerPoint <= -0.9) {
        centerPoint = -0.9; // ln 안전선 보장
    }
    centerVal.innerText = centerPoint.toFixed(1);
    updateSimulation();
});

// 프리셋 버튼 이벤트
document.getElementById('presetMaclaurin').addEventListener('click', () => {
    centerPoint = 0.0;
    centerInput.value = 0.0;
    centerVal.innerText = "0.0";
    currentOrder = 5;
    orderInput.value = 5;
    orderVal.innerText = "5";
    updateSimulation();
});

document.getElementById('presetHighOrder').addEventListener('click', () => {
    currentOrder = 12;
    orderInput.value = 12;
    orderVal.innerText = "12";
    updateSimulation();
});
