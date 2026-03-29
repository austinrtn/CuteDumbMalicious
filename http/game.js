const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

// ── State ──

const G = {
    phase: "waiting",
    playerName: "",
    roundInfo: null,
    scores: null,
    roundResult: null,
    hand: [],
    selectedCards: [],
    selectedIndices: [],
    swapOptions: [],
    swapSelectedCard: null,
    isPortrait: false,
};

const hitRects = {
    hand: [],
    submit: null,
    swapCards: [],
    swapConfirm: null,
};

let animCards = [];
let animationId = null;
let swapPendingTimer = null;

// ── Layout Helpers ──

function getLogicalSize() {
    const sw = window.innerWidth, sh = window.innerHeight;
    return G.isPortrait ? { w: sh, h: sw } : { w: sw, h: sh };
}

function computeCardLayout(count, opts) {
    const maxCardW = opts?.maxCardW ?? 80;
    const maxCardH = opts?.maxCardH ?? 120;
    const maxGap   = opts?.maxGap   ?? 12;
    const padding  = opts?.padding  ?? 20;
    const { w, h } = getLogicalSize();

    const availableW = w - padding * 2;
    const idealW = count * maxCardW + (count - 1) * maxGap;
    const scale = Math.min(1, availableW / idealW);
    const cardW = Math.floor(maxCardW * scale);
    const cardH = Math.floor(maxCardH * scale);
    const gap   = Math.floor(maxGap * scale);
    const totalW = count * cardW + (count - 1) * gap;
    const startX = (w - totalW) / 2;
    const baseY  = opts?.baseY ?? (h - cardH - 20);

    const rects = [];
    for (let i = 0; i < count; i++)
        rects.push({ x: startX + i * (cardW + gap), y: baseY, w: cardW, h: cardH, scale });
    return rects;
}

// ── State Management ──

function resetRound() {
    G.hand = [];
    G.selectedCards = [];
    G.selectedIndices = [];
    G.roundResult = null;
    G.swapOptions = [];
    G.swapSelectedCard = null;
    if (swapPendingTimer) { clearTimeout(swapPendingTimer); swapPendingTimer = null; }
    stopAnimation();
    hitRects.hand = [];
    hitRects.submit = null;
    hitRects.swapCards = [];
    hitRects.swapConfirm = null;
}

// ── Animation System ──

function startAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(animationTick);
}

function stopAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    animCards = [];
}

function animationTick() {
    let allDone = true;

    for (const ac of animCards) {
        if (ac.done) continue;
        ac.frame++;
        if (ac.frame < ac.delay) { allDone = false; continue; }

        switch (ac.type) {
            case "submit_flyout":
                ac.y += ac.vy;
                ac.vy -= 0.5;
                ac.done = (ac.y + ac.h < -50);
                break;
            case "swap_flyout":
                ac.y += ac.vy;
                ac.vy -= 0.3;
                ac.done = (ac.y + ac.h < -50);
                break;
            case "swap_flyin":
            case "swap_settle":
                ac.x += (ac.targetX - ac.x) * 0.12;
                ac.y += (ac.targetY - ac.y) * 0.12;
                if (Math.abs(ac.x - ac.targetX) < 1 && Math.abs(ac.y - ac.targetY) < 1) {
                    ac.x = ac.targetX;
                    ac.y = ac.targetY;
                    ac.done = true;
                }
                break;
        }

        if (!ac.done) allDone = false;
    }

    drawGame();

    if (allDone) {
        const completed = [...animCards];
        animCards = [];
        animationId = null;
        onAnimationComplete(completed);
        return;
    }

    animationId = requestAnimationFrame(animationTick);
}

function onAnimationComplete(completed) {
    const types = new Set(completed.map(c => c.type));

    if (types.has("submit_flyout")) {
        submitHand();
        drawGame();
        return;
    }

    if (types.has("swap_flyin")) {
        drawGame();
        return;
    }

    if (types.has("swap_flyout") || types.has("swap_settle")) {
        for (const ac of completed) {
            if (ac.type === "swap_settle" && ac.targetIndex >= 0) {
                ac.card.held = true;
                G.hand.push(ac.card);
            }
        }
        G.swapOptions = [];
        G.swapSelectedCard = null;
        G.phase = "cards_dealt";
        drawGame();
        return;
    }
}

