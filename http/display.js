// Display client — spectator view for shared screen between two players
// Always landscape — no portrait handling needed

var displayActive = false;
var displayPhase = "waiting"; // waiting, lobby_full, round_active, p1_submitted, p2_submitted, both_submitted, flipping, showing_results, fly_out

let dP1Name = "";
let dP2Name = "";
let dRoundInfo = null;  // {current, total}
let dScores = null;     // {p1Points, p2Points}
let dResult = null;     // SubmittedHandsResult
let dHands = null;      // [{player, cards:[5]}, {player, cards:[5]}]

let dP1Cards = []; // [{x, y, w, h, targetX, targetY, vx, vy, landed, delay, frame, flipProgress, cardData}]
let dP2Cards = [];
let dAnimationId = null;
let dPendingRound = null; // queued round msg while fly-out plays
let dPendingFlip = false; // queued flip waiting for fly-in to finish

function startDisplay(sse) {
    displayActive = true;
    displayPhase = "waiting";
    dP1Cards = [];
    dP2Cards = [];
    dResult = null;
    dHands = null;
    dScores = null;
    dRoundInfo = null;

    document.getElementById("menu-root").style.display = "none";
    canvas.style.display = "block";

    sse.onmessage = onDisplayEvent;
    sse.onerror = () => {
        sse.close();
        displayActive = false;
        canvas.style.display = "none";
        document.getElementById("menu-root").style.display = "";
        if (typeof onDisconnect === "function") onDisconnect();
    };

    resizeCanvas();
}

function onDisplayEvent(e) {
    const msg = e.data;

    if (msg === "lobby_full") {
        displayPhase = "lobby_full";
        drawDisplay();
        return;
    }

    if (msg.startsWith("round:")) {
        const parts = msg.slice(6).split("/");
        const info = {
            current: parseInt(parts[0]),
            total: parseInt(parts[1]),
            p1: parts[2],
            p2: parts[3],
        };

        if (displayPhase === "fly_out") {
            dPendingRound = info;
            return;
        }

        applyRoundInfo(info);
        return;
    }

    if (msg.startsWith("scores:")) {
        const parts = msg.slice(7).split("/");
        dScores = {
            p1Points: parseInt(parts[0]),
            p2Points: parseInt(parts[1]),
        };
        drawDisplay();
        return;
    }

    if (msg.startsWith("submitted:")) {
        const who = msg.slice(10);
        if (who === dP1Name) {
            spawnFlyInCards("p1");
        } else if (who === dP2Name) {
            spawnFlyInCards("p2");
        }

        if (displayPhase === "round_active") {
            displayPhase = (who === dP1Name) ? "p1_submitted" : "p2_submitted";
        } else if (displayPhase === "p1_submitted" || displayPhase === "p2_submitted") {
            displayPhase = "both_submitted";
        }
        startDisplayAnimation(animateFlyIn);
        return;
    }

    if (msg.startsWith("hands:")) {
        dHands = JSON.parse(msg.slice(6));
        return;
    }

    if (msg.startsWith("result:")) {
        dResult = JSON.parse(msg.slice(7));
        // If cards are still flying in, queue the flip for when they land
        // Otherwise start flipping immediately
        if (dHands) {
            assignCardData(dP1Cards, dHands[0].cards);
            assignCardData(dP2Cards, dHands[1].cards);
        }
        dPendingFlip = true;
        tryStartFlip();
        return;
    }

    if (msg === "next_round") {
        displayPhase = "fly_out";
        startFlyOutAnimation();
        return;
    }

    if (msg === "connection_established") {
        console.log("Display connected");
        drawDisplay();
    }
}

function applyRoundInfo(info) {
    dRoundInfo = { current: info.current, total: info.total };
    dP1Name = info.p1;
    dP2Name = info.p2;
    dP1Cards = [];
    dP2Cards = [];
    dResult = null;
    dHands = null;
    dPendingFlip = false;
    displayPhase = "round_active";
    drawDisplay();
}

function assignCardData(cards, handCards) {
    for (let i = 0; i < cards.length && i < handCards.length; i++) {
        cards[i].cardData = handCards[i];
        cards[i].flipProgress = 0; // 0 = face down, 1 = face up
    }
}

// --- Card Animations ---

