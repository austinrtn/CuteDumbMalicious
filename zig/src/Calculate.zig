const std = @import("std");
const lib = @import("CuteDumbMalicious");
const Card = lib.Card;
const Seal = lib.Seal;
const Suit = lib.Suit;
const SubmitHand = lib.SubmitHand;

const SuitFlags = struct {
    cute: bool = false,
    dumb: bool = false,
    mal: bool = false,
};

const Points = struct{
    cute: i32 = 0,
    dumb: i32 = 0,
    malicous: i32 = 0,

    res: SuitFlags = .{},
    tax: SuitFlags = .{},
    owes_tax: SuitFlags = .{},

    collected_taxes: struct {
        cute: i32 = 0,
        dumb: i32 = 0,
        mal: i32 = 0,
    } = .{},

    static: i32 = 0,
    suit_wins: i32 = 0,
    total: i32 = 0,

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

    const first_arg = args.next() orelse @panic("Missing argument\n");
    const debug = std.mem.eql(u8, first_arg, "debug");
    const file_path = if (debug) args.next() orelse @panic("Missing file argument\n") else first_arg;

    const contents = try std.fs.cwd().readFileAlloc(allocator, file_path, 1024 * 1024);
    defer allocator.free(contents);

    const parsed = try std.json.parseFromSlice([]SubmitHand, allocator, contents, .{});
    defer parsed.deinit();
    const hands = parsed.value;

    var p1: SubmitHand = hands[0];
    var p2: SubmitHand = hands[1];
    if (debug) { printHand(p1); printHand(p2); }

    var p1_points = Points{ .player = p1.player, .events = &events, .allocator = allocator };
    var p2_points = Points{ .player = p2.player, .events = &events, .allocator = allocator };
    getSubmittedPoints(&p1.cards, &p1_points);
    getSubmittedPoints(&p2.cards, &p2_points);

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

    const p1_static_mult: i32 = if(p1_points.suit_wins >= 2) 2 else 1;
    const p2_static_mult: i32 = if(p2_points.suit_wins >= 2) 2 else 1;

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
            .total = p1_points.total,
        },
        .p2 = .{
            .player = p2.player,
            .cute = p2_points.cute,
            .dumb = p2_points.dumb,
            .malicous = p2_points.malicous,
            .static_pts = p2_points.static,
            .suit_wins = p2_points.suit_wins,
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
    if(points.suit_wins == 2) points.total += 30;
    if(points.suit_wins == 3) points.total += 50;
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

fn calcStaticPoints(cards: []const Card) i32 {
    var points: i32 = 0;
    for(cards) |card| {
        if(card.seal == .STATIC) points += 30;
    }
    return points;
}

fn getSurvingPoints(player_A: *Points, player_B: Points) void {
    const player_b_cute: i32 = if (player_A.res.cute) player_B.cute - @divTrunc(player_B.cute * 3, 4) else player_B.cute;
    const player_b_dumb: i32 = if (player_A.res.dumb) player_B.dumb - @divTrunc(player_B.dumb * 3, 4) else player_B.dumb;
    const player_b_malicous: i32 = if (player_A.res.mal) player_B.malicous - @divTrunc(player_B.malicous * 3, 4) else player_B.malicous;

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
    const incr = 1.5;

    const calc = struct {
        fn func(pts: *i32, taxed: bool, threshold: usize, increment: f32) i32 {
            var new_points: f32 = 0;
            var taxed_points: f32 = 0;
            var mult: f32 = 1;    
            for(0..@as(usize, @intCast(pts.*))) |i| {
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
            taxed_points *= 10;
            new_points *= 10;
            pts.* =  @as(i32, @intFromFloat(new_points));
            return @intFromFloat(taxed_points);
        }
    };

    points.collected_taxes.cute += calc.func(&points.cute, points.owes_tax.cute, thresh, incr);
    points.collected_taxes.dumb += calc.func(&points.dumb, points.owes_tax.dumb, thresh, incr);
    points.collected_taxes.mal += calc.func(&points.malicous, points.owes_tax.mal, thresh, incr);
}

fn applyResSeal(card: *Card, points: *Points) void {
    if(card.seal == .RESISTANCE) {
        if(card.is_sentinel) {
            points.res.cute = true;
            points.res.dumb = true;
            points.res.mal = true;
            for ([_]Suit{ .CUTE, .DUMB, .MALICOUS }) |s| {
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = s }) catch {};
            }
        }
        else if(card.primary.suit == .CUTE) {
            if(points.res.cute) {
                card.seal = .STATIC;
                points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 30, .suit = .CUTE }) catch {};
            } else {
                points.res.cute = true;
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = .CUTE }) catch {};
            }
        }

        else if(card.primary.suit == .DUMB) {
            if(points.res.dumb) {
                card.seal = .STATIC;
                points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 30, .suit = .DUMB }) catch {};
            } else {
                points.res.dumb = true;
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = .DUMB }) catch {};
            }
        }

        else if(card.primary.suit == .MALICOUS) {
            if(points.res.mal) {
                card.seal = .STATIC;
                points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 30, .suit = .MALICOUS }) catch {};
            } else {
                points.res.mal = true;
                points.events.append(points.allocator, .{ .event = .res, .source = points.player, .target = points.player, .suit = .MALICOUS }) catch {};
            }
        }
    }
}

