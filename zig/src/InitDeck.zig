const std = @import("std");
const CardData = @import("Card.zig");
const Card = CardData.Card;
const Seal = CardData.Seal;

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

    var seal_count: usize = 0;
    var num_count: usize = 1;

    var deck: [52]Card = .{ Card{} } ** 52;

    for(&deck) |*card| {
        const seal:Seal = @enumFromInt(seal_count);

        card.seal = seal;       
        card.num = @intCast(num_count);

        num_count += 1;
        if(num_count > 13) {
            seal_count += 1;
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

const Ratio = struct { primary: i32, secondary: i32, tertiary: i32 };

const Sentinel = Ratio{ .primary = 3, .secondary = 3, .tertiary = 3}; 
const Scout = Ratio{ .primary = 4, .secondary = 3, .tertiary = 2}; 
const Tactician = Ratio{ .primary = 5, .secondary = 3, .tertiary = 1}; 
const Bruiser = Ratio{ .primary = 7, .secondary = 2, .tertiary = 0}; 
const Juggernaut = Ratio{ .primary = 9, .secondary = 0, .tertiary = 0}; 

const ratios = [_]Ratio{Sentinel, Scout, Tactician, Bruiser, Juggernaut};

fn setCard(ratio_type: Ratio, card: *Card) void {

}
