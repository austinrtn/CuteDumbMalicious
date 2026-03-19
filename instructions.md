GAME RULES DOCUMENT
Version: 0.5

================================================================================
OVERVIEW
================================================================================

A local multiplayer tactical card game for two players. Players build hands from
a shared deck, commit cards simultaneously, and score points by winning suites
through a Rock Paper Scissors subtraction economy. The game is played across five
rounds. Highest score after five rounds wins.

================================================================================
DECK COMPOSITION
================================================================================

150 cards total. All cards are ratio cards. Bonus effects are delivered through
seals assigned to cards during deck initialization.

RATIO CARD ARCHETYPES

Sentinel 3:3:3          — 18 copies, 1 permutation, 18 each
Scout 4:3:2             — 42 copies, 6 permutations, 7 each
Tactician 5:3:1         — 48 copies, 6 permutations, 8 each
Heavy Lean 7:2:0        — 30 copies, 6 permutations, 5 each
Nuke 9:0:0              — 12 copies, 3 permutations, 4 each

RATIO CARD PERMUTATIONS
Every non-Sentinel card exists in every possible ordering of its three point
values across Rock, Paper, and Scissors.

Scout permutations:
Rock4 Paper3 Scissors2
Rock4 Scissors3 Paper2
Paper4 Rock3 Scissors2
Paper4 Scissors3 Rock2
Scissors4 Rock3 Paper2
Scissors4 Paper3 Rock2

Tactician permutations:
Rock5 Paper3 Scissors1
Rock5 Scissors3 Paper1
Paper5 Rock3 Scissors1
Paper5 Scissors3 Rock1
Scissors5 Rock3 Paper1
Scissors5 Paper3 Rock1

Heavy Lean permutations:
Rock7 Paper2 Scissors0
Rock7 Scissors2 Paper0
Paper7 Rock2 Scissors0
Paper7 Scissors2 Rock0
Scissors7 Rock2 Paper0
Scissors7 Paper2 Rock0

Nuke permutations:
Rock9 Paper0 Scissors0
Paper9 Rock0 Scissors0
Scissors9 Rock0 Paper0

Sentinel:
Rock3 Paper3 Scissors3

================================================================================
SEALS
================================================================================

Seals are bonus effects attached to individual cards. They are assigned randomly
during deck initialization before any card is dealt. Players do not see seals
being assigned. A card's seal is revealed when the card is drawn. Seals are
visually represented as a badge image overlaid on the card.

SEAL ASSIGNMENT DURING DECK INITIALIZATION
Each card rolls independently against every seal's probability. A card may return
true on multiple seals simultaneously. If a card returns true on more than one seal
it receives only the seal with the lowest current count in the deck at that moment.
Ties between seals of equal count are broken randomly.

Sentinel cards cannot receive a Resistance seal as they have no primary suite.

SEAL PROBABILITIES

Static seal        — 10 percent per card
Resistance seal    — 10 percent per card
Swap seal          — 10 percent per card
Wild seal          — 10 percent per card
Peek seal          —  5 percent per card
Tax seal           —  5 percent per card

EXPECTED SEAL COUNTS AT THESE PROBABILITIES
With 150 cards the expected distribution is approximately:

Static             — 15 seals
Resistance         — 15 seals
Swap               — 15 seals
Wild               — 15 seals
Peek               —  8 seals
Tax                —  8 seals
Total              — 76 sealed cards across the deck

Roughly half the deck will carry a seal. Unsealed cards are standard ratio cards
with no bonus effect.

================================================================================
SEAL DESCRIPTIONS
================================================================================

STATIC SEAL
The card gains an unsubtractable bonus point value that grows each round the card
remains unplayed. Static value starts at 30 points and increases by 10 each round
the card is not played. Static value is capped at 50 points.

Static points score flat. Every Static point is worth exactly 10. No tiered
scoring applies.

If the player achieves a Suite Sweep the round this card is played the Static
value doubles before scoring. A Static worth 50 doubles to 100 and scores
exactly 100 points.

On the final round the Peek seal converts to a Static seal worth its current
point value as a flat scoring bonus. The card retains its full ratio contribution.
Only the seal changes.

PEEK SEAL
After the round fully resolves the player who played this card chooses one suite.
After the opponent draws their replacement cards for the following round the Peek
player learns the opponent's total points in that suite across their entire next
hand. This is forward looking intelligence about the following round, not
information about currently held cards. This information is private to the Peek
player.

On the final round the Peek seal converts to a Static seal worth 30 points before
selection. The card retains its full ratio contribution. The player is informed of
this conversion before making their selection.

RESISTANCE SEAL
The primary suite of the card carrying this seal gains halved incoming damage for
the round it is played. Incoming damage from the counter suite targeting this card's
primary suite is halved before subtraction is applied, rounded down.

