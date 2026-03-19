const menuRoot = document.getElementById("menu-root");
let activeSSE = null;

function loadMenu(menu) {
    menuRoot.innerHTML = "";
    menuRoot.appendChild(menu());
}

function mainMenu() {
    const div = document.createElement("div");
    div.className = "menu";

    const title = document.createElement("h1");
    title.className = "menu-title main-title";
    title.innerHTML = "Cute, Dumb, <br>&Malicious";

    const subtitle = document.createElement("p");
    subtitle.className = "menu-subtitle";
    subtitle.textContent = "To the dumbass goes the spoils";

    const newGameBtn = document.createElement("button");
    newGameBtn.className = "menu-btn";
    newGameBtn.textContent = "New Game";
    newGameBtn.onclick = () => loadMenu(newGameMenu);

    const connectBtn = document.createElement("button");
    connectBtn.className = "menu-btn";
    connectBtn.textContent = "Connect";
    connectBtn.onclick = () => loadMenu(connectLobby);


    div.appendChild(title);
    div.appendChild(subtitle);
    div.appendChild(newGameBtn);
    div.appendChild(connectBtn);
    return div;
}

function newGameMenu() {
    const div = document.createElement("div");
    div.className = "menu";

    const title = document.createElement("h2");
    title.className = "menu-title";
    title.textContent = "New Game";

    const handsOptions = [3, 5, 9];
    let handsIndex = 0;

    const handsBtn = document.createElement("button");
    handsBtn.className = "menu-btn";
    handsBtn.textContent = `Hands ${handsOptions[handsIndex]}`;
    handsBtn.onclick = () => {
        handsIndex = (handsIndex + 1) % handsOptions.length;
        handsBtn.textContent = `Hands ${handsOptions[handsIndex]}`;
    };

    const submitBtn = document.createElement("button");
    submitBtn.className = "menu-btn";
    submitBtn.textContent = "Create";
    submitBtn.onclick = () => {
        onCreate(handsOptions[handsIndex]);
    };

    const backBtn = document.createElement("button");
    backBtn.className = "menu-btn back";
    backBtn.textContent = "Back";
    backBtn.onclick = () => loadMenu(mainMenu);

    div.appendChild(title);
    div.appendChild(handsBtn);
    div.appendChild(submitBtn);
    div.appendChild(backBtn);
    return div;
}

function onCreate(hands) {
	const data = { hands: hands };

	const options = {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(data),
	};

	fetch("/startNewGame", options)
	.then(res => res.text().then(() => {
		if(res.ok) {
			console.log("New game created successfully");
    		loadMenu(mainMenu);
			return;
		}
		else {
			console.log(res.statusText)
		}
	}));
}

function connectLobby() {
    const div = document.createElement("div");
    div.className = "menu menu-compact";

    const title = document.createElement("h2");
    title.className = "menu-title";
    title.textContent = "No Session Started";

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "menu-btn";
    refreshBtn.textContent = "Refresh";
    refreshBtn.onclick = () => {
        fetch("/sessionExists")
        .then(res => {
            if(res.ok) {
                onConnect();
            }
        });
    };

    const backBtn = document.createElement("button");
    backBtn.className = "menu-btn back";
    backBtn.textContent = "Back";
    backBtn.onclick = () => loadMenu(mainMenu);

    fetch("/sessionExists")
    .then(res => {
        if(res.ok) {
            onConnect();
        } else {
            div.appendChild(title);
            div.appendChild(refreshBtn);
            div.appendChild(backBtn);
        }
    });

    return div;
}

function onConnect() {
	fetch("/getConnectedPlayers")
	.then(res => {
		if(!res.ok) {
			console.log(res.statusText);
			return;
		}
		res.json().then(data => loadMenu(() => connectMenu(data.players)));
	});
}

function onDisconnect() {
	activeSSE = null;
	loadMenu(mainMenu);
}

function enterGame(playerName) {
	if (activeSSE) {
		activeSSE.close();
	}
	activeSSE = new EventSource(`/play?name=${playerName}`);
	startGame(playerName, activeSSE);
}

function connectMenu(players) {
    const div = document.createElement("div");
    div.className = "menu";

    for (const name of players) {
        const btn = document.createElement("button");
        btn.className = "menu-btn";
        btn.textContent = name;
        btn.onclick = () => enterGame(name);
        div.appendChild(btn);
    }

    if (players.length < 2) {
        const nameInput = document.createElement("input");
        nameInput.className = "menu-input";
        nameInput.type = "text";
        nameInput.placeholder = "Enter your name";

        const joinBtn = document.createElement("button");
        joinBtn.className = "menu-btn";
        joinBtn.textContent = "Join";
        joinBtn.onclick = () => {
            if (nameInput.value === "") {
                alert("Name cannot be empty!");
                return;
            }
            enterGame(nameInput.value);
        };

        div.appendChild(nameInput);
        div.appendChild(joinBtn);
    }

    const displayBtn = document.createElement("button");
    displayBtn.className = "menu-btn";
    displayBtn.textContent = "Display";
    displayBtn.onclick = () => enterGame("display");

    const backBtn = document.createElement("button");
    backBtn.className = "menu-btn back";
    backBtn.textContent = "Back";
    backBtn.onclick = () => loadMenu(mainMenu);

    div.appendChild(displayBtn);
    div.appendChild(backBtn);
    return div;
}

loadMenu(mainMenu);
