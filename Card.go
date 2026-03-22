package main

type Seal string

type Suit string

type Card struct {
	Player string `json:"player"`
	Seal Seal `json:"seal"`
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

const (
	Swap Seal = "SWAP"
	Peek Seal = "PEEK"
	Tax Seal = "TAX"
	Wild Seal = "WILD"
	Resistance Seal = "RESISTANCE"
	Static Seal = "STATIC"
	None Seal = "NONE"
)

const (
	Cute Suit = "CUTE"
	Bad Suit = "BAD"
	Malicous Suit = "MALICOUS"
)
