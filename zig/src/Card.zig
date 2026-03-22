pub const Card = struct {
	player: []const u8 = "",
	seal: Seal = .HEARTS,
	cute: i32 = 0,
	bad: i32 = 0,
	malicious: i32 = 0,
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

