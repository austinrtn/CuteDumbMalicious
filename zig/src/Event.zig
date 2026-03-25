const Suit = @import("Card.zig").Suit;

pub const Event = enum {
	res,
	tax,
	static_conversion,
};

pub const NewEvent = struct {
	event: Event = undefined,
	source: []const u8 = "",
	target: []const u8 = "",
	points: i32 = 0,
	suit: Suit = undefined,
};

