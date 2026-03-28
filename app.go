package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"
)

const PORT = ":3000"
type BroadcastMsg string

// SERVER MESSAGES
const (
	ConnectionEstablished BroadcastMsg = "connection_established"
	LobbyFull BroadcastMsg = "lobby_full"
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
