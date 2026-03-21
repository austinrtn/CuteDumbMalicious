import tomllib
zig_output = "../zig/src/Card.zig"
go_output = "../Card.go"

def writeZig(data): 
    with open(zig_output, "w") as f: 
        contents = "pub const Card = struct {\n"
        for field_name, field_type in data["Card"].items():
            if field_name == "json_tags": continue 
            T = getZigType(field_type)
            contents += f"\t{field_name}: {T},\n"

        contents += "};\n\n"
        contents += "pub const Suit = enum {\n"

        for val in data["Suit"]["values"]:
            contents += f"\t{val},\n"
        
        contents += "};\n\n"
        f.write(contents)

def getZigType(field_type):
    if field_type == "string": return "[]const u8"
    elif field_type == "int": return "u32"
    elif field_type == "suit": return "Suit"

def writeGo(data):
    with open(go_output, "w") as f:
        json_tags = data["Card"].get("json_tags", {})
        contents = "package main\n\n"
        contents += "type Card struct {\n"

        for field_name, field_type in data["Card"].items():
            if field_name == "json_tags": continue
            T = getGoType(field_type)
            go_name = field_name.capitalize()
            tag = json_tags.get(field_name, field_name)
            contents += f'\t{go_name} {T} `json:"{tag}"`\n'

        contents += "}\n"
        f.write(contents)


def getGoType(field_type): 
    if field_type == "string": return "string"
    elif field_type == "int": return "int"
    elif field_type == "suit": return "string"
 

if __name__ == "__main__": 
    with open("./CardSchema.toml", "rb") as f: 
        data = tomllib.load(f)
        writeZig(data)
        writeGo(data)

