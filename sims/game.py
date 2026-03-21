"""
Suite Game Simulator
====================
Python handles all game mechanics. An LLM (via Ollama) makes card selection decisions.
All math is verified by the script - the model only picks which 5 cards to play.

Each run simulates one round (a full game of N hands). Rounds are fully isolated —
fresh deck, fresh seals, no carry-over.

Usage:
    python game.py --hands 5 --model deepseek-r1:7b
    python game.py --hands 5 --model llama3.1:8b --output round_9.json

Requirements:
    pip install requests
    Ollama running locally: https://ollama.com
    Pull your model first: ollama pull deepseek-r1:7b

Configuration:
    OLLAMA_URL  - default http://localhost:11434
    Model name  - passed via --model flag
"""

import argparse
import json
import math
import random
import sys
import time
import requests
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Optional

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

OLLAMA_URL = "http://localhost:11434"
MAX_RETRIES = 3
STATIC_CAP = 50
STATIC_START = 30
STATIC_INCREMENT = 10
SWEEP_BONUS_NORMAL = 30
SWEEP_BONUS_FINAL = 70


# ─────────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────────

def tiered_score(n: int) -> int:
    """Score surviving points using the tiered curve.
    Groups of 3, per-point value increases by 5 each group starting at 10."""
    if n <= 0:
        return 0
    total = 0
    group = 0
    remaining = n
    while remaining > 0:
        take = min(3, remaining)
        per_point = 10 + group * 5
        total += take * per_point
        remaining -= take
        group += 1
    return total


# ─────────────────────────────────────────────
# CARD AND DECK
# ─────────────────────────────────────────────

SEAL_TYPES = ["static", "resistance", "swap", "wild", "peek", "tax"]
SEAL_PROBS = {"static": 0.04, "resistance": 0.04, "swap": 0.04,
              "wild": 0.04, "peek": 0.02, "tax": 0.02}

ARCHETYPES = [
    # (archetype_name, rock, paper, scissors)
    ("sentinel", 3, 3, 3),
    ("scout",    4, 3, 2), ("scout",    4, 2, 3),
    ("scout",    3, 4, 2), ("scout",    2, 4, 3),
    ("scout",    3, 2, 4), ("scout",    2, 3, 4),
    ("tactician",5, 3, 1), ("tactician",5, 1, 3),
    ("tactician",3, 5, 1), ("tactician",1, 5, 3),
    ("tactician",3, 1, 5), ("tactician",1, 3, 5),
    ("heavy_lean",7, 2, 0), ("heavy_lean",7, 0, 2),
    ("heavy_lean",2, 7, 0), ("heavy_lean",0, 7, 2),
    ("heavy_lean",2, 0, 7), ("heavy_lean",0, 2, 7),
    ("nuke",     9, 0, 0), ("nuke",     0, 9, 0), ("nuke",     0, 0, 9),
]

ARCHETYPE_COUNTS = {
    ("sentinel", 3, 3, 3): 18,
    ("scout",    4, 3, 2): 7, ("scout",    4, 2, 3): 7,
    ("scout",    3, 4, 2): 7, ("scout",    2, 4, 3): 7,
    ("scout",    3, 2, 4): 7, ("scout",    2, 3, 4): 7,
    ("tactician",5, 3, 1): 8, ("tactician",5, 1, 3): 8,
    ("tactician",3, 5, 1): 8, ("tactician",1, 5, 3): 8,
    ("tactician",3, 1, 5): 8, ("tactician",1, 3, 5): 8,
    ("heavy_lean",7, 2, 0): 5, ("heavy_lean",7, 0, 2): 5,
    ("heavy_lean",2, 7, 0): 5, ("heavy_lean",0, 7, 2): 5,
    ("heavy_lean",2, 0, 7): 5, ("heavy_lean",0, 2, 7): 5,
    ("nuke",     9, 0, 0): 4, ("nuke",     0, 9, 0): 4, ("nuke",     0, 0, 9): 4,
}


