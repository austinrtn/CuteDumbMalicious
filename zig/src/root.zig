const std = @import("std");
const CardLib = @import("Card.zig");
const EventLib = @import("Event.zig");

pub const CARD_COUNT = CardLib.CARD_COUNT;
pub const Card = CardLib.Card;
pub const Suit = CardLib.Suit;
pub const Seal = CardLib.Seal;
pub const SubmitHand = CardLib.SubmitHand;
pub const NewEvent = EventLib.NewEvent;
pub const Event = EventLib.Event;
pub const ResultPlayer = EventLib.ResultPlayer;
pub const SubmittedHandsResult = EventLib.SubmittedHandsResult;

pub fn getPrng() !std.Random.DefaultPrng {
    var seed: u64 = undefined;
    try std.posix.getrandom(std.mem.asBytes(&seed));
    return .init(seed);
}