fn setOwesTaxFlag(player_A: *Points, player_B: Points) void {
    if(player_B.tax.cute) player_A.owes_tax.cute = true;
    if(player_B.tax.dumb) player_A.owes_tax.dumb = true;
    if(player_B.tax.mal) player_A.owes_tax.mal = true;
}

fn applyTaxSeal(card: *Card, points: *Points) void {
    if(card.is_sentinel) {
        points.tax.cute = true;
        points.tax.dumb = true;
        points.tax.mal = true;
        for ([_]Suit{ .CUTE, .DUMB, .MALICOUS }) |s| {
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = s }) catch {};
        }
        return;
    }
    else if(card.primary.suit == .CUTE) {
        if(points.tax.cute) {
            card.seal = .STATIC;
            points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 30, .suit = .CUTE }) catch {};
        } else {
            points.tax.cute = true;
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = .CUTE }) catch {};
        }
    }

    else if(card.primary.suit == .DUMB) {
        if(points.tax.dumb) {
            card.seal = .STATIC;
            points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 30, .suit = .DUMB }) catch {};
        } else {
            points.tax.dumb = true;
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = .DUMB }) catch {};
        }
    }

    else if(card.primary.suit == .MALICOUS) {
        if(points.tax.mal) {
            card.seal = .STATIC;
            points.events.append(points.allocator, .{ .event = .static_conversion, .source = points.player, .target = points.player, .points = 30, .suit = .MALICOUS }) catch {};
        } else {
            points.tax.mal = true;
            points.events.append(points.allocator, .{ .event = .tax, .source = points.player, .target = points.player, .suit = .MALICOUS }) catch {};
        }
    }
}

fn getSubmittedPoints(cards: []Card, points: *Points) void {
    for(cards) |*card| {
        if(card.seal == .RESISTANCE) applyResSeal(card, points)
        else if(card.seal == .TAX) applyTaxSeal(card, points);
        points.cute += getPointsFromCard(card.*, .CUTE);
        points.dumb += getPointsFromCard(card.*, .DUMB);
        points.malicous += getPointsFromCard(card.*, .MALICOUS);
    }
}

fn getPointsFromCard(card: Card, suit: Suit) i32{
    if(card.primary.suit == suit) return card.primary.val
    else if(card.secondary.suit == suit) return card.secondary.val
    else if(card.tertiary.suit == suit) return card.tertiary.val
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
    std.debug.print("  {s:<8} | {d:>6} | {d:>6} | {d:>6} | {d:>6} | {d:>6} | {d:>6}\n", .{
        "Player 1", p1.cute, p1.dumb, p1.malicous, p1.static, p1.suit_wins, p1.total,
    });
    std.debug.print("  {s:<8} | {d:>6} | {d:>6} | {d:>6} | {d:>6} | {d:>6} | {d:>6}\n", .{
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
