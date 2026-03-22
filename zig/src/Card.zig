pub const CARD_COUNT: usize = 150;

pub const Card = struct {
	player: []const u8 = "",
	seal: Seal = .NONE,
	primary: struct {
		val: i32 = 0, 
		suit: Suit = undefined, 
	},
	secondary: struct {
		val: i32 = 0, 
		suit: Suit = undefined, 
	},
	tertiary: struct {
		val: i32 = 0, 
		suit: Suit = undefined, 
	},
};

pub const Suit = enum {
	CUTE,
	BAD,
	MALICOUS,
};

pub const Seal = enum {
	SWAP,
	PEEK,
	TAX,
	WILD,
	RESISTANCE,
	STATIC,
	NONE,
};

