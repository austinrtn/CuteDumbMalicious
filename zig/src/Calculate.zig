const std = @import("std");
const lib = @import("CuteDumbMalicious");
const Card = lib.Card;
const Seal = lib.Seal;
const Suit = lib.Suit;
const SubmitHand = lib.SubmitHand;
const SuitFlags = lib.SuitFlags;

const Points = struct {
    cute: f32 = 0,
    dumb: f32 = 0,
    malicous: f32 = 0,

    collected_taxes: struct{
        cute: f32 = 0, 
        dumb: f32 = 0,
        mal: f32 = 0,
    } = .{},

    owes_tax: SuitFlags = .{},

    //seals
    res_flags: SuitFlags = .{},
    tax_flags: SuitFlags = .{},
    booster_flags: SuitFlags = .{},
    peek_flags: SuitFlags = .{},

    static: f32 = 0,
    suit_wins: i32 = 0,
    total: f32 = 0,

    played_peek: bool = false,
    played_swap: bool = false,

    player: []const u8 = "",
    events: *std.ArrayList(lib.NewEvent) = undefined,
    allocator: std.mem.Allocator = undefined,
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    defer _ = gpa.deinit();

    var events: std.ArrayList(lib.NewEvent) = .{};
    defer events.deinit(allocator);

    var args = std.process.args();
    defer args.deinit();
    _ = args.next();

    const first_arg = args.next();
    const debug = if (first_arg) |arg| std.mem.eql(u8, arg, "debug") else false;

    const contents = if (debug) blk: {
        const file_path = args.next() orelse @panic("Missing file argument\n");
        break :blk try std.fs.cwd().readFileAlloc(allocator, file_path, 1024 * 1024);
    } else blk: {
        break :blk try std.fs.File.stdin().readToEndAlloc(allocator, 1024 * 1024);
    };
    defer allocator.free(contents);

    const parsed = try std.json.parseFromSlice([]SubmitHand, allocator, contents, .{});
    defer parsed.deinit();
    const hands = parsed.value;

    var p1: SubmitHand = hands[0];
    var p2: SubmitHand = hands[1];
    if (debug) { printHand(p1); printHand(p2); }

    var p1_points = Points{ .player = p1.player, .events = &events, .allocator = allocator };
    var p2_points = Points{ .player = p2.player, .events = &events, .allocator = allocator };
    getSubmittedPoints(allocator, &p1.cards, &p1_points);
    getSubmittedPoints(allocator, &p2.cards, &p2_points);

    setOwesTaxFlag(&p1_points, p2_points);
    setOwesTaxFlag(&p2_points, p1_points);
    if (debug) printPoints("Submitted", p1_points, p2_points);

    applyInvestmentMult(&p1_points);
    applyInvestmentMult(&p2_points);

    applyTaxes(&p1_points, p2_points);
    applyTaxes(&p2_points, p1_points);

    const p1_orig = p1_points;
    const p2_orig = p2_points;
    getSurvingPoints(&p1_points, p2_orig);
    getSurvingPoints(&p2_points, p1_orig);

    giveWinningSuitPoints(&p1_points, &p2_points);

    p1_points.static += calcStaticPoints(&p1.cards);
    p2_points.static += calcStaticPoints(&p2.cards);

    getSuitWonPoints(&p1_points);
    getSuitWonPoints(&p2_points);

    const p1_static_mult: f32 = if(p1_points.suit_wins >= 2) 2 else 1;
    const p2_static_mult: f32 = if(p2_points.suit_wins >= 2) 2 else 1;

    p1_points.total += p1_points.static * p1_static_mult;
    p2_points.total += p2_points.static * p2_static_mult;

    if (debug) printPoints("Final", p1_points, p2_points);

    // Output match results and events as JSON to stdout
    const result = lib.SubmittedHandsResult {
        .p1 = .{
            .player = p1.player,
            .cute = p1_points.cute,
            .dumb = p1_points.dumb,
            .malicous = p1_points.malicous,
            .static_pts = p1_points.static,
            .suit_wins = p1_points.suit_wins,
            .played_swap = p1_points.played_swap,
            .played_peek = p1_points.played_peek,
            .peek_flags = p1_points.peek_flags,
            .total = p1_points.total,
        },
        .p2 = .{
            .player = p2.player,
            .cute = p2_points.cute,
            .dumb = p2_points.dumb,
            .malicous = p2_points.malicous,
            .static_pts = p2_points.static,
            .suit_wins = p2_points.suit_wins,
            .played_swap = p2_points.played_swap,
            .played_peek = p2_points.played_peek,
            .peek_flags = p1_points.peek_flags,
            .total = p2_points.total,
        },
        .events = events.items,
    };

    const json_output = try std.json.Stringify.valueAlloc(allocator, result, .{});
    defer allocator.free(json_output);
    var stdout = std.fs.File.stdout().writerStreaming(&.{});
    try stdout.interface.writeAll(json_output);
}

