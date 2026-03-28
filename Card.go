package main

type Card struct {
	Player string `json:"player"`
	Seal Seal `json:"seal"`
	Is_sentinel bool `json:"is_sentinel"`
	Held bool `json:"held"`
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
