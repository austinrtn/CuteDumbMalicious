import tomllib
from pathlib import Path

script_dir = Path(__file__).resolve().parent
zig_output = script_dir / "../zig/src/Card.zig"
go_output = script_dir / "../Card.go"
schema_file = script_dir / "CardSchema.toml"

def writeZig(data): 
    with open(zig_output, "w") as f: 
        contents = "pub const Card = struct {\n"
        for field_name, field_type in data["Card"].items():
            if field_name == "json_tags": continue 
            T = getZigType(field_type)
            default = getZigDefault(field_type)
            contents += f"\t{field_name}: {T}{default},\n"

        contents += "};\n\n"
        contents += "pub const Seal = enum {\n"

        for val in data["Seal"]["values"]:
            contents += f"\t{val},\n"
        
        contents += "};\n\n"
        f.write(contents)

def getZigType(field_type):
    if field_type == "string": return "[]const u8"
    elif field_type == "int": return "i32"
    elif field_type == "seal": return "Seal"

def getZigDefault(field_type):
    if field_type == "string": return ' = ""'
    elif field_type == "int": return " = 0"
    elif field_type == "seal": return " = .HEARTS"

def writeGo(data):
    with open(go_output, "w") as f:
        json_tags = data["Card"].get("json_tags", {})
        contents = "package main\n\n"
        contents += "type Seal string\n\n"
        contents += "type Card struct {\n"

        for field_name, field_type in data["Card"].items():
            if field_name == "json_tags": continue
            T = getGoType(field_type)
            go_name = field_name.capitalize()
            tag = json_tags.get(field_name, field_name)
            contents += f'\t{go_name} {T} `json:"{tag}"`\n'

        contents += "}\n\n"
        contents += "const (\n"
        for val in data["Seal"]["values"]:
            contents += f'\t{val.capitalize()} Seal = "{val}"\n'
        contents += ")\n"
        f.write(contents)


def getGoType(field_type):
    if field_type == "string": return "string"
    elif field_type == "int": return "int"
    elif field_type == "seal": return "Seal"
 

if __name__ == "__main__": 
    with open(schema_file, "rb") as f:
        data = tomllib.load(f)
        writeZig(data)
        writeGo(data)

    print("Files generated!")

