# Blockbuster Manager

First person video store manager game, built on the SOS (Ludum Dare 59) engine.

Status: engine stripped of the morse gameplay, with a placeholder store (shelves stocked by genre, checkout counter, quick drop bin). Move between fixed spots; point at something to see its label and click (or tap) to interact. Real interactions come next.

## Run

```
pnpm install
pnpm dev
```

## Controls

- You stand on fixed spots (yellow floor markers) and face one of four directions
- Arrow keys (or WASD) step forward, back, left and right to the next spot; Q / E turn 90 degrees
- Point and click (or tap) to interact; the on-screen buttons do the same as the keys
- M cycles sound mode

## Layout

- `src/data/storeLayout.ts`: sizes (metres), shelf positions and the navigation nodes
- `src/levels/store.tsx`: builds the store from that layout (walls, shelves, counter, drop bin, lights)
- `src/entities/store/`: placeholder pieces (`Block`, `Label`, `TapeShelf`)
- `src/data/tapes.ts`: placeholder catalogue of genres and titles
- `src/entities/controller/`: node navigation (`nav.ts`), camera, and pointer/interact raycast. Any object named in `INTERACTABLE_NAMES` with a `userData.label` can be looked at and interacted with.
- `src/stores/gameStore.ts`: zustand state (sound mode, what you're looking at, last interaction)

Built with [Koota](https://github.com/pmndrs/koota), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), Vite and TypeScript.
