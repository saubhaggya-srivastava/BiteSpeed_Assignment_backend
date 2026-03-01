import { ContactRepository } from '../ContactRepository';
import { getDatabaseClient } from '../../config/database';
import { CreateContactInput } from '../../models/Contact';

describe('ContactRepository', () => {
  let repository: ContactRepository;
  let prisma: ReturnType<typeof getDatabaseClient>;

  beforeAll(() => {
    prisma = getDatabaseClient();
    repository = new ContactRepository(prisma);
  });

  describe('create', () => {
    it('should create a new primary contact', async () => {
      const input: CreateContactInput = {
        email: 'test@example.com',
        phoneNumber: '1234567890',
        linkPrecedence: 'primary',
        linkedId: null,
      };

      const contact = await repository.create(input);

      expect(contact.id).toBeDefined();
      expect(contact.email).toBe('test@example.com');
      expect(contact.phoneNumber).toBe('1234567890');
      expect(contact.linkPrecedence).toBe('primary');
      expect(contact.linkedId).toBeNull();
      expect(contact.createdAt).toBeInstanceOf(Date);
      expect(contact.updatedAt).toBeInstanceOf(Date);
      expect(contact.deletedAt).toBeNull();
    });

    it('should create a new secondary contact', async () => {
      const primary = await repository.create({
        email: 'primary@example.com',
        phoneNumber: '1111111111',
        linkPrecedence: 'primary',
      });

      const secondary = await repository.create({
        email: 'secondary@example.com',
        phoneNumber: '2222222222',
        linkPrecedence: 'secondary',
        linkedId: primary.id,
      });

      expect(secondary.linkPrecedence).toBe('secondary');
      expect(secondary.linkedId).toBe(primary.id);
    });
  });

  describe('update', () => {
    it('should update a contact', async () => {
      const contact = await repository.create({
        email: 'original@example.com',
        phoneNumber: '3333333333',
        linkPrecedence: 'primary',
      });

      const updated = await repository.update(contact.id, {
        email: 'updated@example.com',
      });

      expect(updated.email).toBe('updated@example.com');
      expect(updated.phoneNumber).toBe('3333333333');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(contact.updatedAt.getTime());
    });

    it('should convert primary to secondary', async () => {
      const contact = await repository.create({
        email: 'convert@example.com',
        phoneNumber: '4444444444',
        linkPrecedence: 'primary',
      });

      const olderPrimary = await repository.create({
        email: 'older@example.com',
        phoneNumber: '5555555555',
        linkPrecedence: 'primary',
      });

      const updated = await repository.update(contact.id, {
        linkPrecedence: 'secondary',
        linkedId: olderPrimary.id,
      });

      expect(updated.linkPrecedence).toBe('secondary');
      expect(updated.linkedId).toBe(olderPrimary.id);
    });
  });

  describe('updateMany', () => {
    it('should update multiple contacts', async () => {
      const contact1 = await repository.create({
        email: 'multi1@example.com',
        phoneNumber: '6666666666',
        linkPrecedence: 'secondary',
        linkedId: 1,
      });

      const contact2 = await repository.create({
        email: 'multi2@example.com',
        phoneNumber: '7777777777',
        linkPrecedence: 'secondary',
        linkedId: 1,
      });

      await repository.updateMany([
        { id: contact1.id, data: { linkedId: 999 } },
        { id: contact2.id, data: { linkedId: 999 } },
      ]);

      const updated1 = await prisma.contact.findUnique({ where: { id: contact1.id } });
      const updated2 = await prisma.contact.findUnique({ where: { id: contact2.id } });

      expect(updated1?.linkedId).toBe(999);
      expect(updated2?.linkedId).toBe(999);
    });
  });

  describe('findByEmailOrPhone', () => {
    beforeEach(async () => {
      await repository.create({
        email: 'find1@example.com',
        phoneNumber: '8888888888',
        linkPrecedence: 'primary',
      });

      await repository.create({
        email: 'find2@example.com',
        phoneNumber: '9999999999',
        linkPrecedence: 'primary',
      });
    });

    it('should find contacts by email', async () => {
      const contacts = await repository.findByEmailOrPhone('find1@example.com');
      expect(contacts.length).toBeGreaterThan(0);
      expect(contacts[0].email).toBe('find1@example.com');
    });

    it('should find contacts by phone number', async () => {
      const contacts = await repository.findByEmailOrPhone(undefined, '9999999999');
      expect(contacts.length).toBeGreaterThan(0);
      expect(contacts[0].phoneNumber).toBe('9999999999');
    });

    it('should find contacts by email or phone', async () => {
      const contacts = await repository.findByEmailOrPhone('find1@example.com', '9999999999');
      expect(contacts.length).toBeGreaterThanOrEqual(2);
    });

    it('should exclude soft-deleted contacts', async () => {
      const contact = await repository.create({
        email: 'deleted@example.com',
        phoneNumber: '0000000000',
        linkPrecedence: 'primary',
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: { deletedAt: new Date() },
      });

      const contacts = await repository.findByEmailOrPhone('deleted@example.com');
      expect(contacts.length).toBe(0);
    });
  });

  describe('findContactTree', () => {
    it('should find all contacts in a tree', async () => {
      const primary = await repository.create({
        email: 'tree-primary@example.com',
        phoneNumber: '1010101010',
        linkPrecedence: 'primary',
      });

      await repository.create({
        email: 'tree-secondary1@example.com',
        phoneNumber: '2020202020',
        linkPrecedence: 'secondary',
        linkedId: primary.id,
      });

      await repository.create({
        email: 'tree-secondary2@example.com',
        phoneNumber: '3030303030',
        linkPrecedence: 'secondary',
        linkedId: primary.id,
      });

      const tree = await repository.findContactTree(primary.id);
      expect(tree.length).toBe(3);
      expect(tree[0].linkPrecedence).toBe('primary');
      expect(tree.filter((c) => c.linkPrecedence === 'secondary').length).toBe(2);
    });
  });

  describe('transaction', () => {
    it('should execute operations within a transaction', async () => {
      const result = await repository.transaction(async (repo) => {
        const contact1 = await repo.create({
          email: 'tx1@example.com',
          phoneNumber: '4040404040',
          linkPrecedence: 'primary',
        });

        const contact2 = await repo.create({
          email: 'tx2@example.com',
          phoneNumber: '5050505050',
          linkPrecedence: 'secondary',
          linkedId: contact1.id,
        });

        return { contact1, contact2 };
      });

      expect(result.contact1.id).toBeDefined();
      expect(result.contact2.linkedId).toBe(result.contact1.id);
    });

    it('should rollback on transaction failure', async () => {
      const initialCount = await prisma.contact.count();

      try {
        await repository.transaction(async (repo) => {
          await repo.create({
            email: 'rollback@example.com',
            phoneNumber: '6060606060',
            linkPrecedence: 'primary',
          });

          throw new Error('Simulated error');
        });
      } catch (error) {
        // Expected error
      }

      const finalCount = await prisma.contact.count();
      expect(finalCount).toBe(initialCount);
    });
  });
});
