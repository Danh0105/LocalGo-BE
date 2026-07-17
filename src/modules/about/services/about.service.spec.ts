import type { AboutPage } from '../../../../generated/prisma';
import { ABOUT_INITIAL_SNAPSHOT } from '../../../../prisma/about-seed-data';
import { AboutService } from './about.service';

describe('AboutService publish transaction', () => {
  it('does not commit published state when a later publish step fails', async () => {
    const published = structuredClone(ABOUT_INITIAL_SNAPSHOT);
    const draft = structuredClone(ABOUT_INITIAL_SNAPSHOT);
    draft.title = 'Draft that must roll back';
    const persisted: AboutPage = {
      id: 'about',
      draftSnapshot: draft,
      publishedSnapshot: published,
      version: 2,
      publishedVersion: 1,
      createdById: null,
      updatedById: null,
      publishedById: null,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const persistedRevisions: number[] = [];

    const prisma = {
      $transaction: async (
        callback: (tx: {
          aboutPage: {
            findUnique: () => Promise<AboutPage>;
            update: () => Promise<AboutPage>;
          };
          media: { count: () => Promise<number> };
          aboutRevision: { create: () => Promise<object> };
          auditLog: { create: () => Promise<object> };
        }) => Promise<void>,
      ): Promise<void> => {
        const transactionalPage = structuredClone(persisted);
        const transactionalRevisions = [...persistedRevisions];
        const tx = {
          aboutPage: {
            findUnique: () => Promise.resolve(transactionalPage),
            update: () => {
              transactionalPage.publishedSnapshot =
                transactionalPage.draftSnapshot;
              transactionalPage.publishedVersion = transactionalPage.version;
              return Promise.resolve(transactionalPage);
            },
          },
          media: { count: () => Promise.resolve(0) },
          aboutRevision: {
            create: () => {
              transactionalRevisions.push(transactionalPage.version);
              return Promise.resolve({});
            },
          },
          auditLog: {
            create: () => Promise.reject(new Error('simulated audit failure')),
          },
        };
        await callback(tx);
        Object.assign(persisted, transactionalPage);
        persistedRevisions.splice(
          0,
          persistedRevisions.length,
          ...transactionalRevisions,
        );
      },
    };
    const repository = { findPage: jest.fn(), findMedia: jest.fn() };
    const service = new AboutService(repository as never, prisma as never);

    await expect(service.publish('actor-id')).rejects.toThrow(
      'simulated audit failure',
    );
    expect(persisted.publishedVersion).toBe(1);
    expect((persisted.publishedSnapshot as { title: string }).title).toBe(
      'Giới thiệu',
    );
    expect(persistedRevisions).toEqual([]);
  });
});
