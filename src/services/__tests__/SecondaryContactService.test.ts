import {
  createSecondaryContact,
  buildConsolidatedResponseFromTree,
} from '../SecondaryContactService';
import { ContactRepository } from '../../repositories/ContactRepository';
import { getDatabaseClient } from '../../config/database';

describe('SecondaryContactService', () => {
  let repository: ContactRepository;
  let prisma: ReturnType<typeof getDatabaseClient>;

  beforeAll(() => {
    prisma = getDatabaseClient();
    repository = new ContactRepository(prisma);
  });

  describe('createSecondaryContact', () => {
    it('should create a secondary contact with new email', async () => {
      // Create primary contact
      const primary = await repository.create({
        email: 'primary@example.com',
        phoneNumber: '1111111111',
        linkPrecedence: 'primary',
      });

      // Create secondary with new email
      const secondary = await createSecondaryContact(
        repository,
        primary.id,
        'secondary@example.com',
        '1111111111'
      );

      expect(secondary.id).toBeDefined();
      expect(secondary.email).toBe('secondary@example.com');
      expect(secondary.phoneNumber).toBe('1111111111');
      expect(secondary.linkPrecedence).toBe('secondary');
      expect(secondary.linkedId).toBe(primary.id);
    });

    it('should create a secondary contact with new phone', async () => {
      // Create primary contact
      const primary = await repository.create({
        email: 'primary2@example.com',
        phoneNumber: '2222222222',
        linkPrecedence: 'primary',
      });

      // Create secondary with new phone
      const secondary = await createSecondaryContact(
        repository,
        primary.id,
        'primary2@example.com',
        '3333333333'
      );

      expect(secondary.phoneNumber).toBe('3333333333');
      expect(secondary.linkedId).toBe(primary.id);
    });

    it('should create a secondary contact with both new email and phone', async () => {
      // Create primary contact
      const primary = await repository.create({
        email: 'primary3@example.com',
        phoneNumber: '4444444444',
        linkPrecedence: 'primary',
      });

      // Create secondary with both new
      const secondary = await createSecondaryContact(
        repository,
        primary.id,
        'newsecondary@example.com',
        '5555555555'
      );

      expect(secondary.email).toBe('newsecondary@example.com');
      expect(secondary.phoneNumber).toBe('5555555555');
      expect(secondary.linkedId).toBe(primary.id);
    });
  });

  describe('buildConsolidatedResponseFromTree', () => {
    it('should build response with primary only', async () => {
      const primary = await repository.create({
        email: 'solo@example.com',
        phoneNumber: '6666666666',
        linkPrecedence: 'primary',
      });

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.primaryContactId).toBe(primary.id);
      expect(result.emails).toEqual(['solo@example.com']);
      expect(result.phoneNumbers).toEqual(['6666666666']);
      expect(result.secondaryContactIds).toEqual([]);
    });

    it('should build response with primary and one secondary', async () => {
      const primary = await repository.create({
        email: 'primary4@example.com',
        phoneNumber: '7777777777',
        linkPrecedence: 'primary',
      });

      const secondary = await createSecondaryContact(
        repository,
        primary.id,
        'secondary4@example.com',
        '8888888888'
      );

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.primaryContactId).toBe(primary.id);
      expect(result.emails).toEqual(['primary4@example.com', 'secondary4@example.com']);
      expect(result.phoneNumbers).toEqual(['7777777777', '8888888888']);
      expect(result.secondaryContactIds).toEqual([secondary.id]);
    });

    it('should build response with primary and multiple secondaries', async () => {
      const primary = await repository.create({
        email: 'primary5@example.com',
        phoneNumber: '9999999999',
        linkPrecedence: 'primary',
      });

      const secondary1 = await createSecondaryContact(
        repository,
        primary.id,
        'secondary5a@example.com',
        '1010101010'
      );

      const secondary2 = await createSecondaryContact(
        repository,
        primary.id,
        'secondary5b@example.com',
        '2020202020'
      );

      const secondary3 = await createSecondaryContact(
        repository,
        primary.id,
        'secondary5c@example.com',
        '3030303030'
      );

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.primaryContactId).toBe(primary.id);
      expect(result.emails).toEqual([
        'primary5@example.com',
        'secondary5a@example.com',
        'secondary5b@example.com',
        'secondary5c@example.com',
      ]);
      expect(result.phoneNumbers).toEqual([
        '9999999999',
        '1010101010',
        '2020202020',
        '3030303030',
      ]);
      expect(result.secondaryContactIds).toEqual([
        secondary1.id,
        secondary2.id,
        secondary3.id,
      ]);
    });

    it('should place primary email first even if alphabetically last', async () => {
      const primary = await repository.create({
        email: 'z-primary@example.com',
        phoneNumber: '4040404040',
        linkPrecedence: 'primary',
      });

      await createSecondaryContact(
        repository,
        primary.id,
        'a-secondary@example.com',
        '5050505050'
      );

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.emails[0]).toBe('z-primary@example.com');
    });

    it('should place primary phone first even if numerically last', async () => {
      const primary = await repository.create({
        email: 'primary6@example.com',
        phoneNumber: '9999999999',
        linkPrecedence: 'primary',
      });

      await createSecondaryContact(
        repository,
        primary.id,
        'secondary6@example.com',
        '1111111111'
      );

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.phoneNumbers[0]).toBe('9999999999');
    });

    it('should exclude null emails and phoneNumbers', async () => {
      const primary = await repository.create({
        email: 'primary7@example.com',
        phoneNumber: null,
        linkPrecedence: 'primary',
      });

      await createSecondaryContact(repository, primary.id, null, '6060606060');

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.emails).toEqual(['primary7@example.com']);
      expect(result.phoneNumbers).toEqual(['6060606060']);
    });

    it('should deduplicate emails and phoneNumbers', async () => {
      const primary = await repository.create({
        email: 'duplicate@example.com',
        phoneNumber: '7070707070',
        linkPrecedence: 'primary',
      });

      // Create secondary with duplicate email
      await createSecondaryContact(
        repository,
        primary.id,
        'duplicate@example.com',
        '8080808080'
      );

      // Create secondary with duplicate phone
      await createSecondaryContact(
        repository,
        primary.id,
        'unique@example.com',
        '7070707070'
      );

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.emails).toEqual(['duplicate@example.com', 'unique@example.com']);
      expect(result.phoneNumbers).toEqual(['7070707070', '8080808080']);
    });

    it('should order secondaryContactIds by createdAt ascending', async () => {
      const primary = await repository.create({
        email: 'primary8@example.com',
        phoneNumber: '9090909090',
        linkPrecedence: 'primary',
      });

      // Create secondaries with delays to ensure different timestamps
      const sec1 = await createSecondaryContact(
        repository,
        primary.id,
        'sec1@example.com',
        '0101010101'
      );

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sec2 = await createSecondaryContact(
        repository,
        primary.id,
        'sec2@example.com',
        '0202020202'
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      const sec3 = await createSecondaryContact(
        repository,
        primary.id,
        'sec3@example.com',
        '0303030303'
      );

      const result = await buildConsolidatedResponseFromTree(repository, primary.id);

      expect(result.secondaryContactIds).toEqual([sec1.id, sec2.id, sec3.id]);
    });
  });
});
