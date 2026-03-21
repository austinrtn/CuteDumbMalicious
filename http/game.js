const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let gamePhase = "waiting"; // "waiting", "connected", "cards_dealt", "card_submitted"
let player_hand = [];
let selected_card = null;
let cardRects = []; // {x, y, w, h, index} for hit detection
let flyingCard = null; // {card, x, y, w, h, scale, vy} for animation
let animationId = null;
let playerName = "";
let roundResult = null;
let resultTimer = null;
let scores = null; // {player1Name, player1Points, player2Name, player2Points}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // On portrait screens (mobile), flip to landscape proportions
    if (w < h) {
        canvas.style.width = h + "px";
        canvas.style.height = w + "px";
        canvas.width = h * dpr;
        canvas.height = w * dpr;
        canvas.style.transform = "rotate(90deg)";
        canvas.style.transformOrigin = "top left";
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = w + "px";
    } else {
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.transform = "";
        canvas.style.position = "";
        canvas.style.top = "";
        canvas.style.left = "";
    }

    ctx.scale(dpr, dpr);

    if (canvas.style.display !== "none") {
        drawGame();
    }
}

function drawBackground(w, h) {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.5, "#1e2a4a");
    grad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}

function drawGame() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    drawBackground(w, h);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "28px 'Black Han Sans', sans-serif";

    if (gamePhase === "waiting") {
        ctx.fillText("Waiting for other player...", w / 2, h / 2);
    } else if (gamePhase === "connected") {
        ctx.fillText("Both players connected!", w / 2, h / 2);
    } else if(gamePhase === "cards_dealt" || gamePhase === "card_submitted") {
        drawHand(w, h);
        if (scores) drawScores(w, h);
        if (flyingCard) {
            drawCard(flyingCard.x, flyingCard.y, flyingCard.w, flyingCard.h, flyingCard.card, flyingCard.scale);
        }
    } else if (gamePhase === "showing_results") {
        drawHand(w, h);
        if (scores) drawScores(w, h);
        drawResults(w, h);
    }
}

function cardValueToLabel(num) {
    switch (num) {
        case 1:  return "A";
        case 11: return "J";
        case 12: return "Q";
        case 13: return "K";
        default: return String(num);
    }
}

function suitSymbol(suit) {
    switch (suit) {
        case "SPADES":   return "\u2660";
        case "HEARTS":   return "\u2665";
        case "DIAMONDS": return "\u2666";
        case "CLUBS":    return "\u2663";
        default:         return suit;
    }
}

function suitColor(suit) {
    return (suit === "HEARTS" || suit === "DIAMONDS") ? "#e74c3c" : "#222";
}

function drawScores(w, h) {
    ctx.font = "bold 20px 'Black Han Sans', sans-serif";
    ctx.fillStyle = "#fff";

    ctx.textAlign = "left";
    ctx.fillText(scores.player1Name + ": " + scores.player1Points, 20, 35);

    ctx.textAlign = "right";
    ctx.fillText(scores.player2Name + ": " + scores.player2Points, w - 20, 35);
}

