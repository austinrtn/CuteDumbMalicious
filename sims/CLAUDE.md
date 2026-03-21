# Card Game Simulation — Instructions

## Session Structure
- A **session** contains multiple **rounds**
- A **round** contains N **hands**
- Each rules version gets its own subdirectory: `sims/<rules-version>/`
- A `.json` file is created per round at the **end of that round** (not end of session)

## Roles
- **Orchestrator (Sonnet):** Receives instructions, manages files and directories, spins up Haiku subagents, writes JSON logs
- **Simulator (Haiku subagent):** Runs the hands for a single round, returns results — one subagent per round

## Haiku Agent Protocol
Each Haiku subagent call must include:
1. Full rules text
2. Current round number
3. Output format specification

Each round is fully isolated — fresh deck initialization, fresh deal, no carry-over of held cards, deck state, scores, or player memory from prior rounds. Running totals within a round reset to 0 at the start of that round.

## Logging
- Log results only — no analysis or interpretation
- Write the round's `.json` immediately at the end of each round
- JSON filename format: `round_<N>.json`

## Notes
- Haiku subagents are stateless across rounds; Sonnet feeds them all necessary context each call
- Rules are re-injected every round to maintain consistency

---

## Known Agent Error Patterns (v0.6 Playtest — fix prompts to prevent recurrence)

### Critical

**Subtraction skipped for one player**
Agent reported surviving totals identical to raw totals for one player, meaning no subtraction was applied at all. Explicitly instruct the agent: "For EACH player independently, subtract the opponent's counter-suite points. Do not skip subtraction for either player."

**Incorrect survival math**
Agent computed 20 minus 12 as 0 instead of 8. Remind the agent: "Surviving points = raw total minus opponent's counter-suite total, floored at zero. Show the arithmetic explicitly."

**Tiered scoring applied at wrong value**
Agent scored 17 surviving Rock as 170 (which is the score for 2 surviving points). 17 surviving should score 370 (group 5 starts at 13 at 30/pt: 210 + 30+35+35+35 = wait, let me recalc: 210 + 30+35+35+35... actually: groups 1-4 = 210. Group 5 (13-15) = 30/pt each. Group 6 (16-18) = 35/pt each. 13=240, 14=270, 15=300, 16=335, 17=370). Instruct the agent: "Apply the full tiered table. Do not stop at the last printed row. Extend the pattern for any surviving total above 15."

**Static seal aging missed**
A card held unplayed through one hand should age by +10 before the next hand's selection (up to 50 cap). Agent played a static card at its original 30 value instead of the correct 40. Instruct the agent: "At the end of every hand, increment each held static card's current value by 10, capped at 50. Track this value explicitly in each hand's card objects."

**`resistance_effects` array left empty when Resistance was applied**
Agent correctly halved incoming damage but did not populate the `resistance_effects` array. Instruct the agent: "Even if subtraction math is correct, you MUST populate resistance_effects with an entry for each protected suite showing incoming_damage_before and incoming_damage_after."

**Raw totals not matching played cards**
Agent reported a raw paper total that did not equal the sum of paper values on the played cards. Instruct the agent: "Before proceeding to subtraction, verify raw totals by summing the relevant suite value from each played card. Show the sum explicitly."

### Moderate

**Scoring table values above 12 were 5 points low**
The quick reference table in sim_instructions.md had a 5-point error starting at 13 surviving (235 instead of 240, propagating upward). This has been corrected. Always extend the tiered pattern rather than stopping at the table — the pattern is groups of 3, per-point value starting at 10 and increasing by 5 per group.

### Minor

**Raw total reporting vs effective values after Resistance**
When Resistance is active, raw totals should reflect the card sum before any Resistance modifier. Resistance affects the subtraction step, not the raw total. Do not conflate effective surviving values with raw totals in the JSON output.
