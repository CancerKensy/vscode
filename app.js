let players = JSON.parse(localStorage.getItem("players")) || [];
let currentGame = JSON.parse(localStorage.getItem("currentGame")) || null;
if (currentGame && !currentGame.fieldCounts) {
    currentGame.fieldCounts = createEmptyFieldCounts();
}
let gameTimer = null;
let roundTransition = false;
let undoStack = JSON.parse(localStorage.getItem("undoStack")) || [];
let redoStack = JSON.parse(localStorage.getItem("redoStack")) || [];
const maxHistoryEntries = 100;
const pressState = {};
const doubleClickDelay = 350;
const longPressDelay = 500;
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
let fieldPressTimer = null;
let fieldLongPress = false;

function fieldPointerDown(event) {

    if (
        event.target.closest(".targetButton") ||
        event.target.closest(".redButton") ||
        event.target.closest(".fieldPlayer")
    ) {
        return;
    }

    fieldLongPress = false;

    fieldPressTimer = setTimeout(() => {
        fieldLongPress = true;
        handleTargetInput(0, true);
    }, 500);
}

function fieldPointerUp(event) {

    if (
        event.target.closest(".targetButton") ||
        event.target.closest(".redButton") ||
        event.target.closest(".fieldPlayer")
    ) {
        return;
    }

    clearTimeout(fieldPressTimer);

    if (!fieldLongPress) {
        handleTargetInput(0, false);
    }
}

