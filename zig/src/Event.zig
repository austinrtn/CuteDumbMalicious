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

pub const ResultPlayer = struct {
	player: []const u8 = "",
	cute: i32 = 0,
	dumb: i32 = 0,
	malicous: i32 = 0,
	static_pts: i32 = 0,
	suit_wins: i32 = 0,
	total: i32 = 0,
	played_peek: bool = false,
	played_swap: bool = false,
};

pub const SubmittedHandsResult = struct {
	p1: ResultPlayer = .{},
	p2: ResultPlayer = .{},
	events: []const NewEvent = &.{},
};

