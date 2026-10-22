import {
  generateInitialPassword,
  INITIAL_PASSWORD_LENGTH,
} from './initial-password';

describe('generateInitialPassword', () => {
  it('generates distinct fixed-length passwords containing letters and digits', () => {
    const passwords = new Set(
      Array.from({ length: 20 }, () => generateInitialPassword()),
    );

    expect(passwords.size).toBe(20);
    for (const password of passwords) {
      expect(password).toHaveLength(INITIAL_PASSWORD_LENGTH);
      expect(password).toMatch(/[A-Za-z]/);
      expect(password).toMatch(/\d/);
      expect(password).not.toMatch(/[01IOlo]/);
    }
  });
});
