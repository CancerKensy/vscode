let players = JSON.parse(localStorage.getItem("players")) || [];
let currentGame = JSON.parse(localStorage.getItem("currentGame")) || null;
let gameTimer = null;
let roundTransition = false;
let undoStack = JSON.parse(localStorage.getItem("undoStack")) || [];
let redoStack = JSON.parse(localStorage.getItem("redoStack")) || [];
let pressTimer = null;
let longPressTriggered = false;
const startPattern = ["topLeft", "bottomRight", "bottomLeft", "topRight"];

const diagonalMap = {
    topLeft: "bottomRight",
    bottomRight: "topLeft",
    bottomLeft: "topRight",
    topRight: "bottomLeft"
};

const horizontalMap = {
    topLeft: "topRight",
    topRight: "topLeft",
    bottomLeft: "bottomRight",
    bottomRight: "bottomLeft"
};
function debugLog(...args) {

    const text = args
        .map(x =>
            typeof x === "object"
                ? JSON.stringify(x)
                : String(x)
        )
        .join(" ");

    console.log(text);

    const div =
        document.getElementById("debugConsole");

    if (!div)
        return;

    const line =
        document.createElement("div");

    line.textContent =
        `[${new Date().toLocaleTimeString()}] ${text}`;

    div.appendChild(line);

    div.scrollTop =
        div.scrollHeight;
}
function savePlayers() {
    localStorage.setItem("players", JSON.stringify(players));
}

function saveCurrentGame() {
    if (currentGame) {
        localStorage.setItem("currentGame", JSON.stringify(currentGame));
    } else {
        localStorage.removeItem("currentGame");
    }
}
function cloneGame(game) {
    return JSON.parse(JSON.stringify(game));
}

function saveHistory() {
    localStorage.setItem("undoStack", JSON.stringify(undoStack));
    localStorage.setItem("redoStack", JSON.stringify(redoStack));
}

function commitGameAction(actionFunction) {
    if (!currentGame) return;

    undoStack.push(cloneGame(currentGame));
    redoStack = [];

    actionFunction();

    saveCurrentGame();
    saveHistory();
    renderGameInfo();
}

function undoGameAction() {
    if (!currentGame || undoStack.length === 0) return;

    redoStack.push(cloneGame(currentGame));
    currentGame = undoStack.pop();

    saveCurrentGame();
    saveHistory();
    renderGameInfo();
}

function redoGameAction() {
    if (!currentGame || redoStack.length === 0) return;

    undoStack.push(cloneGame(currentGame));
    currentGame = redoStack.pop();

    saveCurrentGame();
    saveHistory();
    renderGameInfo();
}
function addPlayer() {
    const input = document.getElementById("newPlayerName");
    const name = input.value.trim();

    if (name === "") {
        alert("Bitte Spielernamen eingeben.");
        return;
    }

    players.push({
        id: Date.now(),
        name: name
    });

    savePlayers();
    input.value = "";

    renderPlayerList();
    renderPlayerSelection();
}

function deletePlayer(id) {
    players = players.filter(player => player.id !== id);
    savePlayers();
    renderPlayerList();
    renderPlayerSelection();
}

function renderPlayerList() {
    let html = "";

    if (players.length === 0) {
        html = "<p>Noch keine Spieler angelegt.</p>";
    }

    players.forEach(player => {
        html += `
            <div class="playerRow">
                <span>${player.name}</span>
                <button onclick="deletePlayer(${player.id})">Löschen</button>
            </div>
        `;
    });

    document.getElementById("playerList").innerHTML = html;
}

function onModeChange() {
    const last = getLastSelection();
    last.mode = document.getElementById("mode").value;
    localStorage.setItem("lastSelection", JSON.stringify(last));
    renderPlayerSelection();
}

function renderPlayerSelection() {
    const mode = document.getElementById("mode").value;
    let html = "";

    if (players.length === 0) {
        html = "<p>Erst Spieler hinzufügen.</p>";
    }

    if (mode === "1v1") {
        html += `
            <h4>Spieler 1</h4>
            ${playerSelectHtml("p1")}

            <h4>Spieler 2</h4>
            ${playerSelectHtml("p2")}
        `;
    }

    if (mode === "2v2") {
        html += `
            <h4>Team 1</h4>
            <label>Linksschnipper</label><br>
            ${playerSelectHtml("t1p1")}

            <label>Rechtsschnipper</label><br>
            ${playerSelectHtml("t1p2")}

            <h4>Team 2</h4>
            <label>Linksschnipper</label><br>
            ${playerSelectHtml("t2p1")}

            <label>Rechtsschnipper</label><br>
            ${playerSelectHtml("t2p2")}
        `;
    }

    document.getElementById("playerSelection").innerHTML = html;
}

