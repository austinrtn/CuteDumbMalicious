const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let gamePhase = "waiting"; // "waiting", "ready_up", "all_ready"
let isReady = false;

// Ready button dimensions (recalculated on draw)
let readyBtn = { x: 0, y: 0, w: 0, h: 0 };

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

    if (gamePhase === "waiting") {
        ctx.font = "28px 'Black Han Sans', sans-serif";
        ctx.fillText("Waiting for other player...", w / 2, h / 2);
    } else if (gamePhase === "ready_up") {
        if (isReady) {
            ctx.font = "28px 'Black Han Sans', sans-serif";
            ctx.fillText("Waiting for other player to ready...", w / 2, h / 2);
        } else {
            // Draw ready button
            const btnW = 200;
            const btnH = 60;
            const btnX = (w - btnW) / 2;
            const btnY = (h - btnH) / 2;
            readyBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

            ctx.fillStyle = "#e63946";
            ctx.beginPath();
            ctx.roundRect(btnX, btnY, btnW, btnH, 6);
            ctx.fill();

            ctx.fillStyle = "#fff";
            ctx.font = "bold 24px 'Black Han Sans', sans-serif";
            ctx.fillText("READY", w / 2, btnY + btnH / 2 + 8);
        }
    } else if (gamePhase === "all_ready") {
        ctx.font = "28px 'Black Han Sans', sans-serif";
        ctx.fillText("Game starting...", w / 2, h / 2);
    }
}

function onServerEvent(e) {
    const msg = e.data;

    if (msg === "connection_established") {
        // Server acknowledged connection, wait for game state updates
    } else if (msg === "waiting_for_player") {
        gamePhase = "waiting";
        drawGame();
    } else if (msg === "lobby_full") {
        gamePhase = "ready_up";
        drawGame();
    } else if (msg === "player_ready") {
        // Another player readied — no phase change, but redraw in case
        drawGame();
    } else if (msg === "all_players_ready") {
        gamePhase = "all_ready";
        drawGame();
    }
}

let clickHandler = null;

function startGame(playerName, sse) {
    gamePhase = "waiting";
    isReady = false;
    document.getElementById("menu-root").style.display = "none";
    canvas.style.display = "block";

    if (clickHandler) canvas.removeEventListener("click", clickHandler);
    clickHandler = function(e) {
        if (gamePhase !== "ready_up" || isReady) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = (canvas.width / (window.devicePixelRatio || 1)) / rect.width;
        const scaleY = (canvas.height / (window.devicePixelRatio || 1)) / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (x >= readyBtn.x && x <= readyBtn.x + readyBtn.w &&
            y >= readyBtn.y && y <= readyBtn.y + readyBtn.h) {
            isReady = true;
            drawGame();
            fetch("/ready", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: playerName }),
            });
        }
    };
    canvas.addEventListener("click", clickHandler);

    sse.onmessage = onServerEvent;
    sse.onerror = () => {
        sse.close();
        canvas.style.display = "none";
        document.getElementById("menu-root").style.display = "";
        if (typeof onDisconnect === "function") onDisconnect();
    };

    resizeCanvas();
}

window.addEventListener("resize", () => {
    if (canvas.style.display !== "none") {
        resizeCanvas();
    }
});