fn getSuitWonPoints(points: *Points) void {
    if(points.suit_wins == 2) points.total += 3;
    if(points.suit_wins == 3) points.total += 5;
}

fn giveWinningSuitPoints(player_A: *Points, player_B: *Points) void {
    // Give cute points to cute winner
    if(player_A.cute > player_B.cute) { player_A.total += player_A.cute; player_A.suit_wins += 1; }
    if(player_B.cute > player_A.cute) { player_B.total += player_B.cute; player_B.suit_wins += 1; }

    // Give dumb points to dumb winner
    if(player_A.dumb > player_B.dumb) { player_A.total += player_A.dumb; player_A.suit_wins += 1; }
    if(player_B.dumb > player_A.dumb) { player_B.total += player_B.dumb; player_B.suit_wins += 1; }

    // Give malicous points to malicous winner
    if(player_A.malicous > player_B.malicous) { player_A.total += player_A.malicous; player_A.suit_wins += 1; }
    if(player_B.malicous > player_A.malicous) { player_B.total += player_B.malicous; player_B.suit_wins += 1; }
}

fn calcStaticPoints(cards: []const Card) f32 {
    var points: f32 = 0;
    for(cards) |card| {
        if(card.seal == .STATIC) points += card.static_val;
    }
    return points;
}

fn getSurvingPoints(player_A: *Points, player_B: Points) void {
    const player_b_cute: f32 = if (player_A.res_flags.cute) player_B.cute * 0.25 else player_B.cute;
    const player_b_dumb: f32 = if (player_A.res_flags.dumb) player_B.dumb * 0.25 else player_B.dumb;
    const player_b_malicous: f32 = if (player_A.res_flags.mal) player_B.malicous * 0.25 else player_B.malicous;

    player_A.cute = @max(player_A.cute - player_b_dumb, 0);
    player_A.dumb = @max(player_A.dumb - player_b_malicous, 0);
    player_A.malicous = @max(player_A.malicous - player_b_cute, 0);
}

fn applyTaxes(player_A: *Points, player_B: Points) void {
    player_A.cute += player_B.collected_taxes.cute;
    player_A.dumb += player_B.collected_taxes.dumb;
    player_A.malicous += player_B.collected_taxes.mal;
}

fn applyInvestmentMult(points: *Points) void {
    const thresh = 3;
    const TIER_STEP: f32 = 0.5;
    const MULT: f32 = 1.0;
    const booster_mult = 1.5;

    const cute_step: f32 = if(points.booster_flags.cute) (TIER_STEP * booster_mult) else TIER_STEP;
    const dumb_step: f32 = if(points.booster_flags.dumb) (TIER_STEP * booster_mult) else TIER_STEP;
    const mal_step: f32 = if(points.booster_flags.mal) (TIER_STEP * booster_mult) else TIER_STEP;

    const cute_mult: f32 = if(points.booster_flags.cute) (MULT + cute_step) else MULT;
    const dumb_mult: f32 = if(points.booster_flags.dumb) (MULT + dumb_step) else MULT;
    const mal_mult: f32 = if(points.booster_flags.mal) (MULT + mal_step) else MULT;

    const calc = struct {
        fn func(pts: *f32, multiplier: f32, taxed: bool, threshold: usize, increment: f32) f32 {
            var new_points: f32 = 0;
            var taxed_points: f32 = 0;
            var mult = multiplier;

            // Iterate for each surving point
            for(0..@as(usize, @intFromFloat(pts.*))) |i| {
                // Either accumulate tiered points or taxed points if suit is taxed
                if(!taxed) {
                    new_points += mult;
                }
                else {
                    // Give taxed player the raw points while collecting tiered pts for
                    // the player that taxed them
                    new_points += 1;
                    taxed_points += mult;
                }

                // Increase increment for every 3 points
                if(@mod(i + 1, threshold) == 0) {
                    mult += increment;
                }
            }
            pts.* = new_points;
            return taxed_points;
        }
    };

    points.collected_taxes.cute += calc.func(&points.cute, cute_mult, points.owes_tax.cute, thresh, cute_step);
    points.collected_taxes.dumb += calc.func(&points.dumb, dumb_mult, points.owes_tax.dumb, thresh, dumb_step);
    points.collected_taxes.mal += calc.func(&points.malicous, mal_mult, points.owes_tax.mal, thresh, mal_step);
}

