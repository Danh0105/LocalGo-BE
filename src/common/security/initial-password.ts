import { randomInt } from 'node:crypto';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALPHABET = `${LETTERS}${DIGITS}`;

export const INITIAL_PASSWORD_LENGTH = 16;

function randomCharacter(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}

/**
 * Generates a CSPRNG-backed password with letters and digits while avoiding
 * visually ambiguous characters. The first two guaranteed characters are
 * shuffled with the rest so their positions do not leak structure.
 */
export function generateInitialPassword(): string {
  const characters = [
    randomCharacter(LETTERS),
    randomCharacter(DIGITS),
    ...Array.from({ length: INITIAL_PASSWORD_LENGTH - 2 }, () =>
      randomCharacter(ALPHABET),
    ),
  ];
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
  return characters.join('');
}
