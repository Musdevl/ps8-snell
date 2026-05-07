import { COLORS } from "../enum/Colors.js";

export const TUTORIAL_STEPS = [

    // === WELCOME ===
    {
        message: "Welcome to Snell !\n I'm Coach Bae and I will try to make you learn the basics rules and tricks of this game.\nReady ? Let's start by click on the next button below !",
        highlight: null,
        expectedAction: "NONE",
        blocking: false,
        advanceState: false
    },

    // === PIECES PRESENTATION ===
    // === WELCOME ===
    {
        message: "Basics\n In this game, your goal is simple: destroy your opponent's King with your laser before they destroy yours.",
        highlight: null,
        expectedAction: "NONE",
        blocking: false,
        advanceState: false
    },
    {
        message: "Basics\n Let's meet your pieces. \nFirst: the Shooter. It fires a laser at the end of every turn. It cannot move but only rotate. It is completely indestructible.",
        highlight: { type: "piece", piece: "shooter", color: "white" },
        expectedAction: "NONE",
        blocking: false,
    },
    {
        message: "Basics\n This is the King. The most important piece on the board. If the laser touches it, you lose. It cannot move, so you must protect it at all costs.",
        highlight: { type: "piece", piece: "king", color: "white" },
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Basics\n This is a Protector. One of its faces is a shield that blocks the laser. The other 3 faces are vulnerable. Place it wisely to protect your King.",
        highlight: { type: "piece", piece: "protector", color: "white" },
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Basics\n This is the Full Mirror. It has a double diagonal mirror, so it reflects the laser on all 4 sides. It can never be destroyed by the laser. It can also swap positions with your Shooter or your King.",
        highlight: { type: "piece", piece: "full_mirror", color: "white" },
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Basics\n Finally, the Triangle. This is your main offensive tool. It has a single diagonal mirror: 2 faces reflect the laser, 2 faces will destroy it if hit. Master its orientation and you master the game.",
        highlight: { type: "piece", piece: "triangle", color: "white" },
        expectedAction: "NONE",
        blocking: false
    },

    // === SHOULDER BAG ===
    {
        message: "Basics\n This is your shoulder bag : the panel on the right. It holds up to 7 Triangles at the begining. You can place one on the board on your turn.",
        highlight: { type: "panel", side: "right" },
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Basics\n Before placing a Triangle, you can choose its orientation using the rotate arrows at the top of the right panel. The direction matters a lot : it decides where the laser goes.",
        highlight: { type: "panel", side: "right" },
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Basics\n You cannot place a Triangle on a cell that is orthogonally adjacent to your King or any Shooter. Those cells are blocked.",
        highlight: { type: "piece", piece: "king", color: "white" },
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Basics\n When one of your Triangles is destroyed, it goes to your opponent's bag - they can use it one turn later. The same applies in reverse: destroying an opponent's Triangle gives you a free one. Every Triangle lost is a Triangle handed to the enemy.",
        highlight: { type: "panel", side: "right" },
        expectedAction: "NONE",
        blocking: false
    },

    // === RULES ===
    {
        message: "Rules\n Each turn, you must perform exactly one action: rotate a piece, move a piece, place a Triangle from your shoulder bag, or swap your Full Mirror with your Shooter or King.",
        highlight: null,
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Rules\n After your action, your Shooter automatically fires its laser. The beam bounces off mirrors, is blocked by protectors, and destroys everything else it touches.",
        highlight: null,
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Rules\n Triangles, Full Mirrors and the Protectors can move one cell orthogonally (up, down, left, right). The Shooter and the King cannot move at all.",
        highlight: null,
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Rules\n The Full Mirror swap has a cooldown: each swap target (Shooter or King) has its own 4-turn cooldown. Also, if you swap with your Shooter, it will not fire this turn.",
        highlight: { type: "piece", piece: "full_mirror", color: "white" },
        expectedAction: "NONE",
        blocking: false
    },
    {
        message: "Rules\n The game ends when a King is destroyed. If both Kings are hit on the same turn, or if 100 turns pass with no winner, the game is a draw.",
        highlight: null,
        expectedAction: "NONE",
        blocking: false
    },

    // === SIMULATED GAME ===
    {
        message: "Now let's play!\nYou'll learn by doing. Each move will be explained before you make it.",
        highlight: null,
        expectedAction: "NONE",
        blocking: false
    },

    // WHITE: PLACE/08,32
    {
        message: "Turn 1 - White.\n Place a triangle on square b1 of the board. Position it so that its mirror faces upward. This will capture the laser and redirect it upward, toward the opposing team.",
        highlight: null,
        expectedAction: "PLACE/91,0",
        color: COLORS.WHITE,
        blocking: true,
        advanceState: false
    },
    {
        message: "The laser fires ! Look at this beautiful beam.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.WHITE,
        blocking: false,
        advanceState: true
    },

    // WHITE: PLACE/08,32
    {
        message: "Turn 1 - Black.\n Your opponent places a Triangle near to yours. He's building a path to redirect your laser toward your king. Keep an eye on it.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.BLACK,
        blocking: false,
        advanceState: true
    },

    // WHITE: ROTATE/02,48
    {
        message: "Turn 2 - White.\n Your Shooter is currently pointing in a direction that could hit your own pieces. Rotate it to aim safely. Click your Shooter, then use the rotate buttons to rotate it to the right.",
        highlight: { type: "cell", row: 0, col: 2 },
        expectedAction: "ROTATE/97,48",
        color: COLORS.WHITE,
        blocking: true,
        advanceState: false
    },

    // BLACK: PLACE/38,48
    {
        message: "Turn 2 - Black.\n The opponent places another Triangle.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.BLACK,
        blocking: false,
        advanceState: true
    },

    // WHITE: PLACE/32,0
    {
        message: "Turn 3 - White.\n Place a Triangle on the square h4 of the board with its mirror facing down-left. This redirects the laser toward one of Black's Triangles - if it hits a vulnerable face, it will destroy it and the Triangle goes to your shoulder bag.",
        highlight: { type: "cell", row: 3, col: 2 },
        expectedAction: "PLACE/67,32",
        color: COLORS.WHITE,
        blocking: true,
        advanceState: false

    },
    {
        message: "The laser hits Black's Triangle on a vulnerable face. It is destroyed and will appear in your shoulder bag next turn. This is how you gain extra Triangles.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.WHITE,
        blocking: false,
        advanceState: false
    },

    // BLACK: ROTATE/02,16
    {
        message: "Turn 3 - Black.\n The opponent rotates their Shooter to compensate for the Triangle they just lost. They are re-routing their laser. Watch the new path.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.BLACK,
        blocking: false,
        advanceState: false
    },

    // WHITE: SWAP/56,74
    {
        message: "Turn 4 - White.\n Your Full Mirror can swap with your King. This repositions your King to a safer cell and puts the Full Mirror - which is indestructible - in its place. Try it now.",
        highlight: { type: "cell", row: 4, col: 3 },
        expectedAction: "SWAP/56,74",
        color: COLORS.WHITE,
        blocking: true,
        advanceState: false
    },
    {
        message: "The swap is done. Your King is now in a new position and the Full Mirror is where the King was.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.WHITE,
        blocking: false,
        advanceState: false
    },

    // BLACK: PLACE/35,48
    {
        message: "Turn 4 - Black.\n The opponent places a Triangle trying to corner your King. The pressure is building - you'll need to think ahead.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.BLACK,
        blocking: false,
        advanceState: false
    },

    // WHITE: MOVE/45,46
    {
        message: "Turn 5 - White.\n Move your Protector one cell to the left on d5. This small adjustment shifts the laser's bounce point and opens a new angle toward the opponent's King.",
        highlight: { type: "cell", row: 4, col: 5 },
        expectedAction: "MOVE/54,53",
        color: COLORS.WHITE,
        blocking: true,
        advanceState: false
    },
    {
        message: "The laser bounces off your Triangle in a new direction. Moving pieces is often more precise than placing new ones - use it to fine-tune your laser path.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.WHITE,
        blocking: false,
        advanceState: false
    },

    // BLACK: ROTATE/02,48
    {
        message: "Turn 5 - Black.\n The opponent rotates their Shooter again, trying to find a gap in your defenses. Always check where the laser ends up after their turn.",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.BLACK,
        blocking: false,
        advanceState: false
    },

    // WHITE: PLACE/75,48
    {
        message: "Turn 6 - White.\n Place your final Triangle on the e8 square of the board facing bottom-right. This completes the chain - the laser will bounce through your Triangles and hit the opponent's King directly.",
        highlight: { type: "cell", row: 7, col: 5 },
        expectedAction: "PLACE/24,16",
        color: COLORS.WHITE,
        blocking: true,
        advanceState: false
    },

    // === END ===
    {
        message: "The laser reaches the opponent's King. You win! Good luck out there!",
        highlight: null,
        expectedAction: "NONE",
        color: COLORS.WHITE,
        blocking: false,
        advanceState: false
    },
];