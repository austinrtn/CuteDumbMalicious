# SUITE GAME — Game Rules
**Version 0.6 — Prototype**

---

## Overview

A local multiplayer tactical card game for two players. Players build hands from a shared deck, commit cards simultaneously, and score points by winning suites through a Rock Paper Scissors subtraction economy. The game is played across five rounds. Highest score after five rounds wins.

---

## Deck Composition

150 cards total. All cards are ratio cards. Bonus effects are delivered through seals assigned to cards during deck initialization.

### Ratio Card Archetypes

| Archetype | Copies | Permutations | Per Permutation |
|---|---|---|---|
| Sentinel 3:3:3 | 18 | 1 | 18 |
| Scout 4:3:2 | 42 | 6 | 7 |
| Tactician 5:3:1 | 48 | 6 | 8 |
| Heavy Lean 7:2:0 | 30 | 6 | 5 |
| Nuke 9:0:0 | 12 | 3 | 4 |

### Ratio Card Permutations

Every non-Sentinel card exists in every possible ordering of its three point values across Rock, Paper, and Scissors.

**Scout permutations:**
- Rock4 Paper3 Scissors2
- Rock4 Scissors3 Paper2
- Paper4 Rock3 Scissors2
- Paper4 Scissors3 Rock2
- Scissors4 Rock3 Paper2
- Scissors4 Paper3 Rock2

**Tactician permutations:**
- Rock5 Paper3 Scissors1
- Rock5 Scissors3 Paper1
- Paper5 Rock3 Scissors1
- Paper5 Scissors3 Rock1
- Scissors5 Rock3 Paper1
- Scissors5 Paper3 Rock1

**Heavy Lean permutations:**
- Rock7 Paper2 Scissors0
- Rock7 Scissors2 Paper0
- Paper7 Rock2 Scissors0
- Paper7 Scissors2 Rock0
- Scissors7 Rock2 Paper0
- Scissors7 Paper2 Rock0

**Nuke permutations:**
- Rock9 Paper0 Scissors0
- Paper9 Rock0 Scissors0
- Scissors9 Rock0 Paper0

**Sentinel:**
- Rock3 Paper3 Scissors3 (one permutation only)

---

## Seals

Seals are bonus effects attached to individual cards. They are assigned randomly during deck initialization before any card is dealt. Players do not see seals being assigned. A card's seal is revealed when the card is drawn. Seals are visually represented as a badge image overlaid on the card.

### Seal Assignment During Deck Initialization

Each card rolls independently against every seal's probability during deck initialization. A card may return true on multiple seals simultaneously. If a card returns true on more than one seal it receives only the seal with the lowest current count in the deck at that moment. Ties between seals of equal count are broken randomly.

### Seal Probabilities

| Seal Type | Probability Per Card | Expected Count (150 cards) |
|---|---|---|
| Static | 4 percent | ~6 |
| Resistance | 4 percent | ~6 |
| Swap | 4 percent | ~6 |
| Wild | 4 percent | ~6 |
| Peek | 2 percent | ~3 |
| Tax | 2 percent | ~3 |

Roughly one fifth of the deck will carry a seal. Unsealed cards are standard ratio cards with no bonus effect.

### Duplicate Seal Rule

If a player holds two or more cards carrying the same seal type, the duplicate converts to a 30 point Static bonus before selection. The card retains its full ratio contribution. Only the seal changes. This rule applies to Peek, Resistance, Swap, and Tax seals. Static seals and Wild seals are exempt as multiple copies serve independent functions.

---

## Seal Descriptions

### Static Seal

The card gains an unsubtractable bonus point value that grows each round the card remains unplayed. Static value starts at 30 points and increases by 10 each round the card is not played. Static value is capped at 50 points and cannot exceed this regardless of how long the card is held.

Static points score flat. Every Static point is worth exactly 10. No tiered scoring applies.

If the player achieves a Suite Sweep the round this card is played the Static value doubles before scoring. A Static worth 50 doubles to 100 and scores exactly 100 points.

Multiple Static cards played in the same round are each scored individually. Each Static card doubles independently if the Suite Sweep condition is met.

On the final round the Static seal scores at its current point value as normal. The doubling condition still applies if the player achieves a Suite Sweep.

### Peek Seal

After the round fully resolves the player who played this card chooses one suite. After the opponent draws their replacement cards for the following round the Peek player learns the opponent's total points in that suite across their entire next hand. This is forward looking intelligence about the following round, not information about currently held cards. This information is private to the Peek player.

On the final round the Peek seal converts to a Static seal worth 30 points before selection. The card retains its full ratio contribution. The player is informed of this conversion before making their selection.

### Resistance Seal

