package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
)

const PORT = ":3000"
type BroadcastMsg string

// SERVER MESSAGES
const (
	ConnectionEstablished BroadcastMsg = "connection_established"
	LobbyFull BroadcastMsg = "lobby_full"
)

// GAME STATES
const (
	NotStarted BroadcastMsg = "not_started"
	Dealing BroadcastMsg = "dealing"
	CardSelection BroadcastMsg = "card_selection"
	CardsSubmited BroadcastMsg = "cards_submitted"
	ShowingResults BroadcastMsg = "showing_results"

)
type ClientType string
const (
	Display ClientType = "display"
	User ClientType = "user"
)

type Client struct {
	Name string
	ClientT ClientType

	Res http.ResponseWriter
	Flusher http.Flusher
	Ch chan string
}


type AppState struct {
	Clients map[chan string] Client
	BroadcastMu sync.Mutex

	GameCreated bool
	Game Game
}

type Game struct {
	Player1 Player
	Player2 Player
	LobbyFull bool

	State BroadcastMsg
	Hands int
	Deck []Card
	DeckIndex int
}

type Player struct {
	Client *Client
	Name string
	InGame bool

	Hand []Card
	Points int
	HasSubmitted bool
	SubmittedHand SubmitHand
}

type NewGameRequest struct {
	Hands int `json:"hands"`
}

type ConnectedPlayersResponse struct {
	Players []string `json:"players"`
}

func main() {
	// Create static file server
	fs := http.FileServer(http.Dir("http"))

	appState := &AppState{
		Clients: make(map[chan string]Client),
	}
	// Set root directory to project root
	http.Handle("/", fs)

	http.HandleFunc("/createNewGame", func(res http.ResponseWriter, req *http.Request) { createNewGame(appState, res, req)})
	http.HandleFunc("/getConnectedPlayers", func(res http.ResponseWriter, req *http.Request) { getConnectedPlayers(appState, res, req)})
	http.HandleFunc("/gameExists", func(res http.ResponseWriter, req *http.Request) { gameExists(appState, res, req)})
	http.HandleFunc("/play", func(res http.ResponseWriter, req *http.Request) { play(appState, res, req)})
	http.HandleFunc("/submitHand", func(res http.ResponseWriter, req *http.Request) { submitHand(appState, res, req)})

	log.Printf("Listening to %s\n\n", PORT)
	err := http.ListenAndServe(PORT, nil); if err != nil {
		log.Fatal(err)
	}
}