If a player plays two Resistance sealed cards in the same round they may either
protect two different primary suites, each halving their respective incoming damage,
or stack both on the same primary suite to reduce incoming damage to 25 percent,
rounded down.

Resistance has no effect beyond the round it is played.

WILD SEAL
The card carrying this seal has its ratio freely reassigned by the player at the
time of play. The player distributes the card's 9 points across Rock, Paper, and
Scissors in any combination they choose. The card's printed ratio is ignored for
that round.

SWAP SEAL
The player sacrifices this card as one of their five played cards this round.
Next round the player draws only 6 cards during the draw phase. Before selection
the top 5 cards of the deck are revealed to the player. The player selects 1 of
the 5 to become their 7th card. The remaining 4 return to the bottom of the deck.
The player now has 7 cards and proceeds to normal selection.

The opponent knows the Swap seal fired because the card was revealed during this
round, and therefore knows the opponent drew only 6 cards next round and selected
a 7th from the top 5. The opponent does not know which card was selected.

On the final round the Swap seal converts to a Static seal worth 30 points before
selection. The card retains its full ratio contribution. The player is informed of
this conversion before making their selection.

TAX SEAL
After subtraction resolves and surviving totals are calculated, the following
happens before scoring.

Step 1. Calculate what the opponent would have scored across all surviving suites
using the full tiered scoring system.
Step 2. Calculate what the opponent scores across all surviving suites using only
base rate scoring where every surviving point is worth exactly 10 regardless of
tier.
Step 3. The difference between these two values is the tier premium stripped.
Step 4. The opponent scores their surviving suites at base rate only for this round.
Step 5. The stripped tier premium is added as flat bonus points to the Tax seal
player's score.

The Tax seal is self calibrating. Against modest surviving totals the premium is
small. Against deeply invested hands the premium is large. The seal is naturally
most powerful against the hands that benefit most from the tiered scoring curve.

If the Tax seal player won zero suites this round the Tax bonus still applies to
the opponent's surviving suites regardless of suite win conditions.

================================================================================
SETUP
================================================================================

Shuffle the 150 card deck. Assign seals during deck initialization before dealing
as described above. Each player is dealt 7 cards. Each player selects 5 cards to
play and holds any unplayed cards. At the start of each subsequent round players
draw enough new cards to bring their hand back to 7 before selecting 5 to play.

If the draw pile is exhausted reshuffle all discarded cards into a new draw pile
and continue.

================================================================================
TURN SEQUENCE
================================================================================

Step 1. Draw phase. Each player draws enough cards to bring their hand to 7.
All unplayed cards from the previous round count toward this total. If a player
played a Swap sealed card last round they draw only 6 cards this phase, then
proceed to Swap resolution before selection.

Step 2. Swap resolution. If a player drew only 6 cards due to a Swap seal played
last round, the top 5 cards of the deck are now revealed to that player. The player
selects 1 to become their 7th card. The remaining 4 return to the bottom of the
deck. The player now has 7 cards.

Step 3. Suite Sweep reward. If a player achieved a Suite Sweep last round they
now receive a reward seal. The reward seal is generated using the same probability
distribution as deck initialization. If no seal reaches its probability threshold
the seal type that came closest wins. The player sees their full 7 card hand before
choosing which card to apply the reward seal to. The reward seal is applied to the
chosen card before selection begins.

Step 4. Selection phase. Each player privately selects 5 cards to play and
designates any remaining cards as unplayed for the next round.

Step 5. Reveal. Both players simultaneously reveal their 5 played cards including
any seals those cards carry.

Step 6. Subtraction phase. Resolve simultaneously.
Rock subtracts from opponent's Scissors.
Paper subtracts from opponent's Rock.
Scissors subtracts from opponent's Paper.
Surviving points floor at zero.
Resistance seals applied here. Single Resistance halves incoming damage to that
card's primary suite. Two Resistance seals on the same primary suite reduce
incoming damage to 25 percent. Two Resistance seals on different primary suites
each independently halve their respective incoming damage. All halving rounded down.

Step 7. Surviving totals. Calculate each player's surviving points per suite after
all subtraction and Resistance effects are applied.

Step 8. Suite winners. The player with more surviving points in a suite wins that
suite and is eligible to score from it. The player with fewer surviving points
scores nothing from that suite. If both players survive with equal points in a
suite neither player scores from it.

Step 9. Tax seal resolution. If either player played a Tax sealed card this round,
calculate and apply the tier premium strip now before scoring begins. The opponent
scores at base rate only. The stripped premium goes to the Tax seal player as flat
bonus points.

Step 10. Scoring. Score each winning suite using the tiered system. Add any Static
flat points. Add any Tax seal bonus points. Add suite win bonus if applicable.

