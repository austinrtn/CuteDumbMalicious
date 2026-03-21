package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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

type Card struct {
	Player string `json:"player"`
	Val  int    `json:"num"`
	Suit string `json:"suit"`
}

type Deck struct {
	Cards [52]Card
	CardsDealt int
	CardsRemaining int
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
	Deck [52]Card
	DeckIndex int
}

type Player struct {
	Client *Client
	Name string
	InGame bool

	Hand [7]Card
	Points int
	HasSubmitted bool
	SubmittedCard Card
}

type RoundResult struct {
	Player1Name   string `json:"player1Name"`
	Player1Card   Card   `json:"player1Card"`
	Player1Points int    `json:"player1Points"`

	Player2Name   string `json:"player2Name"`
	Player2Card   Card   `json:"player2Card"`
	Player2Points int    `json:"player2Points"`

	WinnerName string `json:"winnerName"`
	WinnerCard Card   `json:"winnerCard"`
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
	http.HandleFunc("/submitCard", func(res http.ResponseWriter, req *http.Request) { submitCard(appState, res, req)})

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
	game := &appState.Game
	player1 := &game.Player1
	player2 := &game.Player2

	fmt.Printf("Before State: %s\n", game.State)

	if game.LobbyFull && game.State == NotStarted {
		initDeck(game)
		game.State = Dealing
		broadcast(appState, User, Dealing)

		var player *Player
		player = player1
		currentPlayerFlag := 0

		i := 0
		for {
			if i == 7 { break }

			d_idx := game.DeckIndex
			player.Hand[i] = game.Deck[d_idx] 
			game.DeckIndex += 1

			if currentPlayerFlag == 0 {
				player = player2
				currentPlayerFlag = 1
			} else {
				player = player1
				currentPlayerFlag = 0
				i++
			}
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
		var winnerName string
		var winnerCard Card

		if player1.SubmittedCard.Val > player2.SubmittedCard.Val {
			winnerName = player1.Name
			winnerCard = player1.SubmittedCard
			player1.Points++
		} else if player2.SubmittedCard.Val > player1.SubmittedCard.Val {
			winnerName = player2.Name
			winnerCard = player2.SubmittedCard
			player2.Points++
		} else {
			winnerName = "DRAW"
			winnerCard = player1.SubmittedCard
		}

		result := RoundResult{
			WinnerName:    winnerName,
			WinnerCard:    winnerCard,
			Player1Name:   player1.Name,
			Player1Card:   player1.SubmittedCard,
			Player1Points: player1.Points,
			Player2Name:   player2.Name,
			Player2Card:   player2.SubmittedCard,
			Player2Points: player2.Points,
		}

		resultJSON, err := json.Marshal(result)
		if err != nil {
			log.Printf("Error marshaling result: %v", err)
			return
		}

		msg := fmt.Sprintf("result:%s", resultJSON)
		player1.Client.Ch <- msg
		player2.Client.Ch <- msg

		game.State = ShowingResults

		// Reset for next round
		player1.HasSubmitted = false
		player2.HasSubmitted = false
		player1.SubmittedCard = Card{}
		player2.SubmittedCard = Card{}
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
	err = json.Unmarshal(out, &game.Deck)
	
	if err != nil {
		log.Printf("InitDeck parse error %v", err)
		return
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

func submitCard(appState *AppState, res http.ResponseWriter, req *http.Request) {
	var card Card
	var player *Player
	game := &appState.Game

	json.NewDecoder(req.Body).Decode(&card)
	
	fmt.Printf("%s | %d | %s\n", card.Player, card.Val, card.Suit)

	if card.Player == game.Player1.Name {
		player = &game.Player1
	} else if card.Player == game.Player2.Name {
		player = &game.Player2
	} else {
		http.Error(res, "Couldn't find player name", http.StatusInternalServerError)
		return
	}

	player.HasSubmitted = true
	player.SubmittedCard = card
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

