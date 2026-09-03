import { TempleType as PrismaTempleType } from '../../../generated/prisma';
import { TEMPLE_TYPES, TEMPLE_TYPE_FROM_DB, TEMPLE_TYPE_TO_DB } from './temple.constants';

describe('temple type mappings', () => {
  it('supports Đền in validation and Prisma mappings', () => {
    expect(TEMPLE_TYPES).toContain('Đền');
    expect(TEMPLE_TYPE_TO_DB.Đền).toBe(PrismaTempleType.DEN);
    expect(TEMPLE_TYPE_FROM_DB[PrismaTempleType.DEN]).toBe('Đền');
  });
});