function playerSelectHtml(id) {
    const last = getLastSelection();

    let html = `<select id="${id}" onchange="saveLastSelection()">`;
    html += `<option value="">Spieler wählen</option>`;

    players.forEach(player => {
        const selected =
            String(last[id]) === String(player.id)
                ? "selected"
                : "";

        html += `
            <option value="${player.id}" ${selected}>
                ${player.name}
            </option>
        `;
    });

    html += `</select><br>`;
    return html;
}

function saveLastSelection() {
    const mode = document.getElementById("mode").value;
    const old = getLastSelection();

    const selection = {
        ...old,
        mode: mode,
        p1: document.getElementById("p1")?.value || old.p1 || "",
        p2: document.getElementById("p2")?.value || old.p2 || "",
        t1p1: document.getElementById("t1p1")?.value || old.t1p1 || "",
        t1p2: document.getElementById("t1p2")?.value || old.t1p2 || "",
        t2p1: document.getElementById("t2p1")?.value || old.t2p1 || "",
        t2p2: document.getElementById("t2p2")?.value || old.t2p2 || ""
    };

    localStorage.setItem("lastSelection", JSON.stringify(selection));
}

function getLastSelection() {
    return JSON.parse(localStorage.getItem("lastSelection")) || {};
}

function startGame() {
    saveLastSelection();

    const mode = document.getElementById("mode").value;
    let teams = [];

    if (mode === "1v1") {
        const p1 = Number(document.getElementById("p1").value);
        const p2 = Number(document.getElementById("p2").value);

        if (!p1 || !p2) {
            alert("Für 1v1 genau 2 Spieler auswählen.");
            return;
        }

        if (p1 === p2) {
            alert("Ein Spieler kann nicht gegen sich selbst spielen.");
            return;
        }

        teams = [
            [p1, p1],
            [p2, p2]
        ];
    }

    if (mode === "2v2") {
        const t1p1 = Number(document.getElementById("t1p1").value);
        const t1p2 = Number(document.getElementById("t1p2").value);
        const t2p1 = Number(document.getElementById("t2p1").value);
        const t2p2 = Number(document.getElementById("t2p2").value);

        const selected = [t1p1, t1p2, t2p1, t2p2];

        if (selected.some(id => !id)) {
            alert("Für 2v2 genau 4 Spieler auswählen.");
            return;
        }

        if (new Set(selected).size !== 4) {
            alert("Jeder Spieler darf nur einmal ausgewählt werden.");
            return;
        }

        teams = [
            [t1p1, t1p2],
            [t2p1, t2p2]
        ];
    }

    currentGame = {
        id: Date.now(),
        mode: mode,
        teams: teams,
        startTime: new Date().toISOString(),
        endTime: null,
        round: 0,
        turnInRound: 0,
        startIndex: null,
        startSelectionActive: true,
        events: []
    };
    undoStack = [];
    redoStack = [];
    saveHistory();
    saveCurrentGame();

    document.getElementById("setupSection").style.display = "none";
    document.getElementById("playerSection").style.display = "none";
    document.getElementById("currentGameSection").style.display = "block";
    renderGameInfo();
    startGameTimer();
}