@dataclass
class Card:
    id: str
    archetype: str
    rock: int
    paper: int
    scissors: int
    seal: Optional[str] = None
    static_current_value: Optional[int] = None
    wild_assignment: Optional[dict] = None

    def primary_suite(self) -> str:
        vals = {"rock": self.rock, "paper": self.paper, "scissors": self.scissors}
        return max(vals, key=vals.get)

    def effective_points(self) -> tuple:
        if self.seal == "wild" and self.wild_assignment:
            wa = self.wild_assignment
            return wa["rock"], wa["paper"], wa["scissors"]
        return self.rock, self.paper, self.scissors

    def to_dict(self) -> dict:
        d = {
            "id": self.id,
            "archetype": self.archetype,
            "rock": self.rock,
            "paper": self.paper,
            "scissors": self.scissors,
            "seal": self.seal,
        }
        if self.static_current_value is not None:
            d["static_current_value"] = self.static_current_value
        if self.wild_assignment is not None:
            d["wild_assignment"] = self.wild_assignment
        return d


def build_deck() -> list[Card]:
    cards = []
    counters = {}
    for arch_key, count in ARCHETYPE_COUNTS.items():
        name, r, p, s = arch_key
        base = f"{name}_r{r}p{p}s{s}"
        counters[base] = counters.get(base, 0)
        for _ in range(count):
            counters[base] += 1
            card = Card(
                id=f"{base}_{counters[base]:03d}",
                archetype=name,
                rock=r, paper=p, scissors=s
            )
            cards.append(card)
    return cards


def assign_seals(deck: list[Card]) -> dict:
    """Assign seals to deck cards. Returns seal_counts dict."""
    seal_counts = {s: 0 for s in SEAL_TYPES}

    for card in deck:
        hits = []
        for seal, prob in SEAL_PROBS.items():
            if random.random() < prob:
                hits.append(seal)

        if not hits:
            continue

        if len(hits) == 1:
            chosen = hits[0]
        else:
            # Pick seal with lowest current count, random tiebreak
            min_count = min(seal_counts[s] for s in hits)
            candidates = [s for s in hits if seal_counts[s] == min_count]
            chosen = random.choice(candidates)

        # Sentinel cannot have resistance (it gets all-suite protection which is handled separately)
        # Actually per rules Sentinel CAN have resistance - it just protects all suites
        card.seal = chosen
        seal_counts[chosen] += 1

        if chosen == "static":
            card.static_current_value = STATIC_START

    return seal_counts


def draw_cards(deck: list[Card], n: int) -> list[Card]:
    drawn = deck[:n]
    del deck[:n]
    return drawn


def reshuffle(deck: list[Card], discard: list[Card]) -> None:
    deck.extend(discard)
    discard.clear()
    random.shuffle(deck)


# ─────────────────────────────────────────────
# GAME STATE
# ─────────────────────────────────────────────

@dataclass
class PlayerState:
    name: str
    hand: list[Card] = field(default_factory=list)
    held: list[Card] = field(default_factory=list)
    score: int = 0
    swap_pending: bool = False
    sweep_reward_pending: bool = False


# ─────────────────────────────────────────────
# LLM DECISION MAKING
# ─────────────────────────────────────────────

def format_hand_for_llm(player: PlayerState, opponent: PlayerState,
                         hand_num: int, total_hands: int,
                         is_final: bool) -> str:
    card_ids = [c.id for c in player.hand]
    example_ids = json.dumps(card_ids[:5])

    card_lines = []
    for c in player.hand:
        seal_info = ""
        if c.seal:
            if c.seal == "static":
                seal_info = f" STATIC({c.static_current_value}pts bonus)"
            elif c.seal == "resistance":
                suite = c.primary_suite() if c.archetype != "sentinel" else "ALL"
                seal_info = f" RESIST({suite},halves incoming)"
            elif c.seal == "wild":
                seal_info = " WILD(reassign 9pts to any suites)"
            elif c.seal == "tax":
                suite = c.primary_suite() if c.archetype != "sentinel" else "ALL"
                seal_info = f" TAX({suite},steals opponent tier bonus)"
            elif c.seal == "peek":
                seal_info = " PEEK(spy next hand)" if not is_final else " STATIC(30pts bonus)"
            elif c.seal == "swap":
                seal_info = " SWAP(draw extra next)" if not is_final else " STATIC(30pts bonus)"
        card_lines.append(f"{c.id}: R{c.rock} P{c.paper} S{c.scissors}{seal_info}")

    cards_str = "\n".join(card_lines)

    # Player personality
    if player.name == "player_a":
        style = "You prefer concentrating points in one suite when possible."
    else:
        style = "You prefer spreading points across all suites when possible."

    return f"""Pick exactly 5 cards to play. Return ONLY valid JSON, nothing else.

Format: {{"played": {example_ids}}}

You: {player.score}pts | Opponent: {opponent.score}pts | Hand {hand_num}/{total_hands}
R beats S, P beats R, S beats P. Higher total in a suite wins it. Win 2+ suites = sweep bonus.
{style}

Cards:
{cards_str}"""


