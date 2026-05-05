import type { RoomDefinition } from "./types";

const ROOM_WIDTH = 1440;
const ROOM_HEIGHT = 960;

function border(width: number, height: number) {
  return [
    { x: 0, y: 0, width, height: 24 },
    { x: 0, y: height - 24, width, height: 24 },
    { x: 0, y: 0, width: 24, height },
    { x: width - 24, y: 0, width: 24, height }
  ];
}

export const ROOMS: RoomDefinition[] = [
  {
    key: "crossfire",
    name: "Crossfire",
    description: "Expanded lanes, center pressure, quick flanks.",
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    playerStart: { x: 720, y: 480 },
    walls: [
      ...border(ROOM_WIDTH, ROOM_HEIGHT),
      { x: 260, y: 150, width: 214, height: 38 },
      { x: 966, y: 150, width: 214, height: 38 },
      { x: 260, y: 772, width: 214, height: 38 },
      { x: 966, y: 772, width: 214, height: 38 },
      { x: 688, y: 280, width: 64, height: 138 },
      { x: 688, y: 542, width: 64, height: 138 },
      { x: 432, y: 452, width: 180, height: 46 },
      { x: 828, y: 452, width: 180, height: 46 },
      { x: 120, y: 418, width: 52, height: 136 },
      { x: 1268, y: 418, width: 52, height: 136 }
    ],
    barricades: [
      { x: 560, y: 446, width: 96, height: 18 },
      { x: 784, y: 496, width: 96, height: 18 },
      { x: 238, y: 470, width: 98, height: 18 },
      { x: 1104, y: 470, width: 98, height: 18 }
    ],
    barrels: [
      { x: 196, y: 480 },
      { x: 1244, y: 480 },
      { x: 720, y: 170 },
      { x: 720, y: 790 },
      { x: 382, y: 292 },
      { x: 1058, y: 668 }
    ],
    spawns: [
      { x: 88, y: 88 },
      { x: 1352, y: 88 },
      { x: 88, y: 872 },
      { x: 1352, y: 872 },
      { x: 720, y: 72 },
      { x: 720, y: 888 }
    ]
  },
  {
    key: "trenches",
    name: "Trenches",
    description: "Longer lanes, brittle cover, ugly retreats.",
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    playerStart: { x: 720, y: 480 },
    walls: [
      ...border(ROOM_WIDTH, ROOM_HEIGHT),
      { x: 184, y: 136, width: 38, height: 650 },
      { x: 1218, y: 174, width: 38, height: 610 },
      { x: 420, y: 88, width: 38, height: 280 },
      { x: 982, y: 592, width: 38, height: 280 },
      { x: 536, y: 452, width: 368, height: 38 },
      { x: 576, y: 210, width: 258, height: 34 },
      { x: 606, y: 716, width: 258, height: 34 }
    ],
    barricades: [
      { x: 370, y: 604, width: 118, height: 18 },
      { x: 952, y: 336, width: 118, height: 18 },
      { x: 690, y: 154, width: 18, height: 104 },
      { x: 734, y: 702, width: 18, height: 104 }
    ],
    barrels: [
      { x: 330, y: 96 },
      { x: 1110, y: 864 },
      { x: 720, y: 650 },
      { x: 720, y: 310 },
      { x: 300, y: 780 }
    ],
    spawns: [
      { x: 88, y: 480 },
      { x: 1352, y: 480 },
      { x: 720, y: 78 },
      { x: 720, y: 882 },
      { x: 108, y: 112 },
      { x: 1332, y: 848 }
    ]
  },
  {
    key: "boxyard",
    name: "Boxyard",
    description: "Dense blocks, short sightlines, messy retreats.",
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    playerStart: { x: 720, y: 480 },
    walls: [
      ...border(ROOM_WIDTH, ROOM_HEIGHT),
      { x: 190, y: 148, width: 128, height: 128 },
      { x: 1122, y: 148, width: 128, height: 128 },
      { x: 190, y: 684, width: 128, height: 128 },
      { x: 1122, y: 684, width: 128, height: 128 },
      { x: 548, y: 188, width: 344, height: 38 },
      { x: 548, y: 734, width: 344, height: 38 },
      { x: 414, y: 408, width: 94, height: 144 },
      { x: 932, y: 408, width: 94, height: 144 },
      { x: 654, y: 384, width: 132, height: 38 },
      { x: 654, y: 538, width: 132, height: 38 }
    ],
    barricades: [
      { x: 664, y: 350, width: 112, height: 18 },
      { x: 664, y: 592, width: 112, height: 18 },
      { x: 332, y: 446, width: 18, height: 96 },
      { x: 1090, y: 418, width: 18, height: 96 },
      { x: 534, y: 474, width: 92, height: 18 },
      { x: 814, y: 474, width: 92, height: 18 }
    ],
    barrels: [
      { x: 128, y: 480 },
      { x: 1312, y: 480 },
      { x: 720, y: 320 },
      { x: 720, y: 640 },
      { x: 412, y: 240 },
      { x: 1028, y: 720 }
    ],
    spawns: [
      { x: 84, y: 92 },
      { x: 1356, y: 92 },
      { x: 84, y: 868 },
      { x: 1356, y: 868 },
      { x: 720, y: 84 },
      { x: 720, y: 876 },
      { x: 84, y: 480 },
      { x: 1356, y: 480 }
    ]
  }
];

export function getRoom(key: string): RoomDefinition {
  const room = ROOMS.find((candidate) => candidate.key === key);
  if (!room) {
    throw new Error(`Unknown room: ${key}`);
  }
  return room;
}
