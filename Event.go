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
	Points int `json:"points"`
	Suit Suit `json:"suit"`
}

type ResultPlayer struct {
	Player string `json:"player"`
	Cute int `json:"cute"`
	Dumb int `json:"dumb"`
	Malicous int `json:"malicous"`
	Static_pts int `json:"static_pts"`
	Suit_wins int `json:"suit_wins"`
	Total int `json:"total"`
}

type SubmittedHandsResult struct {
	P1 ResultPlayer `json:"p1"`
	P2 ResultPlayer `json:"p2"`
	Events []NewEvent `json:"events"`
}