def ask_llm(prompt: str, model: str) -> Optional[list[str]]:
    """Ask the LLM to select 5 cards. Returns list of 5 card IDs or None on failure."""
    url = f"{OLLAMA_URL}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.7}
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            text = resp.json().get("response", "")

            # Extract JSON from response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start == -1 or end == 0:
                print(f"    [LLM] No JSON found in response (attempt {attempt+1})")
                continue

            data = json.loads(text[start:end])
            played = data.get("played", [])

            if len(played) == 5 and all(isinstance(x, str) for x in played):
                return played
            else:
                print(f"    [LLM] Invalid selection (attempt {attempt+1}): {played}")

        except requests.exceptions.ConnectionError:
            print(f"\nERROR: Cannot connect to Ollama at {OLLAMA_URL}")
            print("Make sure Ollama is running: ollama serve")
            print("And your model is pulled: ollama pull {model}\n")
            sys.exit(1)
        except Exception as e:
            print(f"    [LLM] Error (attempt {attempt+1}): {e}")

    return None


def fallback_selection(hand: list[Card]) -> list[str]:
    """Random valid selection if LLM fails."""
    print("    [FALLBACK] Using random card selection")
    selected = random.sample(hand, min(5, len(hand)))
    return [c.id for c in selected]


def get_wild_assignment(card: Card, played: list[Card], model: str) -> dict:
    """Ask LLM how to assign Wild seal points. Falls back to random if needed."""
    # Show what suites the other played cards contribute so model can make informed choice
    other = [c for c in played if c.id != card.id]
    r = sum(c.rock for c in other)
    p = sum(c.paper for c in other)
    s = sum(c.scissors for c in other)
    prompt = (
        f'Your other cards total R{r} P{p} S{s}. Assign 9 wild points to boost suites. Total must equal 9.\n'
        f'Return ONLY JSON: {{"rock": 5, "paper": 2, "scissors": 2}}'
    )

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
                timeout=60
            )
            text = resp.json().get("response", "")
            start = text.find("{")
            end = text.rfind("}") + 1
            if start == -1:
                continue
            data = json.loads(text[start:end])
            r, p, s = data.get("rock", 3), data.get("paper", 3), data.get("scissors", 3)
            if r + p + s == 9 and all(isinstance(x, int) and x >= 0 for x in [r, p, s]):
                return {"rock": r, "paper": p, "scissors": s}
        except Exception:
            pass

    # Fallback: assign to primary suite
    suite = card.primary_suite()
    return {"rock": 9 if suite == "rock" else 0,
            "paper": 9 if suite == "paper" else 0,
            "scissors": 9 if suite == "scissors" else 0}


def get_peek_suite(player: PlayerState, model: str) -> str:
    """Ask LLM which suite to peek."""
    prompt = 'Pick a suite to peek at. Return ONLY JSON: {"suite": "rock"}'
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=60
        )
        text = resp.json().get("response", "")
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1:
            data = json.loads(text[start:end])
            suite = data.get("suite", "").lower()
            if suite in ["rock", "paper", "scissors"]:
                return suite
    except Exception:
        pass
    return random.choice(["rock", "paper", "scissors"])


def get_sweep_reward_card(hand: list[Card], model: str) -> str:
    """Ask LLM which card to apply the sweep reward seal to."""
    ids = [c.id for c in hand]
    prompt = f'Pick a card for your reward seal. Cards: {ids}\nReturn ONLY JSON: {{"card_id": "{ids[0]}"}}'
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=60
        )
        text = resp.json().get("response", "")
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1:
            data = json.loads(text[start:end])
            cid = data.get("card_id", "")
            if any(c.id == cid for c in hand):
                return cid
    except Exception:
        pass
    return random.choice(hand).id


