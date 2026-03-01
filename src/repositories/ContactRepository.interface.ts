import { Contact, CreateContactInput, UpdateContactInput } from '../models/Contact';

export interface IContactRepository {
  /**
   * Find contacts by email or phone number (excluding soft-deleted)
   */
  findByEmailOrPhone(email?: string, phoneNumber?: string): Promise<Contact[]>;

  /**
   * Find all contacts in a tree (primary + all secondaries)
   */
  findContactTree(primaryId: number): Promise<Contact[]>;

  /**
   * Create a new contact
   */
  create(contact: CreateContactInput): Promise<Contact>;

  /**
   * Update a contact
   */
  update(id: number, updates: UpdateContactInput): Promise<Contact>;

  /**
   * Update multiple contacts in a transaction
   */
  updateMany(updates: Array<{ id: number; data: UpdateContactInput }>): Promise<void>;

  /**
   * Execute operations within a transaction
   */
  transaction<T>(fn: (repo: IContactRepository) => Promise<T>): Promise<T>;
}
