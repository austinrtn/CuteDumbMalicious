import tomllib
from pathlib import Path

script_dir = Path(__file__).resolve().parent
zig_output = script_dir / "../zig/src/Card.zig"
zig_results_output = script_dir / "../zig/src/Event.zig"
go_output = script_dir / "../Card.go"
go_results_output = script_dir / "../Event.go"
schema_file = script_dir / "CardSchema.toml"
results_schema_file = script_dir / "Results.toml"

def writeZig(data):
    #Generate Card struct
    contents = ""

    #Generate game data
    card_count = data["CardCount"]
    contents += f"pub const CARD_COUNT: {card_count['type']} = {card_count['value']};\n\n"

    #Generate card struct
    contents += "pub const Card = struct {\n"
    for field_name, field_type in data["Card"].items():
        #JSON tags do not get applied for Zig
        if field_name == "json_tags": continue

        #Nested structs
        elif field_name == "primary" or field_name == "secondary" or field_name == "tertiary":
            contents += f"\t{field_name}: struct {{\n"
            for fn, ft in data["Card"][field_name].items():
                T = getZigType(ft)
                default = getZigDefault(ft)
                contents += f"\t\t{fn}: {T}{default}, \n"
            contents += f"\t}} = .{{}},\n"
            continue

        #Player and seal data
        else:
            T = getZigType(field_type)
            default = getZigDefault(field_type)
            contents += f"\t{field_name}: {T}{default},\n"

    contents += "};\n\n"

    # Generate Suit enum
    contents += "pub const Suit = enum {\n"
    for val in data["Suit"]["values"]:
        contents += f"\t{val},\n"
    contents += "};\n\n"

    # Generate SubmitHand struct
    contents += "pub const SubmitHand = struct {\n"
    for field_name, field_type in data["SubmitHand"].items():
        if isinstance(field_type, dict) and field_type.get("type") == "array":
            elem_type = getZigType(field_type["element"])
            size = field_type["size"]
            contents += f"\t{field_name}: [{size}]{elem_type} = [_]{elem_type}{{.{{}}}} ** {size},\n"
        else:
            T = getZigType(field_type)
            default = getZigDefault(field_type)
            contents += f"\t{field_name}: {T}{default},\n"
    contents += "};\n\n"

    # Generate Seal enum
    contents += "pub const Seal = enum {\n"
    for val in data["Seal"]["values"]:
        contents += f"\t{val},\n"
    contents += "};\n\n"

    with open(zig_output, "w") as f:
        f.write(contents)

def getZigType(field_type):
    if field_type == "string": return "[]const u8"
    elif field_type == "int": return "i32"
    elif field_type == "usize": return "usize"
    elif field_type == "bool": return "bool"
    elif field_type == "seal": return "Seal"
    elif field_type == "suit": return "Suit"
    elif field_type == "event": return "Event"
    elif field_type == "Card": return "Card"
    elif field_type == "ResultPlayer": return "ResultPlayer"
    elif field_type == "NewEvent": return "NewEvent"

def getZigDefault(field_type):
    if field_type == "string": return ' = ""'
    elif field_type == "int": return " = 0"
    elif field_type == "usize": return " = 0"
    elif field_type == "bool": return " = false"
    elif field_type == "seal": return " = .NONE"
    elif field_type == "suit": return " = undefined"
    elif field_type == "event": return " = undefined"
    elif field_type == "Card": return " = .{}"
    elif field_type == "ResultPlayer": return " = .{}"
    elif field_type == "NewEvent": return " = .{}"

