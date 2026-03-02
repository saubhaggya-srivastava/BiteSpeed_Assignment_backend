import { IdentityReconciliationService } from '../IdentityReconciliationService';
import { ContactRepository } from '../../repositories/ContactRepository';
import { getDatabaseClient } from '../../config/database';

describe('IdentityReconciliationService', () => {
  let service: IdentityReconciliationService;
  let repository: ContactRepository;
  let prisma: ReturnType<typeof getDatabaseClient>;

  beforeAll(() => {
    prisma = getDatabaseClient();
    repository = new ContactRepository(prisma);
    service = new IdentityReconciliationService(repository);
  });

  describe('identify - Scenario A: New Customer', () => {
    it('should create new primary contact for new customer with both email and phone', async () => {
      const result = await service.identify('newuser@example.com', '1234567890');

      expect(result.primaryContactId).toBeDefined();
      expect(result.emails).toEqual(['newuser@example.com']);
      expect(result.phoneNumbers).toEqual(['1234567890']);
      expect(result.secondaryContactIds).toEqual([]);

      // Verify in database
      const contact = await prisma.contact.findUnique({
        where: { id: result.primaryContactId },
      });
      expect(contact!.linkPrecedence).toBe('primary');
    });

    it('should create new primary contact with only email', async () => {
      const result = await service.identify('emailonly@example.com');

      expect(result.emails).toEqual(['emailonly@example.com']);
      expect(result.phoneNumbers).toEqual([]);
      expect(result.secondaryContactIds).toEqual([]);
    });

    it('should create new primary contact with only phone', async () => {
      const result = await service.identify(undefined, '9876543210');

      expect(result.emails).toEqual([]);
      expect(result.phoneNumbers).toEqual(['9876543210']);
      expect(result.secondaryContactIds).toEqual([]);
    });
  });

  describe('identify - Scenario B: Secondary Contact Linking', () => {
    it('should create secondary contact when new email is provided with existing phone', async () => {
      // First request - creates primary
      const result1 = await service.identify('first@example.com', '1111111111');
      const primaryId = result1.primaryContactId;

      // Second request - same phone, new email
      const result2 = await service.identify('second@example.com', '1111111111');

      expect(result2.primaryContactId).toBe(primaryId);
      expect(result2.emails).toContain('first@example.com');
      expect(result2.emails).toContain('second@example.com');
      expect(result2.phoneNumbers).toEqual(['1111111111']);
      expect(result2.secondaryContactIds.length).toBe(1);
    });

    it('should create secondary contact when new phone is provided with existing email', async () => {
      // First request - creates primary
      const result1 = await service.identify('existing@example.com', '2222222222');
      const primaryId = result1.primaryContactId;

      // Second request - same email, new phone
      const result2 = await service.identify('existing@example.com', '3333333333');

      expect(result2.primaryContactId).toBe(primaryId);
      expect(result2.emails).toEqual(['existing@example.com']);
      expect(result2.phoneNumbers).toContain('2222222222');
      expect(result2.phoneNumbers).toContain('3333333333');
      expect(result2.secondaryContactIds.length).toBe(1);
    });

    it('should create secondary contact when both email and phone are new', async () => {
      // First request - creates primary
      const result1 = await service.identify('primary@example.com', '4444444444');
      const primaryId = result1.primaryContactId;

      // Second request - same phone, new email
      const result2 = await service.identify('secondary@example.com', '4444444444');

      expect(result2.primaryContactId).toBe(primaryId);
      expect(result2.emails).toContain('primary@example.com');
      expect(result2.emails).toContain('secondary@example.com');
      expect(result2.secondaryContactIds.length).toBe(1);
    });

    it('should handle multiple secondaries correctly', async () => {
      // Create primary
      const result1 = await service.identify('multi@example.com', '5555555555');
      const primaryId = result1.primaryContactId;

      // Add first secondary
      await service.identify('multi2@example.com', '5555555555');

      // Add second secondary
      await service.identify('multi3@example.com', '5555555555');

      // Add third secondary
      const result4 = await service.identify('multi4@example.com', '5555555555');

      expect(result4.primaryContactId).toBe(primaryId);
      expect(result4.emails).toHaveLength(4);
      expect(result4.secondaryContactIds).toHaveLength(3);
    });
  });

  describe('identify - Scenario C: Tree Merging', () => {
    it('should merge two separate trees when connection is discovered', async () => {
      // Create first tree
      const result1 = await service.identify('george@hillvalley.edu', '919191');
      const primary1Id = result1.primaryContactId;

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second tree
      const result2 = await service.identify('biffsucks@hillvalley.edu', '717171');
      const primary2Id = result2.primaryContactId;

      // Verify two separate trees exist
      expect(primary1Id).not.toBe(primary2Id);

      // Request that links both trees
      const result3 = await service.identify('george@hillvalley.edu', '717171');

      // Verify trees are merged with older primary
      expect(result3.primaryContactId).toBe(primary1Id);
      expect(result3.emails).toContain('george@hillvalley.edu');
      expect(result3.emails).toContain('biffsucks@hillvalley.edu');
      expect(result3.phoneNumbers).toContain('919191');
      expect(result3.phoneNumbers).toContain('717171');
      expect(result3.secondaryContactIds).toContain(primary2Id);
    });

    it('should merge trees with secondaries', async () => {
      // Create first tree with secondary
      await service.identify('tree1-primary@example.com', '6666666666');
      await service.identify('tree1-secondary@example.com', '6666666666');

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second tree with secondary
      await service.identify('tree2-primary@example.com', '7777777777');
      await service.identify('tree2-secondary@example.com', '7777777777');

      // Merge trees
      const result = await service.identify('tree1-primary@example.com', '7777777777');

      expect(result.emails).toHaveLength(4);
      expect(result.phoneNumbers).toHaveLength(2);
      expect(result.secondaryContactIds.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('identify - Idempotent Behavior', () => {
    it('should return same result for duplicate requests', async () => {
      const result1 = await service.identify('idempotent@example.com', '8888888888');
      const result2 = await service.identify('idempotent@example.com', '8888888888');

      expect(result1.primaryContactId).toBe(result2.primaryContactId);
      expect(result1.emails).toEqual(result2.emails);
      expect(result1.phoneNumbers).toEqual(result2.phoneNumbers);
      expect(result1.secondaryContactIds).toEqual(result2.secondaryContactIds);
    });

    it('should not create duplicate contacts for same email', async () => {
      await service.identify('duplicate@example.com', '9999999999');
      const result = await service.identify('duplicate@example.com');

      expect(result.emails).toEqual(['duplicate@example.com']);
      expect(result.secondaryContactIds.length).toBe(0);
    });

    it('should not create duplicate contacts for same phone', async () => {
      await service.identify('phone@example.com', '0000000000');
      const result = await service.identify(undefined, '0000000000');

      expect(result.phoneNumbers).toEqual(['0000000000']);
      expect(result.secondaryContactIds.length).toBe(0);
    });
  });

  describe('identify - Input Normalization', () => {
    it('should trim whitespace from email', async () => {
      const result = await service.identify('  trimmed@example.com  ', '1212121212');

      expect(result.emails).toEqual(['trimmed@example.com']);
    });

    it('should trim whitespace from phoneNumber', async () => {
      const result = await service.identify('trim@example.com', '  3434343434  ');

      expect(result.phoneNumbers).toEqual(['3434343434']);
    });

    it('should handle empty strings as undefined', async () => {
      const result = await service.identify('', '5656565656');

      expect(result.emails).toEqual([]);
      expect(result.phoneNumbers).toEqual(['5656565656']);
    });
  });

  describe('identify - Complete Flow Examples', () => {
    it('should handle the example from requirements (lorraine and mcfly)', async () => {
      // First order
      const result1 = await service.identify('lorraine@hillvalley.edu', '123456');
      expect(result1.emails).toEqual(['lorraine@hillvalley.edu']);
      expect(result1.phoneNumbers).toEqual(['123456']);
      expect(result1.secondaryContactIds).toEqual([]);

      // Second order with same phone, new email
      const result2 = await service.identify('mcfly@hillvalley.edu', '123456');
      expect(result2.emails).toContain('lorraine@hillvalley.edu');
      expect(result2.emails).toContain('mcfly@hillvalley.edu');
      expect(result2.phoneNumbers).toEqual(['123456']);
      expect(result2.secondaryContactIds.length).toBe(1);

      // Query with just phone
      const result3 = await service.identify(undefined, '123456');
      expect(result3).toEqual(result2);

      // Query with just one email
      const result4 = await service.identify('lorraine@hillvalley.edu');
      expect(result4).toEqual(result2);
    });
  });
});