function fieldPointerCancel() {
    clearTimeout(fieldPressTimer);
}
function createEmptyFieldCounts() {
    return {
        "-3": 0,
        "-2": 0,
        "-1": 0,
        "0": 0,
        "1": 0,
        "2": 0,
        "3": 0,
        "red1": 0,
        "red-1": 0
    };
}
function debugLog(...args) {
    const text = args
        .map(x =>
            typeof x === "object"
                ? JSON.stringify(x)
                : String(x)
        )
        .join(" ");
    
    const lineText = `[${getGameTimestamp()}] ${text}`;
    const id = Date.now() + "_" + Math.random();
    const logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    logs.push({
        id: id,
        text: lineText,
        undone: false
    });

    while (logs.length > 1000) {
        logs.shift();
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const div =
        document.getElementById("debugConsole");

    if (!div) return;

    const line =
        document.createElement("div");
    line.id = id;
    line.textContent = lineText;

    div.appendChild(line);

    div.scrollTop =
        div.scrollHeight;
    return id;
}
function restoreDebugLog() {

    const logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    const div =
        document.getElementById("debugConsole");

    if (!div) return;

    div.innerHTML = "";

    logs.forEach(log => {

        const line =
            document.createElement("div");

        line.id = log.id;
        line.textContent = log.text;

        if (log.undone) {
            line.classList.add("debugUndone");
        }

        div.appendChild(line);
    });

    div.scrollTop = div.scrollHeight;
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
    while (undoStack.length > maxHistoryEntries) {
        undoStack.shift();
    }
    redoStack = [];
    while (redoStack.length > maxHistoryEntries) {
        redoStack.shift();
    }
    actionFunction();

    saveCurrentGame();
    saveHistory();

    renderGameInfo();

    requestAnimationFrame(() => {
        updateAllFieldCountDisplays();
        restoreDebugLog();
    });
}

function undoGameAction() {
    if (!currentGame || undoStack.length === 0) return;

    const previousGame = undoStack[undoStack.length - 1];

    const removedEvents =
        currentGame.events.slice(previousGame.events.length);

    removedEvents.forEach(event => {
        if (event?.logId) {
            markLogUndone(event.logId);
        }
    });

    redoStack.push(cloneGame(currentGame));
    currentGame = undoStack.pop();

    saveCurrentGame();
    saveHistory();

    renderGameInfo();
    restoreDebugLog();
}

function redoGameAction() {
    if (!currentGame || redoStack.length === 0) return;

    undoStack.push(cloneGame(currentGame));
    while (undoStack.length > maxHistoryEntries) {
        undoStack.shift();
    }
    const redoneGame = redoStack.pop();

    const addedEvents =
        redoneGame.events.slice(currentGame.events.length);

    addedEvents.forEach(event => {
        if (event?.logId) {
            markLogRedone(event.logId);
        }
    });

    currentGame = redoneGame;

    saveCurrentGame();
    saveHistory();

    renderGameInfo();
    restoreDebugLog();
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
    localStorage.removeItem("debugLog");

    const debugConsole =
        document.getElementById("debugConsole");

    if (debugConsole) {
        debugConsole.innerHTML = "";
    }
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
        fieldCounts: {
            "-3": 0,
            "-2": 0,
            "-1": 0,
            "0": 0,
            "1": 0,
            "2": 0,
            "3": 0,
            "red1": 0,
            "red-1": 0
        },
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
            const finishedRound = currentGame.round;
            const roundResultMessage = getRoundResultMessage(finishedRound);
            const resultLogId = debugLog(roundResultMessage);

            currentGame.events.push({
                type: "round_result",
                round: finishedRound,
                timestamp: Date.now(),
                logId: resultLogId
            });

            currentGame.turnInRound = 0;
            currentGame.round++;
            currentGame.fieldCounts = createEmptyFieldCounts();

            const nextStartPosition =
                currentGame.startOrder[
                    (currentGame.round - 1) % 4
                ];

            currentGame.startPosition = nextStartPosition;
            currentGame.startIndex =
                startPattern.indexOf(nextStartPosition);

            currentGame.roundTransitionUntil = Date.now() + 1000;

            const roundLogId = debugLog(`Runde ${currentGame.round}`);

            currentGame.events.push({
                type: "round_start",
                round: currentGame.round,
                timestamp: Date.now(),
                logId: roundLogId
            });
        } else {
            currentGame.roundTransitionUntil = null;
        }

        const currentPlayer = getCurrentPlayerInfo();
        const turnLogId = debugLog(`${currentPlayer.playerName} ist dran.`);

        currentGame.events.push({
            type: "turn_start",
            playerId: currentPlayer.playerId,
            teamIndex: currentPlayer.teamIndex,
            round: currentGame.round,
            turnInRound: currentGame.turnInRound,
            timestamp: Date.now(),
            logId: turnLogId
        });
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

    const roundLogId = debugLog(`Runde ${currentGame.round}`);

    currentGame.events.push({
        type: "round_start",
        round: currentGame.round,
        timestamp: Date.now(),
        logId: roundLogId
    });

    const currentPlayer = getCurrentPlayerInfo();
    const turnLogId = debugLog(`${currentPlayer.playerName} ist dran.`);

    currentGame.events.push({
        type: "turn_start",
        playerId: currentPlayer.playerId,
        teamIndex: currentPlayer.teamIndex,
        round: currentGame.round,
        turnInRound: currentGame.turnInRound,
        timestamp: Date.now(),
        logId: turnLogId
    });

    saveCurrentGame();
    renderGameInfo();
    restoreDebugLog();
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
    const gameInfo = document.getElementById("gameInfo");
    if (!currentGame) {
        gameInfo.innerHTML = "";
        restoreDebugLog();
        return;
    }
    let roundInfo = "";
    if (1 === 1) {
        roundInfo =
            `<h2 style="text-align:center;">
            Runde ${currentGame.round}
        </h2>`;
    }
    



    const team1 = currentGame.teams[0].map(getPlayerName).join(" + ");
    const team2 = currentGame.teams[1].map(getPlayerName).join(" + ");

    const currentTurn = getCurrentTurnPosition();

    const t1Left = getPlayerName(currentGame.teams[0][0]);
    const t1Right = getPlayerName(currentGame.teams[0][1]);
    const t2Left = getPlayerName(currentGame.teams[1][0]);
    const t2Right = getPlayerName(currentGame.teams[1][1]);
    const startMode = currentGame.startSelectionActive;

    const fieldHtml = `
    <div class="gameField ${startMode ? "startSelectField" : ""}"
    onpointerdown="targetPointerDown(event, 0)"
    onpointerup="targetPointerUp(event, 0)"
    onpointercancel="targetPointerCancel(0)"
    onpointerleave="targetPointerCancel(0)">
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
            <button class="targetButton target3" id="${getFieldDomId(3)}" onpointerdown="targetPointerDown(event, 3)" onpointerup="targetPointerUp(event, 3)" onpointercancel="targetPointerCancel(3)" onpointerleave="targetPointerCancel(3)">${getFieldCount(3)}</button>
            <button class="targetButton target2" id="${getFieldDomId(2)}" onpointerdown="targetPointerDown(event, 2)" onpointerup="targetPointerUp(event, 2)" onpointercancel="targetPointerCancel(2)" onpointerleave="targetPointerCancel(2)">${getFieldCount(2)}</button>
            <button class="targetButton target1" id="${getFieldDomId(1)}" onpointerdown="targetPointerDown(event, 1)" onpointerup="targetPointerUp(event, 1)" onpointercancel="targetPointerCancel(1)" onpointerleave="targetPointerCancel(1)">${getFieldCount(1)}</button>
        </div>
        <div class="redTargets leftredTargets">
            <button class="redButton" id="${getFieldDomId('red1')}" onpointerdown="targetPointerDown(event, 'red1')" onpointerup="targetPointerUp(event, 'red1')" onpointercancel="targetPointerCancel('red1')" onpointerleave="targetPointerCancel('red1')">
                ${getFieldCount("red1")}
            </button>
        </div>

        <div class="redTargets rightredTargets">
            <button class="redButton" id="${getFieldDomId('red-1')}" onpointerdown="targetPointerDown(event, 'red-1')" onpointerup="targetPointerUp(event, 'red-1')" onpointercancel="targetPointerCancel('red-1')" onpointerleave="targetPointerCancel('red-1')">
                ${getFieldCount("red-1")}
            </button>
        </div>

        <div class="sideTargets rightTargets">
            <button class="targetButton target1" id="${getFieldDomId(-1)}" onpointerdown="targetPointerDown(event, -1)" onpointerup="targetPointerUp(event, -1)" onpointercancel="targetPointerCancel(-1)" onpointerleave="targetPointerCancel(-1)">${getFieldCount(-1)}</button>
            <button class="targetButton target2" id="${getFieldDomId(-2)}" onpointerdown="targetPointerDown(event, -2)" onpointerup="targetPointerUp(event, -2)" onpointercancel="targetPointerCancel(-2)" onpointerleave="targetPointerCancel(-2)">${getFieldCount(-2)}</button>
            <button class="targetButton target3" id="${getFieldDomId(-3)}" onpointerdown="targetPointerDown(event, -3)" onpointerup="targetPointerUp(event, -3)" onpointercancel="targetPointerCancel(-3)" onpointerleave="targetPointerCancel(-3)">${getFieldCount(-3)}</button>
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
        <div style="text-align:center;">
            ${getScoreDisplay()}
        </div>
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


function getPressKey(value) {
    return String(value);
}

function targetPointerDown(event, value) {
    event.preventDefault();
    event.stopPropagation();

    const key = getPressKey(value);

    if (!pressState[key]) {
        pressState[key] = {
            longTimer: null,
            clickTimer: null,
            longTriggered: false
        };
    }

    const state = pressState[key];

    state.longTriggered = false;
    clearTimeout(state.longTimer);

    state.longTimer = setTimeout(() => {
        state.longTriggered = true;

        if (state.clickTimer) {
            clearTimeout(state.clickTimer);
            state.clickTimer = null;
        }

        handleTargetInput(value, true);
    }, longPressDelay);
}

function targetPointerUp(event, value) {
    event.preventDefault();
    event.stopPropagation();

    const key = getPressKey(value);
    const state = pressState[key];

    if (!state) return;

    clearTimeout(state.longTimer);

    if (state.longTriggered) {
        state.longTriggered = false;
        return;
    }

    if (state.clickTimer) {
        clearTimeout(state.clickTimer);
        state.clickTimer = null;

        handleTargetInput(value, true);
        return;
    }

    state.clickTimer = setTimeout(() => {
        state.clickTimer = null;
        handleTargetInput(value, false);
    }, doubleClickDelay);
}

function targetPointerCancel(value) {
    const key = getPressKey(value);
    const state = pressState[key];

    if (!state) return;

    clearTimeout(state.longTimer);
    state.longTriggered = false;
}

function handleTargetInput(value, isLongPress) {
    if (!currentGame || currentGame.startSelectionActive) return;

    if (!currentGame.fieldCounts) {
        currentGame.fieldCounts = {};
    }

    const key = getFieldKey(value);

    if (currentGame.fieldCounts[key] === undefined) {
        currentGame.fieldCounts[key] = 0;
    }

    const player = getCurrentPlayerInfo();
    const fieldValue = getFieldAbsValue(value);
    const isOwn = isOwnFieldForTeam(value, player.teamIndex);
    if (value === 0 && isLongPress) {
        isLongPress = false;
    }
    if (!isLongPress) {
        commitGameAction(() => {
            currentGame.fieldCounts[key]++;
            updateFieldCountDisplay(value);
            const scoreText = isOwn
                ? `-${fieldValue}`
                : `+${fieldValue}`;
            
            let message;

            if (value === "red1" || value === "red-1") {

                if (isOwn) {
                    message =
                        `${player.playerName} aus ${player.teamName} trifft eigenen roten (-1 rot)`;
                } else {
                    message =
                        `${player.playerName} aus ${player.teamName} trifft gegnerischen roten (+1 rot)`;
                }

            } else if (fieldValue === 0) {

                message =
                    `${player.playerName} aus ${player.teamName} trifft nischt (0)`;

            } else if (isOwn) {

                message =
                    `${player.playerName} aus ${player.teamName} trifft eigene ${fieldValue} (-${fieldValue})`;

            } else {

                message =
                    `${player.playerName} aus ${player.teamName} trifft gegnerische ${fieldValue} (+${fieldValue})`;
            }

            const logId = debugLog(message);

            currentGame.events.push({
                type: "field_add",
                value: value,
                fieldValue: fieldValue,
                isOwn: isOwn,
                playerId: player.playerId,
                teamIndex: player.teamIndex,
                timestamp: Date.now(),
                logId: logId
            });
        });

        return;
    }

    if (currentGame.fieldCounts[key] <= 0) {
        debugLog(
            `${player.playerName} aus ${player.teamName} kann auf Feld ${fieldValue} keinen Korken löschen`
        );
        return;
    }

    commitGameAction(() => {
        currentGame.fieldCounts[key]--;
        updateFieldCountDisplay(value);
        const scoreText = isOwn
            ? `+${fieldValue}`
            : `-${fieldValue}`;

        let message;

        if (value === "red1" || value === "red-1") {

            if (isOwn) {
                message =
                    `${player.playerName} aus ${player.teamName} löscht Korken auf eigenem roten (+1 rot)`;
            } else {
                message =
                    `${player.playerName} aus ${player.teamName} löscht Korken auf gegnerischem roten (-1 rot)`;
            }

        } else if (fieldValue === 0) {

            message =
                `${player.playerName} aus ${player.teamName} löscht Korken auf Mitte (0)`;

        } else if (isOwn) {

            message =
                `${player.playerName} aus ${player.teamName} löscht Korken auf eigener ${fieldValue} (+${fieldValue})`;

        } else {

            message =
                `${player.playerName} aus ${player.teamName} löscht Korken auf gegnerischer ${fieldValue} (-${fieldValue})`;
        }

        const logId = debugLog(message);

        currentGame.events.push({
            type: "field_remove",
            value: value,
            fieldValue: fieldValue,
            isOwn: isOwn,
            playerId: player.playerId,
            teamIndex: player.teamIndex,
            timestamp: Date.now(),
            logId: logId
        });
    });
}
const last = getLastSelection();
function getGameTimestamp() {

    if (!currentGame) {
        return "00:00";
    }

    const start = new Date(currentGame.startTime);

    let diffSeconds =
        Math.floor(
            (Date.now() - start.getTime()) / 1000
        );

    const days =
        Math.floor(diffSeconds / 86400);

    diffSeconds %= 86400;

    const hours =
        Math.floor(diffSeconds / 3600);

    diffSeconds %= 3600;

    const minutes =
        Math.floor(diffSeconds / 60);

    const seconds =
        diffSeconds % 60;

    if (days > 0) {
        return `${days}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
function getFieldKey(value) {
    return String(value);
}

function getFieldCount(value) {
    if (!currentGame || !currentGame.fieldCounts) return 0;

    const key = getFieldKey(value);
    return currentGame.fieldCounts[key] || 0;
}

function getCurrentPlayerInfo() {
    const position = getCurrentTurnPosition();

    const positionToTeam = {
        topLeft: 0,
        bottomLeft: 0,
        bottomRight: 1,
        topRight: 1
    };

    const positionToPlayerIndex = {
        topLeft: 0,
        bottomLeft: 1,
        bottomRight: 0,
        topRight: 1
    };

    const teamIndex = positionToTeam[position];
    const playerIndex = positionToPlayerIndex[position];

    const playerId = currentGame.teams[teamIndex][playerIndex];

    return {
        playerId: playerId,
        playerName: getPlayerName(playerId),
        teamIndex: teamIndex,
        teamName: `Team ${teamIndex + 1}`,
        position: position
    };
}

function isOwnFieldForTeam(value, teamIndex) {

    if (value === 0) {
        return null;
    }

    if (value === "red1") {
        return teamIndex === 0;
    }

    if (value === "red-1") {
        return teamIndex === 1;
    }

    const numericValue = Number(value);

    if (teamIndex === 0) {
        return numericValue > 0;
    }

    return numericValue < 0;
}

function getFieldAbsValue(value) {

    if (value === 0) {
        return 0;
    }

    if (
        value === "red1" ||
        value === "red-1"
    ) {
        return 1;
    }

    return Math.abs(Number(value));
}

function markLogUndone(logId) {

    let logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    const entry =
        logs.find(x => x.id === logId);

    if (entry) {
        entry.undone = true;
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const el =
        document.getElementById(logId);

    if (el) {
        el.classList.add("debugUndone");
    }
}
function markLogRedone(logId) {
    let logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    const entry =
        logs.find(x => x.id === logId);

    if (entry) {
        entry.undone = false;
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const el =
        document.getElementById(logId);

    if (el) {
        el.classList.remove("debugUndone");
    }
}
function getCurrentScore() {
    if (!currentGame || !currentGame.fieldCounts) {
        return {
            team1: 0,
            team2: 0,
            team1OwnRed: false,
            team1EnemyRed: false,
            team2OwnRed: false,
            team2EnemyRed: false
        };
    }

    const c = currentGame.fieldCounts;

    const leftScore =
        (c["1"] || 0) * 1 +
        (c["2"] || 0) * 2 +
        (c["3"] || 0) * 3;

    const rightScore =
        (c["-1"] || 0) * 1 +
        (c["-2"] || 0) * 2 +
        (c["-3"] || 0) * 3;

    return {
        team1: rightScore,
        team2: leftScore,

        team1OwnRed: false,
        team1EnemyRed: false,

        team2OwnRed: (c["red1"] || 0) > 0,
        team2EnemyRed: (c["red-1"] || 0) > 0
    };
}

function formatTeamScore(points, ownRed) {

    if (ownRed) {
        return `${points}+rot`;
    }

    return String(points);
}
function getRoundResultMessage(roundNumber) {
    const score = getCurrentScore();
    const c = currentGame.fieldCounts;

    const team1Points = score.team1;
    const team2Points = score.team2;

   const diff = Math.abs(team1Points - team2Points);

    const winningTeam =
        team1Points > team2Points
            ? 1
            : team2Points > team1Points
                ? 2
                : 0;

    const team1OwnRed = (c["red1"] || 0) > 0;
    const team1EnemyRed = (c["red-1"] || 0) > 0;

    const team2OwnRed = (c["red-1"] || 0) > 0;
    const team2EnemyRed = (c["red1"] || 0) > 0;

    let parts = [`Ende Runde ${roundNumber}:`];

    if (team1OwnRed && team2OwnRed) {
        parts.push("Beide Teams müssen ihre Biere exen.");
    } else if (team1OwnRed) {
        parts.push("Team 1 muss ihre Biere exen.");
    } else if (team2OwnRed) {
        parts.push("Team 2 muss ihre Biere exen.");
    }

    parts.push(
    winningTeam === 0
        ? "Nullerrunde."
        : `Team ${winningTeam} darf ${diff === 1 ? "einen Schluck" : diff + " Schlücke"} trinken.`
    );

    return parts.join(" ");
}
function getScoreDisplay() {

    const score = getCurrentScore();

    return `${formatTeamScore(
        score.team1,
        (currentGame.fieldCounts["red-1"] || 0) > 0
    )}:${formatTeamScore(
        score.team2,
        (currentGame.fieldCounts["red1"] || 0) > 0
    )}`;
}
function getFieldDomId(value) {
    return "fieldCount_" + String(value).replace("-", "minus").replace("red", "red_");
}

function updateFieldCountDisplay(value) {
    const el = document.getElementById(getFieldDomId(value));

    if (el) {
        el.textContent = getFieldCount(value);
    }
}

function updateAllFieldCountDisplays() {
    [3, 2, 1, 0, -1, -2, -3, "red1", "red-1"].forEach(updateFieldCountDisplay);
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
restoreDebugLog();


document.addEventListener("selectstart", event => {
    event.preventDefault();
});

document.addEventListener("dragstart", event => {
    event.preventDefault();
});

window.addEventListener("selectstart", function (event) {
    event.preventDefault();
    return false;
}, { capture: true });

window.addEventListener("dragstart", function (event) {
    event.preventDefault();
    return false;
}, { capture: true });

const isTouchDevice =
    window.matchMedia("(pointer: coarse)").matches;

if (isTouchDevice) {
    document.addEventListener("contextmenu", event => {
        event.preventDefault();
    });

    window.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        return false;
    }, { capture: true });
}