def get_swap_selection(hand: list[Card], top5: list[Card], model: str) -> str:
    """Ask LLM which of the top 5 to take for swap."""
    top5_ids = [c.id for c in top5]
    top5_desc = ", ".join(f"{c.id}(R{c.rock}P{c.paper}S{c.scissors})" for c in top5)
    hand_r = sum(c.rock for c in hand)
    hand_p = sum(c.paper for c in hand)
    hand_s = sum(c.scissors for c in hand)
    prompt = f'Your hand totals R{hand_r} P{hand_p} S{hand_s}. Pick 1 card to add: {top5_desc}\nReturn ONLY JSON: {{"selected_id": "{top5_ids[0]}"}}'
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
                timeout=60
            )
            text = resp.json().get("response", "")
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1:
                data = json.loads(text[start:end])
                cid = data.get("selected_id", "")
                if any(c.id == cid for c in top5):
                    return cid
        except Exception:
            pass
    return top5[0].id


# ─────────────────────────────────────────────
# GAME MECHANICS
# ─────────────────────────────────────────────

def generate_sweep_reward_seal(seal_counts: dict) -> str:
    """Generate a reward seal using same probability distribution."""
    # Roll each seal type
    hits = []
    for seal, prob in SEAL_PROBS.items():
        if random.random() < prob:
            hits.append(seal)

    if not hits:
        # Use closest to threshold - just pick lowest count
        return min(seal_counts, key=seal_counts.get)

    if len(hits) == 1:
        return hits[0]

    min_count = min(seal_counts[s] for s in hits)
    candidates = [s for s in hits if seal_counts[s] == min_count]
    return random.choice(candidates)


def apply_last_round_conversions(player: PlayerState) -> list[dict]:
    """Convert Peek and Swap seals to Static(30) on final hand."""
    conversions = []
    for card in player.hand:
        if card.seal in ["peek", "swap"]:
            original = card.seal
            card.seal = "static"
            card.static_current_value = STATIC_START
            conversions.append({
                "player": player.name,
                "card_id": card.id,
                "original_seal": original,
                "converted_to": "static",
                "static_value": STATIC_START
            })
    return conversions


def check_duplicate_seals(player: PlayerState) -> list[dict]:
    """Convert duplicate seals to Static(30). Static and Wild are exempt."""
    exempt = {"static", "wild"}
    seal_map = {}
    for card in player.hand:
        if card.seal and card.seal not in exempt:
            seal_map.setdefault(card.seal, []).append(card)

    conversions = []
    for seal_type, cards in seal_map.items():
        if len(cards) > 1:
            # Keep first, convert rest to static
            for card in cards[1:]:
                original = card.seal
                card.seal = "static"
                card.static_current_value = STATIC_START
                conversions.append({
                    "player": player.name,
                    "card_id": card.id,
                    "original_seal": original,
                    "converted_to": "static",
                    "static_value": STATIC_START
                })
    return conversions


def resolve_subtraction(played_a: list[Card], played_b: list[Card],
                         resistance_effects: list[dict]) -> tuple[dict, dict]:
    """Calculate surviving totals after subtraction and resistance."""
    ar = sum(c.effective_points()[0] for c in played_a)
    ap = sum(c.effective_points()[1] for c in played_a)
    as_ = sum(c.effective_points()[2] for c in played_a)
    br = sum(c.effective_points()[0] for c in played_b)
    bp = sum(c.effective_points()[1] for c in played_b)
    bs = sum(c.effective_points()[2] for c in played_b)

    # Apply resistance effects
    # resistance_effects already computed - use incoming_damage_after values
    a_rock_counter = bp    # B paper attacks A rock
    a_paper_counter = bs   # B scissors attacks A paper
    a_scissors_counter = br  # B rock attacks A scissors
    b_rock_counter = ap    # A paper attacks B rock
    b_paper_counter = as_  # A scissors attacks B paper
    b_scissors_counter = ar  # A rock attacks B scissors

    for re in resistance_effects:
        player = re["player"]
        suite = re["suite_protected"]
        after = re["incoming_damage_after"]
        if player == "player_a":
            if suite == "rock": a_rock_counter = after
            elif suite == "paper": a_paper_counter = after
            elif suite == "scissors": a_scissors_counter = after
        else:
            if suite == "rock": b_rock_counter = after
            elif suite == "paper": b_paper_counter = after
            elif suite == "scissors": b_scissors_counter = after

    surv_a = {
        "rock": max(0, ar - a_rock_counter),
        "paper": max(0, ap - a_paper_counter),
        "scissors": max(0, as_ - a_scissors_counter),
    }
    surv_b = {
        "rock": max(0, br - b_rock_counter),
        "paper": max(0, bp - b_paper_counter),
        "scissors": max(0, bs - b_scissors_counter),
    }
    return surv_a, surv_b


