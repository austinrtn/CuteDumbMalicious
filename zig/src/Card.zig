pub const Card = struct {
	player: []const u8 = "",
	seal: Seal = .HEARTS,
	num: i32 = 0,
};

pub const Seal = enum {
	SWAP,
	PEEK,
	TAX,
	WILD,
	RESISTANCE,
	STATIC,
};