The card carrying this seal gains a defensive buff for the round it is played.

For all cards except Sentinel, incoming damage from the counter suite targeting this card's primary suite is halved before subtraction is applied, rounded down.

For Sentinel cards, all three suites gain halved incoming damage simultaneously for the round it is played, making a Resistance sealed Sentinel a rare and powerful defensive anchor that protects the entire hand from counter damage.

A player may play two Resistance sealed cards in the same round provided they protect different suites. Two Resistance seals cannot target the same suite. A Resistance sealed Sentinel counts as protecting all three suites simultaneously, meaning no other Resistance sealed card can be played alongside it in the same round. If this conflict arises the duplicate Resistance seal converts to a 30 point Static bonus before selection per the duplicate seal rule.

Resistance has no effect beyond the round it is played.

### Wild Seal

The card carrying this seal has its ratio freely reassigned by the player at the time of play. The player distributes the card's 9 points across Rock, Paper, and Scissors in any combination they choose. The card's printed ratio is ignored for that round.

### Swap Seal

The player plays this card as one of their five cards this round. Nothing happens immediately. The round resolves normally with this card's ratio contributing to suite totals.

Next round the player draws only 6 cards during the draw phase. The player sees their full 6 card hand before any additional action. The top 5 cards of the deck are then revealed to the player. The player selects 1 of the 5 revealed cards to become their 7th card. The remaining 4 return to the bottom of the deck. The player now has 7 cards and proceeds to normal selection.

The opponent knows the Swap seal fired because the card was revealed during this round and therefore knows the opponent drew only 6 cards next round and selected a 7th from the top 5. The opponent does not know which card was selected.

On the final round the Swap seal converts to a Static seal worth 30 points before selection. The card retains its full ratio contribution. The player is informed of this conversion before making their selection.

### Tax Seal

After subtraction resolves and surviving totals are calculated the following happens before scoring.

1. Calculate what the opponent would have scored in the suite matching this card's primary suite using the full tiered scoring system.
2. Calculate what the opponent scores in that suite using only base rate scoring where every surviving point is worth exactly 10.
3. The difference between these two values is the tier premium stripped.
4. The opponent scores their surviving points in that suite at base rate only for this round.
5. The stripped tier premium is added as flat bonus points to the Tax seal player's score.

For Sentinel cards carrying a Tax seal, all three suites have their tier premium stripped simultaneously, making a Tax sealed Sentinel a rare and powerful offensive card against heavily invested opponents.

The Tax seal is self calibrating. Against modest surviving totals the premium is small. Against deeply invested hands the premium is large. The seal is naturally most powerful against the hands that benefit most from the tiered scoring curve.

If the Tax seal player won zero suites this round the Tax bonus still applies to the opponent's surviving suite regardless of suite win conditions.

---

## Setup

Shuffle the 150 card deck. Assign seals during deck initialization before dealing. Each player is dealt 7 cards. Each player selects 5 cards to play and holds any unplayed cards. At the start of each subsequent round players draw enough new cards to bring their hand back to 7 before selecting 5 to play.

If the draw pile is exhausted reshuffle all discarded cards into a new draw pile and continue.

---

## Turn Sequence

1. **Draw Phase.** Each player draws enough cards to bring their hand to 7. All unplayed cards from the previous round count toward this total. If a player played a Swap sealed card last round they draw only 6 cards this phase.

2. **Swap Resolution.** If a player drew only 6 cards due to a Swap seal played last round, they see their full 6 card hand first. The top 5 cards of the deck are then revealed. The player selects 1 to become their 7th card. The remaining 4 return to the bottom of the deck.

3. **Duplicate Seal Check.** If a player holds two or more cards carrying the same seal type, the duplicate seal converts to a 30 point Static bonus before selection. Static and Wild seals are exempt.

4. **Suite Sweep Reward.** If a player achieved a Suite Sweep last round they now receive a reward seal generated using the same probability distribution as deck initialization. If no seal reaches its probability threshold the seal type that came closest wins. The player sees their full hand before choosing which card to apply the reward seal to. The reward seal is applied before selection begins.

5. **Selection Phase.** Each player privately selects 5 cards to play and designates any remaining cards as unplayed for the next round.

6. **Reveal.** Both players simultaneously reveal their 5 played cards including any seals those cards carry.

7. **Subtraction Phase.** Resolve simultaneously. Rock subtracts from opponent Scissors. Paper subtracts from opponent Rock. Scissors subtracts from opponent Paper. Surviving points floor at zero. Resistance seals applied here.

8. **Surviving Totals.** Calculate each player's surviving points per suite after all subtraction and Resistance effects.

