package main

type Seal string

type Card struct {
	Player string `json:"player"`
	Seal Seal `json:"seal"`
	Num int `json:"num"`
}

const (
	Swap Seal = "SWAP"
	Peek Seal = "PEEK"
	Tax Seal = "TAX"
	Wild Seal = "WILD"
	Resistance Seal = "RESISTANCE"
	Static Seal = "STATIC"
)
