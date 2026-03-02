import { createNewPrimaryContact, buildConsolidatedResponse } from '../NewCustomerService';
import { ContactRepository } from '../../repositories/ContactRepository';
import { getDatabaseClient } from '../../config/database';
import { Contact } from '../../models/Contact';

describe('NewCustomerService', () => {
  let repository: ContactRepository;
  let prisma: ReturnType<typeof getDatabaseClient>;

  beforeAll(() => {
    prisma = getDatabaseClient();
    repository = new ContactRepository(prisma);
  });

  describe('createNewPrimaryContact', () => {
    it('should create a new primary contact with both email and phoneNumber', async () => {
      const result = await createNewPrimaryContact(
        repository,
        'newcustomer@example.com',
        '1234567890'
      );

      expect(result.primaryContactId).toBeDefined();
      expect(result.emails).toEqual(['newcustomer@example.com']);
      expect(result.phoneNumbers).toEqual(['1234567890']);
      expect(result.secondaryContactIds).toEqual([]);

      // Verify in database
      const contact = await prisma.contact.findUnique({
        where: { id: result.primaryContactId },
      });
      expect(contact).toBeDefined();
      expect(contact!.linkPrecedence).toBe('primary');
      expect(contact!.linkedId).toBeNull();
    });

    it('should create a new primary contact with only email', async () => {
      const result = await createNewPrimaryContact(
        repository,
        'emailonly@example.com'
      );

      expect(result.primaryContactId).toBeDefined();
      expect(result.emails).toEqual(['emailonly@example.com']);
      expect(result.phoneNumbers).toEqual([]);
      expect(result.secondaryContactIds).toEqual([]);
    });

    it('should create a new primary contact with only phoneNumber', async () => {
      const result = await createNewPrimaryContact(
        repository,
        undefined,
        '9876543210'
      );

      expect(result.primaryContactId).toBeDefined();
      expect(result.emails).toEqual([]);
      expect(result.phoneNumbers).toEqual(['9876543210']);
      expect(result.secondaryContactIds).toEqual([]);
    });

    it('should create a new primary contact with neither email nor phoneNumber', async () => {
      const result = await createNewPrimaryContact(repository);

      expect(result.primaryContactId).toBeDefined();
      expect(result.emails).toEqual([]);
      expect(result.phoneNumbers).toEqual([]);
      expect(result.secondaryContactIds).toEqual([]);
    });
  });

  describe('buildConsolidatedResponse', () => {
    it('should build response with primary only', () => {
      const primary: Contact = {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: '1111111111',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const result = buildConsolidatedResponse(primary, []);

      expect(result.primaryContactId).toBe(1);
      expect(result.emails).toEqual(['primary@example.com']);
      expect(result.phoneNumbers).toEqual(['1111111111']);
      expect(result.secondaryContactIds).toEqual([]);
    });

    it('should build response with primary and secondaries', () => {
      const primary: Contact = {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: '1111111111',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondaries: Contact[] = [
        {
          id: 2,
          email: 'secondary1@example.com',
          phoneNumber: '2222222222',
          linkedId: 1,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
        {
          id: 3,
          email: 'secondary2@example.com',
          phoneNumber: '3333333333',
          linkedId: 1,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-03'),
          deletedAt: null,
        },
      ];

      const result = buildConsolidatedResponse(primary, secondaries);

      expect(result.primaryContactId).toBe(1);
      expect(result.emails).toEqual([
        'primary@example.com',
        'secondary1@example.com',
        'secondary2@example.com',
      ]);
      expect(result.phoneNumbers).toEqual(['1111111111', '2222222222', '3333333333']);
      expect(result.secondaryContactIds).toEqual([2, 3]);
    });

    it('should exclude null emails and phoneNumbers', () => {
      const primary: Contact = {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondaries: Contact[] = [
        {
          id: 2,
          email: null,
          phoneNumber: '2222222222',
          linkedId: 1,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
      ];

      const result = buildConsolidatedResponse(primary, secondaries);

      expect(result.emails).toEqual(['primary@example.com']);
      expect(result.phoneNumbers).toEqual(['2222222222']);
    });

    it('should deduplicate emails and phoneNumbers', () => {
      const primary: Contact = {
        id: 1,
        email: 'duplicate@example.com',
        phoneNumber: '1111111111',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondaries: Contact[] = [
        {
          id: 2,
          email: 'duplicate@example.com', // Same as primary
          phoneNumber: '1111111111', // Same as primary
          linkedId: 1,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
        {
          id: 3,
          email: 'unique@example.com',
          phoneNumber: '2222222222',
          linkedId: 1,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-03'),
          deletedAt: null,
        },
      ];

      const result = buildConsolidatedResponse(primary, secondaries);

      expect(result.emails).toEqual(['duplicate@example.com', 'unique@example.com']);
      expect(result.phoneNumbers).toEqual(['1111111111', '2222222222']);
    });

    it('should place primary email and phoneNumber first', () => {
      const primary: Contact = {
        id: 1,
        email: 'z-primary@example.com', // Alphabetically last
        phoneNumber: '9999999999', // Numerically last
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondaries: Contact[] = [
        {
          id: 2,
          email: 'a-secondary@example.com', // Alphabetically first
          phoneNumber: '1111111111', // Numerically first
          linkedId: 1,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
      ];

      const result = buildConsolidatedResponse(primary, secondaries);

      expect(result.emails[0]).toBe('z-primary@example.com');
      expect(result.phoneNumbers[0]).toBe('9999999999');
    });
  });
});
