const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let gamePhase = "waiting"; // "waiting", "connected", "cards_dealt", "card_submitted"
let player_hand = [];
let selected_cards = []; // cards chosen for submission (up to 5)
let cardRects = []; // {x, y, w, h, index} for hit detection
let submitBtnRect = null; // {x, y, w, h} for submit button hit detection
let flyingCards = []; // [{card, x, y, w, h, scale, vy}] for animation
let animationId = null;
let isPortrait = false;
let playerName = "";
let roundResult = null;
let resultTimer = null;
let scores = null; // {player1Name, player1Points, player2Name, player2Points}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    isPortrait = w < h;

    // Always match the actual screen dimensions — no CSS transform.
    // Portrait rotation is handled by the canvas drawing context instead.
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
        drawGame();
    }
}

function drawBackground(w, h) {
    // Clear in screen space first to avoid rotated-rect artifacts
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
    const dpr = window.devicePixelRatio || 1;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Reset transform completely each frame
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // In portrait, rotate the drawing context so game content is landscape.
    // Logical (0,0) ends up at screen top-right, X runs downward, Y runs leftward.
    let w, h;
    if (isPortrait) {
        ctx.translate(screenW, 0);
        ctx.rotate(Math.PI / 2);
        w = screenH; // logical landscape width
        h = screenW; // logical landscape height
    } else {
        w = screenW;
        h = screenH;
    }

    drawBackground(w, h);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "28px 'Black Han Sans', sans-serif";

    if (gamePhase === "waiting") {
        ctx.fillText("Waiting for other player...", w / 2, h / 2);
    } else if (gamePhase === "connected") {
        ctx.fillText("Both players connected!", w / 2, h / 2);
    } else if(gamePhase === "cards_dealt" || gamePhase === "hand_submitted") {
        drawHand(w, h);
        if (scores) drawScores(w, h);
        drawSuitTotals(w);
    } else if (gamePhase === "showing_results") {
        drawHand(w, h);
        if (scores) drawScores(w, h);
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
    ctx.fillText(scores.player1Name + ": " + scores.player1Points, 20, 35);

    ctx.textAlign = "right";
    ctx.fillText(scores.player2Name + ": " + scores.player2Points, w - 20, 35);
}

function drawSuitTotals(w) {
    const totals = { CUTE: 0, DUMB: 0, MALICOUS: 0 };
    for (const card of selected_cards) {
        totals[card.primary.suit]   += card.primary.val;
        totals[card.secondary.suit] += card.secondary.val;
        totals[card.tertiary.suit]  += card.tertiary.val;
    }
    ctx.font = "bold 24px 'Black Han Sans', sans-serif";
    ctx.textAlign = "center";
    ["CUTE", "DUMB", "MALICOUS"].forEach((suit, i) => {
        ctx.fillStyle = suitColor(suit);
        ctx.fillText(String(totals[suit]), w / 2 + (i - 1) * 60, 35);
    });
}

function drawCard(x, y, cardW, cardH, card, fontScale) {
    // Card background
    ctx.fillStyle = "#f5f5f0";
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 6 * fontScale);
    ctx.fill();
    ctx.stroke();

    // Three suit-value rows
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

    // Seal badge at bottom of card
    if (card.seal && card.seal !== "NONE") {
        ctx.fillStyle = "#999";
        ctx.font = `bold ${Math.floor(9 * fontScale)}px 'Black Han Sans', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(card.seal, x + cardW / 2, y + cardH - 8 * fontScale);
    }
}

function drawHand(w, h) {
    const maxCardW = 80;
    const maxCardH = 120;
    const maxGap = 12;
    const padding = 20;

    const availableW = w - padding * 2;
    const idealW = player_hand.length * maxCardW + (player_hand.length - 1) * maxGap;
    const scale = Math.min(1, availableW / idealW);

    const cardW = Math.floor(maxCardW * scale);
    const cardH = Math.floor(maxCardH * scale);
    const gap = Math.floor(maxGap * scale);

    const totalW = player_hand.length * cardW + (player_hand.length - 1) * gap;
    const startX = (w - totalW) / 2;
    const baseY = h - cardH - 20;

    cardRects = [];
    for (let i = 0; i < player_hand.length; i++) {
        const isSelected = selected_cards.indexOf(player_hand[i]) !== -1;
        const x = startX + i * (cardW + gap);
        const y = isSelected ? baseY - 20 : baseY;

        if (isSelected) {
            ctx.strokeStyle = "#2ecc71";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(x - 2, y - 2, cardW + 4, cardH + 4, 8);
            ctx.stroke();
        }

        drawCard(x, y, cardW, cardH, player_hand[i], scale);
        cardRects.push({ x, y, w: cardW, h: cardH, scale, index: i });
    }

    // Submit button (only when 5 selected and not already submitted)
    submitBtnRect = null;
    if (selected_cards.length === 5 && gamePhase === "cards_dealt") {
        const btnW = 140;
        const btnH = 40;
        const btnX = w / 2 - btnW / 2;
        const btnY = baseY - 60;

        ctx.fillStyle = "#2ecc71";
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 8);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Submit", btnX + btnW / 2, btnY + 27);

        submitBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    }

    // Draw flying cards on top
    for (const fc of flyingCards) {
        drawCard(fc.x, fc.y, fc.w, fc.h, fc.card, fc.scale);
    }
}

function drawResults(w, h) {
    if (!roundResult) return;

    const centerX = w / 2;
    const centerY = h / 2;

    // Player result boxes
    const p1 = roundResult.p1;
    const p2 = roundResult.p2;
    const boxW = 180;
    const gap = 40;

    const p1x = centerX - boxW - gap / 2;
    const p2x = centerX + gap / 2;
    const boxY = centerY - 60;

    // Draw result box for each player
    [{ player: p1, bx: p1x }, { player: p2, bx: p2x }].forEach(({ player, bx }) => {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.roundRect(bx, boxY, boxW, 120, 8);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(player.player, bx + boxW / 2, boxY + 22);

        // Suit scores
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

        // Total
        ctx.fillStyle = "#f1c40f";
        ctx.font = "bold 14px 'Black Han Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Total: " + player.total, bx + boxW / 2, boxY + 110);
    });

    // VS between boxes
    ctx.fillStyle = "#555";
    ctx.font = "bold 20px 'Black Han Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VS", centerX, boxY + 60);

    // Winner text above
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

function getCanvasXY(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Canvas element is never CSS-rotated, so screen coords are reliable.
    // In portrait, the context is rotated: logical X = screenY, logical Y = screenW - screenX
    if (isPortrait) {
        return {
            x: clientY,
            y: window.innerWidth - clientX,
        };
    }

    return { x: clientX, y: clientY };
}

function onCanvasClick(e) {
    e.preventDefault();
    if (gamePhase !== "cards_dealt") return;

    const pos = getCanvasXY(e);

    // Check submit button first
    if (submitBtnRect) {
        const b = submitBtnRect;
        if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
            launchSelectedCards();
            return;
        }
    }

    // Check card clicks
    for (let i = cardRects.length - 1; i >= 0; i--) {
        const r = cardRects[i];
        if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
            const card = player_hand[r.index];
            const alreadySelected = selected_cards.indexOf(card);

            if (alreadySelected !== -1) {
                selected_cards.splice(alreadySelected, 1);
            } else if (selected_cards.length < 5) {
                selected_cards.push(card);
            }

            drawGame();
            return;
        }
    }
}

function launchSelectedCards() {
    // Build flying cards from their current drawn positions
    flyingCards = [];
    for (let i = cardRects.length - 1; i >= 0; i--) {
        const r = cardRects[i];
        const card = player_hand[r.index];
        if (selected_cards.indexOf(card) !== -1) {
            flyingCards.push({
                card,
                x: r.x,
                y: r.y,
                w: r.w,
                h: r.h,
                scale: r.scale,
                vy: -12 - Math.random() * 6,
            });
        }
    }

    // Remove selected cards from hand
    player_hand = player_hand.filter(c => selected_cards.indexOf(c) === -1);
    gamePhase = "hand_submitted";
    animateFlyingCards();
}

function animateFlyingCards() {
    let allGone = true;
    for (const fc of flyingCards) {
        fc.y += fc.vy;
        fc.vy -= 0.5;
        if (fc.y + fc.h > -50) allGone = false;
    }

    drawGame();

    if (allGone) {
        flyingCards = [];
        animationId = null;
        drawGame();
        submitHand();
        return;
    }

    animationId = requestAnimationFrame(animateFlyingCards);
}

canvas.addEventListener("click", onCanvasClick);
canvas.addEventListener("touchstart", function(e) {
    e.preventDefault(); // prevent duplicate click event on touch
    onCanvasClick(e);
});

function onServerEvent(e) {
		const msg = e.data;

		if(msg.startsWith('hand:'))	{
				player_hand = JSON.parse(msg.slice(5));
				selected_cards = [];
				gamePhase = "cards_dealt";
				drawGame();
				return
		}

		if(msg.startsWith('result:'))	{
				roundResult = JSON.parse(msg.slice(7));
				scores = {
						player1Name: roundResult.p1.player,
						player1Points: roundResult.p1.total,
						player2Name: roundResult.p2.player,
						player2Points: roundResult.p2.total,
				};
				gamePhase = "showing_results";
				drawGame();

				resultTimer = setTimeout(() => {
						roundResult = null;
						gamePhase = "cards_dealt";
						drawGame();
				}, 3000);
				return
		}

    if (msg === "connection_established") {
	    console.log("Connection to backend established!");
    } else if (msg === "lobby_full") {
        gamePhase = "connected";
        drawGame();
    }
}

function startGame(name, sse) {
    playerName = name;
    gamePhase = "waiting";
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

function submitHand() {
		const hand = {
				player: playerName,
				cards: selected_cards,
		};
		const options = {
				method: "POST",
				headers: {'Content-Type': "application/json"},
				body: JSON.stringify(hand),
		}

		fetch("/submitHand", options)
		.then(res => res.text().then(() => {
				console.log("Hand submitted: " + res.status);
		}));
}


window.addEventListener("resize", () => {
    if (canvas.style.display !== "none") {
        resizeCanvas();
    }
});
