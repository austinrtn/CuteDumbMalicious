package main

type Card struct {
	Player string `json:"player"`
	Seal Seal `json:"seal"`
	Is_sentinel bool `json:"is_sentinel"`
	Primary struct {
		Val int `json:"val"`
		Suit Suit `json:"suit"`
	} `json:"primary"`
	Secondary struct {
		Val int `json:"val"`
		Suit Suit `json:"suit"`
	} `json:"secondary"`
	Tertiary struct {
		Val int `json:"val"`
		Suit Suit `json:"suit"`
	} `json:"tertiary"`
}

type SubmitHand struct {
	Player string `json:"player"`
	Cards [5]Card `json:"cards"`
}

type Seal string

const (
	Swap Seal = "SWAP"
	Peek Seal = "PEEK"
	Tax Seal = "TAX"
	Wild Seal = "WILD"
	Resistance Seal = "RESISTANCE"
	Static Seal = "STATIC"
	None Seal = "NONE"
)

type Suit string

const (
	Cute Suit = "CUTE"
	Dumb Suit = "DUMB"
	Malicous Suit = "MALICOUS"
)

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

