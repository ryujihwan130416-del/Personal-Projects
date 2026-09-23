#!/usr/bin/env python3
"""Build Cloud Arena, a two-player Scratch 3 shooter synced with cloud variables.

Cloud variables can only store numbers, and a project can only have ten of them.
Each player writes a packed integer (room is separate) about ten times a second.
The other computer unpacks it and moves that sprite.
"""

import hashlib
import io
import json
import math
import struct
import wave
import zipfile
from pathlib import Path

OFFSET = 250
PLAYER_PACKET_X = 10_000_000_000
PLAYER_PACKET_Y = 10_000_000
PLAYER_PACKET_DIR = 10_000
BULLET_PACKET_DIR = 100_000_000
BULLET_PACKET_Y = 100_000
BULLET_PACKET_X = 100

SPAWN = {
    1: (-170, 0, 90),
    2: (170, 0, -90),
}
HP = 99
DAMAGE = 33
WIN_KILLS = 5
SPEED = 4
BULLET_SPEED = 8
HIT_RADIUS_SQ = 36 * 36
PLAYER_RADIUS = 16
BULLET_RADIUS = 4
COOLDOWN = 18
RESPAWN_FRAMES = 70
INVULN_FRAMES = 36
BULLET_LIFE = 70

# Playfield limits and covers. These match the backdrop drawing.
BOUNDS_X = 210
BOUNDS_Y = 125
WALLS = (
    (0, 0, 26, 70),
    (-90, 63, 60, 15),
    (90, -63, 60, 15),
)


def pack_player(x, y, direction, hp, deaths):
    enc_x = int(round(x)) + OFFSET
    enc_y = int(round(y)) + OFFSET
    facing = int(round(direction)) % 360
    return (
        enc_x * PLAYER_PACKET_X
        + enc_y * PLAYER_PACKET_Y
        + facing * PLAYER_PACKET_DIR
        + int(hp) * 100
        + int(deaths)
    )


