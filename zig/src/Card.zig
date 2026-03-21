pub const Card = struct {
	player: []const u8 = "",
	suit: Suit = .HEARTS,
	num: i32 = 0,
};

pub const Suit = enum {
	HEARTS,
	DIAMONDS,
	CLUBS,
	SPADES,
};