// ── Canvas Setup ──

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    G.isPortrait = w < h;

    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.transform = "";
    canvas.style.transformOrigin = "";
    canvas.style.position = "";
    canvas.style.top = "";
    canvas.style.left = "";

    if (canvas.style.display !== "none") {
        if (typeof displayActive !== "undefined" && displayActive) {
            drawDisplay();
        } else {
            drawGame();
        }
    }
}

// ── Drawing ──

function drawBackground(w, h) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.5, "#1e2a4a");
    grad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}

function drawGame() {
    if (typeof displayActive !== "undefined" && displayActive) return;
    const dpr = window.devicePixelRatio || 1;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    let w, h;
    if (G.isPortrait) {
        ctx.translate(screenW, 0);
        ctx.rotate(Math.PI / 2);
        w = screenH;
        h = screenW;
    } else {
        w = screenW;
        h = screenH;
    }

    drawBackground(w, h);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "28px 'Black Han Sans', sans-serif";

    if (G.phase === "waiting") {
        ctx.fillText("Waiting for other player...", w / 2, h / 2);
    } else if (G.phase === "connected") {
        ctx.fillText("Both players connected!", w / 2, h / 2);
    } else if (G.phase === "cards_dealt" || G.phase === "hand_submitted") {
        drawHand(w, h);
        if (G.scores) drawScores(w, h);
        drawSuitTotals(w, h);
    } else if (G.phase === "swap_pending") {
        drawHand(w, h);
        if (G.scores) drawScores(w, h);
    } else if (G.phase === "swap_selection" || G.phase === "swap_animating_out") {
        drawHand(w, h);
        if (G.scores) drawScores(w, h);
        drawSwapOptions(w, h);
    } else if (G.phase === "showing_results") {
        drawHand(w, h);
        if (G.scores) drawScores(w, h);
        drawResults(w, h);
    }
}

function suitLabel(suit) {
    switch (suit) {
        case "CUTE":     return "Cute";
        case "DUMB":     return "Dumb";
        case "MALICOUS": return "Mal";
        default:         return suit;
    }
}

function suitColor(suit) {
    switch (suit) {
        case "CUTE":     return "#e74c8b";
        case "DUMB":     return "#3b82f6";
        case "MALICOUS": return "#8b5cf6";
        default:         return "#222";
    }
}

function drawScores(w, h) {
    ctx.font = "bold 20px 'Black Han Sans', sans-serif";
    ctx.fillStyle = "#fff";

    ctx.textAlign = "left";
    ctx.fillText(G.scores.player1Name + ": " + G.scores.player1Points, 20, 35);

    ctx.textAlign = "right";
    ctx.fillText(G.scores.player2Name + ": " + G.scores.player2Points, w - 20, 35);
}

function drawSuitTotals(w, h) {
    const totals = { CUTE: 0, DUMB: 0, MALICOUS: 0 };
    for (const card of G.selectedCards) {
        totals[card.primary.suit]   += card.primary.val;
        totals[card.secondary.suit] += card.secondary.val;
        totals[card.tertiary.suit]  += card.tertiary.val;
    }

    if (G.roundInfo) {
        ctx.fillStyle = "#aaa";
        ctx.font = "bold 18px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Round " + G.roundInfo.current + "/" + G.roundInfo.total, w / 2, 35);
    }

    const midY = (50 + (h - 140)) / 2;
    ctx.font = "bold 48px 'Black Han Sans', sans-serif";
    ctx.textAlign = "center";
    ["CUTE", "DUMB", "MALICOUS"].forEach((suit, i) => {
        ctx.fillStyle = suitColor(suit);
        ctx.fillText(String(totals[suit]), w / 2 + (i - 1) * 100, midY);
    });
}

function drawCard(x, y, cardW, cardH, card, fontScale) {
    ctx.fillStyle = "#f5f5f0";
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 6 * fontScale);
    ctx.fill();
    ctx.stroke();

    const rows = [card.primary, card.secondary, card.tertiary];
    const startY = y + 22 * fontScale;
    const rowH = 24 * fontScale;

    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        ctx.fillStyle = suitColor(rows[i].suit);
        ctx.font = `bold ${Math.floor(13 * fontScale)}px 'Black Han Sans', sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(suitLabel(rows[i].suit), x + 6 * fontScale, ry);
        ctx.textAlign = "right";
        ctx.fillText(String(rows[i].val), x + cardW - 6 * fontScale, ry);
    }

    if (card.seal && card.seal !== "NONE") {
        ctx.fillStyle = "#999";
        ctx.font = `bold ${Math.floor(9 * fontScale)}px 'Black Han Sans', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(card.seal, x + cardW / 2, y + cardH - 8 * fontScale);
    }
}