function nextTurn() {
    if (!currentGame) return;

    if (currentGame.startSelectionActive) {
        alert("Bitte zuerst Startspieler wählen.");
        return;
    }

    if (
        currentGame.roundTransitionUntil &&
        Date.now() < currentGame.roundTransitionUntil
    ) {
        return;
    }

    commitGameAction(() => {
        currentGame.turnInRound++;

        if (currentGame.turnInRound >= 4) {
            currentGame.turnInRound = 0;
            currentGame.round++;

            const nextStartPosition =
                currentGame.startOrder[
                (currentGame.round - 1) % 4
                ];

            currentGame.startPosition = nextStartPosition;
            currentGame.startIndex =
                startPattern.indexOf(nextStartPosition);

            currentGame.roundTransitionUntil = Date.now() + 1000;
        } else {
            currentGame.roundTransitionUntil = null;
        }
    });
}
function getOrderFromStart(start) {
    const second = diagonalMap[start];
    const third = horizontalMap[second];
    const fourth = diagonalMap[third];

    return [start, second, third, fourth];
}
function getRoundOrder() {
    return getOrderFromStart(currentGame.startPosition);
}
function selectStartPlayer(position) {
    if (!currentGame || !currentGame.startSelectionActive) return;

    currentGame.startOrder = getOrderFromStart(position);
    currentGame.startPosition = position;
    currentGame.startIndex = startPattern.indexOf(position);

    currentGame.round = 1;
    currentGame.turnInRound = 0;
    currentGame.startSelectionActive = false;
    currentGame.roundTransitionUntil = null;

    saveCurrentGame();
    renderGameInfo();
}
function getCurrentTurnPosition() {
    if (!currentGame) return null;

    if (currentGame.startSelectionActive) return null;

    if (
        currentGame.roundTransitionUntil &&
        Date.now() < currentGame.roundTransitionUntil
    ) {
        return null;
    }

    const order = getRoundOrder();
    return order[currentGame.turnInRound];
}

function endGame() {
    if (!currentGame) {
        alert("Kein aktives Spiel.");
        return;
    }

    currentGame.endTime = new Date().toISOString();

    let games = JSON.parse(localStorage.getItem("games")) || [];
    games.push(currentGame);

    localStorage.setItem("games", JSON.stringify(games));

    currentGame = null;
    undoStack = [];
    redoStack = [];
    saveHistory();

    document.getElementById("currentGameSection").style.display = "none";
    saveCurrentGame();

    stopGameTimer();

    document.getElementById("setupSection").style.display = "block";
    document.getElementById("playerSection").style.display = "block";

    renderGameInfo();

    alert("Spiel gespeichert.");
}

function renderGameInfo() {
    if (!currentGame) {
        gameInfo.innerHTML = "";
        return;
    }
    let roundInfo = "";
    if (1 === 1) {
        roundInfo =
            `<h2 style="text-align:center;">
            Runde ${currentGame.round}
        </h2>`;
    }
    const gameInfo = document.getElementById("gameInfo");



    const team1 = currentGame.teams[0].map(getPlayerName).join(" + ");
    const team2 = currentGame.teams[1].map(getPlayerName).join(" + ");

    const currentTurn = getCurrentTurnPosition();

    const t1Left = getPlayerName(currentGame.teams[0][0]);
    const t1Right = getPlayerName(currentGame.teams[0][1]);
    const t2Left = getPlayerName(currentGame.teams[1][0]);
    const t2Right = getPlayerName(currentGame.teams[1][1]);
    const startMode = currentGame.startSelectionActive;

    const fieldHtml = `
    <div class="gameField ${startMode ? "startSelectField" : ""}">
        <div
            class="fieldPlayer topLeft ${currentTurn === "topLeft" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('topLeft')" : ""}">
            ${t1Left}
        </div>

        <div
            class="fieldPlayer bottomLeft ${currentTurn === "bottomLeft" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('bottomLeft')" : ""}">
            ${t1Right}
        </div>

        <div
            class="fieldPlayer bottomRight ${currentTurn === "bottomRight" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('bottomRight')" : ""}">
            ${t2Left}
        </div>

        <div
            class="fieldPlayer topRight ${currentTurn === "topRight" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('topRight')" : ""}">
            ${t2Right}
        </div>
        <div class="sideTargets leftTargets">
            <button class="targetButton" onclick="targetClicked(1)">1</button>
            <button class="targetButton" onclick="targetClicked(2)">2</button>
            <button class="targetButton" onclick="targetClicked(3)">3</button>
        </div>
        <div class="sideTargets middleTargets">
            <button class="targetButton" onclick="targetClicked(0)" >0</button>
        </div>
        <div class="redTargets leftredTargets">
            <button
                class="redButton"
                ondblclick="doubleClick(1)"
                onpointerdown="startPress(event, 1)"
                onpointerup="endPress(event, 1)"
                onpointercancel="cancelPress()"
                onpointerleave="cancelPress()"
                oncontextmenu="return false">

            </button>
        </div>
        <div class="redTargets rightredTargets">
            <button
                class="redButton"
                ondblclick="doubleClick(-1)"
                onpointerdown="startPress(event, -1)"
                onpointerup="endPress(event, -1)"
                onpointercancel="cancelPress()"
                onpointerleave="cancelPress()"
                oncontextmenu="return false">
            </button>
        </div>
        <div class="sideTargets rightTargets">
            <button class="targetButton" onclick="targetClicked(-1)">1</button>
            <button class="targetButton" onclick="targetClicked(-2)">2</button>
            <button class="targetButton" onclick="targetClicked(-3)">3</button>
        </div>
    </div>
`;

    gameInfo.innerHTML = `
        <b>Aktives Spiel</b><br>
        Modus: ${currentGame.mode}<br>
        Team 1: ${team1}<br>
        Team 2: ${team2}<br>
        ${startMode ? "<h2>Startspieler wählen</h2>" : `Runde: ${currentGame.round}<br>Zug: ${currentGame.turnInRound + 1} / 4<br>`}
        Start: ${new Date(currentGame.startTime).toLocaleString()}<br>
        Laufzeit: <span id="elapsedTime">${getElapsedTime()}</span><br><br>

        <button onclick="nextTurn()">Weiter</button>
       <button onclick="undoGameAction()" ${undoStack.length === 0 ? "disabled" : ""}>
    Undo
</button>

<button onclick="redoGameAction()" ${redoStack.length === 0 ? "disabled" : ""}>
    Redo
</button>
<div id="debugConsole"></div>


        ${roundInfo}
        ${fieldHtml}
        <button onclick="endGame()">Spiel beenden</button>
    `;
}

