// ═══════════════════════════════════════════════════════
//  EXPRESSION EVALUATOR
//  Supports: sin,cos,tan,log,ln,sqrt,π,e,^,x,y
// ═══════════════════════════════════════════════════════
function evalExpr(expr, vars = {}, isRadians = true) {
    try {
        let e = String(expr).trim();
        if (!e) return NaN;

        // Handle Implicit Multiplication (e.g., 5x -> 5*x, (x)(y) -> (x)*(y))
        // 1. Number followed by variable/constant: 5x, 5π, 5e
        e = e.replace(/(\d+)([xyeπ(])/g, '$1*$2');
        // 2. Parentheses interactions: (x)(y) -> (x)*(y), 5(x) -> 5*(x), (x)5 -> (x)*5
        e = e.replace(/\)\(/g, ')*(');
        e = e.replace(/\)([0-9xyeπ])/g, ')*$1');
        e = e.replace(/(\d)\(/g, '$1*(');

        // Replace π and e constants
        e = e.replace(/π/g, `(${Math.PI})`);
        e = e.replace(/(?<![a-zA-Z0-9_.])e(?![a-zA-Z0-9_(])/g, `(${Math.E})`);

        // Replace scientific functions with Math.xxx
        const funcs = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs'];
        funcs.forEach(f => {
            const regex = new RegExp(`\\b${f}\\b`, 'g');
            // Check for implicit mult before function: e.g., 5sin(x) -> 5*sin(x)
            e = e.replace(new RegExp(`(\\d)(${f})`, 'g'), '$1*$2');
            e = e.replace(new RegExp(`(\\))(${f})`, 'g'), '$1*$2');

            if (f === 'ln') e = e.replace(regex, 'Math.log');
            else if (f === 'log') e = e.replace(regex, 'Math.log10');
            else if (['sin', 'cos', 'tan'].includes(f) && !isRadians) {
                e = e.replace(regex, `(v => Math.${f}(v * Math.PI / 180))`);
            } else {
                e = e.replace(regex, `Math.${f}`);
            }
        });

        // Replace variables (x, y)
        for (const [name, val] of Object.entries(vars)) {
            // Variable followed by variable or number: x y, x 5
            e = e.replace(new RegExp(`(\\b${name}\\b)([0-9xyeπ(])`, 'g'), `$1*$2`);
            e = e.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${val})`);
        }

        // Replace ^ with **
        e = e.replace(/\^/g, '**');

        // Handle percentage: 50% -> 50*0.01
        e = e.replace(/([0-9xyeπ)])%/g, '$1*0.01');

        // Safe eval using Function
        return Function(`"use strict"; return (${e})`)();
    } catch (err) {
        return NaN;
    }
}

// ═══════════════════════════════════════════════════════
//  ROOT FINDER (Numerical solver)
// ═══════════════════════════════════════════════════════
function findRoots(expr, isRadians = true) {
    const f = xv => evalExpr(expr, { x: xv }, isRadians);
    const roots = [];
    const min = -100, max = 100, steps = 1000;

    for (let i = 0; i < steps; i++) {
        let x1 = min + (i / steps) * (max - min);
        let x2 = min + ((i + 1) / steps) * (max - min);
        let y1 = f(x1), y2 = f(x2);

        if (isFinite(y1) && isFinite(y2) && y1 * y2 <= 0) {
            // Bisection
            for (let j = 0; j < 20; j++) {
                let mid = (x1 + x2) / 2;
                if (f(x1) * f(mid) <= 0) x2 = mid;
                else x1 = mid;
            }
            let root = Math.round((x1 + x2) / 2 * 1000) / 1000;
            if (!roots.includes(root)) roots.push(root);
        }
    }
    return roots;
}

class Calculator {
    constructor(prevEl, currEl, solveEl, fnEl) {
        this.prevEl = prevEl;
        this.currEl = currEl;
        this.solveEl = solveEl;
        this.fnEl = fnEl; // Now this is a div, not an input!
        this.fnContainer = document.querySelector('.function-section');
        this.displayContainer = document.querySelector('.display');

        this.isRadians = true;
        this.calcExpr = ''; // Main expression
        this.funcExpr = ''; // f(x) expression
        this.activeTarget = 'main';
        this.calcCursorPos = 0;
        this.funcCursorPos = 0;

        this.initSelection();
        this.reset();
    }

    // Toggle target between main display and f(x) box
    initSelection() {
        const setTarget = (type) => {
            this.activeTarget = type;
            if (type === 'fn') {
                this.fnContainer.classList.add('active-session');
                this.displayContainer.classList.remove('active-session');
            } else {
                this.displayContainer.classList.add('active-session');
                this.fnContainer.classList.remove('active-session');
            }
            this.updateDisplay();
        };

        this.fnContainer.onclick = (e) => { e.stopPropagation(); setTarget('fn'); };
        this.displayContainer.onclick = (e) => { e.stopPropagation(); setTarget('main'); };

        setTarget('main');
    }

    get expr() {
        return this.activeTarget === 'main' ? this.calcExpr : this.funcExpr;
    }
    set expr(val) {
        if (this.activeTarget === 'main') this.calcExpr = val;
        else this.funcExpr = val;
    }

    get cursorPos() {
        return this.activeTarget === 'main' ? this.calcCursorPos : this.funcCursorPos;
    }
    set cursorPos(val) {
        if (this.activeTarget === 'main') this.calcCursorPos = val;
        else this.funcCursorPos = val;
    }

    reset() {
        this.calcExpr = '';
        this.funcExpr = '';
        this.updateDisplay();
        this.hideSolve();
        this.hideGraph();
    }

    updateDisplay() {
        this.renderToElement(this.currEl, this.calcExpr, this.activeTarget === 'main');
        if (this.fnEl) {
            this.renderToElement(this.fnEl, this.funcExpr, this.activeTarget === 'fn');
        }
    }

    renderToElement(el, text, isActive) {
        let cursorHtml = isActive ? '<span class="calc-cursor"></span>' : '';
        let isMain = el === this.currEl;

        if (!text) {
            el.innerHTML = (isMain ? '0' : '') + cursorHtml;
            return;
        }

        const pos = isActive ? this.cursorPos : text.length;
        let before = text.substring(0, pos);
        let after = text.substring(pos);

        const format = (t) => t.replace(/\*/g, '×').replace(/\//g, '÷').replace(/\^([0-9xyeπ\.]+)/g, '<sup>$1</sup>');

        let beforeHtml = format(before);
        let afterHtml = format(after);

        if (isActive && before.endsWith('^')) {
            el.innerHTML = format(before) + `<sup>${cursorHtml}${format(after)}</sup>`;
        } else {
            el.innerHTML = beforeHtml + cursorHtml + afterHtml;
        }
        el.scrollLeft = el.scrollWidth;
    }

    moveCursor(dir) {
        if (dir === 'left' && this.cursorPos > 0) {
            this.cursorPos--;
        } else if (dir === 'right' && this.cursorPos < this.expr.length) {
            this.cursorPos++;
        }
        this.updateDisplay();
    }

    exitPower() {
        // Just move cursor to the end to "exit" superscript visually
        this.cursorPos = this.expr.length;
        this.updateDisplay();
    }

    // Insert text at current cursor position
    insertText(text) {
        let current = this.expr;
        this.expr = current.slice(0, this.cursorPos) + text + current.slice(this.cursorPos);
        this.cursorPos += text.length;
        this.updateDisplay();
    }

    appendNumber(n) {
        this.insertText(n);
    }

    appendOperator(op) {
        if (this.cursorPos === 0 && op !== '-') return;
        this.insertText(op);
    }

    appendFunction(f) {
        this.insertText(f + '(');
    }

    appendRParen() {
        const opens = (this.expr.match(/\(/g) || []).length;
        const closes = (this.expr.match(/\)/g) || []).length;
        if (opens > closes) {
            this.insertText(')');
        }
    }

    clear() {
        this.reset();
        this.cursorPos = 0;
        this.updateDisplay();
    }

    delete() {
        if (this.cursorPos > 0) {
            let current = this.expr;
            this.expr = current.slice(0, this.cursorPos - 1) + current.slice(this.cursorPos);
            this.cursorPos--;
            this.updateDisplay();
        }
    }

    calculate() {
        const targetExpr = this.calcExpr; // Use main expression for result
        if (!targetExpr) return;
        this.hideSolve();

        let finalExpr = targetExpr;
        const opens = (finalExpr.match(/\(/g) || []).length;
        const closes = (finalExpr.match(/\)/g) || []).length;
        finalExpr += ')'.repeat(Math.max(0, opens - closes));

        const res = evalExpr(finalExpr, {}, this.isRadians);
        this.prevEl.textContent = finalExpr + ' =';

        if (isNaN(res)) this.calcExpr = 'Error';
        else this.calcExpr = String(Math.round(res * 1e10) / 1e10);

        this.calcCursorPos = this.calcExpr.length;
        this.updateDisplay();
    }

    plot() {
        const targetExpr = this.funcExpr || this.calcExpr; // Prefer function box
        if (!targetExpr) return;

        const balanced = targetExpr + ')'.repeat(Math.max(0, (targetExpr.match(/\(/g) || []).length - (targetExpr.match(/\)/g) || []).length));
        const container = document.getElementById('canvas-container');
        const canvas = document.getElementById('graph-canvas');
        container.style.display = 'block';

        const ctx = canvas.getContext('2d');
        const W = canvas.width = container.clientWidth;
        const H = canvas.height = 150;

        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
        ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
        ctx.stroke();

        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.beginPath();

        let first = true;
        for (let i = 0; i <= W; i++) {
            let x = (i - W / 2) / (W / 20);
            let y = evalExpr(balanced, { x: x }, this.isRadians);
            if (isFinite(y)) {
                let cy = H / 2 - y * (H / 10);
                if (first) ctx.moveTo(i, cy);
                else ctx.lineTo(i, cy);
                first = false;
            }
        }
        ctx.stroke();
    }

    solve() {
        const targetExpr = this.funcExpr || this.calcExpr;
        if (!targetExpr) return;

        this.showSolve("Solving for x...");
        setTimeout(() => {
            const roots = findRoots(targetExpr, this.isRadians);
            if (roots.length === 0) this.showSolve("No roots found in [-100, 100]");
            else this.showSolve("Roots: " + roots.join(", "));
        }, 100);
    }

    toggleDegRad() {
        this.isRadians = !this.isRadians;
        const btn = document.getElementById('deg-rad-btn');
        btn.textContent = this.isRadians ? 'RAD' : 'DEG';
        btn.classList.toggle('deg-active', !this.isRadians);
    }

    showSolve(m) { this.solveEl.textContent = m; this.solveEl.style.display = 'block'; }
    hideSolve() { this.solveEl.style.display = 'none'; }
    hideGraph() { document.getElementById('canvas-container').style.display = 'none'; }
}

const calc = new Calculator(
    document.getElementById('previous-operand'),
    document.getElementById('current-operand'),
    document.getElementById('solve-result'),
    document.getElementById('function-display')
);

document.querySelector('.keypad').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.action;
    const n = b.dataset.number;

    if (n !== undefined) calc.appendNumber(n);
    else if (a === 'sin' || a === 'cos' || a === 'tan' || a === 'log' || a === 'ln' || a === 'sqrt') calc.appendFunction(a);
    else if (a === 'clear') calc.clear();
    else if (a === 'delete') calc.delete();
    else if (a === 'calculate') calc.calculate();
    else if (a === 'graph') calc.plot();
    else if (a === 'solve') calc.solve();
    else if (a === 'next') calc.exitPower();
    else if (a === 'percent') calc.insertText('%');
    else if (a === 'deg-rad') calc.toggleDegRad();
    else if (a === 'lparen') calc.appendNumber('(');
    else if (a === 'rparen') calc.appendRParen();
    else if (['add', 'subtract', 'multiply', 'divide', 'power'].includes(a)) {
        const ops = { add: '+', subtract: '-', multiply: '*', divide: '/', power: '^' };
        calc.appendOperator(ops[a]);
    }
});

// Global Keyboard Support
document.addEventListener('keydown', (e) => {
    // Basic shortcuts
    if (e.ctrlKey || e.metaKey) return;

    if (e.key >= '0' && e.key <= '9') calc.appendNumber(e.key);
    else if (e.key === '.') calc.appendNumber('.');
    else if (e.key === '+') calc.appendOperator('+');
    else if (e.key === '-') calc.appendOperator('-');
    else if (e.key === '*') calc.appendOperator('*');
    else if (e.key === '/') { e.preventDefault(); calc.appendOperator('/'); }
    else if (e.key === '^') calc.appendOperator('^');
    else if (e.key === '%') calc.insertText('%');
    else if (e.key === 'Enter') {
        e.preventDefault();
        if (calc.activeTarget === 'fn') calc.solve();
        else calc.calculate();
    }
    else if (e.key === 'Backspace') calc.delete();
    else if (e.key === 'Escape') calc.clear();
    else if (e.key === 'ArrowLeft') calc.moveCursor('left');
    else if (e.key === 'ArrowRight') calc.moveCursor('right');
    else if (e.key === 'x') calc.appendNumber('x');
    else if (e.key === 'y') calc.appendNumber('y');
    else if (e.key === ' ') { e.preventDefault(); calc.exitPower(); }
});

// Background animation
const bg = document.getElementById('bg-formulas');
const formulas = ['E=mc²', 'sin²θ+cos²θ=1', 'π≈3.14', 'eⁱπ+1=0', 'F=ma', 'a²+b²=c²'];
for (let i = 0; i < 35; i++) {
    const s = document.createElement('span');
    s.className = 'formula';
    s.textContent = formulas[i % formulas.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.top = Math.random() * 100 + 'vh';
    s.style.animationDuration = (15 + Math.random() * 20) + 's';
    s.style.animationDelay = (Math.random() * -20) + 's';
    bg.appendChild(s);
}