fn applyResSeal(card: *Card, points: *Points) void {
    if(card.seal == .RESISTANCE) {
        if(card.is_sentinel and !points.res_flags.played_sentinel) {
            points.res_flags.cute = true;
            points.res_flags.dumb = true;
            points.res_flags.mal = true;
            points.res_flags.played_sentinel = true;
            for ([_]Suit{ .CUTE, .DUMB, .MALICOUS }) |s| {
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = s }) catch {};
            }
        }
        else if(card.is_sentinel and points.res_flags.played_sentinel) {
            card.seal = .STATIC;
            for ([_]Suit{ .CUTE, .DUMB, .MALICOUS }) |s| {
                points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = s }) catch {};
            }
        }
        else if(card.primary.suit == .CUTE) {
            if(points.res_flags.cute) {
                card.seal = .STATIC;
                points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = .CUTE }) catch {};
            } else {
                points.res_flags.cute = true;
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = .CUTE }) catch {};
            }
        }

        else if(card.primary.suit == .DUMB) {
            if(points.res_flags.dumb) {
                card.seal = .STATIC;
                points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = .DUMB }) catch {};
            } else {
                points.res_flags.dumb = true;
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = .DUMB }) catch {};
            }
        }

        else if(card.primary.suit == .MALICOUS) {
            if(points.res_flags.mal) {
                card.seal = .STATIC;
                points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = .MALICOUS }) catch {};
            } else {
                points.res_flags.mal = true;
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = .MALICOUS }) catch {};
            }
        }
    }
}

fn setOwesTaxFlag(player_A: *Points, player_B: Points) void {
    if(player_B.tax_flags.cute) player_A.owes_tax.cute = true;
    if(player_B.tax_flags.dumb) player_A.owes_tax.dumb = true;
    if(player_B.tax_flags.mal) player_A.owes_tax.mal = true;
}

fn applyTaxSeal(card: *Card, points: *Points) void {
    if(card.is_sentinel and !points.tax_flags.played_sentinel) {
        points.tax_flags.cute = true;
        points.tax_flags.dumb = true;
        points.tax_flags.mal = true;
        points.tax_flags.played_sentinel = true;
        for ([_]Suit{ .CUTE, .DUMB, .MALICOUS }) |s| {
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = s }) catch {};
        }
        return;
    }
    else if(card.is_sentinel and points.tax_flags.played_sentinel) {
        card.seal = .STATIC;
        for ([_]Suit{ .CUTE, .DUMB, .MALICOUS }) |s| {
            points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = s }) catch {};
        }
        return;
    }
    else if(card.primary.suit == .CUTE) {
        if(points.tax_flags.cute) {
            card.seal = .STATIC;
            points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = .CUTE }) catch {};
        } else {
            points.tax_flags.cute = true;
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = .CUTE }) catch {};
        }
    }

    else if(card.primary.suit == .DUMB) {
        if(points.tax_flags.dumb) {
            card.seal = .STATIC;
            points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = .DUMB }) catch {};
        } else {
            points.tax_flags.dumb = true;
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = .DUMB }) catch {};
        }
    }

    else if(card.primary.suit == .MALICOUS) {
        if(points.tax_flags.mal) {
            card.seal = .STATIC;
            points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 3, .suit = .MALICOUS }) catch {};
        } else {
            points.tax_flags.mal = true;
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = .MALICOUS }) catch {};
        }
    }
}


fn applyPeekSeal(card: *Card, points: *Points) void {
    var convert_static = false;
    if(card.is_sentinel and !points.peek_flags.played_sentinel) {
        points.peek_flags.cute = true;
        points.peek_flags.dumb = true;
        points.peek_flags.mal = true;
        points.peek_flags.played_sentinel = true;
        points.played_peek = true;
    }
    // Will implement that a static seal with extra pts instead of just 3 conversion
    else if(card.is_sentinel and points.peek_flags.played_sentinel) { convert_static = true; }
    else if(!card.is_sentinel) switch(card.primary.suit) {
        .CUTE => if(points.peek_flags.cute) { convert_static = true; } else { points.peek_flags.cute = true; points.played_peek = true; },
        .DUMB => if(points.peek_flags.dumb) { convert_static = true; } else { points.peek_flags.dumb = true; points.played_peek = true; },
        .MALICOUS => if(points.peek_flags.mal) { convert_static = true; } else { points.peek_flags.mal = true; points.played_peek = true; },
    };
    if(convert_static and card.is_sentinel) {
        card.seal = .STATIC;
        card.static_val = 10;
    } else if(convert_static) {
        card.seal = .STATIC;
    }
}

