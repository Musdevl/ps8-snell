import { easy_puzzles } from "../puzzles/easy_puzzles.js";
import { hard_puzzles } from "../puzzles/hard_puzzles.js";
import { medium_puzzles } from "../puzzles/medium_puzzles.js";

const all_puzzles = [...easy_puzzles, ...medium_puzzles, ...hard_puzzles]

export function get_puzzle_list_items() {
    return all_puzzles.map(p => p = { id: p.id, name: p.name, difficulty: p.difficulty })
}

export function findPuzzleById(puzzleId) {
    return all_puzzles.find(p => p.id === Number(puzzleId));
}