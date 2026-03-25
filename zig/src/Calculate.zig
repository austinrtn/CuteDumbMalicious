const std = @import("std");
const lib = @import("CuteDumbMalicious");
const Card = lib.Card;
const Seal = lib.Seal;
const Suit = lib.Suit;
const SubmitHand = lib.SubmitHand;

const Points = struct{
    cute: i32 = 0, 
    dumb: i32 = 0, 
    malicous: i32 = 0, 

    cute_res: bool = false,
    dumb_res: bool = false,
    mal_res: bool = false,

    static: i32 = 0,
    suit_wins: i32 = 0,
    total: i32 = 0, 
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    defer _ = gpa.deinit(); 

    var args = std.process.args();
    defer args.deinit();
    _ = args.next();

    const file_path = args.next() orelse @panic("Missing argument\n");

    const contents = try std.fs.cwd().readFileAlloc(allocator, file_path, 1024 * 1024);
    defer allocator.free(contents);

    const parsed = try std.json.parseFromSlice([]SubmitHand, allocator, contents, .{});
    defer parsed.deinit();
    const hands = parsed.value;

    var p1: SubmitHand = hands[0];
    var p2: SubmitHand = hands[1];
    printHand(p1);
    printHand(p2);

    var p1_points = getSubmittedPoints(&p1.cards);
    var p2_points = getSubmittedPoints(&p2.cards);
    std.debug.print("\n{any}\n{any}\n", .{p1_points, p2_points});

    applyInvestmentMult(&p1_points);
    applyInvestmentMult(&p2_points);
    
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

    std.debug.print("\n{any}\n{any}\n", .{p1_points, p2_points});
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
    const player_b_cute: i32 = if (player_A.cute_res) player_B.cute - @divTrunc(player_B.cute * 3, 4) else player_B.cute;
    const player_b_dumb: i32 = if (player_A.dumb_res) player_B.dumb - @divTrunc(player_B.dumb * 3, 4) else player_B.dumb;
    const player_b_malicous: i32 = if (player_A.mal_res) player_B.malicous - @divTrunc(player_B.malicous * 3, 4) else player_B.malicous;

    player_A.cute = @max(player_A.cute - player_b_dumb, 0);
    player_A.dumb = @max(player_A.dumb - player_b_malicous, 0);
    player_A.malicous = @max(player_A.malicous - player_b_cute, 0);
}

fn applyInvestmentMult(points: *Points) void {
    const thresh = 3;
    const incr = 1.5;
    const calc = struct {
        fn func(pts: *i32, threshold: usize, increment: f32) void {
            var new_points: f32 = 0;
            var mult: f32 = 1;    
            for(0..@as(usize, @intCast(pts.*))) |i| {
                new_points += mult;
                if(@mod(i + 1, threshold) == 0) {
                    mult += increment;
                }
            }
            new_points *= 10;
            pts.* =  @as(i32, @intFromFloat(new_points));
        }
    };
    calc.func(&points.cute, thresh, incr);
    calc.func(&points.dumb, thresh, incr);
    calc.func(&points.malicous, thresh, incr);
}

fn applyResSeal(card: *Card, points: *Points) void {
    if(card.seal == .RESISTANCE) {
        if(card.is_sentinel) {
            points.cute_res = true;
            points.dumb_res = true;
            points.mal_res = true;
        }
        else if(card.primary.suit == .CUTE) {
            if(points.cute_res) card.seal = .STATIC
                else points.cute_res = true;
        }

        else if(card.primary.suit == .DUMB) {
            if(points.dumb_res) card.seal = .STATIC
                else points.dumb_res = true;
        }

        else if(card.primary.suit == .MALICOUS) {
            if(points.mal_res) card.seal = .STATIC
                else points.mal_res = true;
        }
    }
}

fn getSubmittedPoints(cards: []Card) Points {
    var points = Points{};
    for(cards) |*card| {
        applyResSeal(card, &points); 
        points.cute += getPointsFromCard(card.*, .CUTE);
        points.dumb += getPointsFromCard(card.*, .DUMB);
        points.malicous += getPointsFromCard(card.*, .MALICOUS);
    }
    return points;
}

fn getPointsFromCard(card: Card, suit: Suit) i32{
    if(card.primary.suit == suit) return card.primary.val
    else if(card.secondary.suit == suit) return card.secondary.val
    else if(card.tertiary.suit == suit) return card.tertiary.val
    else unreachable;
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