function drawHand(w, h) {
    const layout = computeCardLayout(G.hand.length);
    if (layout.length === 0) return;

    hitRects.hand = [];
    for (let i = 0; i < G.hand.length; i++) {
        const r = layout[i];
        const isSelected = G.selectedCards.indexOf(G.hand[i]) !== -1;
        const x = r.x;
        const y = isSelected ? r.y - 20 : r.y;

        if (isSelected) {
            ctx.strokeStyle = "#2ecc71";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(x - 2, y - 2, r.w + 4, r.h + 4, 8);
            ctx.stroke();
        }

        drawCard(x, y, r.w, r.h, G.hand[i], r.scale);
        hitRects.hand.push({ x, y, w: r.w, h: r.h, scale: r.scale, index: i });
    }

    // Submit button
    hitRects.submit = null;
    if (G.selectedCards.length === 5 && G.phase === "cards_dealt") {
        const btnW = 140;
        const btnH = 40;
        const btnX = w / 2 - btnW / 2;
        const btnY = layout[0].y - 80;

        ctx.fillStyle = "#2ecc71";
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 8);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Submit", btnX + btnW / 2, btnY + 27);

        hitRects.submit = { x: btnX, y: btnY, w: btnW, h: btnH };
    }

    // Draw animating submit cards on top
    for (const ac of animCards) {
        if (ac.type === "submit_flyout") {
            drawCard(ac.x, ac.y, ac.w, ac.h, ac.card, ac.scale);
        }
    }
}

function drawSwapOptions(w, h) {
    if (G.swapOptions.length === 0) return;

    const { w: lw, h: lh } = getLogicalSize();
    const handBaseY = lh - 120 - 20;
    const swapLayout = computeCardLayout(G.swapOptions.length, { maxGap: 16, baseY: handBaseY - 120 - 50 });
    if (swapLayout.length === 0) return;
    const swapY = swapLayout[0].y;

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px 'Black Han Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Select a card", w / 2, swapY - 15);

    // Animating cards (fly-in or fly-out)
    const swapAnims = animCards.filter(c =>
        c.type === "swap_flyin" || c.type === "swap_flyout" || c.type === "swap_settle"
    );
    if (swapAnims.length > 0) {
        for (const ac of swapAnims) {
            if (ac.frame >= ac.delay) {
                drawCard(ac.x, ac.y, ac.w, ac.h, ac.card, ac.scale);
            }
        }
        return;
    }

    // Static swap option cards (clickable)
    hitRects.swapCards = [];
    for (let i = 0; i < G.swapOptions.length; i++) {
        const card = G.swapOptions[i];
        const r = swapLayout[i];
        const isSelected = G.swapSelectedCard && G.swapSelectedCard.id === card.id;

        if (isSelected) {
            ctx.strokeStyle = "#2ecc71";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 8);
            ctx.stroke();
        }

        drawCard(r.x, r.y, r.w, r.h, card, r.scale);
        hitRects.swapCards.push({ x: r.x, y: r.y, w: r.w, h: r.h, scale: r.scale, card });
    }

}

function drawResults(w, h) {
    if (!G.roundResult) return;

    const centerX = w / 2;
    const centerY = h / 2;

    const p1 = G.roundResult.p1;
    const p2 = G.roundResult.p2;
    const boxW = 180;
    const gap = 40;

    const p1x = centerX - boxW - gap / 2;
    const p2x = centerX + gap / 2;
    const boxY = centerY - 60;

    [{ player: p1, bx: p1x }, { player: p2, bx: p2x }].forEach(({ player, bx }) => {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.roundRect(bx, boxY, boxW, 120, 8);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(player.player, bx + boxW / 2, boxY + 22);

        const suits = [
            { label: "Cute", val: player.cute, color: suitColor("CUTE") },
            { label: "Dumb", val: player.dumb, color: suitColor("DUMB") },
            { label: "Mal",  val: player.malicous, color: suitColor("MALICOUS") },
        ];

        ctx.font = "13px 'Black Han Sans', sans-serif";
        suits.forEach((s, i) => {
            const ry = boxY + 42 + i * 18;
            ctx.fillStyle = s.color;
            ctx.textAlign = "left";
            ctx.fillText(s.label, bx + 12, ry);
            ctx.textAlign = "right";
            ctx.fillText(String(s.val), bx + boxW - 12, ry);
        });

        ctx.fillStyle = "#f1c40f";
        ctx.font = "bold 14px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Total: " + player.total, bx + boxW / 2, boxY + 110);
    });

    ctx.fillStyle = "#555";
    ctx.font = "bold 20px 'Black Han Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VS", centerX, boxY + 60);

    ctx.font = "bold 28px 'Black Han Sans', sans-serif";
    if (p1.total > p2.total) {
        ctx.fillStyle = "#2ecc71";
        ctx.fillText(p1.player + " wins!", centerX, boxY - 20);
    } else if (p2.total > p1.total) {
        ctx.fillStyle = "#2ecc71";
        ctx.fillText(p2.player + " wins!", centerX, boxY - 20);
    } else {
        ctx.fillStyle = "#f1c40f";
        ctx.fillText("DRAW!", centerX, boxY - 20);
    }
}

