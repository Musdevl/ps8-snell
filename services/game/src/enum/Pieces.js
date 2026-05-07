export const PIECE = {
    NONE:0,
    TRIANGLE:1,
    FULL_MIRROR:2,
    SHOOTER:3,
    PROTECTOR:4,
    KING:5,
}

export const MASK = {
    PIECE: 0b00000111,     
    COLOR: 0b00001000,     
    DIRECTION: 0b00110000, 
    COOLDOWN: 0b11000000
}