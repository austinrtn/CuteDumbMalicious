package main

import (
	"bytes"
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
	ReadyForNextRound BroadcastMsg = "ready_for_next_round"
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
	Round int
}

type Player struct {
	Client *Client
	Name string
	InGame bool

	Hand []Card
	Points int
	CardCount int
	HasSubmitted bool
	SubmittedHand SubmitHand
	ReadyForNextRound bool
}

type NewGameRequest struct {
	Hands int `json:"hands"`
}

type ConnectedPlayersResponse struct {
	Players []string `json:"players"`
}

type PlayerName struct {
	Name string `json:"player"`
}

type SubmitHandRequest struct {
	Player      string `json:"player"`
	CardIndices [5]int `json:"card_indices"`
}

func main() {
	// Create static file server
	fs := http.FileServer(http.Dir("http"))

	appState := &AppState{
		Clients: make(map[chan string]Client),
	}
	// Set root directory to project root
	noCache := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			h.ServeHTTP(w, r)
		})
	}
	http.Handle("/", noCache(fs))

	http.HandleFunc("/createNewGame", func(res http.ResponseWriter, req *http.Request) { createNewGame(appState, res, req)})
	http.HandleFunc("/getConnectedPlayers", func(res http.ResponseWriter, req *http.Request) { getConnectedPlayers(appState, res, req)})
	http.HandleFunc("/gameExists", func(res http.ResponseWriter, req *http.Request) { gameExists(appState, res, req)})
	http.HandleFunc("/play", func(res http.ResponseWriter, req *http.Request) { play(appState, res, req)})
	http.HandleFunc("/submitHand", func(res http.ResponseWriter, req *http.Request) { submitHand(appState, res, req)})
	http.HandleFunc("/readyForNextRound", func(res http.ResponseWriter, req *http.Request) { readyForNextRound(appState, res, req)})

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

	// Display clients don't occupy a player slot — just keep SSE alive
	if clientType == Display {
		game := &appState.Game
		// If a round is already in progress, catch the display up
		if game.State != NotStarted && game.Player1.InGame && game.Player2.InGame {
			roundMsg := fmt.Sprintf("round:%d/%d/%s/%s", game.Round+1, game.Hands, game.Player1.Name, game.Player2.Name)
			ch <- roundMsg
			ch <- fmt.Sprintf("scores:%d/%d", game.Player1.Points, game.Player2.Points)
		}
		appState.BroadcastMu.Unlock()
		sseLoop(appState, &client, ch, req, nil)
		return
	}

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
		broadcast(appState, "", LobbyFull)
		manageGameState(appState, res, req)
	}

	sseLoop(appState, &client, ch, req, player)
}

func sseLoop(appState *AppState, client *Client, ch chan string, req *http.Request, player *Player) {
	done := req.Context().Done()
	for {
		select {
		case <-done:
			appState.BroadcastMu.Lock()
			if player != nil {
				player.InGame = false
			}
			delete(appState.Clients, ch)
			appState.BroadcastMu.Unlock()
			return
		case msg := <-ch:
			broadcastToClient(client, msg)
		}
	}
}

