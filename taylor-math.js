const TaylorMath = {
    // 팩토리얼 계산
    factorial: function(num) {
        if (num <= 1) return 1;
        let res = 1;
        for (let i = 2; i <= num; i++) res *= i;
        return res;
    },

    // 원본 초월함수 실시간 값 계산
    getOriginalValue: function(func, x) {
        if (func === 'sin') return Math.sin(x);
        if (func === 'cos') return Math.cos(x);
        if (func === 'exp') return Math.exp(x);
        return 0;
    },

    // 특정 n차 단독 항의 기여량값 계산 (f^(n)(0)/n! * x^n)
    getSingleTermValue: function(func, x, n, weight = 1.0) {
        let coeff = 0;
        if (func === 'sin') {
            if (n % 2 === 1) {
                let k = (n - 1) / 2;
                coeff = Math.pow(-1, k) / this.factorial(n);
            }
        } else if (func === 'cos') {
            if (n % 2 === 0) {
                let k = n / 2;
                coeff = Math.pow(-1, k) / this.factorial(n);
            }
        } else if (func === 'exp') {
            coeff = 1.0 / this.factorial(n);
        }
        return coeff * Math.pow(x, n) * weight;
    },

    // 0차항부터 특정 차수 n까지 누적 결합된 테일러 다항식 P_n(x)의 총합 값 계산
    getAccumulatedValue: function(func, x, maxN, weights = {}) {
        let sum = 0;
        for(let i = 0; i <= maxN; i++) {
            let w = weights[i] !== undefined ? weights[i] : 1.0;
            sum += this.getSingleTermValue(func, x, i, w);
        }
        return sum;
    }
};
