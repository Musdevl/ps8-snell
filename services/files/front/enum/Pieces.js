export const PIECE = {
    NONE:0,
    TRIANGLE:1,
    FULL_MIRROR:2,
    SHOOTER:3,
    PROTECTOR:4,
    KING:5,
}

export const MASK = {
    PIECE: 0b0000000000000111,     
    COLOR: 0b0000000000001000,     
    DIRECTION: 0b0000000000110000, 
    COOLDOWN: 0b0000000111000000
}

export const PIECE_NAME = {
    1: 'triangle',
    2: 'full_mirror',
    3: 'shooter',
    4: 'protector',
    5: 'king',
    // don't add None
}