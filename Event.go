package main

type Event string

const (
	EventRes Event = "res"
	EventTax Event = "tax"
	EventStatic_conversion Event = "static_conversion"
)

type NewEvent struct {
	Event Event `json:"event"`
	Source string `json:"source"`
	Target string `json:"target"`
	Points float64 `json:"points"`
	Suit Suit `json:"suit"`
}

type ResultPlayer struct {
	Player string `json:"player"`
	Cute float64 `json:"cute"`
	Dumb float64 `json:"dumb"`
	Malicous float64 `json:"malicous"`
	Static_pts float64 `json:"static_pts"`
	Suit_wins int `json:"suit_wins"`
	Total float64 `json:"total"`
	Played_peek bool `json:"played_peek"`
	Played_swap bool `json:"played_swap"`
}

type SubmittedHandsResult struct {
	P1 ResultPlayer `json:"p1"`
	P2 ResultPlayer `json:"p2"`
	Events []NewEvent `json:"events"`
}