def compute_resistance_effects(played_a: list[Card], played_b: list[Card]) -> list[dict]:
    """Compute resistance effects before subtraction."""
    effects = []
    all_played = [(c, "player_a") for c in played_a] + [(c, "player_b") for c in played_b]

    # Raw totals for before values
    ar = sum(c.effective_points()[0] for c in played_a)
    ap = sum(c.effective_points()[1] for c in played_a)
    as_ = sum(c.effective_points()[2] for c in played_a)
    br = sum(c.effective_points()[0] for c in played_b)
    bp = sum(c.effective_points()[1] for c in played_b)
    bs = sum(c.effective_points()[2] for c in played_b)

    for card, player in all_played:
        if card.seal != "resistance":
            continue

        is_sentinel = card.archetype == "sentinel"
        suites_to_protect = ["rock", "paper", "scissors"] if is_sentinel else [card.primary_suite()]

        for suite in suites_to_protect:
            if player == "player_a":
                if suite == "rock":
                    before, after = bp, bp // 2
                elif suite == "paper":
                    before, after = bs, bs // 2
                else:  # scissors
                    before, after = br, br // 2
            else:
                if suite == "rock":
                    before, after = ap, ap // 2
                elif suite == "paper":
                    before, after = as_, as_ // 2
                else:  # scissors
                    before, after = ar, ar // 2

            effects.append({
                "player": player,
                "card_id": card.id,
                "suite_protected": suite,
                "incoming_damage_before": before,
                "incoming_damage_after": after,
            })

    return effects


def compute_tax_resolution(played_a: list[Card], played_b: list[Card],
                            surv_a: dict, surv_b: dict,
                            suite_winners: dict) -> tuple[list[dict], dict, dict, int, int]:
    """Compute tax seal effects. Returns resolutions, adjusted surv dicts, and tax bonuses."""
    tax_bonus_a = 0
    tax_bonus_b = 0
    adj_surv_a = dict(surv_a)
    adj_surv_b = dict(surv_b)
    resolutions = []

    all_played = [(c, "player_a") for c in played_a] + [(c, "player_b") for c in played_b]

    for card, taxing_player in all_played:
        if card.seal != "tax":
            continue

        taxed_player = "player_b" if taxing_player == "player_a" else "player_a"
        taxed_surv = adj_surv_b if taxed_player == "player_b" else adj_surv_a
        suite = "all" if card.archetype == "sentinel" else card.primary_suite()

        suites_to_tax = ["rock", "paper", "scissors"] if suite == "all" else [suite]

        for s in suites_to_tax:
            surv_val = taxed_surv[s]
            winner = suite_winners[s]
            if winner != taxed_player:
                # Taxed player didn't win this suite, nothing to strip
                tiered = 0
                base = 0
                stripped = 0
            else:
                tiered = tiered_score(surv_val)
                base = surv_val * 10  # flat base rate
                stripped = tiered - base

            resolutions.append({
                "taxing_player": taxing_player,
                "taxed_player": taxed_player,
                "suite_taxed": s,
                "tiered_score_before_tax": tiered,
                "base_rate_score": base,
                "premium_stripped": stripped,
            })

            if taxing_player == "player_a":
                tax_bonus_a += stripped
            else:
                tax_bonus_b += stripped

    return resolutions, adj_surv_a, adj_surv_b, tax_bonus_a, tax_bonus_b


