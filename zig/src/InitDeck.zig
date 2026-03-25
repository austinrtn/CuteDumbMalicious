const std = @import("std");
const lib = @import("CuteDumbMalicious");
const CARD_COUNT = lib.CARD_COUNT;
const Card = lib.Card;
const Seal = lib.Seal;
const Suit = lib.Suit;

const SealData = struct{ seal: Seal, chance: u32 = 5, count: usize = 0, };
var Seals = [_]SealData{
    SealData{ .seal = .STATIC },
    SealData{ .seal = .WILD },
    SealData{ .seal = .RESISTANCE },
    SealData{ .seal = .TAX },
    SealData{ .seal = .PEEK },
    SealData{ .seal = .SWAP },
};

const CardType = struct { primary: i32, secondary: i32, tertiary: i32, perms: usize = 6, scale: u32 = 6, weight: usize };
const Sentinel = CardType{ .primary = 3, .secondary = 3, .tertiary = 3, .perms = 1, .weight = 3 };
const Scout = CardType{ .primary = 4, .secondary = 3, .tertiary = 2, .weight = 7 };
const Tactician = CardType{ .primary = 5, .secondary = 3, .tertiary = 1, .weight = 8 };
const Bruiser = CardType{ .primary = 7, .secondary = 2, .tertiary = 0, .weight = 5 };
const Juggernaut = CardType{ .primary = 9, .secondary = 0, .tertiary = 0, .perms = 3, .weight = 2 };
const card_types = [_]CardType{Sentinel, Scout, Tactician, Bruiser, Juggernaut};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    defer _ = gpa.deinit();

    // To write to stdout (which will be GO backend)
    var buf: [4096]u8 = undefined;
    var stdout = std.fs.File.stdout().writer(&buf);
    const writer = &stdout.interface;

    var prng = try lib.getPrng();
    const rand = prng.random();

    // Arraylist where cards are kept 
    var deck = std.ArrayList(Card){};
    defer deck.deinit(allocator);
    try deck.ensureTotalCapacity(allocator, CARD_COUNT);

    // Generate the cards by each card type, 
    // cycling suites to generate all possible permutations of each card type
    for(card_types) |card_t| {
        var primary: Suit = .CUTE;
        var secondary: Suit = .DUMB;
        var tertiary: Suit = .MALICOUS;
        const is_sentinel = (card_t.primary == card_t.secondary and card_t.secondary == card_t.tertiary);

        for(0..card_t.perms) |i| {
            var card: Card = .{.is_sentinel = is_sentinel};
            card.primary = .{ .suit = primary, .val = card_t.primary }; 
            card.secondary = .{ .suit = secondary, .val = card_t.secondary }; 
            card.tertiary = .{ .suit = tertiary, .val = card_t.tertiary }; 

            try deck.appendNTimes(allocator, card, (card_t.weight * card_t.scale) / card_t.perms);

            if(i == 2) {
                primary = .CUTE;
                secondary = .MALICOUS;
                tertiary = .DUMB;
            } else {
                primary = getNextSuit(primary);
                secondary = getNextSuit(secondary);
                tertiary = getNextSuit(tertiary);
            }
        } 
    } 

    for(deck.items) |*card| {
        const seal: Seal = blk: {
            var result: ?*SealData = null;   

            for(&Seals) |*seal_data| {
                const chance = rand.intRangeAtMost(u32, 1, 100);
                if(chance > seal_data.chance) continue;

                if(result) |prev| {
                    if(seal_data.count < prev.count) { result = seal_data; }
                } else {
                    result = seal_data;
                }
            }
            
            if (result) |won| {
                won.count += 1;
                break :blk won.seal;
            }
            break :blk .NONE;
        };
        card.seal = seal;       
    }

    for(0..deck.items.len) |i| {
        const k = rand.intRangeAtMost(u8, 0, 51);
        const current_card = deck.items[i];
        const random_card = deck.items[k];

        deck.items[i] = random_card; 
        deck.items[k] = current_card;
    }

    try std.json.fmt(deck.items, .{.whitespace = .indent_2}).format(writer);
    try writer.flush();
}

fn getNextSuit(suit: Suit) Suit {
    switch(suit) {
        .CUTE => return .DUMB,
        .DUMB => return .MALICOUS,
        .MALICOUS => return .CUTE,
    }
    unreachable;
}