function drawCard(x, y, cardW, cardH, card, fontScale) {
    const label = cardValueToLabel(card.num);
    const sym = suitSymbol(card.suit);
    const color = suitColor(card.suit);

    ctx.fillStyle = "#f5f5f0";
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 6 * fontScale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = `bold ${Math.floor(18 * fontScale)}px 'Black Han Sans', sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(label, x + 4 * fontScale, y + 20 * fontScale);

    ctx.font = `${Math.floor(14 * fontScale)}px sans-serif`;
    ctx.fillText(sym, x + 4 * fontScale, y + 36 * fontScale);

    ctx.font = `${Math.floor(32 * fontScale)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(sym, x + cardW / 2, y + cardH / 2 + 10 * fontScale);

    ctx.font = `bold ${Math.floor(18 * fontScale)}px 'Black Han Sans', sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(label, x + cardW - 4 * fontScale, y + cardH - 6 * fontScale);
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
    const y = h - cardH - 20;

    cardRects = [];
    for (let i = 0; i < player_hand.length; i++) {
        const x = startX + i * (cardW + gap);
        drawCard(x, y, cardW, cardH, player_hand[i], scale);
        cardRects.push({ x, y, w: cardW, h: cardH, scale, index: i });
    }
}

function drawResults(w, h) {
    if (!roundResult) return;

    const cardW = 80;
    const cardH = 120;
    const gap = 40;
    const centerX = w / 2;
    const cardY = h / 2 - cardH / 2 - 20;

    // Player 1 card (left)
    const p1x = centerX - cardW - gap / 2;
    drawCard(p1x, cardY, cardW, cardH, roundResult.player1Card, 1);

    // Player 2 card (right)
    const p2x = centerX + gap / 2;
    drawCard(p2x, cardY, cardW, cardH, roundResult.player2Card, 1);

    // Player names and points under cards
    ctx.fillStyle = "#aaa";
    ctx.font = "16px 'Black Han Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(roundResult.player1Name, p1x + cardW / 2, cardY + cardH + 22);
    ctx.fillText(roundResult.player2Name, p2x + cardW / 2, cardY + cardH + 22);
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 14px 'Black Han Sans', sans-serif";
    ctx.fillText("Score: " + roundResult.player1Points, p1x + cardW / 2, cardY + cardH + 40);
    ctx.fillText("Score: " + roundResult.player2Points, p2x + cardW / 2, cardY + cardH + 40);

    // "VS" between cards
    ctx.fillStyle = "#555";
    ctx.font = "bold 20px 'Black Han Sans', sans-serif";
    ctx.fillText("VS", centerX, cardY + cardH / 2 + 5);

    // Winner text above cards
    ctx.font = "bold 32px 'Black Han Sans', sans-serif";
    if (roundResult.winnerName === "DRAW") {
        ctx.fillStyle = "#f1c40f";
        ctx.fillText("DRAW!", centerX, cardY - 20);
    } else {
        ctx.fillStyle = "#2ecc71";
        ctx.fillText(roundResult.winnerName + " wins!", centerX, cardY - 20);
    }
}

function getCanvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = (canvas.width / (window.devicePixelRatio || 1)) / rect.width;
    const scaleY = (canvas.height / (window.devicePixelRatio || 1)) / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
}

function onCanvasClick(e) {
    if (gamePhase !== "cards_dealt" || flyingCard) return;

    const pos = getCanvasXY(e);
    for (let i = cardRects.length - 1; i >= 0; i--) {
        const r = cardRects[i];
        if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
						selected_card = player_hand[r.index];
            launchCard(r.index, r);

            return;
        }
    }
}

function launchCard(index, rect) {
    const card = player_hand.splice(index, 1)[0];
    flyingCard = {
        card,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        scale: rect.scale,
        vy: -15,
    };
    animateFlyingCard();
}

function animateFlyingCard() {
    if (!flyingCard) return;

    flyingCard.y += flyingCard.vy;
    flyingCard.vy -= 0.5; // accelerate upward

    drawGame();

    if (flyingCard.y + flyingCard.h < 0) {
        flyingCard = null;
        animationId = null;
        gamePhase = "card_submitted";
        drawGame();
				submitCard();
        return;
    }

    animationId = requestAnimationFrame(animateFlyingCard);
}

canvas.addEventListener("click", onCanvasClick);
canvas.addEventListener("touchstart", onCanvasClick);

function onServerEvent(e) {
		const msg = e.data;

		if(msg.startsWith('hand:'))	{
				player_hand = JSON.parse(msg.slice(5));
				gamePhase = "cards_dealt";
				drawGame();
				return
		}

		if(msg.startsWith('result:'))	{
				roundResult = JSON.parse(msg.slice(7));
				scores = {
						player1Name: roundResult.player1Name,
						player1Points: roundResult.player1Points,
						player2Name: roundResult.player2Name,
						player2Points: roundResult.player2Points,
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

function submitCard(sse) {
		selected_card.player = playerName;
		const options = {
				method: "POST",
				headers: {'Content-Type': "application/json"}, 
				body: JSON.stringify(selected_card),
		}

		fetch("/submitCard", options)
		.then(res => res.text().then(() => {
				console.log("Cards submited: " + res.status);			
		}));
}


window.addEventListener("resize", () => {
    if (canvas.style.display !== "none") {
        resizeCanvas();
    }
});