def score_hand(surv: dict, suite_winners: dict, player: str,
               played: list[Card], suite_sweep: bool, is_final: bool,
               tax_bonus: int, tax_resolutions: list[dict]) -> dict:
    """Compute full scoring for one player for one hand."""
    scores = {"rock": 0, "paper": 0, "scissors": 0}

    for suite in ["rock", "paper", "scissors"]:
        if suite_winners[suite] == player:
            surv_val = surv[suite]
            # Check if this suite was taxed
            base_rate = False
            for t in tax_resolutions:
                if t["taxed_player"] == player and t["suite_taxed"] == suite:
                    scores[suite] = t["base_rate_score"]
                    base_rate = True
                    break
            if not base_rate:
                scores[suite] = tiered_score(surv_val)

    # Static cards
    static_cards = []
    for card in played:
        if card.seal == "static" and card.static_current_value is not None:
            base = card.static_current_value
            doubled = suite_sweep
            final = base * 2 if doubled else base
            static_cards.append({
                "card_id": card.id,
                "static_value_before_doubling": base,
                "doubled": doubled,
                "final_static_score": final,
            })

    static_total = sum(s["final_static_score"] for s in static_cards)
    sweep_bonus = (SWEEP_BONUS_FINAL if is_final else SWEEP_BONUS_NORMAL) if suite_sweep else 0

    round_total = scores["rock"] + scores["paper"] + scores["scissors"] + static_total + tax_bonus + sweep_bonus

    return {
        "rock": scores["rock"],
        "paper": scores["paper"],
        "scissors": scores["scissors"],
        "static_cards": static_cards,
        "tax_bonus": tax_bonus,
        "suite_sweep_bonus": sweep_bonus,
        "round_total": round_total,
    }


def age_static_cards(player: PlayerState) -> None:
    """Age all held static cards by 10, capped at STATIC_CAP."""
    for card in player.held:
        if card.seal == "static" and card.static_current_value is not None:
            card.static_current_value = min(STATIC_CAP, card.static_current_value + STATIC_INCREMENT)


# ─────────────────────────────────────────────
# MAIN SIMULATION LOOP
# ─────────────────────────────────────────────

