package main

import (
	"fmt"
	"encoding/json"
	"log"
	"net/http"
	"sync"
)

const PORT = ":3000"
type BroadcastMsg string
const (
	ConnectionEstablished BroadcastMsg = "connection_established"
	WaitingForPlayer BroadcastMsg = "waiting_for_player"
	LobbyFull BroadcastMsg = "lobby_full"
	PlayerReady BroadcastMsg = "player_ready"
	AllPlayersReady BroadcastMsg = "all_players_ready"
)

type ClientType string
const (
	Display ClientType = "display"
	User ClientType = "user"
)

type Client struct {
	Name string
	ClientT ClientType
}

type Card struct {
	Val int
	Suit int32 
}

type Deck struct {
	Cards [52]Card
	CardsDealt int
	CardsRemaining int
}

type AppState struct {
	Clients map[chan BroadcastMsg] Client
	BroadcastMu sync.Mutex

	SessionCreated bool
	Session Session
}

type Session struct {
	Player1 Player
	Player2 Player
	Hands int
	LobbyFull bool
}

type Player struct {
	Name string
	Hand [7]Card
	InGame bool
	Ready bool 
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
		Clients: make(map[chan BroadcastMsg]Client),
	}
	// Set root directory to project root
	http.Handle("/", fs)

	http.HandleFunc("/startNewGame", func(res http.ResponseWriter, req *http.Request) { startNewGame(appState, res, req)})
	http.HandleFunc("/getConnectedPlayers", func(res http.ResponseWriter, req *http.Request) { getConnectedPlayers(appState, res, req)})
	http.HandleFunc("/sessionExists", func(res http.ResponseWriter, req *http.Request) { sessionExists(appState, res, req)})
	http.HandleFunc("/play", func(res http.ResponseWriter, req *http.Request) { play(appState, res, req)})
	http.HandleFunc("/ready", func(res http.ResponseWriter, req *http.Request) { ready(appState, res, req)})

	go loop(appState)

	log.Printf("Listening to %s\n\n", PORT)
	err := http.ListenAndServe(PORT, nil); if err != nil {
		log.Fatal(err)
	}
}

func loop(appState *AppState) {
	session := &appState.Session
	player1 := &session.Player1
	player2 := &session.Player2

	lobbyFull := false

	for {
		if player1.InGame && player2.InGame	{
			lobbyFull = true
		} else {
			lobbyFull = false
		}

		if lobbyFull && !session.LobbyFull {
			broadcast(appState, User, LobbyFull)
		}

		if !session.LobbyFull {
			continue 
		}
		

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

	client := Client{
		Name: name,
		ClientT: clientType,
	}

	ch := make(chan BroadcastMsg, 1)
	appState.BroadcastMu.Lock()
	appState.Clients[ch] = client

	broadcastToClient(res, flusher, ConnectionEstablished)

	session := &appState.Session
	player1 := &session.Player1
	player2 := &session.Player2
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
	appState.BroadcastMu.Unlock()

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
			broadcastToClient(res, flusher, msg)
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
				case ch <- msg:
				default:
			}
		}
	}
}

func broadcastToClient(res http.ResponseWriter, flusher http.Flusher, msg BroadcastMsg) {
	fmt.Fprintf(res, "%s", wrapData(string(msg)))
	flusher.Flush()
}

func wrapData(data string) string {
	str := fmt.Sprintf("data: %s\n\n", data)
	return str
}

func startNewGame(appState *AppState, res http.ResponseWriter, req *http.Request) {
	var gameReq NewGameRequest
	err := json.NewDecoder(req.Body).Decode(&gameReq)

	if err != nil {
		http.Error(res, "Unable to read New Game JSON content", http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	appState.Session = Session{Hands: gameReq.Hands}
	appState.SessionCreated = true
	res.WriteHeader(http.StatusOK)
}


func sessionExists(appState *AppState, res http.ResponseWriter, req *http.Request) {
	_ = req
	if !appState.SessionCreated {
		http.Error(res, "No session", http.StatusNotFound)
		return
	}
	res.WriteHeader(http.StatusOK)
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

type ReadyRequest struct {
	Name string `json:"name"`
}

func ready(appState *AppState, res http.ResponseWriter, req *http.Request) {
	var readyReq ReadyRequest
	err := json.NewDecoder(req.Body).Decode(&readyReq)
	if err != nil {
		http.Error(res, "Unable to read ready request", http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	appState.BroadcastMu.Lock()
	session := &appState.Session
	if session.Player1.Name == readyReq.Name {
		session.Player1.Ready = true
	} else if session.Player2.Name == readyReq.Name {
		session.Player2.Ready = true
	}
	bothReady := session.Player1.Ready && session.Player2.Ready
	appState.BroadcastMu.Unlock()

	if bothReady {
		broadcast(appState, "", AllPlayersReady)
	} else {
		broadcast(appState, "", PlayerReady)
	}

	res.WriteHeader(http.StatusOK)
}
