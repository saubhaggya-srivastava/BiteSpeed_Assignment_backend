import { groupIntoTrees, exactMatchExists, hasNewInformation } from '../ContactTreeManager';
import { Contact } from '../../models/Contact';

describe('ContactTreeManager', () => {
  describe('groupIntoTrees', () => {
    it('should group a single primary contact into one tree', () => {
      const contacts: Contact[] = [
        {
          id: 1,
          email: 'primary@example.com',
          phoneNumber: '1111111111',
          linkedId: null,
          linkPrecedence: 'primary',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
      ];

      const trees = groupIntoTrees(contacts);

      expect(trees.length).toBe(1);
      expect(trees[0].primary.id).toBe(1);
      expect(trees[0].secondaries.length).toBe(0);
    });

    it('should group primary and secondary contacts into one tree', () => {
      const contacts: Contact[] = [
        {
          id: 1,
          email: 'primary@example.com',
          phoneNumber: '1111111111',
          linkedId: null,
          linkPrecedence: 'primary',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
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

      const trees = groupIntoTrees(contacts);

      expect(trees.length).toBe(1);
      expect(trees[0].primary.id).toBe(1);
      expect(trees[0].secondaries.length).toBe(2);
      expect(trees[0].secondaries[0].id).toBe(2);
      expect(trees[0].secondaries[1].id).toBe(3);
    });

    it('should group multiple separate trees', () => {
      const contacts: Contact[] = [
        {
          id: 1,
          email: 'primary1@example.com',
          phoneNumber: '1111111111',
          linkedId: null,
          linkPrecedence: 'primary',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
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
          email: 'primary2@example.com',
          phoneNumber: '3333333333',
          linkedId: null,
          linkPrecedence: 'primary',
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-03'),
          deletedAt: null,
        },
        {
          id: 4,
          email: 'secondary2@example.com',
          phoneNumber: '4444444444',
          linkedId: 3,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-04'),
          updatedAt: new Date('2023-01-04'),
          deletedAt: null,
        },
      ];

      const trees = groupIntoTrees(contacts);

      expect(trees.length).toBe(2);
      
      const tree1 = trees.find((t) => t.primary.id === 1);
      const tree2 = trees.find((t) => t.primary.id === 3);

      expect(tree1).toBeDefined();
      expect(tree1!.secondaries.length).toBe(1);
      expect(tree1!.secondaries[0].id).toBe(2);

      expect(tree2).toBeDefined();
      expect(tree2!.secondaries.length).toBe(1);
      expect(tree2!.secondaries[0].id).toBe(4);
    });

    it('should handle contacts with null email or phoneNumber', () => {
      const contacts: Contact[] = [
        {
          id: 1,
          email: null,
          phoneNumber: '1111111111',
          linkedId: null,
          linkPrecedence: 'primary',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
        {
          id: 2,
          email: 'secondary@example.com',
          phoneNumber: null,
          linkedId: 1,
          linkPrecedence: 'secondary',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
      ];

      const trees = groupIntoTrees(contacts);

      expect(trees.length).toBe(1);
      expect(trees[0].primary.phoneNumber).toBe('1111111111');
      expect(trees[0].secondaries[0].email).toBe('secondary@example.com');
    });
  });

  describe('exactMatchExists', () => {
    const tree = {
      primary: {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: '1111111111',
        linkedId: null,
        linkPrecedence: 'primary' as const,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      },
      secondaries: [
        {
          id: 2,
          email: 'secondary@example.com',
          phoneNumber: '2222222222',
          linkedId: 1,
          linkPrecedence: 'secondary' as const,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
      ],
    };

    it('should return true for exact match with both email and phone', () => {
      const result = exactMatchExists(tree, 'primary@example.com', '1111111111');
      expect(result).toBe(true);
    });

    it('should return true for exact match with only email', () => {
      const result = exactMatchExists(tree, 'primary@example.com');
      expect(result).toBe(true);
    });

    it('should return true for exact match with only phone', () => {
      const result = exactMatchExists(tree, undefined, '2222222222');
      expect(result).toBe(true);
    });

    it('should return false when email does not match', () => {
      const result = exactMatchExists(tree, 'nonexistent@example.com', '1111111111');
      expect(result).toBe(false);
    });

    it('should return false when phone does not match', () => {
      const result = exactMatchExists(tree, 'primary@example.com', '9999999999');
      expect(result).toBe(false);
    });

    it('should return false when neither email nor phone match', () => {
      const result = exactMatchExists(tree, 'new@example.com', '9999999999');
      expect(result).toBe(false);
    });
  });

  describe('hasNewInformation', () => {
    const tree = {
      primary: {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: '1111111111',
        linkedId: null,
        linkPrecedence: 'primary' as const,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      },
      secondaries: [
        {
          id: 2,
          email: 'secondary@example.com',
          phoneNumber: '2222222222',
          linkedId: 1,
          linkPrecedence: 'secondary' as const,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
      ],
    };

    it('should return true when email is new', () => {
      const result = hasNewInformation(tree, 'new@example.com', '1111111111');
      expect(result).toBe(true);
    });

    it('should return true when phone is new', () => {
      const result = hasNewInformation(tree, 'primary@example.com', '9999999999');
      expect(result).toBe(true);
    });

    it('should return true when both email and phone are new', () => {
      const result = hasNewInformation(tree, 'new@example.com', '9999999999');
      expect(result).toBe(true);
    });

    it('should return false when both email and phone exist', () => {
      const result = hasNewInformation(tree, 'primary@example.com', '1111111111');
      expect(result).toBe(false);
    });

    it('should return false when only existing email is provided', () => {
      const result = hasNewInformation(tree, 'secondary@example.com');
      expect(result).toBe(false);
    });

    it('should return false when only existing phone is provided', () => {
      const result = hasNewInformation(tree, undefined, '2222222222');
      expect(result).toBe(false);
    });
  });
});
