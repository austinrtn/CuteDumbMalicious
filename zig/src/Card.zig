pub const CARD_COUNT: usize = 258;

pub const Card = struct {
	player: []const u8 = "",
	seal: Seal = .NONE,
	is_sentinel: bool = false,
	primary: struct {
		val: i32 = 0, 
		suit: Suit = undefined, 
	} = .{},
	secondary: struct {
		val: i32 = 0, 
		suit: Suit = undefined, 
	} = .{},
	tertiary: struct {
		val: i32 = 0, 
		suit: Suit = undefined, 
	} = .{},
};

pub const Suit = enum {
	CUTE,
	DUMB,
	MALICOUS,
};

pub const SubmitHand = struct {
	player: []const u8 = "",
	cards: [5]Card = [_]Card{.{}} ** 5,
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