// ── Input ──

function getCanvasXY(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (G.isPortrait) {
        return { x: clientY, y: window.innerWidth - clientX };
    }
    return { x: clientX, y: clientY };
}

function onCanvasClick(e) {
    e.preventDefault();
    const pos = getCanvasXY(e);

    if (G.phase === "showing_results") {
        G.roundResult = null;
        G.phase = "waiting";
        drawGame();
        signalReady();
        return;
    }

    if (G.phase === "swap_selection") {
        for (let i = hitRects.swapCards.length - 1; i >= 0; i--) {
            const r = hitRects.swapCards[i];
            if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
                G.swapSelectedCard = r.card;
                submitSwapResult();
                return;
            }
        }
        return;
    }

    if (G.phase !== "cards_dealt") return;

    if (hitRects.submit) {
        const b = hitRects.submit;
        if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
            launchSelectedCards();
            return;
        }
    }

    for (let i = hitRects.hand.length - 1; i >= 0; i--) {
        const r = hitRects.hand[i];
        if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
            const card = G.hand[r.index];
            const idx = G.selectedCards.indexOf(card);

            if (idx !== -1) {
                G.selectedCards.splice(idx, 1);
            } else if (G.selectedCards.length < 5) {
                G.selectedCards.push(card);
            }

            drawGame();
            return;
        }
    }
}

canvas.addEventListener("click", onCanvasClick);
canvas.addEventListener("touchstart", function(e) {
    e.preventDefault();
    onCanvasClick(e);
});

// ── Actions ──

function launchSelectedCards() {
    G.selectedIndices = [];
    for (let i = hitRects.hand.length - 1; i >= 0; i--) {
        const r = hitRects.hand[i];
        const card = G.hand[r.index];
        if (G.selectedCards.indexOf(card) !== -1) {
            animCards.push({
                type: "submit_flyout",
                card,
                x: r.x, y: r.y, w: r.w, h: r.h, scale: r.scale,
                vy: -12 - Math.random() * 6,
                delay: 0, frame: 0, done: false,
            });
            G.selectedIndices.push(r.index);
        }
    }

    G.hand = G.hand.filter(c => G.selectedCards.indexOf(c) === -1);
    G.phase = "hand_submitted";
    startAnimation();
}

function beginSwapAfterDelay() {
    // Show the hand for a moment before presenting swap options
    if (swapPendingTimer) clearTimeout(swapPendingTimer);
    G.phase = "swap_pending";
    drawGame();
    swapPendingTimer = setTimeout(() => {
        swapPendingTimer = null;
        G.phase = "swap_selection";
        spawnSwapFlyIn();
    }, 300);
}

function spawnSwapFlyIn() {
    const { w: lw, h: lh } = getLogicalSize();
    const handBaseY = lh - 120 - 20;
    const swapY = handBaseY - 120 - 50;
    const layout = computeCardLayout(G.swapOptions.length, { maxGap: 16, baseY: swapY });

    animCards = [];
    for (let i = 0; i < G.swapOptions.length; i++) {
        const t = layout[i];
        animCards.push({
            type: "swap_flyin",
            card: G.swapOptions[i],
            x: t.x,
            y: -t.h - 20,
            w: t.w, h: t.h, scale: t.scale,
            targetX: t.x,
            targetY: t.y,
            delay: i * 6, frame: 0, done: false,
        });
    }
    startAnimation();
}