def unpack_player(value):
    value = int(value)
    deaths = value % 100
    hp = (value // 100) % 100
    facing = (value // PLAYER_PACKET_DIR) % 1000
    enc_y = (value // PLAYER_PACKET_Y) % 1000
    enc_x = (value // PLAYER_PACKET_X) % 1000
    return enc_x - OFFSET, enc_y - OFFSET, facing, hp, deaths


def pack_bullet(x, y, direction, shot_id):
    enc_x = int(round(x)) + OFFSET
    enc_y = int(round(y)) + OFFSET
    facing = int(round(direction)) % 360
    return (
        facing * BULLET_PACKET_DIR
        + enc_y * BULLET_PACKET_Y
        + enc_x * BULLET_PACKET_X
        + int(shot_id)
    )


def unpack_bullet(value):
    value = int(value)
    shot_id = value % 100
    enc_x = (value // BULLET_PACKET_X) % 1000
    enc_y = (value // BULLET_PACKET_Y) % 1000
    facing = (value // BULLET_PACKET_DIR) % 1000
    return enc_x - OFFSET, enc_y - OFFSET, facing, shot_id


def blocked(x, y, radius):
    if x < -BOUNDS_X + radius or x > BOUNDS_X - radius:
        return True
    if y < -BOUNDS_Y + radius or y > BOUNDS_Y - radius:
        return True
    for cx, cy, hx, hy in WALLS:
        if abs(x - cx) < hx + radius and abs(y - cy) < hy + radius:
            return True
    return False


def _num(value):
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, int):
        return str(value)
    text = format(value, "f").rstrip("0").rstrip(".")
    return text if text else "0"


def _wav(samples, rate=22050):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(sample))))
            for sample in samples
        )
        handle.writeframes(frames)
    return buffer.getvalue(), rate, len(samples)


def _tone(freq, ms, volume=0.35, rate=22050):
    count = int(rate * ms / 1000)
    samples = []
    for index in range(count):
        envelope = (1 - index / count) ** 2
        samples.append(
            volume * envelope * math.sin(2 * math.pi * freq * index / rate) * 32767
        )
    return samples


class Project:
    def __init__(self):
        self.assets = {}
        self.targets = []
        self.monitors = []
        self._ids = 0
        self.stage = None

    def uid(self, prefix):
        self._ids += 1
        return f"{prefix}{self._ids:04d}"

    def asset(self, data, ext):
        digest = hashlib.md5(data).hexdigest()
        self.assets[f"{digest}.{ext}"] = data
        return digest

    def add_svg(self, name, svg, center):
        data = svg.encode("utf-8")
        digest = self.asset(data, "svg")
        return {
            "assetId": digest,
            "name": name,
            "bitmapResolution": 1,
            "md5ext": f"{digest}.svg",
            "dataFormat": "svg",
            "rotationCenterX": center[0],
            "rotationCenterY": center[1],
        }

    def add_wav(self, name, samples):
        data, rate, count = _wav(samples)
        digest = self.asset(data, "wav")
        return {
            "assetId": digest,
            "name": name,
            "dataFormat": "wav",
            "format": "",
            "rate": rate,
            "sampleCount": count,
            "md5ext": f"{digest}.wav",
        }

    def monitor(self, var_id, name, x, y):
        self.monitors.append(
            {
                "id": var_id,
                "mode": "default",
                "opcode": "data_variable",
                "params": {"VARIABLE": name},
                "spriteName": None,
                "value": 0,
                "width": 0,
                "height": 0,
                "x": x,
                "y": y,
                "visible": True,
                "sliderMin": 0,
                "sliderMax": 100,
                "isDiscrete": True,
            }
        )

    def to_json(self):
        return {
            "targets": self.targets,
            "monitors": self.monitors,
            "extensions": [],
            "meta": {
                "semver": "3.0.0",
                "vm": "5.0.241",
                "agent": "cloud-arena",
            },
        }

    def save(self, path):
        payload = json.dumps(self.to_json(), ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("project.json", payload)
            for name, data in self.assets.items():
                archive.writestr(name, data)


class Target:
    def __init__(self, project, name, is_stage=False):
        self.project = project
        self.is_stage = is_stage
        self.name = name
        self.variables = {}
        self.lists = {}
        self.broadcasts = {}
        self.blocks = {}
        self.comments = {}
        self.costumes = []
        self.sounds = []
        self.procs = {}
        self.var_ids = {}
        self.volume = 100
        self.layer = 0
        self.tempo = 60
        self.x = 0
        self.y = 0
        self.size = 100
        self.direction = 90
        self.visible = True
        self.draggable = False
        self.rotation = "all around"
        self.script_y = 40

    def var(self, name, value=0, cloud=False):
        var_id = self.project.uid("v")
        record = [name, value, True] if cloud else [name, value]
        self.variables[var_id] = record
        self.var_ids[name] = var_id
        return var_id

    def broadcast(self, name):
        cast_id = self.project.uid("c")
        self.broadcasts[cast_id] = name
        return cast_id

    def lookup(self, name):
        if name in self.var_ids:
            return name, self.var_ids[name]
        stage = self.project.stage
        if stage is not None and name in stage.var_ids and stage is not self:
            return name, stage.var_ids[name]
        if self.is_stage and name in self.var_ids:
            return name, self.var_ids[name]
        raise KeyError(name)

    def block(self, opcode, *, top=False, shadow=False, x=0, y=0):
        block_id = self.project.uid("b")
        record = {
            "opcode": opcode,
            "next": None,
            "parent": None,
            "inputs": {},
            "fields": {},
            "shadow": shadow,
            "topLevel": top,
        }
        if top:
            record["x"] = x
            record["y"] = y
        self.blocks[block_id] = record
        return block_id

    def stack(self, statements, parent):
        ids = [self.stmt(item) for item in statements]
        for index, block_id in enumerate(ids):
            if index == 0:
                self.blocks[block_id]["parent"] = parent
            else:
                self.blocks[block_id]["parent"] = ids[index - 1]
                self.blocks[ids[index - 1]]["next"] = block_id
        return ids[0] if ids else None

    def hat(self, opcode, body, *, fields=None, x=None, y=None):
        if y is None:
            y = self.script_y
            self.script_y += 80 + 28 * _count_stmts(body)
        if x is None:
            x = 480
        hat_id = self.block(opcode, top=True, x=x, y=y)
        if fields:
            self.blocks[hat_id]["fields"] = fields
        if body:
            self.blocks[hat_id]["next"] = self.stack(body, hat_id)
        return hat_id

    def proc(self, code, names, body):
        arg_ids = [self.project.uid("a") for _ in names]
        self.procs[code] = {"ids": arg_ids, "names": names}
        define_id = self.block("procedures_definition", top=True, x=40, y=self.script_y)
        self.script_y += 70 + 28 * max(1, _count_stmts(body))
        proto_id = self.block("procedures_prototype", shadow=True)
        self.blocks[proto_id]["parent"] = define_id
        self.blocks[proto_id]["mutation"] = {
            "tagName": "mutation",
            "children": [],
            "proccode": code,
            "argumentids": json.dumps(arg_ids),
            "argumentnames": json.dumps(names),
            "argumentdefaults": json.dumps(["0" for _ in names]),
            "warp": "true",
        }
        self.blocks[define_id]["inputs"]["custom_block"] = [1, proto_id]
        for arg_id, name in zip(arg_ids, names):
            reporter = self.block("argument_reporter_string_number", shadow=True)
            self.blocks[reporter]["parent"] = proto_id
            self.blocks[reporter]["fields"] = {"VALUE": [name, None]}
            self.blocks[proto_id]["inputs"][arg_id] = [1, reporter]
        if body:
            self.blocks[define_id]["next"] = self.stack(body, define_id)
        return define_id

    def stmt(self, node):
        kind = node[0]
        if kind == "forever":
            block_id = self.block("control_forever")
            self.blocks[block_id]["inputs"]["SUBSTACK"] = [2, self.stack(node[1], block_id)]
            return block_id
        if kind == "if":
            block_id = self.block("control_if")
            self._bool(block_id, "CONDITION", node[1])
            if node[2]:
                self.blocks[block_id]["inputs"]["SUBSTACK"] = [2, self.stack(node[2], block_id)]
            return block_id
        if kind == "ifelse":
            block_id = self.block("control_if_else")
            self._bool(block_id, "CONDITION", node[1])
            self.blocks[block_id]["inputs"]["SUBSTACK"] = [2, self.stack(node[2], block_id)]
            self.blocks[block_id]["inputs"]["SUBSTACK2"] = [2, self.stack(node[3], block_id)]
            return block_id
        if kind == "set":
            name, var_id = self.lookup(node[1])
            block_id = self.block("data_setvariableto")
            self.blocks[block_id]["fields"] = {"VARIABLE": [name, var_id]}
            self.blocks[block_id]["inputs"]["VALUE"] = self._text(block_id, node[2])
            return block_id
        if kind == "change":
            name, var_id = self.lookup(node[1])
            block_id = self.block("data_changevariableby")
            self.blocks[block_id]["fields"] = {"VARIABLE": [name, var_id]}
            self.blocks[block_id]["inputs"]["VALUE"] = self._number(block_id, node[2])
            return block_id
        if kind == "goto":
            block_id = self.block("motion_gotoxy")
            self.blocks[block_id]["inputs"]["X"] = self._number(block_id, node[1])
            self.blocks[block_id]["inputs"]["Y"] = self._number(block_id, node[2])
            return block_id
        if kind == "setx":
            block_id = self.block("motion_setx")
            self.blocks[block_id]["inputs"]["X"] = self._number(block_id, node[1])
            return block_id
        if kind == "sety":
            block_id = self.block("motion_sety")
            self.blocks[block_id]["inputs"]["Y"] = self._number(block_id, node[1])
            return block_id
        if kind == "changex":
            block_id = self.block("motion_changexby")
            self.blocks[block_id]["inputs"]["DX"] = self._number(block_id, node[1])
            return block_id
        if kind == "changey":
            block_id = self.block("motion_changeyby")
            self.blocks[block_id]["inputs"]["DY"] = self._number(block_id, node[1])
            return block_id
        if kind == "point":
            block_id = self.block("motion_pointindirection")
            self.blocks[block_id]["inputs"]["DIRECTION"] = self._number(block_id, node[1])
            return block_id
        if kind == "aim":
            block_id = self.block("motion_pointtowards")
            menu = self.block("motion_pointtowards_menu", shadow=True)
            self.blocks[menu]["parent"] = block_id
            self.blocks[menu]["fields"] = {"TOWARDS": ["_mouse_", None]}
            self.blocks[block_id]["inputs"]["TOWARDS"] = [1, menu]
            return block_id
        if kind == "show":
            return self.block("looks_show")
        if kind == "hide":
            return self.block("looks_hide")
        if kind == "size":
            block_id = self.block("looks_setsizeto")
            self.blocks[block_id]["inputs"]["SIZE"] = self._number(block_id, node[1])
            return block_id
        if kind == "ghost":
            block_id = self.block("looks_seteffectto")
            self.blocks[block_id]["fields"] = {"EFFECT": ["GHOST", None]}
            self.blocks[block_id]["inputs"]["VALUE"] = self._number(block_id, node[1])
            return block_id
        if kind == "say":
            block_id = self.block("looks_say")
            self.blocks[block_id]["inputs"]["MESSAGE"] = self._text(block_id, node[1])
            return block_id
        if kind == "sayfor":
            block_id = self.block("looks_sayforsecs")
            self.blocks[block_id]["inputs"]["MESSAGE"] = self._text(block_id, node[1])
            self.blocks[block_id]["inputs"]["SECS"] = self._number(block_id, node[2])
            return block_id
        if kind == "play":
            block_id = self.block("sound_play")
            menu = self.block("sound_sounds_menu", shadow=True)
            self.blocks[menu]["parent"] = block_id
            self.blocks[menu]["fields"] = {"SOUND_MENU": [node[1], None]}
            self.blocks[block_id]["inputs"]["SOUND_MENU"] = [1, menu]
            return block_id
        if kind == "broadcast":
            block_id = self.block("event_broadcast")
            name, cast_id = node[1]
            self.blocks[block_id]["inputs"]["BROADCAST_INPUT"] = [1, [11, name, cast_id]]
            return block_id
        if kind == "ask":
            block_id = self.block("sensing_askandwait")
            self.blocks[block_id]["inputs"]["QUESTION"] = self._text(block_id, node[1])
            return block_id
        if kind == "waituntil":
            block_id = self.block("control_wait_until")
            self._bool(block_id, "CONDITION", node[1])
            return block_id
        if kind == "call":
            code = node[1]
            proc = self.procs[code]
            block_id = self.block("procedures_call")
            self.blocks[block_id]["mutation"] = {
                "tagName": "mutation",
                "children": [],
                "proccode": code,
                "argumentids": json.dumps(proc["ids"]),
                "warp": "true",
            }
            for arg_id, value in zip(proc["ids"], node[2]):
                self.blocks[block_id]["inputs"][arg_id] = self._text(block_id, value)
            return block_id
        raise ValueError(f"unknown statement {kind}")

    def _own(self, block_id, child_id):
        self.blocks[child_id]["parent"] = block_id
        self.blocks[child_id]["topLevel"] = False

    def _number(self, parent, value):
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return [1, [4, _num(value)]]
        child = self.expr(value)
        self._own(parent, child)
        return [3, child, [4, "0"]]

    def _text(self, parent, value):
        if isinstance(value, str):
            return [1, [10, value]]
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return [1, [10, _num(value)]]
        child = self.expr(value)
        self._own(parent, child)
        return [3, child, [10, ""]]

    def _bool(self, parent, slot, value):
        child = self.expr(value)
        self._own(parent, child)
        self.blocks[parent]["inputs"][slot] = [2, child]

    def expr(self, node):
        if isinstance(node, (int, float)) and not isinstance(node, bool):
            block_id = self.block("math_number")
            self.blocks[block_id]["fields"] = {"NUM": [_num(node), None]}
            return block_id
        kind = node[0]
        binary = {
            "add": "operator_add",
            "sub": "operator_subtract",
            "mul": "operator_multiply",
            "div": "operator_divide",
            "mod": "operator_mod",
        }
        if kind in binary:
            block_id = self.block(binary[kind])
            self.blocks[block_id]["inputs"]["NUM1"] = self._number(block_id, node[1])
            self.blocks[block_id]["inputs"]["NUM2"] = self._number(block_id, node[2])
            return block_id
        if kind in ("lt", "gt"):
            block_id = self.block("operator_lt" if kind == "lt" else "operator_gt")
            self.blocks[block_id]["inputs"]["OPERAND1"] = self._number(block_id, node[1])
            self.blocks[block_id]["inputs"]["OPERAND2"] = self._number(block_id, node[2])
            return block_id
        if kind == "eq":
            block_id = self.block("operator_equals")
            self.blocks[block_id]["inputs"]["OPERAND1"] = self._text(block_id, node[1])
            self.blocks[block_id]["inputs"]["OPERAND2"] = self._text(block_id, node[2])
            return block_id
        if kind in ("and", "or"):
            block_id = self.block("operator_and" if kind == "and" else "operator_or")
            self._bool(block_id, "OPERAND1", node[1])
            self._bool(block_id, "OPERAND2", node[2])
            return block_id
        if kind == "not":
            block_id = self.block("operator_not")
            self._bool(block_id, "OPERAND", node[1])
            return block_id
        mathops = {
            "floor": "floor",
            "round": None,
            "abs": "abs",
            "sin": "sin",
            "cos": "cos",
        }
        if kind in mathops:
            if kind == "round":
                block_id = self.block("operator_round")
                self.blocks[block_id]["inputs"]["NUM"] = self._number(block_id, node[1])
                return block_id
            block_id = self.block("operator_mathop")
            self.blocks[block_id]["fields"] = {"OPERATOR": [mathops[kind], None]}
            self.blocks[block_id]["inputs"]["NUM"] = self._number(block_id, node[1])
            return block_id
        if kind == "var":
            name, var_id = self.lookup(node[1])
            block_id = self.block("data_variable")
            self.blocks[block_id]["fields"] = {"VARIABLE": [name, var_id]}
            return block_id
        if kind == "xpos":
            return self.block("motion_xposition")
        if kind == "ypos":
            return self.block("motion_yposition")
        if kind == "dir":
            return self.block("motion_direction")
        if kind == "key":
            block_id = self.block("sensing_keypressed")
            menu = self.block("sensing_keyoptions", shadow=True)
            self.blocks[menu]["parent"] = block_id
            self.blocks[menu]["fields"] = {"KEY_OPTION": [node[1], None]}
            self.blocks[block_id]["inputs"]["KEY_OPTION"] = [1, menu]
            return block_id
        if kind == "random":
            block_id = self.block("operator_random")
            self.blocks[block_id]["inputs"]["FROM"] = self._number(block_id, node[1])
            self.blocks[block_id]["inputs"]["TO"] = self._number(block_id, node[2])
            return block_id
        if kind == "join":
            block_id = self.block("operator_join")
            self.blocks[block_id]["inputs"]["STRING1"] = self._text(block_id, node[1])
            self.blocks[block_id]["inputs"]["STRING2"] = self._text(block_id, node[2])
            return block_id
        if kind == "answer":
            return self.block("sensing_answer")
        if kind == "arg":
            block_id = self.block("argument_reporter_string_number")
            self.blocks[block_id]["fields"] = {"VALUE": [node[1], None]}
            return block_id
        raise ValueError(f"unknown expression {kind}")

    def export(self):
        record = {
            "isStage": self.is_stage,
            "name": self.name,
            "variables": self.variables,
            "lists": self.lists,
            "broadcasts": self.broadcasts,
            "blocks": self.blocks,
            "comments": self.comments,
            "currentCostume": 0,
            "costumes": self.costumes,
            "sounds": self.sounds,
            "volume": self.volume,
            "layerOrder": self.layer,
        }
        if self.is_stage:
            record.update(
                {
                    "tempo": self.tempo,
                    "videoTransparency": 50,
                    "videoState": "on",
                    "textToSpeechLanguage": None,
                }
            )
        else:
            record.update(
                {
                    "visible": self.visible,
                    "x": self.x,
                    "y": self.y,
                    "size": self.size,
                    "direction": self.direction,
                    "draggable": self.draggable,
                    "rotationStyle": self.rotation,
                }
            )
        return record


def _count_stmts(body):
    total = 0
    for node in body:
        total += 1
        if node[0] in ("forever", "if"):
            total += _count_stmts(node[-1])
        elif node[0] == "ifelse":
            total += _count_stmts(node[2]) + _count_stmts(node[3])
    return total


def _all(*parts):
    value = parts[0]
    for part in parts[1:]:
        value = ("and", value, part)
    return value


def _any(*parts):
    value = parts[0]
    for part in parts[1:]:
        value = ("or", value, part)
    return value


def _at_least(left, right):
    return ("not", ("lt", left, right))


def _svg_player(fill, accent):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="28" y="6" width="8" height="28" rx="2" fill="{accent}" stroke="#102028" stroke-width="2"/>
  <circle cx="32" cy="38" r="16" fill="{fill}" stroke="#102028" stroke-width="3"/>
  <circle cx="32" cy="34" r="3" fill="#102028"/>
</svg>'''


def _svg_bullet():
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <circle cx="10" cy="10" r="6" fill="#ffe14a" stroke="#fff6bf" stroke-width="2"/>
</svg>'''


def _svg_button(fill):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="132" height="42" viewBox="0 0 132 42">
  <rect x="2" y="2" width="128" height="38" rx="12" fill="{fill}" stroke="#102028" stroke-width="3"/>
</svg>'''


def _svg_guide():
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="#d7e6ff" stroke="#102028" stroke-width="2"/>
  <circle cx="14" cy="8" r="2" fill="#102028"/>
  <rect x="12" y="12" width="4" height="8" rx="1" fill="#102028"/>
</svg>'''


def _stage_to_svg(x, y):
    return x + 240, 180 - y


def _svg_backdrop():
    marks = []
    for stage_x in range(-200, 201, 40):
        x, _ = _stage_to_svg(stage_x, 0)
        marks.append(
            f'<line x1="{x}" y1="55" x2="{x}" y2="305" stroke="#243246" stroke-width="1"/>'
        )
    for stage_y in range(-120, 121, 40):
        _, y = _stage_to_svg(0, stage_y)
        marks.append(
            f'<line x1="30" y1="{y}" x2="450" y2="{y}" stroke="#243246" stroke-width="1"/>'
        )
    left, top = _stage_to_svg(-BOUNDS_X, BOUNDS_Y)
    arena = (
        f'<rect x="{left}" y="{top}" width="{BOUNDS_X * 2}" height="{BOUNDS_Y * 2}" '
        f'fill="none" stroke="#8fd0ff" stroke-width="4"/>'
    )
    walls = []
    for cx, cy, hx, hy in WALLS:
        x, y = _stage_to_svg(cx - hx, cy + hy)
        walls.append(
            f'<rect x="{x}" y="{y}" width="{hx * 2}" height="{hy * 2}" rx="4" '
            f'fill="#3c5674" stroke="#d5e6f7" stroke-width="2"/>'
        )
    p1x, p1y = _stage_to_svg(-170, 0)
    p2x, p2y = _stage_to_svg(170, 0)
    spawns = (
        f'<circle cx="{p1x}" cy="{p1y}" r="10" fill="none" stroke="#2ee6d6" stroke-width="3"/>'
        f'<circle cx="{p2x}" cy="{p2y}" r="10" fill="none" stroke="#ff8a3d" stroke-width="3"/>'
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <rect width="480" height="360" fill="#1b2430"/>
  {''.join(marks)}
  {arena}
  {''.join(walls)}
  {spawns}
</svg>'''


def _wall_body():
    radius = ("arg", "r")
    x = ("arg", "x")
    y = ("arg", "y")
    return [
        ("set", "막힘", 0),
        (
            "if",
            _any(
                ("lt", x, ("sub", -BOUNDS_X, ("mul", radius, -1))),
                ("gt", x, ("sub", BOUNDS_X, radius)),
                ("lt", y, ("sub", -BOUNDS_Y, ("mul", radius, -1))),
                ("gt", y, ("sub", BOUNDS_Y, radius)),
            ),
            [("set", "막힘", 1)],
        ),
        *[
            (
                "if",
                _all(
                    ("lt", ("abs", ("sub", x, cx)), ("add", hx, radius)),
                    ("lt", ("abs", ("sub", y, cy)), ("add", hy, radius)),
                ),
                [("set", "막힘", 1)],
            )
            for cx, cy, hx, hy in WALLS
        ],
    ]


def _decode_player_body():
    packet = ("var", "패킷")
    return [
        ("set", "rdeaths", ("mod", packet, 100)),
        ("set", "rhp", ("mod", ("floor", ("div", packet, 100)), 100)),
        ("set", "rdir", ("mod", ("floor", ("div", packet, PLAYER_PACKET_DIR)), 1000)),
        (
            "set",
            "ry",
            ("sub", ("mod", ("floor", ("div", packet, PLAYER_PACKET_Y)), 1000), OFFSET),
        ),
        (
            "set",
            "rx",
            ("sub", ("mod", ("floor", ("div", packet, PLAYER_PACKET_X)), 1000), OFFSET),
        ),
    ]


def _encode_player_body(cloud_name):
    return [
        ("set", "ex", ("add", ("round", ("xpos",)), OFFSET)),
        ("set", "ey", ("add", ("round", ("ypos",)), OFFSET)),
        ("set", "edir", ("mod", ("round", ("dir",)), 360)),
        (
            "set",
            cloud_name,
            (
                "round",
                (
                    "add",
                    ("mul", ("var", "ex"), PLAYER_PACKET_X),
                    (
                        "add",
                        ("mul", ("var", "ey"), PLAYER_PACKET_Y),
                        (
                            "add",
                            ("mul", ("var", "edir"), PLAYER_PACKET_DIR),
                            ("add", ("mul", ("var", "hp"), 100), ("var", "deaths")),
                        ),
                    ),
                ),
            ),
        ),
    ]


def _encode_bullet_body(cloud_name):
    return [
        ("set", "ex", ("add", ("round", ("xpos",)), OFFSET)),
        ("set", "ey", ("add", ("round", ("ypos",)), OFFSET)),
        ("set", "edir", ("mod", ("round", ("dir",)), 360)),
        (
            "set",
            cloud_name,
            (
                "round",
                (
                    "add",
                    ("mul", ("var", "edir"), BULLET_PACKET_DIR),
                    (
                        "add",
                        ("mul", ("var", "ey"), BULLET_PACKET_Y),
                        ("add", ("mul", ("var", "ex"), BULLET_PACKET_X), ("var", "shots")),
                    ),
                ),
            ),
        ),
    ]


def _decode_bullet_body():
    packet = ("var", "패킷")
    return [
        ("set", "탄번호", ("mod", packet, 100)),
        (
            "set",
            "시작x",
            ("sub", ("mod", ("floor", ("div", packet, BULLET_PACKET_X)), 1000), OFFSET),
        ),
        (
            "set",
            "시작y",
            ("sub", ("mod", ("floor", ("div", packet, BULLET_PACKET_Y)), 1000), OFFSET),
        ),
        ("set", "시작방향", ("mod", ("floor", ("div", packet, BULLET_PACKET_DIR)), 1000)),
    ]


def _reset_player(role):
    x, y, facing = SPAWN[role]
    return [
        ("set", "hp", HP),
        ("set", "deaths", 0),
        ("set", "cool", 0),
        ("set", "respawn", 0),
        ("set", "invuln", INVULN_FRAMES),
        ("set", "shots", 0),
        ("goto", x, y),
        ("point", facing),
        ("ghost", 0),
        ("size", 60),
        ("show",),
    ]


def _move_axis(axis, amount_var):
    change = "changex" if axis == "x" else "changey"
    undo = ("mul", ("var", amount_var), -1)
    position = (("xpos",), ("ypos",), PLAYER_RADIUS)
    return [
        (change, ("var", amount_var)),
        ("call", "벽 %s %s %s", list(position)),
        ("if", ("eq", ("var", "막힘"), 1), [(change, undo)]),
    ]


def _local_player(role, enemy_room, shot, enemy_bullet):
    alive = _all(
        ("gt", ("var", "hp"), 0),
        ("lt", ("var", "deaths"), WIN_KILLS),
        ("lt", ("var", "내 점수"), WIN_KILLS),
    )
    enemy_on, enemy_fresh, enemy_x, enemy_y = enemy_bullet
    movement = [
        ("set", "dx", 0),
        ("set", "dy", 0),
        ("if", _any(("key", "a"), ("key", "left arrow")), [("set", "dx", -SPEED)]),
        ("if", _any(("key", "d"), ("key", "right arrow")), [("change", "dx", SPEED)]),
        ("if", _any(("key", "w"), ("key", "up arrow")), [("set", "dy", SPEED)]),
        ("if", _any(("key", "s"), ("key", "down arrow")), [("change", "dy", -SPEED)]),
        *_move_axis("x", "dx"),
        *_move_axis("y", "dy"),
        ("aim",),
        ("if", ("gt", ("var", "cool"), 0), [("change", "cool", -1)]),
        (
            "if",
            _all(("key", "space"), ("eq", ("var", "cool"), 0), ("eq", ("var", "invuln"), 0)),
            [
                ("change", "shots", 1),
                ("if", ("gt", ("var", "shots"), 99), [("set", "shots", 1)]),
                ("set", "cool", COOLDOWN),
                ("set", shot, ("var", "shots")),
                ("set", f"{shot}x", ("xpos",)),
                ("set", f"{shot}y", ("ypos",)),
                ("set", f"{shot}방향", ("dir",)),
                ("call", "탄포장", []),
                ("play", "shoot"),
            ],
        ),
        (
            "if",
            _all(
                ("eq", ("var", enemy_on), 1),
                ("eq", ("var", enemy_fresh), 1),
                ("eq", ("var", "invuln"), 0),
            ),
            [
                ("set", "dx", ("sub", ("xpos",), ("var", enemy_x))),
                ("set", "dy", ("sub", ("ypos",), ("var", enemy_y))),
                (
                    "if",
                    (
                        "lt",
                        (
                            "add",
                            ("mul", ("var", "dx"), ("var", "dx")),
                            ("mul", ("var", "dy"), ("var", "dy")),
                        ),
                        HIT_RADIUS_SQ,
                    ),
                    [
                        ("set", enemy_fresh, 0),
                        ("set", "hp", ("sub", ("var", "hp"), DAMAGE)),
                        ("play", "hit"),
                        (
                            "if",
                            ("lt", ("var", "hp"), 1),
                            [
                                ("set", "hp", 0),
                                ("change", "deaths", 1),
                                ("set", "respawn", RESPAWN_FRAMES),
                            ],
                        ),
                    ],
                ),
            ],
        ),
    ]
    status = (
        "ifelse",
        _at_least(("var", "deaths"), WIN_KILLS),
        [("set", "상태", "패배")],
        [
            (
                "ifelse",
                _at_least(("var", "내 점수"), WIN_KILLS),
                [("set", "상태", "승리")],
                [
                    (
                        "ifelse",
                        ("eq", ("var", enemy_room), ("var", "방번호")),
                        [
                            (
                                "ifelse",
                                ("gt", ("var", "hp"), 0),
                                [("set", "상태", "전투 중")],
                                [("set", "상태", "쓰러짐")],
                            )
                        ],
                        [("set", "상태", "상대 대기")],
                    )
                ],
            )
        ],
    )
    return [
        (
            "if",
            ("gt", ("var", "respawn"), 0),
            [
                ("change", "respawn", -1),
                (
                    "if",
                    _all(
                        ("eq", ("var", "respawn"), 0),
                        ("lt", ("var", "deaths"), WIN_KILLS),
                        ("lt", ("var", "내 점수"), WIN_KILLS),
                    ),
                    [
                        ("set", "hp", HP),
                        ("set", "invuln", INVULN_FRAMES),
                        ("goto", SPAWN[role][0], SPAWN[role][1]),
                        ("point", SPAWN[role][2]),
                    ],
                ),
            ],
        ),
        (
            "if",
            alive,
            [
                (
                    "ifelse",
                    ("gt", ("var", "invuln"), 0),
                    [("change", "invuln", -1), ("ghost", 55)],
                    [("ghost", 0)],
                ),
                *movement,
            ],
        ),
        ("if", ("eq", ("var", "hp"), 0), [("ghost", 80)]),
        ("set", "내 체력", ("var", "hp")),
        ("set", "상대 점수", ("var", "deaths")),
        status,
    ]


def _remote_player(enemy_room, enemy_state):
    return [
        (
            "if",
            _all(
                ("gt", ("var", "역할"), 0),
                ("gt", ("var", "방번호"), 0),
                ("eq", ("var", enemy_room), ("var", "방번호")),
                ("gt", ("var", enemy_state), 0),
            ),
            [
                ("set", "패킷", ("var", enemy_state)),
                ("call", "해석", []),
                (
                    "setx",
                    ("add", ("xpos",), ("mul", ("sub", ("var", "rx"), ("xpos",)), 0.5)),
                ),
                (
                    "sety",
                    ("add", ("ypos",), ("mul", ("sub", ("var", "ry"), ("ypos",)), 0.5)),
                ),
                ("point", ("var", "rdir")),
                ("set", "상대 체력", ("var", "rhp")),
                ("set", "내 점수", ("var", "rdeaths")),
                (
                    "ifelse",
                    ("eq", ("var", "rhp"), 0),
                    [("ghost", 80)],
                    [("ghost", 0)],
                ),
            ],
        )
    ]


def _add_player(project, stage, sounds, casts, role, costume):
    name = "시안" if role == 1 else "주황"
    other = 2 if role == 1 else 1
    sprite = Target(project, name)
    sprite.layer = 3 + role
    sprite.x, sprite.y, sprite.direction = SPAWN[role]
    sprite.size = 60
    sprite.costumes.append(costume)
    sprite.sounds.extend(sounds)
    for local in ("hp", "deaths", "cool", "respawn", "invuln", "shots"):
        sprite.var(local, HP if local == "hp" else 0)
    my_state = f"p{role}"
    my_bullet = f"b{role}"
    enemy_room = f"p{other}room"
    shot = f"발사{role}"
    enemy_bullet = (f"탄{other}on", f"탄{other}fresh", f"탄{other}x", f"탄{other}y")
    sprite.proc("벽 %s %s %s", ["x", "y", "r"], _wall_body())
    sprite.proc("해석", [], _decode_player_body())
    sprite.proc("올리기", [], _encode_player_body(my_state))
    sprite.proc("탄포장", [], _encode_bullet_body(my_bullet))
    reset = _reset_player(role)
    control = (
        "ifelse",
        ("eq", ("var", "역할"), role),
        _local_player(role, enemy_room, shot, enemy_bullet),
        _remote_player(f"p{role}room", my_state),
    )
    sprite.hat("event_whenflagclicked", reset + [("forever", [control])])
    sprite.hat(
        "event_whenbroadcastreceived",
        reset,
        fields={"BROADCAST_OPTION": [casts["리셋"][0], casts["리셋"][1]]},
    )
    sprite.hat(
        "event_whenflagclicked",
        [
            (
                "forever",
                [
                    (
                        "if",
                        _all(
                            ("eq", ("var", "역할"), role),
                            ("eq", ("mod", ("var", "틱"), 3), 0),
                        ),
                        [("call", "올리기", [])],
                    )
                ],
            )
        ],
    )
    project.targets.append(sprite.export())
    return sprite


def _start_bullet(sprite, x, y, facing, shot_id, live_prefix):
    return [
        ("set", "seen", shot_id),
        ("set", "simx", x),
        ("set", "simy", y),
        ("set", "simdir", facing),
        ("set", "life", BULLET_LIFE),
        ("set", f"{live_prefix}fresh", 1),
        ("set", f"{live_prefix}on", 1),
        ("show",),
    ]


def _add_bullet(project, sounds, casts, role):
    other_check_role = role
    sprite = Target(project, f"탄환{role}")
    sprite.layer = role
    sprite.visible = False
    sprite.costumes.append(project.add_svg(f"bullet{role}", _svg_bullet(), (10, 10)))
    sprite.sounds.append(sounds[0])
    for local, value in (("life", 0), ("seen", 0), ("simx", 0), ("simy", 0), ("simdir", 90)):
        sprite.var(local, value)
    live = f"탄{role}"
    shot = f"발사{role}"
    room = f"p{role}room"
    cloud_bullet = f"b{role}"
    sprite.proc("벽 %s %s %s", ["x", "y", "r"], _wall_body())
    sprite.proc("탄해석", [], _decode_bullet_body())
    local_start = _start_bullet(
        sprite,
        ("var", f"{shot}x"),
        ("var", f"{shot}y"),
        ("var", f"{shot}방향"),
        ("var", shot),
        live,
    )
    remote_start = _start_bullet(
        sprite,
        ("var", "시작x"),
        ("var", "시작y"),
        ("var", "시작방향"),
        ("var", "탄번호"),
        live,
    )
    step = [
        (
            "ifelse",
            ("eq", ("var", "역할"), other_check_role),
            [
                (
                    "if",
                    _all(("gt", ("var", shot), 0), ("not", ("eq", ("var", shot), ("var", "seen")))),
                    local_start,
                )
            ],
            [
                (
                    "if",
                    _all(
                        ("gt", ("var", "방번호"), 0),
                        ("eq", ("var", room), ("var", "방번호")),
                        ("gt", ("var", cloud_bullet), 0),
                    ),
                    [
                        ("set", "패킷", ("var", cloud_bullet)),
                        ("call", "탄해석", []),
                        (
                            "if",
                            ("not", ("eq", ("var", "탄번호"), ("var", "seen"))),
                            remote_start,
                        ),
                    ],
                )
            ],
        ),
        (
            "if",
            ("gt", ("var", "life"), 0),
            [
                (
                    "set",
                    "simx",
                    ("add", ("var", "simx"), ("mul", ("sin", ("var", "simdir")), BULLET_SPEED)),
                ),
                (
                    "set",
                    "simy",
                    ("add", ("var", "simy"), ("mul", ("cos", ("var", "simdir")), BULLET_SPEED)),
                ),
                ("goto", ("var", "simx"), ("var", "simy")),
                ("point", ("var", "simdir")),
                ("change", "life", -1),
                ("call", "벽 %s %s %s", [("var", "simx"), ("var", "simy"), BULLET_RADIUS]),
                (
                    "ifelse",
                    _any(("eq", ("var", "막힘"), 1), ("lt", ("var", "life"), 1)),
                    [
                        ("set", "life", 0),
                        ("set", f"{live}on", 0),
                        ("set", f"{live}fresh", 0),
                        ("hide",),
                    ],
                    [
                        ("set", f"{live}x", ("var", "simx")),
                        ("set", f"{live}y", ("var", "simy")),
                        ("set", f"{live}on", 1),
                        ("show",),
                    ],
                ),
            ],
        ),
    ]
    sprite.hat(
        "event_whenflagclicked",
        [
            ("set", "life", 0),
            ("set", "seen", ("var", shot)),
            ("hide",),
            ("forever", step),
        ],
    )
    sprite.hat(
        "event_whenbroadcastreceived",
        [
            ("set", "life", 0),
            ("set", "seen", 0),
            ("set", f"{live}on", 0),
            ("set", f"{live}fresh", 0),
            ("hide",),
        ],
        fields={"BROADCAST_OPTION": [casts["리셋"][0], casts["리셋"][1]]},
    )
    project.targets.append(sprite.export())


def _add_button(project, costume, name, label, x, y, layer, cast):
    sprite = Target(project, name)
    sprite.layer = layer
    sprite.x = x
    sprite.y = y
    sprite.rotation = "don't rotate"
    sprite.costumes.append(costume)
    sprite.hat(
        "event_whenflagclicked",
        [("goto", x, y), ("size", 90), ("say", label)],
    )
    sprite.hat("event_whenthisspriteclicked", [("broadcast", cast)])
    project.targets.append(sprite.export())


def _key_lock(stage, key, cast):
    stage.hat(
        "event_whenkeypressed",
        [
            (
                "if",
                ("eq", ("var", "잠금"), 0),
                [
                    ("set", "잠금", 1),
                    ("broadcast", cast),
                    ("waituntil", ("not", ("key", key))),
                    ("set", "잠금", 0),
                ],
            )
        ],
        fields={"KEY_OPTION": [key, None]},
    )


def build():
    project = Project()
    stage = Target(project, "Stage", is_stage=True)
    project.stage = stage
    stage.layer = 0
    stage.costumes.append(project.add_svg("arena", _svg_backdrop(), (240, 180)))
    shoot = project.add_wav("shoot", _tone(660, 70, 0.28) + _tone(420, 50, 0.16))
    hit = project.add_wav("hit", _tone(180, 120, 0.4))
    for name, value in (
        ("역할", 0),
        ("방번호", 0),
        ("상태", "깃발을 누른 뒤 아래 버튼을 누르세요"),
        ("내 체력", HP),
        ("상대 체력", HP),
        ("내 점수", 0),
        ("상대 점수", 0),
        ("잠금", 0),
        ("틱", 0),
        ("막힘", 0),
        ("패킷", 0),
        ("rx", 0),
        ("ry", 0),
        ("rdir", 90),
        ("rhp", HP),
        ("rdeaths", 0),
        ("ex", 0),
        ("ey", 0),
        ("edir", 90),
        ("dx", 0),
        ("dy", 0),
        ("탄번호", 0),
        ("시작x", 0),
        ("시작y", 0),
        ("시작방향", 90),
    ):
        stage.var(name, value)
    for role in (1, 2):
        stage.var(f"발사{role}", 0)
        stage.var(f"발사{role}x", 0)
        stage.var(f"발사{role}y", 0)
        stage.var(f"발사{role}방향", 90)
        stage.var(f"탄{role}x", 0)
        stage.var(f"탄{role}y", 0)
        stage.var(f"탄{role}on", 0)
        stage.var(f"탄{role}fresh", 0)
    cloud_names = ("p1room", "p2room", "p1", "p2", "b1", "b2")
    for name in cloud_names:
        stage.var(name, 0, cloud=True)
    casts = {
        "호스트": ("호스트", stage.broadcast("호스트")),
        "참가": ("참가", stage.broadcast("참가")),
        "나가기": ("나가기", stage.broadcast("나가기")),
        "리셋": ("리셋", stage.broadcast("리셋")),
    }
    p1_packet = pack_player(*SPAWN[1], HP, 0)
    p2_packet = pack_player(*SPAWN[2], HP, 0)
    stage.comments[project.uid("m")] = {
        "blockId": None,
        "x": 20,
        "y": 20,
        "width": 360,
        "height": 220,
        "minimized": False,
        "text": (
            "클라우드 아레나\n"
            "1. 초록 깃발을 누릅니다.\n"
            "2. 한 명은 초록 버튼(또는 1 키)으로 방을 만듭니다.\n"
            "3. 다른 사람은 파랑 버튼(또는 2 키)으로 같은 방 번호를 입력합니다.\n"
            "4. WASD 또는 방향키로 이동, 마우스로 조준, 스페이스로 발사합니다.\n"
            "5. 3발을 맞으면 쓰러지고, 먼저 5킬을 하면 이깁니다.\n\n"
            "클라우드 변수는 scratch.mit.edu에서 스크래처로 로그인한 뒤에만 연결됩니다. "
            "파일만 열면 온라인 대전은 되지 않습니다. 프로젝트 전체에서 방은 하나뿐입니다."
        ),
    }
    stage.hat(
        "event_whenflagclicked",
        [
            ("set", "역할", 0),
            ("set", "방번호", 0),
            ("set", "잠금", 0),
            ("set", "틱", 0),
            ("set", "내 체력", HP),
            ("set", "상대 체력", HP),
            ("set", "내 점수", 0),
            ("set", "상대 점수", 0),
            ("set", "발사1", 0),
            ("set", "발사2", 0),
            ("set", "탄1on", 0),
            ("set", "탄1fresh", 0),
            ("set", "탄2on", 0),
            ("set", "탄2fresh", 0),
            ("set", "상태", "깃발을 누른 뒤 아래 버튼을 누르세요"),
            ("forever", [("change", "틱", 1)]),
        ],
    )
    stage.hat(
        "event_whenbroadcastreceived",
        [
            ("set", "역할", 1),
            ("set", "방번호", ("random", 100, 999)),
            ("set", "p1room", ("var", "방번호")),
            ("set", "b1", 0),
            ("set", "p1", p1_packet),
            ("set", "발사1", 0),
            ("broadcast", casts["리셋"]),
            ("set", "상태", ("join", "방 ", ("var", "방번호"))),
        ],
        fields={"BROADCAST_OPTION": [casts["호스트"][0], casts["호스트"][1]]},
    )
    stage.hat(
        "event_whenbroadcastreceived",
        [
            ("ask", "방 번호를 입력하세요"),
            ("set", "방번호", ("add", ("answer",), 0)),
            (
                "ifelse",
                _all(("gt", ("var", "방번호"), 99), ("lt", ("var", "방번호"), 1000)),
                [
                    ("set", "역할", 2),
                    ("set", "p2room", ("var", "방번호")),
                    ("set", "b2", 0),
                    ("set", "p2", p2_packet),
                    ("set", "발사2", 0),
                    ("broadcast", casts["리셋"]),
                    ("set", "상태", ("join", "참가 ", ("var", "방번호"))),
                ],
                [("set", "상태", "방 번호는 100부터 999")],
            ),
        ],
        fields={"BROADCAST_OPTION": [casts["참가"][0], casts["참가"][1]]},
    )
    stage.hat(
        "event_whenbroadcastreceived",
        [
            ("if", ("eq", ("var", "역할"), 1), [("set", "p1room", 0)]),
            ("if", ("eq", ("var", "역할"), 2), [("set", "p2room", 0)]),
            ("set", "역할", 0),
            ("set", "방번호", 0),
            ("set", "상태", "나갔습니다"),
            ("broadcast", casts["리셋"]),
        ],
        fields={"BROADCAST_OPTION": [casts["나가기"][0], casts["나가기"][1]]},
    )
    _key_lock(stage, "1", casts["호스트"])
    _key_lock(stage, "2", casts["참가"])
    _key_lock(stage, "0", casts["나가기"])
    project.monitor(stage.var_ids["방번호"], "방번호", 8, 6)
    project.monitor(stage.var_ids["상태"], "상태", 150, 6)
    project.monitor(stage.var_ids["내 체력"], "내 체력", 8, 34)
    project.monitor(stage.var_ids["내 점수"], "내 점수", 8, 60)
    project.monitor(stage.var_ids["상대 체력"], "상대 체력", 330, 34)
    project.monitor(stage.var_ids["상대 점수"], "상대 점수", 330, 60)
    project.targets.append(stage.export())

    cyan = project.add_svg("cyan", _svg_player("#2ee6d6", "#e8fffb"), (32, 38))
    orange = project.add_svg("orange", _svg_player("#ff8a3d", "#fff1e4"), (32, 38))
    _add_bullet(project, (shoot,), casts, 1)
    _add_bullet(project, (shoot,), casts, 2)
    _add_player(project, stage, (shoot, hit), casts, 1, cyan)
    _add_player(project, stage, (shoot, hit), casts, 2, orange)
    buttons = (
        ("방만들기", "방 만들기", -145, -158, 6, "#3dd68c", "호스트"),
        ("참가버튼", "참가", 0, -158, 7, "#4aa3ff", "참가"),
        ("나가기버튼", "나가기", 145, -158, 8, "#ff5d6c", "나가기"),
    )
    for name, label, x, y, layer, color, cast_name in buttons:
        costume = project.add_svg(name, _svg_button(color), (66, 21))
        _add_button(project, costume, name, label, x, y, layer, casts[cast_name])
    guide = Target(project, "안내")
    guide.layer = 5
    guide.x = 0
    guide.y = 145
    guide.rotation = "don't rotate"
    guide.costumes.append(project.add_svg("guide", _svg_guide(), (14, 14)))
    guide.hat(
        "event_whenflagclicked",
        [
            ("goto", 0, 145),
            ("size", 70),
            (
                "sayfor",
                "초록 방 만들기, 파랑 참가, 빨강 나가기. WASD 이동, 마우스 조준, 스페이스 발사. 5킬이면 승리",
                8,
            ),
        ],
    )
    project.targets.append(guide.export())
    return project


def _validate_links(project):
    for target in project.targets:
        blocks = target["blocks"]
        for block_id, block in blocks.items():
            if not isinstance(block, dict):
                continue
            for slot in ("next", "parent"):
                other = block[slot]
                if other is not None and other not in blocks:
                    raise AssertionError(f"{target['name']} {block_id} {slot} missing {other}")
            for spec in block["inputs"].values():
                for item in spec[1:]:
                    if isinstance(item, str) and item not in blocks:
                        raise AssertionError(f"{target['name']} input missing {item}")
        for block in blocks.values():
            if not isinstance(block, dict):
                continue
            if block["opcode"] != "procedures_call":
                continue
            code = block["mutation"]["proccode"]
            found = False
            for other in blocks.values():
                if (
                    isinstance(other, dict)
                    and other["opcode"] == "procedures_prototype"
                    and other["mutation"]["proccode"] == code
                ):
                    found = True
            if not found:
                raise AssertionError(f"{target['name']} missing procedure {code}")


def self_check():
    for role, (x, y, facing) in SPAWN.items():
        if blocked(x, y, PLAYER_RADIUS):
            raise AssertionError(f"spawn {role} is inside a wall")
        packed = pack_player(x, y, facing, HP, 0)
        if unpack_player(packed) != (x, y, facing % 360, HP, 0):
            raise AssertionError(f"player packet mismatch {packed} {unpack_player(packed)}")
    bullet = pack_bullet(-40, 25, 270, 7)
    if unpack_bullet(bullet) != (-40, 25, 270, 7):
        raise AssertionError(unpack_bullet(bullet))
    if len(str(pack_player(200, 120, 359, 99, 99))) > 15:
        raise AssertionError("player packet is outside the safe integer range")


def main():
    self_check()
    project = build()
    _validate_links(project)
    clouds = []
    for target in project.targets:
        if not target["isStage"]:
            continue
        for record in target["variables"].values():
            if len(record) == 3 and record[2] is True:
                clouds.append(record[0])
    if clouds != ["p1room", "p2room", "p1", "p2", "b1", "b2"]:
        raise AssertionError(clouds)
    out = Path(__file__).with_name("cloud-arena.sb3")
    project.save(out)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