function spawnFlyInCards(player) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cardW = 90;
    const cardH = 130;
    const gap = 18;
    const totalW = 5 * cardW + 4 * gap;
    const startX = (w - totalW) / 2;

    // P1 in lower third, P2 in upper third
    // Mirror positions: P2 at 8% from top, P1 at 8% from bottom (accounting for card height)
    const targetY = (player === "p1") ? h * 0.92 - cardH : h * 0.08;
    const spawnY = (player === "p1") ? h + cardH + 50 : -cardH - 50;

    const cards = [];
    for (let i = 0; i < 5; i++) {
        const tx = startX + i * (cardW + gap);
        cards.push({
            x: tx + (Math.random() - 0.5) * 40,
            y: spawnY,
            w: cardW,
            h: cardH,
            targetX: tx,
            targetY: targetY,
            vx: 0,
            vy: 0,
            landed: false,
            delay: i * 4,
            frame: 0,
            flipProgress: 0, // 0 = face down, 1 = face up
            cardData: null,
        });
    }

    if (player === "p1") dP1Cards = cards;
    else dP2Cards = cards;
}

function allCardsLanded() {
    const allCards = [...dP1Cards, ...dP2Cards];
    return allCards.length > 0 && allCards.every(c => c.landed);
}

function tryStartFlip() {
    if (!dPendingFlip) return;
    if (!allCardsLanded()) return;
    dPendingFlip = false;
    displayPhase = "flipping";
    startDisplayAnimation(animateFlip);
}

function startDisplayAnimation(fn) {
    if (dAnimationId) cancelAnimationFrame(dAnimationId);
    dAnimationId = null;
    fn();
}

function animateFlyIn() {
    let allLanded = true;
    const allCards = [...dP1Cards, ...dP2Cards];

    for (const card of allCards) {
        if (card.landed) continue;
        card.frame++;
        if (card.frame < card.delay) { allLanded = false; continue; }

        const lerp = 0.12;
        card.x += (card.targetX - card.x) * lerp;
        card.y += (card.targetY - card.y) * lerp;

        if (Math.abs(card.x - card.targetX) < 0.5 && Math.abs(card.y - card.targetY) < 0.5) {
            card.x = card.targetX;
            card.y = card.targetY;
            card.landed = true;
        } else {
            allLanded = false;
        }
    }

    drawDisplay();

    if (allLanded) {
        dAnimationId = null;
        tryStartFlip();
        return;
    }

    dAnimationId = requestAnimationFrame(animateFlyIn);
}

// Flip animation: scaleX shrinks to 0 (face-down disappears) then grows back (face-up appears)
function animateFlip() {
    let allDone = true;
    const allCards = [...dP1Cards, ...dP2Cards];

    for (const card of allCards) {
        if (card.flipProgress < 1) {
            card.flipProgress += 0.03;
            if (card.flipProgress > 1) card.flipProgress = 1;
            else allDone = false;
        }
    }

    drawDisplay();

    if (allDone) {
        dAnimationId = null;
        // Show results after a brief pause once flip completes
        setTimeout(() => {
            displayPhase = "showing_results";
            drawDisplay();
        }, 600);
        return;
    }

    dAnimationId = requestAnimationFrame(animateFlip);
}

function startFlyOutAnimation() {
    const allCards = [...dP1Cards, ...dP2Cards];
    for (const card of allCards) {
        card.vx = (Math.random() - 0.5) * 30;
        card.vy = (Math.random() - 0.5) * 30;
        card.landed = false;
    }
    startDisplayAnimation(animateFlyOut);
}

function animateFlyOut() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let allGone = true;
    const allCards = [...dP1Cards, ...dP2Cards];

    for (const card of allCards) {
        card.x += card.vx;
        card.y += card.vy;
        if (card.x + card.w > -100 && card.x < w + 100 &&
            card.y + card.h > -100 && card.y < h + 100) {
            allGone = false;
        }
    }

    drawDisplay();

    if (allGone) {
        dP1Cards = [];
        dP2Cards = [];
        dAnimationId = null;

        if (dPendingRound) {
            applyRoundInfo(dPendingRound);
            dPendingRound = null;
        } else {
            displayPhase = "waiting";
            drawDisplay();
        }
        return;
    }

    dAnimationId = requestAnimationFrame(animateFlyOut);
}