func play(appState *AppState, res http.ResponseWriter, req *http.Request) {
	// Set headers to ensure stream continues for life time of client-server connection
	res.Header().Set("Content-Type", "text/event-stream")
	res.Header().Set("Cache-Control", "no-cache")
	res.Header().Set("Connection", "keep-alive")

	flusher, ok := res.(http.Flusher)
	if !ok {
		http.Error(res, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	name := req.URL.Query().Get("name")
	var clientType ClientType
	if name == "display" {
		clientType = Display
	} else {
		clientType = User
	}

	ch := make(chan string, 16)
	client := Client{
		Name: name,
		ClientT: clientType,
		Res: res,
		Flusher: flusher,
		Ch: ch,
	}

	appState.BroadcastMu.Lock()
	appState.Clients[ch] = client

	broadcastToClient(&client, string(ConnectionEstablished))

	game := &appState.Game
	player1 := &game.Player1
	player2 := &game.Player2
	var player *Player

	if !player1.InGame {
		player = player1
	} else if !player2.InGame {
		player = player2
	} else {
		http.Error(res, "Already two players in game", http.StatusBadRequest)	
		return
	}

	player.Name = name
	player.InGame = true
	player.Client = &client

	lobbyFull := player1.InGame && player2.InGame
	appState.BroadcastMu.Unlock()

	if lobbyFull {
		appState.Game.LobbyFull = true
		broadcast(appState, User, LobbyFull)
		manageGameState(appState, res, req)
	}

	// Keep connection alive until client disconnects
	done := req.Context().Done()
	for {
		select {
		case <-done:
			appState.BroadcastMu.Lock()
			player.InGame = false
			delete(appState.Clients, ch)
			appState.BroadcastMu.Unlock()
			return
		case msg := <-ch:
			broadcastToClient(&client, msg)
		}
	}
}

func manageGameState(appState *AppState, res http.ResponseWriter, req *http.Request) {
	_ = res
	_ = req
	game := &appState.Game
	player1 := &game.Player1
	player2 := &game.Player2

	fmt.Printf("Before State: %s\n", game.State)

	if game.LobbyFull && game.State == NotStarted {
		initDeck(game)
		game.State = Dealing
		broadcast(appState, User, Dealing)

		player1.Hand = make([]Card, 7)
		player2.Hand = make([]Card, 7)

		for i := 0; i < 7; i++ {
			player1.Hand[i] = game.Deck[game.DeckIndex]
			game.DeckIndex++
			player2.Hand[i] = game.Deck[game.DeckIndex]
			game.DeckIndex++
		}

		player1Hand, err := json.Marshal(player1.Hand)
		if err != nil {
			log.Printf("Error marshaling player1 hand: %v", err)
			return
		}
		player1.Client.Ch <- fmt.Sprintf("hand:%s", player1Hand)

		player2Hand, err := json.Marshal(player2.Hand)
		if err != nil {
			log.Printf("Error marshaling player2 hand: %v", err)
			return
		}
		player2.Client.Ch <- fmt.Sprintf("hand:%s", player2Hand)
	}

	if game.State == Dealing && player1.HasSubmitted && player2.HasSubmitted {
		hands := []SubmitHand{player1.SubmittedHand, player2.SubmittedHand}
		result, err := calculateResult(hands)
		if err != nil {
			log.Printf("Calculate error: %v", err)
			return
		}

		resultJSON, err := json.Marshal(result)
		if err != nil {
			log.Printf("Error marshaling result: %v", err)
			return
		}

		msg := fmt.Sprintf("result:%s", resultJSON)
		player1.Client.Ch <- msg
		player2.Client.Ch <- msg

		player1.Points += result.P1.Total
		player2.Points += result.P2.Total

		game.State = ShowingResults

		// Reset for next round
		player1.HasSubmitted = false
		player2.HasSubmitted = false
		player1.SubmittedHand = SubmitHand{}
		player2.SubmittedHand = SubmitHand{}
	}

	if game.State == ShowingResults {
		game.State = Dealing
	}

	fmt.Printf("After State: %s\n", game.State)
}

func initDeck(game *Game) {
	out, err := exec.Command("./InitDeck").Output()
	if err != nil {
		log.Printf("InitDeck error %v", err)
		return
	}

	var deck []Card
	err = json.Unmarshal(out, &deck)
	if err != nil {
		log.Printf("InitDeck parse error %v", err)
		return
	}
	game.Deck = deck
}

func calculateResult(hands []SubmitHand) (SubmittedHandsResult, error) {
	handsJSON, err := json.Marshal(hands)
	if err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("marshal hands: %w", err)
	}

	tmpFile, err := os.CreateTemp("", "hands-*.json")
	if err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(handsJSON); err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("write temp file: %w", err)
	}
	tmpFile.Close()

	out, err := exec.Command("./Calculate", tmpFile.Name()).Output()
	if err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("Calculate exec: %w", err)
	}

	var result SubmittedHandsResult
	if err := json.Unmarshal(out, &result); err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("parse result: %w", err)
	}
	return result, nil
}

/// adds server message to client chanel that JS frontend listens for
func broadcast(appState *AppState, clientType ClientType, msg BroadcastMsg) {
	// Lock from adding clients to client map to not modify
	// map while itereating through it
	appState.BroadcastMu.Lock()
	defer appState.BroadcastMu.Unlock()
	broadcastLocked(appState, clientType, msg)
}

/// Must be wrapped in AppState.Mu lock / unlock.  See broadcast function for example
func broadcastLocked(appState *AppState, clientType ClientType, msg BroadcastMsg) {
	// For each client chanel, send message through it

	for ch := range appState.Clients {
		if clientType == "" || clientType == appState.Clients[ch].ClientT{
			select {
				case ch <- string(msg):
				default:
			}
		}
	}
}

func broadcastToClient(client *Client, msg string) {
	fmt.Fprintf(client.Res, "%s", wrapData(msg))
	client.Flusher.Flush()
}

func wrapData(data string) string {
	str := fmt.Sprintf("data: %s\n\n", data)
	return str
}

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
	var hand SubmitHand
	var player *Player
	game := &appState.Game

	json.NewDecoder(req.Body).Decode(&hand)

	fmt.Printf("%s submitted hand\n", hand.Player)

	if hand.Player == game.Player1.Name {
		player = &game.Player1
	} else if hand.Player == game.Player2.Name {
		player = &game.Player2
	} else {
		http.Error(res, "Couldn't find player name", http.StatusInternalServerError)
		return
	}

	player.HasSubmitted = true
	player.SubmittedHand = hand
	manageGameState(appState, res, req)
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

