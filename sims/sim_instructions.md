# SUITE GAME — Simulation Instructions
**Version 0.6 — For Testing and Insight Gathering Only**

> **CRITICAL:** Read the full Game Rules Document before running any simulation. These instructions cover simulation parameters and output format only. Do not infer rules from these instructions.

---

## Terminology

- **Hand** — a single deal-and-play cycle. Seven cards dealt, five selected and played, subtraction resolved, scoring done. One complete exchange.
- **Round** — a full game consisting of N hands played in sequence. Cards carry over between hands within a round. Static seals age between hands within a round.
- **Round boundary** — full reset. Rounds are completely isolated. No carry-over of cards, scores, deck state, or player memory between rounds.
- **Match** — not a game concept. Do not use this term.

---

## Simulation Parameters

You will be told how many rounds to simulate and how many hands per round at time of prompt. Default is 5 hands per round unless otherwise specified.

Player A leans toward suite investment when the cards support it but prioritizes winning over style when the hand clearly calls for it.

Player B leans toward spread play when the cards support it but prioritizes winning over style when the hand clearly calls for it.

Both players make reasonable human decisions based on the information available to them. Neither player is purely optimal nor purely random.

Simulate the deck initialization seal assignment process at the start of each round before dealing. Track which cards carry seals and maintain that information throughout the round. Reshuffle discarded cards into a new draw pile if the deck is exhausted within a round.

---

## Output Format

> **Your entire output must be a single valid JSON object. Output nothing else. No prose, no explanation, no commentary before or after the JSON.**

Each round is output as a single JSON file. The root object represents one round.

---

## JSON Schema

### Root Object

```json
{
  "round": integer,
  "is_final_hand": boolean,
  "deck_initialization": {
    "total_sealed_cards": integer,
    "seal_counts": {
      "static": integer,
      "peek": integer,
      "resistance": integer,
      "wild": integer,
      "swap": integer,
      "tax": integer
    }
  },
  "hands": [ array of hand objects ],
  "round_summary": {
    "running_total": {
      "player_a": integer,
      "player_b": integer
    }
  }
}
```

### Hand Object

```json
{
  "hand": integer,
  "last_hand_conversions": [ array of conversion objects ],
  "duplicate_seal_conversions": [ array of conversion objects ],
  "suite_sweep_reward": [ array of suite sweep reward objects ],
  "played": {
    "player_a": [ array of 5 card objects ],
    "player_b": [ array of 5 card objects ]
  },
  "held": {
    "player_a": [ array of card objects ],
    "player_b": [ array of card objects ]
  },
  "swap_resolution": [ array of swap resolution objects ],
  "raw_totals": {
    "player_a": { "rock": integer, "paper": integer, "scissors": integer },
    "player_b": { "rock": integer, "paper": integer, "scissors": integer }
  },
  "resistance_effects": [ array of resistance effect objects ],
  "surviving_totals": {
    "player_a": { "rock": integer, "paper": integer, "scissors": integer },
    "player_b": { "rock": integer, "paper": integer, "scissors": integer }
  },
  "suite_winners": {
    "rock": "player_a" or "player_b" or "tie",
    "paper": "player_a" or "player_b" or "tie",
    "scissors": "player_a" or "player_b" or "tie"
  },
  "tax_resolution": [ array of tax resolution objects ],
  "scoring": {
    "player_a": {
      "rock": integer,
      "paper": integer,
      "scissors": integer,
      "static_cards": [ array of static scoring objects ],
      "tax_bonus": integer,
      "suite_sweep_bonus": integer,
      "round_total": integer
    },
    "player_b": {
      "rock": integer,
      "paper": integer,
      "scissors": integer,
      "static_cards": [ array of static scoring objects ],
      "tax_bonus": integer,
      "suite_sweep_bonus": integer,
      "round_total": integer
    }
  },
  "running_total": {
    "player_a": integer,
    "player_b": integer
  },
  "suite_sweep": {
    "player_a": boolean,
    "player_b": boolean
  },
  "peek_resolutions": [ array of peek resolution objects ]
}
```

### Card Object

```json
{
  "id": "string, unique identifier e.g. scout_r4p3s2_001",
  "archetype": "sentinel, scout, tactician, heavy_lean, or nuke",
  "rock": integer,
  "paper": integer,
  "scissors": integer,
  "seal": "static, peek, resistance, wild, swap, tax, or null",
  "static_current_value": "integer or null",
  "wild_assignment": { "rock": integer, "paper": integer, "scissors": integer } or null
}
```