// --- Drawing ---

function drawDisplay() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    drawBackground(w, h);

    // Scores — P1 bottom-left, P2 top-right
    if (dScores && dP1Name) {
        ctx.font = "bold 24px 'Black Han Sans', sans-serif";
        ctx.fillStyle = "#e74c8b";
        ctx.textAlign = "left";
        ctx.fillText(dP1Name + ": " + dScores.p1Points, 30, h - 30);

        ctx.fillStyle = "#3b82f6";
        ctx.textAlign = "right";
        ctx.fillText(dP2Name + ": " + dScores.p2Points, w - 30, 40);
    }

    // Round info
    if (dRoundInfo) {
        ctx.fillStyle = "#aaa";
        ctx.font = "bold 20px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Round " + dRoundInfo.current + "/" + dRoundInfo.total, w / 2, 40);
    }

    // Cards (face-down, flipping, or face-up)
    for (const card of [...dP1Cards, ...dP2Cards]) {
        if (card.frame >= card.delay || card.landed) {
            drawDisplayCard(card);
        }
    }

    // Phase overlays
    if (displayPhase === "waiting") {
        ctx.fillStyle = "#aaa";
        ctx.font = "28px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for players to join", w / 2, h / 2);
    } else if (displayPhase === "lobby_full") {
        ctx.fillStyle = "#aaa";
        ctx.font = "28px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Starting game...", w / 2, h / 2);
    } else if (displayPhase === "round_active") {
        ctx.fillStyle = "#555";
        ctx.font = "22px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for submissions...", w / 2, h / 2);
    } else if (displayPhase === "showing_results") {
        drawDisplayResults(w, h);
    }
}

function drawDisplayCard(card) {
    const fp = card.flipProgress;
    // flipProgress 0..0.5 = face-down shrinking, 0.5..1 = face-up growing
    const showFace = fp > 0.5;
    // scaleX: 1 -> 0 -> 1
    const scaleX = showFace ? (fp - 0.5) * 2 : 1 - fp * 2;

    const cx = card.x + card.w / 2;
    const drawW = card.w * scaleX;
    const drawX = cx - drawW / 2;

    if (drawW < 1) return; // card is edge-on, skip

    if (showFace && card.cardData) {
        drawDisplayCardFace(drawX, card.y, drawW, card.h, card.cardData);
    } else {
        drawFaceDownCard(drawX, card.y, drawW, card.h);
    }
}

function drawFaceDownCard(x, y, cardW, cardH) {
    ctx.fillStyle = "#4a4a5e";
    ctx.strokeStyle = "#6a6a7e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 6);
    ctx.fill();
    ctx.stroke();

    if (cardW > 30) {
        ctx.fillStyle = "#5a5a6e";
        ctx.font = "bold 14px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CDM", x + cardW / 2, y + cardH / 2 + 5);
    }
}

function drawDisplayCardFace(x, y, cardW, cardH, card) {
    ctx.fillStyle = "#f5f5f0";
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 6);
    ctx.fill();
    ctx.stroke();

    const rows = [card.primary, card.secondary, card.tertiary];
    const rowH = cardH * 0.22;
    const startY = y + rowH;

    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        const fontSize = Math.floor(cardW * 0.16);
        ctx.fillStyle = suitColor(rows[i].suit);
        ctx.font = `bold ${fontSize}px 'Black Han Sans', sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(suitLabel(rows[i].suit), x + 6, ry);
        ctx.textAlign = "right";
        ctx.fillText(String(rows[i].val), x + cardW - 6, ry);
    }

    if (card.seal && card.seal !== "NONE") {
        const sealSize = Math.floor(cardW * 0.13);
        ctx.fillStyle = "#999";
        ctx.font = `bold ${sealSize}px 'Black Han Sans', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(card.seal, x + cardW / 2, y + cardH - 8);
    }
}

function drawDisplayResults(w, h) {
    if (!dResult) return;

    const centerX = w / 2;
    const centerY = h / 2;
    const p1 = dResult.p1;
    const p2 = dResult.p2;
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
            { label: "Cute", val: player.cute, color: "#e74c8b" },
            { label: "Dumb", val: player.dumb, color: "#3b82f6" },
            { label: "Mal",  val: player.malicous, color: "#8b5cf6" },
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
