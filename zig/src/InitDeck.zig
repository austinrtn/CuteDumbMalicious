const std = @import("std");
const CardData = @import("Card.zig");
const Card = CardData.Card;
const Suit = CardData.Suit;

pub fn main() !void {
    var buf: [4096]u8 = undefined;
    var stdout = std.fs.File.stdout().writer(&buf);
    const writer = &stdout.interface;

    var prng: std.Random.DefaultPrng = .init(blk: {
        var seed: u64 = undefined;
        try std.posix.getrandom(std.mem.asBytes(&seed));
        break :blk seed;
    });
    const rand = prng.random();

    var suit_count: usize = 0;
    var num_count: usize = 1;

    var deck: [52]Card = undefined;
    for(&deck) |*card| {
        const suit:Suit = @enumFromInt(suit_count);

        card.suit = suit;       
        card.num = @intCast(num_count);


        num_count += 1;
        if(num_count > 13) {
            suit_count += 1;
            num_count = 1;
        }
    }

    for(0..deck.len) |i| {
        const k = rand.intRangeAtMost(u8, 0, 51);
        const current_card = deck[i];
        const random_card = deck[k];

        deck[i] = random_card; 
        deck[k] = current_card;
    }

    try std.json.fmt(deck, .{.whitespace = .indent_2}).format(writer);
    try writer.flush();
}