function submitSwapResult() {
    const selected = G.swapSelectedCard;
    const selectedId = selected.id;
    const discarded = G.swapOptions.filter(c => c.id !== selectedId);

    G.phase = "swap_animating_out";

    // Target slot is the next position (7th card appended to 6-card hand)
    const newIndex = G.hand.length;
    const handLayout = computeCardLayout(newIndex + 1);
    const targetSlot = { ...handLayout[newIndex], index: newIndex };

    // Build animation cards from current hitRects
    animCards = [];
    for (const rect of hitRects.swapCards) {
        const isSelected = rect.card.id === selectedId;
        animCards.push({
            type: isSelected ? "swap_settle" : "swap_flyout",
            card: rect.card,
            x: rect.x, y: rect.y, w: rect.w, h: rect.h, scale: rect.scale,
            targetX: isSelected ? targetSlot.x : rect.x,
            targetY: isSelected ? targetSlot.y : 0,
            vy: isSelected ? 0 : -8 - Math.random() * 4,
            targetIndex: isSelected ? targetSlot.index : -1,
            delay: 0, frame: 0, done: false,
        });
    }

    hitRects.swapCards = [];
    hitRects.swapConfirm = null;
    startAnimation();

    fetch("/processSwapResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            Player: G.playerName,
            Discarded: discarded,
            Selected: selected,
        }),
    }).catch(err => console.error("swap submit failed:", err));
}

// ── SSE ──

function onServerEvent(e) {
    const msg = e.data;

    if (msg.startsWith('round:')) {
        const parts = msg.slice(6).split('/');
        G.roundInfo = { current: parseInt(parts[0]), total: parseInt(parts[1]) };
        if (!G.scores) {
            G.scores = {
                player1Name: parts[2],
                player1Points: 0,
                player2Name: parts[3],
                player2Points: 0,
            };
        }
        return;
    }

    if (msg.startsWith('hand:')) {
        const pendingSwap = G.swapOptions;
        resetRound();
        G.hand = JSON.parse(msg.slice(5));
        G.phase = "cards_dealt";
        drawGame();

        // If swap options arrived before hand (edge case),
        // restore them and trigger the swap flow
        if (pendingSwap.length > 0) {
            G.swapOptions = pendingSwap;
            beginSwapAfterDelay();
        }
        return;
    }

    if (msg.startsWith('result:')) {
        G.roundResult = JSON.parse(msg.slice(7));
        G.scores = {
            player1Name: G.roundResult.p1.player,
            player1Points: G.roundResult.p1.total,
            player2Name: G.roundResult.p2.player,
            player2Points: G.roundResult.p2.total,
        };
        G.phase = "showing_results";
        drawGame();
        return;
    }

    if (msg.startsWith('swap_options:')) {
        G.swapOptions = JSON.parse(msg.slice(13));
        G.swapSelectedCard = null;
        hitRects.swapCards = [];
        hitRects.swapConfirm = null;

        console.log("swap_options received, hand.length=" + G.hand.length + ", phase=" + G.phase);

        if (G.hand.length >= 6) {
            beginSwapAfterDelay();
        }
        return;
    }

    if (msg === "connection_established") {
        console.log("Connection to backend established!");
    } else if (msg === "lobby_full") {
        G.phase = "connected";
        drawGame();
    }
}

// ── Network ──

function submitHand() {
    fetch("/submitHand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            player: G.playerName,
            card_indices: G.selectedIndices,
        }),
    })
    .then(res => console.log("Hand submitted: " + res.status))
    .catch(err => console.error("submit failed:", err));
}

function signalReady() {
    fetch("/readyForNextRound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: G.playerName }),
    })
    .then(res => console.log("Ready signal sent: " + res.status))
    .catch(err => console.error("ready signal failed:", err));
}

// ── Lifecycle ──

function startGame(name, sse) {
    displayActive = false;
    G.playerName = name;
    G.phase = "waiting";
    document.getElementById("menu-root").style.display = "none";
    canvas.style.display = "block";

    sse.onmessage = onServerEvent;
    sse.onerror = () => {
        sse.close();
        canvas.style.display = "none";
        document.getElementById("menu-root").style.display = "";
        if (typeof onDisconnect === "function") onDisconnect();
    };

    resizeCanvas();
}

// ── Window Events ──

window.addEventListener("resize", () => {
    if (canvas.style.display !== "none") {
        resizeCanvas();
    }
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden && canvas.style.display !== "none") {
        drawGame();
    }
});