func manageGameState(appState *AppState, res http.ResponseWriter, req *http.Request) {
	_ = res
	_ = req
	game := &appState.Game
	player1 := &game.Player1
	player2 := &game.Player2

	prevState := game.State

	// If the game has not started but both players have joined the lobby
	// 1. Initialize / generate the deck
	// 2. Initialize player hand
	// 3. Deal each player 7 cards 
	

	if game.LobbyFull && game.State == NotStarted {
		initDeck(game)
		broadcast(appState, User, Dealing)

		player1.Hand = make([]Card, 7)
		player2.Hand = make([]Card, 7)

		game.State = Dealing
	}

	if game.State == Dealing {
		deal(appState)
		game.State = CardSelection
	}

	if player1.HasSubmitted && player2.HasSubmitted {
		game.State = CardsSubmited
	}

	if  game.State == CardsSubmited {
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

		handsJSON, _ := json.Marshal(hands)
		sendToDisplays(appState, fmt.Sprintf("hands:%s", handsJSON))
		sendToDisplays(appState, msg)
		sendToDisplays(appState, fmt.Sprintf("scores:%d/%d", player1.Points, player2.Points))

		game.State = ShowingResults

		// Reset for next round
		player1.HasSubmitted = false
		player2.HasSubmitted = false
		player1.SubmittedHand = SubmitHand{}
		player2.SubmittedHand = SubmitHand{}
	}

	if game.State == ShowingResults {
		if player1.ReadyForNextRound && player2.ReadyForNextRound {
			game.State = ReadyForNextRound
		}
	}

	if game.State == ReadyForNextRound {
		player1.ReadyForNextRound = false
		player2.ReadyForNextRound = false
		sendToDisplays(appState, "next_round")
		game.State = Dealing
		game.Round += 1
		if game.Round < game.Hands {
			manageGameState(appState, res, req)
		} else {
			log.Print("End Game!")	
		}

		return
	}

	logGameState(prevState, game.State, player1, player2)
}

func logGameState(prev, next BroadcastMsg, p1, p2 *Player) {
	if prev == next {
		fmt.Printf("[STATE] %s (no change)\n", next)
	} else {
		fmt.Printf("[STATE] %s → %s\n", prev, next)
	}
	fmt.Printf("  %-12s submitted=%-5v ready=%v\n", p1.Name, p1.HasSubmitted, p1.ReadyForNextRound)
	fmt.Printf("  %-12s submitted=%-5v ready=%v\n", p2.Name, p2.HasSubmitted, p2.ReadyForNextRound)
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

func deal(appState *AppState) {
	game := &appState.Game
	player1 := &game.Player1
	player2 := &game.Player2

	for i := 0; i < 7; i++ {
		if !player1.Hand[i].Held {
			player1.Hand[i] = game.Deck[game.DeckIndex]
			player1.Hand[i].Held = true
			player1.CardCount += 1
			game.DeckIndex++
		}
		if !player2.Hand[i].Held {
			player2.Hand[i] = game.Deck[game.DeckIndex]
			player2.Hand[i].Held = true
			player1.CardCount += 2
			game.DeckIndex++
		}
	}

	player1Hand, err := json.Marshal(player1.Hand)
	if err != nil {
		log.Printf("Error marshaling player1 hand: %v", err)
		return
	}
	roundMsg := fmt.Sprintf("round:%d/%d/%s/%s", game.Round+1, game.Hands, player1.Name, player2.Name)
	player1.Client.Ch <- roundMsg
	player1.Client.Ch <- fmt.Sprintf("hand:%s", player1Hand)

	player2Hand, err := json.Marshal(player2.Hand)
	if err != nil {
		log.Printf("Error marshaling player2 hand: %v", err)
		return
	}
	player2.Client.Ch <- roundMsg
	player2.Client.Ch <- fmt.Sprintf("hand:%s", player2Hand)

	sendToDisplays(appState, roundMsg)
	sendToDisplays(appState, fmt.Sprintf("scores:%d/%d", player1.Points, player2.Points))
}

func calculateResult(hands []SubmitHand) (SubmittedHandsResult, error) {
	handsJSON, err := json.Marshal(hands)
	if err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("marshal hands: %w", err)
	}

	cmd := exec.Command("./Calculate")
	cmd.Stdin = bytes.NewReader(handsJSON)
	cmd.Stderr = os.Stderr

	out, err := cmd.Output()
	if err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("Calculate exec: %w", err)
	}

	var result SubmittedHandsResult
	if err := json.Unmarshal(out, &result); err != nil {
		return SubmittedHandsResult{}, fmt.Errorf("parse result: %w", err)
	}
	return result, nil
}

func sendToDisplays(appState *AppState, msg string) {
	appState.BroadcastMu.Lock()
	defer appState.BroadcastMu.Unlock()
	for ch, client := range appState.Clients {
		if client.ClientT == Display {
			select {
			case ch <- msg:
			default:
			}
		}
	}
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

