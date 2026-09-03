import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MediaController } from './media.controller';

describe('MediaController', () => {
  const user = { id: 'owner-id' } as AuthenticatedUser;
  const firstMedia = { id: 'media-1' };
  const secondMedia = { id: 'media-2' };
  const mediaService = {
    uploadImage: jest
      .fn()
      .mockResolvedValueOnce(firstMedia)
      .mockResolvedValueOnce(secondMedia),
  };
  const controller = new MediaController(mediaService as never);

  beforeEach(() => jest.clearAllMocks());

  it('uploads all files and returns their media records in order', async () => {
    const files = [
      { buffer: Buffer.from('first') },
      { buffer: Buffer.from('second') },
    ] as Express.Multer.File[];

    await expect(controller.uploadImages(files, user)).resolves.toEqual([
      firstMedia,
      secondMedia,
    ]);
    expect(mediaService.uploadImage).toHaveBeenNthCalledWith(1, {
      ownerId: user.id,
      buffer: files[0].buffer,
    });
    expect(mediaService.uploadImage).toHaveBeenNthCalledWith(2, {
      ownerId: user.id,
      buffer: files[1].buffer,
    });
  });

  it('rejects an empty upload', async () => {
    await expect(controller.uploadImages([], user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mediaService.uploadImage).not.toHaveBeenCalled();
  });
});
