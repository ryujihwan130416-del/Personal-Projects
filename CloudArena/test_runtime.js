const fs = require("fs");
const path = require("path");
const VirtualMachine = require("scratch-vm");

function FakeRenderer() {
  this._nextSkinId = 0;
  this.spriteCount = 20;
  this.order = 0;
  return new Proxy(this, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return function () {
        return 0;
      };
    },
  });
}

FakeRenderer.prototype.createSVGSkin = function () {
  return this._nextSkinId++;
};
FakeRenderer.prototype.createBitmapSkin = function () {
  return this._nextSkinId++;
};
FakeRenderer.prototype.getSkinSize = function () {
  return [64, 64];
};
FakeRenderer.prototype.getSkinRotationCenter = function () {
  return [32, 32];
};
FakeRenderer.prototype.createDrawable = function () {
  return this._nextSkinId++;
};
FakeRenderer.prototype.getFencedPositionOfDrawable = function (_drawable, position) {
  return position;
};
FakeRenderer.prototype.updateDrawableSkinId = function () {};
FakeRenderer.prototype.updateDrawablePosition = function () {};
FakeRenderer.prototype.updateDrawableDirectionScale = function () {};
FakeRenderer.prototype.updateDrawableVisible = function () {};
FakeRenderer.prototype.updateDrawableEffect = function () {};
FakeRenderer.prototype.getCurrentSkinSize = function () {
  return [64, 64];
};
FakeRenderer.prototype.pick = function () {
  return null;
};
FakeRenderer.prototype.drawableTouching = function () {
  return false;
};
FakeRenderer.prototype.isTouchingColor = function () {
  return false;
};
FakeRenderer.prototype.getBounds = function () {
  return { left: 0, right: 0, top: 0, bottom: 0 };
};
FakeRenderer.prototype.setDrawableOrder = function () {
  return 1;
};
FakeRenderer.prototype.setLayerGroupOrdering = function () {};
FakeRenderer.prototype.getDrawableOrder = function () {
  return 1;
};
FakeRenderer.prototype.penClear = function () {};
FakeRenderer.prototype.penLine = function () {};
FakeRenderer.prototype.penPoint = function () {};
FakeRenderer.prototype.setPenColor = function () {};

const OFFSET = 250;
const PLAYER_PACKET_X = 10000000000;
const PLAYER_PACKET_Y = 10000000;
const PLAYER_PACKET_DIR = 10000;

function unpackPlayer(value) {
  value = Math.round(Number(value));
  const deaths = value % 100;
  const hp = Math.floor(value / 100) % 100;
  const facing = Math.floor(value / PLAYER_PACKET_DIR) % 1000;
  const encY = Math.floor(value / PLAYER_PACKET_Y) % 1000;
  const encX = Math.floor(value / PLAYER_PACKET_X) % 1000;
  return {
    x: encX - OFFSET,
    y: encY - OFFSET,
    facing,
    hp,
    deaths,
  };
}