def simulate_round(round_num: int, num_hands: int, model: str,
                   deck: list[Card], discard: list[Card],
                   seal_counts: dict) -> dict:
    """Simulate one full round (game) of N hands."""

    player_a = PlayerState("player_a")
    player_b = PlayerState("player_b")

    hands_output = []
    pending_peek = {}  # {player_name: suite_to_reveal}

    print(f"\n{'='*50}")
    print(f"ROUND {round_num}")
    print(f"{'='*50}")

    # Deal initial hands
    if len(deck) < 14:
        reshuffle(deck, discard)
    player_a.hand = draw_cards(deck, 7)
    player_b.hand = draw_cards(deck, 7)

    for hand_num in range(1, num_hands + 1):
        is_final = (hand_num == num_hands)
        print(f"\n  Hand {hand_num}/{num_hands}{'  [FINAL]' if is_final else ''}")

        hand_data = {
            "hand": hand_num,
            "is_final_hand": is_final,
            "last_hand_conversions": [],
            "duplicate_seal_conversions": [],
            "suite_sweep_reward": [],
            "played": {"player_a": [], "player_b": []},
            "held": {"player_a": [], "player_b": []},
            "swap_resolution": [],
            "raw_totals": {},
            "resistance_effects": [],
            "surviving_totals": {},
            "suite_winners": {},
            "tax_resolution": [],
            "scoring": {},
            "running_total": {},
            "suite_sweep": {"player_a": False, "player_b": False},
            "peek_resolutions": [],
        }

        # ── Swap resolution from previous hand ──
        for player in [player_a, player_b]:
            if player.swap_pending:
                player.swap_pending = False
                if len(deck) < 5:
                    reshuffle(deck, discard)
                top5 = draw_cards(deck, 5)
                selected_id = get_swap_selection(player.hand, top5, model)
                selected_card = next((c for c in top5 if c.id == selected_id), top5[0])
                returned = [c for c in top5 if c.id != selected_id]
                deck.extend(returned)
                player.hand.append(selected_card)
                hand_data["swap_resolution"].append({
                    "player": player.name,
                    "drew_six": True,
                    "top_five_revealed": [c.to_dict() for c in top5],
                    "card_selected_id": selected_id,
                    "cards_returned_to_bottom": [c.to_dict() for c in returned],
                })

        # ── Suite Sweep reward from previous hand ──
        for player in [player_a, player_b]:
            if player.sweep_reward_pending:
                player.sweep_reward_pending = False
                seal_type = generate_sweep_reward_seal(seal_counts)
                target_id = get_sweep_reward_card(player.hand, model)
                target_card = next((c for c in player.hand if c.id == target_id), None)
                if target_card:
                    target_card.seal = seal_type
                    seal_counts[seal_type] = seal_counts.get(seal_type, 0) + 1
                    if seal_type == "static":
                        target_card.static_current_value = STATIC_START
                    hand_data["suite_sweep_reward"].append({
                        "player": player.name,
                        "seal_awarded": seal_type,
                        "applied_to_card_id": target_id,
                    })

        # ── Last round conversions ──
        if is_final:
            for player in [player_a, player_b]:
                conversions = apply_last_round_conversions(player)
                hand_data["last_hand_conversions"].extend(conversions)

        # ── Duplicate seal check ──
        for player in [player_a, player_b]:
            conversions = check_duplicate_seals(player)
            hand_data["duplicate_seal_conversions"].extend(conversions)

        # ── Peek resolution from previous hand ──
        for player_name, suite in list(pending_peek.items()):
            opp = player_b if player_name == "player_a" else player_a
            opp_total = sum(
                c.effective_points()[["rock","paper","scissors"].index(suite)]
                for c in opp.hand
            )
            hand_data["peek_resolutions"].append({
                "player": player_name,
                "suite_peeked": suite,
                "opponent_total_in_suite_next_hand": opp_total,
            })
        pending_peek.clear()

        # ── LLM card selection ──
        played_cards = {}
        held_cards = {}
        peek_played = {}

        for player, opp in [(player_a, player_b), (player_b, player_a)]:
            prompt = format_hand_for_llm(player, opp, hand_num, num_hands, is_final)
            selected_ids = ask_llm(prompt, model)

            if selected_ids is None:
                selected_ids = fallback_selection(player.hand)

            # Validate selection
            hand_ids = {c.id for c in player.hand}
            valid_ids = [cid for cid in selected_ids if cid in hand_ids]

            # Deduplicate
            seen = set()
            unique_valid = []
            for cid in valid_ids:
                if cid not in seen:
                    seen.add(cid)
                    unique_valid.append(cid)
            valid_ids = unique_valid

            # Fill if not enough valid
            if len(valid_ids) < 5:
                remaining = [c.id for c in player.hand if c.id not in seen]
                random.shuffle(remaining)
                valid_ids.extend(remaining[:5 - len(valid_ids)])
            valid_ids = valid_ids[:5]

            played = [c for c in player.hand if c.id in valid_ids]
            held = [c for c in player.hand if c.id not in valid_ids]

            # Handle Wild seal assignments
            for card in played:
                if card.seal == "wild" and card.wild_assignment is None:
                    card.wild_assignment = get_wild_assignment(card, played, model)

            # Track Peek seal
            for card in played:
                if card.seal == "peek":
                    peek_played[player.name] = card

            played_cards[player.name] = played
            held_cards[player.name] = held
            player.held = held
            player.hand = held

        # ── Compute raw totals ──
        for pname, played in played_cards.items():
            hand_data["raw_totals"][pname] = {
                "rock": sum(c.effective_points()[0] for c in played),
                "paper": sum(c.effective_points()[1] for c in played),
                "scissors": sum(c.effective_points()[2] for c in played),
            }

        # ── Resistance effects ──
        resistance_effects = compute_resistance_effects(
            played_cards["player_a"], played_cards["player_b"]
        )
        hand_data["resistance_effects"] = resistance_effects

        # ── Subtraction ──
        surv_a, surv_b = resolve_subtraction(
            played_cards["player_a"], played_cards["player_b"], resistance_effects
        )
        hand_data["surviving_totals"] = {"player_a": surv_a, "player_b": surv_b}

        # ── Suite winners ──
        suite_winners = {}
        for suite in ["rock", "paper", "scissors"]:
            av, bv = surv_a[suite], surv_b[suite]
            if av > bv:
                suite_winners[suite] = "player_a"
            elif bv > av:
                suite_winners[suite] = "player_b"
            else:
                suite_winners[suite] = "tie"
        hand_data["suite_winners"] = suite_winners

        # ── Suite sweep ──
        for pname in ["player_a", "player_b"]:
            wins = sum(1 for v in suite_winners.values() if v == pname)
            hand_data["suite_sweep"][pname] = wins >= 2

        # ── Tax resolution ──
        tax_res, surv_a, surv_b, tax_a, tax_b = compute_tax_resolution(
            played_cards["player_a"], played_cards["player_b"],
            surv_a, surv_b, suite_winners
        )
        hand_data["tax_resolution"] = tax_res

        # ── Scoring ──
        scoring_a = score_hand(surv_a, suite_winners, "player_a",
                                played_cards["player_a"],
                                hand_data["suite_sweep"]["player_a"],
                                is_final, tax_a, tax_res)
        scoring_b = score_hand(surv_b, suite_winners, "player_b",
                                played_cards["player_b"],
                                hand_data["suite_sweep"]["player_b"],
                                is_final, tax_b, tax_res)
        hand_data["scoring"] = {"player_a": scoring_a, "player_b": scoring_b}

        player_a.score += scoring_a["round_total"]
        player_b.score += scoring_b["round_total"]

        hand_data["running_total"] = {
            "player_a": player_a.score,
            "player_b": player_b.score,
        }

        # ── Played / held output ──
        hand_data["played"]["player_a"] = [c.to_dict() for c in played_cards["player_a"]]
        hand_data["played"]["player_b"] = [c.to_dict() for c in played_cards["player_b"]]
        hand_data["held"]["player_a"] = [c.to_dict() for c in held_cards["player_a"]]
        hand_data["held"]["player_b"] = [c.to_dict() for c in held_cards["player_b"]]

        # ── Discard played cards ──
        discard.extend(played_cards["player_a"])
        discard.extend(played_cards["player_b"])

        # ── Suite sweep pending reward ──
        for pname in ["player_a", "player_b"]:
            player = player_a if pname == "player_a" else player_b
            if hand_data["suite_sweep"][pname] and not is_final:
                player.sweep_reward_pending = True

        # ── Peek pending ──
        for pname, card in peek_played.items():
            if not is_final:
                opp = player_b if pname == "player_a" else player_a
                suite = get_peek_suite(player_a if pname == "player_a" else player_b, model)
                pending_peek[pname] = suite

        # ── Swap pending ──
        for pname, played in played_cards.items():
            player = player_a if pname == "player_a" else player_b
            for card in played:
                if card.seal == "swap" and not is_final:
                    player.swap_pending = True
                    # Draw only 6 next hand
                    break

        # ── Age static cards ──
        age_static_cards(player_a)
        age_static_cards(player_b)

        # ── Draw replacement cards for next hand ──
        if not is_final:
            for player in [player_a, player_b]:
                needed = 7 - len(player.hand)
                if player.swap_pending:
                    needed -= 1  # Will draw 6 not 7 next hand
                if needed > 0:
                    if len(deck) < needed:
                        reshuffle(deck, discard)
                    player.hand.extend(draw_cards(deck, needed))

        hands_output.append(hand_data)

        print(f"    Score -> A: {player_a.score}  B: {player_b.score}")

    winner = "player_a" if player_a.score > player_b.score else (
        "player_b" if player_b.score > player_a.score else "tie"
    )
    print(f"\n  ROUND {round_num} RESULT: A={player_a.score} B={player_b.score} Winner={winner}")

    return {
        "round": round_num,
        "hands": hands_output,
        "round_summary": {
            "running_total": {
                "player_a": player_a.score,
                "player_b": player_b.score,
            },
            "winner": winner,
        }
    }


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Suite Game Simulator — one round per run")
    parser.add_argument("--round", type=int, default=1, help="Round number (for filename)")
    parser.add_argument("--hands", type=int, default=5, help="Hands per round")
    parser.add_argument("--model", type=str, default="deepseek-r1:7b",
                        help="Ollama model name (e.g. llama3.1:8b, deepseek-r1:7b)")
    parser.add_argument("--output", type=str, default=None,
                        help="Output JSON file (default: round_<N>.json)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    output_file = args.output or f"round_{args.round}.json"

    print(f"Suite Game Simulator")
    print(f"Model: {args.model}")
    print(f"Round: {args.round}  Hands: {args.hands}")
    print(f"Output: {output_file}")

    # Fresh deck for this round — rounds are fully isolated
    deck = build_deck()
    random.shuffle(deck)
    seal_counts = assign_seals(deck)
    discard = []

    total_sealed = sum(1 for c in deck if c.seal is not None)
    print(f"\nDeck: {len(deck)} cards, {total_sealed} sealed")
    print(f"Seals: {seal_counts}")

    round_data = simulate_round(
        args.round, args.hands, args.model,
        deck, discard, seal_counts
    )

    # Build output with schema-correct key ordering
    output = {
        "round": round_data["round"],
        "deck_initialization": {
            "total_sealed_cards": total_sealed,
            "seal_counts": seal_counts,
        },
        "hands": round_data["hands"],
        "round_summary": round_data["round_summary"],
    }

    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults written to {output_file}")


if __name__ == "__main__":
    main()
