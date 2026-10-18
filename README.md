# Blockbuster Manager

First person video store manager game, built on the SOS (Ludum Dare 59) engine.

Status: engine stripped of the morse gameplay, with a placeholder store (five shelves of mixed-up tapes: three on the back wall and one on each side wall by the back corners, checkout counter, quick drop bin). Move between fixed spots, pick tapes up off any shelf and put them down in any empty slot.

## Run

```
pnpm install
pnpm dev
```

## Controls

- You stand on fixed spots (yellow floor markers) and face one of four directions
- Arrow keys (or WASD) step forward, back, left and right to the next spot; Q / E turn 90 degrees
- Click (or tap) a tape to pick it up; you can carry up to 5
- Click an empty slot to put down the top tape of your stack (the highlighted one in the top-left list)
- The on-screen buttons do the same as the keys
- M cycles sound mode

## Layout

- `src/data/storeLayout.ts`: sizes (metres), shelf positions and the navigation nodes
- `src/levels/store.tsx`: builds the store from that layout (walls, shelves, counter, drop bin, lights)
- `src/entities/store/`: placeholder pieces (`Block`, `Label`, `TapeShelf`)
- `src/data/tapes.ts`: placeholder catalogue of genres and titles
- `src/entities/controller/`: node navigation (`nav.ts`), camera, and pointer/interact raycast. Any object named in `INTERACTABLE_NAMES` with a `userData.label` can be looked at and interacted with.
- `src/stores/gameStore.ts`: zustand state: which tape is in every shelf slot, the carried stack, what the pointer is over, HUD messages

Built with [Koota](https://github.com/pmndrs/koota), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), Vite and TypeScript.
