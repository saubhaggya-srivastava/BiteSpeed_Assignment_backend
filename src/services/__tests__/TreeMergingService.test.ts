import { mergeTrees } from '../TreeMergingService';
import { ContactRepository } from '../../repositories/ContactRepository';
import { getDatabaseClient } from '../../config/database';
import { ContactTree } from '../../models/Contact';
import { createSecondaryContact } from '../SecondaryContactService';

describe('TreeMergingService', () => {
  let repository: ContactRepository;
  let prisma: ReturnType<typeof getDatabaseClient>;

  beforeAll(() => {
    prisma = getDatabaseClient();
    repository = new ContactRepository(prisma);
  });

  describe('mergeTrees', () => {
    it('should merge two trees with older primary remaining as primary', async () => {
      // Create first tree (older)
      const primary1 = await repository.create({
        email: 'older@example.com',
        phoneNumber: '1111111111',
        linkPrecedence: 'primary',
      });

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second tree (newer)
      const primary2 = await repository.create({
        email: 'newer@example.com',
        phoneNumber: '2222222222',
        linkPrecedence: 'primary',
      });

      const tree1: ContactTree = {
        primary: primary1,
        secondaries: [],
      };

      const tree2: ContactTree = {
        primary: primary2,
        secondaries: [],
      };

      // Merge trees
      const result = await mergeTrees(repository, tree1, tree2);

      // Verify older primary remains primary
      expect(result.primaryContactId).toBe(primary1.id);

      // Verify newer primary is now secondary
      const updatedPrimary2 = await prisma.contact.findUnique({
        where: { id: primary2.id },
      });
      expect(updatedPrimary2!.linkPrecedence).toBe('secondary');
      expect(updatedPrimary2!.linkedId).toBe(primary1.id);

      // Verify response includes both emails and phones
      expect(result.emails).toContain('older@example.com');
      expect(result.emails).toContain('newer@example.com');
      expect(result.phoneNumbers).toContain('1111111111');
      expect(result.phoneNumbers).toContain('2222222222');
      expect(result.secondaryContactIds).toContain(primary2.id);
    });

    it('should merge trees with secondaries and update all linkedIds', async () => {
      // Create first tree with secondaries
      const primary1 = await repository.create({
        email: 'tree1-primary@example.com',
        phoneNumber: '3333333333',
        linkPrecedence: 'primary',
      });

      const sec1 = await createSecondaryContact(
        repository,
        primary1.id,
        'tree1-sec1@example.com',
        '4444444444'
      );

      const sec2 = await createSecondaryContact(
        repository,
        primary1.id,
        'tree1-sec2@example.com',
        '5555555555'
      );

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second tree with secondaries
      const primary2 = await repository.create({
        email: 'tree2-primary@example.com',
        phoneNumber: '6666666666',
        linkPrecedence: 'primary',
      });

      const sec3 = await createSecondaryContact(
        repository,
        primary2.id,
        'tree2-sec1@example.com',
        '7777777777'
      );

      const sec4 = await createSecondaryContact(
        repository,
        primary2.id,
        'tree2-sec2@example.com',
        '8888888888'
      );

      const tree1: ContactTree = {
        primary: primary1,
        secondaries: [sec1, sec2],
      };

      const tree2: ContactTree = {
        primary: primary2,
        secondaries: [sec3, sec4],
      };

      // Merge trees
      const result = await mergeTrees(repository, tree1, tree2);

      // Verify older primary remains primary
      expect(result.primaryContactId).toBe(primary1.id);

      // Verify all secondaries from tree2 now point to primary1
      const updatedSec3 = await prisma.contact.findUnique({ where: { id: sec3.id } });
      const updatedSec4 = await prisma.contact.findUnique({ where: { id: sec4.id } });

      expect(updatedSec3!.linkedId).toBe(primary1.id);
      expect(updatedSec4!.linkedId).toBe(primary1.id);

      // Verify response includes all contacts
      expect(result.secondaryContactIds).toContain(sec1.id);
      expect(result.secondaryContactIds).toContain(sec2.id);
      expect(result.secondaryContactIds).toContain(primary2.id); // Now a secondary
      expect(result.secondaryContactIds).toContain(sec3.id);
      expect(result.secondaryContactIds).toContain(sec4.id);
    });

    it('should preserve older primary when tree2 is older', async () => {
      // Create newer tree first
      const primary1 = await repository.create({
        email: 'newer2@example.com',
        phoneNumber: '9999999999',
        linkPrecedence: 'primary',
      });

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create older tree second
      const primary2 = await repository.create({
        email: 'older2@example.com',
        phoneNumber: '0000000000',
        linkPrecedence: 'primary',
      });

      // Manually set createdAt to make primary2 older
      await prisma.contact.update({
        where: { id: primary2.id },
        data: { createdAt: new Date(Date.now() - 10000) }, // 10 seconds ago
      });

      // Reload to get updated timestamp
      const reloadedPrimary2 = await prisma.contact.findUnique({
        where: { id: primary2.id },
      });

      const tree1: ContactTree = {
        primary: primary1,
        secondaries: [],
      };

      const tree2: ContactTree = {
        primary: reloadedPrimary2!,
        secondaries: [],
      };

      // Merge trees
      const result = await mergeTrees(repository, tree1, tree2);

      // Verify older primary (primary2) remains primary
      expect(result.primaryContactId).toBe(primary2.id);

      // Verify newer primary (primary1) is now secondary
      const updatedPrimary1 = await prisma.contact.findUnique({
        where: { id: primary1.id },
      });
      expect(updatedPrimary1!.linkPrecedence).toBe('secondary');
      expect(updatedPrimary1!.linkedId).toBe(primary2.id);
    });

    it('should handle transaction rollback on failure', async () => {
      const primary1 = await repository.create({
        email: 'rollback1@example.com',
        phoneNumber: '1212121212',
        linkPrecedence: 'primary',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const primary2 = await repository.create({
        email: 'rollback2@example.com',
        phoneNumber: '3434343434',
        linkPrecedence: 'primary',
      });

      const tree1: ContactTree = {
        primary: primary1,
        secondaries: [],
      };

      const tree2: ContactTree = {
        primary: primary2,
        secondaries: [],
      };

      // Get initial state
      const initialPrimary2 = await prisma.contact.findUnique({
        where: { id: primary2.id },
      });

      // Create a mock repository that will fail during merge
      const failingRepo = new ContactRepository(prisma);
      const originalUpdateMany = failingRepo.updateMany.bind(failingRepo);
      failingRepo.updateMany = async () => {
        throw new Error('Simulated failure');
      };

      // Attempt merge (should fail and rollback)
      try {
        await mergeTrees(failingRepo, tree1, tree2);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected error
      }

      // Verify primary2 is still primary (rollback successful)
      const finalPrimary2 = await prisma.contact.findUnique({
        where: { id: primary2.id },
      });
      expect(finalPrimary2!.linkPrecedence).toBe('primary');
      expect(finalPrimary2!.linkedId).toBeNull();
    });

    it('should include all emails and phones from both trees', async () => {
      const primary1 = await repository.create({
        email: 'merge1@example.com',
        phoneNumber: '5656565656',
        linkPrecedence: 'primary',
      });

      const sec1 = await createSecondaryContact(
        repository,
        primary1.id,
        'merge1-sec@example.com',
        '7878787878'
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      const primary2 = await repository.create({
        email: 'merge2@example.com',
        phoneNumber: '9090909090',
        linkPrecedence: 'primary',
      });

      const sec2 = await createSecondaryContact(
        repository,
        primary2.id,
        'merge2-sec@example.com',
        '1212121212'
      );

      const tree1: ContactTree = {
        primary: primary1,
        secondaries: [sec1],
      };

      const tree2: ContactTree = {
        primary: primary2,
        secondaries: [sec2],
      };

      const result = await mergeTrees(repository, tree1, tree2);

      // Verify all emails are included
      expect(result.emails).toContain('merge1@example.com');
      expect(result.emails).toContain('merge1-sec@example.com');
      expect(result.emails).toContain('merge2@example.com');
      expect(result.emails).toContain('merge2-sec@example.com');

      // Verify all phones are included
      expect(result.phoneNumbers).toContain('5656565656');
      expect(result.phoneNumbers).toContain('7878787878');
      expect(result.phoneNumbers).toContain('9090909090');
      expect(result.phoneNumbers).toContain('1212121212');
    });
  });
});