function packPlayer(x, y, facing, hp, deaths) {
  const encX = Math.round(x) + OFFSET;
  const encY = Math.round(y) + OFFSET;
  const dir = ((Math.round(facing) % 360) + 360) % 360;
  return (
    encX * PLAYER_PACKET_X +
    encY * PLAYER_PACKET_Y +
    dir * PLAYER_PACKET_DIR +
    hp * 100 +
    deaths
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function targetNamed(vm, name) {
  return vm.runtime.targets.find((target) => target.sprite.name === name);
}

function readVar(target, name) {
  const variable = target.lookupVariableByNameAndType(name, "");
  if (!variable) {
    throw new Error(`missing variable ${name} on ${target.sprite.name}`);
  }
  return variable;
}

function step(vm, frames) {
  vm.runtime.currentStepTime = 1000 / 30;
  for (let index = 0; index < frames; index += 1) {
    vm.runtime._step();
  }
}

function press(vm, key, isDown) {
  vm.runtime.ioDevices.keyboard.postData({ key, isDown });
}

function aim(vm, scratchX, scratchY) {
  const canvasWidth = 480;
  const canvasHeight = 360;
  const x = (scratchX / canvasWidth + 0.5) * canvasWidth;
  const y = (0.5 - scratchY / canvasHeight) * canvasHeight;
  vm.runtime.ioDevices.mouse.postData({
    x,
    y,
    canvasWidth,
    canvasHeight,
    isDown: false,
  });
}

async function main() {
  const vm = new VirtualMachine();
  vm.attachRenderer(new FakeRenderer());
  const project = fs.readFileSync(path.join(__dirname, "cloud-arena.sb3"));
  await vm.loadProject(project);

  const stage = vm.runtime.getTargetForStage();
  const cloudNames = Object.values(stage.variables)
    .filter((variable) => variable.isCloud)
    .map((variable) => variable.name);
  assert(
    cloudNames.slice().sort().join(",") === "b1,b2,p1,p1room,p2,p2room",
    `cloud variables: ${cloudNames.join(",")}`
  );

  const cyan = targetNamed(vm, "시안");
  const orange = targetNamed(vm, "주황");
  const bullet = targetNamed(vm, "탄환1");
  vm.greenFlag();
  aim(vm, 200, 0);
  step(vm, 5);
  assert(Number(readVar(stage, "역할").value) === 0, "flag should clear the role");

  vm.runtime.startHats("event_whenbroadcastreceived", {
    BROADCAST_OPTION: "호스트",
  });
  step(vm, 5);
  const room = Number(readVar(stage, "방번호").value);
  assert(room >= 100 && room <= 999, `room out of range: ${room}`);
  assert(Number(readVar(stage, "역할").value) === 1, "host role was not set");
  assert(Number(readVar(stage, "p1room").value) === room, "host did not publish the room");
  const spawned = unpackPlayer(readVar(stage, "p1").value);
  assert(Math.abs(spawned.x + 170) < 1, `spawn packet x ${spawned.x}`);
  assert(spawned.hp === 99, `spawn packet hp ${spawned.hp}`);

  press(vm, "d", true);
  step(vm, 20);
  press(vm, "d", false);
  assert(cyan.x > -160, `cyan did not move right: ${cyan.x}`);
  step(vm, 6);
  const moved = unpackPlayer(readVar(stage, "p1").value);
  assert(Math.abs(moved.x - cyan.x) <= 8, `cloud x ${moved.x} sprite x ${cyan.x}`);
  assert(moved.hp === 99, `uploaded hp ${moved.hp}`);

  step(vm, 20);
  aim(vm, 200, cyan.y);
  const shotsBefore = Number(readVar(cyan, "shots").value);
  press(vm, " ", true);
  step(vm, 3);
  press(vm, " ", false);
  step(vm, 4);
  assert(Number(readVar(cyan, "shots").value) === shotsBefore + 1, "shot counter did not advance");
  assert(Number(readVar(stage, "b1").value) > 0, "bullet cloud packet was not written");
  assert(bullet.visible, `local bullet stayed hidden at ${bullet.x},${bullet.y} player ${cyan.x},${cyan.y}`);
  assert(bullet.x > cyan.x, `bullet did not travel right: ${bullet.x} vs ${cyan.x}`);

  press(vm, "d", true);
  step(vm, 80);
  press(vm, "d", false);
  assert(cyan.x < -30 && cyan.x > -80, `center wall did not stop cyan: ${cyan.x}`);

  const clearFrames = 40;
  step(vm, clearFrames);
  const hpBefore = Number(readVar(cyan, "hp").value);
  readVar(stage, "탄2x").value = cyan.x;
  readVar(stage, "탄2y").value = cyan.y;
  readVar(stage, "탄2on").value = 1;
  readVar(stage, "탄2fresh").value = 1;
  step(vm, 1);
  const hpAfter = Number(readVar(cyan, "hp").value);
  assert(hpAfter === hpBefore - 33, `damage ${hpBefore} -> ${hpAfter}`);

  const guestX = 40;
  const guestY = -20;
  readVar(stage, "역할").value = 2;
  readVar(stage, "방번호").value = room;
  readVar(stage, "p1room").value = room;
  readVar(stage, "p1").value = packPlayer(guestX, guestY, 0, 66, 4);
  step(vm, 20);
  assert(Math.abs(cyan.x - guestX) < 2, `remote cyan x ${cyan.x}`);
  assert(Math.abs(cyan.y - guestY) < 2, `remote cyan y ${cyan.y}`);
  assert(Number(readVar(stage, "상대 체력").value) === 66, "remote hp was not shown");
  assert(Number(readVar(stage, "내 점수").value) === 4, "remote deaths were not shown as my score");

  vm.runtime.startHats("event_whenbroadcastreceived", {
    BROADCAST_OPTION: "나가기",
  });
  step(vm, 3);
  assert(Number(readVar(stage, "역할").value) === 0, "leave did not clear the role");
  assert(Number(readVar(stage, "p2room").value) === 0, "leave did not clear the guest room");
  assert(orange.x === 170, `orange was moved while leaving: ${orange.x}`);

  console.log("cloud arena runtime checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
