import { wood_puzzles } from "../puzzles/wood_puzzles.js";
import { bronze_puzzles } from "../puzzles/bronze_puzzles.js";
import { stone_puzzles } from "../puzzles/stone_puzzles.js";
import { silver_puzzles } from "../puzzles/silver_puzzles.js";
import { crystal_puzzles } from "../puzzles/crystal_puzzles.js";
import { elite_puzzles } from "../puzzles/elite_puzzles.js";
import { champion_puzzles } from "../puzzles/champion_puzzles.js";
import { legend_puzzles } from "../puzzles/legend_puzzles.js";

const all_puzzles = [...wood_puzzles,
...stone_puzzles,
...bronze_puzzles,
...silver_puzzles,
...crystal_puzzles,
...elite_puzzles,
...champion_puzzles,
...legend_puzzles]

export function get_puzzle_list_items() {
    return all_puzzles.map(p => p = { id: p.id, name: p.name, difficulty: p.difficulty })
}

export function findPuzzleById(puzzleId) {
    return all_puzzles.find(p => p.id === Number(puzzleId));
}