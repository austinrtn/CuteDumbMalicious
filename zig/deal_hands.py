#!/usr/bin/env python3
import json
import subprocess

# Run InitDeck and parse JSON output
result = subprocess.run(
    ["./zig-out/bin/InitDeck"],
    capture_output=True, text=True, check=True
)
deck = json.loads(result.stdout)

# Take the top 10 cards
top10 = deck[:10]

# Split between two players: 5 cards each
p1_cards = top10[:5]
p2_cards = top10[5:]

for card in p1_cards:
    card["player"] = "player1"
for card in p2_cards:
    card["player"] = "player2"

output = [
    {"player": "player1", "cards": p1_cards},
    {"player": "player2", "cards": p2_cards},
]

with open("submit_hands.json", "w") as f:
    json.dump(output, f, indent=2)

print(json.dumps(output, indent=2))
