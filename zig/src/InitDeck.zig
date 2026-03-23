const std = @import("std");
const CardData = @import("Card.zig");
const CARD_COUNT = CardData.CARD_COUNT;
const Card = CardData.Card;
const Seal = CardData.Seal;
const Suit = CardData.Suit;

const Distribution = struct {
    mult: u32 = 6,

    sentinel: usize = 3,
    scout: usize = 7,
    tactical: usize = 8, 
    bruiser: usize = 5,    
    juggernaut: usize = 2,
};

const SealData = struct{ seal: Seal, chance: u32 = 6, count: usize = 0, };
var Seals = [_]SealData{
    SealData{ .seal = .STATIC },
    SealData{ .seal = .WILD },
    SealData{ .seal = .RESISTANCE },
    SealData{ .seal = .TAX },
    SealData{ .seal = .PEEK },
    SealData{ .seal = .SWAP },
};

const Sentinel = Ratio{ .primary = 3, .secondary = 3, .tertiary = 3, .perms = 1}; 
const Scout = Ratio{ .primary = 4, .secondary = 3, .tertiary = 2,}; 
const Tactician = Ratio{ .primary = 5, .secondary = 3, .tertiary = 1, }; 
const Bruiser = Ratio{ .primary = 7, .secondary = 2, .tertiary = 0, }; 
const Juggernaut = Ratio{ .primary = 9, .secondary = 0, .tertiary = 0, .perms = 3}; 

const ratios = [_]Ratio{Sentinel, Scout, Tactician, Bruiser, Juggernaut};
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

    var deck: [CARD_COUNT]Card = .{ Card{} } ** CARD_COUNT;

    for(&deck) |*card| {
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
            else break :blk .NONE;
        };
        card.seal = seal;       

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

const Ratio = struct { primary: i32, secondary: i32, tertiary: i32, perms: usize = 6};


