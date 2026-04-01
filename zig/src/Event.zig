const Suit = @import("Card.zig").Suit;

pub const Event = enum {
	res,
	tax,
	static_conversion,
};

pub const SuitFlags = struct {
	cute: bool = false,
	dumb: bool = false,
	mal: bool = false,
	played_sentinel: bool = false,
};

pub const NewEvent = struct {
	event: Event = undefined,
	source: []const u8 = "",
	target: []const u8 = "",
	points: f32 = 0,
	suit: Suit = undefined,
};

pub const ResultPlayer = struct {
	player: []const u8 = "",
	cute: f32 = 0,
	dumb: f32 = 0,
	malicous: f32 = 0,
	static_pts: f32 = 0,
	suit_wins: i32 = 0,
	total: f32 = 0,
	played_peek: bool = false,
	played_swap: bool = false,
	peek_flags: SuitFlags = .{},
};

pub const SubmittedHandsResult = struct {
	p1: ResultPlayer = .{},
	p2: ResultPlayer = .{},
	events: []const NewEvent = &.{},
};