Step 11. Suite Sweep bonus. If a player won two out of three suites this round
they earn 30 flat points added directly to their score. On the final round this
increases to 70 flat points. The Suite Sweep reward seal described in Step 3 is
delivered at the start of the following round not immediately.

Step 12. Peek resolution. Any player who played a Peek sealed card this round now
chooses one suite. After the opponent draws their replacement cards for the
following round the Peek player is informed of the opponent's total points in that
suite across their entire next hand.

Step 13. Unplayed card aging. Static sealed cards that were not played this round
increase in value by 10 points up to the cap of 50.

================================================================================
SUBTRACTION RULES
================================================================================

Rock points subtract from the opponent's Scissors points.
Paper points subtract from the opponent's Rock points.
Scissors points subtract from the opponent's Paper points.

Subtraction is one directional per suite. Your Rock reduces their Scissors. Their
Rock reduces your Scissors. Each suite is resolved independently.

Surviving points equal that suite's starting points minus the opponent's counter
suite points with a floor of zero.

Resistance modifies the incoming counter suite before subtraction is applied.
Single Resistance seal on primary suite: halve incoming counter damage, round down.
Double Resistance same primary suite: reduce incoming counter damage to 25 percent,
round down.
Double Resistance different primary suites: each suite independently halved,
round down.

================================================================================
SCORING SYSTEM
================================================================================

All points are expressed in units of 10. All calculations produce whole numbers
with no rounding required.

SUITE SCORING
Only the winner of each suite scores from that suite. The loser scores nothing
regardless of surviving point total.

Points are grouped in threes. The per point value increases by 50 with each
successive group of three.

First group of 3 surviving points: each point worth 10. Group total 30.
Second group of 3 surviving points: each point worth 15. Group total 45.
Third group of 3 surviving points: each point worth 20. Group total 60.
Fourth group of 3 surviving points: each point worth 25. Group total 75.
Fifth group of 3 surviving points: each point worth 30. Group total 90.
Continue adding 50 to the per point value for each subsequent group of three.

QUICK REFERENCE SCORING TABLE

Surviving Points | Score
1                | 10
2                | 20
3                | 30
4                | 45
5                | 60
6                | 75
7                | 95
8                | 115
9                | 135
10               | 160
11               | 185
12               | 210
13               | 235
14               | 265
15               | 295

STATIC SCORING
Static sealed cards score flat. Every Static point is worth exactly 10. No tiered
scoring applies. A Static at maximum value of 50 scores exactly 50. If doubled
through a Suite Sweep it scores exactly 100. Static scoring is not affected by
suite win or loss.

TAX SEAL SCORING
The stripped tier premium is added as flat bonus points to the Tax seal player's
score. No tiered scoring applies to the bonus points themselves.

SUITE SWEEP BONUS
Winning two out of three suites earns 30 flat points added directly to that
player's score. On the final round this increases to 70 flat points. No tiered
scoring applies to this bonus.

================================================================================
INFORMATION AVAILABLE TO EACH PLAYER
================================================================================

Each player knows their own hand and all seals on their cards at all times.
Each player knows the full score history from all previous rounds.
Each player knows which cards and seals their opponent played in all previous
rounds after the reveal step.
Each player knows how many unplayed cards their opponent is carrying but not
which specific cards they are.
Each player knows how many cards remain in the deck.
Each player knows when the opponent played a Swap sealed card last round and
therefore knows the opponent drew 6 cards and selected a 7th from the top 5
this round. The player does not know which card was selected.
Each player knows when the opponent achieved a Suite Sweep and received a reward
seal but does not know which seal was awarded or which card it was applied to
until that card is revealed.
Peek information is private. Only the player who played the Peek sealed card
knows the revealed suite total.
Players do not know the contents of the opponent's current hand before the reveal.

================================================================================
LAST ROUND RULES
================================================================================

Before selection on the final round the following conversions apply. Players are
informed of all conversions before making selection decisions.

Any Peek sealed card in either player's unplayed cards has its seal convert to a
Static seal worth 30 points.
Any Swap sealed card in either player's unplayed cards has its seal convert to a
Static seal worth 30 points.

All converted cards retain their full ratio point contribution. Only the seal
changes.

The Suite Sweep bonus increases from 30 flat points to 70 flat points for this
round only.

The Static doubling condition still applies on the final round. A player who
achieves a Suite Sweep while playing Static sealed cards doubles each Static
card's value before scoring.

================================================================================
DESIGNER NOTES
================================================================================

This document reflects Version 0.5 of the prototype. Rules are subject to change.
Deck size of 150 cards is a working number and will be finalized during end stage
development. Seal probabilities and ratio card distribution are tuning variables
that will be adjusted based on playtesting results.