function getPlayerName(id) {
    const player = players.find(p => p.id === id);
    return player ? player.name : "Unbekannt";
}

function startGameTimer() {
    stopGameTimer();

    gameTimer = setInterval(() => {
        updateElapsedTimeOnly();
    }, 1000);
}

function stopGameTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
}
function updateElapsedTimeOnly() {
    const el = document.getElementById("elapsedTime");
    if (el && currentGame) {
        el.textContent = getElapsedTime();
    }
}
function getElapsedTime() {
    if (!currentGame) return "00:00";

    const start = new Date(currentGame.startTime);
    const now = new Date();

    const diffSeconds = Math.floor((now - start) / 1000);

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function targetClicked(value) {
    debugLog("Target:", value);
}


function startPress(event, side) {
    event.preventDefault();

    longPressTriggered = false;

    clearTimeout(pressTimer);

    pressTimer = setTimeout(() => {
        longPressTriggered = true;
        redClicked(side, true);
    }, 500);
}

function endPress(event, side) {
    event.preventDefault();

    clearTimeout(pressTimer);

    if (!longPressTriggered) {
        redClicked(side, false);
    }
}

function cancelPress() {
    clearTimeout(pressTimer);
}
function doubleClick(side) {
    redClicked(side, true);
}
function redClicked(side, isLongPress) {
    if (isLongPress) {
        debugLog("LANGDRUCK", side);
    } else {
        debugLog("KURZDRUCK", side);
    }
}
const last = getLastSelection();

if (last.mode) {
    document.getElementById("mode").value = last.mode;
}

renderPlayerList();
renderPlayerSelection();

if (currentGame) {
    document.getElementById("setupSection").style.display = "none";
    document.getElementById("playerSection").style.display = "none";

    if (!currentGame.round) currentGame.round = 1;
    if (currentGame.turnInRound === undefined) currentGame.turnInRound = 0;
    if (currentGame.startIndex === undefined) currentGame.startIndex = 0;

    saveCurrentGame();
    startGameTimer();
}

renderGameInfo();
document.addEventListener("contextmenu", event => {
    event.preventDefault();
});

document.addEventListener("selectstart", event => {
    event.preventDefault();
});

document.addEventListener("dragstart", event => {
    event.preventDefault();
});
window.addEventListener("contextmenu", function (event) {
    event.preventDefault();
    return false;
}, { capture: true });

window.addEventListener("selectstart", function (event) {
    event.preventDefault();
    return false;
}, { capture: true });

window.addEventListener("dragstart", function (event) {
    event.preventDefault();
    return false;
}, { capture: true });