package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"bytes"
	"os"
)

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

	PlayedPeek bool
	PlayedSwap bool
}

// GAME STATES
const (
	NotStarted BroadcastMsg = "not_started"
	Dealing BroadcastMsg = "dealing"
	CardSelection BroadcastMsg = "card_selection"
	CardsSubmited BroadcastMsg = "cards_submitted"
	ShowingResults BroadcastMsg = "showing_results"
	ReadyForNextRound BroadcastMsg = "ready_for_next_round"
)

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
		player1.PlayedPeek = result.P1.Played_peek
		player1.PlayedSwap = result.P1.Played_swap

		player2.Points += result.P2.Total
		player2.PlayedPeek = result.P2.Played_peek
		player2.PlayedSwap = result.P2.Played_swap

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

	p1Target := 7
	p2Target := 7
	if player1.PlayedSwap { p1Target = 6 }
	if player2.PlayedSwap { p2Target = 6 }

	p1Held := 0
	p2Held := 0
	for i := 0; i < 7; i++ {
		if player1.Hand[i].Held { p1Held++ }
		if player2.Hand[i].Held { p2Held++ }
	}

	p1Dealt := 0
	p2Dealt := 0
	for i := 0; i < 7; i++ {
		if !player1.Hand[i].Held && p1Held+p1Dealt < p1Target {
			player1.Hand[i] = game.Deck[game.DeckIndex]
			player1.Hand[i].Held = true
			player1.CardCount += 1
			p1Dealt++
			game.DeckIndex++
		}
		if !player2.Hand[i].Held && p2Held+p2Dealt < p2Target {
			player2.Hand[i] = game.Deck[game.DeckIndex]
			player2.Hand[i].Held = true
			player2.CardCount += 1
			p2Dealt++
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

func logGameState(prev, next BroadcastMsg, p1, p2 *Player) {
	if prev == next {
		fmt.Printf("[STATE] %s (no change)\n", next)
	} else {
		fmt.Printf("[STATE] %s → %s\n", prev, next)
	}
	fmt.Printf("  %-12s submitted=%-5v ready=%v\n", p1.Name, p1.HasSubmitted, p1.ReadyForNextRound)
	fmt.Printf("  %-12s submitted=%-5v ready=%v\n", p2.Name, p2.HasSubmitted, p2.ReadyForNextRound)
}