fn applyBoosterSeal(card: *Card, points: *Points) void {
    var convert_static = false;
    if(card.is_sentinel and !points.booster_flags.played_sentinel) {
        points.booster_flags.cute = true;
        points.booster_flags.dumb = true;
        points.booster_flags.mal = true;
        points.booster_flags.played_sentinel = true;
    }
    // Will implement that a static seal with extra pts instead of just 3 conversion
    else if(card.is_sentinel and points.booster_flags.played_sentinel) { convert_static = true; }
    else if(!card.is_sentinel) switch(card.primary.suit) {
        .CUTE => if(points.booster_flags.cute) { convert_static = true; } else { points.booster_flags.cute = true; },
        .DUMB => if(points.booster_flags.dumb) { convert_static = true; } else { points.booster_flags.dumb = true; },
        .MALICOUS => if(points.booster_flags.mal) { convert_static = true; } else { points.booster_flags.mal = true; },
    };
    if(convert_static and card.is_sentinel) {
        card.seal = .STATIC;
        card.static_val = 10;
    } else if(convert_static) {
        card.seal = .STATIC;
    }
}

fn applySwapSeal(card: *Card, points: *Points) void {
    if(points.played_swap) card.seal = .STATIC else points.played_swap = true;
}

fn getSubmittedPoints(allocator: std.mem.Allocator, cards: []Card, points: *Points) void {
    var sealed_cards = std.ArrayList(*Card){};
    defer sealed_cards.deinit(allocator);

    for(cards) |*card|  if(card.seal != .NONE) {
        if(card.is_sentinel) { sealed_cards.insert(allocator, 0, card) catch {}; }
        else sealed_cards.append(allocator, card) catch {}; 
    };

    for(sealed_cards.items) |card|  switch(card.seal) {
        .RESISTANCE => applyResSeal(card, points),
        .TAX => applyTaxSeal(card, points),
        .PEEK => applyPeekSeal(card, points),
        .BOOSTER => applyBoosterSeal(card, points),
        .SWAP => applySwapSeal(card, points),
        else => {},
    };

    for(cards) |card| {
        points.cute += getPointsFromCard(card, .CUTE);
        points.dumb += getPointsFromCard(card, .DUMB);
        points.malicous += getPointsFromCard(card, .MALICOUS);
    }
}

fn getPointsFromCard(card: Card, suit: Suit) f32{
    if(card.primary.suit == suit) return @floatFromInt(card.primary.val)
    else if(card.secondary.suit == suit) return @floatFromInt(card.secondary.val)
    else if(card.tertiary.suit == suit) return @floatFromInt(card.tertiary.val)
    else unreachable;
}

fn printPoints(label: []const u8, p1: Points, p2: Points) void {
    std.debug.print("\n  === {s} ===\n", .{label});
    std.debug.print("  {s:<8} | {s:>6} | {s:>6} | {s:>6} | {s:>6} | {s:>6} | {s:>6}\n", .{
        "", "Cute", "Dumb", "Mal", "Static", "Wins", "Total",
    });
    std.debug.print("  {s:-<8}-+-{s:-<6}-+-{s:-<6}-+-{s:-<6}-+-{s:-<6}-+-{s:-<6}-+-{s:-<6}\n", .{
        "", "", "", "", "", "", "",
    });
    std.debug.print("  {s:<8} | {d:>6.1} | {d:>6.1} | {d:>6.1} | {d:>6.1} | {d:>6} | {d:>6.1}\n", .{
        "Player 1", p1.cute, p1.dumb, p1.malicous, p1.static, p1.suit_wins, p1.total,
    });
    std.debug.print("  {s:<8} | {d:>6.1} | {d:>6.1} | {d:>6.1} | {d:>6.1} | {d:>6} | {d:>6.1}\n", .{
        "Player 2", p2.cute, p2.dumb, p2.malicous, p2.static, p2.suit_wins, p2.total,
    });
}

fn printCard(i: usize, card: Card) void {
    std.debug.print("  {d:<6} | {s:<10} | {s:<5} | {d:>2} {s:<9} | {d:>2} {s:<9} | {d:>2} {s:<9}\n", .{
        i + 1,
        @tagName(card.seal),
        if (card.is_sentinel) "yes" else "no",
            card.primary.val,
            @tagName(card.primary.suit),
            card.secondary.val,
            @tagName(card.secondary.suit),
            card.tertiary.val,
            @tagName(card.tertiary.suit),
    });
}

fn printHand(hand: SubmitHand) void {
    std.debug.print("\n  === {s} ===\n", .{hand.player});
    std.debug.print("  {s:<6} | {s:<10} | {s:<5} | {s:<12} | {s:<12} | {s:<12}\n", .{
        "Card", "Seal", "Sent.", "Primary", "Secondary", "Tertiary",
    });
    std.debug.print("  {s:-<6}-+-{s:-<10}-+-{s:-<5}-+-{s:-<12}-+-{s:-<12}-+-{s:-<12}\n", .{
        "", "", "", "", "", "",
    });
    for (hand.cards, 0..) |card, i| {
        printCard(i, card);
    }
}
