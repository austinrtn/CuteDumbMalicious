package main

type Seal string

type Card struct {
	Player string `json:"player"`
	Seal Seal `json:"seal"`
	Cute int `json:"cute"`
	Bad int `json:"bad"`
	Malicious int `json:"malicious"`
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