`wild_assignment` is only present if the Wild seal was played this hand and the player assigned suite values. Otherwise null.

`static_current_value` is the current Static point value if the seal is static. Otherwise null.

### Conversion Object

Used in `last_hand_conversions` and `duplicate_seal_conversions`.

```json
{
  "player": "player_a or player_b",
  "card_id": "string",
  "original_seal": "string",
  "converted_to": "static",
  "static_value": integer
}
```

### Suite Sweep Reward Object

```json
{
  "player": "player_a or player_b",
  "seal_awarded": "string",
  "applied_to_card_id": "string"
}
```

### Swap Resolution Object

```json
{
  "player": "player_a or player_b",
  "drew_six": true,
  "top_five_revealed": [ array of 5 card objects ],
  "card_selected_id": "string",
  "cards_returned_to_bottom": [ array of 4 card objects ]
}
```

### Resistance Effect Object

```json
{
  "player": "player_a or player_b, the player who is protected",
  "card_id": "string",
  "suite_protected": "rock, paper, scissors, or all for Sentinel",
  "incoming_damage_before": integer,
  "incoming_damage_after": integer
}
```

### Tax Resolution Object

```json
{
  "taxing_player": "player_a or player_b",
  "taxed_player": "player_a or player_b",
  "suite_taxed": "rock, paper, scissors, or all for Sentinel",
  "tiered_score_before_tax": integer,
  "base_rate_score": integer,
  "premium_stripped": integer
}
```

### Static Scoring Object

```json
{
  "card_id": "string",
  "static_value_before_doubling": integer,
  "doubled": boolean,
  "final_static_score": integer
}
```

### Peek Resolution Object

```json
{
  "player": "player_a or player_b",
  "suite_peeked": "rock, paper, or scissors",
  "opponent_total_in_suite_next_hand": integer
}
```

---

## Critical Reminders

> **ALL POINT VALUES USE THE 10 BASED SYSTEM.** There are no decimals anywhere. Every calculation produces a whole number.

> **STATIC SCORES AT FACE VALUE.** A static_current_value of 30 scores exactly 30. A static_current_value of 50 scores exactly 50. Doubled on Suite Sweep: 50 becomes 100. Do NOT multiply static_current_value by 10. The static value IS the score.

> **PEEK REVEALS FUTURE HAND SUITE TOTALS** after the opponent draws their full next hand. Not held card totals. A zero result is valid information not an error.

> **TAX SEAL APPLIES TO PRIMARY SUITE ONLY** unless the card is a Sentinel in which case all three suites are taxed simultaneously.

> **RESISTANCE SUITE** is determined by the card's primary suite at time of play. Sentinel Resistance protects all three suites simultaneously.

> **SWAP DRAWS 6 NEXT HAND.** Player sees their 6 card hand first, then top 5 revealed, then player picks 1 to complete hand of 7.

> **SUITE SWEEP BONUS is always flat.** 30 points normally, 70 on final hand. Never apply tiering to this bonus.

> **DECK EXHAUSTION** leads to reshuffle of all discarded cards into a new draw pile.

> **TIES IN A SUITE** mean neither player scores from that suite regardless of surviving totals.

> **SCORING TABLE QUICK REFERENCE:** 1pt=10, 2pt=20, 3pt=30, 4pt=45, 5pt=60, 6pt=75, 7pt=95, 8pt=115, 9pt=135, 10pt=160, 11pt=185, 12pt=210, 13pt=240, 14pt=270, 15pt=300, 16pt=335. Pattern is groups of 3 where per point value starts at 10 and increases by 5 per group.

> **RUNNING TOTALS reset to 0 at the start of each round.** Hand 1 of every round starts at 0 for both players.

---

## Tax Seal Scope Clarification

The Tax seal applies only to the suite matching the Tax sealed card's primary suite. It does not strip all three suites simultaneously unless the card is a Sentinel.

**Example.** A Tax seal on a Rock Heavy Lean strips tier premium only from the opponent's surviving Rock points. Their Paper and Scissors tier premiums are unaffected.

**Example.** A Tax seal on a Sentinel strips tier premium from all three of the opponent's surviving suite totals simultaneously.

The `suite_taxed` field in the tax resolution object must reflect this. Use `"rock"`, `"paper"`, or `"scissors"` for non-Sentinel cards. Use `"all"` for Sentinel cards.
