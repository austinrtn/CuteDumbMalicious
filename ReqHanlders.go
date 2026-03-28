package main
import (
	"fmt"
	"net/http"
	"encoding/json"
)
func createNewGame(appState *AppState, res http.ResponseWriter, req *http.Request) {
	var gameReq NewGameRequest
	err := json.NewDecoder(req.Body).Decode(&gameReq)

	if err != nil {
		http.Error(res, "Unable to read New Game JSON content", http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	appState.Game = Game{Hands: gameReq.Hands, State: NotStarted}
	appState.GameCreated = true
	res.WriteHeader(http.StatusOK)
}

func gameExists(appState *AppState, res http.ResponseWriter, req *http.Request) {
	_ = req
	if !appState.GameCreated {
		http.Error(res, "No game", http.StatusNotFound)
		return
	}
	res.WriteHeader(http.StatusOK)
}

func submitHand(appState *AppState, res http.ResponseWriter, req *http.Request) {
	var request SubmitHandRequest
	json.NewDecoder(req.Body).Decode(&request)

	fmt.Printf("%s submitted hand\n", request.Player)
	player, err := getPlayerByName(appState, request.Player)
	if err != nil {
		http.Error(res, "Couldnt find player name", http.StatusInternalServerError)
		return
	}

	var hand SubmitHand
	hand.Player = request.Player
	for i, idx := range request.CardIndices {
		hand.Cards[i] = player.Hand[idx]
		player.Hand[idx].Held = false
	}

	player.HasSubmitted = true
	player.SubmittedHand = hand
	sendToDisplays(appState, fmt.Sprintf("submitted:%s", request.Player))
	manageGameState(appState, res, req)
}

func readyForNextRound(appState *AppState, res http.ResponseWriter, req *http.Request) {	
	var playerName PlayerName
	json.NewDecoder(req.Body).Decode(&playerName)

	player, err := getPlayerByName(appState, playerName.Name)
	if err != nil {
		http.Error(res, "Couldnt find player name", http.StatusInternalServerError)
		return
	}

	player.ReadyForNextRound = true

	manageGameState(appState, res, req)
}

func getPlayerByName(appState *AppState, playerName string) (*Player, error) {
	if appState.Game.Player1.Name == playerName {
		return &appState.Game.Player1, nil
	} else if appState.Game.Player2.Name == playerName {
		return &appState.Game.Player2, nil
	} else { return nil, fmt.Errorf("Could not find player \n")}
}

func getConnectedPlayers(appState *AppState, res http.ResponseWriter, req *http.Request) {
	_ = req

	appState.BroadcastMu.Lock()
	var players []string
	for _, client := range appState.Clients {
		if client.ClientT == User {
			players = append(players, client.Name)
		}
	}
	appState.BroadcastMu.Unlock()

	if players == nil {
		players = []string{}
	}

	res.Header().Set("Content-Type", "application/json")
	json.NewEncoder(res).Encode(ConnectedPlayersResponse{Players: players})
}
