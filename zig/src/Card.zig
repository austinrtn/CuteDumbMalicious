pub const Card = struct {
	player: []const u8,
	suit: Suit,
	num: u32,
};

pub const Suit = enum {
	HEARTS,
	DIAMONDS,
	CLUBS,
	SPADES,
};