9. **Suite Winners.** The player with more surviving points in a suite wins that suite and is eligible to score from it. The player with fewer surviving points scores nothing from that suite. If both players survive with equal points in a suite neither player scores from it.

10. **Tax Seal Resolution.** If either player played a Tax sealed card this round, calculate and apply the tier premium strip before scoring begins.

11. **Scoring.** Score each winning suite using the tiered system. Add any Static flat points. Add any Tax seal bonus points.

12. **Suite Sweep Bonus.** If a player won two out of three suites this round they earn 30 flat points added directly to their score. On the final round this increases to 70 flat points. The Suite Sweep reward seal is delivered at the start of the following round not immediately.

13. **Peek Resolution.** Any player who played a Peek sealed card this round now chooses one suite. After the opponent draws their replacement cards for the following round the Peek player is informed of the opponent's total points in that suite across their entire next hand.

14. **Unplayed Card Aging.** Static sealed cards that were not played this round increase in value by 10 points up to the cap of 50.

---

## Subtraction Rules

- Rock points subtract from the opponent's Scissors points.
- Paper points subtract from the opponent's Rock points.
- Scissors points subtract from the opponent's Paper points.
- Subtraction is one directional per suite. Your Rock reduces their Scissors. Their Rock reduces your Scissors.
- Surviving points floor at zero.
- Single Resistance seal on primary suite: halve incoming counter damage, round down.
- Sentinel Resistance seal: halve all incoming counter damage across all three suites, round down.
- Two Resistance seals on different primary suites: each suite independently halved, round down.
- Two Resistance seals cannot target the same suite.

---

## Scoring System

All points are expressed in units of 10. All calculations produce whole numbers with no rounding required.

### Suite Scoring

Only the winner of each suite scores from that suite. The loser scores nothing regardless of surviving point total. Points are grouped in threes. The per point value increases by 5 with each successive group of three.

| Surviving Points | Score | Surviving Points | Score |
|---|---|---|---|
| 1 | 10 | 9 | 135 |
| 2 | 20 | 10 | 160 |
| 3 | 30 | 11 | 185 |
| 4 | 45 | 12 | 210 |
| 5 | 60 | 13 | 240 |
| 6 | 75 | 14 | 270 |
| 7 | 95 | 15 | 300 |
| 8 | 115 | 16 | 335 |

**Pattern:** First 3 points worth 10 each. Second 3 worth 15 each. Third 3 worth 20 each. Fourth 3 worth 25 each. Continue adding 5 to the per point value for each subsequent group of three.

### Static Scoring

Static sealed cards score flat. Every Static point is worth exactly 10. No tiered scoring applies. A Static at maximum value of 50 scores exactly 50. If doubled through a Suite Sweep it scores exactly 100. Static scoring is not affected by suite win or loss.

### Tax Seal Scoring

The stripped tier premium is added as flat bonus points to the Tax seal player's score. No tiered scoring applies to the bonus points themselves. The stripped premium applies only to the primary suite of the Tax sealed card, or all suites if the card is a Sentinel.

### Suite Sweep Bonus

Winning two out of three suites earns 30 flat points added directly to that player's score. On the final round this increases to 70 flat points. No tiered scoring applies to this bonus.

---

## Information Available to Each Player

- Each player knows their own hand and all seals on their cards at all times.
- Each player knows the full score history from all previous rounds.
- Each player knows which cards and seals their opponent played in all previous rounds after the reveal step.
- Each player knows how many unplayed cards their opponent is carrying but not which specific cards they are.
- Each player knows how many cards remain in the deck.
- Each player knows when the opponent played a Swap sealed card last round and therefore knows the opponent drew 6 cards and selected a 7th from the top 5 this round. The player does not know which card was selected.
- Each player knows when the opponent achieved a Suite Sweep and received a reward seal but does not know which seal was awarded or which card it was applied to until that card is revealed.
- Peek information is private. Only the player who played the Peek sealed card knows the revealed suite total.
- Players do not know the contents of the opponent's current hand before the reveal.

---

## Last Round Rules

Before selection on the final round the following conversions apply. Players are informed of all conversions before making selection decisions.

- Any unplayed Peek sealed card has its seal convert to a Static seal worth 30 points.
- Any unplayed Swap sealed card has its seal convert to a Static seal worth 30 points.
- All converted cards retain their full ratio point contribution. Only the seal changes.
- The Suite Sweep bonus increases from 30 flat points to 70 flat points for this round only.
- The Static doubling condition still applies on the final round.

---

## Designer Notes

Version 0.6 prototype. Deck size of 150 cards is a working number. Seal probabilities and ratio card distribution are tuning variables subject to change based on playtesting results.