def writeGo(data):
    json_tags = data["Card"].get("json_tags", {})
    contents = "package main\n\n"
    contents += "type Card struct {\n"

    for field_name, field_type in data["Card"].items():
        if field_name == "json_tags": continue

        elif field_name == "primary" or field_name == "secondary" or field_name == "tertiary":
            go_name = field_name.capitalize()
            tag = json_tags.get(field_name, field_name)
            contents += f'\t{go_name} struct {{\n'
            for fn, ft in data["Card"][field_name].items():
                T = getGoType(ft)
                contents += f'\t\t{fn.capitalize()} {T} `json:"{fn}"`\n'
            contents += f'\t}} `json:"{tag}"`\n'

        else:
            T = getGoType(field_type)
            go_name = field_name.capitalize()
            tag = json_tags.get(field_name, field_name)
            contents += f'\t{go_name} {T} `json:"{tag}"`\n'

    contents += "}\n\n"

    # Generate SubmitHand struct
    contents += "type SubmitHand struct {\n"
    for field_name, field_type in data["SubmitHand"].items():
        if isinstance(field_type, dict) and field_type.get("type") == "array":
            elem_type = getGoType(field_type["element"])
            size = field_type["size"]
            go_name = field_name.capitalize()
            contents += f'\t{go_name} [{size}]{elem_type} `json:"{field_name}"`\n'
        else:
            T = getGoType(field_type)
            go_name = field_name.capitalize()
            contents += f'\t{go_name} {T} `json:"{field_name}"`\n'
    contents += "}\n\n"

    contents += "type Seal string\n\n"
    contents += "const (\n"
    for val in data["Seal"]["values"]:
        contents += f'\t{val.capitalize()} Seal = "{val}"\n'
    contents += ")\n\n"
    contents += "type Suit string\n\n"
    contents += "const (\n"
    for val in data["Suit"]["values"]:
        contents += f'\t{val.capitalize()} Suit = "{val}"\n'
    contents += ")\n"

    with open(go_output, "w") as f:
        f.write(contents)


def getGoType(field_type):
    if field_type == "string": return "string"
    elif field_type == "int": return "int"
    elif field_type == "usize": return "int"
    elif field_type == "bool": return "bool"
    elif field_type == "seal": return "Seal"
    elif field_type == "suit": return "Suit"
    elif field_type == "event": return "Event"
    elif field_type == "Card": return "Card"
    elif field_type == "ResultPlayer": return "ResultPlayer"
    elif field_type == "NewEvent": return "NewEvent"


def writeZigResults(data):
    contents = 'const Suit = @import("Card.zig").Suit;\n\n'

    # Generate enums
    for name, section in data.items():
        if isinstance(section, dict) and section.get("type") == "enum":
            contents += f"pub const {name} = enum {{\n"
            for val in section["values"]:
                contents += f"\t{val},\n"
            contents += "};\n\n"

    # Generate structs (skip enums)
    for name, section in data.items():
        if not isinstance(section, dict) or section.get("type") == "enum":
            continue
        contents += f"pub const {name} = struct {{\n"
        for field_name, field_type in section.items():
            if isinstance(field_type, dict) and field_type.get("type") == "slice":
                elem_type = getZigType(field_type["element"])
                contents += f"\t{field_name}: []const {elem_type} = &.{{}},\n"
            else:
                T = getZigType(field_type)
                default = getZigDefault(field_type)
                contents += f"\t{field_name}: {T}{default},\n"
        contents += "};\n\n"

    with open(zig_results_output, "w") as f:
        f.write(contents)

def writeGoResults(data):
    contents = "package main\n\n"

    # Generate enums (prefix constants with type name to avoid collisions)
    for name, section in data.items():
        if isinstance(section, dict) and section.get("type") == "enum":
            contents += f"type {name} string\n\n"
            contents += "const (\n"
            for val in section["values"]:
                contents += f'\t{name}{val.capitalize()} {name} = "{val}"\n'
            contents += ")\n\n"

    # Generate structs (skip enums)
    for name, section in data.items():
        if not isinstance(section, dict) or section.get("type") == "enum":
            continue
        contents += f"type {name} struct {{\n"
        for field_name, field_type in section.items():
            go_name = field_name.capitalize()
            if isinstance(field_type, dict) and field_type.get("type") == "slice":
                elem_type = getGoType(field_type["element"])
                contents += f'\t{go_name} []{elem_type} `json:"{field_name}"`\n'
            else:
                T = getGoType(field_type)
                contents += f'\t{go_name} {T} `json:"{field_name}"`\n'
        contents += "}\n\n"

    with open(go_results_output, "w") as f:
        f.write(contents)

if __name__ == "__main__":
    with open(schema_file, "rb") as f:
        data = tomllib.load(f)
        writeZig(data)
        writeGo(data)

    with open(results_schema_file, "rb") as f:
        results_data = tomllib.load(f)
        writeZigResults(results_data)
        writeGoResults(results_data)

    print("Files generated!")

